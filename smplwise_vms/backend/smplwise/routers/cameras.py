"""Camera registry: stable local ids per (recorder, channel), aliases and order kept locally (T013),
discovery by a read-only ISAPI sync that never renames anything on the device."""
from __future__ import annotations

import json
import datetime as dt
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from fastapi.responses import Response

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked, new_id, now_iso
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import autosync, nvr
from ..services.access import camera_allowed, require_camera, visible_camera_ids
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


def disambiguate(cameras: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Two channels with the same NVR name (the lab has "כניסה M1" twice) are told apart by their channel number in
    every list, wall and selector; an alias set in the VMS wins as before (live review F24)."""
    seen: dict[str, int] = {}
    for c in cameras:
        seen[c["name"]] = seen.get(c["name"], 0) + 1
    for c in cameras:
        if seen[c["name"]] > 1:
            c["name"] = f"{c['name']} · ערוץ {c['channel']}"
    return cameras


@router.get("/cameras")
def list_cameras(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Cameras the caller may see: everything for installation-wide readers, otherwise only cameras
    anchored on floors the caller can read."""
    rows = conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()
    ids = visible_camera_ids(conn, principal, "map.read")
    visible = rows if ids is None else [r for r in rows if r["id"] in ids]
    recorder = conn.execute("SELECT * FROM recorders WHERE id = ?", (DEFAULT_RECORDER,)).fetchone()
    live_ok = {r["id"]: camera_allowed(conn, principal, r["id"], "video.live") for r in visible}
    return {
        "cameras": disambiguate([dict(camera_row(r), can_view_live=live_ok[r["id"]]) for r in visible]),
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
    require_camera(conn, principal, camera_id, "video.live")
    max_age = read_settings(conn)["snapshots.max_age_s"]
    folder = settings.data_dir / "snapshots"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{camera_id}.jpg"
    stale_ok = path.exists()
    fresh = stale_ok and (now_ts() - path.stat().st_mtime) < max_age
    if not fresh:
        try:
            with unlocked(conn):
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


# ---------------------------------------------------------------- detection zones (T075, read-only)

ZONES = nvr.fetch_detection_zones  # seam for tests
_ZONES_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
ZONES_TTL_S = 60


def _motion_caps(request: Request, conn: sqlite3.Connection, channel: int) -> dict[str, int] | None:
    """The sensitivity min / max / step the device reports (only for editors; one cached GET per channel)."""
    from ..services import nvr_write

    try:
        with unlocked(conn):
            return nvr_write.motion_capabilities(settings_of(request), channel)
    except ApiError:
        return None


@router.get("/cameras/{camera_id}/zones")
def detection_zones(camera_id: str, request: Request, refresh: bool = False, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The camera's detection configuration as the NVR holds it — motion grid, privacy mask, intrusion regions,
    line-crossing lines — read-only (ISAPI GET), cached for a minute, same permission as live video. These are
    polygons in the camera image and have nothing to do with rooms on the floor plan; a browser overlay is not
    an NVR mask and protects no recording. Editing needs an explicit approval and a verified write (not in the pilot)."""
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    require_camera(conn, principal, camera_id, "video.live")
    now = time.time()
    hit = _ZONES_CACHE.get(camera_id)
    if hit and not refresh and now - hit[0] < ZONES_TTL_S:
        data, fetched_at = hit[1], hit[0]
    else:
        with unlocked(conn):
            data = ZONES(settings_of(request), int(cam["channel"]))
        fetched_at = now
        _ZONES_CACHE[camera_id] = (fetched_at, data)
    return {
        "camera_id": camera_id,
        "channel": int(cam["channel"]),
        "source": "nvr",
        "read_only": True,
        "write_reason": "editing the motion grid needs the sensitive permission nvr.config.detection (custom role); masks and smart rules are still read-only",
        "can_edit_motion": authorize(conn, principal, "nvr.config.detection", INSTALLATION).allowed,
        "sensitivity_caps": _motion_caps(request, conn, int(cam["channel"])) if authorize(conn, principal, "nvr.config.detection", INSTALLATION).allowed else None,
        "fetched_at": dt.datetime.fromtimestamp(fetched_at, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cached": bool(hit) and not refresh and now - hit[0] < ZONES_TTL_S,
        **data,
    }


# ---------------------------------------------------------------- capability facts (T045 / T012, read-only)

CAPS = nvr.fetch_capabilities  # seam for tests
_CAPS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
CAPS_TTL_S = 300


@router.get("/cameras/{camera_id}/capabilities")
def camera_capabilities(camera_id: str, request: Request, refresh: bool = False, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What the NVR says this camera can do — PTZ (supported / unsupported / unknown, with the device's reason),
    its preset list, two-way audio (available / disabled / unsupported / unknown). Read-only, cached five minutes,
    same permission as live video. Moving the camera, recalling a preset or talking are device writes: not offered
    in the pilot, and never shown as a fake control. Digital zoom is a browser-side enlargement, not a camera move."""
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    require_camera(conn, principal, camera_id, "video.live")
    now = time.time()
    hit = _CAPS_CACHE.get(camera_id)
    cached = bool(hit) and not refresh and now - hit[0] < CAPS_TTL_S
    if cached:
        data, fetched_at = hit[1], hit[0]
    else:
        with unlocked(conn):
            data = CAPS(settings_of(request), int(cam["channel"]))
        fetched_at = now
        _CAPS_CACHE[camera_id] = (fetched_at, data)
    return {
        "camera_id": camera_id,
        "channel": int(cam["channel"]),
        "source": "nvr",
        "read_only": True,
        "writes": {"ptz_move": "not_offered", "preset_recall": "not_offered", "talk": "not_offered", "reason": "device writes need an explicit approval; nothing is simulated"},
        "digital_zoom": "browser_only",
        "fetched_at": dt.datetime.fromtimestamp(fetched_at, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cached": cached,
        **data,
    }

