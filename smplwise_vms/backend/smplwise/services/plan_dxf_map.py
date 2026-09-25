"""DXF layers and blocks mapped to Plan Studio candidates (phase 3, T086, design 9.4), on the existing ezdxf adapter
(plan_dxf): layer names suggest a target by common naming (WALL / A-WALL / MUR / קיר -> walls, DOOR -> openings,
WIND / GLAZ -> windows, FURN / EQPM -> objects, ROOM / AREA -> rooms), INSERT blocks suggest a catalog item by their
name and footprint, two parallel lines 10-40 cm apart become one wall with that thickness (a long face may pair with
several collinear partners, one wall per overlap), collinear wall pieces broken at an opening are bridged again, an
arc (loose or inside a door block) becomes a door with the swing of the drawing, lines on a window layer become a
window on their wall, blocks become objects of the document model, closed polylines on a room layer become room
polygons for the zones accept. Everything is measured in the drawing's units, so the metres are real (`measured`);
positions go through the render extent, the version's rotation and its crop into the version's 0..1 space. The result
has the shape of plan_detect.detect (source "imported", ids "imp-<run>-...").

Every entry point takes a path or an already loaded ezdxf document, so one request parses the file once."""
from __future__ import annotations

import math
import re
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from . import plan_catalog, plan_dxf

VERSION = "1.1"
TARGETS = ("walls", "openings", "windows", "objects", "rooms", "ignore")
TARGET_LABELS = {"walls": "קירות", "openings": "דלתות", "windows": "חלונות", "objects": "עצמים", "rooms": "חדרים", "ignore": "התעלם"}
LAYER_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("walls", ("wall", "walls", "mur", "murs", "קיר", "קירות")),
    ("openings", ("door", "doors", "porte", "portes", "דלת", "דלתות")),
    ("windows", ("wind", "window", "windows", "glaz", "glazing", "fenetre", "חלון", "חלונות")),
    ("rooms", ("room", "rooms", "area", "areas", "space", "spaces", "zone", "zones", "חדר", "חדרים", "אזור", "אזורים")),
    ("objects", ("furn", "furniture", "eqpm", "equip", "equipment", "fixt", "fixture", "fixtures", "ריהוט", "ציוד")),
)
BLOCK_WORDS = {"door": "דלת", "chair": "כיסא", "seat": "כיסא", "bed": "מיטה", "table": "שולחן", "desk": "שולחן", "sofa": "ספה", "couch": "ספה", "toilet": "אסלה",
               "wc": "אסלה", "sink": "כיור", "basin": "כיור", "window": "חלון", "lamp": "מנורה", "light": "מנורה", "cabinet": "ארון", "closet": "ארון",
               "wardrobe": "ארון", "tree": "עץ", "shower": "מקלחת", "bath": "אמבטיה"}
# annotation blocks (a tag, a hatch pattern, a dimension) are never a piece of furniture, whatever else the name says
IGNORE_BLOCK_WORDS = frozenset({"text", "iden", "patt", "hatch", "dim", "anno", "tag", "note"})
# a door or a window block is an opening, not an object: it is suggested as nothing (catalog_id None)
OPENING_BLOCK_WORDS = frozenset({"door", "doors", "window", "windows", "wind", "porte", "fenetre", "דלת", "דלתות", "חלון", "חלונות"})
GENERIC_ID = "object.generic"
GENERIC_NAME = "עצם כללי"
GENERIC_SIZE_M = (0.5, 0.5, 0.8)
GENERIC_HEIGHT_M = GENERIC_SIZE_M[2]
FOOTPRINT_RATIO = 4.0  # a name match counts only when the block's area is within this factor of the item's
WALL_PAIR_M = (0.10, 0.40)  # two parallel lines this far apart are one wall
PAIR_ANGLE_DEG = 2.0
NEAR_WALL_M = 0.35  # an arc or a window line belongs to the wall within this distance
DEFAULT_THICKNESS_M = 0.2
DOOR_WIDTH_M = (0.5, 2.5)
WINDOW_WIDTH_M = (0.3, 4.0)
MAX_GAP_M = 4.0  # the widest opening a wall may be bridged across
MIN_SEGMENT_M = 0.05
MAX_EXTENT_M = 2000.0  # a floor wider than this on the mapped layers is a drawing read in the wrong units (or a stray line)
GRID_CELLS_PER_SIDE = 1024
WIDEN_COVER = 0.8  # a line beside a paired wall widens it only when it runs along this share of the wall
DEFAULT_CEILING_M = 2.8
_WORD = re.compile(r"[a-z]+|[0-9]+|[֐-׿]+")
_COS_PAIR = math.cos(math.radians(PAIR_ANGLE_DEG))
_SIN_PERP = math.sin(math.radians(15.0))

Pt = tuple[float, float]


def _tokens(name: str) -> list[str]:
    """Whole words of a name: split at anything not a letter or digit and at letter/digit boundaries (SOFA3 -> sofa, 3)."""
    return _WORD.findall(str(name).lower())


def suggest_layer(name: str) -> str:
    tokens = set(_tokens(name))
    for target, words in LAYER_RULES:
        if tokens & set(words):
            return target
    return "ignore"


def _area_ok(size_m: tuple[float, float] | list[float], item_size: tuple[float, ...]) -> bool:
    a = float(size_m[0]) * float(size_m[1])
    b = float(item_size[0]) * float(item_size[1]) if item_size else 0.0
    if a <= 0 or b <= 0:
        return True  # an unknown footprint does not veto a name
    return max(a, b) / min(a, b) <= FOOTPRINT_RATIO


def suggest_block(name: str, size_m: tuple[float, float] | list[float], catalog: list[dict[str, Any]]) -> dict[str, Any]:
    """The catalog item a block name points at, by whole words: a word of the item's English or Hebrew name (3) or a
    tag (2), gated by a plausible footprint (area within 4x); ties go to the closest footprint. An annotation word
    (TEXT, TAG, HATCH ...) makes it the generic object; a door or window word makes it no object at all (catalog_id
    None). Without a match the word list names a generic box of the block's size; without that, the generic object."""
    tokens = _tokens(name)
    words = set(tokens)
    if words & IGNORE_BLOCK_WORDS:
        return {"catalog_id": GENERIC_ID, "name": GENERIC_NAME}
    if words & OPENING_BLOCK_WORDS:
        return {"catalog_id": None, "name": next((BLOCK_WORDS[t] for t in tokens if t in BLOCK_WORDS), GENERIC_NAME)}
    best: tuple[int, float, dict[str, Any]] | None = None
    for item in catalog:
        if item.get("id") == GENERIC_ID:
            continue
        name_words = set(_tokens(item.get("name_en") or "")) | set(_tokens(item.get("name_he") or ""))
        tag_words = {w for t in item.get("tags") or [] for w in _tokens(t)}
        score = 0
        for t in words:
            if t.isdigit():
                continue
            if t in name_words:
                score = max(score, 3)
            elif t in tag_words:
                score = max(score, 2)
        sz = item.get("size") or (0.0, 0.0, 0.0)
        if score and _area_ok(size_m, sz):
            fit = abs(float(sz[0]) - float(size_m[0])) + abs(float(sz[1]) - float(size_m[1]))
            if best is None or (score, -fit) > (best[0], -best[1]):
                best = (score, fit, item)
    if best is not None:
        return {"catalog_id": best[2]["id"], "name": best[2].get("name_he") or best[2].get("name_en") or best[2]["id"]}
    for t in tokens:
        if t in BLOCK_WORDS:
            return {"catalog_id": GENERIC_ID, "name": BLOCK_WORDS[t]}
    return {"catalog_id": GENERIC_ID, "name": GENERIC_NAME}


def _norm_item(raw: dict[str, Any]) -> dict[str, Any] | None:
    """One library item (plan_catalog.builtin() / plan_catalog.library(), both {id, names: {he, en}, tags, size: {w_m,
    d_m, h_m}, z_ref, z_m, ...}) in the plain shape this module works with."""
    if not isinstance(raw, dict) or not raw.get("id"):
        return None
    names = raw.get("names") if isinstance(raw.get("names"), dict) else {}
    size = raw.get("size") if isinstance(raw.get("size"), dict) else {}
    z = raw.get("z_m")
    return {"id": str(raw["id"]), "name_he": names.get("he") or "", "name_en": names.get("en") or "",
            "tags": [str(t) for t in (raw.get("tags") or []) if isinstance(t, (str, int))],
            "size": (float(size.get("w_m") or 0), float(size.get("d_m") or 0), float(size.get("h_m") or 0)),
            "z_ref": raw.get("z_ref") if raw.get("z_ref") in plan_catalog.Z_REFS else "floor",
            "z_m": float(z) if isinstance(z, (int, float)) and not isinstance(z, bool) and math.isfinite(z) else 0.0}


def load_catalog(conn: sqlite3.Connection | None) -> list[dict[str, Any]]:
    """The built-in library (smplwise/catalog/objects.json, served by plan_catalog.builtin) plus the installation's
    custom items (plan_catalog.library, catalog_items table), read through plan_catalog so this module and the
    validator never disagree about shape. Without a connection: the built-in items alone. A broken catalog file (a
    packaging error plan_catalog.builtin() raises on) or a missing table -> empty."""
    try:
        if conn is not None:
            items = plan_catalog.library(conn)["items"]
        else:
            items = [dict(i, custom=False, based_on=None) for i in plan_catalog.builtin()["items"].values()]
    except (RuntimeError, OSError, ValueError, sqlite3.OperationalError):
        return []
    out: list[dict[str, Any]] = []
    for raw in items:
        item = _norm_item(raw)
        if item:
            out.append(item)
    return out


def catalog_choices(catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """What a block can be mapped to: the generic object first, then the library."""
    return [{"id": GENERIC_ID, "name": GENERIC_NAME}] + [{"id": c["id"], "name": c["name_he"] or c["name_en"] or c["id"]} for c in catalog[:400] if c["id"] != GENERIC_ID]


# ---------------------------------------------------------------- reading the drawing

def load(path: Path) -> Any:
    """The ezdxf document of a file (plan_dxf._load: recovered, never half-read)."""
    return plan_dxf._load(path)[0]


def _doc(src: Any) -> Any:
    return load(src) if isinstance(src, (str, Path)) else src


def _bbox(points: Iterable[Pt]) -> tuple[float, float, float, float] | None:
    xs: list[float] = []
    ys: list[float] = []
    for p in points:
        xs.append(p[0])
        ys.append(p[1])
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _arc(e: Any) -> dict[str, Any] | None:
    """An ARC in WCS: the centre is stored in the arc's OCS (a mirrored arc has the extrusion 0,0,-1), the end points
    ezdxf gives are already WCS."""
    try:
        c = e.ocs().to_wcs(e.dxf.center)
        p0, p1 = e.start_point, e.end_point
        return {"cx": float(c.x), "cy": float(c.y), "r": float(e.dxf.radius), "p0": (float(p0.x), float(p0.y)), "p1": (float(p1.x), float(p1.y))}
    except Exception:  # noqa: BLE001 - a broken arc is simply not a door
        return None


def _walk_insert(e: Any, depth: int, segments: list[list[Pt]], arcs: list[dict[str, Any]]) -> None:
    """The polylines of a block reference (the same ones plan_dxf._segments yields, so the extent matches the render)
    and the arcs among its virtual entities, in one pass."""
    if depth >= plan_dxf.MAX_INSERT_DEPTH:
        return
    try:
        subs = list(e.virtual_entities())
    except Exception:  # noqa: BLE001 - a broken block draws nothing
        return
    for sub in subs:
        kind = sub.dxftype()
        if kind == "INSERT":
            _walk_insert(sub, depth + 1, segments, arcs)
        elif kind in plan_dxf.DRAWABLE:
            segments.extend(plan_dxf._segments(sub, depth + 1))
            if kind == "ARC":
                a = _arc(sub)
                if a:
                    arcs.append(a)


def _effective_name(doc: Any, name: str) -> str:
    """A dynamic block's references point at anonymous copies (*U12); the copy's block record names the dynamic block
    it came from (XDATA AcDbBlockRepBTag -> the original BLOCK_RECORD handle). Any other name is itself."""
    if not name.startswith("*"):
        return name
    try:
        rec = doc.blocks.get(name).block_record
        if rec.has_xdata("AcDbBlockRepBTag"):
            for tag in rec.get_xdata("AcDbBlockRepBTag"):
                if tag.code == 1005:
                    owner = doc.entitydb.get(tag.value)
                    if owner is not None and owner.dxftype() == "BLOCK_RECORD":
                        return str(owner.dxf.name)
    except Exception:  # noqa: BLE001 - no effective name: the anonymous one
        pass
    return name


def read_entities(src: Any, layers: list[str] | None = None) -> list[dict[str, Any]]:
    """Every drawable entity of the model space (optionally on the given layers) with its polylines in drawing units,
    plus what an INSERT and an ARC add: the block's effective and stored names, the WCS insertion point, rotation,
    scales, the block-to-WCS matrix, the bounding box and the arcs inside it; the arc's WCS centre, radius and end
    points. An entity whose attributes cannot be read is skipped, never fatal."""
    doc = _doc(src)
    chosen = set(layers) if layers else None
    names: dict[str, str] = {}
    out: list[dict[str, Any]] = []
    for e in doc.modelspace():
        try:
            kind = e.dxftype()
            if kind not in plan_dxf.DRAWABLE:
                continue
            layer = str(e.dxf.layer) if e.dxf.hasattr("layer") else "0"
            if chosen is not None and layer not in chosen:
                continue
            item: dict[str, Any] = {"layer": layer, "kind": kind, "handle": str(e.dxf.handle) if e.dxf.hasattr("handle") else "", "segments": [],
                                    "closed": bool(getattr(e, "closed", False) or getattr(e, "is_closed", False)), "insert": None, "arc": None}
            if kind == "INSERT":
                arcs: list[dict[str, Any]] = []
                _walk_insert(e, 0, item["segments"], arcs)
                raw = str(e.dxf.name)
                if raw not in names:
                    names[raw] = _effective_name(doc, raw)
                m = e.matrix44()
                blk = doc.blocks.get(raw)
                bp = blk.block.dxf.base_point if blk is not None else (0.0, 0.0, 0.0)
                origin = m.transform(bp)
                ux = m.transform_direction((1.0, 0.0, 0.0))
                xscale = float(e.dxf.xscale)
                sign = -1.0 if xscale < 0 else 1.0
                item["insert"] = {"name": names[raw], "block": raw, "x": float(origin.x), "y": float(origin.y),
                                  "rotation": math.degrees(math.atan2(sign * ux.y, sign * ux.x)), "xscale": xscale, "yscale": float(e.dxf.yscale),
                                  "matrix": m, "bbox": _bbox(p for seg in item["segments"] for p in seg), "arcs": arcs}
            else:
                item["segments"] = list(plan_dxf._segments(e))
                if kind == "ARC":
                    item["arc"] = _arc(e)
            if not item["segments"]:
                continue
            out.append(item)
        except Exception:  # noqa: BLE001 - one unreadable entity never kills the mapping (plan_dxf._segments does the same)
            continue
    return out


def _block_bbox(doc: Any, name: str, cache: dict[str, Any]) -> tuple[float, float, float, float] | None:
    """The block definition's own bounding box (block coordinates, drawing units), computed once per inserted block."""
    if name in cache:
        return cache[name]
    bb = None
    low = name.lower()
    if not (low.startswith("*model_space") or low.startswith("*paper_space")):
        try:
            blk = doc.blocks.get(name)
            if blk is not None:
                bb = _bbox(p for e in blk if e.dxftype() in plan_dxf.DRAWABLE for seg in plan_dxf._segments(e) for p in seg)
        except Exception:  # noqa: BLE001
            bb = None
    cache[name] = bb
    return bb


def block_footprints(src: Any, cache: dict[str, Any] | None = None) -> dict[str, tuple[float, float]]:
    """One footprint per block (effective) name, in drawing units: the first model-space insert's transformed box
    (width along the block's x, depth along its y, scale and mirror included). The summary shows it and suggests from
    it, and the mapper suggests from the same numbers, so a scaled insert never gets a different item than the card
    showed."""
    doc = _doc(src)
    cache = {} if cache is None else cache
    names: dict[str, str] = {}
    out: dict[str, tuple[float, float]] = {}
    for e in doc.modelspace().query("INSERT"):
        try:
            raw = str(e.dxf.name)
            if raw not in names:
                names[raw] = _effective_name(doc, raw)
            name = names[raw]
            if name in out:
                continue
            bb = _block_bbox(doc, raw, cache)
            if bb is None:
                out[name] = (0.0, 0.0)
                continue
            mat = e.matrix44()
            out[name] = (float(mat.transform_direction((bb[2] - bb[0], 0.0, 0.0)).magnitude), float(mat.transform_direction((0.0, bb[3] - bb[1], 0.0)).magnitude))
        except Exception:  # noqa: BLE001 - an unreadable insert gives no footprint
            continue
    return out


def extent_for(src: Any, layers: list[str] | None, entities: list[dict[str, Any]] | None = None) -> dict[str, float]:
    """The padded extent plan_dxf.render draws the chosen layers with (2 % of the longer side on each edge): the same
    numbers, so a point maps onto the version picture exactly. `entities` (from read_entities) saves a second read."""
    chosen = set(layers) if layers else None
    ents = read_entities(src, layers) if entities is None else [e for e in entities if chosen is None or e["layer"] in chosen]
    minx = miny = math.inf
    maxx = maxy = -math.inf
    for ent in ents:
        for seg in ent["segments"]:
            for x, y in seg:
                minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
    if not math.isfinite(minx):
        raise plan_dxf.DxfError("dxf_empty", "nothing drawable on the chosen layers")
    w_units = max(maxx - minx, 1e-9)
    h_units = max(maxy - miny, 1e-9)
    pad = 0.02 * max(w_units, h_units)
    minx, miny, maxx, maxy = minx - pad, miny - pad, maxx + pad, maxy + pad
    return {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy, "w": maxx - minx, "h": maxy - miny}


def to_version(x: float, y: float, extent: dict[str, float], rotation: int, crop: dict[str, float] | None) -> list[float]:
    """A drawing point -> the version's 0..1 space: the rendered page (y up in the drawing, down in the picture), then
    the version's clockwise rotation, then its crop (plan_render.derive_version_image, in normalised terms)."""
    u = (x - extent["minx"]) / extent["w"]
    v = (extent["maxy"] - y) / extent["h"]
    if rotation == 90:
        u, v = 1 - v, u
    elif rotation == 180:
        u, v = 1 - u, 1 - v
    elif rotation == 270:
        u, v = v, 1 - u
    if crop:
        u, v = (u - crop["x"]) / crop["w"], (v - crop["y"]) / crop["h"]
    return [u, v]


def _sample(ent: dict[str, Any], mpu: float | None) -> str:
    if ent["kind"] == "INSERT" and ent["insert"]:
        return f"INSERT {ent['insert']['name']}"
    length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for seg in ent["segments"] for a, b in zip(seg, seg[1:]))
    size = f"{length * mpu:.1f} m" if mpu else f"{length:.1f} units"
    return f"{ent['kind']} {size}"


def entities_summary(src: Any, layers: list[str] | None, units: str | None, catalog: list[dict[str, Any]]) -> dict[str, Any]:
    """What the mapping screen shows: per layer the drawable count, the entity kinds, a sample and the suggested target
    (with whether the layer is part of the rendered picture); per block (by its effective name) the count, the
    definition's footprint in metres (when the units are known) and the suggested catalog item."""
    mpu = plan_dxf.METERS.get(units or "")
    doc = _doc(src)
    names = []
    for layer in doc.layers:
        try:
            names.append(str(layer.dxf.name))
        except Exception:  # noqa: BLE001
            continue
    ents = read_entities(doc, None)
    per: dict[str, dict[str, Any]] = {n: {"name": n, "count": 0, "kinds": {}, "sample": "", "suggested": suggest_layer(n), "in_render": layers is None or n in layers} for n in names}
    blocks: dict[str, int] = {}
    for ent in ents:
        row = per.setdefault(ent["layer"], {"name": ent["layer"], "count": 0, "kinds": {}, "sample": "", "suggested": suggest_layer(ent["layer"]), "in_render": layers is None or ent["layer"] in layers})
        row["count"] += 1
        row["kinds"][ent["kind"]] = row["kinds"].get(ent["kind"], 0) + 1
        if not row["sample"]:
            row["sample"] = _sample(ent, mpu)
        if ent["insert"]:
            blocks[ent["insert"]["name"]] = blocks.get(ent["insert"]["name"], 0) + 1
    footprints = block_footprints(doc)
    block_rows = []
    for name in sorted(blocks):
        count = blocks[name]
        w, d = footprints.get(name, (0.0, 0.0))
        size_m = [w * mpu, d * mpu] if mpu else [w, d]
        block_rows.append({"name": name, "count": count, "size_m": size_m, "suggested": suggest_block(name, (size_m[0], size_m[1]), catalog)})
    rows = sorted(per.values(), key=lambda r: (-r["count"], r["name"]))
    return {"units": units or "unitless", "metres_per_unit": mpu, "layers": rows, "blocks": block_rows}


# ---------------------------------------------------------------- geometry helpers (metres)

def _unit(a: Pt, b: Pt) -> Pt:
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    return (dx / n, dy / n) if n > 1e-12 else (1.0, 0.0)


def _len(a: Pt, b: Pt) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def _along(d: Pt, a: Pt, p: Pt) -> float:
    return d[0] * (p[0] - a[0]) + d[1] * (p[1] - a[1])


def _lat(d: Pt, a: Pt, p: Pt) -> float:
    """Signed distance of p from the line through a along d (> 0 on the left, n = (-d.y, d.x))."""
    return d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0])


def _cell_for(base: float, points: Iterable[Pt]) -> float:
    """The cell size of a spatial hash over these points: `base` metres, grown so the drawing is at most
    GRID_CELLS_PER_SIDE cells across - the walk per segment is bounded by the drawing's size, not its length in metres."""
    bb = _bbox(points)
    if bb is None:
        return base
    return max(base, math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / GRID_CELLS_PER_SIDE)


class _Grid:
    """A spatial hash of segments by the cells they pass through (padded): what is near a segment or a point is found
    without comparing everything with everything. Build it with a cell from _cell_for, so a long line costs at most
    about GRID_CELLS_PER_SIDE steps."""

    def __init__(self, cell: float = 1.0) -> None:
        self.cell = cell
        self.cells: dict[tuple[int, int], list[int]] = defaultdict(list)

    def _keys(self, a: Pt, b: Pt, pad: float) -> set[tuple[int, int]]:
        c = self.cell
        steps = min(max(1, math.ceil(_len(a, b) / c)), 4 * GRID_CELLS_PER_SIDE)
        keys: set[tuple[int, int]] = set()
        for k in range(steps):
            p = (a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps)
            q = (a[0] + (b[0] - a[0]) * (k + 1) / steps, a[1] + (b[1] - a[1]) * (k + 1) / steps)
            for gx in range(math.floor((min(p[0], q[0]) - pad) / c), math.floor((max(p[0], q[0]) + pad) / c) + 1):
                for gy in range(math.floor((min(p[1], q[1]) - pad) / c), math.floor((max(p[1], q[1]) + pad) / c) + 1):
                    keys.add((gx, gy))
        return keys

    def add(self, key: int, a: Pt, b: Pt, pad: float = 0.0) -> None:
        for k in self._keys(a, b, pad):
            self.cells[k].append(key)

    def near(self, a: Pt, b: Pt, pad: float) -> set[int]:
        out: set[int] = set()
        for k in self._keys(a, b, pad):
            got = self.cells.get(k)
            if got:
                out.update(got)
        return out


def _subtract(pieces: list[tuple[float, float]], lo: float, hi: float) -> list[tuple[float, float]]:
    out = []
    for f0, f1 in pieces:
        if hi <= f0 or lo >= f1:
            out.append((f0, f1))
            continue
        if lo - f0 > 1e-6:
            out.append((f0, lo))
        if f1 - hi > 1e-6:
            out.append((hi, f1))
    return out


# ---------------------------------------------------------------- walls

def _pair_walls(segments: list[tuple[Pt, Pt]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Double lines 10-40 cm apart (parallel within 2 degrees) become walls on the mid line with that thickness. A face
    may pair with several collinear partners (an outer face against an inner face broken at a T-junction): one wall per
    overlap interval, consuming only the paired intervals, the nearest partner first; a face running on past its
    partner by at most the wall thickness band is the corner and extends the wall. What stays unpaired: a leftover
    piece of a paired face no longer than WALL_PAIR_M[1] is dropped (a T-junction gap); a short cap or jamb sitting
    across a paired wall's end is dropped; a line inside a paired wall's band (or widening it within the band limit)
    is absorbed; the rest become single-line walls at the default thickness."""
    info = []
    cell = _cell_for(1.0, (p for s in segments for p in s))
    grid = _Grid(cell)
    for k, (a, b) in enumerate(segments):
        info.append((a, b, _unit(a, b), _len(a, b)))
        grid.add(k, a, b)
    free: list[list[tuple[float, float]]] = [[(0.0, s[3])] for s in info]
    walls: list[dict[str, Any]] = []
    order = sorted(range(len(segments)), key=lambda k: -info[k][3])
    band = WALL_PAIR_M[1]
    for i in order:
        if not free[i]:
            continue
        a, b, d, li = info[i]
        cands = []
        for j in grid.near(a, b, band + 0.05):
            if j == i or not free[j]:
                continue
            c, e, dj, _lj = info[j]
            if abs(d[0] * dj[0] + d[1] * dj[1]) < _COS_PAIR:
                continue
            lat_c, lat_e = _lat(d, a, c), _lat(d, a, e)
            gap = (abs(lat_c) + abs(lat_e)) / 2
            if not WALL_PAIR_M[0] <= gap <= WALL_PAIR_M[1] or abs(lat_c - lat_e) > 0.02:
                continue
            cands.append((gap, j, (lat_c + lat_e) / 2))
        cands.sort()
        for gap, j, lat in cands:
            c, e, dj, _lj = info[j]
            progress = True
            while progress and free[i] and free[j]:
                progress = False
                for f0, f1 in free[i]:
                    for g0, g1 in free[j]:
                        h0 = _along(d, a, (c[0] + dj[0] * g0, c[1] + dj[1] * g0))
                        h1 = _along(d, a, (c[0] + dj[0] * g1, c[1] + dj[1] * g1))
                        h0, h1 = min(h0, h1), max(h0, h1)
                        lo, hi = max(f0, h0), min(f1, h1)
                        if hi - lo < max(MIN_SEGMENT_M, 0.5 * min(f1 - f0, h1 - h0)):
                            continue
                        lo_e = min([lo] + [x for x in (f0, h0) if lo - x <= band])
                        hi_e = max([hi] + [x for x in (f1, h1) if x - hi <= band])
                        free[i] = _subtract(free[i], lo_e, hi_e)
                        pa, pb = (a[0] + d[0] * lo_e, a[1] + d[1] * lo_e), (a[0] + d[0] * hi_e, a[1] + d[1] * hi_e)
                        t0, t1 = _along(dj, c, pa), _along(dj, c, pb)
                        free[j] = _subtract(free[j], min(t0, t1), max(t0, t1))
                        n = (-d[1], d[0])
                        off = (n[0] * lat / 2, n[1] * lat / 2)
                        walls.append({"a": (pa[0] + off[0], pa[1] + off[1]), "b": (pb[0] + off[0], pb[1] + off[1]), "thickness": round(gap, 3), "confidence": 0.9, "paired": True})
                        progress = True
                        break
                    if progress:
                        break
    stats = {"paired": len(walls), "stubs_dropped": 0, "absorbed": 0, "leftovers_dropped": 0}
    # what stayed unpaired, as pieces
    pieces: list[tuple[Pt, Pt]] = []
    for k, (a, b, d, length) in enumerate(info):
        whole = free[k] == [(0.0, length)]
        for f0, f1 in free[k]:
            if not whole and f1 - f0 <= band:
                stats["leftovers_dropped"] += 1
                continue
            if f1 - f0 < MIN_SEGMENT_M:
                continue
            pieces.append(((a[0] + d[0] * f0, a[1] + d[1] * f0), (a[0] + d[0] * f1, a[1] + d[1] * f1)))
    paired = list(walls)
    ends = _Grid(cell)
    faces = _Grid(cell)
    for k, w in enumerate(paired):
        ends.add(k, w["a"], w["a"], 0.0)
        ends.add(k, w["b"], w["b"], 0.0)
        faces.add(k, w["a"], w["b"])
    singles: list[dict[str, Any]] = []
    for p, q in sorted(pieces, key=lambda s: -_len(*s)):
        length = _len(p, q)
        dp = _unit(p, q)
        mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        if length <= band + 0.02:
            cap = False
            for k in ends.near(mid, mid, band):
                w = paired[k]
                dw = _unit(w["a"], w["b"])
                if abs(dp[0] * dw[0] + dp[1] * dw[1]) > _SIN_PERP or length > w["thickness"] + 0.03:
                    continue
                if min(_len(mid, w["a"]), _len(mid, w["b"])) <= max(0.05, 0.25 * w["thickness"]):
                    cap = True
                    break
            if cap:
                stats["stubs_dropped"] += 1
                continue
        absorbed = False
        for k in sorted(faces.near(p, q, band + 0.05)):
            w = paired[k]
            dw = _unit(w["a"], w["b"])
            if abs(dp[0] * dw[0] + dp[1] * dw[1]) < _COS_PAIR:
                continue
            lp, lq = _lat(dw, w["a"], p), _lat(dw, w["a"], q)
            if abs(lp - lq) > 0.02:
                continue
            wl = _len(w["a"], w["b"])
            s0, s1 = sorted((_along(dw, w["a"], p), _along(dw, w["a"], q)))
            cover = min(s1, wl) - max(s0, 0.0)
            if cover < 0.5 * length:
                continue
            lat = (lp + lq) / 2
            half = w["thickness"] / 2
            lo, hi = min(-half, lat), max(half, lat)
            if hi - lo > band + 0.005:
                continue
            if hi - lo > w["thickness"] + 0.01:  # just outside the band: the wall takes the line in and widens, when the line runs along most of it
                if cover < WIDEN_COVER * wl:
                    continue
                shift = (lo + hi) / 2
                n = (-dw[1], dw[0])
                w["a"] = (w["a"][0] + n[0] * shift, w["a"][1] + n[1] * shift)
                w["b"] = (w["b"][0] + n[0] * shift, w["b"][1] + n[1] * shift)
                w["thickness"] = round(hi - lo, 3)
            absorbed = True
            break
        if absorbed:
            stats["absorbed"] += 1
            continue
        singles.append({"a": p, "b": q, "thickness": DEFAULT_THICKNESS_M, "confidence": 0.6, "paired": False})
    return paired + singles, stats


def _opening_features(ents: list[dict[str, Any]], targets: dict[str, str], mpu: float) -> dict[str, list[Any]]:
    """What can span a wall gap and what becomes an opening, in metres: door arcs (loose arcs on an openings layer and
    the arcs inside door blocks, each with the block it came from), door blocks without an arc (their box and base
    point), and the glazing lines of a window layer."""
    arcs: list[dict[str, Any]] = []
    boxes: list[dict[str, Any]] = []
    glazing: list[tuple[Pt, Pt, str]] = []

    def arc_m(arc: dict[str, Any], handle: str, group: str) -> dict[str, Any]:
        return {"c": (arc["cx"] * mpu, arc["cy"] * mpu), "r": arc["r"] * mpu, "p0": (arc["p0"][0] * mpu, arc["p0"][1] * mpu),
                "p1": (arc["p1"][0] * mpu, arc["p1"][1] * mpu), "handle": handle, "group": group}

    for e in ents:
        target = targets[e["layer"]]
        if target == "openings":
            if e["arc"]:
                a = arc_m(e["arc"], e["handle"], e["handle"])
                if DOOR_WIDTH_M[0] <= a["r"] <= DOOR_WIDTH_M[1]:
                    arcs.append(a)
            elif e["insert"]:
                ins = e["insert"]
                inner = [arc_m(x, e["handle"], e["handle"]) for x in ins["arcs"]]
                inner = [x for x in inner if DOOR_WIDTH_M[0] <= x["r"] <= DOOR_WIDTH_M[1]]
                if inner:
                    arcs.extend(inner)
                elif ins["bbox"]:
                    bb = ins["bbox"]
                    boxes.append({"box": (bb[0] * mpu, bb[1] * mpu, bb[2] * mpu, bb[3] * mpu), "base": (ins["x"] * mpu, ins["y"] * mpu), "handle": e["handle"]})
        elif target == "windows":
            for seg in e["segments"]:
                for a, b in zip(seg, seg[1:]):
                    a_m, b_m = (a[0] * mpu, a[1] * mpu), (b[0] * mpu, b[1] * mpu)
                    if _len(a_m, b_m) >= MIN_SEGMENT_M:
                        glazing.append((a_m, b_m, e["handle"]))
    return {"arcs": arcs, "boxes": boxes, "glazing": glazing}


def _spanned(g0: Pt, g1: Pt, d: Pt, thickness: float, feats: dict[str, Any], grids: dict[str, _Grid]) -> bool:
    """Whether an opening in the drawing spans the gap g0 -> g1 (points on a wall's mid line along d): a door arc whose
    radius is the gap and whose hinge sits at one gap end, a door block box covering both ends, or glazing lines
    along the wall covering the gap."""
    gap = _len(g0, g1)
    side = thickness / 2 + 0.15
    mid = ((g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2)
    for k in grids["arcs"].near(mid, mid, gap / 2 + 0.5):
        arc = feats["arcs"][k]
        if abs(arc["r"] - gap) > max(0.1, 0.15 * gap) or abs(_lat(d, g0, arc["c"])) > side:
            continue
        s = _along(d, g0, arc["c"])
        if abs(s) <= 0.15 or abs(s - gap) <= 0.15:
            return True
    for k in grids["boxes"].near(mid, mid, gap / 2 + 0.5):
        x0, y0, x1, y1 = feats["boxes"][k]["box"]
        pad = thickness / 2 + 0.1
        if all(x0 - pad <= p[0] <= x1 + pad and y0 - pad <= p[1] <= y1 + pad for p in (g0, g1)):
            return True
    runs = []
    for k in grids["glazing"].near(g0, g1, side):
        a, b, _h = feats["glazing"][k]
        da = _unit(a, b)
        if abs(d[0] * da[0] + d[1] * da[1]) < math.cos(math.radians(5)):
            continue
        if abs(_lat(d, g0, a)) > side or abs(_lat(d, g0, b)) > side:
            continue
        runs.append(tuple(sorted((_along(d, g0, a), _along(d, g0, b)))))
    runs.sort()
    reach = None
    for lo, hi in runs:
        if reach is None:
            if lo > 0.1:
                return False
            reach = hi
        elif lo <= reach + 0.05:
            reach = max(reach, hi)
    return reach is not None and reach >= gap - 0.1


def _bridge(walls: list[dict[str, Any]], feats: dict[str, Any], grids: dict[str, _Grid]) -> tuple[list[dict[str, Any]], int]:
    """Real CAD breaks the wall lines at an opening: collinear wall pieces of the same thickness whose gap an arc, a
    door block or a glazing run spans are joined again into one wall, so the opening has a host."""
    grid = _Grid(_cell_for(1.0, (p for w in walls for p in (w["a"], w["b"]))))
    for k, w in enumerate(walls):
        grid.add(k, w["a"], w["b"])
    parent = list(range(len(walls)))

    def find(k: int) -> int:
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    joined = 0
    for i, w in enumerate(walls):
        a, b = w["a"], w["b"]
        d = _unit(a, b)
        li = _len(a, b)
        ext_a, ext_b = (a[0] - d[0] * MAX_GAP_M, a[1] - d[1] * MAX_GAP_M), (b[0] + d[0] * MAX_GAP_M, b[1] + d[1] * MAX_GAP_M)
        for j in grid.near(ext_a, ext_b, 0.1):
            if j <= i:
                continue
            v = walls[j]
            if abs(v["thickness"] - w["thickness"]) > 0.02:
                continue
            dv = _unit(v["a"], v["b"])
            if abs(d[0] * dv[0] + d[1] * dv[1]) < _COS_PAIR or abs(_lat(d, a, v["a"])) > 0.05 or abs(_lat(d, a, v["b"])) > 0.05:
                continue
            s0, s1 = sorted((_along(d, a, v["a"]), _along(d, a, v["b"])))
            if s0 > li:
                lo, hi = li, s0
            elif s1 < 0:
                lo, hi = s1, 0.0
            else:
                continue
            if not 0.05 < hi - lo <= MAX_GAP_M + 0.05:
                continue
            g0, g1 = (a[0] + d[0] * lo, a[1] + d[1] * lo), (a[0] + d[0] * hi, a[1] + d[1] * hi)
            if _spanned(g0, g1, d, w["thickness"], feats, grids) and find(i) != find(j):
                parent[find(j)] = find(i)
                joined += 1
    groups: dict[int, list[int]] = defaultdict(list)
    for k in range(len(walls)):
        groups[find(k)].append(k)
    out = []
    for members in groups.values():
        if len(members) == 1:
            out.append(walls[members[0]])
            continue
        ref = max((walls[k] for k in members), key=lambda w: _len(w["a"], w["b"]))
        d = _unit(ref["a"], ref["b"])
        ss = [_along(d, ref["a"], p) for k in members for p in (walls[k]["a"], walls[k]["b"])]
        lo, hi = min(ss), max(ss)
        a = ref["a"]
        out.append({"a": (a[0] + d[0] * lo, a[1] + d[1] * lo), "b": (a[0] + d[0] * hi, a[1] + d[1] * hi), "thickness": ref["thickness"],
                    "confidence": min(walls[k]["confidence"] for k in members), "paired": any(walls[k]["paired"] for k in members)})
    return out, joined


def _nearest_wall(p: Pt, walls: list[dict[str, Any]], max_m: float, grid: _Grid | None = None) -> tuple[int, float, float, float] | None:
    """(index, along in metres, lateral, length) of the wall whose line is nearest to p within max_m and whose span
    contains the projection (with a margin of max_m)."""
    best = None
    keys = grid.near(p, p, 0.0) if grid is not None else range(len(walls))
    for i in sorted(keys):
        w = walls[i]
        a, b = w["a"], w["b"]
        d = _unit(a, b)
        length = _len(a, b)
        along = _along(d, a, p)
        lateral = _lat(d, a, p)
        if abs(lateral) <= max_m and -max_m <= along <= length + max_m and (best is None or abs(lateral) < abs(best[2])):
            best = (i, along, lateral, length)
    return best


def _clamped(p: list[float]) -> list[float] | None:
    if not (-0.02 <= p[0] <= 1.02 and -0.02 <= p[1] <= 1.02):
        return None
    return [round(min(1.0, max(0.0, float(p[0]))), 5), round(min(1.0, max(0.0, float(p[1]))), 5)]


def _fits(along_c: float, width: float, length: float) -> bool:
    """An opening lies on its wall: w/2 <= t*L <= L - w/2 (a millimetre of slack for rounding)."""
    return width / 2 - 1e-3 <= along_c <= length - width / 2 + 1e-3


# ---------------------------------------------------------------- mapping

def map_geometry(src: Any, *, layer_map: dict[str, str], block_map: dict[str, str | None], units: str, extent: dict[str, float], rotation: int,
                 crop: dict[str, float] | None, level_id: str, run_id: str, catalog: list[dict[str, Any]], scale_m_per_px: float | None,
                 ceiling_m: float = DEFAULT_CEILING_M, entities: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Candidates from the drawing by the layer and block mapping: walls, openings (doors and windows) and objects in
    the document model, room polygons for the zones accept. `entities` (read_entities of the same document, covering
    the mapped layers) saves reading the drawing again."""
    mpu = plan_dxf.METERS.get(units)
    if not mpu:
        raise plan_dxf.DxfError("dxf_unitless", "the drawing has no units")
    targets = {layer: t for layer, t in layer_map.items() if t in TARGETS and t != "ignore"}
    doc = None if isinstance(src, (str, Path)) else src  # a path is loaded only when something needs the document
    if entities is None:
        if targets and doc is None:
            doc = _doc(src)
        entities = read_entities(doc, sorted(targets)) if targets else []
    ents = [e for e in entities if e["layer"] in targets]
    m = lambda p: (p[0] * mpu, p[1] * mpu)  # noqa: E731 - metres for the geometry
    # a floor kilometres wide is a drawing in the wrong units (or a stray line): refused before any geometry work
    span = _bbox((x * mpu, y * mpu) for e in ents for seg in e["segments"] for x, y in seg)
    if span is not None and max(span[2] - span[0], span[3] - span[1]) > MAX_EXTENT_M:
        raise plan_dxf.DxfError("dxf_extent_too_large", "the mapped layers span more than the limit",
                                {"extent_m": round(max(span[2] - span[0], span[3] - span[1]), 1), "limit_m": MAX_EXTENT_M, "units": units})
    grow = math.hypot(span[2] - span[0], span[3] - span[1]) / GRID_CELLS_PER_SIDE if span is not None else 0.0

    def tv(p_m: Pt) -> list[float]:
        return to_version(p_m[0] / mpu, p_m[1] / mpu, extent, rotation, crop)

    wall_segments = []
    for e in ents:
        if targets[e["layer"]] == "walls":
            for seg in e["segments"]:
                for a, b in zip(seg, seg[1:]):
                    a_m, b_m = m(a), m(b)
                    if _len(a_m, b_m) >= MIN_SEGMENT_M:
                        wall_segments.append((a_m, b_m))
    walls, wall_stats = _pair_walls(wall_segments)
    feats = _opening_features(ents, targets, mpu)
    grids = {"arcs": _Grid(max(2.0, grow)), "boxes": _Grid(max(2.0, grow)), "glazing": _Grid(max(1.0, grow))}
    for k, arc in enumerate(feats["arcs"]):
        grids["arcs"].add(k, arc["c"], arc["c"])
    for k, box in enumerate(feats["boxes"]):
        x0, y0, x1, y1 = box["box"]
        for p, q in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
            grids["boxes"].add(k, p, q)
    for k, (a, b, _h) in enumerate(feats["glazing"]):
        grids["glazing"].add(k, a, b)
    walls, joined = _bridge(walls, feats, grids)

    out_walls: list[dict[str, Any]] = []
    wall_index: dict[int, int] = {}
    host_grid = _Grid(max(2.0, grow))
    for i, w in enumerate(walls):
        va, vb = tv(w["a"]), tv(w["b"])
        pa, pb = _clamped(va), _clamped(vb)
        if pa is None and pb is None:
            continue
        pa = pa or [round(min(1.0, max(0.0, float(va[0]))), 5), round(min(1.0, max(0.0, float(va[1]))), 5)]
        pb = pb or [round(min(1.0, max(0.0, float(vb[0]))), 5), round(min(1.0, max(0.0, float(vb[1]))), 5)]
        wall_index[i] = len(out_walls)
        host_grid.add(i, w["a"], w["b"], NEAR_WALL_M + 0.05)
        out_walls.append({"id": f"imp-{run_id}-w{len(out_walls) + 1:03d}", "level_id": level_id, "polyline": [pa, pb], "thickness_m": w["thickness"], "height_m": None, "base_z_m": 0,
                          "kind": "exterior" if w["paired"] and w["thickness"] >= 0.25 else "interior", "confidence": w["confidence"], "source": "imported", "locked": False, "external_ids": {}})

    out_openings: list[dict[str, Any]] = []
    spans: dict[int, list[tuple[float, float]]] = defaultdict(list)
    dropped_openings = 0

    def add_opening(kind: str, wi: int, along_c: float, length: float, width: float, swing: str, hinge: str, confidence: float, handle: str) -> None:
        nonlocal dropped_openings
        if not _fits(along_c, width, length):
            dropped_openings += 1
            return
        lo, hi = along_c - width / 2, along_c + width / 2
        if any(min(hi, h) - max(lo, l) > 0.5 * min(width, h - l) for l, h in spans[wi]):
            return  # the same opening twice (a double-drawn arc, glazing over a door block)
        spans[wi].append((lo, hi))
        t = min(1.0, max(0.0, along_c / length))
        out_openings.append({"id": f"imp-{run_id}-o{len(out_openings) + 1:03d}", "wall_id": out_walls[wall_index[wi]]["id"], "t": round(t, 5), "kind": kind, "width_m": round(width, 3),
                             "height_m": 1.2 if kind == "window" else 2.1, "sill_m": 0.9 if kind == "window" else 0, "swing": swing, "hinge": hinge, "anchor_ref": None,
                             "confidence": confidence, "source": "imported", "external_ids": {"dxf_handle": handle}})

    def swing_of(w: dict[str, Any], toward: Pt) -> str:
        # decided in the picture's space (y down), with the convention of geometry.ts: nl = (d.y, -d.x) is "left"
        va, vb, vt = tv(w["a"]), tv(w["b"]), tv(toward)
        dv = (vb[0] - va[0], vb[1] - va[1])
        lateral = dv[0] * (vt[1] - va[1]) - dv[1] * (vt[0] - va[0])
        return "left" if lateral < 0 else "right"

    for arc in feats["arcs"]:
        hit = _nearest_wall(arc["c"], walls, NEAR_WALL_M, host_grid)
        if hit is None or hit[0] not in wall_index:
            continue
        wi, _along_h, _lat_h, length = hit
        w = walls[wi]
        d = _unit(w["a"], w["b"])
        ends = [arc["p0"], arc["p1"]]
        # the arc end on the wall line is the other gap end; the other one is the leaf tip
        on_wall = min(ends, key=lambda p: abs(_lat(d, w["a"], p)))
        tip = ends[1] if on_wall is ends[0] else ends[0]
        hinge_along = _along(d, w["a"], arc["c"])
        other_along = _along(d, w["a"], on_wall)
        add_opening("door", wi, (hinge_along + other_along) / 2, length, arc["r"], swing_of(w, tip), "start" if hinge_along < other_along else "end", 0.85, arc["handle"])
    for box in feats["boxes"]:
        x0, y0, x1, y1 = box["box"]
        best = None
        for p, q in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
            width = _len(p, q)
            if not DOOR_WIDTH_M[0] <= width <= DOOR_WIDTH_M[1]:
                continue
            mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            hit = _nearest_wall(mid, walls, NEAR_WALL_M, host_grid)
            if hit is None or hit[0] not in wall_index:
                continue
            w = walls[hit[0]]
            d = _unit(w["a"], w["b"])
            if abs(d[0] * _unit(p, q)[0] + d[1] * _unit(p, q)[1]) < math.cos(math.radians(10)):
                continue
            if best is None or abs(hit[2]) < abs(best[0][2]):
                best = (hit, p, q)
        if best is None:
            continue
        (wi, _al, _lt, length), p, q = best
        w = walls[wi]
        d = _unit(w["a"], w["b"])
        sp, sq = _along(d, w["a"], p), _along(d, w["a"], q)
        # without an arc: the hinge is the edge end nearer the block's base point, the leaf swings toward the block body
        sb = _along(d, w["a"], box["base"])
        hinge = "start" if abs(sb - min(sp, sq)) <= abs(sb - max(sp, sq)) else "end"
        add_opening("door", wi, (sp + sq) / 2, length, abs(sq - sp), swing_of(w, ((x0 + x1) / 2, (y0 + y1) / 2)), hinge, 0.6, box["handle"])
    # windows: the lines of a window layer grouped by their wall, overlapping runs merged
    runs: dict[int, list[tuple[float, float, str]]] = defaultdict(list)
    for a, b, handle in feats["glazing"]:
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        hit = _nearest_wall(mid, walls, NEAR_WALL_M, host_grid)
        if hit is None or hit[0] not in wall_index:
            continue
        w = walls[hit[0]]
        d = _unit(w["a"], w["b"])
        p0, p1 = _along(d, w["a"], a), _along(d, w["a"], b)
        runs[hit[0]].append((min(p0, p1), max(p0, p1), handle))
    for wi, items in runs.items():
        items.sort()
        merged: list[list[Any]] = []
        for lo, hi, handle in items:
            if merged and lo <= merged[-1][1] + 0.05:
                merged[-1][1] = max(merged[-1][1], hi)
            else:
                merged.append([lo, hi, handle])
        length = _len(walls[wi]["a"], walls[wi]["b"])
        for lo, hi, handle in merged:
            width = hi - lo
            if WINDOW_WIDTH_M[0] <= width <= WINDOW_WIDTH_M[1]:
                add_opening("window", wi, (lo + hi) / 2, length, width, "none", "start", 0.7, handle)

    # objects: INSERT blocks on object layers, in the document model (plan_geometry._check_fields("objects"))
    out_objects: list[dict[str, Any]] = []
    by_id = {c["id"]: c for c in catalog}
    bbox_cache: dict[str, Any] = {}
    suggestions: dict[str, dict[str, Any]] = {}  # one suggestion per block name, from the footprint the summary showed
    footprints: dict[str, tuple[float, float]] | None = None
    for e in ents:
        if targets[e["layer"]] != "objects" or not e["insert"]:
            continue
        ins = e["insert"]
        name = ins["name"]
        if doc is None:
            doc = _doc(src)
        bb = _block_bbox(doc, ins["block"], bbox_cache)
        mat = ins["matrix"]
        if bb is not None:
            cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
            centre = mat.transform((cx, cy, 0.0))
            w_u = abs(mat.transform_direction((bb[2] - bb[0], 0.0, 0.0)).magnitude)
            d_u = abs(mat.transform_direction((0.0, bb[3] - bb[1], 0.0)).magnitude)
        else:
            centre = mat.transform((0.0, 0.0, 0.0))
            w_u = d_u = 0.0
        size_m = (w_u * mpu, d_u * mpu)
        if name in block_map:
            # the person's choice; null (or an id the library no longer has) is the generic object
            chosen = block_map[name]
            item_id = chosen if isinstance(chosen, str) and chosen in by_id else GENERIC_ID
            word_name = suggest_block(name, size_m, [])["name"]
        else:
            if name not in suggestions:
                if footprints is None:
                    footprints = block_footprints(doc, bbox_cache)
                fw, fd = footprints.get(name, (0.0, 0.0))
                suggestions[name] = suggest_block(name, (fw * mpu, fd * mpu), catalog)
            suggestion = suggestions[name]
            if suggestion["catalog_id"] is None:
                continue  # a door or a window block on an object layer is not an object unless the person maps it
            item_id, word_name = suggestion["catalog_id"], suggestion["name"]
        item = by_id.get(item_id)
        label = (item["name_he"] or item["name_en"] or item_id) if item is not None and item_id != GENERIC_ID else word_name
        base_size = item["size"] if item and item.get("size") and all(item["size"]) else GENERIC_SIZE_M
        size = [s if plan_catalog.MIN_SIZE_M <= s <= plan_catalog.MAX_SIZE_M else float(base_size[k]) for k, s in enumerate(size_m)]
        h_m = float(base_size[2])
        z = float(item.get("z_m") or 0.0) if item else 0.0
        if item and item.get("z_ref") == "ceiling":
            z += ceiling_m  # a ceiling item hangs from the level's ceiling (studio-ops objectZ)
        pos = _clamped(tv((float(centre.x) * mpu, float(centre.y) * mpu)))
        if pos is None:
            continue
        rot = round((-ins["rotation"] + rotation) % 360.0, 2) % 360.0
        out_objects.append({
            "id": f"imp-{run_id}-x{len(out_objects) + 1:03d}", "level_id": level_id, "item_id": item_id, "position": pos, "rotation_deg": rot,
            "size": {"w_m": round(size[0], 3), "d_m": round(size[1], 3), "h_m": round(h_m, 3)},
            "z_m": round(min(plan_catalog.MAX_Z_M, max(plan_catalog.MIN_Z_M, z)), 3), "params": {}, "label": label,
            "anchor_ref": None, "group_id": None, "locked": False, "source": "imported",
            "confidence": 0.7 if item_id != GENERIC_ID else 0.5, "external_ids": {"dxf_block": name, "dxf_handle": e["handle"]},
        })
    # rooms: closed polylines on a room layer, for the zones accept (rooms live in spatial_zones, design decision 1)
    out_rooms: list[dict[str, Any]] = []
    for e in ents:
        if targets[e["layer"]] != "rooms":
            continue
        for seg in e["segments"]:
            pts = seg[:-1] if len(seg) > 3 and seg[0] == seg[-1] else seg
            if len(pts) < 3 or not (e["closed"] or seg[0] == seg[-1]):
                continue
            poly = [_clamped(tv(m(p))) for p in pts]
            if all(p is not None for p in poly):
                out_rooms.append({"polygon": [{"x": p[0], "y": p[1]} for p in poly if p is not None], "name": "", "external_ids": {"dxf_handle": e["handle"]}})
    return {
        "walls": out_walls, "openings": out_openings, "objects": out_objects, "rooms": out_rooms,
        # counts only: the draft's meta.last_detection keeps these params, so the maps are never echoed
        "detector": {"name": "plan_dxf_map", "version": VERSION, "params": {"layers": len(layer_map), "blocks": len(block_map), "units": units, "rotation": rotation, "crop": crop}},
        "calibration_hint": None, "pixels": {},
        "scale": {"m_per_px": scale_m_per_px, "status": "measured"},
        "stats": {"entities": len(ents), "wall_segments": len(wall_segments), **wall_stats, "bridged": joined, "openings_dropped": dropped_openings},
    }


def import_geometry(path: Path, *, render_layers: list[str] | None, layer_map: dict[str, str], block_map: dict[str, str | None], units: str, rotation: int,
                    crop: dict[str, float] | None, level_id: str, run_id: str, catalog: list[dict[str, Any]], scale_m_per_px: float | None,
                    ceiling_m: float = DEFAULT_CEILING_M) -> dict[str, Any]:
    """The import route's work in one read of the file: the render extent of the version's layers and the candidates
    of the mapped layers."""
    doc = load(path)
    mapped = sorted(layer for layer, t in layer_map.items() if t in TARGETS and t != "ignore")
    ents = read_entities(doc, None if render_layers is None else sorted(set(render_layers) | set(mapped)))
    extent = extent_for(doc, render_layers, entities=ents)
    return map_geometry(doc, layer_map=layer_map, block_map=block_map, units=units, extent=extent, rotation=rotation, crop=crop, level_id=level_id, run_id=run_id,
                        catalog=catalog, scale_m_per_px=scale_m_per_px, ceiling_m=ceiling_m, entities=ents)
