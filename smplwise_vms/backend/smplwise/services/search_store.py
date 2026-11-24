"""The SQL of the global-search router (routers/search.py, design M48; CR-ROUTER-SQL-D-2460, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the scope checks, the
matching and the result shape; each function runs on the connection the route hands it (the read connection)."""
from __future__ import annotations

import sqlite3

from . import devices as dsvc

Rows = list[sqlite3.Row]


def live_floor_ids(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()


def live_floors_with_building(conn: sqlite3.Connection) -> Rows:
    """Every live floor of a live building, with its building's name: by building name, then sort order, then floor name."""
    return conn.execute(
        "SELECT f.id, f.name, f.building_id, b.name AS building_name FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY b.name, f.sort_order, f.name"
    ).fetchall()


def searchable_zones(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, floor_id, name, kind FROM spatial_zones WHERE deleted_at IS NULL AND searchable = 1 ORDER BY name").fetchall()


def placed_cameras(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT resource_id, floor_id FROM map_anchors WHERE resource_type = 'camera' AND effective_to IS NULL").fetchall()


def enabled_cameras(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, alias, name_source, channel FROM cameras WHERE enabled = 1 ORDER BY sort_order, channel").fetchall()


def live_buildings(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name FROM buildings WHERE deleted_at IS NULL ORDER BY name").fetchall()


def placed_entities(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT resource_id, floor_id FROM map_anchors WHERE resource_type = 'ha_entity' AND effective_to IS NULL").fetchall()


def searchable_entities(conn: sqlite3.Connection) -> Rows:
    """Every enabled entity that is not a scheduler, with the state's friendly name (when the attributes are valid JSON)."""
    return conn.execute("SELECT entity_id, name, original_name, domain, area_id, area_name, CASE WHEN json_valid(attributes_json) THEN json_extract(attributes_json, '$.friendly_name') END AS friendly_name "
                        "FROM ha_entities WHERE disabled = 0 AND " + dsvc.NOT_SCHEDULER_SQL + " ORDER BY name, entity_id").fetchall()
