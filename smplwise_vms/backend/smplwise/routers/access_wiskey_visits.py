"""WISKEY-VISITS-2407 (card WISKEY-VISITS-2400): the visitor screen's WisKey side - WisKey's visits (read only), its guest templates (presets)
and the record of an Arx invitation in WisKey's visit mechanism. Logic: services/wiskey_visits.py. The browser never names a WisKey command.

Every route answers 404 while Arx's visitors are off (`access.visitors`, services/access_visitors.py), like the visitor routes themselves.

- GET  /access/wiskey-visits                       capabilities (visits / templates / push, each with its Hebrew reason) and what the caller may
                                                   do. No WisKey call. Anyone holding `access.visitor.invite` or `access.people.read` somewhere.
- GET  /access/wiskey-visits/visits?status=&query=&offset=&limit=   WisKey's visit list, read only, each row marked `origin` arx | wiskey.
                                                   `access.people.read` UNRESTRICTED (WisKey answers installation-wide; audited 403 otherwise).
- GET  /access/wiskey-visits/templates             WisKey's guest templates as invite presets (no person data): invite or people-read somewhere.
- GET  /access/wiskey-visits/links                 the WisKey record state of every invitation the caller sees (no WisKey call).
- POST /access/wiskey-visits/{invite_id}/push      `{confirmed: true}`: record the invitation's current state in WisKey. The host or a manager of one
                                                   of its stations. Sent once, never retried (services/wiskey_visits.py "The push").
- POST /access/wiskey-visits/{invite_id}/reconcile settle an `unknown` (or check a `pushed`) by reading WisKey's list; nothing is written to WisKey.
- PUT  /access/wiskey-visits/settings              `{push: "on"|"off"}` - system administrator; audited before / after."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import access_grants as ag
from ..services import access_visitors as av
from ..services import intercom_authority as ia
from ..services import intercom_sync
from ..services import wiskey_visits as wv

router = APIRouter()
API = "/access/wiskey-visits"
_ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$"


class PushIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: bool = False


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    push: Literal["on", "off"]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _api(request: Request) -> dict[str, Any] | None:
    return intercom_sync.SYNC.api_facts(settings_of(request))


def _on_or_404(conn: sqlite3.Connection) -> None:
    if not av.enabled(conn):
        raise av._hidden()


def _sees(conn: sqlite3.Connection, principal: Principal) -> bool:
    auth = ia.Authority(conn, principal)
    return auth.anywhere(ia.PEOPLE_READ) or ag.holds_somewhere(conn, principal, av.PERMISSION, []) or av.PERMISSION in ag.permissions_anywhere(conn, principal)


def _refuse(conn: sqlite3.Connection, principal: Principal, permission: str, request: Request, reason: str) -> ApiError:
    audit(conn, actor=principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason=reason, request_id=_rid(request))
    return forbidden(permission=permission, target_type="installation", target_id="*", reason=reason)


def _unavailable(feature: str, reason: str | None) -> ApiError:
    return ApiError(409, "wiskey_visits_unsupported", wv.reason_text(reason) or "", details={"feature": feature, "reason": reason})


@router.get(API)
def home(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _on_or_404(conn)
    if not _sees(conn, principal):
        raise av._hidden()
    auth = ia.Authority(conn, principal)
    return {"capabilities": wv.capabilities(conn, _api(request)),
            "can": {"list": auth.unrestricted(ia.PEOPLE_READ), "settings": is_system_admin(conn, principal.user_id)}}


@router.get(f"{API}/visits")
def visits(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
           status: Literal["all", "pending", "approved", "rejected", "cancelled", "superseded"] = "all", query: str = Query("", max_length=64),
           offset: int = Query(0, ge=0, le=100_000), limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    _on_or_404(conn)
    auth = ia.Authority(conn, principal)
    if not auth.unrestricted(ia.PEOPLE_READ):
        raise _refuse(conn, principal, ia.PEOPLE_READ, request, "station_scoped" if auth.anywhere(ia.PEOPLE_READ) else "no_binding")
    available, reason = wv.feature_state(_api(request), "visits")
    if not available:
        raise _unavailable("visits", reason)
    needle = " ".join(query.split())
    reply = intercom_sync.SYNC.command(settings_of(request), "visits", lambda call: wv.list_visits(call, offset=offset, limit=limit, status=status, query=needle),
                                       wv.project_visit_page, who=principal.user_id, channel=wv.READ_CHANNEL)
    page = reply.get("visits")
    if page is not None:
        page["items"] = wv.mark_origin(conn, page["items"])
    return {"state": reply.get("state"), "last_error": reply.get("last_error"), "fetched_at": reply.get("fetched_at"), "visits": page}


@router.get(f"{API}/templates")
def templates(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _on_or_404(conn)
    if not _sees(conn, principal):
        raise av._hidden()
    available, reason = wv.feature_state(_api(request), "templates")
    if not available:
        raise _unavailable("templates", reason)
    reply = intercom_sync.SYNC.command(settings_of(request), "templates", wv.templates_get, wv.project_templates, who=principal.user_id, channel=wv.READ_CHANNEL)
    return {"state": reply.get("state"), "last_error": reply.get("last_error"), "fetched_at": reply.get("fetched_at"), "templates": reply.get("templates")}


@router.get(f"{API}/links")
def links(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _on_or_404(conn)
    out = []
    for v in av.list_for(conn, principal, limit=500):
        pair = wv._invite_and_grant(conn, v["id"])
        if pair is not None:
            out.append(wv.link_view(conn, *pair))
    return {"links": out}


@router.post(f"{API}/{{invite_id}}/push")
def push(body: PushIn, request: Request, invite_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    db = request.app.state.db
    with db.connection(mode="read", label="wiskey_visits.gate") as conn:
        _on_or_404(conn)
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "רישום הביקור במערכת בקרת הכניסה דורש אישור מפורש.")
    rid = _rid(request)
    record = wv.claim(db, principal, invite_id, _api(request), rid)
    revision = record["arx_revision"]
    try:
        reply = intercom_sync.SYNC.action(settings_of(request), "record", lambda call: wv.record_external(call, record), wv.project_record,
                                          who=principal.user_id, lane=wv.LANE, channel=wv.PUSH_CHANNEL, target=f"visit:{invite_id}")
    except ApiError as exc:
        details = dict(exc.details or {})
        outcome = str(details.get("outcome") or "unknown")
        code = str(details.get("wiskey_code") or exc.code)
        state = {"not_sent": "not_sent", "refused": "refused"}.get(outcome, "unknown")
        wv.settle(db, principal, invite_id, state, code=code, revision=revision, request_id=rid)
        if state == "refused":
            raise wv.wiskey_refusal(code) from None
        if state == "unknown":
            raise ApiError(504, "wiskey_visits_outcome_unknown", "הרישום נשלח למערכת בקרת הכניסה, אך לא התקבלה תשובה ברורה. לא נשלח שוב - יש לבצע \"בדיקה מול מערכת בקרת הכניסה\".",
                           details=details) from None
        raise
    except BaseException:
        wv.settle(db, principal, invite_id, "unknown", code="arx_error", revision=revision, request_id=rid)
        raise
    record_reply = reply.get("record") or {}
    wv.settle(db, principal, invite_id, "pushed", reply=record_reply, revision=revision, request_id=rid)
    with db.connection(mode="read", label="wiskey_visits.view") as conn:
        pair = wv._invite_and_grant(conn, invite_id)
        view = wv.link_view(conn, *pair) if pair else None
    return {"status": "pushed", "record": record_reply, "link": view}


@router.post(f"{API}/{{invite_id}}/reconcile")
def reconcile(request: Request, invite_id: str = Path(..., pattern=_ID), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    db = request.app.state.db
    rid = _rid(request)
    with db.connection(mode="read", label="wiskey_visits.reconcile_gate") as conn:
        _on_or_404(conn)
        pair = wv._invite_and_grant(conn, invite_id)
        if pair is None or not wv.may_act(conn, principal, *pair):
            raise av._hidden()
        link = wv.link_row(conn, invite_id)
    if link is None or link["state"] not in ("unknown", "pushed"):
        raise ApiError(409, "wiskey_visits_nothing_to_check", "אין שליחה לבדוק עבור ההזמנה הזו.")
    available, reason = wv.feature_state(_api(request), "visits")
    if not available:
        raise _unavailable("visits", reason)
    reply = intercom_sync.SYNC.command(settings_of(request), "found", lambda call: wv.find_external(call, invite_id), lambda raw: raw,
                                       who=principal.user_id, channel=wv.READ_CHANNEL, target=f"visit:{invite_id}")
    found = reply.get("found")
    if reply.get("state") != "ready" or found is None:
        raise ApiError(503, "wiskey_visits_unavailable", "מערכת בקרת הכניסה אינה זמינה כרגע. לא שונה דבר - נסו שוב.", retryable=True,
                       details={"state": reply.get("state"), "last_error": reply.get("last_error")})
    row = found.get("found")
    if row is not None:
        wv.settle(db, principal, invite_id, "pushed", reply={"visit_id": row["id"]}, revision=link["sent_revision"], request_id=rid, action=wv.AUDIT_RECONCILE)
        verdict = "recorded"
    elif found.get("complete"):  # the whole list was read and the record is not there: it provably was not recorded
        wv.settle(db, principal, invite_id, "not_sent", code="not_in_wiskey", revision=link["sent_revision"], request_id=rid, action=wv.AUDIT_RECONCILE)
        verdict = "absent"
    else:
        verdict = "undecided"  # the list was longer than the reconcile reads: the state stays as it was
    with db.connection(mode="read", label="wiskey_visits.view") as conn:
        pair = wv._invite_and_grant(conn, invite_id)
        view = wv.link_view(conn, *pair) if pair else None
    return {"verdict": verdict, "link": view}


@router.put(f"{API}/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with request.app.state.db.connection(label="wiskey_visits.settings") as conn:
        require(conn, principal, "system.configure", INSTALLATION)
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action=wv.AUDIT_SETTINGS, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
                  request_id=_rid(request))
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו.")
        before, after = wv.set_switch(conn, body.push == "on")
        audit(conn, actor=principal, action=wv.AUDIT_SETTINGS, decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"key": wv.SWITCH_KEY, "before": before, "after": after})
        return {"capabilities": wv.capabilities(conn, _api(request))}
