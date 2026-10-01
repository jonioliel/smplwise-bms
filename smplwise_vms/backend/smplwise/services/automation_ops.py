"""CR-017: the write operations (docs/architecture/AUTOMATIONS_API.md §3.2, §4; CR §7-§10).

Every change reaches Home Assistant ONLY through the bridge (`smplwise_bridge.config_item`, signed with the pairing secret, executed with the caller's own
HA identity checks); never the config API's POST, never a service call from the add-on. Each operation: the permission before the body, the audited refusals,
the caller's rights over the OLD and the NEW content (services/automation_scope.py: manage + control + the SAME grants manual control needs for a sensitive
step), the content judged by the model and the policy, the explicit confirmations, a fresh read of the item and the revision check (`item_changed`), an op
row before anything is sent (idempotent per `client_request_id`), the bridge call (never retried: a call that timed out may have been applied), a fresh
re-read, the version row, the owner of record and the audit row. Locked blocks are never taken from the client: they are re-materialised from the stored item
by fingerprint. Codes are never stored; no secret-like value, template text or config appears in an answer, an error or an audit row."""
from __future__ import annotations

import copy
import json
import re
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

from ..audit import audit
from ..db import get_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, note_grant, require
from . import automation_draft as drafts
from . import automation_model as model
from . import automation_policy as pol
from . import automation_scope as scope
from . import automation_text as text
from . import automation_transport as tr
from . import automation_view as view
from . import automations as store
from . import ha_bridge, ha_sync

_RATE: dict[tuple[str, str], list[float]] = {}
_LAST: dict[str, float] = {}
_RATE_LOCK = threading.Lock()
MISMATCH = ApiError(409, "idempotency_conflict", "מפתח הבקשה כבר שימש לפעולה אחרת; שלחו בקשה עם מפתח חדש.")
DEPTH_ROUNDS = 3

PROMOTED = {"code_not_allowed": (422, "אסור לשמור קוד סודי בתוך אוטומציה, סצנה או סקריפט."), "action_not_allowed": (422, "הפעולה אינה מותרת כאן."),
            "locked_block_changed": (403, "חלק נעול שונה. אפשר לשנות אותו רק בתצוגת הקוד."),
            "masked_values": (422, "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.")}
BRIDGE_UNAVAILABLE = {
    "feature_disabled": ApiError(409, "feature_disabled", "האוטומציות כבויות בהגדרות המערכת."),
    "ha_unavailable": ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True),
    "config_api_unavailable": ApiError(503, "config_api_unavailable", "עריכת אוטומציות אינה זמינה כרגע."),
    "bridge_missing": ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את גשר SMPLWISE מותקן ומצומד."),
    "bridge_unpaired": ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את גשר SMPLWISE מותקן ומצומד."),
    "bridge_too_old": ApiError(503, "bridge_too_old", "נדרש עדכון של רכיב החיבור כדי לשמור אוטומציות."),
    "authoring_blocked": ApiError(503, "config_api_unavailable", "עריכת אוטומציות אינה זמינה כרגע."),
    "delegation_off": ApiError(403, "delegation_off", "שמירה עבור משתמש זה אינה מופעלת. פנו למנהל המערכת."),
}
# the bridge's refusal codes -> the contract's errors (§3.3)
BRIDGE_ERRORS = {
    "stale": lambda d: ApiError(409, "item_changed", "הפריט שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור."),
    "exists": lambda d: ApiError(409, "item_changed", "הפריט שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור."),
    "not_found": lambda d: ApiError(422, "not_editable", "פריט זה מוגדר בקובץ תצורה או במכשיר ואינו ניתן לעריכה כאן."),
    "delegation_off": lambda d: BRIDGE_UNAVAILABLE["delegation_off"],
    "not_ha_admin": lambda d: ApiError(403, "not_ha_admin", "שמירת תוכן זה דורשת מנהל של תשתית המערכת."),
    "ha_invalid": lambda d: ApiError(422, "ha_validation", f"תשתית המערכת דחתה את ההגדרה{(': ' + d['path']) if d.get('path') else ''}.", details={"path": d.get("path")}),
    "code_not_allowed": lambda d: ApiError(422, "code_not_allowed", "אסור לשמור קוד סודי בתוך אוטומציה, סצנה או סקריפט.", details={"path": d.get("path")}),
    "secret_not_allowed": lambda d: ApiError(422, "masked_values", "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.", details={"path": d.get("path")}),
    "service_not_allowed": lambda d: ApiError(422, "action_not_allowed", "הפעולה אינה מותרת כאן.", details={"path": d.get("path")}),
    "argument_not_allowed": lambda d: ApiError(422, "action_not_allowed", "הפעולה אינה מותרת כאן.", details={"path": d.get("path")}),
    "preserved_mismatch": lambda d: ApiError(403, "locked_block_changed", "חלק נעול שונה. אפשר לשנות אותו רק בתצוגת הקוד.", details={"path": d.get("path")}),
    "legacy_schema": lambda d: ApiError(422, "validation", "ערך לא תקין — התוכן משתמש במפתחות ישנים; השתמשו בתצוגת הקוד כפי שהוצגה.", details={"path": d.get("path")}),
    "invalid_payload": lambda d: ApiError(422, "validation", "ערך לא תקין — התוכן אינו עומד בכללי השמירה.", details={"path": d.get("path")}),
    "unauthorized": lambda d: ApiError(403, "entity_not_controllable", "אין לך הרשאת שליטה בהתקן; תשתית המערכת דחתה את הפעולה."),
}


def reset_limits() -> None:
    with _RATE_LOCK:
        _RATE.clear()
        _LAST.clear()


def rate_limit(user_id: str, kind: str, limit: int) -> None:
    now = time.monotonic()
    with _RATE_LOCK:
        hits = [t for t in _RATE.get((user_id, kind), []) if now - t < 60.0]
        if len(hits) >= limit:
            _RATE[(user_id, kind)] = hits
            raise ApiError(429, "rate_limited", "יותר מדי שינויים ברצף; נסו שוב בעוד רגע.", retryable=True)
        hits.append(now)
        _RATE[(user_id, kind)] = hits


def gap_check(key: str, seconds: float, code: str = "run_too_soon") -> None:
    """One run per item per `seconds` installation-wide (429); the slot is claimed here and given back by `gap_release` when the call fails."""
    if seconds <= 0:
        return
    with _RATE_LOCK:
        last = _LAST.get(key)
        now = time.monotonic()
        if last is not None and now - last < seconds:
            raise ApiError(429, code, "הפריט הורץ ממש עכשיו; נסו שוב בעוד כמה שניות.", retryable=True)
        _LAST[key] = now


def gap_release(key: str) -> None:
    with _RATE_LOCK:
        _LAST.pop(key, None)


# ================================================================ the writer

class W:
    """One request: the caller, the connection, the context (rights, entities), the audit trail."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, settings: Any, request_id: str | None = None) -> None:
        self.conn, self.principal, self.settings, self.request_id = conn, principal, settings, request_id
        self.ctx = scope.Ctx(conn, principal)
        self.details: dict[str, Any] = {}

    # -- audit

    def audit(self, action: str, decision: str, kind: str | None, item_id: str | None, reason: str | None = None, **extra: Any) -> None:
        det = {**self.details, **extra, "delegated": bool(not self.ctx.ha_admin)}
        if kind:
            det["kind"] = kind
        if decision == "allowed":
            self._note_grants(kind)
        audit(self.conn, actor=self.principal, action=action, decision=decision, resource_type="automation_item", resource_id=f"{kind}:{item_id}" if kind and item_id else item_id, reason=reason,
              request_id=self.request_id, details=det)

    def _note_grants(self, kind: str | None) -> None:
        if kind:
            note_grant(authorize(self.conn, self.principal, scope.MANAGE_OF[kind], INSTALLATION), scope.MANAGE_OF[kind])

    @contextmanager
    def audited(self, action: str, kind: str | None = None, item_id: str | None = None) -> Iterator[None]:
        """Every refusal inside is an audited `denied` row with the ApiError code (never a value)."""
        try:
            yield
        except ApiError as exc:
            self.audit(action, "denied", kind, item_id, exc.code, status=exc.status)
            raise

    # -- gates

    def require_manage(self, kind: str) -> None:
        perm = scope.MANAGE_OF[kind]
        if not self.ctx.access.anywhere(perm):
            require(self.conn, self.principal, perm, INSTALLATION)

    def require_view(self, kind: str) -> None:
        if not scope.holds_any(self.ctx, kind):
            require(self.conn, self.principal, scope.VIEW, INSTALLATION)

    def feature_on(self) -> None:
        if self.ctx.cfg["automations.enabled"] != "true":
            raise BRIDGE_UNAVAILABLE["feature_disabled"]

    def writable(self) -> None:
        block = self.ctx.write_block()
        if block:
            raise BRIDGE_UNAVAILABLE[block]

    def runtime_ready(self) -> None:
        block = tr.write_block(self.conn, self.ctx.cfg)
        if block:
            raise BRIDGE_UNAVAILABLE[block]

    def rate(self) -> None:
        rate_limit(self.principal.user_id, "write", self.ctx.limits["writes_per_min"])


# ================================================================ rights -> errors

def reason_error(r: dict[str, Any]) -> ApiError:
    code = r["code"]
    if r.get("_remote"):
        return ApiError(403, r["_remote"], r["message"])
    if code == "grant_required":
        return ApiError(403, "grant_required", r["message"], details={"entity_id": r.get("entity_id"), "grant": r.get("grant"), "path": r.get("path")})
    if code == "entity_not_controllable":
        return ApiError(403, "entity_not_controllable", r["message"], details={"entity_id": r.get("entity_id")})
    return ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.", details={"entity_id": r.get("entity_id")} if r.get("entity_id") else {})


def problem_error(errors: list[dict[str, str]]) -> ApiError:
    for p in errors:
        if p["code"] in PROMOTED:
            status, msg = PROMOTED[p["code"]]
            return ApiError(status, p["code"], msg, details={"errors": errors, "path": p["path"]})
    first = errors[0]
    return ApiError(422, "validation", f"ערך לא תקין — {first['path']}: {first['message']}", details={"errors": errors})


def bridge_error(resp: dict[str, Any]) -> ApiError:
    code = str(resp.get("error") or "error")
    code = re.sub(r"[^A-Za-z0-9_.\-]", "", code)[:60] or "error"
    mapped = BRIDGE_ERRORS.get(code)
    if mapped is not None:
        err = mapped({"path": resp.get("path")})
        err.details = {**err.details, "error": code}
        return err
    return ApiError(502, "config_refused", "תשתית המערכת דחתה את השינוי.", details={"error": code, "path": resp.get("path")})


# ================================================================ the bridge

def bridge_body(w: W, op: str, op_id: str, *, kind: str | None, item_id: str | None, base_revision: str | None, profile: str | None, config: dict[str, Any] | None,
                preserved: list[str] | None, sensitive: bool, variables: dict[str, Any] | None, skip_condition: bool | None, entity_id: str | None) -> dict[str, Any]:
    """The message of one op with exactly the keys the bridge accepts for it (`config_policy.OP_KEYS`: any other key is refused as `invalid_payload`)."""
    body: dict[str, Any] = {"user_id": w.principal.user_id, "op": op, "request_id": op_id}
    if op == "apply_scene":
        body["entity_id"] = entity_id
        return body
    body["kind"], body["item_id"] = kind, item_id
    if op == "upsert":
        body.update(base_revision=base_revision, profile=profile or "builder", config=config, preserved=list(preserved or []), sensitive=bool(sensitive))
    elif op == "delete":
        body.update(base_revision=base_revision, profile=profile or "builder")
    elif op == "trigger":
        if skip_condition is not None:
            body["skip_condition"] = bool(skip_condition)
        if variables:
            body["variables"] = variables
    elif op == "run_script" and variables:
        body["variables"] = variables
    return body


def bridge_call(w: W, op: str, op_id: str, *, kind: str | None = None, item_id: str | None = None, base_revision: str | None = None, profile: str | None = None,
                config: dict[str, Any] | None = None, preserved: list[str] | None = None, sensitive: bool = False, variables: dict[str, Any] | None = None,
                skip_condition: bool | None = None, entity_id: str | None = None) -> dict[str, Any]:
    """One signed `smplwise_bridge.config_item` call, made with the request's write lock released. Never retried. A transport failure or `ok: false` settles the op
    and raises (504 `config_timeout` leaves it `unknown`)."""
    secret = ha_bridge.signing_key(w.conn)
    body = bridge_body(w, op, op_id, kind=kind, item_id=item_id, base_revision=base_revision, profile=profile, config=config, preserved=preserved, sensitive=sensitive,
                       variables=variables, skip_condition=skip_condition, entity_id=entity_id)
    signed = ha_bridge.sign(secret or "", body)
    transport = tr.get_transport()
    try:
        with unlocked(w.conn):
            resp = transport.bridge(signed)
    except ApiError as exc:
        store_finish(w.conn, op_id, "unknown" if exc.code == "config_timeout" else "failed", error=None if exc.code == "config_timeout" else exc.code)
        raise
    finally:
        signed = None  # noqa: F841
    if not isinstance(resp, dict) or not resp.get("ok"):
        err = bridge_error(resp if isinstance(resp, dict) else {"error": "bad_answer"})
        store_finish(w.conn, op_id, "failed", error=err.details.get("error") or err.code)
        raise err
    return resp


# ================================================================ ops (idempotency)

def begin_op(w: W, client_request_id: str, op: str, kind: str | None, item_id: str | None) -> tuple[str, sqlite3.Row | None]:
    prev = w.conn.execute("SELECT * FROM automation_ops WHERE principal_user_id = ? AND client_request_id = ?", (w.principal.user_id, client_request_id)).fetchone()
    if prev is not None:
        return prev["id"], prev
    op_id = "op" + uuid.uuid4().hex[:12]
    w.conn.execute("INSERT INTO automation_ops(id, principal_user_id, principal_username, client_request_id, op, kind, item_id, status, requested_at) VALUES (?,?,?,?,?,?,?, 'pending', ?)",
                   (op_id, w.principal.user_id, w.principal.username, client_request_id, op, kind, item_id, store.stamp()))
    return op_id, None


def store_finish(conn: sqlite3.Connection, op_id: str, status: str, *, error: str | None = None, item_id: str | None = None) -> None:
    conn.execute("UPDATE automation_ops SET status = ?, error = COALESCE(?, error), item_id = COALESCE(?, item_id), responded_at = ? WHERE id = ?", (status, error, item_id, store.stamp(), op_id))


def _prev(w: W, client_request_id: str) -> sqlite3.Row | None:
    return w.conn.execute("SELECT * FROM automation_ops WHERE principal_user_id = ? AND client_request_id = ?", (w.principal.user_id, client_request_id)).fetchone()


def replay(w: W, prev: sqlite3.Row, shape: str, op: str, kind: str | None, item_id: str | None = None) -> tuple[int, dict[str, Any]]:
    """A repeated client_request_id answers as the first request did - only for the SAME operation on the SAME item, and never shows more than the caller may see now."""
    if prev["op"] != op or (kind is not None and prev["kind"] != kind) or (item_id is not None and prev["item_id"] != item_id):
        raise MISMATCH
    status = prev["status"]
    if status == "pending":
        raise ApiError(409, "op_pending", "הבקשה הקודמת עדיין מתבצעת.", retryable=True)
    if status == "failed":
        raise ApiError(409, "op_failed", "הבקשה הקודמת נכשלה; שלחו בקשה חדשה.", details={"error": re.sub(r"[^A-Za-z0-9_.\-]", "", str(prev["error"] or ""))[:60]})
    if status == "unknown":
        return 202, {"status": "unknown", "op_id": prev["id"], "message": "הבקשה נשלחה; הפריט יופיע ברשימה לאחר אישור."}
    if shape in ("run", "stop", "apply"):
        return 202, {"run_id": None, "op_id": prev["id"], "note": "הבקשה נשלחה; התוצאה תופיע בהרצות."}
    if shape == "delete":
        t = w.conn.execute("SELECT id, expires_at FROM automation_trash WHERE kind = ? AND item_id = ? ORDER BY deleted_at DESC LIMIT 1", (prev["kind"], prev["item_id"])).fetchone()
        return 200, {"trash_id": t["id"] if t else None, "expires_at": t["expires_at"] if t else None, "op_id": prev["id"]}
    row = store.cache_row(w.conn, prev["kind"], prev["item_id"]) if prev["item_id"] else None
    if row is None:
        return 200, {"status": "ok", "op_id": prev["id"]}
    return (201 if shape == "create" else 200), {"item": item_view(w, prev["kind"], prev["item_id"], detail=True), "op_id": prev["id"]}


def item_view(w: W, kind: str, item_id: str, *, detail: bool = False) -> dict[str, Any]:
    """The item as the caller may see it (404 when a reduced-rights caller may not)."""
    ctx = scope.Ctx(w.conn, w.principal)  # fresh: the entity states changed with the write
    row, rd, facts = view.get_item(ctx, kind, item_id)
    env = view.Env(ctx)
    if detail:
        return view.detail_item(ctx, env, row, rd, facts)
    return view.build_item(ctx, env, row, rd=rd, facts=facts)


# ================================================================ judging content

class Judgement:
    """The outcome of judging one new content against the stored one."""

    def __init__(self) -> None:
        self.config: dict[str, Any] = {}
        self.draft: dict[str, Any] | None = None  # the draft the sentences / block paths refer to (the caller's own, sanitised; a code save: parsed from the config)
        self.profile = "builder"
        self.facts: dict[str, Any] = {}
        self.old_facts: dict[str, Any] | None = None
        self.preserved: list[str] = []
        self.self_trigger: list[str] = []
        self.unknown_effects = False
        self.sensitive = False
        self.errors: list[dict[str, str]] = []
        self.denials: list[ApiError] = []
        self.rd: dict[str, Any] | None = None


def _mctx(w: W, names_scoped: bool = False) -> model.ModelContext:
    return w.ctx.model_ctx(code_view=True, scoped=False, names_scoped=names_scoped)


LOCKED_CHANGED = "חלק נעול שונה. אפשר לשנות אותו רק בתצוגת הקוד."
MASKED_TEXT = "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת."


def _validate(w: W, kind: str, draft: dict[str, Any]) -> list[dict[str, str]]:
    """The model's validation (caps, required values, the argument and notify rules of NEW or CHANGED blocks) plus what only the service knows: a device step
    drives devices of its own domain (`light.turn_on` on a switch is a mistake the catalogue never offers)."""
    out = model.validate_draft(kind, draft, notify_targets=list(w.ctx.notify_targets), shabbat_sensor=w.ctx.shabbat_sensor or None, allowed_actions=w.ctx.allowed_actions())
    mctx = w.ctx.model_ctx(code_view=False, scoped=False)
    for wk in model.walk_draft(draft):
        b = wk.block
        if wk.section != "action" or b.get("kind") != "typed" or b.get("type") != "service" or b.get("role") != "device" or not model.block_changed(b, wk.section, mctx):
            continue
        domain = b["action"].split(".", 1)[0]
        if any(e.split(".", 1)[0] != domain for e in b["entity_ids"]):
            out.append({"path": wk.path, "code": "entity_mismatch", "message": "המכשיר אינו מתאים לפעולה שנבחרה"})
    return out


def judge(w: W, kind: str, *, draft: dict[str, Any] | None, config_in: dict[str, Any] | None, stored: dict[str, Any] | None, item_id: str | None, creating: bool,
          force_single: bool = False, names_scoped: bool = False, preview: bool = False) -> Judgement:
    """Build the config of a draft (or take the config of the code view), derive the profile from its CONTENT, check the policy, the scope and the sensitive
    grants. Nothing is raised: the caller chooses (a write raises, a preview reports). A draft from a client is never trusted: its locked blocks are the stored
    item's by fingerprint or they are refused (`locked_block_changed`), its typed blocks keep only raws the stored item has."""
    j = Judgement()
    mctx = _mctx(w, names_scoped)
    stored_rd = drafts.read(kind, stored, mctx) if stored is not None else None
    stored_draft = stored_rd["draft"] if stored_rd is not None else None
    j.old_facts = scope.facts_of(w.ctx, kind, stored_rd) if stored_rd is not None else None
    if draft is not None:
        try:
            san = drafts.sanitise(kind, draft, stored_draft, mctx)
            j.draft = san.draft
            problems = _validate(w, kind, san.draft)
        except (KeyError, TypeError, ValueError, AttributeError, IndexError, RecursionError):
            j.errors.append({"path": "", "code": "validation", "message": "הטיוטה אינה שלמה או אינה תקינה"})  # a draft that is not shaped like one is the caller's mistake, never a crash
            return j
        code_needed = False
        for path, b in san.changed:
            if preview and b.get("raw") is not None and not pol.has_mask(b["raw"]):
                code_needed = True  # a preview reports what the save would need (`requires.code_view`); the save itself refuses: 403 `locked_block_changed`
            else:
                j.errors.append({"path": path, "code": "locked_block_changed", "message": LOCKED_CHANGED})
        j.errors.extend(p for p in san.problems if not any(e["path"] == p["path"] and e["code"] == p["code"] for e in j.errors))
        j.errors.extend(problems)
        if j.errors:
            return j
        try:
            j.config = model.draft_to_config(kind, san.draft, stored, mctx, item_id=item_id)
        except (model.ModelError, KeyError, TypeError, ValueError):
            j.errors.append({"path": "", "code": "validation", "message": "הפריט אינו שלם או אינו תקין"})
            return j
        if pol.has_mask(j.config):
            j.errors.append({"path": "", "code": "masked_values", "message": MASKED_TEXT})
            return j
        j.profile = "code" if code_needed else "builder"
    else:
        incoming = config_in or {}
        if pol.secret_kind(incoming) or pol.has_mask(incoming):
            j.errors = [{"path": "", "code": "masked_values", "message": MASKED_TEXT}]
            j.config = incoming
            return j
        if kind in ("automation", "scene") and item_id is not None and incoming.get("id") not in (None, item_id):
            j.errors.append({"path": "id", "code": "validation", "message": "המזהה אינו ניתן לשינוי"})
            return j
        cfg_in = _with_id(kind, incoming, item_id)
        try:
            builder, parsed = drafts.builder_expressible(kind, cfg_in, stored, mctx, item_id)
        except (model.ModelError, KeyError, TypeError, ValueError):
            j.errors.append({"path": "", "code": "validation", "message": "התוכן אינו ניתן לשמירה כפי שהוא (מפתחות לא מוכרים או מבנה לא תקין)."})
            return j
        j.draft = parsed
        j.errors.extend(_validate(w, kind, parsed))
        known = {model.true_fingerprint(b) for b in model.locked_blocks(stored_draft)} if stored_draft else set()
        for wk in model.walk_draft(parsed):
            b = wk.block
            if b.get("kind") == "locked" and model.true_fingerprint(b) not in known:
                if b.get("reason") == "code":
                    j.errors.append({"path": wk.path, "code": "code_not_allowed", "message": "אסור לשמור קוד סודי בתוך אוטומציה, סצנה או סקריפט."})
                elif b.get("reason") == "secret":
                    j.errors.append({"path": wk.path, "code": "masked_values", "message": MASKED_TEXT})
        if j.errors:
            return j
        j.config = cfg_in
        j.profile = "builder" if builder else "code"
    nrd = drafts.read(kind, j.config, mctx)
    j.rd = nrd
    j.facts = scope.facts_of(w.ctx, kind, nrd)
    j.unknown_effects = j.facts["unknown_effects"]
    j.sensitive = bool(j.facts["sensitive"]) or _sensitive_by_bridge_rule(w, nrd["draft"])
    j.preserved = model.preserved_fingerprints(nrd["draft"])
    if kind == "automation":
        nd = nrd["draft"]
        j.self_trigger = pol.self_trigger(j.facts["trigger_entities"], model.draft_targets(nd), guarded=bool(nd["conditions"]))
        if stored_draft is not None and j.self_trigger:
            old = pol.self_trigger(j.old_facts["trigger_entities"] if j.old_facts else [], model.draft_targets(stored_draft), guarded=bool(stored_draft["conditions"]))
            j.self_trigger = [e for e in j.self_trigger if e not in old]
    return j


def _sensitive_by_bridge_rule(w: W, draft: dict[str, Any]) -> bool:
    """The bridge refuses `sensitive: false` on what it can recognise on its own (an alarm / lock / siren service anywhere, a door-class cover by the
    `device_class` of its state): the flag is sent true wherever `automation_policy.sensitive_required` says so, whatever the add-on's own classification found."""
    services: list[str] = []
    for wk in model.walk_draft(draft):
        b = wk.block
        if wk.section != "action":
            continue
        if b.get("kind") == "typed" and b.get("type") == "service":
            services.append(b["action"])
        elif b.get("kind") == "locked" and isinstance(b.get("raw"), dict):
            svc = b["raw"].get("action") if b["raw"].get("action") is not None else b["raw"].get("service")
            if isinstance(svc, str):
                services.append(svc)
    targets = model.draft_targets(draft)
    w.ctx.preload(targets)
    return pol.sensitive_required(services, targets, lambda e: (w.ctx.entity(e) or {}).get("attributes"))


def _with_id(kind: str, cfg: dict[str, Any], item_id: str | None) -> dict[str, Any]:
    if kind == "script" or item_id is None:
        return cfg
    out = dict(cfg)
    out["id"] = item_id
    return out


def rights_of(w: W, kind: str, j: Judgement, *, code_view_needed: bool) -> list[ApiError]:
    """The caller's rights over the new content (and the old): ApiErrors in the order a person can act on them."""
    denials: list[ApiError] = []
    for r in scope.change_reasons(w.ctx, kind, j.old_facts, j.facts):
        denials.append(reason_error(r))
    if j.profile == "code" or code_view_needed:
        if not w.ctx.code_view_allowed() or not _code_scope_ok(w, j):
            denials.insert(0, ApiError(403, "code_view_required", "שינוי זה אפשרי רק בתצוגת הקוד."))
        elif j.profile == "code" and not w.ctx.ha_admin:
            denials.insert(0, ApiError(403, "not_ha_admin", "שמירת תוכן זה דורשת מנהל של תשתית המערכת."))
    return denials


def _code_scope_ok(w: W, j: Judgement) -> bool:
    a = w.ctx.access
    ents = list(dict.fromkeys((j.old_facts["targets"] if j.old_facts else []) + j.facts["targets"]))
    return a.wide(scope.CODE_VIEW) or (bool(ents) and all(a.allowed(scope.CODE_VIEW, e) for e in ents))


def lock_removal_needs_wide(w: W, j: Judgement) -> ApiError | None:
    """CR §7: moving or deleting a locked block needs only `manage` at the typed targets - unless the block has unknown effects: then installation-wide manage."""
    if j.old_facts is None or w.ctx.access.wide(scope.MANAGE_OF["automation"]):
        return None
    old = [b["fingerprint"] for b in j.old_facts["locked"] if b["effects"] == "unknown"]
    new = [b["fingerprint"] for b in j.facts["locked"] if b["effects"] == "unknown"]
    if old != new:
        return ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.", details={"reason": "unknown_effects_block_moved"})
    return None


def confirmations(j: Judgement, confirm: bool) -> None:
    if (j.unknown_effects or j.self_trigger) and confirm is not True:
        raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.", details={"unknown_effects": j.unknown_effects, "self_trigger": bool(j.self_trigger)})


# ================================================================ create / replace / code

def new_item_id(w: W, kind: str, alias: str) -> str:
    ms = str(int(time.time() * 1000))
    if kind == "script":
        slug = re.sub(r"[^a-z0-9]+", "_", alias.lower().encode("ascii", "ignore").decode()).strip("_")[:40]
        taken = {r[0] for r in w.conn.execute("SELECT item_id FROM ha_config_items WHERE kind = 'script'").fetchall()}
        if slug and slug not in taken and w.ctx.entity(f"script.{slug}") is None:
            return slug
        return f"arx_{ms}"
    return ms


def create(w: W, kind: str, draft: dict[str, Any], enabled: bool, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    w.require_manage(kind)
    with w.audited(f"automation.create", kind):
        w.feature_on()
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "create", "create", kind)
        w.rate()
        w.writable()
        name = (draft.get("name") if kind == "scene" else draft.get("alias")) or ""
        item_id = new_item_id(w, kind, name)
        j = judge(w, kind, draft=draft, config_in=None, stored=None, item_id=item_id, creating=True)
        _raise_judgement(w, kind, j, confirm, creating=True)
        if j.self_trigger:
            j = judge(w, kind, draft={**draft, "mode": "single", "max": None}, config_in=None, stored=None, item_id=item_id, creating=True, force_single=True)
            _raise_judgement(w, kind, j, True, creating=True)
        return _write_new(w, kind, item_id, j, enabled, client_request_id, "create", "automation.create")


def _raise_judgement(w: W, kind: str, j: Judgement, confirm: bool, *, creating: bool, code_view_needed: bool = False) -> None:
    if j.errors:
        raise problem_error(j.errors)
    denials = rights_of(w, kind, j, code_view_needed=code_view_needed)
    if denials:
        raise denials[0]
    wide = lock_removal_needs_wide(w, j)
    if wide is not None:
        raise wide
    w.details.update(entities=j.facts.get("targets", []), classes=j.facts.get("sensitive_classes", []), sensitive=j.sensitive, profile=j.profile, locked=j.facts.get("locked_count", 0))
    confirmations(j, confirm)


def _write_new(w: W, kind: str, item_id: str, j: Judgement, enabled: bool, client_request_id: str, op: str, action: str, *, trash_id: str | None = None) -> tuple[int, dict[str, Any]]:
    op_id, again = begin_op(w, client_request_id, op, kind, item_id)
    if again is not None:
        return replay(w, again, "create", op, kind)
    resp = bridge_call(w, "upsert", op_id, kind=kind, item_id=item_id, base_revision=None, profile=j.profile, config=j.config, preserved=j.preserved, sensitive=j.sensitive)
    return _after_write(w, kind, item_id, resp, op_id, j, enabled=enabled, created=True, action=action, revision_before=None, status=201, trash_id=trash_id)


def _after_write(w: W, kind: str, item_id: str, resp: dict[str, Any], op_id: str, j: Judgement, *, enabled: bool, created: bool, action: str, revision_before: str | None,
                 status: int, trash_id: str | None = None) -> tuple[int, dict[str, Any]]:
    entity_id = resp.get("entity_id") if isinstance(resp.get("entity_id"), str) else None
    warnings: list[dict[str, str]] = []
    if not resp.get("loaded", True):
        # the write was accepted but the item never appeared in Home Assistant (a new item the bridge took out again: `rolled_back`; the include line of the file
        # is probably missing, U-5): writing is blocked until Home Assistant reloads, and the administrator's review lists it
        if created:
            st = tr.mirror_state(w.conn)
            st["authoring_block"], st["authoring_block_at"] = "not_loaded", store.stamp()
            store.MIRROR._save(w.conn, st)
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        w.audit(action, "allowed", kind, item_id, "not_loaded", op_id=op_id, revision_before=revision_before, revision_after=resp.get("revision_after"), rolled_back=bool(resp.get("rolled_back")))
        return 202, {"status": "not_loaded", "op_id": op_id}
    if created and kind == "automation" and not enabled:
        try:
            bridge_call(w, "disable", f"{op_id}d", kind="automation", item_id=item_id)
        except ApiError as exc:
            warnings.append({"path": "enabled", "code": "not_disabled", "message": "האוטומציה נוצרה אך לא הושבתה; השביתו אותה ידנית."})
            w.audit("automation.disable", "denied", kind, item_id, exc.code)
    try:
        store.MIRROR.fetch_item(kind, item_id, w.conn, entity_id=entity_id)
    except ApiError:
        pass
    store.refresh_entity_state(w.conn, entity_id)
    row = store.cache_row(w.conn, kind, item_id)
    if row is not None:
        blob = row["config_json"]
        if row["revision"]:
            store.note_version(w.conn, kind, item_id, row["revision"], blob, row["masked"], "arx", w.principal.user_id, w.principal.username, store.MIRROR.now(), keep=store.versions_keep(w.conn))
    store.note_arx_write(w.conn, kind, item_id, w.principal, created=created)
    store_finish(w.conn, op_id, "ok", item_id=item_id)
    store.publish([kind])
    w.audit(action, "allowed", kind, item_id, op_id=op_id, revision_before=revision_before, revision_after=resp.get("revision_after"), **({"trash_id": trash_id} if trash_id else {}))
    try:
        item = item_view(w, kind, item_id, detail=True)
    except ApiError:
        return 202, {"status": "unknown", "op_id": op_id, "message": "הבקשה נשלחה; הפריט יופיע ברשימה לאחר אישור."}
    item["warnings"] = item["warnings"] + warnings
    return status, {"item": item, "op_id": op_id}


def fresh_stored(w: W, kind: str, item_id: str, row: view.Row) -> dict[str, Any]:
    """The item straight from Home Assistant (writes are decided on a fresh read, never on the cache): the REAL config, held in memory only."""
    cfg = store.MIRROR.fetch_item(kind, item_id, w.conn, entity_id=row.entity_id)
    if cfg is None:
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    return cfg


def _editable(row: view.Row) -> None:
    if row.source != "ui":
        raise ApiError(422, "not_editable", "פריט זה מוגדר בקובץ תצורה או במכשיר ואינו ניתן לעריכה כאן.")


def _conflict(w: W, kind: str, item_id: str, base_revision: str, current_revision: str) -> ApiError:
    try:
        current = item_view(w, kind, item_id, detail=True)
    except ApiError:
        current = None
    return ApiError(409, "item_changed", "הפריט שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.", details={"current": current, "base_revision": base_revision, "current_revision": current_revision})


def update(w: W, kind: str, item_id: str, draft: dict[str, Any], base_revision: str, confirm: bool, client_request_id: str, *, action: str = "automation.update") -> tuple[int, dict[str, Any]]:
    w.require_manage(kind)
    with w.audited(action, kind, item_id):
        w.feature_on()
        row, _rd, _f = view.get_item(w.ctx, kind, item_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "update", "update", kind, item_id)
        w.rate()
        w.writable()
        _editable(row)
        stored = fresh_stored(w, kind, item_id, row)
        revision = model.revision_of(stored)
        if base_revision != revision:
            raise _conflict(w, kind, item_id, base_revision, revision)
        j = judge(w, kind, draft=draft, config_in=None, stored=stored, item_id=item_id, creating=False)
        _raise_judgement(w, kind, j, confirm, creating=False)
        if j.self_trigger:
            j = judge(w, kind, draft={**draft, "mode": "single", "max": None}, config_in=None, stored=stored, item_id=item_id, creating=False, force_single=True)
            _raise_judgement(w, kind, j, True, creating=False)
        return _send_update(w, kind, item_id, stored, revision, j, client_request_id, action)


def _send_update(w: W, kind: str, item_id: str, stored: dict[str, Any], revision: str, j: Judgement, client_request_id: str, action: str) -> tuple[int, dict[str, Any]]:
    if model.canonical_json(stored) == model.canonical_json(j.config):
        return 200, {"item": item_view(w, kind, item_id, detail=True), "op_id": None}
    op_id, again = begin_op(w, client_request_id, "update", kind, item_id)
    if again is not None:
        return replay(w, again, "update", "update", kind, item_id)
    resp = bridge_call(w, "upsert", op_id, kind=kind, item_id=item_id, base_revision=revision, profile=j.profile, config=j.config, preserved=j.preserved, sensitive=j.sensitive)
    return _after_write(w, kind, item_id, resp, op_id, j, enabled=True, created=False, action=action, revision_before=revision, status=200)


def update_code(w: W, kind: str, item_id: str, config: dict[str, Any], base_revision: str, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    """Route 9: the code view's full item JSON. The profile comes from the CONTENT: all typed / preserved -> a builder save (delegation applies); else a code save
    (an HA administrator with the code view)."""
    w.require_manage(kind)
    with w.audited("automation.code_edit", kind, item_id):
        w.feature_on()
        row, _rd, facts0 = view.get_item(w.ctx, kind, item_id)
        if not w.ctx.code_view_allowed():
            raise ApiError(403, "code_view_required", "שינוי זה אפשרי רק בתצוגת הקוד.")
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "update", "update", kind, item_id)
        w.rate()
        w.writable()
        _editable(row)
        if row.masked:
            raise ApiError(422, "masked_values", "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.")
        stored = fresh_stored(w, kind, item_id, row)
        revision = model.revision_of(stored)
        if base_revision != revision:
            raise _conflict(w, kind, item_id, base_revision, revision)
        j = judge(w, kind, draft=None, config_in=config, stored=stored, item_id=item_id, creating=False)
        _raise_judgement(w, kind, j, confirm, creating=False, code_view_needed=True)
        return _send_update(w, kind, item_id, stored, revision, j, client_request_id, "automation.code_edit")


# ================================================================ copy

def copy_item(w: W, kind: str, item_id: str, name: str, client_request_id: str) -> tuple[int, dict[str, Any]]:
    w.require_manage(kind)
    with w.audited("automation.copy", kind, item_id):
        w.feature_on()
        row, _rd, _f = view.get_item(w.ctx, kind, item_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "create", "copy", kind)
        w.rate()
        w.writable()
        _editable(row)
        name = (name or "").strip()
        if not name or len(name) > pol.CAPS["alias_max"] or any(ord(c) < 32 for c in name):
            raise ApiError(422, "validation", f"שם: 1–{pol.CAPS['alias_max']} תווים, בלי תווי בקרה.", details={"path": "name"})
        stored = fresh_stored(w, kind, item_id, row)
        if pol.secret_kind(stored):
            raise ApiError(422, "masked_values", "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.")
        new_id = new_item_id(w, kind, name)
        cfg = copy.deepcopy(model.to_new_schema(kind, stored, _mctx(w)))
        if kind in ("automation", "scene"):
            cfg["id"] = new_id
        cfg["name" if kind == "scene" else "alias"] = name
        j = judge(w, kind, draft=None, config_in=cfg, stored=None, item_id=new_id, creating=True)
        _raise_judgement(w, kind, j, True, creating=True)  # the copy shows no more than the source did: confirmation is the caller's
        return _write_new(w, kind, new_id, j, True, client_request_id, "copy", "automation.copy")


# ================================================================ delete / trash / restore

def delete(w: W, kind: str, item_id: str, base_revision: str, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    w.require_manage(kind)
    with w.audited("automation.delete", kind, item_id):
        w.feature_on()
        row, _rd, _f = view.get_item(w.ctx, kind, item_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "delete", "delete", kind, item_id)
        w.rate()
        w.writable()
        _editable(row)
        stored = fresh_stored(w, kind, item_id, row)
        revision = model.revision_of(stored)
        if base_revision != revision:
            raise _conflict(w, kind, item_id, base_revision, revision)
        mctx = _mctx(w)
        rd = drafts.read(kind, stored, mctx)
        facts = scope.facts_of(w.ctx, kind, rd)
        reasons = scope.change_reasons(w.ctx, kind, facts, None)
        if reasons:
            raise reason_error(reasons[0])
        if confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.details.update(entities=facts["targets"], classes=facts["sensitive_classes"], sensitive=facts["sensitive"])
        op_id, again = begin_op(w, client_request_id, "delete", kind, item_id)
        if again is not None:
            return replay(w, again, "delete", "delete", kind, item_id)
        meta = store.meta_rows(w.conn).get((kind, item_id))
        trash_id, expires = trash_put(w, kind, item_id, stored, meta, facts)
        try:
            bridge_call(w, "delete", op_id, kind=kind, item_id=item_id, base_revision=revision, profile="builder", sensitive=facts["sensitive"])
        except ApiError as exc:
            if exc.code != "config_timeout":  # a definite refusal: nothing was removed, the snapshot goes too (a timeout keeps it)
                w.conn.execute("DELETE FROM automation_trash WHERE id = ?", (trash_id,))
            raise
        store.MIRROR.drop(w.conn, kind, item_id)
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        store.publish([kind])
        w.audit("automation.delete", "allowed", kind, item_id, op_id=op_id, revision_before=revision, trash_id=trash_id)
        return 200, {"trash_id": trash_id, "expires_at": expires, "op_id": op_id}


def trash_put(w: W, kind: str, item_id: str, stored: dict[str, Any], meta: sqlite3.Row | None, facts: dict[str, Any]) -> tuple[str, str]:
    import datetime as dt

    now = store.MIRROR.now()
    days = int(w.ctx.cfg["automations.trash_days"])
    trash_id = "tr" + uuid.uuid4().hex[:12]
    expires = store._iso(now + dt.timedelta(days=days))
    masked = 1 if pol.secret_kind(stored) else 0
    entities = [{"entity_id": e, "name": w.ctx.name_of(e)} for e in facts["targets"]]
    name = (stored.get("name") if kind == "scene" else stored.get("alias")) or item_id
    meta_json = json.dumps({k: meta[k] for k in meta.keys()}, ensure_ascii=False) if meta is not None else None
    w.conn.execute("INSERT INTO automation_trash(id, kind, item_id, name, config_json, masked, meta_json, entities_json, sensitive, deleted_by, deleted_by_username, deleted_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (trash_id, kind, item_id, name, json.dumps(pol.mask_secrets(stored), ensure_ascii=False), masked, meta_json, json.dumps(entities, ensure_ascii=False), 1 if facts["sensitive"] else 0,
                    w.principal.user_id, w.principal.username, store._iso(now), expires))
    return trash_id, expires


def _trash_rows(w: W) -> list[sqlite3.Row]:
    return w.conn.execute("SELECT * FROM automation_trash WHERE restored_at IS NULL AND expires_at > ? ORDER BY deleted_at DESC", (store.stamp(),)).fetchall()


def _trash_visible(w: W, t: sqlite3.Row) -> tuple[bool, dict[str, Any] | None, dict[str, Any] | None]:
    try:
        cfg = json.loads(t["config_json"])
    except ValueError:
        return False, None, None
    rd = drafts.read(t["kind"], cfg, w.ctx.model_ctx(code_view=False, scoped=False))
    facts = scope.facts_of(w.ctx, t["kind"], rd)
    return scope.visible(w.ctx, t["kind"], facts) and scope.holds_any(w.ctx, t["kind"]), rd, facts


def trash_list(w: W) -> dict[str, Any]:
    items = []
    if w.ctx.cfg["automations.enabled"] != "true":
        return {"items": items}
    block = tr.write_block(w.conn, w.ctx.cfg)
    for t in _trash_rows(w):
        ok, rd, facts = _trash_visible(w, t)
        if not ok or facts is None:
            continue
        can = block is None and not t["masked"] and not scope.change_reasons(w.ctx, t["kind"], None, facts)
        try:
            ents = json.loads(t["entities_json"] or "[]")
        except ValueError:
            ents = []
        items.append({"trash_id": t["id"], "kind": t["kind"], "config_id": t["item_id"], "name": t["name"] or "", "sentence": rd["sentence"] if rd is not None else "", "deleted_at": t["deleted_at"],
                      "expires_at": t["expires_at"], "deleted_by": t["deleted_by_username"] or None, "sensitive": bool(t["sensitive"]), "entities": [e["entity_id"] for e in ents if isinstance(e, dict)],
                      "can_restore": bool(can)})
    return {"items": items}


def restore_trash(w: W, trash_id: str, client_request_id: str, confirm: bool = False) -> tuple[int, dict[str, Any]]:
    t0 = w.conn.execute("SELECT kind FROM automation_trash WHERE id = ?", (trash_id,)).fetchone()
    kind0 = t0["kind"] if t0 else "automation"
    w.require_manage(kind0)
    with w.audited("automation.restore", kind0, trash_id):
        w.feature_on()
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "create", "restore", None)
        t = w.conn.execute("SELECT * FROM automation_trash WHERE id = ? AND restored_at IS NULL AND expires_at > ?", (trash_id, store.stamp())).fetchone()
        ok, rd, facts = _trash_visible(w, t) if t is not None else (False, None, None)
        if t is None or not ok:
            raise ApiError(404, "trash_not_found", "הפריט אינו בסל המחזור (ייתכן שפג תוקפו).")
        kind = t["kind"]
        w.rate()
        w.writable()
        if t["masked"]:
            raise ApiError(422, "masked_values", "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.")
        cfg = json.loads(t["config_json"])
        item_id = t["item_id"] if store.cache_row(w.conn, kind, t["item_id"]) is None and w.ctx.entity(f"{kind}.{t['item_id']}" if kind == "script" else "") is None else new_item_id(w, kind, t["name"] or "")
        cfg = model.to_new_schema(kind, cfg, _mctx(w))
        if kind in ("automation", "scene"):
            cfg["id"] = item_id
        j = judge(w, kind, draft=None, config_in=cfg, stored=None, item_id=item_id, creating=True)
        _raise_judgement(w, kind, j, True, creating=True)
        if w.conn.execute("UPDATE automation_trash SET restored_at = ? WHERE id = ? AND restored_at IS NULL", (f"~restoring:{store.stamp()}", trash_id)).rowcount != 1:
            raise ApiError(404, "trash_not_found", "הפריט אינו בסל המחזור (ייתכן שפג תוקפו).")
        try:
            status, body = _write_new(w, kind, item_id, j, True, client_request_id, "restore", "automation.restore", trash_id=trash_id)
        except ApiError as exc:
            w.conn.execute("UPDATE automation_trash SET restored_at = ? WHERE id = ?", (None if exc.code != "config_timeout" else f"~unknown:{store.stamp()}", trash_id))
            raise
        w.conn.execute("UPDATE automation_trash SET restored_at = ?, restored_item_id = ? WHERE id = ?", (store.stamp(), item_id, trash_id))
        if isinstance(body, dict):
            body["restored_id"] = item_id
            body["id_changed"] = item_id != t["item_id"]
        return status, body


def purge_trash(w: W, trash_id: str, confirm: bool) -> dict[str, Any]:
    with w.audited("automation.purge", None, trash_id):
        w.feature_on()
        if not w.ctx.access.wide(scope.MANAGE):
            require(w.conn, w.principal, scope.MANAGE, INSTALLATION)
        t = w.conn.execute("SELECT * FROM automation_trash WHERE id = ? AND restored_at IS NULL AND expires_at > ?", (trash_id, store.stamp())).fetchone()
        if t is None:
            raise ApiError(404, "trash_not_found", "הפריט אינו בסל המחזור (ייתכן שפג תוקפו).")
        if confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.conn.execute("DELETE FROM automation_trash WHERE id = ?", (trash_id,))
        w.audit("automation.purge", "allowed", t["kind"], t["item_id"], trash_id=trash_id)
        return {"ok": True}


# ================================================================ versions

def versions_list(w: W, kind: str, item_id: str) -> dict[str, Any]:
    """The history (`VersionRow`): the newest first, the current one marked; `summary` is the Hebrew sentence of that version."""
    view.get_item(w.ctx, kind, item_id)
    out = []
    cur = store.cache_row(w.conn, kind, item_id)
    mctx = w.ctx.model_ctx(code_view=False, scoped=False)
    for v in w.conn.execute("SELECT * FROM automation_versions WHERE kind = ? AND item_id = ? ORDER BY id DESC", (kind, item_id)).fetchall():
        try:
            summary = drafts.read(kind, json.loads(v["config_json"]), mctx)["sentence"]
        except (ValueError, TypeError):
            summary = ""
        out.append({"version_id": str(v["id"]), "revision": v["revision"], "at": v["seen_at"], "via": v["via"], "actor": v["actor_username"] or None, "summary": summary,
                    "current": bool(cur is not None and v["revision"] == cur["revision"]), "masked": bool(v["masked"])})
    return {"items": out}


def restore_version(w: W, kind: str, item_id: str, version_id: int, base_revision: str | None, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    w.require_manage(kind)
    with w.audited("automation.restore", kind, item_id):
        w.feature_on()
        row, _rd, _f = view.get_item(w.ctx, kind, item_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "update", "restore_version", kind, item_id)
        w.rate()
        w.writable()
        _editable(row)
        v = w.conn.execute("SELECT * FROM automation_versions WHERE id = ? AND kind = ? AND item_id = ?", (version_id, kind, item_id)).fetchone()
        if v is None:
            raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
        if v["masked"]:
            raise ApiError(422, "masked_values", "הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.")
        stored = fresh_stored(w, kind, item_id, row)
        revision = model.revision_of(stored)
        if base_revision is not None and base_revision != revision:
            raise _conflict(w, kind, item_id, base_revision, revision)
        cfg = model.to_new_schema(kind, json.loads(v["config_json"]), _mctx(w))
        if kind in ("automation", "scene"):
            cfg["id"] = item_id
        j = judge(w, kind, draft=None, config_in=cfg, stored=stored, item_id=item_id, creating=False)
        _raise_judgement(w, kind, j, confirm, creating=False)
        op_id, again = begin_op(w, client_request_id, "update", kind, item_id)
        if again is not None:
            return replay(w, again, "update", "restore_version", kind, item_id)
        resp = bridge_call(w, "upsert", op_id, kind=kind, item_id=item_id, base_revision=revision, profile=j.profile, config=j.config, preserved=j.preserved, sensitive=j.sensitive)
        return _after_write(w, kind, item_id, resp, op_id, j, enabled=True, created=False, action="automation.restore", revision_before=revision, status=200)


# ================================================================ runtime: enable / disable / run / stop / apply

def _runtime_item(w: W, kind: str, item_id: str, action: str) -> tuple[view.Row, dict[str, Any] | None, dict[str, Any]]:
    w.feature_on()
    row, rd, facts = view.get_item(w.ctx, kind, item_id)
    return row, rd, facts


def _risky(rd: dict[str, Any] | None, facts: dict[str, Any]) -> bool:
    if facts["sensitive"] or facts["unknown_effects"]:
        return True
    return any(ha_bridge.ACTIONS.get(s["action"], {}).get("risk", "routine") != "routine" for s in facts["steps"] if s.get("action"))


def set_enabled(w: W, item_id: str, enable: bool, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    action = "automation.enable" if enable else "automation.disable"
    w.require_manage("automation")
    with w.audited(action, "automation", item_id):
        row, rd, facts = _runtime_item(w, "automation", item_id, action)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "toggle", "enable" if enable else "disable", "automation", item_id)
        w.rate()
        w.runtime_ready()
        if row.config_id is None:
            raise ApiError(422, "not_editable", "פריט זה מוגדר בקובץ תצורה או במכשיר ואינו ניתן לעריכה כאן.")
        reasons = scope.run_reasons(w.ctx, "automation", facts, entity_id=row.entity_id, source=row.source)
        if reasons:
            raise reason_error(reasons[0])
        if enable and _risky(rd, facts) and confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.details.update(entities=facts["targets"], classes=facts["sensitive_classes"], sensitive=facts["sensitive"])
        op_id, again = begin_op(w, client_request_id, "enable" if enable else "disable", "automation", item_id)
        if again is not None:
            return replay(w, again, "toggle", "enable" if enable else "disable", "automation", item_id)
        bridge_call(w, "enable" if enable else "disable", op_id, kind="automation", item_id=row.config_id, sensitive=facts["sensitive"])
        store.refresh_entity_state(w.conn, row.entity_id)
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        store.publish(["automation"])
        w.audit(action, "allowed", "automation", item_id, op_id=op_id)
        return 200, {"item": item_view(w, "automation", item_id), "changed": True, "op_id": op_id}


def run_automation(w: W, item_id: str, skip_condition: bool, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    w.require_manage("automation")
    with w.audited("automation.run", "automation", item_id):
        row, rd, facts = _runtime_item(w, "automation", item_id, "automation.run")
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "run", "run", "automation", item_id)
        w.rate()
        w.runtime_ready()
        if row.config_id is None:
            raise ApiError(422, "not_editable", "פריט זה מוגדר בקובץ תצורה או במכשיר ואינו ניתן לעריכה כאן.")
        reasons = scope.run_reasons(w.ctx, "automation", facts, entity_id=row.entity_id, source=row.source)
        if reasons:
            raise reason_error(reasons[0])
        if _risky(rd, facts) and confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.details.update(entities=facts["targets"], classes=facts["sensitive_classes"], sensitive=facts["sensitive"], skip_condition=bool(skip_condition))
        key = f"automation:{item_id}"
        gap_check(key, float(w.ctx.limits["run_interval_s"]))
        op_id, again = begin_op(w, client_request_id, "run", "automation", item_id)
        if again is not None:
            gap_release(key)
            return replay(w, again, "run", "run", "automation", item_id)
        try:
            resp = bridge_call(w, "trigger", op_id, kind="automation", item_id=row.config_id, skip_condition=bool(skip_condition), sensitive=facts["sensitive"])
        except ApiError:
            gap_release(key)
            raise
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        run_id = _note_started(w, "automation", item_id)
        w.audit("automation.run", "allowed", "automation", item_id, op_id=op_id, skip_condition=bool(skip_condition))
        return 202, {"run_id": run_id, "op_id": op_id, "context_id": resp.get("context_id"), "note": "הבקשה נשלחה; התוצאה תופיע בהרצות."}


def _note_started(w: W, kind: str, item_id: str) -> str:
    run_id = "ru" + uuid.uuid4().hex[:14]
    w.conn.execute("INSERT INTO automation_runs(id, kind, item_id, at, source) VALUES (?,?,?,?, 'event')", (run_id, kind, item_id, store.stamp()))
    return run_id


def _field_variables(rd: dict[str, Any] | None, fields: dict[str, Any]) -> dict[str, Any]:
    """The values of a script's fields as `variables`: only defined fields, each checked against its selector; required fields without a value or a default
    are refused. Values never carry a secret-like key or a template."""
    defs = {f["key"]: f for f in (rd["draft"]["fields"] if rd else [])}
    if not isinstance(fields, dict) or len(fields) > pol.CAPS["fields_max"]:
        raise ApiError(422, "validation", "ערך לא תקין — fields: אובייקט של שדות.", details={"path": "fields"})
    out: dict[str, Any] = {}
    for k, v in fields.items():
        f = defs.get(k)
        if f is None:
            raise ApiError(422, "validation", f"ערך לא תקין — {k}: שדה לא מוכר.", details={"path": k})
        if pol.has_template(v) or pol.secret_kind(v):
            raise ApiError(422, "validation", f"ערך לא תקין — {k}: ערך אסור.", details={"path": k})
        sel = f["selector"]
        ok = True
        if sel["kind"] == "number":
            ok = pol.is_number(v) and sel["min"] <= v <= sel["max"]
        elif sel["kind"] == "boolean":
            ok = isinstance(v, bool)
        elif sel["kind"] == "select":
            ok = isinstance(v, str) and v in sel["options"]
        elif sel["kind"] == "text":
            ok = isinstance(v, str) and len(v) <= 500
        elif sel["kind"] == "entity":
            ok = isinstance(v, str) and bool(pol.ENTITY_RE.match(v)) and (not sel.get("domains") or v.split(".", 1)[0] in sel["domains"])
        else:
            ok = isinstance(v, (str, bool, int, float))
        if not ok:
            raise ApiError(422, "validation", f"ערך לא תקין — {k}: הערך אינו מתאים לשדה.", details={"path": k})
        out[k] = v
    for k, f in defs.items():
        if f["required"] and k not in out and f.get("default") is None:
            raise ApiError(422, "validation", f"ערך לא תקין — {k}: שדה חובה.", details={"path": k})
    return out


def run_script(w: W, item_id: str, fields: dict[str, Any], confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    if not w.ctx.access.any_of((scope.SCRIPT_RUN, scope.SCRIPT_MANAGE)):
        require(w.conn, w.principal, scope.SCRIPT_RUN, INSTALLATION)
    with w.audited("automation.run", "script", item_id):
        row, rd, facts = _runtime_item(w, "script", item_id, "automation.run")
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "run", "run", "script", item_id)
        w.rate()
        w.runtime_ready()
        reasons = scope.run_reasons(w.ctx, "script", facts, entity_id=row.entity_id, source=row.source)
        if reasons:
            raise reason_error(reasons[0])
        variables = _field_variables(rd, fields)
        if _risky(rd, facts) and confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.details.update(entities=facts["targets"], classes=facts["sensitive_classes"], sensitive=facts["sensitive"], fields=sorted(variables))
        key = f"script:{item_id}"
        gap_check(key, float(w.ctx.limits["run_interval_s"]))
        op_id, again = begin_op(w, client_request_id, "run", "script", item_id)
        if again is not None:
            gap_release(key)
            return replay(w, again, "run", "run", "script", item_id)
        try:
            resp = bridge_call(w, "run_script", op_id, kind="script", item_id=row.config_id or item_id, variables=variables or None, sensitive=facts["sensitive"])
        except ApiError:
            gap_release(key)
            raise
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        run_id = _note_started(w, "script", item_id)
        w.audit("automation.run", "allowed", "script", item_id, op_id=op_id)
        return 202, {"run_id": run_id, "op_id": op_id, "context_id": resp.get("context_id"), "note": "הבקשה נשלחה; התוצאה תופיע בהרצות."}


def stop_script(w: W, item_id: str, client_request_id: str) -> tuple[int, dict[str, Any]]:
    if not w.ctx.access.any_of((scope.SCRIPT_RUN, scope.SCRIPT_MANAGE)):
        require(w.conn, w.principal, scope.SCRIPT_RUN, INSTALLATION)
    with w.audited("automation.run", "script", item_id):
        row, rd, facts = _runtime_item(w, "script", item_id, "automation.run")
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "stop", "stop", "script", item_id)
        w.rate()
        w.runtime_ready()
        reasons = scope.run_reasons(w.ctx, "script", facts, entity_id=row.entity_id, source=row.source)
        if reasons:
            raise reason_error(reasons[0])
        op_id, again = begin_op(w, client_request_id, "stop", "script", item_id)
        if again is not None:
            return replay(w, again, "stop", "stop", "script", item_id)
        resp = bridge_call(w, "stop_script", op_id, kind="script", item_id=row.config_id or item_id)
        store.refresh_entity_state(w.conn, row.entity_id)
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        store.publish(["script"])
        w.audit("automation.run", "allowed", "script", item_id, op_id=op_id, stopped=True)
        return 202, {"run_id": None, "op_id": op_id, "context_id": resp.get("context_id"), "note": "הבקשה נשלחה."}


def apply_scene(w: W, item_id: str, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    with w.audited("automation.run", "scene", item_id):
        w.feature_on()
        row, rd, facts = view.get_item(w.ctx, "scene", item_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "apply", "apply", "scene", item_id)
        w.rate()
        w.runtime_ready()
        reasons = scope.run_reasons(w.ctx, "scene", facts, entity_id=row.entity_id, source=row.source)
        if reasons:
            raise reason_error(reasons[0])
        if (facts["sensitive"] or facts["unknown_effects"]) and confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        if not row.entity_id:
            raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
        w.details.update(entities=facts["targets"], classes=facts["sensitive_classes"], sensitive=facts["sensitive"])
        key = f"scene:{item_id}"
        gap_check(key, float(w.ctx.limits["scene_apply_interval_s"]), "run_too_soon")
        op_id, again = begin_op(w, client_request_id, "apply", "scene", item_id)
        if again is not None:
            gap_release(key)
            return replay(w, again, "apply", "apply", "scene", item_id)
        try:
            resp = bridge_call(w, "apply_scene", op_id, kind="scene", entity_id=row.entity_id, sensitive=facts["sensitive"])
        except ApiError:
            gap_release(key)
            raise
        store_finish(w.conn, op_id, "ok", item_id=item_id)
        w.audit("automation.run", "allowed", "scene", item_id, op_id=op_id, applied=True)
        return 202, {"run_id": None, "op_id": op_id, "context_id": resp.get("context_id"), "note": "הבקשה נשלחה."}


# ================================================================ meta (Arx only)

def put_meta(w: W, kind: str, item_id: str, pinned: bool | None, favourite: bool | None, hidden: bool | None) -> dict[str, Any]:
    with w.audited("automation.meta", kind, item_id):
        w.feature_on()
        view.get_item(w.ctx, kind, item_id)
        if hidden is not None:
            ok = w.ctx.access.wide(scope.MANAGE_OF[kind]) or authorize(w.conn, w.principal, "system.configure", INSTALLATION).allowed
            if kind != "scene" or not ok:
                raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")
            w.conn.execute("INSERT OR IGNORE INTO automation_meta(kind, item_id, created_via, first_seen_at, last_seen_at) VALUES (?, ?, 'external', ?, ?)", (kind, item_id, store.stamp(), store.stamp()))
            w.conn.execute("UPDATE automation_meta SET hidden = ? WHERE kind = ? AND item_id = ?", (1 if hidden else 0, kind, item_id))
        if pinned is not None or favourite is not None:
            w.conn.execute("INSERT OR IGNORE INTO automation_prefs(user_id, kind, item_id) VALUES (?,?,?)", (w.principal.user_id, kind, item_id))
            if pinned is not None:
                w.conn.execute("UPDATE automation_prefs SET pinned = ? WHERE user_id = ? AND kind = ? AND item_id = ?", (1 if pinned else 0, w.principal.user_id, kind, item_id))
            if favourite is not None:
                w.conn.execute("UPDATE automation_prefs SET favourite = ? WHERE user_id = ? AND kind = ? AND item_id = ?", (1 if favourite else 0, w.principal.user_id, kind, item_id))
        w.audit("automation.meta", "allowed", kind, item_id)
        store.publish([kind])
        return item_view(w, kind, item_id)


# ================================================================ preview (data, never a write)

def preview(w: W, kind: str, item_id: str | None, draft: dict[str, Any] | None, config: dict[str, Any] | None) -> dict[str, Any]:
    """Always data: problems are returned, never raised (a well-formed body is always 200)."""
    w.feature_on()
    if not (w.ctx.access.anywhere(scope.MANAGE_OF[kind]) or scope.holds_any(w.ctx, kind)):
        require(w.conn, w.principal, scope.VIEW, INSTALLATION)
    rate_limit(w.principal.user_id, "preview", w.ctx.limits["preview_per_min"])
    stored = None
    if item_id:
        row, _rd, _f = view.get_item(w.ctx, kind, item_id)
        stored = row.cfg  # the cached (masked) config: a preview never reads Home Assistant for the stored item
    j = judge(w, kind, draft=draft, config_in=config, stored=stored, item_id=item_id, creating=item_id is None, names_scoped=True, preview=True)
    errors = list(j.errors)
    warnings: list[dict[str, str]] = []
    out: dict[str, Any] = {"valid": False, "errors": errors, "warnings": warnings, "ha_validation": "skipped", "sentence": "", "block_sentences": {},
                           "effects": {"entities": [], "unknown": False}, "sensitive": False, "sensitive_steps": [], "requires": {"confirm": False, "code_view": False, "ha_admin": False},
                           "suggest_schedule": None}
    if errors:
        return out
    denials: list[ApiError] = rights_of(w, kind, j, code_view_needed=config is not None) if w.ctx.access.anywhere(scope.MANAGE_OF[kind]) else []
    for d in denials:
        errors.append({"path": "", "code": d.code, "message": d.user_message})
    mctx = w.ctx.model_ctx(code_view=False, scoped=False, names_scoped=True)
    shown = j.draft if j.draft is not None else (j.rd["draft"] if j.rd is not None else None)
    if shown is not None:  # the sentences of the caller's own draft (its block uids), with names the caller may see
        model.refresh_sentences(shown, mctx)
        out["sentence"] = text.draft_sentence(kind, shown, mctx)
        out["block_sentences"] = model.block_sentences(shown, mctx)
    out["sensitive"] = j.sensitive
    out["sensitive_steps"] = scope.sensitive_steps_view(w.ctx, j.facts)
    out["requires"] = {"confirm": bool(j.unknown_effects or j.self_trigger), "code_view": j.profile == "code", "ha_admin": j.profile == "code"}
    effects = []
    for e in j.facts["targets"]:
        info = w.ctx.entity(e)
        step = next((s for s in j.facts["steps"] if e == s["entity_id"]), None)
        seen = bool(info) and w.ctx.access.can_read_state(e)  # a device outside the caller's reach is not named, placed or described
        effects.append({"entity_id": e, "name": info["name"] if seen else e, "floor": info["floor_name"] if seen else None, "area": info["area_name"] if seen else None,
                        "from": info["state"] if seen else None, "to": view.EXPECT_TO.get(step["action"]) if step and step.get("action") else None})
    out["effects"] = {"entities": effects, "unknown": bool(j.unknown_effects)}
    for e in j.facts["targets"] + j.facts["trigger_entities"] + j.facts["condition_entities"]:
        if w.ctx.entity(e) is None:
            warnings.append({"path": "", "code": "missing_entity", "message": f"מכשיר חסר: {e}"})
            break
    if j.self_trigger:
        warnings.append({"path": "", "code": "self_trigger", "message": "פעולה משנה התקן שגם מפעיל את האוטומציה; השמירה תקבע מצב הרצה יחיד."})
    if j.unknown_effects:
        warnings.append({"path": "", "code": "unknown_effects", "message": "לפריט פעולות שאינן ידועות מראש"})
    if j.sensitive:
        warnings.append({"path": "", "code": "sensitive", "message": "פעולה רגישה"})
    if kind == "automation" and j.rd is not None:
        sug = view.suggest_schedule_for(w.ctx, j.rd)
        if sug is not None:
            warnings.append({"path": "", "code": "suggest_schedule", "message": "אפשר ליצור כתזמון"})
            out["suggest_schedule"] = sug
    out["ha_validation"] = ha_validate(w, kind, j.config)
    if out["ha_validation"] == "failed":
        errors.append({"path": "", "code": "ha_validation", "message": "תשתית המערכת דחתה את ההגדרה."})
    out["valid"] = not errors
    return out


def ha_validate(w: W, kind: str, config: dict[str, Any]) -> str:
    """HA's own `validate_config` (WebSocket, no write): per key `{valid, error}`; 'skipped' when the command is not offered or HA is unreachable."""
    if kind == "scene":
        return "skipped"
    payload = {"triggers": config.get("triggers"), "conditions": config.get("conditions"), "actions": config.get("actions") if kind == "automation" else config.get("sequence")}
    payload = {k: v for k, v in payload.items() if v is not None}
    try:
        with unlocked(w.conn):
            reply = tr.get_transport().ws("validate_config", **payload)
    except ApiError:
        return "skipped"
    ok, _ = store.is_json_error(reply)
    result = reply.get("result") if ok else None
    if not isinstance(result, dict):
        return "skipped"
    return "ok" if all(isinstance(v, dict) and v.get("valid", True) for v in result.values()) else "failed"
