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
from ..db import Database, now_iso
from ..errors import ApiError
from . import nvr, recordings
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


def _files_for(settings: Settings, conn: sqlite3.Connection, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> tuple[list[ExportFile], str]:
    """Raw NVR files overlapping [start, end) with their playbackURIs and sizes (from the URI's size param)."""
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


def create_job(conn: sqlite3.Connection, settings: Settings, principal: Any, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str, max_bytes: int) -> dict[str, Any]:
    files, coverage = _files_for(settings, conn, cam, start, end, tz_name)
    if not files:
        raise ApiError(409, "no_recording", "אין הקלטה בטווח המבוקש.", details={"coverage": coverage})
    if len(files) > MAX_FILES:
        raise ApiError(422, "validation", f"הטווח מכסה {len(files)} קבצים; המקסימום {MAX_FILES}. צמצם את הטווח.")
    total = sum(f.size or 0 for f in files)
    if total > max_bytes:
        raise ApiError(422, "export_too_large", f"נפח משוער {total // (1024 * 1024)} MB מעל המגבלה ({max_bytes // (1024 * 1024)} MB).", details={"estimate_bytes": total})
    payload = Payload(files=files, estimate_bytes=total or None, timezone=tz_name, coverage=coverage)
    job_id = uuid.uuid4().hex[:12]
    now = now_iso()
    conn.execute(
        "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, error, payload_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (job_id, principal.user_id, principal.username, cam["id"], camera_name(cam), iso_utc(start), iso_utc(end), "queued", 0.0, None, json.dumps(_payload_dict(payload), ensure_ascii=False), now, now),
    )
    WORKER.wake()
    return _row_to_job(conn.execute("SELECT * FROM export_jobs WHERE id = ?", (job_id,)).fetchone())


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
    if row["state"] == "queued":
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

    def start(self, db: Database, settings: Settings) -> None:
        self.db, self.settings = db, settings
        with db.connection() as conn:
            n = conn.execute("UPDATE export_jobs SET state = 'interrupted', error = 'הופסק בהפעלה מחדש של ה־Add-on', updated_at = ? WHERE state = 'running'", (now_iso(),)).rowcount
        if n:
            log.warning("%d export job(s) were running at shutdown; marked interrupted", n)
        self.stop = False
        self.thread = threading.Thread(target=self._loop, name="export-worker", daemon=True)
        self.thread.start()

    def wake(self) -> None:
        self.event.set()

    def _loop(self) -> None:
        while not self.stop:
            self.event.wait(timeout=15)
            self.event.clear()
            try:
                self.run_pending()
            except Exception as exc:  # never die
                log.exception("export worker failure: %s", type(exc).__name__)

    def run_pending(self) -> int:
        """Run queued jobs one after another (also callable synchronously in tests). Returns jobs run."""
        assert self.db and self.settings
        ran = 0
        while not self.stop:
            with self.db.connection() as conn:
                row = conn.execute("SELECT * FROM export_jobs WHERE state = 'queued' ORDER BY created_at LIMIT 1").fetchone()
                if not row:
                    return ran
                conn.execute("UPDATE export_jobs SET state = 'running', updated_at = ? WHERE id = ?", (now_iso(), row["id"]))
            self._run(row["id"])
            ran += 1
        return ran

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
        d = job_dir(settings, job_id)
        d.mkdir(parents=True, exist_ok=True)
        total_expected = sum(f.size or 0 for f in payload.files) or None
        done_bytes = 0
        ok_files: list[ExportFile] = []
        cancelled = False
        for idx, f in enumerate(payload.files):
            if job_id in self.cancel_flags:
                cancelled = True
                f.state = "skipped"
                continue
            dest = d / f"{idx:03d}.ps"
            f.state = "downloading"
            self._update(job_id, payload=payload)
            base = done_bytes

            def progress(n: int, _f=f, _base=base) -> bool:
                _f.bytes = n
                if total_expected:
                    self._update(job_id, progress=min(0.95, (_base + n) / total_expected))
                return job_id not in self.cancel_flags  # False = abort

            try:
                self.downloader(settings, f.playback_uri, dest, progress)
                f.state = "downloaded"
                f.bytes = dest.stat().st_size
                done_bytes += f.bytes
                ok_files.append(f)
            except ApiError as exc:
                if job_id in self.cancel_flags:
                    cancelled = True
                    f.state = "skipped"
                else:
                    f.state = "failed"
                    f.error = exc.code
                    log.warning("export %s file %s failed: %s", job_id, f.name, exc.code)
            except Exception as exc:  # unexpected
                f.state = "failed"
                f.error = type(exc).__name__
                log.exception("export %s file %s crashed", job_id, f.name)
            self._update(job_id, payload=payload)
        payload.bytes_done = done_bytes
        if cancelled:
            self.cancel_flags.discard(job_id)
            self._update(job_id, state="cancelled", payload=payload, error="בוטל על ידי המשתמש")
            return
        if not ok_files:
            self._update(job_id, state="failed", payload=payload, error="אף קובץ לא ירד מה־NVR")
            return
        try:
            self._finish(job_id, d, payload, ok_files, row)
        except Exception as exc:
            log.exception("export %s post-processing failed", job_id)
            payload.remux = "failed"
            payload.note = f"post-processing failed: {type(exc).__name__}"
            self._deliver_raw(d, payload, ok_files)
        state = "done" if all(f.state in ("downloaded", "remuxed") for f in payload.files) else "partial"
        self._update(job_id, state=state, progress=1.0, payload=payload, error=None if state == "done" else "חלק מהקבצים לא ירדו; הייצוא חלקי")

    def _finish(self, job_id: str, d: Path, payload: Payload, files: list[ExportFile], row: sqlite3.Row) -> None:
        ff = ffmpeg_path()
        req_from, req_to = parse_utc(row["requested_from"]), parse_utc(row["requested_to"])
        first_start = parse_utc(files[0].start_at)
        if ff:
            parts: list[Path] = []
            for f in files:
                idx = payload.files.index(f)
                src, mp4 = d / f"{idx:03d}.ps", d / f"{idx:03d}.mp4"
                _ffmpeg(ff, ["-f", "mpeg", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy", "-c:a", "aac", "-ar", "8000", "-b:a", "32k", "-movflags", "+faststart", str(mp4)])
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
            "source": {"kind": "hikvision-nvr-download-by-file", "files": [{k: v for k, v in asdict(f).items() if k != "playback_uri"} for f in payload.files]},
            "container": payload.container,
            "remux": payload.remux,
            "output": {"name": payload.output_name, "bytes": out.stat().st_size, "sha256": payload.sha256},
            "notes": ["SHA-256 proves integrity since export, not authenticity against the camera (chapter 27)."],
            "created_at": now_iso(),
        }
        (d / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        payload.manifest = "manifest.json"

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


def _ffmpeg(ff: str, args: list[str], cwd: Path | None = None) -> None:
    proc = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", *args], cwd=cwd, capture_output=True, text=True, timeout=1800)
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


WORKER = Worker()
