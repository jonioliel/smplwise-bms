"""Who may see which Home Assistant entity (chapters 14/15, CR-007): one rule for the catalogue, the push socket, the
map bundle and the devices area. An installation-wide holder of the permission sees everything; a holder bound to
floors sees only entities placed on those floors - anchored on their map or wired to a circuit of their published
structure (T085). Nothing else counts: HA areas and floors are the owner's naming, not a scope."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

from ..rbac import INSTALLATION, Decision, Principal, authorize, require

Placements = dict[str, list[dict[str, str]]]

# The two permissions that let a caller run a single-entity action (CR-007 slice 2): the older, broader
# ha.entity.control (every allow-listed action, every screen that used it before this slice keeps working unchanged)
# and the new devices.control, which reaches ONLY the everyday domains of the devices area below - never a lock, the
# alarm panel, a siren, a script, a scene or a button (coordinator ruling on the slice-2 review, 2026-09-28: those
# stay behind ha.entity.control, and a sensitive action's extra grant - door.unlock, alarm.disarm - on top).
# Either grant is checked at the entity's own floor scope.
CONTROL_PERMISSIONS = ("ha.entity.control", "devices.control")
# CR-007 slice 4: humidifier joins fan/climate on the climate card (target humidity, mode) - still never a lock,
# alarm panel, siren, script, scene or button.
DEVICES_CONTROL_DOMAINS = frozenset({"light", "switch", "input_boolean", "cover", "climate", "fan", "humidifier", "media_player"})


def devices_control_reaches(conn: sqlite3.Connection, entity_id: str) -> bool:
    """Whether devices.control can ever cover `entity_id`: the domain must be one of DEVICES_CONTROL_DOMAINS
    (validate_action already refuses an action whose domain differs from the entity's, so the entity's domain is the
    action's domain), and it must not be a door / garage / gate cover or anything placed on the map's door layer -
    CR-007 slice-4 review MEDIUM 2: `POST /ha/entities/{id}/actions` reached `ha_scope.control_allowed` with only a
    domain check, so a devices.control-only caller could open a gate cover the bulk path already refuses to touch.
    ha.entity.control keeps its old, broader rights on these entities - this refusal is devices.control's own."""
    domain = entity_id.split(".", 1)[0]
    if domain not in DEVICES_CONTROL_DOMAINS:
        return False
    from . import devices as dsvc

    if domain == "cover":
        row = conn.execute("SELECT device_class FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        if row and (row["device_class"] or "") in dsvc.DOOR_COVER_CLASSES:
            return False
    on_door_layer = conn.execute(
        "SELECT 1 FROM map_anchors WHERE resource_type = 'ha_entity' AND resource_id = ? AND layer_id = ? AND effective_to IS NULL",
        (entity_id, dsvc.DOOR_LAYER),
    ).fetchone()
    return on_door_layer is None


def devices_control_reaches_checker(conn: sqlite3.Connection) -> Callable[[str], bool]:
    """`devices_control_reaches` precomputed as a per-entity predicate (one query for the door layer, one for the
    door-class covers) instead of up to two queries per entity - for callers that check many entities at once
    (services/device_bulk.py bulk_scope, control_checker below)."""
    from . import devices as dsvc

    door_layer = {
        r[0]
        for r in conn.execute(
            "SELECT resource_id FROM map_anchors WHERE resource_type = 'ha_entity' AND layer_id = ? AND effective_to IS NULL", (dsvc.DOOR_LAYER,)
        ).fetchall()
    }
    door_covers = {
        r[0]
        for r in conn.execute(
            f"SELECT entity_id FROM ha_entities WHERE domain = 'cover' AND device_class IN ({','.join('?' * len(dsvc.DOOR_COVER_CLASSES))})",
            list(dsvc.DOOR_COVER_CLASSES),
        ).fetchall()
    }

    def check(entity_id: str) -> bool:
        domain = entity_id.split(".", 1)[0]
        return domain in DEVICES_CONTROL_DOMAINS and entity_id not in door_layer and entity_id not in door_covers

    return check


class FloorSet(set):
    """The floors a caller holds a permission on (a plain set to every existing caller) that also remembers the floors
    an explicit deny takes it away on: a placement through a shared room (CR-009) counts only when the room's home floor
    is not denied - deny wins (entity_visible)."""

    denied: frozenset[str] = frozenset()


def visible_floors(conn: sqlite3.Connection, principal: Principal, permission: str) -> tuple[bool, set[str]]:
    """(installation-wide, floor ids): wide callers get an empty set, everyone else the floors where they hold it
    (a FloorSet carrying the explicitly denied floors too)."""
    if authorize(conn, principal, permission, INSTALLATION).allowed:
        return True, FloorSet()
    floors = FloorSet()
    denied: set[str] = set()
    for f in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall():
        d = authorize(conn, principal, permission, ("floor", f["id"]))
        if d.allowed:
            floors.add(f["id"])
        elif d.reason == "explicit_deny":
            denied.add(f["id"])
    floors.denied = frozenset(denied)
    return False, floors


def placements(conn: sqlite3.Connection) -> Placements:
    """Where an entity is on the maps: its anchors, the floors whose published structure has a circuit switched by it
    (T085) - a floor viewer reads such a switch, a floor operator controls it, the push socket forwards it - and the
    other floors of a shared room it is placed in (CR-009; `shared_from` = the room's home floor)."""
    out: Placements = {}
    for r in conn.execute(
        "SELECT a.resource_id, a.floor_id, f.name AS floor_name FROM map_anchors a JOIN floors f ON f.id = a.floor_id WHERE a.resource_type = 'ha_entity' AND a.effective_to IS NULL"
    ).fetchall():
        out.setdefault(r["resource_id"], []).append({"floor_id": r["floor_id"], "floor_name": r["floor_name"]})
    from . import geometry_store, shared_spaces

    switches = geometry_store.circuit_switches(conn)
    names: dict[str, str] | None = None
    if switches:
        names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM floors WHERE deleted_at IS NULL").fetchall()}
        for eid, floors in switches.items():
            have = {p["floor_id"] for p in out.get(eid, [])}
            for fid in floors:
                if fid in names and fid not in have:
                    out.setdefault(eid, []).append({"floor_id": fid, "floor_name": names[fid]})
                    have.add(fid)
    if shared_spaces.any_active(conn):
        names = names or {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM floors WHERE deleted_at IS NULL").fetchall()}
        mirrored = {rid: pairs for (rtype, rid), pairs in shared_spaces.mirrored_anchor_floors(conn).items() if rtype == "ha_entity"}
        for eid, pairs in shared_spaces.shared_circuit_switches(conn).items():
            mirrored.setdefault(eid, [])
            mirrored[eid] = mirrored[eid] + [p for p in pairs if p not in mirrored[eid]]
        for eid, pairs in mirrored.items():
            have = {p["floor_id"] for p in out.get(eid, [])}
            for fid, home in pairs:
                if fid in names and fid not in have:
                    out.setdefault(eid, []).append({"floor_id": fid, "floor_name": names[fid], "shared_from": home})
                    have.add(fid)
    return out


def entity_visible(wide: bool, floors: set[str], placed: Placements, entity_id: str) -> bool:
    """The one placement rule: wide callers see it; a floor-scoped caller only when it is placed on one of their floors
    - through a shared room only when the caller is not explicitly denied on the room's home floor (CR-009, deny wins)."""
    denied = getattr(floors, "denied", frozenset())
    return wide or any(p["floor_id"] in floors and p.get("shared_from") not in denied for p in placed.get(entity_id, []))


def entity_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str, permission: str) -> bool:
    wide, floors = visible_floors(conn, principal, permission)
    if wide:
        return True
    return entity_visible(False, floors, placements(conn), entity_id)


def control_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> bool:
    """Whether the caller may run a single-entity action on `entity_id`: ha.entity.control at that entity's floor
    scope (any allow-listed domain), or devices.control at that scope for the DEVICES_CONTROL_DOMAINS only. Used by
    the shared /ha/entities/{id}/actions route (routers/ha.py); neither grant implies the other."""
    if entity_allowed(conn, principal, entity_id, "ha.entity.control"):
        return True
    return devices_control_reaches(conn, entity_id) and entity_allowed(conn, principal, entity_id, "devices.control")


def control_decision(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> Decision | None:
    """The allowing decision behind control_allowed (installation-wide, else the first floor the entity is placed on) -
    what the action's audit rows record as the scope it was authorised under (T055). None = not allowed."""
    placed = placements(conn).get(entity_id, [])
    for perm in CONTROL_PERMISSIONS:
        if perm == "devices.control" and not devices_control_reaches(conn, entity_id):
            continue
        for target, home in [(INSTALLATION, None)] + [(("floor", p["floor_id"]), p.get("shared_from")) for p in placed]:
            d = authorize(conn, principal, perm, target)
            if d.allowed and (home is None or authorize(conn, principal, perm, ("floor", home)).reason != "explicit_deny"):
                return d
    return None


def control_checker(conn: sqlite3.Connection, principal: Principal) -> Callable[[str], bool]:
    """control_allowed as a per-entity predicate built once per request (the devices area's cards: one scope lookup
    per area instead of one per row)."""
    ha_wide, ha_floors = visible_floors(conn, principal, "ha.entity.control")
    dc_wide, dc_floors = visible_floors(conn, principal, "devices.control")
    placed = placements(conn) if (ha_floors or dc_floors) and not ha_wide else {}
    reaches = devices_control_reaches_checker(conn)

    def check(entity_id: str) -> bool:
        if entity_visible(ha_wide, ha_floors, placed, entity_id):
            return True
        return reaches(entity_id) and entity_visible(dc_wide, dc_floors, placed, entity_id)

    return check


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
