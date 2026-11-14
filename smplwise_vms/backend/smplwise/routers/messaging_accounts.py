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
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, is_system_admin, require
from ..services import ha_client
from ..services import messaging_accounts as ma
from ..services import messaging_runtime as mr
from ..services import wa_pacing, wa_policy
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
    per_minute: int | None = None
    burst: int | None = None
    lease_ttl_s: int | None = None
    senders: dict[str, str] | None = None  # Arx account key -> WisKey's opaque sender_ref (replaces the whole map)


def _pacing_view(conn: sqlite3.Connection, can_manage: bool) -> dict[str, Any]:
    svc = mr.service(conn)
    keys = [a.key for a in svc.doc().accounts if not a.removed] + [k for k in svc.discovered() if svc.doc().account(k) is None]
    cfg = wa_pacing.load_config(conn)
    out = wa_pacing.snapshot(conn, mr.pacer_on(conn), keys, dt.datetime.now(dt.timezone.utc))
    out["can_manage"] = can_manage
    out["applies"] = bool(mr._tickets_module_on(conn)) and cfg.enabled  # the budget governs the tickets module's sends; with it off nothing here changes
    return out


@router.get("/messaging/whatsapp/pacing")
def get_pacing(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The shared send budget: mode, the numbers it works with, and per account the counters of the last 24 hours (sent, deferred,
    backoff, expired), the queue waiting on the budget, the backoff in force and what is known of WisKey's own sends (`unknown` is never
    zero). No number, text or recipient."""
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
                                             "per_minute": [current.per_minute, new.per_minute], "burst": [current.burst, new.burst],
                                             "senders_accounts": sorted(new.senders),
                                             "max_wait_changed": sorted(k for k in wa_pacing.CLASSES if current.max_wait_min.get(k) != new.max_wait_min.get(k))})
    return _pacing_view(conn, True)


# ---------------------------------------------------------------- WAPACE-295: the recipient allow-list and the self-messages test window

class PolicyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enforce: bool


class AllowBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str = Field(max_length=40)
    label: str = Field(max_length=200)
    role: str = Field(default="other", max_length=16)


class SelfWindowBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    minutes: int | None = None  # None = switch off now


def _policy_view(conn: sqlite3.Connection, can_manage: bool) -> dict[str, Any]:
    return wa_policy.view(wa_policy.load(conn), dt.datetime.now(dt.timezone.utc), can_manage)


def _policy_audit(conn: sqlite3.Connection, principal: Principal, request: Request, what: str, **details: Any) -> None:
    audit(conn, actor=principal, action="messaging.whatsapp.policy", decision="allowed", resource_type="installation", resource_id=wa_policy.SETTING_KEY,
          request_id=_rid(request), details={"change": what, **details})


@router.get("/messaging/whatsapp/policy")
def get_policy(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The recipient allow-list (labels, roles, last four digits - never a number) and the self-messages test window."""
    return _policy_view(conn, _reader(conn, principal))


@router.put("/messaging/whatsapp/policy")
def put_policy(body: PolicyBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, MANAGE, INSTALLATION)
    current = wa_policy.load(conn)
    wa_policy.store(conn, wa_policy.with_enforce(current, body.enforce))
    _policy_audit(conn, principal, request, "enforce", before=current.enforce, after=body.enforce, entries=len(current.allow))
    return _policy_view(conn, True)


@router.post("/messaging/whatsapp/policy/allow")
def add_allowed(body: AllowBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add one handler / provider by number. Only the keyed hash, the label, the role and the last four digits are stored."""
    require(conn, principal, MANAGE, INSTALLATION)
    digits = phone_digits(body.phone)
    if digits is None:
        raise _problems([{"code": "target_invalid", "field": "phone"}])
    from pathlib import Path

    from ..db import database_of

    db = database_of(conn)
    key = mr.messaging_key(Path(db.path).parent) if db is not None else None
    if key is None:
        raise ApiError(503, "messaging_key_unavailable", "מפתח ההודעות אינו זמין.")
    current = wa_policy.load(conn)
    new, problems = wa_policy.with_entry(current, key=mr.recipient_key(key, digits), digits=digits, label=body.label, role=body.role)
    if problems:
        raise _problems(problems)
    wa_policy.store(conn, new)
    _policy_audit(conn, principal, request, "allow_add", role=body.role, entries=len(new.allow))
    return _policy_view(conn, True)


@router.delete("/messaging/whatsapp/policy/allow/{entry_id}")
def remove_allowed(entry_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, MANAGE, INSTALLATION)
    current = wa_policy.load(conn)
    new, problems = wa_policy.without_entry(current, entry_id[:40])
    if problems:
        raise ApiError(404, "not_found", "הרשומה לא נמצאה.")
    wa_policy.store(conn, new)
    _policy_audit(conn, principal, request, "allow_remove", entries=len(new.allow))
    return _policy_view(conn, True)


@router.put("/messaging/whatsapp/policy/self-messages")
def put_self_window(body: SelfWindowBody, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Open (or restart) a timed self-messages test window of `minutes` (1-240), or switch it off with `minutes: null`. It ends by itself."""
    require(conn, principal, MANAGE, INSTALLATION)
    now = dt.datetime.now(dt.timezone.utc)
    wa_policy.expire_window(conn, now)
    current = wa_policy.load(conn)
    new, problems = wa_policy.with_self_window(current, body.minutes, now)
    if problems:
        raise _problems(problems)
    wa_policy.store(conn, new)
    audit(conn, actor=principal, action="messaging.whatsapp.self_messages", decision="allowed", resource_type="installation", resource_id=wa_policy.SETTING_KEY,
          request_id=_rid(request), details={"state": "on" if body.minutes is not None else "off", "minutes": body.minutes})
    return _policy_view(conn, True)


# the reservation port: WisKey asks for one send of its own, atomically against the same budget (docs/changes/CR-WA-PACING-295.md section 4)

class ReserveBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sender_ref: str = Field(max_length=128)
    klass: str = Field(alias="class", max_length=16)
    request_id: str = Field(pattern=r"^[A-Za-z0-9_.:\-]{8,128}$")


class SlowdownBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scope: str = Field(max_length=16)
    retry_after_s: int | None = Field(default=None, ge=1, le=86400)


class ReleaseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str = Field(pattern=r"^[A-Za-z0-9_.:\-]{8,128}$")
    outcome: str = Field(max_length=24)
    slowdown: SlowdownBody | None = None


RESERVE = "messaging.pacing.reserve"


def port_principal_barred(conn: sqlite3.Connection, principal: Principal) -> str | None:
    """F3B WP-03: why this principal may never be the reservation port's caller, else None. The port user is a dedicated, single-permission
    service user (CR-WA-PACING-295-PORT-CONTRACT 2.2): never an infrastructure administrator (an active `system_admin` binding at the
    installation scope) and never a home-system administrator. Fail closed on both."""
    if is_system_admin(conn, principal.user_id):
        return "system_admin_not_allowed"
    row = conn.execute("SELECT is_admin FROM ha_users WHERE id = ?", (principal.user_id,)).fetchone()
    if row is not None and row["is_admin"]:
        return "ha_admin_not_allowed"
    return None


def _port(conn: sqlite3.Connection, principal: Principal) -> wa_pacing.WaReservations:
    """The port's gate: ONLY `messaging.pacing.reserve` (a dedicated service principal's single-permission role) - `messaging.accounts.manage`
    does not open it and it opens nothing else."""
    require(conn, principal, RESERVE, INSTALLATION)
    barred = port_principal_barred(conn, principal)
    if barred is not None:  # F3B WP-03: the contract's "dedicated, not an administrator" rule, enforced
        audit(conn, actor=principal, action=RESERVE, decision="denied", resource_type="installation", resource_id="messaging.whatsapp.port", reason=barred)
        raise ApiError(403, "port_principal_forbidden", "משתמש זה אינו יכול לשמש את שער ההקצאות.", details={"reason": barred})
    return wa_pacing.WaReservations(mr.pacer_on(conn), mr.pacing_for(conn))


_AUDITED_KEYS = ("granted", "released", "found", "reason", "repeated", "late", "conflict", "state")


def _port_audit(conn: sqlite3.Connection, principal: Principal, action: str, request_id: str, out: dict[str, Any], **extra: Any) -> None:
    """F3B WP-04: every port call that passed the gate leaves an actor trace - the lease id (chosen by WisKey, not a secret), the answer's
    flags and reason codes, the class / outcome / slow-down scope. Never a number, a text, a recipient or a token."""
    details = {k: out[k] for k in _AUDITED_KEYS if k in out and isinstance(out[k], (bool, str))}
    details.update({k: v for k, v in extra.items() if v is not None})
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="installation", resource_id=request_id, details=details)


@router.post("/messaging/whatsapp/pacing/reserve")
def reserve(body: ReserveBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`granted` + a short-lived lease, or `denied` with `reason` and `retry_after_s` (both HTTP 200: a decision is an answer, not an error).
    Idempotent by `request_id`. Contract: docs/changes/CR-WA-PACING-295-PORT-CONTRACT.md."""
    out = _port(conn, principal).reserve(sender_ref=body.sender_ref, klass=body.klass, request_id=body.request_id, now=dt.datetime.now(dt.timezone.utc))
    _port_audit(conn, principal, "messaging.pacing.reserve", body.request_id, out, klass=body.klass[:16])
    return out


@router.post("/messaging/whatsapp/pacing/release")
def release(body: ReleaseBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Settle a lease with the outcome (accepted_by_provider | not_sent | unknown | expired), optionally with the provider slow-down that
    caused it. Idempotent: the first outcome stands."""
    out = _port(conn, principal).release(request_id=body.request_id, outcome=body.outcome, now=dt.datetime.now(dt.timezone.utc),
                                         slowdown=body.slowdown.model_dump() if body.slowdown else None)
    _port_audit(conn, principal, "messaging.pacing.release", body.request_id, out, outcome=body.outcome[:24],
                slowdown=body.slowdown.scope if body.slowdown else None)
    return out


@router.get("/messaging/whatsapp/pacing/lease/{request_id}")
def lease_status(request_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Reconciliation: what Arx holds for one `request_id`."""
    if not re.match(r"^[A-Za-z0-9_.:\-]{8,128}$", request_id):
        raise _problems([{"code": "invalid", "field": "request_id"}])
    out = _port(conn, principal).status(request_id=request_id, now=dt.datetime.now(dt.timezone.utc))
    _port_audit(conn, principal, "messaging.pacing.lease_status", request_id, out)
    return out
