"""CR-014 schedules - owner rule: only a CREATE is enabled by default. Editing a disabled schedule never turns it back on; a
copy of a disabled source stays disabled; a split keeps the source's state on both halves; a restore brings back the state the
schedule had. Whether the component's `edit` keeps a disabled schedule disabled is UNVERIFIED on the lab (the phase-0 edits
were all made on enabled schedules; a `copy` of a disabled schedule stays disabled - verified), so the service reads the state
back and re-applies the disable through the ordinary bridge path (`FakeScheduler(edit_resets_enabled=True)` is the worst case);
a failure is a warning and the review issue `requested_disabled`."""
from __future__ import annotations

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from fake_scheduler import FakeScheduler

API = "/api/v1"


def _by_name(c, name):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"] if s["name"] == name)


def _draft(sch, **change):
    d = {"name": sch["name"], "weekdays": list(sch["days"]["tokens"]), "start_date": sch["start_date"], "end_date": sch["end_date"], "repeat": sch["repeat"], "tags": list(sch["tags"]),
         "conditions": {"items": [{k: v for k, v in i.items() if k in ("entity_id", "attribute", "match_type", "value")} for i in sch["conditions"]["items"]], "type": sch["conditions"]["type"], "track": sch["conditions"]["track"]},
         "slots": [{"start": x["start"]["raw"], "stop": x["stop"]["raw"] if x["stop"] else None, "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": dict(a["data"])} for a in x["actions"]]} for x in sch["slots"]]}
    d.update(change)
    return d


# ---------------------------------------------------------------- the fake

def test_the_fake_keeps_the_switch_state_across_an_edit_by_default():
    fake = FakeScheduler()
    fake.world = fake_scheduler.world_states()
    fake.call_service("scheduler", "add", {"name": "s", "repeat_type": "repeat", "timeslots": [{"start": "03:15:00", "actions": [{"service": "light.turn_on", "entity_id": "light.office"}]}]})
    sid = next(iter(fake.items))
    entity = fake.items[sid]["entity_id"]
    fake.call_service("switch", "turn_off", {"entity_id": entity})
    for change in ({"name": "renamed"}, {"weekdays": ["mon"]}, {"timeslots": [{"start": "04:00:00", "actions": [{"service": "light.turn_off", "entity_id": "light.office"}]}]}):
        fake.call_service("scheduler", "edit", {"entity_id": entity, "start_date": None, "end_date": None, **change})
        assert fake.items[sid]["enabled"] is False and fake.states[sid]["state"] == "off"
    fake.call_service("switch", "turn_on", {"entity_id": entity})
    fake.call_service("scheduler", "edit", {"entity_id": entity, "name": "again", "start_date": None, "end_date": None})
    assert fake.items[sid]["enabled"] is True


# ---------------------------------------------------------------- the service

def test_editing_a_disabled_schedule_keeps_it_disabled_and_an_enabled_one_enabled(sched_app):
    app, s, c, fake, tr = sched_app
    off = _by_name(c, "Bedroom 1 cooling on rest days")  # disabled
    on = _by_name(c, "Office light on weekdays")  # enabled
    assert off["enabled"] is False and on["enabled"] is True
    for sch, want in ((off, False), (on, True)):
        for change in ({"name": sch["name"] + " x"}, {"weekdays": ["mon", "tue"]}, {}):
            cur = c.get(f"{API}/schedules/{sch['id']}").json()
            d = _draft(cur, **change)
            if not change:
                d["slots"][0]["start"] = "06:30:00"  # a slot edit
            r = put_draft(c, sch["id"], d, cur["revision"])
            assert r.status_code == 200, r.text
            assert r.json()["schedule"]["enabled"] is want and fake.items[sch["id"]]["enabled"] is want, (sch["name"], change)
    assert not [x for x in fake.bridge_calls if x["op"] in ("enable", "disable")]  # the component kept the state: nothing to re-apply


def test_when_an_edit_would_re_enable_it_arx_disables_it_again(sched_app):
    app, s, c, fake, tr = sched_app
    fake.edit_resets_enabled = True  # the worst case
    off = _by_name(c, "Bedroom 1 cooling on rest days")
    cur = c.get(f"{API}/schedules/{off['id']}").json()
    r = put_draft(c, off["id"], _draft(cur, name="Renamed while off"), cur["revision"])
    assert r.status_code == 200 and r.json()["schedule"]["enabled"] is False and fake.items[off["id"]]["enabled"] is False
    assert [x["op"] for x in fake.bridge_calls[-2:]] == ["edit", "disable"] and r.json()["schedule"]["warnings"] == []
    # an enabled schedule is left alone
    on = _by_name(c, "Office light on weekdays")
    cur = c.get(f"{API}/schedules/{on['id']}").json()
    n = len(fake.bridge_calls)
    assert put_draft(c, on["id"], _draft(cur, name="Renamed while on"), cur["revision"]).status_code == 200
    assert [x["op"] for x in fake.bridge_calls[n:]] == ["edit"] and fake.items[on["id"]]["enabled"] is True


def test_when_the_disable_fails_it_is_a_warning_and_a_review_issue(sched_app):
    app, s, c, fake, tr = sched_app
    fake.edit_resets_enabled = True
    off = _by_name(c, "Bedroom 1 cooling on rest days")
    cur = c.get(f"{API}/schedules/{off['id']}").json()
    fake.fail_next["disable"] = "unauthorized"
    r = put_draft(c, off["id"], _draft(cur, name="Renamed, still on"), cur["revision"])
    assert r.status_code == 200 and r.json()["schedule"]["enabled"] is True
    assert [w["code"] for w in r.json()["schedule"]["warnings"]] == ["not_disabled"]
    review = {i["schedule"]["name"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "requested_disabled" in review["Renamed, still on"]
    assert post_json(c, f"/schedules/{off['id']}/disable", {"client_request_id": rid()}).status_code == 200  # the person disables it: the issue goes
    assert "Renamed, still on" not in {i["schedule"]["name"] for i in c.get(f"{API}/schedules/review").json()["items"]}


def test_copy_of_a_disabled_source_stays_disabled_and_of_an_enabled_one_enabled(sched_app):
    app, s, c, fake, tr = sched_app
    off = _by_name(c, "Bedroom 1 cooling on rest days")
    on = _by_name(c, "Hall lights on rest days")
    a = post_json(c, f"/schedules/{off['id']}/copy", {"name": "Copy of off", "client_request_id": rid()}).json()["schedule"]
    b = post_json(c, f"/schedules/{on['id']}/copy", {"name": "Copy of on", "client_request_id": rid()}).json()["schedule"]
    assert a["enabled"] is False and b["enabled"] is True and fake.items[a["id"]]["enabled"] is False
    fake.edit_resets_enabled = False
    real = fake.call_service

    def copy_enables(domain, service, data=None, user=None):  # a copy that comes out enabled whatever the source: the service disables it
        out = real(domain, service, data, user)
        if service == "copy":
            newest = list(fake.items.values())[-1]
            newest["enabled"] = True
            fake._sync_state(newest["schedule_id"])
        return out

    fake.call_service = copy_enables
    c2 = post_json(c, f"/schedules/{off['id']}/copy", {"name": "Copy of off 2", "client_request_id": rid()}).json()["schedule"]
    assert c2["enabled"] is False and fake.bridge_calls[-1]["op"] == "disable"


def test_split_keeps_the_sources_state_on_both_halves(sched_app):
    app, s, c, fake, tr = sched_app
    for disabled in (True, False):
        sid = fake._add({"name": f"Split {'off' if disabled else 'on'}", "weekdays": ["sun", "mon", "tue"], "repeat_type": "repeat",
                         "timeslots": [{"start": "06:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {"brightness": 9}}]}]})
        if disabled:
            fake.items[sid]["enabled"] = False
            fake._sync_state(sid)
        from smplwise.services import schedules

        schedules.MIRROR.pull(None, "t")
        sch = _by_name(c, f"Split {'off' if disabled else 'on'}")
        fake.edit_resets_enabled = disabled  # the original's edit would re-enable it: it is disabled again
        r = post_json(c, f"/schedules/{sid}/split", {"base_revision": sch["revision"], "days": ["tue"], "confirm": True, "client_request_id": rid()})
        assert r.status_code == 200, r.text
        assert r.json()["original"]["enabled"] is (not disabled) and r.json()["created"]["enabled"] is (not disabled)
        assert fake.items[sid]["enabled"] is (not disabled) and fake.items[r.json()["created"]["id"]]["enabled"] is (not disabled)


def test_restore_brings_back_the_state_the_schedule_had(sched_app):
    app, s, c, fake, tr = sched_app
    for name, enabled in (("Bedroom 1 cooling on rest days", False), ("Office light on weekdays", True)):
        sch = _by_name(c, name)
        out = post_json(c, f"/schedules/{sch['id']}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()}).json()
        r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
        assert r.status_code == 201 and r.json()["schedule"]["enabled"] is enabled, name
        assert fake.items[r.json()["schedule"]["id"]]["enabled"] is enabled


def test_only_a_create_is_enabled_by_default(sched_app):
    app, s, c, fake, tr = sched_app
    on = c.post(f"{API}/schedules", json={"draft": draft_of("Default"), "client_request_id": rid()}).json()["schedule"]
    off = c.post(f"{API}/schedules", json={"draft": draft_of("Explicit off"), "enabled": False, "client_request_id": rid()}).json()["schedule"]
    assert on["enabled"] is True and off["enabled"] is False
