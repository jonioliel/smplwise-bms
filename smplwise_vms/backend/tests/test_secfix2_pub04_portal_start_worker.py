"""SECFIX2-295 / PUB-04 (docs/security/PROPOSAL_PUB04_PORTAL_START_TIMING.md, option A): `POST /t/api/portal/start` can hand the
number-dependent work (the lookup, the code row, the outbox insert) to ONE worker thread owned by the public listener, through a bounded
queue, so the request's ASGI call - and with it the edge's in-flight slot and the keep-alive connection - ends at once and identically for
a known and an unknown number.

The switch `tickets.settings.vendor_portal.start_worker` defaults to false = today's Starlette BackgroundTask (the residual the CR
accepts) until the owner has the measurement (proposal step zero) and decides. Proven here with it on: byte-identical 202 bodies and
headers; the answer leaves before the worker runs (a worker held on a gate); a full queue still answers the same 202 (the job is dropped
and counted, never a 429); an exception in a job never stops the worker; nothing about the number reaches the log. Fake ha-whatsapp only."""
from __future__ import annotations

import logging
import threading
import time

import pytest
from test_tickets_vendor_portal import (UNKNOWN, assigned, env, portal_msgs, portal_on, public, rows, settings_put,  # noqa: F401 - `env`
                                        start)
from tickets_s4_world import PHONE_A

from smplwise.services.tickets import public_portal, vendor_portal

API = "/api/v1"


@pytest.fixture(autouse=True)
def _fresh_workers():
    public_portal.reset_workers_for_tests()
    yield
    public_portal.reset_workers_for_tests()


def worker_on(env, on: bool = True) -> None:
    r = settings_put(env, vendor_portal={"start_worker": on})
    assert r.status_code == 200, r.text


def _worker(env) -> public_portal.StartWorker:
    return public_portal.worker_for(env.s4.db)


# ---------------------------------------------------------------- default: today's background task


def test_the_switch_is_off_by_default_and_validated(env):
    doc = env.c.get(f"{API}/tickets/settings").json()
    assert doc["vendor_portal"]["start_worker"] is False
    assert settings_put(env, vendor_portal={"start_worker": "yes"}).status_code == 422
    r = env.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "vendor_portal": {"start_worker": True}}, headers=env.h("tom"))
    assert r.status_code == 403, "system.configure only"


def test_off_the_worker_is_never_started(env):
    portal_on(env)
    assigned(env)
    c, _ = public(env)
    assert start(c).status_code == 202
    assert public_portal.worker_started(env.s4.db) is False
    assert len(portal_msgs(env)) == 1, "the background task did the work, as before"


# ---------------------------------------------------------------- on: the worker


def test_on_known_and_unknown_numbers_get_byte_identical_answers_and_the_work_still_happens(env):
    portal_on(env)
    worker_on(env)
    assigned(env)
    c, _ = public(env)
    known, unknown = start(c, PHONE_A), start(c, UNKNOWN)
    assert known.status_code == unknown.status_code == 202
    assert known.content == unknown.content == b'{"code":"sent_if_registered"}'
    assert [(k, v) for k, v in known.headers.items() if k != "date"] == [(k, v) for k, v in unknown.headers.items() if k != "date"]
    assert _worker(env).wait_idle(5.0)
    assert len(portal_msgs(env)) == 1, "only the known number got a message"
    assert rows(env, "972500000099")[0]["contact_id"] is None, "a code row exists for the unknown number too"


def test_on_the_answer_leaves_before_the_worker_runs(env, monkeypatch):
    portal_on(env)
    worker_on(env)
    gate = threading.Event()
    ran: list[str] = []
    real = vendor_portal.request_code

    def held(conn, digits, now, **kw):
        gate.wait(5.0)
        ran.append("job")
        return real(conn, digits, now, **kw)

    monkeypatch.setattr(vendor_portal, "request_code", held)
    c, _ = public(env)
    t0 = time.monotonic()
    r = start(c)
    elapsed = time.monotonic() - t0
    assert r.status_code == 202 and ran == [], "the request finished while the job was still held"
    assert elapsed < 4.0, elapsed
    gate.set()
    assert _worker(env).wait_idle(5.0) and ran == ["job"]


def test_on_a_full_queue_still_answers_the_same_202_and_counts_the_drop(env, monkeypatch):
    portal_on(env)
    worker_on(env)
    monkeypatch.setattr(public_portal, "START_QUEUE_MAX", 2)
    public_portal.reset_workers_for_tests()
    gate = threading.Event()
    monkeypatch.setattr(vendor_portal, "request_code", lambda conn, digits, now, **kw: gate.wait(5.0))
    c, _ = public(env)
    answers = [start(c, f"050-000-00{10 + i:02d}") for i in range(6)]
    assert {a.status_code for a in answers} == {202} and len({a.content for a in answers}) == 1
    w = _worker(env)
    # at most one job in the worker's hands and two queued: at least three of six dropped once the worker holds one, two otherwise
    assert w.dropped >= 2 and w.accepted + w.dropped == 6 and w.accepted <= 3, (w.accepted, w.dropped)
    gate.set()
    assert w.wait_idle(5.0)


def test_on_an_exception_in_a_job_never_stops_the_worker_and_logs_no_number(env, monkeypatch, caplog):
    portal_on(env)
    worker_on(env)
    assigned(env)
    calls: list[int] = []
    real = vendor_portal.request_code

    def flaky(conn, digits, now, **kw):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError(f"database unavailable {digits}")
        return real(conn, digits, now, **kw)

    monkeypatch.setattr(vendor_portal, "request_code", flaky)
    c, _ = public(env)
    with caplog.at_level(logging.WARNING):
        assert start(c, UNKNOWN).status_code == 202
        assert _worker(env).wait_idle(5.0)
        assert start(c, PHONE_A).status_code == 202
        assert _worker(env).wait_idle(5.0)
    assert len(calls) == 2 and len(portal_msgs(env)) == 1, "the second job ran after the first one failed"
    text = caplog.text
    assert "RuntimeError" in text and "972500000099" not in text and "0500000099" not in text, "the exception type only"


def test_the_worker_is_one_thread_per_database_and_stops_cleanly(env):
    portal_on(env)
    worker_on(env)
    c, _ = public(env)
    for _ in range(3):
        start(c, UNKNOWN)
    w = _worker(env)
    assert _worker(env) is w
    assert w.wait_idle(5.0)
    names = [t.name for t in threading.enumerate() if t.name == public_portal.WORKER_THREAD_NAME]
    assert len(names) == 1, names
    w.stop()
    assert not w.thread.is_alive()
