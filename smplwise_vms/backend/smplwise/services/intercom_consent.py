"""WA-CONSENT-LINK (docs/changes/CR-WA-CONSENT-LINK.md): opt-in consent by link for the people screen's WhatsApp messages.

Owner decision (2026-10-17): a person whose consent is `unknown` may still be messaged - that stays the default. NEW: the administrator's
`consent_by_link` (in the `access.messaging` document, default OFF). While it is ON and a person's consent is `unknown`, the FIRST message
Arx sends that person is not the requested content but this module's fixed, code-owned CONSENT REQUEST (he / en / ar / ru) carrying a
single-use signed link. The link opens a minimal public page (the tickets public listener, `#c.<token>`) with two buttons:

- approve -> `intercom_consent` = granted (time + the notice version the page showed), and the held message(s) are released - sent through
  the normal path again (permission, consent, template text, the hourly allowance, the attempt record) by the releaser;
- decline -> the person goes on Arx's opt-out list (intercom_message_optout - the list keeps its meaning and its switch), the held messages
  are dropped, nothing is sent;
- no answer within `consent_wait_days` (default 7) -> the request expires, the held messages are dropped with an audit row and the sender is
  told in the app (notification `intercom.message_dropped`).

Rules that keep it from becoming spam: at most ONE consent request per person per RESEND_DAYS (30) days whatever happened to it; while a
request is open, more messages to that person are held (the same template from the same request collapses into one) up to HELD_PER_PERSON
and refused beyond it. Only TEMPLATE messages are held: Arx never stores a message text, so a free text to an `unknown` person starts the
consent request but is not kept (the sender is told to send it again once the person approved).

THE LINK IS NOT A CREDENTIAL. It is a signed capability for ONE consent answer of ONE person: `links.derive_token(module key, id, 1,
domain="wac")` (192 bits; a ticket or RFQ token can never collide with it), stored only as its SHA-256, single use (compare-and-set on the
state), bounded in time, answered with the same uniform 404 when unknown / used / expired / revoked. It grants no access to anything, carries
no PIN or code, and the credential guard of services/intercom_messaging.py is unchanged (it guards what a sender TYPES; the consent text is
code-owned and never passes through a sender).

Audit rows carry ids and counts only - never a phone number, a text, the token or a name."""
from __future__ import annotations

import hashlib
import logging
import re
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta
from typing import Any

from ..db import Database, get_setting
from . import intercom_messaging as M

log = logging.getLogger("smplwise.intercom")

NOTICE_VERSION = "wa-consent-2026-10-17.1"  # bump whenever the page's notice text (frontend public-ticket/consent) changes meaning
RESEND_DAYS = 30
HELD_PER_PERSON = 3
KEEP_DAYS = M.KEEP_DAYS
TEMPLATE_ID = "~consent"  # the intercom_messages row of a consent request (not a valid catalogue id: an administrator can never take it)
TEMPLATE_LABEL = "בקשת הסכמה"
URL_MARK = "c."  # `#c.<token>` - '.' is not a base64url character, so a consent fragment is never a ticket token
TOKEN_DOMAIN = "wac"
OPTOUT_BY = "קישור הסכמה"  # the opt-out row's "by" when the PERSON declined on the consent page
OPTOUT_BY_ID = "~consent"  # ... and its `by_user_id` (HARDEN271, review C3): '~' is never in a user id, so no join can mistake it for one
AUDIT_REQUEST = "intercom.person.consent_request"
AUDIT_ANSWER = "intercom.person.consent_answer"
AUDIT_HELD = "intercom.person.message_held"
NOTIFY_SOURCE = "intercom.message_dropped"
RELEASE_BATCH = 5
LIVE = ("sending", "open")

# The consent request, code-owned (never editable: an administrator's template could drop the decline option). {name} = the person's
# first name, {organization} = the administrator's organisation name, {link} = the page, {days} = how long it waits.
TEXTS: dict[str, str] = {
    "he": "שלום {name},\n{organization} מבקשת את אישורך לקבל ממנה הודעות וואטסאפ בנושא הגישה שלך (כרטיס, תוקף, סגירת כניסה).\n"
          "לאישור או לסירוב: {link}\nהקישור בתוקף {days} ימים. בלי תשובה לא יישלחו אליך הודעות.",
    "en": "Hello {name},\n{organization} asks for your permission to send you WhatsApp messages about your access (card, validity, entrance closures).\n"
          "To approve or decline: {link}\nThe link is valid for {days} days. Without an answer you will not receive messages.",
    "ar": "مرحبًا {name}،\nتطلب {organization} موافقتك على إرسال رسائل واتساب إليك بخصوص دخولك (البطاقة، الصلاحية، إغلاق المدخل).\n"
          "للموافقة أو الرفض: {link}\nالرابط صالح لمدة {days} أيام. بدون رد لن تصلك رسائل.",
    "ru": "Здравствуйте, {name}!\n{organization} просит вашего согласия присылать вам сообщения WhatsApp о вашем доступе (карта, срок действия, закрытие входа).\n"
          "Чтобы согласиться или отказаться: {link}\nСсылка действительна {days} дн. Без ответа сообщения отправляться не будут.",
}
# (ar / ru: dev-marked - they need a native review before release; he / en are the reviewed languages)
DEV_MARKED_LANGS = ("ar", "ru")

DROP_WORDS = {  # the sender's notification (Hebrew, the app's language): why a held message was not sent - never who, never the text
    "declined": "האדם סירב לקבל הודעות בקישור ההסכמה",
    "no_answer": "לא התקבלה תשובה לבקשת ההסכמה בזמן",
    "template_changed": "התבנית שונתה מאז שההודעה הוחזקה",
    "forbidden": "אין לכם עוד הרשאה לשלוח הודעה לאדם הזה",
    "no_consent": "האדם ביקש לא לקבל הודעות",
    "no_phone": "לאדם אין מספר טלפון",
    "disabled": "שליחת ההודעות כובתה",
    "person_not_found": "האדם אינו קיים עוד",
    "refused": "שירות ההודעות דחה את ההודעה",
    "consent_not_sent": "בקשת ההסכמה לא נשלחה",
    "service_unavailable": "שירות ההודעות לא היה זמין",
    "outside_hours": "שעות השליחה לא אפשרו לשלוח אותה בזמן",  # integ/270: WA-SEND-FIX send hours kept it waiting until it went stale
    "message_rate_limited": "מכסת ההודעות לא אפשרה לשלוח אותה בזמן",  # integ/270: a WA-SEND-FIX cap kept it waiting until it went stale
}


# ---------------------------------------------------------------- small helpers

def utc() -> datetime:
    return M.utc()


def iso(moment: datetime) -> str:
    return M.iso(moment)


def body_hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def first_name(display_name: str) -> str:
    words = M._one_line(display_name or "").split(" ")
    return (words[0] if words and words[0] else "")[:40]


def render_request(lang: str, *, name: str, organization: str, link: str, days: int) -> str:
    """The consent request text, in ONE pass (a value is never scanned for placeholders again)."""
    template = TEXTS.get(lang) or TEXTS["he"]
    values = {"name": first_name(name), "organization": M._one_line(organization)[: M.ORGANIZATION_MAX], "link": link, "days": str(int(days))}
    out = re.sub(r"\{(name|organization|link|days)\}", lambda m: values[m.group(1)], template)
    return out.replace(" ,", ",").replace(" !", "!")


def wa_template(cfg: dict[str, Any]) -> dict[str, Any]:
    """The WhatsApp Business template of the consent request as the administrator configured it. Its body must take the parameters in
    THIS order: {{1}} the person's first name, {{2}} the organisation, {{3}} the link, {{4}} the days (CR-WA-CONSENT-LINK section 4)."""
    return {"name": cfg["consent_wa_template"], "language": cfg["consent_wa_language"] or cfg["consent_language"],
            "params": ["name", "organization", "link", "days"]}


def new_request_id() -> str:
    return secrets.token_hex(16)


def token_of(row: dict[str, Any]) -> str:
    """The token of a request row (derived again; never stored, never logged)."""
    from .tickets import links
    from .tickets.keyring import KEYS

    return links.derive_token(KEYS.get(row["key_id"]), row["id"], 1, domain=TOKEN_DOMAIN)


def link_url(conn: sqlite3.Connection, token: str) -> str:
    from .tickets import handler_links, links

    if links.parse_token(token) is None:
        raise ValueError("not a link token")
    return links.public_url(handler_links.public_base_url(conn), f"#{URL_MARK}{token}", handler_links.public_prefix(conn))


def page_problem(conn: sqlite3.Connection) -> str | None:
    """Why the consent page cannot be served now (None = it can): the tickets module (the public listener answers 404 while it is off),
    the listener and the public address (public_runtime.ready), the module key."""
    from .tickets.keyring import KEYS
    from .tickets.module_key import ModuleKeyError
    from .tickets.public_runtime import RUNTIME

    if (get_setting(conn, "tickets.enabled", "false") or "false") != "true":
        return "module_off"
    try:
        if not RUNTIME.ready(conn):
            return "public_page"
    except Exception:  # noqa: BLE001 - fail closed
        return "public_page"
    try:
        KEYS.current(create=False)
    except (ModuleKeyError, Exception):  # noqa: BLE001 - fail closed
        return "key"
    return None


# ---------------------------------------------------------------- the person's consent state, as the send decides on it

def expire(conn: sqlite3.Connection, now: datetime) -> list[dict[str, Any]]:
    """Requests past their end without an answer -> `expired`; their held messages -> dropped (`no_answer`). Returns the dropped rows (the
    caller's transaction commits them; `notify_dropped` tells the senders). Idempotent."""
    stamp = iso(now)
    ids = [r[0] for r in conn.execute("SELECT id FROM intercom_consent_requests WHERE state IN ('sending', 'open') AND expires_at <= ?", (stamp,)).fetchall()]
    dropped: list[dict[str, Any]] = []
    for rid in ids:
        if conn.execute("UPDATE intercom_consent_requests SET state = 'expired' WHERE id = ? AND state IN ('sending', 'open')", (rid,)).rowcount != 1:
            continue
        rows = drop_held(conn, rid, "no_answer", now)
        dropped.extend(rows)
        person = conn.execute("SELECT person_id FROM intercom_consent_requests WHERE id = ?", (rid,)).fetchone()
        _audit(conn, AUDIT_ANSWER, person[0] if person else None, {"consent_request_id": rid, "answer": "none", "outcome": "expired", "dropped": len(rows)})
    return dropped


def drop_held(conn: sqlite3.Connection, request_id: str, reason: str, now: datetime) -> list[dict[str, Any]]:
    rows = [dict(r) for r in conn.execute("SELECT * FROM intercom_held_messages WHERE consent_request_id = ? AND state IN ('held', 'due')", (request_id,)).fetchall()]
    for r in rows:
        conn.execute("UPDATE intercom_held_messages SET state = 'dropped', reason = ?, done_at = ? WHERE id = ?", (reason, iso(now), r["id"]))
        _audit(conn, AUDIT_HELD, r["person_id"], {"held_id": r["id"], "consent_request_id": request_id, "outcome": "dropped", "reason": reason,
                                                  "template_id": r["template_id"]}, actor_user_id=r["actor_user_id"])
    return [{**r, "reason": reason} for r in rows]


def plan(conn: sqlite3.Connection, person_id: str, now: datetime) -> tuple[str, dict[str, Any] | None]:
    """What a send to an `unknown` person does: ('open', request) - a request is live, hold the message; ('recent', request) - one was sent
    within RESEND_DAYS and is over (no second request); ('new', None) - send a consent request now."""
    live = conn.execute("SELECT * FROM intercom_consent_requests WHERE person_id = ? AND state IN ('sending', 'open') AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
                        (person_id, iso(now))).fetchone()
    if live is not None:
        return "open", dict(live)
    recent = conn.execute("SELECT * FROM intercom_consent_requests WHERE person_id = ? AND state <> 'failed' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
                          (person_id, iso(now - timedelta(days=RESEND_DAYS)))).fetchone()
    if recent is not None:
        return "recent", dict(recent)
    return "new", None


def retry_after_days(row: dict[str, Any], now: datetime) -> int:
    try:
        created = datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
    except ValueError:
        return RESEND_DAYS
    return max(1, (created + timedelta(days=RESEND_DAYS) - now).days + 1)


def hold(conn: sqlite3.Connection, *, request: dict[str, Any], principal: Any, person_id: str, template: dict[str, str], client_request_id: str,
         request_id: str | None, now: datetime) -> tuple[str, bool] | None:
    """Hold one template message on a live request. Returns (held id, collapsed) - collapsed when the same template (same body) already waits
    on this request - or None when HELD_PER_PERSON messages already wait (the caller refuses)."""
    digest = body_hash(template["body"])
    same = conn.execute("SELECT id FROM intercom_held_messages WHERE consent_request_id = ? AND state IN ('held', 'due') AND template_id = ? AND body_hash = ?",
                        (request["id"], template["id"], digest)).fetchone()
    if same is not None:
        _audit(conn, AUDIT_HELD, person_id, {"held_id": same[0], "consent_request_id": request["id"], "outcome": "collapsed", "template_id": template["id"],
                                             "client_request_id": client_request_id}, actor=principal, request_id=request_id)
        return same[0], True
    waiting = conn.execute("SELECT COUNT(*) FROM intercom_held_messages WHERE person_id = ? AND state IN ('held', 'due')", (person_id,)).fetchone()[0]
    if waiting >= HELD_PER_PERSON:
        return None
    held_id = uuid.uuid4().hex
    name = (getattr(principal, "display_name", None) or getattr(principal, "username", None) or "")[:128] or None
    conn.execute(
        """INSERT INTO intercom_held_messages(id, consent_request_id, person_id, actor_user_id, actor_name, actor_username, actor_source, template_id,
                                              template_label, body_hash, client_request_id, request_id, created_at, state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'held')""",
        (held_id, request["id"], person_id, principal.user_id, name, (getattr(principal, "username", None) or "")[:128] or None,
         str(getattr(principal, "source", "") or "ingress")[:16], template["id"], template["label"], digest, client_request_id, request_id, iso(now)),
    )
    _audit(conn, AUDIT_HELD, person_id, {"held_id": held_id, "consent_request_id": request["id"], "outcome": "held", "template_id": template["id"],
                                         "client_request_id": client_request_id}, actor=principal, request_id=request_id)
    return held_id, False


class ConsentRaced(Exception):
    """Another send created (or recently sent) this person's consent request between `plan()` and the insert."""

    def __init__(self, kind: str, row: dict[str, Any] | None) -> None:
        super().__init__(kind)
        self.kind = kind
        self.row = row


def create_request(conn: sqlite3.Connection, *, principal: Any, person_id: str, message_id: str, cfg: dict[str, Any], request_id: str | None,
                   now: datetime) -> dict[str, Any]:
    """A new consent request row (state `sending`) under the current module key. The caller holds the write transaction."""
    from .tickets import links
    from .tickets.keyring import KEYS

    # HARDEN271 (review residual): never a second live consent request per person. `plan()` ran in an earlier transaction, so two sends to
    # the same `unknown` person could both see "new"; the check is repeated here, inside the write transaction that inserts (SQLite holds
    # the write lock from the first statement: the two inserts are serialised and the second one sees the first).
    kind, existing = plan(conn, person_id, now)
    if kind != "new":
        raise ConsentRaced(kind, existing)
    key_id, key = KEYS.current(create=False)
    rid = new_request_id()
    token = links.derive_token(key, rid, 1, domain=TOKEN_DOMAIN)
    row = {"id": rid, "person_id": person_id, "key_id": key_id, "token_hash": links.token_hash(token), "created_at": iso(now),
           "expires_at": iso(now + timedelta(days=cfg["consent_wait_days"])), "actor_user_id": principal.user_id, "message_id": message_id,
           "lang": cfg["consent_language"], "state": "sending"}
    conn.execute(
        """INSERT INTO intercom_consent_requests(id, person_id, key_id, token_hash, created_at, expires_at, actor_user_id, message_id, lang, state)
           VALUES (:id, :person_id, :key_id, :token_hash, :created_at, :expires_at, :actor_user_id, :message_id, :lang, :state)""", row)
    _audit(conn, AUDIT_REQUEST, person_id, {"consent_request_id": rid, "phase": "attempt", "message_id": message_id, "wait_days": cfg["consent_wait_days"],
                                            "lang": cfg["consent_language"]}, actor=principal, request_id=request_id)
    return row


def request_sent(db: Database, request: dict[str, Any], outcome: str, reason: str | None, *, principal: Any, request_id: str | None) -> list[dict[str, Any]]:
    """The consent message's outcome: `sent` / `unknown` -> the request is open (an unknown one may have reached the person, so it can be
    answered); `refused` / `not_sent` -> `failed` (it never reached anyone: it does not count for the 30-day rule) and its held messages are
    dropped. Returns the dropped rows."""
    now = utc()
    with db.write_aside() as w:
        if outcome in ("sent", "unknown"):
            w.execute("UPDATE intercom_consent_requests SET state = 'open' WHERE id = ? AND state = 'sending'", (request["id"],))
            dropped: list[dict[str, Any]] = []
        else:
            w.execute("UPDATE intercom_consent_requests SET state = 'failed' WHERE id = ? AND state = 'sending'", (request["id"],))
            dropped = drop_held(w, request["id"], "consent_not_sent", now)
        _audit(w, AUDIT_REQUEST, request["person_id"], {"consent_request_id": request["id"], "phase": "outcome", "outcome": outcome, "reason": reason},
               actor=principal, request_id=request_id)
    return dropped


# ---------------------------------------------------------------- the public page (services/tickets/public_consent.py calls these)

def lookup(conn: sqlite3.Connection, token_hash: str, now: datetime) -> dict[str, Any] | None:
    """The live request of a presented token, or None (unknown, answered, expired, failed - one answer for all)."""
    row = conn.execute("SELECT * FROM intercom_consent_requests WHERE token_hash = ?", (token_hash,)).fetchone()
    if row is None or row["state"] not in LIVE or str(row["expires_at"]) <= iso(now):
        return None
    return dict(row)


def page_view(conn: sqlite3.Connection, request: dict[str, Any]) -> dict[str, Any]:
    """What the page shows: the organisation (the administrator's messaging name, else the public pages' name), the logo, the look, the
    notice version the answer must carry back, and the language the request was sent in. NO personal data (no name, no number)."""
    from .tickets import brand, settings_doc

    cfg = M.read_settings(conn)
    pub = brand.public_brand(conn)
    organization = M._one_line(cfg["organization"])[: M.ORGANIZATION_MAX] or pub.get("organization") or ""
    return {"organization": organization, "logo": pub.get("logo"), "theme": settings_doc.read(conn)["public"].get("theme", "light"),
            "notice_version": NOTICE_VERSION, "lang": request["lang"], "expires_at": request["expires_at"]}


def answer(conn: sqlite3.Connection, token_hash: str, choice: str, now: datetime) -> tuple[str, list[dict[str, Any]], int] | None:
    """The person's answer (single use: compare-and-set on the state). Returns (state, dropped held rows, released count) or None when the
    token is not live (the caller answers the uniform 404). The caller holds the write transaction."""
    if choice not in ("approve", "decline"):
        raise ValueError("choice")
    row = lookup(conn, token_hash, now)
    if row is None:
        return None
    state = "granted" if choice == "approve" else "declined"
    stamp = iso(now)
    if conn.execute("UPDATE intercom_consent_requests SET state = ?, answered_at = ?, notice_version = ? WHERE id = ? AND state IN ('sending', 'open') AND expires_at > ?",
                    (state, stamp, NOTICE_VERSION, row["id"], stamp)).rowcount != 1:
        return None
    dropped: list[dict[str, Any]] = []
    released = 0
    if state == "granted":
        conn.execute("""INSERT INTO intercom_consent(person_id, state, at, notice_version, consent_request_id) VALUES (?, 'granted', ?, ?, ?)
                        ON CONFLICT(person_id) DO UPDATE SET state = 'granted', at = excluded.at, notice_version = excluded.notice_version,
                        consent_request_id = excluded.consent_request_id""", (row["person_id"], stamp, NOTICE_VERSION, row["id"]))
        released = conn.execute("UPDATE intercom_held_messages SET state = 'due' WHERE consent_request_id = ? AND state = 'held'", (row["id"],)).rowcount
    else:
        # the opt-out list keeps its meaning: a decline on the page is exactly "asked not to be messaged" (an administrator may clear it)
        # HARDEN271 (review C3): the row names who set it - the person, through the consent link (OPTOUT_BY_ID, never a user id) - not NULL
        conn.execute("INSERT INTO intercom_message_optout(person_id, at, by_user_id, by_name) VALUES (?, ?, ?, ?) ON CONFLICT(person_id) DO NOTHING",
                     (row["person_id"], stamp, OPTOUT_BY_ID, OPTOUT_BY))
        conn.execute("DELETE FROM intercom_consent WHERE person_id = ?", (row["person_id"],))
        dropped = drop_held(conn, row["id"], "declined", now)
    _audit(conn, AUDIT_ANSWER, row["person_id"], {"consent_request_id": row["id"], "answer": state, "notice_version": NOTICE_VERSION,
                                                  "due": released, "dropped": len(dropped)})
    return state, dropped, released


# ---------------------------------------------------------------- the person's page and the sender's view

def person_state(conn: sqlite3.Connection, person_id: str, now: datetime | None = None) -> dict[str, Any] | None:
    """The live consent request of a person, for the person's tab: `{state: "pending", since, until}` or None."""
    now = now or utc()
    try:
        row = conn.execute("SELECT created_at, expires_at FROM intercom_consent_requests WHERE person_id = ? AND state IN ('sending', 'open') AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
                           (person_id, iso(now))).fetchone()
    except sqlite3.OperationalError:
        return None
    return {"state": "pending", "since": row[0], "until": row[1]} if row else None


def held_history(conn: sqlite3.Connection, person_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Held / dropped messages for the person's history (`outcome` held | dropped; a released one is in intercom_messages already)."""
    try:
        rows = conn.execute("SELECT id, created_at, actor_name, template_id, template_label, state, reason FROM intercom_held_messages WHERE person_id = ? AND state IN ('held', 'due', 'releasing', 'dropped') ORDER BY created_at DESC LIMIT ?",
                            (person_id, max(1, min(limit, M.HISTORY_MAX)))).fetchall()
    except sqlite3.OperationalError:
        return []
    return [{"id": r["id"], "at": r["created_at"], "by": r["actor_name"], "kind": "template", "template_id": r["template_id"], "template_label": r["template_label"],
             "outcome": "dropped" if r["state"] == "dropped" else "held", "reason": r["reason"], "bulk": False} for r in rows]


# ---------------------------------------------------------------- audit and the sender's notification

def _audit(conn: sqlite3.Connection, action: str, person_id: str | None, details: dict[str, Any], *, actor: Any = None, actor_user_id: str | None = None,
           request_id: str | None = None) -> None:
    from ..audit import audit

    if actor is None and actor_user_id:
        details = {**details, "sender": actor_user_id}
    audit(conn, actor=actor, action=action, decision="allowed", resource_type="intercom_person", resource_id=person_id, request_id=request_id, details=details)


def notify_dropped(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    """Tell each sender, in the app, that a held message was not sent (one notification per held message; no person name, no text)."""
    from . import notify

    for r in rows:
        try:
            word = DROP_WORDS.get(str(r.get("reason")), "ההודעה לא נשלחה")
            label = M._one_line(str(r.get("template_label") or ""))[: M.LABEL_MAX]
            detail = f"ההודעה \"{label}\" לא נשלחה: {word}." if label else f"ההודעה לא נשלחה: {word}."
            notify.emit_full(conn, notify.Signal(NOTIFY_SOURCE, "session", r["actor_user_id"], dedupe_key=f"{NOTIFY_SOURCE}:{r['id']}",
                                                 params={"detail": detail}, initiator_user_id=r["actor_user_id"], link="#/access-control/people",
                                                 origin={"kind": "intercom_message", "held_id": r["id"]}))
        except Exception:  # noqa: BLE001 - the drop itself stands (audited); the notification is a courtesy
            log.warning("intercom consent: the sender of held message %s could not be notified", r.get("id"))


# ---------------------------------------------------------------- the releaser (approved -> the held messages are sent)

def release_due(db: Database, settings: Any, *, limit: int = RELEASE_BATCH) -> dict[str, int]:
    """Send the held messages of approved requests, each through the normal rules again: messaging on, the template unchanged (same body),
    the sender still allowed to message the person, the person's consent still granted (an opt-out set meanwhile wins), a phone, the service
    connected, the hourly allowance, the attempt recorded before the send. A temporary obstacle (service, allowance, burst) leaves it due;
    anything else drops it (audited, the sender notified). An unknown outcome is never retried."""
    from ..errors import ApiError
    from ..rbac import Principal
    from . import intercom_authority as ia
    from .intercom_messaging_adapter import MESSAGING

    counts = {"released": 0, "dropped": 0, "retry": 0}
    with db.connection(mode="read", label="intercom consent due") as conn:
        due = [dict(r) for r in conn.execute("SELECT * FROM intercom_held_messages WHERE state = 'due' ORDER BY created_at LIMIT ?", (limit,)).fetchall()]
    for row in due:
        with db.write_aside() as w:
            if w.execute("UPDATE intercom_held_messages SET state = 'releasing' WHERE id = ? AND state = 'due'", (row["id"],)).rowcount != 1:
                continue
        outcome, reason, message_id = _release_one(db, settings, row, ApiError, Principal, ia, MESSAGING)
        now = utc()
        with db.write_aside() as w:
            if outcome == "retry":
                w.execute("UPDATE intercom_held_messages SET state = 'due' WHERE id = ? AND state = 'releasing'", (row["id"],))
                counts["retry"] += 1
                stale = _age_days(row["created_at"], now) > M.read_settings(w)["consent_wait_days"] + RESEND_DAYS
                if not stale:
                    continue
                outcome, reason = "dropped", reason or "service_unavailable"
            if outcome == "released":
                w.execute("UPDATE intercom_held_messages SET state = 'released', reason = ?, message_id = ?, done_at = ? WHERE id = ?", (reason, message_id, iso(now), row["id"]))
                _audit(w, AUDIT_HELD, row["person_id"], {"held_id": row["id"], "outcome": "released", "message_id": message_id, "reason": reason,
                                                          "template_id": row["template_id"]}, actor_user_id=row["actor_user_id"])
                counts["released"] += 1
            else:
                w.execute("UPDATE intercom_held_messages SET state = 'dropped', reason = ?, done_at = ? WHERE id = ?", (reason, iso(now), row["id"]))
                _audit(w, AUDIT_HELD, row["person_id"], {"held_id": row["id"], "outcome": "dropped", "reason": reason, "template_id": row["template_id"]},
                       actor_user_id=row["actor_user_id"])
                notify_dropped(w, [{**row, "reason": reason}])
                counts["dropped"] += 1
    return counts


def _age_days(stamp: str, now: datetime) -> float:
    try:
        return (now - datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))).total_seconds() / 86400
    except ValueError:
        return 0.0


RELEASE_PERMISSIONS = ("access.people.message", "access.people.read", "access.people.sensitive")  # what the release re-checks (may_message, person_level_of)


def sender_principal(row: dict[str, Any], Principal: Any) -> Any:
    """The held message's sender, rebuilt without a session (HARDEN271, review C2). `factor_ok` is False: there is no interactive second
    factor at release time. That is correct ONLY while no permission the release re-checks is in rbac.LOCAL_ADMIN_PERMISSIONS (the
    local-identity factor gate) - otherwise every Arx-only sender's held message would be dropped `forbidden`. The release therefore
    refuses to run on such a build (fail closed, loud), and tests/test_harden271_consent.py pins the set."""
    from ..rbac import LOCAL_ADMIN_PERMISSIONS

    clash = sorted(set(RELEASE_PERMISSIONS) & set(LOCAL_ADMIN_PERMISSIONS))
    if clash:
        raise RuntimeError(f"held-message release needs a stored second factor for {clash}")
    return Principal(user_id=row["actor_user_id"], username=row["actor_username"] or row["actor_user_id"], display_name=row["actor_name"] or "",
                     source=row["actor_source"] or "ingress", factor_ok=False)


def _release_one(db: Database, settings: Any, row: dict[str, Any], ApiError: Any, Principal: Any, ia: Any, MESSAGING: Any) -> tuple[str, str | None, str | None]:
    """(released | dropped | retry, reason, message id) for one held message."""
    try:
        principal = sender_principal(row, Principal)
    except RuntimeError:
        log.error("intercom consent: held message %s waits - the release cannot prove the sender's second factor", str(row.get("id"))[:8])
        return "retry", "factor_unavailable", None
    with db.connection(mode="read", label="intercom consent release") as conn:
        cfg = M.read_settings(conn)
        if not cfg["enabled"]:
            return "dropped", "disabled", None
        try:  # integ/270 (WA-SEND-FIX review F5): outside the administrator's send hours a held message waits (retry), never sent
            M.check_send_hours(conn, cfg)
        except ApiError:
            return "retry", "outside_hours", None
        template = next((t for t in cfg["templates"] if t["id"] == row["template_id"]), None)
        if template is None or body_hash(template["body"]) != row["body_hash"]:
            return "dropped", "template_changed", None
        try:
            reply = MESSAGING.recipient(settings, principal.user_id, row["person_id"])
        except ApiError as exc:
            return ("dropped", "person_not_found", None) if exc.status == 404 else ("retry", "service_unavailable", None)
        rec = reply.get("recipient")
        if reply.get("state") != "ready" or not isinstance(rec, dict):
            return "retry", "service_unavailable", None
        person = rec["person"]
        auth = ia.Authority(conn, principal)
        if person.get("id") != row["person_id"] or ia.person_level_of(auth, person) == ia.NONE or not M.may_message(auth, person):
            return "dropped", "forbidden", None
        if M.consent_of(conn, row["person_id"], rec["wiskey_consent"], person.get("phone")) != "granted":  # opt-out by number too (WA-SEND-FIX F6)
            return "dropped", "no_consent", None
        if person.get("phone_set") is False:
            return "dropped", "no_phone", None
        text = M.render(template["body"], name=person.get("display_name") or "", organization=cfg["organization"])
    status = MESSAGING.status(settings, principal.user_id)
    account, _problem = MESSAGING.account_for(status, cfg["account"])
    if status["available"] is not True or account is None:
        return "retry", "service_unavailable", None
    audit_details = {"kind": "template", "template_id": template["id"], "chars": len(text), "held_id": row["id"], "released": True}
    try:
        message_id = M.begin_attempt(db, principal=principal, person_id=row["person_id"], kind="template", template_id=template["id"], template_label=template["label"],
                                     template_revision=cfg["revision"], chars=len(text), bulk_id=None, bulk_total=None, client_request_id=f"held-{row['id']}",
                                     request_id=None, cfg=cfg, audit_details=audit_details,
                                     phone=person.get("phone"), station_ids=ia.person_station_ids(person))  # integ/270: the WA-SEND-FIX caps
    except ApiError as exc:
        if exc.code == "message_duplicate":
            return "released", "duplicate", None  # an earlier pass recorded it (a crash between the two rows): never sent twice
        return "retry", exc.code, None
    result = MESSAGING.send(settings, principal.user_id, row["person_id"], account, text)
    text = ""
    M.finish_attempt(db, principal=principal, message_id=message_id, person_id=row["person_id"], outcome=result.outcome, reason=result.code or None, request_id=None,
                     audit_details={**audit_details, **({"wiskey_code": result.wiskey_code} if result.wiskey_code else {})})
    if result.outcome == "sent":
        return "released", None, message_id
    if result.outcome == "unknown":
        return "released", "uncertain", message_id  # handed on, outcome unknown: never retried
    if result.outcome == "not_sent" and result.code in ("rate_limited", "service_unavailable", "expired"):
        return "retry", result.code, None
    return "dropped", "person_not_found" if result.code == "person_not_found" else "refused", None


def prune(conn: sqlite3.Connection, now: datetime) -> None:
    cut = iso(now - timedelta(days=KEEP_DAYS))
    conn.execute("DELETE FROM intercom_held_messages WHERE created_at < ? AND state IN ('released', 'dropped')", (cut,))
    conn.execute("DELETE FROM intercom_consent_requests WHERE created_at < ? AND state NOT IN ('sending', 'open')", (cut,))


class Releaser:
    """One daemon thread per process that runs `release_due` when kicked (the public page's approve; the janitor every 30 s). The public
    listener never waits for WisKey: it only marks the messages due and kicks."""

    def __init__(self) -> None:
        self._event = threading.Event()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._db: Database | None = None
        self._settings: Any = None
        self._stop = False

    def configure(self, db: Database, settings: Any) -> None:
        with self._lock:
            self._db, self._settings = db, settings

    def kick(self) -> None:
        with self._lock:
            if self._db is None or self._stop:
                return  # not configured yet: the janitor's next tick releases them
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._run, name="intercom-consent-release", daemon=True)
                self._thread.start()
        self._event.set()

    def stop(self) -> None:
        with self._lock:
            self._stop = True
        self._event.set()

    def _run(self) -> None:
        while True:
            self._event.wait(timeout=30.0)
            self._event.clear()
            with self._lock:
                if self._stop:
                    return
                db, settings = self._db, self._settings
            try:
                if db is not None:
                    for _ in range(20):  # a burst of approvals: a few batches, then wait for the next kick / tick
                        counts = release_due(db, settings)
                        if counts["released"] + counts["dropped"] < RELEASE_BATCH:
                            break
            except Exception:  # noqa: BLE001 - the rows stay due; the next kick tries again
                log.exception("intercom consent: releasing held messages failed")


RELEASER = Releaser()


def tick(db: Database, settings: Any) -> None:
    """The janitor's step (every 30 s): expire unanswered requests (drop + audit + notify), prune old rows, and kick the releaser."""
    now = utc()
    with db.write_aside() as w:
        dropped = expire(w, now)
        notify_dropped(w, dropped)
        prune(w, now)
    RELEASER.configure(db, settings)
    with db.connection(mode="read", label="intercom consent due?") as conn:
        if conn.execute("SELECT 1 FROM intercom_held_messages WHERE state = 'due' LIMIT 1").fetchone() is not None:
            RELEASER.kick()
