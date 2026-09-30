"""The camera card of the area screens (owner 2026-09-30): what a card's source resolves to and which cameras may be offered.

- `GET /devices/camera-card/sources` - the cameras the caller may offer in a card: NVR channels they may watch (video.live
  with the camera scope of services/access.py, grouped by recorder) and the Home Assistant cameras they may see
  (devices.read scope), each with how it will play (`live` through the existing relay, or `still_only`).
- `GET /devices/camera-card/resolve?kind=nvr&recorder_id=&channel=` / `?kind=ha&entity_id=` - one card's source for THIS
  caller: `live` (with the catalogue camera to stream), `still_only`, `forbidden`, `missing` or `disabled`. A Home
  Assistant camera that is one of the NVR's own channels resolves to that catalogue camera (services/camera_cards.py).
- `GET /devices/camera-card/still?entity_id=` - a picture of a Home Assistant camera that is NOT an NVR channel (the
  card's `still_only` state), through HA's camera proxy, cached for max(10 s, snapshots.max_age_s).

The stream itself is never served here: it stays behind `WS /media/live/{camera_id}/ws` (authorized, capped, audited).
Nothing here writes to go2rtc or exposes a token, a source URL or a host."""
from __future__ import annotations

import hashlib
import sqlite3
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import camera_cards as cc
from ..services import ha_client, ha_scope
from .settings import read_settings

router = APIRouter()
STILL_MIN_AGE_S = 10


@router.get("/devices/camera-card/sources")
def sources(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    ha_scope.scoped_rows(conn, principal, cc.READ, [])  # the audited 403 without devices.read anywhere
    return cc.eligible(conn, principal)


@router.get("/devices/camera-card/resolve")
def resolve(
    kind: Literal["nvr", "ha"],
    recorder_id: str | None = Query(None, pattern=cc.RECORDER_ID_RE.pattern),
    channel: int | None = Query(None, ge=1, le=256),
    entity_id: str | None = Query(None, pattern=cc.HA_CAMERA_RE.pattern),
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
) -> dict[str, Any]:
    ha_scope.scoped_rows(conn, principal, cc.READ, [])
    if kind == "nvr" and (recorder_id is None or channel is None):
        raise ApiError(422, "validation", "מקור מצלמה חסר.", details={"fields": ["recorder_id", "channel"]})
    if kind == "ha" and entity_id is None:
        raise ApiError(422, "validation", "מקור מצלמה חסר.", details={"fields": ["entity_id"]})
    source = {"kind": kind, "recorder_id": recorder_id, "channel": channel} if kind == "nvr" else {"kind": kind, "entity_id": entity_id}
    return cc.resolve(conn, principal, source)


@router.get("/devices/camera-card/still")
def still(request: Request, entity_id: str = Query(..., pattern=cc.HA_CAMERA_RE.pattern), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """The picture of a Home Assistant camera that is not an NVR channel. Needs video.live installation-wide (no camera
    scope exists for it) and devices.read on the entity; a camera that IS an NVR channel is served by
    `GET /cameras/{id}/snapshot.jpg` under its own camera scope, never here (409)."""
    require(conn, principal, cc.LIVE, INSTALLATION)
    if not cc.entity_visible(conn, principal, entity_id) or cc._entity(conn, entity_id) is None:
        raise not_found("המצלמה לא נמצאה.")
    if entity_id in cc.link_ha_cameras(conn):
        raise ApiError(409, "camera_is_nvr_channel", "המצלמה הזו היא ערוץ של ה־NVR: התמונה שלה מגיעה משם.")
    settings = settings_of(request)
    max_age = max(STILL_MIN_AGE_S, int(read_settings(conn)["snapshots.max_age_s"]))
    folder = settings.data_dir / "snapshots"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"ha-{hashlib.sha256(entity_id.encode()).hexdigest()[:16]}.img"
    have = path.exists()
    if not have or time.time() - path.stat().st_mtime >= max_age:
        try:
            with unlocked(conn):
                data, _media = ha_client.camera_image(settings, entity_id)
            path.write_bytes(data)
        except ApiError as exc:
            if not have:
                raise
            return _image(path.read_bytes(), {"Cache-Control": "private, max-age=10", "X-Snapshot-Stale": "true", "X-Snapshot-Error": exc.code})
    age = int(time.time() - path.stat().st_mtime)
    return _image(path.read_bytes(), {"Cache-Control": f"private, max-age={max(1, max_age - age)}", "X-Snapshot-Age": str(age)})


def _image(data: bytes, headers: dict[str, str]) -> Response:
    return Response(data, media_type="image/jpeg" if data.startswith(ha_client.JPEG_MAGIC) else "image/png", headers=headers)
