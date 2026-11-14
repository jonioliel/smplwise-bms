"""WISKEY-OPS-VIEWS-2400 (integration plan T11): Settings › תפעול האינטרקום - the intercom system's operations and fleet views, natively.

One endpoint per view, no generic proxy: the browser never names a WisKey command (services/wiskey_ops_views.py maps each to one fixed
command on the closed `operations` channel).

Permissions (installation scope - WisKey serves every one of these views installation-wide, so a station-scoped grant is not enough):
- the views (KPI summary, operations, investigations, jobs, capacity and trends, events report): `access.read` unrestricted at the
  installation. Person fields in the investigations timeline go further: a name needs `access.people.read`, an employee number
  `access.people.sensitive` (or names level when the installation keeps employee numbers at names level), an operator's name
  `access.admin.read` - each unrestricted; a free-text search of the timeline (WisKey matches it on names and employee numbers)
  needs `access.people.read` unrestricted (an audited 403 otherwise, never a silent oracle).
- the exports (fleet inventory, the intercom's own change log, a job's error rows) and the job cancel: `access.admin.read` unrestricted
  at the installation (the access-control administrator). Every export leaves an audit row (filters, row count, columns - never a row);
  every CSV is written by Arx with the formula guard (wiskey_ops_views.csv_bytes).
- the cancel is a write: the command envelope (`client_request_id`, `expires_at` at most 60 s ahead), `confirmed: true`, the job's
  `revision` (WisKey compares it), an attempt row committed before the send and an outcome row after; sent ONCE - a refusal says nothing
  changed, an unclear answer says it may have happened (reload before trying again).

Reads answer `{data, fetched_at}` (+ per-view extras); a failure is an HTTP error whose `details.state` / `details.wiskey_code` say why.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import Response
from pydantic import ConfigDict, Field, StrictInt

from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import wiskey_ops_views as ov
from ._common import raw_body as _raw_body, rid as _rid
from .access_control import CommandEnvelope, _Action, _envelope, _parse

router = APIRouter()

BASE = "/access-control/operations"
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
CODE_PATTERN = r"^[a-z0-9][a-z0-9_./:-]{0,63}$"
INSTALLATION_TYPE = "intercom_installation"
TREND_DAYS = (7, 30, 90, 365)
CSV_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


def _require_installation(conn: sqlite3.Connection, principal: Principal, permission: str, request_id: str | None) -> ia.Authority:
    """`permission` unrestricted at the installation: held there, and not denied on any scope a station can be in. Audited 403 else."""
    auth = ia.require_anywhere(conn, principal, permission, request_id)
    ia.require_unrestricted(auth, permission, request_id)
    return auth


def _viewer(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    return _require_installation(conn, principal, ia.READ, _rid(request))


def _admin(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    return _require_installation(conn, principal, ia.ADMIN_READ, _rid(request))


def _admin_check(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_installation(conn, principal, ia.ADMIN_READ, None)


admin_gate = read_gate(_admin_check)  # the cancel: the permission before the raw body is read


def _instant(name: str, value: str | None) -> str | None:
    if value is None or value == "":
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן ISO עם אזור זמן (למשל 2026-11-01T00:00:00Z).", details={"fields": [name]})
    return value


def _window(start: str | None, end: str | None) -> dict[str, str]:
    a, b = _instant("start", start), _instant("end", end)
    if a and b and datetime.fromisoformat(a.replace("Z", "+00:00")) >= datetime.fromisoformat(b.replace("Z", "+00:00")):
        raise ApiError(422, "validation", "תחילת הטווח חייבת להיות לפני סופו.", details={"fields": ["start", "end"]})
    return {k: v for k, v in (("start", a), ("end", b)) if v}


def _who(auth: ia.Authority) -> str:
    return auth.principal.user_id


def _export_row(auth: ia.Authority, request: Request, action: str, details: dict[str, Any]) -> None:
    audit(auth.conn, actor=auth.principal, action=action, decision="allowed", resource_type=INSTALLATION_TYPE, resource_id="*", request_id=_rid(request),
          details=details)


def _csv(data: bytes, filename: str, rows: int) -> Response:
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={**CSV_HEADERS, "Content-Disposition": f'attachment; filename="{filename}"', "X-Export-Rows": str(rows)})


def _person_view(auth: ia.Authority) -> dict[str, bool]:
    names = auth.unrestricted(ia.PEOPLE_READ)
    sensitive = auth.unrestricted(ia.PEOPLE_SENSITIVE)
    return {
        "names": names,
        "employee_numbers": names and auth.employee_no_for(ia.SENSITIVE if sensitive else ia.NAMES),
        "actors": auth.unrestricted(ia.ADMIN_READ),
    }


# ---------------------------------------------------------------- the overview (KPIs) and what this WisKey offers

@router.get(f"{BASE}/overview")
def overview(request: Request, auth: ia.Authority = Depends(_viewer)) -> dict[str, Any]:
    """The KPI row and the stations (from `overview/summary`), which views this WisKey lists, and what the caller may do here.
    The summary is a part of its own: when it fails the page still opens and says why."""
    settings = settings_of(request)
    part: dict[str, Any]
    try:
        part = {"state": "ready", **ov.run_read(settings, "summary", {}, _who(auth))}
    except ApiError as exc:
        part = {"state": "error", "code": exc.code, "message": exc.user_message, "details": exc.details}
    admin = auth.unrestricted(ia.ADMIN_READ)
    return {"summary": part, "views": ov.listed(settings), "can": {"admin": admin, "export": admin, "cancel": admin, **_person_view(auth)}}


# ---------------------------------------------------------------- operations and investigations

@router.get(f"{BASE}/operations")
def operations(
    request: Request,
    auth: ia.Authority = Depends(_viewer),
    kind: Literal["all", "sync", "bulk", "csv"] = Query("all"),
    state: Literal["all", "pending", "failed", "verified", "settled", "saved"] = Query("all"),
    station_id: str | None = Query(None, min_length=1, max_length=128, pattern=ID_PATTERN),
    query: str = Query("", max_length=128),
    offset: int = Query(0, ge=0, le=1_000_000),
    limit: int = Query(50, ge=1, le=200),
    snapshot: str = Query("", max_length=128),
) -> dict[str, Any]:
    """WisKey's durable access operations (sync per person and station, bulk edits, CSV imports) with their progress. The search
    matches operation ids, actions and WisKey ids only (operations_report.py), so it needs nothing beyond the view."""
    filters: dict[str, Any] = {"kind": kind, "state": state, "query": query.strip()}
    if station_id:
        filters["station_id"] = station_id
    return ov.run_read(settings_of(request), "operations", {"filters": filters, "offset": offset, "limit": limit, "snapshot": snapshot}, _who(auth))


@router.get(f"{BASE}/investigations")
def investigations(
    request: Request,
    auth: ia.Authority = Depends(_viewer),
    source: Literal["all", "access", "change", "sync"] = Query("all"),
    station_id: str | None = Query(None, min_length=1, max_length=128, pattern=ID_PATTERN),
    query: str = Query("", max_length=128),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    offset: int = Query(0, ge=0, le=1_000_000),
    limit: int = Query(50, ge=1, le=200),
    snapshot: str = Query("", max_length=64),
) -> dict[str, Any]:
    """The investigations timeline: entries, changes and synchronisation side by side (WisKey: "chronology is not causation"). Person
    fields as far as the caller may see them (module note); a hidden field is null and `fields_hidden` names it."""
    filters: dict[str, Any] = {"source": source, **_window(start, end)}
    if station_id:
        filters["station_id"] = station_id
    if query.strip():
        ia.require_unrestricted(auth, ia.PEOPLE_READ, _rid(request))  # WisKey matches the text on names and employee numbers
        if not _person_view(auth)["employee_numbers"]:
            ia.require_unrestricted(auth, ia.PEOPLE_SENSITIVE, _rid(request))
        filters["query"] = query.strip()
    reply = ov.run_read(settings_of(request), "investigations", {"filters": filters, "offset": offset, "limit": limit, "snapshot": snapshot}, _who(auth))
    view = _person_view(auth)
    data = reply["data"]
    for row in data["records"]:
        if not view["names"]:
            row["person_name"] = None
            row["user_id"] = None
        if not view["employee_numbers"]:
            row["employee_no"] = None
        if not view["actors"]:
            row["actor"] = None
    if not view["actors"]:
        data["actors"] = {}
    data["fields_hidden"] = [k for k, shown in (("person_name", view["names"]), ("employee_no", view["employee_numbers"]), ("actor", view["actors"])) if not shown]
    return reply


# ---------------------------------------------------------------- jobs

@router.get(f"{BASE}/jobs")
def jobs(request: Request, auth: ia.Authority = Depends(_viewer)) -> dict[str, Any]:
    """WisKey's resumable bulk / CSV jobs with their failed rows (row number and WisKey's code - no person). WisKey lists the jobs of
    the identity that created them: Arx sees the jobs created through Arx's own WisKey identity (the panel's own jobs are not listed)."""
    reply = ov.run_read(settings_of(request), "jobs", {}, _who(auth))
    reply["can_cancel"] = auth.unrestricted(ia.ADMIN_READ)
    return reply


@router.get(f"{BASE}/jobs/{{job_id}}/errors.csv")
def job_errors_csv(request: Request, auth: ia.Authority = Depends(_admin), job_id: str = Path(min_length=1, max_length=128, pattern=ID_PATTERN)) -> Response:
    """A job's failed rows as a file (`row, state, error`). Audited (`intercom.ops.export_job_errors`)."""
    reply = ov.run_read(settings_of(request), "job_errors", {"job_id": job_id}, _who(auth))
    rows = reply["data"]
    header = ("row", "state", "error")
    _export_row(auth, request, "intercom.ops.export_job_errors", {"job_id": job_id, "rows": len(rows), "columns": list(header)})
    return _csv(ov.csv_bytes(header, ([r["row"], r["state"], r["error"]] for r in rows)), "intercom-job-errors.csv", len(rows))


class CancelBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None  # only `true` confirms
    revision: StrictInt = Field(ge=0, le=10**9)


@router.post(f"{BASE}/jobs/{{job_id}}/cancel")
def cancel_job(
    request: Request,
    job_id: str = Path(min_length=1, max_length=128, pattern=ID_PATTERN),
    principal: Principal = Depends(admin_gate),
    raw: bytes = Depends(_raw_body),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict[str, Any]:
    """Cancel one job: its rows not yet saved are dropped; rows already saved keep synchronising (WisKey's own rule). Sent once."""
    act = _Action(request, conn, principal, "intercom.ops.job_cancel", job_id, resource_type="intercom_job")
    body = _parse(act, CancelBody, raw)
    not_after = _envelope(act, body)
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "ביטול משימה דורש אישור מפורש."))
    act.details.update(revision=body.revision)
    act.attempt()
    try:
        reply = ov.run_cancel(settings_of(request), job_id, body.revision, principal.user_id, not_after)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        code = str(exc.details.get("wiskey_code") or exc.code)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        details = {**exc.details, "operation": "cancel"}
        if outcome == "not_sent":
            raise ApiError(exc.status, exc.code, f"ביטול המשימה לא נשלח: {exc.user_message}", retryable=exc.retryable, details=details) from None
        if outcome == "refused":
            message = {
                "job_finished": "המשימה כבר הסתיימה או בוטלה, ולכן לא בוטלה שוב. לא בוצע שינוי.",
                "revision_conflict": "המשימה השתנתה מאז שנטענה. לא בוצע שינוי - טענו מחדש ונסו שוב.",
                "operation_not_found": "המשימה לא נמצאה (ייתכן שנוצרה בחשבון אחר). לא בוצע שינוי.",
            }.get(code, f"מערכת האינטרקום דחתה את הביטול ({code}). לא בוצע שינוי.")
            status = 409 if code in ("job_finished", "revision_conflict") else 404 if code == "operation_not_found" else 502
            raise ApiError(status, "ops_cancel_refused", message, details=details) from None
        raise ApiError(504, "ops_cancel_unknown", f"הביטול נשלח, אך לא התקבלה תשובה ברורה ({code}). ייתכן שהמשימה בוטלה - טענו מחדש את הרשימה לפני שמנסים שוב.",
                       details=details) from None
    except BaseException as exc:
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        raise
    finally:
        conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
    job = reply["cancel"]
    act.outcome("ok", None, {"result": {"state": job["state"], "revision": job["revision"]}})
    return {"status": "completed", "command_id": act.details["command_id"], "at": reply.get("fetched_at"), "job": job}


# ---------------------------------------------------------------- capacity and trends

@router.get(f"{BASE}/capacity")
def capacity(request: Request, auth: ia.Authority = Depends(_viewer), days: int = Query(30, ge=1, le=400)) -> dict[str, Any]:
    """Per station: users and cards against the advertised limits, WisKey's own growth estimate, and Arx's stored trend (the samples
    of the last `days` days - 7, 30, 90 or 365; a new fresh WisKey sample is stored as it is read - migration 0200)."""
    if days not in TREND_DAYS:
        raise ApiError(422, "validation", "טווח המגמה חייב להיות 7, 30, 90 או 365 ימים.", details={"fields": ["days"]})
    reply = ov.run_read(settings_of(request), "capacity", {}, _who(auth))
    db = request.app.state.db
    with db.write_aside() as w:
        added = ov.record_samples(w, reply["data"])
        trend = ov.series(w, days)
    reply["trend"] = {"days": days, "series": trend, "stored_now": added}
    return reply


# ---------------------------------------------------------------- the events report

@router.get(f"{BASE}/events-report")
def events_report(
    request: Request,
    auth: ia.Authority = Depends(_viewer),
    station_id: str | None = Query(None, min_length=1, max_length=128, pattern=ID_PATTERN),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
) -> dict[str, Any]:
    """WisKey's aggregate report of the entry log (totals, by day in the station's zone, by station, methods, anomalies) - counts only,
    no record and no person (`events/report`, never `events/print`)."""
    filters: dict[str, Any] = _window(start, end)
    if station_id:
        filters["station_id"] = station_id
    return ov.run_read(settings_of(request), "events_report", {"filters": filters}, _who(auth))


# ---------------------------------------------------------------- exports (administrator, audited, formula-safe)

@router.get(f"{BASE}/exports/fleet-inventory.csv")
def fleet_inventory_csv(request: Request, auth: ia.Authority = Depends(_admin)) -> Response:
    """The stations' cached inventory (model, firmware, sync, capacity) as a file - from WisKey's `fleet/inventory_export` JSON, written
    as CSV by Arx (never WisKey's own CSV). No device address, credential or person. Audited (`intercom.ops.export_inventory`)."""
    reply = ov.run_read(settings_of(request), "inventory", {"format": "json"}, _who(auth))
    rows = reply["data"]["stations"]
    _export_row(auth, request, "intercom.ops.export_inventory", {"rows": len(rows), "columns": list(ov.INVENTORY_FIELDS)})
    return _csv(ov.csv_bytes(ov.INVENTORY_FIELDS, ([r[k] for k in ov.INVENTORY_FIELDS] for r in rows)), "intercom-fleet-inventory.csv", len(rows))


@router.get(f"{BASE}/exports/audit.csv")
def audit_csv(
    request: Request,
    auth: ia.Authority = Depends(_admin),
    station_id: str | None = Query(None, min_length=1, max_length=128, pattern=ID_PATTERN),
    action: str | None = Query(None, pattern=CODE_PATTERN),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
) -> Response:
    """The intercom's own change log (what was changed in its panel and through it, 30 days) as a file. The name column needs
    `access.people.read`, the employee number `access.people.sensitive` (or names level) - each unrestricted; otherwise the column is
    left out. Audited (`intercom.ops.export_audit`: filters, rows, columns)."""
    filters: dict[str, Any] = _window(start, end)
    if station_id:
        filters["station_id"] = station_id
    if action:
        filters["action"] = action
    reply = ov.run_read(settings_of(request), "audit_export", {"filters": filters}, _who(auth))
    view = _person_view(auth)
    data = reply["data"]
    columns = [c for c in ov.AUDIT_FIELDS if (c != "name" or view["names"]) and (c != "employee_no" or view["employee_numbers"])]
    columns.insert(columns.index("actor") + 1, "actor_name")
    actors = data["actors"]

    def cells(r: dict[str, Any]) -> list[Any]:
        full = {
            "time_utc": r["time"], "actor": r["actor"], "actor_name": actors.get(r["actor"] or "") if r["actor"] else None, "action": r["action"],
            "user_id": r["user_id"], "name": r["name"], "employee_no": r["employee_no"], "stations": ";".join(r["stations"]),
            "changed_fields": ";".join(r["fields"]), "revision_before": r["revision_before"], "revision_after": r["revision_after"], "reason_code": r["reason_code"],
        }
        return [full[c] for c in columns]

    rows = data["records"]
    _export_row(auth, request, "intercom.ops.export_audit", {"filters": filters, "rows": len(rows), "columns": columns})
    return _csv(ov.csv_bytes(columns, (cells(r) for r in rows)), "intercom-change-log.csv", len(rows))


def reset() -> None:
    """Tests: nothing in-process to reset yet (the cancel uses the shared people-write lane's limits)."""
