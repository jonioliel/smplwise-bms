"""Response model of the home screen's alarm log (routers/home_gaps.py: `GET /api/v1/home/alarm-log`)."""
from __future__ import annotations

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class AlarmLogItem(WireModel):
    """One confirmed arm / disarm of a panel the caller may view: when (confirmed, else requested), the panel entity, the mode word
    (`away`, `home`, `disarm` ...: services/alarm.ACTIONS inverted), who (null for an unknown actor) and whether it was the caller."""
    at: str
    panel: str
    action: str
    by: str | None
    me: bool


class AlarmLog(WireModel):
    """The last `days` days, newest first (at most 60 items)."""
    items: list[AlarmLogItem]
    days: int
