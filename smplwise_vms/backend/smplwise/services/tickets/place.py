"""CR-038 section 12.2: where a device is - `locate_entity(conn, entity_id)`.

1. Physical placement: the entity's CURRENT map anchor (`map_anchors`, resource_type 'ha_entity', effective_to NULL) -> floor,
   building, site (soft-deleted rows ignored); the room = the smallest room polygon of that floor containing the anchor (the
   `correlation._zone_at` rule, with the room id kept). Several anchors: the lowest floor is the place, the other floors are named.
2. Without an anchor: the room linked to the entity's HA area (`plan_area_links.area_to_zone`), else the HA area / floor NAMES only
   (no RBAC target: such a ticket is placeless for the visibility rule).
3. `place_text` = "<floor> · <room or area>" (+ the building first when the site has several buildings).

Read-only; every SQL statement of the module is in store.py (the area-to-room link is read through the existing plan_area_links)."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..correlation import _inside
from . import store

SEP = " · "


@dataclass(frozen=True)
class Place:
    site_id: str | None = None
    building_id: str | None = None
    floor_id: str | None = None
    zone_id: str | None = None
    area_id: str | None = None
    place_text: str = ""
    others: tuple[str, ...] = field(default_factory=tuple)

    def columns(self) -> dict[str, Any]:
        """The ticket columns this place fills."""
        return {"site_id": self.site_id, "building_id": self.building_id, "floor_id": self.floor_id, "zone_id": self.zone_id,
                "area_id": self.area_id, "place_text": self.place_text}


def _zone_at(conn: sqlite3.Connection, floor_id: str, x: float, y: float) -> dict[str, Any] | None:
    """The smallest room of a floor that contains the point (correlation._zone_at's rule, with the id)."""
    best: tuple[float, dict[str, Any]] | None = None
    for z in store.floor_zones(conn, floor_id):
        try:
            poly = json.loads(z["polygon_json"])
        except ValueError:
            continue
        if not isinstance(poly, list) or len(poly) < 3:
            continue
        try:
            if not _inside(x, y, poly):
                continue
            area = abs(sum(poly[i]["x"] * poly[(i + 1) % len(poly)]["y"] - poly[(i + 1) % len(poly)]["x"] * poly[i]["y"] for i in range(len(poly)))) / 2
        except (KeyError, TypeError):
            continue
        if best is None or area < best[0]:
            best = (area, z)
    return best[1] if best else None


def _text(conn: sqlite3.Connection, site_id: str | None, building: str | None, floor: str | None, room: str | None) -> str:
    parts: list[str] = []
    if building and site_id and store.site_building_count(conn, site_id) > 1:
        parts.append(building)
    parts += [p for p in (floor, room) if p]
    return SEP.join(parts)


def _area_zone(conn: sqlite3.Connection, area_id: str | None) -> dict[str, Any] | None:
    if not area_id:
        return None
    from .. import plan_area_links

    link = plan_area_links.area_to_zone(conn).get(area_id)
    return store.zone_place(conn, link["zone_id"]) if link else None


def locate_entity(conn: sqlite3.Connection, entity_id: str, entity: dict[str, Any] | None = None) -> Place:
    """The place of a catalogued entity (an unknown one: an empty, placeless Place)."""
    e = entity if entity is not None else store.entity_row(conn, entity_id)
    if e is None:
        return Place()
    area_id = e.get("area_id") or None
    anchors = store.entity_anchors(conn, entity_id)
    if anchors:
        first = anchors[0]
        zone = _zone_at(conn, first["floor_id"], float(first["x"]), float(first["y"]))
        room = zone["name"] if zone and zone.get("name") else (e.get("area_name") or None)
        others = tuple(dict.fromkeys(a["floor_name"] for a in anchors[1:] if a["floor_id"] != first["floor_id"]))
        text = _text(conn, first["site_id"], first["building_name"], first["floor_name"], room)
        if others:
            text = f"{text} (+ {', '.join(others)})"
        return Place(site_id=first["site_id"], building_id=first["building_id"], floor_id=first["floor_id"], zone_id=zone["id"] if zone else None,
                     area_id=area_id, place_text=text, others=others)
    linked = _area_zone(conn, area_id)
    if linked:
        return Place(site_id=linked["site_id"], building_id=linked["building_id"], floor_id=linked["floor_id"], zone_id=linked["zone_id"], area_id=area_id,
                     place_text=_text(conn, linked["site_id"], linked["building_name"], linked["floor_name"], linked["zone_name"] or e.get("area_name")))
    # names only: the owner's HA floor and area are labels, never an RBAC scope (services/ha_scope.py)
    return Place(area_id=area_id, place_text=SEP.join(p for p in (e.get("ha_floor_name"), e.get("area_name")) if p))
