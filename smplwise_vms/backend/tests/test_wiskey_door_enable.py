"""CR-033 slice D10a groundwork (WXD-INT, review I5): enabling an automation or a schedule from Arx never re-arms an
autonomous WisKey door opener. While the editor block (`doors.editor_block`) is `blocked` - the default - enabling an item
whose steps reach a WisKey door (or may: an unresolvable step) is refused like a new door step; disabling is always
allowed; items without a door step, and installations without any WisKey door, are unchanged. Fakes only: the CR-017
automations world and the CR-014 scheduler fake with the real add-on code; no Home Assistant, no WisKey, no door."""
from __future__ import annotations

import uuid
from typing import Any

import fake_scheduler
import pytest
from automations_fixture import autos_app  # noqa: F401  (the CR-017 fixture)
from automations_transport import seed_mirror
from fake_trusted_bridge import FakeWisKeyFeed, station
from schedules_fixture import post_json, rid, sched_app  # noqa: F401  (the CR-014 fixture)

from smplwise.db import now_iso, set_setting
from smplwise.routers import access_control
from smplwise.services import door_path_guard, door_run_guard, ha_client, intercom_sync

ENTRY = "01JTESTSTATIONENTRY000000A"
API = "/api/v1"
NOT_CONVERTED = "לא ניתן להפעיל: יש בפריט פתיחת דלת שלא הוסבה"
UNRESOLVABLE = "לא ניתן להפעיל: לא ניתן לזהות את הדלתות בפריט"


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)


def _door_map(conn: Any, eid: str) -> None:
    conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,1,'manual','test',?)", (eid, ENTRY, now_iso()))


@pytest.fixture()
def autos(autos_app, monkeypatch):
    """Automations: three DISABLED ones (a WisKey door step through a script, a templated lock target, lights only) and one
    ENABLED one with a door step; a WisKey lock in the fake world and the mirror; nothing is ever executed."""
    from smplwise.services import automations

    app, s, c, fake, tr = autos_app
    FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda *a, **k: pytest.fail("nothing is executed here"))
    fake.states["lock.entrance"] = {"entity_id": "lock.entrance", "state": "locked", "attributes": {"friendly_name": "כניסה"}, "last_changed": fake.iso()}
    fake.registry.append(fake._reg_row("lock.entrance", platform="hikvision_intercom", unique_id="ent_door_1"))
    door_script = {"alias": "פתיחת שער", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}]}
    fake.scripts["door_script"] = door_script
    fake._seed_script_entity("door_script", door_script)

    def auto(cid: str, alias: str, actions: list[dict[str, Any]], enabled: bool) -> None:
        fake._seed_automation(f"automation.a_{cid}", cid, {"id": cid, "alias": alias, "mode": "single", "triggers": [{"trigger": "time", "at": "06:00:00"}],
                                                           "conditions": [], "actions": actions}, enabled)

    auto("8101", "פותח את השער בבוקר", [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}], False)
    auto("8102", "שער מחושב", [{"action": "lock.unlock", "target": {"entity_id": "{{ states('input_text.door') }}"}}], False)
    auto("8103", "אורות בלבד", [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}], False)
    auto("8104", "שער שפועל", [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}], True)
    seed_mirror(app.state.db, fake)
    with app.state.db.connection() as conn:
        _door_map(conn, "lock.entrance")
    automations.MIRROR.pull(None, "test")
    return {"app": app, "c": c, "fake": fake, "tr": tr}


def _toggle(c: Any, cid: str, op: str) -> Any:
    return c.post(f"{API}/automations/automation/{cid}/{op}", json={"client_request_id": f"en-{uuid.uuid4().hex[:10]}", "confirm": True})


def _ops(tr: Any) -> list[tuple[str, str]]:
    return [(b.get("op"), str(b.get("item_id"))) for b in tr.bridge_calls if b.get("op") in ("enable", "disable")]


def test_d10a_enabling_an_automation_with_a_door_step_is_refused_disabling_is_not(autos):
    c, tr, app = autos["c"], autos["tr"], autos["app"]
    r = _toggle(c, "8101", "enable")
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted" and r.json()["user_message"] == NOT_CONVERTED, r.text
    assert r.json()["details"]["op"] == "enable"
    r = _toggle(c, "8102", "enable")
    assert r.status_code == 409 and r.json()["code"] == "door_steps_unresolvable" and r.json()["user_message"] == UNRESOLVABLE, r.text
    assert _ops(tr) == [], "nothing reached the bridge"
    with app.state.db.connection(mode="read") as conn:
        denied = [x[0] for x in conn.execute("SELECT reason FROM audit_log WHERE action = 'automation.enable' AND decision = 'denied' ORDER BY id").fetchall()]
    assert denied == ["door_step_not_converted", "door_steps_unresolvable"], "every refusal is audited"
    # an item without a door step enables as before; an armed door item can always be disabled
    assert _toggle(c, "8103", "enable").status_code == 200
    assert _toggle(c, "8104", "disable").status_code == 200
    assert [op for op, _ in _ops(tr)] == ["enable", "disable"]
    # the administrator setting decides (`allowed` is not selectable through the API before D10a; stored directly here)
    with app.state.db.connection() as conn:
        set_setting(conn, door_path_guard.EDITOR_KEY, "allowed")
    assert _toggle(c, "8101", "enable").status_code == 200
    with app.state.db.connection() as conn:
        set_setting(conn, door_path_guard.EDITOR_KEY, "garbage")  # anything but exactly `allowed` reads as blocked
    assert _toggle(c, "8102", "enable").json()["code"] == "door_steps_unresolvable"


@pytest.fixture()
def scheds(sched_app, monkeypatch):
    """Schedules: a disabled one that unlocks a WisKey lock, a disabled one whose slot runs a template switch (a possible
    door), a disabled light schedule, and an enabled door schedule."""
    from smplwise.services import schedules

    app, s, c, fake, tr = sched_app
    FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)

    def add(name: str, service: str, entity: str, enabled: bool) -> str:
        sid = fake._add({"name": name, "weekdays": ["daily"], "repeat_type": "repeat",
                         "timeslots": [{"start": "08:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False,
                                        "actions": [{"service": service, "entity_id": entity, "service_data": {}}]}]})
        fake.items[sid]["enabled"] = enabled
        return sid

    ids = {"door": add("פתיחת שער", "lock.unlock", "lock.front_door", False), "template": add("מתג מחושב", "switch.turn_on", "switch.gate_tpl", False),
           "light": add("אור", "light.turn_on", "light.office", False), "armed": add("שער פעיל", "lock.unlock", "lock.front_door", True)}
    fake_scheduler.seed_mirror(app.state.db, fake)
    schedules.MIRROR.pull(None, "t")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom', config_entry_id = ? WHERE entity_id = 'lock.front_door'", (ENTRY,))
        conn.execute("INSERT OR IGNORE INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES ('switch.gate_tpl', 'switch', 'gate_tpl', 'template', 'off', ?, ?, ?)",
                     (now_iso(), now_iso(), now_iso()))
        _door_map(conn, "lock.front_door")
    ops: list[str] = []
    real = tr.bridge
    monkeypatch.setattr(tr, "bridge", lambda payload: ops.append(payload.get("op")) or real(payload))
    return {"app": app, "c": c, "fake": fake, "ids": ids, "ops": ops}


def test_d10a_schedule_enable_and_bulk_enable_refuse_a_door_step(scheds):
    c, ids, ops, app = scheds["c"], scheds["ids"], scheds["ops"], scheds["app"]
    r = post_json(c, f"/schedules/{ids['door']}/enable", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted" and r.json()["user_message"] == NOT_CONVERTED, r.text
    r = post_json(c, f"/schedules/{ids['template']}/enable", {"client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "door_steps_unresolvable", r.text
    assert "enable" not in ops
    r = post_json(c, "/schedules/bulk", {"op": "enable", "ids": [ids["door"], ids["template"], ids["light"]], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 200, r.text
    got = {x["id"]: (x["ok"], x.get("code")) for x in r.json()["results"]}
    assert got == {ids["door"]: (False, "door_step_not_converted"), ids["template"]: (False, "door_steps_unresolvable"), ids["light"]: (True, None)}, got
    assert ops.count("enable") == 1, "only the light schedule was enabled"
    assert scheds["fake"].items[ids["door"]]["enabled"] is False and scheds["fake"].items[ids["template"]]["enabled"] is False
    # an armed door schedule can always be switched off
    r = post_json(c, f"/schedules/{ids['armed']}/disable", {"client_request_id": rid()})
    assert r.status_code == 200, r.text
    assert scheds["fake"].items[ids["armed"]]["enabled"] is False


def test_d10a_without_a_wiskey_door_enabling_is_unchanged(sched_app):
    from smplwise.services import schedules

    app, s, c, fake, tr = sched_app
    sid = fake._add({"name": "מנעול רגיל", "weekdays": ["daily"], "repeat_type": "repeat",
                     "timeslots": [{"start": "08:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False,
                                    "actions": [{"service": "switch.turn_on", "entity_id": "switch.gate_tpl", "service_data": {}}]}]})
    fake.items[sid]["enabled"] = False
    fake_scheduler.seed_mirror(app.state.db, fake)
    schedules.MIRROR.pull(None, "t")
    with app.state.db.connection() as conn:
        conn.execute("INSERT OR IGNORE INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES ('switch.gate_tpl', 'switch', 'gate_tpl', 'template', 'off', ?, ?, ?)",
                     (now_iso(), now_iso(), now_iso()))
    with app.state.db.connection(mode="read") as conn:
        door_run_guard.judge_enable_schedule(conn, fake.items[sid])  # no WisKey door anywhere: nothing to judge
