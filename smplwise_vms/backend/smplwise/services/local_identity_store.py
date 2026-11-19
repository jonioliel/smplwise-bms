"""The SQL of the Arx-users router (routers/local_identity.py, USR2; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the guards, the lease
hooks, the session and link side effects and the audit; each function runs on the connection the route hands it. The savepoint
statements are services/savepoints.py's, re-exported here.

services/local_identity.py stays the identity service (sessions, links, tiers); this module only holds the router's own reads and
writes."""
from __future__ import annotations

import sqlite3

from .savepoints import release_savepoint, rollback_savepoint, savepoint  # noqa: F401 - the router's savepoints, through this module

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- reads

def local_user(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    """The local user with its credential summary (deleted ones too)."""
    return conn.execute("""SELECT u.*, c.password_hash IS NOT NULL AS has_password, c.must_change, c.reset_mode, c.last_sign_in_at, c.last_sign_in_from,
                                 c.failed_count, c.delay_until FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                          WHERE u.id = ? AND u.source = 'local'""", (user_id,)).fetchone()


def local_users(conn: sqlite3.Connection, include_deleted: bool) -> Rows:
    """Every local user with its credential summary, by display name."""
    return conn.execute("""SELECT u.*, c.password_hash IS NOT NULL AS has_password, c.must_change, c.reset_mode, c.last_sign_in_at, c.last_sign_in_from,
                                  c.failed_count, c.delay_until FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                           WHERE u.source = 'local'""" + ("" if include_deleted else " AND u.deleted_at IS NULL") + " ORDER BY u.display_name COLLATE NOCASE").fetchall()


def live_local_users(conn: sqlite3.Connection) -> Rows:
    """Every local user that is not deleted, with its credential summary, by display name (the CSV export)."""
    return conn.execute("""SELECT u.*, c.password_hash IS NOT NULL AS has_password, c.must_change, c.reset_mode, c.last_sign_in_at, c.last_sign_in_from,
                                  c.failed_count, c.delay_until FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                           WHERE u.source = 'local' AND u.deleted_at IS NULL ORDER BY u.display_name COLLATE NOCASE""").fetchall()


def role_binding(conn: sqlite3.Connection, user_id: str, now: str) -> sqlite3.Row | None:
    """The user's newest live binding that is the person's role (not the temporary emergency_open grant, EMROLE-295)."""
    return conn.execute("""SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL
                           AND role_id != 'emergency_open' AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1""", (user_id, now)).fetchone()


def live_role_bindings(conn: sqlite3.Connection, user_id: str) -> Rows:
    """Every live binding of the user except the emergency_open grant."""
    return conn.execute("SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL AND role_id != 'emergency_open'", (user_id,)).fetchall()


def ha_link(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT ha_user_id FROM identity_links WHERE local_user_id = ?", (user_id,)).fetchone()


def username_key_in_users(conn: sqlite3.Connection, key: str) -> bool:
    return conn.execute("SELECT 1 FROM users WHERE lower(trim(username)) = ?", (key,)).fetchone() is not None


def directory_usernames(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT username FROM ha_users WHERE username IS NOT NULL").fetchall()


def directory_user_exists(conn: sqlite3.Connection, ha_user_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_users WHERE id = ?", (ha_user_id,)).fetchone() is not None


# ---------------------------------------------------------------- writes

def label_session_chain(conn: sqlite3.Connection, chain_id: str, label: str | None) -> None:
    conn.execute("UPDATE auth_local_sessions SET label = ? WHERE chain_id = ? AND revoked_at IS NULL", (label, chain_id))


def insert_local_user(conn: sqlite3.Connection, user_id: str, username: str, display_name: str, at: str, email: str | None, created_by: str | None, notes: str | None) -> None:
    conn.execute("""INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at, email, created_by, notes)
                        VALUES (?, ?, ?, 'local', 1, ?, ?, ?, ?, ?)""", (user_id, username, display_name, at, at, email, created_by, notes))


def insert_credentials_with_password(conn: sqlite3.Connection, user_id: str, reset_mode: str, at: str, password_hash: str, params_version: int, must_change: int) -> None:
    conn.execute("""INSERT INTO auth_local_credentials(user_id, reset_mode, updated_at, password_hash, params_version, set_at, set_by, must_change)
                            VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)""", (user_id, reset_mode, at, password_hash, params_version, at, must_change))


def insert_credentials(conn: sqlite3.Connection, user_id: str, reset_mode: str, at: str) -> None:
    conn.execute("INSERT INTO auth_local_credentials(user_id, reset_mode, updated_at) VALUES (?, ?, ?)", (user_id, reset_mode, at))


def set_password_by_admin(conn: sqlite3.Connection, user_id: str, password_hash: str, params_version: int, must_change: int, at: str) -> None:
    conn.execute("""UPDATE auth_local_credentials SET password_hash = ?, params_version = ?, set_at = ?, set_by = 'admin', must_change = ?,
                    failed_count = 0, last_failed_at = NULL, delay_until = NULL, updated_at = ? WHERE user_id = ?""",
                 (password_hash, params_version, at, must_change, at, user_id))


def set_display_name(conn: sqlite3.Connection, user_id: str, name: str) -> None:
    conn.execute("UPDATE users SET display_name = ? WHERE id = ?", (name, user_id))


def set_email(conn: sqlite3.Connection, user_id: str, email: str | None) -> None:
    conn.execute("UPDATE users SET email = ? WHERE id = ?", (email, user_id))


def set_notes(conn: sqlite3.Connection, user_id: str, notes: str | None) -> None:
    conn.execute("UPDATE users SET notes = ? WHERE id = ?", (notes, user_id))


def set_reset_mode(conn: sqlite3.Connection, user_id: str, reset_mode: str, at: str) -> None:
    conn.execute("UPDATE auth_local_credentials SET reset_mode = ?, updated_at = ? WHERE user_id = ?", (reset_mode, at, user_id))


def force_manager_only_reset(conn: sqlite3.Connection, user_id: str, at: str) -> None:
    conn.execute("UPDATE auth_local_credentials SET reset_mode = 'manager_only', updated_at = ? WHERE user_id = ?", (at, user_id))


def passkey_first_off(conn: sqlite3.Connection, user_id: str, at: str) -> None:
    conn.execute("UPDATE auth_local_credentials SET passkey_first = 0, updated_at = ? WHERE user_id = ?", (at, user_id))


def disable_user(conn: sqlite3.Connection, user_id: str, at: str, by: str | None) -> None:
    conn.execute("UPDATE users SET active = 0, disabled_at = ?, disabled_by = ? WHERE id = ?", (at, by, user_id))


def enable_user(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute("UPDATE users SET active = 1, disabled_at = NULL, disabled_by = NULL WHERE id = ?", (user_id,))


def mark_user_deleted(conn: sqlite3.Connection, user_id: str, at: str, by: str | None) -> None:
    conn.execute("UPDATE users SET active = 0, deleted_at = ?, disabled_at = COALESCE(disabled_at, ?), disabled_by = COALESCE(disabled_by, ?) WHERE id = ?",
                 (at, at, by, user_id))


def revoke_user_bindings(conn: sqlite3.Connection, user_id: str, at: str) -> int:
    """End every live binding of the user (the emergency_open grant too); returns how many."""
    return conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL", (at, user_id)).rowcount


def delete_ha_link(conn: sqlite3.Connection, user_id: str) -> int:
    return conn.execute("DELETE FROM identity_links WHERE local_user_id = ?", (user_id,)).rowcount


def insert_ha_link(conn: sqlite3.Connection, ha_user_id: str, user_id: str, by: str | None, at: str) -> None:
    conn.execute("INSERT INTO identity_links(ha_user_id, local_user_id, linked_by, linked_at) VALUES (?, ?, ?, ?)", (ha_user_id, user_id, by, at))


def unlock(conn: sqlite3.Connection, user_id: str, by: str | None, at: str) -> None:
    conn.execute("UPDATE auth_local_credentials SET failed_count = 0, last_failed_at = NULL, delay_until = NULL, unlocked_by = ?, updated_at = ? WHERE user_id = ?",
                 (by, at, user_id))
