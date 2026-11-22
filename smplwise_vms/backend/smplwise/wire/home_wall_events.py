"""Response model of an event added from a wall panel (routers/home_wall_events.py: `POST /api/v1/home/wall/events`). The answer is
services/calendar/events.create's: the calendar event itself is the calendar module's document (passed through here; the calendar
router's models own its shape)."""
from __future__ import annotations

from typing import Any

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class WallEventRoomRequest(WireModel):
    room_calendar_id: str
    state: str
    contested: bool


class WallEventWarnings(WireModel):
    outside_hours: bool
    holiday_hits: list[str]


class WallEventCreated(WireModel):
    """201: the new event (calendar document), its state, the room requests it made and the findings (outside the opening hours, the
    holidays it touches)."""
    event: dict[str, Any]
    state: str
    requests: list[WallEventRoomRequest]
    warnings: WallEventWarnings
