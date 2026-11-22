"""The SQL of the floor images router (routers/floor_images.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def floor_image_row(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    """A row when the floor has an image, else None."""
    return conn.execute("SELECT 1 FROM floor_images WHERE floor_id = ?", (floor_id,)).fetchone()
