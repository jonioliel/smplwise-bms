"""Recording search (chapter 23, T027): `GET /cameras/{id}/recordings?date=YYYY-MM-DD` (a local day in the
installation's zone) or `?from=<UTC>&to=<UTC>`. Coverage is reported honestly: complete | partial."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal, require
from ..services import recordings
from ..services.access import camera_allowed
from ..services.timeutil import iso_utc, local_day_bounds, parse_utc, zone
from .settings import read_settings

router = APIRouter()


def camera_for_playback(conn: sqlite3.Connection, principal: Principal, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not camera_allowed(conn, principal, camera_id, "video.playback"):
        require(conn, principal, "video.playback", ("installation", "*"))  # raises 403 with an audit row
    return cam


@router.get("/cameras/{camera_id}/recordings")
def camera_recordings(
    camera_id: str,
    request: Request,
    principal: Principal = Depends(current_principal),
    conn: sqlite3.Connection = Depends(get_conn),
    date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
) -> dict[str, Any]:
    cam = camera_for_playback(conn, principal, camera_id)
    s = read_settings(conn)
    tz_name = s["time.zone"]
    if date:
        start, end = local_day_bounds(dt.date.fromisoformat(date), zone(tz_name))
    elif from_ and to:
        try:
            start, end = parse_utc(from_), parse_utc(to)
        except ValueError as exc:
            raise ApiError(422, "validation", "זמן חייב לכלול אזור זמן (UTC).", details={"error": str(exc)})
    else:
        raise ApiError(422, "validation", "יש לציין date או from+to.")
    result = recordings.search_segments(settings_of(request), conn, cam, start, end, tz_name)
    out = recordings.as_dict(result)
    out.update({"camera_id": cam["id"], "from": iso_utc(start), "to": iso_utc(end), "track_id": cam["main_track"]})
    return out
