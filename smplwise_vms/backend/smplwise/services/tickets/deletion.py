"""Full deletion of a ticket by a manager (owner decisions 14.10, docs/changes/CR-038-DELETE-NOTES.md).

Who: a caller who SEES the ticket (access.require_visible - an invisible, unknown or already deleted id is the same 404
`ticket_not_found`), has manager rights in its department (`Seen.manager`: tickets.manage where it lies AND a manager member of its
department or tickets.all_departments there) AND holds the sensitive `tickets.delete` where the ticket lies. Any status, open
included. An interactive human session only (services/intercom_writes.interactive: a bearer-token client is refused 403
`interactive_session_required`); the remote channel is allowed like every other manager action. At most RATE_PER_HOUR deletions
per user per hour (429 `delete_rate`).

Guard: a cost claim in status approved or paid blocks the deletion (409 `cost_claim_approved`) unless the caller also holds
`tickets.costs` where the ticket lies; then it goes, and the audit row says so (`cost_override`).

What goes, in ONE transaction (the request's, or a bulk item's savepoint), in this order: every live outside link is revoked FIRST
(so a vendor's page is dead before anything else changes), queued / held messages of the ticket are cancelled, the ticket's open
notifications are resolved, then every row of the ticket and everything hanging off it (store.purge_ticket). The files (photos,
invoice files: everything under `<data>/tickets/<ticket id>/`) are removed AFTER the commit (`remove_files`); a failure there leaves an
orphan folder that `sweep_orphans` (the cost janitor, every 10 min) removes once no row names the ticket - never a row that points
at nothing.

Audit: ONE row `ticket.delete` per ticket, kept forever, with NO content - number, department id, status at delete time, the reason
typed by the manager, counts (notes, photos, files, links, cost claims), `had_cost_claim`, `cost_override`, `bulk`. Never the title,
description, notes, names, phones or link data. Backups taken before the deletion still contain the ticket (nothing extra is done)."""
from __future__ import annotations

import collections
import logging
import os
import random
import re
import shutil
import stat
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ...audit import audit
from ...db import Database, now_iso
from ...errors import ApiError
from ...rbac import Principal
from . import access, model, notify_bridge, store
from .access import Seen, Viewer, text

log = logging.getLogger("smplwise.tickets.deletion")

ACTION = "ticket.delete"
REASON_MAX = 300
RATE_PER_HOUR = 30
RATE_WINDOW_S = 3600.0
BULK_MAX = 50
LOCKED_CLAIMS = ("approved", "paid")
ORPHAN_MIN_AGE_S = 3600.0
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
# deep review A4 (TK251): the only names the module writes inside a ticket folder - a stored picture / invoice (16 hex + .jpg / .pdf,
# image_intake.store_image / cost_storage.store_pdf) and the temporary file of an atomic write (image_intake.write_atomic)
_STORED_NAME = re.compile(r"^(?:[0-9a-f]{16}\.(?:jpg|pdf)|\.up\.[A-Za-z0-9_-]{1,32}\.tmp)$")
ORPHAN_FILES_MAX = 2000  # per sweep: a huge backlog is worked off over several janitor ticks
_RATE: dict[str, collections.deque[float]] = {}
_RATE_LOCK = threading.Lock()


# ---------------------------------------------------------------- the session and the rate (owner 14.10, points 6)

def interactive(principal: Principal) -> bool:
    from ..intercom_writes import interactive as _interactive

    return _interactive(principal)


def require_interactive(conn, viewer: Viewer, rid: str | None) -> None:
    if interactive(viewer.principal):
        return
    audit(conn, actor=viewer.principal, action=ACTION, decision="denied", resource_type="ticket", resource_id="*", reason="not_interactive",
          request_id=rid)
    raise ApiError(403, "interactive_session_required", text(conn, "מחיקת {the_ticket} זמינה רק מהפעלה אינטראקטיבית בדפדפן."),
                   details={"reason": "interactive_session_required"})


def rate_wait(user_id: str, n: int = 1, now: float | None = None) -> float:
    """Seconds until `n` more deletions fit in the user's hour (0 = now)."""
    now = time.monotonic() if now is None else now
    with _RATE_LOCK:
        q = _RATE.setdefault(user_id, collections.deque())
        while q and now - q[0] >= RATE_WINDOW_S:
            q.popleft()
        if len(q) + n <= RATE_PER_HOUR:
            return 0.0
        if n > RATE_PER_HOUR:
            return RATE_WINDOW_S
        # the oldest entries that must expire before n fit
        return max(0.0, RATE_WINDOW_S - (now - q[len(q) + n - RATE_PER_HOUR - 1]))


def rate_mark(user_id: str, now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    with _RATE_LOCK:
        _RATE.setdefault(user_id, collections.deque()).append(now)


def reset_rate() -> None:
    """Tests only."""
    with _RATE_LOCK:
        _RATE.clear()


def require_rate(conn, viewer: Viewer, n: int, rid: str | None) -> None:
    wait = rate_wait(viewer.uid, n)
    if wait <= 0:
        return
    audit(conn, actor=viewer.principal, action=ACTION, decision="denied", resource_type="ticket", resource_id="*", reason="rate", request_id=rid,
          details={"count": n})
    raise ApiError(429, "delete_rate", text(conn, "הגעתם למגבלת המחיקות לשעה ({n}). נסו שוב מאוחר יותר.").replace("{n}", str(RATE_PER_HOUR)),
                   retryable=True, details={"retry_after_s": int(wait) + 1, "per_hour": RATE_PER_HOUR})


# ---------------------------------------------------------------- the request's fields

def clean_reason(conn, value: Any) -> str:
    from .service import invalid

    try:
        return model.text_field(value, "reason", required=True, max_len=REASON_MAX)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None


# ---------------------------------------------------------------- the checks of one ticket

@dataclass(frozen=True)
class Check:
    """Why a visible ticket may or may not be deleted by this caller: `result` ok | forbidden | cost_claim_approved."""

    result: str
    facts: dict[str, Any] = field(default_factory=dict)
    cost_override: bool = False


def may_delete(viewer: Viewer, seen: Seen) -> bool:
    """Manager rights in the ticket's department AND tickets.delete where the ticket lies (the UI's `can.delete`)."""
    return seen.manager and viewer.holds(access.DELETE, seen.row)


def check(viewer: Viewer, seen: Seen) -> Check:
    if not may_delete(viewer, seen):
        return Check("forbidden")
    facts = store.deletion_facts(viewer.conn, seen.row["id"])
    locked = any(s in LOCKED_CLAIMS for s in facts["claim_statuses"])
    if locked and not viewer.holds("tickets.costs", seen.row):
        return Check("cost_claim_approved", facts)
    return Check("ok", facts, cost_override=locked)


def refuse(conn, viewer: Viewer, seen: Seen, chk: Check, rid: str | None, *, bulk: bool = False) -> ApiError:
    """The audited refusal of one visible ticket (403 / 409)."""
    audit(conn, actor=viewer.principal, action=ACTION, decision="denied", resource_type="ticket", resource_id=seen.row["id"], reason=chk.result,
          request_id=rid, details={"number": seen.row["number"], "department_id": seen.row["department_id"], "bulk": bulk})
    if chk.result == "cost_claim_approved":
        return ApiError(409, "cost_claim_approved",
                        text(conn, "ל{the_ticket} יש דרישת עלות שאושרה או שולמה. המחיקה דורשת גם הרשאת אישור עלויות."),
                        details={"permission": "tickets.costs"})
    return ApiError(403, "forbidden", text(conn, "אין הרשאה למחוק את {the_ticket}."), details={"permission": access.DELETE})


# ---------------------------------------------------------------- the deletion itself

@dataclass(frozen=True)
class Deleted:
    ticket_id: str
    number: int
    counts: dict[str, int]


def delete(conn, viewer: Viewer, seen: Seen, chk: Check, reason: str, rid: str | None, *, bulk: bool = False) -> Deleted:
    """Revoke, cancel, resolve, purge and audit - inside the caller's transaction. The files go after the commit (remove_files)."""
    from .handler_links import revoke
    from .store_links import links_of_ticket
    from ..timeutil import parse_utc

    row = seen.row
    ticket_id = row["id"]
    at = now_iso()
    when = parse_utc(at)
    revoked = 0
    for link in links_of_ticket(conn, ticket_id):  # FIRST: no outside page reaches the ticket while the rest happens
        if not link.get("revoked_at") and revoke(conn, link, "manual", when):
            revoked += 1
    cancelled = store.cancel_ticket_outbox(conn, ticket_id, at)
    notify_bridge.resolve_prefix(conn, ticket_id)  # every open notification of the ticket (assign, stuck, cost, send ...)
    facts = chk.facts or store.deletion_facts(conn, ticket_id)
    removed = store.purge_ticket(conn, ticket_id)
    counts = {"notes": facts["notes"], "photos": facts["photos"], "files": facts["photos"] + facts["cost_files"], "links": facts["links"],
              "claims": facts["claims"]}
    audit(conn, actor=viewer.principal, action=ACTION, decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          reason="manager_delete", details={
              "number": row["number"], "department_id": row["department_id"], "status": row["status"], "reason": reason, **counts,
              "events": facts["events"], "links_revoked": revoked, "messages_cancelled": cancelled, "had_cost_claim": facts["claims"] > 0,
              "cost_override": chk.cost_override, "bulk": bulk, "rows": sum(removed.values())})
    return Deleted(ticket_id, int(row["number"]), counts)


def _folder(root: Path, ticket_id: str) -> Path | None:
    if not isinstance(ticket_id, str) or not _ID.fullmatch(ticket_id):
        return None
    base = root.resolve()
    p = (base / ticket_id).resolve()
    return p if p.parent == base else None


def remove_files(root: Path, ticket_ids: list[str]) -> int:
    """After the commit: the ticket folders (photos and invoice files). Returns how many folders are gone; a failure is logged by
    type and left to sweep_orphans."""
    from . import attachments

    gone = 0
    for tid in ticket_ids:
        p = _folder(root, tid)
        if p is None:
            continue
        try:
            if p.is_dir():
                shutil.rmtree(p)
            gone += 1
        except OSError as exc:
            log.warning("ticket folder was not removed (%s); the janitor retries", type(exc).__name__)
    attachments.forget_size_cache()
    return gone


def sweep_orphans(db: Database, root: Path, *, min_age_s: float = ORPHAN_MIN_AGE_S, now: float | None = None) -> int:
    """The janitor's retry: a folder under the module's file root whose ticket has no row left (no ticket, photo or invoice-file row
    names it) and that has not changed for `min_age_s` is removed. Returns the number removed."""
    if not root.is_dir():
        return 0
    now = time.time() if now is None else now
    candidates: list[str] = []
    for child in root.iterdir():
        try:
            if child.is_dir() and _ID.fullmatch(child.name) and now - child.stat().st_mtime >= min_age_s:
                candidates.append(child.name)
        except OSError:
            continue
    if not candidates:
        return 0
    with db.connection(mode="read", label="tickets.delete.sweep") as conn:
        orphans = [tid for tid in candidates if not store.folder_in_use(conn, tid)]
    return remove_files(root, orphans) if orphans else 0


def sweep_orphan_files(db: Database, root: Path, *, min_age_s: float = ORPHAN_MIN_AGE_S, now: float | None = None,
                       limit: int = ORPHAN_FILES_MAX) -> int:
    """Deep review A4: a picture or invoice written to `<ticket>/` or `<ticket>/costs/` whose row was never recorded (a process
    crash between the write and the row - not an exception, which cleans up itself) would count toward the 2 GiB cap forever.
    A file is removed only when ALL hold: its name is one the module writes (_STORED_NAME), it has not changed for `min_age_s`
    (its row may still be on the way), and no `ticket_attachments` / `ticket_cost_files` row names its path. Anything else -
    another name, a sub-folder other than `costs`, a symbolic link - is left alone. Returns the number removed.

    Review R2 (TK251): `limit` counts REMOVALS only (files a row names never use it up - A-1), the rows are looked up per ticket
    folder as the walk goes, and the walk starts at a random folder each sweep (a file that cannot be removed never keeps the
    others waiting). A-4: the entry removed is the one checked - `os.lstat` before and right before the unlink must agree (a
    regular file, same device / inode / mtime) and `os.unlink` never follows a symbolic link."""
    from . import attachments

    if not root.is_dir():
        return 0
    now = time.time() if now is None else now
    try:
        folders = [f for f in root.iterdir() if _ID.fullmatch(f.name)]
    except OSError:
        return 0
    if folders:
        k = random.randrange(len(folders))
        folders = folders[k:] + folders[:k]
    removed = 0
    with db.connection(mode="read", label="tickets.files.sweep") as conn:
        for folder in folders:
            if removed >= limit:
                break
            try:
                if folder.is_symlink() or not folder.is_dir():
                    continue
                old: list[tuple[str, Path, os.stat_result]] = []
                for sub, rel_dir in ((folder, folder.name), (folder / "costs", f"{folder.name}/costs")):
                    if sub.is_symlink() or not sub.is_dir():
                        continue
                    for f in sub.iterdir():
                        if not _STORED_NAME.fullmatch(f.name):
                            continue
                        st = os.lstat(f)
                        if not stat.S_ISREG(st.st_mode) or now - st.st_mtime < min_age_s:
                            continue
                        old.append((f"{rel_dir}/{f.name}", f, st))
            except OSError:
                continue
            if not old:
                continue
            named = store.stored_paths(conn, folder.name)
            for rel, f, seen in old:
                if removed >= limit:
                    break
                if rel in named:
                    continue
                try:
                    if folder.is_symlink() or (f.parent != folder and f.parent.is_symlink()):
                        continue
                    st = os.lstat(f)
                    if (not stat.S_ISREG(st.st_mode) or (st.st_dev, st.st_ino, st.st_mtime_ns) != (seen.st_dev, seen.st_ino, seen.st_mtime_ns)):
                        continue  # the entry changed after the scan: not the file that was judged
                    os.unlink(f)
                    removed += 1
                except OSError as exc:
                    log.warning("orphan ticket file was not removed (%s)", type(exc).__name__)
    if removed:
        attachments.forget_size_cache()
        log.info("orphan ticket files removed: %d", removed)
    return removed
