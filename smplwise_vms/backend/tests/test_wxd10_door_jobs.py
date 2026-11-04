"""WXD10A (CR-033 D10a: Arx event door jobs (M1), disable-and-list) and WXD10B (D10b: hold-open program hand-over (M3)) - built and
tested on FAKES only (services/door_conversion.py, routes in routers/doors.py, migration 0205).

The lab inventory of 2026-11-04 (WXD7R) found NO saved item that opens a WisKey door; the owner decided the same day to build both
slices anyway. So the empty case is tested first, then synthetic items of each kind: an event-driven automation, a script, a
schedule and an item whose doors cannot be resolved ("unknown").

Worlds: the CR-017 automations world (FakeHaConfig behind the REAL bridge code) and the CR-014 scheduler fake, each with one fake
WisKey station whose relay 1 is mapped to a WisKey lock entity. Nothing here reaches a real Home Assistant, WisKey, station, door,
lock or relay: the interim door transport and the bridge's `execute` fail the test if anything calls them."""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

import fake_scheduler
import pytest
from automations_fixture import autos_app  # noqa: F401  (the CR-017 fixture)
from automations_transport import seed_mirror
from fake_trusted_bridge import FakeWisKeyFeed, station
from schedules_fixture import post_json, rid, sched_app  # noqa: F401  (the CR-014 fixture)

from smplwise.db import now_iso
from smplwise.routers import access_control
from smplwise.services import door_conversion, door_run_guard, ha_client, intercom_sync

ENTRY = "01JTESTSTATIONENTRY000000A"
API = "/api/v1"
CONV = f"{API}/intercom/door-path-conversion"
SMPLWISE = Path(__file__).resolve().parents[1] / "smplwise"


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)


def _no_door_commands(monkeypatch: Any, feed: FakeWisKeyFeed | None = None) -> None:
    """Every way a door could be opened from the add-on fails the test."""
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda *a, **k: pytest.fail("nothing is executed by the conversion"))
    monkeypatch.setattr(access_control, "open_door", lambda *a, **k: pytest.fail("no door is opened by the conversion"))
    if feed is not None:
        monkeypatch.setattr(intercom_sync.SYNC, "action", lambda *a, **k: pytest.fail("no WisKey command is sent by the conversion"))


def _door_map(conn: Any, eid: str) -> None:
    conn.execute("INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at) VALUES (?,?,1,'manual','test',?)", (eid, ENTRY, now_iso()))


def _switch(c: Any, on: bool) -> None:
    r = c.put(f"{API}/doors/settings", json={"conversion": "on" if on else "off", "confirmed": True})
    assert r.status_code == 200 and r.json()["conversion"] == ("on" if on else "off"), r.text


def _act(c: Any, key: str, action: str, revision: Any, confirmed: Any = True) -> Any:
    return c.post(f"{CONV}/actions", json={"key": key, "action": action, "revision": revision, "confirmed": confirmed})


def _item(listing: dict[str, Any], key: str) -> dict[str, Any]:
    return next(i for i in listing["items"] if i["key"] == key)


def _arx_authored(conn: Any, automations: tuple[str, ...] = (), schedules: tuple[str, ...] = ()) -> None:
    """Mark synthetic items as made through Arx with the live revision (CR-033 6.1 `arx_authored`); items made outside Arx are never
    touched (T16), so the mirror's default `external` would offer nothing."""
    from smplwise.audit import audit

    for cid in automations:
        rev, cfg = conn.execute("SELECT revision, config_json FROM ha_config_items WHERE kind = 'automation' AND item_id = ?", (cid,)).fetchone()
        conn.execute("UPDATE automation_meta SET created_via = 'arx', created_by = 'dev-joni', created_by_username = 'joni' WHERE kind = 'automation' AND item_id = ?", (cid,))
        conn.execute("INSERT OR IGNORE INTO automation_versions(kind, item_id, revision, config_json, seen_at, via, actor, actor_username) VALUES ('automation', ?, ?, ?, ?, 'arx', 'dev-joni', 'joni')",
                     (cid, rev, cfg, now_iso()))
    for sid in schedules:
        rev = conn.execute("SELECT revision FROM schedule_cache WHERE schedule_id = ?", (sid,)).fetchone()[0]
        conn.execute("UPDATE schedule_meta SET created_via = 'arx', created_by = 'dev-joni', created_by_username = 'joni' WHERE schedule_id = ?", (sid,))
        audit(conn, actor=None, action="schedule.create", decision="allowed", resource_type="schedule", resource_id=sid, details={"revision_after": rev})


def _audit(app: Any, action: str) -> list[tuple[str, str | None]]:
    with app.state.db.connection(mode="read") as conn:
        return [(r["decision"], r["reason"]) for r in conn.execute("SELECT decision, reason FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


# ================================================================ the automations world

@pytest.fixture()
def autos(autos_app, monkeypatch):
    """Synthetic items (all ENABLED unless said): 8201 an event-driven automation with a direct WisKey unlock and a light step (M1
    candidate); 8202 an automation whose door opens through a called script; 8203 an automation with a computed lock target (unknown);
    8204 an automation whose only step is the door; 8205 a door automation made outside Arx (never touched); the script `door_script` itself; a WisKey lock mapped to relay 1."""
    from smplwise.services import automations

    app, s, c, fake, tr = autos_app
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)
    _no_door_commands(monkeypatch, feed)
    fake.states["lock.entrance"] = {"entity_id": "lock.entrance", "state": "locked", "attributes": {"friendly_name": "כניסה"}, "last_changed": fake.iso()}
    fake.registry.append(fake._reg_row("lock.entrance", platform="hikvision_intercom", unique_id="ent_door_1"))
    door_script = {"alias": "פתיחת שער", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}]}
    fake.scripts["door_script"] = door_script
    fake._seed_script_entity("door_script", door_script)

    def auto(cid: str, alias: str, actions: list[dict[str, Any]], enabled: bool = True) -> None:
        fake._seed_automation(f"automation.a_{cid}", cid, {"id": cid, "alias": alias, "mode": "single",
                                                           "triggers": [{"trigger": "state", "entity_id": "binary_sensor.doorbell", "to": "on"}],
                                                           "conditions": [], "actions": actions}, enabled)

    auto("8201", "פעמון פותח את הכניסה", [{"action": "light.turn_on", "target": {"entity_id": "light.office"}},
                                          {"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}])
    auto("8202", "פעמון דרך סקריפט", [{"action": "script.turn_on", "target": {"entity_id": "script.door_script"}}])
    auto("8203", "שער מחושב", [{"action": "lock.unlock", "target": {"entity_id": "{{ states('input_text.door') }}"}}])
    auto("8204", "רק פתיחה", [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}])
    auto("8205", "נוצר בתשתית", [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}, {"delay": 1}])
    seed_mirror(app.state.db, fake)
    with app.state.db.connection() as conn:
        _door_map(conn, "lock.entrance")
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection() as conn:
        _arx_authored(conn, automations=("8201", "8202", "8203", "8204"))
    return {"app": app, "c": c, "fake": fake, "tr": tr}


def _cfg(fake: Any, cid: str) -> dict[str, Any]:
    return next(a for a in fake.automations if a.get("id") == cid)


def _bridge_ops(tr: Any) -> list[tuple[str, str]]:
    return [(b.get("op"), str(b.get("item_id"))) for b in tr.bridge_calls if b.get("op") in ("enable", "disable", "upsert", "delete")]


def test_wxd10_no_wiskey_and_nothing_found_are_answered_cleanly(autos_app, monkeypatch):
    """The 2026-11-04 lab result: nothing opens a door. The list says so, offers nothing, and no action can reach any item."""
    app, _s, c, fake, tr = autos_app
    _no_door_commands(monkeypatch)
    r = c.get(CONV)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "no_wiskey" and body["items"] == [] and body["switch"] == "off" and body["state_text"]
    # a WisKey door exists, but no saved item reaches it (the lab's situation)
    FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, config_entry_id, state, state_seen_at, first_seen_at, updated_at) VALUES "
                     "('lock.entrance', 'lock', 'כניסה', 'hikvision_intercom', ?, 'locked', ?, ?, ?)", (ENTRY, now_iso(), now_iso(), now_iso()))
        _door_map(conn, "lock.entrance")
    body = c.get(CONV).json()
    assert body["state"] == "nothing_found" and body["state_text"] == door_conversion.STATE_TEXT["nothing_found"]
    assert body["items"] == [] and body["records"] == []
    assert body["counts"] == {"items": 0, "disable": 0, "convert_event_job": 0, "hand_over_program": 0, "list_only": 0, "disable_required": 0, "handled": 0}
    _switch(c, True)
    r = _act(c, "automation:anything", "disable", "r1")
    assert r.status_code == 404 and r.json()["code"] == "not_listed", r.text
    assert _audit(app, "door.path_disabled") == [("denied", "not_listed")]
    assert _bridge_ops(tr) == [], "nothing reached Home Assistant"


def test_wxd10_list_categories_and_offers_per_kind(autos):
    c = autos["c"]
    body = c.get(CONV).json()
    assert body["state"] == "items" and body["switch"] == "off"
    keys = {i["key"]: i for i in body["items"]}
    assert set(keys) >= {"automation:8201", "automation:8202", "automation:8203", "automation:8204", "script:door_script"}
    a1 = keys["automation:8201"]
    assert a1["category"] == "event_automation" and a1["offered"] == ["disable", "convert_event_job"], a1
    assert a1["actions"]["convert_event_job"]["removed_steps"] == 1 and a1["actions"]["convert_event_job"]["doors"] == a1["doors"]
    assert a1["actions"]["hand_over_program"]["reason"] == "kind"
    a2 = keys["automation:8202"]
    assert a2["offered"] == ["disable"] and a2["actions"]["convert_event_job"]["reason"] == "door_step_in_called_item"
    a3 = keys["automation:8203"]
    assert a3["category"] == "unknown" and a3["offered"] == ["disable"] and a3["actions"]["convert_event_job"]["reason"] == "unresolvable"
    a4 = keys["automation:8204"]
    assert a4["offered"] == ["disable"] and a4["actions"]["convert_event_job"]["reason"] == "empty_actions"
    ext = keys["automation:8205"]
    assert ext["origin"] == "external" and ext["offered"] == [] and ext["actions"]["disable"]["reason"] == "external", "T16: never touched"
    sc = keys["script:door_script"]
    assert sc["category"] == "script" and sc["offered"] == [] and sc["actions"]["disable"]["reason"] == "not_autonomous"
    # every reason has a Hebrew text; no code and no entity id is a text
    for i in body["items"]:
        for a in i["actions"].values():
            assert a["available"] or (a["reason_text"] and not re.search(r"[a-z_]{4,}\.", a["reason_text"])), a
    assert "lock.entrance" not in json.dumps(body, ensure_ascii=False), "names only"
    assert body["counts"]["convert_event_job"] == 1 and body["counts"]["list_only"] >= 1


def test_wxd10_every_action_is_refused_while_off_unconfirmed_stale_or_not_offered(autos):
    c, app, tr = autos["c"], autos["app"], autos["tr"]
    a1 = _item(c.get(CONV).json(), "automation:8201")
    r = _act(c, "automation:8201", "disable", a1["revision"])
    assert r.status_code == 409 and r.json()["code"] == "door_conversion_off", r.text
    _switch(c, True)
    r = _act(c, "automation:8201", "disable", a1["revision"], confirmed=None)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = _act(c, "automation:8201", "disable", "0000000000000000")
    assert r.status_code == 409 and r.json()["code"] == "stale_revision"
    r = _act(c, "automation:8201", "hand_over_program", a1["revision"])
    assert r.status_code == 409 and r.json()["code"] == "action_not_offered" and r.json()["details"]["reason"] == "kind"
    r = _act(c, "script:door_script", "disable", _item(c.get(CONV).json(), "script:door_script")["revision"])
    assert r.status_code == 409 and r.json()["code"] == "action_not_offered"
    assert _bridge_ops(tr) == [], "nothing reached Home Assistant"
    assert [d for d, _ in _audit(app, "door.path_disabled")] == ["denied"] * 4
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM door_path_conversions").fetchone()[0] == 0
    # only the system administrator sees or uses any of it
    assert c.get(CONV, headers={"X-SW-Dev-User": "omer"}).status_code == 403
    assert c.post(f"{CONV}/actions", json={"key": "automation:8201", "action": "disable", "revision": a1["revision"], "confirmed": True},
                  headers={"X-SW-Dev-User": "omer"}).status_code == 403


def test_wxd10a_disable_and_list_then_undo_restores_exactly_that_item(autos):
    c, app, tr, fake = autos["c"], autos["app"], autos["tr"], autos["fake"]
    _switch(c, True)
    a2 = _item(c.get(CONV).json(), "automation:8202")
    r = _act(c, "automation:8202", "disable", a2["revision"])
    assert r.status_code == 200, r.text
    rec = r.json()["record"]
    assert rec["action"] == "disabled" and rec["state"] == "done" and rec["kind"] == "automation"
    assert ("disable", "8202") in _bridge_ops(tr), "through the existing write path"
    assert fake.states["automation.a_8202"]["state"] == "off"
    after = c.get(CONV).json()
    listed = _item(after, "automation:8202")
    assert listed["record"]["id"] == rec["id"] and listed["offered"] == [], "listed, handled, nothing more offered"
    assert after["counts"]["handled"] == 1 and after["records"][0]["id"] == rec["id"]
    r = _act(c, "automation:8202", "disable", a2["revision"])
    assert r.status_code == 409 and r.json()["code"] == "already_handled"
    # the enable refusal (review I5) still holds for everybody else
    r = c.post(f"{API}/automations/automation/8202/enable", json={"client_request_id": f"en-{uuid.uuid4().hex[:10]}", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted", r.text
    # undo: confirmed, audited, the same item back on
    assert c.post(f"{CONV}/records/{rec['id']}/undo", json={}).json()["code"] == "confirmation_required"
    r = c.post(f"{CONV}/records/{rec['id']}/undo", json={"confirmed": True})
    assert r.status_code == 200 and r.json()["re_enabled"] is True and r.json()["record"]["state"] == "undone", r.text
    assert fake.states["automation.a_8202"]["state"] == "on"
    assert c.post(f"{CONV}/records/{rec['id']}/undo", json={"confirmed": True}).json()["code"] == "already_undone"
    # the restore pass did not outlive its one call: switching it off and on through the automations screen is refused again
    assert c.post(f"{API}/automations/automation/8202/disable", json={"client_request_id": f"d-{uuid.uuid4().hex[:10]}", "confirm": True}).status_code == 200
    r = c.post(f"{API}/automations/automation/8202/enable", json={"client_request_id": f"e-{uuid.uuid4().hex[:10]}", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted"
    assert [d for d, _ in _audit(app, "door.path_disabled")] == ["allowed", "denied"]
    assert [d for d, _ in _audit(app, "door.path_restored")] == ["denied", "allowed", "denied"]


def test_wxd10a_undo_is_refused_when_the_item_changed_since(autos):
    from smplwise.services import automations

    c, app, fake = autos["c"], autos["app"], autos["fake"]
    _switch(c, True)
    a3 = _item(c.get(CONV).json(), "automation:8203")
    rec = _act(c, "automation:8203", "disable", a3["revision"]).json()["record"]
    _cfg(fake, "8203")["alias"] = "שער מחושב (שונה)"
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    r = c.post(f"{CONV}/records/{rec['id']}/undo", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "stale_revision", r.text
    assert fake.states["automation.a_8203"]["state"] == "off", "nothing was re-armed"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM door_path_conversions WHERE id = ?", (rec["id"],)).fetchone()[0] == "done"


def test_wxd10a_convert_event_automation_to_a_draft_arx_door_job(autos):
    c, app, tr, fake = autos["c"], autos["app"], autos["tr"], autos["fake"]
    _switch(c, True)
    a1 = _item(c.get(CONV).json(), "automation:8201")
    r = _act(c, "automation:8201", "convert_event_job", a1["revision"])
    assert r.status_code == 200, r.text
    rec = r.json()["record"]
    assert rec["action"] == "converted" and rec["door_job_id"] and rec["doors"] == 1
    # Home Assistant: the door step is gone, the light step stays, the automation stays on
    cfg = _cfg(fake, "8201")
    assert [s["action"] for s in cfg["actions"]] == ["light.turn_on"], cfg
    assert fake.states["automation.a_8201"]["state"] == "on"
    assert [op for op, item in _bridge_ops(tr) if item == "8201"] == ["upsert"]
    with app.state.db.connection(mode="read") as conn:
        job = conn.execute("SELECT * FROM door_automations WHERE id = ?", (rec["door_job_id"],)).fetchone()
        assert job["state"] == "draft" and job["automation_item_id"] == "8201" and job["armed_by"] is None, "a draft: a person arms it later"
        assert json.loads(job["policy_json"])["doors"] == [{"station_id": ENTRY, "relay": 1}]
        row = conn.execute("SELECT * FROM door_path_conversions WHERE id = ?", (rec["id"],)).fetchone()
        assert json.loads(row["removed_steps_json"]) == [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}]
        assert row["revision_before"] == a1["revision"] and row["revision_after"] != a1["revision"]
        details = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'door.path_converted' AND decision = 'allowed'").fetchone()[0])
    assert details["door_job_id"] == rec["door_job_id"] and details["removed_steps"] == 1
    # the item no longer opens a door: it leaves the inventory; the register keeps it; Arx-started runs are unchanged now
    after = c.get(CONV).json()
    assert "automation:8201" not in {i["key"] for i in after["items"]} and after["records"][0]["id"] == rec["id"]
    # undo deletes the job; the removed Home Assistant step is not put back by Arx
    r = c.post(f"{CONV}/records/{rec['id']}/undo", json={"confirmed": True})
    assert r.status_code == 200 and r.json()["ha_steps_restored"] is False, r.text
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT deleted_at FROM door_automations WHERE id = ?", (rec["door_job_id"],)).fetchone()[0] is not None
    assert [s["action"] for s in _cfg(fake, "8201")["actions"]] == ["light.turn_on"]


def test_wxd10a_strip_door_steps_nested_mixed_and_area_targets(autos):
    app = autos["app"]
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, area_id, state, state_seen_at, first_seen_at, updated_at) VALUES "
                     "('lock.storeroom', 'lock', 'מחסן', 'zwave_js', 'area_store', 'locked', ?, ?, ?)", (now_iso(), now_iso(), now_iso()))
        nested = {"alias": "n", "actions": [
            {"choose": [{"conditions": [], "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}, {"action": "light.turn_off", "target": {"entity_id": "light.office"}}]}],
             "default": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
            {"if": [], "then": [{"action": "notify.notify", "data": {"message": "x"}}], "else": [{"action": "lock.open", "target": {"entity_id": "lock.entrance"}},
                                                                                                   {"delay": "00:00:01"}]},
            {"parallel": [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}, {"action": "light.turn_on", "target": {"entity_id": "light.office"}}]},
        ]}
        new_cfg, removed, problem = door_conversion.strip_door_steps(conn, nested)
        assert problem is None and len(removed) == 3, (problem, removed)
        assert "lock.entrance" not in json.dumps(new_cfg) and "light.office" in json.dumps(new_cfg)
        # a step that also unlocks an ordinary lock is not removed silently
        mixed = {"alias": "m", "actions": [{"action": "lock.unlock", "target": {"entity_id": ["lock.entrance", "lock.storeroom"]}}, {"delay": 1}]}
        assert door_conversion.strip_door_steps(conn, mixed)[2] == "mixed_target"
        # a branch left empty is refused (the owner disables instead)
        empty = {"alias": "e", "actions": [{"delay": 1}, {"if": [], "then": [{"action": "lock.unlock", "target": {"entity_id": "lock.entrance"}}]}]}
        assert door_conversion.strip_door_steps(conn, empty)[2] == "empty_branch"
        # a disabled step stays as it is (it never runs)
        off = {"alias": "o", "actions": [{"delay": 1}, {"action": "lock.unlock", "enabled": False, "target": {"entity_id": "lock.entrance"}}]}
        assert door_conversion.strip_door_steps(conn, off)[2] == "no_door"


# ================================================================ the schedules world

@pytest.fixture()
def scheds(sched_app, monkeypatch):
    """Synthetic schedules (enabled): a recurring workday hold 07:00-09:00 that unlocks a WisKey lock (M3 candidate), the same with a
    light step (mixed), a door at 08:00 without an end, a computed template switch (unknown) and a light schedule (no door)."""
    from smplwise.services import schedules

    app, s, c, fake, tr = sched_app
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית")]).install(monkeypatch)
    _no_door_commands(monkeypatch, feed)

    def add(name: str, actions: list[tuple[str, str]], start: str = "07:00:00", stop: str | None = "09:00:00", weekdays: list[str] | None = None) -> str:
        sid = fake._add({"name": name, "weekdays": weekdays or ["workday"], "repeat_type": "repeat",
                         "timeslots": [{"start": start, "stop": stop, "conditions": [], "condition_type": None, "track_conditions": False,
                                        "actions": [{"service": svc, "entity_id": ent, "service_data": {}} for svc, ent in actions]}]})
        fake.items[sid]["enabled"] = True
        return sid

    ids = {"hold": add("שער פתוח בבוקר", [("lock.unlock", "lock.front_door")]),
           "mixed": add("שער ואור", [("lock.unlock", "lock.front_door"), ("light.turn_on", "light.office")]),
           "no_end": add("פתיחה בשמונה", [("lock.unlock", "lock.front_door")], start="08:00:00", stop=None),
           "template": add("מתג מחושב", [("switch.turn_on", "switch.gate_tpl")]),
           "light": add("אור", [("light.turn_on", "light.office")])}
    fake_scheduler.seed_mirror(app.state.db, fake)
    schedules.MIRROR.pull(None, "t")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom', config_entry_id = ? WHERE entity_id = 'lock.front_door'", (ENTRY,))
        conn.execute("INSERT OR IGNORE INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES ('switch.gate_tpl', 'switch', 'gate_tpl', 'template', 'off', ?, ?, ?)",
                     (now_iso(), now_iso(), now_iso()))
        _door_map(conn, "lock.front_door")
        _arx_authored(conn, schedules=tuple(ids.values()))
    ops: list[str] = []
    real = tr.bridge
    monkeypatch.setattr(tr, "bridge", lambda payload: ops.append(payload.get("op")) or real(payload))
    return {"app": app, "c": c, "fake": fake, "ids": ids, "ops": ops}


def test_wxd10b_schedule_offers(scheds):
    c, ids = scheds["c"], scheds["ids"]
    body = c.get(CONV).json()
    keys = {i["key"]: i for i in body["items"]}
    hold = keys[f"schedule:{ids['hold']}"]
    assert hold["category"] == "schedule" and hold["offered"] == ["disable", "hand_over_program"], hold
    prog = hold["actions"]["hand_over_program"]["program"]
    assert prog["days"] == [0, 1, 2, 3, 4] and prog["periods"] == [{"start": "07:00", "end": "09:00"}] and prog["doors"] == ["כניסה ראשית · ממסר 1"]
    assert keys[f"schedule:{ids['mixed']}"]["actions"]["hand_over_program"]["reason"] == "mixed_schedule"
    assert keys[f"schedule:{ids['no_end']}"]["actions"]["hand_over_program"]["reason"] == "no_end_time"
    tpl = keys[f"schedule:{ids['template']}"]
    assert tpl["category"] == "unknown" and tpl["offered"] == ["disable"] and tpl["actions"]["hand_over_program"]["reason"] == "unresolvable"
    assert f"schedule:{ids['light']}" not in keys, "no door, not listed"
    for sid in ids.values():
        if f"schedule:{sid}" in keys:
            assert keys[f"schedule:{sid}"]["actions"]["convert_event_job"]["reason"] == "kind"


def _grant_door_unlock(c: Any) -> None:
    """CR-014's own rule: switching a schedule that acts on a lock needs the right on that lock (door.unlock) - the conversion goes
    through that write path and its gates, so the administrator needs it too."""
    role = c.post(f"{API}/access/roles", json={"name": "פותח " + uuid.uuid4().hex[:6], "permissions": ["map.read"], "sensitive": ["door.unlock"]}).json()["id"]
    assert c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": role, "scope_type": "installation", "scope_id": "*"}).status_code == 201


def test_wxd10b_hand_over_creates_a_draft_window_and_undo_puts_the_schedule_back(scheds):
    c, ids, ops, app, fake = scheds["c"], scheds["ids"], scheds["ops"], scheds["app"], scheds["fake"]
    _switch(c, True)
    key = f"schedule:{ids['hold']}"
    hold = _item(c.get(CONV).json(), key)
    # the existing write path keeps its own gates: without the right on the lock the schedule is not switched off and nothing is created
    r = _act(c, key, "hand_over_program", hold["revision"])
    assert r.status_code == 403 and r.json()["code"] == "grant_required", r.text
    assert fake.items[ids["hold"]]["enabled"] is True and "disable" not in ops
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM door_window_rules").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM door_path_conversions").fetchone()[0] == 0
    _grant_door_unlock(c)
    r = _act(c, key, "hand_over_program", hold["revision"])
    assert r.status_code == 200, r.text
    rec = r.json()["record"]
    assert rec["action"] == "handed_over" and rec["program_rule_id"]
    assert fake.items[ids["hold"]]["enabled"] is False and ops.count("disable") == 1, "the schedule went off through the existing write path"
    with app.state.db.connection(mode="read") as conn:
        rule = conn.execute("SELECT * FROM door_window_rules WHERE id = ?", (rec["program_rule_id"],)).fetchone()
        assert rule["state"] == "draft" and rule["kind"] == "weekly" and rule["calendar_policy"] == "ignore_calendar"
        periods = conn.execute("SELECT weekday, start_hm, end_hm FROM door_window_periods WHERE rule_id = ? ORDER BY weekday", (rule["id"],)).fetchall()
        assert [tuple(p) for p in periods] == [(d, "07:00", "09:00") for d in range(5)]
        assert [tuple(d) for d in conn.execute("SELECT station_id, relay FROM door_window_rule_doors WHERE rule_id = ?", (rule["id"],))] == [(ENTRY, 1)]
        assert conn.execute("SELECT COUNT(*) FROM door_window_occurrences").fetchone()[0] == 0, "nothing planned or written before a person enables it"
    assert _audit(app, "door.path_handed_over") == [("denied", "grant_required"), ("allowed", None)]
    # while the window is enabled the undo is refused; paused or draft, it is retired and the schedule comes back
    with app.state.db.connection() as conn:
        conn.execute("UPDATE door_window_rules SET state = 'enabled' WHERE id = ?", (rec["program_rule_id"],))
    r = c.post(f"{CONV}/records/{rec['id']}/undo", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "program_in_use", r.text
    assert fake.items[ids["hold"]]["enabled"] is False
    with app.state.db.connection() as conn:
        conn.execute("UPDATE door_window_rules SET state = 'paused' WHERE id = ?", (rec["program_rule_id"],))
    r = c.post(f"{CONV}/records/{rec['id']}/undo", json={"confirmed": True})
    assert r.status_code == 200 and r.json()["re_enabled"] is True, r.text
    assert fake.items[ids["hold"]]["enabled"] is True
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM door_window_rules WHERE id = ?", (rec["program_rule_id"],)).fetchone()[0] == "retired"
    # and the ordinary enable refusal is intact for that schedule
    assert post_json(c, f"/schedules/{ids['hold']}/disable", {"client_request_id": rid()}).status_code == 200
    r = post_json(c, f"/schedules/{ids['hold']}/enable", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 409 and r.json()["code"] == "door_step_not_converted", r.text


def test_wxd10b_disable_the_unknown_schedule_and_hand_over_refusals(scheds):
    c, ids, fake = scheds["c"], scheds["ids"], scheds["fake"]
    _switch(c, True)
    _grant_door_unlock(c)
    listing = c.get(CONV).json()
    tpl_key = f"schedule:{ids['template']}"
    r = _act(c, tpl_key, "disable", _item(listing, tpl_key)["revision"])
    assert r.status_code == 200 and fake.items[ids["template"]]["enabled"] is False, r.text
    mixed_key = f"schedule:{ids['mixed']}"
    r = _act(c, mixed_key, "hand_over_program", _item(listing, mixed_key)["revision"])
    assert r.status_code == 409 and r.json()["details"]["reason"] == "mixed_schedule"
    assert fake.items[ids["mixed"]]["enabled"] is True


def test_wxd10b_program_plan_reasons(scheds, monkeypatch):
    """Quiet hours and the window length limit come from the door windows' own rules; a door that no longer resolves blocks the hand-over."""
    c, app, ids = scheds["c"], scheds["app"], scheds["ids"]
    with app.state.db.connection() as conn:
        assert door_conversion.program_plan(conn, ids["hold"])["available"] is True
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('doors.windows.max_hours', '1')")
        assert door_conversion.program_plan(conn, ids["hold"])["reason"] == "window_too_long"
        conn.execute("DELETE FROM settings WHERE key = 'doors.windows.max_hours'")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('doors.windows.quiet_to', '08:00')")
        assert door_conversion.program_plan(conn, ids["hold"])["reason"] == "quiet_hours"
        conn.execute("DELETE FROM settings WHERE key = 'doors.windows.quiet_to'")
    # the station leaves the WisKey copy: the mapped door no longer resolves, so nothing is handed over (fail closed)
    FakeWisKeyFeed([station("01JOTHERSTATION0000000000", "אחרת")]).install(monkeypatch)
    with app.state.db.connection() as conn:
        assert door_conversion.program_plan(conn, ids["hold"])["reason"] == "unresolvable"


# ================================================================ static guarantees

def test_wxd10_the_restore_pass_has_one_caller_and_the_module_sends_no_door_command():
    users = []
    for f in SMPLWISE.rglob("*.py"):
        text = f.read_text(encoding="utf-8")
        if "restore_pass(" in text:
            users.append(f.relative_to(SMPLWISE).as_posix())
    assert sorted(users) == ["services/door_conversion.py", "services/door_run_guard.py"], users
    src = (SMPLWISE / "services" / "door_conversion.py").read_text(encoding="utf-8")
    for forbidden in ("open_door(", "release_door(", "call_bridge_execute", "trusted_door.", "SYNC.action", "unlock_door(", "wiskey_client", "door_engine_live"):
        assert forbidden not in src, forbidden


def test_wxd10_switch_defaults_off_and_is_never_carried_by_a_backup():
    from smplwise.services import backup

    assert door_conversion.FLAG_KEY.startswith("doors.") and "doors." in backup.SETTINGS_KEEP_PREFIXES
    mig = (SMPLWISE / "migrations" / "0205_door_path_conversions.sql").read_text(encoding="utf-8")
    assert "door_path_conversions" in mig and "door_path_conversions" not in " ".join(getattr(backup, "PROJECT_TABLES", ()))
