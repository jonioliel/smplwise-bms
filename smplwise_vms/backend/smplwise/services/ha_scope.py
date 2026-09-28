"""Who may see which Home Assistant entity (chapters 14/15, CR-007): one rule for the catalogue, the push socket, the
map bundle and the devices area. An installation-wide holder of the permission sees everything; a holder bound to
floors sees only entities placed on those floors - anchored on their map or wired to a circuit of their published
structure (T085). Nothing else counts: HA areas and floors are the owner's naming, not a scope."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

from ..rbac import INSTALLATION, Principal, authorize, require

Placements = dict[str, list[dict[str, str]]]

# The two permissions that let a caller run a single-entity action (CR-007 slice 2): the older, broader
# ha.entity.control (every screen that used it before this slice keeps working unchanged) and the new
# devices.control (the devices area's own grant, held by roles - editor - that never had ha.entity.control).
# Either one, at the entity's own floor scope, is enough; a sensitive action's extra grant (door.unlock,
# alarm.disarm) is checked separately and is never implied by either.
CONTROL_PERMISSIONS = ("ha.entity.control", "devices.control")


def visible_floors(conn: sqlite3.Connection, principal: Principal, permission: str) -> tuple[bool, set[str]]:
    """(installation-wide, floor ids): wide callers get an empty set, everyone else the floors where they hold it."""
    if authorize(conn, principal, permission, INSTALLATION).allowed:
        return True, set()
    floors = {f["id"] for f in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall() if authorize(conn, principal, permission, ("floor", f["id"])).allowed}
    return False, floors


def placements(conn: sqlite3.Connection) -> Placements:
    """Where an entity is on the maps: its anchors, and the floors whose published structure has a circuit switched by
    it (T085) - a floor viewer reads such a switch, a floor operator controls it, the push socket forwards it."""
    out: Placements = {}
    for r in conn.execute(
        "SELECT a.resource_id, a.floor_id, f.name AS floor_name FROM map_anchors a JOIN floors f ON f.id = a.floor_id WHERE a.resource_type = 'ha_entity' AND a.effective_to IS NULL"
    ).fetchall():
        out.setdefault(r["resource_id"], []).append({"floor_id": r["floor_id"], "floor_name": r["floor_name"]})
    from . import geometry_store

    switches = geometry_store.circuit_switches(conn)
    if switches:
        names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM floors WHERE deleted_at IS NULL").fetchall()}
        for eid, floors in switches.items():
            have = {p["floor_id"] for p in out.get(eid, [])}
            for fid in floors:
                if fid in names and fid not in have:
                    out.setdefault(eid, []).append({"floor_id": fid, "floor_name": names[fid]})
                    have.add(fid)
    return out


def entity_visible(wide: bool, floors: set[str], placed: Placements, entity_id: str) -> bool:
    """The one placement rule: wide callers see it; a floor-scoped caller only when it is placed on one of their floors."""
    return wide or any(p["floor_id"] in floors for p in placed.get(entity_id, []))


def entity_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str, permission: str) -> bool:
    wide, floors = visible_floors(conn, principal, permission)
    if wide:
        return True
    return entity_visible(False, floors, placements(conn), entity_id)


def control_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> bool:
    """Whether the caller may run a single-entity action on `entity_id`: either CONTROL_PERMISSIONS grant, at that
    entity's own floor scope. Used by the shared /ha/entities/{id}/actions route (routers/ha.py) so the devices
    area's devices.control and the older ha.entity.control both reach it, without one implying the other."""
    return any(entity_allowed(conn, principal, entity_id, p) for p in CONTROL_PERMISSIONS)


def control_checker(conn: sqlite3.Connection, principal: Principal) -> Callable[[str], bool]:
    """A per-entity control predicate built once per request (the devices area's cards, one call per area instead
    of one per row): wide when either grant is installation-wide, otherwise the union of both grants' floors."""
    wide = False
    floors: set[str] = set()
    for permission in CONTROL_PERMISSIONS:
        w, f = visible_floors(conn, principal, permission)
        wide = wide or w
        floors |= f
    if wide:
        return lambda _entity_id: True
    if not floors:
        return lambda _entity_id: False
    placed = placements(conn)
    return lambda entity_id: entity_visible(False, floors, placed, entity_id)


def scoped_rows(conn: sqlite3.Connection, principal: Principal, permission: str, rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    """`rows` (each with an `entity_id`) narrowed to what the caller may see, and whether it was narrowed at all.
    Raises the audited 403 when the caller holds the permission nowhere."""
    wide, floors = visible_floors(conn, principal, permission)
    if not wide and not floors:
        require(conn, principal, permission, INSTALLATION)
    if wide:
        return rows, False
    placed = placements(conn)
    return [r for r in rows if entity_visible(False, floors, placed, r["entity_id"])], True
