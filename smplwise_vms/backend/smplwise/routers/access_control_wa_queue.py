"""WISKEY-WA-QUEUE-2400 (T12): WhatsApp messaging on the installed WisKey client - the template registry refresh, the durable template
queue (enqueue / job / cancel), the v3 send-now outcome and the opt-in for WisKey's versioned paced free-text send. Service:
services/wiskey_wa_queue.py. Change doc: docs/changes/WISKEY-WA-QUEUE-2400.md.

| Route                                                                              | Gate                                | What |
|------------------------------------------------------------------------------------|-------------------------------------|------|
| GET  /access-control/messaging/installed                                           | system.configure                    | the overview: gates, what WisKey's join selects now, the registry by source, the queue journal |
| PUT  /access-control/messaging/installed                                           | system.configure                    | `send_pacing_v1` (default OFF) |
| POST /access-control/messaging/installed/registry-sync                             | system.configure                    | refresh the registry from WisKey now |
| POST /access-control/people/{id}/messages/template-installed                       | access.people.message + the person  | ONE template message, `mode`: `queue` (durable queue) or `now` (v3) |
| GET  /access-control/people/{id}/messages/template-installed/{operation_id}        | the same                            | the job's state, read from WisKey when it can be |
| POST /access-control/people/{id}/messages/template-installed/{operation_id}/cancel | the same                            | cancel a job that is still queued |

The send runs the v2 route's admission unchanged (`access_control_template_v2.admit_and_record`: confirmation, messaging switch, send
hours, the template switch AND the code permit, the reference and its WisKey pair, the person revision, the account rule, the opt-out
list, the preview token, the attempt row BEFORE any hand-over); the sender (`wa_template_send.TemplateSender.send_v2`) then applies the
shared budget and the wire bounds. Nothing here opens a permit or a switch. Audit rows and records carry ids, codes and outcomes only."""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import intercom_messaging as M
from ..services import wa_template_send as wts
from ..services import wa_template_v2_flow as flow
from ..services import wiskey_wa_queue as wq
from ..services.intercom_messaging_adapter import paced_listed
from . import access_control_messaging as base
from . import access_control_template_v2 as tv2

router = APIRouter()
OPERATION_PATTERN = r"^tpl(?:q|v3)-[A-Za-z0-9-]{8,64}$"


# ---------------------------------------------------------------- the administrator's overview, the opt-in and the registry refresh

def _overview(request: Request, conn: Any) -> dict[str, Any]:
    from ..auth import settings_of

    return {
        "settings": wq.load_settings(conn),
        "gates": {"messaging_enabled": M.read_settings(conn)["enabled"], "template_switch": wts.switch_on(conn), "permit": wts.permit()},
        "commands": {**wq.availability(), wq.SEND_PACING_COMMAND: paced_listed(settings_of(request))},
        "registry": wq.registry_view(conn),
        "jobs": wq.jobs_view(conn),
        "queue_ttl_s": wq.QUEUE_TTL_S,
        "delivery_receipts": False,  # WisKey rc.10 reports provider acceptance only; delivery stays unknown
        "excluded": list(wq.EXCLUDED),
    }


def _fresh_overview(request: Request) -> dict[str, Any]:
    """After a write: a NEW read connection (the request's read snapshot predates the write)."""
    with request.app.state.db.connection(mode="read", label="wa installed overview") as conn:
        return _overview(request, conn)


class InstalledSettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    send_pacing_v1: Any = None


@router.get("/access-control/messaging/installed")
def installed_overview(request: Request, principal: Principal = Depends(base._configure_gate),
                       conn: Any = Depends(get_read_conn)) -> dict[str, Any]:
    """The gates (messaging switch, template switch, code permit), what WisKey's join selects now, the registry by source, the queue journal."""
    return _overview(request, conn)


@router.put("/access-control/messaging/installed")
def put_installed_settings(request: Request, principal: Principal = Depends(base._configure_gate),
                           raw: bytes = Depends(base._raw_body)) -> dict[str, Any]:
    """`send_pacing_v1` must be a JSON boolean. One audit row (the value only)."""
    if not base._is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        body = InstalledSettingsBody.model_validate(json.loads(raw) if raw.strip() else {})
    except Exception:  # noqa: BLE001
        raise ApiError(422, "validation", "גוף הבקשה אינו תקין.", details={"fields": ["body"]}) from None
    if not isinstance(body.send_pacing_v1, bool):
        raise ApiError(422, "installed_settings_invalid", "ההגדרה אינה תקינה.", details={"errors": [{"path": "send_pacing_v1", "code": "not_a_boolean"}]})
    with request.app.state.db.write_aside() as w:
        before = wq.load_settings(w)["send_pacing_v1"]
        wq.store_settings(w, send_pacing_v1=body.send_pacing_v1)
        audit(w, actor=principal, action=wq.AUDIT_SETTINGS, decision="allowed", resource_type="installation", resource_id="messaging",
              request_id=base._rid(request), details={"send_pacing_v1": {"before": before, "after": body.send_pacing_v1}})
    return _fresh_overview(request)


@router.post("/access-control/messaging/installed/registry-sync")
def registry_sync(request: Request, principal: Principal = Depends(base._configure_gate)) -> dict[str, Any]:
    """Read WisKey's `whatsapp/template_registry_v1` now and merge it (administrator rows are kept). 409 when the command is not
    selected (nothing asked), 502 for WisKey's refusal or a reply Arx cannot read (the registry stays as it was), 504 unknown."""
    db = request.app.state.db
    out = wq.sync_registry(db)
    with db.write_aside() as w:
        audit(w, actor=principal, action=wq.AUDIT_SYNC, decision="allowed" if out["outcome"] == "synced" else "denied",
              reason=out["code"], resource_type="installation", resource_id="messaging", request_id=base._rid(request),
              details={"outcome": out["outcome"], "native": out["native"]})
    if out["outcome"] == "not_sent":
        raise ApiError(409, "registry_sync_unavailable", "החיבור הישיר לשירות ההודעות אינו זמין כרגע, ולכן רשימת התבניות לא רועננה.",
                       details={"outcome": "not_sent", "code": out["code"]})
    if out["outcome"] in ("refused", "invalid"):
        raise ApiError(502, "registry_sync_refused", "שירות ההודעות לא מסר רשימת תבניות תקינה. הרשימה הקיימת נשמרה.",
                       details={"outcome": out["outcome"], "code": out["code"]})
    if out["outcome"] == "unknown":
        raise ApiError(504, "registry_sync_uncertain", "לא התקבלה תשובה משירות ההודעות. הרשימה הקיימת נשמרה.", details={"outcome": "unknown", "code": out["code"]})
    return {**_fresh_overview(request), "sync": out}


# ---------------------------------------------------------------- one person: send through the installed client

class InstalledSendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str = Field(pattern=M.COMMAND_ID)
    confirmed: Any = None
    template_id: str = Field(min_length=1, max_length=64)
    preview_token: str = Field(min_length=8, max_length=64)
    mode: str = Field(pattern=r"^(queue|now)$")


def _job_doc(view: Any) -> dict[str, Any]:
    return {"operation_id": view.operation_id, "state": view.state, "outcome": view.outcome, "code": view.code,
            "retry_after_s": view.retry_after_s}


def _error(outcome: str, code: str | None, retry_after_s: int | None = None) -> ApiError:
    d: dict[str, Any] = {"outcome": outcome}
    if code:
        d["code"] = code
    if outcome == "unknown":
        return ApiError(504, "message_uncertain", "לא ידוע אם ההודעה נשלחה. אל תשלחו שוב לפני שבדקתם עם הנמען.", details=d)
    if code == "rate_limited":
        d["retry_after_s"] = retry_after_s
        return ApiError(429, "message_paced_wiskey", "שירות ההודעות עיכב את ההודעה לפי קצב השליחה שלו. ההודעה לא נשלחה - אפשר לנסות שוב מאוחר יותר.",
                        retryable=True, details=d)
    if outcome == "refused":
        return ApiError(502, "template_installed_refused", "שירות ההודעות דחה את שליחת התבנית, והיא לא נשלחה.", details=d)
    return ApiError(409, "template_installed_not_sent", "ההודעה לא נשלחה.", details=d)


@router.post("/access-control/people/{person_id}/messages/template-installed")
def send_installed(request: Request, response: Response, auth: ia.Authority = Depends(base._gate), raw: bytes = Depends(base._raw_body),
                   person_id: str = Path(min_length=1, max_length=base.MAX_ID, pattern=base.ID_PATTERN)) -> dict[str, Any]:
    """ONE template message. Body: `{client_request_id, confirmed: true, template_id, preview_token, mode}` (the token of
    `.../template-v2/preview`). `mode: queue` hands it to WisKey's durable queue (202 + the job: `pending`; read it with the job route);
    `mode: now` sends it with `template_send_v3` (200 `sent` = accepted by the provider, delivery unknown). Refused before the record
    exactly as the v2 route, plus 409 `template_installed_unavailable` when WisKey's join does not select the command now. After the
    hand-over: 502 WisKey's refusal (reason kept), 429 WisKey's own pacing (`retry_after_s` from its ledger), 504 unknown."""
    act = base._Act(request, auth, person_id)
    body: InstalledSendBody = act.parse(InstalledSendBody, raw)
    act.details.update(client_request_id=body.client_request_id, kind="template_installed", mode=body.mode, template_id=body.template_id)
    command = wq.ENQUEUE_COMMAND if body.mode == "queue" else wq.SEND_V3_COMMAND
    held: dict[str, Any] = {}

    def transport_check(_ctx: dict[str, Any]) -> None:
        port = wq.port_for(command)
        if port is None:
            raise act.refuse(ApiError(409, "template_installed_unavailable", "החיבור הישיר לשירות ההודעות אינו זמין כרגע. ההודעה לא נשלחה.",
                                      details={"reason": "transport_not_selected", "mode": body.mode}))
        held["port"] = port

    ctx, message_id = tv2.admit_and_record(act, body, before_record=transport_check)
    tpl, account = ctx["tpl"], ctx["account"]
    operation_id = wq.operation_of(body.mode, body.client_request_id)
    transport: Any = (wq.QueueTransport(act.db, held["port"], template_id=tpl.id, person_id=person_id) if body.mode == "queue"
                      else wq.V3Transport(held["port"]))
    sender = flow.build_sender(act.db, transport=transport)
    try:
        result = sender.send_v2(template_id=tpl.id, account=account, account_key=f"wiskey:{account}", person_id=person_id,
                                recipient_key=f"person:{person_id}", request_id=message_id, operation_id=operation_id,
                                person_revision=ctx["revision"], window="unknown")
        verdict = flow.verdict_of(result)
    except Exception:  # noqa: BLE001 - after the record: unknown, never not_sent
        base.log.warning("template installed: the send raised after the attempt was recorded")
        result, verdict = None, flow.Verdict("unknown", "send_error")
    retry_after: int | None = verdict.retry_after_s
    details = {**act.details, "operation_id": operation_id}

    if body.mode == "queue" and transport.view is not None:
        view = transport.view
        details["job_state"] = view.state
        outcome, reason = wq.message_outcome_of_job(view)
        if view.outcome == "not_sent" and not (transport.client.last_error is not None and transport.client.last_error.answered):
            outcome = "not_sent"  # nothing reached WisKey (or Arx refused the descriptor itself): the record goes
        if outcome is None:  # queued: the record stays `pending` until the job is read
            with act.db.write_aside() as w:
                audit(w, actor=act.principal, action=M.AUDIT_SEND, decision="allowed", resource_type="intercom_person", resource_id=person_id,
                      request_id=act.rid, details={**details, "phase": "queued", "outcome": "pending", "message_id": message_id})
            response.status_code = 202
            return {**base._feed(act.settings), "message": {"id": message_id, "outcome": "pending", "delivery": "unknown"}, "job": _job_doc(view)}
        M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=person_id, outcome=outcome, reason=reason,
                         request_id=act.rid, audit_details=details)
        if outcome != "sent":
            raise _error(outcome, reason, view.retry_after_s)
        return {**base._feed(act.settings), "message": {"id": message_id, "outcome": "sent", "delivery": "unknown"}, "job": _job_doc(view)}

    if isinstance(transport, wq.V3Transport):
        if transport.handover == "not_sent":
            verdict = flow.Verdict("not_sent", transport.code)
        elif transport.handover == "refused" and transport.code in wq.PRE_EFFECT_V3:
            verdict = flow.Verdict("refused", transport.code)
        if transport.pacing is not None and verdict.outcome == "refused":
            retry_after = transport.pacing.get("retry_after_s")
            verdict = flow.Verdict("refused", "rate_limited", retry_after, answered=True)
            wq.note_wiskey_slowdown(act.db, account=account, retry_after_s=retry_after)
        details["result_version"] = 3
    if verdict.outcome == "not_sent" and transport_view_absent(transport):
        M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=person_id, outcome="not_sent", reason=verdict.code,
                         request_id=act.rid, audit_details=details)
        if verdict.code in ("paced", "pacing_expired", "template_unsupported", "window_open"):
            raise tv2._error_for_verdict(verdict)
        raise _error("not_sent", verdict.code)
    M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=person_id, outcome=verdict.outcome, reason=verdict.code,
                     request_id=act.rid, audit_details=details)
    if verdict.outcome != "sent":
        raise _error(verdict.outcome, verdict.code, retry_after)
    return {**base._feed(act.settings), "message": {"id": message_id, "sent_at": M.iso(M.utc()), "outcome": "sent", "delivery": "unknown"}}


def transport_view_absent(transport: Any) -> bool:
    return getattr(transport, "view", None) is None


# ---------------------------------------------------------------- one job: read, cancel

def _job_act(request: Request, auth: ia.Authority, person_id: str, operation_id: str) -> tuple[base._Act, dict[str, Any]]:
    act = base._Act(request, auth, person_id, action=wq.AUDIT_JOB)
    act.details.update(operation_id=operation_id)
    act.person()  # visible to the caller and may be messaged by them (404 / 403 otherwise, audited)
    row = wq.job_row(auth.conn, operation_id)
    if row is None or row["person_id"] != person_id:
        raise act.refuse(ApiError(404, "message_job_not_found", "המשימה לא נמצאה."))
    return act, row


def _settle_message(act: base._Act, row: dict[str, Any], view: Any, raw: Any) -> None:
    """Finish the message record once, when the job is terminal; a WisKey slowdown in the job's result feeds Arx's budget."""
    outcome, reason = wq.message_outcome_of_job(view)
    if outcome is None:
        return
    message_id = row["request_id"]
    with act.db.connection(mode="read", label="wa job message") as c:
        r = c.execute("SELECT outcome FROM intercom_messages WHERE id = ?", (message_id,)).fetchone()
    pacing = wq.pacing_of_job(raw)
    if pacing is not None:
        reason = "rate_limited"
        wq.note_wiskey_slowdown(act.db, account=_account_of(act, row["template_id"]), retry_after_s=pacing["retry_after_s"])
    if r is None or r[0] != "pending":
        return  # already finished (or aged out): one outcome per record
    M.finish_attempt(act.db, principal=act.principal, message_id=message_id, person_id=row["person_id"], outcome=outcome, reason=reason,
                     request_id=act.rid, audit_details={**act.details, "kind": "template_installed", "job_state": view.state})


def _account_of(act: base._Act, template_id: str | None) -> str | None:
    """The account the job's template sends from, by the send route's own rule (a WisKey-owned row names its account; otherwise the
    administrator's choice or the only connected account). None when it cannot be told - then nothing is slowed down."""
    from ..services.intercom_messaging_adapter import MESSAGING

    tpl = next((t for t in wts.load_registry(act.auth.conn) if t.id == template_id), None)
    if tpl is None:
        return None
    if tpl.account is not None:
        return tpl.account
    try:
        account, _problem = MESSAGING.account_for(MESSAGING.status(act.settings, act.principal.user_id), M.read_settings(act.auth.conn)["account"])
    except Exception:  # noqa: BLE001
        return None
    return account


@router.get("/access-control/people/{person_id}/messages/template-installed/{operation_id}")
def job_status(request: Request, auth: ia.Authority = Depends(base._gate),
               person_id: str = Path(min_length=1, max_length=base.MAX_ID, pattern=base.ID_PATTERN),
               operation_id: str = Path(pattern=OPERATION_PATTERN)) -> dict[str, Any]:
    """The job as WisKey reports it now (`whatsapp/template_job_v1`); when the read is not possible, Arx's last record with
    `fresh: false` and the reason. A recorded terminal outcome is never downgraded (TemplateJobs)."""
    from ..services.wiskey_installed_features import JobView, TemplateJobs

    act, row = _job_act(request, auth, person_id, operation_id)
    port = wq.port_for(wq.JOB_COMMAND)
    stored = JobView(operation_id, row["state"], row["outcome"], row["code"])
    if port is None:
        return {"job": _job_doc(stored), "fresh": False, "reason": "transport_not_selected"}
    client = wq.PortClient(port)
    try:
        view = asyncio.run(TemplateJobs(act.db).refresh(client, operation_id))
    except wq.QueueError as exc:
        return {"job": _job_doc(stored), "fresh": False, "reason": exc.code}
    _settle_message(act, row, view, client.last_reply)
    return {"job": _job_doc(view), "fresh": True, "reason": None}


@router.post("/access-control/people/{person_id}/messages/template-installed/{operation_id}/cancel")
def job_cancel(request: Request, auth: ia.Authority = Depends(base._gate),
               person_id: str = Path(min_length=1, max_length=base.MAX_ID, pattern=base.ID_PATTERN),
               operation_id: str = Path(pattern=OPERATION_PATTERN)) -> dict[str, Any]:
    """Ask WisKey to cancel a job that is still QUEUED (`whatsapp/template_cancel_v1`; WisKey decides). `cancelled` = it will not be
    sent (the record reads "not sent", reason `cancelled_before_dispatch`); any other state is 409 `message_job_not_cancellable` with
    the state WisKey reported (a dispatching job may still be sent). One audit row either way."""
    from ..services.wiskey_installed_features import TemplateJobs

    act, row = _job_act(request, auth, person_id, operation_id)
    if row["outcome"] in ("accepted", "not_sent"):
        raise act.refuse(ApiError(409, "message_job_not_cancellable", "המשימה כבר הסתיימה.", details={"state": row["state"]}))
    port = wq.port_for(wq.CANCEL_COMMAND)
    if port is None:
        raise act.refuse(ApiError(409, "message_job_cancel_unavailable", "החיבור הישיר לשירות ההודעות אינו זמין כרגע. המשימה לא בוטלה.",
                                  details={"reason": "transport_not_selected"}))
    client = wq.PortClient(port)
    try:
        view = asyncio.run(TemplateJobs(act.db).cancel(client, operation_id))
    except wq.QueueError as exc:
        with act.db.write_aside() as w:
            audit(w, actor=act.principal, action=wq.AUDIT_JOB, decision="allowed", reason=exc.code, resource_type="intercom_person",
                  resource_id=person_id, request_id=act.rid, details={**act.details, "phase": "cancel", "outcome": exc.outcome})
        raise ApiError(504 if exc.outcome == "unknown" else 502, "message_job_cancel_failed", "לא ידוע אם המשימה בוטלה. בדקו את מצבה שוב.",
                       details={"outcome": exc.outcome, "code": exc.code}) from None
    _settle_message(act, row, view, client.last_reply)
    with act.db.write_aside() as w:
        audit(w, actor=act.principal, action=wq.AUDIT_JOB, decision="allowed", resource_type="intercom_person", resource_id=person_id,
              request_id=act.rid, details={**act.details, "phase": "cancel", "state": view.state, "outcome": view.outcome})
    if view.state != "cancelled":
        raise ApiError(409, "message_job_not_cancellable", "שירות ההודעות כבר החל לשלוח את ההודעה, ולכן אי אפשר לבטל אותה.",
                       details={"state": view.state, "outcome": view.outcome})
    return {"job": _job_doc(view)}
