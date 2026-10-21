"""DOORWIN2-295 (CR-039 8.2 / 19.3): the one exception to "Arx never touches a program a person made in the intercom window" - an emergency LOCK
pauses it (audited with the incident) and Arx never re-activates it: the door is listed until the person enables it again or marks it handled.
On the W0 fakes (`FakeProgramEngine.add_foreign`); nothing is contacted. Negative first: every other path leaves a foreign program alone."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_program import SAVE
from fake_doorwin_world import DoorwinWorld

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC)


@pytest.fixture()
def pw(settings, monkeypatch):
    world = DoorwinWorld(start=T0)
    p = ProductWorld(settings, monkeypatch, world=world)
    p.windows_on()
    p.emergency_on()
    world.programs.add_foreign(p.ENTRY, 1, "Lobby hours", {"Monday": [("07:00", "19:00")]}, enabled=True)
    return p


def prog(p):
    return p.world.programs.program(p.ENTRY, 1)


def saves(p):
    return [r for r in p.world.programs.requests if r["command"].endswith("technical_program_save")]


def listed(p, user=None):
    return p.get("/doors/emergency/state", user).json().get("foreign_paused")


def test_without_the_exception_a_foreign_program_is_left_alone(pw):
    outcome, code = pw.dw.pause_door(pw.db, pw.settings, pw.ENTRY, 1, None, why="override")
    assert (outcome, code) == ("foreign", "foreign_program") and prog(pw)["enabled"] is True
    assert pw.rows("SELECT foreign_paused_at FROM door_window_engine WHERE station_id = ?", pw.ENTRY)[0]["foreign_paused_at"] is None
    pw.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}])
    pw.sync()
    assert saves(pw) == [] and prog(pw)["enabled"] is True, "the compile refuses to overwrite a program a person made"


def test_a_drill_never_reaches_the_program(pw):
    r = pw.press("lock_secure", drill=True)
    assert r.status_code == 201, r.text
    assert prog(pw)["enabled"] is True and listed(pw) == []


def test_an_emergency_open_does_not_touch_programs(pw):
    r = pw.press("open")
    assert r.status_code in (201, 409)  # OPEN is unavailable in this build; either way no program is paused
    assert prog(pw)["enabled"] is True


def test_a_lock_pauses_the_foreign_program_and_lists_the_door(pw):
    r = pw.press("lock_secure")
    assert r.status_code == 201, r.text
    iid = r.json()["incident"]["id"]
    assert prog(pw)["enabled"] is False, "paused: the door returns to normal control and the program cannot re-open it"
    row = pw.rows("SELECT * FROM door_window_engine WHERE station_id = ? AND relay = 1", pw.ENTRY)[0]
    assert row["foreign_paused_incident"] == iid and row["foreign_paused_at"] and row["foreign_program"] == 1
    assert [f["door"] for f in listed(pw)] == [f"{pw.ENTRY}:1"] and listed(pw)[0]["label"]
    assert r.json()["incident"]["foreign_paused"] == [{"door": f"{pw.ENTRY}:1", "label": listed(pw)[0]["label"]}]
    audit = [a for a in pw.rows("SELECT details_json, decision FROM audit_log WHERE action = 'door.window.engine_write'") if iid in a["details_json"]]
    assert audit and all(a["decision"] == "allowed" for a in audit)


def test_arx_never_reactivates_the_foreign_program_after_the_release(pw):
    iid = pw.press("lock_secure").json()["incident"]["id"]
    rel = pw.release(iid)
    assert rel.status_code == 200, rel.text
    pw.sync()
    pw.sync()
    assert prog(pw)["enabled"] is False and saves(pw) == [], "no Arx save of a foreign program, ever"
    assert [f["door"] for f in listed(pw)] == [f"{pw.ENTRY}:1"], "still listed: it needs the person who made it"
    st = pw.get("/doors/windows/state").json()
    assert [f["door"] for f in st["foreign_paused"]] == [f"{pw.ENTRY}:1"]


def test_the_entry_clears_when_the_person_enables_the_program_again(pw):
    iid = pw.press("lock_secure").json()["incident"]["id"]
    pw.release(iid)
    p = prog(pw)
    pw.world.programs.command(SAVE, station_id=pw.ENTRY, door=1, revision=p["revision"], policy=p["policy"], enabled=True)  # the person, in the intercom window
    pw.sync()
    assert listed(pw) == [] and "door.window.foreign_reactivated" in pw.audit_actions()
    assert [r for r in saves(pw)] and all(r.get("enabled") is True for r in saves(pw)), "the only save is the person's own"


def test_a_person_can_mark_the_door_handled(pw):
    pw.press("lock_secure")
    pw.bind("op", "operator")
    pw.bind("v", "viewer")
    url = f"/doors/windows/doors/{pw.ENTRY}/1/foreign-handled"
    assert pw.post(url, "v", confirmed=True).status_code == 403
    assert pw.post(url, confirmed=None).json()["code"] == "confirmation_required"
    assert pw.post(f"/doors/windows/doors/{pw.SIDE}/1/foreign-handled", confirmed=True).json()["code"] == "nothing_to_clear"
    r = pw.post(url, "op", confirmed=True)
    assert r.status_code == 200 and r.json()["handled"] is True
    assert listed(pw) == [] and "door.window.foreign_handled" in pw.audit_actions()
    assert pw.post(url, confirmed=True).json()["code"] == "nothing_to_clear"


def test_the_list_is_for_the_holders_of_an_emergency_permission(pw):
    pw.press("lock_secure")
    pw.bind("v", "viewer")
    assert "foreign_paused" not in pw.get("/doors/emergency/state", "v").json()
    assert [f["door"] for f in pw.get("/doors/emergency/state").json()["foreign_paused"]] == [f"{pw.ENTRY}:1"]


def test_an_arx_program_under_a_lock_is_paused_as_before(pw):
    pw.world.programs.programs.pop((pw.ENTRY, 1))
    pw.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}])
    pw.sync()
    assert prog(pw)["enabled"] is True
    pw.press("lock_secure")
    assert prog(pw)["enabled"] is False
    assert pw.rows("SELECT foreign_paused_at FROM door_window_engine WHERE station_id = ? AND relay = 1", pw.ENTRY)[0]["foreign_paused_at"] is None, "its own program is not a foreign one"
