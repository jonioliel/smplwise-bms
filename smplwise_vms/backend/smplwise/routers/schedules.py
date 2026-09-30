"""The schedules API (CR-014, "תזמונים"): schedules of the scheduler component, read from a mirror and written only through
the bridge. docs/architecture/SCHEDULER_API.md is the contract (section numbers in the comments below).

Reads: `GET /schedules/status` (never 403), `/schedules`, `/schedules/{id}`, `/schedules/catalog`, `/schedules/condition-candidates`,
`/schedules/trash`, `/schedules/runs`, `/schedules/review`, `/schedules/tags`, `/schedules/organisation`. Writes: `POST /schedules`
(create), `PUT /schedules/{id}`, `POST /schedules/{id}/enable|disable|run|split|delete|copy`, the trash restore / purge, `POST
/schedules/bulk`, `PUT /schedules/organisation`, and `POST /schedules/preview` (data, never a write).

The permission comes before the body; JSON only; the caller's own alarm code (`alarm_code`) is taken out of the body before
validation, so no validation error can quote it, and is never stored, logged, audited or returned. Static paths are declared
before `/schedules/{id}`. The work is in services/schedule_view.py (what a caller sees and may do), services/schedule_ops.py
(the writes) and services/schedules.py (the mirror and the storage)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..auth import current_principal, get_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import schedule_model as model
from ..services import schedule_ops as ops
from ..services import schedule_view as view
from ..services import schedules as store

router = APIRouter()

RID = Field(min_length=8, max_length=80)
DAY = Literal["sun", "mon", "tue", "wed", "thu", "fri", "sat"]


# ---------------------------------------------------------------- bodies (closed: extra="forbid")

class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateBody(_Body):
    draft: model.ScheduleDraftModel
    enabled: bool = True
    client_request_id: str = RID
    confirm_lowering: bool = False


class UpdateBody(_Body):
    draft: model.ScheduleDraftModel
    base_revision: str = Field(min_length=1, max_length=64)
    client_request_id: str = RID
    confirm_lowering: bool = False


class ToggleBody(_Body):
    client_request_id: str = RID
    confirm_lowering: bool = False


class RunBody(_Body):
    slot_index: int | None = Field(default=None, ge=0, le=200)
    skip_conditions: bool = False
    confirm: bool = False
    client_request_id: str = RID


class SplitBody(_Body):
    base_revision: str = Field(min_length=1, max_length=64)
    days: list[DAY] = Field(min_length=1, max_length=7)
    name: str | None = Field(default=None, max_length=80)
    confirm: bool = False
    client_request_id: str = RID
    confirm_lowering: bool = False


class DeleteBody(_Body):
    base_revision: str = Field(min_length=1, max_length=64)
    confirm: bool = False
    client_request_id: str = RID


class CopyBody(_Body):
    name: str = Field(min_length=1, max_length=80)
    client_request_id: str = RID
    confirm_lowering: bool = False


class RestoreBody(_Body):
    client_request_id: str = RID
    confirm_lowering: bool = False


class PurgeBody(_Body):
    confirm: bool = False


class BulkBody(_Body):
    op: Literal["enable", "disable"]
    ids: list[str] = Field(min_length=1, max_length=100)
    confirm: bool = False
    client_request_id: str = RID


class PreviewBody(_Body):
    draft: model.ScheduleDraftModel
    schedule_id: str | None = Field(default=None, max_length=64)
    count: int = Field(default=5, ge=1, le=20)


class FolderModel(_Body):
    id: str | None = Field(default=None, max_length=40)
    name: str = Field(max_length=200)
    position: int | None = None


class OrgItemModel(_Body):
    schedule_id: str = Field(max_length=64)
    folder_id: str | None = Field(default=None, max_length=40)
    order: int | None = None
    pinned: bool = False


class OrgBody(_Body):
    folders: list[FolderModel] = Field(default_factory=list, max_length=200)
    items: list[OrgItemModel] = Field(default_factory=list, max_length=1000)


# ---------------------------------------------------------------- plumbing

def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _parse(request: Request, raw: bytes, body_model: type[BaseModel], secret_fields: tuple[str, ...] = ()) -> tuple[Any, dict[str, Any]]:
    """(validated body, {secret field: value}). A secret (the alarm code) is taken out BEFORE validation."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict):
        raise ApiError(422, "validation", "גוף הבקשה חייב להיות אובייקט JSON.", details={"fields": ["body"]})
    secrets_ = {k: data.pop(k) for k in secret_fields if k in data}
    try:
        body = body_model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None
    return body, secrets_


def _code_ok(value: Any) -> Any:
    """The alarm code as typed: a string of the alarm section's length, else a wrong code (never echoed)."""
    if value is None or value == "":
        return None
    if not isinstance(value, str) or len(value) > 32:
        raise ApiError(403, "wrong_code", "קוד שגוי.")
    return value


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _bind(request: Request) -> None:
    store.MIRROR.bind(request.app.state.db, settings_of(request))


def _viewer(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """The permission before anything else: schedule.view or schedule.manage somewhere (the audited 403)."""
    _bind(request)
    view.require_view(conn, principal)
    return principal


def _manager(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """The permission before the body: schedule.manage somewhere (the audited 403), before anything the caller sent is read."""
    _bind(request)
    if view.MANAGE not in set(view.permissions_anywhere(conn, principal)):
        require(conn, principal, view.MANAGE, INSTALLATION)
    return principal


def _check_viewer(conn: sqlite3.Connection, principal: Principal) -> None:
    view.require_view(conn, principal)


def _check_manager(conn: sqlite3.Connection, principal: Principal) -> None:
    if view.MANAGE not in set(view.permissions_anywhere(conn, principal)):
        require(conn, principal, view.MANAGE, INSTALLATION)


# The same two permission checks on the READ connection, for the routes that read a body (auth.read_gate): the audited 403
# comes before the body is read and the write lock opens only after the body has arrived.
_viewer_gate = read_gate(_check_viewer)
_manager_gate = read_gate(_check_manager)


def _ctx(request: Request, conn: sqlite3.Connection, principal: Principal, *, sync: bool = True) -> view.Ctx:
    if sync:
        store.MIRROR.ensure(conn)
    return view.Ctx(conn, principal)


def _writer(request: Request, conn: sqlite3.Connection, principal: Principal) -> ops.W:
    _bind(request)
    return ops.W(conn, principal, settings_of(request), _rid(request))


def _reply(result: tuple[int, dict[str, Any]]) -> JSONResponse:
    return JSONResponse(status_code=result[0], content=result[1])


def _feature_or_409(ctx: view.Ctx) -> None:
    if ctx.cfg["schedules.enabled"] != "true":
        raise ApiError(409, "feature_disabled", "התזמונים כבויים בהגדרות המערכת.")


# ---------------------------------------------------------------- reads

@router.get("/schedules/status")
def schedules_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 - never 403: a caller without view gets `can.view = false` and zero counts."""
    _bind(request)
    a = view.Access(conn, principal)
    if a.anywhere(view.VIEW) or a.anywhere(view.MANAGE):
        store.MIRROR.ensure(conn)
    return view.status_payload(conn, principal)


@router.get("/schedules")
def list_schedules(
    request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn),
    q: str | None = Query(None, max_length=80), floor: str | None = Query(None, max_length=100), area: str | None = Query(None, max_length=100),
    entity: str | None = Query(None, max_length=120), condition: str | None = Query(None, max_length=120), has_conditions: bool | None = None,
    preset: Literal["only_holy_days", "not_holy_days"] | None = None, day: DAY | None = None,
    state: Literal["enabled", "disabled", "triggered", "completed", "unavailable"] | None = None, tag: str | None = Query(None, max_length=40),
    folder: str | None = Query(None, max_length=40), source: Literal["arx", "external"] | None = None, sensitive: bool | None = None, editable: bool | None = None,
    sort: Literal["next_run", "name", "order", "updated"] = "next_run", limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """§3.2 - visibility is applied before filters, totals and pagination."""
    ctx = _ctx(request, conn, principal)
    filters = {"q": q, "floor": floor, "area": area, "entity": entity, "condition": condition, "has_conditions": has_conditions, "preset": preset, "day": day, "state": state,
               "tag": tag, "folder": folder, "source": source, "sensitive": sensitive, "editable": editable}
    return view.list_payload(ctx, filters, sort, limit, offset)


@router.get("/schedules/catalog")
def catalog(request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn), q: str | None = Query(None, max_length=80),
            floor: str | None = Query(None, max_length=100), area: str | None = Query(None, max_length=100), cls: str | None = Query(None, alias="class", pattern="^(light|switch|cover|climate|fan|alarm|lock|door)$")) -> dict[str, Any]:
    """§3.4 - the editor's action-entity picker (one server-side source of classes, allow-list and door / alarm rules)."""
    ctx = _ctx(request, conn, principal, sync=False)
    _feature_or_409(ctx)
    return view.catalog_payload(ctx, q, floor, area, cls)


@router.get("/schedules/condition-candidates")
def condition_candidates(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), q: str | None = Query(None, max_length=80),
                         domain: Literal["binary_sensor", "sensor", "sun", "input_boolean"] | None = None) -> dict[str, Any]:
    """§3.4b - entities usable in conditions: manage anywhere, or system.configure (the Shabbat-sensor picker)."""
    _bind(request)
    a = view.Access(conn, principal)
    if not a.anywhere(view.MANAGE) and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        require(conn, principal, view.MANAGE, INSTALLATION)
    ctx = view.Ctx(conn, principal)
    return view.candidates_payload(ctx, q, domain)


@router.post("/schedules/preview")
def preview(request: Request, principal: Principal = Depends(_viewer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.5 - always 200 for a well-formed body; problems are data."""
    body, _ = _parse(request, raw, PreviewBody)
    w = _writer(request, conn, principal)
    return ops.preview(w, body.draft.model_dump(), body.schedule_id, body.count)


# ---------------------------------------------------------------- writes: create, trash, bulk, organisation (static paths first)

@router.post("/schedules")
def create_schedule(request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, CreateBody, ("alarm_code",))
    code = _code_ok(secret.get("alarm_code"))
    return _reply(ops.create(_writer(request, conn, principal), body.draft.model_dump(), body.enabled, body.client_request_id, body.confirm_lowering, code))


@router.get("/schedules/trash")
def list_trash(request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.13 - the 30-day trash the caller may see (the snapshot's action entities follow the same visibility rule)."""
    return ops.trash_list(_writer(request, conn, principal))


@router.post("/schedules/trash/{trash_id}/restore")
def restore_trash(trash_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, RestoreBody, ("alarm_code",))
    code = _code_ok(secret.get("alarm_code"))
    return _reply(ops.restore(_writer(request, conn, principal), trash_id, body.client_request_id, body.confirm_lowering, code))


@router.post("/schedules/trash/{trash_id}/purge")
def purge_trash(trash_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body, _ = _parse(request, raw, PurgeBody)
    return ops.purge(_writer(request, conn, principal), trash_id, body.confirm)


@router.post("/schedules/bulk")
def bulk_schedules(request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body, _ = _parse(request, raw, BulkBody)
    return ops.bulk(_writer(request, conn, principal), body.op, body.ids, body.confirm, body.client_request_id)


@router.get("/schedules/organisation")
def get_organisation(request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.15 - folders, order and pins of the visible schedules (Arx only)."""
    _ctx(request, conn, principal)
    return ops.org_get(_writer(request, conn, principal))


@router.put("/schedules/organisation")
def put_organisation(request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body, _ = _parse(request, raw, OrgBody)
    return ops.org_put(_writer(request, conn, principal), [f.model_dump() for f in body.folders], [i.model_dump() for i in body.items])


@router.get("/schedules/runs")
def list_runs(request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn), schedule_id: str | None = Query(None, max_length=64),
              since: str | None = Query(None, max_length=40), result: Literal["pending", "confirmed", "not_confirmed", "skipped", "unknown"] | None = None,
              limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    """§3.16 - derived activity (best effort, §6.6); the wording is never "failed"."""
    ctx = _ctx(request, conn, principal)
    store.settle_runs(conn, store.MIRROR.now())
    return view.runs_payload(ctx, schedule_id, since, result, limit)


@router.get("/schedules/review")
def review(request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.17 - the administrator's review list (installation-wide schedule.manage)."""
    ctx = _ctx(request, conn, principal)
    if not ctx.access.wide(view.MANAGE):
        require(conn, principal, view.MANAGE, INSTALLATION)
    rows, _ = view.visible_rows(ctx)
    return {"items": view.review_items(ctx, rows)}


@router.get("/schedules/tags")
def list_tags(request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.18 - tags on the visible schedules."""
    return view.tags_payload(_ctx(request, conn, principal))


# ---------------------------------------------------------------- one schedule

@router.get("/schedules/{schedule_id}")
def get_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.3 - with `raw`. Invisible or unknown is 404 `schedule_not_found`."""
    ctx = _ctx(request, conn, principal)
    row = store.cache_row(conn, schedule_id) if view.cache_shown(ctx) else None
    core = model.normalize(store.item_of(row)) if row is not None else None
    if row is None or core is None:
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    ctx.preload(model.action_entities(core) + [c["entity_id"] for c in core["conditions"]["items"] if c["entity_id"]] + ["sun.sun"] + ([ctx.shabbat_sensor] if ctx.shabbat_sensor else []))
    if not view.is_visible(ctx, core):
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    meta = store.meta_rows(conn).get(schedule_id)
    runs = view.last_runs(conn, [schedule_id])
    return view.build_schedule(ctx, row, meta, runs.get(schedule_id), detail=True)


@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, UpdateBody, ("alarm_code",))
    code = _code_ok(secret.get("alarm_code"))
    return _reply(ops.update(_writer(request, conn, principal), schedule_id, body.draft.model_dump(), body.base_revision, body.client_request_id, body.confirm_lowering, code))


@router.post("/schedules/{schedule_id}/enable")
def enable_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, ToggleBody, ("alarm_code",))
    return _reply(ops.set_enabled(_writer(request, conn, principal), schedule_id, True, body.client_request_id, body.confirm_lowering, _code_ok(secret.get("alarm_code"))))


@router.post("/schedules/{schedule_id}/disable")
def disable_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, ToggleBody, ("alarm_code",))
    return _reply(ops.set_enabled(_writer(request, conn, principal), schedule_id, False, body.client_request_id, body.confirm_lowering, _code_ok(secret.get("alarm_code"))))


@router.post("/schedules/{schedule_id}/run")
def run_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, RunBody, ("alarm_code",))
    return _reply(ops.run(_writer(request, conn, principal), schedule_id, body.slot_index, body.skip_conditions, body.confirm, body.client_request_id, _code_ok(secret.get("alarm_code"))))


@router.post("/schedules/{schedule_id}/split")
def split_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, SplitBody, ("alarm_code",))
    return _reply(ops.split(_writer(request, conn, principal), schedule_id, body.base_revision, list(body.days), body.name, body.confirm, body.client_request_id, body.confirm_lowering, _code_ok(secret.get("alarm_code"))))


@router.post("/schedules/{schedule_id}/delete")
def delete_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, _ = _parse(request, raw, DeleteBody)
    return _reply(ops.delete(_writer(request, conn, principal), schedule_id, body.base_revision, body.confirm, body.client_request_id))


@router.post("/schedules/{schedule_id}/copy")
def copy_schedule(schedule_id: str, request: Request, principal: Principal = Depends(_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body, secret = _parse(request, raw, CopyBody, ("alarm_code",))
    return _reply(ops.copy(_writer(request, conn, principal), schedule_id, body.name, body.client_request_id, body.confirm_lowering, _code_ok(secret.get("alarm_code"))))
