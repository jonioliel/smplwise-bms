"""CALENDARS-298 - vocabulary, limits, validation and the settings document of the calendars module (contract sections 3, 7, 8, 11)."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ...db import get_setting

PERM_VIEW, PERM_BOOK, PERM_BOOK_FOR_OTHERS, PERM_MANAGE = "calendar.view", "calendar.book", "calendar.book_for_others", "calendar.manage"
PERM_MAINTENANCE, PERM_GUESTS, PERM_CONFIGURE, PERM_CONNECT = "calendar.maintenance", "calendar.guests", "calendar.configure", "calendar.connect"
ALL_PERMS = (PERM_VIEW, PERM_BOOK, PERM_BOOK_FOR_OTHERS, PERM_MANAGE, PERM_MAINTENANCE, PERM_GUESTS, PERM_CONFIGURE, PERM_CONNECT)

TYPES = ("room", "team", "maintenance", "event")
COLORS = ("blue", "rose", "cyan", "orange", "violet", "brown", "magenta", "slate")  # no green: green is status only
EQUIPMENT = ("screen", "projector", "video_call", "whiteboard", "kitchen", "accessible")
ROLES = ("view", "book", "edit", "manage")
ROLE_RANK = {r: i for i, r in enumerate(ROLES)}
SUBJECT_KINDS = ("user", "role", "department", "everyone")
OVERLAP_MODES = ("first_holds", "override_notify", "block", "ask")
HOURS_MODES = ("always", "working_hours", "custom")
HOLIDAY_RULES = ("ignore", "closed", "warn")
APPROVAL_MODES = ("none", "always", "outside_hours", "on_behalf")
VISIBILITIES = ("members", "busy_to_all", "details_to_all")
ON_BEHALF = ("self", "team", "class", "customer", "department", "vendor")
KINDS_USER = ("booking", "event")
STEPS = (5, 10, 15, 30, 60)
OPEN_STATES = ("pending", "confirmed")  # states that still occupy / request a slot
MAX_GUESTS = 20

SETTINGS_KEY = "calendar.settings"
SETTINGS_DEFAULTS: dict[str, Any] = {
    "enabled": False,
    "maintenance_overlap": "first_holds",  # C3
    "contested_requests": "queue",  # C2: queue | reject
    "pending_holds_slot": False,  # C2
    "menu_position": "a",  # C5: a | b
    "holiday_eve_as_holiday": False,  # C6
    "guest_details_enabled": True,
    "guest_details_kinds": ["customer", "class"],
    "guest_retention_days": 30,  # C4: 0-3650
    "editors_bypass_approval": True,
    "default_room_buffer_after_min": 10,
    "series_horizon_days": 400,
    "max_calendars": 500,
    "automation_late_grace_min": 5,
    "ticket_visit_calendar_by_department": {},
    "maintenance_task_calendar": None,
    "notify_confirmations": False,
    "feeds_enabled": False,
    "default_hours": {"weekdays": [7, 1, 2, 3, 4], "start": "07:00", "end": "19:00"},  # stand-in for the SLACAL working-hours calendar (phase 3)
}


class Invalid(ValueError):
    def __init__(self, message: str, field: str = "", code: str = "validation") -> None:
        super().__init__(message)
        self.field = field
        self.code = code


def _int(v: Any, field: str, lo: int, hi: int) -> int:
    if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
        raise Invalid(f"{field}: {lo}..{hi}", field)
    return v


def _choice(v: Any, field: str, allowed: tuple[Any, ...]) -> Any:
    if v not in allowed:
        raise Invalid(f"{field}: one of {', '.join(map(str, allowed))}", field)
    return v


def _text(v: Any, field: str, lo: int, hi: int, *, strip: bool = True) -> str:
    if not isinstance(v, str):
        raise Invalid(f"{field}: text", field)
    t = v.strip() if strip else v
    if not lo <= len(t) <= hi or any(ord(c) < 32 and c not in "\n\t" for c in t):
        raise Invalid(f"{field}: {lo}..{hi} characters of plain text", field)
    return t


def zone(name: Any, field: str = "tz") -> str:
    try:
        ZoneInfo(str(name))
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise Invalid(f"{field}: not an IANA zone", field) from None
    return str(name)


_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def hours_doc(doc: Any, field: str = "hours_json") -> dict[str, Any]:
    """{weekdays: [1..7 ISO, 7 = Sunday], start: "HH:MM", end: "HH:MM"}; a window across midnight is refused."""
    if not isinstance(doc, dict) or set(doc) - {"weekdays", "start", "end"}:
        raise Invalid(f"{field}: {{weekdays, start, end}}", field)
    days = doc.get("weekdays")
    if not isinstance(days, list) or not days or len(set(days)) != len(days) or any(isinstance(d, bool) or not isinstance(d, int) or not 1 <= d <= 7 for d in days):
        raise Invalid(f"{field}.weekdays: 1..7", field)
    s, e = doc.get("start"), doc.get("end")
    if not (isinstance(s, str) and isinstance(e, str) and _HHMM.match(s) and _HHMM.match(e)) or s >= e:
        raise Invalid(f"{field}: start < end, HH:MM", field)
    return {"weekdays": sorted(days), "start": s, "end": e}


def calendar_values(body: dict[str, Any], *, creating: bool, current: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validates the writable fields of a calendar (only the keys present); returns column values."""
    out: dict[str, Any] = {}
    cur = current or {}
    if "name" in body:
        out["name"] = _text(body["name"], "name", 1, 80)
    if "type" in body:
        if not creating and body["type"] != cur.get("type"):
            raise Invalid("type cannot change", "type")
        out["type"] = _choice(body["type"], "type", TYPES)
    if "description" in body:
        out["description"] = _text(body["description"] or "", "description", 0, 500)
    if "color" in body:
        out["color"] = _choice(body["color"], "color", COLORS)
    if "tz" in body:
        out["tz"] = zone(body["tz"])
    if "area_ref" in body:
        out["area_ref"] = None if body["area_ref"] in (None, "") else _text(body["area_ref"], "area_ref", 1, 64)
    typ = out.get("type") or cur.get("type")
    if "capacity" in body:
        out["capacity"] = None if body["capacity"] is None else _int(body["capacity"], "capacity", 1, 2000)
    if "equipment" in body:
        eq = body["equipment"]
        if not isinstance(eq, list) or len(eq) > 20 or any(e not in EQUIPMENT for e in eq):
            raise Invalid("equipment: known keys", "equipment")
        out["equipment_json"] = json.dumps(sorted(set(eq)))
    if typ and typ != "room" and (out.get("capacity") or out.get("equipment_json") not in (None, "[]")):
        raise Invalid("capacity and equipment are for room calendars", "capacity")
    if "conflict_policy" in body:
        out["conflict_policy"] = _choice(body["conflict_policy"], "conflict_policy", ("exclusive", "overlap"))
    for f in ("buffer_before_min", "buffer_after_min"):
        if f in body:
            out[f] = _int(body[f], f, 0, 240)
    if "slot_step_min" in body:
        out["slot_step_min"] = _choice(body["slot_step_min"], "slot_step_min", STEPS)
    for f in ("min_minutes", "max_minutes"):
        if f in body:
            out[f] = None if body[f] is None else _int(body[f], f, 1, 20160)
    if "lead_min" in body:
        out["lead_min"] = _int(body["lead_min"], "lead_min", 0, 20160)
    if "horizon_days" in body:
        out["horizon_days"] = _int(body["horizon_days"], "horizon_days", 1, 730)
    if "hours_mode" in body:
        out["hours_mode"] = _choice(body["hours_mode"], "hours_mode", HOURS_MODES)
    if "hours_json" in body:
        out["hours_json"] = None if body["hours_json"] is None else json.dumps(hours_doc(body["hours_json"]))
    mode = out.get("hours_mode") or cur.get("hours_mode") or "always"
    if mode == "custom" and (out.get("hours_json") or cur.get("hours_json")) is None:
        raise Invalid("hours_json is required for custom hours", "hours_json")
    if "holiday_rule" in body:
        out["holiday_rule"] = _choice(body["holiday_rule"], "holiday_rule", HOLIDAY_RULES)
    if "approval_mode" in body:
        out["approval_mode"] = _choice(body["approval_mode"], "approval_mode", APPROVAL_MODES)
    if "approval_timeout_h" in body:
        out["approval_timeout_h"] = None if body["approval_timeout_h"] is None else _int(body["approval_timeout_h"], "approval_timeout_h", 0, 720)
    if "overlap_override" in body:
        out["overlap_override"] = None if body["overlap_override"] is None else _choice(body["overlap_override"], "overlap_override", OVERLAP_MODES)
    if "visibility" in body:
        out["visibility"] = _choice(body["visibility"], "visibility", VISIBILITIES)
    mn, mx = out.get("min_minutes", cur.get("min_minutes")), out.get("max_minutes", cur.get("max_minutes"))
    if mn and mx and mn > mx:
        raise Invalid("min_minutes > max_minutes", "min_minutes")
    if creating:
        for need in ("name", "type", "color"):
            if need not in out:
                raise Invalid(f"{need} is required", need)
    return out


def default_policy(typ: str) -> str:
    return "exclusive" if typ in ("room", "maintenance") else "overlap"


def parse_settings(raw: str | None) -> dict[str, Any]:
    """A missing or corrupt document reads as defaults with enabled=false (fail closed)."""
    base = json.loads(json.dumps(SETTINGS_DEFAULTS))
    if not raw:
        return base
    try:
        doc = json.loads(raw)
    except ValueError:
        return base
    if not isinstance(doc, dict):
        return base
    try:
        merged = {**base, **{k: v for k, v in doc.items() if k in base}}
        return settings_doc(merged)
    except Invalid:
        return base


def settings_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Validates a whole settings document (unknown keys are refused); missing keys read as defaults."""
    unknown = set(doc) - set(SETTINGS_DEFAULTS)
    if unknown:
        raise Invalid(f"unknown settings: {', '.join(sorted(unknown))}", sorted(unknown)[0])
    s = {**json.loads(json.dumps(SETTINGS_DEFAULTS)), **doc}
    for f in ("enabled", "pending_holds_slot", "holiday_eve_as_holiday", "guest_details_enabled", "editors_bypass_approval", "notify_confirmations", "feeds_enabled"):
        if not isinstance(s[f], bool):
            raise Invalid(f"{f}: true or false", f)
    s["maintenance_overlap"] = _choice(s["maintenance_overlap"], "maintenance_overlap", OVERLAP_MODES)
    s["contested_requests"] = _choice(s["contested_requests"], "contested_requests", ("queue", "reject"))
    s["menu_position"] = _choice(s["menu_position"], "menu_position", ("a", "b"))
    kinds = s["guest_details_kinds"]
    if not isinstance(kinds, list) or any(k not in ON_BEHALF or k == "self" for k in kinds):
        raise Invalid("guest_details_kinds: on-behalf kinds", "guest_details_kinds")
    s["guest_details_kinds"] = sorted(set(kinds))
    s["guest_retention_days"] = _int(s["guest_retention_days"], "guest_retention_days", 0, 3650)
    s["default_room_buffer_after_min"] = _int(s["default_room_buffer_after_min"], "default_room_buffer_after_min", 0, 240)
    s["series_horizon_days"] = _int(s["series_horizon_days"], "series_horizon_days", 30, 800)
    s["max_calendars"] = _int(s["max_calendars"], "max_calendars", 1, 2000)
    s["automation_late_grace_min"] = _int(s["automation_late_grace_min"], "automation_late_grace_min", 0, 120)
    if not isinstance(s["ticket_visit_calendar_by_department"], dict):
        raise Invalid("ticket_visit_calendar_by_department: object", "ticket_visit_calendar_by_department")
    if s["maintenance_task_calendar"] is not None and not isinstance(s["maintenance_task_calendar"], str):
        raise Invalid("maintenance_task_calendar: id or null", "maintenance_task_calendar")
    s["default_hours"] = hours_doc(s["default_hours"], "default_hours")
    return s


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    return parse_settings(get_setting(conn, SETTINGS_KEY))


def parse_utc(v: Any, field: str) -> dt.datetime:
    if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})", v):
        raise Invalid(f"{field}: ISO-8601 instant with a zone", field)
    try:
        d = dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise Invalid(f"{field}: ISO-8601 instant", field) from None
    return d.astimezone(dt.timezone.utc).replace(microsecond=0)


def iso(d: dt.datetime) -> str:
    return d.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
