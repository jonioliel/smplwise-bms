"""KAV079-295: the routes of the editors' extension (services/automation_ext.py). Additive; every route answers 409 `feature_disabled` (or an
empty answer for the list's summary) while its switch in הגדרות › אוטומציות is off.

  GET  /automations-ext/conflicts                          per visible item, how many possible conflicts (the list's filter and chips)
  POST /automations-ext/conflicts                          the conflicts of one draft (an automation or a schedule) - data, never a write
  GET  /automations-ext/wall-buttons                       the wall-button devices of the caller's reach (the picker)
  GET  /automations-ext/wall-buttons/{device_id}           one device's buttons and presses, and which presses other items use
  POST /automations-ext/wall-buttons/{device_id}/detect    wait for one real press (a time-limited subscription, never a write)
  POST /automations-ext/automation/{item_id}/device-test   the on-device test plan (the item's editor AND runner only: owner answer 360)
  POST /automations-ext/schedule/{schedule_id}/device-test the same plan for a schedule's draft (KAVDEVTEST-295; the schedule manager only)
  POST /automations-ext/device-test/restore                the device actions that put a snapshot back (sent by the client through the
                                                           ordinary device-control route, with its own permission and confirmation rules)

The prefix is `/automations-ext/` (not `/automations/...`) so no path can be read as `/automations/{kind}/{id}`. The permission comes before the
body; JSON only, closed bodies."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import automation_ext as ext
from ..services import automation_scope as scope
from ..services import automation_transport as tr
from ..services import automation_view as view
from ..services import automations as store

router = APIRouter()

DEVICE_ID = Path(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.:-]+$")
SCHEDULE_PERMS = ("schedule.view", "schedule.manage")


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConflictsBody(_Body):
    source: Literal["automation", "schedule"]
    id: str | None = Field(default=None, max_length=120)
    draft: dict[str, Any]


class TestBody(_Body):
    draft: dict[str, Any] | None = None  # an unsaved edit of the item (the steps are read from it; the item's rights still decide)


class RestoreBody(_Body):
    snapshot: list[dict[str, Any]] = Field(max_length=60)


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> Any:
    media = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if media != "application/json":
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    if not isinstance(data, dict):
        raise ApiError(422, "validation", "גוף הבקשה חייב להיות אובייקט JSON.", details={"fields": ["body"]})
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


async def _raw(request: Request) -> bytes:
    return await request.body()


def _ctx(request: Request, conn: sqlite3.Connection, principal: Principal) -> scope.Ctx:
    store.MIRROR.bind(request.app.state.db, settings_of(request))
    store.MIRROR.ensure(conn)
    return scope.Ctx(conn, principal)


def _require_any(conn: sqlite3.Connection, principal: Principal, perms: tuple[str, ...]) -> None:
    a = scope.Access(conn, principal)
    if not a.any_of(perms):
        require(conn, principal, perms[0], INSTALLATION)  # the audited 403


def _manage(conn: sqlite3.Connection, principal: Principal) -> None:
    _require_any(conn, principal, (scope.MANAGE,))


def _flag(ctx: scope.Ctx, key: str) -> None:
    if ctx.cfg.get(key) != "true":
        raise ApiError(409, "feature_disabled", "האפשרות כבויה בהגדרות › אוטומציות.")


# ---------------------------------------------------------------- conflicts

@router.get("/automations-ext/conflicts")
def conflict_summary(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_any(conn, principal, (scope.MANAGE, *SCHEDULE_PERMS))
    ctx = _ctx(request, conn, principal)
    if not ext.precheck_on(ctx.cfg):
        return {"enabled": False, "window_min": None, "items": []}
    return {"enabled": True, **ext.conflict_summary(ctx)}


@router.post("/automations-ext/conflicts")
def conflicts(request: Request, raw: bytes = Depends(_raw), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _require_any(conn, principal, (scope.MANAGE, *SCHEDULE_PERMS))
    body = _parse(request, raw, ConflictsBody)
    if body.source == "automation":
        _manage(conn, principal)
    else:
        _require_any(conn, principal, SCHEDULE_PERMS)
    ctx = _ctx(request, conn, principal)
    dev = {"device_test": ext.flags(ctx.cfg)["device_test"], "device_test_end": ext.flags(ctx.cfg)["device_test_end"]}
    if not ext.precheck_on(ctx.cfg):
        return {"enabled": False, "conflicts": [], **dev}
    try:
        rows = ext.conflicts_for(ctx, body.source, body.id, body.draft)
    except (KeyError, TypeError, ValueError, AttributeError):
        raise ApiError(422, "validation", "הטיוטה אינה שלמה או אינה תקינה.", details={"fields": ["draft"]}) from None
    f = ext.flags(ctx.cfg)
    return {"enabled": True, "window_min": f["conflict_window_min"], "save_with_warnings": f["save_with_warnings"], "conflicts": rows, **dev}


# ---------------------------------------------------------------- wall buttons

def _list_triggers(device_id: str) -> list[Any] | None:
    """Home Assistant's own trigger list of the device (`device_automation/trigger/list`, read-only); None when it does not answer."""
    try:
        reply = tr.get_transport().ws("device_automation/trigger/list", device_id=device_id)
    except ApiError:
        return None
    if not isinstance(reply, dict) or not reply.get("success") or not isinstance(reply.get("result"), list):
        return None
    return reply["result"]


def _device_or_404(ctx: scope.Ctx, device_id: str) -> None:
    row = ctx.conn.execute("SELECT 1 FROM ha_devices WHERE device_id = ? AND removed_at IS NULL", (device_id,)).fetchone()
    if row is None or not ext.device_reachable(ctx, device_id):
        raise ApiError(404, "device_not_found", "המפסק לא נמצא.")


@router.get("/automations-ext/wall-buttons")
def wall_devices(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    ctx = _ctx(request, conn, principal)
    _flag(ctx, "automations.wall_buttons_editable")
    return {"devices": ext.wall_devices(ctx), "timing": ext.flags(ctx.cfg)["wall_timing"]}


@router.get("/automations-ext/wall-buttons/{device_id}")
def device_buttons(request: Request, device_id: str = DEVICE_ID, item_id: str | None = Query(None, max_length=120),
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    ctx = _ctx(request, conn, principal)
    _flag(ctx, "automations.wall_buttons_editable")
    _device_or_404(ctx, device_id)
    return ext.device_buttons(ctx, device_id, item_id, _list_triggers)


@router.post("/automations-ext/wall-buttons/{device_id}/detect")
def detect(request: Request, device_id: str = DEVICE_ID, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    ctx = _ctx(request, conn, principal)
    _flag(ctx, "automations.wall_buttons_editable")
    _device_or_404(ctx, device_id)
    info = ext.device_buttons(ctx, device_id, None, _list_triggers)
    if not info["buttons"]:
        raise ApiError(409, "no_buttons", "לא נמצאו כפתורים במפסק.")
    out = ext.detect_press(ctx, device_id, info["buttons"])
    audit(conn, actor=principal, action="automation.button_detect", decision="allowed", resource_type="ha_device", resource_id=device_id,
          request_id=getattr(request.state, "correlation_id", None), details={"detected": out["detected"]})
    return out


# ---------------------------------------------------------------- the on-device test

@router.post("/automations-ext/automation/{item_id}/device-test")
def device_test(request: Request, item_id: str = Path(min_length=1, max_length=120), raw: bytes = Depends(_raw), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    body = _parse(request, raw, TestBody) if raw.strip() else TestBody()
    ctx = _ctx(request, conn, principal)
    _flag(ctx, "automations.device_test_enabled")
    row, rd, facts = view.get_item(ctx, "automation", item_id)  # invisible / unknown: 404 item_not_found
    item = view.build_item(ctx, view.Env(ctx), row, rd=rd, facts=facts)
    if not (item["can"]["edit"] and item["can"]["run"]):  # owner answer 360: whoever may edit AND run it manually; no new permission
        audit(conn, actor=principal, action="automation.device_test", decision="denied", resource_type="automation", resource_id=item_id, reason="not_editor_and_runner",
              request_id=getattr(request.state, "correlation_id", None))
        raise ApiError(403, "forbidden", "אין הרשאה לפעולה זו בהיקף המבוקש.")
    draft = rd["draft"] if rd is not None else {"triggers": [], "conditions": [], "actions": []}
    if body.draft is not None:
        try:
            from ..services import automation_draft as drafts

            san = drafts.sanitise("automation", body.draft, draft, ctx.model_ctx(code_view=False, scoped=False))
            draft = san.draft
        except (KeyError, TypeError, ValueError, AttributeError, IndexError, RecursionError):
            raise ApiError(422, "validation", "הטיוטה אינה שלמה או אינה תקינה.", details={"fields": ["draft"]}) from None
    plan = ext.test_plan(ctx, draft)
    audit(conn, actor=principal, action="automation.device_test", decision="allowed", resource_type="automation", resource_id=item_id,
          request_id=getattr(request.state, "correlation_id", None), details={"steps": len(plan["steps"])})
    return plan


@router.post("/automations-ext/schedule/{schedule_id}/device-test")
def schedule_device_test(request: Request, schedule_id: str = Path(min_length=1, max_length=120), raw: bytes = Depends(_raw), principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """KAVDEVTEST-295: the on-device test plan of a schedule (the draft in the body, else the stored one). A PLAN only: the client runs each step
    through the device-control route, one click per step. The caller must manage schedules (the right the schedule's own run-now needs)."""
    _require_any(conn, principal, ("schedule.manage",))
    body = _parse(request, raw, TestBody)
    ctx = _ctx(request, conn, principal)
    _flag(ctx, "automations.device_test_enabled")
    from ..services import schedule_model as smodel
    from ..services import schedule_view as sview
    from ..services import schedules as sstore

    sctx = sview.Ctx(conn, principal)
    row = sstore.cache_row(conn, schedule_id) if sview.cache_shown(sctx) else None
    core = smodel.normalize(sstore.item_of(row)) if row is not None else None
    if core is not None:
        sctx.preload(smodel.action_entities(core))
    if row is None or core is None or not sview.is_visible(sctx, core):
        audit(conn, actor=principal, action="schedule.device_test", decision="denied", resource_type="schedule", resource_id=schedule_id, reason="not_found_or_invisible",
              request_id=getattr(request.state, "correlation_id", None))
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    draft = body.draft if body.draft is not None else {"weekdays": core["weekdays"], "slots": [
        {"start": (s["start"] or {}).get("raw") or (s["start"] or {}).get("time"), "stop": None,
         "actions": [{"service": a["service"], "entity_id": a["entity_id"], "data": a["data"]} for a in s["actions"]]} for s in core["slots"]]}
    try:
        plan = ext.schedule_test_plan(ctx, draft, lambda e: sctx.access.allowed(sview.MANAGE, e))
    except (KeyError, TypeError, ValueError, AttributeError, IndexError, RecursionError):
        raise ApiError(422, "validation", "הטיוטה אינה שלמה או אינה תקינה.", details={"fields": ["draft"]}) from None
    audit(conn, actor=principal, action="schedule.device_test", decision="allowed", resource_type="schedule", resource_id=schedule_id,
          request_id=getattr(request.state, "correlation_id", None), details={"steps": len(plan["steps"]), "testable": sum(1 for x in plan["steps"] if x["entity_ids"])})
    return plan


@router.post("/automations-ext/device-test/restore")
def device_test_restore(request: Request, raw: bytes = Depends(_raw), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    body = _parse(request, raw, RestoreBody)
    ctx = _ctx(request, conn, principal)
    _flag(ctx, "automations.device_test_enabled")
    return {"actions": ext.restore_plan(ctx, body.snapshot)}
