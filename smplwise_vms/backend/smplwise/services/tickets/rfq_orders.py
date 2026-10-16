"""TKRFQ4 - requests for quotation, stage C4: the WORK ORDER of an award (docs/tickets/RFQ_BACKEND_CONTRACT.md section 18;
RFQ_SPEC_DRAFT.md sections 1, 2, 4, 9 - owner decisions 16.10).

    create     after an award is final (approved - a pending second approval is not), an RFQ manager who also manages the department
               opens ONE service request per awarded vendor (owner decision 4: a split award gives one request per vendor, linked to
               each other through the RFQ): the existing create path (create.create_ticket) and the existing external assignment
               (external.assign_contact - a handler link, never a staff contact) with its message SUPPRESSED; the awarded quote becomes
               the request's approved cost baseline with no copy (its `ticket_id` / `assignment_id` are set - DETAIL contract 4.2);
               the agreed scope, the execution dates (defaults: the quote's work window, else the request's) and the agreed documents
               (text: requests carry no files yet) go into the request's description. Idempotent by `request_key`.
    send       NOTHING is sent by the create (owner rule "approvals never send messages automatically"). The template `rfq_order`
               (he / en / ar / ru - no amount, no free text) leaves only on the manager's explicit click, after he saw the exact text
               (`preview`). Vendors that were not selected never get anything.
    state      the request becomes `ordered` when every approved award has its order and the award was final (`finalize`).

No new table (no migration): an order IS the award (its id) + the quote's `ticket_id` + the RFQ timeline rows `order_created` /
`order_sent` (ids, dates and states only - never a text) + the outbox row. A payment demand is later made against the baseline through
the existing claim flow."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any, Mapping

from ...audit import audit
from ...errors import ApiError
from . import access, model, money, quotes, rfq, store, store_links, store_quotes, store_rfq
from .access import Viewer, text
from .costs import iso, now_utc, parse

DOCUMENTS_MAX = 1000
ORDER_STATES_OPEN = ("awarded", "ordered")
SCOPE_TEXT = {"all": "ההצעה במלואה", "kinds": "סעיפי {kinds} בלבד", "lines": "סעיפים נבחרים: {lines}"}
KIND_HE = {"labor": "עבודה", "parts": "חלקים", "travel": "נסיעות", "other": "אחר"}


def _err(conn, status: int, code: str, **details: Any) -> ApiError:
    return rfq._err(conn, status, code, **details)


# ---------------------------------------------------------------- who may order

def may_order(viewer: Viewer, seen: rfq.RfqSeen) -> bool:
    """An RFQ manager (creator / internal owner / department manager, with tickets.external) who may also open a request in the
    department and hand it to an outside vendor there (the assignment is a manager act - external.assign_contact)."""
    row = seen.row
    dept = store.department(viewer.conn, row["department_id"]) or {}
    probe = _probe(row)
    return (rfq.is_manager(viewer, seen) and viewer.manages_department(row["department_id"]) and viewer.can_create_in(dept)
            and viewer.is_manager(probe) and viewer.holds(access.VIEW, probe))


def _probe(row: Mapping[str, Any]) -> dict[str, Any]:
    """The request-to-be as RBAC sees it: the RFQ's department and place."""
    return {"department_id": row["department_id"], "site_id": row.get("site_id"), "building_id": row.get("building_id"), "floor_id": row.get("floor_id")}


def need_order(conn, viewer: Viewer, seen: rfq.RfqSeen, action: str, rid: str | None) -> None:
    rfq.need_manager(conn, viewer, seen, action, rid)
    row = seen.row
    if not viewer.manages_department(row["department_id"]) or not viewer.is_manager(_probe(row)):
        raise rfq.refuse(conn, viewer, action, row, "not_department_manager", rid)
    dept = store.department(conn, row["department_id"]) or {}
    if not viewer.can_create_in(dept) or not viewer.holds(access.VIEW, _probe(row)):
        raise rfq.refuse(conn, viewer, action, row, "create_not_allowed", rid, permission=access.CREATE)


# ---------------------------------------------------------------- what an order is (derived: no table of its own)

def _events(conn, rfq_id: str) -> dict[str, dict[str, Any]]:
    """{award_id: {"created": data + at/actor, "sent": data + at}} from the RFQ timeline."""
    out: dict[str, dict[str, Any]] = {}
    for e in store_rfq.order_events(conn, rfq_id):
        try:
            data = json.loads(e["data_json"] or "{}")
        except ValueError:
            continue
        aid = data.get("award_id")
        if not aid:
            continue
        slot = out.setdefault(aid, {})
        key = "created" if e["kind"] == "order_created" else "sent"
        slot[key] = {**data, "at": e["at"], "by": e.get("actor_name") or ""}
    return out


def order_of(conn, award: Mapping[str, Any], events: Mapping[str, Mapping[str, Any]] | None = None) -> dict[str, Any] | None:
    """The order of one award: its quote carries the ticket (the baseline) and the timeline row carries the dates."""
    q = store_quotes.quote(conn, award["quote_id"]) or {}
    if not q.get("ticket_id"):
        return None
    ev = (events if events is not None else _events(conn, award["rfq_id"])).get(award["id"], {})
    created = ev.get("created") or {}
    return {"award_id": award["id"], "ticket_id": q["ticket_id"], "assignment_id": q.get("assignment_id"), "quote_id": q["id"],
            "work_from": created.get("work_from"), "work_to": created.get("work_to"), "created_at": created.get("at"),
            "created_by": created.get("by"), "ticket_number": created.get("ticket_number"), "sent": ev.get("sent")}


def scope_of(q: Mapping[str, Any], line_indexes: list[int]) -> dict[str, Any]:
    """The agreed scope of an award: the whole quote, the lines of some kinds ("עבודה בלבד"), or chosen lines."""
    lines = quotes.lines_of(q)
    idx = sorted(set(int(i) for i in line_indexes))
    if idx == list(range(len(lines))):
        return {"kind": "all", "kinds": [k for k in money.LINE_KINDS if any(ln.get("kind") == k for ln in lines)], "lines": len(lines)}
    kinds = [k for k in money.LINE_KINDS if any(lines[i].get("kind") == k for i in idx if i < len(lines))]
    by_kinds = [i for i, ln in enumerate(lines) if ln.get("kind") in kinds]
    if by_kinds == idx:
        return {"kind": "kinds", "kinds": kinds, "lines": len(idx)}
    return {"kind": "lines", "kinds": kinds, "lines": len(idx)}


def _scope_text(q: Mapping[str, Any], line_indexes: list[int]) -> str:
    s = scope_of(q, line_indexes)
    if s["kind"] == "all":
        return SCOPE_TEXT["all"]
    if s["kind"] == "kinds":
        return SCOPE_TEXT["kinds"].format(kinds=", ".join(KIND_HE[k] for k in s["kinds"]))
    lines = quotes.lines_of(q)
    names = [model.clean_text(lines[i].get("description") or KIND_HE.get(lines[i].get("kind") or "", ""))[:60] for i in sorted(line_indexes)
             if i < len(lines)]
    return SCOPE_TEXT["lines"].format(lines=", ".join(n for n in names if n))


def defaults(conn, row: Mapping[str, Any], award: Mapping[str, Any]) -> dict[str, Any]:
    """The order form's dates: CR-RFQ-PAYMENT-SCHEDULE - the arrival window the vendor confirmed (or the planned one); else the
    awarded quote's work window, else the request's wanted window."""
    t = store_rfq.terms(conn, award["id"])
    if t is not None and t.get("planned_from"):
        return {"work_from": t["planned_from"], "work_to": t.get("planned_to") or t["planned_from"]}
    q = store_quotes.quote(conn, award["quote_id"]) or {}
    wf = q.get("work_from") or row.get("work_from")
    wt = q.get("work_to") or q.get("work_from") or row.get("work_to") or wf
    return {"work_from": wf, "work_to": wt}


def _local_day(conn, value: str | None) -> str:
    at = parse(value)
    if at is None:
        return ""
    from .messaging import time_zone

    return at.astimezone(time_zone(conn)).strftime("%d.%m.%Y")


def _description(conn, row: Mapping[str, Any], q: Mapping[str, Any], award: Mapping[str, Any], wf: str, wt: str, documents: str | None) -> str:
    """The request's text: the RFQ's description, then the order block (scope, dates, documents) - never an amount."""
    a, b = _local_day(conn, wf), _local_day(conn, wt)
    block = [f"הזמנת עבודה מבקשת הצעת מחיר {rfq.ref(row['number'])}",
             f"היקף: {_scope_text(q, json.loads(award['line_indexes_json']))}",
             f"מועד עבודה: {a if a == b else f'{a} - {b}'}"]
    from . import rfq_terms

    block += rfq_terms.order_lines(conn, award["id"])  # CR-RFQ-PAYMENT-SCHEDULE: the arrival confirmation and the due rules (no amount)
    if documents:
        block.append(f"מסמכים שסוכמו: {documents}")
    head = (row.get("description") or "").strip()
    body = "\n".join(block)
    room = model.DESCRIPTION_MAX - len(body) - 2
    if head and room > 0:
        return f"{head[:room]}\n\n{body}"
    return body[:model.DESCRIPTION_MAX]


# ---------------------------------------------------------------- create the order (opens the service request; sends nothing)

def _dates(conn, row: Mapping[str, Any], award: Mapping[str, Any], body: Mapping[str, Any], now: dt.datetime) -> tuple[str, str]:
    d = defaults(conn, row, award)
    wf = rfq._instant(conn, body["work_from"], "work_from", now) if body.get("work_from") else d["work_from"]
    wt = rfq._instant(conn, body["work_to"], "work_to", now) if body.get("work_to") else (d["work_to"] if not body.get("work_from") else wf)
    if not wf:
        raise rfq.invalid(conn, "work_from", "required")
    wt = wt or wf
    if wt < wf:
        raise rfq.invalid(conn, "work_to", "order")
    return wf, wt


def _all_ordered(conn, row: Mapping[str, Any]) -> bool:
    approved = [a for a in store_rfq.awards_of(conn, row["id"]) if a["state"] == "approved"]
    if not approved or not any(a["finalize"] for a in approved):
        return False  # a split still being decided (finalize false on every award so far) stays `awarded`
    return all((store_quotes.quote(conn, a["quote_id"]) or {}).get("ticket_id") for a in approved)


def create_order(conn, viewer: Viewer, seen: rfq.RfqSeen, award_id: str, body: Mapping[str, Any], request_key: str,
                 rid: str | None = None) -> dict[str, Any]:
    """Opens the service request of one awarded vendor. Every refusal comes BEFORE the first write; the writes run in a savepoint so a
    late refusal of the reused create / assign code leaves nothing half-made. Returns {"ticket_id", "number", "replayed"}."""
    from . import create, external, owners

    now = now_utc()
    need_order(conn, viewer, seen, "ticket.rfq.order", rid)
    row = rfq.apply_due(conn, dict(seen.row), now)
    a = rfq.award_of(conn, seen, award_id)
    scope = f"rfqorder:{a['id']}"
    prior = store.request_get(conn, scope, request_key)
    if prior is not None:  # a repeated press: the same answer, no second request
        out = json.loads(prior["response_json"])
        return {**out, "replayed": True}
    if a["state"] == "pending_second":
        raise _err(conn, 409, "award_pending")
    if a["state"] != "approved" or row["state"] not in ORDER_STATES_OPEN:
        raise rfq._bad_move(conn, row, "order", now)
    q = store_quotes.quote(conn, a["quote_id"]) or {}
    if q.get("ticket_id"):
        t = access.visible_by_id(viewer, q["ticket_id"])
        raise _err(conn, 409, "order_exists", ticket_id=t.row["id"] if t else None)
    if q.get("state") not in quotes.APPROVED:
        raise rfq._bad_move(conn, row, "order", now)
    v = store_rfq.vendor(conn, a["rfq_vendor_id"]) or {}
    if v.get("state") != "awarded":
        raise _err(conn, 409, "vendor_not_allowed", reason="vendor_state", vendor_id=v.get("id"))
    contact = store_links.contact(conn, v["contact_id"])
    problem = rfq.vendor_problem(conn, contact, row["department_id"])
    if problem:  # never a staff contact, an internal user, an erased / inactive row or another department's vendor
        raise _err(conn, 409, "vendor_not_allowed", reason=problem, vendor_id=v["id"])
    if not access.public_ready(conn):
        raise ApiError(409, "public_link_unavailable", text(conn, rfq.MESSAGES["public_link_unavailable"]))
    wf, wt = _dates(conn, row, a, body, now)
    try:
        documents = model.text_field(body.get("documents"), "documents", required=False, max_len=DOCUMENTS_MAX, multiline=True) or None
    except model.Invalid as exc:
        p = exc.problems[0]
        raise rfq.invalid(conn, p.field, p.code) from None
    at = iso(now)
    who = rfq.actor_name(viewer)
    with store.item_transaction(conn, "rfq_order"):
        res = create.create_ticket(conn, create.TicketSpec(department_id=row["department_id"], title=row["title"],
                                                           description=_description(conn, row, q, a, wf, wt, documents)), viewer, rid=rid)
        tid = res.ticket_id
        store.update_ticket(conn, tid, {"site_id": row.get("site_id"), "building_id": row.get("building_id"), "floor_id": row.get("floor_id"),
                                        "place_text": row.get("place_text") or "", "allowed_line_kinds": row.get("allowed_line_kinds")}, bump=False)
        if row.get("internal_owner_user_id"):
            owners.set_from_rfq(conn, tid, row["internal_owner_user_id"], by=viewer.uid, at=at)  # RFQ_SPEC 2: the RFQ's internal owner
        seen_t = access.require_visible(viewer, tid)
        aid = external.assign_contact(conn, viewer, seen_t, v["contact_id"], note=None, note_external=False,
                                      require_code=True if v.get("require_code") else None, share_history=None, send_now=False,
                                      revision=seen_t.row["revision"], rid=rid, cost_claim="required", dispatch=False)
        # the awarded quote IS the baseline of this assignment (DETAIL 4.2) - no copy
        store_quotes.update_quote(conn, q["id"], {"ticket_id": tid, "assignment_id": aid}, now=at)
        store.insert_event(conn, tid, "rfq_order", actor_kind="user", actor_user_id=viewer.uid, actor_name=who,
                           data={"rfq_id": row["id"], "number": row["number"], "award_id": a["id"], "quote_id": q["id"], "version": q["version"]}, at=at)
        store_rfq.insert_event(conn, row["id"], "order_created", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, rfq_vendor_id=v["id"],
                               data={"award_id": a["id"], "ticket_id": tid, "ticket_number": res.number, "assignment_id": aid, "quote_id": q["id"],
                                     "work_from": wf, "work_to": wt, "documents": bool(documents)}, at=at)
        fields: dict[str, Any] = {"state": "ordered"} if row["state"] == "awarded" and _all_ordered(conn, row) else {}
        rfq._touch(conn, row, fields, None, now)
        rfq._audit(conn, viewer, "ticket.rfq.order", row, rid, award_id=a["id"], vendor_id=v["id"], quote_id=q["id"], ticket_id=tid,
                   ticket_number=res.number, assignment_id=aid, state=fields.get("state", row["state"]))
    out = {"ticket_id": tid, "number": res.number}
    store.request_put(conn, scope, request_key, "rfq.order", 201, out)
    return {**out, "replayed": False}


# ---------------------------------------------------------------- the order message (explicit click only)

def _order_context(conn, viewer: Viewer, seen: rfq.RfqSeen, award_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any],
                                                                                      dict[str, Any], dict[str, Any], dict[str, Any] | None]:
    a = rfq.award_of(conn, seen, award_id)
    order = order_of(conn, a) if a["state"] == "approved" else None
    if order is None:
        raise _err(conn, 404, "order_not_found")
    v = store_rfq.vendor(conn, a["rfq_vendor_id"]) or {}
    contact = store_links.contact(conn, v.get("contact_id")) or {}
    seen_t = access.visible_by_id(viewer, order["ticket_id"])
    if seen_t is None:
        raise _err(conn, 404, "order_not_found")
    ticket = seen_t.row
    link = store_links.link_for_assignment(conn, order["assignment_id"]) if order.get("assignment_id") else None
    return a, order, v, contact, ticket, link


def _refusals(conn, order: Mapping[str, Any], contact: Mapping[str, Any], ticket: Mapping[str, Any], link: Mapping[str, Any] | None,
              now: dt.datetime) -> tuple[list[str], str]:
    from . import handler_links

    out: list[str] = []
    if not ticket or ticket.get("status") in model.FINAL:
        out.append("order_ticket_closed")
    asg = store.assignment(conn, order.get("assignment_id"))
    if link is None or asg is None or asg.get("ended_at") or handler_links.state(dict(link), now) != "live":
        out.append("order_link_unavailable")
    if rfq.vendor_problem(conn, contact, ticket.get("department_id") or "") is not None:
        out.append("vendor_not_allowed")
    planned = rfq._plan(conn, contact) if contact and not contact.get("erased_at") else "manual"
    from .messaging import RUNTIME

    if planned == "manual" or RUNTIME.outbox is None:
        out.append("order_channel_unavailable")
    return out, planned


def order_params(conn, row: Mapping[str, Any], order: Mapping[str, Any], contact: Mapping[str, Any]) -> dict[str, str]:
    """The placeholders of `rfq_order` (rfq.message_params with the order's dates as the window): never {link}, a phone, an amount."""
    return rfq.message_params(conn, {**row, "work_from": order.get("work_from"), "work_to": order.get("work_to")}, contact)


def _render(conn, row: Mapping[str, Any], params: Mapping[str, str], contact: Mapping[str, Any]) -> dict[str, Any]:
    """The EXACT text the outbox will render for this vendor (the department's / installation's `rfq_order` template in his language,
    else the starter), the link shown as a placeholder."""
    from . import message_templates as mt
    from .messaging import LINK_PLACEHOLDER, display_names, message_template_rows, template_text

    lang = contact.get("lang") if contact.get("lang") in mt.LANGS else "he"
    cands = [template_text(r) for r in message_template_rows(conn, purpose="rfq_order", department_id=row["department_id"])]
    tpl = mt.choose(cands, purpose="rfq_order", lang=lang, department_id=row["department_id"]) or mt.starter("rfq_order", lang)
    if tpl is None:
        return {"text": "", "lang": lang}
    try:
        body = mt.render(tpl.body, params, lang=tpl.lang, display_name=display_names(conn),
                         secrets={"link": LINK_PLACEHOLDER.get(tpl.lang, "[link]")}, check_length=False)
    except mt.TemplateError:
        body = ""
    return {"text": body, "lang": tpl.lang}


def preview(conn, viewer: Viewer, seen: rfq.RfqSeen, award_id: str, rid: str | None = None) -> dict[str, Any]:
    """`GET .../awards/{award_id}/order/preview`: the exact outgoing text, the channel and every refusal the send would meet - no side
    effect."""
    now = now_utc()
    need_order(conn, viewer, seen, "ticket.rfq.order_send", rid)
    _a, order, _v, contact, ticket, link = _order_context(conn, viewer, seen, award_id)
    refusals, planned = _refusals(conn, order, contact, ticket, link, now)
    rendered = _render(conn, seen.row, order_params(conn, seen.row, order, contact), contact)
    return {"award_id": award_id, "text": rendered["text"], "lang": rendered["lang"], "channel": planned, "refusals": refusals,
            "sent": order.get("sent") is not None, "sent_at": (order.get("sent") or {}).get("at")}


def send_order(conn, viewer: Viewer, seen: rfq.RfqSeen, award_id: str, rid: str | None = None) -> dict[str, Any]:
    """The manager's explicit click: queues ONE `rfq_order` message (the template, the handler link of the new request) to the awarded
    vendor. A repeat answers the first send (no second message). Refusals: the request closed, the link not live, no channel."""
    from .messaging import RUNTIME

    now = now_utc()
    need_order(conn, viewer, seen, "ticket.rfq.order_send", rid)
    a, order, v, contact, ticket, link = _order_context(conn, viewer, seen, award_id)
    if order.get("sent"):
        s = order["sent"]
        return {"queued": True, "channel": s.get("channel"), "outbox_id": s.get("outbox_id"), "already": True}
    refusals, planned = _refusals(conn, order, contact, ticket, link, now)
    for code in ("order_ticket_closed", "order_link_unavailable", "vendor_not_allowed", "order_channel_unavailable"):
        if code in refusals:
            raise _err(conn, 409, code)
    assert link is not None
    row = seen.row
    queued = RUNTIME.enqueue(conn, purpose="rfq_order", contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=order["assignment_id"],
                             link_id=link["id"], department_id=row["department_id"], params=order_params(conn, row, order, contact),
                             channel=planned, requested_by=viewer.uid,
                             idempotency_key=f"rfqorder:{a['id']}:{int(link.get('generation') or 1)}", rfq_id=row["id"])
    oid = getattr(queued, "id", None)
    at = iso(now)
    who = rfq.actor_name(viewer)
    store_rfq.insert_event(conn, row["id"], "order_sent", actor_kind="user", actor_user_id=viewer.uid, actor_name=who, rfq_vendor_id=v["id"],
                           data={"award_id": a["id"], "ticket_id": ticket["id"], "outbox_id": oid, "channel": planned}, at=at)
    store.insert_event(conn, ticket["id"], "rfq_order_sent", actor_kind="user", actor_user_id=viewer.uid, actor_name=who,
                       assignment_id=order["assignment_id"], data={"rfq_id": row["id"], "outbox_id": oid, "channel": planned}, at=at)
    from . import rfq_terms

    rfq_terms.requested(conn, a["id"], via="order", now=now)  # CR-RFQ-PAYMENT-SCHEDULE: the confirmation clock starts (once)
    rfq._touch(conn, row, {}, None, now)
    rfq._audit(conn, viewer, "ticket.rfq.order_send", row, rid, award_id=a["id"], vendor_id=v["id"], ticket_id=ticket["id"], outbox_id=oid,
               channel=planned)
    return {"queued": True, "channel": planned, "outbox_id": oid, "already": False}


# ---------------------------------------------------------------- presentation

def award_extras(conn, viewer: Viewer, seen: rfq.RfqSeen, awards: list[dict[str, Any]], amounts: bool) -> dict[str, dict[str, Any]]:
    """Per award: `order` (null until created), `ticket` ({id, number} of the opened request - the id only when the caller may open
    it), `scope`, `order_defaults` (the form's dates, while no order exists) and `can` {order, send_order}."""
    row = seen.row
    events = _events(conn, row["id"])
    ok = may_order(viewer, seen)
    state = rfq.effective_state(row, now_utc())
    out: dict[str, dict[str, Any]] = {}
    for a in awards:
        q = store_quotes.quote(conn, a["quote_id"]) or {}
        o = order_of(conn, a, events) if a["state"] == "approved" else None
        extra: dict[str, Any] = {"order": None, "ticket": None, "scope": scope_of(q, json.loads(a["line_indexes_json"])) if q else None,
                                 "order_defaults": None, "can": {"order": False, "send_order": False}}
        if o is not None:
            st = access.visible_by_id(viewer, o["ticket_id"])
            t = st.row if st is not None else {}
            ticket = {"id": o["ticket_id"] if st is not None else None, "number": t.get("number") or o.get("ticket_number"),
                      "status": t.get("status")}
            sent = o.get("sent")
            extra.update({"ticket": ticket if ticket["number"] is not None else None,
                          "order": {"ticket": ticket, "work_from": o["work_from"], "work_to": o["work_to"], "created_at": o["created_at"],
                                    "created_by": o["created_by"],
                                    "sent": {"at": sent["at"], "channel": sent.get("channel"), "by": sent.get("by")} if sent else None}})
            extra["can"]["send_order"] = bool(ok and not sent and t and t.get("status") not in model.FINAL)
        elif a["state"] == "approved":
            extra["order_defaults"] = defaults(conn, row, a) if ok else None
            extra["can"]["order"] = bool(ok and state in ORDER_STATES_OPEN)
        out[a["id"]] = extra
    return out


def origin_block(conn, viewer: Viewer, ticket_row: Mapping[str, Any]) -> dict[str, Any] | None:
    """The ticket drawer's "נפתחה מבקשת הצעת מחיר N": the request (its id only when the caller may open it), the order's dates and
    the other requests the same RFQ opened (a split award - one per vendor, linked; only those the caller may see)."""
    q = store_rfq.rfq_quote_of_ticket(conn, ticket_row["id"])
    if q is None:
        return None
    v = store_rfq.vendor(conn, q.get("rfq_vendor_id")) or {}
    rfq_id = v.get("rfq_id")
    number = rfq.number_of(conn, rfq_id)
    if number is None:
        return None
    seen = rfq.visible_by_id(viewer, rfq_id)
    award = next((a for a in store_rfq.awards_of(conn, rfq_id) if a["quote_id"] == q["id"] and a["state"] == "approved"), None)
    o = order_of(conn, award) if award else None
    siblings = []
    for other in store_rfq.ordered_quotes_of_rfq(conn, rfq_id):
        if other["ticket_id"] == ticket_row["id"]:
            continue
        s = access.visible_by_id(viewer, other["ticket_id"])
        if s is not None:
            siblings.append({"id": s.row["id"], "number": s.row["number"]})
    return {"id": rfq_id if seen else None, "number": number, "ref": rfq.ref(number), "work_from": (o or {}).get("work_from"),
            "work_to": (o or {}).get("work_to"), "siblings": siblings}
