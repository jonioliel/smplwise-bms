"""Global search (design M48, pilot scope): rooms and zones, cameras, floors and buildings, and HA entities by
name, filtered by the caller's scope; every hit carries the route that opens it in the UI. Events keep their
own filters in the event centre."""
from __future__ import annotations

import sqlite3
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request

from ..auth import current_principal_ro, get_read_conn
from ..rbac import INSTALLATION, Principal, authorize, bindings_of
from ..errors import ApiError
from ..services import building_filter, ha_scope
from ..services import search_store as store
from ..services import semantic
from ..services.access import camera_scope, visible_camera_ids
from .settings import read_settings
from ..services.settings_store import setting_value

router = APIRouter()

KIND_LABEL = {"room": "חדר", "zone": "אזור", "corridor": "מסדרון", "outdoor": "חוץ", "service": "שירות"}
DOMAIN_LABEL = {"lock": "מנעול", "light": "תאורה", "binary_sensor": "חיישן", "sensor": "חיישן", "switch": "מתג", "climate": "אקלים", "cover": "תריס / שער", "camera": "מצלמת HA"}


def _visible_floors(conn: sqlite3.Connection, principal: Principal, permission: str) -> set[str] | None:
    """None = installation-wide; otherwise the floors the caller may read with `permission`."""
    if authorize(conn, principal, permission, INSTALLATION).allowed:
        return None
    return {f["id"] for f in store.live_floor_ids(conn) if authorize(conn, principal, permission, ("floor", f["id"])).allowed}


def search_allowed(conn: sqlite3.Connection, principal: Principal) -> bool:
    """TOPPILL-295: may this caller use the global search at all? `ui.global_search` is off by default. When on, a system
    administrator (system.configure) passes; `admins` stops there, `all` admits every signed-in user, `roles` admits the holders
    of a listed role (a binding of the user or of one of their groups; a deny binding never admits)."""
    mode = setting_value(conn, "ui.global_search")
    if mode not in ("admins", "roles", "all"):
        return False
    if authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        return True
    if mode == "all":
        return True
    if mode == "admins":
        return False
    listed = {r.strip() for r in str(setting_value(conn, "ui.global_search_roles") or "").split(",") if r.strip()}
    return any(b["role_id"] in listed for b in bindings_of(conn, principal) if b.get("effect") != "deny")


def _require_search(conn: sqlite3.Connection, principal: Principal) -> None:
    if not search_allowed(conn, principal):
        raise ApiError(403, "search_disabled", "החיפוש הכללי כבוי או אינו זמין למשתמש הזה.")


def _contains(hay: str | None, needle: str) -> bool:
    return bool(hay) and needle in hay.casefold()


@router.get("/search")
def search(
    q: str = Query(..., min_length=1, max_length=80),
    limit: int = Query(8, ge=1, le=20),
    building: str | None = Query(None, max_length=120),
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
) -> dict[str, Any]:
    """MULTI-BUILDING-NEXT-2500: on a multi-building site every hit names the buildings it serves and `building` keeps one building's
    hits (services/building_filter: display only, after the scope rules below - a hit is never added)."""
    _require_search(conn, principal)
    needle = q.strip().casefold()
    if not needle:
        return {"q": q, "results": [], "counts": {}}
    bf = building_filter.prepare(conn, building)
    floors = {
        f["id"]: dict(f)
        for f in store.live_floors_with_building(conn)
    }
    map_floors = _visible_floors(conn, principal, "map.read")

    def floor_ok(fid: str | None) -> bool:
        return fid is not None and fid in floors and (map_floors is None or fid in map_floors)

    results: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    found: list[tuple[str, dict[str, Any], list[str]]] = []  # MULTI-BUILDING-NEXT-2500: the hits with their buildings, before the cut

    def add(kind: str, item: dict[str, Any], *, areas: tuple[str | None, ...] = (), floors: tuple[str | None, ...] = (), buildings: tuple[str | None, ...] = ()) -> None:
        if bf is not None:
            found.append((kind, item, bf.place(areas=areas, floors=floors, buildings=buildings)))
            return
        counts[kind] = counts.get(kind, 0) + 1
        if counts[kind] <= limit:
            results.append({"kind": kind, **item})

    # CR-009: a room shared with other floors is found from each of them (floor_ids: every floor that shows it and the
    # caller may read - the client opens the one the person is on); its cameras likewise
    from ..services import shared_spaces

    shared_floors: dict[str, list[str]] = {}
    for s in shared_spaces.all_shares(conn):
        shared_floors.setdefault(s.zone_id, []).append(s.floor_id)
    mirrored = shared_spaces.mirrored_anchor_floors(conn) if shared_floors else {}
    map_denied = {f for f in floors if authorize(conn, principal, "map.read", ("floor", f)).reason == "explicit_deny"} if shared_floors else set()
    mirrored = {k: [(fid, home) for fid, home in pairs if home not in map_denied] for k, pairs in mirrored.items()}

    # rooms / zones (only those marked searchable)
    for z in store.searchable_zones(conn):
        shown = [fid for fid in [z["floor_id"], *([] if z["floor_id"] in map_denied else shared_floors.get(z["id"], []))] if floor_ok(fid)]
        if not _contains(z["name"], needle) or not shown:
            continue
        f = floors[shown[0]]
        add("zone", {"id": z["id"], "title": z["name"], "subtitle": f"{f['building_name']} · {f['name']} · {KIND_LABEL.get(z['kind'], z['kind'])}", "route": f"/explore/floors/{shown[0]}?zone={z['id']}",
                     "floor_id": shown[0], **({"floor_ids": shown} if len(shown) > 1 or shown[0] != z["floor_id"] else {})}, floors=tuple(shown))

    # cameras (scope: the cameras the caller may see on a map; unplaced cameras for installation-wide readers)
    cam_ids = visible_camera_ids(conn, principal, "map.read")
    live_ids = visible_camera_ids(conn, principal, "video.live")  # TOPPILL-295: a camera the caller may not watch is not a hit either
    placed = {r["resource_id"]: r["floor_id"] for r in store.placed_cameras(conn)}
    for (rtype, rid), pairs in mirrored.items():  # a camera of a shared room the caller reaches only through the other floor
        if rtype == "camera" and (rid not in placed or not floor_ok(placed[rid])):
            ok = next((fid for fid, _home in pairs if floor_ok(fid)), None)
            if ok:
                placed[rid] = ok
    for c in store.enabled_cameras(conn):
        if (cam_ids is not None and c["id"] not in cam_ids) or (live_ids is not None and c["id"] not in live_ids):
            continue
        title = c["alias"] or c["name_source"] or c["id"]
        if not (_contains(c["alias"], needle) or _contains(c["name_source"], needle) or needle == str(c["channel"])):
            continue
        fid = placed.get(c["id"])
        f = floors.get(fid) if fid else None
        add("camera", {
            "id": c["id"],
            "title": title,
            "subtitle": f"ערוץ {c['channel']}" + (f" · {f['building_name']} · {f['name']}" if f else " · לא מוצבת על תוכנית"),
            "route": f"/explore/floors/{fid}?camera={c['id']}" if f and floor_ok(fid) else f"/live/cameras/{c['id']}",
            "floor_id": fid if f else None,
        }, floors=(fid if f else None,))

    # floors and buildings
    for fid, f in floors.items():
        if _contains(f["name"], needle) and floor_ok(fid):
            add("floor", {"id": fid, "title": f["name"], "subtitle": f["building_name"], "route": f"/explore/floors/{fid}", "floor_id": fid}, floors=(fid,))
    for b in store.live_buildings(conn):
        if not _contains(b["name"], needle):
            continue
        if not any(floor_ok(fid) for fid, f in floors.items() if f["building_id"] == b["id"]) and not authorize(conn, principal, "map.read", ("building", b["id"])).allowed:
            continue
        add("building", {"id": b["id"], "title": b["name"], "subtitle": "מבנה", "route": f"/explore/buildings/{b['id']}/floors", "floor_id": None}, buildings=(b["id"],))

    # HA entities: everything for installation-wide readers, only placed entities on visible floors otherwise
    ent_floors = _visible_floors(conn, principal, "entity.state.read")
    # round 14 (owner 02.11): a building binding also reaches the entities the home mapping puts in its building (services/ha_scope)
    ent_mapped = ha_scope.visible_floors(conn, principal, "entity.state.read")[1].mapped if ent_floors is not None else frozenset()
    from ..rbac import permissions_anywhere

    alarm_view = "alarm.view" in permissions_anywhere(conn, principal)
    ent_placed = {r["resource_id"]: r["floor_id"] for r in store.placed_entities(conn)}
    denied_homes = {f["id"] for f in store.live_floor_ids(conn)
                    if authorize(conn, principal, "entity.state.read", ("floor", f["id"])).reason == "explicit_deny"} if mirrored and ent_floors is not None else set()
    for (rtype, rid), pairs in mirrored.items():  # CR-009: an entity of a shared room, through the other floor (deny on its home wins)
        if rtype == "ha_entity" and ent_floors is not None and ent_placed.get(rid) not in ent_floors:
            ok = next((fid for fid, home in pairs if fid in ent_floors and home not in denied_homes), None)
            if ok:
                ent_placed[rid] = ok
    # HA-2026-11-COMPAT-2404: `name` is the full name Home Assistant shows; the state's friendly name (the pre-2026.11 name while
    # Home Assistant keeps a compat name) finds an entity by the name the operator knew before the migration
    for e in store.searchable_entities(conn):
        if not (_contains(e["name"], needle) or _contains(e["original_name"], needle) or _contains(e["entity_id"], needle) or _contains(e["area_name"], needle)
                or _contains(e["friendly_name"] if isinstance(e["friendly_name"], str) else None, needle)):
            continue
        fid = ent_placed.get(e["entity_id"])
        if ent_floors is not None and (fid is None or fid not in ent_floors) and e["entity_id"] not in ent_mapped:
            continue
        f = floors.get(fid) if fid else None
        sub = DOMAIN_LABEL.get(e["domain"], e["domain"]) + (f" · {e['area_name']}" if e["area_name"] else "") + (f" · {f['building_name']} · {f['name']}" if f else " · לא מוצבת על תוכנית")
        add("entity", {
            "id": e["entity_id"],
            "title": e["name"] or e["original_name"] or e["entity_id"],
            "subtitle": sub,
            # CR-010: an alarm panel opens the alarm section for a holder of alarm.view (the map otherwise)
            "route": f"/security/alarm?panel={quote(e['entity_id'])}" if e["domain"] == "alarm_control_panel" and alarm_view
            else f"/explore/floors/{fid}?entity={quote(e['entity_id'])}" if f and floor_ok(fid) else f"/explore/entities?q={quote(e['entity_id'])}",
            "floor_id": fid if f else None,
        }, floors=(fid if f else None,), areas=(() if f else (e["area_id"],)))

    # objects of the published structure of each visible floor: by their label or their library name (he / en / tags)
    from ..services import geometry_store, plan_catalog

    names = plan_catalog.names_index(conn)
    for fid, entries in geometry_store.published_objects(conn).items():
        if not floor_ok(fid):
            continue
        f = floors[fid]
        for o in entries:
            n = names.get(o["item_id"]) or {"he": o["item_id"], "en": "", "tags": []}
            if not any(_contains(h, needle) for h in (o["label"], n["he"], n["en"], *n["tags"])):
                continue
            add("object", {"id": o["id"], "title": o["label"] or n["he"], "subtitle": f"{n['he']} · {f['building_name']} · {f['name']}",
                           "route": f"/explore/floors/{fid}?focus=object:{o['id']}", "floor_id": fid}, floors=(fid,))

    out: dict[str, Any] = {"q": q, "results": results, "counts": counts}
    if bf is not None:
        meta = bf.meta()
        for kind, item, served in found:
            if meta is not None and not bf.keep(served):
                continue
            counts[kind] = counts.get(kind, 0) + 1
            if counts[kind] <= limit:
                results.append({"kind": kind, **item, **({"buildings": served} if meta is not None else {})})
        if meta is not None:
            out["building_filter"] = meta
    return out


# ---------------------------------------------------------------- semantic search (T063)

@router.get("/search/providers")
def search_providers(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The provider registry: the local baseline (no network) and the external adapter contract (opt-in, privacy
    statement, model version, daily budget) — not bundled, so it cannot be switched on."""
    s = read_settings(conn)
    return {"providers": semantic.registry(), "active": s["ai.provider"], "settings": {"ai.provider": s["ai.provider"], "ai.privacy_ack": s["ai.privacy_ack"], "ai.budget_daily": s["ai.budget_daily"]}, "note": semantic.NOT_IDENTITY}


@router.get("/search/semantic")
def semantic_search(request: Request, q: str = Query(..., min_length=1, max_length=120), limit: int = Query(30, ge=1, le=200), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Free text → the event centre's own filters (object class from the device's detection target, places from the
    catalogue, a time window in the site zone) → scoped events, each with a confidence and its basis. Colour and
    appearance terms are reported as unsupported (no source produced that metadata). Never identity evidence."""
    s = read_settings(conn)
    if s["ai.provider"] == "none":
        raise ApiError(409, "semantic_disabled", "החיפוש הסמנטי כבוי בהגדרות (ai.provider=none).")
    map_floors = _visible_floors(conn, principal, "map.read")
    cam_scope = camera_scope(conn, principal, "events.read")  # a camera name the caller cannot see is not a place
    parsed = semantic.parse(q, conn, s["time.zone"], floor_ok=lambda fid: map_floors is None or fid in map_floors, camera_ok=cam_scope.allows)
    from .events import list_events

    queries: list[dict[str, str]] = []
    for p in parsed.places:
        queries.append({"zone_id": p["id"]} if p["kind"] == "zone" else {"floor_id": p["id"]} if p["kind"] == "floor" else {"camera_id": p["id"]})
    if not queries:
        queries.append({})
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    window_from = parsed.window["from"] if parsed.window else None
    window_to = parsed.window["to"] if parsed.window else None
    for qf in queries:
        for typ in (parsed.types or [None]):
            raw = list_events(request, principal, conn, date=None, from_=window_from, to=window_to, camera_id=qf.get("camera_id"), type=typ, unacked=False, acked=False, limit=min(1000, limit * 4),
                              site_id=None, building_id=None, floor_id=qf.get("floor_id"), zone_id=qf.get("zone_id"), source=None, severity=None)
            for ev in raw.get("events", []):
                if ev["id"] in seen:
                    continue
                seen.add(ev["id"])
                conf, basis = semantic.confidence(ev, parsed)
                results.append({**ev, "match": {"confidence": conf, "basis": basis}})
    results.sort(key=lambda e: (e["match"]["confidence"] != "exact", e["occurred_at"]), reverse=False)
    results.sort(key=lambda e: e["occurred_at"], reverse=True)
    results.sort(key=lambda e: e["match"]["confidence"] != "exact")
    return {"q": q, "provider": semantic.LOCAL.describe(), "parsed": parsed.to_dict(), "results": results[:limit], "total": len(results), "note": semantic.NOT_IDENTITY, "unsupported": parsed.unsupported}

