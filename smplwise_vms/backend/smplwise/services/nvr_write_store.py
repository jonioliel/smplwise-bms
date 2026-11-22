"""The SQL of the NVR write router (routers/nvr_write.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def enabled_channel_rows(conn: sqlite3.Connection, recorder_id: str) -> list[sqlite3.Row]:
    """The recorder's enabled cameras with a channel, by channel."""
    return conn.execute("SELECT id, channel, alias, name_source FROM cameras WHERE recorder_id = ? AND enabled = 1 AND channel IS NOT NULL ORDER BY channel",
                        (recorder_id,)).fetchall()


def camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()


def channel_row(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, recorder_id, channel, alias, name_source FROM cameras WHERE id = ?", (camera_id,)).fetchone()


def track_row(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, recorder_id, channel, alias, name_source, main_track FROM cameras WHERE id = ?", (camera_id,)).fetchone()
