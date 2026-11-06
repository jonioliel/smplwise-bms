"""Bridge-key owner contacts and notices (WXH-LEFTOVERS-2405; CR-034 sections 7, 8 and 12, slice H3 remainder).

- `security.owner_contacts`: the Arx users who are "the owner" for bridge-key notices - one to MAX_CONTACTS ACTIVE SYSTEM ADMINISTRATORS
  (CR-034 section 7: the owner is a system administrator in Arx; Arx never derives a role from a home-system flag). Set by a system
  administrator only (routers/bridge_key.py), audited. A contact who later stops being an active system administrator simply drops out of
  `valid_contacts` (never an error). Kept out of every archive (backup.SETTINGS_KEEP): a restore can never redirect who is told.
- Notices go through the ONE notification pipeline (services/notify.emit) INSIDE the caller's transaction, under a savepoint: a notice
  that fails never undoes or blocks what the caller did (CR-034 section 8 step 2: "a notice failure never blocks the revocation"). The
  recipients rule `bridge_key_owner` = the owner contacts first, then every other active system administrator (section 8). Each notice is
  audited as `bridge.rotation.notice_sent` with the pipeline's outcome (created / folded / disabled / failed) and the recipient count.
- Until at least one owner contact is set, an OPEN bridge-key notice also raises a banner on every Settings screen (`banner`) until one of
  the administrators acknowledges it in the notification center (CR-034 section 7).

Nothing here starts, resumes or stops a rotation, touches a key, or sends anything to the bridge. `emergency` is the notice of the
emergency revocation (CR-034 section 8); the revocation itself is WXH4 (not built), so no route calls it yet.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from typing import Any

from ..audit import audit
from ..db import get_setting, set_setting
from ..rbac import is_system_admin

log = logging.getLogger("smplwise.bridge_key_notice")

CONTACTS_KEY = "security.owner_contacts"
MAX_CONTACTS = 5
SOURCE_ATTENTION = "security.bridge_key_attention"
SOURCE_REVOKED = "security.bridge_key_revoked"
SOURCES = (SOURCE_ATTENTION, SOURCE_REVOKED)
SUBJECT_ID = "bridge_key"


class ContactsInvalid(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------- owner contacts

def stored_contacts(conn: sqlite3.Connection) -> list[str]:
    """The ids as saved (an unreadable value reads as none)."""
    try:
        raw = json.loads(get_setting(conn, CONTACTS_KEY) or "[]")
    except (ValueError, sqlite3.Error):
        return []
    return [u for u in raw if isinstance(u, str)][:MAX_CONTACTS] if isinstance(raw, list) else []


def _active(conn: sqlite3.Connection, user_id: str) -> bool:
    r = conn.execute("SELECT active FROM users WHERE id = ?", (user_id,)).fetchone()
    return bool(r and r["active"])


def eligible(conn: sqlite3.Connection, user_id: str) -> bool:
    """May be an owner contact: an active user who is a system administrator of the installation."""
    return _active(conn, user_id) and is_system_admin(conn, user_id)


def valid_contacts(conn: sqlite3.Connection) -> list[str]:
    return [u for u in stored_contacts(conn) if eligible(conn, u)]


def system_admins(conn: sqlite3.Connection) -> list[str]:
    return [r["id"] for r in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall() if is_system_admin(conn, r["id"])]


def _name(conn: sqlite3.Connection, user_id: str) -> str:
    r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    return str((r["display_name"] or r["username"]) if r else user_id)


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    """For the bridge-key card: the saved contacts (with names and whether each still counts), the candidates, and who a notice reaches."""
    stored = stored_contacts(conn)
    admins = system_admins(conn)
    valid = [u for u in stored if eligible(conn, u)]
    return {
        "ids": stored,
        "users": [{"id": u, "name": _name(conn, u), "valid": u in valid} for u in stored],
        "candidates": [{"id": u, "name": _name(conn, u)} for u in admins],
        "set": bool(valid),
        "max": MAX_CONTACTS,
        "recipients": len(dict.fromkeys(valid + admins)),
    }


def set_contacts(conn: sqlite3.Connection, ids: Any, *, actor: Any, request_id: str | None = None) -> list[str]:
    """Validate and save. Refuses (ContactsInvalid) anything but a list of up to MAX_CONTACTS distinct ids of active system administrators;
    an empty list clears the setting (the notices then reach every system administrator, and the banner rule applies)."""
    if not isinstance(ids, list) or len(ids) > MAX_CONTACTS or not all(isinstance(u, str) and 0 < len(u) <= 128 for u in ids):
        raise ContactsInvalid("validation")
    clean = list(dict.fromkeys(ids))
    if len(clean) != len(ids):
        raise ContactsInvalid("validation")
    if any(not eligible(conn, u) for u in clean):
        raise ContactsInvalid("contact_not_admin")
    before = stored_contacts(conn)
    if clean != before:
        set_setting(conn, CONTACTS_KEY, json.dumps(clean))
        audit(conn, actor=actor, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=request_id,
              details={"key": CONTACTS_KEY, "before": before, "after": clean})
    return clean


def recipient_users(conn: sqlite3.Connection, n: dict[str, Any] | None = None) -> list[str]:
    """The recipients rule `bridge_key_owner`: the valid owner contacts first, then every other active system administrator."""
    return list(dict.fromkeys(valid_contacts(conn) + system_admins(conn)))


# ---------------------------------------------------------------- notices

def queue(conn: sqlite3.Connection, source: str, dedupe_key: str, *, severity: str | None = None, detail: str = "", code: str,
          rotation_id: str | None = None, actor: Any = None, initiator_user_id: str | None = None) -> str:
    """Queue one bridge-key notice in the caller's transaction. Returns the pipeline's outcome, or `failed`. Never raises."""
    from . import notify

    outcome, recipients = "failed", 0
    try:
        conn.execute("SAVEPOINT bridge_key_notice")
        try:
            res = notify.emit_full(conn, notify.Signal(
                source=source, subject_kind="system", subject_id=SUBJECT_ID, severity=severity, dedupe_key=dedupe_key,
                params={"detail": detail} if detail else {}, origin={"rotation_id": rotation_id} if rotation_id else {},
                initiator_user_id=initiator_user_id, link="#/system/setup"))
            outcome = res.action
            if res.id:
                recipients = conn.execute("SELECT COUNT(*) FROM notification_recipients WHERE notification_id = ?", (res.id,)).fetchone()[0]
            conn.execute("RELEASE SAVEPOINT bridge_key_notice")
        except Exception:  # noqa: BLE001 - a notice never undoes or blocks the caller's work (CR-034 section 8)
            conn.execute("ROLLBACK TO SAVEPOINT bridge_key_notice")
            conn.execute("RELEASE SAVEPOINT bridge_key_notice")
            log.warning("bridge-key notice could not be queued", exc_info=True)
            outcome = "failed"
    except sqlite3.Error:
        log.warning("bridge-key notice: no savepoint", exc_info=True)
        return "failed"
    try:
        audit(conn, actor=actor, action="bridge.rotation.notice_sent", decision="allowed" if outcome not in ("failed", "disabled") else "denied",
              resource_type="bridge_rotation", resource_id=rotation_id or "*", reason=None if outcome not in ("failed", "disabled") else outcome,
              details={"source": source, "code": code, "outcome": outcome, "recipients": recipients})
    except Exception:  # noqa: BLE001
        log.warning("bridge-key notice audit failed", exc_info=True)
    return outcome


def resolve(conn: sqlite3.Connection, source: str, dedupe_key: str) -> str:
    """Close the open notice of a condition that ended. Never raises."""
    from . import notify

    try:
        conn.execute("SAVEPOINT bridge_key_notice_resolve")
        try:
            res = notify.emit_full(conn, notify.Signal(source=source, subject_kind="system", subject_id=SUBJECT_ID, dedupe_key=dedupe_key, resolve=True))
            conn.execute("RELEASE SAVEPOINT bridge_key_notice_resolve")
            return res.action
        except Exception:  # noqa: BLE001
            conn.execute("ROLLBACK TO SAVEPOINT bridge_key_notice_resolve")
            conn.execute("RELEASE SAVEPOINT bridge_key_notice_resolve")
            log.warning("bridge-key notice could not be resolved", exc_info=True)
            return "failed"
    except sqlite3.Error:
        return "failed"


def emergency(conn: sqlite3.Connection, *, actor: Any, revocation_id: str) -> str:
    """CR-034 section 8 step 2: the emergency revocation's notice, queued in the SAME transaction as the revocation (WXH4, not built). One
    row per revocation (never folded into an older one); the acknowledge closes it."""
    return queue(conn, SOURCE_REVOKED, f"{SOURCE_REVOKED}:{revocation_id}", severity="critical", code="emergency_revocation", rotation_id=revocation_id,
                 actor=actor, initiator_user_id=getattr(actor, "user_id", None))


def banner(conn: sqlite3.Connection) -> dict[str, Any]:
    """CR-034 section 7: while no owner contact is set, an OPEN (not yet acknowledged) bridge-key notice keeps a banner on every Settings
    screen until a system administrator acknowledges it in the notification center."""
    try:
        open_n = conn.execute(f"SELECT COUNT(*) FROM notifications WHERE source IN ({','.join('?' * len(SOURCES))}) AND state = 'open'", SOURCES).fetchone()[0]
    except sqlite3.Error:
        open_n = 0
    contacts = bool(valid_contacts(conn))
    return {"show": bool(open_n) and not contacts, "open": int(open_n), "contacts_set": contacts}
