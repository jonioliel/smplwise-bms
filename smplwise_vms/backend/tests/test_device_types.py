"""DEVTYPE (owner 2026-10-09): an administrator fixes the device type of a switch-wired device in Settings (one, or many at once),
or returns it to automatic. The fixed type wins over the name-word guess (services/device_activity.switch_equipment, which stays the
default); system.configure only (checked before the body); every change and every refusal audited; backed up, and kept by a restore of an
archive written before the table. Presentation only: the controls stay the entity's own domain's. Fixtures only - no device is touched."""
from __future__ import annotations

import io
import zipfile
from dataclasses import replace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import backup, device_activity, device_types, ha_client, ha_sync

T = "2026-10-09T08:00:00+00:00"


def _st(eid: str, name: str, state: str = "off", **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}, "last_changed": T, "last_updated": T}


STATES = [
    _st("switch.boiler", "דוד שמש"),  # the name says water heater
    _st("switch.garden_tap", "ברז גינה"),  # the name says valve
    _st("switch.sign", "Sign", "on"),  # a plain switch
    _st("switch.plug", "Kitchen plug", device_class="outlet"),
    _st("input_boolean.pump_helper", "Pump helper"),
    _st("light.lobby", "Lobby light", "on"),
    _st("climate.lobby", "Lobby AC", "cool", hvac_modes=["off", "cool"]),
]
FLOORS = [{"floor_id": "ground", "name": "קרקע", "level": 0, "icon": None}]
AREAS = [{"area_id": "lobby", "name": "לובי", "floor_id": "ground", "icon": None}]
REGISTRY = [{"entity_id": s["entity_id"], "id": f"reg-{s['entity_id']}", "area_id": "lobby", "device_id": None, "entity_category": None} for s in STATES]


@pytest.fixture()
def dev_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(REGISTRY, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    return app, s


def _kinds(c: TestClient) -> dict[str, str]:
    cards = c.get("/api/v1/devices/areas/lobby").json()["cards"]
    return {r["entity_id"]: r.get("activity_kind") for card in cards.values() for r in card["entities"]}


def test_activity_kind_override_wins_only_where_the_domain_allows_it():
    ak = device_activity.activity_kind
    assert ak("switch", None, None, "דוד שמש") == "water_heater", "the name lists stay the default"
    assert ak("switch", None, None, "דוד שמש", "switch") == "switch", "a fixed type wins over the name"
    assert ak("switch", "outlet", None, "Plug", "valve") == "valve", "and over the device class"
    assert ak("switch", None, None, "Sign", "water_heater") == "water_heater"
    assert ak("input_boolean", None, None, "x", "valve") == "valve"
    assert ak("input_boolean", None, None, "x", "outlet") == "switch", "a type the domain may not take is ignored"
    assert ak("light", None, None, "x", "valve") == "light" and ak("climate", None, "heating", None, "switch") == "heater"
    assert ak("sensor", None, None, "x", "switch") is None
    assert set(device_types.ALL_KINDS) == {"switch", "outlet", "light", "fan", "heater", "water_heater", "valve"}
    assert set(device_types.ALL_KINDS) <= set(device_activity.ACTIVITY_KINDS)


def test_list_set_bulk_auto_and_permission(dev_app):
    app, s = dev_app
    c = TestClient(app)
    before = _kinds(c)
    assert (before["switch.boiler"], before["switch.garden_tap"], before["switch.sign"], before["switch.plug"]) == ("water_heater", "valve", "switch", "outlet")

    listing = c.get("/api/v1/devices/device-types")
    assert listing.status_code == 200
    body = listing.json()
    rows = {r["entity_id"]: r for r in body["devices"]}
    assert set(rows) == {"switch.boiler", "switch.garden_tap", "switch.sign", "switch.plug", "input_boolean.pump_helper"}, "only the switch-wired domains"
    assert (rows["switch.boiler"]["kind"], rows["switch.boiler"]["auto"], rows["switch.boiler"]["set"]) == ("water_heater", "water_heater", None)
    assert rows["switch.boiler"]["area_name"] == "לובי" and rows["switch.boiler"]["floor_name"] == "קרקע"
    assert "outlet" not in rows["input_boolean.pump_helper"]["options"] and "outlet" in rows["switch.sign"]["options"]

    # one device: the manual choice overrides the name-based guess, in the area cards and in the activity window's entity
    r = c.put("/api/v1/devices/entities/switch.boiler/device-type", json={"kind": "switch"})
    assert r.status_code == 200 and (r.json()["kind"], r.json()["auto"], r.json()["set"], r.json()["changed"]) == ("switch", "water_heater", "switch", True)
    assert _kinds(c)["switch.boiler"] == "switch"
    act = c.get("/api/v1/devices/switch.boiler/activity")
    assert act.status_code == 200 and act.json()["entity"]["activity_kind"] == "switch"
    row = next(x for x in c.get("/api/v1/devices/device-types").json()["devices"] if x["entity_id"] == "switch.boiler")
    assert row["set"] == "switch" and row["set_at"] and row["set_by"]
    assert c.put("/api/v1/devices/entities/switch.boiler/device-type", json={"kind": "switch"}).json()["changed"] is False, "idempotent"

    # refusals: a domain whose type is its own, a type the domain may not take, an unknown entity, an unknown type
    assert c.put("/api/v1/devices/entities/light.lobby/device-type", json={"kind": "switch"}).status_code == 422
    assert c.put("/api/v1/devices/entities/input_boolean.pump_helper/device-type", json={"kind": "outlet"}).status_code == 422
    assert c.put("/api/v1/devices/entities/switch.nope/device-type", json={"kind": "valve"}).status_code == 404
    assert c.put("/api/v1/devices/entities/switch.sign/device-type", json={"kind": "boiler"}).status_code == 422
    assert c.put("/api/v1/devices/entities/switch.sign/device-type", content=b"kind=valve", headers={"content-type": "application/x-www-form-urlencoded"}).status_code == 415

    # many at once: per-id results, refusals counted, duplicates handled once
    b = c.post("/api/v1/devices/device-types", json={"entity_ids": ["switch.sign", "switch.plug", "input_boolean.pump_helper", "light.lobby", "switch.sign"], "kind": "valve"})
    assert b.status_code == 200, b.text
    res = {x["entity_id"]: x for x in b.json()["results"]}
    assert (b.json()["changed"], b.json()["refused"]) == (3, 1) and res["light.lobby"]["reason"] == "not_typeable" and len(b.json()["results"]) == 4
    k = _kinds(c)
    assert (k["switch.sign"], k["switch.plug"], k["input_boolean.pump_helper"], k["light.lobby"]) == ("valve", "valve", "valve", "light")
    assert c.post("/api/v1/devices/device-types", json={"entity_ids": [], "kind": "valve"}).status_code == 422

    # back to automatic: the name decides again
    b = c.post("/api/v1/devices/device-types", json={"entity_ids": ["switch.boiler", "switch.sign", "switch.plug", "input_boolean.pump_helper"], "kind": "auto"})
    assert b.json()["changed"] == 4
    assert _kinds(c) == before
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM device_type_override").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'devices.device_type' AND decision = 'allowed'").fetchone()[0] == 1 + 3 + 4
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'devices.device_type' AND decision = 'denied'").fetchone()[0] == 3
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'devices.device_type.batch'").fetchone()[0] == 2

    # system.configure only - a site administrator without it is refused before the body is looked at
    bind(c, s, "sa", "site_admin", "installation", "*")
    assert c.get("/api/v1/devices/device-types", headers=as_user("sa")).status_code == 403
    assert c.put("/api/v1/devices/entities/switch.sign/device-type", json={"kind": "valve"}, headers=as_user("sa")).status_code == 403
    assert c.put("/api/v1/devices/entities/switch.sign/device-type", content=b"not json", headers={**as_user("sa"), "content-type": "text/plain"}).status_code == 403
    assert c.post("/api/v1/devices/device-types", json={"entity_ids": ["switch.sign"], "kind": "valve"}, headers=as_user("sa")).status_code == 403
    assert _kinds(c)["switch.sign"] == "switch"


def test_fixed_types_are_backed_up_and_an_older_archive_keeps_them(dev_app, tmp_path):
    app, s = dev_app
    c = TestClient(app)
    assert "device_type_override" in backup.PROJECT_TABLES and "device_type_override" in backup.KEEP_WHEN_ABSENT
    assert c.put("/api/v1/devices/entities/switch.sign/device-type", json={"kind": "water_heater"}).status_code == 200
    e = c.post("/api/v1/backups", json={}).json()
    assert e["tables"]["device_type_override"] == 1
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    # change after the backup, then restore: replace = equal to the backup
    assert c.put("/api/v1/devices/entities/switch.sign/device-type", json={"kind": "auto"}).status_code == 200
    assert c.put("/api/v1/devices/entities/switch.plug/device-type", json={"kind": "light"}).status_code == 200
    up = c.post("/api/v1/backups/upload", files={"file": ("new.zip", raw, "application/zip")})
    res = c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    with app.state.db.connection(mode="read") as conn:
        assert {r[0]: r[1] for r in conn.execute("SELECT entity_id, kind FROM device_type_override")} == {"switch.sign": "water_heater"}
    # an archive written before the table: the current fixed types stay
    old = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(old, "w") as zout:
        for n in zin.namelist():
            if n != "data/device_type_override.json":
                zout.writestr(n, zin.read(n))
    assert c.put("/api/v1/devices/entities/switch.plug/device-type", json={"kind": "fan"}).status_code == 200
    up = c.post("/api/v1/backups/upload", files={"file": ("old.zip", old.getvalue(), "application/zip")})
    res = c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200 and "device_type_override" in res.json()["kept_current"]
    with app.state.db.connection(mode="read") as conn:
        assert {r[0]: r[1] for r in conn.execute("SELECT entity_id, kind FROM device_type_override")} == {"switch.sign": "water_heater", "switch.plug": "fan"}
