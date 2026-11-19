"""The session skeleton the two WisKey feed clients share (CR-FEED-BASE-2450; code review 2026-11-13, finding 02:P2-5).

`intercom_sync.IntercomSync` (the service feed: SUPERVISOR_TOKEN, writes and one-off reads) and
`wiskey_background_feed.BackgroundFeed` (the read-only background feed: its own token, connection and rate bucket) each keep one
Home Assistant WebSocket session to WisKey in a thread of their own. What they do on the session differs (projection, pushes,
pollers, writes); how the session is run does not, and that part lives here once:

- the thread and its stop (`_start_thread`, `shutdown`);
- one session (`_session`): connect and authenticate (`ha_client.ws_session`, on the URL / token the client names), forward
  the stop into the session, and on the way out drop the live call and cancel every task of the session (the stop forwarder,
  the poller, push-started refreshes) before a fault recorded by `_fail` is raised to the ladder;
- the reconnect ladder (`_ladder`): the backoff doubling to its cap, WisKey loading (short retry), not installed / refused (the
  absent re-probe ladder, the copy dropped), any other WisKey error, a refused Home Assistant token (the shared refusal ladder of
  the client's own token), the reconnect counter and the log lines;
- the early-message buffer: an event frame whose subscription id is not known yet is kept and replayed once it is
  (`_replay_early`);
- ending a session from inside it (`_fail`) and the session's refresh tasks (`_kick`);
- the `unknown_command` rule: WisKey still loading or not installed (`_maybe_loading`).

Moved code only: every frame, wait, state and log line is the one each client had before (pinned by
tests/test_feed_session_pin_2450.py). The tunable constants stay in `intercom_sync`, where the tests patch them."""
from __future__ import annotations

import asyncio
import logging
import threading
from collections import deque
from typing import Any

from ..config import Settings
from ..errors import ApiError
from . import ha_client, intercom_client, loop_thread_stop
from .intercom_client import IntercomError

log = logging.getLogger("smplwise.intercom")  # the logger both clients always used

EARLY_KEEP = 20  # event frames kept while their subscription id is not known yet


class FeedSession:
    """Base of the two feed clients. A subclass sets `LOG_NAME` (the prefix of its log lines) and `REFRESH_TASK` (the name of a
    push-started refresh task), and provides `_session` (one session), `_on_message` (it dispatches one event frame or puts it
    back into `_early`), `_refresh`, `_set_state`, `_drop` and the state accessors below."""

    LOG_NAME = "WisKey feed"
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

    # -- the state each client keeps (the service feed in intercom_sync.STATE, the background feed in its `status`)
    def _feed_state(self) -> str:  # pragma: no cover - provided by each client
        raise NotImplementedError

    def _feed_error(self) -> str | None:  # pragma: no cover - provided by each client
        raise NotImplementedError

    def _feed_connected(self) -> bool:  # pragma: no cover - provided by each client
        raise NotImplementedError

    def _set_connected(self, value: bool) -> None:  # pragma: no cover - provided by each client
        raise NotImplementedError

    def _count_reconnect(self) -> None:  # pragma: no cover - provided by each client
        """A connected session is over: count the reconnect (and whatever else the client does at that moment)."""
        raise NotImplementedError

    def _refused_token(self) -> str | None:  # pragma: no cover - provided by each client
        """The token this client's sessions authenticate with (the key of ha_client's refusal ladder)."""
        raise NotImplementedError

    def _set_state(self, state: str, error: str | None) -> None:  # pragma: no cover - provided by each client
        raise NotImplementedError

    def _drop(self) -> None:  # pragma: no cover - provided by each client
        raise NotImplementedError

    # -- one session: what each client adds to it
    async def _connect_kwargs(self, settings: Settings) -> dict[str, Any]:
        """Extra `ha_client.ws_session` arguments (url, token, internal_tls); none = the service connection."""
        return {}

    async def _on_ready(self, call: intercom_client.Call, end: asyncio.Event) -> None:  # pragma: no cover - provided by each client
        """The authenticated socket is up: probe, subscribe, set `_call`, start `_poller`. `end` ends the session."""
        raise NotImplementedError

    def _session_closing(self) -> None:
        """The socket is gone, `_call` is already None, the session's tasks are not cancelled yet."""

    def _session_closed(self) -> None:
        """The session's tasks are cancelled and joined."""

    async def _session(self, stop_evt: asyncio.Event) -> None:
        assert self.settings
        settings = self.settings
        self._session_reset()
        end = asyncio.Event()
        self._end = end
        self._event_loop = asyncio.get_running_loop()
        self._poller: asyncio.Task[None] | None = None
        connect = await self._connect_kwargs(settings)

        async def forward_stop() -> None:
            await stop_evt.wait()
            end.set()

        stopper = asyncio.create_task(forward_stop())
        try:
            await ha_client.ws_session(settings, lambda call: self._on_ready(call, end), lambda _data: None, end, on_message=self._on_message, **connect)
        finally:
            self._call = None
            self._session_closing()
            # nothing of this session may outlive it: a stray refresh's own `finally` would otherwise run after the
            # next session reset and break its one-refresh-at-a-time invariant
            tasks = [t for t in (stopper, self._poller, *self._tasks) if t is not None and not t.done()]
            for t in tasks:
                t.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            self._tasks.clear()
            self._session_closed()
        if self._fault is not None:
            raise self._fault

    def _session_reset(self) -> None:  # pragma: no cover - provided by each client
        raise NotImplementedError

    # -- thread
    def _run(self) -> None:
        asyncio.run(self._ladder())

    async def _ladder(self) -> None:
        from . import intercom_sync as sync  # the constants: the tests tune them in one place

        assert self.settings
        backoff = sync.RETRY_S
        stop_evt = asyncio.Event()
        loop_thread_stop.remember(self, stop_evt)  # shutdown() sets stop_evt at once; the poll below stays as the fallback

        async def watch_stop() -> None:
            while not self.stop.is_set():
                await asyncio.sleep(1)
            stop_evt.set()

        asyncio.create_task(watch_stop())
        absent = 0  # consecutive "not installed" / "forbidden" answers on a working HA socket (the re-probe ladder, FOLLOWUPS-2406)
        while not self.stop.is_set():
            delay = backoff
            short = False  # HA is answering but WisKey is still loading: retry soon, whatever the backoff had reached
            was_absent, absent = absent, 0
            try:
                await self._session(stop_evt)
                backoff = sync.RETRY_S
                if self._feed_state() == "ready":
                    self._set_state("ha_unavailable", "disconnected")
            except IntercomError as exc:
                if exc.code == sync.LOADING:
                    # HA is (re)starting and WisKey is not loaded yet: keep the last-known copy (served as not fresh)
                    # and retry on the normal short backoff
                    self._set_state("connecting", sync.LOADING)
                    delay, short = sync.RETRY_S, True
                elif exc.not_installed or exc.code == "unauthorized":
                    self._drop()
                    self._set_state("not_installed" if exc.not_installed else "forbidden", exc.code)
                    absent = was_absent + 1
                    delay = sync.absent_delay(absent)
                else:
                    self._set_state("error", exc.code)
                if self._feed_error() != self._logged_error:  # an absent integration is logged once, not every probe
                    log.warning(self.LOG_NAME + ": %s (%s)", self._feed_state(), exc.code)
                    self._logged_error = self._feed_error()
            except Exception as exc:  # noqa: BLE001 - the loop must survive any socket failure
                if self.stop.is_set():
                    break
                code = exc.code if isinstance(exc, ApiError) else type(exc).__name__
                self._set_state("ha_unavailable", code)
                if code == "ha_forbidden":  # FOLLOWUPS-2406: a refused token waits on ha_client's slow shared ladder
                    delay = max(delay, ha_client.refused_wait(self._refused_token()))
                if not (isinstance(exc, ApiError) and exc.details.get("held")):  # a held attempt never reached HA
                    log.warning(self.LOG_NAME + " disconnected: %s (retry in %.0fs)", code, delay)
            if self._feed_connected():
                self._count_reconnect()
            self._set_connected(False)
            await ha_client.wait_or_reset(delay, stop_evt)  # a reset of the refused-token ladder ends the wait at once
            backoff = sync.RETRY_S if short else min(sync.RETRY_MAX_S, backoff * 2)
        self._set_connected(False)

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
