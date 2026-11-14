"""CR-039 W0 self-tests: the composed world - U1-U7 switches, and the end-to-end scenarios the later slices will run with a
real watchdog in place of the reference loop here. Fakes only."""
from __future__ import annotations

import pytest
from fake_doorwin_asserts import assert_failed_close_reported, assert_no_secrets, assert_no_silent_open, assert_unknown_open_not_retried
from fake_doorwin_clock import at_local
from fake_doorwin_door import confirmation_verdict, relock_verdict
from fake_doorwin_program import LIST, SAVE, FakeEngineError, FakeTransportDown, make_policy
from fake_doorwin_world import DOCK, ENTRY, UNKNOWN_DEFAULTS, DoorwinWorld, classify

ZONE = "Asia/Jerusalem"
D = (ENTRY, 1)
POLICY = make_policy("Arx entrance v1", {"Sunday": [("08:00", "09:00")]})
END = at_local(ZONE, 2026, 11, 1, 9, 0)
GRACE = 120


def test_defaults_are_the_worst_case_answers():
    w = DoorwinWorld()
    assert w.unknowns == UNKNOWN_DEFAULTS
    assert not w.stations_engine.available and not w.programs.u2_trusted_writes and not w.holds.supported
    assert w.emergency.available_kinds() == ["lock_secure"] and not w.emergency.batch_command
    assert all(d.power_behaviour == "unknown" and d.hold_survives_reboot is None for d in w.bank.doors.values())
    assert not w.programs.push_on_status_change and w.pre_effect_codes == frozenset()
    with pytest.raises(ValueError):
        DoorwinWorld(unknowns={"U9": True})


def test_every_switch_maps():
    w = DoorwinWorld(unknowns={"U1": True, "U2": True, "U3": True, "U4": True, "U5": ("fail_secure", False), "U6": True,
                               "U7": {"revision_conflict"}, "W13e": True})
    assert w.stations_engine.available and w.programs.u2_trusted_writes and w.holds.supported and w.emergency.open_supported
    assert w.emergency.lockdown_supported and w.programs.push_on_status_change and w.emergency.batch_command
    assert {d.power_behaviour for d in w.bank.doors.values()} == {"fail_secure"}
    assert w.classify("revision_conflict") == "refused" and w.classify("device_busy") == "unknown" and w.classify(None) == "unknown"


def test_classify_is_unknown_by_default():
    assert classify("revision_conflict", frozenset()) == "unknown"


class ReferenceWatchdog:
    """The smallest watchdog that satisfies 4.4 steps 1-5 on this world (owner "arx", 30-s cadence) - a reference for the
    harness, NOT the product's implementation (that is slice W3)."""

    def __init__(self, w: DoorwinWorld, end, grace_s: float = GRACE) -> None:
        self.w, self.end, self.grace = w, end, grace_s
        self.reads: list = []
        self.reports: list[dict] = []
        w.scheduler.every(30, self.tick, owner="arx", name="arx.watchdog")

    def tick(self) -> None:
        now = self.w.clock.now()
        try:
            listing = self.w.programs.command(LIST, station_id=D[0])
            prog = next((p for p in listing["programs"] if p["door"] == D[1]), None)
            verdict = confirmation_verdict(prog["execution"] if prog else {"owned": False, "status": "idle"}, self.w.bank.observable(D)["lock_state"])
        except (FakeTransportDown, FakeEngineError):
            verdict = "not_visible"
        self.reads.append((now, verdict))
        state = relock_verdict(self.end, now, self.grace, self.reads)
        if not self.reports or self.reports[-1]["state"] != state:
            self.reports.append({"at": now.isoformat(), "door": D, "state": state})

    def state(self) -> str:
        return self.reports[-1]["state"] if self.reports else "planned"


def _scenario(**unknowns):
    w = DoorwinWorld(unknowns=unknowns or None)
    w.programs.command(SAVE, station_id=ENTRY, door=1, revision=0, policy=POLICY, enabled=True)
    return w, ReferenceWatchdog(w, END)


def test_clean_window_is_confirmed():
    w, dog = _scenario()
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 5))
    assert dog.state() == "closed_confirmed" and not w.bank.truth_open(D)
    assert_failed_close_reported(w.programs.device_log, dog.reports, within_s=GRACE + 30)


def test_ha_down_at_end_time_is_loud_and_resolved_by_the_engine():
    w, dog = _scenario()
    w.run_until(at_local(ZONE, 2026, 11, 1, 8, 59))
    w.ha_down()
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 3))
    assert dog.state() == "relock_unconfirmed" and w.bank.truth_open(D)
    assert_no_silent_open(w.bank, {D: dog.state()})
    w.ha_up()
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 5))
    assert dog.state() == "closed_confirmed" and not w.bank.truth_open(D)


def test_network_loss_at_end_time_is_loud():
    w, dog = _scenario()
    w.run_until(at_local(ZONE, 2026, 11, 1, 8, 59, 50))
    w.network_loss(ENTRY)
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 4))
    assert dog.state() == "relock_unconfirmed"
    assert_failed_close_reported(w.programs.device_log, dog.reports, within_s=GRACE + 30)
    assert_unknown_open_not_retried(w.programs.device_log)


def test_a_watchdog_that_trusts_the_entity_alone_would_be_caught():
    """The trap the visibility rules exist for: the optimistic lock entity says `locked` while the door is held."""
    w, dog = _scenario()
    w.run_until(at_local(ZONE, 2026, 11, 1, 8, 59, 50))
    w.programs.close_refused[D] = True
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 4))
    assert w.bank.observable(D)["lock_state"] == "locked" and w.bank.truth_open(D)
    naive = [{"at": END.isoformat(), "door": D, "state": "closed_confirmed"}]
    with pytest.raises(AssertionError):
        assert_failed_close_reported(w.programs.device_log, naive, within_s=GRACE + 30)
    assert_failed_close_reported(w.programs.device_log, dog.reports, within_s=GRACE + 30)


def test_arx_restart_never_stops_the_relock():
    w, dog = _scenario()
    w.run_until(at_local(ZONE, 2026, 11, 1, 8, 30))
    assert w.arx_restart() == 1 and w.scheduler.pending("arx") == []
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 1))
    assert not w.bank.truth_open(D)  # SR-1: the engine relocked with no Arx job alive


def test_scenario_logs_hold_no_secrets():
    w, dog = _scenario(U2=True)
    w.programs.command("stations/technical_program_action", station_id=ENTRY, door=1, revision=1, action="pause", request_id="req-w-0001",
                       actor={"type": "user", "user_id": "u-ops-1"})
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 5))
    assert_no_secrets(list(w.programs.device_log), w.programs.wiskey_audit, dog.reports, w.scheduler.ran)


def test_emergency_secure_over_held_doors_is_reported_per_door():
    w = DoorwinWorld(unknowns={"W13e": True})
    w.emergency.script = {(DOCK, 2): "unknown"}
    run = w.emergency.batch("lock_secure", w.doors(), "req-w-0002")
    w.advance(11)
    assert run.incident_state() == "in_effect_partial" and run.counts()["unknown"] == 1
