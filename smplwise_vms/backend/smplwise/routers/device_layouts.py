"""The device-control screens' layout editor (CR-007 slice 6b, owner decisions 7.11).

One layout per installation and screen, stored here, shown to everyone who reads the screens, edited only by a holder
of `system.configure`:
- scope `building`, id `main`: the building screen - its floor cards (keys `floor:<floor id>`, the "כרטיסים" view)
  and its area tiles (keys `area:<area id>`, the "אריחים" view);
- scope `area`, id = an HA area id (or `unassigned`): that area screen's domain cards (keys `card:<card id>`).
Each record has a `desktop` variant (a 12-column grid) and optionally a `phone` variant (4 columns). No record means
the automatic layout; the phone layout is derived from the desktop one in the browser until it is edited on its own.

The layout is presentation only: grid units (column, 8 px row), a text size step, colour ROLES of the active palette
(never a colour value), a title, an icon of the product's set and "hidden". Nothing here reaches Home Assistant.

Slice 6c (owner 2026-09-29, "1.א"): an area card may also arrange its device tiles - `tiles` = {entity id: {order,
span (1 | 2 of the card's two tile columns), size (s | m | l), hidden, title}}. The layout JSON carries a schema version:
`v: 1` (6b, no tiles - still accepted and returned exactly as stored) or `v: 2` (tiles allowed). A tile's `hidden` and
the card's `hidden_entities` are one set: the server merges them both ways on every write, so an older screen that
reads only `hidden_entities` still hides the same devices. A card without `tiles` keeps the automatic tile order.

Camera cards (owner 2026-09-30): an area screen may also lay out cameras - an item keyed `camera:<slug>` (slug
`[A-Za-z0-9_-]{1,32}`) carrying `camera` = {kind: 'nvr', recorder_id, channel} or {kind: 'ha', entity_id: 'camera.*'}.
It needs a `v: 2` layout, sits on the same grid as the domain cards, and has no tiles / hidden entities; the source names
a camera, nothing more - who may watch it is decided when the card resolves and when the stream opens
(routers/device_cameras.py, routers/media.py), never by the layout. At most MAX_CAMERA_CARDS per area.

Routes: `GET /devices/layouts/{scope}/{id}` (devices.read anywhere), `PUT` (one variant, optimistic `revision`, 409
when stale), `DELETE` (reset: one variant or both), `POST /devices/layouts/area/{id}/copy-to-all-areas`. Every write
checks `system.configure` BEFORE the body is read (the permission-first, JSON-only envelope of routers/devices.py) and
is audited with the scope, the id and the revision only - never the layout itself."""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from ..services import camera_cards
from ..services import devices as svc
from ..services import ha_scope
from .devices import READ, _configure_holder, _configure_holder_ro, _is_json, _raw_body

router = APIRouter()
log = logging.getLogger("smplwise.device_layouts")

SCOPES = ("building", "area")
VARIANTS = ("desktop", "phone")
BUILDING_ID = "main"
COLUMNS = {"desktop": 12, "phone": 4}
MAX_BODY = 64 * 1024
ENTITY_ID_RE = re.compile(r"^[a-z_]{1,64}\.[A-Za-z0-9_]{1,200}$")
MAX_HIDDEN_ENTITIES = 200
MAX_ITEMS = 300
MAX_ROW = 4000  # in 8 px rows: 32 000 px, far below anything a screen shows
MAX_SPAN_ROWS = 400
ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")
BUILDING_KEY_RE = re.compile(r"^(floor|area):[A-Za-z0-9_.-]{1,128}$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f‪-‮⁦-⁩]")

# The palette roles a card's background / border may take (frontend/src/styles/devices-palettes.ts resolves each per
# theme and colour scheme). Never a colour value: an edited layout looks right in every theme.
ROLES = ("accent", "warm", "cool", "success", "warning", "danger", "neutral")
TEXT_SIZES = ("sm", "md", "lg")
# The icons a card may carry, all from the product's own set (components/sw-icon.ts). Keep in step with LAYOUT_ICONS in
# frontend/src/screens/devices-layout.ts (tests/test_device_layouts.py compares the two).
ICONS = (
    "light", "bolt", "activity", "layers", "shield", "play", "sensor", "home", "building", "floor", "stairs", "elevator",
    "lock", "door", "camera", "eye", "bell", "clock", "calendar", "wifi", "volume", "users", "map", "grid", "dashboard",
    "star", "sparkle", "cube", "hand", "info",
)

Role = Literal["accent", "warm", "cool", "success", "warning", "danger", "neutral"]
TextSize = Literal["sm", "md", "lg"]
TileSize = Literal["s", "m", "l"]

# Slice 6c: the tile columns of each area card (a tile spans 1 or all of them). Keep in step with TILE_COLS in
# frontend/src/screens/devices-layout.ts (tests/test_device_layouts.py compares the two).
TILE_COLS = {"lighting": 2, "switches": 2, "climate": 2, "covers": 2, "security": 2, "media": 2, "sensors": 2}
MAX_TILES = 200
MAX_CAMERA_CARDS = 12  # per area screen: more than a screen can stream anyway (media.max_live_sessions)
CAMERA_KEY_RE = re.compile(r"^camera:[A-Za-z0-9_-]{1,32}$")
MAX_TILE_ORDER = 999
LAYOUT_VERSION = 2  # the schema version this server writes tiles with; 1 = the 6b layout (no tiles)
# Owner request 2026-09-30 (the area layout editor's card library): `v: 3` adds custom cards and deleted built-in cards.
# A custom card is an item whose key is `card:c-<id>` and whose `custom` = {type, entities}: a card of a library type with
# its own explicit device list (any number, several of one type, each with its own title / colours / size); a built-in
# card the editor deleted stays as an item with `removed: true` (its devices simply show in no card of that name). Keep the
# types in step with CARD_TYPES in frontend/src/screens/devices-layout-cards.ts (tests/test_device_layouts.py compares).
CARDS_VERSION = 3
CUSTOM_TYPES = (*svc.CARD_IDS, "locks", "energy", "free", "camera")
# The library's "camera" entry adds a `camera:<slug>` camera card (below), never a `card:c-` item: a custom card of that type is refused
CUSTOM_CARD_TYPES = tuple(t for t in CUSTOM_TYPES if t != "camera")
CUSTOM_KEY_RE = re.compile(r"^card:c-[a-z0-9]{6,12}$")
MAX_CUSTOM_CARDS = 40
MAX_CUSTOM_ENTITIES = 300


def _clean_title(v: str | None) -> str | None:
    if v is None:
        return None
    if CONTROL_RE.search(v):
        raise ValueError("control characters are not allowed in a title")
    v = v.strip()
    return v or None


class TileLayout(BaseModel):
    """One device tile inside an area card (6c): its place in the card's order, its width in the card's tile columns,
    a size step, hidden, a custom title (plain text)."""
    model_config = ConfigDict(extra="forbid", strict=True)
    order: int = Field(ge=0, le=MAX_TILE_ORDER)
    # field-level upper bound only (the widest card); the real per-card bound is checked in _tile_errors
    span: int = Field(1, ge=1, le=max(TILE_COLS.values()), description="Field-level upper bound only (the widest card); the per-card bound is _tile_errors.")
    size: TileSize = "m"
    hidden: bool = False
    title: str | None = Field(None, max_length=60)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return _clean_title(v)


class CustomCard(BaseModel):
    """A custom area card (v 3): its library type and the devices it shows (entity ids, in no particular order)."""
    model_config = ConfigDict(extra="forbid", strict=True)
    type: str
    entities: list[str] = Field(default_factory=list, max_length=MAX_CUSTOM_ENTITIES)

    @field_validator("type")
    @classmethod
    def _type(cls, v: str) -> str:
        if v not in CUSTOM_CARD_TYPES:
            raise ValueError("unknown card type")
        return v

    @field_validator("entities")
    @classmethod
    def _entities(cls, v: list[str]) -> list[str]:
        if any(not ENTITY_ID_RE.fullmatch(e) for e in v):
            raise ValueError("not an entity id")
        return sorted(set(v))


class NvrSource(BaseModel):
    """A camera card's source: one channel of the NVR catalogue."""
    model_config = ConfigDict(extra="forbid", strict=True)
    kind: Literal["nvr"]
    recorder_id: str = Field(pattern=camera_cards.RECORDER_ID_RE.pattern)
    channel: int = Field(ge=1, le=256)


class HaSource(BaseModel):
    """A camera card's source: a Home Assistant camera entity (an NVR channel of the Hikvision integration streams as that
    channel, any other camera shows a still picture)."""
    model_config = ConfigDict(extra="forbid", strict=True)
    kind: Literal["ha"]
    entity_id: str = Field(pattern=camera_cards.HA_CAMERA_RE.pattern)


CameraSource = Annotated[NvrSource | HaSource, Field(discriminator="kind")]


class LayoutItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)  # no "yes" for true, no "3" for 3
    x: int = Field(ge=0, le=11)
    y: int = Field(ge=0, le=MAX_ROW)
    w: int = Field(ge=1, le=12)
    h: int = Field(ge=1, le=MAX_SPAN_ROWS)
    text: TextSize = "md"
    bg: Role | None = None
    border: Role | None = None
    title: str | None = Field(None, max_length=60)
    icon: str | None = None
    hidden: bool = False
    # review ruling 4: the entities a card does not show (still counted in its numbers); area cards only
    hidden_entities: list[str] = Field(default_factory=list, max_length=MAX_HIDDEN_ENTITIES)
    # slice 6c: the card's own device-tile arrangement (area cards only; empty = the automatic order)
    tiles: dict[str, TileLayout] = Field(default_factory=dict, max_length=MAX_TILES)
    # v 3: a custom card's type and devices; a built-in card the editor deleted
    custom: CustomCard | None = None
    removed: bool = False
    # owner 2026-09-30: a camera card's source (`camera:<slug>` keys of the area screen only; None on every other item)
    camera: CameraSource | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        return _clean_title(v)

    @field_validator("tiles")
    @classmethod
    def _tile_keys(cls, v: dict[str, TileLayout]) -> dict[str, TileLayout]:
        if any(not ENTITY_ID_RE.fullmatch(e) for e in v):
            raise ValueError("a tile key is not an entity id")
        return v

    @model_validator(mode="after")
    def _merge_hidden(self) -> "LayoutItem":
        """A hidden tile and the card's hidden_entities are one set (6c): merged both ways."""
        if self.tiles:
            hidden = set(self.hidden_entities) | {e for e, t in self.tiles.items() if t.hidden}
            if len(hidden) > MAX_HIDDEN_ENTITIES:
                raise ValueError("too many hidden entities")
            self.hidden_entities = sorted(hidden)
            for e, t in self.tiles.items():
                t.hidden = e in hidden
        return self

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        if v is not None and v not in ICONS:
            raise ValueError("unknown icon")
        return v

    @field_validator("hidden_entities")
    @classmethod
    def _entities(cls, v: list[str]) -> list[str]:
        if any(not ENTITY_ID_RE.fullmatch(e) for e in v):
            raise ValueError("not an entity id")
        return sorted(set(v))


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    v: Literal[1, 2, 3] = 1  # the layout schema version: 1 = 6b, 2 = 6c (device tiles inside the area cards), 3 = custom / deleted cards
    cols: int
    items: dict[str, LayoutItem] = Field(max_length=MAX_ITEMS)


def _dump(layout: Layout) -> str:
    """The stored JSON: every field with its default filled in, except an empty `tiles` (a 6b layout stays exactly
    what it was, and a card without an arrangement costs nothing)."""
    data = layout.model_dump(exclude_defaults=False)
    for it in data["items"].values():
        if not it.get("tiles"):
            it.pop("tiles", None)
        if it.get("custom") is None:  # v 3 fields cost nothing on an older layout
            it.pop("custom", None)
        if not it.get("removed"):
            it.pop("removed", None)
        if it.get("camera") is None:
            it.pop("camera", None)
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


class PutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    variant: Literal["desktop", "phone"]
    revision: int = Field(ge=0)  # the revision the editor started from; 0 = there was no record
    layout: Layout


class CopyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)  # the source's desktop revision the editor saw (409 when it moved on) - required


def _check_scope(scope: str, scope_id: str) -> None:
    if scope not in SCOPES:
        raise ApiError(404, "not_found", "אין פריסה מהסוג הזה.")
    if not ID_RE.fullmatch(scope_id) or (scope == "building" and scope_id != BUILDING_ID):
        raise ApiError(404, "not_found", "אין פריסה כזו.")


def _known_areas(conn: sqlite3.Connection) -> list[str]:
    _floors, areas = svc.load_structure(conn, svc.load_entities(conn))
    return [a["area_id"] for a in areas]


def _check_exists(conn: sqlite3.Connection, scope: str, scope_id: str) -> None:
    if scope == "area" and scope_id != svc.UNASSIGNED and scope_id not in _known_areas(conn):
        raise ApiError(404, "area_not_found", "האזור לא נמצא.")


def _grid_of(conn: sqlite3.Connection, scope: str) -> Any:
    """Which grid an item key belongs to (items of different grids may share coordinates): the area screen has one;
    the building screen one for the floor cards and one per floor for the area tiles."""
    if scope == "area":
        return lambda key: "cards"
    _floors, areas = svc.load_structure(conn, svc.load_entities(conn))
    floor_of = {a["area_id"]: a.get("floor_id") or svc.NO_FLOOR for a in areas}
    floor_of[svc.UNASSIGNED] = svc.UNASSIGNED
    return lambda key: "floors" if key.startswith("floor:") else f"areas:{floor_of.get(key[5:], key)}"


def _overlaps(layout: Layout, grid_of: Any) -> list[str]:
    groups: dict[str, list[tuple[str, LayoutItem]]] = {}
    for key, it in layout.items.items():
        groups.setdefault(grid_of(key), []).append((key, it))
    out: list[str] = []
    for items in groups.values():
        for i, (ka, a) in enumerate(items):
            for kb, b in items[i + 1:]:
                if a.removed or b.removed:
                    continue  # a deleted card leaves no slot behind
                if a.x < b.x + b.w and b.x < a.x + a.w and a.y < b.y + b.h and b.y < a.y + a.h:
                    out.append(f"{ka[:40]} / {kb[:40]}")
    return out


def _validate_semantics(scope: str, variant: str, layout: Layout) -> list[str]:
    """What pydantic cannot say alone: the variant's column count, items inside the grid, keys of this screen."""
    errors: list[str] = []
    cols = COLUMNS[variant]
    if layout.cols != cols:
        errors.append(f"layout.cols must be {cols} for the {variant} layout")
    if sum(1 for k in layout.items if CAMERA_KEY_RE.fullmatch(k)) > MAX_CAMERA_CARDS:
        errors.append(f"layout.items: at most {MAX_CAMERA_CARDS} camera cards per area")
    for key, it in layout.items.items():
        if scope == "building" and not BUILDING_KEY_RE.fullmatch(key):
            errors.append(f"layout.items.{key[:40]}: the building screen lays out floor:<id> and area:<id> only")
        builtin = key in {f"card:{c}" for c in svc.CARD_IDS}
        if scope == "area" and not builtin and not CUSTOM_KEY_RE.fullmatch(key) and not CAMERA_KEY_RE.fullmatch(key):
            errors.append(f"layout.items.{key[:40]}: the area screen lays out its cards (card:<id>) and camera cards (camera:<id>) only")
        if scope == "area" and CUSTOM_KEY_RE.fullmatch(key) and it.custom is None:
            errors.append(f"layout.items.{key[:40]}: a custom card needs its type and devices")
        if it.custom is not None and (scope != "area" or builtin):
            errors.append(f"layout.items.{key[:40]}: only a custom area card (card:c-<id>) carries custom")
        if it.removed and (scope != "area" or not builtin):
            errors.append(f"layout.items.{key[:40]}: only a built-in area card can be removed")
        if (it.custom is not None or it.removed) and layout.v < CARDS_VERSION:
            errors.append(f"layout.items.{key[:40]}: custom and removed cards need layout v {CARDS_VERSION}")
        errors.extend(_camera_errors(scope, key, it, layout.v))
        if it.x + it.w > cols:
            errors.append(f"layout.items.{key[:40]}: x + w exceeds the {cols} columns")
        if it.hidden_entities and scope != "area":
            errors.append(f"layout.items.{key[:40]}: hidden_entities belong to the area screen's cards")
        if it.tiles:
            errors.extend(_tile_errors(scope, key, it, layout.v))
    if sum(1 for it in layout.items.values() if it.custom is not None) > MAX_CUSTOM_CARDS:
        errors.append(f"layout.items: at most {MAX_CUSTOM_CARDS} custom cards")
    return errors


def _camera_errors(scope: str, key: str, it: LayoutItem, version: int) -> list[str]:
    """A `camera:<slug>` item is an area screen's camera card of a v2 layout with a source and nothing a domain card has;
    no other item carries a source."""
    where = f"layout.items.{key[:40]}"
    if not CAMERA_KEY_RE.fullmatch(key):
        return [f"{where}.camera: only a camera:<id> card has a camera source"] if it.camera is not None else []
    if scope != "area":
        return [f"{where}: camera cards belong to the area screen"]
    errors: list[str] = []
    if it.camera is None:
        errors.append(f"{where}.camera: a camera card needs its source")
    if version < LAYOUT_VERSION:
        errors.append(f"{where}: camera cards need layout v {LAYOUT_VERSION}")
    if it.tiles or it.hidden_entities:
        errors.append(f"{where}: a camera card has no device tiles")
    return errors


def _tile_errors(scope: str, key: str, it: LayoutItem, version: int) -> list[str]:
    """Slice 6c: tiles belong to an area card of a v2 layout; each order once; a span within the card's columns."""
    where = f"layout.items.{key[:40]}.tiles"
    if scope != "area" or not key.startswith("card:"):
        return [f"{where}: device tiles belong to the area screen's cards"]
    errors: list[str] = []
    if version < LAYOUT_VERSION:
        errors.append(f"{where}: device tiles need layout v {LAYOUT_VERSION}")
    cols = TILE_COLS.get(key[5:], 1) if key[5:] in TILE_COLS else (TILE_COLS.get(it.custom.type, 2) if it.custom else 1)
    orders = [t.order for t in it.tiles.values()]
    if len(set(orders)) != len(orders):
        errors.append(f"{where}: each tile needs its own order")
    for entity_id, t in it.tiles.items():
        if t.span > cols:
            errors.append(f"{where}.{entity_id[:60]}: span {t.span} exceeds the card's {cols} tile columns")
    return errors


def _portable(layout_json: str) -> str:
    """A layout as another area can take it: a custom card lists THIS area's devices and a camera card names one camera
    of this area, so both stay here (a deliberate choice: a camera is area-specific); the built-in cards' arrangement
    (and a built-in card the editor deleted) is what "העתק לכל האזורים" copies."""
    data = json.loads(layout_json)
    items = data.get("items", {})
    area_bound = lambda it: isinstance(it, dict) and (it.get("custom") or it.get("camera"))  # noqa: E731
    if not any(area_bound(it) for it in items.values()):
        return layout_json
    data["items"] = {k: it for k, it in items.items() if not area_bound(it)}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> BaseModel:
    content_type = request.headers.get("content-type")
    if not _is_json(content_type):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]})
    if len(raw) > MAX_BODY:
        raise ApiError(413, "too_large", "הפריסה גדולה מדי.", details={"max_bytes": MAX_BODY})
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הפריסה אינה תקינה: " + ", ".join(fields[:12]), details={"fields": fields[:50]}) from None


def _row(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT l.layout_json, l.revision, l.updated_by, l.updated_at, u.display_name, u.username FROM device_layouts l LEFT JOIN users u ON u.id = l.updated_by"
        " WHERE l.scope = ? AND l.scope_id = ? AND l.variant = ?",
        (scope, scope_id, variant),
    ).fetchone()
    if not r:
        return None
    return {"layout": json.loads(r["layout_json"]), "revision": r["revision"], "updated_by": r["display_name"] or r["username"] or r["updated_by"], "updated_at": r["updated_at"]}


def _record(conn: sqlite3.Connection, principal: Principal, scope: str, scope_id: str, visible: tuple[set[str], set[str]] | None = None) -> dict[str, Any]:
    """The record. `visible` (floor ids, area ids) narrows it for a floor-scoped caller (review MEDIUM 1): only the
    keys of floors / areas they can see, nothing of an area they cannot, and `narrowed: true` so the screen packs the
    rows those items leave. Who saved it is shown to system.configure holders only."""
    can_edit = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    out: dict[str, Any] = {"scope": scope, "id": scope_id, "can_edit": can_edit, "narrowed": False}
    for variant in VARIANTS:
        rec = _row(conn, scope, scope_id, variant)
        if rec and not can_edit:
            rec["updated_by"] = None
        if rec and visible is not None:
            floors, areas = visible
            if scope == "area" and scope_id not in areas:
                rec = None
            elif scope == "building":
                items = rec["layout"]["items"]
                keep = {k: v for k, v in items.items() if (k[6:] in floors if k.startswith("floor:") else k[5:] in areas)}
                out["narrowed"] = out["narrowed"] or len(keep) != len(items)
                rec["layout"]["items"] = keep
        out[variant] = rec
    return out


def _visible(conn: sqlite3.Connection, principal: Principal) -> tuple[set[str], set[str]] | None:
    """(floor ids, area ids) of a floor-scoped caller, the same filter as the tree; None = installation-wide."""
    entities, scoped = ha_scope.scoped_rows(conn, principal, READ, svc.load_entities(conn))
    if not scoped:
        return None
    t = svc.build_tree(conn, entities, scoped=True)
    floors = {f["floor_id"] for f in t["floors"]}
    areas = {a["area_id"] for f in t["floors"] for a in f["areas"]}
    if t["unassigned"]["counts"]["entities"]:
        floors.add(svc.UNASSIGNED)
        areas.add(svc.UNASSIGNED)
    return floors, areas


def _prune_vanished(conn: sqlite3.Connection, principal: Principal, request: Request) -> None:
    """Review nit 8 (re-review): layout rows of HA areas that no longer exist go - on a WRITE only (PUT, copy to all
    areas: a system.configure holder, inside that request's transaction), never on a read. One audit row per pruned
    area (scope, id and the rows removed - never the layout). Only while Home Assistant's structure is known at all:
    an empty mirror (a first start, HA unreachable) never prunes anything."""
    known = set(_known_areas(conn))
    if not known:
        return
    rows = conn.execute("SELECT scope_id, COUNT(*) AS n FROM device_layouts WHERE scope = 'area' GROUP BY scope_id").fetchall()
    stale = [(r["scope_id"], int(r["n"])) for r in rows if r["scope_id"] not in known and r["scope_id"] != svc.UNASSIGNED]
    for scope_id, n in stale:
        conn.execute("DELETE FROM device_layouts WHERE scope = 'area' AND scope_id = ?", (scope_id,))
        audit(conn, actor=principal, action="devices.layout.prune", decision="allowed", resource_type="device_layout_area", resource_id=scope_id,
              request_id=getattr(request.state, "correlation_id", None), details={"scope": "area", "id": scope_id, "count": n})
    if stale:
        log.info("pruned the layouts of %d areas no longer in Home Assistant", len(stale))


def _revision(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str) -> int:
    r = conn.execute("SELECT revision FROM device_layouts WHERE scope = ? AND scope_id = ? AND variant = ?", (scope, scope_id, variant)).fetchone()
    return int(r["revision"]) if r else 0


def _write(conn: sqlite3.Connection, principal: Principal, scope: str, scope_id: str, variant: str, layout_json: str) -> int:
    rev = _revision(conn, scope, scope_id, variant) + 1
    conn.execute(
        "INSERT INTO device_layouts(scope, scope_id, variant, layout_json, revision, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        " ON CONFLICT(scope, scope_id, variant) DO UPDATE SET layout_json = excluded.layout_json, revision = excluded.revision,"
        " updated_by = excluded.updated_by, updated_at = excluded.updated_at",
        (scope, scope_id, variant, layout_json, rev, principal.user_id, now_iso()),
    )
    return rev


@router.get("/devices/layouts/{scope}/{scope_id}")
def get_layout(scope: str, scope_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The screen's stored layout (desktop and phone; null = automatic) - everyone who reads the device screens."""
    ha_scope.scoped_rows(conn, principal, READ, [])  # the audited 403 without devices.read anywhere
    _check_scope(scope, scope_id)
    return _record(conn, principal, scope, scope_id, _visible(conn, principal))  # a read never writes


@router.put("/devices/layouts/{scope}/{scope_id}")
def put_layout(scope: str, scope_id: str, request: Request, principal: Principal = Depends(_configure_holder_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Save one variant. `revision` is the one the editor started from (0 = none); another save in between is a 409
    `layout_conflict` with the current revision, and nothing is written."""
    _check_scope(scope, scope_id)
    body = _parse(request, raw, PutBody)
    assert isinstance(body, PutBody)
    errors = _validate_semantics(scope, body.variant, body.layout)
    if errors:
        raise ApiError(422, "validation", "הפריסה אינה תקינה: " + "; ".join(errors[:5]), details={"errors": errors[:50]})
    overlaps = _overlaps(body.layout, _grid_of(conn, scope))
    if overlaps:
        raise ApiError(422, "layout_overlap", "שני כרטיסים באותו מקום: " + "; ".join(overlaps[:5]), details={"overlaps": overlaps[:50]})
    _check_exists(conn, scope, scope_id)
    current = _revision(conn, scope, scope_id, body.variant)
    if body.revision != current:
        raise ApiError(409, "layout_conflict", "מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש וערכו שוב.", details={"revision": current})
    _prune_vanished(conn, principal, request)
    rev = _write(conn, principal, scope, scope_id, body.variant, _dump(body.layout))
    audit(conn, actor=principal, action="devices.layout.update", decision="allowed", resource_type=f"device_layout_{scope}", resource_id=scope_id,
          request_id=getattr(request.state, "correlation_id", None), details={"scope": scope, "id": scope_id, "variant": body.variant, "revision": rev})
    return _record(conn, principal, scope, scope_id)


@router.delete("/devices/layouts/{scope}/{scope_id}")
def reset_layout(
    scope: str,
    scope_id: str,
    request: Request,
    principal: Principal = Depends(_configure_holder),
    conn: sqlite3.Connection = Depends(get_conn),
    variant: Literal["desktop", "phone", "all"] = Query("all"),
    revision: int | None = Query(None, ge=0),
) -> dict[str, Any]:
    """Back to the automatic layout: `all` ("אפס לברירת מחדל": desktop and phone) or one variant (`phone`: "חזור
    לאוטומטי" - the phone layout is derived from the desktop one again). `revision`, when given, must be the current
    revision of the desktop record (`all` / `desktop`) or of the phone record (`phone`)."""
    _check_scope(scope, scope_id)
    variants = VARIANTS if variant == "all" else (variant,)
    if revision is not None:
        current = _revision(conn, scope, scope_id, "phone" if variant == "phone" else "desktop")
        if revision != current:
            raise ApiError(409, "layout_conflict", "מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש.", details={"revision": current})
    before = {v: _revision(conn, scope, scope_id, v) for v in variants}
    conn.execute(f"DELETE FROM device_layouts WHERE scope = ? AND scope_id = ? AND variant IN ({', '.join('?' * len(variants))})", (scope, scope_id, *variants))
    audit(conn, actor=principal, action="devices.layout.reset", decision="allowed", resource_type=f"device_layout_{scope}", resource_id=scope_id,
          request_id=getattr(request.state, "correlation_id", None), details={"scope": scope, "id": scope_id, "variant": variant, "revision": before})
    return _record(conn, principal, scope, scope_id)


@router.post("/devices/layouts/area/{scope_id}/copy-to-all-areas")
def copy_to_all_areas(scope_id: str, request: Request, principal: Principal = Depends(_configure_holder_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """This area's STORED layout becomes every other area's (the "ללא שיוך" bucket included): the desktop record and,
    when this area has one, the phone record; an area whose phone layout was edited but whose source has none goes back
    to the derived phone layout. The screens confirm first; one audit row (scope, id, revision, how many areas)."""
    _check_scope("area", scope_id)
    body = _parse(request, raw, CopyBody)
    assert isinstance(body, CopyBody)
    _check_exists(conn, "area", scope_id)
    src_rev = _revision(conn, "area", scope_id, "desktop")
    if not src_rev:
        raise ApiError(409, "nothing_to_copy", "לאזור הזה אין פריסה שמורה להעתקה. שמרו אותה קודם.")
    if body.revision != src_rev:
        raise ApiError(409, "layout_conflict", "מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש.", details={"revision": src_rev})
    src = {r["variant"]: r["layout_json"] for r in conn.execute("SELECT variant, layout_json FROM device_layouts WHERE scope = 'area' AND scope_id = ?", (scope_id,)).fetchall()}
    _prune_vanished(conn, principal, request)
    targets = [a for a in [*_known_areas(conn), svc.UNASSIGNED] if a != scope_id]
    for area_id in targets:
        _write(conn, principal, "area", area_id, "desktop", _portable(src["desktop"]))
        if "phone" in src:
            _write(conn, principal, "area", area_id, "phone", _portable(src["phone"]))
        else:
            conn.execute("DELETE FROM device_layouts WHERE scope = 'area' AND scope_id = ? AND variant = 'phone'", (area_id,))
    audit(conn, actor=principal, action="devices.layout.copy", decision="allowed", resource_type="device_layout_area", resource_id=scope_id,
          request_id=getattr(request.state, "correlation_id", None), details={"scope": "area", "id": scope_id, "revision": src_rev, "areas": len(targets)})
    return {"copied_to": len(targets), "source": _record(conn, principal, "area", scope_id)}
