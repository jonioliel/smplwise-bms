"""CR-039 slice W0: the fake door / relay model and the visibility rules (spec sections 3.1, 4.4, 6, 8.7, U5).

The central fact this module encodes: **Arx has no door-position sensor.** A WisKey `lock` entity is optimistic (a timer, not
a sensor; `is_locked` = relay not in `released_relays`, R), so the only things Arx can ever see about a door are
(1) what an engine reports (a program's `execution.status`, a hold's status, an incident's per-door answer) and (2) the
optimistic lock entity state. The physical truth exists here only so tests can check what the product claimed against what
really happened; it is reachable through methods named `truth_*` and never through `observable()`.

- `FakeDoor`: one relay (`DoorKey` = (station config_entry_id, physical_index)). Hidden truth: the set of hold sources that
  keep the relay released (`program` - WisKey's alwaysOpen, `station` - a station-side schedule, `hold_until` - a W13 hold,
  `emergency` - a W13 emergency open), a pulse (test_unlock, `open_duration_s`), lockdown (U4), power. Switches per door:
  `power_behaviour` (U5: `fail_secure` | `fail_safe` | `unknown` - unknown is treated as the WORST case, open, SR-6),
  `hold_survives_reboot` (U5: True | False | None - None is the worst case, it survives), `exterior` (CR-039 13).
- `FakeDoorBank`: the doors of a scenario, the truth timeline (every change of `truth_open`), the bank-wide switch
  `lock_entity_reflects_hold` (W?: whether a WisKey program hold marks the relay as released in the lock entity; default
  False - the entity says "locked" while the door is held open, which is exactly why the entity is only a NEGATIVE signal).
- `confirmation_verdict(execution, lock_state)`: the 4.4 step-2 confirmation rule as an oracle - `closed_confirmed` only when
  the engine reports idle AND not owned AND the mirrored lock state is not in `door_path.OPEN_STATES`.
- `relock_verdict(...)`: the occurrence-level oracle of 4.4 steps 1-5 (ending / closed_confirmed / relock_unconfirmed,
  feed loss fails loud at `end + grace`). Product slices compare their watchdog to it.
- `CommandRecord` / `CommandLog`: the one shape every fake records a door-affecting command in (engine, door, command,
  direction, outcome as the CALLER saw it, effect as it REALLY happened, request id, scope key) - the input of the helper
  assertions in `fake_doorwin_asserts.py`.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable

from fake_doorwin_clock import FakeDoorwinClock

from smplwise.services.door_path import OPEN_STATES

DoorKey = tuple[str, int]
HOLD_SOURCES = frozenset({"program", "station", "hold_until", "emergency"})
POWER_BEHAVIOURS = frozenset({"fail_secure", "fail_safe", "unknown"})
# command words -> direction. "open": anything that releases or keeps a relay released (incl. a program saved enabled, which
# schedules an open); "close": anything that returns a door to normal control; "neutral": no physical direction.
OPEN_COMMANDS = frozenset({"alwaysOpen", "open", "test_unlock", "hold_until", "emergency_open", "program_save_enabled", "station_schedule_create"})
CLOSE_COMMANDS = frozenset({"close", "pause", "remove", "hold_release", "emergency_secure", "emergency_release_open", "station_schedule_delete", "lockdown"})
OUTCOMES = frozenset({"ok", "refused", "unknown"})
UNCONFIRMED_STATES = frozenset({"relock_unconfirmed"})
CONFIRMED_STATES = frozenset({"closed_confirmed"})


def direction_of(command: str) -> str:
    if command in OPEN_COMMANDS:
        return "open"
    if command in CLOSE_COMMANDS:
        return "close"
    return "neutral"


@dataclass
class CommandRecord:
    at: str  # ISO-8601 UTC
    engine: str  # wiskey_program | station | hold_until | emergency | arx
    station: str
    door: int
    command: str
    outcome: str  # what the CALLER of the engine saw: ok | refused | unknown
    effect: bool  # what REALLY happened to the relay (truth, for oracles only)
    direction: str = ""
    request_id: str | None = None
    key: str | None = None  # the scope the unknown-open rule works in: a window token, an occurrence id, an incident id
    code: str | None = None

    def __post_init__(self) -> None:
        if self.outcome not in OUTCOMES:
            raise ValueError(f"unknown outcome {self.outcome!r}")
        if not self.direction:
            self.direction = direction_of(self.command)

    @property
    def door_key(self) -> DoorKey:
        return (self.station, self.door)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class CommandLog(list):
    """A list of `CommandRecord` with filters."""

    def for_door(self, key: DoorKey) -> list[CommandRecord]:
        return [r for r in self if r.door_key == key]

    def opens(self) -> list[CommandRecord]:
        return [r for r in self if r.direction == "open"]

    def closes(self) -> list[CommandRecord]:
        return [r for r in self if r.direction == "close"]

    def commands(self) -> list[str]:
        return [r.command for r in self]


@dataclass
class FakeDoor:
    key: DoorKey
    name: str = ""
    exterior: bool = False
    open_duration_s: int = 5  # DoorParam openDuration (1..255 s, R)
    power_behaviour: str = "unknown"  # U5
    hold_survives_reboot: bool | None = None  # U5 (None = unknown = worst case)
    # hidden truth
    holds: set[str] = field(default_factory=set)
    pulse_until: dt.datetime | None = None
    lockdown: bool = False
    powered: bool = True
    # what the lock entity mirror would say (optimistic)
    entity_pulse_until: dt.datetime | None = None

    def __post_init__(self) -> None:
        if self.power_behaviour not in POWER_BEHAVIOURS:
            raise ValueError(f"power_behaviour must be one of {sorted(POWER_BEHAVIOURS)}")


class FakeDoorBank:
    """The doors of a scenario and their hidden truth."""

    def __init__(self, clock: FakeDoorwinClock, doors: Iterable[DoorKey | FakeDoor] = ()) -> None:
        self.clock = clock
        self.doors: dict[DoorKey, FakeDoor] = {}
        self.lock_entity_reflects_hold = False  # W? (see the module docstring)
        self.timeline: list[tuple[str, DoorKey, bool, str]] = []  # (at, door, truth_open, why)
        for d in doors:
            self.add(d)

    # ------------------------------------------------------------ setup
    def add(self, door: DoorKey | FakeDoor, **kw: Any) -> FakeDoor:
        obj = door if isinstance(door, FakeDoor) else FakeDoor(key=door, **kw)
        self.doors[obj.key] = obj
        return obj

    def door(self, key: DoorKey) -> FakeDoor:
        if key not in self.doors:
            raise KeyError(f"no fake door {key!r}")
        return self.doors[key]

    def station_doors(self, station: str) -> list[DoorKey]:
        return [k for k in self.doors if k[0] == station]

    # ------------------------------------------------------------ physical effects (called by the engines only)
    def _record(self, key: DoorKey, before: bool, why: str) -> None:
        after = self.truth_open(key)
        if after != before:
            self.timeline.append((self.clock.now_iso(), key, after, why))

    def hold(self, key: DoorKey, source: str) -> None:
        if source not in HOLD_SOURCES:
            raise ValueError(f"unknown hold source {source!r}")
        d, before = self.door(key), self.truth_open(key)
        if d.powered:
            d.holds.add(source)
        self._record(key, before, f"hold:{source}")

    def release(self, key: DoorKey, source: str) -> None:
        d, before = self.door(key), self.truth_open(key)
        if d.powered:
            d.holds.discard(source)
        self._record(key, before, f"release:{source}")

    def release_all(self, key: DoorKey, why: str = "release_all") -> None:
        d, before = self.door(key), self.truth_open(key)
        if d.powered:
            d.holds.clear()
        self._record(key, before, why)

    def pulse(self, key: DoorKey) -> None:
        """A `test_unlock`: the relay is released for `open_duration_s`; it never holds."""
        d, before = self.door(key), self.truth_open(key)
        if d.powered and not d.lockdown:
            until = self.clock.now() + dt.timedelta(seconds=d.open_duration_s)
            d.pulse_until = until
            d.entity_pulse_until = until
        self._record(key, before, "pulse")

    def set_lockdown(self, key: DoorKey, on: bool) -> None:
        d, before = self.door(key), self.truth_open(key)
        d.lockdown = on
        self._record(key, before, "lockdown" if on else "lockdown_release")

    def power_loss(self, *keys: DoorKey) -> None:
        for key in keys:
            d, before = self.door(key), self.truth_open(key)
            d.powered = False
            self._record(key, before, "power_loss")

    def power_restore(self, *keys: DoorKey) -> None:
        """Power returns: a hold survives the reboot only if `hold_survives_reboot` is not False (None = unknown = worst case)."""
        for key in keys:
            d, before = self.door(key), self.truth_open(key)
            d.powered = True
            if d.hold_survives_reboot is False:
                d.holds.clear()
            d.pulse_until = None
            self._record(key, before, "power_restore")

    # ------------------------------------------------------------ truth (tests only)
    def truth_open(self, key: DoorKey) -> bool:
        """Is the relay physically released right now? Hidden from the product; for oracles and assertions."""
        d = self.door(key)
        if not d.powered:
            return d.power_behaviour != "fail_secure"  # fail_safe and unknown (worst case) are open
        if d.holds:
            return True
        return d.pulse_until is not None and self.clock.now() < d.pulse_until

    def truth_open_doors(self) -> list[DoorKey]:
        return [k for k in self.doors if self.truth_open(k)]

    # ------------------------------------------------------------ what Arx can see
    def lock_entity_state(self, key: DoorKey) -> str:
        """The optimistic WisKey lock entity state Arx mirrors: `unlocked` during a pulse's timer (and during a program
        hold only when `lock_entity_reflects_hold`), else `locked`. Never a measurement."""
        d = self.door(key)
        if d.entity_pulse_until is not None and self.clock.now() < d.entity_pulse_until:
            return "unlocked"
        if self.lock_entity_reflects_hold and "program" in d.holds:
            return "unlocked"
        return "locked"

    def observable(self, key: DoorKey) -> dict[str, Any]:
        """Everything Arx may know about the door itself: the mirrored lock state and the fact that there is no sensor.
        Engine status comes from the engines, never from here."""
        return {"lock_state": self.lock_entity_state(key), "position_sensor": False}


# ---------------------------------------------------------------- oracles (CR-039 4.4)
def confirmation_verdict(execution: dict[str, Any] | None, lock_state: str | None) -> str:
    """4.4 step 2 for one read. `execution` is a program's `{owned, status}` (or a hold's status mapped to the same words),
    None when the read failed. Returns `closed_confirmed` | `held` | `pending` | `unknown` | `not_visible`."""
    if execution is None:
        return "not_visible"
    status, owned = execution.get("status"), bool(execution.get("owned"))
    if status == "idle" and not owned:
        # the lock entity is optimistic: it can only veto (a NEGATIVE signal), never confirm on its own
        return "unknown" if lock_state in OPEN_STATES else "closed_confirmed"
    if status == "held_acknowledged":
        return "held"
    if status in ("opening", "restoring"):
        return "pending"
    return "unknown"


def relock_verdict(end_at: dt.datetime, now: dt.datetime, grace_s: float, reads: Iterable[tuple[dt.datetime, str]]) -> str:
    """4.4 steps 1-5 for one occurrence. `reads` are `(instant, confirmation_verdict)` pairs the watchdog made (a read
    during feed loss is `not_visible`). Returns `active` (before end), `closed_confirmed` (a read at or after `end`
    confirmed - inside grace, or later as the engine's own resolution of an unconfirmed occurrence), `ending` (inside grace,
    nothing confirmed yet), `relock_unconfirmed` (grace passed without a confirmation; feed loss fails loud the same way)."""
    if now < end_at:
        return "active"
    if any(t >= end_at and t <= now and v == "closed_confirmed" for t, v in reads):
        return "closed_confirmed"
    if now < end_at + dt.timedelta(seconds=grace_s):
        return "ending"
    return "relock_unconfirmed"
