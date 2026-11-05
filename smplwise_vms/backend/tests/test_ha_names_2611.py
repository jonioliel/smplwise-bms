"""HA-2026-11-COMPAT-2404: Arx shows the names Home Assistant shows before and after the 2026.11 entity-name migration, pairs
alarm zones and bypass controls by full names (never by the short entity part), and places / names child devices as Home
Assistant does. Fixtures: tests/fake_ha_registry_2611.py (both registry shapes, compat names, a main entity, child devices).
No Home Assistant is contacted."""
from __future__ import annotations

import pytest

import fake_ha_registry_2611 as fx
from smplwise.db import Database
from smplwise.services import alarm as alarm_svc
from smplwise.services import ha_client, ha_naming, ha_sync, media_model as mm, media_store, switch_protection

VERSIONS = {"2026.10": fx.entities_2026_10, "2026.11": fx.entities_2026_11}


def _db(settings) -> Database:
    db = Database(settings.db_path)
    db.migrate()
    return db


def _load(db: Database, version: str) -> dict:
    maps = ha_client.registry_maps(VERSIONS[version](), fx.devices(), fx.AREAS, fx.FLOORS)
    with db.connection() as conn:
        for st in fx.states(version):
            ha_sync.upsert_state(conn, st)
        ha_sync.apply_registry(conn, maps)
        ha_sync.apply_structure(conn, fx.AREAS, fx.FLOORS, None)
        media_store.apply_devices(conn, fx.devices())
    return maps


# ------------------------------------------------------------------------------------------------ the shape and the rule


def test_registry_shape_is_read_from_the_listing():
    assert ha_naming.registry_shape(fx.entities_2026_10()) == ha_naming.V123
    assert ha_naming.registry_shape(fx.entities_2026_11()) == ha_naming.V124
    # a listing without next_name_part (an older core, the older fixtures of this suite) keeps Arx's earlier rule
    assert ha_naming.registry_shape([{"entity_id": "light.x", "name": None, "original_name": "X", "has_entity_name": False}]) == ha_naming.OLD
    assert ha_naming.registry_shape([{"entity_id": "light.x", "name": None, "original_name": "X"}]) == ha_naming.OLD
    assert ha_naming.registry_shape([]) == ha_naming.OLD


@pytest.mark.parametrize(("name", "prefix", "expected"), [
    ("My Device Temperature", "My Device", "Temperature"),
    ("my device temperature", "My Device", "Temperature"),        # case-folded match, a lower-case first word capitalised
    ("My Device: iPhone sync", "My Device", "iPhone sync"),      # a mixed-case first word is kept
    ("My Device - Power", "My Device", "Power"),
    ("My Device", "My Device", ""),                              # the name IS the device name: a main entity
    ("My DeviceTemperature", "My Device", None),                  # no separator: not a prefix
    ("Temperature", "My Device", None),
    ("Straße Licht", "STRASSE", "Licht"),                        # case folding changes the length
    (None, "My Device", None),
    ("Temperature", "", None),
])
def test_strip_prefix_is_core_strip_prefix_from_entity_name(name, prefix, expected):
    assert ha_naming.strip_prefix(name, prefix) == expected


@pytest.mark.parametrize("version", sorted(VERSIONS))
def test_registry_maps_shows_the_names_home_assistant_shows(version):
    maps = ha_client.registry_maps(VERSIONS[version](), fx.devices(), fx.AREAS, fx.FLOORS)
    got = {eid: (m["name"], m["short_name"], bool(m["main_entity"]), m["area_id"]) for eid, m in maps.items()}
    assert got == fx.EXPECTED[version]
    assert {m["naming"] for m in maps.values()} == {ha_naming.V123 if version == "2026.10" else ha_naming.V124}


def test_the_names_survive_the_migration_where_home_assistant_keeps_them():
    """The regression: Arx's earlier rule showed the migrated short names ("Motion", "Temperature") after the upgrade."""
    before = ha_client.registry_maps(fx.entities_2026_10(), fx.devices(), fx.AREAS, fx.FLOORS)
    after = ha_client.registry_maps(fx.entities_2026_11(), fx.devices(), fx.AREAS, fx.FLOORS)
    for eid, old in fx.OLD_ARX_NAME_2026_11.items():
        assert after[eid]["name"] != old
    for eid in ("sensor.living_thermostat_temperature", "binary_sensor.zone_7", "binary_sensor.zone_8", "sensor.front_door_battery", "alarm_control_panel.acme_panel"):
        assert after[eid]["name"] == before[eid]["name"]
    # the two zones keep distinct full names while their short parts collide
    assert after["binary_sensor.zone_7"]["short_name"] == after["binary_sensor.zone_8"]["short_name"] == "Motion"
    assert after["binary_sensor.zone_7"]["name"] != after["binary_sensor.zone_8"]["name"]


def test_compat_name_is_not_in_the_listing_and_the_friendly_name_carries_it():
    for e in fx.entities_2026_11():
        assert "compat_name" not in e and "has_entity_name" not in e
    for eid, compat in fx.COMPAT_NAME_2026_11.items():
        assert fx.FRIENDLY["2026.11"][eid] == compat


def test_the_older_shape_keeps_arx_s_earlier_rule():
    devs = [{"id": "d1", "name": "Hue 1", "area_id": None}]
    ents = [
        {"entity_id": "light.a", "device_id": "d1", "name": "Lobby ceiling", "original_name": "Hue 1"},
        {"entity_id": "light.b", "device_id": "d1", "name": None, "original_name": "Hue 1 lamp"},
        {"entity_id": "climate.c", "device_id": "d1", "name": None, "original_name": None},
        {"entity_id": "sensor.d", "device_id": "d1", "name": None, "original_name": "Power", "has_entity_name": True},
    ]
    maps = ha_client.registry_maps(ents, devs, [], [])
    assert [maps[e["entity_id"]]["name"] for e in ents] == ["Lobby ceiling", "Hue 1 lamp", "Hue 1", "Hue 1 Power"]
    assert maps["light.b"]["short_name"] == "Lamp" and maps["climate.c"]["main_entity"] == 1


# ------------------------------------------------------------------------------------------------ stored rows


@pytest.mark.parametrize("version", sorted(VERSIONS))
def test_the_mirror_stores_the_full_and_the_short_name(settings, version):
    db = _db(settings)
    _load(db, version)
    with db.connection(mode="read") as conn:
        rows = {r["entity_id"]: r for r in conn.execute("SELECT entity_id, name, short_name, main_entity, area_id, area_name, ha_floor_name FROM ha_entities")}
    for eid, (display, short, main, area) in fx.EXPECTED[version].items():
        r = rows[eid]
        assert (r["name"], r["short_name"], bool(r["main_entity"]), r["area_id"]) == (display, short, main, area), eid
    assert rows["switch.power_strip_socket_1"]["area_name"] == "Office" and rows["switch.power_strip_socket_1"]["ha_floor_name"] == "Upper"


def test_an_upgrade_rewrites_the_names_in_place(settings):
    """The owner's path: 2026.10 registry mirrored, Home Assistant upgraded, the next refresh brings the 2026.11 shape."""
    db = _db(settings)
    _load(db, "2026.10")
    _load(db, "2026.11")
    with db.connection(mode="read") as conn:
        r = conn.execute("SELECT name, short_name FROM ha_entities WHERE entity_id = 'switch.bypass_a'").fetchone()
        s = conn.execute("SELECT name FROM ha_entities WHERE entity_id = 'switch.power_strip_socket_1'").fetchone()
    assert tuple(r) == ("Alarm Panel Front Door Motion Bypass", "Front Door Motion Bypass")
    assert s["name"] == "Power Strip Socket 1"


# ------------------------------------------------------------------------------------------------ the alarm pairing


def _pairs(conn) -> dict[str, tuple[str | None, str | None]]:
    disc = alarm_svc.discover(conn)
    out = {}
    for p in disc["panels"]:
        for z in p["zones"]:
            out[z["entity_id"]] = ((z.get("bypass") or {}).get("entity_id"), (z.get("bypass") or {}).get("strategy"))
    return out


@pytest.mark.parametrize("version", sorted(VERSIONS))
def test_alarm_zones_pair_with_their_bypass_controls_in_both_shapes(settings, version):
    db = _db(settings)
    _load(db, version)
    with db.connection(mode="read") as conn:
        pairs = _pairs(conn)
    assert pairs["binary_sensor.zone_7"] == ("switch.bypass_a", "name")
    assert pairs["binary_sensor.zone_8"] == ("switch.bypass_b", "name")


def test_short_names_alone_would_not_pair_the_migrated_zones():
    """Both zones are "Motion" after the migration: the short part is not unique, so a pairing on it finds nothing (and a
    unique short collision could pair the wrong control) - the full names pair them."""
    zones = [{"entity_id": "binary_sensor.zone_7", "name": "Motion"}, {"entity_id": "binary_sensor.zone_8", "name": "Motion"}]
    ctls = [{"entity_id": "switch.bypass_a", "name": "Front Door Motion Bypass"}, {"entity_id": "switch.bypass_b", "name": "Back Door Motion Bypass"}]
    pairs: dict = {}
    alarm_svc._pair_unique(zones, ctls, lambda e, _c: alarm_svc.name_key(e.get("name")), "name", pairs)
    assert pairs == {}
    full = ha_client.registry_maps(fx.entities_2026_11(), fx.devices(), fx.AREAS, fx.FLOORS)
    zones = [{"entity_id": z["entity_id"], "name": full[z["entity_id"]]["name"], "attributes": {"friendly_name": fx.FRIENDLY["2026.11"][z["entity_id"]]}} for z in zones]
    ctls = [{"entity_id": c["entity_id"], "name": full[c["entity_id"]]["name"], "attributes": {"friendly_name": fx.FRIENDLY["2026.11"][c["entity_id"]]}} for c in ctls]
    got = alarm_svc._pair(zones, ctls, "acme_alarm")
    assert {z: c["entity_id"] for z, (c, _s) in got.items()} == {"binary_sensor.zone_7": "switch.bypass_a", "binary_sensor.zone_8": "switch.bypass_b"}


def test_a_bypass_word_only_in_the_friendly_name_still_marks_the_control():
    e = {"entity_id": "switch.zone_4_relay", "domain": "switch", "name": "Panel Relay 4", "short_name": "Relay 4", "attributes": {"friendly_name": "Kitchen window bypass"}}
    assert alarm_svc.is_bypass_control(e)


# ------------------------------------------------------------------------------------------------ child devices


def test_child_device_area_is_inherited_until_it_has_its_own():
    by_id = {d["id"]: d for d in fx.devices()}
    assert ha_naming.effective_area_id(by_id["dev_strip_s1"], by_id) == "office"
    assert ha_naming.effective_area_id(by_id["dev_strip_s2"], by_id) == "kitchen"
    assert ha_naming.effective_area_id(by_id["dev_thermo"], by_id) == "living"
    orphan = {"id": "x", "parent_device_id": "gone", "area_id": None}
    assert ha_naming.effective_area_id(orphan, by_id) is None


def test_child_device_label_carries_its_parent_while_it_has_no_area():
    by_id = {d["id"]: d for d in fx.devices()}
    assert ha_naming.device_label(by_id["dev_strip_s1"], by_id) == "Power Strip Socket 1"
    assert ha_naming.device_label(by_id["dev_strip_s2"], by_id) == "Socket 2"
    assert ha_naming.device_label(by_id["dev_strip"], by_id) == "Power Strip"
    named = dict(by_id["dev_strip_s1"], name="Power Strip USB")
    assert ha_naming.device_label(named, by_id) == "Power Strip USB"  # no doubled prefix


def test_the_device_mirror_keeps_the_parent_and_the_effective_area(settings):
    db = _db(settings)
    _load(db, "2026.11")
    with db.connection(mode="read") as conn:
        rows = {r["device_id"]: r for r in conn.execute("SELECT device_id, area_id, parent_device_id, next_name_part FROM ha_devices")}
        label = conn.execute("SELECT d.device_id, d.name, d.name_by_user, d.parent_device_id, d.next_name_part, p.device_id AS p_id, p.name AS p_name, p.name_by_user AS p_name_by_user "
                             "FROM ha_devices d LEFT JOIN ha_devices p ON p.device_id = d.parent_device_id WHERE d.device_id = 'dev_strip_s1'").fetchone()
    assert tuple(rows["dev_strip_s1"]) == ("dev_strip_s1", "office", "dev_strip", "parent_device")
    assert tuple(rows["dev_strip_s2"]) == ("dev_strip_s2", "kitchen", "dev_strip", "area")
    assert rows["dev_strip"]["parent_device_id"] is None and rows["dev_strip"]["area_id"] == "office"
    assert ha_naming.mirror_row_label(label) == "Power Strip Socket 1"
    # the parent moves: the child that inherits follows on the next refresh
    moved = [dict(d, area_id="bedroom") if d["id"] == "dev_strip" else d for d in fx.devices()]
    with db.connection() as conn:
        media_store.apply_devices(conn, moved)
        assert conn.execute("SELECT area_id FROM ha_devices WHERE device_id = 'dev_strip_s1'").fetchone()[0] == "bedroom"
        assert conn.execute("SELECT area_id FROM ha_devices WHERE device_id = 'dev_strip_s2'").fetchone()[0] == "kitchen"


def test_a_child_device_switch_is_judged_with_its_parent_hardware(settings):
    db = _db(settings)
    _load(db, "2026.11")
    with db.connection(mode="read") as conn:
        from_mirror = switch_protection._device_lookup(conn, None)
        from_listing = switch_protection._device_lookup(conn, fx.devices())
    for lookup in (from_mirror, from_listing):
        assert (lookup["dev_strip_s1"]["manufacturer"], lookup["dev_strip_s1"]["model"]) == ("Tuya", "PS-4")
        assert lookup["dev_strip_s1"]["name"] == "Socket 1"


def test_media_endpoints_of_a_child_device_join_the_parent_device():
    def ent(eid, device):
        return {"entity_id": eid, "domain": eid.split(".", 1)[0], "platform": "acme_av", "device_id": device, "unique_id": f"u-{eid}", "device_class": None,
                "name": eid, "original_name": None, "area_id": None, "state": "on", "available": True, "supported_features": 0, "attributes": {}}

    devs = [{"device_id": "rx", "name": "Receiver", "name_by_user": None, "area_id": "living", "manufacturer": "Acme", "model": "AVR-1", "connections": [], "identifiers": []},
            {"device_id": "rx_z2", "name": "Zone 2", "name_by_user": None, "area_id": None, "parent_device_id": "rx", "connections": [], "identifiers": []}]
    m = mm.build([ent("media_player.receiver", "rx"), ent("media_player.receiver_zone_2", "rx_z2")], devs, [], new_key=iter([f"k{i:031d}" for i in range(1, 9)]).__next__)
    (d,) = m.devices.values()
    assert {e.ref for e in d.endpoints} == {"media_player.receiver", "media_player.receiver_zone_2"}
    assert {e.rule for e in d.endpoints} == {"device"}
