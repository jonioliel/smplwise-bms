"""CR-INFRA-ELEVATORS: elevators under Infrastructure. Negative cases first - invalid / non-binary / missing / invisible sensors, permission
denied, duplicate names, the uniform 404 - then the documented state-derivation table (incl. unavailable / unknown / conflicting / stale),
the scope rule (a floor-scoped viewer derives from his own sensors only) and the audit rows (ids only). A fake mirror only."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.services import elevators as el

API = "/api/v1/infra/elevators"


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = True
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    db = Database(settings.db_path)
    for eid in ("binary_sensor.el1_up", "binary_sensor.el1_down", "binary_sensor.el1_idle", "binary_sensor.el1_fault", "binary_sensor.el1_door", "binary_sensor.el1_maint",
                "binary_sensor.el2_fault", "binary_sensor.el2_up"):
        add_entity(db, eid, "off")
    add_entity(db, "sensor.el1_floor", "3", domain="sensor")
    yield c, db, settings
    ha_sync.STATE.connected = False


def add_entity(db: Database, eid: str, state: str, domain: str = "binary_sensor") -> None:
    at = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO ha_entities (entity_id, name, domain, state, available, last_changed, first_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                     (eid, eid.split(".")[1], domain, state, 0 if state == "unavailable" else 1, at, at, at))


def set_state(db: Database, eid: str, state: str) -> None:
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = ?, available = ? WHERE entity_id = ?", (state, 0 if state == "unavailable" else 1, eid))


FULL = {"moving_up": "binary_sensor.el1_up", "moving_down": "binary_sensor.el1_down", "waiting": "binary_sensor.el1_idle", "fault": "binary_sensor.el1_fault",
        "door_open": "binary_sensor.el1_door", "out_of_service": "binary_sensor.el1_maint"}


def create(c, name="מעלית A", sensors=None, **kw):
    return c.post(API, json={"name": name, "sensors": FULL if sensors is None else sensors, **kw})


# ---------------------------------------------------------------- validation (negative first)

@pytest.mark.parametrize("sensors,code", [
    ({}, "no_sensor"),
    ({"fault": None}, "no_sensor"),
    ({"fault": "sensor.el1_floor"}, "not_binary_sensor"),
    ({"fault": "light.kitchen"}, "not_binary_sensor"),
    ({"fault": "binary_sensor.a.b"}, "not_binary_sensor"),
    ({"fault": "binary_sensor.nope"}, "sensor_not_found"),
    ({"fault": "binary_sensor.el1_fault", "moving_up": "binary_sensor.el1_fault"}, "duplicate_sensor"),
])
def test_invalid_sensors_are_refused(app, sensors, code):
    c, db, _ = app
    r = create(c, sensors=sensors)
    assert r.status_code == 422, r.text
    assert r.json()["code"] == code
    assert r.json()["details"]["message_en"]
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_elevators").fetchone()[0] == 0


def test_unknown_role_extras_limit_and_area(app):
    c, _, _ = app
    assert create(c, sensors={"floor": "binary_sensor.el1_up"}).status_code == 422
    extras = [{"entity_id": f"binary_sensor.el1_{x}", "label": x} for x in ("up", "down", "idle", "door", "maint")]
    r = create(c, sensors={"fault": "binary_sensor.el1_fault"}, extras=extras)
    assert r.status_code == 422 and r.json()["code"] == "too_many_extras"
    r = create(c, sensors={"fault": "binary_sensor.el1_fault"}, area_id="no-such-area")
    assert r.status_code == 422 and r.json()["code"] == "area_not_found"
    r = create(c, sensors={"fault": "binary_sensor.el1_fault"}, extras=[{"entity_id": "binary_sensor.el1_fault", "label": "x"}])
    assert r.json()["code"] == "duplicate_sensor"


def test_removed_entity_counts_as_missing(app):
    c, db, _ = app
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = 'binary_sensor.el1_fault'", (now_iso(),))
    assert create(c, sensors={"fault": "binary_sensor.el1_fault"}).json()["code"] == "sensor_not_found"


def test_duplicate_names_are_refused_case_and_space_insensitive(app):
    c, _, _ = app
    assert create(c, name="Lift A").status_code == 201
    r = create(c, name="  lift   a ", sensors={"fault": "binary_sensor.el2_fault"})
    assert r.status_code == 409 and r.json()["code"] == "duplicate_name"


def test_permission_matrix(app):
    c, _, settings = app
    eid = create(c).json()["id"]
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "adm", "site_admin", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    o, a, v = as_user("ops"), as_user("adm"), as_user("vera")
    for h in (o, a, v):
        assert c.get(API, headers=h).status_code == 200
        assert c.get(f"{API}/{eid}", headers=h).status_code == 200
    body = {"name": "x", "sensors": {"fault": "binary_sensor.el2_fault"}}
    for h in (o, v):
        assert c.get(f"{API}/manage", headers=h).status_code == 403
        assert c.get(f"{API}/candidates", headers=h).status_code == 403
        assert c.post(API, json=body, headers=h).status_code == 403
        assert c.put(f"{API}/{eid}", json=body, headers=h).status_code == 403
        assert c.put(f"{API}/order", json={"ids": [eid]}, headers=h).status_code == 403
        assert c.delete(f"{API}/{eid}", headers=h).status_code == 403
    assert c.post(API, json=body, headers=a).status_code == 201
    # nobody without devices.read reads the list
    bind(c, settings, "kio", "kiosk", "installation", "*")
    assert c.get(API, headers=as_user("kio")).status_code == 403


def test_operator_routes_never_return_entity_ids(app):
    c, _, _ = app
    create(c, extras=[{"entity_id": "binary_sensor.el2_up", "label": "מאוורר"}])
    text = c.get(API).text
    assert "binary_sensor." not in text
    m = c.get(f"{API}/manage").json()["elevators"][0]
    assert m["sensors"]["fault"]["entity_id"] == "binary_sensor.el1_fault"
    assert m["extras"] == [{"entity_id": "binary_sensor.el2_up", "label": "מאוורר", "entity_name": "el2_up", "missing": False}]


def test_uniform_404(app):
    c, _, _ = app
    eid = create(c).json()["id"]
    for path in ("/nope",):
        r = c.get(API + path)
        assert r.status_code == 404 and r.json()["code"] == "elevator_not_found"
    assert c.put(f"{API}/nope", json={"name": "x", "sensors": {"fault": "binary_sensor.el2_fault"}}).status_code == 404
    assert c.delete(f"{API}/nope").status_code == 404
    # a disabled elevator does not exist for the operator screens
    c.put(f"{API}/{eid}", json={"name": "מעלית A", "sensors": FULL, "enabled": False})
    assert c.get(f"{API}/{eid}").status_code == 404
    assert c.get(API).json()["elevators"] == []


# ---------------------------------------------------------------- the state derivation table (pure)

T, F, N = True, False, None


@pytest.mark.parametrize("values,state,reason,partial", [
    # owner 2026-10-18 (waiting / fault / fire service / shutdown, no up-down sensors): negative first
    ({"fire_service": N, "waiting": F}, "active", "inferred_active", True),
    ({"fire_service": N, "fault": N, "waiting": N}, "unknown", "no_live_sensor", False),
    ({"fire_service": T, "fault": T}, "fire_service", "fire_service", False),
    ({"fire_service": T, "waiting": T}, "fire_service", "fire_service", False),
    ({"fire_service": T, "out_of_service": T, "moving_up": T}, "fire_service", "fire_service", False),
    ({"fire_service": N, "fault": T}, "fault", "fault", True),
    ({"fire_service": F, "fault": F, "out_of_service": T, "waiting": F}, "out_of_service", "out_of_service", False),
    ({"fire_service": F, "fault": F, "out_of_service": F, "waiting": F}, "active", "inferred_active", False),
    ({"fire_service": F, "fault": F, "out_of_service": F, "waiting": T}, "waiting", "waiting", False),
    ({"waiting": F, "moving_up": F, "moving_down": F}, "waiting", "inferred_idle", False),
    ({"waiting": F, "moving_up": N}, "unknown", "insufficient", True),
    ({"waiting": F, "door_open": T}, "door_open", "door_open", False),
    ({}, "unknown", "no_live_sensor", False),
    ({"fault": N, "moving_up": N}, "unknown", "no_live_sensor", False),
    ({"fault": T, "moving_up": T, "out_of_service": T}, "fault", "fault", False),
    ({"fault": F, "out_of_service": T, "moving_up": T}, "out_of_service", "out_of_service", False),
    ({"fault": F, "moving_up": T, "moving_down": F}, "moving_up", "moving_up", False),
    ({"fault": F, "moving_up": F, "moving_down": T}, "moving_down", "moving_down", False),
    ({"moving_up": T, "moving_down": T}, "unknown", "conflict", False),
    ({"fault": T, "moving_up": T, "moving_down": T}, "fault", "fault", False),
    ({"moving_up": F, "moving_down": F, "door_open": T}, "door_open", "door_open", False),
    ({"moving_up": F, "moving_down": F, "waiting": T}, "waiting", "waiting", False),
    ({"moving_up": F, "moving_down": F}, "waiting", "inferred_idle", False),
    ({"waiting": F}, "active", "inferred_active", False),
    ({"fault": F}, "unknown", "insufficient", False),
    ({"moving_up": F, "moving_down": N}, "unknown", "insufficient", True),
    ({"fault": N, "moving_up": T}, "moving_up", "moving_up", True),
    ({"fault": N, "waiting": T}, "waiting", "waiting", True),
])
def test_derivation_table(values, state, reason, partial):
    assert el.derive(values) == {"state": state, "reason": reason, "partial": partial}


@pytest.mark.parametrize("raw,available,removed,disabled,connected,out", [
    ("on", 1, None, 0, True, True), ("off", 1, None, 0, True, False), ("ON ", 1, None, 0, True, True),
    ("unavailable", 0, None, 0, True, None), ("unknown", 1, None, 0, True, None), ("", 1, None, 0, True, None), (None, 1, None, 0, True, None),
    ("on", 0, None, 0, True, None), ("on", 1, "2026-01-01", 0, True, None), ("on", 1, None, 1, True, None), ("on", 1, None, 0, False, None),
    ("open", 1, None, 0, True, None),
])
def test_bool_of(raw, available, removed, disabled, connected, out):
    assert el.bool_of(raw, available=available, removed=removed, disabled=disabled, connected=connected) is out


# ---------------------------------------------------------------- live state through the API

def test_live_state_follows_the_mirror(app):
    c, db, _ = app
    eid = create(c).json()["id"]
    assert c.get(f"{API}/{eid}").json()["state"] == "waiting"  # all off -> inferred idle
    set_state(db, "binary_sensor.el1_up", "on")
    got = c.get(f"{API}/{eid}").json()
    assert got["state"] == "moving_up" and got["since"]
    set_state(db, "binary_sensor.el1_down", "on")
    assert c.get(f"{API}/{eid}").json()["reason"] == "conflict"
    set_state(db, "binary_sensor.el1_fault", "on")
    body = c.get(API).json()
    assert body["elevators"][0]["state"] == "fault" and body["summary"]["fault"] == 1
    for e in FULL.values():
        set_state(db, e, "unavailable")
    assert c.get(f"{API}/{eid}").json()["state"] == "unknown"


def test_stale_mirror_is_unknown_never_a_state(app):
    from smplwise.services import ha_sync

    c, db, _ = app
    eid = create(c).json()["id"]
    set_state(db, "binary_sensor.el1_fault", "on")
    ha_sync.STATE.connected = False
    got = c.get(f"{API}/{eid}").json()
    assert got["state"] == "unknown" and got["stale"] is True


def test_extras_report_on_off_without_ids(app):
    c, db, _ = app
    eid = create(c, sensors={"fault": "binary_sensor.el1_fault"}, extras=[{"entity_id": "binary_sensor.el2_up", "label": "תאורה"}]).json()["id"]
    set_state(db, "binary_sensor.el2_up", "on")
    got = c.get(f"{API}/{eid}").json()
    assert got["extras"] == [{"position": 0, "label": "תאורה", "on": True}]


def test_floor_scoped_viewer_sees_only_his_sensors(app, monkeypatch):
    """A viewer bound to one floor: the elevator is derived from the sensor placed on his floor only; an elevator with no visible sensor
    is a 404 like a missing one, and its name never appears in the list."""
    from smplwise.services import ha_scope

    c, db, settings = app
    a = create(c, name="A").json()["id"]
    b = create(c, name="B", sensors={"fault": "binary_sensor.el2_fault"}).json()["id"]
    set_state(db, "binary_sensor.el1_fault", "on")  # invisible to him: must not leak as "fault"
    set_state(db, "binary_sensor.el1_up", "on")
    bind(c, settings, "flo", "viewer", "installation", "*")
    real = ha_scope.visible_floors

    def fake(conn, principal, permission):
        if principal.username == "flo":
            return False, {"f1"}
        return real(conn, principal, permission)

    monkeypatch.setattr(ha_scope, "visible_floors", fake)
    monkeypatch.setattr(ha_scope, "placements", lambda conn: {"binary_sensor.el1_up": [{"floor_id": "f1", "floor_name": "1"}]})
    h = as_user("flo")
    body = c.get(API, headers=h).json()
    assert [e["id"] for e in body["elevators"]] == [a]
    assert body["elevators"][0]["state"] == "moving_up" and body["elevators"][0]["roles"] == ["moving_up"]
    r = c.get(f"{API}/{b}", headers=h)
    assert r.status_code == 404 and r.json()["code"] == "elevator_not_found"
    assert '"B"' not in c.get(API, headers=h).text


def test_owner_set_fire_service_and_active(app):
    """The owner's integration: waiting, fault, fire service and shutdown per elevator, no movement sensors."""
    c, db, _ = app
    for e in ("binary_sensor.el3_wait", "binary_sensor.el3_fault", "binary_sensor.el3_fire", "binary_sensor.el3_shut"):
        add_entity(db, e, "off")
    eid = create(c, sensors={"waiting": "binary_sensor.el3_wait", "fault": "binary_sensor.el3_fault", "fire_service": "binary_sensor.el3_fire",
                             "out_of_service": "binary_sensor.el3_shut"}).json()["id"]
    assert c.get(f"{API}/{eid}").json()["state"] == "active"
    set_state(db, "binary_sensor.el3_wait", "on")
    assert c.get(f"{API}/{eid}").json()["state"] == "waiting"
    set_state(db, "binary_sensor.el3_fault", "on")
    set_state(db, "binary_sensor.el3_fire", "on")
    body = c.get(API).json()
    assert body["elevators"][0]["state"] == "fire_service" and body["summary"]["fire_service"] == 1
    set_state(db, "binary_sensor.el3_fire", "unavailable")  # ignored: the fault decides, marked partial
    got = c.get(f"{API}/{eid}").json()
    assert got["state"] == "fault" and got["partial"] is True
    for e in ("binary_sensor.el3_wait", "binary_sensor.el3_fault", "binary_sensor.el3_shut"):
        set_state(db, e, "unknown")
    assert c.get(f"{API}/{eid}").json()["state"] == "unknown"


def test_a_new_role_needs_no_migration(app):
    """Roles are keys in the sensors table (no CHECK): the closed list is code only."""
    _, db, _ = app
    with db.connection(mode="read") as conn:
        sql = conn.execute("SELECT sql FROM sqlite_master WHERE name = 'infra_elevator_sensors'").fetchone()[0]
    assert "CHECK" not in sql.upper()


# ---------------------------------------------------------------- order, update, delete, audit

def test_order_update_delete_and_audit_ids_only(app):
    c, db, _ = app
    a = create(c, name="A").json()["id"]
    b = create(c, name="B", sensors={"fault": "binary_sensor.el2_fault"}).json()
    assert c.put(f"{API}/order", json={"ids": [a]}).json()["code"] == "order_mismatch"
    assert [e["id"] for e in c.put(f"{API}/order", json={"ids": [b["id"], a]}).json()["elevators"]] == [b["id"], a]
    assert [e["id"] for e in c.get(API).json()["elevators"]] == [b["id"], a]
    r = c.put(f"{API}/{b['id']}", json={"name": "B2", "sensors": {"fault": "binary_sensor.el2_fault"}, "revision": b["revision"] + 5})
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"
    r = c.put(f"{API}/{b['id']}", json={"name": "B2", "sensors": {"fault": "binary_sensor.el2_fault", "moving_up": "binary_sensor.el2_up"}, "revision": b["revision"]})
    assert r.status_code == 200 and r.json()["name"] == "B2" and set(r.json()["sensors"]) == {"fault", "moving_up"}
    assert c.delete(f"{API}/{a}").status_code == 204
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_elevator_sensors WHERE elevator_id = ?", (a,)).fetchone()[0] == 0
        rows = conn.execute("SELECT action, resource_id, details_json FROM audit_log WHERE action LIKE 'infra.elevator.%'").fetchall()
    assert {r["action"] for r in rows} == {"infra.elevator.create", "infra.elevator.reorder", "infra.elevator.update", "infra.elevator.delete"}
    for r in rows:
        assert "binary_sensor" not in (r["details_json"] or "") and "B2" not in (r["details_json"] or "")


def test_candidates_list_only_binary_sensors(app):
    c, _, _ = app
    ids = {i["entity_id"] for i in c.get(f"{API}/candidates").json()["items"]}
    assert "binary_sensor.el1_up" in ids and "sensor.el1_floor" not in ids
    assert {i["entity_id"] for i in c.get(f"{API}/candidates?q=el2").json()["items"]} == {"binary_sensor.el2_fault", "binary_sensor.el2_up"}


def test_no_elevators_means_an_empty_list(app):
    c, _, _ = app
    body = c.get(API).json()
    assert body["elevators"] == [] and sum(body["summary"].values()) == 0


def test_permission_registered_for_admins_only():
    import json
    from pathlib import Path

    from smplwise.routers.access import PERMISSION_LABELS

    roles = {r["id"]: set(r["permissions"]) for r in json.loads((Path(el.__file__).resolve().parents[1] / "roles.json").read_text(encoding="utf-8"))["roles"]}
    assert {r for r, p in roles.items() if "infra.elevators.manage" in p} == {"site_admin", "system_admin"}
    assert PERMISSION_LABELS["infra.elevators.manage"]
