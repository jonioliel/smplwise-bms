"""PRESENCE-2280: master switch (off by default), transition history with retention + purge, room placement, cockpit gating. Synthetic fixtures only."""
from __future__ import annotations

import datetime as dt

import pytest
from conftest import bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import building_presence as bp
from smplwise.services import building_presence_history as bph
from smplwise.services import ha_sync
from test_building_presence_2271 import API, NOW, iso, put_sensor, tag


@pytest.fixture()
def off_world(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    bind(c, settings, "sam", "site_admin", "installation", "*")
    return c, Database(settings.db_path)


def cfg_put(c, **kw):
    return c.put(f"{API}/presence/building/settings", json=kw)


def seeded(c, db):
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    assert tag(c, "binary_sensor.shelly_presence_lobby").status_code == 200


def test_off_by_default_nothing_is_read_or_offered(off_world):
    c, db = off_world
    seeded(c, db)
    snap = c.get(f"{API}/presence/building").json()
    assert snap["configured"] is False and snap["enabled"] is False and "rooms" not in snap
    assert snap["settings"]["enabled"] is False
    with db.connection(mode="read") as conn:
        assert bp.snapshot(conn, NOW)["configured"] is False
    with db.connection() as conn:
        assert bph.record(conn, NOW) == 0
        assert conn.execute("SELECT COUNT(*) FROM presence_building_history").fetchone()[0] == 0
    # the cockpit does not offer the blocks while off, and does once the switch is on
    from types import SimpleNamespace

    from smplwise.services.automation_scope import Ctx
    with db.connection() as conn:
        fake = SimpleNamespace(conn=conn)
        assert Ctx.presence_sensors.fget(fake) == ()
        bp.set_config(conn, {"enabled": True})
        assert Ctx.presence_sensors.fget(fake) == ("binary_sensor.shelly_presence_lobby",)


def test_switching_on_then_off_starts_and_stops_history_and_erases_it(off_world):
    c, db = off_world
    seeded(c, db)
    assert cfg_put(c, enabled=True).json()["settings"]["enabled"] is True
    assert c.get(f"{API}/presence/building").json()["configured"] is True
    with db.connection() as conn:
        assert bph.record(conn, NOW) == 2  # building + the lobby
        assert bph.record(conn, NOW) == 0  # no change, no row
    assert c.get(f"{API}/presence/building/history").json()["rows"] == 2
    assert cfg_put(c, enabled=False).status_code == 200
    assert c.get(f"{API}/presence/building/history").json()["rows"] == 0
    with db.connection() as conn:
        assert bph.record(conn, NOW) == 0


def test_transitions_only_and_a_dropped_link_records_nothing(off_world):
    c, db = off_world
    seeded(c, db)
    cfg_put(c, enabled=True, hold_seconds=0)
    with db.connection() as conn:
        assert bph.record(conn, fresh=False) == 0
        bph.record(conn)
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(5))
    with db.connection() as conn:
        assert bph.record(conn) == 2
        rows = [dict(r) for r in conn.execute("SELECT scope, status FROM presence_building_history ORDER BY id")]
    assert rows[-1]["status"] == "clear" and len(rows) == 4


def test_retention_prunes_and_zero_keeps_nothing(off_world):
    c, db = off_world
    seeded(c, db)
    cfg_put(c, enabled=True, retention_days=7)
    with db.connection() as conn:
        for days in (30, 1):
            conn.execute("INSERT INTO presence_building_history(at, scope, status) VALUES(?, 'building', 'clear')", (bp._iso(dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)),))
        assert bph.prune(conn) == 1
    assert c.get(f"{API}/presence/building/history").json()["rows"] == 1
    cfg_put(c, retention_days=0)
    with db.connection() as conn:
        assert bph.prune(conn) == 1 and bph.record(conn) == 0


def test_purge_endpoint_audits_and_needs_configure(off_world, settings):
    c, db = off_world
    seeded(c, db)
    cfg_put(c, enabled=True)
    with db.connection() as conn:
        bph.record(conn)
    r = c.delete(f"{API}/presence/building/history")
    assert r.json()["deleted"] == 2 and r.json()["rows"] == 0
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.building.purge'").fetchone()[0] == 1


def test_option_validation(off_world):
    c, _ = off_world
    assert cfg_put(c, retention_days=400).status_code == 422
    assert cfg_put(c, home_display="wall").status_code == 422
    out = cfg_put(c, home_display="card", map_tint=False, retention_days=14).json()["settings"]
    assert out["home_display"] == "card" and out["map_tint"] is False and out["retention_days"] == 14


def test_room_placement_overrides_the_mirror_area(off_world, monkeypatch):
    c, db = off_world
    seeded(c, db)
    put_sensor(db, "binary_sensor.other", "off", iso(30), area=("a_hall", "מסדרון"))
    cfg_put(c, enabled=True)
    r = c.put(f"{API}/presence/building/room", json={"entity_id": "binary_sensor.shelly_presence_lobby", "area_id": "a_hall"})
    assert r.status_code == 200
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    rooms = c.get(f"{API}/presence/building").json()["rooms"]
    assert [x["name"] for x in rooms] == ["מסדרון"] and rooms[0]["status"] == "occupied"
    assert c.put(f"{API}/presence/building/room", json={"entity_id": "binary_sensor.other", "area_id": "a_hall"}).status_code == 422  # untagged
    assert c.put(f"{API}/presence/building/room", json={"entity_id": "binary_sensor.shelly_presence_lobby", "area_id": "nope"}).status_code == 422
