"""WISKEY-DOOR-TECH-2390 (plan 2026-11-03 T6, owner Q5 = a): door technical writes from the stations drawer - a door's hold-open
schedule, the station's public door codes, the door's hold-open program. The commands and their meaning: services/wiskey_door_tech.py.

Endpoints (the browser never names a WisKey command; every write is one typed POST):

- `GET  /access-control/stations/{id}/door-tech` - READ ONLY: whether this caller may write this station's doors (and why not), the
  station's relays, which of the five writes this WisKey offers, the typed-confirmation phrase rule, and the station's recent door writes
  from Arx's own audit rows (any actor; status and WisKey's code, never a value). The schedules, programs and code presence themselves
  are the existing technical reads (routers/access_control_reads.py).
- `POST .../doors/{door}/hold`               `{revision, policy, confirmed}`                      -> `stations/technical_hold_save`
- `POST .../doors/{door}/hold/delete`        `{revision, confirmed}`                              -> `stations/technical_hold_delete`
- `POST .../doors/{door}/program`            `{revision, policy, enabled, confirmed}`             -> `stations/technical_program_save`
- `POST .../doors/{door}/program/{action}`   `pause | remove`, `{revision, confirmed}`            -> `stations/technical_program_action`
- `POST .../codes/{slot}`                    `{action: set | clear, door, expected, new_code?, current_code?, compatibility, confirm_text,
                                               confirmed}`                                         -> `stations/technical_codes_write`
  Every POST also carries the physical actions' envelope `{client_request_id, expires_at}`.

Order of every POST: the gate (`system.configure` or `access.stations.manage` somewhere; an audited 403 before the body is read) ->
the body (JSON only; a malformed one is an audited refusal) -> the envelope (expiry, duplicate) -> the station (`access.read` on it or
`system.configure`, else the uniform 404) -> the permission on the station (services/wiskey_door_tech.grant: an explicit deny of
`access.stations.manage` there wins) -> the confirmation (`confirmed: true`; for a code also the typed phrase `קוד <slot>`) -> WisKey
offers the command -> the served copy (station known, online when the write reaches the device, the relay exists) -> the value rules
-> Arx's limits. Each refusal is an audit row with `outcome: not_sent`, and nothing is sent. Then: the attempt row (committed), the
frame sent ONCE on the `door_technical` channel, the outcome row.

The reply says honestly what is known: 200 with `status` `acknowledged` (WisKey answered success: a draft saved / deleted, a code
written and read back, a program saved / paused / removed - never "the door is physically in that state") or `partial` (the program was
saved, the old draft's removal is unknown). Anything else is an HTTP error whose `details.outcome` is `not_sent`, `refused` (WisKey
answered with a pre-effect refusal: `details.wiskey_code` is its reason - "WisKey refused: <reason>") or `unknown` (sent, no clear
answer: it may have happened). Nothing is retried, queued or run by itself.

Never in a reply, an error, an audit row or a log: a code value (new or current), its length or a hash of it. The audit rows keep the
actor, the station, the door / slot, set or clear, the schedule's revision and WisKey's code."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import ConfigDict, Field, StrictBool, StrictInt

from .. import rbac
from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError, forbidden
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import intercom_client, intercom_sync
from ..services import wiskey_door_tech as dt
from ._common import raw_body as _raw_body
from .access_control import MAX_STATION_ID, CommandEnvelope, _Action, _envelope, _parse, _station

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
HISTORY_DAYS = 14
HISTORY_MAX = 12
UNSETTLED_AFTER_S = 90

WHAT = {
    "hold_save": "שמירת לוח ההחזקה של הדלת",
    "hold_delete": "מחיקת לוח ההחזקה של הדלת",
    "code_write": "עדכון הקוד הציבורי",
    "program_save": "החלת תוכנית ההחזקה",
    "program_action": "עדכון תוכנית ההחזקה",
}
# WisKey's refusal reasons in the operator's words (the code itself is always shown next to it)
REASONS = {
    "unauthorized": "ל־Arx אין הרשאה לפקודה הזו ב־WisKey",
    "reauth_required": "WisKey דורש אימות מחדש לפעולות רגישות",
    "screen_locked": "המסך של WisKey נעול",
    "approval_required": "WisKey דורש אישור כפול לפעולה הזו",
    "device_busy": "העמדה עסוקה בפקודה טכנית אחרת",
    "revision_conflict": "הנתונים השתנו מאז שנטענו - טענו מחדש ונסו שוב",
    "hold_pause_before_edit": "יש להשהות את התוכנית לפני שמשנים אותה",
    "schedule_limit": "הגעתם למספר המרבי של לוחות זמנים ב־WisKey",
    "operation_unsupported": "העמדה או הדלת אינן תומכות בפעולה הזו",
    "unmanaged_lock": "הדלת אינה מנוהלת ב־WisKey",
    "station_retiring": "העמדה בתהליך הוצאה משימוש",
    "invalid_storage": "האחסון של WisKey אינו תקין",
    "invalid_fields": "WisKey דחה את פרמטרי הפקודה",
    "rate_limited": "WisKey הגביל את קצב הפקודות",
    "api_incompatible": "גרסת WisKey אינה תואמת",
    "unknown_command": "WisKey המותקן אינו מכיר את הפקודה",
    "request_too_large": "הבקשה גדולה מדי",
}


NOT_SENT_OWN = {
    "relay_map_unreadable": "לא ניתן היה לקרוא מ־WisKey את מיפוי הדלתות",
    "unmanaged_lock": "הדלת אינה מנוהלת ב־WisKey",
    "station_not_found": "העמדה לא נמצאה ב־WisKey",
}


def reason_text(code: str) -> str:
    if code in REASONS:
        return REASONS[code]
    if code.startswith("schedule_") or code in ("invalid_text", "invalid_timezone"):
        return "לוח הזמנים אינו תקין לפי WisKey"
    return "סיבה שאינה מוכרת ל־Arx"


# ---------------------------------------------------------------- bodies

class _Confirmed(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None  # only `true` (sent by the confirmation step) confirms


class HoldSaveBody(_Confirmed):
    revision: StrictInt = Field(ge=0, le=1_000_000_000)
    policy: Any = None


class RevisionBody(_Confirmed):
    revision: StrictInt = Field(ge=0, le=1_000_000_000)


class ProgramSaveBody(_Confirmed):
    revision: StrictInt = Field(ge=0, le=1_000_000_000)
    policy: Any = None
    enabled: StrictBool


class CodeBody(_Confirmed):
    action: Literal["set", "clear"]
    door: StrictInt = Field(ge=1, le=2)
    expected: StrictBool
    new_code: str | None = Field(None, max_length=32)
    current_code: str | None = Field(None, max_length=32)
    compatibility: StrictBool = False
    confirm_text: str | None = Field(None, max_length=64)


# ---------------------------------------------------------------- the gate and the shared steps

def _gate_check(conn: sqlite3.Connection, principal: Principal) -> None:
    if dt.may_somewhere(conn, principal):
        return
    decision = rbac.authorize(conn, principal, dt.SYSTEM_CONFIGURE, rbac.INSTALLATION)
    audit(conn, actor=principal, action=dt.DOOR_ADMIN, decision="denied", resource_type="installation", resource_id="*",
          reason=decision.reason if decision.reason != "binding" else "no_binding", under=decision)
    raise forbidden(permission=dt.DOOR_ADMIN, target_type="installation", target_id="*", reason=decision.reason)


_writer_ro = read_gate(_gate_check)


def _writer_view(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    _gate_check(conn, principal)
    return principal


def _not_found() -> ApiError:
    return ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")


def _sees(conn: sqlite3.Connection, principal: Principal, station_id: str, g: dt.Grant) -> bool:
    return ia.Authority(conn, principal).station(ia.READ, station_id) or (g.allowed and g.reason == dt.SYSTEM_CONFIGURE)


def _int_path(act: _Action, name: str, value: str, low: int, high: int) -> int:
    if value.isascii() and value.isdecimal() and len(value) <= 2 and low <= int(value) <= high:
        return int(value)
    raise act.refuse(ApiError(422, "validation", f"{name} אינו תקין.", details={"fields": [name]}))


def _begin(act: _Action, kind: dt.Kind, raw: bytes, model: type, extra: dict[str, Any]) -> tuple[Any, datetime]:
    """Body, envelope, station visibility, permission, confirmation, WisKey's discovery - each refusal audited, nothing sent."""
    request, conn, principal, station_id = act.request, act.conn, act.principal, act.station_id
    act.details.update(kind=kind.name, **extra)
    body = _parse(act, model, raw)
    not_after = _envelope(act, body)
    g = dt.grant(conn, principal, station_id)
    if not _sees(conn, principal, station_id, g):
        raise act.refuse(_not_found())
    if not g.allowed:
        raise act.refuse(ApiError(403, "forbidden", "שינויים טכניים בדלתות מותרים למנהלי מערכת בלבד.",
                                  details={"permission": dt.DOOR_ADMIN, "alternative": dt.SYSTEM_CONFIGURE, "reason": g.reason}))
    rbac.note_grant(g.decision, g.reason)
    act.details["granted_by"] = g.reason
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שינוי טכני בדלת דורש אישור מפורש.", details={"kind": kind.name}))
    available, why = dt.available(intercom_sync.SYNC.api_facts(settings_of(request)), kind)
    if available is False:
        raise act.refuse(ApiError(409, "door_tech_unsupported", f"WisKey המותקן אינו מציע את הפעולה הזו ({why}), ולכן היא לא נשלחה.",
                                  details={"wiskey_code": why}))
    return body, not_after


def _door(act: _Action, station: dict[str, Any] | None, door: int) -> None:
    if station is not None and door not in [lock["physical_index"] for lock in station.get("locks") or []]:
        raise act.refuse(ApiError(422, "intercom_lock_unknown", "לעמדה אין דלת במספר הזה.", details={"locks": [lock["physical_index"] for lock in station.get("locks") or []]}))


def _limit(act: _Action, kind: dt.Kind, station_id: str, target: int) -> None:
    limited = dt.LIMITS.admit(act.principal.user_id, station_id, kind, target)
    if limited is None:
        return
    code, retry = limited
    message = {
        "door_tech_cooldown": f"{WHAT[kind.name]} נשלחה לפני רגע. אפשר לשלוח שוב בעוד {int(retry + 0.999)} שניות.",
        "door_tech_code_rate_limited": "נשלחו יותר מדי שינויי קוד בזמן קצר. הפקודה לא נשלחה - נסו שוב מאוחר יותר.",
        "door_tech_rate_limited": "נשלחו יותר מדי שינויים טכניים בזמן קצר. הפקודה לא נשלחה - נסו שוב בעוד דקה.",
        "door_tech_busy": "שינוי טכני אחר בעמדה עדיין רץ. הפקודה לא נשלחה - נסו שוב בעוד רגע.",
    }[code]
    raise act.refuse(ApiError(429, code, message, retryable=True, details={"retry_after_s": retry}))


def _error(kind: dt.Kind, exc: ApiError) -> ApiError:
    """The feed's error in this screen's words; `details` (`outcome`, `wiskey_code`, `state`) kept."""
    details = dict(exc.details or {})
    outcome = str(details.get("outcome") or "unknown")
    code = str(details.get("wiskey_code") or exc.code)
    what = WHAT[kind.name]
    if outcome == "not_sent":
        if code in NOT_SENT_OWN:  # the code write's relay read (services/wiskey_door_tech.send_code): the write frame was never written
            return ApiError(409, "door_tech_not_sent", f"{what} לא נשלחה: {NOT_SENT_OWN[code]}.", details=details)
        return ApiError(exc.status, exc.code, f"{what}: {exc.user_message}", retryable=exc.retryable, details=details)
    if outcome == "refused":
        return ApiError(409, "door_tech_refused", f"WisKey סירב: {reason_text(code)} ({code}). {what} לא בוצעה.", details=details)
    return ApiError(504, "door_tech_outcome_unknown",
                    f"{what} נשלחה, אך לא התקבלה תשובה ברורה ({code}). ייתכן שבוצעה - טענו מחדש את הנתונים ובדקו לפני שמנסים שוב.", details=details)


def _perform(act: _Action, kind: dt.Kind, station_id: str, target: int, sender: Callable[[intercom_client.Call], Any], project: Callable[[Any], dict[str, Any]],
             summary: Callable[[dict[str, Any]], dict[str, Any]], not_after: datetime) -> dict[str, Any]:
    """The attempt row (committed), the frame sent once on the door_technical channel, the outcome row."""
    user = act.principal.user_id
    try:
        act.attempt()
        try:
            reply = intercom_sync.SYNC.action(settings_of(act.request), "door_tech", sender, project,
                                              who=user, not_after=not_after, lane=dt.LANE, channel=dt.CHANNEL)
        except ApiError as exc:
            outcome = str(exc.details.get("outcome") or "unknown")
            code = str(exc.details.get("wiskey_code") or exc.code)
            if outcome != "not_sent":
                dt.LIMITS.sent(user, station_id, kind, target)
            act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
            raise _error(kind, exc) from None
        except BaseException as exc:
            dt.LIMITS.sent(user, station_id, kind, target)
            act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
            raise
        finally:
            act.conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
    finally:
        dt.LIMITS.done(station_id)
    dt.LIMITS.sent(user, station_id, kind, target)
    data = reply["door_tech"]
    partial = data.get("partial") if isinstance(data, dict) else None
    status = "partial" if partial else "acknowledged"
    act.outcome("partial" if partial else "ok", partial, {"result": summary(data)})
    return {"station_id": station_id, "kind": kind.name, "status": status, "partial": partial, "command_id": act.details["command_id"],
            "at": reply.get("fetched_at"), "data": data}


def _admit_and_perform(act: _Action, kind: dt.Kind, station_id: str, target: int, fields: dict[str, Any], project: Callable[[Any], dict[str, Any]],
                       summary: Callable[[dict[str, Any]], dict[str, Any]], not_after: datetime) -> dict[str, Any]:
    _limit(act, kind, station_id, target)  # admitted: the station's in-flight slot is freed by _perform, whatever happens there
    return _perform(act, kind, station_id, target, lambda call: dt.send(call, kind, station_id, fields), project, summary, not_after)


def _policy(act: _Action, value: Any) -> dict[str, Any]:
    try:
        return dt.policy(value)
    except ApiError as exc:
        raise act.refuse(exc) from None


# ---------------------------------------------------------------- the read

def _history(conn: sqlite3.Connection, station_id: str) -> list[dict[str, Any]]:
    """The station's recent door writes (any actor), newest first: one entry per command (`acknowledged` / `partial` / `refused` /
    `unknown`, or `sent` while the outcome row is not written yet), or per refusal before sending (`not_sent`)."""
    since = (datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    marks = ",".join("?" for _ in dt.AUDIT_ACTIONS)
    rows = conn.execute(
        f"SELECT at, action, reason, details_json FROM audit_log WHERE at >= ? AND action IN ({marks}) AND resource_id = ? ORDER BY id DESC LIMIT 120",
        (since, *dt.AUDIT_ACTIONS, station_id),
    ).fetchall()
    by_audit = {k.audit: k for k in dt.KINDS.values()}
    out: list[dict[str, Any]] = []
    settled: set[str] = set()
    now = datetime.now(timezone.utc)
    for r in rows:
        kind = by_audit.get(r["action"])
        try:
            d = json.loads(r["details_json"] or "{}")
        except ValueError:
            d = {}
        if kind is None or not isinstance(d, dict):
            continue
        phase, outcome, cid = d.get("phase"), d.get("outcome"), d.get("command_id")
        if phase == "outcome":
            if cid in settled:
                continue
            settled.add(str(cid))
            status = {"ok": "acknowledged", "partial": "partial", "refused": "refused", "not_sent": "not_sent"}.get(str(outcome), "unknown")
        elif phase == "attempt":
            if cid in settled:
                continue
            settled.add(str(cid))
            try:
                age = (now - datetime.fromisoformat(str(r["at"]).replace("Z", "+00:00"))).total_seconds()
            except ValueError:
                age = 0
            status = "unknown" if age > UNSETTLED_AFTER_S else "sent"
        elif phase == "refused":
            status = "not_sent"
        else:
            continue
        out.append({"kind": kind.name, "at": r["at"], "status": status, "code": r["reason"] if status not in ("acknowledged", "sent") else None,
                    "door": d.get("door"), "slot": d.get("slot"), "code_action": d.get("code_action"), "program_action": d.get("program_action"),
                    "enabled": d.get("enabled")})
        if len(out) >= HISTORY_MAX:
            break
    return out


@router.get("/access-control/stations/{station_id}/door-tech")
def door_tech_view(request: Request, principal: Principal = Depends(_writer_view), conn: sqlite3.Connection = Depends(get_read_conn),
                   station_id: str = Path(min_length=1, max_length=MAX_STATION_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    g = dt.grant(conn, principal, station_id)
    if not _sees(conn, principal, station_id, g):
        raise _not_found()
    settings = settings_of(request)
    sup = intercom_sync.SYNC.stations_superset(settings)
    station = None
    if sup["stations"] is not None:
        station = next((s for s in sup["stations"] if s.get("id") == station_id), None)
        if station is None:
            raise _not_found()
    api = intercom_sync.SYNC.api_facts(settings)
    commands = {name: dict(zip(("available", "reason"), dt.available(api, kind))) for name, kind in dt.KINDS.items()}
    return {
        "station_id": station_id,
        "allowed": g.allowed,
        "reason": g.reason,
        "online": None if station is None else bool(station.get("online")),
        "feed": intercom_sync.STATE.state,
        "locks": [{"door": lock["physical_index"], "name": lock.get("name")} for lock in (station or {}).get("locks") or []],
        "commands": commands,
        "confirm_phrase": "קוד {slot}",
        "limits": {"code_window_s": int(dt.CODE_WINDOW_S * dt.SCALE), "code_max": dt.CODE_USER_MAX},
        "history": _history(conn, station_id) if g.allowed else [],
    }


# ---------------------------------------------------------------- hold-open schedules (drafts)

@router.post("/access-control/stations/{station_id}/doors/{door}/hold")
def hold_save(request: Request, station_id: str, door: str, principal: Principal = Depends(_writer_ro), raw: bytes = Depends(_raw_body),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    kind = dt.KINDS["hold_save"]
    act = _Action(request, conn, principal, kind.audit, station_id)
    d = _int_path(act, "door", door, 1, 2)
    body, not_after = _begin(act, kind, raw, HoldSaveBody, {"door": d})
    act.details["revision"] = body.revision
    station = _station(act, require_online=False)
    _door(act, station, d)
    pol = _policy(act, body.policy)
    act.details["schedule_name_set"] = True
    return _admit_and_perform(act, kind, station_id, d, dt.frame_hold_save(d, body.revision, pol), dt.project_hold_save,
                              lambda p: {"revision": (p.get("draft") or {}).get("revision"), "active": p.get("active"), "blocker": p.get("blocker")}, not_after)


@router.post("/access-control/stations/{station_id}/doors/{door}/hold/delete")
def hold_delete(request: Request, station_id: str, door: str, principal: Principal = Depends(_writer_ro), raw: bytes = Depends(_raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    kind = dt.KINDS["hold_delete"]
    act = _Action(request, conn, principal, kind.audit, station_id)
    d = _int_path(act, "door", door, 1, 2)
    body, not_after = _begin(act, kind, raw, RevisionBody, {"door": d})
    act.details["revision"] = body.revision
    station = _station(act, require_online=False)
    _door(act, station, d)
    return _admit_and_perform(act, kind, station_id, d, dt.frame_hold_delete(d, body.revision), dt.project_hold_delete, lambda p: {"deleted": p.get("deleted")}, not_after)


# ---------------------------------------------------------------- hold-open programs

def _program_summary(door: int) -> Callable[[dict[str, Any]], dict[str, Any]]:
    def summary(p: dict[str, Any]) -> dict[str, Any]:
        mine = next((x for x in p.get("programs") or [] if x.get("door") == door), None)
        return {"partial": p.get("partial"), "present": mine is not None, "enabled": (mine or {}).get("enabled"), "removing": (mine or {}).get("removing"),
                "revision": (mine or {}).get("revision")}

    return summary


@router.post("/access-control/stations/{station_id}/doors/{door}/program")
def program_save(request: Request, station_id: str, door: str, principal: Principal = Depends(_writer_ro), raw: bytes = Depends(_raw_body),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    kind = dt.KINDS["program_save"]
    act = _Action(request, conn, principal, kind.audit, station_id)
    d = _int_path(act, "door", door, 1, 2)
    body, not_after = _begin(act, kind, raw, ProgramSaveBody, {"door": d})
    act.details.update(revision=body.revision, enabled=body.enabled)
    station = _station(act, require_online=body.enabled)  # enabling reads the device (WisKey's hold support check) and lets WisKey act on it
    _door(act, station, d)
    pol = _policy(act, body.policy)
    return _admit_and_perform(act, kind, station_id, d, dt.frame_program_save(d, body.revision, pol, body.enabled), dt.project_programs,
                              _program_summary(d), not_after)


@router.post("/access-control/stations/{station_id}/doors/{door}/program/{action}")
def program_action(request: Request, station_id: str, door: str, action: str, principal: Principal = Depends(_writer_ro), raw: bytes = Depends(_raw_body),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    kind = dt.KINDS["program_action"]
    act = _Action(request, conn, principal, kind.audit, station_id)
    d = _int_path(act, "door", door, 1, 2)
    if action not in ("pause", "remove"):
        raise act.refuse(ApiError(404, "not_found", "אין פעולה כזו לתוכנית."))
    body, not_after = _begin(act, kind, raw, RevisionBody, {"door": d, "program_action": action})
    act.details["revision"] = body.revision
    station = _station(act, require_online=False)  # a pause must always be sendable; WisKey reports the return to normal control
    _door(act, station, d)
    return _admit_and_perform(act, kind, station_id, d, dt.frame_program_action(d, body.revision, action), dt.project_programs, _program_summary(d), not_after)


# ---------------------------------------------------------------- public codes

@router.post("/access-control/stations/{station_id}/codes/{slot}")
def code_write(request: Request, station_id: str, slot: str, principal: Principal = Depends(_writer_ro), raw: bytes = Depends(_raw_body),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    kind = dt.KINDS["code_write"]
    act = _Action(request, conn, principal, kind.audit, station_id)
    n = _int_path(act, "slot", slot, 1, 16)
    body, not_after = _begin(act, kind, raw, CodeBody, {"slot": n})
    act.details.update(code_action=body.action, door=body.door, expected=body.expected)
    if (body.confirm_text or "").strip() != dt.confirm_phrase(n):
        raise act.refuse(ApiError(409, "typed_confirmation_required", f"כדי לשנות קוד ציבורי יש להקליד \"{dt.confirm_phrase(n)}\".", details={"phrase": dt.confirm_phrase(n)}))
    station = _station(act, require_online=True)
    _door(act, station, body.door)
    # the value rules (never echoed): set needs a new code (and the current one when the slot is set); clear needs the current one
    if body.action == "clear":
        if not body.expected:
            raise act.refuse(ApiError(409, "door_tech_code_not_set", "הקוד הזה אינו מוגדר, אין מה לנקות."))
        if body.new_code:
            raise act.refuse(dt.invalid("new_code", "invalid_fields", "ניקוי קוד אינו מקבל קוד חדש."))
        new = ""
    else:
        new = _value(act, body.new_code, "new_code")
    current = _value(act, body.current_code, "current_code") if body.expected else ""
    if not body.expected and body.current_code:
        raise act.refuse(dt.invalid("current_code", "invalid_fields", "לקוד שאינו מוגדר אין קוד נוכחי."))
    wiskey_action = dt.wiskey_code_action(body.action, body.expected)
    act.details["wiskey_action"] = wiskey_action
    _limit(act, kind, station_id, n)  # admitted: the station's in-flight slot is freed by _perform

    def build(api_door: int) -> dict[str, Any]:
        return dt.frame_code_write(n, wiskey_action, api_door, body.expected, current, new, body.compatibility)

    return _perform(act, kind, station_id, n, lambda call: dt.send_code(call, kind, station_id, body.door, build), dt.project_code_write(n),
                    lambda p: {"configured": p.get("configured"), "acknowledged": p.get("acknowledged")}, not_after)


def _value(act: _Action, value: str | None, field: str) -> str:
    try:
        return dt.code_value(value, field)
    except ApiError as exc:
        raise act.refuse(exc) from None
