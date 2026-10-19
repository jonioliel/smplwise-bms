"""CR-ARX-WISKEY-SHARED-IDENTITY section 5: the arrival step on the vendor's handler page - "who arrives, when" - which
creates a grant REQUEST, never a grant (CR 3.1.3: an RFQ confirmation can only create a `requested` grant; a forwarded link can
at most name a person, whose code still goes only to that person's verified number after a human approval).

`GET /t/api/arrival` and `POST /t/api/arrival` (public app, the handler-link rules of tickets 10.3: the token resolved once by
`link_context`, strict JSON, a mandatory `client_request_id` replayed by the request row, the uniform 404). Shown only while the
switch `access.external_grants` is on and the link's ticket is an RFQ work order (its awarded quote names the assignment).

Owner answer 7: the vendor picks one of his own persons (first name + the last two digits, persons under his `vendor_id` only) or
adds a technician (name + phone): a new technician is a contact with active = 0 and a row in `access_pending_contacts` until a
manager accepts him; he then confirms his own number by code (`phone_confirmed_via = 'code'`) before a code can reach it. The
vendor company itself never receives a code. Owner answer 9: the fixed privacy notice is acknowledged here (stored with its
version). Dates fall inside the order's work window (outside it only as a request flagged `outside_window`), the daily hours come
from a fixed list, the total is at most access.external.max_days (owner answer 8). The doors are SUGGESTED from the ticket's place
(stations placed in its building, then the site's stations flagged "entrance for external people"); the approver narrows them.

Nothing here contacts WisKey or WhatsApp; the answer never carries a phone number, a station id or an internal user id."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

from ..db import new_id
from . import access_grants as ag

UTC = dt.timezone.utc
NAME_MAX = 60
ROUTE = "/t/api/arrival"


class Refused(Exception):
    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


def _order(conn, assignment_id: str) -> dict[str, Any] | None:
    """The RFQ work order behind an assignment: the awarded quote names it; the dates are on the order's timeline row."""
    try:
        q = conn.execute("SELECT id, ticket_id, rfq_vendor_id FROM ticket_quotes WHERE assignment_id = ? AND ticket_id IS NOT NULL", (assignment_id,)).fetchone()
    except Exception:  # noqa: BLE001 - an installation without the RFQ tables
        return None
    if q is None:
        return None
    window = {"work_from": None, "work_to": None}
    # HARDEN271 K6: only this RFQ's own timeline (idx_ticket_rfq_events_rfq), never every order of the installation per public request
    rv = conn.execute("SELECT rfq_id FROM ticket_rfq_vendors WHERE id = ?", (q["rfq_vendor_id"],)).fetchone() if q["rfq_vendor_id"] else None
    rows = conn.execute("SELECT data_json FROM ticket_rfq_events WHERE rfq_id = ? AND kind = 'order_created' ORDER BY id DESC",
                        (rv["rfq_id"],)).fetchall() if rv is not None else []
    for r in rows:
        try:
            data = json.loads(r["data_json"] or "{}")
        except ValueError:
            continue
        if data.get("assignment_id") == assignment_id:
            window = {"work_from": data.get("work_from"), "work_to": data.get("work_to")}
            break
    return {"quote_id": q["id"], "ticket_id": q["ticket_id"], **window}


def _vendor_root(contact: dict[str, Any]) -> str | None:
    if contact.get("kind") == "vendor":
        return contact["id"]
    return contact.get("vendor_id")


def _persons(conn, link_contact: dict[str, Any]) -> list[dict[str, Any]]:
    """The persons the vendor may name: his own persons (active, not erased, not internal users, not employees) - or, for a lone
    person without a company, that person alone."""
    root = _vendor_root(link_contact)
    if root is None:
        rows = [link_contact] if link_contact.get("kind") == "person" else []
    else:
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM ticket_contacts WHERE vendor_id = ? AND kind = 'person' AND erased_at IS NULL AND active = 1 AND user_id IS NULL AND employee = 0 "
            "ORDER BY display_name", (root,)).fetchall()]
    return [r for r in rows if not r.get("erased_at") and r.get("active") and not r.get("user_id")]


def _label(contact: dict[str, Any]) -> str:
    first = (contact.get("display_name") or "").split(" ")[0][:24]
    digits = contact.get("phone_e164") or ""
    return f"{first} ····{digits[-2:]}" if len(digits) >= 2 else first


def _context(conn, link: Any, now: dt.datetime) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    from .tickets import store, store_links

    if not ag.enabled(conn):
        raise Refused(404, "link_unavailable")
    order = _order(conn, link.assignment_id)
    if order is None or order["ticket_id"] != link.ticket_id:
        raise Refused(404, "link_unavailable")
    ticket = store_links.ticket_of_link(conn, link.link_id)
    assignment = store.assignment(conn, link.assignment_id)
    contact = store_links.contact(conn, link.contact_id)
    if ticket is None or assignment is None or contact is None or assignment.get("ended_at") or ticket.get("status") in ("done", "closed", "cancelled", "returned"):
        raise Refused(404, "link_unavailable")
    if link.no_money:  # a staff link is not a vendor
        raise Refused(404, "link_unavailable")
    return order, ticket, assignment, contact


def _local_dates(conn, order: dict[str, Any]) -> tuple[str | None, str | None]:
    tz = ag.zone_of(conn)
    out = []
    for key in ("work_from", "work_to"):
        v = ag._parse_any(order.get(key)) if order.get(key) and "T" in str(order.get(key)) else None
        out.append(v.astimezone(tz).date().isoformat() if v else (str(order.get(key))[:10] if order.get(key) else None))
    return out[0], out[1]


def view(conn, link: Any, *, now: dt.datetime) -> dict[str, Any]:
    order, ticket, _assignment, contact = _context(conn, link, now)
    lang = contact.get("lang") if contact.get("lang") in ag.NOTICE_TEXT else "he"
    persons = _persons(conn, contact)
    current = None
    marks = ",".join("?" * len(ag.LIVE))
    g = conn.execute(f"SELECT * FROM access_grants WHERE assignment_id = ? AND state IN ({marks}) ORDER BY created_at DESC LIMIT 1",
                     (link.assignment_id, *ag.LIVE)).fetchone()
    if g is not None:
        person = ag.contact_row(conn, g["subject_id"]) or {}
        current = {"state": {"requested": "waiting", "revoking": "ending"}.get(g["state"], "approved" if g["state"] in ag.DECIDED else g["state"]),
                   "person": _label(person), "pending_change": bool(g["pending_json"])}
    wf, wt = _local_dates(conn, order)
    return {"available": True, "persons": [{"id": p["id"], "label": _label(p)} for p in persons], "can_add": _vendor_root(contact) is not None,
            "window": {"from": wf, "to": wt}, "hours": list(ag.HOURS_CHOICES), "max_days": ag.max_days(conn),
            "notice": {"version": ag.NOTICE_VERSION, "text": ag.NOTICE_TEXT[lang]}, "current": current}


def _new_technician(conn, link: Any, vendor_root: str, body: dict[str, Any], at: str) -> str:
    from .tickets import contacts

    name = " ".join(str(body.get("name") or "").split())[:NAME_MAX]
    if len(name) < 2:
        raise Refused(422, "invalid", fields=[{"field": "new_person.name", "code": "required"}])
    try:
        digits = contacts.normalize_phone(body.get("phone"))
    except contacts.ContactInvalid:
        digits = None
    if not digits:
        raise Refused(422, "invalid", fields=[{"field": "new_person.phone", "code": "format"}])
    try:
        key, key_id = contacts.phone_key_for(digits)
    except Exception:  # noqa: BLE001 - no module key: no keyed index (the per-number cap falls back to the contact)
        key, key_id = None, None
    vendor = ag.contact_row(conn, vendor_root) or {}
    cid = new_id()
    conn.execute("""INSERT INTO ticket_contacts(id, kind, vendor_id, display_name, company, phone_e164, phone_key, phone_key_id, lang, active,
                    created_by, created_at, updated_at) VALUES (?, 'person', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)""",
                 (cid, vendor_root, name, vendor.get("display_name") or "", digits, key, key_id, vendor.get("lang") or "he", f"contact:{link.contact_id}", at, at))
    conn.execute("INSERT INTO access_pending_contacts(contact_id, vendor_id, assignment_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
                 (cid, vendor_root, link.assignment_id, f"contact:{link.contact_id}", at))
    return cid


def _scope(conn, body: dict[str, Any], order: dict[str, Any], suggested: dict[str, list[int]], now: dt.datetime) -> tuple[ag.Scope, bool]:
    tz = ag.zone_of(conn)
    try:
        d_from = dt.date.fromisoformat(str(body.get("date_from")))
        d_to = dt.date.fromisoformat(str(body.get("date_to")))
    except ValueError:
        raise Refused(422, "invalid", fields=[{"field": "date_from", "code": "format"}]) from None
    hours = body.get("hours")
    if hours not in ag.HOURS_CHOICES:
        raise Refused(422, "invalid", fields=[{"field": "hours", "code": "unknown"}])
    today = now.astimezone(tz).date()
    if d_from < today or d_to < d_from:
        raise Refused(422, "invalid", fields=[{"field": "date_from", "code": "range"}])
    days = (d_to - d_from).days + 1
    if days > ag.max_days(conn):
        raise Refused(422, "invalid", fields=[{"field": "date_to", "code": "too_long"}], max_days=ag.max_days(conn))
    start, end = hours.split("-")
    vf = dt.datetime.combine(d_from, dt.time(int(start[:2]), int(start[3:])), tzinfo=tz)
    last = dt.datetime.combine(d_to, dt.time(0, 0), tzinfo=tz) + dt.timedelta(minutes=ag._minutes(end))
    timing = None
    if hours != "00:00-24:00":
        dates = [(d_from + dt.timedelta(days=i)).isoformat() for i in range(days)]
        timing = ag.parse_timing({"mode": "dates", "timezone": tz.key, "days": [], "dates": dates, "periods": [{"start": start, "end": end}]})
    wf, wt = _local_dates(conn, order)
    outside = bool((wf and d_from.isoformat() < wf) or (wt and d_to.isoformat() > wt))
    return ag.Scope(suggested, ag.iso(vf), ag.iso(last), timing, "pin"), outside


def suggested_doors(conn, ticket: dict[str, Any]) -> dict[str, list[int]]:
    """Stations placed in the ticket's building, then the site's stations flagged "entrance for external people"; relays from
    the CR-033 door map (else relay 1); at most access.external.max_doors doors. Never "all stations"."""
    limit = ag.max_doors(conn)
    ids: list[str] = []
    try:
        if ticket.get("building_id"):
            ids += [r[0] for r in conn.execute("SELECT p.config_entry_id FROM intercom_station_placement p JOIN access_station_entrance e ON e.station_id = p.config_entry_id "
                                               "WHERE p.building_id = ? ORDER BY p.config_entry_id", (ticket["building_id"],)).fetchall()]
            ids += [r[0] for r in conn.execute("SELECT config_entry_id FROM intercom_station_placement WHERE building_id = ? ORDER BY config_entry_id",
                                               (ticket["building_id"],)).fetchall()]
        if ticket.get("site_id"):
            ids += [r[0] for r in conn.execute("SELECT p.config_entry_id FROM intercom_station_placement p JOIN access_station_entrance e ON e.station_id = p.config_entry_id "
                                               "WHERE p.site_id = ? ORDER BY p.config_entry_id", (ticket["site_id"],)).fetchall()]
    except Exception:  # noqa: BLE001 - no placement table: no suggestion (the approver picks)
        ids = []
    out: dict[str, list[int]] = {}
    total = 0
    for sid in dict.fromkeys(ids):
        relays = sorted({int(r[0]) for r in conn.execute("SELECT physical_index FROM intercom_door_map WHERE config_entry_id = ?", (sid,)).fetchall()
                         if isinstance(r[0], int) and 1 <= r[0] <= 8}) or [1]
        relays = relays[: max(0, limit - total)]
        if not relays:
            break
        out[sid] = relays
        total += len(relays)
    return out


def _same_ticket(live: dict[str, Any], ticket: dict[str, Any], assignment: dict[str, Any]) -> bool:
    """Does the person's live grant belong to the ticket / assignment of this page? A grant carrying an assignment must carry THIS
    assignment; a grant without one (a manager's ticket-level request) must name this ticket. A manual grant (no ticket) never does."""
    if live.get("assignment_id"):
        return live["assignment_id"] == assignment["id"]
    return live.get("source_ref") is not None and live.get("source_ref") == ticket["id"]


def request(conn, link: Any, *, body: dict[str, Any], crid: str, now: dt.datetime, client_key: str = "") -> tuple[int, dict[str, Any]]:
    from .tickets import handler_actions, store_links
    from .tickets.public_store import audit_link

    order, ticket, assignment, contact = _context(conn, link, now)
    replay = handler_actions.claim(conn, link, crid, ROUTE, now)
    if replay is not None:
        return replay
    if body.get("notice_ack") is not True or body.get("notice_version") != ag.NOTICE_VERSION:
        raise Refused(422, "invalid", fields=[{"field": "notice_ack", "code": "required"}])
    at = ag.iso(now)
    root = _vendor_root(contact)
    if (body.get("new_person") is None) == (body.get("person_id") is None):
        raise Refused(422, "invalid", fields=[{"field": "person_id", "code": "exactly_one"}])
    if body.get("new_person") is not None:
        if root is None:
            raise Refused(409, "no_vendor")
        if not isinstance(body["new_person"], dict):
            raise Refused(422, "invalid", fields=[{"field": "new_person", "code": "type"}])
        person_id = _new_technician(conn, link, root, body["new_person"], at)
    else:
        person_id = body.get("person_id")
        if person_id not in {p["id"] for p in _persons(conn, contact)}:
            raise Refused(422, "invalid", fields=[{"field": "person_id", "code": "unknown"}])
    marks = ",".join("?" * len(ag.LIVE))
    other = conn.execute(f"SELECT subject_id FROM access_grants WHERE assignment_id = ? AND subject_id != ? AND state IN ({marks})",
                         (assignment["id"], person_id, *ag.LIVE)).fetchone()
    if other is not None:  # T8: one live request per assignment - a change of technician goes through the manager
        raise Refused(409, "arrival_other_person")
    live = ag.live_grant_of(conn, "contact", person_id)
    if live is not None and not _same_ticket(live, ticket, assignment):
        # F6 (grants-worker review M7): the person's one live grant belongs to another ticket / assignment (or to no ticket at all). The
        # page of THIS ticket never amends it - not a narrowing, not a widening request; a multi-ticket technician is the manager's case.
        raise Refused(409, "arrival_other_ticket")
    doors = json.loads(live["doors_json"]) if live is not None and live["state"] in ag.DECIDED else suggested_doors(conn, ticket)
    if not doors:  # HARDEN271 K1: nothing to suggest = a request no approver could approve; the transaction rolls back
        raise Refused(409, "no_doors_suggested")
    try:
        scope, outside = _scope(conn, body, order, doors, now)  # the page never changes approved doors: only the person, dates and hours
    except ag.ApiError as exc:
        raise Refused(422, "invalid", fields=[{"field": str(exc.details.get("field") or "hours"), "code": str(exc.details.get("code") or "invalid")}]) from None
    try:
        g, outcome = ag.request_grant(conn, actor=ag.ContactActor(f"contact:{link.contact_id}"), requested_by=f"contact:{link.contact_id}", contact_id=person_id,
                                      source_kind="rfq_order", source_ref=ticket["id"], assignment_id=assignment["id"], scope=scope, outside_window=outside)
    except ag.ApiError as exc:
        raise Refused(409, exc.code) from None
    conn.execute("INSERT OR REPLACE INTO access_grant_notices(grant_id, version, via, by_ref, at) VALUES (?, ?, 'page', ?, ?)",
                 (g["id"], ag.NOTICE_VERSION, f"contact:{link.contact_id}", at))
    ag._audit(conn, ag.ContactActor(f"contact:{link.contact_id}"), "access.grant.notice_ack", g["id"], via="page", version=ag.NOTICE_VERSION)
    store_links.insert_contact_event(conn, ticket["id"], "access_request", contact_id=link.contact_id, actor_name=assignment.get("assignee_name") or "",
                                     assignment_id=assignment["id"], at=at, data={"outcome": outcome, "outside_window": outside}, visible_external=True)
    audit_link(conn, link, "access.grant.request", outcome=outcome, outside_window=outside)
    ag.notify_request(conn, g["id"])
    answer = {"ok": True, "state": "waiting" if g["state"] == "requested" else "approved", "outcome": outcome, "outside_window": outside}
    return handler_actions._finish(conn, link, crid, 200, answer)
