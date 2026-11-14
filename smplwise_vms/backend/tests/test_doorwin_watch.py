"""DOORWIN-295 (CR-039 4.1-4.4, 6, SR-1..SR-5, T1/T2): the door-windows sync and relock watchdog, end to end on the W0 fakes.

The product (rules over HTTP, `door_windows.sync`, `door_windows_watch.watch`) runs against `FakeProgramEngine` (WisKey's hold-open
program executor as Arx understands it: 15-s tick, alwaysOpen on entry, close on exit, its own close retry, `hold_pause_before_edit`) on one
fake clock. The watchdog is registered as an `arx`-owned job, so `world.arx_restart()` kills it exactly like an add-on restart.
Nothing reaches WisKey, Home Assistant, a station or a door. The go-live permit is switched on inside each test (monkeypatch only)."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_asserts import assert_close_retries_bounded
from fake_doorwin_world import DoorwinWorld

from smplwise.services import door_windows_watch as dww

UTC = dt.timezone.utc
T_START = dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC)   # Monday 07:00 in Asia/Jerusalem
OPEN_AT = dt.datetime(2026, 11, 2, 6, 0, tzinfo=UTC)   # 08:00
END_AT = dt.datetime(2026, 11, 2, 9, 0, tzinfo=UTC)    # 11:00


@pytest.fixture()
def env(settings, monkeypatch):
    world = DoorwinWorld(start=T_START)
    pw = ProductWorld(settings, monkeypatch, world=world)
    pw.windows_on()
    r = pw.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}])
    assert r.status_code == 201, r.text
    pw.rule_id = r.json()["rule"]["id"]
    pw.sync()
    pw.job = world.scheduler.every(15, pw.watch, owner="arx", name="watchdog")
    return pw


def today(pw):
    return [o for o in pw.occurrences(station_id=pw.ENTRY) if o["start_at"] == "2026-11-02T06:00:00Z"]


def state(pw) -> str:
    return today(pw)[0]["state"]


def notifications(pw, source: str) -> list[dict]:
    return pw.rows("SELECT * FROM notifications WHERE source = ? ORDER BY first_at", source)


def pauses(pw) -> list[dict]:
    return [r for r in pw.world.programs.requests if r["command"].endswith("technical_program_action") and r["action"] == "pause"]


# ---------------------------------------------------------------- the compile writes the engine, once

def test_the_rule_becomes_one_arx_program_and_armed_occurrences(env):
    prog = env.world.programs.program(env.ENTRY, 1)
    assert prog is not None and prog["enabled"] and prog["policy"]["schedule"]["name"].startswith("Arx ")
    occ = today(env)
    assert len(occ) == 1 and occ[0]["state"] == "armed" and occ[0]["tier"] == "program" and occ[0]["token"] == "2026-11-02/08:00/11:00"
    saves = [r for r in env.world.programs.requests if r["command"].endswith("technical_program_save")]
    assert len(saves) == 1
    env.sync()
    env.sync()
    assert len([r for r in env.world.programs.requests if r["command"].endswith("technical_program_save")]) == 1, "an unchanged program is never written again"
    assert "door.window.engine_write" in env.audit_actions()


def test_editing_a_live_rule_pauses_then_saves_and_activates(env):
    r = env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
                periods=[{"weekday": 1, "start": "08:00", "end": "10:00"}], confirmed=True)
    assert r.status_code == 200, r.text
    env.sync()
    cmds = [(x["command"].rsplit("_", 1)[-1], x["outcome"]) for x in env.world.programs.requests if x["command"] != "stations/technical_program_list"]
    assert cmds[-2:] == [("action", "ok"), ("save", "ok")], "WisKey refuses an edit of an enabled program: pause first (W0 finding 1)"
    assert env.world.programs.program(env.ENTRY, 1)["policy"]["schedule"]["weekly"]["Monday"] == [{"start": "08:00", "end": "10:00"}]
    assert [o["state"] for o in env.occurrences(station_id=env.ENTRY, token="2026-11-02/08:00/11:00")] == ["cancelled"]


# ---------------------------------------------------------------- a clean window

def test_a_clean_window_is_held_by_the_engine_and_confirmed_closed(env):
    env.world.run_until(OPEN_AT + dt.timedelta(seconds=45))
    assert state(env) == "active"
    assert env.world.bank.truth_open((env.ENTRY, 1))
    env.world.run_until(END_AT + dt.timedelta(seconds=60))
    o = today(env)[0]
    assert o["state"] == "closed_confirmed" and o["resolution"] == "engine_idle"
    assert not env.world.bank.truth_open((env.ENTRY, 1))
    assert notifications(env, "door.relock_unconfirmed") == []
    assert pauses(env) == [], "no Arx write at all on a clean window"


def test_no_arx_code_path_opens_the_door_from_a_timer(env):
    """SR-1 on the device log: every alwaysOpen comes from WisKey's program executor, none from Arx."""
    env.world.run_until(END_AT + dt.timedelta(minutes=5))
    opens = [r for r in env.world.programs.device_log if r.command == "alwaysOpen"]
    assert opens and all(r.engine == "wiskey_program" for r in opens)
    assert all(not x["command"].endswith("save") or x["at"] < OPEN_AT.strftime("%Y-%m-%dT%H:%M:%SZ") for x in env.world.programs.requests)


# ---------------------------------------------------------------- the end cannot be confirmed: alarm + bounded close retries

def test_ha_down_at_the_end_raises_the_alarm_and_never_confirms_by_assumption(env):
    env.world.run_until(END_AT - dt.timedelta(minutes=1))
    env.world.ha_down()  # WisKey's executor stops: the door stays held (R), and Arx cannot read either
    env.world.run_until(END_AT + dt.timedelta(seconds=150))
    o = today(env)[0]
    assert o["state"] == "relock_unconfirmed" and o["last_reason"] == "feed_unavailable"
    n = notifications(env, "door.relock_unconfirmed")
    assert len(n) == 1 and n[0]["severity"] == "critical" and n[0]["state"] != "resolved"
    assert pauses(env) == [], "with the engine unreadable no retry is spent (it needs the revision)"
    env.world.run_until(END_AT + dt.timedelta(minutes=40))
    assert state(env) == "relock_unconfirmed", "never cleared by assumption"
    assert "door.window.occurrence" in env.audit_actions()
    env.world.ha_up()  # WisKey restarts and sends close for the door it owned (R)
    env.world.run_until(END_AT + dt.timedelta(minutes=42))
    o = today(env)[0]
    assert o["state"] == "closed_confirmed" and o["resolution"] == "engine_idle"
    assert notifications(env, "door.relock_unconfirmed")[0]["state"] == "resolved"


def test_a_refused_close_gets_at_most_three_backed_off_pause_retries(env):
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=1))
    env.world.programs.close_refused[(env.ENTRY, 1)] = True  # the station refuses every close (WisKey keeps retrying on its own)
    env.world.run_until(END_AT + dt.timedelta(minutes=12))
    o = today(env)[0]
    assert o["state"] == "relock_unconfirmed" and o["retries"] == 3 and o["next_retry_at"] is None
    unconfirmed_at = dt.datetime.strptime(o["unconfirmed_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    assert_close_retries_bounded([dt.datetime.fromisoformat(p["at"]) for p in pauses(env)], unconfirmed_at)
    assert len(pauses(env)) == 3
    assert env.audit_actions().count("door.window.relock_retry") == 3
    env.world.programs.close_refused.clear()
    env.world.run_until(END_AT + dt.timedelta(minutes=14))
    assert state(env) == "closed_confirmed"


def test_the_alarm_is_re_raised_until_resolved(env):
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=1))
    env.world.programs.close_refused[(env.ENTRY, 1)] = True
    env.world.run_until(END_AT + dt.timedelta(minutes=50))
    n = notifications(env, "door.relock_unconfirmed")
    assert len(n) == 1 and n[0]["count"] >= 3, "one open condition, folded and re-raised every 15 minutes"


def test_an_arx_restart_at_the_end_does_not_leave_the_door_open(env):
    """T2: Arx holds no timer that closes; the engine relocks, and the first watchdog pass after the restart confirms it."""
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=1))
    env.world.scheduler.cancel_owner("arx")  # the add-on restarts and stays down over the end
    env.world.run_until(END_AT + dt.timedelta(minutes=30))
    assert not env.world.bank.truth_open((env.ENTRY, 1)), "WisKey relocked without Arx"
    assert state(env) == "active", "nothing judged while Arx was down"
    env.watch()  # the first pass after the start
    assert state(env) == "closed_confirmed"


def test_a_lost_feed_at_the_end_fails_loud(env):
    env.world.run_until(END_AT - dt.timedelta(minutes=2))
    env.world.arx_link(False)  # Arx cannot reach WisKey; WisKey and the station go on (and relock)
    env.world.run_until(END_AT + dt.timedelta(minutes=3))
    o = today(env)[0]
    assert o["state"] == "relock_unconfirmed" and o["last_reason"] == "feed_unavailable"
    env.world.arx_link(True)
    env.world.run_until(END_AT + dt.timedelta(minutes=4))
    assert state(env) == "closed_confirmed"


def test_sr5_no_program_write_while_a_relock_is_unconfirmed(env):
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=1))
    env.world.programs.close_refused[(env.ENTRY, 1)] = True
    env.world.run_until(END_AT + dt.timedelta(minutes=12))
    saves_before = len([r for r in env.world.programs.requests if r["command"].endswith("save")])
    r = env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
                periods=[{"weekday": 1, "start": "08:00", "end": "10:30"}], confirmed=True)
    assert r.status_code == 200
    out = env.sync()
    assert out["doors"][f"{env.ENTRY}:1"]["code"] == "relock_unconfirmed"
    assert len([r for r in env.world.programs.requests if r["command"].endswith("save")]) == saves_before


# ---------------------------------------------------------------- people: the override and the manual check

def test_the_guard_override_ends_the_window_now_and_it_is_watched_to_its_relock(env):
    env.bind("gabi", "operator")  # operator holds access.windows.cancel (CR-039 7.2)
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=10))
    occ = today(env)[0]
    r = env.post(f"/doors/windows/occurrences/{occ['id']}/end-now", "gabi", confirmed=True)
    assert r.status_code == 200, r.text
    assert not env.world.programs.program(env.ENTRY, 1)["enabled"], "the program is paused (the close direction)"
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=12))
    o = today(env)[0]
    assert o["state"] == "closed_confirmed" and o["resolution"] == "override"
    env.sync()
    assert not env.world.programs.program(env.ENTRY, 1)["enabled"], "not re-activated before the overridden window's end"
    assert "door.window.override" in env.audit_actions()
    assert notifications(env, "door.window_overridden")


def test_a_viewer_cannot_override(env):
    env.bind("vered", "viewer")
    occ = today(env)[0]
    r = env.post(f"/doors/windows/occurrences/{occ['id']}/end-now", "vered", confirmed=True)
    assert r.status_code == 403


def test_the_manual_check_resolves_an_unconfirmed_relock_with_the_person_and_what_they_checked(env):
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=1))
    env.world.programs.close_refused[(env.ENTRY, 1)] = True
    env.world.run_until(END_AT + dt.timedelta(minutes=5))
    occ = today(env)[0]
    assert env.post(f"/doors/windows/occurrences/{occ['id']}/confirm-closed", checked="camera").status_code == 409, "confirmed: true is required"
    r = env.post(f"/doors/windows/occurrences/{occ['id']}/confirm-closed", checked="camera", confirmed=True)
    assert r.status_code == 200, r.text
    o = today(env)[0]
    assert o["state"] == "closed_confirmed" and o["resolution"] == "manual_checked" and o["checked"] == "camera" and o["resolved_by"] == "dev-joni"
    assert notifications(env, "door.relock_unconfirmed")[0]["state"] == "resolved"
    again = env.post(f"/doors/windows/occurrences/{occ['id']}/confirm-closed", checked="door", confirmed=True)
    assert again.status_code == 409


# ---------------------------------------------------------------- foreign programs, switching off, stale approvals

def test_a_program_a_person_made_is_never_overwritten(settings, monkeypatch):
    world = DoorwinWorld(start=T_START)
    world.programs.add_foreign(world.stations and "01JTESTSTATIONENTRY000000A", 1)
    pw = ProductWorld(settings, monkeypatch, world=world)
    pw.windows_on()
    assert pw.rule().status_code == 201
    pw.sync()
    prog = pw.world.programs.program(pw.ENTRY, 1)
    assert not prog["policy"]["schedule"]["name"].startswith("Arx ")
    assert not [r for r in pw.world.programs.requests if r["command"] != "stations/technical_program_list"]
    assert pw.rows("SELECT foreign_program FROM door_window_engine WHERE station_id = ?", pw.ENTRY)[0]["foreign_program"] == 1


def test_switching_windows_off_pauses_arx_programs_and_cancels_the_plan(env):
    assert env.world.programs.program(env.ENTRY, 1)["enabled"]
    assert env.put("/doors/windows/settings", changes={"doors.windows.enabled": "off"}, confirmed=True).status_code == 200
    env.sync()
    assert not env.world.programs.program(env.ENTRY, 1)["enabled"]
    assert {o["state"] for o in env.occurrences(station_id=env.ENTRY)} == {"cancelled"}


def test_an_alarm_survives_switching_windows_off(env):
    env.world.run_until(OPEN_AT + dt.timedelta(minutes=1))
    env.world.programs.close_refused[(env.ENTRY, 1)] = True
    env.world.run_until(END_AT + dt.timedelta(minutes=3))
    assert state(env) == "relock_unconfirmed"
    env.put("/doors/windows/settings", changes={"doors.windows.enabled": "off"}, confirmed=True)
    env.world.run_until(END_AT + dt.timedelta(minutes=20))
    assert state(env) == "relock_unconfirmed", "T22: a switch never clears an alarm"


def test_a_rule_whose_approver_lost_the_permission_is_paused_by_the_next_compile(settings, monkeypatch):
    world = DoorwinWorld(start=T_START)
    pw = ProductWorld(settings, monkeypatch, world=world)
    pw.windows_on()
    pw.bind("sara", "site_admin")
    r = pw.rule(user="sara")
    assert r.status_code == 201, r.text
    pw.sync()
    assert pw.world.programs.program(pw.ENTRY, 1)["enabled"]
    with pw.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-11-01T00:00:00Z' WHERE subject_id = 'dev-sara'")
    out = pw.sync()
    assert out["stale_rules"] == [r.json()["rule"]["id"]]
    assert pw.rows("SELECT state FROM door_window_rules")[0]["state"] == "paused"
    assert not pw.world.programs.program(pw.ENTRY, 1)["enabled"]


# ---------------------------------------------------------------- tier D (this build's live state): plan only

def test_without_a_permitted_engine_windows_are_prepared_only(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=False, start=T_START)
    pw.windows_on()
    assert pw.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}]).status_code == 201
    pw.sync()
    occ = [o for o in pw.occurrences() if o["start_at"] == "2026-11-02T06:00:00Z"]
    assert len(occ) == 1 and occ[0]["state"] == "prepared" and occ[0]["tier"] == "prepared"
    pw.t[0] = END_AT + dt.timedelta(minutes=5)
    pw.watch()
    assert [o["state"] for o in pw.occurrences() if o["start_at"] == "2026-11-02T06:00:00Z"] == ["elapsed"]
    assert pw.rows("SELECT COUNT(*) AS n FROM notifications")[0]["n"] == 0 or not notifications(pw, "door.relock_unconfirmed")
    assert pw.get("/doors/windows/state").json()["tier"] == "prepared"


def test_the_shipped_build_keeps_windows_prepared_with_the_real_factory(settings, monkeypatch):
    """DWFIX-295 (review 3 DW-02 / DW-08): the SHIPPED constants (permit True, live engine not built) and the SHIPPED factory - switching
    windows on plans in tier D: no engine write fails, nothing is `planned`, no "window not started" alarm at the window's start."""
    from smplwise.services import door_windows_engine as dwe

    # DOORLIVE-2310: the release builds the engines in; this test models the ROLLBACK build (engine flags off) with the real factory
    pw = ProductWorld(settings, monkeypatch, go_live=False, start=T_START)  # go_live=False sets the engine flags off
    assert dwe.GO_LIVE_PERMITTED is True and dwe.LIVE_ENGINE_BUILT is False and dwe.live_ready() is False
    monkeypatch.setattr(dwe, "WINDOW_ENGINE_FACTORY", dwe._window_engine)  # the factory as shipped, not the world's injected engine
    assert isinstance(dwe.window_engine(None), dwe.PreparedEngine)
    pw.windows_on()
    assert pw.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}]).status_code == 201
    pw.sync()
    occ = [o for o in pw.occurrences() if o["start_at"] == "2026-11-02T06:00:00Z"]
    assert len(occ) == 1 and occ[0]["state"] == "prepared" and occ[0]["tier"] == "prepared"
    assert not pw.rows("SELECT * FROM audit_log WHERE action = 'door.window.engine_write' AND decision = 'failed'")
    pw.t[0] = dt.datetime(2026, 11, 2, 6, 5, tzinfo=UTC)
    pw.watch()
    assert not notifications(pw, "door.window_not_started")
    st = pw.get("/doors/windows/state").json()
    assert st["tier"] == "prepared" and st["go_live_permitted"] is False


def test_the_live_engine_refuses_while_the_permit_is_off(monkeypatch):
    from smplwise.services import door_windows_engine as dwe

    assert dwe.GO_LIVE_PERMITTED is True  # ECCACT-295: opened by the owner decision of 2026-10-21 (door_windows.enabled stays OFF)
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)
    with pytest.raises(dwe.EngineError) as e:
        dwe.WiskeyProgramEngine(None).read("x", 1)
    assert e.value.kind == "not_permitted"
    assert isinstance(dwe.window_engine(None), dwe.PreparedEngine)


# ---------------------------------------------------------------- the pure judge

def _occ(state: str, **kw) -> dict:
    return {"id": "o", "state": state, "start_at": "2026-11-02T06:00:00Z", "end_at": "2026-11-02T09:00:00Z", "retries": 0, "next_retry_at": None,
            "last_raised_at": None, "last_reason": None, **kw}


def test_judge_the_lock_entity_alone_never_confirms():
    """W0 finding 5: only the engine status confirms; a missing program is no evidence either."""
    from smplwise.services import door_windows_engine as dwe

    cfg = dww.Config()
    after_grace = dt.datetime(2026, 11, 2, 9, 3, tzinfo=UTC)
    assert dww.judge(_occ("ending"), dwe.ProgramState(False), after_grace, cfg).state == "relock_unconfirmed"
    assert dww.judge(_occ("ending"), dwe.ProgramState(True, 3, False, "Arx windows r1", "restoring", True), after_grace, cfg).state == "relock_unconfirmed"
    assert dww.judge(_occ("ending"), dwe.ProgramState(True, 3, False, "Arx windows r1", "idle", False), after_grace, cfg).state == "closed_confirmed"


def test_judge_a_window_that_never_started_is_reported_and_still_watched_to_its_end():
    from smplwise.services import door_windows_engine as dwe

    cfg = dww.Config()
    v = dww.judge(_occ("armed"), dwe.ProgramState(True, 2, True, "Arx windows r1", "idle", False), dt.datetime(2026, 11, 2, 6, 2, tzinfo=UTC), cfg)
    assert v.state == "not_started" and v.notify == ["not_started"] and not v.retry
    v = dww.judge(_occ("not_started"), None, dt.datetime(2026, 11, 2, 9, 3, tzinfo=UTC), cfg)
    assert v.state == "relock_unconfirmed"
