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

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..rbac import INSTALLATION, Principal, require
from ..services import device_bulk as bulk
from ..services import device_types
from ..services import devices as svc
from ..services import door_authority, intercom_doors
from ..services import ha_scope
from ..services import home_interface as hi
from ..services import switch_protection
from ._common import rid as _rid

router = APIRouter()


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
LOCK_FIELDS = ("entity_id", "name", "domain", "state", "available", "active", "can_control", "locked", "wiskey_door", "alarm_managed")


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
    switch_policy = bulk.SwitchPolicy(conn, managed=managed)
    allowed_rooms = set(pol["rooms"]) if pol["rooms"] is not None else None
    if allowed_rooms is not None and pol["kiosk_area_id"]:
        allowed_rooms.add(pol["kiosk_area_id"])
    modules = set(pol["modules"]) if pol["modules"] is not None else set(hi.MODULES)
    rooms: dict[str, dict[str, Any]] = {}
    unlock_scope = None
    wiskey_ids: set[str] = set()
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
                lk = _pick(row, LOCK_FIELDS)
                # HOME-SIMPLE-2421 (lab 2.42.0): why the open is (not) offered - THE rule of the devices panel and the single-entity view
                # (door_authority.unlock_reason); the home interface offers "open" only when it is "ok" (the action route decides again)
                if unlock_scope is None:
                    unlock_scope = door_authority.UnlockScope(conn, principal)
                    wiskey_ids = intercom_doors.wiskey_lock_ids(conn)
                is_wk = eid in wiskey_ids
                lk["wiskey_door"] = bool(lk.get("wiskey_door")) or is_wk
                lk["unlock_reason"] = door_authority.unlock_reason(conn, principal, eid, wiskey=is_wk, alarm_managed=eid in managed or bool(lk.get("alarm_managed")),
                                                                  can_control=bool(row.get("can_control")), scope=unlock_scope)
                lk["can_unlock"] = lk["unlock_reason"] == "ok"
                lk.pop("alarm_managed", None)
                r["locks"].append(lk)
    return {
        "weather": _weather(conn),
        "floors": floors,
        "rooms": [rooms[rid] for f in floors for rid in f["rooms"]],
        "can_bulk": bool(flags["building"]),
        "scoped": scoped,
        "modules": sorted(modules),
        "policy": pol,
    }


WEATHER_HE = {"sunny": "בהיר", "clear-night": "לילה בהיר", "partlycloudy": "מעונן חלקית", "cloudy": "מעונן", "rainy": "גשום", "pouring": "גשם חזק",
              "lightning": "סערה", "lightning-rainy": "סערה וגשם", "snowy": "שלג", "snowy-rainy": "שלג וגשם", "hail": "ברד", "fog": "ערפל", "windy": "רוח",
              "windy-variant": "רוח ועננים", "exceptional": "מזג אוויר חריג"}


def _weather(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The outside temperature and condition of the installation's first available weather entity (the strip's weather line), or None."""
    import json

    r = conn.execute("SELECT state, attributes_json FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL AND disabled = 0 AND available = 1 ORDER BY entity_id LIMIT 1").fetchone()
    if r is None:
        return None
    try:
        a = json.loads(r["attributes_json"] or "{}")
    except ValueError:
        a = {}
    t = a.get("temperature")
    return {"t": round(t) if isinstance(t, (int, float)) and not isinstance(t, bool) else None, "text": WEATHER_HE.get(r["state"] or "", "")}


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
    guests: bool | None = None  # HOME-V3-P1-2430: may invite a guest from the home interface (never a grant)


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
          details={"before": {k: before.get(k) for k in ("default_interface", "may_switch", "home_only", "kiosk", "guests")} if before else None,
                   "after": {k: out[k] for k in ("default_interface", "may_switch", "home_only", "kiosk", "kiosk_area_id", "guests")}})
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


# ---------------------------------------------------------------- HOME-SIMPLE-2421: installation settings

class InstallBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    default_mode: Literal["full_all", "home_regular", "choose"] | None = None
    kiosk_exit: Literal["code", "none"] | None = None
    wallpaper: Literal["none", "gallery", "gallery_image"] | None = None


@router.get("/home/settings")
def get_install_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The home interface's installation settings: default interface of new people, wall-panel exit, room wallpaper. rbac.assign."""
    require(conn, principal, ADMIN, INSTALLATION)
    return {"settings": hi.install_settings(conn), "values": {k: list(v) for k, v in hi.INSTALL_VALUES.items()}, "gallery": list(hi.GALLERY)}


@router.put("/home/settings")
def put_install_settings(body: InstallBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change the home interface's installation settings. Existing people keep their policy rows. rbac.assign; audited."""
    require(conn, principal, ADMIN, INSTALLATION)
    data = body.model_dump(exclude_none=True)
    before = hi.install_settings(conn)
    out = hi.set_install_settings(conn, data)
    audit(conn, actor=principal, action="home_interface.settings.set", decision="allowed", resource_type="setting", resource_id="home.*", request_id=_rid(request),
          details={"before": {k: before[k] for k in data}, "after": {k: out[k] for k in data}})
    return {"settings": out}


# ---------------------------------------------------------------- HOME-SIMPLE-2421: switch classification (suggest, the administrator approves)

SWITCH_CLASSES = ("light", "not_light", "protected")
# a name-based type that is an appliance, not a lamp (services/device_activity: the boiler / tap / heater / fan words)
APPLIANCE_KINDS = frozenset({"water_heater", "valve", "heater", "fan"})


def _switch_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every switch with its class now (light = typed a light; protected = an administrator's protection; else not_light), the class
    the system suggests from its name (None = nothing to suggest) and why, and whether a protection change is refused (`locked`)."""
    from . import devices as dev

    all_entities = svc.load_entities(conn)
    entities = [e for e in all_entities if e["domain"] == "switch" and not svc.is_scheduler(conn, e["entity_id"])]
    floors, areas = svc.load_structure(conn, all_entities)
    types = {r["entity_id"]: r for r in device_types.listing(conn, entities, floors, areas)}
    prot = {r["entity_id"]: dict(r) for r in conn.execute("SELECT * FROM device_bulk_protected").fetchall()}
    policy = bulk.SwitchPolicy(conn)
    media_managed = dev._media_managed(conn)
    out = []
    for e in entities:
        eid = e["entity_id"]
        t = types.get(eid) or {}
        p = prot.get(eid) or {}
        suggested_protect = p.get("source") == "auto" and not p.get("reviewed")
        protected = bool(p) and not suggested_protect
        cls = "protected" if protected else "light" if t.get("set") == "light" else "not_light"
        name = e.get("name") or e.get("original_name") or eid
        suggest, why = None, None
        if suggested_protect:
            suggest, why = "protected", switch_protection.category_label(p.get("category")) or "לפי השם"
        elif t.get("auto") in APPLIANCE_KINDS:
            suggest, why = "protected", "השם נשמע כמו מכשיר ולא כמו תאורה"
        elif switch_protection.has_light_word(switch_protection.normalize(name)):
            suggest, why = "light", "השם כולל מילה של תאורה"
        if suggest == cls:
            suggest, why = None, None
        locked = "alarm_managed" if eid in policy.alarm_managed else "media_managed" if eid in media_managed else "doors_layer" if eid in policy.door_layer else None
        out.append({"entity_id": eid, "name": name, "area_id": e.get("area_id"), "area_name": e.get("area_name"), "floor_name": t.get("floor_name"),
                    "state": e.get("state"), "available": bool(e.get("available")), "class": cls, "suggest": suggest, "suggest_reason": why, "locked": locked})
    out.sort(key=lambda r: ((r["area_name"] or "~").casefold(), r["name"].casefold(), r["entity_id"]))
    return out


@router.get("/home/switches")
def list_switch_classes(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The administrator's switch classification list (light / not a light / protected, with the system's suggestions). system.configure:
    the permission of Settings > device types and protected switches, whose stores this writes."""
    require(conn, principal, "system.configure", INSTALLATION)
    rows = _switch_rows(conn)
    return {"switches": rows, "summary": {"switches": len(rows), "suggested": sum(1 for r in rows if r["suggest"]),
                                          **{c: sum(1 for r in rows if r["class"] == c) for c in SWITCH_CLASSES}}}


class SwitchClassBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_ids: list[str] = Field(min_length=1, max_length=500)
    mark: Literal["light", "not_light", "protected"]


@router.post("/home/switches")
def set_switch_classes(body: SwitchClassBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mark many switches at once: `light` (device type light, protection removed), `not_light` (a light type dropped - back to
    automatic, or `switch` when the name alone would make it a light - and protection removed), `protected` (not a light, and out of
    every group action). Writes the existing stores (device_type_override, device_bulk_protected) through their own functions - one
    audit row per change there - plus one summary row `home_interface.switch_class.batch`. system.configure. Refused per id:
    not_switch and, for a protection change, alarm_managed / media_managed / doors_layer."""
    require(conn, principal, "system.configure", INSTALLATION)
    from . import devices as dev

    rid = _rid(request)
    policy = bulk.SwitchPolicy(conn)
    media_managed = dev._media_managed(conn)
    rows = {r["entity_id"]: r for r in _switch_rows(conn)}
    by_id = {e["entity_id"]: e for e in svc.load_entities(conn)}
    results = []
    changed = 0
    for eid in dict.fromkeys(body.entity_ids):
        row = rows.get(eid)
        if row is None:
            results.append({"entity_id": eid, "ok": False, "reason": "not_switch", "changed": False})
            continue
        want_protect = body.mark == "protected"
        is_protected = row["class"] == "protected"
        if want_protect != is_protected:
            why = dev._protect_refusal(conn, eid, "protect", policy, media_managed)
            if why:
                results.append({"entity_id": eid, "ok": False, "reason": why, "changed": False})
                continue
        did = False
        fixed = device_types.overrides(conn).get(eid)
        if body.mark == "light":
            did |= device_types.set_kind(conn, principal, eid, "light", request_id=rid, batch=True)
        else:
            auto = device_types.auto_kind(by_id[eid]) if eid in by_id else None
            if fixed == "light" or (fixed is None and auto == "light"):
                did |= device_types.set_kind(conn, principal, eid, "switch" if auto == "light" else "auto", request_id=rid, batch=True)
        if want_protect and not is_protected:
            p, _c = switch_protection.status(conn, eid)
            if p and p.get("source") == "auto" and not p.get("reviewed"):
                did |= switch_protection.approve(conn, principal, eid, request_id=rid)
            else:
                did |= switch_protection.set_protected(conn, principal, eid, True, batch=True, request_id=rid)
        elif not want_protect and is_protected:
            did |= switch_protection.set_protected(conn, principal, eid, False, batch=True, request_id=rid)
        changed += int(did)
        results.append({"entity_id": eid, "ok": True, "reason": None, "changed": did})
    audit(conn, actor=principal, action="home_interface.switch_class.batch", decision="allowed", resource_type="installation", resource_id="*", request_id=rid,
          details={"mark": body.mark, "requested": len(results), "changed": changed, "refused": [r["entity_id"] for r in results if not r["ok"]][:100]})
    return {"results": results, "changed": changed, "refused": sum(1 for r in results if not r["ok"])}


# ---------------------------------------------------------------- HOME-SIMPLE-2421: the person's own room wallpaper picture

WALL_REFUSED = {
    "logo_too_large": "התמונה גדולה מ-2 MB.", "logo_type": "אפשר להעלות JPEG או PNG בלבד.", "logo_dimensions": "מידות התמונה אינן נתמכות.",
    "logo_undecodable": "התמונה לא ניתנת לקריאה.", "logo_empty": "הקובץ ריק.",
}


def _wall_room(conn: sqlite3.Connection, room_key: str) -> None:
    if not hi.ROOM_KEY_RE.match(room_key):
        raise hi.HomeInterfaceError(422, "validation", "החדר אינו תקין.")


@router.put("/home/wallpaper/{room_key}")
def put_wallpaper(room_key: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Upload the caller's own picture for one room's screen (JPEG / PNG, <= 2 MB; re-encoded: pixels rebuilt, EXIF dropped, long side
    <= 1920 px). Only when the installation offers personal pictures (403 wallpaper_image_off). Audited (never the picture)."""
    import base64

    from ..db import now_iso
    from ..services.bill_pdf_logo import LogoError, sanitize_image

    _wall_room(conn, room_key)
    if hi.install_settings(conn)["wallpaper"] != "gallery_image":
        raise hi.HomeInterfaceError(403, "wallpaper_image_off", "תמונה אישית לרקע אינה פעילה בהתקנה הזו.")
    raw = file.file.read(hi.WALL_IMAGE_BYTES + 1)
    try:
        mime, data = sanitize_image(raw, max_bytes=hi.WALL_IMAGE_BYTES, max_side=hi.WALL_IMAGE_SIDE)
    except LogoError as exc:
        raise hi.HomeInterfaceError(422, "image_refused", WALL_REFUSED.get(str(exc), "התמונה נדחתה."), details={"reason": str(exc)}) from None
    conn.execute(
        """INSERT INTO home_room_image (user_id, room_key, mime, data_b64, bytes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, room_key) DO UPDATE SET mime = excluded.mime, data_b64 = excluded.data_b64, bytes = excluded.bytes, updated_at = excluded.updated_at""",
        (principal.user_id, room_key, mime, base64.b64encode(data).decode("ascii"), len(data), now_iso()),
    )
    walls = dict(hi.get_prefs(conn, principal.user_id)["layout"].get("wallpapers") or {})
    walls[room_key] = "img"
    prefs = hi.set_prefs(conn, principal.user_id, {"layout": {"wallpapers": walls}})
    audit(conn, actor=principal, action="home_interface.wallpaper.set", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request),
          details={"room": room_key, "bytes": len(data), "mime": mime})
    return {"ok": True, "bytes": len(data), "layout": prefs["layout"]}


@router.get("/home/wallpaper/{room_key}")
def get_wallpaper(room_key: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The caller's own picture for one room (never another person's). 404 when there is none or the installation turned pictures off."""
    import base64

    _wall_room(conn, room_key)
    r = conn.execute("SELECT mime, data_b64 FROM home_room_image WHERE user_id = ? AND room_key = ?", (principal.user_id, room_key)).fetchone()
    if r is None or hi.install_settings(conn)["wallpaper"] != "gallery_image":
        raise hi.HomeInterfaceError(404, "not_found", "אין תמונה.")
    return Response(base64.b64decode(r["data_b64"]), media_type=r["mime"], headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


@router.delete("/home/wallpaper/{room_key}")
def delete_wallpaper(room_key: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Remove the caller's own picture for one room (the room goes back to no wallpaper)."""
    _wall_room(conn, room_key)
    conn.execute("DELETE FROM home_room_image WHERE user_id = ? AND room_key = ?", (principal.user_id, room_key))
    walls = dict(hi.get_prefs(conn, principal.user_id)["layout"].get("wallpapers") or {})
    if walls.get(room_key) == "img":
        walls.pop(room_key)
    prefs = hi.set_prefs(conn, principal.user_id, {"layout": {"wallpapers": walls}})
    audit(conn, actor=principal, action="home_interface.wallpaper.delete", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request),
          details={"room": room_key})
    return {"ok": True, "layout": prefs["layout"]}
