"""IDENT146 (docs/changes/CR-IDENT146.md): the personal-data lifecycle of Arx-only (local) identities.

1. `purge_due` / `purge_user` - the janitor step. With `privacy.local_purge` = on (default off), a local account that has been disabled or
   deleted for `privacy.local_purge_days` (default and minimum 30 - the owner's stated policy) is purged: every personal row of the person is
   deleted, the `users` row stays as an anonymised tombstone (`purged_at` set, name / e-mail / notes cleared, username replaced) so
   the id keeps resolving in audit rows, ticket authorship and grants. Audit rows are NEVER touched (legal-hold style exclusion: they follow
   their own `audit.retention_days`). The period runs from the LATEST of `disabled_at` / `deleted_at`; an account that is active again is
   never due. A purged account cannot be undone.
2. `export_bundle` - the personal data export: one JSON-able dict with what Arx holds about one person, built from an allow-list of columns
   per table. Never a password hash, token / link / session hash, TOTP secret, PIN hash, passkey credential id or key, push endpoint or key,
   device token, and never another person's data (audit rows are listed only where the person is the actor, or the subject of an action -
   then without the actor and without details).

The export is generated on demand and is never stored, so it can never enter a backup or an export archive. Backups: the three settings are
installation policy (backup.SETTINGS_KEEP) - a restore never switches a purge on."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
import threading
import time
from typing import Any

from ..db import get_setting, now_iso

log = logging.getLogger("smplwise.local_privacy")

PURGE_KEY = "privacy.local_purge"
DAYS_KEY = "privacy.local_purge_days"
EXPORT_KEY = "privacy.personal_export"
DEFAULTS = {PURGE_KEY: "off", DAYS_KEY: "30", EXPORT_KEY: "off"}
MIN_DAYS = 30
MAX_DAYS = 3650
BATCH = 50
CHECK_EVERY_S = 3600.0
EXPORT_ROW_CAP = 5000  # per list; `truncated` names a list that hit it
AUDIT_PURGED = "identity.local.user.purged"
AUDIT_EXPORTED = "identity.local.user.data_exported"
ANON_NAME = "Deleted user"

# rows deleted outright: (table, user column)
DELETE_ROWS: tuple[tuple[str, str], ...] = (
    ("auth_local_credentials", "user_id"), ("auth_local_sessions", "user_id"), ("auth_local_links", "user_id"),
    ("auth_local_reset_codes", "user_id"), ("auth_local_reset_sends", "user_id"), ("auth_webauthn_credentials", "user_id"),
    ("identity_links", "local_user_id"), ("group_members", "user_id"), ("auth_totp", "user_id"), ("auth_totp_failures", "user_id"),
    ("user_prefs", "user_id"), ("plan_view_prefs", "user_id"), ("automation_prefs", "user_id"), ("ticket_saved_views", "user_id"),
    ("push_subscriptions", "user_id"), ("push_prefs", "user_id"), ("mobile_push_messages", "user_id"), ("mobile_presence_events", "user_id"),
    ("mobile_devices", "user_id"), ("notification_recipients", "user_id"), ("notification_deliveries", "user_id"),
    ("notify_action_tokens", "user_id"), ("notify_known_devices", "user_id"), ("remote_access_users", "user_id"),
    ("remote_sign_ins", "user_id"), ("remote_revoked_chains", "user_id"), ("alarm_user_policy", "user_id"),
)
# kept rows with the person's typed name replaced: (table, user column, name column, replacement)
SCRUB_NAMES: tuple[tuple[str, str, str, str | None], ...] = (
    ("tickets", "created_by", "created_by_name", ANON_NAME), ("ticket_events", "actor_user_id", "actor_name", ANON_NAME),
    ("saved_views", "owner_user_id", "owner_username", None), ("announcements", "user_id", "username", None),
)

# the export: key -> (table, user column, allow-listed columns, order column)
EXPORT_LISTS: dict[str, tuple[str, str, tuple[str, ...], str]] = {
    "passkeys": ("auth_webauthn_credentials", "user_id", ("id", "label", "alg", "transports", "aaguid", "backup_eligible", "backup_state", "created_at", "last_used_at"), "created_at"),
    "sign_in_sessions": ("auth_local_sessions", "user_id", ("kind", "created_at", "last_used_at", "expires_at", "ip_masked", "country", "user_agent", "label", "revoked_at", "revoked_reason"), "created_at"),
    "sign_in_links": ("auth_local_links", "user_id", ("purpose", "created_at", "expires_at", "used_at", "invalidated_at"), "created_at"),
    "preferences": ("user_prefs", "user_id", ("key", "value_json", "updated_at"), "key"),
    "push_preferences": ("push_prefs", "user_id", ("categories_json", "quiet_json", "updated_at"), "updated_at"),
    "plan_view_preferences": ("plan_view_prefs", "user_id", ("value_json", "updated_at"), "updated_at"),
    "automation_preferences": ("automation_prefs", "user_id", ("kind", "item_id", "pinned", "favourite"), "item_id"),
    "ticket_saved_views": ("ticket_saved_views", "user_id", ("name", "view_json", "created_at", "updated_at"), "created_at"),
    "browser_push_subscriptions": ("push_subscriptions", "user_id", ("user_agent", "channel", "created_at", "last_seen_at"), "created_at"),
    "mobile_devices": ("mobile_devices", "user_id", ("name", "platform", "app_version", "os_version", "model", "channel", "created_at", "last_seen_at", "revoked_at"), "created_at"),
    "presence_events": ("mobile_presence_events", "user_id", ("type", "sensor", "site_id", "lat", "lon", "accuracy_m", "source", "at"), "at"),
    "notifications_received": ("notification_recipients", "user_id", ("notification_id", "read_at", "snoozed_until", "added_at"), "added_at"),
    "known_sign_in_devices": ("notify_known_devices", "user_id", ("first_seen_at",), "first_seen_at"),
    "saved_camera_views": ("saved_views", "owner_user_id", ("name", "shared", "created_at", "updated_at"), "created_at"),
    "tickets_created": ("tickets", "created_by", ("number", "title", "description", "status", "created_at", "closed_at"), "created_at"),
    "ticket_activity": ("ticket_events", "actor_user_id", ("ticket_id", "at", "kind", "body"), "at"),
    "remote_sign_in": ("remote_sign_ins", "user_id", ("last_at", "last_address", "last_country", "sign_ins"), "last_at"),
    "alarm_policy": ("alarm_user_policy", "user_id", ("arm_policy", "disarm_policy", "pin_set_at", "updated_at"), "updated_at"),
    "second_factor": ("auth_totp", "user_id", ("enabled", "created_at", "enabled_at", "last_used_at"), "created_at"),
}


def _tables(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


# ---------------------------------------------------------------- settings

def purge_enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, PURGE_KEY, DEFAULTS[PURGE_KEY]) or "off") == "on"


def export_enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, EXPORT_KEY, DEFAULTS[EXPORT_KEY]) or "off") == "on"


def purge_days(conn: sqlite3.Connection) -> int:
    try:
        value = int(get_setting(conn, DAYS_KEY, DEFAULTS[DAYS_KEY]) or DEFAULTS[DAYS_KEY])
    except ValueError:
        value = int(DEFAULTS[DAYS_KEY])
    return max(MIN_DAYS, min(MAX_DAYS, value))  # never below the owner's 30 days, whatever is stored


# ---------------------------------------------------------------- purge

def _iso(ts: dt.datetime) -> str:
    return ts.astimezone(dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def purge_due(conn: sqlite3.Connection, now: dt.datetime | None = None) -> list[str]:
    """Ids of local accounts due now: not active, not purged, and the LATEST of disabled_at / deleted_at is at or before now - N days."""
    cutoff = _iso((now or dt.datetime.now(dt.timezone.utc)) - dt.timedelta(days=purge_days(conn)))
    rows = conn.execute("""SELECT id FROM users WHERE source = 'local' AND active = 0 AND purged_at IS NULL
                           AND (disabled_at IS NOT NULL OR deleted_at IS NOT NULL)
                           AND MAX(COALESCE(disabled_at, ''), COALESCE(deleted_at, '')) <= ? ORDER BY id LIMIT ?""", (cutoff, BATCH)).fetchall()
    return [r[0] for r in rows]


def purge_user(conn: sqlite3.Connection, user_id: str, at: str | None = None) -> dict[str, int]:
    """Purge one local account in the caller's transaction. Returns row counts per table (counts only). Audit rows are not touched."""
    stamp = at or now_iso()
    tables = _tables(conn)
    counts: dict[str, int] = {}
    for table, col in DELETE_ROWS:
        if table in tables and col in _columns(conn, table):
            n = conn.execute(f"DELETE FROM {table} WHERE {col} = ?", (user_id,)).rowcount
            if n:
                counts[table] = n
    for table, col, name_col, value in SCRUB_NAMES:
        if table in tables and {col, name_col} <= _columns(conn, table):
            n = conn.execute(f"UPDATE {table} SET {name_col} = ? WHERE {col} = ?", (value, user_id)).rowcount
            if n:
                counts[table + ".name_cleared"] = n
    conn.execute("""UPDATE users SET username = ?, display_name = ?, email = NULL, notes = NULL, active = 0,
                           deleted_at = COALESCE(deleted_at, ?), purged_at = ? WHERE id = ? AND source = 'local'""",
                 ("purged-" + user_id[-8:].lower(), ANON_NAME, stamp, stamp, user_id))
    counts["users.anonymised"] = 1
    return counts


def run(db: Any, now: dt.datetime | None = None) -> dict[str, int]:
    """One pass; `{purged}`. Each account is its own transaction; one audit row per account (ids and counts only)."""
    from ..audit import audit

    with db.connection(mode="read", label="local_privacy.read") as conn:
        if not purge_enabled(conn):
            return {"purged": 0}
        ids = purge_due(conn, now)
    purged = 0
    for uid in ids:
        with db.connection(label="local_privacy.purge") as conn:
            if uid not in purge_due(conn, now):  # re-checked inside the write transaction (re-enabled in between)
                continue
            counts = purge_user(conn, uid)
            audit(conn, actor=None, action=AUDIT_PURGED, decision="allowed", resource_type="user", resource_id=uid,
                  details={"by": "retention", "days": purge_days(conn), "rows": counts})
            purged += 1
    return {"purged": purged}


_last = 0.0
_lock = threading.Lock()


def janitor(db: Any) -> None:
    """main.janitor_tick hook: at most one pass per CHECK_EVERY_S in this process; never raises."""
    global _last
    with _lock:
        mono = time.monotonic()
        if _last and mono - _last < CHECK_EVERY_S:
            return
        _last = mono
    try:
        run(db)
    except Exception as exc:  # noqa: BLE001 - housekeeping never stops the janitor
        log.warning("local identity purge failed (%s)", type(exc).__name__)


def reset_for_tests() -> None:
    global _last
    _last = 0.0


# ---------------------------------------------------------------- export

def export_bundle(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    """Everything Arx holds about one local person, from an allow-list of columns. Raises LookupError for an unknown / purged id."""
    u = conn.execute("SELECT * FROM users WHERE id = ? AND source = 'local' AND purged_at IS NULL", (user_id,)).fetchone()
    if u is None:
        raise LookupError(user_id)
    tables = _tables(conn)
    cred = conn.execute("SELECT set_at, set_by, must_change, reset_mode, last_sign_in_at, last_sign_in_from, passkey_first "
                        "FROM auth_local_credentials WHERE user_id = ?", (user_id,)).fetchone()
    keys = u.keys()
    bundle: dict[str, Any] = {
        "format": "arx-personal-data/1", "generated_at": now_iso(), "subject_id": user_id,
        "profile": {k: u[k] for k in ("id", "username", "display_name", "email", "notes", "source", "active", "first_seen_at", "last_seen_at",
                                       "created_by", "disabled_at", "deleted_at") if k in keys},
        "sign_in": dict(cred) if cred else None,
    }
    b = conn.execute("SELECT role_id, scope_type, scope_id, created_at, revoked_at FROM bindings WHERE subject_kind = 'user' AND subject_id = ? "
                     "ORDER BY created_at", (user_id,)).fetchall()
    bundle["role_bindings"] = [dict(r) for r in b]
    link = conn.execute("SELECT ha_user_id, linked_at FROM identity_links WHERE local_user_id = ?", (user_id,)).fetchone()
    bundle["linked_home_assistant_user"] = dict(link) if link else None
    truncated: list[str] = []
    for key, (table, col, cols, order) in EXPORT_LISTS.items():
        have = _columns(conn, table) if table in tables else set()
        keep = [c for c in cols if c in have]
        if col not in have or not keep:
            bundle[key] = []
            continue
        rows = conn.execute(f"SELECT {', '.join(keep)} FROM {table} WHERE {col} = ? ORDER BY {order if order in have else keep[0]} LIMIT ?",
                            (user_id, EXPORT_ROW_CAP + 1)).fetchall()
        if len(rows) > EXPORT_ROW_CAP:
            rows = rows[:EXPORT_ROW_CAP]
            truncated.append(key)
        bundle[key] = [dict(r) for r in rows]
    own = conn.execute("SELECT at, action, resource_type, resource_id, decision, reason FROM audit_log WHERE actor_user_id = ? ORDER BY id LIMIT ?",
                       (user_id, EXPORT_ROW_CAP + 1)).fetchall()
    if len(own) > EXPORT_ROW_CAP:
        own = own[:EXPORT_ROW_CAP]
        truncated.append("audit_by_you")
    bundle["audit_by_you"] = [dict(r) for r in own]
    about = conn.execute("SELECT at, action, decision, reason FROM audit_log WHERE resource_type = 'user' AND resource_id = ? "
                         "AND COALESCE(actor_user_id, '') <> ? ORDER BY id LIMIT ?", (user_id, user_id, EXPORT_ROW_CAP + 1)).fetchall()
    if len(about) > EXPORT_ROW_CAP:
        about = about[:EXPORT_ROW_CAP]
        truncated.append("audit_about_you")
    bundle["audit_about_you"] = [dict(r) for r in about]  # what others did to the account: no actor, no details
    bundle["truncated"] = truncated
    bundle["not_included"] = ["password hash", "session / link / device tokens", "passkey credential ids and keys", "second-factor secret",
                              "alarm PIN hash", "push endpoints and keys", "other people's data", "audit details"]
    return bundle
