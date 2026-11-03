"""DOORWIN2-295: the fixes of the Fable security review 2 (2026-10-21) for door windows and emergency controls - W-01 (a guard's cancel of a future
window must reach the engine), E-01 (a release never depends on the master switch), E-02 (OPEN over LOCK releases the LOCK at the engine first),
E-03 (a deadline at the seam; unanswered rows age into UNKNOWN), E-04 (an UNKNOWN OPEN is not repeated by default). Fakes only; nothing is enabled."""
from __future__ import annotations

import datetime as dt
import threading
import time

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_world import DoorwinWorld

from smplwise.db import set_setting
from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC)  # Monday 07:00 local


# ================================================================ W-01

@pytest.fixture()
def win(settings, monkeypatch):
    world = DoorwinWorld(start=T0)
    p = ProductWorld(settings, monkeypatch, world=world)
    p.windows_on()
    p.rule(periods=[{"weekday": 1, "start": "08:00", "end": "11:00"}])
    p.sync()
    p.bind("gus", "door_windows_guard")
    p.job = world.scheduler.every(15, p.watch, owner="arx", name="watchdog")
    return p


def test_w01_cancelling_a_future_window_removes_it_from_the_engine_and_it_stays_cancelled(win):
    (occ,) = [o for o in win.occurrences(station_id=win.ENTRY) if o["start_at"] == "2026-11-02T06:00:00Z"]
    assert occ["state"] == "armed"
    r = win.post(f"/doors/windows/occurrences/{occ['id']}/end-now", "gus", confirmed=True)
    assert r.status_code == 200 and r.json()["occurrence"]["state"] == "cancelled", r.text
    prog = win.world.programs.program(win.ENTRY, 1)
    day = [h for h in prog["policy"]["schedule"]["holidays"] if h["start"] == "2026-11-02"]
    assert day and day[0]["periods"] == [], "the engine's program omits the cancelled window (an exception with no periods for that date)"
    win.sync()
    win.sync()
    assert [o["state"] for o in win.occurrences(station_id=win.ENTRY, token=occ["token"])] == ["cancelled"], "the next compile never re-plans it"
    win.world.run_until(dt.datetime(2026, 11, 2, 6, 30, tzinfo=UTC))
    assert not win.world.bank.truth_open((win.ENTRY, 1)), "the door was NOT held open at the planned time"
    nxt = [o for o in win.occurrences(station_id=win.ENTRY) if o["start_at"] > "2026-11-02T07:00:00Z" and o["state"] != "cancelled"]
    assert nxt, "only that one date is excluded: next Monday's window is still planned"
    assert win.rows("SELECT excluded_by FROM door_window_exclusions")[0]["excluded_by"] == "dev-gus"


def test_w01_without_the_fix_the_old_behaviour_is_detectable(win):
    """The exclusion row is what survives a restart: the plan is rebuilt from it, not from memory."""
    (occ,) = [o for o in win.occurrences(station_id=win.ENTRY) if o["start_at"] == "2026-11-02T06:00:00Z"]
    win.post(f"/doors/windows/occurrences/{occ['id']}/end-now", "gus", confirmed=True)
    win.world.arx_restart()
    with win.db.connection() as conn:
        conn.execute("UPDATE door_window_engine SET written_sha256 = NULL")  # force a rewrite as after a restart
    win.sync()
    day = [h for h in win.world.programs.program(win.ENTRY, 1)["policy"]["schedule"]["holidays"] if h["start"] == "2026-11-02"]
    assert day and day[0]["periods"] == []


# ================================================================ E-01

@pytest.fixture()
def em(settings, monkeypatch):
    p = ProductWorld(settings, monkeypatch, go_live=True)
    p.emergency_on()
    return p


def test_e01_the_master_switch_cannot_be_turned_off_during_an_incident(em):
    iid = em.press().json()["incident"]["id"]
    r = em.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "off"}, confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "incident_active"
    assert em.release(iid).status_code == 200
    assert em.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "off"}, confirmed=True).status_code == 200


def test_e01_an_incident_in_effect_is_releasable_after_the_switch_is_off_or_the_build_rolled_back(em, monkeypatch):
    iid = em.press().json()["incident"]["id"]
    with em.db.connection() as conn:                      # the switch turned off behind the API (a restore, a rollback of the settings)
        set_setting(conn, de.ENABLED, "off")
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)  # ...and a build whose permit is False
    assert de.enabled(em.db.connection(mode="read").__enter__()) is False
    assert em.press().json()["code"] == "emergency_off", "a START still needs the switch"
    prep = em.post("/doors/emergency/prepare", action="release", kind="lock_secure", incident_id=iid)
    assert prep.status_code == 200, prep.text
    r = em.release(iid)
    assert r.status_code == 200 and r.json()["incident"]["state"] in ("releasing", "released"), r.text
    assert any(c["phase"] == "release" for c in em.emergency.calls), "the engine was asked to release"


# ================================================================ E-02

@pytest.fixture()
def open_on(em, monkeypatch):
    monkeypatch.setattr(dwe.WiskeyEmergencyEngine, "open_supported", True)
    assert em.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert em.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    return em


def test_e02_open_over_lock_releases_the_lock_at_the_engine_before_the_open(open_on):
    pw = open_on
    lock = pw.press().json()["incident"]
    pw.t[0] += dt.timedelta(seconds=11)
    n_lock = len(pw.emergency.calls)
    r = pw.press("open")
    assert r.status_code == 201, r.text
    calls = pw.emergency.calls[n_lock:]
    phases = [(c["phase"], c["kind"]) for c in calls]
    doors = len(pw.doors)
    assert phases[:doors] == [("release", "lock_secure")] * doors and phases[doors:] == [("apply", "open")] * doors, "every LOCK door is released at the engine, then the OPEN goes out"
    old = pw.get(f"/doors/emergency/incidents/{lock['id']}").json()["incident"]
    assert old["state"] == "released" and old["superseded_by"] == r.json()["incident"]["id"]


def test_e02_a_failed_lock_release_does_not_hold_back_the_evacuation(open_on):
    pw = open_on
    pw.press()
    pw.t[0] += dt.timedelta(seconds=11)
    pw.emergency.release_script = {f"{pw.ENTRY}:1": ["raise_refused"]}
    r = pw.press("open")
    assert r.status_code == 201 and r.json()["incident"]["counts"]["ok"] == len(pw.doors), "evacuation beats lockdown; the refusal is recorded, not blocking"
    assert pw.get(f"/doors/emergency/incidents/{r.json()['incident']['id']}").json()["incident"]["state"] == "in_effect"


# ================================================================ E-03

def test_e03_a_call_that_never_answers_is_unknown_after_the_deadline(em, monkeypatch):
    monkeypatch.setattr(de, "DISPATCH_INLINE", False)
    monkeypatch.setattr(de, "ENGINE_DEADLINE_S", 0.3)
    gate = threading.Event()

    class Hanging:
        simulated = False
        open_supported = True
        lock_supported = True

        def apply(self, kind, station_id, relay, request_id, reason):
            if (station_id, relay) == (em.ENTRY, 1):
                gate.wait(5)
            return dwe.DoorOutcome("acknowledged", "")

        def release(self, kind, station_id, relay, request_id):
            return dwe.DoorOutcome("acknowledged", "")

    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: Hanging())
    p = em.post("/doors/emergency/prepare", action="start", kind="lock_secure", scope_type="installation", scope_id="*")
    started = time.monotonic()
    r = em.post("/doors/emergency/incidents", confirm_token=p.json()["confirm_token"], confirmed=True, reason="", client_request_id="req-deadline-0001")
    assert r.status_code == 201
    iid = r.json()["incident"]["id"]
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and em.get(f"/doors/emergency/incidents/{iid}").json()["incident"]["state"] == "applying":
        time.sleep(0.05)
    gate.set()
    inc = em.get(f"/doors/emergency/incidents/{iid}").json()["incident"]
    hung = next(d for d in inc["doors"] if d["door"] == f"{em.ENTRY}:1" and d["phase"] == "apply")
    assert hung["state"] == "unknown" and hung["code"] == "deadline" and inc["state"] == "in_effect_partial" and time.monotonic() - started < 5


def test_e03_rows_nobody_answered_age_into_unknown(em):
    iid = em.press().json()["incident"]["id"]
    with em.db.connection() as conn:
        conn.execute("UPDATE door_emergency_doors SET state = 'pending', code = NULL, attempts = 0, settled_at = NULL WHERE incident_id = ? AND station_id = ?", (iid, em.SIDE))
        conn.execute("UPDATE door_emergency_incidents SET state = 'applying' WHERE id = ?", (iid,))
    assert de.age_pending(em.db, em.now()) == 0, "not yet: the phase began less than PENDING_MAX_S ago"
    later = em.now() + dt.timedelta(seconds=de.PENDING_MAX_S + 5)
    assert de.age_pending(em.db, later) == 1
    row = em.rows("SELECT state, code, attempts, next_at FROM door_emergency_doors WHERE incident_id = ? AND station_id = ?", iid, em.SIDE)[0]
    assert (row["state"], row["code"], row["attempts"]) == ("unknown", "deadline", 1) and row["next_at"], "the bounded close-direction retry applies to a LOCK"
    assert em.rows("SELECT state FROM door_emergency_incidents WHERE id = ?", iid)[0]["state"] == "in_effect_partial", "the headline becomes partial"


@pytest.mark.parametrize("dw09", [False, True])
def test_e03_an_aged_open_row_follows_the_bounded_e1_retry_only_when_dw09_is_proven(open_on, monkeypatch, dw09):
    """WKADAPT-295 (owner decision 2026-10-23, WisKey DW-09): as shipped an aged OPEN row is UNKNOWN with no retry planned; the bounded E-1 retry
    (owner decision 2026-10-21) applies only once DW09_OPEN_RETRY_AFTER_UNKNOWN is on (switched on in this test only)."""
    assert de.DW09_OPEN_RETRY_AFTER_UNKNOWN is False
    monkeypatch.setattr(de, "DW09_OPEN_RETRY_AFTER_UNKNOWN", dw09)
    pw = open_on
    iid = pw.press("open").json()["incident"]["id"]
    with pw.db.connection() as conn:
        conn.execute("UPDATE door_emergency_doors SET state = 'pending', code = NULL, attempts = 0, settled_at = NULL, next_at = NULL WHERE incident_id = ? AND station_id = ?", (iid, pw.SIDE))
        conn.execute("UPDATE door_emergency_incidents SET state = 'applying' WHERE id = ?", (iid,))
    de.age_pending(pw.db, pw.now() + dt.timedelta(seconds=de.PENDING_MAX_S + 5))
    row = pw.rows("SELECT state, next_at FROM door_emergency_doors WHERE incident_id = ? AND station_id = ?", iid, pw.SIDE)[0]
    assert row["state"] == "unknown"
    assert bool(row["next_at"]) is dw09, "an unknown OPEN is retried (bounded, same request id) only after the four DW-09 conditions are proven"


# ================================================================ nothing was enabled

def test_every_switch_still_ships_off_and_the_permit_is_the_owners_decision_in_the_source(em):
    from pathlib import Path

    s = em.get("/doors/emergency/settings").json()["settings"]
    assert s["doors.emergency.open_enabled"] == "off" and s["doors.emergency.automations"] == "off"
    src = Path(dwe.__file__).read_text(encoding="utf-8")
    # integ/2111: ECCACT-295 carries the owner decision of 2026-10-21 (option A) that opened this permit; the switches above still ship off
    assert "\nGO_LIVE_PERMITTED = True" in src, "ECCACT-295: opened by the owner decision of 2026-10-21; the world patches it inside a test only"
    assert "\nLIVE_ENGINE_BUILT = False" in src, "DWFIX-295: the live engine answers not_implemented - tier D, and no emergency switch"
