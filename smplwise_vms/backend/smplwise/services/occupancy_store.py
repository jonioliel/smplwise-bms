"""The SQL of the occupancy router (routers/occupancy.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def area_camera_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Each zone-count area with the camera feeding it (None when the camera is not known)."""
    return conn.execute("SELECT m.area_id, c.id AS camera_id FROM zone_count_map m LEFT JOIN cameras c ON c.recorder_id = m.recorder_id AND c.source_ref = m.camera_key").fetchall()


def area_name_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT area_id, name FROM ha_areas").fetchall()
