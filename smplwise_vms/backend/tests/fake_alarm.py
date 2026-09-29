"""Alarm-system fixtures for CR-010 (אבטחה › אזעקה), shared by the backend tests (tests/test_alarm.py) and the Playwright
fixture backend (frontend/tests/fixtures/devices_fake_ha.py seeds them through the developer endpoints).

Two shapes, as the integrations really create them (docs/changes/CR-010-SECURITY-ALARM.md §2):

- RISCO (Home Assistant core `risco`, local mode - the owner's system): one config entry, two partitions
  (`alarm_control_panel.risco_*`, unique id `<system>_<partition>_local`), eight zones, each its own device with
  `binary_sensor.<zone>` (unique id `<system>_zone_<n>_local`, device class motion - Risco sets motion for every zone),
  `binary_sensor.<zone>_alarmed` / `_armed` (local mode's per-zone sensors) and `switch.<zone>_bypassed` (entity
  category config, unique id `<system>_zone_<n>_local_bypassed`); the system device's trouble sensors are diagnostic.
- PAI (Paradox via MQTT discovery, before PAI PR 619): every zone entity on the one panel device;
  `binary_sensor.paradox_zone_<zone>_open` / `_tamper` and `switch.paradox_zone_<zone>_bypassed`; one bypass switch
  of a zone PAI does not publish (unpaired).

Registry entries follow `config/entity_registry/list` (id, entity_id, unique_id, platform, config_entry_id, device_id,
area_id, entity_category, original_name); states follow `get_states`. No real system, address or name is in here."""
from __future__ import annotations

from typing import Any

T0 = "2026-09-29T18:00:00+00:00"
RISCO_SYS = "risco-fake-sys"
RISCO_ENTRY = "ce-risco-1"
PAI_ENTRY = "ce-mqtt-1"

# (zone number, object id, friendly name, area, open now)
RISCO_ZONES: list[tuple[int, str, str, str, bool]] = [
    (1, "front_door", "דלת כניסה", "alarm_lobby", False),
    (2, "back_door", "דלת אחורית", "alarm_kitchen", True),
    (3, "living_room_pir", "גלאי סלון", "alarm_living", False),
    (4, "kitchen_window", "חלון מטבח", "alarm_kitchen", False),
    (5, "garage_door", "דלת חניה", "alarm_lobby", False),
    (6, "hallway_pir", "גלאי מסדרון", "alarm_living", False),
    (7, "bedroom_window", "חלון חדר שינה", "alarm_bedroom", False),
    (8, "smoke_detector", "גלאי עשן", "alarm_kitchen", False),
]
AREAS = [
    {"area_id": "alarm_lobby", "name": "כניסה", "floor_id": "alarm_ground"},
    {"area_id": "alarm_kitchen", "name": "מטבח", "floor_id": "alarm_ground"},
    {"area_id": "alarm_living", "name": "סלון", "floor_id": "alarm_ground"},
    {"area_id": "alarm_bedroom", "name": "חדר שינה", "floor_id": "alarm_upper"},
]
FLOORS = [{"floor_id": "alarm_ground", "name": "קרקע", "level": 0}, {"floor_id": "alarm_upper", "name": "קומה 1", "level": 1}]


def _reg(entity_id: str, unique_id: str, platform: str, entry: str, device: str | None, area: str | None = None, name: str | None = None, category: str | None = None) -> dict[str, Any]:
    return {"id": f"reg-{entity_id}", "entity_id": entity_id, "unique_id": unique_id, "platform": platform, "config_entry_id": entry, "device_id": device,
            "area_id": area, "entity_category": category, "original_name": name, "name": None, "disabled_by": None, "hidden_by": None}


def _st(entity_id: str, state: str, **attrs: Any) -> dict[str, Any]:
    return {"entity_id": entity_id, "state": state, "attributes": attrs, "last_changed": T0, "last_updated": T0}


def risco(*, bypassed: tuple[int, ...] = (4,), state: str = "disarmed") -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """(entity registry, device registry, states) of a Risco local-mode system: 2 partitions, 8 zones."""
    reg: list[dict[str, Any]] = []
    devs: list[dict[str, Any]] = []
    sts: list[dict[str, Any]] = []
    for pid, oid, name, feats in ((0, "risco_house", "בית", 1 | 2 | 4), (1, "risco_garden", "חצר", 1 | 2)):
        dev = f"dev-risco-p{pid}"
        devs.append({"id": dev, "name": f"Partition {pid}", "manufacturer": "Risco", "area_id": None})
        reg.append(_reg(f"alarm_control_panel.{oid}", f"{RISCO_SYS}_{pid}_local", "risco", RISCO_ENTRY, dev))
        # code_format "number": the integration's code_arm_required / code_disarm_required options (here: arming free,
        # disarming with the code); supported_features from its ha_states_to_risco mapping
        sts.append(_st(f"alarm_control_panel.{oid}", state, friendly_name=f"אזעקה {name}", code_format="number", code_arm_required=False, changed_by=None, supported_features=feats))
    sysdev = "dev-risco-system"
    devs.append({"id": sysdev, "name": "Risco system", "manufacturer": "Risco", "area_id": None})
    reg.append(_reg("binary_sensor.risco_system_low_battery_trouble", f"{RISCO_SYS}_low_battery_trouble", "risco", RISCO_ENTRY, sysdev, category="diagnostic"))
    sts.append(_st("binary_sensor.risco_system_low_battery_trouble", "off", friendly_name="Low battery trouble", device_class="problem"))
    for n, oid, name, area, open_now in RISCO_ZONES:
        dev = f"dev-risco-z{n}"
        uid = f"{RISCO_SYS}_zone_{n}_local"
        devs.append({"id": dev, "name": name, "manufacturer": "Risco", "area_id": area})
        reg.append(_reg(f"binary_sensor.{oid}", uid, "risco", RISCO_ENTRY, dev, area))
        reg.append(_reg(f"binary_sensor.{oid}_alarmed", f"{uid}_alarmed", "risco", RISCO_ENTRY, dev, area, "Alarmed"))
        reg.append(_reg(f"binary_sensor.{oid}_armed", f"{uid}_armed", "risco", RISCO_ENTRY, dev, area, "Armed"))
        reg.append(_reg(f"switch.{oid}_bypassed", f"{uid}_bypassed", "risco", RISCO_ENTRY, dev, area, "Bypassed", "config"))
        sts.append(_st(f"binary_sensor.{oid}", "on" if open_now else "off", friendly_name=name, device_class="motion", zone_id=n, groups=[]))
        sts.append(_st(f"binary_sensor.{oid}_alarmed", "off", friendly_name=f"{name} Alarmed", zone_id=n))
        sts.append(_st(f"binary_sensor.{oid}_armed", "off", friendly_name=f"{name} Armed", zone_id=n))
        sts.append(_st(f"switch.{oid}_bypassed", "on" if n in bypassed else "off", friendly_name=f"{name} Bypassed", zone_id=n))
    return reg, devs, sts


PAI_ZONES = [("front_door", "Front door", "door"), ("garage", "Garage", "door"), ("hall_pir", "Hall PIR", "motion")]


def pai(*, state: str = "armed_away") -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """(entity registry, device registry, states) of a Paradox panel through PAI's MQTT discovery (all on one device)."""
    dev = "dev-pai-panel"
    reg = [_reg("alarm_control_panel.paradox_partition_area_1", "paradox_ser1_partition_area_1", "mqtt", PAI_ENTRY, dev)]
    sts = [_st("alarm_control_panel.paradox_partition_area_1", state, friendly_name="Paradox Area 1", code_format=None, supported_features=1 | 2 | 4)]
    for oid, name, dc in PAI_ZONES:
        base = f"paradox_zone_{oid}"
        reg.append(_reg(f"binary_sensor.{base}_open", f"paradox_ser1_zone_{oid}_open", "mqtt", PAI_ENTRY, dev))
        reg.append(_reg(f"binary_sensor.{base}_tamper", f"paradox_ser1_zone_{oid}_tamper", "mqtt", PAI_ENTRY, dev))
        reg.append(_reg(f"switch.{base}_bypassed", f"paradox_ser1_zone_{oid}_bypassed", "mqtt", PAI_ENTRY, dev))
        sts.append(_st(f"binary_sensor.{base}_open", "off", friendly_name=f"Zone {name} open", device_class=dc))
        sts.append(_st(f"binary_sensor.{base}_tamper", "off", friendly_name=f"Zone {name} tamper", device_class="tamper"))
        sts.append(_st(f"switch.{base}_bypassed", "off", friendly_name=f"Zone {name} bypassed"))
    # a bypass switch of a zone whose open/tamper sensors PAI does not publish: nothing to pair it with
    reg.append(_reg("switch.paradox_zone_shed_bypassed", "paradox_ser1_zone_shed_bypassed", "mqtt", PAI_ENTRY, dev))
    sts.append(_st("switch.paradox_zone_shed_bypassed", "off", friendly_name="Zone Shed bypassed"))
    return reg, [{"id": dev, "name": "EVO192", "manufacturer": "Paradox", "area_id": None}], sts


def everything() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    r1, d1, s1 = risco()
    r2, d2, s2 = pai()
    return r1 + r2, d1 + d2, s1 + s2
