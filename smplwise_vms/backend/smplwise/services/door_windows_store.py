"""The SQL of the door-windows / door-emergency router (routers/door_windows.py, CR-039; CR-ROUTER-SQL-B-2450, review 05:P2-07): every
statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the permission
checks, the confirmations, the audit, the commits and the engine calls; each function runs on the connection the route hands it.
services/door_windows.py stays the window model and services/door_emergency.py the emergency model."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the screen state

def live_rules(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM door_window_rules WHERE state <> 'retired' ORDER BY name, id").fetchall()


def screen_occurrences(conn: sqlite3.Connection, since: str, horizon: str) -> Rows:
    """The occurrences overlapping [since, horizon] (not cancelled) plus every running / unconfirmed one, by start, at most 500."""
    return conn.execute(
        """SELECT * FROM door_window_occurrences WHERE (end_at >= ? AND start_at <= ? AND state NOT IN ('cancelled'))
           OR state IN ('relock_unconfirmed','ending','active','starting') ORDER BY start_at LIMIT 500""", (since, horizon)).fetchall()


def engine_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM door_window_engine").fetchall()


def recent_triggers(conn: sqlite3.Connection) -> Rows:
    return conn.execute(
        "SELECT at, source, station_id, relay, decision, reason, end_at FROM door_window_trigger_log WHERE station_id IS NOT NULL ORDER BY at DESC LIMIT 60").fetchall()


# ---------------------------------------------------------------- event-rule triggers

def trigger_source(conn: sqlite3.Connection, rule_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT source FROM door_window_triggers WHERE rule_id = ?", (rule_id,)).fetchone()


def set_trigger_token(conn: sqlite3.Connection, rule_id: str, token_sha256: str, token_set_at: str, authorising_actor: str) -> None:
    """A new trigger secret (its SHA-256 only); the rule falls back to simulation."""
    conn.execute("UPDATE door_window_triggers SET token_sha256 = ?, token_set_at = ?, authorising_actor = ?, arm_state = 'simulate' WHERE rule_id = ?",
                 (token_sha256, token_set_at, authorising_actor, rule_id))


# ---------------------------------------------------------------- the guard override (end now)

def cancel_occurrence(conn: sqlite3.Connection, occ_id: str, resolved_by: str, at: str) -> None:
    conn.execute("UPDATE door_window_occurrences SET state = 'cancelled', resolution = 'override', resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
                 (resolved_by, at, at, occ_id))


def exclude_window(conn: sqlite3.Connection, station_id: str, relay: int, token: str, excluded_by: str, excluded_at: str) -> None:
    conn.execute("INSERT OR REPLACE INTO door_window_exclusions(station_id, relay, token, excluded_by, excluded_at) VALUES (?, ?, ?, ?, ?)",
                 (station_id, relay, token, excluded_by, excluded_at))


def end_occurrence_now(conn: sqlite3.Connection, occ_id: str, resolved_by: str, at: str) -> None:
    """A running window ends now: `ending` (watched to its relock), or `elapsed` in the prepared tier."""
    conn.execute("""UPDATE door_window_occurrences SET state = CASE WHEN tier = 'prepared' THEN 'elapsed' ELSE 'ending' END, end_at = ?, last_reason = 'override',
                        resolved_by = ?, updated_at = ? WHERE id = ?""", (at, resolved_by, at, occ_id))


# ---------------------------------------------------------------- the special-days calendar, door flags

def calendar_days(conn: sqlite3.Connection, start: str) -> Rows:
    return conn.execute("SELECT on_date, scope_key, day_type, label FROM door_window_calendar WHERE on_date >= ? ORDER BY on_date", (start,)).fetchall()


def delete_calendar_day(conn: sqlite3.Connection, on_date: str) -> None:
    conn.execute("DELETE FROM door_window_calendar WHERE on_date = ? AND scope_key = '*'", (on_date,))


def upsert_calendar_day(conn: sqlite3.Connection, on_date: str, day_type: str, label: str | None, set_by: str, set_at: str) -> None:
    conn.execute("""INSERT INTO door_window_calendar(on_date, scope_key, day_type, label, set_by, set_at) VALUES (?, '*', ?, ?, ?, ?)
                            ON CONFLICT(on_date, scope_key) DO UPDATE SET day_type = excluded.day_type, label = excluded.label, set_by = excluded.set_by,
                            set_at = excluded.set_at""", (on_date, day_type, label, set_by, set_at))


def upsert_door_flags(conn: sqlite3.Connection, station_id: str, relay: int, exterior: int, set_by: str, set_at: str) -> None:
    conn.execute("""INSERT INTO door_window_door_flags(station_id, relay, exterior, set_by, set_at) VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(station_id, relay) DO UPDATE SET exterior = excluded.exterior, set_by = excluded.set_by, set_at = excluded.set_at""",
                 (station_id, relay, exterior, set_by, set_at))


# ---------------------------------------------------------------- emergency incidents

def recent_incidents(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM door_emergency_incidents ORDER BY requested_at DESC LIMIT 10").fetchall()


def incident_by_request_id(conn: sqlite3.Connection, request_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM door_emergency_incidents WHERE request_id = ?", (request_id,)).fetchone()
