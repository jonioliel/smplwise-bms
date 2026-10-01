"""CR-017 security review of integ/auto (findings F1-F6 and the lows): a sensitive step needs the manual-control grant wherever it hides - inside a locked block,
inside a script / scene / automation that is called; content whose effects cannot be known and the removal of such a block are for installation-wide managers; a dry run
and a trace never describe a device outside the caller's reach; a restore comes back disabled; the audit of an outside change cannot be switched off by an unrelated op;
the size of a body is capped. """
from __future__ import annotations

import copy
import json

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import NOTIFY, API, OMER, create_item, draft_of, get_item, item_by_name, place, put_item, rid, svc_block, typed_state_trigger
from automations_fixture import grant as _raw_grant
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from smplwise.services import automations

READ = ["devices.read", "entity.state.read"]
VIEW = ["automation.view", "script.run"] + READ
EDIT = ["automation.manage", "scene.manage", "script.manage"]
ENTITIES = ("light.office", "climate.living_room", "switch.hall_lights", "binary_sensor.motion_hall", "lock.front_door", "alarm_control_panel.home_panel", "alarm_control_panel.shed_panel")


def grant(c, user, name, permissions, scope_type, scope_id):
    both = list(dict.fromkeys(permissions))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], scope_type, scope_id)


def world(c, tr, *, extra=()):
    """omer: a floor-2 editor with entity control and the alarm view, delegation on - and NOT the grants of manual control (alarm.arm, alarm.disarm, door.unlock)."""
    from automations_fixture import directory, seed_tree

    ids = seed_tree(c)
    place(c, ids["floor2"], *ENTITIES)
    grant(c, "omer", "עורך קומה", VIEW + ["devices.control", "ha.entity.control", "alarm.view"] + EDIT + list(extra), "floor", ids["floor2"])
    tr.delegated = True
    directory(c, tr.secret, delegated=True, changed_at="2026-10-01T09:00:00Z")
    return ids


def add_automation(app, c, fake, cfg):
    fake.automations.append(cfg)
    fake.reload_automation(cfg["id"])
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    return cfg["id"]


def add_script(app, c, fake, key, cfg):
    fake.scripts[key] = cfg
    fake._seed_script_entity(key, cfg)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")


def run(c, kind, item_id, headers=None, **body):
    return c.post(f"{API}/automations/{kind}/{item_id}/run", json={"client_request_id": rid(), "confirm": True, **body}, headers=headers or {})


# ================================================================ F1: a sensitive step inside a LOCKED block

def test_f1_a_locked_sensitive_step_needs_the_grant_to_save_run_and_enable(autos_app):
    app, s, c, fake, tr = autos_app
    ids = world(c, tr)
    unlock = {"action": "lock.unlock", "target": {"entity_id": ["lock.front_door"]}, "continue_on_error": True}  # a disabled-step style block: locked, its target is literal
    add_automation(app, c, fake, {"id": "9301", "alias": "פתיחה נעולה", "description": "", "mode": "single", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on"}],
                                  "conditions": [], "actions": [unlock, {"action": "light.turn_on", "target": {"entity_id": ["light.office"]}}]})
    d = get_item(c, "automation", "9301", OMER).json()
    assert d["draft"]["actions"][0]["kind"] == "locked" and d["sensitive"] is True and d["can"]["edit"] is False
    assert any(r["code"] == "grant_required" and r["entity_id"] == "lock.front_door" for r in d["read_only"]["reasons"])
    draft = copy.deepcopy(d["draft"])
    draft["triggers"][0]["entity_ids"] = ["binary_sensor.motion_hall"]
    draft["alias"] = "שונה"
    r = put_item(c, "automation", "9301", draft, d["revision"], OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "door.unlock"
    assert run(c, "automation", "9301", OMER).status_code == 403
    assert c.post(f"{API}/automations/automation/9301/enable", json={"client_request_id": rid(), "confirm": True}, headers=OMER).status_code == 403
    assert not [b for b in tr.bridge_calls if b["op"] in ("upsert", "trigger", "enable")]
    grant(c, "omer", "פתיחת דלתות", ["door.unlock"], "floor", ids["floor2"])
    assert run(c, "automation", "9301", OMER).status_code == 202, "with the grant of manual control the same call is allowed"


def test_f1_a_stored_disarm_with_a_code_is_not_runnable_without_alarm_disarm(autos_app):
    app, s, c, fake, tr = autos_app
    ids = world(c, tr)
    it = item_by_name(c, "ניטרול עם קוד (ישן)", headers=OMER)
    assert run(c, "automation", it["id"], OMER).json()["code"] == "grant_required"
    assert c.post(f"{API}/automations/automation/{it['id']}/enable", json={"client_request_id": rid(), "confirm": True}, headers=OMER).json()["code"] == "grant_required"
    grant(c, "omer", "נטרול", ["alarm.disarm"], "floor", ids["floor2"])
    assert run(c, "automation", it["id"], OMER).status_code == 202


# ================================================================ F2: a sensitive step inside what is CALLED

def test_f2_calling_a_script_scene_or_automation_with_a_sensitive_step_needs_the_grant(autos_app):
    app, s, c, fake, tr = autos_app
    ids = world(c, tr)
    script = item_by_name(c, "לילה טוב")  # arms home_panel
    direct = create_item(c, "automation", draft_of("ישיר", actions=[svc_block("alarm_control_panel.alarm_arm_night", ["alarm_control_panel.home_panel"])]), OMER, confirm=True)
    assert direct.status_code == 403 and direct.json()["code"] == "grant_required"
    via = create_item(c, "automation", draft_of("דרך סקריפט", actions=[svc_block("script.turn_on", [script["entity_id"]], role_="script")]), OMER, confirm=True)
    assert via.status_code == 403 and via.json()["code"] == "grant_required" and via.json()["details"]["grant"] == "alarm.arm", via.text
    # a scene with a lock member (made outside: the administrator's own role does not hold door.unlock either)
    sc_cfg = {"id": "9401", "name": "סצנת נעילה", "entities": {"lock.front_door": {"state": "unlocked"}}}
    fake.scenes.append(sc_cfg)
    scene_entity = fake._unique_entity("scene", "scene_9401")
    fake._seed_scene_entity(scene_entity, "9401", sc_cfg)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    scene = {"entity_id": scene_entity}
    r = create_item(c, "automation", draft_of("דרך סצנה", actions=[svc_block("scene.turn_on", [scene["entity_id"]], role_="scene")]), OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "door.unlock", r.text
    # another automation that disarms
    other = item_by_name(c, "ניטרול עם קוד (ישן)")
    r = create_item(c, "automation", draft_of("מפעיל אחרת", actions=[svc_block("light.turn_on", ["light.office"], uid="n7"), svc_block("automation.trigger", [other["entity_id"]], role_="automation")]), OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "alarm.disarm", r.text
    grant(c, "omer", "דריכה", ["alarm.arm", "alarm.disarm", "door.unlock"], "floor", ids["floor2"])
    for body in (draft_of("דרך סקריפט", actions=[svc_block("script.turn_on", [script["entity_id"]], role_="script")]),
                 draft_of("דרך סצנה", actions=[svc_block("scene.turn_on", [scene["entity_id"]], role_="scene")])):
        ok = create_item(c, "automation", body, OMER, confirm=True)
        assert ok.status_code == 201 and ok.json()["item"]["sensitive"] is True, ok.text
    assert not [b for b in tr.bridge_calls if b["op"] == "upsert" and b["user_id"] == "dev-omer" and b["config"]["alias"] == "ישיר"]


# ================================================================ F3: removing a locked block of unknown effects

def test_f3_deleting_an_item_with_unknown_effects_is_for_installation_wide_managers(autos_app):
    app, s, c, fake, tr = autos_app
    world(c, tr)
    d = get_item(c, "automation", item_by_name(c, "תבניות – התראת טמפרטורה")["id"], OMER).json()
    r = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}).status_code == 200


def test_f3_taking_a_locked_block_out_of_its_if_is_a_change_of_place(autos_app):
    app, s, c, fake, tr = autos_app
    world(c, tr)
    tmpl = {"action": "light.turn_on", "target": {"entity_id": "{{ 'light.office' }}"}}
    add_automation(app, c, fake, {"id": "9302", "alias": "מוגן בתנאי", "description": "", "mode": "single", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on"}],
                                  "conditions": [], "actions": [{"action": "light.turn_off", "target": {"entity_id": ["light.office"]}},
                                                                {"if": [{"condition": "state", "entity_id": ["light.office"], "state": "on"}], "then": [tmpl]}]})
    d = get_item(c, "automation", "9302", OMER).json()
    draft = copy.deepcopy(d["draft"])
    keep = copy.deepcopy(draft)
    keep["alias"] = "אותו מקום"
    assert put_item(c, "automation", "9302", keep, d["revision"], OMER, confirm=True).status_code == 200, "an edit around it, the block where it was"
    d = get_item(c, "automation", "9302", OMER).json()
    draft = copy.deepcopy(d["draft"])
    locked = draft["actions"][1]["then"][0]
    assert locked["kind"] == "locked"
    draft["actions"] = [draft["actions"][0], locked]  # the `if` is gone, the template runs unguarded at the top level
    r = put_item(c, "automation", "9302", draft, d["revision"], OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
    assert put_item(c, "automation", "9302", draft, d["revision"], confirm=True).status_code == 200, "an installation-wide manager may"


def test_f3_the_wide_manage_of_the_items_own_kind_decides(autos_app):
    app, s, c, fake, tr = autos_app
    ids = world(c, tr)
    grant(c, "omer", "ניהול אוטומציות בכל מקום", ["automation.view", "automation.manage"] + READ, "installation", "*")
    add_script(app, c, fake, "unk", {"alias": "בלי יעד ידוע", "mode": "single", "sequence": [{"action": "light.turn_on", "target": {"entity_id": "{{ x }}"}},
                                                                                               {"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}]})
    d = get_item(c, "script", "unk", OMER).json()
    r = c.post(f"{API}/automations/script/unk/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403, "wide automation.manage is not wide script.manage"
    assert ids


# ================================================================ F4: content of unknown effects, written by a caller who is not installation-wide

def test_f4_a_scoped_editor_cannot_add_unknown_effects_by_calling_a_script_that_became_unknown(autos_app):
    app, s, c, fake, tr = autos_app
    world(c, tr)
    cfg = {"alias": "סקריפט חיצוני", "mode": "single", "sequence": [{"action": "light.turn_on", "target": {"entity_id": ["light.office"]}}]}
    add_script(app, c, fake, "ext", cfg)
    call = draft_of("קורא לסקריפט", actions=[svc_block("script.turn_on", ["script.ext"], role_="script")])
    assert create_item(c, "automation", call, OMER, confirm=True).status_code == 201
    fake.scripts["ext"] = {**cfg, "sequence": [{"action": "shell_command.run_it"}]}  # someone changed it in Home Assistant
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    r = create_item(c, "automation", draft_of("קורא לסקריפט אחרי", actions=[svc_block("script.turn_on", ["script.ext"], role_="script")]), OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
    assert create_item(c, "automation", draft_of("קורא לסקריפט אחרי", actions=[svc_block("script.turn_on", ["script.ext"], role_="script")]), confirm=True).status_code == 201


def test_f4_keeping_unknown_effects_that_are_already_there_is_still_allowed(autos_app):
    app, s, c, fake, tr = autos_app
    world(c, tr)
    d = get_item(c, "automation", item_by_name(c, "תבניות – התראת טמפרטורה")["id"], OMER).json()
    draft = copy.deepcopy(d["draft"])
    draft["alias"] = "שם אחר"
    assert put_item(c, "automation", d["id"], draft, d["revision"], OMER, confirm=True).status_code == 200


# ================================================================ F6: a dry run and a trace stay inside the caller's reach

def test_f6_the_dry_run_gives_no_verdict_about_a_device_the_caller_cannot_read(autos_app):
    app, s, c, fake, tr = autos_app
    ids = world(c, tr)
    from automations_fixture import seed_tree  # noqa: F401

    # the panel is placed on the floor above in this test: not in reach of omer's floor-2 role
    add_automation(app, c, fake, {"id": "9303", "alias": "תנאי על אזעקה", "description": "", "mode": "single", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on"}],
                                  "conditions": [{"condition": "state", "entity_id": ["sensor.outdoor_temperature"], "state": "5"}],
                                  "actions": [{"action": "light.turn_on", "target": {"entity_id": ["light.office"]}}]})
    out = c.post(f"{API}/automations/automation/9303/dry-run", headers=OMER)
    assert out.status_code == 200, out.text
    assert out.json()["conditions"][0]["passed"] is None, "outdoor_temperature is not in omer's reach: neither true nor false"
    assert c.post(f"{API}/automations/automation/9303/dry-run").json()["conditions"][0]["passed"] is False, "the administrator sees the verdict"
    assert "disarmed" not in out.text and ids


# ================================================================ lows

def test_low_a_masked_item_is_read_only_with_its_reason(autos_app):
    app, s, c, fake, tr = autos_app
    it = item_by_name(c, "ערך סודי בקריאה")
    d = get_item(c, "automation", it["id"]).json()
    assert d["can"]["edit"] is False and d["read_only"]["reasons"][0]["code"] == "masked_values" and d["can"]["delete"] is True


def test_low_b_a_restored_item_comes_back_disabled_and_needs_the_confirmation_of_a_create(autos_app):
    app, s, c, fake, tr = autos_app
    d = get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json()
    tid = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}).json()["trash_id"]
    r = c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()})
    assert r.status_code == 201 and r.json()["item"]["state"] == "off", "it runs only when someone turns it on"
    assert [b["op"] for b in tr.bridge_calls][-2:] == ["upsert", "disable"]
    t = get_item(c, "automation", item_by_name(c, "תבניות – התראת טמפרטורה")["id"]).json()
    tid = c.post(f"{API}/automations/automation/{t['id']}/delete", json={"base_revision": t["revision"], "confirm": True, "client_request_id": rid()}).json()["trash_id"]
    r = c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", "unknown effects are confirmed, as for a create"
    assert c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid(), "confirm": True}).status_code == 201


def test_low_c_an_unrelated_arx_op_does_not_switch_off_the_audit_of_an_outside_change(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")  # the baseline pull
    assert create_item(c, "automation", draft_of("יצירה של Arx")).status_code == 201  # a create op inside the window
    add_automation(app, c, fake, {"id": "9304", "alias": "רגישה מבחוץ", "description": "", "mode": "single", "triggers": [{"trigger": "time", "at": "01:00:00"}], "conditions": [],
                                  "actions": [{"action": "alarm_control_panel.alarm_arm_night", "target": {"entity_id": ["alarm_control_panel.home_panel"]}}]})
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT resource_id FROM audit_log WHERE action = 'automation.changed_outside'").fetchall()
    assert [r[0] for r in rows] == ["automation:9304"]
    # Arx's own update of an item is not an outside change; a later one made outside is - even inside the window of the first
    d = get_item(c, "automation", "9304").json()
    draft = copy.deepcopy(d["draft"])
    draft["description"] = "מ־Arx"
    assert put_item(c, "automation", "9304", draft, d["revision"], confirm=True).status_code == 200
    next(a for a in fake.automations if a["id"] == "9304")["description"] = "מבחוץ שוב"
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection() as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'automation.changed_outside' AND resource_id = 'automation:9304'").fetchone()[0]
    assert n == 2


def test_low_d_a_trace_does_not_leak_the_state_of_devices_outside_the_reach_or_url_tokens(autos_app):
    app, s, c, fake, tr = autos_app
    world(c, tr)
    it = item_by_name(c, "תאורה בפרוזדור בתנועה")
    run_ = fake.add_run("automation", it["id"], next(a for a in fake.automations if str(a["id"]) == it["id"]))
    trig = run_["trace"]["trigger/0"][0]["changed_variables"]["trigger"]
    trig["to_state"] = {"entity_id": "alarm_control_panel.shed_panel", "state": "armed_away", "attributes": {"friendly_name": "Shed alarm", "code_format": "number"}}
    trig["from_state"] = {"entity_id": "binary_sensor.motion_hall", "state": "off", "attributes": {"entity_picture": "/api/camera_proxy/camera.x?token=abc123", "device_class": "motion",
                                                                                                     "snapshot_url": "http://h/snap?access_token=SECRETVALUE&w=1"}}
    # omer may read the motion sensor, not the shed panel (the panel is placed, but his role lacks nothing on it - so take it away from the reach)
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM map_anchors WHERE resource_id = 'alarm_control_panel.shed_panel'")
    omer = c.get(f"{API}/automations/automation/{it['id']}/runs/{run_['run_id']}", headers=OMER).json()
    text = json.dumps(omer, ensure_ascii=False)
    assert "armed_away" not in text and "code_format" not in text and "abc123" not in text and "SECRETVALUE" not in text and "entity_picture" not in text
    assert omer["variables"]["trigger"]["to_state"] == {"entity_id": "alarm_control_panel.shed_panel"}
    assert omer["variables"]["trigger"]["from_state"]["attributes"]["device_class"] == "motion", "what the caller may read stays"
    admin = json.dumps(c.get(f"{API}/automations/automation/{it['id']}/runs/{run_['run_id']}").json(), ensure_ascii=False)
    assert "abc123" not in admin and "SECRETVALUE" not in admin and "entity_picture" not in admin


def test_low_f_the_size_and_depth_of_a_body_are_capped(autos_app):
    app, s, c, fake, tr = autos_app
    big = {"kind": "automation", "draft": draft_of("x"), "pad": "a" * (300 * 1024)}
    r = c.post(f"{API}/automations/preview", json=big)
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large"
    deep: dict = {}
    cur = deep
    for _ in range(60):
        cur["k"] = {}
        cur = cur["k"]
    r = c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": deep})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    assert c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": draft_of("x")}).status_code == 200


# ================================================================ the bridge's new fields (S2 a03cfe1e)

def test_the_approved_notify_targets_and_the_scene_sensitive_flag_travel_to_the_bridge(autos_app):
    app, s, c, fake, tr = autos_app
    assert create_item(c, "automation", draft_of("עם יעד התראה", actions=[svc_block(NOTIFY, [], {"message": "שלום"}, role_="notify")])).status_code == 201
    assert tr.bridge_calls[-1]["allowed_notify"] == [NOTIFY]
    plain = c.post(f"{API}/automations/scene", json={"draft": {"name": "אור", "icon": None, "members": [{"entity_id": "light.office", "state": "on", "attributes": {}}]}, "client_request_id": rid()})
    assert plain.status_code == 201 and tr.bridge_calls[-1]["sensitive"] is False
    gate = c.post(f"{API}/automations/scene", json={"draft": {"name": "שער", "icon": None, "members": [{"entity_id": "cover.driveway_gate", "state": "closed", "attributes": {}}]},
                                                    "client_request_id": rid()})
    assert gate.status_code == 201, gate.text
    assert tr.bridge_calls[-1]["sensitive"] is True, "a scene that reproduces a door-class cover is sent as sensitive"


def test_a_delegated_user_is_not_offered_the_delete_of_content_only_an_administrator_could_write(autos_app):
    app, s, c, fake, tr = autos_app
    world(c, tr)
    tpl = get_item(c, "automation", item_by_name(c, "תבניות – התראת טמפרטורה")["id"], OMER).json()
    assert tpl["can"]["delete"] is False
    plain = create_item(c, "automation", draft_of("פשוטה למחיקה"), OMER)
    assert plain.status_code == 201 and plain.json()["item"]["can"]["delete"] is True
