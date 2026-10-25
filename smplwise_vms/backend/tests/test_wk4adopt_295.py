"""WK4ADOPT-295: the Arx-side adoption of the WisKey reply-4 deliverables (Windows review of the Mac delivery, 2026-10-25).

W-001 (this section): `reply4-wkf01f02.patch` (sha256 df1d604b...) adopted onto release/2200 - the terminal VideoChannel / LoopThread
fence, the owner refusal of `_register_lease`, and the cleanup-handle ledger `_LEASE_TIMERS` that keeps every timer generation of an
owner (retired ones included) until it is joined. `_LEASED` stays the only stream registry. R04 (the downlink close fence) is adopted
with one identified merge (see wiskey_listen_adapter._end / _fence).

FAKES ONLY: go2rtc is an httpx.MockTransport (the WKF01F02 fixture), timers and links are doubles. Nothing here proves anything about a
real go2rtc, WisKey, station, microphone or speaker."""
from __future__ import annotations

import asyncio
import hashlib
import threading
import time
import warnings
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from test_wkf01f02_295 import go2rtc, gset, owner, register  # noqa: F401 - the shared WKF01F02 fixtures

from smplwise.errors import ApiError
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services.wiskey_listen_adapter import ReceiveDownlink, SyntheticDownlink

BACKEND = Path(__file__).resolve().parents[1]
PATCH_AFTER = {  # PATCH_TARGET.json of the Mac delivery: the after-hash of each file on the exact base 9eca5e92
    "smplwise/services/wiskey_media_bridge.py": "7c8181d66218a9a293dde4f3a254d9765ed2ad23684200b701292b8fba6a842c",
}


def _owner_timers(who: Any) -> list[Any]:
    with im._LEASE_LOCK:
        return [t for w, t in im._LEASE_TIMERS if w is who]


# ================================================================ W-001: identity of the adopted source

def test_the_media_bridge_is_byte_identical_to_the_reviewed_patch_result():
    """wiskey_media_bridge.py did not drift from 9eca: the adopted file IS the reviewed after-file (sha256 from PATCH_TARGET.json).
    intercom_media.py / wiskey_listen_adapter.py differ on purpose (W-002 wiring, the R04 identified merge) - see docs/changes."""
    for rel, want in PATCH_AFTER.items():
        assert hashlib.sha256((BACKEND / rel).read_bytes()).hexdigest() == want, rel


def test_lease_timers_is_a_handle_ledger_never_a_second_registry():
    assert isinstance(im._LEASED, dict) and isinstance(im._LEASE_TIMERS, list)
    src = (BACKEND / "smplwise/services/intercom_media.py").read_text(encoding="utf-8")
    assert src.count("_LEASED: dict[str, _Lease] = {}") == 1, "exactly one stream registry"
    assert "_LEASE_TIMERS[name]" not in src and "_LEASE_TIMERS.get(" not in src, "the ledger is never keyed by stream name"


# ================================================================ W-001: the terminal owner fence

def test_a_closed_video_channel_cannot_register_a_lease_and_its_runner_cannot_restart(go2rtc, gset):
    channel = bridge.VideoChannel(SimpleNamespace())
    channel.runner.run(asyncio.sleep(0), 2)  # the loop thread exists
    channel.close()
    assert channel.closed is True
    with pytest.raises(ApiError) as refused:
        register(gset, channel, 5)
    assert refused.value.status == 503 and not im._LEASED, "a closed owner obtains no stream"
    with warnings.catch_warnings():
        warnings.simplefilter("error")  # a refused coroutine is closed, never left un-awaited
        with pytest.raises(bridge.MediaBridgeError) as stopped:
            channel.runner.run(asyncio.sleep(0), 2)
    assert stopped.value.code == "connection_closed"


def test_a_connect_that_finishes_after_close_is_closed_and_never_adopted():
    class Link:
        closed = False
        closes = 0

        async def close(self) -> None:
            self.closes += 1
            self.closed = True

    link = Link()

    class Runner:
        def run(self, coro: Any, timeout: float) -> Any:
            coro.close()

        def stop(self) -> None:
            pass

    async def scenario() -> None:
        channel: bridge.VideoChannel | None = None

        class Transport:
            async def connect(self, purpose: str) -> Any:
                assert channel is not None
                channel.close()  # the owner closes while the connect is still in flight
                return link

        channel = bridge.VideoChannel(Transport(), runner=Runner())
        with pytest.raises(bridge.MediaBridgeError) as closed:
            await channel._get()
        assert closed.value.code == "connection_closed"
        assert link.closes == 1 and channel._link is None, "the late link is closed, not kept"

    asyncio.run(scenario())


def test_the_loop_thread_stop_joins_its_thread_and_is_terminal():
    runner = bridge.LoopThread()
    assert runner.run(asyncio.sleep(0, result=7), 2) == 7
    thread = runner._thread
    runner.stop()
    assert thread is not None and not thread.is_alive() and runner._loop is None
    with pytest.raises(bridge.MediaBridgeError):
        runner.run(asyncio.sleep(0), 1)
    runner.stop()  # a second stop is a no-op


# ================================================================ W-001: every timer generation is joined, retired ones included

def test_close_joins_a_retired_generation_still_in_the_ledger(go2rtc, gset, monkeypatch):
    monkeypatch.setattr(im, "LEASE_GRACE_S", 0.0)
    who = owner()
    name = register(gset, who, 5)
    assert register(gset, who, 5) == name  # a second generation
    generations = _owner_timers(who)
    assert len(generations) == 2
    assert im.release_leased_streams(gset, "entry-a") == [name], "the record is retired (no viewer)"
    assert name not in im._LEASED
    assert im.close_leased_streams(who) is True
    assert not any(t.is_alive() for t in generations) and _owner_timers(who) == [], "retired generations were joined, then released"


def test_a_generation_that_does_not_join_keeps_its_handle_and_close_reports_unresolved(go2rtc, gset, monkeypatch):
    monkeypatch.setattr(im, "_LEASE_TIMER_JOIN_S", 0.01)
    who = owner()
    release = threading.Event()

    class Stuck:
        def cancel(self) -> None:
            pass

        def join(self, timeout: float | None = None) -> None:
            release.wait(timeout or 0)

        def is_alive(self) -> bool:
            return not release.is_set()

    stuck = Stuck()
    with im._LEASE_LOCK:
        im._LEASE_TIMERS.append((who, stuck))
    try:
        assert im.close_leased_streams(who) is False, "an unjoined generation is not success"
        assert _owner_timers(who) == [stuck], "the handle is kept for a later close"
        release.set()
        assert im.close_leased_streams(who) is True and _owner_timers(who) == []
    finally:
        with im._LEASE_LOCK:
            im._LEASE_TIMERS[:] = [(w, t) for w, t in im._LEASE_TIMERS if t is not stuck]


def test_a_foreign_owners_generation_is_never_joined_or_dropped(go2rtc, gset):
    mine, theirs = owner(), owner()
    register(gset, mine, 5)
    other = register(gset, theirs, 5)
    foreign = _owner_timers(theirs)
    assert im.close_leased_streams(mine) is True
    assert other in im._LEASED and _owner_timers(theirs) == foreign and all(t.is_alive() for t in foreign)
    assert im.close_leased_streams(theirs) is True


# ================================================================ W-001 / R04: the downlink close fence (identified merge)

def test_a_close_joins_a_receive_that_answers_late_and_publishes_nothing_after_it():
    async def scenario() -> None:
        started, release = asyncio.Event(), asyncio.Event()
        calls = 0

        async def receive() -> bytes:
            nonlocal calls
            calls += 1
            started.set()
            try:
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                await release.wait()
                return b"\x7f" * 800  # a receive that swallows the cancel and answers with sound
            return b""

        downlink = ReceiveDownlink.for_talk(receive)
        await downlink.open()
        await started.wait()
        closer = asyncio.create_task(downlink.close("ended"))
        await asyncio.sleep(0.01)
        assert not closer.done(), "the close waits for its producer"
        release.set()
        await asyncio.wait_for(closer, 2)
        got = [f async for f in downlink.frames()]
        assert got == [] and calls == 1 and downlink.received_frames == 0, "no late sound and no second receive"
        assert await downlink.wait_closed() == "ended"

    asyncio.run(scenario())


def test_a_cancelled_close_caller_still_waits_for_the_cleanup_it_started():
    async def scenario() -> None:
        hook_entered, hook_release = asyncio.Event(), asyncio.Event()
        finished: list[str] = []

        async def on_close(reason: str) -> None:
            hook_entered.set()
            await hook_release.wait()
            finished.append(reason)

        downlink = ReceiveDownlink(lambda: asyncio.sleep(3600), on_close=on_close)
        await downlink.open()
        closer = asyncio.create_task(downlink.close("stopped"))
        await hook_entered.wait()
        closer.cancel()
        await asyncio.sleep(0.01)
        assert not closer.done(), "the cancelled caller still owns the unfinished cleanup"
        hook_release.set()
        with pytest.raises(asyncio.CancelledError):
            await closer
        assert finished == ["stopped"]

    asyncio.run(scenario())


def test_a_natural_upstream_end_still_plays_the_frames_admitted_before_it():
    """The identified merge: reply4 drained the queue on EVERY end; the combined tree's WKAUDIN contract delivers frames that were
    admitted while current before a natural upstream end. Only a close (`_fence`) drains."""
    async def scenario() -> None:
        downlink = SyntheticDownlink([b"\x01" * 160, b"\x02" * 160])
        await downlink.open()
        got = [f async for f in downlink.frames()]
        assert got == [b"\x01" * 160, b"\x02" * 160]
        assert await downlink.wait_closed() == "upstream_closed"
        await downlink.close("ended")

    asyncio.run(scenario())


def test_frames_queued_when_a_close_arrives_are_dropped():
    async def scenario() -> None:
        downlink = SyntheticDownlink([b"\x01" * 160] * 3, end_reason=None)
        await downlink.open()
        await asyncio.sleep(0.01)
        await downlink.close("ended")
        assert [f async for f in downlink.frames()] == []

    asyncio.run(scenario())


# ================================================================ W-002: the native lifetime change and the floor heartbeat, together

import base64  # noqa: E402
from datetime import datetime, timedelta, timezone  # noqa: E402

from test_wkf01f02_295 import ListeningStation, SocketDouble, listen_schema, session, settle, talk_on  # noqa: E402,F401
from w10_fake_station import FakeConn, FakeStation  # noqa: E402

from smplwise.routers import intercom_media as router_im  # noqa: E402
from smplwise.services import wiskey_media_contract as w10  # noqa: E402

PACKET = bytes([0x55]) * 800


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Rev2Station(ListeningStation):
    """The fake WisKey with the reply-4 operation lifetime (`arx.station_talk_audio.v1` revision 2, CODE 924df3e9), as the review
    describes it: the command proof of the last signed request lasts `proof_s`; a genuine admitted downlink packet refreshes the 12 s
    (here `idle_s`) activity clock but never the proof; silence or the signed `expires_at` ends the talk. `terminal_event_after_expiry`
    False reproduces finding WR4-01 (BridgeTalkSession.run checks the expired proof before `media/talk_closed` and swallows the refusal:
    the resource ends, NO event reaches the original subscription); True is the behaviour requested from Mac."""

    def __init__(self, *, terminal_event_after_expiry: bool) -> None:
        super().__init__()
        self.idle_s = 0.3
        self.proof_s = 0.1
        self.terminal_event_after_expiry = terminal_event_after_expiry
        self.proof_until: dict[str, float] = {}
        self.ended: list[tuple[str, str, bool]] = []  # (talk_ref, reason, event sent)

    async def handle(self, conn: FakeConn, message: dict[str, Any]) -> dict[str, Any]:
        reply = await super().handle(conn, message)
        talk = conn.talk
        if talk is not None and reply.get("success"):
            self.proof_until[talk.ref] = self.clock() + self.proof_s  # the proof of THIS signed request; audio never extends it
        return reply

    def emit_audio(self, ref: str, seq: int, packet: bytes, override: dict[str, Any] | None = None) -> None:
        talk = self.talks[ref]
        talk.touched = self.clock()  # a fresh admitted packet: activity only (no proof, no descriptor, no expires_at renewal)
        super().emit_audio(ref, seq, packet, override)

    def end_by_rule(self, talk: Any, reason: str) -> None:
        proof_alive = self.clock() < self.proof_until.get(talk.ref, 0.0)
        event = proof_alive or self.terminal_event_after_expiry
        self.ended.append((talk.ref, reason, event))
        if event:
            self.emit_closed(talk, reason)
        else:
            self.end_talk(talk)  # WR4-01: the native resource is cleaned up, the terminal event is swallowed

    async def rules(self, every: float = 0.01) -> None:
        while True:
            await asyncio.sleep(every)
            now = self.clock()
            for talk in list(self.talks.values()):
                if now - talk.touched >= self.idle_s:
                    self.end_by_rule(talk, "idle_timeout")
                elif _utcnow() >= talk.expires:
                    self.end_by_rule(talk, "expired")


def _signed(station: FakeStation, *commands: str) -> int:
    return sum(len(station.by_command(c)) for c in commands)


def _late_event(ref: str, seq: int) -> dict[str, Any]:
    return {"type": "media/talk_audio", "schema": "arx.station_talk_audio.v1", "talk_ref": ref, "seq": seq, "codec": "pcmu",
            "sample_rate": 8000, "channels": 1, "data": base64.b64encode(PACKET).decode()}


def test_the_talk_sends_no_periodic_floor_even_when_old_options_ask_for_one(gset, listen_schema):
    station = ListeningStation()

    async def scenario() -> None:
        channel = await talk_on(station, gset)  # pump_options carry heartbeat_s=0.2 (the pre-reply-4 setting)
        await channel.open()
        assert channel.pump.heartbeat_s == float("inf")
        await asyncio.sleep(0.7)
        assert _signed(station, w10.TALK_FLOOR, w10.TALK_FRAME) == 0, "no synthetic floor / frame keeps the talk alive"
        await channel.floor(True)  # a genuine floor still goes out
        assert _signed(station, w10.TALK_FLOOR) == 1
        await channel.close("ended")

    asyncio.run(scenario())


async def _rev2_talk(station: Rev2Station, settings: Any, seconds: float) -> tuple[Any, Any, Any, Any, asyncio.Task[str]]:
    channel = await talk_on(station, settings)
    await channel.open()
    t = session(seconds)
    channel.expires_at = t.expires_at
    ws = SocketDouble()
    task = asyncio.create_task(router_im._pump(ws, t, channel, SimpleNamespace(should_stop=lambda: False)))
    return channel, t, ws, station.talks[channel.ref], task


async def _audio_after_the_proof_expired(station: Rev2Station, channel: Any, ws: Any, count: int) -> None:
    await asyncio.sleep(station.proof_s * 2)  # the admission proof has expired; nothing new is signed
    for seq in range(count):
        station.emit_audio(channel.ref, seq, PACKET)
        await settle(lambda: len(ws.sent_bytes) == seq + 1)
        await asyncio.sleep(station.idle_s / 3)  # real audio keeps the ORIGINAL operation alive past the idle window


def test_wr4_01_consumer_idle_after_proof_expiry_with_the_terminal_event_closes_the_original_channel(gset, listen_schema):
    """The behaviour requested from Mac: after the short proof expired and genuine audio kept the original talk alive, silence ends it
    and `media/talk_closed` reaches the ORIGINAL subscription - Arx's waiter ends, the resource is gone, no late audio, no renewal."""
    station = Rev2Station(terminal_event_after_expiry=True)

    async def scenario() -> None:
        rules = asyncio.create_task(station.rules())
        try:
            channel, _t, ws, talk, task = await _rev2_talk(station, gset, 30)
            await _audio_after_the_proof_expired(station, channel, ws, 4)
            outcome = await asyncio.wait_for(task, 3)
            assert outcome == "upstream_closed" and await channel.wait_closed() == "upstream_closed"
            assert station.ended == [(channel.ref, "idle_timeout", True)] and talk.closed and channel.ref not in station.talks
            published = list(ws.sent_bytes)
            with pytest.raises(KeyError):
                station.emit_audio(channel.ref, 4, PACKET)  # the native resource is gone: no packet can follow
            channel._on_event(_late_event(channel.ref, 4))
            with pytest.raises(bridge.MediaBridgeError):
                await asyncio.wait_for(channel.receive_audio(), 1)  # a late event is never served
            await channel.close(outcome)
            assert ws.sent_bytes == published == [PACKET] * 4
            assert _signed(station, w10.TALK_OPEN) == 1, "no replay of the open"
            assert _signed(station, w10.TALK_FLOOR, w10.TALK_FRAME) == 0, "no authority renewal, no keepalive"
            assert _signed(station, w10.TALK_CLOSE) == 0, "WisKey closed it: nothing more is signed"
            assert channel.link is None
        finally:
            rules.cancel()

    asyncio.run(scenario())


def test_wr4_01_consumer_signed_expiry_with_the_terminal_event_closes_the_original_channel(gset, listen_schema):
    station = Rev2Station(terminal_event_after_expiry=True)
    station.idle_s = 30.0  # never quiet: the signed deadline ends it

    async def scenario() -> None:
        rules = asyncio.create_task(station.rules())
        try:
            channel = await talk_on(station, gset)
            await channel.open()
            talk = station.talks[channel.ref]
            talk.expires = _utcnow() + timedelta(seconds=0.6)  # the signed expires_at of the original talk_open
            ws = SocketDouble()
            task = asyncio.create_task(router_im._pump(ws, session(30), channel, SimpleNamespace(should_stop=lambda: False)))
            seq = 0
            while not task.done() and seq < 40:
                if channel.ref in station.talks:
                    station.emit_audio(channel.ref, seq, PACKET)
                    seq += 1
                await asyncio.sleep(0.05)
            outcome = await asyncio.wait_for(task, 3)
            assert outcome == "upstream_closed" and station.ended == [(channel.ref, "expired", True)]
            await channel.close(outcome)
            assert 0 < len(ws.sent_bytes) <= seq and _signed(station, w10.TALK_OPEN) == 1
            assert _signed(station, w10.TALK_FLOOR, w10.TALK_FRAME, w10.TALK_CLOSE) == 0
            channel._on_event(_late_event(channel.ref, seq))  # an event that arrives after the end
            with pytest.raises(bridge.MediaBridgeError):
                await asyncio.wait_for(channel.receive_audio(), 1)  # is never served
        finally:
            rules.cancel()

    asyncio.run(scenario())


def test_wr4_01_as_delivered_the_event_is_lost_and_only_arxs_own_deadline_ends_the_channel(gset, listen_schema):
    """WR4-01 on the CURRENT native behaviour: the resource ends silently after proof expiry. Arx's channel does NOT end by an event; it
    ends at Arx's own session deadline (the router's watch), with ONE talk_close, no late audio, no new open, no renewal. This bounds the
    effect of the finding; it is not the requested fix (private/planning/wiskey_inbox_2026-10-24/wr4-01-request-to-mac.md)."""
    station = Rev2Station(terminal_event_after_expiry=False)

    async def scenario() -> None:
        rules = asyncio.create_task(station.rules())
        try:
            channel, _t, ws, talk, task = await _rev2_talk(station, gset, 2.0)
            await _audio_after_the_proof_expired(station, channel, ws, 2)
            await settle(lambda: talk.closed, timeout=2)
            assert station.ended == [(channel.ref, "idle_timeout", False)], "the terminal event was swallowed"
            assert not task.done() and not channel._future().done(), "the original waiter is still open: the finding"
            outcome = await asyncio.wait_for(task, 4)
            assert outcome == "expired", "Arx's own deadline ended it"
            await channel.close(outcome)
            assert ws.sent_bytes == [PACKET] * 2
            assert _signed(station, w10.TALK_OPEN) == 1 and _signed(station, w10.TALK_FLOOR, w10.TALK_FRAME) == 0
            assert _signed(station, w10.TALK_CLOSE) == 1, "one close for the original ref (answered session_expired), never repeated"
            assert channel.link is None and channel._incoming.empty()
        finally:
            rules.cancel()

    asyncio.run(scenario())


def test_rev2_states_a_second_caller_gets_busy_and_mute_keeps_the_downlink(gset, listen_schema):
    station = ListeningStation()

    async def scenario() -> None:
        first = await talk_on(station, gset)
        await first.open()
        second = await talk_on(station, gset)
        with pytest.raises(ApiError) as busy:
            await second.open()
        assert busy.value.status == 409 and busy.value.code == "intercom_talk_busy", "shared slot: audio_busy, no eviction"
        assert first.ref in station.talks, "the first talk is not preempted"
        await first.floor(True)
        await first.floor(False)  # mute releases the floor ...
        station.emit_audio(first.ref, 0, PACKET)
        assert await asyncio.wait_for(first.receive_audio(), 2) == PACKET, "... and the station's sound goes on"
        await first.close("ended")

    asyncio.run(scenario())


# ================================================================ W-005: the five mapping artifacts and seven actions (card capture)

import json as _json  # noqa: E402

from smplwise.services import lease_answers as la  # noqa: E402
from smplwise.services import lease_events as le  # noqa: E402
from smplwise.services import wiskey_capture_direct as cd  # noqa: E402
from smplwise.services import wiskey_capture_map as cm  # noqa: E402
from smplwise.services.wiskey_capture_port import PortError  # noqa: E402

REPO = BACKEND.parents[1]
VECTORS = _json.loads((BACKEND / "tests/fixtures/wiskey_vectors/wiskey_capture_two_layer_vectors_v1.json").read_text(encoding="utf-8"))
# W005_CAPTURE_MAP.json `chain`: the Arx files Mac mapped against, by file sha256 (Arx CODE fe213bd7 / e476e48a)
MAC_PINNED_ARX = {
    "custom_components/smplwise_bridge/lease_service.py": "3872e87c892d004b6f35e2ccde3cb792f38cc39bc426073ee10b30a7194b9b9b",
    "custom_components/smplwise_bridge/lease_contract.py": "16b2e9eb91c46f7d9833525ab182df495d70cb84ba532ecede333712118d9a01",
    "smplwise_vms/backend/smplwise/services/wiskey_capture_direct.py": "7b6a62ae0fb5bb0f8c56126a6263d7355aae07496c816c23df2649683e316fd1",
}
# W005_CAPTURE_REFUSALS.json `closed_native_tables.refused` (WisKey CAPTURE_ANSWER_CODES.json sha256 624383ca...), verbatim
MAC_REFUSED = {
    "capture_start": ["capture_station_busy", "capture_limit", "revision_conflict", "lease_gone", "binding_denied", "capture_unsupported",
                      "capture_reader_invalid", "capture_failed"],
    "capture_status": ["capture_not_found", "lease_gone", "binding_denied", "capture_operation_busy"],
    "capture_confirm": ["capture_not_ready", "invalid_text", "capture_operation_busy", "capture_not_found", "lease_gone", "binding_denied",
                        "card_conflict", "revision_conflict"],
    "capture_cancel": ["capture_not_found", "lease_gone", "binding_denied", "capture_applying"],
}
MAC_SESSION_UNCHANGED = {"capture_applying", "capture_not_ready", "capture_operation_busy", "invalid_text"}


class _Inner:
    def __init__(self) -> None:
        self.calls: list[Any] = []

    def event(self, settings: Any, text: str) -> Any:
        self.calls.append(("event", text))
        return {"result": "host"}

    def request(self, settings: Any, action: str, text: str) -> Any:
        self.calls.append((action, text))
        return {"result": "host"}


def _vector(action: str) -> dict[str, Any]:
    return next(r for r in VECTORS["vectors"] if _json.loads(r["signed_message_json"])["action"] == action)


def _with_params(text: str, mutate: Any) -> str:
    m = _json.loads(text)
    mutate(m["params"])
    return _json.dumps(m, separators=(",", ":"))


def test_w005_the_arx_receiver_chain_is_the_one_mac_mapped_against():
    for rel, want in MAC_PINNED_ARX.items():
        assert hashlib.sha256((REPO / rel).read_bytes()).hexdigest() == want, rel


def test_w005_seven_actions_two_commands_and_the_closed_params_keys_agree_with_arxs_own_messages():
    assert [r.action for r in cm.MAP] == list(le.ALL_ACTIONS) and cm.confirmed()
    for r in cm.MAP:
        assert r.direct_command == (cd.EVENT_COMMAND if r.action in le.EVENT_ACTIONS else cd.REQUEST_COMMAND)
        assert r.mac_file.startswith("custom_components/hikvision_intercom/") and len(r.mac_sha256) == 64
    seen = set()
    for row in VECTORS["vectors"]:
        m = _json.loads(row["signed_message_json"])
        if m["action"] in cm.ROW_OF and "kid" not in m and set(m) == cm.WIRE_KEYS:
            assert set(m["params"]) == cm.ROW_OF[m["action"]].params_keys, m["action"]
            seen.add(m["action"])
    assert seen, "at least the vector actions agree with Mac's keys"
    assert cm.enabled() is False, "CAPMAP stays disabled"


def test_w005_the_closed_inner_tables_are_macs_and_there_is_no_outer_enum():
    assert {a: list(v) for a, v in la.REFUSED.items()} == MAC_REFUSED
    assert set(la.SESSION_UNCHANGED) == MAC_SESSION_UNCHANGED


def test_w005_an_added_or_missing_params_key_and_a_non_null_binding_revision_are_refused_before_any_call():
    inner = _Inner()
    t = cm.MappedLeaseTransport(inner, lambda: {cd.EVENT_COMMAND, cd.REQUEST_COMMAND}, is_enabled=lambda: True)
    start = _vector("capture_start")["signed_message_json"]
    for mutate, reason in ((lambda p: p.update(extra=1), "params_mismatch"), (lambda p: p.pop("lease"), "params_mismatch"),
                           (lambda p: p["lease"].update(binding_revision="b1"), "binding_revision_unsupported")):
        with pytest.raises(cm.CaptureProjectionError) as refused:
            t.request(None, "capture_start", _with_params(start, mutate))
        assert refused.value.reason == reason and refused.value.details["outcome"] == "not_sent"
    assert inner.calls == [], "nothing was handed to the transport"


def test_w005_the_announcement_prefers_the_current_direct_capabilities_and_ignores_api_contract_null():
    caps = {"commands": [cd.REQUEST_COMMAND, cd.EVENT_COMMAND], "api_contract": {cd.REQUEST_COMMAND: None}}
    overview = {"commands": ["something/else"]}
    assert cm.announced_commands(caps, overview) == (frozenset(caps["commands"]), "direct_capabilities")
    assert cm.announced_commands(None, {"commands": [cd.EVENT_COMMAND], "api_contract": None}) == (frozenset({cd.EVENT_COMMAND}), "overview_api")
    assert cm.announced_commands({"commands": "x"}, {}) == (None, "unknown"), "unreadable is unknown, not unsupported"


def test_w005_provenance_keeps_where_an_outcome_came_from_and_never_permits_a_replay():
    pre = cm.provenance(cm.CaptureUnsupported("mapping_disabled"))
    assert (pre.phase, pre.not_sent_proven) == ("local_preflight", True)
    not_sent = cm.provenance(cd._api_error(PortError("wiskey_direct_not_connected", "not_sent")))
    assert (not_sent.phase, not_sent.not_sent_proven) == ("transport_not_sent", True)
    for code in ("Unauthorized", "invalid_fields"):  # may come before OR after dispatch: the code alone proves nothing
        p = cm.provenance(cd._api_error(PortError(code, "refused")))
        assert p.not_sent_proven is False and p.code == code
    unknown = cm.provenance(cd._api_error(PortError("capture_outcome_unknown", "unknown")))
    assert (unknown.phase, unknown.not_sent_proven) == ("unknown", False)
    assert cm.provenance(("rejected", {"code": "time/expired"})) == cm.Provenance("remote_rejected", "time/expired", False)
    assert cm.provenance(("refused", {"code": "lease_gone"})).not_sent_proven is False
    assert cm.provenance(("sent_unknown", {})).phase == "sent_unknown"
    assert cm.provenance(("unknown", {"code": "invalid_response"})).phase == "unknown"
    assert cm.provenance(object()).phase == "unknown"
    assert not any(cm.provenance(x).replay_permitted for x in (("sent_unknown", {}), ("unknown", {}), cm.CaptureUnsupported("mapping_disabled")))


# ================================================================ W-010: dedicated LiveRegistryTransport / LiveResolveTransport

import sqlite3 as _sqlite3  # noqa: E402

from test_wkjoin_295 import JoinServer  # noqa: E402
from w10_fake_station import SECRET as _SECRET  # noqa: E402

from smplwise.services import wiskey_direct_join as join  # noqa: E402
from smplwise.services import wiskey_intents as wi  # noqa: E402
from smplwise.services import wiskey_peer as wp  # noqa: E402
from smplwise.services import wiskey_peer_registry as wr  # noqa: E402

P_REPO = "11111111-2222-4333-8444-555555555555"
P_OWNER = "arx-service:entry-1"  # the JoinServer's server-issued subject
P_BINDING, P_REV, P_PEER = "bind-1", 2, "peer-arx-1"
MIG_0145 = BACKEND / "smplwise" / "migrations" / "0145_wiskey_peer_intents_feature_registry.sql"


def _row(state: str = "active", **kw: Any) -> dict[str, Any]:
    row = {"schema_version": 1, "protocol": wr.PROTOCOL, "verified_peer_ref": P_PEER, "peer_binding_ref": P_BINDING,
           "peer_binding_revision": P_REV, "query_owner_id": P_OWNER, "repository_id": P_REPO, "allowed_read_scope": wr.READ_SCOPE,
           "state": state, "active": state == "active", "historical_read": False, "successor": None}
    return {**row, **kw}


@pytest.fixture()
def peer_env() -> Any:
    server = JoinServer(repository_id=P_REPO)
    transport = bridge.DirectApiTransport(server.opener, lambda: _SECRET)
    session = join.DirectCommandSession(transport)
    port = join.DirectCapturePort(session)
    yield SimpleNamespace(server=server, session=session, port=port, registry=wr.LiveRegistryTransport(port, timeout_s=0.5),
                          resolve=wi.LiveResolveTransport(port, timeout_s=0.5))
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


def _client(env: Any) -> wr.RegistryClient:
    env.session.connect_ready(2)
    pin = wr.OwnerPin(P_OWNER, P_REPO, P_PEER, P_BINDING, P_REV)
    return wr.RegistryClient(env.registry, pin, env.registry.attestation())


def test_w010_without_a_port_the_live_reads_still_refuse_not_built_and_send_nothing():
    with pytest.raises(wr.RegistryRefused) as reg:
        wr.LiveRegistryTransport().peer_binding_get(P_BINDING, P_REV)
    assert reg.value.code == "not_built"
    peer = wp._mint_peer(value=P_PEER, peer_binding_ref=P_BINDING, peer_binding_revision=P_REV, repository_id=P_REPO, query_owner_id=P_OWNER)
    verdict, receipt = wi.LiveResolveTransport().read(peer, wp.ResolveOriginal.of(peer, descriptor_epoch="e1", descriptor={"r": 1}))
    assert (verdict.state, verdict.code, receipt) == ("unknown", "not_built", None)


def test_w010_the_registry_read_goes_signed_over_the_verified_connection_and_a_found_row_mints_the_peer(peer_env):
    peer_env.server.script["peer_bindings/get"] = {"result": _row()}
    client = _client(peer_env)
    assert client.attestation.query_owner_id == P_OWNER, "attested from the connection's own identity"
    verdict = client.current()
    assert verdict.ok and verdict.peer.value == P_PEER and verdict.peer.query_owner_id == P_OWNER
    (command, kind, params), = [r for r in peer_env.server.received if r[0] == "peer_bindings/get"]
    assert kind == "wiskey-peer-query.v1" and params == {"peer_binding_ref": P_BINDING, "peer_binding_revision": P_REV}
    assert peer_env.registry.receipts == [wp.PeerReadReceipt("peer_bindings/get", "result")]


@pytest.mark.parametrize("act, outcome", [({"error": "binding_denied"}, "refused"), ("close", "unknown"), ("drop", "unknown"),
                                          ({"result": {"unexpected": True}}, "result")])
def test_w010_a_refusal_a_disconnect_a_timeout_or_a_malformed_row_is_never_a_binding(peer_env, act, outcome):
    peer_env.server.script["peer_bindings/get"] = act
    verdict = _client(peer_env).current()
    assert verdict.ok is False and verdict.code in ("unknown", "malformed") and verdict.peer is None
    assert peer_env.registry.receipts[-1].outcome == outcome and not peer_env.registry.receipts[-1].replay_permitted
    assert len([r for r in peer_env.server.received if r[0] == "peer_bindings/get"]) == 1, "never retried"


def _intent(c: _sqlite3.Connection, peer: Any) -> Any:
    o = wi.admit(c, peer=peer, operation_id="op-1", request_id="req-1", origin_ref="origin-1", operation_binding_ref="obr-1",
                 issued_epoch=1, command="users/update", user_id="u-1", revision_before=4)
    wi.mark_sent(c, o)
    return o


@pytest.mark.parametrize("act, settle, state, outcome", [
    ({"result": {"schema_version": 1, "state": "found", "receipt": {"central_state": "committed", "device_application": "unknown",
                                                                   "signed_capture_covered": False, "person_revision": 5}}},
     "settled", "committed", "result"),
    ({"result": {"schema_version": 1, "state": "unknown", "receipt": None}}, "open", "unknown", "result"),
    ({"error": "original_reference_mismatch"}, "open", "unknown", "refused"),
    ("close", "open", "unknown", "unknown"),
])
def test_w010_resolve_found_settles_once_and_unknown_refusal_disconnect_stay_open_and_unsendable(peer_env, act, settle, state, outcome):
    peer_env.server.script["peer_bindings/get"] = {"result": _row()}
    peer_env.server.script["peer_receipts/resolve"] = act
    current = _client(peer_env).current().peer
    c = _sqlite3.connect(":memory:")
    c.executescript(MIG_0145.read_text(encoding="utf-8"))
    o = _intent(c, current)
    original = wp.ResolveOriginal.of(current, descriptor_epoch="epoch-7", descriptor={"request": {"id": "req-1"}, "action": "users/update"})
    result, verdict, receipt = wi.resolve_intent(c, o, original, current, peer_env.resolve)
    assert (result, wi.state(c, o), receipt.outcome) == (settle, state, outcome)
    assert verdict.replay_permitted is False and wi.state(c, o) != "never_committed"
    with pytest.raises(wi.IntentError):
        wi.mark_sent(c, o)  # an UNKNOWN (or settled) intent can never be sent again: no replay
    sent = [p for cmd, _k, p in peer_env.server.received if cmd == "peer_receipts/resolve"]
    assert len(sent) == 1 and sent[0] == wp.resolve_parameters(current, original), "the exact original, once"


def test_wr6_01_a_local_refusal_after_a_successful_read_returns_no_receipt_and_sends_nothing(peer_env):
    """WR6-01: the receipt of a read belongs to THAT read. A success first, then `resolve_parameters` refusing locally
    (original_reference_mismatch): no frame leaves, the verdict is UNKNOWN and the returned receipt is None - never the earlier one."""
    peer_env.server.script["peer_bindings/get"] = {"result": _row()}
    peer_env.server.script["peer_receipts/resolve"] = {"result": {"schema_version": 1, "state": "unknown", "receipt": None}}
    current = _client(peer_env).current().peer
    original = wp.ResolveOriginal.of(current, descriptor_epoch="epoch-7", descriptor={"request": {"id": "req-1"}})
    first, first_receipt = peer_env.resolve.read(current, original)
    assert first_receipt == wp.PeerReadReceipt("peer_receipts/resolve", "result") and first.state == "unknown"
    other = wp._mint_peer(value="peer-other", peer_binding_ref=P_BINDING, peer_binding_revision=P_REV, repository_id=P_REPO,
                          query_owner_id=P_OWNER)
    foreign = wp.ResolveOriginal.of(other, descriptor_epoch="epoch-7", descriptor={"request": {"id": "req-2"}})
    sent_before = len([c for c, _k, _p in peer_env.server.received if c == "peer_receipts/resolve"])
    verdict, receipt = peer_env.resolve.read(current, foreign)
    assert (verdict.state, verdict.settles, verdict.code) == ("unknown", False, "original_reference_mismatch")
    assert receipt is None, "no stale receipt of the earlier read"
    assert len([c for c, _k, _p in peer_env.server.received if c == "peer_receipts/resolve"]) == sent_before, "no frame was sent"
    assert peer_env.resolve.receipts == [first_receipt], "the history holds only the read that happened"
    with pytest.raises(wp.PeerSeamError) as refused:
        peer_env.resolve.resolve(current, foreign)
    assert refused.value.code == "original_reference_mismatch"


def test_w010_the_direct_join_owns_both_dedicated_transports(monkeypatch):
    monkeypatch.setattr(join, "JOIN", None)
    from smplwise.services import lease_events
    from smplwise.services import wa_template_send as wts

    saved = (lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER)
    try:
        installed = join.startup(None, SimpleNamespace(), opener=lambda: None, open_lineage=False, provider_reader=lambda: True,
                                 key_reader=lambda: _SECRET)
        assert isinstance(installed.registry_transport, wr.LiveRegistryTransport) and installed.registry_transport.port is installed.capture_port
        assert isinstance(installed.resolve_transport, wi.LiveResolveTransport) and installed.resolve_transport.port is installed.capture_port
    finally:
        join.shutdown()
        lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER = saved


# ================================================================ W-013: template_send_v2 wired to the original source, fake sender only

import datetime as _dt  # noqa: E402

from smplwise.services import intercom_messaging_adapter as _adapter  # noqa: E402
from smplwise.services import messaging_accounts as _ma  # noqa: E402
from smplwise.services import wa_pacing as _wpace  # noqa: E402
from smplwise.services import wa_template_send as T  # noqa: E402
from smplwise.services import wiskey_template_direct as wtd  # noqa: E402

T_NOW = _dt.datetime(2026, 10, 25, 9, 0, 0, tzinfo=_dt.timezone.utc)
T_REF = T.TemplateRef("access", "synthetic_access", "he", ("name",), "notice", "synthetic-template", 3)


def _v2_sender(transport: Any, *, permit: bool) -> T.TemplateSender:
    pacer = _wpace.WaPacer(_ma.MemorySendLedger(), _wpace.MemoryPacerStore(), config=lambda: _wpace.PacerConfig(mode="off"))
    return T.TemplateSender(transport, registry=lambda: [T_REF], switch=lambda: True, permit_fn=lambda: permit, pacer=pacer,
                            pacing_for=lambda _k: _ma.Pacing(), clock=lambda: T_NOW)


def _send(sender: T.TemplateSender, **kw: Any) -> T.TemplateResult:
    args = dict(template_id="access", account="synthetic-account", account_key="entry:acc", person_id="synthetic-person-25",
                person_revision=7, recipient_key="p25", request_id="synthetic-request-25", operation_id="synthetic-operation-25")
    return sender.send_v2(**{**args, **kw})


def test_w013_the_permit_stays_false_and_production_refuses_before_any_hand_over(peer_env):
    assert _adapter.TEMPLATE_SEND_SUPPORTED is False and T.permit() is False
    transport = wtd.DirectTemplateTransport(peer_env.port, timeout_s=0.5)
    r = _send(T.TemplateSender(transport, registry=lambda: [T_REF], switch=lambda: True))  # the REAL permit
    assert (r.outcome, r.code) == ("not_sent", "template_unsupported")
    assert not [c for c, _k, _p in peer_env.server.received if c.startswith("whatsapp/")], "no WhatsApp request left Arx"


def test_w013_the_v2_request_is_exactly_the_numbered_contract_and_carries_no_value(peer_env):
    peer_env.server.script["whatsapp/template_send_v2"] = {"result": T.closed_result(2, "accepted", "provider_accepted", True)}
    r = _send(_v2_sender(wtd.DirectTemplateTransport(peer_env.port, timeout_s=0.5), permit=True))  # TEST permit, fake sender
    assert (r.outcome, r.result_version) == ("sent", 2), "accepted = the provider's acceptance only; delivery stays unknown"
    (command, kind, params), = [x for x in peer_env.server.received if x[0].startswith("whatsapp/")]
    assert command == "whatsapp/template_send_v2" and kind == "wiskey-bridge-command.v1"
    assert params == {"schema_version": 2, "request_id": "synthetic-request-25", "operation_id": "synthetic-operation-25",
                      "recipient_ref": "synthetic-person-25", "expected_person_revision": 7, "account": "synthetic-account",
                      "template_name": "synthetic_access", "language": "he", "template_ref": "synthetic-template",
                      "expected_template_revision": 3}
    assert set(params) == T.V2_REQUEST_KEYS == wtd.V2_FIELDS
    for forbidden in ("parameters", "pin", "phone", "body", "consent", *T.NATIVE_PARAMETER_FIELDS):
        assert forbidden not in params


@pytest.mark.parametrize("act, outcome, code", [
    ({"result": T.closed_result(2, "not_sent", "template_mismatch", False)}, "not_sent", "template_mismatch"),
    ({"result": T.closed_result(2, "unknown", "provider_outcome_unknown", None)}, "unknown", "provider_outcome_unknown"),
    ({"result": T.closed_result(1, "accepted", "provider_accepted", True)}, "unknown", "invalid_response"),
    ({"error": "revision_conflict"}, "unknown", "invalid_response"),
    ({"error": "template_outcome_unknown"}, "unknown", "invalid_response"),
    ("close", "unknown", "invalid_response"),
])
def test_w013_only_a_closed_v2_result_is_read_and_unknown_is_never_not_sent_or_resent(peer_env, act, outcome, code):
    peer_env.server.script["whatsapp/template_send_v2"] = act
    r = _send(_v2_sender(wtd.DirectTemplateTransport(peer_env.port, timeout_s=0.5), permit=True))
    assert (r.outcome, r.code) == (outcome, code)
    assert len([c for c, _k, _p in peer_env.server.received if c == "whatsapp/template_send_v2"]) == 1, "never retried"


def test_w013_a_reference_without_the_wiskey_pair_or_outside_the_bounds_is_refused_locally():
    fake = T.FakeTemplateTransport()
    fake.send_v2 = lambda w: (_ for _ in ()).throw(AssertionError("must not be called"))  # type: ignore[attr-defined]
    unbound = T.TemplateSender(fake, registry=lambda: [T.TemplateRef("access", "synthetic_access", "he", ("name",), "notice")],
                               switch=lambda: True, permit_fn=lambda: True,
                               pacer=_wpace.WaPacer(_ma.MemorySendLedger(), _wpace.MemoryPacerStore(), config=lambda: _wpace.PacerConfig(mode="off")),
                               pacing_for=lambda _k: _ma.Pacing(), clock=lambda: T_NOW)
    assert _send(unbound).code == "template_v2_unbound"
    assert _send(_v2_sender(fake, permit=True), person_revision=0).code == "invalid_reference"
    assert T.parse_ref({"id": "a", "name": "n", "language": "he", "params": [], "purpose": "notice", "template_ref": "t"}) is None, "half a pair"
    ok = T.parse_ref({"id": "a", "name": "n", "language": "he", "params": [], "purpose": "notice", "template_ref": "t", "template_revision": 2})
    assert ok is not None and (ok.wiskey_ref, ok.wiskey_revision) == ("t", 2)
    assert T.NATIVE_INSTALLER_CONFIG_KEY == "native_whatsapp_templates_v1"
