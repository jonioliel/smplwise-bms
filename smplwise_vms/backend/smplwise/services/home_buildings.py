"""MULTI-BUILDING-HOME-2500: the home interface ("ממשק ביתי") and the lobby boards on a multi-building site (owner decisions 22.11,
Q64-Q68; docs/changes/MULTI-BUILDING-HOME-2500.md).

Everything here is DISPLAY. Nothing in this module grants, narrows or checks a permission:

* the home interface's building level (`overview_extra`): which of OUR buildings the caller's visible rooms resolve to, each room's
  building, the building of every area the caller already sees (so an energy meter or a scene schedule can be placed in the buildings it
  serves - Q67), the building the interface opens on (Q65) and whether "כל הבניינים" is offered (Q64). The control that "כבה הכל"
  sends for one building (Q66) is the existing bulk route with its `building` parameter, cut by services/building_scope on the server.
* the person's building (Q65): `home_interface_policy.building_id`, set by an administrator per person - a preference like
  `site_entry_building`, never read by services/ha_scope or services/building_scope.
* the lobby board's building (Q68): `notice_boards.building_id`, whose name the board's greeting uses.

The switch rule of every multi-building row: while `home.multi_building.enabled` is off, or fewer than two of our buildings are reached by
the caller's rooms, nothing here runs and every answer is exactly the answer of before (tests/test_mb_home_2500.py proves it by replacing
this module's entry points with functions that raise).
"""
from __future__ import annotations

import sqlite3
from typing import Any

from ..db import get_setting
from . import building_scope

MULTI_KEY = building_scope.MULTI_KEY
# Q64 (owner 22.11 = the recommendation): "כל הבניינים" in the home interface is hidden; an installation setting can offer it.
BUILDING_ALL_KEY = "home.building_all"
BUILDING_ALL_VALUES = ("hide", "allow")


def multi_on(conn: sqlite3.Connection) -> bool:
    return get_setting(conn, MULTI_KEY) == "on"


def live_buildings(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Our live buildings of live sites, in the order of the full interface's site level: the shared building last, then the sort order
    and the name (services/home_site_view's order)."""
    rows = conn.execute(
        """SELECT b.id, b.name, b.site_id, COALESCE(b.is_shared, 0) AS is_shared, b.sort_order FROM buildings b JOIN sites s ON s.id = b.site_id
           WHERE b.deleted_at IS NULL AND s.deleted_at IS NULL"""
    ).fetchall()
    out = [{"id": r["id"], "name": r["name"], "site_id": r["site_id"], "is_shared": bool(r["is_shared"]), "sort_order": r["sort_order"] or 0} for r in rows]
    out.sort(key=lambda b: (b["is_shared"], b["sort_order"], (b["name"] or "").casefold(), b["id"]))
    return out


def building_name(conn: sqlite3.Connection, building_id: str | None) -> str | None:
    """The name of a live building of a live site, or None (unknown, deleted, or no id)."""
    if not building_id:
        return None
    row = conn.execute(
        "SELECT b.name FROM buildings b JOIN sites s ON s.id = b.site_id WHERE b.id = ? AND b.deleted_at IS NULL AND s.deleted_at IS NULL",
        (building_id,),
    ).fetchone()
    return str(row[0]) if row and row[0] else None


def is_live_building(conn: sqlite3.Connection, building_id: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM buildings b JOIN sites s ON s.id = b.site_id WHERE b.id = ? AND b.deleted_at IS NULL AND s.deleted_at IS NULL", (building_id,)
    ).fetchone() is not None


def building_all(conn: sqlite3.Connection) -> str:
    v = get_setting(conn, BUILDING_ALL_KEY)
    return v if v in BUILDING_ALL_VALUES else BUILDING_ALL_VALUES[0]


def overview_extra(conn: sqlite3.Connection, *, rooms: list[dict[str, Any]], entities: list[dict[str, Any]], pol: dict[str, Any],
                   extra_areas: set[str] | None = None) -> dict[str, Any] | None:
    """The building level of GET /home/overview, or None when the home interface stays exactly as before (the switch off, or the caller's
    rooms reach fewer than two of our buildings).

    `rooms` are the overview's room rows (each gains `building_id`: its building, or None for a room the mapping puts in no building);
    `entities` the caller's visible entities: only areas the caller already sees are placed in `area_buildings` (an area of a room they do
    not see is never named). `extra_areas`: more areas the caller already sees through another module's answer (the energy meters).
    The answer:
      buildings       - the buildings the caller's rooms reach, the full interface's order (shared last): id, name, is_shared
      area_buildings  - area id -> building id, for the areas the caller sees whose building is one of `buildings`
      building_all    - Q64: whether the interface offers "כל הבניינים"
      entry_building  - Q65: a wall panel's room building; else the administrator's building for this person when it is one of
                        `buildings`; else None (the device's last choice, then the first building - decided by the browser)
    """
    if not multi_on(conn):
        return None
    area_b = building_scope.area_buildings(conn)
    reached = {area_b[r["id"]] for r in rooms if r["id"] in area_b}
    if len(reached) < 2:
        return None
    buildings = [{"id": b["id"], "name": b["name"], "is_shared": b["is_shared"]} for b in live_buildings(conn) if b["id"] in reached]
    shown = {b["id"] for b in buildings}
    for r in rooms:
        bid = area_b.get(r["id"])
        r["building_id"] = bid if bid in shown else None
    seen_areas = {r["id"] for r in rooms} | {e.get("area_id") for e in entities if e.get("area_id")} | (extra_areas or set())
    area_map = {aid: area_b[aid] for aid in sorted(a for a in seen_areas if a) if area_b.get(aid) in shown}
    entry: str | None = None
    if pol.get("kiosk") and pol.get("kiosk_area_id"):
        entry = area_b.get(pol["kiosk_area_id"]) if area_b.get(pol["kiosk_area_id"]) in shown else None
    elif pol.get("building_id") in shown:
        entry = pol["building_id"]
    return {"buildings": buildings, "area_buildings": area_map, "building_all": building_all(conn) == "allow", "entry_building": entry}


def meter_areas(conn: sqlite3.Connection, principal: Any) -> set[str]:
    """The areas of the live energy meters, when the caller may read the meters list (energy.view anywhere: GET /energy/meters already
    names these areas to them). Empty otherwise, or before the energy tables exist."""
    from ..rbac import permissions_anywhere

    try:
        if "energy.view" not in set(permissions_anywhere(conn, principal)):
            return set()
        rows = conn.execute(
            "SELECT COALESCE(m.area_id, e.area_id) FROM energy_meters m LEFT JOIN ha_entities e ON e.entity_id = m.source_ref WHERE m.status <> 'retired'"
        ).fetchall()
    except sqlite3.OperationalError:
        return set()
    return {r[0] for r in rows if r[0]}


# ---------------------------------------------------------------------------------------------------------------- the lobby boards (Q68)

def board_building(conn: sqlite3.Connection, board: dict[str, Any]) -> str | None:
    """The name a lobby board greets with when it belongs to a building: the building's own name, read live (a rename shows at once),
    while the multi-building switch is on and the building is live. None = the greeting chain of before."""
    bid = board.get("building_id")
    if not bid or not multi_on(conn):
        return None
    return building_name(conn, bid)


def building_choices(conn: sqlite3.Connection) -> list[dict[str, Any]] | None:
    """The buildings an administrator can choose (a lobby board's building, a person's building in the home interface page): every live
    building, while the switch is on and there are at least two. None = no picker (one building, or the switch off)."""
    if not multi_on(conn):
        return None
    bs = live_buildings(conn)
    if len(bs) < 2:
        return None
    return [{"id": b["id"], "name": b["name"], "is_shared": b["is_shared"]} for b in bs]
