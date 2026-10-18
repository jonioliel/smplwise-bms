"""CR-CLAIM-PREFILL (docs/changes/CR-CLAIM-PREFILL.md; owner request 2026-10-17): the vendor's payment demand (the 0083 cost claim) is
LOADED from the approved quote of his work order instead of being typed again.

    prefill   GET /t/api/claim `prefill`: the approved quote that is the baseline of the link's OWN assignment (DETAIL 4.2 - an RFQ award
              after its work order, or a quote approved on the handler page): the approved lines only (a partial approval's part), the
              approved figures, the work window and - when the award carried an approved payment schedule (RFQ contract 20.3) - its
              instalments with the instalment a manager opened a demand for (RFQPAY2, 20.11) pre-selected. Null without such a quote:
              an ordinary assignment changes nothing.
    basis     POST /t/api/claim `instalment_index?` / `above_reason?`: what the demand is compared with (the approved total, or one
              instalment of the approved schedule) is stored on the revision (`basis_json`, migration 0115). A vendor's demand ABOVE
              that amount needs a short reason (422 `{field: "above_reason", code: "required"}`); a demand below or with other lines
              is accepted as it is (flag, never refuse).
    check     the managers' claim view `quote_check`: `same` | `differs` with the flags `above_quote` / `below_quote` / `lines_differ`
              / `currency` and the vendor's reason - shown by the existing approval flow; nothing is refused, sent or paid.

Ownership is the link's: the claim is the link's assignment's, the baseline is that assignment's approved quote and must name the same
contact, so another vendor's quote can never be read (other links answer the uniform 404 before this module runs). No bank data is read,
accepted or stored (the strict models refuse unknown keys); amounts come from the stored quote / schedule, never from the client."""
from __future__ import annotations

import json
from typing import Any, Mapping

from . import quotes, rfq_terms, store, store_rfq
from .costs import CostRefused
from .text_hygiene import clean_text

ABOVE_REASON_MAX = 500
_LINE_KEYS = ("kind", "description", "total_minor", "hours", "rate_minor", "quantity", "unit_minor", "amount_minor")


def baseline_for(conn, claim: Mapping[str, Any]) -> dict[str, Any] | None:
    """The approved quote of the claim's own external assignment - and of the same contact (defence in depth) - or None."""
    asg = store.assignment(conn, claim.get("assignment_id"))
    if asg is None or not quotes.quote_capable(conn, asg):
        return None
    q = quotes.baseline(conn, asg["id"])
    if q is None or q.get("contact_id") != claim.get("contact_id") or q.get("approved_total_minor") is None:
        return None
    return q


def _schedule(conn, q: Mapping[str, Any]) -> list[dict[str, Any]]:
    """The approved instalments of the quote (RFQ contract 20.3) with the resolved due day - [] without a schedule."""
    sched = rfq_terms.loads(q.get("payment_schedule_json"))
    if not sched or sched.get("currency") != q.get("currency"):
        return []
    completed = rfq_terms._completed(conn, q)
    out = []
    for it in sched.get("items") or []:
        day = rfq_terms._due_day(conn, it, completed)
        out.append({"index": int(it["index"]), "kind": it["kind"], "amount_minor": int(it["amount_minor"]), "due": it["due"],
                    "date": it.get("date"), "days": it.get("days"), "due_date": day.isoformat() if day else None})
    return out


def prefill(conn, claim: Mapping[str, Any]) -> dict[str, Any] | None:
    """GET /t/api/claim `prefill` (the vendor's own approved quote) - see the module docstring."""
    q = baseline_for(conn, claim)
    if q is None:
        return None
    items = _schedule(conn, q)
    picked = None
    if items:
        from . import store_costs

        # 0116: an instalment that already has its own claim is not offered again as the pre-selection
        taken = {c["instalment_index"] for c in store_costs.claims_of_assignment(conn, claim.get("assignment_id")) if c.get("instalment_index") is not None}
        payable = {it["index"] for it in items if it["amount_minor"] > 0} - taken
        opened = sorted(i for i, d in store_rfq.demands_of_quote(conn, q["id"]).items() if d.get("status") == "open" and i in payable)
        picked = opened[0] if opened else None
    lines = [{k: ln[k] for k in _LINE_KEYS if k in ln} for ln in quotes.approved_lines(q) if isinstance(ln, Mapping)]
    return {
        "version": q["version"], "partial": q["state"] == "partially_approved", "currency": q["currency"], "vat_mode": q["vat_mode"],
        "vat_rate_bp": q["vat_rate_bp"], "lines": lines, "subtotal_minor": q.get("approved_subtotal_minor"),
        "vat_minor": q.get("approved_vat_minor"), "total_minor": q["approved_total_minor"], "work_from": q.get("work_from"),
        "work_to": q.get("work_to"), "instalments": items, "instalment": picked,
    }


def _reason(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", "above_reason")
    text = clean_text(value)
    if len(text) > ABOVE_REASON_MAX:
        raise CostRefused(422, "too_long", "above_reason")
    return text or None


def basis(conn, claim: Mapping[str, Any], base: Mapping[str, Any] | None, *, total_minor: int, currency: str, no_charge: bool,
          body: Mapping[str, Any], vendor: bool) -> dict[str, Any] | None:
    """What a new revision is compared with (stored in `basis_json`), validating `instalment_index` / `above_reason`. Refusals name the
    field (422): `instalment_index` `not_allowed` (no approved quote, a no-charge demand) / `invalid` (not an instalment of the approved
    schedule with an amount) / `type`; `above_reason` `required` (a vendor's demand above the basis), `not_allowed` (not above it),
    `too_long`, `type`."""
    idx = body.get("instalment_index")
    reason = _reason(body.get("above_reason"))
    if idx is not None and (isinstance(idx, bool) or not isinstance(idx, int)):
        raise CostRefused(422, "type", "instalment_index")
    if base is None:
        if idx is not None:
            raise CostRefused(422, "not_allowed", "instalment_index")
        if reason is not None:
            raise CostRefused(422, "not_allowed", "above_reason")
        return None
    basis_minor = int(base["approved_total_minor"])
    if idx is not None:
        if no_charge:
            raise CostRefused(422, "not_allowed", "instalment_index")
        item = next((it for it in _schedule(conn, base) if it["index"] == idx and it["amount_minor"] > 0), None)
        if item is None:
            raise CostRefused(422, "invalid", "instalment_index")
        basis_minor = item["amount_minor"]
    above = not no_charge and currency == base["currency"] and int(total_minor) > basis_minor
    if above and vendor and reason is None:
        raise CostRefused(422, "required", "above_reason")
    if reason is not None and not above:
        raise CostRefused(422, "not_allowed", "above_reason")
    return {"quote_id": base["id"], "basis": "instalment" if idx is not None else "total", "instalment_index": idx,
            "basis_minor": basis_minor, "above_reason": reason}


def loads(rev: Mapping[str, Any] | None) -> dict[str, Any] | None:
    try:
        v = json.loads((rev or {}).get("basis_json") or "null")
    except (ValueError, TypeError):
        return None
    return v if isinstance(v, dict) else None


def present(rev: Mapping[str, Any]) -> dict[str, Any] | None:
    """The `basis` of a revision as both sides see it (the vendor his own reason; never the quote id)."""
    b = loads(rev)
    if b is None:
        return None
    return {"basis": b.get("basis"), "instalment_index": b.get("instalment_index"), "basis_minor": b.get("basis_minor"),
            "above_reason": b.get("above_reason")}


def _line_key(ln: Mapping[str, Any]) -> tuple[str, int]:
    return str(ln.get("kind")), int(ln.get("total_minor") or 0)


def check(base: Mapping[str, Any] | None, rev: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """The managers' `quote_check` of a revision against the approved quote (or the instalment it named) - flags only."""
    if base is None or rev is None or base.get("approved_total_minor") is None:
        return None
    b = loads(rev) or {}
    instalment = b.get("basis") == "instalment" and b.get("basis_minor") is not None
    basis_minor = int(b["basis_minor"]) if instalment else int(base["approved_total_minor"])
    total = int(rev["total_minor"])
    flags: list[str] = []
    delta: int | None = None
    if rev.get("currency") != base.get("currency"):
        flags.append("currency")
    else:
        delta = total - basis_minor
        if delta > 0:
            flags.append("above_quote")
        elif delta < 0:
            flags.append("below_quote")
        if not instalment and not rev.get("no_charge") and quotes.same_line_basis(base, rev):
            try:
                mine = sorted(_line_key(x) for x in json.loads(rev.get("lines_json") or "[]"))
            except (ValueError, TypeError, AttributeError):
                mine = []
            if mine != sorted(_line_key(x) for x in quotes.approved_lines(base)):
                flags.append("lines_differ")
    return {"status": "differs" if flags else "same", "flags": flags, "basis": "instalment" if instalment else "total",
            "instalment_index": b.get("instalment_index") if instalment else None, "basis_minor": basis_minor, "demand_minor": total,
            "delta_minor": delta, "currency": base.get("currency"), "quote_version": base.get("version"), "above_reason": b.get("above_reason")}

