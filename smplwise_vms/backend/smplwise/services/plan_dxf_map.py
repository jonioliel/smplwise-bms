"""DXF layers and blocks mapped to Plan Studio candidates (phase 3, T086, design 9.4), on the existing ezdxf adapter
(plan_dxf): layer names suggest a target by common naming (WALL / A-WALL / MUR / קיר -> walls, DOOR -> openings,
WIND / GLAZ -> windows, FURN / EQPM -> objects, ROOM / AREA -> rooms), INSERT blocks suggest a catalog item by their
name and bounding box, two parallel lines 10-40 cm apart become one wall with that thickness, an arc becomes a door
with the swing of the drawing, lines on a window layer become a window on their wall, closed polylines on a room
layer become room polygons for the zones accept. Everything is measured in the drawing's units, so the metres are
real (`measured`); positions go through the render extent, the version's rotation and its crop into the version's
0..1 space. The result has the shape of plan_detect.detect (source "imported", ids "imp-<run>-...")."""
from __future__ import annotations

import math
import re
import sqlite3
from pathlib import Path
from typing import Any

from . import plan_catalog, plan_dxf

VERSION = "1.0"
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
GENERIC_NAME = "עצם כללי"
GENERIC_HEIGHT_M = 0.8
WALL_PAIR_M = (0.10, 0.40)  # two parallel lines this far apart are one wall
PAIR_ANGLE_DEG = 2.0
NEAR_WALL_M = 0.35  # an arc or a window line belongs to the wall within this distance
DEFAULT_THICKNESS_M = 0.2
DOOR_WIDTH_M = (0.5, 2.5)
WINDOW_WIDTH_M = (0.3, 4.0)
MIN_SEGMENT_M = 0.05
_TOKEN = re.compile(r"[^0-9a-z֐-׿]+")


def _tokens(name: str) -> list[str]:
    return [t for t in _TOKEN.split(str(name).lower()) if t]


def suggest_layer(name: str) -> str:
    tokens = set(_tokens(name))
    for target, words in LAYER_RULES:
        if tokens & set(words):
            return target
    return "ignore"


def suggest_block(name: str, size_m: tuple[float, float] | list[float], catalog: list[dict[str, Any]]) -> dict[str, Any]:
    """The catalog item a block name points at: a token of the name equal to a word of an item's English name (3), a
    tag (2), or contained in the name (1); ties go to the closest footprint. Without a match the word list gives a
    Hebrew name (a plain box of the block's size); without that, the generic object."""
    tokens = _tokens(name)
    best: tuple[int, float, dict[str, Any]] | None = None
    for item in catalog:
        en_words = set(_tokens(item.get("name_en") or ""))
        tags = {t.lower() for t in item.get("tags") or []}
        score = 0
        for t in tokens:
            if t in en_words:
                score = max(score, 3)
            elif t in tags:
                score = max(score, 2)
            elif len(t) >= 3 and any(t in w for w in en_words):
                score = max(score, 1)
        if score:
            sz = item.get("size") or (0, 0, 0)
            fit = abs(float(sz[0]) - float(size_m[0])) + abs(float(sz[1]) - float(size_m[1]))
            if best is None or (score, -fit) > (best[0], -best[1]):
                best = (score, fit, item)
    if best is not None:
        return {"catalog_id": best[2]["id"], "name": best[2].get("name_he") or best[2].get("name_en") or best[2]["id"]}
    for t in tokens:
        if t in BLOCK_WORDS:
            return {"catalog_id": None, "name": BLOCK_WORDS[t]}
    return {"catalog_id": None, "name": GENERIC_NAME}


def _norm_item(raw: dict[str, Any]) -> dict[str, Any] | None:
    """One library item (plan_catalog.builtin() / plan_catalog.library(), both {id, names: {he, en}, tags, size: {w_m,
    d_m, h_m}, ...}) in the plain shape this module works with."""
    if not isinstance(raw, dict) or not raw.get("id"):
        return None
    names = raw.get("names") if isinstance(raw.get("names"), dict) else {}
    size = raw.get("size") if isinstance(raw.get("size"), dict) else {}
    return {"id": str(raw["id"]), "name_he": names.get("he") or "", "name_en": names.get("en") or "",
            "tags": [str(t) for t in (raw.get("tags") or []) if isinstance(t, (str, int))],
            "size": (float(size.get("w_m") or 0), float(size.get("d_m") or 0), float(size.get("h_m") or 0))}


def load_catalog(conn: sqlite3.Connection | None) -> list[dict[str, Any]]:
    """The built-in library (smplwise/catalog/objects.json, phase 2, served by plan_catalog.builtin) plus the
    installation's custom items (plan_catalog.library, catalog_items table, phase 2), read through plan_catalog so
    this module and the phase-2 validator never disagree about shape. Deviation from the brief: the brief's SQL read
    catalog_items columns (name_he, name_en, size_w_m, ..., deleted_at) that do not exist in migration 0020 (names_json
    / size_json, no soft delete) - plan_catalog.library/builtin already merge and normalise both sources correctly, so
    this reuses them instead of hand-rolling a second, incompatible reader. Without a connection: the built-in items
    alone. A broken catalog file (a packaging error plan_catalog.builtin() raises on) or a missing table -> empty."""
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
    return [{"id": None, "name": GENERIC_NAME}] + [{"id": c["id"], "name": c["name_he"] or c["name_en"] or c["id"]} for c in catalog[:400]]


# ---------------------------------------------------------------- reading the drawing

def _bbox(points: list[tuple[float, float]]) -> tuple[float, float, float, float] | None:
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def read_entities(path: Path, layers: list[str] | None = None) -> list[dict[str, Any]]:
    """Every drawable entity of the model space (optionally on the given layers) with its polylines in drawing units,
    plus what an INSERT and an ARC add: the block name, insertion point, rotation, scales and bounding box; the arc's
    centre, radius and end points."""
    doc, _warnings = plan_dxf._load(path)
    msp = doc.modelspace()
    chosen = set(layers) if layers else None
    out: list[dict[str, Any]] = []
    for e in msp:
        kind = e.dxftype()
        if kind not in plan_dxf.DRAWABLE:
            continue
        layer = str(e.dxf.layer) if e.dxf.hasattr("layer") else "0"
        if chosen is not None and layer not in chosen:
            continue
        segments = list(plan_dxf._segments(e))
        if not segments:
            continue
        item: dict[str, Any] = {"layer": layer, "kind": kind, "handle": str(e.dxf.handle) if e.dxf.hasattr("handle") else "", "segments": segments,
                                "closed": bool(getattr(e, "closed", False) or getattr(e, "is_closed", False)), "insert": None, "arc": None}
        if kind == "INSERT":
            pts = [p for seg in segments for p in seg]
            item["insert"] = {"name": str(e.dxf.name), "x": float(e.dxf.insert.x), "y": float(e.dxf.insert.y), "rotation": float(e.dxf.rotation),
                              "xscale": float(e.dxf.xscale), "yscale": float(e.dxf.yscale), "bbox": _bbox(pts)}
        elif kind == "ARC":
            item["arc"] = {"cx": float(e.dxf.center.x), "cy": float(e.dxf.center.y), "r": float(e.dxf.radius),
                           "p0": (float(e.start_point.x), float(e.start_point.y)), "p1": (float(e.end_point.x), float(e.end_point.y))}
        out.append(item)
    return out


def _block_sizes(path: Path) -> dict[str, tuple[float, float]]:
    """The untransformed footprint (width along x, depth along y, drawing units) of every block definition."""
    doc, _warnings = plan_dxf._load(path)
    sizes: dict[str, tuple[float, float]] = {}
    for block in doc.blocks:
        name = str(block.name)
        if name.startswith("*"):
            continue
        pts = [p for e in block if e.dxftype() in plan_dxf.DRAWABLE for seg in plan_dxf._segments(e) for p in seg]
        bb = _bbox(pts)
        if bb:
            sizes[name] = (bb[2] - bb[0], bb[3] - bb[1])
    return sizes


def extent_for(path: Path, layers: list[str] | None) -> dict[str, float]:
    """The padded extent plan_dxf.render draws the chosen layers with (2 % of the longer side on each edge): the same
    numbers, so a point maps onto the version picture exactly."""
    minx = miny = math.inf
    maxx = maxy = -math.inf
    for ent in read_entities(path, layers):
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
    length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for seg in ent["segments"] for a, b in zip(seg, seg[1:]))
    if ent["kind"] == "INSERT" and ent["insert"]:
        return f"INSERT {ent['insert']['name']}"
    size = f"{length * mpu:.1f} m" if mpu else f"{length:.1f} units"
    return f"{ent['kind']} {size}"


def entities_summary(path: Path, layers: list[str] | None, units: str | None, catalog: list[dict[str, Any]]) -> dict[str, Any]:
    """What the mapping screen shows: per layer the drawable count, the entity kinds, a sample and the suggested target
    (with whether the layer is part of the rendered picture); per block name the count, footprint in metres (when the
    units are known) and the suggested catalog item."""
    mpu = plan_dxf.METERS.get(units or "")
    doc, _warnings = plan_dxf._load(path)
    names = [str(layer.dxf.name) for layer in doc.layers]
    ents = read_entities(path, None)
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
    sizes = _block_sizes(path)
    block_rows = []
    for name in sorted(blocks):
        w, d = sizes.get(name, (0.0, 0.0))
        size_m = [w * mpu, d * mpu] if mpu else [w, d]
        block_rows.append({"name": name, "count": blocks[name], "size_m": size_m, "suggested": suggest_block(name, (size_m[0], size_m[1]), catalog)})
    rows = sorted(per.values(), key=lambda r: (-r["count"], r["name"]))
    return {"units": units or "unitless", "metres_per_unit": mpu, "layers": rows, "blocks": block_rows}


# ---------------------------------------------------------------- mapping

def _unit(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    return (dx / n, dy / n) if n > 1e-12 else (1.0, 0.0)


def _pair_walls(segments: list[tuple[tuple[float, float], tuple[float, float]]]) -> list[dict[str, Any]]:
    """Double lines 10-40 cm apart (parallel within 2 degrees, projections overlapping by half the shorter one) become one
    wall on the mid line with that thickness; the rest are single-line walls at the default thickness."""
    used = [False] * len(segments)
    walls: list[dict[str, Any]] = []
    order = sorted(range(len(segments)), key=lambda i: -math.hypot(segments[i][1][0] - segments[i][0][0], segments[i][1][1] - segments[i][0][1]))
    for i in order:
        if used[i]:
            continue
        a, b = segments[i]
        d = _unit(a, b)
        li = math.hypot(b[0] - a[0], b[1] - a[1])
        best = None
        for j in order:
            if j == i or used[j]:
                continue
            c, e = segments[j]
            dj = _unit(c, e)
            cos = abs(d[0] * dj[0] + d[1] * dj[1])
            if math.degrees(math.acos(max(-1.0, min(1.0, cos)))) > PAIR_ANGLE_DEG:
                continue
            lat_c = d[0] * (c[1] - a[1]) - d[1] * (c[0] - a[0])
            lat_e = d[0] * (e[1] - a[1]) - d[1] * (e[0] - a[0])
            gap = (abs(lat_c) + abs(lat_e)) / 2
            if not WALL_PAIR_M[0] <= gap <= WALL_PAIR_M[1] or abs(lat_c - lat_e) > 0.02:
                continue
            p0 = d[0] * (c[0] - a[0]) + d[1] * (c[1] - a[1])
            p1 = d[0] * (e[0] - a[0]) + d[1] * (e[1] - a[1])
            lo, hi = min(p0, p1), max(p0, p1)
            overlap = min(li, hi) - max(0.0, lo)
            lj = math.hypot(e[0] - c[0], e[1] - c[1])
            if overlap < 0.5 * min(li, lj):
                continue
            if best is None or gap < best[0]:
                best = (gap, j, lo, hi, (lat_c + lat_e) / 2)
        if best is None:
            walls.append({"a": a, "b": b, "thickness": DEFAULT_THICKNESS_M, "confidence": 0.6, "paired": False})
            continue
        gap, j, lo, hi, lat = best
        used[i] = used[j] = True
        n = (-d[1], d[0])  # lateral > 0 is on this side
        start, end = min(0.0, lo), max(li, hi)
        mid = (a[0] + n[0] * lat / 2, a[1] + n[1] * lat / 2)
        walls.append({"a": (mid[0] + d[0] * start, mid[1] + d[1] * start), "b": (mid[0] + d[0] * end, mid[1] + d[1] * end), "thickness": round(gap, 3), "confidence": 0.9, "paired": True})
    return walls


def _nearest_wall(p: tuple[float, float], walls: list[dict[str, Any]], max_m: float) -> tuple[int, float, float] | None:
    """(index, along 0..1, lateral) of the wall whose line is nearest to p within max_m and whose span contains the
    projection (with a margin of max_m)."""
    best = None
    for i, w in enumerate(walls):
        a, b = w["a"], w["b"]
        d = _unit(a, b)
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        along = d[0] * (p[0] - a[0]) + d[1] * (p[1] - a[1])
        lateral = d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0])
        if abs(lateral) <= max_m and -max_m <= along <= length + max_m and (best is None or abs(lateral) < abs(best[2])):
            best = (i, max(0.0, min(1.0, along / length)), lateral)
    return best


def _clamped(p: list[float]) -> list[float] | None:
    if not (-0.02 <= p[0] <= 1.02 and -0.02 <= p[1] <= 1.02):
        return None
    return [round(min(1.0, max(0.0, p[0])), 5), round(min(1.0, max(0.0, p[1])), 5)]


def map_geometry(path: Path, *, layer_map: dict[str, str], block_map: dict[str, str | None], units: str, extent: dict[str, float], rotation: int,
                 crop: dict[str, float] | None, level_id: str, run_id: str, catalog: list[dict[str, Any]], scale_m_per_px: float | None) -> dict[str, Any]:
    mpu = plan_dxf.METERS.get(units)
    if not mpu:
        raise plan_dxf.DxfError("dxf_unitless", "the drawing has no units")
    targets = {layer: t for layer, t in layer_map.items() if t in TARGETS and t != "ignore"}
    ents = [e for e in read_entities(path, None) if e["layer"] in targets]
    # metres for the geometry; the transform to the picture is done per point at the end
    m = lambda p: (p[0] * mpu, p[1] * mpu)  # noqa: E731

    def tv(p_m: tuple[float, float]) -> list[float]:
        return to_version(p_m[0] / mpu, p_m[1] / mpu, extent, rotation, crop)

    wall_segments = []
    for e in ents:
        if targets[e["layer"]] == "walls":
            for seg in e["segments"]:
                for a, b in zip(seg, seg[1:]):
                    a_m, b_m = m(a), m(b)
                    if math.hypot(b_m[0] - a_m[0], b_m[1] - a_m[1]) >= MIN_SEGMENT_M:
                        wall_segments.append((a_m, b_m))
    walls = _pair_walls(wall_segments)
    out_walls: list[dict[str, Any]] = []
    wall_index: dict[int, int] = {}
    for i, w in enumerate(walls):
        pa, pb = _clamped(tv(w["a"])), _clamped(tv(w["b"]))
        if pa is None and pb is None:
            continue
        pa = pa or [round(min(1.0, max(0.0, tv(w["a"])[0])), 5), round(min(1.0, max(0.0, tv(w["a"])[1])), 5)]
        pb = pb or [round(min(1.0, max(0.0, tv(w["b"])[0])), 5), round(min(1.0, max(0.0, tv(w["b"])[1])), 5)]
        wall_index[i] = len(out_walls)
        out_walls.append({"id": f"imp-{run_id}-w{len(out_walls) + 1:03d}", "level_id": level_id, "polyline": [pa, pb], "thickness_m": w["thickness"], "height_m": None, "base_z_m": 0,
                          "kind": "exterior" if w["paired"] and w["thickness"] >= 0.25 else "interior", "confidence": w["confidence"], "source": "imported", "locked": False, "external_ids": {}})

    def opening(kind: str, wi: int, t: float, width: float, swing: str, hinge: str, confidence: float, handle: str) -> dict[str, Any]:
        return {"id": f"imp-{run_id}-o{len(out_openings) + 1:03d}", "wall_id": out_walls[wall_index[wi]]["id"], "t": round(t, 5), "kind": kind, "width_m": round(width, 3),
                "height_m": 1.2 if kind == "window" else 2.1, "sill_m": 0.9 if kind == "window" else 0, "swing": swing, "hinge": hinge, "anchor_ref": None,
                "confidence": confidence, "source": "imported", "external_ids": {"dxf_handle": handle}}

    out_openings: list[dict[str, Any]] = []
    for e in ents:
        if targets[e["layer"]] != "openings":
            continue
        if e["arc"]:
            arc = e["arc"]
            hinge_m = m((arc["cx"], arc["cy"]))
            width = arc["r"] * mpu
            if not DOOR_WIDTH_M[0] <= width <= DOOR_WIDTH_M[1]:
                continue
            hit = _nearest_wall(hinge_m, walls, NEAR_WALL_M)
            if hit is None or hit[0] not in wall_index:
                continue
            wi, _t_h, _lat = hit
            w = walls[wi]
            d = _unit(w["a"], w["b"])
            length = math.hypot(w["b"][0] - w["a"][0], w["b"][1] - w["a"][1])
            ends = [m(arc["p0"]), m(arc["p1"])]
            # the arc end on the wall line is the other gap end; the other one is the leaf tip
            on_wall = min(ends, key=lambda p: abs(d[0] * (p[1] - w["a"][1]) - d[1] * (p[0] - w["a"][0])))
            tip = ends[1] if on_wall is ends[0] else ends[0]
            centre = ((hinge_m[0] + on_wall[0]) / 2, (hinge_m[1] + on_wall[1]) / 2)
            t = (d[0] * (centre[0] - w["a"][0]) + d[1] * (centre[1] - w["a"][1])) / length
            hinge_along = d[0] * (hinge_m[0] - w["a"][0]) + d[1] * (hinge_m[1] - w["a"][1])
            other_along = d[0] * (on_wall[0] - w["a"][0]) + d[1] * (on_wall[1] - w["a"][1])
            hinge = "start" if hinge_along < other_along else "end"
            # the swing is decided in the picture's space (y down), with the convention of geometry.ts: nl = (d.y, -d.x)
            va, vb, vt = tv(w["a"]), tv(w["b"]), tv(tip)
            dv = (vb[0] - va[0], vb[1] - va[1])
            lateral = dv[0] * (vt[1] - va[1]) - dv[1] * (vt[0] - va[0])
            swing = "left" if lateral < 0 else "right"
            out_openings.append(opening("door", wi, t, width, swing, hinge, 0.85, e["handle"]))
        elif e["insert"] and e["insert"]["bbox"]:
            bb = e["insert"]["bbox"]
            width = max(bb[2] - bb[0], bb[3] - bb[1]) * mpu
            if not DOOR_WIDTH_M[0] <= width <= DOOR_WIDTH_M[1]:
                continue
            centre = m(((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2))
            hit = _nearest_wall(centre, walls, NEAR_WALL_M)
            if hit is None or hit[0] not in wall_index:
                continue
            out_openings.append(opening("door", hit[0], hit[1], width, "right", "start", 0.6, e["handle"]))
    # windows: the lines of a window layer grouped by their wall, overlapping runs merged
    runs: dict[int, list[tuple[float, float, str]]] = {}
    for e in ents:
        if targets[e["layer"]] != "windows":
            continue
        for seg in e["segments"]:
            for a, b in zip(seg, seg[1:]):
                a_m, b_m = m(a), m(b)
                mid = ((a_m[0] + b_m[0]) / 2, (a_m[1] + b_m[1]) / 2)
                hit = _nearest_wall(mid, walls, NEAR_WALL_M)
                if hit is None or hit[0] not in wall_index:
                    continue
                w = walls[hit[0]]
                d = _unit(w["a"], w["b"])
                p0 = d[0] * (a_m[0] - w["a"][0]) + d[1] * (a_m[1] - w["a"][1])
                p1 = d[0] * (b_m[0] - w["a"][0]) + d[1] * (b_m[1] - w["a"][1])
                runs.setdefault(hit[0], []).append((min(p0, p1), max(p0, p1), e["handle"]))
    for wi, items in runs.items():
        items.sort()
        merged: list[list[Any]] = []
        for lo, hi, handle in items:
            if merged and lo <= merged[-1][1] + 0.05:
                merged[-1][1] = max(merged[-1][1], hi)
            else:
                merged.append([lo, hi, handle])
        w = walls[wi]
        length = math.hypot(w["b"][0] - w["a"][0], w["b"][1] - w["a"][1])
        for lo, hi, handle in merged:
            width = hi - lo
            if WINDOW_WIDTH_M[0] <= width <= WINDOW_WIDTH_M[1]:
                out_openings.append(opening("window", wi, (lo + hi) / 2 / length, width, "none", "start", 0.7, handle))
    # objects: INSERT blocks on object layers
    out_objects: list[dict[str, Any]] = []
    sizes = _block_sizes(path)
    for e in ents:
        if targets[e["layer"]] != "objects" or not e["insert"]:
            continue
        ins = e["insert"]
        name = ins["name"]
        w_u, d_u = sizes.get(name, (0.0, 0.0))
        size_m = (abs(w_u * ins["xscale"]) * mpu, abs(d_u * ins["yscale"]) * mpu)
        if name in block_map:
            chosen = next((c for c in catalog if c["id"] == block_map[name]), None) if block_map[name] else None
            pick = {"catalog_id": chosen["id"], "name": chosen["name_he"] or chosen["name_en"] or chosen["id"]} if chosen else {"catalog_id": None, "name": suggest_block(name, size_m, [])["name"]}
        else:
            pick = suggest_block(name, size_m, catalog)
        cat = next((c for c in catalog if c["id"] == pick["catalog_id"]), None)
        pos = _clamped(tv(m((ins["x"], ins["y"]))))
        if pos is None:
            continue
        h_m = cat["size"][2] if cat and cat["size"][2] else GENERIC_HEIGHT_M
        out_objects.append({
            "id": f"imp-{run_id}-x{len(out_objects) + 1:03d}", "level_id": level_id, "catalog_id": pick["catalog_id"], "custom_item_id": None, "name": pick["name"],
            "pose": {"x": pos[0], "y": pos[1], "rotation_deg": int(round((90 - ins["rotation"] + rotation) % 360)), "z_m": 0},
            "size": {"w_m": round(size_m[0] or (cat["size"][0] if cat else 0.5), 3), "d_m": round(size_m[1] or (cat["size"][1] if cat else 0.5), 3), "h_m": round(h_m, 3)},
            "params": {}, "anchor_ref": None, "circuit_id": None, "group_id": None, "flip": False, "locked": False, "source": "imported",
            "confidence": 0.7 if pick["catalog_id"] else 0.5, "external_ids": {"dxf_handle": e["handle"], "dxf_block": name},
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
        "detector": {"name": "plan_dxf_map", "version": VERSION, "params": {"layer_map": dict(layer_map), "block_map": {k: v for k, v in block_map.items()}, "units": units, "rotation": rotation, "crop": crop}},
        "calibration_hint": None, "pixels": {},
        "scale": {"m_per_px": scale_m_per_px, "status": "measured"},
        "stats": {"entities": len(ents), "wall_segments": len(wall_segments), "paired": sum(1 for w in walls if w["paired"])},
    }
