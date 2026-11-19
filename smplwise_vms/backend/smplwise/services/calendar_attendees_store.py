"""The SQL of the calendar attendees router (routers/calendar_attendees.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def event(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_events WHERE id = ?", (event_id,)).fetchone()


def family_rows(conn: sqlite3.Connection, root: str) -> list[sqlite3.Row]:
    """The entry and its overrides (time, recurrence, state), by id."""
    return conn.execute("SELECT id, starts_at, ends_at, all_day, tz, rrule, exdates_json, state FROM cal_events WHERE id = ? OR override_of = ? ORDER BY id", (root, root)).fetchall()


def family_room_rows(conn: sqlite3.Connection, root: str) -> list[sqlite3.Row]:
    """The rooms of the entry and of its overrides."""
    return conn.execute("SELECT event_id, room_calendar_id, state FROM cal_event_rooms WHERE event_id IN (SELECT id FROM cal_events WHERE id = ? OR override_of = ?) ORDER BY event_id, room_calendar_id",
                        (root, root)).fetchall()


def event_override_of(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, override_of FROM cal_events WHERE id = ?", (event_id,)).fetchone()
