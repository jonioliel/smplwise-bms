"""CR-033 slices D6 (WisKey locks never get lock.lock; "lock all" skips them; scheduled lock jobs are listed as never
working) and D8 (the editor block `doors.editor_block`, enforced on the server on save; T25). Fakes only: the automations
fake world, the scheduler fake, the registry mirror. No Home Assistant, no WisKey, no door."""
from __future__ import annotations

import copy
import json
import uuid
from typing import Any

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, create_item, draft_of, get_item, item_by_name, put_item, svc_block
from conftest import as_user
from schedules_fixture import sched_app  # noqa: F401
from schedules_fixture import act, slot
from schedules_fixture import draft_of as sched_draft
from schedules_fixture import post_json, put_draft

from smplwise.db import now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.services import door_path_guard as guard

REFUSAL = "לא ניתן להוסיף כאן פתיחת דלת אינטרקום. פתיחה נעשית מכפתור הדלת או מתוכנית החזקה פתוחה."


def _wiskey(app, *entity_ids: str, platform: str = "hikvision_intercom", fake: Any = None) -> None:
    """Make lock entities WisKey locks in the registry mirror (and in the fake's registry, which every write re-syncs from)."""
    for row in getattr(fake, "registry", []) or []:
        if row.get("entity_id") in entity_ids:
            row["platform"] = platform
    with app.state.db.connection() as conn:
        for e in entity_ids:
            conn.execute("UPDATE ha_entities SET platform = ? WHERE entity_id = ?", (platform, e))


def _setting(app, value: str | None) -> None:
    with app.state.db.connection() as conn:
        if value is None:
            conn.execute("DELETE FROM settings WHERE key = ?", (guard.EDITOR_KEY,))
        else:
            set_setting(conn, guard.EDITOR_KEY, value)


def _tile(c, entity: str, action: str, user: str | None = None):
    body = {"allowed_action_id": action, "client_request_id": str(uuid.uuid4()), "expires_at": "2099-01-01T00:00:00Z", "confirmation_grant": "confirmed"}
    return c.post(f"{API}/ha/entities/{entity}/actions", json=body, headers=as_user(user) if user else {})


def _audit(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()
    return [dict(r) for r in rows]


def _opener(c) -> None:
    """The bootstrap administrator also holds the sensitive door.unlock grant (a custom role at the installation), so only the D8 guard can stop a door step."""
    from automations_fixture import role

    rid_ = role(c, "פותח דלתות " + uuid.uuid4().hex[:6], ["map.read"], ["door.unlock"])
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": rid_, "scope_type": "installation", "scope_id": "*"})
    assert r.status_code == 201, r.text


def _unlock_draft(entity: str = "lock.front_door", name: str = "פתיחה") -> dict[str, Any]:
    return draft_of(name, actions=[svc_block("lock.unlock", [entity])])


# ================================================================ D6

def test_d6_lock_lock_is_never_sent_to_a_wiskey_lock(autos_app):
    app, s, c, fake, tr = autos_app
    _wiskey(app, "lock.front_door", fake=fake)
    calls_before = len(fake.calls)
    r = _tile(c, "lock.front_door", "lock.lock")
    assert r.status_code == 409 and r.json()["code"] == "wiskey_lock_unsupported", r.text
    assert "לא רלוונטי" in r.json()["user_message"]
    assert len(fake.calls) == calls_before and not [x for x in tr.bridge_calls if x.get("op") == "execute"]
    rows = _audit(app, "ha.action")
    assert rows and rows[-1]["decision"] == "denied" and rows[-1]["reason"] == "wiskey_lock_unsupported"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE entity_id = 'lock.front_door'").fetchone()[0] == 0


def test_d6_an_ordinary_lock_still_takes_lock_lock(autos_app):
    app, s, c, fake, tr = autos_app
    r = _tile(c, "lock.front_door", "lock.lock")
    assert r.json().get("code") != "wiskey_lock_unsupported"


def test_d6_the_action_list_drops_lock_for_wiskey_locks_only(autos_app):
    app, s, c, fake, tr = autos_app
    before = [a["id"] for a in c.get(f"{API}/ha/entities/lock.front_door").json()["actions"]]
    assert "lock.lock" in before
    _wiskey(app, "lock.front_door", fake=fake)
    one = c.get(f"{API}/ha/entities/lock.front_door").json()
    assert one["wiskey_door"] is True and "lock.lock" not in [a["id"] for a in one["actions"]]
    listed = {e["entity_id"]: [a["id"] for a in e["actions"]] for e in c.get(f"{API}/ha/entities", params={"domain": "lock"}).json()["entities"]}
    assert "lock.lock" not in listed["lock.front_door"]


def test_d6_device_rows_mark_a_wiskey_door_for_lock_all(autos_app):
    app, s, c, fake, tr = autos_app
    items = lambda: [i for f in c.get(f"{API}/devices/items", params={"kind": "locks"}).json()["floors"] for a in f["areas"] for i in a["items"]]  # noqa: E731
    assert all(not i.get("wiskey_door") for i in items())
    _wiskey(app, "lock.front_door", platform="smplwise_intercom", fake=fake)
    rows = {i["entity_id"]: i for i in items()}
    assert rows["lock.front_door"]["wiskey_door"] is True


def test_d6_scheduled_lock_jobs_on_wiskey_locks_are_listed_as_never_working(sched_app):
    app, s, c, fake, tr = sched_app
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom' WHERE entity_id = 'lock.front_door'")
        item = {"name": "נעילת לילה", "slots": [{"start": "23:00:00", "actions": [{"service": "lock.lock", "entity_id": "lock.front_door"}]}]}
        other = {"name": "אור", "slots": [{"start": "23:00:00", "actions": [{"service": "light.turn_off", "entity_id": "light.x"}]}]}
        unlock = {"name": "פתיחה", "slots": [{"start": "07:00:00", "actions": [{"service": "lock.unlock", "entity_id": "lock.front_door"}]}]}
        for sid, it in (("jobA", item), ("jobB", other), ("jobC", unlock)):
            conn.execute("INSERT INTO schedule_cache(schedule_id, entity_id, revision, item_json, enabled, seen_at, changed_at) VALUES (?,?,?,?,1,?,?)",
                         (sid, f"switch.schedule_{sid}", "r1", json.dumps(it, ensure_ascii=False), now_iso(), now_iso()))
    got = c.get(f"{API}/doors/settings").json()
    assert [j["schedule_id"] for j in got["lock_jobs"]] == ["jobA"]
    assert got["lock_jobs"][0]["name"] == "נעילת לילה" and "לא יעבוד לעולם" in got["lock_jobs"][0]["note"]
    assert "lock.front_door" not in json.dumps(got["lock_jobs"], ensure_ascii=False), "alias only, no entity ids"


# ================================================================ D8: the setting

def test_d8_setting_defaults_to_blocked_and_is_admin_only_confirmed_and_audited(autos_app):
    app, s, c, fake, tr = autos_app
    got = c.get(f"{API}/doors/settings").json()
    assert got["editor_block"] == "blocked" and got["editor_allowed_available"] is False
    assert c.get(f"{API}/doors/settings", headers=as_user("nobody")).status_code == 403
    assert c.put(f"{API}/doors/settings", json={"editor_block": "blocked"}).json()["code"] == "confirmation_required"
    assert c.put(f"{API}/doors/settings", json={"confirmed": True}).status_code == 422
    r = c.put(f"{API}/doors/settings", json={"editor_block": "allowed", "confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "editor_allowed_unavailable" and "יתאפשר לאחר השלמת הסבת הפריטים" in r.json()["user_message"]
    assert c.put(f"{API}/doors/settings", json={"editor_block": "blocked", "confirmed": True}, headers=as_user("nobody")).status_code == 403
    assert c.get(f"{API}/doors/settings").json()["editor_block"] == "blocked"
    assert [a["decision"] for a in _audit(app, "settings.changed")] == ["denied"]


def test_d8_a_garbage_stored_value_reads_as_blocked(autos_app):
    app, s, c, fake, tr = autos_app
    _setting(app, "whatever")
    with app.state.db.connection(mode="read") as conn:
        assert guard.editor_mode(conn) == "blocked"
    _setting(app, "allowed")
    with app.state.db.connection(mode="read") as conn:
        assert guard.editor_mode(conn) == "allowed"


# ================================================================ D8: T25 automations, scripts, scenes, code mode

def test_t25_typed_builder_refuses_a_new_door_step_on_the_server(autos_app):
    app, s, c, fake, tr = autos_app
    _wiskey(app, "lock.front_door", fake=fake)
    r = create_item(c, "automation", _unlock_draft())
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked" and r.json()["user_message"] == REFUSAL
    assert r.json()["details"]["entities"] == ["lock.front_door"]
    assert not [x for x in tr.bridge_calls if x.get("op") == "upsert"]
    # a script too
    script = {"alias": "פתח", "description": "", "mode": "single", "max": None, "icon": None, "fields": [], "sequence": [svc_block("lock.unlock", ["lock.front_door"])]}
    r = create_item(c, "script", script)
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked"
    # other locks and other services are unaffected
    assert create_item(c, "automation", draft_of("אור")).status_code == 201


def test_t25_an_unresolvable_lock_target_is_refused_too(autos_app):
    app, s, c, fake, tr = autos_app
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE entity_id = 'lock.front_door'")
    r = create_item(c, "automation", _unlock_draft("lock.ghost"))
    assert r.status_code != 201 and not [x for x in tr.bridge_calls if x.get("op") == "upsert"], r.content.decode("utf-8")


def test_t25_the_block_follows_the_setting_and_a_non_wiskey_lock_is_never_blocked(autos_app):
    app, s, c, fake, tr = autos_app
    _opener(c)
    # an ordinary lock: allowed under the default
    r0 = create_item(c, "automation", _unlock_draft("lock.front_door", "רגיל")); assert r0.status_code == 201, r0.content.decode("utf-8")
    _wiskey(app, "lock.front_door", fake=fake)
    assert create_item(c, "automation", _unlock_draft("lock.front_door", "אינטרקום")).json()["code"] == "wiskey_door_step_blocked"
    _setting(app, "allowed")
    r0 = create_item(c, "automation", _unlock_draft("lock.front_door", "רגיל")); assert r0.status_code == 201, r0.content.decode("utf-8")
    _setting(app, "blocked")
    assert create_item(c, "automation", _unlock_draft("lock.front_door", "עוד")).json()["code"] == "wiskey_door_step_blocked"


def test_t25_existing_items_are_editable_and_a_door_step_may_be_removed_but_not_added(autos_app):
    app, s, c, fake, tr = autos_app
    _opener(c)
    r = create_item(c, "automation", _unlock_draft("lock.front_door", "קיימת"))
    assert r.status_code == 201, r.content.decode("utf-8")
    item = r.json()["item"]
    _wiskey(app, "lock.front_door", fake=fake)
    d = get_item(c, "automation", item["id"]).json()
    draft = copy.deepcopy(d["draft"])
    draft["description"] = "תיאור חדש"
    ok = put_item(c, "automation", item["id"], draft, d["revision"])
    assert ok.status_code == 200, ok.content.decode("utf-8")  # the existing door step stays: untouched
    d = get_item(c, "automation", item["id"]).json()
    draft = copy.deepcopy(d["draft"])
    draft["actions"].append(svc_block("lock.unlock", ["lock.front_door"], uid="n9"))
    bad = put_item(c, "automation", item["id"], draft, d["revision"])
    assert bad.status_code == 422 and bad.json()["code"] == "wiskey_door_step_blocked"  # a copy of the existing step is a new step
    draft = copy.deepcopy(d["draft"])
    draft["actions"] = [svc_block("light.turn_on", ["light.office"], {"brightness_pct": 10}, uid="n8")]
    assert put_item(c, "automation", item["id"], draft, d["revision"]).status_code == 200  # removal allowed
    d = get_item(c, "automation", item["id"]).json()
    draft = copy.deepcopy(d["draft"])
    draft["actions"].append(svc_block("lock.unlock", ["lock.front_door"], uid="n7"))
    r = put_item(c, "automation", item["id"], draft, d["revision"])
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked"


def test_t25_code_mode_refuses_a_new_door_step_and_a_wiskey_service_call(autos_app):
    app, s, c, fake, tr = autos_app
    r = create_item(c, "automation", draft_of("בסיס"))
    item = r.json()["item"]
    d = get_item(c, "automation", item["id"]).json()
    cfg = d["config"] if "config" in d else None
    if cfg is None:
        cfg = c.get(f"{API}/automations/automation/{item['id']}/code").json().get("config")
    assert cfg is not None
    _wiskey(app, "lock.front_door", fake=fake)
    for step in ({"action": "lock.unlock", "target": {"entity_id": "lock.front_door"}},
                 {"action": "smplwise_intercom.unlock_door", "data": {"entity_id": "lock.front_door"}},
                 {"action": "lock.open", "target": {"entity_id": "lock.front_door"}}):
        new = copy.deepcopy(cfg)
        new["actions"] = list(new["actions"]) + [step]
        r = c.put(f"{API}/automations/automation/{item['id']}/code", json={"config": new, "base_revision": d["revision"], "client_request_id": str(uuid.uuid4()), "confirm": True})
        assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked", (step, r.status_code, r.text)
    assert not [x for x in tr.bridge_calls if x.get("op") == "upsert" and x.get("profile") == "code" and "lock.front_door" in json.dumps(x.get("config"))]


def test_t25_scene_capture_and_scene_members_refuse_a_wiskey_lock(autos_app):
    app, s, c, fake, tr = autos_app
    _opener(c)
    _wiskey(app, "lock.front_door", fake=fake)
    r = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["lock.front_door", "light.office"]})
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked"
    ok = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["light.office"]})
    assert ok.status_code == 200
    scene = {"name": "סצנה", "icon": None, "members": [{"entity_id": "lock.front_door", "state": "unlocked", "attributes": {}}]}
    r = create_item(c, "scene", scene)
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked", r.text
    _setting(app, "allowed")
    rr = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["lock.front_door"]}); assert rr.status_code == 200, rr.content.decode("utf-8")


# ================================================================ D8: T25 schedules

def test_t25_guard_unit_existing_actions_stay_removal_allowed_a_copy_is_new(sched_app):
    app, s, c, fake, tr = sched_app
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'smplwise_intercom' WHERE entity_id = 'lock.front_door'")
    open_ = {"service": "lock.unlock", "entity_id": "lock.front_door"}
    other = {"service": "light.turn_off", "entity_id": "light.x"}
    old = {"slots": [{"actions": [open_]}]}
    with app.state.db.connection(mode="read") as conn:
        guard.check_schedule(conn, {"slots": [{"actions": [open_, other]}]}, old)  # the existing action stays
        guard.check_schedule(conn, {"slots": [{"actions": [other]}]}, old)  # removal
        for draft, before in (({"slots": [{"actions": [open_]}]}, None), ({"slots": [{"actions": [open_, open_]}]}, old)):
            try:
                guard.check_schedule(conn, draft, before)
                raise AssertionError("a new door action must be refused")
            except ApiError as exc:
                assert exc.code == "wiskey_door_step_blocked" and exc.user_message == REFUSAL


def test_t25_schedule_editor_refuses_a_new_door_action_on_the_server(sched_app):
    app, s, c, fake, tr = sched_app
    rid_ = c.post("/api/v1/access/roles", json={"name": "פותח " + uuid.uuid4().hex[:6], "permissions": ["map.read"], "sensitive": ["door.unlock"]}).json()["id"]
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": rid_, "scope_type": "installation", "scope_id": "*"}).status_code == 201

    def create(name: str, lock: str = "lock.front_door"):
        return post_json(c, "/schedules", {"draft": sched_draft(name, [slot("08:00:00", None, act("lock.unlock", lock))]), "enabled": True, "client_request_id": str(uuid.uuid4()), "confirm_lowering": True})

    ordinary = create("רגיל")
    assert ordinary.status_code == 201, ordinary.content.decode("utf-8")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom' WHERE entity_id = 'lock.front_door'")
    adds_before = len([x for x in getattr(tr, "calls", []) if x.get("op") == "add"])
    r = create("אינטרקום")
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked" and r.json()["user_message"] == REFUSAL, r.content.decode("utf-8")
    assert len([x for x in getattr(tr, "calls", []) if x.get("op") == "add"]) == adds_before
    with app.state.db.connection() as conn:
        set_setting(conn, guard.EDITOR_KEY, "allowed")
    assert create("מותר").status_code == 201
