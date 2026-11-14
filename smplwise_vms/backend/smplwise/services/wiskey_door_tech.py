"""WISKEY-DOOR-TECH-2390 (WisKey full integration plan of 2026-11-03, task T6; capability matrix rows 42-46; owner decision Q5 = a of
2026-11-03: door technical writes from Arx, for system administrators only, each with a confirmation and an audit row): a door's
hold-open schedule (view / add / edit / delete), the station's public door codes (set / clear; the value is never shown, stored or
logged by Arx) and the door's hold-open program (view / apply / pause / remove), from the stations drawer.

The five WisKey commands, checked against WisKey `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` (manifest 2.0.1-rc.10;
`websocket.py` COMMANDS, `technical_api.dispatch_technical`, `access/hold_open.py`, `access/hold_programs.py`,
`client/public_codes.py`) and the pinned catalog rc37-contract.4 (same top-level keys; every one non-READ, station-scoped,
`stations: manage`):

| kind             | WisKey command                      | frame (besides `station_id`, `api_contract`)                                   | WisKey's effect                                                                 |
|------------------|-------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| `hold_save`      | `stations/technical_hold_save`      | `door` (physical relay), `revision` (0 = new), `policy {timezone, schedule}`   | the door's hold-open DRAFT in WisKey's storage (compare-and-swap); no device write; answer `{draft, active: false, blocker}` |
| `hold_delete`    | `stations/technical_hold_delete`    | `door`, `revision`                                                             | the draft removed (revision must match); `{deleted: true}`                       |
| `code_write`     | `stations/technical_codes_write`    | `slot` 1-16, `action` add / replace / remove, `door` (WisKey's API relay id), `expected` (the slot's configured state now), `old_pin`, `new_pin`, `compatibility`, `confirmed: true` | ISAPI `PrivilegePasswordCfg` / `DeletePrivilegePasswordList` on the device, then a presence read-back; `{status, capabilities, acknowledged, physical_verified: false}` |
| `program_save`   | `stations/technical_program_save`   | `door`, `revision`, `policy`, `enabled`                                        | the door's program saved (only while paused); `enabled` = WisKey holds the door open in the schedule's windows by itself; then the door's draft is removed |
| `program_action` | `stations/technical_program_action` | `door`, `revision`, `action` pause / remove                                    | the program disabled (and removed); WisKey asks the door back to normal control  |

`resume` is not a WisKey action (rc.10 `HoldPrograms.action`: pause / remove only): resuming is `program_save` with `enabled: true`.

The path: the add-on's own live WisKey session (intercom_sync), on the closed `door_technical` channel (services/wiskey_channels.py -
exactly these five commands), sent ONCE, never queued, never retried. The code write needs WisKey's API relay id, which Arx's served
copy does not keep (intercom_sync drops `api_id`): `send_code` reads it with one `overview` frame on the same channel, in the same
coroutine, right before the write; when that read fails or names no such relay the write is NOT sent (`NotSent`: outcome `not_sent`).
WisKey itself refuses a relay it does not manage (`unmanaged_lock`).

What a WisKey answer means (`result_of`): `success: true` -> done as WisKey reports it; `success: false` with a code WisKey raises before
any storage or device write (`PRE_EFFECT`, read in the rc.10 source) -> `refused` with that reason; `program_saved_draft_cleanup_unknown`
(the program WAS saved, the draft's removal failed) -> `partial`; anything else, or no answer -> `unknown` (it may have happened).
`station_unloaded` is NOT pre-effect: rc.10 raises it again AFTER the work when the station reloaded meanwhile.

Permission (owner Q5): `system.configure` (installation) or `access.stations.manage` on the station's chain - both held by system_admin
only by default; an explicit deny of `access.stations.manage` on the station wins over `system.configure`; a wall / kiosk account never.

Everything here is pure (validators, projections, limits); the HTTP side is routers/access_control_door_tech.py. Tests drive it with
tests/fake_wiskey.py (tests/test_wiskey_door_tech.py); nothing contacts a device."""
from __future__ import annotations

import re
import time
from collections import deque
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .. import rbac
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal
from . import intercom_adapter as ad
from . import intercom_authority as ia
from . import intercom_client
from . import wiskey_write_limits as wl
from .intercom_client import IntercomError, UnclearAnswer

CHANNEL = "door_technical"  # services/wiskey_channels.py DOOR_TECHNICAL
LANE = "door_tech"  # intercom_sync: no lane of its own -> a read slot and the read buckets; Arx's own limits below on top
SYSTEM_CONFIGURE = "system.configure"
DOOR_ADMIN = ia.STATIONS_MANAGE  # the door-admin permission on the door's scope (the station's chain)


@dataclass(frozen=True)
class Kind:
    name: str
    command: str
    audit: str  # the audit row's action
    needs_online: bool  # refused (not sent) while the served copy says the station is offline
    target: str  # what the limits and the history key on: "door" or "slot"


KINDS: dict[str, Kind] = {
    "hold_save": Kind("hold_save", "stations/technical_hold_save", "intercom.door_hold_save", False, "door"),
    "hold_delete": Kind("hold_delete", "stations/technical_hold_delete", "intercom.door_hold_delete", False, "door"),
    "code_write": Kind("code_write", "stations/technical_codes_write", "intercom.door_code_write", True, "slot"),
    "program_save": Kind("program_save", "stations/technical_program_save", "intercom.door_program_save", True, "door"),
    "program_action": Kind("program_action", "stations/technical_program_action", "intercom.door_program_action", False, "door"),
}
COMMANDS = frozenset(k.command for k in KINDS.values())
AUDIT_ACTIONS = tuple(k.audit for k in KINDS.values())

# ---------------------------------------------------------------- WisKey's codes (rc.10 source, read only)

# raised before any handler work (websocket.py `_command_handler`: permission, schema, api_contract, size, AdminLimiter, the panel
# security guard) and at the top of `dispatch_technical` (the station's busy marker)
COMMON_PRE = intercom_client.PRE_DISPATCH | frozenset({"reauth_required", "screen_locked", "approval_required", "device_busy"})
_SCHEDULE_CODES = frozenset({"invalid_text", "invalid_timezone", "schedule_invalid_week", "schedule_invalid_time", "schedule_period_limit",
                             "schedule_overlap", "schedule_invalid_date", "schedule_holiday_limit", "schedule_holiday_overlap"})
PRE_EFFECT: dict[str, frozenset[str]] = {
    # HoldOpenDrafts.update / remove: the key, the policy and the revision are checked before the storage commit
    "hold_save": COMMON_PRE | _SCHEDULE_CODES | frozenset({"operation_unsupported", "invalid_storage", "revision_conflict", "schedule_limit"}),
    "hold_delete": COMMON_PRE | frozenset({"operation_unsupported", "invalid_storage", "revision_conflict"}),
    # public_codes.mutate: fields, relay, capabilities, slot, expected state - all before the device request
    "code_write": COMMON_PRE | frozenset({"unmanaged_lock", "operation_unsupported", "revision_conflict"}),
    # HoldPrograms.update: retiring station, relay, revision, "pause before edit", limit - before the program is persisted
    "program_save": COMMON_PRE | _SCHEDULE_CODES | frozenset({"station_retiring", "operation_unsupported", "revision_conflict", "hold_pause_before_edit",
                                                              "schedule_limit"}),
    # HoldPrograms.action: the action and the revision, before the program is persisted
    "program_action": COMMON_PRE | frozenset({"revision_conflict"}),
}
PARTIAL = frozenset({"program_saved_draft_cleanup_unknown"})  # technical_api.py: the program save committed, the draft's removal did not


def result_of(frame: dict[str, Any], kind: Kind) -> Any:
    """One door write's answer: success -> the result; a pre-effect code -> IntercomError (refused, WisKey's reason); the partial
    code -> `{"partial": code}` (the caller reports it as such); anything else -> UnclearAnswer (outcome unknown)."""
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code in PARTIAL:
            return {"partial": code}
        if code and code in PRE_EFFECT[kind.name]:
            raise IntercomError(code, kind.command)
        raise UnclearAnswer(kind.command, code if ad.CODE.fullmatch(code or "-") else "action_failed")
    raise UnclearAnswer(kind.command, "invalid_response")


async def send(call: intercom_client.Call, kind: Kind, station_id: str, fields: dict[str, Any]) -> Any:
    """`hikvision_intercom/<command> {station_id, api_contract, **fields}` - the exact key set of the pinned catalog (the router builds
    `fields` with `frame_*`)."""
    frame = await call(intercom_client.command_type(kind.command), station_id=station_id, api_contract=intercom_client.API_CONTRACT, **fields)
    return result_of(frame, kind)


async def send_code(call: intercom_client.Call, kind: Kind, station_id: str, door: int, build: Callable[[int], dict[str, Any]]) -> Any:
    """The code write: `overview` (READ, no fields) -> the door's API relay id -> `technical_codes_write` built by `build(api_id)`. A
    failed read or an unknown relay raises NotSent: the write frame was never written."""
    from .intercom_sync import NotSent

    try:
        raw = await intercom_client.overview(call)
    except Exception:  # noqa: BLE001 - the read failed: nothing of the write left Arx
        raise NotSent("relay_map_unreadable") from None
    relays = project_relays(station_id)(raw)
    if not relays["found"]:
        raise NotSent("station_not_found")
    api = relays["relays"].get(door)
    if api is None:
        raise NotSent("unmanaged_lock")
    return await send(call, kind, station_id, build(api))


def frame_hold_save(door: int, revision: int, policy: dict[str, Any]) -> dict[str, Any]:
    return {"door": door, "revision": revision, "policy": policy}


def frame_hold_delete(door: int, revision: int) -> dict[str, Any]:
    return {"door": door, "revision": revision}


def frame_program_save(door: int, revision: int, policy: dict[str, Any], enabled: bool) -> dict[str, Any]:
    return {"door": door, "revision": revision, "policy": policy, "enabled": enabled}


def frame_program_action(door: int, revision: int, action: str) -> dict[str, Any]:
    return {"door": door, "revision": revision, "action": action}


def frame_code_write(slot: int, action: str, api_door: int, expected: bool, current: str, new: str, compatibility: bool) -> dict[str, Any]:
    """`action` is WisKey's: add / replace / remove. `old_pin` / `new_pin` are always present (WisKey's schema requires both keys; the
    one an action does not use is the empty string, as WisKey's own panel sends it)."""
    return {"slot": slot, "action": action, "door": api_door, "expected": expected, "old_pin": current, "new_pin": new,
            "compatibility": compatibility, "confirmed": True}


# ---------------------------------------------------------------- availability (WisKey's discovery)

def available(api: dict[str, Any] | None, kind: Kind) -> tuple[bool | None, str | None]:
    """(available, reason) of one write from the served copy's `api` facts (intercom_adapter.feature_state's rule): None while there is
    no copy; `api_incompatible`, `commands_unknown` or `not_listed` when this WisKey does not offer it (nothing is then sent)."""
    if api is None:
        return None, None
    min_client = api.get("min_client")
    if isinstance(min_client, int) and min_client > intercom_client.API_CONTRACT:
        return False, "api_incompatible"
    commands = api.get("commands")
    if commands is None:
        return False, "commands_unknown"
    return (True, None) if kind.command in commands else (False, "not_listed")


# ---------------------------------------------------------------- permission (owner Q5)

@dataclass(frozen=True)
class Grant:
    allowed: bool
    reason: str  # system.configure | access.stations.manage | explicit_deny | no_binding | wall_account | ...
    decision: rbac.Decision | None = None


def grant(conn: Any, principal: Principal, station_id: str) -> Grant:
    """May this principal write the doors of this station? `system.configure` at the installation, or `access.stations.manage` on the
    station's chain; an explicit deny of the latter on the station wins over both; a wall / kiosk account never (fail closed)."""
    from . import door_authority  # the wall-account rule lives with the door rule

    try:
        if door_authority.is_wall_account(conn, principal.user_id):
            return Grant(False, "wall_account")
        station = rbac.authorize(conn, principal, DOOR_ADMIN, (ia.STATION_SCOPE, station_id))
        if station.reason == "explicit_deny":
            return Grant(False, "explicit_deny", station)
        system = rbac.authorize(conn, principal, SYSTEM_CONFIGURE, INSTALLATION)
        if system.allowed:
            return Grant(True, SYSTEM_CONFIGURE, system)
        if station.allowed:
            return Grant(True, DOOR_ADMIN, station)
        return Grant(False, station.reason if station.reason != "binding" else "no_binding")
    except Exception:  # noqa: BLE001 - fail closed
        return Grant(False, "error")


def may_somewhere(conn: Any, principal: Principal) -> bool:
    """The route gate (before the body is read): `system.configure` at the installation or `access.stations.manage` anywhere."""
    if rbac.authorize(conn, principal, SYSTEM_CONFIGURE, INSTALLATION).allowed:
        return True
    return ia.Authority(conn, principal).anywhere(DOOR_ADMIN)


# ---------------------------------------------------------------- validators (WisKey's own rules, so a malformed write is never sent)

WEEKDAYS = ad.WEEKDAYS
HHMM = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]")
DAY = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
MAX_PERIODS = 8
MAX_HOLIDAYS = 64
NAME_MAX = 32
ZONE_MAX = 64


def invalid(field: str, code: str, message: str) -> ApiError:
    return ApiError(422, "door_tech_invalid", message, details={"fields": [field], "reason": code})


def _minute(value: Any, field: str, *, end: bool = False) -> int:
    if isinstance(value, str) and HHMM.fullmatch(value):
        h, m = value.split(":")
        return int(h) * 60 + int(m)
    if end and value == "24:00":
        return 1440
    raise invalid(field, "schedule_invalid_time", "שעה חייבת להיות בצורה HH:MM (סיום עד 24:00).")


def _periods(value: Any, field: str) -> list[dict[str, str]]:
    if not isinstance(value, list) or len(value) > MAX_PERIODS:
        raise invalid(field, "schedule_period_limit", f"עד {MAX_PERIODS} טווחי שעות ביום.")
    out = []
    for i, item in enumerate(value):
        if not isinstance(item, dict) or set(item) != {"start", "end"}:
            raise invalid(f"{field}.{i}", "schedule_invalid_time", "טווח שעות חייב לכלול התחלה וסיום בלבד.")
        a, b = _minute(item["start"], f"{field}.{i}.start"), _minute(item["end"], f"{field}.{i}.end", end=True)
        if a >= b:
            raise invalid(f"{field}.{i}", "schedule_invalid_time", "שעת ההתחלה חייבת להיות לפני שעת הסיום.")
        out.append({"start": item["start"], "end": item["end"]})
    out.sort(key=lambda p: p["start"])
    for x, y in zip(out, out[1:]):
        if _minute(x["end"], field, end=True) > _minute(y["start"], field):
            raise invalid(field, "schedule_overlap", "טווחי השעות באותו יום חופפים.")
    return out


def _date(value: Any, field: str) -> date:
    if isinstance(value, str) and DAY.fullmatch(value):
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            parsed = None
        if parsed is not None and 2000 <= parsed.year <= 2037:
            return parsed
    raise invalid(field, "schedule_invalid_date", "תאריך חייב להיות בצורה YYYY-MM-DD (2000-2037).")


def _name(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > NAME_MAX or any(ord(c) < 32 for c in value):
        raise invalid(field, "invalid_text", f"שם חייב להכיל 1-{NAME_MAX} תווים, ללא תווי בקרה.")
    return value.strip()


def policy(value: Any) -> dict[str, Any]:
    """The editor's schedule `{timezone, name, weekly, holidays}` as WisKey's hold-open policy `{timezone, schedule: {name, weekly,
    holidays}}` (rc.10 `hold_open.policy` + `schedules.normalize`): every day present, at most eight non-overlapping periods a day
    ([start, end), end up to 24:00), at most 64 non-overlapping date ranges with their own periods. Raises a 422 ApiError naming the
    field; nothing is sent then."""
    if not isinstance(value, dict) or set(value) != {"timezone", "name", "weekly", "holidays"}:
        raise invalid("policy", "invalid_fields", "מבנה לוח הזמנים אינו תקין.")
    zone = value["timezone"]
    if not isinstance(zone, str) or not zone or len(zone) > ZONE_MAX:
        raise invalid("policy.timezone", "invalid_timezone", "אזור הזמן אינו תקין.")
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise invalid("policy.timezone", "invalid_timezone", "אזור הזמן אינו מוכר.") from None
    weekly = value["weekly"]
    if not isinstance(weekly, dict) or set(weekly) != set(WEEKDAYS):
        raise invalid("policy.weekly", "schedule_invalid_week", "לוח השבוע חייב לכלול את שבעת הימים.")
    week = {day: _periods(weekly[day], f"policy.weekly.{day}") for day in WEEKDAYS}
    holidays = value["holidays"]
    if not isinstance(holidays, list) or len(holidays) > MAX_HOLIDAYS:
        raise invalid("policy.holidays", "schedule_holiday_limit", f"עד {MAX_HOLIDAYS} תאריכים מיוחדים.")
    out = []
    for i, h in enumerate(holidays):
        f = f"policy.holidays.{i}"
        if not isinstance(h, dict) or set(h) != {"name", "start", "end", "periods"}:
            raise invalid(f, "invalid_fields", "תאריך מיוחד חייב לכלול שם, התחלה, סיום וטווחי שעות.")
        start, end = _date(h["start"], f + ".start"), _date(h["end"], f + ".end")
        if start > end:
            raise invalid(f, "schedule_invalid_date", "תאריך ההתחלה חייב להיות לפני תאריך הסיום או שווה לו.")
        out.append({"name": _name(h["name"], f + ".name"), "start": start.isoformat(), "end": end.isoformat(), "periods": _periods(h["periods"], f + ".periods")})
    out.sort(key=lambda x: x["start"])
    for x, y in zip(out, out[1:]):
        if x["end"] >= y["start"]:
            raise invalid("policy.holidays", "schedule_holiday_overlap", "התאריכים המיוחדים חופפים.")
    return {"timezone": zone, "schedule": {"name": _name(value["name"], "policy.name"), "weekly": week, "holidays": out}}


CODE_MIN, CODE_MAX = 4, 16


def code_value(value: Any, field: str) -> str:
    """A public door code as WisKey takes it: ASCII digits, 4-16 (the device's own min / max is checked by WisKey). The value is
    never put in the error, the audit or the log."""
    if isinstance(value, str) and value.isascii() and value.isdecimal() and CODE_MIN <= len(value) <= CODE_MAX:
        return value
    raise invalid(field, "invalid_code", f"קוד חייב להכיל {CODE_MIN}-{CODE_MAX} ספרות.")


def confirm_phrase(slot: int) -> str:
    """The text the operator types to confirm a code write (the typed confirmation of owner Q5)."""
    return f"קוד {slot}"


def wiskey_code_action(action: str, expected: bool) -> str:
    """Arx's set / clear on a slot whose configured state is `expected` -> WisKey's add / replace / remove."""
    if action == "clear":
        return "remove"
    return "replace" if expected else "add"


# ---------------------------------------------------------------- projections (closed construction; never a code value)

def project_hold_save(raw: Any) -> dict[str, Any]:
    return ad.project_hold(raw)


def project_hold_delete(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and raw.get("deleted") is True:
        return {"deleted": True}
    raise ValueError("unexpected technical_hold_delete answer")


def project_programs(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and set(raw) == {"partial"} and raw["partial"] in PARTIAL:
        return {"partial": raw["partial"], "programs": None}
    out = ad.project_programs({**raw, "saved": []} if isinstance(raw, dict) else raw)
    return {"partial": None, "programs": out["programs"]}


def project_code_write(slot: int) -> Callable[[Any], dict[str, Any]]:
    """`technical_codes_write`'s answer reduced to the slot's PRESENCE after the write (WisKey's read-back), WisKey's acknowledgement
    and `physical_verified` (always false in rc.10): never a value - WisKey sends presence booleans only, and only those are read."""

    def project(raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise ValueError("unexpected technical_codes_write answer")
        codes = ad.project_codes(raw)
        configured = next((s["configured"] for s in codes["slots"] if s["slot"] == slot), None)
        return {"slot": slot, "configured": configured, "acknowledged": raw.get("acknowledged") is True,
                "physical_verified": raw.get("physical_verified") is True, "checked_at": codes["checked_at"]}

    return project


def project_relays(station_id: str) -> Callable[[Any], dict[str, Any]]:
    """From an `overview` answer: the station's relays as `{physical_index: api_id}` (only the api id leaves this function, never the
    host or anything else of the overview)."""

    def project(raw: Any) -> dict[str, Any]:
        stations = raw.get("stations") if isinstance(raw, dict) and isinstance(raw.get("stations"), list) else []
        found = next((s for s in stations if isinstance(s, dict) and s.get("id") == station_id), None)
        relays: dict[int, int] = {}
        for lock in (found or {}).get("integrated_locks") or []:
            if isinstance(lock, dict):
                p, a = ad._int(lock.get("physical_index")), ad._int(lock.get("api_id"))
                if p in (1, 2) and a in (1, 2, 3, 4, 5, 6, 7, 8):
                    relays[p] = a
        return {"found": found is not None, "relays": relays}

    return project


# ---------------------------------------------------------------- Arx's own limits

COOLDOWN_S = 3.0  # one write per (station, target) per this long, after a send
USER_WINDOW_S = 60.0
USER_MAX = 20  # door writes per operator per window
CODE_WINDOW_S = 900.0
CODE_USER_MAX = 6  # code writes per operator per 15 minutes (a replace / remove carries the current code: no guessing loop)
CODE_STATION_MAX = 6  # code writes per station per 15 minutes, whoever sends them
MAX_INFLIGHT = 2  # installation-wide; one per station (WisKey itself refuses a second technical command on a station: device_busy)
SCALE = 1.0  # tests shrink the windows


class Limits(wl.WriteLimits):
    """In-process limits on top of the feed's buckets: services/wiskey_write_limits.py with this module's constants, plus the code
    windows (per operator and per station, code writes only) and one in-flight slot per station within the installation-wide cap. A
    refusal is `(code, retry_after_s)`; an admitted write holds the station's in-flight slot until `done`. Cool-downs and the code windows
    count only writes that were handed to WisKey (`sent`). Every window and the cool-down shrink with SCALE; the cool-down is the
    unrounded reading (the last 50 ms refuse with a retry of 0.0)."""

    def __init__(self) -> None:
        super().__init__("door_tech", busy_retry_s=2.0)
        self._inflight: set[str] = set()  # type: ignore[assignment]  # the stations with a write in flight

    def admit(self, user: str, station_id: str, kind: Kind, target: int) -> tuple[str, float] | None:
        now = time.monotonic()
        with self._lock:
            left = self._cooldown_raw_locked((station_id, kind.target, target), COOLDOWN_S * SCALE, now)
            if left > 0:
                return "door_tech_cooldown", round(left, 1)
            if kind.name == "code_write":
                for key, cap in ((("code_user", user), CODE_USER_MAX), (("code_station", station_id), CODE_STATION_MAX)):
                    retry = self._window_full_locked(key, now, CODE_WINDOW_S * SCALE, cap)
                    if retry is not None:
                        return "door_tech_code_rate_limited", retry
            retry = self._window_full_locked(user, now, USER_WINDOW_S * SCALE, USER_MAX)
            if retry is not None:
                return "door_tech_rate_limited", retry
            if station_id in self._inflight or len(self._inflight) >= MAX_INFLIGHT:
                return "door_tech_busy", self.busy_retry_s
            self._users[user].append(now)
            self._inflight.add(station_id)
        return None

    def sent(self, user: str, station_id: str, kind: Kind, target: int) -> None:
        now = time.monotonic()
        with self._lock:
            self._last[(station_id, kind.target, target)] = now
            if kind.name == "code_write":
                self._users.setdefault(("code_user", user), deque()).append(now)
                self._users.setdefault(("code_station", station_id), deque()).append(now)

    def done(self, station_id: str) -> None:  # type: ignore[override]
        with self._lock:
            self._inflight.discard(station_id)


LIMITS = Limits()


def reset() -> None:
    LIMITS.reset()
