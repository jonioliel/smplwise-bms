"""HOME-SIMPLE-2420: the home interface's API (services/home_interface).

* `GET /home/interface` - the caller's effective interface policy (also in `GET /me` as `interface`).
* `PUT /me/interface` - the caller's own switch between the home and the full interface (refused when the policy locks it).
* `GET /home/overview` - the rooms of the home interface: floors -> rooms with their lights, on/off switches, climate, shutters and
  locks, projected from the same visible entity set and the same `can_control` as the devices routes (services/devices), filtered to
  the rooms and categories the administrator chose for this person. Read-only; every control still goes through the existing routes
  (POST /ha/entities/{id}/actions, the bulk routes, the scene apply route, the intercom release route).
* `GET` / `PUT /home/prefs` - the caller's own favourites and layout (another person's are never read or written here).
* `GET /home/policies`, `PUT /home/policies/{user_id}`, `PUT /home/seed`, `PUT /home/kiosk-code` - the administrator's page
  (`rbac.assign` installation-wide: the permission that assigns roles), every change audited.
* `POST /home/kiosk/exit` - the wall panel's exit code check (rate limited, audited).
"""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..rbac import INSTALLATION, Principal, require
from ..services import devices as svc
from ..services import ha_scope
from ..services import home_interface as hi

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/home/interface")
def my_interface(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's interface policy: which interface opens, whether they may switch, home-only / wall-panel lock, rooms and categories."""
    return hi.effective(conn, principal.user_id)


class InterfaceBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    interface: Literal["home", "full"]


@router.put("/me/interface")
def switch_interface(body: InterfaceBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The caller switches between the home and the full interface (the personal menu); 403 interface_locked when the policy says no."""
    try:
        out = hi.set_current(conn, principal.user_id, body.interface)
    except hi.HomeInterfaceError as exc:
        if exc.status == 403:
            audit(conn, actor=principal, action="home_interface.switch", decision="denied", resource_type="user", resource_id=principal.user_id, reason=exc.code,
                  request_id=_rid(request), details={"interface": body.interface})
        raise
    return out


# ---------------------------------------------------------------- the rooms

LIGHT_FIELDS = ("entity_id", "name", "domain", "state", "available", "active", "can_control", "brightness_pct", "dimmable")
CLIMATE_FIELDS = ("entity_id", "name", "domain", "state", "available", "active", "can_control", "climate_kind", "hvac_mode", "hvac_modes", "hvac_action",
                  "current_temperature", "target_temperature", "min_temp", "max_temp", "target_temp_step", "preset_mode", "preset_modes", "unit")
COVER_FIELDS = ("entity_id", "name", "domain", "state", "available", "active", "can_control", "position", "moving")
LOCK_FIELDS = ("entity_id", "name", "domain", "state", "available", "active", "can_control", "locked", "wiskey_door")


def _pick(row: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
    return {k: row.get(k) for k in fields}


def build_overview(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    from . import devices as dev

    reads = dev._RequestReads(conn)
    entities, scoped = dev._visible_entities(conn, principal, reads)
    pol = hi.effective(conn, principal.user_id)
    tree = svc.build_tree(conn, entities, scoped=scoped)
    control_of = ha_scope.control_checker(conn, principal)
    managed = reads.managed()
    from ..services import media_store

    media_managed = media_store.managed_entities(conn)
    flags = dev._bulk_flags(conn, principal, reads)
    from ..services import device_bulk as bulk

    switch_policy = bulk.SwitchPolicy(conn, managed=managed)
    allowed_rooms = set(pol["rooms"]) if pol["rooms"] is not None else None
    if allowed_rooms is not None and pol["kiosk_area_id"]:
        allowed_rooms.add(pol["kiosk_area_id"])
    modules = set(pol["modules"]) if pol["modules"] is not None else set(hi.MODULES)
    rooms: dict[str, dict[str, Any]] = {}
    floors = []
    for f in tree["floors"]:
        kept = []
        for a in f["areas"]:
            if allowed_rooms is not None and a["area_id"] not in allowed_rooms:
                continue
            rooms[a["area_id"]] = {"id": a["area_id"], "name": a["name"], "floor_id": f["floor_id"], "temperature": a.get("temperature"),
                                   "open_count": a.get("open_count", 0), "can_bulk": flags["all"] or a["area_id"] in flags["areas"],
                                   "lights": [], "switches": [], "climate": [], "shades": [], "locks": []}
            kept.append(a["area_id"])
        if kept:
            floors.append({"id": f["floor_id"], "name": f["name"], "rooms": kept})
    for e in entities:
        r = rooms.get(e.get("area_id") or "")
        if r is None:
            continue
        eid, domain = e["entity_id"], e["domain"]
        row = svc.card_row(e, control_of(eid))
        if eid in managed or eid in media_managed:
            row["can_control"] = False
        if svc.is_light(e):
            if "lights" in modules:
                r["lights"].append({**_pick(row, LIGHT_FIELDS), "kind": "light" if domain == "light" else "switch"})
        elif domain == "switch" and e["card"] == "switches":
            # an on/off load that is NOT typed as a light (Settings > device types): listed under lighting as a switch, on/off only,
            # never reached by "turn the room / house off" (that is lights_off: lights and light-typed switches only)
            if "lights" in modules:
                protected, _reason = switch_policy.switch_row(eid)
                r["switches"].append({**_pick(row, LIGHT_FIELDS), "kind": "switch", "dimmable": False, "protected": bool(protected),
                                      "load_type": e.get("device_type_set") or row.get("activity_kind")})
        elif domain == "climate" and e["card"] in ("climate", "heating"):
            if "climate" in modules:
                r["climate"].append(_pick(row, CLIMATE_FIELDS))
        elif domain == "cover" and not row.get("door_class"):
            if "shades" in modules:
                r["shades"].append(_pick(row, COVER_FIELDS))
        elif domain == "lock":
            if "doors" in modules:
                r["locks"].append(_pick(row, LOCK_FIELDS))
    return {
        "floors": floors,
        "rooms": [rooms[rid] for f in floors for rid in f["rooms"]],
        "can_bulk": bool(flags["building"]),
        "scoped": scoped,
        "modules": sorted(modules),
        "policy": pol,
    }


@router.get("/home/overview")
def overview(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The home interface's rooms (floors -> rooms with lights, on/off switches, climate, shutters and locks), as the caller may see them."""
    return build_overview(conn, principal)


# ---------------------------------------------------------------- the person's own favourites and layout

class PrefsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    favourites: dict[str, list[dict[str, Any]]] | None = None
    layout: dict[str, Any] | None = None


@router.get("/home/prefs")
def my_prefs(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's own favourites per room and layout, and the administrator's starting favourites."""
    return hi.get_prefs(conn, principal.user_id)


@router.put("/home/prefs")
def put_prefs(body: PrefsBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Save the caller's own favourites (rooms named in the body) and layout (keys named in the body)."""
    return hi.set_prefs(conn, principal.user_id, body.model_dump(exclude_none=True))


# ---------------------------------------------------------------- the administrator's page

ADMIN = "rbac.assign"


@router.get("/home/policies")
def policies(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every person's interface policy (user management, the home interface page). rbac.assign."""
    require(conn, principal, ADMIN, INSTALLATION)
    from ..db import get_setting

    seed = {row["room_key"]: hi._loads(row["items_json"]) or [] for row in conn.execute("SELECT room_key, items_json FROM home_favourites_seed").fetchall()}
    return {"users": hi.list_policies(conn), "modules": list(hi.MODULES), "seed": seed, "kiosk_code_set": bool(get_setting(conn, hi.KIOSK_CODE_KEY))}


class PolicyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    default_interface: Literal["home", "full"] | None = None
    may_switch: bool | None = None
    home_only: bool | None = None
    kiosk: bool | None = None
    kiosk_area_id: str | None = Field(None, max_length=128)
    rooms: list[str] | None = None
    modules: list[str] | None = None
    all_rooms: bool = False
    all_modules: bool = False


@router.put("/home/policies/{user_id}")
def put_policy(user_id: str, body: PolicyBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set one person's interface policy (default interface, switch, home only, wall panel, rooms, categories). rbac.assign; audited."""
    require(conn, principal, ADMIN, INSTALLATION)
    data = body.model_dump(exclude_none=True)
    if data.pop("all_rooms", False):
        data["rooms"] = None
    if data.pop("all_modules", False):
        data["modules"] = None
    before = hi.stored_policy(conn, user_id)
    out = hi.set_policy(conn, principal, user_id, data)
    audit(conn, actor=principal, action="home_interface.policy.set", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={"before": {k: before.get(k) for k in ("default_interface", "may_switch", "home_only", "kiosk")} if before else None,
                   "after": {k: out[k] for k in ("default_interface", "may_switch", "home_only", "kiosk", "kiosk_area_id")}})
    return out


class SeedBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seed: dict[str, list[dict[str, Any]]]


@router.put("/home/seed")
def put_seed(body: SeedBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The starting favourites per room that people who never edited a room see. rbac.assign; audited."""
    require(conn, principal, ADMIN, INSTALLATION)
    out = hi.set_seed(conn, principal, body.seed)
    audit(conn, actor=principal, action="home_interface.seed.set", decision="allowed", resource_type="setting", resource_id="home.seed", request_id=_rid(request),
          details={"rooms": sorted(body.seed.keys())[:50]})
    return {"seed": out}


class KioskCodeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str | None = Field(None, max_length=16)


@router.put("/home/kiosk-code")
def put_kiosk_code(body: KioskCodeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set (4-8 digits) or clear the wall panels' exit code. rbac.assign; audited (never the code itself)."""
    require(conn, principal, ADMIN, INSTALLATION)
    is_set = hi.set_kiosk_code(conn, body.code)
    audit(conn, actor=principal, action="home_interface.kiosk_code.set", decision="allowed", resource_type="setting", resource_id=hi.KIOSK_CODE_KEY, request_id=_rid(request),
          details={"set": is_set})
    return {"kiosk_code_set": is_set}


class KioskExitBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(..., min_length=1, max_length=16)


@router.post("/home/kiosk/exit")
def kiosk_exit(body: KioskExitBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The wall panel's exit: true when the code is the administrator's exit code (5 tries per 5 minutes; audited)."""
    ok = hi.check_kiosk_code(conn, principal.user_id, body.code)
    audit(conn, actor=principal, action="home_interface.kiosk.exit", decision="allowed" if ok else "denied", resource_type="user", resource_id=principal.user_id,
          reason=None if ok else "wrong_code", request_id=_rid(request))
    if not ok:
        raise hi.HomeInterfaceError(403, "wrong_code", "הקוד שגוי.")
    return {"ok": True}
