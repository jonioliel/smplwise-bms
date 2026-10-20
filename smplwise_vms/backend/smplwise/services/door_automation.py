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
nothing. Everything is OFF in this build: `doors.automation_open` cannot be `on` while GO_LIVE_PERMITTED is False, and the live
sender is not built (it refuses). Tests install a fake sender (`SENDER`).

Every fire attempt writes the two rows a human opening writes (`intercom.release`: the attempt committed before sending, then
the outcome), with the operator as actor and `details.actor_kind = "automation"`. Never retried, never queued."""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
import threading
import uuid
from typing import Any, Callable, Protocol
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..audit import audit
from ..db import Database, get_setting, now_iso, set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, STATION, Decision, Principal, authorize, permissions_anywhere
from . import door_authority, intercom_doors, intercom_sync, trusted_caller

log = logging.getLogger("smplwise.door_automation")

# The owner's SEPARATE go-live permit, enforced in code (the capture-lease / external-grants pattern): while False the feature
# switch cannot be turned on and the live sender refuses. Flipped only by the commit that carries the owner's written permit
# AND a reviewed live sender - never by a setting, an environment variable or a version.
GO_LIVE_PERMITTED = False

AUTOMATE = "access.doors.automate"
FLAG_KEY = "doors.automation_open"  # off (default) | on; `doors.*` never travels in a backup (CR-033 section 9)
KILL_KEY = "doors.automation_kill"  # absent / off = running; anything else = every block stopped (fail closed)
OPERATOR_SOURCE = "automation"
OPERATOR_PREFIX = "automation:"
ENTRY_POINT = "door_job"

MAX_DOORS = 4
MAX_WINDOWS = 7
DEFAULTS = {"cooldown_s": 60, "max_per_hour": 4, "max_per_day": 20, "arm_days": 30}
BOUNDS = {"cooldown_s": (10, 3600), "max_per_hour": (1, 30), "max_per_day": (1, 200), "arm_days": (1, 90)}
STORM_REFUSALS = 3
STORM_WINDOW_S = 600
STORM_REASONS = ("cooldown", "rate_hour", "rate_day")
SEND_WITHIN_S = 15
SOURCE_MAX = 120
MANUAL_SOURCES = ("trigger action", "manual")
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
    """The live transport is NOT built in this release: it must go through routers/access_control.open_door (relay guard,
    attempt before send) and, with the signed path, carry the operator as the DTO actor - WisKey's W1 appendix decides that
    shape. Until then every call is refused and nothing is sent."""

    def open(self, *, operator: Principal, station_id: str, relay: int, request_id: str, not_after: dt.datetime) -> tuple[str, str | None]:
        return "not_sent", "live_transport_not_built"


SENDER: DoorSender | None = None  # None: LiveSender (refuses)
DISPATCH: Callable[[Callable[[], Any]], Any] | None = None  # None: a daemon thread per event (never on the WS loop)


def _real_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


_now_fn: Callable[[], dt.datetime] = _real_now


def set_clock(fn: Callable[[], dt.datetime] | None) -> None:
    global _now_fn
    _now_fn = fn or _real_now


def now() -> dt.datetime:
    return _now_fn().astimezone(dt.timezone.utc).replace(microsecond=0)


def reset_for_tests() -> None:
    global SENDER, DISPATCH
    SENDER, DISPATCH = None, None
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
    exclusive). An unknown zone raises ClockUntrusted (the caller refuses)."""
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise ClockUntrusted(tz) from None
    local = at.astimezone(zone)
    minute = local.hour * 60 + local.minute
    for w in windows:
        if local.weekday() in w["days"] and _minutes(w["start"]) <= minute < _minutes(w["end"]):
            return True
    return False


# ---------------------------------------------------------------- the block (policy)

def _invalid(fields: list[str]) -> ApiError:
    return ApiError(422, "door_automation_invalid", "ההגדרה אינה תקינה: " + ", ".join(fields), details={"fields": fields})


def _int_field(raw: dict[str, Any], key: str, bad: list[str]) -> int:
    value = raw.get(key, DEFAULTS[key])
    lo, hi = BOUNDS[key]
    if not isinstance(value, int) or isinstance(value, bool) or not lo <= value <= hi:
        bad.append(key)
        return DEFAULTS[key]
    return value


def validate_policy(raw: Any) -> dict[str, Any]:
    """The block's policy, normalised; 422 `door_automation_invalid` naming every bad field. No default allow-list and no
    default window: a block names its doors and its hours explicitly."""
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
    windows_raw = raw.get("windows")
    windows: list[dict[str, Any]] = []
    if not isinstance(windows_raw, list) or not 1 <= len(windows_raw) <= MAX_WINDOWS:
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
    out = {"doors": doors, "windows": windows, **{k: _int_field(raw, k, bad) for k in DEFAULTS}}
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
        "bound_item_revision": row["bound_item_revision"], "armed_by": row["armed_by"], "armed_by_name": row["armed_by_name"],
        "armed_at": row["armed_at"], "armed_until": row["armed_until"], "disarm_reason": row["disarm_reason"], "disarmed_at": row["disarmed_at"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }


# ---------------------------------------------------------------- authority (people)

def holds_anywhere(conn: sqlite3.Connection, principal: Principal) -> bool:
    return not is_operator(principal) and AUTOMATE in permissions_anywhere(conn, principal)


def door_name(door: dict[str, Any]) -> str:
    s = intercom_sync.SYNC.station(door["station_id"])
    return (s or {}).get("name") or ""


def armer_reason(conn: sqlite3.Connection, principal: Principal, door: dict[str, Any], dev_mode: bool) -> str | None:
    """Why this person may NOT put this door in an armed block (None: they may): an identified, active person, holding
    `access.doors.automate` on the door's station chain (deny wins) and passing the one door rule for that door."""
    if is_operator(principal) or not door_authority.identity_ok(principal, dev_mode, conn):
        return "identity"
    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if user is None or not user["active"]:
        return "user_inactive"
    if not authorize(conn, principal, AUTOMATE, (STATION, door["station_id"])).allowed:
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


def _require_manage(conn: sqlite3.Connection, principal: Principal, policy: dict[str, Any], action: str, block_id: str | None, rid: str | None) -> None:
    """Creating or editing a block: `access.doors.automate` somewhere, `automation.manage` at the installation (v1, fail closed)
    and `access.doors.automate` on every door's station chain."""
    _require_holder(conn, principal, action, block_id, rid)
    if not authorize(conn, principal, "automation.manage", INSTALLATION).allowed:
        _audit(conn, principal, action, "denied", block_id, "automation_manage", rid)
        raise forbidden(permission="automation.manage", target_type="installation", target_id="*")
    for d in policy["doors"]:
        if not authorize(conn, principal, AUTOMATE, (STATION, d["station_id"])).allowed:
            _audit(conn, principal, action, "denied", block_id, "automate_not_allowed", rid)
            raise forbidden(permission=AUTOMATE, reason="automate_not_allowed", door=door_name(d))


def _require_holder(conn: sqlite3.Connection, principal: Principal, action: str, block_id: str | None, rid: str | None) -> None:
    if not holds_anywhere(conn, principal):
        _audit(conn, principal, action, "denied", block_id, "no_binding", rid)
        raise forbidden(permission=AUTOMATE)


def create(conn: sqlite3.Connection, principal: Principal, item_id: str, name: Any, raw_policy: Any, rid: str | None = None) -> dict[str, Any]:
    _require_holder(conn, principal, "door_automation.create", None, rid)  # a caller without the permission learns nothing from validation
    policy = validate_policy(raw_policy)
    _require_manage(conn, principal, policy, "door_automation.create", None, rid)
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
    _require_manage(conn, principal, policy, "door_automation.update", row["id"], rid)
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
        why = armer_reason(conn, principal, d, dev_mode)
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
    until = at + dt.timedelta(days=int(policy["arm_days"]))
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


def set_feature(conn: sqlite3.Connection, principal: Principal, feature: Any, confirmed: Any, rid: str | None = None) -> dict[str, Any]:
    if is_operator(principal) or not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        _audit(conn, principal, "door_automation.settings", "denied", None, "no_binding", rid)
        raise forbidden(permission="system.configure")
    if feature not in ("on", "off"):
        raise _invalid(["feature"])
    if confirmed is not True:
        raise ApiError(409, "confirmation_required", "נדרש אישור מפורש.")
    if feature == "on" and not go_live_permitted():
        _audit(conn, principal, "door_automation.settings", "denied", None, "door_automation_not_permitted", rid, key=FLAG_KEY, requested="on")
        raise ApiError(409, "door_automation_not_permitted", "פתיחת דלתות מאוטומציות אינה זמינה בגרסה הזו.")
    set_setting(conn, FLAG_KEY, feature)
    _audit(conn, principal, "door_automation.settings", "allowed", None, None, rid, key=FLAG_KEY, value=feature)
    return status(conn, principal)


def status(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    admin = not is_operator(principal) and authorize(conn, principal, "system.configure", INSTALLATION).allowed
    holder = holds_anywhere(conn, principal)
    if not (admin or holder):
        return {"visible": False}
    return {"visible": True, "feature": feature_setting(conn), "go_live_permitted": go_live_permitted(), "available": enabled(conn), "killed": killed(conn),
            "can_manage": holder, "can_lift_kill": admin, "can_configure": admin}


def doors_for(conn: sqlite3.Connection, principal: Principal, *, dev_mode: bool) -> list[dict[str, Any]]:
    """The doors of the served WisKey copy on whose station the caller holds `access.doors.automate` (the editor's picker), each
    with `can_arm`: whether the caller could arm a block with it now (the door rule too). Names only, no hardware ids."""
    if not holds_anywhere(conn, principal):
        raise forbidden(permission=AUTOMATE)
    out: list[dict[str, Any]] = []
    for s in intercom_sync.SYNC.stations():
        if not authorize(conn, principal, AUTOMATE, (STATION, s["id"])).allowed:
            continue
        relays = intercom_doors.station_relays(s)
        for lock in s.get("locks") or []:
            relay = int(lock["physical_index"])
            if relay not in relays:
                continue
            door = {"station_id": s["id"], "relay": relay}
            label = s["name"] if len(relays) == 1 else f"{s['name']} · {lock.get('name') or relay}"
            out.append({**door, "name": label, "online": bool(s.get("online")), "can_arm": armer_reason(conn, principal, door, dev_mode) is None})
    return out


def fires(conn: sqlite3.Connection, row: sqlite3.Row, limit: int = 50) -> list[dict[str, Any]]:
    out = []
    for f in conn.execute("SELECT * FROM door_automation_fires WHERE automation_id = ? ORDER BY at DESC, rowid DESC LIMIT ?", (row["id"], limit)).fetchall():
        name = None
        if f["door_key"]:
            sid, _, relay = f["door_key"].rpartition("#")
            name = door_name({"station_id": sid, "relay": int(relay)}) or None
        out.append({"at": f["at"], "door": name, "attempted": bool(f["attempted"]), "outcome": f["outcome"], "reason": f["reason"], "code": f["code"]})
    return out


# ---------------------------------------------------------------- the fire path

def _trigger_of(source: Any, time_fired: Any) -> dict[str, Any]:
    text = source if isinstance(source, str) else ""
    text = "".join(ch for ch in text if ch.isprintable())[:SOURCE_MAX]
    return {"source": text, "time_fired": str(time_fired)[:40] if time_fired else None}


def _block_gates(conn: sqlite3.Connection, row: sqlite3.Row, at: dt.datetime, trigger: dict[str, Any], context_user: Any) -> list[tuple[str, bool, str | None]]:
    """The block-level gates in order: (gate, ok, refusal reason). Read only."""
    gates: list[tuple[str, bool, str | None]] = [("armed", row["state"] == "armed", None if row["state"] == "armed" else "not_armed")]
    gates.append(("feature", enabled(conn), None if enabled(conn) else "feature_off"))
    gates.append(("kill", not killed(conn), "killed" if killed(conn) else None))
    until = _parse(row["armed_until"])
    expired = row["state"] == "armed" and (until is None or at >= until)
    gates.append(("expiry", not expired, "arm_expired" if expired else None))
    manual = bool(context_user) or trigger.get("source", "").strip().lower() in MANUAL_SOURCES
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
    return gates


def _door_gate(conn: sqlite3.Connection, row: sqlite3.Row, door: dict[str, Any], at: dt.datetime, dev_mode: bool) -> str | None:
    """The per-door gates in order; the first refusal reason, or None (the door may be handed on). Read only."""
    s = station_of(door)
    if s is None or not s.get("online"):
        return "door_unavailable"
    if armer_reason(conn, _armer(row), door, dev_mode) is not None:
        return "armer_lost_authority"
    policy = policy_of(row)
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
    return None


def _auto_disarm(conn: sqlite3.Connection, row: sqlite3.Row, reason: str) -> None:
    _disarm(conn, row, reason, "system")
    _audit(conn, operator_of(row["id"], row["name"]), "door_automation.auto_disarm", "allowed", row["id"], reason, None, automation_item_id=row["automation_item_id"])


def _record_refusal(conn: sqlite3.Connection, row: sqlite3.Row, door: dict[str, Any] | None, reason: str, trigger: dict[str, Any], at: dt.datetime) -> None:
    conn.execute("INSERT INTO door_automation_fires(id, automation_id, door_key, at, attempted, outcome, reason) VALUES (?, ?, ?, ?, 0, 'refused', ?)",
                 (uuid.uuid4().hex, row["id"], door_key(door) if door else None, iso(at), reason))
    _audit(conn, operator_of(row["id"], row["name"]), "door_automation.fire", "denied", row["id"], reason, None, actor_kind="automation",
           automation_item_id=row["automation_item_id"], trigger=trigger, **({"station": door["station_id"], "relay": door["relay"]} if door else {}))
    if reason in DISARMING and row["state"] == "armed":
        _auto_disarm(conn, row, reason)
    elif reason in STORM_REASONS:
        n = conn.execute("SELECT COUNT(*) FROM door_automation_fires WHERE automation_id = ? AND reason IN (?, ?, ?) AND at > ?",
                         (row["id"], *STORM_REASONS, iso(at - dt.timedelta(seconds=STORM_WINDOW_S)))).fetchone()[0]
        if n >= STORM_REFUSALS:
            _auto_disarm(conn, row, "storm")


def _details(row: sqlite3.Row, door: dict[str, Any], trigger: dict[str, Any], request_id: str) -> dict[str, Any]:
    return {"command": "release", "actor_kind": "automation", "automation_id": row["id"], "automation_name": row["name"],
            "automation_item_id": row["automation_item_id"], "item_revision": row["bound_item_revision"], "policy_revision": row["policy_revision"],
            "trigger": trigger, "armed_by": row["armed_by"], "entry_point": ENTRY_POINT, "origin": f"automation:{row['automation_item_id']}",
            "transport": "automation", "door_request_id": request_id, "station": door["station_id"], "relay": door["relay"]}


def _fire_door(db: Database, block_id: str, door: dict[str, Any], trigger: dict[str, Any], dev_mode: bool) -> dict[str, Any]:
    name = door_name(door) or None
    with db.connection(label="door automation decide") as conn:
        row = get(conn, block_id)
        if row is None or row["state"] != "armed":
            return {"door": name, "outcome": "refused", "reason": "not_armed"}
        at = now()
        reason = _door_gate(conn, row, door, at, dev_mode)
        if reason is not None:
            _record_refusal(conn, row, door, reason, trigger, at)
            return {"door": name, "outcome": "refused", "reason": reason}
        request_id = str(uuid.uuid4())
        fire_id = uuid.uuid4().hex
        conn.execute("INSERT INTO door_automation_fires(id, automation_id, door_key, at, attempted, outcome, door_request_id) VALUES (?, ?, ?, ?, 1, 'pending', ?)",
                     (fire_id, block_id, door_key(door), iso(at), request_id))
        op = operator_of(row["id"], row["name"])
        details = _details(row, door, trigger, request_id)
        audit(conn, actor=op, action="intercom.release", decision="allowed", resource_type="intercom_station", resource_id=door["station_id"],
              details={**details, "phase": "attempt"}, under=_NOT_FROM_A_GRANT)
    # the attempt row is committed: no record, no command. The send runs outside any transaction.
    sender = SENDER if SENDER is not None else LiveSender()
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


def handle_item_event(db: Database, settings: Any, item_id: str, trigger: dict[str, Any], context_user: Any) -> list[dict[str, Any]]:
    """One run of the automation `item_id` reported by Home Assistant. Returns one entry per decision (tests, logs)."""
    dev_mode = bool(getattr(settings, "dev_user", None))
    with db.connection(label="door automation gates") as conn:
        row = by_item(conn, item_id)
        if row is None or row["state"] != "armed":
            return []
        at = now()
        refusal = next((reason for _gate, ok, reason in _block_gates(conn, row, at, trigger, context_user) if not ok), None)
        if refusal is not None:
            _record_refusal(conn, row, None, refusal, trigger, at)
            return [{"door": None, "outcome": "refused", "reason": refusal}]
        block_id, doors = row["id"], policy_of(row)["doors"]
    return [_fire_door(db, block_id, d, trigger, dev_mode) for d in doors]


def handle_trigger(db: Database, settings: Any, frame: Any) -> list[dict[str, Any]]:
    """An `automation_triggered` frame of the add-on's subscription -> the automation's block, if any."""
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
    return handle_item_event(db, settings, item_id, _trigger_of(data.get("source"), event.get("time_fired")), context.get("user_id"))


def on_event(db: Database | None, settings: Any, frame: Any) -> None:
    """The mirror's hook (services/automations.py). Never raises into the mirror and never runs on the WS loop."""
    if db is None:
        return

    def run() -> None:
        try:
            handle_trigger(db, settings, frame)
        except Exception:  # noqa: BLE001
            log.exception("door automation: an automation_triggered event could not be handled")

    try:
        if DISPATCH is not None:
            DISPATCH(run)
        else:
            threading.Thread(target=run, name="door-automation", daemon=True).start()
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
