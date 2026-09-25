"""Plan Studio API (T084, CR-003): the structure document of a plan version - draft autosave, publish, diff, history,
timeline, rollback, copy from another version - and the version's two-point calibration. Drafts need map.edit on the
floor; published documents are readable with map.read, like the plan image itself."""
from __future__ import annotations

import concurrent.futures
import json
import sqlite3
import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, StringConstraints

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import new_id, now_iso, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, require
from ..services import geometry_store as store
from ..services import plan_catalog
from ..services import plan_detect
from ..services import plan_geometry as pg
from ..services import plan_geometry_render as render
from ..services.timeutil import parse_utc
from .catalog import get_floor
from .plans import get_version, version_row
from .zones import floor_zones

router = APIRouter()
NO_CACHE = {"Cache-Control": "private, no-cache"}
DETECT_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="plan-detect")


def shutdown_detect_pool() -> None:
    """The app's stop hook: queued runs are cancelled and a running one is not waited for. The stop does not stop a
    running worker: it goes on until it finishes or its own deadline passes, so at most detect_timeout_s after its
    request. A fresh pool takes the old one's place (threads start only on the first submit), so an app created again
    in the same process - the test suite - still detects."""
    global DETECT_POOL
    old, DETECT_POOL = DETECT_POOL, concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="plan-detect")
    old.shutdown(wait=False, cancel_futures=True)


def _layers(raw: str | None) -> set[str] | None:
    """?layers=structure,objects,labels,connectors - any subset; an unknown name is a 422. An empty value (?layers=
    or ?layers=,) means all layers, the same as omitting the parameter - not a blank export."""
    if raw is None:
        return None
    chosen = {x.strip() for x in raw.split(",") if x.strip()}
    unknown = sorted(chosen - set(render.LAYERS))
    if unknown:
        raise ApiError(422, "validation", "שכבות לא מוכרות בייצוא.", details={"unknown": unknown, "layers": list(render.LAYERS)})
    return chosen or None


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


class EstimateIn(BaseModel):
    scale_m_per_px: float = Field(gt=0, le=10)
    method: str = Field(default="door_width", pattern="^(door_width)$")
    reason: str = Field(default="לפי רוחב דלת אופייני", max_length=200)


class CalibrationIn(BaseModel):
    pairs: list[CalPair] | None = Field(default=None, min_length=1, max_length=4)
    estimate: EstimateIn | None = None
    replace_measured: bool = False  # an estimate over a measured calibration only when the person confirms it


@router.patch("/plan-versions/{version_id}/calibration")
def calibrate(version_id: str, body: CalibrationIn, request: Request, principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Two points and a known distance (more pairs average and expose a distorted scan), or - phase 3 - the estimate the
    detector offers from the door widths, recorded as an estimated calibration (design 6.3: metres then show as
    approximate). Nothing moves on the map: positions are 0..1; only the metres change. Viewers see it after the
    structure is published."""
    v = _editable(conn, principal, version_id)
    if (body.pairs is None) == (body.estimate is None):
        raise ApiError(422, "validation", "שלח pairs (כיול בשתי נקודות) או estimate (הערכה), לא שניהם.")
    now = now_iso()
    residual: float | None
    if body.estimate is not None:
        was_measured = pg.calibration_of(v, None)["status"] == "measured"
        if was_measured and not body.replace_measured:
            raise conflict("calibration_measured", "לתוכנית כבר יש כיול מדוד; הערכה תחליף אותו רק באישור (replace_measured).")
        scale, residual, status = body.estimate.scale_m_per_px, None, "estimated"
        record: dict[str, Any] = {"method": body.estimate.method, "status": status, "pairs": [], "residual_pct": None, "reason": body.estimate.reason, "at": now, "by": principal.user_id}
        details: dict[str, Any] = {"version_id": v["id"], "method": body.estimate.method, "status": status, "scale_m_per_px": scale, "replaced_measured": was_measured}
    else:
        pairs = body.pairs or []
        if any(not 0 <= c <= 1 for p in pairs for c in (*p.a, *p.b)):
            raise ApiError(422, "validation", "נקודות הכיול חייבות להיות בתוך התוכנית.")
        try:
            scale, residual = pg.two_point_scale([(p.a, p.b, p.metres) for p in pairs], v["width_px"], v["height_px"])
        except ValueError:
            raise ApiError(422, "validation", "שתי הנקודות קרובות מדי זו לזו; בחר נקודות רחוקות יותר.")
        status = "measured"
        record = {"method": "two_point", "status": status, "pairs": [{"a": [round(p.a[0], 6), round(p.a[1], 6)], "b": [round(p.b[0], 6), round(p.b[1], 6)], "metres": p.metres} for p in pairs],
                  "residual_pct": residual, "reason": None, "at": now, "by": principal.user_id}
        details = {"version_id": v["id"], "method": "two_point", "status": status, "scale_m_per_px": scale, "residual_pct": residual, "pairs": len(pairs)}
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ?, revision = revision + 1 WHERE id = ?",
                 (scale, json.dumps(record, ensure_ascii=False), v["id"]))
    v2 = get_version(conn, v["id"])
    doc, row = store.working_doc(conn, v2)
    store.save_draft(conn, v2, doc, row["revision"] if row is not None else 0, principal.user_id, now)
    audit(conn, actor=principal, action="plan.calibrate", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request), details=details)
    warning = "הזוגות לא מסכימים ביניהם ביותר מ־3%: ייתכן שהסריקה מעוותת. כייל שוב או הוסף זוג." if residual is not None and residual > 3 else None
    return {"version": version_row(v2), "scale_m_per_px": scale, "residual_pct": residual, "warning": warning, "status": status}


# ---------------------------------------------------------------- detection (phase 3, T086)

CandidateId = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class DetectIn(BaseModel):
    targets: list[str] = Field(default=["walls", "openings"], min_length=1, max_length=4)
    strength: float = Field(default=0.6, ge=0.3, le=1.0)
    level_id: str | None = Field(default=None, max_length=64)


class CandidateSet(BaseModel):
    walls: list[dict[str, Any]] = Field(default=[], max_length=2000)
    openings: list[dict[str, Any]] = Field(default=[], max_length=4000)
    objects: list[dict[str, Any]] = Field(default=[], max_length=5000)


class DetectorIn(BaseModel):
    """What the client says produced the candidates; stored in meta.last_detection, so bounded (unknown keys dropped)."""
    name: str = Field(min_length=1, max_length=64)
    version: str | None = Field(default=None, max_length=32)
    params: dict[str, Any] = Field(default={}, max_length=64)


class AcceptIn(BaseModel):
    accepted: list[CandidateId] = Field(min_length=1, max_length=11000)
    edits: dict[CandidateId, dict[str, Any]] = Field(default={}, max_length=11000)
    replace_auto: bool = False
    candidates: CandidateSet
    base_revision: int = Field(ge=0)
    detector: DetectorIn | None = None


def _auto_counts(doc: dict[str, Any]) -> dict[str, int]:
    return {c: sum(1 for i in doc.get(c) or [] if isinstance(i, dict) and i.get("source") == "auto") for c in ("walls", "openings")}


@router.post("/plan-versions/{version_id}/detect")
def detect_structure(version_id: str, body: DetectIn, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Candidates (walls, openings) from the version's picture by the local detector (design section 9): synchronous,
    in a worker thread, at most detect_timeout_s (decision 6); nothing is stored - the client sends back what it
    accepts to /detect/accept. The calibration, when there is one, sets the metres; otherwise the answer carries a
    door-width hint."""
    settings = settings_of(request)
    v = _editable(conn, principal, version_id)
    targets = list(dict.fromkeys(body.targets))
    if "walls" not in targets or any(t not in plan_detect.TARGETS for t in targets):
        raise ApiError(422, "validation", "targets: walls חובה, openings אופציונלי.")
    doc, _row = store.working_doc(conn, v)
    level_ids = {lv["id"] for lv in doc["levels"]}
    level_id = body.level_id or next((lv["id"] for lv in doc["levels"] if lv.get("is_default")), pg.DEFAULT_LEVEL_ID)
    if level_id not in level_ids:
        raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    cal = pg.calibration_of(v, None)
    scale = float(v["scale_m_per_px"]) if v["scale_m_per_px"] and cal["status"] in ("measured", "estimated") else None
    png = src.read_bytes()
    t0 = time.perf_counter()
    # the same guard inside the run: a worker past the deadline stops at its next stage (plan_detect.DetectTimeout)
    # instead of finishing a result nobody reads, so a timed-out run does not hold one of the two workers
    deadline = time.monotonic() + settings.detect_timeout_s
    future = DETECT_POOL.submit(plan_detect.detect, png, targets=targets, strength=body.strength, scale_m_per_px=scale, level_id=level_id, run_id=new_id()[:6], deadline=deadline)
    try:
        with unlocked(conn):  # the write lock is not held while the worker runs
            result = future.result(timeout=settings.detect_timeout_s)
    except (concurrent.futures.TimeoutError, plan_detect.DetectTimeout):
        future.cancel()  # a queued run never starts; a running one stops at its deadline, its result is never read
        audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "targets": targets, "strength": body.strength, "timeout_s": settings.detect_timeout_s, "timed_out": True})
        raise ApiError(504, "detect_timeout", "הזיהוי לא הסתיים בזמן; נסה עוצמה נמוכה יותר או תוכנית קטנה יותר.", retryable=True, details={"timeout_s": settings.detect_timeout_s})
    except (OSError, ValueError, MemoryError, RuntimeError) as exc:  # RuntimeError: the thinning's iteration bound in plan_detect
        audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "targets": targets, "strength": body.strength, "failed": type(exc).__name__})
        raise ApiError(500, "detect_failed", "זיהוי המבנה נכשל.", details={"error": type(exc).__name__})
    if scale is not None and isinstance(result.get("scale"), dict):
        result["scale"]["status"] = cal["status"]  # the detector calls any given scale measured; an estimate stays an estimate
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "targets": targets, "strength": body.strength, "walls": len(result["walls"]), "openings": len(result["openings"]), "ms": elapsed_ms,
                   "calibrated": scale is not None, "tilt_deg": result["detector"]["params"].get("tilt_deg") if isinstance(result.get("detector"), dict) else None})
    return {**result, "version_id": v["id"], "level_id": level_id, "existing_auto": _auto_counts(doc), "elapsed_ms": elapsed_ms}


@router.post("/plan-versions/{version_id}/detect/accept")
def accept_detection(version_id: str, body: AcceptIn, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The candidates a person kept, merged into the draft under the draft's revision rules (design 9.5). The server
    remembers no candidates: the client sends them back. Nothing is published."""
    v = _editable(conn, principal, version_id)
    doc, row = store.working_doc(conn, v)
    current = row["revision"] if row is not None else 0
    if body.base_revision != current:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=current, sent_revision=body.base_revision)
    try:
        merged, counts = pg.merge_candidates(doc, body.candidates.model_dump(), body.accepted, body.edits, body.replace_auto)
    except pg.CandidateError as exc:
        raise ApiError(422, exc.code, exc.user_message, details={"ids": exc.ids})
    structural = [i for i in pg.validate(merged) if i["structural"]]
    if structural:
        raise ApiError(422, "geometry_structure", "מבנה המועמדים אינו תקין; דבר לא נשמר.", details={"issues": structural[:50]})
    meta = dict(merged.get("meta") or {})
    detector = body.detector.model_dump() if body.detector is not None else None
    meta["last_detection"] = {"at": now_iso(), "by": principal.user_id, "detector": detector, "accepted": counts["accepted"], "replace_auto": body.replace_auto}
    if body.detector is not None:
        meta["detector_version"] = f"{body.detector.name} {body.detector.version or ''}".strip()
    merged["meta"] = meta
    saved = store.save_draft(conn, v, merged, body.base_revision, principal.user_id)
    audit(conn, actor=principal, action="geometry.detect.accept", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], **counts, "edits": len(body.edits), "replace_auto": body.replace_auto, "detector": body.detector.name if body.detector is not None else None})
    return {**_payload(conn, v, saved, store.load_doc(saved)), "merge": counts}


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
