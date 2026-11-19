"""The session skeleton the two WisKey feed clients share (CR-FEED-BASE-2450; code review 2026-11-13, finding 02:P2-5).

`intercom_sync.IntercomSync` (the service feed: SUPERVISOR_TOKEN, writes and one-off reads) and
`wiskey_background_feed.BackgroundFeed` (the read-only background feed: its own token, connection and rate bucket) each keep one
Home Assistant WebSocket session to WisKey in a thread of their own. What they do on the session differs (projection, pushes,
pollers, writes); how the session is run does not, and that part lives here once:

- the thread and its stop (`_start_thread`, `shutdown`);
- the early-message buffer: an event frame whose subscription id is not known yet is kept and replayed once it is
  (`_replay_early`);
- ending a session from inside it (`_fail`) and the session's refresh tasks (`_kick`);
- the `unknown_command` rule: WisKey still loading or not installed (`_maybe_loading`).

Moved code only: every frame, wait, state and log line is the one each client had before (pinned by
tests/test_feed_session_pin_2450.py). The tunable constants stay in `intercom_sync`, where the tests patch them."""
from __future__ import annotations

import asyncio
import threading
from collections import deque
from typing import Any

from ..config import Settings
from . import intercom_client, loop_thread_stop

EARLY_KEEP = 20  # event frames kept while their subscription id is not known yet


class FeedSession:
    """Base of the two feed clients. A subclass sets `REFRESH_TASK` (the name of a push-started refresh task) and provides
    `_on_message` (it dispatches one event frame or puts it back into `_early`) and `_refresh`."""

    REFRESH_TASK = "wiskey-feed-refresh"

    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop = threading.Event()
        self.settings: Settings | None = None
        self._was_ready = False  # a session reached `ready` since the process (or reset()) started
        self._absent_strikes = 0  # consecutive `unknown_command` probes with HA RUNNING, after a ready session
        self._logged_error: str | None = None  # the last error logged (an unchanged repeat is not logged again)
        self._tasks: set[asyncio.Task[None]] = set()  # refreshes started by pushes (_kick); cancelled with the session

    def _reset_session_skeleton(self) -> None:
        """The per-session part both clients keep the same way (called from each client's `_session_reset`)."""
        self._call: intercom_client.Call | None = None
        # event frames whose subscription id is not known yet: HA sends a subscription's first event right behind
        # its result, and the socket reader can get to it before the awaiting coroutine has recorded the id
        self._early: deque[dict[str, Any]] = deque(maxlen=EARLY_KEEP)
        self._refreshing = False
        self._again = False
        self._end: asyncio.Event | None = None
        self._fault: BaseException | None = None

    # -- lifecycle (main.py)
    def _start_thread(self, name: str) -> None:
        self.stop.clear()
        self.thread = threading.Thread(target=self._run, name=name, daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        self.stop.set()
        loop_thread_stop.stop_and_join(self)  # CR-WAVE2-COMBINED-2439: wake the loop now and wait for the thread (bounded)

    def _run(self) -> None:  # pragma: no cover - replaced by each client
        raise NotImplementedError

    # -- inside a session
    async def _maybe_loading(self, call: intercom_client.Call) -> bool:
        """`unknown_command` for WisKey's `overview`: True while that may only mean "not loaded yet" (see intercom_sync's
        module docstring), False once it means "not installed"."""
        from . import intercom_sync as sync  # ABSENT_AFTER_READY: the tests tune it there

        # a socket failure here propagates: the session ends as ha_unavailable (the connection is gone), not as loading
        frame = await call("get_config")
        result = frame.get("result") if frame.get("success") else None
        running = isinstance(result, dict) and result.get("state") == "RUNNING"
        if not running:
            return True
        # HA's bootstrap can reach RUNNING past a slow integration's setup: after a ready session, re-probe a few times
        if self._was_ready:
            self._absent_strikes += 1
            return self._absent_strikes < sync.ABSENT_AFTER_READY
        return False

    def _on_message(self, msg: dict[str, Any]) -> None:  # pragma: no cover - replaced by each client
        raise NotImplementedError

    def _replay_early(self) -> None:
        early = list(self._early)
        self._early.clear()
        for msg in early:
            self._on_message(msg)

    async def _refresh(self) -> None:  # pragma: no cover - replaced by each client
        raise NotImplementedError

    def _kick(self) -> None:
        task = asyncio.get_running_loop().create_task(self._refresh(), name=self.REFRESH_TASK)
        self._tasks.add(task)  # a strong reference (an unreferenced task can be collected mid-run) ...
        task.add_done_callback(self._tasks.discard)  # ... dropped once it is done

    def _fail(self, exc: BaseException) -> None:
        self._fault = exc
        if self._end is not None:
            self._end.set()
