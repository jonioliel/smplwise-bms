"""HOME-V3-FOLLOWUP-B-2431 (owner answer 2026-11-11 q1): a wall panel locked to its room adds an event to the FAMILY calendar.

* `POST /home/wall/events` - only for a wall panel (the person's home policy has `kiosk`); anyone else uses the calendar module's own
  POST /calendar/events. The one calendar write a wall panel may make: services/home_interface refuses its other calendar writes
  (booking a shared room, the availability search, cancel / withdraw) with 403 `kiosk_calendar_add_only`.

What it accepts: a title, a start and an end (UTC instants) or an all-day flag, and optionally which family calendar. Always kind
"event"; never a room, a series, guests, attendees or a maintenance window (the body forbids every other field). The calendar must be
a family calendar (type `team` or `event`, not archived); the calendar module's own create runs with the panel's own principal, so the
panel's calendar role (`book` or above, which also needs `calendar.book`) and every validation of the module still apply. The module
switch answers 404 `feature_disabled`; the panel's hidden "calendar" home category answers 403 `home_module_off`. Audited as the
module's own `calendar.event.create` with `via: wall_panel`.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, get_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services import home_interface as hi

router = APIRouter()
FAMILY_TYPES = ("team", "event")
CAL_ID = r"^[A-Za-z0-9_\-]{1,64}$"


class WallEventBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    start: str = Field(min_length=10, max_length=40)
    end: str = Field(min_length=10, max_length=40)
    all_day: bool = False
    calendar_id: str | None = Field(default=None, max_length=64, pattern=CAL_ID)


def _family_calendars(ctx: Any) -> list[sqlite3.Row]:
    """The family calendars the panel may add to (visible, not archived, role `book` or above), in name order."""
    from ..services.calendar import model
    from ..services.calendar.access import get_visible

    out = []
    for r in ctx.conn.execute("SELECT id FROM cal_calendars WHERE archived_at IS NULL AND type IN (?, ?) ORDER BY name_key", FAMILY_TYPES).fetchall():
        try:
            cal = get_visible(ctx, r["id"])
        except ApiError:
            continue
        role = ctx.role_in(cal)
        if role is not None and model.ROLE_RANK[role] >= model.ROLE_RANK["book"]:
            out.append(cal)
    return out


@router.post("/home/wall/events", status_code=201)
def wall_event(body: WallEventBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from . import calendar as cr
    from ..services.calendar import events, model
    from ..services.calendar.access import get_visible

    if not model.read_settings(conn)["enabled"]:
        raise ApiError(404, "feature_disabled", cr.OFF_HE)
    pol = hi.effective(conn, principal.user_id)
    if not pol["kiosk"]:
        raise ApiError(403, "wall_panel_only", "הפעולה הזו שמורה למסך קיר.")
    if pol["modules"] is not None and "calendar" not in pol["modules"]:
        raise ApiError(403, "home_module_off", "המסך הזה לא הופעל עבורך.")
    ctx = cr._ctx(request, conn, principal)
    with cr._errors(conn, principal, request):
        if body.calendar_id:
            cal = get_visible(ctx, body.calendar_id)
            if cal["type"] not in FAMILY_TYPES:
                raise ApiError(403, "wall_family_calendar_only", "ממסך הקיר אפשר להוסיף אירוע רק ליומן המשפחתי.")
        else:
            fam = _family_calendars(ctx)
            if not fam:
                raise ApiError(403, "forbidden", "אין יומן משפחתי שאפשר להוסיף אליו.", details={"permission": model.PERM_BOOK})
            cal = fam[0]
        data = {"calendar_id": cal["id"], "kind": "event", "title": body.title.strip(), "start": body.start, "end": body.end, "all_day": body.all_day}
        if not data["title"]:
            raise ApiError(422, "validation", "כתבו מה האירוע.", details={"field": "title"})
        out = events.create(ctx, model.read_settings(conn), data, cr._now())
        ev = out["event"]
        cr._audit(conn, principal, request, "calendar.event.create", "calendar_event", ev["id"], calendar_id=ev["calendar_id"], state=out["state"], recurring=False, via="wall_panel")
        return out
