"""CORE10-EVENTLOOP-2560 (deep review CORE-10): the Home Assistant state feed's work, off the socket reader.

Before: every `state_changed` frame was handled inside the socket reader, on the feed thread's asyncio loop - the mirror write (a
write transaction that can wait BUSY_TIMEOUT_S for the lock), the hooks inside it, and after the commit the rule delivery (a
synchronous POST to Home Assistant per notify service, an announcement with its own transaction and speaker calls). While one frame
was handled no other frame was read, no command reply was delivered (`HaSync.ws_call`: schedules, "refresh from Home Assistant",
detect-by-pressing timed out with 503) and the keepalive was answered late.

Now the reader only hands the frame on:
- `StateWorker`: ONE consumer thread and a FIFO queue. One consumer keeps the order of every frame, so per-entity order is kept by
  construction (and the order across entities that the rules and the correlation events see). The queue is bounded for frames
  (`maxsize`); a frame that does not fit is refused and counted - never silently: the session then re-reads every state from Home
  Assistant (`HaSync._session`: `get_states`, stored by a control job placed in the same queue, then a `structure_changed` frame with
  reason `resync` so open screens refetch - the same signal CORE-06 sends for a full /ha/ws queue). Control jobs (the re-read) are
  never refused.
- `deliver_later`: the rule delivery that talks to Home Assistant (notify / announce) runs on its own single thread, in firing
  order, so a slow Home Assistant delays neither the reader nor the next state's mirror write.

`wait_idle` lets the session wait for the frames of a previous session before a new snapshot is stored (an old frame applied after
the new snapshot would overwrite it) and lets a session end with its frames applied."""
from __future__ import annotations

import collections
import concurrent.futures
import logging
import threading
import time
from typing import Any, Callable

log = logging.getLogger("smplwise.ha")

STATE_QUEUE_MAX = 20000  # frames waiting for the worker; the same order as ha_sync.HELD_STATES_MAX (a connect snapshot's window)


class StateWorker:
    def __init__(self, name: str = "ha-state-worker", maxsize: int = STATE_QUEUE_MAX) -> None:
        self.name = name
        self.maxsize = maxsize
        self._q: collections.deque[tuple[float, Callable[..., Any], tuple[Any, ...], bool]] = collections.deque()
        self._cv = threading.Condition()
        self._frames = 0  # bounded jobs (frames) in the queue
        self._busy = False
        self.thread: threading.Thread | None = None
        # numbers since start (the load test and the health of the feed read them)
        self.max_depth = 0
        self.refused = 0
        self.done = 0
        self.failed = 0
        self.max_wait_s = 0.0  # the longest a job waited in the queue before it ran

    def submit(self, fn: Callable[..., Any], *args: Any, bounded: bool = True) -> bool:
        """Queue `fn(*args)` behind every job already queued. A bounded job (a frame) is refused when `maxsize` frames wait:
        False, counted in `refused` - the caller must make up for it (the session re-reads the states). Never blocks."""
        with self._cv:
            if bounded and self._frames >= self.maxsize:
                self.refused += 1
                return False
            self._q.append((time.monotonic(), fn, args, bounded))
            if bounded:
                self._frames += 1
            self.max_depth = max(self.max_depth, len(self._q))
            if self.thread is None or not self.thread.is_alive():
                self.thread = threading.Thread(target=self._run, name=self.name, daemon=True)
                self.thread.start()
            self._cv.notify_all()
        return True

    def depth(self) -> int:
        with self._cv:
            return len(self._q)

    def frames(self) -> int:
        with self._cv:
            return self._frames

    def idle(self) -> bool:
        with self._cv:
            return not self._q and not self._busy

    def wait_idle(self, timeout: float) -> bool:
        """Wait until every queued job has run (True), or `timeout` seconds (False). Never called on the worker itself."""
        if self.thread is threading.current_thread():
            return False
        end = time.monotonic() + timeout
        with self._cv:
            while self._q or self._busy:
                left = end - time.monotonic()
                if left <= 0:
                    return False
                self._cv.wait(left)
        return True

    def _run(self) -> None:
        while True:
            with self._cv:
                while not self._q:
                    self._cv.wait()
                queued_at, fn, args, bounded = self._q.popleft()
                if bounded:
                    self._frames -= 1
                self._busy = True
                self.max_wait_s = max(self.max_wait_s, time.monotonic() - queued_at)
            try:
                fn(*args)
            except Exception:  # noqa: BLE001 - one failing job never ends the worker (the job logs its own detail)
                self.failed += 1
                log.exception("HA state worker: a job failed")
            finally:
                with self._cv:
                    self._busy = False
                    self.done += 1
                    self._cv.notify_all()


# the rule delivery that talks to Home Assistant: one thread, in firing order
_DELIVERY = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="ha-rule-delivery")
_delivery_lock = threading.Lock()
DELIVERY = {"queued": 0, "done": 0}


def _needs_ha(fired: list[dict[str, Any]]) -> bool:
    return any(item.get("_pending") or item.get("_announce") for item in fired)


def deliver_later(fired: list[dict[str, Any]]) -> None:
    """`rules.deliver_pending` off the state path when a fired rule talks to Home Assistant (notify / announce); a list without
    such an action only wakes the notifier thread, which is immediate and stays inline."""
    from . import rules as rules_svc

    if not _needs_ha(fired):
        rules_svc.deliver_pending(fired)
        return

    def run() -> None:
        try:
            rules_svc.deliver_pending(fired)
        except Exception:  # noqa: BLE001 - deliver_pending never raises by contract; a bug here must not end the thread
            log.exception("rule delivery failed")
        finally:
            with _delivery_lock:
                DELIVERY["done"] += 1

    with _delivery_lock:
        DELIVERY["queued"] += 1
    _DELIVERY.submit(run)
