"""Shared space (CR-009, T093): one room (a spatial zone) that belongs to two floors - the owner's double-height sports
hall, reachable from floor 0 and from the court on floor -1. The zone's own floor is the HOME floor: its plan document
keeps the room's walls, openings, objects (tribunes), labels, connectors, circuits and groups, and its anchors are the
room's cameras and devices. The OTHER floor stores nothing but a `shared_spaces` row (migration 0036).

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

# The membership tolerances, in metres: a wall or connector point within this of the room's outline is inside (the
# room's own walls lie on it); a point item (object, label, anchor) within POINT_TOL_M.
WALL_TOL_M = 0.3
POINT_TOL_M = 0.05
# a clipped piece of a wall that crosses the outline shorter than this many wall tolerances is the stub of an adjoining
# wall touching the room, not a part of it
MIN_PIECE_TOLS = 2.0
SHARED_COLLECTIONS = ("walls", "openings", "objects", "labels", "connectors", "circuits", "groups")
LABEL_PREFIX = "רצפה בקומה"


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


def _rows(conn: sqlite3.Connection, where: str, args: Iterable[Any], at: str | None = None) -> list[Share]:
    live = "s.created_at <= ? AND (s.removed_at IS NULL OR s.removed_at > ?)" if at else "s.removed_at IS NULL"
    try:
        rows = conn.execute(
            "SELECT s.*, z.name AS zone_name, z.polygon_json, z.revision AS zone_revision, z.level_id AS zone_level_id FROM shared_spaces s "
            "JOIN spatial_zones z ON z.id = s.zone_id AND z.floor_id = s.home_floor_id AND z.deleted_at IS NULL "
            "JOIN floors hf ON hf.id = s.home_floor_id AND hf.deleted_at IS NULL JOIN floors of ON of.id = s.floor_id AND of.deleted_at IS NULL "
            f"WHERE {live}{' AND ' + where if where else ''} ORDER BY s.created_at, s.id", (*((at, at) if at else ()), *args)).fetchall()
    except sqlite3.OperationalError:  # a database from before migration 0036 (tests keep older schemas on purpose)
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
                         int(r["revision"]), r["created_at"], r["zone_name"] or "", polygon, int(r["zone_revision"]), r["zone_level_id"]))
    return out


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


def room_subset(doc: dict[str, Any], polygon: list[dict[str, float]]) -> dict[str, list[dict[str, Any]]]:
    """The items of a home document inside the room, in home coordinates with their own ids. Room walls (wholly
    inside) and their openings are editable; the inside pieces of a wall that crosses the outline are read-only copies
    ("<id>#<n>", `_clip` = the piece) with the openings whose centre falls on them. Objects, labels: by their position;
    same-floor connectors wholly inside and the derived connectors of included objects; circuits and groups whose
    members are all included. Every item carries `_readonly` (bool); nothing is copied from the document by reference."""
    from . import plan_geometry as pg

    dims = doc.get("dimensions") or {}
    w, h = float(dims.get("width_px") or 1000), float(dims.get("height_px") or 1000)
    scale, _ = pg.effective_scale(doc)
    poly = poly_px(polygon, w, h)
    ptol = POINT_TOL_M / scale
    out: dict[str, list[dict[str, Any]]] = {c: [] for c in SHARED_COLLECTIONS}
    by_wall: dict[str, list[dict[str, Any]]] = {}
    for o in doc.get("openings") or []:
        if isinstance(o, dict) and isinstance(o.get("wall_id"), str):
            by_wall.setdefault(o["wall_id"], []).append(o)
    for wall in doc.get("walls") or []:
        if not isinstance(wall, dict) or not isinstance(wall.get("id"), str) or not isinstance(wall.get("polyline"), list) or len(wall["polyline"]) < 2:
            continue
        try:
            pts = [(float(p[0]) * w, float(p[1]) * h) for p in wall["polyline"]]
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
            out["walls"].append({**copy.deepcopy(wall), "id": pid, "polyline": [[_r6(x / w), _r6(y / h)] for x, y in sub], "_readonly": True, "_clip": [s0 / total, s1 / total]})
            for o in by_wall.get(wall["id"], []):
                c = float(o.get("t") or 0) * total
                if s0 <= c <= s1:
                    out["openings"].append({**copy.deepcopy(o), "wall_id": pid, "t": round((c - s0) / (s1 - s0), 6), "_readonly": True})
    included: set[str] = set()
    for o in doc.get("objects") or []:
        if isinstance(o, dict) and isinstance(o.get("id"), str) and isinstance(o.get("position"), list) and len(o["position"]) == 2 and _num(o["position"][0]) and _num(o["position"][1]):
            if near((float(o["position"][0]) * w, float(o["position"][1]) * h), poly, ptol):
                out["objects"].append({**copy.deepcopy(o), "_readonly": False})
                included.add(o["id"])
    for lb in doc.get("labels") or []:
        if isinstance(lb, dict) and isinstance(lb.get("id"), str) and isinstance(lb.get("position"), list) and len(lb["position"]) == 2 and _num(lb["position"][0]) and _num(lb["position"][1]):
            if near((float(lb["position"][0]) * w, float(lb["position"][1]) * h), poly, ptol):
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
                and all(near((float(p[0]) * w, float(p[1]) * h), poly, ctol) for p in pl):
            out["connectors"].append({**copy.deepcopy(c), "_readonly": False})
    for coll in ("circuits", "groups"):
        for k in doc.get(coll) or []:
            members = k.get("member_ids") if isinstance(k, dict) else None
            if isinstance(k, dict) and isinstance(k.get("id"), str) and isinstance(members, list) and members and all(m in included for m in members):
                out[coll].append({**copy.deepcopy(k), "_readonly": False})
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

    out: dict[str, list[dict[str, Any]]] = {c: [] for c in SHARED_COLLECTIONS}
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


def attach(conn: sqlite3.Connection, floor_id: str, doc: dict[str, Any], mode: str = "published", at: str | None = None, *,
           can_attach: Callable[[str], bool] | None = None, circuits: bool = True) -> dict[str, Any]:
    """A copy of `doc` (a document of `floor_id`) with every room another floor shares with it attached, and the rooms it
    shares itself described (`shared_spaces`, role "home": the chip and the 3D volume). Computed on every read, never
    stored (strip() removes it on the way in). `can_attach(home_floor_id)`: False for a reader explicitly denied on the
    home floor - deny wins (CR-009 §6); `circuits`: False for a camera-only reader."""
    mirrors = shares_of_floor(conn, floor_id, at if mode == "at" else None)
    homes = shares_from_floor(conn, floor_id, at if mode == "at" else None)
    if not mirrors and not homes:
        return doc
    out = dict(doc)
    for coll in SHARED_COLLECTIONS + ("levels",):
        out[coll] = list(out.get(coll) or [])
    entries: list[dict[str, Any]] = []
    published = mode != "draft"
    by_home: dict[str, list[Share]] = {}
    for s in mirrors:
        by_home.setdefault(s.home_floor_id, []).append(s)
    for H, shares in by_home.items():
        if can_attach is not None and not can_attach(H):
            continue
        hv = home_view(conn, H, mode, at)
        hfloor = _floor(conn, H)
        if hv.doc is None or hfloor is None:
            continue
        level_ids, default_level = _level_ids(hv.doc)
        datum = _datum(conn, floor_id, doc, H, published)
        taken: set[str] = set()
        for lv in hv.doc.get("levels") or []:
            if isinstance(lv, dict) and isinstance(lv.get("id"), str):
                elev = float(lv["elevation_m"]) if _num(lv.get("elevation_m")) else 0.0
                out["levels"].append({**{k: v for k, v in lv.items() if k != "is_default"}, "id": ns(H, lv["id"]), "is_default": False,
                                      "name": f"{lv.get('name') or lv['id']} · {hfloor['name']}", "elevation_m": round(elev + (datum or 0.0), 4),
                                      "shared": {"home_floor_id": H, "zone_id": shares[0].zone_id}})
        up_ceiling = _default_ceiling(doc)
        for s in shares:
            place = Placement(s.placement, _dims_of(hv.version, hv.doc), _dims_of(None, doc))
            sub = room_subset(hv.doc, s.zone_polygon)
            if not circuits:
                sub["circuits"] = []
            proj = project(sub, s, place, level_ids, default_level)
            wall_ids: list[str] = []
            for coll, items in proj.items():
                for it in items:
                    if it["id"] in taken:
                        continue  # two rooms of one home floor overlapping on a wall: once
                    taken.add(it["id"])
                    out[coll].append(it)
                    if coll == "walls" and not it["shared"].get("readonly"):
                        wall_ids.append(it["id"])
            below = datum is not None and datum < 0
            entries.append({"zone_id": s.zone_id, "zone_name": s.zone_name, "home_floor_id": H, "home_floor_name": hfloor["name"], "home_floor_level": hfloor["level"],
                            "role": "mirror", "polygon": [{"x": q[0], "y": q[1]} for q in (place.pt((p["x"], p["y"])) for p in s.zone_polygon)],
                            "placement": s.placement, "home_revision": hv.revision if mode == "draft" else None, "home_version_id": hv.version["id"] if hv.version is not None else None,
                            "home_doc_hash": hv.row["doc_hash"] if hv.row is not None else None, "datum_m": datum,
                            "level_id": ns(H, s.zone_level_id if s.zone_level_id in level_ids else default_level),
                            "volume_height_m": round(-datum + up_ceiling, 3) if below else None, "wall_ids": wall_ids, "label": surface_label(hfloor["level"])})
    for s in homes:
        other = _floor(conn, s.floor_id)
        if other is None:
            continue
        from . import geometry_store as store

        _ov, other_levels = store.floor_levels(conn, s.floor_id)
        datum = _datum(conn, floor_id, doc, s.floor_id, published)
        me = _floor(conn, floor_id)
        level_ids, default_level = _level_ids(doc)
        sub = room_subset(doc, s.zone_polygon)
        entries.append({"zone_id": s.zone_id, "zone_name": s.zone_name, "home_floor_id": floor_id, "home_floor_name": me["name"] if me else "", "home_floor_level": me["level"] if me else None,
                        "role": "home", "other_floor_id": s.floor_id, "other_floor_name": other["name"], "polygon": s.zone_polygon, "placement": s.placement,
                        "datum_m": datum, "level_id": s.zone_level_id if s.zone_level_id in level_ids else default_level,
                        "volume_height_m": round(datum + _default_ceiling({"levels": other_levels}), 3) if datum is not None and datum > 0 else None,
                        "wall_ids": [w["id"] for w in sub["walls"] if not w.get("_readonly")], "label": surface_label(me["level"] if me else "")})
    out["shared_spaces"] = entries
    return out


def strip(doc: dict[str, Any]) -> dict[str, Any]:
    """What attach() added never enters a stored document or its hash: items marked `shared` and `shared_spaces`."""
    if "shared_spaces" in doc:
        doc.pop("shared_spaces", None)
    for coll in SHARED_COLLECTIONS + ("levels",):
        items = doc.get(coll)
        if isinstance(items, list) and any(isinstance(i, dict) and "shared" in i for i in items):
            doc[coll] = [i for i in items if not (isinstance(i, dict) and "shared" in i)]
    return doc


def split(doc: dict[str, Any]) -> tuple[dict[str, Any], dict[str, dict[str, list[dict[str, Any]]]], dict[str, dict[str, Any]]]:
    """A document a client sent: (its own part, the shared items by home floor, the echoed shared_spaces mirror entries
    by home floor). An item is shared when it carries the `shared` marker."""
    own = dict(doc)
    shared: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for coll in SHARED_COLLECTIONS + ("levels",):
        items = doc.get(coll)
        if not isinstance(items, list):
            continue
        keep = []
        for i in items:
            m = i.get("shared") if isinstance(i, dict) else None
            if isinstance(m, dict) and isinstance(m.get("home_floor_id"), str):
                if coll != "levels":
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
    return own, shared, echoed


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


def _item_inside(coll: str, item: dict[str, Any], doc: dict[str, Any], polygon: list[dict[str, float]]) -> bool:
    """Membership of one item in home coordinates (the same rule as room_subset)."""
    from . import plan_geometry as pg

    dims = doc.get("dimensions") or {}
    w, h = float(dims.get("width_px") or 1000), float(dims.get("height_px") or 1000)
    scale, _ = pg.effective_scale(doc)
    poly = poly_px(polygon, w, h)
    try:
        if coll in ("objects", "labels"):
            p = item.get("position")
            return near((float(p[0]) * w, float(p[1]) * h), poly, POINT_TOL_M / scale)
        if coll in ("walls", "connectors"):
            thick = item.get("thickness_m") if coll == "walls" and _num(item.get("thickness_m")) else pg.DEFAULT_WALL_THICKNESS_M
            tol = max(float(thick), WALL_TOL_M) / scale
            pts = [(float(p[0]) * w, float(p[1]) * h) for p in item.get("polyline") or []]
            if len(pts) < 2:
                return False
            pieces, total = clip_intervals(pts, poly, tol)
            return len(pieces) == 1 and pieces[0][0] <= 1e-6 and pieces[0][1] >= total - 1e-6
    except (TypeError, ValueError, IndexError):
        return False
    return True  # openings follow their wall, circuits and groups their members


def plan_edits(conn: sqlite3.Connection, floor_id: str, sent_shared: dict[str, dict[str, list[dict[str, Any]]]], echoed: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """The shared items a client of `floor_id` (the other floor) sent, planned as writes to each home floor's editor
    draft: what changed, was added (a namespaced new id) or removed against the current attach. Only rooms shared with
    this floor, only items inside the room before and after, never a read-only piece (ignored), never a derived
    connector (the home save regenerates it). A home floor whose echo is missing is not touched (a client that never
    read the mirror must not delete it); a home draft that moved since the client read it raises 409 when anything
    differs. Writes NOTHING - an API error still commits the request's transaction (db.connection), so every refusal
    must come before the first write; commit_edits() writes the plan. Returns one entry per home floor to write."""
    from . import geometry_store as store

    shares = shares_of_floor(conn, floor_id)
    by_home: dict[str, list[Share]] = {}
    for s in shares:
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
        # the current attach, by zone, and the shares by zone
        view: dict[str, dict[str, dict[str, Any]]] = {c: {} for c in SHARED_COLLECTIONS}
        owner: dict[str, Share] = {}
        places: dict[str, Placement] = {}
        for s in hs:
            place = Placement(s.placement, _dims_of(hv.version, hv.doc), _dims_of(other_v))
            places[s.zone_id] = place
            for coll, items in project(room_subset(hv.doc, s.zone_polygon), s, place, level_ids, default_level).items():
                for it in items:
                    view[coll].setdefault(it["id"], it)
                    owner.setdefault(it["id"], s)
        changed: dict[str, list[tuple[dict[str, Any] | None, dict[str, Any] | None, Share]]] = {c: [] for c in SHARED_COLLECTIONS}
        for coll in SHARED_COLLECTIONS:
            got = {i["id"]: i for i in sent.get(coll, []) if isinstance(i.get("id"), str)}
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
                    zid = (it.get("shared") or {}).get("zone_id")
                    s = next((x for x in hs if x.zone_id == zid), hs[0])
                    changed[coll].append((None, it, s))
            for iid, cur in view[coll].items():
                if iid not in got and not cur["shared"].get("readonly") and not (coll == "connectors" and str(un_ns(H, iid)).startswith("cx-")):
                    changed[coll].append((cur, None, owner[iid]))
        if not any(changed.values()):
            continue
        if echo.get("home_revision") != hv.revision:
            raise SharedEditError(409, "stale_revision", "החלל המשותף עודכן מהקומה השנייה בינתיים; העורך ימזג ויטען מחדש.",
                                  current_revision=hv.revision, sent_revision=echo.get("home_revision"), shared=True, home_floor_id=H)
        doc = copy.deepcopy(hv.doc)
        counts = {"changed": 0, "added": 0, "removed": 0}
        zones: set[str] = set()
        for coll, rows in changed.items():
            if not rows:
                continue
            items = list(doc.get(coll) or [])
            index = {i.get("id"): n for n, i in enumerate(items) if isinstance(i, dict)}
            drop: set[str] = set()
            for cur, new, s in rows:
                zones.add(s.zone_id)
                place = places[s.zone_id]
                if new is None:
                    drop.add(un_ns(H, cur["id"]))
                    counts["removed"] += 1
                    continue
                back = unproject(coll, new, s, place, level_ids, default_level)
                if not _item_inside(coll, back, doc, s.zone_polygon):
                    raise SharedEditError(422, "shared_outside", "אפשר לערוך מכאן רק את מה שבתוך החלל המשותף; את השאר ערוך בקומה שלו.", id=new.get("id"), collection=coll)
                if coll == "openings":
                    host = back.get("wall_id")
                    if not any(isinstance(wl, dict) and wl.get("id") == host for wl in doc.get("walls") or []) and not any(
                            un_ns(H, x[1]["id"]) == host for x in changed.get("walls", []) if x[1] is not None):
                        raise SharedEditError(422, "shared_outside", "הפתח חייב לשבת על קיר של החלל המשותף.", id=new.get("id"), collection=coll)
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


def mirrored_anchor_floors(conn: sqlite3.Connection, at: str | None = None) -> dict[tuple[str, str], list[tuple[str, str]]]:
    """THE reach helper (CR-009 §6): every anchor inside a shared room on its home floor, keyed (resource_type,
    resource_id), with the (other floor, home floor) pairs the room reaches. Computed per call from the live rows - a
    share or un-share is seen by the very next request. Empty (one cheap query) when nothing is shared."""
    shares = _rows(conn, "", (), at)
    if not shares:
        return {}
    by_home: dict[str, list[Share]] = {}
    for s in shares:
        by_home.setdefault(s.home_floor_id, []).append(s)
    out: dict[tuple[str, str], list[tuple[str, str]]] = {}
    q = ",".join("?" * len(by_home))
    cond = "effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)" if at else "effective_to IS NULL"
    rows = conn.execute(f"SELECT resource_type, resource_id, floor_id, x, y FROM map_anchors WHERE floor_id IN ({q}) AND {cond}", (*sorted(by_home), *((at, at) if at else ()))).fetchall()
    dims = {H: _anchor_tol(conn, H) for H in by_home}
    for a in rows:
        for s in by_home.get(a["floor_id"], []):
            if anchor_in_room(a["x"], a["y"], s, dims[s.home_floor_id]):
                pair = (s.floor_id, s.home_floor_id)
                lst = out.setdefault((a["resource_type"], a["resource_id"]), [])
                if pair not in lst:
                    lst.append(pair)
    return out


def camera_shared_floors(conn: sqlite3.Connection, camera_id: str) -> list[str]:
    """The other floors a camera reaches through the shared rooms it is anchored in (rbac.camera_floors)."""
    if not any_active(conn):
        return []
    return sorted({f for f, _h in mirrored_anchor_floors(conn).get(("camera", camera_id), [])})


def floor_mirrored(conn: sqlite3.Connection, floor_id: str) -> set[tuple[str, str]]:
    """(resource_type, resource_id) of the anchors mirrored onto a floor."""
    if not any_active(conn):
        return set()
    return {k for k, pairs in mirrored_anchor_floors(conn).items() if any(f == floor_id for f, _h in pairs)}


def shared_circuit_switches(conn: sqlite3.Connection) -> dict[str, list[tuple[str, str]]]:
    """The switch entity of every circuit of a shared room (its home floor's published structure), keyed entity id ->
    (other floor, home floor): such a switch counts as placed on the other floor too (ha_scope.placements)."""
    from . import geometry_store as store

    out: dict[str, list[tuple[str, str]]] = {}
    for s in all_shares(conn):
        v = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 1", (s.home_floor_id,)).fetchone()
        row = store.published_row(conn, v["id"]) if v is not None else None
        if row is None:
            continue
        for k in room_subset(store.load_doc(row), s.zone_polygon)["circuits"]:
            eid = k.get("switch_entity_id")
            if isinstance(eid, str):
                lst = out.setdefault(eid, [])
                if (s.floor_id, s.home_floor_id) not in lst:
                    lst.append((s.floor_id, s.home_floor_id))
    return out


def bundle_parts(conn: sqlite3.Connection, floor_id: str, version: sqlite3.Row | None, at: str | None = None, *,
                 can_attach: Callable[[str], bool] | None = None) -> tuple[list[dict[str, Any]], list[tuple[sqlite3.Row, dict[str, Any]]]]:
    """What the map bundle of the other floor adds: the shared zones (polygon in this plan's coordinates, `shared`) and
    the home anchors inside them (row, overrides: position, rotation, coverage, level, `shared`)."""
    mirrors = shares_of_floor(conn, floor_id, at)
    if not mirrors or version is None:
        return [], []
    from ..routers.zones import zone_row

    zones: list[dict[str, Any]] = []
    anchors: list[tuple[sqlite3.Row, dict[str, Any]]] = []
    seen: set[str] = set()
    for s in mirrors:
        if can_attach is not None and not can_attach(s.home_floor_id):
            continue
        hfloor = _floor(conn, s.home_floor_id)
        hver = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('published', 'draft') ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, created_at DESC LIMIT 1",
                            (s.home_floor_id,)).fetchone()
        if hfloor is None or hver is None:
            continue
        place = Placement(s.placement, _dims_of(hver), _dims_of(version))
        z = conn.execute("SELECT * FROM spatial_zones WHERE id = ?", (s.zone_id,)).fetchone()
        zr = zone_row(z)
        default_level = "L0"
        zr.update({"polygon": [{"x": q[0], "y": q[1]} for q in (place.pt((p["x"], p["y"])) for p in s.zone_polygon)], "level_id": ns(s.home_floor_id, z["level_id"] or default_level),
                   "shared": {"role": "mirror", "zone_id": s.zone_id, "home_floor_id": s.home_floor_id, "home_floor_name": hfloor["name"], "home_floor_level": hfloor["level"],
                              "label": surface_label(hfloor["level"])}})
        zones.append(zr)
        dims = _anchor_tol(conn, s.home_floor_id)
        cond = "effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)" if at else "effective_to IS NULL"
        for a in conn.execute(f"SELECT * FROM map_anchors WHERE floor_id = ? AND {cond} ORDER BY layer_id, resource_id", (s.home_floor_id, *((at, at) if at else ()))).fetchall():
            if a["id"] in seen or not anchor_in_room(a["x"], a["y"], s, dims):
                continue
            seen.add(a["id"])
            x, y = place.pt((a["x"], a["y"]))
            cov = None
            if a["coverage_polygon"]:
                try:
                    cov = [place.pt(p) for p in json.loads(a["coverage_polygon"])]
                except (ValueError, TypeError, IndexError):
                    cov = None
            anchors.append((a, {"position": {"x": x, "y": y}, "rotation_degrees": place.angle(a["rotation_degrees"] or 0),
                                "coverage_polygon": cov, "coverage_radius": round(a["coverage_radius"] * place.k, 6) if a["coverage_radius"] and not place.same else a["coverage_radius"],
                                "level_id": ns(s.home_floor_id, a["level_id"] or default_level),
                                "shared": {"zone_id": s.zone_id, "home_floor_id": s.home_floor_id, "home_floor_name": hfloor["name"], "label": surface_label(hfloor["level"])}}))
    return zones, anchors


def editor_placement(conn: sqlite3.Connection, share: Share) -> Placement:
    """The placement between the two floors' editor versions (what an edit made on the other floor's map is in)."""
    from . import geometry_store as store

    return Placement(share.placement, _dims_of(store.editor_version(conn, share.home_floor_id)), _dims_of(store.editor_version(conn, share.floor_id)))


def live_placement(conn: sqlite3.Connection, share: Share) -> Placement:
    """The placement between the plan versions the live maps show (bundle_parts): published first, else the draft."""
    q = "SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('published', 'draft') ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, created_at DESC LIMIT 1"
    return Placement(share.placement, _dims_of(conn.execute(q, (share.home_floor_id,)).fetchone()), _dims_of(conn.execute(q, (share.floor_id,)).fetchone()))


def anchor_via(conn: sqlite3.Connection, anchor: sqlite3.Row, from_floor_id: str) -> tuple[Share, Placement]:
    """An anchor of a home floor edited from the other floor (CR-009 decision 1): the share of a room that holds it and
    shows it on `from_floor_id`, with the placement of the maps the edit comes from. Raises SharedEditError otherwise."""
    for s in shares_of_floor(conn, from_floor_id):
        if s.home_floor_id == anchor["floor_id"] and anchor_in_room(anchor["x"], anchor["y"], s, _anchor_tol(conn, s.home_floor_id)):
            return s, live_placement(conn, s)
    raise SharedEditError(422, "not_shared", "העוגן לא נמצא בחלל משותף שמוצג בקומה הזו.")


def room_at(conn: sqlite3.Connection, floor_id: str, x: float, y: float) -> tuple[Share, Placement] | None:
    """The shared room (of another home floor) at a point of this floor's map, if any."""
    for s in shares_of_floor(conn, floor_id):
        place = live_placement(conn, s)
        hx, hy = place.inv(float(x), float(y))
        if anchor_in_room(hx, hy, s, _anchor_tol(conn, s.home_floor_id)):
            return s, place
    return None


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
        for k in room_subset(hv.doc, s.zone_polygon)["circuits"]:
            out.append({**{kk: v for kk, v in k.items() if not kk.startswith("_")}, "id": ns(s.home_floor_id, k["id"]),
                        "member_ids": [ns(s.home_floor_id, m) for m in k.get("member_ids") or []]})
    return out


def home_zone_marks(conn: sqlite3.Connection, floor_id: str) -> dict[str, dict[str, Any]]:
    """zone id -> the `shared` mark of this floor's own rooms that other floors show (the chip on the home map too)."""
    out: dict[str, dict[str, Any]] = {}
    me = _floor(conn, floor_id)
    for s in shares_from_floor(conn, floor_id):
        other = _floor(conn, s.floor_id)
        mark = out.setdefault(s.zone_id, {"role": "home", "zone_id": s.zone_id, "home_floor_id": floor_id, "home_floor_name": me["name"] if me else "",
                                          "home_floor_level": me["level"] if me else None, "label": surface_label(me["level"] if me else ""), "floors": []})
        if other is not None:
            mark["floors"].append({"floor_id": s.floor_id, "name": other["name"], "level": other["level"]})
    return out


def shared_tag(conn: sqlite3.Connection, floor_id: str, mode: str = "published", at: str | None = None) -> str:
    """The part of a read's cache key that follows the other floors (a change on the home floor, a share, an un-share, a
    placement or polygon edit): "" when the floor shares nothing either way."""
    mirrors = shares_of_floor(conn, floor_id, at if mode == "at" else None)
    homes = shares_from_floor(conn, floor_id, at if mode == "at" else None)
    if not mirrors and not homes:
        return ""
    parts: list[Any] = []
    for s in mirrors:
        hv = home_view(conn, s.home_floor_id, mode, at) if mode != "draft" else None
        if mode == "draft":
            from . import geometry_store as store

            v = store.editor_version(conn, s.home_floor_id)
            row = (store.draft_row(conn, v["id"]) or store.published_row(conn, v["id"])) if v is not None else None
            h = row["doc_hash"] if row is not None else None
        else:
            h = hv.row["doc_hash"] if hv is not None and hv.row is not None else None
        f = _floor(conn, s.home_floor_id)
        parts.append(["m", s.id, s.revision, s.zone_revision, h, f["name"] if f else None, f["level"] if f else None])
    for s in homes:
        f = _floor(conn, s.floor_id)
        parts.append(["h", s.id, s.revision, s.zone_revision, f["name"] if f else None, f["level"] if f else None])
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------- conversion (the owner's two drawings -> one room)

def _centroid(poly: list[Pt]) -> Pt:
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
    duplicate room's centroid and size (its area in width units), or - without one - the plan centre and the calibrated
    metres."""
    from . import geometry_store as store

    if store.frame_of(conn, home_v, other_v) is not None and not rotation_deg:
        return {"mode": "same_frame"}
    ha = float(home_v["height_px"]) / float(home_v["width_px"])
    hb = float(other_v["height_px"]) / float(other_v["width_px"])
    zpoly = json.loads(zone["polygon_json"])
    ca = _centroid(_wu(zpoly, ha))
    frm = [_r6(ca[0]), _r6(ca[1] / ha)]
    if duplicate is not None:
        dpoly = json.loads(duplicate["polygon_json"])
        cb = _centroid(_wu(dpoly, hb))
        aa, ab = _area(_wu(zpoly, ha)), _area(_wu(dpoly, hb))
        k = math.sqrt(ab / aa) if aa > 1e-12 else 1.0
        to = [_r6(cb[0]), _r6(cb[1] / hb)]
    else:
        k = (float(home_v["width_px"]) * _scale_of_version(home_v)) / (float(other_v["width_px"]) * _scale_of_version(other_v))
        to = list(frm)
    return {"mode": "fit", "from": frm, "to": to, "rotation_deg": round(float(rotation_deg) % 360, 3), "scale": round(k, 6)}


def candidates(conn: sqlite3.Connection, zone: sqlite3.Row, other_floor_id: str, same_frame: bool) -> list[dict[str, Any]]:
    """The rooms of the other floor that may be the duplicate: by name (equal 1.0, one inside the other 0.7) and, when
    the two plans share a frame, by overlap (IoU); best first."""
    zpoly = json.loads(zone["polygon_json"])
    out: list[dict[str, Any]] = []
    for z in conn.execute("SELECT * FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid", (other_floor_id,)).fetchall():
        try:
            poly = json.loads(z["polygon_json"])
        except ValueError:
            continue
        if any(s.floor_id == zone["floor_id"] for s in shares_of_zone(conn, z["id"])):
            continue  # a room of that floor already shared here
        name = _name_score(zone["name"], z["name"])
        overlap = round(_overlap(zpoly, poly), 3) if same_frame else None
        score = round(max(name, overlap or 0.0) if overlap is None or name == 0 else (name + (overlap or 0)) / 2 + 0.25 * min(name, overlap or 0), 3)
        out.append({"zone_id": z["id"], "name": z["name"], "name_score": name, "overlap": overlap, "score": score})
    out.sort(key=lambda c: -c["score"])
    return out


def _removal(doc: dict[str, Any], polygon: list[dict[str, float]]) -> tuple[dict[str, list[str]], list[str], dict[str, Any]]:
    """What leaves the other floor's draft: its items inside the duplicate room (walls wholly inside and their openings,
    objects, labels, same-floor connectors), circuits and groups pruned; walls crossing the outline kept and listed.
    Returns (removed ids by collection, kept crossing wall ids, the new document)."""
    sub = room_subset(doc, polygon)
    walls = {w["id"] for w in sub["walls"] if not w.get("_readonly")}
    crossing = sorted({w["id"].rsplit("#", 1)[0] for w in sub["walls"] if w.get("_readonly")})
    objects = {o["id"] for o in sub["objects"]}
    labels = {lb["id"] for lb in sub["labels"]}
    conns = {c["id"] for c in sub["connectors"] if not c.get("_readonly")}
    openings = {o["id"] for o in doc.get("openings") or [] if isinstance(o, dict) and o.get("wall_id") in walls}
    new = copy.deepcopy(doc)
    new["walls"] = [w for w in new.get("walls") or [] if not (isinstance(w, dict) and w.get("id") in walls)]
    new["openings"] = [o for o in new.get("openings") or [] if not (isinstance(o, dict) and o.get("id") in openings)]
    new["objects"] = [o for o in new.get("objects") or [] if not (isinstance(o, dict) and o.get("id") in objects)]
    new["labels"] = [lb for lb in new.get("labels") or [] if not (isinstance(lb, dict) and lb.get("id") in labels)]
    new["connectors"] = [c for c in new.get("connectors") or [] if not (isinstance(c, dict) and (c.get("id") in conns or c.get("object_id") in objects))]
    circuits: list[str] = []
    groups: list[str] = []
    for coll, gone in (("circuits", circuits), ("groups", groups)):
        kept = []
        for k in new.get(coll) or []:
            if not isinstance(k, dict):
                continue
            members = [m for m in k.get("member_ids") or [] if m not in objects]
            if isinstance(k.get("member_ids"), list) and k["member_ids"] and not members:
                gone.append(k["id"])
                continue
            kept.append({**k, "member_ids": members} if isinstance(k.get("member_ids"), list) else k)
        new[coll] = kept
    for o in new.get("objects") or []:
        if isinstance(o, dict) and o.get("group_id") in groups:
            o["group_id"] = None
    removed = {"walls": sorted(walls), "openings": sorted(openings), "objects": sorted(objects), "labels": sorted(labels), "connectors": sorted(conns),
               "circuits": sorted(circuits), "groups": sorted(groups)}
    return removed, crossing, new


def plan_conversion(conn: sqlite3.Connection, zone: sqlite3.Row, other_floor_id: str, duplicate_zone_id: str | None, rotation_deg: float = 0.0,
                    auto: bool = True) -> dict[str, Any]:
    """Everything the conversion will do, computed without writing: the placement, the duplicate room (chosen or
    auto-detected), what leaves the other floor's draft, and the fate of every anchor inside the duplicate room
    ("rebind": moved to the home floor at the un-transformed position; "drop_duplicate": the home room already has
    that camera / entity, the mirror shows it). Raises SharedEditError for a request that cannot be converted."""
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
    elif auto and cands and cands[0]["score"] >= 0.5:
        dup = conn.execute("SELECT * FROM spatial_zones WHERE id = ?", (cands[0]["zone_id"],)).fetchone()
    placement = fit_placement(conn, home_v, other_v, zone, dup, rotation_deg)
    odoc, odraft = store.working_doc(conn, other_v)
    hdoc, _ = store.working_doc(conn, home_v)
    place = Placement(placement, _dims_of(home_v, hdoc), _dims_of(other_v, odoc))
    zpoly = json.loads(zone["polygon_json"])
    mirror_poly = [{"x": q[0], "y": q[1]} for q in (place.pt((p["x"], p["y"])) for p in zpoly)]
    area_poly = json.loads(dup["polygon_json"]) if dup is not None else mirror_poly
    removed, crossing, new_doc = _removal(odoc, area_poly)
    # anchors of the duplicate drawing
    ow, oh, otol = _anchor_tol(conn, other_floor_id)
    opoly = poly_px(area_poly, ow, oh)
    home_has = {(a["resource_type"], a["resource_id"]) for a in conn.execute("SELECT resource_type, resource_id FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (home_id,)).fetchall()}
    names = {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}
    anchors: list[dict[str, Any]] = []
    hw, hh, _ = _anchor_tol(conn, home_id)
    for a in conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (other_floor_id,)).fetchall():
        if not near((float(a["x"]) * ow, float(a["y"]) * oh), opoly, otol):
            continue
        key = (a["resource_type"], a["resource_id"])
        name = names.get(a["resource_id"]) if a["resource_type"] == "camera" else (a["label"] or a["resource_id"])
        if key in home_has:
            anchors.append({"anchor_id": a["id"], "resource_type": a["resource_type"], "resource_id": a["resource_id"], "name": name, "action": "drop_duplicate"})
        else:
            x, y = place.inv(float(a["x"]), float(a["y"]))
            anchors.append({"anchor_id": a["id"], "resource_type": a["resource_type"], "resource_id": a["resource_id"], "name": name, "action": "rebind",
                            "to": {"floor_id": home_id, "x": round(min(1.0, max(0.0, x)), 4), "y": round(min(1.0, max(0.0, y)), 4), "rotation_degrees": place.iangle(a["rotation_degrees"] or 0)}})
    hsub = room_subset(hdoc, zpoly)
    return {
        "zone": {"id": zone["id"], "name": zone["name"], "floor_id": home_id, "floor_name": home["name"], "floor_level": home["level"]},
        "other_floor": {"id": other_floor_id, "name": other["name"], "level": other["level"], "version_id": other_v["id"], "revision": odraft["revision"] if odraft is not None else 0},
        "home_version_id": home_v["id"], "same_frame": same, "placement": placement, "mirror_polygon": mirror_poly,
        "duplicate": ({"zone_id": dup["id"], "name": dup["name"], "polygon": json.loads(dup["polygon_json"])} if dup is not None else None),
        "candidates": cands,
        "remove": {**{k: len(v) for k, v in removed.items()}, "zone": 1 if dup is not None else 0}, "removed_ids": removed, "crossing_walls_kept": crossing,
        "anchors": anchors,
        "attach": {"walls": sum(1 for w in hsub["walls"] if not w.get("_readonly")), "clipped_walls": sum(1 for w in hsub["walls"] if w.get("_readonly")),
                   "openings": len(hsub["openings"]), "objects": len(hsub["objects"]), "labels": len(hsub["labels"]), "connectors": len(hsub["connectors"]),
                   "circuits": len(hsub["circuits"]),
                   "anchors": sum(1 for a in conn.execute("SELECT x, y FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (home_id,)).fetchall()
                                  if near((float(a["x"]) * hw, float(a["y"]) * hh), poly_px(zpoly, hw, hh), _anchor_tol(conn, home_id)[2]))},
        "_new_doc": new_doc, "_other_version": other_v, "_other_draft_revision": odraft["revision"] if odraft is not None else 0,
    }


def public(plan: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in plan.items() if not k.startswith("_")}


def apply_conversion(conn: sqlite3.Connection, zone: sqlite3.Row, plan: dict[str, Any], actor_id: str | None, now: str) -> dict[str, Any]:
    """The plan, written in the caller's transaction: the other floor's draft without the duplicate drawing, its
    anchors re-bound or dropped (tombstoned, never deleted), the duplicate zone soft-deleted, the share row inserted."""
    from ..db import new_id
    from . import geometry_store as store

    other_v = plan["_other_version"]
    if any(plan["remove"][k] for k in ("walls", "openings", "objects", "labels", "connectors", "circuits", "groups")):
        store.save_draft(conn, other_v, plan["_new_doc"], plan["_other_draft_revision"], actor_id, now)
    home_id = zone["floor_id"]
    home_v = store.editor_version(conn, home_id)
    rebound: list[dict[str, Any]] = []
    for item in plan["anchors"]:
        a = conn.execute("SELECT * FROM map_anchors WHERE id = ? AND effective_to IS NULL", (item["anchor_id"],)).fetchone()
        if a is None:
            continue
        conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, actor_id, now, a["id"]))
        store.unbind_anchor(conn, a["floor_id"], a["resource_type"], a["resource_id"], actor_id, now, last={"x": a["x"], "y": a["y"], "rotation": a["rotation_degrees"] or 0})
        if item["action"] != "rebind":
            continue
        dup = conn.execute("SELECT id FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = ? AND resource_id = ?", (home_id, a["resource_type"], a["resource_id"])).fetchone()
        if dup is not None:
            continue
        aid = new_id()
        cov = None
        if a["coverage_polygon"]:
            try:
                place = Placement(plan["placement"], _dims_of(home_v), _dims_of(other_v))
                cov = json.dumps([place.ipt(p) for p in json.loads(a["coverage_polygon"])])
            except (ValueError, TypeError, IndexError):
                cov = None
        conn.execute(
            """INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at, coverage_radius, coverage_polygon, label_pos, level_id, mount_height_m, tilt_deg)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (aid, home_id, home_v["id"] if home_v is not None else a["plan_version_id"], a["resource_type"], a["resource_id"], item["to"]["x"], item["to"]["y"], item["to"]["rotation_degrees"],
             a["field_of_view_degrees"], a["layer_id"], a["label"], now, actor_id, actor_id, now, None if cov is None and a["coverage_radius"] is None else a["coverage_radius"], cov,
             a["label_pos"], None, a["mount_height_m"], a["tilt_deg"]))
        rebound.append({"from_anchor_id": a["id"], "anchor_id": aid, "resource": f"{a['resource_type']}:{a['resource_id']}"})
    if plan["duplicate"] is not None:
        conn.execute("UPDATE spatial_zones SET deleted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND deleted_at IS NULL", (now, now, plan["duplicate"]["zone_id"]))
    sid = new_id()
    conn.execute("INSERT INTO shared_spaces(id, zone_id, home_floor_id, floor_id, placement_json, revision, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)",
                 (sid, zone["id"], home_id, plan["other_floor"]["id"], json.dumps(plan["placement"]), actor_id, now, now))
    return {"share_id": sid, "rebound": rebound, "dropped": [i["anchor_id"] for i in plan["anchors"] if i["action"] == "drop_duplicate"]}


def unshare(conn: sqlite3.Connection, zone_id: str, floor_id: str, actor_id: str | None, now: str) -> bool:
    try:
        cur = conn.execute("UPDATE shared_spaces SET removed_at = ?, removed_by = ?, updated_at = ?, revision = revision + 1 WHERE zone_id = ? AND floor_id = ? AND removed_at IS NULL",
                           (now, actor_id, now, zone_id, floor_id))
    except sqlite3.OperationalError:
        return False
    return cur.rowcount > 0


def set_placement(conn: sqlite3.Connection, zone_id: str, floor_id: str, placement: dict[str, Any], now: str) -> bool:
    cur = conn.execute("UPDATE shared_spaces SET placement_json = ?, updated_at = ?, revision = revision + 1 WHERE zone_id = ? AND floor_id = ? AND removed_at IS NULL",
                       (json.dumps(placement), now, zone_id, floor_id))
    return cur.rowcount > 0


def room_cameras(conn: sqlite3.Connection, zone: sqlite3.Row) -> list[str]:
    """The cameras anchored inside a room on its floor (sharing widens their reach: T055 B1)."""
    tmp = Share("", zone["id"], zone["floor_id"], "", {"mode": "same_frame"}, 1, "", zone["name"] or "", json.loads(zone["polygon_json"]), int(zone["revision"]), zone["level_id"])
    dims = _anchor_tol(conn, zone["floor_id"])
    return sorted({a["resource_id"] for a in conn.execute("SELECT resource_id, x, y FROM map_anchors WHERE floor_id = ? AND resource_type = 'camera' AND effective_to IS NULL", (zone["floor_id"],)).fetchall()
                   if anchor_in_room(a["x"], a["y"], tmp, dims)})
