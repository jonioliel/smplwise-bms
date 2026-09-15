"""Camera registry: stable local ids per (recorder, channel), aliases and order kept locally (T013),
discovery by a read-only ISAPI sync that never renames anything on the device."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from fastapi.responses import Response

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import new_id, now_iso
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import autosync, nvr
from ..services.access import camera_allowed, visible_camera_ids
from .anchors import camera_row
from .settings import read_settings

router = APIRouter()

DEFAULT_RECORDER = "nvr-1"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _ensure_recorder(conn: sqlite3.Connection, name: str = "NVR ראשי", model: str | None = None, firmware: str | None = None) -> None:
    conn.execute(
        """INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET model = COALESCE(excluded.model, recorders.model), firmware = COALESCE(excluded.firmware, recorders.firmware), last_seen_at = excluded.last_seen_at""",
        (DEFAULT_RECORDER, name, model, firmware, now_iso(), now_iso()),
    )


@router.get("/cameras")
def list_cameras(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Cameras the caller may see: everything for installation-wide readers, otherwise only cameras
    anchored on floors the caller can read."""
    rows = conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()
    ids = visible_camera_ids(conn, principal, "map.read")
    visible = rows if ids is None else [r for r in rows if r["id"] in ids]
    recorder = conn.execute("SELECT * FROM recorders WHERE id = ?", (DEFAULT_RECORDER,)).fetchone()
    live_ok = {r["id"]: camera_allowed(conn, principal, r["id"], "video.live") for r in visible}
    return {
        "cameras": [dict(camera_row(r), can_view_live=live_ok[r["id"]]) for r in visible],
        "recorder": {"id": recorder["id"], "name": recorder["name"], "model": recorder["model"], "firmware": recorder["firmware"], "last_seen_at": recorder["last_seen_at"]} if recorder else None,
        "can_sync": authorize(conn, principal, "sources.configure", INSTALLATION).allowed,
        "media": read_settings(conn),
    }


@router.get("/cameras/{camera_id}/snapshot.jpg")
def snapshot(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Fresh JPEG from the NVR (read-only), cached in /data for `snapshots.max_age_s`; a stale copy is
    served with X-Snapshot-Stale when the NVR is unreachable. Same permission as live video."""
    settings = settings_of(request)
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    if not camera_allowed(conn, principal, camera_id, "video.live"):
        require(conn, principal, "video.live", ("installation", "*"))
    max_age = read_settings(conn)["snapshots.max_age_s"]
    folder = settings.data_dir / "snapshots"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{camera_id}.jpg"
    stale_ok = path.exists()
    fresh = stale_ok and (now_ts() - path.stat().st_mtime) < max_age
    if not fresh:
        try:
            data = nvr.fetch_snapshot(settings, cam["channel"])
            path.write_bytes(data)
        except ApiError as exc:
            if not stale_ok:
                raise
            return Response(path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=10", "X-Snapshot-Stale": "true", "X-Snapshot-Error": exc.code})
    age = int(now_ts() - path.stat().st_mtime)
    return Response(path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": f"private, max-age={max(1, max_age - age)}", "X-Snapshot-Age": str(age)})


def now_ts() -> float:
    import time

    return time.time()


@router.post("/cameras/sync")
def sync_cameras(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Read-only discovery from the NVR: channels, online flag and track ids. Existing aliases/order survive.
    The same discovery also runs automatically at start-up and every few minutes (services/autosync)."""
    require(conn, principal, "sources.configure", INSTALLATION)
    return autosync.sync_cameras(settings_of(request), conn, actor=principal, request_id=_rid(request), reason="manual")


class CameraPatch(BaseModel):
    alias: str | None = Field(default=None, max_length=120)
    sort_order: int | None = None
    enabled: bool | None = None


@router.patch("/cameras/{camera_id}")
def update_camera(camera_id: str, body: CameraPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    if not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone():
        raise not_found("המצלמה לא נמצאה.")
    fields = {k: (int(v) if isinstance(v, bool) else v) for k, v in body.model_dump().items() if v is not None}
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(f"UPDATE cameras SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), now_iso(), camera_id))
    audit(conn, actor=principal, action="camera.update", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=_rid(request), details=fields)
    return camera_row(conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone())


class CameraIn(BaseModel):
    """Manual registration (no NVR reachable yet): channel number and a local alias."""
    channel: int = Field(ge=1, le=256)
    alias: str = Field(min_length=1, max_length=120)


@router.post("/cameras", status_code=201)
def create_camera(body: CameraIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    _ensure_recorder(conn)
    existing = conn.execute("SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (DEFAULT_RECORDER, body.channel)).fetchone()
    if existing:
        conn.execute("UPDATE cameras SET alias = ?, updated_at = ? WHERE id = ?", (body.alias, now_iso(), existing["id"]))
        cid = existing["id"]
    else:
        cid, now = new_id(), now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, alias, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (cid, DEFAULT_RECORDER, body.channel, body.alias, body.channel, now, now))
    audit(conn, actor=principal, action="camera.register", decision="allowed", resource_type="camera", resource_id=cid, request_id=_rid(request), details={"channel": body.channel, "alias": body.alias})
    return camera_row(conn.execute("SELECT * FROM cameras WHERE id = ?", (cid,)).fetchone())
