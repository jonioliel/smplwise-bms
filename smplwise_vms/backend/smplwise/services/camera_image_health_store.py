"""The SQL of the camera image health router (routers/camera_image_health.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def camera_row(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    """A row when the camera exists, else None."""
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone()
