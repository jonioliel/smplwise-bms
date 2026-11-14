"""CR-MAIN-RUNTIME-2438 (review 05:P2-01): the shutdown sequence is exception-safe. A stop that raises (on the loop or in a
worker thread) is logged and every later stop still runs - above all the capture-lease revocation and close_pool, which
is last. The start-up discovery task is cancelled with the other tasks."""
from __future__ import annotations

import asyncio
import logging

from fastapi.testclient import TestClient

from smplwise.main import _shutdown_step, create_app
from smplwise.services import cast_relay, lease_events, notify_sources


def test_one_failing_stop_does_not_skip_the_later_ones(settings, monkeypatch, caplog):
    calls: list[str] = []

    def boom() -> None:
        calls.append("cast")
        raise RuntimeError("cast relay stop failed")

    def boom_in_thread() -> None:
        calls.append("notify")
        raise OSError("notify sources stop failed")

    monkeypatch.setattr(cast_relay.SERVER, "stop", boom)  # an early stop on the loop
    monkeypatch.setattr(notify_sources, "shutdown", boom_in_thread)  # a later stop in a worker thread
    monkeypatch.setattr(lease_events.WORKER, "on_shutdown", lambda *a, **k: calls.append("lease revocation"))
    app = create_app(settings)
    real_close = app.state.db.close_pool

    def close_pool() -> None:
        calls.append("close_pool")
        real_close()

    monkeypatch.setattr(app.state.db, "close_pool", close_pool)
    with caplog.at_level(logging.WARNING, logger="smplwise"):
        with TestClient(app) as c:
            assert c.get("/healthz").status_code == 200
    assert calls == ["cast", "lease revocation", "notify", "close_pool"]  # the order of the sequence, nothing skipped
    failed = [r.getMessage() for r in caplog.records if r.getMessage().startswith("shutdown step")]
    assert failed == ["shutdown step cast relay failed", "shutdown step notify sources failed"]


def test_the_discovery_task_is_cancelled_at_shutdown(settings):
    app = create_app(settings)
    held = {}

    with TestClient(app) as c:
        assert c.get("/healthz").status_code == 200

        async def never_ends() -> None:
            await asyncio.Event().wait()

        async def plant() -> None:  # a start-up discovery still running when the add-on stops
            held["task"] = app.state.discovery = asyncio.create_task(never_ends())

        c.portal.call(plant)
    assert held["task"].cancelled()


def test_shutdown_step_logs_and_goes_on(caplog):
    ran: list[int] = []
    with caplog.at_level(logging.WARNING, logger="smplwise"):
        _shutdown_step("first", lambda: (_ for _ in ()).throw(ValueError("x")))
        _shutdown_step("second", ran.append, 2)
    assert ran == [2]
    assert [r.getMessage() for r in caplog.records] == ["shutdown step first failed"]
