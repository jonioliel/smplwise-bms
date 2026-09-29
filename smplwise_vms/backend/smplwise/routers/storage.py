"""NVR storage and recording plan, read-only (T051); the add-on's own data disk and the export queue's state (T068)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..rbac import INSTALLATION, Principal, require
from ..services import bundle_import, events_ingest, storage
from ..services import exports as ex

router = APIRouter()


@router.get("/storage")
def storage_report(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), fresh: bool = False) -> dict[str, Any]:
    """Disks, per-camera recording schedule, retention measured vs. estimated (with reasons) and the pilot's
    device limits. Cached ten minutes; `fresh=true` asks the NVR again. Nothing here writes to the device.
    `local` is the add-on's own disk, measured on every call (T050: imported evidence counts there per imported case)."""
    require(conn, principal, "system.configure", INSTALLATION)
    settings = settings_of(request)
    return {**storage.report(settings, conn, fresh=fresh), "local": bundle_import.local_usage(settings, conn)}


def local_state(settings: Any, conn: sqlite3.Connection) -> dict[str, Any]:
    """The add-on's data disk (exports, thumbnails, backups live there) against storage.min_free_mb, the export queue by
    state with its backpressure counters, and the alert-ingest queue - what the storage screen and /health show."""
    states = {r[0]: r[1] for r in conn.execute("SELECT state, COUNT(*) FROM export_jobs GROUP BY state").fetchall()}
    return {
        "data_disk": ex.disk_state(settings, ex.min_free_mb(conn)),
        "exports": {"by_state": states, "paused_disk_full": states.get(ex.PAUSED, 0), "waiting": states.get("queued", 0) + states.get(ex.PAUSED, 0),
                    "max_waiting": ex.MAX_QUEUED_TOTAL, "max_per_owner": ex.MAX_ACTIVE_JOBS, "counters": ex.stats()},
        "ingest_queue": events_ingest.QUEUE.stats(),
    }


@router.get("/storage/local")
def storage_local(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """No device call: the local disk and the queues (T068)."""
    require(conn, principal, "system.configure", INSTALLATION)
    return local_state(settings_of(request), conn)


@router.post("/storage/exports/resume")
def resume_exports(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Resume the exports paused by a full disk now (they also resume on their own once there is room): 507 while free
    space is still under the minimum."""
    require(conn, principal, "system.configure", INSTALLATION)
    settings = settings_of(request)
    n = ex.resume_paused(conn, settings, manual=True)
    audit(conn, actor=principal, action="export.resume", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={"resumed": n})
    return {"resumed": n, **local_state(settings, conn)}
