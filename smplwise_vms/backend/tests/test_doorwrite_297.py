"""DOORWRITE-297 (board r129, CR-039 4.3): the door-window program written from Arx to WisKey, end to end against FAKES ONLY.

The product path under test: the Arx schedule (rules over HTTP) -> `door_windows.sync` composes each door's weekly program -> Arx-side
validation -> the LIVE seam classes `door_windows_engine.WiskeyProgramEngine` -> `wiskey_program_direct.DirectProgramEngine` ->
`DirectProgramPort` -> a stub direct connection whose port answers from the W0 `FakeProgramEngine` (WisKey's hold-open programs as Arx
reads rc.37). Idempotent (an unchanged program is never written twice), versioned (`program_version`), proven by read-back, drift detected
and never corrected automatically, failures retried with a growing wait and then `failed`, a dry run that writes nothing, and a person's
"write again". Nothing reaches WisKey, Home Assistant, a station or a door; the build flags stay as shipped except inside a test, where
only PROGRAM_ENGINE_BUILT is switched on (monkeypatch). EMERGENCY_ENGINE_BUILT is never touched."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from typing import Any, Mapping

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_program import SAVE, ACTION, FakeEngineError, FakeOutcomeUnknown, FakeTransportDown, make_policy
from fake_doorwin_world import DoorwinWorld

from smplwise.services import door_window_program as dwp
from smplwise.services import door_windows as dw
from smplwise.services import door_windows_engine as dwe
from smplwise.services import wiskey_program_direct as wpd
from smplwise.services.wiskey_capture_port import PortError

UTC = dt.timezone.utc
T_START = dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Monday 07:00 in Asia/Jerusalem
LIST = wpd.LIST


# ---------------------------------------------------------------- the stub direct connection over the W0 fake

class FakeWiskeyPort:
    """`WiskeyDirectPort.call` over `FakeProgramEngine.command`: a refusal -> PortError refused, a lost answer -> unknown, no link -> not_sent."""

    def __init__(self, fake: Any) -> None:
        self.fake = fake
        self.calls: list[str] = []

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        self.calls.append(command)
        try:
            return self.fake.command(command, **dict(parameters))
        except FakeEngineError as exc:
            raise PortError(exc.code, "refused") from None
        except FakeOutcomeUnknown:
            raise PortError("answer_lost", "unknown") from None
        except FakeTransportDown:
            raise PortError("transport_down", "not_sent") from None


class StubJoin:
    def __init__(self, port: Any) -> None:
        self.capture_port = port
        self.on = True

    def selected(self, command: str | None = None) -> bool:
        return self.on and command in wpd.COMMANDS


@pytest.fixture()
def env(settings, monkeypatch):
    world = DoorwinWorld(start=T_START)
    pw = ProductWorld(settings, monkeypatch, world=world, go_live=False)  # go_live=False: LIVE_ENGINE_BUILT (and with it emergency) stays off
    monkeypatch.setattr(dwe, "PROGRAM_ENGINE_BUILT", True)  # inside this test only: the program engine, nothing else
    pw.port = FakeWiskeyPort(world.programs)
    pw.join = StubJoin(pw.port)
    pw.window_engine = dwe.WiskeyProgramEngine(None, wpd.DirectProgramEngine(wpd.DirectProgramPort(lambda: pw.join)))
    pw.windows_on()
    return pw


def ruled(pw, periods=None):
    r = pw.rule(periods=periods or [{"weekday": 1, "start": "08:00", "end": "11:00"}])
    assert r.status_code == 201, r.text
    pw.rule_id = r.json()["rule"]["id"]
    return pw


def saves(pw) -> list[dict]:
    return [r for r in pw.world.programs.requests if r["command"] == SAVE]


def engine_row(pw, relay: int = 1) -> dict:
    return pw.rows("SELECT * FROM door_window_engine WHERE station_id = ? AND relay = ?", pw.ENTRY, relay)[0]


def fake_program(pw) -> dict:
    return pw.world.programs.program(pw.ENTRY, 1)


def person_pauses_in_the_panel(pw) -> None:
    p = fake_program(pw)
    pw.world.programs.command(ACTION, station_id=pw.ENTRY, door=1, revision=p["revision"], action="pause")


# ================================================================ pure rules (no app)

def _compiled_policy() -> dict:
    door = dw.Door("st-1", 1, "כניסה", "לובי", "Asia/Jerusalem")
    rule = dw.RuleDoc("r1", "בוקר", "weekly", "enabled", "ignore_calendar", (("st-1", 1),),
                      tuple(dw.Period(weekday=wd, on_date=None, start="08:00", end="11:00") for wd in (0, 1, 2)), 1)
    c = dw.compile_door([rule], door, {}, dt.date(2026, 11, 2))
    assert c.policy is not None
    return c.policy


def test_the_composed_weekly_program_passes_arx_side_validation():
    policy = _compiled_policy()
    assert dwp.validate_policy(policy, station_id="st-1", relay=1) is None
    assert policy["schedule"]["name"].startswith(dwe.ARX_PREFIX) and set(policy["schedule"]["weekly"]) == set(dwp.WEEKDAYS)


@pytest.mark.parametrize("mutate, code", [
    (lambda p: p["schedule"].__setitem__("name", "Lobby hours"), "not_arx_name"),
    (lambda p: p.__setitem__("timezone", "Mars/Olympus"), "invalid_timezone"),
    (lambda p: p["schedule"]["weekly"].__setitem__("Monday", [{"start": "08:00", "end": "10:00"}, {"start": "09:00", "end": "11:00"}]), "schedule_overlap"),
    (lambda p: p["schedule"]["weekly"].__setitem__("Monday", [{"start": "11:00", "end": "08:00"}]), "schedule_invalid_time"),
    (lambda p: p["schedule"]["weekly"].__setitem__("Funday", []), "invalid_fields"),
    (lambda p: p["schedule"].__setitem__("holidays", [{"name": "Arx x", "start": "2026-02-30", "end": "2026-02-30", "periods": []}]), "schedule_invalid_date"),
    (lambda p: p["schedule"].__setitem__("holidays", [{"name": "Arx x", "start": f"2027-01-{i:02d}", "end": f"2027-01-{i:02d}", "periods": []} for i in range(1, 32)] * 4),
     "schedule_holiday_limit"),
    (lambda p: p.__setitem__("extra", 1), "invalid_fields"),
])
def test_a_program_wiskey_would_refuse_is_refused_before_anything_is_sent(mutate, code):
    policy = _compiled_policy()
    mutate(policy)
    assert dwp.validate_policy(policy) == code


def test_a_program_over_the_catalog_size_cap_is_not_sent(monkeypatch):
    monkeypatch.setattr(dwp, "MAX_REQUEST_BYTES", 200)
    assert dwp.validate_policy(_compiled_policy()) == "request_too_large"


def test_the_read_back_comparison_ignores_order_and_empty_weekdays_but_not_a_changed_time():
    a = make_policy("Arx windows r1", {"Monday": [("08:00", "11:00"), ("13:00", "14:00")]})
    b = json.loads(json.dumps(a))
    b["schedule"]["weekly"] = {"Monday": list(reversed(b["schedule"]["weekly"]["Monday"]))}  # reordered, the empty days left out
    assert dwp.canonical_sha(a) == dwp.canonical_sha(b)
    b["schedule"]["weekly"]["Monday"][0]["end"] = "14:30"
    assert dwp.canonical_sha(a) != dwp.canonical_sha(b)
    assert dwp.canonical_sha(None) is None and dwp.canonical_sha({"schedule": "x"}) is None


def test_drift_kinds():
    policy = make_policy("Arx windows r1", {"Monday": [("08:00", "11:00")]})
    other = make_policy("Arx windows r1", {"Monday": [("08:00", "12:00")]})
    assert dwp.drift_of(dwe.ProgramState(False), policy) == "missing"
    assert dwp.drift_of(dwe.ProgramState(True, 3, True, "Lobby", "idle", False, policy), policy) == "foreign"
    assert dwp.drift_of(dwe.ProgramState(True, 3, False, "Arx windows r1", "idle", False, policy), policy) == "disabled"
    assert dwp.drift_of(dwe.ProgramState(True, 3, True, "Arx windows r1", "idle", False, other), policy) == "changed"
    assert dwp.drift_of(dwe.ProgramState(True, 3, True, "Arx windows r1", "idle", False, policy), policy) is None


def test_the_retry_wait_grows_and_is_bounded():
    now = T_START
    waits = [(dwp.next_attempt_at(n, now) - now).total_seconds() for n in range(1, dwp.MAX_ATTEMPTS + 1)]
    assert waits == sorted(waits) and waits[0] >= 60 and waits[-1] <= 3600
    assert dwp.next_attempt_at(dwp.MAX_ATTEMPTS + 1, now) is None
    assert dwp.retryable("unknown") and dwp.retryable("not_sent") and not dwp.retryable("not_permitted") and not dwp.retryable("not_implemented")


def test_every_write_state_has_a_plain_hebrew_sentence_without_codes():
    hebrew = re.compile(r"[֐-׿]")
    for state in dwp.WRITE_STATES:
        for code in (None, "not_sent:transport_not_selected", "unknown:answer_lost"):
            text = dwp.message_he(state, code, "disabled")
            assert hebrew.search(text) and "_" not in text and not re.search(r"[A-Za-z]", text), (state, text)


def test_the_build_ships_with_both_engines_off():
    src = Path(dwe.__file__).read_text(encoding="utf-8")
    assert "\nPROGRAM_ENGINE_BUILT = False" in src and "\nEMERGENCY_ENGINE_BUILT = False" in src
    assert dwe.program_ready() is False and isinstance(dwe.window_engine(None), dwe.PreparedEngine)


# ================================================================ the write path, end to end through the live seam

def test_the_schedule_becomes_one_verified_versioned_program(env):
    ruled(env)
    res = env.sync()
    assert res["doors"][f"{env.ENTRY}:1"]["outcome"] == "written"
    prog = fake_program(env)
    assert prog["enabled"] and prog["policy"]["schedule"]["name"].startswith(dwe.ARX_PREFIX)
    assert prog["policy"]["schedule"]["weekly"]["Monday"] == [{"start": "08:00", "end": "11:00"}]
    row = engine_row(env)
    assert (row["write_state"], row["program_version"], row["write_attempts"]) == ("verified", 1, 0) and row["verified_at"]
    assert row["program_revision"] == prog["revision"]
    assert [o["state"] for o in env.occurrences(station_id=env.ENTRY) if o["start_at"] == "2026-11-02T06:00:00Z"] == ["armed"]
    assert env.port.calls[:2] == [LIST, SAVE], "read first, then save"


def test_an_unchanged_program_is_never_written_twice(env):
    ruled(env)
    env.sync()
    for _ in range(3):
        env.world.advance(60)
        env.sync()
    assert len(saves(env)) == 1 and engine_row(env)["program_version"] == 1


def test_editing_the_schedule_pauses_saves_and_bumps_the_version(env):
    ruled(env)
    env.sync()
    r = env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
                periods=[{"weekday": 1, "start": "08:00", "end": "10:00"}], confirmed=True)
    assert r.status_code == 200, r.text
    env.sync()
    cmds = [c for c in env.port.calls if c != LIST]
    assert cmds == [SAVE, ACTION, SAVE], "an enabled program is paused before the edit (hold_pause_before_edit)"
    assert fake_program(env)["policy"]["schedule"]["weekly"]["Monday"] == [{"start": "08:00", "end": "10:00"}]
    assert engine_row(env)["program_version"] == 2


def test_audit_rows_carry_ids_and_codes_only(env):
    ruled(env)
    env.sync()
    rows = env.rows("SELECT action, resource_id, details_json FROM audit_log WHERE action = 'door.window.engine_write'")
    assert rows and rows[-1]["resource_id"] == f"{env.ENTRY}:1"
    details = json.loads(rows[-1]["details_json"])
    assert set(details) <= {"tier", "outcome", "code", "revision", "compiled_sha", "version", "write_state", "attempts"}
    blob = json.dumps(details)
    assert "08:00" not in blob and "Arx " not in blob and "Monday" not in blob


# ---------------------------------------------------------------- read-back

class TamperingStore:
    """WisKey accepts the save but stores something else (what the read-back exists for)."""

    def __init__(self, inner: Any, fake: Any, station: str) -> None:
        self.inner, self.fake, self.station = inner, fake, station
        self.tier = "program"

    def read(self, station_id, relay):
        return self.inner.read(station_id, relay)

    def save(self, station_id, relay, revision, policy, enabled):
        self.inner.save(station_id, relay, revision, policy, enabled)
        self.fake.programs[(self.station, relay)].policy["schedule"]["weekly"]["Monday"] = [{"start": "08:00", "end": "09:00"}]
        return self.inner.read(station_id, relay)

    def pause(self, station_id, relay, revision):
        return self.inner.pause(station_id, relay, revision)


def test_a_write_the_read_back_does_not_prove_is_not_written(env):
    ruled(env)
    env.window_engine = TamperingStore(env.window_engine, env.world.programs, env.ENTRY)
    res = env.sync()
    assert res["doors"][f"{env.ENTRY}:1"]["outcome"] == "readback_mismatch"
    row = engine_row(env)
    assert row["write_state"] == "retry_wait" and row["write_attempts"] == 1 and row["written_sha256"] is None and row["program_version"] == 0
    assert dw.parse_iso(row["next_attempt_at"]) == env.now() + dt.timedelta(seconds=dwp.RETRY_WAIT_S[0])
    assert all(o["state"] != "armed" for o in env.occurrences(station_id=env.ENTRY)), "nothing is armed on a program that is not proven"
    assert "האינטרקום לא החזיר את התוכנית שנכתבה" in dw.program_view(row)["message"]


# ---------------------------------------------------------------- failure and retry

def test_a_failed_write_waits_retries_and_then_stops_as_failed(env):
    ruled(env)
    env.join.on = False  # no selected direct connection: nothing is sent
    env.sync()
    row = engine_row(env)
    assert (row["write_state"], row["write_attempts"]) == ("retry_wait", 1) and env.port.calls == []
    assert "אין כרגע חיבור פעיל לאינטרקום" in dw.program_view(row)["message"]
    env.sync()
    assert engine_row(env)["write_attempts"] == 1, "inside the wait nothing is tried"
    for n in range(2, dwp.MAX_ATTEMPTS + 2):
        env.world.advance(dwp.RETRY_WAIT_S[min(n - 2, len(dwp.RETRY_WAIT_S) - 1)] + 1)
        env.sync()
        assert engine_row(env)["write_attempts"] == n
    row = engine_row(env)
    assert row["write_state"] == "failed" and row["next_attempt_at"] is None
    env.world.advance(4 * 3600)
    env.sync()
    assert engine_row(env)["write_attempts"] == dwp.MAX_ATTEMPTS + 1, "failed waits for a person (or a new document)"
    env.join.on = True
    r = env.post(f"/doors/windows/doors/{env.ENTRY}/1/program/apply", confirmed=True)
    assert r.status_code == 200, r.text
    assert r.json()["result"]["outcome"] == "written" and r.json()["result"]["write"]["state"] == "verified"
    assert engine_row(env)["write_attempts"] == 0


def test_a_new_document_starts_a_new_cycle_after_failed(env):
    ruled(env)
    env.join.on = False
    for _ in range(dwp.MAX_ATTEMPTS + 1):
        env.world.advance(3600)
        env.sync()
    assert engine_row(env)["write_state"] == "failed"
    env.join.on = True
    r = env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
                periods=[{"weekday": 1, "start": "08:30", "end": "10:00"}], confirmed=True)
    assert r.status_code == 200, r.text
    env.sync()
    assert engine_row(env)["write_state"] == "verified"


def test_an_unknown_save_is_settled_by_a_read_never_by_a_second_save(env):
    ruled(env)
    env.world.programs.lose_answer[SAVE] = "after_effect"  # WisKey stored it, the answer is lost
    env.sync()
    row = engine_row(env)
    assert row["write_state"] == "retry_wait" and row["last_error"].startswith("unknown:")
    env.world.advance(dwp.RETRY_WAIT_S[0] + 1)
    env.sync()
    assert len(saves(env)) == 1, "the read proved the program is held: no second save"
    assert engine_row(env)["write_state"] == "verified"


def test_a_revision_conflict_is_retried_from_a_fresh_read(env):
    ruled(env)
    env.world.programs.errors_once[SAVE] = "revision_conflict"
    env.sync()
    assert engine_row(env)["write_state"] == "retry_wait"
    env.world.advance(dwp.RETRY_WAIT_S[0] + 1)
    env.sync()
    assert engine_row(env)["write_state"] == "verified"


# ---------------------------------------------------------------- drift

def _written(env):
    ruled(env)
    env.sync()
    assert engine_row(env)["write_state"] == "verified"


def test_a_program_paused_in_the_intercom_window_is_drift_and_is_not_corrected_automatically(env):
    _written(env)
    person_pauses_in_the_panel(env)
    env.world.advance(60)
    env.sync()
    assert engine_row(env)["write_state"] == "verified", "the drift check runs at most every DRIFT_CHECK_S"
    env.world.advance(dwp.DRIFT_CHECK_S)
    env.sync()
    row = engine_row(env)
    assert (row["write_state"], row["drift_kind"]) == ("drift", "disabled") and row["drift_at"]
    assert "door.window.program_drift" in env.audit_actions()
    assert all(o["state"] != "armed" for o in env.occurrences(station_id=env.ENTRY) if o["start_at"] > dw.iso(env.now()))
    n = len(saves(env))
    for _ in range(3):
        env.world.advance(dwp.DRIFT_CHECK_S)
        env.sync()
    assert len(saves(env)) == n and fake_program(env)["enabled"] is False, "Arx never re-enables a program a person paused"
    view = env.get("/doors/windows/state").json()["doors"]
    entry = next(d for d in view if d["key"] == f"{env.ENTRY}:1")
    assert entry["program"]["state"] == "drift" and "הושהתה באינטרקום" in entry["program"]["message"]


def test_write_again_after_drift_restores_the_arx_program(env):
    _written(env)
    person_pauses_in_the_panel(env)
    env.world.advance(dwp.DRIFT_CHECK_S + 1)
    env.sync()
    pre = env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview").json()["preview"]
    assert pre["action"] == "held" and pre["reason"] == "drift"
    r = env.post(f"/doors/windows/doors/{env.ENTRY}/1/program/apply", confirmed=True)
    assert r.status_code == 200, r.text
    assert fake_program(env)["enabled"] is True
    row = engine_row(env)
    assert (row["write_state"], row["drift_at"], row["program_version"]) == ("verified", None, 2)
    audit = env.rows("SELECT actor_user_id, decision, details_json FROM audit_log WHERE action = 'door.window.program_apply'")
    assert audit and audit[-1]["decision"] == "allowed" and audit[-1]["actor_user_id"]


def test_a_changed_program_is_drift_and_switching_off_still_pauses_it(env):
    _written(env)
    env.world.programs.programs[(env.ENTRY, 1)].policy["schedule"]["weekly"]["Monday"] = [{"start": "06:00", "end": "20:00"}]
    env.world.advance(dwp.DRIFT_CHECK_S + 1)
    env.sync()
    assert engine_row(env)["drift_kind"] == "changed"
    r = env.put("/doors/windows/settings", changes={"doors.windows.enabled": "off"}, confirmed=True)
    assert r.status_code == 200, r.text
    env.sync()
    assert fake_program(env)["enabled"] is False, "switching off never leaves a door scheduled open, drift or not"
    assert engine_row(env)["write_state"] == "idle"


def test_a_program_made_in_the_intercom_window_is_never_overwritten(env):
    env.world.programs.add_foreign(env.ENTRY, 1)
    ruled(env)
    env.sync()
    assert engine_row(env)["write_state"] == "foreign" and saves(env) == []
    r = env.post(f"/doors/windows/doors/{env.ENTRY}/1/program/apply", confirmed=True)
    assert r.status_code == 200 and r.json()["result"]["outcome"] == "foreign" and saves(env) == []
    assert fake_program(env)["policy"]["schedule"]["name"] == "Lobby hours"


def test_an_invalid_program_is_not_sent(env, monkeypatch):
    monkeypatch.setattr(dwp, "MAX_REQUEST_BYTES", 100)
    ruled(env)
    env.sync()
    row = engine_row(env)
    assert row["write_state"] == "invalid" and saves(env) == [] and env.port.calls == []
    assert "אינה תקינה" in dw.program_view(row)["message"]


# ---------------------------------------------------------------- the dry run

def _counts(env) -> tuple:
    return (len(env.world.programs.requests) - len([r for r in env.world.programs.requests if r["command"] == LIST]),
            env.rows("SELECT COUNT(*) AS n FROM audit_log")[0]["n"], json.dumps(env.rows("SELECT * FROM door_window_engine"), sort_keys=True))


def test_the_dry_run_writes_nothing_and_says_what_the_write_would_do(env):
    ruled(env)
    before = _counts(env)
    pre = env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview").json()["preview"]
    assert pre["dry_run"] is True and pre["action"] == "write" and pre["two_writes"] is False and pre["invalid"] is None
    assert pre["program"]["weekly"]["Monday"] == ["08:00-11:00"] and pre["current"]["exists"] is False
    assert _counts(env) == before, "the dry run sends no write and changes no row"
    env.sync()
    pre = env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview").json()["preview"]
    assert pre["action"] == "unchanged" and pre["current"]["matches"] is True
    env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
            periods=[{"weekday": 1, "start": "08:00", "end": "10:00"}], confirmed=True)
    pre = env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview").json()["preview"]
    assert pre["action"] == "write" and pre["two_writes"] is True and pre["in_window"] is False


def test_the_dry_run_warns_when_the_door_is_held_open_now(env):
    _written(env)
    env.world.run_until(dt.datetime(2026, 11, 2, 6, 1, tzinfo=UTC))  # 08:01: WisKey holds the door
    env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
            periods=[{"weekday": 1, "start": "08:00", "end": "10:00"}], confirmed=True)
    pre = env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview").json()["preview"]
    assert pre["action"] == "write" and pre["two_writes"] is True and pre["in_window"] is True


def test_the_dry_run_and_write_again_need_manage_on_the_door(env):
    ruled(env)
    env.bind("vic", "viewer")
    assert env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview", "vic").status_code == 403
    assert env.post(f"/doors/windows/doors/{env.ENTRY}/1/program/apply", "vic", confirmed=True).status_code == 403
    assert env.post(f"/doors/windows/doors/{env.ENTRY}/1/program/apply").status_code == 409  # no confirmation
    assert saves(env) == []


def test_write_again_refuses_a_stale_preview(env):
    ruled(env)
    sha = env.get(f"/doors/windows/doors/{env.ENTRY}/1/program/preview").json()["preview"]["sha"]
    env.put(f"/doors/windows/rules/{env.rule_id}", name="בוקר", kind="weekly", doors=[{"station_id": env.ENTRY, "relay": 1}],
            periods=[{"weekday": 1, "start": "09:00", "end": "10:00"}], confirmed=True)
    r = env.post(f"/doors/windows/doors/{env.ENTRY}/1/program/apply", confirmed=True, expect_sha=sha)
    assert r.status_code == 409 and r.json()["code"] == "preview_stale" and saves(env) == []
    assert env.rows("SELECT decision FROM audit_log WHERE action = 'door.window.program_apply'")[-1]["decision"] == "denied"


def test_write_again_in_tier_d_and_with_windows_off_is_refused(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=False)  # shipped flags: tier D
    pw.windows_on()
    r = pw.post(f"/doors/windows/doors/{pw.ENTRY}/1/program/apply", confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "prepared"
    pre = pw.get(f"/doors/windows/doors/{pw.ENTRY}/1/program/preview").json()["preview"]
    assert pre["action"] == "prepared" and pre["current"] is None
    pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "off"}, confirmed=True)
    assert pw.post(f"/doors/windows/doors/{pw.ENTRY}/1/program/apply", confirmed=True).json()["code"] == "windows_off"
    assert dwe.EMERGENCY_ENGINE_BUILT is False and dwe.LIVE_ENGINE_BUILT is False
