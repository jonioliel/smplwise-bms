"""Plan Studio 8 (T090, CR-037): BIM / IFC.

- GET  /plan-versions/{id}/export.ifc?draft=&level=   the structure as IFC4 (services/plan_ifc.py): read like the SVG /
                                                        DXF exports (published with map.read, drafts with map.edit), only
                                                        the anchors the caller may see; a plan without a calibration is
                                                        refused (422 plan_uncalibrated); audited geometry.ifc.export.
- POST /plan-versions/{id}/import-ifc?level_id=&storey= multipart `file`: candidates (walls, openings, objects; rooms
                                                        for the zones accept) in the shape of /detect plus the import
                                                        report (`ifc`); nothing is stored - the editor accepts through
                                                        /detect/accept. map.import on the floor; the read runs in the
                                                        detection pool under detect_timeout_s; audited geometry.ifc.import."""
from __future__ import annotations

import concurrent.futures
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import Response

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import new_id, unlocked
from ..errors import ApiError, conflict
from ..rbac import Principal, require
from ..services import geometry_store as store
from ..services import plan_catalog, plan_ifc, plan_ifc_read, wall_path
from ..services import plan_geometry as pg
from ..services import plan_package as pkg_svc
from .catalog import get_floor
from .plan_geometry import NO_CACHE, _export_doc, _export_zones, _floor, _rid
from .plans import get_version

router = APIRouter()

UNCALIBRATED_HE = "התוכנית לא מכוילת; כייל אותה (שתי נקודות) לפני ייצוא או ייבוא של IFC."
IFC_MESSAGES = {
    "ifc_not_step": "הקובץ אינו קובץ IFC תקין (טקסט ISO 10303-21).",
    "ifc_compressed": "קובץ IFC דחוס (ifczip) אינו נתמך; פתח אותו ושלח את קובץ ה־IFC עצמו.",
    "ifc_too_complex": "קובץ ה־IFC מורכב או גדול מדי לעיבוד.",
    "ifc_too_large": "קובץ ה־IFC גדול מדי.",
    "ifc_schema": "סכמת ה־IFC של הקובץ אינה נתמכת (נתמכות IFC4 ו־IFC2X3).",
    "ifc_storey": "הקומה שנבחרה לא קיימת בקובץ.",
}


def _calibrated(v: sqlite3.Row) -> tuple[float, str]:
    cal = pg.calibration_of(v, None)
    scale = v["scale_m_per_px"]
    if not scale or cal.get("status") not in ("measured", "estimated"):
        raise ApiError(422, "plan_uncalibrated", UNCALIBRATED_HE)
    return float(scale), str(cal["status"])


@router.get("/plan-versions/{version_id}/export.ifc", response_model=None)
def export_ifc(version_id: str, request: Request, draft: bool = False, level: str | None = Query(default=None, max_length=64),
               principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """The structure as IFC4: storeys, walls, openings with doors / windows, spaces, objects, connectors, visible anchors."""
    v, doc = _export_doc(conn, principal, version_id, draft)
    _calibrated(v)
    if level is not None and level not in {lv.get("id") for lv in doc.get("levels") or []}:
        raise ApiError(422, "unknown_level", "המפלס לא קיים במבנה.")
    floor = get_floor(conn, v["floor_id"])
    row = store.working_doc(conn, v)[1] if draft else store.published_row(conn, v["id"])
    stamp = (row["updated_at"] if draft else row["published_at"] or row["created_at"]) if row is not None else v["created_at"]
    data, counts = plan_ifc.build(doc, _export_zones(conn, principal, v), int(v["width_px"]), int(v["height_px"]), floor_id=v["floor_id"],
                                  floor_name=(floor["name"] if floor is not None else "") or "", version_id=v["id"], stage="draft" if draft else "published", level=level,
                                  anchors=pkg_svc.anchor_records(conn, v["floor_id"], principal), items=plan_catalog.item_index(conn),
                                  generated_at=str(stamp or "1970-01-01T00:00:00Z"), doc_hash=store.doc_hash(doc))
    audit(conn, actor=principal, action="geometry.ifc.export", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "stage": "draft" if draft else "published", "level": level, "bytes": len(data), **counts})
    return Response(content=data, media_type="application/x-step", headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.ifc"', **NO_CACHE})


def _read_upload(file: UploadFile) -> bytes:
    """The upload, at most MAX_BYTES + 1 (the extra byte tells "too large" from "exactly the limit")."""
    data = file.file.read(plan_ifc_read.MAX_BYTES + 1)
    if len(data) > plan_ifc_read.MAX_BYTES:
        raise ApiError(413, "ifc_too_large", IFC_MESSAGES["ifc_too_large"], details={"limit": plan_ifc_read.MAX_BYTES})
    if not data:
        raise ApiError(422, "ifc_not_step", IFC_MESSAGES["ifc_not_step"])
    return data


@router.post("/plan-versions/{version_id}/import-ifc")
def import_ifc(version_id: str, request: Request, level_id: str | None = Query(default=None, max_length=64), storey: int | None = Query(default=None, ge=0, le=10000),
               file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Candidates from an IFC file for one document level (the storey chosen, or the one nearest that level's
    elevation), in the shape of /detect; nothing is stored. The report under `ifc` lists what was skipped and why."""
    from .plan_geometry import DETECT_POOL

    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.import", _floor(v))
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לעריכה; שחזר אותה קודם.")
    scale, status = _calibrated(v)
    doc, _row = store.working_doc(conn, v)
    if level_id is not None:
        level = next((lv for lv in doc["levels"] if lv.get("id") == level_id), None)
        if level is None:
            raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    else:
        level = next((lv for lv in doc["levels"] if lv.get("is_default")), doc["levels"][0] if doc.get("levels") else None)
    lid = level["id"] if level else pg.DEFAULT_LEVEL_ID
    elevation = float(level.get("elevation_m") or 0.0) if level else 0.0
    ceiling = float(level.get("ceiling_height_m") or pg.DEFAULT_CEILING_M) if level else pg.DEFAULT_CEILING_M
    data = _read_upload(file)
    items = plan_catalog.item_index(conn)
    base = {"version_id": v["id"], "level_id": lid, "bytes": len(data), "storey": storey}
    deadline = time.monotonic() + settings.detect_timeout_s
    future = DETECT_POOL.submit(plan_ifc_read.read, data, width_px=int(v["width_px"]), height_px=int(v["height_px"]), scale_m_per_px=scale, scale_status=status,
                                level_id=lid, level_elevation_m=elevation, run_id=new_id()[:6], catalog=items, storey=storey, deadline=deadline, ceiling_m=ceiling)
    try:
        with unlocked(conn):
            result = future.result(timeout=settings.detect_timeout_s)
    except (concurrent.futures.TimeoutError, plan_ifc_read.IfcTimeout):
        future.cancel()
        audit(conn, actor=principal, action="geometry.ifc.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={**base, "timed_out": True, "timeout_s": settings.detect_timeout_s})
        raise ApiError(504, "ifc_timeout", "קריאת ה־IFC לא הסתיימה בזמן; נסה קובץ קטן יותר.", retryable=True, details={"timeout_s": settings.detect_timeout_s})
    except plan_ifc_read.IfcError as exc:
        audit(conn, actor=principal, action="geometry.ifc.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={**base, "failed": "IfcError", "code": exc.code})
        raise ApiError(413 if exc.code == "ifc_too_large" else 422, exc.code, IFC_MESSAGES.get(exc.code, IFC_MESSAGES["ifc_not_step"]), details=exc.details)
    except (RecursionError, MemoryError, ValueError, TypeError, KeyError, IndexError, ArithmeticError, AttributeError) as exc:  # a reader failure is a refusal, never a 500
        audit(conn, actor=principal, action="geometry.ifc.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={**base, "failed": type(exc).__name__})
        raise ApiError(422, "ifc_unreadable", IFC_MESSAGES["ifc_not_step"], details={"error": type(exc).__name__})
    try:  # security review 2.4.2 M1 (the DXF rule): curved candidates past the editor's limits are refused here
        wall_path.check_walls(result.get("walls"), float(v["width_px"]), float(v["height_px"]))
    except wall_path.CurveLimit as exc:
        raise ApiError(422, exc.code, exc.message, details={"limits": {"corners": wall_path.MAX_CURVED_CORNERS, "segments": wall_path.MAX_CURVED_SEGMENTS,
                                                                        "points": wall_path.MAX_SAMPLED_POINTS}})
    existing = {c: sum(1 for i in doc.get(c) or [] if isinstance(i, dict) and i.get("source") == "imported") for c in ("walls", "openings", "objects")}
    rep = result["ifc"]
    audit(conn, actor=principal, action="geometry.ifc.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={**base, **rep["counts"], "skipped": rep["skipped_total"], "entities": rep["entities"], "schema": rep["schema"], "ms": rep["ms"],
                   "storey_chosen": next((s["index"] for s in rep["storeys"] if s["chosen"]), None)})
    return {**result, "version_id": v["id"], "level_id": lid, "existing_auto": existing}
