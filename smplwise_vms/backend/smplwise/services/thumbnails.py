"""Event thumbnails: one JPEG per event, grabbed from the NVR recording at the event time through the RTSP
playback URL (ffmpeg, first decoded frame; 3-10 s per picture on the lab NVR). A single worker generates
them lazily, in the order the event centre asks, so the NVR's playback slots are never flooded. Failures
are remembered for an hour (`<id>.unavailable`), files live under /data/thumbs and follow the events
retention. The RTSP URL carries the NVR credential and is never logged."""
from __future__ import annotations

import logging
import os
import queue
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Iterable

from ..config import Settings
from ..db import Database
from . import events_ingest, playback
from .timeutil import parse_utc

import datetime as dt

log = logging.getLogger("smplwise.thumbs")

STATE: dict[str, Any] = {"queued": 0, "generated": 0, "failed": 0, "last_error": None, "busy": None}
NEG_TTL_S = 3600
MAX_QUEUE = 300
MAX_DIR_BYTES = 200 * 1024 * 1024
SKIP_TYPES = {"offline", "coverage_gap", "system", "storage"}


def thumb_dir(settings: Settings) -> Path:
    return settings.data_dir / "thumbs"


def path_for(settings: Settings, event_id: str) -> Path:
    return thumb_dir(settings) / f"{event_id}.jpg"


def _neg_path(settings: Settings, event_id: str) -> Path:
    return thumb_dir(settings) / f"{event_id}.unavailable"


def eligible(ev: dict[str, Any]) -> bool:
    return bool(ev.get("camera_id")) and ev.get("type") not in SKIP_TYPES


class _DirIndex:
    """Which thumbnails exist, per thumbs folder, from one directory listing instead of two stat() calls per listed
    event (T068: a 500-row events list spent ~80 % of its time in those stats on the reference workstation). The worker
    records what it writes, the prune drops the index, and a listing older than INDEX_TTL_S is re-read, so a file added
    or removed behind the product's back (a restore, a manual clean-up) is seen within that time. The single-event
    paths (the picture itself, the worker's queue check) keep asking the file system directly."""

    INDEX_TTL_S = 30.0

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.dirs: dict[str, tuple[float, set[str], dict[str, float]]] = {}  # folder -> (built, ready ids, unavailable id -> mtime)
        self.rebuilds = 0

    def _get(self, d: Path) -> tuple[set[str], dict[str, float]]:
        key = str(d)
        with self.lock:
            hit = self.dirs.get(key)
            if hit and time.monotonic() - hit[0] < self.INDEX_TTL_S:
                return hit[1], hit[2]
        ready: set[str] = set()
        neg: dict[str, float] = {}
        try:
            with os.scandir(d) as it:
                for e in it:
                    name = e.name
                    if name.endswith(".jpg") and not name.endswith(".tmp.jpg"):
                        ready.add(name[:-4])
                    elif name.endswith(".unavailable"):
                        try:
                            neg[name[:-12]] = e.stat().st_mtime
                        except OSError:
                            pass
        except FileNotFoundError:
            pass
        with self.lock:
            self.dirs[key] = (time.monotonic(), ready, neg)
            self.rebuilds += 1
        return ready, neg

    def statuses(self, d: Path, event_ids: Iterable[str]) -> dict[str, str]:
        ready, neg = self._get(d)
        now = time.time()
        out: dict[str, str] = {}
        for eid in event_ids:
            if eid in ready:
                out[eid] = "ready"
            elif eid in neg and now - neg[eid] < NEG_TTL_S:
                out[eid] = "unavailable"
            elif WORKER.is_pending(eid):
                out[eid] = "pending"
            else:
                out[eid] = "none"
        return out

    def note(self, d: Path, event_id: str, ok: bool) -> None:
        with self.lock:
            hit = self.dirs.get(str(d))
            if hit is None:
                return
            if ok:
                hit[1].add(event_id)
                hit[2].pop(event_id, None)
            else:
                hit[1].discard(event_id)
                hit[2][event_id] = time.time()

    def invalidate(self, d: Path | None = None) -> None:
        with self.lock:
            if d is None:
                self.dirs.clear()
            else:
                self.dirs.pop(str(d), None)


INDEX = _DirIndex()


def statuses_for(settings: Settings, event_ids: Iterable[str]) -> dict[str, str]:
    """status_for() for many events at once, from the folder index (the events list)."""
    return INDEX.statuses(thumb_dir(settings), event_ids)


def status_for(settings: Settings, event_id: str) -> str:
    """ready | pending | unavailable | none (never asked)."""
    if path_for(settings, event_id).is_file():
        return "ready"
    neg = _neg_path(settings, event_id)
    if neg.is_file() and time.time() - neg.stat().st_mtime < NEG_TTL_S:
        return "unavailable"
    if WORKER.is_pending(event_id):
        return "pending"
    return "none"


def _redact(text: str, url: str, settings: Settings) -> str:
    out = text.replace(url, "<rtsp-url>")
    for secret in (settings.nvr_password, settings.nvr_user, settings.nvr_host):
        if secret:
            out = out.replace(str(secret), "***")
    return out


def _grab(url: str, out: Path, settings: Settings, timeout_s: int = 40) -> bool:
    """One decoded frame from the RTSP playback stream into `out` (JPEG, 480 px wide)."""
    ff = shutil.which("ffmpeg")
    if not ff:
        STATE["last_error"] = "ffmpeg_missing"
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.stem + ".tmp.jpg")
    args = [ff, "-hide_banner", "-loglevel", "error", "-y", "-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "5", "-f", "image2", str(tmp)]
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        STATE["last_error"] = "timeout"
        tmp.unlink(missing_ok=True)
        return False
    if proc.returncode != 0 or not tmp.is_file() or tmp.stat().st_size == 0:
        STATE["last_error"] = (_redact(proc.stderr or "", url, settings).strip()[-160:]) or f"ffmpeg_{proc.returncode}"
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(out)
    return True


def generate(db: Database, settings: Settings, event_id: str) -> bool:
    """Look the event and its camera up, grab the frame, then push `event_updated` to the event sockets."""
    with db.connection() as conn:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        ev = events_ingest.row_to_event(row) if row else None
        cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (ev["camera_id"],)).fetchone() if ev and ev.get("camera_id") else None
        from ..routers.settings import read_settings

        tz_name = read_settings(conn)["time.zone"]
    out = path_for(settings, event_id)
    ok = False
    if ev and cam and cam["main_track"] and eligible(ev):
        start = parse_utc(ev["occurred_at"]) + dt.timedelta(seconds=1)
        end = start + dt.timedelta(seconds=30)
        try:
            url = playback.playback_rtsp_url(settings, int(cam["main_track"]), start, end, tz_name)
            ok = _grab(url, out, settings)
        except Exception as exc:  # noqa: BLE001 - a thumbnail must never take the worker down
            STATE["last_error"] = type(exc).__name__
            ok = False
    else:
        STATE["last_error"] = "no_recording_source"
    if ok:
        STATE["generated"] += 1
        _neg_path(settings, event_id).unlink(missing_ok=True)
    else:
        STATE["failed"] += 1
        neg = _neg_path(settings, event_id)
        neg.parent.mkdir(parents=True, exist_ok=True)
        neg.write_text(str(STATE["last_error"] or "failed"), encoding="utf-8")
    INDEX.note(thumb_dir(settings), event_id, ok)
    if ev:
        ev["camera_name"] = (cam["alias"] or cam["name_source"] or cam["id"]) if cam else None
        ev["thumbnail"] = "ready" if ok else "unavailable"
        ev["_type"] = "event_updated"
        events_ingest.publish(ev)
    return ok


class ThumbnailWorker(threading.Thread):
    def __init__(self) -> None:
        super().__init__(name="event-thumbs", daemon=True)
        self.q: queue.Queue[str] = queue.Queue()
        self.pending: set[str] = set()
        self.lock = threading.Lock()
        self.stop_evt = threading.Event()
        self.db: Database | None = None
        self.settings: Settings | None = None

    def start_with(self, db: Database, settings: Settings) -> None:
        self.db, self.settings = db, settings
        self.stop_evt.clear()
        if self.is_alive():
            return
        if self._started.is_set():  # a finished thread cannot be started again: re-initialise the Thread state (tests start several apps in one process)
            threading.Thread.__init__(self, name=self.name, daemon=True)
        self.start()

    def is_pending(self, event_id: str) -> bool:
        with self.lock:
            return event_id in self.pending or STATE["busy"] == event_id

    def request(self, settings: Settings, event_ids: Iterable[str]) -> int:
        """Queue thumbnails that are neither ready, freshly failed nor already queued. Returns how many were queued."""
        n = 0
        with self.lock:
            for eid in event_ids:
                if eid in self.pending or STATE["busy"] == eid:
                    continue
                if path_for(settings, eid).is_file():
                    continue
                neg = _neg_path(settings, eid)
                if neg.is_file() and time.time() - neg.stat().st_mtime < NEG_TTL_S:
                    continue
                if len(self.pending) >= MAX_QUEUE:
                    break
                self.pending.add(eid)
                self.q.put(eid)
                n += 1
            STATE["queued"] = len(self.pending)
        return n

    def run(self) -> None:
        while not self.stop_evt.is_set():
            try:
                eid = self.q.get(timeout=1)
            except queue.Empty:
                continue
            with self.lock:
                self.pending.discard(eid)
                STATE["busy"] = eid
                STATE["queued"] = len(self.pending)
            try:
                if self.db and self.settings:
                    generate(self.db, self.settings, eid)
            except Exception as exc:  # noqa: BLE001
                STATE["last_error"] = type(exc).__name__
                log.warning("thumbnail %s failed: %s", eid, type(exc).__name__)
            finally:
                with self.lock:
                    STATE["busy"] = None


WORKER = ThumbnailWorker()


def prune(settings: Settings, retention_days: int) -> int:
    """Drop thumbnails older than the events retention and keep the folder under MAX_DIR_BYTES (oldest first)."""
    d = thumb_dir(settings)
    if not d.is_dir():
        return 0
    cutoff = time.time() - retention_days * 86400
    removed = 0
    files = sorted((p for p in d.iterdir() if p.is_file()), key=lambda p: p.stat().st_mtime)
    total = sum(p.stat().st_size for p in files)
    for p in files:
        st = p.stat()
        if st.st_mtime < cutoff or total > MAX_DIR_BYTES or (p.suffix == ".unavailable" and time.time() - st.st_mtime > NEG_TTL_S):
            try:
                p.unlink()
                removed += 1
                total -= st.st_size
            except OSError:
                pass
    if removed:
        INDEX.invalidate(d)
    return removed
