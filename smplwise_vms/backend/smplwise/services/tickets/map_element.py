"""TKMAP1 (owner 16.10): a map element attached to a service request - the reference, the snapshot, the manager's view of it and the
vendor's picture (map_image.py).

An element is
- an ANCHOR (`map_anchors`, a camera or a device placed on a floor; live = `effective_to IS NULL`), addressed by its row id, or found
  from a camera / entity id (its current anchor; several floors: the lowest floor, the place.py rule);
- an OBJECT of the floor's published structure document (`objects[]` of the latest published plan version's published geometry).
Attaching stores a reference (floor, plan version, level, element id, position in plan px) and a snapshot of the names (element,
floor, room - the smallest room of that level containing the point). The element is LIVE while it is still on the floor's current
map; once it is gone (the anchor deleted, the object removed or the floor's published plan replaced without it) the request keeps
the snapshot: the manager sees "no longer on the map", the vendor page the stored text only and NO image is drawn.

The vendor's picture uses the CURRENT position of a live element on the floor's CURRENT published plan (an element moved since the
attach is drawn where it is now). No uploaded drawing, no other object, no ids (map_image.py). Every SQL statement of this feature is
in this module (its own table, read-only lookups of the map tables)."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ...db import now_iso
from ..plan_geometry import DEFAULT_LEVEL_ID
from . import map_image

SEP = " · "
KINDS = ("anchor", "object")
NAME_MAX = 120


@dataclass(frozen=True)
class Element:
    """An element as it is on the map NOW."""

    kind: str  # anchor | object
    type: str  # camera | ha_entity | object
    element_id: str
    resource_id: str | None
    floor_id: str
    plan_version_id: str | None
    level_id: str
    x: float  # plan-normalised 0..1
    y: float
    width_px: float
    height_px: float
    name: str
    floor_name: str
    room_name: str | None

    @property
    def x_px(self) -> float:
        return round(self.x * self.width_px, 2)

    @property
    def y_px(self) -> float:
        return round(self.y * self.height_px, 2)


# ---------------------------------------------------------------- map lookups (read-only)


def _floor(conn: sqlite3.Connection, floor_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT id, name, level FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()
    return dict(r) if r else None


def published_version(conn: sqlite3.Connection, floor_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT id, width_px, height_px FROM plan_versions WHERE floor_id = ? AND status = 'published' ORDER BY created_at DESC, rowid DESC LIMIT 1",
                     (floor_id,)).fetchone()
    return dict(r) if r else None


def published_doc(conn: sqlite3.Connection, version_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT doc_json FROM plan_geometry WHERE plan_version_id = ? AND status = 'published' ORDER BY updated_at DESC, rowid DESC LIMIT 1",
                     (version_id,)).fetchone()
    if r is None:
        return None
    try:
        doc = json.loads(r["doc_json"])
    except ValueError:
        return None
    return doc if isinstance(doc, dict) else None


def _default_level(doc: dict[str, Any] | None) -> str:
    for lv in (doc or {}).get("levels") or []:
        if isinstance(lv, dict) and lv.get("is_default") and isinstance(lv.get("id"), str):
            return lv["id"]
    return DEFAULT_LEVEL_ID


def floor_zones(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    """The floor's OWN rooms (never the rooms other floors share in), outline parsed; a malformed outline is dropped."""
    out: list[dict[str, Any]] = []
    for r in conn.execute("SELECT name, polygon_json, level_id FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY id", (floor_id,)).fetchall():
        try:
            poly = json.loads(r["polygon_json"])
        except ValueError:
            continue
        if isinstance(poly, list) and len(poly) >= 3:
            out.append({"name": r["name"] or "", "polygon": poly, "level_id": r["level_id"]})
    return out


def _inside(x: float, y: float, poly: list[dict[str, Any]]) -> bool:
    hit = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi, xj, yj = float(poly[i]["x"]), float(poly[i]["y"]), float(poly[j]["x"]), float(poly[j]["y"])
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            hit = not hit
        j = i
    return hit


def room_at(zones: list[dict[str, Any]], level: str, x: float, y: float) -> str | None:
    """The NAME of the smallest room of `level` containing the point (place.py's rule), None outside every room."""
    best: tuple[float, str] | None = None
    for z in zones:
        if (z.get("level_id") or DEFAULT_LEVEL_ID) != level or not str(z.get("name") or "").strip():
            continue
        poly = z["polygon"]
        try:
            if not _inside(x, y, poly):
                continue
            area = abs(sum(float(poly[i]["x"]) * float(poly[(i + 1) % len(poly)]["y"]) - float(poly[(i + 1) % len(poly)]["x"]) * float(poly[i]["y"])
                           for i in range(len(poly)))) / 2
        except (KeyError, TypeError, ValueError):
            continue
        if best is None or area < best[0]:
            best = (area, str(z["name"]))
    return best[1] if best else None


def _anchor_name(conn: sqlite3.Connection, a: sqlite3.Row) -> str:
    if a["label"]:
        return str(a["label"])
    if a["resource_type"] == "camera":
        c = conn.execute("SELECT alias, name_source FROM cameras WHERE id = ?", (a["resource_id"],)).fetchone()
        if c is not None:
            return str(c["alias"] or c["name_source"] or a["resource_id"])
    else:
        e = conn.execute("SELECT name FROM ha_entities WHERE entity_id = ?", (a["resource_id"],)).fetchone()
        if e is not None and e["name"]:
            return str(e["name"])
    return str(a["resource_id"])


def _object_name(conn: sqlite3.Connection, o: dict[str, Any]) -> str:
    if isinstance(o.get("label"), str) and o["label"].strip():
        return o["label"].strip()
    from .. import plan_catalog

    item = plan_catalog.item_index(conn).get(o.get("item_id")) or {}
    names = item.get("names") if isinstance(item.get("names"), dict) else {}
    return str(names.get("he") or names.get("en") or o.get("item_id") or "")


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and abs(f) != float("inf") else None


def _build(conn: sqlite3.Connection, floor: dict[str, Any], version: dict[str, Any] | None, doc: dict[str, Any] | None, *, kind: str, etype: str,
           element_id: str, resource_id: str | None, level: str | None, x: Any, y: Any, name: str) -> Element | None:
    xf, yf = _num(x), _num(y)
    if xf is None or yf is None or not (-0.01 <= xf <= 1.01 and -0.01 <= yf <= 1.01):
        return None
    lvl = level or _default_level(doc)
    zones = floor_zones(conn, floor["id"])
    return Element(kind=kind, type=etype, element_id=element_id, resource_id=resource_id, floor_id=floor["id"],
                   plan_version_id=version["id"] if version else None, level_id=lvl, x=xf, y=yf,
                   width_px=float(version["width_px"]) if version else 1000.0, height_px=float(version["height_px"]) if version else 1000.0,
                   name=name[:NAME_MAX], floor_name=str(floor["name"] or ""), room_name=room_at(zones, lvl, xf, yf))


def find(conn: sqlite3.Connection, floor_id: str, kind: str, element_id: str) -> Element | None:
    """The element as it is on the floor's current map now, or None (unknown, removed, on another floor, no published plan for an object)."""
    floor = _floor(conn, floor_id)
    if floor is None or kind not in KINDS:
        return None
    version = published_version(conn, floor_id)
    if kind == "anchor":
        a = conn.execute("SELECT * FROM map_anchors WHERE id = ? AND floor_id = ? AND effective_to IS NULL", (element_id, floor_id)).fetchone()
        if a is None:
            return None
        doc = published_doc(conn, version["id"]) if version else None
        return _build(conn, floor, version, doc, kind="anchor", etype=a["resource_type"], element_id=a["id"], resource_id=a["resource_id"],
                      level=a["level_id"], x=a["x"], y=a["y"], name=_anchor_name(conn, a))
    if version is None:
        return None
    doc = published_doc(conn, version["id"])
    if doc is None:
        return None
    for o in doc.get("objects") or []:
        if isinstance(o, dict) and o.get("id") == element_id:
            pos = o.get("position") if isinstance(o.get("position"), list) and len(o["position"]) == 2 else [None, None]
            ref = o.get("anchor_ref")
            if isinstance(ref, dict) and ref.get("resource_id"):  # a body bound to an anchor stands where the anchor stands
                a = conn.execute("SELECT x, y FROM map_anchors WHERE floor_id = ? AND resource_type = ? AND resource_id = ? AND effective_to IS NULL",
                                 (floor_id, ref.get("resource_type"), ref.get("resource_id"))).fetchone()
                if a is not None:
                    pos = [a["x"], a["y"]]
            return _build(conn, floor, version, doc, kind="object", etype="object", element_id=element_id, resource_id=None,
                          level=o.get("level_id") if isinstance(o.get("level_id"), str) else None, x=pos[0], y=pos[1], name=_object_name(conn, o))
    return None


def find_resource(conn: sqlite3.Connection, resource_type: str, resource_id: str) -> Element | None:
    """A camera's / device's CURRENT anchor (several floors: the lowest floor, then the floor id - place.py's rule)."""
    if resource_type not in ("camera", "ha_entity"):
        return None
    row = conn.execute(
        "SELECT a.id, a.floor_id FROM map_anchors a JOIN floors f ON f.id = a.floor_id AND f.deleted_at IS NULL "
        "WHERE a.resource_type = ? AND a.resource_id = ? AND a.effective_to IS NULL ORDER BY f.level, f.id LIMIT 1",
        (resource_type, resource_id)).fetchone()
    return find(conn, row["floor_id"], "anchor", row["id"]) if row else None


# ---------------------------------------------------------------- the stored reference


def stored(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    try:
        r = conn.execute("SELECT * FROM ticket_map_elements WHERE ticket_id = ?", (ticket_id,)).fetchone()
    except sqlite3.OperationalError:  # a database before the migration: nothing attached
        return None
    return dict(r) if r else None


def attach(conn: sqlite3.Connection, ticket_id: str, el: Element, actor_id: str | None) -> dict[str, Any]:
    """Store (or replace) the request's element; returns the row."""
    now = now_iso()
    prev = stored(conn, ticket_id)
    conn.execute(
        "INSERT INTO ticket_map_elements(ticket_id, element_kind, element_type, element_id, resource_id, floor_id, plan_version_id, level_id, x_px, y_px, "
        "name_snapshot, floor_snapshot, room_snapshot, attached_by, attached_at, revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(ticket_id) DO UPDATE SET element_kind = excluded.element_kind, element_type = excluded.element_type, element_id = excluded.element_id, "
        "resource_id = excluded.resource_id, floor_id = excluded.floor_id, plan_version_id = excluded.plan_version_id, level_id = excluded.level_id, "
        "x_px = excluded.x_px, y_px = excluded.y_px, name_snapshot = excluded.name_snapshot, floor_snapshot = excluded.floor_snapshot, "
        "room_snapshot = excluded.room_snapshot, attached_by = excluded.attached_by, attached_at = excluded.attached_at, revision = ticket_map_elements.revision + 1",
        (ticket_id, el.kind, el.type, el.element_id, el.resource_id, el.floor_id, el.plan_version_id, el.level_id, el.x_px, el.y_px,
         el.name, el.floor_name, el.room_name, actor_id, now, 1 if prev is None else prev["revision"] + 1))
    return stored(conn, ticket_id) or {}


def detach(conn: sqlite3.Connection, ticket_id: str) -> bool:
    try:
        return conn.execute("DELETE FROM ticket_map_elements WHERE ticket_id = ?", (ticket_id,)).rowcount > 0
    except sqlite3.OperationalError:
        return False


def live(conn: sqlite3.Connection, row: dict[str, Any]) -> Element | None:
    """The stored element as it is on the map now, or None when it left the map."""
    return find(conn, row["floor_id"], row["element_kind"], row["element_id"])


def describe(name: str, floor: str, room: str | None) -> str:
    """"<name> · <floor> · <room>" (empty parts left out) - the picture's caption and the page's one line."""
    return SEP.join(p for p in (name.strip(), floor.strip(), (room or "").strip()) if p)


# ---------------------------------------------------------------- the vendor's view


def public_block(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """What GET /t/api/ticket carries: the SNAPSHOT text and whether a picture exists - never an id, a position or a plan reference."""
    row = stored(conn, ticket_id)
    if row is None:
        return None
    return {"name": row["name_snapshot"], "floor": row["floor_snapshot"], "room": row["room_snapshot"] or "",
            "image": _drawable(live(conn, row))}


def _drawable(el: Element | None) -> bool:
    """A picture exists for a live element on a floor WITH a published plan (an anchor on a floor without one: the text only)."""
    return el is not None and el.plan_version_id is not None


def picture(conn: sqlite3.Connection, ticket_id: str) -> str | None:
    """The vendor's SVG, or None (nothing attached, or the element left the map: the stored text only, no new image)."""
    row = stored(conn, ticket_id)
    if row is None:
        return None
    el = live(conn, row)
    if not _drawable(el):
        return None
    assert el is not None
    version = published_version(conn, el.floor_id)
    doc = published_doc(conn, version["id"]) if version else None
    text = describe(row["name_snapshot"], row["floor_snapshot"], row["room_snapshot"])
    return map_image.render_public_svg(doc, floor_zones(conn, el.floor_id), el.width_px, el.height_px, level=el.level_id, x=el.x_px, y=el.y_px,
                                       caption=text, title=text)
