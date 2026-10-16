"""CR-038 slice 5b - the ticket message channel's routes (spec 8.1, 9, 14.2, 17):

- `GET|PUT /tickets/channel`                         system.configure: the WhatsApp master switch (OFF by default), buttons, the reply
                                                     window, the e-mail fallback; the ticket uses' account mapping READ-ONLY (it is edited
                                                     in Settings > ערוץ ההודעות, slice 5a), the accounts' states, last successful send, health
- `POST /tickets/{id}/outbox/{oid}/send-now`         visible + tickets.external (D29): a message held by the send hours leaves now
- `POST /tickets/{id}/outbox/{oid}/resend`           manager + tickets.external: "שלח שוב" of an unknown / failed message (a NEW row)
- `POST /tickets/{id}/send-update`                   manager + tickets.external: the current text after an edit (purpose `update`)
- `GET /tickets/inbound` + `.../{iid}/claim|attach|dismiss`   managers of a candidate department: unmatched WhatsApp replies; the
                                                     text is revealed only to the manager who claims it (review T13-2)
- `GET|POST /tickets/admin/message-templates`, `PATCH|DELETE .../{tid}`, `POST .../preview`   tickets.configure: the message templates per
                                                     purpose x language x department (D26), validated (9.7), audited with a diff
Every route answers the module's uniform 404 while it is off; every `{ticket_id}` route checks visibility first (the uniform 404
`ticket_not_found`). Mounted BEFORE routers/tickets.py (`/tickets/{ticket_id}` would match `/tickets/inbound`). Answers never carry a
phone number, an e-mail address, a token, a code or a message text - except the claimed reply's own text, to its claimer."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import messaging_runtime as mr
from ..services.tickets import access, handler_links, messaging, model, outbox_store as obs, settings_doc, sla, store, store_links
from ..services.tickets import message_templates as mt
from ..services.tickets.access import Viewer, text
from ..services.tickets.outbox import OutboxError
from .tickets import ID, _detail, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])

TEMPLATE_PURPOSES = ("assign", "reminder", "code", "closed", "reassigned", "reopened", "update", "cost_rejected", "cost_approved", "cost_reopened")
LANG = Literal["he", "en", "ar", "ru"]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _invalid(conn: sqlite3.Connection, fields: list[dict[str, str]]) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": fields})


def _refuse(conn: sqlite3.Connection, viewer: Viewer, action: str, row: dict[str, Any], reason: str, rid: str | None, **details: Any) -> ApiError:
    audit(conn, actor=viewer.principal, action=action, decision="denied", resource_type="ticket", resource_id=row.get("id"), reason=reason,
          request_id=rid, details={"number": row.get("number"), **details})
    return ApiError(403, "forbidden", text(conn, "אין הרשאה לפעולה הזו."), details={"reason": reason, **details})


# ---------------------------------------------------------------- the channel settings (Settings > the module > ערוץ הודעות)

def channel_view(conn: sqlite3.Connection) -> dict[str, Any]:
    rt = messaging.RUNTIME
    cs = messaging.channel_settings(conn)
    view = mr.view(conn, can_manage=False)
    uses = [u for u in view["uses"] if u.get("module") == "tickets"]
    ticket_keys = {k for k in (u.get("resolved") for u in uses) if k}
    for u in uses:
        ticket_keys |= {d.get("resolved") for d in u.get("departments") or [] if d.get("resolved")}
    last_ok = obs.last_ok_by_account(conn)
    accounts = [{"key": a["key"], "label": a["label"], "last4": a["last4"], "state": a["state"], "kind": a["kind"], "uses": a["uses"],
                 "sends_24h": a["sends_24h"], "per_day": (a.get("pacing") or {}).get("per_day"), "last_send_at": a["last_send_at"],
                 "last_ok_at": last_ok.get(a["key"]), "shared_outside": a["shared_outside"], "ticket": a["key"] in ticket_keys}
                for a in view["accounts"] if not a.get("removed")]
    warnings = [w for w in view["warnings"] if str(w.get("use") or "").startswith("tickets.")]
    return {**cs, "uses": uses, "accounts": accounts, "warnings": warnings, "ws_connected": view["ws_connected"],
            "email": {"configured": messaging.email_configured(conn, rt.data_dir)},
            "inbound": {"wanted": messaging.wants_inbound_conn(conn)}, "test_send": view["test_send"],
            "health": rt.health(conn), "accounts_href": "#/system/messaging-accounts"}


@router.get("/tickets/channel")
def get_channel(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return channel_view(conn)


class WhatsappPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    use_buttons: bool | None = None
    reply_window_h: int | None = Field(default=None, ge=1, le=336)


class ChannelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    whatsapp: WhatsappPatch | None = None
    email_fallback: bool | None = None


@router.put("/tickets/channel")
def put_channel(body: ChannelBody, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    current = settings_doc.read(conn)
    if body.revision != current["revision"]:
        raise ApiError(409, "settings_stale", text(conn, "ההגדרות השתנו בינתיים. טענו מחדש."), details={"revision": current["revision"]})
    patch: dict[str, Any] = {}
    if body.whatsapp is not None:
        wa = {k: v for k, v in body.whatsapp.model_dump().items() if v is not None}
        if wa:
            patch["whatsapp"] = wa
    if body.email_fallback is not None:
        patch["email_fallback"] = body.email_fallback
    try:
        doc, changed = settings_doc.apply_patch(conn, patch)
    except ValueError as exc:
        raise _invalid(conn, [{"field": str(exc).split(":")[0], "code": "invalid"}]) from None
    audit(conn, actor=principal, action="tickets.settings.update", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"revision": doc["revision"], "changed": changed})
    messaging.RUNTIME.follow_subscription(messaging.wants_inbound_conn(conn))  # the reply subscription follows at once
    return channel_view(conn)


# ---------------------------------------------------------------- the ticket's messages: send now (D29), send again, send update

def _outbox_row(conn: sqlite3.Connection, ticket_id: str, outbox_id: str) -> Any:
    row = obs.row(conn, outbox_id)
    if row is None or row.ticket_id != ticket_id:
        raise ApiError(404, "message_not_found", text(conn, "ההודעה לא נמצאה."))
    return row


@router.post("/tickets/{ticket_id}/outbox/{outbox_id}/send-now")
def send_now(request: Request, ticket_id: str = Path(..., pattern=ID), outbox_id: str = Path(..., pattern=ID),
             principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """D29: anyone holding `tickets.external` who can see the ticket (not only a manager) releases a message held by the send
    hours; refused for every other state and hold reason. Audited `ticket.message.send_now`."""
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    if not viewer.holds(access.EXTERNAL, seen.row):
        raise _refuse(conn, viewer, "ticket.message.send_now", seen.row, "external_permission_missing", rid, permission=access.EXTERNAL)
    row = _outbox_row(conn, ticket_id, outbox_id)
    if not (row.state == "held" and row.held_reason == "send_hours"):
        raise ApiError(409, "not_held_by_hours", text(conn, "ההודעה אינה ממתינה לשעות השליחה."), details={"state": row.state})
    rt = messaging.RUNTIME
    try:
        with obs.bound(conn):
            assert rt.outbox is not None
            rt.outbox.send_now(outbox_id, rt.clock())
    except OutboxError as exc:
        raise ApiError(409, "not_held_by_hours", text(conn, "ההודעה אינה ממתינה לשעות השליחה."), details={"reason": exc.code}) from None
    audit(conn, actor=principal, action="ticket.message.send_now", decision="allowed", resource_type="ticket", resource_id=ticket_id,
          request_id=rid, details={"number": seen.row["number"], "outbox_id": outbox_id, "purpose": row.purpose})
    return _detail(conn, viewer, ticket_id)


@router.post("/tickets/{ticket_id}/outbox/{outbox_id}/resend")
def resend(request: Request, ticket_id: str = Path(..., pattern=ID), outbox_id: str = Path(..., pattern=ID),
           principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"שלח שוב" of a message whose outcome is unknown ("ייתכן שנשלח") or that was not sent: a NEW outbox row on the current
    mapping; the old row keeps its state (an unknown stays unknown - 9.2, 9.9.4)."""
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    if not seen.manager:
        raise _refuse(conn, viewer, "ticket.message.resend", seen.row, "not_manager", rid)
    if not viewer.holds(access.EXTERNAL, seen.row):
        raise _refuse(conn, viewer, "ticket.message.resend", seen.row, "external_permission_missing", rid, permission=access.EXTERNAL)
    row = _outbox_row(conn, ticket_id, outbox_id)
    if row.state not in ("unknown", "not_sent", "refused") or row.purpose in ("code", "test"):
        raise ApiError(409, "not_resendable", text(conn, "את ההודעה הזו אי אפשר לשלוח שוב."), details={"state": row.state})
    if seen.row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{ticket} זו {f:סגורה|m:סגור}."))
    current = seen.row.get("current_assignment_id") if not seen.row.get("asg_ended_at") else None
    if row.assignment_id and row.assignment_id != current:
        raise ApiError(409, "assignment_ended", text(conn, "ההודעה שייכת לטיפול שהסתיים."))
    rt = messaging.RUNTIME
    link = store_links.link(conn, row.link_id) if row.link_id else None
    if row.purpose in ("assign", "reminder", "reopened", "update") and (link is None or handler_links.state(link, rt.clock()) != "live"):
        raise ApiError(409, "link_not_live", text(conn, "הקישור אינו פעיל. צרו קישור חדש."))
    try:
        with obs.bound(conn):
            assert rt.outbox is not None
            new = rt.outbox.resend(outbox_id, requested_by=principal.user_id, now=rt.clock())
    except OutboxError as exc:
        raise ApiError(409, "not_resendable", text(conn, "את ההודעה הזו אי אפשר לשלוח שוב."), details={"reason": exc.code}) from None
    audit(conn, actor=principal, action="ticket.message.resend", decision="allowed", resource_type="ticket", resource_id=ticket_id,
          request_id=rid, details={"number": seen.row["number"], "outbox_id": outbox_id, "new_outbox_id": new.id, "purpose": row.purpose})
    return _detail(conn, viewer, ticket_id)


@router.post("/tickets/{ticket_id}/send-update")
def send_update(request: Request, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"שלח עדכון" (11.3): the current text to the current outside handler after an edit ("נשלח לפני השינוי"); clears the flag.
    Held by the send hours like every non-urgent vendor message."""
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    row = seen.row
    if not seen.manager:
        raise _refuse(conn, viewer, "ticket.message.update", row, "not_manager", rid)
    if not viewer.holds(access.EXTERNAL, row):
        raise _refuse(conn, viewer, "ticket.message.update", row, "external_permission_missing", rid, permission=access.EXTERNAL)
    if row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{ticket} זו {f:סגורה|m:סגור}."))
    current = row.get("current_assignment_id") if not row.get("asg_ended_at") else None
    link = store_links.link_for_assignment(conn, current) if current and row.get("asg_kind") == "contact" else None
    rt = messaging.RUNTIME
    if link is None or handler_links.state(link, rt.clock()) != "live":
        raise ApiError(409, "no_link", text(conn, "אין קישור פעיל של מטפל חיצוני."))
    contact = store_links.contact(conn, link["contact_id"])
    if contact is None or contact.get("erased_at"):
        raise ApiError(409, "assignee_not_allowed", text(conn, "אי אפשר לשלוח לאיש הקשר הזה."))
    channel = messaging.plan_channel(conn, contact, rt.data_dir)
    if channel == "manual":
        raise ApiError(409, "channel_unavailable", text(conn, "אין ערוץ שליחה להודעות. העתיקו את הקישור ושלחו אותו בעצמכם."))
    queued = rt.enqueue(conn, purpose="update", contact_id=contact["id"], ticket_id=ticket_id, assignment_id=current, link_id=link["id"],
                        department_id=row["department_id"], params=messaging.message_params(conn, row, contact), channel=channel,
                        requested_by=principal.user_id)
    store.update_ticket(conn, ticket_id, {"external_stale": 0}, bump=False)
    audit(conn, actor=principal, action="ticket.message.update", decision="allowed", resource_type="ticket", resource_id=ticket_id,
          request_id=rid, details={"number": row["number"], "outbox_id": queued.id, "channel": channel})
    return _detail(conn, viewer, ticket_id)


# ---------------------------------------------------------------- unmatched WhatsApp replies (9.6 step 4, review T13-2)

def _candidates(r: dict[str, Any]) -> dict[str, list[str]]:
    try:
        data = json.loads(r.get("candidates_json") or "{}")
    except ValueError:
        data = {}
    return {"tickets": [t for t in data.get("tickets") or [] if isinstance(t, str)],
            "departments": [d for d in data.get("departments") or [] if isinstance(d, str)]}


def _managed_tickets(viewer: Viewer, r: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for tid in _candidates(r)["tickets"]:
        seen = access.visible_by_id(viewer, tid)
        if seen is not None and seen.manager:
            out.append({"id": seen.row["id"], "number": seen.row["number"], "title": seen.row["title"], "status": seen.row["status"]})
    return out


def _inbound_item(conn: sqlite3.Connection, viewer: Viewer, r: dict[str, Any], tickets: list[dict[str, Any]]) -> dict[str, Any]:
    contact = store_links.contact(conn, r.get("contact_id")) if r.get("contact_id") else None
    mine = r.get("claimed_by") == viewer.uid
    return {"id": r["id"], "received_at": r["received_at"], "sender": (contact or {}).get("display_name") or "", "tickets": tickets,
            "claimed": bool(r.get("claimed_by")), "claimed_by_me": mine,
            "claimed_by_name": store.display_name(conn, r["claimed_by"]) if r.get("claimed_by") and not mine else None,
            "claimed_at": r.get("claimed_at") if r.get("claimed_by") else None,  # B4: "claimed by X, N min ago"; taken over after 15 min
            "text": r.get("content") if mine else None}


def _inbound_for(conn: sqlite3.Connection, viewer: Viewer, inbound_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    r = obs.inbound(conn, inbound_id)
    tickets = _managed_tickets(viewer, r) if r and r["result"] == "ambiguous" and not r.get("handled_at") else []
    if r is None or not tickets:
        raise ApiError(404, "reply_not_found", text(conn, "התשובה לא נמצאה."))
    return r, tickets


@router.get("/tickets/inbound")
def list_inbound(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The unmatched replies the caller may handle: the sender's directory name and the time only - the text after "זה שלי"."""
    viewer = Viewer(conn, principal)
    if access.MANAGE not in viewer.anywhere:
        return {"items": []}
    items = []
    for r in obs.open_ambiguous(conn):
        tickets = _managed_tickets(viewer, r)
        if tickets:
            items.append(_inbound_item(conn, viewer, r, tickets))
    return {"items": items}


@router.post("/tickets/inbound/{inbound_id}/claim")
def claim_inbound(request: Request, inbound_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    r, tickets = _inbound_for(conn, viewer, inbound_id)
    at = now_iso()
    # deep review B4: a claim older than 15 minutes may be taken over (the list shows who claimed it and when)
    stale_before = handler_links.iso(handler_links.parse(at) - obs.CLAIM_STALE_AFTER)  # type: ignore[operator]
    if not obs.claim_inbound(conn, inbound_id, viewer.uid, at, stale_before=stale_before):
        raise ApiError(409, "already_claimed", text(conn, "מנהל אחר כבר טיפל בתשובה הזו."))
    took_over = bool(r.get("claimed_by")) and r.get("claimed_by") != viewer.uid
    audit(conn, actor=principal, action="ticket.inbound.claim", decision="allowed", resource_type="ticket_inbound", resource_id=inbound_id,
          request_id=_rid(request), details={"tickets": [t["id"] for t in tickets], **({"took_over": True} if took_over else {})})
    return _inbound_item(conn, viewer, obs.inbound(conn, inbound_id) or r, tickets)


class AttachBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticket_id: str = Field(min_length=1, max_length=64, pattern=ID)


@router.post("/tickets/inbound/{inbound_id}/attach")
def attach_inbound(body: AttachBody, request: Request, inbound_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    r, tickets = _inbound_for(conn, viewer, inbound_id)
    if r.get("claimed_by") != viewer.uid:
        raise ApiError(409, "not_claimed", text(conn, "יש ללחוץ קודם \"זה שלי\"."))
    if body.ticket_id not in {t["id"] for t in tickets}:
        raise _invalid(conn, [{"field": "ticket_id", "code": "not_a_candidate"}])
    seen = access.require_visible(viewer, body.ticket_id)
    if seen.row["status"] in model.FINAL:
        raise ApiError(409, "ticket_closed", text(conn, "{ticket} זו {f:סגורה|m:סגור}."))
    at = now_iso()
    asg = store.assignment(conn, seen.row.get("current_assignment_id"))
    store.insert_event(conn, seen.row["id"], "inbound", actor_kind="inbound", actor_name=(asg or {}).get("assignee_name") or "",
                       assignment_id=(asg or {}).get("id"), body=(r.get("content") or "")[:model.NOTE_MAX] or None,
                       data={"inbound_id": inbound_id, "unverified": True, "attached_by": store.display_name(conn, viewer.uid)}, via="whatsapp", at=at)
    store.update_ticket(conn, seen.row["id"], {"last_activity_at": at}, bump=False)
    sla.refresh(conn, seen.row["id"])  # slice 2: the dues follow every change
    obs.handle_inbound(conn, inbound_id, viewer.uid, at, "attached", seen.row["id"])
    messaging._notify("reply_unmatched", conn, inbound_id, _candidates(r)["tickets"], resolved=True)
    audit(conn, actor=principal, action="ticket.inbound.attach", decision="allowed", resource_type="ticket", resource_id=seen.row["id"],
          request_id=_rid(request), details={"number": seen.row["number"], "inbound_id": inbound_id})
    return _detail(conn, viewer, seen.row["id"])


@router.post("/tickets/inbound/{inbound_id}/dismiss")
def dismiss_inbound(request: Request, inbound_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    r, _tickets = _inbound_for(conn, viewer, inbound_id)
    if r.get("claimed_by") != viewer.uid:
        raise ApiError(409, "not_claimed", text(conn, "יש ללחוץ קודם \"זה שלי\"."))
    obs.handle_inbound(conn, inbound_id, viewer.uid, now_iso(), "dismissed", None)
    messaging._notify("reply_unmatched", conn, inbound_id, _candidates(r)["tickets"], resolved=True)
    audit(conn, actor=principal, action="ticket.inbound.dismiss", decision="allowed", resource_type="ticket_inbound", resource_id=inbound_id,
          request_id=_rid(request))
    return {"ok": True}


# ---------------------------------------------------------------- message templates (9.7, D26)

def _template_dict(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": r["id"], "department_id": r.get("department_id"), "purpose": r.get("purpose"), "lang": r.get("lang"), "body": r.get("body") or "",
            "active": bool(r.get("active")), "revision": r["revision"], "updated_at": r["updated_at"],
            "updated_by_name": None}


@router.get("/tickets/admin/message-templates")
def list_templates(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    rows = messaging.message_template_rows(conn, include_all_departments=True, include_inactive=True)
    return {
        "purposes": list(TEMPLATE_PURPOSES), "langs": list(messaging.LANGS), "placeholders": list(mt.PLACEHOLDERS),
        "rules": {"link_required": sorted(p for p in TEMPLATE_PURPOSES if p in mt.TEMPLATE_LINK_PURPOSES), "code_only": ["code"],
                  "code_forbidden": sorted(mt.CODE_FORBIDDEN), "max_rendered": mt.RENDERED_MAX},
        "items": [_template_dict(r) for r in rows],
        "starters": {p: dict(mt.STARTERS.get(p, {})) for p in TEMPLATE_PURPOSES},
        "departments": [{"id": d["id"], "name": d["name"]} for d in store.departments(conn, include_inactive=False)],
        "samples": {p: {lang: messaging.sample_render(conn, purpose=p, lang=lang, body=mt.STARTERS[p][lang])
                        for lang in messaging.LANGS if lang in mt.STARTERS.get(p, {})} for p in TEMPLATE_PURPOSES},
    }


class TemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str | None = Field(default=None, max_length=64, pattern=ID)
    purpose: Literal["assign", "reminder", "code", "closed", "reassigned", "reopened", "update"]
    lang: LANG
    body: str = Field(max_length=4000)
    active: bool = True


def _check_body(conn: sqlite3.Connection, purpose: str, body: str) -> None:
    problems = messaging.template_problems(purpose, body)
    if problems:
        raise _invalid(conn, problems)


def _template(conn: sqlite3.Connection, template_id: str) -> dict[str, Any]:
    r = obs.message_template(conn, template_id)
    if r is None:
        raise ApiError(404, "template_not_found", text(conn, "התבנית לא נמצאה."))
    return r


@router.post("/tickets/admin/message-templates", status_code=201)
def create_template(body: TemplateCreate, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    if body.department_id and store.department(conn, body.department_id) is None:
        raise _invalid(conn, [{"field": "department_id", "code": "unknown"}])
    _check_body(conn, body.purpose, body.body)
    clash = obs.message_template_clash(conn, body.purpose, body.lang, body.department_id)
    if clash is not None:
        raise ApiError(409, "template_exists", text(conn, "כבר קיימת תבנית למטרה ולשפה האלה."), details={"id": clash})
    tid, at = new_id(), now_iso()
    obs.insert_message_template(conn, tid, department_id=body.department_id, purpose=body.purpose, lang=body.lang, body=body.body,
                                active=body.active, by=principal.user_id, at=at)
    after = _template(conn, tid)
    audit(conn, actor=principal, action="ticket.template.create", decision="allowed", resource_type="ticket_template", resource_id=tid,
          request_id=_rid(request), details={"kind": "message", "purpose": body.purpose, "lang": body.lang, "department_id": body.department_id,
                                             "diff": messaging.template_diff(None, after)})
    return _template_dict(after)


class TemplatePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    body: str | None = Field(default=None, max_length=4000)
    active: bool | None = None
    revision: int = Field(ge=1)


@router.patch("/tickets/admin/message-templates/{template_id}")
def patch_template(body: TemplatePatch, request: Request, template_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    before = _template(conn, template_id)
    if before["revision"] != body.revision:
        raise ApiError(409, "template_stale", text(conn, "התבנית השתנתה בינתיים. טענו מחדש."), details={"revision": before["revision"]})
    fields: dict[str, Any] = {}
    if body.body is not None:
        _check_body(conn, before["purpose"], body.body)
        fields["body"] = body.body
    if body.active is not None:
        fields["active"] = 1 if body.active else 0
    if fields and not obs.update_message_template(conn, template_id, fields, revision=body.revision, by=principal.user_id, at=now_iso()):
        raise ApiError(409, "template_stale", text(conn, "התבנית השתנתה בינתיים. טענו מחדש."), details={"revision": before["revision"]})
    after = _template(conn, template_id)
    audit(conn, actor=principal, action="ticket.template.update", decision="allowed", resource_type="ticket_template", resource_id=template_id,
          request_id=_rid(request), details={"kind": "message", "purpose": before["purpose"], "lang": before["lang"],
                                             "diff": messaging.template_diff(before, after)})
    return _template_dict(after)


@router.delete("/tickets/admin/message-templates/{template_id}")
def delete_template(request: Request, template_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    before = _template(conn, template_id)
    obs.delete_message_template(conn, template_id, by=principal.user_id, at=now_iso())
    audit(conn, actor=principal, action="ticket.template.delete", decision="allowed", resource_type="ticket_template", resource_id=template_id,
          request_id=_rid(request), details={"kind": "message", "purpose": before["purpose"], "lang": before["lang"],
                                             "diff": messaging.template_diff(before, None)})
    return {"ok": True}


class PreviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: Literal["assign", "reminder", "code", "closed", "reassigned", "reopened", "update"]
    lang: LANG
    body: str = Field(max_length=4000)


@router.post("/tickets/admin/message-templates/preview")
def preview_template(body: PreviewBody, principal: Principal = Depends(current_principal_ro),
                     conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The editor's live preview: sample values, the module's configured name (D33) in the template's language, the link shown as
    a placeholder - and the save-time problems (9.7)."""
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    problems = messaging.template_problems(body.purpose, body.body)
    rendered = "" if any(p["code"] in ("brace_unbalanced", "gender_malformed", "empty") for p in problems) else \
        messaging.sample_render(conn, purpose=body.purpose, lang=body.lang, body=body.body)
    return {"text": rendered, "problems": problems, "length": len(rendered), "max": mt.RENDERED_MAX}
