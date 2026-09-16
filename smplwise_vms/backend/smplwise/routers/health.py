from __future__ import annotations

import os
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from .. import __version__
from ..auth import current_principal, get_conn, settings_of
from ..db import permission_revision, unlocked
from ..rbac import INSTALLATION, Principal, require
from ..services import autosync, events_derive, events_ingest, ha_client, ha_sync
from ..services import health_report as health_report_svc

router = APIRouter()


@router.get("/health")
def health(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    return {
        "status": "ok",
        "version": __version__,
        "db": {"ok": conn.execute("SELECT 1").fetchone()[0] == 1, "permission_revision": permission_revision(conn)},
        "data_dir_writable": os.access(settings.data_dir, os.W_OK),
        "nvr_configured": bool(settings.nvr_host and settings.nvr_user),
        "go2rtc_configured": bool(settings.go2rtc_url),
        "discovery": {**autosync.STATE, "cameras": conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0], "interval_s": autosync.INTERVAL_S},
        "events": {"ingest": events_ingest.STATE.as_dict(), "derive": events_derive.STATE, "stored": conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]},
        "home_assistant": {"configured": ha_client.configured(settings), **ha_sync.STATE.as_dict()},
        "identity_source": principal.source,
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
def health_summary(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What the top bar shows every signed-in user: cached states only, no device probes, no details that a
    non-administrator should not see (labels are operator wording, never addresses or credentials)."""
    return health_report_svc.summary(settings_of(request), conn)
