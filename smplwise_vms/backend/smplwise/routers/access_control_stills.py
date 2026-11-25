"""WisKey tab: a station camera's still, grabbed through go2rtc and cached on disk (`access.read`).

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import hashlib
import os
import sqlite3
import time
import uuid
from pathlib import Path as FilePath
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response

from ..auth import get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services import go2rtc as g2, intercom_authority as ia, intercom_sync, wiskey_camera
from .access_control_base import MAX_STATION_ID, READ, _reader_ro, log
from ..services.settings_store import setting_value
from ..error_text import tpl

router = APIRouter()


# ---------------------------------------------------------------- station camera stills (access.read), through go2rtc

def _still_path(settings: Any, station_id: str) -> FilePath:
    folder = settings.data_dir / "snapshots" / "intercom"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{hashlib.sha256(station_id.encode()).hexdigest()[:32]}.jpg"


@router.get("/intercom/stations/{station_id}/camera-snapshot.jpg")
def camera_snapshot(
    request: Request,
    principal: Principal = Depends(_reader_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    station_id: str = Path(min_length=1, max_length=MAX_STATION_ID),
) -> Response:
    """A still of the station's camera for the entry center's door cards (WisKey's own overview shows one per station,
    `.live=${false}`). Read-only, `access.read` like the rest of the overview. The owner's rule is that all video goes
    through go2rtc: the frame comes from go2rtc's /api/frame.jpeg, which pulls the station's own RTSP stream (host from
    the served WisKey copy, credentials from SMPLWISE - wiskey_camera.credentials). Home Assistant is never asked for
    the picture. Cached in /data for `snapshots.max_age_s` and served like the NVR snapshot (routers/cameras.py): a
    stale copy with X-Snapshot-Stale / X-Snapshot-Error when no new frame can be had, else the error itself.

    Errors: 404 `intercom_station_not_found` / `intercom_no_camera`; 503 `ha_not_configured` / `intercom_unavailable`
    (no served copy), `intercom_camera_host_unknown`, `source_not_configured` (no credentials), `media_not_configured`
    (no go2rtc) - these configuration gaps are answered before any cached copy is looked at - and, with no cached
    copy, `intercom_station_offline`, `media_unavailable` / `media_error` / `snapshot_unavailable` from go2rtc."""
    settings = settings_of(request)
    state, overview = intercom_sync.SYNC.served(settings)
    if overview is None:
        if state == "ha_not_configured":
            raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת, ולכן אין נתוני WisKey ואין תמונת מצלמה.")
        raise ApiError(503, "intercom_unavailable", "נתוני WisKey אינם זמינים כרגע, ולכן אין תמונת מצלמה.", retryable=True, details={"state": state})
    station = next((s for s in overview.get("stations", []) if s["id"] == station_id), None)
    if station is None or not ia.Authority(conn, principal).station(READ, station_id):  # CR-036 S3: off the chain = not found
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    if not station.get("camera_entity"):
        raise ApiError(404, "intercom_no_camera", tpl("לעמדה {name} אין מצלמה ב־WisKey.", name=station['name']))
    from ..services import wiskey_auto_install as wai

    if station.get("online") and wai.switch_on(conn):
        # WISKEY-R3-2272: with the installation switch on the door cards get the installed WisKey still first (the frontend keeps
        # this URL; `GET /access-control/stations/{id}/thumbnail.jpg` serves the same still) - never cached, never stale
        with unlocked(conn):
            installed = wai.route_snapshot(settings, station_id)
        if installed is not None:
            return Response(installed[0], media_type=installed[1], headers={"Cache-Control": "private, no-store", "X-Snapshot-Stale": "false"})
    host = intercom_sync.SYNC.station_host(settings, station_id)
    if not host:
        raise ApiError(503, "intercom_camera_host_unknown", "WisKey לא מסר את כתובת העמדה, ולכן אין ממנה תמונה.")
    username, password = wiskey_camera.credentials(conn, settings, station_id)
    source = g2.wiskey_rtsp_url(host, username, password)
    client = g2.Go2rtc(settings)
    max_age = setting_value(conn, "snapshots.max_age_s")
    path = _still_path(settings, station_id)
    cached = _read_still(path)
    if cached is not None and time.time() - cached[1] < max_age:
        age = int(time.time() - cached[1])
        return Response(cached[0], media_type="image/jpeg", headers={"Cache-Control": f"private, max-age={max(1, max_age - age)}", "X-Snapshot-Age": str(age)})
    try:
        if not station["online"]:
            raise ApiError(503, "intercom_station_offline", tpl("העמדה {name} אינה מחוברת, ולכן אין ממנה תמונה עדכנית.", name=station['name']))
        with unlocked(conn):
            data = client.frame_jpeg(g2.wiskey_stream_name(station_id), source)
    except ApiError as exc:
        if cached is None:
            raise
        return Response(cached[0], media_type="image/jpeg", headers={"Cache-Control": "private, max-age=10", "X-Snapshot-Stale": "true", "X-Snapshot-Error": exc.code})
    _store_still(path, data)
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": f"private, max-age={max_age}", "X-Snapshot-Age": "0"})


def _read_still(path: FilePath) -> tuple[bytes, float] | None:
    """The cached still and its time, read once; None when there is none (an override change may drop it any time)."""
    try:
        mtime = path.stat().st_mtime
        return path.read_bytes(), mtime
    except OSError:
        return None


def _store_still(path: FilePath, data: bytes) -> None:
    """Best effort: a temp file of this request's own (two cache misses for one station never share one - security
    review S2), then an atomic replace. The frame is served from memory either way; a replace that fails (Windows
    refuses to replace a file another request is reading at that moment) only skips caching this one."""
    tmp = path.with_name(f"{path.stem}.{uuid.uuid4().hex}.tmp")
    try:
        tmp.write_bytes(data)
        os.replace(tmp, path)
    except OSError as exc:
        log.debug("camera still not cached (%s)", type(exc).__name__)
    finally:
        tmp.unlink(missing_ok=True)
