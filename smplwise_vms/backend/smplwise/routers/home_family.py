"""HOME-V3-P2-2431: the home interface's family and building routes (services/home_family). All under /home/ (the home-only allowlist's
own prefix). Every route checks the module switch and the caller's own permission exactly as the module's own route does; the person's
home-interface categories (the administrator's page) hide a screen's routes too (403 `home_module_off`).

* `GET /home/family` - what the caller may see: each capability's switch and permissions, plus the person's home categories.
* `GET /home/presence`, `PUT /home/presence/me` - who is home; the caller hides / shows themself (owner decision round 27 q4).
* `GET /home/buses` - the nearby buses strip; `GET /home/weather` - now, the next hours and the next days.
* `GET /home/tickets` (only the tickets the caller OPENED - owner decision round 27 q8), `GET /home/tickets/{id}`, `POST /home/tickets`
  (the tickets module's own create), `POST /home/tickets/{id}/notes` (its own note).
* `GET /home/schedules`, `POST /home/schedules`, `POST /home/schedules/{id}/enable|disable|run` - scene schedules only (round 27 q10).
* `GET` / `PUT /home/notify` - what reaches the caller's own phones, and the caller's own "do not disturb" night window.

Calendar, booking and the notice board are the modules' own routes (allowlisted in services/home_interface.HOME_ALLOWED_PATTERNS).
"""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError, forbidden
from ..rbac import Principal
from ..services import home_family as hf
from ..services import home_interface as hi

router = APIRouter()
TICKET_ID = r"^[A-Za-z0-9_\-]{1,64}$"
SCHEDULE_ID = r"^[A-Za-z0-9_.:\-]{1,64}$"
RID = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_\-]{8,64}$")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _module(conn: sqlite3.Connection, principal: Principal, module: str) -> None:
    """The person's home categories (the administrator's page): a hidden category's routes answer 403 `home_module_off`."""
    mods = hi.effective(conn, principal.user_id)["modules"]
    if mods is not None and module not in mods:
        raise hf.HomeFamilyError(403, "home_module_off", "המסך הזה לא הופעל עבורך.")


def _off() -> ApiError:
    return ApiError(404, "feature_disabled", "המודול כבוי.")


# ---------------------------------------------------------------- what the caller may see

@router.get("/home/family")
def family(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Each family / building capability for the caller: its switch and the caller's own permissions, and the person's home categories."""
    pol = hi.effective(conn, principal.user_id)
    return {"features": hf.features(conn, principal), "modules": pol["modules"], "kiosk": pol["kiosk"]}


# ---------------------------------------------------------------- who is home

class HideBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hidden: bool


@router.get("/home/presence")
def presence(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Who of the household is home (presence.report anywhere: whoever takes part with a phone). Hidden people are never listed to others."""
    _module(conn, principal, "presence")
    if "presence.report" not in hf._anywhere(conn, principal):
        raise forbidden(permission="presence.report")
    return hf.presence_home(conn, principal)


@router.put("/home/presence/me")
def presence_me(body: HideBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The caller hides themself from (or shows themself to) the rest of the household - the full interface's own opt-out list. Hiding
    needs no permission (it only restricts); showing again needs presence.report. Nobody can set it for another person. Audited."""
    from ..services import presence as P

    if not body.hidden and "presence.report" not in hf._anywhere(conn, principal):
        raise forbidden(permission="presence.report")
    state = P.set_opt_out(conn, principal.user_id, body.hidden)
    audit(conn, actor=principal, action="presence.people.opt_out", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request),
          details={"opted_out": state, "via": "home"})
    return {"hidden": state}


# ---------------------------------------------------------------- buses and weather

@router.get("/home/buses")
def buses(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The nearby buses strip of the notice board screen (the transit module's own digest; `state: off` while it is off)."""
    _module(conn, principal, "notices")
    return hf.buses(conn)


@router.get("/home/weather")
def weather(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Outside now, the next hours and the next days (`weather: null` when the installation has no weather source)."""
    return {"weather": hf.weather(conn)}


# ---------------------------------------------------------------- service requests (only the caller's own)

STEP = {"new": 0, "returned": 0, "assigned": 1, "acknowledged": 1, "in_progress": 1, "waiting_part": 1, "done": 2, "closed": 2, "cancelled": 2}


def _viewer(conn: sqlite3.Connection, principal: Principal):
    from ..services.tickets import access

    if not access.module_on(conn):
        raise _off()
    _module(conn, principal, "tickets")
    return access.Viewer(conn, principal)


def _mine(viewer: Any, ticket_id: str):
    from ..services.tickets import access

    seen = access.visible_by_id(viewer, ticket_id)
    if seen is None or "creator" not in seen.reasons:
        raise ApiError(404, "not_found", "הפנייה לא נמצאה.")
    return seen


def _item(conn: sqlite3.Connection, seen: Any, lk: Any) -> dict[str, Any]:
    from ..services.tickets import present

    it = present.ticket_item(conn, seen, lk)
    keep = ("id", "number", "title", "excerpt", "status", "category", "place_text", "created_at", "last_activity_at", "eta_at", "waiting_on", "closed_at")
    out = {k: it.get(k) for k in keep}
    out["step"] = STEP.get(it["status"], 0)
    out["department"] = (it.get("department") or {}).get("name") if isinstance(it.get("department"), dict) else None
    return out


@router.get("/home/tickets")
def my_tickets(state: Literal["open", "all"] = "open", principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The tickets the caller OPENED (never one only assigned to them or one of the household's), newest activity first, and the
    categories the caller may open a new one in."""
    from ..services.tickets import access, present, store

    viewer = _viewer(conn, principal)
    if access.VIEW not in viewer.anywhere and access.CREATE not in viewer.anywhere:
        raise forbidden(permission=access.CREATE)
    items: list[dict[str, Any]] = []
    if access.VIEW in viewer.anywhere:
        statuses = store.STATUS_GROUPS["open"] if state == "open" else None
        seen, _next = access.visible_page(viewer, scope="mine", statuses=statuses, limit=access.PAGE_MAX)
        lk = present.Lookups(conn)
        items = [_item(conn, s, lk) for s in seen if "creator" in s.reasons]
    cats: list[dict[str, Any]] = []
    for d in store.departments(conn, include_inactive=False):
        if not viewer.can_create_in(d):
            continue
        sub = store.categories(conn, d["id"], include_inactive=False)
        cats += [{"department_id": d["id"], "category_id": c["id"], "name": c["name"]} for c in sub if not c.get("parent_id")]
        if not sub:
            cats.append({"department_id": d["id"], "category_id": None, "name": d["name"]})
    return {"items": items, "categories": cats[:24], "can_create": bool(cats), "can_view": access.VIEW in viewer.anywhere}


@router.get("/home/tickets/{ticket_id}")
def my_ticket(ticket_id: str = Path(..., pattern=TICKET_ID), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    from ..services.tickets import present

    viewer = _viewer(conn, principal)
    return {"ticket": _item(conn, _mine(viewer, ticket_id), present.Lookups(conn))}


class NewTicketBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department_id: str = Field(min_length=1, max_length=64, pattern=TICKET_ID)
    category_id: str | None = Field(default=None, max_length=64, pattern=TICKET_ID)
    title: str = Field(min_length=1, max_length=120)
    where: str = Field(default="", max_length=200)
    text: str = Field(default="", max_length=4000)
    client_request_id: str = RID


@router.post("/home/tickets", status_code=201)
def new_ticket(body: NewTicketBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Open a ticket: the tickets module's own create (POST /tickets: tickets.create, the department rule, the idempotent request id, its
    audit and notifications), with the place as free text."""
    from . import tickets as tr

    _viewer(conn, principal)
    out = tr.create_ticket(tr.CreateBody(department_id=body.department_id, category_id=body.category_id, title=body.title, description=body.text,
                                         place_text=body.where, client_request_id=body.client_request_id), request, principal, conn)
    return out


class NoteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=4000)


@router.post("/home/tickets/{ticket_id}/notes", status_code=201)
def my_ticket_note(body: NoteBody, request: Request, ticket_id: str = Path(..., pattern=TICKET_ID), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A note on the caller's own ticket (the module's own add_note: its rules, audit and notifications)."""
    from ..services.tickets import present, service

    viewer = _viewer(conn, principal)
    seen = _mine(viewer, ticket_id)
    service.add_note(conn, viewer, seen, body.text, False, _rid(request))
    return {"ticket": _item(conn, _mine(viewer, ticket_id), present.Lookups(conn))}


# ---------------------------------------------------------------- scene schedules

def _sched_ctx(request: Request, conn: sqlite3.Connection, principal: Principal):
    from ..services import schedule_view as view
    from ..services import schedules as store
    from . import schedules as sr

    _module(conn, principal, "schedules")
    sr._bind(request)
    view.require_view(conn, principal)
    store.MIRROR.ensure(conn)
    return view.Ctx(conn, principal)


def _scene_items(ctx: Any) -> list[dict[str, Any]]:
    from ..services import schedule_view as view

    f = dict.fromkeys(("q", "floor", "area", "entity", "condition", "has_conditions", "preset", "day", "state", "tag", "folder", "source", "sensitive", "editable"))
    items = view.list_payload(ctx, f, "next_run", 500, 0)["items"]
    out = []
    for s in items:
        scene = hf.is_scene_schedule(s)
        if scene is None:
            continue
        out.append({"id": s["id"], "name": s["display_name"] or s["name"], "enabled": bool(s["enabled"]), "scene": scene, "days": s["days"],
                    "slots": [{"start": sl["start"]} for sl in s["slots"]], "next_run": s.get("next_run"), "can": s.get("can") or {}, "state": s.get("state")})
    return out


@router.get("/home/schedules")
def scene_schedules(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The schedules the caller may see whose every action runs one scene (the home interface never shows a device schedule)."""
    from ..routers.settings import read_settings

    if read_settings(conn)["schedules.enabled"] != "true":
        raise _off()
    ctx = _sched_ctx(request, conn, principal)
    from ..services import schedule_view as view

    return {"items": _scene_items(ctx), "can_create": view.MANAGE in set(view.permissions_anywhere(conn, principal))}


class SceneScheduleBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=80)
    scene: str = Field(min_length=7, max_length=128)
    at: str = Field(min_length=5, max_length=5)
    days: list[Literal["sun", "mon", "tue", "wed", "thu", "fri", "sat"]] = Field(min_length=1, max_length=7)
    client_request_id: str = RID


@router.post("/home/schedules")
def new_scene_schedule(body: SceneScheduleBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """Create a schedule that runs ONE scene at a time on chosen days: the schedules module's own create (schedule.manage, the scene's
    control check, the local-identity rules, the bridge write and its audit)."""
    from ..services import schedule_ops as ops
    from . import schedules as sr

    _sched_ctx(request, conn, principal)
    sr._check_manager(conn, principal)
    draft = hf.scene_draft(body.name, body.scene, body.at, list(body.days))
    return sr._reply(ops.create(sr._bridge_writer(request, conn, principal), draft, True, body.client_request_id, False, None))


class SceneScheduleOpBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str = RID
    confirm: bool = False


@router.post("/home/schedules/{schedule_id}/{op}")
def scene_schedule_op(body: SceneScheduleOpBody, request: Request, schedule_id: str = Path(..., pattern=SCHEDULE_ID), op: Literal["enable", "disable", "run"] = Path(...),
                      principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> JSONResponse:
    """Pause, resume or run now one of the scene schedules the caller sees (the module's own operations; 404 for any other schedule)."""
    from ..services import schedule_ops as ops
    from . import schedules as sr

    ctx = _sched_ctx(request, conn, principal)
    sr._check_manager(conn, principal)
    if not any(s["id"] == schedule_id for s in _scene_items(ctx)):
        raise ApiError(404, "schedule_not_found", "התזמון לא נמצא.")
    w = sr._bridge_writer(request, conn, principal)
    if op == "run":
        return sr._reply(ops.run(w, schedule_id, None, False, body.confirm, body.client_request_id, None))
    return sr._reply(ops.set_enabled(w, schedule_id, op == "enable", body.client_request_id, False, None))


# ---------------------------------------------------------------- my notifications

class DndBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    start: str | None = Field(default=None, max_length=5)
    end: str | None = Field(default=None, max_length=5)


class NotifyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    muted: list[str] | None = Field(default=None, max_length=32)
    dnd: DndBody | None = None


@router.get("/home/notify")
def my_notify(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What reaches the caller's own phones (per category) and the caller's own night window."""
    return hf.notify_get(conn, principal)


@router.put("/home/notify")
def put_my_notify(body: NotifyBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mute / unmute categories on every one of the caller's own phones (a critical category is never muted) and set the night window.
    Only the caller's own rows. Audited (categories and times only)."""
    dnd = body.dnd.model_dump(exclude_none=True) if body.dnd is not None else None
    out = hf.notify_set(conn, principal, body.muted, dnd)
    audit(conn, actor=principal, action="home_interface.notify.set", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request),
          details={"muted": sorted(body.muted) if body.muted is not None else None, "dnd": dnd})
    return out
