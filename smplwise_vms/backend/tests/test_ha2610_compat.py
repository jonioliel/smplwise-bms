"""HA 2026.10 compatibility scan (docs/operations/HA_2026_10_COMPATIBILITY_HE.md plan row 4): the read-only detector over the
mirrored automations / scripts and its administrator-only endpoint `GET /automations/compat`. Synthetic data only; the fake HA is
never written by the scan."""
from __future__ import annotations

import json

import pytest

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER
from smplwise.services import automations, ha_compat

FOR = {"minutes": 5}


@pytest.mark.parametrize("cond, code", [
    ({"state": "on"}, None),
    ({"state": ["on"]}, None),
    ({"state": "on", "entity_id": ["binary_sensor.a", "binary_sensor.b"]}, None),  # several entities stay valid in 2026.10
    ({"state": ["on", "off"]}, "state_for_list"),
    ({"state": []}, "state_for_list"),
    ({"state": "on", "attribute": "battery"}, "state_for_attribute"),
    ({"state": "input_select.mode"}, "state_for_input_helper"),
    ({"state": ["input_boolean.guest"]}, "state_for_input_helper"),
    ({"state": "input_select._bad"}, None),  # not an entity id by HA's pattern
])
def test_state_for_issue_mirrors_core_174083(cond, code):
    assert ha_compat.state_for_issue({"condition": "state", "entity_id": "binary_sensor.door", "for": FOR, **cond}) == code
    assert ha_compat.state_for_issue({"condition": "state", "entity_id": "binary_sensor.door", **cond}) is None, "no `for`, no issue"


def test_scan_config_walks_every_nesting_and_finds_admin_only_services():
    cfg = {
        "alias": "x",
        "triggers": [{"trigger": "state", "entity_id": "binary_sensor.door", "to": ["on", "off"], "for": FOR}],  # a trigger: unchanged in 2026.10
        "conditions": [{"condition": "or", "conditions": [{"condition": "state", "entity_id": "a.b", "state": ["on", "off"], "for": FOR}]}],
        "actions": [
            {"choose": [{"conditions": [{"condition": "state", "entity_id": "a.b", "state": "on", "attribute": "x", "for": FOR}],
                         "sequence": [{"action": "mqtt.publish", "data": {"topic": "t", "payload": "secret-ish"}}]}]},
            {"if": [{"condition": "state", "entity_id": "a.b", "state": "input_number.level", "for": FOR}], "then": [{"service": "Synology_DSM.reboot"}]},
            {"repeat": {"while": [{"condition": "state", "entity_id": "a.b", "state": "on", "for": FOR}], "sequence": [{"action": "{{ svc }}"}]}},
            {"action": "light.turn_on"},
        ],
    }
    found = ha_compat.scan_config("automation", cfg)
    assert [(f["code"], f["path"]) for f in found] == [
        ("state_for_list", "conditions[0].conditions[0]"),
        ("state_for_attribute", "actions[0].choose[0].conditions[0]"),
        ("admin_only_service", "actions[0].choose[0].sequence[0]"),
        ("state_for_input_helper", "actions[1].if[0]"),
        ("admin_only_service", "actions[1].then[0]"),
    ]
    assert [f.get("service") for f in found if f["code"] == "admin_only_service"] == ["mqtt.publish", "synology_dsm.reboot"]
    assert "secret-ish" not in json.dumps(found), "no configuration value in a finding"


def _file(fake, item_id):
    return next(i for i in fake.automations if str(i.get("id")) == item_id)


def test_compat_endpoint_is_admin_only_read_only_and_lists_the_findings(autos_app):
    app, s, c, fake, tr = autos_app
    assert c.get(f"{API}/automations").status_code == 200  # the first pull fills the mirror
    base = c.get(f"{API}/automations/compat")
    assert base.status_code == 200 and base.json()["scanned"] > 0 and set(base.json()["counts"]) == set(ha_compat.CODES)
    before = base.json()["counts"]

    item = _file(fake, "1727000000002")
    item["conditions"] = [*(item.get("conditions") or []), {"condition": "state", "entity_id": "binary_sensor.door", "state": ["on", "off"], "for": FOR}]
    script_key = next(iter(fake.scripts))
    fake.scripts[script_key]["sequence"] = [*fake.scripts[script_key]["sequence"], {"action": "mqtt.publish", "data": {"topic": "alarm/arm"}}]
    automations.MIRROR.pull(None, "test")
    calls_before, events_before = list(fake.rest_calls), len(fake.calls)

    r = c.get(f"{API}/automations/compat")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["counts"]["state_for_list"] == before["state_for_list"] + 1 and body["counts"]["admin_only_service"] == before["admin_only_service"] + 1
    assert body["truncated"] is False
    auto = next(i for i in body["items"] if i["kind"] == "automation" and i["id"] == "1727000000002")
    assert any(i["kind"] == "script" and i["id"] == script_key and i["issues"][-1] == {"code": "admin_only_service", "path": f"sequence[{len(fake.scripts[script_key]['sequence']) - 1}]", "service": "mqtt.publish"}
               for i in body["items"]), body["items"]
    assert auto["id"] == "1727000000002" and auto["name"] and auto["issues"][-1]["path"].startswith("conditions[")
    assert "alarm/arm" not in r.text, "no configuration value leaves the server"
    assert fake.rest_calls == calls_before and len(fake.calls) == events_before, "the scan never calls Home Assistant"

    assert c.get(f"{API}/automations/compat", headers=OMER).status_code == 403, "administrators only"


# ---------------------------------------------------------------- plan row 5: a manual run refused as Unauthorized

def test_bridge_error_names_the_administrator_rule_for_a_manual_run_only():
    from smplwise.services import automation_ops as ops

    for op in ("trigger", "run_script"):
        err = ops.bridge_error({"ok": False, "error": "unauthorized"}, op)
        assert (err.status, err.code, err.details) == (403, "requires_ha_admin", {"error": "unauthorized"}), op
        assert "מנהל" in err.user_message
    for op in ("enable", "disable", "upsert", "apply_scene", None):
        err = ops.bridge_error({"ok": False, "error": "unauthorized"}, op)
        assert err.code == "entity_not_controllable", "other refusals keep their meaning"
    assert ops.bridge_error({"ok": False, "error": "stale"}, "trigger").code == "item_changed"


def test_a_run_refused_by_ha_reaches_the_client_as_requires_ha_admin(autos_app):
    from automations_fixture import item_by_name, rid

    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "מזגן סלון בבוקר")
    tr.fail_next["answer"] = {"ok": False, "request_id": "x", "error": "unauthorized"}
    r = c.post(f"{API}/automations/automation/{it['id']}/run", json={"client_request_id": rid(), "confirm": True})
    assert r.status_code == 403, r.text
    body = r.json()
    assert body["code"] == "requires_ha_admin" and body["details"] == {"error": "unauthorized"} and "מנהל" in body["user_message"]
    r = c.post(f"{API}/automations/automation/{it['id']}/run", json={"client_request_id": rid(), "confirm": True})
    assert r.status_code == 202, "the refused run gave its interval slot back"

# ---------------------------------------------------------------- plan row 11: climate / water_heater `temperature_unit` (HA 2026.11)

def test_temperature_unit_comes_from_the_entity_attribute_when_present():
    from smplwise.services import devices

    base = {"entity_id": "climate.lobby", "name": "לובי", "state": "cool", "available": True}
    f = devices._climate_summary({**base, "attributes": {"current_temperature": 75, "temperature": 72, "temperature_unit": "°F"}})
    assert (f["unit"], f["current_temperature"], f["target_temperature"]) == ("°F", 75, 72), "the value is shown as reported, never converted"
    assert devices._climate_summary({**base, "attributes": {"current_temperature": 24}})["unit"] == "°C", "no attribute: as before"
    assert devices._climate_summary({**base, "unit": "°F", "attributes": {}})["unit"] == "°F"
    assert devices.temperature_unit({}, {"temperature_unit": "<b>x</b>"}) == "°C", "an unknown unit text is not passed through"