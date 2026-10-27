"""CR-039 / DOORWIN-295: the typed seam between Arx and the door engine (WisKey) for door windows and emergency controls.

Arx is the authority, the planner and the watchdog; the engine holds and relocks (CR-039 4.1). Everything Arx asks of the engine goes
through the two Protocols below, so the whole feature runs against fakes in tests (tests/fake_doorwin_adapters.py, built on the W0
fakes) and against the simulated `DrillEngine` in drills - and nothing in a test or a drill can reach a station, a door or a reader.

The live classes (`WiskeyProgramEngine`, `WiskeyEmergencyEngine`) refuse every call while the owner's go-live permit is not in the build
(`GO_LIVE_PERMITTED`, the access_grants / capture_lease pattern) - except an emergency RELEASE, which never needs the permit (review 3
DW-05: an incident must always be endable, E-01). Below that guard they answer `not_implemented`: the WisKey execution
coordinators for hold-open programs and the W13 emergency family are NOT_IMPLEMENTED on the WisKey side (owner directive 2026-10-20), and Arx
does not invent their wire shapes. NOTHING here has run against a WisKey (NOT_RUN).

`LIVE_ENGINE_BUILT` (DWFIX-295, review 3 DW-01 / DW-02) says whether those live classes can act at all. It is False while they answer
`not_implemented`, and then - whatever the permit says - the window factory hands out the tier-D `PreparedEngine` (Arx plans, the manager
applies it in the panel) and the emergency switch cannot be turned on (a button that cannot act would be a false sense of safety, T21).
It turns True only together with a real coordinator behind these classes. Review 3 DW-03 is closed at the seam (F3A-295, door_emergency:
a per-dispatch executor whose not-started calls are cancelled at the deadline, a stale-row claim right before each send, and the hard per-call
deadline `call_with_deadline`); the live transport must still honour `WiskeyEmergencyEngine.transport_timeout_s` (<= ENGINE_DEADLINE_S) itself.

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
# DWFIX-295: False keeps the window factory on the tier-D PreparedEngine and the emergency switch off. WISKEY-OWNER26-297: the program engine
# is now wired to the Native hold-open programs (WiskeyProgramEngine below), but turning this True is an activation decision of the owner.
LIVE_ENGINE_BUILT = False

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
    """Tier B over WisKey's Native `stations/technical_program_list / _save / _action`. Refused while the go-live permit is not in the
    build. WISKEY-OWNER26-297 (W-023): below the guard the calls go to the Native hold-open programs of WisKey CODE e732562e over the
    selected direct connection (services/wiskey_program_direct.py); without a selected connection nothing is sent (`not_sent`).
    The factory still hands out this engine only when `live_ready()` (LIVE_ENGINE_BUILT stays False: activation is the owner's)."""

    tier = "program"

    def __init__(self, settings: Any, native: Any = None) -> None:
        self.settings = settings
        self._native = native

    def _guard(self) -> Any:
        if not go_live_permitted():
            raise EngineError("not_permitted", "door_windows_not_permitted")
        if self._native is None:
            from .wiskey_program_direct import DirectProgramEngine

            self._native = DirectProgramEngine()
        return self._native

    def read(self, station_id: str, relay: int) -> ProgramState:
        return self._guard().read(station_id, relay)

    def save(self, station_id: str, relay: int, revision: int, policy: dict[str, Any], enabled: bool) -> ProgramState:
        return self._guard().save(station_id, relay, revision, policy, enabled)

    def pause(self, station_id: str, relay: int, revision: int) -> ProgramState:
        return self._guard().pause(station_id, relay, revision)


class WiskeyEmergencyEngine:
    """The W13-e emergency family. Refused while the go-live permit is not in the build; below the guard `not_implemented`. OPEN is not
    supported (no hold-until / emergency_open command exists on the WisKey side, U3): `open_supported` is False. NOT_RUN."""

    simulated = False
    open_supported = False
    # DW-03 (review 3): the W13-e transport's own per-call timeout. It must end a call BEFORE door_emergency.ENGINE_DEADLINE_S (8 s), so a
    # thread of the hard per-call deadline (door_emergency.call_with_deadline) never outlives it for long. No transport exists yet.
    transport_timeout_s = 6.0

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    @staticmethod
    def _guard(phase: str) -> None:
        # DW-05 (review 3, review 2 E-01): a RELEASE never needs the permit - a build whose permit is False must still be able to end an
        # incident a build with the permit started. Only the release command itself has to exist.
        if phase != "release" and not go_live_permitted():
            raise EngineError("not_permitted", "door_emergency_not_permitted")
        raise EngineError("not_implemented", "wiskey_emergency_coordinator_not_implemented")

    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> DoorOutcome:
        self._guard("apply")
        raise AssertionError("unreachable")

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> DoorOutcome:
        self._guard("release")
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
