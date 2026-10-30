"""F3A-295 / Fable review 3 DW-03: a hung emergency engine must not saturate a shared pool, and a call that was not sent by its deadline
must never go out later (after its row was aged / retried or its incident released). The fix in services/door_emergency.py: a per-dispatch
executor whose not-started calls are cancelled at the deadline, a stale-row claim (`pending -> sent`, incident still in the phase) right
before each send, and the hard per-call deadline `call_with_deadline`. FAKES ONLY: the engines below are in-process fakes; the permit and
LIVE_ENGINE_BUILT are switched on INSIDE the test world only (fake_doorwin_adapters.ProductWorld), the shipped constants are unchanged."""
from __future__ import annotations

import datetime as dt
import threading
import time
from pathlib import Path

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe


class Hanging:
    """Answers acknowledged; the FIRST call of each door in `hang` blocks until `gate` is set (up to 30 s)."""

    simulated = False
    open_supported = True
    lock_supported = True

    def __init__(self, hang: set[str], gate: threading.Event) -> None:
        self.hang, self.gate = hang, gate
        self.calls: list[tuple[str, str, float]] = []
        self._seen: set[str] = set()
        self._lock = threading.Lock()

    def _do(self, phase: str, station_id: str, relay: int) -> dwe.DoorOutcome:
        key = f"{station_id}:{relay}"
        with self._lock:
            self.calls.append((phase, key, time.monotonic()))
            first = (phase, key) not in self._seen
            self._seen.add((phase, key))
        if key in self.hang and first:
            self.gate.wait(30)
        return dwe.DoorOutcome("acknowledged", "")

    def apply(self, kind, station_id, relay, request_id, reason):
        return self._do("apply", station_id, relay)

    def release(self, kind, station_id, relay, request_id):
        return self._do("release", station_id, relay)


@pytest.fixture()
def em(settings, monkeypatch):
    p = ProductWorld(settings, monkeypatch, go_live=True)
    p.doors += [p.dw.Door(p.DOCK, r, f"רציף {r}", "מחסן", "Asia/Jerusalem") for r in range(3, 7)]  # eight doors
    p.emergency_on()
    gate = threading.Event()
    yield p, gate
    gate.set()  # free every fake call still waiting


def _wait_settled(pw, iid: str, limit_s: float = 10.0) -> dict:
    end = time.monotonic() + limit_s
    while time.monotonic() < end:
        inc = pw.get(f"/doors/emergency/incidents/{iid}").json()["incident"]
        if inc["state"] != "applying":
            return inc
        time.sleep(0.02)
    raise AssertionError("the incident never settled")


def _apply_rows(pw, iid: str) -> dict[str, dict]:
    return {f"{r['station_id']}:{r['relay']}": r for r in pw.rows("SELECT * FROM door_emergency_doors WHERE incident_id = ? AND phase = 'apply'", iid)}


def test_four_hung_doors_do_not_hold_back_the_other_four(em, monkeypatch):
    pw, gate = em
    monkeypatch.setattr(de, "DISPATCH_INLINE", False)
    monkeypatch.setattr(de, "ENGINE_DEADLINE_S", 0.5)
    keys = [d.key for d in pw.doors]
    engine = Hanging(set(keys[:4]), gate)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: engine)
    started = time.monotonic()
    iid = pw.press().json()["incident"]["id"]
    inc = _wait_settled(pw, iid)
    elapsed = time.monotonic() - started
    first_calls = {k: t for _, k, t in engine.calls}
    assert set(first_calls) == set(keys), "all eight doors were sent"
    assert max(first_calls.values()) - min(first_calls.values()) < 0.5, "doors 5-8 went out at once, not behind the hung four"
    rows = _apply_rows(pw, iid)
    assert all((rows[k]["state"], rows[k]["code"]) == ("unknown", "deadline") for k in keys[:4])
    assert all(rows[k]["state"] == "acknowledged" for k in keys[4:])
    assert inc["state"] == "in_effect_partial" and elapsed < 0.5 + de.DISPATCH_GRACE_S + 2

    # the retry path gets its own executor: it is not stuck behind the four calls that still hang
    pw.t[0] = pw.now() + dt.timedelta(seconds=de.RETRY_GAP_S + 1)
    assert de.retry_tick(pw.db, pw.settings, pw.now()) == 1
    assert all(r["state"] == "acknowledged" for r in _apply_rows(pw, iid).values())
    assert pw.rows("SELECT state FROM door_emergency_incidents WHERE id = ?", iid)[0]["state"] == "in_effect"

    # the hung calls finally answer: their late answers are discarded, nothing changes
    n = len(engine.calls)
    gate.set()
    time.sleep(0.2)
    assert len(engine.calls) == n and all(r["state"] == "acknowledged" for r in _apply_rows(pw, iid).values())


def test_a_call_that_had_not_started_by_the_deadline_never_goes_out(em, monkeypatch):
    """One worker (LANE_MAX 1), the first door stuck before its send: the other three are cancelled at the deadline, and the stuck one is
    refused by the claim when it wakes up - the engine is never called, even after the gate opens."""
    pw, gate = em
    pw.doors[:] = pw.doors[:4]
    monkeypatch.setattr(de, "DISPATCH_INLINE", False)
    monkeypatch.setattr(de, "ENGINE_DEADLINE_S", 0.3)
    monkeypatch.setattr(de, "DISPATCH_GRACE_S", 0)
    monkeypatch.setattr(de, "LANE_MAX", 1)
    engine = Hanging(set(), gate)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: engine)
    real_claim = de._claim

    def stuck_claim(db, incident_id, phase, station_id, relay):
        if (station_id, relay) == (pw.ENTRY, 1):
            gate.wait(5)
        return real_claim(db, incident_id, phase, station_id, relay)

    monkeypatch.setattr(de, "_claim", stuck_claim)
    iid = pw.press().json()["incident"]["id"]
    inc = _wait_settled(pw, iid)
    assert inc["state"] == "in_effect_partial"
    assert all((r["state"], r["code"]) == ("unknown", "deadline") for r in _apply_rows(pw, iid).values())
    gate.set()
    time.sleep(0.3)
    assert engine.calls == [], "nothing was sent after the deadline: queued calls cancelled, the late one refused by the stale-row claim"


def test_a_release_landing_mid_dispatch_stops_every_later_apply(em, monkeypatch):
    """The stale-row guard: once the incident is no longer in the apply phase, no further apply goes out - now or on a later retry pass."""
    pw, _gate = em
    pw.doors[:] = pw.doors[:4]

    class ReleasedDuringTheFirstCall:
        simulated = False
        open_supported = True
        lock_supported = True

        def __init__(self) -> None:
            self.calls: list[tuple[str, str]] = []

        def apply(self, kind, station_id, relay, request_id, reason):
            self.calls.append(("apply", f"{station_id}:{relay}"))
            with pw.db.connection() as conn:  # a release committed while this call was on the wire
                conn.execute("UPDATE door_emergency_incidents SET state = 'releasing' WHERE state = 'applying'")
            return dwe.DoorOutcome("acknowledged", "")

        def release(self, kind, station_id, relay, request_id):
            self.calls.append(("release", f"{station_id}:{relay}"))
            return dwe.DoorOutcome("acknowledged", "")

    engine = ReleasedDuringTheFirstCall()
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: engine)
    iid = pw.press().json()["incident"]["id"]
    assert engine.calls == [("apply", f"{pw.ENTRY}:1")], "the three later doors were not sent after the release"
    rows = _apply_rows(pw, iid)
    assert sorted(r["state"] for r in rows.values()) == ["acknowledged", "pending", "pending", "pending"]
    later = pw.now() + dt.timedelta(minutes=5)
    de.retry_tick(pw.db, pw.settings, later)
    assert [c for c in engine.calls if c[0] == "apply"] == [("apply", f"{pw.ENTRY}:1")], "and no retry pass sends them later"


def test_a_row_is_claimed_once_and_only_in_its_phase(em):
    pw, _gate = em
    iid = pw.press().json()["incident"]["id"]
    with pw.db.connection() as conn:
        conn.execute("UPDATE door_emergency_doors SET state = 'pending' WHERE incident_id = ? AND station_id = ?", (iid, pw.SIDE))
        conn.execute("UPDATE door_emergency_incidents SET state = 'applying' WHERE id = ?", (iid,))
    assert de._claim(pw.db, iid, "release", pw.SIDE, 1) is False, "an apply-phase incident has no release to send"
    assert de._claim(pw.db, iid, "apply", pw.SIDE, 1) is True
    assert de._claim(pw.db, iid, "apply", pw.SIDE, 1) is False, "two dispatchers never both send the same row"
    assert pw.rows("SELECT state FROM door_emergency_doors WHERE incident_id = ? AND station_id = ? AND phase = 'apply'", iid, pw.SIDE)[0]["state"] == "sent"
    assert de._claim(pw.db, "no-such-incident", "apply", pw.SIDE, 1) is False


# ---------------------------------------------------------------- the channel's hard per-call deadline

def test_call_with_deadline_answers_raises_and_times_out():
    assert de.call_with_deadline(lambda: dwe.DoorOutcome("acknowledged", ""), 1).state == "acknowledged"
    with pytest.raises(dwe.EngineError):
        de.call_with_deadline(lambda: (_ for _ in ()).throw(dwe.EngineError("refused", "x")), 1)
    gate = threading.Event()
    t0 = time.monotonic()
    out = de.call_with_deadline(lambda: gate.wait(10) and dwe.DoorOutcome("acknowledged", ""), 0.2)
    assert (out.state, out.code) == ("unknown", "deadline") and time.monotonic() - t0 < 1.5
    gate.set()


def test_the_in_flight_cap_refuses_to_send_rather_than_queue(monkeypatch):
    """The physical-command safety half (blocking gate): with the cap full, a call is refused `not_sent:lane_full` and never reaches the
    engine - never queued. GATELANES-297: no wall-clock wait in here any more; the slot's recovery is the timing-lane test below."""
    monkeypatch.setattr(de, "_INFLIGHT", threading.BoundedSemaphore(1))
    gate = threading.Event()
    try:
        assert de.call_with_deadline(lambda: gate.wait(10), 0.1).code == "deadline"  # holds the only slot while it hangs
        sent = []
        for _ in range(3):  # every call while the slot is held is refused, none is held back to go out later
            out = de.call_with_deadline(lambda: sent.append(1), 0.5)
            assert (out.state, out.code) == ("unknown", "not_sent:lane_full"), out
        assert sent == [], "nothing reached the engine"
    finally:
        gate.set()
    assert sent == [], "and nothing went out after the slot was freed: a refused call is not queued"


@pytest.mark.timing_lane
def test_the_in_flight_slot_is_freed_when_the_hung_call_ends(monkeypatch):
    """GATELANES-297 timing lane: the liveness half of the test above (wall-clock: the hung call's thread must end and free its slot
    within 2 s, and the next call must answer within 1 s). The combined test was FLAKY in 8 of the last 40 gate / nightly runs."""
    monkeypatch.setattr(de, "_INFLIGHT", threading.BoundedSemaphore(1))
    gate = threading.Event()
    assert de.call_with_deadline(lambda: gate.wait(10), 0.1).code == "deadline"  # holds the only slot while it hangs
    assert de.call_with_deadline(lambda: None, 0.5).code == "not_sent:lane_full"
    gate.set()
    end = time.monotonic() + 2
    while time.monotonic() < end and not de._INFLIGHT.acquire(blocking=False):
        time.sleep(0.01)
    de._INFLIGHT.release()
    assert de.call_with_deadline(lambda: dwe.DoorOutcome("acknowledged", ""), 1).state == "acknowledged", "the slot is freed when the hung call ends"


def test_a_late_hung_call_frees_the_slot_it_took_not_the_current_cap(monkeypatch):
    """QUARANTINE-295: the hung call of the test above ends after its gate is set - on a busy runner during the next test, which
    had swapped the cap for a 1-slot one. The late call released the NEW cap (the module global read at release time), so the
    next call was sent instead of refused `not_sent:lane_full`. A call frees exactly the slot it took."""
    first = threading.BoundedSemaphore(1)
    monkeypatch.setattr(de, "_INFLIGHT", first)
    gate = threading.Event()
    assert de.call_with_deadline(lambda: gate.wait(10), 0.05).code == "deadline"  # holds the only slot of `first`
    second = threading.BoundedSemaphore(1)
    monkeypatch.setattr(de, "_INFLIGHT", second)
    assert second.acquire(blocking=False)  # the current cap is full
    gate.set()
    end, freed = time.monotonic() + 5, False
    while not freed and time.monotonic() < end:  # waits for the late call's release (event-driven: ends the moment it lands)
        freed = first.acquire(blocking=False) or time.sleep(0.01) or False
    assert freed, "the late call freed the slot of the cap it took"
    assert not second.acquire(blocking=False), "and not a slot of the cap it never took"


def test_the_live_transport_timeout_is_inside_the_seam_deadline_and_nothing_was_enabled():
    assert 0 < dwe.WiskeyEmergencyEngine.transport_timeout_s < de.ENGINE_DEADLINE_S
    src = Path(dwe.__file__).read_text(encoding="utf-8")
    assert "\nLIVE_ENGINE_BUILT = False" in src and "\nGO_LIVE_PERMITTED = True" in src, "F3A changes no permit and builds no live engine"
