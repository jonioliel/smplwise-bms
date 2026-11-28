"""Recording search (chapter 23, T027): `GET /cameras/{id}/recordings?date=YYYY-MM-DD` (a local day in the
installation's zone) or `?from=<UTC>&to=<UTC>`. Coverage is reported honestly: complete | partial."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..auth import current_principal_ro, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError, field_error
from ..i18n import localize_for
from ..i18n import t as _t
from ..services import video_text  # noqa: F401 - `recordings.*` texts (FIX-VIDEO2-2570)
from ..rbac import Principal
from ..services import recorded_days, recordings
from ..services import recordings_store as store
from ..services.access import require_camera
from ..services.timeutil import iso_utc, local_day_bounds, parse_utc, zone
from ..services.settings_store import setting_value
from ..wire import recordings as W
from ..wire import wire

router = APIRouter()


def camera_for_playback(conn: sqlite3.Connection, principal: Principal, camera_id: str) -> sqlite3.Row:
    require_camera(conn, principal, camera_id, "video.playback")  # T055: 403 before 404
    cam = store.camera(conn, camera_id)
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    return cam


@router.get("/cameras/{camera_id}/recordings", **wire(W.RecordingSearch))
def camera_recordings(
    camera_id: str,
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
) -> dict[str, Any]:
    cam = camera_for_playback(conn, principal, camera_id)
    tz_name = setting_value(conn, "time.zone")
    if date:
        try:
            day = dt.date.fromisoformat(date)
        except ValueError:  # FIX-VIDEO2-2570 (VD2-07): "2026-02-30" passes the pattern but is no date - a 422, not a 500
            raise field_error(_t("recordings.invalid_date"), ["date"], problems=[{"field": "date", "code": "invalid_date"}], extra={"value": date}) from None
        start, end = local_day_bounds(day, zone(tz_name))
    elif from_ and to:
        try:
            start, end = parse_utc(from_), parse_utc(to)
        except ValueError as exc:
            raise ApiError(422, "validation", "זמן חייב לכלול אזור זמן (UTC).", details={"error": str(exc)})
    else:
        raise ApiError(422, "validation", "יש לציין date או from+to.")
    with unlocked(conn):
        result = recordings.search_segments(settings_of(request), conn, cam, start, end, tz_name)
    out = recordings.as_dict(result)
    out.update({"camera_id": cam["id"], "from": iso_utc(start), "to": iso_utc(end), "track_id": cam["main_track"]})
    return localize_for(conn, principal, out)  # FIX-VIDEO2-2570: the coverage note in the reader's language


@router.get("/cameras/{camera_id}/recordings/days", **wire(W.RecordedDays))
def camera_recorded_days(
    camera_id: str,
    request: Request,
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> dict[str, Any]:
    """RECORDED-DAYS-MONTH-2407: the local dates of `month` (YYYY-MM, the installation's zone) on which the camera has any
    recording - the month view of the playback screen. Read-only on the NVR, cached (services/recorded_days.py)."""
    cam = camera_for_playback(conn, principal, camera_id)
    tz_name = setting_value(conn, "time.zone")
    with unlocked(conn):
        result = recorded_days.days_in_month(settings_of(request), cam, month, tz_name)
    out = recorded_days.as_dict(result)
    out["camera_id"] = cam["id"]
    return out
