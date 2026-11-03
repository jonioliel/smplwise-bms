"""CR-AUTODOORS-295: automations that open WisKey doors - the Arx side (docs/changes/CR-AUTODOORS-295.md).

An "open a door" block belongs to one CR-017 automation and lives in Arx only: the door step is never written into the Home
Assistant automation (CR-033 R-17). When Home Assistant reports that the automation ran (`automation_triggered`), Arx decides,
under the block's own constraints, whether to open each door on the block's allow-list, acting as the block's AUTOMATION
OPERATOR - a principal type of its own:

- `Principal(user_id="automation:<block id>", username="automation", source="automation")`: never a human. The one human door
  rule (services/door_authority.py) refuses it (`identity_ok` knows no such source) and it holds no binding, so no human path
  ever opens a door for it, and the automation path never takes a human principal (it builds its operator from the stored row).
- Its own permission class: the block's allow-list, bounded by the person who ARMED it - that person must hold
  `access.doors.automate` on each door's station chain and pass the door rule for that door, at arm time and again at every fire.

Safe by default: a block starts as a draft and does nothing until a person arms it (confirmation, the permission and the door
rule on every door, loop protection); an edit, a change of the automation, an expired arming, the armer losing the right or a
storm disarms it; the kill switch (`doors.automation_kill`) stops every block; a simulation evaluates every gate and sends
nothing. Everything is OFF in this build: `doors.automation_open` cannot be `on` while GO_LIVE_PERMITTED is False. The live sender
is WisKey's Native `door_automations` feature (WISKEY-OWNER26-297, services/wiskey_auto_door.py). Tests install a fake sender (`SENDER`).

Every fire attempt writes the two rows a human opening writes (`intercom.release`: the attempt committed before sending, then
the outcome), with the operator as actor and `details.actor_kind = "automation"`. Never retried, never queued."""
from __future__ import annotations

import datetime as dt
import json
import logging
import queue
import re
import sqlite3
import threading
import time
import uuid
from typing import Any, Callable, Protocol
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..audit import audit
from ..db import Database, get_setting, now_iso, set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, STATION, Decision, Principal, authorize, permissions_anywhere, role_permissions
from ..rbac import _active_bindings as rbac_active_bindings
from . import door_authority, intercom_doors, intercom_sync, trusted_caller

log = logging.getLogger("smplwise.door_automation")

# The owner's SEPARATE go-live permit, enforced in code (the capture-lease / external-grants pattern): while False the feature
# switch cannot be turned on and the live sender refuses. Flipped only by the commit that carries the owner's written permit
# AND a reviewed live sender - never by a setting, an environment variable or a version.
# DOORLIVE-2310 (owner decision 2026-10-30, item 6): door_automation is in scope and the permit is in the regular release. The administrator switch
# `doors.automation_open` stays OFF by default (and `doors.automation_kill` stops every block); the live sender is WisKey's Native `door_automations`
# feature over the SELECTED direct connection only (services/wiskey_auto_door.py): without a selected connection nothing is sent.
GO_LIVE_PERMITTED = True

AUTOMATE = "access.doors.automate"
FLAG_KEY = "doors.automation_open"  # off (default) | on; `doors.*` never travels in a backup (CR-033 section 9)
KILL_KEY = "doors.automation_kill"  # absent / off = running; anything else = every block stopped (fail closed)
OPERATOR_SOURCE = "automation"
OPERATOR_PREFIX = "automation:"
ENTRY_POINT = "door_job"

MAX_DOORS = 16
MAX_WINDOWS = 7
# Owner decision 2026-10-21 (CR-AUTODOORS-295 section 12, item 3): few limits, reasonable use in a public building. Every number is an
# administrator setting (`doors.automation.<name>`, PUT /door-automations/settings); a step may set its own value for the four step
# limits within the same bounds. A value outside the bounds, or garbage, falls back to the default (never "no limit").
DEFAULTS = {"cooldown_s": 10, "max_per_hour": 30, "max_per_day": 300, "arm_days": 180}
BOUNDS = {"cooldown_s": (1, 3600), "max_per_hour": (1, 600), "max_per_day": (1, 10000), "arm_days": (1, 365)}
STORM_DEFAULTS = {"storm_refusals": 5, "storm_window_s": 600}
STORM_BOUNDS = {"storm_refusals": (2, 100), "storm_window_s": (60, 3600)}
# DOORHARD-295 (Fable review A-01, A-03; owner decisions 2026-10-21). All administrator settings within bounds, like the numbers above:
# - door_max_per_hour / door_max_per_day: the per-DOOR cap across EVERY block that names the door (two blocks on one door share it);
# - corroborate_window_s: how close (seconds, either direction) the automation entity's `last_triggered` - and, for state /
#   numeric_state triggers, the watched entity's change - must be to the instant Arx handles the event.
DOOR_DEFAULTS = {"door_max_per_hour": 6, "door_max_per_day": 30, "corroborate_window_s": 10}
DOOR_BOUNDS = {"door_max_per_hour": (1, 600), "door_max_per_day": (1, 10000), "corroborate_window_s": (2, 120)}
ALL_BOUNDS = {**BOUNDS, **STORM_BOUNDS, **DOOR_BOUNDS}
SETTING_PREFIX = "doors.automation."
EXCLUDED_ROLES_KEY = "doors.automation.excluded_roles"  # JSON list: roles whose automation.manage does NOT imply arming
REMOVED_USERS_KEY = "doors.automation.removed_users"  # JSON list: people who may never arm (the per-user removal)
# refusals that count towards the storm disarm: the rate refusals and a trigger that could not be corroborated (A-01)
STORM_REASONS = ("cooldown", "rate_hour", "rate_day", "door_rate_hour", "door_rate_day", "uncorroborated")
SEND_WITHIN_S = 15
SOURCE_MAX = 120
MANUAL_SOURCES = ("trigger action", "manual")
# A-04 (relaxed 2026-10-21, see is_manual): a person's context (`context.user_id`), a source in MANUAL_SOURCES or no source at all is a manual
# run; the trust in an automatic run comes from the corroboration with Home Assistant's state machine (DA-01).
# A-09: the mirror's hook queues the frame; ONE worker handles them in order. A full queue drops the frame and counts it.
QUEUE_MAX = 256
CORROBORATE_WAIT_S = 3.0  # the event can arrive before the automation entity's state frame: re-check this long before refusing
CORROBORATE_POLL_S = 0.2
# DA-02 (Fable review 2): the one worker does not wait for a missing state frame while other events queue behind it - a burst of forged
# events for one armed block would otherwise delay every legitimate event by up to CORROBORATE_WAIT_S each.
CORROBORATE_WAIT_MAX_QUEUED = 1

DISARMING = ("arm_expired", "item_changed", "item_missing", "armer_lost_authority", "storm")
# trigger platforms that can never be caused by a door (no entity): safe for the loop check
ENTITYLESS_TRIGGERS = ("time", "time_pattern", "sun", "homeassistant")
ENTITY_TRIGGERS = ("state", "numeric_state")
_HHMM = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
_ISO = "%Y-%m-%dT%H:%M:%SZ"
_NOT_FROM_A_GRANT = Decision(False, "automation_operator")  # audit rows of the operator never borrow a person's grant


# ---------------------------------------------------------------- seams (tests: fakes only)

class DoorSender(Protocol):
    def open(self, *, operator: Principal, station_id: str, relay: int, request_id: str, not_after: dt.datetime) -> tuple[str, str | None]:
        """Hand one door opening on; answer (outcome, code) with outcome in sent | refused | unknown | not_sent."""


class LiveSender:
    """WISKEY-OWNER26-297 (W-018): the live transport is WisKey's Native `door_automations` feature with the original automation actor
    (services/wiskey_auto_door.py). `db` None (or no selected direct connection) sends nothing (`not_sent`). Reached only when the go-live
    permit is in the build and the administrator switch is on (`_switch_reason`); GO_LIVE_PERMITTED stays False in this build."""

    def __init__(self, db: Database | None = None) -> None:
        from .wiskey_auto_door import NativeDoorSender

        self._native = NativeDoorSender(db)

    def open(self, *, operator: Principal, station_id: str, relay: int, request_id: str, not_after: dt.datetime) -> tuple[str, str | None]:
        return self._native.open(operator=operator, station_id=station_id, relay=relay, request_id=request_id, not_after=not_after)


SENDER: DoorSender | None = None  # None: LiveSender (the Native door_automations feature)
DISPATCH: Callable[[Callable[[], Any]], Any] | None = None  # None: the bounded queue and its one worker (never on the WS loop)
STATS = {"dropped": 0, "handled": 0}  # A-09: frames dropped because the queue was full (shown to the administrator in status)
_QUEUE: queue.Queue[Callable[[], Any]] | None = None
_WORKER: threading.Thread | None = None
_QLOCK = threading.Lock()
_sleep: Callable[[float], None] = time.sleep  # seams for the corroboration wait (tests)
_monotonic: Callable[[], float] = time.monotonic


def _real_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


_now_fn: Callable[[], dt.datetime] = _real_now


def set_clock(fn: Callable[[], dt.datetime] | None) -> None:
    global _now_fn
    _now_fn = fn or _real_now


def now() -> dt.datetime:
    return _now_fn().astimezone(dt.timezone.utc).replace(microsecond=0)


def reset_for_tests() -> None:
    global SENDER, DISPATCH, STATE_READER
    SENDER, DISPATCH, STATE_READER = None, None, None
    STATS["dropped"] = STATS["handled"] = 0
    set_clock(None)


def iso(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).strftime(_ISO)


def _parse(text: str | None) -> dt.datetime | None:
    try:
        return dt.datetime.strptime(text or "", _ISO).replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


# ---------------------------------------------------------------- the operator, switches

def operator_of(block_id: str, name: str) -> Principal:
    """The block's automation operator. Never a human: the source `automation` is refused by the human door rule and the id
    (with its colon) can never be a Home Assistant, local or developer user id."""
    return Principal(user_id=f"{OPERATOR_PREFIX}{block_id}", username="automation", display_name=name, source=OPERATOR_SOURCE)


def is_operator(principal: Any) -> bool:
    return getattr(principal, "source", None) == OPERATOR_SOURCE and str(getattr(principal, "user_id", "")).startswith(OPERATOR_PREFIX)


def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def feature_setting(conn: sqlite3.Connection) -> str:
    return "on" if (get_setting(conn, FLAG_KEY) or "off") == "on" else "off"


def enabled(conn: sqlite3.Connection) -> bool:
    """`on` only when the setting says exactly `on` AND the go-live permit is in the build."""
    return feature_setting(conn) == "on" and go_live_permitted()


def killed(conn: sqlite3.Connection) -> bool:
    """Fail closed: only an absent value or exactly `off` lets blocks run."""
    value = get_setting(conn, KILL_KEY)
    return value not in (None, "off")


# ---------------------------------------------------------------- windows (installation zone)

class ClockUntrusted(Exception):
    pass


def zone_name(conn: sqlite3.Connection) -> str:
    return get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem"


def _minutes(hhmm: str) -> int:
    if hhmm == "24:00":
        return 24 * 60
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def in_window(windows: list[dict[str, Any]], at: dt.datetime, tz: str) -> bool:
    """Whether the UTC instant `at` falls in one of the windows, read in the IANA zone `tz` (Mon = 0; start inclusive, end
    exclusive). An unknown zone raises ClockUntrusted (the caller refuses).

    DST (Fable review A-10, documented behaviour): the window is compared on the LOCAL wall-clock minute of the instant. Spring forward: a
    window that starts inside the skipped hour never matches that day (safe: it refuses, it never opens early). Fall back: the repeated
    local hour occurs twice, so a window that ends inside it stays open for one real hour longer than its wall-clock length (the
    instant is read twice by the same rule). Nothing else is adjusted - no fixed offset is ever applied (AGENTS.md time rule)."""
    try:
        zone = ZoneInfo(tz)  # checked even without a window: an untrusted zone refuses (fail closed)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise ClockUntrusted(tz) from None
    if not windows:
        return True  # no window: any time (owner decision 2026-10-21)
    local = at.astimezone(zone)
    minute = local.hour * 60 + local.minute
    for w in windows:
        if local.weekday() in w["days"] and _minutes(w["start"]) <= minute < _minutes(w["end"]):
            return True
    return False


# ---------------------------------------------------------------- the block (policy)

def _invalid(fields: list[str]) -> ApiError:
    return ApiError(422, "door_automation_invalid", "ההגדרה אינה תקינה: " + ", ".join(fields), details={"fields": fields})


def _int_ok(value: Any, lo: int, hi: int) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and lo <= value <= hi


def limits(conn: sqlite3.Connection) -> dict[str, int]:
    """The installation's limits (administrator settings), each within its bounds; garbage or out of bounds = the default."""
    out: dict[str, int] = {}
    for key, default in {**DEFAULTS, **STORM_DEFAULTS, **DOOR_DEFAULTS}.items():
        lo, hi = ALL_BOUNDS[key]
        try:
            value = int(get_setting(conn, SETTING_PREFIX + key) or default)
        except (TypeError, ValueError):
            value = default
        out[key] = value if lo <= value <= hi else default
    return out


def effective(conn: sqlite3.Connection, policy: dict[str, Any]) -> dict[str, int]:
    """A step's limits: its own value where it sets one, else the installation's."""
    base = limits(conn)
    return {**base, **{k: int(policy[k]) for k in DEFAULTS if policy.get(k) is not None}}


def validate_policy(raw: Any) -> dict[str, Any]:
    """The block's policy, normalised; 422 `door_automation_invalid` naming every bad field. The doors to open are named
    explicitly (1..MAX_DOORS); time windows are optional (none = any time, owner decision 2026-10-21); the four step limits are
    optional (absent = the installation's setting)."""
    if not isinstance(raw, dict):
        raise _invalid(["policy"])
    bad: list[str] = [k for k in raw if k not in ("doors", "windows", *DEFAULTS)]
    doors_raw = raw.get("doors")
    doors: list[dict[str, Any]] = []
    if not isinstance(doors_raw, list) or not 1 <= len(doors_raw) <= MAX_DOORS:
        bad.append("doors")
    else:
        for d in doors_raw:
            sid, relay = (d.get("station_id"), d.get("relay")) if isinstance(d, dict) else (None, None)
            if (not isinstance(sid, str) or not 1 <= len(sid) <= 128 or not re.fullmatch(r"[A-Za-z0-9_-]+", sid) or not isinstance(relay, int)
                    or isinstance(relay, bool) or not 1 <= relay <= 64 or (isinstance(d, dict) and set(d) - {"station_id", "relay"})):
                bad.append("doors")
                break
            doors.append({"station_id": sid, "relay": relay})
        if len({(d["station_id"], d["relay"]) for d in doors}) != len(doors) and "doors" not in bad:
            bad.append("doors")
    windows_raw = raw.get("windows", [])
    windows: list[dict[str, Any]] = []
    if not isinstance(windows_raw, list) or len(windows_raw) > MAX_WINDOWS:
        bad.append("windows")
    else:
        for w in windows_raw:
            ok = isinstance(w, dict) and not set(w) - {"days", "start", "end"}
            days = w.get("days") if ok else None
            start, end = (w.get("start"), w.get("end")) if ok else (None, None)
            ok = (ok and isinstance(days, list) and 1 <= len(days) <= 7 and all(isinstance(x, int) and not isinstance(x, bool) and 0 <= x <= 6 for x in days)
                  and len(set(days)) == len(days) and isinstance(start, str) and bool(_HHMM.fullmatch(start)) and isinstance(end, str)
                  and (end == "24:00" or bool(_HHMM.fullmatch(end))))
            if not ok or _minutes(start) >= _minutes(end):  # type: ignore[arg-type]
                bad.append("windows")
                break
            windows.append({"days": sorted(days), "start": start, "end": end})
    out: dict[str, Any] = {"doors": doors, "windows": windows}
    for k in DEFAULTS:
        if raw.get(k) is not None:
            if _int_ok(raw[k], *BOUNDS[k]):
                out[k] = raw[k]
            else:
                bad.append(k)
    if bad:
        raise _invalid(sorted(set(bad)))
    return out


def door_key(door: dict[str, Any]) -> str:
    return f"{door['station_id']}#{door['relay']}"


def station_of(door: dict[str, Any]) -> dict[str, Any] | None:
    """The door's station from the served WisKey copy when it still has that relay; None otherwise."""
    s = intercom_sync.SYNC.station(door["station_id"])
    if s is None or door["relay"] not in intercom_doors.station_relays(s):
        return None
    return s


def require_doors_known(policy: dict[str, Any]) -> None:
    """Every door on the list exists in the served WisKey copy with that relay (fail closed without a copy)."""
    if not intercom_sync.SYNC.has_copy():
        raise ApiError(503, "intercom_unavailable", "אין כרגע נתונים עדכניים ממערכת האינטרקום.")
    missing = [door_key(d) for d in policy["doors"] if station_of(d) is None]
    if missing:
        raise ApiError(422, "door_automation_door_unknown", "אחת הדלתות אינה קיימת במערכת האינטרקום.", details={"fields": ["doors"], "count": len(missing)})


# ---------------------------------------------------------------- rows

def get(conn: sqlite3.Connection, block_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM door_automations WHERE id = ? AND deleted_at IS NULL", (block_id,)).fetchone()


def by_item(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM door_automations WHERE automation_item_id = ? AND deleted_at IS NULL", (item_id,)).fetchone()


def _item(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT item_id, entity_id, revision, config_json FROM ha_config_items WHERE kind = 'automation' AND item_id = ?", (item_id,)).fetchone()


def _item_cfg(item: sqlite3.Row | None) -> dict[str, Any]:
    try:
        cfg = json.loads(item["config_json"] or "{}") if item is not None else {}
    except ValueError:
        cfg = {}
    return cfg if isinstance(cfg, dict) else {}


def policy_of(row: sqlite3.Row) -> dict[str, Any]:
    return json.loads(row["policy_json"])


def view(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    policy = policy_of(row)
    doors = []
    for d in policy["doors"]:
        s = intercom_sync.SYNC.station(d["station_id"])
        doors.append({**d, "name": (s or {}).get("name") or None})
    cfg = _item_cfg(_item(conn, row["automation_item_id"]))
    return {
        "id": row["id"], "automation_id": row["automation_item_id"], "automation_name": cfg.get("alias") if isinstance(cfg.get("alias"), str) else None,
        "name": row["name"], "state": row["state"], "policy": policy, "policy_revision": row["policy_revision"], "doors": doors,
        "bound_item_revision": row["bound_item_revision"], "operator_id": f"{OPERATOR_PREFIX}{row['id']}", "armed_by": row["armed_by"], "armed_by_name": row["armed_by_name"],
        "armed_at": row["armed_at"], "armed_until": row["armed_until"], "disarm_reason": row["disarm_reason"], "disarmed_at": row["disarmed_at"],
        "created_at": row["created_at"], "updated_at": row["updated_at"], "effective_limits": {k: v for k, v in effective(conn, policy).items() if k in DEFAULTS},
    }


# ---------------------------------------------------------------- authority (people)

def _json_list(conn: sqlite3.Connection, key: str) -> list[str]:
    try:
        value = json.loads(get_setting(conn, key) or "[]")
    except ValueError:
        return []
    return [v for v in value if isinstance(v, str)] if isinstance(value, list) else []


def removed_users(conn: sqlite3.Connection) -> list[str]:
    return _json_list(conn, REMOVED_USERS_KEY)


def excluded_roles(conn: sqlite3.Connection) -> list[str]:
    return _json_list(conn, EXCLUDED_ROLES_KEY)


def manage_reach(conn: sqlite3.Connection, principal: Principal, item_id: str | None = None) -> str | None:
    """Owner answer CR-AUTODOORS-295 12.4 (2026-10-21): `automation.manage` counts at the INSTALLATION and at a FLOOR (or a building /
    site above floors). Returns "installation", "floor" or None. "floor" means the person manages automations only where their floors
    are; with `item_id` that automation must be one they may see and manage - the same visibility rule as the automations screen
    (its entities on their floors). An explicit deny at any scope above a floor removes that floor (rbac deny wins)."""
    if is_operator(principal):
        return None
    if authorize(conn, principal, "automation.manage", INSTALLATION).allowed:
        return "installation"
    if "automation.manage" not in permissions_anywhere(conn, principal):
        return None  # cheap exit for everyone who holds it nowhere (the floor walk below is per floor)
    from . import automation_scope as scope
    from . import automation_view

    ctx = scope.Ctx(conn, principal)
    if not ctx.access.anywhere(scope.MANAGE):
        return None
    if item_id is None:
        return "floor"
    try:
        automation_view.get_item(ctx, "automation", item_id)
    except ApiError:
        return None
    return "floor"


def _implied(conn: sqlite3.Connection, principal: Principal, item_id: str | None = None) -> str | None:
    """Owner decision 2026-10-21 (section 12, item 1): whoever may create automations (`automation.manage`, at the installation or - owner
    answer 12.4 - at a floor, through a role the administrator did not exclude) may arm a door step without holding `access.doors.automate`
    itself. Returns the scope that carries it ("installation" | "floor") or None."""
    reach = manage_reach(conn, principal, item_id)
    if reach is None:
        return None
    excluded = set(excluded_roles(conn))
    for b in rbac_active_bindings(conn, principal):
        if b["effect"] != "allow" or b["role_id"] in excluded or "automation.manage" not in role_permissions(conn, b["role_id"]):
            continue
        at = (b["scope_type"], b["scope_id"])
        if reach == "installation" and at == INSTALLATION:
            return "installation"
        if reach == "floor" and at != INSTALLATION and b["scope_type"] != STATION:
            return "floor"
    return None


def _explicit(conn: sqlite3.Connection, principal: Principal, station_id: str | None) -> bool:
    """Whether `access.doors.automate` itself is granted (not merely implied by automation.manage)."""
    if station_id is not None:
        return authorize(conn, principal, AUTOMATE, (STATION, station_id)).allowed
    return AUTOMATE in permissions_anywhere(conn, principal)


def may_automate(conn: sqlite3.Connection, principal: Principal, station_id: str | None = None, item_id: str | None = None) -> bool:
    """May this person arm (and manage) door steps - for one station's doors, or anywhere (`station_id` None)? Never an operator;
    never a person the administrator removed; an explicit deny of `access.doors.automate` wins; else `access.doors.automate`
    (granted per role or per user) or the implied right of `automation.manage` (installation or floor scope; with `item_id` the
    floor scope must reach that automation)."""
    if is_operator(principal) or principal.user_id in removed_users(conn):
        return False
    if station_id is not None:
        d = authorize(conn, principal, AUTOMATE, (STATION, station_id))
        if d.reason == "explicit_deny":
            return False
        if d.allowed:
            return True
    elif AUTOMATE in permissions_anywhere(conn, principal):
        return True
    if authorize(conn, principal, AUTOMATE, INSTALLATION).reason == "explicit_deny":
        return False
    return _implied(conn, principal, item_id) is not None


def holds_anywhere(conn: sqlite3.Connection, principal: Principal) -> bool:
    return may_automate(conn, principal, None)


def door_name(door: dict[str, Any]) -> str:
    s = intercom_sync.SYNC.station(door["station_id"])
    return (s or {}).get("name") or ""


def armer_reason(conn: sqlite3.Connection, principal: Principal, door: dict[str, Any], dev_mode: bool, item_id: str | None = None) -> str | None:
    """Why this person may NOT put this door in an armed block (None: they may): an identified, active person, holding
    `access.doors.automate` on the door's station chain (deny wins) and passing the one door rule for that door."""
    if is_operator(principal) or not door_authority.identity_ok(principal, dev_mode, conn):
        return "identity"
    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if user is None or not user["active"]:
        return "user_inactive"
    if not may_automate(conn, principal, door["station_id"], item_id):
        return "automate_not_allowed"
    if not door_authority.check(conn, principal, door["station_id"], door["relay"], dev_mode=dev_mode).allowed:
        return "door_not_allowed"
    return None


def _armer(row: sqlite3.Row) -> Principal:
    return Principal(user_id=row["armed_by"] or "", username=row["armed_by_username"] or "", display_name=row["armed_by_name"] or "", source=row["armed_source"] or "")


# ---------------------------------------------------------------- loop protection (static, at arm)

def trigger_entities(cfg: dict[str, Any]) -> tuple[set[str], bool]:
    """The entities the automation's triggers watch, and whether every trigger could be resolved. A trigger without entities
    (time, sun, start) is safe; template, device, event, webhook, MQTT, purpose-specific and templated ids are unresolvable."""
    triggers = cfg.get("triggers", cfg.get("trigger"))
    if isinstance(triggers, dict):
        triggers = [triggers]
    if not isinstance(triggers, list):
        return set(), False
    out: set[str] = set()
    for t in triggers:
        if not isinstance(t, dict):
            return out, False
        kind = t.get("trigger", t.get("platform"))
        if kind in ENTITYLESS_TRIGGERS:
            continue
        if kind not in ENTITY_TRIGGERS:
            return out, False
        ids = t.get("entity_id")
        ids = [ids] if isinstance(ids, str) else ids
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) and re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", i) for i in ids):
            return out, False
        out.update(ids)
    return out, True


def loop_refusal(conn: sqlite3.Connection, cfg: dict[str, Any], policy: dict[str, Any]) -> str | None:
    """`loop_risk` when a trigger watches a door on the list or any entity of the same WisKey station; `triggers_unresolvable`
    when a trigger cannot be resolved to entities (fail closed); None when arming is safe from that side."""
    watched, resolvable = trigger_entities(cfg)
    if not resolvable:
        return "triggers_unresolvable"
    door_entities: set[str] = set()
    stations = {d["station_id"] for d in policy["doors"]}
    for d in policy["doors"]:
        door_entities.update(intercom_doors.entities_for(conn, d["station_id"], d["relay"]))
    if watched & door_entities:
        return "loop_risk"
    for eid in watched:
        row = conn.execute("SELECT config_entry_id FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
        if row is not None and row["config_entry_id"] in stations:
            return "loop_risk"
    return None


# ---------------------------------------------------------------- life cycle (called by routers/door_automations.py)

def _audit(conn: sqlite3.Connection, actor: Any, action: str, decision: str, block_id: str | None, reason: str | None = None, request_id: str | None = None,
           **details: Any) -> None:
    audit(conn, actor=actor, action=action, decision=decision, resource_type="door_automation", resource_id=block_id, reason=reason, request_id=request_id,
          details=details or None, under=_NOT_FROM_A_GRANT if is_operator(actor) else None)


def _name_ok(name: Any) -> str:
    if not isinstance(name, str) or not trusted_caller.text_ok(name.strip()) or len(name.strip()) > 80:
        raise _invalid(["name"])
    return name.strip()


def _require_manage(conn: sqlite3.Connection, principal: Principal, policy: dict[str, Any], action: str, block_id: str | None, rid: str | None,
                    item_id: str | None = None) -> None:
    """Creating or editing a block: `access.doors.automate` somewhere, `automation.manage` at the installation or on a floor that reaches the
    automation (owner answer 12.4) and `access.doors.automate` on every door's station chain."""
    _require_holder(conn, principal, action, block_id, rid)
    if manage_reach(conn, principal, item_id) is None:  # installation or floor scope (owner answer 12.4); a floor reaches only its own automations
        _audit(conn, principal, action, "denied", block_id, "automation_manage", rid)
        raise forbidden(permission="automation.manage", target_type="installation", target_id="*")
    for d in policy["doors"]:
        if not may_automate(conn, principal, d["station_id"], item_id):
            _audit(conn, principal, action, "denied", block_id, "automate_not_allowed", rid)
            raise forbidden(permission=AUTOMATE, reason="automate_not_allowed", door=door_name(d))


def _require_holder(conn: sqlite3.Connection, principal: Principal, action: str, block_id: str | None, rid: str | None) -> None:
    if not holds_anywhere(conn, principal):
        _audit(conn, principal, action, "denied", block_id, "no_binding", rid)
        raise forbidden(permission=AUTOMATE)


def create(conn: sqlite3.Connection, principal: Principal, item_id: str, name: Any, raw_policy: Any, rid: str | None = None) -> dict[str, Any]:
    _require_holder(conn, principal, "door_automation.create", None, rid)  # a caller without the permission learns nothing from validation
    policy = validate_policy(raw_policy)
    _require_manage(conn, principal, policy, "door_automation.create", None, rid, item_id)
    clean = _name_ok(name)
    if _item(conn, item_id) is None:
        raise ApiError(404, "not_found", "האוטומציה לא נמצאה.")
    require_doors_known(policy)
    if by_item(conn, item_id) is not None:
        raise ApiError(409, "door_automation_exists", "לאוטומציה הזו כבר יש פתיחת דלת.")
    block_id = "da_" + uuid.uuid4().hex
    at = iso(now())
    conn.execute("""INSERT INTO door_automations(id, automation_item_id, name, state, policy_json, policy_revision, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, 'draft', ?, 1, ?, ?, ?)""", (block_id, item_id, clean, json.dumps(policy, ensure_ascii=False), principal.user_id, at, at))
    _audit(conn, principal, "door_automation.create", "allowed", block_id, None, rid, automation_item_id=item_id, doors=len(policy["doors"]))
    return view(conn, get(conn, block_id))  # type: ignore[arg-type]


def _disarm(conn: sqlite3.Connection, row: sqlite3.Row, reason: str, by: str) -> None:
    conn.execute("UPDATE door_automations SET state = 'disarmed', disarm_reason = ?, disarmed_at = ?, disarmed_by = ?, updated_at = ? WHERE id = ?",
                 (reason, iso(now()), by, iso(now()), row["id"]))


def update(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, name: Any, raw_policy: Any, base_revision: Any, rid: str | None = None) -> dict[str, Any]:
    _require_holder(conn, principal, "door_automation.update", row["id"], rid)
    policy = validate_policy(raw_policy)
    _require_manage(conn, principal, policy, "door_automation.update", row["id"], rid, row["automation_item_id"])
    clean = _name_ok(name)
    if base_revision != row["policy_revision"]:
        raise ApiError(409, "door_automation_changed", "ההגדרה השתנתה בינתיים; טענו אותה מחדש.", details={"policy_revision": row["policy_revision"]})
    require_doors_known(policy)
    conn.execute("UPDATE door_automations SET name = ?, policy_json = ?, policy_revision = policy_revision + 1, updated_at = ? WHERE id = ?",
                 (clean, json.dumps(policy, ensure_ascii=False), iso(now()), row["id"]))
    if row["state"] == "armed":
        _disarm(conn, row, "edited", principal.user_id)
    _audit(conn, principal, "door_automation.update", "allowed", row["id"], None, rid, policy_revision=row["policy_revision"] + 1, was_armed=row["state"] == "armed")
    return view(conn, get(conn, row["id"]))  # type: ignore[arg-type]


def arm(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, confirmed: Any, base_revision: Any, *, dev_mode: bool, rid: str | None = None) -> dict[str, Any]:
    """The human arm step. Every refusal is audited; nothing is armed unless every check passes."""

    def refuse(exc: ApiError, reason: str) -> ApiError:
        _audit(conn, principal, "door_automation.arm", "denied", row["id"], reason, rid)
        return exc

    if not holds_anywhere(conn, principal):
        raise refuse(forbidden(permission=AUTOMATE), "no_binding")
    if confirmed is not True:
        raise refuse(ApiError(409, "confirmation_required", "חימוש פתיחת דלת מאוטומציה דורש אישור מפורש."), "confirmation_required")
    if base_revision != row["policy_revision"]:
        raise refuse(ApiError(409, "door_automation_changed", "ההגדרה השתנתה בינתיים; טענו אותה מחדש."), "changed")
    if killed(conn):
        raise refuse(ApiError(409, "door_automation_killed", "כל פתיחות הדלתות מאוטומציות עצורות כרגע."), "killed")
    policy = policy_of(row)
    try:
        require_doors_known(policy)
    except ApiError as exc:
        raise refuse(exc, exc.code) from None
    for d in policy["doors"]:
        why = armer_reason(conn, principal, d, dev_mode, row["automation_item_id"])
        if why is not None:
            raise refuse(forbidden("אין לך הרשאה לתת לאוטומציה לפתוח את הדלת הזו.", reason=why, door=door_name(d)), why)
    item = _item(conn, row["automation_item_id"])
    if item is None or not item["revision"]:
        raise refuse(ApiError(409, "item_missing", "האוטומציה אינה זמינה כרגע."), "item_missing")
    loop = loop_refusal(conn, _item_cfg(item), policy)
    if loop == "loop_risk":
        raise refuse(ApiError(409, "loop_risk", "האוטומציה מופעלת מהדלת עצמה או מעמדת האינטרקום שלה, ולכן אי אפשר לחמש אותה."), loop)
    if loop == "triggers_unresolvable":
        raise refuse(ApiError(409, "triggers_unresolvable", "לא ניתן לזהות מה מפעיל את האוטומציה, ולכן אי אפשר לחמש אותה."), loop)
    at = now()
    until = at + dt.timedelta(days=effective(conn, policy)["arm_days"])
    conn.execute("""UPDATE door_automations SET state = 'armed', bound_item_revision = ?, armed_by = ?, armed_by_username = ?, armed_by_name = ?, armed_source = ?,
                    armed_at = ?, armed_until = ?, disarm_reason = NULL, disarmed_at = NULL, disarmed_by = NULL, updated_at = ? WHERE id = ?""",
                 (item["revision"], principal.user_id, principal.username, principal.display_name or principal.username, principal.source, iso(at), iso(until), iso(at), row["id"]))
    _audit(conn, principal, "door_automation.arm", "allowed", row["id"], None, rid, item_revision=item["revision"], policy_revision=row["policy_revision"],
           armed_until=iso(until), doors=len(policy["doors"]))
    return view(conn, get(conn, row["id"]))  # type: ignore[arg-type]


def disarm(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, rid: str | None = None) -> dict[str, Any]:
    """Stopping is always allowed to a holder of the permission anywhere (the safe direction)."""
    if not holds_anywhere(conn, principal):
        _audit(conn, principal, "door_automation.disarm", "denied", row["id"], "no_binding", rid)
        raise forbidden(permission=AUTOMATE)
    if row["state"] == "armed":
        _disarm(conn, row, "manual", principal.user_id)
    _audit(conn, principal, "door_automation.disarm", "allowed", row["id"], None, rid, was_armed=row["state"] == "armed")
    return view(conn, get(conn, row["id"]))  # type: ignore[arg-type]


def delete(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, rid: str | None = None) -> None:
    if not holds_anywhere(conn, principal):
        _audit(conn, principal, "door_automation.delete", "denied", row["id"], "no_binding", rid)
        raise forbidden(permission=AUTOMATE)
    if row["state"] == "armed":
        _disarm(conn, row, "deleted", principal.user_id)
    conn.execute("UPDATE door_automations SET deleted_at = ?, updated_at = ? WHERE id = ?", (iso(now()), iso(now()), row["id"]))
    _audit(conn, principal, "door_automation.delete", "allowed", row["id"], None, rid)


def set_kill(conn: sqlite3.Connection, principal: Principal, on: Any, confirmed: Any, rid: str | None = None) -> dict[str, Any]:
    """ON: any holder of the permission anywhere, or a system administrator; OFF: a system administrator only."""
    admin = authorize(conn, principal, "system.configure", INSTALLATION).allowed and not is_operator(principal)
    may = admin if on is not True else (admin or holds_anywhere(conn, principal))
    if not may:
        _audit(conn, principal, "door_automation.kill", "denied", None, "no_binding", rid, on=on is True)
        raise forbidden(permission="system.configure" if on is not True else AUTOMATE)
    if confirmed is not True:
        _audit(conn, principal, "door_automation.kill", "denied", None, "confirmation_required", rid, on=on is True)
        raise ApiError(409, "confirmation_required", "נדרש אישור מפורש.")
    set_setting(conn, KILL_KEY, "on" if on is True else "off")
    _audit(conn, principal, "door_automation.kill", "allowed", None, None, rid, on=on is True)
    return status(conn, principal)


def _is_admin(conn: sqlite3.Connection, principal: Principal) -> bool:
    return not is_operator(principal) and authorize(conn, principal, "system.configure", INSTALLATION).allowed


def set_settings(conn: sqlite3.Connection, principal: Principal, body: dict[str, Any], rid: str | None = None) -> dict[str, Any]:
    """The administrator settings (system.configure, confirmation, audited): `feature` (on refused while GO_LIVE_PERMITTED is False),
    `limits` {cooldown_s, max_per_hour, max_per_day, arm_days, storm_refusals, storm_window_s} within their bounds, and
    `excluded_roles` (roles whose automation.manage does not imply arming). Validated as a whole before anything is written."""
    if not _is_admin(conn, principal):
        _audit(conn, principal, "door_automation.settings", "denied", None, "no_binding", rid)
        raise forbidden(permission="system.configure")
    if body.get("confirmed") is not True:
        raise ApiError(409, "confirmation_required", "נדרש אישור מפורש.")
    feature, lim, roles = body.get("feature"), body.get("limits"), body.get("excluded_roles")
    bad: list[str] = []
    if feature is not None and feature not in ("on", "off"):
        bad.append("feature")
    if lim is not None and (not isinstance(lim, dict) or any(k not in ALL_BOUNDS or not _int_ok(v, *ALL_BOUNDS[k]) for k, v in lim.items())):
        bad.append("limits")
    if roles is not None and (not isinstance(roles, list) or len(roles) > 200 or not all(isinstance(r, str) and 0 < len(r) <= 128 for r in roles)):
        bad.append("excluded_roles")
    if bad:
        raise _invalid(bad)
    if feature == "on" and not go_live_permitted():
        _audit(conn, principal, "door_automation.settings", "denied", None, "door_automation_not_permitted", rid, key=FLAG_KEY, requested="on")
        raise ApiError(409, "door_automation_not_permitted", "פתיחת דלתות מאוטומציות אינה זמינה בגרסה הזו.")
    if feature is not None:
        set_setting(conn, FLAG_KEY, feature)
    for k, v in (lim or {}).items():
        set_setting(conn, SETTING_PREFIX + k, str(v))
    if roles is not None:
        set_setting(conn, EXCLUDED_ROLES_KEY, json.dumps(sorted(set(roles))))
    _audit(conn, principal, "door_automation.settings", "allowed", None, None, rid, feature=feature, limits=lim, excluded_roles=roles)
    return status(conn, principal)


def set_feature(conn: sqlite3.Connection, principal: Principal, feature: Any, confirmed: Any, rid: str | None = None) -> dict[str, Any]:
    return set_settings(conn, principal, {"feature": feature, "confirmed": confirmed}, rid)


def set_user_removed(conn: sqlite3.Connection, principal: Principal, user_id: str, removed: Any, confirmed: Any, rid: str | None = None) -> dict[str, Any]:
    """The per-user removal (owner decision 2026-10-21): a system administrator, or a role administrator (rbac.roles.manage), takes
    the right to arm door steps away from one person - whatever their roles imply - or gives it back. Armed steps of that person
    stop at their next fire (the armer re-check)."""
    admin = _is_admin(conn, principal) or (not is_operator(principal) and authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed)
    if not admin:
        _audit(conn, principal, "door_automation.user", "denied", None, "no_binding", rid, user=user_id)
        raise forbidden(permission="rbac.roles.manage")
    if not isinstance(removed, bool):
        raise _invalid(["removed"])
    if confirmed is not True:
        raise ApiError(409, "confirmation_required", "נדרש אישור מפורש.")
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is None:
        raise ApiError(404, "not_found", "המשתמש לא נמצא.")
    current = set(removed_users(conn))
    current = current | {user_id} if removed else current - {user_id}
    set_setting(conn, REMOVED_USERS_KEY, json.dumps(sorted(current)))
    _audit(conn, principal, "door_automation.user", "allowed", None, None, rid, user=user_id, removed=removed)
    return {"user_id": user_id, "removed": removed}


def status(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    admin = not is_operator(principal) and authorize(conn, principal, "system.configure", INSTALLATION).allowed
    holder = holds_anywhere(conn, principal)
    if not (admin or holder):
        return {"visible": False}
    out = {"visible": True, "feature": feature_setting(conn), "go_live_permitted": go_live_permitted(), "available": enabled(conn), "killed": killed(conn),
           "can_manage": holder, "can_lift_kill": admin, "can_configure": admin, "limits": limits(conn)}
    if admin:
        out.update(excluded_roles=excluded_roles(conn), removed_users=removed_users(conn), bounds={k: list(v) for k, v in ALL_BOUNDS.items()},
                   dropped_events=STATS["dropped"])
    return out


def doors_for(conn: sqlite3.Connection, principal: Principal, *, dev_mode: bool) -> list[dict[str, Any]]:
    """The doors of the served WisKey copy on whose station the caller holds `access.doors.automate` (the editor's picker), each
    with `can_arm`: whether the caller could arm a block with it now (the door rule too). Names only, no hardware ids."""
    if not holds_anywhere(conn, principal):
        raise forbidden(permission=AUTOMATE)
    out: list[dict[str, Any]] = []
    for s in intercom_sync.SYNC.stations():
        if not may_automate(conn, principal, s["id"]):
            continue
        floor_only = not _explicit(conn, principal, s["id"])  # implied by automation.manage: a floor editor sees a door only when they may open it
        relays = intercom_doors.station_relays(s)
        for lock in s.get("locks") or []:
            relay = int(lock["physical_index"])
            if relay not in relays:
                continue
            door = {"station_id": s["id"], "relay": relay}
            label = s["name"] if len(relays) == 1 else f"{s['name']} · {lock.get('name') or relay}"
            can_arm = armer_reason(conn, principal, door, dev_mode) is None
            if floor_only and not can_arm and manage_reach(conn, principal) == "floor":
                continue
            out.append({**door, "name": label, "online": bool(s.get("online")), "can_arm": can_arm})
    return out


def fires(conn: sqlite3.Connection, row: sqlite3.Row, limit: int = 50) -> list[dict[str, Any]]:
    out = []
    for f in conn.execute("SELECT * FROM door_automation_fires WHERE automation_id = ? ORDER BY at DESC, rowid DESC LIMIT ?", (row["id"], limit)).fetchall():
        name = None
        if f["door_key"]:
            sid, _, relay = f["door_key"].rpartition("#")
            name = door_name({"station_id": sid, "relay": int(relay)}) or None
        out.append({"at": f["at"], "door": name, "attempted": bool(f["attempted"]), "outcome": f["outcome"], "reason": f["reason"], "code": f["code"],
                    "operator_id": f["operator_id"], "armed_by": f["armed_by"], "armed_by_name": f["armed_by_name"]})
    return out


# ---------------------------------------------------------------- the fire path

def _trigger_of(source: Any, time_fired: Any) -> dict[str, Any]:
    text = source if isinstance(source, str) else ""
    text = "".join(ch for ch in text if ch.isprintable())[:SOURCE_MAX]
    return {"source": text, "time_fired": str(time_fired)[:40] if time_fired else None}


_UTC_MICRO = "%Y-%m-%dT%H:%M:%S.%fZ"  # fixed width: stored stamps compare as text in time order


def _instant(text: Any) -> dt.datetime | None:
    """A Home Assistant timestamp (ISO 8601 with an offset) as a UTC instant; None for anything else. A stamp without an offset is read as UTC."""
    if not isinstance(text, str) or not text:
        return None
    try:
        v = dt.datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return (v if v.tzinfo else v.replace(tzinfo=dt.timezone.utc)).astimezone(dt.timezone.utc)


def _stamp(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).strftime(_UTC_MICRO)


def _context_of(value: Any) -> tuple[Any, Any]:
    """(user_id, parent_id) of an event context. A bare value (older callers) is the user id."""
    if isinstance(value, dict):
        return value.get("user_id"), value.get("parent_id")
    return value, None


def is_manual(trigger: dict[str, Any], context: Any) -> bool:
    """A-04, relaxed by the owner's decision of 2026-10-21 ("safe, but not hard to manage"): a run is a person's when its context names a
    person (`user_id`), when it is a manual run (MANUAL_SOURCES) or when it carries no source at all. A parent context is NOT refused:
    Home Assistant gives almost every automation run one (the state change that triggered it, or a script / automation that caused that
    change), so refusing it would refuse ordinary runs; and an unfamiliar source wording (a new Home Assistant version) is not refused
    either. What makes the event trustworthy is the corroboration against Home Assistant's own state machine (DA-01), not its wording;
    the parent id and the source are kept in the audit."""
    user, _parent = _context_of(context)
    if user:
        return True
    src = str(trigger.get("source") or "").strip().lower()
    return not src or src in MANUAL_SOURCES


def _watch_specs(cfg: dict[str, Any]) -> tuple[list[tuple[str, bool]], bool, bool]:
    """(the watched entities as (entity_id, watches an attribute) of the state / numeric_state triggers, whether the automation also has a
    trigger without an entity (time, sun ...), whether every trigger could be read)."""
    triggers = cfg.get("triggers", cfg.get("trigger"))
    if isinstance(triggers, dict):
        triggers = [triggers]
    if not isinstance(triggers, list):
        return [], False, False
    specs: list[tuple[str, bool]] = []
    entityless = False
    for t in triggers:
        if not isinstance(t, dict):
            return [], False, False
        kind = t.get("trigger", t.get("platform"))
        if kind in ENTITYLESS_TRIGGERS:
            entityless = True
            continue
        if kind not in ENTITY_TRIGGERS:
            return [], False, False
        ids = t.get("entity_id")
        ids = [ids] if isinstance(ids, str) else ids
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
            return [], False, False
        specs.extend((i, bool(t.get("attribute"))) for i in ids)
    return specs, entityless, True


def _backlog() -> int:
    """The events waiting behind the one in hand (0 without the queue, e.g. a synchronous dispatch)."""
    q = _QUEUE
    try:
        return q.qsize() if q is not None else 0
    except Exception:  # noqa: BLE001
        return 0


def corroboration(conn: sqlite3.Connection, row: sqlite3.Row, at: dt.datetime) -> tuple[str | None, str | None]:
    """A-01 (Fable review; CR 11.1 / 12.6): is this `automation_triggered` event backed by what the mirror saw? Read only. Returns
    (refusal reason or None, the matched `last_triggered` stamp).

    Home Assistant lets any integration or script fire the event, with no person's context, so the event alone is not evidence. Required, all of it:
    1. the automation entity's `last_triggered` in the mirror is within `corroborate_window_s` of now (either direction) AND is newer than the last
       one a fire was matched with (`door_automations.corroborated_trigger`) - one real run authorises at most one event (no replay);
    2. for an automation with state / numeric_state triggers, at least one watched entity changed in the mirror within the same window
       (`last_changed`; `last_updated` for a trigger on an attribute). An automation that ALSO has a time / sun / homeassistant trigger cannot
       tell which trigger ran, so for it (1) alone applies.
    Anything unreadable fails closed."""
    item = _item(conn, row["automation_item_id"])
    if item is None or not item["entity_id"]:
        return "uncorroborated", None
    window = limits(conn)["corroborate_window_s"]
    ent = conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (item["entity_id"],)).fetchone()
    try:
        attrs = json.loads(ent["attributes_json"] or "{}") if ent is not None else {}
    except ValueError:
        attrs = {}
    lt = _instant(attrs.get("last_triggered") if isinstance(attrs, dict) else None)
    if lt is None or abs((at - lt).total_seconds()) > window:
        return "uncorroborated", None
    stamp = _stamp(lt)
    done = row["corroborated_trigger"]
    if done and stamp <= done:
        return "uncorroborated", None
    specs, entityless, readable = _watch_specs(_item_cfg(item))
    if not readable:
        return "uncorroborated", None
    if specs and not entityless:
        for eid, attribute in specs:
            w = conn.execute("SELECT last_changed, last_updated FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
            changed = _instant(w["last_updated" if attribute else "last_changed"]) if w is not None else None
            if changed is not None and abs((at - changed).total_seconds()) <= window:
                break
        else:
            return "uncorroborated", None
    return None, stamp


# DA-01 (Fable review 2, 2026-10-21): the mirror is fed by the same event bus an attacker can fire `state_changed` on, so it is only the
# cheap pre-filter. At decision time Arx reads the automation entity ONCE from Home Assistant's state machine (an authenticated REST read,
# GET /api/states/<entity_id>) and matches the run with THAT `last_triggered`; firing an event cannot change the state machine. Any error,
# a missing entity or an unreadable stamp refuses (fail closed). Tests install a fake (`STATE_READER`).
STATE_READER: Callable[[Any, str], Any] | None = None


def _read_state(settings: Any, entity_id: str) -> dict[str, Any] | None:
    try:
        if STATE_READER is not None:
            answer = STATE_READER(settings, entity_id)
        else:
            from . import ha_client

            answer = ha_client.get_state(settings, entity_id)
    except Exception:  # noqa: BLE001 - a failed read is a refusal, never an opening
        return None
    return answer if isinstance(answer, dict) else None


def direct_run(settings: Any, entity_id: str, at: dt.datetime, window: int, done: str | None) -> str | None:
    """The `last_triggered` stamp of the automation entity read directly from Home Assistant, when it is within `window` seconds of `at` and
    newer than the last matched run (`done`); None otherwise (refused)."""
    st = _read_state(settings, entity_id)
    attrs = st.get("attributes") if st is not None else None
    lt = _instant(attrs.get("last_triggered")) if isinstance(attrs, dict) else None
    if lt is None or abs((at - lt).total_seconds()) > window:
        return None
    stamp = _stamp(lt)
    return None if done and stamp <= done else stamp


WATCH_READ_MAX = 8  # DA-06: at most this many watched entities are read directly per decision


def direct_watch(settings: Any, specs: list[tuple[str, bool]], at: dt.datetime, window: int) -> bool:
    """DA-06 (Fable review 3): the watched-entity half of the corroboration, read from Home Assistant's state machine like `direct_run` (the
    mirror is only the pre-filter). True when the FIRST watched entity (up to WATCH_READ_MAX) whose `last_changed` (`last_updated` for a trigger
    on an attribute) is within `window` seconds of `at` is found; every unreadable state or stamp counts as no match (fail closed)."""
    for eid, attribute in specs[:WATCH_READ_MAX]:
        st = _read_state(settings, eid)
        changed = _instant(st.get("last_updated" if attribute else "last_changed")) if st is not None else None
        if changed is not None and abs((at - changed).total_seconds()) <= window:
            return True
    return False


def _consume(conn: sqlite3.Connection, row: sqlite3.Row, stamp: str) -> bool:
    """Match this `last_triggered` with exactly one event: false when it (or a later one) was already matched (a replay)."""
    cur = conn.execute("UPDATE door_automations SET corroborated_trigger = ? WHERE id = ? AND (corroborated_trigger IS NULL OR corroborated_trigger < ?)",
                       (stamp, row["id"], stamp))
    return cur.rowcount == 1


def _block_gates(conn: sqlite3.Connection, row: sqlite3.Row, at: dt.datetime, trigger: dict[str, Any], context: Any, *, corroborate: bool = False,
                 matched: list[str] | None = None, event_at: dt.datetime | None = None) -> list[tuple[str, bool, str | None]]:
    """The block-level gates in order: (gate, ok, refusal reason). Read only. `context` is the event's context ({user_id, parent_id}).
    `corroborate` (the real fire path) adds the last gate, the A-01 corroboration of the event with the mirror, measured against
    `event_at` (when Arx received the event; `at` when not given); the matched stamp is appended to `matched`. A simulation has no
    event, so it does not evaluate that gate."""
    gates: list[tuple[str, bool, str | None]] = [("armed", row["state"] == "armed", None if row["state"] == "armed" else "not_armed")]
    gates.append(("feature", enabled(conn), None if enabled(conn) else "feature_off"))
    gates.append(("kill", not killed(conn), "killed" if killed(conn) else None))
    until = _parse(row["armed_until"])
    expired = row["state"] == "armed" and (until is None or at >= until)
    gates.append(("expiry", not expired, "arm_expired" if expired else None))
    manual = is_manual(trigger, context)
    gates.append(("trigger", not manual, "manual_trigger" if manual else None))
    item = _item(conn, row["automation_item_id"])
    if item is None:
        gates.append(("revision", False, "item_missing"))
    elif row["state"] == "armed" and item["revision"] != row["bound_item_revision"]:
        gates.append(("revision", False, "item_changed"))
    else:
        gates.append(("revision", True, None))
    try:
        ok = in_window(policy_of(row)["windows"], at, zone_name(conn))
        gates.append(("window", ok, None if ok else "outside_window"))
    except ClockUntrusted:
        gates.append(("window", False, "clock_untrusted"))
    if corroborate:
        why, stamp = corroboration(conn, row, event_at or at)
        gates.append(("corroboration", why is None, why))
        if stamp is not None and matched is not None:
            matched.append(stamp)
    return gates


def _door_gate(conn: sqlite3.Connection, row: sqlite3.Row, door: dict[str, Any], at: dt.datetime, dev_mode: bool) -> str | None:
    """The per-door gates in order; the first refusal reason, or None (the door may be handed on). Read only."""
    s = station_of(door)
    if s is None or not s.get("online"):
        return "door_unavailable"
    if armer_reason(conn, _armer(row), door, dev_mode, row["automation_item_id"]) is not None:
        return "armer_lost_authority"
    policy = effective(conn, policy_of(row))
    key = door_key(door)
    last = conn.execute("SELECT MAX(at) FROM door_automation_fires WHERE automation_id = ? AND door_key = ? AND attempted = 1", (row["id"], key)).fetchone()[0]
    if last and (at - _parse(last)).total_seconds() < policy["cooldown_s"]:  # type: ignore[operator]
        return "cooldown"
    hour = conn.execute("SELECT COUNT(*) FROM door_automation_fires WHERE automation_id = ? AND door_key = ? AND attempted = 1 AND at > ?",
                        (row["id"], key, iso(at - dt.timedelta(hours=1)))).fetchone()[0]
    if hour >= policy["max_per_hour"]:
        return "rate_hour"
    day = conn.execute("SELECT COUNT(*) FROM door_automation_fires WHERE automation_id = ? AND attempted = 1 AND at > ?", (row["id"], iso(at - dt.timedelta(days=1)))).fetchone()[0]
    if day >= policy["max_per_day"]:
        return "rate_day"
    # A-03: the cap of the DOOR itself, across every block that names it (a second block on the same door shares it; a deleted block's fires count too)
    door_hour = conn.execute("SELECT COUNT(*) FROM door_automation_fires WHERE door_key = ? AND attempted = 1 AND at > ?", (key, iso(at - dt.timedelta(hours=1)))).fetchone()[0]
    if door_hour >= policy["door_max_per_hour"]:
        return "door_rate_hour"
    door_day = conn.execute("SELECT COUNT(*) FROM door_automation_fires WHERE door_key = ? AND attempted = 1 AND at > ?", (key, iso(at - dt.timedelta(days=1)))).fetchone()[0]
    if door_day >= policy["door_max_per_day"]:
        return "door_rate_day"
    return None


def _auto_disarm(conn: sqlite3.Connection, row: sqlite3.Row, reason: str) -> None:
    _disarm(conn, row, reason, "system")
    _audit(conn, operator_of(row["id"], row["name"]), "door_automation.auto_disarm", "allowed", row["id"], reason, None, automation_item_id=row["automation_item_id"])


def _record_refusal(conn: sqlite3.Connection, row: sqlite3.Row, door: dict[str, Any] | None, reason: str, trigger: dict[str, Any], at: dt.datetime) -> None:
    conn.execute("""INSERT INTO door_automation_fires(id, automation_id, door_key, at, attempted, outcome, reason, operator_id, armed_by, armed_by_name)
                    VALUES (?, ?, ?, ?, 0, 'refused', ?, ?, ?, ?)""",
                 (uuid.uuid4().hex, row["id"], door_key(door) if door else None, iso(at), reason, f"{OPERATOR_PREFIX}{row['id']}", row["armed_by"], row["armed_by_name"]))
    _audit(conn, operator_of(row["id"], row["name"]), "door_automation.fire", "denied", row["id"], reason, None, actor_kind="automation",
           automation_item_id=row["automation_item_id"], trigger=trigger, **({"station": door["station_id"], "relay": door["relay"]} if door else {}))
    if reason in DISARMING and row["state"] == "armed":
        _auto_disarm(conn, row, reason)
    elif reason in STORM_REASONS:
        lim = limits(conn)
        n = conn.execute(f"SELECT COUNT(*) FROM door_automation_fires WHERE automation_id = ? AND reason IN ({', '.join('?' * len(STORM_REASONS))}) AND at > ?",
                         (row["id"], *STORM_REASONS, iso(at - dt.timedelta(seconds=lim["storm_window_s"])))).fetchone()[0]
        if n >= lim["storm_refusals"]:
            _auto_disarm(conn, row, "storm")


def _details(row: sqlite3.Row, door: dict[str, Any], trigger: dict[str, Any], request_id: str) -> dict[str, Any]:
    return {"command": "release", "actor_kind": "automation", "automation_id": row["id"], "automation_name": row["name"],
            "automation_item_id": row["automation_item_id"], "item_revision": row["bound_item_revision"], "policy_revision": row["policy_revision"],
            "trigger": trigger, "operator_id": f"{OPERATOR_PREFIX}{row['id']}", "armed_by": row["armed_by"], "armed_by_name": row["armed_by_name"],
            "armed_source": row["armed_source"], "entry_point": ENTRY_POINT, "origin": f"automation:{row['automation_item_id']}",
            "transport": "automation", "door_request_id": request_id, "station": door["station_id"], "relay": door["relay"]}


def _switch_reason(conn: sqlite3.Connection, row: sqlite3.Row, at: dt.datetime) -> str | None:
    """A-02: the three cheap switches, read again inside the per-door transaction (the block gates ran in an earlier one, and with N doors
    the window spans N sends): the kill switch, the feature switch (and the go-live permit) and the arming expiry."""
    if killed(conn):
        return "killed"
    if not enabled(conn):
        return "feature_off"
    until = _parse(row["armed_until"])
    if until is None or at >= until:
        return "arm_expired"
    return None


def _fire_door(db: Database, block_id: str, door: dict[str, Any], trigger: dict[str, Any], dev_mode: bool) -> dict[str, Any]:
    name = door_name(door) or None
    with db.connection(label="door automation decide") as conn:
        row = get(conn, block_id)
        if row is None or row["state"] != "armed":
            return {"door": name, "outcome": "refused", "reason": "not_armed"}
        at = now()
        reason = _switch_reason(conn, row, at) or _door_gate(conn, row, door, at, dev_mode)
        if reason is not None:
            _record_refusal(conn, row, door, reason, trigger, at)
            return {"door": name, "outcome": "refused", "reason": reason}
        request_id = str(uuid.uuid4())
        fire_id = uuid.uuid4().hex
        conn.execute("""INSERT INTO door_automation_fires(id, automation_id, door_key, at, attempted, outcome, door_request_id, operator_id, armed_by, armed_by_name)
                        VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, ?)""",
                     (fire_id, block_id, door_key(door), iso(at), request_id, f"{OPERATOR_PREFIX}{row['id']}", row["armed_by"], row["armed_by_name"]))
        op = operator_of(row["id"], row["name"])
        details = _details(row, door, trigger, request_id)
        audit(conn, actor=op, action="intercom.release", decision="allowed", resource_type="intercom_station", resource_id=door["station_id"],
              details={**details, "phase": "attempt"}, under=_NOT_FROM_A_GRANT)
    # the attempt row is committed: no record, no command. The send runs outside any transaction.
    sender = SENDER if SENDER is not None else LiveSender(db)
    try:
        outcome, code = sender.open(operator=op, station_id=door["station_id"], relay=door["relay"], request_id=request_id, not_after=at + dt.timedelta(seconds=SEND_WITHIN_S))
        if outcome not in ("sent", "refused", "unknown", "not_sent"):
            outcome, code = "unknown", "invalid_outcome"
    except Exception as exc:  # noqa: BLE001 - after a possible delivery the outcome is unknown, never retried
        outcome, code = "unknown", type(exc).__name__
    try:
        with db.write_aside(label="door automation outcome") as w:
            w.execute("UPDATE door_automation_fires SET outcome = ?, code = ? WHERE id = ?", (outcome, code, fire_id))
            audit(w, actor=op, action="intercom.release", decision="allowed", resource_type="intercom_station", resource_id=door["station_id"], reason=code,
                  details={**details, "phase": "outcome", "outcome": outcome, "code": code}, under=_NOT_FROM_A_GRANT)
    except Exception:  # noqa: BLE001 - the attempt row stands
        log.exception("door automation %s: the outcome (%s) could not be recorded; its attempt row stands", block_id, outcome)
    return {"door": name, "outcome": outcome, "code": code, "door_request_id": request_id}


def handle_item_event(db: Database, settings: Any, item_id: str, trigger: dict[str, Any], context: Any, *, corroborate: bool = True,
                      received_at: dt.datetime | None = None) -> list[dict[str, Any]]:
    """One run of the automation `item_id` reported by Home Assistant. Returns one entry per decision (tests, logs). `context` is the event's
    context ({user_id, parent_id}). Order: the block gates with the mirror as the pre-filter (read only), then ONE direct read of the
    automation entity from Home Assistant's state machine outside any transaction (DA-01), then - under the write lock - the run is matched
    with exactly one event (`_consume`, a replay is refused) and the doors are handled. The event can reach Arx before the state frame does,
    so an event that fails ONLY the corroboration is re-checked for CORROBORATE_WAIT_S (nothing held while waiting) before it is refused -
    but only while no more than CORROBORATE_WAIT_MAX_QUEUED other events wait behind it (DA-02).

    DA-04: the corroboration window is measured from `received_at`, the moment Arx's own clock received the event (`on_event`), not from
    when the worker took it off the queue, so a queue delay does not refuse a real run. It is never the event's own `time_fired` (the
    sender's word) and never later than now. The arming window, the expiry and the per-door gates still use the decision time."""
    dev_mode = bool(getattr(settings, "dev_user", None))
    deadline = _monotonic() + CORROBORATE_WAIT_S
    while True:
        at = now()
        ev_at = received_at if received_at is not None and received_at <= at else at
        with db.connection(mode="read", label="door automation gates") as conn:
            row = by_item(conn, item_id)
            if row is None or row["state"] != "armed":
                return []
            matched: list[str] = []
            refusal = next((reason for _gate, ok, reason in _block_gates(conn, row, at, trigger, context, corroborate=corroborate, matched=matched,
                                                                         event_at=ev_at) if not ok), None)
            item = _item(conn, row["automation_item_id"]) if refusal is None and corroborate else None
            window, done = limits(conn)["corroborate_window_s"], row["corroborated_trigger"]
            specs, entityless, readable = _watch_specs(_item_cfg(item)) if item is not None else ([], False, False)
        stamp: str | None = None
        if refusal is None and corroborate:
            stamp = direct_run(settings, item["entity_id"], ev_at, window, done) if item is not None and item["entity_id"] else None
            if stamp is not None and (not readable or (specs and not entityless and not direct_watch(settings, specs, ev_at, window))):
                stamp = None  # DA-06: the watched entity must also have changed in Home Assistant's own state machine
            if stamp is None:
                refusal = "uncorroborated"
        if refusal == "uncorroborated" and _monotonic() < deadline and _backlog() <= CORROBORATE_WAIT_MAX_QUEUED:
            _sleep(CORROBORATE_POLL_S)
            continue
        with db.connection(label="door automation decide run") as conn:
            row = by_item(conn, item_id)
            if row is None or row["state"] != "armed":
                return []
            if refusal is None and corroborate and not _consume(conn, row, stamp):  # type: ignore[arg-type]
                refusal = "uncorroborated"  # this run was already matched with an earlier event: a replay
            if refusal is not None:
                _record_refusal(conn, row, None, refusal, trigger, at)
                return [{"door": None, "outcome": "refused", "reason": refusal}]
            block_id, doors = row["id"], policy_of(row)["doors"]
        return [_fire_door(db, block_id, d, trigger, dev_mode) for d in doors]


def handle_trigger(db: Database, settings: Any, frame: Any, received_at: dt.datetime | None = None) -> list[dict[str, Any]]:
    """An `automation_triggered` frame of the add-on's subscription -> the automation's block, if any. `received_at`: when Arx received
    the frame (DA-04; None = now)."""
    event = frame.get("event") if isinstance(frame, dict) else None
    if not isinstance(event, dict) or event.get("event_type") != "automation_triggered":
        return []
    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    eid = data.get("entity_id")
    if not isinstance(eid, str):
        return []
    with db.connection(mode="read", label="door automation lookup") as conn:
        item = conn.execute("SELECT item_id FROM ha_config_items WHERE kind = 'automation' AND entity_id = ?", (eid,)).fetchone()
        if item is None or by_item(conn, item["item_id"]) is None:
            return []
        item_id = item["item_id"]
    context = event.get("context") if isinstance(event.get("context"), dict) else {}
    trigger = _trigger_of(data.get("source"), event.get("time_fired"))
    if isinstance(context.get("parent_id"), str):
        trigger["parent_context"] = context["parent_id"][:64]  # audit only (never authority)
    return handle_item_event(db, settings, item_id, trigger, context, received_at=received_at)


def _worker_loop(q: queue.Queue[Callable[[], Any]]) -> None:
    while True:
        job = q.get()
        try:
            job()
            STATS["handled"] += 1
        except Exception:  # noqa: BLE001 - a job logs its own failure; the worker never dies
            log.exception("door automation: a queued event failed")


def _enqueue(job: Callable[[], Any]) -> bool:
    """A-09: hand the job to the ONE worker through a bounded queue. A full queue drops the job and counts it (`STATS["dropped"]`, shown to the
    administrator): under an event storm in Home Assistant Arx sheds load instead of starting a thread per event."""
    global _QUEUE, _WORKER
    with _QLOCK:
        if _QUEUE is None:
            _QUEUE = queue.Queue(maxsize=QUEUE_MAX)
        if _WORKER is None or not _WORKER.is_alive():
            _WORKER = threading.Thread(target=_worker_loop, args=(_QUEUE,), name="door-automation", daemon=True)
            _WORKER.start()
        q = _QUEUE
    try:
        q.put_nowait(job)
        return True
    except queue.Full:
        STATS["dropped"] += 1
        if STATS["dropped"] == 1 or STATS["dropped"] % 100 == 0:
            log.warning("door automation: the event queue is full; %s event(s) dropped so far", STATS["dropped"])
        return False


def on_event(db: Database | None, settings: Any, frame: Any) -> None:
    """The mirror's hook (services/automations.py). Never raises into the mirror and never runs on the WS loop (a bounded queue and one worker)."""
    if db is None:
        return
    try:
        received: dt.datetime | None = now()  # DA-04: Arx's own clock at receipt, before any queue delay
    except Exception:  # noqa: BLE001 - never raise into the mirror; the worker then measures from its own now
        received = None

    def run() -> None:
        try:
            handle_trigger(db, settings, frame, received_at=received)
        except Exception:  # noqa: BLE001
            log.exception("door automation: an automation_triggered event could not be handled")

    try:
        if DISPATCH is not None:
            DISPATCH(run)
        else:
            _enqueue(run)
    except Exception:  # noqa: BLE001
        log.exception("door automation: dispatch failed")


# ---------------------------------------------------------------- simulation (read only, nothing sent)

def simulate(conn: sqlite3.Connection, principal: Principal, row: sqlite3.Row, at_text: Any, source: Any, *, dev_mode: bool, rid: str | None = None) -> dict[str, Any]:
    if not holds_anywhere(conn, principal):
        _audit(conn, principal, "door_automation.simulate", "denied", row["id"], "no_binding", rid)
        raise forbidden(permission=AUTOMATE)
    at = now()
    if at_text is not None:
        parsed = _parse(at_text) if isinstance(at_text, str) else None
        if parsed is None:
            raise _invalid(["at"])
        at = parsed
    trigger = _trigger_of(source if source is not None else "state", None)
    gates = [{"gate": g, "ok": ok, "reason": reason} for g, ok, reason in _block_gates(conn, row, at, trigger, None)]
    doors = []
    for d in policy_of(row)["doors"]:
        if row["state"] == "armed":
            reason = _door_gate(conn, row, d, at, dev_mode)
        else:
            reason = "door_unavailable" if station_of(d) is None else None
        doors.append({"door": door_name(d) or None, "decision": "would_open" if reason is None else "refused", "reason": reason})
    would = all(g["ok"] for g in gates) and any(d["decision"] == "would_open" for d in doors)
    _audit(conn, principal, "door_automation.simulate", "allowed", row["id"], None, rid, at=iso(at), would_send=would)
    return {"at": iso(at), "gates": gates, "doors": doors, "would_send": would}
