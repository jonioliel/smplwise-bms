"""TKDETAILBE (docs/tickets/DETAIL_BACKEND_CONTRACT.md section 2; owner decision 2 of 15.10): the internal owner of a request
("אחראי בארגון") - the person in the organisation who stays responsible while an outside vendor handles it.

    default     at the hand-off to an outside contact, when the request has no owner yet: the CURRENT internal assignee at that
                moment, else the manager who hands it over; an existing owner is never replaced automatically
    change      a manager of the ticket picks an eligible member of the department (or clears it); every change is a history row
                (`ticket_owner_changes`), a timeline row `owner_changed` (internal only) and an audit row (ids only)"""
from __future__ import annotations

from typing import Any, Mapping

from ...audit import audit
from ...db import now_iso
from ...errors import ApiError
from . import store, store_quotes
from .access import Seen, Viewer, text


def _name(conn, user_id: str | None) -> str:
    return store.display_name(conn, user_id) if user_id else ""


def owner_block(conn, row: Mapping[str, Any]) -> dict[str, Any] | None:
    uid = row.get("internal_owner_user_id")
    if not uid:
        return None
    last = conn.execute("SELECT at, source FROM ticket_owner_changes WHERE ticket_id = ? AND to_user_id = ? ORDER BY id DESC LIMIT 1",
                        (row["id"], uid)).fetchone()
    return {"id": uid, "name": _name(conn, uid), "since": last["at"] if last else None, "source": last["source"] if last else None,
            "active": store.user_is_active(conn, uid)}


def history(conn, ticket_id: str) -> list[dict[str, Any]]:
    return [{"at": h["at"], "from": {"id": h["from_user_id"], "name": _name(conn, h["from_user_id"])} if h["from_user_id"] else None,
             "to": {"id": h["to_user_id"], "name": _name(conn, h["to_user_id"])} if h["to_user_id"] else None,
             "by": _name(conn, h["by_user_id"]) if h["by_user_id"] else "", "source": h["source"], "reason": h.get("reason")}
            for h in store_quotes.owner_changes(conn, ticket_id)]


def _record(conn, ticket_id: str, frm: str | None, to: str | None, *, by: str | None, source: str, reason: str | None, at: str,
            actor_name: str) -> None:
    store_quotes.insert_owner_change(conn, {"ticket_id": ticket_id, "from_user_id": frm, "to_user_id": to, "by_user_id": by, "source": source,
                                            "reason": reason, "at": at})
    store.insert_event(conn, ticket_id, "owner_changed", actor_kind="user" if by else "system", actor_user_id=by, actor_name=actor_name,
                       data={"from": _name(conn, frm) or None, "to": _name(conn, to) or None, "from_id": frm, "to_id": to, "source": source},
                       at=at)


def on_handoff(conn, row: Mapping[str, Any], *, by: str, actor_name: str, at: str) -> str | None:
    """Called by external.assign_contact inside its transaction, with the ticket row as it was BEFORE the hand-off (its asg_*
    columns name the assignee of that moment). Returns the owner set, or None when one already existed."""
    if row.get("internal_owner_user_id"):
        return None
    current_internal = row.get("asg_user_id") if (row.get("asg_kind") == "user" and row.get("current_assignment_id")
                                                   and not row.get("asg_ended_at")) else None
    owner = current_internal or by
    store_quotes.set_owner(conn, row["id"], owner)
    _record(conn, row["id"], None, owner, by=by, source="handoff", reason=None, at=at, actor_name=actor_name)
    return owner


def set_from_rfq(conn, ticket_id: str, user_id: str, *, by: str | None, at: str | None = None) -> None:
    """The RFQ change (C1): a ticket opened from an order takes `rfq.internal_owner`."""
    store_quotes.set_owner(conn, ticket_id, user_id)
    _record(conn, ticket_id, None, user_id, by=by, source="rfq", reason=None, at=at or now_iso(), actor_name=_name(conn, by))


def change(conn, viewer: Viewer, seen: Seen, user_id: str | None, reason: str | None, revision: int, *, candidates: list[dict[str, Any]],
           rid: str | None = None) -> None:
    from . import model
    from .service import actor_name, invalid, refuse, stale

    row = seen.row
    if not seen.manager:
        raise refuse(conn, viewer, "ticket.owner.change", row, "not_manager", rid)
    if row["revision"] != revision:
        raise stale(conn, row)
    try:
        why = model.text_field(reason, "reason", required=False, max_len=model.REASON_MAX, multiline=True) or None
    except model.Invalid as exc:
        raise invalid(conn, exc) from None
    current = row.get("internal_owner_user_id")
    if (user_id or None) == (current or None):
        raise ApiError(409, "owner_unchanged", text(conn, "זה כבר האחראי."))
    if user_id and not any(c["id"] == user_id for c in candidates):
        raise ApiError(409, "owner_not_allowed", text(conn, "אי אפשר לבחור את המשתמש הזה (הוא אינו חבר במחלקה או אינו רשאי לצפות ב{tickets})."))
    if not store.update_ticket(conn, row["id"], {"internal_owner_user_id": user_id or None}, expect_revision=revision):
        raise stale(conn, row)
    at = now_iso()
    _record(conn, row["id"], current, user_id or None, by=viewer.uid, source="manual", reason=why, at=at, actor_name=actor_name(viewer))
    audit(conn, actor=viewer.principal, action="ticket.owner.change", decision="allowed", resource_type="ticket", resource_id=row["id"],
          request_id=rid, details={"number": row["number"], "from": current, "to": user_id or None})
