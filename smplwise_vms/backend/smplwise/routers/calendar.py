"""CALENDARS-298 phase 1 - the calendars and room-booking API (docs/changes/CALENDARS-CONTRACT-298.md section 13).

Order of every gated route: signed in -> module switch (404 `feature_disabled` while `calendar.enabled` is off - a router-level dependency) ->
calendar visibility (a calendar outside the caller's reach is the same 404 as an unknown id) -> role / permission (the audited 403) -> validation
(422) -> conflict (409). `open_router` answers while the module is off: the module state, the settings document and the guest purge.

Not in this slice (later phases of the contract): feeds and connections (4-6), automation triggers and ticket projections (3),
notification sources, the screens (2)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services.calendar import calendars as cals
from ..services.calendar import decisions, events, guests, jobs, model, occ
from ..services.calendar.access import Ctx, Denied, get_visible, scope_of

OFF_HE = "מודול היומנים כבוי בהגדרות המערכת."


def _now() -> dt.datetime:
    """The route clock (tests replace it)."""
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def module_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    if not model.read_settings(conn)["enabled"]:
        raise ApiError(404, "feature_disabled", OFF_HE)


open_router = APIRouter()
router = APIRouter(dependencies=[Depends(module_gate)])


@contextmanager
def _errors(conn: sqlite3.Connection, principal: Principal, request: Request) -> Iterator[None]:
    """Turns the module's domain errors into the API envelope: Denied -> the audited 403, Invalid -> 422."""
    try:
        yield
    except Denied as exc:
        audit(conn, actor=principal, action=exc.permission, decision="denied", resource_type="calendar", resource_id=exc.resource_id, reason=exc.need or "no_role", request_id=_rid(request))
        raise ApiError(403, "forbidden", "אין הרשאה לפעולה הזו ביומן.", details={"permission": exc.permission}) from None
    except model.Invalid as exc:
        raise ApiError(422, exc.code, str(exc), details={"field": exc.field}) from None


def _ctx(request: Request, conn: sqlite3.Connection, principal: Principal) -> Ctx:
    return Ctx(conn, principal, settings_of(request).data_dir)


def _audit(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, rtype: str, rid: str, **details: Any) -> None:
    audit(conn, actor=principal, action=action, decision="allowed", resource_type=rtype, resource_id=rid, request_id=_rid(request), details=details or None)


def _need_view(conn: sqlite3.Connection, principal: Principal) -> None:
    if model.PERM_VIEW in permissions_anywhere(conn, principal):
        return
    audit(conn, actor=principal, action=model.PERM_VIEW, decision="denied", resource_type="installation", resource_id="calendar", reason="no_binding")
    raise ApiError(403, "forbidden", "אין הרשאה ליומנים.", details={"permission": model.PERM_VIEW})


class Body(BaseModel):
    """Free-form JSON body: every field is validated by the module's own validators (unknown keys are refused there)."""

    model_config = ConfigDict(extra="allow")


def _body(b: Body) -> dict[str, Any]:
    return dict(b.model_extra or {}) | {k: v for k, v in b.__dict__.items() if not k.startswith("_")}


def _instant(v: str | None, field: str) -> dt.datetime:
    if v is None:
        raise ApiError(422, "validation", f"{field} is required", details={"field": field})
    try:
        return model.parse_utc(v, field)
    except model.Invalid as exc:
        raise ApiError(422, "validation", str(exc), details={"field": field}) from None


# ---------------------------------------------------------------- module state and settings (answer while the module is off)

@open_router.get("/calendar/module")
def module_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    s = model.read_settings(conn)
    anywhere = set(permissions_anywhere(conn, principal))
    return {"enabled": s["enabled"], "menu_position": s["menu_position"],
            "can": {p.split(".", 1)[1]: p in anywhere for p in model.ALL_PERMS},
            # CALENDARS-UI-2310: the presentation choices every screen needs before it draws (the whole document is GET /calendar/settings)
            "ui": {k: s[k] for k in model.UI_CHOICES} | {"allow_displace": s["allow_displace"], "guest_details_enabled": s["guest_details_enabled"]}}


@open_router.get("/calendar/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    anywhere = set(permissions_anywhere(conn, principal))
    if model.PERM_VIEW not in anywhere and model.PERM_CONFIGURE not in anywhere:
        require(conn, principal, model.PERM_CONFIGURE, INSTALLATION)
    return {"settings": model.read_settings(conn), "can_configure": model.PERM_CONFIGURE in anywhere}


@open_router.put("/calendar/settings")
def put_settings(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, model.PERM_CONFIGURE, INSTALLATION)
    with _errors(conn, principal, request):
        old = model.read_settings(conn)
        new = model.settings_doc(_body(body))
        now = _now()
        changed = sorted(k for k in new if new[k] != old.get(k))
        preview = guests.erase_preview(conn, new, now) if "guest_retention_days" in changed else 0
        if changed:
            from ..db import set_setting  # noqa: PLC0415

            set_setting(conn, model.SETTINGS_KEY, json.dumps(new, ensure_ascii=False, sort_keys=True))
            if "guest_retention_days" in changed:
                guests.recompute_all(conn, new, now)
            if "enabled" in changed:
                _audit(conn, principal, request, "calendar.module.enable" if new["enabled"] else "calendar.module.disable", "installation", "calendar")
            _audit(conn, principal, request, "calendar.settings.update", "installation", "calendar", keys=changed)
    return {"settings": new, "erase_preview": preview}


@open_router.post("/calendar/guests/purge")
def purge_guests(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """C4: destroys every guest name and phone now. Counts only in the audit row."""
    require(conn, principal, model.PERM_CONFIGURE, INSTALLATION)
    n = guests.purge_all(conn, model.iso(_now()))
    _audit(conn, principal, request, "calendar.guests.erase", "installation", "calendar", records=n, scope="all")
    return {"erased": n}


# ---------------------------------------------------------------- calendars

@router.get("/calendar/calendars")
def list_calendars(type: str | None = Query(default=None), include_archived: int = Query(default=0), principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_view(conn, principal)
    return {"calendars": cals.listing(Ctx(conn, principal), type_=type, include_archived=bool(include_archived))}


@router.post("/calendar/calendars", status_code=201)
def create_calendar(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    data = _body(body)
    area = data.get("area_ref")
    target = ("floor", cals.floor_of_area(conn, area)) if isinstance(area, str) and cals.floor_of_area(conn, area) else INSTALLATION
    require(conn, principal, model.PERM_MANAGE, target)
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        model.check_override(model.read_settings(conn), data.get("overlap_override"))
        row = cals.create(ctx, data, model.read_settings(conn))
        _audit(conn, principal, request, "calendar.calendar.create", "calendar", row["id"])
        return {"calendar": cals.serialize(conn, row, ctx.role_in(row))}


@router.get("/calendar/calendars/{cid}")
def get_calendar(cid: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    ctx = Ctx(conn, principal)
    cal = get_visible(ctx, cid)
    role = ctx.role_in(cal)
    return {"calendar": cals.serialize(conn, cal, role), "members_summary": {"count": conn.execute("SELECT COUNT(*) FROM cal_members WHERE calendar_id = ?", (cid,)).fetchone()[0]}}


@router.patch("/calendar/calendars/{cid}")
def patch_calendar(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    cal = get_visible(ctx, cid)
    data = _body(body)
    with _errors(conn, principal, request):
        if ctx.role_in(cal) != "manage":
            raise Denied("calendar.role", cid, "manage")
        if "overlap_override" in data:
            model.check_override(model.read_settings(conn), data["overlap_override"])
        if "owner_user_id" in data and data["owner_user_id"] != cal["owner_user_id"]:
            if not ctx.has(model.PERM_MANAGE, scope_of(cal)):
                raise Denied(model.PERM_MANAGE, cid, "owner")
        row = cals.update(ctx, cal, {k: v for k, v in data.items() if k != "owner_user_id"})
        if "owner_user_id" in data and data["owner_user_id"] != cal["owner_user_id"]:
            cals.change_owner(conn, row, str(data["owner_user_id"]), principal.user_id)
            row = conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cid,)).fetchone()
        _audit(conn, principal, request, "calendar.calendar.update", "calendar", cid, keys=sorted(k for k in data if k != "revision"))
        return {"calendar": cals.serialize(conn, row, ctx.role_in(row))}


@router.post("/calendar/calendars/{cid}/archive")
def archive_calendar(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    cal = get_visible(ctx, cid)
    require(conn, principal, model.PERM_MANAGE, scope_of(cal))
    cancelled = cals.archive(conn, cal, _body(body), model.iso(_now()))
    _audit(conn, principal, request, "calendar.calendar.archive", "calendar", cid, cancelled=len(cancelled))
    return {"calendar": cals.serialize(conn, conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cid,)).fetchone(), "manage"), "cancelled": len(cancelled)}


@router.post("/calendar/calendars/{cid}/restore")
def restore_calendar(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    cal = get_visible(ctx, cid, include_archived=True)
    require(conn, principal, model.PERM_MANAGE, scope_of(cal))
    cals.restore(conn, cal, model.iso(_now()))
    _audit(conn, principal, request, "calendar.calendar.restore", "calendar", cid)
    return {"calendar": cals.serialize(conn, conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cid,)).fetchone(), "manage")}


@router.get("/calendar/calendars/{cid}/members")
def get_members(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    cal = get_visible(ctx, cid)
    with _errors(conn, principal, request):
        if ctx.role_in(cal) != "manage":
            raise Denied("calendar.role", cid, "manage")
        return {"members": cals.members(conn, cid)}


@router.put("/calendar/calendars/{cid}/members")
def put_members(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    cal = get_visible(ctx, cid)
    with _errors(conn, principal, request):
        if ctx.role_in(cal) != "manage":
            raise Denied("calendar.role", cid, "manage")
        out = cals.put_members(ctx, cal, _body(body))
        _audit(conn, principal, request, "calendar.members.update", "calendar", cid, count=len(out))
        return {"members": out}


# ---------------------------------------------------------------- entries

@router.get("/calendar/occurrences")
def get_occurrences(frm: str = Query(alias="from"), to: str = Query(), calendars: str = Query(default=""), kinds: str = Query(default=""), states: str = Query(default=""),
                    principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_view(conn, principal)
    a, b = _instant(frm, "from"), _instant(to, "to")
    if b <= a or b - a > dt.timedelta(days=62):
        raise ApiError(422, "validation", "from..to: up to 62 days", details={"field": "to"})
    split = lambda v: [x for x in v.split(",") if x] or None  # noqa: E731
    return events.occurrences(Ctx(conn, principal), a, b, calendars=split(calendars), kinds=split(kinds), states=split(states))


@router.get("/calendar/rooms/day")
def rooms_day(date: str = Query(), calendars: str = Query(default=""), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_view(conn, principal)
    try:
        day = dt.date.fromisoformat(date)
    except ValueError:
        raise ApiError(422, "validation", "date: YYYY-MM-DD", details={"field": "date"}) from None
    ctx = Ctx(conn, principal)
    s = model.read_settings(conn)
    want = {x for x in calendars.split(",") if x}
    from zoneinfo import ZoneInfo  # noqa: PLC0415

    from ..services.tickets.hours import _local_instant  # noqa: PLC0415

    rooms = []
    for cal in conn.execute("SELECT * FROM cal_calendars WHERE type = 'room' AND archived_at IS NULL ORDER BY name_key").fetchall():
        if (want and cal["id"] not in want) or not ctx.can_see(cal):
            continue
        z = ZoneInfo(cal["tz"])
        a, b = _local_instant(day, dt.time(0), z), _local_instant(day + dt.timedelta(days=1), dt.time(0), z)
        hours = occ.hours_of(cal, s)
        open_ = [{"from": "00:00", "to": "24:00"}] if hours is None else ([{"from": hours["start"], "to": hours["end"]}] if day.isoweekday() in hours["weekdays"] else [])
        entries = events.occurrences(ctx, a, b, calendars=[cal["id"]], kinds=None, states=None)["occurrences"]
        rooms.append({"calendar_id": cal["id"], "name": cal["name"], "capacity": cal["capacity"], "equipment": json.loads(cal["equipment_json"]), "open": open_, "entries": entries})
    return {"rooms": rooms}


@router.post("/calendar/availability")
def availability(body: Body, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_view(conn, principal)
    d = _body(body)
    a, b = _instant(d.get("from"), "from"), _instant(d.get("to"), "to")
    dur = d.get("duration_min")
    if isinstance(dur, bool) or not isinstance(dur, int) or not 5 <= dur <= 1440 or b <= a or b - a > dt.timedelta(days=14):
        raise ApiError(422, "validation", "duration_min 5..1440, from < to within 14 days", details={"field": "duration_min"})
    hc = d.get("headcount")
    eq = d.get("equipment") or []
    ctx = Ctx(conn, principal)
    s = model.read_settings(conn)
    want = set(d.get("calendars") or [])
    free, nearest = [], []
    for cal in conn.execute("SELECT * FROM cal_calendars WHERE type = 'room' AND archived_at IS NULL ORDER BY name_key").fetchall():
        if (want and cal["id"] not in want) or not ctx.can_see(cal) or ctx.role_in(cal) is None:
            continue
        if any(e not in json.loads(cal["equipment_json"]) for e in eq) or (hc and cal["capacity"] and hc > cal["capacity"]):
            continue
        for sl in occ.free_slots(conn, cal, s, a, dur, headcount=hc, count=20, span_hours=int((b - a).total_seconds() // 3600) or 1):
            if model.parse_utc(sl["end"], "e") <= b:
                free.append({"calendar_id": cal["id"], **sl})
        if not free:
            nearest += [{"calendar_id": cal["id"], **sl} for sl in occ.free_slots(conn, cal, s, b, dur, headcount=hc, count=3)]
    free.sort(key=lambda x: x["start"])
    nearest.sort(key=lambda x: x["start"])
    return {"free": free[:20], "nearest": nearest[:20]}


@router.post("/calendar/events", status_code=201)
def create_event(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        out = events.create(ctx, model.read_settings(conn), _body(body), _now())
        ev = out["event"]
        _audit(conn, principal, request, "calendar.event.create", "calendar_event", ev["id"], calendar_id=ev["calendar_id"], state=out["state"], recurring=bool(ev["rrule"]))
        return out


@router.post("/calendar/events/preview")
def preview_event(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        return events.preview(ctx, model.read_settings(conn), _body(body), _now())


@router.get("/calendar/events/{eid}")
def get_event(eid: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    ctx = Ctx(conn, principal)
    ev, cal, role = events.get_row(ctx, eid)
    out = events.serialize(ctx, ev, cal, role)
    strong = bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
    history = []
    if strong or ev["organizer_user_id"] == principal.user_id:
        history = [{"action": r["action"], "room_calendar_id": r["room_calendar_id"], "actor": r["actor_user_id"], "note": r["note"], "at": r["at"]}
                   for r in conn.execute("SELECT * FROM cal_approvals WHERE event_id = ? ORDER BY rowid", (eid,)).fetchall()]
    return {"event": out, "history": history, "guests_count": guests.count(conn, eid) if strong or ev["organizer_user_id"] == principal.user_id else 0,
            "guests_visible": bool(role == "manage" or authorize(conn, principal, model.PERM_GUESTS, scope_of(cal)).allowed)}


@router.patch("/calendar/events/{eid}")
def patch_event(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        out = events.update(ctx, model.read_settings(conn), eid, _body(body), _now())
        _audit(conn, principal, request, "calendar.event.update", "calendar_event", eid, scope=_body(body).get("scope", "series"))
        return out


@router.post("/calendar/events/{eid}/cancel")
def cancel_event(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        out = events.cancel(ctx, model.read_settings(conn), eid, _body(body), _now())
        _audit(conn, principal, request, "calendar.event.cancel", "calendar_event", eid, scope=_body(body).get("scope", "series"))
        return out


@router.post("/calendar/events/{eid}/withdraw")
def withdraw_event(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        out = events.withdraw(ctx, model.read_settings(conn), eid, _body(body), _now())
        _audit(conn, principal, request, "calendar.request.withdraw", "calendar_event", eid)
        return out


def _guest_access(ctx: Ctx, ev: sqlite3.Row, cal: sqlite3.Row, role: str | None, *, write: bool) -> None:
    holds = ctx.has(model.PERM_GUESTS, scope_of(cal))
    ok = holds or (role == "manage") if not write else holds or bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
    if not ok:
        raise Denied(model.PERM_GUESTS, cal["id"], "manage")


@router.get("/calendar/events/{eid}/guests")
def get_guests(eid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    ev, cal, role = events.get_row(ctx, eid)
    with _errors(conn, principal, request):
        _guest_access(ctx, ev, cal, role, write=False)
    out = guests.read(conn, settings_of(request).data_dir, eid)
    _audit(conn, principal, request, "calendar.guests.read", "calendar_event", eid, records=len(out["guests"]))  # ids and counts only
    return out


@router.delete("/calendar/events/{eid}/guests", status_code=204)
def delete_guests(eid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    ctx = _ctx(request, conn, principal)
    ev, cal, role = events.get_row(ctx, eid)
    with _errors(conn, principal, request):
        _guest_access(ctx, ev, cal, role, write=True)
    n = guests.erase_event(conn, eid, model.iso(_now()))
    _audit(conn, principal, request, "calendar.guests.erase", "calendar_event", eid, records=n)
    return Response(status_code=204)


@router.get("/me/calendar")
def my_calendar(frm: str | None = Query(default=None, alias="from"), to: str | None = Query(default=None), principal: Principal = Depends(current_principal_ro),
                conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_view(conn, principal)
    a = _instant(frm, "from") if frm else _now()
    b = _instant(to, "to") if to else a + dt.timedelta(days=31)
    if b <= a or b - a > dt.timedelta(days=62):
        raise ApiError(422, "validation", "from..to: up to 62 days", details={"field": "to"})
    ctx = Ctx(conn, principal)
    mine = [o for o in events.occurrences(ctx, a, b, calendars=None, kinds=None, states=None)["occurrences"] if (o["organizer"] or {}).get("id") == principal.user_id]
    pending = [{"event_id": r["id"], "title": r["title"], "start": r["starts_at"], "end": r["ends_at"], "calendar_id": r["calendar_id"]}
               for r in conn.execute("SELECT * FROM cal_events WHERE organizer_user_id = ? AND state = 'pending' AND override_of IS NULL ORDER BY starts_at", (principal.user_id,)).fetchall()
               if ctx.can_see(conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (r["calendar_id"],)).fetchone())]
    return {"occurrences": mine, "pending": pending}


# ---------------------------------------------------------------- approvals and maintenance

@router.get("/calendar/requests")
def list_requests(state: str = Query(default="pending"), calendars: str = Query(default=""), principal: Principal = Depends(current_principal_ro),
                  conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_view(conn, principal)
    if state not in ("pending", "rejected", "expired", "withdrawn"):
        raise ApiError(422, "validation", "state", details={"field": "state"})
    return {"requests": decisions.requests(Ctx(conn, principal), calendars=[c for c in calendars.split(",") if c] or None, state=state,
                                          order=model.read_settings(conn)["contested_order"])}


@router.post("/calendar/requests/{eid}/decide")
def decide_request(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        out = decisions.decide(ctx, model.read_settings(conn), eid, _body(body), _now())
        _audit(conn, principal, request, "calendar.request.decide", "calendar_event", eid, decision=_body(body).get("decision"), displace=bool(_body(body).get("displace_existing")))
        return out


@router.post("/calendar/requests/{eid}/reopen")
def reopen_request(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        out = decisions.reopen(ctx, model.read_settings(conn), eid, _body(body), _now())
        _audit(conn, principal, request, "calendar.request.reopen", "calendar_event", eid)
        return out


def _maint_guard(ctx: Ctx, data: dict[str, Any]) -> None:
    cal = get_visible(ctx, data.get("calendar_id"))
    if not ctx.has(model.PERM_MAINTENANCE, scope_of(cal)):
        raise Denied(model.PERM_MAINTENANCE, cal["id"], "permission")
    for rid in data.get("rooms") or []:
        room = get_visible(ctx, rid) if isinstance(rid, str) else None
        if room is not None and ctx.role_in(room) is None:
            raise Denied(model.PERM_MAINTENANCE, room["id"], "view")  # he must see what he displaces


@router.post("/calendar/maintenance/preview")
def maintenance_preview(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        _maint_guard(ctx, _body(body))
        return decisions.maintenance_preview(ctx, model.read_settings(conn), _body(body), _now())


@router.post("/calendar/maintenance", status_code=201)
def maintenance_place(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with _errors(conn, principal, request):
        _maint_guard(ctx, _body(body))
        out = decisions.maintenance_place(ctx, model.read_settings(conn), _body(body), _now())
        _audit(conn, principal, request, "calendar.maintenance.place", "calendar_event", out["event"]["id"], displaced=len(out["displaced"]))
        return out


__all__ = ["router", "open_router", "jobs"]
