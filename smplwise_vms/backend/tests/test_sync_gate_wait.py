"""CR-SYNC-GATE-2438 (lead decision on the CR-MAIN-RUNTIME-2438 follow-up finding): a request waiting for the write gate
never occupies one of the shared worker threads. `auth.get_conn` waited for the gate in a thread of AnyIO's shared
40-token pool; the gate holder's own sync (`def`) body and its sync dependencies run in that same pool, so with 40 or more
writers parked in the gate the holder waited for a thread that only a gate time-out frees - "database is locked" with no
slow holder. The wait now runs on a limiter of its own (auth.GATE_WAIT_THREADS); order and limits are unchanged."""
from __future__ import annotations

import asyncio
import threading
import time

import httpx
from fastapi import Depends, FastAPI

from smplwise import auth, db as db_mod
from smplwise.db import Database, get_setting, set_setting
from smplwise.errors import ApiError
from smplwise.main import commit_before_send

WRITERS = 45  # more than the shared pool's 40 tokens


def _db(tmp_path) -> Database:
    d = Database(tmp_path / "t.db")
    d.migrate()
    return d


HANG_GUARD_S = 120.0  # real time that only frees a broken test; never part of what the test measures


class _UntimedGateEvent(threading.Event):
    """TIMING-LANE-2480: the write gate's queue entry for the test below. A timed wait ends when the turn is handed over (`set`), not
    when BUSY_TIMEOUT_S of wall clock ran out: the gate's time-out is the symptom the starvation produced, and on a loaded gate runner
    the 45 writers' own arrival alone outlasted it. Starvation is now checked where it happens - the shared pool's threads while the
    writers are parked. After HANG_GUARD_S the wait gives up as a real time-out would (and the test fails on `gate_timeouts`)."""

    def wait(self, timeout: float | None = None) -> bool:
        return super().wait(None if timeout is None else HANG_GUARD_S)


def test_sync_handlers_do_not_starve_behind_gate_waiters(tmp_path, monkeypatch):
    """45 writers parked in the write gate (more than AnyIO's 40 shared threads) while a sync route holds it: the parked writers occupy
    none of the shared threads, so the holder's own sync body and its teardown still get one; then every writer goes through, in
    arrival order, with no gate time-out. TIMING-LANE-2480: clock-free - every wait is event-driven (the holder's start, each writer's
    arrival in the queue, the hand-over in the gate) and the old `elapsed < 8 s` bound is replaced by the pool check itself."""
    import types

    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 8.0)  # SQLite's busy_timeout and the write budget as before (the gate queue's wait is untimed here)
    names = {k: getattr(threading, k) for k in dir(threading) if not k.startswith("__")}
    names["Event"] = _UntimedGateEvent
    monkeypatch.setattr(db_mod, "threading", types.SimpleNamespace(**names))  # db.py's own name only; `threading` itself is untouched
    db = _db(tmp_path)
    holding, release = threading.Event(), threading.Event()
    order: list[int] = []
    app = FastAPI()
    app.state.db = db

    @app.post("/hold")
    def hold(conn=Depends(auth.get_conn)):  # noqa: B008 - FastAPI dependency
        set_setting(conn, "holder", "1")
        holding.set()
        release.wait(HANG_GUARD_S)
        return {"ok": True}

    @app.post("/write/{i}")
    def write(i: int, conn=Depends(auth.get_conn)):  # noqa: B008 - a sync body, like most write routes
        order.append(i)
        set_setting(conn, f"w{i}", str(i))
        return {"ok": True}

    commit_before_send(app)
    before = db_mod.lock_stats()
    pool: dict[str, int] = {}

    async def scenario() -> list[int]:
        import anyio.to_thread

        shared = anyio.to_thread.current_default_thread_limiter()  # the 40 threads every sync body and sync dependency runs in
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            holder = asyncio.create_task(client.post("/hold"))
            writers = []
            try:
                assert await asyncio.to_thread(holding.wait, HANG_GUARD_S), "the holder never took the gate"
                for i in range(WRITERS):  # one by one, so the gate queue has a known arrival order
                    writers.append(asyncio.create_task(client.post(f"/write/{i}")))
                    guard = time.monotonic() + HANG_GUARD_S
                    while db.gate.state()["waiting"] < i + 1:  # event-driven: on to the next writer only once this one is queued
                        # before the fix the parked writers filled the shared pool (it stopped at 39 waiting, every thread taken)
                        assert shared.available_tokens > 0, f"writer {i}: the gate waiters took every shared thread ({shared.borrowed_tokens} of {shared.total_tokens})"
                        assert time.monotonic() < guard, f"writer {i} never reached the gate queue"
                        await asyncio.sleep(0.005)
                # all 45 parked: only the holder's own sync body is in the shared pool; the gate waits run on threads of their own
                pool.update(borrowed=shared.borrowed_tokens, total=shared.total_tokens)
            finally:
                release.set()  # a failed check above still lets everything drain
            answers = await asyncio.gather(holder, *writers)
            return [r.status_code for r in answers]

    try:
        statuses = asyncio.run(scenario())
    finally:
        release.set()
        db.close_pool()
    after = db_mod.lock_stats()
    assert pool["borrowed"] <= 1, f"parked gate waiters held {pool['borrowed']} of the {pool['total']} shared threads"
    assert after["gate_timeouts"] - before["gate_timeouts"] == 0
    assert statuses == [200] * (WRITERS + 1)
    assert order == list(range(WRITERS))  # the gate still serves writers in arrival order


def _app_with_failures(db: Database) -> FastAPI:
    app = FastAPI()
    app.state.db = db

    @app.post("/ok")
    def ok(conn=Depends(auth.get_conn)):  # noqa: B008
        set_setting(conn, "k", "ok")
        return {"ok": True}

    @app.post("/refused")
    def refused(conn=Depends(auth.get_conn)):  # noqa: B008
        set_setting(conn, "k", "refused")  # e.g. the audit row of a refusal: an expected API error still commits
        raise ApiError(409, "conflict", "סירוב")

    @app.post("/bug")
    def bug(conn=Depends(auth.get_conn)):  # noqa: B008
        set_setting(conn, "k", "bug")  # anything unexpected rolls back
        raise RuntimeError("a bug")

    @app.exception_handler(ApiError)
    async def api_error(request, exc: ApiError):  # noqa: ARG001
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=exc.status, content={"code": "conflict"})

    commit_before_send(app)
    return app


def test_commit_and_rollback_rules_are_unchanged(tmp_path):
    db = _db(tmp_path)
    app = _app_with_failures(db)

    def value() -> str | None:
        with db.connection(mode="read") as conn:
            return get_setting(conn, "k")

    async def call(path: str) -> int:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as client:
            return (await client.post(path)).status_code

    try:
        assert asyncio.run(call("/ok")) == 200 and value() == "ok"
        assert asyncio.run(call("/refused")) == 409 and value() == "refused"
        assert asyncio.run(call("/bug")) == 500 and value() == "refused"  # rolled back
        assert db.gate.state() == {"held": False, "waiting": 0}  # nothing left holding the gate
    finally:
        db.close_pool()


def test_get_conn_waits_for_the_gate_off_the_shared_pool():
    assert auth.GATE_WAIT_THREADS > 40  # more than the shared pool: every writer the old pool could park, without starving it
