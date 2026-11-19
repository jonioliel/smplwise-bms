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


def test_sync_handlers_do_not_starve_behind_gate_waiters(tmp_path, monkeypatch):
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 8.0)  # a regression fails sooner than ten seconds; 45 serial writes fit easily on a loaded machine
    db = _db(tmp_path)
    holding, release = threading.Event(), threading.Event()
    order: list[int] = []
    app = FastAPI()
    app.state.db = db

    @app.post("/hold")
    def hold(conn=Depends(auth.get_conn)):  # noqa: B008 - FastAPI dependency
        set_setting(conn, "holder", "1")
        holding.set()
        release.wait(20)
        return {"ok": True}

    @app.post("/write/{i}")
    def write(i: int, conn=Depends(auth.get_conn)):  # noqa: B008 - a sync body, like most write routes
        order.append(i)
        set_setting(conn, f"w{i}", str(i))
        return {"ok": True}

    commit_before_send(app)
    before = db_mod.lock_stats()

    async def scenario() -> list[int]:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            holder = asyncio.create_task(client.post("/hold"))
            await asyncio.to_thread(holding.wait, 5)
            writers = []
            for i in range(WRITERS):  # one by one, so the gate queue has a known arrival order
                writers.append(asyncio.create_task(client.post(f"/write/{i}")))
                deadline = time.monotonic() + 1
                while db.gate.state()["waiting"] < i + 1 and time.monotonic() < deadline:  # before the fix it stops at 39 (the shared pool)
                    await asyncio.sleep(0.005)
            await asyncio.sleep(0.2)
            release.set()
            answers = await asyncio.gather(holder, *writers)
            return [r.status_code for r in answers]

    started = time.monotonic()
    try:
        statuses = asyncio.run(scenario())
    finally:
        release.set()
        db.close_pool()
    after = db_mod.lock_stats()
    assert after["gate_timeouts"] - before["gate_timeouts"] == 0
    assert statuses == [200] * (WRITERS + 1)
    assert order == list(range(WRITERS))  # the gate still serves writers in arrival order
    assert time.monotonic() - started < 8.0  # no writer waited out the gate


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
