"""Climate entities of a second installation (heating thermostats + heat pump + duct air conditioners, with a custom
integration whose switches report `supported_features` as a list). Anonymised shapes, no real ids or names.

Regressions: (1) the state snapshot must keep the climate entities that come after a custom integration's odd
supported_features (the sync fix itself lives in ha_sync / tests/test_ha_state_shapes.py); (2) a climate target
was capped to 5..35 although a thermostat / heat pump targets 36..45 and reports its own max_temp (95 / 43);
(3) an entity with neither a name nor an original name showed its entity id until a state arrived."""
from __future__ import annotations

from dataclasses import replace

import pytest

from smplwise.errors import ApiError
from smplwise.services import devices as dsvc
from smplwise.services import ha_bridge, ha_client, ha_sync

T = "2026-09-30T10:00:00+00:00"


def _state(eid: str, state: str, **attrs):
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": T, "last_updated": T}


def _duct(n: int) -> dict:
    return _state(f"climate.duct_{n}", "off", friendly_name=f"Duct {n}", hvac_modes=["off", "auto", "cool", "dry", "fan_only"], fan_modes=["auto", "low", "medium", "high"], swing_modes=[],
                  min_temp=18, max_temp=30, current_temperature=24.7, temperature=25, fan_mode="low", swing_mode="off", supported_features=425, drlc_status_level=0)


def _thermostat(n: int, target: float) -> dict:
    return _state(f"climate.thermostat_{n}", "off", friendly_name=f"Thermostat {n}", hvac_modes=["off", "heat_cool"], min_temp=5.0, max_temp=95.0, target_temp_step=0.5,
                  current_temperature=25.5, temperature=target, supported_features=385)


HEAT_PUMP = _state("climate.heat_pump", "off", friendly_name="Heat pump", hvac_modes=["off", "heat_cool"], min_temp=5.0, max_temp=43.0, target_temp_step=1.0, current_temperature=27.3, temperature=36.0, supported_features=385)


def _snapshot() -> list[dict]:
    filler = [_state(f"sensor.filler_{i}", str(i), friendly_name=f"Filler {i}") for i in range(160)]
    # a custom integration's switch: supported_features is a list of names, not a bitmask
    odd = [_state(f"switch.odd_{i}", "off", friendly_name=f"Odd {i}", supported_features=["timer_on"]) for i in range(3)]
    more = [_state(f"sensor.more_{i}", "1", friendly_name=f"More {i}") for i in range(200)]
    return [_thermostat(1, 45.0), *filler, *odd, *more, _duct(1), _duct(2), _thermostat(2, 22.0), HEAT_PUMP]


@pytest.fixture()
def app_with_db(settings):
    from smplwise.main import create_app

    return create_app(replace(settings, ha_url="http://ha.local:8123", ha_token="test-token-value"))


def test_one_odd_supported_features_does_not_cost_the_rest_of_the_snapshot(app_with_db):
    db = app_with_db.state.db
    present = ha_sync.store_states(db, _snapshot(), T)
    assert len(present) == 1 + 160 + 3 + 200 + 4
    with db.connection(mode="read") as conn:
        rows = {r["entity_id"]: r for r in conn.execute("SELECT entity_id, name, state, supported_features FROM ha_entities").fetchall()}
    assert len(rows) == len(present)
    assert rows["switch.odd_0"]["supported_features"] == 0  # no bitmask: nothing offered, nothing invented
    # the climate entities AFTER the odd states are there with their name and state (before: the chunk was lost)
    assert rows["climate.duct_1"]["name"] == "Duct 1" and rows["climate.heat_pump"]["state"] == "off"
    assert rows["climate.duct_2"]["supported_features"] == 425


def test_the_climate_rows_carry_each_entitys_own_modes_range_and_step(app_with_db):
    db = app_with_db.state.db
    ha_sync.store_states(db, _snapshot(), T)
    with db.connection(mode="read") as conn:
        entities = [e for e in dsvc.load_entities(conn) if e["domain"] == "climate"]
    rows = {r["entity_id"]: r for r in dsvc.build_cards(entities, lambda _eid: True)["cards"]["climate"]["entities"]}
    t1, hp, d1 = rows["climate.thermostat_1"], rows["climate.heat_pump"], rows["climate.duct_1"]
    assert (t1["hvac_modes"], t1["target_temperature"], t1["min_temp"], t1["max_temp"], t1["target_temp_step"]) == (["off", "heat_cool"], 45.0, 5.0, 95.0, 0.5)
    assert (hp["target_temperature"], hp["max_temp"], hp["target_temp_step"]) == (36.0, 43.0, 1.0)
    assert (d1["hvac_modes"], d1["fan_modes"], d1["swing_modes"], d1["swing_mode"], d1["target_temp_step"]) == (["off", "auto", "cool", "dry", "fan_only"], ["auto", "low", "medium", "high"], None, "off", None)
    assert all(r["name"] == r["entity_id"].replace("climate.", "").replace("_", " ").capitalize() for r in rows.values())


def test_a_registry_only_climate_is_named_after_its_device_not_its_entity_id():
    # has_entity_name = True and no name / original_name: HA calls the entity by its device
    entities = [
        {"entity_id": "climate.unnamed", "id": "r1", "device_id": "dev-1", "name": None, "original_name": None},
        {"entity_id": "climate.renamed", "id": "r2", "device_id": "dev-1", "name": "Own name", "original_name": None},
        {"entity_id": "climate.orphan", "id": "r3", "device_id": None, "name": None, "original_name": None},
    ]
    devices = [{"id": "dev-1", "name": "Device name", "name_by_user": None, "area_id": None}]
    m = ha_client.registry_maps(entities, devices, [], [])
    assert m["climate.unnamed"]["name"] == "Device name" and m["climate.renamed"]["name"] == "Own name" and m["climate.orphan"]["name"] == ""
    devices[0]["name_by_user"] = "User device"
    assert ha_client.registry_maps(entities, devices, [], [])["climate.unnamed"]["name"] == "User device"


def test_the_target_temperature_follows_the_entitys_own_range():
    _, data = ha_bridge.validate_action("climate.set_temperature", "climate.thermostat_1", {"temperature": 45})  # the static check is only a sanity bound
    assert data["temperature"] == 45.0
    th = {"min_temp": 5.0, "max_temp": 95.0}
    hp = {"min_temp": 5.0, "max_temp": 43.0}
    duct = {"min_temp": 18, "max_temp": 30}
    ha_bridge.check_entity_range("climate.set_temperature", {"temperature": 45.0}, th)
    ha_bridge.check_entity_range("climate.set_temperature", {"temperature": 36.0}, hp)
    ha_bridge.check_entity_range("climate.set_temperature", {"temperature": 18.0}, duct)
    for attrs, value in ((hp, 44.0), (duct, 31.0), (duct, 17.5), (None, 36.0), ({}, 4.0)):  # an entity that reports no range keeps 5..35
        with pytest.raises(ApiError) as exc:
            ha_bridge.check_entity_range("climate.set_temperature", {"temperature": value}, attrs)
        assert exc.value.status == 422
    ha_bridge.check_entity_range("climate.set_temperature", {"temperature": 22.0}, None)
    ha_bridge.check_entity_range("climate.set_hvac_mode", {"hvac_mode": "heat_cool"}, hp)  # other actions are not range-checked
    with pytest.raises(ApiError):
        ha_bridge.validate_action("climate.set_temperature", "climate.thermostat_1", {"temperature": 200})
    # a thermostat that offers only heat_cool is switched on with that mode
    _, d = ha_bridge.validate_action("climate.set_hvac_mode", "climate.thermostat_1", {"hvac_mode": "heat_cool"})
    assert d["hvac_mode"] == "heat_cool"
