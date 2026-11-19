"""The SQL of the mapping assistant router (routers/home_mapping.py; CR-ROUTER-SQL-2450, review 05:P2-07 and 05:P2-09): every
statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls), plus the five helpers
services/mapping_auto.py imported back from the router (`site_buildings`, `site_floors`, `site_rows`, `labels`, `new_version`;
the router keeps its old underscore names as aliases). The router keeps the checks, the audit and the shaping; each function runs
on the connection the route hands it.

The home-link row writes (`home_floor_links`, `home_area_links`) are the ones of services/catalog_store.py (the same statements)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..db import now_iso
from .catalog_store import delete_area_link, delete_floor_link, include_area, put_floor_link

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- the site's catalogue and rows

def site_buildings(conn: sqlite3.Connection, site_id: str) -> Rows:
    return conn.execute("SELECT * FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (site_id,)).fetchall()


def site_floors(conn: sqlite3.Connection, site_id: str) -> Rows:
    return conn.execute(
        "SELECT f.* FROM floors f JOIN buildings b ON b.id = f.building_id WHERE b.site_id = ? AND b.deleted_at IS NULL AND f.deleted_at IS NULL ORDER BY f.level DESC, f.sort_order",
        (site_id,),
    ).fetchall()


def site_rows(conn: sqlite3.Connection, site_id: str) -> dict[str, list[dict[str, Any]]]:
    """The mapping rows that concern this site: floor / area rows on its floors, area rows taken off every floor (they name no place),
    and area -> building rows of its buildings. Sorted, so two snapshots compare as JSON."""
    floors = {r["id"] for r in site_floors(conn, site_id)}
    buildings = {r["id"] for r in site_buildings(conn, site_id)}
    fl = [{"ha_floor_id": r[0], "floor_id": r[1]} for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links ORDER BY ha_floor_id").fetchall() if r[1] in floors]
    ar = [{"area_id": r[0], "floor_id": r[1]} for r in conn.execute("SELECT area_id, floor_id FROM home_area_links ORDER BY area_id").fetchall() if r[1] is None or r[1] in floors]
    bl = [{"area_id": r[0], "building_id": r[1]} for r in conn.execute("SELECT area_id, building_id FROM home_area_buildings ORDER BY area_id").fetchall() if r[1] in buildings]
    return {"floors": fl, "areas": ar, "buildings": bl}


def live_site_ids(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL").fetchall()]


def live_floor_exists(conn: sqlite3.Connection, floor_id: str) -> bool:
    return conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone() is not None


def next_building_sort(conn: sqlite3.Connection, site_id: str) -> int:
    return (conn.execute("SELECT MAX(sort_order) FROM buildings WHERE site_id = ? AND deleted_at IS NULL", (site_id,)).fetchone()[0] or 0) + 1


def insert_building(conn: sqlite3.Connection, building_id: str, site_id: str, name: str, sort_order: int, at: str) -> None:
    conn.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (building_id, site_id, name, sort_order, at, at))


def insert_floor(conn: sqlite3.Connection, floor_id: str, building_id: str, name: str, level: int, at: str) -> None:
    """A floor the assistant creates: its sort order is its level."""
    conn.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (floor_id, building_id, name, level, level, at, at))


# ---------------------------------------------------------------- the platform registry (read-only mirror)

def labels(conn: sqlite3.Connection) -> tuple[dict[str, list[str]], list[dict[str, Any]], str | None]:
    """HA-LABELS-SYNC-2351: the home system's labels as the sync mirrored them (read-only). Returns each area's label NAMES in the area's
    own order (what the engine's "בתווית" rules and label conflicts read; an id the label table does not know is skipped), the label
    catalogue with how many areas carry each, and when the label registry was last listed (None = never: an old core, or not synced yet)."""
    by_area: dict[str, list[str]] = {}
    for r in conn.execute("SELECT al.area_id, l.name FROM ha_area_labels al JOIN ha_labels l ON l.label_id = al.label_id ORDER BY al.area_id, al.position").fetchall():
        by_area.setdefault(r["area_id"], []).append(r["name"])
    catalogue = [{"id": r["label_id"], "name": r["name"], "color": r["color"], "icon": r["icon"], "areas": r["n"]} for r in conn.execute(
        "SELECT l.label_id, l.name, l.color, l.icon, (SELECT COUNT(*) FROM ha_area_labels al JOIN ha_areas a ON a.area_id = al.area_id WHERE al.label_id = l.label_id) AS n"
        " FROM ha_labels l ORDER BY l.position, l.name").fetchall()]
    row = conn.execute("SELECT synced_at FROM ha_label_sync WHERE id = 1").fetchone()
    return by_area, catalogue, row["synced_at"] if row else None


def platform_floors(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT floor_id, name, level FROM ha_floors ORDER BY position, name").fetchall()


def platform_areas(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT area_id, name, floor_id FROM ha_areas ORDER BY position, name").fetchall()


def known_platform_floors(conn: sqlite3.Connection) -> set[str]:
    """The platform floor ids the registry lists or a row already names."""
    return {r[0] for r in conn.execute("SELECT floor_id FROM ha_floors").fetchall()} | {r[0] for r in conn.execute("SELECT ha_floor_id FROM home_floor_links").fetchall()}


def known_platform_areas(conn: sqlite3.Connection) -> set[str]:
    """The platform area ids the registry lists or a row already names."""
    return ({r[0] for r in conn.execute("SELECT area_id FROM ha_areas").fetchall()} | {r[0] for r in conn.execute("SELECT area_id FROM home_area_links").fetchall()}
            | {r[0] for r in conn.execute("SELECT area_id FROM home_area_buildings").fetchall()})


def floor_link_map(conn: sqlite3.Connection) -> dict[str, str]:
    """platform floor id -> our floor id."""
    return {r[0]: r[1] for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links").fetchall()}


# ---------------------------------------------------------------- the assistant's state

def state_row(conn: sqlite3.Connection, site_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM home_mapping_state WHERE site_id = ?", (site_id,)).fetchone()


def update_state(conn: sqlite3.Connection, site_id: str, raw: str, revision: int, at: str, who: str | None) -> None:
    conn.execute("UPDATE home_mapping_state SET state_json = ?, revision = ?, updated_at = ?, updated_by = ? WHERE site_id = ?", (raw, revision, at, who, site_id))


def insert_state(conn: sqlite3.Connection, site_id: str, raw: str, revision: int, at: str, who: str | None) -> None:
    conn.execute("INSERT INTO home_mapping_state(site_id, state_json, settings_json, revision, updated_at, updated_by) VALUES (?, ?, '{}', ?, ?, ?)", (site_id, raw, revision, at, who))


def update_settings(conn: sqlite3.Connection, site_id: str, raw: str, at: str, who: str | None) -> None:
    conn.execute("UPDATE home_mapping_state SET settings_json = ?, updated_at = ?, updated_by = ? WHERE site_id = ?", (raw, at, who, site_id))


def insert_settings(conn: sqlite3.Connection, site_id: str, raw: str, at: str, who: str | None) -> None:
    conn.execute("INSERT INTO home_mapping_state(site_id, state_json, settings_json, revision, updated_at, updated_by) VALUES (?, '{}', ?, 0, ?, ?)", (site_id, raw, at, who))


# ---------------------------------------------------------------- versions

def version_rows(conn: sqlite3.Connection, site_id: str) -> Rows:
    """The newest 50 versions with their author's names."""
    return conn.execute(
        "SELECT v.number, v.kind, v.restored_from, v.created_at, v.created_by, v.summary_json, v.note, u.display_name, u.username "
        "FROM home_mapping_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.site_id = ? ORDER BY v.number DESC LIMIT 50",
        (site_id,),
    ).fetchall()


def last_items(conn: sqlite3.Connection, site_id: str) -> sqlite3.Row | None:
    """items_json of the newest version, or None."""
    return conn.execute("SELECT items_json FROM home_mapping_versions WHERE site_id = ? ORDER BY number DESC LIMIT 1", (site_id,)).fetchone()


def version(conn: sqlite3.Connection, site_id: str, number: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM home_mapping_versions WHERE site_id = ? AND number = ?", (site_id, number)).fetchone()


def new_version(conn: sqlite3.Connection, site_id: str, *, kind: str, state_raw: str, before: dict[str, Any], after: dict[str, Any], items: list[str],
                summary: dict[str, Any], note: str, who: str, restored_from: int | None = None) -> int:
    num = (conn.execute("SELECT MAX(number) FROM home_mapping_versions WHERE site_id = ?", (site_id,)).fetchone()[0] or 0) + 1
    conn.execute(
        "INSERT INTO home_mapping_versions(site_id, number, kind, restored_from, state_json, rows_before_json, rows_after_json, items_json, summary_json, note, created_at, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (site_id, num, kind, restored_from, state_raw, json.dumps(before, ensure_ascii=False), json.dumps(after, ensure_ascii=False), json.dumps(items, ensure_ascii=False),
         json.dumps(summary, ensure_ascii=False)[:20000], note, now_iso(), who),
    )
    return num


# ---------------------------------------------------------------- row writes

def delete_area_building(conn: sqlite3.Connection, area_id: str) -> int:
    return conn.execute("DELETE FROM home_area_buildings WHERE area_id = ?", (area_id,)).rowcount


def put_area_building(conn: sqlite3.Connection, area_id: str, building_id: str, at: str, who: str | None) -> None:
    conn.execute("INSERT INTO home_area_buildings(area_id, building_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                 "ON CONFLICT(area_id) DO UPDATE SET building_id = excluded.building_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                 (area_id, building_id, at, who))


def write_rows(conn: sqlite3.Connection, plan: Any, bref: dict[str, str], fref: dict[str, str], who: str) -> dict[str, int]:
    """Write the rows of a checked plan (routers/home_mapping.PlanIn: `floors`, `areas`); `bref` / `fref` resolve the plan's building /
    floor references (an id of the site, or new:<key>) to ids. Returns the counts written and removed."""
    now = now_iso()
    n = {"floor_rows": 0, "floor_rows_removed": 0, "area_rows": 0, "area_rows_removed": 0, "building_rows": 0, "building_rows_removed": 0}
    for r in plan.floors:
        if r.floor is None:
            n["floor_rows_removed"] += delete_floor_link(conn, r.ha_floor_id)
            continue
        put_floor_link(conn, r.ha_floor_id, fref[r.floor], now, who)
        n["floor_rows"] += 1
    for a in plan.areas:
        if a.floor == "auto":
            n["area_rows_removed"] += delete_area_link(conn, a.area_id)
        elif a.floor != "keep":
            include_area(conn, a.area_id, fref[a.floor] if a.floor is not None else None, now, who)
            n["area_rows"] += 1
        if a.building is None:
            n["building_rows_removed"] += delete_area_building(conn, a.area_id)
        else:
            put_area_building(conn, a.area_id, bref[a.building], now, who)
            n["building_rows"] += 1
    return n
