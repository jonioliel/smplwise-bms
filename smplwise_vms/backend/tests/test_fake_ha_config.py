"""The CR-017 fake itself (tests/fake_ha_config.py): HA's REST status codes and messages for the config API, the upsert, the raw storage, the reload
semantics (one automation / a script diff / all scenes), registry removal on delete, the include line, the runtime services, traces and the WebSocket
commands - the surface S1's service and the bridge tests rely on. Synthetic data only."""
from __future__ import annotations

import json

import pytest

import automations_seed as seed
from fake_ha_config import FakeHaConfig, FakeServiceError
from smplwise.services import automation_model as m

NEW = {"alias": "בדיקה", "description": "", "triggers": [{"trigger": "time", "at": "20:00:00"}], "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.hall"]}}], "mode": "single"}


@pytest.fixture()
def fake():
    return FakeHaConfig.seed_probe_like()


def test_the_seed_has_the_probe_shapes(fake):
    assert len(fake.automations) == 44 and len(fake.scripts) == 9 and len(fake.scenes) == 1
    scenes = [e for e in fake.states if e.startswith("scene.")]
    assert len(scenes) == 21  # 20 integration scenes without any id + the one native scene
    assert sum(1 for a in fake.automations if a.get("mode") == "restart") >= 5 and {a.get("mode") for a in fake.automations} == {"single", "restart", "queued", "parallel"}
    assert sum(1 for s in fake.states.values() if s["entity_id"].startswith("automation.") and s["state"] == "off") >= 2
    assert "switch.boiler" not in fake.states and "binary_sensor.old_door" not in fake.states  # the dangling references of the probe's system K
    assert fake.states["automation.garden_sunset"]["state"] == "unavailable" and fake.repairs[0]["entity_id"] == "automation.garden_sunset"
    # the entity attribute `id` = the config id = the registry `unique_id` (CR 3.1)
    st = fake.states["automation.hall_motion"]["attributes"]
    reg = fake.entity_registry_entry("automation.hall_motion")
    assert st["id"] == reg["unique_id"] == "1727700000002" and reg["platform"] == "automation"
    assert fake.entity_registry_entry("script.shutters")["unique_id"] == "shutters"
    # a YAML-managed item has an id and an entity but no file entry; one without an id has no registry row at all
    assert fake.states["automation.shabbat_irrigation"]["attributes"]["id"] == "yaml-shabbat-irrigation" and fake.entity_registry_entry("automation.no_id") is None
    assert "id" not in fake.states["automation.no_id"]["attributes"]


def test_config_get_unknown_is_404_delete_unknown_is_400_and_a_view_only_item_is_404(fake):
    assert fake.rest("GET", "/api/config/automation/config/nope") == (404, {"message": "Resource not found"})
    assert fake.rest("DELETE", "/api/config/automation/config/nope") == (400, {"message": "Resource not found"})
    assert fake.rest("GET", "/api/config/automation/config/yaml-shabbat-irrigation")[0] == 404
    status, body = fake.rest("GET", "/api/config/automation/config/1727700000002")
    assert status == 200 and body["id"] == "1727700000002" and body["alias"] == "תנועה בפרוזדור"
    status, body = fake.rest("GET", "/api/config/script/config/shutters")
    assert status == 200 and "id" not in body and body["alias"] == "תריסים לפי אחוז"  # a script's config has no id
    assert fake.rest("GET", "/api/config/scene/config/1727700000200")[0] == 200
    assert fake.rest("GET", "/api/config/blueprint/config/x")[0] == 404 and fake.rest("GET", "/api/other")[0] == 404
    assert fake.rest("GET", "/api/config/automation/config/1", admin=False)[0] == 401  # admin-only


def test_post_is_an_upsert_stores_the_raw_body_with_id_first_and_reloads_only_that_automation(fake):
    status, body = fake.rest("POST", "/api/config/automation/config/1727799999999", NEW)
    assert (status, body) == (200, {"result": "ok"})
    stored = fake.automations[-1]
    assert list(stored) == ["id", *NEW] and stored["id"] == "1727799999999"  # `id` first, the body's own order after
    assert fake.states[fake._entity_of[("automation", "1727799999999")]]["state"] == "on"
    # an update of an existing key replaces in place and reloads only that item
    before = [dict(a) for a in fake.automations]
    other_state = dict(fake.states["automation.hall_motion"])
    edited = {**NEW, "alias": "שונה"}
    assert fake.rest("POST", "/api/config/automation/config/1727799999999", edited)[0] == 200
    assert [a["alias"] for a in fake.automations].count("שונה") == 1 and len(fake.automations) == len(before)  # replaced in place, not appended again
    assert fake.states[fake._entity_of[("automation", "1727799999999")]]["attributes"]["friendly_name"] == "שונה"
    assert fake.states["automation.hall_motion"] == other_state
    assert fake.rest("DELETE", "/api/config/automation/config/1727799999999") == (200, {"result": "ok"})
    assert ("automation", "1727799999999") not in fake._entity_of and not any(r["unique_id"] == "1727799999999" for r in fake.registry)  # the registry entry (and so the entity) is gone


def test_post_validates_and_answers_message_malformed(fake):
    bad = [
        ({**NEW, "triggers": [{"trigger": "nonsense"}]}, "Invalid trigger"), ({**NEW, "extra_key": 1}, "extra keys not allowed"), ({**NEW, "mode": "loop"}, "expected one of"),
        ({k: v for k, v in NEW.items() if k != "actions"}, "required key not provided"), ({**NEW, "actions": [{"nothing": 1}]}, "Unable to determine action"),
        ({**NEW, "actions": [{"action": "nodot"}]}, "does not match format"), ({**NEW, "conditions": [{"condition": "nope"}]}, "Invalid condition"),
    ]
    for body, text in bad:
        status, answer = fake.rest("POST", "/api/config/automation/config/1727799999998", body)
        assert status == 400 and answer["message"].startswith("Message malformed: ") and text in answer["message"], (text, answer)
    assert not any(a.get("id") == "1727799999998" for a in fake.automations)
    assert fake.rest("POST", "/api/config/automation/config/1", ["not", "a", "dict"]) == (400, {"message": "Invalid JSON specified"})
    assert fake.rest("POST", "/api/config/script/config/Bad-Key", {"sequence": []}) == (400, {"message": "Key not valid"})
    # everything of the seed (new schema) passes the fake's validator: it is a stand-in for HA's, not a stricter one
    for a in fake.automations:
        fake.validate("automation", a)
    for s in fake.scripts.values():
        fake.validate("script", s)
    for s in fake.scenes:
        fake.validate("scene", s)


def test_scripts_reload_as_a_diff_and_scenes_reload_all(fake):
    assert fake.rest("POST", "/api/config/script/config/arx_1727700001234", {"alias": "חדש", "sequence": [{"delay": {"seconds": 1}}]})[0] == 200
    assert "script.arx_1727700001234" in fake.states and fake.entity_registry_entry("script.arx_1727700001234")["unique_id"] == "arx_1727700001234"
    other = dict(fake.states["script.shutters"])
    assert fake.rest("POST", "/api/config/script/config/arx_1727700001234", {"alias": "שם אחר", "sequence": [{"delay": {"seconds": 2}}]})[0] == 200
    assert fake.states["script.arx_1727700001234"]["attributes"]["friendly_name"] == "שם אחר" and fake.states["script.shutters"] == other
    assert fake.rest("DELETE", "/api/config/script/config/arx_1727700001234")[0] == 200 and "script.arx_1727700001234" not in fake.states
    fake.drain_events()
    scene = {"name": "סצנה חדשה", "entities": {"light.hall": {"state": "on", "brightness": 100}}}
    assert fake.rest("POST", "/api/config/scene/config/1727700001235", scene)[0] == 200
    eid = fake._entity_of[("scene", "1727700001235")]
    assert fake.states[eid]["attributes"]["id"] == "1727700001235" and fake.entity_registry_entry(eid)["platform"] == "homeassistant"
    assert [e["event_type"] for e in fake.drain_events()] == ["scene_reloaded"]  # `scene.reload` reloads everything and says so; there is no script_reloaded event
    # a dynamic scene (scene.create) is dropped by scene.reload in the fake (UNVERIFIED on a real system: U-8)
    fake.call_service("scene", "create", {"scene_id": "arx_undo_1", "snapshot_entities": ["light.hall"]})
    assert "scene.arx_undo_1" in fake.states
    fake.call_service("scene", "reload")
    assert "scene.arx_undo_1" not in fake.states
    keep = FakeHaConfig.seed_probe_like(reload_drops_dynamic_scenes=False)
    keep.call_service("scene", "create", {"scene_id": "arx_undo_1", "snapshot_entities": ["light.hall"]})
    keep.call_service("scene", "reload")
    assert "scene.arx_undo_1" in keep.states


def test_a_missing_include_line_means_a_write_never_loads(fake):
    f = FakeHaConfig.seed_probe_like(include_loaded=False)
    assert f.rest("POST", "/api/config/automation/config/1727799999997", NEW)[0] == 200
    assert any(a.get("id") == "1727799999997" for a in f.automations) and ("automation", "1727799999997") not in f._entity_of  # in the file, never an entity (U-5)


def test_config_api_unavailable_and_failures_are_injected(fake):
    off = FakeHaConfig.seed_probe_like(config_api=False)
    assert off.rest("GET", "/api/config/automation/config/1727700000002")[0] == 404
    fake.fail_next["POST"] = (500, {"message": "boom"})
    assert fake.rest("POST", "/api/config/automation/config/1727799999996", NEW) == (500, {"message": "boom"})
    assert fake.rest("POST", "/api/config/automation/config/1727799999996", NEW)[0] == 200  # one-shot


def test_runtime_services_with_context_events_and_traces(fake):
    fake.drain_events()
    fake.call_service("automation", "turn_off", {"entity_id": "automation.hall_motion"}, user_id="u-dana")
    assert fake.states["automation.hall_motion"]["state"] == "off" and fake.calls[-1]["user_id"] == "u-dana"
    fake.call_service("automation", "turn_on", {"entity_id": "automation.hall_motion"})
    # trigger: skip_condition defaults to TRUE (HA); false evaluates the typed state / numeric conditions against the world
    fake.call_service("automation", "trigger", {"entity_id": "automation.alarm_disarm_home"}, user_id="u-yoni")
    assert fake.states["alarm_control_panel.home"]["state"] == "disarmed"
    ev = fake.drain_events("automation_triggered")
    assert ev[-1]["data"]["entity_id"] == "automation.alarm_disarm_home" and ev[-1]["context"]["user_id"] == "u-yoni"
    fake.states["person.yoni"]["state"] = "not_home"
    fake.call_service("automation", "trigger", {"entity_id": "automation.salon_ac_morning", "skip_condition": False})
    run = fake.traces[("automation", next(c for (k, c), e in fake._entity_of.items() if e == "automation.salon_ac_morning"))][-1]
    assert run["script_execution"] == "failed_conditions" and run["trigger"] == "manual" and run["context"]["user_id"] is None
    fake.call_service("script", "turn_on", {"entity_id": "script.good_morning", "variables": {"x": 1}}, user_id="u-yoni")
    assert fake.states["script.good_morning"]["attributes"]["last_triggered"] and fake.states["cover.salon_shutter"]["state"] == "open"
    assert fake.drain_events("script_started")[-1]["data"]["entity_id"] == "script.good_morning"
    fake.hold_script_runs = True
    fake.call_service("script", "turn_on", {"entity_id": "script.vacation"})
    assert fake.states["script.vacation"]["attributes"]["current"] == 1
    fake.call_service("script", "turn_off", {"entity_id": "script.vacation"})
    assert fake.states["script.vacation"]["attributes"]["current"] == 0
    fake.call_service("script", "shutters", {"percent": 40})  # `script.<key>`: the fields arrive as data
    fake.call_service("scene", "turn_on", {"entity_id": "scene.arx_welcome"})
    assert fake.states["light.entry"]["attributes"]["brightness"] == 204
    with pytest.raises(FakeServiceError):
        fake.call_service("automation", "trigger", {"entity_id": "automation.nope"})
    with pytest.raises(FakeServiceError):
        fake.call_service("scene", "delete", {"entity_id": "scene.arx_welcome"})  # only dynamic scenes can be deleted


def test_websocket_commands(fake):
    ws = fake.ws
    states = ws({"type": "get_states"})["result"]
    assert any(s["entity_id"] == "automation.hall_motion" and s["attributes"]["id"] == "1727700000002" for s in states)
    assert ws({"type": "config/entity_registry/list"})["result"][0].keys() >= {"entity_id", "unique_id", "platform", "area_id"}
    cfg = ws({"type": "automation/config", "entity_id": "automation.hall_motion"})["result"]["config"]
    assert cfg["id"] == "1727700000002"
    assert ws({"type": "automation/config", "entity_id": "automation.shabbat_irrigation"})["result"]["config"]["alias"] == "השקיה בשבת"  # the view-only item is readable
    assert ws({"type": "script/config", "entity_id": "script.shutters"})["result"]["config"]["alias"] == "תריסים לפי אחוז"
    assert ws({"type": "automation/config", "entity_id": "automation.nope"})["error"]["code"] == "not_found"
    assert ws({"type": "automation/config", "entity_id": "automation.hall_motion"}, admin=False)["error"]["code"] == "unauthorized"
    runs = ws({"type": "trace/list", "domain": "automation", "item_id": "1727700000002"})["result"]
    assert len(runs) == 3 and runs[0].keys() >= {"run_id", "last_step", "state", "timestamp", "trigger"} and "trace" not in runs[0]
    full = ws({"type": "trace/get", "domain": "automation", "item_id": "1727700000002", "run_id": runs[0]["run_id"]})["result"]
    assert "trigger/0" in full["trace"] and "action/0" in full["trace"] and full["config"]["id"] == "1727700000002" and full["context"].keys() >= {"id", "parent_id", "user_id"}
    assert ws({"type": "trace/get", "domain": "automation", "item_id": "1727700000002", "run_id": "nope"})["success"] is False
    assert len(ws({"type": "trace/list", "domain": "script"})["result"]) == 2
    v = ws({"type": "validate_config", "triggers": [{"trigger": "time", "at": "20:00:00"}], "actions": [{"action": "light.turn_on"}, {"nothing": 1}]})["result"]
    assert v["triggers"] == {"valid": True, "error": None} and v["actions"]["valid"] is False and "Unable to determine action" in v["actions"]["error"]
    svcs = ws({"type": "get_services"})["result"]
    assert "scheduler" in svcs and "shell_command" in svcs and "reload" in svcs["automation"]
    assert ws({"type": "config/floor_registry/list"})["result"][0]["floor_id"] and ws({"type": "config/label_registry/list"})["result"][0]["label_id"]
    assert ws({"type": "config/category_registry/list", "scope": "automation"})["result"]
    assert ws({"type": "subscribe_events", "event_type": "automation_reloaded"})["success"] and "automation_reloaded" in fake.subscribed
    assert ws({"type": "nope"})["error"]["code"] == "unknown_command"


def test_traces_keep_five_runs_and_carry_secrets_only_in_variables(fake):
    cfg = fake.automations[0]
    for _ in range(8):
        fake.add_run("automation", cfg["id"], cfg, variables={"api_key": "test-key-not-real"})
    runs = fake.traces[("automation", cfg["id"])]
    assert len(runs) == 5 and all(r["trace"] for r in runs)
    assert runs[-1]["trace"]["action/0"][0]["changed_variables"] == {"api_key": "test-key-not-real"}  # the server (S1) must mask this before it leaves


def test_the_fake_round_trips_through_the_model_over_rest(fake):
    """A config read with GET, parsed, written back by the model and POSTed again is the same bytes: the invariant holds across the wire shape."""
    for a in fake.automations[:12]:
        status, got = fake.rest("GET", f"/api/config/automation/config/{a['id']}")
        read = m.config_to_draft("automation", got)
        if read.legacy:
            continue
        out = m.draft_to_config("automation", read.draft, got)
        assert fake.rest("POST", f"/api/config/automation/config/{a['id']}", out)[0] == 200
        assert json.dumps(fake.file_item("automation", a["id"]), ensure_ascii=False) == json.dumps(a, ensure_ascii=False)
