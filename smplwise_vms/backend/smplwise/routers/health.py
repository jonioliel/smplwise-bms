from __future__ import annotations

import os
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from .. import __version__
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..capabilities import installation_block, may_see_recorders, resolve as resolve_capabilities
from ..db import database_of, lock_stats, permission_revision, unlocked
from ..mode import describe as describe_mode
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import autosync, connection_store, events_cache, events_derive, events_ingest, ha_client, ha_sync, stream_codecs
from ..services import health_report as health_report_svc
from .storage import local_state

router = APIRouter()


def _write_lock_view(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """The write-lock counters for everyone; who held the lock (request paths with other users' entity / camera ids)
    only for a system.configure holder."""
    stats = lock_stats()
    db = database_of(conn)
    if db is not None:
        stats["gate"] = db.gate.state()  # held / waiting right now
    if not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        stats.pop("max_hold_by", None)
        stats.pop("max_wait_by", None)
        stats.pop("last_busy", None)
    return stats


def _push_view(conn: sqlite3.Connection) -> dict[str, Any]:
    from ..services import push as push_svc

    row = conn.execute("SELECT COUNT(*), COUNT(DISTINCT user_id) FROM push_subscriptions").fetchone()
    return {**push_svc.STATS, "running": push_svc.NOTIFIER.running, "subscriptions": row[0], "subscribed_users": row[1],
            "key_created": conn.execute("SELECT 1 FROM push_vapid WHERE id = 1").fetchone() is not None}


def _remote_view(conn: sqlite3.Connection, settings: Any) -> dict[str, Any]:
    """CR-008 P2: the remote channel's live counters - sessions by kind, sign-ins, users, attached sockets, live
    streams running under remote sign-ins and the per-sign-in cap (no ids, no addresses)."""
    from ..services import ha_user_auth
    from .media import remote_live_by_chain
    from .settings import read_settings

    live = remote_live_by_chain()
    return {"enabled": bool(settings.remote_access), **ha_user_auth.STORE.stats(), "live_streams": sum(live.values()),
            "max_live_streams_per_sign_in": read_settings(conn)["remote.max_live_streams"]}


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


@router.get("/health")
def health(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    return {
        "status": "ok",
        "version": __version__,
        # NVR-less mode: `mode` ha_only and nvr.state not_configured - neutral, never a failure of the add-on
        **describe_mode(settings),
        "db": {"ok": conn.execute("SELECT 1").fetchone()[0] == 1, "permission_revision": permission_revision(conn), "write_lock": _write_lock_view(conn, principal)},
        "data_dir_writable": os.access(settings.data_dir, os.W_OK),
        "nvr_configured": bool(settings.nvr_host and settings.nvr_user),  # the placeholder host (no user) is not configured
        "go2rtc_configured": bool(settings.go2rtc_url),
        # CR-022 section 8: the stored NVR connection changed since this process started (a boolean; never a connection detail)
        "connection_pending_restart": connection_store.any_pending_restart(conn, settings),  # CR-024: any recorder's change
        "discovery": {**autosync.STATE, "cameras": conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0], "interval_s": autosync.INTERVAL_S},
        # CR-008 D7: how many main / sub streams play over WebRTC (ok / no / unknown), from the last discovery - counts
        # only; the cameras and their hints are in /health/report (system.configure)
        "video_codecs": stream_codecs.summary(conn),
        "events": {"ingest": events_ingest.STATE.as_dict(), "derive": events_derive.STATE, "stored": conn.execute("SELECT COUNT(*) FROM events").fetchone()[0],
                   "cache": events_cache.CACHE.stats()},
        "home_assistant": {"configured": ha_client.configured(settings), **ha_sync.STATE.as_dict()},
        # T068: bounded queues and their drop / defer counters, the data disk against storage.min_free_mb (no ids, no paths)
        "backpressure": local_state(settings, conn),
        "identity_source": principal.source,
        # CR-008 P3: Web Push worker counters and subscription totals (no endpoints, no user ids)
        **({"push": _push_view(conn), "remote": _remote_view(conn, settings)} if authorize(conn, principal, "system.configure", INSTALLATION).allowed else {}),
        # NN1 (capabilities.py): the derived capability set and whether this is a supported installation
        "capabilities": resolve_capabilities(settings).as_dict(with_recorders=may_see_recorders(permissions_anywhere(conn, principal))),
        "installation": installation_block(resolve_capabilities(settings)),
        # CR-024: one entry per recorder this process runs - discovery and alert-stream state only (no address, no credential)
        "recorders": _recorders_view(settings),
        "renderer": "pdftoppm" if any(os.access(os.path.join(p, "pdftoppm"), os.X_OK) for p in os.environ.get("PATH", "").split(os.pathsep)) else "pymupdf-or-none",
    }


@router.get("/health/report")
def health_report(request: Request, fresh: bool = False, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
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
