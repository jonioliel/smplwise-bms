"""CR-014 schedules - the security review's findings (M1, M2, L3-L10, INFO a-c): copy and split are creates, the bridge's
learned id is verified against what was sent, idempotency keys cannot collide or leak, a preview knows only what the caller may
read, a locked condition cannot be diluted, "unchanged" means the same position, the feature-off gate on every read, and a
manager cannot create what they cannot see. Home Assistant is the fake; nothing real is contacted."""
from __future__ import annotations

import json

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import grant as _grant, place as _place, sched_app  # noqa: F401
from smplwise.services import ha_sync, schedule_ops, schedules

API = "/api/v1"
OMER = {"X-SW-Dev-User": "omer"}
PIN = "58302719"
READ = ["schedule.view", "devices.read", "entity.state.read"]


def _by_name(c, name, headers=None):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}, headers=headers or {}).json()["items"] if s["name"] == name)


def _legacy(app, fake, name, slots, weekdays=None):
    """A schedule made in Home Assistant's card (not through Arx), pulled into the mirror."""
    sid = fake._add({"name": name, "weekdays": weekdays or ["daily"], "repeat_type": "repeat", "timeslots": slots})
    schedules.MIRROR.pull(None, "test")
    return sid


def _slot(start, stop, service, entity, data=None):
    return {"start": start, "stop": stop, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [{"service": service, "entity_id": entity, "service_data": data or {}}]}


def _set_pin(c):
    assert c.put(f"{API}/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS).status_code == 200


def _boss(c, s):
    bind(c, s, "boss", "system_admin", "installation", "*")


def _no_code(c):
    assert c.put(f"{API}/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "disarm_policy": "no_code"}, headers=BOSS).status_code == 200


# ---------------------------------------------------------------- M1: copy and split are creates

def test_copy_of_a_legacy_disarm_on_a_panel_that_needs_a_code_is_refused(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _legacy(app, fake, "Legacy disarm", [_slot("06:00:00", None, "alarm_control_panel.alarm_disarm", "alarm_control_panel.home_panel")])
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["can"]["edit"] is True  # tolerated where it stands
    n = len(fake.bridge_calls)
    r = post_json(c, f"/schedules/{sid}/copy", {"name": "Copy", "client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 422 and r.json()["code"] == "disarm_not_allowed" and len(fake.bridge_calls) == n  # 2026-10-04: a copy is a new disarm
    allow_disarm(c)
    r = post_json(c, f"/schedules/{sid}/copy", {"name": "Copy", "client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 422 and r.json()["code"] == "alarm_code_needed" and len(fake.bridge_calls) == n


def test_copy_needs_the_lowering_confirmation_and_the_creators_code(sched_app):
    app, s, c, fake, tr = sched_app
    _boss(c, s)
    allow_disarm(c)
    sid = _legacy(app, fake, "Shed disarm", [_slot("06:00:00", None, "alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel")])
    body = lambda **kw: {"name": "Shed disarm 2", "client_request_id": rid(), **kw}  # noqa: E731
    r = post_json(c, f"/schedules/{sid}/copy", body())
    assert r.status_code == 409 and r.json()["code"] == "lowering_confirmation_required"
    r = post_json(c, f"/schedules/{sid}/copy", body(confirm_lowering=True))
    assert r.status_code == 409 and r.json()["code"] == "pin_not_set"
    _set_pin(c)
    assert post_json(c, f"/schedules/{sid}/copy", body(confirm_lowering=True)).json()["code"] == "code_required"
    assert post_json(c, f"/schedules/{sid}/copy", body(confirm_lowering=True, alarm_code="00000000")).json()["code"] == "wrong_code"
    n = len(fake.bridge_calls)
    assert n == 0 or fake.bridge_calls[-1]["op"] != "copy"
    r = post_json(c, f"/schedules/{sid}/copy", body(confirm_lowering=True, alarm_code=PIN))
    assert r.status_code == 201 and fake.bridge_calls[-1]["op"] == "copy" and PIN not in json.dumps(fake.bridge_calls) and PIN not in r.text


def test_split_needs_the_same_confirmation_and_code(sched_app):
    app, s, c, fake, tr = sched_app
    _boss(c, s)
    allow_disarm(c)
    sid = _legacy(app, fake, "Split disarm", [_slot("06:00:00", None, "alarm_control_panel.alarm_disarm", "alarm_control_panel.shed_panel")], weekdays=["sun", "mon", "tue"])
    cur = c.get(f"{API}/schedules/{sid}").json()
    body = lambda **kw: {"base_revision": cur["revision"], "days": ["tue"], "name": None, "confirm": True, "client_request_id": rid(), **kw}  # noqa: E731
    assert post_json(c, f"/schedules/{sid}/split", body()).json()["code"] == "lowering_confirmation_required"
    assert post_json(c, f"/schedules/{sid}/split", body(confirm_lowering=True)).json()["code"] == "pin_not_set"
    _set_pin(c)
    assert post_json(c, f"/schedules/{sid}/split", body(confirm_lowering=True)).json()["code"] == "code_required"
    assert not [x for x in fake.bridge_calls if x["op"] in ("add", "edit")]
    r = post_json(c, f"/schedules/{sid}/split", body(confirm_lowering=True, alarm_code=PIN))
    assert r.status_code == 200 and [x["op"] for x in fake.bridge_calls[-2:]] == ["add", "edit"]
    # a legacy disarm on a panel that needs a code cannot be split into a NEW schedule either
    other = _legacy(app, fake, "Coded split", [_slot("06:00:00", None, "alarm_control_panel.alarm_disarm", "alarm_control_panel.home_panel")], weekdays=["sun", "mon"])
    cur2 = c.get(f"{API}/schedules/{other}").json()
    r = post_json(c, f"/schedules/{other}/split", {"base_revision": cur2["revision"], "days": ["mon"], "confirm": True, "client_request_id": rid(), "confirm_lowering": True, "alarm_code": PIN})
    assert r.status_code == 422 and r.json()["code"] == "alarm_code_needed"


def test_copy_of_a_workday_schedule_keeps_its_days_and_tags_are_dropped(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _legacy(app, fake, "Workdays", [_slot("08:00:00", None, "light.turn_on", "light.office", {"brightness": 5})], weekdays=["workday"])
    r = post_json(c, f"/schedules/{sid}/copy", {"name": "Workdays 2", "client_request_id": rid()})
    assert r.status_code == 201 and r.json()["schedule"]["days"]["kind"] == "workday"


# ---------------------------------------------------------------- M2: the learned id is verified

def _lying_bridge(fake, pick):
    """The fake bridge answers as usual but names ANOTHER schedule (`pick(fake, resp)` -> (schedule_id, entity_id))."""
    real = fake.bridge_schedule

    def liar(msg, secret):
        resp = real(msg, secret)
        if resp.get("ok") and msg["op"] in ("add", "copy") and resp.get("schedule_id"):
            resp = {**resp, **dict(zip(("schedule_id", "entity_id"), pick(fake, resp)))}
        return resp

    fake.bridge_schedule = liar


def test_a_bridge_id_that_names_an_existing_schedule_is_never_trusted(sched_app):
    app, s, c, fake, tr = sched_app
    victim = _by_name(c, "Gym shutter")
    _lying_bridge(fake, lambda f, r: (victim["id"], victim["entity_id"]))
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Mine", ), "enabled": False, "client_request_id": rid()})
    assert r.status_code == 202 and r.json()["status"] == "unknown"
    assert not [x for x in fake.bridge_calls if x["op"] == "disable"]  # nothing was disabled through the learned id
    assert fake.items[victim["id"]]["enabled"] is True
    with app.state.db.connection(mode="read") as conn:
        m = conn.execute("SELECT created_via, created_by FROM schedule_meta WHERE schedule_id = ?", (victim["id"],)).fetchone()
        assert (m[0], m[1]) == ("external", None)  # not recorded as Arx's, no owner changed


def test_a_bridge_id_naming_different_content_is_unknown_and_a_failed_split_removes_nothing_it_did_not_make(sched_app):
    app, s, c, fake, tr = sched_app
    other = fake._add({"name": "Made in the card", "repeat_type": "repeat", "timeslots": [_slot("03:00:00", None, "light.turn_off", "light.office")]})
    schedules.MIRROR.pull(None, "t")
    _lying_bridge(fake, lambda f, r: (other, f.items[other]["entity_id"]))
    sch = _by_name(c, "Office light on weekdays")
    n = len(fake.bridge_calls)
    r = post_json(c, f"/schedules/{sch['id']}/split", {"base_revision": sch["revision"], "days": ["tue"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 502 and r.json()["code"] == "split_incomplete" and r.json()["details"]["created_id"] is None
    assert [x["op"] for x in fake.bridge_calls[n:]] == ["add"]  # no edit of the original, no remove of "Made in the card"
    assert other in fake.items


def test_adoption_needs_the_name_and_the_content(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    monkeypatch.setattr(schedule_ops, "_learn_by_diff", lambda w, expected, before: None)  # the diff finds nothing: the op stays unknown
    fake.hide_new_id = True
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Adopt me"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 202
    # someone makes a schedule with the same name but other content in Home Assistant first
    fake._add({"name": "Adopt me", "repeat_type": "repeat", "timeslots": [_slot("04:00:00", None, "light.turn_off", "light.office")]})
    schedules.MIRROR.pull(None, "t")
    both = [x for x in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"] if x["name"] == "Adopt me"]
    assert sorted(x["source"] for x in both) == ["arx", "external"]  # only the one with the content Arx sent was adopted
    theirs = next(x for x in both if x["source"] == "external")
    assert theirs["owner"] is None and theirs["slots"][0]["start"]["raw"] == "04:00:00"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT status FROM schedule_ops WHERE op = 'create' ORDER BY rowid DESC LIMIT 1").fetchone()[0] == "ok"  # the true one was adopted


def test_the_timeout_keeps_the_ops_identity_so_the_schedule_can_still_be_adopted(sched_app):
    app, s, c, fake, tr = sched_app
    fake.timeout_next.add("add")
    fake.hide_new_id = False
    body = {"draft": draft_of("Slow one"), "enabled": True, "client_request_id": rid()}
    real = fake.bridge_schedule

    def apply_then_time_out(msg, secret):
        if msg["op"] == "add":
            real(msg, secret)  # the component did apply it ...
            import httpx

            raise httpx.ReadTimeout("late")  # ... but the answer never came
        return real(msg, secret)

    fake.timeout_next.clear()
    fake.bridge_schedule = apply_then_time_out
    assert c.post(f"{API}/schedules", json=body).status_code == 504
    schedules.MIRROR.pull(None, "t")
    adopted = _by_name(c, "Slow one")
    assert adopted["source"] == "arx" and adopted["owner"]["username"] == "joni"


# ---------------------------------------------------------------- L3, L4: idempotency

def test_bulk_keys_do_not_collide_with_a_long_client_request_id(sched_app):
    app, s, c, fake, tr = sched_app
    ids = [_by_name(c, n)["id"] for n in ("Living room cooling on rest days", "Hall lights on rest days", "Office light on weekdays")]
    key = "k" * 80
    r = post_json(c, "/schedules/bulk", {"op": "disable", "ids": ids, "confirm": True, "client_request_id": key})
    assert [x["changed"] for x in r.json()["results"]] == [True, True, True]
    assert all(fake.items[i]["enabled"] is False for i in ids)


def test_a_key_replays_only_the_same_operation_on_the_same_schedule(sched_app):
    app, s, c, fake, tr = sched_app
    a, b = _by_name(c, "Bedroom 1 cooling on rest days")["id"], _by_name(c, "Hall lights on rest days")["id"]
    key = rid()
    assert post_json(c, f"/schedules/{a}/enable", {"client_request_id": key}).status_code == 200
    n = len(fake.bridge_calls)
    same = post_json(c, f"/schedules/{a}/enable", {"client_request_id": key})
    assert same.status_code == 200 and len(fake.bridge_calls) == n
    for path in (f"/schedules/{b}/enable", f"/schedules/{a}/disable"):
        r = post_json(c, path, {"client_request_id": key})
        assert r.status_code == 409 and r.json()["code"] == "idempotency_conflict"
    assert len(fake.bridge_calls) == n
    cp = rid()
    assert post_json(c, f"/schedules/{b}/copy", {"name": "B2", "client_request_id": cp}).status_code == 201
    assert post_json(c, f"/schedules/{a}/copy", {"name": "B3", "client_request_id": cp}).json()["code"] == "idempotency_conflict"


def test_a_replay_never_shows_more_than_the_caller_may_see_now(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    _place(c, ids["floor3"], "switch.hall_lights")
    _grant(c, "omer", "עורך קומה 2", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    key = rid()
    body = {"draft": draft_of("Mine"), "enabled": True, "client_request_id": key}
    r = c.post(f"{API}/schedules", json=body, headers=OMER)
    assert r.status_code == 201
    # the binding moves to floor 3: the schedule (on floor 2) is no longer his to see, so the old key shows nothing
    with app.state.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-09-30T09:00:00Z' WHERE subject_id = 'dev-omer'")
    _grant(c, "omer", "עורך קומה 3", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor3"])
    again = c.post(f"{API}/schedules", json=body, headers=OMER)
    assert again.status_code == 404 and again.json()["code"] == "schedule_not_found"


def test_two_identical_requests_racing_the_lock_reach_the_bridge_once(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    body = {"draft": draft_of("Race"), "enabled": True, "client_request_id": rid()}
    first = c.post(f"{API}/schedules", json=body)
    assert first.status_code == 201
    n = len(fake.bridge_calls)
    # the second request looked, found nothing (the lock was released around its fresh read), and only then meets the first op
    monkeypatch.setattr(schedule_ops, "_prev", lambda w, k: None)
    again = c.post(f"{API}/schedules", json=body)
    assert again.status_code == 201 and again.json()["schedule"]["id"] == first.json()["schedule"]["id"] and len(fake.bridge_calls) == n
    sid = first.json()["schedule"]["id"]
    body2 = {"client_request_id": rid()}
    assert post_json(c, f"/schedules/{sid}/disable", body2).json()["changed"] is True
    n = len(fake.bridge_calls)
    monkeypatch.setattr(schedule_ops, "_prev", lambda w, k: None)
    fake.items[sid]["enabled"] = True  # (so the second request sees a change to make)
    schedules.MIRROR.pull(None, "t")
    r = post_json(c, f"/schedules/{sid}/disable", body2)
    assert r.status_code == 200 and len(fake.bridge_calls) == n


def test_a_trash_item_is_claimed_before_the_bridge_is_called(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Gym shutter")
    out = post_json(c, f"/schedules/{sch['id']}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()}).json()
    tid = out["trash_id"]
    n = len(fake.bridge_calls)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE schedule_trash SET restored_at = '~restoring' WHERE id = ?", (tid,))  # another restore holds it
    r = post_json(c, f"/schedules/trash/{tid}/restore", {"client_request_id": rid()})
    assert r.status_code == 404 and r.json()["code"] == "trash_not_found" and len(fake.bridge_calls) == n
    with app.state.db.connection() as conn:
        conn.execute("UPDATE schedule_trash SET restored_at = NULL WHERE id = ?", (tid,))
    fake.fail_next["add"] = "invalid_payload"
    assert post_json(c, f"/schedules/trash/{tid}/restore", {"client_request_id": rid()}).status_code == 502
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT restored_at FROM schedule_trash WHERE id = ?", (tid,)).fetchone()[0] is None  # a refusal releases the claim
    fake.timeout_next.add("add")
    assert post_json(c, f"/schedules/trash/{tid}/restore", {"client_request_id": rid()}).status_code == 504
    assert post_json(c, f"/schedules/trash/{tid}/restore", {"client_request_id": rid()}).status_code == 404  # unknown outcome: not restored twice


# ---------------------------------------------------------------- L5, L10: what the caller may know and create

def test_a_preview_knows_only_what_the_caller_reads(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    _grant(c, "omer", "עורך קומה 2", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])

    def pv(entity, service="alarm_control_panel.alarm_arm_home", **data):
        r = post_json(c, "/schedules/preview", {"draft": draft_of("p", [slot("08:00:00", None, act(service, entity, **data))])}, OMER)
        assert r.status_code == 200
        return r.json()

    hidden = pv("alarm_control_panel.home_panel")
    missing = pv("alarm_control_panel.no_such_panel")
    assert hidden["errors"] == [{**missing["errors"][0], "path": hidden["errors"][0]["path"]}] and hidden["errors"][0]["code"] == "entity_unknown"  # exists or not: the same answer
    assert hidden["upcoming"][0]["summary"] == "" and hidden["sensitive"] is False and hidden["requires"]["alarm_code"] is False
    assert pv("climate.living_room", "climate.set_temperature", temperature=99)["errors"][0]["code"] == "entity_unknown"  # no range, no availability, no name
    ok = pv("light.office", "light.turn_on", brightness=10)
    assert ok["valid"] is True and ok["upcoming"][0]["summary"] == "הדלקה · Office light"
    # a numeric condition on a sensor the caller cannot read tells nothing about its state
    d = draft_of("p", conditions=[{"entity_id": "sensor.outdoor_temperature", "attribute": "state", "match_type": "above", "value": 28}])
    res = post_json(c, "/schedules/preview", {"draft": d}, OMER).json()
    assert [e["code"] for e in res["errors"]] == ["entity_unknown"]


def test_a_manager_cannot_create_a_schedule_they_could_not_see(sched_app):
    app, s, c, fake, tr = sched_app
    # manage + control everywhere, but no state read: the schedule would be hidden from its own creator
    _grant(c, "omer", "מנהל עיוור", ["schedule.view", "devices.control"], ["schedule.manage"], "installation", "*")
    r = c.post(f"{API}/schedules", json={"draft": draft_of("Blind"), "enabled": True, "client_request_id": rid()}, headers=OMER)
    assert r.status_code == 422 and r.json()["details"]["errors"][0]["code"] == "entity_unknown" and not fake.bridge_calls
    _grant(c, "omer", "קורא", ["entity.state.read"], [], "installation", "*")
    assert c.post(f"{API}/schedules", json={"draft": draft_of("Seen"), "enabled": True, "client_request_id": rid()}, headers=OMER).status_code == 201


# ---------------------------------------------------------------- L6: the review reuses the owner's access

def test_the_review_builds_one_access_per_owner(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    c.get(f"{API}/schedules")  # first pull
    with app.state.db.connection() as conn:
        conn.execute("UPDATE schedule_meta SET created_via = 'arx', created_by = 'dev-omer', created_by_username = 'omer'")
    from smplwise.services import schedule_view

    built = []
    real = schedule_view.Access.__init__

    def counting(self, conn, principal):
        built.append(principal.user_id if principal is not None else None)
        real(self, conn, principal)

    monkeypatch.setattr(schedule_view.Access, "__init__", counting)
    r = c.get(f"{API}/schedules/review")
    assert r.status_code == 200
    assert built.count("dev-omer") == 1 and len(built) <= 3, built  # the caller's, and the owner's once - not once per row


# ---------------------------------------------------------------- L7: a locked condition cannot be diluted

def test_adding_a_condition_beside_a_locked_one_needs_all_of_them(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    motion = cond("on", "binary_sensor.motion_hall")
    or_made = c.post(f"{API}/schedules", json={"draft": draft_of("Locked or", conditions=[motion]), "enabled": True, "client_request_id": rid()}).json()["schedule"]
    d_and = draft_of("Locked and", conditions=[motion])
    d_and["conditions"]["type"] = "and"
    and_made = c.post(f"{API}/schedules", json={"draft": d_and, "enabled": True, "client_request_id": rid()}).json()["schedule"]
    _grant(c, "omer", "עורך קומה 2", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])

    def attempt(made, ctype):
        cur = c.get(f"{API}/schedules/{made['id']}", headers=OMER).json()
        d = {"name": cur["name"], "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat": "repeat", "tags": [],
             "conditions": {"items": [motion, cond("on", SHABBAT)], "type": ctype, "track": False},  # the Shabbat sensor is readable to every schedule viewer
             "slots": [{"start": x["start"]["raw"], "stop": x["stop"]["raw"] if x["stop"] else None, "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": a["data"]} for a in x["actions"]]} for x in cur["slots"]]}
        return put_draft(c, made["id"], d, cur["revision"], OMER)

    r = attempt(or_made, "or")  # "any of them" with a readable extra condition could defeat the locked one
    assert r.status_code == 403 and r.json()["code"] == "condition_locked"
    assert attempt(or_made, "and").json()["code"] == "condition_locked"  # the type may not change while a locked condition exists
    r = attempt(and_made, "and")  # narrowing under "all of them" is fine
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- L8: unchanged means the same position

def test_a_tolerated_legacy_action_cannot_be_duplicated_into_new_slots(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _legacy(app, fake, "Legacy arm", [_slot("06:00:00", "07:00:00", "alarm_control_panel.alarm_arm_home", "alarm_control_panel.home_panel")])
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET attributes_json = ? WHERE entity_id = 'alarm_control_panel.home_panel'", (json.dumps({"code_format": "number", "code_arm_required": True, "supported_features": 7}),))
    _boss(c, s)
    _no_code(c)
    cur = c.get(f"{API}/schedules/{sid}").json()
    assert [w["code"] for w in cur["warnings"]] == ["alarm_may_need_code"]
    base = {"name": cur["name"], "weekdays": ["daily"], "start_date": None, "end_date": None, "repeat": "repeat", "tags": [], "conditions": {"items": [], "type": None, "track": False},
            "slots": [{"start": "06:30:00", "stop": "07:00:00", "actions": [{"service": "alarm_control_panel.alarm_arm_home", "entity_id": "alarm_control_panel.home_panel", "data": {}}]}]}
    assert put_draft(c, sid, base, cur["revision"]).status_code == 200  # the same action in the same place: only the time moved
    cur = c.get(f"{API}/schedules/{sid}").json()
    dup = json.loads(json.dumps(base))
    dup["slots"].append({"start": "08:00:00", "stop": "09:00:00", "actions": [dict(base["slots"][0]["actions"][0])]})
    r = put_draft(c, sid, dup, cur["revision"])
    assert r.status_code == 422 and r.json()["code"] == "alarm_code_needed"


# ---------------------------------------------------------------- L9: the feature-off gate on every read

def test_reads_answer_nothing_while_the_feature_is_off(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Gym shutter")
    post_json(c, f"/schedules/{sch['id']}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()})
    assert c.put(f"{API}/schedules/organisation", json={"folders": [{"id": "f1", "name": "Secret folder", "position": 0}], "items": []}).status_code == 200
    assert len(c.get(f"{API}/schedules/trash").json()["items"]) == 1 and c.get(f"{API}/schedules/organisation").json()["folders"]
    _grant(c, "omer", "מנהל", READ + ["devices.control"], ["schedule.manage"], "installation", "*")
    assert c.patch(f"{API}/settings", json={"schedules.enabled": "false"}).status_code == 200
    assert c.get(f"{API}/schedules/trash", headers=OMER).json() == {"items": []}
    assert c.get(f"{API}/schedules/organisation", headers=OMER).json() == {"folders": [], "items": []}
    assert c.get(f"{API}/schedules/condition-candidates", headers=OMER).json() == {"entities": [], "truncated": False}
    r = post_json(c, "/schedules/preview", {"draft": draft_of("x")}, OMER)
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled"
    assert c.get(f"{API}/schedules/condition-candidates").json()["entities"]  # the administrator setting the feature up still sees the picker


# ---------------------------------------------------------------- INFO a-c

def test_a_code_typed_in_home_assistant_never_stays_in_arxs_database(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _legacy(app, fake, "Has a code", [_slot("06:00:00", None, "alarm_control_panel.alarm_arm_home", "alarm_control_panel.shed_panel", {"code": "8642"})])
    d = c.get(f"{API}/schedules/{sid}").json()
    assert d["can"]["edit"] is False and d["slots"][0]["unsupported"][0]["code"] == "contains_code" and "8642" not in json.dumps(d)
    with app.state.db.connection() as conn:
        assert "8642" not in json.dumps([list(map(str, r)) for r in conn.execute("SELECT * FROM schedule_cache").fetchall()])
    out = post_json(c, f"/schedules/{sid}/delete", {"base_revision": d["revision"], "confirm": True, "client_request_id": rid()})
    assert out.status_code == 200  # the safety valve for a schedule that is not understood
    with app.state.db.connection() as conn:
        assert "8642" not in json.dumps([list(map(str, r)) for r in conn.execute("SELECT * FROM schedule_trash").fetchall()])
    fake.items[sid] if sid in fake.items else None


def test_the_shabbat_sensor_is_shown_only_to_schedule_viewers(sched_app):
    app, s, c, fake, tr = sched_app
    assert c.get(f"{API}/schedules/status").json()["settings"]["shabbat_sensor"]["entity_id"] == SHABBAT
    bind(c, s, "vera", "viewer", "installation", "*")
    st = c.get(f"{API}/schedules/status", headers={"X-SW-Dev-User": "vera"}).json()
    assert st["settings"]["shabbat_sensor"] is None and st["can"]["view"] is False


def test_the_shabbat_sensor_must_be_a_calendar_sensor_unless_forced(sched_app):
    app, s, c, fake, tr = sched_app
    r = c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "binary_sensor.motion_hall"})
    assert r.status_code == 422 and r.json()["code"] == "not_calendar_sensor"
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "binary_sensor.issur_melacha_in_effect", "state": "off", "attributes": {"friendly_name": "Issur melacha"}, "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"})
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "binary_sensor.issur_melacha_in_effect"}).status_code == 200
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "binary_sensor.motion_hall", "schedules.shabbat_sensor_force": True}).status_code == 200
    assert c.get(f"{API}/settings").json()["settings"]["schedules.shabbat_sensor"] == "binary_sensor.motion_hall"
    assert "schedules.shabbat_sensor_force" not in c.get(f"{API}/settings").json()["settings"]  # the override is never stored
