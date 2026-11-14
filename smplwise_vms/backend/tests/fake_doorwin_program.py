"""CR-039 slice W0: a fake WisKey hold-open program engine (tier B, spec 3.1, 4.2-4.4, 9.3; U2, U6, U7).

Models rc.37's `access/hold_programs.py` + `access/hold_open.py` as Arx's static extraction reads them
(docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md, "Module: access/hold_open.py" / "access/hold_programs.py") - R, not
confirmed by WisKey. No WisKey, no Home Assistant, no station: the "ISAPI" sends land on a `FakeDoorBank`.

What it answers (the three commands, same frames as `fake_wiskey.FakeWiskey`):
- `stations/technical_program_list {station_id}` -> `{programs, saved: [], timezone, native_supported: false}`;
- `stations/technical_program_save {station_id, door, revision, policy, enabled}`: compare-and-set on `revision` (0 = new),
  `hold_pause_before_edit` while the existing program is enabled / owned / removing, a fresh record with `revision + 1` and
  `execution` reset to idle; NO immediate tick (the next 15-s tick acts, R);
- `stations/technical_program_action {.., action: pause | remove}`: `enabled: false` (+ `removing`), `revision + 1`, then an
  IMMEDIATE tick of that door (a held door gets `close` now). There is no resume (save-and-activate is the only way back).

The executor (per program, every `tick_s` = 15 s while Home Assistant runs): `owned` and (recovering or the window token
changed or status is not held_acknowledged) -> `restoring`, send `close` (failure: `unknown`, stays owned - so the next tick
tries `close` again); else nothing when there is no window / already owned / the token was already attempted; else
`opening` (intent persisted before the send), send `alwaysOpen` (failure: `unknown`) -> `held_acknowledged`. An unknown open
is followed by a close and is never re-opened in the same window; after an HA restart the first tick closes an owned door and
the window is not re-entered. The window token is `"YYYY-MM-DD/start/end"` in the policy's IANA zone, a date exception
(`holidays[]`) replacing the weekday's periods for its dates.

Switches (attributes; change them at any time):
- `ha_running` (False: no tick runs - an HA outage; commands raise `FakeTransportDown`). `ha_stop()` / `ha_start()` /
  `restart_ha()` (start marks every owned program `recovering`, R);
- `arx_link_up` (False: Arx cannot reach HA - commands raise `FakeTransportDown`, the ticks go on: a network loss between
  Arx and HA);
- `station_link_up[station]` (False: HA cannot reach the station - every send fails, the door keeps its physical state:
  "the door may remain unlocked until communication returns", R);
- `close_refused[door]` (int = that many refusals, True = always: the device refuses `close` -> `unknown`, still held),
  `open_refused[door]`, `close_ack_lost` (set: `close` happens on the device but the answer is lost -> `unknown` while the
  door is in fact back under normal control);
- `status_unavailable` (an error code, e.g. `device_busy` / `station_unloaded`: `technical_program_list` fails - U6/4.4 the
  watchdog cannot read);
- `errors_once[command] = code` (a refusal BEFORE any effect), `lose_answer[command] = "before_effect" | "after_effect"`
  (one-shot: the answer is lost; in the direct form `FakeOutcomeUnknown` is raised with `.effect`, in the attached
  FakeWiskey form no frame is ever sent so the caller times out);
- `u2_trusted_writes` (U2: the generalized trusted caller - `request_id` and `actor` are accepted on save / action and land in
  `wiskey_audit`; without it rc.37's strict schema answers `invalid_format` for any such key) and `dedupe_request_ids`
  (with U2: a repeated `request_id` answers the first answer again and executes nothing; False models a WisKey that does not
  deduplicate - the revision compare-and-set is then the only guard);
- `push_on_status_change` (U6 / W6: a status change pushes a `refresh`; off = Arx must poll);
- `ha_clock_skew_s` (WisKey evaluates windows by HA's clock, R / 4.5), `max_programs` (200, R), `tick_s` (15, R).

Records: `device_log` (every alwaysOpen / close send: a `CommandLog`), `requests` (every Arx command: outcome as the caller saw
it and the real effect), `wiskey_audit` (U2 only: request id, actor, command - never a body), `pushes`.

Error codes: every code is in the pinned catalog's `errors.static.json` except `device_unavailable` (the extraction names it as
WisKey's mapping of Hikvision errors; the catalog does not list it - recorded in docs/changes/CR-039-W0-NOTES.md) and Home
Assistant's own `invalid_format` / `unknown_command`.
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fake_doorwin_clock import DoorwinScheduler, FakeDoorwinClock
from fake_doorwin_door import CommandLog, CommandRecord, DoorKey, FakeDoorBank

PREFIX = "hikvision_intercom/"
LIST, SAVE, ACTION = "stations/technical_program_list", "stations/technical_program_save", "stations/technical_program_action"
PROGRAM_COMMANDS = frozenset({LIST, SAVE, ACTION})
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")  # datetime.weekday() order
STATUSES = ("idle", "opening", "held_acknowledged", "restoring", "unknown")
MAX_PERIODS = 8  # per weekday (R)
MAX_HOLIDAYS = 100  # W?: rc.37's cap on date exceptions is not in the extraction; 100 is the fake's assumption
MAX_NAME = 32  # R
MAX_REQUEST_BYTES = 65536  # the catalog's max_request_bytes for the three commands
REQUEST_KEYS = {
    LIST: {"id", "type", "api_contract", "station_id"},
    SAVE: {"id", "type", "api_contract", "station_id", "door", "revision", "policy", "enabled"},
    ACTION: {"id", "type", "api_contract", "station_id", "door", "revision", "action"},
}
U2_KEYS = frozenset({"request_id", "actor"})
HM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# codes the fake answers strictly BEFORE any effect (the fake's truth; whether WisKey confirms them is U7)
PRE_EFFECT_CODES = frozenset({"invalid_format", "unknown_command", "unauthorized", "request_too_large", "invalid_fields", "invalid_timezone",
                              "schedule_period_limit", "schedule_overlap", "schedule_holiday_limit", "schedule_holiday_overlap", "schedule_invalid_time",
                              "schedule_invalid_date", "revision_conflict", "hold_pause_before_edit", "schedule_limit", "operation_unsupported",
                              "station_unloaded", "record_not_found", "device_busy", "device_unavailable"})


class FakeTransportDown(ConnectionError):
    """Arx could not reach Home Assistant at all (nothing was delivered)."""


class FakeOutcomeUnknown(TimeoutError):
    """The command may or may not have taken effect; the answer never came. `.effect` is the truth (for oracles only)."""

    def __init__(self, command: str, effect: bool) -> None:
        super().__init__(f"{command}: answer lost")
        self.command = command
        self.effect = effect


class FakeEngineError(Exception):
    """A refusal with a WisKey code (direct form)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _ok(msg: dict[str, Any], result: Any) -> dict[str, Any]:
    return {"id": msg.get("id"), "type": "result", "success": True, "result": result}


def _fail(msg: dict[str, Any], code: str) -> dict[str, Any]:
    return {"id": msg.get("id"), "type": "result", "success": False, "error": {"code": code, "message": code}}


# ---------------------------------------------------------------- policy validation and the window (hold_open.py, R)
def _minutes(hm: str) -> int:
    return 24 * 60 if hm == "24:00" else int(hm[:2]) * 60 + int(hm[3:])


def _periods_code(periods: Any) -> str | None:
    if not isinstance(periods, list):
        return "invalid_fields"
    if len(periods) > MAX_PERIODS:
        return "schedule_period_limit"
    spans = []
    for p in periods:
        if not isinstance(p, dict) or set(p) != {"start", "end"}:
            return "invalid_fields"
        start, end = p["start"], p["end"]
        if not (isinstance(start, str) and HM.match(start)) or not (isinstance(end, str) and (HM.match(end) or end == "24:00")):
            return "schedule_invalid_time"
        if _minutes(end) <= _minutes(start):
            return "schedule_invalid_time"  # end > start; no overnight period (two periods instead)
        spans.append((_minutes(start), _minutes(end)))
    spans.sort()
    if any(a[1] > b[0] for a, b in zip(spans, spans[1:])):
        return "schedule_overlap"
    return None


def policy_code(policy: Any) -> str | None:
    """None when the policy is acceptable, else the refusal code (the subset of rc.37's `hold_open.policy` /
    `schedules.normalize` the fake needs; nested shapes are not in the catalog - R)."""
    if not isinstance(policy, dict) or set(policy) != {"timezone", "schedule"}:
        return "invalid_fields"
    zone = policy["timezone"]
    if not isinstance(zone, str) or not zone or len(zone) > 64:
        return "invalid_timezone"
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        return "invalid_timezone"
    sched = policy["schedule"]
    if not isinstance(sched, dict) or set(sched) != {"name", "weekly", "holidays"}:
        return "invalid_fields"
    name = sched["name"]
    if not isinstance(name, str) or not name.strip() or len(name) > MAX_NAME:
        return "invalid_fields"
    weekly = sched["weekly"]
    if not isinstance(weekly, dict) or set(weekly) - set(WEEKDAYS):
        return "invalid_fields"
    for periods in weekly.values():
        code = _periods_code(periods)
        if code:
            return code
    holidays = sched["holidays"]
    if not isinstance(holidays, list):
        return "invalid_fields"
    if len(holidays) > MAX_HOLIDAYS:
        return "schedule_holiday_limit"
    ranges = []
    for h in holidays:
        if not isinstance(h, dict) or set(h) != {"name", "start", "end", "periods"}:
            return "invalid_fields"
        if not all(isinstance(h[k], str) and DATE.match(h[k]) for k in ("start", "end")) or h["end"] < h["start"]:
            return "schedule_invalid_date"
        code = _periods_code(h["periods"])
        if code:
            return code
        ranges.append((h["start"], h["end"]))
    ranges.sort()
    if any(a[1] >= b[0] for a, b in zip(ranges, ranges[1:])):
        return "schedule_holiday_overlap"
    return None


def periods_for(policy: dict[str, Any], local_date: dt.date) -> list[dict[str, str]]:
    """The periods that apply on one local date: a date exception replaces the weekday's periods (R)."""
    iso = local_date.isoformat()
    for h in policy["schedule"]["holidays"]:
        if h["start"] <= iso <= h["end"]:
            return list(h["periods"])
    return list(policy["schedule"]["weekly"].get(WEEKDAYS[local_date.weekday()], []))


def window_token(policy: dict[str, Any], instant: dt.datetime) -> str | None:
    """`hold_open.window`: the token `YYYY-MM-DD/start/end` of the period containing `instant` in the policy's zone
    (string compare `start <= HH:MM < end`), else None."""
    if instant.tzinfo is None:
        raise ValueError("invalid_time")
    local = instant.astimezone(ZoneInfo(policy["timezone"]))
    hm = local.strftime("%H:%M")
    for p in periods_for(policy, local.date()):
        if p["start"] <= hm < (p["end"] if p["end"] != "24:00" else "24:00"):
            return f"{local.date().isoformat()}/{p['start']}/{p['end']}"
    return None


def make_policy(name: str, weekly: dict[str, list[tuple[str, str]]] | None = None, holidays: list[dict[str, Any]] | None = None,
                zone: str = "Asia/Jerusalem") -> dict[str, Any]:
    """A policy in WisKey's shape from `{"Monday": [("08:00", "11:00")]}` (helper for tests)."""
    week = {d: [{"start": s, "end": e} for s, e in (weekly or {}).get(d, [])] for d in WEEKDAYS}
    return {"timezone": zone, "schedule": {"name": name, "weekly": week, "holidays": copy.deepcopy(holidays or [])}}


def date_exception(name: str, start: str, end: str | None = None, periods: list[tuple[str, str]] | None = None) -> dict[str, Any]:
    """A `holidays[]` entry: no periods = the door has no window that day (a skipped holiday, CR-039 5.4)."""
    return {"name": name, "start": start, "end": end or start, "periods": [{"start": s, "end": e} for s, e in (periods or [])]}


def policy_sha(policy: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(policy, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- the store and the executor
@dataclass
class Program:
    station_id: str
    door: int
    api_id: int
    revision: int
    policy: dict[str, Any]
    enabled: bool
    removing: bool = False
    owned: bool = False
    attempted: str | None = None
    status: str = "idle"
    error: str | None = None
    checked_at: str | None = None
    recovering: bool = False  # internal (R: `load` sets recovering = owned)
    foreign: bool = False  # test bookkeeping only: made "in the WisKey panel", not by Arx

    @property
    def key(self) -> DoorKey:
        return (self.station_id, self.door)

    def listing(self) -> dict[str, Any]:
        """The record as `technical_program_list` shows it (the identity is stripped, R)."""
        return {"station_id": self.station_id, "door": self.door, "api_id": self.api_id, "revision": self.revision, "policy": copy.deepcopy(self.policy),
                "enabled": self.enabled, "removing": self.removing, "execution": {"owned": self.owned, "attempted": self.attempted, "status": self.status},
                "error": self.error, "checked_at": self.checked_at}


class _SendFailed(Exception):
    pass


class FakeProgramEngine:
    """The tier-B engine. `stations` maps a station id to its managed relays (physical index = api id in the fake)."""

    def __init__(self, clock: FakeDoorwinClock, scheduler: DoorwinScheduler, bank: FakeDoorBank, stations: dict[str, list[int]],
                 *, zone: str = "Asia/Jerusalem", tick_s: float = 15.0) -> None:
        self.clock = clock
        self.scheduler = scheduler
        self.bank = bank
        self.stations = {sid: list(relays) for sid, relays in stations.items()}
        self.zone = zone
        self.tick_s = tick_s
        self.programs: dict[DoorKey, Program] = {}
        # switches
        self.ha_running = True
        self.arx_link_up = True
        self.station_link_up: dict[str, bool] = {sid: True for sid in self.stations}
        self.close_refused: dict[DoorKey, int | bool] = {}
        self.open_refused: dict[DoorKey, int | bool] = {}
        self.close_ack_lost: set[DoorKey] = set()
        self.status_unavailable: str | None = None
        self.errors_once: dict[str, str] = {}
        self.lose_answer: dict[str, str] = {}
        self.u2_trusted_writes = False
        self.dedupe_request_ids = True
        self.push_on_status_change = False
        self.ha_clock_skew_s = 0.0
        self.max_programs = 200
        # records
        self.device_log = CommandLog()
        self.requests: list[dict[str, Any]] = []
        self.wiskey_audit: list[dict[str, Any]] = []
        self.pushes: list[tuple[str, DoorKey, str]] = []
        self.push_hooks: list[Callable[[], Any]] = []
        self._by_request_id: dict[str, dict[str, Any]] = {}
        self._job = None

    # ------------------------------------------------------------ lifecycle
    def start(self) -> "FakeProgramEngine":
        """Start the 15-s timer (owner "wiskey": an Arx restart never cancels it)."""
        if self._job is None:
            self._job = self.scheduler.every(self.tick_s, self._timer, owner="wiskey", name="wiskey.program_tick")
        return self

    def ha_stop(self) -> None:
        self.ha_running = False

    def ha_start(self) -> None:
        """Home Assistant comes back: WisKey's executors load with `recovering = owned` (R)."""
        self.ha_running = True
        for p in self.programs.values():
            p.recovering = p.owned

    def restart_ha(self) -> None:
        self.ha_stop()
        self.ha_start()

    def ha_now(self) -> dt.datetime:
        return self.clock.now() + dt.timedelta(seconds=self.ha_clock_skew_s)

    # ------------------------------------------------------------ fixtures
    def add_foreign(self, station: str, door: int, name: str = "Lobby hours", weekly: dict[str, list[tuple[str, str]]] | None = None,
                    enabled: bool = True) -> Program:
        """A program a person made in the WisKey panel (not Arx-named): Arx must adopt or leave it, never overwrite (4.3)."""
        prog = Program(station, door, door, 1, make_policy(name, weekly if weekly is not None else {"Monday": [("07:00", "19:00")]}, zone=self.zone),
                       enabled, foreign=True)
        self.programs[prog.key] = prog
        return prog

    def program(self, station: str, door: int) -> dict[str, Any] | None:
        p = self.programs.get((station, door))
        return p.listing() if p else None

    # ------------------------------------------------------------ the timer
    def _timer(self) -> None:
        if self.ha_running:
            self.tick()

    def tick(self) -> None:
        """One 15-s tick over every program (R: concurrently, here in key order - deterministic)."""
        for key in sorted(self.programs):
            self._tick_key(key)

    def _tick_key(self, key: DoorKey) -> None:
        p = self.programs.get(key)
        if p is None:
            return
        desired = window_token(p.policy, self.ha_now()) if p.enabled and not p.removing else None
        try:
            self._worker_tick(p, desired)
        except _SendFailed:
            p.error = "technical_write_unknown"
            return
        if p.removing and not p.owned:
            del self.programs[key]
            return
        p.error = None

    def _worker_tick(self, p: Program, desired: str | None) -> None:
        if p.owned and (p.recovering or desired != p.attempted or p.status != "held_acknowledged"):
            self._persist(p, status="restoring")
            try:
                self._send(p, "close")
            except _SendFailed:
                self._persist(p, status="unknown")
                raise
            p.owned = False
            self._persist(p, status="idle")
            p.recovering = False
            return
        if desired is None or p.owned or desired == p.attempted:
            return
        p.owned, p.attempted = True, desired
        self._persist(p, status="opening")
        try:
            self._send(p, "alwaysOpen")
        except _SendFailed:
            self._persist(p, status="unknown")
            raise
        self._persist(p, status="held_acknowledged")

    def _persist(self, p: Program, status: str) -> None:
        changed = status != p.status
        p.status = status
        p.checked_at = self.clock.now_iso()
        if changed and self.push_on_status_change:
            self.pushes.append((self.clock.now_iso(), p.key, status))
            for hook in self.push_hooks:
                hook()

    def _consume(self, table: dict[DoorKey, int | bool], key: DoorKey) -> bool:
        left = table.get(key)
        if left is True:
            return True
        if isinstance(left, int) and not isinstance(left, bool) and left > 0:
            table[key] = left - 1
            return True
        return False

    def _send(self, p: Program, command: str) -> None:
        """The ISAPI `PUT RemoteControl/door/{api_id}` with `alwaysOpen` / `close`."""
        key, effect, ok = p.key, False, True
        if not self.station_link_up.get(p.station_id, False):
            ok = False
        elif command == "close" and self._consume(self.close_refused, key):
            ok = False
        elif command == "alwaysOpen" and self._consume(self.open_refused, key):
            ok = False
        else:
            effect = True
            if command == "alwaysOpen":
                self.bank.hold(key, "program")
            else:
                self.bank.release(key, "program")
                if key in self.close_ack_lost:
                    ok = False
        self.device_log.append(CommandRecord(self.clock.now_iso(), "wiskey_program", p.station_id, p.door, command, "ok" if ok else "unknown", effect,
                                             key=p.attempted, code=None if ok else "ambiguous_write"))
        if not ok:
            raise _SendFailed(command)

    # ------------------------------------------------------------ the commands (frame form)
    def respond(self, msg: dict[str, Any], *, attached: bool = False) -> list[dict[str, Any]]:
        """Answer one `hikvision_intercom/stations/technical_program_*` frame. Direct form: raises `FakeTransportDown` /
        `FakeOutcomeUnknown`; attached form (`attached=True`): a lost answer is no frame at all."""
        kind = str(msg.get("type") or "")
        command = kind[len(PREFIX):] if kind.startswith(PREFIX) else kind
        if command not in PROGRAM_COMMANDS:
            return [_fail(msg, "unknown_command")]
        if not self.ha_running or not self.arx_link_up:
            self._note(command, msg, "unknown", False, "transport_down")
            raise FakeTransportDown(command)
        # U2: a repeated request id
        rid = msg.get("request_id") if self.u2_trusted_writes else None
        if rid is not None and self.dedupe_request_ids and rid in self._by_request_id:
            stored = self._by_request_id[rid]
            self._note(command, msg, "duplicate", False, None)
            return [{**copy.deepcopy(stored), "id": msg.get("id")}]
        code = self._precheck(command, msg)
        loss = self.lose_answer.pop(command, None)
        if loss == "before_effect":
            self._note(command, msg, "unknown", False, "answer_lost")
            if attached:
                return []
            raise FakeOutcomeUnknown(command, effect=False)
        if code is None:
            frame = self._execute(command, msg)
        else:
            frame = _fail(msg, code)
        effect = bool(frame.get("success")) and command != LIST
        if rid is not None:
            self._by_request_id[rid] = frame
            self.wiskey_audit.append({"at": self.clock.now_iso(), "request_id": rid, "actor": copy.deepcopy(msg.get("actor")), "command": command,
                                      "station_id": msg.get("station_id"), "door": msg.get("door"),
                                      "outcome": "ok" if frame.get("success") else frame["error"]["code"]})
        if loss == "after_effect":
            self._note(command, msg, "unknown", effect, "answer_lost")
            if attached:
                return []
            raise FakeOutcomeUnknown(command, effect=effect)
        self._note(command, msg, "ok" if frame.get("success") else "refused", effect, None if frame.get("success") else frame["error"]["code"])
        return [frame]

    def _note(self, command: str, msg: dict[str, Any], outcome: str, effect: bool, code: str | None) -> None:
        if command == SAVE:
            direction = "open" if msg.get("enabled") is True else "neutral"
            key = policy_sha(msg["policy"]) if isinstance(msg.get("policy"), dict) else None
        elif command == ACTION:
            direction, key = "close", None
        else:
            direction, key = "read", None
        self.requests.append({"at": self.clock.now_iso(), "command": command, "station": msg.get("station_id"), "door": msg.get("door"),
                              "request_id": msg.get("request_id"), "outcome": outcome, "effect": effect, "code": code, "direction": direction, "key": key,
                              "enabled": msg.get("enabled"), "action": msg.get("action")})

    def _precheck(self, command: str, msg: dict[str, Any]) -> str | None:
        allowed = REQUEST_KEYS[command] | (U2_KEYS if self.u2_trusted_writes and command != LIST else frozenset())
        required = REQUEST_KEYS[command] - {"api_contract"}
        if set(msg) - allowed or required - set(msg):
            return "invalid_format"
        if len(json.dumps(msg)) > MAX_REQUEST_BYTES:
            return "request_too_large"
        if not isinstance(msg.get("station_id"), str):
            return "invalid_format"
        if command != LIST:
            if not isinstance(msg.get("door"), int) or not isinstance(msg.get("revision"), int) or isinstance(msg.get("revision"), bool):
                return "invalid_format"
            if self.u2_trusted_writes and ("request_id" in msg or "actor" in msg):
                code = self._u2_code(msg)
                if code:
                    return code
        if command == SAVE and (not isinstance(msg.get("policy"), dict) or not isinstance(msg.get("enabled"), bool)):
            return "invalid_format"
        if command == ACTION and not isinstance(msg.get("action"), str):
            return "invalid_format"
        if command in self.errors_once:
            return self.errors_once.pop(command)
        return None

    @staticmethod
    def _u2_code(msg: dict[str, Any]) -> str | None:
        """W?: the generalized appendix's shapes are Arx's PROPOSAL (open requirements 2.3): a uuid-ish `request_id` and an
        actor `{type: user, user_id}` or `{type: automation, automation_id, item_revision, approving_user}`."""
        rid, actor = msg.get("request_id"), msg.get("actor")
        if not isinstance(rid, str) or not (8 <= len(rid) <= 64):
            return "invalid_fields"
        if not isinstance(actor, dict):
            return "invalid_fields"
        if actor.get("type") == "user" and set(actor) == {"type", "user_id"} and isinstance(actor["user_id"], str) and actor["user_id"]:
            return None
        if actor.get("type") == "automation" and set(actor) == {"type", "automation_id", "item_revision", "approving_user"} and all(
                isinstance(actor[k], str) and actor[k] for k in ("automation_id", "item_revision", "approving_user")):
            return None
        return "invalid_fields"

    def _execute(self, command: str, msg: dict[str, Any]) -> dict[str, Any]:
        station = msg["station_id"]
        if station not in self.stations:
            return _fail(msg, "station_unloaded")
        if command == LIST:
            if self.status_unavailable:
                return _fail(msg, self.status_unavailable)
            return _ok(msg, self._listing(station))
        door = msg["door"]
        if door not in self.stations[station]:
            return _fail(msg, "operation_unsupported")
        key = (station, door)
        existing = self.programs.get(key)
        if command == SAVE:
            code = policy_code(msg["policy"])
            if code:
                return _fail(msg, code)
            if msg["revision"] != (existing.revision if existing else 0):
                return _fail(msg, "revision_conflict")
            if existing and (existing.enabled or existing.owned or existing.removing):
                return _fail(msg, "hold_pause_before_edit")
            if existing is None and len(self.programs) >= self.max_programs:
                return _fail(msg, "schedule_limit")
            if msg["enabled"] and not self.station_link_up.get(station, False):
                return _fail(msg, "device_unavailable")  # the save does device reads when enabled (identity + capabilities), R
            self.programs[key] = Program(station, door, door, (existing.revision if existing else 0) + 1, copy.deepcopy(msg["policy"]), msg["enabled"])
            return _ok(msg, self._listing(station))  # no immediate tick (R)
        # ACTION
        if msg["action"] not in ("pause", "remove"):
            return _fail(msg, "invalid_fields")
        if existing is None:
            return _fail(msg, "record_not_found")
        if msg["revision"] != existing.revision:
            return _fail(msg, "revision_conflict")
        existing.enabled = False
        existing.removing = existing.removing or msg["action"] == "remove"
        existing.revision += 1
        if self.ha_running:
            self._tick_key(key)  # the immediate tick (R): a held door gets `close` now
        return _ok(msg, self._listing(station))

    def _listing(self, station: str) -> dict[str, Any]:
        return {"programs": [p.listing() for k, p in sorted(self.programs.items()) if k[0] == station], "saved": [], "timezone": self.zone,
                "native_supported": False}

    # ------------------------------------------------------------ convenience forms
    def command(self, command: str, **fields: Any) -> dict[str, Any]:
        """Direct form: returns the result body or raises `FakeEngineError(code)` (and the transport exceptions)."""
        frames = self.respond({"id": len(self.requests) + 1, "type": PREFIX + command, **fields})
        frame = frames[0]
        if not frame.get("success"):
            raise FakeEngineError(frame["error"]["code"])
        return frame["result"]

    def as_call(self) -> Callable[..., Any]:
        """The `intercom_client` `Call` form: `await call(kind, **fields)` -> the result frame."""
        counter = iter(range(1, 10**9))

        async def call(kind: str, **fields: Any) -> dict[str, Any]:
            frames = self.respond({"id": next(counter), "type": kind, **fields})
            return frames[0]

        return call

    def attach(self, wiskey: Any) -> "FakeProgramEngine":
        """Serve the three commands through an existing `fake_wiskey.FakeWiskey` (its socket, catalog validation and
        identity checks stay in front): its fixture-backed answer for `technical_program_list` is replaced by this engine,
        and a status change pushes a `refresh` on its sockets when `push_on_status_change` (U6)."""
        original_answer, original_refusal = wiskey._answer, wiskey._refusal

        def _refusal(command: str, msg: dict[str, Any], auth: dict[str, Any]) -> str | None:
            if command in PROGRAM_COMMANDS and self.u2_trusted_writes:
                msg = {k: v for k, v in msg.items() if k not in U2_KEYS}  # the generalized appendix widens the schema (U2)
            return original_refusal(command, msg, auth)

        def _answer(command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
            if command in PROGRAM_COMMANDS:
                return self.respond(msg, attached=True)
            return original_answer(command, msg, auth)

        wiskey._refusal = _refusal
        wiskey._answer = _answer
        self.push_hooks.append(lambda: wiskey.push("refresh"))
        return self
