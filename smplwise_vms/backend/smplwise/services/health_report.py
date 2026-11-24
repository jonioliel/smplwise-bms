"""Health report (T033): one check per subsystem with its own status, so the operator sees which part is fine,
which is not configured and which is failing — never one green light for everything. Device probes are
cached for a short while so the settings page cannot hammer the NVR."""
from __future__ import annotations

import os
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Any

from .. import __version__
from . import media_reach
from ..capabilities import NVR_WITHOUT_GO2RTC, UNSUPPORTED_ACTIONS, UNSUPPORTED_MESSAGES, go2rtc_url, installation_block
from ..capabilities import resolve as resolve_capabilities
from ..config import Settings
from ..db import get_setting, now_iso, permission_revision, recent_storage_refusal_age
from ..errors import reason_of
from ..i18n import cat, join, t
from . import health_report_text  # noqa: F401 - registers the `health.*` texts (I18N-BACKEND-2490)
from . import autosync, events_derive, events_ingest, ha_bridge, ha_client, ha_sync, media_store, thumbnails
from . import backup as backup_svc
from .ttl_cache import TtlCache
from ..mode import installation_mode, is_ha_only
from ..test_reset import register_reset

PROBE_TTL_S = 20
HA_GRACE_S = 60  # NVR-less mode: a Home Assistant disconnection longer than this is an error
STORAGE_ERROR_FREE = 512 * 1024**2  # less free space than this on /data is an error (the report's storage check and the top-bar summary)
STARTED = time.time()
# CR-HEALTH-POLLERS (03:F21, F14): the shared TTL cache; one probe per key at a time, so two report builds probe once
_probe_cache: TtlCache[str, dict[str, Any]] = TtlCache(PROBE_TTL_S)


def _check(id: str, label: str, status: str, detail: str, **meta: Any) -> dict[str, Any]:
    return {"id": id, "label": label, "status": status, "detail": detail, "meta": meta}


def _dir_size(p: Path) -> int:
    total = 0
    if not p.exists():
        return 0
    for root, _dirs, files in os.walk(p):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def _fmt_bytes(n: int) -> str:
    if n >= 1024**3:
        return f"{n / 1024**3:.1f} GB"
    if n >= 1024**2:
        return f"{n / 1024**2:.0f} MB"
    return f"{n / 1024:.0f} KB"


def _age_s(iso: str | None) -> float | None:
    if not iso:
        return None
    import datetime as dt

    try:
        t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (dt.datetime.now(dt.timezone.utc) - t).total_seconds()


def _cached(key: str, fn) -> dict[str, Any]:
    return _probe_cache.load(key, fn, ttl=PROBE_TTL_S)


def invalidate() -> None:
    _probe_cache.clear()


def cached_status(key: str) -> str | None:
    """The status of the last probe of `key` ("nvr" | "go2rtc") at any age, None before the first one. Never probes."""
    hit = _probe_cache.peek(key)
    return hit[1].get("status") if hit else None


def _recent_reading(recorder_id: str) -> dict[str, Any] | None:
    """CR-HEALTH-POLLERS (03:F14): the recorder-health poller's reading of this recorder when it is online and younger than the
    probe TTL - the same device call the probe would repeat. Anything else (no reading, old, unreachable) returns None and the
    probe runs as before."""
    from . import recorder_health

    hit = recorder_health.recent_online(recorder_id, PROBE_TTL_S)
    if hit is None:
        return None
    return {"status": "ok", "detail": _connected(hit["model"], hit["firmware"]), "configured": True, "model": hit["model"],
            "firmware": hit["firmware"], "ms": hit["latency_ms"]}


def _connected(model: Any, firmware: Any) -> Any:
    return t("health.nvr.connected", model=model or t("health.model_unknown"), firmware=firmware or "?")


def _probe_nvr(settings: Settings) -> dict[str, Any]:
    from . import nvr

    if not (settings.nvr_host and settings.nvr_user):
        return {"status": "warn", "detail": t("health.nvr.not_configured"), "configured": False}
    recent = _recent_reading(getattr(settings, "nvr_recorder_id", None) or "nvr-1")
    if recent is not None:
        return recent
    t0 = time.time()
    from .recorders import vendor_io

    if vendor_io.handles(settings) or (settings.nvr_vendor or "") == "frigate":  # CR-025: a Provision-ISR / NN5: Frigate recorder answers through its adapter
        if (settings.nvr_vendor or "") == "frigate":
            from .recorders.frigate import FrigateAdapter

            h = FrigateAdapter(getattr(settings, "nvr_recorder_id", None) or "nvr-1", settings).health()
        else:
            h = vendor_io.adapter(settings, getattr(settings, "nvr_recorder_id", None) or "nvr-1").health()
        if not h.online:
            return {"status": "error", "detail": t("health.nvr.no_answer", error=h.error), "configured": True, "error": h.error}
        return {"status": "ok", "detail": _connected(h.model, h.firmware), "configured": True, "model": h.model, "firmware": h.firmware,
                "ms": int((time.time() - t0) * 1000)}
    try:
        info = nvr.device_info(settings)
    except Exception as exc:  # noqa: BLE001 - the report must never fail because a device is down
        return {"status": "error", "detail": t("health.nvr.no_answer", error=reason_of(exc)), "configured": True, "error": reason_of(exc)}
    return {"status": "ok", "detail": _connected(info.get("model"), info.get("firmware")), "configured": True, "model": info.get("model"), "firmware": info.get("firmware"), "ms": int((time.time() - t0) * 1000)}


def _probe_go2rtc(settings: Settings) -> dict[str, Any]:
    from .go2rtc import STREAM_PREFIX, Go2rtc

    if not settings.go2rtc_url:
        return {"status": "warn", "detail": t("health.go2rtc.no_url"), "configured": False}
    try:
        g = Go2rtc(settings)
        info = g.info()
        streams = g.list_streams()
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "detail": t("health.go2rtc.unavailable", error=reason_of(exc)), "configured": True, "error": reason_of(exc)}
    ours = [s for s in streams if s.startswith(STREAM_PREFIX)]
    online = sum(1 for s in ours if streams[s].online)
    idle = sum(1 for s in ours if streams[s].state == "idle")  # GO2RTC-STREAM-SYNC-2436: ready, connected when someone watches
    return {"status": "ok", "detail": t("health.go2rtc.ok", version=info.get("version", "?"), ours=len(ours), online=online, idle=idle, foreign=len(streams) - len(ours)), "configured": True, "version": info.get("version"), "streams": len(ours), "online": online, "idle": idle, "foreign": len(streams) - len(ours)}


VIDEO_REASON = {"h265": "H.265", "mjpeg": "MJPEG", "b_frames": "B-frames", "svc": "SVC"}


def _video_check(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    """CR-008 D7: which main / sub streams play over WebRTC (from the last discovery). A warning only when it matters:
    the remote channel is on and remote viewers get the main stream first; otherwise the same facts, status ok."""
    from . import stream_codecs

    s = stream_codecs.summary(conn, with_names=True)
    blocked = s["main_not_webrtc"]
    if not s["checked"]:
        return _check("video_webrtc", t("health.video.label"), "ok", t("health.video.unread"), **s)
    m, sub = s["main"], s["sub"]
    detail: Any = t("health.video.counts", m_ok=m["ok"], m_no=m["no"], m_unknown=m["unknown"], s_ok=sub["ok"], s_no=sub["no"], s_unknown=sub["unknown"])
    if blocked:
        names = ", ".join(f"{b['name']} ({VIDEO_REASON.get(str(b['reason']), b['reason'])})" for b in blocked[:6])
        detail = cat(detail, t("health.video.blocked", list=names, more=t("health.video.more", n=len(blocked) - 6) if len(blocked) > 6 else ""))
    remote_main = bool(settings.remote_access) and (get_setting(conn, "remote.default_profile", "main") or "main") == "main"
    status = "warn" if blocked and remote_main else "ok"
    return _check("video_webrtc", t("health.video.label"), status, detail, remote_main_first=remote_main, **s)


# CR-BE-COMPLEXITY-2450 (code review 03:F22): build() was one 160-line function (cyclomatic complexity 104). It is now the list of
# check families below, called in the same order with the same reads; each helper returns the checks it adds (none, one or more).
# tests/test_health_report_char_2450.py pins the output recorded before the split.


def _db_check(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        integrity = conn.execute("PRAGMA quick_check").fetchone()[0]
        journal = conn.execute("PRAGMA journal_mode").fetchone()[0]
        db_bytes = settings.db_path.stat().st_size if settings.db_path.exists() else 0
        detail = t("health.db.detail", integrity=t("health.db.ok") if integrity == "ok" else integrity, journal=journal.upper(), size=_fmt_bytes(db_bytes),
                   schema=backup_svc.schema_version(conn), revision=permission_revision(conn))
        return _check("db", t("health.db.label"), "ok" if integrity == "ok" else "error", detail, integrity=integrity, journal=journal, bytes=db_bytes, schema=backup_svc.schema_version(conn))
    except sqlite3.Error as exc:
        return _check("db", t("health.db.label"), "error", t("health.db.error", error=type(exc).__name__))


def _storage_check(settings: Settings) -> dict[str, Any]:
    try:
        du = shutil.disk_usage(settings.data_dir)
        sizes = {"plans": _dir_size(settings.plans_dir), "thumbs": _dir_size(settings.data_dir / "thumbs"), "backups": _dir_size(settings.data_dir / "backups"), "exports": _dir_size(settings.data_dir / "exports"), "imported": _dir_size(settings.data_dir / "imported")}
        free_ratio = du.free / du.total if du.total else 1
        st = "error" if du.free < STORAGE_ERROR_FREE else "warn" if (du.free < 2 * 1024**3 or free_ratio < 0.10) else "ok"
        refused = recent_storage_refusal_age()  # T068-EDGE-2450: a write was refused for lack of space although `free` looks fine (quota)
        if refused is not None:
            st = "error"
        detail = t("health.storage.detail", free=_fmt_bytes(du.free), total=_fmt_bytes(du.total), plans=_fmt_bytes(sizes["plans"]), thumbs=_fmt_bytes(sizes["thumbs"]),
                   backups=_fmt_bytes(sizes["backups"]), exports=_fmt_bytes(sizes["exports"]), imported=_fmt_bytes(sizes["imported"]))
        if refused is not None:
            detail = join(" · ", [detail, t("health.storage.refused")])
        return _check("storage", t("health.storage.label"), st, detail, free=du.free, total=du.total, **sizes)
    except OSError as exc:
        return _check("storage", t("health.storage.label"), "error", t("health.storage.unreadable", error=type(exc).__name__))


def _device_states(settings: Settings, caps: Any, ha_only: bool, probe: bool) -> tuple[dict[str, Any], dict[str, Any]]:
    """The NVR and go2rtc states (probed and cached, or a fixed answer when not probed / not part of this installation)."""
    if ha_only:
        # NVR-less mode (mode.py): the NVR is not part of this installation - a neutral "off", never a warning; go2rtc is
        # optional (WisKey station video) and is probed only when it is configured
        nvr = {"status": "off", "detail": t("health.nvr.ha_only"), "configured": False, "mode": "ha_only"}  # its Hebrew starts with mode.NVR_LESS_LABEL
        go = _cached("go2rtc", lambda: _probe_go2rtc(settings)) if (probe and settings.go2rtc_url) else (
            {"status": "off", "detail": t("health.go2rtc.optional_off"), "configured": False} if not settings.go2rtc_url else {"status": "warn", "detail": t("health.not_checked")})
    elif probe:
        nvr = _cached("nvr", lambda: _probe_nvr(settings))
        go = _cached("go2rtc", lambda: _probe_go2rtc(settings))
        if caps.unsupported_reason == NVR_WITHOUT_GO2RTC and settings.nvr_user:
            # NN1, owner decision 2026-10-03: a connected NVR without go2rtc is not a supported installation - an error that
            # says why (a fresh install whose NVR is not connected yet keeps the "not configured" warning above)
            go = {"status": "error", "detail": t("health.go2rtc.unsupported", message=UNSUPPORTED_MESSAGES[NVR_WITHOUT_GO2RTC], action=UNSUPPORTED_ACTIONS[NVR_WITHOUT_GO2RTC]),
                  "configured": False, "required": True}
    else:
        nvr = {"status": "warn", "detail": t("health.not_checked")}
        go = {"status": "warn", "detail": t("health.not_checked")}
    return nvr, go


def _device_checks(settings: Settings, conn: sqlite3.Connection, caps: Any, ha_only: bool, probe: bool) -> list[dict[str, Any]]:
    nvr, go = _device_states(settings, caps, ha_only, probe)
    from .recorders import vendor_io

    nvr_label = "NVR (Provision-ISR)" if vendor_io.handles(settings) else "NVR (Hikvision ISAPI)"
    checks = [_check("nvr", nvr_label, nvr["status"], nvr["detail"], **{k: v for k, v in nvr.items() if k not in ("status", "detail")})]
    checks.extend(_recorder_time_checks(settings, conn))
    checks.append(_check("go2rtc", t("health.go2rtc.label"), go["status"], go["detail"], **{k: v for k, v in go.items() if k not in ("status", "detail")}))
    return checks


def _conn_word(connected: Any) -> Any:
    return t("health.connected") if connected else t("health.disconnected")


def _ha_sync_check(settings: Settings) -> dict[str, Any]:
    hs = ha_sync.STATE.as_dict()
    if not ha_client.configured(settings):
        return _check("ha_sync", t("health.ha.label"), "error" if is_ha_only(settings) else "warn", t("health.ha.not_configured"), configured=False)
    else:
        age = _age_s(hs.get("last_event_at") or hs.get("last_snapshot_at"))
        st = "ok" if hs.get("connected") else ("warn" if hs.get("last_snapshot_at") else "error")
        if is_ha_only(settings) and not hs.get("connected") and ha_sync.STATE.down_for() > HA_GRACE_S:
            st = "error"  # NVR-less mode: Home Assistant is the product
        detail = t("health.ha.detail", state=_conn_word(hs.get("connected")), entities=hs.get("entities", 0), version=hs.get("ha_version") or "?",
                   age=t("health.s_ago", n=int(age)) if age is not None else "—", error=" · " + str(hs.get("last_error")) if hs.get("last_error") else "")
        return _check("ha_sync", t("health.ha.label"), st, detail, **hs)


def _bridge_check(conn: sqlite3.Connection) -> dict[str, Any]:
    paired = ha_bridge.is_paired_secret(conn) and bool(get_setting(conn, "bridge.paired_at"))
    users = conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0] if "ha_users" in {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")} else 0
    dir_age = _age_s(get_setting(conn, "bridge.directory_at") or None)
    bridge_v = get_setting(conn, "bridge.integration_version")
    bridge_old = paired and bool(bridge_v) and media_store.version_tuple(bridge_v) < media_store.version_tuple(ha_bridge.BRIDGE_EQUIPMENT_REQUIRED)
    detail = t("health.bridge.detail", paired=t("health.bridge.paired") if paired else t("health.bridge.not_paired"), version=get_setting(conn, "bridge.integration_version") or "?",
               outdated=t("health.bridge.outdated", required=ha_bridge.BRIDGE_EQUIPMENT_REQUIRED) if bridge_old else "", users=users,
               age=t("health.min_ago", n=int(dir_age // 60)) if dir_age is not None else t("health.bridge.not_yet"))
    return _check("bridge", t("health.bridge.label"), "ok" if paired and not bridge_old and (dir_age is None or dir_age < 15 * 60) else ("warn" if paired else "warn"), detail, paired=paired, integration_version=get_setting(conn, "bridge.integration_version"), bridge_required=ha_bridge.BRIDGE_EQUIPMENT_REQUIRED, bridge_outdated=bridge_old, directory_users=users, directory_age_s=dir_age)


def _event_checks(settings: Settings, conn: sqlite3.Connection, ha_only: bool) -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = []
    ing = events_ingest.STATE.as_dict()
    if ha_only:
        pass  # NVR-less mode: no alert stream, no derived events, no discovery, thumbnails or exports (see the nvr check)
    elif not (settings.nvr_host and settings.nvr_user):
        checks.append(_check("events_ingest", t("health.ingest.label_short"), "warn", t("health.ingest.not_configured"), configured=False))
    else:
        hb = _age_s(ing.get("last_heartbeat_at"))
        detail = t("health.ingest.detail", state=_conn_word(ing.get("connected")), heartbeat=t("health.s_ago", n=int(hb)) if hb is not None else "—",
                   stored=ing.get("events_stored", 0), reconnects=ing.get("reconnects", 0), error=" · " + str(ing.get("last_error")) if ing.get("last_error") else "")
        checks.append(_check("events_ingest", t("health.ingest.label"), "ok" if ing.get("connected") else "error", detail, **ing))
    dv = dict(events_derive.STATE)
    dage = _age_s(dv.get("last_ok"))
    if not ha_only:
        state = (t("health.derive.error", error=str(dv["last_error"])) if dv.get("last_error")
                 else t("health.updated_min_ago", n=int(dage // 60)) if dage is not None else t("health.not_run_yet"))
        detail = t("health.derive.detail", state=state, derived=dv.get("derived", 0), events=conn.execute("SELECT COUNT(*) FROM events").fetchone()[0])
        checks.append(_check("events_derive", t("health.derive.label"), "error" if dv.get("last_error") else ("ok" if dv.get("last_ok") else "warn"), detail, **dv))
    return checks


def _job_checks(settings: Settings, conn: sqlite3.Connection, ha_only: bool) -> list[dict[str, Any]]:
    """discovery / video / thumbnails / exports / sessions / backups"""
    checks: list[dict[str, Any]] = []
    ds = dict(autosync.STATE)
    cams = conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
    cage = _age_s(ds.get("cameras_last_ok"))
    if not ha_only:
        detail = t("health.discovery.detail", cameras=cams, age=t("health.updated_min_ago", n=int(cage // 60)) if cage is not None else t("health.not_run_yet"),
                   every=autosync.INTERVAL_S // 60, error=" · " + str(ds.get("cameras_last_error")) if ds.get("cameras_last_error") else "")
        checks.append(_check("discovery", t("health.discovery.label"), "error" if ds.get("cameras_last_error") else ("ok" if ds.get("cameras_last_ok") else "warn"), detail, cameras=cams, **ds))
    if not ha_only:
        checks.append(_video_check(settings, conn))
    th = dict(thumbnails.STATE)
    if not ha_only:
        detail = t("health.thumbs.detail", generated=th.get("generated", 0), failed=th.get("failed", 0), queued=th.get("queued", 0),
                   last=t("health.thumbs.last", error=str(th.get("last_error"))) if th.get("last_error") else "")
        checks.append(_check("thumbnails", t("health.thumbs.label"), "error" if th.get("last_error") == "ffmpeg_missing" else ("warn" if th.get("failed", 0) > th.get("generated", 0) and th.get("failed", 0) > 3 else "ok"), detail, **th))
    jobs = {r[0]: r[1] for r in conn.execute("SELECT state, COUNT(*) FROM export_jobs GROUP BY state").fetchall()}
    from . import exports as exports_svc

    disk = exports_svc.disk_state(settings, exports_svc.min_free_mb(conn))  # T068: a full data disk pauses exports
    disk_note = t("health.exports.disk_low", free=disk["free_mb"], min=disk["min_free_mb"]) if disk["low"] else ""
    if not ha_only:
        checks.append(_check("exports", t("health.exports.label"), "warn" if jobs.get("failed") or jobs.get("paused_disk_full") or disk["low"] else "ok",
                             cat(" · ".join(f"{n} {s}" for s, n in jobs.items()) if jobs else t("health.exports.none"), disk_note), data_disk=disk, **jobs))
    from ..routers.media import REGISTRY as LIVE
    from .playback import REGISTRY as PB

    live_n = LIVE.count()
    pb_n = len(PB.active())
    checks.append(_check("sessions", t("health.sessions.label"), "ok", t("health.sessions.detail", live=live_n, playback=pb_n), live=live_n, playback=pb_n))
    backups = backup_svc.list_backups(settings)
    last = backups[0] if backups else None
    bage = _age_s(last["created_at"]) if last else None
    detail = t("health.backups.detail", count=len(backups), last=last["name"] + " (" + last["kind"] + ")" if last else t("health.backups.none_yet"),
               age=t("health.backups.h_ago", n=int(bage // 3600)) if bage is not None else "")
    checks.append(_check("backups", t("health.backups.label"), "error" if not last else ("warn" if bage is not None and bage > 2 * 86400 else "ok"), detail, count=len(backups), last=last["name"] if last else None, last_kind=last["kind"] if last else None, last_age_s=bage))
    return checks


def _portal_check() -> dict[str, Any] | None:
    # PUBCOUNT-295 / D-04: the vendor portal's start worker (switch OFF by default) answers "sent" even when its queue dropped the request;
    # the administrator sees the counts here (shown once a worker ran or anything was counted; a drop within the last hour is a warning)
    from .tickets import public_portal

    ps = public_portal.worker_stats()
    if ps["running"] or ps["accepted"] or ps["dropped"]:
        return _check("portal_start", t("health.portal.label"), "warn" if ps["dropped_1h"] else "ok",
                      t("health.portal.detail", accepted=ps["accepted"], dropped=ps["dropped"], dropped_1h=ps["dropped_1h"], depth=ps["depth"], max=ps["max"]), **ps)
    return None


def _transit_check(conn: sqlite3.Connection) -> dict[str, Any] | None:
    # BUSTIMES-295: the public-transport source (only while the module is in use): last success, age of the data, error count. No ticket action.
    from datetime import datetime, timezone

    from .transit import health as transit_health

    tv = transit_health.view(conn, datetime.now(timezone.utc))
    if tv["state"] != "off":
        age = tv["age_s"]
        age_text = t("health.transit.no_data") if age is None else t("health.transit.age", n=age // 60)
        # BUSSTATUS-297: a provider outage (5xx / timeout) is a calm "external data source unavailable" with the last good time, not a warning
        # (it escalates to a warning after `outage_warn_h`, default 6 h)
        source_down = tv["state"] == "source_down"
        lead = t("health.transit.source_down", last=tv["last_good_at"] or t("health.unknown")) if source_down else ""
        detail = cat(lead, t("health.transit.detail", age=age_text, codes=tv["codes_in_use"], errors=tv["errors"]),
                     t("health.transit.last_error", error=tv["last_error"]) if tv["last_error"] else "")
        return _check("transit", t("health.transit.label"), "ok" if tv["state"] in ("ok", "source_down") else "warn", detail,
                      state=tv["state"], age_s=age, last_ok_at=tv["last_ok_at"], last_good_at=tv["last_good_at"], outage=tv["outage"], errors=tv["errors"],
                      codes_in_use=tv["codes_in_use"])
    return None


def _secret_options_check() -> dict[str, Any] | None:
    # 2.6.3 transitional (delta review S-1): a former secret option still holds a value in the add-on configuration (names only)
    from . import secrets_store

    if secrets_store.LINGERING_OPTIONS:
        names = ", ".join(secrets_store.LINGERING_OPTIONS)
        return _check("secret_options", t("health.secrets.label"), "warn", t("health.secrets.detail", names=names),
                      names=list(secrets_store.LINGERING_OPTIONS))
    return None


def _worst(checks: list[dict[str, Any]]) -> str:
    worst = "ok"  # "off" (not part of this installation) never lowers the overall status
    for c in checks:
        if c["status"] == "error":
            worst = "error"
            break
        if c["status"] == "warn":
            worst = "warn"
    return worst


def build(settings: Settings, conn: sqlite3.Connection, probe: bool = True) -> dict[str, Any]:
    checks: list[dict[str, Any]] = [_db_check(settings, conn), _storage_check(settings)]
    # devices (probed, cached)
    ha_only = is_ha_only(settings)
    caps = resolve_capabilities(settings, conn)  # NVRLESS-CAMERAS-2411: cameras without a recorder count
    checks += _device_checks(settings, conn, caps, ha_only, probe)
    # Home Assistant sync + bridge
    checks += [_ha_sync_check(settings), _bridge_check(conn)]
    checks += _event_checks(settings, conn, ha_only)
    checks += _job_checks(settings, conn, ha_only)
    # the optional checks: each shows only when it has something to say
    for extra in (_portal_check(), _transit_check(conn), _restarts_check(settings), _secret_options_check()):
        if extra:
            checks.append(extra)
    return {"status": _worst(checks), "mode": installation_mode(settings), "version": __version__, "uptime_s": int(time.time() - STARTED), "checked_at": now_iso(), "probe_ttl_s": PROBE_TTL_S,
            # NN1: the report is for system administrators only, so the recorder detail is included
            "capabilities": caps.as_dict(with_recorders=True), "installation": installation_block(caps), "checks": checks}


def _restarts_view(settings: Settings) -> dict[str, Any]:
    from .. import crashguard

    try:
        return crashguard.state_view(settings.data_dir)
    except Exception:  # noqa: BLE001 - the report never fails because of the crash record
        return {"count_total": 0, "crashes_24h": 0, "safe_mode": False, "last_at": None, "last_signal": None, "last_uptime_s": None, "supervised": False}


def _restarts_check(settings: Settings) -> dict[str, Any] | None:
    """The crash guard's record (smplwise/crashguard.py): how often the server process died from a signal and was started again.
    Shown only once there is something to show; warn while a crash is less than 24 hours old or safe mode is on."""
    rv = _restarts_view(settings)
    if not rv["count_total"] and not rv["safe_mode"]:
        return None
    parts: list[Any] = [t("health.restarts.day", n=rv["crashes_24h"]), t("health.restarts.total", n=rv["count_total"])]
    if rv["last_at"]:
        parts.append(t("health.restarts.last", at=rv["last_at"], signal=rv["last_signal"], uptime=int(rv["last_uptime_s"] or 0)))
    if rv["safe_mode"]:
        parts.append(t("health.restarts.safe_mode"))
    parts.append(t("health.restarts.trace"))
    status = "warn" if rv["crashes_24h"] or rv["safe_mode"] else "ok"
    return _check("process_restarts", t("health.restarts.label"), status, join(" · ", parts), **rv)


def summary(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    """Cheap status for every signed-in user (top-bar pill): only cached job states and the backup age, never a
    network probe. `items` lists what is wrong in operator words; `status` is the worst of them."""
    items: list[dict[str, Any]] = []
    nvr = bool(settings.nvr_host and settings.nvr_user)
    ing = events_ingest.STATE
    if is_ha_only(settings):
        pass  # NVR-less mode: no NVR is expected, so its absence is not something to check (mode.py)
    elif nvr:
        down_for = (time.time() - ing.disconnected_since) if (not ing.connected and ing.disconnected_since) else 0
        if not ing.connected and (down_for > 60 or not ing.last_heartbeat_at):
            items.append({"id": "nvr", "status": "error", "label": t("health.sum.nvr_down")})
        ds = autosync.STATE
        if ds.get("cameras_last_error") and not ds.get("cameras_last_ok"):
            items.append({"id": "discovery", "status": "error", "label": t("health.sum.discovery_failed")})
        elif ds.get("cameras_last_error"):
            items.append({"id": "discovery", "status": "warn", "label": t("health.sum.discovery_last_failed")})
        if not go2rtc_url(settings):
            # NN1, owner decision 2026-10-03: an NVR without go2rtc is not a supported installation (operator wording)
            items.append({"id": "go2rtc", "status": "error", "label": t("health.sum.go2rtc_missing")})
        elif ds.get("streams_last_error") and not media_reach.REACH.unreachable(settings):  # unreachable: the item below says it all
            items.append({"id": "go2rtc", "status": "warn", "label": t("health.sum.go2rtc_sync")})
    else:
        items.append({"id": "nvr", "status": "warn", "label": t("health.sum.nvr_not_set")})
    if media_reach.REACH.unreachable(settings):
        # HEALTH-GO2RTC-2430 (lab 11.11: two days of silent "ok"): the video service did not answer the add-on's last contact - every
        # live, playback and snapshot path is down. Operator wording, no component name; system.health raises the administrators'
        # notice once this held for the policy's after_s (300 s) and resolves it on recovery (notify_sources.HEALTH_ITEMS).
        items.append({"id": "video_service", "status": "error", "label": t("health.sum.video_service"), "since": media_reach.REACH.view(settings)["since"]})
    hs_now = ha_sync.STATE
    if ha_client.configured(settings) and not hs_now.connected and hs_now.last_error == "ha_forbidden":
        # T035 (outage run): the platform refused the add-on's token - this does not heal by waiting, so it is said plainly
        items.append({"id": "ha", "status": "error", "label": t("health.sum.ha_forbidden")})
    elif is_ha_only(settings):
        # NVR-less mode: Home Assistant is the whole product - missing, or down past a minute, is an error
        hs = ha_sync.STATE
        if not ha_client.configured(settings):
            items.append({"id": "ha", "status": "error", "label": t("health.sum.ha_missing_nvrless")})
        elif not hs.connected and hs.down_for() > HA_GRACE_S:
            items.append({"id": "ha", "status": "error", "label": t("health.sum.ha_down")})
        elif not hs.connected and hs.last_snapshot_at:
            items.append({"id": "ha", "status": "warn", "label": t("health.sum.ha_stale")})
    elif ha_client.configured(settings):
        hs = ha_sync.STATE
        if not hs.connected and hs.last_snapshot_at:
            items.append({"id": "ha", "status": "warn", "label": t("health.sum.ha_stale")})
        elif not hs.connected and not hs.last_snapshot_at and hs.last_error:
            items.append({"id": "ha", "status": "warn", "label": t("health.sum.ha_none")})
    if thumbnails.STATE.get("last_error") == "ffmpeg_missing":
        items.append({"id": "thumbnails", "status": "warn", "label": t("health.sum.ffmpeg")})
    try:  # T035 (outage run): a full data disk reaches every operator, not only the administrator's health report (same threshold)
        if shutil.disk_usage(settings.data_dir).free < STORAGE_ERROR_FREE:
            items.append({"id": "storage", "status": "error", "label": t("health.sum.storage")})
        elif recent_storage_refusal_age() is not None:  # T068-EDGE-2450: writes are being refused although the volume reports free space
            items.append({"id": "storage", "status": "error", "label": t("health.sum.storage_refused")})
    except OSError:
        pass
    backups = backup_svc.list_backups(settings)
    last_age = _age_s(backups[0]["created_at"]) if backups else None
    if not backups:
        items.append({"id": "backups", "status": "warn", "label": t("health.sum.no_backup")})
    elif last_age is not None and last_age > 2 * 86400:
        items.append({"id": "backups", "status": "warn", "label": t("health.sum.backup_old")})
    from .tickets import public_portal

    dropped_1h = public_portal.worker_stats()["dropped_1h"]
    if dropped_1h:  # PUBCOUNT-295 / D-04: the operator notice - a vendor's code request was dropped (the vendor saw "sent")
        items.append({"id": "portal_start", "status": "warn", "label": t("health.sum.portal_dropped", n=dropped_1h)})
    from datetime import datetime, timezone

    from .transit import health as transit_health

    from .transit import model as transit_model

    tv_s = transit_health.view(conn, datetime.now(timezone.utc))
    if tv_s["state"] == "down":  # BUSTIMES-295: the screens show "unavailable" - the installer sees why
        provider = tv_s["consecutive_errors"] > 0 and transit_model.is_outage(tv_s["last_error"])  # BUSSTATUS-297: only after the outage outlasted outage_warn_h
        items.append({"id": "transit", "status": "warn", "label": t("health.sum.transit_provider") if provider else t("health.sum.transit_stale")})
    rv = _restarts_view(settings)
    if rv["crashes_24h"]:
        items.append({"id": "process_restarts", "status": "warn", "label": t("health.sum.crashed", n=rv["crashes_24h"])})
    worst = "ok"
    for it in items:
        if it["status"] == "error":
            worst = "error"
            break
        worst = "warn"
    return {"status": worst, "mode": installation_mode(settings), "items": items, "checked_at": now_iso(), "version": __version__}



def _recorder_time_checks(settings: Settings, conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """CR-025 (owner decision 2026-10-04): per Provision recorder, the time basis (device clock or Israel time) and a note
    when the device's clock rule differs from the installation zone. Cached facts only, never a device call."""
    from ..recorder_scope import configured_ids, settings_for
    from .recorders import vendor_io

    try:
        tz_name = get_setting(conn, "time.zone") or "Asia/Jerusalem"
    except Exception:  # noqa: BLE001
        tz_name = "Asia/Jerusalem"
    out = []
    for rid in configured_ids(settings):
        rs = settings_for(settings, rid)
        if not vendor_io.handles(rs):
            continue
        note = vendor_io.time_note(rs, rid, str(tz_name))
        if note is None:
            continue
        basis = t("health.clock.israel") if note["basis"] == "iana" else t("health.clock.device")
        label = t("health.clock.label", rid=rid)
        if not note.get("known"):
            out.append(_check(f"recorder_time_{rid}", label, "ok", t("health.clock.unread", basis=basis), **note))
        elif note.get("differs_now") or note.get("differs_periods"):
            when = t("health.clock.now") if note.get("differs_now") else t("health.clock.periods")
            out.append(_check(f"recorder_time_{rid}", label, "warn", t("health.clock.differs", basis=basis, when=when), **note))
        else:
            out.append(_check(f"recorder_time_{rid}", label, "ok", t("health.clock.matches", basis=basis), **note))
    return out


register_reset(__name__, ("_probe_cache",), invalidate)  # CR-BE-COMPLEXITY-2450: a shared-class singleton (tests/test_singletons_registered.py)
