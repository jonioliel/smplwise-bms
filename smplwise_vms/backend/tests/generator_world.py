"""CR-031 GEN1 fixtures: a FAKE generator controller as a registry device with its entities, at three capability levels, plus a device
that is not a generator. Rows go straight into the registry mirror (`ha_devices`, `ha_entities`); no infrastructure or controller is
contacted. The names follow what generic genset integrations expose (English; the Hebrew variants are exercised in the unit tests)."""
from __future__ import annotations

from smplwise.db import Database

NOW_ISO = "2026-10-05T08:00:00Z"
GEN_DEVICE = "dev_generator_1"
OTHER_DEVICE = "dev_thermostat_1"

# (entity_id, name, domain, device_class, unit, state)
MINIMAL = [
    ("sensor.gen_engine_state", "Generator engine state", "sensor", None, None, "stopped"),
    ("sensor.gen_voltage_l1", "Generator voltage L1", "sensor", "voltage", "V", "0"),
]
TYPICAL = MINIMAL + [
    ("sensor.gen_voltage_l2", "Generator voltage L2", "sensor", "voltage", "V", "0"),
    ("sensor.gen_voltage_l3", "Generator voltage L3", "sensor", "voltage", "V", "0"),
    ("binary_sensor.gen_mains_ok", "Mains available", "binary_sensor", "power", None, "on"),
    ("select.gen_ats", "ATS position", "select", None, None, "Mains"),
    ("sensor.gen_mode", "Controller mode", "sensor", None, None, "Auto"),
    ("sensor.gen_rpm", "Engine speed", "sensor", None, "rpm", "0"),
    ("sensor.gen_coolant", "Coolant temperature", "sensor", "temperature", "°C", "38"),
    ("sensor.gen_battery", "Battery voltage", "sensor", "voltage", "V", "26.9"),
    ("sensor.gen_hours", "Engine run hours", "sensor", None, "h", "1284.5"),
    ("sensor.gen_load", "Generator load", "sensor", None, "%", "0"),
    ("sensor.gen_freq", "Generator frequency", "sensor", "frequency", "Hz", "0"),
    ("sensor.gen_power", "Generator power", "sensor", "power", "kW", "0"),
]
FULL = TYPICAL + [
    ("sensor.gen_fuel", "Fuel level", "sensor", None, "%", "92"),
    ("sensor.gen_oil", "Oil pressure", "sensor", "pressure", "kPa", "0"),
    ("sensor.gen_charger", "Charger voltage", "sensor", "voltage", "V", "0"),
    ("sensor.gen_pf", "Power factor", "sensor", "power_factor", None, "0"),
    ("sensor.gen_starts", "Number of starts", "sensor", None, None, "212"),
    ("sensor.gen_service_left", "Service hours remaining", "sensor", None, "h", "180"),
    ("sensor.gen_last_test", "Last test", "sensor", "timestamp", None, "2026-09-28T09:00:00+00:00"),
    ("sensor.gen_last_test_result", "Last test result", "sensor", None, None, "passed"),
    ("sensor.gen_next_test", "Next test", "sensor", "timestamp", None, "2026-10-12T09:00:00+00:00"),
    ("binary_sensor.gen_alarm_emergency", "Emergency stop alarm", "binary_sensor", None, None, "off"),
]
LEVELS = {"minimal": MINIMAL, "typical": TYPICAL, "full": FULL}


def _put(conn, device_id, spec, platform):
    eid, name, domain, dclass, unit, state = spec
    conn.execute(
        """INSERT OR REPLACE INTO ha_entities(entity_id, platform, device_id, name, domain, device_class, unit, state, available, last_updated, state_seen_at, first_seen_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)""",
        (eid, platform, device_id, name, domain, dclass, unit, state, NOW_ISO, NOW_ISO, NOW_ISO, NOW_ISO))


def make_generator(db: Database, level: str = "typical", *, device_id: str = GEN_DEVICE, name: str = "גנרטור ראשי", platform: str = "genset_ctl", model: str = "Genset Controller") -> list[str]:
    ids = []
    with db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO ha_devices(device_id, name, manufacturer, model, updated_at) VALUES (?,?,?,?,?)", (device_id, name, "Acme", model, NOW_ISO))
        for spec in LEVELS[level]:
            _put(conn, device_id, spec, platform)
            ids.append(spec[0])
    return ids


def make_other(db: Database) -> None:
    with db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO ha_devices(device_id, name, manufacturer, model, updated_at) VALUES (?,?,?,?,?)", (OTHER_DEVICE, "תרמוסטט סלון", "Acme", "T1", NOW_ISO))
        for spec in (("sensor.living_temp", "Living room temperature", "sensor", "temperature", "°C", "22"), ("sensor.living_humidity", "Living room humidity", "sensor", "humidity", "%", "40"),
                     ("sensor.living_battery", "Thermostat battery", "sensor", "battery", "%", "90")):
            _put(conn, OTHER_DEVICE, spec, "thermo")


def set_state(db: Database, entity_id: str, state: str) -> None:
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = ?, available = ?, last_updated = ? WHERE entity_id = ?", (state, 0 if state == "unavailable" else 1, NOW_ISO, entity_id))
