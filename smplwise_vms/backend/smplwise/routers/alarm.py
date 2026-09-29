"""The intrusion alarm API (CR-010, אבטחה › אזעקה). Panels, zones and bypass controls come from services/alarm.py; codes,
PINs and the per-user code policy from services/alarm_codes.py. docs/changes/CR-010-SECURITY-ALARM.md is the contract.

Reads: `GET /alarm/panels` (alarm.view, scoped like entity.state.read), `GET /alarm/me`.
Actions: `POST /alarm/panels/{id}/actions` (arm_* with alarm.arm, disarm with alarm.disarm) and
`POST /alarm/zones/{id}/bypass` (alarm.bypass) - through the same device-action path as every entity action (the
allow-list, an `ha_actions` record, the signed bridge call, the confirmation poll `GET /ha/actions/{id}`). JSON only,
the permission before the body, `client_request_id` + `expires_at` on the server's clock, every refusal audited.
Administration (system.configure): `GET /alarm/config`, the pairing overrides, the write-only panel code, each user's
code policy and PIN.

A code - typed or stored - is never written to a table other than its own (encrypted / hashed), never logged, audited,
returned, cached or put in a URL, and never echoed in an error: the bridge's error text is replaced by its code."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import get_setting, now_iso, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Decision, Principal, authorize, note_grant, permissions_anywhere, require
from ..services import alarm as svc
from ..services import alarm_codes as codes
from ..services import ha_actions, ha_bridge, ha_client, ha_scope, ha_sync
from ..services.timeutil import parse_utc

router = APIRouter()

VIEW, ARM, DISARM, BYPASS = "alarm.view", "alarm.arm", "alarm.disarm", "alarm.bypass"
CODE_REFUSALS = {"invalid_code", "code_required", "ServiceValidationError"}


# ---------------------------------------------------------------- scope

class _Scope:
    """The caller's reach for the four alarm permissions, computed once per request (entity reach rule, ha_scope)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        self.conn, self.principal = conn, principal
        self.placed = ha_scope.placements(conn)
        self.reach = {p: ha_scope.visible_floors(conn, principal, p) for p in (VIEW, ARM, DISARM, BYPASS)}

    def allowed(self, perm: str, entity_id: str) -> bool:
        wide, floors = self.reach[perm]
        return ha_scope.entity_visible(wide, floors, self.placed, entity_id)

    def decision(self, perm: str, entity_id: str) -> Decision | None:
        for target in [INSTALLATION] + [("floor", p["floor_id"]) for p in self.placed.get(entity_id, [])]:
            d = authorize(self.conn, self.principal, perm, target)
            if d.allowed:
                return d
        return None

    def any_view(self) -> bool:
        wide, floors = self.reach[VIEW]
        return wide or bool(floors)


def _settings(conn: sqlite3.Connection) -> dict[str, Any]:
    from .settings import read_settings

    s = read_settings(conn)
    return {
        "remote_control": s["alarm.remote_control"] == "true",
        "remote_disarm": s["alarm.remote_disarm"] == "true",
        "remote_codeless": s["alarm.remote_codeless"] == "true",
        "code_mode": s["alarm.code_mode"] if s["alarm.code_mode"] in ("personal_pin", "panel_code") else "personal_pin",
        "pin_min_length": int(s["alarm.pin_min_length"]) if str(s["alarm.pin_min_length"]).isdigit() and 4 <= int(s["alarm.pin_min_length"]) <= 8 else 6,
    }


def _remote_block(principal: Principal, cfg: dict[str, Any], kind: str) -> str | None:
    """Why the remote channel refuses this kind of action (arm / disarm / bypass_on / bypass_off), or None."""
    if principal.source != "remote":
        return None
    if not cfg["remote_control"]:
        return "remote_control_disabled"
    if kind in ("disarm", "bypass_on") and not cfg["remote_disarm"]:
        return "remote_disarm_disabled"
    return None


REMOTE_MESSAGES = {
    "remote_control_disabled": "שליטה באזעקה מחוץ לרשת המקומית כבויה בהגדרות המערכת.",
    "remote_disarm_disabled": "נטרול ועקיפת חיישנים מחוץ לרשת המקומית כבויים בהגדרות המערכת.",
}


REDACTED_KEYS = ("state", "last_changed", "tamper", "battery_low", "battery_level", "alarmed", "bypass", "device_class", "zone_number", "aux")


def _visible_panels(conn: sqlite3.Connection, scope: _Scope) -> list[dict[str, Any]]:
    """The panels the caller may view. Security review M4: a zone listed on several panels (an unassigned zone of a
    multi-partition system) shows its state only to a caller who may view EVERY one of them; otherwise it stays in
    the list by name only (redacted) and leaves the ready-to-arm summary, which is recomputed."""
    disc = svc.discover(conn)
    out = [p for p in disc["panels"] if scope.allowed(VIEW, p["entity_id"])]
    for p in out:
        changed = False
        for z in p["zones"]:
            if not all(scope.allowed(VIEW, pid) for pid in z.get("panels", [p["entity_id"]])):
                for k in REDACTED_KEYS:
                    z[k] = None
                # re-review L-c: the state is unknown to this caller - never "closed" / "not bypassed"
                z.update(state="unknown", open=None, fault=None, bypassed=None, available=None, kind="zone", redacted=True)
                changed = True
        if changed:
            p["ready"] = svc.readiness([z for z in p["zones"] if not z.get("redacted")])
    return out


# ---------------------------------------------------------------- reads

@router.get("/alarm/panels")
def panels(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    scope = _Scope(conn, principal)
    if not scope.any_view():
        require(conn, principal, VIEW, INSTALLATION)
    cfg = _settings(conn)
    pol = codes.policy(conn, principal.user_id)
    stored = codes.stored_panel_codes(conn)
    remote = principal.source == "remote"
    out = []
    for p in _visible_panels(conn, scope):
        eid = p["entity_id"]
        can = {
            "arm": scope.allowed(ARM, eid) and _remote_block(principal, cfg, "arm") is None,
            "disarm": scope.allowed(DISARM, eid) and _remote_block(principal, cfg, "disarm") is None,
            "bypass": scope.allowed(BYPASS, eid) and _remote_block(principal, cfg, "bypass_on") is None,
            "restore": scope.allowed(BYPASS, eid) and _remote_block(principal, cfg, "bypass_off") is None,
        }
        p["can"] = can
        p["panel_code_set"] = eid in stored
        p["code"] = {k: codes.code_plan(action=k, panel=p, user_policy=pol, mode=cfg["code_mode"], stored=eid in stored, remote=remote, remote_codeless=cfg["remote_codeless"])["prompt"]
                     for k in ("arm", "disarm", "bypass")}
        out.append(p)
    return {
        "panels": out,
        "counts": svc.summary_counts(out),
        "channel": "remote" if remote else "local",
        "remote": {"control": cfg["remote_control"], "disarm": cfg["remote_disarm"], "codeless": cfg["remote_codeless"]},
        "code_mode": cfg["code_mode"],
        "me": {"arm_policy": pol["arm_policy"], "disarm_policy": pol["disarm_policy"], "pin_set": pol["pin_set"]},
        "can_configure": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
        "sync": ha_sync.STATE.as_dict(),
    }


# ---------------------------------------------------------------- body handling (JSON only, the code kept apart)

def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _parse(request: Request, raw: bytes, model: type[BaseModel], secret_fields: tuple[str, ...] = ()) -> tuple[BaseModel, dict[str, Any]]:
    """(validated body, {secret field: value}). Secret fields (a code, a PIN) are taken out BEFORE validation, so no
    validation error can ever quote them; they are type-checked by the caller without echoing them."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict):
        raise ApiError(422, "validation", "גוף הבקשה חייב להיות אובייקט JSON.", details={"fields": ["body"]})
    secrets_ = {k: data.pop(k) for k in secret_fields if k in data}
    try:
        body = model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None
    return body, secrets_


def _envelope(client_request_id: str, expires_at: str) -> None:
    try:
        expires = parse_utc(expires_at)
    except ValueError:
        raise ApiError(422, "validation", "expires_at חייב להיות UTC (Z).") from None
    now = dt.datetime.now(dt.timezone.utc)
    if expires < now:
        raise ApiError(409, "expired", "הבקשה פגה; נסו שוב.")
    if expires > now + dt.timedelta(minutes=5):
        raise ApiError(422, "validation", "expires_at רחוק מדי (עד 5 דקות).")


class ActionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["arm_home", "arm_away", "arm_night", "arm_vacation", "arm_custom_bypass", "disarm"]
    confirmed: bool = False
    client_request_id: str = Field(min_length=1, max_length=80)
    expires_at: str = Field(min_length=1, max_length=40)


class BypassBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bypassed: bool
    confirmed: bool = False
    client_request_id: str = Field(min_length=1, max_length=80)
    expires_at: str = Field(min_length=1, max_length=40)


def _control_holder(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """The permission before the body: a caller holding neither alarm.arm nor alarm.disarm anywhere gets the audited
    403 before anything they sent is read."""
    held = set(permissions_anywhere(conn, principal))
    if not held & {ARM, DISARM}:
        require(conn, principal, ARM, INSTALLATION)
    return principal


def _bypass_holder(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    if BYPASS not in set(permissions_anywhere(conn, principal)):
        require(conn, principal, BYPASS, INSTALLATION)
    return principal


class _Act:
    """One alarm action's refusals and audit rows (never a code in `details`)."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, action: str, resource_type: str, resource_id: str) -> None:
        self.request, self.conn, self.principal = request, conn, principal
        self.action, self.resource_type, self.resource_id = action, resource_type, resource_id
        self.details: dict[str, Any] = {"channel": "remote" if principal.source == "remote" else "local"}

    def audit(self, decision: str, reason: str | None = None, **extra: Any) -> None:
        audit(self.conn, actor=self.principal, action=self.action, decision=decision, resource_type=self.resource_type, resource_id=self.resource_id,
              reason=reason, request_id=getattr(self.request.state, "correlation_id", None), details={**self.details, **extra})

    def refuse(self, exc: ApiError) -> ApiError:
        self.audit("denied", exc.code, status=exc.status)
        return exc


# Typed pass-through codes (no stored panel code) whose outcome is not known yet: token -> {keys, sent (monotonic),
# ts (the provisional failure's wall-clock stamp), aid (the ha_actions id once sent), target (the expected state)}.
# Security review M2 / M-A: every typed attempt counts as a FAILURE when it is sent (provisionally) and is forgiven only
# when the panel confirms it - a panel such as Risco ignores a wrong code silently - and at most ONE typed attempt per
# user and per panel may be unsettled at a time (429 attempt_pending), so concurrent requests cannot outrun the count.
_PASS_THROUGH: dict[str, dict[str, Any]] = {}
_PASS_THROUGH_LOCK = threading.Lock()


def _reserve_pass_through(keys: list[str]) -> str | None:
    """Reserve the one unsettled typed attempt for these keys; None when one is already pending."""
    with _PASS_THROUGH_LOCK:
        if any(set(e["keys"]) & set(keys) for e in _PASS_THROUGH.values()):
            return None
        token = uuid.uuid4().hex
        _PASS_THROUGH[token] = {"keys": keys, "sent": time.monotonic(), "ts": None, "aid": None, "target": None}
        return token


def _release_pass_through(token: str) -> None:
    with _PASS_THROUGH_LOCK:
        _PASS_THROUGH.pop(token, None)


def _settle_pass_through(conn: sqlite3.Connection) -> None:
    """Settle every typed attempt whose outcome is known: confirmed -> the provisional failure is forgiven; the panel
    already in the target state and no code refusal -> forgiven too (nothing was guessed); unknown / refused -> it
    stays counted (review L-c: an attempt with nothing to change is not a failure)."""
    with _PASS_THROUGH_LOCK:
        items = [(tok, dict(e)) for tok, e in _PASS_THROUGH.items() if e["aid"]]
    for tok, e in items:
        row = conn.execute("SELECT * FROM ha_actions WHERE id = ?", (e["aid"],)).fetchone()
        if row is None:
            _release_pass_through(tok)
            continue
        a = ha_actions.as_dict(row)
        if a["status"] == "pending":  # confirmed as soon as the panel reports it; "unknown" after the window
            ha_actions.refresh(conn, a)
            a = ha_actions.action_row(conn, e["aid"])
        if a["status"] == "pending":
            continue
        _release_pass_through(tok)
        forgive = a["status"] == "confirmed"
        if not forgive and a.get("error") != "invalid_code" and a["status"] != "failed":
            cur = conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (a["entity_id"],)).fetchone()
            forgive = bool(cur and e["target"] and cur["state"] == e["target"] and a.get("observed_state") == e["target"])
        if a["status"] == "failed" and a.get("error") not in ("invalid_code", None):
            forgive = True  # the bridge failed for another reason: not a wrong code
        if forgive and e["ts"] is not None:
            codes.LOCKOUT.forgive(e["keys"], e["ts"], conn)

def _code_gate(act: _Act, plan: dict[str, str], typed: Any, panel: dict[str, Any], stored_code: str | None, *, disarm: bool) -> tuple[str | None, list[str]]:
    """Checks the code the user typed against the plan. Returns (the code to SEND to the panel - None = none, the lockout
    keys of a typed pass-through code). Raises the refusals: code needed, wrong code, locked out. `typed` is never quoted.

    Lockout keys (security review M2): a personal PIN counts against its USER only - otherwise an arm-only user could
    lock disarming for everyone with five wrong PINs; the panel's own code (panel_code mode) and a typed pass-through
    code count against the user AND the panel. Only failures count."""
    uid = act.principal.user_id
    prompt = plan["prompt"]
    keys = [f"user:{uid}"] + ([f"panel:{panel['entity_id']}"] if prompt == "panel" else [])
    if prompt == "unverifiable":
        raise act.refuse(ApiError(409, "code_unverifiable", "לא הוגדר קוד לוח לאימות. מנהל המערכת מגדיר אותו בהגדרות › מערכת › אזעקה.", details={"prompt": prompt}))
    if prompt == "pin_missing":
        raise act.refuse(ApiError(409, "pin_not_set", "עדיין אין לך קוד אישי לאזעקה. פנה למנהל המערכת לקבלת קוד אישי.", details={"prompt": prompt}))
    if prompt in ("pin", "panel"):
        if plan["send"] == "typed":
            _settle_pass_through(act.conn)
        locked = codes.LOCKOUT.locked_for(keys, act.conn)
        if locked > 0:
            raise act.refuse(ApiError(429, "code_locked", "יותר מדי ניסיונות קוד שגויים. נסו שוב מאוחר יותר.", retryable=True, details={"retry_after_s": int(locked) + 1}))
        if typed is None or typed == "":
            raise act.refuse(ApiError(409, "code_required", "נדרש קוד.", details={"prompt": prompt}))
        if not isinstance(typed, str) or len(typed) > svc.CODE_MAX:
            raise act.refuse(ApiError(422, "wrong_code", "קוד שגוי."))
    if prompt == "pin" or (prompt == "panel" and plan["send"] != "typed"):
        ok = codes.verify_pin(typed, codes.pin_hash_of(act.conn, uid)) if prompt == "pin" else codes.same_code(typed, stored_code)
        if not ok:
            locked = codes.LOCKOUT.fail(keys, act.conn)
            act.audit("denied", "wrong_code", locked_s=int(locked))
            raise ApiError(403, "wrong_code", "קוד שגוי.", details={"locked_s": int(locked)} if locked else {})
        codes.LOCKOUT.succeed(keys[0])
    if plan["send"] == "typed":
        if not svc.valid_code(typed, panel.get("code_format")):
            raise act.refuse(ApiError(422, "wrong_code", "קוד שגוי."))
        return typed, keys
    return (stored_code if plan["send"] == "stored" else None), keys

def _send(act: _Act, request: Request, entity_id: str, action_id: str, args: dict[str, Any], send_code: str | None, client_request_id: str, attributes: dict[str, Any] | None) -> dict[str, Any]:
    """The device-action path: allow-list, ha_actions record (never the code), signed bridge call, honest status."""
    conn, principal = act.conn, act.principal
    settings = settings_of(request)
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise act.refuse(ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן."))
    spec, data = ha_bridge.validate_action(action_id, entity_id, args)
    secret = ha_bridge.signing_key(conn)
    paired = bool(secret) and bool(get_setting(conn, "bridge.paired_at"))
    aid, now = uuid.uuid4().hex[:12], now_iso()
    cleaned = {k: v for k, v in data.items() if k != "entity_id"}
    conn.execute(
        "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (aid, entity_id, action_id, json.dumps(cleaned, ensure_ascii=False), principal.user_id, principal.username, client_request_id, "pending", now, ha_bridge.expectation_for(spec, attributes), "bridge"),
    )
    act.details["id"] = aid
    if not paired:
        conn.execute("UPDATE ha_actions SET status = 'failed', error = 'bridge_not_paired', responded_at = ? WHERE id = ?", (now_iso(), aid))
        raise act.refuse(ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את גשר SMPLWISE מותקן ומצומד.", details={"action_id": aid}))
    service_data = dict(data)
    if send_code:
        service_data["code"] = send_code  # the service call's data only - signed, sent, never stored
    payload = ha_bridge.sign(secret or "", {"user_id": principal.user_id, "domain": spec["domain"], "service": spec["service"], "data": service_data, "request_id": aid})
    try:
        with unlocked(conn):
            result = ha_client.call_bridge_execute(settings, payload)
    except ApiError as exc:
        conn.execute("UPDATE ha_actions SET status = 'failed', error = ?, responded_at = ? WHERE id = ?", (exc.code, now_iso(), aid))
        act.audit("allowed", exc.code, status="failed")
        # the bridge's own text never travels on (it could in principle quote the request): its code and a fixed message
        raise ApiError(exc.status, exc.code, svc.scrub(exc.user_message, send_code), retryable=exc.retryable, details={"action_id": aid}) from None
    finally:
        payload = service_data = None  # noqa: F841 - drop the code-bearing objects as early as possible
    status, error = ha_actions.bridge_status(result if isinstance(result, dict) else {})
    if error and error not in CODE_REFUSALS and not error.replace("_", "").isalnum():
        error = "bridge_error"
    conn.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ? WHERE id = ?", (status, error, now_iso(), aid))
    act.audit("allowed" if status == "pending" else "denied", error, status=status)
    out = ha_actions.action_row(conn, aid)
    out["note"] = "הבקשה התקבלה; המצב מאושר רק כשמגיע עדכון." if status == "pending" else None
    return out


@router.post("/alarm/panels/{entity_id}/actions", status_code=202)
def panel_action(entity_id: str, request: Request, principal: Principal = Depends(_control_holder), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    body, secret = _parse(request, raw, ActionBody, ("code",))
    typed = secret.get("code")
    disarm = body.action == "disarm"
    perm = DISARM if disarm else ARM
    act = _Act(request, conn, principal, perm, "alarm_panel", entity_id)
    act.details.update(action=body.action, client_request_id=body.client_request_id)
    scope = _Scope(conn, principal)
    panel = next((p for p in _visible_panels(conn, scope) if p["entity_id"] == entity_id), None)
    if panel is None:
        raise act.refuse(ApiError(404, "not_found", "לוח האזעקה לא נמצא."))
    if not scope.allowed(perm, entity_id):
        require(conn, principal, perm, INSTALLATION)  # the audited 403
    note_grant(scope.decision(perm, entity_id), perm)
    cfg = _settings(conn)
    blocked = _remote_block(principal, cfg, "disarm" if disarm else "arm")
    if blocked:
        raise act.refuse(ApiError(403, blocked, REMOTE_MESSAGES[blocked]))
    if not disarm and body.action not in panel["arm_modes"]:
        raise act.refuse(ApiError(422, "mode_not_supported", "הלוח אינו תומך במצב הדריכה הזה.", details={"modes": panel["arm_modes"]}))
    if not panel["available"]:
        raise act.refuse(ApiError(409, "panel_unavailable", "לוח האזעקה אינו זמין כרגע."))
    try:
        _envelope(body.client_request_id, body.expires_at)
    except ApiError as exc:
        raise act.refuse(exc) from None
    existing = conn.execute("SELECT id FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (principal.user_id, body.client_request_id)).fetchone()
    if existing:
        return ha_actions.action_row(conn, existing["id"])  # a repeated click never sends twice
    if disarm and body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "נטרול דורש אישור מפורש."))
    stored = codes.stored_panel_codes(conn)
    pol = codes.policy(conn, principal.user_id)
    plan = codes.code_plan(action="disarm" if disarm else "arm", panel=panel, user_policy=pol, mode=cfg["code_mode"], stored=entity_id in stored,
                           remote=principal.source == "remote", remote_codeless=cfg["remote_codeless"])
    act.details["code"] = plan["prompt"]  # which kind of code was asked for (none / pin / panel) - never the code
    stored_code = None
    if entity_id in stored and (plan["send"] == "stored" or plan["prompt"] == "panel"):
        try:
            stored_code = codes.panel_code(conn, settings_of(request), entity_id)
        except codes.CodeError:
            raise act.refuse(ApiError(503, "code_unreadable", "קוד הלוח השמור אינו קריא. מנהל המערכת יגדיר אותו מחדש בהגדרות › מערכת › אזעקה.")) from None
    send_code, keys = _code_gate(act, plan, typed, panel, stored_code, disarm=disarm)
    typed = stored_code = None  # noqa: F841
    token = None
    if plan["send"] == "typed":
        # review M-A: one unsettled typed attempt per user and per panel, counted as a failure until the panel confirms
        token = _reserve_pass_through(keys)
        if token is None:
            raise act.refuse(ApiError(429, "attempt_pending", "הפקודה הקודמת עדיין ממתינה לאישור הלוח. נסו שוב בעוד רגע.", retryable=True, details={"retry_after_s": int(ha_actions.CONFIRM_WINDOW_S) + 1}))
        ts = time.time()
        codes.LOCKOUT.fail(keys, conn, now=ts)
        with _PASS_THROUGH_LOCK:
            _PASS_THROUGH[token].update(ts=ts, target=svc.TARGET_STATE.get(body.action))
    try:
        out = _send(act, request, entity_id, svc.ACTIONS[body.action], {}, send_code, body.client_request_id, {"state": panel["state"]})
    except ApiError as exc:
        if token:
            e = _PASS_THROUGH.get(token) or {}
            _release_pass_through(token)
            if e.get("ts") is not None and exc.code not in ("invalid_code",):
                codes.LOCKOUT.forgive(keys, e["ts"], conn)  # the bridge / platform failed: no code was judged
        raise
    if token:
        if out["status"] == "pending":
            with _PASS_THROUGH_LOCK:
                _PASS_THROUGH[token]["aid"] = out["id"]
        else:
            e = _PASS_THROUGH.get(token) or {}
            _release_pass_through(token)
            if out.get("error") != "invalid_code" and e.get("ts") is not None:
                # review L3: only the panel's real refusal of a code stays counted (not a generic ServiceValidationError)
                codes.LOCKOUT.forgive(keys, e["ts"], conn)
    if out["status"] == "failed" and out.get("error") in CODE_REFUSALS:
        raise ApiError(422, "code_rejected", "הלוח דחה את הקוד או את הפקודה.", details={"action_id": out["id"]})
    return out


@router.post("/alarm/zones/{zone_entity_id}/bypass", status_code=202)
def zone_bypass(zone_entity_id: str, request: Request, principal: Principal = Depends(_bypass_holder), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    body, secret = _parse(request, raw, BypassBody, ("code",))
    typed = secret.get("code")
    act = _Act(request, conn, principal, BYPASS, "alarm_zone", zone_entity_id)
    act.details.update(bypassed=body.bypassed, client_request_id=body.client_request_id)
    scope = _Scope(conn, principal)
    found = None
    for p in _visible_panels(conn, scope):
        z = next((z for z in p["zones"] if z["entity_id"] == zone_entity_id), None)
        if z is not None and (found is None or scope.allowed(BYPASS, p["entity_id"])):
            found = (p, z)
    if found is None:
        raise act.refuse(ApiError(404, "not_found", "החיישן לא נמצא."))
    panel, zone = found
    act.details["panel"] = panel["entity_id"]
    # security review M4: a zone listed on several panels (shared partitions) needs alarm.bypass on EVERY one of them
    for pid in zone.get("panels") or [panel["entity_id"]]:
        if not scope.allowed(BYPASS, pid):
            require(conn, principal, BYPASS, INSTALLATION)
    note_grant(scope.decision(BYPASS, panel["entity_id"]), BYPASS)
    cfg = _settings(conn)
    blocked = _remote_block(principal, cfg, "bypass_on" if body.bypassed else "bypass_off")
    if blocked:
        raise act.refuse(ApiError(403, blocked, REMOTE_MESSAGES[blocked]))
    ctl = zone.get("bypass")
    if not ctl:
        raise act.refuse(ApiError(409, "no_bypass_control", "לחיישן הזה אין מתג עקיפה."))
    act.details["control"] = ctl["entity_id"]
    if not ctl["available"]:
        raise act.refuse(ApiError(409, "control_unavailable", "מתג העקיפה אינו זמין כרגע."))
    try:
        _envelope(body.client_request_id, body.expires_at)
    except ApiError as exc:
        raise act.refuse(exc) from None
    existing = conn.execute("SELECT id FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (principal.user_id, body.client_request_id)).fetchone()
    if existing:
        return ha_actions.action_row(conn, existing["id"])
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "עקיפת חיישן דורשת אישור מפורש."))
    stored = codes.stored_panel_codes(conn)
    plan = codes.code_plan(action="bypass", panel=panel, user_policy=codes.policy(conn, principal.user_id), mode=cfg["code_mode"], stored=panel["entity_id"] in stored,
                           remote=principal.source == "remote", remote_codeless=cfg["remote_codeless"])
    act.details["code"] = plan["prompt"]
    stored_code = None
    if plan["prompt"] == "panel" and panel["entity_id"] in stored:
        try:
            stored_code = codes.panel_code(conn, settings_of(request), panel["entity_id"])
        except codes.CodeError:
            raise act.refuse(ApiError(503, "code_unreadable", "קוד הלוח השמור אינו קריא. מנהל המערכת יגדיר אותו מחדש בהגדרות › מערכת › אזעקה.")) from None
    _code_gate(act, plan, typed, panel, stored_code, disarm=False)  # bypass sends no code; the gate only verifies
    typed = stored_code = None  # noqa: F841
    if ctl["domain"] == "switch":
        action_id, args = ("switch.turn_on" if body.bypassed else "switch.turn_off"), {}
    else:
        option = ctl["on_option"] if body.bypassed else ctl["off_option"]
        if not option:
            raise act.refuse(ApiError(409, "no_bypass_option", "למתג העקיפה אין אפשרות מתאימה."))
        action_id, args = "select.select_option", {"option": option}
    row = conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (ctl["entity_id"],)).fetchone()
    attrs = json.loads(row["attributes_json"] or "{}") if row else {}
    return _send(act, request, ctl["entity_id"], action_id, args, None, body.client_request_id, attrs)


# ---------------------------------------------------------------- the caller's own code settings

class PinBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


@router.get("/alarm/me")
def me(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    pol = codes.policy(conn, principal.user_id)
    cfg = _settings(conn)
    return {"arm_policy": pol["arm_policy"], "disarm_policy": pol["disarm_policy"], "pin_set": pol["pin_set"], "pin_set_at": pol["pin_set_at"], "code_mode": cfg["code_mode"]}


def _alarm_actor(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """A caller who may use a code at all: alarm.arm, alarm.disarm or alarm.bypass anywhere (review L7)."""
    if not set(permissions_anywhere(conn, principal)) & {ARM, DISARM, BYPASS}:
        require(conn, principal, ARM, INSTALLATION)
    return principal


def _check_pin_shape(act: "_Act", pin: Any, conn: sqlite3.Connection) -> None:
    lo = _settings(conn)["pin_min_length"]
    if not codes.valid_pin(pin, lo):
        raise act.refuse(ApiError(422, "invalid_pin", f"קוד אישי: {lo}–{codes.PIN_MAX} ספרות."))


def _verify_current_pin(act: "_Act", conn: sqlite3.Connection, user_id: str, current: Any) -> None:
    """The caller's current PIN (a borrowed unlocked session cannot replace it); failures count toward the lockout."""
    key = [f"user:{user_id}"]
    locked = codes.LOCKOUT.locked_for(key, conn)
    if locked > 0:
        raise act.refuse(ApiError(429, "code_locked", "יותר מדי ניסיונות קוד שגויים. נסו שוב מאוחר יותר.", retryable=True, details={"retry_after_s": int(locked) + 1}))
    if not isinstance(current, str) or not codes.verify_pin(current, codes.pin_hash_of(conn, user_id)):
        codes.LOCKOUT.fail(key, conn)
        raise act.refuse(ApiError(403, "wrong_code", "הקוד הנוכחי שגוי."))
    codes.LOCKOUT.succeed(key[0])


@router.put("/alarm/me/pin")
def set_my_pin(request: Request, principal: Principal = Depends(_alarm_actor), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Change the caller's own PIN. Security review M3: changing an existing PIN needs the current one; the FIRST PIN is
    set by an administrator (משתמשים והרשאות) - or here, by a user who types the stored code of a panel they may see
    correctly (constant-time; failures count toward the lockout of the user and that panel). Audited without values."""
    _, secret = _parse(request, raw, PinBody, ("pin", "current_pin", "panel_code"))
    act = _Act(request, conn, principal, "alarm.pin", "user", principal.user_id)
    pin = secret.get("pin")
    _check_pin_shape(act, pin, conn)
    if codes.pin_hash_of(conn, principal.user_id):
        _verify_current_pin(act, conn, principal.user_id, secret.get("current_pin"))
        how = "changed"
    else:
        typed = secret.get("panel_code")
        scope = _Scope(conn, principal)
        # re-review L-a: only a panel the caller may DISARM (an arm-only user must not test panel-code guesses), and the
        # guess counts against the user AND those panels
        stored = [p for p in codes.stored_panel_codes(conn) if scope.allowed(DISARM, p)]
        if not stored:
            raise act.refuse(ApiError(409, "pin_by_admin", "פנה למנהל המערכת לקבלת קוד אישי."))
        keys = [f"user:{principal.user_id}"] + [f"panel:{p}" for p in stored]
        locked = codes.LOCKOUT.locked_for(keys, conn)
        if locked > 0:
            raise act.refuse(ApiError(429, "code_locked", "יותר מדי ניסיונות קוד שגויים. נסו שוב מאוחר יותר.", retryable=True, details={"retry_after_s": int(locked) + 1}))
        match = None
        if isinstance(typed, str) and typed:
            for p in stored:
                try:
                    if codes.same_code(typed, codes.panel_code(conn, settings_of(request), p)):
                        match = p
                except codes.CodeError:
                    continue
        if match is None:
            codes.LOCKOUT.fail(keys, conn)
            raise act.refuse(ApiError(403, "wrong_code", "קוד הלוח שגוי. אפשר גם לפנות למנהל המערכת לקבלת קוד אישי."))
        codes.LOCKOUT.succeed(keys[0])
        how = "first_by_panel_code"
    pol = codes.set_pin(conn, principal.user_id, pin, principal.username)
    act.audit("allowed", None, pin=how)
    return {"pin_set": pol["pin_set"], "pin_set_at": pol["pin_set_at"]}

# ---------------------------------------------------------------- administration (system.configure)

def _configurer(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, "system.configure", INSTALLATION)
    return principal


@router.get("/alarm/config")
def config(request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    ents = svc.load(conn)
    ovr = svc.overrides(conn)
    disc = svc.discover(conn, ents, ovr)
    for p in disc["panels"]:
        p["panel_code"] = {**codes.panel_code_info(conn, p["entity_id"]), "readable": codes.panel_code_readable(conn, settings_of(request), p["entity_id"])}
    platforms = {p["platform"] for p in disc["panels"] if p.get("platform")}

    def _brief(e: dict[str, Any]) -> dict[str, Any]:
        return {"entity_id": e["entity_id"], "name": e.get("name") or e.get("original_name") or (e.get("attributes") or {}).get("friendly_name") or e["entity_id"], "platform": e.get("platform"), "domain": e["domain"]}

    return {
        **disc,
        "overrides": list(ovr.values()),
        "candidates": {
            "controls": [_brief(e) for e in ents if e["domain"] in ("switch", "select") and (svc.is_bypass_control(e) or e.get("platform") in platforms)][:1000],
            "sensors": [_brief(e) for e in ents if e["domain"] == "binary_sensor"][:2000],
        },
        "integrations": {k: {"label": v.label, "note": v.note, "verified": v.verified} for k, v in svc.INTEGRATIONS.items()},
        "settings": _settings(conn),
    }


class OverrideBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    panel_entity_id: str | None = Field(default=None, max_length=255)
    bypass_entity_id: str | None = Field(default=None, max_length=255)
    excluded: bool = False
    # review L4: pairing a control that carries no bypass marker needs this explicit confirmation
    confirm_not_bypass_like: bool = False


@router.put("/alarm/overrides/{zone_entity_id}")
def put_override(zone_entity_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    body, _ = _parse(request, raw, OverrideBody)
    act = _Act(request, conn, principal, "alarm.mapping", "alarm_zone", zone_entity_id)
    zone = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (zone_entity_id,)).fetchone()
    if not zone or zone["domain"] != "binary_sensor":
        raise act.refuse(ApiError(404, "not_found", "החיישן לא נמצא (נדרש binary_sensor)."))
    if body.panel_entity_id:
        r = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (body.panel_entity_id,)).fetchone()
        if not r or r["domain"] != "alarm_control_panel":
            raise act.refuse(ApiError(422, "validation", "הלוח לא נמצא.", details={"fields": ["panel_entity_id"]}))
    if body.bypass_entity_id:
        r = conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (body.bypass_entity_id,)).fetchone()
        ok = bool(r) and r["domain"] in ("switch", "select")
        if ok and r["domain"] == "select":
            ok = svc.select_options(ha_sync.entity_row(r))[0] is not None
        if not ok:
            raise act.refuse(ApiError(422, "validation", "מתג העקיפה חייב להיות switch או select עם אפשרות עקיפה.", details={"fields": ["bypass_entity_id"]}))
        if not svc.is_bypass_control(ha_sync.entity_row(r)) and not body.confirm_not_bypass_like:
            # review L4: a plain switch (a light, a door release) taken for a bypass control would be operated from the
            # alarm screen and withdrawn from every other screen - only on an explicit confirmation
            raise act.refuse(ApiError(409, "not_bypass_like", "למתג הזה אין סימן עקיפה (bypass). לשייך אותו בכל זאת כמתג העקיפה של החיישן?", details={"entity_id": body.bypass_entity_id}))
    conn.execute(
        "INSERT INTO alarm_zone_overrides(zone_entity_id, panel_entity_id, bypass_entity_id, excluded, updated_at, updated_by) VALUES (?,?,?,?,?,?) "
        "ON CONFLICT(zone_entity_id) DO UPDATE SET panel_entity_id = excluded.panel_entity_id, bypass_entity_id = excluded.bypass_entity_id, excluded = excluded.excluded, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
        (zone_entity_id, body.panel_entity_id or None, body.bypass_entity_id, 1 if body.excluded else 0, now_iso(), principal.username),
    )
    act.audit("allowed", None, panel_entity_id=body.panel_entity_id, bypass_entity_id=body.bypass_entity_id, excluded=body.excluded, confirm_not_bypass_like=body.confirm_not_bypass_like)
    return dict(conn.execute("SELECT * FROM alarm_zone_overrides WHERE zone_entity_id = ?", (zone_entity_id,)).fetchone())


@router.delete("/alarm/overrides/{zone_entity_id}")
def delete_override(zone_entity_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    n = conn.execute("DELETE FROM alarm_zone_overrides WHERE zone_entity_id = ?", (zone_entity_id,)).rowcount
    _Act(request, conn, principal, "alarm.mapping", "alarm_zone", zone_entity_id).audit("allowed", None, reset=True)
    return {"removed": n}


class EmptyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


@router.put("/alarm/panels/{entity_id}/code")
def put_panel_code(entity_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Store the panel's own code (write-only, encrypted). The reply says only that it is set."""
    _, secret = _parse(request, raw, EmptyBody, ("code",))
    act = _Act(request, conn, principal, "alarm.panel_code", "alarm_panel", entity_id)
    r = conn.execute("SELECT domain, attributes_json FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if not r or r["domain"] != "alarm_control_panel":
        raise act.refuse(ApiError(404, "not_found", "לוח האזעקה לא נמצא."))
    fmt = (json.loads(r["attributes_json"] or "{}") or {}).get("code_format")
    code = secret.get("code")
    if not svc.valid_code(code, fmt if fmt in ("number", "text") else None):
        raise act.refuse(ApiError(422, "invalid_code_format", "הקוד אינו בפורמט שהלוח מקבל." + (" (ספרות בלבד)" if fmt == "number" else "")))
    try:
        info = codes.set_panel_code(conn, settings_of(request), entity_id, code, principal.username)
    except (codes.CodeError, OSError):  # review L1: a damaged / unwritable key file - said plainly, never the code
        raise act.refuse(ApiError(503, "code_key_unavailable", "קובץ המפתח של קודי האזעקה פגום או שאי אפשר לכתוב אותו (keys/alarm-codes.key בתיקיית הנתונים). הקוד לא נשמר.")) from None
    code = None  # noqa: F841
    act.audit("allowed", None, panel_code="set")
    return {"panel_code": info}


@router.delete("/alarm/panels/{entity_id}/code")
def delete_panel_code(entity_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    removed = codes.clear_panel_code(conn, entity_id)
    _Act(request, conn, principal, "alarm.panel_code", "alarm_panel", entity_id).audit("allowed", None, panel_code="cleared" if removed else "absent")
    return {"panel_code": codes.panel_code_info(conn, entity_id)}


def _sole_configurer(conn: sqlite3.Connection, principal: Principal) -> bool:
    """No other active user holds system.configure (at installation scope)."""
    for r in conn.execute("SELECT id, username FROM users WHERE active = 1 AND id != ?", (principal.user_id,)).fetchall():
        other = Principal(user_id=r["id"], username=r["username"] or "", display_name="", source="dev")
        if authorize(conn, other, "system.configure", INSTALLATION).allowed:
            return False
    return True


def _own_change(act: "_Act", conn: sqlite3.Connection, current: Any) -> None:
    """Security review M3: an administrator changes their OWN alarm policy or PIN only with their current PIN - without
    one, another administrator does it (a borrowed admin session must not make itself code-less)."""
    if not codes.pin_hash_of(conn, act.principal.user_id):
        if _sole_configurer(conn, act.principal):
            # re-review L-b: nobody else could ever do it - the only administrator sets their own, audited as bootstrap
            act.action = "alarm.pin.bootstrap"
            act.audit("allowed", "sole_administrator")
            act.action = "alarm.pin"
            return
        raise act.refuse(ApiError(403, "own_change_by_other_admin", "את מדיניות האזעקה והקוד האישי שלך משנה מנהל מערכת אחר (או אתה, עם הקוד האישי הנוכחי)."))
    _verify_current_pin(act, conn, act.principal.user_id, current)


@router.get("/alarm/users/{user_id}")
def user_policy(user_id: str, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
        raise ApiError(404, "not_found", "המשתמש לא נמצא.")
    return {"user_id": user_id, **codes.policy(conn, user_id), "code_mode": _settings(conn)["code_mode"]}


class PolicyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    arm_policy: Literal["no_code", "code_required"] | None = None
    disarm_policy: Literal["no_code", "code_required"] | None = None


@router.put("/alarm/users/{user_id}/policy")
def put_user_policy(user_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    body, secret = _parse(request, raw, PolicyBody, ("current_pin",))
    act = _Act(request, conn, principal, "alarm.user_policy", "user", user_id)
    if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
        raise act.refuse(ApiError(404, "not_found", "המשתמש לא נמצא."))
    if user_id == principal.user_id:
        _own_change(act, conn, secret.get("current_pin"))
    pol = codes.set_policy(conn, user_id, body.arm_policy, body.disarm_policy, principal.username)
    act.audit("allowed", None, arm_policy=pol["arm_policy"], disarm_policy=pol["disarm_policy"])
    return {"user_id": user_id, **pol}


@router.put("/alarm/users/{user_id}/pin")
def put_user_pin(user_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """An administrator sets a user's PIN (e.g. for someone who never opens the screen); the user may change it later."""
    _, secret = _parse(request, raw, PinBody, ("pin", "current_pin"))
    act = _Act(request, conn, principal, "alarm.pin", "user", user_id)
    if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
        raise act.refuse(ApiError(404, "not_found", "המשתמש לא נמצא."))
    if user_id == principal.user_id:
        _own_change(act, conn, secret.get("current_pin"))
    _check_pin_shape(act, secret.get("pin"), conn)
    pol = codes.set_pin(conn, user_id, secret["pin"], principal.username)
    act.audit("allowed", None, pin="set")
    return {"user_id": user_id, **pol}


@router.delete("/alarm/users/{user_id}/pin")
def delete_user_pin(user_id: str, request: Request, principal: Principal = Depends(_configurer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    act = _Act(request, conn, principal, "alarm.pin", "user", user_id)
    if not conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():  # review L7
        raise act.refuse(ApiError(404, "not_found", "המשתמש לא נמצא."))
    if user_id == principal.user_id:
        raise act.refuse(ApiError(403, "own_pin_by_other_admin", "את הקוד האישי שלך מוחק מנהל מערכת אחר."))
    pol = codes.set_pin(conn, user_id, None, principal.username)
    _Act(request, conn, principal, "alarm.pin", "user", user_id).audit("allowed", None, pin="cleared")
    return {"user_id": user_id, **pol}
