from __future__ import annotations

import datetime as dt
import json
import os
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .. import __version__, correlation_id
from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..capabilities import installation_block, may_see_recorders, resolve as resolve_capabilities
from ..db import database_of, lock_stats, permission_revision, pool_stats, unlocked
from ..errors import ApiError
from ..mode import describe as describe_mode
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import autosync, connection_store, events_cache, events_derive, events_ingest, ha_client, ha_sync, stream_codecs
from ..services import health_report as health_report_svc
from ..services import health_store as store
from ..services import log_export
from ..services import media_reach
from ..services import process_stats
from ..services.ttl_cache import TtlCache
from ._common import rid as _rid
from .storage import local_state
from ..test_reset import register_reset

router = APIRouter()


def _write_lock_view(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """The write-lock counters for everyone; who held the lock (request paths with other users' entity / camera ids)
    only for a system.configure holder."""
    stats = lock_stats()
    db = database_of(conn)
    if db is not None:
        stats["gate"] = db.gate.state()  # held / waiting right now
    stats["conn_pool"] = pool_stats()  # DB-CONN-POOL-2343: connections opened / reused
    if not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        stats.pop("max_hold_by", None)
        stats.pop("max_wait_by", None)
        stats.pop("last_busy", None)
    return stats


def _push_view(conn: sqlite3.Connection) -> dict[str, Any]:
    from ..services import push as push_svc

    row = store.push_subscription_counts(conn)
    return {**push_svc.STATS, "running": push_svc.NOTIFIER.running, "subscriptions": row[0], "subscribed_users": row[1],
            "key_created": store.push_key_row(conn) is not None}


def _remote_view(conn: sqlite3.Connection, settings: Any) -> dict[str, Any]:
    """CR-008 P2: the remote channel's live counters - sessions by kind, sign-ins, users, attached sockets, live
    streams running under remote sign-ins and the per-sign-in cap (no ids, no addresses)."""
    from ..services import ha_user_auth
    from .media import remote_live_by_chain
    from ..services.settings_store import setting_value

    live = remote_live_by_chain()
    return {"enabled": bool(settings.remote_access), **ha_user_auth.STORE.stats(), "live_streams": sum(live.values()),
            "max_live_streams_per_sign_in": setting_value(conn, "remote.max_live_streams")}


def _recorders_view(settings: Any) -> list[dict[str, Any]]:
    from ..recorder_scope import configured_ids

    ingest = events_ingest.recorder_states()
    out = []
    for rid in configured_ids(settings):
        st = autosync.recorder_state(rid)
        ev = ingest.get(rid) or {}
        out.append({"id": rid, "discovery_last_ok": st.get("cameras_last_ok"), "discovery_last_error": st.get("cameras_last_error"),
                    "events_connected": bool(ev.get("connected")), "events_last_error": ev.get("last_error")})
    return out


# CR-HEALTH-POLLERS (03:F13). The count of stored events is a scan of the whole events table: one scan answers every /health
# call of the next EVENTS_COUNT_TTL_S seconds (lead decision L11: a count a few seconds old is fine on this screen). The
# ingest's own `events_stored` counter is not the same number - it counts this process's alerts only - so it is not used.
EVENTS_COUNT_TTL_S = 5.0
_EVENTS_COUNT: TtlCache[str, int] = TtlCache(EVENTS_COUNT_TTL_S, maxsize=8)
_RENDERER: dict[str, str] = {}  # PATH value -> renderer name: the directories are scanned once per PATH, not per request


def _events_stored(conn: sqlite3.Connection, settings: Any) -> int:
    return _EVENTS_COUNT.load(str(settings.db_path), lambda: store.event_count(conn))


def _renderer() -> str:
    path = os.environ.get("PATH", "")
    name = _RENDERER.get(path)
    if name is None:
        name = "pdftoppm" if any(os.access(os.path.join(p, "pdftoppm"), os.X_OK) for p in path.split(os.pathsep)) else "pymupdf-or-none"
        _RENDERER.clear()
        _RENDERER[path] = name
    return name


@router.get("/health")
def health(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The add-on's own cached state. A system.configure holder also gets `process` (uptime, threads, open fds, RSS) and the db file sizes.
    SOAK-DBGROWTH-2412: a read - it writes nothing, yet it ran under the write lock (BEGIN IMMEDIATE) with a COUNT(*) over the
    whole events table inside; on a starved host that held every writer for up to 22 s."""
    settings = settings_of(request)
    diagnostics = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    stats = process_stats.snapshot(settings.db_path) if diagnostics else {}
    media = media_reach.REACH.view(settings)
    degraded = ["media_unreachable"] if media["state"] == media_reach.UNREACHABLE else []
    caps = resolve_capabilities(settings, conn)  # CR-HEALTH-POLLERS (03:F13): once per request (was twice)
    sees_recorders = may_see_recorders(permissions_anywhere(conn, principal))  # once per request (was twice)
    return {
        # HEALTH-GO2RTC-2430: `ok` = the add-on works and every configured dependency it can see answers; `degraded` = the add-on
        # works but a dependency does not (`degraded_reasons`; today only `media_unreachable`). The Supervisor watchdog reads
        # /healthz (config.yaml), never this route, so a down video service can never restart the add-on in a loop.
        "status": "degraded" if degraded else "ok",
        "degraded_reasons": degraded,
        "version": __version__,
        # NVR-less mode: `mode` ha_only and nvr.state not_configured - neutral, never a failure of the add-on
        **describe_mode(settings),
        "db": {"ok": store.select_one(conn) == 1, "permission_revision": permission_revision(conn), "write_lock": _write_lock_view(conn, principal),
               **(stats.get("db") or {})},
        # soak measurement (diagnostics only): coarse counters, no paths or names
        **({"process": stats["process"]} if diagnostics else {}),
        "data_dir_writable": os.access(settings.data_dir, os.W_OK),
        "nvr_configured": bool(settings.nvr_host and settings.nvr_user),  # the placeholder host (no user) is not configured
        "go2rtc_configured": bool(settings.go2rtc_url),
        # HEALTH-GO2RTC-2430: reachability, not only configuration - reachable | unreachable | not_configured | unknown, with since
        # (services/media_reach.py: the outcome of the add-on's own go2rtc calls plus a light, backoff-bounded probe; no address)
        "media": media,
        # CR-022 section 8: the stored NVR connection changed since this process started (a boolean; never a connection detail)
        "connection_pending_restart": connection_store.any_pending_restart(conn, settings),  # CR-024: any recorder's change
        "discovery": {**autosync.STATE, "cameras": store.camera_count(conn), "interval_s": autosync.INTERVAL_S},
        # CR-008 D7: how many main / sub streams play over WebRTC (ok / no / unknown), from the last discovery - counts
        # only; the cameras and their hints are in /health/report (system.configure)
        "video_codecs": stream_codecs.summary(conn),
        "events": {"ingest": events_ingest.STATE.as_dict(), "derive": events_derive.STATE, "stored": _events_stored(conn, settings),
                   "cache": events_cache.CACHE.stats()},
        "home_assistant": {"configured": ha_client.configured(settings), **ha_sync.STATE.as_dict()},
        # T068: bounded queues and their drop / defer counters, the data disk against storage.min_free_mb (no ids, no paths)
        "backpressure": local_state(settings, conn),
        "identity_source": principal.source,
        # CR-008 P3: Web Push worker counters and subscription totals (no endpoints, no user ids)
        **({"push": _push_view(conn), "remote": _remote_view(conn, settings)} if diagnostics else {}),
        # NN1 (capabilities.py): the derived capability set and whether this is a supported installation
        "capabilities": caps.as_dict(with_recorders=sees_recorders),
        "installation": installation_block(caps),
        # CR-024: one entry per recorder this process runs - discovery and alert-stream state only (no address, no credential)
        # security review L2: per-recorder state (incl. error codes) only for who may see recorders, like the capability block
        "recorders": _recorders_view(settings) if sees_recorders else [],
        "renderer": _renderer(),
    }


@router.get("/health/video")
def health_video(request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """HEALTH-GO2RTC-2430: is the video service reachable - what a camera, live or playback screen asks before it retries, every
    signed-in user. At most one probe of go2rtc runs, and only when due (every 60 s while reachable and idle, on a 10 -> 60 s backoff
    while unreachable), however many screens ask; otherwise the cached state is returned. No address, no credential."""
    settings = settings_of(request)
    media_reach.REACH.tick(settings)
    return media_reach.REACH.view(settings)


@router.get("/health/report")
def health_report(request: Request, fresh: bool = False, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One status per subsystem (T033). Device probes are network calls, so they run outside the request's
    write transaction; `fresh=1` drops the probe cache first."""
    require(conn, principal, "system.configure", INSTALLATION)
    if fresh:
        health_report_svc.invalidate()
    settings = settings_of(request)
    with unlocked(conn):
        report = health_report_svc.build(settings, conn, probe=True)
    return report


@router.get("/health/summary")
def health_summary(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What the top bar shows every signed-in user: cached states only, no device probes, no details that a
    non-administrator should not see (labels are operator wording, never addresses or credentials)."""
    return health_report_svc.summary(settings_of(request), conn)


class LogExportBody(BaseModel):
    """T033 acceptance 2: the administrator's explicit request for the redacted log file (`consent` must be true - the master spec's
    "diagnostic bundle ... created with consent")."""
    consent: bool = False
    minutes: int = Field(default=log_export.DEFAULT_MINUTES, ge=1, le=log_export.MAX_MINUTES)
    min_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    correlation_id: str | None = Field(default=None, max_length=64)
    include_health: bool = True


@router.post("/health/logs/export")
def health_logs_export(body: LogExportBody, request: Request, principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """T033 (R066 / AT066): the redacted log export - the add-on's recent log lines with the correlation id of the request each was
    written for, the health checks, and a recommendation per problem; tokens, credentials, addresses, serials, MACs and personal
    numbers redacted, no video, frames or plans (services/log_export.py). system.configure only, on purpose (`consent`), audited
    with counts only - never the content. A download (Content-Disposition: attachment)."""
    require(conn, principal, "system.configure", INSTALLATION)
    if not body.consent:
        raise ApiError(422, "consent_required", "ייצוא היומן דורש אישור מפורש (consent).")
    only = None
    if body.correlation_id is not None:
        only = correlation_id.accepted(body.correlation_id)
        if only is None:
            raise ApiError(422, "validation", "מזהה בקשה לא תקין: 8 עד 64 אותיות לטיניות, ספרות, מקף או קו תחתון.")
    report = None
    if body.include_health:
        with unlocked(conn):  # the NVR / go2rtc probes are network calls (cached for PROBE_TTL_S)
            report = health_report_svc.build(settings_of(request), conn, probe=True)
    doc = log_export.build(report, minutes=body.minutes, min_level=body.min_level, only_correlation_id=only,
                           export_correlation_id=_rid(request))
    audit(conn, actor=principal, action="health.logs.export", decision="allowed", resource_type="installation", resource_id="*",
          request_id=_rid(request), details={"records": len(doc["records"]), "minutes": body.minutes, "min_level": body.min_level,
                                             "one_request": only is not None, "health": report is not None,
                                             "redactions": doc["redaction"]["total"]})
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Response(content=json.dumps(doc, ensure_ascii=False, indent=1), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="arx-logs-{stamp}.json"', "Cache-Control": "no-store"})


def _reset_for_tests() -> None:
    """Test seam: puts the module-level tables back to what a freshly started process has (smplwise.test_reset; product code never calls it)."""
    _EVENTS_COUNT.clear()
    _RENDERER.clear()


register_reset(__name__, ("_EVENTS_COUNT", "_RENDERER"), _reset_for_tests)  # CR-SINGLETONS-REST-2480: module-level tables (tests/test_singletons_registered.py)
