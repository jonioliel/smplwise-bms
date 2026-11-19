"""The SQL of the sites / buildings / floors router (routers/catalog.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement
the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the checks,
the audit and the shaping; each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- reads

def live_site(conn: sqlite3.Connection, site_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM sites WHERE id = ? AND deleted_at IS NULL", (site_id,)).fetchone()


def live_building(conn: sqlite3.Connection, building_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM buildings WHERE id = ? AND deleted_at IS NULL", (building_id,)).fetchone()


def live_floor(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone()


def live_sites(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()


def site_buildings(conn: sqlite3.Connection, site_id: str) -> Rows:
    return conn.execute("SELECT * FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (site_id,)).fetchall()


def building_floors(conn: sqlite3.Connection, building_id: str) -> Rows:
    return conn.execute("SELECT * FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY level DESC, sort_order, name", (building_id,)).fetchall()


def published_plan(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, width_px, height_px, published_at FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone()


def newest_draft_plan(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id FROM plan_versions WHERE floor_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()


def floor_anchor_count(conn: sqlite3.Connection, floor_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (floor_id,)).fetchone()[0]


def floor_camera_count(conn: sqlite3.Connection, floor_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = 'camera'", (floor_id,)).fetchone()[0]


def live_building_count(conn: sqlite3.Connection, site_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM buildings WHERE site_id = ? AND deleted_at IS NULL", (site_id,)).fetchone()[0]


def live_floor_count(conn: sqlite3.Connection, building_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM floors WHERE building_id = ? AND deleted_at IS NULL", (building_id,)).fetchone()[0]


def live_floor_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()}


def live_floor_buildings(conn: sqlite3.Connection) -> Rows:
    """(id, building_id) of every live floor."""
    return conn.execute("SELECT id, building_id FROM floors WHERE deleted_at IS NULL").fetchall()


def user_ids(conn: sqlite3.Connection) -> list[str]:
    return [r[0] for r in conn.execute("SELECT id FROM users").fetchall()]


# ---------------------------------------------------------------- writes: sites, buildings, floors

def set_site_image(conn: sqlite3.Connection, site_id: str, rel: str | None, at: str) -> None:
    if rel is None:
        conn.execute("UPDATE sites SET image_path = NULL, updated_at = ? WHERE id = ?", (at, site_id))
    else:
        conn.execute("UPDATE sites SET image_path = ?, updated_at = ? WHERE id = ?", (rel, at, site_id))


def set_building_image(conn: sqlite3.Connection, building_id: str, rel: str | None, at: str) -> None:
    if rel is None:
        conn.execute("UPDATE buildings SET image_path = NULL, updated_at = ? WHERE id = ?", (at, building_id))
    else:
        conn.execute("UPDATE buildings SET image_path = ?, updated_at = ? WHERE id = ?", (rel, at, building_id))


def insert_site(conn: sqlite3.Connection, site_id: str, name: str, address: str, timezone: str, sort_order: int, at: str) -> None:
    conn.execute("INSERT INTO sites(id, name, address, timezone, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 (site_id, name, address, timezone, sort_order, at, at))


def insert_building(conn: sqlite3.Connection, building_id: str, site_id: str, name: str, sort_order: int, at: str) -> None:
    conn.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (building_id, site_id, name, sort_order, at, at))


def insert_floor(conn: sqlite3.Connection, floor_id: str, building_id: str, name: str, level: int, sort_order: int, at: str) -> None:
    conn.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (floor_id, building_id, name, level, sort_order, at, at))


_PATCHABLE = {"sites", "buildings", "floors"}


def patch_row(conn: sqlite3.Connection, table: str, row_id: str, fields: dict[str, Any], at: str) -> None:
    """UPDATE <table> SET <fields>, updated_at WHERE id. `fields` keys come from the route's request model, never from input text."""
    assert table in _PATCHABLE
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE {table} SET {sets}, updated_at = ? WHERE id = ?", (*fields.values(), at, row_id))


def soft_delete_site(conn: sqlite3.Connection, site_id: str, deleted_at: str, updated_at: str) -> None:
    conn.execute("UPDATE sites SET deleted_at = ?, updated_at = ? WHERE id = ?", (deleted_at, updated_at, site_id))


def soft_delete_building(conn: sqlite3.Connection, building_id: str, deleted_at: str, updated_at: str) -> None:
    conn.execute("UPDATE buildings SET deleted_at = ?, updated_at = ? WHERE id = ?", (deleted_at, updated_at, building_id))


def end_floor_anchors(conn: sqlite3.Connection, floor_id: str, at: str, user_id: str | None) -> None:
    conn.execute("UPDATE map_anchors SET effective_to = ?, updated_at = ?, updated_by = ? WHERE floor_id = ? AND effective_to IS NULL", (at, at, user_id, floor_id))


def archive_floor_plans(conn: sqlite3.Connection, floor_id: str, at: str) -> None:
    conn.execute("UPDATE plan_versions SET status = 'archived', archived_at = ? WHERE floor_id = ? AND status != 'archived'", (at, floor_id))


def soft_delete_floor(conn: sqlite3.Connection, floor_id: str, at: str) -> None:
    conn.execute("UPDATE floors SET deleted_at = ?, updated_at = ? WHERE id = ?", (at, at, floor_id))


# ---------------------------------------------------------------- home-platform links (SYNOPTIC-HA-2310)

def floor_link_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links ORDER BY ha_floor_id").fetchall()


def area_link_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT area_id, floor_id FROM home_area_links ORDER BY area_id").fetchall()


def area_building_rows(conn: sqlite3.Connection) -> Rows:
    """The area -> live building rows (MAPPING-ASSIST-2330). Raises sqlite3.OperationalError before migration 0189."""
    return conn.execute("SELECT a.area_id, a.building_id FROM home_area_buildings a JOIN buildings b ON b.id = a.building_id AND b.deleted_at IS NULL ORDER BY a.area_id").fetchall()


def floor_links(conn: sqlite3.Connection) -> dict[str, str]:
    """platform floor id -> our floor id."""
    return {r[0]: r[1] for r in conn.execute("SELECT ha_floor_id, floor_id FROM home_floor_links").fetchall()}


def area_links(conn: sqlite3.Connection) -> dict[str, str | None]:
    """platform area id -> our floor id (None: taken off every floor)."""
    return {r[0]: r[1] for r in conn.execute("SELECT area_id, floor_id FROM home_area_links").fetchall()}


def platform_floor_known(conn: sqlite3.Connection, ha_floor_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_floors WHERE floor_id = ?", (ha_floor_id,)).fetchone() is not None


def platform_area_known(conn: sqlite3.Connection, area_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone() is not None


def delete_floor_link(conn: sqlite3.Connection, ha_floor_id: str) -> int:
    return conn.execute("DELETE FROM home_floor_links WHERE ha_floor_id = ?", (ha_floor_id,)).rowcount


def put_floor_link(conn: sqlite3.Connection, ha_floor_id: str, floor_id: str, at: str, user_id: str | None) -> None:
    conn.execute("INSERT INTO home_floor_links(ha_floor_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                 "ON CONFLICT(ha_floor_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                 (ha_floor_id, floor_id, at, user_id))


def include_area(conn: sqlite3.Connection, area_id: str, floor_id: str | None, at: str, user_id: str | None) -> None:
    conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                 "ON CONFLICT(area_id) DO UPDATE SET floor_id = excluded.floor_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                 (area_id, floor_id, at, user_id))


def exclude_area(conn: sqlite3.Connection, area_id: str, at: str, user_id: str | None) -> None:
    conn.execute("INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES (?, NULL, ?, ?) "
                 "ON CONFLICT(area_id) DO UPDATE SET floor_id = NULL, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
                 (area_id, at, user_id))


def delete_area_link(conn: sqlite3.Connection, area_id: str) -> int:
    return conn.execute("DELETE FROM home_area_links WHERE area_id = ?", (area_id,)).rowcount
