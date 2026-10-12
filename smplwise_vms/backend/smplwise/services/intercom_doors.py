"""WisKey doors as Arx sees them (CR-033 slices D1 and D2): which HA lock entities are WisKey doors, which station and relay
each one is (the door map, migration 0078), and where each station sits in the site tree (station placement, migration
0077). Read and written by the system administrator in Settings (routers/doors.py); read by the one door authority
(services/door_authority.py) and the door transport.

Rules (owner decision 18 = א, CR-033 4.4):
- A lock entity is a WisKey door when its registry platform is `hikvision_intercom` or `smplwise_intercom` (both names:
  the domain rename is a separate WisKey release).
- The map is explicit: `wiskey_explicit` (the per-entity field WisKey promised - NOT SEEN YET, nothing fills it here),
  `single_relay` (offered as a suggestion when the station has exactly one relay and exactly one WisKey lock entity
  carries that station's config entry id; it becomes a row only when the administrator applies it) and `manual`.
  Never by name and never by parsing the entity's unique_id.
- A mapped row is valid only while the served WisKey copy still lists its station and relay, and while the entity's own
  registry config entry (when known) is that station. Anything else resolves to `intercom_lock_unmapped`: nothing is
  sent, no fallback.
- Station ids are WisKey's opaque config entry ids; screens show the station's name, never the id."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import now_iso
from ..errors import ApiError
from . import intercom_sync

WISKEY_PLATFORMS = ("hikvision_intercom", "smplwise_intercom")
SOURCES = ("wiskey_explicit", "single_relay", "manual")


@dataclass(frozen=True)
class DoorTarget:
    """One WisKey door: the station's config entry id and the relay's physical_index (plus how it was mapped)."""

    station_id: str
    relay: int
    source: str
    entity_id: str | None = None


def unmapped(entity_id: str | None = None) -> ApiError:
    return ApiError(409, "intercom_lock_unmapped", "הדלת לא מוגדרת לפתיחה.", details={"outcome": "not_sent"})


# ---------------------------------------------------------------- which entities are WisKey doors

def is_wiskey_lock(conn: sqlite3.Connection, entity_id: str) -> bool:
    row = conn.execute("SELECT domain, platform FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    return row is not None and row["domain"] == "lock" and (row["platform"] or "") in WISKEY_PLATFORMS


def wiskey_lock_ids(conn: sqlite3.Connection) -> set[str]:
    marks = ",".join("?" * len(WISKEY_PLATFORMS))
    return {r[0] for r in conn.execute(f"SELECT entity_id FROM ha_entities WHERE domain = 'lock' AND platform IN ({marks})", WISKEY_PLATFORMS).fetchall()}


def wiskey_locks(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    marks = ",".join("?" * len(WISKEY_PLATFORMS))
    rows = conn.execute(
        f"SELECT entity_id, name, config_entry_id, removed_at, disabled FROM ha_entities WHERE domain = 'lock' AND platform IN ({marks}) ORDER BY name, entity_id",
        WISKEY_PLATFORMS,
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------- stations

def _table_rows(conn: sqlite3.Connection, sql: str, args: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    try:
        return conn.execute(sql, args).fetchall()
    except sqlite3.OperationalError:  # a database before 0077 / 0078
        return []


def known_station_ids(conn: sqlite3.Connection) -> list[str]:
    """The stations Arx knows: the served WisKey copy's, plus any already placed or mapped (a station the feed does not
    list right now keeps its bindings, placement and map rows - they just do not resolve until it is back)."""
    ids = {s["id"] for s in intercom_sync.SYNC.stations() if s.get("id")}
    ids |= {r[0] for r in _table_rows(conn, "SELECT config_entry_id FROM intercom_station_placement")}
    ids |= {r[0] for r in _table_rows(conn, "SELECT config_entry_id FROM intercom_door_map")}
    return sorted(ids)


def station_known(conn: sqlite3.Connection, station_id: str) -> bool:
    return station_id in known_station_ids(conn)


def station_relays(station: dict[str, Any] | None) -> list[int]:
    if not station or not station.get("lock_enabled"):
        return []
    return [int(lock["physical_index"]) for lock in station.get("locks") or []]


def placement_of(conn: sqlite3.Connection, station_id: str) -> dict[str, Any] | None:
    rows = _table_rows(conn, "SELECT * FROM intercom_station_placement WHERE config_entry_id = ?", (station_id,))
    return dict(rows[0]) if rows else None


def set_placement(conn: sqlite3.Connection, station_id: str, site_id: str | None, building_id: str | None, actor_id: str) -> dict[str, Any] | None:
    """Place a station under a building (its site follows) or a site, or unplace it (both None). The caller audits
    `intercom.station.placed` and checks the permission. Returns the new row (None when unplaced)."""
    if building_id:
        b = conn.execute("SELECT id, site_id FROM buildings WHERE id = ? AND deleted_at IS NULL", (building_id,)).fetchone()
        if b is None:
            raise ApiError(422, "scope_unknown", "המבנה לא נמצא.")
        site_id = b["site_id"]
    elif site_id:
        if conn.execute("SELECT 1 FROM sites WHERE id = ? AND deleted_at IS NULL", (site_id,)).fetchone() is None:
            raise ApiError(422, "scope_unknown", "האתר לא נמצא.")
    if not site_id and not building_id:
        conn.execute("DELETE FROM intercom_station_placement WHERE config_entry_id = ?", (station_id,))
        return None
    conn.execute(
        """INSERT INTO intercom_station_placement(config_entry_id, site_id, building_id, assigned_by, assigned_at, revision) VALUES (?,?,?,?,?,1)
           ON CONFLICT(config_entry_id) DO UPDATE SET site_id = excluded.site_id, building_id = excluded.building_id, assigned_by = excluded.assigned_by,
           assigned_at = excluded.assigned_at, revision = intercom_station_placement.revision + 1""",
        (station_id, site_id, building_id or None, actor_id, now_iso()),
    )
    return placement_of(conn, station_id)


# ---------------------------------------------------------------- the door map

def map_row(conn: sqlite3.Connection, entity_id: str) -> dict[str, Any] | None:
    rows = _table_rows(conn, "SELECT * FROM intercom_door_map WHERE entity_id = ?", (entity_id,))
    return dict(rows[0]) if rows else None


def map_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in _table_rows(conn, "SELECT * FROM intercom_door_map ORDER BY entity_id")]


def row_valid(conn: sqlite3.Connection, row: dict[str, Any], registry_entry: str | None) -> str | None:
    """Why a map row does not resolve right now (None = it does). Checked against the served WisKey copy when there is one
    (without a copy nothing can be sent anyway; the transport then fails as not sent) and against the entity's own registry
    config entry when the registry carries one."""
    if registry_entry and registry_entry != row["config_entry_id"]:
        return "registry_station_mismatch"
    if intercom_sync.SYNC.has_copy():
        station = intercom_sync.SYNC.station(row["config_entry_id"])
        if station is None:
            return "station_gone"
        if int(row["physical_index"]) not in station_relays(station):
            return "relay_gone"
    return None


def resolve(conn: sqlite3.Connection, entity_id: str) -> DoorTarget:
    """The station and relay of one WisKey lock entity, or the `intercom_lock_unmapped` refusal (409, nothing sent)."""
    row = map_row(conn, entity_id)
    if row is None:
        raise unmapped(entity_id)
    reg = conn.execute("SELECT config_entry_id FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    if row_valid(conn, row, reg["config_entry_id"] if reg else None) is not None:
        raise unmapped(entity_id)
    return DoorTarget(row["config_entry_id"], int(row["physical_index"]), row["source"], entity_id)


def entities_for(conn: sqlite3.Connection, station_id: str, relay: int | None = None) -> list[str]:
    """The lock entities mapped to a station (one relay, or any relay) - the `door.unlock` leg of the door authority."""
    if relay is None:
        rows = _table_rows(conn, "SELECT entity_id FROM intercom_door_map WHERE config_entry_id = ? ORDER BY entity_id", (station_id,))
    else:
        rows = _table_rows(conn, "SELECT entity_id FROM intercom_door_map WHERE config_entry_id = ? AND physical_index = ? ORDER BY entity_id", (station_id, relay))
    return [r[0] for r in rows]


def suggestions(conn: sqlite3.Connection) -> dict[str, DoorTarget]:
    """`single_relay` proposals: an unmapped WisKey lock entity whose registry config entry is a station the WisKey copy
    lists with exactly ONE relay, when it is the only WisKey lock entity carrying that config entry and that relay is not
    mapped yet. Anything ambiguous is no proposal (manual mapping is then the only way)."""
    locks = [r for r in wiskey_locks(conn) if not r["removed_at"]]
    mapped = {r["entity_id"] for r in map_rows(conn)}
    taken = {(r["config_entry_id"], int(r["physical_index"])) for r in map_rows(conn)}
    per_entry: dict[str, list[str]] = {}
    for r in locks:
        if r["config_entry_id"]:
            per_entry.setdefault(r["config_entry_id"], []).append(r["entity_id"])
    out: dict[str, DoorTarget] = {}
    for entry, entities in per_entry.items():
        if len(entities) != 1 or entities[0] in mapped:
            continue
        relays = station_relays(intercom_sync.SYNC.station(entry))
        if len(relays) != 1 or (entry, relays[0]) in taken:
            continue
        out[entities[0]] = DoorTarget(entry, relays[0], "single_relay", entities[0])
    return out


def set_mapping(conn: sqlite3.Connection, entity_id: str, station_id: str, relay: int, source: str, actor_id: str) -> dict[str, Any]:
    """Write one map row after the checks a manual or applied mapping needs: a WisKey lock entity, a station the WisKey
    copy lists with that relay, the entity's registry config entry (when known) being that station, and the relay not
    mapped to another entity. The caller audits `intercom.door.mapped` and checks the permission."""
    if source not in SOURCES:
        raise ApiError(422, "validation", "מקור שיוך לא מוכר.")
    if not is_wiskey_lock(conn, entity_id):
        raise ApiError(404, "intercom_lock_not_wiskey", "המנעול אינו דלת אינטרקום.")
    station = intercom_sync.SYNC.station(station_id)
    if station is None:
        raise ApiError(409, "intercom_station_not_found", "העמדה אינה ברשימת העמדות כרגע.")
    if relay not in station_relays(station):
        raise ApiError(422, "intercom_lock_unknown", "לעמדה אין ממסר במספר הזה.", details={"locks": station_relays(station)})
    reg = conn.execute("SELECT config_entry_id FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    if reg and reg["config_entry_id"] and reg["config_entry_id"] != station_id:
        raise ApiError(409, "intercom_map_station_mismatch", "המנעול שייך לעמדה אחרת.")
    other = conn.execute("SELECT entity_id FROM intercom_door_map WHERE config_entry_id = ? AND physical_index = ? AND entity_id != ?", (station_id, relay, entity_id)).fetchone()
    if other is not None:
        raise ApiError(409, "intercom_relay_taken", "הממסר הזה כבר משויך למנעול אחר.")
    conn.execute(
        """INSERT INTO intercom_door_map(entity_id, config_entry_id, physical_index, source, mapped_by, mapped_at, revision) VALUES (?,?,?,?,?,?,1)
           ON CONFLICT(entity_id) DO UPDATE SET config_entry_id = excluded.config_entry_id, physical_index = excluded.physical_index, source = excluded.source,
           mapped_by = excluded.mapped_by, mapped_at = excluded.mapped_at, revision = intercom_door_map.revision + 1""",
        (entity_id, station_id, relay, source, actor_id, now_iso()),
    )
    return map_row(conn, entity_id) or {}


def clear_mapping(conn: sqlite3.Connection, entity_id: str) -> bool:
    return conn.execute("DELETE FROM intercom_door_map WHERE entity_id = ?", (entity_id,)).rowcount > 0
