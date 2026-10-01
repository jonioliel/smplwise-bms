"""CR-017 permissions, scope and delegation (docs/architecture/AUTOMATIONS_API.md §3.2, CR §7-§9): visibility by TARGET entities (an invisible item is absent everywhere),
floor-scoped editing that needs every target in scope plus control, the SAME grants manual control needs for a sensitive step (owner decision 6ג), the delegation switch
for HA non-administrators (off by default; builder content only; the code profile always needs an HA administrator), the code-view roles, and the run rights.
Roles are custom roles bound with a scope (the documented family recipe: `automation.view` + `script.run`; the editor adds sensitive `automation.manage` + `scene.manage`)."""
from __future__ import annotations

import copy

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import (API, OMER, create_item, directory, draft_of, get_item, item_by_name, place, put_item, rid, svc_block, typed_state_trigger)
from automations_fixture import grant as _raw_grant
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from smplwise.services import automations


def grant(c, user, name, permissions, sensitive, scope_type, scope_id):
    """The documented recipe: a custom role names its sensitive permissions apart from the others."""
    both = list(dict.fromkeys(list(permissions) + list(sensitive)))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], scope_type, scope_id)

READ = ["devices.read", "entity.state.read"]
VIEW = ["automation.view", "script.run"] + READ
EDIT_SENS = ["automation.manage", "scene.manage", "script.manage"]


def _names(c, headers=None, **q):
    r = c.get(f"{API}/automations", params={"limit": 500, **q}, headers=headers or {})
    assert r.status_code == 200, r.text
    return sorted(i["name"] for i in r.json()["items"])


def _scoped_world(c):
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "climate.living_room", "switch.hall_lights", "binary_sensor.motion_hall")
    return ids


def _delegate(c, secret, fake, on: bool) -> None:
    fake.options["delegated_authoring"] = on
    directory(c, secret, delegated=on, changed_at="2026-10-01T09:00:00Z" if on else None)


# ================================================================ permissions registered

def test_the_six_permissions_and_their_default_roles():
    import json
    from pathlib import Path

    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    names = {"automation.view", "automation.manage", "scene.manage", "script.run", "script.manage", "automation.code_view"}
    assert all(n in PERMISSION_LABELS for n in names) and PERMISSION_LABELS["script.run"] == "הפעלת סקריפטים"
    expect = {"viewer": set(), "editor": set(), "kiosk": set(), "operator": set(), "site_admin": names, "system_admin": names}
    for role_id, perms in expect.items():
        assert {p for p in ROLES[role_id] if p in names} == perms, role_id
    assert {"automation.manage", "scene.manage", "script.manage", "automation.code_view"} <= set(SENSITIVE) and not ({"automation.view", "script.run"} & set(SENSITIVE))
    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for r in contract["roles"]:
        assert {p for p in r["permissions"] if p in names} == expect[r["id"]], r["id"]
    assert {"automation.manage", "scene.manage", "script.manage", "automation.code_view"} <= set(contract["sensitive_permissions_not_implied"])


# ================================================================ visibility

def test_visibility_is_decided_by_target_entities_and_an_invisible_item_is_absent_everywhere(autos_app):
    app, s, c, fake, tr = autos_app
    _scoped_world(c)
    with app.state.db.connection() as conn:
        floor_id = conn.execute("SELECT id FROM floors WHERE name = 'קומה 2'").fetchone()[0]
    grant(c, "omer", "צופה באוטומציות", VIEW, [], "floor", floor_id)
    got = _names(c, OMER)
    assert got == sorted(["תאורה בפרוזדור בתנועה", "מזגן סלון בבוקר", "מפסק מעבדה – הדלקה וכיבוי", "תבניות – התראת טמפרטורה", "כפתור קיר – תרחיש", "פריט בסכמה ישנה", "טריגר ייעודי", "אוטומציה מקובץ תצורה",
                          "התראה לטלפון", "שלבים מתקדמים", "מפתחות עליונים נוספים", "קירור עם פרמטרים", "ערב בסלון"])
    hidden = item_by_name(c, "כבוי כשאף אחד לא בבית")  # climate.bedroom_1 / 2 are not on this floor
    assert get_item(c, "automation", hidden["id"], OMER).status_code == 404
    for path in ("runs", "versions"):
        assert c.get(f"{API}/automations/automation/{hidden['id']}/{path}", headers=OMER).status_code == 404
    assert c.post(f"{API}/automations/automation/{hidden['id']}/dry-run", headers=OMER).status_code == 404
    assert c.post(f"{API}/automations/automation/{hidden['id']}/run", json={"client_request_id": rid(), "confirm": True}, headers=OMER).status_code in (403, 404)
    st = c.get(f"{API}/automations/status", headers=OMER).json()
    assert st["counts"] == {"automations": 11, "scripts": 1, "scenes": 1, "running": 0, "attention": st["counts"]["attention"], "hidden": None}
    adm = c.get(f"{API}/automations/status").json()
    assert adm["counts"]["hidden"] == 0 and adm["counts"]["automations"] == 18
    assert c.get(f"{API}/automations/review", headers=OMER).status_code == 403
    assert "alarm_control_panel.home_panel" not in str(c.get(f"{API}/automations/catalog", headers=OMER).status_code)  # no manage anywhere: the catalog is 403
    # an item with only locked / unknown targets is for installation-wide viewers
    assert "שירותים מיוחדים" not in _names(c, OMER) and "שירותים מיוחדים" in _names(c)
    # integration scenes are for installation-wide viewers or whoever controls the scene entity
    assert not any(n.startswith("wall scene") for n in _names(c, OMER, kind="scene"))


def test_a_scoped_viewer_sees_locked_blocks_and_no_raw_content(autos_app):
    app, s, c, fake, tr = autos_app
    _scoped_world(c)
    with app.state.db.connection() as conn:
        floor_id = conn.execute("SELECT id FROM floors WHERE name = 'קומה 2'").fetchone()[0]
    grant(c, "omer", "צופה באוטומציות", VIEW, [], "floor", floor_id)
    tpl = item_by_name(c, "תבניות – התראת טמפרטורה", headers=OMER)
    d = get_item(c, "automation", tpl["id"], OMER).json()
    assert d["can"]["code_view"] is False and d["config"] is None and d["can"]["edit"] is False and d["read_only"]["reasons"]
    locked = [b for b in d["draft"]["triggers"] + d["draft"]["conditions"] + d["draft"]["actions"] if b["kind"] == "locked"]
    assert locked and all(b["raw"] is None and b["template_text"] is None and b["label"] for b in locked)
    assert "value_template" not in str(d["draft"]) and "is_state" not in str(d)
    # a trigger entity outside the caller's reach never hides the item; it is shown locked
    pump = item_by_name(c, "מפסק מעבדה – הדלקה וכיבוי", headers=OMER)
    dp = get_item(c, "automation", pump["id"], OMER).json()
    assert [b["kind"] for b in dp["draft"]["triggers"]] == ["locked", "locked"] and dp["draft"]["triggers"][0]["label"] == "מחוץ להרשאה" and dp["draft"]["triggers"][0]["sentence"]


# ================================================================ writes of a household editor

def _editor(c, floor_id, extra=None, user="omer", name="עורך אוטומציות"):
    return grant(c, user, name, VIEW + ["devices.control"] + EDIT_SENS + (extra or []), EDIT_SENS + [p for p in (extra or []) if p == "automation.code_view"], "floor", floor_id)


def test_a_non_ha_admin_cannot_save_until_the_delegation_switch_is_on_and_then_only_builder_content(autos_app):
    app, s, c, fake, tr = autos_app
    _scoped_world(c)
    with app.state.db.connection() as conn:
        floor_id = conn.execute("SELECT id FROM floors WHERE name = 'קומה 2'").fetchone()[0]
    _editor(c, floor_id)
    secret = fake.secret
    st = c.get(f"{API}/automations/status", headers=OMER).json()
    assert st["delegation"] == {"on": False, "needed": True} and st["writable"] is False and st["write_block"] == "delegation_off" and st["can"]["manage"] is True
    one = item_by_name(c, "תאורה בפרוזדור בתנועה", headers=OMER)
    d = get_item(c, "automation", one["id"], OMER).json()
    assert d["can"]["edit"] is False and d["read_only"]["reasons"][0]["code"] == "delegation_off" and d["can"]["toggle"] is True and d["can"]["run"] is True
    r = create_item(c, "automation", draft_of("מהבית"), OMER)
    assert r.status_code == 403 and r.json()["code"] == "delegation_off" and r.json()["user_message"] == "שמירה עבור משתמש זה אינה מופעלת. פנו למנהל המערכת."
    assert not [b for b in fake.bridge_calls if b["op"] == "upsert"]
    # view, run and enable / disable work without the switch
    assert c.post(f"{API}/automations/automation/{one['id']}/disable", json={"client_request_id": rid()}, headers=OMER).status_code == 200
    assert fake.calls[-1]["user_id"] == "dev-omer" and fake.calls[-1]["service"] == "turn_off"
    # the switch goes on INSIDE Home Assistant (the bridge's options); the add-on only reads it
    _delegate(c, secret, fake, True)
    st = c.get(f"{API}/automations/status", headers=OMER).json()
    assert st["delegation"] == {"on": True, "needed": True} and st["writable"] is True and "admin" not in st
    admin_st = c.get(f"{API}/automations/status").json()
    assert admin_st["admin"]["delegation_changed_at"] == "2026-10-01T09:00:00Z" and admin_st["admin"]["caller_is_ha_admin"] is True and admin_st["delegation"] == {"on": True, "needed": False}
    r = create_item(c, "automation", draft_of("מהבית", actions=[svc_block("light.turn_on", ["light.office"])]), OMER)
    assert r.status_code == 201, r.text
    call = [b for b in fake.bridge_calls if b["op"] == "upsert"][-1]
    assert call["user_id"] == "dev-omer" and call["profile"] == "builder"
    with app.state.db.connection() as conn:
        a = conn.execute("SELECT details_json FROM audit_log WHERE action = 'automation.create' AND decision = 'allowed' AND actor_user_id = 'dev-omer'").fetchone()
        assert '"delegated": true' in a[0]
    review = c.get(f"{API}/automations/review").json()["items"]
    assert any(x["issue"] == "delegated_write" for x in review)
    # a target outside the floor
    r = create_item(c, "automation", draft_of("מחוץ לקומה", actions=[svc_block("climate.turn_off", ["climate.bedroom_1"])]), OMER)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    # builder content only: a new locked block is refused, and the code view needs an HA administrator
    tpl_d = get_item(c, "automation", item_by_name(c, "תבניות – התראת טמפרטורה", headers=OMER)["id"], OMER).json()
    draft = copy.deepcopy(tpl_d["draft"])
    draft["alias"] = "שמות"
    assert put_item(c, "automation", tpl_d["id"], draft, tpl_d["revision"], OMER, confirm=True).status_code == 200, "keeping, editing around and moving locked blocks is allowed"
    draft = copy.deepcopy(get_item(c, "automation", tpl_d["id"], OMER).json()["draft"])
    draft["actions"].append({"uid": "z", "kind": "locked", "fingerprint": "aaaaaaaaaaaaaaaa", "reason": "template", "label": "", "sensitive": False, "effects": "unknown", "masked": False, "raw": None, "sentence": ""})
    r = put_item(c, "automation", tpl_d["id"], draft, get_item(c, "automation", tpl_d["id"], OMER).json()["revision"], OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "locked_block_changed"
    code_try = c.put(f"{API}/automations/automation/{tpl_d['id']}/code", json={"config": {"alias": "x"}, "base_revision": "x" * 8, "client_request_id": rid()}, headers=OMER)
    assert code_try.status_code == 403 and code_try.json()["code"] == "code_view_required"


def test_the_code_view_is_a_permission_and_a_role_list_and_a_non_admin_code_profile_save_is_refused(autos_app):
    app, s, c, fake, tr = autos_app
    _scoped_world(c)
    with app.state.db.connection() as conn:
        floor_id = conn.execute("SELECT id FROM floors WHERE name = 'קומה 2'").fetchone()[0]
    role_id = _editor(c, floor_id, extra=["automation.code_view"])
    _delegate(c, fake.secret, fake, True)
    one = item_by_name(c, "מזגן סלון בבוקר", headers=OMER)
    d = get_item(c, "automation", one["id"], OMER).json()
    assert d["can"]["code_view"] is False and d["config"] is None, "the role is not in automations.code_view_roles"
    assert c.patch(f"{API}/settings", json={"automations.code_view_roles": ["site_admin", "system_admin", role_id]}).status_code == 200
    d = get_item(c, "automation", one["id"], OMER).json()
    assert d["can"]["code_view"] is True and d["config"]["id"] == one["id"] and c.get(f"{API}/automations/status", headers=OMER).json()["can"]["code_view"] is True
    cfg = copy.deepcopy(d["config"])
    cfg["conditions"].append({"condition": "template", "value_template": "{{ true }}"})
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "not_ha_admin" and not [b for b in fake.bridge_calls if b["op"] == "upsert"]
    cfg = copy.deepcopy(d["config"])
    cfg["actions"][0]["data"]["temperature"] = 23
    r = c.put(f"{API}/automations/automation/{d['id']}/code", json={"config": cfg, "base_revision": d["revision"], "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 200 and fake.bridge_calls[-1]["profile"] == "builder", "typed edits made in the code view are a builder save: delegation applies"


# ================================================================ sensitive steps = the manual-control grants

def test_a_sensitive_step_needs_the_same_grant_manual_control_needs(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "alarm_control_panel.home_panel", "lock.front_door", "cover.driveway_gate", "light.office")
    grant(c, "omer", "עורך", VIEW + ["devices.control", "ha.entity.control", "alarm.view"] + EDIT_SENS, EDIT_SENS, "floor", ids["floor2"])
    _delegate(c, fake.secret, fake, True)

    def attempt(block):
        return create_item(c, "automation", draft_of("רגיש", actions=[block]), OMER, confirm=True)

    r = attempt(svc_block("alarm_control_panel.alarm_arm_away", ["alarm_control_panel.home_panel"]))
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "alarm.arm" and "דריכת אזעקה" in r.json()["user_message"]
    r = attempt(svc_block("alarm_control_panel.alarm_disarm", ["alarm_control_panel.home_panel"]))
    assert r.status_code == 403 and r.json()["details"]["grant"] == "alarm.disarm"
    r = attempt(svc_block("lock.unlock", ["lock.front_door"]))
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "door.unlock"
    assert attempt(svc_block("lock.lock", ["lock.front_door"])).status_code == 201, "locking needs control only"
    # sensitive options of the preview name the grant and whether the caller holds it
    pv = c.post(f"{API}/automations/preview", json={"kind": "automation", "draft": draft_of("x", actions=[svc_block("alarm_control_panel.alarm_arm_away", ["alarm_control_panel.home_panel"])])}, headers=OMER).json()
    assert pv["sensitive"] is True and pv["sensitive_steps"] == [{"path": "action/0", "entity_id": "alarm_control_panel.home_panel", "action": "alarm_control_panel.alarm_arm_away", "grant": "alarm.arm", "granted": False}]
    # the grants given: manual control's own permissions
    grant(c, "omer", "דריכה ופתיחה", ["alarm.arm", "alarm.disarm", "door.unlock"], ["alarm.disarm", "door.unlock"], "floor", ids["floor2"])
    assert attempt(svc_block("alarm_control_panel.alarm_arm_away", ["alarm_control_panel.home_panel"])).status_code == 201
    assert attempt(svc_block("alarm_control_panel.alarm_disarm", ["alarm_control_panel.home_panel"])).status_code == 201
    r = attempt(svc_block("lock.unlock", ["lock.front_door"]))
    assert r.status_code == 201 and r.json()["item"]["sensitive"] is True and r.json()["item"]["sensitive_classes"] == ["lock"]
    assert any(c_["op"] == "upsert" and c_["sensitive"] is True for c_ in fake.bridge_calls)


def test_a_door_cover_is_not_reached_by_devices_control_alone(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "cover.driveway_gate", "light.office")
    grant(c, "omer", "עורך", VIEW + ["devices.control"] + EDIT_SENS, EDIT_SENS, "floor", ids["floor2"])
    _delegate(c, fake.secret, fake, True)
    r = create_item(c, "automation", draft_of("שער", actions=[svc_block("cover.open_cover", ["cover.driveway_gate"])]), OMER)
    assert r.status_code == 403 and r.json()["code"] == "entity_not_controllable"
    grant(c, "omer", "שליטה בשער", ["ha.entity.control"], [], "floor", ids["floor2"])
    r = create_item(c, "automation", draft_of("שער", actions=[svc_block("cover.open_cover", ["cover.driveway_gate"])]), OMER)
    assert r.status_code == 201 and r.json()["item"]["sensitive_classes"] == ["gate"] or r.json()["item"]["sensitive_classes"] == ["door"]


def test_a_stored_item_with_a_sensitive_step_cannot_be_edited_without_the_grant(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "alarm_control_panel.home_panel", "binary_sensor.motion_hall")
    grant(c, "omer", "עורך", VIEW + ["devices.control", "alarm.view"] + EDIT_SENS, EDIT_SENS, "floor", ids["floor2"])
    _delegate(c, fake.secret, fake, True)
    it = item_by_name(c, "דריכת אזעקה בלילה", headers=OMER)
    d = get_item(c, "automation", it["id"], OMER).json()
    assert d["can"]["edit"] is False and any(r["code"] == "grant_required" for r in d["read_only"]["reasons"]) and d["can"]["run"] is False
    draft = copy.deepcopy(d["draft"])
    draft["alias"] = "ניסיון"
    r = put_item(c, "automation", d["id"], draft, d["revision"], OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required"
    r = c.post(f"{API}/automations/automation/{d['id']}/run", json={"client_request_id": rid(), "confirm": True}, headers=OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required"


# ================================================================ run rights

def test_script_run_and_scene_activation_follow_control_of_the_effects(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "climate.living_room", "light.office", "switch.hall_lights")
    grant(c, "omer", "בן בית", VIEW + ["devices.control"], [], "floor", ids["floor2"])
    sc = item_by_name(c, "קירור עם פרמטרים", headers=OMER)
    r = c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": 22}}, headers=OMER)
    assert r.status_code == 202 and fake.calls[-1]["user_id"] == "dev-omer"
    native = item_by_name(c, "ערב בסלון", headers=OMER)
    assert c.post(f"{API}/automations/scene/{native['id']}/apply", json={"client_request_id": rid()}, headers=OMER).status_code == 202
    # no automation.manage: no run, no enable, no create
    one = item_by_name(c, "תאורה בפרוזדור בתנועה", headers=OMER)
    assert one["can"]["run"] is False and one["can"]["toggle"] is False
    assert c.post(f"{API}/automations/automation/{one['id']}/run", json={"client_request_id": rid(), "confirm": True}, headers=OMER).status_code == 403
    assert create_item(c, "automation", draft_of("x"), OMER).status_code == 403
    assert c.post(f"{API}/automations/scene", json={"draft": {"name": "x", "icon": None, "members": []}, "client_request_id": rid()}, headers=OMER).status_code == 403
    # without devices.control the script cannot be run
    ids2 = ids
    grant(c, "vera", "צופה בלי שליטה", VIEW, [], "floor", ids2["floor2"])
    r = c.post(f"{API}/automations/script/{sc['id']}/run", json={"client_request_id": rid(), "fields": {"temp": 22}}, headers={"X-SW-Dev-User": "vera"})
    assert r.status_code == 403 and r.json()["code"] == "entity_not_controllable"


def test_a_scene_capture_needs_scene_manage_and_control(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "climate.living_room")
    grant(c, "omer", "סצנות", VIEW + ["devices.control", "scene.manage"], ["scene.manage"], "floor", ids["floor2"])
    r = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office"]}, headers=OMER)
    assert r.status_code == 200 and r.json()["members"][0]["entity_id"] == "light.office"
    r = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["switch.hall_lights"]}, headers=OMER)
    assert r.status_code == 422, "an entity the caller cannot read is unknown to them"
    assert c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office"]}, headers={"X-SW-Dev-User": "vera"}).status_code == 403


def test_hiding_an_integration_scene_and_personal_pins(autos_app):
    app, s, c, fake, tr = autos_app
    wall = item_by_name(c, "wall scene 07", "scene")
    r = c.put(f"{API}/automations/scene/{wall['id']}/meta", json={"hidden": True, "pinned": True})
    assert r.status_code == 200 and r.json()["hidden"] is True and r.json()["pinned"] is True
    assert any(n == "wall scene 07" for n in _names(c, kind="scene")), "an administrator still sees it"
    one = item_by_name(c, "מזגן סלון בבוקר")
    assert c.put(f"{API}/automations/automation/{one['id']}/meta", json={"hidden": True}).status_code == 403
    assert c.put(f"{API}/automations/automation/{one['id']}/meta", json={"favourite": True}).json()["favourite"] is True
    assert item_by_name(c, "מזגן סלון בבוקר", headers=None)["favourite"] is True
