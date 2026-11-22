"""Response models of the synchronised playback groups (routers/playback_groups.py: `/api/v1/playback/groups...`; T042, CR-024). A group
is services/playback_groups.to_dict; its members are playback sessions (wire/playback.PlaybackSession)."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel
from .playback import PlaybackSession

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class SyncReport(WireModel):
    """What the browser measured against its master clock (T042), stored on the group with the time it arrived."""
    p95_s: float | None
    quality: str
    samples: int
    partial: bool
    members: dict[str, Any]
    reported_at: str


class PlaybackGroup(WireModel):
    """The members that started, the cameras that did not (camera id -> reason: gap | no_recording | playback_quota ...), and the sync
    mode; `experimental` / `recorders` (per recorder the zone and clock offset) only for members on different recorders (CR-024)."""
    id: str
    requested_at: str
    generation: int
    sessions: list[PlaybackSession]
    missing: dict[str, str]
    sync: Literal["experimental_cross_recorder", "best_effort"]
    sync_report: SyncReport | None
    experimental: bool = None
    recorders: dict[str, dict[str, Any]] = None


class GroupSyncStored(WireModel):
    ok: bool
    sync_report: SyncReport


class GroupClosed(WireModel):
    id: str
    state: Literal["closed"]
