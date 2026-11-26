"""LOWS-BACKEND-2550 - the low video findings of the 2.52 deep review (docs/review/DEEP-REVIEW-2520-INDEX.md).

V-06  a disabled camera's streams leave go2rtc at the next stream sync (exact names, our namespace only), and an open relay's lease ends
      when its camera is disabled.
V-07  the motion capability cache is keyed by (recorder, channel) and keeps only a 200 answer.
V-08  `revoked` is a terminal playback state (no quota slot, no media handle), and a late first media byte never revives a finished session.
V-09  the snapshot cache file is replaced whole (never rewritten in place) and one request per camera asks the recorder at a time.
V-10  the foreign-stream alias guard compares every "/"-ending prefix of the source path, not only the first segment.
Fakes only: no recorder, no go2rtc, no Home Assistant."""
from __future__ import annotations

import dataclasses
import threading
import time

import pytest
from test_multi_nvr import base, client, fakes, rows  # noqa: F401 - `base` and `fakes` are fixtures

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.routers import cameras as cameras_router
from smplwise.services import autosync, nvr_write
from smplwise.services import go2rtc as g2
from smplwise.services import playback as pb
from smplwise.services.leases import CameraLease

JONI = Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")


# ---------------------------------------------------------------- V-06

def test_v06_a_disabled_cameras_streams_leave_go2rtc_and_its_lease_ends(base, fakes):  # noqa: F811
    one, _two = fakes
    app = create_app(base)
    c = client(app)
    autosync.run_once(app.state.db, app.state.settings, reason="startup")
    cams = rows(base, "SELECT id, channel FROM cameras WHERE recorder_id = 'nvr-1' ORDER BY channel")
    assert len(cams) >= 2
    off, on = cams[0], cams[1]
    gone = {f"smplwise_nvr-1_ch{off['channel']}_{p}" for p in ("sub", "main")}
    kept = {f"smplwise_nvr-1_ch{on['channel']}_{p}" for p in ("sub", "main")}
    assert gone <= set(one.go2rtc["streams"]) and kept <= set(one.go2rtc["streams"])
    lease = CameraLease(app.state.db, JONI, off["id"], "video.live")
    assert lease.allowed_now() is True
    r = c.patch(f"/api/v1/cameras/{off['id']}", json={"enabled": False})
    assert r.status_code == 200, r.text
    assert lease.allowed_now() is False  # the open relay's next re-check ends it
    assert CameraLease(app.state.db, JONI, on["id"], "video.live").allowed_now() is True
    with Database(base.db_path).connection() as conn:
        res = autosync.ensure_streams(app.state.settings, conn)
    assert res["removed"] >= 2
    assert not gone & set(one.go2rtc["streams"]), "the disabled camera's streams are removed"
    assert kept <= set(one.go2rtc["streams"]), "the other camera's streams stay"
    assert one.go2rtc["foreign"] == ["intercom_door_1", "intercom_door_2"]
    assert all(w.split(" ", 2)[2].startswith("smplwise_") for w in one.writes if w.startswith("go2rtc"))
    # enabled again: the next sync brings them back
    assert c.patch(f"/api/v1/cameras/{off['id']}", json={"enabled": True}).status_code == 200
    with Database(base.db_path).connection() as conn:
        autosync.ensure_streams(app.state.settings, conn)
    assert gone <= set(one.go2rtc["streams"])


# ---------------------------------------------------------------- V-07

def test_v07_capabilities_are_per_recorder_and_a_failed_read_is_not_kept(settings, monkeypatch):
    nvr_write._MOTION_CAPS.clear()
    answers: list[tuple[int, str]] = []
    asked: list[str] = []

    def probe(_client, path):
        asked.append(path)
        return answers.pop(0)

    monkeypatch.setattr(nvr_write, "_probe", probe)
    a = dataclasses.replace(settings, nvr_recorder_id="nvr-1")
    b = dataclasses.replace(settings, nvr_recorder_id="nvr-2")
    answers.append((503, ""))  # a busy recorder: the defaults for this call only
    assert nvr_write.motion_capabilities(a, 3, client=object()) == {"min": 0, "max": 100, "step": 1}
    answers.append((200, '<sensitivityLevel min="0" max="100" step="20">'))
    assert nvr_write.motion_capabilities(a, 3, client=object())["step"] == 20  # asked again
    answers.append((200, '<sensitivityLevel min="0" max="100" step="10">'))
    assert nvr_write.motion_capabilities(b, 3, client=object())["step"] == 10  # channel 3 of another recorder is another camera
    assert nvr_write.motion_capabilities(a, 3, client=object())["step"] == 20  # cached now
    assert len(asked) == 3
    nvr_write._MOTION_CAPS.clear()


# ---------------------------------------------------------------- V-08

def _session(state: str) -> pb.PlaybackSession:
    import datetime as dt

    now = dt.datetime.now(dt.timezone.utc)
    return pb.PlaybackSession(id=f"s-{state}", camera_id="cam1", channel=1, track_id=101, user_id="u1", username="u", requested_at=now, end_at=now,
                              stream="", tz_name="UTC", state=state)


def test_v08_revoked_is_terminal_and_a_late_byte_revives_nothing():
    assert "revoked" in pb.TERMINAL_STATES
    reg = pb.PlaybackRegistry()
    for st in ("revoked", "closed", "buffering"):
        s = _session(st)
        reg.sessions[s.id] = s
    assert [s.state for s in reg.active()] == ["buffering"]  # a revoked session holds no quota slot
    revoked = reg.sessions["s-revoked"]
    assert pb.to_dict(revoked, 60)["media_handle"] is None
    for st in ("closed", "revoked", "expired", "failed"):
        s = _session(st)
        pb.mark_first_media(s)
        assert s.state == st and s.first_frame_at is not None
    s = _session("buffering")
    pb.mark_first_media(s)
    assert s.state == "playing"
    s = _session("seeking")
    pb.mark_first_media(s)
    assert s.state == "playing"


# ---------------------------------------------------------------- V-09

def test_v09_the_cache_file_is_replaced_whole(tmp_path):
    path = tmp_path / "cam1.jpg"
    path.write_bytes(b"old-picture")
    cameras_router._write_atomic(path, b"new-picture")
    assert path.read_bytes() == b"new-picture"
    assert [p.name for p in tmp_path.iterdir()] == ["cam1.jpg"]  # no temporary file left behind


def test_v09_the_route_fetches_once_per_camera_and_serves_the_new_file(settings, monkeypatch):
    """The route itself: a stale copy, one fetch, the answer is the new picture; a refused fetch serves the stale copy as before."""
    from conftest import as_user
    from fastapi.testclient import TestClient

    cameras_router._reset_for_tests()
    s = dataclasses.replace(settings, nvr_host="nvr.example.invalid", nvr_user="viewer", nvr_password="x")
    app = create_app(s)
    c = TestClient(app)
    c.headers.update(as_user("joni"))
    c.get("/api/v1/me")
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
    folder = s.data_dir / "snapshots"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{cam['id']}.jpg"
    path.write_bytes(b"old")
    import os

    os.utime(path, (time.time() - 3600, time.time() - 3600))
    calls: list[int] = []

    def fetch(*_a):
        calls.append(1)
        return b"new"

    monkeypatch.setattr(cameras_router, "_fetch_snapshot", fetch)
    r = c.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg")
    assert r.status_code == 200 and r.content == b"new" and calls == [1]
    assert c.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg").content == b"new" and calls == [1]  # fresh now
    os.utime(path, (time.time() - 3600, time.time() - 3600))

    def refuse(*_a):
        raise ApiError(502, "nvr_unreachable", "x")

    monkeypatch.setattr(cameras_router, "_fetch_snapshot", refuse)
    r = c.get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg")
    assert r.status_code == 200 and r.content == b"new" and r.headers["X-Snapshot-Stale"] == "true"
    # several stale requests at once (a wall of tiles): one asks the recorder, the others wait and serve its picture
    os.utime(path, (time.time() - 3600, time.time() - 3600))
    gate = threading.Event()
    slow_calls: list[int] = []

    def slow(*_a):
        slow_calls.append(1)
        gate.wait(5)
        return b"newest"

    monkeypatch.setattr(cameras_router, "_fetch_snapshot", slow)
    got: list[bytes] = []

    def one():
        got.append(TestClient(app, headers=as_user("joni")).get(f"/api/v1/cameras/{cam['id']}/snapshot.jpg").content)

    threads = [threading.Thread(target=one) for _ in range(4)]
    for t in threads:
        t.start()
    time.sleep(0.5)
    gate.set()
    for t in threads:
        t.join(10)
    assert got == [b"newest"] * 4 and slow_calls == [1]
    cameras_router._reset_for_tests()


# ---------------------------------------------------------------- V-10

def test_v10_a_foreign_stream_whose_name_holds_a_slash_is_caught():
    names = ["door/front", "site/a/cam", "smplwise_cam_a_sub"]
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/door/front", names, "smplwise_cam_")
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/DOOR%2Ffront", names, "smplwise_cam_")  # decoded
    assert g2.names_foreign_stream("rtsp://go2rtc:8554/site/a/cam/extra", names, "smplwise_cam_")  # a longer path names it too
    assert not g2.names_foreign_stream("rtsp://cam.example.invalid/door", names, "smplwise_cam_")  # only a prefix of the path counts
    assert not g2.names_foreign_stream("rtsp://cam.example.invalid/x/door/front", names, "smplwise_cam_")
    assert not g2.names_foreign_stream("rtsp://go2rtc:8554/smplwise_cam_a_sub", names, "smplwise_cam_")


@pytest.fixture(autouse=True)
def _clean():
    pb.REGISTRY.sessions.clear()
    yield
    pb.REGISTRY.sessions.clear()
