"""WISKEY-OWNER26-297 (W-023, owner26 Q2 "program"): the original door-window program caller on WisKey's Native hold-open programs.

`door_windows_engine.WiskeyProgramEngine` (tier B of CR-039) asks the engine three things - read, save, pause - for one door. WisKey CODE
e732562e registers exactly these as the Native station commands (`websocket.py` schemas, `technical_api.dispatch_technical`,
`access/hold_programs.HoldPrograms`) and the R5 catalog lists them as direct-dispatchable (`wiskey_r5_catalog.jsonl`):

    read  -> stations/technical_program_list   {station_id}                                  -> {programs: [...], saved, timezone, ...}
    save  -> stations/technical_program_save   {station_id, door, revision, policy, enabled} -> {programs: [...]}
    pause -> stations/technical_program_action {station_id, door, revision, action: "pause"} -> {programs: [...]}

`door` is the physical relay (the lock's physical index), `revision` is the compare-and-set revision of the program (0 = none yet); WisKey
answers `revision_conflict` when it lost. A program record is read with `door_windows_engine.program_state_of` (fail closed: anything
unreadable is status `unknown`, never idle).

The call goes through the SELECTED direct connection only (`DirectJoin.selected(command)`: auto provider, a key that signs, an authenticated
socket and this connection's discovery listing the command). There is no fallback and no retry; an answer that is missing or late is
`unknown` and the next step is a fresh read. The human authority stays where it is: the door-windows routes admit the person
(`access.windows.manage` on the door's station chain) before the engine is called; the wire carries the pairing signature only.

This module turns nothing on. `door_windows_engine.LIVE_ENGINE_BUILT` stays False, so the window factory keeps handing out the tier-D
`PreparedEngine`; an administrator switch and the owner's activation decision are separate."""
from __future__ import annotations

from typing import Any, Callable, Mapping

from . import door_windows_engine as dwe

LIST = "stations/technical_program_list"
SAVE = "stations/technical_program_save"
ACTION = "stations/technical_program_action"
COMMANDS = (LIST, SAVE, ACTION)
TIMEOUT_S = 8.0
CONFLICT_CODES = frozenset({"revision_conflict"})


def _join() -> Any:
    from . import wiskey_direct_join as wdj

    return wdj.JOIN


class DirectProgramPort:
    """The three program commands over the selected direct connection's synchronous port. `join` returns the installed DirectJoin or None."""

    def __init__(self, join: Callable[[], Any] = _join, *, timeout_s: float = TIMEOUT_S) -> None:
        self.join = join
        self.timeout_s = timeout_s

    def call(self, command: str, parameters: Mapping[str, Any]) -> Mapping[str, Any]:
        from .wiskey_capture_port import PortError

        if command not in COMMANDS:
            raise dwe.EngineError("refused", "command_not_admitted")
        try:
            joined = self.join()
        except Exception:  # noqa: BLE001 - an unreadable join is "not selected"
            joined = None
        if joined is None or not joined.selected(command):
            raise dwe.EngineError("not_sent", "transport_not_selected")
        port = joined.capture_port
        try:
            raw = port.call(command, dict(parameters), timeout_s=self.timeout_s)
        except PortError as exc:
            if exc.outcome == "not_sent":
                raise dwe.EngineError("not_sent", exc.code) from None
            if exc.outcome == "refused":
                raise dwe.EngineError("revision_conflict" if exc.code in CONFLICT_CODES else "refused", exc.code) from None
            raise dwe.EngineError("unknown", exc.code) from None
        if not isinstance(raw, Mapping):
            raise dwe.EngineError("unknown", "invalid_response")
        return raw


def _door_of(raw: Mapping[str, Any], relay: int, *, required: bool) -> dwe.ProgramState:
    programs = raw.get("programs")
    if not isinstance(programs, list):
        raise dwe.EngineError("unknown", "invalid_response")
    for p in programs:
        if isinstance(p, dict) and type(p.get("door")) is int and p.get("door") == relay:
            if p.get("removing") is True:
                return dwe.ProgramState(False)
            return dwe.program_state_of(p)
    if required:
        raise dwe.EngineError("unknown", "program_missing_after_write")
    return dwe.ProgramState(False)


def _check(station_id: Any, relay: Any, revision: Any = 0) -> None:
    if (not isinstance(station_id, str) or not 1 <= len(station_id) <= 128 or type(relay) is not int or relay not in (1, 2)
            or type(revision) is not int or revision < 0):
        raise dwe.EngineError("not_sent", "invalid_fields")


class DirectProgramEngine:
    """`door_windows_engine.WindowEngine` (tier B) over the Native hold-open program commands."""

    tier = "program"

    def __init__(self, port: DirectProgramPort | None = None) -> None:
        self.port = port or DirectProgramPort()

    def read(self, station_id: str, relay: int) -> dwe.ProgramState:
        _check(station_id, relay)
        return _door_of(self.port.call(LIST, {"station_id": station_id}), relay, required=False)

    def save(self, station_id: str, relay: int, revision: int, policy: dict[str, Any], enabled: bool) -> dwe.ProgramState:
        _check(station_id, relay, revision)
        if not isinstance(policy, dict) or type(enabled) is not bool:
            raise dwe.EngineError("not_sent", "invalid_fields")
        raw = self.port.call(SAVE, {"station_id": station_id, "door": relay, "revision": revision, "policy": policy, "enabled": enabled})
        return _door_of(raw, relay, required=True)

    def pause(self, station_id: str, relay: int, revision: int) -> dwe.ProgramState:
        _check(station_id, relay, revision)
        raw = self.port.call(ACTION, {"station_id": station_id, "door": relay, "revision": revision, "action": "pause"})
        return _door_of(raw, relay, required=True)
