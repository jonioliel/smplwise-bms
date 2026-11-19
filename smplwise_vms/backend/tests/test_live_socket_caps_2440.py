"""CR-LIVE-SOCKET-CAPS-2440 (review 03:F07, 03:F19, 03:F23): the installation live cap is re-checked at registration, the five
"tell the socket why, then close" steps share one helper and keep their frames and codes, and `GET /media/streams` returns only the
go2rtc version."""
from __future__ import annotations

import asyncio
import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from smplwise.main import create_app


class _CapGo2rtc:
    """go2rtc for the cap tests: `on_ensure` runs while a live socket creates its stream (the awaited seconds of the race)."""

    store: dict[str, list[str]] = {}
    on_ensure = staticmethod(lambda: None)

    def __init__(self, *a, **k):
        pass

    def list_streams(self):
        from smplwise.services import go2rtc as g2

        return {n: g2.StreamInfo(name=n, sources=list(s), online=False) for n, s in self.store.items()}

    def ensure_stream(self, name, src, check=None):
        type(self).on_ensure()
        self.store[name] = [src]
        return "created"

    def info(self):
        return {"version": "1.9.15", "host": "go2rtc.test:1984", "config_path": "/config/go2rtc.yaml", "pid": 77}

    def ws_url(self, name):
        return f"ws://go2rtc.test/api/ws?src={name}"

    def ws_headers(self):
        return {}


@pytest.fixture
def capped(settings, monkeypatch):
    from smplwise.routers import media
    from smplwise.services import live_codec as lc

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    app = create_app(s)
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 5, "alias": "ch5"}).json()
    _CapGo2rtc.store = {}
    _CapGo2rtc.on_ensure = staticmethod(lambda: None)
    monkeypatch.setattr(media.g2, "Go2rtc", _CapGo2rtc)
    opened: list[str] = []

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        opened.append(upstream_url.rsplit("src=", 1)[1])
        return "client_closed"

    monkeypatch.setattr(media, "relay_ws", relay)
    media.REGISTRY.sessions.clear()
    lc.BUDGET.held.clear()
    yield c, cam, opened, media
    media.REGISTRY.sessions.clear()
    lc.BUDGET.held.clear()


def _open_live(c, cam):
    """(frames, close code) of one live socket; code None when the relay ended it normally."""
    frames = []
    try:
        with c.websocket_connect(f"/api/v1/media/live/{cam['id']}/ws") as ws:
            while True:
                frames.append(json.loads(ws.receive_text()))
    except WebSocketDisconnect as exc:
        return frames, exc.code
    return frames, None


def _fill(media, n):
    for i in range(n):
        media.REGISTRY.sessions[f"race{i}"] = media.LiveSession(id=f"race{i}", camera_id="other", stream="s", user_id="u", username="x", remote_chain=None)


def _cap(c) -> int:
    return int(c.get("/api/v1/settings").json()["settings"]["media.max_live_sessions"])


# ---------------------------------------------------------------- 03:F07

def test_a_single_live_open_is_unchanged(capped):
    c, cam, opened, media = capped
    _frames, code = _open_live(c, cam)
    assert len(opened) == 1 and code in (None, 1000), "one viewer under the cap reaches the relay"
    assert media.REGISTRY.count() == 0, "and its session left the registry when it ended"


def test_the_installation_cap_is_rechecked_at_registration(capped):
    """The cap was checked once, before the stream creation (seconds). Sessions that registered meanwhile were not seen, so a wall
    opening its tiles together overshot `media.max_live_sessions`."""
    c, cam, opened, media = capped
    cap = _cap(c)
    _CapGo2rtc.on_ensure = staticmethod(lambda: _fill(media, cap))  # the others register while this socket creates its stream
    _frames, code = _open_live(c, cam)
    assert code == 4429, "the racing surplus is refused with the code the player already handles"
    assert opened == [], "no upstream connection for the refused socket"
    assert media.REGISTRY.count() == cap and not any(s.camera_id == cam["id"] for s in media.REGISTRY.sessions.values())


def test_the_route_check_still_refuses_before_any_stream_work(capped):
    c, cam, opened, media = capped
    _fill(media, _cap(c))
    called = []
    _CapGo2rtc.on_ensure = staticmethod(lambda: called.append(1))
    _frames, code = _open_live(c, cam)
    assert code == 4429 and called == [] and opened == []


def test_one_below_the_cap_still_opens(capped):
    c, cam, opened, media = capped
    cap = _cap(c)
    _CapGo2rtc.on_ensure = staticmethod(lambda: _fill(media, cap - 1))
    _frames, code = _open_live(c, cam)
    assert len(opened) == 1 and code in (None, 1000)


# ---------------------------------------------------------------- 03:F23

def test_media_streams_returns_only_the_go2rtc_version(capped):
    """Lead decision L9: go2rtc's `/api` answer carries its host and its configuration path; only the version leaves."""
    c, _cam, _opened, _media = capped
    body = c.get("/api/v1/media/streams").json()
    assert body["go2rtc"] == {"version": "1.9.15"}
    assert "go2rtc.test" not in json.dumps(body) and "config_path" not in json.dumps(body)
    assert set(body) == {"go2rtc", "streams", "foreign_streams"}


# ---------------------------------------------------------------- 03:F19

class _Sock:
    """The part of a WebSocket `close_with_error` touches."""

    def __init__(self, state="CONNECTING", fail=()):
        self.client_state = type("S", (), {"name": state})()
        self.calls: list[tuple] = []
        self.fail = set(fail)

    async def accept(self):
        self.calls.append(("accept",))
        if "accept" in self.fail:
            raise RuntimeError("gone")
        self.client_state.name = "CONNECTED"

    async def send_text(self, text):
        self.calls.append(("send", text))
        if "send" in self.fail:
            raise RuntimeError("gone")

    async def close(self, code=1000):
        self.calls.append(("close", code))
        if "close" in self.fail:
            raise RuntimeError("gone")


def test_close_with_error_accepts_sends_one_frame_and_closes():
    from smplwise.services.relay import close_with_error

    s = _Sock()
    asyncio.run(close_with_error(s, {"type": "error", "value": "x", "message": "שירות"}, 4503))
    assert s.calls == [("accept",), ("send", '{"type": "error", "value": "x", "message": "שירות"}'), ("close", 4503)], "Hebrew stays readable in the frame"
    s = _Sock("CONNECTED")
    asyncio.run(close_with_error(s, '{"type":"replaced","value":"superseded"}', 4410))
    assert s.calls == [("send", '{"type":"replaced","value":"superseded"}'), ("close", 4410)], "an accepted socket is not accepted again; a string goes out as it is"


def test_close_with_error_never_raises_and_knows_its_two_close_shapes():
    from smplwise.services.relay import close_with_error

    s = _Sock(fail={"send"})
    asyncio.run(close_with_error(s, {"a": 1}, 4429))
    assert s.calls == [("accept",), ("send", '{"a": 1}')], "one guarded step: a failed frame ends it, no close"
    s = _Sock(fail={"send"})
    asyncio.run(close_with_error(s, "x", 4410, close_apart=True))
    assert s.calls[-1] == ("close", 4410), "the playback replaced-close is tried even when the frame failed"
    s = _Sock(fail={"close"})
    asyncio.run(close_with_error(s, "x", 4410, close_apart=True))  # a failing close is swallowed too
    s = _Sock()
    asyncio.run(close_with_error(s, {"a": 1}, None))
    assert s.calls == [("accept",), ("send", '{"a": 1}')], "code None: the caller ends the socket its own way"


def test_the_five_refusals_keep_their_frames_and_codes(capped, monkeypatch):
    """The five callers share the helper and keep their own payloads and close codes."""
    from starlette.exceptions import WebSocketException

    from smplwise.errors import ApiError
    from smplwise.routers import media, playback
    from smplwise.services import media_reach

    c, _cam, _opened, _media = capped
    settings = c.app.state.settings

    s = _Sock()
    asyncio.run(media._refuse_choice(s, "h265_unsupported", "טקסט", 4415, profile="main"))
    assert [k[0] for k in s.calls] == ["accept", "send", "close"] and s.calls[-1] == ("close", 4415)
    assert json.loads(s.calls[1][1]) == {"type": "error", "value": "h265_unsupported", "message": "טקסט", "profile": "main"}

    s = _Sock()
    asyncio.run(media.refuse_media(s, settings, "media_not_configured"))
    frame = json.loads(s.calls[1][1])
    assert s.calls[-1] == ("close", 4503) and frame["type"] == "error" and frame["value"] == "media_not_configured"
    assert frame["message"] == media.VIDEO_SERVICE_DOWN_HE and set(frame) == {"type", "value", "message", "media"}

    monkeypatch.setattr(media_reach.REACH, "view", lambda _s: {"state": "reachable"})
    s = _Sock()
    asyncio.run(media.refuse_media(s, settings, "source_unavailable"))
    assert s.calls == [("close", 4503)], "a stream-level refusal stays the bare 4503: not accepted, no frame"

    s = _Sock()
    with pytest.raises(WebSocketException) as exc:
        asyncio.run(media._refuse_socket(s, ApiError(403, "presence_required", "נדרשת נוכחות")))
    assert exc.value.code == 4403 and [k[0] for k in s.calls] == ["accept", "send"], "told why, then refused by the exception (no close call)"
    assert json.loads(s.calls[1][1]) == {"type": "error", "value": "presence_required", "message": "נדרשת נוכחות"}

    s = _Sock()
    refusal = ApiError(429, "remote_live_cap", "עד 4 במקביל", details={"max": 4})
    asyncio.run(media._refuse_remote_cap(s, c.app.state.db, None, "cam", refusal, None))
    assert s.calls[-1] == ("close", 4429)
    assert json.loads(s.calls[1][1]) == {"type": "error", "value": "remote_live_cap", "message": "עד 4 במקביל", "max": 4}

    s = _Sock("CONNECTED")
    asyncio.run(playback.close_replaced(s))
    assert s.calls == [("send", playback.REPLACED_FRAME), ("close", 4410)]
