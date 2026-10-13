"""Plan Studio 8 (T090, CR-037): a bounded, dependency-free IFC (ISO 10303-21) reader that turns the walls, openings,
spaces and furniture of ONE building storey into structure candidates - the shape /detect and /import-dxf-geometry
answer (walls, openings, objects; rooms as zone candidates) - plus an import report that names everything skipped and
why (R130: a partial import is never silent).

Untrusted input (CR-037 section 4): the text is bounded (bytes, instances, instance length, nesting depth, aggregate
size, string length), parsed lazily by instance, with a deadline checked while scanning and mapping; placement and
mapping chains are depth-limited with cycle detection; non-finite or absurd numbers skip the element; no external
reference is ever followed (there is nothing to follow in p21 - IfcExternalReference and friends are ignored).

Geometry understood: IfcLocalPlacement chains (IfcAxis2Placement3D / 2D), IfcExtrudedAreaSolid with
IfcRectangleProfileDef / IfcArbitraryClosedProfileDef (IfcPolyline, IfcIndexedPolyCurve without arcs), IfcMappedItem,
IfcBooleanClippingResult (first operand), IfcFacetedBrep (vertex footprint), the wall Axis representation,
IfcMaterialLayerSetUsage, Pset_WallCommon.IsExternal and our own Pset_SMPLWISE (plan_ifc) for an exact round trip."""
from __future__ import annotations

import json
import math
import re
import time
from typing import Any, Sequence

from .plan_geometry import DEFAULT_WALL_THICKNESS_M, WALL_KINDS
from .plan_ifc import PSET, clean_text, expand_guid

VERSION = "1.0"
MAX_BYTES = 32 * 1024 * 1024
MAX_INSTANCES = 400_000
MAX_INSTANCE_CHARS = 64 * 1024
MAX_DEPTH = 32
MAX_AGGREGATE = 50_000
MAX_STRING = 4_000
MAX_CHAIN = 64
MAX_SKIPPED_ROWS = 200
MAX_ABS_M = 1e7
MIN_HEIGHT_M = 0.01
DEADLINE_EVERY = 2_000
LIMITS = {"walls": 2000, "openings": 4000, "objects": 5000, "rooms": 500}
GENERIC_ID = "object.generic"  # plan_dxf_map.GENERIC_ID, without importing ezdxf here
CLASS_ALIASES = {"IFCFURNISHINGELEMENT": "IFCFURNITURE", "IFCSYSTEMFURNITUREELEMENT": "IFCFURNITURE"}  # IFC2X3 names of catalog classes
SCHEMAS = ("IFC4", "IFC4X1", "IFC4X2", "IFC4X3", "IFC4X3_ADD1", "IFC4X3_ADD2", "IFC2X3")
WALL_CLASSES = ("IFCWALL", "IFCWALLSTANDARDCASE", "IFCWALLELEMENTEDCASE", "IFCCURTAINWALL")
OBJECT_CLASSES = ("IFCFURNITURE", "IFCFURNISHINGELEMENT", "IFCLIGHTFIXTURE", "IFCSANITARYTERMINAL", "IFCELECTRICAPPLIANCE", "IFCMEDICALDEVICE",
                  "IFCFIRESUPPRESSIONTERMINAL", "IFCALARM", "IFCCOLUMN", "IFCBUILDINGELEMENTPROXY", "IFCCOMMUNICATIONSAPPLIANCE", "IFCAUDIOVISUALAPPLIANCE",
                  "IFCSIGN", "IFCSWITCHINGDEVICE", "IFCTRANSFORMER", "IFCGEOGRAPHICELEMENT", "IFCFLOWTERMINAL", "IFCDISTRIBUTIONELEMENT",
                  "IFCDISTRIBUTIONCONTROLELEMENT", "IFCENERGYCONVERSIONDEVICE", "IFCSYSTEMFURNITUREELEMENT")
CONNECTOR_CLASSES = ("IFCSTAIR", "IFCSTAIRFLIGHT", "IFCRAMP", "IFCRAMPFLIGHT", "IFCTRANSPORTELEMENT")
IGNORED_CLASSES = ("IFCSLAB", "IFCROOF", "IFCBEAM", "IFCCOVERING", "IFCRAILING", "IFCPLATE", "IFCMEMBER", "IFCFOOTING", "IFCPILE", "IFCANNOTATION",
                   "IFCGRID", "IFCFLOWSEGMENT", "IFCFLOWFITTING", "IFCFLOWCONTROLLER", "IFCFLOWMOVINGDEVICE", "IFCFLOWSTORAGEDEVICE", "IFCFLOWTREATMENTDEVICE",
                   "IFCCHIMNEY", "IFCSHADINGDEVICE", "IFCCIVILELEMENT", "IFCELEMENTASSEMBLY", "IFCDISCRETEACCESSORY", "IFCFASTENER", "IFCMECHANICALFASTENER",
                   "IFCREINFORCINGBAR", "IFCREINFORCINGMESH", "IFCTENDON", "IFCTENDONANCHOR", "IFCVIRTUALELEMENT", "IFCSPACEHEATER", "IFCELECTRICDISTRIBUTIONBOARD",
                   "IFCBEARING", "IFCDEEPFOUNDATION", "IFCKERB", "IFCPAVEMENT", "IFCRAIL", "IFCWALLSTANDARDCASE_UNUSED")
_OPERATION_SWING = (("DOUBLE", "double"), ("SLIDING", "sliding"), ("LEFT", "left"), ("RIGHT", "right"))
_SI_PREFIX = {"EXA": 1e18, "PETA": 1e15, "TERA": 1e12, "GIGA": 1e9, "MEGA": 1e6, "KILO": 1e3, "HECTO": 1e2, "DECA": 1e1, "DECI": 1e-1, "CENTI": 1e-2,
              "MILLI": 1e-3, "MICRO": 1e-6, "NANO": 1e-9, "PICO": 1e-12, "FEMTO": 1e-15, "ATTO": 1e-18}
_NUMBER = re.compile(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?")
_INSTANCE = re.compile(r"#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(")

Pt = tuple[float, float]
Pt3 = tuple[float, float, float]
Mat = tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]
Xform = tuple[Mat, Pt3]  # rotation (columns = local axes) and translation
IDENTITY: Xform = (((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)), (0.0, 0.0, 0.0))


class IfcError(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code, self.message, self.details = code, message, details or {}


class IfcTimeout(IfcError):
    def __init__(self) -> None:
        super().__init__("ifc_timeout", "the IFC read ran past its deadline")


class R:
    """An instance reference, #n."""
    __slots__ = ("n",)

    def __init__(self, n: int) -> None:
        self.n = n


class E:
    """An enumeration value, .X."""
    __slots__ = ("v",)

    def __init__(self, v: str) -> None:
        self.v = v


class T:
    """A typed value, IFCLABEL('x')."""
    __slots__ = ("t", "v")

    def __init__(self, t: str, v: Any) -> None:
        self.t, self.v = t, v


# ---------------------------------------------------------------- the STEP text

def decode_string(raw: str) -> str:
    """The text of a STEP string body (between the quotes): '' -> ', \\\\ -> \\, \\X2\\…\\X0\\ / \\X4\\…\\X0\\ unicode,
    \\X\\hh latin-1, \\S\\c upper-half, page directives dropped."""
    out: list[str] = []
    i, n = 0, len(raw)
    while i < n and len(out) < MAX_STRING:
        c = raw[i]
        if c == "'" and i + 1 < n and raw[i + 1] == "'":
            out.append("'")
            i += 2
        elif c == "\\" and i + 1 < n:
            d = raw[i + 1]
            if d == "\\":
                out.append("\\")
                i += 2
            elif d in "XS" and i + 2 < n and raw[i + 2] == "\\":
                if d == "S":
                    if i + 3 < n:
                        out.append(chr((ord(raw[i + 3]) + 128) & 0xFF))
                    i += 4
                else:
                    out.append(chr(int(raw[i + 3:i + 5], 16)) if re.fullmatch(r"[0-9A-Fa-f]{2}", raw[i + 3:i + 5] or "") else "")
                    i += 5
            elif d == "X" and i + 3 < n and raw[i + 2] in "24" and raw[i + 3] == "\\":
                width = 4 if raw[i + 2] == "2" else 8
                end = raw.find("\\X0\\", i + 4)
                if end < 0:
                    end = n
                hexes = raw[i + 4:end]
                for k in range(0, len(hexes) - width + 1, width):
                    try:
                        cp = int(hexes[k:k + width], 16)
                        out.append(chr(cp) if cp <= 0x10FFFF else "")
                    except ValueError:
                        break
                i = end + 4
            elif d in "PN" and i + 3 < n and raw[i + 3] == "\\":  # \P?\ page, \N\ newline
                if d == "N":
                    out.append("\n")
                i += 4
            else:
                out.append(c)
                i += 1
        else:
            out.append(c)
            i += 1
    return "".join(out)[:MAX_STRING]


class _Args:
    """A recursive-descent parser of one instance's argument text, bounded in depth, aggregate size and string length."""

    def __init__(self, text: str) -> None:
        self.s = text
        self.i = 0
        self.n = len(text)

    def parse_list(self, depth: int = 0) -> list[Any]:
        if depth > MAX_DEPTH:
            raise IfcError("ifc_too_complex", "nesting too deep")
        out: list[Any] = []
        self._ws()
        if self.i < self.n and self.s[self.i] == ")":
            self.i += 1
            return out
        while self.i < self.n:
            out.append(self.value(depth + 1))
            if len(out) > MAX_AGGREGATE:
                raise IfcError("ifc_too_complex", "aggregate too large")
            self._ws()
            if self.i >= self.n:
                break
            c = self.s[self.i]
            self.i += 1
            if c == ")":
                return out
            if c != ",":
                raise IfcError("ifc_not_step", "malformed argument list")
            self._ws()
        raise IfcError("ifc_not_step", "unterminated argument list")

    def value(self, depth: int) -> Any:
        self._ws()
        if self.i >= self.n:
            raise IfcError("ifc_not_step", "missing value")
        c = self.s[self.i]
        if c == "$":
            self.i += 1
            return None
        if c == "*":
            self.i += 1
            return "*"
        if c == "#":
            m = re.compile(r"#(\d+)").match(self.s, self.i)
            if not m:
                raise IfcError("ifc_not_step", "bad reference")
            self.i = m.end()
            return R(int(m.group(1)))
        if c == ".":
            j = self.s.find(".", self.i + 1)
            if j < 0:
                raise IfcError("ifc_not_step", "bad enumeration")
            v = self.s[self.i + 1:j]
            self.i = j + 1
            return E(v)
        if c == "'":
            j = self.i + 1
            while True:
                k = self.s.find("'", j)
                if k < 0:
                    raise IfcError("ifc_not_step", "unterminated string")
                if k + 1 < self.n and self.s[k + 1] == "'":
                    j = k + 2
                    continue
                break
            raw = self.s[self.i + 1:k]
            self.i = k + 1
            if len(raw) > MAX_STRING * 12:
                raise IfcError("ifc_too_complex", "string too long")
            return decode_string(raw)
        if c == "(":
            self.i += 1
            return self.parse_list(depth)
        m = _NUMBER.match(self.s, self.i)
        if m and m.end() > self.i and (c.isdigit() or c in "+-."):
            self.i = m.end()
            txt = m.group(0)
            try:
                return int(txt) if re.fullmatch(r"[+-]?\d+", txt) else float(txt)
            except ValueError:
                raise IfcError("ifc_not_step", "bad number")
        m = re.compile(r"[A-Z][A-Z0-9_]*").match(self.s, self.i)
        if m:
            name = m.group(0)
            self.i = m.end()
            self._ws()
            if self.i < self.n and self.s[self.i] == "(":
                self.i += 1
                inner = self.parse_list(depth + 1)
                return T(name, inner[0] if len(inner) == 1 else inner)
            return E(name)
        raise IfcError("ifc_not_step", f"unexpected character {c!r}")

    def _ws(self) -> None:
        while self.i < self.n and self.s[self.i] in " \t\r\n":
            self.i += 1


class Model:
    """The DATA section: instance spans found by one scan; arguments parsed on first use."""

    def __init__(self, text: str, deadline: float | None = None) -> None:
        self.text = text
        self.deadline = deadline
        self.spans: dict[int, tuple[str, int, int]] = {}
        self.types: dict[str, list[int]] = {}
        self.cache: dict[int, list[Any]] = {}
        self.schema = ""
        self._scan()

    def tick(self) -> None:
        if self.deadline is not None and time.monotonic() > self.deadline:
            raise IfcTimeout()

    def _scan(self) -> None:
        text = self.text
        head = text[:4096]
        if not head.lstrip().startswith("ISO-10303-21;"):
            raise IfcError("ifc_not_step", "not an ISO 10303-21 file")
        m = re.search(r"FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'", text[:65536])
        self.schema = (m.group(1) if m else "").upper().strip()
        if not self.schema or not any(self.schema.startswith(s) for s in SCHEMAS):
            raise IfcError("ifc_schema", "unsupported schema", {"schema": self.schema[:40]})
        start = text.find("\nDATA;")
        if start < 0:
            raise IfcError("ifc_not_step", "no DATA section")
        pos = start + 6
        end = len(text)
        count = 0
        while True:
            m = _INSTANCE.search(text, pos)
            if not m:
                break
            iid, name = int(m.group(1)), m.group(2)
            # the end of this instance: the ';' outside strings and parentheses
            j = m.end()
            depth = 1
            while j < end:
                c = text[j]
                if c == "'":
                    k = j + 1
                    while True:
                        k = text.find("'", k)
                        if k < 0:
                            raise IfcError("ifc_not_step", "unterminated string")
                        if k + 1 < end and text[k + 1] == "'":
                            k += 2
                            continue
                        break
                    j = k + 1
                    continue
                if c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            if depth != 0:
                raise IfcError("ifc_not_step", "unterminated instance")
            if j - m.end() > MAX_INSTANCE_CHARS:
                raise IfcError("ifc_too_complex", "instance too long", {"instance": iid})
            if iid not in self.spans:  # a duplicate id keeps the first (never silently the attacker's second)
                self.spans[iid] = (name, m.end(), j)
                self.types.setdefault(name, []).append(iid)
            count += 1
            if count > MAX_INSTANCES:
                raise IfcError("ifc_too_complex", "too many instances", {"limit": MAX_INSTANCES})
            if count % DEADLINE_EVERY == 0:
                self.tick()
            pos = j + 1

    def type_of(self, iid: int) -> str | None:
        sp = self.spans.get(iid)
        return sp[0] if sp else None

    def args(self, iid: int) -> list[Any]:
        if iid in self.cache:
            return self.cache[iid]
        sp = self.spans.get(iid)
        if sp is None:
            return []
        parsed = _Args(self.text[sp[1]:sp[2] + 1]).parse_list()  # the span ends ON the closing parenthesis
        self.cache[iid] = parsed
        return parsed

    def inst(self, v: Any) -> tuple[str, list[Any]] | None:
        """(type, args) of a reference, or None for anything else."""
        if isinstance(v, R):
            t = self.type_of(v.n)
            return (t, self.args(v.n)) if t else None
        return None

    def of(self, *names: str) -> list[int]:
        return sorted(i for n in names for i in self.types.get(n, []))


def at(args: Sequence[Any], i: int) -> Any:
    return args[i] if 0 <= i < len(args) else None


def num(v: Any) -> float | None:
    if isinstance(v, T):
        v = v.v
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    f = float(v)
    return f if math.isfinite(f) and abs(f) <= MAX_ABS_M * 1000 else None


def text(v: Any) -> str:
    if isinstance(v, T):
        v = v.v
    return v if isinstance(v, str) else ""


def enum(v: Any) -> str:
    return v.v if isinstance(v, E) else ""


# ---------------------------------------------------------------- transforms

def _norm(v: Pt3) -> Pt3 | None:
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return (v[0] / n, v[1] / n, v[2] / n) if n > 1e-12 else None


def _cross(a: Pt3, b: Pt3) -> Pt3:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _apply(x: Xform, p: Pt3) -> Pt3:
    r, t = x
    return (r[0][0] * p[0] + r[0][1] * p[1] + r[0][2] * p[2] + t[0],
            r[1][0] * p[0] + r[1][1] * p[1] + r[1][2] * p[2] + t[1],
            r[2][0] * p[0] + r[2][1] * p[1] + r[2][2] * p[2] + t[2])


def _rotate(x: Xform, d: Pt3) -> Pt3:
    r = x[0]
    return (r[0][0] * d[0] + r[0][1] * d[1] + r[0][2] * d[2], r[1][0] * d[0] + r[1][1] * d[1] + r[1][2] * d[2], r[2][0] * d[0] + r[2][1] * d[1] + r[2][2] * d[2])


def _compose(outer: Xform, inner: Xform) -> Xform:
    ro, to = outer
    ri, ti = inner
    r = tuple(tuple(sum(ro[i][k] * ri[k][j] for k in range(3)) for j in range(3)) for i in range(3))
    return (r, _apply(outer, ti))  # type: ignore[return-value]


def _frame(z: Pt3 | None, x: Pt3 | None, loc: Pt3, scale: float = 1.0) -> Xform:
    zz = _norm(z) if z else None
    zz = zz or (0.0, 0.0, 1.0)
    xx = _norm(x) if x else None
    if xx is None or abs(xx[0] * zz[0] + xx[1] * zz[1] + xx[2] * zz[2]) > 0.999:
        xx = (1.0, 0.0, 0.0) if abs(zz[0]) < 0.9 else (0.0, 1.0, 0.0)
    d = xx[0] * zz[0] + xx[1] * zz[1] + xx[2] * zz[2]
    xx = _norm((xx[0] - d * zz[0], xx[1] - d * zz[1], xx[2] - d * zz[2])) or (1.0, 0.0, 0.0)
    yy = _cross(zz, xx)
    r = ((xx[0] * scale, yy[0] * scale, zz[0] * scale), (xx[1] * scale, yy[1] * scale, zz[1] * scale), (xx[2] * scale, yy[2] * scale, zz[2] * scale))
    return (r, loc)


class Reader:
    def __init__(self, model: Model, unit: float) -> None:
        self.m = model
        self.u = unit
        self._placements: dict[int, Xform | None] = {}
        self._why: dict[int, str] = {}  # why a placement resolved to None: placement_cycle / unsupported_placement / bad_placement

    # -- primitives
    def point(self, v: Any) -> Pt3 | None:
        inst = self.m.inst(v)
        if not inst:
            return None
        t, a = inst
        if t != "IFCCARTESIANPOINT":
            return None
        coords = at(a, 0)
        if not isinstance(coords, list) or not coords:
            return None
        vals = [num(c) for c in coords[:3]]
        if any(x is None for x in vals):
            return None
        while len(vals) < 3:
            vals.append(0.0)
        return (vals[0] * self.u, vals[1] * self.u, vals[2] * self.u)  # type: ignore[operator]

    def direction(self, v: Any) -> Pt3 | None:
        inst = self.m.inst(v)
        if not inst or inst[0] != "IFCDIRECTION":
            return None
        coords = at(inst[1], 0)
        if not isinstance(coords, list) or not coords:
            return None
        vals = [num(c) for c in coords[:3]]
        if any(x is None for x in vals):
            return None
        while len(vals) < 3:
            vals.append(0.0)
        return (vals[0], vals[1], vals[2])  # type: ignore[return-value]

    def axis2(self, v: Any) -> Xform | None:
        inst = self.m.inst(v)
        if not inst:
            return None
        t, a = inst
        if t == "IFCAXIS2PLACEMENT3D":
            loc = self.point(at(a, 0))
            return _frame(self.direction(at(a, 1)), self.direction(at(a, 2)), loc or (0.0, 0.0, 0.0)) if loc is not None or at(a, 0) is None else None
        if t == "IFCAXIS2PLACEMENT2D":
            loc = self.point(at(a, 0))
            return _frame(None, self.direction(at(a, 1)), loc or (0.0, 0.0, 0.0)) if loc is not None or at(a, 0) is None else None
        return None

    def placement(self, v: Any, chain: int = 0, seen: frozenset[int] = frozenset()) -> Xform | None:
        """The world transform of an IfcLocalPlacement (None = unsupported or cyclic)."""
        if v is None:
            return IDENTITY
        if not isinstance(v, R):
            return None
        if v.n in self._placements:
            return self._placements[v.n]
        if chain > MAX_CHAIN or v.n in seen:
            self._why[v.n] = "placement_cycle"
            return None
        inst = self.m.inst(v)
        if not inst or inst[0] != "IFCLOCALPLACEMENT":
            self._placements[v.n] = None
            self._why[v.n] = "unsupported_placement"
            return None
        parent_ref = at(inst[1], 0)
        parent = self.placement(parent_ref, chain + 1, seen | {v.n})
        local = self.axis2(at(inst[1], 1)) if at(inst[1], 1) is not None else IDENTITY
        out = _compose(parent, local) if parent is not None and local is not None else None
        self._placements[v.n] = out
        if out is None:
            self._why[v.n] = self._why.get(parent_ref.n, "placement_cycle") if parent is None and isinstance(parent_ref, R) else "bad_placement"
        return out

    # -- representation items -> solids {poly (world xy), z0, h, kind}
    def polyline(self, v: Any, x: Xform) -> tuple[list[Pt], str]:
        """The world XY points of a curve; ("", reason) when unsupported."""
        inst = self.m.inst(v)
        if not inst:
            return [], "no_geometry"
        t, a = inst
        if t == "IFCPOLYLINE":
            pts = at(a, 0)
            if not isinstance(pts, list):
                return [], "no_geometry"
            out = []
            for p in pts[:MAX_AGGREGATE]:
                q = self.point(p)
                if q is None:
                    return [], "bad_number"
                w = _apply(x, q)
                out.append((w[0], w[1]))
            return out, ""
        if t == "IFCINDEXEDPOLYCURVE":
            segs = at(a, 1)
            if isinstance(segs, list) and any(isinstance(s, T) and s.t == "IFCARCINDEX" for s in segs):
                return [], "curved_geometry"
            plist = self.m.inst(at(a, 0))
            if not plist or plist[0] not in ("IFCCARTESIANPOINTLIST2D", "IFCCARTESIANPOINTLIST3D"):
                return [], "no_geometry"
            coords = at(plist[1], 0)
            if not isinstance(coords, list):
                return [], "no_geometry"
            out = []
            for c in coords:
                if not isinstance(c, list) or len(c) < 2:
                    return [], "bad_number"
                vals = [num(k) for k in c[:3]]
                if any(k is None for k in vals):
                    return [], "bad_number"
                while len(vals) < 3:
                    vals.append(0.0)
                w = _apply(x, (vals[0] * self.u, vals[1] * self.u, vals[2] * self.u))  # type: ignore[operator]
                out.append((w[0], w[1]))
            return out, ""
        if t in ("IFCTRIMMEDCURVE", "IFCCIRCLE", "IFCCOMPOSITECURVE", "IFCBSPLINECURVEWITHKNOTS", "IFCELLIPSE"):
            return [], "curved_geometry"
        return [], "no_geometry"

    def profile(self, v: Any, x: Xform) -> tuple[list[Pt], str]:
        inst = self.m.inst(v)
        if not inst:
            return [], "no_geometry"
        t, a = inst
        if t == "IFCRECTANGLEPROFILEDEF":
            pos = self.axis2(at(a, 2)) if at(a, 2) is not None else IDENTITY
            xd, yd = num(at(a, 3)), num(at(a, 4))
            if pos is None or xd is None or yd is None or xd <= 0 or yd <= 0:
                return [], "bad_number"
            xd, yd = xd * self.u / 2, yd * self.u / 2
            fr = _compose(x, pos)
            return [(w[0], w[1]) for w in (_apply(fr, p) for p in ((-xd, -yd, 0.0), (xd, -yd, 0.0), (xd, yd, 0.0), (-xd, yd, 0.0)))], ""
        if t in ("IFCARBITRARYCLOSEDPROFILEDEF", "IFCARBITRARYPROFILEDEFWITHVOIDS"):
            pts, why = self.polyline(at(a, 2), x)
            if why:
                return [], why
            if len(pts) > 3 and _close(pts[0], pts[-1]):
                pts = pts[:-1]
            return (pts, "") if len(pts) >= 3 else ([], "no_geometry")
        if t == "IFCCIRCLEPROFILEDEF":
            pos = self.axis2(at(a, 2)) if at(a, 2) is not None else IDENTITY
            r = num(at(a, 3))
            if pos is None or r is None or r <= 0:
                return [], "bad_number"
            r *= self.u
            fr = _compose(x, pos)
            return [(w[0], w[1]) for w in (_apply(fr, (r * math.cos(k * math.pi / 8), r * math.sin(k * math.pi / 8), 0.0)) for k in range(16))], ""
        return [], "unsupported_profile"

    def solids(self, v: Any, x: Xform, depth: int = 0, seen: frozenset[int] = frozenset()) -> tuple[list[dict[str, Any]], str]:
        """The solids of one representation item in world coordinates."""
        if depth > MAX_CHAIN or (isinstance(v, R) and v.n in seen):
            return [], "placement_cycle"
        inst = self.m.inst(v)
        if not inst:
            return [], "no_geometry"
        t, a = inst
        seen2 = seen | {v.n}
        if t == "IFCEXTRUDEDAREASOLID":
            pos = self.axis2(at(a, 1)) if at(a, 1) is not None else IDENTITY
            d = self.direction(at(a, 2)) or (0.0, 0.0, 1.0)
            depth_v = num(at(a, 3))
            if pos is None or depth_v is None or depth_v <= 0:
                return [], "bad_number"
            fr = _compose(x, pos)
            poly, why = self.profile(at(a, 0), fr)
            if why:
                return [], why
            dz = _rotate(fr, d)
            n = _norm(dz)
            if n is None or abs(n[2]) < 0.5:
                return [], "tilted_geometry"
            base = _apply(fr, (0.0, 0.0, 0.0))
            h = depth_v * self.u * abs(n[2]) * math.sqrt(dz[0] ** 2 + dz[1] ** 2 + dz[2] ** 2) / (math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2) or 1.0)
            z0 = base[2] if n[2] > 0 else base[2] - h
            return [{"poly": poly, "z0": z0, "h": h, "kind": "extrusion", "frame": fr}], ""
        if t == "IFCMAPPEDITEM":
            src = self.m.inst(at(a, 0))
            if not src or src[0] != "IFCREPRESENTATIONMAP":
                return [], "no_geometry"
            origin = self.axis2(at(src[1], 0)) if at(src[1], 0) is not None else IDENTITY
            target = self.operator(at(a, 1))
            if origin is None or target is None:
                return [], "unsupported_transform"
            fr = _compose(_compose(x, target), origin)
            rep = self.m.inst(at(src[1], 1))
            if not rep or rep[0] != "IFCSHAPEREPRESENTATION":
                return [], "no_geometry"
            out: list[dict[str, Any]] = []
            why_last = "no_geometry"
            for item in (at(rep[1], 3) or [])[:MAX_AGGREGATE] if isinstance(at(rep[1], 3), list) else []:
                sol, why = self.solids(item, fr, depth + 1, seen2)
                out.extend(sol)
                why_last = why or why_last
            return (out, "") if out else ([], why_last)
        if t in ("IFCBOOLEANCLIPPINGRESULT", "IFCBOOLEANRESULT"):
            return self.solids(at(a, 1), x, depth + 1, seen2)
        if t in ("IFCFACETEDBREP", "IFCFACETEDBREPWITHVOIDS", "IFCPOLYGONALFACESET", "IFCTRIANGULATEDFACESET", "IFCSHELLBASEDSURFACEMODEL"):
            pts = self.brep_points(t, a, x)
            if len(pts) < 3:
                return [], "no_geometry"
            xs, ys, zs = [p[0] for p in pts], [p[1] for p in pts], [p[2] for p in pts]
            poly = [(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))]
            return [{"poly": poly, "z0": min(zs), "h": max(zs) - min(zs), "kind": "brep", "frame": x}], ""
        if t in ("IFCCSGSOLID", "IFCSWEPTDISKSOLID", "IFCREVOLVEDAREASOLID", "IFCADVANCEDBREP", "IFCSURFACECURVESWEPTAREASOLID"):
            return [], "curved_geometry"
        return [], "unsupported_geometry"

    def brep_points(self, t: str, a: list[Any], x: Xform) -> list[Pt3]:
        pts: list[Pt3] = []
        if t in ("IFCPOLYGONALFACESET", "IFCTRIANGULATEDFACESET"):
            plist = self.m.inst(at(a, 0))
            coords = at(plist[1], 0) if plist else None
            for c in (coords or [])[:MAX_AGGREGATE] if isinstance(coords, list) else []:
                if isinstance(c, list) and len(c) >= 3:
                    vals = [num(k) for k in c[:3]]
                    if all(k is not None for k in vals):
                        pts.append(_apply(x, (vals[0] * self.u, vals[1] * self.u, vals[2] * self.u)))  # type: ignore[operator]
            return pts
        shells = at(a, 0)
        shells = shells if isinstance(shells, list) else [shells]
        budget = MAX_AGGREGATE
        for sh in shells:
            shell = self.m.inst(sh)
            faces = at(shell[1], 0) if shell else None
            for f in (faces or [])[:MAX_AGGREGATE] if isinstance(faces, list) else []:
                face = self.m.inst(f)
                bounds = at(face[1], 0) if face else None
                for b in (bounds or [])[:64] if isinstance(bounds, list) else []:
                    bound = self.m.inst(b)
                    loop = self.m.inst(at(bound[1], 0)) if bound else None
                    lp = at(loop[1], 0) if loop and loop[0] == "IFCPOLYLOOP" else None
                    for p in (lp or [])[:1024] if isinstance(lp, list) else []:
                        q = self.point(p)
                        if q is not None:
                            pts.append(_apply(x, q))
                        budget -= 1
                        if budget <= 0:
                            return pts
        return pts

    def operator(self, v: Any) -> Xform | None:
        if v is None:
            return IDENTITY
        inst = self.m.inst(v)
        if not inst or not inst[0].startswith("IFCCARTESIANTRANSFORMATIONOPERATOR"):
            return None
        a = inst[1]
        loc = self.point(at(a, 2)) or (0.0, 0.0, 0.0)
        scale = num(at(a, 3))
        axis3 = self.direction(at(a, 4)) if inst[0].endswith("3D") or inst[0].endswith("3DNONUNIFORM") else None
        return _frame(axis3, self.direction(at(a, 0)), loc, scale if scale and scale > 0 else 1.0)

    def product_shape(self, args: list[Any]) -> tuple[Xform | None, list[dict[str, Any]], list[Pt], str]:
        """(placement, body solids, axis polyline, reason-if-empty) of a product's representation."""
        x = self.placement(at(args, 5))
        if x is None:
            pl = at(args, 5)
            return None, [], [], self._why.get(pl.n, "placement_cycle") if isinstance(pl, R) else "unsupported_placement"
        shape = self.m.inst(at(args, 6))
        if not shape or shape[0] != "IFCPRODUCTDEFINITIONSHAPE":
            return x, [], [], "no_geometry"
        reps = at(shape[1], 2)
        solids: list[dict[str, Any]] = []
        axis: list[Pt] = []
        why = "no_geometry"
        for rv in (reps or [])[:64] if isinstance(reps, list) else []:
            rep = self.m.inst(rv)
            if not rep or rep[0] != "IFCSHAPEREPRESENTATION":
                continue
            ident = text(at(rep[1], 1))
            items = at(rep[1], 3)
            if not isinstance(items, list):
                continue
            if ident == "Axis":
                for it in items[:8]:
                    pts, w = self.polyline(it, x)
                    if pts and not axis:
                        axis = pts
            elif ident in ("Body", "", "Facetation", "SurfaceModel", "FootPrint") and not (ident == "FootPrint" and solids):
                for it in items[:MAX_AGGREGATE]:
                    self.m.tick()
                    sol, w = self.solids(it, x)
                    solids.extend(sol)
                    if w:
                        why = w
        return x, solids, axis, "" if solids or axis else why


def _close(a: Pt, b: Pt, eps: float = 1e-6) -> bool:
    return abs(a[0] - b[0]) <= eps and abs(a[1] - b[1]) <= eps


def _bbox(pts: Sequence[Pt]) -> tuple[float, float, float, float]:
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def _project(pts: Sequence[Pt], p: Pt) -> tuple[float, float, float]:
    """(arc length at the nearest point, distance, total length) of p against the polyline."""
    best = (0.0, float("inf"))
    total = 0.0
    for a, b in zip(pts, pts[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        if ln <= 1e-9:
            continue
        f = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (ln * ln)))
        q = (a[0] + dx * f, a[1] + dy * f)
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if d < best[1]:
            best = (total + f * ln, d)
        total += ln
    return best[0], best[1], total


def _midline(poly: Sequence[Pt]) -> tuple[list[Pt], float] | None:
    """A thin polygon as its long axis and its thickness (the longest edge gives the direction)."""
    if len(poly) < 3:
        return None
    best, bl = None, -1.0
    for a, b in zip(poly, list(poly[1:]) + [poly[0]]):
        ln = math.hypot(b[0] - a[0], b[1] - a[1])
        if ln > bl:
            best, bl = (a, b), ln
    if best is None or bl <= 1e-9:
        return None
    ux, uy = (best[1][0] - best[0][0]) / bl, (best[1][1] - best[0][1]) / bl
    s = [p[0] * ux + p[1] * uy for p in poly]
    n = [-p[0] * uy + p[1] * ux for p in poly]
    s0, s1, n0, n1 = min(s), max(s), min(n), max(n)
    nm = (n0 + n1) / 2
    return [(ux * s0 - uy * nm, uy * s0 + ux * nm), (ux * s1 - uy * nm, uy * s1 + ux * nm)], n1 - n0


def _psets(model: Model) -> dict[int, dict[str, dict[str, Any]]]:
    """element id -> pset name -> property name -> value (typed values unwrapped)."""
    out: dict[int, dict[str, dict[str, Any]]] = {}
    for rid in model.of("IFCRELDEFINESBYPROPERTIES"):
        a = model.args(rid)
        ps = model.inst(at(a, 5))
        if not ps or ps[0] != "IFCPROPERTYSET":
            continue
        name = text(at(ps[1], 2))
        props: dict[str, Any] = {}
        for pv in (at(ps[1], 4) or [])[:512] if isinstance(at(ps[1], 4), list) else []:
            p = model.inst(pv)
            if p and p[0] == "IFCPROPERTYSINGLEVALUE":
                v = at(p[1], 2)
                if isinstance(v, T):
                    v = v.v
                if isinstance(v, E):
                    v = v.v == "T"
                props[text(at(p[1], 0))] = v
        for ov in (at(a, 4) or [])[:MAX_AGGREGATE] if isinstance(at(a, 4), list) else []:
            if isinstance(ov, R):
                out.setdefault(ov.n, {}).setdefault(name, {}).update(props)
    return out


def _unit_factor(model: Model) -> tuple[float, str | None]:
    """Metres per file length unit, and a warning when assumed."""
    for uid in model.of("IFCUNITASSIGNMENT"):
        for uv in (at(model.args(uid), 0) or []) if isinstance(at(model.args(uid), 0), list) else []:
            f = _length_unit(model, uv, 0)
            if f is not None:
                return f, None
    for uid in model.of("IFCSIUNIT"):
        f = _length_unit(model, R(uid), 0)
        if f is not None:
            return f, None
    return 1.0, "no_length_unit"


def _length_unit(model: Model, v: Any, depth: int) -> float | None:
    inst = model.inst(v)
    if not inst or depth > 4:
        return None
    t, a = inst
    if t == "IFCSIUNIT" and enum(at(a, 1)) == "LENGTHUNIT":
        return _SI_PREFIX.get(enum(at(a, 2)), 1.0) if enum(at(a, 3)) == "METRE" else None
    if t == "IFCCONVERSIONBASEDUNIT" and enum(at(a, 1)) == "LENGTHUNIT":
        mw = model.inst(at(a, 3))
        if mw and mw[0] == "IFCMEASUREWITHUNIT":
            k = num(at(mw[1], 0))
            base = _length_unit(model, at(mw[1], 1), depth + 1)
            return k * base if k and base else None
    return None


def _storeys(model: Model, unit: float) -> list[dict[str, Any]]:
    out = []
    for sid in model.of("IFCBUILDINGSTOREY"):
        a = model.args(sid)
        el = num(at(a, 9))
        out.append({"id": sid, "name": clean_text(text(at(a, 2)), 80) or f"#{sid}", "elevation_m": (el or 0.0) * unit, "guid": text(at(a, 0))})
    out.sort(key=lambda s: (s["elevation_m"], s["id"]))
    for i, s in enumerate(out):
        s["index"] = i
    return out


def _swing_of(operation: str) -> str:
    op = operation.upper()
    for key, swing in _OPERATION_SWING:
        if key in op:
            return swing
    return "none"


def _item_for(cls: str, ptype: str, catalog: dict[str, dict[str, Any]], by_ifc: dict[tuple[str, str], str], by_class: dict[str, str]) -> tuple[str, float]:
    cls = CLASS_ALIASES.get(cls, cls)
    if (cls, ptype) in by_ifc:
        return by_ifc[(cls, ptype)], 0.7
    if cls in by_class:
        return by_class[cls], 0.6
    return GENERIC_ID if GENERIC_ID in catalog else next(iter(sorted(catalog)), GENERIC_ID), 0.5


def read(data: bytes, *, width_px: int, height_px: int, scale_m_per_px: float, scale_status: str, level_id: str, level_elevation_m: float, run_id: str,
         catalog: dict[str, dict[str, Any]], storey: int | None = None, deadline: float | None = None, ceiling_m: float = 2.8) -> dict[str, Any]:
    """The candidates of one storey of `data` in the plan's frame, and the import report (CR-037 sections 1, 2, 4)."""
    t0 = time.perf_counter()
    if len(data) > MAX_BYTES:
        raise IfcError("ifc_too_large", "file too large", {"limit": MAX_BYTES})
    if data[:2] == b"PK":
        raise IfcError("ifc_compressed", "compressed IFC (ifczip) is not read")
    if b"\x00" in data[:65536]:
        raise IfcError("ifc_not_step", "binary content")
    txt = data.decode("utf-8", errors="replace")
    model = Model(txt, deadline)
    unit, unit_warning = _unit_factor(model)
    rd = Reader(model, unit)
    psets = _psets(model)
    warnings: list[str] = []
    if unit_warning:
        warnings.append(unit_warning)
    if not model.schema.startswith("IFC4"):
        warnings.append(f"schema_{model.schema.lower()}")

    storeys = _storeys(model, unit)
    chosen: dict[str, Any] | None = None
    if storeys:
        if storey is not None:
            chosen = storeys[storey] if 0 <= storey < len(storeys) else None
            if chosen is None:
                raise IfcError("ifc_storey", "no such storey", {"storeys": len(storeys)})
        else:
            chosen = min(storeys, key=lambda s: (abs(s["elevation_m"] - level_elevation_m), s["index"]))
    else:
        warnings.append("no_storey_in_file")
    storey_z = chosen["elevation_m"] if chosen else 0.0

    # containment: element -> storey id
    in_storey: dict[int, int] = {}
    storey_ids = {s["id"] for s in storeys}
    for rid in model.of("IFCRELCONTAINEDINSPATIALSTRUCTURE"):
        a = model.args(rid)
        st = at(a, 5)
        if isinstance(st, R) and st.n in storey_ids and isinstance(at(a, 4), list):
            for ev in at(a, 4)[:MAX_AGGREGATE]:
                if isinstance(ev, R):
                    in_storey.setdefault(ev.n, st.n)
    for rid in model.of("IFCRELAGGREGATES"):
        a = model.args(rid)
        st = at(a, 4)
        if isinstance(st, R) and st.n in storey_ids and isinstance(at(a, 5), list):
            for ev in at(a, 5)[:MAX_AGGREGATE]:
                if isinstance(ev, R):
                    in_storey.setdefault(ev.n, st.n)
    only = storeys[0]["id"] if len(storeys) == 1 else None

    skipped: list[dict[str, Any]] = []
    skipped_total = 0
    counts_by_reason: dict[str, int] = {}

    def skip(iid: int, cls: str, reason: str, name: str = "") -> None:
        nonlocal skipped_total
        skipped_total += 1
        counts_by_reason[reason] = counts_by_reason.get(reason, 0) + 1
        if len(skipped) < MAX_SKIPPED_ROWS:
            skipped.append({"id": f"#{iid}", "class": cls, "reason": reason, "name": clean_text(name, 80)})

    def storey_ok(iid: int, cls: str, name: str) -> bool:
        st = in_storey.get(iid, only)
        if chosen is None:
            return True
        if st is None:
            skip(iid, cls, "no_storey", name)
            return False
        if st != chosen["id"]:
            skip(iid, cls, "other_storey", name)
            return False
        return True

    # material layer thickness per wall (IfcMaterialLayerSetUsage)
    layer_thickness: dict[int, float] = {}
    for rid in model.of("IFCRELASSOCIATESMATERIAL"):
        a = model.args(rid)
        mat = model.inst(at(a, 5))
        if not mat:
            continue
        ls = mat[1] if mat[0] == "IFCMATERIALLAYERSET" else None
        if mat[0] == "IFCMATERIALLAYERSETUSAGE":
            inner = model.inst(at(mat[1], 0))
            ls = inner[1] if inner and inner[0] == "IFCMATERIALLAYERSET" else None
        if ls is None or not isinstance(at(ls, 0), list):
            continue
        total = 0.0
        for lv in at(ls, 0)[:64]:
            layer = model.inst(lv)
            th = num(at(layer[1], 1)) if layer and layer[0] == "IFCMATERIALLAYER" else None
            total += (th or 0.0) * unit
        if total > 0 and isinstance(at(a, 4), list):
            for ev in at(a, 4)[:MAX_AGGREGATE]:
                if isinstance(ev, R):
                    layer_thickness.setdefault(ev.n, total)

    # -- walls, in metres (world)
    walls_m: list[dict[str, Any]] = []  # {iid, guid, name, axis, bulges, thickness, kind, height, base}
    wall_lookup: dict[int, list[int]] = {}  # instance -> indexes into walls_m
    wall_reason: dict[int, str] = {}  # a skipped wall's reason: its openings are reported with it
    for iid in model.of(*WALL_CLASSES):
        model.tick()
        a = model.args(iid)
        cls = model.type_of(iid) or ""
        name = text(at(a, 2))
        before = skipped_total
        if not storey_ok(iid, cls, name):
            wall_reason[iid] = skipped[-1]["reason"] if skipped_total > before and skipped else "other_storey"
            continue
        x, solids, axis, why = rd.product_shape(a)
        if x is None or (not solids and not axis):
            skip(iid, cls, why or "no_geometry", name)
            wall_reason[iid] = why or "no_geometry"
            continue
        own = psets.get(iid, {}).get(PSET, {})
        common = psets.get(iid, {}).get("Pset_WallCommon", {})
        thickness = num(own.get("Thickness")) or layer_thickness.get(iid)
        pieces: list[tuple[list[Pt], float | None]] = []
        if axis:
            if thickness is None and solids:
                # the extent of the first solid across the axis direction
                poly = solids[0]["poly"]
                a0, a1 = axis[0], axis[-1]
                dx, dy = a1[0] - a0[0], a1[1] - a0[1]
                ln = math.hypot(dx, dy)
                if ln > 1e-9 and poly:
                    nn = [(-p[0] * dy + p[1] * dx) / ln for p in poly]
                    thickness = max(nn) - min(nn)
            pieces.append((axis, thickness))
        else:
            for sol in solids:
                ml = _midline(sol["poly"])
                if ml is None:
                    continue
                pieces.append((ml[0], thickness if thickness is not None else ml[1]))
            if not pieces:
                skip(iid, cls, "no_geometry", name)
                wall_reason[iid] = "no_geometry"
                continue
        # our own file says the height only when the wall has an explicit one (absent = the level's ceiling, kept as None)
        height = num(own.get("Height")) if own else (solids[0]["h"] if solids else None)
        base = num(own.get("BaseZ"))
        if base is None and solids:
            base = solids[0]["z0"] - storey_z
        kind = str(own.get("Kind") or "")
        if kind not in WALL_KINDS:
            ptype = enum(at(a, 8)) if cls != "IFCCURTAINWALL" else "GLASS"
            if cls == "IFCCURTAINWALL" or (text(at(a, 4)) or "").lower() == "glass":
                kind = "glass"
            elif common.get("IsExternal") is True:
                kind = "exterior"
            elif ptype == "PARTITIONING":
                kind = "partition"
            else:
                kind = ""
        bulges: list[float] = []
        raw_b = own.get("Bulges")
        if isinstance(raw_b, str) and axis:
            try:
                vals = json.loads(raw_b)
                if isinstance(vals, list) and len(vals) == len(axis) - 1 and all(isinstance(v, (int, float)) and abs(v) <= 4 for v in vals):
                    bulges = [float(v) for v in vals]
            except (ValueError, TypeError):
                pass
        for k, (poly, th) in enumerate(pieces):
            if len(poly) < 2 or any(not (math.isfinite(p[0]) and math.isfinite(p[1])) or abs(p[0]) > MAX_ABS_M or abs(p[1]) > MAX_ABS_M for p in poly):
                skip(iid, cls, "bad_number", name)
                continue
            th = th if th is not None and 0.005 <= th <= 3 else DEFAULT_WALL_THICKNESS_M
            wall_lookup.setdefault(iid, []).append(len(walls_m))
            walls_m.append({"iid": iid, "cls": cls, "guid": text(at(a, 0)), "name": name, "axis": poly, "bulges": bulges if k == 0 else [], "thickness": th,
                            "kind": kind or ("exterior" if th >= 0.25 else "interior"), "height": height if height and height >= MIN_HEIGHT_M else None,
                            "base": base if base is not None and abs(base) < 100 else 0.0, "own": bool(own), "pset": own})

    # -- openings: voids of the walls above, filled by doors / windows or passages
    fills: dict[int, int] = {}
    for rid in model.of("IFCRELFILLSELEMENT"):
        a = model.args(rid)
        if isinstance(at(a, 4), R) and isinstance(at(a, 5), R):
            fills.setdefault(at(a, 4).n, at(a, 5).n)
    openings_m: list[dict[str, Any]] = []
    for rid in model.of("IFCRELVOIDSELEMENT"):
        model.tick()
        a = model.args(rid)
        wv, ov = at(a, 4), at(a, 5)
        if not isinstance(wv, R) or not isinstance(ov, R):
            continue
        hosts = wall_lookup.get(wv.n)
        oargs = model.args(ov.n)
        ocls = model.type_of(ov.n) or "IFCOPENINGELEMENT"
        fill = fills.get(ov.n)
        fcls = model.type_of(fill) if fill is not None else None
        fargs = model.args(fill) if fill is not None else []
        name = text(at(fargs, 2)) if fill is not None else text(at(oargs, 2))
        cls = fcls or ocls
        if not hosts:
            skip(fill if fill is not None else ov.n, cls, wall_reason.get(wv.n, "host_wall_skipped" if model.type_of(wv.n) in WALL_CLASSES else "host_not_wall"), name)
            continue
        own = psets.get(fill, {}).get(PSET, {}) if fill is not None else {}
        own = own or psets.get(ov.n, {}).get(PSET, {})
        kind = "door" if fcls == "IFCDOOR" else "window" if fcls == "IFCWINDOW" else "passage"
        if fcls not in (None, "IFCDOOR", "IFCWINDOW"):
            skip(fill, fcls or "", "unsupported_filling", name)  # type: ignore[arg-type]
            continue
        # position: the opening's body centroid (world), else its placement origin
        x, solids, _axis, why = rd.product_shape(oargs)
        centre: Pt | None = None
        if solids and solids[0]["poly"]:
            poly = solids[0]["poly"]
            centre = (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))
        elif x is not None:
            o = _apply(x, (0.0, 0.0, 0.0))
            centre = (o[0], o[1])
        if centre is None or not all(math.isfinite(c) for c in centre):
            skip(fill if fill is not None else ov.n, cls, "no_geometry", name)
            continue
        # the host piece: the nearest of the wall's pieces
        best = None
        for wi in hosts:
            s, d, total = _project(walls_m[wi]["axis"], centre)
            if total > 1e-9 and (best is None or d < best[1]):
                best = (wi, d, s, total)
        if best is None:
            skip(fill if fill is not None else ov.n, cls, "host_wall_skipped", name)
            continue
        wi, dist, s, total = best
        host = walls_m[wi]
        if dist > max(1.0, host["thickness"] * 2):
            skip(fill if fill is not None else ov.n, cls, "opening_off_wall", name)
            continue
        t_own = num(own.get("T"))
        t = t_own if t_own is not None and 0 <= t_own <= 1 else s / total
        width = num(own.get("Width")) or (num(at(fargs, 9)) or 0) * unit or None
        if not width and solids and solids[0]["poly"]:
            a0, a1 = host["axis"][0], host["axis"][-1]
            dx, dy = a1[0] - a0[0], a1[1] - a0[1]
            ln = math.hypot(dx, dy) or 1.0
            ss = [(p[0] * dx + p[1] * dy) / ln for p in solids[0]["poly"]]
            width = max(ss) - min(ss)
        width = width if width and 0.05 <= width <= 10 else 0.9
        height = num(own.get("Height")) or (num(at(fargs, 8)) or 0) * unit or (solids[0]["h"] if solids else None)
        height = height if height and 0.1 <= height <= 10 else (1.2 if kind == "window" else 2.1)
        sill = num(own.get("Sill"))
        if sill is None and solids:
            sill = solids[0]["z0"] - storey_z
        sill = sill if sill is not None and 0 <= sill <= 10 else (0.9 if kind == "window" else 0.0)
        swing = str(own.get("Swing") or "")
        if swing not in ("left", "right", "double", "sliding", "none"):
            swing = _swing_of(enum(at(fargs, 11))) if kind == "door" else "none"
        hinge = str(own.get("Hinge") or "")
        hinge = hinge if hinge in ("start", "end") else "start"
        openings_m.append({"iid": fill if fill is not None else ov.n, "cls": cls, "guid": text(at(fargs, 0)) if fill is not None else text(at(oargs, 0)), "name": name, "host": wi,
                           "t": t, "kind": kind, "width": width, "height": height, "sill": sill, "swing": swing, "hinge": hinge, "own": bool(own)})

    # -- spaces -> rooms
    rooms_m: list[dict[str, Any]] = []
    for iid in model.of("IFCSPACE"):
        model.tick()
        a = model.args(iid)
        name = text(at(a, 7)) or text(at(a, 2))
        if not storey_ok(iid, "IFCSPACE", name):
            continue
        x, solids, _axis, why = rd.product_shape(a)
        poly = next((s["poly"] for s in solids if len(s["poly"]) >= 3), None)
        if poly is None:
            skip(iid, "IFCSPACE", why or "no_geometry", name)
            continue
        rooms_m.append({"iid": iid, "guid": text(at(a, 0)), "name": name, "poly": poly})

    # -- objects
    by_ifc: dict[tuple[str, str], str] = {}
    by_class: dict[str, str] = {}
    for item_id in sorted(catalog):
        ifc = catalog[item_id].get("ifc") if isinstance(catalog[item_id].get("ifc"), dict) else None
        if ifc:
            by_ifc.setdefault((str(ifc.get("class") or "").upper(), str(ifc.get("predefined_type") or "").upper()), item_id)
            by_class.setdefault(str(ifc.get("class") or "").upper(), item_id)
    objects_m: list[dict[str, Any]] = []
    own_objects: set[int] = set()
    for iid in model.of(*OBJECT_CLASSES, *CONNECTOR_CLASSES):
        model.tick()
        a = model.args(iid)
        cls = model.type_of(iid) or ""
        name = text(at(a, 2))
        own = psets.get(iid, {}).get(PSET, {})
        if own.get("Collection") == "anchors":
            skip(iid, cls, "live_device", name)
            continue
        if cls in CONNECTOR_CLASSES:
            if own.get("Collection") != "objects":
                continue  # a stair of a foreign file is a connector (reported below); our tribune / ladder objects come back as objects
            own_objects.add(iid)
        if not storey_ok(iid, cls, name):
            continue
        x, solids, _axis, why = rd.product_shape(a)
        sol = next((s for s in solids if len(s["poly"]) >= 3), None)
        if x is None or sol is None:
            skip(iid, cls, why or "no_geometry", name)
            continue
        # the object's own frame: its placement x axis; size = the footprint's extents in that frame
        ax = _rotate(x, (1.0, 0.0, 0.0))
        ang = math.atan2(ax[1], ax[0]) if math.hypot(ax[0], ax[1]) > 1e-9 else 0.0
        ca, sa = math.cos(-ang), math.sin(-ang)
        local = [(p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca) for p in sol["poly"]]
        x0, y0, x1, y1 = _bbox(local)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        centre = (cx * math.cos(ang) - cy * math.sin(ang), cx * math.sin(ang) + cy * math.cos(ang))
        if not all(math.isfinite(v) and abs(v) <= MAX_ABS_M for v in (*centre, x1 - x0, y1 - y0)):
            skip(iid, cls, "bad_number", name)
            continue
        item_id = str(own.get("CatalogItem") or "")
        confidence = 0.9
        if item_id not in catalog:
            ptype = enum(at(a, 8))
            item_id, confidence = _item_for(cls, ptype, catalog, by_ifc, by_class)
        item = catalog.get(item_id) or {}
        size_default = item.get("size") if isinstance(item.get("size"), dict) else {}
        w = num(own.get("Width")) or (x1 - x0)
        d = num(own.get("Depth")) or (y1 - y0)
        h = num(own.get("Height")) or sol["h"]
        z = num(own.get("Z"))
        if z is None:
            z = sol["z0"] - storey_z
        rot = num(own.get("Rotation"))
        if rot is None:
            rot = (-math.degrees(ang)) % 360.0
        objects_m.append({"iid": iid, "cls": cls, "guid": text(at(a, 0)), "name": name, "item_id": item_id, "confidence": confidence, "centre": centre,
                          "w": w if 0.05 <= w <= 100 else float(size_default.get("w_m") or 0.5), "d": d if 0.05 <= d <= 100 else float(size_default.get("d_m") or 0.5),
                          "h": h if 0.05 <= h <= 100 else float(size_default.get("h_m") or 0.5), "z": max(-50.0, min(500.0, z)), "rot": round(rot % 360.0, 2)})

    # -- everything else of the storey: named in the report
    for iid in model.of(*CONNECTOR_CLASSES):
        a = model.args(iid)
        if iid not in own_objects and in_storey.get(iid, only) in (None, chosen["id"] if chosen else None):
            skip(iid, model.type_of(iid) or "", "connector_not_imported", text(at(a, 2)))
    for iid in model.of(*IGNORED_CLASSES):
        a = model.args(iid)
        if in_storey.get(iid, only) in (None, chosen["id"] if chosen else None):
            skip(iid, model.type_of(iid) or "", "unsupported_class", text(at(a, 2)))

    # -- alignment and conversion into the plan's frame
    plan_w, plan_h = width_px * scale_m_per_px, height_px * scale_m_per_px
    pts_all: list[Pt] = [p for w in walls_m for p in w["axis"]] + [p for r in rooms_m for p in r["poly"]] + [o["centre"] for o in objects_m]
    dx = dy = 0.0
    fits = True
    needed: list[float] | None = None
    if pts_all:
        x0, y0, x1, y1 = _bbox(pts_all)
        eps = 1e-6
        if not (x0 >= -eps and y0 >= -eps and x1 <= plan_w + eps and y1 <= plan_h + eps):
            dx, dy = -x0, -y0
            fits = (x1 - x0) <= plan_w + eps and (y1 - y0) <= plan_h + eps
            needed = [round(x1 - x0, 2), round(y1 - y0, 2)]

    def to_plan(p: Pt) -> list[float] | None:
        xn = (p[0] + dx) / plan_w
        yn = 1.0 - (p[1] + dy) / plan_h
        if xn < -1e-6 or xn > 1 + 1e-6 or yn < -1e-6 or yn > 1 + 1e-6:
            return None
        return [round(min(1.0, max(0.0, xn)), 5), round(min(1.0, max(0.0, yn)), 5)]

    out_walls: list[dict[str, Any]] = []
    wall_ids: dict[int, str] = {}
    for k, w in enumerate(walls_m):
        if len(out_walls) >= LIMITS["walls"]:
            skip(w["iid"], w["cls"], "limit", w["name"])
            continue
        poly = [to_plan(p) for p in w["axis"]]
        if any(p is None for p in poly):
            skip(w["iid"], w["cls"], "outside_plan", w["name"])
            continue
        wid = f"imp-{run_id}-w{len(out_walls) + 1:03d}"
        wall_ids[k] = wid
        ext = {"ifc_class": w["cls"]}
        if expand_guid(w["guid"]):
            ext["ifc_guid"] = w["guid"]
        item = {"id": wid, "level_id": level_id, "polyline": poly, "thickness_m": round(w["thickness"], 3), "height_m": round(w["height"], 3) if w["height"] else None,
                "base_z_m": round(w["base"], 3), "kind": w["kind"], "confidence": 0.9 if w["own"] else 0.75, "source": "imported", "locked": False, "external_ids": ext}
        if w["bulges"]:
            item["bulges"] = [round(b, 6) + 0.0 for b in w["bulges"]]
        if w["name"] and not w["own"]:
            item["tags"] = [clean_text(w["name"], 40)]
        out_walls.append(item)

    out_openings: list[dict[str, Any]] = []
    for o in sorted(openings_m, key=lambda o: (o["host"], o["t"], o["iid"])):
        if len(out_openings) >= LIMITS["openings"]:
            skip(o["iid"], o["cls"], "limit", o["name"])
            continue
        wid = wall_ids.get(o["host"])
        if wid is None:
            skip(o["iid"], o["cls"], "host_wall_skipped", o["name"])
            continue
        ext = {"ifc_class": o["cls"]}
        if expand_guid(o["guid"]):
            ext["ifc_guid"] = o["guid"]
        out_openings.append({"id": f"imp-{run_id}-o{len(out_openings) + 1:03d}", "wall_id": wid, "t": round(o["t"], 5), "kind": o["kind"], "width_m": round(o["width"], 3),
                             "height_m": round(o["height"], 3), "sill_m": round(o["sill"], 3), "swing": o["swing"], "hinge": o["hinge"], "anchor_ref": None,
                             "confidence": 0.9 if o["own"] else 0.7, "source": "imported", "external_ids": ext})

    out_objects: list[dict[str, Any]] = []
    for o in objects_m:
        if len(out_objects) >= LIMITS["objects"]:
            skip(o["iid"], o["cls"], "limit", o["name"])
            continue
        pos = to_plan(o["centre"])
        if pos is None:
            skip(o["iid"], o["cls"], "outside_plan", o["name"])
            continue
        ext = {"ifc_class": o["cls"]}
        if expand_guid(o["guid"]):
            ext["ifc_guid"] = o["guid"]
        out_objects.append({"id": f"imp-{run_id}-x{len(out_objects) + 1:03d}", "level_id": level_id, "item_id": o["item_id"], "position": pos, "rotation_deg": o["rot"],
                            "size": {"w_m": round(o["w"], 3), "d_m": round(o["d"], 3), "h_m": round(o["h"], 3)}, "z_m": round(o["z"], 3), "params": {},
                            "label": clean_text(o["name"], 80) or None, "anchor_ref": None, "group_id": None, "locked": False, "source": "imported",
                            "confidence": o["confidence"], "external_ids": ext})

    out_rooms: list[dict[str, Any]] = []
    for r in rooms_m:
        if len(out_rooms) >= LIMITS["rooms"]:
            skip(r["iid"], "IFCSPACE", "limit", r["name"])
            continue
        poly = [to_plan(p) for p in r["poly"]]
        if any(p is None for p in poly) or len(poly) < 3:
            skip(r["iid"], "IFCSPACE", "outside_plan", r["name"])
            continue
        ext = {"ifc_class": "IFCSPACE"}
        if expand_guid(r["guid"]):
            ext["ifc_guid"] = r["guid"]
        out_rooms.append({"polygon": [{"x": p[0], "y": p[1]} for p in poly if p is not None], "name": clean_text(r["name"], 80), "external_ids": ext})

    report = {
        "schema": model.schema, "entities": len(model.spans), "metres_per_unit": unit, "ms": int((time.perf_counter() - t0) * 1000),
        "storeys": [{"index": s["index"], "name": s["name"], "elevation_m": round(s["elevation_m"], 3), "chosen": chosen is not None and s["id"] == chosen["id"]} for s in storeys],
        "counts": {"walls": len(out_walls), "openings": len(out_openings), "objects": len(out_objects), "rooms": len(out_rooms)},
        "skipped": skipped, "skipped_total": skipped_total, "skipped_by_reason": counts_by_reason, "warnings": warnings,
        "alignment": {"dx_m": round(dx, 3), "dy_m": round(dy, 3), "fits": fits, "needed_m": needed, "plan_m": [round(plan_w, 2), round(plan_h, 2)]},
    }
    return {
        "walls": out_walls, "openings": out_openings, "objects": out_objects, "rooms": out_rooms,
        "detector": {"name": "plan_ifc_read", "version": VERSION, "params": {"schema": model.schema, "storey": chosen["index"] if chosen else None, "metres_per_unit": unit}},
        "calibration_hint": None, "pixels": {}, "scale": {"m_per_px": scale_m_per_px, "status": scale_status},
        "units": "m", "metres_per_unit": unit, "layers": [], "blocks": [], "targets": [], "catalog_choices": [],
        "ifc": report,
    }
