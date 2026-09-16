"""NVR storage and recording plan, read-only (T051)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import current_principal, get_conn, settings_of
from ..rbac import INSTALLATION, Principal, require
from ..services import storage

router = APIRouter()


@router.get("/storage")
def storage_report(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), fresh: bool = False) -> dict[str, Any]:
    """Disks, per-camera recording schedule, retention measured vs. estimated (with reasons) and the pilot's
    device limits. Cached ten minutes; `fresh=true` asks the NVR again. Nothing here writes to the device."""
    require(conn, principal, "system.configure", INSTALLATION)
    return storage.report(settings_of(request), conn, fresh=fresh)
