"""WKAUDIN-295: listening to a station (its audio TO Arx) - services/wiskey_listen_adapter.py, services/intercom_listen.py,
routers/intercom_listen.py.

FAKES ONLY: the downlink is the FakeProvider's synthetic channel (it plays scripted packets like WisKey's `AudioSession.receive()` hands them
over), the WisKey feed is test_intercom's scripted socket. Nothing here contacts a station, WisKey, a microphone, a speaker or a real go2rtc.
The real downlink is PENDING WisKey's contract: its channel answers `downlink_pending` (tested here)."""
from __future__ import annotations

import asyncio
import json
import re
import time
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_intercom import CAM_OVERVIEW, GO2RTC, camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures
from test_intercom_media import audit_rows, fake_provider  # noqa: F401 - fixtures / helpers

from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from smplwise.main import create_app
from smplwise.routers import settings as settings_router
from smplwise.services import intercom_listen as il
from smplwise.services import intercom_media as im
from smplwise.services import leases
from smplwise.services import wiskey_listen_adapter as ad

CAP = "/api/v1/access-control/stations/{}/listen"
STOP = "/api/v1/access-control/listen/{}/stop"
FRAME = bytes([0x7F, 0xFF, 0x00]) * 53 + b"\x55"  # 160 bytes: 20 ms of mu-law
assert len(FRAME) == ad.FRAME_BYTES
SECRETS = ("rtsp", "192.0.2", "198.51.100", "p@ss", "door:", "Channels/10", "Basic ", "fake-")


def listen_mode(c: TestClient, value: str) -> None:
    r = c.patch("/api/v1/settings", json={"access.station_listen": value})
    assert r.status_code == 200, r.text


def start(c: TestClient, sid: str = "entry-a", headers: dict[str, str] | None = None, **body: Any):
    return c.post(CAP.format(sid), json=body or None, headers=headers or {})


@pytest.fixture(autouse=True)
def _reset():
    il.LISTEN.reset()
    yield
    il.LISTEN.reset()


# ---------------------------------------------------------------- the setting

def test_the_setting_is_off_by_default_validated_audited_and_admin_only(settings):
    assert settings_router.DEFAULTS["access.station_listen"] == "off"
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["access.station_listen"] == "off"
        for bad in ("true", "", "ON", "video", "listen"):
            assert c.patch("/api/v1/settings", json={"access.station_listen": bad}).status_code == 422
        for good in ("on", "probe", "off"):
            assert c.patch("/api/v1/settings", json={"access.station_listen": good}).json()["settings"]["access.station_listen"] == good
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={"access.station_listen": "on"}, headers=as_user("ron")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["access.station_listen"] == "off"
        rows = [json.loads(r["details_json"] or "{}") for r in audit_rows(settings, "settings.update") if r["decision"] == "allowed"]
        assert {"access.station_listen": "probe"} in rows


# ---------------------------------------------------------------- what the drawer may offer

def test_off_by_default_nothing_is_offered_and_nothing_is_asked_of_the_provider(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    body = c.get(CAP.format("entry-a")).json()
    assert body["available"] is False and body["reason"] == "off" and body["max_seconds"] is None
    assert fake_provider.described == 0
    r = start(c)
    assert (r.status_code, r.json()["code"]) == (409, "intercom_listen_off")
    assert [x["reason"] for x in audit_rows(s, "intercom.listen.start")] == ["intercom_listen_off"]
    assert not fake_provider.listen_log


def test_availability_follows_the_mode_the_descriptor_and_the_provider(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    body = c.get(CAP.format("entry-a")).json()
    assert body["available"] is True and body["reason"] is None and body["codec"] == "pcmu" and body["sample_rate"] == 8000 and body["frame_ms"] == 20
    assert body["max_seconds"] == 120 and body["listeners"] == 0
    text = json.dumps(body)
    assert not any(x in text for x in SECRETS), "no source, no address, no descriptor handle"
    # a descriptor that does not say `audio.listen`: `on` refuses, `probe` (a shared session with the owner) tries
    base = fake_provider.raw("entry-a", time.time())
    fake_provider.raw_override = {**base, "audio": {**base["audio"], "listen": False}}
    im.MEDIA.reset()
    assert c.get(CAP.format("entry-a")).json()["reason"] == "no_listen"
    assert start(c).json()["code"] == "intercom_listen_no_listen"
    listen_mode(c, "probe")
    assert c.get(CAP.format("entry-a")).json()["available"] is True
    assert start(c).status_code == 200
    # Arx's own local source has no downlink at all
    il.LISTEN.reset()
    im.set_provider(None)
    im.MEDIA.reset()
    assert c.get(CAP.format("entry-a")).json()["available"] is False


def test_who_sees_what_and_listening_needs_the_call_permission_like_talk(feed, fake_go2rtc, fake_provider, station_scope):  # noqa: F811
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    bind(c, s, "vera", "viewer", "installation", "*")  # access.read, no access.call
    seen = c.get(CAP.format("entry-a"), headers=as_user("vera")).json()
    assert seen["available"] is False and seen["reason"] == "forbidden"
    assert start(c, headers=as_user("vera")).status_code == 403
    station_scope.bind("dev-sam", "viewer", "entry-b")  # sees entry-b only
    assert c.get(CAP.format("entry-a"), headers=as_user("sam")).status_code == 404
    assert c.get(CAP.format("nope")).status_code == 404
    assert c.get(CAP.format("entry-a"), headers=as_user("nobody")).status_code == 403
    assert start(c, "nope").status_code == 404


# ---------------------------------------------------------------- a session end to end

def test_a_listen_session_end_to_end_audited_without_audio(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_packets = [FRAME, FRAME * 2, b"", FRAME]  # 4 frames; one empty read (a timeout) is silence, not audio
    fake_provider.listen_end = None  # the downlink stays open until the operator stops
    r = start(c, client_request_id="lst-0001-abcd")
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["codec"] == "pcmu" and t["sample_rate"] == 8000 and t["frame_ms"] == 20 and t["max_seconds"] == 120
    assert t["ws_path"] == f"api/v1/access-control/listen/{t['session']}/ws"
    assert c.get(CAP.format("entry-a")).json()["listeners"] == 1
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        opened = json.loads(ws.receive_text())
        assert opened["type"] == "listen/state" and opened["value"] == "open" and opened["codec"] == "pcmu"
        got = [ws.receive_bytes() for _ in range(4)]
        assert got == [FRAME] * 4 and all(len(g) == 160 for g in got)
        ws.send_bytes(b"\x01" * 160)  # nothing flows up to the station: ignored
        ws.send_text("x" * 1000)  # oversize text: ignored
        ws.send_text(json.dumps({"type": "listen/stop"}))
        assert json.loads(ws.receive_text()) == {"type": "listen/closed", "value": "stopped"}
    assert len(fake_provider.listen_log) == 1 and fake_provider.listen_log[0] == ("entry-a", "dev-joni", "lst-0001-abcd")
    assert fake_provider.talk_log.frames == 0, "listening never sends a frame to the station"
    [begin] = audit_rows(s, "intercom.listen.start")
    [end] = audit_rows(s, "intercom.listen.end")
    assert begin["resource_type"] == end["resource_type"] == "intercom_station" and begin["resource_id"] == end["resource_id"] == "entry-a"
    assert begin["actor_user_id"] == end["actor_user_id"] == "dev-joni" and begin["request_id"] == end["request_id"] == "lst-0001-abcd"
    details = json.loads(end["details_json"])
    assert details["outcome"] == "stopped" and details["frames"] == 4 and details["dropped"] == 0 and details["duration_s"] >= 0 and details["mode"] == "on"
    assert set(details) == {"session", "outcome", "duration_s", "frames", "dropped", "mode"}, "counts only - never audio content"
    assert set(json.loads(begin["details_json"])) == {"session", "mode", "codec", "max_seconds"}
    assert details["session"] != t["session"] and t["session"] not in json.dumps(begin) + json.dumps(end), "the handle itself is never kept"
    assert c.get(CAP.format("entry-a")).json()["listeners"] == 0


def test_the_upstream_ending_ends_the_session_after_its_frames(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_packets = [FRAME, FRAME]
    t = start(c).json()  # default: the synthetic downlink ends with upstream_closed once it has played
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        assert ws.receive_bytes() == FRAME and ws.receive_bytes() == FRAME, "the frames it still held were delivered before the end"
        assert json.loads(ws.receive_text()) == {"type": "listen/closed", "value": "upstream_closed"}
    assert json.loads(audit_rows(s, "intercom.listen.end")[-1]["details_json"])["frames"] == 2


def test_odd_packets_are_split_or_dropped_never_guessed(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    # 3 whole frames + a 40-byte tail (tail dropped), then an oversize packet (dropped), then a short one (dropped), then one frame
    fake_provider.listen_packets = [FRAME * 3 + b"\x00" * 40, b"\x00" * (ad.MAX_PACKET_BYTES + 1), b"\x00" * 100, FRAME]
    t = start(c).json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        ws.receive_text()
        assert [ws.receive_bytes() for _ in range(4)] == [FRAME] * 4
        assert json.loads(ws.receive_text())["value"] == "upstream_closed"
    assert json.loads(audit_rows(s, "intercom.listen.end")[-1]["details_json"])["frames"] == 4


def test_one_session_per_user_and_a_station_limit_and_only_the_owner_stops_it(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_end = None
    bind(c, s, "sara", "site_admin", "installation", "*")
    first = start(c)
    assert first.status_code == 200
    again = start(c, "entry-d")
    assert again.status_code == 409 and again.json()["code"] == "intercom_listen_user_busy"
    assert start(c, headers=as_user("sara")).status_code == 200, "another user may listen to the same station"
    assert c.post(STOP.format(first.json()["session"]), headers=as_user("sara")).status_code == 404, "only its owner stops it"
    assert c.post(STOP.format(first.json()["session"])).json() == {"stopped": True}
    assert json.loads(audit_rows(s, "intercom.listen.end")[-1]["details_json"])["outcome"] == "stopped"
    # the station's listener limit
    for i in range(il.MAX_PER_STATION):
        il.LISTEN.reserve(il.new_listen("entry-a", f"u{i}", f"u{i}", None, "on", limit_s=60))
    busy = start(c)
    assert busy.status_code == 409 and busy.json()["code"] in ("intercom_listen_busy", "intercom_listen_user_busy")
    assert [r["reason"] for r in audit_rows(s, "intercom.listen.start") if r["decision"] == "denied"][-1] in ("intercom_listen_busy", "intercom_listen_user_busy")


def test_listen_refusals_each_leave_one_row(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    assert (start(c, "entry-b").status_code, start(c, "entry-b").json()["code"]) == (409, "intercom_station_offline")
    assert c.post(CAP.format("entry-a"), content=b"{not json", headers={"content-type": "application/json"}).status_code == 422
    assert start(c, client_request_id="x").status_code == 422
    assert start(c, unexpected=True).status_code == 422
    fake_provider.unavailable["entry-a"] = "no_camera"
    im.MEDIA.reset()
    r = start(c)
    assert r.json()["code"] == "intercom_listen_unavailable" and r.json()["details"]["reason"] == "no_camera"
    assert not audit_rows(s, "intercom.listen.end")


def test_a_listen_session_expires(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_end = None
    t = start(c).json()
    il.LISTEN.get(t["session"]).expires_at = time.time() + 1.2
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect(f"/{t['ws_path']}") as ws:
            assert json.loads(ws.receive_text())["value"] == "open"
            assert json.loads(ws.receive_text()) == {"type": "listen/closed", "value": "expired"}
            ws.receive_text()
    assert e.value.code == 4408
    assert json.loads(audit_rows(s, "intercom.listen.end")[-1]["details_json"])["outcome"] == "expired"


def _closed_with(c: TestClient, path: str, headers: dict[str, str] | None = None) -> int:
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect(path, headers=headers or {}) as ws:
            ws.receive_text()
    return e.value.code


def test_a_reservation_never_attached_is_released_and_audited(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    first = start(c).json()
    monkeypatch.setattr(il, "RESERVE_S", 0.0)
    time.sleep(0.01)
    assert start(c).status_code == 200, "the stale reservation was released"
    end = audit_rows(s, "intercom.listen.end")[-1]
    assert json.loads(end["details_json"])["outcome"] == "never_connected" and end["actor_user_id"] == "dev-joni"
    assert _closed_with(c, f"/{first['ws_path']}") == 4404


def test_the_socket_belongs_to_the_session_owner_once(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_end = None
    bind(c, s, "sara", "site_admin", "installation", "*")
    t = start(c).json()
    assert _closed_with(c, f"/{t['ws_path']}", as_user("sara")) == 4404
    assert _closed_with(c, "/api/v1/access-control/listen/not-a-session-at-all/ws") == 4404
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        assert _closed_with(c, f"/{t['ws_path']}") == 4409, "a second socket for one session"
        ws.send_text(json.dumps({"type": "listen/stop"}))
        ws.receive_text()


def test_a_downlink_that_does_not_open_ends_the_session_honestly(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_fail_open = True
    t = start(c).json()
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect(f"/{t['ws_path']}") as ws:
            assert json.loads(ws.receive_text()) == {"type": "listen/closed", "value": "upstream_unavailable"}
            ws.receive_text()
    assert e.value.code == 4503
    details = json.loads(audit_rows(s, "intercom.listen.end")[-1]["details_json"])
    assert details["outcome"] == "upstream_unavailable" and details["duration_s"] == 0 and details["frames"] == 0


def test_turning_the_setting_off_or_losing_the_permission_ends_an_open_session(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    listen_mode(c, "on")
    fake_provider.listen_end = None
    monkeypatch.setattr(leases, "RECHECK_S", 0.0)
    t = start(c).json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        ws.receive_text()
        listen_mode(c, "off")
        assert json.loads(ws.receive_text()) == {"type": "listen/closed", "value": "access_lost"}
    assert json.loads(audit_rows(s, "intercom.listen.end")[-1]["details_json"])["outcome"] == "access_lost"


# ---------------------------------------------------------------- the real downlink is pending; the adapter's own rules

def test_real_listen_uses_published_signed_contract_and_requires_configuration():
    assert "talk_open(listen=true)" in ad.CONTRACT_STATE
    with pytest.raises(ad.ListenUnavailable) as e:
        asyncio.run(ad.WiskeyDownlinkChannel().open())
    assert e.value.code == "listen_not_configured"
    assert callable(getattr(im.WiskeyBridgeProvider, "listen_open", None)), "the bridge provider joins the downlink here, and only here"
    with pytest.raises(ad.ListenUnavailable) as e2:
        il.provider_listen_open(im.LocalProvider(), None, "entry-a", None, actor_id="u", actor_name="u", request_id=None, expires_at=None)  # type: ignore[arg-type]
    assert e2.value.code == "listen_unsupported"


def test_split_frames_keeps_whole_frames_only():
    assert ad.split_frames(b"") == [] and ad.split_frames(b"\x00" * 100) == []
    assert ad.split_frames(FRAME) == [FRAME] and ad.split_frames(FRAME * 3 + b"xx") == [FRAME] * 3
    assert ad.split_frames(b"\x00" * (ad.MAX_PACKET_BYTES + 1)) == []


def test_a_slow_browser_drops_the_oldest_frames_and_never_queues_more_than_the_bound():
    async def run() -> tuple[int, int, list[bytes]]:
        d = ad.SyntheticDownlink([bytes([i % 256]) * 160 for i in range(40)], end_reason="ended")
        await d.open()
        await d.wait_closed()  # all 40 offered, nobody read yet
        out = [f async for f in d.frames()]
        return d.dropped_frames, d.received_frames, out

    dropped, received, out = asyncio.run(run())
    assert received == 40 and dropped == 40 - ad.QUEUE_FRAMES and len(out) == ad.QUEUE_FRAMES
    assert out[-1] == bytes([39]) * 160, "the newest frame survives; the oldest went first"


def test_a_receive_style_downlink_reads_silence_as_silence_and_a_lost_connection_as_an_end():
    script: list[Any] = [FRAME, b"", FRAME * 2, RuntimeError("audio_connection_lost")]

    async def receive() -> bytes:
        item = script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    async def run() -> tuple[list[bytes], str]:
        d = ad.ReceiveDownlink(receive)
        await d.open()
        frames = [f async for f in d.frames()]
        return frames, await d.wait_closed()

    frames, reason = asyncio.run(run())
    assert frames == [FRAME] * 3 and reason == "upstream_closed"


def test_nothing_is_recorded_stored_or_logged_in_the_listen_modules():
    root = Path(__file__).resolve().parents[1] / "smplwise"
    for rel in ("services/wiskey_listen_adapter.py", "services/intercom_listen.py", "routers/intercom_listen.py"):
        text = (root / rel).read_text(encoding="utf-8")
        code = re.sub(r'""".*?"""', "", text, flags=re.S)
        for banned in ("tempfile", "import wave", "write_bytes", "write_text", ".write(", "sqlite3.connect", "INSERT INTO", "pathlib"):
            assert banned not in code, f"{rel}: {banned}"
        assert not re.search(r"log\.\w+\([^)]*frame", code), f"{rel}: a frame in a log line"
