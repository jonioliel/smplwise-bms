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


def area_targets(conn: sqlite3.Connection, areas: list[dict[str, Any]] | None = None) -> dict[str, tuple[str, str | None]]:
    """area id -> (building id, our floor id or None) for every platform area that resolves to one of our live buildings (an unresolved
    area is absent). The floor is None for an area that belongs to a building only through its area -> building row (second pass)."""
    if areas is None:
        _floors, areas = dsvc.load_structure(conn, dsvc.load_entities(conn))
    ha_floor_ids = {r[0] for r in conn.execute("SELECT floor_id FROM ha_floors").fetchall()} | {a.get("floor_id") for a in areas if a.get("floor_id")}
    building_of = _live_floors(conn)
    floor_rows = {r[0]: r[1] for r in _rows(conn, "SELECT ha_floor_id, floor_id FROM home_floor_links")}
    area_rows = {r[0]: r[1] for r in _rows(conn, "SELECT area_id, floor_id FROM home_area_links")}
    on_map = plan_area_links.area_to_zone(conn)
    out: dict[str, tuple[str, str | None]] = {}
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
            out[aid] = (building_of[to], to)
    live_buildings = set(building_of.values()) | {r[0] for r in conn.execute("SELECT id FROM buildings WHERE deleted_at IS NULL").fetchall()}
    for r in _rows(conn, "SELECT area_id, building_id FROM home_area_buildings"):
        if r[0] not in out and r[1] in live_buildings:
            out[r[0]] = (r[1], None)
    return out


def area_buildings(conn: sqlite3.Connection, areas: list[dict[str, Any]] | None = None) -> dict[str, str]:
    """area id -> building id for every platform area that resolves to one of our live buildings (an unresolved area is absent)."""
    return {aid: t[0] for aid, t in area_targets(conn, areas).items()}


# ---------------------------------------------------------------------------------------------------------- permission reach (round 14)
# Owner decision 02.11 (round 14, answer B): a building-scoped role binding reaches a device placed on that building's floor maps (as
# always, services/ha_scope) OR whose area the home mapping puts in that building - a union; an unmapped area adds nothing. The
# installation setting "הרשאת בניין לפי" chooses: "map" = map placement only (the rule before), "map_and_mapping" = placement + the
# area mapping (the owner's default). It applies only while the multi-building switch is on: off = exactly the rule before.
REACH_KEY = "security.building_reach"
REACH_CHOICES: tuple[str, ...] = ("map_and_mapping", "map")
REACH_DEFAULT = "map_and_mapping"
REACH_LABELS = {"map": "מיקום במפה", "map_and_mapping": "מפה + מיפוי אזורים"}
MULTI_KEY = "home.multi_building.enabled"  # routers/home_mapping.MULTI_KEY (read here without importing the router)


def reach_mode(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (REACH_KEY,)).fetchone()
    value = row[0] if row else None
    return value if value in REACH_CHOICES else REACH_DEFAULT


def mapping_reach_on(conn: sqlite3.Connection) -> bool:
    """Whether the home mapping adds to a building binding's reach right now: the multi-building switch on AND the setting allows it."""
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (MULTI_KEY,)).fetchone()
    return bool(row) and row[0] == "on" and reach_mode(conn) == "map_and_mapping"


def _light(conn: sqlite3.Connection) -> tuple[list[dict[str, Any]], list[sqlite3.Row]]:
    """The registry's areas plus any area an entity names that the mirror has not got yet, and the entity -> area rows: the light rows
    a permission check resolves from (it never loads the whole catalogue)."""
    areas = [{"area_id": r[0], "floor_id": r[1]} for r in conn.execute("SELECT area_id, floor_id FROM ha_areas").fetchall()]
    known = {a["area_id"] for a in areas}
    ents = conn.execute("SELECT entity_id, area_id, ha_floor_id FROM ha_entities WHERE area_id IS NOT NULL AND area_id != ''").fetchall()
    for r in ents:
        if r[1] not in known:
            areas.append({"area_id": r[1], "floor_id": r[2]})
            known.add(r[1])
    return areas, ents


def entity_targets(conn: sqlite3.Connection) -> dict[str, tuple[str, str | None]]:
    """entity id -> (building id, our floor id or None) through its area, for every entity whose area the home mapping resolves - the
    same resolution as the building cut above."""
    areas, ents = _light(conn)
    by_area = area_targets(conn, areas)
    return {r[0]: by_area[r[1]] for r in ents if r[1] in by_area}


def mapping_changed(conn: sqlite3.Connection) -> None:
    """A write to the mapping rows (or to the switch / the setting) can widen or narrow reach: every open socket re-scopes now (the REST
    routes need nothing - reach is worked out on every request, never cached across requests). The anchors precedent (routers/anchors.py).
    Called only while the mapping counts for reach (or the switch / setting just stopped it counting): off = nothing moves, as before."""
    from . import revocation

    revocation.mark([r[0] for r in conn.execute("SELECT id FROM users").fetchall()])


class RemapGuard:
    """Round 14 security rule for every mapping write (the floor's home links, the mapping assistant's apply / restore, a plan room's area
    link): while the mapping counts for reach, moving an area OUT of the building it resolves to now (to another building, or to none)
    also edits that building - the writer must hold the route's own permission where the area is now (its floor, else its building), the
    rule a camera moved between floors follows (HA_IDENTITY_RBAC_HE §5: source and target). Otherwise a floor editor of building A could
    pull building B's areas - and with them B's devices - into the reach of A's holders. Usage: create it after the route's own permission
    check and before any write (it opens a savepoint), call `check()` after the writes and before the route's own audit row: a refused
    move rolls the writes back and raises the audited 403 of `require`. While the mapping does not count (switch off / "מיקום במפה") it
    does nothing at all - the route behaves exactly as before."""

    def __init__(self, conn: sqlite3.Connection, principal: Any, permission: str) -> None:
        self.conn, self.principal, self.permission = conn, principal, permission
        self.on = mapping_reach_on(conn)
        self.before: dict[str, tuple[str, str | None]] = {}
        if self.on:
            self.before = area_targets(conn, _light(conn)[0])
            conn.execute("SAVEPOINT building_remap")

    def check(self) -> None:
        if not self.on:
            return
        from ..rbac import authorize, require

        after = area_targets(self.conn, _light(self.conn)[0])
        for aid, (old_b, old_f) in sorted(self.before.items()):
            new = after.get(aid)
            if new is not None and new[0] == old_b:
                continue
            target = ("floor", old_f) if old_f else ("building", old_b)
            if not authorize(self.conn, self.principal, self.permission, target).allowed:
                self.conn.execute("ROLLBACK TO building_remap")
                self.conn.execute("RELEASE building_remap")
                require(self.conn, self.principal, self.permission, target)  # the audited 403 (raises)
        self.conn.execute("RELEASE building_remap")
        if after != self.before:
            mapping_changed(self.conn)


def building_areas(conn: sqlite3.Connection, building_id: str, areas: list[dict[str, Any]] | None = None) -> set[str]:
    """The platform areas of one live building; 404 `building_not_found` for an unknown or deleted building."""
    return set(cut(conn, building_id, areas).areas)


OUTSIDE_MESSAGE = "ההיקף שנבחר אינו שייך לבניין הזה, ולכן לא נשלח דבר. פעולה בבניין אחד לעולם אינה נוגעת בבניין אחר."
REFUSAL_CODES = frozenset({"outside_building", "building_not_found"})  # the two refusals a building-scoped request can get from here


def outside(details: dict[str, Any]) -> ApiError:
    """The refusal of a scope / entity outside the building the request names (audited by the caller)."""
    return ApiError(403, "outside_building", OUTSIDE_MESSAGE, details=details)


class Cut:
    """One building's cut of a request - the ONE check every route that accepts `building` runs (the bulk preview / run, the tiles list,
    the single-entity action route): which areas are the building's, whether a floor / area / entity is inside it, and the refusal when
    it is not. It only ever narrows: the permission rules of each route run as before on what is left."""

    __slots__ = ("building_id", "areas")

    def __init__(self, building_id: str, areas: set[str]) -> None:
        self.building_id = building_id
        self.areas = frozenset(areas)

    def area_in(self, area_id: str | None) -> bool:
        return bool(area_id) and area_id in self.areas

    def floor_in(self, floor_id: str, area_floor: dict[str, Any]) -> bool:
        """A platform floor is in the building when at least one of its areas is (a floor split between buildings is cut by `keep`)."""
        return any(fid == floor_id and aid in self.areas for aid, fid in area_floor.items())

    def strays(self, entities: Any) -> list[str]:
        """The entity ids (rows with `entity_id` / `area_id`) whose area is not the building's - sorted, for the refusal's count."""
        return sorted(e["entity_id"] for e in entities if not self.area_in(e.get("area_id")))

    def keep(self, entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [e for e in entities if self.area_in(e.get("area_id"))]

    def name(self, conn: sqlite3.Connection) -> str | None:
        row = conn.execute("SELECT name FROM buildings WHERE id = ?", (self.building_id,)).fetchone()
        return row[0] if row else None

    def refuse(self, **details: Any) -> ApiError:
        return outside({"building_id": self.building_id, **details})


def cut(conn: sqlite3.Connection, building_id: str, areas: list[dict[str, Any]] | None = None) -> Cut:
    """The cut of one live building; 404 `building_not_found` for an unknown or deleted building."""
    row = conn.execute("SELECT 1 FROM buildings WHERE id = ? AND deleted_at IS NULL", (building_id,)).fetchone()
    if not row:
        raise ApiError(404, "building_not_found", "הבניין לא נמצא.", details={"building_id": building_id})
    return Cut(building_id, {aid for aid, bid in area_buildings(conn, areas).items() if bid == building_id})


def require_entity(conn: sqlite3.Connection, building_id: str, entity: dict[str, Any]) -> Cut:
    """A single-entity request inside a building (`POST /ha/entities/{id}/actions` with `building`): the entity's own area (an entity
    row of ha_sync.entity_row - its area, else its device's) must be one of the building's areas; an entity without an area belongs to
    no building. 403 `outside_building` / 404 `building_not_found`, audited by the caller."""
    c = cut(conn, building_id, dsvc.load_structure(conn, [entity])[1])
    if not c.area_in(entity.get("area_id")):
        raise c.refuse(entity_id=entity["entity_id"])
    return c
