"""Canonical plan geometry document, schema v1 (T059): what the VMS knows about one plan version — the immutable
source, dimensions and calibration, the transform, rooms / zones, and explicit uncertainty — exported in a versioned
shape (contracts/schemas/plan_geometry.v1.schema.json) and validated here without a schema library: normalized
bounds, polygon validity, duplicate ids and missing calibration are checked so downstream renderers can be
deterministic. Producers never invent geometry: collections the VMS cannot fill stay empty and are named in the notes."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from .timeutil import iso_utc, parse_utc

SCHEMA_VERSION = "1.0"
ROOM_KINDS = {"room", "zone", "corridor", "outdoor", "service"}
CONNECTOR_KINDS = {"stairs", "elevator", "corridor", "ramp"}
PROVENANCE = {"manual", "auto", "imported"}


def _unit(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 1


def _point_ok(p: Any) -> bool:
    return isinstance(p, (list, tuple)) and len(p) == 2 and _unit(p[0]) and _unit(p[1])


def polygon_area(poly: list[list[float]]) -> float:
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))) / 2


def _segments_cross(a: list[float], b: list[float], c: list[float], d: list[float]) -> bool:
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0) and o1 != 0 and o2 != 0 and o3 != 0 and o4 != 0


def polygon_simple(poly: list[list[float]]) -> bool:
    """No two non-adjacent edges cross (self-intersection makes area and containment meaningless)."""
    n = len(poly)
    for i in range(n):
        for j in range(i + 1, n):
            if abs(i - j) in (1, n - 1):
                continue
            if _segments_cross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n]):
                return False
    return True


def validate(doc: dict[str, Any]) -> list[str]:
    """Return human-readable problems (empty = valid). Mirrors the JSON schema plus the geometric rules it cannot express."""
    errors: list[str] = []
    if doc.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    src = doc.get("source") or {}
    sha = src.get("sha256", "")
    if not (isinstance(sha, str) and len(sha) == 64 and all(c in "0123456789abcdef" for c in sha)):
        errors.append("source.sha256 must be 64 hex characters")
    if not isinstance(src.get("page"), int) or src.get("page", 0) < 1:
        errors.append("source.page must be a positive integer")
    dims = doc.get("dimensions") or {}
    for k in ("width_px", "height_px"):
        if not isinstance(dims.get(k), int) or dims.get(k, 0) < 1:
            errors.append(f"dimensions.{k} must be a positive integer")
    cal = dims.get("calibration") or {}
    if cal.get("status") not in ("measured", "estimated", "missing"):
        errors.append("dimensions.calibration.status must be measured | estimated | missing")
    elif cal["status"] == "missing" and not cal.get("reason"):
        errors.append("dimensions.calibration.reason is required when the calibration is missing")
    elif cal["status"] != "missing" and not (isinstance(dims.get("scale_m_per_px"), (int, float)) and dims["scale_m_per_px"] > 0):
        errors.append("dimensions.scale_m_per_px must be positive when the calibration is measured or estimated")
    tr = doc.get("transform") or {}
    if tr.get("rotation") not in (0, 90, 180, 270):
        errors.append("transform.rotation must be 0, 90, 180 or 270")
    crop = tr.get("crop")
    if crop is not None:
        if not all(_unit(crop.get(k)) for k in ("x", "y")) or not all(isinstance(crop.get(k), (int, float)) and 0 < crop[k] <= 1 for k in ("w", "h")):
            errors.append("transform.crop must be normalized (x, y in [0, 1]; w, h in (0, 1])")
        elif crop["x"] + crop["w"] > 1.000001 or crop["y"] + crop["h"] > 1.000001:
            errors.append("transform.crop exceeds the source bounds")
    seen: dict[str, str] = {}

    def check_id(coll: str, item: dict[str, Any]) -> None:
        i = item.get("id")
        if not isinstance(i, str) or not i:
            errors.append(f"{coll}: every item needs a non-empty id")
            return
        if i in seen:
            errors.append(f"duplicate id '{i}' in {coll} (already used in {seen[i]})")
        seen[i] = coll

    def check_common(coll: str, item: dict[str, Any]) -> None:
        if not _unit(item.get("confidence")):
            errors.append(f"{coll} '{item.get('id')}': confidence must be in [0, 1]")
        if item.get("source") not in PROVENANCE:
            errors.append(f"{coll} '{item.get('id')}': source must be manual | auto | imported")

    for coll in ("walls", "doors", "windows", "rooms", "connectors"):
        items = doc.get(coll)
        if not isinstance(items, list):
            errors.append(f"{coll} must be a list (empty when unknown)")
            continue
        for item in items:
            if not isinstance(item, dict):
                errors.append(f"{coll}: items must be objects")
                continue
            check_id(coll, item)
            check_common(coll, item)
            if coll == "walls":
                pl = item.get("polyline")
                if not isinstance(pl, list) or len(pl) < 2 or not all(_point_ok(p) for p in pl):
                    errors.append(f"walls '{item.get('id')}': polyline needs at least two normalized points")
            elif coll in ("doors", "windows"):
                if not _point_ok(item.get("position")):
                    errors.append(f"{coll} '{item.get('id')}': position must be a normalized point")
            elif coll == "rooms":
                poly = item.get("polygon")
                if not isinstance(poly, list) or len(poly) < 3 or not all(_point_ok(p) for p in poly):
                    errors.append(f"rooms '{item.get('id')}': polygon needs at least three normalized points")
                else:
                    pts = [[float(p[0]), float(p[1])] for p in poly]
                    if not polygon_simple(pts):  # first: a bow-tie also has (near) zero signed area
                        errors.append(f"rooms '{item.get('id')}': polygon intersects itself")
                    elif polygon_area(pts) <= 1e-9:
                        errors.append(f"rooms '{item.get('id')}': polygon is degenerate (zero area)")
                if item.get("kind") not in ROOM_KINDS:
                    errors.append(f"rooms '{item.get('id')}': kind must be one of {sorted(ROOM_KINDS)}")
            elif coll == "connectors":
                if not _point_ok(item.get("position")):
                    errors.append(f"connectors '{item.get('id')}': position must be a normalized point")
                if item.get("kind") not in CONNECTOR_KINDS:
                    errors.append(f"connectors '{item.get('id')}': kind must be one of {sorted(CONNECTOR_KINDS)}")
    unc = doc.get("uncertainty") or {}
    if not _unit(unc.get("overall")):
        errors.append("uncertainty.overall must be in [0, 1]")
    if not isinstance(unc.get("notes"), list):
        errors.append("uncertainty.notes must be a list")
    return errors


def canonical_json(doc: dict[str, Any]) -> str:
    """Deterministic serialization (sorted keys, fixed separators, floats rounded to 6 digits): two exports of the same
    version produce byte-identical text, which is what a deterministic renderer needs as input."""

    def norm(v: Any) -> Any:
        if isinstance(v, float):
            return round(v, 6)
        if isinstance(v, dict):
            return {k: norm(v[k]) for k in sorted(v)}
        if isinstance(v, list):
            return [norm(x) for x in v]
        return v

    return json.dumps(norm(doc), ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def export_version(conn: sqlite3.Connection, version_id: str) -> dict[str, Any]:
    """Build the document for one plan version from what the VMS actually knows: the asset hash and page, the derived
    image size, rotation and crop, the floor's rooms / zones (with their provenance), the doors known from placed HA
    door entities. Walls and windows are not detected today and stay empty; the notes say so."""
    v = conn.execute("SELECT * FROM plan_versions WHERE id = ?", (version_id,)).fetchone()
    if not v:
        raise KeyError(version_id)
    asset = conn.execute("SELECT * FROM plan_assets WHERE id = ?", (v["asset_id"],)).fetchone()
    crop = json.loads(v["crop_json"]) if v["crop_json"] else None
    rooms = []
    for z in conn.execute("SELECT * FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY created_at", (v["floor_id"],)).fetchall():
        poly = json.loads(z["polygon_json"])
        rooms.append({
            "id": f"room:{z['id']}", "name": z["name"], "kind": z["kind"], "polygon": [[float(p["x"]), float(p["y"])] for p in poly],
            "confidence": 0.9 if z["source"] == "manual" else 0.6, "source": z["source"],
        })
    doors = []
    for a in conn.execute(
        "SELECT a.resource_id, a.x, a.y, e.device_class, e.domain FROM map_anchors a LEFT JOIN ha_entities e ON e.entity_id = a.resource_id "
        "WHERE a.floor_id = ? AND a.resource_type = 'ha_entity' AND a.effective_to IS NULL ORDER BY a.resource_id",
        (v["floor_id"],),
    ).fetchall():
        if a["domain"] == "lock" or (a["device_class"] or "") in ("door", "opening", "garage_door", "gate") or a["resource_id"].startswith("binary_sensor.") and "door" in a["resource_id"]:
            doors.append({"id": f"door:{a['resource_id']}", "position": [float(a["x"]), float(a["y"])], "wall_id": None, "width_px": None, "entity_id": a["resource_id"], "confidence": 0.7, "source": "manual"})
    scale = v["scale_m_per_px"]
    calibration = {"status": "measured", "reason": "scale entered with the version"} if scale else {"status": "missing", "reason": "no scale was entered for this version; distances are in plan units only"}
    notes = ["walls and windows are not detected by this build; the stylized rendering is a picture, not geometry"]
    if not rooms:
        notes.append("no rooms or zones defined on this floor")
    if not scale:
        notes.append("calibration missing")
    overall = 0.35 if scale else 0.6
    if not rooms:
        overall = min(1.0, overall + 0.2)
    return {
        "schema_version": SCHEMA_VERSION,
        "plan_version_id": v["id"],
        "floor_id": v["floor_id"],
        "generated_at": iso_utc(parse_utc(v["created_at"])),
        "source": {"sha256": asset["sha256"] if asset else "0" * 64, "file_name": asset["original_name"] if asset else "", "mime": asset["mime"] if asset else "", "page": int(v["page"])},
        "dimensions": {"width_px": int(v["width_px"]), "height_px": int(v["height_px"]), "scale_m_per_px": scale, "calibration": calibration},
        "transform": {"rotation": int(v["rotation"]), "crop": crop},
        "walls": [], "doors": doors, "windows": [], "rooms": rooms, "connectors": [],
        "uncertainty": {"overall": overall, "notes": notes},
    }
