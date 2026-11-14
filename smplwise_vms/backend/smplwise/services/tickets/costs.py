"""CR-038 slice 9, section 11A (D31 / D32): cost claims from external vendors - the service.

    mode resolution   per assignment (D32): the manager's choice in the assign dialog, preselected from the vendor / contact ->
                      the department -> the installation (`costs.mode`, default optional); `cannot_handle` returns make it optional
                      (an `off` stays off), "לא שלי" never asks; internal users never get a claim (11A.1)
    lifecycle         awaiting -> submitted -> (rejected -> submitted)* -> approved -> paid; paid -> approved only by "unmark" with
                      a reason (11A.3). Revisions are immutable rows; decisions are append-only rows (11A.7 "never overwrite")
    computation       money.py - integers in minor units, the server's numbers are the record (client totals are ignored)
    close gate        a REQUIRED claim that is not approved / paid blocks the manager's close (409 `cost_claim_pending`) unless a
                      holder of tickets.costs overrides it with a reason (decision `override_close`, audit
                      ticket.close.override_claim); `blocks_close()` is the hook of the automatic close (slice 6)
    claim window      `claim_until` = done (or a cannot-handle return, or the latest rejection) + `costs.claim_window_days` (the
                      department may override); the handler link opens in CLAIM MODE until then (11A.5, `claim_mode_ok`)
    payment hook      every approval / mark-paid / unmark writes a decision and calls `emit_cost_event(kind, claim)` - in release 1
                      it raises the CR-018 hook only; a payment integration subscribes there later (11A.9)
    OCR hook          `on_document_ready(document)` is called when a revision with documents is stored; it does nothing (11A.6A)

Visibility: amounts, lines, files and vendor rates are for `tickets.costs.view` holders only (fields removed server-side,
`present_claim(full=False)` keeps the status); approvals need `tickets.costs` AND `tickets.costs.view` on the ticket's place.
Logs and audit rows carry ids, statuses and totals only - never a line description, a note, a vendor reference or a file."""
from __future__ import annotations

import datetime as dt
import json
import logging
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping, Sequence

from ...audit import audit
from . import model, money, notify_bridge, settings_doc, store, store_costs, store_links
from .text_hygiene import clean_text

log = logging.getLogger("smplwise.tickets.costs")
UTC = dt.timezone.utc

COSTS_VIEW = "tickets.costs.view"
COSTS = "tickets.costs"
MODES: tuple[str, ...] = ("required", "optional", "off")
OPEN_STATUSES = frozenset({"awaiting", "submitted", "rejected"})  # the vendor may still submit (inside the window)
SETTLED = frozenset({"approved", "paid"})
VENDOR_REF_MAX = 40
NOTES_MAX = 1000
REASON_MAX = 500
PAYMENT_REF_MAX = 60
PENDING_TTL = dt.timedelta(hours=24)
# a link revoked for one of these reasons may still open the claim step inside the window (11A.5); every other reason never does
CLAIM_MODE_REVOKES = frozenset({"closed", "cancelled", "returned"})


class CostRefused(Exception):
    """A refused cost action: `status` + `code` (+ `field` for a 422). The internal router renders the Hebrew message, the public
    routes the `{code}` envelope."""

    def __init__(self, status: int, code: str, field: str | None = None, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.field = field
        self.extra = extra


# ---------------------------------------------------------------- time

def iso(at: dt.datetime) -> str:
    return at.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def now_utc() -> dt.datetime:
    return dt.datetime.now(UTC).replace(microsecond=0)


# ---------------------------------------------------------------- settings and modes

@dataclass(frozen=True)
class CostSettings:
    mode: str
    currencies: tuple[str, ...]
    vat_rate_bp: int
    claim_window_days: int
    require_invoice: bool
    max_claim_total_minor: int
    review_flag_above_minor: int
    retention_days: int


def cost_settings(conn) -> CostSettings:
    c = settings_doc.read(conn)["costs"]
    return CostSettings(mode=c["mode"], currencies=tuple(c["currencies"]), vat_rate_bp=int(c["vat_rate_bp"]),
                        claim_window_days=int(c["claim_window_days"]), require_invoice=bool(c["require_invoice"]),
                        max_claim_total_minor=int(c["max_claim_total_minor"]), review_flag_above_minor=int(c["review_flag_above_minor"]),
                        retention_days=int(c["retention_days"]))


def preselected_mode(conn, *, contact: Mapping[str, Any] | None, vendor: Mapping[str, Any] | None, department: Mapping[str, Any] | None) -> tuple[str, str]:
    """D32: (mode, the level it came from) - the most specific default that is set: the contact, its vendor, the department, the
    installation (`costs.mode`, default optional)."""
    for level, row in (("contact", contact), ("vendor", vendor), ("department", department)):
        v = (row or {}).get("cost_claim")
        if v in MODES:
            return v, level
    return cost_settings(conn).mode, "installation"


def window_days(conn, department: Mapping[str, Any] | None) -> int:
    v = (department or {}).get("claim_window_days")
    if isinstance(v, int) and 1 <= v <= 90:
        return v
    return cost_settings(conn).claim_window_days


def parse_mode(value: Any, field: str = "cost_claim") -> str | None:
    if value is None:
        return None
    if value not in MODES:
        raise CostRefused(422, "invalid", field)
    return value


# ---------------------------------------------------------------- the claim row: creation at "done" / a cannot-handle return

def _contact_pair(conn, contact_id: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    contact = store_links.contact(conn, contact_id) or {}
    vendor = store_links.contact(conn, contact["vendor_id"]) if contact.get("vendor_id") else None
    return contact, vendor


def assignment_mode(conn, ticket: Mapping[str, Any], assignment: Mapping[str, Any]) -> str:
    """The assignment's requirement: what the manager chose (`ticket_assignments.cost_claim`), else the preselection chain."""
    if assignment.get("cost_claim") in MODES:
        return assignment["cost_claim"]
    contact, vendor = _contact_pair(conn, assignment["contact_id"])
    dept = store.department_any(conn, ticket["department_id"])
    return preselected_mode(conn, contact=contact, vendor=vendor, department=dept)[0]


def _snapshot(conn, ticket: Mapping[str, Any], assignment: Mapping[str, Any]) -> dict[str, Any]:
    """11A.10: what keeps the record readable after the ticket's purge - never a phone or an e-mail."""
    contact, vendor = _contact_pair(conn, assignment["contact_id"])
    dept = store.department_any(conn, ticket["department_id"]) or {}
    return {
        "number": ticket.get("number"), "title": ticket.get("title") or "", "department": dept.get("name") or "",
        "department_id": ticket.get("department_id"), "place_text": ticket.get("place_text") or "", "device_name": ticket.get("device_name") or "",
        "entity_id": ticket.get("entity_id"), "zone_id": ticket.get("zone_id"), "floor_id": ticket.get("floor_id"),
        "vendor_id": (vendor or {}).get("id") or (contact.get("id") if contact.get("kind") == "vendor" else None),
        "vendor": (vendor or {}).get("display_name") or (contact.get("display_name") if contact.get("kind") == "vendor" else "") or contact.get("company") or "",
        "contact_name": contact.get("display_name") or "", "contact_kind": contact.get("kind"),
    }


def ensure_claim(conn, ticket: Mapping[str, Any], assignment: Mapping[str, Any], *, at: dt.datetime, cannot_handle: bool = False) -> dict[str, Any] | None:
    """Called inside the transaction that moves an EXTERNAL assignment to `done` (handler link, manager on behalf) or returns it as
    "לא אוכל לטפל". Creates the claim (status `awaiting`) or, for a claim that already exists and is still open, restarts its
    window. Returns the claim, or None when no claim is asked (internal assignee, `off`, "לא שלי")."""
    if assignment.get("assignee_kind") != "contact" or not assignment.get("contact_id"):
        return None
    mode = assignment_mode(conn, ticket, assignment)
    if mode == "off":
        return None
    required = mode == "required" and not cannot_handle
    dept = store.department_any(conn, ticket["department_id"])
    until = iso(at + dt.timedelta(days=window_days(conn, dept)))
    existing = store_costs.claim_for_assignment(conn, assignment["id"])
    now = iso(at)
    if existing is not None:
        if existing["status"] in ("awaiting", "rejected"):
            store_costs.update_claim(conn, existing["id"], {"claim_until": until, "required": 1 if required else 0, "missing_at": None}, now=now)
            refresh_ticket(conn, ticket["id"])
        return store_costs.claim(conn, existing["id"])
    s = cost_settings(conn)
    contact, _vendor = _contact_pair(conn, assignment["contact_id"])
    currency = contact.get("rate_currency") if contact.get("rate_currency") in s.currencies else s.currencies[0]
    cid = store_costs.insert_claim(conn, {
        "ticket_id": ticket["id"], "department_id": ticket["department_id"], "assignment_id": assignment["id"],
        "contact_id": assignment["contact_id"], "required": 1 if required else 0, "status": "awaiting", "currency": currency,
        "claim_until": until, "snapshot_json": json.dumps(_snapshot(conn, ticket, assignment), ensure_ascii=False, separators=(",", ":")),
        "created_at": now, "updated_at": now,
    })
    refresh_ticket(conn, ticket["id"])
    return store_costs.claim(conn, cid)


def on_assignment_done(conn, ticket_id: str, assignment_id: str | None, at: dt.datetime) -> None:
    """The hook in every path that reaches `done` (handler_actions.set_status, service.change_status on behalf)."""
    asg = store.assignment(conn, assignment_id)
    t = store_costs.ticket_row(conn, ticket_id)
    if asg is None or t is None:
        return
    ensure_claim(conn, dict(t), asg, at=at)


def on_assignment_returned(conn, ticket_id: str, assignment_id: str | None, kind: str, at: dt.datetime) -> None:
    """11A.1: after "לא אוכל לטפל" a claim is optional (a diagnosis visit may cost money); after "לא שלי" none is asked."""
    if kind != "cannot_handle":
        return
    asg = store.assignment(conn, assignment_id)
    t = store_costs.ticket_row(conn, ticket_id)
    if asg is None or t is None:
        return
    ensure_claim(conn, dict(t), asg, at=at, cannot_handle=True)


# ---------------------------------------------------------------- the ticket's denormalised cost columns (the board, 11A.3)

_STATUS_RANK = ("submitted", "awaiting", "rejected", "approved", "paid")


def ticket_cost_state(claims: Sequence[Mapping[str, Any]], totals: Mapping[str, tuple[int, str]]) -> tuple[str, int | None, str | None]:
    """(cost_status, total, currency) of a ticket from its claims. The status is the most actionable one (a submission waiting for
    review first); an optional claim nobody submitted counts as not required. The total sums the counted amount of every claim
    (approved, else the latest submission) when they share one currency - never across currencies."""
    states: list[str] = []
    for c in claims:
        st = c["status"]
        if st == "awaiting" and not c["required"]:
            continue
        states.append(st)
    status = next((s for s in _STATUS_RANK if s in states), "not_required")
    amounts = [totals[c["id"]] for c in claims if c["id"] in totals]
    currencies = {cur for _amt, cur in amounts}
    if not amounts or len(currencies) != 1:
        return status, None, (next(iter(currencies)) if len(currencies) == 1 else None)
    return status, sum(a for a, _c in amounts), currencies.pop()


def refresh_ticket(conn, ticket_id: str | None) -> None:
    if not ticket_id:
        return
    claims = store_costs.claims_of_ticket(conn, ticket_id)
    totals: dict[str, tuple[int, str]] = {}
    for c in claims:
        if c["status"] in SETTLED and c.get("approved_total_minor") is not None:
            rev = store_costs.revision(conn, c.get("approved_revision_id"))
            totals[c["id"]] = (int(c["approved_total_minor"]), (rev or {}).get("currency") or c["currency"])
        elif c.get("current_revision_id"):
            rev = store_costs.revision(conn, c["current_revision_id"])
            if rev is not None:
                totals[c["id"]] = (int(rev["total_minor"]), rev["currency"])
    status, total, currency = ticket_cost_state(claims, totals)
    store_costs.set_ticket_cost(conn, ticket_id, status, total, currency)


# ---------------------------------------------------------------- the close gate (11A.3)

def pending_required(conn, ticket_id: str) -> list[dict[str, Any]]:
    return [c for c in store_costs.claims_of_ticket(conn, ticket_id) if c["required"] and c["status"] not in SETTLED]


def blocks_close(conn, ticket_id: str) -> bool:
    """The hook of the automatic close after N days (slice 6's monitor skips the ticket and keeps it in "waiting for me")."""
    return bool(pending_required(conn, ticket_id))


def check_close(conn, viewer, row: Mapping[str, Any], override_reason: str | None, rid: str | None) -> list[str]:
    """Inside the manager's close: refuse while a required claim is pending, or record the override. Returns the overridden
    claim ids. `viewer` is an access.Viewer (holds tickets.costs on the ticket's place for the override)."""
    pending = pending_required(conn, row["id"])
    if not pending:
        return []
    reason = clean_text(override_reason or "", multiline=True)
    if not reason:
        raise CostRefused(409, "cost_claim_pending", can_override=viewer.holds(COSTS, row))
    if len(reason) > REASON_MAX:
        raise CostRefused(422, "too_long", "override_claim_reason")
    if not viewer.holds(COSTS, row):
        audit(conn, actor=viewer.principal, action="ticket.close.override_claim", decision="denied", resource_type="ticket",
              resource_id=row["id"], reason="costs_permission_missing", request_id=rid, details={"number": row.get("number")})
        raise CostRefused(403, "forbidden", permission=COSTS)
    at = iso(now_utc())
    for c in pending:
        store_costs.insert_decision(conn, {"claim_id": c["id"], "revision_id": c.get("current_revision_id"), "action": "override_close",
                                           "reason": reason, "by_user": viewer.uid, "at": at})
    audit(conn, actor=viewer.principal, action="ticket.close.override_claim", decision="allowed", resource_type="ticket", resource_id=row["id"],
          request_id=rid, details={"number": row.get("number"), "claims": [c["id"] for c in pending]})
    return [c["id"] for c in pending]


# ---------------------------------------------------------------- the claim window and claim mode (11A.5)

def window_open(claim: Mapping[str, Any] | None, now: dt.datetime) -> bool:
    until = parse((claim or {}).get("claim_until"))
    return until is not None and now < until


def claim_mode_ok(conn, link_id: str, generation: int, now: dt.datetime) -> dt.datetime | None:
    """Whether a handler link that no longer serves the page may still open the CLAIM step: not revoked for any reason other than
    close / cancel / a cannot-handle return, the same generation, a claim of its assignment and `now < claim_until`. Returns the
    claim's `claim_until` (the claim mode's own expiry) or None."""
    lk = store_links.link(conn, link_id)
    if lk is None or int(lk["generation"]) != int(generation):
        return None
    reason = lk.get("revoked_reason")
    asg = store.assignment(conn, lk["assignment_id"])
    if asg is None:
        return None
    if reason is not None and reason not in CLAIM_MODE_REVOKES:
        return None
    if reason == "returned" and asg.get("return_kind") != "cannot_handle":
        return None
    if asg.get("end_reason") == "reassigned":
        return None
    rows = store_costs.claims_of_assignment(conn, lk["assignment_id"])
    ends = [parse(c["claim_until"]) for c in rows if window_open(c, now)]
    if ends:
        return max(e for e in ends if e is not None)
    # CR-CLAIM-PREFILL (0117): a manager opened a demand for the NEXT instalment - the claim step opens for the window from that day
    nxt = next_instalment(conn, rows)
    if nxt is not None:
        until = nxt[1] + dt.timedelta(days=window_days(conn, store.department_any(conn, rows[0]["department_id"])))
        if now < until:
            return until
    return None


# ---------------------------------------------------------------- several claims per assignment (CR-CLAIM-PREFILL, migration 0117)
#
# An assignment without an approved payment schedule has ONE claim (`instalment_index` NULL), exactly as before. With a schedule, the
# vendor's first demand that names an instalment takes that index on the ordinary claim ("adopts" it, so the required claim is the one
# he answers); after that, a NEW claim per instalment is opened only when a manager opened a demand for that instalment (RFQPAY2, contract
# 20.11), never twice for one instalment (the unique index), and never after a whole-quote demand was settled.

def next_instalment(conn, rows: Sequence[Mapping[str, Any]]) -> tuple[int, dt.datetime] | None:
    """(index, the day its manager demand was opened) of the lowest instalment a NEW claim may be opened for, or None."""
    if not rows or any(r.get("instalment_index") is None for r in rows):
        return None
    from . import claim_prefill, store_rfq

    q = claim_prefill.baseline_for(conn, rows[0])
    if q is None:
        return None
    payable = {it["index"] for it in claim_prefill._schedule(conn, q) if it["amount_minor"] > 0}
    taken = {int(r["instalment_index"]) for r in rows}
    opened = sorted((i, d) for i, d in store_rfq.demands_of_quote(conn, q["id"]).items()
                    if d.get("status") == "open" and i in payable and i not in taken)
    if not opened:
        return None
    i, d = opened[0]
    return i, parse(d.get("created_at")) or now_utc()


def _virtual(conn, primary: Mapping[str, Any], index: int, at: dt.datetime) -> dict[str, Any]:
    """The claim a submission for a NEW instalment will create (written only after the submission validated - `_materialise`)."""
    dept = store.department_any(conn, primary["department_id"])
    return {**primary, "id": None, "required": 0, "status": "awaiting", "no_charge": 0, "current_revision_id": None, "approved_revision_id": None,
            "approved_total_minor": None, "approved_by": None, "approved_at": None, "paid_at": None, "paid_by": None, "payment_ref": None,
            "payment_date": None, "claim_until": iso(at + dt.timedelta(days=window_days(conn, dept))), "missing_at": None, "purge_after": None,
            "revision": 1, "instalment_index": index, "_new": True}


def focus_claim(conn, assignment_id: str, now: dt.datetime) -> dict[str, Any] | None:
    """The claim the vendor's page works on: the latest one still open; else a NEW instalment's (virtual) claim when a manager opened
    a demand for it; else the latest one (settled)."""
    rows = store_costs.claims_of_assignment(conn, assignment_id)
    if not rows:
        return None
    open_rows = [r for r in rows if r["status"] not in SETTLED]
    if open_rows:
        return open_rows[-1]
    nxt = next_instalment(conn, rows)
    if nxt is not None:
        return _virtual(conn, store_costs.claim_for_assignment(conn, assignment_id) or rows[0], nxt[0], now)
    return rows[-1]


def _earlier_unsettled(conn, primary: Mapping[str, Any], assignment_id: str, index: int) -> bool:
    """CR-CLAIM-ORDER (owner 12a, 2026-10-18): True when a payable instalment BEFORE `index` of the approved schedule has no settled
    (approved / paid) claim - none opened yet, or one still awaiting / submitted / rejected. No schedule (a single-claim award): False."""
    from . import claim_prefill

    q = claim_prefill.baseline_for(conn, primary)
    if q is None:
        return False
    payable = [it for it in claim_prefill._schedule(conn, q) if it["amount_minor"] > 0]
    if index not in {it["index"] for it in payable}:
        return False  # not an instalment of the schedule: `claim_prefill.basis` refuses it with its own field error
    for it in payable:
        if it["index"] < index:
            earlier = store_costs.claim_for_instalment(conn, assignment_id, it["index"])
            if earlier is None or earlier["status"] not in SETTLED:
                return True
    return False


def claim_for_submission(conn, assignment_id: str, index: Any, at: dt.datetime) -> dict[str, Any] | None:
    """The claim a vendor's submission goes to (nothing is written here). Refusals: 422 `instalment_index` `required` (his demands are
    per instalment now), 409 `claim_closed` (a whole-quote demand was settled), 409 `instalment_not_open` (no manager demand for it), 409 `earlier_instalment_unsettled` (an earlier payable
    instalment has no approved / paid claim yet)."""
    primary = store_costs.claim_for_assignment(conn, assignment_id)
    if primary is None:
        return None
    if index is None or isinstance(index, bool) or not isinstance(index, int):
        if primary.get("instalment_index") is not None and index is None:
            raise CostRefused(422, "required", "instalment_index")
        return primary  # a malformed index is refused by claim_prefill.basis with its field
    row = store_costs.claim_for_instalment(conn, assignment_id, index)
    if row is not None:
        return row
    if primary.get("instalment_index") is None:
        if primary["status"] in SETTLED:
            raise CostRefused(409, "claim_closed")
        if _earlier_unsettled(conn, primary, assignment_id, index):  # CR-CLAIM-ORDER: a first demand may not skip an earlier instalment
            raise CostRefused(409, "earlier_instalment_unsettled")
        return {**primary, "_adopt": index}
    from . import claim_prefill, store_rfq

    q = claim_prefill.baseline_for(conn, primary)
    d = store_rfq.demands_of_quote(conn, q["id"]).get(index) if q else None
    if d is None or d.get("status") != "open":
        raise CostRefused(409, "instalment_not_open")
    if _earlier_unsettled(conn, primary, assignment_id, index):  # CR-CLAIM-ORDER: a NEW demand only after every earlier instalment was settled
        raise CostRefused(409, "earlier_instalment_unsettled")
    return _virtual(conn, primary, index, at)


def _materialise(conn, claim: Mapping[str, Any], at: dt.datetime) -> dict[str, Any]:
    """Write the claim a validated submission needs: a NEW instalment claim, or the index taken by the ordinary claim."""
    if claim.get("_new"):
        row = {k: v for k, v in claim.items() if not k.startswith("_") and k != "id"}
        row["created_at"] = row["updated_at"] = iso(at)
        cid = store_costs.insert_claim(conn, row)
        return store_costs.claim(conn, cid) or {}
    if claim.get("_adopt") is not None:
        store_costs.update_claim(conn, claim["id"], {"instalment_index": int(claim["_adopt"])}, now=iso(at))
        return store_costs.claim(conn, claim["id"]) or {}
    return dict(claim)


# ---------------------------------------------------------------- building a revision (vendor submission, adjustment, on behalf)

@dataclass(frozen=True)
class Draft:
    computed: money.Computed
    currency: str
    no_charge: bool
    vendor_ref: str | None
    notes: str | None


def _text(value: Any, field: str, max_len: int, *, multiline: bool = False) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", field)
    t = clean_text(value, multiline=multiline)
    if len(t) > max_len:
        raise CostRefused(422, "too_long", field)
    return t or None


def draft(conn, claim: Mapping[str, Any], body: Mapping[str, Any], *, vat_mode: str | None = None) -> Draft:
    """Validate a claim body against the settings and the vendor record; the server computes every figure. `vat_mode` forces the
    mode (an adjustment keeps the corrected revision's mode)."""
    s = cost_settings(conn)
    contact, _vendor = _contact_pair(conn, claim["contact_id"])
    currency = body.get("currency") or claim.get("currency") or s.currencies[0]
    if currency not in s.currencies:
        raise CostRefused(422, "unknown", "currency")
    no_charge = bool(body.get("no_charge"))
    try:
        lines = money.parse_lines(body.get("lines") or [])
    except money.MoneyError as exc:
        raise CostRefused(422, exc.code, exc.field) from None
    if no_charge and lines:
        raise CostRefused(422, "no_charge_with_lines", "lines")
    if not no_charge and not lines:
        raise CostRefused(422, "required", "lines")
    if vat_mode is None:
        include = body.get("amounts_include_vat")
        if include is not None and not isinstance(include, bool):
            raise CostRefused(422, "type", "amounts_include_vat")
        if include is None:
            include = contact.get("vat_default") == "included"
        vat_mode = money.vat_mode_for(vat_exempt=bool(contact.get("vat_exempt")), amounts_include_vat=include, no_charge=no_charge)
    try:
        computed = money.compute(lines, vat_mode, s.vat_rate_bp, max_total_minor=s.max_claim_total_minor)
    except money.MoneyError as exc:
        raise CostRefused(422, exc.code, exc.field) from None
    return Draft(computed=computed, currency=currency, no_charge=no_charge,
                 vendor_ref=_text(body.get("vendor_ref"), "vendor_ref", VENDOR_REF_MAX),
                 notes=_text(body.get("notes"), "notes", NOTES_MAX, multiline=True))


def place_documents(documents: Any, available: Mapping[str, Mapping[str, Any]], now: dt.datetime) -> list[tuple[str, int, int]]:
    """11A.2 / 11A.6: [(file id, document no, page no)] in the order given - at most 3 documents, each ONE PDF or 1-10 pages, at
    most 25 files, no id twice, no file (by SHA-256) twice. `available` = the uploader's pending files (fresh, < 24 h) and the files
    already attached to this claim (a corrected revision may carry them again)."""
    if documents is None:
        return []
    if not isinstance(documents, list):
        raise CostRefused(422, "type", "documents")
    if len(documents) > 3:
        raise CostRefused(422, "too_many_documents", "documents")
    out: list[tuple[str, int, int]] = []
    seen_ids: set[str] = set()
    seen_hash: set[str] = set()
    for d_no, doc in enumerate(documents, start=1):
        ids = doc.get("file_ids") if isinstance(doc, Mapping) else None
        if not isinstance(ids, list) or not ids or set(doc) - {"file_ids"}:
            raise CostRefused(422, "empty_document", f"documents.{d_no - 1}")
        if len(ids) > 10:
            raise CostRefused(422, "too_many_pages", f"documents.{d_no - 1}")
        kinds: set[str] = set()
        for p_no, fid in enumerate(ids, start=1):
            f = available.get(fid) if isinstance(fid, str) else None
            if f is None:
                raise CostRefused(422, "unknown_file", f"documents.{d_no - 1}")
            if f.get("claim_id") is None and (parse(f["created_at"]) or now) <= now - PENDING_TTL:
                raise CostRefused(422, "expired_file", f"documents.{d_no - 1}")
            if fid in seen_ids:
                raise CostRefused(422, "file_reused", f"documents.{d_no - 1}")
            if f["sha256"] in seen_hash:
                raise CostRefused(422, "duplicate_file", f"documents.{d_no - 1}")
            seen_ids.add(fid)
            seen_hash.add(f["sha256"])
            kinds.add(f["kind"])
            out.append((fid, d_no, p_no))
        if "pdf" in kinds and (len(ids) != 1 or kinds != {"pdf"}):
            raise CostRefused(422, "mixed_document", f"documents.{d_no - 1}")
        if len(out) > 25:
            raise CostRefused(422, "too_many_files", "documents")
    return out


def _available_files(conn, claim: Mapping[str, Any], *, link_id: str | None, user_id: str | None, now: dt.datetime) -> dict[str, dict[str, Any]]:
    since = iso(now - PENDING_TTL)
    out = {f["id"]: f for f in store_costs.files_of_claim(conn, claim["id"])}
    if link_id:
        pending = store_costs.pending_for_link(conn, link_id, since)
    else:
        pending = store_costs.pending_for_user(conn, claim["ticket_id"], user_id or "", since) if claim.get("ticket_id") else []
    out.update({f["id"]: f for f in pending})
    return out


def _write_revision(conn, claim: Mapping[str, Any], d: Draft, *, source: str, kind: str, created_by_kind: str, created_by: str,
                    placed: Sequence[tuple[str, int, int]], at: dt.datetime, based_on: str | None = None, reason: str | None = None,
                    exceptional: Sequence[Mapping[str, Any]] = (), basis: Mapping[str, Any] | None = None) -> str:
    c = d.computed
    extra = {"basis_json": json.dumps(dict(basis), ensure_ascii=False, separators=(",", ":"))} if basis else {}  # CR-CLAIM-PREFILL (0116)
    rid = store_costs.insert_revision(conn, {
        **extra,
        "exceptional_json": json.dumps(list(exceptional), ensure_ascii=False, separators=(",", ":")),  # TKDETAILBE (5.1)
        "claim_id": claim["id"], "seq": store_costs.next_seq(conn, claim["id"]), "source": source, "kind": kind, "based_on": based_on,
        "no_charge": 1 if d.no_charge else 0, "lines_json": [ln.as_json() for ln in c.lines],
        "labor_minor": c.by_kind["labor"], "parts_minor": c.by_kind["parts"], "travel_minor": c.by_kind["travel"], "other_minor": c.by_kind["other"],
        "subtotal_minor": c.subtotal_minor, "vat_mode": c.vat_mode, "vat_rate_bp": c.vat_rate_bp, "vat_minor": c.vat_minor,
        "total_minor": c.total_minor, "currency": d.currency, "vendor_ref": d.vendor_ref, "notes": d.notes, "reason": reason,
        "created_by_kind": created_by_kind, "created_by": created_by, "created_at": iso(at),
    })
    if placed:
        store_costs.attach_files(conn, claim["id"], rid, placed)
    return rid


def _clear_claim_missing(conn, ticket_id: str | None) -> None:
    if not ticket_id:
        return
    t = store_costs.ticket_row(conn, ticket_id)
    if t is not None and t["waiting_reason"] == "claim_missing":
        on, why = model.waiting_for(t["status"])
        store.update_ticket(conn, ticket_id, {"waiting_on": on, "waiting_reason": why}, bump=False)


def submit(conn, claim: Mapping[str, Any], body: Mapping[str, Any], *, by_kind: str, by_id: str, link_id: str | None, at: dt.datetime,
           kind: str = "submission", actor_name: str = "") -> dict[str, Any]:
    """A vendor's submission through the link (`by_kind = 'contact'`) or a claim entered on the vendor's behalf (`by_kind =
    'user'`, kind `on_behalf`). A pending revision is superseded (decision `superseded`); after approval -> 409 `claim_closed`."""
    if claim["status"] in SETTLED:
        raise CostRefused(409, "claim_closed")
    if by_kind == "contact" and not window_open(claim, at):
        raise CostRefused(409, "claim_window_closed")
    d = draft(conn, claim, body)
    from . import quotes  # TKDETAILBE (5.1): the demand against the approved quote; an exceptional line is flagged, never refused

    exceptional, base = quotes.analyse_demand(conn, claim, d.computed.lines)
    from . import claim_prefill  # CR-CLAIM-PREFILL: what the demand is compared with (the approved total or one instalment)

    basis = claim_prefill.basis(conn, claim, claim_prefill.baseline_for(conn, claim), total_minor=d.computed.total_minor, currency=d.currency,
                                no_charge=d.no_charge, body=body, vendor=by_kind == "contact")
    placed = place_documents(body.get("documents"), _available_files(conn, claim, link_id=link_id, user_id=by_id if by_kind == "user" else None, now=at), at)
    if cost_settings(conn).require_invoice and not d.no_charge and not placed:
        raise CostRefused(422, "invoice_required", "documents")
    claim = _materialise(conn, claim, at)  # CR-CLAIM-PREFILL (0117): only now, after every refusal - a refused demand writes nothing
    now = iso(at)
    previous =claim.get("current_revision_id") if claim["status"] == "submitted" else None
    rid = _write_revision(conn, claim, d, source="vendor" if by_kind == "contact" else "manager", kind=kind, created_by_kind=by_kind,
                          created_by=by_id, placed=placed, at=at, exceptional=exceptional, basis=basis)
    if previous:
        store_costs.insert_decision(conn, {"claim_id": claim["id"], "revision_id": previous, "action": "superseded",
                                           "by_user": by_id if by_kind == "user" else f"contact:{by_id}", "at": now})
    store_costs.update_claim(conn, claim["id"], {"status": "submitted", "current_revision_id": rid, "currency": d.currency,
                                                 "no_charge": 1 if d.no_charge else 0, "missing_at": None,
                                                 "quote_id": base["id"] if base else None}, now=now)
    fresh = store_costs.claim(conn, claim["id"]) or dict(claim)
    if claim.get("ticket_id"):
        # the timeline row names the claim and its revision number only: members without tickets.costs.view read the timeline too
        data = {"claim_id": claim["id"], "seq": store_costs.revision(conn, rid)["seq"], "on_behalf": by_kind == "user"}
        if by_kind == "contact":
            store_links.insert_contact_event(conn, claim["ticket_id"], "cost_submitted", contact_id=by_id, actor_name=actor_name,
                                             assignment_id=claim["assignment_id"], at=now, data=data, visible_external=True)
        else:
            store.insert_event(conn, claim["ticket_id"], "cost_submitted", actor_kind="user", actor_user_id=by_id, actor_name=actor_name,
                               assignment_id=claim["assignment_id"], data=data, at=now)
        refresh_ticket(conn, claim["ticket_id"])
        _clear_claim_missing(conn, claim["ticket_id"])
        notify_bridge.cost_submitted(conn, claim["ticket_id"], claim["id"])
    if placed:
        on_document_ready({"claim_id": claim["id"], "revision_id": rid, "files": [p[0] for p in placed]})
    return fresh


# ---------------------------------------------------------------- the reviewer's decisions (11A.7)

def _expect(claim: Mapping[str, Any], revision: int | None, revision_id: str | None) -> None:
    if revision is not None and int(claim["revision"]) != int(revision):
        raise CostRefused(409, "claim_stale", revision=claim["revision"])
    if revision_id is not None and revision_id != claim.get("current_revision_id"):
        raise CostRefused(409, "claim_stale", revision=claim["revision"])


def _reason(value: Any, field: str = "reason", *, required: bool = True) -> str | None:
    t = _text(value, field, REASON_MAX, multiline=True)
    if required and not t:
        raise CostRefused(422, "required", field)
    return t


def _approve(conn, claim: Mapping[str, Any], revision_id: str, by: str, at: dt.datetime, action: str, reason: str | None,
             internal_note: str | None = None) -> dict[str, Any]:
    """TKFIX260 (owner rule 15.10 evening): an approval NEVER sends a vendor message. The decision route returns a `message_draft`
    and the manager confirms it in the cost card (`POST /tickets/{id}/vendor-message`); that is the only path. The 2.5.x setting
    `costs.notify_vendor_approved` is gone - a stored `true` is kept in the document as an unknown key and ignored."""
    rev = store_costs.revision(conn, revision_id) or {}
    now = iso(at)
    retention = cost_settings(conn).retention_days
    store_costs.update_claim(conn, claim["id"], {
        "status": "approved", "approved_revision_id": revision_id, "approved_total_minor": int(rev["total_minor"]), "approved_by": by,
        "approved_at": now, "current_revision_id": revision_id, "currency": rev["currency"], "missing_at": None,
        "purge_after": iso(at + dt.timedelta(days=retention)),
    }, now=now)
    store_costs.insert_decision(conn, {"claim_id": claim["id"], "revision_id": revision_id, "action": action, "reason": reason,
                                       "internal_note": internal_note, "amount_minor": int(rev["total_minor"]), "by_user": by, "at": now})
    fresh = store_costs.claim(conn, claim["id"]) or dict(claim)
    refresh_ticket(conn, claim.get("ticket_id"))
    _clear_claim_missing(conn, claim.get("ticket_id"))
    if claim.get("ticket_id"):
        notify_bridge.cost_resolved(conn, claim["ticket_id"], claim["id"])
    emit_cost_event("approved", fresh)
    return fresh


def _not_self(conn, revision_id: str, by: str) -> None:
    """Security review 2026-10-14 (2.5.1): nobody approves (or adjusts and approves) a revision they entered themselves (an
    on-behalf entry) - a second person decides."""
    rev = store_costs.revision(conn, revision_id) or {}
    if rev.get("created_by_kind") == "user" and rev.get("created_by") == by:
        raise CostRefused(409, "self_approval")


def _internal_note(value: Any) -> str | None:
    """TKFIX260 (public-surface review F1): the manager's INTERNAL note of a decision - stored apart from the vendor-facing reason
    (`ticket_cost_decisions.internal_note`), never in the vendor's page, a draft, a message or an audit row."""
    return _text(value, "internal_note", REASON_MAX, multiline=True)


def approve(conn, claim: Mapping[str, Any], *, by: str, revision: int, revision_id: str, at: dt.datetime,
            exceptional: str = "include", reason: Any = None, internal_note: Any = None) -> dict[str, Any]:
    """TKDETAILBE (5.3): `exceptional = "exclude"` approves the submission WITHOUT its exceptional lines - a manager adjustment
    revision (reason: the given one, else the default text in the vendor's language) - and never sends a message."""
    if claim["status"] != "submitted":
        raise CostRefused(409, "claim_not_submitted")
    if exceptional not in ("include", "exclude"):
        raise CostRefused(422, "invalid", "exceptional")
    _expect(claim, revision, revision_id)
    _not_self(conn, revision_id, by)
    inote = _internal_note(internal_note)
    if exceptional == "exclude":
        from . import quotes

        base = store_costs.revision(conn, revision_id) or {}
        drop = {int(e["index"]) for e in quotes.exceptional_of(base) if isinstance(e, Mapping) and isinstance(e.get("index"), int)}
        if drop:
            kept = [ln for i, ln in enumerate(_lines(base)) if i not in drop]
            if not kept:
                raise CostRefused(409, "nothing_left")
            why = _reason(reason, required=False) or quotes.excluded_reason(conn, claim.get("contact_id"))
            lines = [money.line_from_json(ln) for ln in kept]
            s = cost_settings(conn)
            try:
                computed = money.compute(lines, base["vat_mode"], int(base["vat_rate_bp"]), max_total_minor=s.max_claim_total_minor)
            except money.MoneyError as exc:
                raise CostRefused(422, exc.code, exc.field) from None
            d = Draft(computed=computed, currency=base["currency"], no_charge=False, vendor_ref=base.get("vendor_ref"), notes=base.get("notes"))
            placed = [(f["id"], int(f["doc_no"]), int(f["rf_page_no"])) for f in store_costs.revision_files(conn, revision_id)]
            rid = _write_revision(conn, claim, d, source="manager", kind="adjustment", created_by_kind="user", created_by=by, placed=placed,
                                  at=at, based_on=revision_id, reason=why)
            return _approve(conn, claim, rid, by, at, "adjust", why, inote)
    return _approve(conn, claim, revision_id, by, at, "approve", None, inote)


def adjust(conn, claim: Mapping[str, Any], body: Mapping[str, Any], *, by: str, revision: int, revision_id: str, reason: Any,
           at: dt.datetime, internal_note: Any = None) -> dict[str, Any]:
    """"אישור עם תיקון": a MANAGER revision (`kind = adjustment`, mandatory reason) based on the vendor's, carrying its files and
    its VAT mode, approved at once. The vendor sees the approved total and the reason."""
    if claim["status"] != "submitted":
        raise CostRefused(409, "claim_not_submitted")
    _expect(claim, revision, revision_id)
    _not_self(conn, revision_id, by)
    why = _reason(reason)
    inote = _internal_note(internal_note)
    base = store_costs.revision(conn, revision_id) or {}
    d = draft(conn, claim, {**body, "currency": base.get("currency")}, vat_mode=base.get("vat_mode"))
    from . import quotes

    exceptional, _base_quote = quotes.analyse_demand(conn, claim, d.computed.lines)
    placed = [(f["id"], int(f["doc_no"]), int(f["rf_page_no"])) for f in store_costs.revision_files(conn, revision_id)]
    rid = _write_revision(conn, claim, d, source="manager", kind="adjustment", created_by_kind="user", created_by=by, placed=placed,
                          at=at, based_on=revision_id, reason=why, exceptional=exceptional)
    return _approve(conn, claim, rid, by, at, "adjust", why, inote)


def reject(conn, claim: Mapping[str, Any], *, by: str, revision: int, revision_id: str, reason: Any, at: dt.datetime,
           internal_note: Any = None) -> dict[str, Any]:
    if claim["status"] != "submitted":
        raise CostRefused(409, "claim_not_submitted")
    _expect(claim, revision, revision_id)
    why = _reason(reason)
    inote = _internal_note(internal_note)
    now = iso(at)
    dept = store.department_any(conn, claim["department_id"])
    store_costs.update_claim(conn, claim["id"], {"status": "rejected", "claim_until": iso(at + dt.timedelta(days=window_days(conn, dept))),
                                                 "missing_at": None}, now=now)
    store_costs.insert_decision(conn, {"claim_id": claim["id"], "revision_id": revision_id, "action": "reject", "reason": why, "internal_note": inote,
                                       "by_user": by, "at": now})
    fresh = store_costs.claim(conn, claim["id"]) or dict(claim)
    refresh_ticket(conn, claim.get("ticket_id"))
    if claim.get("ticket_id"):
        notify_bridge.cost_resolved(conn, claim["ticket_id"], claim["id"])
    vendor_message(conn, fresh, "cost_rejected", requested_by=by)
    return fresh


def _payment_date(value: Any, at: dt.datetime) -> str:
    if not isinstance(value, str):
        raise CostRefused(422, "type", "payment_date")
    try:
        day = dt.date.fromisoformat(value)
    except ValueError:
        raise CostRefused(422, "format", "payment_date") from None
    if day > (at + dt.timedelta(days=1)).date() or day.year < 2000:
        raise CostRefused(422, "range", "payment_date")
    return day.isoformat()


def check_payment(payment_ref: Any, payment_date: Any, at: dt.datetime) -> tuple[str, str]:
    """The payment fields of "mark as paid" validated alone (TK258's bulk route checks them once for all its items)."""
    ref = _text(payment_ref, "payment_ref", PAYMENT_REF_MAX)
    if not ref:
        raise CostRefused(422, "required", "payment_ref")
    return ref, _payment_date(payment_date, at)


def mark_paid(conn, claim: Mapping[str, Any], *, by: str, revision: int, payment_ref: Any, payment_date: Any, at: dt.datetime) -> dict[str, Any]:
    if claim["status"] != "approved":
        raise CostRefused(409, "claim_not_approved")
    _expect(claim, revision, None)
    ref = _text(payment_ref, "payment_ref", PAYMENT_REF_MAX)
    if not ref:
        raise CostRefused(422, "required", "payment_ref")
    day = _payment_date(payment_date, at)
    now = iso(at)
    store_costs.update_claim(conn, claim["id"], {"status": "paid", "paid_at": now, "paid_by": by, "payment_ref": ref, "payment_date": day,
                                                 "purge_after": iso(at + dt.timedelta(days=cost_settings(conn).retention_days))}, now=now)
    store_costs.insert_decision(conn, {"claim_id": claim["id"], "revision_id": claim.get("approved_revision_id"), "action": "mark_paid",
                                       "amount_minor": claim.get("approved_total_minor"), "payment_ref": ref, "by_user": by, "at": now})
    fresh = store_costs.claim(conn, claim["id"]) or dict(claim)
    refresh_ticket(conn, claim.get("ticket_id"))
    emit_cost_event("paid", fresh)
    return fresh


def unmark_paid(conn, claim: Mapping[str, Any], *, by: str, revision: int, reason: Any, at: dt.datetime) -> dict[str, Any]:
    if claim["status"] != "paid":
        raise CostRefused(409, "claim_not_paid")
    _expect(claim, revision, None)
    why = _reason(reason)
    now = iso(at)
    store_costs.update_claim(conn, claim["id"], {"status": "approved", "paid_at": None, "paid_by": None, "payment_ref": None, "payment_date": None}, now=now)
    store_costs.insert_decision(conn, {"claim_id": claim["id"], "revision_id": claim.get("approved_revision_id"), "action": "unmark_paid",
                                       "reason": why, "by_user": by, "at": now})
    fresh = store_costs.claim(conn, claim["id"]) or dict(claim)
    refresh_ticket(conn, claim.get("ticket_id"))
    emit_cost_event("unpaid", fresh)
    return fresh


def reopen_window(conn, claim: Mapping[str, Any], *, by: str, revision: int, at: dt.datetime) -> dict[str, Any]:
    """"פתח שוב להגשה": ONCE per claim, after the window passed without a claim (awaiting / rejected); the vendor gets a
    `cost_reopened` message with the link."""
    if claim["status"] not in ("awaiting", "rejected"):
        raise CostRefused(409, "claim_not_open")
    _expect(claim, revision, None)
    if window_open(claim, at):
        raise CostRefused(409, "window_still_open")
    if store_costs.decision_count(conn, claim["id"], "reopen_window"):
        raise CostRefused(409, "already_reopened")
    now = iso(at)
    dept = store.department_any(conn, claim["department_id"])
    store_costs.update_claim(conn, claim["id"], {"claim_until": iso(at + dt.timedelta(days=window_days(conn, dept))), "missing_at": None}, now=now)
    store_costs.insert_decision(conn, {"claim_id": claim["id"], "action": "reopen_window", "by_user": by, "at": now})
    fresh = store_costs.claim(conn, claim["id"]) or dict(claim)
    _clear_claim_missing(conn, claim.get("ticket_id"))
    vendor_message(conn, fresh, "cost_reopened", requested_by=by)
    return fresh


def set_requirement(conn, ticket: Mapping[str, Any], assignment: Mapping[str, Any], mode: Any, *, by: str, at: dt.datetime) -> None:
    """The manager changes the requirement of an external assignment while no claim was submitted (audited by the caller as
    ticket.cost.requirement)."""
    m = parse_mode(mode, "mode")
    if assignment.get("assignee_kind") != "contact":
        raise CostRefused(409, "not_external")
    claim = store_costs.claim_for_assignment(conn, assignment["id"])
    if claim is not None and claim["status"] != "awaiting":
        raise CostRefused(409, "claim_already_submitted")
    store.update_assignment(conn, assignment["id"], {"cost_claim": m})
    if claim is not None:
        now = iso(at)
        if m == "off":
            store_costs.update_claim(conn, claim["id"], {"required": 0, "claim_until": now}, now=now)
        else:
            store_costs.update_claim(conn, claim["id"], {"required": 1 if m == "required" else 0}, now=now)
        store_costs.insert_decision(conn, {"claim_id": claim["id"], "action": "requirement", "reason": m, "by_user": by, "at": now})
    elif m != "off" and ticket.get("status") in ("done", "closed") and ticket.get("current_assignment_id") in (assignment["id"], None) and assignment.get("ended_at") is None:
        ensure_claim(conn, ticket, {**assignment, "cost_claim": m}, at=at)
    refresh_ticket(conn, ticket["id"])


def ensure_for_on_behalf(conn, ticket: Mapping[str, Any], assignment_id: str | None, at: dt.datetime) -> dict[str, Any]:
    """"הזנת דרישה בשם הספק": the claim of the given (or the latest) external assignment of the ticket, created when none exists."""
    asgs = [a for a in store.assignments(conn, ticket["id"]) if a["assignee_kind"] == "contact"]
    if assignment_id:
        asgs = [a for a in asgs if a["id"] == assignment_id]
    if not asgs:
        raise CostRefused(409, "no_external_assignment")
    asg = asgs[-1]
    claim = store_costs.claim_for_assignment(conn, asg["id"])
    if claim is not None:
        return claim
    s = cost_settings(conn)
    contact, _v = _contact_pair(conn, asg["contact_id"])
    now = iso(at)
    mode = assignment_mode(conn, ticket, asg)
    dept = store.department_any(conn, ticket["department_id"])
    cid = store_costs.insert_claim(conn, {
        "ticket_id": ticket["id"], "department_id": ticket["department_id"], "assignment_id": asg["id"], "contact_id": asg["contact_id"],
        "required": 1 if mode == "required" else 0, "status": "awaiting",
        "currency": contact.get("rate_currency") if contact.get("rate_currency") in s.currencies else s.currencies[0],
        "claim_until": iso(at + dt.timedelta(days=window_days(conn, dept))),
        "snapshot_json": json.dumps(_snapshot(conn, ticket, asg), ensure_ascii=False, separators=(",", ":")), "created_at": now, "updated_at": now,
    })
    return store_costs.claim(conn, cid) or {}


# ---------------------------------------------------------------- hooks: vendor messages, CR-018, payment, OCR

def vendor_message(conn, claim: Mapping[str, Any], purpose: str, *, requested_by: str) -> dict[str, Any]:
    """`cost_rejected` / `cost_approved` / `cost_reopened` to the vendor through the ticket message channel (external.DISPATCH -
    slice 5b's outbox; until it exists nothing is queued and the timeline says so). No amount ever travels in a message."""
    from . import messaging

    lk = store_links.link_for_assignment(conn, claim["assignment_id"])
    contact = store_links.contact(conn, claim["contact_id"])
    ticket = store_costs.ticket_row(conn, claim.get("ticket_id"))
    if lk is None or contact is None or ticket is None or contact.get("erased_at"):
        return {"queued": False, "channel": None}
    result: dict[str, Any] = {"queued": False, "channel": None}
    rt = messaging.RUNTIME
    try:
        channel = messaging.plan_channel(conn, contact, rt.data_dir)
        if channel != "manual" and rt.outbox is not None:
            n = store_costs.decision_count(conn, claim["id"], {"cost_rejected": "reject", "cost_approved": "approve",
                                                                "cost_reopened": "reopen_window"}[purpose])
            row = rt.enqueue(conn, purpose=purpose, contact_id=contact["id"], ticket_id=ticket["id"], assignment_id=claim["assignment_id"],
                             link_id=lk["id"], department_id=ticket["department_id"], params=messaging.message_params(conn, ticket, contact),
                             channel=channel, requested_by=requested_by, idempotency_key=f"{purpose}:{claim['id']}:{n}")
            result = {"queued": True, "channel": channel, "outbox_id": getattr(row, "id", None)}
        else:
            result = {"queued": False, "channel": channel}
    except Exception:  # noqa: BLE001 - a message must never fail the decision it reports
        log.warning("cost message %s was not queued", purpose, exc_info=True)
    store.insert_event(conn, claim["ticket_id"], "cost_message", actor_kind="system", actor_name="", assignment_id=claim["assignment_id"],
                       data={"purpose": purpose, "queued": bool(result.get("queued")), "channel": result.get("channel")})
    return result


def emit_cost_event(kind: str, claim: Mapping[str, Any]) -> None:
    """11A.9 - THE payment hook: called after every approval, mark-paid and unmark (inside their transaction). Release 1 raises the
    CR-018 hook only; a later payment / accounting integration subscribes here (`SUBSCRIBERS`) or reads "approved, not paid"
    through the report API. A subscriber must not raise; one that does is logged and ignored."""
    for fn in list(SUBSCRIBERS):
        try:
            fn(kind, dict(claim))
        except Exception:  # noqa: BLE001
            log.warning("cost event subscriber failed for %s", kind, exc_info=True)


SUBSCRIBERS: list[Callable[[str, dict[str, Any]], None]] = []


def on_document_ready(document: Mapping[str, Any]) -> None:
    """11A.6A - THE OCR hook: called when a revision with documents is stored. Release 1 does nothing (`ocr_status` stays NULL);
    a later OCR step could prefill lines or check totals against the invoice (18A)."""
    return None


# ---------------------------------------------------------------- the claim window's end (janitor step)

def tick(conn, now: dt.datetime) -> int:
    """A required claim whose window passed without a submission: the ticket goes to "ממתין לי" (`claim_missing`) once and the
    managers' CR-018 hook `cost_missing` is raised once (`missing_at`)."""
    n = 0
    for c in store_costs.windows_passed(conn, iso(now)):
        store_costs.update_claim(conn, c["id"], {"missing_at": iso(now)}, now=iso(now))
        if c.get("ticket_id"):
            t = store_costs.ticket_row(conn, c["ticket_id"])
            if t is not None and t["status"] in ("done", "returned", "closed"):
                store.update_ticket(conn, c["ticket_id"], {"waiting_on": "manager", "waiting_reason": "claim_missing"}, bump=False)
            notify_bridge.cost_missing(conn, c["ticket_id"], c["id"])
        n += 1
    return n


# ---------------------------------------------------------------- the contact directory (15.2)

def on_contact_erased(conn, contact_id: str, tombstone: str) -> int:
    """11A.11: a claim is a financial record the organisation must keep - the company name, vendor reference, amounts and files
    stay; the PERSON's name leaves the snapshot (phone and e-mail were never in it)."""
    n = 0
    for row in store_costs.claims_of_contact(conn, contact_id):
        try:
            snap = json.loads(row["snapshot_json"] or "{}")
        except ValueError:
            snap = {}
        if snap.get("contact_kind") == "vendor":
            continue  # a vendor row is a company: its name is the record's
        snap["contact_name"] = tombstone
        store_costs.set_snapshot(conn, row["id"], json.dumps(snap, ensure_ascii=False, separators=(",", ":")))
        n += 1
    return n


def contact_export(conn, contact_id: str) -> list[dict[str, Any]]:
    """15.2: the person's claims in the contact export - status and totals of each revision, never a file's content."""
    out = []
    for c in store_costs.claims_of_contact(conn, contact_id):
        try:
            snap = json.loads(c["snapshot_json"] or "{}")
        except ValueError:
            snap = {}
        out.append({"ticket_number": snap.get("number"), "status": c["status"], "currency": c["currency"],
                    "revisions": [{"seq": r["seq"], "source": r["source"], "total_minor": r["total_minor"], "vat_minor": r["vat_minor"],
                                   "vendor_ref": r.get("vendor_ref"), "notes": r.get("notes") if r["source"] == "vendor" else None,
                                   "lines": _lines(r) if r["source"] == "vendor" else None, "created_at": r["created_at"]}
                                  for r in store_costs.revisions(conn, c["id"])]})
    return out


# ---------------------------------------------------------------- presentation

def _lines(rev: Mapping[str, Any]) -> list[dict[str, Any]]:
    try:
        v = json.loads(rev.get("lines_json") or "[]")
    except ValueError:
        return []
    return v if isinstance(v, list) else []


def _exceptional_view(claim: Mapping[str, Any] | None, rev: Mapping[str, Any], approved_rev: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    from . import quotes

    items = [e for e in quotes.exceptional_of(rev) if isinstance(e, Mapping)]
    if not items:
        return []
    state = quotes.review_state(claim, rev, approved_rev) if claim is not None else "pending"
    return [{**e, "review": state} for e in items]


def present_revision(conn, rev: Mapping[str, Any], *, for_vendor: bool = False, claim: Mapping[str, Any] | None = None,
                     approved_rev: Mapping[str, Any] | None = None) -> dict[str, Any]:
    from . import claim_prefill

    files = store_costs.revision_files(conn, rev["id"])
    docs: dict[int, list[dict[str, Any]]] = {}
    for f in files:
        item: dict[str, Any] = {"id": f["id"], "kind": f["kind"], "bytes": f["bytes"], "name": f.get("name") or ""}
        if not for_vendor:
            item.update({"width": f.get("width"), "height": f.get("height")})
        docs.setdefault(int(f["doc_no"]), []).append(item)
    out: dict[str, Any] = {
        "id": rev["id"], "seq": rev["seq"], "source": rev["source"], "kind": rev["kind"], "based_on": rev.get("based_on"),
        "no_charge": bool(rev["no_charge"]), "lines": _lines(rev), "labor_minor": rev["labor_minor"], "parts_minor": rev["parts_minor"],
        "travel_minor": rev["travel_minor"], "other_minor": rev["other_minor"], "subtotal_minor": rev["subtotal_minor"],
        "vat_mode": rev["vat_mode"], "vat_rate_bp": rev["vat_rate_bp"], "vat_minor": rev["vat_minor"], "total_minor": rev["total_minor"],
        "net_minor": rev["total_minor"] - rev["vat_minor"], "currency": rev["currency"], "vendor_ref": rev.get("vendor_ref"),
        "notes": rev.get("notes"), "created_at": rev["created_at"],
        "documents": [{"no": k, "kind": v[0]["kind"], "pages": v} for k, v in sorted(docs.items())],
        "exceptional": _exceptional_view(claim, rev, approved_rev),  # TKDETAILBE (5.2)
        "basis": claim_prefill.present(rev),  # CR-CLAIM-PREFILL: the approved total / instalment it was compared with, the vendor's reason
    }
    if rev["source"] == "manager":
        out["reason"] = rev.get("reason")
    if not for_vendor:
        out.update({"created_by_kind": rev["created_by_kind"], "created_by_name": store.display_name(conn, rev["created_by"]) if rev["created_by_kind"] == "user" else ""})
    return out


def present_claim(conn, claim: Mapping[str, Any], *, full: bool, now: dt.datetime | None = None) -> dict[str, Any]:
    """One claim for the manager's cost card. `full` = the caller holds tickets.costs.view: amounts, lines, files, history;
    without it the status chip only (11A.8)."""
    now = now or now_utc()
    base: dict[str, Any] = {"id": claim["id"], "assignment_id": claim["assignment_id"], "status": claim["status"], "required": bool(claim["required"]),
                            "claim_until": claim.get("claim_until"), "window_open": window_open(claim, now), "missing": bool(claim.get("missing_at"))}
    if not full:
        return base
    s = cost_settings(conn)
    snap = {}
    try:
        snap = json.loads(claim.get("snapshot_json") or "{}")
    except ValueError:
        pass
    revs = store_costs.revisions(conn, claim["id"])
    current = next((r for r in revs if r["id"] == claim.get("current_revision_id")), None)
    approved_rev = next((r for r in revs if r["id"] == claim.get("approved_revision_id")), None)
    counted = claim.get("approved_total_minor") if claim["status"] in SETTLED else (current or {}).get("total_minor")
    decisions = [{"id": d["id"], "action": d["action"], "revision_id": d.get("revision_id"), "reason": d.get("reason"),
                  "internal_note": d.get("internal_note"), "amount_minor": d.get("amount_minor"),
                  "payment_ref": d.get("payment_ref"), "by": store.display_name(conn, d["by_user"]) if not str(d["by_user"]).startswith("contact:") else "",
                  "at": d["at"]} for d in store_costs.decisions(conn, claim["id"])]
    contact, vendor = _contact_pair(conn, claim["contact_id"])
    base.update({
        "instalment_index": claim.get("instalment_index"),  # CR-CLAIM-PREFILL (0117): the instalment it demands (full view), else null
        "revision": claim["revision"], "currency": claim["currency"], "no_charge": bool(claim["no_charge"]),
        "current_revision_id": claim.get("current_revision_id"), "approved_revision_id": claim.get("approved_revision_id"),
        "approved_total_minor": claim.get("approved_total_minor"), "approved_at": claim.get("approved_at"),
        "approved_by": store.display_name(conn, claim["approved_by"]) if claim.get("approved_by") else None,
        "paid_at": claim.get("paid_at"), "payment_ref": claim.get("payment_ref"), "payment_date": claim.get("payment_date"),
        "total_minor": counted, "high_amount": counted is not None and counted > s.review_flag_above_minor,
        "vendor": snap.get("vendor") or "", "contact_name": snap.get("contact_name") or "",
        "labor_rate_minor": contact.get("labor_rate_minor"), "rate_currency": contact.get("rate_currency"),
        "vat_exempt": bool(contact.get("vat_exempt") or (vendor or {}).get("vat_exempt")),
        "revisions": [present_revision(conn, r, claim=claim, approved_rev=approved_rev) for r in revs], "decisions": decisions,
        "reopen_used": any(d["action"] == "reopen_window" for d in decisions),
    })
    from . import quotes  # TKDETAILBE (5.2): the baseline, the deltas, needs_review

    base.update(quotes.demand_view(conn, claim, revs))
    return base


def public_claim(conn, link_assignment_id: str, now: dt.datetime) -> dict[str, Any]:
    """GET /t/api/claim: what the vendor sees - its own claim only: status, its revisions (totals, lines, the reasons of rejections
    and adjustments), the form settings. Never internal notes, other assignments' claims, other vendors' costs or who decided."""
    claim = focus_claim(conn, link_assignment_id, now)  # CR-CLAIM-PREFILL (0117): the claim his page works on now
    if claim is None:
        return {"status": "none"}
    s = cost_settings(conn)
    contact, vendor = _contact_pair(conn, claim["contact_id"])
    exempt = bool(contact.get("vat_exempt") or (vendor or {}).get("vat_exempt"))
    revs = store_costs.revisions(conn, claim["id"])
    decisions = store_costs.decisions(conn, claim["id"])
    last_reject = next((d for d in reversed(decisions) if d["action"] == "reject"), None)
    approved = next((r for r in revs if r["id"] == claim.get("approved_revision_id")), None)
    writable = claim["status"] in OPEN_STATUSES and window_open(claim, now)
    rate = contact.get("labor_rate_minor")
    if rate is None and vendor is not None:
        rate = vendor.get("labor_rate_minor")
    rate_currency = contact.get("rate_currency") or (vendor or {}).get("rate_currency")
    from . import claim_prefill  # CR-CLAIM-PREFILL: the link's own approved quote (null for an ordinary assignment)

    pre = claim_prefill.prefill(conn, claim)
    idx = claim.get("instalment_index")
    if pre is not None and idx is not None:
        pre["instalment"] = idx
    return {
        "prefill": pre,
        # 0117: the instalment this claim is bound to (then the page does not offer another), and his earlier demands of the assignment
        "instalment_index": idx, "instalment_fixed": idx is not None,
        "claims": [_claim_line(conn, c) for c in store_costs.claims_of_assignment(conn, link_assignment_id) if c["id"] != claim.get("id")],
        "status": claim["status"], "required": bool(claim["required"]), "claim_until": claim.get("claim_until"), "writable": writable,
        "currency": claim["currency"], "no_charge": bool(claim["no_charge"]),
        "rejection_reason": last_reject["reason"] if (last_reject and claim["status"] == "rejected") else None,
        "approved": ({"total_minor": approved["total_minor"], "currency": approved["currency"], "adjusted": approved["kind"] == "adjustment",
                      "reason": approved.get("reason") if approved["kind"] == "adjustment" else None} if approved else None),
        "revisions": [present_revision(conn, r, for_vendor=True, claim=claim, approved_rev=approved) for r in revs if r["source"] == "vendor"],
        "form": {
            "currencies": list(s.currencies), "vat": {"exempt": exempt, "rate_bp": s.vat_rate_bp,
                                                       "default": "none" if exempt else (contact.get("vat_default") or (vendor or {}).get("vat_default") or "excluded")},
            "labor_rate_minor": rate if rate_currency in (None, claim["currency"]) else None,
            "require_invoice": s.require_invoice,
            "limits": {"lines": money.MAX_LINES, "description": money.DESC_MAX, "vendor_ref": VENDOR_REF_MAX, "notes": NOTES_MAX, "documents": 3,
                       "pages": 10, "files": 25, "pdf_bytes": 10 * 1024 * 1024, "photo_bytes": 8 * 1024 * 1024, "max_total_minor": s.max_claim_total_minor,
                       "above_reason": claim_prefill.ABOVE_REASON_MAX},
        },
    }


def _claim_line(conn, c: Mapping[str, Any]) -> dict[str, Any]:
    """One earlier demand of the vendor's assignment on his page: the instalment, the status and the counted amount - nothing else."""
    total = c.get("approved_total_minor") if c["status"] in SETTLED else (store_costs.revision(conn, c.get("current_revision_id")) or {}).get("total_minor")
    return {"instalment_index": c.get("instalment_index"), "status": c["status"], "total_minor": total, "currency": c["currency"]}


def public_summary(conn, assignment_id: str, now: dt.datetime) -> dict[str, Any] | None:
    """The `claim` block of GET /t/api/ticket: whether the page shows the claim step (and whether it is required)."""
    claim = focus_claim(conn, assignment_id, now)
    if claim is None:
        return None
    return {"status": claim["status"], "required": bool(claim["required"]), "writable": claim["status"] in OPEN_STATUSES and window_open(claim, now),
            "claim_until": claim.get("claim_until")}


def ids(rows: Iterable[Mapping[str, Any]]) -> list[str]:
    return [r["id"] for r in rows]
