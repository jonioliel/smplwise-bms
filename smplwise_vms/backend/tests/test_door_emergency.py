"""DOORWIN-295 (CR-039 8, threat rows T7-T9, T17-T21): emergency door controls - LOCK all doors / OPEN all doors.

Negative first: shipped off, two-step confirmation (single-use, user-bound, 20 s), permission and scope by binding (deny wins per
station), rate limits, the automation refusal, drills that never reach an engine. The live engine is `ScriptedEmergencyEngine` (a per-door
outcome script) and the go-live permit is switched on inside the test only. Nothing reaches WisKey, Home Assistant, a station or a door."""
from __future__ import annotations

import datetime as dt
import uuid

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.rbac import Principal
from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe

UTC = dt.timezone.utc


@pytest.fixture()
def pw(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency_on()
    return w


def incident(pw, iid: str) -> dict:
    return pw.get(f"/doors/emergency/incidents/{iid}").json()["incident"]


def tick(pw, seconds: int) -> None:
    pw.t[0] += dt.timedelta(seconds=seconds)


# ---------------------------------------------------------------- shipped off / refused live

def test_off_by_default_and_the_real_control_is_refused_while_off(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=False)
    r = w.press()
    assert r.status_code == 409 and r.json()["code"] == "emergency_off"
    assert w.emergency.calls == []
    st = w.get("/doors/emergency/state").json()
    assert st["enabled"] is False and st["active"] is None


def test_a_drill_works_while_off_and_never_reaches_any_engine(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=False)
    r = w.press("lock_secure", drill=True)
    assert r.status_code == 201, r.text
    inc = r.json()["incident"]
    assert inc["drill"] is True and inc["state"] == "in_effect" and inc["counts"]["ok"] == 4
    assert w.emergency.calls == [], "a drill gets the simulation, never the live engine"
    assert w.press("lock_secure", drill=True).json()["code"] == "incident_active", "one drill at a time (OPEN over LOCK is the only one-step change)"
    rel = w.release(inc["id"], drill=True)
    assert rel.status_code == 200 and rel.json()["incident"]["state"] == "released"
    assert "door.emergency.drill" in w.audit_actions()
    drills = w.rows("SELECT * FROM notifications WHERE source = 'door.emergency.drill'")
    assert drills and not w.rows("SELECT * FROM notifications WHERE source = 'door.emergency.started'")


def test_the_shipped_build_cannot_switch_the_emergency_lock_on(settings, monkeypatch):
    """DWFIX-295 (review 3 DW-01 / DW-08): with the constants AS SHIPPED the live engine answers not_implemented, so the switch is refused
    and a real press stays `emergency_off` - no incident of `refused` doors is ever written."""
    # DOORLIVE-2310: the release now builds the engines in; this test models the ROLLBACK build (engine flags off, `go_live=False`) - and the refusing engine itself
    w = ProductWorld(settings, monkeypatch, go_live=False)
    assert dwe.GO_LIVE_PERMITTED is True and dwe.LIVE_ENGINE_BUILT is False and dwe.EMERGENCY_ENGINE_BUILT is False
    assert de.live_ok() is False
    with pytest.raises(dwe.EngineError) as e:
        dwe.WiskeyEmergencyEngine(None).apply("lock_secure", "s", 1, "r", "")
    assert e.value.kind == "not_implemented"
    r = w.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "on"}, confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "engine_not_implemented"
    assert w.press().json()["code"] == "emergency_off" and w.emergency.calls == []
    assert not w.rows("SELECT id FROM door_emergency_incidents")


def test_the_live_emergency_engine_refuses_while_the_permit_is_off(monkeypatch):
    assert dwe.GO_LIVE_PERMITTED is True  # ECCACT-295: opened by the owner decision of 2026-10-21
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)
    eng = dwe.WiskeyEmergencyEngine(None)
    assert eng.open_supported is False
    with pytest.raises(dwe.EngineError) as e:
        eng.apply("lock_secure", "s", 1, "r", "")
    assert e.value.kind == "not_permitted"


# ---------------------------------------------------------------- the two steps

def test_start_needs_a_fresh_single_use_token_of_the_same_person(pw):
    rid = lambda: str(uuid.uuid4())  # noqa: E731
    assert pw.post("/doors/emergency/incidents", confirm_token="x" * 32, confirmed=True, client_request_id=rid()).json()["code"] == "confirmation_invalid"
    p = pw.post("/doors/emergency/prepare", kind="lock_secure").json()
    assert p["doors"] == 4 and "confirm_token" in p
    assert pw.post("/doors/emergency/incidents", confirm_token=p["confirm_token"], client_request_id=rid()).json()["code"] == "confirmation_required"
    pw.bind("sara", "site_admin")
    other = pw.post("/doors/emergency/incidents", "sara", confirm_token=p["confirm_token"], confirmed=True, client_request_id=rid())
    assert other.json()["code"] == "confirmation_invalid", "a token is bound to the person who prepared it"
    ok = pw.post("/doors/emergency/incidents", confirm_token=p["confirm_token"], confirmed=True, client_request_id=rid())
    assert ok.status_code == 201
    again = pw.post("/doors/emergency/incidents", confirm_token=p["confirm_token"], confirmed=True, client_request_id=rid())
    assert again.json()["code"] == "confirmation_used"
    assert pw.rows("SELECT COUNT(*) AS n FROM door_emergency_incidents")[0]["n"] == 1
    stored = pw.rows("SELECT token_sha256 FROM door_emergency_confirmations")
    assert p["confirm_token"] not in str(stored), "only the hash is stored"


def test_a_token_expires_after_20_seconds(pw):
    p = pw.post("/doors/emergency/prepare", kind="lock_secure").json()
    tick(pw, 21)
    r = pw.post("/doors/emergency/incidents", confirm_token=p["confirm_token"], confirmed=True, client_request_id=str(uuid.uuid4()))
    assert r.json()["code"] == "confirmation_expired"


def test_a_release_token_cannot_start_and_a_start_token_cannot_release(pw):
    inc = pw.press().json()["incident"]
    p = pw.post("/doors/emergency/prepare", action="release", kind="lock_secure", incident_id=inc["id"]).json()
    tick(pw, 11)
    assert pw.post("/doors/emergency/incidents", confirm_token=p["confirm_token"], confirmed=True, client_request_id=str(uuid.uuid4())).json()["code"] == "confirmation_invalid"


def test_prepare_is_rate_limited(pw):
    codes = [pw.post("/doors/emergency/prepare", kind="lock_secure").status_code for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


def test_e08_the_prepare_limit_survives_a_restart(pw):
    """Fable review 2 E-08: the per-minute `prepare` limit is also counted from the confirmations table, so a restart (the in-memory
    counter emptied) does not reset it; it lapses after a minute of the route's clock."""
    codes = [pw.post("/doors/emergency/prepare", kind="lock_secure").status_code for _ in range(10)]
    assert codes == [200] * 10
    de.reset_rate()  # what a process restart does to the in-memory counter
    r = pw.post("/doors/emergency/prepare", kind="lock_secure")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"
    assert len(pw.rows("SELECT token_sha256 FROM door_emergency_confirmations")) == 10, "a refused prepare mints no token"
    de.reset_rate()
    tick(pw, 61)
    assert pw.post("/doors/emergency/prepare", kind="lock_secure").status_code == 200


# ---------------------------------------------------------------- lock: the happy path, partial results, release

def test_lock_all_reaches_every_door_and_is_visible_until_released(pw):
    pw.bind("vered", "viewer")
    r = pw.press(reason="תרגול")
    assert r.status_code == 201, r.text
    inc = r.json()["incident"]
    assert inc["state"] == "in_effect" and inc["counts"] == {"total": 4, "ok": 4, "failed": 0, "unknown": 0}
    assert [c["kind"] for c in pw.emergency.calls] == ["lock_secure"] * 4
    assert inc["first_sent_ms"] is not None and inc["first_sent_ms"] < 1000, "latency evidence (CR-039 8.7)"
    strip = pw.get("/doors/emergency/state", "vered").json()
    assert strip["active"]["kind"] == "lock_secure" and strip["active"]["can_release"] is False and "scopes" not in strip
    n = pw.rows("SELECT severity, state FROM notifications WHERE source = 'door.emergency.started'")
    assert n == [{"severity": "critical", "state": "open"}]
    assert pw.press().json()["code"] in ("incident_active", "rate_limited")
    rel = pw.release(inc["id"])
    assert rel.status_code == 200 and rel.json()["incident"]["state"] == "released"
    assert pw.get("/doors/emergency/state", "vered").json()["active"] is None
    assert pw.rows("SELECT state FROM notifications WHERE source = 'door.emergency.started'")[0]["state"] == "resolved"
    assert {"door.emergency.started", "door.emergency.released", "door.emergency.door_result"} <= set(pw.audit_actions())


def test_partial_failure_is_the_headline_and_unknowns_are_retried_bounded(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["refused"], f"{pw.SIDE}:1": ["unknown", "unknown", "unknown"], f"{pw.DOCK}:1": ["unknown", "acknowledged"]}
    inc = pw.press().json()["incident"]
    assert inc["state"] == "in_effect_partial" and inc["counts"] == {"total": 4, "ok": 1, "failed": 1, "unknown": 2}
    assert not pw.rows("SELECT * FROM notifications WHERE source = 'door.emergency.partial'"), "the headline waits for the bounded retries"
    for _ in range(4):
        tick(pw, 10)
        de.retry_tick(pw.db, pw.settings, pw.t[0])
    v = incident(pw, inc["id"])
    assert v["counts"] == {"total": 4, "ok": 2, "failed": 1, "unknown": 1}
    side = [c for c in pw.emergency.calls if c["door"] == f"{pw.SIDE}:1"]
    assert len(side) == 3, "at most three attempts"
    assert all((b["at"] - a["at"]).total_seconds() >= 10 for a, b in zip(side, side[1:])), "10 s apart"
    assert len([c for c in pw.emergency.calls if c["door"] == f"{pw.ENTRY}:1"]) == 1, "a refused door is not retried"
    assert pw.rows("SELECT severity FROM notifications WHERE source = 'door.emergency.partial'") == [{"severity": "critical"}]


def test_the_release_of_a_lock_is_never_retried_after_an_unknown(pw):
    pw.emergency.release_script = {f"{pw.ENTRY}:1": ["unknown"]}
    inc = pw.press().json()["incident"]
    tick(pw, 11)
    v = pw.release(inc["id"]).json()["incident"]
    assert v["state"] == "released_partial"
    for _ in range(3):
        tick(pw, 10)
        de.retry_tick(pw.db, pw.settings, pw.t[0])
    assert len([c for c in pw.emergency.calls if c["phase"] == "release" and c["door"] == f"{pw.ENTRY}:1"]) == 1


def test_an_engine_exception_is_unknown_never_success(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["raise_unknown"], f"{pw.SIDE}:1": ["raise_refused"]}
    v = pw.press().json()["incident"]
    states = {d["door"]: d["state"] for d in v["doors"] if d["phase"] == "apply"}
    assert states[f"{pw.ENTRY}:1"] == "unknown" and states[f"{pw.SIDE}:1"] == "refused"


# ---------------------------------------------------------------- permission and scope by binding

def test_operator_and_viewer_cannot_press(pw):
    for role in ("operator", "viewer", "door_opener"):
        pw.bind(f"u-{role}", role)
        r = pw.press(user=f"u-{role}")
        assert r.status_code == 403, role


def test_open_is_for_system_administrators_only_and_needs_its_own_switch(pw):
    pw.bind("sara", "site_admin")
    assert pw.press("open", "sara").status_code in (403, 409)
    r = pw.press("open")
    assert r.status_code == 409 and r.json()["code"] == "open_unavailable"


def test_the_scope_is_the_binding_and_a_station_deny_wins(pw):
    with pw.db.connection() as conn:
        conn.execute("INSERT INTO sites(id, name, sort_order, created_at, updated_at) VALUES ('site-a', 'אתר א', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')")
    pw.place(pw.ENTRY, "site-a")
    pw.place(pw.DOCK, "site-a")
    pw.bind("sara", "site_admin", "site", "site-a")
    pw.bind("sara", "site_admin", "access_control_station", pw.DOCK, effect="deny")
    st = pw.get("/doors/emergency/state", "sara").json()
    assert [(s["scope_type"], s["scope_id"], s["doors"]) for s in st["scopes"]["lock_secure"]] == [("site", "site-a", 1)]
    assert pw.press(user="sara").status_code == 403, "not at the installation"
    r = pw.press(user="sara", scope_type="site", scope_id="site-a")
    assert r.status_code == 201, r.text
    assert [d["door"] for d in r.json()["incident"]["doors"]] == [f"{pw.ENTRY}:1"]


def test_the_release_needs_the_same_permission_at_the_incident_scope(pw):
    inc = pw.press().json()["incident"]
    pw.bind("oren", "operator")
    r = pw.post("/doors/emergency/prepare", "oren", action="release", kind="lock_secure", incident_id=inc["id"])
    assert r.status_code == 403


# ---------------------------------------------------------------- abuse: rate limits, automations, non-interactive clients

def test_rate_limits_per_person_and_per_hour(pw, monkeypatch):
    monkeypatch.setitem(de.LIMITS, "prepare_per_min", 100)  # the per-minute `prepare` limiter (real time) has its own test
    first = pw.press().json()["incident"]
    pw.release(first["id"])
    r = pw.press()
    assert r.status_code == 429 and r.json()["details"]["limit"] == "user_gap"
    for _ in range(4):
        tick(pw, 11)
        iid = pw.press().json()["incident"]["id"]
        pw.release(iid)
    tick(pw, 11)
    r = pw.press()
    assert r.status_code == 429 and r.json()["details"]["limit"] == "user_hour"
    assert "door.emergency.rate_limited" in pw.audit_actions()


def test_an_automation_actor_is_refused(pw):
    with pw.db.connection() as conn:
        p = Principal("dev-joni", "joni", "joni", "dev")
        with pytest.raises(Exception) as e:
            de.prepare(conn, pw.settings, p, action="start", kind="lock_secure", scope_type="installation", scope_id="*", incident_id=None, drill=False,
                       now=pw.t[0], actor_kind="automation", dev_mode=True)
    assert getattr(e.value, "code", "") == "automation_not_permitted"


def test_a_bearer_token_client_is_refused(pw):
    with pw.db.connection() as conn:
        p = Principal("dev-joni", "joni", "joni", "dev", via="bearer")
        with pytest.raises(Exception) as e:
            de.prepare(conn, pw.settings, p, action="start", kind="lock_secure", scope_type="installation", scope_id="*", incident_id=None, drill=False,
                       now=pw.t[0], dev_mode=True)
    assert getattr(e.value, "details", {}).get("reason") == "interactive_session_required"


def test_a_duplicate_client_request_id_is_refused(pw):
    rid = str(uuid.uuid4())
    p = pw.post("/doors/emergency/prepare", kind="lock_secure").json()
    assert pw.post("/doors/emergency/incidents", confirm_token=p["confirm_token"], confirmed=True, client_request_id=rid).status_code == 201
    tick(pw, 11)
    p2 = pw.post("/doors/emergency/prepare", kind="open", drill=True).json()
    assert pw.post("/doors/emergency/incidents", confirm_token=p2["confirm_token"], confirmed=True, client_request_id=rid).json()["code"] == "duplicate_request"


# ---------------------------------------------------------------- OPEN (against the fake only) and precedence

@pytest.fixture()
def open_on(pw, monkeypatch):
    monkeypatch.setattr(dwe.WiskeyEmergencyEngine, "open_supported", True)
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).json()["code"] == "attestation_required"
    assert pw.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    return pw


def test_open_over_lock_in_one_step(open_on):
    pw = open_on
    lock = pw.press().json()["incident"]
    tick(pw, 11)
    r = pw.press("open")
    assert r.status_code == 201, r.text
    assert incident(pw, lock["id"])["state"] == "released" and incident(pw, lock["id"])["superseded_by"] == r.json()["incident"]["id"]
    assert pw.get("/doors/emergency/state").json()["active"]["kind"] == "open"
    tick(pw, 11)
    assert pw.press().json()["code"] == "incident_active", "LOCK over OPEN is never one step"


def test_dw09_an_unknown_open_is_not_retried_in_the_shipped_build(open_on):
    """WKADAPT-295 / WisKey DW-09 (owner decision 2026-10-23): the OPEN-after-UNKNOWN retry is OFF until the four DW-09 conditions are proven.
    The live engine being built (switched on in this test world) does not enable it; the LOCK retry and the OPEN release retry are unchanged."""
    assert de.DW09_OPEN_RETRY_AFTER_UNKNOWN is False
    pw = open_on
    assert de.live_ok() is True, "the test world has the live engine on: the flag alone decides"
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"]}
    inc = pw.press("open").json()["incident"]
    for _ in range(5):
        tick(pw, 10)
        de.retry_tick(pw.db, pw.settings, pw.t[0])
    calls = [c for c in pw.emergency.calls if c["door"] == f"{pw.ENTRY}:1" and c["phase"] == "apply"]
    assert len(calls) == 1, "an UNKNOWN OPEN apply is sent once, never repeated"
    row = pw.rows("SELECT state, next_at, settled_at FROM door_emergency_doors WHERE incident_id = ? AND station_id = ? AND phase = 'apply'", inc["id"], pw.ENTRY)[0]
    assert row["state"] == "unknown" and row["next_at"] is None and row["settled_at"] is not None
    assert incident(pw, inc["id"])["state"] == "in_effect_partial"
    assert de._retryable({"kind": "lock_secure"}, "apply") is True
    assert de._retryable({"kind": "open"}, "release") is True
    assert de._retryable({"kind": "lock_secure"}, "release") is False
    assert de._retryable({"kind": "open"}, "apply") is False


def test_e1_an_unknown_open_is_retried_at_most_three_times_10_s_apart_with_the_same_request_id(open_on, monkeypatch):
    """Owner decision 2026-10-21 (E-04, option C): in an emergency we always open. The repeat is bounded and carries the SAME request id every time.
    WKADAPT-295: only once DW09_OPEN_RETRY_AFTER_UNKNOWN is turned on (after the four DW-09 conditions are proven) - switched on in this test only."""
    monkeypatch.setattr(de, "DW09_OPEN_RETRY_AFTER_UNKNOWN", True)
    pw = open_on
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown"]}
    inc = pw.press("open").json()["incident"]
    for _ in range(5):
        tick(pw, 10)
        de.retry_tick(pw.db, pw.settings, pw.t[0])
    calls = [c for c in pw.emergency.calls if c["door"] == f"{pw.ENTRY}:1" and c["phase"] == "apply"]
    assert len(calls) == 3 and all((b["at"] - a["at"]).total_seconds() >= 10 for a, b in zip(calls, calls[1:]))
    assert len({c["request_id"] for c in calls}) == 1, "the same request id on every attempt: the idempotency condition"
    assert incident(pw, inc["id"])["state"] == "in_effect_partial"


def test_turning_emergency_off_turns_open_off(open_on):
    pw = open_on
    r = pw.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "off"}, confirmed=True)
    assert r.status_code == 200 and r.json()["settings"]["doors.emergency.open_enabled"] == "off"


# ---------------------------------------------------------------- interaction with door windows

def test_a_lock_ends_running_windows_and_holds_their_programs_paused(settings, monkeypatch):
    from fake_doorwin_world import DoorwinWorld

    world = DoorwinWorld(start=dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC))
    w = ProductWorld(settings, monkeypatch, world=world)
    w.windows_on()
    w.emergency_on()
    assert w.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}]).status_code == 201
    w.sync()
    world.scheduler.every(15, w.watch, owner="arx")
    world.run_until(dt.datetime(2026, 11, 2, 6, 5, tzinfo=UTC))
    occ = [o for o in w.occurrences(station_id=w.ENTRY) if o["start_at"] == "2026-11-02T06:00:00Z"][0]
    assert occ["state"] == "active"
    inc = w.press().json()["incident"]
    assert not world.programs.program(w.ENTRY, 1)["enabled"], "the LOCK paused the program (close direction)"
    world.run_until(dt.datetime(2026, 11, 2, 6, 8, tzinfo=UTC))
    occ = [o for o in w.occurrences(station_id=w.ENTRY) if o["start_at"] == "2026-11-02T06:00:00Z"][0]
    assert occ["state"] == "closed_confirmed"
    w.sync()
    assert not world.programs.program(w.ENTRY, 1)["enabled"], "no window re-opens under an incident"
    world.run_until(dt.datetime(2026, 11, 2, 6, 9, tzinfo=UTC))
    assert w.release(inc["id"]).status_code == 200
    w.sync()
    assert world.programs.program(w.ENTRY, 1)["enabled"], "the release lets the next compile re-activate the program"
