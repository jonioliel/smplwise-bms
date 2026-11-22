"""The SQL of the camera suggestion router (routers/camera_suggest.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any


def zone(conn: sqlite3.Connection, zone_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, floor_id FROM spatial_zones WHERE id = ?", (zone_id,)).fetchone()


def live_camera_anchor(conn: sqlite3.Connection, anchor_id: Any) -> sqlite3.Row | None:
    """The live camera pin with this id (any floor), else None."""
    return conn.execute("SELECT id FROM map_anchors WHERE id = ? AND effective_to IS NULL AND resource_type = 'camera'", (anchor_id,)).fetchone()


def live_camera_anchor_on_floor(conn: sqlite3.Connection, anchor_id: str, floor_id: str) -> sqlite3.Row | None:
    """The live camera pin with this id on this floor, else None."""
    return conn.execute("SELECT id FROM map_anchors WHERE id = ? AND floor_id = ? AND effective_to IS NULL AND resource_type = 'camera'", (anchor_id, floor_id)).fetchone()


def delete_setting(conn: sqlite3.Connection, key: str) -> None:
    conn.execute("DELETE FROM settings WHERE key = ?", (key,))
