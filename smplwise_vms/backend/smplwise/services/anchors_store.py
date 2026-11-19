"""The SQL of the map / anchors router (routers/anchors.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router ran
inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the reach checks, the bundle
shaping, the realign arithmetic and the audit; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- map_anchors

def live_anchor(conn: sqlite3.Connection, anchor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM map_anchors WHERE id = ? AND effective_to IS NULL", (anchor_id,)).fetchone()


def floor_anchors(conn: sqlite3.Connection, floor_id: str) -> Rows:
    """The floor's live anchors, by layer and resource."""
    return conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (floor_id,)).fetchall()


def floor_anchors_at(conn: sqlite3.Connection, floor_id: str, at_iso: str) -> Rows:
    """The floor's anchors that were in effect at the instant, by layer and resource."""
    return conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) ORDER BY layer_id, resource_id",
                        (floor_id, at_iso, at_iso)).fetchall()


def floor_anchors_off_version(conn: sqlite3.Connection, floor_id: str, version_id: str) -> Rows:
    return conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id != ?", (floor_id, version_id)).fetchall()


def floor_camera_ids(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT resource_id FROM map_anchors WHERE floor_id = ? AND resource_type = 'camera' AND effective_to IS NULL", (floor_id,)).fetchall()


def placed_anchor(conn: sqlite3.Connection, floor_id: str, resource_type: str, resource_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = ? AND resource_id = ?", (floor_id, resource_type, resource_id)).fetchone()


def insert_anchor(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, effective_from, created_by,
    updated_by, updated_at, coverage_radius, coverage_polygon, label_pos, level_id, mount_height_m, tilt_deg); revision starts at 1."""
    conn.execute(
        """INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at, coverage_radius, coverage_polygon, label_pos, level_id, mount_height_m, tilt_deg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        values,
    )


def move_anchor(conn: sqlite3.Connection, anchor_id: str, x: float, y: float, version_id: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE map_anchors SET x = ?, y = ?, plan_version_id = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (x, y, version_id, by, at, anchor_id))


def rebase_anchor(conn: sqlite3.Connection, anchor_id: str, version_id: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE map_anchors SET plan_version_id = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (version_id, by, at, anchor_id))


def patch_anchor(conn: sqlite3.Connection, anchor_id: str, fields: dict[str, Any], by: str | None, at: str) -> None:
    """UPDATE the given columns (names from the route's request model, never input text), bump the revision."""
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE map_anchors SET {sets}, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (*fields.values(), by, at, anchor_id))


def end_anchor(conn: sqlite3.Connection, anchor_id: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (at, by, at, anchor_id))


# ---------------------------------------------------------------- plan versions

def published_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone()


def newest_draft(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()


def first_published_at(conn: sqlite3.Connection, floor_id: str) -> str | None:
    return conn.execute("SELECT MIN(published_at) FROM plan_versions WHERE floor_id = ? AND published_at IS NOT NULL", (floor_id,)).fetchone()[0]


def floor_versions(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ?", (floor_id,)).fetchall()


# ---------------------------------------------------------------- cameras, entities, users, audit

def removed_recorder_camera_rows(conn: sqlite3.Connection) -> Rows:
    """The cameras of removed recorders. Raises sqlite3.OperationalError on a database before 0055."""
    return conn.execute("SELECT c.id FROM cameras c JOIN recorders r ON r.id = c.recorder_id WHERE r.removed_at IS NOT NULL").fetchall()


def cameras_in_order(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()


def camera_exists(conn: sqlite3.Connection, camera_id: str) -> bool:
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is not None


def entities(conn: sqlite3.Connection, entity_ids: list[str]) -> Rows:
    return conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' * len(entity_ids))})", entity_ids).fetchall()


def live_entity_domain(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def user_ids(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT id FROM users").fetchall()]


def presence_view_noted(conn: sqlite3.Connection, user_id: str | None, floor_id: str, day: str) -> sqlite3.Row | None:
    """The day's history.presence.view audit row of this user and floor, if any."""
    return conn.execute("SELECT 1 FROM audit_log WHERE action = 'history.presence.view' AND actor_user_id = ? AND resource_id = ? AND substr(at, 1, 10) = ? LIMIT 1",
                        (user_id, floor_id, day)).fetchone()
