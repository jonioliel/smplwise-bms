"""The SQL of the saved-views router (routers/views.py, live review F3; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission checks, the camera
checks and the audit; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


def live_site_ids(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL").fetchall()


def camera_names(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()


def camera_exists(conn: sqlite3.Connection, camera_id: str) -> bool:
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is not None


def visible_views(conn: sqlite3.Connection, user_id: str) -> Rows:
    """The caller's own live views plus every shared one: shared first, then by name (case-insensitive)."""
    return conn.execute("SELECT * FROM saved_views WHERE deleted_at IS NULL AND (shared = 1 OR owner_user_id = ?) ORDER BY shared DESC, name COLLATE NOCASE", (user_id,)).fetchall()


def view(conn: sqlite3.Connection, view_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM saved_views WHERE id = ?", (view_id,)).fetchone()


def live_view(conn: sqlite3.Connection, view_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM saved_views WHERE id = ? AND deleted_at IS NULL", (view_id,)).fetchone()


def insert_view(conn: sqlite3.Connection, view_id: str, name: str, cameras_json: str, cols: int, rows: int, shared: int, kiosk: int, owner_user_id: str,
                owner_username: str, created_at: str, updated_at: str) -> None:
    conn.execute(
        "INSERT INTO saved_views(id, name, cameras_json, cols, rows, shared, kiosk, owner_user_id, owner_username, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (view_id, name, cameras_json, cols, rows, shared, kiosk, owner_user_id, owner_username, created_at, updated_at),
    )


def update_view(conn: sqlite3.Connection, view_id: str, name: str, cameras_json: str, cols: int, rows: int, shared: int, kiosk: int, updated_at: str) -> None:
    conn.execute(
        "UPDATE saved_views SET name = ?, cameras_json = ?, cols = ?, rows = ?, shared = ?, kiosk = ?, updated_at = ? WHERE id = ?",
        (name, cameras_json, cols, rows, shared, kiosk, updated_at, view_id),
    )


def delete_view(conn: sqlite3.Connection, view_id: str, deleted_at: str, updated_at: str) -> None:
    """Soft delete."""
    conn.execute("UPDATE saved_views SET deleted_at = ?, updated_at = ? WHERE id = ?", (deleted_at, updated_at, view_id))
