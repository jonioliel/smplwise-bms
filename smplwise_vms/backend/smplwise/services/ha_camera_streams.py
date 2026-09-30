"""Live video for a standalone Home Assistant camera the owner chose to show (docs/design/CAMERA_CARD_HA_SOURCE.md, option (b),
approved 2026-09-30).

A Home Assistant camera that is not one of the NVR's channels shows a still picture. The owner may turn ONE such camera into
live video, camera by camera - never automatically for all of them:

1. `enable` (an administrator with `sources.configure`): the add-on asks the bridge (`smplwise_bridge.stream_source`, signed,
   read-only, bridge >= 0.3.1) for the entity's `stream_source`, checks it, and writes ONE go2rtc stream
   `smplwise_ha_<slug>` through the existing go2rtc write path (namespace guard: only `smplwise_` names, and here only the
   narrower `smplwise_ha_` this feature owns). The entity id goes into the stored opt-in list (`camera_card.ha_live`); the
   source itself is stored NOWHERE on our side.
2. The card of that camera plays through the existing live relay (`WS /media/live-ha/{entity}/ws`): the same viewing rule as
   the picture (video.live installation-wide - a non-NVR camera has no camera scope), the same session budget and the same
   MSE / WebRTC transport, through the same player.
3. `ensure_ready` (each time a viewer opens): the stream must exist in go2rtc; when it does not (go2rtc restarted without it), or
   a viewer saw it fail since, the source is read again (sources change: a camera's password, an address) - as the
   administrator who enabled the camera, at most once per REREAD_MIN_INTERVAL_S per camera.
4. `disable` (or the camera disappearing - `reconcile`, run by the janitor every RECONCILE_EVERY_S) removes the opt-in and
   deletes the go2rtc stream. `reconcile` also deletes any `smplwise_ha_*` stream that no opt-in wants; it never touches a
   stream outside that prefix (the NVR streams, WisKey stations and the other project's streams are foreign to it).

Secrets: the source may carry the camera's credentials (`rtsp://user:pass@host/...`). It travels bridge -> this process ->
go2rtc's API and nowhere else: never in a log line (go2rtc's own line, ours, an exception), an audit row, an API answer, an
error message or the database. Audit rows name the entity and the outcome only; API answers say `enabled` and the outcome; the
go2rtc listing of `GET /media/streams` shows the scheme (go2rtc.redact_ha_source); go2rtc's error frames to a viewer are
replaced by a fixed code (`sanitize_frame`)."""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import threading
import time
import uuid
from typing import Any, Protocol

from ..audit import audit
from ..config import Settings
from ..db import Database, get_setting, now_iso, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from . import camera_cards as cc
from . import go2rtc as g2
from . import ha_bridge, ha_client
from .leases import CameraLease

log = logging.getLogger("smplwise.ha_live")

KEY = "camera_card.ha_live"  # settings: {"v": 1, "cameras": {entity_id: {"enabled_at", "enabled_by"}}} - ids only, never a source
BRIDGE_REQUIRED = "0.3.1"
REREAD_MIN_INTERVAL_S = 30.0  # a camera's source is read again at most this often (a failing stream must not become a request loop)
RECONCILE_EVERY_S = 300.0
STALE_WITHIN_S = 15.0
MAX_SOURCE_LEN = 2048
SOURCE_SCHEMES = ("rtsp://", "rtsps://", "http://", "https://")
_BAD_SOURCE_CHARS = re.compile(r"[\s\x00-\x1f\x7f#]")
CODE_RE = re.compile(r"^[A-Za-z0-9_]{1,64}$")
LIVE_ERROR_FRAME = json.dumps({"type": "error", "value": "upstream_unavailable"})

# the bridge's refusal codes -> (status, our code, message)
_BRIDGE_REFUSALS: dict[str, tuple[int, str, str]] = {
    "admin_required": (403, "ha_admin_required", "הצגת מצלמה בזרם חי דורשת מנהל בתשתית המערכת."),
    "unknown_user": (403, "ha_user_unknown", "המשתמש אינו מוכר בתשתית המערכת."),
    "entity_not_found": (404, "not_found", "המצלמה לא נמצאה בתשתית המערכת."),
    "no_stream_source": (422, "no_stream_source", "למצלמה אין מקור לשידור חי; היא תישאר כתמונה בלבד."),
    "source_not_supported": (422, "source_not_supported", "סוג מקור השידור של המצלמה אינו נתמך."),
    "rate_limited": (429, "rate_limited", "יותר מדי בקשות; נסו שוב בעוד דקה."),
}


class BridgeTransport(Protocol):
    def stream_source(self, settings: Settings, payload: dict[str, Any]) -> dict[str, Any]:
        """The signed `smplwise_bridge.stream_source` call; the service response (`ok`, `request_id`, `error`,
        `stream_source`). ApiError on a transport failure."""


class HaBridgeTransport:
    def stream_source(self, settings: Settings, payload: dict[str, Any]) -> dict[str, Any]:
        return ha_client.call_bridge_stream_source(settings, payload)


_TRANSPORT: BridgeTransport = HaBridgeTransport()


def set_transport(transport: BridgeTransport | None) -> None:
    """Tests: replace the bridge transport (None restores the production one)."""
    global _TRANSPORT
    _TRANSPORT = transport if transport is not None else HaBridgeTransport()


# ---------------------------------------------------------------- the opt-in list

def _load(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    raw = get_setting(conn, KEY)
    try:
        data = json.loads(raw) if raw else {}
    except ValueError:
        return {}
    cams = data.get("cameras") if isinstance(data, dict) else None
    return {k: v for k, v in cams.items() if isinstance(k, str) and isinstance(v, dict)} if isinstance(cams, dict) else {}


def _save(conn: sqlite3.Connection, cams: dict[str, dict[str, Any]]) -> None:
    set_setting(conn, KEY, json.dumps({"v": 1, "cameras": cams}, sort_keys=True))


def enabled(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """entity id -> {enabled_at, enabled_by} of every camera the owner chose to show live. Empty by default."""
    return _load(conn)


def is_enabled(conn: sqlite3.Connection, entity_id: str) -> bool:
    return entity_id in _load(conn)


def stream_name(entity_id: str) -> str:
    """smplwise_ha_<slug> (go2rtc.ha_stream_name): ValueError for anything that is not a plain camera entity id."""
    return g2.ha_stream_name(entity_id)


def live_path(entity_id: str) -> str:
    return f"media/live-ha/{entity_id}/ws"


def viewer_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> bool:
    """May THIS caller watch the camera's live video: the rule of its picture - devices.read on the entity and video.live
    installation-wide (a camera that is not an NVR channel has no camera scope) - and the camera is opted in, still in the
    catalogue and not an NVR channel."""
    if not cc.HA_CAMERA_RE.fullmatch(entity_id or "") or not is_enabled(conn, entity_id):
        return False
    if not cc.entity_visible(conn, principal, entity_id) or cc._entity(conn, entity_id) is None:
        return False
    if entity_id in cc.link_ha_cameras(conn):
        return False
    return cc.can_still(conn, principal)


class HaLiveLease(CameraLease):
    """The relay keeps the camera only while the viewer still may watch it (T055): the same rule as `viewer_allowed`."""

    def __init__(self, db: Any, principal: Principal, entity_id: str) -> None:
        super().__init__(db, principal, entity_id, "video.live")

    def allowed_now(self) -> bool:
        with self.db.connection(mode="read", label=f"lease ha live {self.camera_id}") as conn:
            return viewer_allowed(conn, self.principal, self.camera_id)


# ---------------------------------------------------------------- the source, from the bridge

def _version_tuple(text: str) -> tuple[int, ...]:
    return tuple(int(p) for p in re.findall(r"\d+", text or "")[:3])


def source_error(value: Any) -> str | None:
    """None when `value` may go to go2rtc (a plain streaming URL), else a code. Never includes the value. The bridge checks the
    same; this is the add-on's own check of what it is about to write (go2rtc reads `exec:`, `ffmpeg:` and `#options`)."""
    if not isinstance(value, str) or not value:
        return "no_stream_source"
    if len(value) > MAX_SOURCE_LEN or _BAD_SOURCE_CHARS.search(value) or not value.lower().startswith(SOURCE_SCHEMES):
        return "source_not_supported"
    return None


def _ready(conn: sqlite3.Connection, settings: Settings) -> str:
    """The bridge secret once the prerequisites hold, else the refusal."""
    if not settings.go2rtc_url:
        raise ApiError(409, "media_not_configured", "כתובת go2rtc לא הוגדרה בהגדרות ה־Add-on.")
    if not ha_client.configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise ApiError(503, "bridge_not_paired", "הצגה בזרם חי דורשת את הגשר מותקן ומצומד.")
    seen = get_setting(conn, "bridge.integration_version") or ""
    if seen and _version_tuple(seen) < _version_tuple(BRIDGE_REQUIRED):
        raise ApiError(503, "bridge_too_old", "נדרש עדכון של רכיב החיבור כדי להציג מצלמה בזרם חי.", details={"required": BRIDGE_REQUIRED})
    return secret


def _payload(secret: str, user_id: str, entity_id: str) -> dict[str, Any]:
    return ha_bridge.sign(secret, {"user_id": user_id, "entity_id": entity_id, "request_id": uuid.uuid4().hex[:12]})


def _fetch_source(settings: Settings, payload: dict[str, Any]) -> str:
    """Ask the bridge (network-bound: run without the request's write lock). The returned source is checked and returned to
    the caller, who hands it to go2rtc and drops it; every failure is an ApiError that carries a code only."""
    answer = _TRANSPORT.stream_source(settings, payload)
    if not isinstance(answer, dict) or not answer.get("ok"):
        code = str((answer or {}).get("error") or "bridge_error") if isinstance(answer, dict) else "bridge_error"
        status, out, message = _BRIDGE_REFUSALS.get(code, (502, "bridge_error", "תשתית המערכת דחתה את בקשת מקור השידור."))
        details = {"error": code if CODE_RE.fullmatch(code) else "unknown"} if out == "bridge_error" else None
        raise ApiError(status, out, message, details=details)
    src = answer.get("stream_source")
    bad = source_error(src)
    if bad:
        status, out, message = _BRIDGE_REFUSALS[bad]
        raise ApiError(status, out, message)
    return src  # type: ignore[return-value]


def _write_stream(settings: Settings, entity_id: str, src: str) -> str:
    name = stream_name(entity_id)
    if not name.startswith(g2.HA_STREAM_PREFIX):  # the narrower namespace of this feature, on top of go2rtc's own guard
        raise ValueError("refusing to write a stream outside the smplwise_ha_ namespace")
    return g2.Go2rtc(settings).ensure_stream(name, src)


def _delete_stream(settings: Settings, name: str) -> None:
    if not name.startswith(g2.HA_STREAM_PREFIX):
        raise ValueError("refusing to delete a stream outside the smplwise_ha_ namespace")
    g2.Go2rtc(settings).delete_stream(name)


# ---------------------------------------------------------------- enable / disable

def _identity_ok(settings: Settings, principal: Principal) -> bool:
    return principal.source in ("ingress", "remote") or bool(settings.dev_user)


def enable(conn: sqlite3.Connection, settings: Settings, principal: Principal, entity_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Show ONE standalone Home Assistant camera as live video (idempotent: a camera already enabled has its source read
    again). The caller has checked `sources.configure`. The go2rtc stream is written BEFORE the opt-in is stored, so an
    opt-in never exists without its stream."""
    try:
        name = stream_name(entity_id)
    except ValueError:
        raise ApiError(422, "validation", "מזהה מצלמה לא תקין.", details={"fields": ["entity_id"]}) from None
    if cc._entity(conn, entity_id) is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if entity_id in cc.link_ha_cameras(conn):
        raise ApiError(409, "camera_is_nvr_channel", "המצלמה הזו היא ערוץ של ה־NVR: היא כבר משודרת חי משם.")
    if not _identity_ok(settings, principal):
        raise ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולה בתשתית המערכת.")
    secret = _ready(conn, settings)
    payload = _payload(secret, principal.user_id, entity_id)
    # two-phase: the attempt is recorded (and committed by unlocked) before Home Assistant is asked
    audit(conn, actor=principal, action="camera_card.ha_live.enable", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
          details={"phase": "attempt", "stream": name})
    try:
        with unlocked(conn):
            result = _write_stream(settings, entity_id, _fetch_source(settings, payload))
    except ApiError as exc:
        audit(conn, actor=principal, action="camera_card.ha_live.enable", decision="denied", resource_type="ha_entity", resource_id=entity_id, reason=exc.code,
              request_id=request_id, details={"phase": "outcome", "stream": name})
        raise
    cams = _load(conn)
    cams[entity_id] = {"enabled_at": now_iso(), "enabled_by": principal.user_id}
    _save(conn, cams)
    _mark_read(entity_id)
    audit(conn, actor=principal, action="camera_card.ha_live.enable", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
          details={"phase": "outcome", "stream": name, "result": result})
    return {"entity_id": entity_id, "enabled": True, "result": result}


def disable(conn: sqlite3.Connection, settings: Settings, principal: Principal, entity_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Stop showing the camera live: the opt-in is removed first (nobody can open it any more), then its go2rtc stream is
    deleted. A stream that could not be deleted now (go2rtc down) is removed by `reconcile` later."""
    try:
        name = stream_name(entity_id)
    except ValueError:
        raise ApiError(422, "validation", "מזהה מצלמה לא תקין.", details={"fields": ["entity_id"]}) from None
    cams = _load(conn)
    was = cams.pop(entity_id, None) is not None
    if was:
        _save(conn, cams)
    stream_removed = False
    if settings.go2rtc_url:
        try:
            with unlocked(conn):
                _delete_stream(settings, name)
            stream_removed = True
        except ApiError as exc:
            log.warning("ha live stream removal failed: %s", exc.code)
    _forget(entity_id)
    audit(conn, actor=principal, action="camera_card.ha_live.disable", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
          details={"stream": name, "was_enabled": was, "stream_removed": stream_removed})
    return {"entity_id": entity_id, "enabled": False, "stream_removed": stream_removed}


# ---------------------------------------------------------------- viewing: keep the stream alive

_LOCK = threading.Lock()
_LAST_READ: dict[str, float] = {}
_STALE: set[str] = set()
_ENTITY_LOCKS: dict[str, threading.Lock] = {}


def _mark_read(entity_id: str) -> None:
    with _LOCK:
        _LAST_READ[entity_id] = time.monotonic()
        _STALE.discard(entity_id)


def _forget(entity_id: str) -> None:
    with _LOCK:
        _LAST_READ.pop(entity_id, None)
        _STALE.discard(entity_id)
        _ENTITY_LOCKS.pop(entity_id, None)


def mark_stale(entity_id: str) -> None:
    """A viewer saw the stream fail: the next open reads the source again (subject to REREAD_MIN_INTERVAL_S)."""
    with _LOCK:
        _STALE.add(entity_id)


def sanitize_frame(entity_id: str, text: str) -> str | None:
    """A text frame from go2rtc on its way to a viewer. An error frame (its text may carry an address or a credential of the
    camera) becomes the fixed `upstream_unavailable` and marks the stream stale; everything else is passed on. Never raises."""
    if not text.startswith("{"):
        return text
    try:
        msg = json.loads(text)
    except ValueError:
        return text
    if isinstance(msg, dict) and msg.get("type") == "error":
        mark_stale(entity_id)
        return LIVE_ERROR_FRAME
    return text


def note_session_end(entity_id: str, reason: str, seconds: float) -> None:
    """A session that ended within STALE_WITHIN_S because go2rtc closed it (not the viewer, not an access change) says the
    source may have changed."""
    if seconds < STALE_WITHIN_S and reason not in ("client_closed", "superseded", "access_lost", "ended"):
        mark_stale(entity_id)


def ensure_ready(db: Database, settings: Settings, entity_id: str) -> str:
    """The go2rtc stream name of an enabled camera, re-creating the stream when it is missing or was seen failing (sources
    change). Sync (thread pool). Refuses (ApiError) a camera that is not enabled; a source that cannot be read leaves the
    existing stream as it is."""
    name = stream_name(entity_id)
    with db.connection(mode="read", label="ha live ready") as conn:
        rec = _load(conn).get(entity_id)
        if rec is None:
            raise ApiError(404, "not_found", "המצלמה לא מופעלת לשידור חי.")
        try:  # only needed when a re-read is due
            secret: str | None = _ready(conn, settings)
        except ApiError:
            secret = None
    client = g2.Go2rtc(settings)

    def present() -> bool:
        info = client.list_streams().get(name)
        return bool(info and info.sources)

    def is_stale() -> bool:
        with _LOCK:
            return entity_id in _STALE

    have = present()
    if have and not is_stale():
        return name
    with _LOCK:
        entity_lock = _ENTITY_LOCKS.setdefault(entity_id, threading.Lock())
    unavailable = ApiError(503, "ha_live_unavailable", "השידור החי של המצלמה אינו זמין כרגע.", retryable=True)
    with entity_lock:
        have = present()  # another viewer may have re-created it while this one waited
        if have and not is_stale():
            return name
        with _LOCK:
            recent = time.monotonic() - _LAST_READ.get(entity_id, -1e9) < REREAD_MIN_INTERVAL_S
        if recent or secret is None:
            # read a moment ago (a failing source is not asked for in a loop) or no way to ask: the old stream, if any
            if have:
                return name
            raise unavailable
        _mark_read(entity_id)  # the attempt counts, success or not
        outcome, code = None, None
        try:
            outcome = _write_stream(settings, entity_id, _fetch_source(settings, _payload(secret, str(rec.get("enabled_by") or ""), entity_id)))
        except ApiError as exc:
            code = exc.code
        try:
            with db.connection() as conn:
                audit(conn, actor=None, action="camera_card.ha_live.refresh", decision="allowed" if outcome else "denied", resource_type="ha_entity", resource_id=entity_id,
                      reason=code, details={"stream": name, "result": outcome})
        except sqlite3.Error as exc:  # bookkeeping never kills a viewer
            log.error("audit ha live refresh failed: %s", type(exc).__name__)
        if outcome or have:
            return name
        raise unavailable


# ---------------------------------------------------------------- housekeeping

_last_reconcile = 0.0


def reconcile(db: Database, settings: Settings, *, force: bool = False) -> dict[str, int]:
    """Drop the opt-in of a camera that is gone from Home Assistant, and make go2rtc hold exactly the `smplwise_ha_` streams
    the enabled cameras want: every other `smplwise_ha_*` stream is deleted, nothing outside that prefix is ever touched.
    Throttled to RECONCILE_EVERY_S (the janitor runs every 30 s); never raises for a go2rtc that is down."""
    global _last_reconcile
    out = {"dropped": 0, "deleted": 0}
    if not settings.go2rtc_url:
        return out
    now = time.monotonic()
    if not force and now - _last_reconcile < RECONCILE_EVERY_S:
        return out
    _last_reconcile = now
    with db.connection() as conn:
        cams = _load(conn)
        gone = []
        for entity_id in cams:
            row = conn.execute("SELECT removed_at FROM ha_entities WHERE entity_id = ? AND domain = 'camera'", (entity_id,)).fetchone()
            if row is None or row["removed_at"] is not None:
                gone.append(entity_id)
        for entity_id in gone:
            cams.pop(entity_id, None)
            _forget(entity_id)
            audit(conn, actor=None, action="camera_card.ha_live.disable", decision="allowed", resource_type="ha_entity", resource_id=entity_id, reason="camera_gone",
                  details={"stream": stream_name(entity_id) if g2.HA_SLUG_RE.fullmatch(entity_id.partition(".")[2]) else None})
        if gone:
            _save(conn, cams)
        out["dropped"] = len(gone)
        wanted = set()
        for entity_id in cams:
            ent = conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND domain = 'camera' AND removed_at IS NULL AND disabled = 0", (entity_id,)).fetchone()
            if ent is not None:
                try:
                    wanted.add(stream_name(entity_id))
                except ValueError:
                    pass
    try:
        client = g2.Go2rtc(settings)
        streams = client.list_streams()
        for name in sorted(n for n in streams if n.startswith(g2.HA_STREAM_PREFIX) and n not in wanted):
            client.delete_stream(name)
            out["deleted"] += 1
            with db.connection() as conn:
                audit(conn, actor=None, action="camera_card.ha_live.stream_removed", decision="allowed", resource_type="go2rtc_stream", resource_id=name, reason="not_enabled")
    except ApiError as exc:
        log.warning("ha live reconcile: go2rtc unavailable: %s", exc.code)
    return out
