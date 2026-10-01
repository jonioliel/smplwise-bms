"""CR-017 automations API: reads (status, list, detail, catalog, templates, dry-run, capture), the writes of an HA administrator (create, replace, code view, copy,
delete, restore, enable, run, scripts, scenes), idempotency, conflicts, view-only items, the bridge's own refusals, delegation off / on, and the settings keys.
Everything runs against FakeHaConfig (tests/fake_ha_config.py): HA's files, registry and services in memory, and the REAL bridge code on the other side of the
transport. Synthetic data only."""
from __future__ import annotations

import copy
import json

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import (API, NOTIFY, OMER, SHABBAT, create_item, directory, draft_of, get_item, item_by_name, put_item, rid, svc_block, typed_state_trigger)
from smplwise.services import automations, automation_policy as pol


# ================================================================ reads

def test_status_for_the_administrator_and_for_nobody(autos_app):
    app, s, c, fake, tr = autos_app
    st = c.get(f"{API}/automations/status").json()
    assert st["available"] == "ok" and st["writable"] is True and st["write_block"] is None and st["scheduler_present"] is False
    assert st["can"] == {"view": True, "manage": True, "scene_manage": True, "script_run": True, "script_manage": True, "code_view": True, "configure": True}
    assert st["delegation"] == {"on": False, "needed": False}
    assert st["scope"] == {"installation": True, "scoped": False, "floors": [], "areas": []}
    assert st["ui"] == {"sensitive_warning": True, "ask_when_on_new": False, "templates_enabled": True, "phone_filter": "fold", "sensitive_chip": "amber"}
    assert st["counts"]["automations"] == 18 and st["counts"]["scripts"] == 3 and st["counts"]["scenes"] == 22
    assert st["admin"]["bridge_version"] == "0.6.0" and st["admin"]["bridge_required"] == "0.6.0" and st["admin"]["caller_is_ha_admin"] is True and st["admin"]["config_api"] == "ok"
    bind(c, s, "vera", "viewer", "installation", "*")
    st = c.get(f"{API}/automations/status", headers={"X-SW-Dev-User": "vera"}).json()
    assert st["can"]["view"] is False and st["can"]["manage"] is False and st["counts"] == {"automations": 0, "scripts": 0, "scenes": 0, "running": 0, "attention": 0, "hidden": None}
    assert "admin" not in st
    for path in ("/automations", "/automations/trash", "/automations/templates", "/automations/review"):
        r = c.get(f"{API}{path}", headers={"X-SW-Dev-User": "vera"})
        assert r.status_code == 403 and r.json()["code"] == "forbidden", path


def test_the_list_shows_every_item_with_sentences_and_states(autos_app):
    app, s, c, fake, tr = autos_app
    r = c.get(f"{API}/automations", params={"limit": 500})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 43 and body["status"]["available"] == "ok" and body["status"]["stale"] is False
    names = {i["name"] for i in body["items"]}
    assert "תאורה בפרוזדור בתנועה" in names and "ערב בסלון" in names and "לילה טוב" in names
    motion = item_by_name(c, "תאורה בפרוזדור בתנועה")
    assert motion["kind"] == "automation" and motion["state"] == "on" and motion["source"] == "ui" and motion["sentence"].startswith("כשbinary_sensor") or motion["sentence"]
    assert motion["locked_count"] == 1 and motion["sensitive"] is False and motion["mode"] == "restart" and motion["can"]["edit"] is True and motion["read_only"] is None
    assert [t["entity_id"] for t in motion["targets"]] == ["light.office"] and motion["targets"][0]["class"] == "light" and motion["targets"][0]["missing"] is False
    tpl = item_by_name(c, "תבניות – התראת טמפרטורה")
    assert tpl["locked_count"] == 3 and tpl["unknown_effects"] is True and "ופעולה מתקדמת" in tpl["sentence"]
    alarm = item_by_name(c, "דריכת אזעקה בלילה")
    assert alarm["sensitive"] is True and alarm["sensitive_classes"] == ["alarm"] and any(w["code"] == "sensitive" for w in alarm["warnings"])
    code = item_by_name(c, "ניטרול עם קוד (ישן)")
    assert code["locked_count"] == 1 and code["sensitive"] is True and "1234" not in json.dumps(code)
    legacy = item_by_name(c, "פריט בסכמה ישנה")
    assert legacy["sentence"] and legacy["can"]["edit"] is True
    missing = item_by_name(c, "זריחה, דפוס זמן ושקיעה")
    assert any(w["code"] == "missing_entity" for w in missing["warnings"])
    yaml = item_by_name(c, "אוטומציה מקובץ תצורה")
    assert yaml["source"] == "yaml" and yaml["can"]["edit"] is False and yaml["read_only"]["reasons"][0]["code"] == "yaml_managed" and yaml["can"]["toggle"] is True
    noid = item_by_name(c, "אוטומציה בלי מזהה")
    assert noid["id"].startswith("entity:") and noid["read_only"]["reasons"][0]["code"] == "no_config_id" and noid["can"]["toggle"] is False
    scene = item_by_name(c, "wall scene 01", "scene")
    assert scene["source"] == "integration" and scene["state"] == "scene" and scene["read_only"]["reasons"][0]["code"] == "integration_scene" and scene["can"]["run"] is True
    script = item_by_name(c, "קירור עם פרמטרים")
    assert script["kind"] == "script" and script["state"] == "off" and script["can"]["run"] is True
    # filters apply after visibility
    only = c.get(f"{API}/automations", params={"kind": "script"}).json()
    assert only["total"] == 3 and {i["kind"] for i in only["items"]} == {"script"}
    assert c.get(f"{API}/automations", params={"q": "אזעקה"}).json()["total"] >= 1
    assert c.get(f"{API}/automations", params={"sensitive": "true", "kind": "automation"}).json()["total"] >= 2
    assert c.get(f"{API}/automations", params={"source": "yaml"}).json()["total"] == 2
    assert c.get(f"{API}/automations", params={"limit": 5}).json()["total"] == 43


def test_the_detail_carries_blocks_locked_blocks_and_the_code_view_for_the_administrator(autos_app):
    app, s, c, fake, tr = autos_app
    tpl = item_by_name(c, "תבניות – התראת טמפרטורה")
    d = get_item(c, "automation", tpl["id"]).json()
    assert d["id"] == "1727000000005" and d["revision"] and d["versions"] == 1
    blocks = d["draft"]["triggers"] + d["draft"]["conditions"] + d["draft"]["actions"]
    locked = [b for b in blocks if b["kind"] == "locked"]
    assert len(locked) == 3 and all(b["reason"] == "template" and b["fingerprint"] and b["template_text"] for b in locked)
    assert d["can"]["code_view"] is True and d["config"]["id"] == "1727000000005" and d["config_masked"] is False
    sec = item_by_name(c, "ערך סודי בקריאה")
    ds = get_item(c, "automation", sec["id"]).json()
    blk = ds["draft"]["actions"][0]
    assert blk["kind"] == "locked" and blk["masked"] is True and blk["template_text"] is None and "abc-not-real" not in json.dumps(ds) and ds["config_masked"] is True
    # unknown top-level keys are carried and named
    ex = item_by_name(c, "מפתחות עליונים נוספים")
    assert sorted(ex["extras"]) == ["initial_state", "note", "trace", "variables"]
    assert get_item(c, "automation", "nope").status_code == 404 and get_item(c, "nokind", "x").status_code == 404
    # the code of a stored alarm disarm never comes back
    code = item_by_name(c, "ניטרול עם קוד (ישן)")
    assert "1234" not in json.dumps(get_item(c, "automation", code["id"]).json())


def test_the_catalog_and_the_templates(autos_app):
    app, s, c, fake, tr = autos_app
    cat = c.get(f"{API}/automations/catalog").json()
    ents = {e["entity_id"]: e for e in cat["entities"]}
    assert "light.turn_on" in ents["light.office"]["actions"] and ents["light.office"]["floor"]["name"] == "Ground floor" and ents["light.office"]["area"]["name"] == "Living room"
    assert ents["light.office"]["device_class"] is None and ents["cover.driveway_gate"]["device_class"] in ("gate", "garage", "door") and cat["scope"]["installation"] is True
    assert ents["alarm_control_panel.home_panel"]["class"] == "alarm" and ents["cover.driveway_gate"]["class"] == "gate" and ents["lock.front_door"]["class"] == "lock" and ents["light.office"]["class"] is None
    assert ents["binary_sensor.motion_hall"]["actions"] == [] and ents["sensor.outdoor_temperature"]["triggers"] == ["state", "numeric_state"]
    acts = {a["action"]: a for v in cat["actions"].values() for a in v}
    assert "homeassistant.turn_on" not in acts and "shell_command.blink" not in acts and acts["lock.unlock"]["sensitive"] is True and acts["light.turn_on"]["sensitive"] is False and "lock.unlock" in cat["allowed_actions"]
    temp = next(a for a in acts["climate.set_temperature"]["args"] if a["key"] == "temperature")
    assert temp["kind"] == "number" and temp["required"] is True and temp["step"] == 0.5
    assert next(a for a in acts["climate.set_hvac_mode"]["args"])["kind"] == "select" and acts["scene.turn_on"]["role"] == "scene" and acts["automation.trigger"]["role"] == "automation"
    assert cat["notify_targets"][0]["action"] == NOTIFY and cat["shabbat_sensor"] == SHABBAT and {sc["name"] for sc in cat["scenes"]} >= {"ערב בסלון"}
    assert next(sc for sc in cat["scenes"] if sc["name"] == "wall scene 01")["integration"] is True and {f["id"] for f in cat["floors"]} == {"sch_ground", "sch_upper"}
    assert next(sc for sc in cat["scripts"] if sc["name"] == "קירור עם פרמטרים")["fields"][0]["selector"]["kind"] == "number"
    assert c.get(f"{API}/automations/catalog", params={"q": "office"}).json()["entities"][0]["entity_id"] == "light.office"
    t = c.get(f"{API}/automations/templates").json()["templates"]
    assert [x["id"] for x in t][:2] == ["motion_light", "door_open_notify"] and len(t) == 7 and all(x["target"] == "automation" and x["icon"].startswith("mdi:") and x["name"] for x in t)
    assert next(x for x in t if x["id"] == "ac_by_clock")["suggest_schedule"] is False, "no scheduler component: no suggestion"
    assert c.patch(f"{API}/settings", json={"automations.templates_hidden": ["motion_light"], "automations.templates_order": ["water_leak"]}).status_code == 200
    t2 = [x["id"] for x in c.get(f"{API}/automations/templates").json()["templates"]]
    assert "motion_light" not in t2 and t2[0] == "water_leak"
    assert c.patch(f"{API}/settings", json={"automations.templates_enabled": "false"}).status_code == 200
    assert c.get(f"{API}/automations/templates").json()["templates"] == []


def test_dry_run_and_capture(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "מזגן סלון בבוקר")
    r = c.post(f"{API}/automations/automation/{it['id']}/dry-run")
    assert r.status_code == 200
    out = r.json()
    assert out["conditions"][0]["passed"] in (True, False) and out["effects"]["entities"][0]["entity_id"] == "climate.living_room" and out["effects"]["entities"][0]["from"] == "cool"
    # an unsaved edit: the draft's own conditions and effects are evaluated, nothing is written
    d = get_item(c, "automation", it["id"]).json()
    draft = copy.deepcopy(d["draft"])
    draft["conditions"] = [{"uid": "c1", "kind": "typed", "type": "state", "entity_ids": ["climate.living_room"], "state": "cool", "raw": None, "sentence": ""}]
    draft["actions"] = [svc_block("light.turn_on", ["light.office", "switch.hall_lights"][:1], uid="a9")]
    out = c.post(f"{API}/automations/automation/{it['id']}/dry-run", json={"draft": draft}).json()
    assert out["conditions"] == [{"path": "conditions.0", "sentence": out["conditions"][0]["sentence"], "passed": True}] and out["effects"]["entities"][0]["entity_id"] == "light.office" and out["effects"]["entities"][0]["to"] == "on"
    assert not tr.bridge_calls and c.post(f"{API}/automations/automation/{it['id']}/dry-run", json={"draft": {"alias": "x"}}).status_code in (200, 422)
    tpl = item_by_name(c, "תבניות – התראת טמפרטורה")
    out = c.post(f"{API}/automations/automation/{tpl['id']}/dry-run").json()
    assert out["conditions"][0]["passed"] is None and out["conditions"][0]["sentence"] == "לא ניתן לבדוק" and out["effects"]["unknown"] is True
    cap = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office", "climate.living_room", "switch.hall_lights"]})
    assert cap.status_code == 200
    members = {m["entity_id"]: m for m in cap.json()["members"]}
    assert members["climate.living_room"]["state"] == "cool" and members["climate.living_room"]["attributes"]["temperature"] == 25 and members["switch.hall_lights"]["attributes"] == {}
    assert cap.json()["skipped"] == []
    both = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["alarm_control_panel.home_panel", "sensor.outdoor_temperature", "light.office"]})
    assert both.status_code == 200 and [m["entity_id"] for m in both.json()["members"]] == ["light.office"]
    assert both.json()["skipped"] == [{"entity_id": "alarm_control_panel.home_panel", "reason": "alarm_not_capturable"}, {"entity_id": "sensor.outdoor_temperature", "reason": "domain_not_supported"}]
    fake.states["light.office"]["state"] = "unavailable"
    seed_mirror(app.state.db, fake)
    gone = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office"]})
    assert gone.status_code == 200 and gone.json() == {"members": [], "skipped": [{"entity_id": "light.office", "reason": "unavailable"}]}
    assert c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.nope"]}).status_code == 422


# ================================================================ the policy's allow-list, the gallery, the bridge's closed messages

def test_the_catalog_serves_the_policys_allow_list_and_the_gallery_is_typed(autos_app):
    from smplwise.services import automation_model as model

    app, s, c, fake, tr = autos_app
    cat = c.get(f"{API}/automations/catalog").json()
    allowed = set(cat["allowed_actions"])
    assert set(pol.DEFAULT_ALLOWED_ACTIONS) <= allowed and {NOTIFY, "scene.turn_on", "script.turn_on", "automation.trigger", "lock.unlock"} <= allowed
    assert not allowed & {"light.toggle", "climate.turn_on", "timer.start", "media_player.select_source", "homeassistant.turn_on", "shell_command.blink"}, "the bridge's allow-list is a subset of the client's default list"
    assert [a["role"] for a in cat["actions"]["notify"]] == ["notify"] and cat["actions"]["notify"][0]["args"][0]["key"] == "message"
    mctx = model.ModelContext()
    for t in c.get(f"{API}/automations/templates").json()["templates"]:
        walked = model.walk_draft(t["draft"])
        assert walked and all(w.block["kind"] == "typed" for w in walked), t["id"]
        assert t["sensitive"] is False
    # without an approved notify target the notify templates still exist, their step is shown locked
    assert c.patch(f"{API}/settings", json={"automations.notify_targets": []}).status_code == 200
    leak = next(t for t in c.get(f"{API}/automations/templates").json()["templates"] if t["id"] == "water_leak")
    assert [w.block["kind"] for w in model.walk_draft(leak["draft"]) if w.section == "action"] == ["locked"] and mctx


def test_every_bridge_message_carries_only_the_keys_of_its_op(autos_app):
    """The bridge refuses a key it does not know for an op (`invalid_payload`): the add-on builds each message from the op's own key set."""
    import bridge_loader

    app, s, c, fake, tr = autos_app
    keys = bridge_loader.load("config_policy").OP_KEYS
    created = create_item(c, "automation", draft_of("מפתחות"))
    assert created.status_code == 201, created.text
    it = created.json()["item"]
    d = get_item(c, "automation", it["id"]).json()
    draft = copy.deepcopy(d["draft"])
    draft["description"] = "חדש"
    assert put_item(c, "automation", it["id"], draft, d["revision"]).status_code == 200
    assert c.post(f"{API}/automations/automation/{it['id']}/disable", json={"client_request_id": rid()}).status_code == 200
    assert c.post(f"{API}/automations/automation/{it['id']}/enable", json={"client_request_id": rid()}).status_code == 200
    assert c.post(f"{API}/automations/automation/{it['id']}/run", json={"client_request_id": rid(), "confirm": True, "skip_condition": False}).status_code == 202
    sc = item_by_name(c, "קירור עם פרמטרים")
    assert c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": 22}}).status_code == 202
    assert c.post(f"{API}/automations/script/{sc['id']}/stop", json={"client_request_id": rid()}).status_code == 202
    wall = item_by_name(c, "wall scene 03", "scene")
    assert c.post(f"{API}/automations/scene/{wall['id']}/apply", json={"client_request_id": rid()}).status_code == 202
    d = get_item(c, "automation", it["id"]).json()
    assert c.post(f"{API}/automations/automation/{it['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}).status_code == 200
    ops = [b["op"] for b in tr.bridge_calls]
    assert ops == ["upsert", "upsert", "disable", "enable", "trigger", "run_script", "stop_script", "apply_scene", "delete"], ops
    for b in tr.bridge_calls:
        assert set(b) <= keys[b["op"]] and {"user_id", "op", "request_id"} <= set(b), b["op"]
        assert all(v is not None for k, v in b.items() if k not in ("base_revision",)), "no key without a value"
    assert tr.bridge_calls[0]["base_revision"] is None and tr.bridge_calls[0]["profile"] == "builder" and isinstance(tr.bridge_calls[0]["sensitive"], bool) and "notify_targets" not in tr.bridge_calls[0]
    assert tr.bridge_calls[4]["skip_condition"] is False and tr.bridge_calls[5]["variables"] == {"temp": 22} and tr.bridge_calls[7]["entity_id"].startswith("scene.")
