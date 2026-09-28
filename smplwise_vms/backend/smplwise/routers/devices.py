"""Electricity and device control API (CR-007): the floors → areas tree with live counts, the building-wide counts
and one area's per-domain cards, projected from the synced Home Assistant catalogue.

Permission `devices.read`. Scope follows /ha/entities exactly: installation-wide holders see every entity; a holder
bound to floors sees only entities placed (anchored or wired to a circuit) on those floors, and so only the HA areas
and floors that contain such an entity. Nothing here writes, calls Home Assistant or returns hosts / tokens.

Slice 2 adds `can_control` to each area card row (`devices.control` or `ha.entity.control`, same floor scope as
`devices.read` - services/ha_scope.control_checker); the action itself still runs through the existing
`POST /ha/entities/{entity_id}/actions` (routers/ha.py), which this module never calls."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends

from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import Principal
from ..services import devices as svc
from ..services import ha_scope, ha_sync

router = APIRouter()
READ = "devices.read"


def _visible_entities(conn: sqlite3.Connection, principal: Principal) -> tuple[list[dict[str, Any]], bool]:
    """The caller's entity set and whether it is a floor-scoped (narrowed) view. 403 without any grant."""
    return ha_scope.scoped_rows(conn, principal, READ, svc.load_entities(conn))


@router.get("/devices/tree")
def tree(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    entities, scoped = _visible_entities(conn, principal)
    body = svc.build_tree(conn, entities, scoped=scoped)
    body["sync"] = ha_sync.STATE.as_dict()
    return body


@router.get("/devices/building")
def building(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    entities, scoped = _visible_entities(conn, principal)
    t = svc.build_tree(conn, entities, scoped=scoped)
    return {
        "counts": t["building"],
        "floors": len([f for f in t["floors"] if f["floor_id"] != svc.NO_FLOOR]),
        "areas": sum(len(f["areas"]) for f in t["floors"]),
        "unassigned": t["unassigned"]["counts"]["entities"],
        "scoped": scoped,
        "sync": ha_sync.STATE.as_dict(),
    }


@router.get("/devices/areas/{area_id}")
def area(area_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`area_id` is an HA area id, or `unassigned` for the entities that belong to no area."""
    entities, scoped = _visible_entities(conn, principal)
    control_of = ha_scope.control_checker(conn, principal)
    body = svc.build_area(conn, entities, area_id, scoped=scoped, control_of=control_of)
    if body is None:
        raise ApiError(404, "not_found", "האזור לא נמצא.")
    body["sync"] = ha_sync.STATE.as_dict()
    return body
