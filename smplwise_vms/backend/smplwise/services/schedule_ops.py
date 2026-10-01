"""CR-014 (schedules): the write operations (docs/architecture/SCHEDULER_API.md §3.5-§3.15, §4, §5, §8).

Every change reaches the component ONLY through the bridge (`smplwise_bridge.schedule`, signed with the pairing secret,
executed with the caller's own HA context); never `scheduler.*` from the add-on, never `enable_all` / `disable_all`.
Each operation: the permission before the body, the audited refusals, the caller's rights over the OLD content and the
NEW draft (`schedule_view.action_reasons`), the safety validation (`schedule_model.validate_draft`), the explicit
confirmations, the creator's own alarm code verified and discarded (`routers/alarm.verify_code_for`), an op row before
anything is sent (idempotent per `client_request_id`), the bridge call (never retried), a fresh re-read, the owner of
record and the audit row. A call whose outcome is unknown is recorded as such and never re-sent."""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

from ..audit import audit
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, note_grant, require
from . import ha_bridge, ha_sync
from . import schedule_model as model
from . import schedule_policy as policy
from . import schedule_view as view
from . import schedules as store

WRITES_PER_MIN = 30
PREVIEWS_PER_MIN = 60
RUN_MIN_GAP_S = 10.0
_RATE: dict[tuple[str, str], list[float]] = {}
_LAST_RUN: dict[str, float] = {}
_RATE_LOCK = threading.Lock()
DAY_SHORT = {"sun": "א׳", "mon": "ב׳", "tue": "ג׳", "wed": "ד׳", "thu": "ה׳", "fri": "ו׳", "sat": "ש׳"}

RIGHTS_ERRORS = {"no_manage_permission": (403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש."),
                 "sensitive_permission_required": (403, "sensitive_permission_required", "תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות."),
                 "class_disabled": (422, "class_not_allowed", "סוג ההתקן אינו מותר בתזמונים (הגדרות › תזמונים).")}
# a validation problem code that becomes the HTTP error of the same name (§3.20); every other one is `validation`
PROMOTED = {
    "code_not_allowed": (422, "אסור לשמור קוד בתוך תזמון."),
    "action_not_allowed": (422, "הפעולה אינה מותרת בתזמון."),
    "class_not_allowed": (422, "סוג ההתקן אינו מותר בתזמונים (הגדרות › תזמונים)."),
    "switch_not_marked": (422, "המתג לא סומן כבטוח לפעולה קבוצתית; רק מתגים מסומנים נכנסים לתזמון."),
    "alarm_managed_control": (422, "רכיב זה נשלט ממסך האזעקה ואינו נכנס לתזמון."),
    "media_managed_control": (422, "רכיב זה נשלט ממסך המולטימדיה ואינו נכנס לתזמון."),
    "alarm_code_needed": (422, "לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה."),
    "lock_code_needed": (422, "המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו."),
    "arm_mode_not_supported": (422, "לוח האזעקה אינו תומך במצב דריכה זה."),
    "condition_domain_not_allowed": (422, "אפשר להתנות רק בחיישנים, חיישנים בינאריים, מתגי עזר או מצב השמש."),
    "slots_overlap": (422, "משבצות חופפות באותו תזמון."),
    "tags_not_supported": (422, "רכיב התזמונים בגרסה זו אינו שומר תגיות."),
}
BRIDGE_UNAVAILABLE = {
    "feature_disabled": ApiError(409, "feature_disabled", "התזמונים כבויים בהגדרות המערכת."),
    "component_missing": ApiError(503, "scheduler_unavailable", "התזמונים אינם זמינים כרגע."),
    "ha_unavailable": ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True),
    "bridge_missing": ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את גשר SMPLWISE מותקן ומצומד."),
    "bridge_unpaired": ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את גשר SMPLWISE מותקן ומצומד."),
    "bridge_too_old": ApiError(503, "bridge_too_old", "נדרש עדכון של רכיב החיבור כדי לשמור תזמונים."),
}


def reset_limits() -> None:
    """Tests: forget the rate limits and the run gaps."""
    with _RATE_LOCK:
        _RATE.clear()
        _LAST_RUN.clear()


def rate_limit(user_id: str, kind: str, limit: int) -> None:
    now = time.monotonic()
    with _RATE_LOCK:
        hits = [t for t in _RATE.get((user_id, kind), []) if now - t < 60.0]
        if len(hits) >= limit:
            _RATE[(user_id, kind)] = hits
            raise ApiError(429, "rate_limited", "יותר מדי שינויים ברצף; נסו שוב בעוד רגע.", retryable=True)
        hits.append(now)
        _RATE[(user_id, kind)] = hits


# ---------------------------------------------------------------- the writer

class W:
    """One write request: the caller, the connection, the context (rights, entities) and the audit trail."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, settings: Any, request_id: str | None = None) -> None:
        self.conn, self.principal, self.settings, self.request_id = conn, principal, settings, request_id
        self.ctx = view.Ctx(conn, principal)
        self.details: dict[str, Any] = {}

    # -- audit

    def audit(self, action: str, decision: str, schedule_id: str | None, reason: str | None = None, **extra: Any) -> None:
        if decision == "allowed":
            self._note_grants(extra.get("entities") or self.details.get("entities") or [])
        audit(self.conn, actor=self.principal, action=action, decision=decision, resource_type="schedule", resource_id=schedule_id, reason=reason, request_id=self.request_id,
              details={**self.details, **extra})

    def _note_grants(self, entity_ids: list[str]) -> None:
        """T055: an allowed row names the binding, role and scope it was authorised under - the schedule.manage grant at the
        first action entity (and schedule.sensitive at the first sensitive one), noted last-wins for `audit`."""
        a = self.ctx.access
        sensitive = next((e for e in entity_ids if (self.ctx.entity(e) or {}).get("class") in policy.SENSITIVE_CLASSES), None)
        if sensitive:
            note_grant(a.decision(view.SENSITIVE, sensitive), view.SENSITIVE)
        note_grant(a.decision(view.MANAGE, entity_ids[0]) if entity_ids else authorize(self.conn, self.principal, view.MANAGE, INSTALLATION), view.MANAGE)

    @contextmanager
    def audited(self, action: str, schedule_id: str | None = None) -> Iterator[None]:
        """Every refusal inside is an audited `denied` row with the ApiError code (never a value of service data)."""
        try:
            yield
        except ApiError as exc:
            self.audit(action, "denied", schedule_id, exc.code, status=exc.status)
            raise

    # -- gates

    def require_manage(self) -> None:
        held = set(view.permissions_anywhere(self.conn, self.principal))
        if view.MANAGE not in held:
            require(self.conn, self.principal, view.MANAGE, INSTALLATION)

    def feature_on(self) -> None:
        if self.ctx.cfg["schedules.enabled"] != "true":
            raise ApiError(409, "feature_disabled", "התזמונים כבויים בהגדרות המערכת.")

    def writable(self) -> None:
        ok, block = self.ctx.write_state()
        if not ok:
            raise BRIDGE_UNAVAILABLE[block or "ha_unavailable"]

    def rate(self) -> None:
        rate_limit(self.principal.user_id, "write", WRITES_PER_MIN)


# ---------------------------------------------------------------- rights -> errors

def reason_error(r: dict[str, Any]) -> ApiError:
    code = r["code"]
    if code in RIGHTS_ERRORS:
        status, name, msg = RIGHTS_ERRORS[code]
        return ApiError(status, name, msg, details={"entity_id": r.get("entity_id")} if r.get("entity_id") else {})
    if r.get("_remote"):
        return ApiError(403, r["_remote"], r["message"])
    if code == "entity_not_controllable":
        return ApiError(403, "entity_not_controllable", r["message"], details={"entity_id": r.get("entity_id")})
    if code == "grant_required":
        return ApiError(403, "grant_required", r["message"], details={"entity_id": r.get("entity_id")})
    return ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")


def problem_error(errors: list[dict[str, str]]) -> ApiError:
    """The 422 for a list of validation problems: the first promoted code names the error, else `validation`; the full
    list stays in `details.errors` (path / code / message)."""
    for p in errors:
        if p["code"] in PROMOTED:
            status, msg = PROMOTED[p["code"]]
            return ApiError(status, p["code"], msg, details={"errors": errors, "path": p["path"]})
    first = errors[0]
    return ApiError(422, "validation", f"ערך לא תקין — {first['path']}: {first['message']}", details={"errors": errors})


# ---------------------------------------------------------------- draft evaluation

class Evaluation:
    def __init__(self) -> None:
        self.errors: list[dict[str, str]] = []
        self.warnings: list[dict[str, str]] = []
        self.denials: list[ApiError] = []
        self.sensitive = False
        self.lowering = False
        self.classes: list[str] = []
        self.entities: list[str] = []
        self.pairs: list[tuple[str, str, str]] = []  # (service, entity, class)


def evaluate(w: W, draft: dict[str, Any], old_core: dict[str, Any] | None, *, creating: bool, inherited_days: list[str] | None = None) -> Evaluation:
    """Validation (422 problems as data) then the caller's rights over the draft's actions and the locked-condition rule
    (403 denials as ApiErrors). Nothing is raised here: the caller chooses (POST raises, preview reports). Entities are
    looked up as the CALLER sees them (`view.ScopedCtx`): one they cannot read is `entity_unknown`."""
    ctx = w.ctx
    sctx = view.ScopedCtx(ctx)
    ev = Evaluation()
    for slot in draft.get("slots") or []:
        for a in slot.get("actions") or []:
            if a.get("entity_id"):
                ctx.preload([a["entity_id"]])
    ctx.preload([c["entity_id"] for c in (draft.get("conditions") or {}).get("items") or [] if c.get("entity_id")])
    ev.errors, ev.warnings = model.validate_draft(draft, sctx, old=old_core, creating=creating, inherited_days=inherited_days)
    lock = condition_lock(ctx, old_core, draft)
    if lock is not None:  # a locked / unreadable condition is a 403 of its own, not "unknown entity"
        ev.errors = [e for e in ev.errors if not (e["code"] == "entity_unknown" and e["path"].startswith("conditions.items"))]
    classes: list[str] = []
    for slot in draft.get("slots") or []:
        for a in slot.get("actions") or []:
            eid = a.get("entity_id")
            info = sctx.entity(eid) if eid else None
            cls = info["class"] if info else None
            if not eid or cls is None or not policy.service_allowed(cls, a.get("service") or ""):
                continue
            if eid not in ev.entities:
                ev.entities.append(eid)
            pair = (a["service"], eid, cls)
            if pair not in ev.pairs:
                ev.pairs.append(pair)
            if cls not in classes:
                classes.append(cls)
            if policy.is_lowering(a["service"], cls, a.get("data") or {}):
                ev.lowering = True
    ev.classes = [c for c in policy.ALL_CLASSES if c in classes]
    ev.sensitive = any(c in policy.SENSITIVE_CLASSES for c in ev.classes)
    if ev.errors:
        return ev
    seen: set[str] = set()
    for service, eid, cls in ev.pairs:
        for r in view.action_reasons(ctx, service, eid, cls, strict=True):
            if r["code"] == "class_disabled":
                continue  # a class switched off is a validation error for new content (validate_draft), tolerated when unchanged
            key = f"{r['code']}|{eid}"
            if key not in seen:
                seen.add(key)
                ev.denials.append(reason_error(r))
    if lock is not None:
        ev.denials.append(lock)
    return ev


def _cond_key(c: dict[str, Any]) -> str:
    return model.canonical({"entity_id": c.get("entity_id"), "attribute": c.get("attribute") or "state", "match_type": c.get("match_type") or "is", "value": c.get("value")})


def condition_lock(ctx: view.Ctx, old_core: dict[str, Any] | None, draft: dict[str, Any]) -> ApiError | None:
    """§4.4: a condition whose entity the caller may not read is locked - it must reach the bridge unchanged (and `type` /
    `track` with it), else 403 `condition_locked`, and while one exists a condition may only be ADDED under "all of them"
    (review L7). A new condition needs a readable entity: for the caller anything else is an unknown entity (review L5)."""
    a = ctx.access

    def readable(eid: str) -> bool:
        return eid == ctx.shabbat_sensor or a.can_read_state(eid)

    block = draft.get("conditions") or {}
    new_items = block.get("items") or []
    new_keys = {_cond_key(c) for c in new_items}
    old_items = old_core["conditions"]["items"] if old_core else []
    old_keys = {_cond_key(c) for c in old_items}
    for c in old_items:
        if c.get("entity_id") and not readable(c["entity_id"]):
            name = ctx.name_of(c["entity_id"])
            msg = f"התנאי \"{name}\" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו."
            if _cond_key(c) not in new_keys:
                return ApiError(403, "condition_locked", msg, details={"entity_id": c["entity_id"]})
            new_type = block.get("type") or ("or" if new_items else None)
            if new_type != old_core["conditions"]["type"] or bool(block.get("track")) != bool(old_core["conditions"]["track"]):  # type: ignore[index]
                return ApiError(403, "condition_locked", msg, details={"entity_id": c["entity_id"]})
    added = [c for c in new_items if _cond_key(c) not in old_keys]
    # a NEW condition on an entity the caller cannot read is `entity_unknown` (validate_draft, review L5): no 403 that
    # confirms the entity exists and no friendly name for it
    locked = next((c for c in old_items if c.get("entity_id") and not readable(c["entity_id"])), None)
    if locked is not None and added and (block.get("type") or "or") != "and":
        # review L7: with "any of them" a readable condition that is always true (the sun) would defeat the locked one
        name = ctx.name_of(locked["entity_id"])
        return ApiError(403, "condition_locked", f"התנאי \"{name}\" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו.", details={"entity_id": locked["entity_id"]})
    return None


def requires_of(w: W, ev: Evaluation) -> dict[str, bool]:
    """§3.5 `requires`: whether this draft needs the sensitive permission, a lowering confirmation, an alarm code (the
    caller's own policy asks for one for an alarm action in it)."""
    need_code = bool(alarm_code_targets(w, [(s, e, c) for s, e, c in ev.pairs]))
    return {"sensitive_permission": ev.sensitive, "confirm_lowering": ev.lowering, "alarm_code": need_code}


def alarm_code_targets(w: W, pairs: list[tuple[str, str, str]]) -> list[tuple[str, str]]:
    """The (panel, arm | disarm) pairs whose creator code the caller must type: their own policy for that action is a
    code that can be verified here (`routers/alarm.code_plan_for`)."""
    from ..routers import alarm as alarm_router

    out: list[tuple[str, str]] = []
    for service, eid, cls in pairs:
        if cls != "alarm":
            continue
        kind = "disarm" if service == policy.LOWERING_ARM_OFF else "arm"
        if (eid, kind) in out:
            continue
        plan = alarm_router.code_plan_for(w.conn, w.principal, eid, kind)
        if plan["prompt"] in ("pin", "pin_missing", "unverifiable") or (plan["prompt"] == "panel" and plan["send"] != "typed"):
            out.append((eid, kind))
    return out


def verify_creator_codes(w: W, pairs: list[tuple[str, str, str]], typed: Any) -> None:
    """§5.6: verify the caller's OWN code for each alarm action (once per PIN / per panel code), then discard it. The
    alarm router's gate raises `code_required` (409), `wrong_code` (403) and `code_locked` (429)."""
    from ..routers import alarm as alarm_router

    done: set[str] = set()
    for eid, kind in alarm_code_targets(w, pairs):
        plan = alarm_router.code_plan_for(w.conn, w.principal, eid, kind)
        key = "pin" if plan["prompt"] == "pin" else f"{plan['prompt']}:{eid}:{kind}"
        if key in done:
            continue
        alarm_router.verify_code_for(w.conn, w.principal, w.settings, eid, kind, typed)
        done.add(key)
    typed = None  # noqa: F841 - never kept, logged or audited


def check_lowering(ev_lowering: bool, confirm: bool) -> None:
    if ev_lowering and confirm is not True:
        raise ApiError(409, "lowering_confirmation_required", "תזמון שמנטרל אזעקה, פותח נעילה, דלת או שער דורש אישור מפורש.")


# ---------------------------------------------------------------- the bridge

def _safe(text: Any) -> str:
    return re.sub(r"[^A-Za-z0-9_.\-]", "", str(text or ""))[:60] or "error"


def bridge_call(w: W, op: str, op_id: str, *, schedule_id: str | None = None, schedule_entity_id: str | None = None, payload: dict[str, Any] | None = None, name: str | None = None,
                time_: str | None = None, skip_conditions: bool = False, sensitive: bool = False) -> dict[str, Any]:
    """One signed `smplwise_bridge.schedule` call, made with the request's write lock released. Never retried. A transport
    failure or an `ok: false` answer settles the op and raises (504 `scheduler_timeout` leaves it `unknown`)."""
    secret = ha_bridge.signing_key(w.conn)
    body = {"user_id": w.principal.user_id, "op": op, "request_id": op_id, "schedule_id": schedule_id, "schedule_entity_id": schedule_entity_id, "payload": payload or {},
            "name": name, "time": time_, "skip_conditions": bool(skip_conditions), "sensitive": bool(sensitive)}
    signed = ha_bridge.sign(secret or "", body)
    tr = store.get_transport()
    try:
        with unlocked(w.conn):
            resp = tr.bridge(signed)
    except ApiError as exc:
        if exc.code == "scheduler_timeout":
            store.finish_op(w.conn, op_id, "unknown")  # the op keeps its name / fingerprint: the next pull may adopt what was made
        else:
            store.finish_op(w.conn, op_id, "failed", error=exc.code)
        raise
    finally:
        signed = None  # noqa: F841
    if not isinstance(resp, dict) or not resp.get("ok"):
        err = _safe((resp or {}).get("error") if isinstance(resp, dict) else "bad_answer")
        store.finish_op(w.conn, op_id, "failed", error=err)
        raise ApiError(502, "scheduler_refused", "רכיב התזמונים דחה את השינוי.", details={"error": err, "path": (resp or {}).get("path") if isinstance(resp, dict) else None})
    return resp


def _known_ids(w: W) -> set[str]:
    return {r[0] for r in w.conn.execute("SELECT schedule_id FROM schedule_cache").fetchall()}


def learn(w: W, resp: dict[str, Any], expected: dict[str, Any], before: set[str]) -> tuple[str, str | None] | None:
    """The id the bridge reports for a schedule it just made is trusted only when it names a schedule that did not exist
    before the call and whose content (name, days, slots, conditions) is what Arx sent; anything else is `id_unknown` and
    is never used to record an owner, disable, roll back or show a schedule (review M2)."""
    sid = resp.get("schedule_id")
    if not sid:
        return _learn_by_diff(w, expected, before)
    if not isinstance(sid, str) or sid in before:
        return None
    try:
        item = store.MIRROR.fetch_item(sid, w.conn)
    except ApiError:
        return None
    if item is None or model.fingerprint(item) != model.fingerprint(expected):
        return None
    entity = item.get("entity_id") if isinstance(item.get("entity_id"), str) else resp.get("entity_id")
    return sid, entity


def _learn_by_diff(w: W, expected: dict[str, Any], before: set[str]) -> tuple[str, str | None] | None:
    """The component's add / copy return nothing (no `return_response`, verified), so a new id is learned by DIFF: the
    component's own list (WS `scheduler`) shows the new item immediately, faster than the registry. The ONE new item whose
    content is what Arx sent is that schedule; none or several is `id_unknown`."""
    try:
        store.MIRROR.pull(w.conn, "learn")
    except ApiError:
        return None
    fp = model.fingerprint(expected)
    found = [r for r in store.cache_rows(w.conn) if r["schedule_id"] not in before and model.fingerprint(store.item_of(r)) == fp]
    if len(found) != 1:
        return None
    return found[0]["schedule_id"], found[0]["entity_id"]


def _unknown(w: W, op_id: str, meta: dict[str, Any], action: str) -> tuple[int, dict[str, Any]]:
    """The outcome is unknown (no id the add-on can verify): the op keeps what it asked for (`meta`, `enabled` included, so an
    adoption can finish it), and the attempt is audited like any other write (review R1)."""
    store.finish_op(w.conn, op_id, "unknown", error=json.dumps({**meta, "error": "id_unknown"}, ensure_ascii=False))
    w.audit(action, "allowed", None, "id_unknown", op_id=op_id)
    return 202, {"status": "unknown", "op_id": op_id, "message": "התזמון נשלח; יופיע ברשימה לאחר אישור."}


def keep_disabled(w: W, op_id: str, schedule_id: str, entity_id: str | None, sensitive: bool) -> list[dict[str, str]]:
    """Owner rule: only a CREATE is enabled by default. A schedule that was disabled before an edit / split / copy must be
    disabled after it. Whether the component's `edit` keeps a disabled schedule disabled is UNVERIFIED (the phase-0 edits were
    made on enabled schedules), so the state is read back and, when it is enabled, the disable is re-applied through the
    ordinary bridge path. A failure is returned as a warning and stays in the review as `requested_disabled`."""
    row = store.cache_row(w.conn, schedule_id)
    if row is None or not model.normalize(store.item_of(row))["enabled"]:
        return []
    sub_id, _ = store.begin_op(w.conn, w.principal, f"{op_id}:keep-disabled", "keep_disabled", schedule_id)  # its own record: a refusal must not overwrite the parent op
    try:
        bridge_call(w, "disable", sub_id, schedule_id=schedule_id, schedule_entity_id=entity_id, sensitive=sensitive)
        store.finish_op(w.conn, sub_id, "ok", schedule_id=schedule_id)
        reread(w, schedule_id)
        return []
    except ApiError as exc:
        w.audit("schedule.disable", "denied", schedule_id, exc.code)
        return [{"path": "enabled", "code": "not_disabled", "message": "התזמון היה מושבת אך נשאר פעיל אחרי השינוי; השביתו אותו ידנית."}]


def reread(w: W, schedule_id: str) -> sqlite3.Row | None:
    """A fresh read of the schedule after a write (the cache row); a failed re-read keeps what the cache had."""
    try:
        store.MIRROR.fetch_item(schedule_id, w.conn)
    except ApiError:
        pass
    return store.cache_row(w.conn, schedule_id)


def schedule_view_of(w: W, row: sqlite3.Row, *, detail: bool = False) -> dict[str, Any]:
    w.ctx.preload(model.action_entities(model.normalize(store.item_of(row))) + [row["entity_id"] or ""])
    meta = store.meta_rows(w.conn).get(row["schedule_id"])
    runs = view.last_runs(w.conn, [row["schedule_id"]])
    return view.build_schedule(w.ctx, row, meta, runs.get(row["schedule_id"]), detail=detail)


def op_details(w: W, op_id: str, ev: "Evaluation | None", revision_before: str | None, revision_after: str | None, conditions: list[str] | None = None, diff: dict[str, Any] | None = None) -> dict[str, Any]:
    d: dict[str, Any] = {"op_id": op_id, "revision_before": revision_before, "revision_after": revision_after}
    if ev is not None:
        d.update(entities=ev.entities, classes=ev.classes, sensitive=ev.sensitive, lowering=ev.lowering)
    if conditions is not None:
        d["conditions"] = conditions
    if diff is not None:
        d["diff"] = diff
    return d


def cond_entities(draft: dict[str, Any]) -> list[str]:
    return [c["entity_id"] for c in (draft.get("conditions") or {}).get("items") or [] if c.get("entity_id")]


# ---------------------------------------------------------------- lookups

def find_visible(w: W, schedule_id: str) -> tuple[sqlite3.Row, dict[str, Any]]:
    """The cached schedule the caller may see, else 404 `schedule_not_found` (invisible = unknown)."""
    row = store.cache_row(w.conn, schedule_id)
    if row is None:
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    core = model.normalize(store.item_of(row))
    w.ctx.preload(model.action_entities(core) + [c["entity_id"] for c in core["conditions"]["items"] if c["entity_id"]])
    if not view.is_visible(w.ctx, core):
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    return row, core


def fresh(w: W, schedule_id: str) -> tuple[dict[str, Any], sqlite3.Row, dict[str, Any]]:
    """The current item straight from the component (writes are decided on a fresh read, never on the cache)."""
    item = store.MIRROR.fetch_item(schedule_id, w.conn)
    if item is None:
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    row = store.cache_row(w.conn, schedule_id)
    core = model.normalize(item)
    w.ctx.preload(model.action_entities(core) + [c["entity_id"] for c in core["conditions"]["items"] if c["entity_id"]])
    if not view.is_visible(w.ctx, core):
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    return item, row, core  # type: ignore[return-value]


def old_rights(w: W, core: dict[str, Any], cls: dict[str, Any], *, strict: bool = True) -> None:
    """The caller's rights over the CURRENT content: the first missing one is the error. Not understood content is never
    edited (422 `unsupported_content`)."""
    for r in view.core_reasons(w.ctx, core, cls, strict=strict):
        raise reason_error(r)


def snapshot_entities(w: W, core: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for e in model.action_entities(core):
        info = w.ctx.entity(e)
        out.append({"entity_id": e, "name": info["name"] if info else e, "domain": e.split(".", 1)[0], "role": "action", "area_id": info["area_id"] if info else None,
                    "area_name": info["area_name"] if info else None, "floor_id": info["floor_id"] if info else None, "floor_name": info["floor_name"] if info else None,
                    "class": info["class"] if info else None, "sensitive": bool(info and info["class"] in policy.SENSITIVE_CLASSES), "available": bool(info and info["available"])})
    return out


def draft_from_core(core: dict[str, Any]) -> dict[str, Any]:
    """A read schedule as a draft (stored strings kept)."""
    return {
        "name": core["name"] or "", "weekdays": list(core["weekdays"]), "start_date": core["start_date"], "end_date": core["end_date"], "repeat": core["repeat"], "tags": list(core["tags"]),
        "conditions": {"items": [dict(c) for c in core["conditions"]["items"]], "type": core["conditions"]["type"], "track": core["conditions"]["track"]},
        "slots": [{"start": s["start"]["raw"], "stop": s["stop"]["raw"] if s["stop"] else None,
                   "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": dict(a["data"])} for a in s["actions"]]} for s in core["slots"]],
    }


# ---------------------------------------------------------------- replays (idempotency)

MISMATCH = ApiError(409, "idempotency_conflict", "מפתח הבקשה כבר שימש לפעולה אחרת; שלחו בקשה עם מפתח חדש.")


def visible_view(w: W, row: sqlite3.Row) -> dict[str, Any]:
    """The schedule as the caller may see it - 404 when a reduced-rights caller (or a schedule that turned out hidden) may not."""
    core = model.normalize(store.item_of(row))
    w.ctx.preload(model.action_entities(core) + [c["entity_id"] for c in core["conditions"]["items"] if c["entity_id"]])
    if not view.is_visible(w.ctx, core):
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    return schedule_view_of(w, row)


def replay(w: W, prev: sqlite3.Row, shape: str, op: str, schedule_id: str | None = None, meta: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    """A repeated client_request_id answers as the first request did - but only for the SAME operation on the SAME schedule
    (`op`, `schedule_id`, and `meta` fields of the op's record), and never shows more than the caller may see NOW."""
    if prev["op"] != op or (schedule_id is not None and prev["schedule_id"] != schedule_id):
        raise MISMATCH
    for key, value in (meta or {}).items():
        if store._op_field(prev, key) != value:
            raise MISMATCH
    status = prev["status"]
    if status == "pending":
        raise ApiError(409, "op_pending", "הבקשה הקודמת עדיין מתבצעת.", retryable=True)
    if status == "failed":
        raise ApiError(409, "op_failed", "הבקשה הקודמת נכשלה; שלחו בקשה חדשה.", details={"error": _safe(prev["error"])})
    if status == "unknown":
        return 202, {"status": "unknown", "op_id": prev["id"], "message": "התזמון נשלח; יופיע ברשימה לאחר אישור."}
    if shape == "run":
        return 202, {"run_id": prev["id"], "note": "הבקשה נשלחה; התוצאה תופיע בהרצות."}
    row = store.cache_row(w.conn, prev["schedule_id"]) if prev["schedule_id"] else None
    if row is None:
        return 200, {"status": "ok", "op_id": prev["id"]}
    sched = visible_view(w, row)
    if shape == "enable":
        return 200, {"schedule": sched, "changed": True}
    return (201 if shape == "create" else 200), {"schedule": sched, "op_id": prev["id"]}


def _begin(w: W, client_request_id: str, op: str, schedule_id: str | None, shape: str, error: dict[str, Any] | None = None, meta: dict[str, Any] | None = None) -> tuple[str, tuple[int, dict[str, Any]] | None]:
    """Record the operation before anything is sent. When another request with this key got in between the first look and
    now (the write lock is released around the fresh read), its answer is this request's: (op id, that answer) - the bridge
    is never called twice for one key (review L4)."""
    op_id, prev = store.begin_op(w.conn, w.principal, client_request_id, op, schedule_id, error=json.dumps(error, ensure_ascii=False) if error else None)
    if prev is not None:
        return op_id, replay(w, prev, shape, op, schedule_id, meta)
    return op_id, None


def _prev(w: W, client_request_id: str) -> sqlite3.Row | None:
    return w.conn.execute("SELECT * FROM schedule_ops WHERE principal_user_id = ? AND client_request_id = ?", (w.principal.user_id, client_request_id)).fetchone()


# ---------------------------------------------------------------- create (§3.6)

def _created(w: W, row: sqlite3.Row | None, op_id: str, warnings: list[dict[str, str]] | None = None) -> tuple[int, dict[str, Any]]:
    """The 201 answer for a schedule Arx made: shown only when the caller may see it (else the outcome is `unknown`)."""
    if row is not None:
        try:
            sched = visible_view(w, row)
        except ApiError:
            row = None
    if row is None:
        return 202, {"status": "unknown", "op_id": op_id, "message": "התזמון נשלח; יופיע ברשימה לאחר אישור."}
    sched["warnings"] = sched["warnings"] + (warnings or [])
    return 201, {"schedule": sched, "op_id": op_id}


def create(w: W, draft: dict[str, Any], enabled: bool, client_request_id: str, confirm_lowering: bool, alarm_code: Any) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.create"):
        w.feature_on()
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "create", "create")
        w.rate()
        w.writable()
        ev = evaluate(w, draft, None, creating=True)
        if ev.errors:
            raise problem_error(ev.errors)
        if ev.denials:
            raise ev.denials[0]
        w.details.update(entities=ev.entities, classes=ev.classes, sensitive=ev.sensitive, lowering=ev.lowering, conditions=cond_entities(draft))
        check_lowering(ev.lowering, confirm_lowering)
        verify_creator_codes(w, ev.pairs, alarm_code)
        alarm_code = None
        payload = model.to_component_payload(draft, None)
        meta = {"name": draft.get("name") or "", "fp": model.fingerprint(payload), "enabled": bool(enabled)}
        op_id, again = _begin(w, client_request_id, "create", None, "create", meta)
        if again:
            return again
        before = _known_ids(w)
        resp = bridge_call(w, "add", op_id, payload=payload, sensitive=ev.sensitive)
        learned = learn(w, resp, payload, before)
        if learned is None:
            return _unknown(w, op_id, meta, "schedule.create")
        sid, entity = learned
        warnings: list[dict[str, str]] = []
        if not enabled:
            try:
                bridge_call(w, "disable", op_id, schedule_id=sid, schedule_entity_id=entity, sensitive=ev.sensitive)
            except ApiError as exc:
                warnings.append({"path": "enabled", "code": "not_disabled", "message": "התזמון נוצר אך לא הושבת; השביתו אותו ידנית."})
                w.audit("schedule.disable", "denied", sid, exc.code)
        row = reread(w, sid)
        store.finish_op(w.conn, op_id, "ok", schedule_id=sid)
        store.note_arx_write(w.conn, sid, w.principal, created=True)
        w.audit("schedule.create", "allowed", sid, **op_details(w, op_id, ev, None, row["revision"] if row is not None else None, cond_entities(draft), model.diff_summary(None, draft)))
        return _created(w, row, op_id, warnings)


# ---------------------------------------------------------------- update (§3.7)

def update(w: W, schedule_id: str, draft: dict[str, Any], base_revision: str, client_request_id: str, confirm_lowering: bool, alarm_code: Any) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.update", schedule_id):
        w.feature_on()
        find_visible(w, schedule_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "update", "update", schedule_id)
        w.rate()
        w.writable()
        item, row, core = fresh(w, schedule_id)
        cls = model.classify(core, w.ctx.resolver)
        if not cls["understood"]:
            raise ApiError(422, "unsupported_content", "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.")
        old_rights(w, core, cls)
        revision = row["revision"]
        if base_revision != revision:
            current = schedule_view_of(w, row)
            raise ApiError(409, "schedule_changed", "התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.",
                           details={"current": current, "base_revision": base_revision, "current_revision": revision})
        ev = evaluate(w, draft, core, creating=False)
        if ev.errors:
            raise problem_error(ev.errors)
        if ev.denials:
            raise ev.denials[0]
        diff = model.diff_summary(core, draft)
        w.details.update(entities=ev.entities, classes=ev.classes, sensitive=ev.sensitive, lowering=ev.lowering, conditions=cond_entities(draft))
        check_lowering(ev.lowering, confirm_lowering)
        verify_creator_codes(w, ev.pairs, alarm_code)
        alarm_code = None
        payload = model.to_component_payload(draft, item)
        if not payload:
            return 200, {"schedule": schedule_view_of(w, row), "op_id": None}
        op_id, again = _begin(w, client_request_id, "update", schedule_id, "update", None if core["enabled"] else {"enabled": False})
        if again:
            return again
        bridge_call(w, "edit", op_id, schedule_id=schedule_id, schedule_entity_id=core["entity_id"], payload=payload, sensitive=ev.sensitive)
        new_row = reread(w, schedule_id)
        warnings = [] if core["enabled"] else keep_disabled(w, op_id, schedule_id, core["entity_id"], ev.sensitive)
        new_row = store.cache_row(w.conn, schedule_id) or new_row
        store.finish_op(w.conn, op_id, "ok", schedule_id=schedule_id)
        store.note_arx_write(w.conn, schedule_id, w.principal)
        w.audit("schedule.update", "allowed", schedule_id, **op_details(w, op_id, ev, revision, new_row["revision"] if new_row is not None else None, cond_entities(draft), diff))
        sched = schedule_view_of(w, new_row if new_row is not None else row)
        sched["warnings"] = sched["warnings"] + warnings
        return 200, {"schedule": sched, "op_id": op_id}


# ---------------------------------------------------------------- enable / disable (§3.8)

def set_enabled(w: W, schedule_id: str, enable: bool, client_request_id: str, confirm_lowering: bool, alarm_code: Any, *, bulk: bool = False) -> tuple[int, dict[str, Any]]:
    action = "schedule.enable" if enable else "schedule.disable"
    w.require_manage()
    with w.audited(action, schedule_id):
        w.feature_on()
        find_visible(w, schedule_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "enable", "enable" if enable else "disable", schedule_id)
        if not bulk:
            w.rate()  # a bulk request is counted once, by bulk()
        w.writable()
        item, row, core = fresh(w, schedule_id)
        cls = model.classify(core, w.ctx.resolver)
        wide = w.ctx.access.wide(view.MANAGE)
        if not cls["understood"]:
            if enable:
                raise ApiError(422, "unsupported_content", "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.")
            if not wide:
                raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")
        else:
            old_rights(w, core, cls, strict=enable)
        if core["enabled"] == enable:
            return 200, {"schedule": schedule_view_of(w, row), "changed": False}
        pairs = _pairs(w, core, cls)
        w.details.update(entities=model.action_entities(core), classes=cls["sensitive_classes"], sensitive=cls["sensitive"], lowering=cls["lowering"], bulk=bulk)
        if enable:
            check_lowering(cls["lowering"], confirm_lowering)
            verify_creator_codes(w, pairs, alarm_code)
            alarm_code = None
        op_id, again = _begin(w, client_request_id, "enable" if enable else "disable", schedule_id, "enable")
        if again:
            return again
        bridge_call(w, "enable" if enable else "disable", op_id, schedule_id=schedule_id, schedule_entity_id=core["entity_id"], sensitive=cls["sensitive"])
        new_row = reread(w, schedule_id)
        store.finish_op(w.conn, op_id, "ok", schedule_id=schedule_id)
        store.note_arx_write(w.conn, schedule_id, w.principal)
        w.audit(action, "allowed", schedule_id, **op_details(w, op_id, None, row["revision"], new_row["revision"] if new_row is not None else None))
        return 200, {"schedule": schedule_view_of(w, new_row if new_row is not None else row), "changed": True}


def _pairs(w: W, core: dict[str, Any], cls: dict[str, Any]) -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    for si, slot in enumerate(core["slots"]):
        for ai, a in enumerate(slot["actions"]):
            res = cls["slots"][si]["actions"][ai]
            if res["supported"] and a["entity_id"] and res["class"]:
                t = (a["service"], a["entity_id"], res["class"])
                if t not in out:
                    out.append(t)
    return out


# ---------------------------------------------------------------- run now (§3.9)

def _slot_time(core: dict[str, Any], index: int, w: W) -> str:
    spec = core["slots"][index]["start"]
    if spec["kind"] == "fixed":
        return policy.canonical_time(spec["raw"]) or spec["raw"]
    secs = model.slot_seconds(spec, w.ctx.sun_seconds())
    if secs is None:
        raise ApiError(422, "validation", "לא ניתן לחשב את שעת השקיעה / הזריחה להיום; אי אפשר להריץ את המשבצת עכשיו.")
    return f"{secs // 3600:02d}:{secs % 3600 // 60:02d}:{secs % 60:02d}"


def run(w: W, schedule_id: str, slot_index: int | None, skip_conditions: bool, confirm: bool, client_request_id: str, alarm_code: Any) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.run", schedule_id):
        w.feature_on()
        find_visible(w, schedule_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "run", "run", schedule_id)
        w.rate()
        w.writable()
        item, row, core = fresh(w, schedule_id)
        cls = model.classify(core, w.ctx.resolver)
        if not cls["understood"]:
            raise ApiError(422, "unsupported_content", "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.")
        old_rights(w, core, cls)
        if slot_index is None:
            if len(core["slots"]) != 1:
                raise ApiError(422, "slot_required", "בחרו איזו משבצת להריץ.")
            slot_index = 0
        if not 0 <= slot_index < len(core["slots"]):
            raise ApiError(422, "validation", "משבצת לא קיימת.", details={"path": "slot_index"})
        slot_res = cls["slots"][slot_index]
        pairs = [(a["service"], a["entity_id"], a["class"]) for a in slot_res["actions"] if a["entity_id"] and a["class"]]
        risky = any(ha_bridge.ACTIONS.get(s, {}).get("risk", "routine") != "routine" for s, _, _ in pairs) or any(a["sensitive"] for a in slot_res["actions"])
        if risky and confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        if skip_conditions:
            locked = [c for c in view.condition_views(w.ctx, core) if c["locked"]]
            if locked and not w.ctx.access.wide(view.MANAGE):
                raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")
        w.details.update(entities=[e for _, e, _ in pairs], classes=cls["sensitive_classes"], sensitive=cls["sensitive"], lowering=cls["lowering"], slot_index=slot_index, skip_conditions=bool(skip_conditions))
        verify_creator_codes(w, pairs, alarm_code)
        alarm_code = None
        with _RATE_LOCK:
            last = _LAST_RUN.get(schedule_id)
            now = time.monotonic()
            if last is not None and now - last < RUN_MIN_GAP_S:
                raise ApiError(429, "run_too_soon", "התזמון הורץ ממש עכשיו; נסו שוב בעוד כמה שניות.", retryable=True)
            _LAST_RUN[schedule_id] = now
        if not str(core["entity_id"] or "").startswith("switch."):
            raise ApiError(422, "validation", "לתזמון אין מתג; אי אפשר להריץ אותו.")  # the component answers a run of a missing entity with a silent success
        at = _slot_time(core, slot_index, w)
        op_id, again = _begin(w, client_request_id, "run", schedule_id, "run")
        if again:
            with _RATE_LOCK:
                _LAST_RUN.pop(schedule_id, None)
            return again
        try:
            bridge_call(w, "run", op_id, schedule_id=schedule_id, schedule_entity_id=core["entity_id"], time_=at, skip_conditions=skip_conditions, sensitive=cls["sensitive"])
        except ApiError:
            with _RATE_LOCK:
                _LAST_RUN.pop(schedule_id, None)
            raise
        store.finish_op(w.conn, op_id, "ok", schedule_id=schedule_id)
        run_id = store.record_run_now(w.conn, schedule_id, slot_index, cls["sensitive"])
        w.audit("schedule.run", "allowed", schedule_id, op_id=op_id, slot_index=slot_index, skip_conditions=bool(skip_conditions), entities=[e for _, e, _ in pairs], sensitive=cls["sensitive"])
        return 202, {"run_id": run_id, "note": "הבקשה נשלחה; התוצאה תופיע בהרצות."}


# ---------------------------------------------------------------- split (§3.10)

def _no_locked_conditions(w: W, core: dict[str, Any], verb: str) -> None:
    """A new schedule cannot carry a condition its creator may not read (review L5), so a copy / split / restore of a schedule with
    a locked condition is refused with the reason the caller can act on - the condition is visible to them by name."""
    for c in core["conditions"]["items"]:
        eid = c.get("entity_id")
        if eid and not (eid == w.ctx.shabbat_sensor or w.ctx.access.can_read_state(eid)):
            raise ApiError(403, "condition_locked", f"התנאי \"{w.ctx.name_of(eid)}\" מחוץ להרשאתך, ולכן אי אפשר {verb} את התזמון. פנו למי שמורשה לקרוא אותו.", details={"entity_id": eid})


def _same_op(prev: sqlite3.Row, op: str, schedule_id: str | None) -> None:
    if prev["op"] != op or (schedule_id is not None and prev["schedule_id"] != schedule_id):
        raise MISMATCH


def split(w: W, schedule_id: str, base_revision: str, days: list[str], name: str | None, confirm: bool, client_request_id: str, confirm_lowering: bool = False, alarm_code: Any = None) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.split", schedule_id):
        w.feature_on()
        find_visible(w, schedule_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            _same_op(prev, "split", schedule_id)
            if prev["status"] == "ok":
                created = store._op_field(prev, "created")
                orig, new = store.cache_row(w.conn, schedule_id), store.cache_row(w.conn, created) if created else None
                if orig is not None and new is not None:
                    return 200, {"original": visible_view(w, orig), "created": visible_view(w, new)}
            return replay(w, prev, "update", "split", schedule_id)
        w.rate()
        w.writable()
        item, row, core = fresh(w, schedule_id)
        cls = model.classify(core, w.ctx.resolver)
        if not cls["understood"]:
            raise ApiError(422, "unsupported_content", "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.")
        old_rights(w, core, cls)
        if row["revision"] != base_revision:
            raise ApiError(409, "schedule_changed", "התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.",
                           details={"current": schedule_view_of(w, row), "base_revision": base_revision, "current_revision": row["revision"]})
        resolved = model.resolve_days(core["weekdays"])
        if resolved is None:
            raise ApiError(422, "split_not_possible", "לא ניתן לפצל תזמון לפי ימי עבודה או סוף שבוע; בחרו ימים מפורשים תחילה.")
        moving = [d for d in model.DAY_ORDER if d in set(days)]
        if not moving or len(moving) != len(set(days)) or any(d not in resolved for d in moving) or len(moving) >= len(resolved):
            raise ApiError(422, "validation", "ימי הפיצול חייבים להיות קבוצה חלקית ולא ריקה של ימי התזמון.", details={"path": "days"})
        if confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        remaining = [d for d in resolved if d not in moving]
        new_name = ((name or "").strip() or f"{core['name'] or view.display_name(core, w.ctx)} · {' '.join(DAY_SHORT[d] for d in moving)}")[:model.MAX_NAME]
        # the new schedule is a CREATE: the same checks, code and confirmation as any other (review M1)
        _no_locked_conditions(w, core, "לפצל")
        nd = draft_from_core(core)
        nd.update(name=new_name, weekdays=moving)
        if not policy.CAPABILITIES["tags"]:
            nd["tags"] = []
        ev = evaluate(w, nd, None, creating=True)
        if ev.errors:
            raise problem_error(ev.errors)
        if ev.denials:
            raise ev.denials[0]
        w.details.update(entities=ev.entities, classes=ev.classes, sensitive=ev.sensitive, lowering=ev.lowering, moved_days=moving)
        check_lowering(ev.lowering, confirm_lowering)
        verify_creator_codes(w, ev.pairs, alarm_code)
        alarm_code = None
        new_payload = {"weekdays": moving, "timeslots": [model.component_slot(t) for t in item.get("timeslots") or [] if isinstance(t, dict)], "repeat_type": core["repeat"], "name": new_name}
        if core["start_date"]:
            new_payload["start_date"] = core["start_date"]
        if core["end_date"]:
            new_payload["end_date"] = core["end_date"]
        if core["tags"] and policy.CAPABILITIES["tags"]:
            new_payload["tags"] = list(core["tags"])
        meta = {"name": new_name, "fp": model.fingerprint(new_payload), "enabled": bool(core["enabled"]), "original": schedule_id, "before": list(core["weekdays"]), "remaining": remaining,
                "start_date": core["start_date"], "end_date": core["end_date"]}
        op_id, again = _begin(w, client_request_id, "split", schedule_id, "update", meta)
        if again:
            return again
        before = _known_ids(w)
        added = bridge_call(w, "add", op_id, payload=new_payload, sensitive=cls["sensitive"])
        learned = learn(w, added, new_payload, before)
        if learned is None:
            _unknown(w, op_id, meta, "schedule.split")
            raise ApiError(502, "split_incomplete", "הפיצול לא הושלם; בדקו את שני התזמונים.", details={"original_id": schedule_id, "created_id": None})
        new_id, new_entity = learned
        try:
            bridge_call(w, "edit", op_id, schedule_id=schedule_id, schedule_entity_id=core["entity_id"], payload={"weekdays": remaining, "start_date": core["start_date"], "end_date": core["end_date"]}, sensitive=cls["sensitive"])  # an edit without the dates wipes them
        except ApiError as exc:
            try:
                bridge_call(w, "remove", op_id, schedule_id=new_id, schedule_entity_id=new_entity, sensitive=cls["sensitive"])
                store.finish_op(w.conn, op_id, "failed", error=exc.code)
                reread(w, new_id)
            except ApiError:
                store.finish_op(w.conn, op_id, "failed", error="split_incomplete")
                raise ApiError(502, "split_incomplete", "הפיצול לא הושלם; בדקו את שני התזמונים.", details={"original_id": schedule_id, "created_id": new_id}) from None
            raise
        if not core["enabled"]:
            try:
                bridge_call(w, "disable", op_id, schedule_id=new_id, schedule_entity_id=new_entity, sensitive=cls["sensitive"])
            except ApiError:
                pass
        orig_row, new_row = reread(w, schedule_id), reread(w, new_id)
        if not core["enabled"]:  # both halves keep the source's state
            keep_disabled(w, op_id, schedule_id, core["entity_id"], cls["sensitive"])
            orig_row = store.cache_row(w.conn, schedule_id)
        store.finish_op(w.conn, op_id, "ok", error=json.dumps({**meta, "created": new_id}), schedule_id=schedule_id)
        store.note_arx_write(w.conn, schedule_id, w.principal)
        store.note_arx_write(w.conn, new_id, w.principal, created=True)
        w.audit("schedule.split", "allowed", schedule_id, **op_details(w, op_id, ev, row["revision"], orig_row["revision"] if orig_row is not None else None), created_id=new_id)
        if orig_row is None or new_row is None:
            raise ApiError(502, "split_incomplete", "הפיצול לא הושלם; בדקו את שני התזמונים.", details={"original_id": schedule_id, "created_id": new_id})
        return 200, {"original": visible_view(w, orig_row), "created": visible_view(w, new_row)}


# ---------------------------------------------------------------- delete, copy (§3.11, §3.12)

def delete(w: W, schedule_id: str, base_revision: str, confirm: bool, client_request_id: str) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.delete", schedule_id):
        w.feature_on()
        find_visible(w, schedule_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            _same_op(prev, "delete", schedule_id)
            if prev["status"] == "ok":
                t = w.conn.execute("SELECT id, expires_at FROM schedule_trash WHERE schedule_id = ? AND deleted_by = ? ORDER BY deleted_at DESC LIMIT 1", (schedule_id, w.principal.user_id)).fetchone()
                if t is not None:
                    return 200, {"trash_id": t["id"], "expires_at": t["expires_at"]}
            return replay(w, prev, "update", "delete", schedule_id)
        w.rate()
        w.writable()
        item, row, core = fresh(w, schedule_id)
        cls = model.classify(core, w.ctx.resolver)
        if cls["understood"]:
            old_rights(w, core, cls, strict=False)
        elif not w.ctx.access.wide(view.MANAGE):
            raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")
        if row["revision"] != base_revision:
            raise ApiError(409, "schedule_changed", "התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.",
                           details={"current": schedule_view_of(w, row), "base_revision": base_revision, "current_revision": row["revision"]})
        if confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.details.update(entities=model.action_entities(core), classes=cls["sensitive_classes"], sensitive=cls["sensitive"], lowering=cls["lowering"])
        meta = store.meta_rows(w.conn).get(schedule_id)
        op_id, again = _begin(w, client_request_id, "delete", schedule_id, "update")
        if again:
            return again
        trash_id, expires = store.trash_put(w.conn, item, meta, snapshot_entities(w, core), cls["sensitive"], w.principal)
        try:
            bridge_call(w, "remove", op_id, schedule_id=schedule_id, schedule_entity_id=core["entity_id"], sensitive=cls["sensitive"])
        except ApiError as exc:
            if exc.code != "scheduler_timeout":  # a definite refusal: nothing was removed, the snapshot goes too (a timeout keeps it)
                w.conn.execute("DELETE FROM schedule_trash WHERE id = ?", (trash_id,))
            raise
        store.MIRROR.drop(w.conn, schedule_id)
        store.finish_op(w.conn, op_id, "ok", schedule_id=schedule_id)
        ha_sync.publish({"type": "schedules_changed"})
        w.audit("schedule.delete", "allowed", schedule_id, **op_details(w, op_id, None, row["revision"], None), trash_id=trash_id)
        return 200, {"trash_id": trash_id, "expires_at": expires}


def copy(w: W, schedule_id: str, name: str, client_request_id: str, confirm_lowering: bool = False, alarm_code: Any = None) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.copy", schedule_id):
        w.feature_on()
        find_visible(w, schedule_id)
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "create", "copy", None, {"source": schedule_id})
        w.rate()
        w.writable()
        item, row, core = fresh(w, schedule_id)
        cls = model.classify(core, w.ctx.resolver)
        if not cls["understood"]:
            raise ApiError(422, "unsupported_content", "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.")
        old_rights(w, core, cls)
        name = (name or "").strip()
        if not name or len(name) > model.MAX_NAME or any(ord(c) < 32 for c in name):
            raise ApiError(422, "validation", f"שם: 1–{model.MAX_NAME} תווים, בלי תווי בקרה.", details={"path": "name"})
        # the copy is a CREATE: judged as a new schedule, with the creator's confirmation and code (review M1) - a legacy
        # disarm on a panel that needs a code cannot be copied into a new one
        _no_locked_conditions(w, core, "להעתיק")
        nd = draft_from_core(core)
        nd["name"] = name
        if not policy.CAPABILITIES["tags"]:
            nd["tags"] = []
        ev = evaluate(w, nd, None, creating=True, inherited_days=list(core["weekdays"]))
        if ev.errors:
            raise problem_error(ev.errors)
        if ev.denials:
            raise ev.denials[0]
        w.details.update(entities=ev.entities, classes=ev.classes, sensitive=ev.sensitive, lowering=ev.lowering)
        check_lowering(ev.lowering, confirm_lowering)
        verify_creator_codes(w, ev.pairs, alarm_code)
        alarm_code = None
        expected = {**item, "name": name}
        meta = {"name": name, "fp": model.fingerprint(expected), "source": schedule_id, "enabled": bool(core["enabled"])}
        op_id, again = _begin(w, client_request_id, "copy", None, "create", meta, {"source": schedule_id})
        if again:
            return again
        before = _known_ids(w)
        resp = bridge_call(w, "copy", op_id, schedule_id=schedule_id, schedule_entity_id=core["entity_id"], name=name, sensitive=cls["sensitive"])
        learned = learn(w, resp, expected, before)
        if learned is None:
            return _unknown(w, op_id, meta, "schedule.copy")
        sid, _entity = learned
        new_row = reread(w, sid)
        warnings = [] if core["enabled"] else keep_disabled(w, op_id, sid, _entity, cls["sensitive"])  # a copy of a disabled schedule stays disabled
        new_row = store.cache_row(w.conn, sid) or new_row
        store.finish_op(w.conn, op_id, "ok", schedule_id=sid)
        store.note_arx_write(w.conn, sid, w.principal, created=True)
        w.audit("schedule.copy", "allowed", sid, **op_details(w, op_id, ev, row["revision"], new_row["revision"] if new_row is not None else None), source_id=schedule_id)
        status, body = _created(w, new_row, op_id)
        return (status, {"schedule": body["schedule"]}) if status == 201 else (status, body)


# ---------------------------------------------------------------- trash (§3.13)

def trash_core(t: sqlite3.Row) -> dict[str, Any]:
    try:
        item = json.loads(t["item_json"])
    except ValueError:
        item = {}
    return model.normalize(item if isinstance(item, dict) else {})


def trash_visible(w: W, t: sqlite3.Row) -> bool:
    core = trash_core(t)
    w.ctx.preload(model.action_entities(core))
    return view.is_visible(w.ctx, core)


def trash_list(w: W) -> dict[str, Any]:
    items = []
    if not view.cache_shown(w.ctx):
        return {"items": items}  # the feature is off (or the component confirmed missing): nothing is listed
    for t in store.trash_rows(w.conn):
        if not trash_visible(w, t):
            continue
        core = trash_core(t)
        can = _can_restore(w, core)
        try:
            ents = json.loads(t["entities_json"] or "[]")
        except ValueError:
            ents = []
        items.append({"trash_id": t["id"], "schedule_id": t["schedule_id"], "name": t["name"] or None, "deleted_at": t["deleted_at"], "expires_at": t["expires_at"],
                      "deleted_by": {"username": t["deleted_by_username"] or "", "display_name": t["deleted_by_username"] or ""} if t["deleted_by"] else None,
                      "entities": ents, "sensitive": bool(t["sensitive"]), "can_restore": can})
    return {"items": items}


def _can_restore(w: W, core: dict[str, Any]) -> bool:
    if not w.ctx.writable:
        return False
    cls = model.classify(core, w.ctx.resolver)
    if not cls["understood"]:
        return False
    return not view.core_reasons(w.ctx, core, cls, strict=True)


def restore(w: W, trash_id: str, client_request_id: str, confirm_lowering: bool, alarm_code: Any) -> tuple[int, dict[str, Any]]:
    w.require_manage()
    with w.audited("schedule.restore", trash_id):
        w.feature_on()
        prev = _prev(w, client_request_id)
        if prev is not None:
            return replay(w, prev, "create", "restore", None, {"trash": trash_id})
        t = w.conn.execute("SELECT * FROM schedule_trash WHERE id = ? AND restored_at IS NULL AND expires_at > ?", (trash_id, store.stamp())).fetchone()
        if t is None or not trash_visible(w, t):
            raise ApiError(404, "trash_not_found", "הפריט אינו בסל המחזור (ייתכן שפג תוקפו).")
        w.rate()
        w.writable()
        core = trash_core(t)
        cls = model.classify(core, w.ctx.resolver)
        if not cls["understood"]:
            raise ApiError(422, "unsupported_content", "התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לשחזר אותו רק ברכיב המקורי.")
        draft = draft_from_core(core)
        if not policy.CAPABILITIES["tags"]:
            draft["tags"] = []  # the component's tag writing is unverified (P0-3): a restored schedule comes back without its tags
        _no_locked_conditions(w, core, "לשחזר")
        ev = evaluate(w, draft, None, creating=True, inherited_days=list(core["weekdays"]))
        if ev.errors:
            raise problem_error(ev.errors)
        if ev.denials:
            raise ev.denials[0]
        w.details.update(entities=ev.entities, classes=ev.classes, sensitive=ev.sensitive, lowering=ev.lowering, conditions=cond_entities(draft), trashed_schedule_id=t["schedule_id"])
        check_lowering(ev.lowering, confirm_lowering)
        verify_creator_codes(w, ev.pairs, alarm_code)
        alarm_code = None
        payload = model.to_component_payload(draft, None)
        meta = {"name": draft.get("name") or "", "fp": model.fingerprint(payload), "trash": trash_id, "enabled": bool(core["enabled"])}
        op_id, again = _begin(w, client_request_id, "restore", None, "create", meta, {"trash": trash_id})
        if again:
            return again
        # claim the trash item BEFORE the bridge is called: a second restore (another key) finds it gone (review L4)
        if w.conn.execute("UPDATE schedule_trash SET restored_at = ? WHERE id = ? AND restored_at IS NULL", (f"~restoring:{store.stamp()}", trash_id)).rowcount != 1:
            store.finish_op(w.conn, op_id, "failed", error="trash_not_found")
            raise ApiError(404, "trash_not_found", "הפריט אינו בסל המחזור (ייתכן שפג תוקפו).")
        before = _known_ids(w)
        try:
            resp = bridge_call(w, "add", op_id, payload=payload, sensitive=ev.sensitive)
        except ApiError as exc:
            w.conn.execute("UPDATE schedule_trash SET restored_at = ? WHERE id = ?", (None if exc.code != "scheduler_timeout" else f"~unknown:{store.stamp()}", trash_id))
            raise
        learned = learn(w, resp, payload, before)
        if learned is None:
            w.conn.execute("UPDATE schedule_trash SET restored_at = ? WHERE id = ?", (f"~unknown:{store.stamp()}", trash_id))  # released after the adoption window, or finalised by an adoption
            return _unknown(w, op_id, meta, "schedule.restore")
        sid, entity = learned
        if not core["enabled"]:
            try:
                bridge_call(w, "disable", op_id, schedule_id=sid, schedule_entity_id=entity, sensitive=ev.sensitive)
            except ApiError:
                pass
        row = reread(w, sid)
        store.finish_op(w.conn, op_id, "ok", schedule_id=sid)
        store.note_arx_write(w.conn, sid, w.principal, created=True)
        # the meta moves: folder, order and pin follow the schedule to its new id
        try:
            m = json.loads(t["meta_json"] or "{}") or {}
        except ValueError:
            m = {}
        folder = m.get("folder_id") if w.conn.execute("SELECT 1 FROM schedule_folders WHERE id = ?", (m.get("folder_id"),)).fetchone() else None
        w.conn.execute("UPDATE schedule_meta SET folder_id = ?, sort_key = ?, pinned = ? WHERE schedule_id = ?", (folder, m.get("sort_key"), int(m.get("pinned") or 0), sid))
        w.conn.execute("UPDATE schedule_trash SET restored_at = ?, restored_schedule_id = ? WHERE id = ?", (store.stamp(), sid, trash_id))
        w.audit("schedule.restore", "allowed", trash_id, **op_details(w, op_id, ev, None, row["revision"] if row is not None else None), restored_schedule_id=sid)
        status, body = _created(w, row, op_id)
        return (status, {"schedule": body["schedule"]}) if status == 201 else (status, body)


def purge(w: W, trash_id: str, confirm: bool) -> dict[str, Any]:
    w.require_manage()
    with w.audited("schedule.purge", trash_id):
        w.feature_on()
        if not w.ctx.access.wide(view.MANAGE):
            raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")
        t = w.conn.execute("SELECT * FROM schedule_trash WHERE id = ? AND restored_at IS NULL AND expires_at > ?", (trash_id, store.stamp())).fetchone()
        if t is None:
            raise ApiError(404, "trash_not_found", "הפריט אינו בסל המחזור (ייתכן שפג תוקפו).")
        if confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.conn.execute("DELETE FROM schedule_trash WHERE id = ?", (trash_id,))
        w.audit("schedule.purge", "allowed", trash_id, deleted_schedule_id=t["schedule_id"])
        return {"ok": True}


# ---------------------------------------------------------------- bulk (§3.14)

def bulk(w: W, op: str, ids: list[str], confirm: bool, client_request_id: str) -> dict[str, Any]:
    w.require_manage()
    with w.audited("schedule.bulk"):
        w.feature_on()
        if confirm is not True:
            raise ApiError(409, "confirmation_required", "פעולה זו דורשת אישור מפורש.")
        w.rate()
        w.writable()
        results: list[dict[str, Any]] = []
        enable = op == "enable"
        for i, sid in enumerate(dict.fromkeys(ids)):
            try:
                if enable:
                    row = store.cache_row(w.conn, sid)
                    if row is not None:
                        core = model.normalize(store.item_of(row))
                        if model.classify(core, w.ctx.resolver)["lowering"]:
                            raise ApiError(409, "lowering_confirmation_required", "תזמון שמנטרל אזעקה, פותח נעילה, דלת או שער דורש אישור מפורש.")
                key = hashlib.sha256(f"{client_request_id}|{i}|{sid}".encode("utf-8")).hexdigest()[:48]  # never truncated into a collision (review L3)
                _, out = set_enabled(w, sid, enable, key, False, None, bulk=True)
                results.append({"id": sid, "ok": True, "changed": bool(out.get("changed"))})
            except ApiError as exc:
                results.append({"id": sid, "ok": False, "code": exc.code, "message": exc.user_message})
        w.audit("schedule.bulk", "allowed", None, op=op, count=len(results), ok=sum(1 for r in results if r["ok"]), ids=[r["id"] for r in results])
        return {"results": results}


# ---------------------------------------------------------------- organisation (§3.15)

def org_get(w: W) -> dict[str, Any]:
    if not view.cache_shown(w.ctx):
        return {"folders": [], "items": []}  # the feature is off: no folder names either
    rows, _ = view.visible_rows(w.ctx)
    folders = [{"id": f["id"], "name": f["name"], "position": f["position"]} for f in w.conn.execute("SELECT * FROM schedule_folders ORDER BY position, name").fetchall()]
    meta = store.meta_rows(w.conn)
    items = []
    for r in rows:
        m = meta.get(r.core["id"])
        items.append({"schedule_id": r.core["id"], "folder_id": m["folder_id"] if m else None, "order": m["sort_key"] if m else None, "pinned": bool(m["pinned"]) if m else False})
    return {"folders": folders, "items": items}


_FOLDER_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def org_put(w: W, folders: list[dict[str, Any]], items: list[dict[str, Any]]) -> dict[str, Any]:
    w.require_manage()
    with w.audited("schedule.organise"):
        w.feature_on()
        if len(folders) > 50:
            raise ApiError(422, "validation", "עד 50 תיקיות.", details={"path": "folders"})
        names = []
        for f in folders:
            n = (f.get("name") or "").strip()
            if not 1 <= len(n) <= 40 or any(ord(c) < 32 for c in n):
                raise ApiError(422, "validation", "שם תיקייה: 1–40 תווים.", details={"path": "folders"})
            names.append(n)
        rows, _ = view.visible_rows(w.ctx)
        visible = {r.core["id"] for r in rows}
        existing = {f["id"] for f in w.conn.execute("SELECT id FROM schedule_folders").fetchall()}
        keep: list[tuple[str, str, int]] = []
        for i, f in enumerate(folders):
            fid = f.get("id") if isinstance(f.get("id"), str) and _FOLDER_ID.match(f["id"]) else None
            fid = fid or "fo" + uuid.uuid4().hex[:10]
            keep.append((fid, names[i], int(f.get("position", i))))
        ids = {k[0] for k in keep}
        if len(ids) != len(keep):
            raise ApiError(422, "validation", "מזהי תיקיות כפולים.", details={"path": "folders"})
        if any(it.get("folder_id") is not None and it["folder_id"] not in ids for it in items if it.get("schedule_id") in visible):
            raise ApiError(422, "validation", "תיקייה לא קיימת.", details={"path": "items"})  # checked before anything is written
        now = store.stamp()
        for fid in existing - ids:
            w.conn.execute("UPDATE schedule_meta SET folder_id = NULL WHERE folder_id = ?", (fid,))
            w.conn.execute("DELETE FROM schedule_folders WHERE id = ?", (fid,))
        for fid, name, pos in keep:
            w.conn.execute("INSERT INTO schedule_folders(id, name, position, created_at, created_by) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, position = excluded.position",
                           (fid, name, pos, now, w.principal.user_id))
        placed = 0
        for it in items:
            sid = it.get("schedule_id")
            if sid not in visible:
                continue
            folder = it.get("folder_id")
            if folder is not None and folder not in ids:
                raise ApiError(422, "validation", "תיקייה לא קיימת.", details={"path": "items"})
            w.conn.execute("INSERT OR IGNORE INTO schedule_meta(schedule_id, created_via, first_seen_at, last_seen_at) VALUES (?, 'external', ?, ?)", (sid, now, now))
            w.conn.execute("UPDATE schedule_meta SET folder_id = ?, sort_key = ?, pinned = ? WHERE schedule_id = ?", (folder, it.get("order"), 1 if it.get("pinned") else 0, sid))
            placed += 1
        w.audit("schedule.organise", "allowed", None, folders=len(keep), items=placed)
        ha_sync.publish({"type": "schedules_changed"})
        return org_get(w)


# ---------------------------------------------------------------- preview (§3.5)

def preview(w: W, draft: dict[str, Any], schedule_id: str | None, count: int) -> dict[str, Any]:
    """Always data: problems are returned, never raised (a well-formed body is always 200)."""
    w.feature_on()
    rate_limit(w.principal.user_id, "preview", PREVIEWS_PER_MIN)
    old_core = None
    if schedule_id:
        _, old_core = find_visible(w, schedule_id)
    ev = evaluate(w, draft, old_core, creating=schedule_id is None)
    errors = list(ev.errors)
    if w.ctx.access.anywhere(view.MANAGE):
        errors.extend({"path": "", "code": d.code, "message": d.user_message} for d in ev.denials)
    core_like = {"weekdays": [t for t in draft.get("weekdays") or [] if t in model.DAY_TOKENS], "start_date": draft.get("start_date"), "end_date": draft.get("end_date"), "repeat": draft.get("repeat") or "repeat", "slots": []}
    for i, s in enumerate(draft.get("slots") or []):
        spec = policy.parse_time(s.get("start"))
        if spec is not None:
            core_like["slots"].append({"index": i, "start": spec})
    now = store.MIRROR.now()
    ups = model.next_runs_computed(core_like, now, w.ctx.tz_name, w.ctx.sun_seconds(), count) if core_like["slots"] else []
    slots = draft.get("slots") or []
    for u in ups:
        u["summary"] = _run_summary(w, slots[u["slot_index"]])
    return {"valid": not errors, "errors": errors, "warnings": ev.warnings, "upcoming": ups, "conditional": bool((draft.get("conditions") or {}).get("items")),
            "sensitive": ev.sensitive, "lowering": ev.lowering, "requires": requires_of(w, ev)}


def _run_summary(w: W, slot: dict[str, Any]) -> str:
    acts = slot.get("actions") or []
    if not acts:
        return ""
    a = acts[0]
    info = view.ScopedCtx(w.ctx).entity(a["entity_id"]) if a.get("entity_id") else None  # an entity the caller cannot read is never named
    if info is None:
        return ""
    label = ""
    if info and info["class"]:
        label = (policy.SCHEDULE_ACTIONS.get(info["class"], {}).get(a["service"]) or {}).get("label") or ""
    text = f"{label} · {info['name']}" if label and info else (a.get("service") or "")
    return text + (f" ועוד {len(acts) - 1}" if len(acts) > 1 else "")
