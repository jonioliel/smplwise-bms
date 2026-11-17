"""CR-SENDER-WORKER-2440 (review 04:F10): the shared sender-worker skeleton (services/delayed_worker.py) - thread, bounded queue,
heap of waiting jobs, in-flight counter, drain, stop - and the two channels that are built on it."""
from __future__ import annotations

import heapq
import logging
import threading
import time

import pytest

from smplwise.services import delayed_worker as dw
from smplwise.services.delayed_worker import DelayedWorker, heap_wait, wait_idle

log = logging.getLogger("test.delayed_worker")


class _W(DelayedWorker):
    def __init__(self, queue_max: int = 8) -> None:
        super().__init__("db", name="test-delayed-worker", queue_max=queue_max, log=log, what="test")
        self.ran: list = []
        self.failed: list = []
        self._start()

    def schedule(self, delay: float, job) -> None:
        with self.lock:
            heapq.heappush(self.heap, (time.monotonic() + delay, next(self.seq), job))
        self._wake()

    def _run_job(self, job) -> None:
        if callable(job):
            job(self)
        self.ran.append(job)

    def _job_failed(self, job) -> None:
        self.failed.append(job)


@pytest.fixture
def worker():
    w = _W()
    yield w
    w.stop()
    assert not w.thread.is_alive(), "the worker thread is gone after stop()"


def test_a_due_job_runs_and_a_later_one_waits(worker):
    worker.schedule(0.0, "now")
    worker.schedule(60.0, "later")
    assert worker.drain(3.0), "drain ends once nothing is queued, in flight or due"
    assert worker.ran == ["now"] and [e[-1] for e in worker.heap] == ["later"], "a job scheduled for later does not count for drain"
    worker.make_due()
    assert worker.drain(3.0) and worker.ran == ["now", "later"] and worker.heap == []


def test_jobs_run_in_due_order_then_in_the_order_they_came(worker):
    with worker.lock:  # pushed together under the lock so the thread sees all three at once
        now = time.monotonic()
        for due, name in ((now - 1, "b"), (now - 2, "a"), (now - 1, "c")):
            heapq.heappush(worker.heap, (due, next(worker.seq), name))
    worker._wake()
    assert worker.drain(3.0) and worker.ran == ["a", "b", "c"]


def test_a_hand_over_runs_on_the_worker_thread(worker):
    seen = []
    assert worker.q.empty()
    worker.q.put_nowait(lambda w: seen.append((w, threading.current_thread().name)))
    assert worker.drain(3.0) and seen == [(worker, "test-delayed-worker")]


def test_a_raising_job_is_reported_to_the_subclass_and_the_thread_goes_on(worker):
    def bad(_w):
        raise RuntimeError("smtp down")

    worker.schedule(0.0, bad)
    worker.schedule(0.0, "after")
    assert worker.drain(3.0)
    assert worker.failed == [bad] and worker.ran == ["after"] and worker.inflight == 0 and worker.thread.is_alive()


def test_a_raising_hand_over_does_not_end_the_thread(worker, caplog):
    def boom(_w):
        raise RuntimeError("bad dispatch")

    with caplog.at_level(logging.ERROR, logger="test.delayed_worker"):
        worker.q.put_nowait(boom)
        assert worker.drain(3.0), "task_done ran although the hand-over raised"
        worker.schedule(0.0, "still alive")
        assert worker.drain(3.0)
    assert worker.ran == ["still alive"] and any("test worker step failed" in r.getMessage() for r in caplog.records)


def test_a_raising_job_failed_hook_does_not_end_the_thread_or_leak_inflight():
    class Bad(_W):
        def _job_failed(self, job) -> None:
            raise RuntimeError("the settle step failed too")

    w = Bad()
    try:
        w.schedule(0.0, lambda _w: 1 / 0)
        assert w.drain(3.0) and w.inflight == 0
        w.schedule(0.0, "next")
        assert w.drain(3.0) and w.ran == ["next"] and w.thread.is_alive()
    finally:
        w.stop()
    assert not w.thread.is_alive()


def test_drain_waits_for_a_job_in_flight_and_times_out_honestly(worker):
    gate, started = threading.Event(), threading.Event()

    def slow(_w):
        started.set()
        gate.wait(5.0)

    worker.schedule(0.0, slow)
    assert started.wait(3.0)
    with worker.lock:
        assert worker.inflight == 1 and worker.heap == [], "in flight: counted although the heap is empty"
    t0 = time.monotonic()
    assert worker.drain(0.15) is False and 0.1 <= time.monotonic() - t0 < 2.0
    gate.set()
    assert worker.drain(3.0) and worker.inflight == 0


def test_wake_never_blocks_on_a_full_queue():
    w = _W(queue_max=1)
    try:
        hold, entered = threading.Event(), threading.Event()

        def block(_w):
            entered.set()
            hold.wait(5.0)

        w.q.put_nowait(block)
        assert entered.wait(3.0)
        w.q.put_nowait(lambda _w: None)  # the queue (size 1) is full now
        t0 = time.monotonic()
        w._wake()
        w.schedule(60.0, "x")  # schedule wakes too
        assert time.monotonic() - t0 < 0.5, "a full queue is already busy: the wake is dropped, not waited for"
        hold.set()
        assert w.drain(3.0)
    finally:
        hold.set()
        w.stop()
    assert not w.thread.is_alive()


def test_stop_ends_an_idle_worker_quickly_and_is_safe_from_its_own_thread():
    w = _W()
    t0 = time.monotonic()
    w.stop()
    assert not w.thread.is_alive() and time.monotonic() - t0 < 2.0, "the wake-up cuts the 1 s wait short"
    w2 = _W()
    done = threading.Event()

    def stop_self(worker):
        worker.stop()  # from the worker's own thread: no join on itself
        done.set()

    w2.q.put_nowait(stop_self)
    assert done.wait(3.0)
    w2.thread.join(3.0)
    assert not w2.thread.is_alive()


def test_a_stopped_worker_runs_nothing_more():
    w = _W()
    w.stop()
    w.schedule(0.0, "never")
    time.sleep(0.1)
    assert w.ran == [] and not w.thread.is_alive()


def test_heap_wait_and_wait_idle():
    now = time.monotonic()
    assert heap_wait([]) == dw.MAX_WAIT_S == 1.0
    assert heap_wait([(now - 5, 0, "j")]) == 0.0, "an overdue job: no wait"
    assert 0.0 < heap_wait([(now + 0.3, 0, "j")]) <= 0.3
    assert heap_wait([(now + 60, 0, 1, "j")]) == 1.0, "never longer than a second, whatever the entry's shape"
    assert wait_idle(lambda: True, 0.0) is True, "asked at least once"
    t0 = time.monotonic()
    assert wait_idle(lambda: False, 0.1) is False and 0.08 <= time.monotonic() - t0 < 1.0
    calls = []
    assert wait_idle(lambda: calls.append(1) or len(calls) >= 3, 2.0) is True and len(calls) == 3
    assert dw.POLL_S == 0.02


# ---------------------------------------------------------------- the two channels on the skeleton

def test_the_email_worker_keeps_its_names_and_shape():
    from smplwise.services import notify_email as ne

    w = ne.EmailWorker("db")
    try:
        assert isinstance(w, DelayedWorker) and w.thread.name == "email-worker" and w.thread.daemon
        assert w.retries is w.heap and w.q.maxsize == ne.WORKER_QUEUE_MAX and w.db == "db"

        class Job:
            def __init__(self, ok):
                self.ok, self.ran = ok, 0

            def recheck(self, db):
                return self.ok

            def run_retry(self, worker):
                self.ran += 1

        yes, no = Job(True), Job(False)
        w.schedule(60.0, yes)
        w.schedule(60.0, no)
        assert w.has(yes) and w.has(no) and len(w.retries) == 2
        w.make_due()
        assert w.drain(3.0) and (yes.ran, no.ran) == (1, 0) and not w.has(yes), "a job is re-checked before it is run again"
        assert w.submit(lambda worker: worker.schedule(0.0, yes)) is True
        assert w.drain(3.0) and yes.ran == 2
    finally:
        w.stop()
    assert not w.thread.is_alive()


def test_the_whatsapp_worker_keeps_its_names_and_shape(settings):
    from smplwise.db import Database
    from smplwise.services import notify_whatsapp as nw

    db = Database(settings.db_path)
    w = nw.Worker(db)
    try:
        assert isinstance(w, DelayedWorker) and w.thread.name == "whatsapp-notify" and w.thread.daemon
        assert w.q.maxsize == nw.QUEUE_MAX and w.pending() == 0 and w.gate is not None and w.heap == []
        assert w.drain(1.0)
    finally:
        w.stop()
    assert not w.thread.is_alive()
