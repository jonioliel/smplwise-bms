"""TKDETAILBE (docs/tickets/DETAIL_BACKEND_CONTRACT.md sections 3-5, 7; owner decisions 15.10): quotes BEFORE the work, the allowed
cost line kinds, the cost baseline and the validation of a payment demand (the 0083 claim) against it, the cost-flow stage and the
decision message drafts.

    allowed kinds   request (`tickets.allowed_line_kinds`) -> department -> installation (`costs.allowed_line_kinds`, default labor +
                    parts); `labor` is always allowed; a quote may carry allowed kinds only
    lifecycle       submitted -> approved | partially_approved | fix_requested | rejected; submitted / fix_requested -> superseded by a
                    new version; approved / partially_approved are final for the assignment (a new version is refused)
    baseline        the latest approved / partially approved quote of an assignment IS its cost baseline (owner: "the selected quote
                    becomes the approved cost baseline automatically"); a partial approval's baseline is its approved lines only
    demand check    a demand line whose kind is outside the baseline's approved kinds (no baseline: outside the request's allowed
                    kinds) is EXCEPTIONAL - it needs a description and is flagged for review; it is never refused
    drafts          a decision never sends a message: it returns an editable draft in the vendor's language (no amount in it)

Money is money.py's (integers in minor units, the server computes every figure). Amounts, lines and notes are for
tickets.costs.view holders only; timeline rows and audit rows carry ids, versions and states only."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any, Mapping, Sequence

from ...db import get_setting
from . import model, money, settings_doc, store, store_costs, store_links, store_quotes
from .costs import CostRefused, cost_settings, iso, now_utc, parse
from .text_hygiene import clean_text

STATES = ("submitted", "fix_requested", "approved", "partially_approved", "rejected", "superseded", "withdrawn", "not_awarded")
APPROVED = frozenset({"approved", "partially_approved"})
PENDING = frozenset({"submitted", "fix_requested"})
QUOTE_MODES = ("required", "optional", "off")
NOTE_MAX = 1000
VENDOR_REF_MAX = 40
REASON_MAX = 500
WORK_HORIZON_DAYS = 366
LANGS = ("he", "en", "ar", "ru")


# ---------------------------------------------------------------- allowed line kinds (section 3)

def _kinds_json(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    try:
        return settings_doc.line_kinds(json.loads(raw))
    except (ValueError, TypeError):
        return None  # a corrupt value reads as "not set" (fail safe to the next level)


kinds_json = _kinds_json


def effective_kinds(conn, ticket: Mapping[str, Any]) -> tuple[list[str], str]:
    """(the kinds, the level they came from: request | department | installation)."""
    mine = _kinds_json(ticket.get("allowed_line_kinds"))
    if mine is not None:
        return mine, "request"
    dept = _kinds_json(store_quotes.department_kinds(conn, ticket.get("department_id")))
    if dept is not None:
        return dept, "department"
    return list(settings_doc.read(conn)["costs"]["allowed_line_kinds"]), "installation"


def parse_kinds(value: Any, field: str = "kinds") -> list[str] | None:
    if value is None:
        return None
    try:
        return settings_doc.line_kinds(value)
    except ValueError as exc:
        raise CostRefused(422, str(exc) if str(exc) == "labor_required" else "invalid", field) from None


# ---------------------------------------------------------------- assignments, modes, the baseline

def quote_capable(conn, asg: Mapping[str, Any] | None) -> bool:
    """TKSTAFF1 (security review F1, 2.5.8 review F4): only an assignment of kind `contact` is external - a staff member's own (user)
    assignment also names their directory row in `contact_id` and is never external - and a staff contact without an account
    (the 0084 employee row) is internal staff: neither ever gets a quote card or a quote."""
    if not asg or asg.get("assignee_kind") != "contact" or not asg.get("contact_id"):
        return False
    from .assignees import is_staff

    return not is_staff(store_links.contact(conn, asg["contact_id"]))


def active_external(conn, ticket: Mapping[str, Any]) -> dict[str, Any] | None:
    asg = store.assignment(conn, ticket.get("current_assignment_id"))
    if asg is None or asg.get("ended_at") or asg.get("assignee_kind") != "contact":
        return None
    return asg


def latest_external(conn, ticket_id: str) -> dict[str, Any] | None:
    asgs = [a for a in store.assignments(conn, ticket_id) if a["assignee_kind"] == "contact"]
    return asgs[-1] if asgs else None


def quote_mode(assignment: Mapping[str, Any] | None) -> str:
    v = (assignment or {}).get("quote_mode")
    return v if v in QUOTE_MODES else "optional"


def baseline(conn, assignment_id: str | None) -> dict[str, Any] | None:
    approved = [q for q in store_quotes.quotes_of_assignment(conn, assignment_id) if q["state"] in APPROVED]
    return approved[-1] if approved else None


def lines_of(q: Mapping[str, Any]) -> list[dict[str, Any]]:
    try:
        v = json.loads(q.get("lines_json") or "[]")
    except ValueError:
        return []
    return v if isinstance(v, list) else []


def approved_indexes(q: Mapping[str, Any]) -> list[int]:
    try:
        v = json.loads(q.get("approved_lines_json") or "[]")
    except ValueError:
        return []
    return [int(i) for i in v if isinstance(i, int)] if isinstance(v, list) else []


def approved_lines(q: Mapping[str, Any]) -> list[dict[str, Any]]:
    idx = set(approved_indexes(q))
    return [ln for i, ln in enumerate(lines_of(q)) if i in idx]


def kind_sums(lines: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    out = {k: 0 for k in money.LINE_KINDS}
    for ln in lines:
        if ln.get("kind") in out:
            out[ln["kind"]] += int(ln.get("total_minor") or 0)
    return out


def baseline_info(q: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if q is None:
        return None
    kinds = [k for k in money.LINE_KINDS if any(ln.get("kind") == k for ln in approved_lines(q))]
    return {"quote_id": q["id"], "version": q["version"], "state": q["state"], "total_minor": q.get("approved_total_minor"),
            "subtotal_minor": q.get("approved_subtotal_minor"), "currency": q["currency"], "line_kinds": kinds}


# ---------------------------------------------------------------- the payment demand against the baseline (section 5)

def analyse_demand(conn, claim: Mapping[str, Any], lines: Sequence[money.Line]) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """(the exceptional lines, the baseline quote) of a demand's lines. Against a baseline an exceptional line needs a description
    (422 `exceptional_description_required`); without a baseline the line is flagged only (a demand of release 2.5 with a travel
    line and no description stays valid)."""
    base = baseline(conn, claim.get("assignment_id"))
    if base is not None:
        allowed = {ln.get("kind") for ln in approved_lines(base)}
        reason = "not_in_quote"
    else:
        ticket = store_costs.ticket_row(conn, claim.get("ticket_id")) or {"department_id": claim.get("department_id")}
        allowed = set(effective_kinds(conn, ticket)[0])
        reason = "kind_not_allowed"
    out: list[dict[str, Any]] = []
    for i, ln in enumerate(lines):
        if ln.kind in allowed:
            continue
        if not ln.description and base is not None:
            raise CostRefused(422, "exceptional_description_required", f"lines.{i}.description")
        out.append({"index": i, "kind": ln.kind, "description": ln.description, "total_minor": ln.total_minor, "reason": reason})
    return out, base


def exceptional_of(rev: Mapping[str, Any]) -> list[dict[str, Any]]:
    try:
        v = json.loads(rev.get("exceptional_json") or "[]")
    except ValueError:
        return []
    return v if isinstance(v, list) else []


def review_state(claim: Mapping[str, Any], rev: Mapping[str, Any], approved_rev: Mapping[str, Any] | None) -> str:
    if claim.get("approved_revision_id") == rev["id"]:
        return "accepted"
    if approved_rev is not None and approved_rev.get("based_on") == rev["id"]:
        return "excluded" if not exceptional_of(approved_rev) else "accepted"
    if claim.get("current_revision_id") == rev["id"] and claim["status"] == "submitted":
        return "pending"
    return "superseded"


def demand_view(conn, claim: Mapping[str, Any], revs: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """The baseline block of a claim answer (full view): the baseline, the delta and per-kind deltas, `needs_review`."""
    base = store_quotes.quote(conn, claim.get("quote_id")) or baseline(conn, claim.get("assignment_id"))
    current = next((r for r in revs if r["id"] == (claim.get("approved_revision_id") or claim.get("current_revision_id"))), None)
    out: dict[str, Any] = {"baseline": baseline_info(base), "delta_minor": None, "kind_deltas": None,
                           "needs_review": bool(claim["status"] == "submitted" and current is not None and exceptional_of(current))}
    if base is not None and current is not None and current["currency"] == base["currency"] and base.get("approved_total_minor") is not None:
        out["delta_minor"] = int(current["total_minor"]) - int(base["approved_total_minor"])
        base_sums = kind_sums(approved_lines(base))
        cur = {"labor": current["labor_minor"], "parts": current["parts_minor"], "travel": current["travel_minor"], "other": current["other_minor"]}
        out["kind_deltas"] = {k: int(cur[k]) - base_sums[k] for k in money.LINE_KINDS}
    return out


# ---------------------------------------------------------------- building a quote (vendor through the link / manager on behalf)

def _text(value: Any, field: str, max_len: int, *, multiline: bool = False) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", field)
    t = clean_text(value, multiline=multiline)
    if len(t) > max_len:
        raise CostRefused(422, "too_long", field)
    return t or None


def _instant(value: Any, field: str, now: dt.datetime) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", field)
    at = parse(value)
    if at is None:
        raise CostRefused(422, "format", field)
    if at < now - dt.timedelta(days=1) or at > now + dt.timedelta(days=WORK_HORIZON_DAYS):
        raise CostRefused(422, "range", field)
    return iso(at)


def _vat_mode(conn, contact_id: str, include: Any) -> str:
    contact = store_links.contact(conn, contact_id) or {}
    vendor = store_links.contact(conn, contact["vendor_id"]) if contact.get("vendor_id") else None
    if include is not None and not isinstance(include, bool):
        raise CostRefused(422, "type", "amounts_include_vat")
    if include is None:
        include = (contact.get("vat_default") or (vendor or {}).get("vat_default")) == "included"
    exempt = bool(contact.get("vat_exempt") or (vendor or {}).get("vat_exempt"))
    return money.vat_mode_for(vat_exempt=exempt, amounts_include_vat=include, no_charge=False)


def compute_lines(conn, raw_lines: Any, allowed: Sequence[str], vat_mode: str) -> money.Computed:
    s = cost_settings(conn)
    try:
        lines = money.parse_lines(raw_lines if raw_lines is not None else [])
    except money.MoneyError as exc:
        raise CostRefused(422, exc.code, exc.field) from None
    if not lines:
        raise CostRefused(422, "required", "lines")
    for i, ln in enumerate(lines):
        if ln.kind not in allowed:
            raise CostRefused(422, "line_kind_not_allowed", f"lines.{i}.kind")
    try:
        return money.compute(lines, vat_mode, s.vat_rate_bp, max_total_minor=s.max_claim_total_minor)
    except money.MoneyError as exc:
        raise CostRefused(422, exc.code, exc.field) from None


def submit(conn, ticket: Mapping[str, Any], assignment: Mapping[str, Any] | None, body: Mapping[str, Any], *, by_kind: str, by_id: str,
           at: dt.datetime, actor_name: str = "") -> dict[str, Any]:
    """A quote from the vendor's handler link (`by_kind = 'contact'`) or entered on the vendor's behalf (`by_kind = 'user'`). The
    assignment must be the ticket's ACTIVE external one and the ticket in handling (409 `quote_not_open`)."""
    if assignment is None or assignment.get("ended_at") or assignment.get("assignee_kind") != "contact" \
            or ticket.get("current_assignment_id") != assignment["id"] or ticket.get("status") not in model.HANDLING:
        raise CostRefused(409, "quote_not_open")
    if not quote_capable(conn, assignment):  # TKSTAFF1: never for an internal (staff) assignment
        raise CostRefused(409, "quote_not_open")
    if quote_mode(assignment) == "off":
        raise CostRefused(409, "quote_off")
    from .costs import assignment_mode

    if assignment_mode(conn, ticket, assignment) == "off":  # TK257: no costs at all on this assignment -> no quote either
        raise CostRefused(409, "quote_off")
    existing = store_quotes.quotes_of_assignment(conn, assignment["id"])
    if any(q["state"] in APPROVED for q in existing):
        raise CostRefused(409, "quote_already_approved")
    s = cost_settings(conn)
    currency = body.get("currency") or s.currencies[0]
    if currency not in s.currencies:
        raise CostRefused(422, "unknown", "currency")
    vat_mode = _vat_mode(conn, assignment["contact_id"], body.get("amounts_include_vat"))
    allowed, _level = effective_kinds(conn, ticket)
    c = compute_lines(conn, body.get("lines"), allowed, vat_mode)
    work_from = _instant(body.get("work_from"), "work_from", at)
    work_to = _instant(body.get("work_to"), "work_to", at)
    if work_from and work_to and work_to < work_from:
        raise CostRefused(422, "order", "work_to")
    now = iso(at)
    by = by_id if by_kind == "user" else f"contact:{by_id}"
    previous = None
    for q in existing:
        if q["state"] in PENDING:
            store_quotes.update_quote(conn, q["id"], {"state": "superseded"}, now=now)
            store_quotes.insert_decision(conn, {"quote_id": q["id"], "action": "superseded", "by_user": by, "at": now})
            previous = q["id"]
    version = store_quotes.next_version(conn, assignment["id"])
    qid = store_quotes.insert_quote(conn, {
        "ticket_id": ticket["id"], "assignment_id": assignment["id"], "contact_id": assignment["contact_id"],
        "department_id": ticket.get("department_id"), "version": version, "supersedes_id": previous or (existing[-1]["id"] if existing else None),
        "source": "vendor" if by_kind == "contact" else "manager", "state": "submitted", "currency": currency, "vat_mode": c.vat_mode,
        "vat_rate_bp": c.vat_rate_bp, "lines_json": [ln.as_json() for ln in c.lines], "labor_minor": c.by_kind["labor"],
        "parts_minor": c.by_kind["parts"], "travel_minor": c.by_kind["travel"], "other_minor": c.by_kind["other"],
        "subtotal_minor": c.subtotal_minor, "vat_minor": c.vat_minor, "total_minor": c.total_minor, "work_from": work_from, "work_to": work_to,
        "note": _text(body.get("note") if body.get("note") is not None else body.get("notes"), "note", NOTE_MAX, multiline=True), "vendor_ref": _text(body.get("vendor_ref"), "vendor_ref", VENDOR_REF_MAX),
        "created_by_kind": by_kind, "created_by": by_id, "created_at": now, "updated_at": now,
    })
    data = {"quote_id": qid, "version": version, "on_behalf": by_kind == "user"}
    if by_kind == "contact":
        store_links.insert_contact_event(conn, ticket["id"], "quote_submitted", contact_id=by_id, actor_name=actor_name,
                                         assignment_id=assignment["id"], at=now, data=data, visible_external=True)
        store.update_ticket(conn, ticket["id"], {"last_activity_at": now, "last_external_activity_at": now}, bump=False)
    else:
        store.insert_event(conn, ticket["id"], "quote_submitted", actor_kind="user", actor_user_id=by_id, actor_name=actor_name,
                           assignment_id=assignment["id"], data=data, at=now)
        store.update_ticket(conn, ticket["id"], {"last_activity_at": now}, bump=False)
    return store_quotes.quote(conn, qid) or {}


# ---------------------------------------------------------------- decisions (never a message)

def _reason(value: Any) -> str:
    t = _text(value, "reason", REASON_MAX, multiline=True)
    if not t:
        raise CostRefused(422, "required", "reason")
    return t


def decide(conn, q: Mapping[str, Any], action: str, *, by: str, revision: int, at: dt.datetime, line_indexes: Sequence[int] | None = None,
           reason: Any = None, actor_name: str = "") -> dict[str, Any]:
    """approve (all lines or a subset -> partially_approved) / request_fix / reject. The caller holds tickets.costs + view."""
    if int(q["revision"]) != int(revision):
        raise CostRefused(409, "quote_stale", revision=q["revision"])
    now = iso(at)
    fields: dict[str, Any]
    if action == "approve":
        if q["state"] != "submitted":
            raise CostRefused(409, "quote_not_submitted")
        if q["created_by_kind"] == "user" and q["created_by"] == by:
            raise CostRefused(409, "self_approval")
        lines = lines_of(q)
        if line_indexes is None:
            idx = list(range(len(lines)))
        else:
            if not line_indexes or len(set(line_indexes)) != len(line_indexes) or any(
                    isinstance(i, bool) or not isinstance(i, int) or not 0 <= i < len(lines) for i in line_indexes):
                raise CostRefused(422, "invalid", "line_indexes")
            idx = sorted(line_indexes)
        chosen = [money.line_from_json(lines[i]) for i in idx]
        c = money.compute(chosen, q["vat_mode"], int(q["vat_rate_bp"]))
        state = "approved" if len(idx) == len(lines) else "partially_approved"
        fields = {"state": state, "approved_lines_json": store_quotes.dumps(idx), "approved_subtotal_minor": c.subtotal_minor,
                  "approved_vat_minor": c.vat_minor, "approved_total_minor": c.total_minor, "decided_by": by, "decided_at": now,
                  "decision_reason": None}
        decision = {"action": "approve" if state == "approved" else "partial_approve", "lines_json": store_quotes.dumps(idx),
                    "amount_minor": c.total_minor}
    elif action in ("request_fix", "reject"):
        allowed_from = {"submitted"} if action == "request_fix" else PENDING
        if q["state"] not in allowed_from:
            raise CostRefused(409, "quote_not_submitted")
        why = _reason(reason)
        fields = {"state": "fix_requested" if action == "request_fix" else "rejected", "decided_by": by, "decided_at": now, "decision_reason": why}
        decision = {"action": action, "reason": why}
    else:
        raise CostRefused(422, "unknown", "action")
    if not store_quotes.update_quote(conn, q["id"], fields, now=now, expect_revision=int(revision)):
        raise CostRefused(409, "quote_stale", revision=q["revision"])
    store_quotes.insert_decision(conn, {"quote_id": q["id"], "by_user": by, "at": now, **decision})
    if q.get("ticket_id"):
        store.insert_event(conn, q["ticket_id"], "quote_decided", actor_kind="user", actor_user_id=by, actor_name=actor_name,
                           assignment_id=q.get("assignment_id"), data={"quote_id": q["id"], "version": q["version"], "action": decision["action"]},
                           at=now)
        store.update_ticket(conn, q["ticket_id"], {"last_activity_at": now}, bump=False)
    return store_quotes.quote(conn, q["id"]) or dict(q)


def set_mode(conn, ticket: Mapping[str, Any], assignment: Mapping[str, Any], mode: Any) -> None:
    if mode not in QUOTE_MODES:
        raise CostRefused(422, "invalid", "mode")
    if assignment.get("assignee_kind") != "contact":
        raise CostRefused(409, "not_external")
    store.update_assignment(conn, assignment["id"], {"quote_mode": mode})


# ---------------------------------------------------------------- the cost flow (section 4.3)

def flow(conn, ticket: Mapping[str, Any]) -> dict[str, Any]:
    status = ticket.get("status")
    sub = "waiting_part" if status == "waiting_part" else None
    asg = active_external(conn, ticket) or latest_external(conn, ticket["id"])
    if asg is None:
        return {"stage": "none", "sub_state": sub, "assignment_id": None, "quote_mode": None}
    mode = quote_mode(asg)
    out = {"stage": "none", "sub_state": sub, "assignment_id": asg["id"], "quote_mode": mode}
    claim = store_costs.claim_for_assignment(conn, asg["id"])
    if claim is not None and claim["status"] != "awaiting":
        out["stage"] = {"submitted": "demand_submitted", "rejected": "demand_rejected", "approved": "demand_approved", "paid": "paid"}[claim["status"]]
        return out
    if claim is not None and claim["status"] == "awaiting" and status in ("done", "closed", "returned"):
        out["stage"] = "demand_awaiting"
        return out
    quotes = store_quotes.quotes_of_assignment(conn, asg["id"])
    live = [q for q in quotes if q["state"] not in ("superseded", "withdrawn", "not_awarded")]
    last = live[-1] if live else None
    if any(q["state"] in APPROVED for q in quotes):
        out["stage"] = "work" if status in ("in_progress", "waiting_part") else "quote_approved"
    elif last is not None and last["state"] == "submitted":
        out["stage"] = "quote_submitted"
    elif last is not None and last["state"] == "fix_requested":
        out["stage"] = "quote_fix_requested"
    elif last is not None and last["state"] == "rejected":
        out["stage"] = "quote_rejected"
    elif mode == "off":
        out["stage"] = "work" if status in ("in_progress", "waiting_part") else "none"
    else:
        out["stage"] = "quote_requested" if mode == "required" else "quote_optional"
    return out


# ---------------------------------------------------------------- presentation

def _lines_view(q: Mapping[str, Any]) -> list[dict[str, Any]]:
    idx = set(approved_indexes(q)) if q["state"] in APPROVED else None
    out = []
    for i, ln in enumerate(lines_of(q)):
        item = {"index": i, **ln}
        if idx is not None:
            item["approved"] = i in idx
        out.append(item)
    return out


def present_quote(conn, q: Mapping[str, Any], *, full: bool, can_decide: bool = False, for_vendor: bool = False) -> dict[str, Any]:
    base: dict[str, Any] = {"id": q["id"], "version": q["version"], "state": q["state"], "source": q["source"], "created_at": q["created_at"],
                            "assignment_id": q.get("assignment_id")}
    if not full:
        return base
    base.update({
        "currency": q["currency"], "vat_mode": q["vat_mode"], "vat_rate_bp": q["vat_rate_bp"], "lines": _lines_view(q),
        "labor_minor": q["labor_minor"], "parts_minor": q["parts_minor"], "travel_minor": q["travel_minor"], "other_minor": q["other_minor"],
        "subtotal_minor": q["subtotal_minor"], "vat_minor": q["vat_minor"], "total_minor": q["total_minor"],
        "net_minor": q["total_minor"] - q["vat_minor"], "work_from": q.get("work_from"), "work_to": q.get("work_to"),
        "note": q.get("note"), "vendor_ref": q.get("vendor_ref"),
        "approved": ({"line_indexes": approved_indexes(q), "subtotal_minor": q.get("approved_subtotal_minor"), "vat_minor": q.get("approved_vat_minor"),
                      "total_minor": q.get("approved_total_minor")} if q["state"] in APPROVED else None),
    })
    if for_vendor:
        base["reason"] = q.get("decision_reason") if q["state"] in ("fix_requested", "rejected") else None
        return base
    snap_vendor = ""
    contact = store_links.contact(conn, q["contact_id"]) or {}
    vendor = store_links.contact(conn, contact.get("vendor_id")) if contact.get("vendor_id") else None
    snap_vendor = (vendor or {}).get("display_name") or contact.get("display_name") or ""
    base.update({
        "vendor": snap_vendor, "revision": q["revision"],
        "created_by_name": store.display_name(conn, q["created_by"]) if q["created_by_kind"] == "user" else "",
        "decision": ({"by": store.display_name(conn, q["decided_by"]) if q.get("decided_by") and not str(q["decided_by"]).startswith("contact:") else "",
                      "at": q.get("decided_at"), "reason": q.get("decision_reason")} if q.get("decided_at") else None),
        "can": {"decide": bool(can_decide and q["state"] == "submitted"),
                "reject": bool(can_decide and q["state"] in PENDING)},
    })
    return base


def answer(conn, ticket: Mapping[str, Any], *, full: bool, can_decide: bool) -> dict[str, Any]:
    """GET /tickets/{id}/quotes (and the `quotes` block of GET /tickets/{id}/costs)."""
    kinds, level = effective_kinds(conn, ticket)
    asg = active_external(conn, ticket) or latest_external(conn, ticket["id"])
    out: dict[str, Any] = {
        "flow": flow(conn, ticket),
        "allowed_line_kinds": {"kinds": kinds, "level": level},
        "quote_mode": quote_mode(asg) if asg else None,
        "quotes": [present_quote(conn, q, full=full, can_decide=can_decide) for q in store_quotes.quotes_of_ticket(conn, ticket["id"])],
    }
    if full:
        out["baseline"] = baseline_info(baseline(conn, asg["id"])) if asg else None
    return out


# ---------------------------------------------------------------- the handler page (section 4.5)

# The handler page speaks the 2.5.7 (TK257) vocabulary, which the built vendor card (frontend public-ticket/claim/quote-card.ts) reads:
# `state` none | submitted | approved | rejected ("needs a correction" - the vendor may send a new quote). The exact state of this design
# travels beside it as `state_detail` (fix_requested / rejected / partially_approved ...).
PUBLIC_STATE = {"submitted": "submitted", "fix_requested": "rejected", "rejected": "rejected", "approved": "approved",
                "partially_approved": "approved", "superseded": "superseded", "withdrawn": "superseded", "not_awarded": "superseded"}
HIDDEN_FROM_VENDOR = frozenset({"not_awarded"})


def current(quotes: Sequence[Mapping[str, Any]]) -> dict[str, Any] | None:
    """The quote that counts on the page: the approved one, else the newest one that is still live."""
    approved = [q for q in quotes if q["state"] in APPROVED]
    if approved:
        return dict(approved[-1])
    live = [q for q in quotes if q["state"] not in ("superseded", "withdrawn", "not_awarded")]
    return dict(live[-1]) if live else None


def present_public(q: Mapping[str, Any]) -> dict[str, Any]:
    """One quote as its vendor sees it - the TK257 shape (`seq`, `notes`, `reason` of a correction) plus this design's fields."""
    state = PUBLIC_STATE[q["state"]]
    out: dict[str, Any] = {
        "id": q["id"], "seq": q["version"], "version": q["version"], "state": state, "state_detail": q["state"], "lines": _lines_view(q),
        "labor_minor": q["labor_minor"], "parts_minor": q["parts_minor"], "travel_minor": q["travel_minor"], "other_minor": q["other_minor"],
        "subtotal_minor": q["subtotal_minor"], "vat_mode": q["vat_mode"], "vat_rate_bp": q["vat_rate_bp"], "vat_minor": q["vat_minor"],
        "total_minor": q["total_minor"], "net_minor": q["total_minor"] - q["vat_minor"], "currency": q["currency"],
        "notes": q.get("note"), "work_from": q.get("work_from"), "work_to": q.get("work_to"), "created_at": q["created_at"],
        "approved": ({"line_indexes": approved_indexes(q), "partial": q["state"] == "partially_approved",
                      "subtotal_minor": q.get("approved_subtotal_minor"), "vat_minor": q.get("approved_vat_minor"),
                      "total_minor": q.get("approved_total_minor")} if q["state"] in APPROVED else None),
    }
    if state == "rejected":
        out["reason"] = q.get("decision_reason")
    return out


def _enabled(conn, ticket: Mapping[str, Any], asg: Mapping[str, Any]) -> bool:
    """TK257: the card is hidden when the assignment asks for no costs at all (cost mode `off`) - and when no quote is wanted."""
    if quote_mode(asg) == "off":
        return False
    if not ticket or not quote_capable(conn, asg):  # TKSTAFF1: a user / staff assignment never shows the card
        return False
    from .costs import assignment_mode

    return assignment_mode(conn, ticket, asg) != "off"


def _writable(ticket: Mapping[str, Any], asg: Mapping[str, Any], quotes: Sequence[Mapping[str, Any]]) -> bool:
    return (quote_mode(asg) != "off" and not asg.get("ended_at") and ticket.get("current_assignment_id") == asg["id"]
            and ticket.get("status") in model.HANDLING and not any(q["state"] in APPROVED for q in quotes))


def public_summary(conn, assignment_id: str) -> dict[str, Any] | None:
    """The `quote` block of GET /t/api/ticket (the card itself reads GET /t/api/quote)."""
    asg = store.assignment(conn, assignment_id)
    if asg is None or not quote_capable(conn, asg):
        return None
    ticket = store_costs.ticket_row(conn, asg["ticket_id"]) or {}
    quotes = store_quotes.quotes_of_assignment(conn, assignment_id)
    cur = current(quotes)
    enabled = _enabled(conn, ticket, asg)
    if not enabled and cur is None:
        return None
    return {"mode": quote_mode(asg), "enabled": enabled, "state": PUBLIC_STATE[cur["state"]] if cur else "none",
            "state_detail": cur["state"] if cur else None, "version": cur["version"] if cur else None,
            "writable": enabled and _writable(ticket, asg, quotes)}


def public_quotes(conn, assignment_id: str) -> dict[str, Any]:
    """GET /t/api/quote - the 2.5.7 (TK257) answer, extended: `state`, `enabled`, `writable`, `allowed_kinds`, `currency`, `quote` (the
    one that counts) and `form`, plus `state_detail`, `mode` and `quotes` (every version). The link's OWN quotes only; never internal
    notes, other vendors' quotes or who decided."""
    asg = store.assignment(conn, assignment_id) or {}
    ticket = store_costs.ticket_row(conn, asg.get("ticket_id")) or {}
    quotes = store_quotes.quotes_of_assignment(conn, assignment_id)
    cur = current(quotes)
    s = cost_settings(conn)
    external = quote_capable(conn, asg)  # TKSTAFF1: no vendor rates / VAT data for a user or staff assignment
    contact = (store_links.contact(conn, asg.get("contact_id")) or {}) if external else {}
    vendor = store_links.contact(conn, contact.get("vendor_id")) if contact.get("vendor_id") else None
    exempt = bool(contact.get("vat_exempt") or (vendor or {}).get("vat_exempt"))
    rate = contact.get("labor_rate_minor")
    if rate is None and vendor is not None:
        rate = vendor.get("labor_rate_minor")
    rate_currency = contact.get("rate_currency") or (vendor or {}).get("rate_currency")
    currency = (cur or {}).get("currency") or (rate_currency if rate_currency in s.currencies else s.currencies[0])
    kinds = effective_kinds(conn, ticket)[0] if ticket else ["labor", "parts"]
    enabled = _enabled(conn, ticket, asg)
    return {
        "state": PUBLIC_STATE[cur["state"]] if cur else "none", "state_detail": cur["state"] if cur else None,
        "enabled": enabled or cur is not None, "writable": bool(ticket) and enabled and _writable(ticket, asg, quotes),
        "allowed_kinds": kinds, "currency": currency, "mode": quote_mode(asg),
        "quote": present_public(cur) if cur else None,
        "quotes": [present_public(q) for q in quotes if q["state"] not in HIDDEN_FROM_VENDOR],
        "form": {"currencies": list(s.currencies), "allowed_kinds": kinds,
                 "vat": {"exempt": exempt, "rate_bp": s.vat_rate_bp,
                         "default": "none" if exempt else (contact.get("vat_default") or (vendor or {}).get("vat_default") or "excluded")},
                 "labor_rate_minor": rate if rate_currency in (None, currency) else None,
                 "limits": {"lines": money.MAX_LINES, "description": money.DESC_MAX, "notes": NOTE_MAX, "note": NOTE_MAX,
                            "vendor_ref": VENDOR_REF_MAX, "max_total_minor": s.max_claim_total_minor}},
    }


# ---------------------------------------------------------------- decision message drafts (section 7)

KIND_NAMES = {
    "he": {"labor": "עבודה", "parts": "חלקים", "travel": "נסיעה", "other": "אחר"},
    "en": {"labor": "labour", "parts": "parts", "travel": "travel", "other": "other"},
    "ar": {"labor": "العمل", "parts": "القطع", "travel": "السفر", "other": "أخرى"},
    "ru": {"labor": "работа", "parts": "запчасти", "travel": "выезд", "other": "другое"},
}
DRAFTS = {
    "he": {
        "quote_approved": 'שלום {name}, ההצעה שלכם עבור "{title}" אושרה{window}. אפשר להתחיל בעבודה.',
        "quote_partially_approved": 'שלום {name}, ההצעה שלכם עבור "{title}" אושרה חלקית: {kinds}{window}. אפשר להתחיל בעבודה על הסעיפים שאושרו.',
        "quote_fix_requested": 'שלום {name}, נדרש תיקון בהצעה שלכם עבור "{title}": {reason}. אפשר לשלוח הצעה מעודכנת בקישור.',
        "quote_rejected": 'שלום {name}, ההצעה שלכם עבור "{title}" לא אושרה: {reason}.',
        "claim_approved": 'שלום {name}, דרישת התשלום שלכם עבור "{title}" אושרה.',
        "claim_approved_without_exceptional": 'שלום {name}, דרישת התשלום שלכם עבור "{title}" אושרה ללא הסעיפים החריגים: {kinds}.',
        "claim_rejected": 'שלום {name}, דרישת התשלום שלכם עבור "{title}" לא אושרה: {reason}.',
        "window": " (חלון עבודה: {window})", "excluded_reason": "אושר ללא הסעיפים החריגים",
    },
    "en": {
        "quote_approved": 'Hello {name}, your quote for "{title}" was approved{window}. You may start the work.',
        "quote_partially_approved": 'Hello {name}, your quote for "{title}" was partly approved: {kinds}{window}. You may start the approved items.',
        "quote_fix_requested": 'Hello {name}, your quote for "{title}" needs a correction: {reason}. Please send an updated quote through the link.',
        "quote_rejected": 'Hello {name}, your quote for "{title}" was not approved: {reason}.',
        "claim_approved": 'Hello {name}, your payment request for "{title}" was approved.',
        "claim_approved_without_exceptional": 'Hello {name}, your payment request for "{title}" was approved without the extra items: {kinds}.',
        "claim_rejected": 'Hello {name}, your payment request for "{title}" was not approved: {reason}.',
        "window": " (work window: {window})", "excluded_reason": "Approved without the extra items",
    },
    "ar": {
        "quote_approved": 'مرحبًا {name}، تمت الموافقة على عرض السعر الخاص بكم لـ"{title}"{window}. يمكنكم البدء بالعمل.',
        "quote_partially_approved": 'مرحبًا {name}، تمت الموافقة جزئيًا على عرض السعر الخاص بكم لـ"{title}": {kinds}{window}. يمكنكم البدء بالبنود الموافق عليها.',
        "quote_fix_requested": 'مرحبًا {name}، مطلوب تعديل على عرض السعر الخاص بكم لـ"{title}": {reason}. يمكنكم إرسال عرض محدّث عبر الرابط.',
        "quote_rejected": 'مرحبًا {name}، لم تتم الموافقة على عرض السعر الخاص بكم لـ"{title}": {reason}.',
        "claim_approved": 'مرحبًا {name}، تمت الموافقة على طلب الدفع الخاص بكم لـ"{title}".',
        "claim_approved_without_exceptional": 'مرحبًا {name}، تمت الموافقة على طلب الدفع الخاص بكم لـ"{title}" بدون البنود الإضافية: {kinds}.',
        "claim_rejected": 'مرحبًا {name}، لم تتم الموافقة على طلب الدفع الخاص بكم لـ"{title}": {reason}.',
        "window": " (موعد العمل: {window})", "excluded_reason": "تمت الموافقة بدون البنود الإضافية",
    },
    "ru": {
        "quote_approved": "Здравствуйте, {name}! Ваше предложение по «{title}» утверждено{window}. Можно приступать к работе.",
        "quote_partially_approved": "Здравствуйте, {name}! Ваше предложение по «{title}» утверждено частично: {kinds}{window}. Можно приступать к утверждённым пунктам.",
        "quote_fix_requested": "Здравствуйте, {name}! В вашем предложении по «{title}» нужно исправление: {reason}. Обновлённое предложение можно отправить по ссылке.",
        "quote_rejected": "Здравствуйте, {name}! Ваше предложение по «{title}» не утверждено: {reason}.",
        "claim_approved": "Здравствуйте, {name}! Ваш запрос на оплату по «{title}» утверждён.",
        "claim_approved_without_exceptional": "Здравствуйте, {name}! Ваш запрос на оплату по «{title}» утверждён без дополнительных пунктов: {kinds}.",
        "claim_rejected": "Здравствуйте, {name}! Ваш запрос на оплату по «{title}» не утверждён: {reason}.",
        "window": " (срок работ: {window})", "excluded_reason": "Утверждено без дополнительных пунктов",
    },
}


def vendor_lang(conn, contact_id: str | None) -> str:
    contact = store_links.contact(conn, contact_id) or {}
    return contact.get("lang") if contact.get("lang") in LANGS else "he"


def excluded_reason(conn, contact_id: str | None) -> str:
    return DRAFTS[vendor_lang(conn, contact_id)]["excluded_reason"]


def _local(conn, value: str | None) -> str | None:
    at = parse(value)
    if at is None:
        return None
    try:
        from zoneinfo import ZoneInfo

        at = at.astimezone(ZoneInfo(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem"))
    except Exception:  # noqa: BLE001 - an unknown zone shows UTC
        pass
    return at.strftime("%d.%m.%Y %H:%M")


def draft_message(conn, ticket: Mapping[str, Any], *, subject: str, obj: Mapping[str, Any], decision: str) -> dict[str, Any]:
    """The editable draft of a decision message (owner 15.10 evening: always ask, never send silently). No amount in it."""
    contact_id = obj.get("contact_id")
    lang = vendor_lang(conn, contact_id)
    t = DRAFTS[lang]
    contact = store_links.contact(conn, contact_id) or {}
    name = "" if contact.get("erased_at") else (contact.get("display_name") or "")
    key = f"{subject}_{decision}"
    if key not in t:
        raise CostRefused(422, "unknown", "decision")
    window = ""
    kinds = ""
    if subject == "quote":
        a, b = _local(conn, obj.get("work_from")), _local(conn, obj.get("work_to"))
        if a or b:
            window = t["window"].format(window=" - ".join(x for x in (a, b) if x))
        if decision == "partially_approved":
            kinds = ", ".join(KIND_NAMES[lang][k] for k in money.LINE_KINDS if any(ln.get("kind") == k for ln in approved_lines(obj)))
    reason = clean_text(obj.get("decision_reason") or obj.get("reason") or "", multiline=False)
    if subject == "claim" and decision == "approved_without_exceptional":
        kinds = ", ".join(KIND_NAMES[lang][k] for k in money.LINE_KINDS if any(e.get("kind") == k for e in obj.get("exceptional") or []))
    text = t[key].format(name=name, title=clean_text(ticket.get("title") or ""), window=window, kinds=kinds, reason=reason)
    text = " ".join(text.split()).replace(" ,", ",").replace("שלום ,", "שלום,").replace("Hello ,", "Hello,")
    return {"text": text[:model.NOTE_MAX], "lang": lang, "notify_default": True,
            "send": {"route": f"POST /tickets/{ticket['id']}/vendor-message", "source": {"kind": subject, "id": obj.get("id")}}}


def ids(rows: Sequence[Mapping[str, Any]]) -> list[str]:
    return [r["id"] for r in rows]


def now() -> dt.datetime:
    return now_utc()
