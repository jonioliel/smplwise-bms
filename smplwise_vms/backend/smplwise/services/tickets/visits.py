"""CR-SVC215 slice 1 (docs/changes/CR-SVC215.md sections 3 and 4; owner answers 2026-10-24 items 31, 32, 35, 36): vendor visits, the
vendor's "I arrived" signal and the missed-arrival detector.

A visit (`ticket_visits`, migration 0156) is one planned presence of an outside vendor in the building, bound to the ticket's
external assignment. It is created by
  1. the vendor's ETA on his page (`POST /t/api/eta` -> `[eta, eta + visits.eta_window_min]`; a new ETA moves the planned visit,
     clearing the ETA cancels it),
  2. the confirmed RFQ arrival (rfq_terms._on_confirmed, the window confirmed by the vendor or accepted by the manager),
  3. the arrival step's first day and hours (services/access_arrival.request),
  4. a manager (`POST /tickets/{id}/visits`).
One planned visit per assignment at a time (a unique partial index); planning again moves it. A visit planned after a miss links
the missed one to it (`rescheduled_to`).

The arrival - three signals, in order of trust (section 3.2):
  - the vendor presses "הגעתי" on his page (`POST /t/api/arrived`) or moves the request to "in progress" there: a CLAIM, recorded as
    `arrived_by = vendor_link`. Owner answer 31: a claim counts as an arrival (`visits.claim_counts`, default on; off = it stays
    "reported" until staff confirm) and staff may cancel it (`visits.staff_can_undo_claim`, default on, audited);
  - staff mark it (`POST /tickets/{id}/visits/{vid}/arrived`, a manager of the ticket or its internal assignee): `staff`;
  - a door opened with the technician's grant credential (when external grants go live): `door` - `record_door_arrival()` is the
    entry point; nothing calls it in this build (GO_LIVE_PERMITTED is false).
No position, no GPS, no camera match - the owner's standing rule; the time is the server's.

The detector (`tick`, a throttled step of the tickets janitor, every 5 minutes): a planned visit whose `planned_to + grace` has passed
with no arrival becomes `missed` in one transaction with the timeline row `arrival_missed`, the audit row and the notification
`ticket.arrival_missed` (managers + the internal owner). Grace: the department's `visit_grace_min`, else `visits.grace_min` (owner
answer 32: 60 minutes); a department may switch the detector off (`visit_detect`). A visit whose window ended more than
`visits.backfill_days` ago becomes missed silently (no mass notification on an upgrade). The vendor is messaged only when
`visits.notify_vendor_on_miss` is on (owner answer 35: managers only by default) and a message channel is registered
(VENDOR_MISS_MESSAGE, services/tickets/messaging.py). The detector never changes the ticket's status, never closes, never escalates
beyond the managers, never touches a grant. The clock is injectable (`utcnow`, and `now=` on every function).

Everything here is behind the module switch AND `visits.enabled` (owner decision 400, 2.16.0: default OFF; it was ON in 2.15.0 by answer 36): off, the routes answer 404
`feature_disabled`, the public page carries no `visit` and `/t/api/arrived` is the uniform 404, the hooks do nothing and the detector
idles. All SQL lives in store_visits.py."""
from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Callable

from ...audit import audit
from ...db import Database, get_setting
from ...errors import ApiError
from . import notify_bridge, settings_doc, store, store_visits
from .access import module_on, text

log = logging.getLogger("smplwise.tickets.visits")

UTC = dt.timezone.utc
SOURCES = ("vendor_eta", "rfq_terms", "manager", "vendor_arrival_step")
OPEN_TICKET = frozenset({"new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned"})
EVERY_S = 300
BATCH = 200
MAX_SPAN = dt.timedelta(days=14)  # a single visit's window (a multi-day job is several visits)
_LAST: dict[str, float] = {}
STATS: dict[str, Any] = {"last_run_at": None, "looked": 0, "missed": 0, "notified": 0, "errors": 0}

# messaging.py registers the vendor's message on a miss: fn(conn, ticket_id, visit, now) -> bool (True = queued through the link channel,
# inside the send hours). None = no channel: the managers' notification is the only signal.
VENDOR_MISS_MESSAGE: Callable[[Any, str, dict[str, Any], dt.datetime], bool] | None = None


class VisitRefused(Exception):
    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status, self.code, self.extra = status, code, extra


def utcnow() -> dt.datetime:
    """The visits' clock (tests replace it)."""
    return dt.datetime.now(UTC).replace(microsecond=0)


def iso(v: dt.datetime | None) -> str | None:
    if v is None:
        return None
    return v.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse(at: Any) -> dt.datetime | None:
    if not at or not isinstance(at, str):
        return None
    try:
        v = dt.datetime.fromisoformat(at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (v if v.tzinfo else v.replace(tzinfo=UTC)).astimezone(UTC)


# ---------------------------------------------------------------- settings

def cfg(conn) -> dict[str, Any]:
    return settings_doc.read(conn)["visits"]


def enabled(conn) -> bool:
    return module_on(conn) and bool(cfg(conn)["enabled"])


def require_enabled(conn) -> None:
    if not enabled(conn):
        raise ApiError(404, "feature_disabled", text(conn, "ביקורי ספקים כבויים בהגדרות {the_tickets}."))


def grace_for(conn, department_id: str | None) -> int:
    own, _detect = store_visits.department_visit_settings(conn, department_id or "")
    return own if own is not None else int(cfg(conn)["grace_min"])


def _zone(conn) -> dt.tzinfo:
    from .stuck import _zone as zone_of

    return zone_of(get_setting(conn, "time.zone", None))


def window_text(conn, v: dict[str, Any]) -> str:
    """"14.02 09:00-11:00" in the installation's zone (a window across days names both days)."""
    tz = _zone(conn)
    a, b = parse(v.get("planned_from")), parse(v.get("planned_to"))
    if a is None or b is None:
        return ""
    la, lb = a.astimezone(tz), b.astimezone(tz)
    if la.date() == lb.date():
        return f"{la:%d.%m} {la:%H:%M}-{lb:%H:%M}"
    return f"{la:%d.%m %H:%M}-{lb:%d.%m %H:%M}"


def due_at(v: dict[str, Any]) -> dt.datetime | None:
    """`planned_to + grace` - the instant after which a planned visit with no arrival is missed."""
    end = parse(v.get("planned_to"))
    return None if end is None else end + dt.timedelta(minutes=int(v.get("grace_min") or 0))


def parse_window(conn, raw_from: Any, raw_to: Any, now: dt.datetime, *, field: str = "planned_from") -> tuple[dt.datetime, dt.datetime]:
    a, b = parse(raw_from), parse(raw_to)
    if a is None:
        raise VisitRefused(422, "invalid", fields=[{"field": field, "code": "format"}])
    if b is None:
        raise VisitRefused(422, "invalid", fields=[{"field": "planned_to", "code": "format"}])
    if b < a:
        raise VisitRefused(422, "invalid", fields=[{"field": "planned_to", "code": "order"}])
    if b - a > MAX_SPAN:
        raise VisitRefused(422, "invalid", fields=[{"field": "planned_to", "code": "too_long"}])
    if b < now - dt.timedelta(days=1):
        raise VisitRefused(422, "invalid", fields=[{"field": "planned_to", "code": "past"}])
    return a, b


# ---------------------------------------------------------------- planning

def _event(conn, ticket_id: str, kind: str, *, actor_kind: str, actor_user_id: str | None = None, actor_name: str = "",
           assignment_id: str | None = None, via: str = "app", data: dict[str, Any] | None = None, now: dt.datetime) -> int:
    return store.insert_event(conn, ticket_id, kind, actor_kind=actor_kind, actor_user_id=actor_user_id, actor_name=actor_name,
                              assignment_id=assignment_id, via=via, data=data, at=iso(now))


def _audit(conn, actor: Any, action: str, ticket_id: str, visit: dict[str, Any], rid: str | None = None, **details: Any) -> None:
    audit(conn, actor=actor, action=action, decision="allowed", resource_type="ticket", resource_id=ticket_id, request_id=rid,
          details={"visit_id": visit["id"], "state": visit.get("state"), **details})


def plan(conn, ticket: dict[str, Any], assignment: dict[str, Any] | None, *, planned_from: dt.datetime, planned_to: dt.datetime,
         source: str, by_kind: str, by: str | None, now: dt.datetime, grace: int | None = None, actor: Any = None,
         actor_name: str = "", rid: str | None = None) -> dict[str, Any]:
    """Plan a visit for the ticket's external assignment, or move the planned one (one planned visit per assignment). Returns the
    visit. The caller checked who may do it; `actor` is the audit actor (None = the system / the vendor's link)."""
    if source not in SOURCES:
        raise ValueError(source)
    if assignment is None or assignment.get("assignee_kind") != "contact" or assignment.get("ended_at"):
        raise VisitRefused(409, "no_vendor_assignment")
    g = grace if grace is not None else grace_for(conn, ticket["department_id"])
    if not 0 <= int(g) <= 240:
        raise VisitRefused(422, "invalid", fields=[{"field": "grace_min", "code": "range"}])
    via = "link" if by_kind == "contact" else ("system" if by_kind == "system" else "app")
    existing = store_visits.planned_for_assignment(conn, assignment["id"])
    if existing is not None:
        store_visits.update_visit(conn, existing["id"], {"planned_from": iso(planned_from), "planned_to": iso(planned_to), "source": source,
                                                         "grace_min": int(g), "claimed_at": None, "arrived_by": None, "arrived_actor": None})
        v = store_visits.visit(conn, existing["id"]) or existing
        _event(conn, ticket["id"], "visit_moved", actor_kind=by_kind if by_kind in ("user", "contact") else "system",
               actor_user_id=by if by_kind == "user" else None, actor_name=actor_name, assignment_id=assignment["id"], via=via,
               data={"visit_id": v["id"], "from": v["planned_from"], "to": v["planned_to"], "source": source}, now=now)
        _audit(conn, actor, "tickets.visit.move", ticket["id"], v, rid, source=source)
        notify_bridge.visit_planned(conn, ticket["id"], v, window_text(conn, v))
        return v
    contact_id, vendor_id = store_visits.contact_unit(conn, assignment.get("contact_id"))
    v = store_visits.insert_visit(conn, {
        "ticket_id": ticket["id"], "assignment_id": assignment["id"], "department_id": ticket["department_id"], "contact_id": contact_id,
        "vendor_id": vendor_id, "planned_from": iso(planned_from), "planned_to": iso(planned_to), "source": source, "grace_min": int(g),
        "state": "planned", "created_by_kind": by_kind if by_kind in ("user", "contact") else "system", "created_by": by,
    })
    prior = store_visits.latest_missed(conn, assignment["id"], v["id"])
    if prior is not None:  # a visit planned after a miss reschedules it (section 3.4: "ביקור חדש")
        store_visits.update_visit(conn, prior["id"], {"rescheduled_to": v["id"]})
        notify_bridge.visit_over(conn, ticket["id"], prior["id"])
    _event(conn, ticket["id"], "visit_planned", actor_kind=by_kind if by_kind in ("user", "contact") else "system",
           actor_user_id=by if by_kind == "user" else None, actor_name=actor_name, assignment_id=assignment["id"], via=via,
           data={"visit_id": v["id"], "from": v["planned_from"], "to": v["planned_to"], "source": source,
                 **({"rescheduled_from": prior["id"]} if prior else {})}, now=now)
    _audit(conn, actor, "tickets.visit.plan", ticket["id"], v, rid, source=source, **({"rescheduled_from": prior["id"]} if prior else {}))
    notify_bridge.visit_planned(conn, ticket["id"], v, window_text(conn, v))
    return v


def move(conn, ticket: dict[str, Any], visit: dict[str, Any], *, planned_from: dt.datetime, planned_to: dt.datetime, grace: int | None,
         revision: int, by: str, actor: Any, actor_name: str, now: dt.datetime, rid: str | None = None) -> dict[str, Any]:
    if visit["state"] != "planned":
        raise VisitRefused(409, "visit_not_planned", state=visit["state"])
    fields: dict[str, Any] = {"planned_from": iso(planned_from), "planned_to": iso(planned_to)}
    if grace is not None:
        if not 0 <= int(grace) <= 240:
            raise VisitRefused(422, "invalid", fields=[{"field": "grace_min", "code": "range"}])
        fields["grace_min"] = int(grace)
    if not store_visits.update_visit(conn, visit["id"], fields, expect_revision=revision):
        raise VisitRefused(409, "visit_stale", revision=visit["revision"])
    v = store_visits.visit(conn, visit["id"]) or visit
    _event(conn, ticket["id"], "visit_moved", actor_kind="user", actor_user_id=by, actor_name=actor_name, assignment_id=v.get("assignment_id"),
           data={"visit_id": v["id"], "from": v["planned_from"], "to": v["planned_to"], "source": "manager"}, now=now)
    _audit(conn, actor, "tickets.visit.move", ticket["id"], v, rid, source="manager")
    notify_bridge.visit_planned(conn, ticket["id"], v, window_text(conn, v))
    return v


def cancel(conn, ticket: dict[str, Any], visit: dict[str, Any], *, revision: int | None, by: str | None, actor: Any, actor_name: str = "",
           now: dt.datetime, rid: str | None = None, reason: str = "manager") -> dict[str, Any]:
    if visit["state"] != "planned":
        raise VisitRefused(409, "visit_not_planned", state=visit["state"])
    if not store_visits.update_visit(conn, visit["id"], {"state": "cancelled", "cancelled_at": iso(now), "cancelled_by": by or "system"},
                                     expect_revision=revision):
        raise VisitRefused(409, "visit_stale", revision=visit["revision"])
    v = store_visits.visit(conn, visit["id"]) or visit
    _event(conn, ticket["id"], "visit_cancelled", actor_kind="user" if by else "system", actor_user_id=by, actor_name=actor_name,
           assignment_id=v.get("assignment_id"), via="app" if by else "system", data={"visit_id": v["id"], "reason": reason}, now=now)
    _audit(conn, actor, "tickets.visit.cancel", ticket["id"], v, rid, reason=reason)
    notify_bridge.visit_over(conn, ticket["id"], v["id"])
    return v


# ---------------------------------------------------------------- the arrival

def button_open(conn, v: dict[str, Any], now: dt.datetime) -> bool:
    """The vendor's "הגעתי" is offered from `planned_from - visits.early_min` until `planned_to + grace` for a planned visit, and for a
    missed one until the end of that local day (a late arrival is recorded as late - section 3.4)."""
    start, end = parse(v.get("planned_from")), due_at(v)
    if start is None or end is None or v.get("claimed_at"):
        return False
    if now < start - dt.timedelta(minutes=int(cfg(conn)["early_min"])):
        return False
    if v["state"] == "planned":
        return now <= end
    if v["state"] == "missed" and not v.get("rescheduled_to"):
        tz = _zone(conn)
        local_end = (end.astimezone(tz) + dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return now < local_end.astimezone(UTC)
    return False


def arrive(conn, ticket: dict[str, Any], visit: dict[str, Any], *, by: str, actor_ref: str, now: dt.datetime, actor: Any = None,
           actor_user_id: str | None = None, actor_name: str = "", rid: str | None = None) -> tuple[dict[str, Any], bool]:
    """Record an arrival. `by`: vendor_link (a claim) | staff | door. Returns (the visit, changed). Idempotent: an arrived visit
    stays as it is (a staff confirmation of a reported claim is the one change)."""
    if by not in ("vendor_link", "staff", "door"):
        raise ValueError(by)
    if visit["state"] == "arrived":
        return visit, False
    if visit["state"] not in ("planned", "missed"):
        raise VisitRefused(409, "visit_not_planned", state=visit["state"])
    claim = by == "vendor_link"
    if claim and visit.get("claimed_at"):
        return visit, False  # already reported (claim_counts off): a second press changes nothing
    stamp = iso(now)
    end = due_at(visit)
    late = visit["state"] == "missed" or (end is not None and now > end)
    actor_kind = "contact" if claim else ("user" if by == "staff" else "system")
    via = "link" if claim else ("app" if by == "staff" else "system")
    if claim and not cfg(conn)["claim_counts"]:  # owner answer 31 (b): reported only; staff confirmation makes it an arrival
        store_visits.update_visit(conn, visit["id"], {"claimed_at": stamp, "arrived_by": "vendor_link", "arrived_actor": actor_ref})
        v = store_visits.visit(conn, visit["id"]) or visit
        _event(conn, ticket["id"], "arrival_reported", actor_kind="contact", actor_name=actor_name, assignment_id=v.get("assignment_id"), via="link",
               data={"visit_id": v["id"], "late": late}, now=now)
        if actor is not None:
            _audit(conn, actor, "tickets.visit.reported", ticket["id"], v, rid, by=by, late=late)
        notify_bridge.visit_arrived(conn, ticket["id"], v, claim=True, at_text=_local_hm(conn, now))
        return v, True
    fields: dict[str, Any] = {"state": "arrived", "arrived_at": stamp, "arrived_by": by, "arrived_actor": actor_ref, "late": 1 if late else 0}
    if visit.get("claimed_at") and by == "staff":
        fields["arrived_at"] = visit["claimed_at"]  # staff confirm the reported time
        end_ok = parse(visit["claimed_at"])
        fields["late"] = 1 if (visit["state"] == "missed" or (end is not None and end_ok is not None and end_ok > end)) else 0
        late = bool(fields["late"])
    store_visits.update_visit(conn, visit["id"], fields)
    v = store_visits.visit(conn, visit["id"]) or visit
    _event(conn, ticket["id"], "arrived_late" if late else "arrived", actor_kind=actor_kind, actor_user_id=actor_user_id, actor_name=actor_name,
           assignment_id=v.get("assignment_id"), via=via, data={"visit_id": v["id"], "by": by, "late": late}, now=now)
    if not (claim and actor is None):  # the vendor's own press is audited by the public route (the link envelope + the visit id only)
        _audit(conn, actor, "tickets.visit.arrived_late" if late else "tickets.visit.arrived", ticket["id"], v, rid, by=by)
    notify_bridge.visit_arrived(conn, ticket["id"], v, claim=claim, at_text=_local_hm(conn, now))
    return v, True


def _local_hm(conn, now: dt.datetime) -> str:
    return f"{now.astimezone(_zone(conn)):%H:%M}"


def undo_claim(conn, ticket: dict[str, Any], visit: dict[str, Any], *, revision: int, by: str, actor: Any, actor_name: str,
               now: dt.datetime, rid: str | None = None) -> dict[str, Any]:
    """Staff cancel the vendor's declaration (owner answer 31, `visits.staff_can_undo_claim`): the visit is planned again (the detector
    then judges it like any other), or missed when its window already passed / another visit is planned now. Audited."""
    if not cfg(conn)["staff_can_undo_claim"]:
        raise VisitRefused(403, "undo_not_allowed")
    claimed = visit.get("arrived_by") == "vendor_link" and (visit["state"] == "arrived" or visit.get("claimed_at"))
    if not claimed:
        raise VisitRefused(409, "not_a_claim")
    end = due_at(visit)
    other = store_visits.planned_for_assignment(conn, visit.get("assignment_id"))
    back_to = "planned" if (end is not None and now <= end and (other is None or other["id"] == visit["id"])) else "missed"
    fields: dict[str, Any] = {"state": back_to, "claimed_at": None, "arrived_at": None, "arrived_by": None, "arrived_actor": None, "late": 0,
                              "claim_undone_at": iso(now), "claim_undone_by": by}
    if back_to == "missed":
        fields["missed_at"] = iso(now)
    if not store_visits.update_visit(conn, visit["id"], fields, expect_revision=revision):
        raise VisitRefused(409, "visit_stale", revision=visit["revision"])
    v = store_visits.visit(conn, visit["id"]) or visit
    _event(conn, ticket["id"], "arrival_claim_undone", actor_kind="user", actor_user_id=by, actor_name=actor_name, assignment_id=v.get("assignment_id"),
           data={"visit_id": v["id"], "state": back_to}, now=now)
    _audit(conn, actor, "tickets.visit.undo_claim", ticket["id"], v, rid)
    notify_bridge.resolve(conn, "ticket.arrived", f"ticket:{ticket['id']}:arrived:{v['id']}")
    return v


def mark_missed(conn, ticket: dict[str, Any], visit: dict[str, Any], *, revision: int, by: str, actor: Any, actor_name: str,
                now: dt.datetime, rid: str | None = None) -> dict[str, Any]:
    """Staff mark a planned visit missed by hand (`POST .../missed`): no notification (the person marking it knows), no vendor message."""
    if visit["state"] != "planned":
        raise VisitRefused(409, "visit_not_planned", state=visit["state"])
    if not store_visits.update_visit(conn, visit["id"], {"state": "missed", "missed_at": iso(now), "claimed_at": None}, expect_revision=revision):
        raise VisitRefused(409, "visit_stale", revision=visit["revision"])
    v = store_visits.visit(conn, visit["id"]) or visit
    _event(conn, ticket["id"], "arrival_missed", actor_kind="user", actor_user_id=by, actor_name=actor_name, assignment_id=v.get("assignment_id"),
           data={"visit_id": v["id"], "manual": True}, now=now)
    _audit(conn, actor, "tickets.visit.missed", ticket["id"], v, rid, manual=True)
    notify_bridge.resolve(conn, "ticket.visit_planned", f"ticket:{ticket['id']}:visitplan:{v['id']}")
    return v


def record_door_arrival(conn, ticket_id: str, assignment_id: str, now: dt.datetime) -> dict[str, Any] | None:
    """The `door` signal (section 3.2): a door opened with the technician's grant credential - the only proof. The grants model calls
    this once external grants go live (not in this build). A missed or reported visit becomes arrived; nothing when the feature is off."""
    if not enabled(conn):
        return None
    t = store_visits.ticket_state(conn, ticket_id)
    v = store_visits.latest_for_assignment(conn, assignment_id)
    if t is None or v is None or v["state"] not in ("planned", "missed"):
        return None
    out, _ = arrive(conn, t, v, by="door", actor_ref="door", now=now)
    return out


# ---------------------------------------------------------------- hooks of the existing flows

def on_eta(conn, ticket: dict[str, Any], assignment: dict[str, Any], eta_at: str | None, now: dt.datetime) -> None:
    """handler_actions.set_eta: the vendor's ETA becomes (or moves) the planned visit; clearing it cancels a visit the ETA made."""
    if not enabled(conn) or assignment.get("assignee_kind") != "contact":
        return
    if eta_at is None:
        v = store_visits.planned_for_assignment(conn, assignment["id"])
        if v is not None and v["source"] == "vendor_eta":
            _savepoint(conn, lambda: cancel(conn, ticket, v, revision=None, by=None, actor=None, now=now, reason="eta_cleared"))
        return
    start = parse(eta_at)
    if start is None:
        return
    _savepoint(conn, lambda: plan(conn, ticket, assignment, planned_from=start, planned_to=start + dt.timedelta(minutes=int(cfg(conn)["eta_window_min"])),
                                  source="vendor_eta", by_kind="contact", by=assignment.get("contact_id"), now=now,
                                  actor_name=assignment.get("assignee_name") or ""))


def on_rfq_confirmed(conn, ticket_id: str | None, assignment_id: str | None, planned_from: str | None, planned_to: str | None,
                     now: dt.datetime) -> None:
    """rfq_terms._on_confirmed: a confirmed RFQ arrival becomes the work order's planned visit (without an end: `visits.rfq_window_min`)."""
    if not ticket_id or not assignment_id or not enabled(conn):
        return
    t = store_visits.ticket_state(conn, ticket_id)
    a = store.assignment(conn, assignment_id)
    start, end = parse(planned_from), parse(planned_to)
    if t is None or a is None or start is None:
        return
    if end is None or end < start or end - start > MAX_SPAN:
        end = start + dt.timedelta(minutes=int(cfg(conn)["rfq_window_min"]))
    _savepoint(conn, lambda: plan(conn, t, a, planned_from=start, planned_to=end, source="rfq_terms", by_kind="system", by=None, now=now))


def on_arrival_step(conn, ticket: dict[str, Any], assignment: dict[str, Any], date_from: Any, hours: Any, now: dt.datetime) -> None:
    """services/access_arrival.request: the first day and the daily hours the vendor entered become the planned visit."""
    if not enabled(conn) or not isinstance(date_from, str) or not isinstance(hours, str) or "-" not in hours:
        return
    try:
        day = dt.date.fromisoformat(date_from)
        a, b = hours.split("-", 1)
        tz = _zone(conn)
        start = dt.datetime.combine(day, dt.time(int(a[:2]), int(a[3:5])), tzinfo=tz)
        end = dt.datetime.combine(day, dt.time(0, 0), tzinfo=tz) + dt.timedelta(hours=int(b[:2]), minutes=int(b[3:5]))
    except (ValueError, IndexError):
        return
    if end <= start:
        return
    _savepoint(conn, lambda: plan(conn, ticket, assignment, planned_from=start.astimezone(UTC), planned_to=end.astimezone(UTC),
                                  source="vendor_arrival_step", by_kind="contact", by=assignment.get("contact_id"), now=now,
                                  actor_name=assignment.get("assignee_name") or ""))


def on_link_status(conn, ticket: dict[str, Any], assignment: dict[str, Any], to: str, contact_id: str, now: dt.datetime) -> None:
    """handler_actions.set_status: "in progress" through the link is the vendor's claim of arrival too (section 3.2) - only for a
    planned visit whose button would be open now."""
    if to != "in_progress" or not enabled(conn):
        return
    v = store_visits.planned_for_assignment(conn, assignment.get("id"))
    if v is None or not button_open(conn, v, now):
        return
    _savepoint(conn, lambda: arrive(conn, ticket, v, by="vendor_link", actor_ref=f"contact:{contact_id}", now=now,
                                    actor_name=assignment.get("assignee_name") or ""))


def _savepoint(conn, fn: Callable[[], Any]) -> None:
    """A hook never fails the vendor's or the manager's original action: a refusal of the visit logic (or a bug) is logged and rolled
    back to this SAVEPOINT, so a half-written visit never commits with the original action and the action itself still commits."""
    conn.execute("SAVEPOINT svc215_visit")
    try:
        fn()
    except VisitRefused as exc:
        conn.execute("ROLLBACK TO svc215_visit")
        log.info("visit hook skipped: %s", exc.code)
    except Exception:  # noqa: BLE001 - the original action commits without its visit; logged
        conn.execute("ROLLBACK TO svc215_visit")
        log.warning("visit hook failed", exc_info=True)
    conn.execute("RELEASE svc215_visit")


# ---------------------------------------------------------------- the public page

def public_block(conn, assignment_id: str | None, now: dt.datetime) -> dict[str, Any] | None:
    """`GET /t/api/ticket` gains `visit` (section 7): the state, the window, whether the button is open and the reported time - nothing
    else (no grace, no other visit, no staff name)."""
    if not enabled(conn):
        return None
    v = store_visits.latest_for_assignment(conn, assignment_id)
    if v is None or v["state"] == "cancelled":
        return None
    state = "reported" if v.get("claimed_at") else v["state"]
    can = bool(cfg(conn)["public_arrival"]) and button_open(conn, v, now)
    return {"state": state, "planned_from": v["planned_from"], "planned_to": v["planned_to"], "can_arrive": can,
            "arrived_at": v.get("arrived_at") or v.get("claimed_at"), "late": bool(v.get("late"))}


def public_arrived(conn, link: Any, *, crid: str, now: dt.datetime, client_key: str, route: str = "/t/api/arrived") -> tuple[int, dict[str, Any]]:
    """`POST /t/api/arrived` (section 3.3): the vendor's "הגעתי" - a claim. One transaction (handler_actions' order): the link read
    again, the request id claimed, the visit, the timeline, the audit (link envelope + the visit id only), the link's progress, the
    answer. Off / no live link -> the uniform 404 (LinkGone); no visit -> 409 `no_visit`; outside the window -> 422 `outside_window`."""
    from . import handler_actions
    from .public_store import audit_link

    if not enabled(conn) or not cfg(conn)["public_arrival"]:
        raise handler_actions.LinkGone()
    f = handler_actions.fresh(conn, link, now)
    replay = handler_actions.claim(conn, f.link, crid, route, now)
    if replay is not None:
        return replay
    v = store_visits.latest_for_assignment(conn, f.assignment["id"])
    if v is None or v["state"] in ("cancelled", "done"):
        raise handler_actions.ActionRefused(409, "no_visit")
    if v["state"] == "arrived" or v.get("claimed_at"):
        return handler_actions._finish(conn, f.link, crid, 200, {"ok": True, "state": "reported" if v.get("claimed_at") else "arrived",
                                                                  "arrived_at": v.get("arrived_at") or v.get("claimed_at")})
    if not button_open(conn, v, now):
        raise handler_actions.ActionRefused(422, "outside_window")
    t = store_visits.ticket_state(conn, f.ticket["id"]) or f.ticket
    out, _ = arrive(conn, t, v, by="vendor_link", actor_ref=f"contact:{f.link.contact_id}", now=now,
                    actor_name=f.assignment.get("assignee_name") or "")
    handler_actions._progress(conn, f, now, client_key)
    audit_link(conn, f.link, "ticket.visit.arrived", visit_id=out["id"], late=bool(out.get("late")))
    state = "reported" if out.get("claimed_at") else out["state"]
    return handler_actions._finish(conn, f.link, crid, 200, {"ok": True, "state": state, "arrived_at": out.get("arrived_at") or out.get("claimed_at"),
                                                              "late": bool(out.get("late"))})


# ---------------------------------------------------------------- what the request screen reads

def present(conn, v: dict[str, Any], now: dt.datetime, *, manager: bool) -> dict[str, Any]:
    out = {"id": v["id"], "assignment_id": v.get("assignment_id"), "state": "reported" if (v["state"] == "planned" and v.get("claimed_at")) else v["state"],
           "planned_from": v["planned_from"], "planned_to": v["planned_to"], "window": window_text(conn, v), "grace_min": int(v["grace_min"]),
           "source": v["source"], "arrived_at": v.get("arrived_at"), "claimed_at": v.get("claimed_at"), "arrived_by": v.get("arrived_by"),
           "claim": v.get("arrived_by") == "vendor_link", "late": bool(v.get("late")), "missed_at": v.get("missed_at"),
           "rescheduled_to": v.get("rescheduled_to"), "revision": int(v["revision"]), "due_at": iso(due_at(v))}
    if manager:
        c = cfg(conn)
        out["actions"] = {
            "move": v["state"] == "planned", "cancel": v["state"] == "planned", "missed": v["state"] == "planned",
            "arrived": v["state"] in ("planned", "missed"),
            "undo_claim": bool(c["staff_can_undo_claim"]) and v.get("arrived_by") == "vendor_link" and (v["state"] == "arrived" or bool(v.get("claimed_at"))),
            "reschedule": v["state"] == "missed" and not v.get("rescheduled_to"),
        }
    return out


# ---------------------------------------------------------------- the detector (the janitor)

def tick(db: Database, *, force: bool = False, now: dt.datetime | None = None) -> int:
    """The janitor step (retention.janitor, every 30 s; self-throttled to EVERY_S). Returns how many visits became missed."""
    key = str(db.path)
    mono = time.monotonic()
    if not force and mono - _LAST.get(key, -EVERY_S) < EVERY_S:
        return 0
    _LAST[key] = mono
    now = now or utcnow()
    missed = 0
    try:
        with db.connection(mode="read", label="tickets.visits.scan") as conn:
            if not enabled(conn):
                return 0
            rows = store_visits.due_planned(conn, iso(now) or "", BATCH)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the tick
        STATS["errors"] += 1
        log.warning("visits detector scan failed", exc_info=True)
        return 0
    for r in rows:
        try:
            with db.connection(label="tickets.visits.detect") as conn:
                if look(conn, r["id"], now):
                    missed += 1
        except Exception:  # noqa: BLE001 - one bad visit never stops the others
            STATS["errors"] += 1
            log.warning("visits detector failed on %s", r["id"], exc_info=True)
    STATS.update({"last_run_at": iso(now), "looked": len(rows)})
    STATS["missed"] += missed
    return missed


def look(conn, visit_id: str, now: dt.datetime) -> bool:
    """One planned visit (inside the caller's write transaction): missed when its window + grace passed with no arrival. True when it
    became missed. A visit of a closed / cancelled request is cancelled silently."""
    v = store_visits.visit(conn, visit_id)
    if v is None or v["state"] != "planned" or v.get("claimed_at"):
        return False
    t = store_visits.ticket_state(conn, v["ticket_id"])
    if t is None:
        return False
    if t["status"] not in OPEN_TICKET:
        store_visits.update_visit(conn, v["id"], {"state": "cancelled", "cancelled_at": iso(now), "cancelled_by": "system"})
        notify_bridge.visit_over(conn, t["id"], v["id"])
        return False
    _grace, detect = store_visits.department_visit_settings(conn, v["department_id"])
    end = due_at(v)
    if not detect or end is None or end > now:
        return False
    recent = end >= now - dt.timedelta(days=int(cfg(conn)["backfill_days"]))
    stamp = iso(now)
    store_visits.update_visit(conn, v["id"], {"state": "missed", "missed_at": stamp})
    fresh = store_visits.visit(conn, v["id"]) or v
    notified = recent and notify_bridge.visit_missed(conn, t["id"], fresh, window_text(conn, fresh))
    messaged = False
    if recent and cfg(conn)["notify_vendor_on_miss"] and VENDOR_MISS_MESSAGE is not None:
        try:
            messaged = bool(VENDOR_MISS_MESSAGE(conn, t["id"], fresh, now))
        except Exception:  # noqa: BLE001 - the miss is recorded whether or not the message could be queued
            log.warning("visit miss message failed for %s", v["id"], exc_info=True)
    upd: dict[str, Any] = {}
    if notified:
        upd["missed_notified_at"] = stamp
        STATS["notified"] += 1
    if messaged:
        upd["vendor_messaged_at"] = stamp
    if upd:
        store_visits.update_visit(conn, v["id"], upd)
    _event(conn, t["id"], "arrival_missed", actor_kind="system", assignment_id=v.get("assignment_id"), via="system",
           data={"visit_id": v["id"], "window": window_text(conn, fresh), "notified": bool(notified), "vendor_message": messaged, "silent": not recent},
           now=now)
    audit(conn, actor=None, action="tickets.visit.missed", decision="allowed", resource_type="ticket", resource_id=t["id"],
          details={"visit_id": v["id"], "number": t["number"], "notified": bool(notified), "vendor_message": messaged, "silent": not recent})
    return True
