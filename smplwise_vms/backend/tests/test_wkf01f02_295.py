"""WKF01F02-295: the Mac lease lifecycle merged into the WKLIVE registry (F01) and the station's sound inside a two-way talk (F02).

Source of the merged behaviour: WisKey's delta `station-talk-audio-v1.patch` (sha256 be2c1c05...) and Arx's reply sections 7 (F01) and
8 (F02). Everything here runs on FAKES: go2rtc is an `httpx.MockTransport` or a patched method, WisKey is `tests/w10_fake_station.py`,
the browser socket is a double. Nothing proves anything about a real go2rtc, WisKey, station, microphone or speaker.

The WKLIVE tests themselves (first / last viewer, sweep, the namespace guard, a failing delete) stay in test_wiskey_media_v11.py and run
together with these."""
from __future__ import annotations

import asyncio
import base64
import json
import time
from dataclasses import replace
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from w10_fake_station import SCHEMAS, SECRET, FakeStation

from smplwise.errors import ApiError
from smplwise.routers import intercom_media as router_im
from smplwise.services import go2rtc as g2
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_contract as w10
from smplwise.services.wiskey_listen_adapter import ReceiveDownlink

SOURCE = "rtsp://fixture-user:fixture-pass@station-a.invalid:554/stream/main"
OTHER_SOURCE = "rtsp://fixture-user:fixture-pass@station-a.invalid:554/stream/other"
STATION = {"id": "entry-a", "online": True, "camera_entity": "camera.entry_a"}
OPTS = {"frame_s": 0.01, "heartbeat_s": 0.2, "frame_timeout_s": 0.4, "floor_timeout_s": 1.0}


# ================================================================ fixtures

@pytest.fixture()
def go2rtc(monkeypatch):
    """go2rtc's HTTP API as a MockTransport: frame grabs register, deletes are recorded and answered with `status`."""
    state = SimpleNamespace(status=204, deletes=[])

    def http(request: httpx.Request) -> httpx.Response:
        assert request.method == "DELETE" and request.url.path == "/api/streams"
        state.deletes.append(request.url.params["src"])
        return httpx.Response(state.status)

    monkeypatch.setattr(g2.Go2rtc, "_client", lambda self: httpx.Client(base_url="http://go2rtc.invalid", transport=httpx.MockTransport(http)))
    monkeypatch.setattr(g2.Go2rtc, "_grab", lambda self, params: (200, b"\xff\xd8\xff-frame", False))
    with im._LEASE_LOCK:
        im._LEASED.clear()
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)
    yield state
    with im._LEASE_LOCK:
        rows = list(im._LEASED.items())
        im._LEASED.clear()
    for _name, rec in rows:
        for timer in rec.timers:
            timer.cancel()
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)
    im.MEDIA.reset()


@pytest.fixture()
def gset(settings):
    return replace(settings, go2rtc_url="http://go2rtc.invalid:1984")


def owner() -> Any:
    return object()


def register(settings: Any, who: Any, seconds: float, source: str = SOURCE, sid: str = "entry-a") -> str:
    return im._register_lease(settings, sid, "main", source, time.time() + seconds, owner=who)


# ================================================================ F01: the lease lifecycle in the WKLIVE registry

def test_the_record_carries_owner_digest_and_one_timer_and_the_name_is_the_owners_own(go2rtc, gset):
    who = owner()
    name = register(gset, who, 5)
    rec = im._LEASED[name]
    assert name.startswith("smplwise_wiskey_entry-a.w10.") and name != g2.wiskey_stream_name("entry-a"), "never the stills' stream"
    assert rec.owner is who and rec.station == "entry-a" and rec[0] == "entry-a" and rec.digest == g2._REGISTERED[name]
    assert rec.timer is not None and rec.timer.is_alive() and rec.generation == 1
    assert "fixture-pass" not in repr(rec) and "fixture-pass" not in repr(im._LEASED)
    assert im.close_leased_streams(who) and go2rtc.deletes == [name] and not im._LEASED


def test_the_timer_retires_an_ended_lease_without_a_viewer_and_a_renewal_invalidates_the_old_generation(go2rtc, gset, monkeypatch):
    monkeypatch.setattr(im, "LEASE_GRACE_S", 0.0)
    who = owner()
    name = register(gset, who, 0.3)
    time.sleep(0.1)
    assert register(gset, who, 0.5) == name, "a fresh lease of the same source renews the registration (not sent again)"
    assert im._LEASED[name].generation == 2
    time.sleep(0.3)
    assert not go2rtc.deletes, "the first generation's timer has nothing to do"
    time.sleep(0.4)
    assert go2rtc.deletes == [name] and name not in im._LEASED and name not in g2._REGISTERED


def test_the_timer_never_deletes_under_a_viewer_the_last_viewer_does(go2rtc, gset, monkeypatch):
    monkeypatch.setattr(im, "LEASE_GRACE_S", 0.0)
    name = register(gset, owner(), 0.2)
    im.MEDIA.add_viewer("entry-a", "v1", 4)
    time.sleep(0.4)
    assert not go2rtc.deletes and name in im._LEASED, "a viewer keeps its stream (WKLIVE)"
    im.MEDIA.drop_viewer("entry-a", "v1")
    assert im.release_leased_streams(gset, "entry-a") == [name] and go2rtc.deletes == [name]


def test_a_changed_source_retires_the_earlier_stream_unless_a_viewer_still_watches_it(go2rtc, gset):
    who = owner()
    first = register(gset, who, 5)
    second = register(gset, who, 5, OTHER_SOURCE)
    assert second != first and go2rtc.deletes == [first] and set(im._LEASED) == {second}
    im.MEDIA.add_viewer("entry-a", "v1", 4)
    third = register(gset, who, 5, SOURCE)
    assert third not in (first, second) and set(im._LEASED) == {second, third}, "the watched stream is not deleted under its viewer"
    im.MEDIA.drop_viewer("entry-a", "v1")
    assert sorted(im.release_leased_streams(gset, "entry-a")) == sorted([second, third])


def test_two_owners_keep_their_own_streams_and_a_foreign_registration_is_never_deleted(go2rtc, gset):
    first, second = owner(), owner()
    a = register(gset, first, 5)
    b = register(gset, second, 5)
    assert a != b
    with g2._REGISTERED_LOCK:
        g2._REGISTERED[a] = "a-foreign-registration"
    assert im.close_leased_streams(first) and a in g2._REGISTERED and not go2rtc.deletes and a not in im._LEASED
    assert im.close_leased_streams(second) and go2rtc.deletes == [b] and b not in g2._REGISTERED
    g2._REGISTERED.pop(a)


def test_an_unconfirmed_delete_keeps_the_exact_owner_and_refuses_a_new_source_until_resolved(go2rtc, gset):
    who = owner()
    name = register(gset, who, 5)
    go2rtc.status = 500
    assert not im.close_leased_streams(who)
    rec = im._LEASED[name]
    assert rec.quarantined and rec.owner is who and name in g2._REGISTERED, "quarantined: neither the record nor the registration is forgotten"
    with pytest.raises(ApiError) as failure:
        register(gset, who, 5, OTHER_SOURCE)
    assert failure.value.code == "intercom_media_cleanup_failed" and set(im._LEASED) == {name}
    assert im._sweep_leased(gset, now=time.time() + 3600) == [], "the janitor does not retry a quarantined delete"
    go2rtc.status = 404  # go2rtc no longer knows it: that is a confirmed end too
    assert im.close_leased_streams(who) and not im._LEASED and name not in g2._REGISTERED


def test_the_strict_delete_reads_go2rtcs_answer_and_the_lenient_one_stays_as_it_was(go2rtc, gset):
    client = g2.Go2rtc(gset)
    for status in (200, 204, 404):
        go2rtc.status = status
        client.delete_stream("smplwise_wiskey_entry-a.w10.0011", strict=True)
    go2rtc.status = 500
    with pytest.raises(ApiError):
        client.delete_stream("smplwise_wiskey_entry-a.w10.0011", strict=True)
    client.delete_stream("smplwise_x", strict=False)  # the other callers (playback, HA cameras, autosync) are not changed
    assert client.discard_leased_stream("smplwise_wiskey_entry-a.w10.0011") is False
    for bad in ("foreign_stream", "smplwise_wiskey_probe_abc", "smplwise_ha_cam", "smplwise_wiskey_../x"):
        with pytest.raises(ValueError):
            client.discard_leased_stream(bad)
    assert all(d.startswith("smplwise_") for d in go2rtc.deletes), "nothing outside our namespace is ever asked for"


def test_close_cancels_and_joins_every_timer_generation_of_the_owner(go2rtc, gset):
    who = owner()
    name = register(gset, who, 5)
    rec = im._LEASED[name]
    assert register(gset, who, 5) == name and register(gset, who, 5) == name
    timers = tuple(rec.timers)
    assert timers and im.close_leased_streams(who)
    assert not any(t.is_alive() for t in timers) and not im._LEASED and go2rtc.deletes == [name]


def test_the_video_channel_closes_its_leased_streams_first_and_keeps_its_connection_while_a_delete_is_unconfirmed(go2rtc, gset):
    channel = bridge.VideoChannel(SimpleNamespace())
    name = register(gset, channel, 5)
    go2rtc.status = 500
    with pytest.raises(bridge.MediaBridgeError) as failure:
        channel.close()
    assert failure.value.code == "media_cleanup_failed" and name in im._LEASED
    go2rtc.status = 204
    channel.close()
    assert not im._LEASED and go2rtc.deletes == [name, name]


def test_the_shutdown_closes_the_production_owner_and_keeps_it_while_unresolved(go2rtc, gset):
    provider = im.WiskeyBridgeProvider(SimpleNamespace())
    name = register(gset, provider.video, 5)
    saved = (im._bridge, im._bridge_for)
    im._bridge, im._bridge_for = provider, (1, 2)
    try:
        go2rtc.status = 500
        assert im.shutdown_bridge() is False and im._bridge is provider, "an unconfirmed delete: the exact owner stays"
        go2rtc.status = 204
        assert im.shutdown_bridge() is True and im._bridge is None and im._bridge_for is None
        assert not im._LEASED and go2rtc.deletes == [name, name]
        assert im.shutdown_bridge() is True, "nothing left: a no-op"
    finally:
        im._bridge, im._bridge_for = saved


def test_a_replacement_provider_closes_the_earlier_owner_and_a_failed_build_adopts_nothing(go2rtc, gset, monkeypatch):
    provider = im.WiskeyBridgeProvider(SimpleNamespace())
    name = register(gset, provider.video, 5)
    saved = (im._bridge, im._bridge_for)
    im._bridge, im._bridge_for = provider, (1, 2)

    def unavailable(_conn: Any) -> Any:
        raise RuntimeError("synthetic key source unavailable")

    monkeypatch.setattr(im, "_CachedKey", unavailable)
    try:
        with pytest.raises(RuntimeError):
            im.bridge_provider(gset, None)
        assert im._bridge is None and im._bridge_for is None and go2rtc.deletes == [name] and not im._LEASED
    finally:
        im._bridge, im._bridge_for = saved


def test_an_unresolved_earlier_owner_is_not_replaced_and_the_station_keeps_arxs_own_source(go2rtc, gset, monkeypatch):
    from smplwise.services import intercom_sync

    provider = im.WiskeyBridgeProvider(SimpleNamespace())
    register(gset, provider.video, 5)
    saved = (im._bridge, im._bridge_for, im._override)
    im._bridge, im._bridge_for, im._override = provider, (1, 2), None
    monkeypatch.delenv(im.FAKE_ENV, raising=False)
    monkeypatch.setattr(im, "provider_choice", lambda conn: "auto")
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: {"commands": [w10.DESCRIBE, w10.STREAM_LEASE]})
    monkeypatch.setattr(w10, "listed", lambda api: (True, False, None))
    go2rtc.status = 500
    try:
        assert im.provider_for(gset, None) is im._local
        assert im._bridge is provider, "no replacement while the earlier owner's cleanup is unresolved"
    finally:
        go2rtc.status = 204
        im.close_leased_streams(provider.video)
        im._bridge, im._bridge_for, im._override = saved


# ================================================================ F02: the station's sound inside the talk (fakes)

LISTEN_REPLY = {"transport": "signed_ws_pcmu_v1", "schema": "arx.station_talk_audio.v1", "sample_rate": 8000, "channels": 1, "packet_bytes": 800}


class ListeningStation(FakeStation):
    """The fake WisKey with `arx.station_talk_audio.v1`: the descriptor offers `signed_ws_pcmu_v1`, `talk_open(listen=true)` answers the
    listen block, and `emit_audio` sends one `media/talk_audio` event on the talk's own connection (as the delta's WisKey side does)."""

    def __init__(self, *, offer: bool = True, answer: dict[str, Any] | None = LISTEN_REPLY) -> None:
        super().__init__()
        self.offer, self.answer = offer, answer
        self.listen_asked: list[Any] = []

    def _station_descriptor(self, conn: Any, p: dict[str, Any]) -> dict[str, Any]:
        raw = super()._station_descriptor(conn, p)
        if self.offer:
            raw["audio"] = {**raw["audio"], "listen_transports": ["signed_ws_pcmu_v1"]}
        return raw

    def _talk_open(self, conn: Any, p: dict[str, Any]) -> dict[str, Any]:
        self.listen_asked.append(p.get("listen"))
        reply = super()._talk_open(conn, p)
        if p.get("listen") is True and self.answer is not None:
            reply["listen"] = dict(self.answer)
        return reply

    def emit_audio(self, ref: str, seq: int, packet: bytes, override: dict[str, Any] | None = None) -> None:
        talk = self.talks[ref]
        event = {"type": "media/talk_audio", "schema": "arx.station_talk_audio.v1", "talk_ref": ref, "seq": seq, "codec": "pcmu",
                 "sample_rate": 8000, "channels": 1, "data": base64.b64encode(packet).decode(), **(override or {})}
        talk.conn.event_handler(event)


@pytest.fixture()
def listen_schema(monkeypatch):
    """The fake's published talk_open schema learns the optional `listen` boolean of the delta (restored after the test)."""
    monkeypatch.setitem(SCHEMAS["media/talk_open"]["parameters_schema"].setdefault("properties", {}), "listen", {"type": "boolean"})


async def talk_on(station: FakeStation, settings: Any) -> im.WiskeyBridgeTalkChannel:
    async def connector(_purpose: str) -> Any:
        return station.connect()

    media = bridge.SignedBridgeTransport(connector, bridge.BridgeSigner(lambda: SECRET))
    api = {"commands": [w10.DESCRIBE, w10.STREAM_LEASE, w10.TALK_OPEN, w10.TALK_FRAME, w10.TALK_FLOOR, w10.TALK_CLOSE]}
    provider = im.WiskeyBridgeProvider(media, discovery=lambda _s: api, pump_options=dict(OPTS))
    raw = await _describe(station, media)
    d = im.parse_descriptor(w10.project_descriptor(raw), station_id="entry-a", provider=provider.name)
    return im.WiskeyBridgeTalkChannel(provider, settings, d, w10.Actor("op-1", "Dana Operator"), "req-f02-1", time.time() + 60)


async def _describe(station: FakeStation, media: Any) -> dict[str, Any]:
    link = await media.connect(bridge.PURPOSE_VIDEO)
    try:
        return await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", w10.SYSTEM_ACTOR, "arx-d-f02"), timeout=2)
    finally:
        await link.close()


def test_a_talk_asks_for_the_stations_sound_when_offered_and_hands_out_its_packets_in_order(gset, listen_schema):
    station = ListeningStation()

    async def scenario() -> None:
        channel = await talk_on(station, gset)
        await channel.open()
        assert station.listen_asked == [True] and channel.listening
        one, two = bytes([0x11]) * 800, bytes([0x22]) * 800
        station.emit_audio(channel.ref, 0, one)
        station.emit_audio(channel.ref, 1, two)
        assert await asyncio.wait_for(channel.receive_audio(), 2) == one
        assert await asyncio.wait_for(channel.receive_audio(), 2) == two
        await channel.floor(True)  # the uplink is untouched: the same pump, the same floor
        await channel.send_frame(bytes(160))
        await channel.close("ended")
        assert channel._incoming.empty(), "no sound outlives its talk"
        with pytest.raises(bridge.MediaBridgeError):
            channel._incoming.put_nowait((time.monotonic(), one))
            await asyncio.wait_for(channel.receive_audio(), 2)

    asyncio.run(scenario())


def test_a_talk_without_the_offer_opens_exactly_as_before(gset, listen_schema):
    station = ListeningStation(offer=False)

    async def scenario() -> None:
        channel = await talk_on(station, gset)
        await channel.open()
        assert station.listen_asked == [None] and not channel.listening
        req = station.by_command(w10.TALK_OPEN)[0].params
        assert "listen" not in req
        await channel.close("ended")

    asyncio.run(scenario())


def test_a_talk_whose_answer_lacks_the_listen_block_is_refused_and_closed_by_its_ref(gset, listen_schema):
    station = ListeningStation(answer=None)

    async def scenario() -> None:
        channel = await talk_on(station, gset)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        assert exc.value.status == 503 and exc.value.details == {"reason": "talk_listen_unavailable"}
        assert station.by_command(w10.TALK_CLOSE), "the opened talk is closed at once (it holds the station)"

    asyncio.run(scenario())


@pytest.mark.parametrize("override", [{"seq": 5}, {"talk_ref": "f" * 32}, {"codec": "pcma"}, {"sample_rate": 16000}, {"data": "invalid"}])
def test_a_packet_out_of_sequence_foreign_or_malformed_ends_the_talk(gset, listen_schema, override):
    station = ListeningStation()

    async def scenario() -> str:
        channel = await talk_on(station, gset)
        await channel.open()
        station.emit_audio(channel.ref, 0, bytes(800), override)
        reason = await asyncio.wait_for(channel.wait_closed(), 3)
        await channel.close("ended")
        return reason

    assert asyncio.run(scenario()) != "ended"


def test_only_the_newest_packets_wait_and_a_late_one_is_never_served(gset, listen_schema, monkeypatch):
    station = ListeningStation()

    async def scenario() -> None:
        channel = await talk_on(station, gset)
        await channel.open()
        for seq in range(5):
            station.emit_audio(channel.ref, seq, bytes([seq]) * 800)
        assert channel._incoming.qsize() == channel.INCOMING_MAX
        assert (await asyncio.wait_for(channel.receive_audio(), 2))[0] == 2, "the oldest went first"
        monkeypatch.setattr(channel, "INCOMING_MAX_AGE_S", -1.0)
        station.emit_audio(channel.ref, 5, bytes([5]) * 800)
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(channel.receive_audio(), 0.2)
        await channel.close("ended")

    asyncio.run(scenario())


# ================================================================ F02: the router's two-way pump (the one downlink adapter)

class SocketDouble:
    def __init__(self) -> None:
        self.inbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.sent_bytes: list[bytes] = []
        self.sent_text: list[str] = []

    async def receive(self) -> dict[str, Any]:
        return await self.inbox.get()

    async def send_bytes(self, data: bytes) -> None:
        self.sent_bytes.append(data)

    async def send_text(self, text: str) -> None:
        self.sent_text.append(text)


class ChannelDouble:
    def __init__(self, *, listening: bool = True) -> None:
        self.audio: asyncio.Queue[bytes | Exception] = asyncio.Queue()
        self.frames: list[bytes] = []
        self.floors: list[bool] = []
        self.listening = listening
        self.receivers = 0
        self.closed: asyncio.Future[str] | None = None

    async def receive_audio(self) -> bytes:
        self.receivers += 1
        try:
            item = await self.audio.get()
        finally:
            self.receivers -= 1
        if isinstance(item, Exception):
            raise item
        return item

    async def send_frame(self, frame: bytes) -> None:
        self.frames.append(frame)

    async def floor(self, held: bool) -> None:
        self.floors.append(held)

    async def wait_closed(self) -> str:
        if self.closed is None:
            self.closed = asyncio.get_running_loop().create_future()
        return await self.closed


def session(seconds: float = 30) -> im.TalkSession:
    now = time.time()
    return im.TalkSession(id="s" * 24, station_id="entry-a", user_id="u1", username="op", request_id="r1", transport="pcmu_frames",
                          codec="pcmu", duplex="half", created_at=now, expires_at=now + seconds)


async def settle(predicate: Any, timeout: float = 2.0) -> None:
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > end:
            raise AssertionError("condition not reached in time")
        await asyncio.sleep(0.005)


def test_the_pump_carries_both_directions_at_once_and_checks_the_permission_before_every_packet():
    async def scenario() -> None:
        ws, ch, t = SocketDouble(), ChannelDouble(), session()
        lease = SimpleNamespace(denied=False)
        lease.should_stop = lambda: lease.denied
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        ws.inbox.put_nowait({"type": "websocket.receive", "text": json.dumps({"type": "talk/ptt", "value": "down"})})
        ws.inbox.put_nowait({"type": "websocket.receive", "bytes": bytes(160)})
        ch.audio.put_nowait(bytes([7]) * 800)
        await settle(lambda: ws.sent_bytes and ch.frames)
        assert ws.sent_bytes == [bytes([7]) * 800] and ch.frames == [bytes(160)] and ch.floors == [True], "talk and listen together"
        lease.denied = True
        ch.audio.put_nowait(bytes([8]) * 800)
        assert await asyncio.wait_for(task, 3) == "access_lost"
        assert ws.sent_bytes == [bytes([7]) * 800], "nothing is published after the permission is gone"
        assert ch.receivers == 0, "the adapter's receive task is joined"

    asyncio.run(scenario())


def test_the_pump_ends_the_talk_when_the_stations_sound_ends_and_names_expiry_and_stop_correctly():
    async def ended_sound() -> str:
        ws, ch, t = SocketDouble(), ChannelDouble(), session()
        task = asyncio.create_task(router_im._pump(ws, t, ch, SimpleNamespace(should_stop=lambda: False)))
        ch.audio.put_nowait(bridge.MediaBridgeError("connection_closed", "closed"))
        return await asyncio.wait_for(task, 3)

    async def stopped() -> str:
        ws, ch, t = SocketDouble(), ChannelDouble(), session()
        task = asyncio.create_task(router_im._pump(ws, t, ch, SimpleNamespace(should_stop=lambda: False)))
        await settle(lambda: ch.receivers == 1)
        t.stop_requested = "stopped"
        ch.audio.put_nowait(bytes(800))
        return await asyncio.wait_for(task, 3)

    async def expired() -> str:
        ws, ch, t = SocketDouble(), ChannelDouble(), session()
        task = asyncio.create_task(router_im._pump(ws, t, ch, SimpleNamespace(should_stop=lambda: False)))
        await settle(lambda: ch.receivers == 1)
        t.expires_at = time.time() - 1
        ch.audio.put_nowait(bytes(800))
        return await asyncio.wait_for(task, 3)

    assert asyncio.run(ended_sound()) == "upstream_closed"
    assert asyncio.run(stopped()) == "stopped"
    assert asyncio.run(expired()) == "expired"


def test_a_channel_without_the_stations_sound_talks_as_before_and_a_cancel_joins_everything():
    async def scenario() -> None:
        ws, t = SocketDouble(), session()
        ch = ChannelDouble(listening=False)
        task = asyncio.create_task(router_im._pump(ws, t, ch, SimpleNamespace(should_stop=lambda: False)))
        await asyncio.sleep(0.05)
        assert ch.receivers == 0, "a talk opened without `listen` never reads the station's sound"
        ws.inbox.put_nowait({"type": "websocket.disconnect"})
        assert await asyncio.wait_for(task, 3) == "ended"
        ch2 = ChannelDouble()
        task2 = asyncio.create_task(router_im._pump(SocketDouble(), session(), ch2, SimpleNamespace(should_stop=lambda: False)))
        await settle(lambda: ch2.receivers == 1)
        task2.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task2
        assert ch2.receivers == 0

    asyncio.run(scenario())


def test_the_downlink_adapter_for_a_talk_passes_whole_packets_and_keeps_only_three():
    async def scenario() -> None:
        queue: asyncio.Queue[bytes] = asyncio.Queue()
        for i in range(6):
            queue.put_nowait(bytes([i]) * 800)
        queue.put_nowait(bytes(160))  # not a packet of this stream: dropped
        downlink = ReceiveDownlink.for_talk(queue.get)
        await downlink.open()
        await asyncio.sleep(0.02)
        got = []
        while downlink._queue.qsize():
            got.append(await downlink._queue.get())
        assert [p[0] for p in got] == [3, 4, 5] and all(len(p) == 800 for p in got) and downlink.dropped_frames == 3
        await downlink.close("ended")

    asyncio.run(scenario())


# ================================================================ owner 25.10: full duplex; the talk permission is enough for the station's sound

def test_full_duplex_frames_flow_for_the_whole_open_session_while_the_station_sound_plays():
    """The microphone opens with the session (one `talk/ptt down`) and frames keep flowing while station packets arrive."""
    async def scenario() -> None:
        ws, ch, t = SocketDouble(), ChannelDouble(), session()
        task = asyncio.create_task(router_im._pump(ws, t, ch, SimpleNamespace(should_stop=lambda: False)))
        ws.inbox.put_nowait({"type": "websocket.receive", "text": json.dumps({"type": "talk/ptt", "value": "down"})})
        for i in range(20):
            ws.inbox.put_nowait({"type": "websocket.receive", "bytes": bytes([i]) * 160})
            if i % 5 == 0:
                ch.audio.put_nowait(bytes([i]) * 800)
        await settle(lambda: len(ch.frames) == 20 and len(ws.sent_bytes) >= 1)
        ws.inbox.put_nowait({"type": "websocket.receive", "text": json.dumps({"type": "talk/ptt", "value": "up"})})  # mute
        ws.inbox.put_nowait({"type": "websocket.receive", "bytes": bytes(160)})
        ch.audio.put_nowait(bytes([99]) * 800)
        await settle(lambda: ws.sent_bytes and ws.sent_bytes[-1][0] == 99)
        assert len(ch.frames) == 20 and ch.floors == [True, False], "muted: no frame reaches the station, its sound still plays"
        ws.inbox.put_nowait({"type": "websocket.disconnect"})
        assert await asyncio.wait_for(task, 3) == "ended"

    asyncio.run(scenario())


def test_the_stations_sound_in_a_talk_never_consults_the_separate_listen_setting(monkeypatch):
    """Owner 25.10: `access.call` (the talk permission) is enough; `access.station_listen` is not read on the talk path."""
    from smplwise.services import intercom_listen

    def forbidden(*_a: Any, **_k: Any) -> str:
        raise AssertionError("the talk path read access.station_listen")

    monkeypatch.setattr(intercom_listen, "listen_mode", forbidden)

    async def scenario() -> None:
        ws, ch, t = SocketDouble(), ChannelDouble(), session()
        task = asyncio.create_task(router_im._pump(ws, t, ch, SimpleNamespace(should_stop=lambda: False)))
        ch.audio.put_nowait(bytes([5]) * 800)
        await settle(lambda: ws.sent_bytes)
        ws.inbox.put_nowait({"type": "websocket.disconnect"})
        assert await asyncio.wait_for(task, 3) == "ended"

    asyncio.run(scenario())


def test_the_talk_lease_checks_the_talk_scope_and_the_media_setting_never_the_listen_setting(monkeypatch):
    """W031-295: the talk scope is what talk_start admitted - access.read AND access.call on the station (it was access.call alone)."""
    from contextlib import contextmanager

    from smplwise.services import intercom_authority as ia
    from smplwise.services import intercom_listen

    seen: list[tuple[str, str]] = []

    class Auth:
        def __init__(self, conn: Any, principal: Any) -> None:
            pass

        def station(self, permission: str, station_id: str) -> bool:
            seen.append((permission, station_id))
            return permission in (ia.READ, ia.CALL)

    @contextmanager
    def connection(**_kw: Any) -> Any:
        yield object()

    monkeypatch.setattr(router_im.ia, "Authority", Auth)
    monkeypatch.setattr(router_im.im, "media_mode", lambda conn: "video_talk")
    monkeypatch.setattr(intercom_listen, "listen_mode", lambda conn: (_ for _ in ()).throw(AssertionError("listen setting read")))
    lease = router_im.TalkLease.__new__(router_im.TalkLease)
    lease.db, lease.station_id = SimpleNamespace(connection=connection), "entry-a"
    lease.principal = SimpleNamespace(user_id="u1")
    assert lease.allowed_now() is True and seen == [(ia.READ, "entry-a"), (ia.CALL, "entry-a")]
