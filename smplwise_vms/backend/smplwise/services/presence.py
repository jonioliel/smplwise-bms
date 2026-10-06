"""CR-027: the SmplWise Arx phone app - device registration, the presence / sensor contract and the required-sensors policy.

What lives here (docs/api/mobile-presence-contract.md is the contract the app is built against):
- a DEVICE is one phone install of one user on this server (`mobile_devices`); it is created by the signed-in user through
  the app and holds a 256-bit device token the server keeps only as a SHA-256 hash. The token is the app's credential for
  everything it does afterwards (config, acknowledgements, events, push registration); it never grants anything the user
  could not do in the web app, and it is not an HA token (prefix `arxd_`, so the remote channel never mistakes it for one);
- the SETTINGS (`presence.*` rows of `settings`): the master switch (default OFF - nothing is collected, no permission
  prompt on the phone, owner decision 2026-10-04), the sensors the administrator allows, the employee notice with its
  version (the text or a newly allowed sensor bumps it, and every device must acknowledge the new version before it
  reports again), cadence, geofences, retention and the required-sensors policy;
- the EVENT LOG (`mobile_presence_events`, derived values only, idempotent per client event id, pruned after
  `presence.retention_days`) and the CURRENT presence state per device (one JSON value on the device row);
- the REQUIRED-SENSORS POLICY (owner decision 2026-10-05): an administrator may require sensors (e.g. location) as a
  condition for using the system FROM THE PHONE APP. A session of the app (its user agent says `SmplWiseArx/`) of a user
  the policy applies to is refused (403 `presence_required`) until a registered device of theirs reports the required
  sensors on; `GET /me` says what is missing so the app can show the reason. Administrators are never locked out, a plain
  browser is not affected unless the policy says so, and a break-glass suspends the policy for a while. The policy is
  inert while the master switch is off (nothing can be reported, so nothing can be required). It has employment-law
  implications: the employee notice is the place that explains it (CR-027 section 7).

Rules of the road: the phone never receives anything but its own device row; coordinates are stored only as the current
state and the retention-limited log; no address lookup, no raw sensor streams; every write is audited; sends never happen
under the SQLite write lock (push is services/mobile_push.py)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import secrets
import sqlite3
import threading
import time
from typing import Any

from ..db import Database, get_setting, new_id, now_iso, set_setting
from ..errors import ApiError
from ..rbac import Principal, is_system_admin

TOKEN_PREFIX = "arxd_"  # a device token; never an HA token, never a session cookie
NAME_MIN, NAME_MAX = 2, 40
MAX_DEVICES_PER_USER = 10
BATCH_MAX = 50
VALUE_MAX_BYTES = 1024
MODES = ("continuous",)
PLATFORMS = ("ios", "android")
EVENT_TYPES = ("fix", "enter", "exit", "sensor")
SOURCES = ("continuous", "region", "significant", "foreground")
LOCATION_AUTH = ("always", "when_in_use", "denied", "restricted", "not_determined")
RETENTION_MIN, RETENTION_MAX, RETENTION_DEFAULT = 1, 365, 30
REVOKED_KEEP_DAYS = 30
APP_UA_MARK = "SmplWiseArx/"  # the shells' user-agent suffix: `SmplWiseArx/<version> (iOS app)` / `(Android app)`
RATE_REGISTER = (10, 10 / 60.0)  # registrations per user: burst 10, 10 per hour
RATE_EVENTS = (60, 60.0)  # event batches per device: burst 60, 60 per minute
RATE_SETTINGS = (20, 20.0)  # presence.settings writes per installation (one administrator at a time)
TOKEN_FAILURES_PER_MIN = 20  # unknown-token lookups per client key before 429
TOKEN_FAILURES_GLOBAL = 300
GATE_AUDIT_EVERY_S = 600  # one `presence.gate.refused` audit row per user per 10 minutes, not per request

# The sensor catalogue (iOS addendum A.2; Android implements the same keys). Derived values only; the server validates
# nothing about the phone's behaviour but the keys. `name_he` / `purpose_he` are what the app lists (its own strings win).
SENSORS: dict[str, dict[str, str]] = {
    "location": {"name_he": "מיקום", "purpose_he": "נוכחות במבנה: כניסה ויציאה"},
    "activity": {"name_he": "פעילות (הליכה, נסיעה)", "purpose_he": "האם המכשיר בתנועה"},
    "steps": {"name_he": "צעדים", "purpose_he": "ספירת צעדים בפרקי זמן"},
    "altitude": {"name_he": "שינוי גובה (קומה)", "purpose_he": "רמז לקומה, יחד עם המיקום"},
    "battery": {"name_he": "סוללה", "purpose_he": "אחוז טעינה ומצב חיסכון"},
    "network": {"name_he": "רשת ו-Wi-Fi", "purpose_he": "סוג החיבור וזיהוי רשת האתר"},
    "beacon": {"name_he": "קרבה לנקודות בבניין", "purpose_he": "קרבה למשדרים שהוגדרו"},
    "app_state": {"name_he": "פעילות האפליקציה", "purpose_he": "האם האפליקציה פתוחה; פעימת חיים"},
}
SENSOR_KEYS = tuple(SENSORS)
DEFAULT_INTERVALS: dict[str, int] = {"battery": 900, "steps": 300, "app_state": 300}

SETTINGS_DEFAULTS: dict[str, str] = {
    "presence.enabled": "false",
    "presence.mode": "continuous",
    "presence.interval_s": "60",
    "presence.distance_filter_m": "50",
    "presence.notice_text": "",
    "presence.notice_version": "1",
    "presence.sensors_allowed": json.dumps(list(SENSOR_KEYS)),
    "presence.intervals_s": json.dumps(DEFAULT_INTERVALS),
    "presence.sites": "[]",
    "presence.beacons": "[]",
    "presence.wifi_sites": "[]",
    "presence.retention_days": str(RETENTION_DEFAULT),
    "presence.required_sensors": json.dumps({"enabled": False, "sensors": [], "apply_to_web": False, "max_stale_hours": 48, "roles": [], "users": [], "exempt_users": []}),
    "presence.break_glass": json.dumps({"until": None, "reason": "", "by": None}),
}


class PresenceError(ApiError):
    pass


# ---------------------------------------------------------------- helpers

def _json(text: str | None, default: Any) -> Any:
    try:
        v = json.loads(text) if text else default
    except ValueError:
        return default
    return v if isinstance(v, type(default)) else default


def _parse(iso: str | None) -> dt.datetime | None:
    if not iso:
        return None
    try:
        return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def iso(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def new_token() -> str:
    return TOKEN_PREFIX + secrets.token_urlsafe(32)  # 256 bits


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_device_token(token: str | None) -> bool:
    return bool(token) and token.startswith(TOKEN_PREFIX) and 30 <= len(token) <= 80


def is_app_user_agent(ua: str | None) -> bool:
    return APP_UA_MARK in (ua or "")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ---------------------------------------------------------------- rate limits (in memory, per process)

def _now() -> float:
    """The limiters' clock (a seam: tests freeze it so a slow machine cannot refill a token or age a failure out mid-test)."""
    return time.monotonic()


class _Bucket:
    def __init__(self, burst: int, per_min: float) -> None:
        self.burst, self.rate = float(burst), per_min / 60.0
        self.tokens, self.at = float(burst), _now()

    def take(self) -> bool:
        now = _now()
        self.tokens = min(self.burst, self.tokens + (now - self.at) * self.rate)
        self.at = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


_BUCKETS: dict[tuple[str, str], _Bucket] = {}
_LOCK = threading.Lock()


def take(lane: str, key: str, rate: tuple[int, float]) -> bool:
    with _LOCK:
        b = _BUCKETS.get((lane, key))
        if b is None:
            b = _BUCKETS[(lane, key)] = _Bucket(*rate)
            if len(_BUCKETS) > 5000:
                _BUCKETS.clear()
                _BUCKETS[(lane, key)] = b
        return b.take()


class _Failures:
    """Unknown-token lookups per client key (a minute's window): 128 random bits cannot be guessed, this keeps noise down."""

    def __init__(self, burst: int) -> None:
        self.burst = burst
        self.hits: dict[str, list[float]] = {}

    def blocked(self, who: str) -> bool:
        now = _now()
        with _LOCK:
            self.hits[who] = [t for t in self.hits.get(who, []) if now - t < 60.0]
            return len(self.hits[who]) >= self.burst

    def fail(self, who: str) -> None:
        with _LOCK:
            self.hits.setdefault(who, []).append(_now())
            if len(self.hits) > 2000:
                self.hits.clear()


TOKEN_FAILURES = _Failures(TOKEN_FAILURES_PER_MIN)
TOKEN_FAILURES_ALL = _Failures(TOKEN_FAILURES_GLOBAL)
_GATE_AUDITED: dict[str, float] = {}


def reset_limits() -> None:
    with _LOCK:
        _BUCKETS.clear()
        TOKEN_FAILURES.hits.clear()
        TOKEN_FAILURES_ALL.hits.clear()
        _GATE_AUDITED.clear()


# ---------------------------------------------------------------- settings

def load_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    raw = {k: get_setting(conn, k, d) or d for k, d in SETTINGS_DEFAULTS.items()}
    allowed = [s for s in _json(raw["presence.sensors_allowed"], []) if s in SENSORS]
    req = _normalize_required(_json(raw["presence.required_sensors"], {}), strict=False)
    bg = _json(raw["presence.break_glass"], {})
    until = _parse(bg.get("until")) if isinstance(bg.get("until"), str) else None
    if until is not None and until <= now_utc():
        until = None
    return {
        "enabled": raw["presence.enabled"] == "true",
        "mode": raw["presence.mode"] if raw["presence.mode"] in MODES else "continuous",
        "interval_s": max(30, min(3600, int(raw["presence.interval_s"] or 60))),
        "distance_filter_m": max(10, min(5000, int(raw["presence.distance_filter_m"] or 50))),
        "notice_text": raw["presence.notice_text"],
        "notice_version": max(1, int(raw["presence.notice_version"] or 1)),
        "sensors_allowed": allowed,
        "intervals_s": {k: int(v) for k, v in _json(raw["presence.intervals_s"], {}).items() if k in SENSORS and isinstance(v, int) and 30 <= v <= 86400},
        "sites": [s for s in _json(raw["presence.sites"], []) if isinstance(s, dict)],
        "beacons": [b for b in _json(raw["presence.beacons"], []) if isinstance(b, dict)],
        "wifi_sites": [w for w in _json(raw["presence.wifi_sites"], []) if isinstance(w, dict)],
        "retention_days": max(RETENTION_MIN, min(RETENTION_MAX, int(raw["presence.retention_days"] or RETENTION_DEFAULT))),
        "required_sensors": req,
        "break_glass": {"until": iso(until) if until else None, "reason": str(bg.get("reason") or "")[:200], "by": bg.get("by") if isinstance(bg.get("by"), str) else None},
    }


def _normalize_required(p: Any, *, strict: bool) -> dict[str, Any]:
    def bad(msg: str, field: str) -> PresenceError:
        return PresenceError(422, "validation", msg, details={"field": field})

    if not isinstance(p, dict):
        if strict:
            raise bad("מדיניות החיישנים הנדרשים אינה תקינה.", "required_sensors")
        p = {}
    sensors = p.get("sensors", [])
    if not isinstance(sensors, list) or any(not isinstance(s, str) for s in sensors):
        if strict:
            raise bad("יש לבחור חיישנים מהרשימה.", "required_sensors.sensors")
        sensors = []
    unknown = [s for s in sensors if s not in SENSORS]
    if unknown and strict:
        raise bad("חיישן לא מוכר: " + ", ".join(unknown), "required_sensors.sensors")
    stale = p.get("max_stale_hours", 48)
    if not isinstance(stale, int) or isinstance(stale, bool) or not 1 <= stale <= 24 * 30:
        if strict:
            raise bad("משך תוקף הדיווח: בין שעה ל־30 יום.", "required_sensors.max_stale_hours")
        stale = 48

    def ids(key: str) -> list[str]:
        v = p.get(key, [])
        if not isinstance(v, list) or any(not isinstance(i, str) or not 0 < len(i) <= 128 for i in v) or len(v) > 200:
            if strict:
                raise bad("רשימת מזהים אינה תקינה.", f"required_sensors.{key}")
            return []
        return sorted(set(v))

    return {
        "enabled": bool(p.get("enabled", False)),
        "sensors": sorted({s for s in sensors if s in SENSORS}),
        "apply_to_web": bool(p.get("apply_to_web", False)),
        "max_stale_hours": stale,
        "roles": ids("roles"),
        "users": ids("users"),
        "exempt_users": ids("exempt_users"),
    }


def _validate_sites(v: Any) -> list[dict[str, Any]]:
    if not isinstance(v, list) or len(v) > 20:
        raise PresenceError(422, "validation", "עד 20 אתרים (גדרות גאוגרפיות).", details={"field": "sites"})
    out = []
    for s in v:
        try:
            sid, name = str(s["id"])[:64], str(s.get("name") or "")[:80]
            lat, lon, radius = float(s["lat"]), float(s["lon"]), int(s.get("radius_m", 150))
            if not sid or not -90 <= lat <= 90 or not -180 <= lon <= 180 or not 30 <= radius <= 5000:
                raise ValueError
        except (KeyError, TypeError, ValueError):
            raise PresenceError(422, "validation", "אתר: id, lat, lon ו־radius_m (30–5000 מטר).", details={"field": "sites"}) from None
        out.append({"id": sid, "name": name, "lat": lat, "lon": lon, "radius_m": radius})
    if len({s["id"] for s in out}) != len(out):
        raise PresenceError(422, "validation", "מזהי האתרים חייבים להיות ייחודיים.", details={"field": "sites"})
    return out


def _validate_list_of_dicts(v: Any, field: str, keys: tuple[str, ...], limit: int = 50) -> list[dict[str, Any]]:
    if not isinstance(v, list) or len(v) > limit or any(not isinstance(x, dict) or set(keys) - set(x) for x in v):
        raise PresenceError(422, "validation", f"{field}: רשימה של אובייקטים עם {', '.join(keys)}.", details={"field": field})
    return [{k: (x[k] if isinstance(x[k], list) else str(x[k])[:200]) for k in x if k in keys} for x in v]


def update_settings(conn: sqlite3.Connection, body: dict[str, Any], actor_user_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply an administrator's partial update. Returns (the new settings, what changed for the audit row - never the whole
    notice text). The notice version rises by itself when the text changes or a sensor is newly allowed."""
    current = load_settings(conn)
    changes: dict[str, Any] = {}
    unknown = set(body) - {"enabled", "mode", "interval_s", "distance_filter_m", "notice_text", "sensors_allowed", "intervals_s", "sites", "beacons", "wifi_sites",
                           "retention_days", "required_sensors"}
    if unknown:
        raise PresenceError(422, "validation", "שדה לא מוכר: " + ", ".join(sorted(unknown)), details={"fields": sorted(unknown)})
    bump = False
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise PresenceError(422, "validation", "מתג הנוכחות: כן/לא.", details={"field": "enabled"})
        set_setting(conn, "presence.enabled", "true" if body["enabled"] else "false")
        changes["enabled"] = body["enabled"]
    if "mode" in body:
        if body["mode"] not in MODES:
            raise PresenceError(422, "validation", "מצב לא מוכר.", details={"field": "mode"})
        set_setting(conn, "presence.mode", body["mode"])
        changes["mode"] = body["mode"]
    for key, lo, hi in (("interval_s", 30, 3600), ("distance_filter_m", 10, 5000), ("retention_days", RETENTION_MIN, RETENTION_MAX)):
        if key in body:
            v = body[key]
            if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
                raise PresenceError(422, "validation", f"{key}: בין {lo} ל־{hi}.", details={"field": key})
            set_setting(conn, f"presence.{key}", str(v))
            changes[key] = v
    if "notice_text" in body:
        text = body["notice_text"]
        if not isinstance(text, str) or len(text) > 8000:
            raise PresenceError(422, "validation", "טקסט ההודעה: עד 8000 תווים.", details={"field": "notice_text"})
        text = text.strip()
        if text != current["notice_text"]:
            set_setting(conn, "presence.notice_text", text)
            changes["notice_text_len"] = len(text)
            bump = True
    if "sensors_allowed" in body:
        v = body["sensors_allowed"]
        if not isinstance(v, list) or any(s not in SENSORS for s in v):
            raise PresenceError(422, "validation", "חיישן לא מוכר ברשימת המאושרים.", details={"field": "sensors_allowed", "known": list(SENSOR_KEYS)})
        allowed = [s for s in SENSOR_KEYS if s in v]
        if set(allowed) - set(current["sensors_allowed"]):
            bump = True  # a newly allowed sensor: the employees are asked again (addendum A.1.3)
        set_setting(conn, "presence.sensors_allowed", json.dumps(allowed))
        changes["sensors_allowed"] = allowed
    if "intervals_s" in body:
        v = body["intervals_s"]
        if not isinstance(v, dict) or any(k not in SENSORS or not isinstance(x, int) or isinstance(x, bool) or not 30 <= x <= 86400 for k, x in v.items()):
            raise PresenceError(422, "validation", "מרווחי הדיווח: שניות (30–86400) לכל חיישן מוכר.", details={"field": "intervals_s"})
        set_setting(conn, "presence.intervals_s", json.dumps(v))
        changes["intervals_s"] = v
    if "sites" in body:
        sites = _validate_sites(body["sites"])
        set_setting(conn, "presence.sites", json.dumps(sites, ensure_ascii=False))
        changes["sites"] = len(sites)
    if "beacons" in body:
        beacons = _validate_list_of_dicts(body["beacons"], "beacons", ("uuid", "site_id"))
        set_setting(conn, "presence.beacons", json.dumps(beacons, ensure_ascii=False))
        changes["beacons"] = len(beacons)
    if "wifi_sites" in body:
        wifi = _validate_list_of_dicts(body["wifi_sites"], "wifi_sites", ("site_id", "ssid_hash_salt", "ssid_hashes"))
        set_setting(conn, "presence.wifi_sites", json.dumps(wifi, ensure_ascii=False))
        changes["wifi_sites"] = len(wifi)
    if "required_sensors" in body:
        req = _normalize_required(body["required_sensors"], strict=True)
        set_setting(conn, "presence.required_sensors", json.dumps(req))
        changes["required_sensors"] = req
    if bump:
        version = current["notice_version"] + 1
        set_setting(conn, "presence.notice_version", str(version))
        changes["notice_version"] = version
    return load_settings(conn), changes


def break_glass(conn: sqlite3.Connection, actor_user_id: str, hours: int, reason: str) -> dict[str, Any]:
    """Suspend the required-sensors policy for `hours` (0 = end the suspension now). Always audited by the caller."""
    if not isinstance(hours, int) or isinstance(hours, bool) or not 0 <= hours <= 24 * 14:
        raise PresenceError(422, "validation", "משך ההשעיה: עד 14 יום (0 מסיים אותה).", details={"field": "hours"})
    reason = " ".join(str(reason or "").split())[:200]
    if hours and len(reason) < 3:
        raise PresenceError(422, "validation", "נדרשת סיבה להשעיית המדיניות.", details={"field": "reason"})
    until = iso(now_utc() + dt.timedelta(hours=hours)) if hours else None
    set_setting(conn, "presence.break_glass", json.dumps({"until": until, "reason": reason if hours else "", "by": actor_user_id if hours else None}))
    return load_settings(conn)["break_glass"]


# ---------------------------------------------------------------- devices

def _device_out(r: sqlite3.Row, *, with_user: bool = False, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    status = _json(r["status_json"], {})
    out: dict[str, Any] = {
        "device_id": r["id"], "name": r["name"], "platform": r["platform"], "app_version": r["app_version"], "os_version": r["os_version"], "model": r["model"],
        "registered_at": r["created_at"], "last_seen_at": r["last_seen_at"], "last_event_at": r["last_event_at"],
        "notice_ack_version": r["notice_ack_version"], "notice_ack_at": r["notice_ack_at"],
        "status": {"location_auth": status.get("location_auth") or "not_determined", "precise": bool(status.get("precise", False)), "sharing": bool(status.get("sharing", False)),
                   "sensors": {k: ("on" if status.get("sensors", {}).get(k) == "on" else "off") for k in SENSOR_KEYS}},
        "presence": _json(r["presence_json"], {}),
        "push": {"registered": bool(r["push_relay_token"]), "platform": r["push_platform"], "muted": _json(r["push_muted_json"], []), "last_ok_at": r["push_last_ok_at"],
                 "failures": r["push_failures"], "last_error": r["push_last_error"]},
        "revoked_at": r["revoked_at"],
    }
    if with_user and conn is not None:
        u = conn.execute("SELECT id, username, display_name, active FROM users WHERE id = ?", (r["user_id"],)).fetchone()
        out["user"] = {"id": r["user_id"], "username": u["username"] if u else "", "display_name": (u["display_name"] or u["username"]) if u else r["user_id"], "active": bool(u["active"]) if u else False}
    return out


def _name_taken(conn: sqlite3.Connection, user_id: str, name: str, except_id: str | None) -> bool:
    r = conn.execute("SELECT id FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL AND lower(name) = lower(?)", (user_id, name)).fetchone()
    return r is not None and r["id"] != except_id


def _suggest(conn: sqlite3.Connection, user_id: str, name: str) -> str:
    for n in range(2, 100):
        cand = f"{name} {n}"
        if len(cand) <= NAME_MAX and not _name_taken(conn, user_id, cand, None):
            return cand
    return name


def clean_name(name: Any) -> str:
    text = " ".join(str(name or "").split())
    if not NAME_MIN <= len(text) <= NAME_MAX:
        raise PresenceError(400, "invalid_name", f"השם צריך להכיל בין {NAME_MIN} ל־{NAME_MAX} תווים.", details={"field": "name"})
    return text


def register(conn: sqlite3.Connection, principal: Principal, body: dict[str, Any], channel: str) -> tuple[dict[str, Any], str, bool]:
    """Create the caller's device (201) or rotate the token of an existing registration of the same install (200). Returns
    (device, the plain token - shown once, created)."""
    name = clean_name(body.get("name"))
    platform = body.get("platform")
    if platform not in PLATFORMS:
        raise PresenceError(400, "invalid_platform", "הפלטפורמה אינה מוכרת (ios / android).", details={"field": "platform"})
    install_id = str(body.get("install_id") or "").strip()
    if not 8 <= len(install_id) <= 64:
        raise PresenceError(400, "invalid_install_id", "מזהה ההתקנה אינו תקין.", details={"field": "install_id"})
    if not take("register", principal.user_id, RATE_REGISTER):
        raise PresenceError(429, "rate_limited", "יותר מדי רישומים. נסו שוב מאוחר יותר.", retryable=True)
    token = new_token()
    now = now_iso()
    meta = {k: (str(body.get(k) or "")[:80] or None) for k in ("app_version", "os_version", "model")}
    existing = conn.execute("SELECT * FROM mobile_devices WHERE user_id = ? AND install_id = ?", (principal.user_id, install_id)).fetchone()
    if existing is not None:
        if _name_taken(conn, principal.user_id, name, existing["id"]):
            raise PresenceError(409, "device_name_taken", "השם כבר בשימוש במכשיר אחר שלך.", details={"suggestion": _suggest(conn, principal.user_id, name)})
        conn.execute(
            "UPDATE mobile_devices SET name = ?, platform = ?, app_version = ?, os_version = ?, model = ?, token_hash = ?, token_rotated_at = ?, channel = ?, last_seen_at = ?, revoked_at = NULL"
            " WHERE id = ?",
            (name, platform, meta["app_version"], meta["os_version"], meta["model"], token_hash(token), now, channel, now, existing["id"]),
        )
        row = conn.execute("SELECT * FROM mobile_devices WHERE id = ?", (existing["id"],)).fetchone()
        return _device_out(row), token, False
    if _name_taken(conn, principal.user_id, name, None):
        raise PresenceError(409, "device_name_taken", "השם כבר בשימוש במכשיר אחר שלך.", details={"suggestion": _suggest(conn, principal.user_id, name)})
    live = conn.execute("SELECT COUNT(*) FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL", (principal.user_id,)).fetchone()[0]
    if live >= MAX_DEVICES_PER_USER:
        raise PresenceError(409, "too_many_devices", f"אפשר לרשום עד {MAX_DEVICES_PER_USER} מכשירים. הסירו מכשיר ישן קודם.")
    did = "dev_" + new_id()
    conn.execute(
        "INSERT INTO mobile_devices(id, user_id, name, platform, install_id, app_version, os_version, model, token_hash, token_rotated_at, channel, created_at, last_seen_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (did, principal.user_id, name, platform, install_id, meta["app_version"], meta["os_version"], meta["model"], token_hash(token), now, channel, now, now),
    )
    return _device_out(conn.execute("SELECT * FROM mobile_devices WHERE id = ?", (did,)).fetchone()), token, True


def by_token(conn: sqlite3.Connection, token: str) -> sqlite3.Row | None:
    """The live device of a token (None for an unknown, malformed or revoked one). Constant work either way."""
    if not is_device_token(token):
        return None
    r = conn.execute("SELECT * FROM mobile_devices WHERE token_hash = ?", (token_hash(token),)).fetchone()
    if r is None or r["revoked_at"]:
        return None
    u = conn.execute("SELECT active FROM users WHERE id = ?", (r["user_id"],)).fetchone()
    if u is not None and not u["active"]:
        return None
    return r


def principal_of(conn: sqlite3.Connection, device: sqlite3.Row) -> Principal:
    u = conn.execute("SELECT id, username, display_name FROM users WHERE id = ?", (device["user_id"],)).fetchone()
    return Principal(user_id=device["user_id"], username=(u["username"] if u else "") or "", display_name=(u["display_name"] if u else "") or "", source="device")


def touch(conn: sqlite3.Connection, device_id: str, *, event: bool = False) -> None:
    now = now_iso()
    conn.execute("UPDATE mobile_devices SET last_seen_at = ?" + (", last_event_at = ?" if event else "") + " WHERE id = ?", (now, now, device_id) if event else (now, device_id))


def get_device(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM mobile_devices WHERE id = ?", (device_id,)).fetchone()


def list_own(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
    return [_device_out(r) for r in conn.execute("SELECT * FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at", (user_id,)).fetchall()]


def list_all(conn: sqlite3.Connection, user_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM mobile_devices WHERE revoked_at IS NULL" + (" AND user_id = ?" if user_id else "") + " ORDER BY user_id, created_at"
    return [_device_out(r, with_user=True, conn=conn) for r in conn.execute(sql, (user_id,) if user_id else ()).fetchall()]


def rename(conn: sqlite3.Connection, device: sqlite3.Row, name: Any) -> dict[str, Any]:
    name = clean_name(name)
    if _name_taken(conn, device["user_id"], name, device["id"]):
        raise PresenceError(409, "device_name_taken", "השם כבר בשימוש במכשיר אחר שלך.", details={"suggestion": _suggest(conn, device["user_id"], name)})
    conn.execute("UPDATE mobile_devices SET name = ? WHERE id = ?", (name, device["id"]))
    return _device_out(get_device(conn, device["id"]))


def unregister(conn: sqlite3.Connection, device: sqlite3.Row) -> None:
    """Revoke: the token stops working at once, the event log is dropped, the row stays REVOKED_KEEP_DAYS for the audit trail."""
    conn.execute("UPDATE mobile_devices SET revoked_at = ?, token_hash = ?, push_relay_token = NULL, push_platform = NULL, presence_json = '{}', status_json = '{}' WHERE id = ?",
                 (now_iso(), "revoked:" + new_id(), device["id"]))
    conn.execute("DELETE FROM mobile_presence_events WHERE device_id = ?", (device["id"],))
    conn.execute("DELETE FROM mobile_push_messages WHERE device_id = ?", (device["id"],))


def out(conn: sqlite3.Connection, device_id: str, *, with_user: bool = False) -> dict[str, Any]:
    return _device_out(get_device(conn, device_id), with_user=with_user, conn=conn)


# ---------------------------------------------------------------- the app's config and the notice

def config_for(conn: sqlite3.Connection, st: dict[str, Any] | None = None) -> dict[str, Any]:
    st = st or load_settings(conn)
    enabled = st["enabled"]
    return {
        "enabled": enabled,
        "mode": st["mode"],
        "interval_s": st["interval_s"],
        "distance_filter_m": st["distance_filter_m"],
        "notice_version": st["notice_version"],
        "notice_text": st["notice_text"],
        "sites": st["sites"] if enabled else [],
        "sensors": {
            "allowed": st["sensors_allowed"] if enabled else [],  # the second gate: a switched-off installation allows nothing
            "intervals_s": st["intervals_s"],
            "catalog": [{"key": k, **v} for k, v in SENSORS.items()],
        },
        "beacons": st["beacons"] if enabled else [],
        "wifi_sites": st["wifi_sites"] if enabled else [],
        "required_sensors": {"enabled": bool(st["required_sensors"]["enabled"] and enabled), "sensors": st["required_sensors"]["sensors"]},
    }


def ack_notice(conn: sqlite3.Connection, device: sqlite3.Row, version: Any) -> dict[str, Any]:
    st = load_settings(conn)
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise PresenceError(400, "invalid_notice_version", "גרסת ההודעה אינה תקינה.", details={"field": "notice_version"})
    if version != st["notice_version"]:
        raise PresenceError(409, "notice_version_stale", "ההודעה לעובדים התעדכנה. יש להציג את הגרסה החדשה.", details={"notice_version": st["notice_version"]})
    conn.execute("UPDATE mobile_devices SET notice_ack_version = ?, notice_ack_at = ?, last_seen_at = ? WHERE id = ?", (version, now_iso(), now_iso(), device["id"]))
    return {"ok": True, "notice_version": version}


# ---------------------------------------------------------------- events

def _clean_status(status: dict[str, Any] | None, allowed: list[str]) -> dict[str, Any]:
    status = status if isinstance(status, dict) else {}
    auth = status.get("location_auth")
    sensors_in = status.get("sensors") if isinstance(status.get("sensors"), dict) else {}
    return {
        "location_auth": auth if auth in LOCATION_AUTH else "not_determined",
        "precise": bool(status.get("precise", False)),
        "sharing": bool(status.get("sharing", False)),
        "sensors": {k: ("on" if (sensors_in.get(k) == "on" and k in allowed) else "off") for k in SENSOR_KEYS},
        "reported_at": now_iso(),
    }


def _site_of(st: dict[str, Any], lat: float, lon: float) -> str | None:
    best: tuple[float, str] | None = None
    for s in st["sites"]:
        d = haversine_m(lat, lon, float(s["lat"]), float(s["lon"]))
        if d <= float(s["radius_m"]) and (best is None or d < best[0]):
            best = (d, s["id"])
    return best[1] if best else None


def _validate_event(e: dict[str, Any], st: dict[str, Any]) -> dict[str, Any]:
    cid = str(e.get("client_event_id") or "").strip()
    if not 1 <= len(cid) <= 64:
        raise PresenceError(400, "invalid_event", "client_event_id חסר או לא תקין.", details={"field": "client_event_id"})
    typ = e.get("type")
    if typ not in EVENT_TYPES:
        raise PresenceError(400, "invalid_event", "סוג אירוע לא מוכר.", details={"field": "type", "client_event_id": cid})
    at = _parse(e.get("at")) if isinstance(e.get("at"), str) else None
    if at is None:
        raise PresenceError(400, "invalid_event", "חותמת זמן חסרה או לא תקינה (ISO-8601 UTC).", details={"field": "at", "client_event_id": cid})
    out: dict[str, Any] = {"client_event_id": cid, "type": typ, "at": iso(at), "site_id": None, "lat": None, "lon": None, "accuracy_m": None, "value": None, "sensor": None,
                           "source": e.get("source") if e.get("source") in SOURCES else None}
    if typ == "sensor":
        sensor = e.get("sensor")
        if sensor not in SENSORS or sensor not in st["sensors_allowed"]:
            raise PresenceError(400, "sensor_not_allowed", "החיישן הזה אינו מאושר בשרת.", details={"sensor": sensor if isinstance(sensor, str) else None, "client_event_id": cid})
        value = e.get("value")
        if not isinstance(value, dict) or len(value) > 20 or any(not isinstance(k, str) or not (v is None or isinstance(v, (str, int, float, bool))) or (isinstance(v, str) and len(v) > 128) for k, v in value.items()):
            raise PresenceError(400, "invalid_event", "ערך החיישן: אובייקט שטוח של עד 20 מפתחות.", details={"field": "value", "client_event_id": cid})
        if len(json.dumps(value, ensure_ascii=False)) > VALUE_MAX_BYTES:
            raise PresenceError(400, "invalid_event", "ערך החיישן גדול מדי.", details={"field": "value", "client_event_id": cid})
        out["sensor"], out["value"] = sensor, value
        return out
    # fix / enter / exit: location events need the location sensor allowed
    if "location" not in st["sensors_allowed"]:
        raise PresenceError(400, "sensor_not_allowed", "החיישן הזה אינו מאושר בשרת.", details={"sensor": "location", "client_event_id": cid})
    try:
        lat, lon = float(e["lat"]), float(e["lon"])
        acc = float(e.get("accuracy_m", 0) or 0)
        if not (-90 <= lat <= 90 and -180 <= lon <= 180 and 0 <= acc <= 100000) or math.isnan(lat) or math.isnan(lon):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        if typ != "fix" and e.get("lat") is None:  # an enter / exit from a region monitor may carry no coordinate
            lat = lon = acc = None  # type: ignore[assignment]
        else:
            raise PresenceError(400, "invalid_event", "קואורדינטה לא תקינה.", details={"field": "lat/lon", "client_event_id": cid}) from None
    site_id = e.get("site_id")
    site_id = str(site_id)[:64] if isinstance(site_id, str) and site_id else None
    out.update({"lat": lat, "lon": lon, "accuracy_m": acc, "site_id": site_id})
    return out


def ingest(conn: sqlite3.Connection, device: sqlite3.Row, events: list[dict[str, Any]], status: dict[str, Any] | None) -> dict[str, Any]:
    """Store a batch (idempotent per client_event_id), update the device's reported status and its current presence state.
    Refused as a whole when the installation is off (`presence_disabled`), the notice was not acknowledged for its current
    version (`notice_ack_required`), the batch is too big, or an event is invalid / names a sensor that is not allowed."""
    st = load_settings(conn)
    if not isinstance(events, list) or len(events) > BATCH_MAX:
        raise PresenceError(400, "batch_too_large", f"עד {BATCH_MAX} אירועים בבקשה.", details={"max": BATCH_MAX})
    if not take("events", device["id"], RATE_EVENTS):
        raise PresenceError(429, "rate_limited", "יותר מדי דיווחים. נסו שוב בעוד דקה.", retryable=True, details={"retry_after_s": 60})
    if status is not None:  # the status is accepted even when nothing else is (it is how "sharing off" and the permission state arrive)
        conn.execute("UPDATE mobile_devices SET status_json = ? WHERE id = ?", (json.dumps(_clean_status(status, st["sensors_allowed"]), ensure_ascii=False), device["id"]))
    if not st["enabled"]:
        if events:
            raise PresenceError(409, "presence_disabled", "שיתוף הנתונים כבוי בהגדרות המערכת.")
        touch(conn, device["id"])
        return {"accepted": 0, "duplicates": 0, "inside": None, "site_id": None, "notice_version": st["notice_version"]}
    if events and device["notice_ack_version"] < st["notice_version"]:
        raise PresenceError(409, "notice_ack_required", "יש לאשר את ההודעה לעובדים לפני שליחת נתונים.", details={"notice_version": st["notice_version"]})
    cleaned = [_validate_event(e if isinstance(e, dict) else {}, st) for e in events]
    now = now_iso()
    accepted = duplicates = 0
    presence = _json(device["presence_json"], {})
    newest_at = presence.get("at") or ""
    for ev in sorted(cleaned, key=lambda x: x["at"]):
        cur = conn.execute(
            "INSERT OR IGNORE INTO mobile_presence_events(device_id, user_id, client_event_id, type, sensor, site_id, lat, lon, accuracy_m, value_json, source, at, received_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (device["id"], device["user_id"], ev["client_event_id"], ev["type"], ev["sensor"], ev["site_id"], ev["lat"], ev["lon"], ev["accuracy_m"],
             json.dumps(ev["value"], ensure_ascii=False) if ev["value"] is not None else None, ev["source"], ev["at"], now),
        )
        if cur.rowcount == 0:
            duplicates += 1
            continue
        accepted += 1
        if ev["type"] == "sensor" or ev["at"] < newest_at:
            continue  # the current state follows the newest location event only
        newest_at = ev["at"]
        if ev["type"] == "fix":
            site = ev["site_id"] or (_site_of(st, ev["lat"], ev["lon"]) if ev["lat"] is not None else None)
            inside = (site is not None) if st["sites"] else None  # no geofences: inside is unknown from a fix alone
            presence = {"inside": inside, "site_id": site, "at": ev["at"], "lat": ev["lat"], "lon": ev["lon"], "accuracy_m": ev["accuracy_m"], "source": ev["source"], "updated_at": now}
        else:
            presence = {"inside": ev["type"] == "enter", "site_id": ev["site_id"], "at": ev["at"], "lat": ev["lat"], "lon": ev["lon"], "accuracy_m": ev["accuracy_m"], "source": ev["source"] or "region", "updated_at": now}
    conn.execute("UPDATE mobile_devices SET presence_json = ?, last_seen_at = ?, last_event_at = CASE WHEN ? > 0 THEN ? ELSE last_event_at END WHERE id = ?",
                 (json.dumps(presence), now, accepted, now, device["id"]))
    return {"accepted": accepted, "duplicates": duplicates, "inside": presence.get("inside"), "site_id": presence.get("site_id"), "notice_version": st["notice_version"]}


def state_of(conn: sqlite3.Connection, device_id: str) -> dict[str, Any]:
    r = get_device(conn, device_id)
    return {"device_id": device_id, "presence": _json(r["presence_json"], {}) if r else {}, "status": _device_out(r)["status"] if r else {}, "last_event_at": r["last_event_at"] if r else None}


# ---------------------------------------------------------------- the required-sensors policy (the gate)

GATE_ALLOWED_PATHS = ("/me", "/presence/", "/notifications/devices", "/notifications/app/", "/notifications/categories", "/auth/", "/health", "/csp-report", "/.well-known/")


def _user_roles(conn: sqlite3.Connection, user_id: str) -> set[str]:
    rows = conn.execute(
        """SELECT role_id FROM bindings WHERE revoked_at IS NULL AND effect = 'allow' AND (expires_at IS NULL OR expires_at > ?)
           AND ((subject_kind = 'user' AND subject_id = ?) OR (subject_kind = 'group' AND subject_id IN (SELECT group_id FROM group_members WHERE user_id = ?)))""",
        (now_iso(), user_id, user_id),
    ).fetchall()
    return {r[0] for r in rows}


def gate_for(conn: sqlite3.Connection, user_id: str, *, app: bool, st: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """What the required-sensors policy says about this user right now, or None when it does not apply to them at all.
    `blocked` is the one field the shell and the enforcement act on; the rest is the reason an administrator (and the
    user) sees. Never raises."""
    st = st or load_settings(conn)
    pol = st["required_sensors"]
    if not pol["enabled"] or not pol["sensors"]:
        return None
    base = {"required": pol["sensors"], "missing": [], "blocked": False, "applies": True, "channel": "app" if app else "web", "break_glass_until": st["break_glass"]["until"], "reason": None}
    if not st["enabled"]:
        return {**base, "applies": False, "reason": "presence_disabled"}  # nothing can be reported, so nothing is required
    if user_id in pol["exempt_users"] or is_system_admin(conn, user_id):
        return {**base, "applies": False, "reason": "exempt"}
    if pol["roles"] or pol["users"]:
        if user_id not in pol["users"] and not (_user_roles(conn, user_id) & set(pol["roles"])):
            return {**base, "applies": False, "reason": "not_in_scope"}
    if not app and not pol["apply_to_web"]:
        return {**base, "applies": False, "reason": "web_not_covered"}
    satisfied: set[str] = set()
    cutoff = now_utc() - dt.timedelta(hours=pol["max_stale_hours"])
    for r in conn.execute("SELECT * FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL", (user_id,)).fetchall():
        status = _json(r["status_json"], {})
        reported = _parse(status.get("reported_at")) or _parse(r["last_seen_at"])
        if reported is None or reported < cutoff or r["notice_ack_version"] < st["notice_version"]:
            continue
        sensors = status.get("sensors") if isinstance(status.get("sensors"), dict) else {}
        for key in pol["sensors"]:
            if sensors.get(key) != "on" or key not in st["sensors_allowed"]:
                continue
            if key == "location" and not (status.get("sharing") and status.get("location_auth") in ("always", "when_in_use")):
                continue
            satisfied.add(key)
    missing = [s for s in pol["sensors"] if s not in satisfied]
    if st["break_glass"]["until"]:
        return {**base, "missing": missing, "blocked": False, "reason": "break_glass"}
    return {**base, "missing": missing, "blocked": bool(missing), "reason": "missing_sensors" if missing else None}


def enforce(conn: sqlite3.Connection, principal: Principal, path: str, user_agent: str | None, request_id: str | None = None) -> None:
    """The server-side half of the policy, called by auth._principal on every authenticated request: refuse (403
    `presence_required`) a request of a blocked user, except on the paths the app needs to get out of that state (its
    own registration and reports, /me, sign-in). One audit row per user per GATE_AUDIT_EVERY_S."""
    if any(seg in path for seg in GATE_ALLOWED_PATHS):
        return
    app = is_app_user_agent(user_agent)
    if get_setting(conn, "presence.required_sensors") is None:  # the policy was never written: the common case, one cheap read
        return
    gate = gate_for(conn, principal.user_id, app=app)
    if gate is None or not gate["blocked"]:
        return
    now = time.monotonic()
    with _LOCK:
        last = _GATE_AUDITED.get(principal.user_id, 0.0)
        audit_now = now - last >= GATE_AUDIT_EVERY_S
        if audit_now:
            _GATE_AUDITED[principal.user_id] = now
    if audit_now:
        from ..audit import audit

        audit(conn, actor=principal, action="presence.gate.refused", decision="denied", resource_type="user", resource_id=principal.user_id, reason="missing_sensors",
              request_id=request_id, details={"missing": gate["missing"], "channel": gate["channel"]})
    raise PresenceError(403, "presence_required", "כדי להשתמש במערכת מהאפליקציה יש להפעיל את שיתוף הנתונים הנדרש: " + ", ".join(SENSORS[s]["name_he"] for s in gate["missing"]),
                        details={"required": gate["required"], "missing": gate["missing"], "channel": gate["channel"]})


# ---------------------------------------------------------------- retention

def janitor(db: Database) -> dict[str, int]:
    """Prune the event log past `presence.retention_days`, expired app push messages, and revoked device rows past REVOKED_KEEP_DAYS."""
    with db.connection(label="presence.janitor") as conn:
        st = load_settings(conn)
        now = now_utc()
        events = conn.execute("DELETE FROM mobile_presence_events WHERE at < ?", (iso(now - dt.timedelta(days=st["retention_days"])),)).rowcount
        messages = conn.execute("DELETE FROM mobile_push_messages WHERE expires_at < ?", (iso(now - dt.timedelta(days=1)),)).rowcount
        devices = conn.execute("DELETE FROM mobile_devices WHERE revoked_at IS NOT NULL AND revoked_at < ?", (iso(now - dt.timedelta(days=REVOKED_KEEP_DAYS)),)).rowcount
    return {"events": events, "messages": messages, "devices": devices}
