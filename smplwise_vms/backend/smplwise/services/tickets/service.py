"""CR-038: the ticket actions of slice 1 - edit, status (incl. close / cancel / reopen), assignment to an internal user, return by
the assignee ("לא שלי" / "לא אוכל לטפל"), notes, ETA and photos. Each runs inside the request's write transaction and writes, together:
the ticket row (revision-checked where the caller sent a revision: 409 `ticket_stale`), its timeline row(s) and an audit row.

Audit rows carry the ENVELOPE only (ticket id and number, statuses, field NAMES, assignee ids) - never a title, description, note,
reason or file content (the spec's "no PII bodies"). Who may make which move is model.STATUS_MOVES; who is a manager or the current
assignee is access.Viewer / access.Seen."""
from __future__ import annotations

import datetime as dt
from typing import Any

from ...audit import audit
from ...db import now_iso
from ...errors import ApiError
from ...rbac import Principal
from . import access, attachments, handler_links, model, notify_bridge, sla, store
from .access import Seen, Viewer, text
from .present import DELETE_OWN_PHOTO_S, can_reopen

PURGE_DAYS = 730  # section 15.1 default of `retention.closed_days`; the retention setting and the purge janitor belong to a later slice
EDITABLE_BY_MANAGER = ("title", "description", "category_id", "priority_id", "department_id", "location_id", "place_text")
EDITABLE_BY_CREATOR_WHILE_NEW = ("title", "description", "location_id", "place_text")
# owner 2026-10-19: the location may change after creation; a NEW snapshot is taken at that moment and the old one stays in the
# timeline (the `edited` row's `location` data). A device's ticket keeps its resolved place: only its organisation location changes.


def editable_fields(row: dict[str, Any], *, manager: bool, creator: bool) -> list[str]:
    """The fields the caller may edit (the detail's `can.edit_fields` and `edit()` give the same answer)."""
    if row["status"] in model.FINAL:
        return []
    fields = EDITABLE_BY_MANAGER if manager else EDITABLE_BY_CREATOR_WHILE_NEW if creator and row["status"] == "new" else ()
    return [f for f in fields if not (f == "place_text" and row.get("entity_id"))]


def _location_view(row: dict[str, Any]) -> dict[str, Any]:
    """One side of a location change as the timeline keeps it: the reference, the snapshot as it was, the free-text place."""
    from . import org_locations

    snap = org_locations.parse_snapshot(row.get("location_snapshot"))
    return {"id": row.get("location_id"), "snapshot": snap, "text": org_locations.display_text(snap), "place_text": row.get("place_text") or ""}


# ---------------------------------------------------------------- shared answers

def invalid(conn, exc: model.Invalid) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": p.field, "code": p.code} for p in exc.problems]})


def stale(conn, row: dict[str, Any]) -> ApiError:
    return ApiError(409, "ticket_stale", text(conn, "{the_ticket} {f:השתנתה|m:השתנה} בינתיים. טענו מחדש."), details={"revision": row["revision"]})


def bad_move(conn, frm: str, to: str) -> ApiError:
    return ApiError(409, "invalid_transition", text(conn, "המעבר הזה אינו אפשרי במצב הנוכחי."), details={"from": frm, "to": to})


def refuse(conn, viewer: Viewer, action: str, row: dict[str, Any] | None, reason: str, rid: str | None = None, **details: Any) -> ApiError:
    """An audited 403 for a membership- or role-based refusal (rbac.require audits the plain permission refusals itself)."""
    audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="ticket", resource_id=(row or {}).get("id"),
          reason=reason, request_id=rid, details={"number": (row or {}).get("number"), **details})
    return ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"reason": reason, **details})


def _audit(conn, viewer: Viewer, action: str, row: dict[str, Any], rid: str | None, **details: Any) -> None:
    audit(conn, actor=viewer.principal, action=action, decision="allowed", resource_type="ticket", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], **details})


def actor_name(viewer: Viewer) -> str:
    return store.display_name(viewer.conn, viewer.uid) or viewer.principal.display_name or viewer.principal.username


def _plus_days(at: str, days: int) -> str:
    base = dt.datetime.fromisoformat(at.replace("Z", "+00:00"))
    return (base + dt.timedelta(days=days)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _active_assignment(row: dict[str, Any]) -> str | None:
    return row["current_assignment_id"] if row.get("current_assignment_id") and not row.get("asg_ended_at") else None


# ---------------------------------------------------------------- edit (section 11.3)

def edit(conn, viewer: Viewer, seen: Seen, patch: dict[str, Any], revision: int, rid: str | None = None) -> list[str]:
    """Edit the fields the caller may edit; returns the names of the fields that changed."""
    row = seen.row
    if row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{the_ticket} {f:סגורה|m:סגור}; פתחו {f:אותה|m:אותו} מחדש כדי לערוך."))
    creator = row["created_by"] == viewer.uid
    allowed = set(editable_fields(row, manager=seen.manager, creator=creator))
    asked = set(patch)
    if not asked:
        return []
    if "place_text" in asked and row.get("entity_id") and (seen.manager or creator):
        raise invalid(conn, model.Invalid([model.Problem("place_text", "device_place")]))  # the device's resolved place stays
    if asked - allowed:
        raise refuse(conn, viewer, "ticket.edit", row, "field_not_editable", rid, fields=sorted(asked - allowed))
    if row["revision"] != revision:
        raise stale(conn, row)
    fields: dict[str, Any] = {}
    try:
        if "title" in patch:
            fields["title"] = model.text_field(patch["title"], "title", required=True, max_len=model.TITLE_MAX)
        if "description" in patch:
            fields["description"] = model.text_field(patch["description"], "description", required=False, max_len=model.DESCRIPTION_MAX, multiline=True)
        if "place_text" in patch:
            from .create import PLACE_OTHER_MAX

            fields["place_text"] = model.text_field(patch["place_text"] or "", "place_text", required=False, max_len=PLACE_OTHER_MAX)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    if "location_id" in patch:
        from . import org_locations

        if patch["location_id"]:
            try:
                lid, snap = org_locations.resolve(conn, patch["location_id"])  # the snapshot of THIS moment (an active location only)
            except org_locations.Invalid as exc:
                raise invalid(conn, model.Invalid([model.Problem(exc.field, exc.code)])) from None
            fields["location_id"], fields["location_snapshot"] = lid, snap
        else:
            fields["location_id"], fields["location_snapshot"] = None, None
    dept_id = row["department_id"]
    moved = False
    if "department_id" in patch and patch["department_id"] != row["department_id"]:
        target = store.department(conn, str(patch["department_id"] or ""))
        if target is None or not target["active"]:
            raise invalid(conn, model.Invalid([model.Problem("department_id", "unknown")]))
        if not viewer.is_manager({**row, "department_id": target["id"]}):
            raise refuse(conn, viewer, "ticket.edit", row, "not_manager_of_target", rid, department_id=target["id"])
        fields["department_id"] = dept_id = target["id"]
        moved = True
    if "category_id" in patch:
        cid = patch["category_id"]
        if cid:
            cat = store.category(conn, str(cid))
            if cat is None or cat["department_id"] != dept_id or not cat["active"]:
                raise invalid(conn, model.Invalid([model.Problem("category_id", "unknown")]))
        fields["category_id"] = cid or None
    elif moved:
        fields["category_id"] = None
    if "priority_id" in patch:
        prio = store.priority(conn, str(patch["priority_id"] or ""))
        if prio is None or prio["department_id"] != dept_id or not prio["active"]:
            raise invalid(conn, model.Invalid([model.Problem("priority_id", "unknown")]))
        fields["priority_id"] = prio["id"]
    elif moved:
        old = store.priority(conn, row["priority_id"])
        same = store.priority_by_key(conn, dept_id, old["key"]) if old else None
        fields["priority_id"] = (same or store.default_priority(conn, dept_id) or {}).get("id") or row["priority_id"]
    changed = [k for k, v in fields.items() if ((row.get(k) or "") if k == "place_text" else row.get(k)) != v]
    if not changed:
        return []
    now = now_iso()
    update = {k: fields[k] for k in changed}
    update["last_activity_at"] = now
    relocated = bool(set(changed) & {"location_id", "location_snapshot", "place_text"})
    # the names the timeline and the audit carry: a new snapshot of the same location is a change of "location_id"
    if "location_snapshot" in changed:
        changed = [k for k in changed if k != "location_snapshot"] + ([] if "location_id" in changed else ["location_id"])
    if row.get("asg_kind") == "contact" and _active_assignment(row) and (set(changed) & {"title", "description", "priority_id"} or relocated):
        update["external_stale"] = 1  # the vendor got the old text ("נשלח לפני השינוי", slice 5b sends the update)
    ended = None
    if moved and row.get("asg_kind") == "user" and _active_assignment(row) and row.get("asg_user_id") not in store.department_user_ids(conn, dept_id):
        ended = _active_assignment(row)
        store.update_assignment(conn, ended, {"ended_at": now, "end_reason": "reassigned"})
        handler_links.revoke_for_assignment(conn, ended, "reassigned", handler_links.parse(now) or handler_links.now_utc())  # TKSTAFF1: a staff link dies
        update.update({"current_assignment_id": None, "status": "new", "eta_at": None})
        update["waiting_on"], update["waiting_reason"] = model.waiting_for("new")
    if not store.update_ticket(conn, row["id"], update, expect_revision=revision):
        raise stale(conn, row)
    data: dict[str, Any] = {"fields": changed}
    if moved:
        data.update({"from_department": row["department_id"], "to_department": dept_id})
    if ended:
        data["assignment_ended"] = True
    if relocated:  # the old snapshot stays in the history; the ticket row holds the new one
        data["location"] = {"from": _location_view(row), "to": _location_view({**row, **update})}
    store.insert_event(conn, row["id"], "edited", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer), data=data)
    sla.refresh(conn, row["id"])  # a priority or department change recomputes the dues from the creation time (11.3)
    _audit(conn, viewer, "ticket.edit", row, rid, fields=changed, **({"department_id": dept_id} if moved else {}),
           **({"location_from": row.get("location_id"), "location_to": update.get("location_id", row.get("location_id"))} if relocated else {}))
    return changed


# ---------------------------------------------------------------- status (section 11.2)

def change_status(conn, viewer: Viewer, seen: Seen, to: str, note: str | None, revision: int, duplicate_of: str | None = None,
                  rid: str | None = None, override_claim_reason: str | None = None) -> None:
    row = seen.row
    frm = row["status"]
    if to not in model.STATUSES:
        raise invalid(conn, model.Invalid([model.Problem("to", "unknown")]))
    actor = None
    if seen.assignee and model.may_move("assignee", frm, to):
        actor = "assignee"
    elif seen.manager and model.may_move("manager", frm, to):
        actor = "manager"
    if actor is None:
        if not (seen.assignee or seen.manager):
            raise refuse(conn, viewer, "ticket.status", row, "not_allowed", rid, to=to)
        raise bad_move(conn, frm, to)
    if row["revision"] != revision:
        raise stale(conn, row)
    reopen = (frm, to) == ("closed", "new")
    dept = store.department_any(conn, row["department_id"])
    if reopen and not can_reopen(row, dept):
        raise ApiError(409, "reopen_window_passed", text(conn, "חלף הזמן שבו אפשר לפתוח מחדש את {the_ticket}."))
    try:
        note_text = model.text_field(note, "note", required=actor == "manager" and model.note_required(frm, to), max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    original = None
    if duplicate_of:
        if to != "cancelled":
            raise invalid(conn, model.Invalid([model.Problem("duplicate_of", "only_with_cancel")]))
        original = access.visible_by_id(viewer, duplicate_of)
        if original is None or original.row["id"] == row["id"]:
            raise invalid(conn, model.Invalid([model.Problem("duplicate_of", "unknown")]))
    if to == "closed":  # S9 (11A.3): a REQUIRED cost claim that is not approved blocks the close unless overridden with a reason
        from . import costs

        try:
            costs.check_close(conn, viewer, row, override_claim_reason, rid)
        except costs.CostRefused as exc:
            raise cost_error(conn, exc) from None
    now = now_iso()
    fields: dict[str, Any] = {"status": to, "last_activity_at": now}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for(to)
    asg = _active_assignment(row)
    if to == "done":
        fields["done_at"] = now
    elif frm == "done" and to != "closed":
        fields["done_at"] = None
    if to in model.FINAL:
        fields.update({"closed_at": now, "closed_by": viewer.uid, "close_note": note_text or None, "current_assignment_id": None,
                       "purge_after": _plus_days(now, PURGE_DAYS)})
        if original is not None:
            fields["duplicate_of"] = original.row["id"]
        if asg:
            store.update_assignment(conn, asg, {"ended_at": now, "end_reason": "closed" if to == "closed" else "cancelled"})
        handler_links.on_final(conn, row["id"], asg, to, row["department_id"], handler_links.parse(now) or handler_links.now_utc())  # S4: read-only grace (D5)
    if reopen:
        fields.update({"closed_at": None, "closed_by": None, "close_note": None, "purge_after": None, "done_at": None,
                       "reopen_count": int(row.get("reopen_count") or 0) + 1})
        handler_links.on_reopened(conn, row["id"], handler_links.parse(now) or handler_links.now_utc())  # S4: a grace link dies
    if asg and to == "acknowledged" and not row.get("asg_ack_at"):
        store.update_assignment(conn, asg, {"acknowledged_at": now})
    if asg and actor == "assignee":
        store.update_assignment(conn, asg, {"last_update_at": now})
    if not store.update_ticket(conn, row["id"], fields, expect_revision=revision):
        raise stale(conn, row)
    if to in ("done", "closed", "cancelled"):  # CR-ARX-WISKEY-SHARED-IDENTITY R5 (owner answer 6): done ends door access at once
        from .. import access_grants

        access_grants.on_ticket_ended(conn, row["id"], "ticket_ended")
    kind = "closed" if to == "closed" else "cancelled" if to == "cancelled" else "reopened" if reopen else "status"
    on_behalf = actor == "manager" and model.may_move("assignee", frm, to) and bool(asg)
    data: dict[str, Any] = {"on_behalf": True} if on_behalf else {}
    if original is not None:
        data["duplicate_of"] = {"id": original.row["id"], "number": original.row["number"]}
    store.insert_event(conn, row["id"], kind, actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer), assignment_id=asg,
                       from_status=frm, to_status=to, body=note_text or None, data=data, visible_external=actor == "assignee")
    if original is not None:
        store.insert_event(conn, original.row["id"], "duplicate", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                           data={"ticket_id": row["id"], "number": row["number"]})
    action = {"closed": "ticket.close", "cancelled": "ticket.cancel", "reopened": "ticket.reopen"}.get(kind, "ticket.status")
    _audit(conn, viewer, action, row, rid, **{"from": frm, "to": to, "actor": actor, **({"duplicate_of": original.row["id"]} if original else {})})
    sla.refresh(conn, row["id"])
    notify_bridge.ticket_status(conn, row["id"], frm, to)
    if to == "done" and asg and row.get("asg_kind") == "contact":  # S9: the manager reported "done" on the vendor's behalf
        from . import costs

        costs.on_assignment_done(conn, row["id"], asg, handler_links.parse(now) or handler_links.now_utc())


COST_MESSAGES = {
    "cost_claim_pending": "יש דרישת תשלום חובה שעדיין לא אושרה. אשרו אותה, או סגרו עם נימוק.",
    "forbidden": "אין הרשאה לפעולה הזו.",
    "claim_stale": "דרישת התשלום השתנתה בינתיים. טענו מחדש.",
    "claim_closed": "דרישת התשלום כבר אושרה.",
    "earlier_instalment_unsettled": "אי אפשר לדרוש תשלום לפני שהתשלום הקודם אושר.",
    "claim_not_submitted": "אין הגשה שממתינה לבדיקה.",
    "self_approval": "את ההגשה הזאת הזנת בעצמך: אדם אחר צריך לאשר אותה.",
    "claim_not_approved": "דרישת התשלום עדיין לא אושרה.",
    "claim_not_paid": "דרישת התשלום אינה מסומנת כשולמה.",
    "claim_not_open": "דרישת התשלום אינה פתוחה להגשה.",
    "window_still_open": "חלון ההגשה עדיין פתוח.",
    "already_reopened": "חלון ההגשה כבר נפתח מחדש פעם אחת.",
    "claim_already_submitted": "אי אפשר לשנות את הדרישה אחרי שהוגשה דרישת תשלום.",
    "not_external": "דרישת תשלום קיימת רק לשיוך לגורם חיצוני.",
    "no_external_assignment": "ל{ticket} אין שיוך לגורם חיצוני.",
    "claim_window_closed": "חלון ההגשה נסגר.",
    "invoice_required": "יש לצרף חשבונית או קבלה.",
    "claim_too_large": "הסכום גבוה מהמותר.",
    "quote_closed": "ההצעה כבר אושרה או שהעבודה הסתיימה.",
    "quote_not_found": "ההצעה לא נמצאה.",
    "invalid_state": "ההצעה כבר טופלה.",
    "demand_pending": "כבר הוגשה דרישת תשלום בשיוך הזה. החליטו עליה לפני אישור הצעת המחיר.",
}


def cost_error(conn, exc) -> ApiError:
    """A services/tickets/costs.CostRefused as the internal API's envelope (Hebrew, with the module's display name - D33)."""
    if exc.status == 422 and exc.code not in COST_MESSAGES:
        return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": exc.field or "body", "code": exc.code}]})
    msg = COST_MESSAGES.get(exc.code, "הפעולה נדחתה.")
    details = dict(exc.extra)
    if exc.field:
        details["field"] = exc.field
    return ApiError(exc.status, exc.code, text(conn, msg), details=details)


# ---------------------------------------------------------------- assignment to an internal user

def _user_viewer(conn, user_id: str) -> Viewer:
    u = conn.execute("SELECT username, display_name, source FROM users WHERE id = ?", (user_id,)).fetchone()
    return Viewer(conn, Principal(user_id=user_id, username=u["username"] if u else "", display_name=u["display_name"] if u else "", source=u["source"] if u else "ingress"))


def eligible_assignees(conn, department_id: str, row: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Who may be assigned in a department (section 8, "assignee picker"): active users who are members of the department (directly
    or through a group) and hold tickets.view where the ticket lies (at any scope for a placeless ticket). Names only."""
    out: list[dict[str, Any]] = []
    for uid, role in store.department_user_ids(conn, department_id).items():
        if not store.user_is_active(conn, uid):
            continue
        if not _user_viewer(conn, uid).holds(access.VIEW, row):
            continue
        out.append({"kind": "user", "id": uid, "name": store.display_name(conn, uid), "member_role": role})
    return sorted(out, key=lambda r: (r["member_role"] != "manager", r["name"]))


def assign(conn, viewer: Viewer, seen: Seen, kind: str, assignee_id: str, note: str | None, note_external: bool, revision: int,
           rid: str | None = None) -> str:
    row = seen.row
    if not seen.manager:
        raise refuse(conn, viewer, "ticket.assign", row, "not_manager", rid)
    if kind == "contact":  # slice 4: an outside contact / vendor gets a handler link (services/tickets/external.py)
        from . import external

        return external.assign_contact(conn, viewer, seen, assignee_id, note=note, note_external=note_external, require_code=None,
                                       share_history=None, send_now=False, revision=revision, rid=rid)
    if kind != "user":
        raise invalid(conn, model.Invalid([model.Problem("assignee.kind", "unknown")]))
    status = row["status"]
    dept = store.department_any(conn, row["department_id"])
    if status == "closed" and not can_reopen(row, dept):
        raise ApiError(409, "reopen_window_passed", text(conn, "חלף הזמן שבו אפשר לפתוח מחדש את {the_ticket}."))
    if status not in model.ASSIGN_FROM:
        raise bad_move(conn, status, "assigned")
    if row["revision"] != revision:
        raise stale(conn, row)
    if not any(u["id"] == assignee_id for u in eligible_assignees(conn, row["department_id"], row)):
        raise ApiError(409, "assignee_not_allowed", text(conn, "אי אפשר להעביר את {the_ticket} למשתמש הזה (הוא אינו חבר במחלקה או אינו רשאי לצפות ב{tickets})."))
    current = _active_assignment(row)
    if current and row.get("asg_kind") == "user" and row.get("asg_user_id") == assignee_id:
        raise ApiError(409, "already_assigned", text(conn, "{the_ticket} כבר אצל המטפל הזה."))
    try:
        note_text = model.text_field(note, "note", required=False, max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    now = now_iso()
    name = store.display_name(conn, assignee_id)
    previous = row.get("asg_name") if current else None
    if current:
        store.update_assignment(conn, current, {"ended_at": now, "end_reason": "reassigned"})
        handler_links.revoke_for_assignment(conn, current, "reassigned", handler_links.parse(now) or handler_links.now_utc())  # S4: at once
    aid = store.insert_assignment(conn, {"ticket_id": row["id"], "assignee_kind": "user", "user_id": assignee_id, "assignee_name": name,
                                         "channel": "inapp", "assigned_by": viewer.uid, "assigned_at": now})
    fields: dict[str, Any] = {"status": "assigned", "current_assignment_id": aid, "assigner_user_id": viewer.uid, "last_activity_at": now,
                              "eta_at": None, "done_at": None, "external_stale": 0}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for("assigned")
    reopened = status == "closed"
    if reopened:
        fields.update({"closed_at": None, "closed_by": None, "close_note": None, "purge_after": None, "reopen_count": int(row.get("reopen_count") or 0) + 1})
        handler_links.on_reopened(conn, row["id"], handler_links.parse(now) or handler_links.now_utc())  # S4: a grace link dies
    if not store.update_ticket(conn, row["id"], fields, expect_revision=revision):
        raise stale(conn, row)
    who = actor_name(viewer)
    if reopened:
        store.insert_event(conn, row["id"], "reopened", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, from_status="closed", to_status="assigned")
    store.insert_event(conn, row["id"], "reassigned" if current else "assigned", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, assignment_id=aid,
                       from_status=status, to_status="assigned", data={"assignee": name, "assignee_kind": "user", **({"previous": previous} if previous else {})})
    if note_text:
        store.insert_event(conn, row["id"], "note", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, assignment_id=aid, body=note_text,
                           visible_external=bool(note_external))
    _audit(conn, viewer, "ticket.assign", row, rid, assignee_kind="user", assignee_id=assignee_id, reassign=bool(current), reopened=reopened)
    from . import staff_links  # TKSTAFF1: a WhatsApp message with the no-login staff link when the user has a mobile (R5..R12)

    staff_links.on_user_assigned(conn, viewer, row, aid, assignee_id, rid=rid)
    sla.refresh(conn, row["id"])
    notify_bridge.ticket_assigned(conn, row["id"], aid)
    return aid


# ---------------------------------------------------------------- return by the assignee (D12)

def return_ticket(conn, viewer: Viewer, seen: Seen, kind: str, reason: str | None, revision: int, rid: str | None = None) -> None:
    row = seen.row
    if not seen.assignee:
        raise refuse(conn, viewer, "ticket.return", row, "not_assignee", rid)
    if kind not in model.RETURN_KINDS:
        raise invalid(conn, model.Invalid([model.Problem("kind", "unknown")]))
    if row["status"] not in model.RETURN_FROM:
        raise bad_move(conn, row["status"], "returned")
    try:
        reason_text = model.text_field(reason, "reason", required=True, max_len=model.REASON_MAX, multiline=True)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    if row["revision"] != revision:
        raise stale(conn, row)
    now = now_iso()
    asg = _active_assignment(row)
    if asg:
        store.update_assignment(conn, asg, {"ended_at": now, "end_reason": "returned", "return_kind": kind, "return_reason": reason_text, "last_update_at": now})
    fields: dict[str, Any] = {"status": "returned", "current_assignment_id": None, "last_activity_at": now, "eta_at": None}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for("returned", kind)
    if not store.update_ticket(conn, row["id"], fields, expect_revision=revision):
        raise stale(conn, row)
    store.insert_event(conn, row["id"], "returned", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer), assignment_id=asg,
                       from_status=row["status"], to_status="returned", body=reason_text, data={"kind": kind}, visible_external=True)
    _audit(conn, viewer, "ticket.return", row, rid, kind=kind)
    sla.refresh(conn, row["id"])
    notify_bridge.ticket_returned(conn, row["id"], kind)


# ---------------------------------------------------------------- notes, ETA

def _may_write(viewer: Viewer, seen: Seen) -> bool:
    return seen.full or seen.assignee or seen.row["created_by"] == viewer.uid


def add_note(conn, viewer: Viewer, seen: Seen, body: str | None, external: bool, rid: str | None = None) -> int:
    row = seen.row
    if not _may_write(viewer, seen):
        raise refuse(conn, viewer, "ticket.note", row, "not_allowed", rid)
    if external and not seen.manager:
        raise refuse(conn, viewer, "ticket.note", row, "external_needs_manager", rid)
    if row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{the_ticket} {f:סגורה|m:סגור}."))
    try:
        note_text = model.text_field(body, "text", required=True, max_len=model.NOTE_MAX, multiline=True)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    vis = bool(external) if seen.manager else seen.assignee
    now = now_iso()
    asg = _active_assignment(row)
    eid = store.insert_event(conn, row["id"], "note", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                             assignment_id=asg if seen.assignee else None, body=note_text, visible_external=vis, at=now)
    store.update_ticket(conn, row["id"], {"last_activity_at": now}, bump=False)  # a note is progress, not an edit of the ticket
    if seen.assignee and asg:
        store.update_assignment(conn, asg, {"last_update_at": now})
    sla.refresh(conn, row["id"])
    _audit(conn, viewer, "ticket.note", row, rid, external=vis)
    return eid


def set_eta(conn, viewer: Viewer, seen: Seen, eta_at: str | None, rid: str | None = None) -> None:
    row = seen.row
    if not (seen.assignee or seen.manager):
        raise refuse(conn, viewer, "ticket.eta", row, "not_allowed", rid)
    if row["status"] not in model.HANDLING:
        raise ApiError(409, "invalid_state", text(conn, "צפי מוגדר רק בזמן הטיפול."), details={"status": row["status"]})
    try:
        value = model.parse_eta(eta_at)
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    now = now_iso()
    store.update_ticket(conn, row["id"], {"eta_at": value, "last_activity_at": now})
    asg = _active_assignment(row)
    if seen.assignee and asg:
        store.update_assignment(conn, asg, {"last_update_at": now})
    store.insert_event(conn, row["id"], "eta", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                       assignment_id=asg, data={"eta_at": value}, visible_external=seen.assignee)
    sla.refresh(conn, row["id"])  # a future ETA suppresses "stuck" until it passes (13.2)
    _audit(conn, viewer, "ticket.eta", row, rid, cleared=value is None)


# ---------------------------------------------------------------- photos (the validator: attachments.py)

def check_attach(conn, viewer: Viewer, seen: Seen, external: bool, rid: str | None = None) -> bool:
    """Everything that is decided BEFORE a picture is decoded; returns its `visible_external` flag."""
    row = seen.row
    if not _may_write(viewer, seen):
        raise refuse(conn, viewer, "ticket.photo", row, "not_allowed", rid)
    if external and not seen.manager:
        raise refuse(conn, viewer, "ticket.photo", row, "external_needs_manager", rid)
    if row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{the_ticket} {f:סגורה|m:סגור}."))
    if store.attachment_count(conn, row["id"]) >= attachments.PER_TICKET_MAX:
        raise ApiError(409, "too_many_photos", text(conn, "הגעתם למספר התמונות המרבי ל{ticket}."), details={"max": attachments.PER_TICKET_MAX})
    return bool(external) if seen.manager else seen.assignee


def record_attachment(conn, viewer: Viewer, seen: Seen, stored: attachments.Stored, vis: bool, rid: str | None = None) -> str:
    row = seen.row
    now = now_iso()
    from ...db import new_id

    att_id = new_id()
    eid = store.insert_event(conn, row["id"], "photo", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                             data={"attachment_id": att_id}, visible_external=vis, at=now)
    store.insert_attachment(conn, {"id": att_id, "ticket_id": row["id"], "event_id": eid, "kind": "photo", "path": stored.rel_path, "sha256": stored.sha256,
                                   "bytes": stored.bytes, "width": stored.width, "height": stored.height, "uploaded_by_kind": "user",
                                   "uploaded_by": viewer.uid, "visible_external": 1 if vis else 0, "created_at": now})
    store.update_ticket(conn, row["id"], {"last_activity_at": now}, bump=False)
    sla.refresh(conn, row["id"])
    _audit(conn, viewer, "ticket.photo", row, rid, attachment_id=att_id, external=vis, bytes=stored.bytes)
    return att_id


def delete_attachment(conn, viewer: Viewer, seen: Seen, attachment_id: str, data_dir, rid: str | None = None) -> None:
    row = seen.row
    att = store.attachment(conn, row["id"], attachment_id)
    if att is None or not access.attachment_visible(seen, att, viewer.uid):
        raise ApiError(404, "not_found", text(conn, "התמונה לא נמצאה."))
    mine = att["uploaded_by_kind"] == "user" and att["uploaded_by"] == viewer.uid
    try:
        age = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(att["created_at"].replace("Z", "+00:00"))).total_seconds()
    except ValueError:
        age = DELETE_OWN_PHOTO_S + 1
    if not (seen.manager or (mine and age <= DELETE_OWN_PHOTO_S)):
        raise refuse(conn, viewer, "ticket.photo.delete", row, "not_allowed", rid, attachment_id=attachment_id)
    store.soft_delete_attachment(conn, attachment_id, viewer.uid)
    attachments.remove(data_dir, att["path"])
    store.insert_event(conn, row["id"], "photo_removed", actor_kind="user", actor_user_id=viewer.uid, actor_name=actor_name(viewer),
                       data={"attachment_id": attachment_id}, visible_external=bool(att["visible_external"]))
    _audit(conn, viewer, "ticket.photo.delete", row, rid, attachment_id=attachment_id)
