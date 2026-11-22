"""The SQL of the custom-roles / delegation router (routers/access_custom_roles.py, T082; CR-ROUTER-SQL-B-2450, review 05:P2-07): every
statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission
checks, the validation, the permission-revision bump, the session terminations and the audit; each function runs on the connection the
route hands it. services/rbac_admin.py stays the role logic."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


def custom_role(conn: sqlite3.Connection, role_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM custom_roles WHERE id = ?", (role_id,)).fetchone()


def live_custom_role(conn: sqlite3.Connection, role_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM custom_roles WHERE id = ? AND deleted_at IS NULL", (role_id,)).fetchone()


def live_name_taken(conn: sqlite3.Connection, name_he: str) -> bool:
    return conn.execute("SELECT 1 FROM custom_roles WHERE name_he = ? AND deleted_at IS NULL", (name_he,)).fetchone() is not None


def live_delegable_flags(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, delegable FROM custom_roles WHERE deleted_at IS NULL").fetchall()


def insert_custom_role(conn: sqlite3.Connection, role_id: str, name_he: str, description: str, permissions_json: str, sensitive_json: str, delegable: int,
                       user_id: str, username: str, now: str) -> None:
    """Revision 1; the caller is creator and last editor."""
    conn.execute(
        "INSERT INTO custom_roles(id, name_he, description, permissions_json, sensitive_json, delegable, revision, created_by, created_by_username, updated_by, updated_by_username, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?)",
        (role_id, name_he, description, permissions_json, sensitive_json, delegable, user_id, username, user_id, username, now, now),
    )


def update_custom_role(conn: sqlite3.Connection, role_id: str, name_he: str, description: str, permissions_json: str, sensitive_json: str, delegable: int,
                       updated_by: str, updated_by_username: str, updated_at: str) -> None:
    conn.execute(
        "UPDATE custom_roles SET name_he = ?, description = ?, permissions_json = ?, sensitive_json = ?, delegable = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
        (name_he, description, permissions_json, sensitive_json, delegable, updated_by, updated_by_username, updated_at, role_id),
    )


def delete_custom_role(conn: sqlite3.Connection, role_id: str, deleted_at: str, updated_by: str, updated_by_username: str) -> None:
    """Soft delete (the revision does not move, as before)."""
    conn.execute("UPDATE custom_roles SET deleted_at = ?, updated_by = ?, updated_by_username = ? WHERE id = ?", (deleted_at, updated_by, updated_by_username, role_id))


def set_delegable(conn: sqlite3.Connection, role_id: str, delegable: int, updated_by: str, updated_by_username: str, updated_at: str) -> None:
    conn.execute("UPDATE custom_roles SET delegable = ?, revision = revision + 1, updated_by = ?, updated_by_username = ?, updated_at = ? WHERE id = ?",
                 (delegable, updated_by, updated_by_username, updated_at, role_id))
