"""The SQL of the access groups router (routers/access_groups.py, T082; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the delegation checks,
the last-administrator guard, the previews and the audit; each function runs on the connection the route hands it. The savepoint
statements are services/savepoints.py's, re-exported here; the active-binding query text is services/rbac_admin._active_bindings_sql."""
from __future__ import annotations

import sqlite3

from .rbac_admin import _active_bindings_sql
from .savepoints import release_savepoint, rollback_savepoint, savepoint  # noqa: F401 - the router's savepoints, through this module

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- groups

def group(conn: sqlite3.Connection, group_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()


def groups_by_name(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM groups ORDER BY name").fetchall()


def name_taken(conn: sqlite3.Connection, name: str, except_id: str) -> bool:
    return conn.execute("SELECT 1 FROM groups WHERE name = ? AND id != ?", (name, except_id)).fetchone() is not None


def insert_group(conn: sqlite3.Connection, group_id: str, name: str, at: str, by: str | None) -> None:
    conn.execute("INSERT INTO groups(id, name, created_at, created_by, revision, updated_at, updated_by) VALUES (?, ?, ?, ?, 1, ?, ?)", (group_id, name, at, by, at, by))


def rename_group(conn: sqlite3.Connection, group_id: str, name: str) -> None:
    conn.execute("UPDATE groups SET name = ? WHERE id = ?", (name, group_id))


def delete_group(conn: sqlite3.Connection, group_id: str) -> None:
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))


# ---------------------------------------------------------------- members

def add_member(conn: sqlite3.Connection, group_id: str, user_id: str) -> None:
    conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, ?)", (group_id, user_id))


def add_member_if_missing(conn: sqlite3.Connection, group_id: str, user_id: str) -> None:
    conn.execute("INSERT OR IGNORE INTO group_members(group_id, user_id) VALUES (?, ?)", (group_id, user_id))


def remove_member(conn: sqlite3.Connection, group_id: str, user_id: str) -> None:
    conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, user_id))


# ---------------------------------------------------------------- group bindings

def group_bindings(conn: sqlite3.Connection, group_id: str, now: str) -> Rows:
    """The group's active bindings at `now`."""
    return conn.execute(_active_bindings_sql("AND subject_kind = 'group' AND subject_id = ?"), (now, group_id)).fetchall()


def live_group_binding(conn: sqlite3.Connection, group_id: str, binding_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM bindings WHERE id = ? AND revoked_at IS NULL AND subject_kind = 'group' AND subject_id = ?", (binding_id, group_id)).fetchone()


def insert_group_binding(conn: sqlite3.Connection, binding_id: str, group_id: str, role_id: str, scope_type: str, scope_id: str, effect: str, by: str | None, at: str) -> None:
    conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'group', ?, ?, ?, ?, ?, 0, ?, ?)",
                 (binding_id, group_id, role_id, scope_type, scope_id, effect, by, at))


def revoke_binding(conn: sqlite3.Connection, binding_id: str, at: str) -> None:
    conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (at, binding_id))
