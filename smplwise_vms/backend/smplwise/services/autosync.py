"""Automatic discovery (chapter 19/21): when the add-on has NVR credentials it discovers the channels by
itself at start-up and every few minutes (read-only ISAPI), and when go2rtc is configured it keeps the
product's `smplwise_*` live streams in place. Nobody has to press "sync" before the first camera appears;
the manual buttons remain for an immediate refresh. Results and the last error are visible in /health.

CR-024 (multi-NVR): discovery runs for EVERY recorder this process loaded (recorder_scope.ready_ids), each with its own
connection, its own state (`RECORDER_STATE`) and its own try - one recorder that is down or refuses the login never stops
another. `STATE` stays the first recorder's (the shape /health, the health report and the setup wizard read). Discovery
matches a channel to its row by `(recorder_id, source_ref)` (ADP section 3.2; Hikvision `source_ref` = the channel number),
so the same channel number, name or camera serial on two recorders never merges two rows. A camera whose keyed fingerprint
changed (another physical camera in the slot, ADP section 3.3) is disabled and audited `cameras.replaced`; re-enabling it in
the camera table accepts the new one."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import sqlite3
import time
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import Database, get_setting, new_id, now_iso, set_setting, unlocked
from ..errors import ApiError
from ..recorder_scope import PRIMARY, ready, ready_ids, settings_for
from . import go2rtc as g2
from . import nvr, stream_codecs

log = logging.getLogger("smplwise.autosync")
DEFAULT_RECORDER = PRIMARY
INTERVAL_S = 600
FINGERPRINT_SALT_KEY = "cameras.fingerprint_salt"  # a project setting: travels with a backup, so a restore keeps the fingerprints

_EMPTY_STATE = {"cameras_last_ok": None, "cameras_last_error": None, "cameras_last_run": None, "streams_last_ok": None, "streams_last_error": None,
                "streams_last_run": None, "last_reason": None}
STATE: dict[str, Any] = dict(_EMPTY_STATE)
# CR-024: every recorder's discovery outcome (the first recorder's is also in STATE); never an address
RECORDER_STATE: dict[str, dict[str, Any]] = {}


def recorder_state(recorder_id: str) -> dict[str, Any]:
    if recorder_id == DEFAULT_RECORDER:
        return STATE
    return RECORDER_STATE.setdefault(recorder_id, {k: None for k in ("cameras_last_ok", "cameras_last_error", "cameras_last_run", "last_reason")})


def ensure_recorder(conn: sqlite3.Connection, name: str | None = None, model: str | None = None, firmware: str | None = None,
                    recorder_id: str = DEFAULT_RECORDER) -> None:
    """Create the recorder row (first discovery of `nvr-1`) or refresh its model / firmware / last-seen. A recorder added in
    Settings already has its row (with the installer's name); its name is never overwritten here."""
    label = name or ("NVR ראשי" if recorder_id == DEFAULT_RECORDER else recorder_id)
    conn.execute(
        """INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET model = COALESCE(excluded.model, recorders.model), firmware = COALESCE(excluded.firmware, recorders.firmware), last_seen_at = excluded.last_seen_at""",
        (recorder_id, label, model, firmware, now_iso(), now_iso()),
    )


def _salt(conn: sqlite3.Connection) -> bytes:
    raw = get_setting(conn, FINGERPRINT_SALT_KEY)
    if not raw:
        raw = secrets.token_hex(16)
        set_setting(conn, FINGERPRINT_SALT_KEY, raw)
    return str(raw).encode("utf-8")


def fingerprint(conn: sqlite3.Connection, recorder_id: str, model: str | None, serial: str | None) -> str | None:
    """ADP section 3.3: HMAC-SHA256(installation salt, recorder_id | model | serial)[:16]; None without a serial (ONVIF channels
    and fakes often have none - then nothing is ever disabled). Honest limit: the salt lives in the database, so this keeps
    the serial out of the database and out of every answer, not away from someone who holds the whole database."""
    if not serial:
        return None
    msg = f"{recorder_id}|{(model or '').strip()}|{serial.strip()}".encode("utf-8")
    return hmac.new(_salt(conn), msg, hashlib.sha256).hexdigest()[:16]


def _store_capabilities(conn: sqlite3.Connection, settings: Settings, recorder_id: str) -> None:
    """The recorder row keeps the adapter's last declaration (CR-024 / NN1 P5: the per-recorder capability model)."""
    from dataclasses import asdict

    from .recorders.registry import constructor_for

    try:
        caps = asdict(constructor_for(settings)(recorder_id, settings).capabilities())
        caps["encoding_fields"] = sorted(caps.get("encoding_fields") or [])
        conn.execute("UPDATE recorders SET capabilities_json = ?, vendor = ? WHERE id = ?", (json.dumps(caps, ensure_ascii=False, sort_keys=True), caps["vendor"], recorder_id))
    except (ApiError, sqlite3.OperationalError):
        pass  # a database before 0055 or a vendor without an adapter: the discovery itself still counts


def sync_cameras(settings: Settings, conn: sqlite3.Connection, actor: Any | None = None, request_id: str | None = None, reason: str = "manual",
                 recorder_id: str | None = None) -> dict[str, Any]:
    """Read-only discovery from ONE recorder (default `nvr-1`): channels, online flag and track ids. Existing aliases/order
    survive. `settings` is the process-wide settings; the recorder's own connection is taken from it."""
    rid = recorder_id or DEFAULT_RECORDER
    rs = settings_for(settings, rid)
    from .recorders import vendor_io

    with unlocked(conn):
        encodings: dict[int, dict[str, Any]] = {}
        enc_error: str | None = None
        if vendor_io.handles(rs):  # CR-025: Provision-ISR discovery through its adapter (names, status, encodings)
            info, channels, encodings, enc_error = vendor_io.discover(rs, rid)
        else:
            info = nvr.device_info(rs)
            channels = nvr.discover_channels(rs)
            # CR-008 D7: the main / sub stream encodings (one more read-only GET); a failure never fails the discovery
            try:
                encodings = nvr.fetch_stream_encodings(rs)
            except ApiError as exc:
                enc_error = exc.code
            except Exception as exc:  # noqa: BLE001 - an unparsable document
                enc_error = type(exc).__name__
    ensure_recorder(conn, model=info.get("model") or None, firmware=info.get("firmware") or None, recorder_id=rid)
    _store_capabilities(conn, rs, rid)
    has_source_ref = _has_column(conn, "cameras", "source_ref")
    now = now_iso()
    created = updated = replaced = 0
    for ch in channels:
        status = "online" if ch.online else "offline" if ch.online is False else "unknown"
        source_ref = str(ch.channel)
        if has_source_ref:
            existing = conn.execute("SELECT * FROM cameras WHERE recorder_id = ? AND source_ref = ?", (rid, source_ref)).fetchone()
            if existing is None:  # a row restored from an older backup (no source_ref yet): matched by its channel once
                existing = conn.execute("SELECT * FROM cameras WHERE recorder_id = ? AND channel = ? AND source_ref IS NULL", (rid, ch.channel)).fetchone()
        else:
            existing = conn.execute("SELECT * FROM cameras WHERE recorder_id = ? AND channel = ?", (rid, ch.channel)).fetchone()
        previous = stream_codecs.encoding_of(existing) if existing else None
        encoding = stream_codecs.build(ch, encodings.get(ch.channel), previous, error=enc_error, now=now)
        caps = json.dumps({**({"stream": ch.stream} if ch.stream else {}), **({"encoding": encoding} if encoding else {})}, ensure_ascii=False)
        fp = fingerprint(conn, rid, getattr(ch, "device_model", None), getattr(ch, "device_serial", None)) if has_source_ref else None
        if existing:
            conn.execute(
                "UPDATE cameras SET name_source = ?, main_track = COALESCE(?, main_track), sub_track = COALESCE(?, sub_track), capabilities_json = ?, status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?",
                (ch.name, ch.main_track, ch.sub_track, caps, status, now, now, existing["id"]),
            )
            if has_source_ref:
                old_fp = existing["device_fingerprint"]
                if fp and old_fp and fp != old_fp and existing["enabled"]:
                    # another physical camera in a known slot: disabled until the administrator re-enables it (ADP section 3.3)
                    conn.execute("UPDATE cameras SET enabled = 0 WHERE id = ?", (existing["id"],))
                    audit(conn, actor=None, action="cameras.replaced", decision="allowed", resource_type="camera", resource_id=existing["id"], request_id=request_id,
                          details={"recorder_id": rid, "channel": ch.channel, "disabled": True})
                    replaced += 1
                conn.execute("UPDATE cameras SET source_ref = COALESCE(source_ref, ?), device_fingerprint = COALESCE(?, device_fingerprint) WHERE id = ?",
                             (source_ref, fp, existing["id"]))
            updated += 1
        else:
            cid = new_id()
            conn.execute(
                "INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (cid, rid, ch.channel, ch.name, ch.channel, ch.main_track, ch.sub_track, caps, status, now, now, now),
            )
            if has_source_ref:
                conn.execute("UPDATE cameras SET source_ref = ?, device_fingerprint = ? WHERE id = ?", (source_ref, fp, cid))
            created += 1
    audit(conn, actor=actor, action="cameras.sync", decision="allowed", resource_type="recorder", resource_id=rid, request_id=request_id,
          details={"channels": len(channels), "created": created, "updated": updated, "model": info.get("model"), "reason": reason,
                   **({"replaced": replaced} if replaced else {})})
    return {"channels": len(channels), "created": created, "updated": updated, "recorder_id": rid,
            "recorder": {"model": info.get("model"), "firmware": info.get("firmware")}}


def _has_column(conn: sqlite3.Connection, table: str, column: str) -> bool:
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})").fetchall())


def _removed_recorders(conn: sqlite3.Connection) -> list[str]:
    try:
        return [r["id"] for r in conn.execute("SELECT id FROM recorders WHERE removed_at IS NOT NULL").fetchall()]
    except sqlite3.OperationalError:
        return []


def ensure_streams(settings: Settings, conn: sqlite3.Connection, actor: Any | None = None, request_id: str | None = None, reason: str = "manual") -> dict[str, Any]:
    """Create/refresh the product's namespaced live streams in go2rtc for every enabled camera (idempotent). CR-024: each
    camera's source is built from its own recorder's connection; a camera whose recorder has no usable connection is skipped
    (counted), and the streams of a REMOVED recorder are deleted by their exact names (`smplwise_{recorder}_ch{n}_{profile}`)
    so its credentials do not stay in go2rtc. Nothing outside the `smplwise_` namespace is ever created, changed or deleted."""
    client = g2.Go2rtc(settings)
    result: dict[str, Any] = {"created": 0, "updated": 0, "unchanged": 0, "skipped": 0, "removed": 0, "streams": []}
    from ..recorder_scope import DISABLED

    disabled = set(DISABLED)  # CR-024: a disabled recorder's streams leave go2rtc (by exact name) and are not re-created
    cams = [c for c in conn.execute("SELECT * FROM cameras WHERE enabled = 1 ORDER BY recorder_id, channel").fetchall() if c["recorder_id"] not in disabled]
    removed_ids = sorted(set(_removed_recorders(conn)) | disabled)
    gone = [g2.stream_name(r["recorder_id"], r["channel"], p) for r in conn.execute(
        f"SELECT recorder_id, channel FROM cameras WHERE recorder_id IN ({','.join('?' * len(removed_ids))})", removed_ids).fetchall()
        for p in ("sub", "main")] if removed_ids else []
    from .recorders import vendor_io

    sources = vendor_io.LiveSources()  # CR-025: a Provision recorder's source path comes from the device
    with unlocked(conn):
        for cam in cams:
            rs = settings_for(settings, cam["recorder_id"])
            for profile in ("sub", "main"):
                name = g2.stream_name(cam["recorder_id"], cam["channel"], profile)
                try:
                    src = (sources.url(rs, cam["recorder_id"], cam["channel"], profile) if vendor_io.handles(rs)
                           else g2.hikvision_rtsp_url(rs, cam["channel"], profile))
                except ApiError:
                    if rs is settings:
                        raise  # the first recorder keeps its old behaviour (the error is the run's outcome)
                    result["skipped"] += 1  # a further recorder without a usable connection: its cameras wait for it
                    continue
                outcome = client.ensure_stream(name, src)
                result[outcome] += 1
                result["streams"].append(name)
        listed = client.list_streams()
        for name in gone:
            if name in listed and name.startswith(g2.STREAM_PREFIX):
                client.delete_stream(name)
                result["removed"] += 1
        foreign = [n for n in listed if not n.startswith(g2.STREAM_PREFIX)]
    result["foreign_streams_untouched"] = len(foreign)
    if result["created"] or result["updated"] or result["removed"] or reason == "manual":
        audit(conn, actor=actor, action="media.streams.sync", decision="allowed", resource_type="installation", resource_id="*", request_id=request_id,
              details={**{k: v for k, v in result.items() if k != "streams"}, "reason": reason})
    return result


def _discover_one(db: Database, settings: Settings, rid: str, reason: str) -> bool:
    st = recorder_state(rid)
    st["last_reason"] = reason
    st["cameras_last_run"] = now_iso()
    try:
        with db.connection() as conn:
            r = sync_cameras(settings, conn, actor=None, reason=reason, recorder_id=rid)
        st["cameras_last_ok"] = now_iso()
        st["cameras_last_error"] = None
        log.info("auto discovery (%s, %s): %d channels, %d new", reason, rid, r["channels"], r["created"])
        return True
    except ApiError as exc:
        st["cameras_last_error"] = exc.code
        log.warning("auto discovery (%s, %s) failed: %s %s", reason, rid, exc.code, exc.details)
    except Exception as exc:  # never die; one recorder never stops another
        st["cameras_last_error"] = type(exc).__name__
        log.exception("auto discovery (%s, %s) crashed", reason, rid)
    return False


def run_once(db: Database, settings: Settings, reason: str = "startup") -> None:
    """Background discovery of every recorder: never raises; the outcome is kept in STATE / RECORDER_STATE for /health."""
    STATE["last_reason"] = reason
    STATE["cameras_last_run"] = now_iso()
    rids = ready_ids(settings)
    if not ready(settings):
        STATE["cameras_last_error"] = "nvr_not_configured"
    if not rids:
        return
    ok = [rid for rid in rids if _discover_one(db, settings, rid, reason)]
    if not ok:
        return
    STATE["streams_last_run"] = now_iso()  # the stream sync's own attempt time (the setup wizard dates a failure by it)
    if not settings.go2rtc_url:
        STATE["streams_last_error"] = "media_not_configured"
        return
    try:
        with db.connection() as conn:
            r = ensure_streams(settings, conn, actor=None, reason=reason)
        STATE["streams_last_ok"] = now_iso()
        STATE["streams_last_error"] = None
        if r["created"] or r["updated"] or r["removed"]:
            log.info("go2rtc streams (%s): %d created, %d updated, %d removed, %d foreign untouched", reason, r["created"], r["updated"], r["removed"],
                     r["foreign_streams_untouched"])
    except ApiError as exc:
        STATE["streams_last_error"] = exc.code
        log.warning("go2rtc stream sync (%s) failed: %s", reason, exc.code)
    except Exception as exc:
        STATE["streams_last_error"] = type(exc).__name__
        log.exception("go2rtc stream sync (%s) crashed", reason)


class Periodic:
    def __init__(self) -> None:
        self.last = 0.0

    def due(self) -> bool:
        return time.time() - self.last >= INTERVAL_S

    def mark(self) -> None:
        self.last = time.time()


PERIODIC = Periodic()
