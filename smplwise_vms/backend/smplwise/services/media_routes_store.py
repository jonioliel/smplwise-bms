"""The SQL of the media (live streams) router (routers/media.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
