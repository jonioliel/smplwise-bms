"""CR-007 HA refresh (owner report 2026-09-28): a structure change made in Home Assistant - an entity moved to another
area, a device moved, an area renamed, an entity added or removed - reaches the devices screens within seconds,
without restarting the add-on.

The real HaSync session runs against a fake Home Assistant (`ha_client.ws_session` replaced by a script that hands the
session a fake `call` and then feeds it events), so what is tested is the actual wiring: the registry-event
subscription, the debounced refresh, the mirror writes, the `structure_changed` notice, and the manual refresh route."""
from __future__ import annotations

import asyncio
import concurrent.futures
import copy
import queue
import threading
import time
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.routers import devices as devices_router
from smplwise.services import ha_client, ha_sync
from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, STATES


def _ok(result: Any) -> dict[str, Any]:
    return {"type": "result", "success": True, "result": result}


REFUSED = {"type": "result", "success": False, "error": {"code": "unknown_error"}}


class FakeHa:
    """Home Assistant's side of one WebSocket session: mutable registries, and which listings answer badly."""

    def __init__(self) -> None:
        self.entities = copy.deepcopy(ENTITY_REGISTRY) + [
            # the device rule: no area of its own, its device is in the office
            {"entity_id": "light.desk", "id": "reg-desk", "area_id": None, "device_id": "dev-desk", "entity_category": None},
        ]
        self.devices = [{"id": "dev-desk", "area_id": "office"}]
        self.areas = copy.deepcopy(AREAS)
        self.floors = copy.deepcopy(FLOORS)
        self.states = STATES + [{"entity_id": "light.desk", "state": "on", "attributes": {"friendly_name": "Desk"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"}]
        self.fail: set[str] = set()
        self.calls: list[str] = []
        self.subscribed: list[str] = []

    async def call(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        self.calls.append(msg_type)
        if msg_type in self.fail:
            return REFUSED
        if msg_type == "get_config":
            return _ok({"version": "2026.9.0"})
        if msg_type == "get_states":
            return _ok(self.states)
        if msg_type == "subscribe_events":
            self.subscribed.append(kw["event_type"])
            return _ok(None)
        listing = {"config/entity_registry/list": self.entities, "config/device_registry/list": self.devices,
                   "config/area_registry/list": self.areas, "config/floor_registry/list": self.floors}.get(msg_type)
        if listing is None:
            return REFUSED
        return _ok(copy.deepcopy(listing))

    def listings(self) -> int:
        return self.calls.count("config/entity_registry/list")


def registry_event(event_type: str, **data: Any) -> dict[str, Any]:
    return {"type": "event", "event": {"event_type": event_type, "data": data}}


@pytest.fixture()
def fast(monkeypatch):
    monkeypatch.setattr(ha_sync, "REGISTRY_DEBOUNCE_S", 0.05)
    monkeypatch.setattr(ha_sync, "REGISTRY_MAX_WAIT_S", 0.3)


@pytest.fixture()
def app_s(settings, fast):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    from smplwise.main import create_app

    app = create_app(s)
    yield app, s
    ha_sync.STATE.connected = False


def run_session(app, s, fake: FakeHa, script, monkeypatch) -> tuple[ha_sync.HaSync, list[dict[str, Any]]]:
    """Run one real HaSync session against `fake`; `script(on_event, on_message, settle)` runs once the session is ready.
    `await settle(n)` waits (up to 10 s, not a fixed sleep: a busy machine is slower) until the n-th entity listing has
    been asked for and that refresh has finished. Returns the sync object and every message it published."""
    async def settle(n: int) -> None:
        loop = asyncio.get_running_loop()
        end = loop.time() + 10
        while loop.time() < end:
            if fake.listings() >= n and sync._refresh_lock is not None and not sync._refresh_lock.locked():
                pass  # the notice is published before the lock is released
                return
            await asyncio.sleep(0.01)
        raise AssertionError(f"refresh #{n} never finished ({fake.listings()} listings)")

    async def ws_session(_settings, on_ready, on_event, stop, on_message=None):
        await on_ready(fake.call)
        await script(on_event, on_message, settle)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, s
    q = ha_sync.subscribe()
    try:
        asyncio.run(sync._session(asyncio.Event()))
    finally:
        ha_sync.unsubscribe(q)
    out = []
    while True:
        try:
            out.append(q.get_nowait())
        except queue.Empty:
            return sync, out


def area_of(app, entity_id: str) -> tuple[str | None, str | None]:
    with app.state.db.connection() as conn:
        r = conn.execute("SELECT area_id, area_name FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        return r["area_id"], r["area_name"]


def tree_areas(c: TestClient) -> dict[str, int]:
    t = c.get("/api/v1/devices/tree").json()
    return {a["area_id"]: a["counts"]["entities"] for f in t["floors"] for a in f["areas"]}


def notices(msgs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [m for m in msgs if m.get("type") == "structure_changed"]


def test_the_owners_scenario_an_entity_moved_in_ha_shows_in_the_new_area_without_restart(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    c = TestClient(app)
    seen: dict[str, Any] = {}

    async def script(on_event, on_message, settle):
        seen["before"] = tree_areas(c)
        # in HA: light.office moves from the office to the lobby
        next(e for e in fake.entities if e["entity_id"] == "light.office")["area_id"] = "lobby"
        on_event(registry_event("entity_registry_updated", action="update", entity_id="light.office", changes={"area_id": "office"})["event"]["data"])
        on_message(registry_event("entity_registry_updated", action="update", entity_id="light.office", changes={"area_id": "office"}))
        await settle(2)
        seen["after"] = tree_areas(c)

    sync, msgs = run_session(app, s, fake, script, monkeypatch)
    assert set(fake.subscribed) >= {"state_changed", *ha_sync.REGISTRY_EVENTS}
    assert seen["after"]["lobby"] == seen["before"]["lobby"] + 1
    assert seen["after"]["office"] == seen["before"]["office"] - 1
    assert area_of(app, "light.office") == ("lobby", "לובי")
    n = notices(msgs)
    assert len(n) == 1 and n[0]["reason"] == "entity_registry_updated" and n[0]["changed"] is True
    assert ha_sync.STATE.last_structure_at == n[0]["last_registry_at"]
    assert sync._session_loop is None and sync._session_call is None  # the session ended: the manual refresh has nothing to run on


def test_a_burst_of_registry_events_is_one_refresh_and_one_notice(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    counts: dict[str, int] = {}

    async def script(_on_event, on_message, settle):
        counts["connect"] = fake.listings()
        fake.areas[0]["name"] = "משרד ראשי"  # an area renamed
        for i in range(8):
            on_message(registry_event("area_registry_updated" if i % 2 else "entity_registry_updated", action="update", area_id="office"))
            pass  # one burst, faster than the debounce
        await settle(2)
        counts["after"] = fake.listings()
        # a refresh that changes nothing sends no notice
        on_message(registry_event("entity_registry_updated", action="update", entity_id="light.lobby", changes={"options": {}}))
        await settle(3)
        counts["idle"] = fake.listings()

    _, msgs = run_session(app, s, fake, script, monkeypatch)
    assert counts["connect"] == 1
    assert counts["after"] == 2  # eight events, one refresh
    assert counts["idle"] == 3
    n = notices(msgs)
    assert len(n) == 1 and n[0]["reason"] == "area_registry_updated,entity_registry_updated"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT name FROM ha_areas WHERE area_id = 'office'").fetchone()["name"] == "משרד ראשי"


def test_the_session_handles_never_shadow_the_sync_loop():
    """Regression guard for a mistake made (and caught in the fixture run) while writing this change, never released:
    a session-handle attribute named `_loop` would replace the `_loop` coroutine method and stop the sync thread at
    start. The tests above call `_session` directly, so they could not see it."""
    sync = ha_sync.HaSync()
    assert callable(sync._loop) and asyncio.iscoroutinefunction(sync._loop)
    assert sync._session_loop is None and sync._session_call is None


def test_debouncer_trails_but_never_starves():
    fired: list[set[str]] = []
    took: dict[str, float] = {}

    async def main():
        loop = asyncio.get_running_loop()
        d = ha_sync.Debouncer(loop, fired.append, delay=0.1, max_wait=0.25)
        t0 = loop.time()
        for _ in range(30):  # a poke every ~20 ms (a pure trailing debounce would never fire)
            d.poke("x")
            await asyncio.sleep(0.02)
        took["burst"] = loop.time() - t0
        await asyncio.sleep(0.2)
        d.poke("y")
        d.cancel()
        await asyncio.sleep(0.2)

    asyncio.run(main())
    # at least one fire per max_wait during the burst, never more than one per max_wait (+ the trailing one)
    assert int(took["burst"] / 0.25) <= len(fired) <= int(took["burst"] / 0.25) + 2, (len(fired), took)
    assert len(fired) >= 2
    assert all(r == {"x"} for r in fired)  # the cancelled "y" never fired


def test_a_device_moved_in_ha_moves_its_entities_but_an_entity_area_wins(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    # light.lobby_spot sits on the same device but has its own area: HA's rule is entity area, else device area
    next(e for e in fake.entities if e["entity_id"] == "light.lobby_spot")["device_id"] = "dev-desk"

    async def script(_on_event, on_message, settle):
        fake.devices[0]["area_id"] = "garden"
        on_message(registry_event("device_registry_updated", action="update", device_id="dev-desk", changes={"area_id": "office"}))
        await settle(2)

    _, msgs = run_session(app, s, fake, script, monkeypatch)
    assert area_of(app, "light.desk") == ("garden", "גינה")
    assert area_of(app, "light.lobby_spot") == ("lobby", "לובי")
    assert len(notices(msgs)) == 1


def test_a_failed_entity_or_device_listing_writes_nothing(app_s, monkeypatch):
    """A refused device listing used to become [] - every device-area entity fell to "ללא שיוך" - and a refused entity
    listing tombstoned entities and cleared the bulk-safe marks, until the next refresh 10 minutes later."""
    app, s = app_s
    fake = FakeHa()
    snap: dict[str, Any] = {}

    async def script(_on_event, on_message, settle):
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO device_bulk_safe(entity_id, marked_by, marked_by_username, marked_at) VALUES ('switch.lobby_sign', 'u', 'admin', '2026-09-28T10:00:00Z')")
            snap["fp"] = ha_sync.mirror_fingerprint(conn)
            snap["marks"] = _marks(conn)
        for failing in ("config/device_registry/list", "config/entity_registry/list"):
            fake.fail = {failing}
            fake.devices[0]["area_id"] = "garden"
            on_message(registry_event("device_registry_updated", action="update", device_id="dev-desk"))
            await settle(2 if failing.startswith('config/device') else 3)
            with app.state.db.connection() as conn:
                assert ha_sync.mirror_fingerprint(conn) == snap["fp"], failing
                assert _marks(conn) == snap["marks"]
            assert ha_sync.STATE.last_registry_error == failing.split("/")[1]
        # the area listing refused: the area table is kept AND the entity rows keep their area names
        fake.fail = {"config/area_registry/list"}
        on_message(registry_event("device_registry_updated", action="update", device_id="dev-desk"))
        await settle(4)
        snap["partial"] = area_of(app, "light.desk"), area_of(app, "light.lobby")
        fake.fail = set()

    _, msgs = run_session(app, s, fake, script, monkeypatch)
    assert area_of(app, "light.desk") == ("garden", "גינה")
    assert snap["partial"] == (("garden", "גינה"), ("lobby", "לובי"))
    assert [n["reason"] for n in notices(msgs)] == ["device_registry_updated"]  # only the refresh that got everything


def _marks(conn) -> list[str]:
    return sorted(r["entity_id"] for r in conn.execute("SELECT entity_id FROM device_bulk_safe"))


def test_an_entity_removed_in_ha_leaves_the_tree_and_a_new_one_arrives(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    c = TestClient(app)
    seen: dict[str, Any] = {}

    async def script(on_event, on_message, settle):
        # removed: HA sends state_changed with no new state (and a registry remove)
        fake.entities = [e for e in fake.entities if e["entity_id"] != "light.garden"]
        on_event({"entity_id": "light.garden", "old_state": {"state": "on"}, "new_state": None})
        await settle(2)
        seen["removed"] = tree_areas(c).get("garden")
        # added: a new light in the office - its state first, then its registry entry
        fake.entities.append({"entity_id": "light.new_lamp", "id": "reg-new", "area_id": "office", "device_id": None, "entity_category": None})
        on_event({"entity_id": "light.new_lamp", "old_state": None, "new_state": {"entity_id": "light.new_lamp", "state": "off", "attributes": {"friendly_name": "New lamp"}, "last_changed": "2026-09-28T11:00:00+00:00", "last_updated": "2026-09-28T11:00:00+00:00"}})
        on_message(registry_event("entity_registry_updated", action="create", entity_id="light.new_lamp"))
        await settle(3)

    _, msgs = run_session(app, s, fake, script, monkeypatch)
    assert seen["removed"] in (None, 0)
    assert area_of(app, "light.new_lamp") == ("office", "משרד")
    reasons = [n["reason"] for n in notices(msgs)]
    assert reasons == ["state_removed", "entity_registry_updated"]


def test_dev_registry_sends_the_same_notice(app_s):
    app, _ = app_s
    c = TestClient(app)
    q = ha_sync.subscribe()
    try:
        body = {"entities": [{"entity_id": "light.x", "area_id": "a1"}], "areas": [{"area_id": "a1", "name": "A"}], "floors": []}
        assert c.post("/api/v1/ha/dev/registry", json=body).json()["changed"] is True
        assert c.post("/api/v1/ha/dev/registry", json=body).json()["changed"] is False
        msgs = []
        while not q.empty():
            msgs.append(q.get_nowait())
    finally:
        ha_sync.unsubscribe(q)
    assert [m["reason"] for m in notices(msgs)] == ["dev"]


class LiveLoop:
    """A running asyncio loop in a thread, standing in for the sync thread's loop during a live session."""

    def __enter__(self) -> asyncio.AbstractEventLoop:
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self.thread.start()
        return self.loop

    def __exit__(self, *_exc) -> None:
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join(5)
        self.loop.close()


def test_manual_refresh_needs_devices_read_is_rate_limited_and_refuses_without_ha(app_s, monkeypatch):
    app, s = app_s
    c = TestClient(app)
    monkeypatch.setattr(devices_router, "_last_refresh", {})
    fake = FakeHa()
    # nobody: no devices.read anywhere
    c.get("/api/v1/me", headers=as_user("nobody"))
    assert c.post("/api/v1/devices/refresh", headers=as_user("nobody")).status_code == 403
    # not connected: an honest 503, nothing pretended
    ha_sync.STATE.connected = False
    r = c.post("/api/v1/devices/refresh")
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable"
    monkeypatch.setattr(devices_router, "_last_refresh", {})
    with LiveLoop() as loop:
        monkeypatch.setattr(ha_sync.SYNC, "db", app.state.db)
        monkeypatch.setattr(ha_sync.SYNC, "_session_loop", loop)
        monkeypatch.setattr(ha_sync.SYNC, "_session_call", fake.call)
        monkeypatch.setattr(ha_sync.SYNC, "_refresh_lock", None)
        monkeypatch.setattr(ha_sync.SYNC, "_last_done", None)
        ha_sync.STATE.connected = True
        next(e for e in fake.entities if e["entity_id"] == "light.lobby_spot")["area_id"] = "garden"
        r = c.post("/api/v1/devices/refresh")
        assert r.status_code == 200, r.text
        assert r.json()["changed"] is True and r.json()["last_registry_at"] and "sync" in r.json()
        assert area_of(app, "light.lobby_spot")[0] == "garden"
        # again at once: the same user waits; another user does not
        r2 = c.post("/api/v1/devices/refresh")
        assert r2.status_code == 429 and r2.json()["code"] == "refresh_rate_limited" and 1 <= r2.json()["details"]["retry_after_s"] <= 10
        bind(c, s, "viewer1", "viewer", "installation", "*")
        # another user a moment later: the refresh that just finished answers for it (no second listing)
        listed = fake.listings()
        r3 = c.post("/api/v1/devices/refresh", headers=as_user("viewer1"))
        assert r3.status_code == 200 and r3.json()["changed"] is True and r3.json()["coalesced"] is True
        assert fake.listings() == listed
        # past the coalescing window it lists again
        monkeypatch.setattr(ha_sync, "MANUAL_COALESCE_S", 0.0)
        monkeypatch.setattr(devices_router, "_last_refresh", {})
        r5 = c.post("/api/v1/devices/refresh", headers=as_user("viewer1"))
        assert r5.status_code == 200 and r5.json()["changed"] is False and fake.listings() == listed + 1
        # a listing HA refuses: 502, the mirror kept
        monkeypatch.setattr(devices_router, "_last_refresh", {})
        fake.fail = {"config/device_registry/list"}
        r4 = c.post("/api/v1/devices/refresh")
        assert r4.status_code == 502 and r4.json()["code"] == "ha_registry_incomplete"
        assert area_of(app, "light.lobby_spot")[0] == "garden"
    for text in (r.text, r3.text):
        for needle in ("secret", "ha.local", "8123", "token-value"):
            assert needle not in text


def _live_sync(monkeypatch, app, loop, call) -> None:
    monkeypatch.setattr(ha_sync.SYNC, "db", app.state.db)
    monkeypatch.setattr(ha_sync.SYNC, "_session_loop", loop)
    monkeypatch.setattr(ha_sync.SYNC, "_session_call", call)
    monkeypatch.setattr(ha_sync.SYNC, "_refresh_lock", None)
    monkeypatch.setattr(ha_sync.SYNC, "_last_done", None)
    ha_sync.STATE.connected = True


def test_a_timed_out_manual_refresh_keeps_the_lock_until_its_write_is_done(app_s, monkeypatch):
    """Review finding: cancelling a timed-out manual refresh released the refresh lock while its executor write went
    on, so the next refresh could write beside it (and its tombstone step undo the newer one). One writer at a time."""
    app, _ = app_s
    fake = FakeHa()
    active = {"now": 0, "max": 0, "writes": 0}
    guard = threading.Lock()
    real_structure = ha_sync.apply_structure

    def slow_structure(conn, areas, floors):
        with guard:
            active["now"] += 1
            active["max"] = max(active["max"], active["now"])
            active["writes"] += 1
        try:
            time.sleep(0.6)
            real_structure(conn, areas, floors)
        finally:
            with guard:
                active["now"] -= 1

    monkeypatch.setattr(ha_sync, "apply_structure", slow_structure)
    monkeypatch.setattr(ha_sync, "MANUAL_REFRESH_TIMEOUT_S", 0.2)
    with LiveLoop() as loop:
        _live_sync(monkeypatch, app, loop, fake.call)
        with pytest.raises(ApiError) as exc:
            ha_sync.SYNC.refresh_now()
        assert exc.value.status == 504 and exc.value.code == "ha_timeout"
        # a registry event's refresh queued right behind it
        second = asyncio.run_coroutine_threadsafe(ha_sync.SYNC._refresh_and_notify(fake.call, "entity_registry_updated"), loop)
        assert second.result(timeout=10) is not None
    assert active["writes"] == 2
    assert active["max"] == 1  # never two mirror writes at once


def test_ha_dropping_mid_refresh_is_a_503_not_a_500(app_s, monkeypatch):
    app, _ = app_s
    c = TestClient(app)
    monkeypatch.setattr(devices_router, "_last_refresh", {})
    hang: dict[str, Any] = {}

    async def call(msg_type: str, **_kw: Any) -> dict[str, Any]:
        # the session's pending call, cancelled when the socket drops (ha_client.ws_session's finally)
        hang["fut"] = asyncio.get_running_loop().create_future()
        return await hang["fut"]

    with LiveLoop() as loop:
        _live_sync(monkeypatch, app, loop, call)
        with concurrent.futures.ThreadPoolExecutor(1) as pool:
            pending = pool.submit(c.post, "/api/v1/devices/refresh")
            deadline = time.monotonic() + 10
            while "fut" not in hang and time.monotonic() < deadline:
                time.sleep(0.01)
            loop.call_soon_threadsafe(hang["fut"].cancel)
            r = pending.result(timeout=10)
    assert r.status_code == 503 and r.json()["code"] == "ha_unavailable"


def test_an_ha_that_refuses_one_registry_subscription_keeps_the_session(app_s, monkeypatch):
    """An older HA without floors refuses `floor_registry_updated`: logged, the session and the other events go on."""
    app, s = app_s
    fake = FakeHa()
    real_call = fake.call

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        if msg_type == "subscribe_events" and kw.get("event_type") == "floor_registry_updated":
            return REFUSED
        return await real_call(msg_type, **kw)

    fake.call = call  # type: ignore[method-assign]
    seen: dict[str, Any] = {}

    async def script(_on_event, on_message, settle):
        seen["connected"] = ha_sync.STATE.connected
        next(e for e in fake.entities if e["entity_id"] == "light.office")["area_id"] = "garden"
        on_message(registry_event("entity_registry_updated", action="update", entity_id="light.office"))
        await settle(2)

    _, msgs = run_session(app, s, fake, script, monkeypatch)
    assert seen["connected"] is True
    assert area_of(app, "light.office") == ("garden", "גינה")
    assert len(notices(msgs)) == 1


def test_an_integration_reload_keeps_the_entity_and_its_bulk_safe_mark(app_s, monkeypatch):
    """Reloading an integration removes its states and adds them back; the registry keeps the entities. The removed
    state only marks the entity unavailable - no tombstone, and the bulk-safe mark survives the refresh it schedules."""
    app, s = app_s
    fake = FakeHa()
    seen: dict[str, Any] = {}

    async def script(on_event, _on_message, settle):
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO device_bulk_safe(entity_id, marked_by, marked_by_username, marked_at) VALUES ('switch.lobby_sign', 'u', 'admin', '2026-09-28T10:00:00Z')")
        on_event({"entity_id": "switch.lobby_sign", "old_state": {"state": "on"}, "new_state": None})
        await settle(2)
        with app.state.db.connection() as conn:
            r = conn.execute("SELECT removed_at, available FROM ha_entities WHERE entity_id = 'switch.lobby_sign'").fetchone()
            seen["during"] = (r["removed_at"], r["available"])
            seen["marks"] = _marks(conn)
        on_event({"entity_id": "switch.lobby_sign", "old_state": None, "new_state": {"entity_id": "switch.lobby_sign", "state": "on", "attributes": {"friendly_name": "Sign"}, "last_changed": "2026-09-28T11:00:00+00:00", "last_updated": "2026-09-28T11:00:00+00:00"}})

    run_session(app, s, fake, script, monkeypatch)
    assert seen["during"] == (None, 0)
    assert seen["marks"] == ["switch.lobby_sign"]
    with app.state.db.connection() as conn:
        assert _marks(conn) == ["switch.lobby_sign"]
        r = conn.execute("SELECT removed_at, available FROM ha_entities WHERE entity_id = 'switch.lobby_sign'").fetchone()
        assert (r["removed_at"], r["available"]) == (None, 1)


def test_dev_registry_waits_for_the_mirror_lock(app_s):
    """The fixture's seed never interleaves with a sync refresh: it writes under the same mirror lock, and waits for
    it without holding a SQLite write lock."""
    app, _ = app_s
    c = TestClient(app)
    body = {"entities": [{"entity_id": "light.x", "area_id": "a1"}], "areas": [{"area_id": "a1", "name": "A"}], "floors": []}
    pool = concurrent.futures.ThreadPoolExecutor(1)
    ha_sync.SYNC.mirror_lock.acquire()
    try:
        pending = pool.submit(c.post, "/api/v1/ha/dev/registry", json=body)
        time.sleep(0.5)
        assert not pending.done()
        with app.state.db.connection() as conn:  # a writer elsewhere is not blocked meanwhile
            conn.execute("UPDATE ha_entities SET updated_at = updated_at")
    finally:
        ha_sync.SYNC.mirror_lock.release()
    assert pending.result(timeout=10).status_code == 200
    pool.shutdown()
