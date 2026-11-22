"""The SQL of the alarm router (routers/alarm.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router ran inline, moved
here unchanged (same text, same arguments, same order of calls). The router keeps the code gate, the bridge call (outside the write
lock, as before), the pass-through bookkeeping and the audit; each function runs on the connection the route hands it. No code or
PIN ever passes through this module. services/alarm.py stays the alarm model."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- ha_actions (the command log)

def action(conn: sqlite3.Connection, action_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_actions WHERE id = ?", (action_id,)).fetchone()


def action_by_request(conn: sqlite3.Connection, user_id: str | None, client_request_id: str) -> sqlite3.Row | None:
    """The caller's earlier action with the same client request id (a repeated click)."""
    return conn.execute("SELECT id FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (user_id, client_request_id)).fetchone()


def insert_bridge_action(conn: sqlite3.Connection, action_id: str, entity_id: str, ha_action_id: str, arguments_json: str, user_id: str | None, username: str | None,
                         client_request_id: str | None, requested_at: str, expected_state: str | None) -> None:
    """A pending command sent through the bridge."""
    conn.execute(
        "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (action_id, entity_id, ha_action_id, arguments_json, user_id, username, client_request_id, "pending", requested_at, expected_state, "bridge"),
    )


def fail_unpaired(conn: sqlite3.Connection, action_id: str, at: str) -> None:
    conn.execute("UPDATE ha_actions SET status = 'failed', error = 'bridge_not_paired', responded_at = ? WHERE id = ?", (at, action_id))


def fail_action(conn: sqlite3.Connection, action_id: str, error: str, at: str) -> None:
    conn.execute("UPDATE ha_actions SET status = 'failed', error = ?, responded_at = ? WHERE id = ?", (error, at, action_id))


def answer_action(conn: sqlite3.Connection, action_id: str, status: str, error: str | None, at: str) -> None:
    conn.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ? WHERE id = ?", (status, error, at, action_id))


# ---------------------------------------------------------------- the entity mirror

def entity_state(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def entity_attributes(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()


def live_entity_domain(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def live_entity(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


def live_entity_domain_attributes(conn: sqlite3.Connection, entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT domain, attributes_json FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()


# ---------------------------------------------------------------- alarm_zone_overrides

def put_override(conn: sqlite3.Connection, zone_entity_id: str, panel_entity_id: str | None, bypass_entity_id: str | None, excluded: int, at: str, by: str | None) -> None:
    conn.execute(
        "INSERT INTO alarm_zone_overrides(zone_entity_id, panel_entity_id, bypass_entity_id, excluded, updated_at, updated_by) VALUES (?,?,?,?,?,?) "
        "ON CONFLICT(zone_entity_id) DO UPDATE SET panel_entity_id = excluded.panel_entity_id, bypass_entity_id = excluded.bypass_entity_id, excluded = excluded.excluded, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
        (zone_entity_id, panel_entity_id, bypass_entity_id, excluded, at, by),
    )


def override(conn: sqlite3.Connection, zone_entity_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM alarm_zone_overrides WHERE zone_entity_id = ?", (zone_entity_id,)).fetchone()


def paired_as_bypass(conn: sqlite3.Connection, entity_id: str) -> bool:
    return conn.execute("SELECT 1 FROM alarm_zone_overrides WHERE bypass_entity_id = ?", (entity_id,)).fetchone() is not None


def mark_not_alarm(conn: sqlite3.Connection, entity_id: str, at: str, by: str | None) -> None:
    conn.execute(
        "INSERT INTO alarm_zone_overrides(zone_entity_id, panel_entity_id, bypass_entity_id, excluded, updated_at, updated_by) VALUES (?, NULL, NULL, 1, ?, ?) "
        "ON CONFLICT(zone_entity_id) DO UPDATE SET excluded = 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
        (entity_id, at, by),
    )


def delete_override(conn: sqlite3.Connection, zone_entity_id: str) -> int:
    return conn.execute("DELETE FROM alarm_zone_overrides WHERE zone_entity_id = ?", (zone_entity_id,)).rowcount


# ---------------------------------------------------------------- users

def other_active_users(conn: sqlite3.Connection, user_id: str | None) -> Rows:
    return conn.execute("SELECT id, username FROM users WHERE active = 1 AND id != ?", (user_id,)).fetchall()


def user_exists(conn: sqlite3.Connection, user_id: str) -> bool:
    return conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is not None
