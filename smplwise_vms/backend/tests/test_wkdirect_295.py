"""WKDIRECT-295 (FAKES ONLY): Arx's client of WisKey's published direct API (DIRECT_API_V1.md, round-4 intake 3707f97fb), the S6 cut of the
unsigned W10 feed path, the published per-station talk limit, and the no-traffic lifetime rules WisKey measured.

Every WisKey here is a fake written from WisKey's published contracts: tests/w10_fake_direct.py (the direct socket) over
tests/w10_fake_station.py (the six W10 commands). The signing vector is WisKey's own synthetic one
(tests/fixtures/wiskey_direct/DIRECT_SIGNING_TEST_VECTOR.json; its key is public and synthetic, its timestamps are historical and prove the
computation only). Nothing here contacts a network, Home Assistant, a station, go2rtc or WisKey; nothing is installed or switched on."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sqlite3
import time
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from w10_fake_direct import FakeDirectServer, MemorySocket, mac
from w10_fake_station import SECRET, FakeStation

from smplwise.errors import ApiError
from smplwise.services import go2rtc as g2
from smplwise.services import ha_bridge
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_contract as w10
from smplwise.services.wiskey_talk_pump import TalkPump

VECTOR = json.loads((Path(__file__).parent / "fixtures" / "wiskey_direct" / "DIRECT_SIGNING_TEST_VECTOR.json").read_text(encoding="utf-8"))
W10_FIX = Path(__file__).parent / "fixtures" / "wiskey_w10"
ACTOR = w10.Actor("op-1", "Dana Operator")
FRAME = bytes(range(160))
STATION = {"id": "entry-a", "online": True, "camera_entity": "camera.entry_a"}
SOURCE_SECRETS = ("fixture-pass", "fixture-user", "station-a.invalid", "rtsp://", SECRET)
OPTS = {"frame_s": 0.01, "heartbeat_s": 0.2, "frame_timeout_s": 0.4, "floor_timeout_s": 1.0}


def run(coro: Any) -> Any:
    return asyncio.run(coro)


async def until(predicate: Any, timeout: float = 3.0) -> None:
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > end:
            raise AssertionError("condition not reached in time")
        await asyncio.sleep(0.005)


def overview() -> dict[str, Any]:
    doc = json.loads((W10_FIX / "overview_api.json").read_text(encoding="utf-8"))
    doc.pop("_note", None)
    return doc


def direct_for(server: FakeDirectServer, key: Any = SECRET, **kw: Any) -> bridge.DirectApiTransport:
    return bridge.DirectApiTransport(server.opener, lambda: key, **kw)


def ha_for(station: FakeStation, key: Any = SECRET) -> bridge.SignedBridgeTransport:
    async def connector(_purpose: str) -> Any:
        return station.connect()

    return bridge.SignedBridgeTransport(connector, bridge.BridgeSigner(lambda: key))


def no_secret(*texts: str) -> None:
    joined = "\n".join(texts)
    assert not any(s in joined for s in SOURCE_SECRETS), "a secret leaked"


# ================================================================ Q01: the signing vector, byte for byte

def test_the_published_signing_vector_is_reproduced_byte_for_byte():
    key = VECTOR["synthetic_test_key_only"]
    want = VECTOR["bridge"]
    body = bridge.connect_body(want["parameters"]["challenge"], want["ts"], window_s=15)
    # canonical JSON (sorted keys, compact, UTF-8, ensure_ascii=False) - the exact bytes
    canonical = bridge.canonical_json(body)
    assert canonical == VECTOR["canonical_utf8"].encode("utf-8")
    assert hashlib.sha256(canonical).hexdigest() == VECTOR["canonical_sha256"]
    assert f"{want['ts']}.{want['nonce']}.{VECTOR['canonical_sha256']}" == VECTOR["signing_preimage"]
    # the whole signed object through the existing recipe (ha_bridge.sign), the HMAC included
    signed = bridge.sign_connect(key, want["parameters"]["challenge"], now=want["ts"], nonce=want["nonce"], window_s=15)
    assert signed == want
    assert json.dumps(signed, sort_keys=True) == json.dumps(want, sort_keys=True)
    assert signed["sig"] == "ef70d23ac735b8c59b889d1f8bbb29073249b4924a356b51872d517d7f28b55e"
    assert ha_bridge.sign(key, body, ts=want["ts"], nonce=want["nonce"])["sig"] == want["sig"], "the existing recipe, unchanged"
    # the vector's own timestamps are historical: it proves the computation, not a currently valid command
    assert want["issued_at"] == "2026-10-24T07:30:00+00:00" and want["expires_at"] == "2026-10-24T07:30:15+00:00"


def test_the_connect_body_is_closed_and_a_rotated_or_missing_key_signs_nothing():
    with pytest.raises(bridge.MediaBridgeError):
        bridge.connect_body("not-a-challenge", 1_800_000_000)
    with pytest.raises(bridge.MediaBridgeError):
        bridge.connect_body("0123456789abcdef0123456789abcdef", 1_800_000_000, window_s=16)
    body = bridge.connect_body("0123456789abcdef0123456789abcdef", 1_800_000_000)
    assert set(body) == {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters"} and "kid" not in body
    for key, code in ((None, "bridge_not_paired"), ("", "bridge_not_paired"), (ha_bridge.BridgeKey("rotated-never-shown", "g1-abc"), "bridge_key_rotated")):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.sign_connect(key, "0123456789abcdef0123456789abcdef", now=1_800_000_000)
        assert exc.value.code == code and "rotated-never-shown" not in str(exc.value)


def test_the_reply_mac_matches_an_independent_implementation_and_keeps_number_types():
    frame = {"id": 7, "type": "result", "success": True, "result": {"level": 1.5, "count": 10, "name": "שער", "none": None}}
    ref = "0123456789abcdef0123456789abcdef"
    assert bridge.reply_mac(SECRET, ref, frame) == mac(SECRET, ref, frame)
    wire = json.loads(json.dumps({"kind": bridge.DIRECT_REPLY_KIND, "connection_ref": ref, "frame": frame, "sig": mac(SECRET, ref, frame)}))
    assert bridge.open_reply(SECRET, ref, wire) == frame, "a finite float in a business reply verifies (Python's own spelling)"
    # 10 and 10.0 are different JSON: the MAC tells them apart
    other = json.loads(json.dumps(wire).replace('"count": 10', '"count": 10.0'))
    with pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.open_reply(SECRET, ref, other)
    assert exc.value.code == "reply_unauthenticated"


@pytest.mark.parametrize("change", [
    lambda m: {**m, "sig": "0" * 64},
    lambda m: {**m, "connection_ref": "f" * 32},
    lambda m: {**m, "kind": "wiskey-direct-reply.v2"},
    lambda m: {k: v for k, v in m.items() if k != "sig"},
    lambda m: {**m, "extra": 1},
    lambda m: {**m, "frame": {**m["frame"], "success": False}},
    lambda m: m["frame"],  # the bare frame: markers alone are not authentication
    lambda m: {**m, "sig": m["sig"].upper()},
])
def test_any_reply_that_is_not_exactly_a_verified_wrapper_is_refused_before_it_is_read(change):
    ref = "0123456789abcdef0123456789abcdef"
    frame = {"id": 2, "type": "result", "success": True, "result": {"ok": True}}
    good = {"kind": bridge.DIRECT_REPLY_KIND, "connection_ref": ref, "frame": frame, "sig": mac(SECRET, ref, frame)}
    assert bridge.open_reply(SECRET, ref, good) == frame
    with pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.open_reply(SECRET, ref, change(good))
    assert exc.value.code == "reply_unauthenticated"
    with pytest.raises(bridge.MediaBridgeError):
        bridge.open_reply("another-pairing", ref, good)


# ================================================================ Q01: connect, identity, every frame verified, correlation

def test_connect_signs_the_challenge_without_any_home_assistant_identity_and_adopts_the_service_subject():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        transport = direct_for(server)
        link = await transport.connect(bridge.PURPOSE_VIDEO)
        dc = server.connections[0]
        msg = dc.connect_message
        assert set(msg) == {"id", "type", "bridge"} and msg["id"] == 1 and msg["type"] == "hikvision_intercom/direct/connect"
        proof = msg["bridge"]
        assert set(proof) == {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "ts", "nonce", "sig"}
        assert (proof["kind"], proof["command"], proof["query_owner_id"]) == ("wiskey-direct-connect.v1", "direct/connect", "pairing")
        assert proof["parameters"] == {"challenge": dc.challenge}
        # the server's identity, exactly as returned: a service subject (never a Home Assistant user), its repository, its connection_ref
        assert isinstance(link, bridge.DirectLink)
        assert link.query_owner_id == "arx-service:fixture-entry-1" and link.principal_kind == "pairing_service"
        assert link.repository_id == "repo-fixture-1" and link.connection_ref == dc.challenge
        assert transport.last_identity == {"query_owner_id": "arx-service:fixture-entry-1", "repository_id": "repo-fixture-1", "principal_kind": "pairing_service"}
        # a later command: the existing signed envelope and command name, the returned service id as query_owner_id, id 2
        desc = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", w10.SYSTEM_ACTOR, "arx-1"), timeout=2)
        assert desc["schema"] == w10.SCHEMA_V11
        sent = dc.messages[0]
        assert sent["id"] == 2 and sent["type"] == "hikvision_intercom/media/station_descriptor"
        assert sent["bridge"]["kind"] == "wiskey-bridge-command.v1" and sent["bridge"]["query_owner_id"] == "arx-service:fixture-entry-1"
        assert "api_contract" not in json.dumps(sent) and "access_token" not in json.dumps(msg)
        assert SECRET not in repr(link) + repr(transport) and dc.challenge not in repr(link)
        await link.close()
        await server.stop()

    run(scenario())


def test_ids_increase_strictly_and_each_answer_reaches_only_its_own_request():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        link = await direct_for(server).connect(bridge.PURPOSE_VIDEO)
        answers = await asyncio.gather(*(link.call(w10.DESCRIBE, w10.descriptor_params(sid, w10.SYSTEM_ACTOR, f"arx-{i}"), timeout=2)
                                         for i, sid in enumerate(("entry-a", "entry-b", "entry-c"))))
        assert [a["station_id"] for a in answers] == ["entry-a", "entry-b", "entry-c"]
        assert [m["id"] for m in server.connections[0].messages] == [2, 3, 4]
        await link.close()
        await server.stop()

    run(scenario())


def test_a_late_answer_or_an_unsolicited_frame_is_never_given_to_another_request():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        link = await direct_for(server).connect(bridge.PURPOSE_VIDEO)
        dc = server.connections[0]
        station.delays[w10.DESCRIBE] = 0.3
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", w10.SYSTEM_ACTOR, "arx-1"), timeout=0.05)
        assert (exc.value.code, exc.value.outcome) == ("media_outcome_unknown", "unknown")
        station.delays.clear()
        await asyncio.sleep(0.35)  # the late answer to id 2 arrives now and is dropped
        assert link.dropped_frames == 1
        # an unsolicited (validly signed) result and an event on an id that opened no talk are dropped too
        await dc.send_frame({"id": 99, "type": "result", "success": True, "result": {"forged": True}})
        await dc.send_frame({"id": 2, "type": "event", "event": {"type": "media/talk_closed", "talk_ref": "x" * 32, "reason": "ended"}})
        seen: list[Any] = []
        link.set_event_handler(seen.append)
        await until(lambda: link.dropped_frames == 3)
        answer = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-b", w10.SYSTEM_ACTOR, "arx-2"), timeout=2)
        assert answer["station_id"] == "entry-b" and not seen and len(station.by_command(w10.DESCRIBE)) == 2, "nothing was re-sent"
        await link.close()
        await server.stop()

    run(scenario())


def test_one_forged_or_unwrapped_frame_closes_the_connection_and_the_request_in_flight_is_unknown(caplog):
    async def scenario(tamper: Any) -> tuple[str, str, bool]:
        station = FakeStation()
        server = FakeDirectServer(station)
        link = await direct_for(server).connect(bridge.PURPOSE_VIDEO)
        server.tamper = tamper
        closed: list[bool] = []
        link.set_closed_handler(lambda: closed.append(True))
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", w10.SYSTEM_ACTOR, "arx-1"), timeout=2)
        await until(lambda: link.closed)
        await server.stop()
        return exc.value.code, exc.value.outcome, bool(closed)

    forged = lambda m: {**m, "frame": {**m["frame"], "result": {"schema": "forged"}}}  # noqa: E731 - the MAC no longer matches
    bare = lambda m: m["frame"]  # noqa: E731 - the frame alone, without the wrapper
    foreign = lambda m: {**m, "connection_ref": "a" * 32, "sig": mac(SECRET, "a" * 32, m["frame"])}  # noqa: E731 - another connection's ref
    with caplog.at_level(logging.DEBUG):
        for tamper in (forged, bare, foreign):
            assert run(scenario(tamper)) == ("reply_unauthenticated", "unknown", True)
    no_secret(caplog.text)
    assert "forged" not in caplog.text


@pytest.mark.parametrize("case, code", [
    ("refuse_open", "direct_unreachable"),
    ("bad_hello", "direct_hello_invalid"),
    ("wrong_protocol", "direct_hello_invalid"),
    ("wrong_key", "direct_connect_refused"),
    ("bad_identity_kind", "direct_identity_invalid"),
    ("bad_identity_ref", "direct_identity_invalid"),
    ("ha_user_identity", "direct_identity_invalid"),
    ("forged_connect_reply", "reply_unauthenticated"),
])
def test_a_connection_that_does_not_authenticate_is_refused_and_nothing_else_is_sent(case, code):
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        key = SECRET
        if case == "refuse_open":
            server.refuse_open = True
        elif case == "bad_hello":
            server.hello_override = {"type": "hello", "protocol": "wiskey-direct-ws.v1", "challenge": "short"}
        elif case == "wrong_protocol":
            server.hello_override = {"type": "hello", "protocol": "wiskey-direct-ws.v2", "challenge": "0" * 32}
        elif case == "wrong_key":
            key = "not-the-pairing-code"  # WisKey closes a refused connect without a word
        elif case == "bad_identity_kind":
            server.identity_override = {"principal_kind": "user"}
        elif case == "bad_identity_ref":
            server.identity_override = {"connection_ref": "f" * 32}
        elif case == "ha_user_identity":
            server.identity_override = {"query_owner_id": "0123abcd-ha-user-id"}
        elif case == "forged_connect_reply":
            server.tamper = lambda m: {**m, "sig": "1" * 64}
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await direct_for(server, key=key).connect(bridge.PURPOSE_TALK)
        assert exc.value.code == code and exc.value.outcome in ("closed", "refused")
        assert all(not dc.messages for dc in server.connections), "no command after a failed connect"
        assert all(dc.sock.closed or dc.sock.peer.closed for dc in server.connections)
        await server.stop()

    run(scenario())


def test_a_hello_that_never_comes_times_out_and_no_key_opens_no_socket():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        server.hello_delay = 1.0
        transport = direct_for(server)
        transport.HELLO_TIMEOUT_S = 0.05
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await transport.connect(bridge.PURPOSE_VIDEO)
        assert exc.value.code == "direct_hello_timeout"
        for key, code in ((None, "bridge_not_paired"), (ha_bridge.BridgeKey("x" * 20, "g1-abc"), "bridge_key_rotated")):
            before = server.opened
            with pytest.raises(bridge.MediaBridgeError) as exc:
                await direct_for(server, key=key).connect(bridge.PURPOSE_VIDEO)
            assert exc.value.code == code and server.opened == before, "nothing is opened without a key that signs"
        await server.stop()

    run(scenario())


def test_the_real_opener_dials_core_with_no_token_no_header_and_no_query(settings, monkeypatch):
    import websockets

    seen: dict[str, Any] = {}

    async def fake_connect(url: str, **kw: Any) -> Any:
        seen["url"], seen["kw"] = url, kw
        return MemorySocket()

    monkeypatch.setattr(websockets, "connect", fake_connect)
    run(bridge.websocket_opener(replace(settings, ha_core_url="http://core.invalid:8123"))())
    assert seen["url"] == "ws://core.invalid:8123/api/hikvision_intercom/arx_bridge/v1/ws"
    assert "?" not in seen["url"] and not ({"additional_headers", "extra_headers"} & set(seen["kw"])) and "ssl" not in seen["kw"]
    assert seen["kw"]["max_size"] == bridge.DIRECT_MAX_FRAME_BYTES
    run(bridge.websocket_opener(replace(settings, ha_core_url="https://core.invalid:8123"))())
    assert seen["url"].startswith("wss://core.invalid:8123/api/hikvision_intercom/") and "ssl" in seen["kw"]


# ================================================================ Q01: the runtime selection (auto)

def test_auto_uses_the_direct_api_when_it_authenticates_and_the_signed_home_assistant_path_otherwise():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        clock = {"t": 0.0}
        auto = bridge.AutoTransport(direct_for(server), ha_for(station), clock=lambda: clock["t"])
        link = await auto.connect(bridge.PURPOSE_VIDEO)
        assert auto.last_kind == "direct_api" and isinstance(link, bridge.DirectLink)
        await link.close()
        server.refuse_open = True  # the direct socket is not there (an older WisKey, a network rule)
        link = await auto.connect(bridge.PURPOSE_VIDEO)
        assert auto.last_kind == "signed_bridge_ws" and auto.last_direct_error == "direct_unreachable"
        await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", w10.SYSTEM_ACTOR, "arx-1"), timeout=2)
        assert station.by_command(w10.DESCRIBE)[-1].params["actor"]["id"] == "arx" and station.conns[-1].user_id == "ha-user-1", "signed on the HA path"
        server.refuse_open = False
        opened = server.opened
        await auto.connect(bridge.PURPOSE_VIDEO)
        assert server.opened == opened and auto.last_kind == "signed_bridge_ws", "the direct API is not hammered inside the retry window"
        clock["t"] += auto.RETRY_DIRECT_S
        await auto.connect(bridge.PURPOSE_TALK)
        assert auto.last_kind == "direct_api"
        await server.stop()

    run(scenario())


def test_auto_without_a_key_that_signs_tries_neither_path():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        auto = bridge.AutoTransport(direct_for(server, key=None), ha_for(station, key=None))
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await auto.connect(bridge.PURPOSE_VIDEO)
        assert exc.value.code == "bridge_not_paired" and server.opened == 0 and station.conns == [], "no unsigned fallback exists"
        await server.stop()

    run(scenario())


def conn_with(**values: str) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    for key, value in values.items():
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (key, value))
    return conn


def test_provider_for_auto_requires_the_signed_path_and_builds_the_auto_transport(settings, monkeypatch):
    from smplwise.services import intercom_sync

    im.set_provider(None)
    im._bridge = None
    monkeypatch.delenv(im.FAKE_ENV, raising=False)
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: overview())
    auto = conn_with(**{im.PROVIDER_KEY: "auto"})
    key: dict[str, Any] = {"value": None}
    monkeypatch.setattr(im._CachedKey, "__call__", lambda self: key["value"])
    assert im.provider_for(settings, auto).name == "local", "no pairing key: Arx's own source, never an unsigned WisKey path"
    key["value"] = ha_bridge.BridgeKey("rotated-material", "g1-abc")
    assert im.provider_for(settings, auto).name == "local", "a rotated key cannot sign: Arx's own source"
    key["value"] = SECRET
    chosen = im.provider_for(settings, auto)
    assert isinstance(chosen, im.WiskeyBridgeProvider) and chosen.media.kind == "auto"
    assert isinstance(chosen.media.direct, bridge.DirectApiTransport) and isinstance(chosen.media.fallback, bridge.SignedBridgeTransport)
    assert im.provider_for(settings, conn_with(**{im.PROVIDER_KEY: "local"})).name == "local"
    chosen.video.close()
    im._bridge = None


# ================================================================ Q06: W10 over the direct API (video as Arx, a connection per talk as the operator)

@pytest.fixture()
def media_settings(settings):
    return replace(settings, go2rtc_url="http://go2rtc.invalid:1984")


@pytest.fixture()
def registered(monkeypatch):
    calls: list[tuple[str, str]] = []

    def frame_jpeg(self, name: str, src: str) -> bytes:
        calls.append((name, src))
        with g2._REGISTERED_LOCK:
            g2._REGISTERED[name] = hashlib.sha256(src.encode()).hexdigest()
        return b"\xff\xd8\xff"

    monkeypatch.setattr(g2.Go2rtc, "frame_jpeg", frame_jpeg)
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)
    yield calls
    with g2._REGISTERED_LOCK:
        for name in [n for n in g2._REGISTERED if n.startswith("smplwise_wiskey_entry-a")]:
            g2._REGISTERED.pop(name)


class Direct:
    """A provider on the direct API of a fake WisKey. The fake server's tasks live on whichever loop opens a socket (the video
    connection on the provider's LoopThread, a talk on the test's own loop)."""

    def __init__(self, **pump: Any) -> None:
        self.station = FakeStation()
        self.server = FakeDirectServer(self.station)
        self.provider = im.WiskeyBridgeProvider(bridge.AutoTransport(direct_for(self.server), ha_for(self.station)),
                                                discovery=lambda _s: overview(), pump_options={**OPTS, **pump})

    def close(self) -> None:
        self.provider.video.close()
        im.set_provider(None)
        im.MEDIA.reset()


@pytest.fixture()
def direct():
    d = Direct()
    im.set_provider(d.provider)
    yield d
    d.close()


def test_video_reads_the_descriptor_and_the_lease_as_arx_on_one_direct_connection_and_registers_the_source_in_memory(direct, media_settings, registered, caplog):
    with caplog.at_level(logging.DEBUG):
        name = direct.provider.video_stream(None, media_settings, STATION, "main", actor=w10.Actor("someone-else", "Someone Else"))
    assert name.startswith("smplwise_wiskey_entry-a.w10.") and len(registered) == 1 and registered[0][0] == name
    describe, lease = direct.station.by_command(w10.DESCRIBE)[0], direct.station.by_command(w10.STREAM_LEASE)[0]
    assert describe.conn == lease.conn and len(direct.server.connections) == 1, "descriptor and lease on one direct connection"
    assert describe.params["actor"] == lease.params["actor"] == {"id": "arx", "display_name": "Arx"}, "the video actor is Arx, never the operator"
    assert direct.station.conns[0].user_id == "arx-service:fixture-entry-1", "commands carry the service subject, not a Home Assistant user"
    no_secret(caplog.text, repr(direct.provider), name)


def test_a_reopened_direct_connection_adopts_nothing_old_and_costs_one_fresh_descriptor(direct, media_settings, registered):
    direct.provider.video_stream(None, media_settings, STATION, "main")
    first = direct.server.connections[0]
    run_on = direct.provider.video.runner
    run_on.run(first.sock.close(), 5)  # WisKey drops the socket (stop, pairing replacement, 24 h expiry)
    time.sleep(0.05)
    name = direct.provider.video_stream(None, media_settings, STATION, "main")
    assert name.startswith("smplwise_wiskey_entry-a.w10.") and len(direct.server.connections) == 2
    second = direct.server.connections[1]
    assert second.challenge != first.challenge, "a new challenge, a new connection_ref, a new resource owner"
    leases = direct.station.by_command(w10.STREAM_LEASE)
    assert [r.conn for r in leases] == [1, 2, 2], "the old descriptor is refused on the new connection, then one fresh descriptor and one lease"
    assert [r.conn for r in direct.station.by_command(w10.DESCRIBE)] == [1, 2]


def talk_channel(provider: im.WiskeyBridgeProvider, settings: Any, **kw: Any) -> im.WiskeyBridgeTalkChannel:
    d = provider.describe(None, settings, STATION)
    channel = provider.talk_open(settings, "entry-a", d, actor_id=kw.get("actor_id", "op-1"), actor_name=kw.get("actor_name", "Dana Operator"),
                                 request_id=kw.get("request_id", "req-123"), expires_at=kw.get("expires_at", time.time() + 120))
    assert isinstance(channel, im.WiskeyBridgeTalkChannel)
    return channel


def test_a_talk_gets_its_own_direct_connection_as_the_operator_with_floor_first_batches_from_zero_and_one_close(direct, media_settings):
    async def scenario() -> None:
        channel = talk_channel(direct.provider, media_settings)
        await channel.open()
        await channel.floor(True)
        for _ in range(12):
            await channel.send_frame(FRAME)
            await asyncio.sleep(0.01)
        await until(lambda: sum(c for _t, _f, c in direct.station.batches) >= 10)
        await channel.floor(False)
        await channel.close("stopped")
        assert await channel.wait_closed() in ("stopped", "upstream_closed")

    run(scenario())
    talk_dc = direct.server.connections[1]
    commands = [m["type"].removeprefix("hikvision_intercom/") for m in talk_dc.messages]
    assert commands[:3] == [w10.DESCRIBE, w10.TALK_OPEN, w10.TALK_FLOOR] and commands[-1] == w10.TALK_CLOSE
    assert all(m["bridge"]["query_owner_id"] == "arx-service:fixture-entry-1" for m in talk_dc.messages)
    assert [m["id"] for m in talk_dc.messages] == list(range(2, 2 + len(talk_dc.messages)))
    describe_actor = talk_dc.messages[0]["bridge"]["parameters"]["actor"]
    assert describe_actor == {"id": "op-1", "display_name": "Dana Operator"} == talk_dc.messages[1]["bridge"]["parameters"]["actor"]
    assert [(first, count) for _t, first, count in direct.station.batches][:2] == [(0, 5), (5, 5)], "sequence from 0, batches of 5"
    frames = [m for m in talk_dc.messages if m["type"].endswith("talk_frame")]
    assert all(len(m["bridge"]["parameters"]["frames"]) in (5, 10) for m in frames), "every batch is signed and 5 or 10 frames"
    assert not direct.station.talks and not direct.station.station_talk, "the station lock is released"


def test_batches_of_ten_are_signed_and_accepted_too():
    # a batch of 10 costs both credits of the station's bucket (capacity 2, 10 per second): at exactly real time it has no slack, so the
    # fake is paced a little slower here (finding: Arx keeps batches of 5 as its default - one batch of slack against timer jitter)
    d = Direct(batch=10, frame_s=0.025)
    im.set_provider(d.provider)
    try:
        async def scenario() -> None:
            channel = talk_channel(d.provider, replace_settings())
            await channel.open()
            await channel.floor(True)
            for _ in range(20):
                await channel.send_frame(FRAME)
                await asyncio.sleep(0.003)
            await until(lambda: sum(c for _t, _f, c in d.station.batches) >= 20)
            await channel.close("stopped")

        run(scenario())
        assert [(f, c) for _t, f, c in d.station.batches][:2] == [(0, 10), (10, 10)]
    finally:
        d.close()


_SETTINGS: dict[str, Any] = {}


def replace_settings() -> Any:
    return _SETTINGS["value"]


@pytest.fixture(autouse=True)
def _keep_settings(media_settings):
    _SETTINGS["value"] = media_settings
    yield


def test_wiskeys_signed_talk_closed_arrives_on_the_talk_open_id_and_ends_the_talk_without_a_close(direct, media_settings):
    async def scenario() -> str:
        channel = talk_channel(direct.provider, media_settings)
        await channel.open()
        talk_dc = direct.server.connections[1]
        open_id = next(m["id"] for m in talk_dc.messages if m["type"].endswith("talk_open"))
        assert channel.link.event_ids == {open_id}
        direct.station.emit_closed(direct.station.talks[channel.ref], "source_changed")
        reason = await asyncio.wait_for(channel.wait_closed(), 2)
        await channel.close(reason)
        return reason

    assert run(scenario()) == "upstream_closed"
    assert direct.station.by_command(w10.TALK_CLOSE) == []


def test_after_a_dropped_talk_connection_the_next_talk_starts_clean_and_never_reuses_the_old_talk(direct, media_settings):
    async def scenario() -> None:
        channel = talk_channel(direct.provider, media_settings)
        await channel.open()
        old_ref = channel.ref
        await direct.server.connections[1].sock.close()
        assert await asyncio.wait_for(channel.wait_closed(), 2) == "upstream_closed"
        await channel.close("upstream_closed")
        again = talk_channel(direct.provider, media_settings)
        await again.open()
        assert again.ref != old_ref and again.link is not channel.link
        third = direct.server.connections[2]
        assert all(old_ref not in json.dumps(m) for m in third.messages), "the old talk_ref is never sent on the new connection"
        await again.close("stopped")

    run(scenario())


# ================================================================ Q06 / S6: no unsigned path is left

def test_no_channel_lets_a_w10_command_through_and_the_feed_has_no_media_path():
    from smplwise.services import intercom_client, intercom_sync, wiskey_channels

    for channel in wiskey_channels.ALLOWLISTS:
        assert not any(wiskey_channels.allowed(channel, intercom_client.command_type(c)) for c in w10.COMMANDS), channel
    assert "media" not in wiskey_channels.ALLOWLISTS and "media" not in wiskey_channels.ADAPTER_CHANNELS
    with pytest.raises(ValueError):
        wiskey_channels.guard(lambda *a, **k: None, "media")
    assert wiskey_channels.W10_COMMANDS == frozenset(w10.COMMANDS)
    assert not hasattr(intercom_sync.IntercomSync, "media_post") and not hasattr(intercom_sync, "_media_hook")
    for gone in ("WiskeyProvider", "SyncTransport", "WiskeyTalkChannel", "WISKEY_TALKS", "on_wiskey_event", "_wiskey"):
        assert not hasattr(im, gone), gone
    for gone in ("station_descriptor", "stream_lease", "talk_open", "talk_frame", "talk_floor", "talk_close"):
        assert not hasattr(w10, gone), gone  # the unsigned flat-frame senders


# ================================================================ Q06 item 6: the station's published talk limit

@pytest.mark.parametrize("published, setting, effective", [
    (60, None, 60), (300, None, 300), (600, None, 300), (600, "900", 600), (3600, "3600", 3600), (86400, "86400", 86400), (1, "300", 1),
])
def test_the_published_station_limit_and_the_arx_setting_give_the_smaller_with_no_180_clamp(direct, media_settings, published, setting, effective):
    direct.station.max_talk_s = published
    d = im.MEDIA.descriptor(direct.provider, None, media_settings, STATION)
    assert d.max_talk_seconds == published and d.talk
    values = {im.TALK_MAX_KEY: setting} if setting is not None else {}
    assert im.talk_limit_s(conn_with(**values), d) == effective


def test_a_talk_open_asks_for_no_more_than_the_station_publishes(direct, media_settings):
    direct.station.max_talk_s = 60

    async def scenario() -> None:
        channel = talk_channel(direct.provider, media_settings, expires_at=time.time() + 3600)
        await channel.open()
        opened = direct.station.by_command(w10.TALK_OPEN)[-1].params
        until_s = im._iso(opened["expires_at"], "expires_at") - time.time()
        assert 50 <= until_s <= 61, "capped by the station's own 60 s"
        await channel.close("stopped")

    run(scenario())


# ================================================================ Q06 item 7: WisKey's measured no-traffic lifetimes, on the client

SCALE = 0.1  # 1 simulated second = 0.1 s


async def _lifetime(window_s: int, heartbeat_s: float, run_for: float | None = None) -> dict[str, Any]:
    station = FakeStation()
    station.idle_s = 12.0 * SCALE
    server = FakeDirectServer(station, scale=SCALE)
    server.lifetime_rules = True
    link = await direct_for(server, window_s=window_s).connect(bridge.PURPOSE_TALK)
    events: list[dict[str, Any]] = []
    desc = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-d"), timeout=2)
    opened = await link.call(w10.TALK_OPEN, w10.talk_open_params(desc["session"], ACTOR, "arx-t", im._ts(time.time() + 120)), timeout=2)
    ended: list[str] = []
    pump = TalkPump(link, opened["talk_ref"], on_end=ended.append, frame_s=0.01, heartbeat_s=heartbeat_s, frame_timeout_s=0.5, floor_timeout_s=1.0)

    def on_event(event: dict[str, Any]) -> None:
        events.append(event)
        hit = w10.talk_closed_v11(event)
        if hit is not None and hit[0] == opened["talk_ref"]:
            pump.remote_closed(hit[1])

    link.set_event_handler(on_event)
    pump.start()
    dc = server.connections[0]
    if run_for is not None:
        await asyncio.sleep(run_for)
    else:
        await until(lambda: dc.closures, timeout=5)
        await asyncio.sleep(0.05)
    out: dict[str, Any] = {
        "window_s": window_s, "client_heartbeat_s": heartbeat_s / SCALE if heartbeat_s < 1000 else None,
        "server_closures": [{"reason": c["reason"], "elapsed_s": round(c["elapsed"] / SCALE, 2), "signed_event_sent": c["event"]} for c in dc.closures],
        "client_events_received": [e.get("reason") for e in events],
        "lock_released": not station.station_talk, "journal_empty": not station.talks,
        "heartbeats": pump.heartbeats, "client_ended": list(ended), "client_end_code": pump.end_code,
    }
    await pump.stop()
    await link.close()
    await server.stop()
    return out


def test_wiskeys_ttl10_and_ttl15_no_traffic_measurements_are_what_the_client_meets(capsys):
    results: dict[str, Any] = {}
    results["TTL10_no_heartbeat"] = run(_lifetime(window_s=10, heartbeat_s=10_000.0))
    results["TTL15_no_heartbeat"] = run(_lifetime(window_s=15, heartbeat_s=10_000.0))
    results["TTL10_heartbeat_5s"] = run(_lifetime(window_s=10, heartbeat_s=5.0 * SCALE, run_for=30.0 * SCALE))
    results["TTL15_heartbeat_5s"] = run(_lifetime(window_s=15, heartbeat_s=5.0 * SCALE, run_for=30.0 * SCALE))
    print("WKDIRECT-295 lifetime simulation (scaled x%.2f; seconds below are simulated seconds):" % SCALE)
    print(json.dumps(results, indent=2, ensure_ascii=False))

    t10 = results["TTL10_no_heartbeat"]
    [c10] = t10["server_closures"]
    assert c10["reason"] == "access_lost" and c10["signed_event_sent"] is False and 9.8 <= c10["elapsed_s"] <= 11.0
    assert t10["client_events_received"] == [] and t10["lock_released"] and t10["journal_empty"]
    t15 = results["TTL15_no_heartbeat"]
    [c15] = t15["server_closures"]
    assert c15["reason"] == "idle_timeout" and c15["signed_event_sent"] is True and 11.8 <= c15["elapsed_s"] <= 13.2
    assert t15["client_events_received"] == ["idle_timeout"] and t15["client_end_code"] == "idle_timeout" and t15["lock_released"]
    for name in ("TTL10_heartbeat_5s", "TTL15_heartbeat_5s"):
        alive = results[name]
        assert alive["server_closures"] == [] and alive["heartbeats"] >= 4 and alive["client_ended"] == [], name


def test_ttl10_without_traffic_ends_quietly_and_the_clients_next_request_is_refused_not_retried():
    async def scenario() -> None:
        station = FakeStation()
        station.idle_s = 12.0 * SCALE
        server = FakeDirectServer(station, scale=SCALE)
        server.lifetime_rules = True
        link = await direct_for(server, window_s=10).connect(bridge.PURPOSE_TALK)
        desc = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-d"), timeout=2)
        opened = await link.call(w10.TALK_OPEN, w10.talk_open_params(desc["session"], ACTOR, "arx-t", im._ts(time.time() + 120)), timeout=2)
        ended: list[str] = []
        pump = TalkPump(link, opened["talk_ref"], on_end=ended.append, frame_s=0.01, heartbeat_s=10_000.0, frame_timeout_s=0.5, floor_timeout_s=1.0)
        pump.start()
        await until(lambda: server.connections[0].closures, timeout=5)
        assert not ended, "no event: the client is not told"
        before = len(station.requests)
        await pump.set_floor(True)  # the operator presses: the request is signed, sent once, refused
        await until(lambda: ended)
        assert pump.end_code == "session_expired" and len(station.requests) == before + 1
        await asyncio.sleep(0.1)
        assert len(station.requests) == before + 1, "never retried"
        await pump.stop()
        await link.close()
        await server.stop()

    run(scenario())


def test_a_batch_queued_before_the_release_is_sent_whole_then_the_floor_and_a_later_frame_is_floor_not_held():
    async def scenario() -> None:
        station = FakeStation()
        server = FakeDirectServer(station)
        link = await direct_for(server).connect(bridge.PURPOSE_TALK)
        desc = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-d"), timeout=2)
        opened = await link.call(w10.TALK_OPEN, w10.talk_open_params(desc["session"], ACTOR, "arx-t", im._ts(time.time() + 60)), timeout=2)
        pump = TalkPump(link, opened["talk_ref"], on_end=lambda _r: None, **OPTS)
        pump.start()
        await pump.set_floor(True)
        for _ in range(7):
            pump.push(FRAME)
        await pump.set_floor(False)
        order = [m["type"].removeprefix("hikvision_intercom/") for m in server.connections[0].messages][2:]
        assert order == [w10.TALK_FLOOR, w10.TALK_FRAME, w10.TALK_FRAME, w10.TALK_FLOOR]
        assert [(f, c) for _t, f, c in station.batches] == [(0, 5), (5, 5)] and pump.padded_frames == 3
        pump.push(FRAME)
        assert pump.dropped_not_held == 1, "after the release the client drops it"
        with pytest.raises(bridge.MediaBridgeError) as exc:  # and the station would refuse it anyway
            await link.call(w10.TALK_FRAME, w10.talk_frame_params(opened["talk_ref"], 10, [FRAME] * 5), timeout=2)
        assert exc.value.code == "floor_not_held"
        await pump.stop()
        await link.close()
        await server.stop()

    run(scenario())


# ================================================================ ported from test_wiskey_media_provider.py (the retired unsigned provider's suite)
# WKDIRECT-295 (S6) removed `WiskeyProvider` and its feed transport. What that suite proved about selection, the M-3 fallback and the S18
# endpoints is proved here again on the signed provider over the direct API; its unsigned-transport cases have nothing left to test.

from conftest import as_user, bind  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: E402,F401 - fixtures

MEDIA_URL = "/api/v1/access-control/stations/{}/media"
TALK_URL = "/api/v1/access-control/stations/{}/talk"


def test_discovery_decides_what_wiskey_offers():
    from smplwise.services import intercom_client

    api = overview()
    assert w10.listed(api) == (True, True, None)
    assert w10.listed({**api, "commands": [c for c in api["commands"] if c != w10.TALK_FLOOR]}) == (True, False, None)
    assert w10.listed({**api, "commands": [c for c in api["commands"] if c != w10.STREAM_LEASE]}) == (False, False, "not_listed")
    assert w10.listed({**api, "commands": [intercom_client.command_type(c) for c in w10.COMMANDS]})[:2] == (True, True)
    assert w10.listed(None) == (False, False, "discovery_unknown")
    assert w10.listed({**api, "commands": "media/station_descriptor media/stream_lease"}) == (False, False, "commands_unknown")


def test_m3_wiskey_is_selected_only_by_the_arx_setting_and_only_while_discovery_lists_it(settings, monkeypatch):
    from smplwise.services import intercom_sync

    im.set_provider(None)
    im._bridge = None
    monkeypatch.delenv(im.FAKE_ENV, raising=False)
    monkeypatch.setattr(im._CachedKey, "__call__", lambda self: SECRET)
    api: dict[str, Any] = {"value": overview()}
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: api["value"])
    for conn in (None, conn_with(), conn_with(**{im.PROVIDER_KEY: "local"}), conn_with(**{im.PROVIDER_KEY: "bogus"})):
        assert im.provider_for(settings, conn).name == "local"
    auto = conn_with(**{im.PROVIDER_KEY: "auto"})
    assert im.provider_for(settings, auto).name == "wiskey"
    api["value"] = {**api["value"], "commands": ["overview", w10.DESCRIBE]}
    assert im.provider_for(settings, auto).name == "local", "the descriptor alone is not enough"
    api["value"] = None
    assert im.provider_for(settings, auto).name == "local", "no discovery: Arx's own source"
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: (_ for _ in ()).throw(RuntimeError("boom")))
    assert im.provider_for(settings, auto).name == "local", "an unreadable discovery keeps Arx's own source"
    if im._bridge is not None:
        im._bridge.video.close()
    im._bridge = None


def test_m3_a_failing_wiskey_descriptor_falls_back_to_arxs_own_source_and_an_offline_station_does_not(direct, media_settings, monkeypatch):
    local = im.parse_descriptor({"schema": im.SCHEMA, "station_id": "entry-a", "session": "local-" + "a" * 24, "issued_at": im.iso(time.time()),
                                 "expires_at": im.iso(time.time() + 600), "video": {"profiles": [{"id": "main", "transports": ["mse"]}]}},
                                station_id="entry-a", provider="local")
    monkeypatch.setattr(im._local, "describe", lambda conn, s, st: local)
    for code in ("media_not_supported", "rate_limited", "something_new"):
        direct.station.errors[w10.DESCRIBE] = code
        im.MEDIA.reset()
        d = im.MEDIA.descriptor(direct.provider, None, media_settings, STATION)
        assert d.provider == "local" and not d.talk, code
        with pytest.raises(ApiError) as e:
            direct.provider.talk_open(media_settings, "entry-a", d, actor_id="u1", actor_name="Dana", request_id=None)
        assert e.value.code == "intercom_talk_unsupported"
    direct.station.errors[w10.DESCRIBE] = "station_offline"
    im.MEDIA.reset()
    with pytest.raises(im.Unavailable) as u:
        im.MEDIA.descriptor(direct.provider, None, media_settings, STATION)
    assert u.value.code == "offline"


def _mode(c: Any, value: str) -> None:
    assert c.patch("/api/v1/settings", json={"access.station_media": value}).status_code == 200


def _audit(s: Any, action: str) -> list[dict[str, Any]]:
    from smplwise.db import Database

    with Database(s.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


@pytest.fixture()
def direct_s18():
    d = Direct()
    im.set_provider(d.provider)
    yield d
    d.close()


def test_the_media_read_on_the_direct_provider_serves_the_same_projection_and_no_handle(feed, fake_go2rtc, direct_s18):  # noqa: F811
    c, s = camera_feed(feed)
    _mode(c, "video_talk")
    body = c.get(MEDIA_URL.format("entry-a")).json()
    assert body["state"] == "ready" and [p["id"] for p in body["video"]["profiles"]] == ["main"] and body["talk"]["available"] is True
    assert set(body) == {"station_id", "mode", "state", "reason", "video", "talk", "listen", "expires_at"}
    text = json.dumps(body)
    assert "arx-service" not in text and direct_s18.server.connections[0].challenge not in text
    no_secret(text)


def test_a_talk_end_to_end_through_the_s18_socket_on_the_direct_api(feed, fake_go2rtc, direct_s18):  # noqa: F811
    c, s = camera_feed(feed)
    _mode(c, "video_talk")
    t = c.post(TALK_URL.format("entry-a"), json={"client_request_id": "ptt-0001-abcd"}).json()
    frame = b"\x7f" * 160
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "down"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/floor", "value": "held"}
        ws.send_bytes(frame)
        ws.send_bytes(frame)
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "up"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/floor", "value": "released"}
        ws.send_text(json.dumps({"type": "talk/stop"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "stopped"}
    opened = direct_s18.station.by_command(w10.TALK_OPEN)
    assert len(opened) == 1 and opened[0].params["actor"]["id"] == "dev-joni" and opened[0].params["request_id"] == "ptt-0001-abcd"
    assert [(f, n) for _t, f, n in direct_s18.station.batches] == [(0, 5)], "two frames and three of silence: one signed batch from 0"
    assert [r.params["reason"] for r in direct_s18.station.by_command(w10.TALK_CLOSE)] == ["stopped"]
    talk_conn = opened[0].conn
    assert all(r.conn == talk_conn for r in direct_s18.station.requests if r.command in (w10.TALK_OPEN, w10.TALK_FRAME, w10.TALK_FLOOR, w10.TALK_CLOSE))
    assert direct_s18.station.conns[talk_conn - 1].user_id == "arx-service:fixture-entry-1"
    [end] = _audit(s, "intercom.talk.end")
    details = json.loads(end["details_json"])
    assert details["outcome"] == "stopped" and end["request_id"] == "ptt-0001-abcd" and "data" not in details


def test_a_busy_station_on_the_direct_api_reaches_the_browser_as_busy(feed, fake_go2rtc, direct_s18):  # noqa: F811
    c, s = camera_feed(feed)
    _mode(c, "video_talk")
    direct_s18.station.errors[w10.TALK_OPEN] = "audio_busy"
    t = c.post(TALK_URL.format("entry-a")).json()
    with pytest.raises(WebSocketDisconnect) as gone:
        with c.websocket_connect(f"/{t['ws_path']}") as ws:
            assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "busy"}
            ws.receive_text()
    assert gone.value.code == 4423
    assert not direct_s18.station.by_command(w10.TALK_CLOSE), "nothing was opened, so nothing is closed"


def test_a_viewer_without_the_call_permission_never_reaches_the_talk_commands(feed, fake_go2rtc, direct_s18):  # noqa: F811
    c, s = camera_feed(feed)
    _mode(c, "video_talk")
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.post(TALK_URL.format("entry-a"), headers=as_user("vera")).status_code == 403
    assert not direct_s18.station.by_command(w10.TALK_OPEN)