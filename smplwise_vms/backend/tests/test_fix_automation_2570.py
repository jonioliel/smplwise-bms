"""FIX-AUTOMATION-2570 (docs/changes/FIX-AUTOMATION-2570.md): the second deep review's automation / schedule findings
(docs/review/DEEP-REVIEW-2570-CORE-DATA-RELEASE.md on review/DEEP2-2570-CORE-DATA-RELEASE).

- CD2-02: a scene holding an alarm panel (or a lock, a siren, a door-class cover) is applied only with what the member's own manual
  action needs - the grant (alarm.disarm for a disarm), the explicit confirmation (`confirm: true` on the scenes route, the device
  route's own `confirmation_grant`) and the step-up proof of a disarm - on BOTH routes that activate a scene.
- CD2-04: a copied or restored automation is written disabled; a self-triggering copy is written in single-run mode.
- CD2-05: an op left `pending` is settled `unknown` by the janitor and stops silencing the "changed outside" audit.
- CD2-07: the Home Assistant trace calls of the runs routes never hold the write lock.
- CD2-11 / CD2-16 / CD2-19: schedule copy / restore warn on a failed disable; folders without a position and a scoped manager's
  folder removal; a refused run-now does not block the next one."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3

import pytest

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, item_by_name, place, rid, seed_mirror, seed_tree
from automations_fixture import grant as _raw_grant
from schedules_fixture import post_json, sched_app  # noqa: F401
from schedules_fixture import grant as _sched_grant
from smplwise.errors import ApiError
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from smplwise.services import automation_ops, automations, ha_client, ha_bridge, schedule_ops, schedules, step_up
from support.waiting import soon

NIGHT = "Night lobby"


def grant(c, user, name, permissions, scope_type, scope_id):
    both = list(dict.fromkeys(permissions))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], scope_type, scope_id)


def _scene(app, fake, name, entities, cid="1790000000101"):
    """A scene made in Home Assistant (scenes.yaml) - the Arx editor never captures a panel, so this is the path CD2-02 is about."""
    cfg = {"id": cid, "name": name, "entities": entities}
    fake.scenes.append(cfg)
    eid = fake._unique_entity("scene", name.lower().replace(" ", "_"))
    fake._seed_scene_entity(eid, cid, cfg)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    return eid


def _night(app, fake):
    return _scene(app, fake, NIGHT, {"light.office": "on", "alarm_control_panel.home_panel": "disarmed"})


def _apply(c, item_id, headers=None, **body):
    return c.post(f"{API}/automations/scene/{item_id}/apply", json={"client_request_id": rid(), **body}, headers=headers or {})


def _denials(app, action, reason):
    with app.state.db.connection(mode="read") as conn:
        return conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND reason = ?", (action, reason)).fetchone()[0]


# ================================================================ CD2-02 - the scenes route

def test_cd2_02_a_scene_with_an_alarm_panel_is_sensitive_and_asks_the_confirmation(autos_app):
    app, s, c, fake, tr = autos_app
    _night(app, fake)
    it = item_by_name(c, NIGHT, "scene")
    assert it["sensitive"] is True and it["sensitive_classes"] == ["alarm"]
    r = _apply(c, it["id"])
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text  # the scripts path's contract, unchanged
    assert _denials(app, "automation.run", "confirmation_required") >= 1
    r = _apply(c, it["id"], confirm=True)
    assert r.status_code == 202, r.text


def test_cd2_02_applying_a_disarming_scene_needs_the_disarm_grant(autos_app):
    app, s, c, fake, tr = autos_app
    _night(app, fake)
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "alarm_control_panel.home_panel")
    grant(c, "omer", "בן בית", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "alarm.view", "alarm.arm"], "floor", ids["floor2"])
    it = item_by_name(c, NIGHT, "scene", headers=OMER)
    r = _apply(c, it["id"], OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required", r.text
    assert r.json()["details"]["grant"] == "alarm.disarm" and r.json()["details"]["entity_id"] == "alarm_control_panel.home_panel"
    assert _denials(app, "automation.run", "grant_required") >= 1
    assert not any(x.get("op") == "apply_scene" for x in tr.bridge_calls), "nothing was sent"
    # the same grant manual control asks for makes it allowed (with the confirmation)
    grant(c, "omer", "נטרול", ["alarm.disarm"], "floor", ids["floor2"])
    assert _apply(c, it["id"], OMER).json()["code"] == "confirmation_required"
    assert _apply(c, it["id"], OMER, confirm=True).status_code == 202


def test_cd2_02_an_arming_scene_needs_the_arm_grant_not_the_disarm_one(autos_app):
    app, s, c, fake, tr = autos_app
    _scene(app, fake, "Away", {"light.office": "off", "alarm_control_panel.home_panel": {"state": "armed_away"}})
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "alarm_control_panel.home_panel")
    grant(c, "omer", "בן בית", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "alarm.view"], "floor", ids["floor2"])
    it = item_by_name(c, "Away", "scene", headers=OMER)
    r = _apply(c, it["id"], OMER, confirm=True)
    assert r.status_code == 403 and r.json()["details"]["grant"] == "alarm.arm"
    grant(c, "omer", "דריכה", ["alarm.arm"], "floor", ids["floor2"])
    assert _apply(c, it["id"], OMER, confirm=True).status_code == 202


def test_cd2_02_a_disarming_scene_asks_the_step_up_proof_of_a_disarm(autos_app, monkeypatch):
    app, s, c, fake, tr = autos_app
    _night(app, fake)
    asked: list[str] = []

    def guard_action(conn, request, principal, action):
        asked.append(action)
        raise ApiError(403, "step_up_required", "x", details={"action": action})

    monkeypatch.setattr(step_up, "guard_action", guard_action)
    it = item_by_name(c, NIGHT, "scene")
    r = _apply(c, it["id"], confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["alarm.disarm"]
    assert not any(x.get("op") == "apply_scene" for x in tr.bridge_calls)
    asked.clear()
    plain = item_by_name(c, "ערב בסלון", "scene")  # lights only: no step-up, no confirmation
    assert _apply(c, plain["id"]).status_code == 202 and asked == []


def test_cd2_02_a_scheduled_scene_with_a_panel_asks_the_disarm_grant_too(autos_app):
    """The schedules judge a scene through the same rules (schedule_view.item_run_reasons -> run_reasons)."""
    app, s, c, fake, tr = autos_app
    eid = _night(app, fake)
    from smplwise.services import automation_scope as ascope
    from smplwise.rbac import Principal

    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "alarm_control_panel.home_panel", eid)
    grant(c, "omer", "בן בית", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "alarm.view", "alarm.arm"], "floor", ids["floor2"])
    with app.state.db.connection(mode="read") as conn:
        steps, reasons = ascope.scene_member_reasons(conn, Principal(user_id="dev-omer", username="omer", display_name="omer", source="dev"), eid)
    assert [s_["action"] for s_ in steps] == ["alarm_control_panel.alarm_disarm"]
    assert [(r["code"], r.get("grant")) for r in reasons] == [("grant_required", "alarm.disarm")]


# ================================================================ CD2-02 - the device-control route (`scene.turn_on` on a tile)

@pytest.fixture()
def executed(autos_app, monkeypatch):
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        return {"ok": True, "context_id": "ctx"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    return calls


def _turn_on(c, eid, headers=None, **kw):
    body = {"allowed_action_id": "scene.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": "confirmed", "client_request_id": rid(),
            "expires_at": soon(), **kw}
    return c.post(f"{API}/ha/entities/{eid}/actions", json=body, headers=headers or {})


def test_cd2_02_the_device_route_refuses_a_disarming_scene_without_the_grant(autos_app, executed):
    app, s, c, fake, tr = autos_app
    eid = _night(app, fake)
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", "alarm_control_panel.home_panel", eid)
    grant(c, "omer", "בן בית", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "alarm.view", "alarm.arm"], "floor", ids["floor2"])
    r = _turn_on(c, eid, OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required", r.text
    assert executed == [], "nothing was recorded or sent"
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ha.action' AND decision = 'denied' AND reason = 'grant_required' AND resource_id = ?", (eid,)).fetchone()
        assert row is not None and json.loads(row[0])["member"] == "alarm_control_panel.home_panel"
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE entity_id = ?", (eid,)).fetchone()[0] == 0
    # the route's own confirmation stays: no `confirmed`, no run (for every scene)
    assert _turn_on(c, eid, confirmation_grant=None).json()["code"] == "confirmation_required"
    # the administrator holds the disarm grant: sent once
    r = _turn_on(c, eid)
    assert r.status_code in (200, 202), r.text
    assert len(executed) == 1


def test_cd2_02_the_device_route_asks_the_step_up_proof_of_a_disarm(autos_app, executed, monkeypatch):
    app, s, c, fake, tr = autos_app
    eid = _night(app, fake)
    asked: list[str] = []

    def guard_action(conn, request, principal, action):
        asked.append(action)
        raise ApiError(403, "step_up_required", "x", details={"action": action})

    monkeypatch.setattr(step_up, "guard_action", guard_action)
    r = _turn_on(c, eid)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["alarm.disarm"] and executed == []


# ================================================================ CD2-04 - copy / restore never go live on their own

def _file_auto(fake, cid):
    return next(i for i in fake.automations if str(i.get("id")) == str(cid))


def test_cd2_04_a_copied_automation_is_written_disabled(autos_app):
    app, s, c, fake, tr = autos_app
    src = item_by_name(c, "מזגן סלון בבוקר")
    assert src["state"] == "on"
    r = c.post(f"{API}/automations/automation/{src['id']}/copy", json={"name": "העתק של מזגן", "client_request_id": rid()})
    assert r.status_code == 201, r.text
    new = r.json()["item"]
    assert new["state"] == "off", new["state"]
    assert any(x.get("op") == "disable" and x.get("item_id") == new["config_id"] for x in tr.bridge_calls)


def test_cd2_04_a_restored_automation_comes_back_disabled(autos_app):
    app, s, c, fake, tr = autos_app
    d = c.get(f"{API}/automations/automation/{item_by_name(c, 'מזגן סלון בבוקר')['id']}").json()
    tid = c.post(f"{API}/automations/automation/{d['id']}/delete", json={"base_revision": d["revision"], "confirm": True, "client_request_id": rid()}).json()["trash_id"]
    r = c.post(f"{API}/automations/trash/{tid}/restore", json={"client_request_id": rid()})
    assert r.status_code == 201, r.text
    assert r.json()["item"]["state"] == "off"


def test_cd2_04_a_self_triggering_copy_is_written_in_single_run_mode(autos_app):
    app, s, c, fake, tr = autos_app
    cfg = {"id": "1790000000201", "alias": "Self loop", "description": "", "mode": "parallel", "max": 5,
           "triggers": [{"trigger": "state", "entity_id": ["light.office"], "to": "on"}], "conditions": [],
           "actions": [{"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}]}
    fake.automations.append(cfg)
    fake.reload_automation(cfg["id"])
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    src = item_by_name(c, "Self loop")
    r = c.post(f"{API}/automations/automation/{src['id']}/copy", json={"name": "Self loop 2", "client_request_id": rid()})
    assert r.status_code == 201, r.text
    stored = _file_auto(fake, r.json()["item"]["config_id"])
    assert stored["mode"] == "single" and "max" not in stored


# ================================================================ CD2-05 - a pending op is settled, the audit resumes

def test_cd2_05_a_stale_pending_automation_op_is_settled_unknown(autos_app):
    app, s, c, fake, tr = autos_app
    native = item_by_name(c, "ערב בסלון", "scene")
    key = rid()
    old = automations._iso(fake.now() - dt.timedelta(minutes=20))
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO automation_ops(id, principal_user_id, principal_username, client_request_id, op, kind, item_id, status, requested_at) "
                     "VALUES ('opstale1', 'dev-joni', 'joni', ?, 'apply', 'scene', ?, 'pending', ?)", (key, native["id"], old))
        conn.execute("INSERT INTO automation_ops(id, principal_user_id, principal_username, client_request_id, op, kind, item_id, status, requested_at) "
                     "VALUES ('opstale2', 'dev-joni', 'joni', 'k-create', 'create', 'automation', 'x1', 'pending', ?)", (old,))
    with app.state.db.connection(mode="read") as conn:
        assert automations.MIRROR._arx_create_in_flight(conn) is False, "an op pending for 20 minutes no longer silences the outside-change audit"
        assert automations.MIRROR._recent_arx_op(conn, "automation", "x1") is False
    out = automations.janitor(app.state.db, {})
    assert out["expired"] == 2
    with app.state.db.connection(mode="read") as conn:
        assert {r[0] for r in conn.execute("SELECT status FROM automation_ops WHERE id IN ('opstale1', 'opstale2')")} == {"unknown"}
    r = _apply(c, native["id"], client_request_id=key)
    assert r.status_code == 202 and r.json()["status"] == "unknown", r.text  # never op_pending for ever; nothing re-sent


def test_cd2_05_a_fresh_pending_op_still_counts(autos_app):
    app, s, c, fake, tr = autos_app
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO automation_ops(id, principal_user_id, principal_username, client_request_id, op, kind, item_id, status, requested_at) "
                     "VALUES ('opfresh', 'dev-joni', 'joni', 'k-fresh', 'create', 'automation', 'x2', 'pending', ?)", (automations._iso(fake.now() - dt.timedelta(minutes=5)),))
    with app.state.db.connection(mode="read") as conn:
        assert automations.MIRROR._arx_create_in_flight(conn) is True
    assert automations.janitor(app.state.db, {})["expired"] == 0


def test_cd2_05_a_stale_pending_schedule_op_is_settled_unknown_and_keeps_what_it_sent(sched_app):
    app, s, c, fake, tr = sched_app
    old = schedules._iso(fake.now() - dt.timedelta(minutes=20))
    meta = json.dumps({"name": "X", "fp": "abc", "enabled": True})
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO schedule_ops(id, principal_user_id, principal_username, client_request_id, op, schedule_id, status, error, requested_at) "
                     "VALUES ('sopstale', 'dev-joni', 'joni', 'k-s', 'create', NULL, 'pending', ?, ?)", (meta, old))
        conn.execute("INSERT INTO schedule_ops(id, principal_user_id, principal_username, client_request_id, op, schedule_id, status, error, requested_at) "
                     "VALUES ('sopstale2', 'dev-joni', 'joni', 'k-s2', 'update', 'sid-1', 'pending', NULL, ?)", (old,))
    with app.state.db.connection(mode="read") as conn:
        assert schedules.MIRROR._arx_create_in_flight(conn) is False and schedules.MIRROR._recent_arx_op(conn, "sid-1") is False
    assert schedules.janitor(app.state.db, {})["expired"] == 2
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT status, error FROM schedule_ops WHERE id = 'sopstale'").fetchone()
    assert row["status"] == "unknown" and row["error"] == meta  # a late adoption can still claim it


# ================================================================ CD2-07 - the trace calls never hold the write lock

def _lock_is_free(db) -> bool:
    probe = sqlite3.connect(db.path, timeout=0, isolation_level=None)
    try:
        probe.execute("BEGIN IMMEDIATE")
        probe.execute("ROLLBACK")
        return True
    except sqlite3.OperationalError:
        return False
    finally:
        probe.close()


def test_cd2_07_the_runs_routes_call_home_assistant_with_the_write_lock_free(autos_app, monkeypatch):
    app, s, c, fake, tr = autos_app
    seen: list[tuple[str, bool]] = []
    real = tr.ws

    def ws(msg_type, **kw):
        seen.append((msg_type, _lock_is_free(app.state.db)))
        return real(msg_type, **kw)

    monkeypatch.setattr(tr, "ws", ws)
    it = item_by_name(c, "תאורה בפרוזדור בתנועה")
    assert c.get(f"{API}/automations/automation/{it['id']}/runs").status_code == 200
    c.get(f"{API}/automations/automation/{it['id']}/runs/run-1")
    assert [m for m, _ in seen] == ["trace/list", "trace/get"], seen
    assert all(free for _, free in seen), seen


# ================================================================ CD2-11 / CD2-16 / CD2-19 - schedules

def _sched(c, name, headers=None):
    return next(x for x in c.get(f"{API}/schedules", params={"limit": 500}, headers=headers or {}).json()["items"] if x["name"] == name)


def test_cd2_11_a_restore_whose_disable_fails_says_so(sched_app):
    app, s, c, fake, tr = sched_app
    gate = _sched(c, "Gate")
    assert gate["enabled"] is False
    out = post_json(c, f"/schedules/{gate['id']}/delete", {"base_revision": gate["revision"], "confirm": True, "client_request_id": rid()}).json()
    fake.fail_next["disable"] = "unauthorized"
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 201, r.text
    assert [w["code"] for w in r.json()["schedule"]["warnings"]].count("not_disabled") == 1, r.json()["schedule"]["warnings"]
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'schedule.disable' AND decision = 'denied'").fetchone()[0] == 1


def test_cd2_11_a_copy_whose_disable_fails_says_so(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    gate = _sched(c, "Gate")
    real = fake.call_service

    def call_service(domain, service, data=None, user=None):
        out = real(domain, service, data, user)
        if service == "copy":  # a component whose copy comes out enabled (the case keep_disabled exists for)
            new = next(sid for sid, it in fake.items.items() if it.get("name") == "Gate 2")
            fake.items[new]["enabled"] = True
            fake._sync_state(new)
        return out

    monkeypatch.setattr(fake, "call_service", call_service)
    fake.fail_next["disable"] = "unauthorized"
    r = post_json(c, f"/schedules/{gate['id']}/copy", {"name": "Gate 2", "client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 201, r.text
    assert "not_disabled" in [w["code"] for w in r.json()["schedule"]["warnings"]]


def test_cd2_16_a_folder_without_a_position_is_not_a_server_error(sched_app):
    app, s, c, fake, tr = sched_app
    r = c.put(f"{API}/schedules/organisation", json={"folders": [{"id": "a", "name": "A", "position": None}, {"id": "b", "name": "B"}], "items": []})
    assert r.status_code == 200, r.text
    assert [(f["id"], f["position"]) for f in r.json()["folders"]] == [("a", 0), ("b", 1)]


def test_cd2_16_a_scoped_manager_never_removes_a_folder_holding_schedules_they_cannot_see(sched_app):
    app, s, c, fake, tr = sched_app
    hall = _sched(c, "Hall lights on rest days")
    assert c.put(f"{API}/schedules/organisation", json={"folders": [{"id": "shared", "name": "Shared", "position": 0}],
                                                         "items": [{"schedule_id": hall["id"], "folder_id": "shared", "order": 1, "pinned": False}]}).status_code == 200
    ids = seed_tree(c)
    _sched_grant(c, "omer", "עורך קומה 2", ["devices.read", "entity.state.read", "devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    assert hall["id"] not in {x["id"] for x in c.get(f"{API}/schedules", params={"limit": 500}, headers=OMER).json()["items"]}
    r = c.put(f"{API}/schedules/organisation", json={"folders": [], "items": []}, headers=OMER)
    assert r.status_code == 200, r.text
    org = c.get(f"{API}/schedules/organisation").json()
    assert [f["id"] for f in org["folders"]] == ["shared"]
    assert next(i for i in org["items"] if i["schedule_id"] == hall["id"])["folder_id"] == "shared"
    # the administrator (installation-wide) still removes it
    assert c.put(f"{API}/schedules/organisation", json={"folders": [], "items": []}).status_code == 200
    assert c.get(f"{API}/schedules/organisation").json()["folders"] == []


def test_cd2_19_a_refused_run_now_does_not_block_the_next_one(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    hall = _sched(c, "Hall lights on rest days")

    def refused(core, slot_index, w):
        raise ApiError(422, "validation", "x")

    monkeypatch.setattr(schedule_ops, "_slot_time", refused)
    for _ in range(2):
        r = post_json(c, f"/schedules/{hall['id']}/run", {"client_request_id": rid(), "slot_index": 0, "confirm": True})
        assert r.status_code == 422 and r.json()["code"] == "validation", r.text  # never 429 run_too_soon after a refusal


def test_scene_step_up_table_matches_the_device_route():
    from smplwise.routers import ha as ha_router

    assert automation_ops.SCENE_STEP_UP["alarm_control_panel.alarm_disarm"] == ha_router.STEP_UP_GRANTS["alarm.disarm"]
    assert automation_ops.SCENE_STEP_UP["lock.unlock"] == ha_router.STEP_UP_GRANTS["door.unlock"]
    assert automation_ops.SCENE_STEP_UP["alarm_control_panel.alarm_arm_custom_bypass"] == ha_router.STEP_UP_ACTIONS["alarm_control_panel.alarm_arm_custom_bypass"]
    assert ha_bridge.ACTIONS["scene.turn_on"]["sensitive"] is True  # the device route's confirmation covers every scene
