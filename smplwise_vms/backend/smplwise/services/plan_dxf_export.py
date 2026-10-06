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
- Layers (fixed names, fixed colours): SW_WALLS, SW_OPENINGS, SW_ROOMS, SW_DEVICES, SW_OBJECTS, SW_CONNECTORS,
  SW_LABELS. Every entity carries the id of the item it was drawn from as XDATA of the application SMPLWISE, so a CAD
  user (or a later import) can tell the items apart.
- Text: MTEXT in the style SW_TEXT (Arial, which has Hebrew glyphs). Text is cleaned first: control characters and the
  bidi embedding / override marks are removed, MTEXT's own control characters (backslash, braces) are escaped and a
  line break becomes \\P. Text is stored in logical (Unicode) order; how a CAD program orders right-to-left runs is its
  own matter and was not verified in a commercial CAD product.

The PNG keeps its role for pictures; the DXF carries no plan picture (a CAD user attaches the source file as an
underlay)."""
from __future__ import annotations

import io
import math
import re
from typing import Any

import ezdxf
from ezdxf import units

from . import plan_geometry_render as render
from .plan_geometry import DEFAULT_LEVEL_ID, effective_scale

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
# the export's layer switch (?layers=) uses the SVG names; DXF has a layer per family
FAMILY_LAYERS = {"structure": ("SW_WALLS", "SW_OPENINGS"), "objects": ("SW_OBJECTS",), "labels": ("SW_LABELS",), "connectors": ("SW_CONNECTORS",)}
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


def _tag(e: Any, item_id: str, kind: str) -> None:
    e.set_xdata(APP_ID, [(1000, str(item_id)[:64]), (1000, kind)])


def _angle(c: tuple[float, float], p: tuple[float, float]) -> float:
    return math.degrees(math.atan2(p[1] - c[1], p[0] - c[0])) % 360.0


def _text(msp: Any, text: str, at: tuple[float, float], height: float, layer: str, item_id: str, kind: str) -> None:
    body = clean_text(text)
    if not body:
        return
    m = msp.add_mtext(body, dxfattribs={"layer": layer, "style": TEXT_STYLE, "char_height": max(height, 1e-4), "insert": at,
                                        "attachment_point": 5})  # middle centre, like the SVG's text-anchor middle
    _tag(m, item_id, kind)


def _rooms(zones: list[dict[str, Any]], level: str | None) -> list[dict[str, Any]]:
    return [z for z in sorted(zones, key=lambda z: str(z.get("id")))
            if (level is None or (z.get("level_id") or DEFAULT_LEVEL_ID) == level) and isinstance(z.get("polygon"), list) and len(z["polygon"]) >= 3]


def build(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, level: str | None = None, layers: Any = None,
          anchors: list[dict[str, Any]] | None = None, anchor_positions: dict[str, Any] | None = None, items: dict[str, Any] | None = None,
          meta: dict[str, str] | None = None) -> ezdxf.document.Drawing:
    """The drawing as an ezdxf document. `layers` is the SVG export's subset (structure / objects / labels /
    connectors; None = all); rooms and devices are always drawn. `anchors`: the floor's live anchors, each with
    resource_type, resource_id, x, y (0..1), rotation_degrees and a display `name`."""
    families = set(render.LAYERS) if layers is None else {str(x) for x in layers}
    shown = {"SW_ROOMS", "SW_DEVICES"} | {name for fam in families for name in FAMILY_LAYERS.get(fam, ())}
    frame = _Frame(doc, height)
    dxf = ezdxf.new(DXF_VERSION, setup=["linetypes"])
    dxf.units = units.M if frame.metric else units.InsertUnits.Unitless
    dxf.header["$MEASUREMENT"] = 1
    dxf.header["$LUNITS"] = 2
    dxf.appids.add(APP_ID)
    dxf.styles.add(TEXT_STYLE, font="arial.ttf")
    for name, (color, linetype, desc) in LAYERS.items():
        lay = dxf.layers.add(name, color=color, linetype=linetype)
        lay.description = desc
    custom = {"SW_UNITS": "m" if frame.metric else "px", "SW_SCALE_STATUS": frame.status, "SW_PLAN_WIDTH": f"{frame.d(width):g}", "SW_PLAN_HEIGHT": f"{frame.d(height):g}"}
    for k, v in {**custom, **(meta or {})}.items():
        dxf.header.custom_vars.append(k, clean_text(v, 200))
    msp = dxf.modelspace()
    prepared = render._prepared(doc, anchor_positions)
    prims = render.structure_primitives(prepared, width, height, level, items)

    if "SW_ROOMS" in shown:
        for z in _rooms(zones, level):
            pts = [frame.p((float(p["x"]) * width, float(p["y"]) * height)) for p in z["polygon"]]
            pl = msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": "SW_ROOMS"})
            _tag(pl, z["id"], "room")
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            _text(msp, z.get("name") or "", (round(cx, 6), round(cy, 6)), frame.d(DEFAULT_TEXT_PX), "SW_ROOMS", z["id"], "room_name")

    for p in prims:
        kind = p["kind"]
        if kind == "wall" and "SW_WALLS" in shown:
            pl = msp.add_lwpolyline([frame.p(q) for q in p["points"]], dxfattribs={"layer": "SW_WALLS", "const_width": frame.d(p["width"])})
            _tag(pl, p["id"], "wall")
        elif kind in ("door", "window", "passage") and "SW_OPENINGS" in shown:
            if kind == "door":
                for a, b in p["leaves"]:
                    _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": "SW_OPENINGS"}), p["id"], "door_leaf")
                for (a, _b), arc in zip(p["leaves"], p["arcs"]):
                    c, f, t = frame.p(a), frame.p(arc["from"]), frame.p(arc["to"])
                    s, e = _angle(c, f), _angle(c, t)
                    if (e - s) % 360.0 > 180.0:  # ARC runs counter-clockwise: draw the short way round
                        s, e = e, s
                    _tag(msp.add_arc(c, frame.d(arc["r"]), s, e, dxfattribs={"layer": "SW_OPENINGS"}), p["id"], "door_swing")
            elif kind == "window":
                for a, b in p["lines"]:
                    _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": "SW_OPENINGS"}), p["id"], "window")
            else:
                a, b = p["gap"]
                _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": "SW_OPENINGS", "linetype": "DASHED"}), p["id"], "passage")
        elif kind == "label" and "SW_LABELS" in shown:
            _text(msp, p["text"], frame.p((p["x"], p["y"])), frame.d(p["size"]), "SW_LABELS", p["id"], "label")
        elif kind == "connector" and "SW_CONNECTORS" in shown:
            pl = msp.add_lwpolyline([frame.p(q) for q in p["points"]], dxfattribs={"layer": "SW_CONNECTORS", "const_width": frame.d(p["width"])})
            _tag(pl, p["id"], f"connector:{p['ckind']}")
            _tag(msp.add_line(frame.p(p["arrow"]["from"]), frame.p(p["arrow"]["to"]), dxfattribs={"layer": "SW_CONNECTORS"}), p["id"], "connector_arrow")
            if "SW_LABELS" in shown:
                _text(msp, p["label"], frame.p((p["lx"], p["ly"])), frame.d(DEFAULT_TEXT_PX), "SW_CONNECTORS", p["id"], "connector_label")
        elif kind == "object" and "SW_OBJECTS" in shown:
            if p["shape"] == "cylinder":
                c = frame.p((p["cx"], p["cy"]))
                rx, ry = frame.d(p["w"] / 2), frame.d(p["h"] / 2)
                theta = -math.radians(p["rotation"])  # clockwise on screen = counter-clockwise turned upside down
                major = (rx * math.cos(theta), rx * math.sin(theta)) if rx >= ry else (-ry * math.sin(theta), ry * math.cos(theta))
                ratio = (min(rx, ry) / max(rx, ry)) if max(rx, ry) > 0 else 1.0
                el = msp.add_ellipse(c, major_axis=(round(major[0], 6), round(major[1], 6)), ratio=max(min(ratio, 1.0), 1e-6), dxfattribs={"layer": "SW_OBJECTS"})
                _tag(el, p["id"], f"object:{p['item_id']}")
            else:
                pl = msp.add_lwpolyline([frame.p(q) for q in p["corners"]], close=True, dxfattribs={"layer": "SW_OBJECTS"})
                _tag(pl, p["id"], f"object:{p['item_id']}")
            for a, b in p["steps"]:
                _tag(msp.add_line(frame.p(a), frame.p(b), dxfattribs={"layer": "SW_OBJECTS"}), p["id"], "object_step")
            if p["label"] and "SW_LABELS" in shown:
                _text(msp, p["label"], frame.p((p["cx"], p["cy"] + p["h"] / 2 + 12)), frame.d(OBJECT_TEXT_PX), "SW_OBJECTS", p["id"], "object_label")

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


def to_bytes(dxf: ezdxf.document.Drawing) -> bytes:
    buf = io.StringIO()
    dxf.write(buf)
    return buf.getvalue().encode("utf-8")


def render_dxf(*args: Any, **kwargs: Any) -> bytes:
    return to_bytes(build(*args, **kwargs))
