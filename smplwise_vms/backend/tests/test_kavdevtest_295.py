"""KAVDEVTEST-295: the on-device test PLAN of a schedule (POST /automations-ext/schedule/{id}/device-test). The plan is data only - the client sends each
step through the device-control route, one click per step - so every case also asserts nothing was sent from here. Off by default (the same switch as
the automations' on-device test), the schedule manager only, an unknown / invisible schedule is 404, and an action that cannot be a device step is
listed with no entities (its button stays disabled)."""
from __future__ import annotations

import json

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER

AC = "climate.living_room"
SID = "sch_kdt_1"


def settings(c, **kv):
    r = c.patch(f"{API}/settings", json={f"automations.{k}": v for k, v in kv.items()})
    assert r.status_code == 200, r.text


def put_schedule(app, actions) -> None:
    item = {"schedule_id": SID, "entity_id": "switch.schedule_kdt", "name": "בדיקה", "weekdays": ["daily"], "enabled": True,
            "timeslots": [{"start": "07:00:00", "stop": None, "actions": actions}]}
    with app.state.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO schedule_cache(schedule_id, entity_id, revision, item_json, enabled, seen_at, changed_at) VALUES (?,?,?,?,?,?,?)",
                     (SID, item["entity_id"], "rev1", json.dumps(item), 1, "2026-10-24T10:00:00Z", "2026-10-24T10:00:00Z"))


def test_the_schedule_plan_is_off_by_default_and_a_manager_only(autos_app):
    app, s, c, fake, tr = autos_app
    c.patch(f"{API}/settings", json={"schedules.enabled": "true"})
    put_schedule(app, [{"service": "climate.set_hvac_mode", "entity_id": AC, "service_data": {"hvac_mode": "off"}}])
    url = f"{API}/automations-ext/schedule/{SID}/device-test"
    assert c.post(url, json={}).status_code == 409, "off by default"
    settings(c, device_test_enabled="true")
    assert c.post(url, json={}, headers=OMER).status_code == 403, "no schedule.manage"
    assert c.post(f"{API}/automations-ext/schedule/nope/device-test", json={}).status_code == 404
    assert not tr.bridge_calls


def test_the_plan_lists_allow_listed_actions_as_steps_and_the_rest_disabled(autos_app):
    app, s, c, fake, tr = autos_app
    c.patch(f"{API}/settings", json={"schedules.enabled": "true"})
    settings(c, device_test_enabled="true")
    put_schedule(app, [{"service": "climate.set_hvac_mode", "entity_id": AC, "service_data": {"hvac_mode": "off"}},
                       {"service": "notify.mobile_app_x", "entity_id": None, "service_data": {"message": "x"}}])
    r = c.post(f"{API}/automations-ext/schedule/{SID}/device-test", json={})
    assert r.status_code == 200, r.text
    plan = r.json()
    steps = plan["steps"]
    assert [(x["action"], x["entity_ids"]) for x in steps] == [("climate.set_hvac_mode", [AC]), ("notify.mobile_app_x", [])]
    assert steps[0]["data"] == {"hvac_mode": "off"} and steps[0]["path"] == "slots.0.actions.0" and "07:00" in steps[0]["sentence"]
    assert steps[1]["data"] == {} and steps[1]["now"] == []
    assert [x["entity_id"] for x in plan["snapshot"]] == [AC] and plan["triggers"] == [] and plan["end"] == "ask"
    assert not tr.bridge_calls, "a plan never sends anything"


def test_an_unsaved_draft_in_the_body_decides_the_steps_and_a_bad_argument_is_not_offered(autos_app):
    app, s, c, fake, tr = autos_app
    c.patch(f"{API}/settings", json={"schedules.enabled": "true"})
    settings(c, device_test_enabled="true")
    put_schedule(app, [{"service": "climate.set_hvac_mode", "entity_id": AC, "service_data": {"hvac_mode": "off"}}])
    draft = {"weekdays": ["daily"], "slots": [{"start": "08:30:00", "stop": None, "actions": [
        {"service": "climate.set_temperature", "entity_id": AC, "data": {"temperature": 22}},
        {"service": "climate.set_temperature", "entity_id": AC, "data": {"temperature": "hot"}},
        {"service": "light.turn_on", "entity_id": AC, "data": {}}]}]}
    plan = c.post(f"{API}/automations-ext/schedule/{SID}/device-test", json={"draft": draft}).json()
    got = [(x["action"], bool(x["entity_ids"])) for x in plan["steps"]]
    assert got == [("climate.set_temperature", True), ("climate.set_temperature", False), ("light.turn_on", False)], got
    assert plan["steps"][0]["data"] == {"temperature": 22} and "08:30" in plan["steps"][0]["sentence"]
    assert not tr.bridge_calls


def test_the_conflicts_answer_carries_the_device_test_flags_for_the_schedule_editor(autos_app):
    app, s, c, fake, tr = autos_app
    sched = {"weekdays": ["daily"], "slots": [{"start": "07:08:00", "stop": None, "actions": [{"service": "climate.set_hvac_mode", "entity_id": AC, "data": {"hvac_mode": "off"}}]}]}
    off = c.post(f"{API}/automations-ext/conflicts", json={"source": "schedule", "id": None, "draft": sched}).json()
    assert off["enabled"] is False and off["device_test"] is False and off["device_test_end"] == "ask"
    settings(c, precheck_enabled="true", device_test_enabled="true", device_test_end="restore")
    on = c.post(f"{API}/automations-ext/conflicts", json={"source": "schedule", "id": None, "draft": sched}).json()
    assert on["enabled"] is True and on["device_test"] is True and on["device_test_end"] == "restore"
