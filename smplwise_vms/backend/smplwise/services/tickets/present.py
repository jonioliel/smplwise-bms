"""CR-038: what the API answers for a ticket - a list item, the detail with its timeline, photos and assignments, and the actions
THIS caller may take (`can`, `transitions`). Every function takes an access.Seen (a ticket the caller may see) and filters what a
limited viewer (a creator or internal assignee who is not a member, review T18-2) does not get: internal notes and photos, the
assignment history, the close note."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ..timeutil import parse_utc
from . import device_context, model, store
from .access import Seen, Viewer, attachment_visible, event_visible, public_ready

DESCRIPTION_EXCERPT = 240
DELETE_OWN_PHOTO_S = 600  # an uploader may remove their own photo within 10 minutes


class Lookups:
    """Departments, priorities and categories of one request, read once each."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self._dept: dict[str, dict[str, Any] | None] = {}
        self._prio: dict[str, dict[str, Any] | None] = {}
        self._cat: dict[str, dict[str, Any] | None] = {}

    def department(self, dept_id: str) -> dict[str, Any] | None:
        if dept_id not in self._dept:
            self._dept[dept_id] = store.department_any(self.conn, dept_id)
        return self._dept[dept_id]

    def priority(self, pid: str) -> dict[str, Any] | None:
        if pid not in self._prio:
            self._prio[pid] = store.priority(self.conn, pid)
        return self._prio[pid]

    def category(self, cid: str | None) -> dict[str, Any] | None:
        if not cid:
            return None
        if cid not in self._cat:
            self._cat[cid] = store.category_any(self.conn, cid)
        return self._cat[cid]


def _dept_brief(d: dict[str, Any] | None) -> dict[str, Any] | None:
    if not d:
        return None
    return {"id": d["id"], "key": d["key"], "name": d["name"], "icon": d.get("icon"), "color": d.get("color")}


def _assignee(row: dict[str, Any]) -> dict[str, Any] | None:
    if not row.get("current_assignment_id") or row.get("asg_ended_at"):
        return None
    return {"kind": row.get("asg_kind"), "id": row.get("asg_user_id") or row.get("asg_contact_id"), "name": row.get("asg_name") or "",
            "since": row.get("asg_at"), "acknowledged_at": row.get("asg_ack_at")}


def reopen_until(row: dict[str, Any], dept: dict[str, Any] | None) -> str | None:
    """Until when a closed ticket can be reopened (the department's reopen window), None when it cannot."""
    if row["status"] != "closed" or not row.get("closed_at"):
        return None
    days = int((dept or {}).get("reopen_days") or 14)
    try:
        until = parse_utc(row["closed_at"]) + dt.timedelta(days=days)
    except ValueError:
        return None
    return until.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def can_reopen(row: dict[str, Any], dept: dict[str, Any] | None, now: dt.datetime | None = None) -> bool:
    until = reopen_until(row, dept)
    if not until:
        return False
    return parse_utc(until) > (now or dt.datetime.now(dt.timezone.utc))


def transitions(viewer: Viewer, seen: Seen, dept: dict[str, Any] | None) -> list[dict[str, Any]]:
    """The status moves this caller may make now (POST /status), each with whether a note is required."""
    status = seen.row["status"]
    moves: dict[str, bool] = {}
    if seen.assignee:
        for frm, to in model.STATUS_MOVES["assignee"]:
            if frm == status:
                moves[to] = False
    if seen.manager:
        for frm, to in model.STATUS_MOVES["manager"]:
            if frm != status or to in moves:
                continue
            if (frm, to) == ("closed", "new") and not can_reopen(seen.row, dept):
                continue
            moves[to] = model.note_required(frm, to)
    order = {s: i for i, s in enumerate(model.STATUSES)}
    return [{"to": to, "note_required": req} for to, req in sorted(moves.items(), key=lambda kv: order[kv[0]])]


def can_block(viewer: Viewer, seen: Seen, dept: dict[str, Any] | None) -> dict[str, Any]:
    row = seen.row
    status = row["status"]
    creator = row.get("created_by") == viewer.uid
    writer = seen.full or seen.assignee or creator
    edit_fields: list[str] = []
    if seen.manager and status not in model.FINAL:
        edit_fields = ["title", "description", "category_id", "priority_id", "department_id"]
    elif creator and status == "new":
        edit_fields = ["title", "description"]
    assign = seen.manager and (status in model.ASSIGN_FROM - {"closed"} or (status == "closed" and can_reopen(row, dept)))
    return {
        "edit_fields": edit_fields,
        "assign": assign,
        "assign_external": assign and viewer.holds("tickets.external", row) and public_ready(viewer.conn),
        "note": writer and status not in model.FINAL,
        "note_external": seen.manager,
        "attach": writer and status not in model.FINAL,
        "attach_external": seen.manager,
        "eta": (seen.assignee or seen.manager) and status in model.HANDLING,
        "return": seen.assignee and status in model.RETURN_FROM,
        "manage": seen.manager,
    }


def ticket_item(conn: sqlite3.Connection, seen: Seen, lk: Lookups, last_names: dict[str, str] | None = None) -> dict[str, Any]:
    """One row of a list (cards, the device tab later): the card's fields, nothing of the timeline."""
    row = seen.row
    dept = lk.department(row["department_id"])
    prio = lk.priority(row["priority_id"])
    cat = lk.category(row.get("category_id"))
    assignee = _assignee(row)
    desc = row.get("description") or ""
    return {
        "id": row["id"],
        "number": row["number"],
        "title": row["title"],
        "excerpt": desc[:DESCRIPTION_EXCERPT],
        "status": row["status"],
        "origin": row["origin"],
        "department": _dept_brief(dept),
        "category": {"id": cat["id"], "name": cat["name"]} if cat else None,
        "priority": {"id": prio["id"], "key": prio["key"], "name": prio["name"], "rank": prio["rank"], "severity": prio["notify_severity"]} if prio else None,
        "place_text": row.get("place_text") or "",
        "device_name": row.get("device_name") or "",
        "entity_id": row.get("entity_id"),  # slice 3: a device's ticket (the device window / map link)
        "created_by": {"id": row["created_by"], "name": row.get("created_by_name") or ""},
        "created_at": row["created_at"],
        "last_activity_at": row["last_activity_at"],
        "assignee": assignee,
        "last_assignee_name": (last_names or {}).get(row["id"]) if not assignee else None,
        "eta_at": row.get("eta_at"),
        "waiting_on": row["waiting_on"],
        "waiting_reason": row.get("waiting_reason"),
        "reopen_count": row.get("reopen_count") or 0,
        "external_stale": bool(row.get("external_stale")),
        "closed_at": row.get("closed_at"),
        "revision": row["revision"],
        "view": "full" if seen.full else "limited",
    }


def _event(conn: sqlite3.Connection, ev: dict[str, Any], uid: str) -> dict[str, Any]:
    try:
        data = json.loads(ev.get("data_json") or "{}")
    except ValueError:
        data = {}
    return {
        "id": ev["id"],
        "at": ev["at"],
        "kind": ev["kind"],
        "actor": {"kind": ev["actor_kind"], "name": ev.get("actor_name") or "", "me": ev.get("actor_user_id") == uid},
        "from": ev.get("from_status"),
        "to": ev.get("to_status"),
        "body": ev.get("body"),
        "data": data if isinstance(data, dict) else {},
        "via": ev["via"],
        "external": bool(ev.get("visible_external")),
    }


def _attachment(seen: Seen, att: dict[str, Any], uid: str, now: dt.datetime) -> dict[str, Any]:
    mine = att.get("uploaded_by_kind") == "user" and att.get("uploaded_by") == uid
    recent = False
    try:
        recent = (now - parse_utc(att["created_at"])).total_seconds() <= DELETE_OWN_PHOTO_S
    except ValueError:
        recent = False
    return {
        "id": att["id"],
        "at": att["created_at"],
        "width": att["width"],
        "height": att["height"],
        "bytes": att["bytes"],
        "external": bool(att.get("visible_external")),
        "mine": mine,
        "can_delete": seen.manager or (mine and recent),
        "url": f"tickets/{seen.row['id']}/attachments/{att['id']}",
    }


def ticket_detail(conn: sqlite3.Connection, viewer: Viewer, seen: Seen, lk: Lookups | None = None) -> dict[str, Any]:
    lk = lk or Lookups(conn)
    row = seen.row
    uid = viewer.uid
    dept = lk.department(row["department_id"])
    out = ticket_item(conn, seen, lk)
    out["description"] = row.get("description") or ""
    out.pop("excerpt", None)
    now = dt.datetime.now(dt.timezone.utc)
    events = [_event(conn, e, uid) for e in store.events(conn, row["id"]) if event_visible(seen, e, uid)]
    atts = [_attachment(seen, a, uid, now) for a in store.attachments(conn, row["id"]) if attachment_visible(seen, a, uid)]
    out.update({
        "events": events,
        "attachments": atts,
        "close_note": row.get("close_note") if seen.full else None,
        "closed_by_name": store.display_name(conn, row.get("closed_by")) if row.get("closed_by") else None,
        "duplicate_of": _duplicate(conn, viewer, row.get("duplicate_of")),
        "reopen_until": reopen_until(row, dept),
        "can": can_block(viewer, seen, dept),
        "transitions": transitions(viewer, seen, dept),
        # slice 3 (section 12.3): the frozen 24 h history - internal content, and only for a viewer who may read the device too
        "device_context": device_context.for_ticket(conn, viewer.principal, row, full=seen.full),
    })
    if seen.full:
        out["assignments"] = [
            {"id": a["id"], "kind": a["assignee_kind"], "name": a["assignee_name"], "channel": a["channel"], "assigned_at": a["assigned_at"],
             "assigned_by_name": store.display_name(conn, a["assigned_by"]), "acknowledged_at": a.get("acknowledged_at"), "ended_at": a.get("ended_at"),
             "end_reason": a.get("end_reason"), "return_kind": a.get("return_kind"), "return_reason": a.get("return_reason")}
            for a in store.assignments(conn, row["id"])
        ]
    else:
        out["assignments"] = []
    return out


def _duplicate(conn: sqlite3.Connection, viewer: Viewer, ticket_id: str | None) -> dict[str, Any] | None:
    """The original a cancelled duplicate points at - named only when the caller may see it."""
    from .access import visible_by_id

    seen = visible_by_id(viewer, ticket_id)
    return {"id": seen.row["id"], "number": seen.row["number"]} if seen else None
