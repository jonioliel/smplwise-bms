"""CR-020 S2 phase C: the same stream change on many cameras (docs/architecture/NVR_SETTINGS_API.md 3.7).

Four routes, `nvr.configure` (a SYSTEM permission: built-in system_admin only) at installation scope on every one:
- `POST /nvr/stream-batches` - start a batch (202). The permission is checked on the READ connection before the body is
  read; then `confirm` (the JSON literal true) before anything else, the body shape, `nvr.configure` on EVERY target
  camera's chain (one deny = 403 for the whole batch, audited), NVR-less mode, then the service (read-only preflight,
  placeholders + one audit row, the background runner).
- `GET /nvr/stream-batches[?active=1]`, `GET /nvr/stream-batches/{batch_id}[?offset&limit]` - progress, paged.
- `POST /nvr/stream-batches/{batch_id}/stop` - no confirmation (the safe direction), idempotent.
- `POST /nvr/stream-batches/{batch_id}/rollback` - undo-all as a new batch, body `{"confirm": true}`.
No route returns a device address, a device user name, a password, a serial number or a MAC."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse

from ..auth import current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..mode import ensure_nvr
from ..rbac import INSTALLATION, Principal, require
from ..remote_channel import is_remote
from ..services import nvr_batch, nvr_encoding_batch
from .nvr_write import _raw_body, json_body

router = APIRouter()
PERMISSION = nvr_batch.WRITE_PERMISSION
BATCH_ID = Path(pattern=r"^[0-9a-f]{16}$")
BATCH_ID_RE = re.compile(r"^[0-9a-f]{16}$")
CREATE_BODY_OPENAPI: dict[str, Any] = {"requestBody": {"required": True, "content": {"application/json": {"schema": {
    "type": "object", "required": ["confirm", "changes", "targets"], "additionalProperties": False,
    "properties": {
        "confirm": {"type": "boolean", "enum": [True]},
        "changes": {"type": "object", "required": ["svc"], "additionalProperties": False, "properties": {"svc": {"type": "boolean", "enum": [False]}}},
        "recorder_id": {"type": "string", "pattern": r"^[A-Za-z0-9_.-]{1,40}$"},
        "targets": {"type": "array", "minItems": nvr_batch.MIN_TARGETS, "maxItems": nvr_batch.MAX_TARGETS, "items": {
            "type": "object", "required": ["camera_id", "stream_ref", "if_match"], "additionalProperties": False,
            "properties": {"camera_id": {"type": "string", "maxLength": 64}, "stream_ref": {"type": "string", "pattern": r"^\d{1,6}$"},
                           "if_match": {"type": "string", "pattern": "^[0-9a-f]{16}$"}}}},
    }}}}}}
_SETTINGS_SCHEMA: dict[str, Any] = {"type": "object", "minProperties": 1, "additionalProperties": False, "properties": {
    "codec": {"type": "string", "enum": list(nvr_encoding_batch.CODECS)}, "resolution": {"type": "string", "pattern": r"^\d{2,5}x\d{2,5}$"},
    "fps": {"oneOf": [{"type": "number", "exclusiveMinimum": 0, "maximum": 1000}, {"type": "string", "enum": ["full"]}]},
    "bitrate_mode": {"type": "string", "enum": ["CBR", "VBR"]}, "bitrate_kbps": {"type": "integer", "minimum": 1, "maximum": 1_000_000},
    "quality": {"type": "integer", "minimum": 0, "maximum": 100}, "gop": {"type": "integer", "minimum": 1, "maximum": 10_000},
    "svc": {"type": "boolean"}, "smart_codec": {"type": "boolean"}}}
_STREAM_TARGET: dict[str, Any] = {"camera_id": {"type": "string", "maxLength": 64}, "stream_ref": {"type": "string", "pattern": r"^\d{1,6}$"}}
ENC_PREVIEW_OPENAPI: dict[str, Any] = {"requestBody": {"required": True, "content": {"application/json": {"schema": {
    "type": "object", "required": ["settings", "targets"], "additionalProperties": False,
    "properties": {"settings": _SETTINGS_SCHEMA, "recorder_id": {"type": "string", "pattern": r"^[A-Za-z0-9_.-]{1,40}$"},
                   "targets": {"type": "array", "minItems": nvr_encoding_batch.MIN_TARGETS, "maxItems": nvr_encoding_batch.MAX_TARGETS, "items": {
                       "type": "object", "required": ["camera_id", "stream_ref"], "additionalProperties": False, "properties": _STREAM_TARGET}}}}}}}}
ENC_CREATE_OPENAPI: dict[str, Any] = {"requestBody": {"required": True, "content": {"application/json": {"schema": {
    "type": "object", "required": ["confirm", "settings", "targets"], "additionalProperties": False,
    "properties": {"confirm": {"type": "boolean", "enum": [True]}, "settings": _SETTINGS_SCHEMA,
                   "recorder_id": {"type": "string", "pattern": r"^[A-Za-z0-9_.-]{1,40}$"},
                   "targets": {"type": "array", "minItems": nvr_encoding_batch.MIN_TARGETS, "maxItems": nvr_encoding_batch.MAX_TARGETS, "items": {
                       "type": "object", "required": ["camera_id", "stream_ref", "if_match", "changes"], "additionalProperties": False,
                       "properties": {**_STREAM_TARGET, "if_match": {"type": "string", "pattern": "^[0-9a-f]{16}$"},
                                      "changes": {"type": "object", "minProperties": 1, "description": "exactly the preview's `changes` for this stream"}}}}}}}}}}
CONFIRM_BODY_OPENAPI: dict[str, Any] = {"requestBody": {"required": True, "content": {"application/json": {"schema": {
    "type": "object", "required": ["confirm"], "properties": {"confirm": {"type": "boolean", "enum": [True]}}}}}}}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """`nvr.configure` at installation on the READ connection, before the body is read (the S2A review L2 / L7 pattern)."""
    require(conn, principal, PERMISSION, INSTALLATION)
    return principal


@router.post("/nvr/stream-batches", status_code=202, openapi_extra=CREATE_BODY_OPENAPI)
def create_batch(request: Request, principal: Principal = Depends(_gate_ro), raw: bytes = Depends(_raw_body),
                 conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """CR-020 S2C: start a multi-camera SVC-off batch (nvr.configure + every camera, {confirm: true, changes, targets}); 202 {batch_id, state, items}."""
    try:
        req = nvr_batch.parse_batch_body(json_body(raw))
    except ApiError as exc:
        raise nvr_batch.refuse(conn, principal, exc, _rid(request)) from None
    nvr_batch.authorize_targets(conn, principal, [t.camera_id for t in req.targets])
    settings = settings_of(request)
    ensure_nvr(settings)
    body = nvr_batch.create_write_batch(conn, request.app.state.db, settings, principal, req, request_id=_rid(request))
    return JSONResponse(status_code=202, content=body)


@router.get("/nvr/stream-batches")
def list_batches(active: bool = Query(default=False), principal: Principal = Depends(current_principal_ro),
                 conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-020 S2C: the running batches (?active=1, the screen resumes after a reload) or the latest ones; nvr.configure."""
    require(conn, principal, PERMISSION, INSTALLATION)  # review finding 3: read connection, no recovery, no device read
    return nvr_batch.list_batches(conn, active)


@router.get("/nvr/stream-batches/{batch_id}")
def get_batch(batch_id: str = BATCH_ID, offset: int = Query(default=0, ge=0, le=100_000),
              limit: int = Query(default=nvr_batch.PAGE_DEFAULT, ge=1, le=nvr_batch.PAGE_MAX), principal: Principal = Depends(current_principal_ro),
              conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-020 S2C: one batch's state, counts and a page of its items (by index); nvr.configure, items filtered by camera scope."""
    require(conn, principal, PERMISSION, INSTALLATION)  # review finding 3: polled every 1.5 s - never the write lock
    return nvr_batch.batch_status(conn, principal, batch_id, offset=offset, limit=limit)


@router.post("/nvr/stream-batches/{batch_id}/stop")
def stop_batch(request: Request, batch_id: str = BATCH_ID, principal: Principal = Depends(current_principal_ro),
               conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CR-020 S2C: stop after the camera in progress (the rest not attempted); a gone or hung runner is abandoned at once;
    no confirm, idempotent; nvr.configure."""
    require(conn, principal, PERMISSION, INSTALLATION)
    return nvr_batch.stop_batch(request.app.state.db, conn, principal, batch_id, request_id=_rid(request))


@router.post("/nvr/stream-batches/{batch_id}/rollback", status_code=202, openapi_extra=CONFIRM_BODY_OPENAPI)
def rollback_batch(request: Request, batch_id: str, principal: Principal = Depends(_gate_ro), raw: bytes = Depends(_raw_body),
                   conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """CR-020 S2C: undo-all - a new batch of single undos in reverse order ({confirm: true}, nvr.configure + every camera); 202."""
    if not BATCH_ID_RE.fullmatch(batch_id):  # review finding 8: never audit an id that did not pass the format check
        raise ApiError(404, "not_found", "השינוי המרובה לא נמצא.")
    meta = nvr_batch._meta(conn, batch_id)
    if meta is not None and meta.get("mode") == nvr_encoding_batch.MODE and is_remote(request):
        # phase D: an encoding batch is started and undone on the local channel only (as its routes, BLOCKED_ON_REMOTE)
        raise ApiError(404, "not_found", "Not found")
    body = json_body(raw)
    if not isinstance(body, dict) or body.get("confirm") is not True:
        raise nvr_batch.refuse(conn, principal, ApiError(422, "confirm_required", "יש לאשר את הביטול."), _rid(request), kind="rollback",
                               source_batch_id=batch_id) from None
    settings = settings_of(request)
    ensure_nvr(settings)
    out = nvr_batch.create_rollback_batch(conn, request.app.state.db, settings, principal, batch_id, request_id=_rid(request))
    return JSONResponse(status_code=202, content=out)


# ------------------------------------------------------------------------------------------------ phase D: bulk encoding
# Both routes are local-only (remote_channel.BLOCKED_ON_REMOTE). A body that is not JSON is `MALFORMED` (not a dict):
# refused 422 (preview `validation`, start `confirm_required`), audited, before any device read.

@router.post("/nvr/encoding-batches/preview", openapi_extra=ENC_PREVIEW_OPENAPI)
def preview_encoding_batch(request: Request, principal: Principal = Depends(_gate_ro), raw: bytes = Depends(_raw_body),
                           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-020 phase D: the plan of one encoding change on many streams - before/after per stream, skips with the reason (read-only; nvr.configure + every camera)."""
    try:
        target, targets, rid = nvr_encoding_batch.parse_preview_body(json_body(raw))
    except ApiError as exc:
        raise nvr_batch.refuse(conn, principal, exc, _rid(request), kind="preview", mode=nvr_encoding_batch.MODE) from None
    nvr_batch.authorize_targets(conn, principal, sorted({t.camera_id for t in targets}))
    settings = settings_of(request)
    ensure_nvr(settings)
    return nvr_encoding_batch.preview(conn, settings, principal, target, targets, rid, request_id=_rid(request))


@router.post("/nvr/encoding-batches", status_code=202, openapi_extra=ENC_CREATE_OPENAPI)
def create_encoding_batch(request: Request, principal: Principal = Depends(_gate_ro), raw: bytes = Depends(_raw_body),
                          conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """CR-020 phase D: start one encoding change on many streams ({confirm: true, settings, targets with the preview's changes}); 202 batch status."""
    try:
        target, targets, rid = nvr_encoding_batch.parse_start_body(json_body(raw))
    except ApiError as exc:
        raise nvr_batch.refuse(conn, principal, exc, _rid(request), mode=nvr_encoding_batch.MODE) from None
    nvr_batch.authorize_targets(conn, principal, sorted({t.camera_id for t in targets}))
    settings = settings_of(request)
    ensure_nvr(settings)
    out = nvr_encoding_batch.create_encoding_batch(conn, request.app.state.db, settings, principal, target, targets, rid, request_id=_rid(request))
    return JSONResponse(status_code=202, content=out)
