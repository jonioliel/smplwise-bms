"""CR-ORG-LOCATIONS (owner request 2026-10-17; docs/changes/CR-ORG-LOCATIONS.md): the organisation's locations.

- Defined once in Settings > service management (`tickets.configure` edits, installation scope); read by whoever may create or see
  requests (tickets.view / tickets.create / tickets.external anywhere, or tickets.configure) - active locations only, name + address.
- A request (ticket or RFQ) stores the location's id AND a snapshot (JSON) taken at creation: editing or deactivating a location never
  rewrites a request. "Other (free text)" stays the old free-text place.
- A referenced location is never hard-deleted (409 `location_in_use`); it is deactivated instead.
- Defaults (owner answer 17.10 (b)): an optional organisation default (at most one, active) and an optional per-department default
  (wins over the organisation's). Both nullable.
- Vendors (owner answer 17.10 (c)): the location reaches a vendor only in a message / page of a request that names it. The coordinates /
  navigation link go into an RFQ's vendor messages only when the manager switched it on for that request (`location_nav`, default off).
- Text fields are plain text: controls stripped, no URL (a WhatsApp message would turn it into a link), length-capped. They are always
  rendered as text (Lit / DOM text nodes), never as HTML.
"""
from __future__ import annotations

import json
import math
import sqlite3
from typing import Any, Mapping
from urllib.parse import quote

from ...rbac import authorize
from . import model, store_locations
from .access import ALL_DEPARTMENTS, CONFIGURE, CREATE, EXTERNAL, VIEW, Viewer
from .message_templates import _URL

NAME_MAX, STREET_MAX, CITY_MAX, DETAILS_MAX = 40, 60, 30, 200
SORT_MAX = 9999
LOCATIONS_MAX = 200  # an installation's list stays a picker, not a directory
SEP = " · "
READ_PERMISSIONS = (VIEW, CREATE, EXTERNAL, CONFIGURE, ALL_DEPARTMENTS)


class Invalid(Exception):
    def __init__(self, field: str, code: str):
        super().__init__(f"{field}:{code}")
        self.field, self.code = field, code


def may_read(viewer: Viewer) -> bool:
    return any(p in viewer.anywhere for p in READ_PERMISSIONS) or viewer.holds_installation(CONFIGURE)


def _text(value: Any, field: str, max_len: int, *, required: bool = False) -> str:
    try:
        text = model.text_field(value, field, required=required, max_len=max_len)
    except model.Invalid as exc:
        raise Invalid(exc.problems[0].field, exc.problems[0].code) from None
    if _URL.search(text):
        raise Invalid(field, "url_not_allowed")
    return text


def _coord(value: Any, field: str, limit: float) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)) or abs(float(value)) > limit:
        raise Invalid(field, "range")
    return round(float(value), 6)


def clean_fields(conn: sqlite3.Connection, body: Mapping[str, Any], *, current: Mapping[str, Any] | None) -> dict[str, Any]:
    """The columns a create (current None) or a patch (only the keys sent) writes. Raises Invalid."""
    creating = current is None
    out: dict[str, Any] = {}
    if creating or "name" in body:
        out["name"] = _text(body.get("name"), "name", NAME_MAX, required=True)
        if store_locations.name_taken(conn, out["name"], None if creating else current["id"]):
            raise Invalid("name", "duplicate")
    for key, limit in (("street", STREET_MAX), ("city", CITY_MAX), ("details", DETAILS_MAX)):
        if key in body:
            out[key] = _text(body.get(key), key, limit)
    if "lat" in body or "lng" in body:
        lat = _coord(body.get("lat", None if creating else current.get("lat")), "lat", 90)
        lng = _coord(body.get("lng", None if creating else current.get("lng")), "lng", 180)
        if (lat is None) != (lng is None):
            raise Invalid("lat" if lat is None else "lng", "pair")
        out["lat"], out["lng"] = lat, lng
    if "sort_order" in body and body["sort_order"] is not None:
        s = body["sort_order"]
        if isinstance(s, bool) or not isinstance(s, int) or not 0 <= s <= SORT_MAX:
            raise Invalid("sort_order", "range")
        out["sort_order"] = s
    active = bool(body["active"]) if body.get("active") is not None else (True if creating else bool(current["active"]))
    if body.get("active") is not None:
        out["active"] = 1 if active else 0
    if body.get("is_default") is not None:
        if body["is_default"] and not active:
            raise Invalid("is_default", "inactive")
        out["is_default"] = 1 if body["is_default"] else 0
    elif not active and current is not None and current.get("is_default"):
        out["is_default"] = 0  # a deactivated location stops being the default
    street = out.get("street", (current or {}).get("street", ""))
    city = out.get("city", (current or {}).get("city", ""))
    if creating and not (street or city):
        raise Invalid("street", "required")  # an address-level location: at least a street or a city
    if not creating and ("street" in out or "city" in out) and not (street or city):
        raise Invalid("street", "required")
    return out


# ---------------------------------------------------------------- the optional plan-area link (ORGPLAN-291)
# A location may name ONE plan area (a room of a plan floor, `spatial_zones`) in the reserved `plan_zone_id` column (migration 0101, no
# new migration). Display-only: it never widens who sees a request, a floor or a room. The link is shown ("show on map") only to a
# viewer who may read that floor on the map; a deleted room reads as "no link" and is cleared on the delete.

def live_zone(conn: sqlite3.Connection, zone_id: Any) -> dict[str, Any] | None:
    """The live (not deleted) room with its floor name, or None."""
    if not isinstance(zone_id, str) or not zone_id:
        return None
    row = conn.execute(
        "SELECT z.id, z.name, z.floor_id, f.name AS floor_name FROM spatial_zones z JOIN floors f ON f.id = z.floor_id "
        "WHERE z.id = ? AND z.deleted_at IS NULL", (zone_id,)).fetchone()
    return dict(row) if row is not None else None


def may_view_floor(conn: sqlite3.Connection, principal: Any, floor_id: str) -> bool:
    return authorize(conn, principal, "map.read", ("floor", floor_id)).allowed


def check_plan_zone(conn: sqlite3.Connection, principal: Any, body: Mapping[str, Any]) -> str | None:
    """The `plan_zone_id` a create / patch writes: None clears; a value must be a live room on a floor the editor may read on the
    map (an unknown, deleted or unreadable room all answer the same 422, so the field cannot probe the plan). Only call when the key
    is in the body."""
    zone_id = body.get("plan_zone_id")
    if zone_id is None or zone_id == "":
        return None
    zone = live_zone(conn, zone_id)
    if zone is None or not may_view_floor(conn, principal, zone["floor_id"]):
        raise Invalid("plan_zone_id", "unknown")
    return zone["id"]


def plan_area_for(conn: sqlite3.Connection, principal: Any, location_id: Any) -> dict[str, Any] | None:
    """What a request's detail shows next to its location: {zone_id, floor_id, name, floor_name} of the CURRENT location's linked room,
    only when that room is live and this viewer may read its floor on the map; otherwise None (no hint that a link exists)."""
    if not isinstance(location_id, str) or not location_id:
        return None
    loc = store_locations.location(conn, location_id)
    zone = live_zone(conn, loc.get("plan_zone_id")) if loc else None
    if zone is None or not may_view_floor(conn, principal, zone["floor_id"]):
        return None
    return {"zone_id": zone["id"], "floor_id": zone["floor_id"], "name": zone["name"], "floor_name": zone["floor_name"]}


def selectable_areas(conn: sqlite3.Connection, principal: Any) -> list[dict[str, Any]]:
    """The rooms the editor's picker offers: live rooms of floors the editor may read on the map, with the floor name."""
    out: list[dict[str, Any]] = []
    for r in conn.execute(
            "SELECT z.id, z.name, z.floor_id, f.name AS floor_name FROM spatial_zones z JOIN floors f ON f.id = z.floor_id "
            "WHERE z.deleted_at IS NULL ORDER BY f.level, f.name, z.name, z.id"):
        if may_view_floor(conn, principal, r["floor_id"]):
            out.append({"zone_id": r["id"], "name": r["name"], "floor_id": r["floor_id"], "floor_name": r["floor_name"]})
    return out


# ---------------------------------------------------------------- snapshot, texts, navigation

def nav_url(lat: Any, lng: Any) -> str:
    """A short map link from the coordinates (<= 50 characters, so it fits a message line)."""
    if lat is None or lng is None:
        return ""
    return f"https://maps.google.com/?q={float(lat):.5f},{float(lng):.5f}"


def search_url(loc: Mapping[str, Any]) -> str:
    """The Settings screen's navigation link: coordinates when present, else an address search (never sent to a vendor)."""
    if loc.get("lat") is not None and loc.get("lng") is not None:
        return nav_url(loc["lat"], loc["lng"])
    q = ", ".join(p for p in (loc.get("street"), loc.get("city")) if p)
    return f"https://www.google.com/maps/search/?api=1&query={quote(q)}" if q else ""


def snapshot(loc: Mapping[str, Any]) -> dict[str, Any]:
    return {"name": loc.get("name") or "", "street": loc.get("street") or "", "city": loc.get("city") or "",
            "details": loc.get("details") or "", "lat": loc.get("lat"), "lng": loc.get("lng")}


def parse_snapshot(raw: Any) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        snap = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return snap if isinstance(snap, dict) and snap.get("name") else None


def address_line(snap: Mapping[str, Any]) -> str:
    return ", ".join(p for p in (snap.get("street"), snap.get("city")) if p)


def display_text(snap: Mapping[str, Any] | None) -> str:
    """The full one-line text: name · street, city · details (the request's pages and screens)."""
    if not snap:
        return ""
    return SEP.join(p for p in (snap.get("name"), address_line(snap), snap.get("details")) if p)


def has_coordinates(snap: Mapping[str, Any] | None) -> bool:
    """True when the snapshot carries both coordinates (the only case where a navigation link can exist)."""
    return bool(snap) and snap.get("lat") is not None and snap.get("lng") is not None


def message_text(snap: Mapping[str, Any] | None, *, nav: bool = False) -> str:
    """The `{location}` value of a vendor message: name · street, city (+ · map link when switched on). At most 40+3+60+2+30+3+50
    characters, inside the 200-character cap of `{place}` / `{location}`."""
    if not snap:
        return ""
    parts = [snap.get("name") or "", address_line(snap)]
    if nav:
        parts.append(nav_url(snap.get("lat"), snap.get("lng")))
    return SEP.join(p for p in parts if p)


def resolve(conn: sqlite3.Connection, location_id: Any) -> tuple[str, str]:
    """(id, snapshot JSON) of an ACTIVE location for a new request. Raises Invalid('location_id', 'unknown')."""
    if not isinstance(location_id, str) or not location_id:
        raise Invalid("location_id", "unknown")
    loc = store_locations.location(conn, location_id)
    if loc is None or not loc["active"]:
        raise Invalid("location_id", "unknown")
    return loc["id"], json.dumps(snapshot(loc), ensure_ascii=False, separators=(",", ":"))


def present_request(row: Mapping[str, Any]) -> dict[str, Any] | None:
    """The location of a request as the staff screens show it (from the snapshot; the id for a reference)."""
    snap = parse_snapshot(row.get("location_snapshot"))
    if snap is None:
        return None
    return {"id": row.get("location_id"), "name": snap["name"], "address": address_line(snap), "details": snap.get("details") or "",
            "text": display_text(snap), "has_coordinates": snap.get("lat") is not None,
            "message": message_text(snap), "map_url": nav_url(snap.get("lat"), snap.get("lng"))}


def present_request_with_area(conn: sqlite3.Connection, principal: Any, row: Mapping[str, Any]) -> dict[str, Any] | None:
    """`present_request` plus ORGPLAN2-291's display-only `plan_area` ("show on map"): set only for a viewer who may read the linked
    room's floor on the map, None otherwise (no hint that a link exists). Used by a ticket's and an RFQ's detail / board card."""
    out = present_request(row)
    if out is not None:
        out["plan_area"] = plan_area_for(conn, principal, row.get("location_id"))
    return out


def present_request_with_area(conn: sqlite3.Connection, principal: Any, row: Mapping[str, Any]) -> dict[str, Any] | None:
    """`present_request` plus ORGPLAN2-291's display-only `plan_area` ("show on map"): set only for a viewer who may read the linked
    room's floor on the map, None otherwise (no hint that a link exists). Used by a ticket's and an RFQ's detail / board card."""
    out = present_request(row)
    if out is not None:
        out["plan_area"] = plan_area_for(conn, principal, row.get("location_id"))
    return out


# ---------------------------------------------------------------- presenters

def present_reader(loc: Mapping[str, Any]) -> dict[str, Any]:
    return {"id": loc["id"], "name": loc["name"], "street": loc["street"], "city": loc["city"], "details": loc["details"],
            "is_default": bool(loc["is_default"]), "sort_order": loc["sort_order"], "has_coordinates": loc.get("lat") is not None,
            # the short map link (coordinates only): what the RFQ preview shows when the manager adds the navigation link
            "map_url": nav_url(loc.get("lat"), loc.get("lng"))}


def present_admin(loc: Mapping[str, Any], refs: int) -> dict[str, Any]:
    return {**present_reader(loc), "lat": loc.get("lat"), "lng": loc.get("lng"), "active": bool(loc["active"]),
            "nav_url": search_url(loc), "plan_zone_id": loc.get("plan_zone_id"), "references": refs, "revision": loc["revision"], "updated_at": loc["updated_at"]}


def reader_list(conn: sqlite3.Connection) -> dict[str, Any]:
    items = store_locations.locations(conn, active_only=True)
    active = {x["id"] for x in items}
    default = next((x["id"] for x in items if x["is_default"]), None)
    depts = {d: l for d, l in store_locations.department_defaults(conn).items() if l in active}
    return {"locations": [present_reader(x) for x in items], "default_id": default, "department_defaults": depts}


def admin_list(conn: sqlite3.Connection) -> dict[str, Any]:
    items = store_locations.locations(conn, active_only=False)
    counts = store_locations.reference_counts(conn)
    default = next((x["id"] for x in items if x["is_default"]), None)
    return {"locations": [present_admin(x, counts.get(x["id"], 0)) for x in items], "default_id": default,
            "department_defaults": store_locations.department_defaults(conn), "max": LOCATIONS_MAX}
