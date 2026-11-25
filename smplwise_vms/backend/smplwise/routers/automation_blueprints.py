"""CR-BLUEPRINT80 slice 1: the ready-made automation templates ("תבניות חכמות"), backend only. docs/changes/CR-BLUEPRINT80.md is the contract.

- GET  /automation-blueprints/status            never 403: the module and the feature switch, what the caller may do
- GET  /automation-blueprints                   the built-in library (read-only), with parameter specs
- GET  /automation-blueprints/{id}
- POST /automation-blueprints/{id}/preview      {params, name?}: the draft the parameters stand for and what the save would say; nothing is written
- POST /automation-blueprints/{id}/instantiate  {params, name?, confirm?, client_request_id}: creates a DISABLED automation through the SAME create path as the
                                                editor (services/automation_ops.create): same permission, scope, sensitive grant, door-path guards, audit, rate limit

The feature is the setting `automations.blueprints_enabled` (OFF by default) on top of `automations.enabled`. A blueprint can never create an automation that
opens a door (services/automation_blueprints.py: a closed format, checked twice); those stay under routers/door_automations.py."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError, field_error, issue_problems
from ..rbac import Principal
from ..services import automation_blueprints as bps
from ..services import automation_blueprints_store as store
from ..services import automation_model as model
from ..services import automation_ops as ops
from ..services import automation_scope as scope
from ..services import default_names
from ..services import door_path
from . import automations as base
from ..wire import automation_blueprints as WM
from ..wire import wire

router = APIRouter()
RID = Field(min_length=8, max_length=80)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PreviewBody(_Body):
    params: dict[str, Any] = Field(default_factory=dict)
    name: str | None = Field(default=None, min_length=1, max_length=120)


class InstantiateBody(_Body):
    params: dict[str, Any] = Field(default_factory=dict)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    confirm: bool = False
    client_request_id: str = RID


class _Env(bps.Env):
    """The installation as the resolver sees it, for one caller (the scope Ctx of the editor itself: the same reach, the same classes)."""

    def __init__(self, ctx: scope.Ctx) -> None:
        self.ctx = ctx
        self.notify_targets = tuple(ctx.notify_targets)
        self._doorish: set[str] | None = None

    def entity(self, entity_id: str) -> dict[str, Any] | None:
        return self.ctx.entity(entity_id)

    def can_read(self, entity_id: str) -> bool:
        return self.ctx.access.can_read_state(entity_id)

    def sensitive(self, entity_id: str) -> bool:
        if self._doorish is None:
            self._doorish = set(self.ctx.door_layer()) | door_path.possible_door_entities(self.ctx.conn)
        domain = entity_id.split(".", 1)[0]
        return domain in bps.FORBIDDEN_DOMAINS or self.ctx.entity_class(entity_id) is not None or entity_id in self._doorish

    def area_entities(self, by: str, ident: str, domains: list[str]) -> list[str] | None:
        rows = store.area_entity_rows(self.ctx.conn, by, ident)
        if not rows:
            return None
        return [r["entity_id"] for r in rows if r["domain"] in domains]


def _gate(conn: sqlite3.Connection, principal: Principal) -> None:
    base._require_any(conn, principal, (scope.MANAGE,))


def _switches(w: ops.W) -> None:
    w.feature_on()
    if w.ctx.cfg["automations.blueprints_enabled"] != "true":
        raise ApiError(409, "blueprints_disabled", "תבניות חכמות כבויות בהגדרות המערכת.")


def _blueprint(blueprint_id: str) -> dict[str, Any]:
    bp = bps.get(blueprint_id)
    if bp is None:
        raise ApiError(404, "blueprint_not_found", "התבנית לא נמצאה.")
    return bp


def _problems(items: list[dict[str, str]]) -> ApiError:
    """Per-parameter refusals (`[{param, code, message}]`). ADR019-FAMILY678-2520: D1 `fields` / `problems` name the body's
    `params.<name>`; the list itself is still sent as `errors`."""
    return field_error("הפרמטרים אינם תקינים.", problems=issue_problems(items, key="param", prefix="params."), legacy={"errors": items})


def _expand(w: ops.W, bp: dict[str, Any], params: dict[str, Any], name: str | None) -> dict[str, Any]:
    """Parameters -> the draft of an automation (the shape the editor sends). Raises 422 with per-parameter errors."""
    env = _Env(w.ctx)
    values, problems = bps.resolve_params(bp, params, env)
    if problems:
        raise _problems(problems)
    config = bps.build_config(bp, values, name, lang=default_names.lang_of(w.conn, w.principal))  # I18N-EN-2490 (owner N53)
    forbidden = bps.check_config(config, env, env.notify_targets)
    if forbidden:
        raise _problems(forbidden)
    res = model.config_to_draft("automation", config, w.ctx.model_ctx(code_view=False, scoped=False))
    draft = res.draft
    if model.locked_count(draft) or res.extras:
        raise _problems([{"param": "", "code": "blueprint_not_expressible", "message": "התבנית אינה ניתנת להצגה בעורך עם הערכים שנבחרו."}])
    for wk in model.walk_draft(draft):
        wk.block["raw"] = None  # a new block: rebuilt from its typed fields, exactly like a draft built by hand
    return draft


@router.get("/automation-blueprints/status", **wire(WM.AutomationBlueprintsStatus))
def status(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Never 403: whether the module is on and whether the caller can use it."""
    base._bind(request)
    ctx = scope.Ctx(conn, principal)
    can = ctx.access.any_of((scope.MANAGE,))
    return {"module_on": ctx.cfg["automations.enabled"] == "true", "enabled": ctx.cfg["automations.blueprints_enabled"] == "true", "can_use": can,
            "schema": bps.SCHEMA_VERSION, "library_version": bps.LIBRARY_VERSION, "count": len(bps.LIBRARY), "import_export": False}


@router.get("/automation-blueprints", **wire(WM.AutomationBlueprintsBlueprints))
def list_blueprints(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    base._bind(request)
    _gate(conn, principal)
    _switches(base._writer(request, conn, principal))
    return {"blueprints": [bps.public_view(b) for b in bps.library()], "schema": bps.SCHEMA_VERSION, "library_version": bps.LIBRARY_VERSION}


@router.get("/automation-blueprints/{blueprint_id}", **wire(WM.AutomationBlueprintsOneBlueprint))
def one_blueprint(blueprint_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    base._bind(request)
    _gate(conn, principal)
    _switches(base._writer(request, conn, principal))
    return bps.public_view(_blueprint(blueprint_id))


@router.post("/automation-blueprints/{blueprint_id}/preview", **wire(WM.AutomationBlueprintsPreview))
def preview(blueprint_id: str, request: Request, principal: Principal = Depends(base._auto_gate), raw: bytes = Depends(base._raw_body),
            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body = base._parse(request, raw, PreviewBody)
    w = base._writer(request, conn, principal)
    _switches(w)
    bp = _blueprint(blueprint_id)
    ops.rate_limit(principal.user_id, "preview", w.ctx.limits["preview_per_min"])
    draft = _expand(w, bp, body.params, body.name)
    j = ops.judge(w, "automation", draft=draft, config_in=None, stored=None, item_id="blueprint_preview", creating=True)
    refusal: dict[str, str] | None = None
    if j.errors:
        refusal = {"code": j.errors[0]["code"], "message": j.errors[0]["message"]}
    else:
        try:
            ops._raise_judgement(w, "automation", j, True, creating=True)
        except ApiError as exc:
            refusal = {"code": exc.code, "message": exc.user_message}
    return base._out(conn, principal, {"blueprint": {"id": bp["id"], "version": bp["version"]}, "draft": draft, "sentence": (j.rd or {}).get("sentence"), "ok": refusal is None,
                                       "refusal": refusal, "sensitive": j.sensitive, "enabled_on_create": False})  # I18N-BACKEND-2490


@router.post("/automation-blueprints/{blueprint_id}/instantiate")
def instantiate(blueprint_id: str, request: Request, principal: Principal = Depends(base._auto_gate), raw: bytes = Depends(base._raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    body = base._parse(request, raw, InstantiateBody)
    w = base._bridge_writer(request, conn, principal)
    with w.audited("automation.blueprint.instantiate", "automation"):
        _switches(w)
        bp = _blueprint(blueprint_id)
        draft = _expand(w, bp, body.params, body.name)
    w.details.update(blueprint={"id": bp["id"], "version": bp["version"]})
    status_code, payload = ops.create(w, "automation", draft, False, body.confirm, body.client_request_id)
    payload = {**payload, "blueprint": {"id": bp["id"], "version": bp["version"]}}
    return JSONResponse(status_code=status_code, content=base._out(conn, principal, payload))
