"""TKRFQ5 (docs/tickets/RFQ_BACKEND_CONTRACT.md section 16): the requests-for-quotation signals of the CR-018 notification centre.

Until 2.6.3 a vendor's quote, withdrawal, "not interested" and clarification question showed only on the request's timeline; the RFQ
managers now get a notification (category `tickets`, subject kind `rfq`, recipients `rfq_managers`):

    rfq.quote_received   a vendor submitted a quote, sent a new version or withdrew it (one row per request, folded: "x3")
    rfq.declined         a vendor answered "not interested" (one row per request, folded)
    rfq.question         a vendor asked a clarification question - on his page or by a WhatsApp reply (one row per vendor; resolved
                         when a manager writes to that vendor)
    rfq.due_passed       the quote deadline passed (the janitor or the first write after it); resolved when the deadline moves later

Every row of a request is resolved when it is awarded (final), closed, cancelled or deleted.

Who (the engine's hooks call back here):
  - notify.recipients_for -> `recipient_users(n)`  the RFQ manager rule: the creator, the internal owner and the manager members of the
                                                   department (the tickets.manage + all-departments holders stand in when it has none),
                                                   each kept only when rfq.visible() sees the request AND rfq.is_manager() holds for him
                                                   (tickets.external on the place);
  - notify_visibility.Reach.can_see -> `can_see()`   exactly rfq.visible() of the request, now (a moved department or a revoked binding
                                                   hides old rows; a deleted request hides them all);
  - notify._default_link -> `#/tickets/rfqs?rfq=<id>`.

Texts: the request's reference and its place (the place text, else the department) - NEVER an amount, a vendor's name, phone or text,
the title someone typed, or anything about another vendor. The aggregate of the deadline row is a count of answers only. Nothing here
sends anything to a vendor: the WhatsApp channel of a notification (NOTIFWA) reaches an Arx user's own number only, is off by default
for these sources like for every source, and follows the channel's own detail rule. Nothing here ever raises (a notification never fails
the vendor's or the manager's action - emit() runs in its own savepoint)."""
from __future__ import annotations

import logging
import sqlite3
from typing import Any, Mapping

from ...rbac import Principal
from . import store
from .notify_sources import SUBJECT_RFQ

log = logging.getLogger("smplwise.tickets.rfq_notify")

LANG = "he"  # the notification centre's language (its catalogue and every other source are Hebrew); "en" is kept for the same rows
TEXTS: dict[str, dict[str, tuple[str, str]]] = {
    "he": {
        "quote_new": ("{ref}: התקבלה הצעת מחיר", "{place}"),
        "quote_updated": ("{ref}: הצעת מחיר עודכנה", "{place}"),
        "quote_withdrawn": ("{ref}: הצעת מחיר נמשכה", "{place}"),
        "declined": ("{ref}: ספק השיב שאינו מעוניין", "{place}"),
        "question": ("{ref}: שאלת הבהרה מספק", "{place}"),
        "question_whatsapp": ("{ref}: הודעה מספק בוואטסאפ", "{place} · שולח לא מאומת"),
        "question_unanswered": ("{ref}: שאלת ספק ממתינה לתשובה", "{place} · {hours} שעות ללא מענה"),
        "due_passed": ("{ref}: המועד להגשת הצעות עבר", "{place} · {quoted} מתוך {invited} הגישו הצעה"),
        "arrival_confirmed": ("{ref}: ספק אישר את מועד ההגעה ואת לוח התשלומים", "{place}"),
        "arrival_proposed": ("{ref}: ספק הציע מועד הגעה אחר", "{place} · ממתין להחלטה"),
        "arrival_unconfirmed": ("{ref}: ספק לא אישר את מועד ההגעה", "{place} · נשלחו שתי תזכורות · הזמנת העבודה אינה נחסמת"),
        "instalment_overdue": ("{ref}: מועד תשלום לספק עבר", "{place} · {count} תשלומים שמועדם עבר ולא סומנו כשולמו"),
        "instalment_due_tomorrow": ("{ref}: מועד תשלום לספק מחר", "{place} · {count} תשלומים שטרם סומנו כשולמו"),
        "vendor_postponement": ("{ref}: ספק הודיע על דחיית העבודה", "{place}"),
        "vendor_postponement_late": ("{ref}: ספק הודיע על דחיית העבודה", "{place} · באיחור"),
    },
    "en": {
        "quote_new": ("{ref}: quote received", "{place}"),
        "quote_updated": ("{ref}: quote updated", "{place}"),
        "quote_withdrawn": ("{ref}: quote withdrawn", "{place}"),
        "declined": ("{ref}: a vendor declined", "{place}"),
        "question": ("{ref}: clarification question from a vendor", "{place}"),
        "question_whatsapp": ("{ref}: WhatsApp message from a vendor", "{place} · unverified sender"),
        "question_unanswered": ("{ref}: a vendor question is waiting for an answer", "{place} · {hours} hours without an answer"),
        "due_passed": ("{ref}: the quote deadline passed", "{place} · {quoted} of {invited} quoted"),
        "arrival_confirmed": ("{ref}: a vendor confirmed the arrival date and the payment schedule", "{place}"),
        "arrival_proposed": ("{ref}: a vendor proposed another arrival date", "{place} · waiting for a decision"),
        "arrival_unconfirmed": ("{ref}: a vendor did not confirm the arrival date", "{place} · two reminders sent · the work order is not blocked"),
        "instalment_overdue": ("{ref}: a vendor payment is past its date", "{place} · {count} instalments past their date and not marked paid"),
        "instalment_due_tomorrow": ("{ref}: a vendor payment is due tomorrow", "{place} · {count} instalments not marked paid yet"),
        "vendor_postponement": ("{ref}: a vendor gave notice of postponing the work", "{place}"),
        "vendor_postponement_late": ("{ref}: a vendor gave notice of postponing the work", "{place} · late"),
    },
}
# RFQPAY2: the overdue-instalment rows are keyed OUTSIDE `rfq:<id>:` (`rfqpay:<rfq_id>:<award_id>`) - a later final award or the close of
# the request (`ended`) must not silence a payment that is still due; they end with a cancel / delete / purge (`payments_ended`) or when
# nothing is overdue any more (paid, cancelled, moved).
PAY_PREFIX = "rfqpay"
# CR-AWARD-NOTICE: the vendor's postponement notice of an award - keyed OUTSIDE `rfq:<id>:` too (`rfqpost:<rfq_id>:<award_id>`): a later
# award of a split request (`ended`) must not silence it; it ends when a manager acts on it or the request closes / is cancelled / deleted
POST_PREFIX = "rfqpost"
PART_SOURCE = {"quote": "rfq.quote_received", "declined": "rfq.declined", "question": "rfq.question", "due": "rfq.due_passed",
               "arrival": "rfq.arrival", "qremind": "rfq.question_unanswered"}


# ---------------------------------------------------------------- engine callbacks

def _row(conn: sqlite3.Connection, rfq_id: str | None) -> dict[str, Any] | None:
    from . import rfq

    return rfq.system_row(conn, str(rfq_id)) if rfq_id else None


def can_see(conn: sqlite3.Connection, principal: Principal, rfq_id: str | None) -> bool:
    """The visibility of an `rfq` notification: the request itself, now (rfq.visible - module on, tickets.view on the place, all
    departments / member / creator / internal owner)."""
    from . import access, rfq

    row = _row(conn, rfq_id)
    return row is not None and rfq.visible(access.Viewer(conn, principal), row) is not None


def managers_of(conn: sqlite3.Connection, row: Mapping[str, Any]) -> list[str]:
    """The RFQ manager rule (contract section 6) as a list of active users: the creator, the internal owner, the department's manager
    members (when it has none: the tickets.manage + all-departments holders where the request lies) - each kept only when he sees the
    request and is an RFQ manager now (tickets.external on the place)."""
    from . import access, rfq

    row = dict(row)
    candidates: list[str] = [u for u in (row.get("created_by"), row.get("internal_owner_user_id")) if isinstance(u, str) and u]
    members = list(store.manager_member_ids(conn, row["department_id"]))
    candidates += members
    if not members:
        for uid in sorted(store.active_user_ids(conn)):
            v = rfq._user_viewer(conn, uid)
            if v.holds(access.MANAGE, row) and v.holds(access.ALL_DEPARTMENTS, row):
                candidates.append(uid)
    out: list[str] = []
    for uid in dict.fromkeys(candidates):
        if not store.user_is_active(conn, uid):
            continue
        v = rfq._user_viewer(conn, uid)
        seen = rfq.visible(v, row)
        if seen is not None and rfq.is_manager(v, seen):
            out.append(uid)
    return out


def recipient_users(conn: sqlite3.Connection, n: Mapping[str, Any]) -> list[str]:
    """notify.recipients_for (rule `rfq_managers`): the candidates of an RFQ notification (the engine then keeps those who may see it)."""
    origin = n.get("origin") or {}
    row = _row(conn, origin.get("rfq_id") or n.get("subject_id"))
    if row is None:
        return []
    managers = managers_of(conn, row)
    if origin.get("audience") == "costs":  # RFQPAY2: a payment signal - only the RFQ managers who may see the costs where it lies
        from .costs import COSTS_VIEW
        from .rfq import _user_viewer

        managers = [uid for uid in managers if _user_viewer(conn, uid).holds(COSTS_VIEW, dict(row))]
    elif origin.get("audience") == "pay":  # MGRDASH phase 4: only those who may mark the payment (tickets.costs + view, the act's rule)
        from .costs import COSTS, COSTS_VIEW
        from .rfq import _user_viewer

        managers = [uid for uid in managers
                    if (v := _user_viewer(conn, uid)).holds(COSTS_VIEW, dict(row)) and v.holds(COSTS, dict(row))]
    return managers


# ---------------------------------------------------------------- texts

def place_of(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    if row.get("place_text"):
        return str(row["place_text"])
    from .org_locations import parse_snapshot  # CR-ORG-LOCATIONS: the location's NAME only (staff notification, no address)

    snap = parse_snapshot(row.get("location_snapshot"))
    if snap:
        return str(snap["name"])
    dept = store.department_any(conn, row["department_id"]) or {}
    return str(dept.get("name") or "")


def render(kind: str, lang: str = LANG, **values: Any) -> tuple[str, str]:
    """(title, body) of one signal; a value is inserted once and never read as a placeholder."""
    title, body = TEXTS.get(lang, TEXTS["he"])[kind]
    for k, v in values.items():
        title, body = title.replace("{" + k + "}", str(v)), body.replace("{" + k + "}", str(v))
    return title, body


def _module_on(conn: sqlite3.Connection) -> bool:
    from .access import module_on

    return module_on(conn)


def _emit(conn: sqlite3.Connection, source: str, row: Mapping[str, Any], kind: str, *, dedupe: str, origin: dict[str, Any] | None = None,
          **values: Any) -> str | None:
    """One RFQ signal (never raises). Returns the engine's action ('created', 'folded', 'disabled', ... or None)."""
    if not _module_on(conn):
        return None
    from .. import notify
    from .rfq import ref

    place = place_of(conn, row)
    title, body = render(kind, ref=ref(row["number"]), place=place, **values)
    try:
        res = notify.emit_full(conn, notify.Signal(
            source=source, subject_kind=SUBJECT_RFQ, subject_id=row["id"], dedupe_key=dedupe,
            params={"title": title, "body": body},
            origin={"rfq_id": row["id"], "department_id": row["department_id"], **(origin or {})}, place=place or None))
        return res.action
    except Exception:  # noqa: BLE001 - a notification never fails the RFQ action
        log.warning("rfq notification %s failed for %s", source, row["id"], exc_info=True)
        return None


def resolve(conn: sqlite3.Connection, source: str, dedupe: str) -> None:
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(source=source, subject_kind=SUBJECT_RFQ, subject_id=None, dedupe_key=dedupe, resolve=True))
    except Exception:  # noqa: BLE001
        log.warning("rfq notification resolve %s failed", source, exc_info=True)


def resolve_rfq(conn: sqlite3.Connection, rfq_id: str, part: str = "") -> None:
    """Resolve every open notification of a request whose key starts with `rfq:<id>:<part>` (each with its own source)."""
    for key in store.open_notification_keys(conn, f"rfq:{rfq_id}:{part}"):
        bits = key.split(":")
        src = PART_SOURCE.get(bits[2]) if len(bits) >= 3 else None
        if src:
            resolve(conn, src, key)


# ---------------------------------------------------------------- the hooks (rfq_vendor / rfq_inbound / rfq call them in their transaction)

def quote(conn: sqlite3.Connection, row: Mapping[str, Any], rfq_vendor_id: str, kind: str) -> str | None:
    """A vendor's own quote: `kind` = new | updated | withdrawn (never the amount, never who)."""
    return _emit(conn, "rfq.quote_received", row, f"quote_{kind}", dedupe=f"rfq:{row['id']}:quote", origin={"rfq_vendor_id": rfq_vendor_id})


def declined(conn: sqlite3.Connection, row: Mapping[str, Any], rfq_vendor_id: str) -> str | None:
    return _emit(conn, "rfq.declined", row, "declined", dedupe=f"rfq:{row['id']}:declined", origin={"rfq_vendor_id": rfq_vendor_id})


def question(conn: sqlite3.Connection, row: Mapping[str, Any], rfq_vendor_id: str, message_id: str, *, via: str = "page") -> str | None:
    """A clarification question (the page) or a WhatsApp reply matched to the request (`via = "whatsapp"`, an unverified sender)."""
    kind = "question_whatsapp" if via == "whatsapp" else "question"
    return _emit(conn, "rfq.question", row, kind, dedupe=f"rfq:{row['id']}:question:{rfq_vendor_id}",
                 origin={"rfq_vendor_id": rfq_vendor_id, "message_id": message_id, "via": via})


def answered(conn: sqlite3.Connection, rfq_id: str, rfq_vendor_id: str) -> None:
    """A manager answered the vendor (wrote to him, or marked his questions handled): that vendor's question rows are over."""
    resolve(conn, "rfq.question", f"rfq:{rfq_id}:question:{rfq_vendor_id}")
    resolve(conn, "rfq.question_unanswered", f"rfq:{rfq_id}:qremind:{rfq_vendor_id}")


def question_unanswered(conn: sqlite3.Connection, row: Mapping[str, Any], rfq_vendor_id: str, message_id: str, *, hours: int) -> str | None:
    """RFQQUESTIONS: a vendor question still unanswered after `rfq.question_reminder_hours` (the janitor, once per question; one row
    per vendor). The engine applies each recipient's channels and quiet hours; nothing reaches the vendor."""
    return _emit(conn, "rfq.question_unanswered", row, "question_unanswered", dedupe=f"rfq:{row['id']}:qremind:{rfq_vendor_id}",
                 origin={"rfq_vendor_id": rfq_vendor_id, "message_id": message_id}, hours=hours)


def due_passed(conn: sqlite3.Connection, row: Mapping[str, Any], *, invited: int, quoted: int) -> str | None:
    return _emit(conn, "rfq.due_passed", row, "due_passed", dedupe=f"rfq:{row['id']}:due", invited=invited, quoted=quoted)


def due_moved(conn: sqlite3.Connection, rfq_id: str) -> None:
    """A later deadline reopened the collection: the deadline row is over."""
    resolve(conn, "rfq.due_passed", f"rfq:{rfq_id}:due")


def ended(conn: sqlite3.Connection, rfq_id: str) -> None:
    """Awarded (final), closed, cancelled or deleted: every open row of the request is over."""
    resolve_rfq(conn, rfq_id)


def arrival(conn: sqlite3.Connection, row: Mapping[str, Any], rfq_vendor_id: str, kind: str) -> str | None:
    """CR-RFQ-PAYMENT-SCHEDULE: the awarded vendor confirmed the arrival date (and acknowledged the schedule) or proposed another date
    (`kind` = confirmed | proposed), or - the janitor - did not confirm after both reminders (`unconfirmed`: escalated to the RFQ
    managers, the work order is not blocked). One row per vendor - never a date, an amount or his name."""
    return _emit(conn, "rfq.arrival", row, f"arrival_{kind}", dedupe=f"rfq:{row['id']}:arrival:{rfq_vendor_id}",
                 origin={"rfq_vendor_id": rfq_vendor_id})


def arrival_done(conn: sqlite3.Connection, rfq_id: str, rfq_vendor_id: str) -> None:
    """A manager accepted / rejected the proposed date, or the vendor confirmed (review F8): that vendor's arrival row is over."""
    resolve(conn, "rfq.arrival", f"rfq:{rfq_id}:arrival:{rfq_vendor_id}")


def instalment_overdue(conn: sqlite3.Connection, row: Mapping[str, Any], award_id: str, rfq_vendor_id: str, *, count: int) -> str | None:
    """RFQPAY2: approved instalments of one award are past their due day and not marked paid (the janitor; raised again only when a NEW
    instalment becomes overdue). One row per award, audience `costs` (the RFQ managers with tickets.costs.view). The text carries the
    request's reference, its place and a COUNT - never an amount, a date, the vendor's name or a text."""
    return _emit(conn, "rfq.instalment_overdue", row, "instalment_overdue", dedupe=f"{PAY_PREFIX}:{row['id']}:{award_id}",
                 origin={"rfq_vendor_id": rfq_vendor_id, "award_id": award_id, "audience": "costs"}, count=int(count))


def instalment_settled(conn: sqlite3.Connection, rfq_id: str, award_id: str) -> None:
    """Nothing of that award is overdue any more (paid, cancelled or moved later): its row is over."""
    resolve(conn, "rfq.instalment_overdue", f"{PAY_PREFIX}:{rfq_id}:{award_id}")


def payments_ended(conn: sqlite3.Connection, rfq_id: str) -> None:
    """The request was cancelled, deleted or purged: every overdue-instalment row of it is over."""
    for key in store.open_notification_keys(conn, f"{PAY_PREFIX}:{rfq_id}:"):
        resolve(conn, "rfq.instalment_overdue", key)


# MGRDASH phase 4: "payment due tomorrow" - keyed OUTSIDE `rfq:<id>:` like the overdue rows (`rfqpaydue:<rfq_id>:<award_id>:<day>`)
DUE_PREFIX = "rfqpaydue"


def instalment_due_tomorrow(conn: sqlite3.Connection, row: Mapping[str, Any], award_id: str, rfq_vendor_id: str, *, count: int,
                            day: str) -> str | None:
    """MGRDASH phase 4 (spec section 9): approved instalments of one award are due TOMORROW and not marked paid (the janitor, once per
    award and day - services/tickets/dashboard_alerts.py). Audience `pay`: the RFQ managers who may mark the payment. The reference,
    the place and a COUNT - never an amount, a date, the vendor's name or a text. Off by default (its policy row)."""
    return _emit(conn, "rfq.instalment_due_tomorrow", row, "instalment_due_tomorrow", dedupe=f"{DUE_PREFIX}:{row['id']}:{award_id}:{day}",
                 origin={"rfq_vendor_id": rfq_vendor_id, "award_id": award_id, "audience": "pay"}, count=int(count))


def instalment_due_over(conn: sqlite3.Connection, dedupe: str) -> None:
    """The instalments of that row were paid, moved, or their day came: the row is over."""
    resolve(conn, "rfq.instalment_due_tomorrow", dedupe)


def postponement(conn: sqlite3.Connection, row: Mapping[str, Any], award_id: str, rfq_vendor_id: str, *, late: bool = False) -> str | None:
    """CR-AWARD-NOTICE (contract 20.17): the awarded vendor gave notice, through his link, that he postpones the work. One row per award;
    the text is the reference and the place only (+ the plain word "late" when it was given late - owner decision 2026-10-17) - never the
    proposed date, the reason, the lead time or his name."""
    return _emit(conn, "rfq.vendor_postponement", row, "vendor_postponement_late" if late else "vendor_postponement", dedupe=f"{POST_PREFIX}:{row['id']}:{award_id}",
                 origin={"rfq_vendor_id": rfq_vendor_id, "award_id": award_id})


def postponement_done(conn: sqlite3.Connection, rfq_id: str, award_id: str) -> None:
    """A manager moved the arrival window or acknowledged the notice: its row is over."""
    resolve(conn, "rfq.vendor_postponement", f"{POST_PREFIX}:{rfq_id}:{award_id}")


def postponements_ended(conn: sqlite3.Connection, rfq_id: str) -> None:
    """The request was closed, cancelled, deleted or purged: every postponement row of it is over."""
    for key in store.open_notification_keys(conn, f"{POST_PREFIX}:{rfq_id}:"):
        resolve(conn, "rfq.vendor_postponement", key)
