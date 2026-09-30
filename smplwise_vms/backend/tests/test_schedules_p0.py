"""CR-014 schedules - the phase-0 WRITE verification of 2026-09-30 on the lab component (HA 2026.9.4), applied: the write
normaliser and its round-trip equivalence, the dates every edit must carry, ids learned by diff (no return_response), the
component's event frames, `scheduler/item` for an unknown id, run_action's `time`, the verified capabilities, `single` /
`pause`, copy, and the fake behaving identically. The fake is checked against the FACTS the lab run recorded; nothing
private is in here."""
from __future__ import annotations

import copy
import datetime as dt

import pytest
from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from fake_scheduler import FakeCrash, FakeInvalid, FakeScheduler
from smplwise.services import schedule_model as m
from smplwise.services import schedules

API = "/api/v1"


def _by_name(c, name):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"] if s["name"] == name)


def _plain_fake():
    fake = FakeScheduler()
    fake.world = fake_scheduler.world_states()
    return fake


def _write_ready(item):
    """What Arx would send to re-create / edit this item: the normalised write form of every slot."""
    return {"name": item["name"], "weekdays": list(item["weekdays"]), "repeat_type": item["repeat_type"], "tags": list(item["tags"]),
            "timeslots": [m.component_slot(t) for t in item["timeslots"]],
            **({"start_date": item["start_date"]} if item["start_date"] else {}), **({"end_date": item["end_date"]} if item["end_date"] else {})}


# ---------------------------------------------------------------- 1. the write normaliser

def test_round_trip_equivalence_read_normalise_write_read():
    """Every seeded pattern (points, nulls, conditions, sun times, multi-action, a script without an entity, seasons): what the
    component reads back after Arx's normalised write equals what it read before - the equivalence that replaces
    "byte-identical re-send"."""
    src = _plain_fake()
    fake_scheduler.seed_live_like(src)
    dst = _plain_fake()
    for item in src.items.values():
        dst.call_service("scheduler", "add", _write_ready(item))
    for original, copy_ in zip(src.items.values(), dst.items.values()):
        for key in ("name", "weekdays", "start_date", "end_date", "repeat_type", "tags", "timeslots"):
            assert copy_[key] == original[key], (original["name"], key)


def test_the_fake_refuses_what_the_real_component_refuses():
    fake = _plain_fake()
    ok_slot = {"start": "03:15:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]}

    def add(slot=None, **top):
        return fake.call_service("scheduler", "add", {"name": "t", "repeat_type": "repeat", "weekdays": ["daily"], "timeslots": [{**ok_slot, **(slot or {})}], **top})

    add()
    add({"stop": "03:45:00"}); add({"start": "03:15"}); add({"start": "sunrise-00:15:00", "stop": "sunset+01:00:00"})  # HH:MM and negative offsets are fine
    for crash in ({"stop": None},):
        with pytest.raises(FakeCrash):  # a TypeError inside the component: unknown_error
            add(crash)
    bad_slots = [{"actions": [{"service": "light.turn_on", "entity_id": None}]}, {"actions": [{"service": "light.turn_on", "entity_id": ""}]}, {"conditions": []},
                 {"conditions": [{"entity_id": "sun.sun", "match_type": "is", "value": "on"}], "condition_type": None}, {"conditions": [{"entity_id": "sun.sun", "match_type": "is", "value": "on"}], "track_conditions": None},
                 {"actions": [{"service": "light.turn_on", "service_data": None}]}, {"start": "sunset"}, {"start": "SUNSET+00:10:00"}, {"start": "24:00:00"}, {"start": "3:15pm"},
                 {"conditions": [{"entity_id": "sun.sun", "value": "on"}]}, {"mystery": 1}]
    for bad in bad_slots:
        with pytest.raises(FakeInvalid):
            add(bad)
    for bad_top in ({"weekdays": []}, {"weekdays": None}, {"weekdays": ["mon", "mon"]}, {"weekdays": ["MON"]}, {"enabled": True}, {"schedule_id": "abcdef"}, {"repeat_type": "weekly"}):
        with pytest.raises(FakeInvalid):
            add(**bad_top)
    # accepted: an unknown service, a nonexistent entity (Arx's own allow-list is the only guard), an optional attribute, a bool / int / float value, track without stop
    fake.call_service("scheduler", "add", {"name": "ok", "repeat_type": "repeat", "timeslots": [{"start": "03:15:00", "conditions": [{"entity_id": "sensor.nowhere", "match_type": "above", "value": 2.5}, {"entity_id": "x.y", "match_type": "is", "value": True, "attribute": None}],
                                                                                              "condition_type": "and", "track_conditions": True, "actions": [{"service": "made_up.service", "entity_id": "light.nowhere"}]}]})
    # weekdays: omitted -> daily; tags: a string is coerced to a list, [] clears
    fake.call_service("scheduler", "add", {"name": "d", "repeat_type": "repeat", "timeslots": [], "tags": "solo"})
    item = next(i for i in fake.items.values() if i["name"] == "d")
    assert item["weekdays"] == ["daily"] and item["tags"] == ["solo"]
    fake.call_service("scheduler", "edit", {"entity_id": item["entity_id"], "tags": []})
    assert item["tags"] == []


def test_add_edit_copy_remove_return_nothing_and_ids_are_learned_by_diff():
    fake = _plain_fake()
    assert fake.call_service("scheduler", "add", {"name": "a", "repeat_type": "repeat", "timeslots": []}) is None  # no return_response, no id
    sid = next(iter(fake.items))
    entity = fake.items[sid]["entity_id"]
    assert fake.call_service("scheduler", "edit", {"entity_id": entity, "name": "b", "start_date": None, "end_date": None}) is None
    assert fake.call_service("scheduler", "copy", {"entity_id": entity, "name": "c"}) is None and len(fake.items) == 2
    assert fake.call_service("scheduler", "remove", {"entity_id": entity}) is None
    with pytest.raises(FakeInvalid, match="Entity not found"):  # edit / remove / copy on a missing entity
        fake.call_service("scheduler", "remove", {"entity_id": entity})
    with pytest.raises(FakeInvalid, match="Entity not found"):
        fake.call_service("scheduler", "copy", {"entity_id": "switch.schedule_gone", "name": "x"})


def test_the_add_on_learns_the_new_id_by_diffing_the_component_list(sched_app):
    """The bridge cannot get an id out of the component (`add` returns nothing): when it answers without one the add-on
    diffs the component's own list (immediate) and takes the ONE new item with the content it sent."""
    app, s, c, fake, tr = sched_app
    c.get(f"{API}/schedules")
    fake.hide_new_id = True
    n_pulls = tr.ws_calls.count("scheduler")
    r = c.post(f"{API}/schedules", json={"draft": draft_of("By diff"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 201 and r.json()["schedule"]["name"] == "By diff" and r.json()["schedule"]["source"] == "arx"
    assert tr.ws_calls.count("scheduler") == n_pulls + 1  # the diff read the list once
    # two new items with the same content: never guess
    twin = dict(_write_ready(next(i for i in fake.items.values() if i["name"] == "By diff")), name="Twin")
    fake.hide_new_id = True
    real = fake.bridge_schedule

    def make_two(msg, secret):
        resp = real(msg, secret)
        if msg["op"] == "add":
            fake.call_service("scheduler", "add", {**msg["payload"]})  # a second identical schedule appears in HA at the same moment
        return resp

    fake.bridge_schedule = make_two
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Twin"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 202 and r.json()["status"] == "unknown"
    assert twin["name"] == "Twin"


# ---------------------------------------------------------------- 2. edits carry the dates

def test_an_edit_that_omits_the_dates_wipes_them_in_the_component():
    fake = _plain_fake()
    fake.call_service("scheduler", "add", {"name": "season", "repeat_type": "repeat", "start_date": "2026-10-31", "end_date": "2027-03-31", "timeslots": []})
    item = next(iter(fake.items.values()))
    fake.call_service("scheduler", "edit", {"entity_id": item["entity_id"], "name": "renamed", "start_date": "2026-10-31", "end_date": "2027-03-31"})
    assert (item["start_date"], item["end_date"]) == ("2026-10-31", "2027-03-31")
    fake.call_service("scheduler", "edit", {"entity_id": item["entity_id"], "name": "again"})  # a name-only edit WITHOUT the dates
    assert (item["start_date"], item["end_date"]) == (None, None)  # verified: both reset to null; the other fields survive
    assert item["name"] == "again" and item["weekdays"] == ["daily"] and item["repeat_type"] == "repeat"


def test_a_name_only_edit_through_arx_preserves_the_season_dates(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Yard light in season")
    sid = sch["id"]
    assert (sch["start_date"], sch["end_date"]) == ("2026-10-31", "2027-03-31")
    draft = {"name": "Yard light in season (renamed)", "weekdays": ["daily"], "start_date": sch["start_date"], "end_date": sch["end_date"], "repeat": "repeat", "tags": ["outdoor"],
             "conditions": {"items": [], "type": None, "track": False},
             "slots": [{"start": x["start"]["raw"], "stop": x["stop"]["raw"] if x["stop"] else None, "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": a["data"]} for a in x["actions"]]} for x in sch["slots"]]}
    r = put_draft(c, sid, draft, sch["revision"])
    assert r.status_code == 200, r.text
    assert fake.bridge_calls[-1]["payload"] == {"name": "Yard light in season (renamed)", "start_date": "2026-10-31", "end_date": "2027-03-31"}
    assert (fake.items[sid]["start_date"], fake.items[sid]["end_date"]) == ("2026-10-31", "2027-03-31")
    assert (r.json()["schedule"]["start_date"], r.json()["schedule"]["end_date"]) == ("2026-10-31", "2027-03-31")
    # removing the season is an explicit null
    draft["start_date"] = draft["end_date"] = None
    cur = c.get(f"{API}/schedules/{sid}").json()
    assert put_draft(c, sid, draft, cur["revision"]).status_code == 200
    assert fake.bridge_calls[-1]["payload"] == {"start_date": None, "end_date": None} and fake.items[sid]["start_date"] is None


def test_every_edit_payload_that_is_sent_carries_both_dates():
    item = {"schedule_id": "aaaaaa", "name": "n", "weekdays": ["daily"], "start_date": "2026-10-31", "end_date": None, "repeat_type": "repeat", "tags": [], "timeslots": []}
    d = {"name": "n2", "weekdays": ["daily"], "start_date": "2026-10-31", "end_date": None, "repeat": "repeat", "tags": [], "conditions": {"items": [], "type": None, "track": False}, "slots": []}
    p = m.to_component_payload(d, item)
    assert p == {"name": "n2", "start_date": "2026-10-31", "end_date": None}
    assert m.to_component_payload({**d, "name": "n"}, item) == {}  # nothing changed: nothing sent


# ---------------------------------------------------------------- 3. events, unknown items, the subscription

def test_the_mirror_reads_the_components_prefixed_frames_and_never_trusts_item_created_as_a_new_id(sched_app):
    app, s, c, fake, tr = sched_app
    c.get(f"{API}/schedules")
    fake.ws({"id": 5, "type": "scheduler_updated"})
    sid = _by_name(c, "Hall lights on rest days")["id"]
    n = len(tr.ws_calls)
    schedules.MIRROR.on_component_event({"id": 5, "type": "event", "event": {"event": "scheduler_timer_updated", "schedule_id": sid}})
    schedules.MIRROR.on_component_event({"id": 5, "type": "event", "event": {"event": "scheduler_timer_finished", "schedule_id": sid}})
    assert len(tr.ws_calls) == n  # timers are not changes
    # a RENAME: item_created + timer_updated for an entity that already exists - the cache row keeps its id
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[sid]["entity_id"], "name": "Renamed hall", "weekdays": ["daily"], "start_date": None, "end_date": None})
    for frame in fake.pop_events():
        schedules.MIRROR.on_component_event(frame)
    row = _by_name(c, "Renamed hall")
    assert row["id"] == sid and row["entity_id"] == fake.items[sid]["entity_id"] and row["source"] == "external"  # not a new schedule, not adopted
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM schedule_cache WHERE schedule_id = ?", (sid,)).fetchone()[0] == 1


def test_scheduler_item_of_an_unknown_id_drops_the_cache_row(sched_app):
    app, s, c, fake, tr = sched_app
    c.get(f"{API}/schedules")
    sid = _by_name(c, "Gym shutter")["id"]
    fake.items.pop(sid)  # removed in HA, no event
    assert fake.ws({"id": 1, "type": "scheduler/item", "schedule_id": sid})[0] == {"id": 1, "type": "result", "success": True, "result": None}
    assert schedules.MIRROR.fetch_item(sid) is None
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM schedule_cache WHERE schedule_id = ?", (sid,)).fetchone()[0] == 0


# ---------------------------------------------------------------- 4. capabilities

def test_tags_and_negative_sun_offsets_are_written(sched_app):
    app, s, c, fake, tr = sched_app
    d = draft_of("Tagged", [slot("sunrise-00:15:00", "sunrise+01:00:00", act("light.turn_on", "light.office", brightness=30))], tags=["morning", "outdoor"])
    r = c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid()})
    assert r.status_code == 201, r.text
    sch = r.json()["schedule"]
    assert fake.bridge_calls[-1]["payload"]["tags"] == ["morning", "outdoor"] and sch["tags"] == ["morning", "outdoor"]
    assert sch["slots"][0]["start"] == {"kind": "sun", "event": "sunrise", "offset_min": -15, "raw": "sunrise-00:15:00"}
    d2 = copy.deepcopy(d)
    d2["tags"] = []
    assert put_draft(c, sch["id"], d2, sch["revision"]).status_code == 200
    assert fake.bridge_calls[-1]["payload"]["tags"] == [] and fake.items[sch["id"]]["tags"] == []  # [] clears
    assert c.get(f"{API}/schedules/status").json()["capabilities"] == {"tags": True, "negative_sun_offset": True}


# ---------------------------------------------------------------- 5. run_action

def test_run_action_semantics_of_the_component():
    fake = _plain_fake()
    fake.call_service("scheduler", "add", {"name": "run", "repeat_type": "repeat", "timeslots": [
        {"start": "22:00:00", "stop": "02:00:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]},  # wraps midnight
        {"start": "12:00", "stop": "13:00:00", "actions": [{"service": "light.turn_off", "entity_id": "light.office"}]}]})
    entity = next(iter(fake.items.values()))["entity_id"]

    def run(time=None, **kw):
        n = len(fake.actions_fired)
        fake.call_service("scheduler", "run_action", {"entity_id": entity, **({"time": time} if time else {}), **kw})
        return len(fake.actions_fired) - n

    assert run("22:00:00") == 1 and run("01:59:59") == 1 and run("12:00") == 1  # start inclusive, wrap-aware, HH:MM accepted
    assert run("02:00:00") == 0 and run("13:00:00") == 0 and run("15:00:00") == 0  # stop exclusive; outside every slot: a SILENT no-op
    with pytest.raises(FakeInvalid):
        run("sunset+00:10:00")  # sun forms are not accepted: the add-on resolves them
    fake.call_service("scheduler", "run_action", {"entity_id": "switch.schedule_nowhere", "time": "22:00:00"})  # a missing entity: a silent success
    fake.call_service("switch", "turn_off", {"entity_id": entity})
    assert run("22:00:00") == 1  # works on a disabled schedule
    fake.world["binary_sensor.shabbat_mode"]["state"] = "off"
    fake.items[next(iter(fake.items))]["timeslots"][0]["conditions"] = [{"entity_id": "binary_sensor.shabbat_mode", "attribute": None, "value": "on", "match_type": "is"}]
    assert run("22:00:00") == 0 and run("22:00:00", skip_conditions=True) == 1  # failing conditions block unless skip_conditions


def test_run_now_sends_a_resolved_time(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Yard light in season")  # slot 0 starts at sunset+00:30 (sunset 18:15 local in the mirror)
    r = post_json(c, f"/schedules/{sch['id']}/run", {"slot_index": 0, "client_request_id": rid()})
    assert r.status_code == 202 and fake.bridge_calls[-1]["time"] == "18:45:00"  # HH:MM:SS for today, never a sun form


# ---------------------------------------------------------------- 6. single, pause, copy

def test_single_deletes_itself_and_pause_disables_after_the_slot():
    fake = _plain_fake()
    slot_ = {"start": "13:05:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]}  # the clock is 13:00 local
    fake.call_service("scheduler", "add", {"name": "one shot", "repeat_type": "single", "timeslots": [slot_]})
    fake.call_service("scheduler", "add", {"name": "paused", "repeat_type": "pause", "timeslots": [slot_]})
    fake.call_service("scheduler", "add", {"name": "plain", "repeat_type": "repeat", "timeslots": [slot_]})
    single, paused, plain = list(fake.items)
    fake.events.clear()
    fake.tick(6 * 60)
    assert {i["name"]: i["enabled"] for i in fake.items.values()} == {"one shot": True, "paused": True, "plain": True}
    assert [f["schedule_id"] for f in fake.actions_fired] == [single, paused, plain] and all(fake.states[i]["state"] == "triggered" for i in fake.items)
    fake.tick(61)  # ~60 s after the slot start
    assert single not in fake.items and fake.items[paused]["enabled"] is False and fake.states[paused]["state"] == "off" and fake.items[plain]["enabled"] is True
    names = [n for n, _ in fake.events]
    assert "item_removed" in names and "item_updated" in names and names.count("timer_finished") == 3


def test_copy_keeps_everything_and_derives_the_entity_id_from_the_name():
    fake = _plain_fake()
    fake.call_service("scheduler", "add", {"name": "Source", "repeat_type": "repeat", "tags": ["t"], "timeslots": [{"start": "03:15:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]}]})
    src = next(iter(fake.items.values()))
    fake.call_service("switch", "turn_off", {"entity_id": src["entity_id"]})
    fake.call_service("scheduler", "copy", {"entity_id": src["entity_id"], "name": "Named copy"})
    fake.call_service("scheduler", "copy", {"entity_id": src["entity_id"]})  # no name: the source's name is duplicated
    fake.call_service("scheduler", "copy", {"entity_id": src["entity_id"]})
    items = list(fake.items.values())
    named, dup1, dup2 = items[1], items[2], items[3]
    assert named["name"] == "Named copy" and named["entity_id"] == "switch.schedule_named_copy" and named["enabled"] is False and named["tags"] == ["t"] and named["timeslots"] == src["timeslots"]
    assert dup1["name"] == dup2["name"] == "Source" and dup1["entity_id"] == "switch.schedule_source_2" and dup2["entity_id"] == "switch.schedule_source_3"  # collisions get _2, _3
    fake.call_service("scheduler", "edit", {"entity_id": src["entity_id"], "name": "Renamed", "start_date": None, "end_date": None})
    assert src["entity_id"] == "switch.schedule_source" and fake.states[src["schedule_id"]]["attributes"]["friendly_name"] == "Scheduler Renamed"  # a rename keeps the entity id


def test_the_bridge_reports_the_components_error_names(sched_app):
    app, s, c, fake, tr = sched_app
    from smplwise.services import ha_bridge

    secret = c.get(f"{API}/ha/bridge/pairing").json()["pairing_code"]

    def add(slot_):
        body = {"user_id": "dev-joni", "op": "add", "request_id": "opx", "schedule_id": None, "schedule_entity_id": None, "name": None, "time": None, "skip_conditions": False, "sensitive": False,
                "payload": {"weekdays": ["daily"], "repeat_type": "repeat", "name": "bad", "timeslots": [slot_]}}
        return fake.bridge_schedule(ha_bridge.sign(secret, body), secret)

    # a payload the component would refuse (Arx never builds one): a schema error is invalid_format, a TypeError unknown_error
    assert add({"start": "03:15:00", "conditions": [], "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]})["error"] == "invalid_format"
    assert add({"start": "03:15:00", "stop": None, "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]})["error"] == "unknown_error"
    assert add({"start": "03:15:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]})["ok"] is True
