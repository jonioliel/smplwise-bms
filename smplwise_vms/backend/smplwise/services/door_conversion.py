"""The "disable and list" run over the saved items that open a WisKey door (CR-033 6.4, owner decision 19; slices D10a = WXD10A
"Arx event door jobs (M1), disable-and-list" and D10b = WXD10B "hold-open program hand-over (M3)").

Owner go-ahead 2026-11-04: build both even though the lab inventory of that day (WXD7R) found NO item that opens a door - so an empty
inventory is the normal case and is answered cleanly (`state = nothing_found`, no action offered, nothing written).

What it does, in this order and never more:

1. LIST (read only, always available to the system administrator): every item of the D7 inventory (services/door_path.py), each with
   its category - `event_automation`, `schedule`, `script`, `unknown` (a step that cannot be resolved), plus `scene` / `launcher` - and
   the actions that are possible for it right now, each with its reason when it is not:
   - `disable` - an AUTONOMOUS item (an enabled automation or schedule: it fires on its own in the infrastructure) with a door step or
     a step that may be one, not made outside Arx: switched off through the EXISTING write path (services/automation_ops.set_enabled /
     services/schedule_ops.set_enabled, with every gate of those paths) and listed. This is the default of CR-033 6.4.
   - `convert_event_job` (M1, D10a) - an automation whose door steps are all DIRECT steps of the automation itself (no called script,
     scene, group), all resolved to mapped doors, each step's lock target WisKey doors only: its door steps are removed in Home Assistant
     (the existing code write path, `automation_ops.update_code`; removing a door step is always allowed by the editor block) and an Arx
     door job for the same doors is created - a CR-AUTODOORS-295 block in state `draft`. The job does nothing until a person arms it (a
     separate human step, the arming checks of CR-AUTODOORS-295) and while `doors.automation_open` is off.
   - `hand_over_program` (M3, D10b) - a RECURRING fixed schedule (repeat, no dates, no conditions, fixed start AND end times) whose
     every action is a direct door step: switched off through the existing write path and a draft weekly door window (CR-039, the
     hold-open program Arx writes to WisKey) with the same days and hours is created. The window is a `draft`: nothing is written to
     WisKey until a person enables it on the door windows screen (with `doors.windows.enabled` on and the engine's own checks).
   - nothing (`list_only`) - scripts, scenes and launcher buttons (they never run on their own; the run guard already refuses an
     Arx-started run, D9), disabled items, items made outside Arx (CR-033 6.4 / T16: never touched) and items whose only WisKey step
     is a `lock.lock` (it never works; listed by D6).
2. ACT on ONE item, only when ALL hold: the switch `doors.conversion` is `on` (default `off`; system administrator, confirmed, audited;
   a `doors.*` setting, so never carried by a backup), the caller is a system administrator (the route), the client sent
   `confirmed: true`, the item is in the current list with that action offered, its live revision is the one the administrator saw,
   and no earlier action on it is still in force. Every attempt is audited (`door.path_disabled`, `door.path_converted`,
   `door.path_handed_over`; refusals as `denied` rows with the code); a success writes one register row (table
   `door_path_conversions`, migration 0205).
3. UNDO one register row (same switch, administrator, confirmation, audit `door.path_restored`): a disable is reversed by enabling the
   item again through the existing write path - the one place the enable refusal of review I5 is lifted, for that item only, through
   `door_run_guard.restore_pass` - when its live revision is still the one recorded right after the disable; a hand-over by retiring
   its draft window (refused while the window is enabled: pause it first) and enabling the schedule again; a conversion by deleting its
   door job (disarming it if armed - the safe direction). The door steps a conversion removed are NOT put back by Arx: adding a door
   step is what the editor block refuses; they stay in the register row and in the automation's version history.

Never: a door, lock, relay or station command; a WisKey call (the hand-over writes only Arx's own tables; the conversion writes Home
Assistant through the bridge's config write, never a WisKey or door service); a retry or a queue; anything for an item made outside
Arx; an item's content changed by a disable."""
from __future__ import annotations

import copy
import datetime as dt
import json
import re
import sqlite3
import uuid
from typing import Any, Callable

from ..audit import audit
from ..db import get_setting, now_iso
from ..errors import ApiError
from ..rbac import Principal
from . import door_automation, door_path, door_run_guard, door_windows, intercom_sync, trusted_caller

FLAG_KEY = "doors.conversion"
FLAG_VALUES = ("off", "on")
ACTIONS = ("disable", "convert_event_job", "hand_over_program")
RECORD_ACTION = {"disable": "disabled", "convert_event_job": "converted", "hand_over_program": "handed_over"}
AUDIT_ACTION = {"disable": "door.path_disabled", "convert_event_job": "door.path_converted", "hand_over_program": "door.path_handed_over"}
RESTORED = "door.path_restored"
CONVERTIBLE_KINDS = ("automation", "schedule")
_CONTAINERS = ("choose", "default", "if", "then", "else", "parallel", "sequence", "repeat")
_HMS = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)(?::00)?$")
# the scheduler component's weekday tokens -> door window weekdays (0 = Sunday .. 6; `workday` / `weekend` as the component reads them
# for an Israeli installation: Sunday-Thursday / Friday-Saturday - tests/fake_scheduler.py, verified against the component)
_DAYS = {"sun": (0,), "mon": (1,), "tue": (2,), "wed": (3,), "thu": (4,), "fri": (5,), "sat": (6,),
         "daily": tuple(range(7)), "workday": (0, 1, 2, 3, 4), "weekend": (5, 6)}
DAY_TEXT = ("א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'")

CATEGORY_TEXT = {
    "event_automation": "אוטומציה שמופעלת מאירוע",
    "schedule": "תזמון",
    "script": "סקריפט",
    "scene": "סצנה",
    "launcher": "כפתור מהיר במסך הבית",
    "unknown": "פריט שלא ניתן לזהות בו את הדלתות",
}
ACTION_TEXT = {
    "disable": "השבתה ורישום",
    "convert_event_job": "הסבה למשימת דלת של Arx",
    "hand_over_program": "העברה לחלון פתיחה קבוע",
}
STATE_TEXT = {
    "no_wiskey": "אין במערכת דלתות של בקרת הכניסה - אין מה לבדוק.",
    "nothing_found": "לא נמצאו פריטים שפותחים דלת. אין מה להשבית או להסב.",
    "items": "",
}
# why an action is not offered (the screen shows the text, never the code)
UNAVAILABLE_TEXT = {
    "external": "נוצר מחוץ למערכת - לא מטופל ב-Arx",
    "not_autonomous": "הפריט אינו פועל לבד",
    "not_enabled": "הפריט כבר כבוי",
    "gone": "הפריט כבר לא קיים",
    "no_door": "אין בפריט פתיחת דלת",
    "unresolvable": "לא ניתן לזהות את הדלתות בפריט",
    "kind": "פעולה זו אינה מתאימה לסוג הפריט",
    "door_step_in_called_item": "פתיחת הדלת נמצאת בפריט אחר שהפריט מפעיל",
    "mixed_target": "שלב הפתיחה פועל גם על מנעולים אחרים",
    "empty_branch": "הסרת שלב הדלת תשאיר ענף ריק",
    "empty_actions": "בלי שלב הדלת לא נשאר בפריט דבר - עדיף להשבית",
    "door_step_remains": "גם אחרי ההסרה נשארת בפריט פתיחת דלת",
    "unreadable": "תוכן הפריט אינו קריא",
    "too_many_doors": "יותר מדי דלתות למשימה אחת",
    "door_job_exists": "לאוטומציה כבר יש משימת דלת",
    "intercom_unavailable": "אין כרגע נתונים עדכניים ממערכת האינטרקום",
    "door_unknown": "אחת הדלתות אינה קיימת במערכת האינטרקום",
    "not_recurring": "התזמון אינו חוזר",
    "date_limited": "התזמון מוגבל בתאריכים",
    "has_conditions": "לתזמון יש תנאים",
    "weekdays_unknown": "ימי התזמון אינם מוכרים",
    "time_not_fixed": "שעת התזמון אינה שעה קבועה",
    "no_end_time": "לתזמון אין שעת סיום - חלון פתיחה צריך שעת סיום",
    "mixed_schedule": "בתזמון יש גם פעולות אחרות",
    "window_too_long": "החלון ארוך מהמותר לחלון פתיחה",
    "quiet_hours": "החלון נוגע בשעות השקטות",
    "overlap": "שני חלונות חופפים באותו יום",
    "too_many_per_day": "יותר מדי חלונות ביום אחד",
    "invalid_time": "שעה לא תקינה לחלון פתיחה",
    "invalid_name": "שם התזמון אינו מתאים לשם חלון",
    "exterior_not_allowed": "דלת חיצונית אינה יכולה להיות בחלון פתיחה",
    "handled": "כבר טופל - אפשר לבטל את הפעולה הקודמת",
    "invalid": "הפריט אינו מתאים",
}


# ================================================================ the switch

def mode(conn: sqlite3.Connection) -> str:
    """`on` only when the setting says exactly `on`; absent, garbage or anything else is `off` (fail closed)."""
    return "on" if (get_setting(conn, FLAG_KEY) or "off") == "on" else "off"


# ================================================================ M1: removing the direct door steps of an automation

def _service(step: dict[str, Any]) -> str:
    svc = step.get("action", step.get("service"))
    return svc.strip().lower() if isinstance(svc, str) else ""


def _leaf(step: dict[str, Any]) -> dict[str, Any] | None:
    """The step without its containers (what the resolver judges as ONE step), or None when it is only a container."""
    has_call = bool({"action", "service", "service_template"} & set(step)) or "scene" in step or ("device_id" in step and "domain" in step and "type" in step)
    if not has_call:
        return None
    return {k: v for k, v in step.items() if k not in _CONTAINERS or (k == "sequence" and {"action", "service"} & set(step))}


def leaf_problem(r: door_path.Resolver, step: dict[str, Any]) -> tuple[bool, str | None]:
    """(is a door step, why it cannot simply be removed). A removable door step opens WisKey doors by itself (no called item, no
    lock group), every door known, and - for `lock.unlock` / `lock.open` - every lock it targets is a WisKey door (removing it must
    not stop it unlocking an ordinary lock)."""
    rs = r.resolve_actions([step], "s")
    if not (rs.door_steps or rs.unresolved):
        return False, None
    if rs.unresolved or any(s.problem for s in rs.door_steps):
        return True, "unresolvable"
    if any(s.via for s in rs.door_steps):
        return True, "door_step_in_called_item"
    if _service(step) in door_path.OPEN_SERVICES:
        t = r._targets(step)
        if t.all_entities or any(not r.is_wiskey(e) for e in r._of_domain(t, "lock")):
            return True, "mixed_target"
    return True, None


class _Strip:
    def __init__(self, r: door_path.Resolver) -> None:
        self.r = r
        self.problems: list[str] = []
        self.removed: list[dict[str, Any]] = []

    def branch(self, steps: Any) -> Any:
        if steps is None:
            return None
        single = isinstance(steps, dict)
        items = [steps] if single else steps
        if not isinstance(items, list):
            return steps
        out = self.steps(items)
        if items and not out:
            self.problems.append("empty_branch")
        return out[0] if single and len(out) == 1 else out

    def steps(self, items: list[Any]) -> list[Any]:
        out: list[Any] = []
        for s in items:
            if not isinstance(s, dict) or s.get("enabled") is False:
                out.append(s)
                continue
            s = dict(s)
            if "choose" in s:
                options = s["choose"] if isinstance(s["choose"], list) else [s["choose"]]
                new_opts = []
                for opt in options:
                    if isinstance(opt, dict) and "sequence" in opt:
                        opt = {**opt, "sequence": self.branch(opt["sequence"])}
                    new_opts.append(opt)
                s["choose"] = new_opts if isinstance(s["choose"], list) else new_opts[0]
                if "default" in s:
                    s["default"] = self.branch(s["default"])
            if "if" in s:
                for key in ("then", "else"):
                    if key in s:
                        s[key] = self.branch(s[key])
            if "parallel" in s:
                branches = s["parallel"] if isinstance(s["parallel"], list) else [s["parallel"]]
                kept = []
                for b in branches:
                    if isinstance(b, dict) and "sequence" in b and not ({"action", "service"} & set(b)):
                        kept.append({**b, "sequence": self.branch(b["sequence"])})
                    else:
                        one = self.steps([b])
                        kept.extend(one)
                if branches and not kept:
                    self.problems.append("empty_branch")
                s["parallel"] = kept if isinstance(s["parallel"], list) else (kept[0] if kept else kept)
            if "sequence" in s and not ({"action", "service"} & set(s)):
                s["sequence"] = self.branch(s["sequence"])
            if isinstance(s.get("repeat"), dict) and "sequence" in s["repeat"]:
                s["repeat"] = {**s["repeat"], "sequence": self.branch(s["repeat"]["sequence"])}
            leaf = _leaf(s)
            if leaf is not None:
                is_door, problem = leaf_problem(self.r, leaf)
                if problem:
                    self.problems.append(problem)
                if is_door and not problem:
                    self.removed.append(copy.deepcopy(s))
                    continue
            out.append(s)
        return out


def strip_door_steps(conn: sqlite3.Connection, cfg: dict[str, Any]) -> tuple[dict[str, Any] | None, list[dict[str, Any]], str | None]:
    """(the automation's configuration without its direct door steps, the steps removed, the first reason it cannot be done). The
    result is verified by resolving it again with a fresh resolver: a door step left anywhere refuses the conversion."""
    key = "actions" if "actions" in cfg else ("action" if "action" in cfg else None)
    if key is None:
        return None, [], "unreadable"
    st = _Strip(door_path.Resolver(conn))
    actions = cfg[key]
    items = [actions] if isinstance(actions, dict) else actions
    if not isinstance(items, list):
        return None, [], "unreadable"
    kept = st.steps(items)
    if st.problems:
        return None, [], st.problems[0]
    if not st.removed:
        return None, [], "no_door"
    if not kept:
        return None, [], "empty_actions"
    new_cfg = {**copy.deepcopy(cfg), key: kept}
    again = door_path.Resolver(conn).resolve_config("automation", new_cfg)
    if again.has_door:
        return None, [], "door_step_remains"
    return new_cfg, st.removed, None


def _door_job_name(alias: str) -> str:
    name = (alias or "").strip()[:80]
    return name if name and trusted_caller.text_ok(name) else "משימת דלת"


def event_job_plan(conn: sqlite3.Connection, item_id: str) -> dict[str, Any]:
    """M1 preview for one automation: {available, reason, doors, removed_steps, config (internal), name}."""
    r = door_path.Resolver(conn)
    res, row = r.resolve_item("automation", item_id)
    out: dict[str, Any] = {"available": False, "reason": None, "doors": [], "removed_steps": 0}
    if row is None:
        out["reason"] = "gone"
        return out
    if not res.has_door:
        out["reason"] = "no_door"
        return out
    if not res.resolvable:
        out["reason"] = "unresolvable"
        return out
    doors = res.doors()
    out["doors"] = [{"station_id": s, "relay": relay} for s, relay in doors]
    if len(doors) > door_automation.MAX_DOORS:
        out["reason"] = "too_many_doors"
        return out
    cfg = door_path._config(row)
    if cfg is None:
        out["reason"] = "unreadable"
        return out
    new_cfg, removed, problem = strip_door_steps(conn, cfg)
    if problem:
        out["reason"] = problem
        return out
    if door_automation.by_item(conn, item_id) is not None:
        out["reason"] = "door_job_exists"
        return out
    if not intercom_sync.SYNC.has_copy():
        out["reason"] = "intercom_unavailable"
        return out
    if any(door_automation.station_of(d) is None for d in out["doors"]):
        out["reason"] = "door_unknown"
        return out
    out.update(available=True, removed_steps=len(removed), config=new_cfg, removed=removed, name=_door_job_name(str(cfg.get("alias") or "")))
    return out


# ================================================================ M3: a recurring fixed schedule -> a weekly door window

def _slot_steps(slot: Any) -> list[dict[str, Any]]:
    """A scheduler slot's actions as Home Assistant steps - the same shape door_path.resolve_schedule_slots judges."""
    steps = []
    for a in (slot.get("actions") if isinstance(slot, dict) and isinstance(slot.get("actions"), list) else []):
        if not isinstance(a, dict):
            steps.append({})
            continue
        step: dict[str, Any] = {"action": a.get("service")}
        if a.get("entity_id") is not None:
            step["entity_id"] = a.get("entity_id")
        if a.get("service_data") is not None:
            step["data"] = a["service_data"]
        steps.append(step)
    return steps


def _hm(raw: Any) -> str | None:
    m = _HMS.match(raw) if isinstance(raw, str) else None
    return f"{m.group(1)}:{m.group(2)}" if m else None


def program_plan(conn: sqlite3.Connection, schedule_id: str, *, today: dt.date | None = None) -> dict[str, Any]:
    """M3 preview for one schedule: {available, reason, program: {name, days, periods, doors}, body (internal)}."""
    out: dict[str, Any] = {"available": False, "reason": None, "program": None}
    row = conn.execute("SELECT schedule_id, item_json FROM schedule_cache WHERE schedule_id = ?", (schedule_id,)).fetchone()
    try:
        item = json.loads(row["item_json"] or "{}") if row is not None else None
    except ValueError:
        item = None
    if row is None or not isinstance(item, dict):
        out["reason"] = "gone" if row is None else "unreadable"
        return out
    r = door_path.Resolver(conn)
    res = r.resolve_schedule_slots(item)
    if not res.has_door:
        out["reason"] = "no_door"
        return out
    if not res.resolvable:
        out["reason"] = "unresolvable"
        return out
    if str(item.get("repeat_type") or "repeat") != "repeat":
        out["reason"] = "not_recurring"
        return out
    if item.get("start_date") or item.get("end_date"):
        out["reason"] = "date_limited"
        return out
    tokens = item.get("weekdays") or ["daily"]
    if not isinstance(tokens, list) or any(t not in _DAYS for t in tokens):
        out["reason"] = "weekdays_unknown"
        return out
    days = sorted({d for t in tokens for d in _DAYS[t]})
    periods: list[dict[str, Any]] = []
    for slot in item.get("timeslots") or []:
        if not isinstance(slot, dict):
            out["reason"] = "unreadable"
            return out
        if slot.get("conditions"):
            out["reason"] = "has_conditions"
            return out
        steps = _slot_steps(slot)
        for step in steps:
            is_door, problem = leaf_problem(r, step) if step else (False, None)
            if problem:
                out["reason"] = problem
                return out
            if not is_door:
                out["reason"] = "mixed_schedule"
                return out
        if not steps:
            continue
        start, raw_stop = _hm(slot.get("start")), slot.get("stop")
        if start is None:
            out["reason"] = "time_not_fixed"
            return out
        if raw_stop in (None, ""):
            out["reason"] = "no_end_time"
            return out
        end = _hm(raw_stop)
        if end is None:
            out["reason"] = "time_not_fixed"
            return out
        end = "24:00" if end == "00:00" else end
        periods.extend({"weekday": d, "start": start, "end": end} for d in days)
    doors = res.doors()
    name = str(item.get("name") or "").strip()[: door_windows.NAME_MAX] or "חלון פתיחה"
    body = {"name": name, "kind": "weekly", "calendar_policy": "ignore_calendar", "notes": "הועבר מתזמון שפתח את הדלת",
            "doors": [{"station_id": s, "relay": relay} for s, relay in doors], "periods": periods}
    quiet = (door_windows.setting(conn, "doors.windows.quiet_from"), door_windows.setting(conn, "doors.windows.quiet_to"))
    try:
        door_windows.validate_rule(body, max_hours=door_windows.int_setting(conn, "doors.windows.max_hours"),
                                   max_per_day=door_windows.int_setting(conn, "doors.windows.max_per_day_per_door"), quiet=quiet, today=today or dt.date.today())
    except ApiError as exc:
        out["reason"] = exc.code if exc.code in UNAVAILABLE_TEXT else "invalid"
        return out
    known = door_windows.doors_by_key(conn)
    if any(door_windows.door_key(s, relay) not in known for s, relay in doors):
        out["reason"] = "door_unknown" if intercom_sync.SYNC.has_copy() else "intercom_unavailable"
        return out
    if door_windows.setting(conn, "doors.windows.exterior_allowed") != "true":
        ext = door_windows.exterior_doors(conn)
        if any(door_windows.door_key(s, relay) in ext for s, relay in doors):
            out["reason"] = "exterior_not_allowed"
            return out
    spans = sorted({(p["start"], p["end"]) for p in periods})
    out.update(available=True, body=body, program={
        "name": name, "days": days, "days_text": " ".join(DAY_TEXT[d] for d in days),
        "periods": [{"start": a, "end": b} for a, b in spans],
        "doors": [known[door_windows.door_key(s, relay)].label for s, relay in doors],
    })
    return out


# ================================================================ the list

def _category(item: dict[str, Any]) -> str:
    if not item["resolvable"] and (item["door_steps"] or item["unresolved"]):
        return "unknown"
    return {"automation": "event_automation", "schedule": "schedule", "script": "script", "scene": "scene", "launcher": "launcher"}.get(item["kind"], "unknown")


def _split_key(key: str) -> tuple[str, str]:
    kind, _, item_id = key.partition(":")
    return kind, item_id


def active_records(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    return {r["item_key"]: r for r in conn.execute("SELECT * FROM door_path_conversions WHERE state = 'done'")}


def _offer(conn: sqlite3.Connection, item: dict[str, Any], handled: bool) -> dict[str, dict[str, Any]]:
    """For each action: {available, reason, reason_text} (+ the M1 / M3 preview where it applies)."""
    kind, item_id = _split_key(item["key"])
    has_door = bool(item["door_steps"] or item["unresolved"])

    def no(reason: str) -> dict[str, Any]:
        return {"available": False, "reason": reason, "reason_text": UNAVAILABLE_TEXT.get(reason, UNAVAILABLE_TEXT["invalid"])}

    common: str | None = None
    if kind not in CONVERTIBLE_KINDS:
        common = "not_autonomous"
    elif item["origin"] == "external":
        common = "external"
    elif item["state"] == "gone":
        common = "gone"
    elif handled:
        common = "handled"
    elif not has_door:
        common = "no_door"
    offers: dict[str, dict[str, Any]] = {}
    if common:
        return {a: no(common) for a in ACTIONS}
    offers["disable"] = {"available": True, "reason": None, "reason_text": ""} if item["autonomous"] else no("not_enabled")
    if kind == "automation":
        plan = event_job_plan(conn, item_id)
        offers["convert_event_job"] = ({"available": True, "reason": None, "reason_text": "", "doors": item["doors"], "removed_steps": plan["removed_steps"]}
                                       if plan["available"] else no(plan["reason"] or "invalid"))
        offers["hand_over_program"] = no("kind")
    else:
        offers["convert_event_job"] = no("kind")
        plan = program_plan(conn, item_id)
        offers["hand_over_program"] = ({"available": True, "reason": None, "reason_text": "", "program": plan["program"]}
                                       if plan["available"] else no(plan["reason"] or "invalid"))
    return offers


def _record_view(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "item_key": r["item_key"], "kind": r["item_kind"], "name": r["item_name"], "action": r["action"], "state": r["state"],
            "door_job_id": r["door_job_id"], "program_rule_id": r["program_rule_id"], "doors": len(json.loads(r["doors_json"] or "[]")),
            "done_by": r["done_by_name"] or r["done_by"], "done_at": r["done_at"], "undone_by": r["undone_by_name"] or r["undone_by"], "undone_at": r["undone_at"]}


def listing(conn: sqlite3.Connection, *, dev_mode: bool = False) -> dict[str, Any]:
    """Read only. The inventory with what may be done to each item, the register, and the switch. Names only (as the inventory)."""
    inv = door_path.inventory(conn, dev_mode=dev_mode)
    active = active_records(conn)
    items = []
    for it in inv["items"]:
        offers = _offer(conn, it, it["key"] in active)
        rec = active.get(it["key"])
        items.append({
            "key": it["key"], "kind": it["kind"], "name": it["name"], "category": _category(it), "category_text": CATEGORY_TEXT[_category(it)],
            "origin": it["origin"], "origin_text": it["origin_text"], "state": it["state"], "autonomous": it["autonomous"], "revision": it["revision"],
            "door_steps": it["door_steps"], "doors": it["doors"], "resolvable": it["resolvable"], "unresolved": it["unresolved"],
            "disable_required": it["disable_required"], "approver_text": it["approver_text"], "run_guard_text": it["run_guard_text"],
            "actions": offers, "offered": [a for a in ACTIONS if offers[a]["available"]], "record": _record_view(rec) if rec is not None else None,
        })
    records = [_record_view(r) for r in conn.execute("SELECT * FROM door_path_conversions ORDER BY done_at DESC, id LIMIT 200")]
    state = "no_wiskey" if not inv["wiskey_present"] else ("nothing_found" if not items else "items")
    counts = {
        "items": len(items),
        "disable": sum(1 for i in items if "disable" in i["offered"]),
        "convert_event_job": sum(1 for i in items if "convert_event_job" in i["offered"]),
        "hand_over_program": sum(1 for i in items if "hand_over_program" in i["offered"]),
        "list_only": sum(1 for i in items if not i["offered"]),
        "disable_required": sum(1 for i in items if i["disable_required"]),
        "handled": len(active),
    }
    return {"switch": mode(conn), "state": state, "state_text": STATE_TEXT[state], "wiskey_present": inv["wiskey_present"], "generated_at": inv["generated_at"],
            "counts": counts, "items": items, "records": records}


# ================================================================ acting on one item

AutoWriter = Callable[[], Any]  # -> services.automation_ops.W of the request
SchedWriter = Callable[[], Any]  # -> services.schedule_ops.W of the request


def _who(principal: Principal) -> str:
    return principal.display_name or principal.username or principal.user_id


def _deny(conn: sqlite3.Connection, principal: Principal, action: str, key: str | None, err: ApiError, rid: str | None, **details: Any) -> ApiError:
    audit(conn, actor=principal, action=action, decision="denied", resource_type="door_path_item", resource_id=key, reason=err.code, request_id=rid,
          details={**details, "status": err.status} or None)
    return err


def _crid() -> str:
    return f"wxd10-{uuid.uuid4().hex[:16]}"


def _live_revision(conn: sqlite3.Connection, kind: str, item_id: str) -> str | None:
    if kind == "automation":
        row = conn.execute("SELECT revision FROM ha_config_items WHERE kind = 'automation' AND item_id = ?", (item_id,)).fetchone()
    else:
        row = conn.execute("SELECT revision FROM schedule_cache WHERE schedule_id = ?", (item_id,)).fetchone()
    return row["revision"] if row is not None else None


def _set_enabled(kind: str, item_id: str, enable: bool, auto_writer: AutoWriter, sched_writer: SchedWriter) -> None:
    """The EXISTING write path, with every gate of it (rights, feature switch, bridge state, the enable refusal), never a shortcut."""
    if kind == "automation":
        from . import automation_ops

        automation_ops.set_enabled(auto_writer(), item_id, enable, True, _crid())
    else:
        from . import schedule_ops

        schedule_ops.set_enabled(sched_writer(), item_id, enable, _crid(), True, None)


def _gate(conn: sqlite3.Connection, principal: Principal, audit_action: str, key: str | None, confirmed: Any, rid: str | None) -> None:
    if confirmed is not True:
        raise _deny(conn, principal, audit_action, key, ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש."), rid)
    if mode(conn) != "on":
        raise _deny(conn, principal, audit_action, key, ApiError(409, "door_conversion_off", "השבתה והסבה של פריטים שפותחים דלתות כבויה בהגדרות."), rid)


def act(conn: sqlite3.Connection, principal: Principal, *, key: str, action: str, revision: str | None, confirmed: Any, dev_mode: bool,
        auto_writer: AutoWriter, sched_writer: SchedWriter, rid: str | None = None) -> dict[str, Any]:
    """One confirmed action on one listed item (module docstring, step 2). The caller (the route) checked `system.configure`."""
    if action not in ACTIONS:
        raise ApiError(422, "validation", "פעולה לא מוכרת.")
    audit_action = AUDIT_ACTION[action]
    _gate(conn, principal, audit_action, key, confirmed, rid)
    view = listing(conn, dev_mode=dev_mode)
    item = next((i for i in view["items"] if i["key"] == key), None)
    if item is None:
        raise _deny(conn, principal, audit_action, key, ApiError(404, "not_listed", "הפריט אינו ברשימת הפריטים שפותחים דלתות."), rid)
    if item["record"] is not None:
        raise _deny(conn, principal, audit_action, key, ApiError(409, "already_handled", UNAVAILABLE_TEXT["handled"]), rid)
    if revision != item["revision"]:
        raise _deny(conn, principal, audit_action, key, ApiError(409, "stale_revision", "הפריט השתנה מאז שהרשימה הוצגה - יש לטעון אותה מחדש."), rid)
    offer = item["actions"][action]
    if not offer["available"]:
        raise _deny(conn, principal, audit_action, key, ApiError(409, "action_not_offered", offer["reason_text"], details={"reason": offer["reason"]}), rid,
                    why=offer["reason"])
    kind, item_id = _split_key(key)
    record: dict[str, Any] = {"was_enabled": 1 if item["autonomous"] else 0, "door_job_id": None, "program_rule_id": None, "removed": None, "doors": []}
    try:
        if action == "disable":
            _set_enabled(kind, item_id, False, auto_writer, sched_writer)
        elif action == "convert_event_job":
            record.update(_convert(conn, principal, item_id, auto_writer, rid))
        else:
            record.update(_hand_over(conn, principal, item_id, item["autonomous"], dev_mode, auto_writer, sched_writer))
    except ApiError as exc:
        raise _deny(conn, principal, audit_action, key, exc, rid, step="write")
    after = _live_revision(conn, kind, item_id)
    rec_id = "dpc_" + uuid.uuid4().hex
    conn.execute("""INSERT INTO door_path_conversions(id, item_key, item_kind, item_id, item_name, action, state, was_enabled, revision_before, revision_after,
                    door_job_id, program_rule_id, removed_steps_json, doors_json, done_by, done_by_name, done_at)
                    VALUES (?,?,?,?,?,?, 'done', ?,?,?,?,?,?,?,?,?,?)""",
                 (rec_id, key, kind, item_id, item["name"], RECORD_ACTION[action], record["was_enabled"], item["revision"], after, record["door_job_id"],
                  record["program_rule_id"], json.dumps(record["removed"], ensure_ascii=False) if record["removed"] is not None else None,
                  json.dumps(record["doors"]), principal.user_id, _who(principal), now_iso()))
    audit(conn, actor=principal, action=audit_action, decision="allowed", resource_type="door_path_item", resource_id=key, request_id=rid,
          details={"record_id": rec_id, "kind": kind, "revision_before": item["revision"], "revision_after": after, "was_enabled": bool(record["was_enabled"]),
                   "door_steps": item["door_steps"], "doors": len(record["doors"]) or len(item["doors"]),
                   **({"door_job_id": record["door_job_id"]} if record["door_job_id"] else {}),
                   **({"program_rule_id": record["program_rule_id"]} if record["program_rule_id"] else {}),
                   **({"removed_steps": len(record["removed"])} if record["removed"] is not None else {})})
    row = conn.execute("SELECT * FROM door_path_conversions WHERE id = ?", (rec_id,)).fetchone()
    return {"record": _record_view(row), "changed": True}


def _convert(conn: sqlite3.Connection, principal: Principal, item_id: str, auto_writer: AutoWriter, rid: str | None) -> dict[str, Any]:
    """M1: everything checked first (the door job's own create rules included), then the Home Assistant write, then the draft job."""
    from . import automation_ops

    plan = event_job_plan(conn, item_id)
    if not plan["available"]:
        raise ApiError(409, "action_not_offered", UNAVAILABLE_TEXT.get(plan["reason"] or "invalid", UNAVAILABLE_TEXT["invalid"]), details={"reason": plan["reason"]})
    policy = door_automation.validate_policy({"doors": plan["doors"]})
    door_automation._require_manage(conn, principal, policy, "door_automation.create", None, rid, item_id)
    door_automation.require_doors_known(policy)
    base = _live_revision(conn, "automation", item_id)
    automation_ops.update_code(auto_writer(), "automation", item_id, plan["config"], base or "", True, _crid())
    job = door_automation.create(conn, principal, item_id, plan["name"], policy, rid)
    return {"door_job_id": job["id"], "removed": plan["removed"], "doors": [[d["station_id"], d["relay"]] for d in plan["doors"]]}


def _hand_over(conn: sqlite3.Connection, principal: Principal, schedule_id: str, enabled: bool, dev_mode: bool, auto_writer: AutoWriter,
               sched_writer: SchedWriter) -> dict[str, Any]:
    """M3: everything checked first (the door window's own rules and rights included), then the schedule switched off through the
    existing write path, then the draft window (Arx's own tables only - nothing reaches WisKey before a person enables it)."""
    plan = program_plan(conn, schedule_id)
    if not plan["available"]:
        raise ApiError(409, "action_not_offered", UNAVAILABLE_TEXT.get(plan["reason"] or "invalid", UNAVAILABLE_TEXT["invalid"]), details={"reason": plan["reason"]})
    body = plan["body"]
    door_windows.require_person(conn, principal, "door_window.rule.create", dev_mode=dev_mode)
    keys = [(d["station_id"], d["relay"]) for d in body["doors"]]
    door_windows.require_doors(conn, principal, keys, door_windows.MANAGE, "door_window.rule.create")
    if enabled:
        _set_enabled("schedule", schedule_id, False, auto_writer, sched_writer)
    rule_id = door_windows.save_rule(conn, principal, body, today=dt.date.today())
    audit(conn, actor=principal, action="door_window.rule.create", decision="allowed", resource_type="door_window_rule", resource_id=rule_id,
          details={"via": "door_path_hand_over", "schedule_id": schedule_id, "doors": len(keys), "state": "draft"})
    return {"program_rule_id": rule_id, "doors": [list(k) for k in keys]}


# ================================================================ undo

def undo(conn: sqlite3.Connection, principal: Principal, record_id: str, *, confirmed: Any, auto_writer: AutoWriter, sched_writer: SchedWriter,
         rid: str | None = None) -> dict[str, Any]:
    """Reverse one register row (module docstring, step 3). The caller (the route) checked `system.configure`."""
    _gate(conn, principal, RESTORED, record_id, confirmed, rid)
    row = conn.execute("SELECT * FROM door_path_conversions WHERE id = ?", (record_id,)).fetchone()
    if row is None:
        raise _deny(conn, principal, RESTORED, record_id, ApiError(404, "not_found", "הרישום לא נמצא."), rid)
    if row["state"] != "done":
        raise _deny(conn, principal, RESTORED, record_id, ApiError(409, "already_undone", "הפעולה כבר בוטלה."), rid)
    kind, item_id, action = row["item_kind"], row["item_id"], row["action"]
    re_enabled = False
    try:
        if action in ("disabled", "handed_over") and row["was_enabled"]:
            live = _live_revision(conn, kind, item_id)
            if live is None:
                raise ApiError(409, "item_gone", "הפריט כבר לא קיים.")
            if live != row["revision_after"]:
                raise ApiError(409, "stale_revision", "הפריט השתנה מאז ההשבתה - אי אפשר להחזיר אותו אוטומטית.")
            rule = door_windows.rule_row(conn, row["program_rule_id"]) if action == "handed_over" and row["program_rule_id"] else None
            if rule is not None and rule["state"] == "enabled":
                raise ApiError(409, "program_in_use", "חלון הפתיחה שנוצר פעיל - יש להשהות אותו קודם.")
            if not _is_enabled(conn, kind, item_id):
                with door_run_guard.restore_pass(kind, item_id):
                    _set_enabled(kind, item_id, True, auto_writer, sched_writer)
                re_enabled = True
        if action == "handed_over" and row["program_rule_id"]:
            rule = door_windows.rule_row(conn, row["program_rule_id"])
            if rule is not None and rule["state"] == "enabled":
                raise ApiError(409, "program_in_use", "חלון הפתיחה שנוצר פעיל - יש להשהות אותו קודם.")
            if rule is not None and rule["state"] != "retired":
                door_windows.set_rule_state(conn, principal, row["program_rule_id"], "retired")
        if action == "converted" and row["door_job_id"]:
            job = door_automation.get(conn, row["door_job_id"])
            if job is not None:
                door_automation.delete(conn, principal, job, rid)
    except ApiError as exc:
        raise _deny(conn, principal, RESTORED, row["item_key"], exc, rid, record_id=record_id)
    at = now_iso()
    conn.execute("UPDATE door_path_conversions SET state = 'undone', undone_by = ?, undone_by_name = ?, undone_at = ? WHERE id = ?",
                 (principal.user_id, _who(principal), at, record_id))
    audit(conn, actor=principal, action=RESTORED, decision="allowed", resource_type="door_path_item", resource_id=row["item_key"], request_id=rid,
          details={"record_id": record_id, "undone": action, "re_enabled": re_enabled, "ha_steps_restored": False if action == "converted" else None})
    out = conn.execute("SELECT * FROM door_path_conversions WHERE id = ?", (record_id,)).fetchone()
    return {"record": _record_view(out), "re_enabled": re_enabled, "ha_steps_restored": False if action == "converted" else None}


def _is_enabled(conn: sqlite3.Connection, kind: str, item_id: str) -> bool:
    if kind == "schedule":
        row = conn.execute("SELECT enabled FROM schedule_cache WHERE schedule_id = ?", (item_id,)).fetchone()
        return bool(row and row["enabled"])
    row = conn.execute("SELECT h.state FROM ha_config_items i JOIN ha_entities h ON h.entity_id = i.entity_id WHERE i.kind = 'automation' AND i.item_id = ?",
                       (item_id,)).fetchone()
    return bool(row and row["state"] == "on")
