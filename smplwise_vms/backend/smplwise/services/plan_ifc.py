"""Plan Studio 8 (T090, CR-037): the IFC4 export of a plan version's structure, written by an own STEP (ISO 10303-21)
writer - no dependency, deterministic text.

The model: IfcProject > IfcSite > IfcBuilding (the floor) > an IfcBuildingStorey per document level (placed at its
elevation) containing IfcWall (Axis = the centre polyline, Body = a box per segment), IfcOpeningElement voids with
IfcDoor / IfcWindow fillings (a passage is an unfilled opening), IfcSpace per room (the floor's zones), the objects as the
catalog item's IFC class (a box), connectors as IfcStair / IfcRamp / IfcTransportElement bands, and the anchors the
caller may see as IfcAudioVisualAppliance CAMERA / IfcBuildingElementProxy boxes. Every element carries Pset_SMPLWISE
with what a re-import needs (plan_ifc_read restores our own file exactly).

Units are metres (an uncalibrated plan is refused by the route). Axes: X = plan x, Y = plan up (= -plan y), Z up,
origin the plan's bottom-left corner - the DXF export's frame. GlobalId = the IFC encoding of
uuid5(NAMESPACE, "<floor id>:<collection>:<item id>"), or the item's external_ids.ifc_guid when it came from an IFC, so
a re-export keeps identity. CR-037 sections 1-3 and 7 record the choices."""
from __future__ import annotations

import json
import math
import re
import uuid
from typing import Any, Sequence

from . import plan_catalog, wall_path
from .plan_geometry import DEFAULT_CEILING_M, DEFAULT_LEVEL_ID, DEFAULT_WALL_THICKNESS_M, effective_scale
from .plan_glass import GLASS_KIND

VERSION = "1.0"
APP_NAME = "SmplWise Arx"
SCHEMA = "IFC4"
PSET = "Pset_SMPLWISE"
NAMESPACE = uuid.UUID("5a3b6b1e-7f9c-4d0a-9d2e-0c6b8a1f7e21")  # fixed: GlobalIds are stable across installations
_GUID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
_UNSAFE_TEXT = re.compile("[\x00-\x08\x0b-\x1f\x7f‎‏؜‪-‮⁦-⁩]")
WALL_TYPES = {"exterior": "SOLIDWALL", "interior": "SOLIDWALL", "partition": "PARTITIONING", "railing": "USERDEFINED", "low": "USERDEFINED", GLASS_KIND: "USERDEFINED"}
DOOR_OPERATIONS = {"left": "SINGLE_SWING_LEFT", "right": "SINGLE_SWING_RIGHT", "double": "DOUBLE_DOOR_SINGLE_SWING", "sliding": "SLIDING_TO_LEFT", "none": "NOTDEFINED"}
CONNECTOR_CLASSES = {"stairs": ("IFCSTAIR", "STRAIGHT_RUN_STAIR"), "ramp": ("IFCRAMP", "STRAIGHT_RUN_RAMP"), "elevator": ("IFCTRANSPORTELEMENT", "ELEVATOR"),
                     "tribune": ("IFCSTAIR", "USERDEFINED"), "ladder": ("IFCSTAIR", "USERDEFINED")}
CONNECTOR_HEIGHT_M = 1.0
ANCHOR_BOX_M = 0.3
CAMERA_Z_M = 2.4
ENTITY_Z_M = 1.2
OPENING_OVERCUT_M = 0.02
CURVE_TOL_PX = 0.25


# ---------------------------------------------------------------- GlobalId

def compress_guid(u: uuid.UUID) -> str:
    """The 22-character IFC GlobalId of a UUID (the buildingSMART base-64 variant)."""
    bs = u.bytes

    def b64(v: int, n: int) -> str:
        out = ""
        for _ in range(n):
            out = _GUID_CHARS[v & 63] + out
            v >>= 6
        return out

    return b64(bs[0], 2) + "".join(b64((bs[i] << 16) + (bs[i + 1] << 8) + bs[i + 2], 4) for i in range(1, 16, 3))


def expand_guid(s: str) -> uuid.UUID | None:
    """The UUID of a 22-character GlobalId; None when the text is not one."""
    if not isinstance(s, str) or len(s) != 22 or any(c not in _GUID_CHARS for c in s):
        return None
    vals = [_GUID_CHARS.index(c) for c in s]
    first = (vals[0] << 6) + vals[1]
    if first > 255:
        return None
    out = bytes([first])
    for i in range(2, 22, 4):
        v = (vals[i] << 18) + (vals[i + 1] << 12) + (vals[i + 2] << 6) + vals[i + 3]
        out += bytes([(v >> 16) & 255, (v >> 8) & 255, v & 255])
    return uuid.UUID(bytes=out)


def global_id(floor_id: str, collection: str, item: Any) -> str:
    ext = item.get("external_ids") if isinstance(item, dict) else None
    own = ext.get("ifc_guid") if isinstance(ext, dict) else None
    if isinstance(own, str) and expand_guid(own) is not None:
        return own
    key = item["id"] if isinstance(item, dict) else str(item)
    return compress_guid(uuid.uuid5(NAMESPACE, f"{floor_id}:{collection}:{key}"))


# ---------------------------------------------------------------- STEP encoding

class Ref:
    __slots__ = ("n",)

    def __init__(self, n: int) -> None:
        self.n = n

    def __str__(self) -> str:
        return f"#{self.n}"


class Enum:
    __slots__ = ("v",)

    def __init__(self, v: str) -> None:
        self.v = v


class Typed:
    """A typed value, IFCLABEL('x') / IFCREAL(1.)."""
    __slots__ = ("t", "v")

    def __init__(self, t: str, v: Any) -> None:
        self.t, self.v = t, v


STAR = Enum("*")


def clean_text(value: Any, limit: int = 255) -> str:
    return _UNSAFE_TEXT.sub("", str(value if value is not None else "")).replace("\r\n", "\n").replace("\r", "\n")[:limit]


def step_string(s: str) -> str:
    """A STEP string literal: '' for the apostrophe, \\\\ for the backslash, every non-ASCII run as \\X2\\…\\X0\\ (BMP) or
    \\X4\\…\\X0\\ (beyond)."""
    out: list[str] = ["'"]
    run: list[str] = []
    wide = False

    def flush() -> None:
        nonlocal run, wide
        if run:
            if wide:
                out.append("\\X4\\" + "".join(f"{ord(c):08X}" for c in run) + "\\X0\\")
            else:
                out.append("\\X2\\" + "".join(f"{ord(c):04X}" for c in run) + "\\X0\\")
            run = []
            wide = False

    for c in s:
        o = ord(c)
        if o < 128:
            flush()
            out.append("''" if c == "'" else "\\\\" if c == "\\" else c if o >= 32 or c == "\n" else "")
        else:
            w = o > 0xFFFF
            if run and w != wide:
                flush()
            wide = w
            run.append(c)
    flush()
    out.append("'")
    return "".join(out)


def fmt_real(v: float) -> str:
    """A STEP REAL: always with a decimal point, 6 decimals at most, never -0."""
    v = round(float(v), 6) + 0.0
    if not math.isfinite(v):
        raise ValueError("non-finite real")
    s = f"{v:.6f}".rstrip("0")
    return s if s[-1] != "." else s + "0"


def encode(v: Any) -> str:
    if v is None:
        return "$"
    if isinstance(v, Ref):
        return str(v)
    if isinstance(v, Enum):
        return "*" if v is STAR else f".{v.v}."
    if isinstance(v, Typed):
        return f"{v.t}({encode(v.v)})"
    if isinstance(v, bool):
        return ".T." if v else ".F."
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return fmt_real(v)
    if isinstance(v, str):
        return step_string(v)
    if isinstance(v, (list, tuple)):
        return "(" + ",".join(encode(x) for x in v) + ")"
    raise TypeError(type(v).__name__)


class Step:
    """The instances of the DATA section, numbered in creation order."""

    def __init__(self) -> None:
        self.lines: list[str] = []
        self.counts: dict[str, int] = {}

    def add(self, entity: str, *args: Any) -> Ref:
        n = len(self.lines) + 1
        self.lines.append(f"#{n}={entity}({','.join(encode(a) for a in args)});")
        self.counts[entity] = self.counts.get(entity, 0) + 1
        return Ref(n)

    def text(self, file_name: str, generated_at: str, description: str) -> str:
        head = ["ISO-10303-21;", "HEADER;",
                f"FILE_DESCRIPTION(({step_string(description)}),'2;1');",
                f"FILE_NAME({step_string(file_name)},{step_string(generated_at)},({step_string(APP_NAME)}),({step_string(APP_NAME)}),"
                f"{step_string(f'{APP_NAME} plan_ifc {VERSION}')},{step_string(APP_NAME)},'');",
                f"FILE_SCHEMA(('{SCHEMA}'));", "ENDSEC;", "DATA;"]
        return "\n".join(head + self.lines + ["ENDSEC;", "END-ISO-10303-21;", ""])


# ---------------------------------------------------------------- geometry helpers

Pt = tuple[float, float]


class _Frame:
    """Plan pixels -> metres, y mirrored (origin bottom-left)."""

    def __init__(self, doc: dict[str, Any], width_px: float, height_px: float) -> None:
        scale, estimated = effective_scale(doc)
        self.scale = float(scale)
        self.estimated = estimated
        self.w = float(width_px)
        self.h = float(height_px)

    def m(self, p: Sequence[float]) -> Pt:
        """A normalized point to metres."""
        return (round(float(p[0]) * self.w * self.scale, 6), round((self.h - float(p[1]) * self.h) * self.scale, 6))

    def px_to_m(self, p: Sequence[float]) -> Pt:
        return (round(float(p[0]) * self.scale, 6), round((self.h - float(p[1])) * self.scale, 6))

    def dir_m(self, d: Sequence[float]) -> Pt:
        """A pixel-space unit direction in the metres frame (y mirrored)."""
        x, y = float(d[0]), -float(d[1])
        n = math.hypot(x, y) or 1.0
        return (x / n, y / n)


def _num(v: Any, default: float) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v)) else default


def _band(a: Pt, b: Pt, half: float, extend: float = 0.0) -> list[Pt]:
    """The rectangle of a segment: `half` either side of a-b, the ends pushed out by `extend`."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    if n <= 1e-9:
        return []
    ux, uy = dx / n, dy / n
    a2 = (a[0] - ux * extend, a[1] - uy * extend)
    b2 = (b[0] + ux * extend, b[1] + uy * extend)
    nx, ny = -uy * half, ux * half
    return [(a2[0] + nx, a2[1] + ny), (b2[0] + nx, b2[1] + ny), (b2[0] - nx, b2[1] - ny), (a2[0] - nx, a2[1] - ny)]


class Writer:
    def __init__(self, floor_id: str) -> None:
        self.s = Step()
        self.floor_id = floor_id
        self.origin = self.s.add("IFCCARTESIANPOINT", [0.0, 0.0, 0.0])
        self.z = self.s.add("IFCDIRECTION", [0.0, 0.0, 1.0])
        self.x = self.s.add("IFCDIRECTION", [1.0, 0.0, 0.0])
        self.identity = self.s.add("IFCAXIS2PLACEMENT3D", self.origin, self.z, self.x)
        self.origin2 = self.s.add("IFCCARTESIANPOINT", [0.0, 0.0])
        self.identity2 = self.s.add("IFCAXIS2PLACEMENT2D", self.origin2, None)
        self.rels: dict[str, Ref] = {}

    # -- contexts and units
    def contexts(self) -> tuple[Ref, Ref]:
        s = self.s
        length = s.add("IFCSIUNIT", STAR, Enum("LENGTHUNIT"), None, Enum("METRE"))
        area = s.add("IFCSIUNIT", STAR, Enum("AREAUNIT"), None, Enum("SQUARE_METRE"))
        volume = s.add("IFCSIUNIT", STAR, Enum("VOLUMEUNIT"), None, Enum("CUBIC_METRE"))
        angle = s.add("IFCSIUNIT", STAR, Enum("PLANEANGLEUNIT"), None, Enum("RADIAN"))
        units = s.add("IFCUNITASSIGNMENT", [length, area, volume, angle])
        ctx = s.add("IFCGEOMETRICREPRESENTATIONCONTEXT", None, "Model", 3, 1e-5, self.identity, None)
        self.body = s.add("IFCGEOMETRICREPRESENTATIONSUBCONTEXT", "Body", "Model", STAR, STAR, STAR, STAR, ctx, None, Enum("MODEL_VIEW"), None)
        self.axis = s.add("IFCGEOMETRICREPRESENTATIONSUBCONTEXT", "Axis", "Model", STAR, STAR, STAR, STAR, ctx, None, Enum("GRAPH_VIEW"), None)
        self.foot = s.add("IFCGEOMETRICREPRESENTATIONSUBCONTEXT", "FootPrint", "Model", STAR, STAR, STAR, STAR, ctx, None, Enum("PLAN_VIEW"), None)
        return ctx, units

    # -- placements and shapes
    def placement(self, parent: Ref | None, at: tuple[float, float, float] = (0.0, 0.0, 0.0), direction: Pt | None = None) -> Ref:
        if at == (0.0, 0.0, 0.0) and direction is None:
            return self.s.add("IFCLOCALPLACEMENT", parent, self.identity)
        loc = self.s.add("IFCCARTESIANPOINT", [at[0], at[1], at[2]])
        ref = self.s.add("IFCDIRECTION", [direction[0], direction[1], 0.0]) if direction is not None else self.x
        return self.s.add("IFCLOCALPLACEMENT", parent, self.s.add("IFCAXIS2PLACEMENT3D", loc, self.z, ref))

    def polyline2(self, pts: Sequence[Pt], closed: bool = False) -> Ref:
        refs = [self.s.add("IFCCARTESIANPOINT", [p[0], p[1]]) for p in pts]
        if closed:
            refs.append(refs[0])
        return self.s.add("IFCPOLYLINE", refs)

    def extruded_polygon(self, pts: Sequence[Pt], z0: float, depth: float) -> Ref:
        prof = self.s.add("IFCARBITRARYCLOSEDPROFILEDEF", Enum("AREA"), None, self.polyline2(pts, closed=True))
        at = self.identity if z0 == 0.0 else self.s.add("IFCAXIS2PLACEMENT3D", self.s.add("IFCCARTESIANPOINT", [0.0, 0.0, z0]), self.z, self.x)
        return self.s.add("IFCEXTRUDEDAREASOLID", prof, at, self.z, max(depth, 0.01))

    def extruded_box(self, w: float, d: float, z0: float, depth: float) -> Ref:
        prof = self.s.add("IFCRECTANGLEPROFILEDEF", Enum("AREA"), None, self.identity2, max(w, 0.01), max(d, 0.01))
        at = self.identity if z0 == 0.0 else self.s.add("IFCAXIS2PLACEMENT3D", self.s.add("IFCCARTESIANPOINT", [0.0, 0.0, z0]), self.z, self.x)
        return self.s.add("IFCEXTRUDEDAREASOLID", prof, at, self.z, max(depth, 0.01))

    def shape(self, bodies: Sequence[Ref], axis: Ref | None = None) -> Ref:
        reps = []
        if axis is not None:
            reps.append(self.s.add("IFCSHAPEREPRESENTATION", self.axis, "Axis", "Curve2D", [axis]))
        reps.append(self.s.add("IFCSHAPEREPRESENTATION", self.body, "Body", "SweptSolid", list(bodies)))
        return self.s.add("IFCPRODUCTDEFINITIONSHAPE", None, None, reps)

    # -- property set
    def pset(self, elem: Ref, guid_key: str, props: dict[str, Any]) -> None:
        vals = []
        for k in sorted(props):
            v = props[k]
            if v is None or v == "":
                continue
            if isinstance(v, bool):
                vals.append(self.s.add("IFCPROPERTYSINGLEVALUE", k, None, Typed("IFCBOOLEAN", v), None))
            elif isinstance(v, (int, float)):
                vals.append(self.s.add("IFCPROPERTYSINGLEVALUE", k, None, Typed("IFCREAL", float(v)), None))
            else:
                vals.append(self.s.add("IFCPROPERTYSINGLEVALUE", k, None, Typed("IFCLABEL", clean_text(v, 1000)), None))
        if not vals:
            return
        ps = self.s.add("IFCPROPERTYSET", global_id(self.floor_id, "pset", guid_key), None, PSET, None, vals)
        self.s.add("IFCRELDEFINESBYPROPERTIES", global_id(self.floor_id, "relpset", guid_key), None, None, None, [elem], ps)


def _levels(doc: dict[str, Any]) -> list[dict[str, Any]]:
    out = [lv for lv in doc.get("levels") or [] if isinstance(lv, dict) and isinstance(lv.get("id"), str) and lv["id"]]
    if not out:
        out = [{"id": DEFAULT_LEVEL_ID, "name": DEFAULT_LEVEL_ID, "elevation_m": 0.0, "ceiling_height_m": DEFAULT_CEILING_M, "is_default": True}]
    return sorted(out, key=lambda lv: (_num(lv.get("elevation_m"), 0.0), lv["id"]))


def build(doc: dict[str, Any], zones: list[dict[str, Any]], width_px: int, height_px: int, *, floor_id: str, floor_name: str, version_id: str,
          stage: str, level: str | None = None, anchors: list[dict[str, Any]] | None = None, items: dict[str, Any] | None = None,
          generated_at: str = "1970-01-01T00:00:00Z", doc_hash: str | None = None) -> tuple[bytes, dict[str, int]]:
    """The IFC4 text of `doc` (one level or all) and the counts per collection written."""
    items = plan_catalog.builtin()["items"] if items is None else items
    frame = _Frame(doc, width_px, height_px)
    w = Writer(floor_id)
    ctx, units = w.contexts()
    counts = {"levels": 0, "walls": 0, "openings": 0, "rooms": 0, "objects": 0, "connectors": 0, "anchors": 0}
    project = w.s.add("IFCPROJECT", global_id(floor_id, "project", version_id), None, clean_text(floor_name or version_id) or version_id, None, None, None, None, [ctx], units)
    cal = ((doc.get("dimensions") or {}).get("calibration") or {}).get("status") or "missing"
    w.pset(project, f"project:{version_id}", {"PlanVersionId": version_id, "FloorId": floor_id, "Stage": stage, "ScaleStatus": cal, "DocHash": doc_hash,
                                                "NorthDeg": _num(doc.get("north_deg"), 0.0), "Generator": f"{APP_NAME} plan_ifc {VERSION}",
                                                "SchemaVersion": str(doc.get("schema_version") or "")})
    site_pl = w.placement(None)
    site = w.s.add("IFCSITE", global_id(floor_id, "site", version_id), None, "Site", None, None, site_pl, None, None, Enum("ELEMENT"), None, None, None, None, None)
    bld_pl = w.placement(site_pl)
    building = w.s.add("IFCBUILDING", global_id(floor_id, "building", floor_id), None, clean_text(floor_name) or "Building", None, None, bld_pl, None, None, Enum("ELEMENT"), None, None, None)
    w.s.add("IFCRELAGGREGATES", global_id(floor_id, "agg", "project"), None, None, None, project, [site])
    w.s.add("IFCRELAGGREGATES", global_id(floor_id, "agg", "site"), None, None, None, site, [building])

    levels = _levels(doc)
    by_level: dict[str, dict[str, Any]] = {}
    storeys: list[Ref] = []
    for lv in levels:
        if level is not None and lv["id"] != level:
            continue
        el = _num(lv.get("elevation_m"), 0.0)
        pl = w.placement(bld_pl, (0.0, 0.0, el)) if el else w.placement(bld_pl)
        st = w.s.add("IFCBUILDINGSTOREY", global_id(floor_id, "levels", lv), None, clean_text(lv.get("name")) or lv["id"], None, None, pl, None, None, Enum("ELEMENT"), el)
        w.pset(st, f"levels:{lv['id']}", {"ItemId": lv["id"], "Collection": "levels", "CeilingHeight": _num(lv.get("ceiling_height_m"), DEFAULT_CEILING_M), "IsDefault": bool(lv.get("is_default"))})
        by_level[lv["id"]] = {"ref": st, "pl": pl, "ceiling": _num(lv.get("ceiling_height_m"), DEFAULT_CEILING_M), "elements": [], "spaces": []}
        storeys.append(st)
        counts["levels"] += 1
    if storeys:
        w.s.add("IFCRELAGGREGATES", global_id(floor_id, "agg", "building"), None, None, None, building, storeys)
    default_level = next((lv["id"] for lv in levels if lv.get("is_default") is True), levels[0]["id"])

    def level_of(item: dict[str, Any]) -> dict[str, Any] | None:
        lid = item.get("level_id") or DEFAULT_LEVEL_ID
        if lid not in by_level:
            lid = default_level
        return by_level.get(lid)

    # -- walls, with their openings
    wall_refs: dict[str, tuple[Ref, Ref, list[Pt], list[float], list[float], float, dict[str, Any]]] = {}
    for wall in sorted((x for x in doc.get("walls") or [] if isinstance(x, dict) and isinstance(x.get("id"), str)), key=lambda x: x["id"]):
        lv = level_of(wall)
        if lv is None:
            continue
        pts_px, bulges = wall_path.wall_px(wall, frame.w, frame.h)
        if len(pts_px) < 2:
            continue
        thick = _num(wall.get("thickness_m"), DEFAULT_WALL_THICKNESS_M)
        explicit = wall.get("height_m")
        height = _num(explicit, lv["ceiling"])
        base = _num(wall.get("base_z_m"), 0.0)
        chords = wall_path.sample(pts_px, bulges, CURVE_TOL_PX) if wall_path.is_curved(wall) else pts_px
        chords_m = [frame.px_to_m(p) for p in chords]
        bodies = []
        for a, b in zip(chords_m, chords_m[1:]):
            rect = _band(a, b, thick / 2, thick / 2)
            if rect:
                bodies.append(w.extruded_polygon(rect, base, height))
        if not bodies:
            continue
        axis = w.polyline2([frame.px_to_m(p) for p in pts_px])
        pl = w.placement(lv["pl"])
        kind = str(wall.get("kind") or "interior")
        ref = w.s.add("IFCWALL", global_id(floor_id, "walls", wall), None, clean_text(wall.get("label") or wall["id"]), None, kind if WALL_TYPES.get(kind) == "USERDEFINED" else None,
                      pl, w.shape(bodies, axis), None, Enum(WALL_TYPES.get(kind, "SOLIDWALL")))
        cum = wall_path.cumulative(pts_px, bulges)
        wall_refs[wall["id"]] = (ref, pl, pts_px, bulges, cum, thick, lv)
        w.pset(ref, f"walls:{wall['id']}", {"ItemId": wall["id"], "Collection": "walls", "Kind": kind, "LevelId": wall.get("level_id") or DEFAULT_LEVEL_ID, "Thickness": thick,
                                            "Height": height if _num(explicit, -1.0) > 0 else None, "BaseZ": base, "Bulges": json.dumps([round(b, 6) for b in bulges]) if wall_path.is_curved(wall) else None,
                                            "Tags": ", ".join(str(t) for t in wall.get("tags") or []) or None, "Locked": bool(wall.get("locked"))})
        lv["elements"].append(ref)
        counts["walls"] += 1

    for op in sorted((x for x in doc.get("openings") or [] if isinstance(x, dict) and isinstance(x.get("id"), str)), key=lambda x: x["id"]):
        host = wall_refs.get(op.get("wall_id"))
        if host is None:
            continue
        wref, wpl, pts_px, bulges, cum, thick, lv = host
        total = cum[-1]
        if total <= 1e-9:
            continue
        t = min(1.0, max(0.0, _num(op.get("t"), 0.0)))
        c_px, d_px = wall_path.point_at(pts_px, bulges, t * total, cum)
        centre = frame.px_to_m(c_px)
        direction = frame.dir_m(d_px)
        kind = str(op.get("kind") or "door")
        width = _num(op.get("width_m"), 0.9)
        height = _num(op.get("height_m"), 2.1 if kind != "window" else 1.2)
        sill = _num(op.get("sill_m"), 0.0 if kind != "window" else 0.9)
        opl = w.placement(wpl, (centre[0], centre[1], sill), direction)
        void = w.s.add("IFCOPENINGELEMENT", global_id(floor_id, "openings", op), None, clean_text(op["id"]), None, None, opl,
                       w.shape([w.extruded_box(width, thick + OPENING_OVERCUT_M, 0.0, height)]), None, Enum("OPENING"))
        w.s.add("IFCRELVOIDSELEMENT", global_id(floor_id, "voids", op["id"]), None, None, None, wref, void)
        props = {"ItemId": op["id"], "Collection": "openings", "Kind": kind, "WallId": op.get("wall_id"), "T": t, "Width": width, "Height": height, "Sill": sill,
                 "Swing": str(op.get("swing") or "none"), "Hinge": str(op.get("hinge") or "start")}
        ar = op.get("anchor_ref")
        if isinstance(ar, dict):
            props["ResourceType"], props["ResourceId"] = str(ar.get("resource_type") or ""), str(ar.get("resource_id") or "")
        if kind in ("door", "window"):
            fpl = w.placement(opl)
            body = w.shape([w.extruded_box(width, thick, 0.0, height)])
            if kind == "door":
                fill = w.s.add("IFCDOOR", global_id(floor_id, "fills", op["id"]), None, clean_text(op.get("label") or op["id"]), None, None, fpl, body, None, height, width,
                               Enum("DOOR"), Enum(DOOR_OPERATIONS.get(str(op.get("swing")), "NOTDEFINED")), None)
            else:
                fill = w.s.add("IFCWINDOW", global_id(floor_id, "fills", op["id"]), None, clean_text(op.get("label") or op["id"]), None, None, fpl, body, None, height, width,
                               Enum("WINDOW"), Enum("SINGLE_PANEL"), None)
            w.s.add("IFCRELFILLSELEMENT", global_id(floor_id, "fillrel", op["id"]), None, None, None, void, fill)
            w.pset(fill, f"openings:{op['id']}", props)
            lv["elements"].append(fill)
        else:
            w.pset(void, f"openings:{op['id']}", props)
        counts["openings"] += 1

    # -- rooms (the floor's zones) as spaces
    rooms = {r["id"]: r for r in doc.get("rooms") or [] if isinstance(r, dict) and isinstance(r.get("id"), str)}
    for z in sorted((z for z in zones if isinstance(z, dict) and isinstance(z.get("polygon"), list) and len(z["polygon"]) >= 3), key=lambda z: str(z.get("id"))):
        room = rooms.get(str(z.get("id"))) or {}
        lv = level_of({"level_id": room.get("level_id") or z.get("level_id")})
        if lv is None:
            continue
        try:
            poly = [frame.m((p["x"], p["y"])) if isinstance(p, dict) else frame.m(p) for p in z["polygon"]]
        except (KeyError, TypeError, ValueError, IndexError):
            continue
        ceiling = _num(room.get("ceiling_height_m"), lv["ceiling"])
        pl = w.placement(lv["pl"])
        name = clean_text(z.get("name")) or str(z.get("id"))
        sp = w.s.add("IFCSPACE", global_id(floor_id, "rooms", {"id": str(z.get("id")), "external_ids": room.get("external_ids")}), None, name, None, None, pl,
                     w.shape([w.extruded_polygon(poly, 0.0, ceiling)]), name, Enum("ELEMENT"), Enum("INTERNAL"), None)
        w.pset(sp, f"rooms:{z.get('id')}", {"ItemId": str(z.get("id")), "Collection": "rooms", "Kind": str(z.get("kind") or ""), "CeilingHeight": ceiling,
                                             "Tags": ", ".join(str(t) for t in z.get("tags") or []) or None})
        lv["spaces"].append(sp)
        counts["rooms"] += 1

    # -- objects as their catalog class
    circuits = {m: str(c.get("switch_entity_id") or "") for c in doc.get("circuits") or [] if isinstance(c, dict) for m in c.get("member_ids") or []}
    for ob in sorted((x for x in doc.get("objects") or [] if isinstance(x, dict) and isinstance(x.get("id"), str)), key=lambda x: x["id"]):
        lv = level_of(ob)
        if lv is None or not isinstance(ob.get("position"), (list, tuple)) or len(ob["position"]) != 2:
            continue
        item = items.get(str(ob.get("item_id"))) or {}
        ifc = item.get("ifc") if isinstance(item.get("ifc"), dict) else plan_catalog.DEFAULT_IFC
        cls = str(ifc.get("class") or plan_catalog.DEFAULT_IFC["class"]).upper()
        ptype = str(ifc.get("predefined_type") or "USERDEFINED").upper()
        size = ob.get("size") if isinstance(ob.get("size"), dict) else {}
        sw, sd, sh = _num(size.get("w_m"), 0.5), _num(size.get("d_m"), 0.5), _num(size.get("h_m"), 0.5)
        centre = frame.m(ob["position"])
        theta = -math.radians(_num(ob.get("rotation_deg"), 0.0))
        pl = w.placement(lv["pl"], (centre[0], centre[1], _num(ob.get("z_m"), 0.0)), (math.cos(theta), math.sin(theta)))
        names = item.get("names") if isinstance(item.get("names"), dict) else {}
        name = clean_text(ob.get("label") or names.get("he") or names.get("en") or ob.get("item_id") or ob["id"])
        ref = w.s.add(cls, global_id(floor_id, "objects", ob), None, name, None, clean_text(names.get("en") or ob.get("item_id")), pl, w.shape([w.extruded_box(sw, sd, 0.0, sh)]), None, Enum(ptype))
        props = {"ItemId": ob["id"], "Collection": "objects", "CatalogItem": str(ob.get("item_id") or ""), "LevelId": ob.get("level_id") or DEFAULT_LEVEL_ID, "Width": sw, "Depth": sd,
                 "Height": sh, "Z": _num(ob.get("z_m"), 0.0), "Rotation": _num(ob.get("rotation_deg"), 0.0), "GroupId": ob.get("group_id"), "CircuitSwitch": circuits.get(ob["id"]),
                 "Tags": ", ".join(str(t) for t in ob.get("tags") or []) or None, "Locked": bool(ob.get("locked"))}
        ar = ob.get("anchor_ref")
        if isinstance(ar, dict):
            props["ResourceType"], props["ResourceId"] = str(ar.get("resource_type") or ""), str(ar.get("resource_id") or "")
        w.pset(ref, f"objects:{ob['id']}", props)
        lv["elements"].append(ref)
        counts["objects"] += 1

    # -- connectors as bands
    for c in sorted((x for x in doc.get("connectors") or [] if isinstance(x, dict) and isinstance(x.get("id"), str)), key=lambda x: x["id"]):
        lv = by_level.get(str(c.get("level_from") or ""))
        if lv is None or not isinstance(c.get("polyline"), list) or len(c["polyline"]) < 2:
            continue
        cls, ptype = CONNECTOR_CLASSES.get(str(c.get("kind")), ("IFCSTAIR", "USERDEFINED"))
        width = _num(c.get("width_m"), 1.0)
        try:
            pts = [frame.m(p) for p in c["polyline"]]
        except (TypeError, ValueError, IndexError):
            continue
        bodies = [w.extruded_polygon(rect, 0.0, CONNECTOR_HEIGHT_M) for a, b in zip(pts, pts[1:]) for rect in [_band(a, b, width / 2)] if rect]
        if not bodies:
            continue
        pl = w.placement(lv["pl"])
        ref = w.s.add(cls, global_id(floor_id, "connectors", c), None, clean_text(c.get("label") or c["id"]), None, str(c.get("kind") or ""), pl, w.shape(bodies, w.polyline2(pts)), None, Enum(ptype))
        w.pset(ref, f"connectors:{c['id']}", {"ItemId": c["id"], "Collection": "connectors", "Kind": str(c.get("kind") or ""), "LevelFrom": c.get("level_from"), "LevelTo": c.get("level_to"),
                                              "Width": width})
        lv["elements"].append(ref)
        counts["connectors"] += 1

    # -- anchors (the caller's visible ones only) as proxies on the default level
    lv0 = by_level.get(default_level) or (next(iter(by_level.values())) if by_level else None)
    if lv0 is not None:
        for a in sorted(anchors or [], key=lambda a: (str(a.get("resource_type")), str(a.get("resource_id")))):
            try:
                centre = frame.m((float(a["x"]), float(a["y"])))
            except (KeyError, TypeError, ValueError):
                continue
            rtype, rid = str(a.get("resource_type") or ""), str(a.get("resource_id") or "")
            camera = rtype == "camera"
            bearing = _num(a.get("rotation_degrees"), 0.0)
            theta = math.radians(90.0 - bearing)  # bearing: 0 = plan up, clockwise; IFC angle from +X counter-clockwise
            pl = w.placement(lv0["pl"], (centre[0], centre[1], CAMERA_Z_M if camera else ENTITY_Z_M), (math.cos(theta), math.sin(theta)))
            name = clean_text(a.get("name") or rid) or rid
            body = w.shape([w.extruded_box(ANCHOR_BOX_M, ANCHOR_BOX_M, 0.0, ANCHOR_BOX_M)])
            key = f"{rtype}:{rid}"
            if camera:
                ref = w.s.add("IFCAUDIOVISUALAPPLIANCE", global_id(floor_id, "anchors", key), None, name, None, "camera", pl, body, None, Enum("CAMERA"))
            else:
                ref = w.s.add("IFCBUILDINGELEMENTPROXY", global_id(floor_id, "anchors", key), None, name, None, "entity", pl, body, None, Enum("USERDEFINED"))
            w.pset(ref, f"anchors:{key}", {"Collection": "anchors", "ResourceType": rtype, "ResourceId": rid, "EntityId": rid if not camera else None, "Heading": bearing})
            lv0["elements"].append(ref)
            counts["anchors"] += 1

    for lid, lv in by_level.items():
        if lv["elements"]:
            w.s.add("IFCRELCONTAINEDINSPATIALSTRUCTURE", global_id(floor_id, "contains", lid), None, None, None, lv["elements"], lv["ref"])
        if lv["spaces"]:
            w.s.add("IFCRELAGGREGATES", global_id(floor_id, "agg", f"spaces:{lid}"), None, None, None, lv["ref"], lv["spaces"])

    text = w.s.text(f"plan-{version_id}.ifc", generated_at, f"ViewDefinition [ReferenceView_V1.2]; {APP_NAME} plan {version_id} {stage}")
    return text.encode("utf-8"), counts
