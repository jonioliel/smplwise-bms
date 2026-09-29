"""Camera scope (T055): the ONE rule for which cameras a caller reaches with a permission, shared by every router that
serves something camera-bearing - the camera list, snapshots, live and playback, recordings and frames, events (list,
facets, summary, timeline, windows, thumbnails, the push socket), cases and their items, exports, rules, search,
saved views, NVR camera settings and the floor map's camera anchors. No router filters cameras on its own.

A camera's scope chain is the camera itself, every floor it is anchored on (with their buildings and sites) and the
installation (rbac.scope_chain). The caller holds `permission` on the camera when an allow binding lies anywhere on that
chain and no deny binding does - deny-overrides, exactly like every other target (HA_IDENTITY_RBAC_HE.md §15). An
unanchored camera is reached only through the installation or a binding on the camera itself."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Any, Iterable

from ..rbac import INSTALLATION, Decision, Principal, _active_bindings, authorize, require, role_permissions


@dataclass(frozen=True)
class CameraScope:
    """The cameras one caller reaches with one permission, computed once per request (never cached across requests:
    a binding change is seen by the very next call). `everything` = installation-wide with no deny touching any
    camera - every camera, including ones registered later in the same request."""

    permission: str
    everything: bool
    ids: frozenset[str] = field(default_factory=frozenset)
    denied: frozenset[str] = field(default_factory=frozenset)  # cameras an explicit deny on their chain takes away

    def allows(self, camera_id: str | None) -> bool:
        return bool(camera_id) and (self.everything or camera_id in self.ids)

    def any(self) -> bool:
        return self.everything or bool(self.ids)

    def filter(self, rows: Iterable[Any], key: str = "camera_id") -> list[Any]:
        """Rows (dicts or sqlite rows) whose `key` names a camera in scope; camera-less rows only for `everything`."""
        out = []
        for r in rows:
            cid = r[key] if not isinstance(r, dict) else r.get(key)
            if self.everything or (cid and cid in self.ids):
                out.append(r)
        return out


def _chains(conn: sqlite3.Connection) -> dict[str, set[tuple[str, str]]]:
    """Every registered camera's scope chain in three queries (the batched form of rbac.scope_chain('camera', …))."""
    buildings = {r["id"]: r["site_id"] for r in conn.execute("SELECT id, site_id FROM buildings").fetchall()}
    floors = {r["id"]: r["building_id"] for r in conn.execute("SELECT id, building_id FROM floors WHERE deleted_at IS NULL").fetchall()}
    chains: dict[str, set[tuple[str, str]]] = {r["id"]: {("camera", r["id"]), INSTALLATION} for r in conn.execute("SELECT id FROM cameras").fetchall()}
    for a in conn.execute("SELECT resource_id, floor_id FROM map_anchors WHERE resource_type = 'camera' AND effective_to IS NULL").fetchall():
        chain = chains.get(a["resource_id"])
        if chain is None or a["floor_id"] not in floors:
            continue
        chain.add(("floor", a["floor_id"]))
        bid = floors[a["floor_id"]]
        chain.add(("building", bid))
        if bid in buildings:
            chain.add(("site", buildings[bid]))
    return chains


def camera_scope(conn: sqlite3.Connection, principal: Principal, permission: str) -> CameraScope:
    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if user is not None and not user["active"]:
        return CameraScope(permission, False)
    bindings = [b for b in _active_bindings(conn, principal) if permission in role_permissions(conn, b["role_id"])]
    allow = {(b["scope_type"], b["scope_id"]) for b in bindings if b["effect"] != "deny"}
    deny = {(b["scope_type"], b["scope_id"]) for b in bindings if b["effect"] == "deny"}
    if not deny and not allow:
        return CameraScope(permission, False)
    if INSTALLATION in allow and not deny:
        return CameraScope(permission, True)
    chains = _chains(conn)
    denied = frozenset(cid for cid, chain in chains.items() if chain & deny)
    ids = frozenset(cid for cid, chain in chains.items() if chain & allow and cid not in denied)
    return CameraScope(permission, False, ids, denied)


@dataclass(frozen=True)
class RowScope:
    """Rows that may or may not name a camera (events, rule alerts): a camera row follows the camera scope, a
    camera-less row the installation-wide grant (an installation deny takes it away; a camera deny does not - security
    review T055 M3)."""

    cameras: CameraScope
    camera_less: bool

    @property
    def everything(self) -> bool:
        return self.cameras.everything and self.camera_less

    def allows_row(self, camera_id: str | None) -> bool:
        return self.cameras.allows(camera_id) if camera_id else self.camera_less

    def any(self) -> bool:
        return self.camera_less or self.cameras.any()


def row_scope(conn: sqlite3.Connection, principal: Principal, permission: str) -> RowScope:
    return RowScope(camera_scope(conn, principal, permission), authorize(conn, principal, permission, INSTALLATION).allowed)


def camera_reach_for_placement(conn: sqlite3.Connection, principal: Principal) -> CameraScope:
    """The cameras an editor may place, move or remove on a map (security review T055 B1): placing a camera on a floor
    widens who reaches it (every reader of that floor, and its camera-scoped users get that floor's drawing), so the
    actor must already reach the camera on its CURRENT chain (map.read) - or hold placement.edit installation-wide,
    minus the cameras explicitly denied to them."""
    reads = camera_scope(conn, principal, "map.read")
    if authorize(conn, principal, "placement.edit", INSTALLATION).allowed:
        every = frozenset(r[0] for r in conn.execute("SELECT id FROM cameras").fetchall())
        return CameraScope("placement.edit", False, every - reads.denied, reads.denied)
    return reads


def require_camera_placement(conn: sqlite3.Connection, principal: Principal, camera_id: str) -> None:
    if not camera_reach_for_placement(conn, principal).allows(camera_id):
        require(conn, principal, "map.read", ("camera", camera_id))  # the audited 403 (an explicit deny names itself)
        require(conn, principal, "placement.edit", INSTALLATION)


def visible_camera_ids(conn: sqlite3.Connection, principal: Principal, permission: str = "map.read") -> set[str] | None:
    """None = every camera; otherwise the set of camera ids the caller reaches with `permission` (camera_scope)."""
    scope = camera_scope(conn, principal, permission)
    return None if scope.everything else set(scope.ids)


def camera_decision(conn: sqlite3.Connection, principal: Principal, camera_id: str, permission: str) -> Decision:
    return authorize(conn, principal, permission, ("camera", camera_id))


def camera_allowed(conn: sqlite3.Connection, principal: Principal, camera_id: str, permission: str) -> bool:
    return camera_decision(conn, principal, camera_id, permission).allowed


def require_camera(conn: sqlite3.Connection, principal: Principal, camera_id: str, permission: str) -> Decision:
    """Refuse (403 with an audit row naming the camera and the reason) unless the caller holds `permission` on this
    camera; returns the allowing decision, whose binding / role / scope the caller's own audit row records."""
    return require(conn, principal, permission, ("camera", camera_id))


def floor_cameras(conn: sqlite3.Connection, floor_id: str) -> set[str]:
    return {r[0] for r in conn.execute("SELECT DISTINCT resource_id FROM map_anchors WHERE floor_id = ? AND resource_type = 'camera' AND effective_to IS NULL", (floor_id,)).fetchall()}


def floor_reach(conn: sqlite3.Connection, principal: Principal, floor_id: str, permission: str = "map.read") -> str | None:
    """How the caller reaches a floor's map: "floor" (a binding on the floor or above), "cameras" (only through
    camera-scoped bindings for cameras anchored there - the drawing and those cameras, nothing else of the floor)
    or None."""
    if authorize(conn, principal, permission, ("floor", floor_id)).allowed:
        return "floor"
    scope = camera_scope(conn, principal, permission)
    if scope.ids and scope.ids & floor_cameras(conn, floor_id):
        return "cameras"
    return None


def require_floor_read(conn: sqlite3.Connection, principal: Principal, floor_id: str, permission: str = "map.read") -> str:
    reach = floor_reach(conn, principal, floor_id, permission)
    if reach is None:
        require(conn, principal, permission, ("floor", floor_id))  # the audited 403
    return reach or "floor"
