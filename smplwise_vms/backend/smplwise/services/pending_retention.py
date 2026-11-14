"""SECFIX2-295 / PUB-03 (security review of the public surfaces 2026-10-20; docs/security/PROPOSAL_PUB03_PENDING_TECHNICIAN_RETENTION.md,
option A): retention of the technicians a vendor typed on the arrival page (services/access_arrival._new_technician) that no manager
accepted or rejected.

The period is `access.external.pending_retention_days`: 90 days by default (owner decision 2026-10-21), 7-365, or a saved 0 = off
(nothing happens). With a period N, a janitor step erases every undecided row older than N days exactly as the manager's "reject and delete"
does (access_grants.reject_pending_contact, lead decision 6 of 2026-10-18): the directory erase (the name becomes the tombstone, the
phone and its keyed index are cleared, the contact's links revoked, the phone-verification rows forgotten), `rejected_at` written, the
open request for that technician ended (`refused`; nothing reached WisKey for a pending person). A row is never touched when it was
accepted or rejected, when the contact is linked to a door-system person, or when it holds a decided grant (the same refusals as the
manager's route; such rows are counted as `skipped`). Each erase runs in its own transaction (both tables together). One audit row per run
that erased something - counts only, never a name or a number.

The needs-review report (services/needs_review.py) lists a pending technician from 30 days (`directory.review_pending_days`), so a
manager sees a real request long before any erase. Placement: `janitor()` is called from main.janitor_tick, at most once an hour per
process; a failure is logged by type and never stops the tick."""
from __future__ import annotations

import datetime as dt
import logging
import threading
import time
from typing import Any

from . import access_grants as ag

log = logging.getLogger("smplwise.pending_retention")

CHECK_EVERY_S = 3600.0
BATCH = 200  # at most this many rows per run (the next run continues)
AUDIT_ACTION = "access.pending_contact.expired"


class _SystemViewer:
    """The erase's audit actor: the janitor itself (no principal - the audit row's actor is empty, like the grants worker's)."""

    principal = None


def _candidates(conn, cutoff: str) -> list[str]:
    rows = conn.execute("SELECT contact_id FROM access_pending_contacts WHERE accepted_at IS NULL AND rejected_at IS NULL AND created_at < ? "
                        "ORDER BY created_at LIMIT ?", (cutoff, BATCH)).fetchall()
    return [r[0] for r in rows]


def _erasable(conn, contact_id: str) -> dict[str, Any] | None:
    """The contact row when the janitor may erase it now (the manager's refusals of reject_pending_contact), else None."""
    row = conn.execute("SELECT * FROM access_pending_contacts WHERE contact_id = ?", (contact_id,)).fetchone()
    if row is None or row["accepted_at"] or row["rejected_at"]:
        return None
    contact = ag.contact_row(conn, contact_id)
    if contact is None or contact.get("erased_at") or contact.get("active"):
        return None
    if conn.execute("SELECT 1 FROM access_person_links WHERE subject_kind = 'contact' AND subject_id = ?", (contact_id,)).fetchone() is not None:
        return None
    if conn.execute("SELECT 1 FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ? AND state NOT IN ('requested', 'revoked', 'failed')",
                    (contact_id,)).fetchone() is not None:
        return None
    return contact


def _erase(conn, contact: dict[str, Any], at: str) -> None:
    from .tickets import contacts as tcontacts

    cid = contact["id"]
    for g in conn.execute("SELECT * FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ? AND state = 'requested'", (cid,)).fetchall():
        ag.mark_revoking(conn, dict(g), "refused", actor=None)
    conn.execute("UPDATE access_pending_contacts SET rejected_at = ? WHERE contact_id = ?", (at, cid))
    tcontacts.erase_checked(conn, _SystemViewer(), contact, history=True, rid=None, extra_audit={"by": "pending_retention"})


def run(db: Any, now: dt.datetime | None = None) -> dict[str, int]:
    """One pass. Returns `{erased, skipped}` (skipped = undecided rows past the period that the manager's own rules keep)."""
    at = now or ag.now()
    with db.connection(mode="read", label="pending_retention.read") as conn:
        days = ag.pending_retention_days(conn)
        if days <= 0:
            return {"erased": 0, "skipped": 0}
        cutoff = ag.iso(at - dt.timedelta(days=days))
        ids = _candidates(conn, cutoff)
    erased = skipped = 0
    stamp = ag.iso(at)
    for cid in ids:
        with db.connection(label="pending_retention.erase") as conn:
            contact = _erasable(conn, cid)
            if contact is None:
                skipped += 1
                continue
            _erase(conn, contact, stamp)
            erased += 1
    if erased:
        with db.connection(label="pending_retention.audit") as conn:
            ag._audit(conn, None, AUDIT_ACTION, "access_pending_contacts", resource_type="installation", erased=erased, skipped=skipped,
                      retention_days=days)
    return {"erased": erased, "skipped": skipped}


_last = 0.0
_lock = threading.Lock()


def janitor(db: Any) -> None:
    """The janitor's hook: at most one pass per CHECK_EVERY_S in this process; never raises."""
    global _last
    with _lock:
        mono = time.monotonic()
        if _last and mono - _last < CHECK_EVERY_S:
            return
        _last = mono
    try:
        run(db)
    except Exception as exc:  # noqa: BLE001 - housekeeping never stops the janitor
        log.warning("pending technician retention failed (%s)", type(exc).__name__)


def reset_for_tests() -> None:
    global _last
    _last = 0.0
