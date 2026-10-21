"""CR-039 slice W0: `FakeEmergencyEngine` - the emergency command family (W13-e) and the drill engine (spec 8.2-8.8; U3, U4).

The same class serves two purposes, exactly as 8.8 asks: (1) the model of the W13 emergency commands the product will call
once WisKey offers them, with every unknown switchable; (2) the drill engine a `POST /doors/emergency/drill` binds for one
incident - it answers per door from a scripted table and never reaches WisKey, the bridge or Home Assistant (it has no
transport at all; tests assert that on `fake_wiskey.FakeWiskey.received`).

Kinds: `lock_secure` (end every hold; credentials still work - always available), `lock_lockdown` (credentials refused;
only with `lockdown_supported`, U4), `open` (hold open until released; only with `open_supported`, U3 / W13-b/e). A kind
the engine does not offer answers `unknown_command` - the product must then show the button ABSENT (8.2, 8.4).

Commands (direct Python calls; shapes are Arx's W13 PROPOSAL, W?):
- `batch(kind, doors, request_id, reason)` - one call for many doors with per-door results; only with `batch_command`
  (W13-e answer "yes"); otherwise `unknown_command` and the product loops `one(...)` per door.
- `one(kind, door, request_id)` - one door.
- `release_batch(kind, doors, request_id)` / `release_one(kind, door, request_id)` - the release phase.
Each returns an `EmergencyRun`: per-door `DoorResult`s whose state moves `pending -> sent -> acknowledged | refused | unknown`
on the fake clock, through a lane of `slots` (default 4, the incident lane of 8.7) - so the "first command out < 1 s, all
30 doors within 5 s" budget is measurable.

Switches: `script[door]` / `release_script[door]` (`ok` | `refused` | `unknown` (effect applied, answer lost) | `unknown_lost`
(not applied, answer lost) | `slow` (acknowledged after `slow_s`)), `attempt_script[door]` (a list consumed per attempt -
e.g. `["unknown_lost", "ok"]` for the E-1 retry case), `latency_s` (default 0.2) and `latency[door]`, `slow_s` (8),
`timeout_s` (10: when an unknown answer is declared), `slots`, `batch_command`, `open_supported`, `lockdown_supported`,
`reachable` (False: every door ends `unknown`, nothing applied - 8.7 "no connection to the intercom"), `dedupe_request_ids`
(True: a repeated request id answers the same run and executes nothing).

With a `FakeDoorBank`, an applied door changes the truth: `open` holds the relay (`emergency` source), `lock_secure`
releases every hold, `lock_lockdown` sets lockdown; the release undoes each. Without a bank (a pure drill) nothing moves.
`attempts[door]` counts the executions per door and kind (for the E-1 bound of 3).
"""
from __future__ import annotations

import collections
import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Iterable

from fake_doorwin_clock import DoorwinScheduler, FakeDoorwinClock
from fake_doorwin_door import CommandLog, CommandRecord, DoorKey, FakeDoorBank
from fake_doorwin_program import FakeEngineError

KINDS = ("lock_secure", "lock_lockdown", "open")
SCRIPTED = frozenset({"ok", "refused", "unknown", "unknown_lost", "slow"})
DOOR_STATES = ("pending", "sent", "acknowledged", "refused", "unknown")
SETTLED = frozenset({"acknowledged", "refused", "unknown"})
APPLY_COMMAND = {"lock_secure": "emergency_secure", "lock_lockdown": "lockdown", "open": "emergency_open"}
RELEASE_COMMAND = {"lock_secure": "emergency_release_secure", "lock_lockdown": "lockdown_release", "open": "emergency_release_open"}


@dataclass
class DoorResult:
    door: DoorKey
    state: str = "pending"
    code: str | None = None
    sent_at: dt.datetime | None = None
    settled_at: dt.datetime | None = None
    applied: bool = False  # truth (oracles only)


@dataclass
class EmergencyRun:
    kind: str
    phase: str  # apply | release
    request_id: str
    reason: str | None
    requested_at: dt.datetime
    doors: dict[DoorKey, DoorResult] = field(default_factory=dict)

    def states(self) -> dict[DoorKey, str]:
        return {k: r.state for k, r in self.doors.items()}

    def counts(self) -> dict[str, int]:
        c = collections.Counter(r.state for r in self.doors.values())
        return {s: c.get(s, 0) for s in DOOR_STATES}

    @property
    def settled(self) -> bool:
        return all(r.state in SETTLED for r in self.doors.values())

    def incident_state(self) -> str:
        """8.5: `applying` until every door settled, then `in_effect` (all acknowledged) / `in_effect_partial`; the release
        phase maps to `releasing` / `released` / `released_partial`."""
        if not self.settled:
            return "applying" if self.phase == "apply" else "releasing"
        all_ok = all(r.state == "acknowledged" for r in self.doors.values())
        if self.phase == "apply":
            return "in_effect" if all_ok else "in_effect_partial"
        return "released" if all_ok else "released_partial"

    def first_sent_after_s(self) -> float | None:
        sent = [r.sent_at for r in self.doors.values() if r.sent_at is not None]
        return (min(sent) - self.requested_at).total_seconds() if sent else None

    def all_sent_after_s(self) -> float | None:
        sent = [r.sent_at for r in self.doors.values()]
        if any(s is None for s in sent):
            return None
        return (max(sent) - self.requested_at).total_seconds()


class FakeEmergencyEngine:
    def __init__(self, clock: FakeDoorwinClock, scheduler: DoorwinScheduler, doors: Iterable[DoorKey], bank: FakeDoorBank | None = None) -> None:
        self.clock = clock
        self.scheduler = scheduler
        self.known_doors = list(doors)
        self.bank = bank
        # switches
        self.script: dict[DoorKey, str] = {}
        self.release_script: dict[DoorKey, str] = {}
        self.attempt_script: dict[DoorKey, list[str]] = {}
        self.latency_s = 0.2
        self.latency: dict[DoorKey, float] = {}
        self.slow_s = 8.0
        self.timeout_s = 10.0
        self.slots = 4
        self.batch_command = False  # W13-e
        self.open_supported = False  # U3 / W13
        self.lockdown_supported = False  # U4
        self.reachable = True
        self.dedupe_request_ids = True
        # records
        self.calls: list[dict[str, Any]] = []
        self.runs: dict[str, EmergencyRun] = {}
        self.attempts: collections.Counter = collections.Counter()  # (kind, phase, door) -> executions
        self.device_log = CommandLog()
        self._queue: collections.deque = collections.deque()
        self._busy = 0

    # ------------------------------------------------------------ what is offered
    def available_kinds(self) -> list[str]:
        """The kinds the sheet may show (8.2: an unavailable kind is ABSENT, not disabled)."""
        return [k for k in KINDS if self._offered(k)]

    def _offered(self, kind: str) -> bool:
        return kind == "lock_secure" or (kind == "open" and self.open_supported) or (kind == "lock_lockdown" and self.lockdown_supported)

    def _check(self, kind: str, batch: bool) -> None:
        if kind not in KINDS:
            raise FakeEngineError("invalid_fields")
        if not self._offered(kind) or (batch and not self.batch_command):
            raise FakeEngineError("unknown_command")

    # ------------------------------------------------------------ commands
    def batch(self, kind: str, doors: Iterable[DoorKey], request_id: str, reason: str | None = None) -> EmergencyRun:
        self._check(kind, batch=True)
        return self._start(kind, "apply", list(doors), request_id, reason, "batch")

    def one(self, kind: str, door: DoorKey, request_id: str, reason: str | None = None) -> EmergencyRun:
        self._check(kind, batch=False)
        return self._start(kind, "apply", [door], request_id, reason, "one")

    def release_batch(self, kind: str, doors: Iterable[DoorKey], request_id: str) -> EmergencyRun:
        self._check(kind, batch=True)
        return self._start(kind, "release", list(doors), request_id, None, "batch")

    def release_one(self, kind: str, door: DoorKey, request_id: str) -> EmergencyRun:
        self._check(kind, batch=False)
        return self._start(kind, "release", [door], request_id, None, "one")

    def _start(self, kind: str, phase: str, doors: list[DoorKey], request_id: str, reason: str | None, form: str) -> EmergencyRun:
        self.calls.append({"at": self.clock.now_iso(), "kind": kind, "phase": phase, "form": form, "request_id": request_id, "doors": list(doors)})
        if self.dedupe_request_ids and request_id in self.runs:
            return self.runs[request_id]
        unknown = [d for d in doors if d not in self.known_doors]
        if unknown:
            raise FakeEngineError("invalid_fields")
        run = EmergencyRun(kind, phase, request_id, reason, self.clock.now(), {d: DoorResult(d) for d in doors})
        self.runs[request_id] = run
        for d in doors:
            self._queue.append((run, d))
        self._pump()
        return run

    # ------------------------------------------------------------ the lane
    def _pump(self) -> None:
        while self._busy < self.slots and self._queue:
            run, door = self._queue.popleft()
            self._busy += 1
            self._dispatch(run, door)

    def _outcome(self, run: EmergencyRun, door: DoorKey) -> str:
        queue = self.attempt_script.get(door)
        if queue:
            return queue.pop(0)
        table = self.script if run.phase == "apply" else self.release_script
        outcome = table.get(door, "ok")
        if outcome not in SCRIPTED:
            raise ValueError(f"unknown scripted outcome {outcome!r}")
        return outcome

    def _dispatch(self, run: EmergencyRun, door: DoorKey) -> None:
        res = run.doors[door]
        res.state, res.sent_at = "sent", self.clock.now()
        self.attempts[(run.kind, run.phase, door)] += 1
        outcome = self._outcome(run, door) if self.reachable else "unknown_lost"
        if outcome == "slow":
            delay, final = self.slow_s, "acknowledged"
        elif outcome in ("unknown", "unknown_lost"):
            delay, final = self.timeout_s, "unknown"
        else:
            delay, final = self.latency.get(door, self.latency_s), "acknowledged" if outcome == "ok" else "refused"
        applied = outcome in ("ok", "slow", "unknown")
        if applied:
            self._effect(run, door)
        res.applied = applied

        def settle() -> None:
            res.state, res.settled_at = final, self.clock.now()
            res.code = None if final == "acknowledged" else ("no_connection" if not self.reachable else ("refused" if final == "refused" else "answer_lost"))
            caller = {"acknowledged": "ok", "refused": "refused", "unknown": "unknown"}[final]
            command = APPLY_COMMAND[run.kind] if run.phase == "apply" else RELEASE_COMMAND[run.kind]
            # `at` is the SEND instant (E-1 spacing is about sends); the record is appended when the outcome is known
            self.device_log.append(CommandRecord(res.sent_at.isoformat(), "emergency", door[0], door[1], command, caller, applied, request_id=run.request_id,
                                                 key=run.request_id, code=res.code))
            self._busy -= 1
            self._pump()

        self.scheduler.call_later(delay, settle, owner="wiskey", name="emergency.settle")

    def _effect(self, run: EmergencyRun, door: DoorKey) -> None:
        if self.bank is None:
            return
        if run.phase == "apply":
            if run.kind == "open":
                self.bank.hold(door, "emergency")
            elif run.kind == "lock_secure":
                self.bank.release_all(door, "emergency_secure")
            else:
                self.bank.set_lockdown(door, True)
        else:
            if run.kind == "open":
                self.bank.release(door, "emergency")
            elif run.kind == "lock_lockdown":
                self.bank.set_lockdown(door, False)
            # lock_secure release: nothing physical (Arx re-compiles its programs, 8.2)

    # ------------------------------------------------------------ the drill form (8.8)
    @classmethod
    def for_drill(cls, clock: FakeDoorwinClock, scheduler: DoorwinScheduler, doors: Iterable[DoorKey], script: dict[DoorKey, str] | None = None) -> "FakeEmergencyEngine":
        """A drill engine: every kind offered (the drill rehearses even what WisKey does not offer yet), per-door script,
        no door bank (nothing moves), no transport."""
        eng = cls(clock, scheduler, doors, bank=None)
        eng.open_supported = eng.lockdown_supported = True
        eng.script = dict(script or {})
        return eng
