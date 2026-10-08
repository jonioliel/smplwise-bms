"""DXF export of a Plan Studio structure (T088, ST5). The drawing is made from the same primitives as the SVG / PNG
exports and the map (plan_geometry_render.structure_primitives), so the three agree on what a wall, an opening or an
object is; the rooms are the floor's zones and the devices its live anchors (cameras and entities).

Format choices:
- DXF R2018 (AC1032), written by ezdxf. From R2007 on a DXF is UTF-8, so Hebrew is stored as text, not as \\U+ escapes.
- Units: a calibrated plan (measured, or an estimate carried from another version) is written in metres ($INSUNITS 6,
  $MEASUREMENT 1). Without a calibration the coordinates stay in plan pixels and the drawing is unitless ($INSUNITS 0):
  nothing is invented. The custom header variables SW_UNITS / SW_SCALE_STATUS say which.
- Axes: x to the right, y up (CAD convention); the plan's pixel y points down, so y is mirrored about the plan height.
  The origin is the plan's bottom-left corner.
- Curved walls (schema 2.1): each part is an LWPOLYLINE with per-vertex bulges (a true arc in CAD, not chords), the
  document's bulge negated by the y mirror; layers and XDATA are those of a straight wall.
- Layers (fixed names, fixed colours): SW_WALLS, SW_OPENINGS, SW_ROOMS, SW_DEVICES, SW_OBJECTS, SW_CONNECTORS,
  SW_LABELS, and SW_GLAZING (window walls, document 2.1) only on a plan that has a glass wall.
  Every entity carries the id of the item it was drawn from as XDATA of the application SMPLWISE, so a CAD
  user (or a later import) can tell the items apart.
- Text: MTEXT in the style SW_TEXT (Arial, which has Hebrew glyphs). Text is cleaned first: control characters and the
  bidi embedding / override marks are removed, MTEXT's own control characters (backslash, braces) are escaped and a
  line break becomes \\P. Text is stored in logical (Unicode) order; how a CAD program orders right-to-left runs is its
  own matter and was not verified in a commercial CAD product.

Levels (PLN2): a plan with ONE level keeps the fixed layer names above, unchanged. A plan with more than one level draws
each level into its own layer family - the fixed name plus "-" and the level's suffix (its id made layer-safe, e.g.
SW_WALLS-L0, SW_WALLS-L1; LV<n> when the id has nothing usable or two ids clash) - so a CAD user switches a level on or
off by its layers (a wildcard like *-L1 selects one level). The suffix rule depends only on the plan's level count,
never on ?level=, so the names are the same whether one level or all are exported. Each level layer's description
names the level, and the custom header variables SW_LEVEL_<suffix> carry "name | elevation m". Connectors join levels:
a connector is drawn on the connector layer of each of its two levels on this floor (once per level; the level id is
the third XDATA value of every entity of a level layer), a connector to another floor on its own level's layer. Rooms
of a level the plan does not have go with the default level. Devices (camera and entity anchors belong to the floor,
not to a level) stay on SW_DEVICES.

The plan picture (PLN2): a bare DXF carries none - a CAD user attaches the source file as an underlay. When the caller
passes `background` (the signed package does, beside the picture it ships), an IMAGE entity on the layer SW_BACKGROUND
references the picture by its bare file name (the drawing's own folder), stretched over the plan's extent and drawn
first so the structure sits on top. DXF cannot embed raster data: the picture stays a separate file."""
from __future__ import annotations

import io
import math
import re
from typing import Any, Callable

import ezdxf
from ezdxf import units

from . import plan_geometry_render as render
from .plan_geometry import DEFAULT_LEVEL_ID, effective_scale
from .plan_glass import GLASS_KIND

APP_ID = "SMPLWISE"
TEXT_STYLE = "SW_TEXT"
DXF_VERSION = "R2018"
# name -> (ACI colour, linetype, description)
LAYERS: dict[str, tuple[int, str, str]] = {
    "SW_WALLS": (8, "Continuous", "walls"),
    "SW_OPENINGS": (5, "Continuous", "doors, windows, passages"),
    "SW_ROOMS": (4, "Continuous", "rooms"),
    "SW_DEVICES": (1, "Continuous", "cameras and entities"),
    "SW_OBJECTS": (30, "Continuous", "objects"),
    "SW_CONNECTORS": (9, "Continuous", "stairs, ramps, elevators"),
    "SW_LABELS": (7, "Continuous", "labels"),
}
BACKGROUND_LAYER = ("SW_BACKGROUND", 7, "plan picture")
# Window walls (document 2.1, plan_glass): a layer family of their own - the frame band and the glass centre line of
# every part, a line per mullion and per panel (XDATA kind "glass_panel:<index>[:<operation>]"). Added only to a plan
# that has a glass wall, so every other drawing keeps exactly its layer table.
GLAZING_LAYER = ("SW_GLAZING", 4, "Continuous", "window walls: glass, mullions, panels")
# the families a level splits into (devices belong to the floor, not to a level)
LEVEL_FAMILIES = ("SW_WALLS", "SW_OPENINGS", "SW_ROOMS", "SW_OBJECTS", "SW_CONNECTORS", "SW_LABELS")
_LAYER_UNSAFE = re.compile(r"[^A-Za-z0-9_]+")
MAX_SUFFIX = 24
# the export's layer switch (?layers=) uses the SVG names; DXF has a layer per family
FAMILY_LAYERS = {"structure": ("SW_WALLS", "SW_OPENINGS", GLAZING_LAYER[0]), "objects": ("SW_OBJECTS",), "labels": ("SW_LABELS",), "connectors": ("SW_CONNECTORS",)}
DEVICE_RADIUS_M = 0.15
DEVICE_HEADING_M = 0.45
DEFAULT_TEXT_PX = 12.0
OBJECT_TEXT_PX = 11.0

_UNSAFE_TEXT = re.compile("[\x00-\x08\x0b-\x1f\x7f\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]")


def clean_text(value: Any, limit: int = 500) -> str:
    """Text safe to put in an MTEXT: no control characters or bidi overrides, MTEXT codes escaped, at most `limit` chars."""
    s = _UNSAFE_TEXT.sub("", str(value or "")).replace("\r\n", "\n").replace("\r", "\n")[:limit]
    return s.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", "\\P")


class _Frame:
    """Plan pixels -> drawing units (metres when calibrated, pixels otherwise), y mirrored."""

    def __init__(self, doc: dict[str, Any], height_px: float) -> None:
        scale, estimated = effective_scale(doc)
        cal = ((doc.get("dimensions") or {}).get("calibration") or {}).get("status")
        self.metric = cal in ("measured", "estimated")
        self.k = scale if self.metric else 1.0
        self.status = cal if self.metric else "missing"
        self.estimated = estimated
        self.h = float(height_px)
        # what one metre is in drawing units: real when metric, the editor's estimate in pixels otherwise
        self.metre = 1.0 if self.metric else 1.0 / scale

    def p(self, pt: Any) -> tuple[float, float]:
        return (round(float(pt[0]) * self.k, 6), round((self.h - float(pt[1])) * self.k, 6))

    def d(self, px: float) -> float:
        return round(float(px) * self.k, 6)


def _tag(e: Any, item_id: str, kind: str, level: str | None = None) -> None:
    e.set_xdata(APP_ID, [(1000, str(item_id)[:64]), (1000, kind), *([(1000, str(level)[:64])] if level is not None else [])])


def _angle(c: tuple[float, float], p: tuple[float, float]) -> float:
    return math.degrees(math.atan2(p[1] - c[1], p[0] - c[0])) % 360.0


def _text(msp: Any, text: str, at: tuple[float, float], height: float, layer: str, item_id: str, kind: str, level: str | None = None) -> None:
    body = clean_text(text)
    if not body:
        return
    m = msp.add_mtext(body, dxfattribs={"layer": layer, "style": TEXT_STYLE, "char_height": max(height, 1e-4), "insert": at,
                                        "attachment_point": 5})  # middle centre, like the SVG's text-anchor middle
    _tag(m, item_id, kind, level)


def _rooms(zones: list[dict[str, Any]], level: str | None) -> list[dict[str, Any]]:
    return [z for z in sorted(zones, key=lambda z: str(z.get("id")))
            if (level is None or (z.get("level_id") or DEFAULT_LEVEL_ID) == level) and isinstance(z.get("polygon"), list) and len(z["polygon"]) >= 3]


def _levels(doc: dict[str, Any]) -> list[dict[str, Any]]:
    """The document's levels in a stable order: by elevation, then id."""
    out = [lv for lv in doc.get("levels") or [] if isinstance(lv, dict) and isinstance(lv.get("id"), str) and lv["id"]]

    def elevation(lv: dict[str, Any]) -> float:
        el = lv.get("elevation_m")
        return float(el) if isinstance(el, (int, float)) and not isinstance(el, bool) else 0.0

    return sorted(out, key=lambda lv: (elevation(lv), lv["id"]))


def level_suffixes(doc: dict[str, Any]) -> dict[str, str]:
    """level id -> layer suffix (in elevation order), or {} when the plan has at most one level: the fixed layer names
    stay as they are. The suffix is the id upper-cased with every run of characters other than letters, digits and "_"
    turned into "_" (DXF layer names refuse < > / \\ " : ; ? * | = and the backtick), at most MAX_SUFFIX characters; an id
    with nothing usable, or one whose suffix an earlier level already took, gets LV<n> (n = its place in that order)."""
    levels = _levels(doc)
    if len(levels) <= 1:
        return {}
    out: dict[str, str] = {}
    used: set[str] = set()
    for n, lv in enumerate(levels):
        suffix = _LAYER_UNSAFE.sub("_", lv["id"]).strip("_").upper()[:MAX_SUFFIX]
        if not suffix or suffix in used:
            suffix = f"LV{n}"
            while suffix in used:
                suffix += "_"
        used.add(suffix)
        out[lv["id"]] = suffix
    return out


def layer_name(base: str, suffix: str | None) -> str:
    return f"{base}-{suffix}" if suffix else base


def build(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, level: str | None = None, layers: Any = None,
          anchors: list[dict[str, Any]] | None = None, anchor_positions: dict[str, Any] | None = None, items: dict[str, Any] | None = None,
          meta: dict[str, str] | None = None, background: dict[str, Any] | None = None) -> ezdxf.document.Drawing:
    """The drawing as an ezdxf document. `layers` is the SVG export's subset (structure / objects / labels /
    connectors; None = all); rooms and devices are always drawn. `anchors`: the floor's live anchors, each with
    resource_type, resource_id, x, y (0..1), rotation_degrees and a display `name`. `level`: only that level (None = all).
    `background`: {"file_name", "width_px", "height_px"} of the plan picture shipped beside the drawing (module
    docstring); None = no picture."""
    families = set(render.LAYERS) if layers is None else {str(x) for x in layers}
    shown = {"SW_ROOMS", "SW_DEVICES"} | {name for fam in families for name in FAMILY_LAYERS.get(fam, ())}
    frame = _Frame(doc, height)
    dxf = ezdxf.new(DXF_VERSION, setup=["linetypes"])
    dxf.units = units.M if frame.metric else units.InsertUnits.Unitless
    dxf.header["$MEASUREMENT"] = 1
    dxf.header["$LUNITS"] = 2
    dxf.appids.add(APP_ID)
    dxf.styles.add(TEXT_STYLE, font="arial.ttf")
    suffixes = level_suffixes(doc)
    by_id = {lv["id"]: lv for lv in _levels(doc)}
    layer_table = dict(LAYERS)
    if any(isinstance(w, dict) and w.get("kind") == GLASS_KIND for w in doc.get("walls") or []):
        layer_table[GLAZING_LAYER[0]] = GLAZING_LAYER[1:]
    for name, (color, linetype, desc) in layer_table.items():
        if suffixes and (name in LEVEL_FAMILIES or name == GLAZING_LAYER[0]):
            for lid, suffix in suffixes.items():
                lay = dxf.layers.add(layer_name(name, suffix), color=color, linetype=linetype)
                lay.description = clean_text(f"{desc} · {by_id[lid].get('name') or lid}", 200)
        else:
            lay = dxf.layers.add(name, color=color, linetype=linetype)
            lay.description = desc
    custom = {"SW_UNITS": "m" if frame.metric else "px", "SW_SCALE_STATUS": frame.status, "SW_PLAN_WIDTH": f"{frame.d(width):g}", "SW_PLAN_HEIGHT": f"{frame.d(height):g}"}
    for lid, suffix in suffixes.items():
        el = by_id[lid].get("elevation_m")
        custom[f"SW_LEVEL_{suffix}"] = f"{by_id[lid].get('name') or lid} | {float(el) if isinstance(el, (int, float)) else 0.0:g} m"
    for k, v in {**custom, **(meta or {})}.items():
        dxf.header.custom_vars.append(k, clean_text(v, 200))
    msp = dxf.modelspace()
    prepared = render._prepared(doc, anchor_positions)

    if background is not None:
        _background(dxf, msp, frame, background, width, height)

    if not suffixes:  # one level (or none): exactly the drawing of 2.2.0, fixed layer names
        if "SW_ROOMS" in shown:
            _draw_rooms(msp, frame, _rooms(zones, level), width, height, "SW_ROOMS", None)
        for p in render.structure_primitives(prepared, width, height, level, items):
            _draw(msp, frame, p, shown, lambda base: base, None)
    else:
        default = next((lv["id"] for lv in by_id.values() if lv.get("is_default") is True and lv["id"] in suffixes), next(iter(suffixes)))

        def room_level(z: dict[str, Any]) -> str:
            lid = z.get("level_id") or DEFAULT_LEVEL_ID
            return lid if lid in suffixes else default

        drawn = [lid for lid in suffixes if level is None or lid == level]
        connectors: dict[str, dict[str, Any]] = {}
        for lid in drawn:
            to: Callable[[str], str] = lambda base, s=suffixes[lid]: layer_name(base, s)  # noqa: E731
            if "SW_ROOMS" in shown:
                _draw_rooms(msp, frame, [z for z in _rooms(zones, None) if room_level(z) == lid], width, height, to("SW_ROOMS"), lid)
            for p in render.structure_primitives(prepared, width, height, lid, items):
                if p["kind"] == "connector":
                    connectors.setdefault(p["id"], p)  # never filtered by level: drawn per level below
                else:
                    _draw(msp, frame, p, shown, to, lid)
        # a connector to another floor: its level_to names a level THERE, not one of this plan's
        cross = {c.get("id") for c in doc.get("connectors") or [] if isinstance(c, dict) and c.get("floor_ids")}
        for cid in sorted(connectors):
            p = connectors[cid]
            ends = (p.get("level_from"),) if cid in cross else (p.get("level_from"), p.get("level_to"))
            touching = [x for x in ends if x in suffixes and x in drawn]
            if not touching:  # ?level= names another level: on its own level's layer, as the SVG draws every connector
                touching = [p.get("level_from") if p.get("level_from") in suffixes else default]
            for lid in dict.fromkeys(touching):
                _draw(msp, frame, p, shown, lambda base, s=suffixes[lid]: layer_name(base, s), lid)

    for a in sorted(anchors or [], key=lambda a: (str(a.get("resource_type")), str(a.get("resource_id")))):
        rid = f"{a.get('resource_type')}:{a.get('resource_id')}"
        c = frame.p((float(a["x"]) * width, float(a["y"]) * height))
        r = DEVICE_RADIUS_M * frame.metre
        _tag(msp.add_circle(c, round(r, 6), dxfattribs={"layer": "SW_DEVICES"}), rid, f"device:{a.get('resource_type')}")
        if a.get("resource_type") == "camera":
            # the camera's heading: a bearing (0 = up on the plan, clockwise), as map/coverage.ts draws it; up stays up here
            th = math.radians(float(a.get("rotation_degrees") or 0))
            tip = (round(c[0] + math.sin(th) * DEVICE_HEADING_M * frame.metre, 6), round(c[1] + math.cos(th) * DEVICE_HEADING_M * frame.metre, 6))
            _tag(msp.add_line(c, tip, dxfattribs={"layer": "SW_DEVICES"}), rid, "camera_heading")
        _text(msp, a.get("name") or a.get("resource_id") or "", (c[0], round(c[1] - 2.5 * r, 6)), frame.d(OBJECT_TEXT_PX), "SW_DEVICES", rid, "device_label")
    return dxf


_BARE_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")


def _background(dxf: Any, msp: Any, frame: _Frame, background: dict[str, Any], width: float, height: float) -> None:
    """The IMAGE entity of the plan picture: a bare file name only (no folder, nothing that climbs out), its real pixel
    size, stretched over the plan's extent from the origin (the plan's bottom-left corner)."""
    name = str(background.get("file_name") or "")
    try:
        bw, bh = int(background.get("width_px") or 0), int(background.get("height_px") or 0)
    except (TypeError, ValueError):
        return
    if not _BARE_NAME.match(name) or name.startswith(".") or bw <= 0 or bh <= 0:
        return
    layer, color, desc = BACKGROUND_LAYER
    dxf.layers.add(layer, color=color).description = desc
    image_def = dxf.add_image_def(filename=name, size_in_pixel=(bw, bh))
    img = msp.add_image(image_def, insert=(0.0, 0.0), size_in_units=(frame.d(width), frame.d(height)), dxfattribs={"layer": layer})
    _tag(img, "background", "background")


def _draw_rooms(msp: Any, frame: _Frame, zones: list[dict[str, Any]], width: float, height: float, layer: str, lv: str | None) -> None:
    for z in zones:
        pts = [frame.p((float(p["x"]) * width, float(p["y"]) * height)) for p in z["polygon"]]
        pl = msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": layer})
        _tag(pl, z["id"], "room", lv)
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        _text(msp, z.get("name") or "", (round(cx, 6), round(cy, 6)), frame.d(DEFAULT_TEXT_PX), layer, z["id"], "room_name", lv)


def _wall_polyline(msp: Any, frame: _Frame, p: dict[str, Any], attribs: dict[str, Any]) -> Any:
    """A wall part as an LWPOLYLINE: a curved part (`arc`) as its exact corners with bulges (true arcs in CAD; y is
    mirrored, so the turn flips), a straight one as its points."""
    arc = p.get("arc")
    if arc:
        pts = [(*frame.p(q), -float(b) + 0.0) for q, b in zip(arc["points"], [*arc["bulges"], 0.0])]
        return msp.add_lwpolyline(pts, format="xyb", dxfattribs=attribs)
    return msp.add_lwpolyline([frame.p(q) for q in p["points"]], dxfattribs=attribs)


def _draw(msp: Any, frame: _Frame, p: dict[str, Any], shown: set[str], to: Callable[[str], str], lv: str | None) -> None:
    """One primitive on its family's layer (`to` maps the fixed family name to the layer of this level)."""
    kind = p["kind"]
    if kind == "wall" and p.get("glass"):
        if GLAZING_LAYER[0] in shown:
            layer = to(GLAZING_LAYER[0])
            _tag(_wall_polyline(msp, frame, p, {"layer": layer, "const_width": frame.d(p["width"])}), p["id"], "glass_wall", lv)
            _tag(_wall_polyline(msp, frame, p, {"layer": layer}), p["id"], "glass_pane", lv)
    elif kind == "glazing" and GLAZING_LAYER[0] in shown:
        layer = to(GLAZING_LAYER[0])
        for a, b in p["mullions"]:
            _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": layer}), p["id"], "mullion", lv)
        for q in p["panels"]:
            attribs = {"layer": layer, **({"linetype": "DASHED"} if q["operation"] else {})}
            _tag(msp.add_line(frame.p(q["a"]), frame.p(q["b"]), dxfattribs=attribs), p["id"], f"glass_panel:{q['index']}" + (f":{q['operation']}" if q["operation"] else ""), lv)
    elif kind == "wall" and "SW_WALLS" in shown:
        pl = _wall_polyline(msp, frame, p, {"layer": to("SW_WALLS"), "const_width": frame.d(p["width"])})
        _tag(pl, p["id"], "wall", lv)
    elif kind in ("door", "window", "passage") and "SW_OPENINGS" in shown:
        layer = to("SW_OPENINGS")
        if kind == "door":
            for a, b in p["leaves"]:
                _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": layer}), p["id"], "door_leaf", lv)
            for (a, _b), arc in zip(p["leaves"], p["arcs"]):
                c, f, t = frame.p(a), frame.p(arc["from"]), frame.p(arc["to"])
                s, e = _angle(c, f), _angle(c, t)
                if (e - s) % 360.0 > 180.0:  # ARC runs counter-clockwise: draw the short way round
                    s, e = e, s
                _tag(msp.add_arc(c, frame.d(arc["r"]), s, e, dxfattribs={"layer": layer}), p["id"], "door_swing", lv)
        elif kind == "window":
            for a, b in p["lines"]:
                _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": layer}), p["id"], "window", lv)
        else:
            a, b = p["gap"]
            _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": layer, "linetype": "DASHED"}), p["id"], "passage", lv)
    elif kind == "label" and "SW_LABELS" in shown:
        _text(msp, p["text"], frame.p((p["x"], p["y"])), frame.d(p["size"]), to("SW_LABELS"), p["id"], "label", lv)
    elif kind == "connector" and "SW_CONNECTORS" in shown:
        layer = to("SW_CONNECTORS")
        pl = msp.add_lwpolyline([frame.p(q) for q in p["points"]], dxfattribs={"layer": layer, "const_width": frame.d(p["width"])})
        _tag(pl, p["id"], f"connector:{p['ckind']}", lv)
        _tag(msp.add_line(frame.p(p["arrow"]["from"]), frame.p(p["arrow"]["to"]), dxfattribs={"layer": layer}), p["id"], "connector_arrow", lv)
        if "SW_LABELS" in shown:
            _text(msp, p["label"], frame.p((p["lx"], p["ly"])), frame.d(DEFAULT_TEXT_PX), layer, p["id"], "connector_label", lv)
    elif kind == "object" and "SW_OBJECTS" in shown:
        layer = to("SW_OBJECTS")
        if p["shape"] == "cylinder":
            c = frame.p((p["cx"], p["cy"]))
            rx, ry = frame.d(p["w"] / 2), frame.d(p["h"] / 2)
            theta = -math.radians(p["rotation"])  # clockwise on screen = counter-clockwise turned upside down
            major = (rx * math.cos(theta), rx * math.sin(theta)) if rx >= ry else (-ry * math.sin(theta), ry * math.cos(theta))
            ratio = (min(rx, ry) / max(rx, ry)) if max(rx, ry) > 0 else 1.0
            el = msp.add_ellipse(c, major_axis=(round(major[0], 6), round(major[1], 6)), ratio=max(min(ratio, 1.0), 1e-6), dxfattribs={"layer": layer})
            _tag(el, p["id"], f"object:{p['item_id']}", lv)
        else:
            pl = msp.add_lwpolyline([frame.p(q) for q in p["corners"]], close=True, dxfattribs={"layer": layer})
            _tag(pl, p["id"], f"object:{p['item_id']}", lv)
        for a, b in p["steps"]:
            _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": layer}), p["id"], "object_step", lv)
        if p["label"] and "SW_LABELS" in shown:
            _text(msp, p["label"], frame.p((p["cx"], p["cy"] + p["h"] / 2 + 12)), frame.d(OBJECT_TEXT_PX), layer, p["id"], "object_label", lv)


def to_bytes(dxf: ezdxf.document.Drawing) -> bytes:
    buf = io.StringIO()
    dxf.write(buf)
    return buf.getvalue().encode("utf-8")


def render_dxf(*args: Any, **kwargs: Any) -> bytes:
    return to_bytes(build(*args, **kwargs))
