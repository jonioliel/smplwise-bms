from __future__ import annotations

import os
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from .. import __version__
from ..auth import current_principal, get_conn, settings_of
from ..db import permission_revision
from ..rbac import Principal
from ..services import autosync, events_derive, events_ingest, ha_client, ha_sync

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
