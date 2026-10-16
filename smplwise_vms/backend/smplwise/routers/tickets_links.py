"""CR-038 slice 4 - the manager's side of handler links and the public page's administration (spec 8.1, 10, 14.2, 17):

- `POST /tickets/{id}/assign/preview`         manager + tickets.external: the outgoing text, channel, link times, refusals (no effect)
- `POST /tickets/{id}/link/copy|new|revoke|resend`   manager (copy / new / resend also tickets.external): services/tickets/external.py
- `GET  /tickets/health`                       system.configure: the public listener, its counters, the key, the links (spec 17)
- `POST /tickets/address/probe`                system.configure, LOCAL ONLY (remote_channel.BLOCKED_ON_REMOTE), 6 / min: SSRF-safe
- `POST /tickets/key/rotate`                   system.configure + confirm: every live link revoked, every phone key re-derived
Every route answers the module's uniform 404 while it is off. Mounted BEFORE routers/tickets.py (`/tickets/{ticket_id}` would
match `/tickets/health`). The copy answer carries the handler URL: `Cache-Control: no-store`, never logged, never audited."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services.tickets import access, address_probe, attachments, external, handler_links, links, settings_doc, store_links
from ..services.tickets.access import Viewer, text
from ..services.tickets.keyring import KEYS
from ..services.tickets.module_key import ModuleKeyError
from ..services.tickets.public_runtime import RUNTIME
from .tickets import ID, _detail, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class PreviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact_id: str = Field(min_length=1, max_length=64, pattern=ID)
    require_code: bool = False


@router.post("/tickets/{ticket_id}/assign/preview")
def assign_preview(body: PreviewBody, ticket_id: str = Path(..., pattern=ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    return external.preview(conn, viewer, seen, body.contact_id, require_code=body.require_code)


@router.post("/tickets/{ticket_id}/link/{action}")
def link_action(request: Request, ticket_id: str = Path(..., pattern=ID), action: Literal["copy", "new", "revoke", "resend"] = Path(...),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    viewer = Viewer(conn, principal)
    seen = access.require_visible(viewer, ticket_id)
    rid = _rid(request)
    if action == "copy":
        answer = external.copy_link(conn, viewer, seen, rid)
        return JSONResponse(answer, headers={"Cache-Control": "no-store"})
    if action == "new":
        external.new_link(conn, viewer, seen, rid)
    elif action == "revoke":
        external.revoke_link(conn, viewer, seen, rid)
    else:
        external.resend(conn, viewer, seen, rid)
    return _detail(conn, viewer, ticket_id)


@router.get("/tickets/health")
def health(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    out = RUNTIME.health(conn)
    try:
        out["attachments_bytes"] = attachments.used_bytes(settings_of(request).data_dir)
    except Exception:  # noqa: BLE001 - a health page never fails on a statistic
        out["attachments_bytes"] = None
    return out


class ProbeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base_url: str | None = Field(default=None, max_length=300)


@router.post("/tickets/address/probe")
async def probe(body: ProbeBody, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    if not address_probe.admit():
        raise ApiError(429, "rate_limited", text(conn, "יותר מדי בדיקות. נסו שוב בעוד דקה."), retryable=True, details={"retry_after_s": 60})
    pub = settings_doc.read(conn)["public"]
    base = body.base_url if body.base_url is not None else pub["base_url"]
    from ..services.tickets import links as links_mod

    prefix = links_mod.effective_prefix(base or "", pub["path_prefix"])
    from ..services.tickets.public_server import SERVER

    def last_probe() -> dict[str, Any] | None:  # the running listener's note of the probe's nonce (wiring item 5, W13)
        return ((SERVER.snapshot() or {}).get("stats") or {}).get("last_probe")

    result = await run_in_threadpool(lambda: address_probe.probe(base or "", last_probe=last_probe if SERVER.running else None, prefix=prefix))
    audit(conn, actor=principal, action="tickets.address.probe", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"result": result["result"]})
    return result


class RotateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: Literal[True]


@router.post("/tickets/key/rotate")
def rotate_key(body: RotateBody, request: Request, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Spec 7.4: a new module key - every live link revoked (`module_key`), every contact's phone key re-derived, in ONE
    transaction; the old key file stays until no row names it (the janitor retires it), so no crash point strands a row."""
    require(conn, principal, "system.configure", INSTALLATION)
    if not KEYS.can_rotate():
        raise ApiError(409, "rotation_unavailable", text(conn, "החלפת המפתח אינה זמינה בגרסה זו."))
    try:
        new_id, new_key = KEYS.stage()
    except ModuleKeyError:
        raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול חסר (שחזור ללא secrets/). שחזרו את התיקייה מהגיבוי.")) from None
    now = handler_links.now_utc()
    revoked = 0
    for row in store_links.live_links(conn):
        if handler_links.revoke(conn, row, "module_key", now):
            revoked += 1
    rekeyed = 0
    for c in store_links.phone_keyed_contacts(conn):
        store_links.set_phone_key(conn, c["id"], links.phone_key(new_key, c["phone_e164"]), new_id)
        rekeyed += 1
    KEYS.commit(new_id)
    audit(conn, actor=principal, action="ticket.key.rotate", decision="allowed", resource_type="installation", resource_id="tickets",
          request_id=_rid(request), details={"links_revoked": revoked, "contacts_rekeyed": rekeyed})
    return {"rotated": True, "links_revoked": revoked, "contacts_rekeyed": rekeyed}
