"""CAL-ATTENDEES-2343 - the attendees API of a calendar entry (docs/changes/CAL-ATTENDEES-2343.md section 4).

Same order as every calendars route (routers/calendar.py): signed in -> module switch (404 `feature_disabled`) -> the entry's calendar
visible (the uniform 404) -> permission (the audited 403) -> validation (422) -> state (409). The entry routes of routers/calendar.py call
`on_create` / `on_update` / `on_cancel` here so attendees can be sent with a new entry or a PATCH, and notices follow a change or a cancel.

Audit rows carry ids, kinds and counts only - never a name, a phone or an e-mail."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, permissions_anywhere, require
from ..services.calendar import attendee_notices as notices
from ..services.calendar import attendees as att
from ..services.calendar import events as cal_events
from ..services.calendar import model
from ..services.calendar.access import Ctx, Denied, get_visible
from . import calendar as cal_router

router = APIRouter(dependencies=[Depends(cal_router.module_gate)])
Body = cal_router.Body


def _now() -> dt.datetime:
    return cal_router._now()


def _ctx(request: Request, conn: sqlite3.Connection, principal: Principal) -> Ctx:
    return Ctx(conn, principal, settings_of(request).data_dir)


def _audit(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, rid: str, **details: Any) -> None:
    cal_router._audit(conn, principal, request, action, "calendar_event", rid, **details)


def _kinds(items: list[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for i in items:
        out[i["kind"]] = out.get(i["kind"], 0) + 1
    return out


def _me(raw: Any, principal: Principal) -> Any:
    """`{"kind": "user", "ref_id": "@me"}` is the caller himself (the drawer's "join" button does not know the account id)."""
    if not isinstance(raw, list):
        return raw
    return [({**i, "ref_id": principal.user_id} if isinstance(i, dict) and i.get("kind") == "user" and i.get("ref_id") == "@me" else i) for i in raw]


# ---------------------------------------------------------------- hooks of the entry routes (routers/calendar.py)

def take_items(conn: sqlite3.Connection, data: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, set[str]]:
    """Pops `attendees` (and `keep_attendee_ids`, the guests a desired list keeps) off an entry body; validates the shape."""
    if "attendees" not in data:
        data.pop("keep_attendee_ids", None)
        return None, set()
    raw = data.pop("attendees")
    keep = data.pop("keep_attendee_ids", None) or []
    if not isinstance(keep, list) or any(not isinstance(k, str) for k in keep):
        raise model.Invalid("keep_attendee_ids: ids", "keep_attendee_ids")
    return att.validate_items(conn, raw), set(keep)


def on_create(ctx: Ctx, request: Request, out: dict[str, Any], items: list[dict[str, Any]] | None, now: dt.datetime) -> None:
    if not items:
        return
    root = out["event"]["id"]
    ids = att.insert(ctx, root, items, now)
    notices.enqueue_invites(ctx.conn, root, ids, now, ctx.principal.user_id)
    _audit(ctx.conn, ctx.principal, request, "calendar.attendee.add", root, count=len(ids), kinds=_kinds(items), on="create")
    out["attendees"] = att.view(ctx, root)


def snapshot(conn: sqlite3.Connection, eid: str) -> dict[str, Any] | None:
    """What a change notice is about: time, recurrence, rooms of the entry and its overrides."""
    ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    if ev is None:
        return None
    root = ev["override_of"] or ev["id"]
    fam = conn.execute("SELECT id, starts_at, ends_at, all_day, tz, rrule, exdates_json, state FROM cal_events WHERE id = ? OR override_of = ? ORDER BY id", (root, root)).fetchall()
    rooms = conn.execute("SELECT event_id, room_calendar_id, state FROM cal_event_rooms WHERE event_id IN (SELECT id FROM cal_events WHERE id = ? OR override_of = ?) ORDER BY event_id, room_calendar_id",
                         (root, root)).fetchall()
    return {"root": root, "family": [tuple(r) for r in fam], "rooms": [tuple(r) for r in rooms], "state": ev["state"]}


def precheck_create(ctx: Ctx, data: dict[str, Any], items: list[dict[str, Any]] | None) -> None:
    """Before the entry is written (an API error still commits the transaction, so nothing may be half-made)."""
    if items:
        att.check_create(ctx.conn, get_visible(ctx, data.get("calendar_id")), items)


class Plan:
    """A desired attendee list of a PATCH, checked BEFORE the entry is updated (an API error still commits the transaction)."""

    def __init__(self, ctx: Ctx, eid: str, items: list[dict[str, Any]] | None, keep: set[str], now: dt.datetime) -> None:
        self.items = items
        self.add: list[dict[str, Any]] = []
        self.drop: list[sqlite3.Row] = []
        self.roles: list[tuple[sqlite3.Row, str]] = []
        self.root = eid
        if items is None:
            return
        conn = ctx.conn
        st = att.seat(ctx, eid)
        self.root = st.root_id
        self.add, self.drop, self.roles = att.desired_diff(conn, st.root_id, items, keep)
        if (self.drop or self.roles) and not st.manages:
            raise Denied("calendar.attendees", st.cal["id"], "organizer")
        att.check_add(st, self.add, now, existing=att.count(conn, st.root_id) - len(self.drop))
        if self.drop or self.roles:
            att.check_open(st)


def on_update(ctx: Ctx, request: Request, eid: str, before: dict[str, Any] | None, out: dict[str, Any] | None, plan: Plan, now: dt.datetime) -> dict[str, Any] | None:
    """After PATCH /calendar/events/{eid}: a change notice when the time / recurrence / rooms changed (and the calendar wants it), then the
    desired attendee list. Returns the attendees view when a list was sent."""
    conn = ctx.conn
    root = (before or {}).get("root") or plan.root
    if out is not None and before is not None:
        after = snapshot(conn, eid)
        if after is not None and (after["family"] != before["family"] or after["rooms"] != before["rooms"]):
            target = out.get("event") or {}
            occ = target.get("override_start") if target.get("override_of") else None
            notices.enqueue_change(conn, root, now, ctx.principal.user_id, occ)
            notices.reset_erase_after(conn, root, now)
    if plan.items is None:
        return None
    for r in plan.drop:
        att.remove(conn, r, ctx.principal.user_id, now)
        notices.enqueue_removed(conn, r, now, ctx.principal.user_id)
    for r, role in plan.roles:
        att.set_role(conn, r, role)
    ids = att.insert(ctx, plan.root, plan.add, now)
    notices.enqueue_invites(conn, plan.root, ids, now, ctx.principal.user_id)
    if plan.add or plan.drop or plan.roles:
        _audit(conn, ctx.principal, request, "calendar.attendee.update", plan.root, added=len(ids), removed=len(plan.drop), roles=len(plan.roles), kinds=_kinds(plan.add))
    return att.view(ctx, plan.root)


def on_cancel(ctx: Ctx, eid: str, before: dict[str, Any] | None, body: dict[str, Any], now: dt.datetime) -> None:
    """After POST /calendar/events/{eid}/cancel: the whole entry, or one occurrence (scope `occurrence`), was cancelled."""
    if before is None:
        return
    conn = ctx.conn
    root = before["root"]
    ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    if ev is None:
        return
    rootrow = conn.execute("SELECT * FROM cal_events WHERE id = ?", (root,)).fetchone()
    if rootrow is not None and rootrow["state"] == "cancelled":
        notices.enqueue_cancel(conn, root, now, ctx.principal.user_id)
    elif ev["override_of"] and ev["state"] == "cancelled":
        notices.enqueue_cancel(conn, root, now, ctx.principal.user_id, ev["override_start"])
    elif body.get("scope") in ("occurrence", "following") and body.get("occurrence_start"):
        notices.enqueue_cancel(conn, root, now, ctx.principal.user_id, str(body["occurrence_start"]))
    notices.reset_erase_after(conn, root, now)


def on_restore(conn: sqlite3.Connection, eid: str, now: dt.datetime) -> int:
    """THE UNDO HOOK for the delete-with-undo flow (pilot/CAL-GRID-EDIT-2343): a restored entry drops its queued cancel notices."""
    ev = conn.execute("SELECT id, override_of FROM cal_events WHERE id = ?", (eid,)).fetchone()
    return notices.retract_cancel(conn, (ev["override_of"] or ev["id"]) if ev else eid, now)


# 2.35.0 train: the grid's undo restores the entry, then this drops its queued cancel notices (registered here, not in the service: the
# service importing a router would be circular). Idempotent for module reloads.
if on_restore not in cal_events.ON_EVENT_RESTORED:
    cal_events.ON_EVENT_RESTORED.append(on_restore)


# ---------------------------------------------------------------- the attendee routes

@router.get("/calendar/events/{eid}/attendees")
def list_attendees(eid: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    return att.view(ctx, eid)


@router.post("/calendar/events/{eid}/attendees", status_code=201)
def add_attendees(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    now = _now()
    with cal_router._errors(conn, principal, request):
        data = cal_router._body(body)
        if set(data) - {"attendees"}:
            raise model.Invalid("body: {attendees}", sorted(set(data) - {"attendees"})[0])
        items = att.validate_items(conn, _me(data.get("attendees"), principal))
        st = att.seat(ctx, eid)
        att.check_add(st, items, now)
        ids = att.insert(ctx, st.root_id, items, now)
        notices.enqueue_invites(conn, st.root_id, ids, now, principal.user_id)
        _audit(conn, principal, request, "calendar.attendee.add", st.root_id, count=len(ids), kinds=_kinds(items))
        return att.view(ctx, st.root_id) | {"added": ids}


@router.patch("/calendar/events/{eid}/attendees/{aid}")
def patch_attendee(eid: str, aid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    with cal_router._errors(conn, principal, request):
        data = cal_router._body(body)
        if set(data) - {"role"}:
            raise model.Invalid("body: {role}", sorted(set(data) - {"role"})[0])
        st = att.seat(ctx, eid)
        r = att.row(conn, st.root_id, aid)
        if not st.manages:
            raise Denied("calendar.attendees", st.cal["id"], "organizer")
        att.check_open(st)
        role = att.set_role(conn, r, data.get("role"))
        _audit(conn, principal, request, "calendar.attendee.role", st.root_id, attendee_id=aid, role=role)
        return att.view(ctx, st.root_id)


@router.delete("/calendar/events/{eid}/attendees/{aid}")
def delete_attendee(eid: str, aid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    now = _now()
    with cal_router._errors(conn, principal, request):
        st = att.seat(ctx, eid)
        r = att.row(conn, st.root_id, aid)
        att.check_remove(st, r)
        att.check_open(st)
        att.remove(conn, r, principal.user_id, now)
        told = notices.enqueue_removed(conn, r, now, principal.user_id)
        _audit(conn, principal, request, "calendar.attendee.remove", st.root_id, attendee_id=aid, kind=r["kind"], notice=told)
        return att.view(ctx, st.root_id)


@router.put("/calendar/events/{eid}/attendees/me")
def respond(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The attendee's own answer: accepted | declined | tentative."""
    ctx = _ctx(request, conn, principal)
    with cal_router._errors(conn, principal, request):
        data = cal_router._body(body)
        st = att.seat(ctx, eid)
        if not st.attendee:
            raise ApiError(404, "not_found", "אינך מוזמן לאירוע הזה.")
        att.check_open(st)
        status = att.respond(conn, st.my_rows, data.get("status"), _now())
        _audit(conn, principal, request, "calendar.attendee.respond", st.root_id, status=status)
        return att.view(ctx, st.root_id)


@router.get("/calendar/attendees/directory")
def directory(q: str = Query(default="", max_length=60), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The picker's search: users (holders of calendar.book) and residents (holders of calendar.book_for_others / calendar.manage). Names only."""
    held = set(permissions_anywhere(conn, principal))
    ctx = Ctx(conn, principal)
    if not (ctx.admin or {model.PERM_BOOK, model.PERM_MANAGE} & held):
        require(conn, principal, model.PERM_BOOK, INSTALLATION)
    residents = att.may_search_residents(ctx)
    return {"results": att.directory(ctx, q, residents=residents), "residents": residents}


@router.get("/calendar/calendars/{cid}/attendee-policy")
def get_policy(cid: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    ctx = Ctx(conn, principal)
    cal = get_visible(ctx, cid)
    return {"policy": att.policy_of(conn, cal["id"]), "can_edit": ctx.role_in(cal) == "manage"}


@router.put("/calendar/calendars/{cid}/attendee-policy")
def put_policy(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ctx = _ctx(request, conn, principal)
    cal = get_visible(ctx, cid)
    with cal_router._errors(conn, principal, request):
        if ctx.role_in(cal) != "manage":
            raise Denied("calendar.role", cid, "manage")
        data = cal_router._body(body)
        cur = att.policy_of(conn, cid)
        if "revision" in data and data["revision"] != cur["revision"]:
            raise ApiError(409, "stale", "ההגדרות עודכנו בינתיים. רענן ונסה שוב.", details={"revision": cur["revision"]})
        values = att.policy_values(data, cur)
        att.save_policy(conn, cid, values, principal.user_id, model.iso(_now()))
        cal_router._audit(conn, principal, request, "calendar.attendee.policy", "calendar", cid, keys=sorted(k for k in values if values[k] != cur[k]))
        return {"policy": att.policy_of(conn, cid), "can_edit": True}


@router.get("/calendar/attendee-settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    held = set(permissions_anywhere(conn, principal))
    if model.PERM_CONFIGURE not in held and model.PERM_VIEW not in held:
        require(conn, principal, model.PERM_CONFIGURE, INSTALLATION)
    return {"settings": att.read_settings(conn), "channels": notices.channels_view(request.app.state.db), "can_configure": model.PERM_CONFIGURE in held}


@router.put("/calendar/attendee-settings")
def put_settings(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, model.PERM_CONFIGURE, INSTALLATION)
    with cal_router._errors(conn, principal, request):
        old = att.read_settings(conn)
        new = att.settings_doc(cal_router._body(body))
        changed = sorted(k for k in new if new[k] != old.get(k))
        if changed:
            att.write_settings(conn, new)
            cal_router._audit(conn, principal, request, "calendar.attendee.settings", "installation", "calendar", keys=changed)
        return {"settings": new, "channels": notices.channels_view(request.app.state.db)}
