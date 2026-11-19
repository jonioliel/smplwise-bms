"""Response models of the spatial zones API (routers/zones.py: `/api/v1/floors/{id}/zones...`, `/zones/{id}...`; design M13 rooms and
areas, CR-009 shared spaces). Field order is the order the router builds its dicts in (`zone_row`). The shared-space conversion plan
(`services/shared_spaces.plan_conversion`, served by the preview and the share itself) is a computed document: its top-level keys are
declared, its parts are passed through."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel

# routes without a JSON body: the 204 deletes
NO_JSON = frozenset({
    "DELETE /zones/{zone_id}/share/{floor_id}", "DELETE /zones/{zone_id}/share/members/{resource_type}/{resource_id}", "DELETE /zones/{zone_id}",
})

ZoneKind = Literal["room", "zone", "corridor", "outdoor", "service"]


class ZonePoint(WireModel):
    """A polygon point normalized to the plan (0..1)."""
    x: Num
    y: Num


class ZoneSharedMark(WireModel):
    """CR-009: on a floor's map, a room other floors show too (`role` "home") or a room shared from another floor (`role` "mirror")."""
    role: str = None
    zone_id: str
    home_floor_id: str
    home_floor_name: str
    home_floor_level: int | None = None
    label: str = None
    floors: list[Any] = None


class Zone(WireModel):
    """One room / area (`routers/zones.zone_row`)."""
    id: str
    floor_id: str
    plan_version_id: str | None
    name: str
    kind: str
    """One of room / zone / corridor / outdoor / service (the request's pattern; the column has no CHECK)."""
    polygon: list[ZonePoint]
    color: str
    label_pos: str
    source: str
    """`manual` or `auto` (accepted from the room detection)."""
    searchable: bool
    level_id: str | None
    ceiling_height_m: float | None
    tags: list[str]
    area_id: str | None
    revision: int
    created_at: str
    updated_at: str


class ZoneOnMap(Zone):
    """A zone in the floor map bundle (routers/anchors): `shared` when the room is shared with another floor."""
    shared: ZoneSharedMark = None


class ZoneList(WireModel):
    zones: list[Zone]


class ZoneAccepted(WireModel):
    """`POST /floors/{id}/zones/accept`: the floor's zones after the accepted candidates, and the new ids."""
    zones: list[Zone]
    created: list[str]


class ZoneDetected(WireModel):
    """`POST /floors/{id}/zones/detect`: room candidates from the plan picture (local processing; nothing is saved)."""
    rooms: list[dict[str, Any]]
    width_px: int
    height_px: int
    strength: Literal["light", "medium", "strong"]
    plan_version_id: str
    existing_auto: int


class ZonePlacementDoc(WireModel):
    """Where the room sits on the other plan: `same_frame`, or `fit` with from / to points, rotation and scale."""
    mode: Literal["same_frame", "fit"]
    from_: list[Num] = Field(default=None, alias="from")
    to: list[Num] = None
    rotation_deg: float = None
    scale: float = None


class ZoneShareZone(WireModel):
    id: str
    name: str
    floor_id: str
    floor_name: str
    floor_level: int


class ZoneShareOtherFloor(WireModel):
    id: str
    name: str
    level: int
    version_id: str
    revision: int
    """The other floor's structure draft revision (0 when it has no draft)."""


class ZoneShareDuplicate(WireModel):
    zone_id: str
    name: str
    polygon: list[ZonePoint]


class ZoneShareOutline(WireModel):
    """The other floor's own outline of the room (its duplicate room, kept), or one drawn from the room's when there is none."""
    zone_id: str | None
    kept: bool
    polygon: list[ZonePoint]


class ZoneShareCandidate(WireModel):
    zone_id: str
    name: str
    name_score: float
    overlap: float | None
    score: float


class ZoneShareAnchor(WireModel):
    """member: shown on both floors; drop_duplicate: the other floor's copy of a camera the room already has; kept: anchored elsewhere too."""
    anchor_id: str
    floor_id: str
    resource_type: Literal["camera", "ha_entity"]
    resource_id: str
    name: str | None
    action: Literal["member", "drop_duplicate", "kept"]


class ZoneShareResource(WireModel):
    resource_type: str
    resource_id: str


class ZoneSharePlan(WireModel):
    """"הפוך לחלל משותף": what sharing the room with another floor does (`shared_spaces.plan_conversion`, the private parts left out)."""
    zone: ZoneShareZone
    other_floor: ZoneShareOtherFloor
    home_version_id: str
    same_frame: bool
    placement: ZonePlacementDoc
    mirror_polygon: list[ZonePoint]
    duplicate: ZoneShareDuplicate | None
    outline: ZoneShareOutline
    candidates: list[ZoneShareCandidate]
    remove: dict[str, int]
    removed_ids: dict[str, list[str]]
    boundary_walls_kept: list[str]
    anchors: list[ZoneShareAnchor]
    members: list[ZoneShareResource]
    aligned: bool
    alignment_warning: str | None
    attach: dict[str, int]


class ZoneShared(ZoneSharePlan):
    """`POST /zones/{id}/share`: the plan and what the conversion wrote."""
    share_id: str
    outline_zone_id: str | None
    members_added: list[ZoneShareResource]
    dropped: list[str]


class ZoneFloorRef(WireModel):
    """A floor of the shared room; one the reader may not read is "קומה אחרת" without its id."""
    floor_id: str | None
    name: str


class ZoneMember(WireModel):
    resource_type: Literal["camera", "ha_entity", "wiskey_station"]
    resource_id: str
    kind: Literal["camera", "station", "door", "device"]
    name: str
    added_at: str = None
    """Members only (absent on a candidate)."""
    floors: list[ZoneFloorRef]


class ZoneMembers(WireModel):
    """`GET /zones/{id}/share/members`: the members the reader may see; `candidates` only for whoever may manage them."""
    zone_id: str
    floors: list[ZoneFloorRef]
    members: list[ZoneMember]
    can_manage: bool
    candidates: list[ZoneMember] = None


class ZoneMemberAdded(WireModel):
    zone_id: str
    added: bool


class ZonePlacement(WireModel):
    """`PATCH /zones/{id}/share/{floor_id}`."""
    zone_id: str
    floor_id: str
    placement: ZonePlacementDoc
    revision: int
