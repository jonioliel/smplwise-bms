"""Response models of the home mapping assistant API (routers/home_mapping.py: `/api/v1/sites/{id}/mapping...`, `/api/v1/home/multi-building`,
`/api/v1/home/building-reach`; MAPPING-ASSIST-2330, round 14). Field order is the order the router builds its dicts in. The assistant's
own state document and a version's summary are passed through as stored."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel
from .catalog import CatalogAreaLink, CatalogBuildingLink, CatalogFloorLink

NO_JSON: frozenset[str] = frozenset()


class HomeMappingSite(WireModel):
    id: str
    name: str


class HomeMappingSettings(WireModel):
    """The assistant's settings (each a choice; an unknown stored value reads as the default)."""
    floor_inherit: Literal["on", "off"]
    auto_insert: Literal["off", "on"]
    new_token: Literal["new_first", "existing_first", "unassigned_first"]


class HomeMappingVersion(WireModel):
    number: int
    kind: str
    restored_from: int | None
    created_at: str
    by: str
    summary: dict[str, Any]
    note: str
    current: bool


class HomeMappingPlatformFloor(WireModel):
    id: str
    name: str
    level: int | None


class HomeMappingPlatformArea(WireModel):
    id: str
    name: str
    floor_id: str | None
    labels: list[str]


class HomeMappingLabel(WireModel):
    id: str
    name: str
    color: str | None
    icon: str | None
    areas: int


class HomeMappingItems(WireModel):
    """The home platform's floors, areas and labels (the registry - complete, independent of the caller's device reach)."""
    floors: list[HomeMappingPlatformFloor]
    areas: list[HomeMappingPlatformArea]
    labels: list[HomeMappingLabel]
    labels_synced_at: str | None


class HomeMappingFloor(WireModel):
    id: str
    name: str
    level: int


class HomeMappingBuilding(WireModel):
    id: str
    name: str
    is_shared: bool
    floors: list[HomeMappingFloor]


class HomeMappingLinks(WireModel):
    """The site's current rows: platform floor -> floor, area -> floor, area -> building."""
    floors: list[CatalogFloorLink]
    areas: list[CatalogAreaLink]
    buildings: list[CatalogBuildingLink]


class HomeMappingRead(WireModel):
    """`GET /sites/{id}/mapping`: everything the assistant needs."""
    site: HomeMappingSite
    state: dict[str, Any] | None
    revision: int
    settings: HomeMappingSettings
    multi_building: bool
    can_toggle: bool
    building_reach: str
    can_set_reach: bool
    review_mode: Literal["required", "skip"]
    """MULTI-BUILDING-SAFETY-2500: whether turning the switch on needs the check (`home.multi_building.review`)."""
    can_set_review: bool
    filter_mode: Literal["on", "off"]
    """MULTI-BUILDING-NEXT-2500: the building filter of the full interface's lists (`home.multi_building.filter`)."""
    can_set_filter: bool
    versions: list[HomeMappingVersion]
    seen: list[Any] | None
    """The item keys the last apply saw (null before the first)."""
    items: HomeMappingItems
    buildings: list[HomeMappingBuilding]
    links: HomeMappingLinks


class HomeMappingRevision(WireModel):
    revision: int


class HomeMappingSettingsAnswer(WireModel):
    settings: HomeMappingSettings


class HomeMappingMulti(WireModel):
    enabled: bool
    check: Literal["passed", "skipped"] | None = None
    """MULTI-BUILDING-SAFETY-2500: present only when this request turned the switch on - the check passed, or the setting skipped it."""


class HomeMultiBuildingFinding(WireModel):
    """One finding of the check before turning multi-building on. `items` (at most 20) depend on the code: a device, a building with its
    reach gain, an area, a mapping version."""
    code: str
    severity: Literal["blocking", "warning", "info"]
    count: int
    items: list[dict[str, Any]]


class HomeMultiBuildingCheck(WireModel):
    """`GET /home/multi-building/check` (MULTI-BUILDING-SAFETY-2500): the report, and the digest `PUT /home/multi-building` is confirmed with."""
    digest: str
    reach_mode: str
    review_mode: Literal["required", "skip"]
    buildings: int
    blocking: int
    warnings: int
    last_on: str | None
    findings: list[HomeMultiBuildingFinding]


class HomeMultiBuildingReview(WireModel):
    mode: Literal["required", "skip"]


class HomeMultiBuildingFilter(WireModel):
    mode: Literal["on", "off"]


class HomeMappingReach(WireModel):
    mode: Literal["map_and_mapping", "map"]


class HomeMappingCreatedBuilding(WireModel):
    id: str
    name: str


class HomeMappingCreatedFloor(WireModel):
    id: str
    name: str
    building_id: str


class HomeMappingCreated(WireModel):
    buildings: list[HomeMappingCreatedBuilding]
    floors: list[HomeMappingCreatedFloor]


class HomeMappingCounts(WireModel):
    floor_rows: int
    floor_rows_removed: int
    area_rows: int
    area_rows_removed: int
    building_rows: int
    building_rows_removed: int


class HomeMappingApply(WireModel):
    """`POST /sites/{id}/mapping/apply`: the new version, what was created and written, and the rows now."""
    version: int
    revision: int
    created: HomeMappingCreated
    counts: HomeMappingCounts
    links: HomeMappingLinks


class HomeMappingRestore(WireModel):
    """`POST /sites/{id}/mapping/versions/{n}/restore`: a NEW version with the chosen one's rows; rows naming a deleted place skipped."""
    version: int
    revision: int
    skipped: int
    links: HomeMappingLinks
