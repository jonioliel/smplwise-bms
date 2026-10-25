"""WKR5-295 (hand-off units C and F): the administration of the WisKey people-write lineage (services/wiskey_write_lineage.py) of the
direct join (services/wiskey_direct_join.py). Every route: a system administrator; the three actions also need an interactive session.

- GET  /access-control/wiskey-lineage                       status, counts per state, the OPEN operations (refs, codes, times only)
- POST /access-control/wiskey-lineage/{op}/resolve          the ORIGINAL receipt read of one UNKNOWN operation (peer_receipts/resolve
                                                            with a current read binding + the stored full original7; a name_ref apply:
                                                            users/bulk_receipt by the same actor). A READ: the write is never resent.
- POST /access-control/wiskey-lineage/{op}/close            `{code, confirm: true}` ends an UNKNOWN that cannot be resolved: it STAYS
                                                            unknown (never not_sent), is never resent, and its 30-day retention starts
- POST /access-control/wiskey-lineage/reinitialise          `{confirm: "<word>"}` a missing or stale lineage starts a new generation;
                                                            nothing old is resent

Without an installed join (the default: `local`, or no signing key) every route answers 409 `wiskey_direct_not_installed` and touches
nothing. No route shows a sealed original, a name, a PIN, a card or a payload."""
from __future__ import annotations

import re
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import Principal, is_system_admin
from ..services import intercom_writes as iw
from ..services import wiskey_direct_join as wkj

router = APIRouter()
BASE = "/access-control/wiskey-lineage"
_OP = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
REINIT_WORD = "אתחול"
_CODE = re.compile(r"^[a-z0-9_:-]{1,64}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _admin(request: Request, principal: Principal, *, action: str, interactive: bool) -> None:
    with request.app.state.db.connection(label="wiskey_lineage.gate") as conn:
        reason = None
        if not is_system_admin(conn, principal.user_id):
            reason = "not_system_admin"
        elif interactive and not iw.interactive(principal):
            reason = "interactive_only"
        if reason is not None:
            audit(conn, actor=principal, action=action, decision="denied", resource_type="wiskey_lineage", resource_id="*", reason=reason,
                  request_id=_rid(request))
            raise ApiError(403, reason, "רק מנהל מערכת בהפעלה אינטראקטיבית יכול לבצע פעולה זו." if interactive else "רק מנהל מערכת.")


def _join() -> wkj.DirectJoin:
    join = wkj.installed()
    if join is None or join.lineage is None:
        raise ApiError(409, "wiskey_direct_not_installed", "החיבור הישיר אינו מותקן במערכת זו.")
    return join


def _actor_ref(principal: Principal) -> str:
    return f"arx-user:{principal.user_id}"[:128]


@router.get(BASE)
def view(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if not is_system_admin(conn, principal.user_id):
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת.")
    join = wkj.installed()
    if join is None:
        return {"installed": False, "lineage": None}
    return join.lineage_view()


@router.post(f"{BASE}/{{operation_id}}/resolve")
async def resolve(request: Request, operation_id: str = Path(..., pattern=_OP), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    _admin(request, principal, action="wiskey.lineage.resolve", interactive=True)
    join = _join()
    from ..services.wiskey_native_write import NativeWriteError
    from ..services.wiskey_write_lineage import LineageError

    try:
        out = await join.resolve(operation_id)
    except LineageError as exc:
        raise ApiError(404 if exc.code == "unknown_operation" else 409, exc.code, "הפעולה לא נמצאה ברישום.") from None
    except NativeWriteError as exc:
        raise ApiError(409, exc.code, "לא ניתן לברר פעולה זו.") from None
    with request.app.state.db.connection(label="wiskey_lineage.resolve") as conn:
        audit(conn, actor=principal, action="wiskey.lineage.resolve", decision="allowed", resource_type="wiskey_lineage", resource_id=operation_id,
              request_id=_rid(request), details={"state": out.state, "code": out.code})
    return {"operation_id": operation_id, "state": out.state, "code": out.code, "person_revision": out.person_revision, "resent": False}


class CloseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(..., min_length=1, max_length=64)
    confirm: Literal[True]


@router.post(f"{BASE}/{{operation_id}}/close")
def close(body: CloseIn, request: Request, operation_id: str = Path(..., pattern=_OP), principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    _admin(request, principal, action="wiskey.lineage.close", interactive=True)
    if not _CODE.fullmatch(body.code):
        raise ApiError(422, "invalid_code", "קוד לא תקין.")
    join = _join()
    from ..services.wiskey_write_lineage import LineageError

    try:
        join.close_unknown(operation_id, actor_ref=_actor_ref(principal), code=body.code)
    except LineageError as exc:
        raise ApiError(409, exc.code, "רק פעולה במצב לא ידוע ופתוחה ניתנת לסגירה.") from None
    with request.app.state.db.connection(label="wiskey_lineage.close") as conn:
        audit(conn, actor=principal, action="wiskey.lineage.close", decision="allowed", resource_type="wiskey_lineage", resource_id=operation_id,
              request_id=_rid(request), details={"code": body.code})
    return {"operation_id": operation_id, "state": "unknown", "closed": True, "resent": False}


class ReinitIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str = Field(..., max_length=32)


@router.post(f"{BASE}/reinitialise")
def reinitialise(body: ReinitIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    _admin(request, principal, action="wiskey.lineage.reinitialise", interactive=True)
    if body.confirm.strip() != REINIT_WORD:
        raise ApiError(422, "confirm_mismatch", "יש להקליד את מילת האישור.")
    join = _join()
    from ..services.wiskey_write_lineage import LineageError

    before = join.lineage.status  # type: ignore[union-attr]
    try:
        join.reinitialise(actor_ref=_actor_ref(principal))
    except LineageError as exc:
        raise ApiError(409, exc.code, "הרישום אינו במצב שמצריך אתחול.") from None
    with request.app.state.db.connection(label="wiskey_lineage.reinit") as conn:
        audit(conn, actor=principal, action="wiskey.lineage.reinitialise", decision="allowed", resource_type="wiskey_lineage", resource_id="*",
              request_id=_rid(request), details={"before": before, "after": join.lineage.status})  # type: ignore[union-attr]
    return {"status": join.lineage.status, "resent": False}  # type: ignore[union-attr]
