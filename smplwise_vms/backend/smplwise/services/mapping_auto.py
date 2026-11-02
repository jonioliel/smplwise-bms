"""MAPPING-IMPROVE-2351: auto-insert in the background (setting 3A `auto_insert` = on).

Before: with auto-insert on, the home system's new floors / areas went in only when someone with site.content.configure opened the settings
page (the engine ran in the browser). Now this job places them on every home-system structure refresh that changed the mirror
(services/ha_sync.py) and once at startup (main.py), per the stored rules (services/mapping_engine.py, the browser engine's port).

Rules of the job:
- Only sites with `auto_insert` on that were applied at least once (a version exists: "new" means not seen by the last version).
- Only NEW names that the stored table / rules / manual answers / floor inheritance place with no open question. A floor that has no level
  (none in the home system, none in its name) and no answer in "קומות ללא מפלס" is not placed - it waits for the assistant; its areas do not
  inherit from it meanwhile.
- Never moves what the user already placed: a new name that already has a row (layer 1 floor row, layer 2 area row, area -> building row) is
  left exactly as it is (counted as kept in the audit; it stays "new" on the health card for the user to look at). Rows are only INSERTED here, never updated or deleted.
- Database write gate rules: every read happens in a read transaction, the engine runs with no transaction open, and each site's write is one
  short IMMEDIATE transaction that re-checks what it read (the last version, the settings, the rows, the floors / buildings) and gives up on
  any change - the next refresh recomputes. No network I/O anywhere in this module.
- Each write is a version (kind `auto`, summary `auto_added`) and an audit row `home.mapping.apply` (actor: the system, details.kind auto).
  New buildings / floors the plan needs are created like the assistant does, audited with `via: home.mapping.auto`.
- Idempotent: a second run finds nothing new (every placed name is in the version's items).
"""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
from dataclasses import dataclass
from typing import Any

from ..audit import audit
from ..db import new_id, now_iso
from . import mapping_engine as eng

log = logging.getLogger(__name__)

_run_lock = threading.Lock()  # one run at a time in this process (a refresh burst and the startup run never interleave)


@dataclass
class _Snap:
    site_id: str
    version: int
    seen: list[str]
    state_raw: str
    state: dict[str, Any]
    settings: dict[str, str]
    items: list[eng.Item]
    buildings: list[dict[str, Any]]
    floors: list[dict[str, Any]]
    links: dict[str, list[dict[str, Any]]]


def _settings(raw: str | None) -> dict[str, str]:
    try:
        o = json.loads(raw or "{}")
    except ValueError:
        o = {}
    out = dict(eng.SETTINGS_DEFAULT)
    if isinstance(o, dict):
        out.update({k: v for k, v in o.items() if k in out and isinstance(v, str)})
    return out


def _snapshot(conn: sqlite3.Connection, site_id: str, state_json: str, settings_json: str) -> _Snap | None:
    from ..routers.home_mapping import _labels, _site_buildings, _site_floors

    if not conn.execute("SELECT 1 FROM sites WHERE id = ? AND deleted_at IS NULL", (site_id,)).fetchone():
        return None
    last = conn.execute("SELECT number, items_json FROM home_mapping_versions WHERE site_id = ? ORDER BY number DESC LIMIT 1", (site_id,)).fetchone()
    if not last:
        return None  # never applied: everything is "new" - the assistant decides, not the job
    try:
        seen = json.loads(last["items_json"] or "[]")
        state = json.loads(state_json or "{}")
    except ValueError:
        return None
    items = [eng.Item(id=r["floor_id"], kind="floor", name=r["name"], level=r["level"]) for r in conn.execute("SELECT floor_id, name, level FROM ha_floors ORDER BY position, name")]
    # 2360 train: the labels the sync mirrors (HA-LABELS-SYNC-2351), read exactly as the assistant's read route serves them, so the job
    # and the browser reach the same answer ("בתווית" rules, label conflicts left open)
    area_labels = _labels(conn)[0]
    items += [eng.Item(id=r["area_id"], kind="area", name=r["name"], floor_id=r["floor_id"], labels=area_labels.get(r["area_id"], [])) for r in conn.execute("SELECT area_id, name, floor_id FROM ha_areas ORDER BY position, name")]
    buildings = [{"id": b["id"], "name": b["name"]} for b in _site_buildings(conn, site_id)]
    floors = [{"id": f["id"], "building_id": f["building_id"], "name": f["name"], "level": f["level"]} for f in _site_floors(conn, site_id)]
    all_links = {
        # every row, not only this site's: a name placed on another site's floor is placed too
        "floors": [dict(r) for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links")],
        "areas": [dict(r) for r in conn.execute("SELECT area_id, floor_id FROM home_area_links")],
        "buildings": [dict(r) for r in conn.execute("SELECT area_id, building_id FROM home_area_buildings")],
    }
    return _Snap(site_id, last["number"], seen if isinstance(seen, list) else [], state_json or "{}", eng.state_of(state), _settings(settings_json), items, buildings, floors, all_links)


@dataclass
class _Work:
    plan: dict[str, Any]
    added: list[str]  # item keys placed now
    kept: list[str]  # new item keys the user had already placed (rows left as they are)


def compute(s: _Snap) -> _Work | None:
    """What the job would do for one site. Pure."""
    seen = set(s.seen)
    fresh = [it for it in s.items if it.key not in seen]
    if not fresh:
        return None
    placed_floor = {r["ha_floor_id"] for r in s.links["floors"]}
    placed_area = {r["area_id"] for r in s.links["areas"]} | {r["area_id"] for r in s.links["buildings"]}
    kept = [it.key for it in fresh if (it.kind == "floor" and it.id in placed_floor) or (it.kind == "area" and it.id in placed_area)]
    # floors that would need a level answer stay open (and their areas do not inherit from them)
    res = eng.resolve(s.items, s.state, s.buildings, s.settings)
    asked: list[dict[str, Any]] = []
    eng.build_plan(s.items, res, s.buildings, s.floors, s.links, s.state["levels"], asked)
    unleveled = frozenset(f"f:{a['id']}" for a in asked if not a["answer"])
    if unleveled:
        res = eng.resolve(s.items, s.state, s.buildings, s.settings, force_open=unleveled)
    plan = eng.build_plan(s.items, res, s.buildings, s.floors, s.links, s.state["levels"])
    keep = set(kept)
    ready = [it.key for it in fresh if it.key not in keep and (r := res.get(it.key)) is not None and not r.open and r.to and r.to["t"] != "none"]
    if not ready:
        return None  # a version is written only when something is placed (the kept ones stay on the health card, untouched)
    sub = eng.subset_plan(plan, set(ready))
    # never a delete / take-off from here: only rows that ADD a place for a name with none
    sub["floors"] = [f for f in sub["floors"] if f["floor"] is not None]
    sub["areas"] = [a for a in sub["areas"] if a["floor"] not in ("auto",) and not (a["floor"] is None and a["building"] is None)]
    sub = eng.subset_plan(sub, set(ready))  # prune again after the filter
    return _Work(plan=sub, added=ready, kept=kept)


def _write(conn: sqlite3.Connection, s: _Snap, w: _Work, reason: str) -> int | None:
    """One short transaction (the caller's). Re-checks the snapshot; None = something moved, nothing written."""
    from ..routers.home_mapping import _new_version, _site_buildings, _site_floors, site_rows

    st = conn.execute("SELECT settings_json, state_json FROM home_mapping_state WHERE site_id = ?", (s.site_id,)).fetchone()
    last = conn.execute("SELECT MAX(number) FROM home_mapping_versions WHERE site_id = ?", (s.site_id,)).fetchone()[0]
    if not st or last != s.version or _settings(st["settings_json"]).get("auto_insert") != "on" or (st["state_json"] or "{}") != s.state_raw:
        return None
    buildings = {r["id"] for r in _site_buildings(conn, s.site_id)}
    floors = {r["id"] for r in _site_floors(conn, s.site_id)}
    plan = w.plan
    for f in plan["floors"]:
        if conn.execute("SELECT 1 FROM home_floor_links WHERE ha_floor_id = ?", (f["ha_floor_id"],)).fetchone():
            return None
        if not f["floor"].startswith("new:") and f["floor"] not in floors:
            return None
    for a in plan["areas"]:
        if conn.execute("SELECT 1 FROM home_area_links WHERE area_id = ? UNION ALL SELECT 1 FROM home_area_buildings WHERE area_id = ?", (a["area_id"], a["area_id"])).fetchone():
            return None
        for ref, pool in ((a["floor"], floors), (a["building"], buildings)):
            if isinstance(ref, str) and ref != "keep" and not ref.startswith("new:") and ref not in pool:
                return None
    for nf in plan["new_floors"]:
        if not nf["building"].startswith("new:") and nf["building"] not in buildings:
            return None
    before = site_rows(conn, s.site_id)
    now = now_iso()
    bref: dict[str, str] = {}
    created_b: list[str] = []
    for nb in plan["new_buildings"]:
        bid = new_id()
        sort = (conn.execute("SELECT MAX(sort_order) FROM buildings WHERE site_id = ? AND deleted_at IS NULL", (s.site_id,)).fetchone()[0] or 0) + 1
        conn.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (bid, s.site_id, nb["name"].strip(), sort, now, now))
        audit(conn, actor=None, action="building.create", decision="allowed", resource_type="building", resource_id=bid, details={"name": nb["name"], "site_id": s.site_id, "via": "home.mapping.auto"})
        bref[f"new:{nb['key']}"] = bid
        created_b.append(bid)
    fref: dict[str, str] = {}
    created_f: list[str] = []
    for nf in plan["new_floors"]:
        fid = new_id()
        b = bref.get(nf["building"], nf["building"])
        conn.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (fid, b, nf["name"].strip(), nf["level"], nf["level"], now, now))
        audit(conn, actor=None, action="floor.create", decision="allowed", resource_type="floor", resource_id=fid, details={"name": nf["name"], "building_id": b, "level": nf["level"], "via": "home.mapping.auto"})
        fref[f"new:{nf['key']}"] = fid
        created_f.append(fid)
    counts = {"floor_rows": 0, "area_rows": 0, "building_rows": 0}
    for f in plan["floors"]:
        n = conn.execute("INSERT INTO home_floor_links(ha_floor_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, NULL) ON CONFLICT(ha_floor_id) DO NOTHING",
                         (f["ha_floor_id"], fref.get(f["floor"], f["floor"]), now)).rowcount
        counts["floor_rows"] += n
    for a in plan["areas"]:
        if a["floor"] not in ("keep", None):
            counts["area_rows"] += conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, NULL) ON CONFLICT(area_id) DO NOTHING",
                                                (a["area_id"], fref.get(a["floor"], a["floor"]), now)).rowcount
        elif a["floor"] is None:
            counts["area_rows"] += conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, NULL, ?, NULL) ON CONFLICT(area_id) DO NOTHING", (a["area_id"], now)).rowcount
        if a["building"]:
            counts["building_rows"] += conn.execute("INSERT INTO home_area_buildings(area_id, building_id, updated_at, updated_by) VALUES (?, ?, ?, NULL) ON CONFLICT(area_id) DO NOTHING",
                                                    (a["area_id"], bref.get(a["building"], a["building"]), now)).rowcount
    after = site_rows(conn, s.site_id)
    items = list(dict.fromkeys([*s.seen, *w.added]))
    n_areas = sum(1 for k in w.added if k.startswith("a:"))
    n_floors = len(w.added) - n_areas
    summary = {"auto_added": len(w.added), "auto_areas": n_areas, "auto_floors": n_floors, "kept_manual": len(w.kept), "reason": reason, **counts,
               "buildings_created": len(created_b), "floors_created": len(created_f)}
    num = _new_version(conn, s.site_id, kind="auto", state_raw=s.state_raw, before=before, after=after, items=items, summary=summary, note="", who=None)  # type: ignore[arg-type]
    audit(conn, actor=None, action="home.mapping.apply", decision="allowed", resource_type="site", resource_id=s.site_id,
          details={"version": num, "kind": "auto", "reason": reason, "added": w.added[:200], "kept": w.kept[:200], **counts, "buildings_created": created_b, "floors_created": created_f})
    return num


def run(db: Any, reason: str = "registry") -> dict[str, int]:
    """One pass over every site with auto-insert on. Returns site_id -> the version written (sites with nothing to do are absent)."""
    out: dict[str, int] = {}
    with _run_lock:
        with db.connection(mode="read", label="home.mapping.auto.read") as conn:
            try:
                rows = conn.execute("SELECT site_id, state_json, settings_json FROM home_mapping_state").fetchall()
            except sqlite3.OperationalError:
                return out  # a database before migration 0189
            snaps = [s for r in rows if _settings(r["settings_json"]).get("auto_insert") == "on" and (s := _snapshot(conn, r["site_id"], r["state_json"], r["settings_json"]))]
        for s in snaps:
            w = compute(s)  # no transaction open
            if not w:
                continue
            with db.connection(label="home.mapping.auto") as conn:
                num = _write(conn, s, w, reason)
            if num is not None:
                out[s.site_id] = num
                log.info("mapping auto-insert (%s): site %s version %s, %d placed, %d kept", reason, s.site_id, num, len(w.added), len(w.kept))
    return out


def run_safe(db: Any, reason: str) -> None:
    """For the event hook and the startup thread: never raises (a failed pass is logged; the next refresh tries again)."""
    try:
        run(db, reason)
    except Exception:  # noqa: BLE001
        log.exception("mapping auto-insert (%s) failed", reason)
