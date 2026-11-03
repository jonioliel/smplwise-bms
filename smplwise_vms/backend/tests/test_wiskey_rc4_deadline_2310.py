"""WIN-ARX-RC4-DEADLINE-01 (WisKey Windows review of the rc.4 adoption, 2026-10-30; P1, static, NOT_REPRODUCED by them):
the live wrapper's selection wait must be inside the ONE absolute deadline of the engine call.

Before the fix `LiveEmergencyEngine._engine` evaluated `selected` / `features_or_none` before any budget existed; `call_with_deadline`
returned UNKNOWN after its deadline while its daemon thread kept waiting in the selection; once the selection finished, the inner
`DirectEmergencyEngine._run` opened a FRESH 6 s budget and could admit and send a `features/start` that had never left before the deadline.
The fix: `call_with_deadline` fixes the absolute end BEFORE it starts the daemon thread and runs the call inside it
(`wiskey_call_budget.until`); the live wrapper enters the budget before selection and starts nothing once the wait consumed it; the inner
scopes only ever shorten it (`min`), never renew it.

Synthetic and isolated (FAKES ONLY): the real `door_emergency.dispatch` / `call_with_deadline`, the real `LiveEmergencyEngine`, the real
`DirectJoin.emergency_engine` wiring (SelectedFeaturePort -> DirectFeatureClient -> DirectEmergencyEngine) and the real SQLite database;
the WisKey side is tests/wkcap_fakes.FakeDirectPort, the selection is held by Events, and the budget clock is a controlled clock.
Nothing reaches WisKey, Home Assistant, a station or a door; no shipped switch or constant is changed outside this test world."""
from __future__ import annotations

import threading
import time
from typing import Any

import pytest
from fake_doorwin_adapters import ProductWorld
from wkcap_fakes import FakeDirectPort

from smplwise.services import door_emergency as de
from smplwise.services import door_engine_live as live
from smplwise.services import door_windows_engine as dwe
from smplwise.services import wiskey_call_budget as budget
from smplwise.services import wiskey_direct_join as wdj
from smplwise.services import wiskey_feature_exec as fx

SHORT_S = 0.4  # the declared per-call deadline of the blocked cases (real seconds for the waiter; the budget runs on the controlled clock)


class Clock:
    """The controlled monotonic clock of the budget: it moves only when the test moves it."""

    def __init__(self) -> None:
        self.t = time.monotonic()

    def __call__(self) -> float:
        return self.t


class FakeSession:
    connected = True

    def transport_refusal(self, command: str | None = None) -> str | None:
        return None


class HeldJoin:
    """A configured join whose selection waits on `gate` (the slow socket / discovery). It records the budget the selection ran under.
    `emergency_engine` is the REAL DirectJoin wiring over the fake WisKey port."""

    def __init__(self, port: FakeDirectPort) -> None:
        self.capture_port = port
        self.session = FakeSession()
        self.gate = threading.Event()
        self.gate.set()
        self.entered = threading.Event()
        self.seen: list[tuple[str | None, float | None]] = []  # (command, absolute budget end active during the selection)

    def configured(self) -> bool:
        return True

    def selected(self, command: str | None = None) -> bool:
        self.seen.append((command, budget._END.get()))
        self.entered.set()
        assert self.gate.wait(15), "the test never released the selection"
        return True

    def features_or_none(self) -> Any:
        return object() if self.selected("features/start") else None

    def emergency_engine(self, connect):
        return wdj.DirectJoin.emergency_engine(self, connect)


@pytest.fixture()
def world(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.doors[:] = pw.doors[:1]  # one door: one engine call per phase
    pw.emergency_on()
    assert pw.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    with pw.db.connection(mode="read") as conn:
        admin = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()["id"]
    with pw.db.connection() as conn:
        for d in pw.doors:
            fx.set_relay_map(conn, station_id=d.station_id, api_relay=d.relay, physical_relay=d.relay, confirmed_by=admin, expected_revision=0)
    port = FakeDirectPort()
    join = HeldJoin(port)
    engine = live.LiveEmergencyEngine(pw.db, join=lambda: join)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: engine)
    monkeypatch.setattr(de, "DISPATCH_INLINE", False)  # the real daemon-thread path of call_with_deadline
    clock = Clock()
    monkeypatch.setattr(budget, "_clock", clock, raising=False)
    pw.port, pw.join, pw.clock, pw.live = port, join, clock, engine
    yield pw
    join.gate.set()  # free a selection still waiting
    _wait_calls_done()


def _wait_calls_done(limit_s: float = 15.0) -> None:
    end = time.monotonic() + limit_s
    while any(t.name == "door-emergency-call" and t.is_alive() for t in threading.enumerate()):
        if time.monotonic() > end:
            raise AssertionError("an engine call thread never ended")
        time.sleep(0.02)


def _door_row(pw, iid: str, phase: str) -> dict:
    rows = pw.rows("SELECT * FROM door_emergency_doors WHERE incident_id = ? AND phase = ?", iid, phase)
    assert len(rows) == 1
    return rows[0]


def _wait_door(pw, iid: str, phase: str, limit_s: float = 15.0) -> dict:
    end = time.monotonic() + limit_s
    while time.monotonic() < end:
        row = _door_row(pw, iid, phase)
        if row["state"] not in ("pending", "sent"):
            return row
        time.sleep(0.02)
    raise AssertionError(f"the {phase} door row never settled")


def _starts(pw, command: str | None = None) -> list[dict]:
    out = pw.port.sent("features/start")
    return [s for s in out if command is None or s["policy_snapshot"]["private_input"]["command"] == command]


def _intents(pw) -> list[dict]:
    return pw.rows("SELECT request_id, state, code FROM wiskey_feature_intents ORDER BY rowid")


def _hold_within_budget(pw) -> str:
    """The happy OPEN: selection immediate, the hold admitted, sent and acknowledged inside the one deadline."""
    r = pw.press("open")
    assert r.status_code == 201, r.text
    iid = r.json()["incident"]["id"]
    row = _wait_door(pw, iid, "apply")
    _wait_calls_done()
    assert (row["state"], row["code"]) == ("acknowledged", "acknowledged"), row
    assert len(_starts(pw, "hold_open")) == 1
    return iid


# ---------------------------------------------------------------- the failing interleaving (apply)

def test_an_open_held_in_selection_past_its_deadline_is_unknown_and_never_sent_later(world, monkeypatch):
    pw = world
    monkeypatch.setattr(de, "ENGINE_DEADLINE_S", SHORT_S)
    t0 = pw.clock.t
    pw.join.gate.clear()
    r = pw.press("open")
    assert r.status_code == 201, r.text
    iid = r.json()["incident"]["id"]
    assert pw.join.entered.wait(10), "the engine call reached the selection"
    row = _wait_door(pw, iid, "apply")
    assert (row["state"], row["code"]) == ("unknown", "deadline"), "the caller got UNKNOWN at its deadline"
    assert _starts(pw) == [] and _intents(pw) == []

    # the selection only finishes long after the deadline
    pw.clock.t = t0 + 100.0
    pw.join.gate.set()
    _wait_calls_done()

    assert _starts(pw) == [], "no features/start was sent after the deadline"
    assert _intents(pw) == [], "nothing was admitted after the deadline"
    assert pw.join.seen and pw.join.seen[0][1] == pytest.approx(t0 + SHORT_S, abs=1e-6), \
        "the selection itself ran inside the ONE absolute deadline fixed before the daemon thread started"
    row = _door_row(pw, iid, "apply")
    assert (row["state"], row["code"]) == ("unknown", "deadline"), "no late success overwrote the UNKNOWN"


# ---------------------------------------------------------------- the failing interleaving (release)

def test_a_release_held_in_selection_past_its_deadline_is_unknown_and_never_sent_later(world, monkeypatch):
    pw = world
    iid = _hold_within_budget(pw)
    monkeypatch.setattr(de, "ENGINE_DEADLINE_S", SHORT_S)
    t0 = pw.clock.t
    pw.join.gate.clear()
    pw.join.entered.clear()
    n_seen = len(pw.join.seen)
    rel = pw.release(iid, kind="open")
    assert rel.status_code == 200, rel.text
    assert pw.join.entered.wait(10), "the release call reached the selection"
    row = _wait_door(pw, iid, "release")
    assert (row["state"], row["code"]) == ("unknown", "deadline")
    n_intents = len(_intents(pw))

    pw.clock.t = t0 + 100.0
    pw.join.gate.set()
    _wait_calls_done()

    assert _starts(pw, "release") == [], "no release start was sent after the deadline"
    assert len(_intents(pw)) == n_intents, "nothing was admitted after the deadline"
    assert pw.join.seen[n_seen][1] == pytest.approx(t0 + SHORT_S, abs=1e-6), "the release selection ran inside the one deadline"
    row = _door_row(pw, iid, "release")
    assert (row["state"], row["code"]) == ("unknown", "deadline"), "no late success overwrote the UNKNOWN"


# ---------------------------------------------------------------- within budget, and release with the permit off

def test_open_and_release_within_the_deadline_still_work_and_never_get_a_fresh_deadline(world):
    pw = world
    t0 = pw.clock.t
    ends: list[float | None] = []
    pw.port.on_call = lambda command, params: ends.append(budget._END.get())
    iid = _hold_within_budget(pw)
    rel = pw.release(iid, kind="open")
    assert rel.status_code == 200, rel.text
    row = _wait_door(pw, iid, "release")
    _wait_calls_done()
    assert (row["state"], row["code"]) == ("acknowledged", "acknowledged")
    assert len(_starts(pw, "release")) == 1
    assert ends and all(e is not None and e <= t0 + de.ENGINE_DEADLINE_S + 1e-9 for e in ends), \
        "every WisKey call ran under the dispatcher's one absolute deadline (inner scopes only shorten it)"
    assert [x["state"] for x in _intents(pw)] == ["accepted", "accepted"]


def test_release_within_the_deadline_still_works_with_the_business_permit_off(world, monkeypatch):
    pw = world
    iid = _hold_within_budget(pw)
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)  # the business permit is withdrawn mid-incident
    with pw.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('doors.emergency.enabled', 'off')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('doors.emergency.open_enabled', 'off')")
    rel = pw.release(iid, kind="open")
    assert rel.status_code == 200, rel.text
    row = _wait_door(pw, iid, "release")
    _wait_calls_done()
    assert (row["state"], row["code"]) == ("acknowledged", "acknowledged"), "release is never gated by the permit"
    assert len(_starts(pw, "release")) == 1


def test_the_live_wrapper_alone_bounds_a_slow_selection_when_no_caller_deadline_exists(world, monkeypatch):
    """DISPATCH_INLINE (no call_with_deadline): the wrapper's own budget is entered before the selection, and a selection that
    consumed it starts nothing. Outcome UNKNOWN `end_to_end_deadline`, nothing admitted, nothing sent."""
    pw = world
    t0 = pw.clock.t

    def slow_selection(command=None):
        pw.join.seen.append((command, budget._END.get()))
        pw.clock.t += 100.0  # the socket / discovery wait used the whole budget
        return True

    monkeypatch.setattr(pw.join, "selected", slow_selection)
    out = pw.live.apply("open", pw.doors[0].station_id, pw.doors[0].relay, "req:st:1", "")
    assert out == dwe.DoorOutcome("unknown", "end_to_end_deadline")
    assert pw.join.seen[0][1] == pytest.approx(t0 + pw.live.transport_timeout_s, abs=1e-6)
    out = pw.live.release("open", pw.doors[0].station_id, pw.doors[0].relay, "req:r:st:1")
    assert out == dwe.DoorOutcome("unknown", "end_to_end_deadline")
    assert _starts(pw) == [] and _intents(pw) == []
    assert pw.live.lock_supported is False
