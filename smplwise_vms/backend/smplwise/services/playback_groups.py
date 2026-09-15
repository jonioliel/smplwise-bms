"""Playback groups (chapter 25): one reference time and generation for 2–4 cameras, each with its own
session and state. No verified PTS↔UTC anchor exists for RTSP playback, so a group is "best effort"
by definition and says so; a camera without a recording at the group time is reported as missing,
never shown as a frozen frame next to a "playing" badge."""
from __future__ import annotations

import datetime as dt
import time
from dataclasses import dataclass, field
from typing import Any

from ..config import Settings
from . import playback as pb
from .timeutil import iso_utc


@dataclass
class PlaybackGroup:
    id: str
    user_id: str
    requested_at: dt.datetime
    session_ids: list[str] = field(default_factory=list)
    missing: dict[str, str] = field(default_factory=dict)  # camera_id -> reason (gap | no_recording | playback_quota …)
    generation: int = 0
    created: float = field(default_factory=time.time)


GROUPS: dict[str, PlaybackGroup] = {}


def sessions_of(group: PlaybackGroup) -> list[pb.PlaybackSession]:
    return [pb.REGISTRY.sessions[s] for s in group.session_ids if s in pb.REGISTRY.sessions]


def to_dict(group: PlaybackGroup, lease_s: int) -> dict[str, Any]:
    return {
        "id": group.id,
        "requested_at": iso_utc(group.requested_at),
        "generation": group.generation,
        "sessions": [pb.to_dict(s, lease_s) for s in sessions_of(group)],
        "missing": group.missing,
        "sync": "best_effort",
    }


def close_group(settings: Settings, group: PlaybackGroup) -> None:
    for s in sessions_of(group):
        if s.state not in ("closed", "expired", "failed"):
            pb.close(settings, s)
    GROUPS.pop(group.id, None)


def expire_empty() -> None:
    """Drop groups whose sessions are all gone (closed by the janitor or the user)."""
    for gid, group in list(GROUPS.items()):
        if not any(s.state not in ("closed", "expired", "failed") for s in sessions_of(group)) and time.time() - group.created > 60:
            GROUPS.pop(gid, None)
