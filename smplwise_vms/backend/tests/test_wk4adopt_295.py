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
