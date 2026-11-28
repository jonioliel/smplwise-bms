"""Response models of the playback sessions (routers/playback.py: `/api/v1/playback/sessions...`; chapter 24). A session is
services/playback.to_dict (contracts/schemas/playback-session.schema.json); the media itself goes over the session's WebSocket."""
from __future__ import annotations

from typing import Any, Literal

from . import Num, WireModel

# every HTTP route answers JSON (the media socket is not an HTTP route of the table)
NO_JSON: frozenset[str] = frozenset()


class PlaybackCapabilities(WireModel):
    """T066: slow motion and frame stepping are real on the MSE path; `supported_speeds` = [0.25, 0.5, 1]."""
    seek: bool
    pause: bool
    frame_step: bool
    supported_speeds: list[Num]


class PlaybackSession(WireModel):
    """One playback session. `actual_start_at` / `actual_end_at` / `media_anchor` stay null until a verified media anchor fills them
    (chapter 24); `media_handle` = the WebSocket path of this generation, null once the session is over. `moved_to_next_segment`
    (create / seek only) = the asked time had no recording and the session starts at the next segment. `clock_change_note` (create / seek
    only, FIX-VIDEO2-2570) = the start is in the hour the autumn clock change repeats: the recorder may play the other occurrence."""
    id: str
    camera_id: str
    generation: int
    state: str
    requested_at: str
    actual_start_at: str | None
    actual_end_at: str | None
    media_anchor: Any
    time_precision: Literal["verified", "keyframe_limited", "estimated", "unknown"]  # the contract's set; the relay sends keyframe_limited today
    media_handle: str | None
    expires_at: str
    capabilities: PlaybackCapabilities
    playback_end_at: str
    username: str
    bytes_down: int
    seconds: int
    moved_to_next_segment: bool = None
    clock_change_note: str = None


class PlaybackSessions(WireModel):
    """The caller's live sessions (a system administrator: everyone's), the quota and the lease."""
    sessions: list[PlaybackSession]
    max_sessions: int
    lease_s: int


class PlaybackClosed(WireModel):
    id: str
    state: str
