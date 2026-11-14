"""CR-MAIN-RUNTIME-2438 (review 05:P1-01): the commit that frees the write gate when a response starts
(main.CommitBeforeSend -> auth.release_conns) must not queue for a worker thread behind the requests that wait for that
very gate. Before the fix it ran on AnyIO's default 40-token thread limiter: with 40 or more writers parked in pool
threads inside the gate queue, the holder's commit waited for a thread that only a gate time-out frees - a burst of
"database is locked" with no slow holder."""
from __future__ import annotations

import asyncio
import threading
import time

import httpx
from fastapi import Depends, FastAPI

from smplwise import auth, db as db_mod
from smplwise.db import Database, set_setting
from smplwise.main import CommitBeforeSend, commit_before_send

WRITERS = 45  # more than the default limiter's 40 tokens


def _app(db: Database, holding: threading.Event, release: threading.Event) -> FastAPI:
    app = FastAPI()
    app.state.db = db

    @app.post("/hold")
    def hold(conn=Depends(auth.get_conn)):  # noqa: B008 - FastAPI dependency
        set_setting(conn, "holder", "1")
        holding.set()
        release.wait(20)
        return {"ok": True}

    @app.post("/write/{i}")
    async def write(i: int, conn=Depends(auth.get_conn)):  # noqa: B008
        # async on purpose: the request's write connection is still opened in a pool thread (a sync dependency), which is
        # where the writers park while they wait for the gate; the body itself needs no thread, so this test isolates the
        # early commit's queue (a sync body waiting for a thread is the separate case noted in docs/changes/CR-MAIN-RUNTIME-2438.md)
        set_setting(conn, f"w{i}", str(i))
        return {"ok": True}

    commit_before_send(app)
    return app


def test_commit_before_send_has_its_own_thread_limiter(tmp_path, monkeypatch):
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 8.0)  # a regression fails sooner than ten seconds; 45 serial writes fit easily on a loaded machine
    db = Database(tmp_path / "t.db")
    db.migrate()
    holding, release = threading.Event(), threading.Event()
    app = _app(db, holding, release)
    before = db_mod.lock_stats()

    async def scenario() -> list[int]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            holder = asyncio.create_task(client.post("/hold"))
            await asyncio.to_thread(holding.wait, 5)
            writers = [asyncio.create_task(client.post(f"/write/{i}")) for i in range(WRITERS)]
            deadline = time.monotonic() + 3
            while db.gate.state()["waiting"] < 39 and time.monotonic() < deadline:  # every pool thread but the holder's is parked in the gate
                await asyncio.sleep(0.01)
            await asyncio.sleep(0.2)  # the remaining writers now queue for a thread, ahead of the holder's commit
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
    assert time.monotonic() - started < 8.0  # no writer waited out the gate


def test_the_middleware_still_commits_before_the_first_byte(tmp_path):
    """Unchanged contract: the request's connections are committed (the gate handed on) before the response starts."""
    db = Database(tmp_path / "t.db")
    db.migrate()
    seen: list[bool] = []
    app = FastAPI()
    app.state.db = db

    @app.post("/w")
    def w(conn=Depends(auth.get_conn)):  # noqa: B008
        set_setting(conn, "k", "v")
        return {"ok": True}

    app.add_middleware(CommitBeforeSend)

    class Probe:  # outermost: records whether the gate is free when the response start reaches the server
        def __init__(self, inner):
            self.inner = inner

        async def __call__(self, scope, receive, send):
            async def probe(message):
                if message["type"] == "http.response.start":
                    seen.append(db.gate.state()["held"])
                await send(message)

            await self.inner(scope, receive, probe)

    async def run() -> int:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=Probe(app)), base_url="http://test") as client:
            return (await client.post("/w")).status_code

    try:
        assert asyncio.run(run()) == 200
    finally:
        db.close_pool()
    assert seen == [False]
