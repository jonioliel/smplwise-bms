"""CALENDARS-298 sections 7, 8, 13.3, 13.4 (+ owner answers C1-C3, C12) - approvals, maintenance windows over existing entries, expiry.

Priority (owner, 2026-10-29): the FIRST confirmed entry holds a window; a later request - an ordinary booking or a maintenance window -
waits for the manager, who sees how many requesters compete for the window and decides. Nothing is displaced unless the manager approves
with `displace_existing` (or the installation / calendar chose `override_notify`). A displaced entry is never deleted: its organizer is told
(notifications are a later slice) and picks an alternative himself."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any
from zoneinfo import ZoneInfo

from ...errors import ApiError
from ..tickets.hours import _local_instant
from . import events, guests, model, occ
from .access import Ctx, Denied, get_visible
from .calendars import new_id, user_label
from .events import _422, _insert_event, _log, _touch
from .recurrence import LOCAL_FMT, RuleError, parse_rule, series_end

STRICTNESS = ("block", "ask", "first_holds", "override_notify")  # strictest first


# ---------------------------------------------------------------- displacing

def displace(conn: sqlite3.Connection, settings: dict[str, Any], blocks: list[dict[str, Any]], actor: str, now: dt.datetime, note: str = "") -> list[str]:
    """Marks each blocking occurrence `displaced`. A single entry changes its state (the room half when the blocked time is a held room); one
    occurrence of a series gets an override row in state displaced. Returns the distinct affected event ids (the series id for a series)."""
    stamp = model.iso(now)
    touched: dict[str, None] = {}
    for b in blocks:
        ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (b["event_id"],)).fetchone()
        if ev is None:
            continue
        holder, home = b["calendar_id"], ev["calendar_id"]
        base = ev["override_of"] or ev["id"]
        room_half = holder != home
        if ev["rrule"] and not ev["override_of"]:  # one occurrence of a series -> an override row
            o = new_id("evt")
            dur = dt.datetime.strptime(ev["local_end"], LOCAL_FMT) - dt.datetime.strptime(ev["local_start"], LOCAL_FMT)
            ls = dt.datetime.strptime(b["local_start"], LOCAL_FMT)
            le = ls + dur
            zone = ZoneInfo(ev["tz"])
            row = {"id": o, "calendar_id": home, "kind": ev["kind"], "title": ev["title"], "notes": ev["notes"],
                   "starts_at": model.iso(_local_instant(ls.date(), ls.time(), zone)), "ends_at": model.iso(_local_instant(le.date(), le.time(), zone)),
                   "all_day": ev["all_day"], "tz": ev["tz"], "local_start": b["local_start"], "local_end": le.strftime(LOCAL_FMT), "override_of": ev["id"],
                   "override_start": b["local_start"], "state": "displaced", "organizer_user_id": ev["organizer_user_id"], "on_behalf_kind": ev["on_behalf_kind"],
                   "on_behalf_label": ev["on_behalf_label"], "headcount": ev["headcount"], "equipment_req_json": ev["equipment_req_json"], "source": "arx",
                   "created_by": actor, "created_at": stamp, "updated_by": actor, "updated_at": stamp}
            _insert_event(conn, row)
            _log(conn, o, "displace", actor, note, holder if room_half else None, stamp)
            touched[ev["id"]] = None
            touched[o] = None
            continue
        if room_half and not ev["override_of"]:
            conn.execute("UPDATE cal_event_rooms SET state = 'displaced' WHERE event_id = ? AND room_calendar_id = ?", (base, holder))
            _touch(conn, ev["id"], actor, stamp)
        else:
            _touch(conn, ev["id"], actor, stamp, state="displaced")
        _log(conn, ev["id"], "displace", actor, note, holder if room_half else None, stamp)
        touched[base] = None
    return list(touched)


def _alternatives(conn: sqlite3.Connection, settings: dict[str, Any], rooms: list[sqlite3.Row], start: dt.datetime, end: dt.datetime) -> list[dict[str, str]]:
    minutes = max(int((end - start).total_seconds() // 60), 5)
    return occ.free_slots(conn, rooms[0], settings, start, minutes) if rooms else []


# ---------------------------------------------------------------- requests and decisions

KIND_PRIORITY = {"maintenance": 0, "team": 1, "department": 1}  # contested_order = by_kind: maintenance, then teams, then everyone else


def _rank_queue(out: list[dict[str, Any]], order: str) -> None:
    """CALENDARS-UI-2310 (owner answer 11 as a setting): each request's place among the pending requests of the same calendar whose windows
    overlap it. first_come (default) and by_kind also name the request the manager is offered first (`suggested`); manual names none."""
    def key(r: dict[str, Any]) -> tuple[Any, ...]:
        pri = KIND_PRIORITY.get(r["kind"], KIND_PRIORITY.get(r.get("_behalf") or "", 2)) if order == "by_kind" else 0
        return (pri, r["requested_at"], r["_seq"])  # the insertion order breaks a tie of the same second

    for r in out:
        holder = r["room_calendar_id"] or r["calendar"]["id"]
        rivals = [o for o in out if (o["room_calendar_id"] or o["calendar"]["id"]) == holder and o["start"] < r["end"] and o["end"] > r["start"]]
        r["queue_position"] = 1 + sum(1 for o in rivals if key(o) < key(r))
        r["suggested"] = order != "manual" and r["queue_position"] == 1 and len(rivals) > 1
    for r in out:
        r.pop("_behalf", None)
        r.pop("_seq", None)


def requests(ctx: Ctx, *, calendars: list[str] | None = None, state: str = "pending", order: str = "first_come") -> list[dict[str, Any]]:
    conn = ctx.conn
    out = []
    for cal in conn.execute("SELECT * FROM cal_calendars WHERE archived_at IS NULL ORDER BY name_key").fetchall():
        if calendars and cal["id"] not in calendars or not ctx.can_see(cal) or ctx.role_in(cal) != "manage":
            continue
        rows = conn.execute(
            """SELECT e.*, e.rowid AS seq, NULL AS room_id FROM cal_events e WHERE e.calendar_id = ? AND e.state = ? AND e.override_of IS NULL AND e.kind <> 'maintenance'
                 AND e.id NOT IN (SELECT event_id FROM cal_event_rooms WHERE room_calendar_id = ?)
               UNION ALL
               SELECT e.*, e.rowid AS seq, r.room_calendar_id AS room_id FROM cal_event_rooms r JOIN cal_events e ON e.id = r.event_id WHERE r.room_calendar_id = ? AND r.state = ?
               ORDER BY starts_at""", (cal["id"], state, cal["id"], cal["id"], state)).fetchall()
        for e in rows:
            comp = conn.execute(
                """SELECT COUNT(DISTINCT o2.event_id) FROM cal_occurrences o1 JOIN cal_occurrences o2
                     ON o2.holder_calendar_id = o1.holder_calendar_id AND o2.state = 'pending' AND o2.occ_start < o1.occ_end AND o2.occ_end > o1.occ_start
                   WHERE o1.event_id = ? AND o1.holder_calendar_id = ?""", (e["id"], cal["id"])).fetchone()[0]
            held = conn.execute(
                """SELECT COUNT(DISTINCT o2.event_id) FROM cal_occurrences o1 JOIN cal_occurrences o2
                     ON o2.holder_calendar_id = o1.holder_calendar_id AND o2.state = 'confirmed' AND o2.occ_start < o1.occ_end AND o2.occ_end > o1.occ_start
                   WHERE o1.event_id = ? AND o1.holder_calendar_id = ? AND o2.event_id <> o1.event_id""", (e["id"], cal["id"])).fetchone()[0]
            out.append({"event_id": e["id"], "room_calendar_id": e["room_id"], "calendar": {"id": cal["id"], "name": cal["name"], "color": cal["color"]}, "title": e["title"],
                        "kind": e["kind"], "start": e["starts_at"], "end": e["ends_at"], "recurring": bool(e["rrule"]), "organizer": user_label(conn, e["organizer_user_id"]),
                        "on_behalf_label": e["on_behalf_label"], "headcount": e["headcount"], "contested": bool(e["contested"]), "competing_count": comp,
                        "conflicts_now": held, "requested_at": e["created_at"], "revision": e["revision"], "_behalf": e["on_behalf_kind"], "_seq": e["seq"]})
    _rank_queue(out, order)
    return out


def _half_state(conn: sqlite3.Connection, ev: sqlite3.Row, holder_id: str) -> str | None:
    if holder_id == ev["calendar_id"]:
        return ev["state"]
    r = conn.execute("SELECT state FROM cal_event_rooms WHERE event_id = ? AND room_calendar_id = ?", (ev["id"], holder_id)).fetchone()
    return r["state"] if r else None


def _set_half(conn: sqlite3.Connection, ev: sqlite3.Row, holder_id: str, state: str, actor: str, stamp: str, note: str = "") -> None:
    if holder_id == ev["calendar_id"]:
        _touch(conn, ev["id"], actor, stamp, state=state, contested=0)
    else:
        conn.execute("UPDATE cal_event_rooms SET state = ?, contested = 0, decided_by = ?, decided_at = ?, decision_note = ? WHERE event_id = ? AND room_calendar_id = ?",
                     (state, actor, stamp, note[:300], ev["id"], holder_id))
        _touch(conn, ev["id"], actor, stamp)
        if ev["kind"] == "maintenance":  # a maintenance window has no approval of its own: its state follows its rooms
            states = {r[0] for r in conn.execute("SELECT state FROM cal_event_rooms WHERE event_id = ?", (ev["id"],)).fetchall()}
            agg = "pending" if "pending" in states else ("confirmed" if "confirmed" in states else "rejected")
            conn.execute("UPDATE cal_events SET state = ?, contested = ? WHERE id = ?", (agg, int(agg == "pending"), ev["id"]))


def _load(ctx: Ctx, eid: str, rid: Any) -> tuple[sqlite3.Row, sqlite3.Row]:
    """The entry and the calendar whose half is being decided. A room's manager reaches a team's entry through the room row even when he
    cannot see the team's calendar; an unknown id, or a room that does not hold the entry, is the uniform 404."""
    ev = ctx.conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    if ev is None:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    if rid and rid != ev["calendar_id"]:
        holder = get_visible(ctx, rid)
        if ctx.conn.execute("SELECT 1 FROM cal_event_rooms WHERE event_id = ? AND room_calendar_id = ?", (eid, rid)).fetchone() is None:
            raise ApiError(404, "not_found", "הבקשה לא נמצאה.")
        return ev, holder
    return ev, get_visible(ctx, ev["calendar_id"])


def _out(ctx: Ctx, eid: str, holder: sqlite3.Row) -> dict[str, Any]:
    ev = ctx.conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    return events.serialize(ctx, ev, holder, ctx.role_in(holder))


def calendar_manager(ctx: Ctx, cal: sqlite3.Row) -> bool:
    """The calendar's OWN manager: its owner, or a member holding `manage` in it (owner answer 12: displacing needs the calendar manager's
    approval - a system or site manager reaches `manage` through his role, which is not enough while `displace_approver` is calendar_manager)."""
    if cal["owner_user_id"] == ctx.principal.user_id:
        return True
    for m in ctx.conn.execute("SELECT subject_kind, subject_id FROM cal_members WHERE calendar_id = ? AND cal_role = 'manage'", (cal["id"],)).fetchall():
        k, sid = m["subject_kind"], m["subject_id"]
        if (k == "user" and sid == ctx.principal.user_id) or (k == "role" and sid in ctx.roles) or (k == "department" and sid in ctx.departments) or k == "everyone":
            return True
    return False


def decide(ctx: Ctx, settings: dict[str, Any], eid: str, body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    conn, p = ctx.conn, ctx.principal
    ev, holder = _load(ctx, eid, body.get("room_calendar_id"))
    if ctx.role_in(holder) != "manage":
        raise Denied("calendar.role", holder["id"], "manage")
    events._check_rev(ev, body)
    decision = body.get("decision")
    model._choice(decision, "decision", ("approve", "reject"))
    note = model._text(body.get("note") or "", "note", 0, 300)
    cur = _half_state(conn, ev, holder["id"])
    if cur is None:
        raise ApiError(404, "not_found", "הבקשה לא נמצאה.")
    if cur != "pending":
        raise ApiError(409, "bad_state", "הבקשה כבר הוכרעה.", details={"state": cur})
    stamp = model.iso(now)
    if decision == "reject":
        _set_half(conn, ev, holder["id"], "rejected", p.user_id, stamp, note)
        _log(conn, eid, "reject", p.user_id, note, None if holder["id"] == ev["calendar_id"] else holder["id"], stamp)
        guests.reset_erase_after(conn, eid, settings, now)
        occ.rebuild(conn, eid, settings, now)
        return {"event": _out(ctx, eid, holder), "state": "rejected"}
    excepts = body.get("except_occurrences") or []
    if excepts and (not ev["rrule"] or not isinstance(excepts, list) or any(not isinstance(x, str) for x in excepts)):
        raise model.Invalid("except_occurrences: local starts of a series", "except_occurrences")
    # nothing is written before every refusal (ApiError commits the transaction): the exdates are stored after the conflict check
    spans = [(o.start_utc, o.end_utc) for o in occ.event_occurrences(conn, ev, settings, now) if o.key not in set(excepts)]
    held = occ.blockers(conn, holder, spans, settings, exclude=occ.family(conn, eid), states=("confirmed",))
    if held:
        if body.get("displace_existing") is not True:
            raise ApiError(409, "slot_held", "החלון כבר תפוס על ידי אירוע שאושר קודם.", details={"conflicts": held})
        if not settings["allow_displace"]:  # owner answer 12 as a setting: "do not displace a confirmed entry, only reject the requests"
            raise ApiError(409, "displace_disabled", "בהתקנה הזאת אי אפשר לדחוק הזמנה שאושרה. אפשר לדחות את הבקשה.", details={"conflicts": held})
        if settings["displace_approver"] == "calendar_manager" and not calendar_manager(ctx, holder):
            raise Denied("calendar.role", holder["id"], "calendar_manager")
        displaced = displace(conn, settings, _with_local(conn, held, holder["id"], spans), p.user_id, now, "displaced_by_decision")
        for d_id in displaced:
            occ.rebuild(conn, d_id, settings, now)
    if excepts:
        _touch(conn, eid, p.user_id, stamp, exdates_json=json.dumps(sorted(set(json.loads(ev["exdates_json"] or "[]")) | set(excepts))))
        ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    _set_half(conn, ev, holder["id"], "confirmed", p.user_id, stamp, note)
    _log(conn, eid, "approve", p.user_id, note, None if holder["id"] == ev["calendar_id"] else holder["id"], stamp)
    if excepts:
        _log(conn, eid, "approve", p.user_id, f"except:{len(excepts)}", None, stamp)
    occ.rebuild(conn, eid, settings, now)
    return {"event": _out(ctx, eid, holder), "state": "confirmed"}


def _with_local(conn: sqlite3.Connection, held: list[dict[str, Any]], holder_id: str, spans: Any) -> list[dict[str, Any]]:
    """`blockers` rows carry start/end; `displace` needs the local start of the exact cached occurrence."""
    out = []
    for b in held:
        r = conn.execute("SELECT local_start FROM cal_occurrences WHERE event_id = ? AND holder_calendar_id = ? AND occ_start = ?", (b["event_id"], holder_id, b["start"])).fetchone()
        out.append({**b, "local_start": r["local_start"] if r else ""})
    return out


def reopen(ctx: Ctx, settings: dict[str, Any], eid: str, body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    conn, p = ctx.conn, ctx.principal
    ev, holder = _load(ctx, eid, body.get("room_calendar_id"))
    if ctx.role_in(holder) != "manage":
        raise Denied("calendar.role", holder["id"], "manage")
    events._check_rev(ev, body)
    cur = _half_state(conn, ev, holder["id"])
    if cur not in ("rejected", "expired", "withdrawn"):
        raise ApiError(409, "bad_state", "אפשר לפתוח מחדש רק בקשה שנדחתה, פגה או נמשכה.", details={"state": cur})
    days = settings["reopen_days"]
    if model.parse_utc(ev["updated_at"], "u") < now - dt.timedelta(days=days):
        raise ApiError(409, "reopen_window_closed", f"עברו יותר מ-{days} ימים.")
    stamp = model.iso(now)
    _set_half(conn, ev, holder["id"], "pending", p.user_id, stamp)
    _log(conn, eid, "reopen", p.user_id, "", None if holder["id"] == ev["calendar_id"] else holder["id"], stamp)
    occ.rebuild(conn, eid, settings, now)
    return {"event": _out(ctx, eid, holder)}


# ---------------------------------------------------------------- maintenance windows

def _maint_input(ctx: Ctx, settings: dict[str, Any], body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    cal = get_visible(ctx, body.get("calendar_id"))
    if cal["type"] != "maintenance":
        raise model.Invalid("calendar_id: a maintenance calendar", "calendar_id")
    rids = body.get("rooms")
    if not isinstance(rids, list) or not rids or len(rids) > 10 or len(set(rids)) != len(rids):
        raise model.Invalid("rooms: 1-10 distinct room calendars", "rooms")
    rooms = [get_visible(ctx, r) for r in rids]
    if any(r["type"] != "room" for r in rooms):
        raise model.Invalid("rooms: room calendars only", "rooms")
    s, e, ls, le = events._times(body, cal["tz"], bool(body.get("all_day", False)))
    rr = body.get("rrule")
    if rr is not None:
        try:
            parse_rule(rr)
        except (RuleError, AttributeError):
            raise _422("rrule_unsupported", "חוק החזרתיות אינו נתמך.") from None
    ev_like = {"id": "", "local_start": ls.strftime(LOCAL_FMT), "local_end": le.strftime(LOCAL_FMT), "tz": cal["tz"], "rrule": rr, "exdates_json": "[]", "holiday_skip": 0}
    try:
        occs = occ.event_occurrences(conn=ctx.conn, ev=ev_like, settings=settings, now=now)  # type: ignore[arg-type]
    except RuleError as exc:
        raise _422(exc.code, "הסדרה ארוכה מדי.") from None
    if not occs:
        raise _422("no_occurrences", "החוק לא יוצר אף מועד בחלון הקרוב.")
    modes = [r["overlap_override"] or settings["maintenance_overlap"] for r in rooms]
    mode = min(modes, key=STRICTNESS.index)
    overlaps: list[dict[str, Any]] = []
    for r in rooms:
        overlaps += occ.blockers(ctx.conn, r, [(o.start_utc, o.end_utc) for o in occs], settings, states=("confirmed",))
    return {"cal": cal, "rooms": rooms, "start": s, "end": e, "ls": ls, "le": le, "rrule": rr, "occs": occs, "mode": mode, "overlaps": overlaps}


def _overlap_view(ctx: Ctx, overlaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for o in overlaps:
        ev = ctx.conn.execute("SELECT title, organizer_user_id, calendar_id FROM cal_events WHERE id = ?", (o["event_id"],)).fetchone()
        home = ctx.conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (ev["calendar_id"],)).fetchone() if ev else None
        visible = bool(home and ctx.can_see(home) and ctx.role_in(home) is not None)
        out.append({"event_id": o["event_id"], "calendar_id": o["calendar_id"], "start": o["start"], "end": o["end"], "state": o["state"],
                    "title": ev["title"] if ev and visible else None, "organizer": user_label(ctx.conn, ev["organizer_user_id"]) if ev and visible else None})
    return out


def maintenance_preview(ctx: Ctx, settings: dict[str, Any], body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    m = _maint_input(ctx, settings, body, now)
    return {"overlaps": _overlap_view(ctx, m["overlaps"]), "mode": m["mode"], "alternatives": _alternatives(ctx.conn, settings, m["rooms"], m["start"], m["end"]) if m["overlaps"] else []}


def maintenance_place(ctx: Ctx, settings: dict[str, Any], body: dict[str, Any], now: dt.datetime) -> dict[str, Any]:
    conn, p = ctx.conn, ctx.principal
    m = _maint_input(ctx, settings, body, now)
    cal, rooms, mode, overlaps = m["cal"], m["rooms"], m["mode"], m["overlaps"]
    decision = body.get("overlap_decision")
    if decision is not None:
        model._choice(decision, "overlap_decision", ("override_notify", "block"))
    if overlaps:
        if mode == "ask":
            if decision is None:
                raise _422("overlap_decision_required", "יש חפיפה עם הזמנות קיימות. יש להחליט.", overlaps=_overlap_view(ctx, overlaps))
            mode = decision
        if mode == "block":
            raise ApiError(409, "maintenance_overlap", "אי אפשר להציב תחזוקה מעל הזמנה קיימת.",
                           details={"overlaps": _overlap_view(ctx, overlaps), "alternatives": _alternatives(conn, settings, rooms, m["start"], m["end"])})
    own = occ.blockers(conn, cal, [(o.start_utc, o.end_utc) for o in m["occs"]], settings)
    if own:
        raise ApiError(409, "conflict", "כבר יש חלון תחזוקה באותו זמן ביומן הזה.", details={"conflicts": own})
    title = model._text(body.get("title"), "title", 1, 120)
    notes = model._text(body.get("notes") or "", "notes", 0, 2000)
    dev = body.get("expected_deviation")
    if dev is not None and (not isinstance(dev, dict) or set(dev) - {"devices", "areas", "note"}):
        raise model.Invalid("expected_deviation: {devices, areas, note}", "expected_deviation")
    wait = bool(overlaps) and mode == "first_holds"  # C3: the first confirmed entry holds the window; the manager decides
    state = "pending" if wait else "confirmed"
    eid, stamp = new_id("evt"), model.iso(now)
    sup = series_end(parse_rule(m["rrule"]), m["ls"], m["le"], cal["tz"], settings["series_horizon_days"]) if m["rrule"] else _local_instant(m["le"].date(), m["le"].time(), ZoneInfo(cal["tz"]))
    _insert_event(conn, {
        "id": eid, "calendar_id": cal["id"], "kind": "maintenance", "title": title, "notes": notes, "starts_at": model.iso(m["start"]), "ends_at": model.iso(m["end"]),
        "all_day": int(bool(body.get("all_day", False))), "tz": cal["tz"], "local_start": m["ls"].strftime(LOCAL_FMT), "local_end": m["le"].strftime(LOCAL_FMT), "rrule": m["rrule"],
        "series_until": model.iso(sup) if sup else None, "state": state, "contested": int(wait), "organizer_user_id": p.user_id, "on_behalf_kind": "self",
        "maint_overlap_mode": mode if overlaps else None, "expected_deviation_json": json.dumps(dev) if dev else None, "source": "arx",
        "created_by": p.user_id, "created_at": stamp, "updated_by": p.user_id, "updated_at": stamp})
    for r in rooms:
        conn.execute("INSERT INTO cal_event_rooms(event_id, room_calendar_id, state, contested) VALUES (?,?,?,?)", (eid, r["id"], state, int(wait)))
    if wait:
        _log(conn, eid, "request", p.user_id, "contested", None, stamp)
    displaced: list[str] = []
    if overlaps and mode == "override_notify":
        displaced = displace(conn, settings, _with_local_multi(conn, overlaps), p.user_id, now, "displaced_by_maintenance")
        for d_id in displaced:
            occ.rebuild(conn, d_id, settings, now)
    occ.rebuild(conn, eid, settings, now)
    return {"event": events.get(ctx, eid), "displaced": displaced}


def _with_local_multi(conn: sqlite3.Connection, held: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for b in held:
        r = conn.execute("SELECT local_start FROM cal_occurrences WHERE event_id = ? AND holder_calendar_id = ? AND occ_start = ?", (b["event_id"], b["calendar_id"], b["start"])).fetchone()
        out.append({**b, "local_start": r["local_start"] if r else ""})
    return out


# ---------------------------------------------------------------- time-driven transitions

def expire_and_finish(conn: sqlite3.Connection, settings: dict[str, Any], now: dt.datetime) -> dict[str, int]:
    """`pending` requests whose decision time passed become `expired` (approval_timeout_h before the next start; NULL = at the start);
    `confirmed` entries whose last occurrence ended become `done`. Returns counts."""
    stamp = model.iso(now)
    expired = done = 0
    for r in conn.execute("""SELECT e.id, e.state AS ev_state, c.id AS cid, c.approval_timeout_h AS tmo, 'home' AS half FROM cal_events e JOIN cal_calendars c ON c.id = e.calendar_id
                              WHERE e.state = 'pending' AND e.override_of IS NULL
                             UNION ALL
                             SELECT e.id, r.state, c.id, c.approval_timeout_h, 'room' FROM cal_event_rooms r JOIN cal_events e ON e.id = r.event_id
                              JOIN cal_calendars c ON c.id = r.room_calendar_id WHERE r.state = 'pending'""").fetchall():
        nxt = conn.execute("SELECT MIN(occ_start) FROM cal_occurrences WHERE event_id = ? AND holder_calendar_id = ? AND occ_end > ?", (r["id"], r["cid"], stamp)).fetchone()[0]
        due = (nxt is None) or model.parse_utc(nxt, "n") - dt.timedelta(hours=r["tmo"] or 0) <= now
        if not due:
            continue
        ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (r["id"],)).fetchone()
        if r["half"] == "home":
            _touch(conn, ev["id"], "system", stamp, state="expired")
        else:
            conn.execute("UPDATE cal_event_rooms SET state = 'expired', decided_at = ? WHERE event_id = ? AND room_calendar_id = ?", (stamp, ev["id"], r["cid"]))
        _log(conn, ev["id"], "expire", None, "", None if r["half"] == "home" else r["cid"], stamp)
        guests.reset_erase_after(conn, ev["id"], settings, now)
        occ.rebuild(conn, ev["id"], settings, now)
        expired += 1
    for (eid,) in conn.execute("SELECT id FROM cal_events WHERE state = 'confirmed' AND override_of IS NULL AND COALESCE(series_until, ends_at) <= ? AND (rrule IS NULL OR series_until IS NOT NULL)", (stamp,)).fetchall():
        conn.execute("UPDATE cal_events SET state = 'done', updated_at = ?, revision = revision + 1 WHERE id = ?", (stamp, eid))
        conn.execute("UPDATE cal_event_rooms SET state = 'done' WHERE event_id = ? AND state = 'confirmed'", (eid,))
        conn.execute("UPDATE cal_occurrences SET state = 'done' WHERE event_id = ? AND state = 'confirmed'", (eid,))
        done += 1
    return {"expired": expired, "done": done}
