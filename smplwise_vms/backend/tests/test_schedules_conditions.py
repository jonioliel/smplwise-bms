"""CR-014 schedules - conditions as a first-class part (docs/architecture/SCHEDULER_API.md §2.4, §5.8, §6.5): the schedule-level
block <-> the per-slot component payload, summaries and presets, `conditional` next runs, conditions that differ between
slots (read-only), the sensitive-schedule warning when a condition entity is unavailable, `track`, the run-now
`skip_conditions` rule - and the fake component's own condition semantics (a rest-day schedule does not trigger while the
sensor is off, does when it is on, `track_conditions` re-checks inside the window, an unavailable sensor never matches)."""
from __future__ import annotations

import datetime as dt
import json

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import grant as _grant, place as _place, sched_app  # noqa: F401
from smplwise.services import ha_sync, schedules

API = "/api/v1"
OMER = {"X-SW-Dev-User": "omer"}


def _by_name(c, name, headers=None):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}, headers=headers or {}).json()["items"] if s["name"] == name)


def _create(c, d, **kw):
    r = c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid(), **kw})
    assert r.status_code == 201, r.text
    return r.json()["schedule"]


def _set_state(app, entity_id, state, **attrs):
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        old = json.loads(row["attributes_json"] or "{}") if row else {}
        ha_sync.upsert_state(conn, {"entity_id": entity_id, "state": state, "attributes": {**old, **attrs}, "last_changed": "2026-09-30T10:05:00+00:00", "last_updated": "2026-09-30T10:05:00+00:00"})


# ---------------------------------------------------------------- block <-> payload, summaries, presets

def test_conditions_are_one_block_copied_into_every_slot(sched_app):
    app, s, c, fake, tr = sched_app
    slots = [slot("06:00:00", "12:00:00", act("light.turn_on", "light.office", brightness=90)), slot("12:00:00", "18:00:00", act("light.turn_off", "light.office")), slot("18:00:00", None, act("light.turn_on", "light.office"))]
    made = _create(c, draft_of("Blocks", slots, conditions=[cond("on"), {"entity_id": "sensor.outdoor_temperature", "attribute": "state", "match_type": "above", "value": 28}]))
    call = fake.bridge_calls[-1]["payload"]["timeslots"]
    assert len(call) == 3
    expect = [{"entity_id": SHABBAT, "attribute": "state", "value": "on", "match_type": "is"}, {"entity_id": "sensor.outdoor_temperature", "attribute": "state", "value": 28, "match_type": "above"}]
    assert all(sl["conditions"] == expect and sl["condition_type"] == "or" and sl["track_conditions"] is False for sl in call)
    block = made["conditions"]
    assert block["uniform"] is True and block["type"] == "or" and block["track"] is False and len(block["items"]) == 2
    assert block["summary"] == "בתנאי: Rest day in effect פעיל או Outdoor temperature מעל 28" and block["preset"] is None
    assert block["items"][1] == {"entity_id": "sensor.outdoor_temperature", "name": "Outdoor temperature", "attribute": "state", "match_type": "above", "value": 28, "readable": True, "state": "22.5", "available": True, "locked": False}
    # the same conditions with "and": all of them
    other = _create(c, draft_of("Both", slots[:1], conditions=[cond("on"), cond("on", "binary_sensor.motion_hall")]))
    both = json.loads(json.dumps(fake.bridge_calls[-1]["payload"]["timeslots"]))
    assert both[0]["condition_type"] == "or"  # the draft asked for the default; and-type is the caller's choice when several
    d = draft_of("Both and", slots[:1], conditions=[cond("on"), cond("on", "binary_sensor.motion_hall")])
    d["conditions"]["type"] = "and"
    d["conditions"]["track"] = True
    mine = _create(c, d)
    assert fake.bridge_calls[-1]["payload"]["timeslots"][0]["condition_type"] == "and" and fake.bridge_calls[-1]["payload"]["timeslots"][0]["track_conditions"] is True
    assert mine["conditions"]["summary"].startswith("בתנאי: Rest day in effect פעיל וגם Hall motion פעיל") and mine["conditions"]["track"] is True


def test_presets_need_the_configured_sensor(sched_app):
    app, s, c, fake, tr = sched_app
    on = _by_name(c, "Living room cooling on rest days")["conditions"]
    off = _by_name(c, "Not on rest days")["conditions"]
    assert (on["preset"], on["summary"]) == ("only_holy_days", "רק בשבת ובחג") and (off["preset"], off["summary"]) == ("not_holy_days", "לא בשבת ובחג")
    made = _create(c, draft_of("Preset made", conditions=[cond("off")]))
    assert made["conditions"]["preset"] == "not_holy_days"
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": ""}).status_code == 200
    plain = _by_name(c, "Living room cooling on rest days")["conditions"]
    assert plain["preset"] is None and plain["summary"] == "בתנאי: Rest day in effect פעיל"
    assert c.get(f"{API}/schedules/status").json()["settings"]["shabbat_sensor"] is None
    assert c.get(f"{API}/schedules", params={"preset": "only_holy_days"}).json()["total"] == 0  # a preset filter needs the sensor
    # a sensor that is not a binary_sensor is refused by the setting; an unknown one too
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "light.office"}).status_code == 422
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "binary_sensor.nowhere"}).status_code == 422
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": SHABBAT, "schedules.shabbat_sensor_force": True}).status_code == 200


def test_next_run_of_a_conditional_schedule_is_conditional(sched_app):
    app, s, c, fake, tr = sched_app
    cond_sched = _by_name(c, "Living room cooling on rest days")
    assert cond_sched["next_run"]["conditional"] is True and cond_sched["next_run"]["source"] == "component" and cond_sched["upcoming"]
    plain = _by_name(c, "Office light on weekdays")
    assert plain["next_run"]["conditional"] is False
    made = _create(c, draft_of("Conditional preview", conditions=[cond("on")]))
    assert made["next_run"]["conditional"] is True
    pv = post_json(c, "/schedules/preview", {"draft": draft_of("p", conditions=[cond("on")]), "count": 2}).json()
    assert pv["conditional"] is True and len(pv["upcoming"]) == 2
    assert post_json(c, "/schedules/preview", {"draft": draft_of("p"), "count": 2}).json()["conditional"] is False


def test_conditions_that_differ_between_slots_make_the_schedule_read_only(sched_app):
    app, s, c, fake, tr = sched_app
    sid = next(i for i, it in fake.items.items() if it["name"] == "Hall lights on rest days")
    fake.items[sid]["timeslots"][1]["conditions"] = []
    fake.items[sid]["timeslots"][1]["condition_type"] = None
    schedules.MIRROR.pull(None, "t")
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["conditions"]["uniform"] is False and d["conditions"]["items"][0]["entity_id"] == SHABBAT  # slot 0's
    assert d["slots"][1]["unsupported"][0]["code"] == "conditions_differ" and d["can"]["edit"] is False
    assert [r["code"] for r in d["read_only"]["reasons"]] == ["unsupported_content"]
    assert put_draft(c, sid, draft_of("x"), d["revision"]).json()["code"] == "unsupported_content"


def test_a_sensitive_schedule_on_an_unavailable_condition_warns(sched_app):
    app, s, c, fake, tr = sched_app
    gate = [slot("07:00:00", "08:00:00", act("cover.open_cover", "cover.driveway_gate")), slot("08:00:00", "00:00:00", act("cover.close_cover", "cover.driveway_gate"))]
    d = draft_of("Gate on temperature", gate, conditions=[{"entity_id": "sensor.outdoor_temperature", "attribute": "state", "match_type": "above", "value": 20}])
    ok = post_json(c, "/schedules/preview", {"draft": d}).json()
    assert ok["valid"] is True and ok["warnings"] == []
    _set_state(app, "sensor.outdoor_temperature", "unavailable")
    pv = post_json(c, "/schedules/preview", {"draft": d}).json()
    assert {w["code"] for w in pv["warnings"]} == {"condition_entity_unavailable", "sensitive_condition_unavailable"}
    assert [w["message"] for w in pv["warnings"] if w["code"] == "sensitive_condition_unavailable"] == ["תזמון של פעולה רגישה תלוי בחיישן שאינו זמין כעת."]
    made = _create(c, d, confirm_lowering=True)
    assert [w["code"] for w in made["warnings"]] == ["sensitive_condition_unavailable"]
    review = {i["schedule"]["id"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "sensitive_condition_unavailable" in review[made["id"]]
    # a plain (non-sensitive) schedule on the same sensor only gets the ordinary warning
    plain = post_json(c, "/schedules/preview", {"draft": draft_of("Plain", conditions=[{"entity_id": "sensor.outdoor_temperature", "attribute": "state", "match_type": "above", "value": 20}])}).json()
    assert [w["code"] for w in plain["warnings"]] == ["condition_entity_unavailable"]
    _set_state(app, "sensor.outdoor_temperature", "22.5")
    assert c.get(f"{API}/schedules/{made['id']}").json()["warnings"] == []


def test_track_needs_a_window(sched_app):
    app, s, c, fake, tr = sched_app
    d = draft_of("Tracked", [slot("08:00:00", None, act("light.turn_on", "light.office"))], conditions=[cond("on")], track=True)
    assert [w["code"] for w in post_json(c, "/schedules/preview", {"draft": d}).json()["warnings"]] == ["track_needs_window"]
    d = draft_of("Tracked", [slot("08:00:00", "09:00:00", act("light.turn_on", "light.office"))], conditions=[cond("on")], track=True)
    assert post_json(c, "/schedules/preview", {"draft": d}).json()["warnings"] == []


def test_run_now_skip_conditions_needs_installation_scope_when_conditions_are_locked(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    made = _create(c, draft_of("Lights when moving", [slot("08:00:00", None, act("light.turn_on", "light.office", brightness=50))], conditions=[cond("on", "binary_sensor.motion_hall")]))
    _grant(c, "omer", "עורך תזמונים", ["schedule.view", "devices.read", "entity.state.read", "devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    assert _by_name(c, "Lights when moving", OMER)["conditions"]["items"][0]["locked"] is True
    r = post_json(c, f"/schedules/{made['id']}/run", {"slot_index": 0, "skip_conditions": True, "client_request_id": rid()}, OMER)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert not [x for x in fake.bridge_calls if x["op"] == "run"]
    r = post_json(c, f"/schedules/{made['id']}/run", {"slot_index": 0, "skip_conditions": False, "client_request_id": rid()}, OMER)
    assert r.status_code == 202 and fake.bridge_calls[-1]["skip_conditions"] is False
    schedules_reset = __import__("smplwise.services.schedule_ops", fromlist=["reset_limits"])
    schedules_reset.reset_limits()
    r = post_json(c, f"/schedules/{made['id']}/run", {"slot_index": 0, "skip_conditions": True, "client_request_id": rid()})  # the administrator: installation-wide
    assert r.status_code == 202 and fake.bridge_calls[-1]["skip_conditions"] is True


# ---------------------------------------------------------------- the fake component's own condition semantics

def _fresh_fake(fake, name, slots, **kw):
    sid = fake._add({"name": name, "weekdays": ["daily"], "repeat_type": "repeat", "timeslots": slots, **kw})
    return sid


def _slot(start, stop, cond_value="on", track=False):
    return {"start": start, "stop": stop, "conditions": [{"entity_id": SHABBAT, "attribute": "state", "value": cond_value, "match_type": "is"}], "condition_type": "or", "track_conditions": track,
            "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {"brightness": 20}}]}


def test_the_fake_skips_a_slot_whose_conditions_fail_and_fires_when_they_hold():
    fake = fake_scheduler.FakeScheduler()
    fake.world = fake_scheduler.world_states()
    sid = _fresh_fake(fake, "Cond", [_slot("13:30:00", "14:00:00")])  # the clock is 13:00 in Israel
    fake.tick(31 * 60)
    assert fake.actions_fired == [] and fake.states[sid]["state"] == "triggered"  # verified: `triggered` even though the condition failed - and nothing ran
    fake.world[SHABBAT]["state"] = "on"
    sid2 = _fresh_fake(fake, "Cond 2", [_slot("13:45:00", "14:15:00")])
    fake.tick(31 * 60)
    assert [f["service"] for f in fake.actions_fired] == ["light.turn_on"] and fake.states[sid2]["state"] == "triggered" and fake.states[sid2]["attributes"]["current_slot"] == 0
    fake.tick(120)
    assert fake.states[sid2]["state"] == "on"  # `triggered` holds for trigger_hold_s (60 s), then it is a plain on


def test_the_fake_evaluates_is_off_and_never_matches_an_unavailable_sensor():
    fake = fake_scheduler.FakeScheduler()
    fake.world = fake_scheduler.world_states()
    fake.world[SHABBAT]["state"] = "unavailable"
    _fresh_fake(fake, "On", [_slot("13:10:00", None, "on")])
    _fresh_fake(fake, "Off", [_slot("13:20:00", None, "off")])
    fake.tick(30 * 60)
    assert fake.actions_fired == []  # an unavailable sensor satisfies neither `is on` nor `is off`
    fake.world[SHABBAT]["state"] = "off"
    _fresh_fake(fake, "Off again", [_slot("13:40:00", None, "off")])
    fake.tick(30 * 60)
    assert len(fake.actions_fired) == 1


def test_the_fake_rechecks_tracked_slots_inside_their_window():
    fake = fake_scheduler.FakeScheduler()
    fake.world = fake_scheduler.world_states()
    sid = _fresh_fake(fake, "Tracked", [_slot("13:10:00", "14:10:00", track=True)])
    _fresh_fake(fake, "Untracked", [_slot("13:10:00", "14:10:00", track=False)])
    fake.tick(15 * 60)
    assert fake.actions_fired == []  # the sensor is off at the start
    fake.world[SHABBAT]["state"] = "on"
    fake.tick(15 * 60)
    fired = [f["schedule_id"] for f in fake.actions_fired]
    assert fired == [sid]  # only the tracked one picked it up inside the window
    fake.world[SHABBAT]["state"] = "off"
    fake.tick(120 * 60)
    assert fired == [sid]


def test_the_fake_run_action_honours_skip_conditions():
    fake = fake_scheduler.FakeScheduler()
    fake.world = fake_scheduler.world_states()
    sid = _fresh_fake(fake, "Run", [_slot("23:00:00", None, "on")])
    fake.call_service("scheduler", "run_action", {"entity_id": fake.items[sid]["entity_id"], "time": "23:00:00"})
    assert fake.actions_fired == []
    fake.call_service("scheduler", "run_action", {"entity_id": fake.items[sid]["entity_id"], "time": "23:00:00", "skip_conditions": True})
    assert len(fake.actions_fired) == 1


def test_the_fake_component_contract():
    """§9: shapes, strict keys, tags switch, reload_storage missing, enable_all recorded, deterministic ids."""
    import pytest

    a, b = fake_scheduler.FakeScheduler(), fake_scheduler.FakeScheduler()
    ids_a, ids_b = fake_scheduler.seed_live_like(a), fake_scheduler.seed_live_like(b)
    assert ids_a == ids_b and len(ids_a) == 12  # deterministic
    item = a.ws({"id": 1, "type": "scheduler/item", "schedule_id": ids_a["1"]})[0]["result"]
    assert list(item) == ["schedule_id", "entity_id", "name", "enabled", "weekdays", "start_date", "end_date", "repeat_type", "tags", "timeslots", "timestamps", "next_entries"]
    assert set(item["timeslots"][0]) == {"start", "stop", "conditions", "condition_type", "track_conditions", "actions"} and item["timeslots"][-1]["stop"] == "00:00:00"
    assert len(item["timestamps"]) == len(item["timeslots"]) and sorted(item["next_entries"]) == list(range(len(item["timeslots"])))
    assert all(ts.endswith("+03:00") for ts in item["timestamps"])
    unknown = a.ws({"id": 2, "type": "scheduler/item", "schedule_id": "nope00"})[0]
    assert unknown["success"] is True and unknown["result"] is None  # verified: an unknown id is success:true, result:null
    tags = a.ws({"id": 3, "type": "scheduler/tags"})[0]["result"]
    assert {t["name"]: len(t["schedules"]) for t in tags} == {"offices": 2, "outdoor": 2, "shabbat": 4}
    assert a.ws({"id": 4, "type": "manifest/get", "integration": "scheduler"})[0]["result"] == {"domain": "scheduler", "version": "3.3.8"}
    assert "reload_storage" not in a.ws({"id": 5, "type": "get_services"})[0]["result"]["scheduler"]
    with pytest.raises(fake_scheduler.ServiceNotFound):
        a.call_service("scheduler", "reload_storage", {})
    a.call_service("scheduler", "disable_all", {})
    assert [c["service"] for c in a.calls] == ["reload_storage", "disable_all"] and all(not i["enabled"] for i in a.items.values())
    with pytest.raises(fake_scheduler.FakeInvalid):
        a.call_service("scheduler", "add", {"name": "x", "repeat_type": "repeat", "timeslots": [], "mystery": 1})
    with pytest.raises(fake_scheduler.FakeInvalid):
        a.call_service("scheduler", "add", {"name": "x", "timeslots": []})  # repeat_type is required
    lax = fake_scheduler.FakeScheduler(strict_keys=False, accept_tags=False)
    lax.call_service("scheduler", "add", {"name": "x", "repeat_type": "repeat", "timeslots": [], "mystery": 1})
    with pytest.raises(fake_scheduler.FakeInvalid):
        lax.call_service("scheduler", "add", {"name": "x", "repeat_type": "repeat", "timeslots": [], "tags": ["t"]})
    gone = fake_scheduler.FakeScheduler(installed=False)
    assert gone.ws({"id": 1, "type": "scheduler"})[0] == {"id": 1, "type": "result", "success": False, "error": {"code": "unknown_command", "message": "Unknown command."}}
    # a rename keeps the entity id unless the component is told otherwise
    sid = ids_a["4"]
    entity = a.items[sid]["entity_id"]
    a.call_service("scheduler", "edit", {"entity_id": entity, "name": "Renamed"})
    assert a.items[sid]["entity_id"] == entity
    r = fake_scheduler.FakeScheduler(rename_changes_entity_id=True)
    rid_ = r._add({"name": "Before", "repeat_type": "repeat", "timeslots": []})
    old = r.items[rid_]["entity_id"]
    r.call_service("scheduler", "edit", {"entity_id": old, "name": "After"})
    assert r.items[rid_]["entity_id"] != old


def test_the_fake_event_modes():
    fake = fake_scheduler.FakeScheduler()
    assert fake.ws({"id": 9, "type": "scheduler_updated"})[0]["success"] is True
    sid = fake._add({"name": "x", "repeat_type": "repeat", "timeslots": []})
    frames = fake.pop_events()
    # verified sequences: create -> item_created + timer_updated (prefixed `scheduler_`), the subscription's id on every frame
    assert [f["event"]["event"] for f in frames] == ["scheduler_item_created", "scheduler_timer_updated"] and all(f["id"] == 9 and f["type"] == "event" and f["event"]["schedule_id"] == sid for f in frames)
    entity = fake.items[sid]["entity_id"]
    fake.call_service("switch", "turn_off", {"entity_id": entity})
    assert [f["event"]["event"] for f in fake.pop_events()] == ["scheduler_item_updated", "scheduler_timer_updated"]  # toggle
    fake.call_service("scheduler", "edit", {"entity_id": entity, "weekdays": ["mon"], "start_date": None, "end_date": None})
    assert [f["event"]["event"] for f in fake.pop_events()] == ["scheduler_item_updated", "scheduler_timer_updated"]  # an edit that keeps the name
    fake.call_service("scheduler", "edit", {"entity_id": entity, "name": "y", "start_date": None, "end_date": None})
    assert [f["event"]["event"] for f in fake.pop_events()] == ["scheduler_item_created", "scheduler_timer_updated"]  # a RENAME looks like a creation, with the same entity id
    assert fake.items[sid]["entity_id"] == entity
    fake.call_service("scheduler", "remove", {"entity_id": entity})
    assert [f["event"]["event"] for f in fake.pop_events()] == ["scheduler_item_removed"] and fake.pop_events() == []
    bus = fake_scheduler.FakeScheduler(event_mode="bus")
    bus.ws({"id": 3, "type": "scheduler_updated"})
    bsid = bus._add({"name": "x", "repeat_type": "repeat", "timeslots": []})
    frames = bus.pop_events()
    assert len(frames) == 1 and frames[0]["event"]["event_type"] == "scheduler_updated" and frames[0]["event"]["data"] == {}  # the bus event carries no id
    bus.call_service("scheduler", "remove", {"entity_id": bus.items[bsid]["entity_id"]})
    assert bus.pop_events() == []  # and none on remove
    none = fake_scheduler.FakeScheduler(event_mode="none")
    none.ws({"id": 9, "type": "scheduler_updated"})
    none._add({"name": "x", "repeat_type": "repeat", "timeslots": []})
    assert none.pop_events() == []
