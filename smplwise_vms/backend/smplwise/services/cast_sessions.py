"""CR-028 phase 1: cast ONE camera to a media screen through Google Cast (docs/changes/CR-028-CAST-TO-SCREENS.md section 12).

The chain: a user presses "שדר למסך" (locally or through /arx) -> this module checks everything and opens a session ->
the bridge (0.7.0, `smplwise_bridge.cast_stream`) asks Home Assistant to `play_media` the relay URL on the Cast entity as that
user -> the TV pulls the HLS from the add-on's relay (services/cast_relay.py) on the LAN. Nothing here touches the recorder;
the only go2rtc write is the camera's own `smplwise_` stream, created exactly as the live screen creates it.

Rules (owner decisions 2026-10-05, private/planning/CAST_UX_OWNER_DECISIONS_2026-10-05.md):
- `media.cast` at the screen's anchor (who may cast), `video.live` on the camera, the screen approved, and the administrator's
  per-screen switch ON (`media_devices.cast_json.allow`, default OFF); `media.public` on a public screen;
- the method: the detected capability (media_model.cast_capability) unless the administrator pinned one; phase 1 casts only
  `cast_hls` through a `cast` media_player, never to an "unknown" confidence;
- sub stream by default; main only when allowed (installation or screen) AND the encoding registry says H.264;
- 30 minutes by default (installation `minutes`, or the screen's own), up to 8 extensions; a PERMANENT cast only on a screen the
  administrator marked permanent; the administrator's test cast lasts 60 s;
- one cast per screen (a new start replaces the old one), `max_sessions` casts installation-wide (their own quota: the remote
  user's live-stream cap is not touched - the playback runs on the LAN);
- stop: by the user, by anyone holding media.cast / media.bulk at the anchor, by the administrator, by the timer, when the
  screen disappears (no command then), or when the relay sees abuse; ONE `stop`, never retried; the token dies first;
- after the stop the screen is switched off again ONLY when it was off before the cast and the installation option is on
  (default on); the user may cancel that at start or at stop;
- "playing" is set only when the relay served the first segment to the TV; 15 s without it is "not confirmed".

Audit: media.cast.start / extend / switch / stop / denied / config / screen / test / power_off - never the token, the URL or the
origin's address."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import ipaddress
import json
import logging
import secrets
import sqlite3
import threading
import time
import uuid
from typing import Any
from urllib.parse import urlsplit

from ..audit import audit
from ..config import Settings
from ..db import get_setting, now_iso, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from . import cast_relay, ha_bridge, ha_client, media_model as mm, media_store as store

log = logging.getLogger("smplwise.cast")

PERM_CAST = "media.cast"
CONFIGURE = "system.configure"
BRIDGE_CAST_REQUIRED = "0.7.0"
MAX_EXTENSIONS = 8
TEST_SECONDS = 60
NOT_CONFIRMED_S = 15
START_GAP_S = 5.0
TARGET_KINDS = ("screen", "player", "speaker")
METHODS = ("auto", "cast_hls", "none")
BLOCKED_DISPLAY = ("grey_reason", "hide", "grey_admin")
STOP_REASONS = ("user", "timeout", "replaced", "target_gone", "error", "admin", "refused")

K_ENABLED, K_ORIGIN, K_VERIFIED = "multimedia.cast.enabled", "multimedia.cast.origin", "multimedia.cast.origin_verified_at"
K_MAX, K_MINUTES, K_MAIN = "multimedia.cast.max_sessions", "multimedia.cast.minutes", "multimedia.cast.allow_main"
K_POWER_OFF, K_BLOCKED, K_SECRET = "multimedia.cast.power_off_after", "multimedia.cast.blocked_display", "multimedia.cast.secret"
DEFAULTS = {K_ENABLED: "false", K_ORIGIN: "", K_MAX: "2", K_MINUTES: "30", K_MAIN: "false", K_POWER_OFF: "true", K_BLOCKED: "grey_reason"}

MESSAGES = {
    "cast_unavailable": "השידור למסכים כבוי או לא הוגדר.",
    "forbidden": "אין הרשאה לשדר למסך הזה.",
    "cast_not_allowed": "המנהל לא איפשר שידור למסך הזה.",
    "cast_unsupported": "המסך הזה לא יכול לקבל שידור.",
    "unavailable": "המסך לא זמין.",
    "cast_busy": "המסך עסוק: מנגן מוזיקה.",
    "cast_limit": "נגמרה מכסת השידורים ({n}).",
    "main_not_supported": "הזרם הראשי אינו נתמך במסך הזה.",
    "bridge_outdated": "השידור לא זמין: נדרש עדכון של רכיב החיבור.",
    "bridge_not_paired": "רכיב החיבור לא צומד.",
    "rate_limited": "רגע, השידור הקודם למסך הזה עוד מתחיל.",
    "not_found": "השידור לא נמצא.",
    "screen_not_found": "המסך לא נמצא.",
    "extend_limit": "אי אפשר להאריך יותר: התחילו שידור חדש.",
    "not_extendable": "את השידור הזה אי אפשר להאריך.",
    "permanent_not_allowed": "המנהל לא סימן את המסך הזה לשידור קבוע.",
    "stopped": "השידור כבר הסתיים.",
    "public_screen": "זה מסך ציבורי: נדרשת הרשאה נוספת.",
    "identity_unmapped": "אי אפשר לשדר בשם משתמש שאינו משתמש של תשתית המערכת.",
    "validation": "הבקשה אינה תקינה.",
}

_lock = threading.Lock()
_last_start: dict[str, float] = {}
_DB: list[Any] = []  # the Database the relay callbacks write through (attach)
_SETTINGS: list[Settings] = []


def err(status: int, code: str, **details: Any) -> ApiError:
    msg = MESSAGES.get(code, MESSAGES["validation"])
    if code == "cast_limit":
        msg = msg.format(n=details.get("max", "?"))
    return ApiError(status, code, msg, details=details or None)


def now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)  # tests move the clock here


def _iso(t: dt.datetime | None) -> str | None:
    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z") if t else None


def _parse(text: str | None) -> dt.datetime | None:
    if not text:
        return None
    try:
        t = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


# ------------------------------------------------------------------------------------------------ configuration


def config(conn: sqlite3.Connection) -> dict[str, Any]:
    g = lambda k: get_setting(conn, k, DEFAULTS.get(k)) or DEFAULTS.get(k, "")  # noqa: E731

    def num(k: str, lo: int, hi: int) -> int:
        try:
            return min(hi, max(lo, int(g(k))))
        except ValueError:
            return int(DEFAULTS[k])

    blocked = g(K_BLOCKED)
    return {"enabled": g(K_ENABLED) == "true", "origin": g(K_ORIGIN) or None, "origin_verified_at": get_setting(conn, K_VERIFIED) or None,
            "max_sessions": num(K_MAX, 1, 8), "minutes": num(K_MINUTES, 5, 240), "allow_main": g(K_MAIN) == "true",
            "power_off_after": g(K_POWER_OFF) == "true", "blocked_display": blocked if blocked in BLOCKED_DISPLAY else "grey_reason",
            "max_extensions": MAX_EXTENSIONS, "test_seconds": TEST_SECONDS}


def origin_problem(value: Any, *, in_addon: bool = True) -> str | None:
    """None when `value` is an acceptable cast origin: `http://<IP literal>:<port>` of a private (LAN) address, nothing else (no
    path, query, credentials; a name is refused: a TV may not resolve it, and the bridge compares the host with its own addresses).
    Loopback only outside the add-on (a test backend)."""
    if not isinstance(value, str) or len(value) > 80:
        return "origin_invalid"
    try:
        p = urlsplit(value)
        port = p.port
    except ValueError:
        return "origin_invalid"
    if p.scheme != "http" or p.username or p.password or p.path not in ("", "/") or p.query or p.fragment or not p.hostname or port is None:
        return "origin_invalid"
    try:
        ip = ipaddress.ip_address(p.hostname)
    except ValueError:
        return "origin_not_ip"
    if ip.is_unspecified or ip.is_multicast or ip.is_link_local or not ip.is_private or (ip.is_loopback and in_addon):
        return "origin_not_lan"
    return None


def normal_origin(value: str) -> str:
    p = urlsplit(value)
    host = p.hostname or ""
    return f"http://{('[' + host + ']') if ':' in host else host}:{p.port}"


def update_config(conn: sqlite3.Connection, settings: Settings, body: dict[str, Any]) -> list[str]:
    """PUT config (system.configure): every key optional; returns the changed keys. A new origin is unverified until checked."""
    allowed = {"enabled", "origin", "max_sessions", "minutes", "allow_main", "power_off_after", "blocked_display"}
    if not isinstance(body, dict) or set(body) - allowed:
        raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": sorted(set(body) - allowed) if isinstance(body, dict) else ["body"]})
    cur = config(conn)
    changed: list[str] = []

    def put(key: str, name: str, value: str) -> None:
        if (get_setting(conn, key, DEFAULTS.get(key)) or "") != value:
            set_setting(conn, key, value)
            changed.append(name)

    for name, key in (("enabled", K_ENABLED), ("allow_main", K_MAIN), ("power_off_after", K_POWER_OFF)):
        if name in body:
            if not isinstance(body[name], bool):
                raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": [name]})
            put(key, name, "true" if body[name] else "false")
    for name, key, lo, hi in (("max_sessions", K_MAX, 1, 8), ("minutes", K_MINUTES, 5, 240)):
        if name in body:
            v = body[name]
            if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
                raise ApiError(422, "validation", f"{name}: {lo} עד {hi}.", details={"fields": [name]})
            put(key, name, str(v))
    if "blocked_display" in body:
        if body["blocked_display"] not in BLOCKED_DISPLAY:
            raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": ["blocked_display"]})
        put(K_BLOCKED, "blocked_display", body["blocked_display"])
    if "origin" in body:
        v = body["origin"]
        if v in (None, ""):
            new = ""
        else:
            problem = origin_problem(v, in_addon=settings.in_addon)
            if problem:
                raise ApiError(422, problem, "כתובת הממסר: http://<כתובת IP ברשת המקומית>:<פורט>.", details={"fields": ["origin"]})
            new = normal_origin(v)
        if new != (cur["origin"] or ""):
            set_setting(conn, K_ORIGIN, new)
            set_setting(conn, K_VERIFIED, "")
            changed.append("origin")
    return changed


def relay_status(settings: Settings) -> dict[str, Any]:
    srv = cast_relay.SERVER
    return {"option": bool(getattr(settings, "cast_relay", False)), "listening": srv.running, "container_port": cast_relay.CONTAINER_PORT, "error": srv.error}


def readiness(conn: sqlite3.Connection, settings: Settings) -> tuple[bool, str | None]:
    """(ready, the first reason it is not): relay_off (the add-on option / the listener), disabled, origin_missing, origin_unverified."""
    rs = relay_status(settings)
    cfg = config(conn)
    if not rs["option"] or not rs["listening"]:
        return False, "relay_off"
    if not cfg["enabled"]:
        return False, "disabled"
    if not cfg["origin"]:
        return False, "origin_missing"
    if not cfg["origin_verified_at"]:
        return False, "origin_unverified"
    return True, None


def announced_origin(conn: sqlite3.Connection, settings: Settings) -> str | None:
    """The origin the bridge may let a TV fetch from (sent signed with every user-directory answer); None while casting is not ready."""
    ok, _ = readiness(conn, settings)
    return config(conn)["origin"] if ok else None


PROBE_GET: list[Any] = []  # tests replace the self-fetch


def _probe_get(url: str) -> int:
    if PROBE_GET:
        return PROBE_GET[0](url)
    import httpx

    with httpx.Client(timeout=3.0, follow_redirects=False) as c:
        return c.get(url).status_code


def check_origin(conn: sqlite3.Connection, settings: Settings) -> dict[str, Any]:
    """The administrator's "בדוק": the add-on fetches a one-use probe from its own origin - proof that the host port mapping and
    the address lead back to this relay. Nothing is sent to any other device."""
    cfg = config(conn)
    rs = relay_status(settings)
    if not rs["option"] or not rs["listening"]:
        return {"ok": False, "reason": "relay_off"}
    if not cfg["origin"]:
        return {"ok": False, "reason": "origin_missing"}
    token = cast_relay.new_probe()
    try:
        with unlocked(conn):
            status = _probe_get(f"{cfg['origin']}/cast/probe/{token}")
    except Exception as exc:  # noqa: BLE001 - any failure is "not reachable"; its text (the address) is not returned
        return {"ok": False, "reason": "unreachable", "error": type(exc).__name__}
    if status != 204:
        return {"ok": False, "reason": "not_this_relay", "status": status}
    set_setting(conn, K_VERIFIED, now_iso())
    return {"ok": True, "reason": None}


def _secret(conn: sqlite3.Connection) -> bytes:
    s = get_setting(conn, K_SECRET)
    if not s:
        s = secrets.token_hex(32)
        set_setting(conn, K_SECRET, s)
    return bytes.fromhex(s)


def token_for(secret: bytes, session_id: str, gen: int) -> str:
    """HMAC-SHA256(installation cast secret, "session|gen"), 32 hex: recomputable by the server, never stored, never logged."""
    return hmac.new(secret, f"cast|{session_id}|{gen}".encode(), hashlib.sha256).hexdigest()[:32]


def _epoch(text: str | None) -> float | None:
    t = _parse(text)
    return t.timestamp() if t else None


# ------------------------------------------------------------------------------------------------ the per-screen settings and the target


def screen_cast(row: dict[str, Any]) -> dict[str, Any]:
    """`media_devices.cast_json` with its defaults: casting OFF until the administrator turns it on (owner decision 2026-10-05)."""
    raw: Any = None
    try:
        raw = json.loads(row.get("cast_json") or "null")
    except ValueError:
        raw = None
    raw = raw if isinstance(raw, dict) else {}
    minutes = raw.get("minutes")
    return {"allow": raw.get("allow") is True, "method": raw.get("method") if raw.get("method") in METHODS else "auto",
            "minutes": minutes if isinstance(minutes, int) and not isinstance(minutes, bool) and 5 <= minutes <= 240 else None,
            "permanent": raw.get("permanent") is True, "allow_main": raw.get("allow_main") if isinstance(raw.get("allow_main"), bool) else None}


def update_screen(conn: sqlite3.Connection, key: str, body: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    row = conn.execute("SELECT * FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()
    if row is None or row["kind"] not in TARGET_KINDS:
        raise ApiError(404, "not_found", MESSAGES["screen_not_found"])
    allowed = {"allow", "method", "minutes", "permanent", "allow_main"}
    if not isinstance(body, dict) or set(body) - allowed:
        raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": sorted(set(body) - allowed) if isinstance(body, dict) else ["body"]})
    cur = screen_cast(dict(row))
    new = dict(cur)
    for name in ("allow", "permanent"):
        if name in body:
            if not isinstance(body[name], bool):
                raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": [name]})
            new[name] = body[name]
    if "method" in body:
        if body["method"] not in METHODS:
            raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": ["method"]})
        new["method"] = body["method"]
    if "minutes" in body:
        v = body["minutes"]
        if v is not None and (isinstance(v, bool) or not isinstance(v, int) or not 5 <= v <= 240):
            raise ApiError(422, "validation", "minutes: 5 עד 240, או ריק לברירת המחדל.", details={"fields": ["minutes"]})
        new["minutes"] = v
    if "allow_main" in body:
        v = body["allow_main"]
        if v is not None and not isinstance(v, bool):
            raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": ["allow_main"]})
        new["allow_main"] = v
    changed = sorted(k for k in new if new[k] != cur[k])
    if changed:
        conn.execute("UPDATE media_devices SET cast_json = ?, updated_at = ? WHERE device_key = ?", (json.dumps(new, separators=(",", ":")), now_iso(), key))
    return new, changed


def _cast_endpoint(item: store.Item) -> str | None:
    """The Cast media_player of the device (the one the capability names, else the first non-mirror Cast endpoint)."""
    casts = [e for e in item.model.endpoints if e.domain == "media_player" and (e.platform or "") == "cast" and e.role != "mirror"]
    return casts[0].ref if casts else None


def capability(item: store.Item, cat: store.Catalog, meta: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """The detected capability with the administrator's override applied, and the Cast entity a cast would play on."""
    cap = dict(mm.cast_capability(item.model, cat.ents, meta, item.profile))
    sc = screen_cast(item.row)
    if sc["method"] != "auto":
        cap = {**cap, "method": sc["method"], "confidence": "manual", "reason": "manual"}
    via = cap.get("via") or ""
    target = via[len(store.ENDPOINT_PREFIX):] if via.startswith(store.ENDPOINT_PREFIX) else None
    if target is None or (cat.ents.get(target) or {}).get("platform") not in (None, "cast") or target not in {e.ref for e in item.model.endpoints if (e.platform or "") == "cast"}:
        target = _cast_endpoint(item)
    cap["target_entity_id"] = target if cap["method"] == "cast_hls" else None
    return cap


def _access(conn: sqlite3.Connection, principal: Principal) -> store.Access:
    return store.Access(conn, principal, store.ALL_PERMS + (PERM_CAST,))


def _meta(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    return {d["device_id"]: {"manufacturer": d.get("manufacturer"), "model": d.get("model")} for d in store._load_ha_devices(conn)}


def _catalog(conn: sqlite3.Connection) -> store.Catalog:
    return store.load_catalog(conn, kind=TARGET_KINDS)


def _open_sessions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM cast_sessions WHERE stopped_at IS NULL ORDER BY started_at").fetchall()


def _busy(cat: store.Catalog, item: store.Item, target: str | None, open_by_key: dict[str, sqlite3.Row]) -> str:
    """free | casting | playing_music | off | unavailable (the picker's state of a screen)."""
    if item.key in open_by_key:
        return "casting"
    e = cat.ents.get(target or "") or {}
    if not mm.available(e):
        return "unavailable"
    attrs = e.get("attributes") or {}
    ctype = str(attrs.get("media_content_type") or "").lower()
    if e.get("state") in ("playing", "paused", "buffering") and (ctype.startswith("music") or ctype.startswith("audio")):
        return "playing_music"
    if e.get("state") == "off" or store.live_of(cat, item, key_url=False).get("power") in ("off", "standby"):
        return "off"
    return "free"


def _was_off(cat: store.Catalog, item: store.Item, target: str) -> bool:
    e = cat.ents.get(target) or {}
    return e.get("state") == "off" or store.live_of(cat, item, key_url=False).get("power") in ("off", "standby")


# ------------------------------------------------------------------------------------------------ cameras


def _camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if cam is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not cam["enabled"]:
        raise ApiError(409, "camera_disabled", "המצלמה מושבתת במערכת.")
    return cam


def _camera_name(cam: sqlite3.Row) -> str:
    from .stream_codecs import camera_name

    return camera_name(cam)


def _main_ok(conn: sqlite3.Connection, cam: sqlite3.Row, item: store.Item) -> bool:
    from .stream_codecs import encoding_of

    sc = screen_cast(item.row)
    allowed = sc["allow_main"] if sc["allow_main"] is not None else config(conn)["allow_main"]
    main = (encoding_of(cam) or {}).get("main") or {}
    return bool(allowed) and main.get("codec") == "H.264"


def ensure_stream(settings: Settings, cam: sqlite3.Row, profile: str) -> str:
    """The camera's own `smplwise_` stream in go2rtc, created exactly as the live screen creates it (routers/media.py); tests replace it."""
    if not settings.go2rtc_url:
        raise ApiError(409, "capability_unavailable", "go2rtc לא הוגדר: אין וידאו חי לשדר.")
    from ..routers.media import ensure_camera_stream

    name = ensure_camera_stream(settings, cam, profile)
    if not name.startswith(cast_relay.STREAM_PREFIX):
        raise ApiError(500, "stream_namespace", "זרם מחוץ למרחב השמות.")
    return name


# ------------------------------------------------------------------------------------------------ the bridge


def bridge_ready(conn: sqlite3.Connection) -> tuple[bool, str | None]:
    b = store.bridge_state(conn)
    if not b["paired"]:
        return False, "bridge_not_paired"
    if store.version_tuple(b["version"]) < store.version_tuple(BRIDGE_CAST_REQUIRED):
        return False, "bridge_outdated"
    return True, None


def _bridge(conn: sqlite3.Connection, settings: Settings, user_id: str, op: str, entity_id: str, *, url: str | None = None, title: str | None = None) -> tuple[bool, str | None, str]:
    """ONE signed cast_stream call (never retried). (ok, error code, request id). Raises ApiError when Home Assistant is unreachable."""
    request_id = uuid.uuid4().hex[:12]
    body: dict[str, Any] = {"user_id": user_id, "op": op, "entity_id": entity_id, "request_id": request_id}
    if url is not None:
        body["url"] = url
    if title:
        body["title"] = title
    payload = ha_bridge.sign(ha_bridge.signing_key(conn) or "", body)
    with unlocked(conn):
        result = ha_client.call_bridge_cast_stream(settings, payload)
    ok = bool(result.get("ok"))
    return ok, None if ok else str(result.get("error") or "refused")[:64], request_id


def _publish(reason: str) -> None:
    """The open clients refetch GET sessions (no session id, screen or camera in the frame: it reaches every socket)."""
    try:
        from . import ha_sync

        ha_sync.publish({"type": "cast_sessions_changed", "reason": reason})
    except Exception:  # noqa: BLE001
        pass


def _title(cam: sqlite3.Row) -> str:
    name = _camera_name(cam)
    clean = "".join(ch for ch in name if ch.isprintable())[:80]
    return clean or "Arx"


# ------------------------------------------------------------------------------------------------ views


def _can_manage(access: store.Access, principal: Principal, row: sqlite3.Row, anchor: str | None, conn: sqlite3.Connection) -> dict[str, bool]:
    mine = row["started_by"] == principal.user_id
    admin = authorize(conn, principal, CONFIGURE, INSTALLATION).allowed
    cast_here = access.has(PERM_CAST, anchor)
    open_ = row["stopped_at"] is None
    extendable = open_ and row["kind"] == "camera" and row["expires_at"] is not None and row["extended_n"] < MAX_EXTENSIONS
    return {"stop": open_ and (mine or cast_here or access.has(store.PERM_BULK, anchor) or admin),
            "extend": extendable and (mine or cast_here), "switch": open_ and row["kind"] == "camera" and (mine or cast_here)}


def _state(row: sqlite3.Row, at: dt.datetime | None = None) -> str:
    if row["stopped_at"]:
        return "stopped"
    if row["first_segment_at"]:
        return "playing"
    started = _parse(row["started_at"]) or now()
    return "not_confirmed" if ((at or now()) - started).total_seconds() >= NOT_CONFIRMED_S else "starting"


def view(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, cat: store.Catalog | None = None, access: store.Access | None = None) -> dict[str, Any]:
    from .access import camera_allowed

    cat = cat or _catalog(conn)
    access = access or _access(conn, principal)
    item = cat.items.get(row["device_key"])
    anchor = item.row.get("anchor_entity_id") if item else None
    fa = store.floor_area(item) if item else {"floor_name": None, "area_name": None, "floor_id": None, "area_id": None}
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (row["camera_id"],)).fetchone()
    cam_name = _camera_name(cam) if cam is not None and camera_allowed(conn, principal, row["camera_id"], "video.live") else None
    restore = json.loads(row["restore_json"] or "{}")
    exp = row["expires_at"]
    return {"session_id": row["session_id"], "device_key": row["device_key"], "screen_name": item.name if item else None, "floor_name": fa["floor_name"], "area_name": fa["area_name"],
            "kind": row["kind"], "camera_id": row["camera_id"], "camera_name": cam_name, "profile": row["profile"], "state": _state(row),
            "started_at": row["started_at"], "expires_at": exp, "permanent": exp is None, "extended_n": row["extended_n"],
            "extensions_left": 0 if exp is None or row["kind"] != "camera" else max(0, MAX_EXTENSIONS - row["extended_n"]),
            "first_segment_at": row["first_segment_at"], "started_by_name": row["started_by_name"], "mine": row["started_by"] == principal.user_id,
            "channel": row["channel"], "stopped_at": row["stopped_at"], "stop_reason": row["stop_reason"],
            "power_off_after": bool(restore.get("power_off_after")), "power_off_state": row["power_off_state"],
            "can": _can_manage(access, principal, row, anchor, conn)}


def _visible(access: store.Access, principal: Principal, row: sqlite3.Row, cat: store.Catalog, conn: sqlite3.Connection) -> bool:
    if row["started_by"] == principal.user_id or authorize(conn, principal, CONFIGURE, INSTALLATION).allowed:
        return True
    item = cat.items.get(row["device_key"])
    return item is not None and access.has(store.PERM_READ, item.row.get("anchor_entity_id"))


def list_sessions(conn: sqlite3.Connection, principal: Principal) -> list[dict[str, Any]]:
    cat = _catalog(conn)
    access = _access(conn, principal)
    return [view(conn, principal, r, cat, access) for r in _open_sessions(conn) if _visible(access, principal, r, cat, conn)]


def get_session(conn: sqlite3.Connection, principal: Principal, session_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone()
    cat = _catalog(conn)
    access = _access(conn, principal)
    if row is None or not _visible(access, principal, row, cat, conn):
        raise err(404, "not_found")
    return view(conn, principal, row, cat, access)


# ------------------------------------------------------------------------------------------------ targets ("screens I can cast to")


def targets(conn: sqlite3.Connection, settings: Settings, principal: Principal, camera_id: str | None = None) -> dict[str, Any]:
    """The screens the caller may cast to (with `camera`: cast THIS camera to), each with its state; blocked screens are shown,
    greyed with the reason, hidden, or shown to administrators only - the installation's `blocked_display` (owner decision Q4)."""
    from .access import camera_allowed

    cfg = config(conn)
    ready, why = readiness(conn, settings)
    b_ok, b_why = bridge_ready(conn)
    cam_ok = True
    main_possible = False
    cam = None
    if camera_id is not None:
        cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
        cam_ok = cam is not None and bool(cam["enabled"]) and camera_allowed(conn, principal, camera_id, "video.live")
        if not cam_ok:
            raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    access = _access(conn, principal)
    admin = authorize(conn, principal, CONFIGURE, INSTALLATION).allowed
    cat = _catalog(conn)
    meta = _meta(conn)
    open_by_key = {r["device_key"]: r for r in _open_sessions(conn)}
    out = []
    for item in sorted(cat.items.values(), key=lambda i: (i.name.casefold(), i.key)):
        anchor = item.row.get("anchor_entity_id")
        if item.row["kind"] not in TARGET_KINDS or not item.row["approved"] or not access.has(store.PERM_READ, anchor):
            continue
        cap = capability(item, cat, meta)
        sc = screen_cast(item.row)
        if cap["method"] != "cast_hls":
            continue  # phase 1 is Google Cast only: a speaker, a DLNA / AirPlay / browser candidate or a screen without a path is not a target at all
        blocked = None
        if not access.has(PERM_CAST, anchor):
            blocked = "no_permission"
        elif cap["method"] != "cast_hls" or not cap["target_entity_id"] or cap.get("confidence") == "unknown":
            blocked = "unsupported"
        elif not sc["allow"]:
            blocked = "not_allowed"
        elif item.row["is_public"] and not access.has(store.PERM_PUBLIC, anchor):
            blocked = "public"
        state = _busy(cat, item, cap["target_entity_id"], open_by_key)
        if blocked is None and state == "unavailable":
            blocked = "unavailable"
        if blocked is not None and (cfg["blocked_display"] == "hide" or (cfg["blocked_display"] == "grey_admin" and not admin)):
            continue
        if cam is not None and blocked is None:
            main_possible = main_possible or _main_ok(conn, cam, item)
        fa = store.floor_area(item)
        casting = open_by_key.get(item.key)
        out.append({"key": item.key, "name": item.name, "kind": item.row["kind"], "floor_id": fa["floor_id"], "floor_name": fa["floor_name"], "area_name": fa["area_name"],
                    "state": state, "blocked": blocked, "confidence": cap.get("confidence"), "permanent_allowed": sc["permanent"],
                    "minutes": sc["minutes"] or cfg["minutes"], "main_allowed": bool(cam is not None and _main_ok(conn, cam, item)),
                    "casting_session_id": casting["session_id"] if casting is not None and _visible(access, principal, casting, cat, conn) else None})
    return {"ready": ready and b_ok, "reason": why or b_why, "targets": out, "blocked_display": cfg["blocked_display"], "main_possible": main_possible,
            "max_sessions": cfg["max_sessions"], "active": len(open_by_key)}


def admin_screens(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every screen / player / speaker with its detected capability, the administrator's settings and whether it casts now."""
    cat = store.load_catalog(conn, approved_only=False, kind=TARGET_KINDS)
    meta = _meta(conn)
    open_by_key = {r["device_key"]: r["session_id"] for r in _open_sessions(conn)}
    out = []
    for item in sorted(cat.items.values(), key=lambda i: (i.row["kind"], i.name.casefold(), i.key)):
        cap = capability(item, cat, meta)
        fa = store.floor_area(item)
        out.append({"key": item.key, "name": item.name, "kind": item.row["kind"], "approved": bool(item.row["approved"]), "public": bool(item.row["is_public"]),
                    "floor_name": fa["floor_name"], "area_name": fa["area_name"], "detected": mm.cast_capability(item.model, cat.ents, meta, item.profile),
                    "effective": {k: cap[k] for k in ("method", "confidence", "reason")}, "target_entity_id": cap["target_entity_id"], "settings": screen_cast(item.row),
                    "casting_session_id": open_by_key.get(item.key)})
    return out


# ------------------------------------------------------------------------------------------------ start


def _deny(conn: sqlite3.Connection, principal: Principal, request_id: str | None, key: str, exc: ApiError, **details: Any) -> ApiError:
    audit(conn, actor=principal, action="media.cast.denied", decision="denied", resource_type="media_device", resource_id=key, reason=exc.code, request_id=request_id,
          details={k: v for k, v in details.items() if v is not None} or None)
    return exc


def _expiry(conn: sqlite3.Connection, item: store.Item, kind: str, duration: str) -> str | None:
    if kind == "test":
        return _iso(now() + dt.timedelta(seconds=TEST_SECONDS))
    if duration == "permanent":
        return None
    minutes = screen_cast(item.row)["minutes"] or config(conn)["minutes"]
    return _iso(now() + dt.timedelta(minutes=minutes))


def _url(origin: str, token: str) -> str:
    return f"{origin}/cast/{token}/index.m3u8"


def _index_put(conn: sqlite3.Connection, session_id: str, gen: int, stream: str, expires_at: str | None) -> str:
    token = token_for(_secret(conn), session_id, gen)
    cast_relay.INDEX.put(token, session_id, stream, _epoch(expires_at))
    return token


def start(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None, body: dict[str, Any], *, channel: str = "local",
          kind: str = "camera") -> tuple[int, dict[str, Any]]:
    """POST sessions (and the administrator's test, kind "test"). Every refusal before the bridge call is audited
    (media.cast.denied); a bridge refusal ends the session at once (`refused`) and answers 200 with `status: refused`."""
    key = body["target_key"]
    crid = body.get("client_request_id")
    camera_id = body["camera_id"]
    profile = body.get("profile") or "sub"
    duration = body.get("duration") or "default"
    # 0. idempotent: the same request of the same user returns the session it started
    if crid:
        again = conn.execute("SELECT * FROM cast_sessions WHERE started_by = ? AND client_request_id = ?", (principal.user_id, crid)).fetchone()
        if again is not None:
            return 200, {"status": "existing", "session": view(conn, principal, again)}
    # 1. the feature, the relay, the origin
    ready, why = readiness(conn, settings)
    if not store.enabled(conn):
        raise ApiError(404, "feature_disabled", "המולטימדיה כבויה בהגדרות המערכת.")
    if not ready:
        raise _deny(conn, principal, request_id, key, err(409, "cast_unavailable", reason=why), reason=why)
    # 2. the screen: approved, readable (else 404), media.cast at its anchor (403), cast allowed by the administrator
    cat = _catalog(conn)
    item = cat.items.get(key)
    access = _access(conn, principal)
    admin = authorize(conn, principal, CONFIGURE, INSTALLATION).allowed
    if item is None or not item.row["approved"] or not access.has(store.PERM_READ, item.row.get("anchor_entity_id")):
        raise _deny(conn, principal, request_id, key, ApiError(404, "not_found", MESSAGES["screen_not_found"]))
    anchor = item.row.get("anchor_entity_id")
    if kind == "test":
        if not admin:
            raise _deny(conn, principal, request_id, key, err(403, "forbidden", permission=CONFIGURE))
    elif not access.has(PERM_CAST, anchor):
        raise _deny(conn, principal, request_id, key, err(403, "forbidden", permission=PERM_CAST))
    # 3. the camera: video.live (the audited 403 of the live screen), enabled
    from .access import require_camera

    require_camera(conn, principal, camera_id, "video.live")
    cam = _camera(conn, camera_id)
    sc = screen_cast(item.row)
    cap = capability(item, cat, _meta(conn))
    target = cap["target_entity_id"]
    if cap["method"] != "cast_hls" or not target or cap.get("confidence") == "unknown":
        raise _deny(conn, principal, request_id, key, err(409, "cast_unsupported", method=cap["method"], confidence=cap.get("confidence")))
    if kind != "test" and not sc["allow"]:
        raise _deny(conn, principal, request_id, key, err(403, "cast_not_allowed"))
    if item.row["is_public"] and not access.has(store.PERM_PUBLIC, anchor):
        raise _deny(conn, principal, request_id, key, err(403, "public_screen"))
    if profile not in ("sub", "main"):
        raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": ["profile"]})
    if profile == "main" and not _main_ok(conn, cam, item):
        raise _deny(conn, principal, request_id, key, err(422, "main_not_supported"), camera_id=camera_id)
    if duration not in ("default", "permanent") or (duration == "permanent" and kind == "test"):
        raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": ["duration"]})
    if duration == "permanent" and not sc["permanent"]:
        raise _deny(conn, principal, request_id, key, err(403, "permanent_not_allowed"))
    # 4. who acts in Home Assistant, and the bridge
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise _deny(conn, principal, request_id, key, err(403, "identity_unmapped"))
    b_ok, b_why = bridge_ready(conn)
    if not b_ok:
        raise _deny(conn, principal, request_id, key, err(503, b_why or "bridge_outdated", required=BRIDGE_CAST_REQUIRED))
    # 5. the screen's state: gone, busy with music (needs `confirmed`), another cast (replaced), the caps
    if not mm.available(cat.ents.get(target)):
        raise _deny(conn, principal, request_id, key, err(409, "unavailable"))
    open_rows = _open_sessions(conn)
    current = next((r for r in open_rows if r["device_key"] == key), None)
    state = _busy(cat, item, target, {})
    if state == "playing_music" and body.get("confirmed") is not True:
        raise _deny(conn, principal, request_id, key, err(409, "cast_busy", state=state))
    cfg = config(conn)
    others = [r for r in open_rows if current is None or r["session_id"] != current["session_id"]]
    if len(others) >= cfg["max_sessions"]:
        raise _deny(conn, principal, request_id, key, err(409, "cast_limit", max=cfg["max_sessions"], active=len(others)))
    with _lock:
        last = _last_start.get(key)
        mono = time.monotonic()
        if last is not None and mono - last < START_GAP_S:
            raise err(429, "rate_limited")
        _last_start[key] = mono
    # 6. the stream (our namespace only; the same stream the live screen uses)
    stream = ensure_stream(settings, cam, profile)
    # 7. record, then replace, then send
    was_off = bool(json.loads(current["restore_json"] or "{}").get("was_off")) if current is not None else _was_off(cat, item, target)
    power_off_after = bool(was_off and cfg["power_off_after"] and body.get("power_off_after", True) is not False)
    session_id = uuid.uuid4().hex
    expires_at = _expiry(conn, item, kind, duration)
    if current is not None:
        _end(conn, current, "replaced", principal, request_id, send=False, replaced_by=session_id)
    token = token_for(_secret(conn), session_id, 0)
    started = _iso(now())
    conn.execute(
        "INSERT INTO cast_sessions(session_id, device_key, target_entity_id, kind, camera_id, profile, stream_name, token_hash, token_gen, started_by, started_by_name, channel,"
        " client_request_id, state, started_at, expires_at, restore_json) VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,'starting',?,?,?)",
        (session_id, key, target, kind, camera_id, profile, stream, cast_relay.token_hash(token), principal.user_id, principal.display_name or principal.username, channel,
         crid, started, expires_at, json.dumps({"was_off": was_off, "power_off_after": power_off_after})))
    cast_relay.INDEX.put(token, session_id, stream, _epoch(expires_at))
    try:
        ok, error, rid = _bridge(conn, settings, principal.user_id, "play", target, url=_url(cfg["origin"], token), title=_title(cam))
    except ApiError as exc:
        cast_relay.INDEX.drop(session_id)
        conn.execute("UPDATE cast_sessions SET stopped_at = ?, stop_reason = 'error', state = 'stopped' WHERE session_id = ?", (_iso(now()), session_id))
        audit(conn, actor=principal, action="media.cast.start", decision="allowed", resource_type="media_device", resource_id=key, reason=exc.code, request_id=request_id,
              details={"session_id": session_id, "camera_id": camera_id, "stream": stream, "profile": profile, "kind": kind, "status": "failed", "channel": channel})
        _publish("start_failed")
        raise
    conn.execute("UPDATE cast_sessions SET ha_action_id = ? WHERE session_id = ?", (rid, session_id))
    details = {"session_id": session_id, "camera_id": camera_id, "stream": stream, "profile": profile, "kind": kind, "ha_action_id": rid, "channel": channel,
               "expires_at": expires_at, "permanent": expires_at is None, "was_off": was_off, "power_off_after": power_off_after,
               **({"replaced_session": current["session_id"], "replaced_user": current["started_by_name"]} if current is not None else {})}
    if not ok:
        cast_relay.INDEX.drop(session_id)
        conn.execute("UPDATE cast_sessions SET stopped_at = ?, stop_reason = 'refused', state = 'stopped' WHERE session_id = ?", (_iso(now()), session_id))
        audit(conn, actor=principal, action="media.cast.start", decision="denied", resource_type="media_device", resource_id=key, reason=error, request_id=request_id,
              details={**details, "status": "refused"})
        _publish("start_refused")
        row = conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone()
        return 200, {"status": "refused", "error": error, "session": view(conn, principal, row, cat, access)}
    audit(conn, actor=principal, action="media.cast.test" if kind == "test" else "media.cast.start", decision="allowed", resource_type="media_device", resource_id=key,
          request_id=request_id, details=details, under=access.decision(PERM_CAST, anchor) if kind != "test" else None)
    _publish("started")
    row = conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone()
    return 202, {"status": "accepted", "error": None, "session": view(conn, principal, row, cat, access)}


# ------------------------------------------------------------------------------------------------ extend / switch / stop


def _row(conn: sqlite3.Connection, principal: Principal, session_id: str) -> tuple[sqlite3.Row, store.Catalog, store.Access, str | None]:
    row = conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone()
    cat = _catalog(conn)
    access = _access(conn, principal)
    if row is None or not _visible(access, principal, row, cat, conn):
        raise err(404, "not_found")
    item = cat.items.get(row["device_key"])
    return row, cat, access, item.row.get("anchor_entity_id") if item else None


def extend(conn: sqlite3.Connection, principal: Principal, request_id: str | None, session_id: str) -> dict[str, Any]:
    row, cat, access, anchor = _row(conn, principal, session_id)
    if row["stopped_at"]:
        raise err(409, "stopped")
    if not _can_manage(access, principal, row, anchor, conn)["extend"]:
        if row["kind"] != "camera" or row["expires_at"] is None:
            raise err(409, "not_extendable")
        if row["extended_n"] >= MAX_EXTENSIONS:
            raise err(409, "extend_limit", max=MAX_EXTENSIONS)
        raise _deny(conn, principal, request_id, row["device_key"], err(403, "forbidden", permission=PERM_CAST), session_id=session_id)
    item = cat.items.get(row["device_key"])
    minutes = (screen_cast(item.row)["minutes"] if item else None) or config(conn)["minutes"]
    base = max(now(), _parse(row["expires_at"]) or now())
    new = _iso(base + dt.timedelta(minutes=minutes))
    conn.execute("UPDATE cast_sessions SET expires_at = ?, extended_n = extended_n + 1 WHERE session_id = ?", (new, session_id))
    cast_relay.INDEX.set_expiry(session_id, _epoch(new))
    audit(conn, actor=principal, action="media.cast.extend", decision="allowed", resource_type="media_device", resource_id=row["device_key"], request_id=request_id,
          details={"session_id": session_id, "expires_at": new, "extended_n": row["extended_n"] + 1, "minutes": minutes})
    _publish("extended")
    return view(conn, principal, conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone(), cat, access)


def switch(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None, session_id: str, camera_id: str, profile: str) -> tuple[int, dict[str, Any]]:
    """Another camera on the same screen: a NEW token (the old one dies at once), one new play; the timer and the restore stay."""
    row, cat, access, anchor = _row(conn, principal, session_id)
    if row["stopped_at"]:
        raise err(409, "stopped")
    if not _can_manage(access, principal, row, anchor, conn)["switch"]:
        raise _deny(conn, principal, request_id, row["device_key"], err(403, "forbidden", permission=PERM_CAST), session_id=session_id)
    from .access import require_camera

    require_camera(conn, principal, camera_id, "video.live")
    cam = _camera(conn, camera_id)
    item = cat.items.get(row["device_key"])
    if item is None:
        raise err(409, "unavailable")
    if profile not in ("sub", "main"):
        raise ApiError(422, "validation", MESSAGES["validation"], details={"fields": ["profile"]})
    if profile == "main" and not _main_ok(conn, cam, item):
        raise _deny(conn, principal, request_id, row["device_key"], err(422, "main_not_supported"), camera_id=camera_id)
    ready, why = readiness(conn, settings)
    if not ready:
        raise err(409, "cast_unavailable", reason=why)
    stream = ensure_stream(settings, cam, profile)
    gen = row["token_gen"] + 1
    token = token_for(_secret(conn), session_id, gen)
    conn.execute("UPDATE cast_sessions SET camera_id = ?, profile = ?, stream_name = ?, token_hash = ?, token_gen = ?, first_segment_at = NULL, state = 'starting', started_at = ? "
                 "WHERE session_id = ?", (camera_id, profile, stream, cast_relay.token_hash(token), gen, _iso(now()), session_id))
    cast_relay.INDEX.put(token, session_id, stream, _epoch(row["expires_at"]))  # replaces the old token of this session
    try:
        ok, error, rid = _bridge(conn, settings, row["started_by"], "play", row["target_entity_id"], url=_url(config(conn)["origin"], token), title=_title(cam))
    except ApiError:
        _end(conn, conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone(), "error", principal, request_id, send=False)
        raise
    details = {"session_id": session_id, "from_camera": row["camera_id"], "camera_id": camera_id, "stream": stream, "profile": profile, "ha_action_id": rid}
    if not ok:
        _end(conn, conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone(), "refused", principal, request_id, send=False)
        audit(conn, actor=principal, action="media.cast.switch", decision="denied", resource_type="media_device", resource_id=row["device_key"], reason=error, request_id=request_id, details=details)
        return 200, {"status": "refused", "error": error, "session": view(conn, principal, conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone(), cat, access)}
    conn.execute("UPDATE cast_sessions SET ha_action_id = ? WHERE session_id = ?", (rid, session_id))
    audit(conn, actor=principal, action="media.cast.switch", decision="allowed", resource_type="media_device", resource_id=row["device_key"], request_id=request_id, details=details)
    _publish("switched")
    return 202, {"status": "accepted", "error": None, "session": view(conn, principal, conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone(), cat, access)}


def _end(conn: sqlite3.Connection, row: sqlite3.Row, reason: str, actor: Principal | None, request_id: str | None, *, send: bool, settings: Settings | None = None,
         power_off: bool | None = None, replaced_by: str | None = None) -> dict[str, Any]:
    """End a session: revoke the token FIRST (memory and row), then - when `send` - ONE stop and, by the restore rule, ONE off.
    Never retried; a bridge that cannot be reached leaves the token revoked (the TV's player ends on its next request)."""
    session_id = row["session_id"]
    cast_relay.INDEX.drop(session_id)
    restore = json.loads(row["restore_json"] or "{}")
    off_wanted = bool(restore.get("power_off_after")) and power_off is not False and reason not in ("replaced", "target_gone")
    off_state = None if not restore.get("power_off_after") or reason == "replaced" else ("cancelled" if power_off is False else ("skipped" if reason == "target_gone" else None))
    conn.execute("UPDATE cast_sessions SET stopped_at = ?, stop_reason = ?, stopped_by = ?, state = 'stopped', power_off_state = ? WHERE session_id = ? AND stopped_at IS NULL",
                 (_iso(now()), reason, actor.user_id if actor else None, off_state, session_id))
    outcome: dict[str, Any] = {"stop": "not_sent", "power_off": off_state}
    if send and settings is not None:
        try:
            ok, error, _rid = _bridge(conn, settings, row["started_by"], "stop", row["target_entity_id"])
            outcome["stop"] = "sent" if ok else f"refused:{error}"
        except ApiError as exc:
            outcome["stop"] = f"failed:{exc.code}"
        if off_wanted:
            try:
                ok, error, _rid = _bridge(conn, settings, row["started_by"], "off", row["target_entity_id"])
                outcome["power_off"] = "sent" if ok else "failed"
            except ApiError:
                outcome["power_off"] = "failed"
            conn.execute("UPDATE cast_sessions SET power_off_state = ? WHERE session_id = ?", (outcome["power_off"], session_id))
            audit(conn, actor=actor, action="media.cast.power_off", decision="allowed" if outcome["power_off"] == "sent" else "denied", resource_type="media_device",
                  resource_id=row["device_key"], request_id=request_id, details={"session_id": session_id, "status": outcome["power_off"]})
    audit(conn, actor=actor, action="media.cast.stop", decision="allowed", resource_type="media_device", resource_id=row["device_key"], reason=reason, request_id=request_id,
          details={"session_id": session_id, "camera_id": row["camera_id"], "kind": row["kind"], "stop": outcome["stop"], "power_off": outcome["power_off"],
                   **({"replaced_by": replaced_by} if replaced_by else {})})
    return outcome


def stop(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None, session_id: str, *, power_off: bool | None = None) -> dict[str, Any]:
    row, cat, access, anchor = _row(conn, principal, session_id)
    if row["stopped_at"]:
        return {"status": "stopped", "session": view(conn, principal, row, cat, access)}
    if not _can_manage(access, principal, row, anchor, conn)["stop"]:
        raise _deny(conn, principal, request_id, row["device_key"], err(403, "forbidden", permission=PERM_CAST), session_id=session_id)
    reason = "user" if row["started_by"] == principal.user_id else "admin"
    outcome = _end(conn, row, reason, principal, request_id, send=True, settings=settings, power_off=power_off)
    _publish("stopped")
    return {"status": "stopped", "stop": outcome["stop"], "power_off": outcome["power_off"],
            "session": view(conn, principal, conn.execute("SELECT * FROM cast_sessions WHERE session_id = ?", (session_id,)).fetchone(), cat, access)}


# ------------------------------------------------------------------------------------------------ the relay callbacks, start-up and the janitor


def note_first_segment(session_id: str) -> None:
    if not _DB:
        return
    with _DB[0].connection(label="cast.first_segment") as conn:
        conn.execute("UPDATE cast_sessions SET first_segment_at = ?, state = 'playing' WHERE session_id = ? AND stopped_at IS NULL AND first_segment_at IS NULL",
                     (_iso(now()), session_id))
    _publish("playing")


def note_abuse(session_id: str) -> None:
    """A token that keeps hammering the relay past its rate: the session ends (`error`) - the token dies now, the stop goes out once."""
    cast_relay.INDEX.drop(session_id)
    if not _DB:
        return
    with _DB[0].connection(label="cast.abuse") as conn:
        row = conn.execute("SELECT * FROM cast_sessions WHERE session_id = ? AND stopped_at IS NULL", (session_id,)).fetchone()
        if row is not None:
            _end(conn, row, "error", None, None, send=bool(_SETTINGS), settings=_SETTINGS[0] if _SETTINGS else None)
    _publish("stopped")


def attach(db: Any, settings: Settings) -> None:
    """Called once per app: the relay callbacks write through `db`; the live tokens of open sessions are loaded into the index
    (an add-on restart keeps a running cast, a permanent one included)."""
    _DB[:] = [db]
    _SETTINGS[:] = [settings]
    cast_relay.ON_FIRST_SEGMENT[:] = [note_first_segment]
    cast_relay.ON_ABUSE[:] = [note_abuse]
    cast_relay.INDEX.clear()
    try:
        with db.connection(mode="read", label="cast.load_index") as conn:
            rows = conn.execute("SELECT * FROM cast_sessions WHERE stopped_at IS NULL").fetchall()
            secret_hex = get_setting(conn, K_SECRET)
        if rows and secret_hex:
            secret = bytes.fromhex(secret_hex)
            for r in rows:
                cast_relay.INDEX.put(token_for(secret, r["session_id"], r["token_gen"]), r["session_id"], r["stream_name"], _epoch(r["expires_at"]))
    except sqlite3.OperationalError:  # a database before 0060 (the migration runs first; never block the start)
        pass


def janitor(db: Any, settings: Settings) -> dict[str, int]:
    """Every 30 s: expired sessions end (`timeout`: ONE stop, the restore rule), sessions whose screen vanished end (`target_gone`, no
    command), 15 s without a first segment is persisted as `not_confirmed`."""
    counts = {"timeout": 0, "target_gone": 0, "not_confirmed": 0}
    with db.connection(label="cast.janitor") as conn:
        try:
            rows = conn.execute("SELECT * FROM cast_sessions WHERE stopped_at IS NULL").fetchall()
        except sqlite3.OperationalError:
            return counts
        if not rows:
            return counts
        at = now()
        ents = {r["entity_id"]: r for r in conn.execute(
            f"SELECT entity_id, state FROM ha_entities WHERE entity_id IN ({','.join('?' * len(rows))})", [r["target_entity_id"] for r in rows]).fetchall()}
        for r in rows:
            exp = _parse(r["expires_at"])
            if exp is not None and exp <= at:
                _end(conn, r, "timeout", None, None, send=True, settings=settings)
                counts["timeout"] += 1
                continue
            e = ents.get(r["target_entity_id"])
            if e is None or e["state"] == "unavailable":
                _end(conn, r, "target_gone", None, None, send=False)
                counts["target_gone"] += 1
                continue
            if r["state"] == "starting" and _state(r, at) == "not_confirmed":
                conn.execute("UPDATE cast_sessions SET state = 'not_confirmed' WHERE session_id = ?", (r["session_id"],))
                counts["not_confirmed"] += 1
    if any(counts.values()):
        _publish("janitor")
    return counts
