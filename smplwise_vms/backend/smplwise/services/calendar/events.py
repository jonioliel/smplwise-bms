"""CALENDARS-298 sections 3.2, 3.3, 7, 13.2 - creating, previewing, editing and cancelling entries (bookings and events).

Booking rule (owner answers 2026-10-29, contract 1A C2): the FIRST confirmed entry holds a slot. A later overlapping request is not refused:
it becomes `pending` + `contested` for the manager (setting `contested_requests`; `reject` answers 409 as before). A pending entry holds
nothing unless `pending_holds_slot` is on. Everything below runs inside the request's write transaction (BEGIN IMMEDIATE), so two requests
for one slot are serialised and exactly one of them can be confirmed."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from dataclasses import dataclass, field
from typing import Any
from zoneinfo import ZoneInfo

from ...db import now_iso
from ...errors import ApiError
from ..tickets.hours import _local_instant
from . import guests, model, notices, occ
from .access import Ctx, Denied, detail_level, get_visible, scope_of
from .calendars import new_id, user_label
from .recurrence import LOCAL_FMT, RuleError, parse_rule, series_end

UTC = dt.timezone.utc


def _422(code: str, message: str, **details: Any) -> ApiError:
    return ApiError(422, code, message, details=details)


# ---------------------------------------------------------------- normalising a request body

@dataclass
class Draft:
    cal: sqlite3.Row
    role: str
    kind: str
    title: str
    notes: str
    all_day: bool
    tz: str
    starts: dt.datetime
    ends: dt.datetime
    local_start: dt.datetime
    local_end: dt.datetime
    rrule: str | None
    holiday_skip: bool
    rooms: list[sqlite3.Row]
    on_behalf_kind: str
    on_behalf_label: str | None
    headcount: int | None
    equipment_req: list[str]
    guests: list[dict[str, str]]
    automation_hold: bool
    occs: list[Any] = field(default_factory=list)


def _times(body: dict[str, Any], tz: str, all_day: bool) -> tuple[dt.datetime, dt.datetime, dt.datetime, dt.datetime]:
    zone = ZoneInfo(tz)
    s, e = model.parse_utc(body.get("start"), "start"), model.parse_utc(body.get("end"), "end")
    ls, le = s.astimezone(zone).replace(tzinfo=None), e.astimezone(zone).replace(tzinfo=None)
    if all_day:
        ls = dt.datetime.combine(ls.date(), dt.time(0))
        le = dt.datetime.combine(le.date() if le.time() == dt.time(0) and le > ls else le.date() + dt.timedelta(days=1), dt.time(0))
        s, e = _local_instant(ls.date(), ls.time(), zone), _local_instant(le.date(), le.time(), zone)
    ls, le = ls.replace(second=0, microsecond=0), le.replace(second=0, microsecond=0)
    if e <= s:
        raise _422("validation", "׳©׳¢׳× ׳”׳¡׳™׳•׳ ׳—׳™׳™׳‘׳× ׳׳”׳™׳•׳× ׳׳—׳¨׳™ ׳©׳¢׳× ׳”׳”׳×׳—׳׳”.", field="end")
    if e - s > dt.timedelta(days=14):
        raise _422("validation", "׳׳™׳¨׳•׳¢ ׳׳—׳“ ׳™׳›׳•׳ ׳׳”׳™׳׳©׳ ׳¢׳“ 14 ׳™׳׳™׳.", field="end")
    return s, e, ls, le


def draft_from(ctx: Ctx, settings: dict[str, Any], body: dict[str, Any], cal: sqlite3.Row, role: str, *, require_kind: bool = True) -> Draft:
    conn = ctx.conn
    kind = body.get("kind", "booking")
    if kind not in model.KINDS_USER:
        raise model.Invalid("kind: booking or event", "kind")
    title = model._text(body.get("title"), "title", 1, 120)
    notes = model._text(body.get("notes") or "", "notes", 0, 2000)
    all_day = body.get("all_day", False)
    if not isinstance(all_day, bool):
        raise model.Invalid("all_day: true or false", "all_day")
    tz = model.zone(body["tz"]) if body.get("tz") else cal["tz"]
    s, e, ls, le = _times(body, tz, all_day)
    rr = body.get("rrule")
    if rr is not None:
        if not isinstance(rr, str):
            raise model.Invalid("rrule: text", "rrule")
        try:
            parse_rule(rr)
        except RuleError as exc:
            raise _422("rrule_unsupported", "׳—׳•׳§ ׳”׳—׳–׳¨׳×׳™׳•׳× ׳׳™׳ ׳• ׳ ׳×׳׳.", reason=exc.code) from None
        rr = rr.strip()[6:] if rr.strip().upper().startswith("RRULE:") else rr.strip()
    skip = body.get("holiday_skip", False)
    if not isinstance(skip, bool):
        raise model.Invalid("holiday_skip: true or false", "holiday_skip")
    rooms: list[sqlite3.Row] = []
    rids = body.get("rooms") or []
    if not isinstance(rids, list) or len(rids) > 10 or len(set(rids)) != len(rids):
        raise model.Invalid("rooms: up to 10 distinct calendar ids", "rooms")
    for rid in rids:
        room = get_visible(ctx, rid)
        if room["type"] != "room":
            raise model.Invalid("rooms: room calendars only", "rooms")
        rooms.append(room)
    if cal["type"] == "room" and rooms:
        raise model.Invalid("rooms: a room calendar holds its own time", "rooms")
    ob = body.get("on_behalf") or {}
    if not isinstance(ob, dict) or set(ob) - {"kind", "label"}:
        raise model.Invalid("on_behalf: {kind, label}", "on_behalf")
    ob_kind = ob.get("kind", "self")
    model._choice(ob_kind, "on_behalf.kind", model.ON_BEHALF)
    label = None if ob.get("label") in (None, "") else model._text(ob["label"], "on_behalf.label", 1, 80)
    if ob_kind != "self" and not ctx.has(model.PERM_BOOK_FOR_OTHERS, scope_of(cal)):
        raise Denied(model.PERM_BOOK_FOR_OTHERS, cal["id"])
    hc = body.get("headcount")
    if hc is not None:
        hc = model._int(hc, "headcount", 1, 2000)
    eq = body.get("equipment_req") or []
    if not isinstance(eq, list) or any(x not in model.EQUIPMENT for x in eq):
        raise model.Invalid("equipment_req: known keys", "equipment_req")
    gl = guests.validate(body.get("guests"), settings, ob_kind)
    if gl and not ctx.has(model.PERM_BOOK_FOR_OTHERS, scope_of(cal)):
        raise Denied(model.PERM_BOOK_FOR_OTHERS, cal["id"])
    ah = body.get("automation_hold", False)
    if not isinstance(ah, bool):
        raise model.Invalid("automation_hold: true or false", "automation_hold")
    return Draft(cal, role, kind, title, notes, all_day, tz, s, e, ls, le, rr, skip, rooms, ob_kind, label, hc, sorted(set(eq)), gl, ah)


# ---------------------------------------------------------------- evaluating a draft against the rules

@dataclass
class HolderPlan:
    cal: sqlite3.Row
    role: str | None
    state: str = "confirmed"
    contested: bool = False
    needs_approval: bool = False
    conflicts: list[dict[str, Any]] = field(default_factory=list)


def _can_bypass(role: str | None, settings: dict[str, Any]) -> bool:
    return bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"] and settings["editors_bypass_approval"])


def evaluate(ctx: Ctx, settings: dict[str, Any], d: Draft, now: dt.datetime, *, exclude: set[str] = frozenset(), skip_rule_checks: bool = False) -> tuple[list[HolderPlan], dict[str, Any]]:
    """Applies hours, holidays, duration, step, lead, horizon, capacity, conflicts and approval. Raises 422 for a hard rule; returns the
    per-holder plan and the soft findings (outside_hours, holiday_hits, capacity_ok)."""
    conn = ctx.conn
    ev_like = {"id": "", "local_start": d.local_start.strftime(LOCAL_FMT), "local_end": d.local_end.strftime(LOCAL_FMT), "tz": d.tz, "rrule": d.rrule,
               "exdates_json": "[]", "holiday_skip": int(d.holiday_skip)}
    try:
        d.occs = occ.event_occurrences(conn, ev_like, settings, now)  # type: ignore[arg-type]
    except RuleError as exc:
        raise _422(exc.code, "׳”׳¡׳“׳¨׳” ׳׳¨׳•׳›׳” ׳׳“׳™." if exc.code == "series_too_large" else "׳—׳•׳§ ׳”׳—׳–׳¨׳×׳™׳•׳× ׳׳™׳ ׳• ׳ ׳×׳׳.") from None
    if not d.occs:
        raise _422("no_occurrences", "׳”׳—׳•׳§ ׳׳ ׳™׳•׳¦׳¨ ׳׳£ ׳׳•׳¢׳“ ׳‘׳—׳׳•׳ ׳”׳§׳¨׳•׳‘.")
    findings: dict[str, Any] = {"outside_hours": False, "holiday_hits": [], "capacity_ok": True}
    holders = [(d.cal, d.role)] + [(r, ctx.role_in(r)) for r in d.rooms]
    plans: list[HolderPlan] = []
    if not d.all_day and not skip_rule_checks:
        minutes = int((d.ends - d.starts).total_seconds() // 60)
        for cal, role in holders:
            strong = bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
            if not strong:
                if cal["min_minutes"] and minutes < cal["min_minutes"] or cal["max_minutes"] and minutes > cal["max_minutes"]:
                    raise _422("duration_out_of_bounds", "׳׳©׳ ׳”׳׳™׳¨׳•׳¢ ׳׳—׳•׳¥ ׳׳׳•׳×׳¨ ׳‘׳™׳•׳׳.", calendar_id=cal["id"], min=cal["min_minutes"], max=cal["max_minutes"])
                if now + dt.timedelta(minutes=cal["lead_min"]) > d.starts or d.starts > now + dt.timedelta(days=cal["horizon_days"]):
                    raise _422("outside_booking_window", "׳”׳”׳–׳׳ ׳” ׳׳—׳•׳¥ ׳׳—׳׳•׳ ׳”׳”׳–׳׳ ׳” ׳©׳ ׳”׳™׳•׳׳.", calendar_id=cal["id"])
            if d.local_start.minute % cal["slot_step_min"] or d.local_end.minute % cal["slot_step_min"]:
                raise _422("slot_step", "׳©׳¢׳•׳× ׳”׳”׳–׳׳ ׳” ׳—׳™׳™׳‘׳•׳× ׳׳”׳™׳•׳× ׳‘׳§׳₪׳™׳¦׳•׳× ׳©׳ ׳”׳¦׳¢׳“ ׳©׳”׳•׳’׳“׳¨ ׳׳™׳•׳׳.", calendar_id=cal["id"], step=cal["slot_step_min"])
    for cal, role in holders:
        plan = HolderPlan(cal, role)
        strong = bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
        zone = ZoneInfo(cal["tz"])
        outside = False
        if not d.all_day:
            for o in d.occs:
                ls, le = o.start_utc.astimezone(zone).replace(tzinfo=None), o.end_utc.astimezone(zone).replace(tzinfo=None)
                if not occ.within_hours(cal, settings, ls, le):
                    outside = True
                    break
        if outside:
            findings["outside_hours"] = True
            if cal["approval_mode"] != "outside_hours" and not strong:
                raise _422("outside_hours", "׳”׳”׳–׳׳ ׳” ׳׳—׳•׳¥ ׳׳©׳¢׳•׳× ׳”׳₪׳×׳™׳—׳” ׳©׳ ׳”׳™׳•׳׳.", calendar_id=cal["id"])
        if cal["holiday_rule"] != "ignore":
            hol = occ.holidays_between(conn, settings, d.occs[0].local_start.date() - dt.timedelta(days=1), d.occs[-1].local_start.date() + dt.timedelta(days=1))
            hits = sorted({o.local_start.date().isoformat() for o in d.occs if o.local_start.date() in hol})
            if hits:
                findings["holiday_hits"] = sorted(set(findings["holiday_hits"]) | set(hits))
                if cal["holiday_rule"] == "closed" and not strong:
                    raise _422("holiday_closed", "׳”׳™׳•׳׳ ׳¡׳’׳•׳¨ ׳‘׳—׳’׳™׳.", calendar_id=cal["id"], dates=hits)
        if cal["capacity"] and d.headcount and d.headcount > cal["capacity"]:
            findings["capacity_ok"] = False
            raise _422("capacity_exceeded", "׳׳¡׳₪׳¨ ׳”׳׳©׳×׳×׳₪׳™׳ ׳’׳“׳•׳ ׳׳§׳™׳‘׳•׳׳× ׳”׳—׳“׳¨.", calendar_id=cal["id"], capacity=cal["capacity"])
        plan.conflicts = occ.blockers(conn, cal, [(o.start_utc, o.end_utc) for o in d.occs], settings, exclude=exclude)
        _maintenance_guard(conn, settings, cal, plan.conflicts)
        is_room_half = cal["id"] != d.cal["id"]
        if plan.conflicts:
            if settings["contested_requests"] == "reject":
                raise ApiError(409, "conflict", "׳”׳–׳׳ ׳×׳₪׳•׳¡.", details={"conflicts": plan.conflicts,
                               "suggestions": occ.free_slots(conn, cal, settings, d.starts, max(int((d.ends - d.starts).total_seconds() // 60), cal["slot_step_min"]), headcount=d.headcount, exclude=exclude)})
            plan.contested = True
        approval = cal["approval_mode"]
        needs = approval == "always" or (approval == "on_behalf" and d.on_behalf_kind != "self") or (approval == "outside_hours" and outside)
        if is_room_half and (role is None or model.ROLE_RANK[role] < model.ROLE_RANK["book"]):
            needs = True  # a team asking for a room it cannot book directly: the room's manager decides
        if needs and _can_bypass(role, settings):
            needs = False
        plan.needs_approval = needs
        plan.state = "pending" if (needs or plan.contested) else "confirmed"
        plans.append(plan)
    return plans, findings


def _maintenance_guard(conn: sqlite3.Connection, settings: dict[str, Any], cal: sqlite3.Row, conflicts: list[dict[str, Any]]) -> None:
    """CAL-GRID-EDIT-2343: a booking over a confirmed maintenance window follows the room's maintenance-overlap mode (the installation's
    `maintenance_overlap`, or the room's `overlap_override`): where maintenance wins (`override_notify`) or no overlap is allowed (`block`) the
    booking is refused (409 maintenance_window); with `first_holds` / `ask` the window holds and the booking waits for the manager like any
    contested request (the behaviour before this change)."""
    if not conflicts:
        return
    mode = cal["overlap_override"] or settings["maintenance_overlap"]
    if mode not in ("override_notify", "block"):
        return
    ids = sorted({c["event_id"] for c in conflicts if c["state"] == "confirmed" and not c.get("held")})
    if not ids:
        return
    marks = ",".join("?" * len(ids))
    maint = {r[0] for r in conn.execute(f"SELECT id FROM cal_events WHERE id IN ({marks}) AND kind = 'maintenance'", ids).fetchall()}
    hits = [c for c in conflicts if c["event_id"] in maint]
    if hits:
        raise ApiError(409, "maintenance_window", "׳™׳© ׳—׳׳•׳ ׳×׳—׳–׳•׳§׳” ׳‘׳–׳׳ ׳”׳–׳”. ׳”׳—׳׳•׳ ׳ ׳¢׳¨׳ ׳‘׳׳©׳•׳ ׳™׳× \"׳×׳—׳–׳•׳§׳”\".", details={"conflicts": hits, "mode": mode})


def _suggestions(ctx: Ctx, settings: dict[str, Any], plans: list[HolderPlan], d: Draft) -> list[dict[str, str]]:
    for p in plans:
        if p.conflicts:
            return occ.free_slots(ctx.conn, p.cal, settings, d.starts, max(int((d.ends - d.starts).total_seconds() // 60), p.cal["slot_step_min"]), headcount=d.headcount)
    return []


def preview(ctx: Ctx, settings: dict[str, Any], body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    cal = get_visible(ctx, body.get("calendar_id"))
    role = ctx.role_in(cal)
    if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["book"]:
        raise Denied(model.PERM_BOOK, cal["id"], "book")
    d = draft_from(ctx, settings, body, cal, role)
    plans, findings = evaluate(ctx, settings, d, now)
    return {"conflicts": [c for p in plans for c in p.conflicts], "needs_approval_by": [p.cal["id"] for p in plans if p.needs_approval or p.contested],
            "contested": any(p.contested for p in plans), "outside_hours": findings["outside_hours"], "holiday_hits": findings["holiday_hits"],
            "capacity_ok": findings["capacity_ok"], "suggestions": _suggestions(ctx, settings, plans, d)}


# ---------------------------------------------------------------- create

def _insert_event(conn: sqlite3.Connection, ev: dict[str, Any]) -> None:
    conn.execute(f"INSERT INTO cal_events({', '.join(ev)}) VALUES ({', '.join('?' * len(ev))})", list(ev.values()))


def _log(conn: sqlite3.Connection, event_id: str, action: str, actor: str | None, note: str = "", room: str | None = None, at: str | None = None) -> None:
    conn.execute("INSERT INTO cal_approvals(id, event_id, room_calendar_id, action, actor_user_id, note, at) VALUES (?,?,?,?,?,?,?)",
                 (new_id("apr"), event_id, room, action, actor, note[:300], at or now_iso()))


def create(ctx: Ctx, settings: dict[str, Any], body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    conn, p = ctx.conn, ctx.principal
    cal = get_visible(ctx, body.get("calendar_id"))
    role = ctx.role_in(cal)
    if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["book"]:
        raise Denied(model.PERM_BOOK, cal["id"], "book")
    d = draft_from(ctx, settings, body, cal, role)
    plans, findings = evaluate(ctx, settings, d, now)
    home, room_plans = plans[0], plans[1:]
    eid = new_id("evt")
    stamp = model.iso(now)
    rule = parse_rule(d.rrule) if d.rrule else None
    sup = series_end(rule, d.local_start, d.local_end, d.tz, settings["series_horizon_days"]) if rule else _local_instant(d.local_end.date(), d.local_end.time(), ZoneInfo(d.tz))
    ev = {
        "id": eid, "calendar_id": cal["id"], "kind": d.kind, "title": d.title, "notes": d.notes, "starts_at": model.iso(d.starts), "ends_at": model.iso(d.ends),
        "all_day": int(d.all_day), "tz": d.tz, "local_start": d.local_start.strftime(LOCAL_FMT), "local_end": d.local_end.strftime(LOCAL_FMT), "rrule": d.rrule,
        "series_until": model.iso(sup) if sup else None, "exdates_json": "[]", "holiday_skip": int(d.holiday_skip), "state": home.state, "contested": int(home.contested),
        "organizer_user_id": p.user_id, "on_behalf_kind": d.on_behalf_kind, "on_behalf_label": d.on_behalf_label, "headcount": d.headcount,
        "equipment_req_json": json.dumps(d.equipment_req), "source": "arx", "automation_hold": int(d.automation_hold),
        "created_by": p.user_id, "created_at": stamp, "updated_by": p.user_id, "updated_at": stamp,
    }
    _insert_event(conn, ev)
    for rp in room_plans:
        conn.execute("INSERT INTO cal_event_rooms(event_id, room_calendar_id, state, contested) VALUES (?,?,?,?)", (eid, rp.cal["id"], rp.state, int(rp.contested)))
    for hp in plans:
        if hp.state == "pending":
            _log(conn, eid, "request", p.user_id, "contested" if hp.contested else "", None if hp is home else hp.cal["id"], stamp)
    if d.guests:
        guests.store(conn, ctx.data_dir, settings, eid, d.guests, erase_after=guests.erase_after_for(settings, sup or (now + dt.timedelta(days=settings["series_horizon_days"]))))
    occ.rebuild(conn, eid, settings, now)
    return {"event": get(ctx, eid), "state": home.state, "requests": [{"room_calendar_id": rp.cal["id"], "state": rp.state, "contested": rp.contested} for rp in room_plans],
            "warnings": {"outside_hours": findings["outside_hours"], "holiday_hits": findings["holiday_hits"]}}


# ---------------------------------------------------------------- reading

def get_row(ctx: Ctx, eid: str) -> tuple[sqlite3.Row, sqlite3.Row, str | None]:
    ev = ctx.conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    if ev is None:
        raise ApiError(404, "not_found", "׳”׳׳™׳¨׳•׳¢ ׳׳ ׳ ׳׳¦׳.")
    cal = get_visible(ctx, ev["calendar_id"])  # the uniform 404 when the home calendar is out of reach
    return ev, cal, ctx.role_in(cal)


def serialize(ctx: Ctx, ev: sqlite3.Row, cal: sqlite3.Row, role: str | None) -> dict[str, Any]:
    conn = ctx.conn
    org = ev["organizer_user_id"] == ctx.principal.user_id
    level = detail_level(role, cal, organizer=org)
    strong = bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
    out: dict[str, Any] = {
        "id": ev["id"], "calendar_id": ev["calendar_id"], "kind": ev["kind"], "title": ev["title"] if level != "busy" else None, "notes": ev["notes"] if level == "full" else None,
        "start": ev["starts_at"], "end": ev["ends_at"], "all_day": bool(ev["all_day"]), "tz": ev["tz"], "rrule": ev["rrule"], "holiday_skip": bool(ev["holiday_skip"]),
        "exdates": json.loads(ev["exdates_json"] or "[]"), "state": ev["state"], "contested": bool(ev["contested"]), "override_of": ev["override_of"], "override_start": ev["override_start"],
        "on_behalf_label": ev["on_behalf_label"] if level != "busy" else None, "on_behalf_kind": ev["on_behalf_kind"] if level == "full" else None,
        "headcount": ev["headcount"] if level == "full" else None, "equipment_req": json.loads(ev["equipment_req_json"] or "[]") if level == "full" else None,
        "organizer": user_label(conn, ev["organizer_user_id"]) if level != "busy" else None, "automation_hold": bool(ev["automation_hold"]) if level == "full" else None,
        "revision": ev["revision"], "recurring": bool(ev["rrule"] or ev["override_of"]), "source": ev["source"], "sync_flag": ev["sync_flag"] if strong else None,
        "can": {"edit": bool(org and ev["state"] in ("pending", "confirmed") and role and model.ROLE_RANK[role] >= 1) or strong,
                "cancel": bool(org or strong), "approve": bool(role == "manage")},
        "rooms": [{"room_calendar_id": r["room_calendar_id"], "state": r["state"], "contested": bool(r["contested"])} for r in
                  conn.execute("SELECT * FROM cal_event_rooms WHERE event_id = ?", (ev["override_of"] or ev["id"],)).fetchall()],
    }
    # CAL-GRID-EDIT-2343: the approved slot a change request keeps (shown dotted until the decision), and whether "׳‘׳˜׳" may still restore it
    held = occ.held_of(ev)
    out["held"] = {"calendar_id": held["calendar_id"], "start": held["starts_at"], "end": held["ends_at"]} if held and ev["state"] == "pending" else None
    out["can"]["restore"] = bool(ev["cancelled_from"] and ev["state"] in ("cancelled", "withdrawn") and (org or strong) and not ev["rrule"] and not ev["override_of"])
    return out


def get(ctx: Ctx, eid: str) -> dict[str, Any]:
    ev, cal, role = get_row(ctx, eid)
    return serialize(ctx, ev, cal, role)


def occurrences(ctx: Ctx, start: dt.datetime, end: dt.datetime, *, calendars: list[str] | None, kinds: list[str] | None, states: list[str] | None) -> dict[str, Any]:
    """The cached occurrences intersecting [start, end) on the calendars the caller may see (max 62 days is enforced by the router)."""
    conn = ctx.conn
    visible = {c["id"]: (c, ctx.role_in(c)) for c in conn.execute("SELECT * FROM cal_calendars WHERE archived_at IS NULL").fetchall() if ctx.can_see(c)}
    want = [c for c in (calendars or visible) if c in visible]
    if not want:
        return {"occurrences": [], "truncated": False}
    marks = ",".join("?" * len(want))
    rows = conn.execute(f"SELECT o.*, e.kind, e.title, e.on_behalf_label, e.organizer_user_id, e.rrule, e.override_of, e.revision, e.calendar_id AS home, e.sync_flag, e.contested AS ev_contested, "
                        f"e.held_json, e.all_day, e.source FROM cal_occurrences o JOIN cal_events e ON e.id = o.event_id "
                        f"WHERE o.holder_calendar_id IN ({marks}) AND o.occ_start < ? AND o.occ_end > ? ORDER BY o.occ_start, o.event_id LIMIT 2001",
                        (*want, model.iso(end), model.iso(start))).fetchall()
    out = []
    me = ctx.principal.user_id
    for r in rows[:2000]:
        if kinds and r["kind"] not in kinds or states and r["state"] not in states:
            continue
        cal, role = visible[r["holder_calendar_id"]]
        level = detail_level(role, cal, organizer=r["organizer_user_id"] == me)
        held = occ.held_of(r) if r["state"] == "pending" else None
        out.append({"occurrence_id": f"{r['event_id']}@{r['local_start']}@{r['holder_calendar_id']}", "event_id": r["event_id"], "calendar_id": r["holder_calendar_id"],
                    "room_calendar_ids": [r["room_calendar_id"]] if r["room_calendar_id"] else [], "start": r["occ_start"], "end": r["occ_end"], "state": r["state"], "kind": r["kind"],
                    "title": r["title"] if level != "busy" else None, "on_behalf_label": r["on_behalf_label"] if level != "busy" else None,
                    "organizer": user_label(conn, r["organizer_user_id"]) if level != "busy" else None, "recurring": bool(r["rrule"] or r["override_of"]),
                    # CALENDARS-UI-2310: the marks the views draw - a contested request, and a sync flag (only for `edit`+, who may resolve it)
                    "contested": bool(r["ev_contested"]) and r["state"] == "pending",
                    "sync_flag": r["sync_flag"] if role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"] else None,
                    # CAL-GRID-EDIT-2343: what the grid needs to offer a move / resize (the PATCH decides again): may this viewer change the entry,
                    # its revision, its local start (a series occurrence), whether it is all-day, and the approved slot a change request keeps
                    "can_edit": _grid_editable(r, role, me), "revision": r["revision"], "local_start": r["local_start"], "all_day": bool(r["all_day"]),
                    "held": {"calendar_id": held["calendar_id"], "start": held["starts_at"], "end": held["ends_at"]} if held else None})
    # the held (approved) slots of change requests: confirmed time on their calendar, drawn dotted, never dragged
    for r in conn.execute(f"SELECT o.*, e.id AS base_id, e.kind, e.title, e.organizer_user_id, e.revision FROM cal_occurrences o JOIN cal_events e ON o.event_id = e.id || '{occ.HELD_SUFFIX}' "
                          f"WHERE o.holder_calendar_id IN ({marks}) AND o.occ_start < ? AND o.occ_end > ? ORDER BY o.occ_start LIMIT 500", (*want, model.iso(end), model.iso(start))).fetchall():
        cal, role = visible[r["holder_calendar_id"]]
        level = detail_level(role, cal, organizer=r["organizer_user_id"] == me)
        out.append({"occurrence_id": f"{r['base_id']}@held@{r['holder_calendar_id']}", "event_id": r["base_id"], "calendar_id": r["holder_calendar_id"], "room_calendar_ids": [],
                    "start": r["occ_start"], "end": r["occ_end"], "state": "confirmed", "kind": r["kind"], "title": r["title"] if level != "busy" else None, "on_behalf_label": None,
                    "organizer": None, "recurring": False, "contested": False, "sync_flag": None, "can_edit": False, "revision": r["revision"], "local_start": r["local_start"],
                    "all_day": False, "held": None, "held_slot": True})
    return {"occurrences": out, "truncated": len(rows) > 2000}


def _grid_editable(r: sqlite3.Row, role: str | None, me: str) -> bool:
    """The grid offers a drag only on what PATCH would accept from this viewer: his own booking (book+) or anything (edit+), open, an Arx entry
    of a user kind on its home calendar (a held room half is changed from its event)."""
    if role is None or r["state"] not in ("pending", "confirmed") or r["kind"] not in model.KINDS_USER or r["room_calendar_id"] or r["source"] != "arx":
        return False
    rank = model.ROLE_RANK[role]
    return rank >= model.ROLE_RANK["edit"] or (r["organizer_user_id"] == me and rank >= model.ROLE_RANK["book"])


# ---------------------------------------------------------------- cancel / withdraw / edit

SCOPES = ("occurrence", "following", "series")


def _check_rev(ev: sqlite3.Row, body: dict[str, Any]) -> None:
    if body.get("revision") != ev["revision"]:
        raise ApiError(409, "stale", "׳”׳׳™׳¨׳•׳¢ ׳¢׳•׳“׳›׳ ׳‘׳™׳ ׳×׳™׳™׳. ׳¨׳¢׳ ׳ ׳•׳ ׳¡׳” ׳©׳•׳‘.", details={"revision": ev["revision"]})


def _touch(conn: sqlite3.Connection, eid: str, who: str, now: str, **cols: Any) -> None:
    sets = "".join(f", {k} = ?" for k in cols)
    conn.execute(f"UPDATE cal_events SET updated_by = ?, updated_at = ?, revision = revision + 1{sets} WHERE id = ?", (who, now, *cols.values(), eid))


def _guard_edit(ctx: Ctx, ev: sqlite3.Row, cal: sqlite3.Row, role: str | None) -> None:
    strong = bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
    if not (strong or (ev["organizer_user_id"] == ctx.principal.user_id and role and model.ROLE_RANK[role] >= model.ROLE_RANK["book"])):
        raise Denied(model.PERM_BOOK, cal["id"], "edit")


def _scope(body: dict[str, Any], ev: sqlite3.Row) -> tuple[str, str | None]:
    scope = body.get("scope", "series")
    if scope not in SCOPES:
        raise model.Invalid("scope: occurrence, following or series", "scope")
    ostart = body.get("occurrence_start")
    if scope != "series" and not ev["rrule"] and not ev["override_of"]:
        scope = "series"  # a single entry has only itself
    if scope != "series" and ev["rrule"]:
        try:
            dt.datetime.strptime(str(ostart), LOCAL_FMT)
        except ValueError:
            raise model.Invalid("occurrence_start: local YYYY-MM-DDTHH:MM", "occurrence_start") from None
    return scope, ostart


def _series_has(conn: sqlite3.Connection, ev: sqlite3.Row, settings: dict[str, Any], ostart: str, now: dt.datetime) -> bool:
    return any(o.key == ostart for o in occ.event_occurrences(conn, ev, settings, now, window_days=800))


def _cancel_window(ctx: Ctx, settings: dict[str, Any], ev: sqlite3.Row, role: str | None, body: dict[str, Any], now: dt.datetime) -> None:
    """Owner answer 14 as a setting (`resident_cancel_until`): an organizer without the edit role cancels a confirmed entry only until the
    chosen time before its start (start | 1h | 24h). Editors and managers are not limited; a pending request may always be withdrawn."""
    lead = model.CANCEL_UNTIL_MIN[settings["resident_cancel_until"]]
    if not lead or ev["state"] != "confirmed" or (role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"]):
        return
    start = _parse_start_utc(ev, body["occurrence_start"]) if body.get("occurrence_start") and ev["rrule"] else model.parse_utc(ev["starts_at"], "s")
    if start - dt.timedelta(minutes=lead) <= now < start:
        raise ApiError(409, "cancel_too_late", "׳¢׳‘׳¨ ׳”׳׳•׳¢׳“ ׳”׳׳—׳¨׳•׳ ׳׳‘׳™׳˜׳•׳. ׳׳ ׳”׳ ׳”׳™׳•׳׳ ׳™׳›׳•׳ ׳׳‘׳˜׳.", details={"until_min": lead})


def cancel(ctx: Ctx, settings: dict[str, Any], eid: str, body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    conn, p = ctx.conn, ctx.principal
    ev, cal, role = get_row(ctx, eid)
    _guard_edit(ctx, ev, cal, role)
    _check_rev(ev, body)
    scope, ostart = _scope(body, ev)
    stamp = model.iso(now)
    if ev["state"] not in ("pending", "confirmed", "displaced"):
        raise ApiError(409, "bad_state", "׳׳™ ׳׳₪׳©׳¨ ׳׳‘׳˜׳ ׳׳™׳¨׳•׳¢ ׳‘׳׳¦׳‘ ׳”׳–׳”.", details={"state": ev["state"]})
    _cancel_window(ctx, settings, ev, role, body, now)
    if scope == "series":
        if not ev["rrule"] and model.parse_utc(ev["ends_at"], "e") <= now:
            raise _422("past_immutable", "׳׳™ ׳׳₪׳©׳¨ ׳׳‘׳˜׳ ׳׳™׳¨׳•׳¢ ׳©׳›׳‘׳¨ ׳”׳¡׳×׳™׳™׳.")
        _touch(conn, eid, p.user_id, stamp, state="cancelled", cancelled_from=ev["state"])
        conn.execute("UPDATE cal_event_rooms SET state = 'cancelled' WHERE event_id = ? AND state IN ('pending','confirmed')", (eid,))
        for (oid,) in conn.execute("SELECT id FROM cal_events WHERE override_of = ? AND state IN ('pending','confirmed','displaced')", (eid,)).fetchall():
            _touch(conn, oid, p.user_id, stamp, state="cancelled")
            occ.rebuild(conn, oid, settings, now)
        guests.reset_erase_after(conn, eid, settings, now)
    elif ev["override_of"]:  # one replaced occurrence: cancel the override row; the original start stays excluded
        if model.parse_utc(ev["ends_at"], "e") <= now:
            raise _422("past_immutable", "׳׳™ ׳׳₪׳©׳¨ ׳׳‘׳˜׳ ׳׳•׳¢׳“ ׳©׳›׳‘׳¨ ׳”׳¡׳×׳™׳™׳.")
        _touch(conn, eid, p.user_id, stamp, state="cancelled")
    elif scope == "occurrence":
        if not _series_has(conn, ev, settings, ostart, now):
            raise ApiError(404, "not_found", "׳”׳׳•׳¢׳“ ׳׳ ׳ ׳׳¦׳ ׳‘׳¡׳“׳¨׳”.")
        if _parse_start_utc(ev, ostart) <= now:
            raise _422("past_immutable", "׳׳™ ׳׳₪׳©׳¨ ׳׳‘׳˜׳ ׳׳•׳¢׳“ ׳©׳›׳‘׳¨ ׳”׳×׳—׳™׳.")
        ex = json.loads(ev["exdates_json"] or "[]")
        _touch(conn, eid, p.user_id, stamp, exdates_json=json.dumps(sorted(set(ex) | {ostart})))
    else:  # following: cut the series before this occurrence
        if not _series_has(conn, ev, settings, ostart, now):
            raise ApiError(404, "not_found", "׳”׳׳•׳¢׳“ ׳׳ ׳ ׳׳¦׳ ׳‘׳¡׳“׳¨׳”.")
        if _parse_start_utc(ev, ostart) <= now:
            raise _422("past_immutable", "׳׳™ ׳׳₪׳©׳¨ ׳׳‘׳˜׳ ׳׳•׳¢׳“ ׳©׳›׳‘׳¨ ׳”׳×׳—׳™׳.")
        _cut_before(conn, ev, ostart, p.user_id, stamp)
    occ.rebuild(conn, eid if not ev["override_of"] else ev["override_of"], settings, now)
    if ev["override_of"]:
        occ.rebuild(conn, eid, settings, now)
    # CAL-GRID-EDIT-2343: someone else cancelled the organizer's entry - he is told after the undo window, unless "׳‘׳˜׳" restores it first
    notices.queue(conn, settings, event_id=eid, kind="calendar.booking.cancelled", recipient=ev["organizer_user_id"], actor=p.user_id, now=now,
                  payload={"scope": scope, "occurrence_start": ostart if scope != "series" else None, "start": ev["starts_at"]})
    return {"event": get(ctx, eid)}


def _parse_start_utc(ev: sqlite3.Row, local: str) -> dt.datetime:
    d = dt.datetime.strptime(local, LOCAL_FMT)
    return _local_instant(d.date(), d.time(), ZoneInfo(ev["tz"]))


def _cut_before(conn: sqlite3.Connection, ev: sqlite3.Row, ostart: str, who: str, stamp: str) -> None:
    """Ends the series the day before `ostart` (UNTIL) and cancels overrides at or after it. A cut at the first occurrence cancels the series."""
    day = dt.datetime.strptime(ostart, LOCAL_FMT).date()
    first = dt.datetime.strptime(ev["local_start"], LOCAL_FMT).date()
    for (oid, os_) in conn.execute("SELECT id, override_start FROM cal_events WHERE override_of = ? AND override_start >= ? AND state IN ('pending','confirmed','displaced')", (ev["id"], ostart)).fetchall():
        _touch(conn, oid, who, stamp, state="cancelled")
    if day <= first:
        _touch(conn, ev["id"], who, stamp, state="cancelled")
        conn.execute("UPDATE cal_event_rooms SET state = 'cancelled' WHERE event_id = ? AND state IN ('pending','confirmed')", (ev["id"],))
        return
    rule = parse_rule(ev["rrule"])
    until = (day - dt.timedelta(days=1)).strftime("%Y%m%d")
    parts = [p for p in ev["rrule"].split(";") if not p.upper().startswith(("COUNT=", "UNTIL="))] + [f"UNTIL={until}"]
    del rule
    new_rule = ";".join(parts)
    end = series_end(parse_rule(new_rule), dt.datetime.strptime(ev["local_start"], LOCAL_FMT), dt.datetime.strptime(ev["local_end"], LOCAL_FMT), ev["tz"], 400)
    _touch(conn, ev["id"], who, stamp, rrule=new_rule, series_until=model.iso(end) if end else None)


def withdraw(ctx: Ctx, settings: dict[str, Any], eid: str, body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    conn, p = ctx.conn, ctx.principal
    ev, cal, role = get_row(ctx, eid)
    if ev["organizer_user_id"] != p.user_id:
        raise Denied(model.PERM_BOOK, cal["id"], "organizer")
    _check_rev(ev, body)
    if ev["state"] != "pending":
        raise ApiError(409, "bad_state", "׳׳₪׳©׳¨ ׳׳׳©׳•׳ ׳¨׳§ ׳‘׳§׳©׳” ׳©׳׳׳×׳™׳ ׳”.", details={"state": ev["state"]})
    stamp = model.iso(now)
    held = occ.held_of(ev)
    if held:  # CAL-GRID-EDIT-2343: withdrawing a change request puts the booking back on its approved slot
        _restore_held(conn, ev, held, p.user_id, stamp)
        _log(conn, eid, "withdraw", p.user_id, "change", None, stamp)
        occ.rebuild(conn, eid, settings, now)
        return {"event": get(ctx, eid), "change_withdrawn": True}
    _touch(conn, eid, p.user_id, stamp, state="withdrawn", cancelled_from="pending")
    conn.execute("UPDATE cal_event_rooms SET state = 'withdrawn' WHERE event_id = ? AND state = 'pending'", (eid,))
    _log(conn, eid, "withdraw", p.user_id, "", None, stamp)
    guests.reset_erase_after(conn, eid, settings, now)
    occ.rebuild(conn, eid, settings, now)
    return {"event": get(ctx, eid)}


EDITABLE = ("title", "notes", "headcount", "equipment_req", "on_behalf", "automation_hold")


def update(ctx: Ctx, settings: dict[str, Any], eid: str, body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    """Edits an entry. `scope` series (default) / occurrence (an override row) / following (splits the series).

    CAL-GRID-EDIT-2343 (the grid's move / resize go through here; contract section 7 "the old slot is released only on approval"):
    * `calendar_id` moves a single entry to another calendar (a room column of the day view) the caller may book in;
    * a change of TIME on a CONFIRMED single entry that now needs an approval follows the target calendar's `approved_move`: `reapproval`
      (default) turns it into a pending change request and keeps the approved slot held (`held_json`, a confirmed row in the cache) until the
      manager decides - approve releases it, reject / withdraw / expiry put the booking back on it; `managers` refuses a booker
      (409 change_needs_manager) while an editor or manager moves it. A series, an override row or an entry holding rooms keeps the old refusal
      (409 change_needs_new_request) in this phase;
    * moving back onto the held slot (the grid's "׳‘׳˜׳") restores the approved booking at once;
    * a moved start is never in the past, and a started entry keeps its start (its end may still be changed);
    * the organizer is told after `cancel_notice_delay_s` when someone else changed his entry's time (an undo withdraws the notice)."""
    conn, p = ctx.conn, ctx.principal
    ev, cal, role = get_row(ctx, eid)
    _guard_edit(ctx, ev, cal, role)
    _check_rev(ev, body)
    scope, ostart = _scope(body, ev)
    if ev["state"] not in ("pending", "confirmed"):
        raise ApiError(409, "bad_state", "׳׳™ ׳׳₪׳©׳¨ ׳׳¢׳¨׳•׳ ׳׳™׳¨׳•׳¢ ׳‘׳׳¦׳‘ ׳”׳–׳”.", details={"state": ev["state"]})
    stamp = model.iso(now)
    target_cal, target_role = cal, role
    moving_cal = "calendar_id" in body and body["calendar_id"] != ev["calendar_id"]
    if moving_cal:
        if ev["rrule"] or ev["override_of"] or ev["kind"] not in model.KINDS_USER or scope != "series" or \
                conn.execute("SELECT 1 FROM cal_event_rooms WHERE event_id = ?", (eid,)).fetchone():
            raise _422("move_calendar_unsupported", "׳׳₪׳©׳¨ ׳׳”׳¢׳‘׳™׳¨ ׳׳™׳•׳׳ ׳׳—׳¨ ׳¨׳§ ׳׳™׳¨׳•׳¢ ׳‘׳•׳“׳“.", field="calendar_id")
        target_cal = get_visible(ctx, body.get("calendar_id"))
        target_role = ctx.role_in(target_cal)
        if target_cal["type"] == "maintenance":
            raise model.Invalid("calendar_id: not a maintenance calendar", "calendar_id")
        if target_role is None or model.ROLE_RANK[target_role] < model.ROLE_RANK["book"]:
            raise Denied(model.PERM_BOOK, target_cal["id"], "book")
    time_change = moving_cal or any(k in body for k in ("start", "end", "all_day", "tz", "rrule", "holiday_skip"))
    single_past = not ev["rrule"] and model.parse_utc(ev["ends_at"], "e") <= now
    if single_past and (time_change or set(body) & set(EDITABLE) - {"notes"}):
        raise _422("past_immutable", "׳‘׳׳™׳¨׳•׳¢ ׳©׳”׳¡׳×׳™׳™׳ ׳׳₪׳©׳¨ ׳׳¢׳“׳›׳ ׳¨׳§ ׳”׳¢׳¨׳•׳×.")
    if scope != "series" and ostart and _parse_start_utc(ev, ostart) <= now and ev["rrule"]:
        raise _422("past_immutable", "׳׳™ ׳׳₪׳©׳¨ ׳׳©׳ ׳•׳× ׳׳•׳¢׳“ ׳©׳›׳‘׳¨ ׳”׳×׳—׳™׳.")
    # merge the proposed values over the stored ones through the same validators as create
    merged = _merged_body(ev, body)
    if scope == "occurrence" and ev["rrule"]:
        merged.pop("rrule", None)
        merged.pop("holiday_skip", None)
    d = draft_from(ctx, settings, {**merged, "calendar_id": target_cal["id"]}, target_cal, target_role or "view")
    held = occ.held_of(ev)
    if held and ev["state"] == "pending" and scope == "series" and not ev["rrule"] and _on_slot(d, target_cal, held):
        # the change is taken back (the grid's undo, or the organizer moved it home): the approved booking returns at once
        _restore_held(conn, ev, held, p.user_id, stamp, cols=_cols(d, "confirmed", p.user_id, stamp))
        _log(conn, eid, "withdraw", p.user_id, "change_undone", None, stamp)
        notices.withdraw_for(conn, eid, now)
        occ.rebuild(conn, eid, settings, now)
        return {"event": get(ctx, eid), "orphaned_overrides": [], "change_withdrawn": True}
    if time_change and not d.all_day and scope == "series" and not ev["rrule"]:
        started = model.parse_utc(ev["starts_at"], "s") <= now
        if started and (moving_cal or d.starts != model.parse_utc(ev["starts_at"], "s")):
            raise _422("started_immutable", "׳”׳׳™׳¨׳•׳¢ ׳›׳‘׳¨ ׳”׳×׳—׳™׳: ׳׳₪׳©׳¨ ׳׳©׳ ׳•׳× ׳¨׳§ ׳׳× ׳©׳¢׳× ׳”׳¡׳™׳•׳.", field="start")
        if not started and d.starts < now:
            raise _422("past_start", "׳׳™ ׳׳₪׳©׳¨ ׳׳”׳–׳™׳– ׳׳™׳¨׳•׳¢ ׳׳–׳׳ ׳©׳›׳‘׳¨ ׳¢׳‘׳¨.", field="start")
        if started and d.ends <= now:
            raise _422("past_start", "׳©׳¢׳× ׳”׳¡׳™׳•׳ ׳›׳‘׳¨ ׳¢׳‘׳¨׳”.", field="end")
    if scope == "occurrence" and ev["rrule"]:
        # the occurrence keeps its own start unless the body moves it; the draft's start is the (possibly moved) occurrence
        if "start" not in body or "end" not in body:
            dur = dt.datetime.strptime(ev["local_end"], LOCAL_FMT) - dt.datetime.strptime(ev["local_start"], LOCAL_FMT)
            ls = dt.datetime.strptime(ostart, LOCAL_FMT)
            d.local_start, d.local_end = ls, ls + dur
            d.starts, d.ends = _parse_start_utc(ev, ostart), _local_instant((ls + dur).date(), (ls + dur).time(), ZoneInfo(ev["tz"]))
        d.rrule = None
    changed_time = moving_cal or (time_change and (scope != "series" or d.local_start.strftime(LOCAL_FMT) != ev["local_start"] or d.local_end.strftime(LOCAL_FMT) != ev["local_end"] or d.rrule != ev["rrule"]))
    exclude = occ.family(conn, eid)
    plans, findings = evaluate(ctx, settings, d, now, exclude=exclude, skip_rule_checks=not changed_time)
    new_held: dict[str, Any] | None = held if ev["state"] == "pending" else None
    if changed_time and ev["state"] == "confirmed" and any(pl.state == "pending" for pl in plans):
        contested = any(pl.contested for pl in plans)
        if ev["rrule"] or ev["override_of"] or scope != "series" or len(plans) > 1:
            raise ApiError(409, "change_needs_new_request", "׳©׳™׳ ׳•׳™ ׳”׳©׳¢׳” ׳“׳•׳¨׳© ׳׳™׳©׳•׳¨ ׳׳—׳“׳©. ׳‘׳˜׳ ׳׳× ׳”׳”׳–׳׳ ׳” ׳•׳‘׳§׳© ׳©׳•׳‘.", details={"contested": contested})
        strong_target = bool(target_role and model.ROLE_RANK[target_role] >= model.ROLE_RANK["edit"])
        if target_cal["approved_move"] == "managers" and not strong_target:
            raise ApiError(409, "change_needs_manager", "׳”׳–׳׳ ׳” ׳׳׳•׳©׳¨׳× ׳‘׳—׳“׳¨ ׳”׳–׳” ׳׳©׳×׳ ׳” ׳¨׳§ ׳“׳¨׳ ׳׳ ׳”׳ ׳”׳—׳“׳¨. ׳׳₪׳©׳¨ ׳׳‘׳§׳© ׳׳׳ ׳•, ׳׳• ׳׳‘׳˜׳ ׳•׳׳”׳–׳׳™׳ ׳׳—׳“׳©.",
                           details={"contested": contested, "calendar_id": target_cal["id"]})
        new_held = {"calendar_id": ev["calendar_id"], "starts_at": ev["starts_at"], "ends_at": ev["ends_at"], "local_start": ev["local_start"], "local_end": ev["local_end"]}
    new_state = ev["state"] if not changed_time else plans[0].state
    if new_state == "confirmed":
        new_held = None
    orphans: list[str] = []
    if scope == "series" and ev["rrule"] and d.rrule and (d.rrule != ev["rrule"] or d.local_start.strftime(LOCAL_FMT) != ev["local_start"]):
        valid = {o.key for o in d.occs}
        orphans = sorted(r["override_start"] for r in conn.execute("SELECT override_start FROM cal_events WHERE override_of = ? AND state <> 'cancelled'", (eid,)).fetchall() if r["override_start"] not in valid)
        if orphans and body.get("accept_orphans") is not True:
            raise ApiError(409, "orphaned_overrides", "׳©׳™׳ ׳•׳™׳™׳ ׳‘׳•׳“׳“׳™׳ ׳™׳׳‘׳“׳•.", details={"orphans": orphans, "count": len(orphans)})
    target = eid
    if scope == "occurrence" and ev["rrule"]:
        if not _series_has(conn, ev, settings, ostart, now):
            raise ApiError(404, "not_found", "׳”׳׳•׳¢׳“ ׳׳ ׳ ׳׳¦׳ ׳‘׳¡׳“׳¨׳”.")
        ovr = conn.execute("SELECT id FROM cal_events WHERE override_of = ? AND override_start = ? AND state <> 'cancelled'", (eid, ostart)).fetchone()
        cols = _cols(d, new_state, p.user_id, stamp)
        if ovr:
            target = ovr["id"]
            _touch(conn, target, p.user_id, stamp, **cols)
        else:
            target = new_id("evt")
            row = {"id": target, "calendar_id": ev["calendar_id"], "kind": ev["kind"], "override_of": eid, "override_start": ostart, "organizer_user_id": ev["organizer_user_id"],
                   "source": "arx", "created_by": p.user_id, "created_at": stamp, "updated_by": p.user_id, "updated_at": stamp, "exdates_json": "[]", **cols}
            _insert_event(conn, row)
        occ.rebuild(conn, eid, settings, now)
    elif scope == "following" and ev["rrule"]:
        if not _series_has(conn, ev, settings, ostart, now):
            raise ApiError(404, "not_found", "׳”׳׳•׳¢׳“ ׳׳ ׳ ׳׳¦׳ ׳‘׳¡׳“׳¨׳”.")
        first = dt.datetime.strptime(ev["local_start"], LOCAL_FMT).date()
        target = eid
        if dt.datetime.strptime(ostart, LOCAL_FMT).date() > first:
            target = new_id("evt")
            if not time_change or "start" not in body:  # the new series starts at the chosen occurrence, same wall-clock times unless moved
                dur = dt.datetime.strptime(ev["local_end"], LOCAL_FMT) - dt.datetime.strptime(ev["local_start"], LOCAL_FMT)
                ls = dt.datetime.strptime(ostart, LOCAL_FMT).replace(hour=d.local_start.hour, minute=d.local_start.minute)
                d.local_start, d.local_end = ls, ls + dur
                d.starts, d.ends = _parse_start_utc(ev, ls.strftime(LOCAL_FMT)), _local_instant((ls + dur).date(), (ls + dur).time(), ZoneInfo(ev["tz"]))
            _cut_before(conn, ev, ostart, p.user_id, stamp)
            cols = _cols(d, new_state, p.user_id, stamp)
            cols["rrule"] = d.rrule if "rrule" in body else ev["rrule"]
            sup = series_end(parse_rule(cols["rrule"]), d.local_start, d.local_end, d.tz, 400) if cols["rrule"] else None
            cols["series_until"] = model.iso(sup) if sup else None
            row = {"id": target, "calendar_id": ev["calendar_id"], "kind": ev["kind"], "organizer_user_id": ev["organizer_user_id"], "source": "arx", "created_by": p.user_id,
                   "created_at": stamp, "updated_by": p.user_id, "updated_at": stamp, "exdates_json": "[]", **cols}
            _insert_event(conn, row)
            for r in conn.execute("SELECT * FROM cal_event_rooms WHERE event_id = ?", (eid,)).fetchall():
                conn.execute("INSERT INTO cal_event_rooms(event_id, room_calendar_id, state, contested) VALUES (?,?,?,?)", (target, r["room_calendar_id"], r["state"], r["contested"]))
            conn.execute("UPDATE cal_events SET override_of = ? WHERE override_of = ? AND override_start >= ?", (target, eid, ostart))
            occ.rebuild(conn, eid, settings, now)
        else:
            scope = "series"
    if scope == "series" or (scope == "following" and target == eid):
        cols = _cols(d, new_state, p.user_id, stamp)
        sup = series_end(parse_rule(d.rrule), d.local_start, d.local_end, d.tz, 400) if d.rrule else _local_instant(d.local_end.date(), d.local_end.time(), ZoneInfo(d.tz))
        cols["series_until"] = model.iso(sup) if sup else None
        if changed_time:
            cols["contested"] = int(plans[0].contested)
            cols["held_json"] = json.dumps(new_held, sort_keys=True) if new_held else None
            if moving_cal:
                cols["calendar_id"] = target_cal["id"]
        _touch(conn, eid, p.user_id, stamp, **cols)
        if changed_time and new_state == "pending" and (ev["state"] == "confirmed" or moving_cal or new_held):
            _log(conn, eid, "request", p.user_id, "change" + (":contested" if plans[0].contested else ""), None, stamp)
        if changed_time:
            notices.queue(conn, settings, event_id=eid, kind="calendar.booking.changed", recipient=ev["organizer_user_id"], actor=p.user_id, now=now,
                          payload={"from": [ev["starts_at"], ev["ends_at"]], "to": [model.iso(d.starts), model.iso(d.ends)], "calendar_id": target_cal["id"], "state": new_state})
        if orphans:
            for r in conn.execute("SELECT id FROM cal_events WHERE override_of = ? AND override_start IN (%s)" % ",".join("?" * len(orphans)), (eid, *orphans)).fetchall():
                _touch(conn, r["id"], p.user_id, stamp, state="cancelled")
        if changed_time:
            for pl in plans[1:]:
                conn.execute("UPDATE cal_event_rooms SET state = ?, contested = ? WHERE event_id = ? AND room_calendar_id = ?", (pl.state, int(pl.contested), eid, pl.cal["id"]))
        target = eid
    occ.rebuild(conn, target, settings, now)
    return {"event": get(ctx, target), "orphaned_overrides": orphans}


def _on_slot(d: Draft, cal: sqlite3.Row, held: dict[str, Any]) -> bool:
    return cal["id"] == held["calendar_id"] and model.iso(d.starts) == held["starts_at"] and model.iso(d.ends) == held["ends_at"]


def _restore_held(conn: sqlite3.Connection, ev: sqlite3.Row, held: dict[str, Any], who: str, stamp: str, *, cols: dict[str, Any] | None = None) -> None:
    """The booking goes back to the approved slot its change request kept: confirmed, not contested, nothing held (other edits in `cols` stay)."""
    keep = dict(cols or {})
    keep.update({"calendar_id": held["calendar_id"], "starts_at": held["starts_at"], "ends_at": held["ends_at"], "local_start": held["local_start"],
                 "local_end": held["local_end"], "state": "confirmed", "contested": 0, "held_json": None})
    keep.pop("series_until", None)
    zone = ZoneInfo(ev["tz"])
    le = dt.datetime.strptime(held["local_end"], LOCAL_FMT)
    keep["series_until"] = model.iso(_local_instant(le.date(), le.time(), zone))
    _touch(conn, ev["id"], who, stamp, **keep)


def restore(ctx: Ctx, settings: dict[str, Any], eid: str, body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    """CAL-GRID-EDIT-2343: "׳‘׳˜׳" after a delete. A single entry cancelled (or a request withdrawn) within `undo_window_s` returns to the state it
    had, provided its time is still free of a confirmed entry (409 conflict otherwise); a held-back cancel notice is withdrawn."""
    conn, p = ctx.conn, ctx.principal
    ev, cal, role = get_row(ctx, eid)
    _guard_edit(ctx, ev, cal, role)
    _check_rev(ev, body)
    prev = ev["cancelled_from"]
    if ev["state"] not in ("cancelled", "withdrawn") or prev not in ("pending", "confirmed"):
        raise ApiError(409, "bad_state", "׳׳™׳ ׳׳” ׳׳©׳—׳–׳¨.", details={"state": ev["state"]})
    if ev["rrule"] or ev["override_of"]:
        raise ApiError(409, "restore_unsupported", "׳¡׳“׳¨׳” ׳׳‘׳•׳˜׳׳× ׳׳©׳•׳—׳–׳¨׳× ׳׳”׳׳’׳™׳¨׳” ׳•׳׳ ׳\"׳‘׳˜׳\".")
    if model.parse_utc(ev["updated_at"], "u") < now - dt.timedelta(seconds=settings["undo_window_s"]):
        raise ApiError(409, "undo_expired", "׳¢׳‘׳¨ ׳”׳–׳׳ ׳׳‘׳™׳˜׳•׳ ׳”׳₪׳¢׳•׳׳”.", details={"undo_window_s": settings["undo_window_s"]})
    if model.parse_utc(ev["ends_at"], "e") <= now:
        raise _422("past_immutable", "׳”׳׳™׳¨׳•׳¢ ׳›׳‘׳¨ ׳”׳¡׳×׳™׳™׳.")
    d = draft_from(ctx, settings, {**_merged_body(ev, {}), "calendar_id": ev["calendar_id"]}, cal, role or "view")
    plans, _ = evaluate(ctx, settings, d, now, exclude=occ.family(conn, eid), skip_rule_checks=True)
    if prev == "confirmed" and any(pl.conflicts for pl in plans):
        raise ApiError(409, "conflict", "׳”׳׳•׳¢׳“ ׳ ׳×׳₪׳¡ ׳‘׳™׳ ׳×׳™׳™׳.", details={"conflicts": [c for pl in plans for c in pl.conflicts]})
    stamp = model.iso(now)
    _touch(conn, eid, p.user_id, stamp, state=prev, cancelled_from=None)
    conn.execute("UPDATE cal_event_rooms SET state = ? WHERE event_id = ? AND state IN ('cancelled','withdrawn')", (prev, eid))
    _log(conn, eid, "reopen", p.user_id, "restore", None, stamp)  # the history reads it as reopened (undo)
    guests.reset_erase_after(conn, eid, settings, now)
    notices.withdraw_for(conn, eid, now)
    occ.rebuild(conn, eid, settings, now)
    return {"event": get(ctx, eid), "state": prev}


def _merged_body(ev: sqlite3.Row, body: dict[str, Any]) -> dict[str, Any]:
    base = {"kind": ev["kind"], "title": ev["title"], "notes": ev["notes"], "start": ev["starts_at"], "end": ev["ends_at"], "all_day": bool(ev["all_day"]), "tz": ev["tz"],
            "rrule": ev["rrule"], "holiday_skip": bool(ev["holiday_skip"]), "headcount": ev["headcount"], "equipment_req": json.loads(ev["equipment_req_json"] or "[]"),
            "on_behalf": {"kind": ev["on_behalf_kind"], "label": ev["on_behalf_label"]}, "automation_hold": bool(ev["automation_hold"])}
    for k in ("title", "notes", "start", "end", "all_day", "tz", "rrule", "holiday_skip", "headcount", "equipment_req", "on_behalf", "automation_hold", "kind"):
        if k in body:
            base[k] = body[k]
    return base


def _cols(d: Draft, state: str, who: str, stamp: str) -> dict[str, Any]:
    return {"title": d.title, "notes": d.notes, "starts_at": model.iso(d.starts), "ends_at": model.iso(d.ends), "all_day": int(d.all_day), "tz": d.tz,
            "local_start": d.local_start.strftime(LOCAL_FMT), "local_end": d.local_end.strftime(LOCAL_FMT), "rrule": d.rrule, "holiday_skip": int(d.holiday_skip),
            "state": state, "on_behalf_kind": d.on_behalf_kind, "on_behalf_label": d.on_behalf_label, "headcount": d.headcount,
            "equipment_req_json": json.dumps(d.equipment_req), "automation_hold": int(d.automation_hold)}
