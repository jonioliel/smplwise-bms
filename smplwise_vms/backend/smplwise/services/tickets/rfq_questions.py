"""RFQQUESTIONS (docs/tickets/RFQ_BACKEND_CONTRACT.md section 19, docs/changes/CR-RFQ-QUESTIONS.md): a vendor's question is a visible,
first-class item for the RFQ managers - before this a question was only a row in the vendor's private thread (and a quote's free
"note" was the place many vendors wrote one), so nothing on the list, the board or the comparison said "a vendor is waiting for you".

    a question   an INBOUND `ticket_rfq_messages` row: the page's question box, the quote form's own "question" field (stored with the
                 quote's id) or a WhatsApp reply matched by rfq_inbound (unverified - managers only). Pending = no answer yet; unread =
                 pending and no RFQ manager opened it yet (one shared state per request)
    counts       `question_counts` / `pending_items` for the detail, the list row, the comparison column; `nav_summary` for the app's
                 navigation badge (the requests the caller MANAGES only). Badges count only while the request is open
                 (sent / collecting / due_passed): after an award, a close or a cancel nobody can act on a question any more
    answer       the manager answers ONE question: to that vendor only (the default), or to every invited vendor (`scope: all`) - the
                 others see the question as the manager worded it (default: the vendor's text, never his name unless the manager ticks
                 "name the vendor") and the answer. Each copy is a normal thread message (the vendor page shows his own copy only); with
                 `notify` each vendor gets the templated `rfq_update` notice (never the free text by WhatsApp / e-mail - contract 8).
                 `preview` answers the exact texts and recipients with no side effect (the "לשלוח הודעה לספק?" step)
    resolve      "handled without a reply" (answered by phone): the question leaves the badges, nothing is sent
    read         a manager opened the vendor's thread / the pending section: his questions are no longer "new"
    reminder     the janitor raises `rfq.question_unanswered` once per question after `rfq.question_reminder_hours` (default 24, 0 = off)

Security: every route is the request's visibility (uniform 404 `rfq_not_found`; an id of another request / an outbound message is 404
`message_not_found`) and the RFQ manager rule (audited 403). Texts go through text hygiene and their limits; timeline and audit rows carry
ids and counts only - never a text, never a vendor's name. A vendor never learns who else was invited: an answer to all is stored per
vendor, and the asking vendor is named only when the manager chooses it."""
from __future__ import annotations

import datetime as dt
from typing import Any, Mapping

from ...audit import audit
from ...db import new_id
from . import rfq, rfq_notify, settings_doc, store_links, store_quotes, store_rfq
from .access import Viewer, text
from .costs import iso, now_utc
from .text_hygiene import clean_text

ANSWER_MAX = rfq.MESSAGE_MAX  # 2000 - the answer itself
QUESTION_SHOWN_MAX = 1000  # the question as the other vendors read it (scope all)
NAV_LIMIT = 500
LANGS = ("he", "en", "ar", "ru")
# The frame of an answer to every vendor, in each vendor's own language (the manager writes the question / answer text himself).
FRAME = {
    "he": {"q": "שאלה שהתקבלה מספק", "q_named": "שאלה מ{name}", "a": "תשובה"},
    "en": {"q": "A question from a vendor", "q_named": "A question from {name}", "a": "Answer"},
    "ar": {"q": "سؤال من أحد الموردين", "q_named": "سؤال من {name}", "a": "الإجابة"},
    "ru": {"q": "Вопрос от поставщика", "q_named": "Вопрос от {name}", "a": "Ответ"},
}
NOT_FOUND = "השאלה לא נמצאה."
ANSWERED = "כבר ניתנה תשובה לשאלה הזו."


def _err(conn, status: int, code: str, message: str, **details: Any):
    from ...errors import ApiError

    return ApiError(status, code, text(conn, message), details=details or None)


def badge_open(row: Mapping[str, Any], now: dt.datetime) -> bool:
    """Whether a request's questions count on the badges now (open = an answer can still change a vendor's quote)."""
    return rfq.effective_state(row, now) in rfq.OPEN


# ---------------------------------------------------------------- reads (the detail, the list row, the comparison)

def counts(conn, row: Mapping[str, Any], now: dt.datetime) -> tuple[dict[str, int], dict[str, dict[str, int]]]:
    """({pending, unread} of the request, {rv_id: {pending, unread}}) - zeros once the request is no longer open."""
    if not badge_open(row, now):
        return {"pending": 0, "unread": 0}, {}
    per = store_rfq.question_counts(conn, row["id"])
    return {"pending": sum(c["pending"] for c in per.values()), "unread": sum(c["unread"] for c in per.values())}, per


def _vendor_label(conn, v: Mapping[str, Any] | None) -> dict[str, Any]:
    c = store_links.contact(conn, (v or {}).get("contact_id")) or {}
    if c.get("erased_at"):
        return {"name": "", "company": ""}
    vendor = store_links.contact(conn, c.get("vendor_id")) if c.get("vendor_id") else None
    return {"name": c.get("display_name") or "", "company": (vendor or {}).get("display_name") or c.get("company") or ""}


def pending_items(conn, viewer: Viewer, seen: rfq.RfqSeen, now: dt.datetime) -> list[dict[str, Any]]:
    """The 'שאלות ממתינות' section: every unanswered question of an open request, oldest first (the viewer sees the request, so he may
    read its threads - GET .../messages is the same rule)."""
    row = seen.row
    if not badge_open(row, now):
        return []
    vendors = {v["id"]: v for v in store_rfq.vendors_of(conn, row["id"])}
    out = []
    for m in store_rfq.pending_questions(conn, row["id"]):
        v = vendors.get(m["rfq_vendor_id"])
        if v is None or v["state"] == "removed":
            continue
        whatsapp = str(m.get("source_id") or "").startswith("whatsapp:")
        q = store_quotes.quote(conn, m["quote_id"]) if m.get("quote_id") else None
        out.append({"id": m["id"], "vendor_id": v["id"], "vendor": _vendor_label(conn, v), "text": m["body"], "at": m["created_at"],
                    "read": bool(m.get("read_at")), "via": "whatsapp" if whatsapp else "page", "unverified": whatsapp,
                    "quote": {"id": q["id"], "version": q["version"]} if q else None,
                    "age_h": max(0, int((now - (rfq.parse(m["created_at"]) or now)).total_seconds() // 3600))})
    return out


def nav_summary(conn, viewer: Viewer) -> dict[str, int]:
    """The navigation badge: unanswered questions of the open requests the caller MANAGES (an RFQ manager, contract section 6) - a plain
    viewer is not asked to answer, so his badge stays empty."""
    now = now_utc()
    pending = unread = requests = 0
    for rfq_id, p, u in store_rfq.rfqs_with_pending(conn, rfq.OPEN, NAV_LIMIT):
        seen = rfq.visible_by_id(viewer, rfq_id)
        if seen is None or not rfq.is_manager(viewer, seen) or not badge_open(seen.row, now):
            continue
        pending, unread, requests = pending + p, unread + u, requests + 1
    return {"pending": pending, "unread": unread, "requests": requests}


# ---------------------------------------------------------------- writes

def question_of(conn, seen: rfq.RfqSeen, message_id: str) -> dict[str, Any]:
    m = store_rfq.message(conn, message_id)
    if m is None or m["rfq_id"] != seen.row["id"] or m["direction"] != "in":
        raise _err(conn, 404, "message_not_found", NOT_FOUND)
    return m


def mark_read(conn, viewer: Viewer, seen: rfq.RfqSeen, rfq_vendor_id: str, rid: str | None = None) -> int:
    rfq.need_manager(conn, viewer, seen, "ticket.rfq.question_read", rid)
    v = rfq.vendor_of(conn, seen, rfq_vendor_id)
    return store_rfq.mark_questions_read(conn, v["id"], viewer.uid, iso(now_utc()))


def resolve(conn, viewer: Viewer, seen: rfq.RfqSeen, message_id: str, rid: str | None = None) -> None:
    """Handled without a reply (the manager answered by phone, or the question is moot). Nothing is sent."""
    rfq.need_manager(conn, viewer, seen, "ticket.rfq.question_resolve", rid)
    m = question_of(conn, seen, message_id)
    if m.get("answered_at"):
        raise _err(conn, 409, "question_answered", ANSWERED)
    at = iso(now_utc())
    store_rfq.answer_questions(conn, [m["id"]], by=viewer.uid, at=at, answer_id=None)
    if not store_rfq.question_counts(conn, seen.row["id"]).get(m["rfq_vendor_id"]):
        rfq_notify.answered(conn, seen.row["id"], m["rfq_vendor_id"])
    store_rfq.insert_event(conn, seen.row["id"], "question_resolved", actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           rfq_vendor_id=m["rfq_vendor_id"], data={"message_id": m["id"]}, at=at)
    audit(conn, actor=viewer.principal, action="ticket.rfq.question_resolve", decision="allowed", resource_type="ticket_rfq",
          resource_id=seen.row["id"], request_id=rid, details={"number": seen.row["number"], "vendor_id": m["rfq_vendor_id"], "message_id": m["id"]})


def _clean(conn, value: Any, field_name: str, max_len: int, *, required: bool) -> str:
    t = clean_text(value if isinstance(value, str) else "", multiline=True)
    if len(t) > max_len:
        raise rfq.invalid(conn, field_name, "too_long")
    if required and not t:
        raise rfq.invalid(conn, field_name, "required")
    return t


def _lang(conn, v: Mapping[str, Any]) -> str:
    c = store_links.contact(conn, v.get("contact_id")) or {}
    return c.get("lang") if c.get("lang") in LANGS else "he"


def _recipients(conn, seen: rfq.RfqSeen, asker: Mapping[str, Any], scope: str) -> list[dict[str, Any]]:
    if scope != "all":
        return [dict(asker)]
    out = [dict(asker)]
    for v in store_rfq.vendors_of(conn, seen.row["id"]):
        if v["id"] != asker["id"] and v["state"] not in ("draft", "removed", "not_awarded"):
            out.append(v)
    return out


def plan(conn, viewer: Viewer, seen: rfq.RfqSeen, message_id: str, body: Mapping[str, Any], rid: str | None = None,
         *, action: str = "ticket.rfq.answer") -> dict[str, Any]:
    """Every check of an answer and the exact copies it would store (no write): the preview and the answer share it."""
    rfq.need_manager(conn, viewer, seen, action, rid)
    m = question_of(conn, seen, message_id)
    if m.get("answered_at"):
        raise _err(conn, 409, "question_answered", ANSWERED)
    asker = rfq.vendor_of(conn, seen, m["rfq_vendor_id"])
    if asker["state"] in ("draft", "removed"):
        raise rfq._bad_move(conn, seen.row, "message", now_utc())
    scope = body.get("scope") or "vendor"
    if scope not in ("vendor", "all"):
        raise rfq.invalid(conn, "scope", "unknown")
    if scope == "all" and rfq.effective_state(seen.row, now_utc()) not in rfq.OPEN:
        raise rfq._bad_move(conn, seen.row, "answer_all", now_utc())
    answer = _clean(conn, body.get("text"), "text", ANSWER_MAX, required=True)
    shown = _clean(conn, body.get("question_text") if body.get("question_text") is not None else m["body"], "question_text", QUESTION_SHOWN_MAX,
                   required=scope == "all") if scope == "all" else ""
    named = bool(body.get("name_asker")) and scope == "all"
    label = _vendor_label(conn, asker)
    asker_name = label["company"] or label["name"]
    copies = []
    for v in _recipients(conn, seen, asker, scope):
        if v["id"] == asker["id"]:
            msg = answer  # his own question sits right above in his thread
        else:
            f = FRAME[_lang(conn, v)]
            head = f["q_named"].replace("{name}", asker_name) if (named and asker_name) else f["q"]
            msg = f"{head}: {shown}\n{f['a']}: {answer}"
        copies.append({"vendor": v, "text": msg, "asker": v["id"] == asker["id"]})
    return {"question": m, "asker": asker, "scope": scope, "named": named, "copies": copies}


def present_plan(conn, p: Mapping[str, Any], notify: bool) -> dict[str, Any]:
    out = []
    now = now_utc()
    for c in p["copies"]:
        v = c["vendor"]
        link = store_rfq.link_of_vendor(conn, v["id"])
        contact = store_links.contact(conn, v["contact_id"]) or {}
        channel = None
        if notify and link is not None and rfq_links_state(link, now) == "live" and rfq.vendor_page_ready(conn) and not contact.get("erased_at"):
            planned = rfq._plan(conn, contact)
            channel = planned if planned != "manual" else None
        out.append({"vendor_id": v["id"], "vendor": _vendor_label(conn, v), "asker": c["asker"], "text": c["text"], "lang": _lang(conn, v),
                    "notify_channel": channel})
    return {"question_id": p["question"]["id"], "scope": p["scope"], "name_asker": p["named"], "recipients": out}


def rfq_links_state(link: Mapping[str, Any], now: dt.datetime) -> str:
    from . import rfq_links

    return rfq_links.state(link, now)


def answer(conn, viewer: Viewer, seen: rfq.RfqSeen, message_id: str, body: Mapping[str, Any], rid: str | None = None) -> dict[str, Any]:
    """Store one copy per recipient (a normal thread message that names the question), mark the question answered, resolve its
    notifications. With `notify`, each vendor with a live link gets the templated `rfq_update` notice - never the text itself."""
    notify = bool(body.get("notify", True))
    p = plan(conn, viewer, seen, message_id, body, rid)
    now = now_utc()
    at = iso(now)
    broadcast = new_id() if p["scope"] == "all" else None
    items, queued = [], 0
    asker_mid = None
    for c in p["copies"]:
        mid, notified = rfq.store_out_message(conn, viewer, seen, c["vendor"], c["text"], notify, now, source_kind="clarify", source_id=None,
                                              answers_id=p["question"]["id"], broadcast_id=broadcast)
        queued += 1 if notified["queued"] else 0
        if c["asker"]:
            asker_mid = mid
        items.append({"vendor_id": c["vendor"]["id"], "message_id": mid, "notified": notified["queued"]})
    store_rfq.answer_questions(conn, [p["question"]["id"]], by=viewer.uid, at=at, answer_id=asker_mid)
    rfq._touch(conn, seen.row, {}, None, now)
    if not store_rfq.question_counts(conn, seen.row["id"]).get(p["asker"]["id"]):
        rfq_notify.answered(conn, seen.row["id"], p["asker"]["id"])
    store_rfq.insert_event(conn, seen.row["id"], "question_answered", actor_kind="user", actor_user_id=viewer.uid, actor_name=rfq.actor_name(viewer),
                           rfq_vendor_id=p["asker"]["id"], data={"message_id": p["question"]["id"], "scope": p["scope"], "copies": len(items),
                                                                 "notified": queued, "named": p["named"]}, at=at)
    audit(conn, actor=viewer.principal, action="ticket.rfq.answer", decision="allowed", resource_type="ticket_rfq", resource_id=seen.row["id"],
          request_id=rid, details={"number": seen.row["number"], "message_id": p["question"]["id"], "vendor_id": p["asker"]["id"],
                                   "scope": p["scope"], "copies": len(items), "notified": queued, "named": p["named"], "broadcast_id": broadcast})
    return {"question_id": p["question"]["id"], "scope": p["scope"], "items": items, "notified": queued, "broadcast_id": broadcast}


# ---------------------------------------------------------------- the janitor (costs_retention -> rfq.retention)

def remind(conn, now: dt.datetime) -> int:
    hours = int(settings_doc.read(conn)["rfq"].get("question_reminder_hours", 24) or 0)
    if hours <= 0:
        return 0
    n = 0
    at = iso(now)
    for m in store_rfq.questions_due_for_reminder(conn, iso(now - dt.timedelta(hours=hours)), rfq.OPEN):
        row = rfq.system_row(conn, m["rfq_id"])
        store_rfq.set_question_reminded(conn, m["id"], at)
        if row is None or not badge_open(row, now):
            continue
        rfq_notify.question_unanswered(conn, row, m["rfq_vendor_id"], m["id"], hours=hours)
        store_rfq.insert_event(conn, row["id"], "question_reminder", rfq_vendor_id=m["rfq_vendor_id"], data={"message_id": m["id"], "hours": hours}, at=at)
        n += 1
    return n
