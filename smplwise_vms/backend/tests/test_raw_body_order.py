"""Review L7: the routes that read the request body themselves (permission first, JSON-only, the code kept apart) read it
BEFORE the write connection - SQLite's single write lock - is opened, so a slow client never holds the lock while its body
trickles in. The permission is checked on a read connection first (smplwise.auth.read_gate; the pattern access_groups
introduced in T082): an unauthorised caller still gets the audited 403 whatever it sent."""
from __future__ import annotations

from typing import Callable

import pytest
from conftest import as_user
from fastapi import Request
from fastapi.routing import APIRoute

from smplwise import auth
from smplwise import db as db_mod
from smplwise.routers import access_control, alarm, devices, schedules

BODY_READERS = {"_raw_body", "_credentials_body", "_capped_body"}
SKIPPED_MODULES: set[str] = set()  # every router with a body reader is covered, schedules included


def _post_order(dep) -> list[Callable]:
    """The order FastAPI resolves a route's dependencies in: each one's own sub-dependencies first, in signature order."""
    out: list[Callable] = []
    for sub in dep.dependencies:
        out.extend(_post_order(sub))
        out.append(sub.call)
    return out


def test_every_raw_body_route_reads_the_body_before_it_takes_the_write_connection():
    from test_plan_routes_unique import _routers

    checked = 0
    for route in (r for router in _routers().values() for r in router.routes):
        if not isinstance(route, APIRoute):
            continue
        order = _post_order(route.dependant)
        body_at = next((i for i, c in enumerate(order) if getattr(c, "__name__", "") in BODY_READERS and c.__module__ not in SKIPPED_MODULES), None)
        if body_at is None:
            continue
        checked += 1
        writers = [i for i, c in enumerate(order) if c is auth.get_conn or c is auth.current_principal]
        assert all(i > body_at for i in writers), f"{sorted(route.methods)} {route.path}: takes the write connection before the body is read"
    assert checked >= 34  # access_control, alarm, devices, access_groups and the 13 schedules routes


@pytest.mark.parametrize("method, path, module", [
    ("PUT", "/api/v1/devices/entities/switch.x/area", devices),
    ("POST", "/api/v1/intercom/stations/s1/release", access_control),
    ("PUT", "/api/v1/alarm/controls/switch.x/not-alarm", alarm),
    ("POST", "/api/v1/schedules", schedules),
    ("POST", "/api/v1/schedules/bulk", schedules),
    ("PUT", "/api/v1/schedules/organisation", schedules),
    ("POST", "/api/v1/schedules/s1/split", schedules),
])
def test_the_body_is_read_while_no_write_lock_is_held(client, method, path, module):
    from test_db_locking import lock_is_free

    db = client.app.state.db
    seen: list[tuple[bool, bool]] = []

    async def spy(request: Request) -> bytes:
        seen.append((not db_mod._holders, lock_is_free(db)))
        return await request.body()

    client.get("/api/v1/me")  # the bootstrap administrator
    client.app.dependency_overrides[module._raw_body] = spy
    try:
        r = client.request(method, path, json={"area_id": "office"})
    finally:
        client.app.dependency_overrides.clear()
    assert r.status_code != 403, r.text  # the administrator passed the read-connection gate
    assert seen == [(True, True)]


def test_a_refused_caller_gets_the_audited_403_before_the_body_is_read(client):
    read: list[bool] = []

    async def spy(request: Request) -> bytes:
        read.append(True)
        return await request.body()

    client.get("/api/v1/me")
    client.app.dependency_overrides[devices._raw_body] = spy
    try:
        r = client.put("/api/v1/devices/entities/switch.x/area", content=b"{not json", headers={**as_user("nobody"), "content-type": "application/json"})
    finally:
        client.app.dependency_overrides.clear()
    assert r.status_code == 403 and read == []
    with client.app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT actor_username, decision FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    assert (row["actor_username"], row["decision"]) == ("nobody", "denied")


@pytest.mark.parametrize("method, path", [
    ("POST", "/api/v1/schedules"), ("POST", "/api/v1/schedules/preview"), ("PUT", "/api/v1/schedules/organisation"),
    ("PUT", "/api/v1/schedules/s1"), ("POST", "/api/v1/schedules/s1/copy"), ("POST", "/api/v1/schedules/bulk"),
    ("POST", "/api/v1/schedules/trash/t1/restore"),
])
def test_a_refused_schedules_caller_gets_the_audited_403_before_the_body_is_read(client, method, path):
    read: list[bool] = []

    async def spy(request: Request) -> bytes:
        read.append(True)
        return await request.body()

    client.get("/api/v1/me")
    client.app.dependency_overrides[schedules._raw_body] = spy
    try:
        r = client.request(method, path, content=b"{not json", headers={**as_user("nobody"), "content-type": "application/json"})
    finally:
        client.app.dependency_overrides.clear()
    assert r.status_code == 403 and read == []
    with client.app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT actor_username, decision FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    assert (row["actor_username"], row["decision"]) == ("nobody", "denied")
