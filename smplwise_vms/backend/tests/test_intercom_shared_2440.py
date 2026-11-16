"""CR-INTERCOM-SHARED-2440 (review 02:P2-6, 02:P3-3): the talk and the listen session registries share their attach-once /
finish-once base and their audit reference, and the two pumps share one wait / cancel / join tail with a fixed outcome order."""
from __future__ import annotations

import asyncio
import hashlib
import logging

import pytest

from smplwise.routers import intercom_listen as rl
from smplwise.routers import intercom_media as rm
from smplwise.services import intercom_listen as il
from smplwise.services import intercom_media as im

log = logging.getLogger("test.intercom_shared")


# ---------------------------------------------------------------- the registries

def test_both_registries_share_the_attach_once_finish_once_base():
    assert isinstance(im.MEDIA, im.SessionSlots) and isinstance(il.LISTEN, im.SessionSlots)
    assert type(im.MEDIA).attach is im.SessionSlots.attach and type(il.LISTEN).attach is im.SessionSlots.attach


def test_a_listen_session_attaches_once_and_finishes_once():
    state = il.ListenState()
    s = il.new_listen("st-a", "u1", "dana", None, "listen", limit_s=60)
    assert state.reserve(s) is None and state.get(s.id) is s
    assert state.attach(s) is True and state.attach(s) is False, "one socket per session"
    assert state.finish(s, "ended") is True and (s.closed, s.outcome) == (True, "ended") and state.get(s.id) is None
    assert state.finish(s, "expired") is False and s.outcome == "ended", "the first outcome stands (that call writes the end row)"
    assert state.attach(s) is False, "a closed session admits no socket"
    assert s.ref == hashlib.sha256(s.id.encode()).hexdigest()[:12] == im.session_ref(s.id)


def test_a_talk_session_attaches_once_and_finishes_once():
    state = im.MediaState()
    now = 1000.0
    t = im.TalkSession(id="handle-1", station_id="st-a", user_id="u1", username="dana", request_id=None, transport="x", codec="pcmu", duplex="half",
                       created_at=now, expires_at=now + 30)
    state.talks[t.id] = t
    assert state.talk(t.id) is t
    assert state.attach(t) is True and state.attach(t) is False
    assert state.finish(t, "stopped") is True and (t.closed, t.outcome) == (True, "stopped") and t.id not in state.talks
    assert state.finish(t, "ended") is False and t.outcome == "stopped"
    assert t.ref == hashlib.sha256(b"handle-1").hexdigest()[:12] == im.session_ref("handle-1")


# ---------------------------------------------------------------- the pump tail

def _run(coro):
    return asyncio.run(coro)


async def _after(delay: float, result: str) -> str:
    await asyncio.sleep(delay)
    return result


async def _forever(flag: list) -> str:
    try:
        await asyncio.sleep(60)
    finally:
        flag.append("cancelled")
    return "never"


def test_the_listen_router_uses_the_talk_routers_tail():
    assert rl.run_until_first is rm.run_until_first


def test_the_first_finished_task_decides_and_the_others_are_cancelled_and_joined():
    async def main():
        flags: list = []
        tasks = [asyncio.create_task(_forever(flags)), asyncio.create_task(_after(0.01, "expired")), asyncio.create_task(_forever(flags))]
        out = await rm.run_until_first(tasks, what="talk", ref="r1", log=log)
        return out, flags, [t.done() for t in tasks], [t.cancelled() for t in tasks]

    out, flags, done, cancelled = _run(main())
    assert out == "expired" and flags == ["cancelled", "cancelled"] and done == [True, True, True] and cancelled == [True, False, True]


def test_a_stop_reason_wins_over_a_plain_disconnect_when_both_finish_together():
    """02:P3-3: two tasks finished in the same turn - the answer was whichever the `done` set gave first."""

    async def done_task(result: str) -> str:
        return result

    async def main(order):
        tasks = [asyncio.create_task(done_task(r)) for r in order]
        await asyncio.sleep(0)  # all of them finish before the wait
        return await rm.run_until_first(tasks, what="listen", ref="r2", log=log)

    for _ in range(20):  # a set's order is not fixed: the answer must be
        assert _run(main(["ended", "expired"])) == "expired"
        assert _run(main(["expired", "ended"])) == "expired"
        assert _run(main(["ended", "access_lost", "stopped"])) == "access_lost", "among stop reasons: the order of the task list"
        assert _run(main(["stopped", "ended", "access_lost"])) == "stopped"
        assert _run(main(["ended", "ended"])) == "ended"


def test_a_raising_task_is_upstream_closed_and_logged_with_its_type_only(caplog):
    async def boom() -> str:
        raise ConnectionResetError("peer 10.0.0.7 reset")

    async def main():
        flags: list = []
        tasks = [asyncio.create_task(_after(0.0, "stopped")), asyncio.create_task(boom()), asyncio.create_task(_forever(flags))]
        await asyncio.sleep(0.02)
        return await rm.run_until_first(tasks, what="talk", ref="abc123", log=log), flags

    with caplog.at_level(logging.WARNING, logger="test.intercom_shared"):
        out, flags = _run(main())
    assert out == "upstream_closed" and flags == ["cancelled"], "an error of any finished task ends the session as upstream_closed"
    texts = [r.getMessage() for r in caplog.records]
    assert texts == ["talk session abc123 ended by an error: ConnectionResetError"], "the type, never the text (it can hold an address)"


def test_a_cancelled_caller_is_cancelled_only_after_every_task_was_joined():
    """The socket leak guard (tests/test_asgi_wiskey_295.py): a pump cancelled from outside still joins its tasks first."""

    async def main():
        released = asyncio.Event()
        order: list = []

        async def slow_cleanup() -> str:
            try:
                await asyncio.sleep(60)
            finally:
                await released.wait()  # a cleanup that takes a moment (closing an upstream socket)
                order.append("task cleaned up")
            return "never"

        tasks = [asyncio.create_task(slow_cleanup()), asyncio.create_task(slow_cleanup())]

        async def pump() -> str:
            try:
                return await rm.run_until_first(tasks, what="listen", ref="r3", log=log)
            finally:
                order.append("pump returned")

        p = asyncio.create_task(pump())
        await asyncio.sleep(0.01)
        p.cancel()
        await asyncio.sleep(0.01)
        assert not p.done(), "the pump waits for its tasks although it was cancelled"
        released.set()
        with pytest.raises(asyncio.CancelledError):
            await p
        return order, [t.done() for t in tasks]

    order, done = _run(main())
    assert order == ["task cleaned up", "task cleaned up", "pump returned"] and done == [True, True]


def test_no_task_survives_a_normal_end():
    async def main():
        before = len(asyncio.all_tasks())
        flags: list = []
        tasks = [asyncio.create_task(_after(0.0, "ended")), asyncio.create_task(_forever(flags)), asyncio.create_task(_forever(flags))]
        out = await rm.run_until_first(tasks, what="talk", ref="r4", log=log)
        return out, len(asyncio.all_tasks()) - before

    out, extra = _run(main())
    assert out == "ended" and extra == 0
