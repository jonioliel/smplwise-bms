"""Response models of the plan assets and plan versions API (routers/plans.py: `/api/v1/floors/{id}/plan-assets`, `/plan-versions/...`,
`/plan-assets/{id}/dxf...`; ch. 9, T019, T038, design M11, T065, T086). Field order is the order the router builds its dicts in
(`asset_row`, `version_row`). Stored documents (a version's `crop` and `calibration`, the DXF inspection / render records) and the
computed geometry candidates of a DXF import are passed through."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import Num, WireModel

# routes without a JSON body: the pictures (PNG) and the 204 delete
NO_JSON = frozenset({
    "GET /plan-assets/{asset_id}/pages/{page}/preview.png", "GET /plan-versions/{version_id}/image.png", "DELETE /plan-versions/{version_id}",
    "GET /plan-versions/{version_id}/source.png", "GET /plan-versions/{version_id}/stylized.png",
})


class PlanAssetPage(WireModel):
    page: int
    preview_url: str


class PlanAsset(WireModel):
    """An uploaded plan file (`asset_row`): PDF, DXF or a picture."""
    id: str
    floor_id: str
    original_name: str
    mime: str
    sha256: str
    bytes: int
    page_count: int
    created_at: str
    pages: list[PlanAssetPage]
    kind: Literal["pdf", "dxf", "image"]


class PlanAssets(WireModel):
    assets: list[PlanAsset]


class PlanVersion(WireModel):
    """A plan version (`version_row`): the picture of one page, rotated and cropped, and its publish history."""
    id: str
    floor_id: str
    asset_id: str
    page: int
    rotation: int
    crop: dict[str, Any] | None
    """The stored crop (normalized x / y / w / h)."""
    width_px: int
    height_px: int
    scale_m_per_px: float | None
    status: Literal["draft", "published", "archived"]
    revision: int
    notes: str
    calibration: Any
    """The stored calibration record (null when the version has none)."""
    created_at: str
    published_at: str | None
    archived_at: str | None
    created_by: str | None
    published_by: str | None
    image_url: str
    source_url: str
    render_mode: Literal["source", "stylized"]
    stylized_url: str | None


class PlanVersionCreated(PlanVersion):
    """`POST /floors/{id}/plan-versions`: the new draft and how the floor's structure was carried into it."""
    geometry_carry: str


class PlanVersionListed(PlanVersion):
    anchors_on: int


class PlanVersions(WireModel):
    versions: list[PlanVersionListed]


class PlanDiffChange(WireModel):
    field: str
    from_: Any = Field(alias="from")
    to: Any


class PlanDiffGeometry(WireModel):
    same: bool
    changes: list[PlanDiffChange]


class PlanDiffItem(WireModel):
    anchor_id: str
    resource_type: str
    resource_id: str
    name: str
    on_version_id: str
    outcome: Literal["carried", "needs_alignment"]


class PlanDiffAnchors(WireModel):
    total: int
    carried: int
    needs_alignment: int
    items: list[PlanDiffItem]


class PlanDiff(WireModel):
    """`GET /plan-versions/{id}/diff`: what publishing or restoring the version means (T038)."""
    from_: PlanVersion | None = Field(alias="from")
    to: PlanVersion
    geometry: PlanDiffGeometry
    anchors: PlanDiffAnchors


class PlanStylized(WireModel):
    """`POST /plan-versions/{id}/stylize`: the local processing's figures (services/plan_stylize) and the two pictures."""
    rooms: int
    strength: str
    keep_lines: bool
    room_fill: str
    width_px: int
    height_px: int
    threshold: Num
    wall_ratio: float
    ms: int
    version_id: str
    source_url: str
    stylized_url: str


class PlanDxfAdapter(WireModel):
    library: str
    license: str
    drawable: list[str]
    note: str


class PlanDxfOptions(WireModel):
    layers: list[str] | None
    units: str | None


class PlanDxf(WireModel):
    """`GET` / `PUT /plan-assets/{id}/dxf`: what the DXF contains, the chosen layers and units, and the last render."""
    asset_id: str
    adapter: PlanDxfAdapter
    info: dict[str, Any] | None
    options: PlanDxfOptions
    render: dict[str, Any] | None
    units_choices: list[str]


class PlanDxfTarget(WireModel):
    id: str
    label: str


class PlanDxfChoice(WireModel):
    id: str
    name: str


class PlanDxfEntities(WireModel):
    """`GET /plan-assets/{id}/dxf/entities`: the mapping screen's layer and block tables, the targets and the catalog choices."""
    asset_id: str
    units: str
    metres_per_unit: float | None
    layers: list[dict[str, Any]]
    blocks: list[dict[str, Any]]
    targets: list[PlanDxfTarget]
    catalog_choices: list[PlanDxfChoice]


class PlanDxfImport(WireModel):
    """`POST /plan-versions/{id}/import-dxf-geometry`: candidates in the shape of the detection (nothing is stored)."""
    walls: list[dict[str, Any]]
    openings: list[dict[str, Any]]
    objects: list[dict[str, Any]]
    rooms: list[dict[str, Any]]
    detector: dict[str, Any]
    calibration_hint: Any
    pixels: dict[str, Any]
    scale: dict[str, Any]
    stats: dict[str, Any]
    version_id: str
    level_id: str
    existing_auto: dict[str, int]
