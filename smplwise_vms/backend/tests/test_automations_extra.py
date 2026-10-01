"""CR-017 smaller behaviours of the automations API: the trash setting, a restore whose id is taken, create disabled, replay of updates and runs, purge rights, the review list,
an invalid item, and who sees which kinds."""
from __future__ import annotations

import copy
import datetime as dt

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, create_item, draft_of, get_item, item_by_name, put_item, rid
from smplwise.routers.access import SENSITIVE
from smplwise.services import automations
from fake_ha_config import seed_mirror


def _del(c, d):
    r = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200, r.text
    return r.json()


def _g(c, user, name, perms, scope_type, scope_id):
    both = list(perms)
    return grant(c, user, name, [p for p in both if p not in SENSITIVE], [p for p in both if p in SENSITIVE], scope_type, scope_id)


def test_the_trash_period_is_a_setting(autos_app):
    app, s, c, fake, tr = autos_app
    assert c.patch(f"{API}/settings", json={"automations.trash_days": 7}).status_code == 200
    out = _del(c, get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json())
    assert out["expires_at"] == (fake.now_dt + dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_a_restore_whose_id_is_taken_gets_a_new_id_and_says_so(autos_app):
    app, s, c, fake, tr = autos_app
    d = get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json()
    tid = _del(c, d)["trash_id"]
    fake.files["automation"].append({"id": d["id"], "alias": "תופס את המזהה", "triggers": [{"trigger": "time", "at": "02:00:00"}], "conditions": [], "actions": [{"delay": {"seconds": 1}}], "mode": "single"})
    fake.reload("automation", d["id"])
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    r = c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()})
    assert r.status_code == 201, r.text
    assert r.json()["id_changed"] is True and r.json()["restored_id"] != d["id"] and r.json()["item"]["name"] == "מזגן סלון בבוקר"
    assert item_by_name(c, "תופס את המזהה")["id"] == d["id"], "the item that took the id is untouched"


def test_create_disabled_and_the_op_sequence(autos_app):
    app, s, c, fake, tr = autos_app
    r = create_item(c, "automation", draft_of("כבויה מההתחלה"), enabled=False)
    assert r.status_code == 201 and r.json()["item"]["state"] == "off"
    assert [b["op"] for b in fake.bridge_calls] == ["upsert", "disable"]


def test_update_and_run_replays_answer_as_the_first_request_and_send_nothing_twice(autos_app):
    app, s, c, fake, tr = autos_app
    d = get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json()
    draft = copy.deepcopy(d["draft"])
    draft["description"] = "חדש"
    key = rid()
    body = {"draft": draft, "base_revision": d["revision"], "client_request_id": key}
    r1 = c.put(f"{API}/automations/automation/{d['id']}", json=body)
    r2 = c.put(f"{API}/automations/automation/{d['id']}", json=body)
    assert r1.status_code == r2.status_code == 200 and len([b for b in fake.bridge_calls if b["op"] == "upsert"]) == 1 and r2.json()["item"]["revision"] == r1.json()["item"]["revision"]
    assert c.post(f"{API}/automations/automation/{d['id']}/disable", json={"client_request_id": key}).status_code == 409, "the same key for another operation"
    rk = rid()
    a = c.post(f"{API}/automations/automation/{d['id']}/run", json={"client_request_id": rk, "confirm": True})
    b = c.post(f"{API}/automations/automation/{d['id']}/run", json={"client_request_id": rk, "confirm": True})
    assert a.status_code == b.status_code == 202 and len([x for x in fake.calls if x["service"] == "trigger"]) == 1


def test_purge_is_for_installation_wide_managers_and_trash_is_scoped(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    place(c, ids["floor2"], "climate.living_room", "light.office")
    _g(c, "omer", "מנהל קומה", ["automation.view", "devices.read", "entity.state.read", "devices.control", "automation.manage"], "floor", ids["floor2"])
    tid = _del(c, get_item(c, "automation", item_by_name(c, "מזגן סלון בבוקר")["id"]).json())["trash_id"]
    other = _del(c, get_item(c, "automation", item_by_name(c, "כבוי כשאף אחד לא בבית")["id"]).json())["trash_id"]
    seen = [t["trash_id"] for t in c.get(f"{API}/automations/trash", headers=OMER).json()["items"]]
    assert seen == [tid], "an item the caller may not see is not in their trash"
    r = c.post(f"{API}/automations/trash/{tid}/purge", json={"confirm": True}, headers=OMER)
    assert r.status_code == 403
    assert c.post(f"{API}/automations/trash/{other}/restore", json={"client_request_id": rid()}, headers=OMER).status_code == 404
    assert c.post(f"{API}/automations/trash/{tid}/purge", json={"confirm": True}).status_code == 200


def test_the_review_list_names_invalid_missing_and_masked_items(autos_app):
    app, s, c, fake, tr = autos_app
    c.get(f"{API}/automations")
    eid = item_by_name(c, "מזגן סלון בבוקר")["entity_id"]
    fake.states[eid]["state"] = "unavailable"
    seed_mirror(app.state.db, fake)
    it = item_by_name(c, "מזגן סלון בבוקר")
    assert it["state"] == "invalid" and any(w["code"] == "invalid_config" and w["message"] == "לא פעילה – שגיאה בהגדרה" for w in it["warnings"])
    rows = c.get(f"{API}/automations/review").json()["items"]
    issues = {(r["issue"], r["name"]) for r in rows}
    assert ("invalid", "מזגן סלון בבוקר") in issues and ("missing_entity", "זריחה, דפוס זמן ושקיעה") in issues and ("masked_values", "ערך סודי בקריאה") in issues
    assert all(set(r) >= {"kind", "id", "name", "issue", "detail", "at"} for r in rows)
    assert c.get(f"{API}/automations/status").json()["counts"]["attention"] >= 2


def test_who_sees_which_kind_and_integration_scenes_follow_control(autos_app):
    app, s, c, fake, tr = autos_app
    ids = seed_tree(c)
    _g(c, "omer", "מפעיל סקריפטים", ["script.run", "devices.read", "entity.state.read"], "installation", "*")
    st = c.get(f"{API}/automations/status", headers=OMER).json()
    assert st["can"]["view"] is True and st["can"]["script_run"] is True and st["can"]["manage"] is False
    got = c.get(f"{API}/automations", params={"limit": 500}, headers=OMER).json()["items"]
    assert {i["kind"] for i in got} == {"script"} and len(got) == 2, "the alarm script needs alarm.view too"
    assert c.get(f"{API}/automations", params={"kind": "automation"}, headers=OMER).json()["total"] == 0
    _g(c, "vera", "שליטה", ["ha.entity.control", "devices.read", "entity.state.read"], "installation", "*")
    vera = {"X-SW-Dev-User": "vera"}
    scenes = c.get(f"{API}/automations", params={"kind": "scene", "limit": 500}, headers=vera).json()["items"]
    assert len([i for i in scenes if i["source"] == "integration"]) == 20 and all(i["can"]["run"] for i in scenes if i["source"] == "integration")
    wall = next(i for i in scenes if i["name"] == "wall scene 02")
    assert c.post(f"{API}/automations/scene/{wall['id']}/apply", json={"client_request_id": rid()}, headers=vera).status_code == 202
    assert c.post(f"{API}/automations/scene/{wall['id']}/apply", json={"client_request_id": rid()}, headers=OMER).status_code == 403, "script.run alone does not reach a scene entity"


def test_hidden_integration_scenes_leave_the_lists_of_people_who_cannot_manage_them(autos_app):
    app, s, c, fake, tr = autos_app
    wall = item_by_name(c, "wall scene 04", "scene")
    assert c.put(f"{API}/automations/scene/{wall['id']}/meta", json={"hidden": True}).json()["hidden"] is True
    assert item_by_name(c, "wall scene 04", "scene")["hidden"] is True, "an administrator still sees it, marked"
    _g(c, "vera", "שליטה", ["ha.entity.control", "devices.read", "entity.state.read"], "installation", "*")
    names = {i["name"] for i in c.get(f"{API}/automations", params={"kind": "scene", "limit": 500}, headers={"X-SW-Dev-User": "vera"}).json()["items"]}
    assert "wall scene 04" not in names and "wall scene 05" in names
