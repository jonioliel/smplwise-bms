"""The SQL of the devices router (routers/devices.py, CR-007 / CR-019 / DEVHIST; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement
the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission checks, the
bridge calls (with the write lock released), the audit and the answers; each function runs on the connection the route hands it.
services/devices.py stays the device catalogue model."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the platform mirror (ha_entities / ha_areas / ha_floors)

def live_entity_brief(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT entity_id, name, domain, device_class FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def entity_attributes_json(conn: sqlite3.Connection, entity_id: str) -> str | None:
    """The entity's stored attributes (JSON text). The row must exist (a missing one raises TypeError, as the inline read did)."""
    return conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()[0]


def live_entity_domain(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def live_entity_area(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT entity_id, area_id FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def area(conn: sqlite3.Connection, area_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT area_id, name, floor_id FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()


def floor_name(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM ha_floors WHERE floor_id = ?", (floor_id,)).fetchone()


def set_entity_area(conn: sqlite3.Connection, entity_id: str, area_id: str, area_name: str | None, ha_floor_id: str | None, ha_floor_name: str | None, updated_at: str) -> None:
    """The local mirror follows an area change the platform accepted."""
    conn.execute(
        "UPDATE ha_entities SET area_id = ?, area_name = ?, ha_floor_id = ?, ha_floor_name = ?, updated_at = ? WHERE entity_id = ?",
        (area_id, area_name, ha_floor_id, ha_floor_name, updated_at, entity_id),
    )


# ---------------------------------------------------------------- group-action protection, climate groups, bulk actions

def bulk_protected(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM device_bulk_protected").fetchall()


def delete_climate_kind(conn: sqlite3.Connection, entity_id: str) -> None:
    conn.execute("DELETE FROM device_climate_kind WHERE entity_id = ?", (entity_id,))


def upsert_climate_kind(conn: sqlite3.Connection, entity_id: str, kind: str, set_by: str, set_by_username: str, set_at: str) -> None:
    conn.execute(
        "INSERT INTO device_climate_kind(entity_id, kind, set_by, set_by_username, set_at) VALUES (?,?,?,?,?) ON CONFLICT(entity_id) DO UPDATE SET kind = excluded.kind, set_by = excluded.set_by, set_by_username = excluded.set_by_username, set_at = excluded.set_at",
        (entity_id, kind, set_by, set_by_username, set_at),
    )


def bulk_action_by_client_request(conn: sqlite3.Connection, principal_user_id: str, client_request_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM device_bulk_actions WHERE principal_user_id = ? AND client_request_id = ?", (principal_user_id, client_request_id)).fetchone()
