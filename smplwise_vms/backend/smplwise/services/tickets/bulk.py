"""CR-038 slice 6b (D24, section 13.6): bulk actions of the board table - assign, remind, change priority, close.

At most MAX_ITEMS tickets per request. Every item is checked on its own - visible to the caller, manager rights in ITS department,
the revision the table showed, the move allowed from its status - and runs in its OWN transaction (store.item_transaction, a
savepoint inside the request): the answer lists one result per id, never all-or-nothing ("בוצע ב-12 מתוך 14"). An item runs through
the same service function a single action uses (service.assign / change_status / edit), so the rules, the timeline row and the
per-ticket audit row are the ones of the single action. A refused item gets a `denied` audit row with its result; the request gets
one `ticket.bulk` row (action, counts).

Results: ok | unchanged | stale | forbidden | invalid_transition | not_found | assignee_not_allowed | unavailable | too_soon | invalid.
`not_found` is also the answer for a ticket the caller may not see (the uniform rule of section 8)."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any

from ...audit import audit
from ...db import now_iso
from ...errors import ApiError
from ..timeutil import parse_utc
from . import access, model, notify_bridge, service, store
from .access import Seen, Viewer, text

ACTIONS: tuple[str, ...] = ("assign", "remind", "priority", "close")
MAX_ITEMS = 50
REMIND_EVERY_S = 3600  # at most one manual reminder per ticket per hour
RESULTS: tuple[str, ...] = ("ok", "unchanged", "stale", "forbidden", "invalid_transition", "not_found", "assignee_not_allowed", "unavailable",
                            "too_soon", "invalid")
_RESULT_OF_CODE = {
    "ticket_stale": "stale",
    "invalid_transition": "invalid_transition",
    "reopen_window_passed": "invalid_transition",
    "ticket_closed": "invalid_transition",
    "forbidden": "forbidden",
    "ticket_not_found": "not_found",
    "assignee_not_allowed": "assignee_not_allowed",
    "already_assigned": "unchanged",
    "public_link_unavailable": "unavailable",
    "validation": "invalid",
}
_AUDIT_ACTION = {"assign": "ticket.assign", "remind": "ticket.remind", "priority": "ticket.edit", "close": "ticket.close"}


@dataclass(frozen=True)
class Params:
    assignee_kind: str = ""
    assignee_id: str = ""
    priority_key: str = ""
    note: str = ""


class _Outcome(Exception):
    """An item that ends without an error and without a change (`unchanged`), or with a result decided here (too_soon ...)."""

    def __init__(self, result: str):
        super().__init__(result)
        self.result = result


def validate(conn, action: str, items: list[tuple[str, int]], raw: dict[str, Any]) -> Params:
    """The request as a whole (422 `validation` naming the field): a known action, 1-50 distinct tickets, the parameters it needs."""
    problems: list[model.Problem] = []
    if action not in ACTIONS:
        problems.append(model.Problem("action", "unknown"))
    if not items:
        problems.append(model.Problem("items", "required"))
    elif len(items) > MAX_ITEMS:
        problems.append(model.Problem("items", "too_many"))
    elif len({i for i, _ in items}) != len(items):
        problems.append(model.Problem("items", "duplicate"))
    params = Params()
    if action == "assign":
        kind, ident = raw.get("assignee_kind") or "", raw.get("assignee_id") or ""
        if kind not in ("user", "contact") or not ident:
            problems.append(model.Problem("params.assignee", "required"))
        params = Params(assignee_kind=kind, assignee_id=ident)
    elif action == "priority":
        key = raw.get("priority_key") or ""
        if key not in ("urgent", "high", "normal", "low"):
            problems.append(model.Problem("params.priority_key", "unknown"))
        params = Params(priority_key=key)
    elif action == "close":
        try:
            note = model.text_field(raw.get("note"), "params.note", required=True, max_len=model.NOTE_MAX, multiline=True)
        except model.Invalid as exc:
            problems.extend(exc.problems)
            note = ""
        params = Params(note=note)
    if problems:
        raise service.invalid(conn, model.Invalid(problems))
    return params


def _remind(conn, viewer: Viewer, seen: Seen, rid: str | None) -> None:
    row = seen.row
    if row["status"] not in model.HANDLING or not row.get("current_assignment_id") or row.get("asg_ended_at"):
        raise service.bad_move(conn, row["status"], "reminder")
    if row.get("asg_kind") != "user":
        # a reminder to an outside contact is a message through the ticket channel (slice 5b): not available before it exists
        raise ApiError(409, "public_link_unavailable", text(conn, "שליחה לגורם חיצוני עדיין אינה זמינה בהתקנה זו."))
    last = store.last_manual_reminder_at(conn, row["id"])
    if last:
        try:
            if (dt.datetime.now(dt.timezone.utc) - parse_utc(last)).total_seconds() < REMIND_EVERY_S:
                raise _Outcome("too_soon")
        except ValueError:
            pass
    now = now_iso()
    store.insert_event(conn, row["id"], "reminder", actor_kind="user", actor_user_id=viewer.uid, actor_name=service.actor_name(viewer),
                       assignment_id=row["current_assignment_id"], data={"manual": True}, visible_external=True, at=now)
    # a reminder is not progress (section 13.2 measures the assignee's progress; reminding must not reset the stuck clocks)
    audit(conn, actor=viewer.principal, action="ticket.remind", decision="allowed", resource_type="ticket", resource_id=row["id"], request_id=rid,
          details={"number": row["number"], "manual": True, "bulk": True})
    hook = getattr(notify_bridge, "ticket_reminder", None)  # slice 6 adds the CR-018 `ticket.reminder` signal to the assignee
    if hook is not None:
        hook(conn, row["id"], row["current_assignment_id"], manual=True)


def _apply(conn, viewer: Viewer, seen: Seen, action: str, revision: int, p: Params, rid: str | None) -> None:
    row = seen.row
    if action == "close":
        service.change_status(conn, viewer, seen, "closed", p.note, revision, None, rid)
    elif action == "priority":
        prio = store.priority_by_key(conn, row["department_id"], p.priority_key)
        if prio is None or not prio["active"]:
            raise service.invalid(conn, model.Invalid([model.Problem("params.priority_key", "not_in_department")]))
        if prio["id"] == row["priority_id"]:
            raise _Outcome("unchanged")
        if not service.edit(conn, viewer, seen, {"priority_id": prio["id"]}, revision, rid):
            raise _Outcome("unchanged")
    elif action == "assign":
        service.assign(conn, viewer, seen, p.assignee_kind, p.assignee_id, None, True, revision, rid)
    elif action == "remind":
        _remind(conn, viewer, seen, rid)


def _refusal(conn, viewer: Viewer, action: str, ticket_id: str, number: int | None, result: str, rid: str | None) -> None:
    audit(conn, actor=viewer.principal, action=_AUDIT_ACTION[action], decision="denied", resource_type="ticket", resource_id=ticket_id,
          reason=result, request_id=rid, details={"number": number, "bulk": True})


def run(conn, viewer: Viewer, action: str, items: list[tuple[str, int]], p: Params, rid: str | None = None) -> dict[str, Any]:
    """Run one bulk action. `items` = [(ticket id, the revision the table showed)]. Returns {action, total, counts, results}."""
    results: list[dict[str, Any]] = []
    for ticket_id, revision in items:
        seen = access.visible_by_id(viewer, ticket_id)
        if seen is None:
            _refusal(conn, viewer, action, ticket_id, None, "not_found", rid)
            results.append({"id": ticket_id, "result": "not_found"})
            continue
        number = seen.row["number"]
        if not seen.manager:
            _refusal(conn, viewer, action, ticket_id, number, "forbidden", rid)
            results.append({"id": ticket_id, "number": number, "result": "forbidden"})
            continue
        if seen.row["revision"] != revision:
            results.append({"id": ticket_id, "number": number, "result": "stale"})
            continue
        result = "ok"
        try:
            with store.item_transaction(conn):
                _apply(conn, viewer, seen, action, revision, p, rid)
        except _Outcome as out:
            result = out.result
        except ApiError as exc:
            result = _RESULT_OF_CODE.get(exc.code, "invalid" if exc.status == 422 else "forbidden" if exc.status == 403 else "invalid")
            _refusal(conn, viewer, action, ticket_id, number, result, rid)  # the item's own audit rows were undone with it
        results.append({"id": ticket_id, "number": number, "result": result})
    counts = {r: 0 for r in RESULTS}
    for r in results:
        counts[r["result"]] += 1
    counts = {k: v for k, v in counts.items() if v}
    audit(conn, actor=viewer.principal, action="ticket.bulk", decision="allowed", resource_type="ticket", resource_id="*", request_id=rid,
          details={"action": action, "total": len(items), "counts": counts})
    return {"action": action, "total": len(items), "done": counts.get("ok", 0), "counts": counts, "results": results}
