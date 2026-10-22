"""CR-036 WA: the typed message routes - WhatsApp from the people screen ("אנשים"), one person or a selection.

The browser never talks to WisKey and never names a WisKey command: it calls these routes, which check Arx's own permission first
(`access.people.message`, scoped by the access-control station chain like every `access.people.*`), apply Arx's own rules
(services/intercom_messaging.py: settings, templates, the credential guard, the record, the limits, the opt-out list) and hand ONE text
to WisKey through services/intercom_messaging_adapter.py. Owner decisions of 2026-10-12 (answers 9 and 10): templates AND free text,
administrators edit the templates, never an auto-inserted PIN, every send audited, bulk in stage 1. The WisKey side (ask W11) is
unanswered: nothing here has run against a real WisKey (live behaviour NOT_RUN until slice S14), the master switch
(`enabled`, Settings > access control > messages) is OFF until an administrator turns it on.

| Route                                                    | Gate                          | What |
|----------------------------------------------------------|-------------------------------|------|
| GET  /access-control/messaging                           | access.people.message anywhere | the dialog's configuration for this caller (feature, service, templates, allowance) |
| POST /access-control/messaging/recipients                | the same                      | the preview of a selection: who can be messaged and who cannot, and why |
| GET  /access-control/people/{id}/messages                | + the person                  | the person's message history and opt-out |
| POST /access-control/people/{id}/messages                | + the person                  | send ONE message (a bulk run is the browser calling this once per person) |
| PUT  /access-control/people/{id}/messages/optout         | + the person                  | mark / unmark "asked not to be messaged" |
| GET/PUT /access-control/messaging/settings               | system.configure              | the administrator's settings and templates |

A send follows the physical actions' discipline (routers/access_control.py): permission before the body, JSON only, `client_request_id`,
every refusal an audited `denied` row (`outcome: not_sent`), the ATTEMPT recorded (message record + audit row, one transaction) BEFORE
anything is sent - if it cannot be written nothing is sent - then the outcome row. The audit rows and the record carry who, which person
(WisKey's id), the template id or "free", the character count and the outcome - NEVER the text, a phone number, a PIN or WisKey's token.
`details.outcome` of an error says what is known: `not_sent`, `refused` (the service answered with a refusal about this message) or
`unknown` (handed on, no usable answer - never retried by Arx, and never reported as sent).
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, ValidationError

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import intercom_adapter, intercom_sync
from ..services import intercom_authority as ia
from ..services import intercom_consent as C
from ..services import intercom_messaging as M
from ..services.intercom_messaging_adapter import MESSAGING, SendResult

router = APIRouter()
log = logging.getLogger("smplwise.intercom")

MAX_ID = ia.MAX_ID
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"  # the people routes' person id (no control character, no slash)
_ID = re.compile(ID_PATTERN)
CONFIGURE = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _feed(settings: Any) -> dict[str, Any]:
    """The reply header the feed's own state gives (the shape of every typed access-control read)."""
    from ..services import ha_client

    configured = ha_client.configured(settings)
    state = intercom_sync.STATE.state if configured else "ha_not_configured"
    if configured and state == "idle":
        state = "connecting"
    return {"state": state, "configured": configured, "last_error": intercom_sync.STATE.last_error if configured else "ha_not_configured", "fetched_at": None,
            "sync": intercom_sync.STATE.as_dict()}


def _gate(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    """`access.people.message` somewhere a station can be, checked BEFORE any parameter or body is looked at; an audited 403 otherwise."""
    return ia.require_anywhere(conn, principal, M.PERMISSION, _rid(request))


async def _raw_body(request: Request) -> bytes:
    """The body, unparsed - declared after the permission dependency, so a caller without the permission gets 403 whatever they sent."""
    return await request.body()


def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


_configure_gate = read_gate(lambda conn, principal: require(conn, principal, CONFIGURE, INSTALLATION))


# ---------------------------------------------------------------- one request's audit context

class _Act:
    """Who is doing what to which person for one request: every refusal is an audited `denied` row (nothing was sent)."""

    def __init__(self, request: Request, auth: ia.Authority, person_id: str, action: str = M.AUDIT_SEND) -> None:
        self.request, self.auth, self.person_id, self.action = request, auth, person_id, action
        self.principal = auth.principal
        self.db = request.app.state.db
        self.rid = _rid(request)
        self.settings = settings_of(request)
        self.details: dict[str, Any] = {}

    def refuse(self, exc: ApiError) -> ApiError:
        exc.details.setdefault("outcome", "not_sent")
        audit(self.auth.conn, actor=self.principal, action=self.action, decision="denied", resource_type="intercom_person", resource_id=self.person_id,
              reason=exc.code, request_id=self.rid, details={**self.details, "phase": "refused", "outcome": "not_sent"})
        return exc

    def parse(self, model: type[BaseModel], raw: bytes) -> Any:
        content_type = self.request.headers.get("content-type")
        if not _is_json(content_type):
            raise self.refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
        try:
            data = json.loads(raw) if raw.strip() else {}
        except (ValueError, RecursionError):
            raise self.refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
        try:
            return model.model_validate(data)
        except ValidationError as exc:
            fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
            raise self.refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None

    def person(self) -> dict[str, Any]:
        """The person as WisKey has them (a closed superset - ONLY this module's rules look at the phone) - after the two questions
        that matter: is the person visible to the caller at all (404, exactly the answer for a person that does not exist), and may
        the caller message them (403). Returns `{person, wiskey_consent}`; a WisKey that cannot answer is 503."""
        try:
            reply = MESSAGING.recipient(self.settings, self.principal.user_id, self.person_id)
        except ApiError as exc:
            raise self.refuse(_not_found() if exc.status == 404 else exc) from None
        rec = reply.get("recipient")
        if reply.get("state") != "ready" or not isinstance(rec, dict):
            raise self.refuse(_service_unavailable(reply.get("last_error") or reply.get("state")))
        person = rec["person"]
        if person.get("id") != self.person_id or ia.person_level_of(self.auth, person) == ia.NONE:
            raise self.refuse(_not_found())
        if not M.may_message(self.auth, person):
            raise self.refuse(ApiError(403, "message_forbidden", "אין לכם הרשאה לשלוח הודעה לאדם הזה.", details={"permission": M.PERMISSION}))
        return rec


def _not_found() -> ApiError:
    code, message = intercom_adapter.PERSON_NOT_FOUND
    return ApiError(404, code, message)


def _service_unavailable(reason: Any = None) -> ApiError:
    return ApiError(503, "message_service_unavailable", "שירות ההודעות אינו מחובר.", retryable=True, details={"outcome": "not_sent", "reason": str(reason or "unavailable")[:64]})


# ---------------------------------------------------------------- the dialog's configuration

def _quota(cfg: dict[str, Any], conn: sqlite3.Connection, status: dict[str, Any] | None) -> dict[str, Any]:
    """The allowance this caller sees: Arx's own hourly window, or - when WisKey reports a tighter one - WisKey's."""
    mine = M.window_state(conn, cfg["rate_per_hour"])
    theirs = (status or {}).get("quota")
    if isinstance(theirs, dict) and theirs.get("limit") is not None and theirs["limit"] - theirs["used"] < mine["limit"] - mine["used"]:
        return {"limit": theirs["limit"], "used": theirs["used"], "resets_in_s": M.WINDOW_S}
    return mine


@router.get("/access-control/messaging")
def messaging_config(request: Request, auth: ia.Authority = Depends(_gate)) -> dict[str, Any]:
    """What the message dialog needs to know, for THIS caller: `feature` (an administrator switched messaging on), `enabled` (and the
    messaging service is connected), the administrator's `free_text` / `bulk_max`, `text_max`, the approved `templates` (+ their
    `templates_revision`, which a send must carry back), the hourly `quota`, `can_reveal_phone` (the caller holds the sensitive level
    somewhere) and `pace_ms` (the spacing to keep between the sends of a bulk run). With the feature off nothing is asked of WisKey
    and no template is served. Reply: `{state, configured, last_error, fetched_at, messaging, sync}`."""
    settings = settings_of(request)
    cfg = M.read_settings(auth.conn)
    base = {"feature": cfg["enabled"], "enabled": False, "can_send": False, "can_reveal_phone": auth.anywhere(ia.PEOPLE_SENSITIVE), "free_text": cfg["free_text"],
            "bulk_max": cfg["bulk_max"], "text_max": M.TEXT_MAX, "templates": [], "templates_revision": cfg["revision"], "quota": None, "sender_quota": None,
            "send_hours": None, "pace_ms": M.PACE_MS}
    head = _feed(settings)
    if not cfg["enabled"]:
        return {**head, "messaging": base}
    status = MESSAGING.status(settings, auth.principal.user_id)
    account, _problem = MESSAGING.account_for(status, cfg["account"])
    connected = status["available"] is True and account is not None
    return {**head, "messaging": {**base, "enabled": connected, "can_send": True, "templates": M.public_templates(cfg), "quota": _quota(cfg, auth.conn, status),
                                  "sender_quota": M.sender_state(auth.conn, auth.principal.user_id, cfg["per_sender_per_hour"]),
                                  "send_hours": M.send_hours_state(auth.conn, cfg)}}


# ---------------------------------------------------------------- the preview of a selection

class RecipientsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    person_ids: list[str] = Field(min_length=1, max_length=200)


@router.post("/access-control/messaging/recipients")
def messaging_recipients(request: Request, auth: ia.Authority = Depends(_gate), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Who of the people the sender picked can be messaged, for the dialog's preview. At most RECIPIENT_READS (6) people are looked up
    in WisKey (each lookup spends a read token of the sender, whose burst is 10); for each: `{person_id, name, phone_masked, has_phone,
    consent, allowed}` - `allowed` false = visible but not messageable by this caller. `phone_masked`, `has_phone` and `consent`
    (`granted` / `declined` - WisKey's or Arx's opt-out list - / `unknown`) are served ONLY for a person the caller may message AND
    only to a caller at the sensitive level there (review F2: `phone_set` is a sensitive field everywhere else, and the opt-out of a
    person the caller may not message is none of their business); otherwise null - the dialog decides nothing from them and the send
    answers for itself. A person the caller may not see, or WisKey does not know, is simply not in the list (no existence oracle); the
    people past the first RECIPIENT_READS are not looked up - they are decided as each message goes. Reply: `{state, ..., recipients}`."""
    act = _Act(request, auth, "*")
    body: RecipientsBody = act.parse(RecipientsBody, raw)
    if any(not _ID.fullmatch(i) for i in body.person_ids):
        raise act.refuse(ApiError(422, "validation", "מזהה אדם אינו תקין.", details={"fields": ["person_ids"]}))
    cfg = M.read_settings(auth.conn)
    if not cfg["enabled"]:
        raise act.refuse(ApiError(409, "message_disabled", "שליחת הודעות כבויה בהגדרות.", details={"outcome": "not_sent"}))
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    settings = settings_of(request)
    for person_id in body.person_ids:
        if person_id in seen or len(seen) >= M.RECIPIENT_READS:
            continue
        seen.add(person_id)
        try:
            reply = MESSAGING.recipient(settings, auth.principal.user_id, person_id)
        except ApiError:
            continue  # not found (or a refusal of the feed): not listed
        rec = reply.get("recipient")
        if reply.get("state") != "ready" or not isinstance(rec, dict):
            continue
        person = rec["person"]
        level = ia.person_level_of(auth, person)
        if person.get("id") != person_id or level == ia.NONE:
            continue
        allowed = M.may_message(auth, person)
        row: dict[str, Any] = {"person_id": person_id, "name": person.get("display_name") or "", "phone_masked": None, "has_phone": None, "consent": None, "allowed": allowed}
        if allowed and level == ia.SENSITIVE:
            phone = person.get("phone")
            row["phone_masked"] = M.mask_phone(phone)
            row["has_phone"] = person.get("phone_set") if person.get("phone_set") is not None else (bool(phone) if phone is not None else None)
            row["consent"] = M.consent_of(auth.conn, person_id, rec["wiskey_consent"], phone)
        out.append(row)
    return {**_feed(settings), "recipients": out}


# ---------------------------------------------------------------- the person's history and the opt-out

@router.get("/access-control/people/{person_id}/messages")
def person_messages(request: Request, auth: ia.Authority = Depends(_gate), person_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """The person's messages, newest first (who sent which template or "free", when, and whether the service accepted it - never the
    text, never "delivered"), and whether they asked not to be messaged. For a caller who may message the person; 404 for a person they
    may not see, 403 for one they see but may not message. Reply: `{state, ..., messages, opt_out, consent}`."""
    act = _Act(request, auth, person_id)
    rec = act.person()
    phone = rec["person"].get("phone")
    # WA-CONSENT-LINK: messages waiting for the person's consent (`held`) or dropped without it (`dropped`, with the reason word) are listed
    # with the rest, and `consent_request` says whether a consent request is open (`{state: "pending", since, until}` or null).
    # integ/270: the opt-out and the consent are read by record AND by number (WA-SEND-FIX, review F6).
    listed = sorted(M.history(auth.conn, person_id, M.HISTORY_MAX) + C.held_history(auth.conn, person_id), key=lambda m: str(m["at"]), reverse=True)[: M.HISTORY_MAX]
    return {**_feed(act.settings), "messages": listed, "opt_out": M.opted_out(auth.conn, person_id, phone),
            "consent": M.consent_of(auth.conn, person_id, rec["wiskey_consent"], phone), "can_clear_opt_out": _may_clear_opt_out(auth),
            "consent_request": C.person_state(auth.conn, person_id)}


def _may_clear_opt_out(auth: ia.Authority) -> bool:
    """Review F6: clearing a person's "do not message me" is the administrator's (system.configure), not every sender's - the request
    is meant to restrain exactly the role that sends."""
    return authorize(auth.conn, auth.principal, CONFIGURE, INSTALLATION).allowed


class OptOutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    opted_out: StrictBool


@router.put("/access-control/people/{person_id}/messages/optout")
def person_optout(request: Request, auth: ia.Authority = Depends(_gate), raw: bytes = Depends(_raw_body),
                  person_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """Mark a person as one who asked not to be messaged (`opted_out: true`) or clear it. Enforced on every send, whatever WisKey says,
    by the person's record AND their number (review F6). Marking: the same person rule as a send. CLEARING additionally needs
    `system.configure` (403 `message_optout_clear_forbidden`, audited). Audited (`intercom.person.message_optout`: the person id, the
    new state, on a clear how many rows went). Reply: `{opt_out, consent}`."""
    act = _Act(request, auth, person_id, M.AUDIT_OPTOUT)
    body: OptOutBody = act.parse(OptOutBody, raw)
    act.details.update(opted_out=body.opted_out)
    rec = act.person()
    if not body.opted_out and not _may_clear_opt_out(auth):
        raise act.refuse(ApiError(403, "message_optout_clear_forbidden", "רק מנהל מערכת יכול לבטל בקשה של אדם לא לקבל הודעות.", details={"permission": CONFIGURE}))
    state = M.set_opt_out(act.db, principal=act.principal, person_id=person_id, declined=body.opted_out, request_id=act.rid, phone=rec["person"].get("phone"))
    return {"opt_out": state, "consent": M.consent_from(state is not None, rec["wiskey_consent"])}  # (the request's own read snapshot predates the change)


# ---------------------------------------------------------------- the send

class SendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str = Field(pattern=M.COMMAND_ID)
    # the UI's confirmation, stated explicitly: any JSON value is accepted here and only `true` confirms (an audited refusal otherwise)
    confirmed: Any = None
    template_id: str | None = Field(None, min_length=1, max_length=64)
    templates_revision: StrictInt | None = Field(None, ge=0)
    text: str | None = Field(None, max_length=5000)
    bulk_id: str | None = Field(None, pattern=M.BULK_ID)
    bulk_total: StrictInt | None = Field(None, ge=1, le=M.BULK_RANGE[1])


def _error_for(result: SendResult, quota: dict[str, Any] | None) -> ApiError:
    """What a send that did not go out is, as the HTTP answer. `details.outcome` says what is known (not_sent / refused / unknown)."""
    outcome = {"not_sent": "not_sent", "refused": "refused", "unknown": "unknown"}[result.outcome]
    details: dict[str, Any] = {"outcome": outcome}
    if result.wiskey_code:
        details["wiskey_code"] = result.wiskey_code
    code = result.code
    if code == "rate_limited":
        details.update(scope=result.scope or "burst", retry_after_s=result.retry_after_s or 5)
        if quota is not None:
            details["quota"] = quota
        return ApiError(429, "message_rate_limited", "יותר מדי הודעות בזמן קצר. ההודעה לא נשלחה - אפשר לנסות שוב בעוד רגע.", retryable=True, details=details)
    if code == "pair_rate_limited":  # CR-WA-PACING-295: the provider slowed this recipient; nothing left
        details.update(scope="pair", retry_after_s=result.retry_after_s or 300)
        return ApiError(429, "message_pair_rate_limited", "הפלטפורמה האטה שליחה לנמען הזה. ההודעה לא נשלחה - אפשר לנסות שוב מאוחר יותר.", retryable=True, details=details)
    if code == "pacing_expired":  # CR-WA-PACING-295: it waited on the shared send budget past its limit; nothing left
        return ApiError(410, "message_pacing_expired", "ההודעה המתינה לתורה זמן רב מדי ולא נשלחה. אפשר לנסות שוב.", retryable=True, details=details)
    if code == "expired":
        return ApiError(410, "message_expired", "ההודעה פגה לפני שנשלחה, ולכן לא נשלחה. אפשר לנסות שוב.", retryable=True, details=details)
    if code == "person_not_found":
        return _not_found()
    if code == "service_unavailable":
        return ApiError(503, "message_service_unavailable", "שירות ההודעות אינו מחובר. ההודעה לא נשלחה.", retryable=True, details=details)
    if code == "not_registered":
        return ApiError(502, "message_not_registered", "המספר אינו רשום בוואטסאפ. ההודעה לא נשלחה.", details=details)
    if code == "uncertain":
        return ApiError(504, "message_uncertain", "לא ידוע אם ההודעה נשלחה. אל תשלחו שוב לפני שבדקתם עם הנמען.", details=details)
    return ApiError(502, "message_refused", "שירות ההודעות דחה את ההודעה, והיא לא נשלחה.", details=details)


def _fresh_quota(act: _Act, cfg: dict[str, Any], status: dict[str, Any] | None) -> dict[str, Any] | None:
    try:  # a fresh read: this request's own snapshot predates the record it just wrote
        with act.db.connection(mode="read", label="message allowance") as fresh:
            return _quota(cfg, fresh, status)
    except Exception:  # noqa: BLE001 - the allowance line is a courtesy
        log.debug("intercom messaging: the allowance could not be read after a send")
        return None


def _consent_path(act: _Act, cfg: dict[str, Any], body: "SendBody", template: dict[str, str] | None, person: dict[str, Any], account: str,
                  status: dict[str, Any]) -> JSONResponse:
    """WA-CONSENT-LINK (services/intercom_consent.py): `consent_by_link` is on and the person's consent is unknown. Answers 202 with
    `message.outcome`:
    - `held` - a consent request is already open: the template message waits for the answer (`collapsed: true` when the same template
      already waits); beyond HELD_PER_PERSON waiting messages -> 409 `message_consent_pending`; a free text is never held (409, too);
    - `consent_requested` - the consent request went out now (the code-owned text with the single-use link); a template message waits
      (`held: true`), a free text is not kept (`held: false` - the sender sends it again once the person approved).
    Refusals (nothing sent, audited): 409 `message_consent_recently_requested` (one request per person per 30 days, `retry_after_days`),
    409 `message_consent_unavailable` (the public page cannot serve the link: `reason`), and the normal send errors of the consent
    message itself (its attempt is recorded before it is sent, like every message)."""
    now = C.utc()
    held_id: str | None = None
    collapsed = False
    refusal: ApiError | None = None
    with act.db.write_aside() as w:
        dropped = C.expire(w, now)  # a request past its end is closed first (it would otherwise read as open)
        C.notify_dropped(w, dropped)
        kind, req = C.plan(w, act.person_id, now)
        if kind == "open" and template is None:
            refusal = ApiError(409, "message_consent_pending", "האדם עדיין לא אישר קבלת הודעות. הודעה חופשית אינה נשמרת - שלחו אותה שוב אחרי האישור.",
                               details={"held": False})
        elif kind == "open":
            got = C.hold(w, request=req, principal=act.principal, person_id=act.person_id, template=template, client_request_id=body.client_request_id,
                         request_id=act.rid, now=now)
            if got is None:
                refusal = ApiError(409, "message_consent_pending", f"כבר ממתינות {C.HELD_PER_PERSON} הודעות לאישור של האדם הזה.", details={"held": False})
            else:
                held_id, collapsed = got
    if refusal is not None:  # (raised after the transaction: the expiry above stays committed, the refusal's audit row has its own)
        raise act.refuse(refusal)
    if kind == "open":
        return JSONResponse(status_code=202, content={**_feed(act.settings), "message": {"id": held_id, "outcome": "held", "collapsed": collapsed, "consent": "pending",
                                                                                       "until": req["expires_at"]}, "quota": _fresh_quota(act, cfg, status)})
    if kind == "recent":
        raise act.refuse(ApiError(409, "message_consent_recently_requested", "כבר נשלחה לאדם הזה בקשת הסכמה בחודש האחרון, ולא התקבל אישור.",
                                  details={"retry_after_days": C.retry_after_days(req, now)}))
    with act.db.connection(mode="read", label="consent page") as conn:
        problem = C.page_problem(conn)
    if problem is not None:
        raise act.refuse(ApiError(409, "message_consent_unavailable", "אי אפשר לשלוח בקשת הסכמה: הדף הציבורי אינו זמין.", details={"reason": problem}))
    # the consent message: recorded (record + audit row) BEFORE anything is sent, like every message
    details = {**act.details, "kind": "consent", "template_id": C.TEMPLATE_ID}
    try:
        message_id = M.begin_attempt(act.db, principal=act.principal, person_id=act.person_id, kind="template", template_id=C.TEMPLATE_ID, template_label=C.TEMPLATE_LABEL,
                                     template_revision=None, chars=0, bulk_id=None, bulk_total=None, client_request_id=body.client_request_id, request_id=act.rid,
                                     cfg=cfg, audit_details=details,
                                     # integ/270: the consent request counts against the recipient's and the stations' caps (WA-SEND-FIX F3)
                                     phone=person.get("phone"), station_ids=ia.person_station_ids(person))
    except ApiError as exc:
        raise act.refuse(exc) from None
    try:
        with act.db.write_aside() as w:
            req = C.create_request(w, principal=act.principal, person_id=act.person_id, message_id=message_id, cfg=cfg, request_id=act.rid, now=now)
            if template is not None:
                got = C.hold(w, request=req, principal=act.principal, person_id=act.person_id, template=template, client_request_id=body.client_request_id,
                             request_id=act.rid, now=now)
                held_id = got[0] if got else None
            link = C.link_url(w, C.token_of(req))
    except C.ConsentRaced as raced:  # HARDEN271: a parallel send created the request first - nothing is sent, no second request exists
        M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=act.person_id, outcome="not_sent", reason="consent_race", request_id=act.rid,
                         audit_details=details)
        if raced.kind == "recent":
            raise act.refuse(ApiError(409, "message_consent_recently_requested", "כבר נשלחה לאדם הזה בקשת הסכמה בחודש האחרון, ולא התקבל אישור.",
                                      details={"retry_after_days": C.retry_after_days(raced.row, now) if raced.row else C.RESEND_DAYS})) from None
        raise act.refuse(ApiError(409, "message_consent_pending", "בקשת אישור לאדם הזה נשלחה זה עתה. שלחו את ההודעה שוב בעוד רגע.",
                                  details={"held": False})) from None
    except Exception as exc:  # noqa: BLE001 - nothing was sent: the attempt record goes again
        M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=act.person_id, outcome="not_sent", reason="consent_setup", request_id=act.rid,
                         audit_details=details)
        log.warning("intercom consent: the consent request could not be prepared (%s)", type(exc).__name__)
        raise act.refuse(ApiError(409, "message_consent_unavailable", "אי אפשר לשלוח בקשת הסכמה: הדף הציבורי אינו זמין.", details={"reason": "setup"})) from None
    text = C.render_request(cfg["consent_language"], name=person.get("display_name") or "", organization=cfg["organization"], link=link, days=cfg["consent_wait_days"])
    link = ""
    details["chars"] = len(text)
    result = MESSAGING.send(act.settings, act.principal.user_id, act.person_id, account, text,
                            wa_template=C.wa_template(cfg) if cfg["consent_wa_template"] else None)
    text = ""  # neither the text nor the link is kept anywhere past the send
    M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=act.person_id, outcome=result.outcome, reason=result.code or None, request_id=act.rid,
                     audit_details={**details, **({"wiskey_code": result.wiskey_code} if result.wiskey_code else {})})
    C.request_sent(act.db, req, result.outcome, result.code, principal=act.principal, request_id=act.rid)  # (a failed one drops its held message; the sender gets this answer)
    quota = _fresh_quota(act, cfg, status)
    if result.outcome != "sent":
        err = _error_for(result, quota)
        err.details["held"] = result.outcome == "unknown" and held_id is not None
        err.details["consent"] = "requested" if result.outcome == "unknown" else "not_sent"
        raise err
    return JSONResponse(status_code=202, content={**_feed(act.settings), "message": {"id": held_id, "outcome": "consent_requested", "held": held_id is not None,
                                                                                   "consent": "pending", "until": req["expires_at"]}, "quota": quota})


@router.post("/access-control/people/{person_id}/messages")
def send_message(request: Request, auth: ia.Authority = Depends(_gate), raw: bytes = Depends(_raw_body),
                 person_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """Send ONE WhatsApp message to ONE person: an approved template (`template_id` + the `templates_revision` the sender saw; the
    text is Arx's own rendering - the client sends none) or, while the administrator allows it, a free `text`. Body: `{client_request_id,
    confirmed: true, template_id | text, templates_revision?, bulk_id?, bulk_total?}`; a bulk run is the browser calling this once per
    person under one `bulk_id`. Refused before anything is sent (each refusal audited, `details.outcome` `not_sent`): messaging off
    (409 message_disabled), no `confirmed` (409), an empty / too long / credential-like text (422 message_empty / message_too_long /
    message_forbidden_content), free text off (403), a template that is gone (422) or changed (409 message_template_changed), a person the
    caller may not see (404) or may not message (403 message_forbidden), no phone (422 message_no_phone), a person who asked not to be
    messaged (409 message_no_consent), the messaging service not connected (503 message_service_unavailable), the hourly allowance (429
    message_rate_limited, scope `hour`), a repeated `client_request_id` (409 message_duplicate). After the attempt is recorded:
    `message_not_registered` (502), `message_expired` (410), a burst `message_rate_limited` (429, scope `burst`), `message_uncertain`
    (504: handed on, outcome unknown - not retried). "Sent" means the service ACCEPTED it; there is no delivery receipt. Reply:
    `{state, ..., message: {id, sent_at, outcome: "sent"}, quota}`."""
    act = _Act(request, auth, person_id)
    body: SendBody = act.parse(SendBody, raw)
    act.details.update(client_request_id=body.client_request_id)
    if body.bulk_id:
        act.details.update(bulk_id=body.bulk_id)
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שליחת הודעה דורשת אישור מפורש."))
    cfg = M.read_settings(auth.conn)
    if not cfg["enabled"]:
        raise act.refuse(ApiError(409, "message_disabled", "שליחת הודעות כבויה בהגדרות."))
    try:  # review F5: the administrator's send hours (installation zone) - before anything about the text or the person
        M.check_send_hours(auth.conn, cfg)
    except ApiError as exc:
        raise act.refuse(exc) from None
    # the text, before anything is asked of WisKey (a refusal here says nothing about the person)
    template: dict[str, str] | None = None
    text = ""
    try:
        if body.template_id is None:
            act.details.update(kind="free")
            text = M.check_free_text(cfg, body.text)
            act.details.update(chars=len(text))
        else:
            act.details.update(kind="template", template_id=body.template_id)
            if body.text is not None:
                raise ApiError(422, "validation", "בשליחת תבנית אין שולחים טקסט - הטקסט נקבע בשרת.", details={"fields": ["text"]})
            template = M.pick_template(cfg, body.template_id, body.templates_revision)
    except ApiError as exc:
        raise act.refuse(exc) from None
    rec = act.person()
    person = rec["person"]
    if person.get("phone_set") is False:
        raise act.refuse(ApiError(422, "message_no_phone", "לאדם הזה אין מספר טלפון בכרטיס."))
    if M.consent_of(auth.conn, person_id, rec["wiskey_consent"], person.get("phone")) == "declined":  # by record AND by number (review F6)
        raise act.refuse(ApiError(409, "message_no_consent", "האדם ביקש לא לקבל הודעות."))
    if template is not None:
        text = M.render(template["body"], name=person.get("display_name") or "", organization=cfg["organization"])
        act.details.update(chars=len(text))
        if M.looks_like_credential(text):  # review F8: the TEXT the person receives (the person's name is WisKey's)
            raise act.refuse(ApiError(422, "message_forbidden_content", "אי אפשר לשלוח קוד גישה או פרטי כניסה בהודעה."))
    status = MESSAGING.status(act.settings, act.principal.user_id)
    account, problem = MESSAGING.account_for(status, cfg["account"])
    if status["available"] is not True or account is None:
        raise act.refuse(_service_unavailable(problem or status.get("last_error") or status.get("state")))
    if cfg["consent_by_link"] and M.consent_of(auth.conn, person_id, rec["wiskey_consent"], person.get("phone")) == "unknown":
        # WA-CONSENT-LINK: the first message to a person whose consent is unknown is the consent request; the message waits for the answer
        return _consent_path(act, cfg, body, template, person, account, status)
    # the attempt is recorded (record + audit row, one transaction) BEFORE anything is sent: no record, no message
    try:
        message_id = M.begin_attempt(
            act.db, principal=act.principal, person_id=person_id, kind="free" if template is None else "template", template_id=template["id"] if template else None,
            template_label=template["label"] if template else None, template_revision=cfg["revision"] if template else None, chars=len(text), bulk_id=body.bulk_id,
            bulk_total=body.bulk_total, client_request_id=body.client_request_id, request_id=act.rid, cfg=cfg, audit_details=dict(act.details),
            phone=person.get("phone"), station_ids=ia.person_station_ids(person),
        )
    except ApiError as exc:
        raise act.refuse(exc) from None
    result = MESSAGING.send(act.settings, act.principal.user_id, person_id, account, text)
    text = ""  # the text is not kept anywhere past the send
    M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=person_id, outcome=result.outcome, reason=result.code or None, request_id=act.rid,
                     audit_details={**act.details, **({"wiskey_code": result.wiskey_code} if result.wiskey_code else {})})
    quota = None
    try:  # a fresh read: this request's own snapshot predates the record it just wrote
        with act.db.connection(mode="read", label="message allowance") as fresh:
            quota = _quota(cfg, fresh, status)
    except Exception:  # noqa: BLE001 - the allowance line is a courtesy
        log.debug("intercom messaging: the allowance could not be read after a send")
    if result.outcome != "sent":
        raise _error_for(result, quota)
    return {**_feed(act.settings), "message": {"id": message_id, "sent_at": M.iso(M.utc()), "outcome": "sent"}, "quota": quota}


# ---------------------------------------------------------------- the administrator's settings

class SettingsBody(BaseModel):
    """Loose on purpose: the types are the server's own validation (`validate_settings`), which answers every problem as
    `{path, code}` in one 422 the editor can show field by field."""

    model_config = ConfigDict(extra="forbid")
    base_revision: StrictInt = Field(ge=0)
    enabled: Any = None
    free_text: Any = None
    bulk_max: Any = None
    rate_per_hour: Any = None
    # review F3 / F5 (2.6.5): optional - an editor that does not send them keeps the stored values
    per_sender_per_hour: Any = None
    per_person_per_day: Any = None
    per_station_per_hour: Any = None
    send_hours: Any = None  # {"from": "HH:MM", "to": "HH:MM"} | null (= no send hours)
    organization: Any = None
    account: Any = None
    templates: Any = None
    # WA-CONSENT-LINK: optional (a client that predates them keeps the stored values)
    consent_by_link: Any = None
    consent_wait_days: Any = None
    consent_language: Any = None
    consent_wa_template: Any = None
    consent_wa_language: Any = None


OPTIONAL_SETTINGS = ("per_sender_per_hour", "per_person_per_day", "per_station_per_hour", "send_hours")
# integ/270: the audited field names of a save - WA-SEND-FIX's caps / send hours AND WA-CONSENT-LINK's consent keys
SETTINGS_FIELDS = ("enabled", "free_text", "bulk_max", "rate_per_hour", *OPTIONAL_SETTINGS, "organization", "account", "templates") + M.CONSENT_KEYS


def _settings_reply(request: Request, conn: sqlite3.Connection, user_id: str, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = settings_of(request)
    cfg = cfg if cfg is not None else M.read_settings(conn)  # (after a save the request's own read snapshot predates the change: the saved document is passed)
    status = MESSAGING.status(settings, user_id)
    _account, problem = MESSAGING.account_for(status, cfg["account"])
    service = {"state": status["state"], "connected": status["available"], "accounts": status["accounts"], "problem": problem, "last_error": status.get("last_error"),
               # PACING12-295: the account list is capped, never silently (a configured account beyond the cut is `account_not_covered`)
               "accounts_total": status.get("accounts_total", len(status["accounts"])), "accounts_truncated": status.get("accounts_truncated") is True}
    # WA-CONSENT-LINK: whether the public page can serve a consent link now (null = it can; else module_off | public_page | key)
    consent = {"page_problem": C.page_problem(conn), "notice_version": C.NOTICE_VERSION, "resend_days": C.RESEND_DAYS, "held_per_person": C.HELD_PER_PERSON,
               "wait_days": list(M.CONSENT_WAIT_RANGE), "languages": list(M.CONSENT_LANGS), "dev_marked_languages": list(C.DEV_MARKED_LANGS),
               # integ/270 (review C1): false while the adapter cannot forward a WhatsApp Business template (the editor hides the two fields)
               "template_send_supported": M.template_send_supported()}
    return {**_feed(settings), "settings": cfg, "limits": M.limits(), "service": service, "consent": consent}


@router.get("/access-control/messaging/settings")
def messaging_settings(request: Request, principal: Principal = Depends(_configure_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The administrator's message settings (`system.configure`): the master switch, free text, the bulk and hourly limits, the
    organization name, the messaging account, the TEMPLATES and the catalogue's `revision` - plus the limits the editor validates against
    and the state of the messaging service (connected, which accounts). Nothing here is served to anyone else."""
    return _settings_reply(request, conn, principal.user_id)


@router.put("/access-control/messaging/settings")
def put_messaging_settings(request: Request, principal: Principal = Depends(_configure_gate), raw: bytes = Depends(_raw_body),
                           conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Save the settings and templates (`system.configure`, one audit row: the field NAMES that changed and the template count - never a
    body). Body: `{base_revision, enabled, free_text, bulk_max, rate_per_hour, organization, account, templates: [{id?, label, body}]}`.
    The whole document is validated: 422 `message_settings_invalid` with `details.errors` = every problem as `{path, code}`; a
    `base_revision` that is not the stored one is 409 `message_settings_conflict` (someone else saved first). A template without an `id` gets
    one."""
    content_type = request.headers.get("content-type")
    if not _is_json(content_type):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        body = SettingsBody.model_validate(json.loads(raw) if raw.strip() else {})
    except (ValueError, RecursionError, ValidationError):
        raise ApiError(422, "validation", "גוף הבקשה אינו תקין.", details={"fields": ["body"]}) from None
    data = {k: v for k, v in body.model_dump().items() if k != "base_revision" and (k in body.model_fields_set or k not in OPTIONAL_SETTINGS)}
    db = request.app.state.db
    with db.write_aside() as w:
        current = M.read_settings(w)
        if body.base_revision != current["revision"]:
            raise ApiError(409, "message_settings_conflict", "ההגדרות נשמרו בינתיים על ידי מישהו אחר - טענו מחדש.", details={"revision": current["revision"]})
        doc = M.validate_settings(data, current)
        M.save_settings(w, doc)
        changed = sorted(k for k in SETTINGS_FIELDS if doc[k] != current[k])
        audit(w, actor=principal, action=M.AUDIT_SETTINGS, decision="allowed", resource_type="installation", resource_id="messaging", request_id=_rid(request),
              details={"revision": doc["revision"], "changed": changed, "enabled": doc["enabled"], "templates": len(doc["templates"])})
    MESSAGING.forget()
    return _settings_reply(request, conn, principal.user_id, doc)
