"""The SQL of the Home Assistant entities router (routers/ha.py, chapters 14/15; CR-ROUTER-SQL-HA-2450, review 05:P2-07): every
statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the
checks, the timing, the claim / write-aside choreography of the single-entity action route and the audit; each function runs on
the connection the route hands it (the request's read connection, a `write_aside` / `connection(mode="read")` block, or the
directory push's write connection) and never opens, commits or releases one."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the entity catalogue

def entity_row(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def entity_config_entry(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT config_entry_id FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def list_entity_rows(conn: sqlite3.Connection, *, include_disabled: bool, domain: str | None, area: str | None, q: str | None, limit: int) -> Rows:
    """GET /ha/entities: the catalogue query, built as the router built it."""
    sql = "SELECT * FROM ha_entities WHERE removed_at IS NULL"
    args: list[Any] = []
    if not include_disabled:
        sql += " AND disabled = 0"
    if domain:
        sql += " AND domain = ?"
        args.append(domain)
    if area:
        sql += " AND (area_id = ? OR area_name = ?)"
        args.extend([area, area])
    if q:
        sql += " AND (entity_id LIKE ? OR name LIKE ? OR area_name LIKE ?)"
        like = f"%{q}%"
        args.extend([like, like, like])
    sql += " ORDER BY domain, name, entity_id LIMIT ?"
    args.append(limit)
    return conn.execute(sql, args).fetchall()


def domain_counts(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT domain, COUNT(*) AS n FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 GROUP BY domain").fetchall()


def area_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT DISTINCT area_id, area_name FROM ha_entities WHERE removed_at IS NULL AND area_id IS NOT NULL ORDER BY area_name").fetchall()


def chip_rows(conn: sqlite3.Connection) -> Rows:
    """The floor-scoped reader's filter chips: every live, enabled entity's domain and area."""
    return conn.execute("SELECT entity_id, domain, area_id, area_name FROM ha_entities WHERE removed_at IS NULL AND disabled = 0").fetchall()


# ---------------------------------------------------------------- actions

INSERT_ACTION_SQL = "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING"


def recent_actions(conn: sqlite3.Connection, entity_id: str) -> Rows:
    return conn.execute("SELECT id, action_id, status, requested_at, confirmed_at, principal_username, error FROM ha_actions WHERE entity_id = ? ORDER BY requested_at DESC, rowid DESC LIMIT 5", (entity_id,)).fetchall()


def action_for_request(conn: sqlite3.Connection, user_id: str, client_request_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (user_id, client_request_id)).fetchone()


def action_id_for_request(conn: sqlite3.Connection, key: tuple[str, str]) -> sqlite3.Row | None:
    """`key` = (principal_user_id, client_request_id), passed as the statement's arguments as the router passed it."""
    return conn.execute("SELECT id FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", key).fetchone()


def insert_action(conn: sqlite3.Connection, row_args: tuple[Any, ...]) -> None:
    """The pending row (ON CONFLICT DO NOTHING: the failed / answer writes repeat it so they stand alone)."""
    conn.execute(INSERT_ACTION_SQL, row_args)


def fail_not_paired(conn: sqlite3.Connection, responded_at: str, action_id: str) -> None:
    conn.execute("UPDATE ha_actions SET status = 'failed', error = 'bridge_not_paired', responded_at = ? WHERE id = ?", (responded_at, action_id))


def set_action_status(conn: sqlite3.Connection, status: str | None, error: str | None, responded_at: str, action_id: str) -> None:
    conn.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ? WHERE id = ?", (status, error, responded_at, action_id))


# ---------------------------------------------------------------- the bridge's user directory

def directory_user_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0]


def upsert_directory_user(conn: sqlite3.Connection, user_id: str, name: Any, username: Any, is_active: int, is_admin: int, group_ids_json: str, synced_at: str) -> None:
    conn.execute(
        "INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username, is_active = excluded.is_active, is_admin = excluded.is_admin, group_ids_json = excluded.group_ids_json, synced_at = excluded.synced_at",
        (user_id, name, username, is_active, is_admin, group_ids_json, synced_at),
    )


def deactivate_directory_users_except(conn: sqlite3.Connection, ids: list[Any]) -> None:
    """Every mirrored HA user the push did not name goes inactive; `ids` is never empty (the caller checks)."""
    conn.execute(f"UPDATE ha_users SET is_active = 0 WHERE id NOT IN ({','.join('?' * len(ids))})", ids)


def installation_admin_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT subject_id FROM bindings WHERE subject_kind = 'user' AND role_id = 'system_admin' AND scope_type = 'installation' AND effect = 'allow' AND revoked_at IS NULL").fetchall()


def mirrored_user_rows(conn: sqlite3.Connection) -> Rows:
    """Users first seen through Ingress / the remote channel; never an Arx-only (`l_...`) identity."""
    return conn.execute("SELECT id, active FROM users WHERE source IN ('ingress', 'remote') AND substr(id, 1, 2) <> 'l_'").fetchall()


def set_user_active(conn: sqlite3.Connection, active: int, user_id: str) -> None:
    conn.execute("UPDATE users SET active = ? WHERE id = ?", (active, user_id))
