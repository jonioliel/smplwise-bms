"""WISKEY-STATION-OPS-2390 (plan 2026-11-03 T4): a station's maintenance from the stations screen - the drawer's "טכני" section and
the list action over several stations. The commands and their meaning: services/wiskey_station_ops.py.

Endpoints (the browser never names a WisKey command):

- `GET  /access-control/stations/{id}/maintenance` - READ ONLY, no confirmation: the health detail (last sync, inventory read, event
  stream, clock, the station's last error, and the sporadic `authentication_failed` with its step and time), what this caller may run
  here, each action's cool-down and the last time each action ran (from Arx's own audit rows). Gate: `access.admin.read` or
  `access.stations.manage` somewhere a station can be (an audited 403 otherwise); the station itself needs `access.read` on its chain
  (else the uniform 404); the health detail needs the status page's rule on the station (`access.read` + `access.admin.read`), else it
  is null and `health_hidden` says so. One `health/get` per station per 15 s at most (cached), over the READ channel.
- `POST /access-control/stations/{id}/maintenance/{action}` - `sync` | `rescan` | `health_refresh` | `clock_refresh`. Body:
  `{confirmed: true, client_request_id, expires_at}` (the command envelope of the physical actions; `confirmed` is sent only by the
  confirmation dialog). Permission: `access.stations.manage` anywhere at the gate (before the body is read; audited 403), then on the
  station's chain, and `access.read` there (else the uniform 404). Refused and audited as `not_sent` before anything is sent: a body
  that is not JSON / malformed, an expired or duplicate envelope, no confirmation (409 `confirmation_required`), an offline station for
  the three device reads, Arx's own limits (429 `station_ops_cooldown` / `station_ops_rate_limited` / `station_ops_busy`, with
  `retry_after_s`). Then: the attempt row committed, the command sent ONCE on the `maintenance` channel, the outcome row.

The reply of a POST says honestly what is known: `status` `acknowledged` (WisKey accepted the sync; the station follows through
WisKey's own worker) or `completed` (WisKey waited for the rescan / refresh / clock read and answered), with the data. Anything
short of that is an HTTP error whose `details.outcome` is `not_sent` (nothing reached WisKey), `refused` (WisKey answered with a
failure - `details.wiskey_code` is its reason) or `unknown` (sent, no clear answer - it may have happened). Nothing is retried, queued
or run by itself; the screens never repeat a command on their own.

Audit rows: the real Arx actor, the request ids, the station (resource), the action, the outcome and WisKey's code - never a host, a
credential or a person."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import ConfigDict

from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import intercom_sync
from ..services import wiskey_station_ops as ops
from ._common import raw_body as _raw_body
from .access_control import MAX_STATION_ID, CommandEnvelope, _Action, _envelope, _parse, _station

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
HISTORY_DAYS = 7
UNSETTLED_AFTER_S = 90  # an attempt row with no outcome row after this long reads `unknown` (the call cannot outlive ha_client's 60 s)

MESSAGES = {
    "sync": "סנכרון העמדה",
    "rescan": "סריקה מחדש של העמדה",
    "health_refresh": "רענון בריאות העמדה",
    "clock_refresh": "בדיקת השעון של העמדה",
}


class OpBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None  # only `true` (from the confirmation step) confirms, as the door release's body


_manager_ro = read_gate(lambda conn, principal: ia.require_anywhere(conn, principal, ia.STATIONS_MANAGE))


def _viewer(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    """The read's gate: `access.admin.read` or `access.stations.manage` somewhere a station can be. A caller with neither gets the
    audited 403 of `access.admin.read` (the status page's permission)."""
    auth = ia.Authority(conn, principal)
    if auth.anywhere(ia.ADMIN_READ) or auth.anywhere(ia.STATIONS_MANAGE):
        return auth
    return ia.require_anywhere(conn, principal, ia.ADMIN_READ, getattr(request.state, "correlation_id", None))  # raises the audited 403


def _not_found() -> ApiError:
    return ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")


def _copy_station(request: Request, station_id: str) -> dict[str, Any] | None:
    """The station in the served copy (with its closed technical part); 404 when there is a copy without it."""
    sup = intercom_sync.SYNC.stations_superset(settings_of(request))
    if sup["stations"] is None:
        return None
    found = next((s for s in sup["stations"] if s.get("id") == station_id), None)
    if found is None:
        raise _not_found()
    return found


# ---------------------------------------------------------------- the read

def _health(request: Request, auth: ia.Authority, station_id: str) -> dict[str, Any]:
    cached = ops.HEALTH.get(station_id)
    if cached is not None:
        return {"state": "ready", "fresh": True, "fetched_at": cached[0], "last_error": None, **cached[1]}
    try:
        reply = intercom_sync.SYNC.command(settings_of(request), "report", lambda call: ops.health_read(call, station_id), ops.project_report,
                                           who=auth.principal.user_id, channel="read")
    except ApiError as exc:
        return {"state": "error", "fresh": False, "fetched_at": None, "last_error": str(exc.details.get("wiskey_code") or exc.code), "health": None, "auth": None}
    report = reply.get("report")
    if reply.get("state") == "ready" and report is not None:
        ops.HEALTH.put(station_id, str(reply.get("fetched_at") or ""), report)
        return {"state": "ready", "fresh": True, "fetched_at": reply.get("fetched_at"), "last_error": None, **report}
    return {"state": reply.get("state") or "error", "fresh": False, "fetched_at": None, "last_error": reply.get("last_error"), "health": None, "auth": None}


def _last_runs(conn: sqlite3.Connection, station_id: str) -> dict[str, Any]:
    """Each action's newest audit row on this station (any actor) in the last HISTORY_DAYS days: `status` `sent` (an attempt whose
    outcome row has not been written yet), `acknowledged` / `completed`, `failed` (WisKey answered a failure), `not_sent` (refused
    before sending) or `unknown`; with WisKey's / Arx's code and the time."""
    since = (datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    marks = ",".join("?" for _ in ops.AUDIT_ACTIONS)
    rows = conn.execute(
        f"SELECT at, action, decision, reason, details_json FROM audit_log WHERE at >= ? AND action IN ({marks}) AND resource_id = ? ORDER BY id DESC LIMIT 60",
        (since, *ops.AUDIT_ACTIONS, station_id),
    ).fetchall()
    by_audit = {op.audit: op for op in ops.OPS.values()}
    out: dict[str, Any] = {name: None for name in ops.OPS}
    now = datetime.now(timezone.utc)
    for r in rows:
        op = by_audit.get(r["action"])
        if op is None or out[op.action] is not None:
            continue
        try:
            details = json.loads(r["details_json"] or "{}")
        except ValueError:
            details = {}
        phase, outcome = details.get("phase"), details.get("outcome")
        if phase == "attempt":
            try:
                age = (now - datetime.fromisoformat(str(r["at"]).replace("Z", "+00:00"))).total_seconds()
            except ValueError:
                age = 0
            status = "unknown" if age > UNSETTLED_AFTER_S else "sent"
        elif phase == "refused":
            status = "not_sent"
        elif outcome == "ok":
            status = op.result
        elif outcome == "refused":
            status = "failed"
        else:
            status = outcome if outcome in ("not_sent", "unknown") else "unknown"
        out[op.action] = {"status": status, "at": r["at"], "code": r["reason"] if status not in ("sent", op.result) else None}
    return out


@router.get("/access-control/stations/{station_id}/maintenance")
def maintenance_view(request: Request, auth: ia.Authority = Depends(_viewer), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    if not auth.station(ia.READ, station_id):
        raise _not_found()
    station = _copy_station(request, station_id)
    technical = (station or {}).get("technical") or None
    show_health = ia.status_station(auth, station_id)
    manage = auth.station(ia.STATIONS_MANAGE, station_id)
    health = _health(request, auth, station_id) if show_health else None
    if show_health:
        ops.observe(station_id, technical, (health or {}).get("auth"))
    tech_view = None
    if show_health and technical:
        tech_view = {
            "reconciled_at": technical.get("reconciled_at"), "scanned_at": technical.get("scanned_at"), "scanning": technical.get("scanning"),
            "last_error": technical.get("last_error"), "scan_error": technical.get("scan_error"),
            "event_status": technical.get("event_status"), "clock": technical.get("clock"), "last_poll_ms": technical.get("last_poll_ms"),
        }
    actions = {
        name: {"allowed": manage, "needs_online": op.needs_online, "cooldown_s": ops.LIMITS.cooldown_left(station_id, name) if manage else None, "result": op.result}
        for name, op in ops.OPS.items()
    }
    conn = auth.conn
    return {
        "station_id": station_id,
        "online": None if station is None else bool(station.get("online")),
        "feed": intercom_sync.STATE.state,
        "health_hidden": not show_health,
        "technical": tech_view,
        "report": health,
        "auth_seen": ops.SEEN.get(station_id) if show_health else None,
        "actions": actions,
        "last_runs": _last_runs(conn, station_id) if (show_health or manage) else None,
    }


# ---------------------------------------------------------------- the actions

def _error(op: ops.Op, exc: ApiError) -> ApiError:
    """The feed's error in this screen's words, its details (`outcome`, `wiskey_code`, `state`) kept."""
    details = dict(exc.details or {})
    outcome = str(details.get("outcome") or "unknown")
    code = str(details.get("wiskey_code") or exc.code)
    what = MESSAGES[op.action]
    if outcome == "not_sent":
        return ApiError(exc.status, exc.code, f"{what}: {exc.user_message}", retryable=exc.retryable, details=details)
    if outcome == "refused":
        return ApiError(502, "station_ops_failed", f"{what} נכשל לפי WisKey ({code}).", details=details)
    return ApiError(504, "station_ops_outcome_unknown", f"{what} נשלח, אך לא התקבלה תשובה ברורה ({code}). ייתכן שבוצע - אל תשלחו שוב לפני שבודקים את מצב העמדה.",
                    details=details)


@router.post("/access-control/stations/{station_id}/maintenance/{action}")
def maintenance_run(request: Request, station_id: str, action: str, principal: Principal = Depends(_manager_ro), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    op = ops.OPS.get(action)
    if op is None:
        raise ApiError(404, "not_found", "אין פעולת תחזוקה כזו.")
    act = _Action(request, conn, principal, op.audit, station_id)
    act.details["maintenance"] = action
    body: OpBody = _parse(act, OpBody, raw)
    not_after = _envelope(act, body)
    auth = ia.Authority(conn, principal)
    if not auth.station(ia.READ, station_id):
        raise act.refuse(_not_found())
    if not auth.station(ia.STATIONS_MANAGE, station_id):
        raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לתחזוקת העמדה הזו.", details={"permission": ia.STATIONS_MANAGE}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "פעולת תחזוקה דורשת אישור מפורש.", details={"action": action}))
    _station(act, require_online=op.needs_online)
    limited = ops.LIMITS.admit(principal.user_id, station_id, action)
    if limited is not None:
        code, retry = limited
        message = {
            "station_ops_cooldown": f"{MESSAGES[action]} נשלח לפני רגע. אפשר לשלוח שוב בעוד {int(retry + 0.999)} שניות.",
            "station_ops_rate_limited": "נשלחו יותר מדי פקודות תחזוקה בזמן קצר. הפקודה לא נשלחה - נסו שוב בעוד דקה.",
            "station_ops_busy": "פקודות תחזוקה אחרות עדיין רצות. הפקודה לא נשלחה - נסו שוב בעוד רגע.",
        }[code]
        raise act.refuse(ApiError(429, code, message, retryable=True, details={"retry_after_s": retry}))
    try:
        return _perform(act, op, station_id, not_after)
    finally:
        ops.LIMITS.done()


def _perform(act: _Action, op: ops.Op, station_id: str, not_after: datetime) -> dict[str, Any]:
    """The attempt row (committed), the command sent once on the maintenance channel, the outcome row - routers/access_control.py
    `_perform`'s order, on this module's own channel."""
    act.attempt()
    try:
        reply = intercom_sync.SYNC.action(settings_of(act.request), "maintenance", lambda call: ops.send(call, op, station_id), op.project,
                                          who=act.principal.user_id, not_after=not_after, lane=ops.LANE, channel=ops.CHANNEL)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        code = str(exc.details.get("wiskey_code") or exc.code)
        if outcome != "not_sent":
            ops.LIMITS.sent(station_id, op.action)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        raise _error(op, exc) from None
    except BaseException as exc:
        ops.LIMITS.sent(station_id, op.action)
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        raise
    finally:
        act.conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
    ops.LIMITS.sent(station_id, op.action)
    data = reply["maintenance"]
    act.outcome("ok", None, {"result": op.summary(data)})
    if op.action == "health_refresh":
        ops.HEALTH.put(station_id, str(reply.get("fetched_at") or ""), data)
        ops.observe(station_id, None, data.get("auth"))
    else:
        ops.HEALTH.drop(station_id)  # the next read asks WisKey again
    return {
        "station_id": station_id,
        "action": op.action,
        "status": op.result,
        "command_id": act.details["command_id"],
        "at": reply.get("fetched_at"),
        "data": data,
    }
