"""The automations API (CR-017, "אוטומציות · סצנות · סקריפטים"): automations, scripts and scenes of Home Assistant, read from a mirror and changed only through the
bridge. docs/architecture/AUTOMATIONS_API.md is the contract (section numbers in the comments below).

Reads: `GET /automations/status` (never 403), `/automations`, `/automations/{kind}/{id}`, `/automations/catalog`, `/automations/templates`, `/automations/trash`,
`/automations/review`, `/automations/{kind}/{id}/runs[/{run_id}]`, `/versions`. Writes: `POST /automations/{kind}` (create), `PUT /automations/{kind}/{id}` (and
`/code`), `POST .../delete|copy|enable|disable|run|stop|apply|dry-run`, the trash restore / purge, the version restore, `PUT .../meta`, and `POST /automations/preview`
and `/automations/scene/capture` (data, never a write).

The permission comes before the body; JSON only; static paths are declared before `/automations/{kind}/{id}`. The work is in services/automation_view.py (what a
caller sees and may do), services/automation_ops.py (the writes), services/automation_runs.py (traces, review) and services/automations.py (the mirror)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import automation_ops as ops
from ..services import automation_policy as pol
from ..services import automation_runs as runs
from ..services import automation_scope as scope
from ..services import automation_view as view
from ..services import automations as store

router = APIRouter()

RID = Field(min_length=8, max_length=80)
Kind = Literal["automation", "script", "scene"]


# ---------------------------------------------------------------- bodies (closed: extra="forbid")

class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateBody(_Body):
    draft: dict[str, Any]
    enabled: bool = True
    confirm: bool = False
    client_request_id: str = RID


class UpdateBody(_Body):
    draft: dict[str, Any]
    base_revision: str = Field(min_length=1, max_length=64)
    confirm: bool = False
    client_request_id: str = RID


class CodeBody(_Body):
    config: dict[str, Any]
    base_revision: str = Field(min_length=1, max_length=64)
    confirm: bool = False
    client_request_id: str = RID


class DeleteBody(_Body):
    base_revision: str = Field(min_length=1, max_length=64)
    confirm: bool = False
    client_request_id: str = RID


class CopyBody(_Body):
    name: str = Field(min_length=1, max_length=120)
    client_request_id: str = RID


class ToggleBody(_Body):
    confirm: bool = False
    client_request_id: str = RID


class RunBody(_Body):
    skip_condition: bool = True
    confirm: bool = False
    client_request_id: str = RID


class ScriptRunBody(_Body):
    fields: dict[str, Any] = Field(default_factory=dict)
    confirm: bool = False
    client_request_id: str = RID


class StopBody(_Body):
    fields: dict[str, Any] = Field(default_factory=dict)  # the client sends `{fields: {}}` with every stop; nothing in it is used
    client_request_id: str = RID


class ApplyBody(_Body):
    confirm: bool = False
    client_request_id: str = RID


class CaptureBody(_Body):
    entity_ids: list[str] = Field(min_length=1, max_length=pol.CAPS["members_max"])


class PreviewBody(_Body):
    kind: Kind
    id: str | None = Field(default=None, max_length=120)
    draft: dict[str, Any] | None = None
    config: dict[str, Any] | None = None  # the code view's item JSON (exactly one of draft / config)


class DryRunBody(_Body):
    draft: dict[str, Any] | None = None  # an unsaved edit of the item: its conditions and effects are evaluated instead of the stored content


class RestoreBody(_Body):
    confirm: bool = False
    client_request_id: str = RID


class VersionRestoreBody(_Body):
    base_revision: str | None = Field(default=None, max_length=64)
    confirm: bool = False
    client_request_id: str = RID


class PurgeBody(_Body):
    confirm: bool = False


class MetaBody(_Body):
    pinned: bool | None = None
    favourite: bool | None = None
    hidden: bool | None = None


# ---------------------------------------------------------------- plumbing

def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _parse(request: Request, raw: bytes, body_model: type[BaseModel]) -> Any:
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict):
        raise ApiError(422, "validation", "גוף הבקשה חייב להיות אובייקט JSON.", details={"fields": ["body"]})
    try:
        return body_model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _bind(request: Request) -> None:
    store.MIRROR.bind(request.app.state.db, settings_of(request))


def _kind(value: str) -> str:
    if value not in pol.ITEM_KINDS:
        raise ApiError(404, "item_not_found", "הפריט לא נמצא.")
    return value


def _ctx(request: Request, conn: sqlite3.Connection, principal: Principal, *, sync: bool = True) -> scope.Ctx:
    if sync:
        store.MIRROR.ensure(conn)
    return scope.Ctx(conn, principal)


def _writer(request: Request, conn: sqlite3.Connection, principal: Principal) -> ops.W:
    _bind(request)
    return ops.W(conn, principal, settings_of(request), _rid(request))


def _reply(result: tuple[int, dict[str, Any]]) -> JSONResponse:
    return JSONResponse(status_code=result[0], content=result[1])


def _require_any(conn: sqlite3.Connection, principal: Principal, perms: tuple[str, ...], extra: tuple[str, ...] = ()) -> None:
    """The audited 403 unless the caller holds one of `perms` (or `extra`) somewhere."""
    a = scope.Access(conn, principal)
    if not a.any_of(perms + extra):
        require(conn, principal, perms[0], INSTALLATION)


def _view_gate_check(kind: str | None):
    def check(conn: sqlite3.Connection, principal: Principal) -> None:
        if kind is None:
            _require_any(conn, principal, (scope.MANAGE, scope.SCENE_MANAGE, scope.SCRIPT_RUN, scope.SCRIPT_MANAGE), ("ha.entity.control", "devices.control"))
        else:
            extra = ("ha.entity.control", "devices.control") if kind == "scene" else ()
            _require_any(conn, principal, scope.VIEW_PERMS[kind], extra)

    return check


def _viewer(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """The permission before anything else: some view right somewhere (the audited 403)."""
    _bind(request)
    _view_gate_check(None)(conn, principal)
    return principal


def _kind_viewer(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    _bind(request)
    kind = _kind(str(request.path_params.get("kind")))
    _view_gate_check(kind)(conn, principal)
    return principal


def _kind_viewer_gate(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """`_kind_viewer` for the routes that read their body themselves: the view permission of the PATH's kind is checked on a
    read connection BEFORE the body is read, so a slow client never holds SQLite's write lock (review L7)."""
    _bind(request)
    kind = _kind(str(request.path_params.get("kind")))
    _view_gate_check(kind)(conn, principal)
    return principal


def _manage_check_for(kind: str, conn: sqlite3.Connection, principal: Principal) -> None:
    _require_any(conn, principal, (scope.MANAGE_OF[kind],))


def _kind_manager_gate(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """The manage permission of the PATH's kind before the body is read (a refusal is audited aside)."""
    kind = _kind(str(request.path_params.get("kind")))
    _manage_check_for(kind, conn, principal)
    return principal


def _fixed_gate(perms: tuple[str, ...], extra: tuple[str, ...] = ()):
    def gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
        _require_any(conn, principal, perms, extra)
        return principal

    return gate


_auto_gate = _fixed_gate((scope.MANAGE,))
_script_run_gate = _fixed_gate((scope.SCRIPT_RUN, scope.SCRIPT_MANAGE))
_scene_gate = _fixed_gate((scope.SCENE_MANAGE,), ("ha.entity.control", "devices.control"))
_view_any_gate = _fixed_gate((scope.MANAGE, scope.SCENE_MANAGE, scope.SCRIPT_RUN, scope.SCRIPT_MANAGE), ("ha.entity.control", "devices.control"))
_scene_manage_gate = _fixed_gate((scope.SCENE_MANAGE,))
_authoring_gate = _fixed_gate((scope.MANAGE, scope.SCENE_MANAGE, scope.SCRIPT_MANAGE))


# ---------------------------------------------------------------- reads

@router.get("/automations/status")
def automations_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 1 - never 403: a caller who may see nothing of the area gets `can.view = false` and zero counts; one who only runs scripts / activates scenes gets those
    counts and capabilities alone (no automation count, no name)."""
    _bind(request)
    a = scope.Access(conn, principal)
    if a.any_of((scope.MANAGE, scope.SCENE_MANAGE, scope.SCRIPT_RUN, scope.SCRIPT_MANAGE, "ha.entity.control", "devices.control")):
        store.MIRROR.ensure(conn)
    return view.status_payload(conn, principal)


@router.get("/automations/catalog")
def catalog(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), q: str | None = Query(None, max_length=80),
            floor: str | None = Query(None, max_length=100), area: str | None = Query(None, max_length=100), cls: str | None = Query(None, alias="class", max_length=30)) -> dict[str, Any]:
    """§3.1 row 4 - the editor's pickers: the pickable entities of the caller's reach, the closed service table with argument specs, notify targets, scenes, scripts."""
    _bind(request)
    _require_any(conn, principal, (scope.MANAGE, scope.SCENE_MANAGE, scope.SCRIPT_MANAGE))
    ctx = _ctx(request, conn, principal)
    if ctx.cfg["automations.enabled"] != "true":
        raise ApiError(409, "feature_disabled", "האוטומציות כבויות בהגדרות המערכת.")
    return view.catalog_payload(ctx, q, floor, area, cls)


@router.get("/automations/templates")
def templates(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 5 - the gallery (manage)."""
    _bind(request)
    _require_any(conn, principal, (scope.MANAGE,))
    return view.templates_payload(_ctx(request, conn, principal, sync=False))


@router.get("/automations/trash")
def list_trash(request: Request, principal: Principal = Depends(_authoring_gate), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 20 - the trash the caller may see (30 days, setting `automations.trash_days`)."""
    return ops.trash_list(_writer(request, conn, principal))


@router.post("/automations/trash/{trash_id}/restore")
def restore_trash(trash_id: str, request: Request, principal: Principal = Depends(_authoring_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, RestoreBody)
    return _reply(ops.restore_trash(_writer(request, conn, principal), trash_id, body.client_request_id, body.confirm))


@router.post("/automations/trash/{trash_id}/purge")
def purge_trash(trash_id: str, request: Request, principal: Principal = Depends(_authoring_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = _parse(request, raw, PurgeBody)
    return ops.purge_trash(_writer(request, conn, principal), trash_id, body.confirm)


@router.get("/automations/review")
def review(request: Request, principal: Principal = Depends(_auto_gate), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 22 - the administrator's review list (installation-wide automation.manage)."""
    return runs.review(_ctx(request, conn, principal))


@router.post("/automations/preview")
def preview(request: Request, principal: Principal = Depends(_view_any_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 6 - always 200 for a well-formed body; problems are data."""
    body = _parse(request, raw, PreviewBody)
    # contract §3.1 row 6: the kind's MANAGE permission (an automation: automation.manage - no view-only access). A script runner or a caller who only
    # activates scenes has no editor, so a preview (which reads the stored item behind `id`) is not theirs either (security review 2026-10-02).
    _manage_check_for(body.kind, conn, principal)
    if (body.draft is None) == (body.config is None):
        raise ApiError(422, "validation", "יש לשלוח draft או config (בדיוק אחד).", details={"fields": ["draft", "config"]})
    w = _writer(request, conn, principal)
    store.MIRROR.ensure(conn)
    return ops.preview(w, body.kind, body.id, body.draft, body.config)


@router.post("/automations/scene/capture")
def capture_scene(request: Request, principal: Principal = Depends(_scene_manage_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 16 - the members of the selected entities as their states are now (no write): scene.manage + control of each, the lock grants for a lock."""
    body = _parse(request, raw, CaptureBody)
    w = _writer(request, conn, principal)
    with w.audited("automation.capture", "scene"):
        w.feature_on()
        ctx = w.ctx
        ids = list(dict.fromkeys(body.entity_ids))
        ctx.preload(ids)
        for e in ids:
            info = ctx.entity(e)
            if info is None or not ctx.access.can_read_state(e):
                raise ApiError(422, "validation", f"ערך לא תקין — entity_ids: ההתקן {e} לא נמצא.", details={"path": e})
        members, skipped = view.capture(ctx, ids)
        taken = [m["entity_id"] for m in members]  # rights are asked of what is captured; a skipped entity (an alarm panel, a sensor ...) needs none
        steps = [{"path": "members", "action": "lock.unlock", "entity_id": e, "role": "device", "sens": "lock"} for e in taken if e.startswith("lock.")]
        for r in scope.control_reasons(ctx, taken) + scope.grant_reasons(ctx, steps):
            raise ops.reason_error(r)
        for e in taken:
            if not ctx.access.allowed(scope.SCENE_MANAGE, e):
                raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.", details={"entity_id": e})
        return {"members": members, "skipped": skipped}


@router.get("/automations")
def list_items(
    request: Request, principal: Principal = Depends(_viewer), conn: sqlite3.Connection = Depends(get_conn), kind: Kind | None = None, q: str | None = Query(None, max_length=80),
    floor: str | None = Query(None, max_length=100), area: str | None = Query(None, max_length=100), state: Literal["on", "off", "running", "unavailable", "invalid", "scene"] | None = None,
    sensitive: bool | None = None, source: Literal["ui", "yaml", "integration", "dynamic"] | None = None, mine: bool | None = None, label: str | None = Query(None, max_length=60),
    category: str | None = Query(None, max_length=60), sort: Literal["last_run", "name", "updated"] = "last_run", limit: int = Query(200, ge=1, le=view.LIST_LIMIT_MAX), offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """§3.1 row 2 - visibility is applied before filters, totals and pagination."""
    if kind is not None:
        _view_gate_check(kind)(conn, principal)  # `?kind=automation` without automation.manage is the 403 (a list without `kind` simply leaves automations out)
    ctx = _ctx(request, conn, principal)
    filters = {"kind": kind, "q": q, "floor": floor, "area": area, "state": state, "sensitive": sensitive, "source": source, "mine": mine, "label": label, "category": category}
    return view.list_payload(ctx, filters, sort, limit, offset)


@router.post("/automations/{kind}")
def create_item(kind: str, request: Request, principal: Principal = Depends(_kind_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """§3.1 row 7."""
    kind = _kind(kind)
    body = _parse(request, raw, CreateBody)
    return _reply(ops.create(_writer(request, conn, principal), kind, body.draft, body.enabled, body.confirm, body.client_request_id))


@router.get("/automations/{kind}/{item_id}")
def get_item(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 3 - the `ItemDetail`. Invisible or unknown is 404 `item_not_found`."""
    kind = _kind(kind)
    ctx = _ctx(request, conn, principal)
    row, rd, facts = view.get_item(ctx, kind, item_id)
    return view.detail_item(ctx, view.Env(ctx), row, rd, facts)


@router.put("/automations/{kind}/{item_id}/code")
def update_code(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """§3.1 row 9."""
    kind = _kind(kind)
    body = _parse(request, raw, CodeBody)
    return _reply(ops.update_code(_writer(request, conn, principal), kind, item_id, body.config, body.base_revision, body.confirm, body.client_request_id))


@router.put("/automations/{kind}/{item_id}/meta")
def put_meta(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_viewer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 21 - the caller's own pin / favourite; `hidden` (integration scenes) by an administrator."""
    kind = _kind(kind)
    body = _parse(request, raw, MetaBody)
    return ops.put_meta(_writer(request, conn, principal), kind, item_id, body.pinned, body.favourite, body.hidden)


@router.put("/automations/{kind}/{item_id}")
def update_item(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """§3.1 row 8."""
    kind = _kind(kind)
    body = _parse(request, raw, UpdateBody)
    return _reply(ops.update(_writer(request, conn, principal), kind, item_id, body.draft, body.base_revision, body.confirm, body.client_request_id))


@router.post("/automations/{kind}/{item_id}/delete")
def delete_item(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    kind = _kind(kind)
    body = _parse(request, raw, DeleteBody)
    return _reply(ops.delete(_writer(request, conn, principal), kind, item_id, body.base_revision, body.confirm, body.client_request_id))


@router.post("/automations/{kind}/{item_id}/copy")
def copy_item(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_manager_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    kind = _kind(kind)
    body = _parse(request, raw, CopyBody)
    return _reply(ops.copy_item(_writer(request, conn, principal), kind, item_id, body.name, body.client_request_id))


@router.post("/automations/{kind}/{item_id}/dry-run")
def dry_run(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_viewer_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 17 - no execution: the current truth of each typed condition from the mirror and the device diff. An optional body `{draft}` evaluates an unsaved
    edit of the item instead of the stored content."""
    kind = _kind(kind)
    body = _parse(request, raw, DryRunBody) if raw.strip() else DryRunBody()
    ctx = _ctx(request, conn, principal)
    row, rd, facts = view.get_item(ctx, kind, item_id)
    if body.draft is not None:
        _manage_check_for(kind, conn, principal)  # an unsaved edit is the editor's: a script runner / scene activator checks the stored item only (security review 2026-10-02)
        return view.dry_run_draft(ctx, row, rd, body.draft)
    return view.dry_run(ctx, row, rd, facts)


@router.post("/automations/automation/{item_id}/enable")
def enable_automation(item_id: str, request: Request, principal: Principal = Depends(_auto_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, ToggleBody)
    return _reply(ops.set_enabled(_writer(request, conn, principal), item_id, True, body.confirm, body.client_request_id))


@router.post("/automations/automation/{item_id}/disable")
def disable_automation(item_id: str, request: Request, principal: Principal = Depends(_auto_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, ToggleBody)
    return _reply(ops.set_enabled(_writer(request, conn, principal), item_id, False, body.confirm, body.client_request_id))


@router.post("/automations/automation/{item_id}/run")
def run_automation(item_id: str, request: Request, principal: Principal = Depends(_auto_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, RunBody)
    return _reply(ops.run_automation(_writer(request, conn, principal), item_id, body.skip_condition, body.confirm, body.client_request_id))


@router.post("/automations/script/{item_id}/run")
def run_script(item_id: str, request: Request, principal: Principal = Depends(_script_run_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, ScriptRunBody)
    return _reply(ops.run_script(_writer(request, conn, principal), item_id, body.fields, body.confirm, body.client_request_id))


@router.post("/automations/script/{item_id}/stop")
def stop_script(item_id: str, request: Request, principal: Principal = Depends(_script_run_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, StopBody)
    return _reply(ops.stop_script(_writer(request, conn, principal), item_id, body.client_request_id))


@router.post("/automations/scene/{item_id}/apply")
def apply_scene(item_id: str, request: Request, principal: Principal = Depends(_scene_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, ApplyBody)
    return _reply(ops.apply_scene(_writer(request, conn, principal), item_id, body.confirm, body.client_request_id))


@router.get("/automations/{kind}/{item_id}/runs")
def list_runs(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 18 - `RunSummary[]` from the stored traces."""
    return runs.runs_list(_ctx(request, conn, principal), _kind(kind), item_id)


@router.get("/automations/{kind}/{item_id}/runs/{run_id}")
def get_run(kind: str, item_id: str, run_id: str, request: Request, principal: Principal = Depends(_kind_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 18 - one `RunTrace`, complete (owner decision 9ג)."""
    return runs.run_detail(_ctx(request, conn, principal), _kind(kind), item_id, run_id)


@router.get("/automations/{kind}/{item_id}/versions")
def list_versions(kind: str, item_id: str, request: Request, principal: Principal = Depends(_kind_viewer), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """§3.1 row 19 - the history (last `automations.versions_keep`)."""
    return ops.versions_list(_writer(request, conn, principal), _kind(kind), item_id)


@router.post("/automations/{kind}/{item_id}/versions/{version_id}/restore")
def restore_version(kind: str, item_id: str, version_id: int, request: Request, principal: Principal = Depends(_kind_manager_gate), raw: bytes = Depends(_raw_body),
                    conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = _parse(request, raw, VersionRestoreBody)
    return _reply(ops.restore_version(_writer(request, conn, principal), _kind(kind), item_id, version_id, body.base_revision, body.confirm, body.client_request_id))
