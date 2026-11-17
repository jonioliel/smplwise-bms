"""One sender-worker skeleton (CR-SENDER-WORKER, review 04:F10).

The e-mail worker (services/notify_email.EmailWorker) and the WhatsApp notification worker (services/notify_whatsapp.Worker) were the
same thread written twice: a bounded queue of hand-overs, a heap of jobs that wait for their time, an in-flight counter, `drain` with a
20 ms poll, `stop`. `DelayedWorker` is that thread once; the two subclasses keep their job logic (what a hand-over is, how a job is
pushed, what running one means, what a failed one costs).

Kept exactly: the queue is bounded and `_wake` never blocks; the loop waits at most 1 s or until the first job is due; one lock (`lock`)
guards the heap and `inflight`, and nothing else is taken while it is held; `inflight` is raised BEFORE the pop, so `drain()` never sees
an empty heap with a job still on its way; a raising hand-over or job never ends the thread; `stop()` sets the event, wakes the thread
and joins for 3 s (never from the worker's own thread).

A heap entry is a tuple whose FIRST element is the due time (time.monotonic) and whose LAST element is the job; what lies between is
the subclass's ordering (a sequence number; WhatsApp adds a priority before it).

services/push.PushNotifier is NOT a subclass: it is restartable on another database, its heap belongs to its own thread alone (no lock),
its queue carries notices and a None sentinel, and its `drain` also waits for the notification outbox. It shares the two small
functions below (`heap_wait`, `wait_idle`), which is everything the three really had in common.
"""
from __future__ import annotations

import heapq
import itertools
import logging
import queue
import threading
import time
from typing import Any, Callable

POLL_S = 0.02  # drain's poll
MAX_WAIT_S = 1.0  # the loop never sleeps longer than this, with or without a waiting job


def heap_wait(heap: list[tuple[Any, ...]]) -> float:
    """How long the loop may wait for a hand-over: until the first job is due, within [0, MAX_WAIT_S]; MAX_WAIT_S with no job."""
    return max(0.0, min(MAX_WAIT_S, heap[0][0] - time.monotonic())) if heap else MAX_WAIT_S


def wait_idle(idle: Callable[[], bool], timeout: float) -> bool:
    """Poll `idle()` every POLL_S until it is true (True) or `timeout` seconds passed (False). `idle` is asked at least once."""
    end = time.monotonic() + timeout
    while True:
        if idle():
            return True
        if time.monotonic() >= end:
            return False
        time.sleep(POLL_S)


class DelayedWorker:
    """A thread of its own with a bounded queue of hand-overs (`fn(worker)`) and a heap of jobs waiting for their time."""

    def __init__(self, db: Any, *, name: str, queue_max: int, log: logging.Logger, what: str) -> None:
        self.db = db
        self.q: queue.Queue[Callable[[Any], None]] = queue.Queue(maxsize=queue_max)
        self.heap: list[tuple[Any, ...]] = []
        self.seq = itertools.count()
        self.lock = threading.Lock()
        self.inflight = 0
        self.stop_evt = threading.Event()
        self._log = log
        self._what = what
        self._thread_name = name

    def _start(self) -> None:
        """Called by the subclass at the END of its __init__: the thread never sees a half-built worker."""
        self.thread = threading.Thread(target=self._loop, name=self._thread_name, daemon=True)
        self.thread.start()

    # -- the subclass's part
    def _run_job(self, job: Any) -> None:
        raise NotImplementedError

    def _job_failed(self, job: Any) -> None:
        """A job raised (already inside the worker's guard): log it, and settle what the subclass must settle."""
        raise NotImplementedError

    # -- handing work over (never blocks, never touches the database)
    def _wake(self) -> None:
        try:
            self.q.put_nowait(lambda _w: None)
        except queue.Full:
            pass

    # test-only: test seam / test double - product code never calls it; the name is read only by tests: tests/test_delayed_worker_2440.py, tests/test_local_reset.py (+2 more). Kept (owner decision O10 a, CR-BE-DEAD-CODE-2442).
    def make_due(self) -> None:
        """Every waiting job comes due now (tests)."""
        with self.lock:
            self.heap[:] = [(0.0, *rest) for _t, *rest in self.heap]
            heapq.heapify(self.heap)
        self._wake()

    # -- the thread
    def _next_wait(self) -> float:
        with self.lock:
            return heap_wait(self.heap)

    def _loop(self) -> None:
        while not self.stop_evt.is_set():
            try:
                fn = self.q.get(timeout=self._next_wait())
            except queue.Empty:
                fn = None
            if self.stop_evt.is_set():
                return
            try:
                if fn is not None:
                    try:
                        fn(self)
                    finally:
                        self.q.task_done()
                self._run_due()
            except Exception:  # noqa: BLE001 - the worker never dies on one bad step
                self._log.exception("%s worker step failed", self._what)

    def _run_due(self) -> None:
        while True:
            with self.lock:
                if not self.heap or self.heap[0][0] > time.monotonic():
                    return
                self.inflight += 1  # before the pop: drain() never sees an empty heap with a job still on its way
                job = heapq.heappop(self.heap)[-1]
            try:
                self._run_job(job)
            except Exception:  # noqa: BLE001
                self._job_failed(job)
            finally:
                with self.lock:
                    self.inflight -= 1

    def _idle(self) -> bool:
        with self.lock:
            due = bool(self.heap) and self.heap[0][0] <= time.monotonic()
            return self.q.unfinished_tasks == 0 and self.inflight == 0 and not due

    def drain(self, timeout: float = 10.0) -> bool:
        """Wait until nothing is queued, in flight or due (jobs scheduled for later do not count)."""
        return wait_idle(self._idle, timeout)

    def stop(self) -> None:
        self.stop_evt.set()
        self._wake()
        if self.thread is not threading.current_thread():
            self.thread.join(timeout=3.0)
