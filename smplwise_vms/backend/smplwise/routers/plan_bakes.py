"""Plan Studio 6 bakes (CR-029 S3; services/plan_bakes.py, docs/changes/CR-029-ST7-S3-NOTES.md): list / serve the stills, masks
and lightmaps of a floor (map.read on the floor), store an upload from an editor's browser, open / claim / finish a regenerate
request and delete (map.edit on the floor - the plan-edit permission). Every write is audited (plan.bake.*). The add-on never
renders here: decoding an upload runs in the thread pool behind a bounded semaphore, so the event loop is never blocked."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError, not_found
from ..rbac import Principal, require
from ..services import plan_anchor_scope as anchor_scope
from ..services import plan_bakes as pb
from .catalog import get_floor

router = APIRouter()
P_READ = "map.read"
P_EDIT = "map.edit"
_STATUS = {"payload_too_large": 413, "unsupported_format": 415, "too_many_pixels": 413, "corrupt_image": 422, "corrupt_mask": 422, "image_metadata": 422,
           "bad_size": 422, "bad_slot": 422, "bad_meta": 422, "validation": 422, "busy": 503, "storage_full": 507, "geometry_changed": 409,
           "job_closed": 409, "job_claimed": 409, "incomplete": 409, "not_found": 404}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _raise(exc: pb.BakeError) -> None:
    raise ApiError(_STATUS.get(exc.code, 422), "bake_" + exc.code if exc.code in ("busy", "storage_full") else exc.code, exc.message,
                   retryable=exc.code == "busy", details=exc.details or None)


def _key_or_409(conn: sqlite3.Connection, floor_id: str) -> tuple[str, str]:
    k = pb.bake_key(conn, floor_id)
    if k is None:
        raise ApiError(409, "no_structure", "לקומה אין מבנה מפורסם; תמונות מוכנות נוצרות מהמבנה המפורסם בלבד.")
    return k


def _served(conn: sqlite3.Connection, principal: Principal, floor_id: str) -> tuple[Any, pb.ServedKey | None]:
    """(what this reader may see of the floor's anchors, the keys as they are handed to them) - security review 2.4.7 L1."""
    visible = anchor_scope.visibility(conn, principal, floor_id)
    return visible, pb.served_bake_key(conn, floor_id, visible)


def _job_out(job: dict[str, Any], sk: pb.ServedKey | None, visible: Any) -> dict[str, Any]:
    return dict(job, bake_key=pb.shown_key(job["bake_key"], sk, visible))


@router.get("/floors/{floor_id}/bakes")
def list_bakes(floor_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The floor's stills, masks and lightmaps (current and stale), the slots the settings expect, what is missing, the open
    regenerate request and the storage use - as this reader is handed them (security review 2.4.7 M1 / L1: the served keys,
    each mask as their camera scope lets them see it)."""
    get_floor(conn, floor_id)
    require(conn, principal, P_READ, ("floor", floor_id))
    return pb.describe(conn, floor_id, settings=settings_of(request), visible=anchor_scope.visibility(conn, principal, floor_id))


@router.get("/floors/{floor_id}/bakes/{bake_id}/file")
def bake_file(floor_id: str, bake_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """One stored file (a still, a mask document or a lightmap); ETag = the sha256 of what is served, so a viewer revalidates
    for free. A mask is served through the reader's camera scope (security review 2.4.7 M1): a reader from whom a camera can be
    withheld gets it without the camera entries they may not see - a mask stored before the fix included - and the ETag of
    that copy."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, P_READ, ("floor", floor_id))
    r = pb.row_of(conn, floor_id, bake_id)
    try:
        path = pb.confine_stored(settings, r["path"]) if r is not None else None
    except pb.BakeStoreError:
        path = None
    if r is None or path is None or not path.exists():
        raise not_found("הקובץ המוכן לא נמצא.")
    mime, sha, content = r["mime"], r["sha256"], None
    if r["kind"] == "mask":
        mv = pb.mask_view(settings, conn, r, anchor_scope.visibility(conn, principal, floor_id), body=True)
        if mv is None:
            raise not_found("הקובץ המוכן לא נמצא.")
        if mv.filtered:
            sha, content = mv.sha256, mv.content
    etag = f'"{sha}"'
    headers = {"ETag": etag, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    if content is not None:
        return Response(content=content, media_type=mime, headers=headers)
    return FileResponse(path, media_type=mime, headers=headers)


@router.post("/floors/{floor_id}/bakes", status_code=201)
async def upload_bake(floor_id: str, request: Request, kind: str = Form(...), level_id: str = Form(...), preset: str = Form(""), style: str = Form(""),
                      band: str = Form(""), variant: str = Form(""), bake_key: str = Form(...), recipe: str = Form(...), meta: str = Form(""),
                      file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Store one rendered file into its slot (replacing the slot's previous file). The key must be the floor's current bake key
    as this editor was handed it (409 geometry_changed otherwise: the structure changed while the browser was rendering); the
    row is stored under the real key (security review 2.4.7 L1, as the skins control-image upload)."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    try:
        slot = pb.check_slot(kind, level_id, preset, style, band, variant)
        meta_obj = pb.validate_meta(kind, meta)
        if not pb.RECIPE_RE.match(recipe or ""):
            raise pb.BakeError("validation", "מזהה המתכון אינו תקין.")
    except pb.BakeError as exc:
        _raise(exc)
    visible, sk = _served(conn, principal, floor_id)
    if sk is None:
        raise ApiError(409, "no_structure", "לקומה אין מבנה מפורסם; תמונות מוכנות נוצרות מהמבנה המפורסם בלבד.")
    if bake_key != sk.bake_key:
        raise ApiError(409, "geometry_changed", "המבנה, החדרים או הקטלוג של הקומה השתנו מאז ההכנה; הכינו שוב.", details={"bake_key": sk.bake_key})
    if slot["level_id"] not in pb.floor_levels(conn, floor_id):
        raise ApiError(422, "bad_slot", "המפלס אינו קיים במבנה המפורסם של הקומה.")
    data = await file.read(pb.MAX_UPLOAD + 1)
    try:
        mime, w, h, _doc = await run_in_threadpool(pb.validate_file, kind, slot["preset"], data)
        row, identical, evicted = pb.store(settings, conn, floor_id, slot, sk.real, recipe, meta_obj, data, mime, w, h, principal.user_id)
        row = dict(row, bake_key=pb.shown_key(row["bake_key"], sk, visible))
    except pb.BakeStoreError:
        raise ApiError(409, "floor_id_unsafe", "מזהה הקומה אינו מתאים לשמירת קבצים; לא נשמר דבר.")
    except pb.BakeError as exc:
        _raise(exc)
    audit(conn, actor=principal, action="plan.bake.upload", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"slot": row["slot"], "bake_key": bake_key, "recipe": recipe, "sha256": row["sha256"], "bytes": row["bytes"], "width": w, "height": h,
                   "identical": identical, "evicted": evicted[:20]})
    return {**row, "identical": identical, "evicted": evicted}


class RegenerateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    levels: list[str] | None = Field(default=None, max_length=64)
    presets: list[str] | None = Field(default=None, max_length=3)
    styles: list[str] | None = Field(default=None, max_length=2)
    bands: list[str] | None = Field(default=None, max_length=3)
    lightmap: bool | None = None


@router.post("/floors/{floor_id}/bakes/regenerate")
def regenerate(floor_id: str, body: RegenerateIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Ask for the floor's stills / masks / lightmap to be drawn again (all the settings list, or a subset). The request is a job
    an editor's browser picks up - the caller's own browser when it can render, otherwise the next editor session on the floor."""
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    key, _ = _key_or_409(conn, floor_id)
    try:
        scope = pb.normalize_scope(body.model_dump(exclude_none=True), pb.floor_levels(conn, floor_id), pb.read_setting(conn))
        job, created = pb.request_job(conn, floor_id, key, scope, principal.user_id)
    except pb.BakeError as exc:
        _raise(exc)
    audit(conn, actor=principal, action="plan.bake.regenerate", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"job_id": job["id"], "created": created, "bake_key": key, "scope": scope})
    visible, sk = _served(conn, principal, floor_id)
    return {"job": _job_out(job, sk, visible), "created": created, "expected": pb.expected_slots_for_scope(job["scope"])}


class FinishIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str = Field(pattern="^(done|failed|cancelled)$")
    error: str | None = Field(default=None, max_length=200)


@router.post("/floors/{floor_id}/bakes/jobs/{job_id}/claim")
def claim(floor_id: str, job_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """This browser takes the request (a 10-minute lease, renewed by claiming again)."""
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    key, _ = _key_or_409(conn, floor_id)
    try:
        job = pb.claim_job(conn, floor_id, job_id, key, principal.user_id)
    except pb.BakeError as exc:
        _raise(exc)
    audit(conn, actor=principal, action="plan.bake.job", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"job_id": job_id, "step": "claim", "lease_until": job["lease_until"]})
    visible, sk = _served(conn, principal, floor_id)
    return {"job": _job_out(job, sk, visible), "expected": pb.expected_slots_for_scope(job["scope"])}


@router.post("/floors/{floor_id}/bakes/jobs/{job_id}/finish")
def finish(floor_id: str, job_id: str, body: FinishIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Close the request: done (every slot it asked for is stored for the current key - 409 incomplete otherwise), failed or
    cancelled (with a short reason)."""
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    try:
        job = pb.finish_job(conn, floor_id, job_id, body.status, body.error, principal.user_id)
    except pb.BakeError as exc:
        _raise(exc)
    audit(conn, actor=principal, action="plan.bake.job", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"job_id": job_id, "step": body.status, "error": job["error"]})
    visible, sk = _served(conn, principal, floor_id)
    return {"job": _job_out(job, sk, visible)}


@router.delete("/floors/{floor_id}/bakes", status_code=204)
def delete_all(floor_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Remove every still, mask and lightmap of the floor (and end its open request)."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    n = pb.delete_floor(settings, conn, floor_id)
    audit(conn, actor=principal, action="plan.bake.delete", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details={"all": True, "rows": n})
    return Response(status_code=204)


@router.delete("/floors/{floor_id}/bakes/{bake_id}", status_code=204)
def delete_one(floor_id: str, bake_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    gone = pb.remove_one(settings, conn, floor_id, bake_id)
    if gone is None:
        raise not_found("הקובץ המוכן לא נמצא.")
    audit(conn, actor=principal, action="plan.bake.delete", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request), details=gone)
    return Response(status_code=204)
