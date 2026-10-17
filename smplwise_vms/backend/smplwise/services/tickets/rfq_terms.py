"""CR-RFQ-PAYMENT-SCHEDULE (docs/changes/CR-RFQ-PAYMENT-SCHEDULE.md; RFQ contract section 20): the vendor's PAYMENT SCHEDULE and his
ARRIVAL CONFIRMATION for an award. Behind the installation switch `tickets.settings.rfq.schedule_arrival` (default OFF: nothing here
runs, no answer changes, an upgrade changes no behaviour).

    proposal   with his quote the vendor may propose instalments: an advance (fixed amount or percent, on a date), up to four progress
               instalments (the same), and the final instalment = the remainder, due on completion, on a date, or N days after
               completion. Stored normalised on the quote (`ticket_quotes.payment_plan_json`).
    approval   the award (the existing flow, incl. partial / split approval) approves the schedule: the vendor's proposal as is, or the
               manager's edited one. Percents become exact amounts of the APPROVED total (VAT included) at that moment:
               floor(total x percent_bp / 10000) each, and the final instalment takes the remainder - so the instalments always sum to
               the approved total exactly (rounding rule `floor_final`). No proposal and no edit = one final instalment on completion;
               over a proposal the award must say which (`payment` or `payment_source`, review F1 - silence approves nothing).
               The approved schedule is stored with the award (`ticket_rfq_award_terms`) and, once the award is final, on the quote
               (`payment_schedule_json`, the ticket's baseline after the work order - it survives a purge of the request).
    arrival    after the award is final the vendor confirms on his personal RFQ link that he will come on the planned date/window
               (the awarded quote's dates, else the request's wanted window, else the manager's date at the award), or proposes another
               date that an RFQ manager accepts or rejects. Either act also records his acknowledgement of the approved schedule. A
               reminder (an `rfq_update` notice + a thread message - existing purposes, existing send-hours rules) goes when he has not
               confirmed `arrival_reminder_hours` after he was told (a queued award notice or the sent work order), at most twice;
               one delay after the second one the RFQ managers are notified once (the work order is never blocked).
    demand     the cost claim of the order's assignment is CHECKED against the approved schedule (a demand above the schedule's total,
               or above what is due by its submission date, is FLAGGED for the manager - never refused).
    later (C)  `on_arrival_confirmed` is the extension point for the personal access code / door windows of the work (WisKey) - it does
               nothing in this version.

Arx never initiates or executes a payment: it records agreed dates and amounts and compares a demand with them. No bank data, ever.
Timeline and audit rows carry ids, states, counts (and the dates of a confirmation) - never an amount on the public side, never a text."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from typing import Any, Mapping

from . import money, rfq_notify, settings_doc, store, store_quotes, store_rfq
from .costs import CostRefused, iso, parse

KINDS = ("advance", "progress", "final")
DUE_RULES = ("date", "completion", "after_completion")
MAX_ITEMS = 6  # one advance + four progress + the final
DAYS_MAX = 180
HORIZON_DAYS = 366
MAX_REMINDERS = 2
ROUNDING = "floor_final"
DEFAULT_PLAN: dict[str, Any] = {"items": [{"kind": "final", "due": "completion"}]}
_PERCENT = re.compile(r"^(\d{1,3})(?:\.(\d{1,2}))?$")
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
OPEN_RFQ = ("awarded", "ordered")
PAYMENT_SOURCES = ("vendor", "default")  # the award's explicit choice when it carries no edited plan (review F1)


# ---------------------------------------------------------------- settings

def enabled(conn) -> bool:
    return settings_doc.read(conn)["rfq"].get("schedule_arrival") is True


def reminder_hours(conn) -> int:
    return int(settings_doc.read(conn)["rfq"].get("arrival_reminder_hours") or 0)


def _tz(conn):
    from .messaging import time_zone

    return time_zone(conn)


def today(conn, now: dt.datetime) -> dt.date:
    return now.astimezone(_tz(conn)).date()


def local_day(conn, value: str | None) -> dt.date | None:
    at = parse(value)
    return at.astimezone(_tz(conn)).date() if at is not None else None


# ---------------------------------------------------------------- the plan (vendor's proposal or the manager's edit)

def _percent_bp(value: Any, field: str) -> int:
    if not isinstance(value, str):
        raise CostRefused(422, "type", field)
    m = _PERCENT.fullmatch(value.strip())
    if m is None:
        raise CostRefused(422, "format", field)
    bp = int(m.group(1)) * 100 + int((m.group(2) or "").ljust(2, "0") or "0")
    if not 1 <= bp <= 10000:
        raise CostRefused(422, "range", field)
    return bp


def _date(value: Any, field: str, first: dt.date) -> str:
    if not isinstance(value, str) or not _DAY.fullmatch(value):
        raise CostRefused(422, "format", field)
    try:
        d = dt.date.fromisoformat(value)
    except ValueError:
        raise CostRefused(422, "format", field) from None
    if d < first or d > first + dt.timedelta(days=HORIZON_DAYS):
        raise CostRefused(422, "range", field)
    return d.isoformat()


def parse_plan(raw: Any, *, first_day: dt.date) -> dict[str, Any] | None:
    """The wire form `{items: [{kind, percent? | amount?, due, date?, days?}]}` -> the normalised plan (None for no plan). Every check
    names its field (`payment.items.<i>.<field>`); the caller turns CostRefused into its own 422."""
    if raw is None:
        return None
    if not isinstance(raw, Mapping) or set(raw) - {"items"}:
        raise CostRefused(422, "invalid", "payment")
    items = raw.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ITEMS:
        raise CostRefused(422, "count", "payment.items")
    out: list[dict[str, Any]] = []
    last_date: str | None = None
    for i, it in enumerate(items):
        f = f"payment.items.{i}"
        if not isinstance(it, Mapping) or set(it) - {"kind", "percent", "amount", "due", "date", "days"}:
            raise CostRefused(422, "invalid", f)
        kind = it.get("kind")
        if kind not in KINDS:
            raise CostRefused(422, "invalid", f"{f}.kind")
        final = i == len(items) - 1
        if (kind == "final") != final:
            raise CostRefused(422, "final_last", f"{f}.kind")  # exactly one final instalment, the last one
        if kind == "advance" and i != 0:
            raise CostRefused(422, "advance_first", f"{f}.kind")
        due = it.get("due")
        norm: dict[str, Any] = {"kind": kind}
        if final:
            if it.get("percent") is not None or it.get("amount") is not None:
                raise CostRefused(422, "final_is_remainder", f)  # the final instalment is the remainder (exact sum by construction)
            if due not in DUE_RULES:
                raise CostRefused(422, "invalid", f"{f}.due")
            norm["due"] = due
            if due == "date":
                norm["date"] = _date(it.get("date"), f"{f}.date", first_day)
                if last_date and norm["date"] < last_date:
                    raise CostRefused(422, "order", f"{f}.date")
            elif it.get("date") is not None:
                raise CostRefused(422, "invalid", f"{f}.date")
            if due == "after_completion":
                days = it.get("days")
                if isinstance(days, bool) or not isinstance(days, int) or not 0 <= days <= DAYS_MAX:
                    raise CostRefused(422, "range", f"{f}.days")
                norm["days"] = days
            elif it.get("days") is not None:
                raise CostRefused(422, "invalid", f"{f}.days")
        else:
            pct, amt = it.get("percent"), it.get("amount")
            if (pct is None) == (amt is None):
                raise CostRefused(422, "share_required", f)  # exactly one of percent / amount
            if pct is not None:
                norm["percent_bp"] = _percent_bp(pct, f"{f}.percent")
            else:
                try:
                    minor = money.parse_amount(amt, f"{f}.amount")
                except money.MoneyError as exc:
                    raise CostRefused(422, exc.code, f"{f}.amount") from None
                if minor <= 0:
                    raise CostRefused(422, "range", f"{f}.amount")
                norm["amount_minor"] = minor
            if due != "date" or it.get("days") is not None:
                raise CostRefused(422, "invalid", f"{f}.due")  # an advance / progress instalment is due on a date
            norm["due"] = "date"
            norm["date"] = _date(it.get("date"), f"{f}.date", first_day)
            if last_date and norm["date"] < last_date:
                raise CostRefused(422, "order", f"{f}.date")
            last_date = norm["date"]
        out.append(norm)
    if sum(int(x.get("percent_bp") or 0) for x in out) > 10000:
        raise CostRefused(422, "exceeds_total", "payment.items")
    return {"items": out}


def loads(raw: str | None) -> dict[str, Any] | None:
    try:
        v = json.loads(raw) if raw else None
    except ValueError:
        return None
    return v if isinstance(v, dict) and isinstance(v.get("items"), list) else None


def convert(plan: Mapping[str, Any] | None, total_minor: int, currency: str) -> dict[str, Any]:
    """Exact amounts of an approved total (integers only): each percent instalment = floor(total x bp / 10000), each fixed amount as
    given, the final = the remainder. Refused (422 `payment.items`): fixed + percent instalments above the total (`exceeds_total`), or an
    instalment that rounds to zero (`zero_amount`). The result always sums to `total_minor` exactly."""
    items = list((plan or DEFAULT_PLAN)["items"])
    out: list[dict[str, Any]] = []
    used = 0
    for i, it in enumerate(items):
        if it["kind"] == "final":
            continue
        amount = int(it["amount_minor"]) if it.get("amount_minor") is not None else (int(total_minor) * int(it["percent_bp"])) // 10000
        if amount <= 0:
            raise CostRefused(422, "zero_amount", f"payment.items.{i}")
        used += amount
        out.append({"index": i, "kind": it["kind"], "amount_minor": amount, "percent_bp": it.get("percent_bp"), "due": "date",
                    "date": it["date"], "days": None})
    if used > int(total_minor):
        raise CostRefused(422, "exceeds_total", "payment.items")
    final = items[-1]
    out.append({"index": len(items) - 1, "kind": "final", "amount_minor": int(total_minor) - used, "percent_bp": None, "due": final["due"],
                "date": final.get("date"), "days": final.get("days")})
    return {"currency": currency, "total_minor": int(total_minor), "rounding": ROUNDING, "items": out}


def present_plan(plan: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """The vendor's proposal as he gave it (percent as a decimal string, fixed amounts in minor units)."""
    if not plan:
        return None
    items = []
    for it in plan["items"]:
        row = {"kind": it["kind"], "due": it["due"], "date": it.get("date"), "days": it.get("days"),
               "percent": None if it.get("percent_bp") is None else _bp_text(int(it["percent_bp"])), "amount_minor": it.get("amount_minor")}
        items.append(row)
    return {"items": items}


def _bp_text(bp: int) -> str:
    whole, frac = divmod(bp, 100)
    return f"{whole}" if not frac else f"{whole}.{frac:02d}".rstrip("0")


# ---------------------------------------------------------------- the award's terms

def _arrival_window(conn, row: Mapping[str, Any], q: Mapping[str, Any], arrival: Mapping[str, Any] | None, now: dt.datetime) -> tuple[str | None, str | None]:
    from .quotes import _instant

    if arrival:
        wf = _instant(arrival.get("work_from"), "arrival.work_from", now)
        wt = _instant(arrival.get("work_to"), "arrival.work_to", now)
        if wf is None:
            raise CostRefused(422, "required", "arrival.work_from")
        if wt and wt < wf:
            raise CostRefused(422, "order", "arrival.work_to")
        return wf, wt
    if q.get("work_from"):
        return q["work_from"], q.get("work_to")
    return row.get("work_from"), row.get("work_to")


def _proposal_still_valid(plan: Mapping[str, Any], first_day: dt.date) -> None:
    """Review F3: the vendor's stored proposal was range-checked when he quoted; at the award its dates must still be today or later -
    the rule an edited plan meets (`_date`), so "accept as proposed" and "edit" never differ. Refused as `proposal_date_passed` on the
    instalment's date field (the dialog opens the editor)."""
    for i, it in enumerate(plan.get("items") or []):
        day = it.get("date")
        if day and dt.date.fromisoformat(day) < first_day:
            raise CostRefused(422, "proposal_date_passed", f"payment.items.{i}.date")


def prepare(conn, row: Mapping[str, Any], q: Mapping[str, Any], *, total_minor: int, currency: str, payment: Any, arrival: Any,
            now: dt.datetime, payment_source: str | None = None) -> dict[str, Any] | None:
    """At the award, BEFORE the award writes anything: the approved schedule converted to exact amounts of the approved total, and the
    planned arrival window. Every refusal (CostRefused 422) happens here. None while the switch is off - and a schedule / choice /
    arrival in the body is then refused (422 `disabled`), so a client never believes it agreed terms the server ignored.

    The schedule is an EXPLICIT choice whenever the vendor proposed one (review F1 - silence never approves the counter-party's
    figures, so a stale tab or an old client cannot approve his advance): `payment` = the manager's plan (source `manager`);
    `payment_source: "vendor"` = his proposal as is (source `vendor`, re-validated: F3 dates, F4 `proposal_*` codes);
    `payment_source: "default"` = one final instalment on completion. A proposal and neither -> 422 `payment` `required`. Without a
    proposal, omission = the default (D7) and `vendor` is 422 `payment_source` `no_proposal`; both fields -> `payment_source` `conflict`."""
    if not enabled(conn):
        if payment is not None or arrival is not None or payment_source is not None:
            raise CostRefused(422, "disabled", "payment" if payment is not None else "arrival" if arrival is not None else "payment_source")
        return None
    if arrival is not None and not isinstance(arrival, Mapping):
        raise CostRefused(422, "invalid", "arrival")
    if payment_source is not None and payment_source not in PAYMENT_SOURCES:
        raise CostRefused(422, "invalid", "payment_source")
    if payment is not None and payment_source is not None:
        raise CostRefused(422, "conflict", "payment_source")
    proposal = loads(q.get("payment_plan_json"))
    first_day = today(conn, now)
    if payment is not None:
        plan, source = parse_plan(payment, first_day=first_day), "manager"
    elif payment_source == "vendor":
        if not proposal:
            raise CostRefused(422, "no_proposal", "payment_source")
        _proposal_still_valid(proposal, first_day)
        plan, source = proposal, "vendor"
    elif payment_source == "default" or not proposal:
        plan, source = None, "default"
    else:
        raise CostRefused(422, "required", "payment")
    try:
        schedule = convert(plan, int(total_minor), currency)
    except CostRefused as exc:
        if source != "vendor":
            raise
        raise CostRefused(422, f"proposal_{exc.code}", exc.field) from None  # F4: a specific code - the dialog opens the editor
    wf, wt = _arrival_window(conn, row, q, arrival, now)
    return {"rfq_id": row["id"], "currency": currency, "total_minor": int(total_minor), "schedule_json": store_rfq.dumps(schedule),
            "schedule_source": source, "arrival_state": "awaiting", "planned_from": wf, "planned_to": wt}


def store_prepared(conn, prepared: Mapping[str, Any] | None, award_id: str, rfq_vendor_id: str, now: dt.datetime) -> None:
    if prepared is None:
        return
    at = iso(now)
    store_rfq.insert_terms(conn, {**prepared, "award_id": award_id, "rfq_vendor_id": rfq_vendor_id, "created_at": at, "updated_at": at})


def quote_plan(conn, body: Mapping[str, Any], now: dt.datetime) -> str | None:
    """A quote's `payment` (the vendor's page or the manager on his behalf) -> the stored proposal JSON. 422 `disabled` while off."""
    raw = body.get("payment")
    if raw is None:
        return None
    if not enabled(conn):
        raise CostRefused(422, "disabled", "payment")
    plan = parse_plan(raw, first_day=today(conn, now))
    return store_rfq.dumps(plan) if plan else None


def activate(conn, award: Mapping[str, Any], q: Mapping[str, Any], *, by_kind: str, by: str, by_name: str, now: dt.datetime) -> None:
    """The award became final: the approved schedule moves onto the quote (the baseline) and the arrival confirmation opens."""
    t = store_rfq.terms(conn, award["id"])
    if t is None:
        return
    at = iso(now)
    store_quotes.update_quote(conn, q["id"], {"payment_schedule_json": t["schedule_json"]}, now=at)
    sched = loads(t["schedule_json"]) or {"items": []}
    store_rfq.insert_event(conn, award["rfq_id"], "terms_set", actor_kind=by_kind, actor_user_id=by if by_kind == "user" else None,
                           actor_name=by_name, rfq_vendor_id=award["rfq_vendor_id"],
                           data={"award_id": award["id"], "items": len(sched["items"]), "source": t["schedule_source"]}, at=at)


def drop(conn, award_id: str) -> None:
    store_rfq.delete_terms(conn, award_id)


def requested(conn, award_id: str | None, *, via: str, now: dt.datetime) -> bool:
    """The vendor was TOLD (an `award`-sourced thread message whose `rfq_update` notice was queued, or the work `order` that was sent)
    and the award is final: the reminder clock starts (once; a rejected proposal clears it so the next notice restarts it)."""
    t = store_rfq.terms(conn, award_id) if award_id else None
    if t is None or t.get("requested_at") or t["arrival_state"] == "confirmed" or _final_award(conn, t) is None:
        return False  # review F6: never while the award waits for the second approval (the callers pass only a queued notice)
    at = iso(now)
    store_rfq.update_terms(conn, t["award_id"], {"requested_at": at, "updated_at": at})
    store_rfq.insert_event(conn, t["rfq_id"], "arrival_requested", rfq_vendor_id=t["rfq_vendor_id"], data={"award_id": t["award_id"], "via": via},
                           at=at)
    return True


def _final_award(conn, t: Mapping[str, Any]) -> dict[str, Any] | None:
    a = store_rfq.award(conn, t["award_id"])
    return a if a is not None and a["state"] == "approved" else None


def schedule_hash(t: Mapping[str, Any]) -> str:
    """Review F10: the content hash of the approved schedule (sha256 of the stored canonical JSON) - an acknowledgement is bound to it."""
    return hashlib.sha256(str(t["schedule_json"]).encode("utf-8")).hexdigest()


def acknowledged_at(t: Mapping[str, Any]) -> str | None:
    """The acknowledgement counts only for the schedule it was given for (a changed schedule reads as unacknowledged)."""
    return t.get("acknowledged_at") if t.get("acknowledged_at") and t.get("acknowledged_hash") == schedule_hash(t) else None


def schedule_of(t: Mapping[str, Any]) -> dict[str, Any]:
    return loads(t["schedule_json"]) or {"currency": t["currency"], "total_minor": t["total_minor"], "items": []}


def _arrival(t: Mapping[str, Any]) -> dict[str, Any]:
    return {"state": t["arrival_state"], "planned_from": t.get("planned_from"), "planned_to": t.get("planned_to"),
            "proposed_from": t.get("proposed_from"), "proposed_to": t.get("proposed_to"), "rejected_at": t.get("rejected_at"),
            "confirmed_at": t.get("confirmed_at"), "confirmed_by": t.get("confirmed_by"), "acknowledged_at": acknowledged_at(t),
            "requested_at": t.get("requested_at"), "reminders": int(t.get("reminders") or 0), "escalated_at": t.get("escalated_at")}


def present(conn, award: Mapping[str, Any], *, amounts: bool, manager: bool) -> dict[str, Any] | None:
    """The award's `terms` block for the managers' detail. Amounts only for tickets.costs.view (else the dates and kinds only)."""
    t = store_rfq.terms(conn, award["id"])
    if t is None:
        return None
    sched = schedule_of(t)
    items = [{**it, "amount_minor": it["amount_minor"] if amounts else None, "percent_bp": it.get("percent_bp") if amounts else None}
             for it in sched["items"]]
    q = store_quotes.quote(conn, award["quote_id"]) or {}
    out = {"schedule": {"currency": sched.get("currency"), "total_minor": sched.get("total_minor") if amounts else None,
                        "rounding": sched.get("rounding", ROUNDING), "items": items, "source": t["schedule_source"]},
           "proposal": present_plan(loads(q.get("payment_plan_json"))) if amounts else None,
           "arrival": _arrival(t), "revision": t["revision"],
           "draft": (rejection_draft(conn, award) if manager and award["state"] == "approved" and t["arrival_state"] == "awaiting"
                     and t.get("rejected_at") and not t.get("requested_at") else None),
           "can": {"decide_arrival": manager and award["state"] == "approved" and t["arrival_state"] == "proposed"}}
    return out


REJECT_TEXT = {
    "he": "המועד שהצעתם להגעה לביצוע העבודה לא אושר. נא לאשר בדף ההצעה את המועד המתוכנן או להציע מועד אחר.",
    "en": "The arrival date you proposed for the work was not approved. Please confirm the planned date on the quote page or propose another date.",
    "ar": "لم تتم الموافقة على موعد الوصول الذي اقترحتموه لتنفيذ العمل. يرجى تأكيد الموعد المخطط في صفحة العرض أو اقتراح موعد آخر.",
    "ru": "Предложенная вами дата прибытия для выполнения работ не утверждена. Подтвердите запланированную дату на странице предложения или предложите другую.",
}


def rejection_draft(conn, award: Mapping[str, Any]) -> dict[str, Any]:
    """Review F7: after a manager rejected the vendor's proposed date, the editable notice in his language (no amount, no date) - the
    award-draft pattern: the reject itself sends nothing; the manager sends this with the vendor-message route (`source` = the award),
    which queues the existing templated `rfq_update` and restarts the reminder clock. Offered until a notice was queued."""
    from . import store_links

    v = store_rfq.vendor(conn, award["rfq_vendor_id"]) or {}
    contact = store_links.contact(conn, v.get("contact_id")) or {}
    lang = contact.get("lang") if contact.get("lang") in REJECT_TEXT else "he"
    return {"text": REJECT_TEXT[lang], "lang": lang, "notify_default": True,
            "send": {"route": f"POST /tickets/rfqs/{award['rfq_id']}/vendors/{v.get('id')}/messages",
                     "source": {"kind": "award", "id": award["id"]}}}


# ---------------------------------------------------------------- the vendor's side (his own award only; the link is the authority)

def vendor_block(conn, row: Mapping[str, Any], v: Mapping[str, Any], *, read_only: bool) -> dict[str, Any] | None:
    """`terms` of GET /t/api/rfq: only for the vendor whose APPROVED award has terms (never for another vendor - he never learns that
    an award exists). His schedule (amounts of HIS award), the planned window, the state, and what he may do."""
    a = next((x for x in store_rfq.awards_of(conn, row["id"]) if x["rfq_vendor_id"] == v["id"] and x["state"] == "approved"), None)
    t = store_rfq.terms(conn, a["id"]) if a else None
    if t is None:
        return None
    sched = schedule_of(t)
    open_ = not read_only and row["state"] in OPEN_RFQ and v["state"] == "awarded"
    return {"schedule": {"currency": sched.get("currency"), "total_minor": sched.get("total_minor"), "hash": schedule_hash(t),
                         "items": [{"kind": it["kind"], "amount_minor": it["amount_minor"], "due": it["due"], "date": it.get("date"),
                                    "days": it.get("days")} for it in sched["items"]]},
            "arrival": {"state": t["arrival_state"], "planned_from": t.get("planned_from"), "planned_to": t.get("planned_to"),
                        "proposed_from": t.get("proposed_from"), "proposed_to": t.get("proposed_to"),
                        "rejected": bool(t.get("rejected_at")) and t["arrival_state"] == "awaiting",
                        "confirmed_at": t.get("confirmed_at"), "acknowledged_at": acknowledged_at(t)},
            "can": {"confirm": open_ and t["arrival_state"] == "awaiting" and bool(t.get("planned_from")),
                    "propose": open_ and t["arrival_state"] in ("awaiting", "proposed")}}


def _vendor_terms(conn, row: Mapping[str, Any], v: Mapping[str, Any]) -> dict[str, Any]:
    """The terms a vendor's write acts on - one refusal for every other case (no award, another vendor's, a pending second approval,
    a request that ended): 409 `arrival_closed`. Nothing tells him why (he never learns about anyone else's award)."""
    from .rfq_vendor import VendorRefused

    a = next((x for x in store_rfq.awards_of(conn, row["id"]) if x["rfq_vendor_id"] == v["id"] and x["state"] == "approved"), None)
    t = store_rfq.terms(conn, a["id"]) if a else None
    if t is None or row["state"] not in OPEN_RFQ or v["state"] != "awarded":
        raise VendorRefused(409, "arrival_closed")
    return t


def vendor_act(conn, link: Any, body: Mapping[str, Any], now: dt.datetime) -> dict[str, Any]:
    """POST /t/api/rfq/arrival: `confirm` the planned window, or `propose` another (`work_from`, `work_to`?). Both record his
    acknowledgement of the approved schedule (`acknowledge_schedule: true` is required)."""
    from .quotes import _instant
    from .rfq_vendor import VendorRefused, _audit, _fresh, _name

    row, v = _fresh(conn, link)
    t = _vendor_terms(conn, row, v)
    action = body.get("action")
    if body.get("acknowledge_schedule") is not True:
        raise VendorRefused(422, "invalid", fields=[{"field": "acknowledge_schedule", "code": "required"}])
    digest = schedule_hash(t)
    if body.get("schedule_hash") is not None and body.get("schedule_hash") != digest:
        raise VendorRefused(409, "terms_changed")  # review F10: he acknowledges only the terms he was shown (his own terms - no oracle)
    at = iso(now)
    fields: dict[str, Any] = {"acknowledged_at": acknowledged_at(t) or at, "acknowledged_hash": digest, "updated_at": at}
    if action == "confirm":
        if body.get("work_from") is not None or body.get("work_to") is not None:
            raise VendorRefused(422, "invalid", fields=[{"field": "work_from", "code": "not_allowed"}])
        if t["arrival_state"] != "awaiting":
            raise VendorRefused(409, "arrival_closed")
        if not t.get("planned_from"):
            raise VendorRefused(409, "arrival_date_missing")  # nothing to confirm: he proposes a date
        fields.update({"arrival_state": "confirmed", "confirmed_at": at, "confirmed_by": "vendor"})
        kind, data = "arrival_confirmed", {"award_id": t["award_id"], "by": "vendor", "work_from": t["planned_from"], "work_to": t.get("planned_to")}
    elif action == "propose":
        if t["arrival_state"] not in ("awaiting", "proposed"):
            raise VendorRefused(409, "arrival_closed")
        try:
            wf = _instant(body.get("work_from"), "work_from", now)
            wt = _instant(body.get("work_to"), "work_to", now)
        except CostRefused as exc:
            raise VendorRefused(422, "invalid", fields=[{"field": exc.field or "work_from", "code": exc.code}]) from None
        if wf is None:
            raise VendorRefused(422, "invalid", fields=[{"field": "work_from", "code": "required"}])
        if wt and wt < wf:
            raise VendorRefused(422, "invalid", fields=[{"field": "work_to", "code": "order"}])
        fields.update({"arrival_state": "proposed", "proposed_from": wf, "proposed_to": wt})
        kind, data = "arrival_proposed", {"award_id": t["award_id"]}
    else:
        raise VendorRefused(422, "invalid", fields=[{"field": "action", "code": "invalid"}])
    if not store_rfq.update_terms(conn, t["award_id"], fields, expect_revision=int(t["revision"])):
        raise VendorRefused(409, "arrival_closed")
    store_rfq.update_rfq(conn, row["id"], {"updated_at": at})  # the managers' copies go stale
    store_rfq.insert_event(conn, row["id"], kind, actor_kind="contact", actor_name=_name(conn, v), rfq_vendor_id=v["id"], data=data, at=at)
    _audit(conn, link, "ticket.rfq.vendor_arrival", row, vendor_id=v["id"], award_id=t["award_id"], arrival_action=action)  # ids only
    rfq_notify.arrival(conn, row, v["id"], "confirmed" if action == "confirm" else "proposed")
    if action == "confirm":
        rfq_notify.arrival_done(conn, row["id"], v["id"])  # review F8: the managers are told; nothing waits on them, so nothing stays open
    fresh = store_rfq.terms(conn, t["award_id"]) or t
    if action == "confirm":
        _on_confirmed(conn, row, fresh, now)
    return vendor_block(conn, row, store_rfq.vendor(conn, v["id"]) or v, read_only=False) or {}


# ---------------------------------------------------------------- the manager's decision on a proposed date

def decide(conn, viewer: Any, seen: Any, award_id: str, action: str, revision: int, rid: str | None = None) -> dict[str, Any]:
    """POST /tickets/rfqs/{id}/awards/{award_id}/arrival `{action: accept | reject, revision}` - an RFQ manager (contract section 6,
    no new permission). Accept: the proposed window becomes the planned one, confirmed (409 `arrival_date_passed` when it starts
    before today - review F9). Reject: back to `awaiting` (he confirms the planned window or proposes again), the reminder count and
    clock reset (F7); nothing is sent by itself - the terms block then offers the editable rejection `draft` the manager may send."""
    from . import rfq

    now = rfq.now_utc()
    rfq.need_manager(conn, viewer, seen, "ticket.rfq.arrival_decide", rid)
    a = rfq.award_of(conn, seen, award_id)
    t = store_rfq.terms(conn, a["id"])
    if t is None or a["state"] != "approved":
        raise rfq._err(conn, 404, "terms_not_found")
    if int(t["revision"]) != int(revision):
        raise rfq._err(conn, 409, "rfq_stale", revision=t["revision"])
    if t["arrival_state"] != "proposed" or seen.row["state"] not in OPEN_RFQ:
        raise rfq._err(conn, 409, "arrival_not_proposed")
    at = iso(now)
    if action == "accept" and (local_day(conn, t.get("proposed_from")) or today(conn, now)) < today(conn, now):
        raise rfq._err(conn, 409, "arrival_date_passed")  # review F9: never confirm a window already past (reject; he proposes again)
    if action == "accept":
        fields = {"arrival_state": "confirmed", "planned_from": t["proposed_from"], "planned_to": t.get("proposed_to"), "confirmed_at": at,
                  "confirmed_by": "manager", "decided_by": viewer.uid, "decided_at": at, "updated_at": at}
        kind, data = "arrival_confirmed", {"award_id": a["id"], "by": "manager", "work_from": t["proposed_from"], "work_to": t.get("proposed_to")}
    elif action == "reject":
        # review F7: the reminders start over and the clock waits for the notice the manager actually sends (the block's `draft`)
        fields = {"arrival_state": "awaiting", "proposed_from": None, "proposed_to": None, "rejected_at": at, "decided_by": viewer.uid,
                  "decided_at": at, "updated_at": at, "reminders": 0, "reminded_at": None, "requested_at": None, "escalated_at": None}
        kind, data = "arrival_rejected", {"award_id": a["id"]}
    else:
        raise rfq.invalid(conn, "action", "invalid")
    if not store_rfq.update_terms(conn, a["id"], fields, expect_revision=int(revision)):
        raise rfq._err(conn, 409, "rfq_stale", revision=t["revision"])
    rfq._touch(conn, seen.row, {}, None, now)
    store_rfq.insert_event(conn, seen.row["id"], kind, actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           rfq_vendor_id=a["rfq_vendor_id"], data=data, at=at)
    rfq._audit(conn, viewer, "ticket.rfq.arrival_decide", seen.row, rid, award_id=a["id"], arrival_action=action)
    rfq_notify.arrival_done(conn, seen.row["id"], a["rfq_vendor_id"])
    fresh = store_rfq.terms(conn, a["id"]) or t
    if action == "accept":
        _on_confirmed(conn, seen.row, fresh, now)
    return fresh


def _on_confirmed(conn, row: Mapping[str, Any], t: Mapping[str, Any], now: dt.datetime) -> None:
    """A confirmed arrival: the order's service request (when it exists) records it on its timeline; then the extension point."""
    q = store_quotes.quote(conn, (store_rfq.award(conn, t["award_id"]) or {}).get("quote_id"))
    if q is not None and q.get("ticket_id"):
        store.insert_event(conn, q["ticket_id"], "rfq_arrival_confirmed", actor_kind="system", actor_user_id=None, actor_name="",
                           assignment_id=q.get("assignment_id"), via="system",
                           data={"rfq_id": row["id"], "award_id": t["award_id"], "work_from": t.get("planned_from"), "work_to": t.get("planned_to")},
                           at=iso(now))
    on_arrival_confirmed(conn, row, t)


def on_arrival_confirmed(conn, row: Mapping[str, Any], terms: Mapping[str, Any]) -> None:
    """EXTENSION POINT (owner item C, NOT BUILT): after the vendor's arrival is confirmed, a later version sends him a personal access
    code and the doors / time windows valid for the work window - it depends on the WisKey absorption (access codes, door groups,
    time profiles). Inputs available here: the request (place: site / building / floor), the award, the confirmed window
    (`planned_from` / `planned_to`), the vendor row. It must stay a separate, explicitly approved action (physical access); this
    version does nothing."""
    return None


# ---------------------------------------------------------------- reminders (the janitor)

def tick(conn, now: dt.datetime) -> int:
    """A vendor messaged `arrival_reminder_hours` ago who has not confirmed (nor proposed) gets a reminder: a message in his thread and
    the templated `rfq_update` notice over his live link (the existing purpose and send-hours rules; never free text outside). At most
    MAX_REMINDERS, spaced by the same delay. Off with the switch or hours = 0."""
    if not enabled(conn):
        return 0
    hours = reminder_hours(conn)
    if hours <= 0:
        return 0
    before = iso(now - dt.timedelta(hours=hours))
    n = 0
    for t in store_rfq.terms_waiting(conn, before, MAX_REMINDERS):
        if int(t.get("reminders") or 0) >= MAX_REMINDERS or (t.get("reminded_at") and t["reminded_at"] > before):
            continue
        if _final_award(conn, t) is None:
            continue
        from . import rfq

        row = rfq.system_row(conn, t["rfq_id"])  # the module's own read (never an answer to a person)
        v = store_rfq.vendor(conn, t["rfq_vendor_id"])
        if row is None or v is None or row["state"] not in OPEN_RFQ or v["state"] != "awarded":
            continue
        _remind(conn, row, v, t, now)
        n += 1
    _escalate(conn, before, iso(now))
    return n


def _escalate(conn, before: str, at: str) -> int:
    """Owner decision (lead, 2026-10-17): a vendor who has not confirmed one delay after his LAST reminder is escalated ONCE to the RFQ
    managers (an `rfq.arrival` row, kind `unconfirmed`; resolved when he confirms or a manager decides). The work order is NOT
    blocked - the manager may order and send it anyway."""
    from . import rfq

    n = 0
    for t in store_rfq.terms_unconfirmed(conn, before, MAX_REMINDERS):
        row = rfq.system_row(conn, t["rfq_id"])
        if row is None:
            continue
        rfq_notify.arrival(conn, row, t["rfq_vendor_id"], "unconfirmed")
        store_rfq.update_terms(conn, t["award_id"], {"escalated_at": at, "updated_at": at})
        n += 1
    return n


REMINDER_TEXT = {
    "he": "תזכורת: נא לאשר בדף הזה את מועד ההגעה לביצוע העבודה (או להציע מועד אחר) ואת לוח התשלומים שאושר.",
    "en": "Reminder: please confirm on this page the date you will arrive to do the work (or propose another date) and the approved payment schedule.",
    "ar": "تذكير: يرجى التأكيد في هذه الصفحة على موعد وصولكم لتنفيذ العمل (أو اقتراح موعد آخر) وعلى جدول الدفعات المعتمد.",
    "ru": "Напоминание: подтвердите на этой странице дату вашего прибытия для выполнения работ (или предложите другую дату) и утверждённый график платежей.",
}


def _remind(conn, row: Mapping[str, Any], v: Mapping[str, Any], t: Mapping[str, Any], now: dt.datetime) -> None:
    from . import rfq, rfq_links, store_links

    at = iso(now)
    contact = store_links.contact(conn, v["contact_id"]) or {}
    lang = contact.get("lang") if contact.get("lang") in REMINDER_TEXT else "he"
    mid = store_rfq.insert_message(conn, {"rfq_id": row["id"], "rfq_vendor_id": v["id"], "direction": "out", "body": REMINDER_TEXT[lang],
                                          "author_kind": "user", "author_id": "system", "source_kind": "award", "source_id": t["award_id"],
                                          "created_at": at})
    queued = False
    link = store_rfq.link_of_vendor(conn, v["id"])
    if link is not None and rfq_links.state(link, now) == "live" and rfq.vendor_page_ready(conn) and not contact.get("erased_at"):
        planned = rfq._plan(conn, contact)
        if planned != "manual":
            oid = rfq._enqueue(conn, purpose="rfq_update", row=row, vendor=v, contact=contact, channel=planned, link_id=link["id"],
                               requested_by="system", idempotency_key=f"rfqarr:{t['award_id']}:{int(t.get('reminders') or 0) + 1}")
            store_rfq.set_message_notified(conn, mid, oid)
            queued = oid is not None
    store_rfq.update_terms(conn, t["award_id"], {"reminded_at": at, "reminders": int(t.get("reminders") or 0) + 1, "updated_at": at})
    store_rfq.insert_event(conn, row["id"], "arrival_reminder", rfq_vendor_id=v["id"],
                           data={"award_id": t["award_id"], "message_id": mid, "notified": queued, "n": int(t.get("reminders") or 0) + 1}, at=at)


# ---------------------------------------------------------------- the payment demand against the approved schedule

def _due_day(conn, it: Mapping[str, Any], completed: dt.date | None) -> dt.date | None:
    if it["due"] == "date":
        return dt.date.fromisoformat(it["date"]) if it.get("date") else None
    if completed is None:
        return None
    return completed + dt.timedelta(days=int(it.get("days") or 0)) if it["due"] == "after_completion" else completed


def check_demand(conn, claim: Mapping[str, Any], base: Mapping[str, Any] | None, current: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """The `schedule_check` block of a claim (managers with tickets.costs.view): compares the demand (its current revision) with the
    approved schedule of the baseline quote. FLAGS, never refuses:
        currency          the demand is in another currency than the schedule
        above_total       the demand is above the schedule's total
        ahead_of_schedule the job is done and the demand is above what is due by the day it was submitted (instalments due on a
                          date, on completion = the request's `done_at`, N days after completion)
        before_completion the job is NOT marked done (`done_at` NULL) and the demand is above the instalments due on a date by then:
                          what is due on / after completion is not due yet (review F2)
    `due_minor` = the sum of the instalments due by that day. Null when the baseline has no approved schedule."""
    sched = loads((base or {}).get("payment_schedule_json"))
    if not sched or current is None:
        return None
    from . import store_costs

    ticket = store_costs.ticket_row(conn, claim.get("ticket_id"))  # the claim's own ticket (the caller passed its visibility)
    # review F2: only the ticket's `done_at` completes the job - while it is NULL nothing due on / after completion is due (the claim's
    # creation is NOT a stand-in for the completion)
    completed = local_day(conn, (ticket or {}).get("done_at"))
    as_of = local_day(conn, current.get("created_at")) or local_day(conn, claim.get("created_at"))
    items = []
    due_minor = 0
    for it in sched["items"]:
        day = _due_day(conn, it, completed)
        is_due = day is not None and as_of is not None and day <= as_of
        if is_due:
            due_minor += int(it["amount_minor"])
        items.append({"index": it["index"], "kind": it["kind"], "amount_minor": it["amount_minor"], "due": it["due"],
                      "due_date": day.isoformat() if day else None, "is_due": is_due})
    flags: list[str] = []
    total = int(current["total_minor"])
    if current.get("currency") != sched.get("currency"):
        flags.append("currency")
    else:
        if total > int(sched["total_minor"]):
            flags.append("above_total")
        if total > due_minor:
            flags.append("ahead_of_schedule" if completed is not None else "before_completion")
    return {"status": "flagged" if flags else "ok", "flags": flags, "currency": sched.get("currency"), "schedule_total_minor": sched["total_minor"],
            "due_minor": due_minor, "demand_minor": total, "as_of": as_of.isoformat() if as_of else None,
            "completed_on": completed.isoformat() if completed else None, "items": items}


def order_lines(conn, award_id: str, lang: str = "he") -> list[str]:
    """The order block's lines about the terms (the request's description; NEVER an amount): the confirmed / planned arrival and the
    schedule's due rules."""
    t = store_rfq.terms(conn, award_id)
    if t is None:
        return []
    def day(v: str | None) -> str:
        d = local_day(conn, v)
        return d.strftime("%d.%m.%Y") if d else ""
    win = " - ".join(x for x in (day(t.get("planned_from")), day(t.get("planned_to"))) if x)
    state = {"confirmed": "אושר על ידי הספק" if t.get("confirmed_by") == "vendor" else "אושר",
             "proposed": "הספק הציע מועד אחר - ממתין להחלטה", "awaiting": "טרם אושר על ידי הספק"}[t["arrival_state"]]
    out = [f"מועד הגעה: {win or 'לא נקבע'} ({state})"]
    due_text = {"completion": "בסיום העבודה", "after_completion": "{days} ימים אחרי סיום העבודה"}
    kinds = {"advance": "מקדמה", "progress": "תשלום ביניים", "final": "תשלום סופי"}
    parts = []
    for it in schedule_of(t)["items"]:
        when = (dt.date.fromisoformat(it["date"]).strftime("%d.%m.%Y") if it["due"] == "date" and it.get("date")
                else due_text.get(it["due"], "").replace("{days}", str(it.get("days") or 0)))
        parts.append(f"{kinds[it['kind']]} - {when}")
    if parts:
        out.append("לוח תשלומים מאושר: " + "; ".join(parts))
    return out
