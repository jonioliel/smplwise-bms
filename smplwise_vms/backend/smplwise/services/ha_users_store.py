"""The SQL of the home-system users router (routers/ha_users.py, USR1; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls); the savepoint statements are services/savepoints.py's, re-exported here. The
router keeps the guards, the Home Assistant calls, the compensation order and the audit; each function runs on the connection the
route hands it."""
from __future__ import annotations

import sqlite3

from .savepoints import release_savepoint, rollback_savepoint, savepoint  # noqa: F401 - the router's savepoints, through this module

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the synced directory and the Arx users

def directory_flags(conn: sqlite3.Connection, ha_user_id: str) -> sqlite3.Row | None:
    """(is_admin, is_active) of the user in the synced directory."""
    return conn.execute("SELECT is_admin, is_active FROM ha_users WHERE id = ?", (ha_user_id,)).fetchone()


def directory_admin_flag(conn: sqlite3.Connection, ha_user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT is_admin FROM ha_users WHERE id = ?", (ha_user_id,)).fetchone()


def user_names(conn: sqlite3.Connection, user_id: str | None) -> sqlite3.Row | None:
    return conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()


def set_user_active(conn: sqlite3.Connection, user_id: str, active: int) -> None:
    conn.execute("UPDATE users SET active = ? WHERE id = ?", (active, user_id))


def deactivate_user(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("UPDATE users SET active = 0 WHERE id = ?", (user_id,))


def set_directory_active(conn: sqlite3.Connection, ha_user_id: str, active: int) -> None:
    conn.execute("UPDATE ha_users SET is_active = ? WHERE id = ?", (active, ha_user_id))


def deactivate_directory_user(conn: sqlite3.Connection, ha_user_id: str) -> None:
    conn.execute("UPDATE ha_users SET is_active = 0 WHERE id = ?", (ha_user_id,))


def mirror_created_user(conn: sqlite3.Connection, ha_user_id: str, name: str, username: str, group_ids_json: str, at: str) -> None:
    """The directory mirror row of a user Arx just created (the bridge's next push overwrites it)."""
    conn.execute(
        "INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES (?, ?, ?, 1, 0, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username",
        (ha_user_id, name, username, group_ids_json, at),
    )


def username_taken(conn: sqlite3.Connection, username: str, live_states: tuple[str, ...]) -> sqlite3.Row | None:
    """A directory user with this name (not one Arx deleted), else a live managed row with it; None when free."""
    return conn.execute("SELECT 1 FROM ha_users WHERE lower(username) = ? AND id NOT IN (SELECT ha_user_id FROM ha_managed_users WHERE state = 'deleted')",
                        (username,)).fetchone() or conn.execute(
        f"SELECT 1 FROM ha_managed_users WHERE lower(username) = ? AND state IN ({','.join('?' * len(live_states))})", (username, *live_states)).fetchone()


def linked_local_users(conn: sqlite3.Connection, ha_user_id: str) -> list[str]:
    return [r[0] for r in conn.execute("SELECT local_user_id FROM identity_links WHERE ha_user_id = ? ORDER BY local_user_id", (ha_user_id,))]


def live_user_bindings(conn: sqlite3.Connection, ha_user_id: str) -> Rows:
    return conn.execute("SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL", (ha_user_id,)).fetchall()


def drop_group_memberships(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("DELETE FROM group_members WHERE user_id = ?", (user_id,))


# ---------------------------------------------------------------- ha_managed_users

def managed(conn: sqlite3.Connection, ha_user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_managed_users WHERE ha_user_id = ? AND state != 'deleted'", (ha_user_id,)).fetchone()


def managed_row(conn: sqlite3.Connection, row_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_managed_users WHERE id = ?", (row_id,)).fetchone()


def managed_by_request_key(conn: sqlite3.Connection, request_key: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_managed_users WHERE request_key = ?", (request_key,)).fetchone()


def listed_managed(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM ha_managed_users WHERE state IN ('active', 'inactive', 'needs_repair') ORDER BY created_at").fetchall()


def count_in_states(conn: sqlite3.Connection, states: tuple[str, ...]) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM ha_managed_users WHERE state IN ({','.join('?' * len(states))})", states).fetchone()[0]


def insert_creating(conn: sqlite3.Connection, row_id: str, request_key: str | None, username: str, display_name: str, role_id: str, scope_type: str, scope_id: str,
                    who: str | None, at: str) -> None:
    conn.execute(
        "INSERT INTO ha_managed_users(id, request_key, username, display_name, role_id, scope_type, scope_id, state, created_by, created_at, updated_by, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'creating', ?, ?, ?, ?)",
        (row_id, request_key, username, display_name, role_id, scope_type, scope_id, who, at, who, at),
    )


def delete_managed(conn: sqlite3.Connection, row_id: str) -> None:
    conn.execute("DELETE FROM ha_managed_users WHERE id = ?", (row_id,))


def mark_compensation_failed(conn: sqlite3.Connection, row_id: str, ha_user_id: str, at: str) -> None:
    conn.execute("UPDATE ha_managed_users SET ha_user_id = ?, state = 'needs_repair', repair = 'compensation_failed', updated_at = ? WHERE id = ?", (ha_user_id, at, row_id))


def mark_binding_failed(conn: sqlite3.Connection, row_id: str, ha_user_id: str, person_id: str | None, at: str) -> None:
    conn.execute("UPDATE ha_managed_users SET ha_user_id = ?, person_id = ?, state = 'needs_repair', repair = 'binding_failed', updated_at = ? WHERE id = ?",
                 (ha_user_id, person_id, at, row_id))


def mark_created(conn: sqlite3.Connection, row_id: str, ha_user_id: str, person_id: str | None, binding_id: str, repair: str | None, at: str) -> None:
    conn.execute(
        "UPDATE ha_managed_users SET ha_user_id = ?, person_id = ?, binding_id = ?, state = 'active', repair = ?, updated_at = ? WHERE id = ?",
        (ha_user_id, person_id, binding_id, repair, at, row_id),
    )


def mark_missing_in_ha(conn: sqlite3.Connection, row_id: str, who: str | None, at: str) -> None:
    conn.execute("UPDATE ha_managed_users SET state = 'needs_repair', repair = 'missing_in_ha', updated_by = ?, updated_at = ? WHERE id = ?", (who, at, row_id))


def set_managed_state(conn: sqlite3.Connection, row_id: str, state: str, who: str | None, at: str) -> None:
    conn.execute("UPDATE ha_managed_users SET state = ?, updated_by = ?, updated_at = ? WHERE id = ?", (state, who, at, row_id))


def mark_deleted(conn: sqlite3.Connection, row_id: str, deleted_at: str, who: str | None, updated_at: str) -> None:
    conn.execute("UPDATE ha_managed_users SET state = 'deleted', repair = NULL, deleted_at = ?, updated_by = ?, updated_at = ? WHERE id = ?", (deleted_at, who, updated_at, row_id))


def mark_cleanup_failed(conn: sqlite3.Connection, row_id: str, who: str | None, at: str) -> None:
    conn.execute("UPDATE ha_managed_users SET state = 'needs_repair', repair = 'cleanup_failed', updated_by = ?, updated_at = ? WHERE id = ?", (who, at, row_id))
