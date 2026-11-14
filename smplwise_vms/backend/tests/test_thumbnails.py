"""Event thumbnails: lazy generation by the worker, states in the list, the image endpoint, scope and pruning."""
from __future__ import annotations

import datetime as dt
import json
import time
import uuid
from dataclasses import replace

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import thumbnails

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"


def _event(app, camera_id, etype="motion", when=None):
    when = when or dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)
    eid = uuid.uuid4().hex[:12]
    occurred = when.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "recording", "MOTION", etype, camera_id, 1, occurred, None, occurred, "inactive", 1, "info", "inferred", json.dumps({}), f"t:{eid}", occurred),
        )
    return eid


def test_thumbnail_lifecycle(settings, monkeypatch):
    settings = replace(settings, nvr_host="nvr.example", nvr_user="viewer", nvr_password="pw")
    app = create_app(settings)
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Entrance"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
    grabbed: list[str] = []

    def fake_grab(url, out, s, timeout_s=40):
        grabbed.append(url)
        if "fail" in url:
            return False
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(JPEG)
        return True

    monkeypatch.setattr(thumbnails, "_grab", fake_grab)
    ok_id = _event(app, cam["id"])
    sys_id = _event(app, None, etype="system")
    # the list marks states and queues the first rows; not eligible rows say so
    r = c.get("/api/v1/events?limit=50").json()["events"]
    by = {e["id"]: e for e in r}
    assert by[ok_id]["thumbnail"] == "pending" and by[sys_id]["thumbnail"] == "unavailable"
    # worker (not started in tests; its queue is shared with other tests) is driven by hand
    thumbnails.WORKER.db, thumbnails.WORKER.settings = app.state.db, settings
    assert thumbnails.WORKER.is_pending(ok_id)
    thumbnails.WORKER.pending.discard(ok_id)
    assert thumbnails.generate(app.state.db, settings, ok_id) is True and grabbed[-1].startswith("rtsp://") and "Streaming/tracks/101" in grabbed[-1]
    img = c.get(f"/api/v1/events/{ok_id}/thumbnail")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg" and img.content == JPEG
    assert c.get("/api/v1/events?limit=50").json()["events"][0]["thumbnail"] in ("ready", "unavailable")
    # a request for a system event is a clean 404; an unknown id too
    assert c.get(f"/api/v1/events/{sys_id}/thumbnail").status_code == 404
    assert c.get("/api/v1/events/nope/thumbnail").status_code == 404
    # failure is remembered (unavailable) instead of retried on every request
    monkeypatch.setattr(thumbnails.playback, "playback_rtsp_url", lambda *a, **k: "rtsp://fail")
    bad_id = _event(app, cam["id"])
    assert c.get(f"/api/v1/events/{bad_id}/thumbnail").status_code == 202 and thumbnails.WORKER.is_pending(bad_id)
    thumbnails.WORKER.pending.discard(bad_id)
    assert thumbnails.generate(app.state.db, settings, bad_id) is False
    assert c.get(f"/api/v1/events/{bad_id}/thumbnail").status_code == 404 and thumbnails.status_for(settings, bad_id) == "unavailable"
    # scope: events.read is an operator permission; a viewer gets 403, an operator the picture
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.get(f"/api/v1/events/{ok_id}/thumbnail", headers=as_user("ron")).status_code == 403
    bind(c, settings, "op", "operator", "installation", "*")
    assert c.get(f"/api/v1/events/{ok_id}/thumbnail", headers=as_user("op")).status_code == 200
    # pruning removes expired files and stale negative markers
    old = thumbnails.path_for(settings, "old")
    old.write_bytes(JPEG)
    t = time.time() - 40 * 86400
    import os

    os.utime(old, (t, t))
    assert thumbnails.prune(settings, 30) >= 1 and not old.exists() and thumbnails.path_for(settings, ok_id).exists()
