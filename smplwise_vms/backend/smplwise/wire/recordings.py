"""Response models of the recording search (routers/recordings.py: `GET /api/v1/cameras/{camera_id}/recordings`,
`GET /api/v1/cameras/{camera_id}/recordings/days`; chapter 23, T027, RECORDED-DAYS-MONTH-2407). The bodies are the dataclasses of
services/recordings (`SearchResult`, `Segment`) and services/recorded_days (`MonthDays`), plus the router's own keys."""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class RecordingSegment(WireModel):
    """One recorded span in UTC (`start_raw` / `end_raw`: the device's own spelling); `kind` continuous | motion | alarm | event | manual |
    unknown."""
    start_at: str
    end_at: str
    kind: str
    track_id: int
    start_raw: str
    end_raw: str


class RecordingSearch(WireModel):
    """The segments of the window and how honest the answer is (`coverage` complete | partial | unknown; `note` the reason)."""
    segments: list[RecordingSegment]
    coverage: Literal["complete", "partial", "unknown"]
    matches: int
    pages: int
    searched_at: str
    timezone: str
    note: str
    camera_id: str
    from_: str = Field(alias="from")
    to: str
    track_id: int | None


class RecordedDays(WireModel):
    """The local dates of `month` with any recording; `through` = the last date asked (null for a future month); `source` = how the
    recorder was read."""
    month: str
    timezone: str
    days: list[str]
    source: str
    coverage: Literal["complete", "partial"]
    through: str | None
    searched_at: str
    note: str
    camera_id: str
