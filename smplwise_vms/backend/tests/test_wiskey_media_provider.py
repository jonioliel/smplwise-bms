"""AVW10-295: WisKey's W10 station media - `WiskeyProvider` (services/intercom_media.py) on the ONE contract module
(services/wiskey_media_contract.py), the `media` channel's guard, the provider selection by discovery, and the S18 endpoints
running on it.

Fakes only: WisKey is a scripted `call` (fixtures under tests/fixtures/wiskey_w10, Arx's W10 proposal) behind the real
`wiskey_channels.guard(.., "media")`; go2rtc's in-memory registration is recorded, never reached; the feed of the endpoint
tests is test_intercom's scripted Home Assistant socket. Nothing here contacts a station, WisKey, Home Assistant or a go2rtc.
The fake RTSP source is on the reserved `.invalid` TLD with fake credentials; every test that touches it asserts it never
reaches a log line, an audit row, a served body or a repr."""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures

from smplwise.errors import ApiError
from smplwise.routers import media
from smplwise.services import go2rtc as g2
from smplwise.services import intercom_client, intercom_sync, wiskey_channels
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_contract as w10

FIX = Path(__file__).parent / "fixtures" / "wiskey_w10"
SOURCE_SECRETS = ("fixture-pass", "fixture-user", "station-a.invalid", "rtsp://")
MEDIA = "/api/v1/access-control/stations/{}/media"
LIVE = "/api/v1/access-control/stations/{}/live/ws?profile={}"
TALK = "/api/v1/access-control/stations/{}/talk"


def fixture(name: str, **times: float) -> dict[str, Any]:
    doc = json.loads((FIX / name).read_text(encoding="utf-8"))
    doc.pop("_note", None)
    for key, epoch in times.items():
        doc[key] = im.iso(epoch)
    return doc


def descriptor_reply(**over: Any) -> dict[str, Any]:
    now = time.time()
    return {**fixture("station_descriptor.json", issued_at=now - 5, expires_at=now + 300), **over}


class FakeWisKey:
    """WisKey's side of the `media` channel: answers per command (a dict, a callable of the frame, or an error code)."""

    def __init__(self) -> None:
        now = time.time()
        self.frames: list[dict[str, Any]] = []
        self.answers: dict[str, Any] = {
            w10.DESCRIBE: lambda kw: descriptor_reply(),
            w10.STREAM_LEASE: lambda kw: fixture("stream_lease.source.json", expires_at=time.time() + 300),
            w10.TALK_OPEN: fixture("talk_open.json"),
            w10.TALK_FRAME: {"ok": True},
            w10.TALK_FLOOR: {"ok": True},
            w10.TALK_CLOSE: {"closed": True},
        }
        self.errors: dict[str, str] = {}
        self.api: dict[str, Any] | None = fixture("overview_api.json")
        self.created = now

    async def call(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        self.frames.append({"type": msg_type, **kw})
        command = msg_type[len(intercom_client.DOMAIN) + 1:]
        if command in self.errors:
            return {"id": len(self.frames), "type": "result", "success": False, "error": {"code": self.errors[command]}}
        answer = self.answers[command]
        return {"id": len(self.frames), "type": "result", "success": True, "result": answer(kw) if callable(answer) else answer}

    def sent(self, command: str) -> list[dict[str, Any]]:
        return [f for f in self.frames if f["type"] == intercom_client.command_type(command)]


class FakeTransport:
    """`SyncTransport`'s shape over FakeWisKey: the real `media` guard, the feed's projection and refusal rules."""

    def __init__(self, wk: FakeWisKey, loop: asyncio.AbstractEventLoop) -> None:
        self.wk = wk
        self.loop = loop
        self.guarded = wiskey_channels.guard(wk.call, "media")
        self.post_none = False
        self.hold_posts = False

    def api(self, settings: Any) -> dict[str, Any] | None:
        return self.wk.api

    def _run(self, key: str, send: Any, project: Any, lane: str) -> tuple[dict[str, Any], str]:
        try:
            raw = asyncio.run_coroutine_threadsafe(send(self.guarded), self.loop).result(timeout=5)
        except intercom_client.IntercomError as exc:
            if lane == "read" and exc.code in intercom_sync.REQUEST_ERRORS:
                status, code, message = intercom_sync.REQUEST_ERRORS[exc.code]
                raise ApiError(status, code, message, details={"wiskey_code": exc.code}) from exc
            state = "unsupported" if exc.not_installed else "error"
            return {"state": state, "last_error": exc.code, key: None}, "refused"
        try:
            return {"state": "ready", "last_error": None, key: project(raw)}, "ok"
        except Exception:  # noqa: BLE001 - the feed's own rule: a reply of an unexpected shape
            return {"state": "error", "last_error": "invalid_response", key: None}, "unknown"

    def read(self, settings: Any, key: str, send: Any, project: Any, who: str) -> dict[str, Any]:
        return self._run(key, send, project, "read")[0]

    def act(self, settings: Any, key: str, send: Any, project: Any, who: str, *, free: bool = False) -> dict[str, Any]:
        reply, outcome = self._run(key, send, project, "action")
        if outcome != "ok":
            raise intercom_sync.action_error(reply, outcome)
        return reply

    def post(self, send: Any) -> Any:
        if self.post_none:
            return None
        if self.hold_posts:
            import concurrent.futures

            return concurrent.futures.Future()  # never answered: the in-flight bound must hold
        return asyncio.run_coroutine_threadsafe(send(self.guarded), self.loop)


@pytest.fixture()
def settings(settings):
    """The conftest settings with a go2rtc named (a reserved .invalid host: never reached - registration is recorded)."""
    from dataclasses import replace

    return replace(settings, go2rtc_url="http://go2rtc.invalid:1984")


@pytest.fixture()
def wk_loop():
    loop = asyncio.new_event_loop()
    thread = threading.Thread(target=loop.run_forever, daemon=True)
    thread.start()
    yield loop
    loop.call_soon_threadsafe(loop.stop)
    thread.join(timeout=5)
    loop.close()


@pytest.fixture()
def wk(wk_loop):
    return FakeWisKey()


@pytest.fixture()
def transport(wk, wk_loop):
    return FakeTransport(wk, wk_loop)


@pytest.fixture()
def provider(transport):
    p = im.WiskeyProvider(transport)
    im.set_provider(p)
    yield p
    im.set_provider(None)
    im.MEDIA.reset()


@pytest.fixture()
def registered(monkeypatch):
    """go2rtc's in-memory registration, recorded (the source is kept only to check it was handed over; never printed)."""
    calls: list[tuple[str, str]] = []

    def frame_jpeg(self, name: str, src: str) -> bytes:
        calls.append((name, src))
        with g2._REGISTERED_LOCK:
            g2._REGISTERED[name] = __import__("hashlib").sha256(src.encode()).hexdigest()
        return b"\xff\xd8\xff"

    monkeypatch.setattr(g2.Go2rtc, "frame_jpeg", frame_jpeg)
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)
    yield calls
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)


STATION = {"id": "entry-a", "online": True, "camera_entity": "camera.entry_a"}


def no_secret(*texts: str) -> None:
    joined = "\n".join(texts)
    assert not any(s in joined for s in SOURCE_SECRETS), "the lease source leaked"


# ---------------------------------------------------------------- discovery and the provider selection

def test_discovery_decides_what_wiskey_offers():
    api = fixture("overview_api.json")
    assert w10.listed(api) == (True, True, None)
    assert w10.listed({**api, "commands": [c for c in api["commands"] if c != w10.TALK_FLOOR]}) == (True, False, None), "video without the whole talk hook"
    assert w10.listed({**api, "commands": [c for c in api["commands"] if c != w10.STREAM_LEASE]}) == (False, False, "not_listed")
    assert w10.listed({**api, "commands": [intercom_client.command_type(c) for c in w10.COMMANDS]})[:2] == (True, True), "full type names count too"
    assert w10.listed(None) == (False, False, "discovery_unknown")
    assert w10.listed({**api, "min_client": 2}) == (False, False, "api_incompatible")
    assert w10.listed({**api, "commands": "media/station_descriptor media/stream_lease"}) == (False, False, "commands_unknown")


def test_the_provider_is_wiskey_only_while_discovery_lists_the_video_commands(settings, monkeypatch):
    im.set_provider(None)
    api: dict[str, Any] = {"value": None}
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: api["value"])
    monkeypatch.delenv(im.FAKE_ENV, raising=False)
    assert im.provider_for(settings).name == "local", "no discovery: Arx's own source exactly as before"
    api["value"] = fixture("overview_api.json")
    assert im.provider_for(settings).name == "wiskey"
    api["value"] = {**api["value"], "commands": ["overview", w10.DESCRIBE]}
    assert im.provider_for(settings).name == "local", "the descriptor alone is not enough"
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: (_ for _ in ()).throw(RuntimeError("boom")))
    assert im.provider_for(settings).name == "local", "an unreadable discovery keeps Arx's own source"
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: fixture("overview_api.json"))
    monkeypatch.setenv(im.FAKE_ENV, "1")
    from dataclasses import replace

    assert im.provider_for(replace(settings, in_addon=False)).name == "fake", "the developer fake still wins on a developer backend"
    assert im.provider_for(replace(settings, in_addon=True)).name == "wiskey"


def test_the_media_channel_carries_exactly_the_six_commands_and_nothing_else(wk, wk_loop):
    guarded = wiskey_channels.guard(wk.call, "media")
    for other in ("media/signal", "stations/test_unlock", "overview", "users/get"):
        with pytest.raises(intercom_client.IntercomError) as e:
            asyncio.run_coroutine_threadsafe(guarded(intercom_client.command_type(other)), wk_loop).result(5)
        assert e.value.code == wiskey_channels.NOT_ALLOWED
    assert not wk.frames, "a refused frame is never written"
    for channel in ("service", "read", "messaging"):
        assert not any(wiskey_channels.allowed(channel, intercom_client.command_type(c)) for c in w10.COMMANDS), channel


def test_media_post_needs_a_live_session_and_the_media_channel():
    async def send(call: Any) -> Any:
        return None

    assert intercom_sync.IntercomSync().media_post(send) is None, "no live session: nothing scheduled"
    assert intercom_sync.SYNC.media_post(send, "service") is None, "only the media guard rides the unrated path"


# ---------------------------------------------------------------- describe

def test_describe_reads_the_descriptor_as_arx_itself_and_parses_it_with_the_contract(provider, wk, settings):
    d = im.MEDIA.descriptor(provider, None, settings, STATION)
    assert d.provider == "wiskey" and [p.id for p in d.profiles] == ["sub", "main"] and d.talk_transport == "pcmu_frames"
    assert d.max_viewers == 2 and d.max_talkers == 1 and d.max_talk_seconds == 120
    [frame] = wk.sent(w10.DESCRIBE)
    assert frame["station_id"] == "entry-a" and frame["actor"] == {"id": "arx", "display_name": "Arx"} and frame["request_id"].startswith("arx-")
    assert "api_contract" not in frame, "the descriptor is a READ"
    im.MEDIA.descriptor(provider, None, settings, STATION)
    assert len(wk.sent(w10.DESCRIBE)) == 1, "cached until 30 s before it expires"
    wk.answers[w10.DESCRIBE] = lambda kw: descriptor_reply(expires_at=im.iso(time.time() + 20))
    im.MEDIA.reset()
    im.MEDIA.descriptor(provider, None, settings, STATION)
    im.MEDIA.descriptor(provider, None, settings, STATION)
    assert len(wk.sent(w10.DESCRIBE)) == 3, "a descriptor 20 s from its expiry is renewed on the next read"


def test_talk_is_off_while_the_talk_hook_is_not_listed(provider, wk, settings):
    wk.api = {**wk.api, "commands": ["overview", w10.DESCRIBE, w10.STREAM_LEASE]}
    d = im.MEDIA.descriptor(provider, None, settings, STATION)
    assert d.profiles and not d.talk and d.talk_transport is None
    with pytest.raises(ApiError) as e:
        provider.talk_open(settings, "entry-a", d, actor_id="u1", actor_name="Dana", request_id=None)
    assert e.value.code == "intercom_talk_unsupported"
    wk.api = None
    im.MEDIA.reset()
    with pytest.raises(im.Unavailable) as u:
        im.MEDIA.descriptor(provider, None, settings, STATION)
    assert u.value.code == "not_listed" and len(wk.sent(w10.DESCRIBE)) == 1, "nothing is asked while discovery does not list it"


@pytest.mark.parametrize("change, code", [
    ({"video": {"profiles": [{"id": "sub", "transports": ["webrtc"], "stream": "rtsp://fixture-user:fixture-pass@station-a.invalid/102"}]}}, "descriptor_carries_address"),
    ({"limits": {"max_viewers": 2, "host": "station-a.invalid"}}, "descriptor_carries_secret"),
    ({"audio": {"talk": True, "password": "fixture-pass"}}, "descriptor_carries_secret"),
    ({"schema": "arx.station_media.v2"}, "descriptor_schema_unknown"),
    ({"station_id": "entry-b"}, "descriptor_station_mismatch"),
    ({"session": "short"}, "descriptor_session_invalid"),
])
def test_a_descriptor_that_could_leak_is_refused_and_only_the_rule_is_logged(provider, wk, settings, caplog, change, code):
    wk.answers[w10.DESCRIBE] = lambda kw: descriptor_reply(**change)
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(im.Unavailable) as e:
            im.MEDIA.descriptor(provider, None, settings, STATION)
    assert e.value.code == code
    no_secret(caplog.text, str(e.value))


def test_an_expired_descriptor_is_refused(provider, wk, settings):
    wk.answers[w10.DESCRIBE] = lambda kw: descriptor_reply(issued_at=im.iso(time.time() - 600), expires_at=im.iso(time.time() - 1))
    with pytest.raises(im.Unavailable) as e:
        im.MEDIA.descriptor(provider, None, settings, STATION)
    assert e.value.code == "descriptor_expired"


@pytest.mark.parametrize("wiskey_code, reason", [
    ("station_offline", "offline"), ("media_not_supported", "no_media"), ("rate_limited", "rate_limited"),
    ("station_not_found", "not_found"), ("unknown_command", "no_media"), ("something_new", "provider_error"),
])
def test_wiskeys_refusals_of_the_descriptor_become_reasons(provider, wk, settings, wiskey_code, reason):
    wk.errors[w10.DESCRIBE] = wiskey_code
    with pytest.raises(im.Unavailable) as e:
        im.MEDIA.descriptor(provider, None, settings, STATION)
    assert e.value.code == reason


# ---------------------------------------------------------------- the stream lease

def test_the_lease_source_is_registered_in_memory_in_arxs_namespace_and_never_shown(provider, wk, settings, registered, caplog):
    actor = w10.Actor("u1", "Dana")
    with caplog.at_level(logging.DEBUG):
        name = provider.video_stream(None, settings, STATION, "sub", actor=actor)
        again = provider.video_stream(None, settings, STATION, "sub", actor=actor)
        main = provider.video_stream(None, settings, STATION, "main", actor=actor)
    assert name == again == "smplwise_wiskey_entry-a.sub" and main == "smplwise_wiskey_entry-a"
    assert [n for n, _src in registered] == ["smplwise_wiskey_entry-a.sub", "smplwise_wiskey_entry-a"], "registered once per source, by name afterwards"
    assert all(src == fixture("stream_lease.source.json")["source"] for _n, src in registered), "the source goes to go2rtc's registration only"
    leases = wk.sent(w10.STREAM_LEASE)
    assert [f["profile"] for f in leases] == ["sub", "sub", "main"] and all(f["actor"] == {"id": "u1", "display_name": "Dana"} for f in leases)
    assert all(f["session"] == "wk-desc-0123456789abcdef" and f["api_contract"] == intercom_client.API_CONTRACT for f in leases)
    lease = w10.parse_lease(fixture("stream_lease.source.json", expires_at=time.time() + 60))
    no_secret(caplog.text, repr(lease), str(lease))


def test_a_stream_name_is_accepted_only_inside_arxs_own_namespace(provider, wk, settings, registered):
    wk.answers[w10.STREAM_LEASE] = fixture("stream_lease.stream.json")
    assert provider.video_stream(None, settings, STATION, "sub") == "smplwise_wiskey_entry-a.sub" and not registered, "named only, never created"
    for foreign in ("door_station_1", "smplwise_other", "smplwise_wiskey_", "intercom/front"):
        wk.answers[w10.STREAM_LEASE] = {"go2rtc_stream": foreign}
        with pytest.raises(ApiError) as e:
            provider.video_stream(None, settings, STATION, "sub")
        assert (e.value.status, e.value.details["reason"]) == (503, "lease_stream_foreign"), foreign
    assert not registered


@pytest.mark.parametrize("answer, reason", [
    ({"source": "rtsp://fixture-user:fixture-pass@station-a.invalid/101", "go2rtc_stream": "smplwise_wiskey_entry-a"}, "lease_ambiguous"),
    ({}, "lease_ambiguous"),
    ({"source": "http://station-a.invalid/101", "expires_at": "LATER"}, "lease_expires_at_invalid"),
    ({"source": "http://station-a.invalid/101"}, "lease_source_invalid"),
    ({"source": "rtsp://station-a.invalid/101 extra"}, "lease_source_invalid"),
    ({"source": "rtsp://fixture-user:fixture-pass@station-a.invalid/101", "expires_at": "2020-01-01T00:00:00Z"}, "lease_expired"),
    ({"source": "rtsp://fixture-user:fixture-pass@station-a.invalid/101", "expires_at": "2099-01-01T00:00:00Z"}, "lease_lifetime_too_long"),
    ({"source": "rtsp://fixture-user:fixture-pass@station-a.invalid/101", "expires_at": "2027-01-15T08:05:00"}, "lease_expires_at_invalid"),
])
def test_a_lease_arx_cannot_trust_is_refused_without_its_value(provider, wk, settings, registered, caplog, answer, reason):
    if "expires_at" not in answer and "source" in answer and reason == "lease_source_invalid":
        answer = {**answer, "expires_at": im.iso(time.time() + 60)}
    wk.answers[w10.STREAM_LEASE] = answer
    with caplog.at_level(logging.DEBUG):
        with pytest.raises(ApiError) as e:
            provider.video_stream(None, settings, STATION, "sub")
    assert e.value.status == 503 and e.value.details["reason"] == reason
    with pytest.raises(w10.ContractError) as ce:
        w10.parse_lease(answer)
    assert ce.value.code == reason
    assert not registered
    no_secret(caplog.text, str(e.value), json.dumps(e.value.details), str(ce.value))


def test_a_profile_the_descriptor_does_not_offer_is_never_leased(provider, wk, settings, registered):
    wk.answers[w10.DESCRIBE] = lambda kw: descriptor_reply(video={"profiles": [{"id": "main", "codec": "h264", "transports": ["mse"]}]})
    with pytest.raises(ApiError) as e:
        provider.video_stream(None, settings, STATION, "sub")
    assert e.value.code == "intercom_media_profile_unavailable" and not wk.sent(w10.STREAM_LEASE)


def test_a_go2rtc_that_refuses_the_registration_is_unavailable(provider, wk, settings, monkeypatch):
    def refuse(self, name: str, src: str) -> bytes:
        raise ApiError(503, "media_error", "go2rtc refused", details={"op": "frame", "status": 401})

    monkeypatch.setattr(g2.Go2rtc, "frame_jpeg", refuse)
    with g2._REGISTERED_LOCK:
        g2._REGISTERED.pop("smplwise_wiskey_entry-a.sub", None)
    with pytest.raises(ApiError) as e:
        provider.video_stream(None, settings, STATION, "sub")
    assert e.value.details["reason"] == "media_error"


# ---------------------------------------------------------------- the talk hook

def talk_channel(provider: im.WiskeyProvider, settings: Any, **kw: Any) -> im.WiskeyTalkChannel:
    d = im.MEDIA.descriptor(provider, None, settings, STATION)
    return provider.talk_open(settings, "entry-a", d, actor_id="u1", actor_name="Dana", request_id=kw.pop("request_id", "ptt-0001-abcd"),
                              expires_at=time.time() + 60)


async def settle(times: int = 20) -> None:
    for _ in range(times):
        await asyncio.sleep(0.01)


def test_a_talk_opens_sends_numbered_frames_only_through_wiskey_and_closes_once(provider, wk, settings):
    ch = talk_channel(provider, settings)

    async def scenario() -> str:
        await ch.open()
        await ch.floor(True)
        for _ in range(3):
            await ch.send_frame(b"\x7f" * 160)
        await settle()
        await ch.floor(False)
        await ch.close("stopped")
        return await ch.wait_closed()

    assert asyncio.run(scenario()) == "stopped"
    [opened] = wk.sent(w10.TALK_OPEN)
    assert opened["session"] == "wk-desc-0123456789abcdef" and opened["actor"] == {"id": "u1", "display_name": "Dana"}
    assert opened["request_id"] == "ptt-0001-abcd" and opened["expires_at"].endswith("Z") and opened["api_contract"] == intercom_client.API_CONTRACT
    frames = wk.sent(w10.TALK_FRAME)
    assert [f["seq"] for f in frames] == [1, 2, 3] and {f["talk_ref"] for f in frames} == {"wk-talk-0123456789abcdef"}
    assert all(__import__("base64").b64decode(f["data"]) == b"\x7f" * 160 for f in frames)
    assert [f["held"] for f in wk.sent(w10.TALK_FLOOR)] == [True, False]
    assert [f["reason"] for f in wk.sent(w10.TALK_CLOSE)] == ["stopped"]
    assert im.WISKEY_TALKS.count() == 0


def test_a_busy_station_is_refused_without_saying_who(provider, wk, settings):
    wk.errors[w10.TALK_OPEN] = fixture("talk_open.busy.json")["error"]["code"]
    ch = talk_channel(provider, settings)
    with pytest.raises(ApiError) as e:
        asyncio.run(ch.open())
    assert (e.value.status, e.value.code) == (409, "intercom_talk_busy") and "panel" not in e.value.user_message
    assert im.WISKEY_TALKS.count() == 0 and not wk.sent(w10.TALK_FRAME)


@pytest.mark.parametrize("answer, rule", [
    ({"talk_ref": "short", "codec": "pcmu", "frame_ms": 20}, "talk_ref_invalid"),
    ({"talk_ref": "wk-talk-0123456789abcdef", "codec": "opus", "frame_ms": 20}, "talk_codec_unsupported"),
    ({"talk_ref": "wk-talk-0123456789abcdef", "codec": "pcmu", "frame_ms": 40}, "talk_frame_ms_unsupported"),
    ([], "talk_open_not_an_object"),
])
def test_a_talk_open_reply_arx_cannot_use_opens_nothing(provider, wk, settings, answer, rule):
    with pytest.raises(w10.ContractError) as ce:
        w10.parse_talk_open(answer)
    assert ce.value.code == rule
    wk.answers[w10.TALK_OPEN] = answer
    ch = talk_channel(provider, settings)
    with pytest.raises(ApiError):
        asyncio.run(ch.open())
    assert im.WISKEY_TALKS.count() == 0


def test_a_codec_other_than_the_descriptors_is_closed_at_once(provider, wk, settings):
    wk.answers[w10.TALK_OPEN] = {**fixture("talk_open.json"), "codec": "pcma"}
    ch = talk_channel(provider, settings)
    with pytest.raises(ApiError) as e:
        asyncio.run(ch.open())
    assert e.value.details["reason"] == "talk_codec_mismatch" and [f["reason"] for f in wk.sent(w10.TALK_CLOSE)] == ["ended"]


def test_wiskey_ending_the_talk_ends_the_session_and_sends_no_close(provider, wk, settings):
    ch = talk_channel(provider, settings)
    event = fixture("talk_closed.event.json")

    async def scenario() -> str:
        await ch.open()
        intercom_sync._media_hook(event)  # what the feed's subscription handler calls
        reason = await asyncio.wait_for(ch.wait_closed(), 2)
        await ch.close(reason)
        return reason

    assert asyncio.run(scenario()) == "upstream_closed"
    assert not wk.sent(w10.TALK_CLOSE) and ch.closed_by_wiskey and im.WISKEY_TALKS.count() == 0
    assert w10.talk_closed({**event, "talk_ref": "nope"}) is None and w10.talk_closed({"kind": "refresh"}) is None
    assert w10.talk_closed({"kind": w10.EVENT_TALK_CLOSED, "data": {"talk_ref": "wk-talk-0123456789abcdef", "reason": "x" * 80}}) == ("wk-talk-0123456789abcdef", "upstream_closed")


def test_a_session_that_ends_takes_every_wiskey_talk_with_it(provider, wk, settings):
    ch = talk_channel(provider, settings)

    async def scenario() -> str:
        await ch.open()
        im.on_wiskey_event(None)
        return await asyncio.wait_for(ch.wait_closed(), 2)

    assert asyncio.run(scenario()) == "upstream_closed"


def test_an_undeliverable_or_refused_frame_ends_the_talk_without_retry(provider, wk, transport, settings):
    ch = talk_channel(provider, settings)

    async def undeliverable() -> str:
        await ch.open()
        transport.post_none = True
        await ch.send_frame(b"\xff" * 160)
        return await asyncio.wait_for(ch.wait_closed(), 2)

    assert asyncio.run(undeliverable()) == "upstream_closed" and not wk.sent(w10.TALK_FRAME)
    transport.post_none = False
    wk.errors[w10.TALK_FRAME] = "talk_not_found"
    ch2 = talk_channel(provider, settings)

    async def refused() -> str:
        await ch2.open()
        await ch2.send_frame(b"\xff" * 160)
        reason = await asyncio.wait_for(ch2.wait_closed(), 2)
        await ch2.send_frame(b"\xff" * 160)  # after the end: nothing more is sent
        return reason

    assert asyncio.run(refused()) == "upstream_closed" and len(wk.sent(w10.TALK_FRAME)) == 1


def test_a_slow_wiskey_drops_frames_instead_of_queueing_audio(provider, wk, transport, settings):
    ch = talk_channel(provider, settings)
    transport.hold_posts = True

    async def scenario() -> None:
        await ch.open()
        for _ in range(20):
            await ch.send_frame(b"\xff" * 160)

    asyncio.run(scenario())
    assert ch.seq == ch.FRAMES_IN_FLIGHT and ch.dropped == 20 - ch.FRAMES_IN_FLIGHT, "seq counts frames sent, never dropped ones"


def test_arxs_outcomes_reach_wiskey_as_its_close_reasons():
    assert [w10.close_reason(o) for o in ("stopped", "ended", "expired", "access_lost", "upstream_closed", "upstream_unavailable", "never_connected", "??")] == \
        ["stopped", "ended", "expired", "access_lost", "upstream_closed", "upstream_closed", "ended", "ended"]


# ---------------------------------------------------------------- the S18 endpoints on WiskeyProvider (screens unchanged)

def mode(c: TestClient, value: str) -> None:
    assert c.patch("/api/v1/settings", json={"access.station_media": value}).status_code == 200


def audit_rows(s: Any, action: str) -> list[dict[str, Any]]:
    from smplwise.db import Database

    with Database(s.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def test_the_media_read_on_wiskey_serves_the_same_projection_and_no_handle(feed, fake_go2rtc, provider, wk):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    body = c.get(MEDIA.format("entry-a")).json()
    assert body["state"] == "ready" and [p["id"] for p in body["video"]["profiles"]] == ["sub", "main"] and body["talk"]["available"] is True
    assert set(body) == {"station_id", "mode", "state", "reason", "video", "talk", "listen", "expires_at"}
    text = json.dumps(body)
    assert "wk-desc" not in text and "arx-" not in text
    no_secret(text)
    wk.errors[w10.DESCRIBE] = "station_offline"
    im.MEDIA.reset()
    assert c.get(MEDIA.format("entry-a")).json()["reason"] == "offline"


def test_live_video_on_wiskey_relays_the_leased_stream_and_audits_no_source(feed, fake_go2rtc, provider, wk, registered, monkeypatch, caplog):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video")
    seen: dict[str, Any] = {}

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        seen["url"] = upstream_url
        await websocket.send_text('{"type":"mse","value":"video/mp4"}')
        return "client_closed"

    monkeypatch.setattr(media, "relay_ws", relay)
    with caplog.at_level(logging.DEBUG):
        with c.websocket_connect(LIVE.format("entry-a", "sub")) as ws:
            assert json.loads(ws.receive_text())["type"] == "mse"
    assert seen["url"].endswith("/api/ws?src=smplwise_wiskey_entry-a.sub")
    [lease] = wk.sent(w10.STREAM_LEASE)
    assert lease["actor"]["id"] == "dev-joni", "the lease names the real viewer"
    rows = audit_rows(s, "video.live.start") + audit_rows(s, "video.live.stop")
    assert rows and rows[0]["resource_type"] == "intercom_station"
    no_secret(json.dumps(rows), caplog.text, seen["url"])


def test_a_talk_on_wiskey_end_to_end_through_the_s18_socket(feed, fake_go2rtc, provider, wk):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    t = c.post(TALK.format("entry-a"), json={"client_request_id": "ptt-0001-abcd"}).json()
    frame = b"\x7f" * 160
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        ws.send_bytes(frame)  # not held: dropped by the router, never reaches WisKey
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "down"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/floor", "value": "held"}
        ws.send_bytes(frame)
        ws.send_bytes(frame)
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "up"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/floor", "value": "released"}
        ws.send_text(json.dumps({"type": "talk/stop"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "stopped"}
    [opened] = wk.sent(w10.TALK_OPEN)
    assert opened["actor"]["id"] == "dev-joni" and set(opened["actor"]) == {"id", "display_name"} and opened["request_id"] == "ptt-0001-abcd"
    assert [f["seq"] for f in wk.sent(w10.TALK_FRAME)] == [1, 2] and [f["held"] for f in wk.sent(w10.TALK_FLOOR)] == [True, False]
    assert [f["reason"] for f in wk.sent(w10.TALK_CLOSE)] == ["stopped"]
    [end] = audit_rows(s, "intercom.talk.end")
    details = json.loads(end["details_json"])
    assert details["outcome"] == "stopped" and details["frames"] == 2 and end["request_id"] == "ptt-0001-abcd"
    assert "wk-talk" not in json.dumps(end) and "data" not in details, "never WisKey's handle, never audio"


def test_a_busy_station_on_wiskey_ends_the_session_honestly(feed, fake_go2rtc, provider, wk):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    wk.errors[w10.TALK_OPEN] = "audio_busy"
    t = c.post(TALK.format("entry-a")).json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "upstream_unavailable"}
    assert json.loads(audit_rows(s, "intercom.talk.end")[-1]["details_json"])["outcome"] == "upstream_unavailable"
    assert not wk.sent(w10.TALK_CLOSE), "nothing was opened, so nothing is closed"
    assert c.get(MEDIA.format("entry-a")).json()["talk"]["busy"] is False, "the Arx slot is released"


def test_a_viewer_without_the_call_permission_never_reaches_the_talk_hook(feed, fake_go2rtc, provider, wk):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.post(TALK.format("entry-a"), headers=as_user("vera")).status_code == 403
    assert not wk.sent(w10.TALK_OPEN)
