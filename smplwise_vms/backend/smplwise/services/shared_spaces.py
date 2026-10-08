"""Shared space (CR-009, T097): one room (a spatial zone) that belongs to two floors - the owner's double-height sports
hall, reachable from floor 0 and from the court on floor -1. The zone's own floor is the HOME floor: its plan document
keeps the room's walls, openings, objects (tribunes), labels, connectors, circuits and groups, and its anchors are the
room's cameras and devices. The OTHER floor stores nothing but a `shared_spaces` row (migration 0038).

This module is the only place that knows about shares:

- the placement maths (home plan -> other plan) and the membership rule ("inside the room"), shared by every path;
- attach-on-read: the home subset transformed onto the other floor, ids namespaced "<home_floor_id>:<id>", marked
  `shared` - computed on every read like geometry_store.attach_far, never stored, never hashed (strip);
- the write routing of an edit made from the other floor to the home floor's draft (route_edits);
- the reach helper every permission site calls (mirrored_anchor_floors and friends) - rbac, access, ha_scope, events,
  search and the site tree add nothing of their own;
- the conversion of the owner's two drawings of one room into a shared one (preview / apply).

It imports nothing from rbac or the routers at module level: rbac.camera_floors calls into it."""
from __future__ import annotations

import copy
import hashlib
import json
import math
import sqlite3
from dataclasses import dataclass
from typing import Any, Callable, Iterable

from . import wall_path

# The membership tolerances, in metres: a wall or connector point within this of the room's outline is inside (the
# room's own walls lie on it); a point item (object, label, anchor) within POINT_TOL_M.
WALL_TOL_M = 0.3
POINT_TOL_M = 0.05
# a clipped piece of a wall that crosses the outline shorter than this many wall tolerances is the stub of an adjoining
# wall touching the room, not a part of it
MIN_PIECE_TOLS = 2.0
# the room's CONTENT, shared between its floors (two-outline model: walls and openings stay each floor's own)
SHARED_COLLECTIONS = ("objects", "labels", "connectors", "circuits", "groups")
# every collection an attached item could be marked in (split / strip never let a marked item through)
MARKED_COLLECTIONS = ("walls", "openings", *SHARED_COLLECTIONS)
LABEL_PREFIX = "רצפה בקומה"
# Members (B1, CR-009 §13): what a shared space lists. Cameras and HA entities are ANCHORED resources (reach follows a live
# anchor on one of the room's floors, N1); a WisKey station has no anchor and no floor (installation-scoped), so it is a
# member of the room's LIST only - it adds no reach anywhere (see `station_visible`).
ANCHORED_TYPES = ("camera", "ha_entity")
STATION = "wiskey_station"
MEMBER_TYPES = (*ANCHORED_TYPES, STATION)
MAX_STATION_ID = 128  # WisKey's own limit (routers/access_control.MAX_STATION_ID)


# ---------------------------------------------------------------- rows

@dataclass(frozen=True)
class Share:
    id: str
    zone_id: str
    home_floor_id: str
    floor_id: str
    placement: dict[str, Any]
    revision: int
    created_at: str
    zone_name: str
    zone_polygon: list[dict[str, float]]
    zone_revision: int
    zone_level_id: str | None
    other_zone_id: str | None = None


def _rows(conn: sqlite3.Connection, where: str, args: Iterable[Any], at: str | None = None) -> list[Share]:
    live = "s.created_at <= ? AND (s.removed_at IS NULL OR s.removed_at > ?)" if at else "s.removed_at IS NULL"
    try:
        rows = conn.execute(
            "SELECT s.*, z.name AS zone_name, z.polygon_json, z.revision AS zone_revision, z.level_id AS zone_level_id FROM shared_spaces s "
            "JOIN spatial_zones z ON z.id = s.zone_id AND z.floor_id = s.home_floor_id AND z.deleted_at IS NULL "
            "JOIN floors hf ON hf.id = s.home_floor_id AND hf.deleted_at IS NULL JOIN floors of ON of.id = s.floor_id AND of.deleted_at IS NULL "
            f"WHERE {live}{' AND ' + where if where else ''} ORDER BY s.created_at, s.id", (*((at, at) if at else ()), *args)).fetchall()
    except sqlite3.OperationalError:  # a database from before migration 0038 (tests keep older schemas on purpose)
        return []
    out: list[Share] = []
    for r in rows:
        try:
            placement = json.loads(r["placement_json"])
            polygon = json.loads(r["polygon_json"])
        except ValueError:
            continue
        if not isinstance(polygon, list) or len(polygon) < 3:
            continue
        out.append(Share(r["id"], r["zone_id"], r["home_floor_id"], r["floor_id"], placement if isinstance(placement, dict) else {"mode": "same_frame"},
                         int(r["revision"]), r["created_at"], r["zone_name"] or "", polygon, int(r["zone_revision"]), r["zone_level_id"],
                         r["other_zone_id"] if "other_zone_id" in r.keys() else None))
    return out


def ensure_schema(conn: sqlite3.Connection) -> list[str]:
    """Re-review low: migration 0038 changed while the branch was open (other_zone_id inside CREATE TABLE, the members
    table). A database that already recorded the first 0038 never runs it again, so this idempotent guard, run at start
    after the migrations, adds what is missing. Returns what it added."""
    added: list[str] = []
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(shared_spaces)").fetchall()}
    except sqlite3.OperationalError:
        return added
    if not cols:
        return added  # before 0038: the migration itself creates everything
    if "other_zone_id" not in cols:
        conn.execute("ALTER TABLE shared_spaces ADD COLUMN other_zone_id TEXT REFERENCES spatial_zones(id)")
        added.append("shared_spaces.other_zone_id")
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shared_space_members'").fetchone() is None:
        from pathlib import Path

        sql = next(iter(sorted((Path(__file__).resolve().parent.parent / "migrations").glob("*_shared_spaces.sql")))).read_text(encoding="utf-8")
        conn.executescript(sql)  # every statement there is IF NOT EXISTS
        added.append("shared_space_members")
    row = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'shared_space_members'").fetchone()
    if row is not None and STATION not in (row[0] or ""):
        _widen_members(conn)  # CR-009 §13: a database that ran 0038 before WisKey stations could be members
        added.append("shared_space_members.wiskey_station")
    return added


def _widen_members(conn: sqlite3.Connection) -> None:
    """SQLite cannot alter a CHECK: the members table is rebuilt (rows copied, its indexes and triggers recreated from the
    migration text, every statement IF NOT EXISTS) in one transaction, all or nothing."""
    from pathlib import Path

    sql = next(iter(sorted((Path(__file__).resolve().parent.parent / "migrations").glob("*_shared_spaces.sql")))).read_text(encoding="utf-8")
    cols = "id, zone_id, resource_type, resource_id, added_by, added_at, removed_at, removed_by"
    script = (
        "BEGIN;\n"
        "DROP TRIGGER IF EXISTS trg_cv_shared_members_ins;\nDROP TRIGGER IF EXISTS trg_cv_shared_members_upd;\nDROP TRIGGER IF EXISTS trg_cv_shared_members_del;\n"
        "DROP INDEX IF EXISTS ux_shared_members_active;\nDROP INDEX IF EXISTS idx_shared_members_resource;\n"
        "ALTER TABLE shared_space_members RENAME TO shared_space_members_old;\n"
        f"{sql}\n"
        f"INSERT INTO shared_space_members({cols}) SELECT {cols} FROM shared_space_members_old;\n"
        "DROP TABLE shared_space_members_old;\nCOMMIT;"
    )
    # a failure leaves the script's own BEGIN open and raises through the caller's `db.connection()`, which rolls it back
    # (the write gate is released there) - nothing is committed half way
    conn.executescript(script)


def any_active(conn: sqlite3.Connection) -> bool:
    try:
        return conn.execute("SELECT 1 FROM shared_spaces WHERE removed_at IS NULL LIMIT 1").fetchone() is not None
    except sqlite3.OperationalError:
        return False


def shares_of_floor(conn: sqlite3.Connection, floor_id: str, at: str | None = None) -> list[Share]:
    """The rooms another floor shares with this one (this floor is the OTHER floor)."""
    return _rows(conn, "s.floor_id = ?", (floor_id,), at)


def shares_from_floor(conn: sqlite3.Connection, floor_id: str, at: str | None = None) -> list[Share]:
    """The rooms of this floor shared with other floors (this floor is the HOME floor)."""
    return _rows(conn, "s.home_floor_id = ?", (floor_id,), at)


def shares_of_zone(conn: sqlite3.Connection, zone_id: str) -> list[Share]:
    return _rows(conn, "s.zone_id = ?", (zone_id,))


def all_shares(conn: sqlite3.Connection) -> list[Share]:
    return _rows(conn, "", ())


def shared_zone_floors(conn: sqlite3.Connection, zone_id: str) -> list[str]:
    """The other floors a room is shown on (its home floor excluded)."""
    return [s.floor_id for s in shares_of_zone(conn, zone_id)]


# ---------------------------------------------------------------- geometry

Pt = tuple[float, float]


def _inside(p: Pt, poly: list[Pt]) -> bool:
    x, y = p
    hit = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-300) + xi:
            hit = not hit
        j = i
    return hit


def _seg_dist(p: Pt, a: Pt, b: Pt) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = dx * dx + dy * dy
    t = 0.0 if n <= 1e-18 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / n))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def _outline_dist(p: Pt, poly: list[Pt]) -> float:
    return min(_seg_dist(p, poly[i - 1], poly[i]) for i in range(len(poly)))


def near(p: Pt, poly: list[Pt], tol: float) -> bool:
    """Inside the polygon or within `tol` of its outline (plan pixels)."""
    return _inside(p, poly) or _outline_dist(p, poly) <= tol


def _seg_cross(a: Pt, b: Pt, c: Pt, d: Pt) -> float | None:
    """The parameter along a->b where it properly crosses c->d, or None (parallel or apart)."""
    rx, ry = b[0] - a[0], b[1] - a[1]
    sx, sy = d[0] - c[0], d[1] - c[1]
    den = rx * sy - ry * sx
    if abs(den) < 1e-12:
        return None
    t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den
    u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den
    return t if -1e-9 <= t <= 1 + 1e-9 and -1e-9 <= u <= 1 + 1e-9 else None


def clip_intervals(pts: list[Pt], poly: list[Pt], tol: float) -> tuple[list[tuple[float, float]], float]:
    """The arc-length intervals of a polyline that lie inside the room (near(), tolerance `tol`), and its length. Each
    segment is cut where it crosses the outline and where a polygon corner projects onto it within the tolerance (a
    wall running along the outline and past the room's corner ends there); each piece is judged by its midpoint."""
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    total = cum[-1]
    pieces: list[tuple[float, float]] = []
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        seg = cum[i] - cum[i - 1]
        if seg <= 1e-9:
            continue
        ts = {0.0, 1.0}
        for k in range(len(poly)):
            t = _seg_cross(a, b, poly[k - 1], poly[k])
            if t is not None:
                ts.add(min(1.0, max(0.0, t)))
            v = poly[k]
            dx, dy = b[0] - a[0], b[1] - a[1]
            t2 = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / (seg * seg)
            if 0.0 < t2 < 1.0 and _seg_dist(v, a, b) <= tol:
                ts.add(t2)
        order = sorted(ts)
        for t0, t1 in zip(order, order[1:]):
            if t1 - t0 <= 1e-9:
                continue
            tm = (t0 + t1) / 2
            if near((a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm), poly, tol):
                s0, s1 = cum[i - 1] + t0 * seg, cum[i - 1] + t1 * seg
                if pieces and abs(pieces[-1][1] - s0) < 1e-6:
                    pieces[-1] = (pieces[-1][0], s1)
                else:
                    pieces.append((s0, s1))
    return pieces, total


def _sub_polyline(pts: list[Pt], s0: float, s1: float) -> list[Pt]:
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))

    def at(s: float) -> Pt:
        i = 1
        while i < len(pts) - 1 and s > cum[i]:
            i += 1
        seg = cum[i] - cum[i - 1]
        f = 0.0 if seg <= 1e-12 else min(1.0, max(0.0, (s - cum[i - 1]) / seg))
        return (pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f)

    inner = [pts[i] for i in range(1, len(pts) - 1) if s0 < cum[i] < s1]
    return [at(s0), *inner, at(s1)]


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _r6(v: float) -> float:
    return round(float(v), 6) + 0.0


class Placement:
    """Home plan -> other plan, on normalized 0..1 points. same_frame is the identity; fit maps in "width units" (x as a
    fraction of the plan width, y scaled by height / width, so a rotation keeps shapes whatever the aspect):
    b = to + k · R(r) · (a − from), k = other-plan widths per home-plan width. `from` / `to` are fixed points, so a
    polygon edit never shifts the mirror."""

    def __init__(self, raw: dict[str, Any], home_dims: tuple[float, float], other_dims: tuple[float, float]) -> None:
        self.same = raw.get("mode") != "fit"
        self.ha = home_dims[1] / home_dims[0] if home_dims[0] else 1.0
        self.hb = other_dims[1] / other_dims[0] if other_dims[0] else 1.0
        frm = raw.get("from") if isinstance(raw.get("from"), list) and len(raw["from"]) == 2 else [0.5, 0.5]
        to = raw.get("to") if isinstance(raw.get("to"), list) and len(raw["to"]) == 2 else [0.5, 0.5]
        self.fx, self.fy = float(frm[0]), float(frm[1])
        self.tx, self.ty = float(to[0]), float(to[1])
        self.rotation = float(raw.get("rotation_deg") or 0.0) if not self.same else 0.0
        k = raw.get("scale")
        self.k = float(k) if _num(k) and k > 0 else 1.0
        t = math.radians(self.rotation)
        self.c, self.s = math.cos(t), math.sin(t)

    def fwd(self, x: float, y: float) -> Pt:
        if self.same:
            return (x, y)
        dx, dy = x - self.fx, (y - self.fy) * self.ha
        rx, ry = self.c * dx - self.s * dy, self.s * dx + self.c * dy
        return (self.tx + self.k * rx, (self.ty * self.hb + self.k * ry) / self.hb)

    def inv(self, x: float, y: float) -> Pt:
        if self.same:
            return (x, y)
        dx, dy = (x - self.tx) / self.k, (y * self.hb - self.ty * self.hb) / self.k
        rx, ry = self.c * dx + self.s * dy, -self.s * dx + self.c * dy
        return (self.fx + rx, self.fy + ry / self.ha)

    def pt(self, p: Any) -> list[float]:
        q = self.fwd(float(p[0]), float(p[1]))
        return [_r6(q[0]), _r6(q[1])]

    def ipt(self, p: Any) -> list[float]:
        q = self.inv(float(p[0]), float(p[1]))
        return [_r6(q[0]), _r6(q[1])]

    def angle(self, deg: Any) -> float:
        return round((float(deg or 0) + self.rotation) % 360, 3)

    def iangle(self, deg: Any) -> float:
        return round((float(deg or 0) - self.rotation) % 360, 3)


def _dims_of(version: sqlite3.Row | dict[str, Any] | None, doc: dict[str, Any] | None = None) -> tuple[float, float]:
    if doc is not None and isinstance(doc.get("dimensions"), dict) and doc["dimensions"].get("width_px"):
        return float(doc["dimensions"]["width_px"]), float(doc["dimensions"]["height_px"])
    if version is not None:
        return float(version["width_px"]), float(version["height_px"])
    return 1000.0, 1000.0


def _scale_of_version(version: sqlite3.Row) -> float:
    """Metres per pixel of a plan version as the documents compute it (plan_geometry.effective_scale)."""
    from . import plan_geometry as pg

    cal = pg.calibration_of(version, None)
    return pg.effective_scale({"dimensions": {"width_px": int(version["width_px"]), "height_px": int(version["height_px"]), "scale_m_per_px": version["scale_m_per_px"], "calibration": cal}})[0]


def poly_px(polygon: list[dict[str, float]], w: float, h: float) -> list[Pt]:
    return [(float(p["x"]) * w, float(p["y"]) * h) for p in polygon]


# ---------------------------------------------------------------- the room's subset of a home document

def _level_ids(doc: dict[str, Any]) -> tuple[set[str], str]:
    ids = {lv["id"] for lv in doc.get("levels") or [] if isinstance(lv, dict) and isinstance(lv.get("id"), str)}
    default = next((lv["id"] for lv in doc.get("levels") or [] if isinstance(lv, dict) and lv.get("is_default")), "L0")
    return ids, default


def _region(region: Any) -> list[list[dict[str, float]]]:
    """One outline or a list of outlines (the two-outline model: the room's region is their union)."""
    return [region] if region and isinstance(region[0], dict) else [p for p in region or [] if p]


def room_subset(doc: dict[str, Any], region: Any, zone_id: str | None = None) -> dict[str, list[dict[str, Any]]]:
    """The items of a home document inside the room, in home coordinates with their own ids. Room walls (wholly
    inside) and their openings are editable; the inside pieces of a wall that crosses the outline are read-only copies
    ("<id>#<n>", `_clip` = the piece) with the openings whose centre falls on them. Objects, labels: by their position;
    same-floor connectors wholly inside and the derived connectors of included objects; circuits and groups whose
    members are all included. Every item carries `_readonly` (bool); nothing is copied from the document by reference.
    Re-review N3: the region's FIRST outline (the home outline) holds content by geometry; the other outlines (the upper
    level brought home) only hold an item that carries `shared_space_id` == `zone_id` - the home floor's own items under
    the overhang, on its own level (a storage room under the tribune), stay its own."""
    from . import plan_geometry as pg

    dims = doc.get("dimensions") or {}
    w, h = float(dims.get("width_px") or 1000), float(dims.get("height_px") or 1000)
    scale, _ = pg.effective_scale(doc)
    polys = [poly_px(p, w, h) for p in _region(region)]
    poly = polys[0]  # walls are clipped to the room's own outline on this floor; content may lie in any outline
    ptol = POINT_TOL_M / scale

    def member(item: dict[str, Any], pts: list[Pt], tol: float) -> bool:
        if all(near(q, poly, tol) for q in pts):
            return True
        return zone_id is not None and item.get("shared_space_id") == zone_id and all(any(near(q, p, tol) for p in polys) for q in pts)
    out: dict[str, list[dict[str, Any]]] = {c: [] for c in MARKED_COLLECTIONS}
    by_wall: dict[str, list[dict[str, Any]]] = {}
    for o in doc.get("openings") or []:
        if isinstance(o, dict) and isinstance(o.get("wall_id"), str):
            by_wall.setdefault(o["wall_id"], []).append(o)
    for wall in doc.get("walls") or []:
        if not isinstance(wall, dict) or not isinstance(wall.get("id"), str) or not isinstance(wall.get("polyline"), list) or len(wall["polyline"]) < 2:
            continue
        try:
            # a curved wall is clipped along its sampled path (wall_path); a clipped piece is read-only and straight
            pts = [(x * w, y * h) for x, y in wall_path.sampled_wall(wall, w, h)] if wall_path.is_curved(wall) else \
                [(float(p[0]) * w, float(p[1]) * h) for p in wall["polyline"]]
        except (TypeError, ValueError, IndexError):
            continue
        thick = wall.get("thickness_m") if _num(wall.get("thickness_m")) else pg.DEFAULT_WALL_THICKNESS_M
        tol = max(float(thick), WALL_TOL_M) / scale
        pieces, total = clip_intervals(pts, poly, tol)
        if total <= 1e-9 or not pieces:
            continue
        if len(pieces) == 1 and pieces[0][0] <= 1e-6 and pieces[0][1] >= total - 1e-6:
            out["walls"].append({**copy.deepcopy(wall), "_readonly": False})
            for o in by_wall.get(wall["id"], []):
                out["openings"].append({**copy.deepcopy(o), "_readonly": False})
            continue
        n = 0
        for s0, s1 in pieces:
            if s1 - s0 < MIN_PIECE_TOLS * tol:
                continue
            n += 1
            pid = f"{wall['id']}#{n}"
            sub = _sub_polyline(pts, s0, s1)
            piece = {**copy.deepcopy(wall), "id": pid, "polyline": [[_r6(x / w), _r6(y / h)] for x, y in sub], "_readonly": True, "_clip": [s0 / total, s1 / total]}
            piece.pop("bulges", None)
            out["walls"].append(piece)
            for o in by_wall.get(wall["id"], []):
                c = float(o.get("t") or 0) * total
                if s0 <= c <= s1:
                    out["openings"].append({**copy.deepcopy(o), "wall_id": pid, "t": round((c - s0) / (s1 - s0), 6), "_readonly": True})
    included: set[str] = set()
    for o in doc.get("objects") or []:
        if isinstance(o, dict) and isinstance(o.get("id"), str) and isinstance(o.get("position"), list) and len(o["position"]) == 2 and _num(o["position"][0]) and _num(o["position"][1]):
            if member(o, [(float(o["position"][0]) * w, float(o["position"][1]) * h)], ptol):
                out["objects"].append({**copy.deepcopy(o), "_readonly": False})
                included.add(o["id"])
    for lb in doc.get("labels") or []:
        if isinstance(lb, dict) and isinstance(lb.get("id"), str) and isinstance(lb.get("position"), list) and len(lb["position"]) == 2 and _num(lb["position"][0]) and _num(lb["position"][1]):
            if member(lb, [(float(lb["position"][0]) * w, float(lb["position"][1]) * h)], ptol):
                out["labels"].append({**copy.deepcopy(lb), "_readonly": False})
    ctol = WALL_TOL_M / scale
    for c in doc.get("connectors") or []:
        if not isinstance(c, dict) or not isinstance(c.get("id"), str) or c.get("floor_ids"):
            continue  # stairs to another floor are not mirrored: each floor has its own twin
        if pg._is_derived_connector(c):
            if c.get("object_id") in included:
                out["connectors"].append({**copy.deepcopy(c), "_readonly": True})  # regenerated from its object
            continue
        pl = c.get("polyline")
        if isinstance(pl, list) and len(pl) >= 2 and all(isinstance(p, list) and len(p) == 2 and _num(p[0]) and _num(p[1]) for p in pl) \
                and member(c, [(float(p[0]) * w, float(p[1]) * h) for p in pl], ctol):
            out["connectors"].append({**copy.deepcopy(c), "_readonly": False})
    for coll in ("circuits", "groups"):
        for k in doc.get(coll) or []:
            members = k.get("member_ids") if isinstance(k, dict) else None
            if isinstance(k, dict) and isinstance(k.get("id"), str) and isinstance(members, list) and members and all(m in included for m in members):
                out[coll].append({**copy.deepcopy(k), "_readonly": False})
    return out


def region_of(conn: sqlite3.Connection, share: Share, place: Placement) -> list[list[dict[str, float]]]:
    """The room's region in HOME coordinates: its home outline, and the other floor's own outline brought back through
    the placement (two-outline model: the hall is wider at the upper level, and the tribunes' upper rows lie outside
    the court's outline). The content of the room is what lies inside either."""
    out = [share.zone_polygon]
    if share.other_zone_id:
        z = conn.execute("SELECT polygon_json FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (share.other_zone_id,)).fetchone()
        if z is not None:
            try:
                out.append([{"x": _r6(q[0]), "y": _r6(q[1])} for q in (place.inv(float(p["x"]), float(p["y"])) for p in json.loads(z["polygon_json"]))])
            except (ValueError, TypeError, KeyError):
                pass
    return out


# ---------------------------------------------------------------- projection onto the other floor (and back)

def ns(home_floor_id: str, item_id: str) -> str:
    return f"{home_floor_id}:{item_id}"


def un_ns(home_floor_id: str, item_id: Any) -> Any:
    prefix = f"{home_floor_id}:"
    return item_id[len(prefix):] if isinstance(item_id, str) and item_id.startswith(prefix) else item_id


def _marker(share: Share, readonly: bool = False) -> dict[str, Any]:
    m: dict[str, Any] = {"zone_id": share.zone_id, "home_floor_id": share.home_floor_id}
    if readonly:
        m["readonly"] = True
    return m


def project(sub: dict[str, list[dict[str, Any]]], share: Share, place: Placement, level_ids: set[str], default_level: str) -> dict[str, list[dict[str, Any]]]:
    """The subset as the other floor shows it: points through the placement, rotations turned, every id and reference
    to another item or level namespaced, each item marked `shared`."""
    H = share.home_floor_id

    def lvl(v: Any) -> str:
        return ns(H, v if isinstance(v, str) and v in level_ids else default_level)

    out: dict[str, list[dict[str, Any]]] = {c: [] for c in sub}
    for coll, items in sub.items():
        for it in items:
            x = {k: v for k, v in it.items() if not k.startswith("_")}
            x["id"] = ns(H, it["id"])
            x["shared"] = _marker(share, bool(it.get("_readonly")))
            if it.get("_readonly") and coll == "walls":
                x["locked"] = True  # a piece of a wall of the rest of the home floor: edited there only
            if coll in ("walls", "connectors") and isinstance(x.get("polyline"), list):
                x["polyline"] = [place.pt(p) for p in x["polyline"]]
            if coll in ("objects", "labels") and isinstance(x.get("position"), list):
                x["position"] = place.pt(x["position"])
            if coll == "objects":
                x["rotation_deg"] = place.angle(x.get("rotation_deg"))
                if isinstance(x.get("group_id"), str):
                    x["group_id"] = ns(H, x["group_id"])
                params = x.get("params")
                if isinstance(params, dict) and isinstance(params.get("connects_levels"), str):
                    x["params"] = {**params, "connects_levels": lvl(params["connects_levels"])}
            if coll in ("walls", "objects", "labels"):
                x["level_id"] = lvl(x.get("level_id"))
            if coll == "openings":
                x["wall_id"] = ns(H, x.get("wall_id"))
            if coll == "connectors":
                x["level_from"] = lvl(x.get("level_from"))
                x["level_to"] = lvl(x["level_to"]) if isinstance(x.get("level_to"), str) else None
                if isinstance(x.get("object_id"), str):
                    x["object_id"] = ns(H, x["object_id"])
            if coll in ("circuits", "groups") and isinstance(x.get("member_ids"), list):
                x["member_ids"] = [ns(H, m) for m in x["member_ids"]]
            out[coll].append(x)
    return out


def unproject(coll: str, item: dict[str, Any], share: Share, place: Placement, level_ids: set[str], default_level: str) -> dict[str, Any]:
    """An item edited on the other floor, back in home coordinates with home ids (the marker dropped). A level of the
    other floor itself (a new item drawn on one of its own levels) becomes the home default level."""
    H = share.home_floor_id

    def lvl(v: Any) -> str:
        u = un_ns(H, v)
        return u if isinstance(u, str) and u in level_ids else default_level

    x = {k: v for k, v in item.items() if k not in ("shared", "far")}
    x["id"] = un_ns(H, x.get("id"))
    if coll in ("walls", "connectors") and isinstance(x.get("polyline"), list):
        x["polyline"] = [place.ipt(p) for p in x["polyline"]]
    if coll in ("objects", "labels") and isinstance(x.get("position"), list):
        x["position"] = place.ipt(x["position"])
    if coll == "objects":
        x["rotation_deg"] = place.iangle(x.get("rotation_deg"))
        if isinstance(x.get("group_id"), str):
            x["group_id"] = un_ns(H, x["group_id"])
        params = x.get("params")
        if isinstance(params, dict) and isinstance(params.get("connects_levels"), str):
            x["params"] = {**params, "connects_levels": lvl(params["connects_levels"])}
    if coll in ("walls", "objects", "labels"):
        x["level_id"] = lvl(x.get("level_id"))
    if coll == "openings":
        x["wall_id"] = un_ns(H, x.get("wall_id"))
    if coll == "connectors":
        x["level_from"] = lvl(x.get("level_from"))
        x["level_to"] = lvl(x["level_to"]) if isinstance(x.get("level_to"), str) else None
        if isinstance(x.get("object_id"), str):
            x["object_id"] = un_ns(H, x["object_id"])
    if coll in ("circuits", "groups") and isinstance(x.get("member_ids"), list):
        x["member_ids"] = [un_ns(H, m) for m in x["member_ids"]]
    return x


# ---------------------------------------------------------------- the home side of a read

@dataclass
class HomeView:
    version: sqlite3.Row | None
    row: sqlite3.Row | None
    doc: dict[str, Any] | None
    revision: int


def home_view(conn: sqlite3.Connection, floor_id: str, mode: str, at: str | None = None) -> HomeView:
    """The home floor's document of the same kind as the read: "draft" - its editor document (prepared, as the editor
    there works on it), "published" - its published structure, "at" - the one published at the instant."""
    from . import geometry_store as store

    if mode == "draft":
        v = store.editor_version(conn, floor_id)
        if v is None:
            return HomeView(None, None, None, 0)
        doc, row = store.working_doc(conn, v)
        return HomeView(v, row, doc, row["revision"] if row is not None else 0)
    if mode == "at" and at:
        v = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status != 'draft' AND published_at IS NOT NULL AND published_at <= ? "
                         "AND (archived_at IS NULL OR archived_at > ?) ORDER BY published_at DESC LIMIT 1", (floor_id, at, at)).fetchone()
        row = store.at_row(conn, v["id"], at) if v is not None else None
    else:
        v = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()
        row = store.published_row(conn, v["id"]) if v is not None else None
    return HomeView(v, row, store.load_doc(row) if row is not None else None, row["revision"] if row is not None else 0)


def _floor(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, name, level, building_id FROM floors WHERE id = ?", (floor_id,)).fetchone()


def surface_label(level: Any) -> str:
    return f"{LABEL_PREFIX} {level}"


def _default_ceiling(doc: dict[str, Any] | None) -> float:
    from . import plan_geometry as pg

    for lv in (doc or {}).get("levels") or []:
        if isinstance(lv, dict) and lv.get("is_default") and _num(lv.get("ceiling_height_m")):
            return float(lv["ceiling_height_m"])
    return pg.DEFAULT_CEILING_M


def _datum(conn: sqlite3.Connection, me_id: str, own_doc: dict[str, Any], far_id: str, published: bool) -> float | None:
    """The other floor's datum above this one (floor heights, geometry_store.FarContext.datum); None across buildings."""
    from . import geometry_store as store
    from . import plan_geometry as pg

    me, far = _floor(conn, me_id), _floor(conn, far_id)
    if me is None or far is None or me["building_id"] != far["building_id"]:
        return None
    return store.FarContext(conn, published=published).datum(me, pg.floor_height(own_doc), far)


_SUBSET_CACHE: dict[tuple[Any, ...], tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]] = {}
_SUBSET_MAX = 256
OTHER_FLOOR = "קומה אחרת"
UPPER_LABEL = "מפלס עליון"
LOWER_LABEL = "מפלס תחתון"


def _outline_zone(conn: sqlite3.Connection, zone_id: str | None) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zone_id,)).fetchone() if zone_id else None


def _mirror_content(conn: sqlite3.Connection, s: Share, hv: "HomeView", place: Placement, other_zone: sqlite3.Row | None, circuits: bool,
                    datum: float | None, readable: bool) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    """The home floor's content inside the room's region, projected onto the other floor, and the home levels it uses
    (namespaced, at the home datum). Security review M6: memoized for stored documents on everything it depends on
    (the home row's hash, the share and both outlines' revisions, the other plan's size, the datum, the reader's name
    right) - a repeated read, and every 304, parses nothing. Review L1: only the levels the content uses, and the home
    floor named only to a reader who may read it."""
    key = None
    home_row = _floor(conn, s.home_floor_id)
    if hv.row is not None and hv.row["status"] != "draft":
        # re-review low: the home floor's name is in the levels' names - a rename must not serve a stale cached copy
        key = (hv.row["doc_hash"], s.id, s.revision, s.zone_revision, other_zone["revision"] if other_zone is not None else None,
               place.hb, place.ha, circuits, datum, readable, home_row["name"] if home_row is not None else None)
        hit = _SUBSET_CACHE.get(key)
        if hit is not None:
            return copy.deepcopy(hit[0]), copy.deepcopy(hit[1])
    level_ids, default_level = _level_ids(hv.doc)
    sub = room_subset(hv.doc, region_of(conn, s, place), s.zone_id)
    for coll in ("walls", "openings"):
        sub[coll] = []  # two-outline model: each floor's walls bound the hall at that floor and stay its own
    if not circuits:
        sub["circuits"] = []
    proj = project(sub, s, place, level_ids, default_level)
    used = {un_ns(s.home_floor_id, it.get(k)) for items in proj.values() for it in items for k in ("level_id", "level_from", "level_to") if isinstance(it.get(k), str)}
    used |= {un_ns(s.home_floor_id, (it.get("params") or {}).get("connects_levels")) for it in proj.get("objects", []) if isinstance((it.get("params") or {}).get("connects_levels"), str)}
    fname = home_row["name"] if home_row is not None and readable else OTHER_FLOOR
    levels = []
    for lv in hv.doc.get("levels") or []:
        if isinstance(lv, dict) and lv.get("id") in used:
            elev = float(lv["elevation_m"]) if _num(lv.get("elevation_m")) else 0.0
            levels.append({"id": ns(s.home_floor_id, lv["id"]), "name": f"{lv.get('name') or lv['id']} · {fname}", "elevation_m": round(elev + (datum or 0.0), 4),
                           "ceiling_height_m": lv.get("ceiling_height_m"), "is_default": False, "external_ids": {}, "shared": {"home_floor_id": s.home_floor_id, "zone_id": s.zone_id}})
    if key is not None:
        if len(_SUBSET_CACHE) >= _SUBSET_MAX:
            _SUBSET_CACHE.clear()
        _SUBSET_CACHE[key] = (copy.deepcopy(proj), copy.deepcopy(levels))
    return proj, levels


def attach(conn: sqlite3.Connection, floor_id: str, doc: dict[str, Any], mode: str = "published", at: str | None = None, *,
           can_attach: Callable[[str], bool] | None = None, circuits: bool = True, can_name: Callable[[str], bool] | None = None) -> dict[str, Any]:
    """A copy of `doc` (a document of `floor_id`) with the rooms it shares described in `shared_spaces` and, on a floor
    that is not a room's home, the room's CONTENT attached (objects - tribunes, labels, connectors, circuits, groups -
    namespaced, marked `shared`). Two-outline model: every floor keeps its own outline and walls of the room; an entry
    carries this floor's outline (`polygon`) and the other floor's outline in this plan's coordinates (`other_polygon`,
    drawn dashed: "מפלס עליון" / "מפלס תחתון"), the datum between them, the upper ceiling and this floor's room walls (the
    3D volume), and whether the placement looks right (`aligned`). Computed on every read, never stored (strip()).
    `can_attach(floor)`: False for a reader explicitly denied on that floor - deny wins; `circuits`: False for a
    camera-only reader; `can_name(floor)`: whether the reader may read that floor's name (review L1)."""
    gs = [g for g in groups(conn, at if mode == "at" else None).values() if floor_id in g.floors]
    if not gs:
        return doc
    out = dict(doc)
    for coll in SHARED_COLLECTIONS + ("levels",):
        out[coll] = list(out.get(coll) or [])
    entries: list[dict[str, Any]] = []
    published = mode != "draft"
    me = _floor(conn, floor_id)
    own_dims = _dims_of(None, doc)
    own_levels, own_default = _level_ids(doc)
    taken = {i.get("id") for c in SHARED_COLLECTIONS + ("levels",) for i in out[c] if isinstance(i, dict)}
    for g in gs:
        if can_attach is not None and not all(can_attach(f) for f in g.floors):
            continue
        home = g.shares[0]
        for s in g.shares:
            if floor_id not in (g.home_floor_id, s.floor_id):
                continue
            other_floor = s.floor_id if floor_id == g.home_floor_id else g.home_floor_id
            ofloor = _floor(conn, other_floor)
            if ofloor is None or me is None:
                continue
            readable = can_name is None or can_name(other_floor)
            datum = _datum(conn, floor_id, doc, other_floor, published)
            other_zone = _outline_zone(conn, s.other_zone_id)
            hv = home_view(conn, g.home_floor_id, mode, at)
            if hv.doc is None:
                continue
            place = Placement(s.placement, _dims_of(hv.version, hv.doc), own_dims if floor_id != g.home_floor_id else _dims_of(store_editor_or_published(conn, s.floor_id)))
            upper_ceiling = _default_ceiling(doc) if (datum is not None and datum < 0) else _levels_ceiling(conn, other_floor)
            if floor_id == g.home_floor_id:
                # the home floor: its own room; the other floor's outline brought here (the upper rows of the tribunes)
                poly = home.zone_polygon
                other_poly = [{"x": _r6(q[0]), "y": _r6(q[1])} for q in (place.inv(float(p["x"]), float(p["y"])) for p in json.loads(other_zone["polygon_json"]))] if other_zone is not None else []
                sub = room_subset(doc, poly)
                wall_ids = [w["id"] for w in sub["walls"] if not w.get("_readonly")]
                level_id = s.zone_level_id if s.zone_level_id in own_levels else own_default
                entry_role = "home"
                aligned = alignment_ok(poly, other_poly, (own_dims[0], own_dims[1], 0.0)) if other_poly else True
            else:
                proj, levels = _mirror_content(conn, s, hv, place, other_zone, circuits, datum, readable)
                for coll, items in proj.items():
                    for it in items:
                        if it["id"] not in taken:
                            taken.add(it["id"])
                            out[coll].append(it)
                for lv in levels:
                    if lv["id"] not in taken:
                        taken.add(lv["id"])
                        out["levels"].append(lv)
                lower = [{"x": _r6(q[0]), "y": _r6(q[1])} for q in (place.pt((p["x"], p["y"])) for p in home.zone_polygon)]
                poly = json.loads(other_zone["polygon_json"]) if other_zone is not None else lower
                other_poly = lower if other_zone is not None else []
                sub = room_subset(doc, poly) if other_zone is not None else {"walls": []}
                wall_ids = [w["id"] for w in sub["walls"] if not w.get("_readonly")]
                level_id = own_default
                entry_role = "mirror"
                aligned = alignment_ok(lower, poly, _anchor_tol(conn, floor_id)) if other_zone is not None else True
            below = datum is not None and datum < 0  # the other floor is below: this floor holds the upper outline
            entries.append({
                "zone_id": g.zone_id, "zone_name": s.zone_name, "outline_zone_id": s.other_zone_id if entry_role == "mirror" else g.zone_id,
                "home_floor_id": g.home_floor_id, "home_floor_level": _floor(conn, g.home_floor_id)["level"],
                "home_floor_name": (ofloor["name"] if readable else OTHER_FLOOR) if entry_role == "mirror" else me["name"],
                "role": entry_role, "other_floor_id": other_floor, "other_floor_name": ofloor["name"] if readable else OTHER_FLOOR, "other_floor_level": ofloor["level"],
                "polygon": poly, "other_polygon": other_poly, "other_label": LOWER_LABEL if below else UPPER_LABEL,
                "home_revision": hv.revision if (mode == "draft" and entry_role == "mirror") else None,
                "datum_m": datum, "upper_ceiling_m": upper_ceiling, "level_id": level_id,
                # the room's walls on this floor rise to the other floor's level (lower floor) or stand on their own (upper)
                "volume_height_m": round(datum, 3) if (datum is not None and datum > 0) else None, "wall_ids": wall_ids,
                "aligned": aligned, "label": surface_label(_floor(conn, g.home_floor_id)["level"])})
    out["shared_spaces"] = entries
    return out


def store_editor_or_published(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('published', 'draft') ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, created_at DESC LIMIT 1",
                        (floor_id,)).fetchone()


def _levels_ceiling(conn: sqlite3.Connection, floor_id: str) -> float:
    from . import geometry_store as store

    _v, levels = store.floor_levels(conn, floor_id)
    return _default_ceiling({"levels": levels})

def strip(doc: dict[str, Any]) -> dict[str, Any]:
    """What attach() added never enters a stored document or its hash: items marked `shared` and `shared_spaces`."""
    if "shared_spaces" in doc:
        doc.pop("shared_spaces", None)
    doc.pop("shared_deleted", None)
    for coll in MARKED_COLLECTIONS + ("levels",):
        items = doc.get(coll)
        if isinstance(items, list) and any(isinstance(i, dict) and "shared" in i for i in items):
            doc[coll] = [i for i in items if not (isinstance(i, dict) and "shared" in i)]
    return doc


def split(doc: dict[str, Any]) -> tuple[dict[str, Any], dict[str, dict[str, list[dict[str, Any]]]], dict[str, dict[str, Any]], set[str]]:
    """A document a client sent: (its own part, the shared items by home floor, the echoed shared_spaces mirror entries
    by home floor, the ids of shared items it deletes - `shared_deleted`). An item is shared when it carries the
    `shared` marker."""
    own = dict(doc)
    shared: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for coll in MARKED_COLLECTIONS + ("levels",):
        items = doc.get(coll)
        if not isinstance(items, list):
            continue
        keep = []
        for i in items:
            m = i.get("shared") if isinstance(i, dict) else None
            if isinstance(m, dict) and isinstance(m.get("home_floor_id"), str):
                if coll in SHARED_COLLECTIONS:
                    shared.setdefault(m["home_floor_id"], {c: [] for c in SHARED_COLLECTIONS})[coll].append(i)
            elif isinstance(i, dict) and "shared" in i:
                continue  # a malformed marker: dropped, never stored
            else:
                keep.append(i)
        own[coll] = keep
    echoed: dict[str, dict[str, Any]] = {}
    for e in doc.get("shared_spaces") or [] if isinstance(doc.get("shared_spaces"), list) else []:
        if isinstance(e, dict) and e.get("role") == "mirror" and isinstance(e.get("home_floor_id"), str):
            echoed.setdefault(e["home_floor_id"], e)
    own.pop("shared_spaces", None)
    # review M1: a shared item is deleted only when the client lists it; one it merely left out is kept
    deleted = {str(x) for x in doc.get("shared_deleted") or [] if isinstance(x, str)} if isinstance(doc.get("shared_deleted"), list) else set()
    own.pop("shared_deleted", None)
    return own, shared, echoed, deleted


# ---------------------------------------------------------------- write routing (decision 1)

class SharedEditError(Exception):
    def __init__(self, status: int, code: str, message: str, **details: Any) -> None:
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details


def _canon(v: Any) -> Any:
    """A value as JSON compares it across languages: a browser sends 0 for 0.0, so integral floats are ints here."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, dict):
        return {k: _canon(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_canon(x) for x in v]
    return v


def _clean(i: dict[str, Any]) -> str:
    return json.dumps(_canon({k: v for k, v in i.items() if k not in ("shared", "far")}), sort_keys=True, ensure_ascii=False)


def _item_inside(coll: str, item: dict[str, Any], doc: dict[str, Any], region: list[list[dict[str, float]]], zone_id: str | None = None) -> bool:
    """Membership of one item in home coordinates (the same rule as room_subset): inside the home outline, or inside
    another outline of the room when it carries `shared_space_id` == `zone_id` (re-review N3)."""
    if _where(coll, item, doc, region) == "home":
        return True
    return zone_id is not None and item.get("shared_space_id") == zone_id and _where(coll, item, doc, region) == "other"


def _where(coll: str, item: dict[str, Any], doc: dict[str, Any], region: list[list[dict[str, float]]]) -> str | None:
    """"home" (inside the home outline), "other" (inside another outline of the room only) or None."""
    from . import plan_geometry as pg

    dims = doc.get("dimensions") or {}
    w, h = float(dims.get("width_px") or 1000), float(dims.get("height_px") or 1000)
    scale, _ = pg.effective_scale(doc)
    polys = [poly_px(p, w, h) for p in region]
    try:
        if coll in ("objects", "labels"):
            p = item.get("position")
            pts = [(float(p[0]) * w, float(p[1]) * h)]
            tol = POINT_TOL_M / scale
        elif coll in ("walls", "connectors"):
            thick = item.get("thickness_m") if coll == "walls" and _num(item.get("thickness_m")) else pg.DEFAULT_WALL_THICKNESS_M
            tol = max(float(thick), WALL_TOL_M) / scale
            pts = [(x * w, y * h) for x, y in wall_path.sampled_wall(item, w, h)] if coll == "walls" and wall_path.is_curved(item) else \
                [(float(p[0]) * w, float(p[1]) * h) for p in item.get("polyline") or []]
            if len(pts) < 2:
                return None
        else:
            return None  # openings, circuits and groups are judged by what they reference (plan_edits)
    except (TypeError, ValueError, IndexError):
        return None
    if all(near(q, polys[0], tol) for q in pts):
        return "home"
    if all(any(near(q, poly, tol) for poly in polys) for q in pts):
        return "other"
    return None


def plan_edits(conn: sqlite3.Connection, floor_id: str, sent_shared: dict[str, dict[str, list[dict[str, Any]]]], echoed: dict[str, dict[str, Any]],
               deleted: set[str] | None = None, *, can_write: Callable[[str], bool] | None = None,
               can_control: Callable[[str], bool] | None = None,
               fix: Callable[[str, dict[str, Any] | None, dict[str, Any]], dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """The shared items a client of `floor_id` (the other floor) sent, planned as writes to each home floor's editor
    draft: what changed, was added (a namespaced new id) or deleted (listed in `deleted`) against the current attach.
    Security review B2 / M1:
    - only rooms shared with this floor, only items inside the room before and after, never a read-only piece
      (ignored), never a derived connector (the home save regenerates it);
    - an addition whose id already exists anywhere in the home document is refused (422 shared_id_taken) - it can
      never overwrite an item of the rest of the home floor;
    - an opening must sit on a wall of the room (or one added in the same edit); a circuit or a group only on objects of
      the room; a circuit's switch entity cannot be changed from here (422 shared_switch), and a NEW circuit may only
      reuse the switch of a circuit already in the room unless the actor may control that entity (`can_control`,
      ha.entity.control at its placement) - re-review N2: a delete + add in one save cannot smuggle in any switch;
    - a principal explicitly denied on the home floor writes nothing (403 shared_denied, no revision in the answer);
    - an item left out is never deleted: deletions are only the ids listed.
    A home floor whose echo is missing is not touched; a home draft that moved since the client read it raises 409 when
    anything differs. Writes NOTHING - every refusal comes before the first write; commit_edits() writes the plan.
    `fix(coll, current item or None, sent item)` (PLNS): the sent item with the anchor references its writer was not
    shown given back from the current one (services/plan_anchor_scope.py); it may raise to refuse the edit."""
    from . import geometry_store as store

    deleted = deleted or set()
    by_home: dict[str, list[Share]] = {}
    for s in shares_of_floor(conn, floor_id):
        by_home.setdefault(s.home_floor_id, []).append(s)
    records: list[dict[str, Any]] = []
    for H, hs in by_home.items():
        echo = echoed.get(H)
        if echo is None:
            continue
        hv = home_view(conn, H, "draft")
        if hv.doc is None or hv.version is None:
            continue
        other_v = store.editor_version(conn, floor_id)
        level_ids, default_level = _level_ids(hv.doc)
        sent = sent_shared.get(H, {c: [] for c in SHARED_COLLECTIONS})
        view: dict[str, dict[str, dict[str, Any]]] = {c: {} for c in SHARED_COLLECTIONS}
        owner: dict[str, Share] = {}
        places: dict[str, Placement] = {}
        regions: dict[str, list[list[dict[str, float]]]] = {}
        for s in hs:
            place = Placement(s.placement, _dims_of(hv.version, hv.doc), _dims_of(other_v))
            places[s.zone_id] = place
            regions[s.zone_id] = region_of(conn, s, place)
            for coll, items in project(room_subset(hv.doc, regions[s.zone_id], s.zone_id), s, place, level_ids, default_level).items():
                if coll not in view:
                    continue
                for it in items:
                    view[coll].setdefault(it["id"], it)
                    owner.setdefault(it["id"], s)
        home_ids = {i.get("id") for c in ("levels", "walls", "openings", *SHARED_COLLECTIONS, "rooms", "uncertain_regions") for i in hv.doc.get(c) or [] if isinstance(i, dict)}
        changed: dict[str, list[tuple[dict[str, Any] | None, dict[str, Any] | None, Share]]] = {c: [] for c in SHARED_COLLECTIONS}
        for coll in SHARED_COLLECTIONS:
            got = {i["id"]: i for i in sent.get(coll, []) if isinstance(i.get("id"), str)}
            if fix is not None:
                got = {iid: fix(coll, view[coll].get(iid), it) for iid, it in got.items()}
            for iid, it in got.items():
                cur = view[coll].get(iid)
                if cur is not None:
                    if cur["shared"].get("readonly") or _clean(cur) == _clean(it):
                        continue
                    changed[coll].append((cur, it, owner[iid]))
                else:
                    if not iid.startswith(f"{H}:") or ":" in un_ns(H, iid):
                        continue  # not a new item of this home floor
                    if coll == "connectors" and str(un_ns(H, iid)).startswith("cx-"):
                        continue
                    if un_ns(H, iid) in home_ids:
                        raise SharedEditError(422, "shared_id_taken", "המזהה כבר קיים בקומה של החלל; פריט חדש צריך מזהה חדש.", id=iid, collection=coll)
                    zid = (it.get("shared") or {}).get("zone_id")
                    s = next((x for x in hs if x.zone_id == zid), hs[0])
                    changed[coll].append((None, it, s))
            for iid, cur in view[coll].items():
                if iid in deleted and iid not in got and not cur["shared"].get("readonly") and not (coll == "connectors" and str(un_ns(H, iid)).startswith("cx-")):
                    changed[coll].append((cur, None, owner[iid]))
        if not any(changed.values()):
            continue
        if can_write is not None and not can_write(H):
            raise SharedEditError(403, "shared_denied", "אין לך הרשאה לערוך את החלל המשותף בקומה שלו.")
        if echo.get("home_revision") != hv.revision:
            raise SharedEditError(409, "stale_revision", "החלל המשותף עודכן מהקומה השנייה בינתיים; העורך ימזג ויטען מחדש.", shared=True, home_floor_id=H)
        doc = copy.deepcopy(hv.doc)
        counts = {"changed": 0, "added": 0, "removed": 0}
        zones: set[str] = set()
        # what the room holds after the edit: its walls (not read-only) and objects, by home id
        room_walls = {un_ns(H, i) for i, it in view.get("walls", {}).items() if not it["shared"].get("readonly")}
        room_objects = {un_ns(H, i) for i in view["objects"]}
        room_switches = {v.get("switch_entity_id") for v in view["circuits"].values() if isinstance(v.get("switch_entity_id"), str)}
        for cur, new, s in changed.get("walls", []):
            if new is None:
                room_walls.discard(un_ns(H, cur["id"]))
            else:
                room_walls.add(un_ns(H, new["id"]))
        for cur, new, s in changed["objects"]:
            if new is None:
                room_objects.discard(un_ns(H, cur["id"]))
            else:
                room_objects.add(un_ns(H, new["id"]))
        for coll in SHARED_COLLECTIONS:
            rows = changed[coll]
            if not rows:
                continue
            items = list(doc.get(coll) or [])
            index = {i.get("id"): n for n, i in enumerate(items) if isinstance(i, dict)}
            drop: set[str] = set()
            for cur, new, s in rows:
                zones.add(s.zone_id)
                if new is None:
                    drop.add(un_ns(H, cur["id"]))
                    counts["removed"] += 1
                    continue
                back = unproject(coll, new, s, places[s.zone_id], level_ids, default_level)
                if coll == "openings":
                    if back.get("wall_id") not in room_walls:
                        raise SharedEditError(422, "shared_outside", "הפתח חייב לשבת על קיר של החלל המשותף.", id=new.get("id"), collection=coll)
                elif coll in ("circuits", "groups"):
                    members = back.get("member_ids") if isinstance(back.get("member_ids"), list) else []
                    if not members or any(m not in room_objects for m in members):
                        raise SharedEditError(422, "shared_outside", "מעגל או קבוצה מהחלל המשותף יכולים לכלול רק עצמים שבתוכו.", id=new.get("id"), collection=coll)
                    if coll == "circuits" and cur is not None and back.get("switch_entity_id") != cur.get("switch_entity_id"):
                        raise SharedEditError(422, "shared_switch", "את המפסק של מעגל בחלל המשותף משנים בקומה שלו.", id=new.get("id"))
                    sw = back.get("switch_entity_id") if coll == "circuits" else None
                    if cur is None and isinstance(sw, str) and sw and sw not in room_switches and not (can_control is not None and can_control(sw)):
                        raise SharedEditError(422, "shared_switch", "מעגל חדש בחלל המשותף יכול להשתמש רק במפסק שכבר משמש מעגל בחלל, או במפסק שמותר לך להפעיל.",
                                              id=new.get("id"))
                elif coll in ("objects", "labels", "connectors") and _where(coll, back, doc, regions[s.zone_id]) == "other":
                    back["shared_space_id"] = s.zone_id  # re-review N3: drawn or moved under the upper level from here - explicitly the room's
                elif not _item_inside(coll, back, doc, regions[s.zone_id], s.zone_id):
                    raise SharedEditError(422, "shared_outside", "אפשר לערוך מכאן רק את מה שבתוך החלל המשותף; את השאר ערוך בקומה שלו.", id=new.get("id"), collection=coll)
                if back["id"] in index:
                    items[index[back["id"]]] = back
                    counts["changed" if cur is not None else "added"] += 1
                else:
                    index[back["id"]] = len(items)
                    items.append(back)
                    counts["added"] += 1
            doc[coll] = [i for i in items if not (isinstance(i, dict) and i.get("id") in drop)]
            if coll == "walls" and drop:  # the openings of a removed wall go with it
                doc["openings"] = [o for o in doc.get("openings") or [] if not (isinstance(o, dict) and o.get("wall_id") in drop)]
        from . import plan_geometry as pg

        structural = [i for i in pg.validate(doc) if i["structural"]]
        if structural:  # the home floor's editor must never be left with a draft it cannot save
            raise SharedEditError(422, "geometry_structure", "מבנה החלל המשותף אינו תקין; השינוי לא נשמר.", issues=structural[:50], home_floor_id=H)
        records.append({"home_floor_id": H, "zone_ids": sorted(zones), **counts, "_version": hv.version, "_doc": doc, "_revision": hv.revision})
    return records

def commit_edits(conn: sqlite3.Connection, planned: list[dict[str, Any]], actor_id: str | None, now: str) -> list[dict[str, Any]]:
    """Write what plan_edits() planned; returns the audit records (home floor, zones, counts)."""
    from . import geometry_store as store

    out = []
    for p in planned:
        store.save_draft(conn, p["_version"], p["_doc"], p["_revision"], actor_id, now)
        out.append({k: v for k, v in p.items() if not k.startswith("_")})
    return out


# ---------------------------------------------------------------- publishing from the other floor (owner answer 1, 2026-09-29)

def _content(doc: dict[str, Any], region: list[list[dict[str, float]]], zone_id: str | None = None) -> dict[str, dict[str, dict[str, Any]]]:
    """The room's content items of a home document by collection and id (derived connectors left out: regenerated)."""
    sub = room_subset(doc, region, zone_id)
    return {c: {i["id"]: {k: v for k, v in i.items() if not k.startswith("_")} for i in sub.get(c, []) if not (c == "connectors" and i.get("_readonly"))}
            for c in SHARED_COLLECTIONS}


def plan_shared_publish(conn: sqlite3.Connection, floor_id: str, *, can_write: Callable[[str], bool] | None = None, validate: bool = True,
                        skip: Iterable[str] = ()) -> list[dict[str, Any]]:
    """What publishing `floor_id` (the other floor of a shared room) also publishes on each room's home floor: the
    room's content as it is in the home DRAFT, merged into the home floor's PUBLISHED structure - nothing else of the
    home draft (the rest stays a draft). An item moved out of the room in the home draft keeps its published place; one
    moved in takes the draft's. Only when the home floor's editor version is its published plan version (a new plan
    version publishes with its own plan). A home floor the principal is denied on is left out. Writes nothing; the
    merged documents are prepared and validated here (422 before any write). Re-review low: when the merged document
    does not validate because of items of the room's draft (a group or a level that exists only in the home draft), the
    422 `shared_invalid` names those items (`items`), and a publish with `skip` = their ids keeps their published
    version (or leaves a new one out) - the rest of the room's changes go out."""
    from . import geometry_store as store
    from . import plan_geometry as pg
    from . import plan_catalog

    skip_ids = {str(x) for x in skip}
    by_home: dict[str, list[Share]] = {}
    for s in shares_of_floor(conn, floor_id):
        by_home.setdefault(s.home_floor_id, []).append(s)
    out: list[dict[str, Any]] = []
    for H, hs in by_home.items():
        if can_write is not None and not can_write(H):
            continue
        skipped = {un_ns(H, x) for x in skip_ids}
        v = store.editor_version(conn, H)
        if v is None or v["status"] != "published":
            continue
        d = store.draft_row(conn, v["id"])
        p = store.published_row(conn, v["id"])
        if d is None or p is None:
            continue
        draft, _ = store.working_doc(conn, v)
        pub = store.load_doc(p)
        other_v = store.editor_version(conn, floor_id)
        merged = copy.deepcopy(pub)
        changes = 0
        zones: list[str] = []
        for s in hs:
            place = Placement(s.placement, _dims_of(v, draft), _dims_of(other_v))
            region = region_of(conn, s, place)
            dc, pc = _content(draft, region, s.zone_id), _content(pub, region, s.zone_id)
            for c in SHARED_COLLECTIONS:  # skipped: as published (or absent when new)
                for i in list(dc[c]):
                    if i in skipped:
                        if i in pc[c]:
                            dc[c][i] = pc[c][i]
                        else:
                            del dc[c][i]
            # what this publish changes: a room item of the draft that differs, or one deleted from the draft (an item
            # moved out of the room in the draft keeps its published place: not a change here)
            live = {c: {i.get("id") for i in draft.get(c) or [] if isinstance(i, dict)} for c in SHARED_COLLECTIONS}
            n = sum(1 for c in SHARED_COLLECTIONS for i in dc[c] if _clean(dc[c][i]) != _clean(pc[c].get(i, {}))) \
                + sum(1 for c in SHARED_COLLECTIONS for i in pc[c] if i not in dc[c] and i not in live[c])
            if not n:
                continue
            changes += n
            zones.append(s.zone_id)
            for c in SHARED_COLLECTIONS:
                draft_ids = {i.get("id") for i in draft.get(c) or [] if isinstance(i, dict)}
                gone = {i for i in pc[c] if i not in dc[c] and i not in draft_ids} | set(dc[c])  # deleted, or replaced by the draft's
                merged[c] = [i for i in merged.get(c) or [] if not (isinstance(i, dict) and i.get("id") in gone)] + list(dc[c].values())
        if not changes:
            continue
        prepared = store._prepare(conn, v, merged) if validate else merged
        errors = [i for i in pg.validate(prepared, plan_catalog.item_index(conn)) if i["severity"] == "error"] if validate else []
        if errors:
            room = {i for c in SHARED_COLLECTIONS for i in _content(draft, region_of(conn, hs[0], Placement(hs[0].placement, _dims_of(v, draft), _dims_of(other_v))), hs[0].zone_id)[c]}
            bad = sorted({str(e.get("id")) for e in errors if e.get("id") in room})
            if bad and all(e.get("id") in room for e in errors):
                raise SharedEditError(422, "shared_invalid", "יש בחלל המשותף פריטים שעדיין לא מוכנים לפרסום; אפשר לפרסם בלי הפריטים האלה.",
                                      issues=errors[:50], home_floor_id=H, items=[{"id": ns(H, i), "message": next(e["message"] for e in errors if e.get("id") == i)} for i in bad])
            raise SharedEditError(422, "geometry_invalid", "בחלל המשותף יש שגיאות שמונעות פרסום; תקן אותן בקומה שלו.", issues=errors[:50], home_floor_id=H)
        f = _floor(conn, H)
        out.append({"home_floor_id": H, "home_floor_level": f["level"] if f else None, "home_floor_name": f["name"] if f else "", "zone_ids": zones, "changes": changes,
                    "_version": v, "_doc": prepared})
    return out


def shared_pending(conn: sqlite3.Connection, floor_id: str, *, can_write: Callable[[str], bool] | None = None, can_name: Callable[[str], bool] | None = None,
                   validate: bool = True) -> list[dict[str, Any]]:
    """The publish dialog's line "כולל שינויים בחלל המשותף (קומה -1)": per home floor, how many of the room's items
    publishing this floor would publish there. Never raises (an invalid room is reported by the publish itself)."""
    try:
        planned = plan_shared_publish(conn, floor_id, can_write=can_write, validate=validate)
    except SharedEditError as exc:
        return [{"home_floor_id": exc.details.get("home_floor_id"), "changes": None, "invalid": True, "items": exc.details.get("items") or [], "message": exc.message}]
    return [{"home_floor_id": p["home_floor_id"], "home_floor_level": p["home_floor_level"],
             "home_floor_name": p["home_floor_name"] if can_name is None or can_name(p["home_floor_id"]) else OTHER_FLOOR,
             "zone_ids": p["zone_ids"], "changes": p["changes"]} for p in planned]


def commit_shared_publish(conn: sqlite3.Connection, planned: list[dict[str, Any]], actor_id: str | None, now: str) -> list[dict[str, Any]]:
    from . import geometry_store as store

    out = []
    for p in planned:
        r = store.publish_doc(conn, p["_version"], p["_doc"], actor_id, now)
        out.append({**{k: v for k, v in p.items() if not k.startswith("_")}, "geometry_id": r["published"]["id"] if r["published"] else None})
    return out

# ---------------------------------------------------------------- anchors and zones for the map bundle

def _anchor_tol(conn: sqlite3.Connection, home_floor_id: str) -> tuple[float, float, float]:
    """(width px, height px, point tolerance px) of the home floor's current plan version."""
    v = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('published', 'draft') ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, created_at DESC LIMIT 1",
                     (home_floor_id,)).fetchone()
    if v is None:
        return 1000.0, 1000.0, 0.0
    return float(v["width_px"]), float(v["height_px"]), POINT_TOL_M / _scale_of_version(v)


def anchor_in_room(x: float, y: float, share: Share, dims: tuple[float, float, float]) -> bool:
    w, h, tol = dims
    return near((float(x) * w, float(y) * h), poly_px(share.zone_polygon, w, h), tol)


# ---------------------------------------------------------------- membership: THE reach rule (security review B1)
#
# Reach follows an explicit list - the members of the shared space - never geometry: moving an anchor into the room, or
# growing the room's polygon, grants nobody anything. A member is added at share time and by "הוסף לחלל המשותף", both of
# which need the share rights (map.edit + placement.edit on every floor that shows the room, and placement reach on each
# camera); removing one narrows reach and ends open streams (revocation.mark).

@dataclass(frozen=True)
class Group:
    """One shared room: its home zone, its home floor and every floor that shows it (the home floor first)."""
    zone_id: str
    home_floor_id: str
    floors: tuple[str, ...]
    shares: tuple[Share, ...]

    def share_to(self, floor_id: str) -> Share | None:
        return next((s for s in self.shares if s.floor_id == floor_id), None)


def groups(conn: sqlite3.Connection, at: str | None = None) -> dict[str, Group]:
    out: dict[str, list[Share]] = {}
    for s in _rows(conn, "", (), at):
        out.setdefault(s.zone_id, []).append(s)
    return {z: Group(z, ss[0].home_floor_id, tuple(dict.fromkeys([ss[0].home_floor_id, *(s.floor_id for s in ss)])), tuple(ss)) for z, ss in out.items()}


def group_of_zone(conn: sqlite3.Connection, zone_id: str) -> Group | None:
    return groups(conn).get(zone_id)


ALARM_MEMBER_MESSAGE = "רכיבי אזעקה אינם משותפים בין קומות"


def alarm_owned(conn: sqlite3.Connection, entity_ids: list[str]) -> list[str]:
    """Review M1: of `entity_ids`, the alarm panels and every control the alarm section owns (services/alarm.managed_controls).
    Reach to those comes only from their own anchors and areas - a shared room must never widen an alarm permission to
    another floor, so they are never members."""
    ids = sorted(set(entity_ids))
    if not ids:
        return []
    from . import alarm

    owned = alarm.managed_controls(conn)
    return [e for e in ids if e.split(".", 1)[0] == "alarm_control_panel" or e in owned]


def station_visible(conn: sqlite3.Connection, principal: Any, station_id: str) -> bool:
    """CR-009 §13: may THIS reader see a WisKey station that is a member of a shared space? The existing WisKey model, reused
    as it is: `access.read` at installation scope (routers/access_control._reader - stations have no site or floor, so there
    is no narrower scope; a floor-scoped reader never holds it). Fail closed: any error, an inactive user or a deny is
    "not visible". Membership adds nothing to this - the room never widens who may read a station, it only lists it."""
    if not isinstance(station_id, str) or not station_id or len(station_id) > MAX_STATION_ID:
        return False
    try:
        from ..rbac import INSTALLATION, authorize

        return authorize(conn, principal, "access.read", INSTALLATION).allowed
    except Exception:  # noqa: BLE001 - fail closed
        return False


def served_stations(settings: Any) -> dict[str, dict[str, Any]] | None:
    """The stations of the served WisKey copy, by id (intercom_sync.served: the last-known copy or nothing), or None when
    there is no honest copy. Only id and name are ever taken from it for a member."""
    try:
        from . import intercom_sync

        _state, overview = intercom_sync.SYNC.served(settings)
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(overview, dict):
        return None
    return {s["id"]: s for s in overview.get("stations") or [] if isinstance(s, dict) and isinstance(s.get("id"), str) and s["id"]}


def member_rows(conn: sqlite3.Connection, zone_id: str | None = None, at: str | None = None) -> list[sqlite3.Row]:
    live = "added_at <= ? AND (removed_at IS NULL OR removed_at > ?)" if at else "removed_at IS NULL"
    try:
        return conn.execute(f"SELECT * FROM shared_space_members WHERE {live}{' AND zone_id = ?' if zone_id else ''} ORDER BY resource_type, resource_id",
                            (*((at, at) if at else ()), *((zone_id,) if zone_id else ()))).fetchall()
    except sqlite3.OperationalError:  # before migration 0038
        return []


def mirrored_anchor_floors(conn: sqlite3.Connection, at: str | None = None) -> dict[tuple[str, str], list[tuple[str, str]]]:
    """THE reach helper (CR-009 §6): every MEMBER of a shared room, keyed (resource_type, resource_id), with the
    (floor it reaches, origin floor) pairs - every floor that shows the room except the one it is anchored on (the home
    floor when it is anchored on none). The origin is the floor whose deny takes it away for entities (ha_scope). A
    table lookup per call, no document parsed; a share, an un-share or a member change is seen by the next request."""
    gs = groups(conn, at)
    if not gs:
        return {}
    out: dict[tuple[str, str], list[tuple[str, str]]] = {}
    members = member_rows(conn, None, at)
    if not members:
        return {}
    cond = "effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)" if at else "effective_to IS NULL"
    anchored: dict[tuple[str, str], set[str]] = {}
    keys = sorted({(m["resource_type"], m["resource_id"]) for m in members if m["resource_type"] in ANCHORED_TYPES})
    for rtype, rid in keys:
        anchored[(rtype, rid)] = {r[0] for r in conn.execute(f"SELECT floor_id FROM map_anchors WHERE resource_type = ? AND resource_id = ? AND {cond}", (rtype, rid, *((at, at) if at else ()))).fetchall()}
    for m in members:
        g = gs.get(m["zone_id"])
        if g is None or m["resource_type"] not in ANCHORED_TYPES:
            continue  # a station member has no anchor and reaches no floor
        key = (m["resource_type"], m["resource_id"])
        on = [f for f in g.floors if f in anchored.get(key, set())]
        if not on:
            continue  # re-review N1: a member reaches the room's floors only while it is anchored on one of them
        origin = on[0]
        lst = out.setdefault(key, [])
        for f in g.floors:
            if f not in on and (f, origin) not in lst:
                lst.append((f, origin))
    return {k: v for k, v in out.items() if v}


def _live_anchor_floors(conn: sqlite3.Connection, resource_type: str, resource_id: str) -> set[str]:
    return {r[0] for r in conn.execute("SELECT floor_id FROM map_anchors WHERE resource_type = ? AND resource_id = ? AND effective_to IS NULL", (resource_type, resource_id)).fetchall()}


def member_share_floors(conn: sqlite3.Connection) -> dict[tuple[str, str], set[str]]:
    """(resource_type, resource_id) -> every floor of the shared rooms it is a member of (a deny on any of them takes
    it away - the camera chain rule, applied to entities too). Re-review N1: only while it is anchored on one of them."""
    gs = groups(conn)
    out: dict[tuple[str, str], set[str]] = {}
    placed: dict[tuple[str, str], set[str]] = {}
    for m in member_rows(conn):
        g = gs.get(m["zone_id"])
        if g is None or m["resource_type"] not in ANCHORED_TYPES:
            continue
        key = (m["resource_type"], m["resource_id"])
        if key not in placed:
            placed[key] = _live_anchor_floors(conn, *key)
        if placed[key] & set(g.floors):
            out.setdefault(key, set()).update(g.floors)
    return out


def camera_shared_floors(conn: sqlite3.Connection, camera_id: str) -> list[str]:
    """The floors a camera reaches through the shared rooms it is a member of (rbac.camera_floors): a table lookup.
    Re-review N1: a member reaches a room's floors only while it is anchored on one of them."""
    if not any_active(conn):
        return []
    try:
        zones = [r[0] for r in conn.execute("SELECT zone_id FROM shared_space_members WHERE resource_type = 'camera' AND resource_id = ? AND removed_at IS NULL", (camera_id,)).fetchall()]
    except sqlite3.OperationalError:
        return []
    if not zones:
        return []
    gs = groups(conn)
    placed = _live_anchor_floors(conn, "camera", camera_id)
    return sorted({f for z in zones if z in gs and placed & set(gs[z].floors) for f in gs[z].floors})


def end_unplaced_memberships(conn: sqlite3.Connection, resource_type: str, resource_id: str, actor_id: str | None, now: str) -> list[str]:
    """Re-review N1: after an anchor is removed, the rooms whose member is no longer anchored on any of their floors lose
    it (a camera taken off the hall's map and placed elsewhere must not stay reachable from the hall's other floor).
    Returns the zone ids whose membership ended; the caller audits and marks revocation."""
    placed = _live_anchor_floors(conn, resource_type, resource_id)
    ended: list[str] = []
    for g in groups(conn).values():
        if placed & set(g.floors) or not is_member(conn, g.zone_id, resource_type, resource_id):
            continue
        if remove_member(conn, g.zone_id, resource_type, resource_id, actor_id, now):
            ended.append(g.zone_id)
    return ended


def floor_mirrored(conn: sqlite3.Connection, floor_id: str) -> set[tuple[str, str]]:
    """(resource_type, resource_id) of the members shown on a floor from another floor of their room."""
    if not any_active(conn):
        return set()
    return {k for k, pairs in mirrored_anchor_floors(conn).items() if any(f == floor_id for f, _h in pairs)}


def is_member(conn: sqlite3.Connection, zone_id: str, resource_type: str, resource_id: str) -> bool:
    return any(m["resource_type"] == resource_type and m["resource_id"] == resource_id for m in member_rows(conn, zone_id))


def add_member(conn: sqlite3.Connection, zone_id: str, resource_type: str, resource_id: str, actor_id: str | None, now: str) -> bool:
    if is_member(conn, zone_id, resource_type, resource_id):
        return False
    from ..db import new_id

    conn.execute("INSERT INTO shared_space_members(id, zone_id, resource_type, resource_id, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?)",
                 (new_id(), zone_id, resource_type, resource_id, actor_id, now))
    return True


def remove_member(conn: sqlite3.Connection, zone_id: str, resource_type: str, resource_id: str, actor_id: str | None, now: str) -> bool:
    try:
        cur = conn.execute("UPDATE shared_space_members SET removed_at = ?, removed_by = ? WHERE zone_id = ? AND resource_type = ? AND resource_id = ? AND removed_at IS NULL",
                           (now, actor_id, zone_id, resource_type, resource_id))
    except sqlite3.OperationalError:
        return False
    return cur.rowcount > 0


def members_on_floor(conn: sqlite3.Connection, floor_id: str) -> dict[tuple[str, str], str]:
    """(resource_type, resource_id) -> zone id, for the members of the rooms a floor shows."""
    gs = groups(conn)
    return {(m["resource_type"], m["resource_id"]): m["zone_id"] for m in member_rows(conn) if m["zone_id"] in gs and floor_id in gs[m["zone_id"]].floors}


def room_candidates(conn: sqlite3.Connection, floor_id: str) -> dict[str, str]:
    """anchor id -> zone id: the floor's own anchors that lie in a shared room it shows but are NOT members - shown on
    their own floor only; the editor offers "הוסף לחלל המשותף" to whoever holds the share rights. Geometry is a hint here,
    never a grant."""
    gs = groups(conn)
    mine = [g for g in gs.values() if floor_id in g.floors]
    if not mine:
        return {}
    members = members_on_floor(conn, floor_id)
    out: dict[str, str] = {}
    for g in mine:
        outline = outline_on(conn, g, floor_id)
        if outline is None:
            continue
        poly, dims = outline
        for a in conn.execute("SELECT id, resource_type, resource_id, x, y FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (floor_id,)).fetchall():
            if (a["resource_type"], a["resource_id"]) in members or a["id"] in out:
                continue
            if near((float(a["x"]) * dims[0], float(a["y"]) * dims[1]), poly_px(poly, dims[0], dims[1]), dims[2]):
                out[a["id"]] = g.zone_id
    return out


def outline_on(conn: sqlite3.Connection, g: Group, floor_id: str) -> tuple[list[dict[str, float]], tuple[float, float, float]] | None:
    """The room's outline on a floor of its group, in that floor's plan coordinates, with (width, height, point tolerance)
    of that floor's current plan version: the home zone on the home floor; on another floor its own outline zone when it
    has one (two-outline model), else the home outline through the placement."""
    dims = _anchor_tol(conn, floor_id)
    home = next(iter(g.shares))
    if floor_id == g.home_floor_id:
        return home.zone_polygon, dims
    s = g.share_to(floor_id)
    if s is None:
        return None
    if s.other_zone_id:
        z = conn.execute("SELECT polygon_json FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (s.other_zone_id,)).fetchone()
        if z is not None:
            return json.loads(z["polygon_json"]), dims
    place = live_placement(conn, s)
    return [{"x": q[0], "y": q[1]} for q in (place.pt((p["x"], p["y"])) for p in s.zone_polygon)], dims


def inside_outline(conn: sqlite3.Connection, g: Group, floor_id: str, x: float, y: float) -> bool:
    """Whether a point (that floor's plan coordinates) lies in the room's outline on that floor - re-review low: a member
    anchor edited from another floor of the room stays inside the room on its own floor."""
    o = outline_on(conn, g, floor_id)
    if o is None:
        return False
    poly, (w, h, tol) = o
    return near((float(x) * w, float(y) * h), poly_px(poly, w, h), tol)


def transfer(conn: sqlite3.Connection, g: Group, from_floor: str, to_floor: str) -> tuple[Callable[[float, float], Pt], Callable[[Any], float], float]:
    """Point, angle and scale maps from one floor of a room's group to another (live plan versions): home -> other through
    that share's placement, other -> home through its inverse, other -> other through both."""
    ident: tuple[Callable[[float, float], Pt], Callable[[Any], float], float] = (lambda x, y: (x, y), lambda d: float(d or 0), 1.0)
    if from_floor == to_floor:
        return ident
    steps: list[tuple[Placement, bool]] = []
    if from_floor != g.home_floor_id:
        s = g.share_to(from_floor)
        if s is None:
            return ident
        steps.append((live_placement(conn, s), False))
    if to_floor != g.home_floor_id:
        s = g.share_to(to_floor)
        if s is None:
            return ident
        steps.append((live_placement(conn, s), True))

    def pt(x: float, y: float) -> Pt:
        for p, fwd in steps:
            x, y = p.fwd(x, y) if fwd else p.inv(x, y)
        return (x, y)

    def ang(d: Any) -> float:
        v = float(d or 0)
        for p, fwd in steps:
            v = p.angle(v) if fwd else p.iangle(v)
        return v

    k = 1.0
    for p, fwd in steps:
        if not p.same:
            k = k * p.k if fwd else k / p.k
    return pt, ang, k


def bundle_parts(conn: sqlite3.Connection, floor_id: str, version: sqlite3.Row | None, at: str | None = None, *,
                 can_attach: Callable[[str], bool] | None = None, can_name: Callable[[str], bool] | None = None) -> tuple[list[dict[str, Any]], list[tuple[sqlite3.Row, dict[str, Any]]]]:
    """What the map bundle of a floor adds for the shared rooms it shows: the room's zone when the floor has no outline
    of its own (polygon in this plan's coordinates, `shared`), and the MEMBERS anchored on the room's other floors (row,
    overrides: position, rotation, coverage, level, `shared`). A reader explicitly denied on the floor an anchor is on
    (or, for the zone, on the home floor) gets neither - deny wins."""
    if version is None:
        return [], []
    gs = [g for g in groups(conn, at).values() if floor_id in g.floors]
    if not gs:
        return [], []
    from ..routers.zones import zone_row

    zones: list[dict[str, Any]] = []
    anchors: list[tuple[sqlite3.Row, dict[str, Any]]] = []
    seen: set[str] = set()
    cond = "effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)" if at else "effective_to IS NULL"
    for g in gs:
        hfloor = _floor(conn, g.home_floor_id)
        if hfloor is None:
            continue
        home_ok = can_attach is None or can_attach(g.home_floor_id)
        share = g.share_to(floor_id)
        if share is not None and not share.other_zone_id and home_ok:
            pt, _ang, _k = transfer(conn, g, g.home_floor_id, floor_id)
            z = conn.execute("SELECT * FROM spatial_zones WHERE id = ?", (g.zone_id,)).fetchone()
            zr = zone_row(z)
            zr.update({"polygon": [{"x": _r6(q[0]), "y": _r6(q[1])} for q in (pt(p["x"], p["y"]) for p in share.zone_polygon)], "level_id": ns(g.home_floor_id, z["level_id"] or "L0"),
                       "shared": {"role": "mirror", "zone_id": g.zone_id, "home_floor_id": g.home_floor_id, "home_floor_name": hfloor["name"] if can_name is None or can_name(g.home_floor_id) else OTHER_FLOOR, "home_floor_level": hfloor["level"],
                                  "label": surface_label(hfloor["level"])}})
            zones.append(zr)
        for m in member_rows(conn, g.zone_id, at):
            for a in conn.execute(f"SELECT * FROM map_anchors WHERE resource_type = ? AND resource_id = ? AND {cond} ORDER BY floor_id",
                                  (m["resource_type"], m["resource_id"], *((at, at) if at else ()))).fetchall():
                if a["floor_id"] == floor_id or a["floor_id"] not in g.floors or a["id"] in seen:
                    continue
                if any(x["floor_id"] == floor_id for x in conn.execute(f"SELECT floor_id FROM map_anchors WHERE resource_type = ? AND resource_id = ? AND floor_id = ? AND {cond}",
                                                                          (m["resource_type"], m["resource_id"], floor_id, *((at, at) if at else ()))).fetchall()):
                    continue  # anchored here too: the floor's own anchor shows it
                if can_attach is not None and not can_attach(a["floor_id"]):
                    continue
                seen.add(a["id"])
                pt, ang, k = transfer(conn, g, a["floor_id"], floor_id)
                x, y = pt(a["x"], a["y"])
                cov = None
                if a["coverage_polygon"]:
                    try:
                        cov = [[_r6(q[0]), _r6(q[1])] for q in (pt(float(p[0]), float(p[1])) for p in json.loads(a["coverage_polygon"]))]
                    except (ValueError, TypeError, IndexError):
                        cov = None
                src = _floor(conn, a["floor_id"])
                anchors.append((a, {"position": {"x": _r6(x), "y": _r6(y)}, "rotation_degrees": round(ang(a["rotation_degrees"] or 0) % 360, 3),
                                    "coverage_polygon": cov, "coverage_radius": round(min(1.0, a["coverage_radius"] * k), 6) if a["coverage_radius"] else a["coverage_radius"],
                                    "level_id": ns(a["floor_id"], a["level_id"] or "L0"),
                                    "shared": {"zone_id": g.zone_id, "home_floor_id": a["floor_id"], "home_floor_name": (src["name"] if can_name is None or can_name(a["floor_id"]) else OTHER_FLOOR) if src else "", "label": surface_label(hfloor["level"])}}))
    return zones, anchors

def editor_placement(conn: sqlite3.Connection, share: Share) -> Placement:
    """The placement between the two floors' editor versions (what an edit made on the other floor's map is in)."""
    from . import geometry_store as store

    return Placement(share.placement, _dims_of(store.editor_version(conn, share.home_floor_id)), _dims_of(store.editor_version(conn, share.floor_id)))


def live_placement(conn: sqlite3.Connection, share: Share) -> Placement:
    """The placement between the plan versions the live maps show (bundle_parts): published first, else the draft."""
    q = "SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('published', 'draft') ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, created_at DESC LIMIT 1"
    return Placement(share.placement, _dims_of(conn.execute(q, (share.home_floor_id,)).fetchone()), _dims_of(conn.execute(q, (share.floor_id,)).fetchone()))


def anchor_via(conn: sqlite3.Connection, anchor: sqlite3.Row, from_floor_id: str) -> tuple[Group, Callable[[float, float], Pt], Callable[[Any], float], float]:
    """A member anchor edited on another floor's map (CR-009 decision 1): the room whose member it is, shown on both its
    floor and `from_floor_id`, and the maps from `from_floor_id`'s coordinates back to the anchor's floor. Only a member:
    geometry never makes an anchor editable from another floor. Raises SharedEditError otherwise."""
    for g in groups(conn).values():
        if anchor["floor_id"] in g.floors and from_floor_id in g.floors and is_member(conn, g.zone_id, anchor["resource_type"], anchor["resource_id"]):
            pt, ang, k = transfer(conn, g, from_floor_id, anchor["floor_id"])
            return g, pt, ang, k
    raise SharedEditError(422, "not_shared", "העוגן אינו חלק מחלל משותף שמוצג בקומה הזו.")

def mirrored_circuits(conn: sqlite3.Connection, floor_id: str, mode: str, at: str | None = None, *, can_attach: Callable[[str], bool] | None = None) -> list[dict[str, Any]]:
    """The circuits of the rooms shared with this floor as the attached document names them ("<home>:<id>", members
    namespaced): the map bundle reads their switches' states like the floor's own circuits."""
    out: list[dict[str, Any]] = []
    for s in shares_of_floor(conn, floor_id, at if mode == "at" else None):
        if can_attach is not None and not can_attach(s.home_floor_id):
            continue
        hv = home_view(conn, s.home_floor_id, mode, at)
        if hv.doc is None:
            continue
        for k in room_subset(hv.doc, region_of(conn, s, Placement(s.placement, _dims_of(hv.version, hv.doc), _dims_of(store_editor_or_published(conn, s.floor_id)))), s.zone_id)["circuits"]:
            out.append({**{kk: v for kk, v in k.items() if not kk.startswith("_")}, "id": ns(s.home_floor_id, k["id"]),
                        "member_ids": [ns(s.home_floor_id, m) for m in k.get("member_ids") or []]})
    return out


def home_zone_marks(conn: sqlite3.Connection, floor_id: str, can_name: Callable[[str], bool] | None = None) -> dict[str, dict[str, Any]]:
    """zone id -> the `shared` mark of this floor's rooms that are part of a shared space: its own room on the home
    floor (role "home", the floors that show it), its own outline of the room on another floor (role "mirror") - the
    chip "רצפה בקומה -1" on both maps. `can_name(floor)`: whether the reader may read that floor's name - a floor they
    may not read is "קומה אחרת" (review L1 pattern; the editor then offers no jump to it)."""
    name_of = lambda f: f["name"] if can_name is None or can_name(f["id"]) else OTHER_FLOOR  # noqa: E731
    out: dict[str, dict[str, Any]] = {}
    for g in groups(conn).values():
        if floor_id not in g.floors:
            continue
        home = _floor(conn, g.home_floor_id)
        base = {"zone_id": g.zone_id, "home_floor_id": g.home_floor_id, "home_floor_name": name_of(home) if home else "", "home_floor_level": home["level"] if home else None,
                "label": surface_label(home["level"] if home else "")}
        if floor_id == g.home_floor_id:
            out[g.zone_id] = {**base, "role": "home", "floors": [{"floor_id": s.floor_id, "name": name_of(f), "level": f["level"]} for s in g.shares for f in [_floor(conn, s.floor_id)] if f]}
        else:
            s = g.share_to(floor_id)
            if s is not None and s.other_zone_id:
                out[s.other_zone_id] = {**base, "role": "mirror", "floors": []}
    return out


def _row_hash(conn: sqlite3.Connection, floor_id: str, mode: str, at: str | None) -> str | None:
    """The hash of the home floor's document a read of `mode` attaches - one query, no document parsed (review M6)."""
    from . import geometry_store as store

    if mode == "draft":
        v = store.editor_version(conn, floor_id)
        row = (store.draft_row(conn, v["id"]) or store.published_row(conn, v["id"])) if v is not None else None
    elif mode == "at" and at:
        v = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status != 'draft' AND published_at IS NOT NULL AND published_at <= ? "
                         "AND (archived_at IS NULL OR archived_at > ?) ORDER BY published_at DESC LIMIT 1", (floor_id, at, at)).fetchone()
        row = store.at_row(conn, v["id"], at) if v is not None else None
    else:
        v = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()
        row = store.published_row(conn, v["id"]) if v is not None else None
    return row["doc_hash"] if row is not None else None


def shared_tag(conn: sqlite3.Connection, floor_id: str, mode: str = "published", at: str | None = None) -> str:
    """The part of a map bundle's cache key (view_hash) that follows the shared rooms a floor shows: the shares and
    both outlines' revisions and, on a floor that is not the home one, the home document's hash. No document is parsed
    (review M6). "" when the floor is in no shared room."""
    gs = [g for g in groups(conn, at if mode == "at" else None).values() if floor_id in g.floors]
    if not gs:
        return ""
    parts: list[Any] = []
    for g in gs:
        for s in g.shares:
            oz = _outline_zone(conn, s.other_zone_id)
            parts.append([s.id, s.revision, s.zone_revision, oz["revision"] if oz is not None else None,
                          _row_hash(conn, g.home_floor_id, mode, at) if floor_id != g.home_floor_id else None])
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]

# ---------------------------------------------------------------- conversion (the owner's two drawings -> one room)

def _centroid(poly: list[Pt]) -> Pt:
    if not poly:
        return (0.0, 0.0)  # a room without corners has no centre; never a division by zero
    a = cx = cy = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i - 1]
        x1, y1 = poly[i]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-12:
        return (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))
    return (cx / (3 * a), cy / (3 * a))


def _area(poly: list[Pt]) -> float:
    return abs(sum(poly[i - 1][0] * poly[i][1] - poly[i][0] * poly[i - 1][1] for i in range(len(poly)))) / 2


def _wu(polygon: list[dict[str, float]], aspect: float) -> list[Pt]:
    """A normalized polygon in width units (y scaled by height / width)."""
    return [(float(p["x"]), float(p["y"]) * aspect) for p in polygon]


def _overlap(a: list[dict[str, float]], b: list[dict[str, float]], n: int = 60) -> float:
    """Intersection over union of two normalized polygons, sampled on an n x n grid over their joint bounds."""
    pa = [(p["x"], p["y"]) for p in a]
    pb = [(p["x"], p["y"]) for p in b]
    xs = [p[0] for p in pa + pb]
    ys = [p[1] for p in pa + pb]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    if x1 - x0 <= 1e-9 or y1 - y0 <= 1e-9:
        return 0.0
    inter = union = 0
    for i in range(n):
        for j in range(n):
            p = (x0 + (i + 0.5) * (x1 - x0) / n, y0 + (j + 0.5) * (y1 - y0) / n)
            ia, ib = _inside(p, pa), _inside(p, pb)
            inter += ia and ib
            union += ia or ib
    return inter / union if union else 0.0


def _name_score(a: str, b: str) -> float:
    x, y = " ".join((a or "").split()).casefold(), " ".join((b or "").split()).casefold()
    if not x or not y:
        return 0.0
    if x == y:
        return 1.0
    return 0.7 if x in y or y in x else 0.0


def fit_placement(conn: sqlite3.Connection, home_v: sqlite3.Row, other_v: sqlite3.Row, zone: sqlite3.Row, duplicate: sqlite3.Row | None, rotation_deg: float = 0.0) -> dict[str, Any]:
    """same_frame when the two plans share a frame (geometry_store.frame_of) and no rotation is asked; else fitted: the
    scale from the two plans' metres (their effective scales - the calibration, else the estimate, which gives the same
    width for every uncalibrated plan), never from the two outlines' areas (the hall is wider upstairs), and the home
    outline's centroid onto the other floor's outline centroid (or the same place on the plan without one). The result is
    checked by alignment_ok(): the lower outline must fall inside the upper one."""
    from . import geometry_store as store

    if store.frame_of(conn, home_v, other_v) is not None and not rotation_deg:
        return {"mode": "same_frame"}
    ha = float(home_v["height_px"]) / float(home_v["width_px"])
    hb = float(other_v["height_px"]) / float(other_v["width_px"])
    ca = _centroid(_wu(json.loads(zone["polygon_json"]), ha))
    frm = [_r6(ca[0]), _r6(ca[1] / ha)]
    k = (float(home_v["width_px"]) * _scale_of_version(home_v)) / (float(other_v["width_px"]) * _scale_of_version(other_v))
    if duplicate is not None:
        cb = _centroid(_wu(json.loads(duplicate["polygon_json"]), hb))
        to = [_r6(cb[0]), _r6(cb[1] / hb)]
    else:
        to = list(frm)
    return {"mode": "fit", "from": frm, "to": to, "rotation_deg": round(float(rotation_deg) % 360, 3), "scale": round(k, 6)}


def alignment_ok(inner: list[dict[str, float]], outer: list[dict[str, float]], dims: tuple[float, float, float]) -> bool:
    """The placement check of two real outlines: every corner of the lower outline (brought onto the upper floor's plan)
    lies inside the upper outline or within the wall tolerance of it. False -> "ודא את יישור הקומות"."""
    w, h, ptol = dims
    poly = poly_px(outer, w, h)
    tol = WALL_TOL_M * ptol / POINT_TOL_M if ptol else 0.01 * max(w, h)  # the wall tolerance in this plan's pixels
    return all(near((float(p["x"]) * w, float(p["y"]) * h), poly, tol) for p in inner)

def candidates(conn: sqlite3.Connection, zone: sqlite3.Row, other_floor_id: str, same_frame: bool) -> list[dict[str, Any]]:
    """The rooms of the other floor that may be the duplicate: by name (equal 1.0, one inside the other 0.7) and, when
    the two plans share a frame, by overlap (IoU); best first."""
    zpoly = json.loads(zone["polygon_json"])
    out: list[dict[str, Any]] = []
    shares = all_shares(conn)  # one read, not one per room
    taken = {s.zone_id for s in shares} | {s.other_zone_id for s in shares if s.other_zone_id}  # already a shared room, or another room's outline
    for z in conn.execute("SELECT * FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid", (other_floor_id,)).fetchall():
        if z["id"] in taken:
            continue  # the auto-pick of plan_conversion takes the first candidate, so a room that belongs to a share must never be one
        try:
            poly = json.loads(z["polygon_json"])
        except ValueError:
            continue
        name = _name_score(zone["name"], z["name"])
        overlap = round(_overlap(zpoly, poly), 3) if same_frame else None
        score = round(max(name, overlap or 0.0) if overlap is None or name == 0 else (name + (overlap or 0)) / 2 + 0.25 * min(name, overlap or 0), 3)
        out.append({"zone_id": z["id"], "name": z["name"], "name_score": name, "overlap": overlap, "score": score})
    out.sort(key=lambda c: -c["score"])
    return out


def _boundary(pts: list[Pt], poly: list[Pt], tol: float) -> bool:
    """A wall along the outline: every corner and every segment midpoint within the tolerance of the outline."""
    samples = [*pts, *(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(pts, pts[1:]))]
    return all(_outline_dist(p, poly) <= tol for p in samples)


def _removal(doc: dict[str, Any], polygon: list[dict[str, float]]) -> tuple[dict[str, list[str]], list[str], dict[str, Any]]:
    """What leaves the other floor's draft at conversion (two-outline model): the duplicate CONTENT inside its outline -
    objects, labels, same-floor connectors, and walls wholly inside that do not run along the outline (a second drawing
    of the court) with their openings; circuits and groups pruned. The floor's own walls along its outline stay: they
    bound the hall at that floor. Returns (removed ids by collection, kept boundary wall ids, the new document)."""
    from . import plan_geometry as pg

    dims = doc.get("dimensions") or {}
    w, h = float(dims.get("width_px") or 1000), float(dims.get("height_px") or 1000)
    scale, _ = pg.effective_scale(doc)
    poly = poly_px(polygon, w, h)
    sub = room_subset(doc, polygon)
    walls: set[str] = set()
    kept: list[str] = []
    for wl in sub["walls"]:
        if wl.get("_readonly"):
            continue
        pts = [(x * w, y * h) for x, y in wall_path.sampled_wall(wl, w, h)]
        tol = max(float(wl.get("thickness_m") or pg.DEFAULT_WALL_THICKNESS_M), WALL_TOL_M) / scale
        if _boundary(pts, poly, tol):
            kept.append(wl["id"])
        else:
            walls.add(wl["id"])
    objects = {o["id"] for o in sub["objects"]}
    labels = {lb["id"] for lb in sub["labels"]}
    conns = {c["id"] for c in sub["connectors"] if not c.get("_readonly")}
    openings = {o["id"] for o in doc.get("openings") or [] if isinstance(o, dict) and o.get("wall_id") in walls}
    new = copy.deepcopy(doc)
    new["walls"] = [x for x in new.get("walls") or [] if not (isinstance(x, dict) and x.get("id") in walls)]
    new["openings"] = [o for o in new.get("openings") or [] if not (isinstance(o, dict) and o.get("id") in openings)]
    new["objects"] = [o for o in new.get("objects") or [] if not (isinstance(o, dict) and o.get("id") in objects)]
    new["labels"] = [lb for lb in new.get("labels") or [] if not (isinstance(lb, dict) and lb.get("id") in labels)]
    new["connectors"] = [c for c in new.get("connectors") or [] if not (isinstance(c, dict) and (c.get("id") in conns or c.get("object_id") in objects))]
    circuits: list[str] = []
    groups_gone: list[str] = []
    for coll, gone in (("circuits", circuits), ("groups", groups_gone)):
        keep_items = []
        for k in new.get(coll) or []:
            if not isinstance(k, dict):
                continue
            members = [m for m in k.get("member_ids") or [] if m not in objects]
            if isinstance(k.get("member_ids"), list) and k["member_ids"] and not members:
                gone.append(k["id"])
                continue
            keep_items.append({**k, "member_ids": members} if isinstance(k.get("member_ids"), list) else k)
        new[coll] = keep_items
    for o in new.get("objects") or []:
        if isinstance(o, dict) and o.get("group_id") in groups_gone:
            o["group_id"] = None
    removed = {"walls": sorted(walls), "openings": sorted(openings), "objects": sorted(objects), "labels": sorted(labels), "connectors": sorted(conns),
               "circuits": sorted(circuits), "groups": sorted(groups_gone)}
    return removed, sorted(kept), new


def _anchor_name(names: dict[str, str], a: sqlite3.Row) -> str:
    return names.get(a["resource_id"]) if a["resource_type"] == "camera" else (a["label"] or a["resource_id"])


def plan_conversion(conn: sqlite3.Connection, zone: sqlite3.Row, other_floor_id: str, duplicate_zone_id: str | None, rotation_deg: float = 0.0,
                    auto: bool = True) -> dict[str, Any]:
    """Everything the conversion will do, computed without writing (two-outline model): the placement; the other
    floor's outline of the room (its duplicate room, chosen or auto-detected - KEPT, with the walls along it; without one
    a new outline is drawn from the home one); what leaves its draft (the duplicate content inside); the members (the
    cameras and devices anchored inside either outline, each staying where it is anchored) and the anchors dropped as
    duplicates (the other floor's copy of a camera the home room already has); and the alignment check. Raises
    SharedEditError for a request that cannot be converted."""
    from . import geometry_store as store

    home_id = zone["floor_id"]
    if other_floor_id == home_id:
        raise SharedEditError(422, "validation", "בחר קומה אחרת, לא את הקומה של החדר.")
    home, other = _floor(conn, home_id), conn.execute("SELECT * FROM floors WHERE id = ? AND deleted_at IS NULL", (other_floor_id,)).fetchone()
    if other is None or home is None:
        raise SharedEditError(404, "not_found", "הקומה לא נמצאה.")
    if other["building_id"] != home["building_id"]:
        raise SharedEditError(422, "validation", "אפשר לשתף חדר רק עם קומה באותו בניין.")
    if any(s.floor_id == other_floor_id for s in shares_of_zone(conn, zone["id"])):
        raise SharedEditError(409, "already_shared", "החדר כבר משותף עם הקומה הזו.")
    if any(s.other_zone_id == zone["id"] for s in all_shares(conn)):
        raise SharedEditError(409, "already_shared", "החדר הזה כבר מתאר של חלל משותף.")
    home_v, other_v = store.editor_version(conn, home_id), store.editor_version(conn, other_floor_id)
    if home_v is None or other_v is None:
        raise SharedEditError(409, "no_plan", "לשתי הקומות צריכה להיות תוכנית לפני שמשתפים חדר.")
    same = store.frame_of(conn, home_v, other_v) is not None
    cands = candidates(conn, zone, other_floor_id, same)
    dup = None
    if duplicate_zone_id:
        dup = conn.execute("SELECT * FROM spatial_zones WHERE id = ? AND floor_id = ? AND deleted_at IS NULL", (duplicate_zone_id, other_floor_id)).fetchone()
        if dup is None:
            raise SharedEditError(422, "validation", "החדר הכפול שנבחר לא נמצא בקומה השנייה.")
        taken = [s for s in all_shares(conn) if s.other_zone_id == dup["id"] or s.zone_id == dup["id"]]
        if taken:
            raise SharedEditError(409, "already_shared", "החדר שנבחר כבר שייך לחלל משותף.")
    elif auto and cands and cands[0]["score"] >= 0.5:
        dup = conn.execute("SELECT * FROM spatial_zones WHERE id = ?", (cands[0]["zone_id"],)).fetchone()
    placement = fit_placement(conn, home_v, other_v, zone, dup, rotation_deg)
    odoc, odraft = store.working_doc(conn, other_v)
    hdoc, _ = store.working_doc(conn, home_v)
    place = Placement(placement, _dims_of(home_v, hdoc), _dims_of(other_v, odoc))
    zpoly = json.loads(zone["polygon_json"])
    lower_on_other = [{"x": _r6(q[0]), "y": _r6(q[1])} for q in (place.pt((p["x"], p["y"])) for p in zpoly)]
    outline = json.loads(dup["polygon_json"]) if dup is not None else lower_on_other
    removed, kept_walls, new_doc = _removal(odoc, outline)
    odims, hdims = _anchor_tol(conn, other_floor_id), _anchor_tol(conn, home_id)
    names = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}
    home_in = {}
    for a in conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (home_id,)).fetchall():
        if near((float(a["x"]) * hdims[0], float(a["y"]) * hdims[1]), poly_px(zpoly, hdims[0], hdims[1]), hdims[2]):
            home_in[(a["resource_type"], a["resource_id"])] = a
    anchors: list[dict[str, Any]] = [{"anchor_id": a["id"], "floor_id": home_id, "resource_type": k[0], "resource_id": k[1], "name": _anchor_name(names, a), "action": "member"}
                                     for k, a in home_in.items()]
    opoly = poly_px(outline, odims[0], odims[1])
    for a in conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (other_floor_id,)).fetchall():
        if not near((float(a["x"]) * odims[0], float(a["y"]) * odims[1]), opoly, odims[2]):
            continue
        key = (a["resource_type"], a["resource_id"])
        on_home = conn.execute("SELECT 1 FROM map_anchors WHERE floor_id = ? AND resource_type = ? AND resource_id = ? AND effective_to IS NULL", (home_id, *key)).fetchone()
        # security review M3b: only a copy of a camera the home ROOM has is dropped; one anchored elsewhere on the home
        # floor keeps its anchor here and is not made a member (it would show twice)
        action = "drop_duplicate" if key in home_in else ("kept" if on_home else "member")
        anchors.append({"anchor_id": a["id"], "floor_id": other_floor_id, "resource_type": key[0], "resource_id": key[1], "name": _anchor_name(names, a), "action": action})
    banned = alarm_owned(conn, [x["resource_id"] for x in anchors if x["action"] == "member" and x["resource_type"] == "ha_entity"])
    if banned:  # review M1: the alarm's own controls are never shared between floors
        raise SharedEditError(409, "alarm_managed", ALARM_MEMBER_MESSAGE, entity_ids=banned)
    hsub = room_subset(hdoc, zpoly)
    aligned = alignment_ok(lower_on_other, outline, odims) if dup is not None else True
    return {
        "zone": {"id": zone["id"], "name": zone["name"], "floor_id": home_id, "floor_name": home["name"], "floor_level": home["level"]},
        "other_floor": {"id": other_floor_id, "name": other["name"], "level": other["level"], "version_id": other_v["id"], "revision": odraft["revision"] if odraft is not None else 0},
        "home_version_id": home_v["id"], "same_frame": same, "placement": placement, "mirror_polygon": lower_on_other,
        "duplicate": ({"zone_id": dup["id"], "name": dup["name"], "polygon": json.loads(dup["polygon_json"])} if dup is not None else None),
        "outline": {"zone_id": dup["id"] if dup is not None else None, "kept": dup is not None, "polygon": outline},
        "candidates": cands,
        "remove": {**{k: len(v) for k, v in removed.items()}, "zone": 0}, "removed_ids": removed, "boundary_walls_kept": kept_walls,
        "anchors": anchors, "members": [{"resource_type": x["resource_type"], "resource_id": x["resource_id"]} for x in anchors if x["action"] == "member"],
        "aligned": aligned, "alignment_warning": None if aligned else "ודא את יישור הקומות",
        "attach": {"objects": len(hsub["objects"]), "labels": len(hsub["labels"]), "connectors": len(hsub["connectors"]), "circuits": len(hsub["circuits"]),
                   "members": sum(1 for x in anchors if x["action"] == "member")},
        "_new_doc": new_doc, "_other_version": other_v, "_other_draft_revision": odraft["revision"] if odraft is not None else 0,
    }


def public(plan: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in plan.items() if not k.startswith("_")}


def member_cameras(plan: dict[str, Any]) -> list[str]:
    """The cameras the conversion makes members (their reach widens to the other floor: T055 B1 on each)."""
    return sorted({m["resource_id"] for m in plan["members"] if m["resource_type"] == "camera"})


def apply_conversion(conn: sqlite3.Connection, zone: sqlite3.Row, plan: dict[str, Any], actor_id: str | None, now: str) -> dict[str, Any]:
    """The plan, written in the caller's transaction (every refusal came before): the other floor's draft without the
    duplicate content, its outline kept (or drawn), the duplicate anchors tombstoned (never deleted), the members listed,
    the share row inserted."""
    from ..db import new_id
    from . import geometry_store as store

    other_v = plan["_other_version"]
    if any(plan["remove"][k] for k in ("walls", "openings", "objects", "labels", "connectors", "circuits", "groups")):
        store.save_draft(conn, other_v, plan["_new_doc"], plan["_other_draft_revision"], actor_id, now)
    dropped: list[str] = []
    for item in plan["anchors"]:
        if item["action"] != "drop_duplicate":
            continue
        a = conn.execute("SELECT * FROM map_anchors WHERE id = ? AND effective_to IS NULL", (item["anchor_id"],)).fetchone()
        if a is None:
            continue
        conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, actor_id, now, a["id"]))
        store.unbind_anchor(conn, a["floor_id"], a["resource_type"], a["resource_id"], actor_id, now, last={"x": a["x"], "y": a["y"], "rotation": a["rotation_degrees"] or 0})
        dropped.append(a["id"])
    outline_id = plan["outline"]["zone_id"]
    if outline_id is None:
        outline_id = new_id()
        conn.execute("INSERT INTO spatial_zones(id, floor_id, plan_version_id, name, kind, polygon_json, color, source, searchable, revision, created_by, created_at, updated_at) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 1, 1, ?, ?, ?)",
                     (outline_id, plan["other_floor"]["id"], other_v["id"], zone["name"], zone["kind"], json.dumps(plan["outline"]["polygon"]), zone["color"], actor_id, now, now))
    added = [m for m in plan["members"] if add_member(conn, zone["id"], m["resource_type"], m["resource_id"], actor_id, now)]
    sid = new_id()
    conn.execute("INSERT INTO shared_spaces(id, zone_id, home_floor_id, floor_id, other_zone_id, placement_json, revision, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
                 (sid, zone["id"], zone["floor_id"], plan["other_floor"]["id"], outline_id, json.dumps(plan["placement"]), actor_id, now, now))
    return {"share_id": sid, "outline_zone_id": outline_id, "members_added": added, "dropped": dropped}


def unshare(conn: sqlite3.Connection, zone_id: str, floor_id: str, actor_id: str | None, now: str) -> bool:
    """The other floor stops showing the room. The room's members are dropped with its last share (a later share lists
    them again, with the rights it needs) - reach never comes back by itself."""
    try:
        cur = conn.execute("UPDATE shared_spaces SET removed_at = ?, removed_by = ?, updated_at = ?, revision = revision + 1 WHERE zone_id = ? AND floor_id = ? AND removed_at IS NULL",
                           (now, actor_id, now, zone_id, floor_id))
    except sqlite3.OperationalError:
        return False
    if cur.rowcount:
        left = shares_of_zone(conn, zone_id)
        if not left:
            conn.execute("UPDATE shared_space_members SET removed_at = ?, removed_by = ? WHERE zone_id = ? AND removed_at IS NULL", (now, actor_id, zone_id))
        else:
            # a room still shared with another floor: a member anchored only on the floor that just left reaches nothing any more
            # (N1) - its membership row ends with it, so the list does not keep a member that is on none of the room's floors
            floors = {floor_of_share for sh in left for floor_of_share in (sh.floor_id, sh.home_floor_id)}
            for m in member_rows(conn, zone_id):
                if m["resource_type"] in ANCHORED_TYPES and not (_live_anchor_floors(conn, m["resource_type"], m["resource_id"]) & floors):
                    remove_member(conn, zone_id, m["resource_type"], m["resource_id"], actor_id, now)
    return cur.rowcount > 0


def end_for_floor(conn: sqlite3.Connection, floor_id: str, actor_id: str | None, now: str) -> dict[str, list[str]]:
    """Review L5, a floor is being deleted: every live share it takes part in ends (as the home floor: all of that
    room's shares, the room has nowhere to live; as another floor: only its own), and a room left with no live share
    loses its members - no orphan member row stays, and a room shared with three floors keeps its two remaining ones.
    Plain SQL on purpose: `_rows` already hides shares of a deleted floor, which is exactly what leaves the orphans.
    Returns {"shares": [share ids ended], "zones": [zone ids whose members ended]}; the caller marks revocation."""
    out: dict[str, list[str]] = {"shares": [], "zones": []}
    try:
        rows = conn.execute("SELECT id, zone_id FROM shared_spaces WHERE removed_at IS NULL AND (floor_id = ? OR home_floor_id = ?)", (floor_id, floor_id)).fetchall()
        home_zones = [r[0] for r in conn.execute("SELECT DISTINCT zone_id FROM shared_spaces WHERE removed_at IS NULL AND home_floor_id = ?", (floor_id,)).fetchall()]
        if home_zones:
            rows = [*rows, *conn.execute(f"SELECT id, zone_id FROM shared_spaces WHERE removed_at IS NULL AND zone_id IN ({','.join('?' * len(home_zones))})", home_zones).fetchall()]
        ids = list(dict.fromkeys(r[0] for r in rows))
        zones = list(dict.fromkeys(r[1] for r in rows))
        for sid in ids:
            conn.execute("UPDATE shared_spaces SET removed_at = ?, removed_by = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND removed_at IS NULL", (now, actor_id, now, sid))
        for zid in zones:
            if conn.execute("SELECT 1 FROM shared_spaces WHERE zone_id = ? AND removed_at IS NULL LIMIT 1", (zid,)).fetchone() is None:
                cur = conn.execute("UPDATE shared_space_members SET removed_at = ?, removed_by = ? WHERE zone_id = ? AND removed_at IS NULL", (now, actor_id, zid))
                if cur.rowcount:
                    out["zones"].append(zid)
        out["shares"] = ids
    except sqlite3.OperationalError:  # before migration 0038
        return {"shares": [], "zones": []}
    return out


def set_placement(conn: sqlite3.Connection, zone_id: str, floor_id: str, placement: dict[str, Any], now: str) -> bool:
    cur = conn.execute("UPDATE shared_spaces SET placement_json = ?, updated_at = ?, revision = revision + 1 WHERE zone_id = ? AND floor_id = ? AND removed_at IS NULL",
                       (json.dumps(placement), now, zone_id, floor_id))
    return cur.rowcount > 0


def zone_in_share(conn: sqlite3.Connection, zone_id: str) -> Group | None:
    """The shared room a zone is part of - as the home room or as another floor's outline of it - or None."""
    for g in groups(conn).values():
        if g.zone_id == zone_id or any(s.other_zone_id == zone_id for s in g.shares):
            return g
    return None