"""Response models of the map anchors and the floor map bundle (routers/anchors.py: `/api/v1/floors/{id}/map`, `/floors/{id}/anchors...`,
`/map-anchors/{id}`, the building time scrub `/floors/{id}/history/...`; ch. 12 / 13, T038, T055, CR-009, CR-024, CR-TIMESCRUB101).
Field order is the order the router builds its dicts in (`anchor_row`). The bundle's parts that other modules own and serve elsewhere
(the geometry reference, levels and circuits of the structure document, the catalogue entity rows, the HA sync state, the floor
pictures, the bakes, the media / time-scrub documents) are passed through as those modules build them."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel
from .cameras import CameraRow
from .catalog import CatalogBuilding, CatalogFloor, CatalogSite
from .plans import PlanVersion
from .zones import ZoneOnMap, ZoneSharedMark

# routes without a JSON body: the 204 delete
NO_JSON = frozenset({"DELETE /map-anchors/{anchor_id}"})


class AnchorPosition(WireModel):
    """Normalized to the plan (0..1)."""
    x: float
    y: float


class Anchor(WireModel):
    """One placement (`anchor_row`): a camera or a catalogue entity on a floor's plan version, with its effective period."""
    id: str
    floor_id: str
    plan_version_id: str
    resource_type: Literal["camera", "ha_entity"]
    resource_id: str
    position: AnchorPosition
    rotation_degrees: Num
    field_of_view_degrees: float | None
    layer_id: str
    label: str | None
    revision: int
    effective_from: str
    effective_to: str | None
    updated_at: str
    coverage_radius: float | None
    coverage_polygon: list[list[Num]] | None
    label_pos: str
    level_id: str | None
    mount_height_m: float | None
    tilt_deg: float | None


class AnchorList(WireModel):
    anchors: list[Anchor]


class AnchorRealigned(WireModel):
    """`POST /floors/{id}/anchors/realign` (S4): `crop` maps the items through the two crops, `accept` re-stamps them."""
    mode: Literal["crop", "accept"]
    version_id: str
    moved: int
    skipped: int
    needs_alignment: bool


class MapCamera(CameraRow):
    """A camera in the floor map bundle: the registry row plus `recorder_enabled` (CR-024 section 7.2)."""
    recorder_enabled: bool


class MapAnchor(Anchor):
    """An anchor in the bundle with its camera or entity; `room_candidate` / `shared_member` for the placement editor (CR-009),
    `shared` for a member of a room another floor shares (its position in this plan's coordinates)."""
    camera: MapCamera | None
    entity: dict[str, Any] | None
    """The catalogue entity row (services/ha_sync.entity_row) with `alarm_managed`, `actions` and, at an instant, `state_at`."""
    room_candidate: str = None
    shared_member: str = None
    shared: ZoneSharedMark = None


class FloorMap(WireModel):
    """`GET /floors/{id}/map`: everything the map needs in one call; `at=<UTC>` the version and anchors of that instant (T038)."""
    floor: CatalogFloor
    building: CatalogBuilding
    site: CatalogSite
    plan: PlanVersion | None
    geometry: dict[str, Any] | None
    """The structure document reference (geometry_store.ref) with the served `doc_hash` and, for shared rooms, `view_hash`."""
    catalog_revision: str
    levels: list[dict[str, Any]]
    circuit_states: dict[str, dict[str, Any]]
    anchors: list[MapAnchor]
    ha_sync: dict[str, Any]
    zones: list[ZoneOnMap]
    floor_images: dict[str, Any] | None
    bakes: dict[str, Any] | None
    reach: Literal["floor", "cameras"]
    needs_alignment: bool
    at: str | None
    history: Literal["exact", "current"] | None
    history_from: str | None
    ha_history: dict[str, Any] | None
    permissions: dict[str, bool]
    cameras: list[MapCamera]


class FloorHistorySettings(WireModel):
    range_max_days: Num
    presence_retention_days: Num


class FloorHistorySnapshot(WireModel):
    """`GET /floors/{id}/history/snapshot` (CR-TIMESCRUB101): the floor at one instant, layer by layer (services/timescrub.snapshot),
    each layer authorised on its own (a layer the caller may not see: `not_permitted`, no data). The layers are computed documents."""
    at: str
    floor_id: str
    settings: FloorHistorySettings
    coverage: dict[str, Any]
    layers: dict[str, Any]


class FloorHistoryRange(WireModel):
    """`GET /floors/{id}/history/range`: change-points per entity over a period (services/timescrub.history_range), exact or bucketed
    (`bucket_s`)."""
    from_: str = Field(alias="from")
    to: str
    floor_id: str
    bucket_s: int | None
    native_rows: int
    coverage: dict[str, Any]
    layers: dict[str, Any]
