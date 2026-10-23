"""CR-QUIET103 slice 1: quiet windows - one button silences the INFORMATIONAL notifications of a floor or an area for a limited time.

    start (a permitted person, one explicit action) --> window [started_at, ends_at) --> ends at ends_at by itself, or earlier by an explicit stop

What a window does: while it is active, the notification dispatch (services/notify_channels.dispatch) holds the CHANNELS (web push, the phone app,
e-mail, WhatsApp, the spoken announcement) of a notification that is
  * in the window's place (the notification's `area_id` is the area, or an area on the window's floor), and
  * informational: severity `info` (and `alert` only when the administrator turned `quiet.windows.mute_alerts` on).
It never touches: a CRITICAL severity, the `safety` category (contract 7.3 and the MUTEFIX fix of services/mobile_push: a critical category is never
muted), an escalation, or the notification ROW itself - the inbox keeps every notification (the delivery log says `quiet_window`).

The end is decided by the clock: a window is active iff `ended_at IS NULL and started_at <= now < ends_at`; the janitor (`sweep`) only stamps the
row afterwards. Nothing here calls Home Assistant: the lighting scenario of the change record is NOT part of slice 1.

Shipped OFF: `quiet.windows.enabled` = off. With it off, no window can start and existing windows are ignored (notifications flow as if none existed)."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from typing import Any, Callable

from ..audit import audit
from ..db import get_setting, new_id, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.quiet")
UTC = dt.timezone.utc

START_PERMISSION = "devices.control"   # to start or stop: on the window's floor (an area without a floor: the installation)
READ_PERMISSION = "devices.read"       # to see the windows of a floor
CONFIGURE = "system.configure"         # the settings

SCOPE_TYPES = ("floor", "area")
ENABLED = "quiet.windows.enabled"


def _int_in(lo: int, hi: int) -> Callable[[str], bool]:
    return lambda v: v.isdigit() and lo <= int(v) <= hi


SETTINGS: dict[str, tuple[str, Callable[[str], bool]]] = {
    ENABLED: ("off", lambda v: v in ("off", "on")),
    "quiet.windows.default_minutes": ("120", _int_in(5, 720)),   # the one-button duration: two hours
    "quiet.windows.max_minutes": ("240", _int_in(5, 720)),       # the longest a person may ask for
    "quiet.windows.mute_alerts": ("off", lambda v: v in ("off", "on")),  # also hold severity `alert` (default: `info` only)
}


def now_utc() -> dt.datetime:
    """The clock of the routes and the janitor: the notification module's one seam (tests replace `notify.now_utc` to cross a window's end)."""
    from . import notify

    return notify.now_utc()


# ---------------------------------------------------------------- settings

def setting(conn: sqlite3.Connection, key: str) -> str:
    default, valid = SETTINGS[key]
    v = get_setting(conn, key, default)
    return v if isinstance(v, str) and valid(v) else default


def enabled(conn: sqlite3.Connection) -> bool:
    return setting(conn, ENABLED) == "on"


def settings_view(conn: sqlite3.Connection) -> dict[str, str]:
    return {k: setting(conn, k) for k in SETTINGS}


def update_settings(conn: sqlite3.Connection, principal: Principal, changes: dict[str, Any], rid: str | None) -> dict[str, tuple[str, str]]:
    """Validate and store; {key: (before, after)} of what changed. Unknown key / bad value = 422; default > max = 422. Turning the feature OFF
    ends every open window at once (reason `switched_off`) so a later switch-on never revives a stale window."""
    for key, value in changes.items():
        if key not in SETTINGS or not isinstance(value, str) or not SETTINGS[key][1](value):
            raise ApiError(422, "invalid_setting", "ערך לא תקין להגדרה.", details={"key": str(key)[:64]})
    merged = {**settings_view(conn), **changes}
    if int(merged["quiet.windows.default_minutes"]) > int(merged["quiet.windows.max_minutes"]):
        raise ApiError(422, "invalid_setting", "משך ברירת המחדל גדול מהמקסימום.", details={"key": "quiet.windows.default_minutes"})
    out: dict[str, tuple[str, str]] = {}
    for key, value in changes.items():
        before = setting(conn, key)
        if before != value:
            set_setting(conn, key, value)
            out[key] = (before, value)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=key, request_id=rid,
                  details={"key": key, "before": before, "after": value})
    if ENABLED in out and out[ENABLED][1] == "off":
        stamp = iso_utc(now_utc())
        for r in conn.execute("SELECT id FROM quiet_windows WHERE ended_at IS NULL").fetchall():
            conn.execute("UPDATE quiet_windows SET ended_at = ?, ended_by = ?, end_reason = 'switched_off' WHERE id = ?", (stamp, principal.user_id, r["id"]))
            audit(conn, actor=principal, action="quiet.window.stopped", decision="allowed", resource_type="quiet_window", resource_id=r["id"], request_id=rid,
                  details={"reason": "switched_off"})
    return out


# ---------------------------------------------------------------- places

def resolve_place(conn: sqlite3.Connection, scope_type: str, scope_id: str) -> tuple[str | None, str]:
    """(the floor judged for permission or None = installation, the label). 404 `place_not_found` for an unknown or deleted floor / unknown area."""
    if scope_type == "floor":
        f = conn.execute("SELECT id, name FROM floors WHERE id = ? AND deleted_at IS NULL", (scope_id,)).fetchone()
        if f is None:
            raise ApiError(404, "place_not_found", "המקום לא נמצא.")
        return f["id"], f["name"] or ""
    a = conn.execute("SELECT area_id, name, floor_id FROM ha_areas WHERE area_id = ?", (scope_id,)).fetchone()
    if a is None:
        raise ApiError(404, "place_not_found", "המקום לא נמצא.")
    floor = a["floor_id"]
    if floor and conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (floor,)).fetchone() is None:
        floor = None  # the registry names a floor this installation does not have: the installation-wide permission is then needed
    return floor, a["name"] or ""


def _target(floor_id: str | None) -> tuple[str, str]:
    return ("floor", floor_id) if floor_id else INSTALLATION


# ---------------------------------------------------------------- the window rows

def _is_active(row: sqlite3.Row, now: dt.datetime) -> bool:
    """The one definition of "active": open, started, and strictly before the end instant."""
    return row["ended_at"] is None and parse_utc(row["started_at"]) <= now < parse_utc(row["ends_at"])


def _view(row: sqlite3.Row, now: dt.datetime) -> dict[str, Any]:
    active = _is_active(row, now)
    return {"id": row["id"], "scope_type": row["scope_type"], "scope_id": row["scope_id"], "label": row["label"], "started_at": row["started_at"], "ends_at": row["ends_at"],
            "active": active, "ended_at": row["ended_at"], "end_reason": row["end_reason"] or ("expired" if row["ended_at"] is None and not active else None),
            "seconds_left": max(0, int((parse_utc(row["ends_at"]) - now).total_seconds())) if active else 0}


def active_rows(conn: sqlite3.Connection, now: dt.datetime) -> list[sqlite3.Row]:
    return [r for r in conn.execute("SELECT * FROM quiet_windows WHERE ended_at IS NULL").fetchall() if _is_active(r, now)]


def start(conn: sqlite3.Connection, principal: Principal, scope_type: str, scope_id: str, minutes: int | None, rid: str | None, now: dt.datetime | None = None) -> dict[str, Any]:
    now = now or now_utc()
    if scope_type not in SCOPE_TYPES:
        raise ApiError(422, "validation", "סוג מקום לא תקין.")
    floor_id, label = resolve_place(conn, scope_type, scope_id)
    require(conn, principal, START_PERMISSION, _target(floor_id))  # a denied start is audited by require()
    if not enabled(conn):
        raise ApiError(409, "quiet_mode_off", "מצב שקט כבוי במערכת.")
    default, longest = int(setting(conn, "quiet.windows.default_minutes")), int(setting(conn, "quiet.windows.max_minutes"))
    if minutes is None:
        minutes = default
    if not 5 <= minutes <= longest:
        raise ApiError(422, "invalid_duration", "משך לא תקין.", details={"min": 5, "max": longest})
    for r in active_rows(conn, now):
        if r["scope_type"] == scope_type and r["scope_id"] == scope_id:
            raise ApiError(409, "already_active", "מצב שקט כבר פעיל במקום הזה.", details={"id": r["id"], "ends_at": r["ends_at"]})
    wid = new_id()
    ends = now + dt.timedelta(minutes=minutes)
    conn.execute("INSERT INTO quiet_windows(id, scope_type, scope_id, floor_id, label, started_at, ends_at, started_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                 (wid, scope_type, scope_id, floor_id, label, iso_utc(now), iso_utc(ends), principal.user_id, iso_utc(now)))
    audit(conn, actor=principal, action="quiet.window.started", decision="allowed", resource_type="quiet_window", resource_id=wid, request_id=rid,
          details={"scope_type": scope_type, "scope_id": scope_id, "minutes": minutes, "ends_at": iso_utc(ends)})
    return _view(conn.execute("SELECT * FROM quiet_windows WHERE id = ?", (wid,)).fetchone(), now)


def stop(conn: sqlite3.Connection, principal: Principal, window_id: str, rid: str | None, now: dt.datetime | None = None) -> dict[str, Any]:
    now = now or now_utc()
    row = conn.execute("SELECT * FROM quiet_windows WHERE id = ?", (window_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    require(conn, principal, START_PERMISSION, _target(row["floor_id"]))  # the floor judged at start; a caller without it gets the audited 403
    if not _is_active(row, now):
        raise ApiError(409, "not_active", "מצב השקט כבר הסתיים.")
    conn.execute("UPDATE quiet_windows SET ended_at = ?, ended_by = ?, end_reason = 'stopped' WHERE id = ?", (iso_utc(now), principal.user_id, window_id))
    audit(conn, actor=principal, action="quiet.window.stopped", decision="allowed", resource_type="quiet_window", resource_id=window_id, request_id=rid,
          details={"reason": "stopped"})
    return _view(conn.execute("SELECT * FROM quiet_windows WHERE id = ?", (window_id,)).fetchone(), now)


def list_for(conn: sqlite3.Connection, principal: Principal, now: dt.datetime | None = None, recent: int = 10) -> list[dict[str, Any]]:
    """The active windows the caller may see (devices.read on the window's floor) and the most recent ended ones."""
    now = now or now_utc()
    out = []
    rows = conn.execute("SELECT * FROM quiet_windows ORDER BY started_at DESC, id DESC LIMIT 200").fetchall()
    ended = 0
    for r in rows:
        if not authorize(conn, principal, READ_PERMISSION, _target(r["floor_id"])).allowed:
            continue
        v = _view(r, now)
        if not v["active"]:
            if ended >= recent:
                continue
            ended += 1
        out.append(v)
    return out


def sweep(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """Janitor: stamp every window whose end instant has passed (end_reason `expired`, ended_at = its own end) and audit it. Idempotent; the dispatch
    never depends on it running (see `_is_active`)."""
    now = now or now_utc()
    n = 0
    for r in conn.execute("SELECT * FROM quiet_windows WHERE ended_at IS NULL").fetchall():
        if parse_utc(r["ends_at"]) <= now:
            conn.execute("UPDATE quiet_windows SET ended_at = ?, end_reason = 'expired' WHERE id = ? AND ended_at IS NULL", (r["ends_at"], r["id"]))
            audit(conn, actor=None, action="quiet.window.expired", decision="allowed", resource_type="quiet_window", resource_id=r["id"], details={"ends_at": r["ends_at"]})
            n += 1
    return n


def janitor(db: Any) -> int:
    with db.connection(label="quiet.sweep") as conn:
        return sweep(conn)


# ---------------------------------------------------------------- the notification rule

def suppresses(conn: sqlite3.Connection, n: dict[str, Any], mode: str, now: dt.datetime) -> str | None:
    """The id of the active window that holds this notification's channels back, or None. Never for a critical severity, the safety category
    (services/mobile_push.CRITICAL_CATEGORIES), an escalation, a notification with no area, or while the feature is off."""
    from .mobile_push import CRITICAL_CATEGORIES

    if mode == "escalate" or n.get("severity") == "critical" or n.get("category") in CRITICAL_CATEGORIES:
        return None
    area = n.get("area_id")
    if not area:
        return None
    try:
        if not enabled(conn):
            return None
        sev = n.get("severity")
        if sev != "info" and not (sev == "alert" and setting(conn, "quiet.windows.mute_alerts") == "on"):
            return None
        rows = active_rows(conn, now)
        if not rows:
            return None
        floor = conn.execute("SELECT floor_id FROM ha_areas WHERE area_id = ?", (area,)).fetchone()
        floor_id = floor["floor_id"] if floor else None
        for r in rows:
            if (r["scope_type"] == "area" and r["scope_id"] == area) or (r["scope_type"] == "floor" and floor_id and r["scope_id"] == floor_id):
                return r["id"]
    except sqlite3.Error:  # a database before the migration: no windows
        log.debug("quiet windows not readable", exc_info=True)
    return None
