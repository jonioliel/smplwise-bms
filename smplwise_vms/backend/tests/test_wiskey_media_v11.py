"""W10CLIENT-295: Arx's client of WisKey's W10 contract v1.1 (signed bridge), tested on FAKES only.

What this file proves: the contract tables and readers (fixtures derived from WisKey's published parameter schemas), the signed
envelope against an independent implementation of the recipe, the transport interface with its two implementations (the signed bridge
over a scripted socket, and the direct-API placeholder), the talk pump (one request in flight, batches, sequence from 0, floor, padding,
backpressure, pacing, heartbeat, no retry), the provider (shared video connection, dedicated talk connection, same actor, audio_busy,
close) and the talk limit setting. What it does NOT prove: anything about the real WisKey, a real Home Assistant, a station, go2rtc or
audio. `tests/w10_fake_station.py` is a fake written from the schemas."""
from __future__ import annotations

import asyncio
import base64
import copy
import json
import logging
import sqlite3
import time
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from w10_fake_station import FIX, KIND, SCHEMAS, SECRET, FakeConn, FakeStation, check_schema

from smplwise.errors import ApiError
from smplwise.services import go2rtc as g2
from smplwise.services import ha_bridge
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_contract as w10
from smplwise.services.wiskey_talk_pump import TalkPump

SOURCE_SECRETS = ("fixture-pass", "fixture-user", "station-a.invalid", "rtsp://", SECRET)
ACTOR = w10.Actor("op-1", "Dana Operator")
FRAME = bytes(range(160))
REF = "f0e1d2c3b4a5968778695a4b3c2d1e0f"
SESSION = "a1b2c3d4e5f60718293a4b5c6d7e8f90"


def load(name: str) -> dict[str, Any]:
    doc = json.loads((FIX / name).read_text(encoding="utf-8"))
    doc.pop("_note", None)
    return doc


def run(coro: Any) -> Any:
    return asyncio.run(coro)


async def until(predicate: Any, timeout: float = 3.0) -> None:
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > end:
            raise AssertionError("condition not reached in time")
        await asyncio.sleep(0.005)


def no_secret(*texts: str) -> None:
    joined = "\n".join(texts)
    assert not any(s in joined for s in SOURCE_SECRETS), "a secret leaked"


class Link:
    """A signed link on a FakeConn, as the transport builds it."""

    @staticmethod
    def make(station: FakeStation, key: Any = SECRET, purpose: str = bridge.PURPOSE_TALK) -> bridge.SignedBridgeLink:
        return bridge.SignedBridgeLink(station.connect(), bridge.BridgeSigner(lambda: key), purpose, 1)


def transport_for(station: FakeStation, key: Any = SECRET) -> bridge.SignedBridgeTransport:
    async def connector(_purpose: str) -> Any:
        return station.connect()

    return bridge.SignedBridgeTransport(connector, bridge.BridgeSigner(lambda: key))


# ================================================================ S1: the contract tables (pure)

def sample_params() -> dict[str, dict[str, Any]]:
    frames = [bytes([i]) * 160 for i in range(5)]
    return {
        w10.DESCRIBE: w10.descriptor_params("entry-a", ACTOR, "arx-req-1"),
        w10.STREAM_LEASE: w10.lease_params(SESSION, w10.SYSTEM_ACTOR, "arx-req-2"),
        w10.TALK_OPEN: w10.talk_open_params(SESSION, ACTOR, "arx-req-3", "2030-01-01T00:00:00Z"),
        w10.TALK_FRAME: w10.talk_frame_params(REF, 0, frames),
        w10.TALK_FLOOR: w10.talk_floor_params(REF, True),
        w10.TALK_CLOSE: w10.talk_close_params(REF, "stopped"),
    }


def test_every_parameter_object_satisfies_the_published_schema_and_carries_no_api_contract():
    for command, params in sample_params().items():
        assert check_schema(params, SCHEMAS[command]["parameters_schema"]), command
        assert "api_contract" not in json.dumps(params)
        w10.validate_parameters(command, params)
    assert {c: SCHEMAS[c]["outer_type"] for c in SCHEMAS} == {c: "hikvision_intercom/" + c for c in w10.COMMANDS}
    assert set(SCHEMAS) == set(w10.COMMANDS)


@pytest.mark.parametrize("batch", [0, 1, 4, 6, 9, 11])
def test_a_talk_frame_batch_is_exactly_five_or_ten_frames(batch):
    with pytest.raises(w10.ContractError) as exc:
        w10.talk_frame_params(REF, 0, [FRAME] * batch)
    assert exc.value.code == "batch_size_invalid"
    for ok in (5, 10):
        assert len(w10.talk_frame_params(REF, 0, [FRAME] * ok)["frames"]) == ok


def test_frames_are_160_bytes_with_a_216_character_payload_and_a_sequence_from_the_first_seq():
    params = w10.talk_frame_params(REF, 0, [bytes([i]) * 160 for i in range(5)])
    assert [f["seq"] for f in params["frames"]] == [0, 1, 2, 3, 4]
    assert all(len(f["data"]) == 216 and len(base64.b64decode(f["data"])) == 160 for f in params["frames"])
    for bad in (b"", b"x" * 159, b"x" * 161, "x" * 160):
        with pytest.raises(w10.ContractError):
            w10.talk_frame_params(REF, 0, [bad] + [FRAME] * 4)
    for seq in (-1, True, 2**53):
        with pytest.raises(w10.ContractError):
            w10.talk_frame_params(REF, seq, [FRAME] * 5)


def test_validate_parameters_refuses_everything_wisKey_would_refuse():
    base = sample_params()
    cases = [
        (w10.DESCRIBE, lambda p: p.update(api_contract=1)),
        (w10.DESCRIBE, lambda p: p.pop("request_id")),
        (w10.DESCRIBE, lambda p: p["actor"].update(extra="x")),
        (w10.STREAM_LEASE, lambda p: p.update(profile="sub")),
        (w10.TALK_OPEN, lambda p: p.update(session="short")),
        (w10.TALK_FRAME, lambda p: p["frames"].pop()),
        (w10.TALK_FRAME, lambda p: p["frames"][2].update(seq=9)),
        (w10.TALK_FRAME, lambda p: p["frames"][0].update(data="AAAA")),
        (w10.TALK_FRAME, lambda p: p.update(seq=0)),
        (w10.TALK_FLOOR, lambda p: p.update(held="yes")),
        (w10.TALK_CLOSE, lambda p: p.update(reason="bored")),
        (w10.TALK_CLOSE, lambda p: p.update(talk_ref="bad ref")),
    ]
    for command, mutate in cases:
        params = copy.deepcopy(base[command])
        mutate(params)
        with pytest.raises(w10.ContractError):
            w10.validate_parameters(command, params)
    with pytest.raises(w10.ContractError):
        w10.validate_parameters("media/other", {})


def test_close_reasons_outside_the_enum_are_sent_as_the_nearest_one():
    assert w10.talk_close_params(REF, "upstream_unavailable")["reason"] == "upstream_closed"
    assert w10.talk_close_params(REF, "never_connected")["reason"] == "ended"
    assert w10.talk_close_params(REF, "nonsense")["reason"] == "ended"


def test_the_answers_are_read_totally():
    ack = load("talk_frame.ack.json")
    assert w10.parse_frame_ack(ack, first_seq=0, count=5) == w10.FrameAck(5, 5)
    for bad in (None, [], {**ack, "next_seq": 6}, {**ack, "accepted_frames": 4}, {**ack, "retry_permitted": True},
                {**ack, "extra": 1}, {"next_seq": 5}, {**ack, "next_seq": True}, {**ack, "next_seq": "5"}):
        with pytest.raises(w10.ContractError):
            w10.parse_frame_ack(bad, first_seq=0, count=5)
    assert w10.parse_floor(load("talk_floor.ack.json"), held=True) == 0
    for bad in ({"held": False, "next_seq": 0}, {"held": True}, {"held": 1, "next_seq": 0}, None):
        with pytest.raises(w10.ContractError):
            w10.parse_floor(bad, held=True)
    w10.parse_close(load("talk_close.ack.json"))
    for bad in ({"state": "closed", "cleanup_joined": False, "no_effect": None}, {"state": "pending", "cleanup_joined": True, "no_effect": None},
                {"state": "closed", "cleanup_joined": True, "no_effect": True}, None):
        with pytest.raises(w10.ContractError):
            w10.parse_close(bad)


def test_talk_open_v11_accepts_pcmu_only_and_a_lease_only_the_source_with_a_short_expiry():
    assert w10.parse_talk_open_v11(load("talk_open.v11.json")).codec == "pcmu"
    for bad in ({**load("talk_open.v11.json"), "codec": "pcma"}, {**load("talk_open.v11.json"), "frame_ms": 40}, {"talk_ref": "x", "codec": "pcmu", "frame_ms": 20}, None):
        with pytest.raises(w10.ContractError):
            w10.parse_talk_open_v11(bad)
    now = time.time()
    lease = load("stream_lease.v11.json")
    lease["expires_at"] = im.iso(now + 15)
    got = w10.parse_lease_v11(lease, now=now)
    assert got.source is not None and "fixture-pass" not in repr(got)
    for bad in ({**lease, "go2rtc_stream": "smplwise_wiskey_x"}, {"go2rtc_stream": "smplwise_wiskey_x", "expires_at": lease["expires_at"]},
                {**lease, "expires_at": im.iso(now + 600)}, {**lease, "expires_at": im.iso(now - 1)}, {**lease, "source": "http://x"},
                {**lease, "source": "rtsp://a b"}, {"source": lease["source"]}):
        with pytest.raises(w10.ContractError):
            w10.parse_lease_v11(bad, now=now)


def test_the_closed_event_is_read_by_its_reason_and_unknown_reasons_end_the_talk_anyway():
    event = load("talk_closed.v11.event.json")
    assert w10.talk_closed_v11(event) == (REF, "idle_timeout", True)
    assert w10.talk_closed_v11({**event, "reason": "brand_new"})[1] == "upstream_closed"
    assert w10.talk_closed_v11({**event, "type": "other"}) is None
    assert w10.talk_closed_v11({**event, "talk_ref": "bad"}) is None


def test_every_wiskey_error_code_has_a_reason_and_busy_is_separate():
    for code in ("station_not_found", "station_offline", "media_not_supported", "rate_limited", "audio_busy", "Unauthorized", "invalid_fields",
                 "source_changed", "session_expired", "sequence_invalid", "floor_not_held", "cleanup_failed", "media_outcome_unknown",
                 "bridge_command_capacity", "bridge_command_replayed"):
        reason = w10.unavailable_reason(code)
        assert reason in {"not_found", "offline", "no_media", "rate_limited", "provider_forbidden", "provider_error"}, code
    assert w10.unavailable_reason("Unauthorized") == "provider_forbidden" and w10.unavailable_reason("station_offline") == "offline"
    assert "audio_busy" in w10.BUSY_CODES


# ================================================================ S0/S2: the descriptor of v1.1 and the signed envelope

def descriptor_v11(**over: Any) -> dict[str, Any]:
    now = time.time()
    return {**load("station_descriptor.v11.json"), "issued_at": im.iso(now - 5), "expires_at": im.iso(now + 300), **over}


def test_the_v11_descriptor_is_read_as_one_main_profile_with_unknowns_and_talk_by_signed_batches():
    d = im.parse_descriptor(descriptor_v11(), station_id="entry-a", provider="wiskey")
    assert [p.id for p in d.profiles] == ["main"] and d.default_profile == "main"
    main = d.profile("main")
    assert main is not None and main.codec == "unknown" and (main.width, main.height, main.fps) == (None, None, None)
    assert main.transports == ("mse", "webrtc")
    assert d.talk is True and d.talk_transport == "pcmu_frames" and d.audio_codec == "pcmu" and d.duplex == "half"
    assert d.listen is False and d.max_talk_seconds == 300 and d.max_viewers == im.MAX_VIEWERS_CAP and d.max_talkers == 1
    # a descriptor that does not name signed batches offers no talk; WKDIRECT-295: one whose published limit is not an exact int
    # 1..86400 offers no talk either (WisKey's schema requires it), and its video is unaffected
    no_talk = im.parse_descriptor(descriptor_v11(audio={**descriptor_v11()["audio"], "talk_transports": []}), station_id="entry-a", provider="wiskey")
    assert no_talk.talk is False and no_talk.talk_transport is None
    for bad in (None, 0, 86401, True, 30.0, "300"):
        broken = im.parse_descriptor(descriptor_v11(audio={**descriptor_v11()["audio"], "max_talk_seconds": bad}), station_id="entry-a", provider="wiskey")
        assert broken.talk is False and broken.talk_transport is None and broken.profiles, bad
    for good in (1, 180, 3600, 86400):
        assert im.parse_descriptor(descriptor_v11(audio={**descriptor_v11()["audio"], "max_talk_seconds": good}), station_id="entry-a", provider="wiskey").max_talk_seconds == good
    # profiles other than main, or without the private source transport, are not offered
    sub = descriptor_v11(video={"profiles": [{"id": "sub", "transports": ["private_rtsp_source"]}, {"id": "main", "transports": ["webrtc"]}]})
    assert im.parse_descriptor(sub, station_id="entry-a", provider="wiskey").profiles == ()
    # v1 still parses as before, and a v1.1 descriptor with an address is still refused
    assert im.parse_descriptor(load("station_descriptor.json") | {"issued_at": im.iso(time.time()), "expires_at": im.iso(time.time() + 300)}, station_id="entry-a", provider="x").profiles
    with pytest.raises(im.DescriptorError):
        im.parse_descriptor(descriptor_v11(video={"profiles": [{"id": "main", "transports": ["private_rtsp_source"], "note": "rtsp://192.0.2.1/x"}]}), station_id="entry-a", provider="wiskey")


def test_the_envelope_is_exactly_id_type_bridge_and_the_signature_matches_the_written_recipe():
    station = FakeStation()
    conn = station.connect()
    signer = bridge.BridgeSigner(lambda: SECRET)
    params = w10.talk_floor_params(REF, True)
    proof = signer.proof(w10.TALK_FLOOR, conn.user_id, params)
    assert set(proof) == {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "ts", "nonce", "sig"}
    assert proof["kind"] == KIND == bridge.KIND and proof["command"] == w10.TALK_FLOOR and proof["parameters"] == params
    assert type(proof["ts"]) is int and len(proof["nonce"]) == 16 and len(proof["sig"]) == 64
    envelope = {"id": 1, "type": bridge.TYPE_PREFIX + w10.TALK_FLOOR, "bridge": proof}
    assert set(envelope) == {"id", "type", "bridge"} and "api_contract" not in json.dumps(envelope)
    assert station.admit(conn, envelope, w10.TALK_FLOOR) == params, "the independent verifier accepts it"
    with pytest.raises(Exception) as replay:
        station.admit(conn, envelope, w10.TALK_FLOOR)
    assert getattr(replay.value, "code", None) == "Unauthorized", "a nonce is single use"
    # our own verifier agrees too (ha_bridge.verify is the other half of the existing recipe)
    again = signer.proof(w10.TALK_FLOOR, conn.user_id, params)
    ha_bridge.verify(SECRET, again)


def test_the_window_is_short_the_clock_is_whole_seconds_and_nonces_are_fresh():
    signer = bridge.BridgeSigner(lambda: SECRET, clock=lambda: 1_800_000_000.9)
    a = signer.proof(w10.TALK_FLOOR, "u1", w10.talk_floor_params(REF, False))
    b = signer.proof(w10.TALK_FLOOR, "u1", w10.talk_floor_params(REF, False))
    assert a["ts"] == 1_800_000_000 and a["nonce"] != b["nonce"] and a["sig"] != b["sig"]
    assert (a["issued_at"], a["expires_at"]) == ("2027-01-15T08:00:00+00:00", "2027-01-15T08:00:10+00:00")
    for window in (0, 16, -1):
        with pytest.raises(bridge.MediaBridgeError):
            signer.proof(w10.TALK_FLOOR, "u1", w10.talk_floor_params(REF, False), window_s=window)
    with pytest.raises(bridge.MediaBridgeError):
        signer.proof(w10.TALK_FLOOR, "", w10.talk_floor_params(REF, False))


def test_without_a_key_or_with_a_rotated_key_nothing_is_signed_and_no_key_is_ever_shown(caplog):
    params = w10.talk_floor_params(REF, True)
    for provider, code in ((lambda: None, "bridge_not_paired"), (lambda: "", "bridge_not_paired"), (lambda: (_ for _ in ()).throw(RuntimeError("boom")), "bridge_not_paired")):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.BridgeSigner(provider).proof(w10.TALK_FLOOR, "u1", params)
        assert exc.value.code == code
    rotated = ha_bridge.BridgeKey("rotated-material-never-shown", "g1-abcdef")
    with caplog.at_level(logging.DEBUG), pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.BridgeSigner(lambda: rotated).proof(w10.TALK_FLOOR, "u1", params)
    assert exc.value.code == "bridge_key_rotated"
    legacy = ha_bridge.BridgeKey(SECRET, "g0-legacy")
    assert bridge.BridgeSigner(lambda: legacy).proof(w10.TALK_FLOOR, "u1", params)["sig"]
    assert "rotated-material-never-shown" not in repr(rotated) + str(exc.value) + caplog.text
    assert SECRET not in repr(bridge.BridgeSigner(lambda: SECRET))
    with pytest.raises(bridge.MediaBridgeError):
        bridge.BridgeSigner(lambda: SECRET).proof(w10.TALK_FLOOR, "u1", {**params, "api_contract": 1})  # a request WisKey would refuse is never signed


def test_the_result_reader_is_total_and_never_carries_wiskeys_text():
    ok = {"id": 3, "type": "result", "success": True, "bridge_schema": KIND, "result": {"a": 1}}
    assert bridge.verify_result(ok) == {"a": 1}
    assert bridge.verify_result({k: v for k, v in ok.items() if k != "bridge_schema"}) == {"a": 1}
    for bad in (None, [], {"type": "event"}, {**ok, "success": "yes"}, {**ok, "bridge_schema": "other"}, {**ok, "result": [1]}, {**ok, "result": "x"},
                {**ok, "result": {"big": "x" * 300_000}}):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.verify_result(bad)
        assert exc.value.code == "invalid_response"
    with pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.verify_result({"id": 3, "type": "result", "success": False, "error": {"code": "audio_busy", "message": "rtsp://secret.invalid/x"}})
    assert exc.value.code == "audio_busy" and "secret" not in str(exc.value)
    for error in (None, {}, {"code": "has space"}, {"code": 7}, {"code": "x" * 100}):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.verify_result({"id": 1, "type": "result", "success": False, "error": error})
        assert exc.value.code == "provider_error"


# ================================================================ S3: the transport interface and its two implementations

def test_the_signed_link_signs_each_call_and_maps_answers_and_failures():
    async def scenario() -> None:
        station = FakeStation()
        link = Link.make(station)
        sent: list[dict[str, Any]] = []
        original = link.raw.send

        async def spy(msg_type: str, **payload: Any) -> dict[str, Any]:
            sent.append({"type": msg_type, **payload})
            return await original(msg_type, **payload)

        link.raw.send = spy  # type: ignore[method-assign]
        desc = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-1"), timeout=2)
        assert desc["schema"] == w10.SCHEMA_V11
        assert [set(s) for s in sent] == [{"type", "bridge"}] and sent[0]["type"] == "hikvision_intercom/media/station_descriptor"
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await link.call(w10.DESCRIBE, w10.descriptor_params("missing", ACTOR, "arx-2"), timeout=2)
        assert exc.value.code == "station_not_found" and exc.value.outcome == "refused"
        # no answer in time: the outcome is unknown and nothing is retried
        station.delays[w10.DESCRIBE] = 0.5
        before = len(station.requests)
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-3"), timeout=0.05)
        assert (exc.value.code, exc.value.outcome) == ("media_outcome_unknown", "unknown")
        await asyncio.sleep(0.6)
        assert len(station.requests) == before + 1, "one request, never re-sent"
        # a dead socket
        link.raw.drop()
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-4"), timeout=2)
        assert (exc.value.code, exc.value.outcome) == ("connection_closed", "closed") and link.closed

    run(scenario())


def test_a_purpose_other_than_video_or_talk_is_refused():
    # WKDIRECT-295: the direct API is real now (tests/test_wkdirect_295.py); the placeholder and its `direct_api_not_published` are gone
    async def scenario() -> None:
        with pytest.raises(bridge.MediaBridgeError):
            await transport_for(FakeStation()).connect("elsewhere")

    run(scenario())
    assert "direct_api_not_published" not in w10.ERRORS


def test_ha_ws_connection_asks_who_it_is_routes_events_and_closes(monkeypatch):
    from smplwise.services import ha_client

    seen: dict[str, Any] = {}

    async def fake_ws_session(settings, on_ready, on_event, stop, on_message=None, *, url=None, token=None, internal_tls=False):
        seen.update(url=url, token_given=token is not None)

        async def call(msg_type, **kw):
            seen.setdefault("types", []).append(msg_type)
            if msg_type == "auth/current_user":
                return {"id": 1, "type": "result", "success": True, "result": {"id": "user-77", "name": "x"}}
            return {"id": 2, "type": "result", "success": True, "result": {"echo": sorted(kw)}}

        await on_ready(call)
        seen["push"] = lambda mid=9: on_message({"id": mid, "type": "event", "event": {"type": "media/talk_closed", "talk_ref": REF}})
        seen["terminal"] = lambda mid: on_message({"id": mid, "type": "result", "success": False, "error": {"code": "media_subscription_closed"}})
        await stop.wait()

    monkeypatch.setattr(ha_client, "ws_session", fake_ws_session)

    async def scenario() -> None:
        conn = await bridge.HaWsConnection.open(object(), token="not-a-real-token")
        assert conn.user_id == "user-77" and not conn.closed and "user-77" not in repr(conn) and "not-a-real-token" not in repr(conn)
        events: list[dict[str, Any]] = []
        conn.set_event_handler(events.append)
        # WISKEY-OWNER26-297 (owner26 HA-scoped terminal): a media event of a subscription no media channel owns is never handed to anyone
        seen["push"]()
        assert events == []
        # ... while the media channel that opened the talk (subscription = its talk_open id) gets its own events, and the terminal
        # `media_subscription_closed` ends only that channel, never the shared socket
        channel = conn.media_channel()
        mine: list[dict[str, Any]] = []
        channel.set_event_handler(mine.append)
        assert (await channel.send(bridge.TYPE_PREFIX + w10.TALK_OPEN, bridge={}))["success"] is True
        seen["push"](2)
        assert mine and mine[0]["talk_ref"] == REF and events == []
        ended: list[int] = []
        channel.set_closed_handler(lambda: ended.append(1))
        seen["terminal"](2)
        assert channel.closed and ended == [1] and not conn.closed
        assert (await conn.send("hikvision_intercom/media/talk_floor", bridge={}))["result"] == {"echo": ["bridge"]}
        closed: list[int] = []
        conn.set_closed_handler(lambda: closed.append(1))
        await conn.close()
        assert conn.closed and closed == [1]
        with pytest.raises(ConnectionError):
            await conn.send("x")

    run(scenario())
    assert seen["token_given"] is True and seen["types"][0] == "auth/current_user"


def test_ha_ws_connection_failures_are_a_rule_code_only(monkeypatch):
    from smplwise.services import ha_client

    async def refuses(*_a, **_k):
        raise ApiError(503, "ha_forbidden", "x")

    async def anonymous(settings, on_ready, on_event, stop, on_message=None, **_k):
        async def call(msg_type, **kw):
            return {"id": 1, "type": "result", "success": True, "result": {"no": "id"}}

        await on_ready(call)
        await stop.wait()

    async def scenario() -> None:
        monkeypatch.setattr(ha_client, "ws_session", refuses)
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await bridge.HaWsConnection.open(object())
        assert exc.value.code == "connection_failed"
        monkeypatch.setattr(ha_client, "ws_session", anonymous)
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await bridge.HaWsConnection.open(object())
        assert exc.value.code == "connection_failed"

    run(scenario())


# ================================================================ S5: the talk pump on a fake station

OPTS = {"frame_s": 0.01, "heartbeat_s": 0.2, "frame_timeout_s": 0.4, "floor_timeout_s": 1.0}  # a batch every 50 ms


async def open_talk(station: FakeStation, *, ended: list[str] | None = None, **opts: Any) -> tuple[TalkPump, bridge.SignedBridgeLink, str]:
    link = Link.make(station)
    desc = await link.call(w10.DESCRIBE, w10.descriptor_params("entry-a", ACTOR, "arx-d"), timeout=2)
    opened = await link.call(w10.TALK_OPEN, w10.talk_open_params(desc["session"], ACTOR, "arx-t", im.iso(time.time() + 60)), timeout=2)
    out = ended if ended is not None else []
    pump = TalkPump(link, opened["talk_ref"], on_end=out.append, **{**OPTS, **opts})
    pump.start()
    return pump, link, opened["talk_ref"]


def test_floor_first_then_batches_numbered_from_zero_one_request_at_a_time():
    async def scenario() -> None:
        station = FakeStation()
        station.ack_delay = 0.004
        pump, link, ref = await open_talk(station)
        pump.push(FRAME)  # before the floor is acknowledged: dropped
        assert pump.dropped_not_held == 1
        await pump.set_floor(True)
        assert pump.held and station.talks[ref].held
        for i in range(25):
            pump.push(bytes([i]) * 160)
            if i % 5 == 4:
                await asyncio.sleep(0.09)  # slower than the 50 ms pacing: no batch waits behind another
        await until(lambda: pump.sent_batches == 5)
        assert [(first, count) for _t, first, count in station.batches] == [(0, 5), (5, 5), (10, 5), (15, 5), (20, 5)]
        assert pump.seq == 25 and station.talks[ref].max_in_flight == 1
        assert [bytes(f)[:1] for f in station.frames_sink[:3]] == [b"\x00", b"\x01", b"\x02"], "order kept"
        await pump.set_floor(False)
        assert not pump.held and not station.talks[ref].held
        await pump.stop()

    run(scenario())


def test_releasing_pads_the_last_partial_batch_with_silence_and_then_lowers_the_floor():
    async def scenario() -> None:
        station = FakeStation()
        pump, link, ref = await open_talk(station)
        await pump.set_floor(True)
        for i in range(7):  # one whole batch and two frames
            pump.push(bytes([i + 1]) * 160)
        await pump.set_floor(False)
        assert [(first, count) for _t, first, count in station.batches] == [(0, 5), (5, 5)]
        assert pump.padded_frames == 3 and station.frames_sink[-3:] == [w10.SILENCE_PCMU] * 3 and station.frames_sink[5] == bytes([6]) * 160
        order = [r.command for r in station.requests if r.conn == 1][-4:]
        assert order == [w10.TALK_FLOOR, w10.TALK_FRAME, w10.TALK_FRAME, w10.TALK_FLOOR], "the floor is released AFTER the audio"
        assert not station.talks[ref].held and station.talks[ref].max_in_flight == 1
        await pump.stop()

    run(scenario())


def test_a_second_press_starts_clean_and_the_sequence_goes_on():
    async def scenario() -> None:
        station = FakeStation()
        pump, _link, ref = await open_talk(station)
        for press in range(2):
            await pump.set_floor(True)
            for _ in range(5):
                pump.push(FRAME)
            await pump.set_floor(False)
        assert [(first, count) for _t, first, count in station.batches] == [(0, 5), (5, 5)] and pump.seq == 10
        await pump.stop()

    run(scenario())


def test_frames_arriving_faster_than_real_time_are_dropped_as_whole_batches_without_a_gap_in_the_sequence():
    async def scenario() -> None:
        station = FakeStation()
        station.ack_delay = 0.02
        pump, _link, ref = await open_talk(station)
        await pump.set_floor(True)
        for _ in range(50):  # ten batches at once: one is in flight at most, ONE waits, the rest is dropped (never queued)
            pump.push(FRAME)
        await until(lambda: pump.sent_batches >= 1)
        await asyncio.sleep(0.2)
        assert pump.dropped_batches == 9 and pump.dropped_frames == 45 and pump.sent_batches == 1, (pump.dropped_batches, pump.sent_batches)
        for _ in range(5):
            pump.push(FRAME)
        await until(lambda: pump.sent_batches == 2)
        assert [(first, count) for _t, first, count in station.batches] == [(0, 5), (5, 5)], "dropped audio leaves no hole in the numbering"
        await pump.stop()

    run(scenario())


def test_batches_are_never_sent_faster_than_real_time_so_the_credit_bucket_never_runs_dry():
    async def scenario() -> None:
        station = FakeStation()
        station.credit_per_s = 1 / (5 * 0.01)  # one batch per 50 ms, like WisKey's 1 per 100 ms at real speed
        pump, _link, _ref = await open_talk(station)
        await pump.set_floor(True)
        for _ in range(8):  # the browser's rate: a batch of frames every ~90 ms, which is slower than the 50 ms pacing
            for _ in range(5):
                pump.push(FRAME)
            await asyncio.sleep(0.09)
        await until(lambda: pump.sent_batches >= 6)
        times = [t for t, _f, _c in station.batches]
        gaps = [b - a for a, b in zip(times, times[1:], strict=False)]
        assert min(gaps) >= 0.03, f"spacing {min(gaps):.3f}s is faster than real time"
        assert not pump.ended
        await pump.stop()

    run(scenario())


def test_an_answer_that_does_not_come_ends_the_talk_and_the_batch_is_never_re_sent():
    async def scenario() -> None:
        station = FakeStation()
        ended: list[str] = []
        pump, link, _ref = await open_talk(station, ended=ended, frame_timeout_s=0.1)
        await pump.set_floor(True)
        station.delays[w10.TALK_FRAME] = 0.5
        for _ in range(5):
            pump.push(FRAME)
        await until(lambda: ended)
        assert ended == ["upstream_closed"] and pump.end_code == "media_outcome_unknown"
        await asyncio.sleep(0.6)
        assert len(station.by_command(w10.TALK_FRAME)) == 1, "no second attempt"
        await pump.stop()

    run(scenario())


@pytest.mark.parametrize("code", ["rate_limited", "floor_not_held", "sequence_invalid", "source_changed", "media_outcome_unknown", "Unauthorized"])
def test_any_refusal_of_a_batch_ends_the_talk_without_a_retry(code):
    async def scenario() -> None:
        station = FakeStation()
        ended: list[str] = []
        pump, _link, _ref = await open_talk(station, ended=ended)
        await pump.set_floor(True)
        station.errors[w10.TALK_FRAME] = code
        for _ in range(5):
            pump.push(FRAME)
        await until(lambda: ended)
        assert pump.end_code == code and len(station.by_command(w10.TALK_FRAME)) == 1
        await pump.set_floor(False)  # a waiter on an ended talk returns at once
        await pump.stop()

    run(scenario())


def test_a_floor_that_is_refused_or_answered_wrongly_ends_the_talk():
    async def scenario() -> None:
        station = FakeStation()
        ended: list[str] = []
        pump, _link, _ref = await open_talk(station, ended=ended)
        station.errors[w10.TALK_FLOOR] = "source_changed"
        await asyncio.wait_for(pump.set_floor(True), 2)
        assert ended == ["upstream_closed"] and pump.end_code == "source_changed" and not pump.held
        await pump.stop()

    run(scenario())


def test_the_heartbeat_keeps_an_idle_talk_alive_and_without_it_wiskey_ends_it():
    async def scenario(heartbeat_s: float) -> tuple[list[str], int, int]:
        station = FakeStation()
        station.idle_s = 0.25
        watchdog = asyncio.ensure_future(station.run_watchdog())
        ended: list[str] = []
        pump, _link, ref = await open_talk(station, ended=ended, heartbeat_s=heartbeat_s)
        await asyncio.sleep(0.8)  # more than three idle limits with nothing to say
        alive = ref in station.talks
        beats = len(station.by_command(w10.TALK_FLOOR))
        watchdog.cancel()
        await pump.stop()
        return ended, int(alive), beats

    ended, alive, beats = run(scenario(0.08))
    assert alive == 1 and beats >= 5 and not [e for e in ended if e != "stopped"], "heartbeats are floor requests with the current floor"
    ended, alive, beats = run(scenario(30.0))
    assert alive == 0 and beats == 0, "without heartbeats WisKey's idle rule ends the talk"


def test_wiskey_ending_the_talk_stops_every_request_and_the_pump_stays_quiet():
    async def scenario() -> None:
        station = FakeStation()
        ended: list[str] = []
        pump, link, ref = await open_talk(station, ended=ended)
        await pump.set_floor(True)
        link.set_event_handler(lambda e: (hit := w10.talk_closed_v11(e)) and pump.remote_closed(hit[1]))
        station.emit_closed(station.talks[ref], "access_lost")
        await until(lambda: ended)
        assert pump.closed_by_wiskey and pump.end_code == "access_lost" and ended == ["upstream_closed"]
        before = len(station.requests)
        pump.push(FRAME)
        await asyncio.sleep(0.1)
        assert len(station.requests) == before
        await pump.stop()

    run(scenario())


def test_a_dropped_connection_ends_the_talk():
    async def scenario() -> None:
        station = FakeStation()
        ended: list[str] = []
        pump, link, _ref = await open_talk(station, ended=ended)
        link.set_closed_handler(lambda: pump.fail("connection_closed"))
        await pump.set_floor(True)
        link.raw.drop()
        await until(lambda: ended)
        assert pump.end_code == "connection_closed"
        await pump.stop()

    run(scenario())


def test_only_whole_160_byte_frames_are_taken_from_the_browser():
    async def scenario() -> None:
        station = FakeStation()
        pump, _link, _ref = await open_talk(station)
        await pump.set_floor(True)
        pump.push(b"x" * 159)
        pump.push(b"x" * 161)
        pump.push(b"")
        assert pump.dropped_bad_size == 3 and not pump._buffer
        await pump.stop()
        with pytest.raises(ValueError):
            TalkPump(_link, "r" * 20, on_end=lambda _r: None, batch=7)

    run(scenario())


# ================================================================ S4/S5: the provider on a fake station

@pytest.fixture()
def settings(settings):
    return replace(settings, go2rtc_url="http://go2rtc.invalid:1984")


@pytest.fixture(autouse=True)
def _leased_streams_stay_in_memory(monkeypatch):
    """WKF01F02-295: the leased-stream lifecycle deletes through `Go2rtc.delete_stream` (strict) when a provider's video channel closes; no
    real go2rtc exists here, so a delete is a no-op that go2rtc "confirms" unless a test installs its own. Each test starts and ends with an
    empty lease registry and no live lease timer."""
    monkeypatch.setattr(g2.Go2rtc, "delete_stream", lambda self, name, **_kw: None)
    im._LEASED.clear()
    yield
    with im._LEASE_LOCK:
        rows = list(im._LEASED.values())
        im._LEASED.clear()
    for rec in rows:
        for timer in rec.timers:
            timer.cancel()


@pytest.fixture()
def registered(monkeypatch):
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


@pytest.fixture()
def station_fake():
    return FakeStation()


@pytest.fixture()
def provider(station_fake):
    p = im.WiskeyBridgeProvider(transport_for(station_fake), discovery=lambda _s: load("overview_api.json"), pump_options=dict(OPTS))
    im.set_provider(p)
    yield p
    p.video.close()
    im.set_provider(None)
    im.MEDIA.reset()


STATION = {"id": "entry-a", "online": True, "camera_entity": "camera.entry_a"}


def test_describe_asks_as_arx_on_the_shared_connection_and_parses_the_v11_descriptor(provider, station_fake, settings):
    d = im.MEDIA.descriptor(provider, None, settings, STATION)
    assert d.provider == "wiskey" and d.profile("main") is not None and d.talk_transport == "pcmu_frames"
    req = station_fake.by_command(w10.DESCRIBE)
    assert len(req) == 1 and req[0].params["actor"] == {"id": "arx", "display_name": "Arx"} and req[0].params["station_id"] == "entry-a"
    assert "api_contract" not in json.dumps(req[0].params)
    assert im.MEDIA.descriptor(provider, None, settings, STATION) is d and len(station_fake.by_command(w10.DESCRIBE)) == 1, "cached until it nearly expires"


def test_talk_stays_in_the_classic_panel_while_the_four_talk_commands_are_not_all_listed(provider, station_fake, settings):
    api = load("overview_api.json")
    provider.transport._discovery = lambda _s: {**api, "commands": [c for c in api["commands"] if c != w10.TALK_FLOOR]}
    d = provider.describe(None, settings, STATION)
    assert d.provider == "wiskey" and d.profiles and d.talk_transport is None
    provider.transport._discovery = lambda _s: {**api, "commands": [w10.DESCRIBE]}
    with pytest.raises(im.Unavailable) as exc:
        provider._describe(None, settings, STATION)
    assert exc.value.code == "not_listed"


def test_the_lease_comes_from_the_same_connection_and_actor_and_the_source_is_registered_in_memory_and_never_shown(provider, station_fake, settings, registered, caplog):
    with caplog.at_level(logging.DEBUG):
        name = provider.video_stream(None, settings, STATION, "main", actor=w10.Actor("someone-else", "Someone Else"))
    # WKF01F02-295: a name of the lease's own owner (`.w10.<random>`), never the stills' `smplwise_wiskey_<station>` stream
    assert name.startswith("smplwise_wiskey_entry-a.w10.") and len(registered) == 1 and registered[0][0] == name
    describe, lease = station_fake.by_command(w10.DESCRIBE)[0], station_fake.by_command(w10.STREAM_LEASE)[0]
    assert describe.conn == lease.conn == 1, "descriptor and lease travel on one connection"
    assert lease.params["actor"] == describe.params["actor"] == {"id": "arx", "display_name": "Arx"}, "the video actor is Arx, never the operator"
    assert lease.params["profile"] == "main" and lease.params["session"] != "" and "api_contract" not in json.dumps(lease.params)
    no_secret(caplog.text, repr(provider), repr(name))
    assert len(station_fake.conns) == 1
    provider.video_stream(None, settings, STATION, "main")
    assert len(station_fake.conns) == 1 and len(station_fake.by_command(w10.STREAM_LEASE)) == 2, "the connection is kept"


def test_only_the_main_profile_exists(provider, station_fake, settings, registered):
    with pytest.raises(ApiError) as exc:
        provider.video_stream(None, settings, STATION, "sub")
    assert exc.value.status == 409 and not registered


def test_a_reopened_connection_costs_one_fresh_descriptor_and_one_more_lease_never_more(provider, station_fake, settings, registered):
    provider.video_stream(None, settings, STATION, "main")
    station_fake.conns[0].drop()  # the shared connection goes away; the cached descriptor belonged to it
    name = provider.video_stream(None, settings, STATION, "main")
    assert name.startswith("smplwise_wiskey_entry-a.w10.") and len(station_fake.conns) == 2
    leases = station_fake.by_command(w10.STREAM_LEASE)
    assert [r.conn for r in leases] == [1, 2, 2], "the old descriptor is refused once on the new connection, then one fresh descriptor and one more lease"
    assert [r.conn for r in station_fake.by_command(w10.DESCRIBE)] == [1, 2]
    # a lease refused for a session WisKey forgot: one fresh descriptor, one retry of that read, then the refusal stands
    provider.video_stream(None, settings, STATION, "main")  # a descriptor is cached now
    station_fake.descriptors.clear()
    before = len(station_fake.by_command(w10.STREAM_LEASE))
    provider.video_stream(None, settings, STATION, "main")
    assert len(station_fake.by_command(w10.STREAM_LEASE)) == before + 2
    station_fake.errors[w10.STREAM_LEASE] = "session_expired"
    before = len(station_fake.by_command(w10.STREAM_LEASE))
    with im.MEDIA._lock:
        im.MEDIA._descriptors.clear()
    with pytest.raises(ApiError) as exc:
        provider._leased_stream(settings, im.MEDIA.descriptor(provider, None, settings, STATION), "entry-a", "main", None)
    assert exc.value.status == 503 and len(station_fake.by_command(w10.STREAM_LEASE)) == before + 2


def test_a_lease_with_a_long_expiry_or_a_failing_go2rtc_is_refused_and_the_failure_names_no_source(provider, station_fake, settings, registered, caplog, monkeypatch):
    station_fake.utcnow = lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)  # type: ignore[method-assign]
    original = station_fake._stream_lease

    def long_lease(conn, p):
        out = original(conn, p)
        out["expires_at"] = im.iso(time.time() + 3000)
        return out

    station_fake._stream_lease = long_lease  # type: ignore[method-assign]
    with caplog.at_level(logging.DEBUG), pytest.raises(ApiError) as exc:
        provider._leased_stream(settings, im.MEDIA.descriptor(provider, None, settings, STATION), "entry-a", "main", None)
    assert exc.value.details == {"reason": "lease_lifetime_too_long"}
    no_secret(caplog.text, str(exc.value), json.dumps(exc.value.details))


def test_video_falls_back_to_arxs_own_source_when_the_signed_path_has_no_key(settings, monkeypatch):
    station = FakeStation()
    p = im.WiskeyBridgeProvider(transport_for(station, key=None), discovery=lambda _s: load("overview_api.json"))
    try:
        with pytest.raises(im.Unavailable) as exc:
            p._describe(None, settings, STATION)
        assert exc.value.code == "provider_forbidden" and station.requests == [], "nothing is sent without a key"
        monkeypatch.setattr(im._local, "describe", lambda conn, s, st: im.parse_descriptor(
            {"schema": im.SCHEMA, "station_id": "entry-a", "session": "local-" + "a" * 24, "issued_at": im.iso(time.time()), "expires_at": im.iso(time.time() + 600),
             "video": {"profiles": [{"id": "main", "transports": ["mse"]}]}}, station_id="entry-a", provider="local"))
        assert p.describe(None, settings, STATION).provider == "local"
    finally:
        p.video.close()


def test_the_unsigned_feed_path_is_gone_from_the_bridge_provider(provider, settings):
    # WKDIRECT-295 (S6): the discovery list is all that is left of the feed transport - no read / act / post exists to call
    assert not any(hasattr(provider.transport, name) for name in ("read", "act", "post"))
    assert provider.transport.api(settings) is not None


def talk_channel(provider: im.WiskeyBridgeProvider, settings: Any, **kw: Any) -> im.WiskeyBridgeTalkChannel:
    d = provider.describe(None, settings, STATION)
    channel = provider.talk_open(settings, "entry-a", d, actor_id=kw.get("actor_id", "op-1"), actor_name=kw.get("actor_name", "Dana Operator"),
                                 request_id=kw.get("request_id", "req-123"), expires_at=kw.get("expires_at", time.time() + 120))
    assert isinstance(channel, im.WiskeyBridgeTalkChannel)
    return channel


def test_a_talk_gets_its_own_connection_reads_a_descriptor_as_the_operator_and_closes_once(provider, station_fake, settings):
    async def scenario() -> str:
        channel = talk_channel(provider, settings)
        await channel.open()
        assert channel.ref is not None
        await channel.floor(True)
        for _ in range(10):
            await channel.send_frame(FRAME)
        await until(lambda: station_fake.batches and sum(c for _t, _f, c in station_fake.batches) >= 5)
        await channel.floor(False)
        await channel.close("stopped")
        return await channel.wait_closed()

    outcome = run(scenario())
    assert outcome in ("stopped", "upstream_closed")
    describes = station_fake.by_command(w10.DESCRIBE)
    video_conn, talk_conn = 1, 2
    assert [r.conn for r in describes] == [video_conn, talk_conn] and len(station_fake.conns) == 2
    talk_describe = describes[1].params
    assert talk_describe["actor"] == {"id": "op-1", "display_name": "Dana Operator"}
    opened = station_fake.by_command(w10.TALK_OPEN)
    assert len(opened) == 1 and opened[0].conn == talk_conn and opened[0].params["actor"] == talk_describe["actor"]
    assert opened[0].params["request_id"] == "req-123"
    closes = station_fake.by_command(w10.TALK_CLOSE)
    assert len(closes) == 1 and closes[0].conn == talk_conn and closes[0].params["reason"] == "stopped"
    assert station_fake.conns[1].closed and not station_fake.talks and not station_fake.station_talk, "the connection and the station lock are released"
    assert all(r.conn == talk_conn for r in station_fake.requests if r.command in (w10.TALK_FRAME, w10.TALK_FLOOR, w10.TALK_OPEN, w10.TALK_CLOSE))


def test_a_busy_station_is_audio_busy_and_never_says_who(provider, station_fake, settings):
    async def scenario() -> None:
        first = talk_channel(provider, settings)
        await first.open()
        second = talk_channel(provider, settings, actor_id="op-2", actor_name="Other Operator")
        with pytest.raises(ApiError) as exc:
            await second.open()
        assert exc.value.status == 409 and exc.value.code == "intercom_talk_busy" and exc.value.retryable
        assert "Dana" not in str(exc.value) + json.dumps(exc.value.details or {})
        assert station_fake.conns[2].closed, "the refused attempt leaves no connection behind"
        assert len(station_fake.by_command(w10.TALK_CLOSE)) == 0
        await first.close("stopped")

    run(scenario())


def test_audio_busy_from_the_fleet_limit_is_busy_too(provider, station_fake, settings):
    station_fake.fleet_extra = 3

    async def scenario() -> None:
        channel = talk_channel(provider, settings)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        assert exc.value.code == "intercom_talk_busy"

    run(scenario())


def test_other_open_failures_are_unavailable_with_a_reason_and_nothing_stays_open(provider, station_fake, settings):
    async def scenario() -> None:
        for code, reason in (("station_offline", "offline"), ("Unauthorized", "provider_forbidden"), ("rate_limited", "rate_limited")):
            station_fake.errors[w10.TALK_OPEN] = code
            channel = talk_channel(provider, settings)
            with pytest.raises(ApiError) as exc:
                await channel.open()
            assert exc.value.status == 503 and exc.value.details == {"reason": reason}
        station_fake.errors.clear()
        assert not station_fake.talks and all(c.closed for c in station_fake.conns[1:])

    run(scenario())


def test_a_talk_open_answer_arx_cannot_use_is_closed_by_its_ref_at_once(provider, station_fake, settings):
    original = station_fake._talk_open

    def pcma(conn, p):
        return {**original(conn, p), "codec": "pcma"}

    station_fake._talk_open = pcma  # type: ignore[method-assign]

    async def scenario() -> None:
        channel = talk_channel(provider, settings)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        assert exc.value.details == {"reason": "talk_codec_unsupported"}
        assert len(station_fake.by_command(w10.TALK_CLOSE)) == 1 and not station_fake.talks

    run(scenario())


def test_wiskey_ending_the_talk_ends_the_session_and_no_close_is_sent(provider, station_fake, settings):
    async def scenario() -> str:
        channel = talk_channel(provider, settings)
        await channel.open()
        station_fake.emit_closed(station_fake.talks[channel.ref], "source_changed")
        reason = await asyncio.wait_for(channel.wait_closed(), 2)
        await channel.close(reason)
        return reason

    assert run(scenario()) == "upstream_closed"
    assert station_fake.by_command(w10.TALK_CLOSE) == []


def test_a_close_wiskey_cannot_finish_is_reported_not_retried_and_the_connection_is_still_dropped(provider, station_fake, settings, caplog):
    station_fake.cleanup_fails = True

    async def scenario() -> None:
        channel = talk_channel(provider, settings)
        await channel.open()
        with caplog.at_level(logging.INFO):
            await channel.close("expired")
        assert channel.link is None

    run(scenario())
    assert len(station_fake.by_command(w10.TALK_CLOSE)) == 1 and "cleanup_failed" in caplog.text
    assert station_fake.conns[1].closed


def test_a_talk_ends_when_its_connection_drops_and_the_next_talk_may_start_after_it(provider, station_fake, settings):
    async def scenario() -> None:
        channel = talk_channel(provider, settings)
        await channel.open()
        station_fake.conns[1].drop()
        assert await asyncio.wait_for(channel.wait_closed(), 2) == "upstream_closed"
        assert not station_fake.station_talk, "the station frees its talker slot with the connection"
        await channel.close("upstream_closed")
        again = talk_channel(provider, settings)
        await again.open()
        await again.close("stopped")

    run(scenario())


def test_no_key_means_no_talk_and_not_a_single_request(settings):
    station = FakeStation()
    p = im.WiskeyBridgeProvider(transport_for(station, key=None), discovery=lambda _s: load("overview_api.json"))

    async def scenario() -> None:
        d = im.parse_descriptor(descriptor_v11(), station_id="entry-a", provider="wiskey")
        channel = p.talk_open(settings, "entry-a", d, actor_id="op-1", actor_name="Dana", request_id=None, expires_at=time.time() + 60)
        with pytest.raises(ApiError) as exc:
            await channel.open()
        assert exc.value.details == {"reason": "provider_forbidden"}

    try:
        run(scenario())
        assert station.requests == [] and all(c.closed for c in station.conns)
    finally:
        p.video.close()


def test_a_local_fallback_descriptor_never_talks_through_wiskey(provider, settings):
    d = im.parse_descriptor(descriptor_v11(), station_id="entry-a", provider="local")
    with pytest.raises(ApiError) as exc:
        provider.talk_open(settings, "entry-a", d, actor_id="op-1", actor_name="x", request_id=None)
    assert exc.value.code == "intercom_talk_unsupported"


def test_an_invalid_request_id_is_replaced_by_an_arx_one_instead_of_sending_something_wiskey_refuses(provider, settings, station_fake):
    for bad in (None, "", "x" * 129, "line\nbreak"):
        channel = talk_channel(provider, settings, request_id=bad)
        assert channel.request_id.startswith("arx-") and len(channel.request_id) <= 128


# ================================================================ the talk limit (owner decision 3) and the provider selection

def conn_with(value: str | None) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    if value is not None:
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (im.TALK_MAX_KEY, value))
    return conn


def test_the_maximum_talk_time_is_an_editable_setting_bounded_and_never_above_the_descriptors_limit():
    def published(seconds: int) -> im.Descriptor:
        return im.parse_descriptor(descriptor_v11(audio={**descriptor_v11()["audio"], "max_talk_seconds": seconds}), station_id="entry-a", provider="wiskey")

    d180, free = published(180), published(86400)
    assert im.talk_limit_s(conn_with(None), d180) == 180, "default 300, the station's published 180 is smaller"
    assert im.talk_limit_s(conn_with(None), free) == 300 and im.talk_limit_s(conn_with(None)) == 300
    assert im.talk_limit_s(conn_with("60"), d180) == 60 and im.talk_limit_s(conn_with("600"), free) == 600
    assert im.talk_limit_s(conn_with("5"), free) == 5, "WKDIRECT-295: WisKey's own range 1..86400, no 10 s floor"
    assert im.talk_limit_s(conn_with("0"), free) == im.TALK_MAX_LOW_S == 1 and im.talk_limit_s(conn_with("100000"), free) == im.TALK_MAX_HIGH_S == 86400
    assert im.talk_limit_s(conn_with("not a number"), free) == 300
    assert im.talk_limit_s(sqlite3.connect(":memory:"), free) == 300, "an unreadable settings table is the default"
    talk = im.new_talk("entry-a", "u1", "dana", "r1", d180, limit_s=45)
    assert int(talk.expires_at - talk.created_at) == 45
    assert int(im.new_talk("entry-a", "u1", "dana", "r1", d180).expires_at - time.time()) in (179, 180), "without a limit the old rule stays"


def test_the_setting_is_registered_with_a_default_and_bounds():
    from smplwise.routers import settings as settings_router

    assert settings_router.DEFAULTS["access.station_media_max_talk_s"] == "300"
    assert "access.station_media_max_talk_s" in settings_router.INT_KEYS
    field = settings_router.SettingsPatch.model_fields["access_station_media_max_talk_s"]
    meta = {type(m).__name__: m for m in field.metadata}
    assert meta["Ge"].ge == 1 and meta["Le"].le == 86400
    assert settings_router.DEFAULTS["access.station_media"] == "off" and settings_router.DEFAULTS["access.station_media_provider"] == "local"


def test_auto_selects_the_signed_bridge_provider_and_local_stays_the_default(settings, monkeypatch):
    from smplwise.services import intercom_sync

    im.set_provider(None)
    monkeypatch.delenv(im.FAKE_ENV, raising=False)
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: load("overview_api.json"))
    auto = sqlite3.connect(":memory:")
    auto.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    auto.execute("INSERT INTO settings(key, value) VALUES (?, 'auto')", (im.PROVIDER_KEY,))
    monkeypatch.setattr(im._CachedKey, "__call__", lambda self: SECRET)  # a pairing key that signs (WKDIRECT-295: `auto` requires it)
    chosen = im.provider_for(settings, auto)
    assert isinstance(chosen, im.WiskeyBridgeProvider) and chosen.name == "wiskey" and chosen.media.kind == "auto"
    assert (chosen.media.direct.kind, chosen.media.fallback.kind) == ("direct_api", "signed_bridge_ws")
    assert im.provider_for(settings, auto) is chosen, "one provider (and one shared video connection) per process"
    assert im.provider_for(settings).name == "local" and im.provider_for(settings, sqlite3.connect(":memory:")).name == "local"
    assert im.PROVIDER_CHOICES == ("local", "auto") and im.MEDIA_DEFAULT == "off"
    chosen.video.close()
    im._bridge = None


def test_the_key_is_read_through_a_short_cache_and_never_shown():
    key = im._CachedKey(None)
    assert key() is None and "None" not in repr(key) and "secret" not in repr(key)


# ================================================================ WKLIVE-295: the leased stream does not outlive its viewers

@pytest.fixture()
def deleted(monkeypatch):
    """Records the stream names go2rtc is asked to delete (the Go2rtc client is never really called)."""
    names: list[str] = []
    monkeypatch.setattr(g2.Go2rtc, "delete_stream", lambda self, name, **_kw: names.append(name))
    im._LEASED.clear()
    yield names
    im._LEASED.clear()


def test_the_last_viewer_leaving_removes_the_leased_stream_from_go2rtc(provider, station_fake, settings, registered, deleted):
    name = provider.video_stream(None, settings, STATION, "main")
    assert im._LEASED[name][0] == "entry-a"
    im.MEDIA.add_viewer("entry-a", "v1", 4)
    im.MEDIA.add_viewer("entry-a", "v2", 4)
    im.MEDIA.drop_viewer("entry-a", "v1")
    assert im.release_leased_streams(settings, "entry-a") == [] and not deleted, "a viewer is still watching: its stream stays"
    im.MEDIA.drop_viewer("entry-a", "v2")
    assert im.release_leased_streams(settings, "entry-a") == [name] and deleted == [name]
    assert name not in im._LEASED and name not in g2._REGISTERED
    assert im.release_leased_streams(settings, "entry-a") == [] and deleted == [name], "nothing left to remove: no second delete"
    provider.video_stream(None, settings, STATION, "main")
    assert len(registered) == 2, "after the removal the next viewer registers the new lease's source again"


def test_an_old_lease_is_swept_by_the_next_one_unless_its_station_has_a_viewer(provider, station_fake, settings, registered, deleted):
    old = time.time() - im.LEASE_GRACE_S - 5
    im._LEASED["smplwise_wiskey_entry-b"] = im._Lease("entry-b", old)
    im._LEASED["smplwise_wiskey_entry-c"] = im._Lease("entry-c", old)
    im._LEASED["smplwise_wiskey_entry-d"] = im._Lease("entry-d", time.time())
    im.MEDIA.add_viewer("entry-c", "vc", 4)
    try:
        name = provider.video_stream(None, settings, STATION, "main")
    finally:
        im.MEDIA.drop_viewer("entry-c", "vc")
    assert deleted == ["smplwise_wiskey_entry-b"], "only the old lease without a viewer goes; a fresh lease and a watched one stay"
    assert set(im._LEASED) == {name, "smplwise_wiskey_entry-c", "smplwise_wiskey_entry-d"}


def test_only_a_leased_station_stream_of_ours_can_be_deleted(settings, deleted):
    client = g2.Go2rtc(settings)
    for bad in ("some_other_stream", "smplwise_wiskey_probe_abc123", "smplwise_" + "x" * 3, "", "smplwise_wiskey_../etc"):
        with pytest.raises(ValueError):
            client.discard_leased_stream(bad)
    assert not deleted
    client.discard_leased_stream("smplwise_wiskey_entry-a")
    assert deleted == ["smplwise_wiskey_entry-a"]


def test_a_failing_delete_never_breaks_the_end_of_a_viewer(provider, station_fake, settings, registered, deleted, monkeypatch):
    name = provider.video_stream(None, settings, STATION, "main")

    def boom(self, stream, **_kw):
        raise ApiError(503, "media_error", "x")

    monkeypatch.setattr(g2.Go2rtc, "delete_stream", boom)
    # WKF01F02-295 (F01 rule 3): an unconfirmed delete is no longer forgotten - the record and go2rtc's registration stay (quarantined)
    assert im.release_leased_streams(settings, "entry-a") == [], "never raises, and an unconfirmed delete is not reported as removed"
    assert name in im._LEASED and im._LEASED[name].quarantined and name in g2._REGISTERED
    monkeypatch.setattr(g2.Go2rtc, "delete_stream", lambda self, stream, **_kw: deleted.append(stream))
    assert im.release_leased_streams(settings, "entry-a") == [name] and deleted == [name], "the next explicit release tries once more"
