"""Resource-level authorization helpers shared by routers."""
from __future__ import annotations

import sqlite3

from ..rbac import INSTALLATION, Principal, authorize


def camera_allowed(conn: sqlite3.Connection, principal: Principal, camera_id: str, permission: str) -> bool:
    """A camera is reachable with `permission` when the caller holds it installation-wide or on any floor
    where the camera is currently anchored. Unanchored cameras are visible only installation-wide."""
    if authorize(conn, principal, permission, INSTALLATION).allowed:
        return True
    floors = conn.execute(
        "SELECT DISTINCT floor_id FROM map_anchors WHERE resource_type = 'camera' AND resource_id = ? AND effective_to IS NULL",
        (camera_id,),
    ).fetchall()
    return any(authorize(conn, principal, permission, ("floor", f["floor_id"])).allowed for f in floors)


def visible_camera_ids(conn: sqlite3.Connection, principal: Principal, permission: str = "map.read") -> set[str] | None:
    """None = everything; otherwise the set of camera ids the caller may see."""
    if authorize(conn, principal, permission, INSTALLATION).allowed:
        return None
    readable = {
        f["id"] for f in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()
        if authorize(conn, principal, permission, ("floor", f["id"])).allowed
    }
    return {
        a["resource_id"]
        for a in conn.execute("SELECT resource_id, floor_id FROM map_anchors WHERE resource_type = 'camera' AND effective_to IS NULL").fetchall()
        if a["floor_id"] in readable
    }
