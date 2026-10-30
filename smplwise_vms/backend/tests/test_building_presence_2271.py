"""BUILDING-PRESENCE-2271 (board r339, phase 1): anonymous room / building occupancy from the tagged presence sensors.

Pure rules (a sensor's state, debounce hold, unavailable / unknown, room and building combination, empty-for-N-minutes) and the API
(invisible while nothing is tagged, permission matrix, audit of the tag change, validation, live state only). Synthetic data only: the entity
ids below are invented fixtures, not an installation's."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import building_presence as bp
from smplwise.services import ha_sync

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[3]
NOW = dt.datetime(2026, 10, 28, 12, 0, 0, tzinfo=dt.timezone.utc)


def iso(minutes_ago: float) -> str:
    return (NOW - dt.timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- sensor states (pure)

def test_on_is_occupied_and_off_holds_then_clears():
    assert bp.sensor_state("on", iso(5), NOW, 60) == ("occupied", None)
    # turned off 30 s ago, hold 60 s: still occupied (a PIR that dropped while someone sits still)
    assert bp.sensor_state("off", iso(0.5), NOW, 60) == ("occupied", None)
    st, clear_at = bp.sensor_state("off", iso(3), NOW, 60)
    assert st == "clear" and clear_at == NOW - dt.timedelta(minutes=3) + dt.timedelta(seconds=60)


def test_hold_zero_clears_at_once():
    assert bp.sensor_state("off", iso(0.01), NOW, 0)[0] == "clear"


@pytest.mark.parametrize("state", [None, "", "unavailable", "unknown", "weird"])
def test_unavailable_unknown_and_garbage_are_unknown_never_empty(state):
    assert bp.sensor_state(state, iso(30), NOW, 60) == ("unknown", None)


def test_a_stale_mirror_is_unknown_even_for_off():
    assert bp.sensor_state("off", iso(30), NOW, 60, fresh=False) == ("unknown", None)
    assert bp.sensor_state("on", iso(30), NOW, 60, fresh=False) == ("unknown", None)


def test_off_without_a_timestamp_is_clear():
    assert bp.sensor_state("off", None, NOW, 60) == ("clear", None)
    assert bp.sensor_state("off", "not-a-date", NOW, 60) == ("clear", None)


def test_combine_rules():
    assert bp.combine(["clear", "occupied", "unknown"]) == "occupied"
    assert bp.combine(["clear", "unknown"]) == "unknown"
    assert bp.combine(["clear", "clear"]) == "clear"
    assert bp.combine([]) == "unknown"


# ---------------------------------------------------------------- world

@pytest.fixture()
def world(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "dana", "operator", "installation", "*")
    bind(c, settings, "sam", "site_admin", "installation", "*")
    c.get(f"{API}/me", headers=as_user("nobody"))
    db = Database(settings.db_path)
    with db.connection() as conn:  # 2.28.0: the master switch is OFF by default; these tests are about the module while it is on
        bp.set_config(conn, {"enabled": True})
    return app, c, db, ids


def put_sensor(db: Database, entity_id: str, state: str | None, changed: str | None, device_class: str | None = "occupancy", area: tuple[str, str] | None = ("a_lobby", "לובי"),
               available: int = 1, domain: str = "binary_sensor", disabled: int = 0, removed: str | None = None) -> None:
    with db.connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO ha_entities(entity_id, name, domain, device_class, area_id, area_name, state, last_changed, available, disabled, removed_at, first_seen_at, updated_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (entity_id, entity_id.split(".")[1], domain, device_class, area[0] if area else None, area[1] if area else None, state, changed, available, disabled, removed, iso(999), iso(0)),
        )


def tag(c: TestClient, *ids: str, user: str | None = None):
    return c.put(f"{API}/presence/building/sensors", json={"entity_ids": list(ids)}, headers=as_user(user) if user else {})


# ---------------------------------------------------------------- aggregate over the DB

def test_nothing_tagged_means_not_configured_even_with_candidates(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    with db.connection(mode="read") as conn:
        snap = bp.snapshot(conn, NOW)
    assert snap["configured"] is False and "rooms" not in snap and "sensors" not in snap


def test_room_and_building_aggregate_with_empty_clock(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(25))
    put_sensor(db, "binary_sensor.shelly_motion_hall", "off", iso(12), "motion", ("a_hall", "מסדרון"))
    assert tag(c, "binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall").status_code == 200
    with db.connection(mode="read") as conn:
        snap = bp.snapshot(conn, NOW)
    assert snap["configured"] and snap["status"] == "clear" and snap["occupied_rooms"] == 0
    # the building became empty when the LAST sensor cleared: 12 min ago + 60 s hold -> 11 full minutes
    assert snap["empty_minutes"] == 11 and snap["empty_reached"] is True
    assert {r["name"]: r["status"] for r in snap["rooms"]} == {"לובי": "clear", "מסדרון": "clear"}


def test_empty_not_reached_before_the_timeout_and_timeout_is_configurable(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(4))
    tag(c, "binary_sensor.shelly_presence_lobby")
    with db.connection(mode="read") as conn:
        assert bp.snapshot(conn, NOW)["empty_reached"] is False  # 3 min < default 10
    assert c.put(f"{API}/presence/building/settings", json={"empty_minutes": 3}).status_code == 200
    with db.connection(mode="read") as conn:
        snap = bp.snapshot(conn, NOW)
    assert snap["empty_minutes"] == 3 and snap["empty_reached"] is True and snap["settings"]["empty_minutes"] == 3


def test_one_occupied_sensor_makes_the_building_occupied_and_clears_the_clock(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    put_sensor(db, "binary_sensor.shelly_motion_hall", "off", iso(60), "motion", ("a_hall", "מסדרון"))
    tag(c, "binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall")
    with db.connection(mode="read") as conn:
        snap = bp.snapshot(conn, NOW)
    assert snap["status"] == "occupied" and snap["occupied_rooms"] == 1 and snap["empty_since"] is None and snap["empty_reached"] is False


def test_an_unavailable_sensor_keeps_the_building_unknown_not_empty(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(60))
    put_sensor(db, "binary_sensor.shelly_motion_hall", "unavailable", iso(60), "motion", ("a_hall", "מסדרון"))
    tag(c, "binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall")
    with db.connection(mode="read") as conn:
        snap = bp.snapshot(conn, NOW)
    assert snap["status"] == "unknown" and snap["empty_reached"] is False and snap["empty_minutes"] is None
    assert {r["name"]: r["status"] for r in snap["rooms"]} == {"לובי": "clear", "מסדרון": "unknown"}


def test_a_sensor_flagged_unavailable_by_the_mirror_and_a_dropped_link_are_unknown(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(60), available=0)
    tag(c, "binary_sensor.shelly_presence_lobby")
    with db.connection(mode="read") as conn:
        assert bp.snapshot(conn, NOW)["status"] == "unknown"
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(60), available=1)
    with db.connection(mode="read") as conn:
        assert bp.snapshot(conn, NOW)["status"] == "clear"
        assert bp.snapshot(conn, NOW, fresh=False)["status"] == "unknown"


def test_a_sensor_without_an_area_is_building_level_only(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_roof", "on", iso(1), area=None)
    tag(c, "binary_sensor.shelly_presence_roof")
    with db.connection(mode="read") as conn:
        snap = bp.snapshot(conn, NOW)
    assert snap["status"] == "occupied" and snap["rooms"][0]["area_id"] is None


def test_a_vanished_tagged_sensor_is_unknown(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "off", iso(60))
    tag(c, "binary_sensor.shelly_presence_lobby")
    with db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE entity_id = 'binary_sensor.shelly_presence_lobby'")
    with db.connection(mode="read") as conn:
        assert bp.snapshot(conn, NOW)["status"] == "unknown"


def test_candidates_are_the_presence_classes_only(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1), "presence")
    put_sensor(db, "binary_sensor.shelly_motion_hall", "off", iso(1), "motion")
    put_sensor(db, "binary_sensor.door_front", "off", iso(1), "door")
    put_sensor(db, "sensor.temp_lobby", "21", iso(1), "temperature", domain="sensor")
    put_sensor(db, "binary_sensor.off_one", "on", iso(1), "occupancy", disabled=1)
    put_sensor(db, "binary_sensor.gone_one", "on", iso(1), "occupancy", removed=iso(5))
    got = c.get(f"{API}/presence/building/sensors").json()
    assert {s["entity_id"] for s in got["sensors"]} == {"binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall"}
    assert all(s["tagged"] is False for s in got["sensors"])


# ---------------------------------------------------------------- API

def test_snapshot_api_not_configured_then_configured(world):
    _, c, db, _ = world
    assert c.get(f"{API}/presence/building").json()["configured"] is False
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    tag(c, "binary_sensor.shelly_presence_lobby")
    ha_sync.STATE.connected = True
    body = c.get(f"{API}/presence/building").json()
    assert body["configured"] and body["status"] == "occupied" and body["fresh"] is True
    ha_sync.STATE.connected = False
    assert c.get(f"{API}/presence/building").json()["status"] == "unknown"  # the link is down: nothing is invented


def test_permission_matrix(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    tag(c, "binary_sensor.shelly_presence_lobby")
    for user, view in (("vera", 403), ("dana", 403), ("sam", 200), ("nobody", 403)):
        assert c.get(f"{API}/presence/building", headers=as_user(user)).status_code == view, user
    for user in ("vera", "dana", "sam", "nobody"):
        assert c.get(f"{API}/presence/building/sensors", headers=as_user(user)).status_code == 403, user
        assert tag(c, "binary_sensor.shelly_presence_lobby", user=user).status_code == 403, user
        assert c.put(f"{API}/presence/building/settings", json={"empty_minutes": 5}, headers=as_user(user)).status_code == 403, user


def test_tagging_validates_audits_and_replaces_as_a_whole(world):
    _, c, db, _ = world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    put_sensor(db, "binary_sensor.shelly_motion_hall", "off", iso(1), "motion")
    put_sensor(db, "sensor.temp_lobby", "21", iso(1), "temperature", domain="sensor")
    assert tag(c, "binary_sensor.nope").status_code == 422
    assert tag(c, "sensor.temp_lobby").status_code == 422  # not a binary sensor
    assert c.put(f"{API}/presence/building/sensors", json={"entity_ids": [], "extra": 1}).status_code == 422
    assert tag(c, "binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall").status_code == 200
    r = tag(c, "binary_sensor.shelly_motion_hall")
    assert [s["entity_id"] for s in r.json()["sensors"] if s["tagged"]] == ["binary_sensor.shelly_motion_hall"]
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.building.tag' ORDER BY id").fetchall()
    details = [json.loads(x[0]) for x in rows]
    assert details[-1] == {"added": [], "removed": ["binary_sensor.shelly_presence_lobby"], "total": 1} or details[-1]["removed"] == ["binary_sensor.shelly_presence_lobby"]
    assert tag(c).status_code == 200  # untag everything: the feature disappears again
    assert c.get(f"{API}/presence/building").json()["configured"] is False


def test_settings_validation(world):
    _, c, _, _ = world
    assert c.put(f"{API}/presence/building/settings", json={"empty_minutes": 0}).status_code == 422
    assert c.put(f"{API}/presence/building/settings", json={"hold_seconds": 99999}).status_code == 422
    assert c.put(f"{API}/presence/building/settings", json={"hold_seconds": 5, "empty_minutes": 30}).json()["settings"]["empty_minutes"] == 30
    assert c.put(f"{API}/presence/building/settings", json={"empty_minutes": 7}).json()["settings"]["hold_seconds"] == 5


def test_history_table_holds_no_person_data(world):
    _, c, db, _ = world
    with db.connection(mode="read") as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(presence_building_history)")]
    assert cols == ["id", "at", "scope", "area_id", "area_name", "status"]


# ---------------------------------------------------------------- permission registry

def test_permission_is_registered_labelled_and_not_sensitive():
    assert PERMISSION_LABELS["presence.building.view"]
    assert "presence.building.view" in ROLES["system_admin"] and "presence.building.view" in ROLES["site_admin"]
    for role in ("viewer", "operator", "editor", "kiosk"):
        assert "presence.building.view" not in ROLES[role], role
    for path in (ROOT / "smplwise_vms" / "backend" / "smplwise" / "roles.json", ROOT / "contracts" / "examples" / "role-catalog.design.json"):
        cat = json.loads(path.read_text(encoding="utf-8"))
        assert "presence.building.view" not in cat["sensitive_permissions_not_implied"], path
        by_id = {r["id"]: r["permissions"] for r in cat["roles"]}
        assert "presence.building.view" in by_id["system_admin"] and "presence.building.view" in by_id["site_admin"], path
