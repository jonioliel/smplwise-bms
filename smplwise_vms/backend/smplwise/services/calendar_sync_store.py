"""The SQL of the calendar connections router (routers/calendar_sync.py, CALENDARS-SYNC; CR-ROUTER-SQL-2450, review 05:P2-07): every
statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the checks,
the provider calls (always with no transaction open), the sealing and the audit; each function runs on the connection the route
hands it, including the router's own write-aside / read connections."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- connections

def connection(conn: sqlite3.Connection, cid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_connections WHERE id = ?", (cid,)).fetchone()


def connections(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM cal_connections ORDER BY created_at, id").fetchall()


def connection_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM cal_connections").fetchone()[0]


def insert_connection(conn: sqlite3.Connection, cid: str, provider: str, label: str, owner_user_id: str | None, scope: str, token_ref: str | None, created_at: str) -> None:
    conn.execute("INSERT INTO cal_connections(id, provider, label, owner_user_id, scope, state, token_ref, created_at) VALUES (?,?,?,?,?, 'ok', ?, ?)",
                 (cid, provider, label, owner_user_id, scope, token_ref, created_at))


def bump_connection(conn: sqlite3.Connection, cid: str) -> None:
    conn.execute("UPDATE cal_connections SET revision = revision + 1 WHERE id = ?", (cid,))


def set_feed_host(conn: sqlite3.Connection, cid: str, host: str | None) -> None:
    """A new iCal address: the account hint, an error state back to ok, due now."""
    conn.execute("UPDATE cal_connections SET account_hint = ?, state = CASE WHEN state = 'error' THEN 'ok' ELSE state END, error_code = NULL, next_sync_at = NULL, "
                 "revision = revision + 1 WHERE id = ?", (host, cid))


def mark_authorized(conn: sqlite3.Connection, cid: str) -> None:
    conn.execute("UPDATE cal_connections SET state = 'ok', error_code = NULL, error_text = NULL, next_sync_at = NULL, revision = revision + 1 WHERE id = ?", (cid,))


def set_connection_state(conn: sqlite3.Connection, cid: str, state: str, next_sync_at: str | None) -> None:
    conn.execute("UPDATE cal_connections SET state = ?, next_sync_at = ?, error_code = NULL, error_text = NULL, revision = revision + 1 WHERE id = ?", (state, next_sync_at, cid))


def due_now(conn: sqlite3.Connection, cid: str) -> None:
    """The connection is due on the next scheduler tick (unless paused or waiting for a new authorisation)."""
    conn.execute("UPDATE cal_connections SET next_sync_at = NULL WHERE id = ? AND state IN ('ok','error')", (cid,))


def remove_connection(conn: sqlite3.Connection, cid: str, lease_key: str, clear_credentials: Callable[[sqlite3.Connection, str], Any]) -> int:
    """The local delete of a connection: its bindings and their map rows, the calendars' links to them, its lease and manual-sync
    settings, its credentials (`clear_credentials(conn, cid)`, in the same place of the order as before) and the row. Returns how many
    bindings it had."""
    ids = [b["id"] for b in conn.execute("SELECT id FROM cal_sync_bindings WHERE connection_id = ?", (cid,)).fetchall()]
    for bid in ids:
        conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (bid,))
    conn.execute("UPDATE cal_calendars SET sync_binding_id = NULL WHERE sync_binding_id IN (SELECT id FROM cal_sync_bindings WHERE connection_id = ?)", (cid,))
    conn.execute("DELETE FROM cal_sync_bindings WHERE connection_id = ?", (cid,))
    conn.execute("DELETE FROM settings WHERE key IN (?, ?)", (lease_key, f"calendar.sync.manual.{cid}"))
    clear_credentials(conn, cid)
    conn.execute("DELETE FROM cal_connections WHERE id = ?", (cid,))
    return len(ids)


# ---------------------------------------------------------------- bindings

def connection_bindings(conn: sqlite3.Connection, cid: str) -> Rows:
    return conn.execute("SELECT id, calendar_id, direction, detail, dedicated FROM cal_sync_bindings WHERE connection_id = ? ORDER BY id", (cid,)).fetchall()


def calendar_binding(conn: sqlite3.Connection, calendar_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_sync_bindings WHERE calendar_id = ?", (calendar_id,)).fetchone()


def drop_binding(conn: sqlite3.Connection, binding_id: str) -> None:
    """The binding and its map rows."""
    conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (binding_id,))
    conn.execute("DELETE FROM cal_sync_bindings WHERE id = ?", (binding_id,))


def unlink_calendar(conn: sqlite3.Connection, calendar_id: str) -> None:
    conn.execute("UPDATE cal_calendars SET sync_binding_id = NULL WHERE id = ?", (calendar_id,))


def republish_arx_entries(conn: sqlite3.Connection, binding_id: str) -> None:
    conn.execute("UPDATE cal_sync_map SET last_pushed_revision = NULL WHERE binding_id = ? AND origin = 'arx'", (binding_id,))


def update_binding(conn: sqlite3.Connection, binding_id: str, direction: str, detail: str, dedicated: int) -> None:
    conn.execute("UPDATE cal_sync_bindings SET direction = ?, detail = ?, dedicated = ?, revision = revision + 1 WHERE id = ?", (direction, detail, dedicated, binding_id))


def insert_binding(conn: sqlite3.Connection, binding_id: str, connection_id: str, calendar_id: str, external_sealed: str, direction: str, detail: str, dedicated: int,
                   created_by: str | None) -> None:
    conn.execute("INSERT INTO cal_sync_bindings(id, connection_id, calendar_id, external_calendar_id_sealed, direction, detail, dedicated, created_by) VALUES (?,?,?,?,?,?,?,?)",
                 (binding_id, connection_id, calendar_id, external_sealed, direction, detail, dedicated, created_by))


def link_calendar(conn: sqlite3.Connection, calendar_id: str, binding_id: str, at: str) -> None:
    conn.execute("UPDATE cal_calendars SET sync_binding_id = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (binding_id, at, calendar_id))


# ---------------------------------------------------------------- flagged entries

def flagged_events(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM cal_events WHERE sync_flag IS NOT NULL AND state NOT IN ('cancelled','rejected','withdrawn','expired') ORDER BY starts_at LIMIT 500").fetchall()


def calendar(conn: sqlite3.Connection, calendar_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (calendar_id,)).fetchone()


def event(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_events WHERE id = ?", (event_id,)).fetchone()
