"""הגדרות › וידאו ומדיה › שירות וידאו (HEALTH-GO2RTC-FOLLOWUP-2431): the go2rtc services this installation runs, and the choice of one.

Every route: `system.configure` at installation scope, checked FIRST. Local sessions only (remote_channel.BLOCKED_ON_REMOTE). Discovery
and probes run outside the request's write lock (`unlocked`); no route ever writes to a video service (services/video_services.py).

- `GET    /system/video-services[?fresh=true]`  the address in use (host:port only, and from where: the choice, the add-on option or
                                                  none), the stored choice and every candidate with its state, version and probe outcome.
- `PUT    /system/video-services/selection`     `{"slug": ...}` - a candidate of a FRESH discovery; stored, applied to requests at once.
- `DELETE /system/video-services/selection`     back to the add-on option `go2rtc_url`.
Both writes are audited (`media.video_service.select` / `.clear`, the slug and name only)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, get_read_conn, read_gate, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import media_reach
from ..services import video_services as vs

router = APIRouter()

PERMISSION = "system.configure"
_admin_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


class SelectIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_]{1,64}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _view(request: Request, conn: sqlite3.Connection, fresh: bool = False) -> dict[str, Any]:
    sel = vs.selection(conn)
    settings = settings_of(request)
    with unlocked(conn):
        return vs.view(settings, sel, vs.option_url(request.app), fresh=fresh)


@router.get("/system/video-services")
def list_video_services(request: Request, fresh: bool = False, principal: Principal = Depends(_admin_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The go2rtc services found on this installation, their state and probe outcome, and which one is in use (administrators)."""
    return _view(request, conn, fresh)


@router.put("/system/video-services/selection")
def select_video_service(body: SelectIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Use one found video service (by slug); it takes precedence over the add-on option go2rtc_url, at once and at every start."""
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = settings_of(request)
    if not vs.self_update.configured(settings):
        raise ApiError(409, "video_services_unsupported", "בהתקנה הזאת אי אפשר לזהות שירותי וידאו; כתובת שירות הווידאו נקבעת בתצורת התוסף.")
    with unlocked(conn):
        cand = vs.find(settings, body.slug)
    if cand is None:
        raise ApiError(404, "video_service_unknown", "שירות הווידאו שנבחר לא נמצא. רעננו את הרשימה ובחרו שוב.")
    row = vs.remember(conn, cand, principal.display_name or principal.username or None)
    audit(conn, actor=principal, action="media.video_service.select", decision="allowed", resource_type="installation", resource_id="video_service",
          request_id=_rid(request), details={"slug": cand["slug"], "name": cand["name"], "state": cand["state"], "probe": cand["probe"]})
    vs.apply_live(request.app, row["url"])
    with unlocked(conn):
        media_reach.REACH.tick(settings_of(request))  # the first contact with the chosen service now, not on the next janitor pass
    out = _view(request, conn)
    out["restart_recommended"] = True
    return out


@router.delete("/system/video-services/selection")
def clear_video_service(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Drop the chosen video service: the add-on option go2rtc_url applies again."""
    require(conn, principal, PERMISSION, INSTALLATION)
    had = vs.clear(conn)
    audit(conn, actor=principal, action="media.video_service.clear", decision="allowed", resource_type="installation", resource_id="video_service",
          request_id=_rid(request), details={"had_selection": had})
    if had:
        vs.apply_live(request.app, vs.option_url(request.app))
        with unlocked(conn):
            media_reach.REACH.tick(settings_of(request))
    out = _view(request, conn)
    out["restart_recommended"] = had
    return out
