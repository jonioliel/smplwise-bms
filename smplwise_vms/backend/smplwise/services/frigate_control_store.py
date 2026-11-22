"""The SQL of the Frigate control router (routers/frigate_control.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def recorder_camera(conn: sqlite3.Connection, camera_id: str, recorder_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cameras WHERE id = ? AND recorder_id = ?", (camera_id, recorder_id)).fetchone()
