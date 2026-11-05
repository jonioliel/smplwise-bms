"""HA-2026-11-COMPAT-2404: one installation's registries in the two shapes Home Assistant answers with, before and after the
2026.11 entity-name migration (core entity registry storage 1.23 -> 1.24, home-assistant/core#184340).

- `entities_2026_10()`: `config/entity_registry/list` of core 2026.10.4 (`as_partial_dict`: `has_entity_name` and
  `next_name_part` both present, `original_name` already unprefixed).
- `entities_2026_11()`: the same registry after the 1.24 migration, as core 2026.11.0 lists it: `has_entity_name` is gone;
  a user-given name that started with its device's name lost that prefix ("Front Door Motion" -> "Motion"); a name that did
  not (or an entity with an area of its own) kept its name and got a `compat_name` - a STORAGE-ONLY field
  (`as_storage_fragment`), never in the WebSocket listing. `COMPAT_NAME_2026_11` lists them for the record; Arx sees them only
  through the state's `friendly_name`, which keeps the pre-migration name while a compat name is set
  (`async_get_legacy_friendly_name`).
- `devices()`: `config/device_registry/list` (main devices and child devices - `parent_device_id`, no manufacturer / model,
  `next_name_part`), the same in both versions (child devices exist since core 2026.9).
- `states(version)`: the friendly names core computes in that version.
- `EXPECTED[version][entity_id]`: (the name Home Assistant shows, the short entity part, main entity, area id) - derived by
  hand from the rules in docs/changes/HA-2026-11-COMPAT-2404.md, not from Arx's code.

Every name here is made up; no lab data."""
from __future__ import annotations

import copy
from typing import Any

T0 = "2026-11-05T08:00:00+00:00"
ENTRY = "ce-acme-alarm-1"

AREAS = [
    {"area_id": "hall", "name": "Hall", "floor_id": "ground"},
    {"area_id": "living", "name": "Living room", "floor_id": "ground"},
    {"area_id": "office", "name": "Office", "floor_id": "upper"},
    {"area_id": "kitchen", "name": "Kitchen", "floor_id": "ground"},
    {"area_id": "bedroom", "name": "Bedroom", "floor_id": "upper"},
]
FLOORS = [{"floor_id": "ground", "name": "Ground", "level": 0}, {"floor_id": "upper", "name": "Upper", "level": 1}]


def _dev(did: str, name: str, area: str | None, *, manufacturer: str | None = "Acme", model: str | None = "M1", by_user: str | None = None) -> dict[str, Any]:
    return {"id": did, "name": name, "name_by_user": by_user, "area_id": area, "manufacturer": manufacturer, "model": model, "via_device_id": None,
            "config_entry_id": "ce-x", "connections": [], "identifiers": [["acme", did]], "next_name_part": "area" if area else None, "parent_device_id": None,
            "disabled_by": None, "entry_type": None}


def _child(did: str, name: str, parent: str, area: str | None) -> dict[str, Any]:
    """A child device as `ChildDeviceEntry.dict_repr` lists it: no manufacturer, model, connections or via device."""
    return {"id": did, "name": name, "name_by_user": None, "area_id": area, "config_entry_id": "ce-tuya", "config_subentry_id": None, "disabled_by": None,
            "identifiers": [["tuya", did]], "labels": [], "next_name_part": "area" if area else "parent_device", "parent_device_id": parent}


def devices() -> list[dict[str, Any]]:
    return [
        _dev("dev_thermo", "Living Thermostat", "living"),
        _dev("dev_front", "Front Door", "hall"),
        _dev("dev_back", "Back Door", "hall"),
        _dev("dev_panel", "Alarm Panel", "hall", model="AP-8"),
        _dev("dev_bulb", "Hue Bulb", "bedroom", manufacturer="Signify", model="LCA001"),
        _dev("dev_ac", "Bedroom AC", "bedroom"),
        _dev("dev_strip", "Power Strip", "office", manufacturer="Tuya", model="PS-4"),
        _child("dev_strip_s1", "Socket 1", "dev_strip", None),       # no area of its own: inherits the strip's (office)
        _child("dev_strip_s2", "Socket 2", "dev_strip", "kitchen"),  # an area of its own
    ]


def _ent(eid: str, device: str | None, *, name: str | None, original: str | None, hen: bool = True, area: str | None = None, platform: str = "acme",
         entry: str | None = None, unique_id: str | None = None, category: str | None = None) -> dict[str, Any]:
    return {"id": f"reg-{eid}", "entity_id": eid, "unique_id": unique_id or f"uid-{eid}", "platform": platform, "config_entry_id": entry, "config_subentry_id": None,
            "device_id": device, "area_id": area, "name": name, "original_name": original, "has_entity_name": hen, "disabled_by": None, "hidden_by": None,
            "entity_category": category, "icon": None, "labels": [], "options": {}, "translation_key": None, "categories": {},
            "next_name_part": "area" if area else ("device" if device else None)}


# the 2026.10.4 registry. Comments: what the 1.24 migration does to each entry.
_PRE: list[dict[str, Any]] = [
    # renamed WITH its device prefix -> stripped to "Temperature"
    _ent("sensor.living_thermostat_temperature", "dev_thermo", name="Living Thermostat Temperature", original="Temperature"),
    # never renamed (a has_entity_name entity): untouched
    _ent("sensor.living_thermostat_humidity", "dev_thermo", name=None, original="Humidity"),
    # alarm zones, each on its own device, renamed with the device prefix -> both become "Motion"
    _ent("binary_sensor.zone_7", "dev_front", name="Front Door Motion", original="Zone 7", platform="acme_alarm", entry=ENTRY, unique_id="acme-z07"),
    _ent("binary_sensor.zone_8", "dev_back", name="Back Door Motion", original="Zone 8", platform="acme_alarm", entry=ENTRY, unique_id="acme-z08"),
    # bypass controls on the panel device, renamed WITHOUT its prefix -> name kept, compat_name set
    _ent("switch.bypass_a", "dev_panel", name="Front Door Motion Bypass", original="Bypass A", platform="acme_alarm", entry=ENTRY, unique_id="acme-ctl-a", category="config"),
    _ent("switch.bypass_b", "dev_panel", name="Back Door Motion Bypass", original="Bypass B", platform="acme_alarm", entry=ENTRY, unique_id="acme-ctl-b", category="config"),
    # the panel: a main entity (no name, no original name) - goes by the device name
    _ent("alarm_control_panel.acme_panel", "dev_panel", name=None, original=None, platform="acme_alarm", entry=ENTRY, unique_id="acme-panel"),
    # an entity with an area of its own, renamed with its device prefix -> NOT stripped (the device is not a name part), compat_name
    _ent("light.hall_ceiling", "dev_bulb", name="Hue Bulb Ceiling", original=None, area="hall"),
    # "Main entity of the device" turned on: name "" -> goes by the device name
    _ent("sensor.bedroom_ac_power", "dev_ac", name="", original="Power"),
    # child devices
    _ent("switch.power_strip_socket_1", "dev_strip_s1", name=None, original=None, platform="tuya"),
    _ent("sensor.power_strip_socket_1_power", "dev_strip_s1", name=None, original="Power", platform="tuya"),
    _ent("switch.power_strip_socket_2", "dev_strip_s2", name=None, original=None, platform="tuya"),
    # a legacy-named entity (has_entity_name False) whose original name starts with its device name: WS original_name is unprefixed
    _ent("sensor.front_door_battery", "dev_front", name=None, original="Battery", hen=False),
    # no device at all
    _ent("input_boolean.night_mode", None, name="Night mode", original=None, platform="input_boolean"),
]

# the 1.24 migration's result on the entries above (core helpers/entity_registry.py, `old_minor_version < 24`)
_MIGRATED_NAME = {
    "sensor.living_thermostat_temperature": "Temperature",
    "binary_sensor.zone_7": "Motion",
    "binary_sensor.zone_8": "Motion",
}
COMPAT_NAME_2026_11 = {
    "switch.bypass_a": "Front Door Motion Bypass",
    "switch.bypass_b": "Back Door Motion Bypass",
    "light.hall_ceiling": "Hue Bulb Ceiling",
}


def entities_2026_10() -> list[dict[str, Any]]:
    return copy.deepcopy(_PRE)


def entities_2026_11() -> list[dict[str, Any]]:
    out = []
    for e in copy.deepcopy(_PRE):
        e.pop("has_entity_name")  # no longer in `as_partial_dict` (2026.11.0)
        if e["entity_id"] in _MIGRATED_NAME:
            e["name"] = _MIGRATED_NAME[e["entity_id"]]
        out.append(e)  # compat_name stays in storage; the WebSocket listing never carries it
    return out


# friendly_name as core computes it: 2026.10.4 the legacy rule; 2026.11.0 the compat name while set, else the same legacy rule
FRIENDLY = {
    "2026.10": {
        "sensor.living_thermostat_temperature": "Living Thermostat Temperature",
        "sensor.living_thermostat_humidity": "Living Thermostat Humidity",
        "binary_sensor.zone_7": "Front Door Motion",
        "binary_sensor.zone_8": "Back Door Motion",
        "switch.bypass_a": "Front Door Motion Bypass",
        "switch.bypass_b": "Back Door Motion Bypass",
        "alarm_control_panel.acme_panel": "Alarm Panel",
        "light.hall_ceiling": "Hue Bulb Ceiling",
        "sensor.bedroom_ac_power": "Bedroom AC",
        "switch.power_strip_socket_1": "Socket 1",
        "sensor.power_strip_socket_1_power": "Socket 1 Power",
        "switch.power_strip_socket_2": "Socket 2",
        "sensor.front_door_battery": "Front Door Battery",
        "input_boolean.night_mode": "Night mode",
    },
}
FRIENDLY["2026.11"] = dict(FRIENDLY["2026.10"])  # unchanged by the migration: that is what compat_name is for

_STATE = {"binary_sensor": "off", "switch": "off", "alarm_control_panel": "disarmed", "light": "on", "sensor": "21", "input_boolean": "off"}


def states(version: str) -> list[dict[str, Any]]:
    return [{"entity_id": eid, "state": _STATE[eid.split(".", 1)[0]], "attributes": {"friendly_name": fn}, "last_changed": T0, "last_updated": T0}
            for eid, fn in FRIENDLY[version].items()]


# (display name Home Assistant shows, short entity part, main entity, area id)
EXPECTED: dict[str, dict[str, tuple[str, str, bool, str | None]]] = {
    # 2026.10: Home Assistant shows the friendly name
    "2026.10": {
        "sensor.living_thermostat_temperature": ("Living Thermostat Temperature", "Temperature", False, "living"),
        "sensor.living_thermostat_humidity": ("Living Thermostat Humidity", "Humidity", False, "living"),
        "binary_sensor.zone_7": ("Front Door Motion", "Motion", False, "hall"),
        "binary_sensor.zone_8": ("Back Door Motion", "Motion", False, "hall"),
        "switch.bypass_a": ("Front Door Motion Bypass", "Front Door Motion Bypass", False, "hall"),
        "switch.bypass_b": ("Back Door Motion Bypass", "Back Door Motion Bypass", False, "hall"),
        "alarm_control_panel.acme_panel": ("Alarm Panel", "Alarm Panel", True, "hall"),
        "light.hall_ceiling": ("Hue Bulb Ceiling", "Hue Bulb Ceiling", False, "hall"),
        "sensor.bedroom_ac_power": ("Bedroom AC", "Bedroom AC", True, "bedroom"),
        "switch.power_strip_socket_1": ("Socket 1", "Socket 1", True, "office"),
        "sensor.power_strip_socket_1_power": ("Socket 1 Power", "Power", False, "office"),
        "switch.power_strip_socket_2": ("Socket 2", "Socket 2", True, "kitchen"),
        "sensor.front_door_battery": ("Front Door Battery", "Battery", False, "hall"),
        "input_boolean.night_mode": ("Night mode", "Night mode", False, None),
    },
    # 2026.11: the frontend composes [parent device] [device] [entity] (computeEntityEntryNameParts)
    "2026.11": {
        "sensor.living_thermostat_temperature": ("Living Thermostat Temperature", "Temperature", False, "living"),
        "sensor.living_thermostat_humidity": ("Living Thermostat Humidity", "Humidity", False, "living"),
        "binary_sensor.zone_7": ("Front Door Motion", "Motion", False, "hall"),
        "binary_sensor.zone_8": ("Back Door Motion", "Motion", False, "hall"),
        "switch.bypass_a": ("Alarm Panel Front Door Motion Bypass", "Front Door Motion Bypass", False, "hall"),
        "switch.bypass_b": ("Alarm Panel Back Door Motion Bypass", "Back Door Motion Bypass", False, "hall"),
        "alarm_control_panel.acme_panel": ("Alarm Panel", "Alarm Panel", True, "hall"),
        "light.hall_ceiling": ("Hue Bulb Ceiling", "Hue Bulb Ceiling", False, "hall"),  # its own area: the device is not a name part
        "sensor.bedroom_ac_power": ("Bedroom AC", "Bedroom AC", True, "bedroom"),
        "switch.power_strip_socket_1": ("Power Strip Socket 1", "Socket 1", True, "office"),
        "sensor.power_strip_socket_1_power": ("Power Strip Socket 1 Power", "Power", False, "office"),
        "switch.power_strip_socket_2": ("Socket 2", "Socket 2", True, "kitchen"),  # child with its own area: no parent part
        "sensor.front_door_battery": ("Front Door Battery", "Battery", False, "hall"),
        "input_boolean.night_mode": ("Night mode", "Night mode", False, None),
    },
}

# what Arx stored as the name before this change (`name or original_name or device name`), after the migration - the bug
OLD_ARX_NAME_2026_11 = {
    "sensor.living_thermostat_temperature": "Temperature",
    "binary_sensor.zone_7": "Motion",
    "binary_sensor.zone_8": "Motion",
    "sensor.power_strip_socket_1_power": "Power",
}
