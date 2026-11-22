"""Response model of the accepted camera of a zone (routers/camera_suggest.py: `GET|PUT|DELETE /api/v1/zones/{zone_id}/suggested-camera`;
CAMSUGGEST138-295)."""
from __future__ import annotations

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class ZoneCameraLink(WireModel):
    """The camera pin an editor accepted for the zone; `anchor_id` / `updated_at` are null when none was accepted (or the pin was
    removed since, or the stored link is unreadable)."""
    zone_id: str
    anchor_id: str | None
    updated_at: str | None
