"""Plan Studio geometry document, schema v2 (T084, CR-003): the structure layer of one plan version - levels, walls,
openings and labels (objects, circuits and connectors arrive with phase 2) in the version's normalized 0..1 space,
with real sizes in metres. contracts/schemas/plan_geometry.v2.schema.json is the published contract; this module
validates without a schema library. Structural problems (wrong types, missing collections, limits) refuse a save;
geometric problems (bounds, unknown references, an opening that does not fit its wall) stay with the draft and block
publishing. Design: docs/architecture/PLAN_STUDIO_DESIGN_HE.md, sections 2a and 4."""
from __future__ import annotations

import copy
import json
import math
from typing import Any, Mapping

from .plan_schema import canonical_json as canonical_json

SCHEMA_VERSION = "2.0"
TOKENS_VERSION = "map-1"
DEFAULT_LEVEL_ID = "L0"
DEFAULT_LEVEL_NAME = "מפלס ראשי"
DEFAULT_CEILING_M = 2.8
DEFAULT_WALL_THICKNESS_M = 0.2
ESTIMATED_WALL_FRACTION = 0.006  # uncalibrated: a 0.2 m wall is drawn 0.6 % of the plan width wide
WALL_KINDS = ("exterior", "interior", "partition", "railing", "low")
OPENING_KINDS = ("door", "window", "passage")
SWINGS = ("left", "right", "double", "sliding", "none")
HINGES = ("start", "end")
SOURCES = ("manual", "auto", "imported")
CAL_STATUSES = ("measured", "estimated", "missing")
CAL_METHODS = ("two_point", "dxf_units", "door_width", "manual", "carried")
ANCHOR_TYPES = ("camera", "ha_entity")
COLLECTIONS = ("levels", "walls", "openings", "rooms", "objects", "circuits", "connectors", "labels", "groups", "uncertain_regions")
LIMITS = {"levels": 20, "walls": 2000, "openings": 4000, "rooms": 500, "objects": 5000, "circuits": 500, "connectors": 200, "labels": 1000,
          "groups": 500, "uncertain_regions": 200}
MAX_WARNINGS = 200  # bounds only the noise of many geometric warnings (e.g. overlaps); an error or a structural
                    # issue is never dropped - their count is already bounded by LIMITS, not by this cap
MAX_DEPTH = 64  # a document this deeply nested is not something any client UI produces; refuse it rather than walk it
DIFF_COLLECTIONS = ("levels", "walls", "openings", "labels", "rooms", "objects", "circuits", "connectors", "groups")


def _num(v: Any) -> bool:
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return False
    try:
        return math.isfinite(v)
    except OverflowError:  # an int too large for a C double (e.g. a 400-digit thickness_m) is not a number either
        return False


def _unit(v: Any) -> bool:
    return _num(v) and 0 <= v <= 1


def _pt(p: Any) -> bool:
    return isinstance(p, (list, tuple)) and len(p) == 2 and _unit(p[0]) and _unit(p[1])


def _finite_point(p: Any) -> bool:
    """Like _pt but without the 0..1 bound: for structural checks where the type must be right before a geometric
    check may look at whether the value is also in range."""
    return isinstance(p, (list, tuple)) and len(p) == 2 and _num(p[0]) and _num(p[1])


def _issue(issues: list[dict[str, Any]], code: str, message: str, *, item: str | None = None, path: str = "", severity: str = "error", structural: bool = False) -> None:
    if severity == "warning" and not structural and sum(1 for i in issues if i["severity"] == "warning") >= MAX_WARNINGS:
        return  # only warnings are capped; a save is never refused or silently missing an error because of this cap
    issues.append({"code": code, "severity": severity, "structural": structural, "id": item, "path": path, "message": message})


# ---------------------------------------------------------------- construction

def calibration_of(version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    """The calibration block a document takes from its plan version - the version is the only place it changes."""
    raw = version["calibration_json"]
    if raw:
        rec = json.loads(raw)
        return {"status": "measured", "method": rec.get("method", "two_point"), "pairs": rec.get("pairs", []), "residual_pct": rec.get("residual_pct"), "reason": None}
    if version["scale_m_per_px"]:
        method = "dxf_units" if asset is not None and asset["mime"] == "image/vnd.dxf" else "manual"
        return {"status": "measured", "method": method, "pairs": [], "residual_pct": None, "reason": None}
    return {"status": "missing", "method": None, "pairs": [], "residual_pct": None, "reason": "לא בוצע כיול; מידות במטרים מוצגות כמשוערות"}


def version_block(version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    """Everything a document says about its plan version: the server always writes it, a client never can."""
    crop = json.loads(version["crop_json"]) if version["crop_json"] else None
    return {
        "plan_version_id": version["id"],
        "floor_id": version["floor_id"],
        "source": {"sha256": asset["sha256"] if asset is not None else "0" * 64, "file_name": asset["original_name"] if asset is not None else "",
                   "mime": asset["mime"] if asset is not None else "", "page": int(version["page"])},
        "dimensions": {"width_px": int(version["width_px"]), "height_px": int(version["height_px"]), "scale_m_per_px": version["scale_m_per_px"],
                       "calibration": calibration_of(version, asset)},
        "transform": {"rotation": int(version["rotation"]), "crop": crop},
    }


def new_document(version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    doc: dict[str, Any] = {"schema_version": SCHEMA_VERSION, **version_block(version, asset)}
    for coll in COLLECTIONS:
        doc[coll] = []
    doc["levels"] = [{"id": DEFAULT_LEVEL_ID, "name": DEFAULT_LEVEL_NAME, "elevation_m": 0.0, "ceiling_height_m": DEFAULT_CEILING_M, "is_default": True, "external_ids": {}}]
    doc["uncertainty"] = {"overall": 0.5, "notes": []}
    doc["meta"] = {"generator": "smplwise-vms", "tokens_version": TOKENS_VERSION, "detector_version": None}
    return doc


def rebase(doc: Mapping[str, Any], version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    """The server owns the version-bound fields (ids, source, size, calibration): a stale or edited client copy cannot
    move the document to another version or fake a calibration."""
    out = dict(doc)
    out.update(version_block(version, asset))
    out["schema_version"] = SCHEMA_VERSION
    return out


def is_empty(doc: Mapping[str, Any]) -> bool:
    return not any(doc.get(c) for c in ("walls", "openings", "labels", "objects", "connectors"))


def counts(doc: Mapping[str, Any]) -> dict[str, int]:
    return {c: len(doc.get(c) or []) for c in ("walls", "openings", "labels", "objects")}


# ---------------------------------------------------------------- measurement

def polyline_length_px(points: list[Any], width: float, height: float) -> float:
    return sum(math.hypot((b[0] - a[0]) * width, (b[1] - a[1]) * height) for a, b in zip(points, points[1:]))


def effective_scale(doc: Mapping[str, Any]) -> tuple[float, bool]:
    """Metres per version pixel and whether it is only an estimate (no calibration: a 0.2 m wall = 0.6 % of the width)."""
    dims = doc.get("dimensions") or {}
    scale = dims.get("scale_m_per_px")
    cal = dims.get("calibration")
    status = cal.get("status") if isinstance(cal, dict) else None
    if _num(scale) and scale > 0 and status in ("measured", "estimated"):
        return float(scale), status == "estimated"
    return DEFAULT_WALL_THICKNESS_M / (ESTIMATED_WALL_FRACTION * int(dims.get("width_px") or 1000)), True


def two_point_scale(pairs: list[tuple[Any, Any, float]], width_px: int, height_px: int) -> tuple[float, float]:
    """Metres per version pixel from (a, b, metres) pairs: a length-weighted mean; the residual is the largest relative
    disagreement of one pair with the mean, in percent (0 for a single pair)."""
    scales: list[float] = []
    weights: list[float] = []
    for a, b, metres in pairs:
        d = math.hypot((b[0] - a[0]) * width_px, (b[1] - a[1]) * height_px)
        if d < 5:
            raise ValueError("points_too_close")
        scales.append(metres / d)
        weights.append(d)
    mean = sum(s * w for s, w in zip(scales, weights)) / sum(weights)
    residual = max(abs(s - mean) / mean for s in scales) * 100 if len(scales) > 1 else 0.0
    return mean, round(residual, 2)


# ---------------------------------------------------------------- validation

def validate(doc: Any) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if not isinstance(doc, dict):
        _issue(issues, "type", "המסמך חייב להיות אובייקט JSON.", structural=True)
        return issues
    if doc.get("schema_version") != SCHEMA_VERSION:
        _issue(issues, "schema_version", f"schema_version חייב להיות {SCHEMA_VERSION}.", path="schema_version", structural=True)
    dims = doc.get("dimensions")
    if not isinstance(dims, dict) or not all(isinstance(dims.get(k), int) and not isinstance(dims.get(k), bool) and 1 <= dims.get(k) <= 100000 for k in ("width_px", "height_px")):
        _issue(issues, "dimensions", "dimensions.width_px ו־height_px חייבים להיות מספרים שלמים בין 1 ל־100000.", path="dimensions", structural=True)
    if isinstance(dims, dict):
        scale = dims.get("scale_m_per_px")
        if scale is not None and not _num(scale):
            _issue(issues, "type", "השדה scale_m_per_px בסוג לא נכון.", path="dimensions.scale_m_per_px", structural=True)
        if not isinstance(dims.get("calibration"), dict):
            _issue(issues, "type", "השדה calibration בסוג לא נכון.", path="dimensions.calibration", structural=True)
    for coll in COLLECTIONS:
        items = doc.get(coll)
        if not isinstance(items, list):
            _issue(issues, "type", f"{coll} חייב להיות רשימה.", path=coll, structural=True)
            continue
        if len(items) > LIMITS[coll]:
            _issue(issues, "limit", f"{coll}: יותר מ־{LIMITS[coll]} פריטים.", path=coll, structural=True)
            continue  # an over-limit collection gets exactly one issue; per-item checks cannot bound their own work
        for i, item in enumerate(items):
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not 1 <= len(item["id"]) <= 64:
                _issue(issues, "type", f"{coll}[{i}] חייב להיות אובייקט עם id טקסטואלי.", path=f"{coll}[{i}]", structural=True)
                continue
            _check_fields(coll, i, item, issues)
    if not any(i["structural"] for i in issues):  # a document already refused does not need this extra pass
        found = _find_nonfinite(doc)
        if found is not None:
            message, parts = found
            path = _join_path(parts)
            if not any(i["path"] == path for i in issues):  # _check_fields may have reported the same field already
                _issue(issues, "type", message, path=path, structural=True)
    if any(i["structural"] for i in issues):
        return issues
    width, height = dims["width_px"], dims["height_px"]
    seen: dict[str, str] = {}
    for coll in COLLECTIONS:
        for item in doc[coll]:
            if item["id"] in seen:
                _issue(issues, "duplicate_id", f"המזהה {item['id']} מופיע פעמיים ({seen[item['id']]}, {coll}).", item=item["id"], path=coll)
            else:
                seen[item["id"]] = coll
    _check_calibration(dims, issues)
    levels = _check_levels(doc["levels"], issues)
    walls = _check_walls(doc["walls"], levels, width, height, issues)
    _check_openings(doc, walls, width, height, issues)
    _check_labels(doc["labels"], levels, issues)
    _check_rooms(doc["rooms"], levels, issues)
    unc = doc.get("uncertainty")
    if not isinstance(unc, dict) or not _unit(unc.get("overall")) or not isinstance(unc.get("notes"), list):
        _issue(issues, "uncertainty", "uncertainty צריך overall בין 0 ל־1 ורשימת notes.", path="uncertainty")
    return issues


def _join_path(parts: tuple[Any, ...]) -> str:
    """Path parts (raw dict keys and list indices) to the dotted / bracketed string used throughout this module
    (e.g. "walls[0].thickness_m"). Kept separate from the walk so the string is built only for a path that is
    actually being reported, never for every node visited along the way."""
    out = ""
    for p in parts:
        if isinstance(p, int):
            out += f"[{p}]"
        elif out:
            out += f".{p}"
        else:
            out = str(p)
    return out


def _find_nonfinite(doc: dict[str, Any]) -> tuple[str, tuple[Any, ...]] | None:
    """Iterative walk (an explicit stack, not recursion - json.loads accepts nesting far deeper than Python's call
    stack allows) for the first problem anywhere in the document: a value nested past MAX_DEPTH, or a float that is
    NaN or +-infinity (Python's JSON parser accepts them, canonical_json would store them, and a browser cannot
    parse them back). Returns (message, path_parts) for the first one found, or None for a clean document. Path
    parts are raw keys/indices, not strings - joining is the caller's job, and happens at most once."""
    stack: list[tuple[Any, tuple[Any, ...], int]] = [(doc, (), 0)]
    while stack:
        node, parts, depth = stack.pop()
        if depth > MAX_DEPTH:
            return "עומק הקינון חורג מהמותר.", parts
        if isinstance(node, float) and not math.isfinite(node):
            return "ערך מספרי לא סופי.", parts
        if isinstance(node, dict):
            for k, v in node.items():
                stack.append((v, parts + (k,), depth + 1))
        elif isinstance(node, (list, tuple)):
            for i, v in enumerate(node):
                stack.append((v, parts + (i,), depth + 1))
    return None


def _check_fields(coll: str, i: int, item: dict[str, Any], issues: list[dict[str, Any]]) -> None:
    """Structural field-type checks for one item that already passed the id check: a wrong type refuses the save
    the same way a missing collection does, instead of reaching a geometric check that assumes the type is right
    (e.g. a level_id used as a set member, a wall_id used as a dict key). A missing optional field is fine; a
    required field that is absent reads as None, which is also the wrong type. Value ranges stay geometric."""
    iid = item["id"]

    def bad(field: str) -> None:
        _issue(issues, "type", f"השדה {field} בסוג לא נכון.", item=iid, path=f"{coll}[{i}].{field}", structural=True)

    def req(field: str, ok: bool) -> None:
        if not ok:
            bad(field)

    def opt(field: str, predicate: Any) -> None:
        v = item.get(field)
        if v is not None and not predicate(v):
            bad(field)

    if coll == "levels":
        req("name", isinstance(item.get("name"), str))
        req("elevation_m", _num(item.get("elevation_m")))
        req("ceiling_height_m", _num(item.get("ceiling_height_m")))
        req("is_default", isinstance(item.get("is_default"), bool))
        opt("external_ids", lambda v: isinstance(v, dict))
    elif coll == "walls":
        req("level_id", isinstance(item.get("level_id"), str))
        pl = item.get("polyline")
        req("polyline", isinstance(pl, list) and all(_finite_point(p) for p in pl))
        req("thickness_m", _num(item.get("thickness_m")))
        opt("height_m", _num)
        opt("base_z_m", _num)
        req("kind", isinstance(item.get("kind"), str))
        req("source", isinstance(item.get("source"), str))
        req("confidence", _num(item.get("confidence")))
        opt("locked", lambda v: isinstance(v, bool))
        opt("external_ids", lambda v: isinstance(v, dict))
    elif coll == "openings":
        req("wall_id", isinstance(item.get("wall_id"), str))
        req("t", _num(item.get("t")))
        req("width_m", _num(item.get("width_m")))
        req("height_m", _num(item.get("height_m")))
        req("sill_m", _num(item.get("sill_m")))
        req("confidence", _num(item.get("confidence")))
        req("kind", isinstance(item.get("kind"), str))
        req("swing", isinstance(item.get("swing"), str))
        req("hinge", isinstance(item.get("hinge"), str))
        req("source", isinstance(item.get("source"), str))
        opt("anchor_ref", lambda v: isinstance(v, dict))
        opt("external_ids", lambda v: isinstance(v, dict))
    elif coll == "labels":
        req("text", isinstance(item.get("text"), str))
        req("position", _finite_point(item.get("position")))
        req("level_id", isinstance(item.get("level_id"), str))
        req("size", _num(item.get("size")))
    elif coll == "rooms":
        opt("level_id", lambda v: isinstance(v, str))
        opt("ceiling_height_m", _num)
    # objects, circuits, connectors, groups, uncertain_regions: no field rules in phase 1


def _check_calibration(dims: dict[str, Any], issues: list[dict[str, Any]]) -> None:
    cal = dims.get("calibration")
    if not isinstance(cal, dict) or cal.get("status") not in CAL_STATUSES:
        _issue(issues, "calibration", "סטטוס הכיול חייב להיות measured / estimated / missing.", path="dimensions.calibration")
        return
    if cal["status"] == "missing":
        if not cal.get("reason"):
            _issue(issues, "calibration", "כיול חסר דורש סיבה.", path="dimensions.calibration.reason")
    elif not (_num(dims.get("scale_m_per_px")) and dims["scale_m_per_px"] > 0):
        _issue(issues, "calibration", "כיול קיים דורש scale_m_per_px חיובי.", path="dimensions.scale_m_per_px")
    if cal.get("method") is not None and cal.get("method") not in CAL_METHODS:
        _issue(issues, "enum", "שיטת כיול לא מוכרת.", path="dimensions.calibration.method")


def _check_levels(levels: list[dict[str, Any]], issues: list[dict[str, Any]]) -> set[str]:
    ids: set[str] = set()
    elevations: set[float] = set()
    if not levels:
        _issue(issues, "levels", "לקומה צריך להיות לפחות מפלס אחד.", path="levels")
    for lv in levels:
        ids.add(lv["id"])
        el, ceil = lv.get("elevation_m"), lv.get("ceiling_height_m")
        if not _num(el) or not -50 <= el <= 500:
            _issue(issues, "elevation", "גובה רצפת המפלס בין מינוס 50 ל־500 מ׳.", item=lv["id"], path="levels")
        elif el in elevations:
            _issue(issues, "duplicate_elevation", f"שני מפלסים באותו גובה ({el} מ׳).", item=lv["id"], path="levels")
        else:
            elevations.add(el)
        if not _num(ceil) or not 0 < ceil <= 50:
            _issue(issues, "ceiling", "גובה התקרה בין 0 ל־50 מ׳.", item=lv["id"], path="levels")
        if not isinstance(lv.get("name"), str) or not lv["name"].strip():
            _issue(issues, "name", "למפלס צריך שם.", item=lv["id"], path="levels")
    if levels and sum(1 for lv in levels if lv.get("is_default") is True) != 1:
        _issue(issues, "levels", "בדיוק מפלס אחד מסומן כמפלס ברירת המחדל.", path="levels")
    return ids


def _check_walls(walls: list[dict[str, Any]], levels: set[str], width: int, height: int, issues: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    ok: dict[str, dict[str, Any]] = {}
    for w in walls:
        wid = w["id"]
        pl = w.get("polyline")
        if not isinstance(pl, list) or len(pl) < 2 or not all(_pt(p) for p in pl):
            _issue(issues, "bounds", "קיר צריך לפחות שתי נקודות בתוך התוכנית.", item=wid, path="walls")
            continue
        if polyline_length_px(pl, width, height) < 1:
            _issue(issues, "too_short", "הקיר קצר מדי (אורך אפס).", item=wid, path="walls")
        if w.get("level_id") not in levels:
            _issue(issues, "unknown_level", "הקיר שייך למפלס שלא קיים.", item=wid, path="walls")
        if not (_num(w.get("thickness_m")) and 0 < w["thickness_m"] <= 3):
            _issue(issues, "thickness", "עובי קיר בין 0 ל־3 מ׳.", item=wid, path="walls")
        h = w.get("height_m")
        if h is not None and not (_num(h) and 0 < h <= 50):
            _issue(issues, "height", "גובה קיר בין 0 ל־50 מ׳ (ריק = עד התקרה).", item=wid, path="walls")
        z = w.get("base_z_m", 0)
        if not (_num(z) and -10 <= z <= 50):
            _issue(issues, "base_z", "גובה תחתית הקיר בין מינוס 10 ל־50 מ׳.", item=wid, path="walls")
        if w.get("kind") not in WALL_KINDS or w.get("source") not in SOURCES:
            _issue(issues, "enum", "סוג קיר או מקור (source) לא מוכרים.", item=wid, path="walls")
        if not _unit(w.get("confidence")):
            _issue(issues, "confidence", "confidence בין 0 ל־1.", item=wid, path="walls")
        ok[wid] = w
    return ok


def _check_openings(doc: dict[str, Any], walls: dict[str, dict[str, Any]], width: int, height: int, issues: list[dict[str, Any]]) -> None:
    scale, _ = effective_scale(doc)
    spans: dict[str, list[tuple[float, float, str]]] = {}
    for o in doc["openings"]:
        oid = o["id"]
        wall = walls.get(o.get("wall_id"))
        if wall is None:
            _issue(issues, "unknown_wall", "הפתח מחובר לקיר שלא קיים.", item=oid, path="openings")
            continue
        if o.get("kind") not in OPENING_KINDS or o.get("swing") not in SWINGS or o.get("hinge") not in HINGES:
            _issue(issues, "enum", "סוג פתח, כיוון פתיחה או ציר לא מוכרים.", item=oid, path="openings")
        if o.get("source") not in SOURCES or not _unit(o.get("confidence")):
            _issue(issues, "enum", "מקור או confidence לא תקינים.", item=oid, path="openings")
        for key in ("height_m", "sill_m"):
            v = o.get(key)
            if not (_num(v) and 0 <= v <= 10) or (key == "height_m" and v == 0):
                _issue(issues, "size", f"{key} מחוץ לטווח.", item=oid, path="openings")
        ref = o.get("anchor_ref")
        if ref is not None and not (isinstance(ref, dict) and ref.get("resource_type") in ANCHOR_TYPES and isinstance(ref.get("resource_id"), str) and ref["resource_id"]):
            _issue(issues, "anchor_ref", "anchor_ref צריך resource_type ו־resource_id.", item=oid, path="openings")
        t, width_m = o.get("t"), o.get("width_m")
        if not _unit(t):
            _issue(issues, "bounds", "מיקום הפתח על הקיר (t) בין 0 ל־1.", item=oid, path="openings")
            continue
        if not (_num(width_m) and 0 < width_m <= 10):
            _issue(issues, "width", "רוחב פתח בין 0 ל־10 מ׳.", item=oid, path="openings")
            continue
        length_m = polyline_length_px(wall["polyline"], width, height) * scale
        centre = t * length_m
        if centre - width_m / 2 < -0.01 or centre + width_m / 2 > length_m + 0.01:
            _issue(issues, "opening_outside_wall", "הפתח חורג מאורך הקיר.", item=oid, path="openings")
        spans.setdefault(wall["id"], []).append((centre - width_m / 2, centre + width_m / 2, oid))
    for items in spans.values():
        items.sort()
        for (_a0, a1, first), (b0, _b1, second) in zip(items, items[1:]):
            if b0 < a1 - 0.01:
                _issue(issues, "overlap", f"הפתחים {first} ו־{second} חופפים על אותו קיר.", item=second, path="openings", severity="warning")


def _check_labels(labels: list[dict[str, Any]], levels: set[str], issues: list[dict[str, Any]]) -> None:
    for lb in labels:
        if not _pt(lb.get("position")):
            _issue(issues, "bounds", "מיקום התווית מחוץ לתוכנית.", item=lb["id"], path="labels")
        if not isinstance(lb.get("text"), str) or not 1 <= len(lb["text"].strip()) <= 80:
            _issue(issues, "text", "טקסט התווית 1 עד 80 תווים.", item=lb["id"], path="labels")
        if lb.get("level_id") not in levels:
            _issue(issues, "unknown_level", "התווית שייכת למפלס שלא קיים.", item=lb["id"], path="labels")
        if not (_num(lb.get("size")) and 6 <= lb["size"] <= 200):
            _issue(issues, "size", "גודל תווית בין 6 ל־200.", item=lb["id"], path="labels")


def _check_rooms(rooms: list[dict[str, Any]], levels: set[str], issues: list[dict[str, Any]]) -> None:
    for r in rooms:
        if r.get("level_id") is not None and r["level_id"] not in levels:
            _issue(issues, "unknown_level", "החדר שייך למפלס שלא קיים.", item=r["id"], path="rooms")
        c = r.get("ceiling_height_m")
        if c is not None and not (_num(c) and 0 < c <= 50):
            _issue(issues, "ceiling", "גובה תקרת החדר בין 0 ל־50 מ׳.", item=r["id"], path="rooms")
