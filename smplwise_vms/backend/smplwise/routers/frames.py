"""Frame at an instant (T044): one picture from the recording at a chosen time, for timeline hover previews and
the historical map. Grabbed with ffmpeg from the NVR playback stream (server side only), cached per 10-second
bucket under /data/thumbs/frames, negative-cached, and capped in size.

PLAYBACK-SCRUB-2341 (docs/changes/PLAYBACK-SCRUB-2341.md): the NEAREST picture inside the recording, not only the exact second.
The camera's recording segments around the asked instant (+-SEARCH_WINDOW_S, one cached NVR search per 10-minute window) decide where
a picture can come from: inside a segment the asked second itself (one more try 10 s on when that fails), in a gap the nearest edge
of the segment next to it. 404 only when no recording lies within the window; a picture the recorder holds but did not hand over
this time is 503 (retryable, remembered for 30 s), never "no picture". Recent pictures stay in memory per camera, a second request
for a picture being grabbed waits for that grab (single flight), and at most two grabs run at once (a request that cannot get a
slot within GRAB_SLOT_WAIT_S is 503 instead of piling up)."""
from __future__ import annotations

import collections
import datetime as dt
import sqlite3
import threading
import time
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import unlocked
from ..errors import ApiError, not_found
from ..rbac import Principal
from ..services import playback, recordings, thumbnails
from ..services.access import require_camera
from ..services.timeutil import UTC, iso_utc, parse_utc
from .settings import read_settings

router = APIRouter()

BUCKET_S = 10
WINDOW_S = 20
NEG_TTL_S = 600
MAX_BYTES = 150 * 1024 * 1024
GRAB_TIMEOUT_S = 25
SEARCH_WINDOW_S = 30  # how far from the asked instant a picture may come from (same recording)
SEARCH_ALIGN_S = 600  # the segment search asks for whole 10-minute windows, so hovering along the timeline hits the search cache
EDGE_IN_S = 1  # a gap before a segment: its picture from this far inside the segment start
EDGE_OUT_S = 3  # a gap after a segment: its picture from this far before the segment end (the last seconds may hold no keyframe)
RETRY_TTL_S = 30  # a picture the recorder did not hand over: not asked again for this long
GRAB_SLOT_WAIT_S = 8.0
MEM_PER_CAMERA = 48
MEM_CAMERAS = 16
_sem = threading.BoundedSemaphore(2)
GRAB = thumbnails._grab  # replaced in tests
SEARCH = recordings.search_segments  # replaced in tests


class FrameMemo:
    """Recent pictures per camera in memory (LRU, MEM_PER_CAMERA per camera, MEM_CAMERAS cameras), which asked bucket resolved to
    which picture, and pictures that just failed. Thread-safe; the disk cache under /data/thumbs/frames stays the long-lived one."""

    def __init__(self, per_camera: int = MEM_PER_CAMERA, cameras: int = MEM_CAMERAS) -> None:
        self.per_camera, self.cameras = per_camera, cameras
        self.lock = threading.Lock()
        self.frames: collections.OrderedDict[str, collections.OrderedDict[str, tuple[bytes, str]]] = collections.OrderedDict()
        self.alias: dict[tuple[str, str], str] = {}
        self.failed: dict[tuple[str, str], float] = {}

    def _cam(self, camera_id: str) -> collections.OrderedDict[str, tuple[bytes, str]]:
        cam = self.frames.get(camera_id)
        if cam is None:
            cam = self.frames[camera_id] = collections.OrderedDict()
            while len(self.frames) > self.cameras:
                gone, _ = self.frames.popitem(last=False)
                for k in [k for k in self.alias if k[0] == gone]:
                    self.alias.pop(k, None)
        self.frames.move_to_end(camera_id)
        return cam

    def get(self, camera_id: str, key: str) -> tuple[bytes, str] | None:
        with self.lock:
            key = self.alias.get((camera_id, key), key)
            cam = self.frames.get(camera_id)
            hit = cam.get(key) if cam is not None else None
            if hit is not None:
                assert cam is not None
                cam.move_to_end(key)
                self.frames.move_to_end(camera_id)
            return hit

    def put(self, camera_id: str, key: str, data: bytes, at_iso: str, asked: str | None = None) -> None:
        with self.lock:
            cam = self._cam(camera_id)
            cam[key] = (data, at_iso)
            cam.move_to_end(key)
            while len(cam) > self.per_camera:
                cam.popitem(last=False)
            if asked and asked != key:
                self.alias[(camera_id, asked)] = key
                if len(self.alias) > self.per_camera * self.cameras * 2:
                    for k in list(self.alias)[: len(self.alias) // 2]:
                        self.alias.pop(k, None)
            self.failed.pop((camera_id, key), None)

    def mark_failed(self, camera_id: str, key: str) -> None:
        with self.lock:
            self.failed[(camera_id, key)] = time.monotonic()
            if len(self.failed) > 2048:
                cutoff = time.monotonic() - RETRY_TTL_S
                for k in [k for k, t in self.failed.items() if t < cutoff]:
                    self.failed.pop(k, None)

    def failed_recently(self, camera_id: str, key: str) -> bool:
        with self.lock:
            t = self.failed.get((camera_id, key))
            return t is not None and time.monotonic() - t < RETRY_TTL_S

    def clear(self) -> None:
        with self.lock:
            self.frames.clear()
            self.alias.clear()
            self.failed.clear()


MEMO = FrameMemo()
_flights: dict[tuple[str, str], threading.Event] = {}
_flights_lock = threading.Lock()


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


def bucket_of(t: dt.datetime) -> dt.datetime:
    return t.replace(second=(t.second // BUCKET_S) * BUCKET_S, microsecond=0)


def bucket_key(t: dt.datetime) -> str:
    return bucket_of(t).strftime("%Y%m%dT%H%M%S")


def search_window(t: dt.datetime) -> tuple[dt.datetime, dt.datetime]:
    """[t - SEARCH_WINDOW_S, t + SEARCH_WINDOW_S] widened to whole SEARCH_ALIGN_S windows (a shared, cacheable question)."""
    lo = int((t - dt.timedelta(seconds=SEARCH_WINDOW_S)).timestamp()) // SEARCH_ALIGN_S * SEARCH_ALIGN_S
    hi = -(-int((t + dt.timedelta(seconds=SEARCH_WINDOW_S)).timestamp()) // SEARCH_ALIGN_S) * SEARCH_ALIGN_S
    return dt.datetime.fromtimestamp(lo, UTC), dt.datetime.fromtimestamp(max(hi, lo + SEARCH_ALIGN_S), UTC)


def nearest_candidates(segments: list[tuple[dt.datetime, dt.datetime]], t: dt.datetime, window_s: int = SEARCH_WINDOW_S) -> list[tuple[dt.datetime, dt.datetime, dt.datetime]]:
    """Where a picture for `t` may come from, nearest first: (instant, its segment start, its segment end), at most two.
    Inside a segment: `t` itself, then 10 s further on (or back, at the segment end). In a gap: the nearest segment edge
    within `window_s`. [] = no recording within the window (the only case that is a real 404)."""
    win = dt.timedelta(seconds=window_s)
    out: list[tuple[float, dt.datetime, dt.datetime, dt.datetime]] = []
    for s, e in segments:
        if e <= s or e < t - win or s > t + win:
            continue
        if s <= t < e:
            out.append((0.0, t, s, e))
            step = dt.timedelta(seconds=BUCKET_S)
            alt = t + step if t + step < e - dt.timedelta(seconds=1) else t - step
            if s <= alt < e and abs((alt - t).total_seconds()) <= window_s:
                out.append((abs((alt - t).total_seconds()) + 0.5, alt, s, e))
        elif e <= t:
            c = max(s, e - dt.timedelta(seconds=EDGE_OUT_S))
            out.append((abs((t - c).total_seconds()), c, s, e))
        else:
            c = min(s + dt.timedelta(seconds=EDGE_IN_S), e - dt.timedelta(seconds=1)) if e - s > dt.timedelta(seconds=1) else s
            out.append((abs((c - t).total_seconds()), c, s, e))
    out.sort(key=lambda x: x[0])
    seen: set[str] = set()
    picked: list[tuple[dt.datetime, dt.datetime, dt.datetime]] = []
    for d, c, s, e in out:
        if d > window_s + 0.5:
            continue
        k = bucket_key(c)
        if k in seen:
            continue
        seen.add(k)
        picked.append((c, s, e))
        if len(picked) == 2:
            break
    return picked


def _jpeg(data: bytes, at_iso: str, asked_iso: str) -> Response:
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600", "X-Frame-At": at_iso, "X-Frame-Asked": asked_iso})


def _read(path: Path) -> bytes | None:
    try:
        return path.read_bytes() if path.is_file() else None
    except OSError:
        return None


def _grab_once(camera_id: str, key: str, url: str, out: Path, rs: Settings) -> bool:
    """One grab per (camera, bucket) at a time: a second request for the same picture waits for the first one's result."""
    fk = (camera_id, key)
    with _flights_lock:
        ev = _flights.get(fk)
        leader = ev is None
        if leader:
            ev = _flights[fk] = threading.Event()
    assert ev is not None
    if not leader:
        ev.wait(GRAB_TIMEOUT_S + GRAB_SLOT_WAIT_S)
        return out.is_file()
    try:
        if not _sem.acquire(timeout=GRAB_SLOT_WAIT_S):
            raise ApiError(503, "frame_busy", "תמונות תצוגה רבות נטענות כרגע; נסה שוב בעוד רגע.", retryable=True)
        try:
            return out.is_file() or GRAB(url, out, rs, timeout_s=GRAB_TIMEOUT_S)
        finally:
            _sem.release()
    finally:
        with _flights_lock:
            _flights.pop(fk, None)
        ev.set()


@router.get("/cameras/{camera_id}/frame")
def camera_frame(camera_id: str, request: Request, at: str = Query(..., min_length=10, max_length=40), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """JPEG frame from the camera's recording nearest to `at` (UTC, within SEARCH_WINDOW_S in the same recording); the picture's own
    instant is in `X-Frame-At`. 404 when no recording lies within that window."""
    require_camera(conn, principal, camera_id, "video.playback")  # T055: audited, and 403 before 404
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise not_found("המצלמה לא נמצאה.")
    try:
        t = parse_utc(at)
    except ValueError:
        raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
    settings = settings_of(request)
    asked = bucket_key(t)
    asked_iso = iso_utc(t)
    hit = MEMO.get(camera_id, asked)
    if hit is not None:
        return _jpeg(hit[0], hit[1], asked_iso)
    root = frames_dir(settings) / camera_id
    out = root / (asked + ".jpg")
    data = _read(out)
    if data is not None:
        at_iso = iso_utc(bucket_of(t))
        MEMO.put(camera_id, asked, data, at_iso)
        return _jpeg(data, at_iso, asked_iso)
    neg = out.with_suffix(".unavailable")
    if neg.is_file() and time.time() - neg.stat().st_mtime < NEG_TTL_S:
        raise ApiError(404, "frame_unavailable", "אין הקלטה בזמן זה.")
    if not cam["main_track"]:
        raise ApiError(404, "frame_unavailable", "למצלמה אין מסלול הקלטה ידוע.")
    tz_name = read_settings(conn)["time.zone"]
    from ..recorder_scope import camera_settings

    rs = camera_settings(settings, cam)  # CR-024: the camera's recorder
    with unlocked(conn):
        segs: list[tuple[dt.datetime, dt.datetime]] | None
        try:
            lo, hi = search_window(t)
            result = SEARCH(settings, None, cam, lo, hi, tz_name)
            segs = [(parse_utc(s.start_at), parse_utc(s.end_at)) for s in result.segments]
        except Exception:  # noqa: BLE001 - search unavailable (recorder busy / offline): the asked second, as before PLAYBACK-SCRUB-2341
            segs = None
        if segs is None:
            b = bucket_of(t)
            cands = [(b, b, b + dt.timedelta(seconds=WINDOW_S))]
        else:
            cands = nearest_candidates(segs, t)
            if not cands:
                neg.parent.mkdir(parents=True, exist_ok=True)
                neg.write_text("no_recording", encoding="utf-8")
                raise ApiError(404, "frame_unavailable", "אין הקלטה בטווח של 30 שניות מהזמן הזה.")
        tried = 0
        for c, seg_s, seg_e in cands:
            key = bucket_key(c)
            target = root / (key + ".jpg")
            at_iso = iso_utc(max(bucket_of(c), seg_s))
            cached = MEMO.get(camera_id, key)
            data = cached[0] if cached is not None else _read(target)
            if data is not None:
                MEMO.put(camera_id, key, data, cached[1] if cached is not None else at_iso, asked=asked)
                return _jpeg(data, cached[1] if cached is not None else at_iso, asked_iso)
            if MEMO.failed_recently(camera_id, key):
                continue
            g_start = max(bucket_of(c), seg_s)
            g_end = min(g_start + dt.timedelta(seconds=WINDOW_S), seg_e) if segs is not None else g_start + dt.timedelta(seconds=WINDOW_S)
            if g_end - g_start < dt.timedelta(seconds=2):
                g_end = g_start + dt.timedelta(seconds=2)
            url = playback.playback_rtsp_url(rs, int(cam["main_track"]), g_start, g_end, tz_name)
            tried += 1
            if _grab_once(camera_id, key, url, target, rs):
                data = _read(target)
                if data is not None:
                    MEMO.put(camera_id, key, data, at_iso, asked=asked)
                    _prune(frames_dir(settings))
                    return _jpeg(data, at_iso, asked_iso)
            MEMO.mark_failed(camera_id, key)
    if segs is None:  # nothing known about the recording and the asked second gave nothing: as before (negative-cached 404)
        neg.parent.mkdir(parents=True, exist_ok=True)
        neg.write_text("unavailable", encoding="utf-8")
        raise ApiError(404, "frame_unavailable", "אין פריים בהקלטה בזמן זה.")
    raise ApiError(503, "frame_retry", "ההקלטה קיימת אבל הפריים לא נטען כרגע; נסה שוב בעוד רגע.", retryable=True, details={"tried": tried})
