"""Room ↔ area links (K88): the settings table with name suggestions, the bulk apply, and the area list the plan editor's
room panel offers. Permissions: reading the table or the area list needs placement.edit on the floor asked for (or on the
installation when no floor is named); applying links needs placement.edit on every touched room's floor. Nothing here
writes to the platform's registry."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import conflict, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import plan_area_links as links

router = APIRouter()


class LinkIn(BaseModel):
    zone_id: str = Field(min_length=1, max_length=32)
    area_id: str | None = Field(default=None, max_length=120)  # None / "" = unlink
    revision: int | None = Field(default=None, ge=1)  # optional optimistic lock (the editor sends it, the table does not)


class LinksIn(BaseModel):
    links: list[LinkIn] = Field(min_length=1, max_length=400)


def _scope(floor_id: str | None) -> tuple[str, str]:
    return ("floor", floor_id) if floor_id else INSTALLATION


@router.get("/plan/areas")
def list_areas(floor_id: str | None = None, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every area of the device tree (id, name, its floor there) - the choices of the room panel's "אזור" field."""
    require(conn, principal, "placement.edit", _scope(floor_id))
    return {"areas": links.areas(conn)}


@router.get("/plan/area-links")
def area_links_table(floor_id: str | None = None, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The link table: one row per plan room with its link, or the best name match as a suggestion."""
    require(conn, principal, "placement.edit", _scope(floor_id))
    return links.table(conn, [floor_id] if floor_id else None)


@router.post("/plan/area-links")
def apply_area_links(body: LinksIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set or clear the link of several rooms in one call (the table's "אשר הצעות" and the editor's field). Every room's
    floor needs placement.edit; a stale `revision` refuses the whole call (409) before anything is written."""
    seen: set[str] = set()
    plan: list[tuple[sqlite3.Row, str | None]] = []
    for item in body.links:
        if item.zone_id in seen:
            continue
        seen.add(item.zone_id)
        z = conn.execute("SELECT id, floor_id, revision, ha_area_id FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (item.zone_id,)).fetchone()
        if not z:
            raise not_found("האזור לא נמצא.")
        require(conn, principal, "placement.edit", ("floor", z["floor_id"]))
        if item.revision is not None and item.revision != z["revision"]:
            raise conflict("stale_revision", "החדר השתנה בינתיים; טען מחדש לפני שמירה.", zone_id=z["id"], current_revision=z["revision"])
        plan.append((z, links.check_area(conn, item.area_id)))
    changed = 0
    now = now_iso()
    details: list[dict[str, Any]] = []
    for z, area_id in plan:
        if (z["ha_area_id"] or None) == area_id:
            continue
        conn.execute("UPDATE spatial_zones SET ha_area_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?", (area_id, now, z["id"]))
        changed += 1
        details.append({"zone_id": z["id"], "floor_id": z["floor_id"], "area_id": area_id})
    if changed:
        audit(conn, actor=principal, action="zone.area_links", decision="allowed", resource_type="installation", resource_id="*",
              request_id=getattr(request.state, "correlation_id", None), details={"changed": changed, "links": details[:50]})
    return {"changed": changed, **links.table(conn)}
