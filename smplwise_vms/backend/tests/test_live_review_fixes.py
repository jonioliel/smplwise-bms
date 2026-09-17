"""Fixes from the live review of 2026-09-17: the HA registry refresher dies with its session (F13) and two channels
with the same NVR name are told apart by their channel number (F24)."""
from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_sync


def test_registry_refresher_is_cancelled_when_the_session_ends(settings, monkeypatch):
    app = create_app(settings)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, settings

    async def fake_refresh(self, call):  # noqa: ARG001 - registry lists are not the point here
        return None

    monkeypatch.setattr(ha_sync.HaSync, "_refresh_registry", fake_refresh)

    async def fake_ws_session(settings_, on_ready, on_event, stop):  # noqa: ARG001
        async def call(kind, **kw):  # noqa: ARG001
            if kind == "get_config":
                return {"result": {"version": "2026.9.2"}}
            if kind == "subscribe_events":
                return {"success": True}
            return {"result": []}

        await on_ready(call)
        # the socket closes here (HA restarted): the session returns and must take its refresher with it

    monkeypatch.setattr(ha_sync.ha_client, "ws_session", fake_ws_session)
    created: list[asyncio.Task] = []
    real_create_task = asyncio.create_task

    def recording_create_task(coro, **kw):
        t = real_create_task(coro, **kw)
        if kw.get("name") == "ha-registry-refresher":
            created.append(t)
        return t

    monkeypatch.setattr(asyncio, "create_task", recording_create_task)

    async def run() -> None:
        await sync._session(asyncio.Event())
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    asyncio.run(run())
    ha_sync.STATE.connected = False
    assert len(created) == 1, "one refresher per session"
    assert created[0].cancelled(), "the refresher must not outlive its session (it kept calling the closed socket every 10 minutes)"


def test_duplicate_camera_names_get_their_channel(settings):
    app = create_app(settings)
    c = TestClient(app)
    a = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה M1"})
    b = c.post("/api/v1/cameras", json={"channel": 2, "alias": "כניסה M1"})
    d = c.post("/api/v1/cameras", json={"channel": 3, "alias": "לובי"})
    assert a.status_code == 201 and b.status_code == 201 and d.status_code == 201, (a.text, b.text, d.text)
    names = {cam["channel"]: cam["name"] for cam in c.get("/api/v1/cameras").json()["cameras"]}
    assert names[1] == "כניסה M1 · ערוץ 1" and names[2] == "כניסה M1 · ערוץ 2"
    assert names[3] == "לובי", "a unique name stays as it is"
