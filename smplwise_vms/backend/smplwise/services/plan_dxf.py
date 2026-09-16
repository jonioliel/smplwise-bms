"""DXF conversion adapter (T065), isolated from the rest of the plan pipeline.

Dependency: ezdxf (MIT, pure Python with optional C speed-ups; pulls numpy, fonttools, pyparsing, typing_extensions).
The source .dxf is kept untouched next to the rendered page; rendering is a reproducible, derived artefact.

What is converted: LINE, LWPOLYLINE (with bulges), POLYLINE, CIRCLE, ARC, ELLIPSE, SPLINE (flattened) and INSERT
(block references, transformed and recursed). What is not: TEXT/MTEXT, HATCH, DIMENSION, 3D solids and anything
else — those are counted and reported, never silently dropped. Units come from the drawing header ($INSUNITS);
'unitless' stays unitless until the person chooses. DWG is not supported: it is a closed format, native CAD parsing
is not an assumed dependency; convert to DXF first."""
from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

DRAWABLE = ("LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "INSERT")
UNITS = {0: "unitless", 1: "in", 2: "ft", 3: "mi", 4: "mm", 5: "cm", 6: "m", 7: "km", 8: "µin", 9: "mil", 10: "yd", 11: "Å", 12: "nm", 13: "µm", 14: "dm", 15: "dam", 16: "hm", 17: "Gm"}
METERS = {"in": 0.0254, "ft": 0.3048, "mi": 1609.344, "mm": 0.001, "cm": 0.01, "m": 1.0, "km": 1000.0, "yd": 0.9144, "dm": 0.1, "dam": 10.0, "hm": 100.0}
MAX_ENTITIES = 400_000
MAX_INSERT_DEPTH = 8


class DxfError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}


@dataclass
class DxfInfo:
    version: str
    units_code: int
    units: str
    layers: list[dict[str, Any]]
    entity_counts: dict[str, int]
    unsupported: dict[str, int]
    extent: dict[str, float] | None
    drawable: int
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def sniff(head: bytes) -> bool:
    """ASCII DXF starts with group code 0 + SECTION (whitespace-padded); binary DXF has a fixed sentinel."""
    if head.startswith(b"AutoCAD Binary DXF"):
        return True
    text = head[:200].replace(b"\r", b"").lstrip()
    lines = text.split(b"\n")
    return len(lines) >= 2 and lines[0].strip() == b"0" and lines[1].strip() in (b"SECTION", b"COMMENT")


def _load(path: Path):
    try:
        import ezdxf
        from ezdxf import recover
    except ImportError as exc:  # pragma: no cover - the dependency is declared
        raise DxfError("dxf_unavailable", "ezdxf is not installed") from exc
    try:
        doc, auditor = recover.readfile(str(path))
    except Exception as exc:  # noqa: BLE001 - not a DXF, or damaged beyond recovery
        raise DxfError("corrupt_dxf", f"the file is not a readable DXF: {type(exc).__name__}") from exc
    if auditor.has_errors:
        # recovered with fixes: usable, but the person is told
        return doc, [f"recovered with {len(auditor.errors)} fixes"]
    return doc, []


def _segments(entity, depth: int = 0):
    """Yield polylines (lists of (x, y)) for a drawable entity, recursing into block references."""
    kind = entity.dxftype()
    try:
        if kind == "LINE":
            yield [(entity.dxf.start.x, entity.dxf.start.y), (entity.dxf.end.x, entity.dxf.end.y)]
        elif kind in ("LWPOLYLINE", "POLYLINE"):
            if kind == "POLYLINE" and not entity.is_2d_polyline:
                return
            pts = [(v.x, v.y) for v in entity.flattening(0.02)] if hasattr(entity, "flattening") else []
            if not pts and kind == "LWPOLYLINE":
                pts = [(p[0], p[1]) for p in entity.get_points("xy")]
            if not pts and kind == "POLYLINE":
                pts = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            if len(pts) >= 2:
                if getattr(entity, "closed", False) or getattr(entity, "is_closed", False):
                    pts = pts + [pts[0]]
                yield pts
        elif kind in ("CIRCLE", "ARC", "ELLIPSE", "SPLINE"):
            pts = [(v.x, v.y) for v in entity.flattening(0.02)]
            if len(pts) >= 2:
                yield pts
        elif kind == "INSERT":
            if depth >= MAX_INSERT_DEPTH:
                return
            for sub in entity.virtual_entities():
                yield from _segments(sub, depth + 1)
    except Exception:  # noqa: BLE001 - one bad entity never kills the drawing; it is simply not drawn
        return


def inspect(path: Path) -> DxfInfo:
    doc, warnings = _load(path)
    msp = doc.modelspace()
    counts: dict[str, int] = {}
    unsupported: dict[str, int] = {}
    per_layer: dict[str, int] = {}
    minx = miny = math.inf
    maxx = maxy = -math.inf
    drawable = 0
    total = 0
    for e in msp:
        total += 1
        if total > MAX_ENTITIES:
            raise DxfError("dxf_too_large", f"more than {MAX_ENTITIES} entities")
        kind = e.dxftype()
        counts[kind] = counts.get(kind, 0) + 1
        layer = str(e.dxf.layer) if e.dxf.hasattr("layer") else "0"
        if kind in DRAWABLE:
            drawn = False
            for seg in _segments(e):
                drawn = True
                for x, y in seg:
                    minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
            if drawn:
                drawable += 1
                per_layer[layer] = per_layer.get(layer, 0) + 1
            else:
                unsupported[kind] = unsupported.get(kind, 0) + 1
        else:
            unsupported[kind] = unsupported.get(kind, 0) + 1
    layers = []
    for layer in doc.layers:
        name = layer.dxf.name
        layers.append({"name": name, "drawable": per_layer.get(name, 0), "off": bool(layer.is_off()), "frozen": bool(layer.is_frozen()), "color": int(layer.color) if layer.color is not None else None})
    for name, n in per_layer.items():
        if not any(l["name"] == name for l in layers):
            layers.append({"name": name, "drawable": n, "off": False, "frozen": False, "color": None})
    layers.sort(key=lambda l: (-l["drawable"], l["name"]))
    code = int(doc.header.get("$INSUNITS", 0) or 0)
    extent = None if drawable == 0 else {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy, "width": maxx - minx, "height": maxy - miny}
    if drawable and (maxx - minx <= 0 or maxy - miny <= 0):
        warnings.append("the drawing has no area (all geometry on one line)")
    return DxfInfo(version=str(doc.dxfversion), units_code=code, units=UNITS.get(code, f"code {code}"), layers=layers, entity_counts=counts, unsupported=unsupported, extent=extent, drawable=drawable, warnings=warnings)


@dataclass
class RenderResult:
    width: int
    height: int
    px_per_unit: float
    units: str
    meters_per_px: float | None
    extent: dict[str, float]
    rendered: int
    skipped: dict[str, int]
    layers: list[str]
    partial: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def render(path: Path, out_png: Path, max_px: int, layers: list[str] | None = None, units_override: str | None = None, line_px: int = 2, margin: float = 0.02) -> RenderResult:
    """Rasterize the chosen layers to a white PNG, y up in the drawing → y down in the image, preserving aspect.
    Everything counted as skipped is reported; a drawing with nothing drawable is refused (dxf_empty)."""
    info = inspect(path)
    doc, _warnings = _load(path)
    msp = doc.modelspace()
    chosen = set(layers) if layers else None
    polylines: list[list[tuple[float, float]]] = []
    skipped: dict[str, int] = dict(info.unsupported)
    layer_seen: set[str] = set()
    minx = miny = math.inf
    maxx = maxy = -math.inf
    for e in msp:
        kind = e.dxftype()
        if kind not in DRAWABLE:
            continue
        layer = str(e.dxf.layer) if e.dxf.hasattr("layer") else "0"
        if chosen is not None and layer not in chosen:
            continue
        drawn = False
        for seg in _segments(e):
            drawn = True
            polylines.append(seg)
            for x, y in seg:
                minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
        if drawn:
            layer_seen.add(layer)
    if not polylines:
        raise DxfError("dxf_empty", "nothing drawable on the chosen layers", {"layers": sorted(chosen) if chosen else None, "unsupported": skipped})
    w_units = max(maxx - minx, 1e-9)
    h_units = max(maxy - miny, 1e-9)
    pad = margin * max(w_units, h_units)
    minx, miny, maxx, maxy = minx - pad, miny - pad, maxx + pad, maxy + pad
    w_units, h_units = maxx - minx, maxy - miny
    scale = max_px / max(w_units, h_units)
    width = max(1, int(round(w_units * scale)))
    height = max(1, int(round(h_units * scale)))
    img = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    for seg in polylines:
        pts = [((x - minx) * scale, (maxy - y) * scale) for x, y in seg]
        if len(pts) >= 2:
            draw.line(pts, fill=(20, 24, 40), width=line_px, joint="curve")
    out_png.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_png, "PNG", optimize=True)
    units = units_override or info.units
    mpu = METERS.get(units)
    return RenderResult(width=width, height=height, px_per_unit=scale, units=units, meters_per_px=(mpu / scale) if mpu else None,
                        extent={"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy, "width": w_units, "height": h_units}, rendered=len(polylines), skipped=skipped,
                        layers=sorted(layer_seen), partial=bool(skipped))


def options_path(asset_dir: Path) -> Path:
    return asset_dir / "dxf.json"


def load_options(asset_dir: Path) -> dict[str, Any]:
    p = options_path(asset_dir)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def save_options(asset_dir: Path, data: dict[str, Any]) -> None:
    options_path(asset_dir).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
