"""BUILDING-SCOPE-CONTROL-2351: which home-system areas belong to one of OUR buildings, for the server side of "הצג ושלוט" on a
multi-building site (docs/changes/BUILDING-SCOPE-CONTROL-2351.md).

The home's site level decides it in the browser (frontend/src/api/home-site.ts siteModel -> xsection/xs-model.ts matchFloors with
`singleBuilding: false`); the server never trusts that answer and works it out again from the same rows, the same way:

1. map placement - a plan room linked to the area (spatial_zones.ha_area_id) on one of our floors;
2. the per-area row (home_area_links; a NULL floor = taken off every floor by hand -> no floor);
3. the platform floor's row (home_floor_links: platform floor -> our floor);
then our floor -> its building (floors.building_id). On a multi-building site the automatic level / name rules only SUGGEST on the client,
so they are not part of the answer here either. Second pass (MAPPING-ASSIST-2330): an area that resolves to none of our floors and has an
area -> building row (home_area_buildings) belongs to that building. Deleted floors / buildings count for nothing.

The shared building ("בניין משותף", buildings.is_shared) is a building like any other here: scoping to it reaches its own areas only, and
scoping to another building never reaches it. Read-only: nothing here writes.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from ..errors import ApiError
from . import devices as dsvc
from . import plan_area_links


def _live_floors(conn: sqlite3.Connection) -> dict[str, str]:
    """our floor id -> its building id (live floors of live buildings only)."""
    return {r[0]: r[1] for r in conn.execute(
        "SELECT f.id, f.building_id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL"
    ).fetchall()}


def _rows(conn: sqlite3.Connection, sql: str) -> list[sqlite3.Row]:
    try:
        return conn.execute(sql).fetchall()
    except sqlite3.OperationalError:  # before the migration that adds the table
        return []


def area_buildings(conn: sqlite3.Connection, areas: list[dict[str, Any]] | None = None) -> dict[str, str]:
    """area id -> building id for every platform area that resolves to one of our live buildings (an unresolved area is absent)."""
    if areas is None:
        _floors, areas = dsvc.load_structure(conn, dsvc.load_entities(conn))
    ha_floor_ids = {r[0] for r in conn.execute("SELECT floor_id FROM ha_floors").fetchall()} | {a.get("floor_id") for a in areas if a.get("floor_id")}
    building_of = _live_floors(conn)
    floor_rows = {r[0]: r[1] for r in _rows(conn, "SELECT ha_floor_id, floor_id FROM home_floor_links")}
    area_rows = {r[0]: r[1] for r in _rows(conn, "SELECT area_id, floor_id FROM home_area_links")}
    on_map = plan_area_links.area_to_zone(conn)
    out: dict[str, str] = {}
    for a in areas:
        aid = a["area_id"]
        hfid = a.get("floor_id") if a.get("floor_id") in ha_floor_ids else None
        placed = (on_map.get(aid) or {}).get("floor_id")
        if placed:
            to: str | None = placed
        elif aid in area_rows:
            to = area_rows[aid]
        elif hfid and hfid in floor_rows:
            to = floor_rows[hfid]
        else:
            to = None
        if to and to in building_of:
            out[aid] = building_of[to]
    live_buildings = set(building_of.values()) | {r[0] for r in conn.execute("SELECT id FROM buildings WHERE deleted_at IS NULL").fetchall()}
    for r in _rows(conn, "SELECT area_id, building_id FROM home_area_buildings"):
        if r[0] not in out and r[1] in live_buildings:
            out[r[0]] = r[1]
    return out


def building_areas(conn: sqlite3.Connection, building_id: str, areas: list[dict[str, Any]] | None = None) -> set[str]:
    """The platform areas of one live building; 404 `building_not_found` for an unknown or deleted building."""
    row = conn.execute("SELECT 1 FROM buildings WHERE id = ? AND deleted_at IS NULL", (building_id,)).fetchone()
    if not row:
        raise ApiError(404, "building_not_found", "הבניין לא נמצא.", details={"building_id": building_id})
    return {aid for aid, bid in area_buildings(conn, areas).items() if bid == building_id}


OUTSIDE_MESSAGE = "ההיקף שנבחר אינו שייך לבניין הזה, ולכן לא נשלח דבר. פעולה בבניין אחד לעולם אינה נוגעת בבניין אחר."


def outside(details: dict[str, Any]) -> ApiError:
    """The refusal of a scope / entity outside the building the request names (audited by the caller)."""
    return ApiError(403, "outside_building", OUTSIDE_MESSAGE, details=details)
