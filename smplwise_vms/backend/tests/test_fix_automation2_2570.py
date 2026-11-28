"""FIX-AUTOMATION2-2570 (docs/changes/FIX-AUTOMATION2-2570.md): a human-started run of an automation / script is judged for what it
reaches through the scenes, scripts and triggered automations it calls - transitively, cycle-safe - exactly as FIX-AUTOMATION-2570 judges
a scene's sensitive members: the manual grant (403 `grant_required`), the confirmation (409 `confirmation_required`, `confirm: true`), the
step-up of a disarm / an unlock (also when the automation / script does it itself), and the VD2-01 unknown rule (403 `forbidden`,
`details.reason = "scene_members_unknown"`) for a call whose content cannot be read. Both run routes and the device route's `script.turn_on`."""
from __future__ import annotations

import json

import pytest

from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API, OMER, item_by_name, place, rid, seed_mirror, seed_tree
from automations_fixture import grant as _raw_grant
from smplwise.errors import ApiError
from smplwise.routers.access import SENSITIVE as _SENSITIVE
from smplwise.services import automations, ha_client, step_up
from support.waiting import soon

PANEL = "alarm_control_panel.home_panel"
LOCK = "lock.front_door"


def grant(c, user, name, permissions, scope_type, scope_id):
    both = list(dict.fromkeys(permissions))
    return _raw_grant(c, user, name, [p for p in both if p not in _SENSITIVE], [p for p in both if p in _SENSITIVE], scope_type, scope_id)


def _pull(app, fake):
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")


def _scene(app, fake, name, entities, cid):
    cfg = {"id": cid, "name": name, "entities": entities}
    fake.scenes.append(cfg)
    eid = fake._unique_entity("scene", name.lower().replace(" ", "_"))
    fake._seed_scene_entity(eid, cid, cfg)
    _pull(app, fake)
    return eid


def _script(app, fake, key, sequence, alias=None):
    cfg = {"alias": alias or key.replace("_", " ").title(), "mode": "single", "sequence": sequence}
    fake.scripts[key] = cfg
    fake._seed_script_entity(key, cfg)
    _pull(app, fake)
    return f"script.{key}"


def _automation(app, fake, eid, cid, actions, alias):
    cfg = {"id": cid, "alias": alias, "description": "", "triggers": [{"trigger": "state", "entity_id": ["binary_sensor.motion_hall"], "to": "on"}],
           "conditions": [], "actions": actions, "mode": "single"}
    fake._seed_automation(eid, cid, cfg, True)
    _pull(app, fake)
    return cid


def _call(action, eid):
    return {"action": action, "target": {"entity_id": [eid]}}


def _night_scene(app, fake):
    return _scene(app, fake, "Night lobby", {"light.office": "on", PANEL: "disarmed"}, "1790000000201")


def _run_script(c, key, headers=None, **body):
    return c.post(f"{API}/automations/script/{key}/run", json={"client_request_id": rid(), "fields": {}, **body}, headers=headers or {})


def _run_auto(c, item_id, headers=None, **body):
    return c.post(f"{API}/automations/automation/{item_id}/run", json={"client_request_id": rid(), **body}, headers=headers or {})


def _sent(tr, op):
    return [x for x in tr.bridge_calls if x.get("op") == op]


def _omer_scripts(c, ids, *extra):
    grant(c, "omer", "בן בית", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "alarm.view", "alarm.arm",
                                "script.run", "automation.manage", *extra], "floor", ids["floor2"])


@pytest.fixture()
def asked(monkeypatch):
    out: list[str] = []

    def guard_action(conn, request, principal, action):
        out.append(action)
        raise ApiError(403, "step_up_required", "x", details={"action": action})

    monkeypatch.setattr(step_up, "guard_action", guard_action)
    return out


# ================================================================ 1. a script that runs a disarming scene

def test_a_script_calling_a_disarming_scene_needs_the_disarm_grant(autos_app):
    app, s, c, fake, tr = autos_app
    scene = _night_scene(app, fake)
    _script(app, fake, "night_mode", [_call("scene.turn_on", scene)])
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", PANEL, scene, "script.night_mode")
    _omer_scripts(c, ids)
    r = _run_script(c, "night_mode", OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required", r.text
    assert r.json()["details"]["grant"] == "alarm.disarm" and r.json()["details"]["entity_id"] == PANEL
    assert _sent(tr, "run_script") == [], "nothing was sent"
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'automation.run' AND decision = 'denied' AND reason = 'grant_required' "
                           "AND resource_id = 'script:night_mode'").fetchone()
    assert row is not None and json.loads(row[0])["nested_entities"] == [PANEL]  # the refusal is audited and names what the call reaches
    grant(c, "omer", "נטרול", ["alarm.disarm"], "floor", ids["floor2"])
    assert _run_script(c, "night_mode", OMER, confirm=True).status_code == 202


def test_a_script_calling_a_disarming_scene_asks_the_confirmation(autos_app):
    app, s, c, fake, tr = autos_app
    scene = _night_scene(app, fake)
    _script(app, fake, "night_mode", [_call("scene.turn_on", scene)])
    r = _run_script(c, "night_mode")
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text
    assert _sent(tr, "run_script") == []
    assert _run_script(c, "night_mode", confirm=True).status_code == 202


def test_a_script_calling_a_disarming_scene_asks_the_step_up_of_a_disarm(autos_app, asked):
    app, s, c, fake, tr = autos_app
    scene = _night_scene(app, fake)
    _script(app, fake, "night_mode", [_call("scene.turn_on", scene)])
    r = _run_script(c, "night_mode", confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["alarm.disarm"], r.text
    assert _sent(tr, "run_script") == []


# ================================================================ 2. an automation -> script -> scene / lock (transitive)

def test_an_automation_reaching_an_unlock_through_two_calls_needs_the_unlock_grant(autos_app):
    app, s, c, fake, tr = autos_app
    _script(app, fake, "open_up", [_call("lock.unlock", LOCK)])
    _script(app, fake, "arrive", [_call("light.turn_on", "light.office"), _call("script.turn_on", "script.open_up")])
    cid = _automation(app, fake, "automation.arrival_chain", "1790000000301", [_call("script.turn_on", "script.arrive")], "Arrival chain")
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", LOCK, "script.open_up", "script.arrive", "automation.arrival_chain", "binary_sensor.motion_hall")
    _omer_scripts(c, ids)
    item = item_by_name(c, "Arrival chain", "automation", headers=OMER)
    assert item["id"] == cid
    r = _run_auto(c, cid, OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "door.unlock", r.text
    assert _sent(tr, "trigger") == []
    grant(c, "omer", "דלתות", ["door.unlock"], "floor", ids["floor2"])
    r = _run_auto(c, cid, OMER)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text  # the inner unlock makes the run sensitive
    assert _run_auto(c, cid, OMER, confirm=True).status_code == 202


def test_an_automation_triggering_a_disarming_automation_is_judged_for_it(autos_app):
    app, s, c, fake, tr = autos_app
    _automation(app, fake, "automation.inner_disarm", "1790000000302", [_call("alarm_control_panel.alarm_disarm", PANEL)], "Inner disarm")
    cid = _automation(app, fake, "automation.outer_trigger", "1790000000303", [_call("automation.trigger", "automation.inner_disarm")], "Outer trigger")
    # automation.manage installation-wide (controlling another automation asks it), no alarm.disarm
    grant(c, "omer", "מנהל אוטומציות", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "alarm.view", "alarm.arm", "automation.manage"],
          "installation", "*")
    r = _run_auto(c, cid, OMER, confirm=True)
    assert r.status_code == 403 and r.json()["details"].get("grant") == "alarm.disarm", r.text


def test_switching_another_automation_off_is_not_a_run_of_its_content(autos_app):
    """`automation.turn_off` / `script.turn_off` run nothing: no inner grant, no confirmation for them."""
    app, s, c, fake, tr = autos_app
    _automation(app, fake, "automation.inner_disarm", "1790000000302", [_call("alarm_control_panel.alarm_disarm", PANEL)], "Inner disarm")
    cid = _automation(app, fake, "automation.outer_off", "1790000000304", [_call("automation.turn_off", "automation.inner_disarm")], "Outer off")
    assert _run_auto(c, cid).status_code == 202


def test_a_cycle_of_scripts_ends(autos_app):
    app, s, c, fake, tr = autos_app
    _script(app, fake, "ping", [_call("light.turn_on", "light.office"), _call("script.turn_on", "script.pong")])
    _script(app, fake, "pong", [_call("script.turn_on", "script.ping")])
    grant(c, "omer", "מפעיל סקריפטים", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "script.run", "alarm.view"],
          "installation", "*")
    # the loop ends (no recursion error) and is not an unreadable call: no strongest-rights refusal. The effects view still counts a loop
    # deeper than its depth as unknown, so the confirmation the item asks stays (unchanged)
    r = _run_script(c, "ping", OMER)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text
    assert _run_script(c, "ping", OMER, confirm=True).status_code == 202


# ================================================================ 3. a call that cannot be read fails closed (VD2-01 rule)

def test_a_script_calling_an_unreadable_script_needs_the_strongest_rights(autos_app, asked):
    app, s, c, fake, tr = autos_app
    _script(app, fake, "mystery_caller", [_call("script.turn_on", "script.not_mirrored")])
    grant(c, "omer", "מפעיל סקריפטים", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "script.run", "alarm.view"],
          "installation", "*")
    r = _run_script(c, "mystery_caller", OMER, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "forbidden" and r.json()["details"]["reason"] == "scene_members_unknown", r.text
    assert _sent(tr, "run_script") == []
    # the administrator with every manual right installation-wide: the confirmation, then the step-up of a disarm and of a door opening
    grant(c, "joni", "דלתות", ["door.unlock"], "installation", "*")
    r = _run_script(c, "mystery_caller")
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text
    r = _run_script(c, "mystery_caller", confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["alarm.disarm"], r.text  # the first proof asked stops it


def test_a_script_calling_a_scene_with_no_readable_members_fails_closed(autos_app):
    app, s, c, fake, tr = autos_app
    eid = "scene.mystery"
    fake.states[eid] = {"entity_id": eid, "state": "unknown", "last_changed": fake.iso(), "attributes": {"friendly_name": "Mystery", "id": "yaml-mystery"}}
    fake.registry.append(fake._reg_row(eid, platform="homeassistant", unique_id="yaml-mystery"))
    _script(app, fake, "mystery_scene", [_call("scene.turn_on", eid)])
    grant(c, "omer", "מפעיל סקריפטים", ["devices.read", "entity.state.read", "devices.control", "ha.entity.control", "script.run", "alarm.view"],
          "installation", "*")
    r = _run_script(c, "mystery_scene", OMER, confirm=True)
    assert r.status_code == 403 and r.json()["details"]["reason"] == "scene_members_unknown", r.text


# ================================================================ 4. the step-up for a script / automation that disarms by itself

def test_a_script_that_disarms_by_itself_asks_the_step_up(autos_app, asked):
    app, s, c, fake, tr = autos_app
    _script(app, fake, "disarm_now", [_call("alarm_control_panel.alarm_disarm", PANEL)])
    r = _run_script(c, "disarm_now", confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["alarm.disarm"], r.text
    assert _sent(tr, "run_script") == []


def test_an_automation_that_unlocks_by_itself_asks_the_step_up_of_a_door_opening(autos_app, asked):
    app, s, c, fake, tr = autos_app
    cid = _automation(app, fake, "automation.unlock_now", "1790000000305", [_call("lock.unlock", LOCK)], "Unlock now")
    grant(c, "joni", "דלתות", ["door.unlock"], "installation", "*")
    r = _run_auto(c, cid, confirm=True)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["door.open"], r.text
    assert _sent(tr, "trigger") == []


def test_a_plain_script_asks_no_step_up(autos_app, asked):
    app, s, c, fake, tr = autos_app
    _script(app, fake, "lights_only", [_call("light.turn_on", "light.office")])
    assert _run_script(c, "lights_only").status_code == 202 and asked == []


# ================================================================ 5. the device route's `script.turn_on` (a tile / a map card)

@pytest.fixture()
def executed(autos_app, monkeypatch):
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        return {"ok": True, "context_id": "ctx"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    return calls


def _tile(c, eid, headers=None, **kw):
    body = {"allowed_action_id": "script.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": "confirmed", "client_request_id": rid(),
            "expires_at": soon(), **kw}
    return c.post(f"{API}/ha/entities/{eid}/actions", json=body, headers=headers or {})


def test_a_script_tile_calling_a_disarming_scene_needs_the_grant(autos_app, executed):
    app, s, c, fake, tr = autos_app
    scene = _night_scene(app, fake)
    eid = _script(app, fake, "night_mode", [_call("scene.turn_on", scene)])
    ids = seed_tree(c)
    place(c, ids["floor2"], "light.office", PANEL, scene, eid)
    _omer_scripts(c, ids)
    r = _tile(c, eid, OMER)
    assert r.status_code == 403 and r.json()["code"] == "grant_required" and r.json()["details"]["grant"] == "alarm.disarm", r.text
    assert executed == []
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ha.action' AND decision = 'denied' AND reason = 'grant_required' AND resource_id = ?",
                           (eid,)).fetchone()
    assert row is not None and json.loads(row[0])["member"] == PANEL
    r = _tile(c, eid)  # the administrator holds the disarm grant
    assert r.status_code in (200, 202), r.text
    assert len(executed) == 1


def test_a_script_tile_that_disarms_asks_the_step_up(autos_app, executed, asked):
    app, s, c, fake, tr = autos_app
    eid = _script(app, fake, "disarm_now", [_call("alarm_control_panel.alarm_disarm", PANEL)])
    r = _tile(c, eid)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and asked == ["alarm.disarm"] and executed == [], r.text
