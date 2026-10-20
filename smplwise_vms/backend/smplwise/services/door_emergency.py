"""CR-039 8 / DOORWIN-295: emergency door controls - LOCK all doors ("Secure") and OPEN all doors (evacuation).

Shipped OFF, and fail-closed several times over:
- `doors.emergency.enabled` (off) cannot be switched on while the live engine is not permitted (door_windows_engine.GO_LIVE_PERMITTED is
  False in this build) - a button that cannot act would be a false sense of safety (build notes T21);
- OPEN additionally needs `doors.emergency.open_enabled`, which cannot be on without the engine's OPEN capability (WisKey has no hold-until /
  emergency_open command: U3 / W13) AND the life-safety attestation (CR-039 8.9);
- `doors.emergency.automations` (off) - an actor that is not an interactive person is refused; the switch cannot be on while no automation
  actor exists (W1); no automation path calls this module at all.
Drills (CR-039 8.8) run whatever the switches say, against `DrillEngine` only, with the same permission as the real control.

Two-step confirmation (build notes T17): `prepare` returns a single-use token bound to the person, the action, the kind, the scope (and the
incident for a release), valid 20 s, stored as its SHA-256 only; `start` / `release` consume it in the same transaction that writes the
incident, and need `confirmed: true` too. The screen adds a 1.5-s hold before it even asks (CR-039 8.1).

Rate limits (T18): per person one start per 10 s and five per hour; twelve per hour installation-wide; drills ten per hour per person;
`prepare` ten per minute per person. Counted from the incidents table (survive a restart) except `prepare` (in memory).

Scope (CR-039 7.4): an incident covers the doors of the stations in the chosen scope (installation / a site / a building) on which the
presser holds the kind's permission (deny wins, per station); the presser must hold it at the scope itself too.

Per-door results (8.6): pending -> sent -> acknowledged | refused | unknown. An unknown result is retried at most three attempts, 10 s apart,
ONLY in the safe direction or under the bounded E-1 exception (an emergency OPEN's apply phase: a closed exit during an evacuation is the
greater harm). A LOCK's release re-activates schedules (it can re-open doors): its unknowns are never retried.

Precedence (8.3): one incident in effect at a time; OPEN over LOCK is allowed in one step (the LOCK is released as part of it)."""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import logging
import secrets
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from ..audit import audit
from ..db import Database, get_setting, new_id, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, STATION, Principal, authorize, scope_name, station_chain
from . import door_windows as dw
from . import door_windows_engine as dwe

log = logging.getLogger("smplwise.doors")

LOCK = "access.emergency.lock"
OPEN = "access.emergency.open"
PERMISSION = {"lock_secure": LOCK, "open": OPEN}
KINDS = tuple(PERMISSION)
SCOPE_TYPES = ("installation", "site", "building")
ACTIVE = ("applying", "in_effect", "in_effect_partial", "releasing")

ENABLED = "doors.emergency.enabled"
OPEN_ENABLED = "doors.emergency.open_enabled"
AUTOMATIONS = "doors.emergency.automations"
HOLD_MS = "doors.emergency.hold_ms"
SETTINGS: dict[str, tuple[str, Any]] = {
    ENABLED: ("off", lambda v: v in ("off", "on")),
    OPEN_ENABLED: ("off", lambda v: v in ("off", "on")),
    AUTOMATIONS: ("off", lambda v: v in ("off", "on")),
    HOLD_MS: ("1500", lambda v: v.isdigit() and 1000 <= int(v) <= 3000),
}

CONFIRM_TTL_S = 20
RETRY_GAP_S = 10
MAX_ATTEMPTS = 3
LANE_SLOTS = 4  # the incident lane (CR-039 8.7): only incidents use it
REASON_MAX = 200
LIMITS = {"user_gap_s": 10, "user_hour": 5, "installation_hour": 12, "drill_user_hour": 10, "prepare_per_min": 10}

ATTESTATION_VERSION = 1
ATTESTATION_TEXT_HE = (
    "פתיחת חירום ונעילת חירום פועלות על חומרת דלתות שהתנהגותה בשריפה, בהפסקת חשמל ולפי דרישות מקומיות (יציאות חירום, ידיות בהלה, "
    "שחרור על ידי לוח הגילוי, דרישות התקן לדרכי מילוט) אינה ידועה למערכת. בדיקת החומרה ודרכי המילוט על ידי הבעלים ואיש מקצוע מוסמך "
    "באחריות הבעלים. המערכת אינה מחליפה שחרור על ידי לוח גילוי אש. התכונה כבויה כברירת מחדל, וכל הפעלה אמיתית מתואמת עם הבעלים, פעולה אחר פעולה.")
ATTESTATION_SHA = hashlib.sha256(ATTESTATION_TEXT_HE.encode("utf-8")).hexdigest()

KIND_HE = {"lock_secure": "נעילת כל הדלתות", "open": "פתיחת כל הדלתות"}


def now_utc() -> dt.datetime:
    """The clock of the dispatcher's retry plan (tests replace it, as they replace the routes' clock)."""
    return dt.datetime.now(dt.timezone.utc)


# ---------------------------------------------------------------- settings

def setting(conn: sqlite3.Connection, key: str) -> str:
    default, valid = SETTINGS[key]
    value = get_setting(conn, key) or default
    return value if valid(value) else default


def attested(conn: sqlite3.Connection) -> bool:
    row = conn.execute("SELECT version, text_sha256 FROM door_emergency_attestation WHERE id = 1").fetchone()
    return row is not None and row["version"] == ATTESTATION_VERSION and row["text_sha256"] == ATTESTATION_SHA


def live_ok() -> bool:
    return dwe.go_live_permitted()


def open_available(settings: Any) -> bool:
    """Whether the LIVE engine can hold doors open (U3 / W13). False in this build (never true while the live engine is not permitted)."""
    if not live_ok():
        return False
    try:
        return bool(dwe.emergency_engine(settings).open_supported)
    except Exception:  # noqa: BLE001
        return False


def enabled(conn: sqlite3.Connection) -> bool:
    return setting(conn, ENABLED) == "on" and live_ok()


def open_enabled(conn: sqlite3.Connection, settings: Any) -> bool:
    return enabled(conn) and setting(conn, OPEN_ENABLED) == "on" and attested(conn) and open_available(settings)


def settings_view(conn: sqlite3.Connection, settings: Any) -> dict[str, Any]:
    return {**{k: setting(conn, k) for k in SETTINGS}, "go_live_permitted": live_ok(), "open_available": open_available(settings),
            "attested": attested(conn), "attestation": {"version": ATTESTATION_VERSION, "text": ATTESTATION_TEXT_HE}}


def update_settings(conn: sqlite3.Connection, settings: Any, changes: dict[str, Any]) -> dict[str, tuple[str, str]]:
    for key, value in changes.items():
        if key not in SETTINGS or not isinstance(value, str) or not SETTINGS[key][1](value):
            raise ApiError(422, "invalid_setting", "ערך לא תקין להגדרה.", details={"key": str(key)[:64]})
    if changes.get(ENABLED) == "on" and not live_ok():
        raise ApiError(409, "go_live_not_permitted", "הפעלה אמיתית של לחצני החירום אינה מאושרת בגרסה זו. תרגילים זמינים.")
    if changes.get(OPEN_ENABLED) == "on":
        if not live_ok() or not open_available(settings):
            raise ApiError(409, "open_unavailable", "פתיחת חירום ממתינה לממשק מצד מערכת הכניסה.")
        if not attested(conn):
            raise ApiError(409, "attestation_required", "יש לאשר את הצהרת הבטיחות לפני הפעלת פתיחת חירום.")
    if changes.get(AUTOMATIONS) == "on":
        raise ApiError(409, "automation_actor_unavailable", "הפעלה מאוטומציה אינה זמינה: אין עדיין זהות אוטומציה מאומתת.")
    out: dict[str, tuple[str, str]] = {}
    for key, value in changes.items():
        before = setting(conn, key)
        if before != value:
            set_setting(conn, key, value)
            out[key] = (before, value)
    if changes.get(ENABLED) == "off" and setting(conn, OPEN_ENABLED) == "on":
        set_setting(conn, OPEN_ENABLED, "off")
        out[OPEN_ENABLED] = ("on", "off")
    return out


def attest(conn: sqlite3.Connection, user_id: str, version: int, now: dt.datetime) -> None:
    if version != ATTESTATION_VERSION:
        raise ApiError(409, "attestation_version", "נוסח ההצהרה השתנה - יש לקרוא שוב.")
    conn.execute("""INSERT INTO door_emergency_attestation(id, accepted_by, accepted_at, text_sha256, version) VALUES (1, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET accepted_by = excluded.accepted_by, accepted_at = excluded.accepted_at,
                    text_sha256 = excluded.text_sha256, version = excluded.version""", (user_id, dw.iso(now), ATTESTATION_SHA, ATTESTATION_VERSION))


# ---------------------------------------------------------------- scope and doors

def scope_target(scope_type: str, scope_id: str) -> tuple[str, str]:
    if scope_type not in SCOPE_TYPES or not isinstance(scope_id, str) or not 0 < len(scope_id) <= 128:
        raise ApiError(422, "invalid_scope", "היקף לא תקין.")
    return INSTALLATION if scope_type == "installation" else (scope_type, scope_id)


def doors_in_scope(conn: sqlite3.Connection, principal: Principal, kind: str, target: tuple[str, str]) -> list[dw.Door]:
    """The doors of the stations inside `target` on which the principal holds the kind's permission (deny wins per station)."""
    perm = PERMISSION[kind]
    allowed: dict[str, bool] = {}
    out = []
    for d in dw.doors(conn):
        if d.station_id not in allowed:
            inside = target == INSTALLATION or target in station_chain(conn, d.station_id)
            allowed[d.station_id] = inside and authorize(conn, principal, perm, (STATION, d.station_id)).allowed
        if allowed[d.station_id]:
            out.append(d)
    return out


def scopes_for(conn: sqlite3.Connection, principal: Principal, kind: str) -> list[dict[str, Any]]:
    """The scopes the principal may press in (only those the binding allows, CR-039 7.4), each with its door count."""
    perm = PERMISSION[kind]
    out = []
    candidates = [("installation", "*")]
    candidates += [("site", r["id"]) for r in conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name")]
    candidates += [("building", r["id"]) for r in conn.execute("SELECT id FROM buildings WHERE deleted_at IS NULL ORDER BY sort_order, name")]
    for st, sid in candidates:
        target = scope_target(st, sid)
        if not authorize(conn, principal, perm, target).allowed:
            continue
        n = len(doors_in_scope(conn, principal, kind, target))
        if n:
            out.append({"scope_type": st, "scope_id": sid, "name": scope_name(conn, st, sid), "doors": n})
    return out


# ---------------------------------------------------------------- incidents

def active_incident(conn: sqlite3.Connection, *, drill: bool = False) -> sqlite3.Row | None:
    return conn.execute(f"SELECT * FROM door_emergency_incidents WHERE drill = ? AND state IN ({','.join('?' * len(ACTIVE))}) ORDER BY requested_at DESC LIMIT 1",
                        (1 if drill else 0, *ACTIVE)).fetchone()


def incident_row(conn: sqlite3.Connection, incident_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM door_emergency_incidents WHERE id = ?", (incident_id,)).fetchone()


def incident_view(conn: sqlite3.Connection, row: sqlite3.Row, *, with_doors: bool = True) -> dict[str, Any]:
    labels = {d.key: d for d in dw.doors(conn)}
    out: dict[str, Any] = {
        "id": row["id"], "kind": row["kind"], "kind_label": KIND_HE.get(row["kind"], row["kind"]), "drill": bool(row["drill"]), "state": row["state"],
        "scope_type": row["scope_type"], "scope_id": row["scope_id"], "scope_name": scope_name(conn, row["scope_type"], row["scope_id"]),
        "requested_at": row["requested_at"], "released_at": row["released_at"], "reason": row["reason"] or "",
        "counts": {"total": row["doors_total"], "ok": row["doors_ok"], "failed": row["doors_failed"], "unknown": row["doors_unknown"]},
        "first_sent_ms": row["first_sent_ms"], "last_sent_ms": row["last_sent_ms"], "superseded_by": row["superseded_by"],
    }
    if with_doors:
        rows = conn.execute("SELECT * FROM door_emergency_doors WHERE incident_id = ? ORDER BY phase, station_id, relay", (row["id"],)).fetchall()
        out["doors"] = [{"door": dw.door_key(r["station_id"], r["relay"]), "label": labels[k].label if (k := dw.door_key(r["station_id"], r["relay"])) in labels else k,
                         "phase": r["phase"], "state": r["state"], "attempts": r["attempts"], "code": r["code"]} for r in rows]
    return out


# ---------------------------------------------------------------- rate limits

_PREPARE: dict[str, collections.deque[float]] = {}
_PREPARE_LOCK = threading.Lock()


def reset_rate() -> None:
    with _PREPARE_LOCK:
        _PREPARE.clear()


def _prepare_rate(user_id: str) -> None:
    now = time.monotonic()
    with _PREPARE_LOCK:
        q = _PREPARE.setdefault(user_id, collections.deque())
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= LIMITS["prepare_per_min"]:
            raise ApiError(429, "rate_limited", "יותר מדי ניסיונות. יש להמתין רגע.", retryable=True, details={"retry_after_s": 60})
        q.append(now)


def _start_rate(conn: sqlite3.Connection, user_id: str, drill: bool, now: dt.datetime) -> str | None:
    hour = dw.iso(now - dt.timedelta(hours=1))
    if drill:
        n = conn.execute("SELECT COUNT(*) FROM door_emergency_incidents WHERE drill = 1 AND requested_by = ? AND requested_at > ?", (user_id, hour)).fetchone()[0]
        return "drill_user_hour" if n >= LIMITS["drill_user_hour"] else None
    gap = dw.iso(now - dt.timedelta(seconds=LIMITS["user_gap_s"]))
    if conn.execute("SELECT 1 FROM door_emergency_incidents WHERE drill = 0 AND requested_by = ? AND requested_at > ?", (user_id, gap)).fetchone():
        return "user_gap"
    if conn.execute("SELECT COUNT(*) FROM door_emergency_incidents WHERE drill = 0 AND requested_by = ? AND requested_at > ?", (user_id, hour)).fetchone()[0] >= LIMITS["user_hour"]:
        return "user_hour"
    if conn.execute("SELECT COUNT(*) FROM door_emergency_incidents WHERE drill = 0 AND requested_at > ?", (hour,)).fetchone()[0] >= LIMITS["installation_hour"]:
        return "installation_hour"
    return None


# ---------------------------------------------------------------- the two steps

def _token_sha(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _refuse(conn: sqlite3.Connection, principal: Principal, action: str, status: int, code: str, text: str, **details: Any) -> ApiError:
    audit(conn, actor=principal, action=action, decision="denied", resource_type="door_emergency", reason=code, details=details or None)
    return ApiError(status, code, text, details=details or None)


def check_actor(conn: sqlite3.Connection, principal: Principal, actor_kind: str, action: str, *, dev_mode: bool = False) -> None:
    """T19: an identified interactive person only; any other actor kind is refused unless explicitly permitted (it cannot be in this
    build: `doors.emergency.automations` cannot be switched on)."""
    if actor_kind != "person":
        if setting(conn, AUTOMATIONS) != "on":
            raise _refuse(conn, principal, action, 403, "automation_not_permitted", "לחצני החירום אינם זמינים לאוטומציות.", actor_kind=actor_kind[:16])
    dw.require_person(conn, principal, action, dev_mode=dev_mode)


def prepare(conn: sqlite3.Connection, settings: Any, principal: Principal, *, action: str, kind: str, scope_type: str, scope_id: str,
            incident_id: str | None, drill: bool, now: dt.datetime, actor_kind: str = "person", dev_mode: bool = False) -> dict[str, Any]:
    """Step one: everything is checked, nothing is sent. Returns the confirmation token (shown to this person only, once) with the door
    count and the expiry. The UI shows "N doors · scope" with one confirm button."""
    audit_action = "door.emergency.drill" if drill else "door.emergency.prepare"
    if action not in ("start", "release") or kind not in KINDS:
        raise ApiError(422, "invalid_request", "בקשה לא תקינה.")
    check_actor(conn, principal, actor_kind, audit_action, dev_mode=dev_mode)
    _prepare_rate(principal.user_id)
    if not drill:
        if not enabled(conn):
            raise _refuse(conn, principal, audit_action, 409, "emergency_off", "לחצני החירום כבויים.")
        if kind == "open" and not open_enabled(conn, settings):
            raise _refuse(conn, principal, audit_action, 409, "open_unavailable", "פתיחת חירום אינה זמינה.")
    if action == "start":
        target = scope_target(scope_type, scope_id)
        if not authorize(conn, principal, PERMISSION[kind], target).allowed:
            raise _refuse(conn, principal, audit_action, 403, "forbidden", "אין הרשאה לפעולת חירום בהיקף זה.", kind=kind, scope_type=scope_type)
        doors_ = doors_in_scope(conn, principal, kind, target)
        if not doors_:
            raise _refuse(conn, principal, audit_action, 409, "no_doors", "אין דלתות בהיקף שנבחר.")
        current = active_incident(conn, drill=drill)
        if current is not None and not (kind == "open" and current["kind"] == "lock_secure"):
            raise _refuse(conn, principal, audit_action, 409, "incident_active", "מצב חירום פעיל - יש לשחרר אותו תחילה.", incident_id=current["id"])
        count = len(doors_)
    else:
        row = incident_row(conn, incident_id or "")
        if row is None or row["state"] not in ("in_effect", "in_effect_partial", "applying") or bool(row["drill"]) != drill or row["kind"] != kind:
            raise _refuse(conn, principal, audit_action, 409, "not_releasable", "אין מצב חירום פעיל לשחרור.")
        target = scope_target(row["scope_type"], row["scope_id"])
        scope_type, scope_id = row["scope_type"], row["scope_id"]
        if not authorize(conn, principal, PERMISSION[kind], target).allowed:
            raise _refuse(conn, principal, audit_action, 403, "forbidden", "אין הרשאה לשחרר את מצב החירום.", kind=kind)
        count = row["doors_total"]
    token = secrets.token_urlsafe(24)
    expires = now + dt.timedelta(seconds=CONFIRM_TTL_S)
    conn.execute("""INSERT INTO door_emergency_confirmations(token_sha256, user_id, action, kind, scope_type, scope_id, incident_id, drill, doors_total, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (_token_sha(token), principal.user_id, action, kind, scope_type, scope_id, incident_id if action == "release" else None, 1 if drill else 0, count,
                  dw.iso(now), dw.iso(expires)))
    conn.execute("DELETE FROM door_emergency_confirmations WHERE expires_at < ?", (dw.iso(now - dt.timedelta(hours=1)),))
    return {"confirm_token": token, "expires_at": dw.iso(expires), "doors": count, "kind": kind, "action": action, "drill": drill,
            "scope_type": scope_type, "scope_id": scope_id, "scope_name": scope_name(conn, scope_type, scope_id)}


def _consume(conn: sqlite3.Connection, principal: Principal, token: Any, action: str, now: dt.datetime, audit_action: str) -> sqlite3.Row:
    if not isinstance(token, str) or not 16 <= len(token) <= 64:
        raise _refuse(conn, principal, audit_action, 409, "confirmation_required", "נדרש אישור.")
    sha = _token_sha(token)
    row = conn.execute("SELECT * FROM door_emergency_confirmations WHERE token_sha256 = ?", (sha,)).fetchone()
    if row is None or row["user_id"] != principal.user_id or row["action"] != action:
        raise _refuse(conn, principal, audit_action, 409, "confirmation_invalid", "האישור אינו תקף.")
    if row["used_at"]:
        raise _refuse(conn, principal, audit_action, 409, "confirmation_used", "האישור כבר נוצל.")
    if row["expires_at"] <= dw.iso(now):
        raise _refuse(conn, principal, audit_action, 409, "confirmation_expired", "פג תוקף האישור. יש להתחיל שוב.")
    if conn.execute("UPDATE door_emergency_confirmations SET used_at = ? WHERE token_sha256 = ? AND used_at IS NULL", (dw.iso(now), sha)).rowcount != 1:
        raise _refuse(conn, principal, audit_action, 409, "confirmation_used", "האישור כבר נוצל.")
    return row


def start(conn: sqlite3.Connection, settings: Any, principal: Principal, *, token: Any, confirmed: Any, reason: Any, client_request_id: str,
          now: dt.datetime, actor_kind: str = "person", dev_mode: bool = False) -> str:
    """Step two: consume the confirmation and write the incident with its per-door rows (pending). Every check of `prepare` is made again
    (the world may have changed in 20 s). The caller dispatches after the commit (`dispatch`)."""
    if confirmed is not True:
        raise ApiError(409, "confirmation_required", "נדרש אישור מפורש.")
    conf = _consume(conn, principal, token, "start", now, "door.emergency.start")
    drill = bool(conf["drill"])
    audit_action = "door.emergency.drill" if drill else "door.emergency.started"
    check_actor(conn, principal, actor_kind, audit_action, dev_mode=dev_mode)
    kind = conf["kind"]
    if not drill:
        if not enabled(conn):
            raise _refuse(conn, principal, audit_action, 409, "emergency_off", "לחצני החירום כבויים.")
        if kind == "open" and not open_enabled(conn, settings):
            raise _refuse(conn, principal, audit_action, 409, "open_unavailable", "פתיחת חירום אינה זמינה.")
    limited = _start_rate(conn, principal.user_id, drill, now)
    if limited:
        raise _refuse(conn, principal, "door.emergency.rate_limited", 429, "rate_limited", "יותר מדי הפעלות חירום בזמן קצר.", limit=limited)
    target = scope_target(conf["scope_type"], conf["scope_id"])
    if not authorize(conn, principal, PERMISSION[kind], target).allowed:
        raise _refuse(conn, principal, audit_action, 403, "forbidden", "אין הרשאה לפעולת חירום בהיקף זה.")
    doors_ = doors_in_scope(conn, principal, kind, target)
    if not doors_:
        raise _refuse(conn, principal, audit_action, 409, "no_doors", "אין דלתות בהיקף שנבחר.")
    current = active_incident(conn, drill=drill)
    supersede = None
    if current is not None:
        if kind == "open" and current["kind"] == "lock_secure":
            supersede = current["id"]
        else:
            raise _refuse(conn, principal, audit_action, 409, "incident_active", "מצב חירום פעיל - יש לשחרר אותו תחילה.")
    text = reason.strip()[:REASON_MAX] if isinstance(reason, str) else ""
    iid = new_id()
    at = dw.iso(now)
    conn.execute("""INSERT INTO door_emergency_incidents(id, kind, scope_type, scope_id, drill, state, reason, actor_kind, requested_by, requested_at, request_id, doors_total)
                    VALUES (?, ?, ?, ?, ?, 'applying', ?, ?, ?, ?, ?, ?)""",
                 (iid, kind, conf["scope_type"], conf["scope_id"], 1 if drill else 0, text, actor_kind, principal.user_id, at, client_request_id, len(doors_)))
    conn.executemany("INSERT INTO door_emergency_doors(incident_id, station_id, relay, phase, state) VALUES (?, ?, ?, 'apply', 'pending')",
                     [(iid, d.station_id, d.relay) for d in doors_])
    if supersede:  # OPEN over LOCK (CR-039 8.3): the LOCK is released as part of the OPEN, both audited
        conn.execute("UPDATE door_emergency_incidents SET state = 'released', released_by = ?, released_at = ?, superseded_by = ? WHERE id = ?",
                     (principal.user_id, at, iid, supersede))
        audit(conn, actor=principal, action="door.emergency.released", decision="allowed", resource_type="door_emergency", resource_id=supersede,
              reason="superseded_by_open", details={"by": iid})
    if not drill and kind == "lock_secure":
        # every running window of these doors ends now and is watched to its relock (CR-039 6: superseded by the incident)
        for d in doors_:
            conn.execute("""UPDATE door_window_occurrences SET state = 'ending', end_at = ?, last_reason = 'emergency', updated_at = ?
                            WHERE station_id = ? AND relay = ? AND state IN ('starting','active','not_started')""", (at, at, d.station_id, d.relay))
    if not drill and kind == "open":
        for d in doors_:
            conn.execute("""UPDATE door_window_occurrences SET state = 'superseded', resolution = 'emergency', resolved_at = ?, updated_at = ?
                            WHERE station_id = ? AND relay = ? AND state IN ('starting','active','not_started','ending')""", (at, at, d.station_id, d.relay))
    audit(conn, actor=principal, action=audit_action, decision="allowed", resource_type="door_emergency", resource_id=iid,
          details={"kind": kind, "scope_type": conf["scope_type"], "scope_id": conf["scope_id"], "doors": len(doors_), "request_id": client_request_id,
                   "drill": drill, "actor_kind": actor_kind, "superseded": supersede, "reason_given": bool(text)})
    _notify_started(conn, iid)
    return iid


def release(conn: sqlite3.Connection, settings: Any, principal: Principal, *, token: Any, confirmed: Any, client_request_id: str, now: dt.datetime,
            actor_kind: str = "person", dev_mode: bool = False) -> str:
    if confirmed is not True:
        raise ApiError(409, "confirmation_required", "נדרש אישור מפורש.")
    conf = _consume(conn, principal, token, "release", now, "door.emergency.release")
    check_actor(conn, principal, actor_kind, "door.emergency.released", dev_mode=dev_mode)
    row = incident_row(conn, conf["incident_id"] or "")
    if row is None or row["state"] not in ("in_effect", "in_effect_partial", "applying"):
        raise _refuse(conn, principal, "door.emergency.released", 409, "not_releasable", "אין מצב חירום פעיל לשחרור.")
    if not authorize(conn, principal, PERMISSION[row["kind"]], scope_target(row["scope_type"], row["scope_id"])).allowed:
        raise _refuse(conn, principal, "door.emergency.released", 403, "forbidden", "אין הרשאה לשחרר את מצב החירום.")
    at = dw.iso(now)
    conn.execute("UPDATE door_emergency_incidents SET state = 'releasing', released_by = ?, released_at = ?, release_request_id = ? WHERE id = ?",
                 (principal.user_id, at, client_request_id, row["id"]))
    doors_ = conn.execute("SELECT station_id, relay FROM door_emergency_doors WHERE incident_id = ? AND phase = 'apply' AND state <> 'skipped'", (row["id"],)).fetchall()
    conn.executemany("INSERT OR IGNORE INTO door_emergency_doors(incident_id, station_id, relay, phase, state) VALUES (?, ?, ?, 'release', 'pending')",
                     [(row["id"], d["station_id"], d["relay"]) for d in doors_])
    audit(conn, actor=principal, action="door.emergency.released" if not row["drill"] else "door.emergency.drill", decision="allowed",
          resource_type="door_emergency", resource_id=row["id"], reason="release_requested",
          details={"kind": row["kind"], "doors": len(doors_), "request_id": client_request_id, "drill": bool(row["drill"])})
    return row["id"]


# ---------------------------------------------------------------- dispatch (the incident lane)

DISPATCH_INLINE = False  # tests: dispatch in the request's thread, deterministic
_POOL: ThreadPoolExecutor | None = None
_POOL_LOCK = threading.Lock()


def _pool() -> ThreadPoolExecutor:
    global _POOL
    with _POOL_LOCK:
        if _POOL is None:
            _POOL = ThreadPoolExecutor(max_workers=LANE_SLOTS, thread_name_prefix="door-emergency")
        return _POOL


def engine_for(row: sqlite3.Row, settings: Any) -> dwe.EmergencyEngine:
    """A drill NEVER gets the live engine (CR-039 8.8): the simulation only."""
    return dwe.DrillEngine() if row["drill"] else dwe.emergency_engine(settings)


def dispatch(db: Database, settings: Any, incident_id: str, phase: str, confirmed_at: float | None = None) -> None:
    """Send the incident's pending door rows of `phase` (each once), up to LANE_SLOTS at a time, and settle the incident. Engine calls run
    with no database lock held. `confirmed_at` (monotonic) measures the latency evidence (CR-039 8.7)."""
    with db.connection(mode="read") as conn:
        row = incident_row(conn, incident_id)
        if row is None:
            return
        pending = conn.execute("SELECT station_id, relay, attempts FROM door_emergency_doors WHERE incident_id = ? AND phase = ? AND state = 'pending'",
                               (incident_id, phase)).fetchall()
    engine = engine_for(row, settings)
    t0 = confirmed_at if confirmed_at is not None else time.monotonic()
    sent_ms: list[int] = []

    def one(d: sqlite3.Row) -> tuple[str, int, dwe.DoorOutcome]:
        sent_ms.append(int((time.monotonic() - t0) * 1000))
        try:
            if phase == "apply":
                out = engine.apply(row["kind"], d["station_id"], d["relay"], f"{row['request_id']}:{d['station_id']}:{d['relay']}", row["reason"] or "")
            else:
                out = engine.release(row["kind"], d["station_id"], d["relay"], f"{row['release_request_id'] or row['request_id']}:r:{d['station_id']}:{d['relay']}")
        except dwe.EngineError as exc:
            out = dwe.DoorOutcome("unknown" if exc.kind == "unknown" else "refused", f"{exc.kind}:{exc.code}"[:64])
        except Exception as exc:  # noqa: BLE001 - a transport failure after sending is unknown, never "refused"
            out = dwe.DoorOutcome("unknown", type(exc).__name__[:64])
        return d["station_id"], d["relay"], out

    if DISPATCH_INLINE or len(pending) <= 1:
        results = [one(d) for d in pending]
    else:
        results = list(_pool().map(one, pending))
    _settle(db, settings, row, phase, results, sent_ms, first_dispatch=confirmed_at is not None)


def _retryable(row: sqlite3.Row, phase: str) -> bool:
    """Which unknown outcomes may be retried (bounded): LOCK apply (the close direction), OPEN apply (E-1, the one exception to SR-3), and
    the release of an OPEN (the close direction). Never the release of a LOCK (it re-activates schedules)."""
    return phase == "apply" or (phase == "release" and row["kind"] == "open")


def _settle(db: Database, settings: Any, row: sqlite3.Row, phase: str, results: list[tuple[str, int, dwe.DoorOutcome]], sent_ms: list[int],
            *, first_dispatch: bool) -> None:
    now = now_utc()
    at = dw.iso(now)
    with db.connection() as conn:
        for station_id, relay, out in results:
            attempts = conn.execute("SELECT attempts FROM door_emergency_doors WHERE incident_id = ? AND station_id = ? AND relay = ? AND phase = ?",
                                    (row["id"], station_id, relay, phase)).fetchone()["attempts"] + 1
            retry = out.state == "unknown" and attempts < MAX_ATTEMPTS and _retryable(row, phase) and not row["drill"]
            conn.execute("""UPDATE door_emergency_doors SET state = ?, code = ?, attempts = ?, last_at = ?, next_at = ?, settled_at = ?
                            WHERE incident_id = ? AND station_id = ? AND relay = ? AND phase = ?""",
                         (out.state, out.code or None, attempts, at, dw.iso(now + dt.timedelta(seconds=RETRY_GAP_S)) if retry else None,
                          None if retry else at, row["id"], station_id, relay, phase))
            audit(conn, actor=None, action="door.emergency.door_result", decision="allowed" if out.state == "acknowledged" else "failed",
                  resource_type="door", resource_id=dw.door_key(station_id, relay), reason=out.state,
                  details={"incident_id": row["id"], "phase": phase, "kind": row["kind"], "attempt": attempts, "code": out.code or None,
                           "drill": bool(row["drill"]), "retry_planned": retry})
        if first_dispatch and sent_ms and phase == "apply":
            conn.execute("UPDATE door_emergency_incidents SET first_sent_ms = ?, last_sent_ms = ? WHERE id = ?", (min(sent_ms), max(sent_ms), row["id"]))
        _recount(conn, row["id"], phase)
    if phase == "release" and not row["drill"]:
        with db.connection() as conn:
            if incident_row(conn, row["id"])["state"] in ("released", "released_partial"):
                # the doors of this incident AND of a LOCK it superseded in one step (OPEN over LOCK): their programs are re-activated by
                # the next compile (CR-039 8.2), never immediately
                ids = [row["id"], *[r["id"] for r in conn.execute("SELECT id FROM door_emergency_incidents WHERE superseded_by = ?", (row["id"],))]]
                for iid in ids:
                    for d in conn.execute("SELECT station_id, relay FROM door_emergency_doors WHERE incident_id = ? AND phase = 'apply'", (iid,)).fetchall():
                        dw.clear_pause(conn, d["station_id"], d["relay"])
        dw.WORKER.wake()


def _recount(conn: sqlite3.Connection, incident_id: str, phase: str) -> None:
    row = incident_row(conn, incident_id)
    rows = conn.execute("SELECT state FROM door_emergency_doors WHERE incident_id = ? AND phase = ?", (incident_id, phase)).fetchall()
    ok = sum(1 for r in rows if r["state"] == "acknowledged")
    failed = sum(1 for r in rows if r["state"] == "refused")
    unknown = sum(1 for r in rows if r["state"] == "unknown")
    open_rows = sum(1 for r in rows if r["state"] in ("pending", "sent"))
    retry_left = conn.execute("SELECT COUNT(*) FROM door_emergency_doors WHERE incident_id = ? AND phase = ? AND next_at IS NOT NULL", (incident_id, phase)).fetchone()[0]
    if phase == "apply":
        conn.execute("UPDATE door_emergency_incidents SET doors_ok = ?, doors_failed = ?, doors_unknown = ? WHERE id = ?", (ok, failed, unknown, incident_id))
        if row["state"] in ("applying", "in_effect", "in_effect_partial") and not open_rows:
            new = "in_effect" if ok == len(rows) else "in_effect_partial"  # a door acknowledged on a retry turns a partial result whole
            conn.execute("UPDATE door_emergency_incidents SET state = ? WHERE id = ? AND state IN ('applying','in_effect','in_effect_partial')", (new, incident_id))
            if new == "in_effect_partial" and not retry_left:
                _notify_partial(conn, incident_id)  # once the bounded retries are spent (the dedupe key folds a repeat)
    elif row["state"] == "releasing" and not open_rows:
        new = "released" if ok == len(rows) else "released_partial"
        conn.execute("UPDATE door_emergency_incidents SET state = ? WHERE id = ? AND state = 'releasing'", (new, incident_id))
        _notify_released(conn, incident_id)


def retry_tick(db: Database, settings: Any, now: dt.datetime) -> int:
    """The bounded retries of unknown door outcomes (10 s apart, three attempts at most). Called by the door-windows worker."""
    with db.connection(mode="read") as conn:
        due = conn.execute("""SELECT d.incident_id, d.phase FROM door_emergency_doors d JOIN door_emergency_incidents i ON i.id = d.incident_id
                              WHERE d.state = 'unknown' AND d.next_at IS NOT NULL AND d.next_at <= ? AND i.drill = 0
                                AND ((d.phase = 'apply' AND i.state IN ('applying','in_effect','in_effect_partial')) OR (d.phase = 'release' AND i.state = 'releasing'))
                              GROUP BY d.incident_id, d.phase""",
                           (dw.iso(now),)).fetchall()
    for r in due:
        with db.connection() as conn:
            conn.execute("""UPDATE door_emergency_doors SET state = 'pending', next_at = NULL WHERE incident_id = ? AND phase = ? AND state = 'unknown'
                            AND next_at IS NOT NULL AND next_at <= ?""", (r["incident_id"], r["phase"], dw.iso(now)))
        dispatch(db, settings, r["incident_id"], r["phase"])
    return len(due)


def submit(db: Database, settings: Any, incident_id: str, phase: str) -> None:
    """After the commit: dispatch now (tests) or on the incident lane."""
    confirmed_at = time.monotonic()
    if DISPATCH_INLINE:
        dispatch(db, settings, incident_id, phase, confirmed_at)
    else:
        threading.Thread(target=dispatch, args=(db, settings, incident_id, phase, confirmed_at), name="door-emergency-dispatch", daemon=True).start()


# ---------------------------------------------------------------- notifications

def _params(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    return {"kind": KIND_HE.get(row["kind"], row["kind"]), "scope": scope_name(conn, row["scope_type"], row["scope_id"]), "count": row["doors_total"]}


def _notify_started(conn: sqlite3.Connection, incident_id: str) -> None:
    from . import notify

    row = incident_row(conn, incident_id)
    source = "door.emergency.drill" if row["drill"] else "door.emergency.started"
    notify.emit(conn, notify.Signal(source, "door", f"emergency:{incident_id}", dedupe_key=f"{source}:{incident_id}", params=_params(conn, row),
                                    origin={"incident_id": incident_id}, initiator_user_id=row["requested_by"]))


def _notify_partial(conn: sqlite3.Connection, incident_id: str) -> None:
    from . import notify

    row = incident_row(conn, incident_id)
    if row["drill"]:
        return
    notify.emit(conn, notify.Signal("door.emergency.partial", "door", f"emergency:{incident_id}", dedupe_key=f"door.emergency.partial:{incident_id}",
                                    params={**_params(conn, row), "failed": row["doors_failed"] + row["doors_unknown"]}, origin={"incident_id": incident_id}))


def _notify_released(conn: sqlite3.Connection, incident_id: str) -> None:
    from . import notify

    row = incident_row(conn, incident_id)
    if row["drill"]:
        return
    for source in ("door.emergency.started", "door.emergency.partial"):
        notify.emit(conn, notify.Signal(source, "door", f"emergency:{incident_id}", dedupe_key=f"{source}:{incident_id}", resolve=True))
    notify.emit(conn, notify.Signal("door.emergency.released", "door", f"emergency:{incident_id}", dedupe_key=f"door.emergency.released:{incident_id}",
                                    params=_params(conn, row), origin={"incident_id": incident_id}))


def pause_windows_for_lock(db: Database, settings: Any, incident_id: str) -> None:
    """A LOCK also pauses every Arx program of its doors (until the release): the close direction, through the window engine."""
    with db.connection(mode="read") as conn:
        row = incident_row(conn, incident_id)
        if row is None or row["drill"] or row["kind"] != "lock_secure":
            return
        doors_ = conn.execute("SELECT station_id, relay FROM door_emergency_doors WHERE incident_id = ? AND phase = 'apply'", (incident_id,)).fetchall()
    for d in doors_:
        dw.pause_door(db, settings, d["station_id"], d["relay"], None, why="emergency_lock")
