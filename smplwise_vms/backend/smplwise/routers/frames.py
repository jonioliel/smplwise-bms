"""Frame at an instant (T044): one picture from the recording at a chosen time, for timeline hover previews and
the historical map. Grabbed with ffmpeg from the NVR playback stream (server side only), cached per 10-second
bucket under /data/thumbs/frames, negative-cached, and capped in size."""
from __future__ import annotations

import datetime as dt
import sqlite3
import threading
import time
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse

from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import unlocked
from ..errors import ApiError, not_found
from ..rbac import Principal
from ..services import playback, thumbnails
from ..services.access import camera_allowed
from ..services.timeutil import parse_utc
from .settings import read_settings

router = APIRouter()

BUCKET_S = 10
WINDOW_S = 20
NEG_TTL_S = 600
MAX_BYTES = 150 * 1024 * 1024
GRAB_TIMEOUT_S = 25
_sem = threading.BoundedSemaphore(2)
GRAB = thumbnails._grab  # replaced in tests


def frames_dir(settings: Settings) -> Path:
    return settings.data_dir / "thumbs" / "frames"


def _prune(root: Path) -> None:
    files = list(root.rglob("*.jpg")) if root.exists() else []
    total = sum(p.stat().st_size for p in files)
    if total <= MAX_BYTES:
        return
    for p in sorted(files, key=lambda f: f.stat().st_mtime):
        try:
            total -= p.stat().st_size
            p.unlink()
        except OSError:
            pass
        if total <= MAX_BYTES * 0.8:
            break


@router.get("/cameras/{camera_id}/frame")
def camera_frame(camera_id: str, request: Request, at: str = Query(..., min_length=10, max_length=40), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> FileResponse:
    """JPEG frame from the camera's recording at `at` (UTC); 404 when the recording has no picture there."""
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    if not camera_allowed(conn, principal, camera_id, "video.playback"):
        raise ApiError(403, "forbidden", "אין הרשאת ניגון למצלמה זו.")
    try:
        t = parse_utc(at)
    except ValueError:
        raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
    bucket = t.replace(second=(t.second // BUCKET_S) * BUCKET_S, microsecond=0)
    settings = settings_of(request)
    out = frames_dir(settings) / camera_id / (bucket.strftime("%Y%m%dT%H%M%S") + ".jpg")
    headers = {"Cache-Control": "private, max-age=3600"}
    if out.is_file():
        return FileResponse(out, media_type="image/jpeg", headers=headers)
    neg = out.with_suffix(".unavailable")
    if neg.is_file() and time.time() - neg.stat().st_mtime < NEG_TTL_S:
        raise ApiError(404, "frame_unavailable", "אין פריים בהקלטה בזמן זה.")
    if not cam["main_track"]:
        raise ApiError(404, "frame_unavailable", "למצלמה אין מסלול הקלטה ידוע.")
    tz_name = read_settings(conn)["time.zone"]
    url = playback.playback_rtsp_url(settings, int(cam["main_track"]), bucket, bucket + dt.timedelta(seconds=WINDOW_S), tz_name)
    with unlocked(conn):
        with _sem:
            ok = out.is_file() or GRAB(url, out, settings, timeout_s=GRAB_TIMEOUT_S)
    if not ok:
        neg.parent.mkdir(parents=True, exist_ok=True)
        neg.write_text("unavailable", encoding="utf-8")
        raise ApiError(404, "frame_unavailable", "אין פריים בהקלטה בזמן זה.")
    _prune(frames_dir(settings))
    return FileResponse(out, media_type="image/jpeg", headers=headers)
