"""WISKEY-SCHED-WRITE-2390 (plan 2026-11-03 T7, owner decision 03.11 Q4 "a"): the write side of WisKey's device schedule library -
the library, the deployment proposals, the claims, the baselines and the deployment work. The commands and what WisKey does with
each: services/wiskey_schedule_writes.py. The read side (library / plans / operations lists) stays in routers/access_control_reads.py.

Endpoints (the browser never names a WisKey command; every action is a closed Arx name):

- `POST /access-control/schedules/actions/{action}` - one action of services/wiskey_schedule_writes.OPS (`deploy` too).
  * READS (`check`, `import_preview`, `readiness`, `dependencies`, `assess`, `plan_preview`, `claim_preview`): no confirmation, no
    envelope; nothing is stored. A preview answer carries an Arx `preview_id` (WisKey's token stays here) and, where the station is
    involved, the IMPACT: the station, its doors (Arx's served copy) and WisKey's anonymous device-user counts.
  * WRITES (everything else): body `{confirmed: true, client_request_id, expires_at, ...}` - the command envelope of the physical
    actions; `confirmed` only from the confirmation dialog. A write that needs a preview names it: `create` / `update` the `check_id` of a
    successful `check` of the SAME draft, `import_apply` / `plan_save` / `claim_confirm` / `baseline_save` the `preview_id` of their
    preview - this user's, not expired, never reused. Refused and audited as `not_sent` before anything is sent: a malformed body, an
    expired or duplicate envelope, no confirmation (409), a missing / foreign / expired preview (409 `schedule_preview_required`), a
    draft Arx can already tell WisKey would refuse (422, WisKey's code), an offline station for a device read, Arx's own limits (429).
    Then: the attempt row (committed), the command sent ONCE on the `schedules` channel, the outcome row.
  * `deploy`: `{plans: [{plan_id, revision}] (1..16), ...envelope}` - per plan `schedules/operations_create`, then
    `schedules/operations_check` (WisKey's background preflight); one attempt + outcome row per plan; the answer lists each plan's result
    (a job id to follow, or WisKey's refusal, or `unknown`) - one station failing never hides another's result.
- `GET /access-control/schedules/jobs?ids=..` - the deployment progress: the named jobs as WisKey's `operations_list` has them now
  (READ channel, never cached), `writes_enabled`, and whether all of them reached a final state. The screen polls it while a job is
  `pending` / `queued` / `checking` (WisKey offers no push for jobs).
- `GET /access-control/schedules/claims` - the responsibility claims WITH their revisions (needed to release one).
- `GET /access-control/schedules/export` - the library's portable document (a download).
- `GET /access-control/schedules/plans/{plan_id}?revision=` - a proposal with its compiled candidate resources (`plan_export`).

Permission: the schedules administrator - `access.schedules.manage` at installation scope with no deny at any covering scope, or
`system.configure` at the installation (WisKey's library is installation-wide). Checked before the body is read; a refusal is an
audited 403.

Results are honest: a 200 is WisKey's success; otherwise `details.outcome` says `not_sent` (nothing reached WisKey), `refused`
(WisKey answered with a refusal - `details.wiskey_code` and `details.reason`; the message reads "WisKey סירב: <reason>") or
`unknown` (sent, no clear answer - it may have been stored). Nothing is retried, queued or run by itself. A deploy job that WisKey
ends `blocked` is reported as blocked with WisKey's blockers - in rc.10 always `schedule_writes_unverified`: nothing is written to
the station.

Audit rows (`intercom.schedule_<action>`, `intercom.schedule_deploy`): the real Arx actor, the request ids, the resource (schedule /
plan / claim / job / station id), the outcome and WisKey's code - never a token, a draft's windows or a person."""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, read_gate, settings_of
from ..db import Database
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, Principal, authorize, note_grant
from ..services import intercom_adapter as ad
from ..services import intercom_authority as ia
from ..services import intercom_sync
from ..services import wiskey_schedule_writes as sw
from .access_control import CommandEnvelope, _envelope, _parse, _raw_body

log = logging.getLogger("smplwise.intercom")
router = APIRouter()

ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
ID_RE = re.compile(ID_PATTERN)
SYSTEM_CONFIGURE = "system.configure"
MAX_DEPLOY = 16


# ---------------------------------------------------------------- the gate

def _is_admin(conn: sqlite3.Connection, principal: Principal) -> bool:
    auth = ia.Authority(conn, principal)
    if auth.unrestricted(ia.SCHEDULES_MANAGE):
        return True
    try:
        decision = authorize(conn, principal, SYSTEM_CONFIGURE, INSTALLATION)
    except Exception:  # noqa: BLE001 - fail closed
        return False
    if decision.allowed:
        note_grant(decision, SYSTEM_CONFIGURE)
    return decision.allowed


def _check_admin(conn: sqlite3.Connection, principal: Principal) -> None:
    """`access.schedules.manage` unrestricted (installation, no deny where a station can be) or `system.configure` at the installation;
    else the audited 403 of `access.schedules.manage`."""
    if _is_admin(conn, principal):
        return
    audit(conn, actor=principal, action=ia.SCHEDULES_MANAGE, decision="denied", resource_type="installation", resource_id="*", reason="schedules_admin_required")
    raise forbidden(permission=ia.SCHEDULES_MANAGE, target_type="installation", target_id="*", reason="schedules_admin_required")


_admin_ro = read_gate(_check_admin)


def _admin_get(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    _check_admin(conn, principal)
    return principal


# ---------------------------------------------------------------- bodies (exact keys; `extra="forbid"` everywhere)

class Period(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: str = Field(min_length=5, max_length=5)
    end: str = Field(min_length=5, max_length=5)


class Holiday(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=64)
    start: str = Field(min_length=10, max_length=10)
    end: str = Field(min_length=10, max_length=10)
    periods: list[Period] = Field(max_length=sw.MAX_PERIODS + 8)


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=64)
    weekly: dict[str, list[Period]]
    holidays: list[Holiday] = Field(max_length=sw.MAX_HOLIDAYS + 1)


class Bindings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template: StrictInt = Field(ge=1, le=65535)
    weekly: StrictInt = Field(ge=1, le=65535)
    holiday_group: StrictInt | None = Field(None, ge=1, le=65535)
    holidays: list[StrictInt] = Field(max_length=sw.MAX_HOLIDAYS)


SID = Field(min_length=1, max_length=128, pattern=ID_PATTERN)
UID = Field(min_length=36, max_length=36, pattern=r"^[0-9a-f-]{36}$")
REV = Field(ge=1, le=2147483647)
PID = Field(min_length=32, max_length=32, pattern=r"^[0-9a-f]{32}$")


class _Read(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CheckBody(_Read):
    data: Draft
    date: str = Field(min_length=10, max_length=10)
    time: str = Field(min_length=5, max_length=5)


class ImportPreviewBody(_Read):
    document: str = Field(min_length=2, max_length=sw.MAX_DOCUMENT_CHARS)


class StationBody(_Read):
    station_id: str = SID


class AssessBody(_Read):
    station_id: str = SID
    data: Draft


class PlanPreviewBody(_Read):
    station_id: str = SID
    schedule_id: str = UID
    revision: StrictInt = REV
    bindings: Bindings


class PlanRefBody(_Read):
    plan_id: str = UID
    revision: StrictInt = REV


class _Write(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None  # only `true` (from the confirmation step) confirms


class CreateBody(_Write):
    check_id: str = PID
    data: Draft


class UpdateBody(_Write):
    schedule_id: str = UID
    revision: StrictInt = REV
    check_id: str = PID
    data: Draft


class DeleteBody(_Write):
    schedule_id: str = UID
    revision: StrictInt = REV


class PreviewIdBody(_Write):
    preview_id: str = PID


class BaselineSaveBody(_Write):
    station_id: str = SID
    preview_id: str = PID


class BaselineClearBody(_Write):
    station_id: str = SID
    revision: StrictInt = Field(ge=1, le=2147483647)


class PlanWriteBody(_Write):
    plan_id: str = UID
    revision: StrictInt = REV


class ClaimReleaseBody(_Write):
    claim_id: str = UID
    revision: StrictInt = REV


class JobBody(_Write):
    job_id: str = UID
    revision: StrictInt = REV


class DeployItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: str = UID
    revision: StrictInt = REV


class DeployBody(_Write):
    plans: list[DeployItem] = Field(min_length=1, max_length=MAX_DEPLOY)


READ_BODIES: dict[str, type[BaseModel]] = {
    "check": CheckBody, "import_preview": ImportPreviewBody, "readiness": StationBody, "dependencies": StationBody, "assess": AssessBody,
    "plan_preview": PlanPreviewBody, "claim_preview": PlanRefBody,
}
WRITE_BODIES: dict[str, type[BaseModel]] = {
    "create": CreateBody, "update": UpdateBody, "delete": DeleteBody, "import_apply": PreviewIdBody, "baseline_save": BaselineSaveBody,
    "baseline_clear": BaselineClearBody, "plan_save": PreviewIdBody, "plan_recheck": PlanWriteBody, "plan_delete": PlanWriteBody,
    "claim_confirm": PreviewIdBody, "claim_release": ClaimReleaseBody, "job_check": JobBody, "job_cancel": JobBody, "job_archive": JobBody,
    "deploy": DeployBody,
}
RESOURCE: dict[str, tuple[str, str | None]] = {  # action -> (resource type, the body field naming the resource; None = "*")
    "create": ("intercom_schedule", None), "update": ("intercom_schedule", "schedule_id"), "delete": ("intercom_schedule", "schedule_id"),
    "import_apply": ("intercom_schedule", None), "baseline_save": ("intercom_station", "station_id"), "baseline_clear": ("intercom_station", "station_id"),
    "plan_save": ("intercom_schedule_plan", None), "plan_recheck": ("intercom_schedule_plan", "plan_id"), "plan_delete": ("intercom_schedule_plan", "plan_id"),
    "claim_confirm": ("intercom_schedule_claim", None), "claim_release": ("intercom_schedule_claim", "claim_id"),
    "job_check": ("intercom_schedule_job", "job_id"), "job_cancel": ("intercom_schedule_job", "job_id"), "job_archive": ("intercom_schedule_job", "job_id"),
    "deploy": ("intercom_schedule_deploy", None),
}


# ---------------------------------------------------------------- the audit context (every row through a short write of its own)

class _Act:
    """One write's audit context, duck-compatible with routers/access_control `_Action` for `_parse` / `_envelope`. The route runs on
    the READ connection; each row is written with `Database.write_aside`, committed before the command is sent (no record, no
    command), so several attempts (a deploy over several plans) can follow one another."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, action: str, resource_id: str, resource_type: str) -> None:
        self.request, self.conn, self.principal, self.action = request, conn, principal, action
        self.resource_id, self.resource_type = resource_id, resource_type
        self.rid = getattr(request.state, "correlation_id", None)
        self.details: dict[str, Any] = {"command": action.removeprefix("intercom.")}

    def _row(self, decision: str, reason: str | None, fields: dict[str, Any]) -> None:
        db: Database = self.request.app.state.db
        with db.write_aside() as w:
            audit(w, actor=self.principal, action=self.action, decision=decision, resource_type=self.resource_type, resource_id=self.resource_id,
                  reason=reason, request_id=self.rid, details={**self.details, **fields})

    def refuse(self, exc: ApiError) -> ApiError:
        exc.details.setdefault("outcome", "not_sent")
        self._row("denied", exc.code, {"phase": "refused", "outcome": "not_sent"})
        return exc

    def attempt(self) -> None:
        self.details["command_id"] = uuid.uuid4().hex
        self._row("allowed", None, {"phase": "attempt"})

    def outcome(self, outcome: str, reason: str | None, fields: dict[str, Any]) -> None:
        try:
            self._row("allowed", reason, {"phase": "outcome", "outcome": outcome, **fields})
        except Exception:  # noqa: BLE001 - the command was sent; its attempt row stands
            log.exception("audit: the outcome (%s) of schedule command %s could not be recorded; its attempt row stands", outcome, self.details.get("command_id"))


# ---------------------------------------------------------------- errors in the operator's words

REFUSED_STATUS = {
    "unauthorized": 403, "reauth_required": 403,
    "revision_conflict": 409, "schedule_import_expired": 409, "schedule_plan_expired": 409, "schedule_claim_expired": 409, "schedule_baseline_expired": 409,
    "schedule_plan_resource_reserved": 409, "schedule_claim_conflict": 409, "schedule_claim_in_use": 409, "schedule_operation_exists": 409,
    "schedule_operation_retained": 409, "schedule_source_changed": 409, "schedule_plan_device_changed": 409, "schedule_read_busy": 429, "rate_limited": 429,
    "schedule_not_found": 404, "schedule_plan_not_found": 404, "schedule_claim_not_found": 404, "schedule_operation_not_found": 404, "station_not_found": 404,
    "station_offline": 409, "unknown_command": 501,
}
VALIDATION_PREFIXES = ("schedule_invalid", "schedule_overlap", "schedule_period", "schedule_holiday", "schedule_binding", "schedule_transfer", "schedule_limit",
                       "schedule_compilation", "invalid_")


def refused(code: str, what: str) -> ApiError:
    """WisKey answered with a refusal: "WisKey סירב: <reason>" - nothing was stored."""
    status = REFUSED_STATUS.get(code) or (422 if code.startswith(VALIDATION_PREFIXES) else 502)
    return ApiError(status, "schedule_refused", f"{what}: WisKey סירב - {sw.reason(code)} ({code}). לא נשמר דבר.",
                    retryable=status == 429, details={"outcome": "refused", "wiskey_code": code, "reason": sw.reason(code)})


def _failure(op: sw.Op, reply: dict[str, Any], outcome: str, what: str) -> ApiError:
    code = str(reply.get("last_error") or "")
    if outcome == "refused":
        return refused(code, what)
    if outcome == "not_sent":
        exc = intercom_sync.action_error(reply, "not_sent")
        exc.details["outcome"] = "not_sent"
        return ApiError(exc.status, exc.code, f"{what}: {exc.user_message}", retryable=exc.retryable, details=exc.details)
    details = {"outcome": "unknown", "wiskey_code": code or None, "state": reply.get("state")}
    if op.kind == "device":
        return ApiError(504, "schedule_outcome_unknown", f"{what}: העמדה עדיין נקראת או שלא התקבלה תשובה ברורה ({code or 'timeout'}). קריאת עמדה יכולה להימשך עד שתי דקות - לא נשמר דבר; נסו שוב בעוד דקה.",
                        details=details)
    return ApiError(504, "schedule_outcome_unknown", f"{what}: הפקודה נשלחה אך לא התקבלה תשובה ברורה ({code or 'timeout'}). ייתכן שנשמרה וייתכן שלא - רעננו ובדקו לפני שמנסים שוב.",
                    details=details)


WHAT = {
    "check": "בדיקת לוח הזמנים", "create": "יצירת לוח זמנים", "update": "שמירת לוח הזמנים", "delete": "מחיקת לוח הזמנים", "export": "ייצוא הספרייה",
    "import_preview": "בדיקת קובץ הייבוא", "import_apply": "ייבוא לוחות הזמנים", "readiness": "קריאת מוכנות העמדה", "dependencies": "קריאת התלויות בעמדה",
    "assess": "בדיקת ההתאמה לעמדה", "baseline_save": "שמירת נקודת ההשוואה", "baseline_clear": "ניקוי נקודת ההשוואה", "plan_preview": "בדיקת הצעת הפריסה",
    "plan_save": "שמירת הצעת הפריסה", "plan_recheck": "בדיקה חוזרת של ההצעה", "plan_delete": "מחיקת הצעת הפריסה", "plan_detail": "קריאת הצעת הפריסה",
    "claim_preview": "בדיקת לקיחת האחריות", "claim_confirm": "לקיחת האחריות", "claim_release": "שחרור האחריות", "job_create": "יצירת עבודת הפריסה",
    "job_check": "בדיקת הפריסה", "job_cancel": "ביטול עבודת הפריסה", "job_archive": "העברה לארכיון", "deploy": "פריסה לעמדות",
}


# ---------------------------------------------------------------- the one send

def _execute(request: Request, user: str, op: sw.Op, fields: dict[str, Any], not_after: datetime | None = None) -> tuple[dict[str, Any], str]:
    """One command on the `schedules` channel, ONCE: intercom_sync's own admission (live session, the read slots and buckets, the
    expiry check right before the frame is written), WisKey's answer classified (`ok` / `refused` / `unknown` / `not_sent`)."""
    return intercom_sync.SYNC._execute(settings_of(request), "schedule", lambda call: sw.send(call, op, fields), op.project, user,
                                       sw.timeout_of(op), lane=sw.LANE, not_after=not_after, channel=sw.CHANNEL)


def _station_impact(station_id: str | None) -> dict[str, Any] | None:
    """The station a preview / deploy touches, from Arx's served copy: its name, whether it is online and its doors (relays)."""
    if not station_id:
        return None
    s = intercom_sync.SYNC.station(station_id)
    if s is None:
        return {"id": station_id, "name": None, "online": None, "doors": []}
    return {"id": station_id, "name": s.get("name"), "online": bool(s.get("online")),
            "doors": [{"index": lock.get("physical_index"), "name": lock.get("name")} for lock in s.get("locks") or []]}


def _impact(station_id: str | None, report: dict[str, Any] | None) -> dict[str, Any]:
    return {"station": _station_impact(station_id), "people": (report or {}).get("users"), "blockers": (report or {}).get("blockers") or [],
            "resources": (report or {}).get("resources") or []}


def _require_station(station_id: str) -> dict[str, Any] | None:
    """A device read needs the station in the served copy and online (else 404 / 409, nothing sent)."""
    s = intercom_sync.SYNC.station(station_id)
    if s is None and intercom_sync.SYNC.has_copy():
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.", details={"outcome": "not_sent"})
    if s is not None and not s.get("online"):
        raise ApiError(409, "intercom_station_offline", f"העמדה {s.get('name') or station_id} אינה מחוברת, ולכן לא נקראה.", details={"outcome": "not_sent"})
    return s


def _draft(where: str, data: BaseModel, *, act: _Act | None = None) -> dict[str, Any]:
    """The draft as WisKey's `normalize` would take it; a fault WisKey would refuse is refused here first (422, WisKey's code)."""
    raw = data.model_dump()
    try:
        sw.normalize(raw)
    except sw.DraftError as exc:
        err = ApiError(422, "schedule_invalid_draft", f"{where}: {sw.reason(exc.code)}.", details={"outcome": "not_sent", "wiskey_code": exc.code, "reason": sw.reason(exc.code), "field": exc.where})
        raise (act.refuse(err) if act is not None else err) from None
    return raw


def _strip(data: Any) -> Any:
    """A projection without WisKey's one-use token."""
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k != "token"}
    return data


# ---------------------------------------------------------------- the reads (previews, device reads)

def _run_read(request: Request, principal: Principal, action: str, raw: bytes) -> dict[str, Any]:
    op = sw.OPS[action]
    what = WHAT[action]
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"], "outcome": "not_sent"}) from None
    try:
        body = READ_BODIES[action].model_validate(payload)
    except Exception as exc:  # pydantic ValidationError
        fields = sorted({".".join(str(p) for p in e["loc"]) or "body" for e in getattr(exc, "errors", lambda: [])()}) or ["body"]
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields, "outcome": "not_sent"}) from None
    user = principal.user_id
    fields: dict[str, Any]
    station_id: str | None = None
    if action == "check":
        fields = {"data": _draft(what, body.data), "date": body.date, "time": body.time}  # type: ignore[attr-defined]
    elif action == "import_preview":
        fields = {"document": body.document}  # type: ignore[attr-defined]
    elif action in ("readiness", "dependencies"):
        station_id = body.station_id  # type: ignore[attr-defined]
        fields = {"station_id": station_id}
    elif action == "assess":
        station_id = body.station_id  # type: ignore[attr-defined]
        fields = {"station_id": station_id, "data": _draft(what, body.data)}  # type: ignore[attr-defined]
    elif action == "plan_preview":
        station_id = body.station_id  # type: ignore[attr-defined]
        bindings = body.bindings.model_dump()  # type: ignore[attr-defined]
        fields = {"station_id": station_id, "schedule_id": body.schedule_id, "revision": body.revision, "bindings": bindings}  # type: ignore[attr-defined]
    else:  # claim_preview
        fields = {"plan_id": body.plan_id, "revision": body.revision}  # type: ignore[attr-defined]
    device = op.device
    if station_id is not None:
        _require_station(station_id)
    if device:
        key = station_id or f"plan:{fields.get('plan_id')}"
        limited = sw.LIMITS.admit_device(key)
        if limited is not None:
            code, retry = limited
            msg = "העמדה נקראה לפני רגע. אפשר לקרוא שוב בעוד {} שניות.".format(int(retry + 0.999)) if code == "schedule_station_cooldown" else "קריאת עמדה אחרת עדיין רצה. נסו שוב בעוד רגע."
            raise ApiError(429, code, f"{what}: {msg}", retryable=True, details={"retry_after_s": retry, "outcome": "not_sent"})
    try:
        reply, outcome = _execute(request, user, op, fields)
        if device and outcome != "not_sent":
            sw.LIMITS.device_sent(station_id or f"plan:{fields.get('plan_id')}")
    finally:
        if device:
            sw.LIMITS.device_done()
    if outcome != "ok":
        raise _failure(op, reply, outcome, what)
    data = reply["schedule"]
    out: dict[str, Any] = {"action": action, "at": reply.get("fetched_at"), "data": _strip(data)}
    if action == "check":
        out["check_id"] = sw.PREVIEWS.put("draft", user, None, sw.digest(fields["data"]))
    elif action == "import_preview":
        out["preview_id"] = sw.PREVIEWS.put("import", user, data["token"], "*", {"count": data.get("count")})
    elif action == "assess":
        token = (data.get("baseline") or {}).get("token")
        out["data"]["baseline"] = _strip(data.get("baseline"))
        out["baseline_preview_id"] = sw.PREVIEWS.put("baseline", user, token, station_id or "") if token else None
        out["impact"] = {"station": _station_impact(station_id)}
    elif action in ("readiness", "dependencies"):
        out["impact"] = {"station": _station_impact(station_id), "people": data.get("users") if action == "dependencies" else None}
    elif action == "plan_preview":
        out["preview_id"] = sw.PREVIEWS.put("plan", user, data["token"], station_id or "", {"station_id": station_id})
        out["impact"] = _impact(station_id, data.get("report"))
    else:  # claim_preview
        out["preview_id"] = sw.PREVIEWS.put("claim", user, data["token"], fields["plan_id"])
        out["impact"] = _impact(None, data.get("report"))
    return out


# ---------------------------------------------------------------- the writes

def _limits(act: _Act) -> None:
    limited = sw.LIMITS.admit_write(act.principal.user_id)
    if limited is not None:
        code, retry = limited
        raise act.refuse(ApiError(429, code, "נשלחו יותר מדי שינויים בלוחות הזמנים בזמן קצר. השינוי לא נשלח - נסו שוב בעוד דקה.", retryable=True,
                                  details={"retry_after_s": retry}))


def _preview_or_refuse(act: _Act, pid: str, kind: str, subject: str | None = None) -> sw.Preview:
    p = sw.PREVIEWS.take(pid, kind, act.principal.user_id, subject)
    if p is None:
        raise act.refuse(ApiError(409, "schedule_preview_required", "הבדיקה המקדימה חסרה, פגה או שייכת למשתמש אחר. יש לבדוק שוב ולאשר מחדש - לא נשלח דבר.",
                                  details={"preview": kind}))
    return p


def _send_write(act: _Act, op: sw.Op, fields: dict[str, Any], not_after: datetime) -> Any:
    """The attempt row (committed), the command once, the outcome row; the adapter's cached lists are marked stale after anything
    that may have changed WisKey's store. Returns the projection (token stripped) or raises the honest error."""
    act.attempt()
    try:
        reply, outcome = _execute(act.request, act.principal.user_id, op, fields, not_after)
    except BaseException as exc:
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        ad.ADAPTER.cache.invalidate()
        raise
    code = reply.get("last_error")
    if outcome != "ok":
        act.outcome(outcome, str(code or outcome), {"wiskey_code": code})
        if outcome == "unknown":
            ad.ADAPTER.cache.invalidate()
        raise _failure(op, reply, outcome, WHAT[op.action])
    ad.ADAPTER.cache.invalidate()
    data = reply["schedule"]
    act.outcome("ok", None, {"result": _summary(op, data)})
    return _strip(data)


def _summary(op: sw.Op, data: Any) -> dict[str, Any]:
    """What the outcome row keeps: ids, revisions, statuses, counts - never windows, names of people or tokens."""
    if isinstance(data, list):
        return {"count": len(data), "ids": [d.get("id") for d in data[:100] if isinstance(d, dict)]}
    if not isinstance(data, dict):
        return {}
    keep = ("id", "revision", "station_id", "plan_id", "status", "deleted", "released", "archived", "checked_at")
    out = {k: data.get(k) for k in keep if k in data}
    if isinstance(data.get("blockers"), list):
        out["blockers"] = data["blockers"][:16]
    if isinstance(data.get("report"), dict):
        out["blockers"] = (data["report"].get("blockers") or [])[:16]
    return out


def _run_write(request: Request, conn: sqlite3.Connection, principal: Principal, action: str, raw: bytes) -> dict[str, Any]:
    rtype, field = RESOURCE[action]
    try:
        peek = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        peek = {}
    rid = peek.get(field) if field and isinstance(peek, dict) else None
    resource_id = rid if isinstance(rid, str) and ID_RE.fullmatch(rid) else "*"
    act = _Act(request, conn, principal, f"intercom.schedule_{action}", resource_id, rtype)
    body = _parse(act, WRITE_BODIES[action], raw)
    not_after = _envelope(act, body)
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שינוי בלוחות הזמנים דורש אישור מפורש.", details={"action": action}))
    if action == "deploy":
        return _deploy(act, body, not_after)
    op = sw.OPS[action]
    user = principal.user_id
    fields: dict[str, Any]
    if action in ("create", "update"):
        draft = _draft(WHAT[action], body.data, act=act)
        _preview_or_refuse(act, body.check_id, "draft", sw.digest(draft))
        fields = {"data": draft} if action == "create" else {"schedule_id": body.schedule_id, "revision": body.revision, "data": draft}
    elif action == "delete":
        fields = {"schedule_id": body.schedule_id, "revision": body.revision}
    elif action in ("import_apply", "plan_save", "claim_confirm"):
        kind = {"import_apply": "import", "plan_save": "plan", "claim_confirm": "claim"}[action]
        p = _preview_or_refuse(act, body.preview_id, kind)
        act.details["previewed"] = p.subject
        fields = {"token": p.token}
    elif action == "baseline_save":
        p = _preview_or_refuse(act, body.preview_id, "baseline", body.station_id)
        fields = {"station_id": body.station_id, "token": p.token}
    elif action == "baseline_clear":
        fields = {"station_id": body.station_id, "revision": body.revision}
    elif action in ("plan_recheck", "plan_delete"):
        fields = {"plan_id": body.plan_id, "revision": body.revision}
    elif action == "claim_release":
        fields = {"claim_id": body.claim_id, "revision": body.revision}
    else:  # job_check / job_cancel / job_archive
        fields = {"job_id": body.job_id, "revision": body.revision}
    _limits(act)
    device = op.device
    if device:
        limited = sw.LIMITS.admit_device(f"plan:{fields.get('plan_id')}")
        if limited is not None:
            code, retry = limited
            raise act.refuse(ApiError(429, code, "קריאת עמדה אחרת עדיין רצה. הבדיקה לא נשלחה - נסו שוב בעוד רגע.", retryable=True, details={"retry_after_s": retry}))
    try:
        data = _send_write(act, op, fields, not_after)
        if device:
            sw.LIMITS.device_sent(f"plan:{fields.get('plan_id')}")
    except ApiError as exc:
        if device and exc.details.get("outcome") != "not_sent":
            sw.LIMITS.device_sent(f"plan:{fields.get('plan_id')}")
        raise
    finally:
        if device:
            sw.LIMITS.device_done()
    out: dict[str, Any] = {"action": action, "status": "done", "command_id": act.details.get("command_id"), "at": _now(), "data": data}
    if action in ("plan_save", "plan_recheck") and isinstance(data, dict):
        out["impact"] = _impact(data.get("station_id"), data.get("report"))
    return out


def _deploy(act: _Act, body: DeployBody, not_after: datetime) -> dict[str, Any]:
    """Per plan: `operations_create` then `operations_check`. One row pair per plan; a plan WisKey refuses never stops the others.
    The jobs then run in WisKey's background - the screen follows them with GET /access-control/schedules/jobs."""
    seen: set[str] = set()
    items = [p for p in body.plans if not (p.plan_id in seen or seen.add(p.plan_id))]
    plans = _plans_now(act.request, act.principal.user_id)
    _limits(act)
    act.details["plans"] = [p.plan_id for p in items]
    act.attempt()  # the batch's own row: a resubmitted envelope is refused as a duplicate (routers/access_control `_envelope`)
    results = []
    create, check = sw.OPS["job_create"], sw.OPS["job_check"]
    for i, item in enumerate(items):
        plan = (plans or {}).get(item.plan_id)
        station_id = plan.get("station_id") if plan else None
        one = _Act(act.request, act.conn, act.principal, "intercom.schedule_deploy", item.plan_id, "intercom_schedule_plan")
        one.details.update(client_request_id=f"{act.details.get('client_request_id')}:{i}", expires_at=act.details.get("expires_at"),
                           plan_revision=item.revision, station_id=station_id)
        result: dict[str, Any] = {"plan_id": item.plan_id, "station": _station_impact(station_id), "people": ((plan or {}).get("report") or {}).get("users")}
        if plans is not None and plan is None:
            one.refuse(ApiError(404, "schedule_plan_not_found", "ההצעה לא נמצאה."))
            results.append({**result, "status": "not_sent", "code": "schedule_plan_not_found", "reason": sw.reason("schedule_plan_not_found")})
            continue
        if plan is not None and plan.get("revision") != item.revision:
            one.refuse(ApiError(409, "revision_conflict", "ההצעה השתנתה."))
            results.append({**result, "status": "not_sent", "code": "revision_conflict", "reason": sw.reason("revision_conflict")})
            continue
        try:
            job = _send_write(one, create, {"plan_id": item.plan_id, "revision": item.revision}, not_after)
        except ApiError as exc:
            results.append({**result, **_result_of(exc)})
            continue
        result["job"] = job
        # the preflight: WisKey queues its background check of the station; the screen follows the job by its id
        two = _Act(act.request, act.conn, act.principal, "intercom.schedule_job_check", job["id"], "intercom_schedule_job")
        two.details.update(client_request_id=f"{act.details.get('client_request_id')}:{i}:check", expires_at=act.details.get("expires_at"), plan_id=item.plan_id)
        try:
            job = _send_write(two, check, {"job_id": job["id"], "revision": job["revision"]}, datetime.now(timezone.utc) + timedelta(seconds=15))
            results.append({**result, "job": job, "status": "queued", "code": None, "reason": None})
        except ApiError as exc:
            results.append({**result, **_result_of(exc), "status_detail": "created_not_checked"})
    summary = {k: sum(1 for r in results if r["status"] == k) for k in ("queued", "refused", "unknown", "not_sent")}
    act.outcome("ok" if summary["queued"] == len(results) else "partial", None, {"summary": summary})
    return {"action": "deploy", "status": "done", "at": _now(), "results": results, "summary": summary}


def _result_of(exc: ApiError) -> dict[str, Any]:
    d = exc.details or {}
    status = {"refused": "refused", "not_sent": "not_sent"}.get(str(d.get("outcome")), "unknown")
    code = d.get("wiskey_code") or exc.code
    return {"status": status, "code": code, "reason": sw.reason(code) if status == "refused" else exc.user_message}


def _plans_now(request: Request, user: str) -> dict[str, dict[str, Any]] | None:
    """The plans as WisKey has them now (READ channel, not cached), by id; None when they cannot be read (WisKey then decides)."""
    try:
        reply = intercom_sync.SYNC.command(settings_of(request), "plans", ad.schedules_plans, ad.project_schedule_plans, who=user, channel="read")
    except ApiError:
        return None
    if reply.get("state") != "ready" or not isinstance(reply.get("plans"), list):
        return None
    return {p["id"]: p for p in reply["plans"]}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- routes

@router.post("/access-control/schedules/actions/{action}")
def schedule_action(request: Request, action: str = Path(min_length=1, max_length=32, pattern=r"^[a-z_]+$"), principal: Principal = Depends(_admin_ro),
                    raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if action in READ_BODIES:
        content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
        return _run_read(request, principal, action, raw)
    if action in WRITE_BODIES:
        return _run_write(request, conn, principal, action, raw)
    raise ApiError(404, "not_found", "אין פעולה כזו בלוחות הזמנים.")


@router.get("/access-control/schedules/jobs")
def schedule_jobs(request: Request, principal: Principal = Depends(_admin_get), ids: list[str] = Query(default=[], max_length=MAX_DEPLOY * 2)) -> dict[str, Any]:
    """The deployment progress of the named jobs (all jobs when none is named), read fresh from WisKey (`operations_list`)."""
    wanted = [i for i in ids if ID_RE.fullmatch(i)]
    reply = intercom_sync.SYNC.command(settings_of(request), "operations", ad.schedules_operations, _operations, who=principal.user_id, channel="read")
    ops = reply.get("operations") if reply.get("state") == "ready" else None
    if ops is None:
        return {"state": reply.get("state"), "last_error": reply.get("last_error"), "jobs": None, "writes_enabled": None, "done": False}
    jobs = [j for j in ops["jobs"] + ops["archive"] if not wanted or j["id"] in wanted]
    missing = [i for i in wanted if i not in {j["id"] for j in jobs}]
    return {"state": "ready", "last_error": None, "fetched_at": reply.get("fetched_at"), "jobs": jobs, "missing": missing, "writes_enabled": ops["writes_enabled"],
            "done": all(j["status"] not in sw.JOB_ACTIVE for j in jobs)}


@router.get("/access-control/schedules/claims")
def schedule_claims(request: Request, principal: Principal = Depends(_admin_get)) -> dict[str, Any]:
    reply = intercom_sync.SYNC.command(settings_of(request), "operations", ad.schedules_operations, _operations, who=principal.user_id, channel="read")
    ops = reply.get("operations") if reply.get("state") == "ready" else None
    return {"state": reply.get("state"), "last_error": reply.get("last_error"), "claims": ops["claims"] if ops else None}


def _operations(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected schedules/operations_list answer")

    def jobs(key: str) -> list[dict[str, Any]]:
        return [sw.project_job(j) for j in (raw.get(key) if isinstance(raw.get(key), list) else [])[:200] if isinstance(j, dict) and ad._id(j.get("id"))]

    claims = []
    for c in (raw.get("claims") if isinstance(raw.get("claims"), list) else [])[:200]:
        try:
            claims.append(sw.project_claim(c))
        except ValueError:
            continue
    return {"jobs": jobs("jobs"), "archive": jobs("archive"), "claims": claims, "writes_enabled": raw.get("writes_enabled") is True}


@router.get("/access-control/schedules/export")
def schedule_export(request: Request, principal: Principal = Depends(_admin_get)) -> dict[str, Any]:
    op = sw.OPS["export"]
    reply, outcome = _execute(request, principal.user_id, op, {})
    if outcome != "ok":
        raise _failure(op, reply, outcome, WHAT["export"])
    return reply["schedule"]


@router.get("/access-control/schedules/plans/{plan_id}")
def schedule_plan_detail(request: Request, principal: Principal = Depends(_admin_get), plan_id: str = Path(min_length=36, max_length=36, pattern=r"^[0-9a-f-]{36}$"),
                         revision: int = Query(ge=1, le=2147483647)) -> dict[str, Any]:
    op = sw.OPS["plan_detail"]
    reply, outcome = _execute(request, principal.user_id, op, {"plan_id": plan_id, "revision": revision})
    if outcome != "ok":
        raise _failure(op, reply, outcome, WHAT["plan_detail"])
    data = _strip(reply["schedule"])
    return {"data": data, "impact": _impact(data.get("station_id"), data.get("report"))}
