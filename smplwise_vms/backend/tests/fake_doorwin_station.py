"""CR-039 slice W0: the station-side engines that do not exist yet - modelled so the product can be built against either answer.

- `FakeStationScheduleEngine` (tier A, U1; spec 4.2): a device-side schedule per door, created / listed / deleted through
  WisKey (so the WRITES need Home Assistant and the Arx link), EXECUTED on the station by the station's own clock (so the
  relock needs neither Home Assistant, nor the network, nor Arx: "guaranteed relock"). Switches: `available` (U1: the
  command family exists at all - False answers `unknown_command`), `supported_doors` (per door on / off: a door the station
  model cannot schedule answers `operation_unsupported`), `ha_running` / `arx_link_up` (writes only), `station_clock_skew_s`
  (per station, T15), `relock_fault` (doors whose device-side relock fails - a hardware fault; default empty, a cross-check
  case for the watchdog), `errors_once`, `lose_answer` (`before_effect` | `after_effect`), `tick_s` (the station's own
  evaluation cadence, default 5 s). Requests are idempotent on `request_id` (W13 shape, W?). The policy shape is tier B's
  (timezone + weekly + date exceptions) - W?: the device-side schedule format is not known; tier B's is the natural one to
  compile once.
- `FakeHoldUntilEngine` (U3 / W13-b; spec 9.3, 8.4): `doors/hold_until {station_id, door, until, request_id}`,
  `doors/hold_release {station_id, door, request_id}`, `doors/hold_status {station_id, door}`. Switches: `supported` (U3),
  `relock_side` (`device`: the relock at `until` happens on the station even with HA down; `wiskey`: it runs in HA and is
  LOST during an HA outage - the door stays held until HA is back, like tier B), `ha_running`, `arx_link_up`,
  `station_link_up`, `errors_once`, `lose_answer`, `status_unavailable`, `release_refused` (count / True). Idempotent on
  `request_id` (a repeat answers the first answer and executes nothing).

Every physical step lands on the shared `FakeDoorBank` and in a `CommandLog` (`device_log`).
"""
from __future__ import annotations

import copy
import datetime as dt
from typing import Any

from fake_doorwin_clock import DoorwinScheduler, FakeDoorwinClock
from fake_doorwin_door import CommandLog, CommandRecord, DoorKey, FakeDoorBank
from fake_doorwin_program import FakeEngineError, FakeOutcomeUnknown, FakeTransportDown, policy_code, window_token


class _Gate:
    """The shared write-side switches of the station engines."""

    def _gate(self, command: str) -> None:
        if not self.available_flag():
            raise FakeEngineError("unknown_command")
        if not self.ha_running or not self.arx_link_up:
            raise FakeTransportDown(command)

    def available_flag(self) -> bool:  # overridden
        return True

    def _loss(self, command: str, effect_fn: Any) -> Any:
        """Apply a one-shot answer loss around an effect: `before_effect` raises without running it, `after_effect` runs it
        and raises; no loss returns the effect's result."""
        loss = self.lose_answer.pop(command, None)
        if loss == "before_effect":
            raise FakeOutcomeUnknown(command, effect=False)
        result = effect_fn()
        if loss == "after_effect":
            raise FakeOutcomeUnknown(command, effect=True)
        return result


class FakeStationScheduleEngine(_Gate):
    def __init__(self, clock: FakeDoorwinClock, scheduler: DoorwinScheduler, bank: FakeDoorBank, *, tick_s: float = 5.0) -> None:
        self.clock = clock
        self.scheduler = scheduler
        self.bank = bank
        self.tick_s = tick_s
        # switches
        self.available = False  # U1
        self.supported_doors: set[DoorKey] = set()
        self.ha_running = True
        self.arx_link_up = True
        self.station_clock_skew_s: dict[str, float] = {}
        self.relock_fault: set[DoorKey] = set()
        self.errors_once: dict[str, str] = {}
        self.lose_answer: dict[str, str] = {}
        # state and records
        self.schedules: dict[DoorKey, dict[str, Any]] = {}
        self._fault_noted: set[DoorKey] = set()
        self._by_request_id: dict[str, Any] = {}
        self._serial = 0
        self.device_log = CommandLog()
        self.requests: list[dict[str, Any]] = []
        self._job = None

    def available_flag(self) -> bool:
        return self.available

    def support(self, *keys: DoorKey) -> "FakeStationScheduleEngine":
        self.supported_doors |= set(keys)
        return self

    def unsupport(self, *keys: DoorKey) -> "FakeStationScheduleEngine":
        self.supported_doors -= set(keys)
        return self

    def start(self) -> "FakeStationScheduleEngine":
        if self._job is None:
            self._job = self.scheduler.every(self.tick_s, self.tick, owner="station", name="station.schedule_tick")
        return self

    def station_now(self, station: str) -> dt.datetime:
        return self.clock.now() + dt.timedelta(seconds=self.station_clock_skew_s.get(station, 0.0))

    # ------------------------------------------------------------ writes (through WisKey: need HA and the Arx link)
    def create(self, station: str, door: int, policy: dict[str, Any], request_id: str) -> dict[str, Any]:
        return self._write("station_schedule_create", station, door, request_id, lambda: self._create(station, door, policy))

    def delete(self, station: str, door: int, request_id: str) -> dict[str, Any]:
        return self._write("station_schedule_delete", station, door, request_id, lambda: self._delete(station, door))

    def list(self, station: str) -> list[dict[str, Any]]:
        self._gate("station_schedule_list")
        return [{"station_id": k[0], "door": k[1], **copy.deepcopy(v)} for k, v in sorted(self.schedules.items()) if k[0] == station]

    def _write(self, command: str, station: str, door: int, request_id: str, effect_fn: Any) -> dict[str, Any]:
        self._gate(command)
        if request_id in self._by_request_id:
            self._note(command, station, door, request_id, "duplicate", False)
            return copy.deepcopy(self._by_request_id[request_id])
        code = self.errors_once.pop(command, None)
        if code is None and (station, door) not in self.supported_doors:
            code = "operation_unsupported"
        if code:
            self._note(command, station, door, request_id, "refused", False, code)
            raise FakeEngineError(code)
        try:
            result = self._loss(command, effect_fn)
        except FakeOutcomeUnknown as exc:
            self._note(command, station, door, request_id, "unknown", exc.effect)
            raise
        except FakeEngineError as exc:
            self._note(command, station, door, request_id, "refused", False, exc.code)
            raise
        self._by_request_id[request_id] = result
        self._note(command, station, door, request_id, "ok", True)
        return copy.deepcopy(result)

    def _create(self, station: str, door: int, policy: dict[str, Any]) -> dict[str, Any]:
        code = policy_code(policy)
        if code:
            raise FakeEngineError(code)
        self._serial += 1
        sched = {"schedule_id": f"st-sched-{self._serial}", "policy": copy.deepcopy(policy)}
        self.schedules[(station, door)] = sched
        return {"schedule_id": sched["schedule_id"]}

    def _delete(self, station: str, door: int) -> dict[str, Any]:
        if (station, door) not in self.schedules:
            raise FakeEngineError("record_not_found")
        del self.schedules[(station, door)]
        self._evaluate((station, door))  # the device returns the door to normal control at once
        return {"deleted": True}

    def _note(self, command: str, station: str, door: int, request_id: str, outcome: str, effect: bool, code: str | None = None) -> None:
        self.requests.append({"at": self.clock.now_iso(), "command": command, "station": station, "door": door, "request_id": request_id,
                              "outcome": outcome, "effect": effect, "code": code})

    # ------------------------------------------------------------ execution (on the station: no HA, no network, no Arx)
    def tick(self) -> None:
        held = {k for k, d in self.bank.doors.items() if "station" in d.holds}
        for key in sorted(set(self.schedules) | held):
            self._evaluate(key)

    def _evaluate(self, key: DoorKey) -> None:
        door = self.bank.door(key)
        if not door.powered:
            return  # re-evaluated by the station after the reboot (its own relay state is what the bank holds)
        held = "station" in door.holds
        sched = self.schedules.get(key)
        token = window_token(sched["policy"], self.station_now(key[0])) if sched else None
        if token and not held:
            self.bank.hold(key, "station")
            self.device_log.append(CommandRecord(self.clock.now_iso(), "station", key[0], key[1], "alwaysOpen", "ok", True, key=token))
        elif not token and held:
            if key in self.relock_fault:
                if key not in self._fault_noted:  # recorded once per fault, not every tick
                    self._fault_noted.add(key)
                    self.device_log.append(CommandRecord(self.clock.now_iso(), "station", key[0], key[1], "close", "unknown", False, code="relock_fault"))
                return
            self._fault_noted.discard(key)
            self.bank.release(key, "station")
            self.device_log.append(CommandRecord(self.clock.now_iso(), "station", key[0], key[1], "close", "ok", True))

    def status(self, station: str, door: int) -> dict[str, Any]:
        """What the station reports (through WisKey) - its own execution view, not a sensor."""
        self._gate("station_schedule_status")
        key = (station, door)
        return {"scheduled": key in self.schedules, "held": "station" in self.bank.door(key).holds}


class FakeHoldUntilEngine(_Gate):
    def __init__(self, clock: FakeDoorwinClock, scheduler: DoorwinScheduler, bank: FakeDoorBank) -> None:
        self.clock = clock
        self.scheduler = scheduler
        self.bank = bank
        # switches
        self.supported = False  # U3
        self.relock_side = "device"  # device | wiskey (W?)
        self.ha_running = True
        self.arx_link_up = True
        self.station_link_up: dict[str, bool] = {}
        self.errors_once: dict[str, str] = {}
        self.lose_answer: dict[str, str] = {}
        self.status_unavailable: str | None = None
        self.release_refused: dict[DoorKey, int | bool] = {}
        # state and records
        self.holds: dict[DoorKey, dict[str, Any]] = {}
        self._by_request_id: dict[str, Any] = {}
        self._overdue: set[DoorKey] = set()
        self.device_log = CommandLog()
        self.requests: list[dict[str, Any]] = []

    def available_flag(self) -> bool:
        return self.supported

    def ha_stop(self) -> None:
        self.ha_running = False

    def ha_start(self) -> None:
        """HA back: a WisKey-side relock that fell due during the outage runs now (W?: assumed, like tier B's recovery)."""
        self.ha_running = True
        for key in sorted(self._overdue):
            self._relock(key, "overdue")
        self._overdue.clear()

    # ------------------------------------------------------------ commands
    def hold_until(self, station: str, door: int, until: dt.datetime, request_id: str) -> dict[str, Any]:
        return self._cmd("hold_until", station, door, request_id, lambda: self._hold(station, door, until, request_id))

    def hold_release(self, station: str, door: int, request_id: str) -> dict[str, Any]:
        return self._cmd("hold_release", station, door, request_id, lambda: self._release(station, door))

    def hold_status(self, station: str, door: int) -> dict[str, Any]:
        self._gate("hold_status")
        if self.status_unavailable:
            raise FakeEngineError(self.status_unavailable)
        h = self.holds.get((station, door))
        return {"held": h is not None, "until": h["until"].isoformat() if h else None, "request_id": h["request_id"] if h else None}

    def _cmd(self, command: str, station: str, door: int, request_id: str, effect_fn: Any) -> dict[str, Any]:
        self._gate(command)
        if request_id in self._by_request_id:
            self._note(command, station, door, request_id, "duplicate", False, None)
            return copy.deepcopy(self._by_request_id[request_id])
        code = self.errors_once.pop(command, None)
        if code is None and not self.station_link_up.get(station, True):
            code = "station_offline"
        if code:
            self._note(command, station, door, request_id, "refused", False, code)
            raise FakeEngineError(code)
        try:
            result = self._loss(command, effect_fn)
        except FakeOutcomeUnknown as exc:
            self._note(command, station, door, request_id, "unknown", exc.effect, "answer_lost")
            raise
        except FakeEngineError as exc:
            self._note(command, station, door, request_id, "refused", False, exc.code)
            raise
        self._by_request_id[request_id] = result
        self._note(command, station, door, request_id, "ok", True, None)
        return copy.deepcopy(result)

    def _note(self, command: str, station: str, door: int, request_id: str, outcome: str, effect: bool, code: str | None) -> None:
        self.requests.append({"at": self.clock.now_iso(), "command": command, "station": station, "door": door, "request_id": request_id,
                              "outcome": outcome, "effect": effect, "code": code})
        if outcome in ("ok", "refused", "unknown"):
            self.device_log.append(CommandRecord(self.clock.now_iso(), "hold_until", station, door, command, outcome, effect, request_id=request_id, key=request_id, code=code))

    def _hold(self, station: str, door: int, until: dt.datetime, request_id: str) -> dict[str, Any]:
        if until <= self.clock.now():
            raise FakeEngineError("invalid_time")
        key = (station, door)
        previous = self.holds.get(key)
        if previous is not None and previous.get("job") is not None:
            self.scheduler.cancel(previous["job"])
        owner = "station" if self.relock_side == "device" else "wiskey"
        job = self.scheduler.call_at(until, lambda: self._due(key), owner=owner, name="hold_until.relock")
        self.holds[key] = {"until": until, "request_id": request_id, "job": job}
        self.bank.hold(key, "hold_until")
        return {"accepted": True, "until": until.isoformat()}

    def _release(self, station: str, door: int) -> dict[str, Any]:
        key = (station, door)
        left = self.release_refused.get(key)
        if left is True or (isinstance(left, int) and not isinstance(left, bool) and left > 0):
            if left is not True:
                self.release_refused[key] = left - 1
            raise FakeEngineError("device_unavailable")
        self._relock(key, "release")
        return {"released": True}

    def _due(self, key: DoorKey) -> None:
        if self.relock_side == "wiskey" and not self.ha_running:
            self._overdue.add(key)  # lost during the outage: the door stays held (worst case, like tier B)
            return
        self._relock(key, "until")

    def _relock(self, key: DoorKey, why: str) -> None:
        h = self.holds.pop(key, None)
        if h is not None and h.get("job") is not None:
            self.scheduler.cancel(h["job"])
        self.bank.release(key, "hold_until")
        if why != "release":
            self.device_log.append(CommandRecord(self.clock.now_iso(), "hold_until", key[0], key[1], "close", "ok", True, key=h["request_id"] if h else None))
