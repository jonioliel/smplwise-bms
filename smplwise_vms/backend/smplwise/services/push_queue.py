"""FOLLOWUPS-2406: a subscriber queue the WebSocket handlers can wait on without holding a thread.

The push sockets (`/ha/ws`, `/events/ws`, `/intercom/ws`) used to wait for the next frame with
`run_in_executor(None, q.get, True, 30)`: one thread of the event loop's DEFAULT executor per open socket, for as long as the
socket lived. That executor has `min(32, cpu_count + 4)` threads - eight on a four-core box. With more open sockets than
threads (several browsers or wall screens, each holding the three sockets; or sockets a closed tab left behind until their
next send fails), a socket's wait sat in the executor's queue until another socket's 30 s wait ran out, so a state push could
reach a screen up to 30 s late (the home-screen weather card in the combined fixture runs, docs/changes/FIXTURE-SPECS-2405.md).

`PushQueue` is a `queue.Queue` (the publishers, on their own threads, are unchanged: `put_nowait`, `queue.Full` when a slow
socket's queue is full) that also wakes the one coroutine waiting on it, through `loop.call_soon_threadsafe`. `next_item` is
that wait: no thread, the item at once, `queue.Empty` after `timeout` (the handlers send their heartbeat then)."""
from __future__ import annotations

import asyncio
import queue
from typing import Any

POLL_S = 0.05  # only for a plain queue.Queue (a test's stand-in): it cannot wake anyone, so it is polled


class PushQueue(queue.Queue):
    def __init__(self, maxsize: int = 0) -> None:
        super().__init__(maxsize)
        self._waker: tuple[asyncio.AbstractEventLoop, asyncio.Event] | None = None

    def _put(self, item: Any) -> None:  # called by put / put_nowait with the queue's own lock held
        super()._put(item)
        waker = self._waker
        if waker is not None:
            loop, event = waker
            try:
                loop.call_soon_threadsafe(event.set)
            except RuntimeError:  # the socket's loop is closed: nobody is waiting any more
                pass


async def next_item(q: queue.Queue, timeout: float) -> Any:
    """The next item of `q`, waiting up to `timeout` seconds without a thread; `queue.Empty` when none came."""
    try:
        return q.get_nowait()
    except queue.Empty:
        pass
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    if not isinstance(q, PushQueue):
        while loop.time() < deadline:
            await asyncio.sleep(POLL_S)
            try:
                return q.get_nowait()
            except queue.Empty:
                pass
        raise queue.Empty
    event = asyncio.Event()
    q._waker = (loop, event)
    try:
        while True:
            event.clear()  # cleared BEFORE the check: a put after the check sets it again, so it is never missed
            try:
                return q.get_nowait()
            except queue.Empty:
                pass
            left = deadline - loop.time()
            if left <= 0:
                raise queue.Empty
            try:
                await asyncio.wait_for(event.wait(), timeout=left)
            except asyncio.TimeoutError:
                pass
    finally:
        q._waker = None
