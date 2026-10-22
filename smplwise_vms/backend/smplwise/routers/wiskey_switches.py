"""SMALLFIXA-295 (Fable review 3 G-01 / G-03): the administrator's writer of the `wiskey.acr5_*` switches (services/wiskey_switches.py).

- GET /wiskey/switches   the four switches (`off | on`) and whether the build carries the consumer's go-live permit
- PUT /wiskey/switches   `{switches: {"wiskey.acr5_...": "off" | "on"}}`, all or nothing

Both need `system.configure` at the installation AND a system administrator (like the access-grants settings). Every refusal after the
permission check is audited (`settings.changed` denied, closed reason, the number of keys only - never the caller's key text); every
written switch is audited with its before / after. A go-live permit is never a setting: a key naming one is refused."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import wiskey_switches as ws

router = APIRouter()
BASE = "/wiskey/switches"
_TEXT = {
    "validation": "הבקשה אינה תקינה.",
    "unknown_switch": "מתג לא מוכר.",
    "permit_not_writable": "אישור הפעלה אינו הגדרה ואי אפשר לשנות אותו מכאן.",
    "wiskey_not_permitted": "גרסה זו אינה כוללת אישור הפעלה לקריאה הזו.",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SwitchesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    switches: dict[str, str] = Field(max_length=16)


def _admin_or_403(conn: sqlite3.Connection, principal: Principal, request: Request, action: str, keys: int) -> None:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="wiskey.switches",
              reason="not_system_admin", request_id=_rid(request), details={"keys": keys})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו." if action == "settings.changed" else "רק מנהל מערכת יכול לצפות בהגדרה זו.")


@router.get(BASE)
def get_switches(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """SMALLFIXA-295 (review 3 G-01): the four wiskey.acr5_* switches and the consumer's go-live permit (system administrator)."""
    _admin_or_403(conn, principal, request, "settings.read", len(ws.SWITCHES))
    return ws.view(conn)


@router.put(BASE)
def put_switches(body: SwitchesIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    """SMALLFIXA-295 (review 3 G-01): set wiskey.acr5_* switches, all or nothing; a permit key is refused; audited (system administrator)."""
    with request.app.state.db.connection(label="wiskey.switches") as conn:
        _admin_or_403(conn, principal, request, "settings.changed", len(body.switches))
        try:
            ws.check(body.switches)
        except ws.SwitchRefused as exc:
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="wiskey.switches",
                  reason=exc.code, request_id=_rid(request), details={"keys": len(body.switches)})
            # an ApiError still commits the request's transaction (db.connection): the refusal row is kept, nothing was written
            raise ApiError(exc.status, exc.code, _TEXT[exc.code]) from None
        for key, before, after in ws.apply(conn, body.switches):
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="wiskey.switches",
                  request_id=_rid(request), details={"key": key, "before": before, "after": after})
        return ws.view(conn)
