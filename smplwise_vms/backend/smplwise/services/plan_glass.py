"""Window walls (glass curtain walls) of Plan Studio, document 2.1 (owner request 2026-10-08): a wall of kind "glass" is
a wall made mostly of glazing - panels between mullions over an optional sill, some panels may open, each operable
panel may be bound to an entity like an opening. Design: docs/architecture/PLAN_STUDIO_DESIGN_HE.md, section 2b.

The wall keeps every field of an ordinary wall (polyline, thickness = the frame depth, height, base, level, tags) and
adds an optional `glazing` block; absent = GLAZING_DEFAULTS. Doors and windows (`openings`) may still be placed on a
glass wall: an opening cuts the glazing as it cuts a solid wall.

Panel layout works on the wall's PATH LENGTH only: panel_count() and panel_bounds() take metres along the path, and
glazing_primitive() takes the path's points as the caller computed them. Today the path is the polyline; a curved wall
(pilot/WALL-curved, a sampled-path helper) passes its sampled points and nothing here changes.

This module has no import from plan_geometry (which imports it): it carries its own small number checks."""
from __future__ import annotations

import math
from typing import Any, Callable

GLASS_KIND = "glass"
GLAZING_SCHEMA_VERSION = "2.1"  # the minor bump: a document with a glass wall or a glazing block
TINTS = ("clear", "tinted", "frosted", "reflective")
OPERATIONS = ("casement_left", "casement_right", "tilt", "sliding", "awning")
MAX_PANELS = 200
PANEL_WIDTH_M = (0.2, 6.0)
MULLION_M = (0.01, 0.5)
SILL_M = (0.0, 10.0)
GLAZED_HEIGHT_M = (0.2, 50.0)
OPACITY = (0.05, 0.95)
# what auto-divide uses when the editor sends no bounds (typical curtain-wall modules)
AUTO_MIN_M = 0.9
AUTO_MAX_M = 1.5
GLAZING_DEFAULTS: dict[str, Any] = {"panel_width_m": 1.2, "panel_count": None, "mullion_m": 0.06, "sill_m": 0.0, "glazed_height_m": None,
                                    "tint": "clear", "opacity": 0.35, "operable": []}
ANCHOR_TYPES = ("camera", "ha_entity")

Point = tuple[float, float]


def _num(v: Any) -> bool:
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return False
    try:
        return math.isfinite(v)
    except OverflowError:
        return False


def _int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def is_glass(wall: Any) -> bool:
    return isinstance(wall, dict) and wall.get("kind") == GLASS_KIND


def uses_glazing(doc: Any) -> bool:
    """Whether the document needs version 2.1: a glass wall or a glazing block on any wall."""
    walls = doc.get("walls") if isinstance(doc, dict) else None
    return isinstance(walls, list) and any(isinstance(w, dict) and (w.get("kind") == GLASS_KIND or w.get("glazing") is not None) for w in walls)


def glazing_of(wall: dict[str, Any]) -> dict[str, Any]:
    """The wall's glazing with the defaults filled in for what is absent or of the wrong type (drawing never fails on a
    draft that does not validate yet)."""
    raw = wall.get("glazing") if isinstance(wall.get("glazing"), dict) else {}
    out = dict(GLAZING_DEFAULTS)
    for key in ("panel_width_m", "mullion_m", "sill_m", "opacity"):
        if _num(raw.get(key)) and raw[key] >= 0:
            out[key] = float(raw[key])
    if _int(raw.get("panel_count")) and raw["panel_count"] >= 1:
        out["panel_count"] = raw["panel_count"]
    if _num(raw.get("glazed_height_m")) and raw["glazed_height_m"] > 0:
        out["glazed_height_m"] = float(raw["glazed_height_m"])
    if raw.get("tint") in TINTS:
        out["tint"] = raw["tint"]
    out["operable"] = [o for o in raw.get("operable") or [] if isinstance(o, dict) and _int(o.get("panel"))] if isinstance(raw.get("operable"), list) else []
    if out["panel_width_m"] < PANEL_WIDTH_M[0]:
        out["panel_width_m"] = PANEL_WIDTH_M[0]
    return out


# ---------------------------------------------------------------- panel layout (path length only)

def _half_up(v: float) -> int:
    return int(math.floor(v + 0.5))


def panel_count(length_m: float, glazing: dict[str, Any]) -> int:
    """How many equal panels the wall is divided into: the stored panel_count, else the length over the nominal panel
    width rounded half-up; at least 1, at most MAX_PANELS."""
    pc = glazing.get("panel_count")
    if _int(pc) and pc >= 1:
        return min(pc, MAX_PANELS)
    width = glazing.get("panel_width_m")
    width = float(width) if _num(width) and width > 0 else GLAZING_DEFAULTS["panel_width_m"]
    if not (_num(length_m) and length_m > 0):
        return 1
    return max(1, min(MAX_PANELS, _half_up(length_m / max(width, PANEL_WIDTH_M[0]))))


def panel_bounds(length_m: float, count: int) -> list[float]:
    """The panel edges along the path, from 0 to the length (count + 1 values)."""
    n = max(1, int(count))
    return [length_m * i / n for i in range(n + 1)]


def auto_divide(length_m: float, min_m: float = AUTO_MIN_M, max_m: float = AUTO_MAX_M, target_m: float | None = None) -> int | None:
    """Bulk layout: the number of equal panels whose width lies in [min_m, max_m], closest to target_m (default the
    middle of the range). None when no whole number of panels fits (the wall is shorter than min_m, or the range is too
    narrow for this length) - the editor says so and changes nothing."""
    if not (_num(length_m) and length_m > 0 and _num(min_m) and _num(max_m) and 0 < min_m <= max_m):
        return None
    lo = max(1, math.ceil(length_m / max_m - 1e-9))
    hi = math.floor(length_m / min_m + 1e-9)
    if lo > hi or lo > MAX_PANELS:
        return None
    hi = min(hi, MAX_PANELS)
    target = target_m if _num(target_m) and target_m and target_m > 0 else (min_m + max_m) / 2
    return min(hi, max(lo, _half_up(length_m / target)))


# ---------------------------------------------------------------- validation

def check_fields(glazing: Any, bad: Callable[[str], None]) -> None:
    """Structural types of a glazing block (a wrong type refuses the save, as for any field)."""
    if glazing is None:
        return
    if not isinstance(glazing, dict):
        bad("glazing")
        return
    for key in ("panel_width_m", "mullion_m", "sill_m", "opacity"):
        if key in glazing and glazing[key] is not None and not _num(glazing[key]):
            bad(f"glazing.{key}")
    if glazing.get("panel_count") is not None and not _int(glazing["panel_count"]):
        bad("glazing.panel_count")
    if glazing.get("glazed_height_m") is not None and not _num(glazing["glazed_height_m"]):
        bad("glazing.glazed_height_m")
    if glazing.get("tint") is not None and not isinstance(glazing["tint"], str):
        bad("glazing.tint")
    op = glazing.get("operable")
    if op is not None:
        if not isinstance(op, list) or len(op) > MAX_PANELS:
            bad("glazing.operable")
            return
        for i, o in enumerate(op):
            if not isinstance(o, dict) or not _int(o.get("panel")) or not isinstance(o.get("operation"), str) or (o.get("anchor_ref") is not None and not isinstance(o["anchor_ref"], dict)):
                bad(f"glazing.operable[{i}]")


def check_wall(wall: dict[str, Any], length_m: float, issue: Callable[..., None]) -> None:
    """Geometric rules of a glass wall (they block publishing, never the save): ranges, enums, operable panels that
    exist on the current layout, one entry per panel, a bound entity well formed. A glazing block on a wall of another
    kind is ignored (a warning: converting back to glass brings it back)."""
    raw = wall.get("glazing")
    if not is_glass(wall):
        if raw is not None:
            issue("glazing_ignored", "הגדרות הזיגוג נשמרות אבל לא חלות: הקיר אינו קיר חלונות.", severity="warning")
        return
    if raw is None:
        return
    g = raw

    def rng(key: str, lo: float, hi: float, message: str, allow_none: bool = False) -> None:
        v = g.get(key)
        if v is None and (allow_none or key not in g):
            return
        if not (_num(v) and lo <= v <= hi):
            issue("glazing_range", message)

    rng("panel_width_m", *PANEL_WIDTH_M, f"רוחב לוח זכוכית בין {PANEL_WIDTH_M[0]:g} ל־{PANEL_WIDTH_M[1]:g} מ׳.")
    rng("mullion_m", *MULLION_M, f"רוחב מסגרת (מליון) בין {MULLION_M[0]:g} ל־{MULLION_M[1]:g} מ׳.")
    rng("sill_m", *SILL_M, f"גובה אדן הזיגוג בין {SILL_M[0]:g} ל־{SILL_M[1]:g} מ׳.")
    rng("glazed_height_m", *GLAZED_HEIGHT_M, f"גובה הזיגוג בין {GLAZED_HEIGHT_M[0]:g} ל־{GLAZED_HEIGHT_M[1]:g} מ׳ (ריק = עד ראש הקיר).", allow_none=True)
    rng("opacity", *OPACITY, f"אטימות הזכוכית בין {OPACITY[0]:g} ל־{OPACITY[1]:g}.")
    pc = g.get("panel_count")
    if pc is not None and not (_int(pc) and 1 <= pc <= MAX_PANELS):
        issue("glazing_range", f"מספר הלוחות בין 1 ל־{MAX_PANELS}.")
    if g.get("tint") is not None and g["tint"] not in TINTS:
        issue("enum", "גוון זכוכית לא מוכר.")
    h = wall.get("height_m")
    sill, gh = g.get("sill_m") or 0, g.get("glazed_height_m")
    if _num(h) and _num(sill) and (sill >= h or (_num(gh) and sill + gh > h + 1e-6)):
        issue("glazing_height", "האדן והזיגוג גבוהים מהקיר.", severity="warning")
    n = panel_count(length_m, glazing_of(wall))
    seen: set[int] = set()
    for o in g.get("operable") or []:
        p = o.get("panel")
        if not 0 <= p < n:
            issue("operable_panel", f"לוח נפתח {p + 1 if _int(p) else '?'} לא קיים בחלוקה הנוכחית ({n} לוחות).")
        elif p in seen:
            issue("operable_panel", f"לוח {p + 1} מופיע פעמיים ברשימת הנפתחים.")
        seen.add(p)
        if o.get("operation") not in OPERATIONS:
            issue("enum", "אופן פתיחה של לוח לא מוכר.")
        ref = o.get("anchor_ref")
        if ref is not None and not (ref.get("resource_type") in ANCHOR_TYPES and isinstance(ref.get("resource_id"), str) and ref["resource_id"]):
            issue("anchor_ref", "anchor_ref צריך resource_type ו־resource_id.")


# ---------------------------------------------------------------- drawing (the primitive the map and the exports share)

def _point_at(pts: list[Point], cum: list[float], s: float) -> tuple[Point, Point]:
    i = 0
    while i < len(pts) - 2 and s > cum[i + 1]:
        i += 1
    (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    seg = cum[i + 1] - cum[i]
    if seg <= 1e-9:
        return (x0, y0), (1.0, 0.0)
    f = min(1.0, max(0.0, (s - cum[i]) / seg))
    return (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f), ((x1 - x0) / seg, (y1 - y0) / seg)


CORNER_DEG = 20.0


def _unit(a: Point, b: Point) -> Point | None:
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    return (dx / n, dy / n) if n > 1e-9 else None


def glazing_primitive(wall: dict[str, Any], pts: list[Point], cum: list[float], wpx: float, px_per_m: float, cuts: list[tuple[float, float]],
                      p: Callable[[Point], list[float]], r2: Callable[[float], float]) -> dict[str, Any]:
    """The glazing of one glass wall in plan pixels, along the path `pts` (cumulative lengths `cum`): a mullion tick
    across the wall at every inner panel edge that is not inside an opening's cut, and every panel's span on the centre
    line with its operation (None = fixed) and bound entity. `p` and `r2` are the renderer's rounding (half-up 0.01 px)
    so both sides print the same numbers."""
    total = cum[-1]
    g = glazing_of(wall)
    n = panel_count(total / px_per_m, g)
    bounds = panel_bounds(total, n)
    ops = {o["panel"]: o for o in g["operable"] if 0 <= o["panel"] < n}

    def inside_cut(s: float) -> bool:
        return any(a - 1e-6 <= s <= b + 1e-6 for a, b in cuts)

    mullions: list[list[list[float]]] = []
    h = wpx / 2
    ticks: list[tuple[float, Point]] = []
    for s in bounds[1:-1]:
        _c, d = _point_at(pts, cum, s)
        ticks.append((s, d))
    closed = len(pts) >= 4 and pts[0] == pts[-1]
    # a corner post where the path turns by more than CORNER_DEG (never on a gentle sampled curve); a closed outline's
    # first point is a corner too
    for i in range(0 if closed else 1, len(pts) - 1):
        d0, d1 = _unit(pts[i - 1] if i else pts[-2], pts[i]), _unit(pts[i], pts[i + 1])
        turn = math.degrees(math.acos(max(-1.0, min(1.0, d0[0] * d1[0] + d0[1] * d1[1])))) if d0 and d1 else 0.0
        if turn > CORNER_DEG and all(abs(cum[i] - s) > 1e-6 for s, _d in ticks):
            bis = (d0[0] + d1[0], d0[1] + d1[1])
            norm = math.hypot(*bis)
            ticks.append((cum[i], (bis[0] / norm, bis[1] / norm) if norm > 1e-9 else d0))
    for s, d in sorted(ticks, key=lambda t: t[0]):
        if inside_cut(s):
            continue
        c, _ = _point_at(pts, cum, s)
        nl = (d[1], -d[0])
        mullions.append([p((c[0] + nl[0] * h, c[1] + nl[1] * h)), p((c[0] - nl[0] * h, c[1] - nl[1] * h))])
    panels = []
    for i in range(n):
        a, _ = _point_at(pts, cum, bounds[i])
        b, _ = _point_at(pts, cum, bounds[i + 1])
        op = ops.get(i)
        ref = op.get("anchor_ref") if op else None
        anchor = f"{ref.get('resource_type')}:{ref.get('resource_id')}" if isinstance(ref, dict) and ref.get("resource_id") else None
        panels.append({"index": i, "a": p(a), "b": p(b), "operation": op.get("operation") if op and op.get("operation") in OPERATIONS else None, "anchor": anchor})
    return {"kind": "glazing", "id": wall["id"], "width": r2(wpx), "mullion": r2(max(0.0, g["mullion_m"]) * px_per_m), "tint": g["tint"], "mullions": mullions, "panels": panels}
