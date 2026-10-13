"""CR-040 (WXROT): the bridge trust-key rotation - Settings › בקרת כניסה › "מפתח הגשר". Local channel only (remote_channel.py
BLOCKED_ON_REMOTE); every route needs `access.trust.rotate` at installation scope (sensitive; any role may carry it, per user through
a custom role and a binding; never delegable); the two writes also need an interactive session and the rotation an explicit
`confirmed: true` from the client's confirmation step (never supplied by the server).

- `GET /ha/bridge/trust` - the view (services/bridge_trust.view): epoch, the bridge's version / support / last confirmed epoch, the
  open request, the last 20 results, whether a rotation can start and why not. Never a key, salt, proof, nonce or signature.
- `POST /ha/bridge/trust/rotations` `{confirmed: true}` - one rotation, synchronously: `rotated`, `not_rotated` or `unknown` with a
  Hebrew message and the refreshed view. A refusal before anything is written (not confirmed, unsupported bridge, an open request,
  not paired ...) is an error answer, audited `bridge.trust.rotation.refused`; nothing is retried.
- `POST /ha/bridge/trust/rotations/{request_id}/check` - the status read of an open request (6 per minute per person); it never sends
  the rotation again."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, StrictBool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import bridge_trust

router = APIRouter()

UUID4 = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"


class RotateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: StrictBool = False


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _interactive(conn: sqlite3.Connection, principal: Principal, request: Request) -> None:
    """A person at an interactive session (Ingress, an Arx browser session, the developer identity) - never a bearer-token client
    (the rule of services/intercom_writes.interactive)."""
    from ..services.intercom_writes import interactive

    if not interactive(principal):
        audit(conn, actor=principal, action="bridge.trust.rotation.refused", decision="denied", resource_type="bridge_trust", resource_id="rotation",
              reason="interactive_session_required", request_id=_rid(request))
        raise ApiError(403, "interactive_session_required", "החלפת המפתח אפשרית רק ממסך מחובר, לא מלקוח עם אסימון.")


@router.get("/ha/bridge/trust")
def trust_view(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, bridge_trust.PERMISSION, INSTALLATION)
    return bridge_trust.view(conn, settings_of(request))


@router.post("/ha/bridge/trust/rotations")
def trust_rotate(body: RotateIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, bridge_trust.PERMISSION, INSTALLATION)
    _interactive(conn, principal, request)
    if body.confirmed is not True:
        audit(conn, actor=principal, action="bridge.trust.rotation.refused", decision="denied", resource_type="bridge_trust", resource_id="rotation",
              reason="confirmation_required", request_id=_rid(request))
        raise ApiError(409, "confirmation_required", "החלפת המפתח דורשת אישור מפורש.")
    return bridge_trust.start(conn, settings_of(request), principal)


@router.post("/ha/bridge/trust/rotations/{request_id}/check")
def trust_check(request: Request, request_id: str = Path(..., pattern=UUID4), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, bridge_trust.PERMISSION, INSTALLATION)
    _interactive(conn, principal, request)
    return bridge_trust.check(conn, settings_of(request), principal, request_id)
