"""Recording-derived events (chapter 26, "inferred" confidence).

The NVR's recording search tags each file with its record type (MOTION, ALARM, …). Every non-continuous
segment is therefore evidence that the device detected something at that time — a fact the product shows
as an event with confidence `inferred` and source `recording`, never as a measured alert. This keeps the
timeline and the event centre useful even when the alert stream carries no smart events (the NVR only
notifies the "surveillance centre" for triggers configured that way).

Runs at start-up and periodically for the current local day; idempotent through the dedup key.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import uuid
from typing import Any

from ..config import Settings
from ..db import Database, now_iso
from ..errors import ApiError
from . import recordings
from .timeutil import UTC, iso_utc, local_day_bounds, parse_utc, zone

log = logging.getLogger("smplwise.events")
STATE: dict[str, Any] = {"last_run": None, "last_ok": None, "last_error": None, "derived": 0}

KIND_TO_TYPE = {"motion": "motion", "alarm": "field", "event": "other", "manual": "manual"}


def search_for_camera(settings: Settings, cam: sqlite3.Row, day: dt.date, tz_name: str) -> recordings.SearchResult:
    """Network phase (ISAPI search, possibly many pages): runs outside any write transaction."""
    start, end = local_day_bounds(day, zone(tz_name))
    return recordings.search_segments(settings, None, cam, start, end, tz_name)


def store_segments(conn: sqlite3.Connection, cam: sqlite3.Row, result: recordings.SearchResult) -> int:
    """Write phase: one short transaction per camera."""
    added = 0
    now = now_iso()
    for seg in result.segments:
        if seg.kind == "continuous" or seg.kind == "unknown":
            continue
        etype = KIND_TO_TYPE.get(seg.kind, "other")
        key = f"rec:{cam['id']}:{etype}:{seg.start_at}"
        if conn.execute("SELECT 1 FROM events WHERE dedup_key = ?", (key,)).fetchone():
            continue
        s_utc, e_utc = parse_utc(seg.start_at), parse_utc(seg.end_at)
        details = {"recording_kind": seg.kind, "start_raw": seg.start_raw, "end_raw": seg.end_raw, "seconds": int((e_utc - s_utc).total_seconds()), "time_precision": "recording_file"}
        conn.execute(
            "INSERT OR IGNORE INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (uuid.uuid4().hex[:12], "recording", seg.kind.upper(), etype, cam["id"], cam["channel"], seg.start_at, seg.end_at, now, "inactive", 1, "info", "inferred", json.dumps(details, ensure_ascii=False), key, now),
        )
        added += 1
    return added


def run_once(db: Database, settings: Settings, tz_name: str, day: dt.date | None = None) -> int:
    """Derive today's (or `day`'s) motion/alarm events for every enabled camera with a recording track."""
    STATE["last_run"] = now_iso()
    if not (settings.nvr_host and settings.nvr_user and settings.nvr_password):
        STATE["last_error"] = "nvr_not_configured"
        return 0
    day = day or dt.datetime.now(zone(tz_name)).date()
    total = 0
    errors: list[str] = []
    with db.connection() as conn:
        cams = conn.execute("SELECT * FROM cameras WHERE enabled = 1 AND main_track IS NOT NULL ORDER BY channel").fetchall()
    for cam in cams:
        try:
            result = search_for_camera(settings, cam, day, tz_name)
            with db.connection() as conn:
                total += store_segments(conn, cam, result)
        except ApiError as exc:
            errors.append(f"ch{cam['channel']}:{exc.code}")
        except Exception as exc:  # never die
            errors.append(f"ch{cam['channel']}:{type(exc).__name__}")
            log.exception("event derivation crashed for camera %s", cam["id"])
    STATE["derived"] += total
    STATE["last_error"] = ", ".join(errors) if errors else None
    if not errors:
        STATE["last_ok"] = now_iso()
    if total:
        log.info("derived %d events from recordings for %s", total, day)
    return total


def prune(db: Database, retention_days: int) -> int:
    cutoff = iso_utc(dt.datetime.now(UTC) - dt.timedelta(days=retention_days))
    with db.connection() as conn:
        return conn.execute("DELETE FROM events WHERE occurred_at < ?", (cutoff,)).rowcount
