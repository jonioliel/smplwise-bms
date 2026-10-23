"""COMPLY108-295 (docs/changes/CR-COMPLY108.md): the compliance export - who COULD enter which door, and when (read-only, derived).

- GET /compliance/access/settings        system administrator: {compliance_export: off|on}
- PUT /compliance/access/settings        system administrator
- GET /compliance/access/matrix          JSON; `at` (a point in time, default now) OR `start` + `end` (a period of at most 93 days)
- GET /compliance/access/matrix.csv      the same as CSV (UTF-8 with BOM, every cell quoted, formula-safe)

Query (both matrix routes): `station_id`, `group` (narrow), `include_excluded` (also list who could NOT enter, with the closed reason).
Gate, in this order: `access.events.export` somewhere (audited 403) -> the switch `access.compliance_export` (default off, 404
`compliance_export_off`) -> an interactive human session (403) -> one export a minute per user (429) -> the asked range. Rows exist
only for stations on which the caller holds `access.events.export` AND `access.people.read` (rbac deny-overrides over the station chain).
Every successful export and every refusal is audited (ids and counts only - never a name, a row or a value). Nothing is stored."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..db import set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import access_external as ax
from ..services import access_grants as ag
from ..services import compliance_export as ce
from ..services import intercom_authority as ia

router = APIRouter()
_BASE = "/compliance/access"
ID = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
ACTION = "compliance.access_matrix.export"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    compliance_export: Literal["off", "on"]


def _admin_only(conn: sqlite3.Connection, principal: Principal, request: Request, action: str) -> None:
    require(conn, principal, "system.configure", INSTALLATION)
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action=action, decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"keys": list(ce.KEYS)})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לטפל בהגדרה זו.")


@router.get(f"{_BASE}/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _admin_only(conn, principal, request, "settings.read")
    return ce.settings_view(conn)


@router.put(f"{_BASE}/settings")
def put_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    with request.app.state.db.connection(label="compliance_export.settings") as conn:
        _admin_only(conn, principal, request, "settings.changed")
        before = ce.settings_view(conn)["compliance_export"]
        set_setting(conn, ce.FLAG_KEY, body.compliance_export)
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"key": ce.FLAG_KEY, "before": before, "after": body.compliance_export})
        return ce.settings_view(conn)


def _refuse(conn: sqlite3.Connection, principal: Principal, request: Request, reason: str, error: ApiError, **details: Any) -> ApiError:
    audit(conn, actor=principal, action=ACTION, decision="denied", resource_type="installation", resource_id="*", reason=reason,
          request_id=_rid(request), details=details or None)
    return error


def _instant(name: str, value: str | None) -> datetime | None:
    if value is None:
        return None
    at =ag.parse_iso(value) if len(value) <= 40 else None
    if at is None or at.tzinfo is None:
        raise ApiError(422, "compliance_instant_invalid", "זמן לא תקין. יש לציין שעה עם אזור זמן.", details={"field": name})
    return at.astimezone(timezone.utc)


def _run(request: Request, principal: Principal, conn: sqlite3.Connection, fmt: str, at: str | None, start: str | None, end: str | None,
         station_id: str | None, group: str | None, include_excluded: bool) -> tuple[dict[str, Any], list[list[Any]] | None]:
    ia.require_anywhere(conn, principal, ia.EVENTS_EXPORT, _rid(request))
    if not ce.enabled(conn):
        raise _refuse(conn, principal, request, "feature_off", ApiError(404, "compliance_export_off", "ייצוא הציות כבוי."))
    if not ag._interactive(principal):
        raise _refuse(conn, principal, request, "not_interactive", ApiError(403, "compliance_interactive_required", "הייצוא זמין רק במושב אינטראקטיבי של משתמש."))
    wait = ce.wait_s(principal.user_id)
    if wait > 0:
        raise _refuse(conn, principal, request, "rate", ApiError(429, "export_rate", "אפשר לייצא פעם בדקה. נסו שוב בעוד רגע.", retryable=True,
                                                                 details={"retry_after_s": int(wait) + 1}))
    if (at is not None) and (start is not None or end is not None):
        raise ApiError(422, "compliance_range_ambiguous", "יש לציין זמן אחד (at) או תקופה (start ו-end), לא את שניהם.")
    if (start is None) != (end is None):
        raise ApiError(422, "compliance_period_incomplete", "תקופה דורשת גם start וגם end.")
    if start is not None:
        window = ce.Window.period(_instant("start", start), _instant("end", end))  # type: ignore[arg-type]
    else:
        window = ce.Window.at(_instant("at", at) or ag.now().astimezone(timezone.utc))
    try:
        matrix = ce.build(conn, settings_of(request), principal, window, station_id=station_id, group=group, include_excluded=include_excluded)
    except ApiError as exc:
        audit(conn, actor=principal, action=ACTION, decision="denied", resource_type="installation", resource_id=station_id or "*", reason=exc.code,
              request_id=_rid(request), details={"format": fmt, "kind": "point" if window.point else "period"})
        raise
    cells = ce.csv_cells(matrix) if fmt == "csv" else None
    audit(conn, actor=principal, action=ACTION, decision="allowed", resource_type="installation", resource_id=station_id or "*", request_id=_rid(request),
          details={"format": fmt, "kind": matrix["kind"], "at": matrix["at"], "from": matrix["from"], "to": matrix["to"], "station_filter": station_id is not None,
                   "group_filter": group is not None, "include_excluded": include_excluded, "people": matrix["people"], "rows": len(matrix["rows"]),
                   "door_windows": len(matrix["door_windows"]), "unknown": len(matrix["unknown"])})
    ce.mark(principal.user_id)
    return matrix, cells


@router.get(f"{_BASE}/matrix")
def matrix_json(
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    at: str | None = Query(None, max_length=40),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    station_id: str | None = Query(None, pattern=ID),
    group: str | None = Query(None, pattern=ID),
    include_excluded: bool = Query(False),
) -> JSONResponse:
    matrix, _ = _run(request, principal, conn, "json", at, start, end, station_id, group, include_excluded)
    return JSONResponse(matrix, headers={"Cache-Control": "private, no-store", "X-Export-Rows": str(len(matrix["rows"]))})


@router.get(f"{_BASE}/matrix.csv")
def matrix_csv(
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    at: str | None = Query(None, max_length=40),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    station_id: str | None = Query(None, pattern=ID),
    group: str | None = Query(None, pattern=ID),
    include_excluded: bool = Query(False),
) -> StreamingResponse:
    matrix, cells = _run(request, principal, conn, "csv", at, start, end, station_id, group, include_excluded)
    assert cells is not None
    return StreamingResponse(ax.export_stream(cells), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": 'attachment; filename="access-matrix.csv"', "Cache-Control": "private, no-store",
                                      "X-Export-Rows": str(len(matrix["rows"]))})
