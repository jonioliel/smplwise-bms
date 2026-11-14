"""2.0.0 playback stall detection: the two installation settings the player reads (docs/changes/PLAYBACK-STALL-RESUME.md).

`playback.stall_s` (2-30 s, default 5) and `playback.auto_resume_attempts` (0-5, default 3) are browser-side only; the server stores and
validates them and returns them as integers.
"""
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_defaults_are_integers(settings):
    with TestClient(create_app(settings)) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["playback.stall_s"] == 5
        assert s["playback.auto_resume_attempts"] == 3


def test_bounds(settings):
    with TestClient(create_app(settings)) as c:
        for value, code in ((2, 200), (30, 200), (1, 422), (31, 422), ("x", 422)):
            assert c.patch("/api/v1/settings", json={"playback.stall_s": value}).status_code == code, value
        for value, code in ((0, 200), (5, 200), (-1, 422), (6, 422)):
            assert c.patch("/api/v1/settings", json={"playback.auto_resume_attempts": value}).status_code == code, value
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["playback.stall_s"] == 30 and s["playback.auto_resume_attempts"] == 5
