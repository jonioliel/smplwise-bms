"""MOBILE-CONTRACT-V22-2380: contract v2.2 of the phone app's presence API (docs/api/mobile-presence-contract.md section 4.1 and 2).

Covers: the per-sensor value shapes against the checked-in contract examples (contracts/examples/presence-sensor-values.v2.2.example.json -
valid, invalid with the exact first field / reason, and what `normalize` stores for the 2.1.x shapes), that every key and enum of the server's
shapes is written in the contract text, the `presence.value_check` setting (default `off` = the 2.1 behaviour, validated, audited, in the
config), `normalize` (never refuses, keeps only valid v2.2 keys) and `strict` (refuses the whole batch, never echoes the value) through the
real route, the Wi-Fi verdict on top of a checked value, and the `intervals_s` defaults for every sensor but `location`.
Fakes only: no phone, no Home Assistant, no lab value."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from conftest import as_user
from test_presence import API, _limits, bearer, enable, register, world  # noqa: F401 - shared fixtures

from smplwise.services import presence as svc
from smplwise.services import presence_values as pv

ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = json.loads((ROOT / "contracts" / "examples" / "presence-sensor-values.v2.2.example.json").read_text(encoding="utf-8"))
CONTRACT = (ROOT / "docs" / "api" / "mobile-presence-contract.md").read_text(encoding="utf-8")
SITE = [{"id": "site_main", "name": "המשרד", "lat": 32.0, "lon": 34.8, "radius_m": 150}]
SENTINEL = "zz-sentinel-value-zz"  # a value that must never come back in an error answer


def _ev(cid: str, sensor: str, value: dict, at: str = "2026-11-02T10:00:00Z") -> dict:
    return {"client_event_id": cid, "type": "sensor", "sensor": sensor, "at": at, "value": value}


def _ready(c, **settings) -> tuple[str, dict]:
    _, body = register(c, "dana")
    did, tok = body["device_id"], bearer(body["device_token"])
    st = enable(c, sites=SITE, **settings)
    assert c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": st["notice_version"]}, headers=tok).status_code == 200
    return did, tok


def _stored(app, did: str) -> dict[str, dict]:
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT client_event_id, value_json FROM mobile_presence_events WHERE device_id = ? AND type = 'sensor'", (did,)).fetchall()
    return {r[0]: json.loads(r[1]) for r in rows}


def _section(title_start: str) -> str:
    """One `### ` section of the contract text, up to the next heading of level 2 or 3."""
    m = re.search(rf"^### {re.escape(title_start)}.*?(?=^##+ )", CONTRACT, flags=re.M | re.S)
    assert m, f"contract section {title_start!r} missing"
    return m.group(0)


# ---------------------------------------------------------------- the examples file is the server's rules (no app needed)

@pytest.mark.parametrize("case", EXAMPLES["valid"], ids=lambda c: c["name"])
def test_a_valid_example_conforms_and_normalize_keeps_it_whole(case):
    assert pv.problems(case["sensor"], case["value"]) == []
    assert pv.normalize(case["sensor"], case["value"]) == case["value"]


@pytest.mark.parametrize("case", EXAMPLES["invalid"], ids=lambda c: c["name"])
def test_an_invalid_example_names_exactly_its_first_problem(case):
    found = pv.problems(case["sensor"], case["value"])
    assert found, case["name"]
    key, reason = found[0]
    assert (f"value.{key}", reason) == (case["field"], case["reason"])
    # whatever normalize keeps is valid: only a missing required key can remain
    assert all(r == pv.MISSING_KEY for _, r in pv.problems(case["sensor"], pv.normalize(case["sensor"], case["value"])))


@pytest.mark.parametrize("case", EXAMPLES["normalize"], ids=lambda c: c["name"])
def test_normalize_stores_what_the_example_says(case):
    assert pv.normalize(case["sensor"], case["value"]) == case["stored"]


def test_the_examples_cover_every_sensor_key_reason_and_mode():
    sensors_valid = {c["sensor"] for c in EXAMPLES["valid"]}
    assert sensors_valid == set(svc.SENSOR_KEYS) - {"location"}  # location has no sensor event
    assert {c["reason"] for c in EXAMPLES["invalid"]} == {pv.UNKNOWN_KEY, pv.INVALID_VALUE, pv.MISSING_KEY}
    used = {(c["sensor"], k) for c in EXAMPLES["valid"] for k in c["value"]}
    assert used == {(s, k) for s, shape in pv.SHAPES.items() for k in shape}, "a v2.2 key without a valid example"
    names = [c["name"] for part in ("valid", "invalid", "normalize") for c in EXAMPLES[part]]
    assert len(names) == len(set(names))
    assert set(pv.SHAPES) == set(svc.SENSORS)


def test_every_key_and_enum_of_the_shapes_is_in_the_contract_text():
    sec = _section("4.1")
    for sensor, shape in pv.SHAPES.items():
        row = next((ln for ln in sec.splitlines() if ln.startswith(f"| `{sensor}` |")), None)
        assert row is not None, f"no row for {sensor} in contract section 4.1"
        for key in shape:
            assert f"`{key}`" in row, (sensor, key)
    for enum in (pv.ACTIVITY_STATES, pv.CONFIDENCE, pv.CHARGING_STATES, pv.NETWORK_TYPES, pv.BEACON_PROXIMITY, pv.APP_STATES):
        for word in enum:
            assert f"`{word}`" in sec, word
    for mode in pv.VALUE_CHECK_MODES:
        assert f"`{mode}`" in sec, mode
    # the status object's location_auth list, and the intervals defaults, are written down too
    status = _section("4.2")
    for word in svc.LOCATION_AUTH:
        assert f"`{word}`" in status, word
    cadence = _section("2.2")
    for key, seconds in pv.DEFAULT_INTERVALS.items():
        assert re.search(rf"`{key}`\s*\|\s*{seconds}\b", cadence), (key, seconds)
    assert pv.CONTRACT_VERSION in CONTRACT.splitlines()[0]


# ---------------------------------------------------------------- the setting and the config

def test_value_check_defaults_off_is_validated_audited_and_reaches_the_config(world):
    app, c, _ = world
    _, body = register(c, "dana")
    tok = bearer(body["device_token"])
    cfg = c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["contract_version"] == "2.2" and cfg["sensors"]["value_check"] == "off" and cfg["enabled"] is False  # nothing is switched on
    assert c.get(f"{API}/presence/settings").json()["settings"]["value_check"] == "off"
    assert c.put(f"{API}/presence/settings", json={"value_check": "lenient"}).status_code == 422
    assert c.put(f"{API}/presence/settings", json={"value_check": True}).status_code == 422
    assert c.put(f"{API}/presence/settings", json={"value_check": "strict"}, headers=as_user("dana")).status_code == 403
    r = c.put(f"{API}/presence/settings", json={"value_check": "strict"})
    assert r.status_code == 200 and r.json()["settings"]["value_check"] == "strict"
    assert r.json()["settings"]["notice_version"] == 1  # a data-quality switch, not a new sensor: the employees are not asked again
    assert c.get(f"{API}/presence/config", headers=tok).json()["sensors"]["value_check"] == "strict"
    with app.state.db.connection(mode="read") as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.settings.update'").fetchall()]
    assert any(d.get("value_check") == "strict" for d in rows)


def test_intervals_have_a_default_for_every_sensor_but_location_and_an_override_merges(world):
    app, c, _ = world
    _, body = register(c, "dana")
    tok = bearer(body["device_token"])
    cfg = c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["sensors"]["intervals_s"] == pv.DEFAULT_INTERVALS  # also while the installation is off
    assert set(cfg["sensors"]["intervals_s"]) == set(svc.SENSOR_KEYS) - {"location"}
    assert pv.DEFAULT_INTERVALS["network"] == 60 and pv.DEFAULT_INTERVALS["beacon"] == 60 and pv.DEFAULT_INTERVALS["altitude"] == 300  # the apps' own values (S-4)
    assert pv.DEFAULT_INTERVALS["battery"] == 900 and pv.DEFAULT_INTERVALS["steps"] == 300 and pv.DEFAULT_INTERVALS["app_state"] == 300  # the 2.1 defaults kept
    assert c.put(f"{API}/presence/settings", json={"intervals_s": {"network": 120}}).status_code == 200
    got = c.get(f"{API}/presence/config", headers=tok).json()["sensors"]["intervals_s"]
    assert got == {**pv.DEFAULT_INTERVALS, "network": 120}
    for bad in ({"network": 10}, {"network": True}, {"camera": 60}, {"network": "60"}):
        assert c.put(f"{API}/presence/settings", json={"intervals_s": bad}).status_code == 422, bad
    # a stored map with a bad entry (hand-edited database) loses that entry only
    with app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = ? WHERE key = 'presence.intervals_s'", (json.dumps({"beacon": 5, "battery": 1800, "steps": True}),))
    assert c.get(f"{API}/presence/config", headers=tok).json()["sensors"]["intervals_s"] == {**pv.DEFAULT_INTERVALS, "battery": 1800}


# ---------------------------------------------------------------- the three modes through the real route

def test_off_stores_values_as_sent_exactly_like_v21(world):
    app, c, _ = world
    did, tok = _ready(c)
    events = [_ev(f"o{i:03d}", case["sensor"], case["value"]) for i, case in enumerate(EXAMPLES["normalize"]) if case["sensor"] != "location"]
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": events}, headers=tok)
    assert r.status_code == 200 and r.json()["accepted"] == len(events), r.text
    got = _stored(app, did)
    for ev in events:
        if ev["sensor"] != "network":  # network values pass the Wi-Fi verdict of 2.1 as before (test_presence)
            assert got[ev["client_event_id"]] == ev["value"], ev


def test_normalize_never_refuses_and_keeps_only_valid_v22_keys(world):
    app, c, _ = world
    did, tok = _ready(c, value_check="normalize")
    cases = [case for case in EXAMPLES["normalize"] + [{**v, "stored": v["value"]} for v in EXAMPLES["valid"]]
             if case["sensor"] != "location"]
    # an invalid example too: normalize stores what is left of it
    cases += [{**v, "stored": pv.normalize(v["sensor"], v["value"])} for v in EXAMPLES["invalid"] if v["sensor"] != "location"]
    events = [_ev(f"n{i:03d}", case["sensor"], case["value"]) for i, case in enumerate(cases)]
    for i in range(0, len(events), svc.BATCH_MAX):
        r = c.post(f"{API}/presence/devices/{did}/events", json={"events": events[i:i + svc.BATCH_MAX]}, headers=tok)
        assert r.status_code == 200, r.text
    got = _stored(app, did)
    with app.state.db.connection(mode="read") as conn:
        st = svc.load_settings(conn)
    for ev, case in zip(events, cases):
        want = svc._resolve_wifi(case["stored"], st) if case["sensor"] == "network" else case["stored"]  # the 2.1 Wi-Fi verdict runs after
        assert got[ev["client_event_id"]] == want, case["name"]
        assert set(got[ev["client_event_id"]]) <= set(pv.SHAPES[ev["sensor"]]), case["name"]  # nothing outside the v2.2 shapes is stored
    # a location value sent as a sensor event keeps no coordinate
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [_ev("loc1", "location", {"lat": 32.0, "lon": 34.8})]}, headers=tok)
    assert r.status_code == 200 and _stored(app, did)["loc1"] == {}


def test_strict_refuses_the_whole_batch_names_the_problem_and_never_echoes_the_value(world):
    app, c, _ = world
    did, tok = _ready(c, value_check="strict")
    good = _ev("s-good", "activity", {"state": "walking", "confidence": "high"})
    bad = _ev("s-bad", "battery", {"level_percent": 50, "charging_state": SENTINEL})
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [good, bad]}, headers=tok)
    assert r.status_code == 400 and r.json()["code"] == "invalid_event", r.text
    d = r.json()["details"]
    assert d == {"field": "value.charging_state", "reason": "invalid_value", "sensor": "battery", "client_event_id": "s-bad", "contract_version": "2.2"}
    assert SENTINEL not in r.text and r.json()["retryable"] is False
    assert _stored(app, did) == {}  # the whole batch was refused
    for i, case in enumerate(EXAMPLES["invalid"]):
        if case["sensor"] == "location":
            continue
        r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [_ev(f"i{i:03d}", case["sensor"], case["value"])]}, headers=tok)
        assert r.status_code == 400 and r.json()["details"]["field"] == case["field"] and r.json()["details"]["reason"] == case["reason"], (case["name"], r.text)
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [_ev("loc1", "location", {"lat": 32.0, "lon": 34.8})]}, headers=tok)
    assert r.status_code == 400 and r.json()["details"]["field"] == "value.lat"
    # conforming values pass unchanged
    events = [_ev(f"v{i:03d}", case["sensor"], case["value"]) for i, case in enumerate(EXAMPLES["valid"])]
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": events}, headers=tok)
    assert r.status_code == 200 and r.json()["accepted"] == len(events), r.text
    got = _stored(app, did)
    for ev in events:
        if ev["sensor"] != "network":
            assert got[ev["client_event_id"]] == ev["value"]
    # the envelope rules still come first (2.1): a sensor that is not allowed is `sensor_not_allowed`, not a shape problem
    assert c.put(f"{API}/presence/settings", json={"sensors_allowed": ["location", "activity"]}).status_code == 200
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [_ev("na1", "battery", {"bogus": 1})]}, headers=tok)
    assert r.status_code == 400 and r.json()["code"] == "sensor_not_allowed"


def test_strict_with_the_phone_side_wifi_match_still_produces_the_verdict(world):
    app, c, _ = world
    did, tok = _ready(c, value_check="strict")
    events = [_ev("w1", "network", {"network": "wifi", "wifi_match": True, "wifi_site_id": "site_main"}, at="2026-11-02T10:00:00Z"),
              _ev("w2", "network", {"network": "wifi", "wifi_match": True, "wifi_site_id": "site_elsewhere"}, at="2026-11-02T10:01:00Z")]
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": events}, headers=tok)
    assert r.status_code == 200, r.text
    got = _stored(app, did)
    assert got["w1"] == {"network": "wifi", "wifi_match": True, "wifi_site_id": "site_main"}
    assert got["w2"] == {"network": "wifi", "wifi_match": True}  # a site the server does not know is dropped (2.1 rule, unchanged)
    st = c.get(f"{API}/presence/devices/{did}/state", headers=tok).json()["presence"]
    assert st["wifi"] == {"match": True, "site_id": None, "at": "2026-11-02T10:01:00Z"}


def test_the_status_object_is_never_refused_by_the_value_check(world):
    app, c, _ = world
    did, tok = _ready(c, value_check="strict")
    status = {"location_auth": "sometimes", "precise": True, "sharing": True, "sensors": {"location": "on", "battery": "maybe", "steps": "unavailable"}}
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": status}, headers=tok)
    assert r.status_code == 200, r.text
    st = c.get(f"{API}/presence/devices/{did}/state", headers=tok).json()["status"]
    assert st["location_auth"] == "not_determined" and st["sensors"]["battery"] == "off" and st["sensors"]["steps"] == "unavailable"
