"""The SQL of the calendars router (routers/calendar.py, CALENDARS-2300; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the access checks (services/calendar/
access.py), the validation and the audit; each function runs on the connection the route hands it. The calendar model itself stays in the
services/calendar/ package."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


def calendar(conn: sqlite3.Connection, cid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (cid,)).fetchone()


def live_rooms(conn: sqlite3.Connection) -> Rows:
    """The room calendars that are not archived, by name key."""
    return conn.execute("SELECT * FROM cal_calendars WHERE type = 'room' AND archived_at IS NULL ORDER BY name_key").fetchall()


def member_count(conn: sqlite3.Connection, cid: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM cal_members WHERE calendar_id = ?", (cid,)).fetchone()[0]


def approvals(conn: sqlite3.Connection, eid: str) -> Rows:
    return conn.execute("SELECT * FROM cal_approvals WHERE event_id = ? ORDER BY rowid", (eid,)).fetchall()


def event_placement(conn: sqlite3.Connection, eid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT calendar_id, starts_at, ends_at, state FROM cal_events WHERE id = ?", (eid,)).fetchone()


def pending_organized(conn: sqlite3.Connection, user_id: str) -> Rows:
    """The pending series / single events (no overrides) this user organises, by start."""
    return conn.execute("SELECT * FROM cal_events WHERE organizer_user_id = ? AND state = 'pending' AND override_of IS NULL ORDER BY starts_at", (user_id,)).fetchall()
