"""Resource-level authorization helpers shared by routers."""
from __future__ import annotations

import sqlite3

from ..errors import forbidden
from ..rbac import INSTALLATION, Principal, authorize


def camera_allowed(conn: sqlite3.Connection, principal: Principal, camera_id: str, permission: str) -> bool:
    """A camera is reachable with `permission` when the caller holds it installation-wide or on any floor where the
    camera is currently anchored. An explicit deny on such a floor wins over an inherited allow (T055). Unanchored
    cameras are visible only installation-wide."""
    floors = [
        f["floor_id"]
        for f in conn.execute("SELECT DISTINCT floor_id FROM map_anchors WHERE resource_type = 'camera' AND resource_id = ? AND effective_to IS NULL", (camera_id,)).fetchall()
    ]
    wide = authorize(conn, principal, permission, INSTALLATION).allowed
    if not floors:
        return wide
    decisions = [authorize(conn, principal, permission, ("floor", f)) for f in floors]
    if any(d.reason == "explicit_deny" for d in decisions):
        return False
    return wide or any(d.allowed for d in decisions)


def visible_camera_ids(conn: sqlite3.Connection, principal: Principal, permission: str = "map.read") -> set[str] | None:
    """None = everything; otherwise the set of camera ids the caller may see. An installation-wide holder with an
    explicit deny on some floor gets a set: every camera except those anchored on the denied floors."""
    floors = [f["id"] for f in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()]
    wide = authorize(conn, principal, permission, INSTALLATION).allowed
    decisions = {f: authorize(conn, principal, permission, ("floor", f)) for f in floors}
    if wide and not any(d.reason == "explicit_deny" for d in decisions.values()):
        return None
    readable = {f for f, d in decisions.items() if d.allowed}
    anchored = conn.execute("SELECT resource_id, floor_id FROM map_anchors WHERE resource_type = 'camera' AND effective_to IS NULL").fetchall()
    ids = {a["resource_id"] for a in anchored if a["floor_id"] in readable}
    if wide:
        placed = {a["resource_id"] for a in anchored}
        ids |= {r["id"] for r in conn.execute("SELECT id FROM cameras").fetchall() if r["id"] not in placed}
    return ids


def require_camera(conn: sqlite3.Connection, principal: Principal, camera_id: str, permission: str) -> None:
    """Refuse (403 with an audit row) unless the caller holds `permission` on this camera; an explicit deny on the
    camera's floor is final even for installation-wide holders."""
    if camera_allowed(conn, principal, camera_id, permission):
        return
    from ..audit import audit  # local import: audit depends on db only

    floors = [f["floor_id"] for f in conn.execute("SELECT DISTINCT floor_id FROM map_anchors WHERE resource_type = 'camera' AND resource_id = ? AND effective_to IS NULL", (camera_id,)).fetchall()]
    reasons = {authorize(conn, principal, permission, ("floor", f)).reason for f in floors} | {authorize(conn, principal, permission, INSTALLATION).reason}
    reason = "explicit_deny" if "explicit_deny" in reasons else "user_inactive" if "user_inactive" in reasons else "no_binding"
    audit(conn, actor=principal, action=permission, decision="denied", resource_type="camera", resource_id=camera_id, reason=reason)
    raise forbidden(permission=permission, target_type="camera", target_id=camera_id, reason=reason)
