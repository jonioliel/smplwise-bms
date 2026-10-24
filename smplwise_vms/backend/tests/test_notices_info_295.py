"""NOTICEGB-295 slice B: the building-status chips of the TV feed (`info[]`) - states only, opt-in per board, safe when a module is off or
missing. Rows go straight into the tables; no device is contacted."""
from __future__ import annotations

import json

import pytest

from conftest import as_user, bind  # noqa: F401
from smplwise.db import Database
from smplwise.services.notices import info, model

API = "/api/v1"
T = "2026-10-01T00:00:00Z"


def _entity(conn, entity_id, state, domain="binary_sensor", unit=None, attrs=None):
    conn.execute("""INSERT INTO ha_entities(entity_id, domain, name, state, unit, attributes_json, available, first_seen_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""", (entity_id, domain, entity_id, state, unit, json.dumps(attrs or {}), T, T))


def _elevator(conn, eid, **roles):
    conn.execute("INSERT INTO infra_elevators(id, name, name_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (eid, eid, eid, T, T))
    for role, state in roles.items():
        ent = f"binary_sensor.{eid}_{role}"
        _entity(conn, ent, state)
        conn.execute("INSERT INTO infra_elevator_sensors(elevator_id, role, position, entity_id) VALUES (?, ?, 0, ?)", (eid, role, ent))


def _generator(conn, gid, engine, volt="0"):
    conn.execute("INSERT INTO generator_devices(id, name, source_kind, source_device_ref, detected_at) VALUES (?, ?, 'manual', ?, ?)", (gid, gid, gid, T))
    _entity(conn, f"sensor.{gid}_engine", engine, "sensor")
    _entity(conn, f"sensor.{gid}_v", volt, "sensor", "V")
    for role, ent, core in (("engine_state", f"sensor.{gid}_engine", 1), ("gen_v_l1", f"sensor.{gid}_v", 1)):
        conn.execute("INSERT INTO generator_roles(device_id, role, entity_ref, core) VALUES (?, ?, ?, ?)", (gid, role, ent, core))


@pytest.fixture()
def conn(client, settings):
    db = Database(settings.db_path)
    with db.connection() as c:
        yield c


def test_no_module_no_chips(conn):
    assert info.build(conn, list(model.INFO_KINDS), "he", connected=True) == []


def test_default_display_asks_for_every_kind_and_a_board_can_opt_out():
    assert model.default_display()["blocks"]["info"] == list(model.INFO_KINDS)
    assert model.normalize_display({"blocks": {"info": []}}, strict=True)["blocks"]["info"] == []
    assert model.merge_display(model.default_display(), {"blocks": {"info": ["gym"]}})["blocks"]["info"] == ["gym"]


@pytest.mark.parametrize("roles,state,text", [
    ({"fault": "off", "out_of_service": "off", "waiting": "on"}, "ok", "פועלות"),
    ({"fault": "on"}, "alarm", "תקלה"),
    ({"out_of_service": "on"}, "warn", "בטיפול"),
    ({"fault": "unavailable"}, "off", "לא זמין"),
])
def test_elevator_chip(conn, roles, state, text):
    _elevator(conn, "e1", **roles)
    assert info.build(conn, ["elevators"], "he", connected=True) == [{"kind": "elevators", "label": "מעליות", "state": state, "text": text}]


def test_elevators_worst_state_wins_disabled_ignored_and_offline_is_unavailable(conn):
    _elevator(conn, "e1", fault="off", waiting="on")
    _elevator(conn, "e2", fault="on")
    _elevator(conn, "e3", fault="on")
    conn.execute("UPDATE infra_elevators SET enabled = 0 WHERE id = 'e2'")
    assert info.build(conn, ["elevators"], connected=True)[0]["state"] == "alarm"
    assert info.build(conn, ["elevators"], connected=False)[0]["state"] == "off"
    conn.execute("UPDATE infra_elevators SET enabled = 0 WHERE id = 'e3'")
    assert info.build(conn, ["elevators"], connected=True)[0]["state"] == "ok"
    assert info.build(conn, ["elevators"], "en", connected=True)[0] == {"kind": "elevators", "label": "Elevators", "state": "ok", "text": "Running"}


@pytest.mark.parametrize("engine,state,text", [("stopped", "ok", "מוכן"), ("running", "warn", "פועל"), ("fault", "alarm", "תקלה")])
def test_generator_chip(conn, engine, state, text):
    _generator(conn, "g1", engine, volt="230")
    assert info.build(conn, ["generator"], "he", connected=True) == [{"kind": "generator", "label": "גנרטור", "state": state, "text": text}]
    assert info.build(conn, ["generator"], "he", connected=False)[0]["state"] == "off"  # a stale mirror is never "ready"


def test_only_the_asked_kinds_in_picker_order_and_parking_gym_have_no_provider_yet(conn):
    _elevator(conn, "e1", fault="off", waiting="on")
    _generator(conn, "g1", "stopped", "230")
    out = info.build(conn, ["generator", "elevators", "parking", "gym"], connected=True)
    assert [c["kind"] for c in out] == ["generator", "elevators"]
    assert [c["kind"] for c in info.build(conn, ["generator"], connected=True)] == ["generator"]
    assert info.build(conn, [], connected=True) == []


def test_a_failing_provider_never_breaks_the_feed(conn, monkeypatch):
    def boom(*a):
        raise RuntimeError("table missing")
    monkeypatch.setitem(info.PROVIDERS, "elevators", boom)
    _generator(conn, "g1", "stopped", "230")
    assert [c["kind"] for c in info.build(conn, ["elevators", "generator"], connected=True)] == ["generator"]


def test_chips_carry_no_ids_or_names(conn):
    _elevator(conn, "secret-lift", fault="on")
    blob = json.dumps(info.build(conn, ["elevators"], connected=True), ensure_ascii=False)
    assert "secret" not in blob and "binary_sensor" not in blob
    assert set(info.build(conn, ["elevators"], connected=True)[0]) == {"kind", "label", "state", "text"}


def test_the_feed_carries_info_only_when_there_is_a_chip(client, settings):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": "lobby"})
    token, bid = r.json()["token"], r.json()["board"]["id"]
    feed = lambda: client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token}).json()  # noqa: E731
    assert "info" not in feed()  # default asks for all, but no module exists
    db = Database(settings.db_path)
    with db.connection() as c:
        _generator(c, "g1", "stopped", "230")
    # ha_sync is not connected in tests: the chip is the honest "unavailable"
    assert [(c["kind"], c["state"]) for c in feed()["info"]] == [("generator", "off")]
    client.patch(f"{API}/notices/boards/{bid}", json={"display": {"blocks": {"info": []}}})
    assert "info" not in feed()
