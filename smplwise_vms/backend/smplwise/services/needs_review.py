"""NEEDSREVIEW (2.8.0, lead decisions 2026-10-18 on private/planning/needsreview_spec_2026-10-18.md): the "needs review" report
(דוח דורש בחינה) - the privacy review list of the people Arx knows for door access, and its yearly reminder.

Read-only, computed on request from existing tables (no migration, no door-event storage):

  A. pending   a technician a vendor added on the arrival page (`access_pending_contacts`) that nobody accepted or rejected, waiting
               longer than `directory.review_pending_days` (default 30). Row action: the EXISTING "reject and delete"
               (access_grants.reject_pending_contact, POST /access-grants/pending-contacts/{id}/reject).
  B. idle      a directory person (kind `person`, not an internal user, not an employee, not erased, not pending) that Arx knows for
               access - accepted from the arrival page, linked to a door-system person, or with any grant row - with NO live grant and
               no activity for `directory.review_idle_months` (default 12). Activity = the latest of the contact's creation, its last
               ticket assignment, its acceptance, its link, and the creation / end of any of its grant rows (grant dates in Arx only -
               lead decision 2; Arx stores no door events). Row action: "delete now" = the directory's own erase (contacts.erase_checked)
               behind a re-check of THIS rule and of "no live grant", in one write transaction.

"Delete now" is Arx-side only (lead decision 3): nothing here ever calls the door system. A row whose person is linked to a door-system
person carries `door_system_linked`; the link row is KEPT, so the separate, manual, per-action-approved removal on the door system
(access_grants.delete_person_now) stays possible afterwards. Scope: only contacts Arx knows (lead decision 1), never every door-system
person. Gate: `tickets.configure` at installation scope (lead decision 4), the directory erase's own permission.

Yearly reminder (lead decision 6): in January (the installation's zone), once per year, when the report is not empty, one content-free
in-app notification (`privacy.needs_review`: a count and a link, never a name or a number) to the notification managers through the
existing pipeline; idempotent by the stored year marker and the dedupe key `needsreview:<year>`.
"""
from __future__ import annotations

import logging
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from . import access_grants as ag

log = logging.getLogger(__name__)

PENDING_KEY = ("directory", "review_pending_days")
IDLE_KEY = ("directory", "review_idle_months")
PENDING_DEFAULT = 30
IDLE_DEFAULT = 12
REMINDER_SOURCE = "privacy.needs_review"
REMINDER_MONTH = 1  # January
REMINDED_KEY = "needs_review.reminded_year"  # the settings-table marker of the last year a reminder was emitted
REPORT_LINK = "#/tickets/handlers?seg=review"
_CHECK_EVERY_S = 3600.0


# ---------------------------------------------------------------- thresholds (tickets settings document, fail safe)

def thresholds(conn: sqlite3.Connection) -> tuple[int, int]:
    """(pending days, idle months) from the tickets settings document; a broken document reads as the defaults."""
    try:
        from .tickets import settings_doc

        d = settings_doc.read(conn).get("directory") or {}
        return int(d.get(PENDING_KEY[1], PENDING_DEFAULT)), int(d.get(IDLE_KEY[1], IDLE_DEFAULT))
    except Exception:  # noqa: BLE001 - the report never fails on a settings problem
        return PENDING_DEFAULT, IDLE_DEFAULT


def months_back(at: datetime, months: int) -> datetime:
    """The same instant `months` calendar months earlier (the day clamped to the target month's length)."""
    y, m = divmod(at.month - 1 - months, 12)
    year, month = at.year + y, m + 1
    for day in (at.day, 30, 29, 28):
        try:
            return at.replace(year=year, month=month, day=day)
        except ValueError:
            continue
    return at.replace(year=year, month=month, day=28)


def full_months(since: datetime, at: datetime) -> int:
    n = (at.year - since.year) * 12 + (at.month - since.month)
    if n > 0 and months_back(at, n) < since:
        n -= 1
    return max(0, n)


def _t(text: Any) -> datetime | None:
    return ag._parse_any(text)  # noqa: SLF001 - the access module's tolerant ISO reader (Z / offset / naive = UTC)


def _mask(digits: str | None) -> str | None:
    from .tickets import contacts as tcontacts

    return tcontacts.mask_phone(digits)


# ---------------------------------------------------------------- the two rules

def _vendor_names(conn: sqlite3.Connection, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    marks = ",".join("?" * len(ids))
    return {r[0]: r[1] for r in conn.execute(f"SELECT id, display_name FROM ticket_contacts WHERE id IN ({marks}) AND erased_at IS NULL", tuple(ids)).fetchall()}


def _links(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    return {r["subject_id"]: dict(r) for r in conn.execute("SELECT subject_id, origin, linked_at FROM access_person_links WHERE subject_kind = 'contact'").fetchall()}


def pending_rows(conn: sqlite3.Connection, at: datetime, pending_days: int, *, contact_id: str | None = None) -> list[dict[str, Any]]:
    cutoff = at - timedelta(days=pending_days)
    sql = ("SELECT c.id, c.display_name, c.vendor_id, c.phone_e164, p.created_at AS since FROM access_pending_contacts p "
           "JOIN ticket_contacts c ON c.id = p.contact_id WHERE p.accepted_at IS NULL AND p.rejected_at IS NULL AND c.erased_at IS NULL")
    args: tuple[Any, ...] = ()
    if contact_id is not None:
        sql += " AND c.id = ?"
        args = (contact_id,)
    links = _links(conn)
    out = []
    for r in conn.execute(sql, args).fetchall():
        since = _t(r["since"])
        if since is None or since > cutoff:
            continue
        link = links.get(r["id"])
        out.append({"contact_id": r["id"], "name": r["display_name"], "vendor_id": r["vendor_id"], "phone": _mask(r["phone_e164"]), "section": "pending",
                    "since": ag.iso(since), "days": (at - since).days, "door_system_linked": link is not None,
                    "door_system_created": bool(link and link["origin"] == "created_from_arx"), "action": "reject"})
    return out


def idle_rows(conn: sqlite3.Connection, at: datetime, idle_months: int, *, contact_id: str | None = None) -> list[dict[str, Any]]:
    cutoff = months_back(at, idle_months)
    sql = ("SELECT c.* FROM ticket_contacts c WHERE c.kind = 'person' AND c.user_id IS NULL AND c.erased_at IS NULL AND COALESCE(c.employee, 0) = 0 "
           "AND NOT EXISTS (SELECT 1 FROM access_pending_contacts p WHERE p.contact_id = c.id AND p.accepted_at IS NULL AND p.rejected_at IS NULL) "
           "AND (EXISTS (SELECT 1 FROM access_pending_contacts p WHERE p.contact_id = c.id AND p.accepted_at IS NOT NULL) "
           "  OR EXISTS (SELECT 1 FROM access_person_links l WHERE l.subject_kind = 'contact' AND l.subject_id = c.id) "
           "  OR EXISTS (SELECT 1 FROM access_grants g WHERE g.subject_kind = 'contact' AND g.subject_id = c.id))")
    args: tuple[Any, ...] = ()
    if contact_id is not None:
        sql += " AND c.id = ?"
        args = (contact_id,)
    links = _links(conn)
    live = set(ag.LIVE)
    out = []
    for c in conn.execute(sql, args).fetchall():
        grants = conn.execute("SELECT state, created_at, approved_at, ended_at, updated_at FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ?",
                              (c["id"],)).fetchall()
        if any(g["state"] in live for g in grants):
            continue  # a live grant is activity now (and its end goes through the grant flow, never through this report)
        stamps = [c["created_at"], c["last_assigned_at"]]
        acc = conn.execute("SELECT accepted_at FROM access_pending_contacts WHERE contact_id = ?", (c["id"],)).fetchone()
        if acc is not None:
            stamps.append(acc["accepted_at"])
        link = links.get(c["id"])
        if link is not None:
            stamps.append(link["linked_at"])
        for g in grants:
            stamps += [g["created_at"], g["approved_at"], g["ended_at"] or g["updated_at"]]
        parsed = [p for p in (_t(s) for s in stamps) if p is not None]
        last = max(parsed) if parsed else None
        if last is None or last >= cutoff:
            continue
        out.append({"contact_id": c["id"], "name": c["display_name"], "vendor_id": c["vendor_id"], "phone": _mask(c["phone_e164"]), "section": "idle",
                    "since": ag.iso(last), "months": full_months(last, at), "door_system_linked": link is not None,
                    "door_system_created": bool(link and link["origin"] == "created_from_arx"), "action": "erase"})
    return out


def compute(conn: sqlite3.Connection, at: datetime | None = None) -> dict[str, Any]:
    at = at or ag.now()
    pending_days, idle_months = thresholds(conn)
    pending = sorted(pending_rows(conn, at, pending_days), key=lambda r: r["since"])
    idle = sorted(idle_rows(conn, at, idle_months), key=lambda r: r["since"])
    vendors = _vendor_names(conn, {r["vendor_id"] for r in pending + idle if r["vendor_id"]})
    for r in pending + idle:
        r["vendor"] = vendors.get(r.pop("vendor_id") or "")
    return {"pending_days": pending_days, "idle_months": idle_months, "pending": pending, "idle": idle, "at": ag.iso(at)}


def report(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    from .tickets.access import CONFIGURE

    require(conn, principal, CONFIGURE, INSTALLATION)
    return compute(conn)


# ---------------------------------------------------------------- "delete now" (section B; Arx-side only)

def delete_idle(conn: sqlite3.Connection, principal: Principal, contact_id: str, rid: str | None = None) -> dict[str, Any]:
    """Erase an idle person through the directory's own erase, after re-checking - in this write transaction - that the row is still in
    section B (so still no live grant). Never a door-system call; a door-system link stays for the separate manual removal."""
    from .tickets import contacts as tcontacts
    from .tickets.access import CONFIGURE, Viewer

    require(conn, principal, CONFIGURE, INSTALLATION)
    row = ag.contact_row(conn, contact_id)
    if row is None or row.get("erased_at") or row.get("kind") != "person":
        raise ApiError(404, "needs_review_not_found", "האדם לא נמצא בדוח.")
    if ag.live_grant_of(conn, "contact", contact_id) is not None:
        raise ApiError(409, "needs_review_live_grant", "לאדם יש גישה פעילה; היא מסתיימת במסך הגישות ולא כאן.")
    _pending_days, idle_months = thresholds(conn)
    hits = idle_rows(conn, ag.now(), idle_months, contact_id=contact_id)
    if not hits:
        raise ApiError(409, "needs_review_not_due", "האדם כבר אינו בדוח. טענו מחדש.")
    linked = hits[0]["door_system_linked"]
    out = tcontacts.erase_checked(conn, Viewer(conn, principal), row, history=True, rid=rid, extra_audit={"via": "needs_review"})
    from ..audit import audit

    audit(conn, actor=principal, action="access.needs_review.delete", decision="allowed", resource_type="ticket_contact", resource_id=contact_id, request_id=rid,
          details={"door_system_linked": linked, "idle_months": idle_months})
    return {"contact_id": contact_id, "deleted": True, "door_system_linked": linked, "links_revoked": out.get("links_revoked", 0)}


# ---------------------------------------------------------------- the yearly reminder

def count_due(conn: sqlite3.Connection, at: datetime | None = None) -> int:
    r = compute(conn, at)
    return len(r["pending"]) + len(r["idle"])


def remind_if_due(conn: sqlite3.Connection, at: datetime | None = None) -> str | None:
    """January, once a year, only for a non-empty report and while the tickets module is on. Returns the notification id when one was
    created now; None otherwise. The year marker is written in the same transaction as the notification, so a crash between them is
    impossible and a second call the same year does nothing."""
    from . import notify
    from .tickets.access import module_on

    at = at or ag.now()
    local = at.astimezone(ag.zone_of(conn))
    if local.month != REMINDER_MONTH:
        return None
    year = str(local.year)
    if get_setting(conn, REMINDED_KEY) == year:
        return None
    if not module_on(conn):
        return None
    n = count_due(conn, at)
    if n <= 0:
        return None  # nothing to review: checked again later this January
    res = notify.emit_full(conn, notify.Signal(source=REMINDER_SOURCE, subject_kind="system", subject_id="needs_review", dedupe_key=f"needsreview:{year}",
                                               params={"count": n}, link=REPORT_LINK))
    if res.action in ("created", "folded", "renotified"):
        set_setting(conn, REMINDED_KEY, year)
    return res.id if res.action == "created" else None


_last_check = 0.0
_check_lock = threading.Lock()


def janitor(db: Any) -> None:
    """The janitor's hook (every 30 s): at most one check an hour in this process; never raises."""
    global _last_check
    with _check_lock:
        mono = time.monotonic()
        if _last_check and mono - _last_check < _CHECK_EVERY_S:
            return
        _last_check = mono
    try:
        with db.connection(label="needs_review.reminder") as conn:
            remind_if_due(conn)
    except Exception:  # noqa: BLE001 - housekeeping never stops the janitor
        log.warning("needs-review reminder check failed", exc_info=True)


def reset_for_tests() -> None:
    global _last_check
    _last_check = 0.0
