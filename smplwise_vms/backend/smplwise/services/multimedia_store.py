"""The SQL of the multimedia router (routers/multimedia.py, CR-016; CR-ROUTER-SQL-D-2460, review 05:P2-07): the statements the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). The router already imports
`services/media_store.py` as `store` (the media model's own store); it imports this module as `rstore`. The router keeps the
permission checks, the bridge call, the audit and the transaction; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


# ---------------------------------------------------------------- media devices

def screen_anchor(conn: sqlite3.Connection, key: str) -> sqlite3.Row | None:
    """The live device's anchor entity, approval flag and kind."""
    return conn.execute("SELECT anchor_entity_id, approved, kind FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()


def device_anchor(conn: sqlite3.Connection, key: str) -> sqlite3.Row | None:
    return conn.execute("SELECT anchor_entity_id FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()


def device_exists(conn: sqlite3.Connection, key: str) -> bool:
    """A live (not removed) device with this key."""
    return conn.execute("SELECT 1 FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone() is not None


# ---------------------------------------------------------------- the local mirror of Home Assistant areas

def ha_area(conn: sqlite3.Connection, area_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT area_id, name, floor_id FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()


def entity_area(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT area_id FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def ha_floor_name(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM ha_floors WHERE floor_id = ?", (floor_id,)).fetchone()


def set_entity_area(conn: sqlite3.Connection, entity_id: str, area_id: str, area_name: str, ha_floor_id: str | None, ha_floor_name: str | None, updated_at: str) -> None:
    """The local mirror after Home Assistant accepted the area."""
    conn.execute("UPDATE ha_entities SET area_id = ?, area_name = ?, ha_floor_id = ?, ha_floor_name = ?, updated_at = ? WHERE entity_id = ?",
                 (area_id, area_name, ha_floor_id, ha_floor_name, updated_at, entity_id))


# ---------------------------------------------------------------- group presets

def group_preset(conn: sqlite3.Connection, preset_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM media_group_presets WHERE preset_id = ?", (preset_id,)).fetchone()
