"""The SQL of the plan area links router (routers/plan_area_links.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_zone(conn: sqlite3.Connection, zone_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, floor_id, revision, ha_area_id FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zone_id,)).fetchone()


def set_zone_area(conn: sqlite3.Connection, zone_id: str, area_id: str | None, at: str) -> None:
    """Link (or unlink, None) the room to an area; the room's revision goes up by one."""
    conn.execute("UPDATE spatial_zones SET ha_area_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?", (area_id, at, zone_id))
