"""The SQL of the wall-display router (routers/wall.py, CR-001; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router ran
inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the checks, the binding sync, the
socket handling and the audit; each function runs on the connection the route hands it. The savepoint statements are
services/savepoints.py's, re-exported here. services/wall.py stays the profile model."""
from __future__ import annotations

import sqlite3

from .savepoints import release_savepoint, rollback_savepoint, savepoint  # noqa: F401 - the router's savepoints, through this module

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- cameras, entities, users, bindings

def camera_name_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()


def camera_exists(conn: sqlite3.Connection, camera_id: str) -> bool:
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is not None


def entity_exists(conn: sqlite3.Connection, entity_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone() is not None


def entity_state(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT entity_id, state, unit, original_name, available FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def kiosk_bindings(conn: sqlite3.Connection, user_id: str, kiosk_role: str) -> Rows:
    return conn.execute(
        "SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND role_id = ? AND effect = 'allow' AND revoked_at IS NULL", (user_id, kiosk_role)
    ).fetchall()


def live_binding_roles(conn: sqlite3.Connection, user_id: str) -> Rows:
    return conn.execute("SELECT role_id FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL", (user_id,)).fetchall()


def candidate_users(conn: sqlite3.Connection) -> Rows:
    """Active directory users without a wall profile, by name."""
    return conn.execute(
        "SELECT id, username, name FROM ha_users WHERE is_active = 1 AND id NOT IN (SELECT user_id FROM wall_profiles) ORDER BY COALESCE(name, username) COLLATE NOCASE"
    ).fetchall()


# ---------------------------------------------------------------- wall_profiles

def profiles_by_title(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM wall_profiles ORDER BY title COLLATE NOCASE").fetchall()


def profiles(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM wall_profiles").fetchall()


def profile_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) AS n FROM wall_profiles").fetchone()["n"]


def insert_profile(conn: sqlite3.Connection, user_id: str, title: str, area_id: str | None, floor_id: str | None, config_json: str, at: str, by: str | None) -> None:
    conn.execute(
        "INSERT INTO wall_profiles(user_id, title, area_id, floor_id, enabled, remote_allowed, version, config_json, created_at, created_by, updated_at, updated_by) VALUES (?,?,?,?,1,0,1,?,?,?,?,?)",
        (user_id, title, area_id, floor_id, config_json, at, by, at, by),
    )


def update_profile(conn: sqlite3.Connection, user_id: str, title: str, area_id: str | None, floor_id: str | None, enabled: object, remote: object, desktop: int,
                   config_json: str, at: str, by: str | None) -> None:
    conn.execute(
        "UPDATE wall_profiles SET title = ?, area_id = ?, floor_id = ?, enabled = ?, remote_allowed = ?, desktop = ?, config_json = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE user_id = ?",
        (title, area_id, floor_id, enabled, remote, desktop, config_json, at, by, user_id),
    )


def set_profile_config(conn: sqlite3.Connection, user_id: str, config_json: str, at: str, by: str | None) -> None:
    conn.execute("UPDATE wall_profiles SET config_json = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE user_id = ?", (config_json, at, by, user_id))


def delete_profile(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("DELETE FROM wall_profiles WHERE user_id = ?", (user_id,))
