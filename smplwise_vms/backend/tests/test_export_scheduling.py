"""Export queue order: the smallest estimated job runs first (the NVR hands files out at a fixed rate, so a short clip
must not wait behind a huge file), except that a job which has waited longer than AGED_S goes first so big jobs never
starve."""
from __future__ import annotations

import datetime as dt
import json

from smplwise.main import create_app
from smplwise.services import exports as ex
from smplwise.services.timeutil import iso_utc


def _insert(conn, job_id: str, estimate: int, created: dt.datetime) -> None:
    payload = {"files": [], "estimate_bytes": estimate, "timezone": "UTC", "coverage": "complete"}
    conn.execute(
        "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, error, payload_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (job_id, "u", "joni", "cam", "cam", "2026-09-17T10:00:00Z", "2026-09-17T10:01:00Z", "queued", 0.0, None, json.dumps(payload), iso_utc(created), iso_utc(created)),
    )


def test_smallest_queued_job_first_unless_one_has_aged(settings):
    app = create_app(settings)
    now = dt.datetime.now(dt.timezone.utc)
    with app.state.db.connection() as conn:
        _insert(conn, "big-old", 1_000_000_000, now - dt.timedelta(minutes=3))
        _insert(conn, "small-new", 20_000_000, now - dt.timedelta(minutes=1))
        _insert(conn, "mid", 200_000_000, now - dt.timedelta(minutes=2))
        order = [r["id"] for r in conn.execute("SELECT id FROM export_jobs WHERE state = 'queued' ORDER BY CASE WHEN created_at <= ? THEN 0 ELSE 1 END, COALESCE(json_extract(payload_json, '$.estimate_bytes'), 0), created_at", (ex._aged_cutoff(),)).fetchall()]
        assert order == ["small-new", "mid", "big-old"], "smallest first while nobody has waited long"
        assert conn.execute(ex.NEXT_JOB_SQL, (ex._aged_cutoff(),)).fetchone()["id"] == "small-new"
        # once the big one has waited longer than the cap it goes first
        conn.execute("UPDATE export_jobs SET created_at = ? WHERE id = 'big-old'", (iso_utc(now - dt.timedelta(seconds=ex.AGED_S + 60)),))
        assert conn.execute(ex.NEXT_JOB_SQL, (ex._aged_cutoff(),)).fetchone()["id"] == "big-old"
