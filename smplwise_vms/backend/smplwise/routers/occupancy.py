"""ZONECOUNT107-295 (docs/changes/CR-ZONECOUNT107.md): people COUNT per area from Frigate review items - the HTTP surface.

Reads (`/occupancy/areas`, `/occupancy/areas/{id}`) need `occupancy.view` judged on EVERY camera that feeds the area (a camera not yet imported
is judged at the installation); an area the caller may not see is not listed and answers 404. The mapping and the switches
(`/occupancy/settings`, `/occupancy/mappings`) need `system.configure`. OFF by default: while `occupancy.enabled` is off the reads answer 409
`occupancy_disabled`. Counts only - no names, faces, snapshots or Frigate ids leave these routes. Nothing here talks to Frigate."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import zone_counts as zc

router = APIRouter()

VIEW, CONFIGURE = "occupancy.view", "system.configure"
UTC = dt.timezone.utc


def now_utc() -> dt.datetime:
    """The clock of these routes (tests replace it)."""
    return dt.datetime.now(UTC)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SettingsIn(_Body):
    enabled: bool | None = None
    retention_days: int | None = Field(None, ge=zc.RETENTION_MIN, le=zc.RETENTION_MAX)


class MappingIn(_Body):
    recorder_id: str = Field(min_length=1, max_length=64)
    camera_key: str = Field(min_length=1, max_length=64)
    frigate_zone: str = Field("", max_length=64)
    area_id: str = Field(min_length=1, max_length=80)


# ================================================================ configuration (system.configure)

@router.get("/occupancy/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return {**zc.settings_view(conn), "mappings": len(zc.mappings(conn))}


@router.put("/occupancy/settings")
def put_settings(request: Request, body: SettingsIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Switch the feature on / off and set the retention. Switching OFF deletes every stored sample."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    out = zc.apply_settings(conn, enabled_=body.enabled, retention=body.retention_days)
    audit(conn, actor=principal, action="occupancy.settings", decision="allowed", resource_type="occupancy", resource_id="settings", request_id=_rid(request),
          details={"enabled": out["enabled"], "retention_days": out["retention_days"]})
    return out


@router.get("/occupancy/mappings")
def list_mappings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return {"items": zc.mappings(conn)}


@router.post("/occupancy/mappings", status_code=201)
def add_mapping(request: Request, body: MappingIn, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    out = zc.add_mapping(conn, recorder_id=body.recorder_id, camera_key=body.camera_key, frigate_zone=body.frigate_zone, area_id=body.area_id, actor=principal.user_id)
    audit(conn, actor=principal, action="occupancy.mapping.add", decision="allowed", resource_type="occupancy_mapping", resource_id=out["id"], request_id=_rid(request),
          details={"area_id": body.area_id})
    return out


@router.delete("/occupancy/mappings/{mapping_id}")
def delete_mapping(request: Request, mapping_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    row = zc.delete_mapping(conn, mapping_id)
    audit(conn, actor=principal, action="occupancy.mapping.delete", decision="allowed", resource_type="occupancy_mapping", resource_id=mapping_id, request_id=_rid(request),
          details={"area_id": row["area_id"]})
    return {"deleted": True}


# ================================================================ reads (occupancy.view per camera)

def _visible_areas(conn: sqlite3.Connection, principal: Principal) -> dict[str, str | None]:
    """area id -> its name, for the areas whose every feeding camera the caller may see."""
    cams: dict[str, list[str | None]] = {}
    for r in conn.execute("SELECT m.area_id, c.id AS camera_id FROM zone_count_map m LEFT JOIN cameras c ON c.recorder_id = m.recorder_id AND c.source_ref = m.camera_key").fetchall():
        cams.setdefault(r["area_id"], []).append(r["camera_id"])
    names = {r["area_id"]: r["name"] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}
    out: dict[str, str | None] = {}
    for area, ids in cams.items():
        ok = all(authorize(conn, principal, VIEW, ("camera", cid) if cid else INSTALLATION).allowed for cid in ids)
        if ok:
            out[area] = names.get(area)
    return out


def _guard(conn: sqlite3.Connection) -> None:
    if not zc.enabled(conn):
        raise ApiError(409, "occupancy_disabled", "ספירת האנשים כבויה.")


@router.get("/occupancy/areas")
def list_areas(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """People now in each area the caller may see (`count` is null = unknown: the Frigate event path is not fresh)."""
    _guard(conn)
    now = now_utc()
    visible = _visible_areas(conn, principal)
    counts = zc.current_counts(conn, now)
    items = [{"area_id": a, "name": n, "count": counts.get(a), "known": counts.get(a) is not None} for a, n in sorted(visible.items(), key=lambda kv: (kv[1] or "", kv[0]))]
    return {"as_of": zc._iso(now), "items": items}


@router.get("/occupancy/areas/{area_id}")
def get_area(request: Request, area_id: str = Path(min_length=1, max_length=80), hours: int = Query(24, ge=1, le=zc.MAX_HOURS),
             principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """One area: the count now and the stored series of the last `hours` (capped by the retention)."""
    _guard(conn)
    now = now_utc()
    visible = _visible_areas(conn, principal)
    if area_id not in visible:
        raise ApiError(404, "area_not_found", "האזור לא נמצא.")
    count = zc.current_counts(conn, now).get(area_id)
    return {"area_id": area_id, "name": visible[area_id], "as_of": zc._iso(now), "count": count, "known": count is not None, "series": zc.series(conn, area_id, hours, now)}
