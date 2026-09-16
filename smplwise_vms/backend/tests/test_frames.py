"""Frame at an instant (T044): served from the recording via ffmpeg, cached per 10-second bucket, negative-cached,
refused without playback permission, 503 without an NVR."""
from __future__ import annotations

from dataclasses import replace

from conftest import as_user, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import frames


def test_frame_cache_permissions_and_unconfigured(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Entrance"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
    assert c.get(f"/api/v1/cameras/{cam['id']}/frame?at=2026-09-16T08:00:00Z").status_code == 503, "no NVR configured"

    app2 = create_app(replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p"))
    c2 = TestClient(app2)
    calls: list[str] = []

    def fake_grab(url: str, out, s, timeout_s: int = 40) -> bool:
        calls.append(url)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"\xff\xd8\xff\xd9")
        return True

    monkeypatch.setattr(frames, "GRAB", fake_grab)
    r = c2.get(f"/api/v1/cameras/{cam['id']}/frame?at=2026-09-16T08:00:07Z")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg" and r.content.startswith(b"\xff\xd8")
    assert len(calls) == 1 and "Streaming/tracks/101" in calls[0] and "starttime=" in calls[0]
    assert c2.get(f"/api/v1/cameras/{cam['id']}/frame?at=2026-09-16T08:00:03Z").status_code == 200 and len(calls) == 1, "same 10-second bucket is served from the cache"
    assert c2.get(f"/api/v1/cameras/{cam['id']}/frame?at=not-a-time").status_code == 422
    assert c2.get("/api/v1/cameras/nope/frame?at=2026-09-16T08:00:00Z").status_code == 404

    def failing_grab(url: str, out, s, timeout_s: int = 40) -> bool:
        calls.append("fail")
        return False

    monkeypatch.setattr(frames, "GRAB", failing_grab)
    assert c2.get(f"/api/v1/cameras/{cam['id']}/frame?at=2026-09-16T09:00:00Z").status_code == 404
    n = len(calls)
    assert c2.get(f"/api/v1/cameras/{cam['id']}/frame?at=2026-09-16T09:00:05Z").status_code == 404 and len(calls) == n, "negative cache: no second grab"
    # a user without any binding has no playback right
    assert c2.get(f"/api/v1/cameras/{cam['id']}/frame?at=2026-09-16T08:00:07Z", headers=as_user("nobody")).status_code == 403
