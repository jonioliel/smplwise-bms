"""CR-014 schedules - the second security re-review (R1, R3, R5): an `unknown` create / copy / split / restore keeps what it
asked for (disabled!), is audited, and an adoption finishes it (disables the schedule, takes the moved days off the original,
finalises the trash claim) with its own audit row; a stuck trash claim is released after the adoption window; the settings
override of the calendar-sensor check is on the record; copy / split / restore of a schedule with a locked condition say why."""
from __future__ import annotations

import datetime as dt
import json

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import grant as _grant, place as _place, sched_app  # noqa: F401
from smplwise.services import schedule_ops, schedules

API = "/api/v1"
OMER = {"X-SW-Dev-User": "omer"}
READ = ["schedule.view", "devices.read", "entity.state.read"]


def _by_name(c, name):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"] if s["name"] == name)


def _unknown_outcomes(fake, monkeypatch):
    """The bridge cannot name the new id AND the add-on's own diff finds nothing: every create-like op ends `unknown`."""
    monkeypatch.setattr(schedule_ops, "_learn_by_diff", lambda w, expected, before: None)
    fake.hide_new_id = True


def _audit(app, action, **where):
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
    return [r for r in rows if all(r[k] == v for k, v in where.items())]


def _pull(app):
    return schedules.MIRROR.pull(None, "test")


# ---------------------------------------------------------------- R1

def test_an_unknown_create_requested_disabled_is_disabled_when_it_is_adopted(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    _unknown_outcomes(fake, monkeypatch)
    body = {"draft": draft_of("Unlock at eight"), "enabled": False, "client_request_id": rid()}
    r = c.post(f"{API}/schedules", json=body)
    assert r.status_code == 202
    made = next(i for i in fake.items.values() if i["name"] == "Unlock at eight")
    assert made["enabled"] is True  # it exists in HA and it is ENABLED: the disable never reached it
    assert [a["reason"] for a in _audit(app, "schedule.create", decision="allowed")][-1] == "id_unknown"  # audited
    with app.state.db.connection(mode="read") as conn:
        assert json.loads(conn.execute("SELECT error FROM schedule_ops WHERE op = 'create' ORDER BY rowid DESC LIMIT 1").fetchone()[0])["enabled"] is False  # the op remembers what it asked for
    _pull(app)  # the adoption
    assert made["enabled"] is False and fake.bridge_calls[-1]["op"] == "disable" and fake.bridge_calls[-1]["user_id"] == "dev-joni"
    adopted = _by_name(c, "Unlock at eight")
    assert adopted["source"] == "arx" and adopted["owner"]["username"] == "joni" and adopted["enabled"] is False
    ad = _audit(app, "schedule.adopted")
    assert len(ad) == 1 and ad[0]["resource_id"] == made["schedule_id"] and json.loads(ad[0]["details_json"])["requested_disabled"] is True
    assert len(_audit(app, "schedule.adoption_followup", decision="allowed")) == 1


def test_when_the_disable_fails_the_review_names_the_schedule(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    _unknown_outcomes(fake, monkeypatch)
    assert c.post(f"{API}/schedules", json={"draft": draft_of("Stays enabled"), "enabled": False, "client_request_id": rid()}).status_code == 202
    fake.fail_next["disable"] = "unauthorized"
    _pull(app)
    made = next(i for i in fake.items.values() if i["name"] == "Stays enabled")
    assert made["enabled"] is True
    assert len(_audit(app, "schedule.adoption_followup", decision="denied")) == 1
    review = {i["schedule"]["name"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "requested_disabled" in review["Stays enabled"]
    # once somebody enables (or disables) it through Arx the flag goes away
    sid = made["schedule_id"]
    assert post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()}).status_code == 200
    review = {i["schedule"]["name"]: i["issues"] for i in c.get(f"{API}/schedules/review").json()["items"]}
    assert "Stays enabled" not in review


def test_an_unknown_copy_is_audited_and_adopted(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    src = _by_name(c, "Hall lights on rest days")
    _unknown_outcomes(fake, monkeypatch)
    r = post_json(c, f"/schedules/{src['id']}/copy", {"name": "Hall copy", "client_request_id": rid()})
    assert r.status_code == 202 and r.json()["status"] == "unknown"
    assert [a["reason"] for a in _audit(app, "schedule.copy", decision="allowed")] == ["id_unknown"]
    _pull(app)
    cp = _by_name(c, "Hall copy")
    assert cp["source"] == "arx" and cp["owner"]["username"] == "joni"
    assert len(_audit(app, "schedule.adopted")) == 1


def test_an_unknown_restore_of_a_disabled_schedule_is_finalised_and_disabled(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    gate = _by_name(c, "Gate")  # disabled when deleted
    out = post_json(c, f"/schedules/{gate['id']}/delete", {"base_revision": gate["revision"], "confirm": True, "client_request_id": rid()}).json()
    _unknown_outcomes(fake, monkeypatch)
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid(), "confirm_lowering": True})
    assert r.status_code == 202
    assert [a["reason"] for a in _audit(app, "schedule.restore", decision="allowed")] == ["id_unknown"]
    made = next(i for i in fake.items.values() if i["name"] == "Gate")
    assert made["enabled"] is True  # restored enabled by the component
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT restored_at FROM schedule_trash WHERE id = ?", (out["trash_id"],)).fetchone()[0].startswith("~unknown:")
    _pull(app)
    assert made["enabled"] is False  # the snapshot was disabled: the adoption disables it
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT restored_at, restored_schedule_id FROM schedule_trash WHERE id = ?", (out["trash_id"],)).fetchone()
    assert row["restored_schedule_id"] == made["schedule_id"] and not row["restored_at"].startswith("~")  # the claim is finalised, not stuck


def test_an_unknown_split_is_adopted_and_completed(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Office light on weekdays")  # sun-thu
    _unknown_outcomes(fake, monkeypatch)
    r = post_json(c, f"/schedules/{sch['id']}/split", {"base_revision": sch["revision"], "days": ["tue"], "confirm": True, "client_request_id": rid()})
    assert r.status_code == 502 and r.json()["code"] == "split_incomplete"
    assert [a["reason"] for a in _audit(app, "schedule.split", decision="allowed")] == ["id_unknown"]
    assert fake.items[sch["id"]]["weekdays"] == ["sun", "mon", "tue", "wed", "thu"]  # the original still has ALL its days
    new = next(i for i in fake.items.values() if i["name"] == "Office light on weekdays · ג׳")
    _pull(app)
    assert fake.items[sch["id"]]["weekdays"] == ["sun", "mon", "wed", "thu"] and new["weekdays"] == ["tue"]
    assert fake.bridge_calls[-1]["op"] == "edit" and fake.bridge_calls[-1]["payload"] == {"weekdays": ["sun", "mon", "wed", "thu"], "start_date": None, "end_date": None}
    adopted = _by_name(c, "Office light on weekdays · ג׳")
    assert adopted["source"] == "arx" and adopted["owner"]["username"] == "joni"
    with app.state.db.connection(mode="read") as conn:
        op = conn.execute("SELECT status, schedule_id, error FROM schedule_ops WHERE op = 'split'").fetchone()
    assert op["status"] == "ok" and op["schedule_id"] == sch["id"] and json.loads(op["error"])["created"] == new["schedule_id"]


def test_a_split_is_not_completed_when_the_original_moved_on(sched_app, monkeypatch):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Office light on weekdays")
    _unknown_outcomes(fake, monkeypatch)
    post_json(c, f"/schedules/{sch['id']}/split", {"base_revision": sch["revision"], "days": ["tue"], "confirm": True, "client_request_id": rid()})
    fake.call_service("scheduler", "edit", {"entity_id": fake.items[sch["id"]]["entity_id"], "weekdays": ["mon"], "start_date": None, "end_date": None})  # someone edited it in HA meanwhile
    _pull(app)
    assert fake.items[sch["id"]]["weekdays"] == ["mon"]  # never completed blindly


# ---------------------------------------------------------------- R3

def test_a_stuck_trash_claim_is_released_after_the_adoption_window(sched_app):
    app, s, c, fake, tr = sched_app
    sch = _by_name(c, "Gym shutter")
    out = post_json(c, f"/schedules/{sch['id']}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()}).json()
    tid = out["trash_id"]
    now = schedules.MIRROR.now()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE schedule_trash SET restored_at = ? WHERE id = ?", (f"~restoring:{schedules._iso(now - dt.timedelta(minutes=10))}", tid))
    assert c.get(f"{API}/schedules/trash").json()["items"] == []  # claimed: out of the trash for now
    assert post_json(c, f"/schedules/trash/{tid}/purge", {"confirm": True}).status_code == 404
    assert schedules.janitor(app.state.db, {"schedules.runs_retention_days": 90})["released"] == 0  # inside the window: kept
    with app.state.db.connection() as conn:
        conn.execute("UPDATE schedule_trash SET restored_at = ? WHERE id = ?", (f"~unknown:{schedules._iso(now - dt.timedelta(hours=2))}", tid))
    assert schedules.janitor(app.state.db, {"schedules.runs_retention_days": 90})["released"] == 1
    assert [t["trash_id"] for t in c.get(f"{API}/schedules/trash").json()["items"]] == [tid]  # back in the trash: it can be restored or purged
    assert post_json(c, f"/schedules/trash/{tid}/restore", {"client_request_id": rid()}).status_code == 201


# ---------------------------------------------------------------- R5

def test_the_calendar_sensor_override_is_on_the_record(sched_app):
    app, s, c, fake, tr = sched_app
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "binary_sensor.motion_hall", "schedules.shabbat_sensor_force": True}).status_code == 200
    with app.state.db.connection(mode="read") as conn:
        rows = [json.loads(r[0]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' ORDER BY id").fetchall()]
    assert rows[-1]["forced"] is True and rows[-1]["schedules.shabbat_sensor"] == "binary_sensor.motion_hall"
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": SHABBAT, "schedules.shabbat_sensor_force": True}).status_code == 200  # a calendar-looking id needs no override
    # (the fixture's SHABBAT id has no calendar marker, so it counts as forced too; a marked one does not)
    with app.state.db.connection() as conn:
        from smplwise.services import ha_sync

        ha_sync.upsert_state(conn, {"entity_id": "binary_sensor.issur_melacha_now", "state": "off", "attributes": {}, "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"})
    assert c.patch(f"{API}/settings", json={"schedules.shabbat_sensor": "binary_sensor.issur_melacha_now"}).status_code == 200
    with app.state.db.connection(mode="read") as conn:
        last = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' ORDER BY id DESC LIMIT 1").fetchone()[0])
    assert "forced" not in last


def test_copy_and_split_of_a_schedule_with_a_locked_condition_say_so(sched_app):
    app, s, c, fake, tr = sched_app
    ids = seed_tree(c)
    _place(c, ids["floor2"], "light.office")
    motion = cond("on", "binary_sensor.motion_hall")
    d = draft_of("Lights when moving", conditions=[motion], weekdays=["sun", "mon", "tue"])
    made = c.post(f"{API}/schedules", json={"draft": d, "enabled": True, "client_request_id": rid()}).json()["schedule"]
    _grant(c, "omer", "עורך קומה 2", READ + ["devices.control"], ["schedule.manage"], "floor", ids["floor2"])
    cur = c.get(f"{API}/schedules/{made['id']}", headers=OMER).json()
    r = post_json(c, f"/schedules/{made['id']}/copy", {"name": "Copy", "client_request_id": rid()}, OMER)
    assert r.status_code == 403 and r.json()["code"] == "condition_locked" and r.json()["user_message"] == "התנאי \"Hall motion\" מחוץ להרשאתך, ולכן אי אפשר להעתיק את התזמון. פנו למי שמורשה לקרוא אותו."
    r = post_json(c, f"/schedules/{made['id']}/split", {"base_revision": cur["revision"], "days": ["tue"], "confirm": True, "client_request_id": rid()}, OMER)
    assert r.status_code == 403 and r.json()["code"] == "condition_locked" and "לפצל" in r.json()["user_message"]
    assert not [x for x in fake.bridge_calls if x["op"] in ("copy", "add") and x["user_id"] == "dev-omer"]
    # the administrator can read it: both work
    assert post_json(c, f"/schedules/{made['id']}/copy", {"name": "Copy", "client_request_id": rid()}).status_code == 201


def test_restore_of_a_workday_schedule_keeps_its_days(sched_app):
    app, s, c, fake, tr = sched_app
    sid = fake._add({"name": "Workdays", "weekdays": ["workday"], "repeat_type": "repeat", "timeslots": [{"start": "08:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False,
                                                                                                             "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {"brightness": 5}}]}]})
    schedules.MIRROR.pull(None, "t")
    sch = _by_name(c, "Workdays")
    out = post_json(c, f"/schedules/{sid}/delete", {"base_revision": sch["revision"], "confirm": True, "client_request_id": rid()}).json()
    r = post_json(c, f"/schedules/trash/{out['trash_id']}/restore", {"client_request_id": rid()})
    assert r.status_code == 201 and r.json()["schedule"]["days"]["kind"] == "workday"
