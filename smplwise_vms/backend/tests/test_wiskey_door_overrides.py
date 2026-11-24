"""WXUNBLK (owner decision 2026-10-13): the system administrator's explicit, audited, per-entity release of the door path's block
on template / universal entities, and its Settings list (`GET /doors/blocks`, `PUT /doors/blocks/entities/{entity_id}`).

What is pinned here:
- the list: what is blocked (entities and saved items), what a release says (why, who, when), who may read and write it;
- a release is explicit (confirmation, a note), audited, honoured for THAT entity only, and reversible;
- a release never bypasses a block: an item with a real WisKey door step keeps its refusal and its message, a WisKey lock or an
  entity mapped to an intercom door cannot be released (and a stale release of one is not honoured), `execute` for a WisKey door
  stays blocked, no other unresolved reason is released, and a damaged store releases nothing.

Fakes only: the add-on code over a synthetic Home Assistant mirror (synthetic opaque station ids); no Home Assistant, no bridge,
no WisKey, no door, no key."""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

import pytest
from automations_fixture import autos_app  # noqa: F401  (the CR-017 automations fixture)
from automations_transport import seed_mirror
from conftest import as_user, bind
from fake_trusted_bridge import FakeWisKeyFeed, station
from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import access_control
from smplwise.services import door_blocks, door_execute_guard, door_overrides, door_path, door_path_guard, door_run_guard, ha_client, intercom_sync

API = "/api/v1"
ENTRY = "01JWXUNBLKSTATIONENTRY000A"  # a synthetic opaque config entry id (never a hardware id)
BLOCKS = f"{API}/doors/blocks"


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)


def _entity(db: Database, entity_id: str, platform: str | None, *, name: str | None = None, area: str | None = None, removed: bool = False) -> None:
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO ha_entities(entity_id, domain, name, platform, area_name, state, state_seen_at, first_seen_at, updated_at, removed_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (entity_id, entity_id.split(".")[0], name or entity_id.split(".")[1], platform, area, "off", now_iso(), now_iso(), now_iso(), now_iso() if removed else None),
        )


def _script(db: Database, item_id: str, sequence: list[dict[str, Any]], alias: str | None = None) -> None:
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, seen_at, changed_at) VALUES ('script', ?, ?, ?, 'ui', ?, ?, 0, ?, ?)",
            (item_id, item_id, f"script.{item_id}", uuid.uuid4().hex[:16], json.dumps({"alias": alias or item_id, "sequence": sequence}), now_iso(), now_iso()),
        )


def _door_map(db: Database, entity_id: str, relay: int = 1) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,?,'manual','test',?)", (entity_id, ENTRY, relay, now_iso()))


UNLOCK = {"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}
TURN_ON_GATE = {"action": "switch.turn_on", "target": {"entity_id": "switch.gate"}}
TURN_ON_HALL = {"action": "light.turn_on", "target": {"entity_id": "light.hall"}}


@pytest.fixture()
def world(settings, monkeypatch):
    """A WisKey door (the entrance's lock, mapped), an ordinary lock and switch, a template lock / switch / light / cover and a
    template sensor, a universal media player, and five saved scripts: via the template switch, via the template lock, through
    both a template switch and a template light, a REAL door step, and a real door step beside a template switch."""
    FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda *a, **k: pytest.fail("nothing is executed here"))
    app = create_app(settings)
    c = TestClient(app)
    db = Database(settings.db_path)
    for eid, platform, name in (
        ("lock.entrance", "hikvision_intercom", "כניסה"), ("lock.office", "nuki", "משרד"), ("lock.virtual", "template", "מנעול וירטואלי"),
        ("switch.gate", "template", "שער"), ("light.hall", "template", "מנורת מבואה"), ("cover.shutter", "template", "תריס"),
        ("sensor.tpl_temp", "template", "טמפרטורה"), ("media_player.uni", "universal", "נגן"), ("switch.plain", "shelly", "מתג רגיל"),
    ):
        _entity(db, eid, platform, name=name, area="חצר" if eid == "switch.gate" else None)
    _door_map(db, "lock.entrance")
    _script(db, "via_switch", [TURN_ON_GATE], "פתיחת שער")
    _script(db, "via_lock", [{"action": "lock.unlock", "target": {"entity_id": "lock.virtual"}}], "מנעול וירטואלי")
    _script(db, "via_both", [TURN_ON_GATE, TURN_ON_HALL], "שער ומבואה")
    _script(db, "door_script", [UNLOCK], "פתיחת הכניסה")
    _script(db, "mixed", [UNLOCK, TURN_ON_GATE], "כניסה ושער")
    _script(db, "plain", [{"action": "switch.turn_on", "target": {"entity_id": "switch.plain"}}], "מתג רגיל")
    return {"app": app, "c": c, "db": db, "settings": settings}


def _put(c: TestClient, entity_id: str, unblocked: bool, note: str | None = "בדיקה ידנית של התקן", *, confirmed: Any = True, headers: dict[str, str] | None = None) -> Any:
    body: dict[str, Any] = {"unblocked": unblocked, "confirmed": confirmed}
    if note is not None:
        body["note"] = note
    return c.put(f"{BLOCKS}/entities/{entity_id}", json=body, headers=headers or {})


def _release(c: TestClient, *entity_ids: str) -> None:
    for eid in entity_ids:
        r = _put(c, eid, True)
        assert r.status_code == 200 and r.json()["state"] == "unblocked", r.text


def _entities(c: TestClient) -> dict[str, dict[str, Any]]:
    r = c.get(BLOCKS)
    assert r.status_code == 200, r.text
    return {e["entity_id"]: e for e in r.json()["entities"]}


def _items(c: TestClient) -> dict[str, dict[str, Any]]:
    return {i["key"]: i for i in c.get(BLOCKS).json()["items"]}


def _judge(db: Database, item_id: str) -> str | None:
    """The run guard's verdict on a saved script: None (runs as before) or the refusal's code."""
    with db.connection(mode="read") as conn:
        try:
            door_run_guard.judge_item(conn, "script", item_id)
        except ApiError as exc:
            return exc.code
    return None


def _tile(db: Database, entity_id: str, action: str) -> str | None:
    with db.connection(mode="read") as conn:
        try:
            door_run_guard.judge_entity_action(conn, entity_id, action)
        except ApiError as exc:
            return exc.code
    return None


def _audit(db: Database, action: str) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT actor_user_id, actor_username, resource_type, resource_id, decision, reason, details_json, at FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in rows]


# ================================================================ the list

def test_nothing_is_released_by_default_and_the_list_says_what_is_blocked(world):
    c = world["c"]
    r = c.get(BLOCKS)
    assert r.status_code == 200
    data = r.json()
    assert data["wiskey_present"] is True and data["truncated"] is False
    by = {e["entity_id"]: e for e in data["entities"]}
    # every blocked entity of a script-backed platform; the WisKey lock, the ordinary ones and the passive sensor are not offered
    assert sorted(by) == ["cover.shutter", "light.hall", "lock.virtual", "media_player.uni", "switch.gate"]
    assert all(e["state"] == "blocked" and e["overridable"] is True and e["override"] is None and e["stale"] is False for e in by.values())
    assert by["switch.gate"]["name"] == "שער" and by["switch.gate"]["area"] == "חצר" and by["switch.gate"]["platform"] == "template"
    assert by["media_player.uni"]["platform"] == "universal"
    # which saved items use it (names, never ids)
    assert by["switch.gate"]["used_by"] == ["כניסה ושער", "פתיחת שער", "שער ומבואה"] and by["switch.gate"]["used_more"] == 0
    assert by["lock.virtual"]["used_by"] == ["מנעול וירטואלי"] and by["cover.shutter"]["used_by"] == []
    # the saved items the guards refuse, with the reason
    items = {i["key"]: i for i in data["items"]}
    assert sorted(items) == ["script:door_script", "script:mixed", "script:via_both", "script:via_lock", "script:via_switch"]
    assert all(i["blocked"] for i in items.values())
    assert items["script:door_script"]["opens_door"] is True and items["script:door_script"]["devices"] == []
    assert items["script:mixed"]["opens_door"] is True and items["script:mixed"]["devices"] == [{"name": "שער", "state": "blocked"}]
    assert items["script:via_switch"]["opens_door"] is False and items["script:via_switch"]["devices"] == [{"name": "שער", "state": "blocked"}]
    assert [d["name"] for d in items["script:via_both"]["devices"]] == ["מנורת מבואה", "שער"], "alphabetical"
    assert "plain" not in " ".join(items), "a script that touches nothing blocked is not listed"
    assert data["counts"] == {"entities": 5, "blocked": 5, "unblocked": 0, "items": 5, "items_blocked": 5}
    assert get_setting_of(world, door_overrides.KEY) is None, "nothing is stored until somebody releases something"


def get_setting_of(world: dict[str, Any], key: str) -> str | None:
    with world["db"].connection(mode="read") as conn:
        return get_setting(conn, key)


def test_without_a_wiskey_door_nothing_is_blocked_and_the_list_is_empty(settings):
    create_app(settings)
    c = TestClient(create_app(settings))
    db = Database(settings.db_path)
    _entity(db, "switch.gate", "template")
    data = c.get(BLOCKS).json()
    assert data["wiskey_present"] is False and data["entities"] == [] and data["items"] == []
    assert data["counts"] == {"entities": 0, "blocked": 0, "unblocked": 0, "items": 0, "items_blocked": 0}
    r = _put(c, "switch.gate", True)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "not_blocked", "nothing blocks it: there is nothing to release"


def test_only_a_system_administrator_reads_or_writes_it_and_a_refusal_is_audited(world):
    c, settings, db = world["c"], world["settings"], world["db"]
    bind(c, settings, "otto", "operator", "installation", "*")
    bind(c, settings, "dana", "site_admin", "installation", "*")
    for who in ("otto", "dana"):
        assert c.get(BLOCKS, headers=as_user(who)).status_code == 403, who
        r = _put(c, "switch.gate", True, headers=as_user(who))
        assert r.status_code == 403, (who, r.text)
    assert c.get(BLOCKS, headers=as_user("nobody-at-all")).status_code == 403
    assert _entities(c)["switch.gate"]["state"] == "blocked"
    with db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND reason IS NOT NULL AND actor_user_id IN ('dev-otto', 'dev-dana')").fetchone()[0]
    assert n >= 2, "the refusals are audited (the permission check does it)"


# ================================================================ the release: explicit, audited, one entity

def test_a_release_needs_the_confirmation_and_a_note(world):
    c, db = world["c"], world["db"]
    r = _put(c, "switch.gate", True, confirmed=None)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = _put(c, "switch.gate", True, confirmed="true")
    assert r.status_code == 409, "only the boolean true confirms"
    for note in (None, "", "  ", "ab", "  a  "):
        r = _put(c, "switch.gate", True, note)
        assert r.status_code == 422 and r.json()["details"]["reason"] == "note_required", (note, r.text)
    r = _put(c, "switch.gate", True, "א" * 301)
    assert r.status_code == 422 and r.json()["details"]["reason"] == "note_too_long"
    bad = _put(c, "Switch.Gate", True)
    assert bad.status_code == 422 and bad.json()["details"] == {"field": "entity_id", "reason": "bad_entity"}, "an entity id is lower case"
    assert _put(c, "no-dot", True).status_code == 422
    assert _entities(c)["switch.gate"]["state"] == "blocked"
    assert get_setting_of(world, door_overrides.KEY) is None
    assert _audit(db, "intercom.door.entity_unblocked")[-1]["decision"] == "denied", "a refused note is recorded as a refusal"


def test_a_release_records_who_when_and_why_in_the_store_the_list_and_the_audit_log(world):
    c, db = world["c"], world["db"]
    r = _put(c, "switch.gate", True, "  שער  החצר\nשל הדייר   ")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entity_id"] == "switch.gate" and body["state"] == "unblocked" and body["changed"] is True
    assert body["override"]["note"] == "שער החצר של הדייר", "whitespace collapsed: a note is one line"
    assert body["override"]["by"] == "joni" and body["override"]["at"].endswith("Z")
    row = _entities(c)["switch.gate"]
    assert row["state"] == "unblocked" and row["override"] == body["override"]
    stored = json.loads(get_setting_of(world, door_overrides.KEY))["entities"]["switch.gate"]
    assert stored["by"] == "dev-joni" and stored["note"] == "שער החצר של הדייר"
    [audit] = _audit(db, "intercom.door.entity_unblocked")
    assert (audit["decision"], audit["resource_type"], audit["resource_id"], audit["actor_user_id"]) == ("allowed", "ha_entity", "switch.gate", "dev-joni")
    assert audit["details"]["note"] == "שער החצר של הדייר" and audit["details"]["platform"] == "template" and audit["details"]["domain"] == "switch"
    assert audit["details"]["replaced"] is False and audit["at"]
    # the key is not a product setting: GET /settings never serves it
    assert door_overrides.KEY not in c.get(f"{API}/settings").json()["settings"]
    # the same entity again with another note replaces the first (and the audit row says so)
    again = _put(c, "switch.gate", True, "החלפת סיבה").json()
    assert again["override"]["note"] == "החלפת סיבה"
    last = _audit(db, "intercom.door.entity_unblocked")[-1]
    assert last["details"]["replaced"] is True and last["details"]["previous_note"] == "שער החצר של הדייר"


# ================================================================ the guards honour it for that entity only

def test_a_released_entity_is_judged_as_before_the_door_path_existed_and_every_other_stays_blocked(world):
    c, db = world["c"], world["db"]
    from smplwise.services import device_bulk

    assert _tile(db, "switch.gate", "switch.turn_on") == "door_steps_unresolvable"
    assert _tile(db, "lock.virtual", "lock.unlock") == "door_steps_unresolvable"
    assert _judge(db, "via_switch") == "door_steps_unresolvable"
    with db.connection(mode="read") as conn:
        assert "switch.gate" in door_path.possible_door_entities(conn)
        assert device_bulk.SwitchPolicy(conn).excluded_reason({"entity_id": "switch.gate", "domain": "switch"}) == "door_possible"
    _release(c, "switch.gate")
    assert _tile(db, "switch.gate", "switch.turn_on") is None, "the tile action of the released switch is judged no door"
    assert _tile(db, "switch.gate", "switch.toggle") is None
    assert _judge(db, "via_switch") is None, "a script that turns it on runs from Arx as before"
    with db.connection(mode="read") as conn:
        assert "switch.gate" not in door_path.possible_door_entities(conn)
        assert device_bulk.SwitchPolicy(conn).excluded_reason({"entity_id": "switch.gate", "domain": "switch"}) is None
        assert device_bulk.SwitchPolicy(conn).excluded_reason({"entity_id": "light.hall", "domain": "light"}) == "door_possible"
    # every other entity keeps its block - a template lock, a template light, a universal player, and a script through two entities
    assert _tile(db, "lock.virtual", "lock.unlock") == "door_steps_unresolvable"
    assert _tile(db, "light.hall", "light.turn_on") == "door_steps_unresolvable"
    assert _tile(db, "media_player.uni", "media_player.turn_on") == "door_steps_unresolvable"
    assert _judge(db, "via_lock") == "door_steps_unresolvable"
    assert _judge(db, "via_both") == "door_steps_unresolvable", "light.hall is still blocked"
    _release(c, "light.hall")
    assert _judge(db, "via_both") is None
    assert _judge(db, "via_lock") == "door_steps_unresolvable", "another entity's release frees nobody else"
    # the items list follows
    items = _items(c)
    assert items["script:via_switch"]["blocked"] is False and items["script:via_switch"]["devices"] == [{"name": "שער", "state": "unblocked"}]
    assert items["script:via_both"]["blocked"] is False
    assert items["script:via_lock"]["blocked"] is True
    assert c.get(BLOCKS).json()["counts"] == {"entities": 5, "blocked": 3, "unblocked": 2, "items": 5, "items_blocked": 3}


def test_a_template_lock_a_scene_member_and_a_button_follow_the_release_too(world):
    c, db = world["c"], world["db"]
    _entity(db, "button.tpl_press", "template")
    _entity(db, "scene.evening", None)
    with db.connection(mode="read") as conn:
        r = door_path.Resolver(conn)
        steps = [{"action": "button.press", "target": {"entity_id": "button.tpl_press"}}]
        assert [u.reason for u in r.resolve_actions(steps).unresolved] == ["template_button"]
        assert r.resolve_actions(steps).unresolved[0].entities == ("button.tpl_press",)
        scene = r.resolve_config("scene", {"entities": {"switch.gate": "on", "lock.virtual": {"state": "{{ 'unlocked' }}"}}})
        assert sorted(u.reason for u in scene.unresolved) == ["scene_state_unknown", "template_entity"]
        assert {e for u in scene.unresolved for e in u.entities} == {"switch.gate", "lock.virtual"}
    _release(c, "button.tpl_press", "switch.gate", "lock.virtual")
    with db.connection(mode="read") as conn:
        r = door_path.Resolver(conn)
        assert not r.resolve_actions(steps).has_door
        assert not r.resolve_config("scene", {"entities": {"switch.gate": "on", "lock.virtual": {"state": "{{ 'unlocked' }}"}}}).has_door
        assert not r.resolve_actions([{"action": "lock.unlock", "target": {"entity_id": "lock.virtual"}}]).has_door, "a released template lock is no door"
        assert not r.resolve_actions([{"action": "homeassistant.turn_on", "target": {"entity_id": "switch.gate"}}]).has_door
        # a target that cannot be expanded is still judged where a blocked entity of that domain exists (the cover, the light)
        assert r.resolve_actions([{"action": "cover.open_cover", "target": {"entity_id": "{{ states('input_text.x') }}"}}]).unresolved
        assert not r.resolve_actions([{"action": "switch.turn_on", "target": {"entity_id": "{{ states('input_text.x') }}"}}]).has_door, "every template switch is released"


def test_schedules_and_launcher_buttons_are_listed_and_freed_like_scripts(world):
    """The items of the list are every kind the door-path report covers: a schedule whose slot runs a template switch, and a home-screen
    launcher button that runs a script that does - each blocked until the device is released, then freed; the schedule with a real
    door step stays blocked."""
    c, db = world["c"], world["db"]
    rev = uuid.uuid4().hex[:16]
    with db.connection() as conn:
        for sid, name, actions in (
            ("s_gate", "שער בבוקר", [{"service": "switch.turn_on", "entity_id": "switch.gate", "service_data": {}}]),
            ("s_door", "כניסה בבוקר", [{"service": "lock.unlock", "entity_id": "lock.entrance", "service_data": {}}]),
        ):
            body = {"schedule_id": sid, "name": name, "weekdays": ["daily"], "repeat_type": "repeat", "timeslots": [{"start": "08:00:00", "stop": None, "actions": actions}]}
            conn.execute("INSERT INTO schedule_cache(schedule_id, entity_id, revision, item_json, enabled, seen_at, changed_at) VALUES (?,?,?,?,?,?,?)",
                         (sid, f"switch.schedule_{sid}", rev, json.dumps(body, ensure_ascii=False), 0, now_iso(), now_iso()))
        set_setting(conn, "home.widgets", json.dumps({"launcher": {"on": True, "items": [{"kind": "script", "id": "script.via_switch", "label": "כפתור שער"}]}}))
    items = _items(c)
    assert {"schedule:s_gate", "schedule:s_door", "launcher:0"} <= set(items)
    assert items["schedule:s_gate"]["kind"] == "schedule" and items["schedule:s_gate"]["blocked"] is True and items["schedule:s_gate"]["devices"] == [{"name": "שער", "state": "blocked"}]
    assert items["launcher:0"]["name"] == "כפתור שער" and items["launcher:0"]["blocked"] is True
    assert items["schedule:s_door"]["opens_door"] is True
    _release(c, "switch.gate")
    items = _items(c)
    assert items["schedule:s_gate"]["blocked"] is False and items["launcher:0"]["blocked"] is False
    assert items["schedule:s_gate"]["devices"] == [{"name": "שער", "state": "unblocked"}]
    assert items["schedule:s_door"]["blocked"] is True and items["schedule:s_door"]["opens_door"] is True


def test_the_editors_follow_the_release_but_still_refuse_a_new_real_door_step(world):
    c, db = world["c"], world["db"]
    new_step = {"alias": "x", "sequence": [TURN_ON_GATE]}
    with db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_path_guard.check_config(conn, "script", new_step, None)
        assert exc.value.code == "wiskey_door_step_blocked" and exc.value.details["reason"] == "possible_door"
    _release(c, "switch.gate")
    with db.connection(mode="read") as conn:
        door_path_guard.check_config(conn, "script", new_step, None)  # a save with a released entity's step is accepted
        with pytest.raises(ApiError) as exc:
            door_path_guard.check_config(conn, "script", {"alias": "y", "sequence": [TURN_ON_GATE, UNLOCK]}, None)
        assert exc.value.code == "wiskey_door_step_blocked" and "lock.entrance" in exc.value.details["entities"]
        with pytest.raises(ApiError):
            door_path_guard.check_config(conn, "script", {"alias": "z", "sequence": [TURN_ON_HALL]}, None)  # another entity: still blocked


def test_a_schedule_slot_follows_the_release(world):
    c, db = world["c"], world["db"]
    item = {"name": "שער בבוקר", "timeslots": [{"actions": [{"service": "switch.turn_on", "entity_id": "switch.gate", "service_data": {}}]}]}
    with db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_schedule_slot(conn, "s1", item, 0)
        assert exc.value.code == "door_steps_unresolvable"
        with pytest.raises(ApiError):
            door_run_guard.judge_enable_schedule(conn, item)
    _release(c, "switch.gate")
    with db.connection(mode="read") as conn:
        door_run_guard.judge_schedule_slot(conn, "s1", item, 0)
        door_run_guard.judge_enable_schedule(conn, item)


# ================================================================ a release never bypasses a block

def test_an_item_with_a_real_door_step_keeps_its_refusal_and_its_message_whatever_is_released(world):
    c, db = world["c"], world["db"]
    _release(c, "switch.gate", "light.hall", "lock.virtual", "cover.shutter", "media_player.uni")  # every blocked entity there is
    with db.connection(mode="read") as conn:
        for item_id in ("door_script", "mixed"):
            with pytest.raises(ApiError) as exc:
                door_run_guard.judge_item(conn, "script", item_id)
            assert exc.value.code == "door_step_not_converted" and exc.value.user_message == door_run_guard.NOT_CONVERTED, item_id
            assert exc.value.status == 409
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_entity_action(conn, "script.mixed", "script.turn_on")
        assert exc.value.code == "door_step_not_converted"
        # enabling: the same refusal and its own message (switching it off stays allowed)
        item = {"name": "דלת", "timeslots": [{"actions": [{"service": "lock.unlock", "entity_id": "lock.entrance", "service_data": {}}]}]}
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_enable_schedule(conn, item)
        assert exc.value.code == "door_step_not_converted" and exc.value.user_message == door_run_guard.ENABLE_NOT_CONVERTED
        inv = {i["key"]: i for i in door_path.inventory(conn)["items"]}
        assert inv["script:door_script"]["run_guard"] == "refused_not_converted" and inv["script:mixed"]["run_guard"] == "refused_not_converted"
        assert "script:via_switch" not in inv, "the entity-only items left the report once their device was released"
        # the add-on's own block of `execute` for a WisKey door is a different layer and is untouched
        assert door_execute_guard.refusal(conn, "lock", {"entity_id": "lock.entrance"}) == "wiskey_platform"
        assert door_execute_guard.refusal(conn, "lock", {"entity_id": "lock.virtual"}) is None, "it never judged templates; a release does not change that"
    items = _items(c)
    assert items["script:door_script"]["blocked"] is True and items["script:mixed"]["blocked"] is True
    assert items["script:mixed"]["opens_door"] is True
    assert items["script:mixed"]["devices"] == [{"name": "שער", "state": "unblocked"}], "the mixed item shows its released device AND stays blocked"
    assert items["script:via_switch"]["blocked"] is False


def test_no_other_unresolved_reason_is_released(world):
    c, db = world["c"], world["db"]
    _release(c, "switch.gate", "light.hall", "lock.virtual", "cover.shutter", "media_player.uni")
    with db.connection(mode="read") as conn:
        r = door_path.Resolver(conn)
        computed_service = r.resolve_actions([{"action": "{{ states('input_text.svc') }}", "target": {"entity_id": "switch.plain"}}])
        assert [u.reason for u in computed_service.unresolved] == ["template_service"]
        computed_lock = r.resolve_actions([{"action": "lock.unlock", "target": {"entity_id": "{{ states('input_text.door') }}"}}])
        assert [u.reason for u in computed_lock.unresolved] == ["template_target"]
        label = r.resolve_actions([{"action": "lock.unlock", "target": {"label_id": "doors"}}])
        assert [u.reason for u in label.unresolved] == ["label_target"]
        unknown = r.resolve_actions([{"action": "lock.unlock", "target": {"entity_id": "lock.never_heard_of"}}])
        assert [u.reason for u in unknown.unresolved] == ["unknown_entity"]
        assert all(u.entities == () for res in (computed_service, computed_lock, label, unknown) for u in res.unresolved), "nothing to release behind them"
        scene_step = r.resolve_actions([{"action": "scene.turn_on", "target": {"entity_id": "scene.never_heard_of"}}])
        assert [u.reason for u in scene_step.unresolved] == ["unknown_item"]


def test_a_wiskey_lock_an_ordinary_entity_and_a_mapped_entity_cannot_be_released(world):
    c, db = world["c"], world["db"]
    for eid, reason in (("lock.entrance", "wiskey_door"), ("lock.office", "not_blocked"), ("switch.plain", "not_blocked")):
        r = _put(c, eid, True)
        assert r.status_code == 409 and r.json()["code"] == "not_overridable" and r.json()["details"]["reason"] == reason, (eid, r.text)
    r = _put(c, "switch.nowhere", True)
    assert r.status_code == 404 and r.json()["code"] == "entity_not_found"
    _entity(db, "lock.removed_one", "template", removed=True)
    assert _put(c, "lock.removed_one", True).status_code == 404, "a tombstoned entity is not there"
    # an entity the administrator mapped to an intercom door is a known door: refused, with its own words
    _door_map(db, "lock.virtual", relay=2)
    r = _put(c, "lock.virtual", True)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "door_mapped", r.text
    assert _entities(c)["lock.virtual"]["state"] == "door" and _entities(c)["lock.virtual"]["overridable"] is False
    assert get_setting_of(world, door_overrides.KEY) is None
    refusals = [a for a in _audit(db, "intercom.door.entity_unblocked") if a["decision"] == "denied"]
    assert [a["reason"] for a in refusals] == ["wiskey_door", "not_blocked", "not_blocked", "unknown_entity", "unknown_entity", "door_mapped"], "every refused attempt is audited with its reason"


def test_a_release_written_before_an_entity_became_a_mapped_door_is_not_honoured(world):
    c, db = world["c"], world["db"]
    _release(c, "lock.virtual")
    assert _judge(db, "via_lock") is None
    _door_map(db, "lock.virtual", relay=2)  # the administrator maps it to an intercom door afterwards
    assert _judge(db, "via_lock") == "door_steps_unresolvable", "a known door is never 'not provably a door'"
    assert _tile(db, "lock.virtual", "lock.unlock") == "door_steps_unresolvable"
    with db.connection(mode="read") as conn:
        assert "lock.virtual" in door_overrides.unblocked_ids(conn), "the stored release is still there; the guard simply does not honour it"
    rows = _entities(c)
    assert rows["lock.virtual"]["state"] == "door" and rows["lock.virtual"]["override"] is not None and rows["lock.virtual"]["overridable"] is False


def test_a_damaged_or_hand_edited_store_releases_nothing(world):
    c, db = world["c"], world["db"]
    good = {"note": "סיבה תקפה", "by": "dev-x", "by_name": "x", "at": "2026-10-13T08:00:00Z"}
    broken: list[str] = [
        "not json at all",
        "[]",
        json.dumps({"entities": []}),
        json.dumps({"entities": {"switch.gate": "yes"}}),
        json.dumps({"entities": {"switch.gate": {"by": "dev-x"}}}),  # no note: the reason it exists is missing
        json.dumps({"entities": {"switch.gate": {"note": "ab"}}}),  # too short
        json.dumps({"entities": {"Switch.Gate": good, "nodot": good, "switch.gate; drop": good, "": good}}),  # not entity ids
        json.dumps({"unrelated": {"switch.gate": good}}),
    ]
    for text in broken:
        with db.connection() as conn:
            set_setting(conn, door_overrides.KEY, text)
        assert _judge(db, "via_switch") == "door_steps_unresolvable", text
        assert _entities(c)["switch.gate"]["state"] == "blocked", text
    with db.connection() as conn:
        set_setting(conn, door_overrides.KEY, json.dumps({"entities": {"switch.gate": good, "light.hall": {"note": "x"}}}))
    assert _judge(db, "via_switch") is None, "a well-formed entry counts"
    assert _tile(db, "light.hall", "light.turn_on") == "door_steps_unresolvable", "its neighbour without a valid note does not"


# ================================================================ reversible

def test_blocking_again_reverses_the_release_everywhere_and_is_audited(world):
    c, db = world["c"], world["db"]
    _release(c, "switch.gate")
    assert _judge(db, "via_switch") is None and _tile(db, "switch.gate", "switch.turn_on") is None
    r = _put(c, "switch.gate", False, "הסיבה כבר לא נכונה")
    assert r.status_code == 200 and r.json() == {"entity_id": "switch.gate", "state": "blocked", "override": None, "changed": True}
    assert _judge(db, "via_switch") == "door_steps_unresolvable"
    assert _tile(db, "switch.gate", "switch.turn_on") == "door_steps_unresolvable"
    with db.connection(mode="read") as conn:
        assert "switch.gate" in door_path.possible_door_entities(conn)
    row = _entities(c)["switch.gate"]
    assert row["state"] == "blocked" and row["override"] is None
    [back] = _audit(db, "intercom.door.entity_reblocked")
    assert back["decision"] == "allowed" and back["resource_id"] == "switch.gate" and back["actor_user_id"] == "dev-joni"
    assert back["details"]["released_note"] == "בדיקה ידנית של התקן" and back["details"]["released_by"] == "dev-joni" and back["details"]["note"] == "הסיבה כבר לא נכונה"
    # blocking something that is not released is a no-op: nothing is written or audited
    again = _put(c, "switch.gate", False)
    assert again.status_code == 200 and again.json()["changed"] is False
    assert len(_audit(db, "intercom.door.entity_reblocked")) == 1
    # and it can be released again, as many times as the administrator decides
    _release(c, "switch.gate")
    assert _judge(db, "via_switch") is None
    assert len(_audit(db, "intercom.door.entity_unblocked")) == 2
    # blocking again needs no note and takes the confirmation like every switch
    assert _put(c, "switch.gate", False, None, confirmed=None).status_code == 409
    assert _put(c, "switch.gate", False, None).status_code == 200
    assert _judge(db, "via_switch") == "door_steps_unresolvable"


def test_a_stale_release_is_listed_so_it_can_be_taken_back(world):
    c, db = world["c"], world["db"]
    _release(c, "switch.gate")
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = 'switch.gate'", (now_iso(),))  # the entity left Home Assistant
    row = _entities(c)["switch.gate"]
    assert row["stale"] is True and row["state"] == "unblocked" and row["override"]["note"] and row["overridable"] is True
    assert _put(c, "switch.gate", False).json()["changed"] is True, "taking it back needs no live entity"
    assert "switch.gate" not in _entities(c)


def test_the_passive_template_entities_are_not_listed_unless_they_hold_a_release(world):
    c, db = world["c"], world["db"]
    assert "sensor.tpl_temp" not in _entities(c)
    r = _put(c, "sensor.tpl_temp", True)
    assert r.status_code == 200, "it is still a blocked entity the guards can name; the list only spares the administrator the noise"
    assert _entities(c)["sensor.tpl_temp"]["state"] == "unblocked"


def test_the_list_is_limited(world, monkeypatch):
    c = world["c"]
    monkeypatch.setattr(door_overrides, "MAX_ENTRIES", 2)
    _release(c, "switch.gate", "light.hall")
    r = _put(c, "cover.shutter", True)
    assert r.status_code == 409 and r.json()["code"] == "too_many_overrides"
    assert _put(c, "switch.gate", True, "החלפה").status_code == 200, "replacing a release is not a new one"
    monkeypatch.setattr(door_blocks, "MAX_ENTITIES", 3)
    data = c.get(BLOCKS).json()
    assert data["truncated"] is True
    assert [e["entity_id"] for e in data["entities"]] == ["light.hall", "lock.virtual", "media_player.uni", "switch.gate"], "cut by the limit - except the two releases, which are always listed"
    assert all(not e["stale"] for e in data["entities"]), "a release whose entity the limit cut is not stale"


def test_the_report_of_items_that_open_doors_stays_names_only(world):
    c = world["c"]
    _release(c, "switch.gate")
    r = c.get(f"{API}/intercom/door-path-inventory")
    assert r.status_code == 200
    text = r.text
    assert "_entities" not in text and "switch.gate" not in text and "lock.entrance" not in text and "lock.virtual" not in text
    keys = {i["key"] for i in r.json()["items"]}
    assert {"script:door_script", "script:mixed"} <= keys


# ================================================================ through the real routes (the CR-017 automations world)

@pytest.fixture()
def autos(autos_app, monkeypatch):
    """The CR-017 automations world: a WisKey door (script `door_script` opens it), a template switch and light, and DISABLED
    automations that call the door script, the template switch, the template light, or a plain light; nothing is executed."""
    from smplwise.services import automations

    app, s, c, fake, tr = autos_app
    FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda *a, **k: pytest.fail("nothing is executed here"))
    for eid, platform in (("lock.entrance", "hikvision_intercom"), ("switch.gate", "template"), ("light.hall", "template")):
        fake.states[eid] = {"entity_id": eid, "state": "locked" if eid.startswith("lock.") else "off", "attributes": {"friendly_name": eid.split(".")[1]}, "last_changed": fake.iso()}
        fake.registry.append(fake._reg_row(eid, platform=platform, unique_id=f"uid_{eid.split('.')[1]}"))
    door_script = {"alias": "פתיחת שער", "sequence": [UNLOCK]}
    fake.scripts["door_script"] = door_script
    fake._seed_script_entity("door_script", door_script)

    def auto(cid: str, alias: str, actions: list[dict[str, Any]]) -> None:
        fake._seed_automation(f"automation.a_{cid}", cid, {"id": cid, "alias": alias, "mode": "single", "triggers": [{"trigger": "time", "at": "06:00:00"}], "conditions": [], "actions": actions}, False)

    auto("9101", "שער וירטואלי", [TURN_ON_GATE])
    auto("9102", "מבואה וירטואלית", [TURN_ON_HALL])
    auto("9103", "הדלת בעצמה", [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}])
    auto("9104", "הדלת ושער", [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}, TURN_ON_GATE])
    auto("9105", "אורות בלבד", [{"action": "light.turn_on", "target": {"entity_id": "light.plain"}}])
    seed_mirror(app.state.db, fake)
    with app.state.db.connection() as conn:
        _door_map_conn(conn, "lock.entrance")
    automations.MIRROR.pull(None, "test")
    return {"app": app, "c": c, "tr": tr}


def _door_map_conn(conn: Any, eid: str) -> None:
    conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,1,'manual','test',?)", (eid, ENTRY, now_iso()))


def _toggle(c: Any, cid: str, op: str) -> Any:
    return c.post(f"{API}/automations/automation/{cid}/{op}", json={"client_request_id": f"un-{uuid.uuid4().hex[:10]}", "confirm": True})


def test_enabling_an_automation_follows_the_release_of_its_virtual_device_and_never_of_its_door(autos):
    c, tr = autos["c"], autos["tr"]
    gate = _toggle(c, "9101", "enable")
    assert gate.status_code == 409 and gate.json()["code"] == "door_steps_unresolvable" and gate.json()["user_message"] == door_run_guard.ENABLE_UNRESOLVABLE, gate.text
    assert _toggle(c, "9102", "enable").json()["code"] == "door_steps_unresolvable"
    door = _toggle(c, "9103", "enable")
    assert door.status_code == 409 and door.json()["code"] == "door_step_not_converted" and door.json()["user_message"] == door_run_guard.ENABLE_NOT_CONVERTED
    assert _toggle(c, "9105", "enable").status_code == 200, "an item that touches nothing blocked enables as before"
    # releasing the switch frees the automation that only used the switch - and nothing else
    assert _put(c, "switch.gate", True).status_code == 200
    assert _toggle(c, "9101", "enable").status_code == 200
    assert _toggle(c, "9102", "enable").json()["code"] == "door_steps_unresolvable", "the template light is still blocked"
    both = _toggle(c, "9104", "enable")
    assert both.status_code == 409 and both.json()["code"] == "door_step_not_converted" and both.json()["user_message"] == door_run_guard.ENABLE_NOT_CONVERTED, "the door step in it is not released"
    # every blocked entity released: the door automations are refused all the same, with the same message
    assert _put(c, "light.hall", True).status_code == 200
    assert _toggle(c, "9102", "enable").status_code == 200
    for cid in ("9103", "9104"):
        r = _toggle(c, cid, "enable")
        assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted" and r.json()["user_message"] == door_run_guard.ENABLE_NOT_CONVERTED, (cid, r.text)
    # blocking the switch again: it cannot be enabled again (disabling is always allowed)
    assert _toggle(c, "9101", "disable").status_code == 200
    assert _put(c, "switch.gate", False).status_code == 200
    assert _toggle(c, "9101", "enable").json()["code"] == "door_steps_unresolvable"
    ops = [(b.get("op"), str(b.get("item_id"))) for b in tr.bridge_calls if b.get("op") in ("enable", "disable")]
    assert ops == [("enable", "9105"), ("enable", "9101"), ("enable", "9102"), ("disable", "9101")], "only the allowed ones reached the bridge"


# ================================================================ DOOR-BLOCKS-I18N-2510: the blocks screen and the run guard in the reader's language

HEB = re.compile(r"[֐-׿]")
BLOCK_TEXT_KEYS = ("kind_text", "guard", "why", "reasons")
REPO = Path(__file__).resolve().parents[3]
SMPLWISE = REPO / "smplwise_vms" / "backend" / "smplwise"
# the Hebrew the screen and the refusals answered before DOOR-BLOCKS-I18N-2510, byte for byte (the old literals / f-strings, spelled out)
OLD_NOT_YET = "פתיחת דלתות מאוטומציה עדיין לא נתמכת"
OLD_NOT_CONVERTED = "לא ניתן להריץ: הפריט פותח דלת של בקרת הכניסה. פתיחת דלתות מאוטומציה עדיין לא נתמכת."
OLD_UNRESOLVABLE = "לא ניתן להריץ: ייתכן שהפריט פותח דלת של בקרת הכניסה. פתיחת דלתות מאוטומציה עדיין לא נתמכת."
OLD_ENABLE_NOT_CONVERTED = "לא ניתן להפעיל: הפריט פותח דלת של בקרת הכניסה. פתיחת דלתות מאוטומציה עדיין לא נתמכת; אפשר לכבות אותו."
OLD_ENABLE_UNRESOLVABLE = "לא ניתן להפעיל: ייתכן שהפריט פותח דלת של בקרת הכניסה. פתיחת דלתות מאוטומציה עדיין לא נתמכת; אפשר לכבות אותו."
OLD_REFUSALS = {
    "unknown_entity": "ההתקן לא נמצא.",
    "wiskey_door": "מנעול אינטרקום הוא דלת ואינו ניתן לשחרור.",
    "door_mapped": "ההתקן משויך לדלת אינטרקום ואינו ניתן לשחרור. אפשר לבטל קודם את השיוך.",
    "not_blocked": "ההתקן אינו חסום.",
}
OLD_NOTE_ERRORS = {
    "note_required": "נדרשת סיבה לשחרור (לפחות 3 תווים).",
    "note_too_long": f"הסיבה ארוכה מדי (עד {door_overrides.NOTE_MAX} תווים).",
    "bad_entity": "מזהה ההתקן אינו תקין.",
    "too_many": f"אי אפשר לשחרר יותר מ-{door_overrides.MAX_ENTRIES} התקנים.",
}


def _blocks_machine(value: Any) -> Any:
    """The blocks answer without its words: what must not change with the reader's language."""
    if isinstance(value, dict):
        return {k: _blocks_machine(v) for k, v in value.items() if k not in BLOCK_TEXT_KEYS and k != "generated_at"}
    if isinstance(value, list):
        return [_blocks_machine(v) for v in value]
    return value


def _item_words(data: dict[str, Any]) -> list[Any]:
    return [[i[k] for k in BLOCK_TEXT_KEYS] for i in data["items"]]


def _he_to_en(*namespaces: str) -> dict[str, str]:
    from smplwise.i18n import CATALOGUE

    return {e["he"]: e["en"] for k, e in CATALOGUE.items() if k.split(".", 1)[0] in namespaces and "{" not in e["he"]}


def _refusal(c: TestClient, entity_id: str, note: str | None = "בדיקה ידנית של התקן") -> tuple[int, str]:
    r = _put(c, entity_id, True, note)
    return r.status_code, r.json()["user_message"]


def test_door_blocks_i18n_2510_hebrew_unchanged_english_for_an_english_reader(world):
    """`GET /doors/blocks` in Hebrew exactly as before for a reader without a stored language (the route's Hebrew = the service's string
    for string), in English for an English reader: an item's kind, run-guard sentence, "why it stays" (`door_run_guard.NOT_YET`) and
    unresolved reasons, and the refusals of a release. Names, areas and release notes are data and stay as stored."""
    c, db = world["c"], world["db"]
    _release(c, "cover.shutter")  # a release note is data
    he = c.get(BLOCKS).json()
    items = {i["key"]: i for i in he["items"]}
    door, via_switch = items["script:door_script"], items["script:via_switch"]
    assert door["kind_text"] == "סקריפט" and door["guard"] == "הרצה מ-Arx נחסמת: יש בפריט פתיחת דלת שלא הוסבה" and door["why"] == OLD_NOT_YET
    assert via_switch["why"] is None and via_switch["guard"] == "הרצה מ-Arx נחסמת: לא ניתן לזהות את הדלתות בפריט" and via_switch["reasons"]
    assert all(HEB.search(r) for i in he["items"] for r in i["reasons"])
    with db.connection(mode="read") as conn:
        svc = door_blocks.listing(conn)
    assert _blocks_machine(svc) == _blocks_machine(he) and _item_words(svc) == _item_words(he), "the route's Hebrew is the service's Hebrew"
    for code, old in OLD_REFUSALS.items():
        assert door_blocks.REFUSALS[code][2] == old, code
    for code, old in OLD_NOTE_ERRORS.items():
        assert door_blocks.NOTE_ERRORS[code] == old, code
    assert _refusal(c, "lock.entrance") == (409, OLD_REFUSALS["wiskey_door"])
    assert _refusal(c, "switch.gate", "ab") == (422, OLD_NOTE_ERRORS["note_required"])

    # an English reader
    assert c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    en = c.get(BLOCKS).json()
    assert _blocks_machine(en) == _blocks_machine(he), "only the words change: keys, states, counts, names, devices, releases"
    e_items = {i["key"]: i for i in en["items"]}
    door, via_switch = e_items["script:door_script"], e_items["script:via_switch"]
    assert door["kind_text"] == "Script" and door["why"] == "Opening doors from an automation is not supported yet"
    assert door["guard"] == "Run blocked from Arx: the item has a door opening that was not converted"
    assert via_switch["guard"] == "Run blocked from Arx: the doors in the item cannot be identified" and via_switch["why"] is None
    words = _he_to_en("doorpath", "doorguard")
    for h_item, e_item in zip(he["items"], en["items"]):
        for k in ("kind_text", "guard", "why"):
            assert e_item[k] == (words[h_item[k]] if h_item[k] is not None else None), (h_item["key"], k)
        assert e_item["reasons"] == [words[r] for r in h_item["reasons"]], h_item["key"]
    left = [(i["key"], k) for i in en["items"] for k in BLOCK_TEXT_KEYS for s in ([i[k]] if k != "reasons" else i[k]) if s and HEB.search(s)]
    assert left == [], left
    assert en["entities"] == he["entities"], "entity rows are data (names, areas, release notes): unchanged"
    # the refusals of a release, through the error envelope
    assert _refusal(c, "lock.entrance") == (409, "An intercom lock is a door and cannot be released.")
    assert _refusal(c, "switch.plain") == (409, "The device is not blocked.")
    assert _refusal(c, "switch.nowhere") == (404, "The device was not found.")
    assert _refusal(c, "switch.gate", "ab") == (422, "A reason for the release is required (at least 3 characters).")
    assert _refusal(c, "switch.gate", "א" * (door_overrides.NOTE_MAX + 1)) == (422, f"The reason is too long (up to {door_overrides.NOTE_MAX} characters).")
    assert _refusal(c, "Switch.Gate") == (422, "The device ID is not valid.")
    assert door_blocks.NOTE_ERRORS["too_many"].render("en") == f"No more than {door_overrides.MAX_ENTRIES} devices can be released."
    # the run guard's refusals, as the error envelope answers them
    with db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "script", "door_script")
        assert exc.value.payload("cid", "he")["user_message"] == OLD_NOT_CONVERTED
        assert exc.value.payload("cid", "en")["user_message"] == "Cannot run: the item opens an access-control door. Opening doors from an automation is not supported yet."
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "script", "via_switch")
        assert exc.value.payload("cid", "he")["user_message"] == OLD_UNRESOLVABLE
        assert exc.value.payload("cid", "en")["user_message"] == "Cannot run: the item may open an access-control door. Opening doors from an automation is not supported yet."
    # back to Hebrew: the same answer as before
    assert c.put(f"{API}/me/prefs", json={"ui.lang": "he"}).status_code == 200
    assert _refusal(c, "switch.plain") == (409, OLD_REFUSALS["not_blocked"])
    again = c.get(BLOCKS).json()
    assert _blocks_machine(again) == _blocks_machine(he) and _item_words(again) == _item_words(he)
    # an entity mapped to an intercom door: its own refusal, in each language
    _door_map(db, "lock.virtual", relay=2)
    assert _refusal(c, "lock.virtual") == (409, OLD_REFUSALS["door_mapped"])
    assert c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    assert _refusal(c, "lock.virtual") == (409, "The device is mapped to an intercom door and cannot be released. You can remove the mapping first.")


def test_door_blocks_i18n_2510_the_enable_refusal_reaches_an_english_reader_in_english(autos):
    """Through the real automations route: the enable refusal of an item that opens a door (`door_run_guard.ENABLE_*`, built around
    `NOT_YET`) answers the old Hebrew, and an English reader the English sentence; the blocks screen's "why" follows the reader too."""
    c = autos["c"]
    assert _toggle(c, "9103", "enable").json()["user_message"] == OLD_ENABLE_NOT_CONVERTED
    assert _toggle(c, "9101", "enable").json()["user_message"] == OLD_ENABLE_UNRESOLVABLE
    assert c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    door = _toggle(c, "9103", "enable")
    assert door.status_code == 409 and door.json()["code"] == "door_step_not_converted"
    assert door.json()["user_message"] == "Cannot turn on: the item opens an access-control door. Opening doors from an automation is not supported yet; it can be turned off."
    gate = _toggle(c, "9101", "enable")
    assert gate.status_code == 409 and gate.json()["code"] == "door_steps_unresolvable"
    assert gate.json()["user_message"] == "Cannot turn on: the item may open an access-control door. Opening doors from an automation is not supported yet; it can be turned off."
    rows = {i["key"]: i for i in c.get(BLOCKS).json()["items"]}
    assert rows["automation:9103"]["why"] == "Opening doors from an automation is not supported yet" and rows["automation:9103"]["kind_text"] == "Automation"


def test_door_blocks_i18n_2510_every_text_has_a_key_and_no_hebrew_literal_is_left():
    """The missing-key scan of this pass: every `doorguard.*` / `doorblocks.*` key has Hebrew and English (no Hebrew letter in the
    English, the same slots); every text door_run_guard.py and door_blocks.py answer is a `Msg` of its key whose string is the old Hebrew;
    a drifted Hebrew is refused at import; no Hebrew literal is left in those modules outside the catalogue (docstrings aside); and
    "חלון פתיחה" has ONE English word - "door window" - in the door preview, the frontend's hand-over sentences and the default name."""
    import ast

    from smplwise.i18n import CATALOGUE, Msg
    from smplwise.services import default_names
    from smplwise.services import door_conversion_text as dct

    slot = re.compile(r"\{(\w+)\}")
    keys = [k for k in CATALOGUE if k.split(".", 1)[0] in ("doorguard", "doorblocks")]
    assert len(keys) == len(dct.DOOR_GUARD) + len(dct.DOOR_BLOCKS) and len(keys) == 16
    for k in keys:
        e = CATALOGUE[k]
        assert e["he"] and e["en"] and not HEB.search(e["en"]), k
        assert sorted(slot.findall(e["he"])) == sorted(slot.findall(e["en"])), k
    guard = {"not_yet": (door_run_guard.NOT_YET, OLD_NOT_YET), "not_converted": (door_run_guard.NOT_CONVERTED, OLD_NOT_CONVERTED),
             "unresolvable": (door_run_guard.UNRESOLVABLE, OLD_UNRESOLVABLE),
             "enable_not_converted": (door_run_guard.ENABLE_NOT_CONVERTED, OLD_ENABLE_NOT_CONVERTED),
             "enable_unresolvable": (door_run_guard.ENABLE_UNRESOLVABLE, OLD_ENABLE_UNRESOLVABLE),
             "no_permission": (door_run_guard.NO_PERMISSION, "אין הרשאה לפתוח דלת זו"),
             "use_automations": (door_run_guard.USE_AUTOMATIONS, "הפריט כולל פתיחת דלת; מפעילים אותו ממסך האוטומציות."),
             "station_unavailable": (door_run_guard.STATION_UNAVAILABLE, "התחנה לא זמינה")}
    assert sorted(guard) == sorted(dct.DOOR_GUARD)
    for name, (m, old) in guard.items():
        assert isinstance(m, Msg) and m.key == f"doorguard.{name}" and str.__str__(m) == old and m.render("he") == old, name
        assert not HEB.search(m.render("en")), name
    for code, (_status, _code, m) in door_blocks.REFUSALS.items():
        assert isinstance(m, Msg) and m.key == f"doorblocks.refuse.{code}" and m == OLD_REFUSALS[code], code
    for code, m in door_blocks.NOTE_ERRORS.items():
        assert isinstance(m, Msg) and m.key == f"doorblocks.note.{code}" and m == OLD_NOTE_ERRORS[code], code
    assert {f"refuse.{c}" for c in door_blocks.REFUSALS} | {f"note.{c}" for c in door_blocks.NOTE_ERRORS} == set(dct.DOOR_BLOCKS)
    with pytest.raises(ValueError):
        dct.as_msg("doorguard.not_yet", "פתיחת דלתות מאוטומציה לא נתמכת")  # a drifted Hebrew word: refused
    # no Hebrew literal left outside the catalogue's words
    allowed = {e["he"] for k, e in CATALOGUE.items() if k.split(".", 1)[0] in ("doorguard", "doorblocks", "doorpath", "doorconv")}
    for rel in ("services/door_run_guard.py", "services/door_blocks.py"):
        tree = ast.parse((SMPLWISE / rel).read_text(encoding="utf-8"))
        docs = {id(n.body[0].value) for n in ast.walk(tree) if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)) and n.body
                and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
        left = [n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, str) and HEB.search(n.value)
                and id(n) not in docs and n.value not in allowed]
        assert left == [], (rel, left)
    # "חלון פתיחה" = "door window": the default name, the frontend's feature catalogue, the preview's English and its frontend sentences
    assert default_names.name("door_window", "en") == "Door window"
    assert "Door windows" in (REPO / "frontend" / "src" / "i18n" / "lang" / "en" / "i18n" / "door-windows.ts").read_text(encoding="utf-8")
    door_en = [e["en"] for k, e in CATALOGUE.items() if k.split(".", 1)[0] in ("doorconv", "doorpath", "doorguard", "doorblocks")]
    assert not [s for s in door_en if "opening window" in s.lower()], "one English word for a door window"
    assert CATALOGUE["doorconv.action.hand_over_program"]["en"] == "Move to a fixed door window"
    fe = (REPO / "frontend" / "src" / "i18n" / "lang" / "en" / "i18n" / "msg" / "system-a.ts").read_text(encoding="utf-8")
    assert "'העברה לחלון פתיחה קבוע': 'Move to a fixed door window'," in fe and "'הועבר לחלון פתיחה': 'Moved to a door window'," in fe
    assert "opening window" not in fe.lower()
    # DOOR-WINDOW-TERM-2510: the role names, the permission descriptions and the notification event names say "door window" too;
    # their Hebrew is unchanged (the import-time checks of rbac_text / rbac_admin_text / notify_policy_text compare it to the old words)
    pinned = {
        "role.door_windows_manager": ("ניהול חלונות פתיחה", "Manage door windows"),
        "role.door_windows_guard": ("הפסקת חלון פתיחה", "Stop a door window"),
        "perm.access.windows.manage": ("בקרת כניסה: ניהול חלונות פתיחה של דלתות (שעות פתיחה מתוזמנות)",
                                       "Access control: manage door windows (scheduled opening hours)"),
        "perm.access.windows.cancel": ("בקרת כניסה: הפסקת חלון פתיחה פעיל ואימות ידני שהדלת חזרה למצב רגיל",
                                       "Access control: stop an active door window and confirm by hand that the door returned to normal"),
        "notify.label.door.relock_unconfirmed": ("חלון פתיחה: חזרה למצב רגיל לא אושרה", "Door window: return to normal not confirmed"),
        "notify.label.door.window_not_started": ("חלון פתיחה לא התחיל", "Door window did not start"),
        "notify.label.door.window_overridden": ("חלון פתיחה הופסק ידנית", "Door window stopped manually"),
        "notify.label.door.windows.simulated": ("חלון פתיחה לפי אירוע (מצב הדגמה)", "Door window by event (demo mode)"),
    }
    for key, (he, en) in pinned.items():
        assert (CATALOGUE[key]["he"], CATALOGUE[key]["en"]) == (he, en), key
    assert not [k for k, e in CATALOGUE.items() if "opening window" in e["en"].lower()], "one English word for a door window"
