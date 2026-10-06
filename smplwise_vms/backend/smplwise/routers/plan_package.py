"""Plan Studio 5 (T088, ST5): the DXF export of a plan version's structure, the signed plan package and its re-import.

- GET  /plan-versions/{id}/export.dxf        the structure as DXF (fixed layers, metres when calibrated); read like the
                                              SVG export: the published structure with map.read, drafts with map.edit.
- POST /plan-versions/{id}/package           the signed package of the draft or the published structure (map.edit:
                                              it carries the floor's anchors and is signed with the installation key).
- POST /plan-versions/{id}/package/preview   the dry run of an import: checks, versions, diff, missing entities.
- POST /plan-versions/{id}/package/import    the import itself, into the version's draft; the person confirms the
                                              hash the preview showed (`expect_hash`) and the draft revision it saw.
Both import routes take the package as a multipart file (body limit in body_limit.LIMITS)."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import rollback_and_restart
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import bundle as bundle_svc
from ..services import geometry_store as store
from ..services import plan_catalog
from ..services import plan_dxf_export as dxf_export
from ..services import plan_package as pkg_svc
from ..services import signing
from .catalog import get_floor
from .plan_catalog import _INSERT as CATALOG_INSERT
from .plan_catalog import COLUMNS as CATALOG_COLUMNS
from .plan_catalog import _ts as catalog_ts
from .plan_geometry import NO_CACHE, _editable, _export_doc, _export_zones, _floor, _layers, _rid
from .plans import get_version
from .zones import floor_zones

router = APIRouter()


@router.get("/plan-versions/{version_id}/export.dxf", response_model=None)
def export_dxf(version_id: str, draft: bool = False, level: str | None = None, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The structure as DXF R2018: walls, openings, rooms, devices, objects, connectors and labels on their own layers."""
    v, doc = _export_doc(conn, principal, version_id, draft)
    floor = get_floor(conn, v["floor_id"])
    data = dxf_export.render_dxf(doc, _export_zones(conn, principal, v), v["width_px"], v["height_px"], level=level, layers=_layers(layers),
                                 anchors=pkg_svc.anchor_records(conn, v["floor_id"]), anchor_positions=store.anchor_positions(conn, v["floor_id"]),
                                 items=plan_catalog.item_index(conn),
                                 meta={"SW_PLAN_VERSION": v["id"], "SW_FLOOR": floor["name"] or "", "SW_STAGE": "draft" if draft else "published",
                                       "SW_DOC_HASH": store.doc_hash(doc)})
    return Response(content=data, media_type="image/vnd.dxf", headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.dxf"', **NO_CACHE})


class PackageIn(BaseModel):
    draft: bool = False


@router.post("/plan-versions/{version_id}/package", response_model=None)
def export_package(version_id: str, request: Request, body: PackageIn | None = None, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """The signed plan package (ZIP): structure, rooms, anchors, custom items, plan picture, report, signed manifest."""
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    draft = bool(body and body.draft)
    if draft:
        doc, row = store.working_doc(conn, v)
        revision = row["revision"] if row is not None else 0
    else:
        row = store.published_row(conn, v["id"])
        if row is None:
            raise not_found("אין מבנה מפורסם לגרסה הזו.")
        doc, revision = store.load_doc(row), row["revision"]
    settings = settings_of(request)
    floor = get_floor(conn, v["floor_id"])
    iid = bundle_svc.installation_id(conn, create=True)
    data, manifest = pkg_svc.build(settings, conn, v, floor, doc, "draft" if draft else "published", floor_zones(conn, v["floor_id"]), principal, iid, revision)
    sha = pkg_svc._sha(data)
    audit(conn, actor=principal, action="geometry.package.export", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "stage": "draft" if draft else "published", "doc_hash": manifest["document"]["doc_hash"], "package_sha256": sha,
                   "bytes": len(data), "kid": manifest["signature_info"]["kid"], "files": len(manifest["files"])})
    name = f"plan-{v['id']}-{manifest['generated_at'].replace('-', '').replace(':', '')}.swplan.zip"
    return Response(content=data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}"', "X-Package-Sha256": sha, **NO_CACHE})


def _can_manage_catalog(conn: sqlite3.Connection, principal: Principal) -> bool:
    return authorize(conn, principal, "catalog.manage", INSTALLATION).allowed or "catalog.manage" in permissions_anywhere(conn, principal)


def _read_package(file: UploadFile, settings: Any) -> pkg_svc.Package:
    try:
        return pkg_svc.read(file.file, signing.load_keyring(settings))
    except pkg_svc.PackageError as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details)


def _refused(conn: sqlite3.Connection, principal: Principal, v: sqlite3.Row, request: Request, exc: ApiError, stage: str) -> None:
    """A refused package is audited (the refusal row commits with the error answer, like every refusal)."""
    audit(conn, actor=principal, action="geometry.package.import", decision="denied", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "stage": stage, "code": exc.code})


def _plan(conn: sqlite3.Connection, v: sqlite3.Row, package: pkg_svc.Package, mode: str, can_manage: bool) -> dict[str, Any]:
    try:
        return pkg_svc.plan(conn, v, package, mode, can_manage_catalog=can_manage)
    except pkg_svc.PackageError as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details)


@router.post("/plan-versions/{version_id}/package/preview")
def preview_import(version_id: str, request: Request, mode: Literal["replace", "merge"] = Query("replace"), file: UploadFile = File(...),
                   principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The dry run of a package import: signature, versions, the diff against the draft and the missing entities."""
    v = _editable(conn, principal, version_id)
    try:
        package = _read_package(file, settings_of(request))
    except ApiError as exc:
        _refused(conn, principal, v, request, exc, "preview")
        raise
    out = _plan(conn, v, package, mode, _can_manage_catalog(conn, principal))
    return {"origin": pkg_svc.origin(package, bundle_svc.installation_id(conn)), **pkg_svc.public(out)}


@router.post("/plan-versions/{version_id}/package/import")
def import_package(version_id: str, request: Request, mode: Literal["replace", "merge"] = Query("replace"),
                   base_revision: int = Query(ge=0), expect_hash: str = Query(min_length=64, max_length=64), accept_foreign: bool = False,
                   file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Import a package into the version's draft (never published): replace or merge, as the preview showed it."""
    v = _editable(conn, principal, version_id)
    try:
        package = _read_package(file, settings_of(request))
    except ApiError as exc:
        _refused(conn, principal, v, request, exc, "import")
        raise
    local_iid = bundle_svc.installation_id(conn)
    origin = pkg_svc.origin(package, local_iid)
    if origin["trust"] != "installation" and not accept_foreign:
        raise ApiError(409, "package_foreign", "החבילה חתומה במפתח של מערכת אחרת; אשר את המקור כדי לייבא.", details={"kid": origin["kid"]})
    can_manage = _can_manage_catalog(conn, principal)
    out = _plan(conn, v, package, mode, can_manage)
    if out["base_revision"] != base_revision:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; הרץ שוב את הבדיקה.", current_revision=out["base_revision"], sent_revision=base_revision)
    if out["result_hash"] != expect_hash:
        raise conflict("import_plan_changed", "תוצאת הייבוא השתנתה מאז הבדיקה; הרץ שוב את הבדיקה.", result_hash=out["result_hash"])
    try:
        now = catalog_ts()
        for item in out["_to_add"]:
            conn.execute(CATALOG_INSERT, (item["id"], *[item["values"][c] for c in CATALOG_COLUMNS], principal.user_id, item["created_at"] or now, now))
        row = store.save_draft(conn, v, out["doc"], base_revision, principal.user_id)
    except ApiError:
        rollback_and_restart(conn)
        raise
    if out["_to_add"]:
        audit(conn, actor=principal, action="catalog.import", decision="allowed", resource_type="catalog", resource_id="*", request_id=_rid(request),
              details={"imported": len(out["_to_add"]), "replaced": 0, "via": "plan_package", "ids": [i["id"] for i in out["_to_add"]][:50]})
    audit(conn, actor=principal, action="geometry.package.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "mode": mode, "package_sha256": package.package_sha256, "source_installation_id": origin["installation_id"],
                   "trust": origin["trust"], "kid": origin["kid"], "source_version_id": origin["plan_version_id"], "result_hash": row["doc_hash"],
                   "changes": out["diff"]["total"], "same_drawing": out["same_drawing"]})
    return {"geometry": store.row_api(row), "origin": origin, "result_hash": row["doc_hash"], "result_geometry_hash": pkg_svc.geometry_hash(store.load_doc(row)),
            "diff": out["diff"], "entities": out["entities"], "warnings": out["warnings"]}
