"""NOTIFWA: the WhatsApp notification channel's routes (docs/changes/NOTIFWA-WHATSAPP-CHANNEL.md, services/notify_whatsapp.py).

| Method | Path | Who | What |
|---|---|---|---|
| GET  | /notify/whatsapp       | notify.manage | the master switch, the per-user hourly cap, the de-duplication window, the mapped account (label with the last four digits, state), how many users can be reached (a COUNT), whether the caller has a number of their own for the test |
| PUT  | /notify/whatsapp       | notify.manage | change the switch / cap / window (revisioned; audited `notify.whatsapp.update` with the changed field names) |
| POST | /notify/whatsapp/test  | notify.manage | one fixed test text to the CALLER's own number only (no number is ever typed); 3 / hour per user + the account's 5 / hour; audited `notify.whatsapp.test` |
| GET  | /me/notify-whatsapp    | any signed-in user | the caller's own masked number (`····NN`), its source and consent, the own opt-out |
| PUT  | /me/notify-whatsapp    | any signed-in user | `{opted_out}`: stop / allow WhatsApp notifications to the caller's own number; audited `notify.whatsapp.optout` |

No route accepts a phone number and no answer carries one (masked to the last two digits, the caller's own only).
"""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, Request
from fastapi.responses import JSONResponse

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import notify_whatsapp as wa
from ..services.notify_visibility import MANAGE
from .notifications import _expected_revision

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _err(exc: wa.ConfigInvalid) -> ApiError:
    return ApiError(exc.status, exc.code, exc.message, retryable=exc.status == 429, details=exc.details)


@router.get("/notify/whatsapp")
def get_whatsapp(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, MANAGE, INSTALLATION)
    return wa.admin_view(conn, principal.user_id)


@router.put("/notify/whatsapp")
def put_whatsapp(request: Request, body: dict[str, Any] = Body(...), if_match: str | None = Header(None), principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{enabled?, per_user_hour? (1-30), dedupe_min? (0-1440), revision | base_revision}`; a stale revision is 412 `settings_conflict`."""
    require(conn, principal, MANAGE, INSTALLATION)
    try:
        _cfg, changed = wa.update_config(conn, body, _expected_revision(if_match, body.get("base_revision", body.get("revision"))))
    except wa.ConfigInvalid as exc:
        raise _err(exc) from None
    audit(conn, actor=principal, action="notify.whatsapp.update", decision="allowed", resource_type="installation", resource_id="notify.whatsapp", request_id=_rid(request),
          details={"changed": changed})
    return wa.admin_view(conn, principal.user_id)


@router.post("/notify/whatsapp/test")
def test_whatsapp(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """One test message to the caller's own resolved number. `{ok, outcome, code}`; 409 `no_address` / `no_consent` / `channel_unavailable`;
    429 `rate_limited` with Retry-After. Works while the master switch is off (it is how an administrator checks the account first)."""
    require(conn, principal, MANAGE, INSTALLATION)
    allowed, wait = wa.take_test_slot(principal.user_id)
    if not allowed:
        err = ApiError(429, "rate_limited", "יותר מדי הודעות בדיקה. נסו שוב מאוחר יותר.", retryable=True, details={"retry_after_s": wait})
        return JSONResponse(status_code=429, content=err.payload(_rid(request) or ""), headers={"Retry-After": str(wait)})
    db = request.app.state.db
    try:
        out = wa.send_test(conn, db, principal.user_id)
    except wa.ConfigInvalid as exc:
        audit(conn, actor=principal, action="notify.whatsapp.test", decision="denied", resource_type="installation", resource_id="notify.whatsapp", request_id=_rid(request),
              reason=exc.code)
        # an answer, not a raise: the request's transaction (and the refusal's audit row) is committed
        headers = {"Retry-After": str(int(exc.details.get("retry_after_s") or 60))} if exc.status == 429 else None
        return JSONResponse(status_code=exc.status, content=_err(exc).payload(_rid(request) or ""), headers=headers)
    audit(conn, actor=principal, action="notify.whatsapp.test", decision="allowed", resource_type="installation", resource_id="notify.whatsapp", request_id=_rid(request),
          details={"outcome": out["outcome"], "code": out["code"], "account": out["account"]})
    return {"ok": out["ok"], "outcome": out["outcome"], "code": out["code"]}


@router.get("/me/notify-whatsapp")
def my_whatsapp(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return wa.my_view(conn, principal.user_id)


@router.put("/me/notify-whatsapp")
def set_my_whatsapp(request: Request, body: dict[str, Any] = Body(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = body.get("opted_out") if isinstance(body, dict) else None
    if not isinstance(v, bool) or set(body) - {"opted_out"}:
        raise ApiError(422, "validation", "opted_out: כן/לא בלבד.", details={"field": "opted_out"})
    wa.set_opt_out(conn, principal.user_id, v)
    audit(conn, actor=principal, action="notify.whatsapp.optout", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request),
          details={"opted_out": v})
    return wa.my_view(conn, principal.user_id)
