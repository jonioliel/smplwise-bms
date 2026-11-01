"""MAPPING-ASSIST-2330 (owner approval 31.10, round 10 mapping mockup v3, answers 1A-6A): the mapping assistant's server side.

"Which home-system name belongs to which of our buildings". The engine (tokenizer, token table, ordered rules, manual decisions, the plan)
runs in the browser (frontend/src/api/mapping-engine.ts, unit-tested); the server keeps the assistant's state, checks every row of a plan
against the catalogue and the platform registry, writes the rows of the EXISTING mapping in one transaction (SYNOPTIC-HA-2310 layer 1
home_floor_links + layer 2 home_area_links, migration 0187) plus the area -> building rows of the home's site level (0189), records a
version with the rows before and after, and audits it. "חזרה לגרסה זו" writes a new version with the old rows. Nothing is ever written to
the home system itself, and nothing is deleted (buildings / floors an apply created stay after a rollback).

Permission: site.content.configure on the site - the permission that creates buildings and floors and links a floor to the home system
(routers/catalog.py). The multi-building switch (`home.multi_building.enabled`, OFF by default, owner 31.10) is an installation setting:
whoever may configure the content of EVERY site switches it (one site = that site's permission). Everyone reads it in GET /settings
(`home.multi_building`, read-only there).
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import get_setting, new_id, now_iso, set_setting
from ..errors import ApiError, conflict, validation
from ..rbac import Principal, authorize, require
from .catalog import P_CONTENT, get_site

router = APIRouter()

MULTI_KEY = "home.multi_building.enabled"
SETTINGS_DEFAULT: dict[str, str] = {"floor_inherit": "on", "auto_insert": "off", "new_token": "new_first"}
SETTINGS_CHOICES: dict[str, tuple[str, ...]] = {
    "floor_inherit": ("on", "off"),  # 2A: an area without a mark on a floor of a clear building goes with its floor
    "auto_insert": ("off", "on"),  # 3A: a new name after apply waits for "אשר" (off) or goes in by itself (on)
    "new_token": ("new_first", "existing_first", "unassigned_first"),  # 4A: a mark with no building - the first answer offered
}
STATE_MAX_BYTES = 512 * 1024
PLAN_MAX = 5000
NAME_MAX = 120
ID_MAX = 120


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def multi_building_on(conn: sqlite3.Connection) -> bool:
    return get_setting(conn, MULTI_KEY, "off") == "on"


def _settings(raw: str | None) -> dict[str, str]:
    try:
        o = json.loads(raw or "{}")
    except ValueError:
        o = {}
    out = dict(SETTINGS_DEFAULT)
    if isinstance(o, dict):
        for k, allowed in SETTINGS_CHOICES.items():
            if o.get(k) in allowed:
                out[k] = o[k]
    return out


def _state_row(conn: sqlite3.Connection, site_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM home_mapping_state WHERE site_id = ?", (site_id,)).fetchone()


def _site_buildings(conn: sqlite3.Connection, site_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (site_id,)).fetchall()


def _site_floors(conn: sqlite3.Connection, site_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT f.* FROM floors f JOIN buildings b ON b.id = f.building_id WHERE b.site_id = ? AND b.deleted_at IS NULL AND f.deleted_at IS NULL ORDER BY f.level DESC, f.sort_order",
        (site_id,),
    ).fetchall()


def site_rows(conn: sqlite3.Connection, site_id: str) -> dict[str, list[dict[str, Any]]]:
    """The mapping rows that concern this site: floor / area rows on its floors, area rows taken off every floor (they name no place),
    and area -> building rows of its buildings. Sorted, so two snapshots compare as JSON."""
    floors = {r["id"] for r in _site_floors(conn, site_id)}
    buildings = {r["id"] for r in _site_buildings(conn, site_id)}
    fl = [{"ha_floor_id": r[0], "floor_id": r[1]} for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links ORDER BY ha_floor_id").fetchall() if r[1] in floors]
    ar = [{"area_id": r[0], "floor_id": r[1]} for r in conn.execute("SELECT area_id, floor_id FROM home_area_links ORDER BY area_id").fetchall() if r[1] is None or r[1] in floors]
    bl = [{"area_id": r[0], "building_id": r[1]} for r in conn.execute("SELECT area_id, building_id FROM home_area_buildings ORDER BY area_id").fetchall() if r[1] in buildings]
    return {"floors": fl, "areas": ar, "buildings": bl}


def _versions(conn: sqlite3.Connection, site_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT v.number, v.kind, v.restored_from, v.created_at, v.created_by, v.summary_json, v.note, u.display_name, u.username "
        "FROM home_mapping_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.site_id = ? ORDER BY v.number DESC LIMIT 50",
        (site_id,),
    ).fetchall()
    out = []
    for i, r in enumerate(rows):
        try:
            summary = json.loads(r["summary_json"] or "{}")
        except ValueError:
            summary = {}
        out.append({"number": r["number"], "kind": r["kind"], "restored_from": r["restored_from"], "created_at": r["created_at"],
                    "by": r["display_name"] or r["username"] or "", "summary": summary if isinstance(summary, dict) else {}, "note": r["note"], "current": i == 0})
    return out


def _can_toggle(conn: sqlite3.Connection, principal: Principal) -> bool:
    sites = [r[0] for r in conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL").fetchall()]
    return bool(sites) and all(authorize(conn, principal, P_CONTENT, ("site", s)).allowed for s in sites)


# ---------------------------------------------------------------------------------------------------------------------------------- read

@router.get("/sites/{site_id}/mapping")
def read_mapping(site_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Everything the assistant needs: its stored state and settings, the versions, the item keys the last apply saw, the platform's floors
    and areas (the registry - complete, independent of the caller's device reach), our buildings with their floors, and the current rows."""
    site = get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    st = _state_row(conn, site_id)
    try:
        state = json.loads(st["state_json"]) if st and st["state_json"] else None
    except ValueError:
        state = None
    last = conn.execute("SELECT items_json FROM home_mapping_versions WHERE site_id = ? ORDER BY number DESC LIMIT 1", (site_id,)).fetchone()
    try:
        seen = json.loads(last["items_json"]) if last else None
    except ValueError:
        seen = []
    floors_by_b: dict[str, list[dict[str, Any]]] = {}
    for f in _site_floors(conn, site_id):
        floors_by_b.setdefault(f["building_id"], []).append({"id": f["id"], "name": f["name"], "level": f["level"]})
    buildings = [{"id": b["id"], "name": b["name"], "is_shared": bool(b["is_shared"]) if "is_shared" in b.keys() else False, "floors": floors_by_b.get(b["id"], [])} for b in _site_buildings(conn, site_id)]
    items = {
        "floors": [{"id": r["floor_id"], "name": r["name"], "level": r["level"]} for r in conn.execute("SELECT floor_id, name, level FROM ha_floors ORDER BY position, name").fetchall()],
        "areas": [{"id": r["area_id"], "name": r["name"], "floor_id": r["floor_id"]} for r in conn.execute("SELECT area_id, name, floor_id FROM ha_areas ORDER BY position, name").fetchall()],
    }
    return {
        "site": {"id": site["id"], "name": site["name"]},
        "state": state if isinstance(state, dict) else None,
        "revision": st["revision"] if st else 0,
        "settings": _settings(st["settings_json"] if st else None),
        "multi_building": multi_building_on(conn),
        "can_toggle": _can_toggle(conn, principal),
        "versions": _versions(conn, site_id),
        "seen": seen if isinstance(seen, list) else None,
        "items": items,
        "buildings": buildings,
        "links": site_rows(conn, site_id),
    }


# ---------------------------------------------------------------------------------------------------------------------------------- state

class StateIn(BaseModel):
    state: dict[str, Any]
    revision: int = Field(ge=0)


def _dump_state(state: dict[str, Any]) -> str:
    raw = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode("utf-8")) > STATE_MAX_BYTES:
        raise ApiError(413, "payload_too_large", "מצב המיפוי גדול מדי.")
    return raw


def _save_state(conn: sqlite3.Connection, site_id: str, raw: str, principal: Principal, revision: int | None) -> int:
    st = _state_row(conn, site_id)
    cur = st["revision"] if st else 0
    if revision is not None and revision != cur:
        raise conflict("stale_revision", "המיפוי השתנה בינתיים במקום אחר. טענו מחדש והמשיכו.", revision=cur)
    now = now_iso()
    if st:
        conn.execute("UPDATE home_mapping_state SET state_json = ?, revision = ?, updated_at = ?, updated_by = ? WHERE site_id = ?", (raw, cur + 1, now, principal.user_id, site_id))
    else:
        conn.execute("INSERT INTO home_mapping_state(site_id, state_json, settings_json, revision, updated_at, updated_by) VALUES (?, ?, '{}', ?, ?, ?)", (site_id, raw, cur + 1, now, principal.user_id))
    return cur + 1


@router.put("/sites/{site_id}/mapping/state")
def put_state(site_id: str, body: StateIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The assistant's draft (the mark, the token table, the rules, the manual decisions). Stored as sent; the browser reads it back
    through stateOf(). A stale revision answers 409 (two people mapping at once)."""
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    rev = _save_state(conn, site_id, _dump_state(body.state), principal, body.revision)
    audit(conn, actor=principal, action="home.mapping.state", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request),
          details={"revision": rev, "tokens": len(body.state.get("tokens") or {}), "decisions": len(body.state.get("decisions") or {}), "rules": len(body.state.get("rules") or [])})
    return {"revision": rev}


class SettingsIn(BaseModel):
    floor_inherit: Literal["on", "off"] | None = None
    auto_insert: Literal["off", "on"] | None = None
    new_token: Literal["new_first", "existing_first", "unassigned_first"] | None = None


@router.put("/sites/{site_id}/mapping/settings")
def put_settings(site_id: str, body: SettingsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    st = _state_row(conn, site_id)
    cur = _settings(st["settings_json"] if st else None)
    change = {k: v for k, v in body.model_dump().items() if v is not None}
    cur.update(change)
    raw = json.dumps(cur, separators=(",", ":"))
    if st:
        conn.execute("UPDATE home_mapping_state SET settings_json = ?, updated_at = ?, updated_by = ? WHERE site_id = ?", (raw, now_iso(), principal.user_id, site_id))
    else:
        conn.execute("INSERT INTO home_mapping_state(site_id, state_json, settings_json, revision, updated_at, updated_by) VALUES (?, '{}', ?, 0, ?, ?)", (site_id, raw, now_iso(), principal.user_id))
    audit(conn, actor=principal, action="home.mapping.settings", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request), details=change)
    return {"settings": cur}


class MultiIn(BaseModel):
    enabled: bool


@router.put("/home/multi-building")
def put_multi_building(body: MultiIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The multi-building view of the home screen: OFF by default (owner 31.10). Off = the exact one-building home; the mapping data stays."""
    sites = [r[0] for r in conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL").fetchall()]
    if not sites:
        raise validation("אין אתר במערכת.")
    for s in sites:
        require(conn, principal, P_CONTENT, ("site", s))
    before = multi_building_on(conn)
    set_setting(conn, MULTI_KEY, "on" if body.enabled else "off")
    audit(conn, actor=principal, action="home.multi_building", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"enabled": body.enabled, "was": before})
    return {"enabled": body.enabled}


# ---------------------------------------------------------------------------------------------------------------------------------- apply

class NewBuilding(BaseModel):
    key: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=NAME_MAX)


class NewFloor(BaseModel):
    key: str = Field(min_length=1, max_length=20)
    building: str = Field(min_length=1, max_length=ID_MAX)
    name: str = Field(min_length=1, max_length=NAME_MAX)
    level: int = Field(ge=-50, le=300)


class PlanFloorRow(BaseModel):
    ha_floor_id: str = Field(min_length=1, max_length=ID_MAX)
    floor: str | None = Field(default=None, max_length=ID_MAX)


class PlanAreaRow(BaseModel):
    area_id: str = Field(min_length=1, max_length=ID_MAX)
    floor: str | None = Field(default="keep", max_length=ID_MAX)
    building: str | None = Field(default=None, max_length=ID_MAX)


class PlanIn(BaseModel):
    new_buildings: list[NewBuilding] = Field(default_factory=list, max_length=200)
    new_floors: list[NewFloor] = Field(default_factory=list, max_length=1000)
    floors: list[PlanFloorRow] = Field(default_factory=list, max_length=PLAN_MAX)
    areas: list[PlanAreaRow] = Field(default_factory=list, max_length=PLAN_MAX)
    items: list[str] = Field(default_factory=list, max_length=20000)


class ApplyIn(BaseModel):
    state: dict[str, Any]
    revision: int | None = Field(default=None, ge=0)
    plan: PlanIn
    kind: Literal["apply", "confirm", "auto"] = "apply"
    note: str = Field(default="", max_length=300)
    summary: dict[str, Any] = Field(default_factory=dict)


def _write_rows(conn: sqlite3.Connection, plan: PlanIn, bref: dict[str, str], fref: dict[str, str], who: str) -> dict[str, int]:
    now = now_iso()
    n = {"floor_rows": 0, "floor_rows_removed": 0, "area_rows": 0, "area_rows_removed": 0, "building_rows": 0, "building_rows_removed": 0}
    for r in plan.floors:
        if r.floor is None:
            n["floor_rows_removed"] += conn.execute("DELETE FROM home_floor_links WHERE ha_floor_id = ?", (r.ha_floor_id,)).rowcount
            continue
        conn.execute("INSERT INTO home_floor_links(ha_floor_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(ha_floor_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                     (r.ha_floor_id, fref[r.floor], now, who))
        n["floor_rows"] += 1
    for a in plan.areas:
        if a.floor == "auto":
            n["area_rows_removed"] += conn.execute("DELETE FROM home_area_links WHERE area_id = ?", (a.area_id,)).rowcount
        elif a.floor != "keep":
            conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                         "ON CONFLICT(area_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                         (a.area_id, fref[a.floor] if a.floor is not None else None, now, who))
            n["area_rows"] += 1
        if a.building is None:
            n["building_rows_removed"] += conn.execute("DELETE FROM home_area_buildings WHERE area_id = ?", (a.area_id,)).rowcount
        else:
            conn.execute("INSERT INTO home_area_buildings(area_id, building_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                         "ON CONFLICT(area_id) DO UPDATE SET building_id = excluded.building_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                         (a.area_id, bref[a.building], now, who))
            n["building_rows"] += 1
    return n


def _new_version(conn: sqlite3.Connection, site_id: str, *, kind: str, state_raw: str, before: dict[str, Any], after: dict[str, Any], items: list[str],
                 summary: dict[str, Any], note: str, who: str, restored_from: int | None = None) -> int:
    num = (conn.execute("SELECT MAX(number) FROM home_mapping_versions WHERE site_id = ?", (site_id,)).fetchone()[0] or 0) + 1
    conn.execute(
        "INSERT INTO home_mapping_versions(site_id, number, kind, restored_from, state_json, rows_before_json, rows_after_json, items_json, summary_json, note, created_at, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (site_id, num, kind, restored_from, state_raw, json.dumps(before, ensure_ascii=False), json.dumps(after, ensure_ascii=False), json.dumps(items, ensure_ascii=False),
         json.dumps(summary, ensure_ascii=False)[:20000], note, now_iso(), who),
    )
    return num


@router.post("/sites/{site_id}/mapping/apply")
def apply_mapping(site_id: str, body: ApplyIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """One transaction: create the new buildings / floors of the plan, write the rows, store the state, record a version, audit. Every id is
    checked first (a building / floor of THIS site, a platform floor / area the registry lists or a row already names); anything wrong answers
    422 and nothing is written. `kind`: apply (the assistant), confirm (the health card's "אשר"), auto (auto-insert, setting 3A)."""
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    plan = body.plan
    state_raw = _dump_state(body.state)
    st = _state_row(conn, site_id)
    if body.revision is not None and body.revision != (st["revision"] if st else 0):
        raise conflict("stale_revision", "המיפוי השתנה בינתיים במקום אחר. טענו מחדש והמשיכו.", revision=st["revision"] if st else 0)
    buildings = {r["id"] for r in _site_buildings(conn, site_id)}
    floors = {r["id"]: r["building_id"] for r in _site_floors(conn, site_id)}
    nb_keys = {b.key for b in plan.new_buildings}
    if len(nb_keys) != len(plan.new_buildings):
        raise validation("מפתח בניין חדש כפול.")
    nf_keys = {f.key for f in plan.new_floors}
    if len(nf_keys) != len(plan.new_floors):
        raise validation("מפתח קומה חדשה כפול.")

    def bcheck(ref: str) -> None:
        if ref.startswith("new:"):
            if ref[4:] not in nb_keys:
                raise validation("בניין חדש לא מוכר בתוכנית.", ref=ref)
        elif ref not in buildings:
            raise validation("הבניין לא שייך לאתר.", building=ref)

    def fcheck(ref: str) -> None:
        if ref.startswith("new:"):
            if ref[4:] not in nf_keys:
                raise validation("קומה חדשה לא מוכרת בתוכנית.", ref=ref)
        elif ref not in floors:
            raise validation("הקומה לא שייכת לאתר.", floor=ref)

    for f in plan.new_floors:
        bcheck(f.building)
    known_hf = {r[0] for r in conn.execute("SELECT floor_id FROM ha_floors").fetchall()} | {r[0] for r in conn.execute("SELECT ha_floor_id FROM home_floor_links").fetchall()}
    known_ha = ({r[0] for r in conn.execute("SELECT area_id FROM ha_areas").fetchall()} | {r[0] for r in conn.execute("SELECT area_id FROM home_area_links").fetchall()}
                | {r[0] for r in conn.execute("SELECT area_id FROM home_area_buildings").fetchall()})
    current_floor_rows = {r[0]: r[1] for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links").fetchall()}
    for r in plan.floors:
        if r.ha_floor_id not in known_hf:
            raise validation("הקומה לא נמצאה ברשימת הקומות של מערכת הבית.", ha_floor_id=r.ha_floor_id)
        if r.floor is not None:
            fcheck(r.floor)
        prev = current_floor_rows.get(r.ha_floor_id)
        if prev and prev not in floors and conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (prev,)).fetchone():
            require(conn, principal, P_CONTENT, ("floor", prev))  # taking a platform floor from another site's floor edits that floor too
    for a in plan.areas:
        if a.area_id not in known_ha:
            raise validation("האזור לא נמצא ברשימת האזורים.", area_id=a.area_id)
        if a.floor not in (None, "keep", "auto"):
            fcheck(a.floor)
        if a.building is not None:
            bcheck(a.building)

    before = site_rows(conn, site_id)
    now = now_iso()
    bref: dict[str, str] = {b: b for b in buildings}
    created_b: list[dict[str, str]] = []
    for nb in plan.new_buildings:
        bid = new_id()
        sort = (conn.execute("SELECT MAX(sort_order) FROM buildings WHERE site_id = ? AND deleted_at IS NULL", (site_id,)).fetchone()[0] or 0) + 1
        conn.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (bid, site_id, nb.name.strip(), sort, now, now))
        audit(conn, actor=principal, action="building.create", decision="allowed", resource_type="building", resource_id=bid, request_id=_rid(request),
              details={"name": nb.name, "site_id": site_id, "via": "home.mapping.apply"})
        bref[f"new:{nb.key}"] = bid
        created_b.append({"id": bid, "name": nb.name})
    fref: dict[str, str] = {f: f for f in floors}
    created_f: list[dict[str, Any]] = []
    for nf in plan.new_floors:
        fid = new_id()
        b = bref[nf.building]
        conn.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (fid, b, nf.name.strip(), nf.level, nf.level, now, now))
        audit(conn, actor=principal, action="floor.create", decision="allowed", resource_type="floor", resource_id=fid, request_id=_rid(request),
              details={"name": nf.name, "building_id": b, "level": nf.level, "via": "home.mapping.apply"})
        fref[f"new:{nf.key}"] = fid
        created_f.append({"id": fid, "name": nf.name, "building_id": b})
    counts = _write_rows(conn, plan, bref, fref, principal.user_id)
    after = site_rows(conn, site_id)
    st_rev = _save_state(conn, site_id, state_raw, principal, None)
    items = list(dict.fromkeys(plan.items))
    if body.kind != "apply":
        # "אשר" / auto-insert apply a few new names: the items the last version saw stay seen
        last = conn.execute("SELECT items_json FROM home_mapping_versions WHERE site_id = ? ORDER BY number DESC LIMIT 1", (site_id,)).fetchone()
        try:
            prev_items = json.loads(last["items_json"]) if last else []
        except ValueError:
            prev_items = []
        items = list(dict.fromkeys([*prev_items, *items]))
    summary = {**{k: v for k, v in body.summary.items() if isinstance(k, str)}, **counts, "buildings_created": len(created_b), "floors_created": len(created_f)}
    num = _new_version(conn, site_id, kind=body.kind, state_raw=state_raw, before=before, after=after, items=items, summary=summary, note=body.note, who=principal.user_id)
    audit(conn, actor=principal, action="home.mapping.apply", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request),
          details={"version": num, "kind": body.kind, **counts, "buildings_created": [b["id"] for b in created_b], "floors_created": [f["id"] for f in created_f]})
    return {"version": num, "revision": st_rev, "created": {"buildings": created_b, "floors": created_f}, "counts": counts, "links": after}


@router.post("/sites/{site_id}/mapping/versions/{number}/restore")
def restore_version(site_id: str, number: int, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"חזרה לגרסה זו": a NEW version whose rows and state are the chosen version's. Only this site's rows change; rows that name a floor or
    a building deleted since are skipped (counted)."""
    get_site(conn, site_id)
    require(conn, principal, P_CONTENT, ("site", site_id))
    v = conn.execute("SELECT * FROM home_mapping_versions WHERE site_id = ? AND number = ?", (site_id, number)).fetchone()
    if not v:
        raise ApiError(404, "not_found", "הגרסה לא נמצאה.")
    target = json.loads(v["rows_after_json"])
    before = site_rows(conn, site_id)
    floors = {r["id"] for r in _site_floors(conn, site_id)}
    buildings = {r["id"] for r in _site_buildings(conn, site_id)}
    for r in before["floors"]:
        conn.execute("DELETE FROM home_floor_links WHERE ha_floor_id = ?", (r["ha_floor_id"],))
    for r in before["areas"]:
        conn.execute("DELETE FROM home_area_links WHERE area_id = ?", (r["area_id"],))
    for r in before["buildings"]:
        conn.execute("DELETE FROM home_area_buildings WHERE area_id = ?", (r["area_id"],))
    now = now_iso()
    skipped = 0
    for r in target.get("floors", []):
        if r["floor_id"] not in floors:
            skipped += 1
            continue
        conn.execute("INSERT INTO home_floor_links(ha_floor_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(ha_floor_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                     (r["ha_floor_id"], r["floor_id"], now, principal.user_id))
    for r in target.get("areas", []):
        if r["floor_id"] is not None and r["floor_id"] not in floors:
            skipped += 1
            continue
        conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(area_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                     (r["area_id"], r["floor_id"], now, principal.user_id))
    for r in target.get("buildings", []):
        if r["building_id"] not in buildings:
            skipped += 1
            continue
        conn.execute("INSERT INTO home_area_buildings(area_id, building_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(area_id) DO UPDATE SET building_id = excluded.building_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                     (r["area_id"], r["building_id"], now, principal.user_id))
    after = site_rows(conn, site_id)
    rev = _save_state(conn, site_id, v["state_json"], principal, None)
    items = json.loads(v["items_json"] or "[]")
    num = _new_version(conn, site_id, kind="restore", state_raw=v["state_json"], before=before, after=after, items=items,
                       summary={"restored_from": number, "skipped": skipped}, note="", who=principal.user_id, restored_from=number)
    audit(conn, actor=principal, action="home.mapping.restore", decision="allowed", resource_type="site", resource_id=site_id, request_id=_rid(request),
          details={"version": num, "restored_from": number, "skipped": skipped})
    return {"version": num, "revision": rev, "skipped": skipped, "links": after}
