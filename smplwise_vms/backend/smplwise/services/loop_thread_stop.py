"""CR-WAVE2-COMBINED-2439: stop a feed thread that runs its own asyncio loop (`asyncio.run` in a daemon thread) at once, and wait
for it - the Home Assistant mirror (ha_sync), the WisKey feed (intercom_sync) and the WisKey background feed.

Before: `shutdown()` only set a threading.Event that the thread's `watch_stop` task polls once a second, and nobody joined the
thread. The application's shutdown therefore returned while the thread - its event loop (a self-pipe socket pair) and its Home
Assistant socket - could live up to a second longer. The notification monitor's shutdown used to wait out its own 1 s queue timeout
right after these steps, which hid the gap; BACKEND-SAFETY-2435 removed that wait (review 05 P1-08) and the full-lifecycle test
`test_asgi_wiskey_295::test_full_app_lifecycle_...` then counted the still-open sockets (release gate 2.43.6: `assert 4 <= 2`).

Now: the loop records `(loop, stop_evt)` with `remember`, `stop_and_join` sets the event through `call_soon_threadsafe` (the loop
wakes at once instead of at the next poll) and joins the thread for a bounded time. The 1 s poll stays as the fallback."""
from __future__ import annotations

import asyncio
import threading
from typing import Any

JOIN_S = 2.0  # per thread; the wake makes the normal end a few milliseconds


def remember(owner: Any, stop_evt: asyncio.Event) -> None:
    """Called inside the thread's loop, right after it creates its stop event."""
    owner._wake = (asyncio.get_running_loop(), stop_evt)


def stop_and_join(owner: Any, timeout: float = JOIN_S) -> None:
    """`owner.stop` is already set by the caller. Wake the loop's stop event, then wait for `owner.thread` (bounded; never raises)."""
    wake = getattr(owner, "_wake", None)
    if wake is not None:
        loop, evt = wake
        try:
            loop.call_soon_threadsafe(evt.set)
        except RuntimeError:  # the loop already ended and closed
            pass
    t = getattr(owner, "thread", None)
    if t is not None and t is not threading.current_thread() and t.is_alive():
        t.join(timeout)
