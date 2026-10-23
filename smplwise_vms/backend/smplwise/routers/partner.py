"""PARTNERAPI113-295: administration of the partner interface (CR-PARTNERAPI113 sections 8-10; owner answers 164-172).

Every route: `partner.manage` on the installation (a SYSTEM permission, built-in system_admin only, never delegable - owner answer 166; a
local Arx identity needs the second factor for it) AND a system administrator. The switches `partner.api` / `partner.webhooks` also need
`system.configure`; ON only from the local channel and only while `services/partner/core.GO_LIVE_PERMITTED` is True (409 otherwise -
owner answer 171); OFF from either channel (the kill switch). While BOTH switches are off every route answers 404 except reading and
changing the settings card. No answer carries a token or a secret except the one creating / rotating call that shows it once."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import database_of, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..remote_channel import is_remote
from ..services.partner import core, webhooks
from ..services.partner.core import PartnerError

router = APIRouter()
MANAGE = "partner.manage"
CONFIGURE = "system.configure"

MESSAGES = {
    "not_found": "לא נמצא.",
    "invalid": "ערך לא תקין.",
    "unknown": "ערך לא מוכר.",
    "unknown_scope": "הרשאת גישה לא מוכרת. מותרות רק ההרשאות שברשימה.",
    "unknown_event": "סוג אירוע לא מוכר.",
    "out_of_range": "הערך מחוץ לטווח המותר.",
    "departments_required": "יש לבחור לפחות מחלקה אחת לפתיחת קריאות.",
    "creator_lacks_permission": "אין לך את ההרשאה הזו על כל התחום שנבחר.",
    "partner_disabled": "השותף מושבת.",
    "token_not_active": "האסימון אינו פעיל.",
    "too_many_endpoints": "הגעתם למספר היעדים המרבי.",
    "url_refused": "הכתובת אינה מותרת. מותרת רק כתובת https ציבורית בפורט 9443 או 9453.",
    "not_dead": "האירוע אינו במצב כישלון סופי.",
    "rate_limited": "יותר מדי בקשות. נסו שוב מאוחר יותר.",
    "webhooks_off": "שליחת ההודעות לשותפים כבויה.",
    "go_live_not_permitted": "הפעלת ממשק השותפים דורשת סקירת אבטחה ואישור בעלים, וגרסה זו אינה כוללת אותו.",
    "local_only": "הפעלה אפשרית רק מהרשת המקומית.",
    "feature_off": "ממשק השותפים כבוי.",
    "not_system_admin": "רק מנהל מערכת מנהל את ממשק השותפים.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _err(exc: PartnerError) -> ApiError:
    return ApiError(exc.status, exc.code, MESSAGES.get(exc.code, MESSAGES["invalid"]), details={"field": exc.field} if exc.field else None)


def _gate(conn: sqlite3.Connection, request: Request, principal: Principal, action: str, *, need_feature: bool = True) -> None:
    require(conn, principal, MANAGE, INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"area": "partner"})
        raise ApiError(403, "not_system_admin", MESSAGES["not_system_admin"])
    if need_feature and not (core.switch_on(conn, core.API_KEY) or core.switch_on(conn, core.WEBHOOKS_KEY)):
        raise ApiError(404, "feature_off", MESSAGES["feature_off"])


def _run(fn, *a, **k):
    try:
        return fn(*a, **k)
    except PartnerError as exc:
        raise _err(exc) from None


# ---------------------------------------------------------------- the settings card

@router.get("/partners/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.settings.read", need_feature=False)
    return _view(conn)


def _view(conn: sqlite3.Connection) -> dict[str, Any]:
    view = core.settings_view(conn)
    view["counts"] = {
        "clients": conn.execute("SELECT COUNT(*) FROM partner_clients WHERE deleted_at IS NULL").fetchone()[0],
        "tokens": conn.execute("SELECT COUNT(*) FROM partner_tokens WHERE revoked_at IS NULL AND expires_at > ?", (core.iso(core.utcnow()),)).fetchone()[0],
        "endpoints": conn.execute("SELECT COUNT(*) FROM partner_endpoints WHERE state != 'disabled'").fetchone()[0],
    }
    view["remote"] = is_remote(conn)
    view["allowed_ports"] = sorted(webhooks.ssrf.ALLOWED_PORTS)
    view["event_types"] = [e for e in webhooks.EVENT_TYPES if e != "endpoint.ping"]
    return view


class SettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    api: bool | None = None
    webhooks: bool | None = None
    values: dict[str, int] | None = None


@router.put("/partners/settings")
def put_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.settings.changed", need_feature=False)
    rid = _rid(request)
    for key, want in ((core.API_KEY, body.api), (core.WEBHOOKS_KEY, body.webhooks)):
        if want is None:
            continue
        before = core.stored_switch(conn, key)
        after = "on" if want else "off"
        if after == "on":
            require(conn, principal, CONFIGURE, INSTALLATION)
            if not core.GO_LIVE_PERMITTED:
                audit(conn, actor=principal, action="partner.feature_enabled", decision="denied", resource_type="installation", resource_id="*",
                      reason="go_live_not_permitted", request_id=rid, details={"key": key})
                raise ApiError(409, "go_live_not_permitted", MESSAGES["go_live_not_permitted"])
            if is_remote(conn):
                audit(conn, actor=principal, action="partner.feature_enabled", decision="denied", resource_type="installation", resource_id="*",
                      reason="local_only", request_id=rid, details={"key": key})
                raise ApiError(409, "local_only", MESSAGES["local_only"])
        if after != before:
            set_setting(conn, key, after)
            audit(conn, actor=principal, action="partner.feature_enabled" if after == "on" else "partner.feature_disabled", decision="allowed",
                  resource_type="installation", resource_id="*", request_id=rid, details={"key": key, "channel": "remote" if is_remote(conn) else "local"})
            if key == core.API_KEY:
                try:
                    from ..services.tickets.public_runtime import RUNTIME

                    RUNTIME.partner_switched(after == "on")
                except Exception:  # noqa: BLE001
                    pass
    for short, value in (body.values or {}).items():
        changed = _run(core.set_number, conn, short, value)
        if changed:
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=rid,
                  details={"key": f"partner.{short}", "before": changed[0], "after": changed[1]})
    return _view(conn)


@router.get("/partners/options")
def get_options(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The pickers of the token / endpoint forms: sites, buildings, floors, departments and ticket templates (names and ids only)."""
    _gate(conn, request, principal, "partner.options.read")
    out: dict[str, Any] = {
        "sites": [dict(r) for r in conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name")],
        "buildings": [dict(r) for r in conn.execute("SELECT id, name, site_id FROM buildings WHERE deleted_at IS NULL ORDER BY sort_order, name")],
        "floors": [dict(r) for r in conn.execute("SELECT id, name, building_id FROM floors WHERE deleted_at IS NULL ORDER BY sort_order, level, name")],
        "departments": [], "templates": [],
    }
    try:
        out["departments"] = [dict(r) for r in conn.execute("SELECT id, name FROM ticket_departments WHERE deleted_at IS NULL AND active = 1 ORDER BY sort_order, name")]
        out["templates"] = [dict(r) for r in conn.execute("""SELECT id, name, department_id FROM ticket_templates WHERE kind = 'ticket' AND active = 1
                                                                AND deleted_at IS NULL ORDER BY name""")]
    except sqlite3.OperationalError:
        pass
    return out


# ---------------------------------------------------------------- partners

class ClientBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str


class StateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Literal["active", "disabled"]


@router.get("/partners/clients")
def get_clients(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.clients.read")
    return {"items": core.list_clients(conn)}


@router.post("/partners/clients")
def post_client(body: ClientBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.client.created")
    return _run(core.create_client, conn, principal, body.label, _rid(request))


@router.post("/partners/clients/{client_id}/state")
def post_client_state(client_id: str, body: StateBody, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.client.state")
    return _run(core.set_client_state, conn, principal, client_id, body.state, _rid(request))


@router.delete("/partners/clients/{client_id}")
def delete_client(client_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.client.deleted")
    _run(core.delete_client, conn, principal, client_id, _rid(request))
    return {"ok": True}


# ---------------------------------------------------------------- tokens

class TokenBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str | None = None
    scopes: list[str]
    restriction_kind: str = "installation"
    restriction_ids: list[str] | None = None
    departments: list[str] | None = None
    source_cidrs: list[str] | None = None
    personal: dict[str, bool] | None = None
    expires_days: int | None = None
    rate_per_min: int | None = None
    rate_per_hour: int | None = None


class OverlapBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    overlap_hours: int | None = None


@router.get("/partners/tokens")
def get_tokens(request: Request, client_id: str | None = None, principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.tokens.read")
    return {"items": core.list_tokens(conn, client_id)}


@router.post("/partners/clients/{client_id}/tokens")
def post_token(client_id: str, body: TokenBody, request: Request, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.token.created")
    data = body.model_dump(exclude_none=True)
    if body.expires_days is None:
        data.pop("expires_days", None)
    return _run(core.create_token, conn, principal, client_id, data, _rid(request))


@router.post("/partners/tokens/{token_id}/rotate")
def post_token_rotate(token_id: str, body: OverlapBody, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.token.rotated")
    return _run(core.rotate_token, conn, principal, token_id, body.overlap_hours, _rid(request))


@router.post("/partners/tokens/{token_id}/revoke")
def post_token_revoke(token_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.token.revoked")
    return _run(core.revoke_token, conn, principal, token_id, "revoked", _rid(request))


# ---------------------------------------------------------------- endpoints

class EndpointBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str | None = None
    url: str
    events: list[str]
    restriction_kind: str = "installation"
    restriction_ids: list[str] | None = None
    departments: list[str] | None = None
    personal: dict[str, bool] | None = None
    skip_own: bool = True


class EndpointPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str | None = None
    url: str | None = None
    events: list[str] | None = None
    restriction_kind: str | None = None
    restriction_ids: list[str] | None = None
    departments: list[str] | None = None
    personal: dict[str, bool] | None = None
    skip_own: bool | None = None


class PauseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    paused: bool


@router.get("/partners/endpoints")
def get_endpoints(request: Request, client_id: str | None = None, principal: Principal = Depends(current_principal_ro),
                  conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoints.read")
    return {"items": webhooks.list_endpoints(conn, client_id)}


@router.post("/partners/clients/{client_id}/endpoints")
def post_endpoint(client_id: str, body: EndpointBody, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoint.created")
    return _run(webhooks.create_endpoint, conn, principal, client_id, body.model_dump(exclude_none=True), request.app.state.settings, _rid(request))


@router.patch("/partners/endpoints/{endpoint_id}")
def patch_endpoint(endpoint_id: str, body: EndpointPatch, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoint.updated")
    return _run(webhooks.update_endpoint, conn, principal, endpoint_id, body.model_dump(exclude_none=True), request.app.state.settings, _rid(request))


@router.delete("/partners/endpoints/{endpoint_id}")
def delete_endpoint(endpoint_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoint.deleted")
    _run(webhooks.delete_endpoint, conn, principal, endpoint_id, _rid(request))
    return {"ok": True}


@router.post("/partners/endpoints/{endpoint_id}/pause")
def post_endpoint_pause(endpoint_id: str, body: PauseBody, request: Request, principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoint.paused")
    return _run(webhooks.set_paused, conn, principal, endpoint_id, body.paused, "manual", _rid(request))


@router.post("/partners/endpoints/{endpoint_id}/secret/rotate")
def post_endpoint_secret(endpoint_id: str, body: OverlapBody, request: Request, principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoint.secret_rotated")
    return _run(webhooks.rotate_secret, conn, principal, endpoint_id, body.overlap_hours, request.app.state.settings.data_dir, _rid(request))


@router.post("/partners/endpoints/{endpoint_id}/ping")
def post_endpoint_ping(endpoint_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
                       conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.endpoint.ping")
    db = database_of(conn) or request.app.state.db
    return _run(webhooks.ping, db, request.app.state.settings, principal, endpoint_id, _rid(request))


# ---------------------------------------------------------------- delivery log, outbox, redeliver

@router.get("/partners/deliveries")
def get_deliveries(request: Request, endpoint_id: str | None = None, limit: int = 100, principal: Principal = Depends(current_principal_ro),
                   conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.deliveries.read")
    return {"items": webhooks.delivery_log(conn, endpoint_id, limit)}


@router.get("/partners/outbox")
def get_outbox(request: Request, endpoint_id: str | None = None, state: str | None = None, limit: int = 100,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.outbox.read")
    return {"items": webhooks.outbox_view(conn, endpoint_id, state, limit)}


@router.post("/partners/outbox/{event_id}/redeliver")
def post_redeliver(event_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _gate(conn, request, principal, "partner.delivery.redeliver")
    return _run(webhooks.redeliver, conn, principal, event_id, _rid(request))
