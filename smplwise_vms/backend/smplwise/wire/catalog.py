"""Response models of the site / building / floor catalogue API (routers/catalog.py: `/api/v1/sites`, `/buildings/...`, `/floors/{id}`,
the catalogue pictures and the home-platform floor / area links). Field order is the order the router builds its dicts in
(`site_row`, `building_row`, `floor_row`)."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body: the 204 deletes and the catalogue picture (a JPEG)
NO_JSON = frozenset({
    "GET /catalog/images/{kind}/{obj_id}", "DELETE /sites/{site_id}", "DELETE /buildings/{building_id}", "DELETE /floors/{floor_id}",
})


class CatalogSite(WireModel):
    id: str
    name: str
    address: str
    timezone: str
    sort_order: int
    updated_at: str
    image_url: str | None
    """`api/v1/catalog/images/site/<id>?v=<updated_at>` when the site has a picture."""


class CatalogBuilding(WireModel):
    id: str
    site_id: str
    name: str
    sort_order: int
    updated_at: str
    image_url: str | None
    is_shared: bool
    """MULTI-BUILDING: the building holds the spaces several buildings share."""


class CatalogFloor(WireModel):
    """One floor with its plan state and what is placed on it (CR-009: `shared_*` = what a room another floor shares adds)."""
    id: str
    building_id: str
    name: str
    level: int
    sort_order: int
    ha_area_id: str | None
    has_plan: bool
    published_version_id: str | None
    plan_width_px: int | None
    plan_height_px: int | None
    draft_version_id: str | None
    anchor_count: int
    camera_count: int
    shared_anchor_count: int
    shared_camera_count: int
    updated_at: str


class CatalogTreeBuilding(CatalogBuilding):
    floors: list[CatalogFloor] = None
    """The floors the caller may read (absent with `?tree=false`)."""


class CatalogTreeSite(CatalogSite):
    buildings: list[CatalogTreeBuilding] = None
    """The buildings the caller reaches (absent with `?tree=false`)."""


class CatalogSites(WireModel):
    """`GET /sites`: the nodes the caller may read; a site is listed when the caller can read it or any child."""
    sites: list[CatalogTreeSite]
    can_create_site: bool


class CatalogFloorRead(WireModel):
    """`GET /floors/{id}`: the floor with its building and site."""
    floor: CatalogFloor
    building: CatalogBuilding
    site: CatalogSite


class CatalogFloorLink(WireModel):
    ha_floor_id: str
    floor_id: str


class CatalogAreaLink(WireModel):
    area_id: str
    floor_id: str | None
    """null: an area taken off every floor (it names no place)."""


class CatalogBuildingLink(WireModel):
    area_id: str
    building_id: str


class CatalogHomeLinks(WireModel):
    """`GET /home-links` (and the answer of `PUT /floors/{id}/home-link`): the platform floor / area links the caller may read."""
    floors: list[CatalogFloorLink]
    areas: list[CatalogAreaLink]
    buildings: list[CatalogBuildingLink]


# ---------------------------------------------------------------- MULTI-BUILDING-SAFETY-2500: moving a floor to another building

class FloorMoveRef(WireModel):
    id: str
    name: str


class FloorMoveFloor(WireModel):
    id: str
    name: str
    level: int


class FloorMovePerson(WireModel):
    """A person whose permissions on the floor change with the move: `loses` (all of them), `gains` (from none) or `changes`."""
    user_id: str
    name: str
    change: Literal["loses", "gains", "changes"]
    lost: list[str]
    gained: list[str]


class FloorMovePeople(WireModel):
    loses: int
    gains: int
    changes: int
    total: int
    items: list[FloorMovePerson]
    """At most 200 people (the counts are complete): those who lose access first."""


class FloorMoveRecords(WireModel):
    tickets: int
    ticket_rfqs: int
    maint_tasks: int
    notices: int
    incidents: int


class FloorMoveWith(WireModel):
    """What moves unchanged with the floor (it points at the floor id), and the records whose copy of the building follows it."""
    floor_bindings: int
    cameras: int
    anchors: int
    plans: int
    areas: int
    records: FloorMoveRecords


class FloorMoveNote(WireModel):
    code: str
    items: list[dict[str, Any]]


class FloorMovePreview(WireModel):
    """`GET /floors/{id}/move-preview?building=`: the impact of moving the floor, worked out without writing, and the digest the move
    is confirmed with."""
    floor: FloorMoveFloor
    from_building: FloorMoveRef
    to_building: FloorMoveRef
    people: FloorMovePeople
    moves_with: FloorMoveWith
    blockers: list[FloorMoveNote]
    warnings: list[FloorMoveNote]
    can_move: bool
    digest: str


class FloorMoveResult(WireModel):
    """`POST /floors/{id}/move`: the floor in its new building and what changed."""
    floor: CatalogFloor
    from_building: FloorMoveRef
    to_building: FloorMoveRef
    records: FloorMoveRecords
    loses: int
    gains: int
    changes: int
