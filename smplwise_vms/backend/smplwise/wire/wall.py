"""Response models of the wall display API (routers/wall.py, `/api/v1/wall/...`; CR-030 v2, WDM S1, WALL-ANSWERS-2400, ANNOUNCEB-295):
the display's own reads, the profile administration and the photo sets. The profile's `config` is the stored wall configuration document
(services/wall.WallConfig, validated on write) and is passed through as stored. Field order is the order the router builds its dicts in."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body (images, 204)
NO_JSON = frozenset({
    "GET /wall/frame/{photo_id}", "GET /wall/photo-sets/{set_id}/photos/{photo_id}", "DELETE /wall/photo-sets/{set_id}/photos/{photo_id}",
})


class WallAlert(WireModel):
    """An open notification the display shows (services/wall_alerts.alerts_for): critical first, then newest."""
    id: str
    source: str
    category: str
    severity: Literal["info", "alert", "critical"]
    title: str
    place: str | None
    body: str
    count: int
    first_at: str
    last_at: str
    camera_id: str | None


class WallAlerts(WireModel):
    alerts: list[WallAlert]


class WallAnnouncementText(WireModel):
    language: str
    text: str
    machine: bool = None
    """ANNOUNCE-297: present (true) only for a machine-translated part."""


class WallAnnouncementShown(WireModel):
    id: str
    critical: bool
    until: str
    texts: list[WallAnnouncementText]


class WallAnnouncement(WireModel):
    """ANNOUNCEB-295: the voice announcement this display shows now (text only), or null; `poll_s` 0 = the display is not a target."""
    poll_s: int
    critical_close_s: int
    announcement: WallAnnouncementShown | None


class WallAcknowledged(WireModel):
    acknowledged: bool


class WallSeen(WireModel):
    seen: bool


class WallPhoto(WireModel):
    id: str
    w: int
    h: int


class WallPhotos(WireModel):
    photos: list[WallPhoto]


class WallCamera(WireModel):
    id: str
    name: str


class WallConfig(WireModel):
    """`GET /wall/config`: what the display shows - its cameras (the configured order, limited to the user's bindings), the stored
    configuration document, the clock and the open alerts."""
    title: str
    area_id: str | None
    floor_id: str | None
    version: int
    config: dict[str, Any]
    cameras: list[WallCamera]
    server_time: str
    zone: str
    alerts: list[WallAlert]


class WallState(WireModel):
    id: str
    state: str | None
    unit: str | None
    name: str


class WallStates(WireModel):
    states: list[WallState]


class WallProfile(WireModel):
    """A wall profile as Settings > wall displays lists it (services/wall.profile_dict). `has_other_roles` only on create."""
    user_id: str
    username: str
    display_name: str
    title: str
    area_id: str | None
    floor_id: str | None
    enabled: bool
    remote_allowed: bool
    desktop: bool
    version: int
    config: dict[str, Any]
    status: Literal["disabled", "connected", "never", "not_connected"]
    connections: int
    last_seen_at: str | None
    last_channel: str | None
    created_at: str
    updated_at: str
    camera_names: list[str]
    has_other_roles: bool = None


class WallProfiles(WireModel):
    profiles: list[WallProfile]
    max_profiles: int
    foldable_open: Literal["tablet", "phone"]


class WallSettings(WireModel):
    """WALL-ANSWERS-2400: how an unfolded foldable is classified (`tablet` = the wall display, default; `phone` = the application)."""
    foldable_open: Literal["tablet", "phone"]


class WallCandidate(WireModel):
    id: str
    username: str
    display_name: str


class WallCandidates(WireModel):
    users: list[WallCandidate]


class WallProfileRemoved(WireModel):
    removed: bool
    sessions_dropped: int


class WallPhotoSet(WireModel):
    """A picture-frame photo set; `used_by` (the titles of the profiles that show it) only in the listing."""
    id: str
    name: str
    count: int
    bytes: int
    used_by: list[str] = None


class WallPhotoLimits(WireModel):
    max_files: int
    max_bytes: int
    formats: list[str]


class WallPhotoSets(WireModel):
    sets: list[WallPhotoSet]
    limits: WallPhotoLimits


class WallPhotoUploaded(WireModel):
    id: str
    w: int
    h: int
    bytes: int


class WallPhotoSetDeleted(WireModel):
    deleted: bool
    profiles_turned_off: int
