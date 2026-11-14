"""CR-AWARD-NOTICE (docs/changes/CR-AWARD-NOTICE.md; RFQ contract 20.16): the AWARD NOTICE - after a quote is approved the vendor is told
that it is APPROVED and BINDING, and that it is his duty to notify IN ADVANCE, through his link, if he postpones the work.

    text      fixed and code-owned (message_templates.CODE_VARIANTS[`rfq_award_notice`], he / en / ar / ru - ar / ru developer translations):
              a VARIANT of the existing `rfq_update` purpose, so the outbox's link handling, send-hours rules and fallbacks apply
              unchanged. No free text leaves the system; no amount, no date, no phone.
    setting   `tickets.settings.rfq.award_notice`:
                confirm (DEFAULT)  the award dialog shows the exact text (`preview`) with a send tick that is ON by default in the UI;
                                   nothing is stored or sent unless the award request itself carries `award_notice: true` (an older
                                   client that omits the field sends nothing - an award never sends silently)
                auto               queued in the award's transaction whenever the award becomes final (an explicit
                                   `award_notice: false` opts this one award out)
                off                never; `award_notice: true` is refused (422 `disabled`) so a client never believes it was sent
    once      ONE notice per award: outbox idempotency key `rfqaward:<award_id>` + the RFQ timeline row `award_notice` (the later
              send route answers `already: true` and queues nothing).
    second    an award waiting for a second approval sends nothing; the first approver's tick is remembered on the `award_pending`
              timeline row and is the default of the second approver's confirm (who may change it). An INHERITED tick never refuses
              the confirm (review A1): an unreachable vendor is recorded (`queued: false`, reason) and the later send stays available;
              only an explicit `award_notice: true` in the confirm body is checked (409 `award_notice_unavailable`).
    clock     a queued notice tells the vendor: it starts the arrival-confirmation clock of the payment-schedule terms (20.7), like an
              award-sourced thread message.
Audit `ticket.rfq.award_notice`: ids, mode, channel, queued - never a text."""
from __future__ import annotations

import datetime as dt
import json
import logging
from typing import Any, Mapping

from . import message_templates as mt
from . import rfq_links, rfq_terms, settings_doc, store_links, store_rfq
from .costs import iso

log = logging.getLogger("smplwise.tickets.rfq")

MODES = ("confirm", "auto", "off")
IDEM = "rfqaward:{award_id}"
# The same commitment sentence on the vendor's own page (`binding.text` of GET /t/api/rfq, contract 20.17) - code-owned, his language; the
# page renders it as text (never markup). ar / ru: developer translations pending a native review.
PAGE_TEXT = {
    "he": "ההצעה שלכם אושרה, והיא מחייבת מעכשיו. אם תצטרכו לדחות את העבודה, חובה להודיע על כך מראש כאן.",
    "en": "Your quote was approved and is now binding. If you need to postpone the work, you must notify us in advance here.",
    "ar": "تمت الموافقة على عرض السعر الخاص بكم، وأصبح ملزمًا من الآن. إذا احتجتم إلى تأجيل العمل، يجب إبلاغنا بذلك مسبقًا هنا.",
    "ru": "Ваше предложение утверждено и с этого момента является обязательным. Если вам нужно перенести работы, вы обязаны заранее сообщить об этом здесь.",
}


def page_text(lang: str | None) -> str:
    return PAGE_TEXT.get(lang or "", PAGE_TEXT["he"])


def mode(conn) -> str:
    value = settings_doc.read(conn)["rfq"].get("award_notice")
    return value if value in MODES else "confirm"


def _rfq():
    from . import rfq

    return rfq


# ---------------------------------------------------------------- can the vendor be told now? (no write)

def reach(conn, row: Mapping[str, Any], v: Mapping[str, Any], now: dt.datetime) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str, str | None]:
    """(contact, live link, planned channel, refusal reason | None). Reasons: `vendor` (removed / draft / an erased or no longer allowed
    contact), `page` (the public vendor page is not ready), `link` (his RFQ link is not live), `channel` (no WhatsApp / e-mail reaches him)."""
    rfq = _rfq()
    contact = store_links.contact(conn, v.get("contact_id")) or {}
    if v.get("state") in (None, "draft", "removed", "not_awarded") or not contact or contact.get("erased_at") \
            or rfq.vendor_problem(conn, contact, row["department_id"]):
        return contact, None, "manual", "vendor"
    if not rfq.vendor_page_ready(conn):
        return contact, None, "manual", "page"
    link = store_rfq.link_of_vendor(conn, v["id"])
    if link is None or rfq_links.state(link, now) != "live":
        return contact, None, "manual", "link"
    planned = rfq._plan(conn, contact)
    if planned == "manual":
        return contact, link, planned, "channel"
    return contact, link, planned, None


def text_for(conn, row: Mapping[str, Any], contact: Mapping[str, Any]) -> tuple[str, str]:
    """(the EXACT text the outbox will render - the link shown as a placeholder, the language)."""
    from .messaging import LINK_PLACEHOLDER, display_names

    lang = contact.get("lang") if contact.get("lang") in mt.LANGS else mt.DEFAULT_LANG
    tpl = mt.variant_by_id(mt.variant_template_id(mt.AWARD_NOTICE, lang), "rfq_update")
    assert tpl is not None
    params = _rfq().message_params(conn, row, contact)
    try:
        body = mt.render(tpl.body, params, lang=tpl.lang, display_name=display_names(conn),
                         secrets={"link": LINK_PLACEHOLDER.get(tpl.lang, "[link]")}, check_length=False)
    except mt.TemplateError:
        body = ""
    return body, tpl.lang


def _event(conn, rfq_id: str, award_id: str) -> dict[str, Any] | None:
    for e in reversed(store_rfq.events_of(conn, rfq_id, limit=1000)):
        if e["kind"] != "award_notice":
            continue
        try:
            data = json.loads(e["data_json"] or "{}")
        except ValueError:
            continue
        if data.get("award_id") == award_id:
            return {**data, "at": e["at"], "by": e.get("actor_name") or ""}
    return None


def requested_on_pending(conn, rfq_id: str, award_id: str) -> bool:
    """The first approver's tick on an award that waited for the second approval (the `award_pending` row)."""
    for e in reversed(store_rfq.events_of(conn, rfq_id, limit=1000)):
        if e["kind"] != "award_pending":
            continue
        try:
            data = json.loads(e["data_json"] or "{}")
        except ValueError:
            continue
        if data.get("award_id") == award_id:
            return bool(data.get("notice_requested"))
    return False


# ---------------------------------------------------------------- the manager's preview (GET .../vendors/{rv}/award-notice)

def preview(conn, viewer: Any, seen: Any, rfq_vendor_id: str, now: dt.datetime, rid: str | None = None) -> dict[str, Any]:
    """The award dialog's block: the setting, the exact text in the vendor's language, the channel, why it cannot go now. No side effect.
    Who: an approver (tickets.costs + view) or an RFQ manager - anyone else an audited 403."""
    rfq = _rfq()
    if not (rfq.can_decide(viewer, seen) or rfq.is_manager(viewer, seen)):
        raise rfq.refuse(conn, viewer, "ticket.rfq.award_notice", seen.row, "not_manager", rid)
    v = rfq.vendor_of(conn, seen, rfq_vendor_id)
    contact, _link, planned, why = reach(conn, seen.row, v, now)
    body, lang = text_for(conn, seen.row, contact or {})
    a = next((x for x in store_rfq.awards_of(conn, seen.row["id"]) if x["rfq_vendor_id"] == v["id"] and x["state"] in ("approved", "pending_second")),
             None)
    sent = _event(conn, seen.row["id"], a["id"]) if a else None
    m = mode(conn)
    return {"mode": m, "text": body, "lang": lang, "channel": planned, "refusals": [why] if why else [],
            "notify_default": m != "off" and why is None, "sent": bool(sent and sent.get("queued"))}


# ---------------------------------------------------------------- before the award writes anything

def want(conn, flag: bool | None) -> bool | None:
    """The award request's `award_notice` against the setting. None = decide later (auto: yes; confirm: no). Raises 422 `disabled` for
    `true` while the setting is off - never silently dropped."""
    m = mode(conn)
    if m == "off":
        if flag is True:
            raise _rfq().invalid(conn, "award_notice", "disabled")
        return False
    if flag is None:
        return True if m == "auto" else False
    return bool(flag)


def check(conn, row: Mapping[str, Any], v: Mapping[str, Any], wanted: bool, now: dt.datetime) -> None:
    """In `confirm` mode a ticked notice that cannot go now is refused BEFORE the award writes anything (409 `award_notice_unavailable`,
    `details.reason`) - the dialog's preview already showed why, so the manager unticks or fixes the channel. `auto` never refuses an
    award: an unreachable vendor is recorded (`award_notice` row, `queued: false`). The caller checks only an EXPLICIT tick: the second
    approval's INHERITED tick never refuses (review A1, `rfq.confirm`)."""
    if not wanted or mode(conn) != "confirm":
        return
    _c, _l, _p, why = reach(conn, row, v, now)
    if why:
        raise _rfq()._err(conn, 409, "award_notice_unavailable", reason=why)


# ---------------------------------------------------------------- the notice itself (inside the award's transaction)

def send(conn, viewer: Any, row: Mapping[str, Any], award: Mapping[str, Any], now: dt.datetime, rid: str | None, *, via: str) -> dict[str, Any]:
    """Queue THE award notice of a FINAL award (once). Returns `{queued, channel, outbox_id, already, reason}`. The timeline row
    `award_notice` and the audit row are written once per award (a repeat writes nothing)."""
    rfq = _rfq()
    prior = _event(conn, row["id"], award["id"])
    if prior is not None and prior.get("queued"):
        return {"queued": False, "already": True, "channel": prior.get("channel"), "outbox_id": prior.get("outbox_id"), "reason": None}
    v = store_rfq.vendor(conn, award["rfq_vendor_id"]) or {}
    contact, link, planned, why = reach(conn, row, v, now)
    oid = None
    if why is None and link is not None and contact:
        lang = contact.get("lang") if contact.get("lang") in mt.LANGS else mt.DEFAULT_LANG
        # Review A3: the notice never breaks the award - an unexpected failure inside the outbox (a template render, a key problem) is
        # rolled back to this savepoint and recorded as `outbox` (nothing queued) instead of refusing the award's transaction.
        conn.execute("SAVEPOINT award_notice_enqueue")
        try:
            oid = rfq._enqueue(conn, purpose="rfq_update", row=row, vendor=v, contact=contact, channel=planned, link_id=link["id"],
                               requested_by=viewer.uid, idempotency_key=IDEM.format(award_id=award["id"]),
                               template_id=mt.variant_template_id(mt.AWARD_NOTICE, lang))
        except Exception as exc:  # noqa: BLE001 - see above; logged without any text
            conn.execute("ROLLBACK TO award_notice_enqueue")
            log.warning("award notice not queued (award %s): %s", award["id"], type(exc).__name__)
            oid = None
        conn.execute("RELEASE award_notice_enqueue")
        if oid is None:
            why = "outbox"  # the messaging runtime is not running, or it failed: nothing was queued
    queued = oid is not None
    at = iso(now)
    data: dict[str, Any] = {"award_id": award["id"], "queued": queued, "channel": planned if queued else None, "outbox_id": oid,
                            "mode": mode(conn), "via": via}
    if why:
        data["reason"] = why
    store_rfq.insert_event(conn, row["id"], "award_notice", actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           rfq_vendor_id=award["rfq_vendor_id"], data=data, at=at)
    rfq._audit(conn, viewer, "ticket.rfq.award_notice", row, rid, award_id=award["id"], vendor_id=award["rfq_vendor_id"], queued=queued,
               channel=planned if queued else None, notice_mode=data["mode"], via=via, **({"reason": why} if why else {}))
    if queued:
        rfq_terms.requested(conn, award["id"], via="award", now=now)  # the vendor was TOLD: the arrival-confirmation clock (20.7)
    return {"queued": queued, "already": False, "channel": planned if queued else None, "outbox_id": oid, "reason": why}


def send_later(conn, viewer: Any, seen: Any, award_id: str, now: dt.datetime, rid: str | None = None) -> dict[str, Any]:
    """POST /tickets/rfqs/{id}/awards/{award_id}/notice: the notice of a final award that was not sent with it (the tick was off, or the
    vendor could not be reached then). An approver or an RFQ manager; the setting must not be `off` (409 `award_notice_off`); a notice
    already queued answers `already: true` and queues nothing; an unreachable vendor is 409 `award_notice_unavailable` (nothing written)."""
    rfq = _rfq()
    if not (rfq.can_decide(viewer, seen) or rfq.is_manager(viewer, seen)):
        raise rfq.refuse(conn, viewer, "ticket.rfq.award_notice", seen.row, "not_manager", rid)
    a = rfq.award_of(conn, seen, award_id)
    if mode(conn) == "off":
        raise rfq._err(conn, 409, "award_notice_off")
    if a["state"] != "approved" or seen.row["state"] not in ("awarded", "ordered"):
        raise rfq._bad_move(conn, seen.row, "award_notice", now)
    prior = _event(conn, seen.row["id"], a["id"])
    if prior is not None and prior.get("queued"):
        return {"queued": False, "already": True, "channel": prior.get("channel"), "outbox_id": prior.get("outbox_id"), "reason": None}
    v = store_rfq.vendor(conn, a["rfq_vendor_id"]) or {}
    _c, _l, _p, why = reach(conn, seen.row, v, now)
    if why:
        raise rfq._err(conn, 409, "award_notice_unavailable", reason=why)
    res = send(conn, viewer, seen.row, a, now, rid, via="later")
    rfq._touch(conn, seen.row, {}, None, now)
    return res


# ---------------------------------------------------------------- the detail (awards[].notice)

def present(conn, viewer: Any, seen: Any, award: Mapping[str, Any]) -> dict[str, Any]:
    rfq = _rfq()
    ev = _event(conn, seen.row["id"], award["id"])
    m = mode(conn)
    queued = bool(ev and ev.get("queued"))
    may = rfq.can_decide(viewer, seen) or rfq.is_manager(viewer, seen)
    return {"mode": m, "state": "queued" if queued else ("not_sent" if ev else ("pending" if award["state"] == "pending_second" else "none")),
            "at": ev.get("at") if ev else None, "by": ev.get("by") if ev else None, "channel": ev.get("channel") if ev else None,
            "reason": ev.get("reason") if ev and not queued else None,
            "requested": requested_on_pending(conn, seen.row["id"], award["id"]) if award["state"] == "pending_second" else None,
            "can": {"send": bool(may and m != "off" and not queued and award["state"] == "approved" and seen.row["state"] in ("awarded", "ordered"))}}
