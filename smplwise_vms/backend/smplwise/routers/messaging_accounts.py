"""CR-038 slice 5a (section 9.9, D9, D27): Settings › ערוץ ההודעות - which linked WhatsApp account sends for which use.

Installation-level, not inside the tickets module (other modules register their own uses later), so these routes are NOT behind the
tickets module gate. Read: `system.configure` or `messaging.accounts.manage` (installation scope); every change:
`messaging.accounts.manage` (sensitive, system_admin by default).

  GET  /messaging/whatsapp          accounts (state, last send, 24 h sends, uses), active uses + mapping, warnings, channels
  PUT  /messaging/whatsapp          the whole mapping document, revision-checked (409 settings_stale); a move of a use with queued
                                    messages answers 409 queued_messages with the counts until `confirm_queued` (9.9.3)
  POST /messaging/whatsapp/refresh  forget the `missing` marks, re-read the mirror and the on-demand label of each connection entity
                                    (only the last four digits are kept)
  POST /messaging/whatsapp/test     one test message from one account to a typed number - OFF until slice 5b's outbox exists AND the
                                    owner approved live sends (messaging_runtime.test_send_enabled); local channel only
                                    (remote_channel.BLOCKED_ON_REMOTE)
  GET/PUT /messaging/whatsapp/pacing  CR-WA-PACING-295: the shared send budget - mode (conservative | standard | off), WisKey shares the number,
                                    queue age limits per class; GET also the counters (same read gate)

Audit: `messaging.accounts.update` (use keys and account KEYS before / after, account keys added / removed / changed - never a number,
a typed value or a label), `messaging.accounts.refresh` (counts), `messaging.accounts.test` (account key, outcome). Nothing here writes
to Home Assistant or `ha-whatsapp`."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import ha_client
from ..services import messaging_accounts as ma
from ..services import messaging_runtime as mr
from ..services import wa_pacing
from ..services.tickets.channel import phone_digits

router = APIRouter()
MANAGE = mr.MANAGE


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _reader(conn: sqlite3.Connection, principal: Principal) -> bool:
    """Read gate: `messaging.accounts.manage` (may edit) or `system.configure` (read-only, manual values masked). Returns may-edit."""
    if authorize(conn, principal, MANAGE, INSTALLATION).allowed:
        return True
    if authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        return False
    require(conn, principal, MANAGE, INSTALLATION)  # refuses and audits
    return False


@router.get("/messaging/whatsapp")
def get_whatsapp(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    can_manage = _reader(conn, principal)
    return mr.view(conn, can_manage=can_manage)


class PacingBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min_gap_s: int | None = None
    jitter_s: int | None = None
    per_hour: int | None = None
    per_day: int | None = None
    per_recipient_hour: int | None = None
    hold_when_down_min: int | None = None


class AccountBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(max_length=80)
    kind: str = Field(max_length=16)
    label: str = Field(default="", max_length=200)
    shared_outside: bool = False
    removed: bool = False
    pacing: PacingBody | None = None
    account: str | None = Field(default=None, max_length=80)  # manual only: the typed value (entry id or the number's digits)
    status_entity_id: str | None = Field(default=None, max_length=255)
    connected_states: list[str] | None = Field(default=None, max_length=8)


class WhatsappBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    accounts: list[AccountBody] = Field(default_factory=list, max_length=50)
    uses: dict[str, str | None] = Field(default_factory=dict)
    confirm_queued: bool = False


def _problems(problems: list[dict[str, str]]) -> ApiError:
    return ApiError(422, "validation", "ערך לא תקין.", details={"fields": problems})


def _keep_last4(new: ma.MappingDoc, current: ma.MappingDoc) -> ma.MappingDoc:
    """A client never sets `last4`: a discovered account keeps the digits the refresh read; a manual one takes its typed value's."""
    from dataclasses import replace

    fixed = []
    for a in new.accounts:
        if a.kind == "manual":
            fixed.append(replace(a, last4=ma.last4_of(a.value)))
        else:
            old = current.account(a.key)
            fixed.append(replace(a, last4=old.last4 if old else None))
    return replace(new, accounts=tuple(fixed))


@router.put("/messaging/whatsapp")
def put_whatsapp(body: WhatsappBody, request: Request, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, MANAGE, INSTALLATION)
    svc = mr.service(conn)
    current = svc.doc()
    if body.uses and len(body.uses) > 400:
        raise _problems([{"code": "too_many", "field": "uses"}])
    raw = {"revision": body.revision, "uses": body.uses,
           "accounts": [{k: v for k, v in a.model_dump().items() if v is not None and not (k == "pacing" and not v)} for a in body.accounts]}
    for item, src in zip(raw["accounts"], body.accounts):
        if src.pacing is not None:
            item["pacing"] = {k: v for k, v in src.pacing.model_dump().items() if v is not None}
    new, problems = ma.validate_doc(raw, current=current, registry=svc.registry, discovered=svc.discovered())
    if any(p["code"] == "settings_stale" for p in problems):
        raise ApiError(409, "settings_stale", "ההגדרות השתנו בינתיים. טענו מחדש.", details={"revision": current.revision})
    if problems:
        raise _problems(problems)
    new = _keep_last4(new, current)
    moves = mr.resolution_moves(conn, current, new, svc.registry)
    waiting = [m for m in moves if m["count"] > 0]
    if waiting and not body.confirm_queued:
        raise ApiError(409, "queued_messages", "יש הודעות ממתינות שיישלחו מהחשבון החדש. אשרו כדי לשמור.",
                       details={"moves": [{"use": m["use"], "department_id": m["department_id"], "count": m["count"]} for m in waiting]})
    mr.store_doc(conn, new)
    before_keys = {a.key: a for a in current.accounts}
    after_keys = {a.key: a for a in new.accounts}
    changed_accounts = sorted(k for k in set(before_keys) & set(after_keys) if before_keys[k] != after_keys[k])
    audit(conn, actor=principal, action="messaging.accounts.update", decision="allowed", resource_type="installation", resource_id="messaging.whatsapp",
          request_id=_rid(request), details={
              "revision": new.revision, "uses": ma.changed_uses(current, new),
              "accounts_added": sorted(set(after_keys) - set(before_keys)), "accounts_removed": sorted(set(before_keys) - set(after_keys)),
              "accounts_changed": changed_accounts, "queued_moved": sum(m["count"] for m in moves)})
    return mr.view(conn, can_manage=True)


@router.post("/messaging/whatsapp/refresh")
def refresh(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """9.9.1: forget the `missing` marks of unknown-account answers, then read each discovered account's connection entity ON
    DEMAND for its number's last four digits (never mirrored, never logged, never stored whole). Accounts seen for the first time get
    a stored entry with the suggested label. The HA reads run outside the write lock."""
    require(conn, principal, MANAGE, INSTALLATION)
    settings = settings_of(request)
    svc = mr.service(conn)
    mr.TRACKER.refresh()
    found = svc.discovered()
    reads: dict[str, str | None] = {}
    with unlocked(conn):
        for key, d in found.items():
            if d.connection_entity_id:
                reads[key] = ma.read_last4(lambda eid: ha_client.get_state(settings, eid), d.connection_entity_id)
    from dataclasses import replace

    current = svc.doc()
    accounts = list(current.accounts)
    changed = False
    for key, d in found.items():
        digits = reads.get(key)
        acc = current.account(key)
        if acc is None:
            accounts.append(ma.Account(key=key, kind="discovered", label=f"וואטסאפ ····{digits}" if digits else ma.suggest_label(d.entry_id, None), last4=digits))
            changed = True
        elif digits and acc.last4 != digits:
            accounts = [replace(a, last4=digits) if a.key == key else a for a in accounts]
            changed = True
    if changed:
        mr.store_doc(conn, replace(current, revision=current.revision + 1, accounts=tuple(accounts)))
    audit(conn, actor=principal, action="messaging.accounts.refresh", decision="allowed", resource_type="installation", resource_id="messaging.whatsapp",
          request_id=_rid(request), details={"discovered": len(found), "labels_read": sum(1 for v in reads.values() if v), "stored": changed})
    return mr.view(conn, can_manage=True)


class TestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_key: str = Field(max_length=80)
    target: str = Field(max_length=40)


@router.post("/messaging/whatsapp/test")
def test_send(body: TestBody, request: Request, principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """9.3 "שליחת בדיקה": ONE fixed text from one account to a number the administrator types (purpose `test`, 5 / hour per
    account through the shared pacing, audited). Refused 409 `test_send_off` only until slice 5b registers the outbox (owner
    2026-10-14: no environment switch); the typed number is never stored, logged or audited."""
    require(conn, principal, MANAGE, INSTALLATION)
    if not mr.test_send_enabled() or mr.TEST_SENDER is None:
        raise ApiError(409, "test_send_off", "שליחת בדיקה אינה זמינה עדיין.")
    if not ma.KEY_RE.match(body.account_key):
        raise _problems([{"code": "account_key_invalid", "field": "account_key"}])
    ref = mr.service(conn).ref(body.account_key)
    if ref is None:
        raise ApiError(404, "account_not_found", "החשבון לא נמצא.")
    digits = phone_digits(body.target)
    if digits is None:
        raise _problems([{"code": "target_invalid", "field": "target"}])
    result = mr.TEST_SENDER(conn, ref, digits, principal.user_id or "system")
    audit(conn, actor=principal, action="messaging.accounts.test", decision="allowed", resource_type="installation", resource_id="messaging.whatsapp",
          request_id=_rid(request), details={"account": ref.key, "state": result.get("state")})
    return {"id": result.get("id"), "state": result.get("state")}


# ---------------------------------------------------------------- CR-WA-PACING-295: the shared send budget

class PacingModeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: str | None = Field(default=None, max_length=16)
    wiskey_shared: bool | None = None
    max_wait_min: dict[str, int] | None = None


def _pacing_view(conn: sqlite3.Connection, can_manage: bool) -> dict[str, Any]:
    svc = mr.service(conn)
    keys = [a.key for a in svc.doc().accounts if not a.removed] + [k for k in svc.discovered() if svc.doc().account(k) is None]
    cfg = wa_pacing.load_config(conn)
    out = wa_pacing.snapshot(conn, ma.SqliteSendLedger(conn), cfg, keys, dt.datetime.now(dt.timezone.utc))
    out["can_manage"] = can_manage
    out["applies"] = bool(mr._tickets_module_on(conn)) and cfg.enabled  # the budget governs the tickets module's sends; with it off nothing here changes
    return out


@router.get("/messaging/whatsapp/pacing")
def get_pacing(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The shared send budget: mode, the numbers it works with, and per account the counters of the last 24 hours (sent, deferred,
    backoff, expired), the queue waiting on the budget and the backoff in force. No number, text or recipient."""
    return _pacing_view(conn, _reader(conn, principal))


@router.put("/messaging/whatsapp/pacing")
def put_pacing(body: PacingModeBody, request: Request, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, MANAGE, INSTALLATION)
    current = wa_pacing.load_config(conn)
    raw = {**wa_pacing.config_to_json(current), **{k: v for k, v in body.model_dump().items() if v is not None}}
    if body.max_wait_min is not None:
        raw["max_wait_min"] = {**raw["max_wait_min"], **body.max_wait_min}
    new, problems = wa_pacing.validate_config(raw)
    if problems:
        raise _problems(problems)
    wa_pacing.store_config(conn, new)
    audit(conn, actor=principal, action="messaging.pacing.update", decision="allowed", resource_type="installation", resource_id=wa_pacing.SETTING_KEY,
          request_id=_rid(request), details={"mode": [current.mode, new.mode], "wiskey_shared": [current.wiskey_shared, new.wiskey_shared],
                                             "max_wait_changed": sorted(k for k in wa_pacing.CLASSES if current.max_wait_min.get(k) != new.max_wait_min.get(k))})
    return _pacing_view(conn, True)
