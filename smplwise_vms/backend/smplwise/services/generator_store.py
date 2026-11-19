"""The SQL of the generator router (routers/generator.py, GEN1; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the router ran
inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission dependencies, the
validation and the audit; each function runs on the connection the route hands it. services/generator_core.py stays the generator model
(detection, role mapping, values, thresholds)."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- generator_devices

def live_device(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM generator_devices WHERE id = ? AND status <> 'removed'", (device_id,)).fetchone()


def live_devices(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM generator_devices WHERE status <> 'removed' ORDER BY name, id").fetchall()


def live_devices_brief(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name, area_id, status FROM generator_devices WHERE status <> 'removed' ORDER BY name, id").fetchall()


def taken_device_refs(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT source_device_ref FROM generator_devices WHERE status <> 'removed'").fetchall()}


def update_device(conn: sqlite3.Connection, device_id: str, sets: dict[str, Any]) -> None:
    """`sets` maps column -> value; its keys are the router's fixed allow-list (name, area_id, rated_kw, rated_kva, fuel_type), never
    request input. Bumps the revision."""
    conn.execute(f"UPDATE generator_devices SET {', '.join(f'{k} = ?' for k in sets)}, revision = revision + 1 WHERE id = ?", (*sets.values(), device_id))


def device_roles(conn: sqlite3.Connection, device_id: str) -> Rows:
    return conn.execute("SELECT * FROM generator_roles WHERE device_id = ?", (device_id,)).fetchall()


# ---------------------------------------------------------------- open alerts

def open_alert_count(conn: sqlite3.Connection, device_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM generator_alerts WHERE device_id = ? AND cleared_at IS NULL", (device_id,)).fetchone()[0]


def open_alert_counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {r[0]: r[1] for r in conn.execute("SELECT device_id, COUNT(*) FROM generator_alerts WHERE cleared_at IS NULL GROUP BY device_id").fetchall()}


def open_critical_counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {r[0]: r[1] for r in conn.execute("SELECT device_id, COUNT(*) FROM generator_alerts WHERE cleared_at IS NULL AND severity = 'critical' GROUP BY device_id").fetchall()}


# ---------------------------------------------------------------- the platform mirror

def area_name(conn: sqlite3.Connection, area_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT name FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()


def live_registry_devices(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM ha_devices WHERE removed_at IS NULL").fetchall()


def entity_names(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT entity_id, name, original_name FROM ha_entities").fetchall()


def live_entity_exists(conn: sqlite3.Connection, entity_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone() is not None
