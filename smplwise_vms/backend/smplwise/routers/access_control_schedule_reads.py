"""WISKEY-SCHED-READS-2520 (owner decision B2-ABI = a): WisKey's signed schedule INSPECTION jobs (`wiskey-schedule-reads.v1`) - a
station / plan read that may take WisKey 70-130 s, run as a short signed start and signed status reads (each well under 58 s). The
cycle, the closed schemas and the persisted request ids: services/wiskey_schedule_reads.py. READ ONLY: nothing here writes to a
station, confirms a claim, deploys, approves or grants; schedule execution (A2, `operations_decide_v1`) stays deferred to 2.53 and the
schedules screen keeps its warning that Arx does not execute schedules on the stations.

    GET  /access-control/schedules/reads                         the support state and the newest inspections (persisted rows)
    POST /access-control/schedules/reads                         {action, parameters}: start ONE inspection (request id persisted
                                                                 first, start sent once). `read` is null when the cycle is not
                                                                 supported now (nothing persisted, nothing sent)
    POST /access-control/schedules/reads/{request_id}/status     one signed status read for an inspection Arx started - never a start

`action` is a closed Arx name (readiness, dependencies, assess, plan_preview, plan_recheck, claim_preview); the browser never names a
WisKey command. `parameters` must be exactly that operation's set (WisKey's start schema, closed): an undeclared or missing key, a wrong
type, a malformed id or a draft WisKey would refuse is a 422 (`not_sent`). A station read needs the station in Arx's served copy and
online (404 / 409, nothing sent); Arx's own device-read limits apply (429, nothing sent).

Permission: the schedules administrator (`access.schedules.manage` unrestricted at the installation, or `system.configure` there) - the
same gate as the synchronous device reads (routers/access_control_schedule_writes.py); a refusal is an audited 403 before anything is
sent. Every start is audited (`intercom.schedule_read_start`: the actor, the request id, the action, the station / plan, the outcome and
WisKey's code - never a token or a draft's windows)."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Path, Request

from ..audit import audit
from ..db import Database
from ..errors import ApiError, field_error
from ..rbac import Principal
from ..services import wiskey_schedule_reads as sr
from ..services import wiskey_schedule_writes as sw
from ..wire import access_control_schedule_reads as W
from ..wire import wire
from ._common import raw_body as _raw_body, rid as _rid
from .access_control_schedule_writes import ID_RE, Bindings, _admin_get, _admin_ro, _require_station

router = APIRouter()

AUDIT_ACTION = "intercom.schedule_read_start"
UUID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
REVISION_MAX = 2147483647
WHAT = {
    "readiness": "קריאת מוכנות העמדה", "dependencies": "קריאת התלויות בעמדה", "assess": "בדיקת ההתאמה לעמדה",
    "plan_preview": "בדיקת הצעת הפריסה", "plan_recheck": "בדיקה חוזרת של ההצעה", "claim_preview": "בדיקת לקיחת האחריות",
}


def _invalid(fields: list[str], message: str = "הבקשה אינה תקינה") -> ApiError:
    return ApiError(422, "validation", f"{message}: " + ", ".join(fields), details={"fields": fields, "outcome": "not_sent"})


def _parameters(action: str, raw: Any) -> dict[str, Any]:
    """Arx's value checks on top of WisKey's closed start schema (sr.check_start runs again inside the cycle)."""
    shape = sr.PARAMETERS[sr.ACTIONS[action]]
    if not isinstance(raw, dict) or set(raw) != set(shape):
        extra = sorted(set(raw) ^ set(shape)) if isinstance(raw, dict) else ["parameters"]
        raise _invalid([f"parameters.{k}" for k in extra] or ["parameters"], "השדות אינם תואמים לחוזה הקריאה")
    out: dict[str, Any] = {}
    for key in shape:
        v = raw[key]
        if key == "station_id":
            ok = isinstance(v, str) and ID_RE.fullmatch(v) is not None
        elif key in ("plan_id", "schedule_id"):
            ok = isinstance(v, str) and sr.canonical_uuid(v)
        elif key == "revision":
            ok = type(v) is int and 1 <= v <= REVISION_MAX
        elif key == "data":
            try:
                sw.normalize(v)
            except sw.DraftError as exc:
                # ADR-019 (RELEASE-2520-TRAIN, as the writes router since ADR019-FAMILY45-2520): `fields` / `problems` name the draft path; the
                # legacy `field` and the outcome keys stay
                raise field_error(f"{WHAT[action]}: {sw.reason(exc.code)}.", problems=[{"field": exc.where, "code": exc.code}] if exc.where else None,
                                  code="schedule_invalid_draft", legacy={"field": exc.where},
                                  extra={"outcome": "not_sent", "wiskey_code": exc.code, "reason": sw.reason(exc.code)}) from None
            ok = True
        else:  # bindings
            try:
                v = Bindings.model_validate(v).model_dump()
                ok = True
            except Exception:  # noqa: BLE001 - pydantic ValidationError
                ok = False
        if not ok:
            raise _invalid([f"parameters.{key}"])
        out[key] = v
    return out


def _audit(request: Request, principal: Principal, read: dict[str, Any] | None, action: str, subject: str, support: dict[str, Any]) -> None:
    db: Database = request.app.state.db
    details = {"action": action, "contract": sr.CONTRACT}
    if read is None:
        details.update(outcome="not_sent", reason=support.get("reason") or support.get("state"))
    else:
        details.update(request_id=read["request_id"], outcome=read["state"], start_outcome=read["start_outcome"], wiskey_code=read["wiskey_code"])
    with db.write_aside() as w:
        audit(w, actor=principal, action=AUDIT_ACTION, decision="allowed" if read is not None else "denied",
              resource_type="station" if action in ("readiness", "dependencies", "assess", "plan_preview") else "schedule_plan",
              resource_id=subject or "*", reason=None if read is not None else str(details.get("reason")), request_id=_rid(request), details=details)


@router.get("/access-control/schedules/reads", **wire(W.ScheduleReadsList))
def schedule_reads(request: Request, principal: Principal = Depends(_admin_get)) -> dict[str, Any]:  # noqa: ARG001 - the gate
    """The support state and the newest inspections Arx started (persisted; only discovery may be read, never a schedule command)."""
    return sr.listing(request.app.state.db)


@router.post("/access-control/schedules/reads", **wire(W.ScheduleReadAnswer))
def schedule_read_start(request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        body = json.loads(raw) if raw.strip() else None
    except (ValueError, RecursionError):
        raise _invalid(["body"], "גוף הבקשה אינו JSON תקין") from None
    if not isinstance(body, dict) or set(body) != {"action", "parameters"}:
        raise _invalid(["body"])
    action = body["action"]
    if not isinstance(action, str) or action not in sr.ACTIONS:
        raise _invalid(["action"])
    params = _parameters(action, body["parameters"])
    station_id = params.get("station_id")
    if station_id is not None:
        _require_station(station_id)
    key = station_id or f"plan:{params.get('plan_id')}"
    limited = sw.LIMITS.admit_device(key)
    if limited is not None:
        code, retry = limited
        msg = "העמדה נקראה לפני רגע. אפשר לקרוא שוב בעוד {} שניות.".format(int(retry + 0.999)) if code == "schedule_station_cooldown" else "קריאת עמדה אחרת עדיין רצה. נסו שוב בעוד רגע."
        raise ApiError(429, code, f"{WHAT[action]}: {msg}", retryable=True, details={"retry_after_s": retry, "outcome": "not_sent"})
    try:
        try:
            answer = sr.start(request.app.state.db, principal.user_id, action, params)
        except sr.SchemaError as exc:
            raise _invalid([exc.where]) from None
        read = answer["read"]
        if read is not None and read["state"] != "not_sent":
            sw.LIMITS.device_sent(key)
    finally:
        sw.LIMITS.device_done()
    _audit(request, principal, read, action, station_id or params.get("plan_id") or "", answer["support"])
    return answer


@router.post("/access-control/schedules/reads/{request_id}/status", **wire(W.ScheduleReadAnswer))
def schedule_read_status(request: Request, principal: Principal = Depends(_admin_ro),  # noqa: ARG001 - the gate
                         request_id: str = Path(min_length=36, max_length=36, pattern=UUID_PATTERN)) -> dict[str, Any]:
    """One signed status read (a fresh proof, timeout <= 58 s) for an inspection Arx started. Never sends start."""
    try:
        return sr.status(request.app.state.db, request_id)
    except sr.SchemaError:
        raise _invalid(["request_id"]) from None
    except LookupError:
        raise ApiError(404, "schedule_read_not_found", "Arx לא התחיל קריאה כזו - אין מה לבדוק.", details={"outcome": "not_sent"}) from None
