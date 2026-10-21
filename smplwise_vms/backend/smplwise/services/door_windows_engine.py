"""CR-039 / DOORWIN-295: the typed seam between Arx and the door engine (WisKey) for door windows and emergency controls.

Arx is the authority, the planner and the watchdog; the engine holds and relocks (CR-039 4.1). Everything Arx asks of the engine goes
through the two Protocols below, so the whole feature runs against fakes in tests (tests/fake_doorwin_adapters.py, built on the W0
fakes) and against the simulated `DrillEngine` in drills - and nothing in a test or a drill can reach a station, a door or a reader.

The live classes (`WiskeyProgramEngine`, `WiskeyEmergencyEngine`) refuse every call while the owner's go-live permit is not in the build
(`GO_LIVE_PERMITTED`, the access_grants / capture_lease pattern). Below that guard they answer `not_implemented`: the WisKey execution
coordinators for hold-open programs and the W13 emergency family are NOT_IMPLEMENTED on the WisKey side (owner directive 2026-10-20), and Arx
does not invent their wire shapes. NOTHING here has run against a WisKey (NOT_RUN).

`LIVE_ENGINE_BUILT` (DWFIX-295, review 3 DW-01 / DW-02) says whether those live classes can act at all. It is False while they answer
`not_implemented`, and then - whatever the permit says - the window factory hands out the tier-D `PreparedEngine` (Arx plans, the manager
applies it in the panel) and the emergency switch cannot be turned on (a button that cannot act would be a false sense of safety, T21).
It turns True only together with a real coordinator behind these classes, and not before review 3 DW-03 is closed (door_emergency:
cancel a queued call at the seam deadline, a stale-row guard before each send, a transport timeout <= ENGINE_DEADLINE_S) - not done here.

SR-1 (CR-039 4.1): no method of this seam opens a door from a timer. The window engine knows three schedule operations (`read`, `save`,
`pause`); the emergency engine's `apply("open", ...)` is only ever called by the emergency service for an incident a person confirmed
(or a drill, against the simulation).

Error kinds (`EngineError.kind`): `not_permitted` (the go-live permit is not in the build), `not_implemented` (the WisKey side has no
command yet), `not_sent` (nothing reached the engine - safe to try again later), `unknown` (sent, no clear answer: never repeated blindly,
the next step is a fresh read), `refused` (the engine answered an error before any effect), `revision_conflict` (compare-and-set lost)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

GO_LIVE_PERMITTED = True  # ECCACT-295: owner decision 2026-10-21 (option A); the switch door_windows.enabled stays OFF and no rule exists until an administrator acts
LIVE_ENGINE_BUILT = False  # DWFIX-295: the WisKey program / emergency coordinators answer not_implemented; True only when they exist

ERROR_KINDS = ("not_permitted", "not_implemented", "not_sent", "unknown", "refused", "revision_conflict")
PROGRAM_STATUSES = ("idle", "opening", "held_acknowledged", "restoring", "unknown")
ARX_PREFIX = "Arx "  # the program name prefix by which Arx recognises its own program (CR-039 4.3: WisKey's only free text, max 32)
NAME_MAX = 32


def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def live_engine_built() -> bool:
    return LIVE_ENGINE_BUILT is True


def live_ready() -> bool:
    """The live engines may be used: the owner's permit is in the build AND the engines exist (not `not_implemented`)."""
    return go_live_permitted() and live_engine_built()


class EngineError(Exception):
    def __init__(self, kind: str, code: str = "") -> None:
        super().__init__(kind)
        self.kind = kind if kind in ERROR_KINDS else "refused"
        self.code = (code or "")[:64]


@dataclass(frozen=True)
class ProgramState:
    """One door's hold-open program as the engine reports it (CR-039 3.1). `exists=False` = no program for the door."""

    exists: bool
    revision: int = 0
    enabled: bool = False
    name: str = ""
    status: str = "idle"
    owned: bool = False
    policy: dict[str, Any] | None = field(default=None, compare=False)  # the stored policy (to prove by re-read what was written)

    @property
    def arx(self) -> bool:
        """An Arx-made program (by its name). A program a person made in the intercom panel is never overwritten (CR-039 4.3)."""
        return self.exists and self.name.startswith(ARX_PREFIX)

    @property
    def idle(self) -> bool:
        """The ONLY confirmation of a relock Arx accepts: the engine's own status of an EXISTING program (CR-039 4.4 step 2). A missing
        program is no evidence either way (it may have been removed by hand): never a confirmation."""
        return self.exists and self.status == "idle" and not self.owned


def program_state_of(raw: Any) -> ProgramState:
    """A `technical_program_list` record (R shape: revision, enabled, policy.schedule.name, execution.{owned, status}) -> ProgramState.
    Fail closed: anything unreadable is status `unknown` (never idle)."""
    if not isinstance(raw, dict):
        return ProgramState(False)
    execution = raw.get("execution") if isinstance(raw.get("execution"), dict) else {}
    policy = raw.get("policy") if isinstance(raw.get("policy"), dict) else {}
    schedule = policy.get("schedule") if isinstance(policy.get("schedule"), dict) else {}
    status = execution.get("status") if execution.get("status") in PROGRAM_STATUSES else "unknown"
    revision = raw.get("revision") if isinstance(raw.get("revision"), int) and not isinstance(raw.get("revision"), bool) else 0
    owned = execution.get("owned")
    return ProgramState(True, revision, raw.get("enabled") is True, str(schedule.get("name") or "")[:NAME_MAX], status,
                        owned is not False,  # an unreadable `owned` is owned (fail closed)
                        policy if policy else None)


class WindowEngine(Protocol):
    """Tier B (WisKey's hold-open program per door) or tier D (`prepared`: nothing is written, the manager applies it in the panel)."""

    tier: str  # "program" | "prepared"

    def read(self, station_id: str, relay: int) -> ProgramState: ...

    def save(self, station_id: str, relay: int, revision: int, policy: dict[str, Any], enabled: bool) -> ProgramState: ...

    def pause(self, station_id: str, relay: int, revision: int) -> ProgramState: ...


@dataclass(frozen=True)
class DoorOutcome:
    state: str  # acknowledged | refused | unknown
    code: str = ""


class EmergencyEngine(Protocol):
    """The emergency family (CR-039 8, W13-e). `kind`: lock_secure | open. One call per door (a W13 batch command, when WisKey offers
    one, stays behind this same method)."""

    simulated: bool
    open_supported: bool

    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> DoorOutcome: ...

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> DoorOutcome: ...


# ---------------------------------------------------------------- tier D: prepared (no engine)

class PreparedEngine:
    """Tier D: Arx plans and shows; nothing is written to or read from the engine (the manager applies the program in the intercom
    window). Every call is `not_sent prepared` - the watchdog treats a prepared occurrence as a plan, never as an alarm."""

    tier = "prepared"

    def read(self, station_id: str, relay: int) -> ProgramState:
        raise EngineError("not_sent", "prepared")

    def save(self, station_id: str, relay: int, revision: int, policy: dict[str, Any], enabled: bool) -> ProgramState:
        raise EngineError("not_sent", "prepared")

    def pause(self, station_id: str, relay: int, revision: int) -> ProgramState:
        raise EngineError("not_sent", "prepared")


# ---------------------------------------------------------------- the live engines (refused in this build)

class WiskeyProgramEngine:
    """Tier B over WisKey's `stations/technical_program_list / _save / _action` through the generalized trusted caller (U2). Refused
    while the go-live permit is not in the build; below the guard `not_implemented` (the WisKey coordinator is NOT_IMPLEMENTED, U2 is
    unanswered and the write commands are not in the W2 selection table). NOT_RUN."""

    tier = "program"

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    @staticmethod
    def _guard() -> None:
        if not go_live_permitted():
            raise EngineError("not_permitted", "door_windows_not_permitted")
        raise EngineError("not_implemented", "wiskey_program_coordinator_not_implemented")

    def read(self, station_id: str, relay: int) -> ProgramState:
        self._guard()
        raise AssertionError("unreachable")

    def save(self, station_id: str, relay: int, revision: int, policy: dict[str, Any], enabled: bool) -> ProgramState:
        self._guard()
        raise AssertionError("unreachable")

    def pause(self, station_id: str, relay: int, revision: int) -> ProgramState:
        self._guard()
        raise AssertionError("unreachable")


class WiskeyEmergencyEngine:
    """The W13-e emergency family. Refused while the go-live permit is not in the build; below the guard `not_implemented`. OPEN is not
    supported (no hold-until / emergency_open command exists on the WisKey side, U3): `open_supported` is False. NOT_RUN."""

    simulated = False
    open_supported = False

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    @staticmethod
    def _guard() -> None:
        if not go_live_permitted():
            raise EngineError("not_permitted", "door_emergency_not_permitted")
        raise EngineError("not_implemented", "wiskey_emergency_coordinator_not_implemented")

    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> DoorOutcome:
        self._guard()
        raise AssertionError("unreachable")

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> DoorOutcome:
        self._guard()
        raise AssertionError("unreachable")


# ---------------------------------------------------------------- drills: a simulation inside Arx (CR-039 8.8)

DRILL_OUTCOMES = ("acknowledged", "refused", "unknown")


@dataclass
class DrillEngine:
    """The engine of a drill: answers per door from a script (default: acknowledged), records what it was asked, and imports nothing that
    could reach WisKey, Home Assistant or a station. Every kind is offered so the presser can rehearse OPEN before it exists."""

    script: dict[str, str] = field(default_factory=dict)  # "station:relay" -> outcome
    simulated: bool = True
    open_supported: bool = True
    calls: list[tuple[str, str, str, int]] = field(default_factory=list)

    def _answer(self, phase: str, kind: str, station_id: str, relay: int) -> DoorOutcome:
        self.calls.append((phase, kind, station_id, relay))
        outcome = self.script.get(f"{station_id}:{relay}", "acknowledged")
        return DoorOutcome(outcome if outcome in DRILL_OUTCOMES else "acknowledged", "drill")

    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> DoorOutcome:
        return self._answer("apply", kind, station_id, relay)

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> DoorOutcome:
        return self._answer("release", kind, station_id, relay)


# ---------------------------------------------------------------- factories (tests replace them with fakes)

def _window_engine(settings: Any) -> WindowEngine:
    return WiskeyProgramEngine(settings) if live_ready() else PreparedEngine()  # DW-02: tier D while the live engine is not built


def _emergency_engine(settings: Any) -> EmergencyEngine:
    return WiskeyEmergencyEngine(settings)


WINDOW_ENGINE_FACTORY = _window_engine
EMERGENCY_ENGINE_FACTORY = _emergency_engine


def window_engine(settings: Any) -> WindowEngine:
    return WINDOW_ENGINE_FACTORY(settings)


def emergency_engine(settings: Any) -> EmergencyEngine:
    return EMERGENCY_ENGINE_FACTORY(settings)
