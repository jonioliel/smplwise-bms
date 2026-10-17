"""TKRFQVP (docs/tickets/RFQ_BACKEND_CONTRACT.md section 15): what a vendor may see and do on his PUBLIC quote page, authorised by his
personal RFQ link (never by a person's visibility). The public routes (public_rfq.py) resolve the link and call these functions inside
one transaction each; everything here works on the link's own vendor row and request only.

    view      the request as the vendor may see it (15.3) - his OWN quote, his OWN thread, never another vendor, another quote, an
              amount of someone else, the comparison, the award of someone else, internal notes or who answered
    open      counters of the link and the vendor row; the vendor `sent` -> `opened`, the request `sent` -> `collecting`
    quote     a new version (supersedes his `submitted` one); only the allowed line kinds; money computed here (money.py)
    withdraw  his `submitted` quote (not while a second approval is pending on it)
    decline   "not interested" with a short reason (no live quote)
    ask       a clarification question, stored in his private thread; NOTHING is sent to anyone outside
TKRFQ5: quote / withdraw / decline / ask also raise the RFQ managers' notification (rfq_notify: the reference and the place only - never
an amount, the vendor's name or his text); the notification centre is internal, nothing reaches a vendor.
Every write stops at the deadline (owner decision: no late quote) and records an RFQ timeline row (ids and versions only) and an audit
row (actor `contact:<id>`, source `rfq_link`; ids / versions / totals - never a text)."""
from __future__ import annotations

import dataclasses
import datetime as dt
from typing import Any, Mapping

from ...audit import audit
from ...db import get_setting
from . import money, org_locations, quotes, rfq, rfq_notify, rfq_terms, settings_doc, store, store_links, store_quotes, store_rfq
from .costs import CostRefused, cost_settings, iso, parse


def _vendor_location(row: Mapping[str, Any]) -> dict[str, str] | None:
    """CR-ORG-LOCATIONS: the request's location as its vendor page shows it - the full text (name, address, details) and the map
    link only when the manager switched it on for this request (owner answer 17.10 (c))."""
    snap = org_locations.parse_snapshot(row.get("location_snapshot"))
    if snap is None:
        return None
    url = org_locations.nav_url(snap.get("lat"), snap.get("lng")) if row.get("location_nav") else ""
    return {"text": org_locations.display_text(snap), "map_url": url}

LANGS = ("he", "en", "ar", "ru")
RTL = frozenset({"he", "ar"})
MESSAGE_MAX = rfq.MESSAGE_MAX
DECLINE_MAX = rfq.DECLINE_MAX
MESSAGES_PER_VENDOR = 30
VALID_HORIZON_DAYS = 366
QUOTE_STATE = {"submitted": "submitted", "approved": "awarded", "partially_approved": "partially_awarded", "withdrawn": "withdrawn"}


class VendorRefused(Exception):
    """A public refusal: status + code (+ small extra fields)."""

    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


class VendorLinkGone(Exception):
    """The link's request or vendor row is gone (purged meanwhile): the uniform 404."""


@dataclasses.dataclass(frozen=True)
class RfqLinkActor:
    """The synthetic principal of a write made through an RFQ vendor link (audit only; it holds no permission anywhere)."""

    contact_id: str

    @property
    def user_id(self) -> str:
        return f"contact:{self.contact_id}"

    @property
    def username(self) -> str:
        return "rfq_link"

    source = "rfq_link"


class _NoGrant:
    scope = None


def _audit(conn, link: Any, action: str, row: Mapping[str, Any], **details: Any) -> None:
    audit(conn, actor=RfqLinkActor(link.contact_id), action=action, decision="allowed", resource_type="ticket_rfq", resource_id=row["id"],
          details={"source": "rfq_link", "link": link.link_id[:6], "number": row["number"], **details}, under=_NoGrant())


def _fresh(conn, link: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    row = rfq.row_of_link(conn, link.rfq_id)
    v = store_rfq.vendor(conn, link.rfq_vendor_id)
    if row is None or v is None or v["rfq_id"] != row["id"]:
        raise VendorLinkGone()
    return row, v


def _approved_award(conn, row: Mapping[str, Any], v: Mapping[str, Any]) -> dict[str, Any] | None:
    return next((a for a in store_rfq.awards_of(conn, row["id"]) if a["rfq_vendor_id"] == v["id"] and a["state"] == "approved"), None)


def page_state(conn, row: Mapping[str, Any], v: Mapping[str, Any], now: dt.datetime) -> str:
    """The vendor's own view of the request (contract 15.3)."""
    if row["state"] == "cancelled":
        return "cancelled"
    if v["state"] == "awarded" or _approved_award(conn, row, v) is not None:
        return "awarded"
    eff = rfq.effective_state(row, now)
    if eff in ("awarded", "ordered", "closed"):
        return "closed"
    if eff == "due_passed":
        return "due_passed"
    if v["state"] == "declined":
        return "declined"
    return "open"


def _shown_quote(conn, v: Mapping[str, Any]) -> dict[str, Any] | None:
    """His latest quote that still means something to him: submitted / approved / partially approved, or a withdrawal not yet replaced."""
    qs = [q for q in store_rfq.quotes_of_vendor(conn, v["id"]) if q["state"] in QUOTE_STATE]
    approved = [q for q in qs if q["state"] in quotes.APPROVED]
    if approved:
        return approved[-1]
    return qs[-1] if qs else None


def _submitted(conn, v: Mapping[str, Any]) -> dict[str, Any] | None:
    qs = [q for q in store_rfq.quotes_of_vendor(conn, v["id"]) if q["state"] == "submitted"]
    return qs[-1] if qs else None


def in_window(row: Mapping[str, Any], q: Mapping[str, Any]) -> bool | None:
    wf, wt = row.get("work_from"), row.get("work_to")
    if not q.get("work_from") or not (wf or wt):
        return None
    start, end = q["work_from"], q.get("work_to") or q["work_from"]
    return bool((not wf or wf <= start) and (not wt or end <= wt))


def present_quote(row: Mapping[str, Any], q: Mapping[str, Any]) -> dict[str, Any]:
    approved = q["state"] in quotes.APPROVED
    return {
        "id": q["id"], "version": q["version"], "state": QUOTE_STATE.get(q["state"], "submitted"),
        "lines": [{"index": i, **ln} for i, ln in enumerate(quotes.lines_of(q))], "currency": q["currency"], "vat_mode": q["vat_mode"],
        "vat_rate_bp": q["vat_rate_bp"], "subtotal_minor": q["subtotal_minor"], "vat_minor": q["vat_minor"], "total_minor": q["total_minor"],
        "net_minor": q["total_minor"] - q["vat_minor"], "work_from": q.get("work_from"), "work_to": q.get("work_to"),
        "in_window": in_window(row, q), "valid_until": q.get("valid_until"), "note": q.get("note"), "vendor_ref": q.get("vendor_ref"),
        "submitted_at": q["created_at"],
        "payment": rfq_terms.present_plan(rfq_terms.loads(q.get("payment_plan_json"))),  # CR-RFQ-PAYMENT-SCHEDULE: his own proposal
        "approved": ({"line_indexes": quotes.approved_indexes(q), "subtotal_minor": q.get("approved_subtotal_minor"),
                      "vat_minor": q.get("approved_vat_minor"), "total_minor": q.get("approved_total_minor")} if approved else None),
    }


def present_messages(conn, v: Mapping[str, Any]) -> list[dict[str, Any]]:
    """His own thread. TKRFQ5: a message that came by a WhatsApp reply (an unverified sender - rfq_inbound) is the managers' only; the
    page never shows words a forged event could have put in his mouth."""
    out = []
    for m in store_rfq.messages_of_vendor(conn, v["id"]):
        if str(m.get("source_id") or "").startswith("whatsapp:"):
            continue
        item: dict[str, Any] = {"id": m["id"], "mine": m["direction"] == "in", "text": m["body"], "at": m["created_at"]}
        if m["direction"] == "in":  # RFQQUESTIONS: his question got an answer in this thread (a question handled by phone shows nothing)
            item["answered"] = bool(m.get("answer_id"))
        out.append(item)
    return out


def _form(conn, row: Mapping[str, Any], v: Mapping[str, Any], cur: Mapping[str, Any] | None) -> dict[str, Any]:
    s = cost_settings(conn)
    contact = store_links.contact(conn, v["contact_id"]) or {}
    vendor = store_links.contact(conn, contact.get("vendor_id")) if contact.get("vendor_id") else None
    exempt = bool(contact.get("vat_exempt") or (vendor or {}).get("vat_exempt"))
    rate = contact.get("labor_rate_minor")
    if rate is None and vendor is not None:
        rate = vendor.get("labor_rate_minor")
    rate_currency = contact.get("rate_currency") or (vendor or {}).get("rate_currency")
    currency = (cur or {}).get("currency") or (rate_currency if rate_currency in s.currencies else s.currencies[0])
    kinds = rfq.allowed_kinds(row)
    # CR-RFQ-PAYMENT-SCHEDULE: the optional instalments block of the form (switch on only; `null` = the page shows no such block)
    payment = ({"max_items": rfq_terms.MAX_ITEMS, "days_max": rfq_terms.DAYS_MAX, "horizon_days": rfq_terms.HORIZON_DAYS}
               if rfq_terms.enabled(conn) else None)
    return {"currencies": list(s.currencies), "currency": currency, "allowed_kinds": kinds, "payment": payment,
            "vat": {"exempt": exempt, "rate_bp": s.vat_rate_bp,
                    "default": "none" if exempt else (contact.get("vat_default") or (vendor or {}).get("vat_default") or "excluded")},
            "labor_rate_minor": rate if rate_currency in (None, currency) else None,
            "limits": {"lines": money.MAX_LINES, "description": money.DESC_MAX, "note": quotes.NOTE_MAX, "vendor_ref": quotes.VENDOR_REF_MAX,
                       "message": MESSAGE_MAX, "decline_reason": DECLINE_MAX, "max_total_minor": s.max_claim_total_minor}}


def _writable(row: Mapping[str, Any], v: Mapping[str, Any], state: str, read_only: bool, now: dt.datetime, *, award_live: bool = False) -> bool:
    """Review F2 (2.6.3): agrees with `_open_for_writes` - an award on this vendor that is pending a second approval (or approved) closes
    the form too, so the page never offers a write that the server then refuses."""
    return (not read_only and state in ("open", "declined") and row["state"] in ("sent", "collecting") and not rfq._due_passed(row, now)
            and v["state"] not in ("draft", "removed", "awarded", "not_awarded") and not award_live)


def view(conn, link: Any, *, code_ok: bool, read_only: bool, read_only_until: str | None, now: dt.datetime) -> dict[str, Any]:
    row, v = _fresh(conn, link)
    contact = store_links.contact(conn, v["contact_id"]) or {}
    lang = contact.get("lang") if contact.get("lang") in LANGS else "he"
    doc = settings_doc.read(conn)
    dept = store.department_any(conn, row["department_id"]) or {}
    out: dict[str, Any] = {
        "kind": "rfq", "ref": rfq.ref(row["number"]), "organization": doc["organization_name"], "department": dept.get("name") or "",
        "lang": lang, "dir": "rtl" if lang in RTL else "ltr", "theme": doc["public"].get("theme", "light"),
        "time_zone": get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem",
        "code_required": bool(link.require_code), "code_ok": bool(code_ok), "read_only": bool(read_only), "read_only_until": read_only_until,
    }
    if link.require_code and not code_ok:
        return out  # 15.3: a forwarded link alone discloses nothing beyond "a request exists"
    state = page_state(conn, row, v, now)
    writable = _writable(row, v, state, read_only, now, award_live=rfq._award_live_of_vendor(conn, v["id"]) is not None)
    cur = _shown_quote(conn, v)
    submitted = _submitted(conn, v)
    pending = submitted is not None and any(a["quote_id"] == submitted["id"] and a["state"] == "pending_second"
                                            for a in store_rfq.awards_of(conn, row["id"]))
    terminal = state in ("closed", "cancelled")
    live = rfq.live_quote(conn, v["id"])
    out.update({
        "page_state": state,
        "rfq": {"title": row["title"], "description": row.get("description") or "", "place_text": row.get("place_text") or "",
                # CR-ORG-LOCATIONS: THIS request's location (its snapshot), after the code gate; the map link only when switched on
                "location": _vendor_location(row),
                "due_at": row["due_at"], "work_from": row.get("work_from"), "work_to": row.get("work_to"),
                "allowed_line_kinds": rfq.allowed_kinds(row),
                # RFQATT (contract 19.4): the request's live vendor-visible files - never on a closed / cancelled page
                "attachments": [] if terminal else _attachments(conn, row["id"])},
        "quote": None if (terminal or cur is None) else present_quote(row, cur),
        "declined": ({"at": v.get("declined_at"), "reason": v.get("decline_reason")} if (v["state"] == "declined" and not terminal) else None),
        "messages": [] if terminal else present_messages(conn, v),
        "form": _form(conn, row, v, cur),
        "can": {"quote": writable, "withdraw": writable and submitted is not None and not pending,
                "decline": writable and live is None and v["state"] != "declined",
                "ask": writable and store_rfq.inbound_message_count(conn, v["id"]) < MESSAGES_PER_VENDOR},
        # CR-RFQ-PAYMENT-SCHEDULE (20.4): HIS approved schedule and arrival - only on his own approved award, else absent
        "terms": rfq_terms.vendor_block(conn, row, v, read_only=read_only) if state == "awarded" else None,
    })
    return out


def _attachments(conn, rfq_id: str) -> list[dict[str, Any]]:
    from . import rfq_attach

    return rfq_attach.vendor_list(conn, rfq_id)


def shows_files(conn, link: Any, now: dt.datetime) -> bool:
    """RFQATT: whether the vendor's page lists (and so may fetch) the request's files right now - the same rule as `view`: not on a
    closed / cancelled page."""
    row, v = _fresh(conn, link)
    return page_state(conn, row, v, now) not in ("closed", "cancelled")


def record_open(conn, link: Any, now: dt.datetime) -> None:
    row, v = _fresh(conn, link)
    if row["state"] in rfq.ENDED:  # the read-only grace after close / cancel: reading is not an open of a live request
        return
    at = iso(now)
    first = store_rfq.note_open(conn, link.link_id, v["id"], at)
    if row["state"] == "sent" and not rfq._due_passed(row, now):
        store_rfq.update_rfq(conn, row["id"], {"state": "collecting", "updated_at": at}, bump=False)
    if first:
        store_rfq.insert_event(conn, row["id"], "opened", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"], at=at)


def _name(conn, v: Mapping[str, Any]) -> str:
    c = store_links.contact(conn, v["contact_id"]) or {}
    return "" if c.get("erased_at") else (c.get("display_name") or "")


def _open_for_writes(conn, link: Any, now: dt.datetime) -> tuple[dict[str, Any], dict[str, Any]]:
    """The request and the vendor row as they are now, after the deadline was applied; refusals before any write."""
    row, v = _fresh(conn, link)
    row = rfq.apply_due(conn, row, now)
    v = store_rfq.vendor(conn, v["id"]) or v
    if row["state"] == "due_passed" or (row["state"] in ("sent", "collecting") and rfq._due_passed(row, now)):
        raise VendorRefused(409, "rfq_due_passed")
    # review F2 (2.6.3): a FIXED refusal vocabulary - `ended` (the request no longer takes quotes, whatever the reason: awarded,
    # ordered, closed, cancelled) and `vendor` (this vendor's own row is closed, or a decision on his quote is pending) - never the
    # request's internal state, so a non-awarded vendor never learns from a refusal that anyone was awarded
    if row["state"] not in ("sent", "collecting"):
        raise VendorRefused(409, "quote_closed", reason="ended")
    if v["state"] in ("draft", "removed", "awarded", "not_awarded") or rfq._award_live_of_vendor(conn, v["id"]):
        raise VendorRefused(409, "quote_closed", reason="vendor")
    return row, v


def _valid_until(value: Any, now: dt.datetime) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", "valid_until")
    at = parse(value)
    if at is None:
        raise CostRefused(422, "format", "valid_until")
    if at <= now or at > now + dt.timedelta(days=VALID_HORIZON_DAYS):
        raise CostRefused(422, "range", "valid_until")
    return iso(at)


def submit(conn, link: Any, body: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    row, v = _open_for_writes(conn, link, now)
    # RFQQUESTIONS: the quote form's own "question" field - checked before anything is stored (a refused question stores no quote)
    question = _clean(body.get("question"), "question", MESSAGE_MAX) if body.get("question") is not None else ""
    if question and store_rfq.inbound_message_count(conn, v["id"]) >= MESSAGES_PER_VENDOR:
        raise VendorRefused(409, "message_limit")
    current = _submitted(conn, v)
    base = body.get("base_version")
    if (current["version"] if current else None) != base:
        raise VendorRefused(409, "quote_changed", version=current["version"] if current else None)
    s = cost_settings(conn)
    currency = body.get("currency") or _form(conn, row, v, current)["currency"]
    try:
        if currency not in s.currencies:
            raise CostRefused(422, "unknown", "currency")
        vat_mode = quotes._vat_mode(conn, v["contact_id"], body.get("amounts_include_vat"))
        c = quotes.compute_lines(conn, body.get("lines"), rfq.allowed_kinds(row), vat_mode)
        work_from = quotes._instant(body.get("work_from"), "work_from", now)
        work_to = quotes._instant(body.get("work_to"), "work_to", now)
        if work_from and work_to and work_to < work_from:
            raise CostRefused(422, "order", "work_to")
        valid_until = _valid_until(body.get("valid_until"), now)
        note = quotes._text(body.get("note"), "note", quotes.NOTE_MAX, multiline=True)
        vendor_ref = quotes._text(body.get("vendor_ref"), "vendor_ref", quotes.VENDOR_REF_MAX)
        plan_json = rfq_terms.quote_plan(conn, body, now)  # CR-RFQ-PAYMENT-SCHEDULE: his proposed instalments (switch on only)
    except CostRefused as exc:
        code = "kind_not_allowed" if exc.code == "line_kind_not_allowed" else exc.code
        raise VendorRefused(422, "invalid", fields=[{"field": exc.field or "body", "code": code}]) from None
    at = iso(now)
    by = f"contact:{v['contact_id']}"
    existing = store_rfq.quotes_of_vendor(conn, v["id"])
    previous = None
    for q in existing:
        if q["state"] == "submitted":
            store_quotes.update_quote(conn, q["id"], {"state": "superseded"}, now=at)
            store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "superseded", "by_user": by, "at": at})
            previous = q["id"]
    version = store_rfq.next_version_of_vendor(conn, v["id"])
    qid = store_quotes.insert_quote(conn, {
        "ticket_id": None, "rfq_vendor_id": v["id"], "assignment_id": None, "contact_id": v["contact_id"], "department_id": row["department_id"],
        "version": version, "supersedes_id": previous or (existing[-1]["id"] if existing else None), "source": "vendor", "state": "submitted",
        "currency": currency, "vat_mode": c.vat_mode, "vat_rate_bp": c.vat_rate_bp, "lines_json": [ln.as_json() for ln in c.lines],
        "labor_minor": c.by_kind["labor"], "parts_minor": c.by_kind["parts"], "travel_minor": c.by_kind["travel"], "other_minor": c.by_kind["other"],
        "subtotal_minor": c.subtotal_minor, "vat_minor": c.vat_minor, "total_minor": c.total_minor, "work_from": work_from, "work_to": work_to,
        "valid_until": valid_until, "note": note, "vendor_ref": vendor_ref, "created_by_kind": "contact", "created_by": v["contact_id"],
        "created_at": at, "updated_at": at, **({"payment_plan_json": plan_json} if plan_json else {})})
    store_rfq.update_vendor(conn, v["id"], {"state": "quoted", "quoted_at": at, "updated_at": at})
    fields: dict[str, Any] = {"updated_at": at}
    if row["state"] == "sent":
        fields["state"] = "collecting"
    store_rfq.update_rfq(conn, row["id"], fields)  # the managers' copies go stale: a new quote arrived
    store_rfq.insert_event(conn, row["id"], "quote_submitted", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"],
                           data={"quote_id": qid, "version": version, "on_behalf": False, "late": False}, at=at)
    _audit(conn, link, "ticket.rfq.vendor_quote", row, vendor_id=v["id"], quote_id=qid, version=version)  # review F3: ids only, no amount
    rfq_notify.quote(conn, row, v["id"], "updated" if previous else "new")
    if question:
        _store_question(conn, link, row, v, question, at, quote_id=qid)
    return present_quote(row, store_quotes.quote(conn, qid) or {})


def withdraw(conn, link: Any, quote_id: str, now: dt.datetime) -> None:
    row, v = _open_for_writes(conn, link, now)
    q = store_quotes.quote(conn, quote_id) if isinstance(quote_id, str) else None
    if q is None or q.get("rfq_vendor_id") != v["id"] or q["state"] != "submitted":
        raise VendorRefused(409, "quote_closed", reason="vendor")  # another vendor's / an unknown quote reads exactly like a closed one
    if any(a["quote_id"] == q["id"] and a["state"] == "pending_second" for a in store_rfq.awards_of(conn, row["id"])):
        raise VendorRefused(409, "quote_closed", reason="vendor")  # review F2: defensive (`_open_for_writes` refuses first), same vocabulary
    at = iso(now)
    store_quotes.update_quote(conn, q["id"], {"state": "withdrawn"}, now=at)
    store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "withdrawn", "by_user": f"contact:{v['contact_id']}", "at": at})
    if v["state"] == "quoted" and rfq.live_quote(conn, v["id"]) is None:
        store_rfq.update_vendor(conn, v["id"], {"state": "withdrawn", "updated_at": at})
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at})
    store_rfq.insert_event(conn, row["id"], "quote_withdrawn", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"],
                           data={"quote_id": q["id"], "version": q["version"], "on_behalf": False}, at=at)
    _audit(conn, link, "ticket.rfq.vendor_withdraw", row, vendor_id=v["id"], quote_id=q["id"], version=q["version"])
    rfq_notify.quote(conn, row, v["id"], "withdrawn")


def _clean(value: Any, field_name: str, max_len: int, *, required: bool = False) -> str:
    from .text_hygiene import clean_text

    t = clean_text(value if isinstance(value, str) else "", multiline=True)
    if len(t) > max_len:
        raise VendorRefused(422, "invalid", fields=[{"field": field_name, "code": "too_long"}])
    if required and not t:
        raise VendorRefused(422, "invalid", fields=[{"field": field_name, "code": "required"}])
    return t


def decline(conn, link: Any, reason: Any, now: dt.datetime) -> None:
    row, v = _open_for_writes(conn, link, now)
    if rfq.live_quote(conn, v["id"]) is not None:
        raise VendorRefused(409, "quote_exists")
    why = _clean(reason, "reason", DECLINE_MAX) or None
    at = iso(now)
    store_rfq.update_vendor(conn, v["id"], {"state": "declined", "declined_at": at, "decline_reason": why, "updated_at": at})
    fields: dict[str, Any] = {"updated_at": at}
    if row["state"] == "sent":
        fields["state"] = "collecting"
    store_rfq.update_rfq(conn, row["id"], fields)
    store_rfq.insert_event(conn, row["id"], "declined", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"],
                           data={"on_behalf": False}, at=at)
    _audit(conn, link, "ticket.rfq.vendor_decline", row, vendor_id=v["id"])
    rfq_notify.declined(conn, row, v["id"])


def ask(conn, link: Any, text: Any, now: dt.datetime) -> dict[str, Any]:
    row, v = _open_for_writes(conn, link, now)
    if store_rfq.inbound_message_count(conn, v["id"]) >= MESSAGES_PER_VENDOR:
        raise VendorRefused(409, "message_limit")
    body = _clean(text, "text", MESSAGE_MAX, required=True)
    at = iso(now)
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at})
    mid = _store_question(conn, link, row, v, body, at)
    return {"id": mid, "mine": True, "text": body, "at": at, "answered": False}


def _store_question(conn, link: Any, row: Mapping[str, Any], v: Mapping[str, Any], body: str, at: str, *, quote_id: str | None = None) -> str:
    """His question in his thread (pending, unread - RFQQUESTIONS), its timeline / audit rows (ids only) and the managers' notification."""
    mid = store_rfq.insert_message(conn, {"rfq_id": row["id"], "rfq_vendor_id": v["id"], "direction": "in", "body": body, "author_kind": "contact",
                                          "author_id": v["contact_id"], "source_kind": "clarify", "source_id": None, "created_at": at,
                                          "quote_id": quote_id})
    data: dict[str, Any] = {"message_id": mid}
    if quote_id:
        data["quote_id"] = quote_id
    store_rfq.insert_event(conn, row["id"], "vendor_message", actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"], data=data, at=at)
    _audit(conn, link, "ticket.rfq.vendor_message", row, vendor_id=v["id"], message_id=mid, **({"quote_id": quote_id} if quote_id else {}))
    rfq_notify.question(conn, row, v["id"], mid)
    return mid
