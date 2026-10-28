"""TPLV2-295: WhatsApp TEMPLATE send v2 from the people screen - the Arx side, against a FAKE WisKey only.

OFF by default (the switch below + the code permit, see services/wa_template_v2_flow.py). Owner decision 25.10: no consent flag; an open
conversation window is enough. WisKey fills the template values itself, so Arx previews the template and the recipient, never the text.

| Route                                                                  | Gate                    | What |
|------------------------------------------------------------------------|-------------------------|------|
| GET/PUT /access-control/messaging/template-send                        | system.configure        | the switch (default OFF), the template references (with WisKey's private pair), the contract status |
| POST /access-control/people/{id}/messages/template-v2/preview          | access.people.message + the person | what Arx would send, the blockers, a binding token |
| POST /access-control/people/{id}/messages/template-v2                  | access.people.message + the person | send ONE template message after the explicit confirmation |

A send follows the free-text send's discipline (routers/access_control_messaging.py): permission before the body, JSON only,
`client_request_id`, every refusal an audited `denied` row, the ATTEMPT recorded BEFORE anything is handed on, then the outcome row.
Audit rows and the record carry ids, the template id and the outcome only - never a phone number, a value, a PIN or a token.
`details.outcome` of an error: `not_sent` | `refused` | `unknown` (504, never retried)."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from ..audit import audit
from ..auth import get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import intercom_messaging as M
from ..services import wa_template_send as wts
from ..services import wa_template_v2_contract as contract
from ..services import wa_template_v2_flow as flow
from ..services.intercom_messaging_adapter import MESSAGING
from . import access_control_messaging as base

router = APIRouter()
AUDIT_SETTINGS = "intercom.messaging.template_send_settings"


# ---------------------------------------------------------------- the administrator's switch and references

class TemplateSendSettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: Any = None
    templates: Any = None


@router.get("/access-control/messaging/template-send")
def template_send_settings(request: Request, principal: Principal = Depends(base._configure_gate),
                           conn: Any = Depends(get_read_conn)) -> dict[str, Any]:
    """The switch (default OFF), the code permit, the template references and the contract status (`system.configure`)."""
    return flow.status_of(conn)


@router.put("/access-control/messaging/template-send")
def put_template_send_settings(request: Request, principal: Principal = Depends(base._configure_gate), raw: bytes = Depends(base._raw_body),
                               conn: Any = Depends(get_read_conn)) -> dict[str, Any]:
    """Save the switch and/or the references (`system.configure`, one audit row: names and counts only). `enabled` must be a JSON
    boolean; `templates` the whole list of `{id, name, language, params, purpose, template_ref?, template_revision?}` (both WisKey
    fields or neither). An omitted field keeps its stored value. 422 `template_send_invalid` lists every problem as `{path, code}`."""
    if not base._is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        body = TemplateSendSettingsBody.model_validate(json.loads(raw) if raw.strip() else {})
    except Exception:  # noqa: BLE001 - any parse problem is a 422
        raise ApiError(422, "validation", "גוף הבקשה אינו תקין.", details={"fields": ["body"]}) from None
    problems: list[dict[str, str]] = []
    refs: list[wts.TemplateRef] | None = None
    if "enabled" in body.model_fields_set and not isinstance(body.enabled, bool):
        problems.append({"path": "enabled", "code": "not_a_boolean"})
    if "templates" in body.model_fields_set:
        refs, tp = wts.validate_registry(body.templates)
        problems += tp
    if problems:
        raise ApiError(422, "template_send_invalid", "הגדרות שליחת התבנית אינן תקינות.", details={"errors": problems})
    db = request.app.state.db
    changed: list[str] = []
    with db.write_aside() as w:
        if "enabled" in body.model_fields_set and wts.switch_on(w) != body.enabled:
            wts.store_switch(w, body.enabled)
            changed.append("enabled")
        if refs is not None and refs != wts.load_registry(w):
            wts.store_registry(w, refs)
            changed.append("templates")
        audit(w, actor=principal, action=AUDIT_SETTINGS, decision="allowed", resource_type="installation", resource_id="messaging",
              request_id=base._rid(request), details={"changed": changed, "enabled": wts.switch_on(w), "templates": len(wts.load_registry(w))})
        out = flow.status_of(w)
    return out


# ---------------------------------------------------------------- one person: preview and send

class PreviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str = Field(min_length=1, max_length=64)


class SendV2Body(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str = Field(pattern=M.COMMAND_ID)
    confirmed: Any = None
    template_id: str = Field(min_length=1, max_length=64)
    preview_token: str = Field(min_length=8, max_length=64)


def _context(act: base._Act, template_id: str) -> dict[str, Any]:
    """The facts both routes need, after the person gate: the reference, the person's observed revision, the account, the token."""
    conn = act.auth.conn
    tpl = next((t for t in wts.load_registry(conn) if t.id == template_id), None)
    rec = act.person()
    person = rec["person"]
    if tpl is not None and tpl.account is not None:
        # WISKEY-ADOPT-2272: a reference synced from WisKey's signed native registry names its own native account
        account, problem = tpl.account, None
    else:
        status = MESSAGING.status(act.settings, act.principal.user_id)
        account, problem = MESSAGING.account_for(status, M.read_settings(conn)["account"])
        if status.get("available") is not True:
            account = None
    revision = person.get("revision") if type(person.get("revision")) is int and person.get("revision") >= 1 else None
    token = flow.binding_token(tpl=tpl, person_id=act.person_id, person_revision=revision, account=account) if tpl is not None else None
    return {"tpl": tpl, "rec": rec, "person": person, "account": account, "problem": problem, "revision": revision, "token": token,
            "blockers": flow.blockers(switch=wts.switch_on(conn), permit=wts.permit(), tpl=tpl, person_revision=revision, account=account)}


@router.post("/access-control/people/{person_id}/messages/template-v2/preview")
def preview_template_v2(request: Request, auth: ia.Authority = Depends(base._gate), raw: bytes = Depends(base._raw_body),
                        person_id: str = Path(min_length=1, max_length=base.MAX_ID, pattern=base.ID_PATTERN)) -> dict[str, Any]:
    """What Arx would hand to WisKey for this person, WITHOUT sending: the template (name, language, purpose), the recipient's name,
    the two observed revisions, `content_shown: false` (WisKey fills the values; Arx cannot show the text), `window: "unknown"`
    (Arx has no window signal; unknown is treated as closed), `blockers` (why a send would be refused now), `can_send` and the
    `token` the confirmation must carry back. Nothing is sent and nothing is recorded."""
    act = base._Act(request, auth, person_id)
    body: PreviewBody = act.parse(PreviewBody, raw)
    act.details.update(kind="template_v2_preview", template_id=body.template_id)
    ctx = _context(act, body.template_id)
    tpl, person = ctx["tpl"], ctx["person"]
    if tpl is None:
        raise act.refuse(ApiError(422, "template_not_found", "התבנית אינה קיימת ברשימת התבניות."))
    return {
        "preview": {
            "template": {"id": tpl.id, "name": tpl.name, "language": tpl.language, "purpose": tpl.purpose, "revision": tpl.wiskey_revision},
            "recipient": {"id": person_id, "display_name": person.get("display_name") or "", "revision": ctx["revision"]},
            "account": ctx["account"], "window": "unknown", "content_shown": False, "fills_from": "wiskey", "token": ctx["token"],
        },
        "blockers": ctx["blockers"], "can_send": not ctx["blockers"], "contract": contract.public_state(),
    }


_BLOCKER_STATUS = {"template_send_off": (409, "template_send_off", "שליחת תבניות כבויה בהגדרות."),
                   "template_unsupported": (409, "template_v2_unavailable", "שליחת תבנית עדיין אינה זמינה במערכת. ההודעה לא נשלחה."),
                   "template_v2_unbound": (422, "template_v2_unbound", "התבנית אינה מקושרת לתבנית של WisKey. ההודעה לא נשלחה."),
                   "person_revision_unknown": (422, "person_revision_unknown", "גרסת כרטיס האדם אינה ידועה. ההודעה לא נשלחה."),
                   "account_unavailable": (503, "message_service_unavailable", "שירות ההודעות אינו מחובר. ההודעה לא נשלחה.")}


def _error_for_verdict(v: flow.Verdict) -> ApiError:
    d: dict[str, Any] = {"outcome": v.outcome}
    if v.code:
        d["code"] = v.code
    if v.outcome == "unknown":
        return ApiError(504, "message_uncertain", "לא ידוע אם ההודעה נשלחה. אל תשלחו שוב לפני שבדקתם עם הנמען.", details=d)
    if v.outcome == "refused":
        return ApiError(502, "template_v2_refused", "WisKey דחתה את שליחת התבנית, והיא לא נשלחה.", details=d)
    if v.code == "paced":
        d["retry_after_s"] = v.retry_after_s or 60
        return ApiError(429, "message_paced", "ההודעה ממתינה לתורה בתקציב השליחה. לא נשלחה - אפשר לנסות שוב מאוחר יותר.", retryable=True, details=d)
    if v.code == "pacing_expired":
        return ApiError(410, "message_pacing_expired", "ההודעה המתינה לתורה זמן רב מדי ולא נשלחה. אפשר לנסות שוב.", retryable=True, details=d)
    if v.code == "window_open":
        return ApiError(409, "template_window_open", "חלון השיחה פתוח - שלחו הודעה רגילה במקום תבנית.", details=d)
    if v.code == "template_unsupported":
        return ApiError(409, "template_v2_unavailable", "שליחת תבנית עדיין אינה זמינה במערכת. ההודעה לא נשלחה.", details=d)
    return ApiError(409, "template_v2_not_sent", "ההודעה לא נשלחה.", details=d)


@router.post("/access-control/people/{person_id}/messages/template-v2")
def send_template_v2(request: Request, auth: ia.Authority = Depends(base._gate), raw: bytes = Depends(base._raw_body),
                     person_id: str = Path(min_length=1, max_length=base.MAX_ID, pattern=base.ID_PATTERN)) -> dict[str, Any]:
    """Send ONE template message (WisKey `template_send_v2`). Body: `{client_request_id, confirmed: true, template_id, preview_token}`.
    Refused before the attempt is recorded (audited, `outcome: not_sent`): no `confirmed` (409), messaging off (409 message_disabled),
    outside the send hours, template send off / unavailable / unbound (409 / 422), a person who asked not to be messaged (409
    message_no_consent), an unknown person revision (422), service not connected (503), a token that no longer matches (409
    template_v2_preview_stale). Then: `sent` (200: the provider ACCEPTED it, delivery unknown), a budget hold (429 / 410), WisKey's closed
    refusal (502 template_v2_refused), or no usable answer (504 message_uncertain; never retried). No consent value is read or sent."""
    act = base._Act(request, auth, person_id)
    body: SendV2Body = act.parse(SendV2Body, raw)
    act.details.update(client_request_id=body.client_request_id, kind="template_v2", template_id=body.template_id)
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שליחת הודעה דורשת אישור מפורש."))
    cfg = M.read_settings(auth.conn)
    if not cfg["enabled"]:
        raise act.refuse(ApiError(409, "message_disabled", "שליחת הודעות כבויה בהגדרות."))
    try:
        M.check_send_hours(auth.conn, cfg)
    except ApiError as exc:
        raise act.refuse(exc) from None
    ctx = _context(act, body.template_id)
    tpl, person, account = ctx["tpl"], ctx["person"], ctx["account"]
    if tpl is None:
        raise act.refuse(ApiError(422, "template_not_found", "התבנית אינה קיימת ברשימת התבניות."))
    for b in ctx["blockers"]:
        raise act.refuse(ApiError(*_BLOCKER_STATUS[b][:3], details={"reason": b}))
    if M.consent_of(auth.conn, person_id, ctx["rec"]["wiskey_consent"], person.get("phone")) == "declined":
        # Arx's own opt-out list (the person ASKED not to be messaged) - not WisKey's consent flag, which this route never reads
        raise act.refuse(ApiError(409, "message_no_consent", "האדם ביקש לא לקבל הודעות."))
    if body.preview_token != ctx["token"]:
        raise act.refuse(ApiError(409, "template_v2_preview_stale", "התבנית או כרטיס האדם השתנו מאז התצוגה המקדימה. הסתכלו שוב ואשרו.", details={"reason": "preview_token"}))
    act.details.update(template_revision=tpl.wiskey_revision)
    try:  # the attempt is recorded BEFORE anything is handed on: no record, no message
        message_id = M.begin_attempt(
            act.db, principal=act.principal, person_id=person_id, kind="template", template_id=tpl.id, template_label=tpl.name[:128],
            template_revision=tpl.wiskey_revision, chars=0, bulk_id=None, bulk_total=None, client_request_id=body.client_request_id,
            request_id=act.rid, cfg=cfg, audit_details=dict(act.details), phone=person.get("phone"), station_ids=ia.person_station_ids(person))
    except ApiError as exc:
        raise act.refuse(exc) from None
    request_id, operation_id = flow.request_ids(body.client_request_id)
    sender = flow.build_sender(act.db)
    try:
        result = sender.send_v2(template_id=tpl.id, account=account, account_key=f"wiskey:{account}", person_id=person_id,
                                recipient_key=f"person:{person_id}", request_id=request_id, operation_id=operation_id,
                                person_revision=ctx["revision"], window="unknown")
        verdict = flow.verdict_of(result)
    except Exception:  # noqa: BLE001 - after the record: an exception may be after the hand-over: unknown, never not_sent
        base.log.warning("template v2: the send raised after the attempt was recorded")
        verdict = flow.Verdict("unknown", "send_error")
    M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=person_id, outcome=verdict.outcome,
                     reason=verdict.code, request_id=act.rid, audit_details={**act.details, "result_version": contract.SCHEMA_VERSION})
    if verdict.outcome != "sent":
        raise _error_for_verdict(verdict)
    return {**base._feed(act.settings), "message": {"id": message_id, "sent_at": M.iso(M.utc()), "outcome": "sent", "delivery": "unknown"}}
