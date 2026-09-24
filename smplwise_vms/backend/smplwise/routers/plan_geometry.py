"""Plan Studio API (T084, CR-003): the structure document of a plan version - draft autosave, publish, diff, history,
timeline, rollback, copy from another version - and the version's two-point calibration. Drafts need map.edit on the
floor; published documents are readable with map.read, like the plan image itself."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, require
from ..services import geometry_store as store
from ..services import plan_catalog
from ..services import plan_geometry as pg
from ..services import plan_geometry_render as render
from ..services.timeutil import parse_utc
from .catalog import get_floor
from .plans import get_version, version_row
from .zones import floor_zones

router = APIRouter()
NO_CACHE = {"Cache-Control": "private, no-cache"}


def _layers(raw: str | None) -> set[str] | None:
    """?layers=structure,objects,labels,connectors - any subset; an unknown name is a 422."""
    if raw is None:
        return None
    chosen = {x.strip() for x in raw.split(",") if x.strip()}
    unknown = sorted(chosen - set(render.LAYERS))
    if unknown:
        raise ApiError(422, "validation", "שכבות לא מוכרות בייצוא.", details={"unknown": unknown, "layers": list(render.LAYERS)})
    return chosen


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _floor(v: sqlite3.Row) -> tuple[str, str]:
    return ("floor", v["floor_id"])


def _payload(conn: sqlite3.Connection, version: sqlite3.Row, row: sqlite3.Row | None, doc: dict[str, Any]) -> dict[str, Any]:
    published = store.published_row(conn, version["id"])
    geometry = store.row_api(row) if row is not None else {
        "id": None, "plan_version_id": version["id"], "floor_id": version["floor_id"], "status": "new", "revision": 0, "doc_hash": store.doc_hash(doc),
        "created_at": None, "updated_at": None, "published_at": None, "published_by": None, "archived_at": None,
    }
    return {"geometry": geometry, "doc": doc,
            "issues": [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if not i["structural"]] + store.anchor_issues(conn, version["floor_id"], doc),
            "published_hash": published["doc_hash"] if published is not None else None}


def _editable(conn: sqlite3.Connection, principal: Principal, version_id: str) -> sqlite3.Row:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לעריכה; שחזר אותה קודם.")
    return v


@router.get("/plan-versions/{version_id}/geometry", response_model=None)
def get_geometry(version_id: str, request: Request, draft: bool = False, at: str | None = None,
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Any:
    v = get_version(conn, version_id)
    if draft:
        require(conn, principal, "map.edit", _floor(v))
        doc, row = store.working_doc(conn, v)
        body = _payload(conn, v, row, doc)
        if pg.is_empty(doc):
            body["copy_candidates"] = store.copy_candidates(conn, v)
        return body
    require(conn, principal, "map.edit" if v["status"] == "draft" else "map.read", _floor(v))
    if at:
        try:
            iso = parse_utc(at).strftime("%Y-%m-%dT%H:%M:%SZ")
        except (ValueError, OverflowError):  # an extreme offset (9999-12-31T23:59:59-01:00) overflows the UTC conversion
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
        row = store.at_row(conn, v["id"], iso)
    else:
        row = store.published_row(conn, v["id"])
    if row is None:
        raise not_found("אין מבנה מפורסם לגרסה הזו.")
    etag = f'"{row["doc_hash"]}"'
    headers = {"ETag": etag, **NO_CACHE}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return JSONResponse(_payload(conn, v, row, store.load_doc(row)), headers=headers)


class GeometryPut(BaseModel):
    doc: dict[str, Any]
    base_revision: int = Field(ge=0)


@router.put("/plan-versions/{version_id}/geometry")
def put_geometry(version_id: str, body: GeometryPut, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = _editable(conn, principal, version_id)
    structural = [i for i in pg.validate(body.doc) if i["structural"]]
    if structural:
        raise ApiError(422, "geometry_structure", "מבנה המסמך אינו תקין; השינוי לא נשמר.", details={"issues": structural[:50]})
    row = store.save_draft(conn, v, body.doc, body.base_revision, principal.user_id)
    return _payload(conn, v, row, store.load_doc(row))


@router.post("/plan-versions/{version_id}/geometry/publish")
def publish_geometry(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", _floor(v))
    if v["status"] == "draft":
        raise conflict("publish_plan_first", "זו טיוטת תוכנית: פרסום הגרסה יפרסם גם את המבנה שלה.")
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לפרסום.")
    result = store.publish(conn, v, principal.user_id)
    if not result["unchanged"]:
        audit(conn, actor=principal, action="geometry.publish", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "geometry_id": result["published"]["id"], "changes": result["diff"]["total"],
                       "collections": {k: {kk: len(vv) for kk, vv in c.items()} for k, c in result["diff"]["collections"].items()}})
    return result


@router.get("/plan-versions/{version_id}/geometry/diff")
def geometry_diff(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    doc, _ = store.working_doc(conn, v)
    p = store.published_row(conn, v["id"])
    old = store.load_doc(p) if p is not None else None
    return {"diff": pg.diff(old, doc),
            "issues": [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if not i["structural"]] + store.anchor_issues(conn, v["floor_id"], doc),
            "counts": pg.counts(doc), "published_counts": pg.counts(old) if old is not None else None}


@router.get("/plan-versions/{version_id}/geometry/versions")
def geometry_versions(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    return {"versions": [dict(store.row_api(r), counts=pg.counts(store.load_doc(r))) for r in store.history(conn, v["id"])]}


@router.get("/plan-versions/{version_id}/geometry/timeline")
def geometry_timeline(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """When each published structure of the version was in force - the historical map picks the one of its instant."""
    v = get_version(conn, version_id)
    require(conn, principal, "map.read", _floor(v))
    return {"timeline": [{"id": r["id"], "doc_hash": r["doc_hash"], "published_at": r["published_at"], "archived_at": r["archived_at"]}
                         for r in reversed(store.history(conn, v["id"]))]}


class GeometryRollbackIn(BaseModel):
    geometry_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/rollback")
def rollback_geometry(version_id: str, body: GeometryRollbackIn, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", _floor(v))
    if v["status"] != "published":
        raise conflict("not_published", "שחזור מבנה אפשרי בגרסת התוכנית המפורסמת.")
    row = store.rollback(conn, v, body.geometry_id, principal.user_id)
    audit(conn, actor=principal, action="geometry.rollback", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "restored_from": body.geometry_id, "geometry_id": row["id"]})
    return {"published": store.row_api(row)}


class CopyFromIn(BaseModel):
    from_version_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/copy-from")
def copy_geometry(version_id: str, body: CopyFromIn, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = _editable(conn, principal, version_id)
    src = get_version(conn, body.from_version_id)
    if src["floor_id"] != v["floor_id"]:
        raise ApiError(422, "validation", "אפשר להעתיק מבנה רק מגרסה של אותה קומה.")
    row = store.copy_from(conn, v, src, principal.user_id)
    audit(conn, actor=principal, action="geometry.copy", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "from_version_id": src["id"]})
    return _payload(conn, v, row, store.load_doc(row))


class LinkIn(BaseModel):
    connector_id: str = Field(min_length=1, max_length=64)
    floor_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/link")
def link_connector(version_id: str, body: LinkIn, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Stairs / an elevator to another floor: the connector keeps one id in both floors' drafts (map.edit on both)."""
    v = _editable(conn, principal, version_id)
    if body.floor_id == v["floor_id"]:
        raise ApiError(422, "validation", "קשר לקומה אחרת, לא לאותה קומה.")
    get_floor(conn, body.floor_id)
    require(conn, principal, "map.edit", ("floor", body.floor_id))
    result = store.link_connector(conn, v, body.connector_id, body.floor_id, principal.user_id)
    audit(conn, actor=principal, action="geometry.connector.link", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "connector_id": body.connector_id, "to_floor_id": body.floor_id, "target_version_id": result["target"]["version_id"]})
    return result


class CalPair(BaseModel):
    a: list[float] = Field(min_length=2, max_length=2)
    b: list[float] = Field(min_length=2, max_length=2)
    metres: float = Field(gt=0, le=1000)


class CalibrationIn(BaseModel):
    pairs: list[CalPair] = Field(min_length=1, max_length=4)


@router.patch("/plan-versions/{version_id}/calibration")
def calibrate(version_id: str, body: CalibrationIn, request: Request, principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Two points and a known distance (more pairs average and expose a distorted scan). Nothing moves on the map:
    positions are 0..1; only the metres change. Viewers see it after the structure is published."""
    v = _editable(conn, principal, version_id)
    if any(not 0 <= c <= 1 for p in body.pairs for c in (*p.a, *p.b)):
        raise ApiError(422, "validation", "נקודות הכיול חייבות להיות בתוך התוכנית.")
    try:
        scale, residual = pg.two_point_scale([(p.a, p.b, p.metres) for p in body.pairs], v["width_px"], v["height_px"])
    except ValueError:
        raise ApiError(422, "validation", "שתי הנקודות קרובות מדי זו לזו; בחר נקודות רחוקות יותר.")
    now = now_iso()
    record = {"method": "two_point", "pairs": [{"a": [round(p.a[0], 6), round(p.a[1], 6)], "b": [round(p.b[0], 6), round(p.b[1], 6)], "metres": p.metres} for p in body.pairs],
              "residual_pct": residual, "at": now, "by": principal.user_id}
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ?, revision = revision + 1 WHERE id = ?",
                 (scale, json.dumps(record, ensure_ascii=False), v["id"]))
    v2 = get_version(conn, v["id"])
    doc, row = store.working_doc(conn, v2)
    store.save_draft(conn, v2, doc, row["revision"] if row is not None else 0, principal.user_id, now)
    audit(conn, actor=principal, action="plan.calibrate", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "scale_m_per_px": scale, "residual_pct": residual, "pairs": len(body.pairs)})
    warning = "הזוגות לא מסכימים ביניהם ביותר מ־3%: ייתכן שהסריקה מעוותת. כייל שוב או הוסף זוג." if residual > 3 else None
    return {"version": version_row(v2), "scale_m_per_px": scale, "residual_pct": residual, "warning": warning}


def _export_doc(conn: sqlite3.Connection, principal: Principal, version_id: str, draft: bool) -> tuple[sqlite3.Row, dict[str, Any]]:
    v = get_version(conn, version_id)
    if draft:
        require(conn, principal, "map.edit", _floor(v))
        return v, store.working_doc(conn, v)[0]
    require(conn, principal, "map.edit" if v["status"] == "draft" else "map.read", _floor(v))
    row = store.published_row(conn, v["id"])
    if row is None:
        raise not_found("אין מבנה מפורסם לגרסה הזו.")
    return v, store.load_doc(row)


@router.get("/plan-versions/{version_id}/export.svg", response_model=None)
def export_svg(version_id: str, draft: bool = False, level: str | None = None, labels: bool = True, rooms: bool = True, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    text = render.render_svg(doc, floor_zones(conn, v["floor_id"]), v["width_px"], v["height_px"], level=level, labels=labels, rooms=rooms, layers=_layers(layers),
                             anchors=store.anchor_positions(conn, v["floor_id"]), items=plan_catalog.item_index(conn))
    return Response(content=text.encode("utf-8"), media_type="image/svg+xml; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.svg"', **NO_CACHE})


@router.get("/plan-versions/{version_id}/export.png", response_model=None)
def export_png(version_id: str, request: Request, draft: bool = False, level: str | None = None, background: bool = True, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    picture = settings_of(request).data_dir / v["image_path"] if background else None
    data = render.render_png(doc, floor_zones(conn, v["floor_id"]), v["width_px"], v["height_px"], background=picture if picture is not None and picture.exists() else None,
                             level=level, layers=_layers(layers), anchors=store.anchor_positions(conn, v["floor_id"]), items=plan_catalog.item_index(conn))
    return Response(content=data, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.png"', **NO_CACHE})
