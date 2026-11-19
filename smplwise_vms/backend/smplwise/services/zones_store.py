"""The SQL of the zones (rooms) router (routers/zones.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router ran
inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the reach checks, the shared-space
rules (services/shared_spaces), the room detection and the audit; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- spatial_zones

def floor_zone_rows(conn: sqlite3.Connection, floor_id: str) -> Rows:
    """The floor's live zones in creation order."""
    return conn.execute("SELECT * FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid", (floor_id,)).fetchall()


def live_zone(conn: sqlite3.Connection, zone_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zone_id,)).fetchone()


def live_zone_count(conn: sqlite3.Connection, floor_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()[0]


def insert_zone(conn: sqlite3.Connection, zone_id: str, floor_id: str, version_id: str | None, name: str, kind: str, polygon_json: str, color: str, source: str, searchable: int,
                by: str | None, at: str) -> None:
    conn.execute(
        "INSERT INTO spatial_zones(id, floor_id, plan_version_id, name, kind, polygon_json, color, source, searchable, revision, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)",
        (zone_id, floor_id, version_id, name, kind, polygon_json, color, source, searchable, by, at, at),
    )


def patch_zone(conn: sqlite3.Connection, zone_id: str, fields: dict[str, Any]) -> None:
    """UPDATE the given columns (names from the route's request model, never input text)."""
    conn.execute(f"UPDATE spatial_zones SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), zone_id))


def delete_zone(conn: sqlite3.Connection, zone_id: str, at: str) -> None:
    conn.execute("UPDATE spatial_zones SET deleted_at = ? WHERE id = ?", (at, zone_id))


def live_auto_zone_count(conn: sqlite3.Connection, floor_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM spatial_zones WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL", (floor_id,)).fetchone()[0]


def live_auto_zone_ids(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT id FROM spatial_zones WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL", (floor_id,)).fetchall()


def delete_auto_zones_except(conn: sqlite3.Connection, floor_id: str, keep: set[str], at: str) -> None:
    """Every live automatic zone of the floor except `keep`."""
    conn.execute(f"UPDATE spatial_zones SET deleted_at = ? WHERE floor_id = ? AND source = 'auto' AND deleted_at IS NULL AND id NOT IN ({','.join('?' * len(keep)) or "''"})", (at, floor_id, *sorted(keep)))


# ---------------------------------------------------------------- floors, anchors, names, users

def floor_names(conn: sqlite3.Connection, floor_ids: list[str]) -> Rows:
    return conn.execute(f"SELECT id, name FROM floors WHERE id IN ({','.join('?' * len(floor_ids))})", floor_ids).fetchall()


def floor_name(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, name FROM floors WHERE id = ?", (floor_id,)).fetchone()


def live_anchors_on(conn: sqlite3.Connection, floor_ids: list[str]) -> Rows:
    """(id, floor_id, resource_type, resource_id) of the live anchors on the floors."""
    q = ",".join("?" * len(floor_ids))
    return conn.execute(f"SELECT id, floor_id, resource_type, resource_id FROM map_anchors WHERE effective_to IS NULL AND floor_id IN ({q}) ORDER BY floor_id, resource_type, resource_id",
                        floor_ids).fetchall()


def placed_on_any(conn: sqlite3.Connection, resource_type: str, resource_id: str, floor_ids: list[str]) -> bool:
    q = ",".join("?" * len(floor_ids))
    return conn.execute(f"SELECT 1 FROM map_anchors WHERE resource_type = ? AND resource_id = ? AND effective_to IS NULL AND floor_id IN ({q})", (resource_type, resource_id, *floor_ids)).fetchone() is not None


def camera_name(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT alias, name_source, channel FROM cameras WHERE id = ?", (camera_id,)).fetchone()


def entity_name(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def user_ids(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT id FROM users").fetchall()]
