"""Durable export jobs (MASTER_SPEC ch. 27, T048).

Pipeline per job: files overlapping the requested range (from the NVR search, playbackURI per file) →
estimate → queue → download each file by name (the only download the lab NVR supports, KNOWN_QUIRKS S4/S6)
→ remux the Hikvision PS container to MP4 with ffmpeg when available (H.264 copied, G.711 audio →
AAC), concatenate, trim to the requested range at key frames → manifest with requested/actual ranges,
source, pipeline version and SHA-256 per file. Without ffmpeg the PS files are delivered as they are
(`.mpg`), never mislabelled as MP4. A failure never touches the NVR's recordings.

The worker is one thread: the NVR serves one download at a time comfortably; progress is bytes-based.
Jobs are rows in `export_jobs` and survive restarts (a job interrupted by a restart is marked so; it can
be retried explicitly, never re-run silently).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import os
import re
import shutil
import sqlite3
import subprocess
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit

from ..config import Settings
from ..db import Database, get_setting, now_iso, retry_locked, unlocked
from ..errors import ApiError
from . import nvr, recordings
from .child_env import minimal_env
from .timeutil import UTC, iso_utc, nvr_wall_to_utc, parse_utc, zone

log = logging.getLogger("smplwise.exports")
PIPELINE_VERSION = "export-1"
MAX_FILES = 40
MAX_RANGE = dt.timedelta(hours=6)


@dataclass
class ExportFile:
    name: str
    start_at: str  # UTC
    end_at: str
    start_raw: str
    end_raw: str
    size: int | None
    state: str = "pending"  # pending | downloading | downloaded | remuxed | failed | skipped
    bytes: int = 0
    error: str | None = None
    playback_uri: str = field(default="", repr=False)  # server-side only, never returned


@dataclass
class Payload:
    files: list[ExportFile]
    estimate_bytes: int | None
    timezone: str
    coverage: str
    output: str | None = None  # relative file name inside the job dir
    output_name: str | None = None  # download name
    media_type: str = "application/octet-stream"
    container: str = "unknown"  # mp4 | hikvision-ps | zip
    actual_from: str | None = None
    actual_to: str | None = None
    remux: str = "pending"  # done | unavailable | failed | skipped
    manifest: str | None = None
    sha256: str | None = None
    bytes_done: int = 0
    note: str = ""
    pauses: int = 0  # disk-full pauses in a row (reset when the job finishes a pass without one)
    resume_after: str | None = None  # UTC: no automatic resume before this (back-off)
    need_bytes: int = 0  # bytes still needed when it last paused: at least what the aborted file had reached
    recorder_id: str | None = None  # security review L6: the recorder the files were searched on (the download goes there only)


def _files_for(settings: Settings, conn: sqlite3.Connection, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> tuple[list[ExportFile], str]:
    """Raw NVR files overlapping [start, end) with their playbackURIs and sizes (from the URI's size param)."""
    from ..recorder_scope import camera_settings
    from .recorders import vendor_io

    rs = camera_settings(settings, cam)
    if vendor_io.handles(rs):  # CR-025 P3: one RTSP `backup` request per recording (sizes unknown)
        return vendor_io.export_files(rs, cam["recorder_id"], cam["channel"], start, end, tz_name)
    tz = zone(tz_name)
    matches, coverage, _pages = recordings.list_matches(settings, cam, start, end, tz_name)
    files: list[ExportFile] = []
    for m in matches:
        s_utc = nvr_wall_to_utc(m.start_raw, tz)
        e_utc = nvr_wall_to_utc(m.end_raw, tz)
        if e_utc <= start or s_utc >= end or not m.playback_uri:
            continue
        q = parse_qs(urlsplit(m.playback_uri).query)
        size = q.get("size", [None])[0]
        name = q.get("name", [None])[0] or f"{m.track_id}_{m.start_raw}"
        files.append(ExportFile(name=name, start_at=iso_utc(s_utc), end_at=iso_utc(e_utc), start_raw=m.start_raw, end_raw=m.end_raw, size=int(size) if size and size.isdigit() else None, playback_uri=m.playback_uri))
    files.sort(key=lambda f: f.start_at)
    return files, coverage


def estimate(settings: Settings, conn: sqlite3.Connection, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> dict[str, Any]:
    if end <= start:
        raise ApiError(422, "validation", "טווח הייצוא ריק.")
    if end - start > MAX_RANGE:
        raise ApiError(422, "validation", "טווח ייצוא מקסימלי: 6 שעות.")
    files, coverage = _files_for(settings, conn, cam, start, end, tz_name)
    sizes = [f.size for f in files]
    total = sum(s for s in sizes if s) if any(sizes) else None
    return {
        "files": len(files),
        "estimate_bytes": total,
        "coverage": coverage,
        "first_file_at": files[0].start_at if files else None,
        "last_file_end_at": files[-1].end_at if files else None,
        "note": "הייצוא מוריד קבצים שלמים מה־NVR ואז חותך לטווח (ב־keyframe); ללא ffmpeg הקבצים נמסרים כפי שהם (Hikvision PS)." if files else "אין הקלטה בטווח.",
        "ffmpeg": bool(ffmpeg_path()),
    }


def ffmpeg_path() -> str | None:
    return shutil.which("ffmpeg")


def camera_name(cam: sqlite3.Row) -> str:
    keys = cam.keys()
    return (cam["alias"] if "alias" in keys and cam["alias"] else None) or (cam["name_source"] if "name_source" in keys else None) or (cam["name"] if "name" in keys else None) or cam["id"]


# ---------------------------------------------------------------- persistence

def _row_to_job(row: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(row["payload_json"])
    files = [{k: v for k, v in f.items() if k != "playback_uri"} for f in payload.get("files", [])]
    return {
        "id": row["id"],
        "camera_id": row["camera_id"],
        "camera_name": row["camera_name"],
        "owner": row["owner_username"],
        "owner_user_id": row["owner_user_id"],
        "requested_from": row["requested_from"],
        "requested_to": row["requested_to"],
        "state": row["state"],
        "progress": row["progress"],
        "error": row["error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "files": files,
        **{k: v for k, v in payload.items() if k != "files"},
        "download_ready": row["state"] in ("done", "partial") and bool(payload.get("output")),
    }


MAX_ACTIVE_JOBS = 5  # queued + running + paused per owner
MAX_QUEUED_TOTAL = 20  # queued + paused across all owners: the one worker thread's backlog is bounded (T068)
MB = 1024 * 1024

# ---------------------------------------------------------------- backpressure: queue bound and free disk (T068)

DEFAULT_MIN_FREE_MB = 1024  # setting storage.min_free_mb: exports never take the add-on's data disk below this
RESUME_MARGIN_MB = 64  # a paused job resumes once free space is back above the minimum by this much (no flapping)
DISK_CHECK_EVERY_S = 1.0  # during a download, free space is re-checked at most this often
PAUSED = "paused_disk_full"
STATS: dict[str, int] = {"refused_disk": 0, "refused_queue_full": 0, "paused_disk_full": 0, "resumed": 0}
_stats_lock = threading.Lock()


def _count(name: str) -> None:
    with _stats_lock:
        STATS[name] += 1


def stats() -> dict[str, int]:
    with _stats_lock:
        return dict(STATS)


def min_free_mb(conn: sqlite3.Connection) -> int:
    try:
        return max(0, int(get_setting(conn, "storage.min_free_mb", str(DEFAULT_MIN_FREE_MB)) or DEFAULT_MIN_FREE_MB))
    except ValueError:
        return DEFAULT_MIN_FREE_MB


def free_bytes(settings: Settings) -> int | None:
    """Free space on the file system that holds the data directory (None when it cannot be read)."""
    try:
        return int(shutil.disk_usage(settings.data_dir).free)
    except OSError:
        return None


def disk_state(settings: Settings, min_mb: int) -> dict[str, Any]:
    try:
        usage = shutil.disk_usage(settings.data_dir)
        free, total = int(usage.free), int(usage.total)
    except OSError:
        free = total = None
    return {"free_mb": None if free is None else free // MB, "total_mb": None if total is None else total // MB, "min_free_mb": min_mb,
            "low": free is not None and free < min_mb * MB}


def require_disk(settings: Settings, min_mb: int, need_bytes: int = 0) -> None:
    """507 when a new export would take the data disk below `min_mb` (or it already is below it)."""
    free = free_bytes(settings)
    if free is None:
        return
    if free < min_mb * MB:
        _count("refused_disk")
        raise ApiError(507, "insufficient_storage",
                       f"אין מספיק מקום פנוי בדיסק של התוסף לייצוא חדש: פנויים {free // MB} MB, והמינימום הוא {min_mb} MB. מחק ייצואים ישנים או פנה מקום ונסה שוב.",
                       retryable=True, details={"free_mb": free // MB, "min_free_mb": min_mb})
    if need_bytes and free - need_bytes < min_mb * MB:
        _count("refused_disk")
        raise ApiError(507, "insufficient_storage",
                       f"הייצוא דורש כ־{max(1, need_bytes // MB)} MB, ואחריו יישארו פחות מ־{min_mb} MB פנויים בדיסק של התוסף. צמצם את הטווח או פנה מקום.",
                       retryable=True, details={"free_mb": free // MB, "min_free_mb": min_mb, "estimate_mb": need_bytes // MB})


def check_quota(conn: sqlite3.Connection, principal: Any) -> None:
    active = conn.execute("SELECT COUNT(*) FROM export_jobs WHERE owner_user_id = ? AND state IN ('queued', 'running', 'paused_disk_full')", (principal.user_id,)).fetchone()[0]
    if active >= MAX_ACTIVE_JOBS:
        raise ApiError(429, "too_many_jobs", "יש כבר 5 עבודות ייצוא ממתינות; המתן לסיומן.", retryable=True)
    waiting = conn.execute("SELECT COUNT(*) FROM export_jobs WHERE state IN ('queued', 'paused_disk_full')").fetchone()[0]
    if waiting >= MAX_QUEUED_TOTAL:
        _count("refused_queue_full")
        raise ApiError(429, "export_queue_full", f"תור הייצוא מלא ({MAX_QUEUED_TOTAL} עבודות ממתינות במערכת); נסה שוב כשחלק מהן יסתיימו.", retryable=True,
                       details={"waiting": waiting, "max": MAX_QUEUED_TOTAL})


def paused_jobs(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM export_jobs WHERE state = ?", (PAUSED,)).fetchone()[0]


UNKNOWN_FILE_BYTES = 64 * MB  # a file the NVR listed without a size counts as the average known size, else this
PAUSE_BACKOFF_S = (15, 60, 300)  # the n-th pause in a row keeps the job paused at least this long (capped at the last)


def _now() -> dt.datetime:
    return dt.datetime.now(UTC)


def estimate_with_unknown(files: list[ExportFile]) -> int:
    """Bytes the export will put on the data disk. A file without a size (some NVR answers carry none) counts as the
    average of the known sizes, or UNKNOWN_FILE_BYTES when none is known - never as 0, which skipped the disk guard."""
    known = [f.size for f in files if f.size]
    guess = (sum(known) // len(known)) if known else UNKNOWN_FILE_BYTES
    return sum(f.size or guess for f in files)


def still_needed(payload: dict[str, Any]) -> int:
    """Bytes a paused job still has to download: the files not on disk yet (unknown sizes as in estimate_with_unknown),
    and never less than what it reached before its last pause (`need_bytes`) - so a job whose sizes are unknown does not
    resume, fill the disk to the same point, pause and resume again forever."""
    files = [f for f in payload.get("files", []) if f.get("state") not in ("downloaded", "remuxed", "failed", "skipped")]
    known = [f["size"] for f in payload.get("files", []) if f.get("size")]
    guess = (sum(known) // len(known)) if known else UNKNOWN_FILE_BYTES
    return max(sum(f.get("size") or guess for f in files), int(payload.get("need_bytes") or 0))


def resume_paused(conn: sqlite3.Connection, settings: Settings, *, manual: bool = False) -> int:
    """Put jobs paused for a full disk back in the queue, oldest first, while there is room for them.
    Automatic (the worker's every pass): a job resumes only after its back-off (PAUSE_BACKOFF_S by pauses in a row) and
    when what it still needs (still_needed: at least the bytes it reached last time) fits above the minimum plus
    RESUME_MARGIN_MB - so a job whose next file cannot fit never loops download / abort / resume against the NVR.
    Manual (the storage screen): every paused job resumes as soon as free space is above the minimum (507 when it is
    not); one that still does not fit pauses again. Downloaded files are kept; the worker continues with the first file
    not yet on disk."""
    rows = conn.execute("SELECT id, payload_json FROM export_jobs WHERE state = ? ORDER BY created_at", (PAUSED,)).fetchall()
    if not rows:
        return 0
    min_mb = min_free_mb(conn)
    free = free_bytes(settings)
    if manual and free is not None and free < min_mb * MB:
        raise ApiError(507, "insufficient_storage", f"עדיין אין מספיק מקום: פנויים {free // MB} MB, והמינימום הוא {min_mb} MB. פנה מקום ונסה שוב.",
                       retryable=True, details={"free_mb": free // MB, "min_free_mb": min_mb})
    room = None if free is None else free - min_mb * MB - (0 if manual else RESUME_MARGIN_MB * MB)
    resumed = 0
    now = _now()
    for r in rows:
        if not manual:
            payload = json.loads(r["payload_json"])
            if payload.get("resume_after") and parse_utc(payload["resume_after"]) > now:
                continue  # back-off after repeated pauses (15 s, 1 min, 5 min)
            if room is not None:
                remaining = still_needed(payload)
                if remaining > room:
                    continue
                room -= remaining
        conn.execute("UPDATE export_jobs SET state = 'queued', error = NULL, updated_at = ? WHERE id = ? AND state = ?", (now_iso(), r["id"], PAUSED))
        _count("resumed")
        resumed += 1
    if resumed:
        log.info("%d export job(s) resumed: %s MB free", resumed, "?" if free is None else free // MB)
        WORKER.wake()
    return resumed


def create_job(conn: sqlite3.Connection, settings: Settings, principal: Any, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str, max_bytes: int,
               recheck: Callable[[sqlite3.Connection], None] | None = None) -> dict[str, Any]:
    """`recheck` (and the owner's job quota) run again after the NVR search, in the same transaction as the INSERT: the
    search runs without the write lock, so a parallel request may have created its job meanwhile."""
    min_mb = min_free_mb(conn)
    require_disk(settings, min_mb)  # a full disk refuses before the NVR is even asked
    # the NVR search (paged, and queued behind any other search: one at a time on this firmware) runs without the
    # request's write lock - under it, every other writer waited for the NVR (round-10 lock storm)
    with unlocked(conn):
        files, coverage = _files_for(settings, conn, cam, start, end, tz_name)
    check_quota(conn, principal)
    if recheck is not None:
        recheck(conn)
    if not files:
        raise ApiError(409, "no_recording", "אין הקלטה בטווח המבוקש.", details={"coverage": coverage})
    if len(files) > MAX_FILES:
        raise ApiError(422, "validation", f"הטווח מכסה {len(files)} קבצים; המקסימום {MAX_FILES}. צמצם את הטווח.")
    total = sum(f.size or 0 for f in files)
    if total > max_bytes:
        raise ApiError(422, "export_too_large", f"נפח משוער {total // (1024 * 1024)} MB מעל המגבלה ({max_bytes // (1024 * 1024)} MB).", details={"estimate_bytes": total})
    require_disk(settings, min_mb, estimate_with_unknown(files))  # the NVR files land on the data disk first (unknown sizes estimated)
    payload = Payload(files=files, estimate_bytes=total or None, timezone=tz_name, coverage=coverage, recorder_id=_recorder_of(cam))
    job_id = uuid.uuid4().hex[:12]
    now = now_iso()
    conn.execute(
        "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, error, payload_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (job_id, principal.user_id, principal.username, cam["id"], camera_name(cam), iso_utc(start), iso_utc(end), "queued", 0.0, None, json.dumps(_payload_dict(payload), ensure_ascii=False), now, now),
    )
    WORKER.wake()
    return _row_to_job(conn.execute("SELECT * FROM export_jobs WHERE id = ?", (job_id,)).fetchone())


def _recorder_of(cam: Any) -> str:
    from ..recorder_scope import PRIMARY

    try:
        return cam["recorder_id"] or PRIMARY
    except (KeyError, IndexError, TypeError):
        return PRIMARY


def _payload_dict(p: Payload) -> dict[str, Any]:
    d = asdict(p)
    d["files"] = [asdict(f) for f in p.files]
    return d


def get_job(conn: sqlite3.Connection, job_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM export_jobs WHERE id = ?", (job_id,)).fetchone()
    return _row_to_job(row) if row else None


def list_jobs(conn: sqlite3.Connection, owner_user_id: str | None, limit: int = 50) -> list[dict[str, Any]]:
    if owner_user_id is None:
        rows = conn.execute("SELECT * FROM export_jobs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM export_jobs WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT ?", (owner_user_id, limit)).fetchall()
    return [_row_to_job(r) for r in rows]


def request_cancel(conn: sqlite3.Connection, job_id: str) -> None:
    row = conn.execute("SELECT state FROM export_jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "עבודת הייצוא לא נמצאה.")
    if row["state"] in ("queued", PAUSED):
        conn.execute("UPDATE export_jobs SET state = 'cancelled', error = 'בוטל על ידי המשתמש', updated_at = ? WHERE id = ?", (now_iso(), job_id))
    elif row["state"] == "running":
        WORKER.cancel_flags.add(job_id)
    else:
        raise ApiError(409, "not_cancellable", "העבודה כבר הסתיימה.")


def delete_job(conn: sqlite3.Connection, settings: Settings, job_id: str) -> None:
    row = conn.execute("SELECT state FROM export_jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "עבודת הייצוא לא נמצאה.")
    if row["state"] == "running":
        raise ApiError(409, "running", "לא ניתן למחוק עבודה בזמן ריצה; בטל אותה קודם.")
    conn.execute("DELETE FROM export_jobs WHERE id = ?", (job_id,))
    shutil.rmtree(job_dir(settings, job_id), ignore_errors=True)


def job_dir(settings: Settings, job_id: str) -> Path:
    return settings.data_dir / "exports" / job_id


def output_path(settings: Settings, job: dict[str, Any]) -> Path | None:
    if not job.get("output"):
        return None
    p = job_dir(settings, job["id"]) / job["output"]
    return p if p.is_file() else None


def retention_sweep(db: Database, settings: Settings, days: int) -> int:
    """Delete finished jobs (and their files) older than `days`. Running/queued jobs are kept."""
    cutoff = iso_utc(dt.datetime.now(UTC) - dt.timedelta(days=days))
    removed = 0
    with db.connection() as conn:
        rows = conn.execute("SELECT id FROM export_jobs WHERE state IN ('done','partial','failed','cancelled','interrupted') AND updated_at < ?", (cutoff,)).fetchall()
        for r in rows:
            conn.execute("DELETE FROM export_jobs WHERE id = ?", (r["id"],))
            shutil.rmtree(job_dir(settings, r["id"]), ignore_errors=True)
            removed += 1
    return removed


# ---------------------------------------------------------------- worker

class Worker:
    def __init__(self) -> None:
        self.event = threading.Event()
        self.thread: threading.Thread | None = None
        self.cancel_flags: set[str] = set()
        self.db: Database | None = None
        self.settings: Settings | None = None
        self.downloader: Callable[..., None] = nvr.download_file  # swapped in tests
        self.stop = False
        self.generation = 0  # a loop from an earlier start() ends itself when this moves on (0.1.75)

    def start(self, db: Database, settings: Settings) -> None:
        self.db, self.settings = db, settings
        with db.connection() as conn:
            n = scrub_credentials(conn)
            if n:
                log.warning("%d export job(s) held a URL with credentials; scrubbed", n)
            n = conn.execute("UPDATE export_jobs SET state = 'interrupted', error = 'הופסק בהפעלה מחדש של ה־Add-on', updated_at = ? WHERE state = 'running'", (now_iso(),)).rowcount
        if n:
            log.warning("%d export job(s) were running at shutdown; marked interrupted", n)
        self.stop = False
        self.generation += 1
        self.event.set()  # let a loop left over from an earlier application notice the new generation and end
        self.thread = threading.Thread(target=self._loop, args=(self.generation,), name="export-worker", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        """End this application's loop now (not at its next 15 s wake-up): a later application in the same process
        must never share the queue with it."""
        self.stop = True
        self.generation += 1
        self.event.set()
        t = self.thread
        if t and t.is_alive() and t is not threading.current_thread():
            t.join(timeout=2)

    def wake(self) -> None:
        self.event.set()

    def _loop(self, generation: int = 0) -> None:
        # One loop per start(): a second application in the same process (tests, a restart inside the add-on) used to
        # leave the old loop alive, and two loops raced for the same queued job.
        while not self.stop and generation == self.generation:
            self.event.wait(timeout=15)
            self.event.clear()
            if self.stop or generation != self.generation:
                break
            try:
                self.run_pending()
            except Exception as exc:  # never die
                log.exception("export worker failure: %s", type(exc).__name__)

    def run_pending(self) -> int:
        """Run queued jobs one after another (also callable synchronously in tests). Returns jobs run."""
        assert self.db and self.settings
        ran = 0
        with self.db.connection() as conn:
            resume_paused(conn, self.settings)  # jobs paused by a full disk come back once there is room again
        while not self.stop:
            with self.db.connection() as conn:
                row = conn.execute(NEXT_JOB_SQL, (_aged_cutoff(),)).fetchone()
                if not row:
                    return ran
                conn.execute("UPDATE export_jobs SET state = 'running', updated_at = ? WHERE id = ?", (now_iso(), row["id"]))
            try:
                self._run(row["id"])
            except Exception as exc:  # noqa: BLE001 - never leave a job "running" until the next restart (T068 soak)
                log.exception("export %s crashed: %s", row["id"], type(exc).__name__)
                self._crashed(row["id"], exc)
            ran += 1
        return ran

    def _crashed(self, job_id: str, exc: BaseException) -> None:
        assert self.db
        db = self.db

        def _mark() -> None:
            with db.connection() as conn:
                conn.execute("UPDATE export_jobs SET state = 'failed', error = ?, updated_at = ? WHERE id = ? AND state = 'running'",
                             (f"הייצוא נכשל בשגיאה פנימית ({type(exc).__name__}); אפשר ליצור אותו מחדש.", now_iso(), job_id))

        try:
            retry_locked(_mark, what=f"export {job_id}: mark failed")
        except Exception:  # noqa: BLE001 - the restart marks it interrupted as a last resort
            log.exception("export %s: could not record the failure", job_id)

    def _update(self, job_id: str, *, state: str | None = None, progress: float | None = None, error: str | None = None, payload: Payload | None = None) -> None:
        assert self.db
        sets, args = ["updated_at = ?"], [now_iso()]
        if state is not None:
            sets.append("state = ?"); args.append(state)
        if progress is not None:
            sets.append("progress = ?"); args.append(round(progress, 4))
        if error is not None:
            sets.append("error = ?"); args.append(error)
        if payload is not None:
            sets.append("payload_json = ?"); args.append(json.dumps(_payload_dict(payload), ensure_ascii=False))
        args.append(job_id)
        with self.db.connection() as conn:
            conn.execute(f"UPDATE export_jobs SET {', '.join(sets)} WHERE id = ?", args)

    def _run(self, job_id: str) -> None:
        assert self.db and self.settings
        settings = self.settings
        with self.db.connection() as conn:
            row = conn.execute("SELECT * FROM export_jobs WHERE id = ?", (job_id,)).fetchone()
        raw = json.loads(row["payload_json"])
        payload = Payload(**{**raw, "files": [ExportFile(**f) for f in raw["files"]]})
        from ..recorder_scope import settings_for

        with self.db.connection(mode="read") as conn:
            cam = conn.execute("SELECT recorder_id FROM cameras WHERE id = ?", (row["camera_id"],)).fetchone()
        # security review L6: the job downloads only from the recorder its files were searched on (stored in the payload; a row
        # from before falls back to the camera's). A camera that is gone or now belongs to another recorder fails the job: its
        # playback requests would otherwise be sent to a recorder they were never meant for.
        rid = payload.recorder_id or (_recorder_of(cam) if cam is not None else None)
        if cam is None or rid is None or _recorder_of(cam) != rid:
            self._update(job_id, state="failed", payload=payload, error="המצלמה או ה־NVR של הייצוא אינם זמינים עוד")
            return
        source = settings_for(settings, rid)  # CR-024: the files are downloaded from the camera's own recorder
        d = job_dir(settings, job_id)
        d.mkdir(parents=True, exist_ok=True)
        total_expected = sum(f.size or 0 for f in payload.files) or None
        with self.db.connection(mode="read") as conn:
            min_mb = min_free_mb(conn)
        done_bytes = 0
        ok_files: list[ExportFile] = []
        cancelled = False
        disk_full: dict[str, Any] = {}  # set when free space fell below the minimum: the job pauses, it does not fail
        for idx, f in enumerate(payload.files):
            if job_id in self.cancel_flags:
                cancelled = True
                f.state = "skipped"
                continue
            dest = d / f"{idx:03d}.ps"
            if f.state == "downloaded" and dest.is_file() and dest.stat().st_size == f.bytes:
                done_bytes += f.bytes  # a resumed job keeps what it downloaded before it was paused
                ok_files.append(f)
                continue
            free = free_bytes(settings)
            if free is not None and free < min_mb * MB:
                disk_full.update(free=free)
                break
            f.state = "downloading"
            f.bytes = 0
            f.error = None
            self._update(job_id, payload=payload)
            base = done_bytes
            last = {"update": 0.0, "disk": time.monotonic()}

            def progress(n: int, _f=f, _base=base, _last=last) -> bool:
                _f.bytes = n
                now = time.monotonic()
                if total_expected and now - _last["update"] >= 1.0:  # at most one progress write a second (was one per 256 KB chunk)
                    _last["update"] = now
                    self._update(job_id, progress=min(0.95, (_base + n) / total_expected))
                if now - _last["disk"] >= DISK_CHECK_EVERY_S:
                    _last["disk"] = now
                    free_now = free_bytes(settings)
                    if free_now is not None and free_now < min_mb * MB:
                        disk_full.update(free=free_now)
                        return False  # abort this file; the job pauses below
                return job_id not in self.cancel_flags  # False = abort

            try:
                from .recorders import vendor_io

                if vendor_io.handles(source) and self.downloader is nvr.download_file:
                    from .recorders.provision_playback import rtsp_download

                    rtsp_download(source, f.playback_uri, dest, progress)  # CR-025: RTSP backup -> MPEG-TS, no re-encode
                else:
                    self.downloader(source, f.playback_uri, dest, progress)
                f.state = "downloaded"
                f.bytes = dest.stat().st_size
                done_bytes += f.bytes
                ok_files.append(f)
            except ApiError as exc:
                if job_id in self.cancel_flags:
                    cancelled = True
                    f.state = "skipped"
                elif disk_full:
                    disk_full["reached"] = f.bytes  # how far this file got: the job needs at least that much room next time
                    f.state, f.bytes = "pending", 0
                else:
                    f.state = "failed"
                    f.error = exc.code
                    log.warning("export %s file %s failed: %s", job_id, f.name, exc.code)
            except OSError as exc:
                if _is_disk_full(exc):  # the disk filled faster than the check: same pause
                    disk_full.update(free=free_bytes(settings) or 0, reached=dest.stat().st_size if dest.exists() else f.bytes)
                    f.state, f.bytes = "pending", 0
                else:
                    f.state = "failed"
                    f.error = type(exc).__name__
                    log.exception("export %s file %s crashed", job_id, f.name)
            except Exception as exc:  # unexpected
                f.state = "failed"
                f.error = type(exc).__name__
                log.exception("export %s file %s crashed", job_id, f.name)
            if disk_full:
                dest.unlink(missing_ok=True)  # a partial file is never kept: the resumed job downloads it again
                break
            self._update(job_id, payload=payload)
        payload.bytes_done = done_bytes
        if disk_full and not cancelled:
            free_mb = int(disk_full.get("free") or 0) // MB
            _count("paused_disk_full")
            payload.pauses += 1
            delay = PAUSE_BACKOFF_S[min(payload.pauses, len(PAUSE_BACKOFF_S)) - 1]
            payload.resume_after = iso_utc(_now() + dt.timedelta(seconds=delay))
            pending = [x for x in payload.files if x.state not in ("downloaded", "remuxed", "failed", "skipped")]
            base_need = estimate_with_unknown(pending) if pending else 0
            # the aborted file counts at least as far as it got (an unknown size would otherwise count as a guess)
            payload.need_bytes = max(base_need, int(disk_full.get("reached") or 0) + sum(x.size or 0 for x in pending[1:]))
            log.warning("export %s paused (%d in a row, next try in >= %d s): %d MB free on the data disk, minimum %d MB, needs >= %d MB",
                        job_id, payload.pauses, delay, free_mb, min_mb, payload.need_bytes // MB)
            self._update(job_id, state=PAUSED, payload=payload,
                         progress=min(0.95, done_bytes / total_expected) if total_expected else None,
                         error=f"הייצוא הושהה: בדיסק של התוסף נשארו {free_mb} MB פנויים (המינימום {min_mb} MB). הוא ימשיך לבד כשיתפנה מקום, או מ'אחסון' › 'המשך ייצואים'.")
            return
        payload.pauses, payload.resume_after, payload.need_bytes = 0, None, 0  # a pass without a pause ends the back-off
        if cancelled:
            self.cancel_flags.discard(job_id)
            self._update(job_id, state="cancelled", payload=payload, error="בוטל על ידי המשתמש")
            return
        if not ok_files:
            self._update(job_id, state="failed", payload=payload, error="אף קובץ לא ירד מה־NVR")
            return
        try:
            from .recorders import vendor_io

            self._finish(job_id, d, payload, ok_files, row, ts=vendor_io.handles(source))
        except Exception as exc:
            log.exception("export %s post-processing failed", job_id)
            payload.remux = "failed"
            payload.note = f"post-processing failed: {type(exc).__name__}"
            self._deliver_raw(d, payload, ok_files)
        state = "done" if all(f.state in ("downloaded", "remuxed") for f in payload.files) else "partial"
        self._update(job_id, state=state, progress=1.0, payload=payload, error=None if state == "done" else "חלק מהקבצים לא ירדו; הייצוא חלקי")

    def _finish(self, job_id: str, d: Path, payload: Payload, files: list[ExportFile], row: sqlite3.Row, ts: bool = False) -> None:
        ff = ffmpeg_path()
        req_from, req_to = parse_utc(row["requested_from"]), parse_utc(row["requested_to"])
        first_start = parse_utc(files[0].start_at)
        if ts and not ff:
            # CR-025: without ffmpeg a Provision export is handed over as the MPEG-TS the device sent (clip.ts / a zip of .ts)
            self._deliver_ts(d, payload, files)
        elif ff:
            # CR-025 (owner, corrected 2026-10-04): Provision exports are remuxed to MP4 like Hikvision ones - the downloaded
            # files are MPEG-TS (RTSP backup copied by ffmpeg), so only the input format differs; video is never re-encoded
            parts: list[Path] = []
            for f in files:
                idx = payload.files.index(f)
                src, mp4 = d / f"{idx:03d}.ps", d / f"{idx:03d}.mp4"
                _ffmpeg(ff, ["-f", "mpegts" if ts else "mpeg", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy", "-c:a", "aac", "-ar", "8000", "-b:a", "32k", "-movflags", "+faststart", str(mp4)])
                f.state = "remuxed"
                parts.append(mp4)
                src.unlink(missing_ok=True)
            joined = parts[0]
            if len(parts) > 1:
                lst = d / "concat.txt"
                lst.write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
                joined = d / "joined.mp4"
                _ffmpeg(ff, ["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(joined)], cwd=d)
            # trim to the requested range; -c copy cuts at key frames, so the actual start may be earlier
            ss = max(0.0, (req_from - first_start).total_seconds())
            to = max(ss + 1.0, (req_to - first_start).total_seconds())
            clip = d / "clip.mp4"
            _ffmpeg(ff, ["-ss", f"{ss:.3f}", "-to", f"{to:.3f}", "-i", str(joined), "-c", "copy", "-movflags", "+faststart", str(clip)])
            for p in parts + ([joined] if joined not in parts else []):
                if p != clip:
                    p.unlink(missing_ok=True)
            payload.output = clip.name
            payload.media_type = "video/mp4"
            payload.container = "mp4"
            payload.remux = "done"
            payload.actual_from = iso_utc(first_start + dt.timedelta(seconds=ss))
            payload.actual_to = iso_utc(min(req_to, parse_utc(files[-1].end_at)))
            payload.note = "החיתוך נעשה ב־keyframe: ההתחלה בפועל עשויה להקדים את המבוקש בכמה שניות."
        else:
            payload.remux = "unavailable"
            self._deliver_raw(d, payload, files)
        tz = zone(payload.timezone)
        local = lambda s: parse_utc(s).astimezone(tz).strftime("%Y-%m-%d_%H-%M-%S")  # noqa: E731
        ext = Path(payload.output or "x.bin").suffix
        payload.output_name = f"{_safe(row['camera_name'])}_{local(row['requested_from'])}_{local(row['requested_to'])}{ext}"
        out = d / payload.output
        payload.sha256 = _sha256(out)
        manifest = {
            "pipeline_version": PIPELINE_VERSION,
            "job_id": job_id,
            "camera_id": row["camera_id"],
            "camera_name": row["camera_name"],
            "requested_from": row["requested_from"],
            "requested_to": row["requested_to"],
            "actual_from": payload.actual_from,
            "actual_to": payload.actual_to,
            "timezone": payload.timezone,
            "source": {"kind": "provision-isr-rtsp-backup" if ts else "hikvision-nvr-download-by-file", "files": [{k: v for k, v in asdict(f).items() if k != "playback_uri"} for f in payload.files]},
            "container": payload.container,
            "remux": payload.remux,
            "output": {"name": payload.output_name, "bytes": out.stat().st_size, "sha256": payload.sha256},
            "notes": ["SHA-256 proves integrity since export, not authenticity against the camera (chapter 27)."],
            "created_at": now_iso(),
        }
        (d / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        payload.manifest = "manifest.json"

    def _deliver_ts(self, d: Path, payload: Payload, files: list[ExportFile]) -> None:
        idxs = [payload.files.index(f) for f in files if (d / f"{payload.files.index(f):03d}.ps").exists()]
        if not idxs:
            raise ApiError(500, "export_failed", "לא נשארו קבצים למסירה.")
        if len(idxs) == 1:
            out = d / "clip.ts"
            (d / f"{idxs[0]:03d}.ps").rename(out)
            payload.output, payload.media_type, payload.container = out.name, "video/mp2t", "mpegts"
        else:
            import zipfile

            out = d / "clip.zip"
            with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
                for i in idxs:
                    z.write(d / f"{i:03d}.ps", f"{i:03d}.ts")
            payload.output, payload.media_type, payload.container = out.name, "application/zip", "zip"
        payload.remux = "skipped"
        payload.actual_from = files[0].start_at
        payload.actual_to = files[-1].end_at
        payload.note = "הקובץ הוא MPEG-TS כפי שה־NVR שלח אותו (ללא המרה); לא נחתך לטווח."

    def _deliver_raw(self, d: Path, payload: Payload, files: list[ExportFile]) -> None:
        """No ffmpeg (or remux failed): hand over the NVR container unchanged, honestly labelled."""
        idxs = [payload.files.index(f) for f in files if (d / f"{payload.files.index(f):03d}.ps").exists()]
        if not idxs:
            raise ApiError(500, "export_failed", "לא נשארו קבצים למסירה.")
        if len(idxs) == 1:
            src = d / f"{idxs[0]:03d}.ps"
            out = d / "clip.mpg"
            src.rename(out)
            payload.output, payload.media_type, payload.container = out.name, "video/mpeg", "hikvision-ps"
        else:
            import zipfile

            out = d / "clip.zip"
            with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
                for i in idxs:
                    z.write(d / f"{i:03d}.ps", f"{i:03d}.mpg")
            payload.output, payload.media_type, payload.container = out.name, "application/zip", "zip"
        payload.actual_from = files[0].start_at
        payload.actual_to = files[-1].end_at
        payload.note = (payload.note + " " if payload.note else "") + "ללא ffmpeg הקובץ הוא ה־PS המקורי של ה־NVR (VLC מנגן אותו); לא נחתך לטווח."


def _is_disk_full(exc: OSError) -> bool:
    import errno

    return exc.errno in (errno.ENOSPC, getattr(errno, "EDQUOT", -1)) or getattr(exc, "winerror", None) in (39, 112)  # ERROR_HANDLE_DISK_FULL, ERROR_DISK_FULL


def _ffmpeg(ff: str, args: list[str], cwd: Path | None = None) -> None:
    proc = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", *args], cwd=cwd, capture_output=True, text=True, timeout=1800, env=minimal_env())
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {proc.stderr[-300:]}")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _safe(name: str) -> str:
    keep = "".join(c if c.isalnum() or c in "-_ " else "_" for c in name).strip().replace(" ", "_")
    return keep[:40] or "camera"


# Shortest job first: the NVR hands files out at a fixed, modest rate, so a 20 MB clip must not wait behind a 1 GB file
# (seen on 2026-09-17: 30+ minutes). A job that has waited longer than AGED_S goes first regardless, so big jobs never
# starve while small ones keep arriving.
AGED_S = 15 * 60
NEXT_JOB_SQL = (
    "SELECT * FROM export_jobs WHERE state = 'queued' "
    "ORDER BY CASE WHEN created_at <= ? THEN 0 ELSE 1 END, COALESCE(json_extract(payload_json, '$.estimate_bytes'), 0), created_at LIMIT 1"
)


def _aged_cutoff() -> str:
    return iso_utc(dt.datetime.now(UTC) - dt.timedelta(seconds=AGED_S))


WORKER = Worker()



_CRED_URL = re.compile(r"((?:rtsp|rtsps|http|https)://)[^/@\s\"']+:[^/@\s\"']*@")


def scrub_credentials(conn: sqlite3.Connection) -> int:
    """Security review HIGH (2026-10-04): remove `user:password@` from every URL stored in export_jobs.payload_json (rows a
    Provision export wrote before the fix). Runs at every worker start; idempotent; returns the rows changed."""
    n = 0
    for row in conn.execute("SELECT id, payload_json FROM export_jobs WHERE payload_json LIKE '%@%'").fetchall():
        clean = _CRED_URL.sub(r"\1", row["payload_json"] or "")
        if clean != row["payload_json"]:
            conn.execute("UPDATE export_jobs SET payload_json = ? WHERE id = ?", (clean, row["id"]))
            n += 1
    return n
