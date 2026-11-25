"""VIDEO-SECFIX-2520 (deep review 2.52 VIDEO, findings V-01 and V-04).

V-01: go2rtc's error frames reached the recorder-camera / manual-camera live socket and the playback socket verbatim - a failed dial
names the device's address, an `ffmpeg:` source's stderr can name the whole credentialed RTSP URL. Every relay route now sends the
shared fixed code (services/relay.sanitize_upstream_frame) and the server logs only the classified, sanitized form.

V-04: generic NVR change rows carried no camera, so the undo (`POST /nvr/changes/{id}/rollback`) and the detail
(`GET /nvr/changes/{id}`) skipped the camera scope (T055) the write itself enforced. Rows now keep their camera; old rows derive it
from their target; a camera-level row whose camera cannot be determined needs the unrestricted permission (fail closed).

Addresses below are documentation addresses (RFC 5737); the credentials are fixture strings.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_live_socket_caps_2440 import _CapGo2rtc
from test_nvr_schedule import TRACK, FakeNvr
from test_recordings import FakeGo2rtc, set_track, xml_page

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.main import create_app
from smplwise.services import nvr, nvr_write
from smplwise.services import relay as relay_mod

LEAKY = json.dumps({"type": "error", "value": "streams: exec/rtsp: open rtsp://fixture-user:fixture-pass@192.0.2.44:554/Streaming/Channels/101 failed: "
                                              "dial tcp 192.0.2.44:554: connect: connection refused"})
LEAKS = ("fixture-user", "fixture-pass", "192.0.2.44", "rtsp://", "Streaming/Channels")
FIXED = {"type": "error", "value": "upstream_error"}


def _no_leak(text: str, where: str) -> None:
    for leak in LEAKS:
        assert leak not in text, f"{leak!r} leaked {where}"


def _scripted(frames: list[str], seen: dict[str, Any] | None = None):
    """Stands in for services/relay.relay_ws: hands go2rtc's frames to the route's on_text exactly as the real relay does."""

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None, stop_event=None, close_timeout=None):
        if seen is not None:
            seen["on_text"] = on_text
        for f in frames:
            out = (on_text or relay_mod.sanitize_upstream_frame)(f)
            if out is not None:
                await websocket.send_text(out)
        return "client_closed"

    return relay


# ---------------------------------------------------------------- V-01: the one sanitizer

def test_the_shared_sanitizer_replaces_error_frames_and_drops_unvetted_text():
    s = relay_mod.sanitize_upstream_frame
    assert json.loads(s(LEAKY)) == FIXED
    _no_leak(s(LEAKY), "through the sanitizer")
    ok = '{"type":"webrtc/answer","value":"v=0"}'
    assert s(ok) == ok and s('{"type":"mse","value":"video/mp4"}') == '{"type":"mse","value":"video/mp4"}', "signalling passes unchanged"
    assert s("dial tcp 192.0.2.44:554 refused") is None and s('"rtsp://u:p@192.0.2.44"') is None and s("[1, 2]") is None, "not a JSON object: dropped"
    hits: list[int] = []
    assert json.loads(s(LEAKY, error_value="upstream_unavailable", on_error=lambda: hits.append(1))) == {"type": "error", "value": "upstream_unavailable"}
    assert hits == [1]
    assert json.loads(s(LEAKY, on_error=lambda: 1 / 0)) == FIXED, "a failing side effect never breaks the relay"


def test_the_real_relay_sanitizes_by_default(monkeypatch):
    """relay_ws with no on_text (a future route that forgets to pass one) still never forwards go2rtc's error text."""

    class Upstream:
        def __init__(self, frames):
            self.frames = list(frames)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self.frames:
                raise StopAsyncIteration
            return self.frames.pop(0)

        async def send(self, _msg):
            pass

    class Browser:
        def __init__(self):
            self.sent: list[str] = []

        async def send_text(self, t):
            self.sent.append(t)

        async def send_bytes(self, b):
            pass

        async def receive(self):
            await asyncio.sleep(3600)

    import websockets

    monkeypatch.setattr(websockets, "connect", lambda *a, **k: Upstream(['{"type":"mse","value":"video/mp4"}', LEAKY, "plain text 192.0.2.44"]))
    browser = Browser()
    reason = asyncio.run(relay_mod.relay_ws(browser, "ws://go2rtc.test/api/ws?src=smplwise_x", {}, lambda n: None))
    assert reason == "upstream_closed"
    assert [json.loads(t) for t in browser.sent] == [{"type": "mse", "value": "video/mp4"}, FIXED]
    _no_leak("".join(browser.sent), "through the default relay")


@pytest.fixture
def live(settings, monkeypatch):
    from smplwise.routers import media
    from smplwise.services import live_codec as lc

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    c = TestClient(create_app(s))
    cam = c.post("/api/v1/cameras", json={"channel": 5, "alias": "ch5"}).json()
    _CapGo2rtc.store = {}
    _CapGo2rtc.on_ensure = staticmethod(lambda: None)
    monkeypatch.setattr(media.g2, "Go2rtc", _CapGo2rtc)
    media.REGISTRY.sessions.clear()
    lc.BUDGET.held.clear()
    yield c, s, cam, media
    media.REGISTRY.sessions.clear()
    lc.BUDGET.held.clear()


def _audit_rows(s, action: str) -> list[Any]:
    with Database(s.db_path).connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()


def test_recorder_camera_live_never_forwards_or_logs_the_error_text(live, monkeypatch, caplog):
    c, s, cam, media = live
    seen: dict[str, Any] = {}
    monkeypatch.setattr(media, "relay_ws", _scripted(['{"type":"mse","value":"video/mp4"}', LEAKY], seen))
    caplog.set_level(logging.DEBUG)
    frames = []
    with contextlib.suppress(WebSocketDisconnect):
        with c.websocket_connect(f"/api/v1/media/live/{cam['id']}/ws") as ws:
            frames.append(ws.receive_text())
            frames.append(ws.receive_text())
    assert seen["on_text"] is not None, "the route always hands the relay a sanitizer"
    assert json.loads(frames[0])["type"] == "mse" and json.loads(frames[1]) == FIXED
    _no_leak("".join(frames), "to the viewer")
    _no_leak(caplog.text, "into the log")
    stop = json.loads(_audit_rows(s, "video.live.stop")[-1]["details_json"])
    assert stop["upstream_error"] == "refused", "the classified reason stays for the operator"
    _no_leak(json.dumps(stop), "into the audit row")
    assert "go2rtc error refused" in caplog.text, "the server still logs that it failed and why"


def test_playback_never_forwards_or_logs_the_error_text(settings, monkeypatch, caplog):
    from smplwise.routers import playback as pbr
    from smplwise.services import playback as pb
    from smplwise.services import recordings

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    c = TestClient(create_app(s))
    recordings.invalidate()
    pb.REGISTRY.sessions.clear()
    pb.set_instance_id("v2520")
    FakeGo2rtc.store, FakeGo2rtc.deleted = {}, []
    monkeypatch.setattr(pb.g2, "Go2rtc", FakeGo2rtc)
    monkeypatch.setattr(pbr.g2, "Go2rtc", FakeGo2rtc)
    monkeypatch.setattr(nvr, "search_recordings", lambda _s, track_id, *a, **k: nvr.parse_search_response(
        xml_page([("2026-09-14T09:00:00Z", "2026-09-14T12:00:00Z", "CMR")], "OK"), track_id))
    seen: dict[str, Any] = {}
    monkeypatch.setattr(pbr, "relay_ws", _scripted(['{"type":"mse","value":"video/mp4"}', LEAKY], seen))
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    caplog.set_level(logging.DEBUG)
    try:
        sess = c.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T07:00:00Z"}).json()
        assert "id" in sess, sess
        frames = []
        with contextlib.suppress(WebSocketDisconnect):
            with c.websocket_connect(f"/api/v1/playback/sessions/{sess['id']}/ws?generation=0") as ws:
                frames.append(ws.receive_text())
                frames.append(ws.receive_text())
    finally:
        pb.REGISTRY.sessions.clear()
    assert seen["on_text"] is not None
    assert json.loads(frames[0])["type"] == "mse" and json.loads(frames[1]) == FIXED
    _no_leak("".join(frames), "to the playback viewer")
    _no_leak(caplog.text, "into the log")
    assert "go2rtc error refused" in caplog.text


# ---------------------------------------------------------------- V-04: the change log keeps the camera scope

ROLE = {"name": "לוח הקלטה", "description": "", "permissions": ["map.read"], "sensitive": ["nvr.config.schedule"]}


@pytest.fixture
def scoped(settings, monkeypatch):
    """Two cameras on the fake NVR; `tom` holds nvr.config.schedule installation-wide with an explicit deny on camera X, `ann`
    holds the same role with no deny. The administrator (the dev default) writes one recording-schedule change per camera."""
    fake = FakeNvr()
    fake.docs["/ISAPI/ContentMgmt/record/tracks/201"] = TRACK.replace("<id>101</id><Channel>101</Channel>", "<id>201</id><Channel>201</Channel>")
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    monkeypatch.setattr(nvr, "_client", fake.client)
    app = create_app(settings)
    c = TestClient(app)
    x = c.post("/api/v1/cameras", json={"channel": 1, "alias": "X"}).json()["id"]
    y = c.post("/api/v1/cameras", json={"channel": 2, "alias": "Y"}).json()["id"]
    role = c.post("/api/v1/access/roles", json=ROLE).json()["id"]
    bind(c, settings, "tom", role, "installation", "*")
    bind(c, settings, "ann", role, "installation", "*")
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'dev-tom', ?, 'camera', ?, 'deny', ?, 'test', ?)", (new_id(), role, x, permission_revision(conn), now_iso()))
    days = [[{"begin": "00:00:00", "end": "24:00:00", "mode": "CMR"}] for _ in range(7)]
    changes = {}
    for cid in (x, y):
        r = c.put(f"/api/v1/cameras/{cid}/record-schedule", json={"days": days})
        assert r.status_code == 200 and r.json()["status"] == "applied", r.text
        changes[cid] = r.json()
    yield c, settings, x, y, changes, fake


def _denied(s, action: str, resource_id: str) -> list[Any]:
    return [r for r in _audit_rows(s, action) if r["decision"] == "denied" and r["resource_id"] == resource_id]


def test_a_change_row_keeps_its_camera(scoped):
    c, s, x, y, changes, _fake = scoped
    assert changes[x]["camera_id"] == x and changes[y]["camera_id"] == y
    assert [ch["id"] for ch in c.get(f"/api/v1/nvr/changes?camera_id={x}").json()["changes"]] == [changes[x]["id"]], "the camera filter now matches"


def test_a_denied_camera_change_can_be_neither_seen_nor_undone(scoped):
    c, s, x, y, changes, fake = scoped
    tom = as_user("tom")
    assert c.put(f"/api/v1/cameras/{x}/record-schedule", json={"enabled": False}, headers=tom).status_code == 403, "the direct write is refused (T055)"
    doc_x = fake.docs["/ISAPI/ContentMgmt/record/tracks/101"]
    assert c.get(f"/api/v1/nvr/changes/{changes[x]['id']}", headers=tom).status_code == 403
    assert c.post(f"/api/v1/nvr/changes/{changes[x]['id']}/rollback", headers=tom).status_code == 403
    assert fake.docs["/ISAPI/ContentMgmt/record/tracks/101"] == doc_x, "nothing was written to the recorder"
    assert _denied(s, "nvr.config.schedule", x), "the refusal is audited and names the camera"
    listed = [ch["id"] for ch in c.get("/api/v1/nvr/changes", headers=tom).json()["changes"]]
    assert changes[x]["id"] not in listed and changes[y]["id"] in listed
    # the allowed camera is unchanged for the same user
    assert c.get(f"/api/v1/nvr/changes/{changes[y]['id']}", headers=tom).json()["before_xml"]
    assert c.post(f"/api/v1/nvr/changes/{changes[y]['id']}/rollback", headers=tom).status_code == 201


def test_allowed_users_are_unchanged(scoped):
    c, s, x, y, changes, _fake = scoped
    ann = as_user("ann")
    listed = {ch["id"] for ch in c.get("/api/v1/nvr/changes", headers=ann).json()["changes"]}
    assert {changes[x]["id"], changes[y]["id"]} <= listed
    assert c.get(f"/api/v1/nvr/changes/{changes[x]['id']}", headers=ann).status_code == 200
    r = c.post(f"/api/v1/nvr/changes/{changes[x]['id']}/rollback", headers=ann)
    assert r.status_code == 201 and r.json()["camera_id"] == x, "the undo row keeps the camera too"
    assert c.get(f"/api/v1/nvr/changes/{changes[y]['id']}").status_code == 200, "the administrator"


def test_an_old_row_without_a_camera_derives_it_from_its_target(scoped):
    c, s, x, y, changes, _fake = scoped
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE nvr_changes SET camera_id = NULL")  # a row written before 2.52
    tom = as_user("tom")
    assert c.get(f"/api/v1/nvr/changes/{changes[x]['id']}", headers=tom).status_code == 403
    assert c.post(f"/api/v1/nvr/changes/{changes[x]['id']}/rollback", headers=tom).status_code == 403
    assert c.get(f"/api/v1/nvr/changes/{changes[y]['id']}", headers=tom).status_code == 200
    listed = [ch["id"] for ch in c.get("/api/v1/nvr/changes", headers=tom).json()["changes"]]
    assert changes[x]["id"] not in listed and changes[y]["id"] in listed


def test_a_camera_that_cannot_be_determined_fails_closed(scoped):
    c, s, x, y, changes, _fake = scoped
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE nvr_changes SET camera_id = NULL, target = 'track-999' WHERE id = ?", (changes[y]["id"],))  # no camera holds track 999
    tom, ann = as_user("tom"), as_user("ann")
    assert c.get(f"/api/v1/nvr/changes/{changes[y]['id']}", headers=tom).status_code == 403, "a scoped user: refused"
    assert c.post(f"/api/v1/nvr/changes/{changes[y]['id']}/rollback", headers=tom).status_code == 403
    assert [r for r in _audit_rows(s, "nvr.config.schedule") if r["decision"] == "denied" and r["reason"] == "camera_unknown"]
    assert changes[y]["id"] not in [ch["id"] for ch in c.get("/api/v1/nvr/changes", headers=tom).json()["changes"]]
    assert c.get(f"/api/v1/nvr/changes/{changes[y]['id']}", headers=ann).status_code == 200, "the unrestricted holder still sees it"
    assert changes[y]["id"] in [ch["id"] for ch in c.get("/api/v1/nvr/changes", headers=ann).json()["changes"]]


def test_recorder_level_changes_have_no_camera_scope(scoped):
    c, s, x, y, changes, _fake = scoped
    with Database(s.db_path).connection() as conn:
        r = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (changes[x]["id"],)).fetchone()
        assert nvr_write.change_cameras(conn, r) == (True, frozenset({x}))
        conn.execute("UPDATE nvr_changes SET kind = 'time', target = 'ntp', camera_id = NULL WHERE id = ?", (changes[x]["id"],))
        r = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (changes[x]["id"],)).fetchone()
        assert nvr_write.change_cameras(conn, r) == (False, frozenset())
