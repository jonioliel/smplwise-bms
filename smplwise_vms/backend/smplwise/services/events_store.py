"""The SQL of the event centre router (routers/events.py; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the scope checks,
the caching and the shaping; the connection a function runs on is the one the route hands it (read or write, as before)."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- events

def event_row(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()


def event_camera(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT camera_id FROM events WHERE id = ?", (event_id,)).fetchone()


def events_between(conn: sqlite3.Connection, start: str, end: str) -> Rows:
    return conn.execute("SELECT * FROM events WHERE occurred_at >= ? AND occurred_at < ?", (start, end)).fetchall()


def camera_events_between(conn: sqlite3.Connection, camera_id: str, start: str, end: str) -> Rows:
    return conn.execute("SELECT * FROM events WHERE camera_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at", (camera_id, start, end)).fetchall()


def list_window_rows(conn: sqlite3.Connection, start: str, end: str, camera_id: str | None, recorder_id: str | None, type: str | None,
                     source: str | None, severity: str | None, q: str | None, place: tuple[set[str], set[str], Any] | None,
                     unacked: bool, acked: bool, fetch: int) -> Rows:
    """The rows of the events list window, newest first, at most `fetch` of them (the filters of GET /events)."""
    sql = "SELECT * FROM events WHERE occurred_at >= ? AND occurred_at < ?"
    args: list[Any] = [start, end]
    if camera_id:
        sql += " AND camera_id = ?"
        args.append(camera_id)
    if recorder_id:  # CR-024: the recorder's own alert-stream events and every event of one of its cameras
        sql += " AND (recorder_id = ? OR camera_id IN (SELECT id FROM cameras WHERE recorder_id = ?))"
        args.extend([recorder_id, recorder_id])
    if type:
        sql += " AND type = ?"
        args.append(type)
    if source:
        sql += " AND source = ?"
        args.append(source)
    if severity:
        sql += " AND severity = ?"
        args.append(severity)
    if q:
        like = f"%{q}%"
        sql += " AND (details_json LIKE ? OR camera_id IN (SELECT id FROM cameras WHERE alias LIKE ? OR name_source LIKE ?))"
        args.extend([like, like, like])
    if place is not None:
        cams, ents, _ = place
        parts = []
        if cams:
            parts.append(f"camera_id IN ({','.join('?' * len(cams))})")
            args.extend(sorted(cams))
        if ents:
            parts.append(f"(source = 'ha' AND json_extract(details_json, '$.entity_id') IN ({','.join('?' * len(ents))}))")
            args.extend(sorted(ents))
        sql += " AND (" + " OR ".join(parts) + ")" if parts else " AND 0"
    if unacked:
        sql += " AND acked_at IS NULL"
    if acked:
        sql += " AND acked_at IS NOT NULL"
    sql += " ORDER BY occurred_at DESC LIMIT ?"
    args.append(fetch)
    return conn.execute(sql, args).fetchall()


def facet_rows(conn: sqlite3.Connection, since: str) -> Rows:
    """(type, source, severity, camera_id, n) of the events that occurred at or after `since`. SOAK-DBGROWTH-2412: whole UTC
    days come from events_facet_days (migration 0210, kept by triggers in the same transaction as every event write), only
    the first, partial day is counted from the events table - the numbers of the old GROUP BY over every row of the
    period, at the cost of one day of events instead of all of them (~490 ms at 677k rows in the soak, linear)."""
    first_day = since[:10]
    next_day = (dt.date.fromisoformat(first_day) + dt.timedelta(days=1)).isoformat()  # "YYYY-MM-DD" sorts before any time of that day
    return conn.execute(
        "SELECT type, source, severity, camera_id, SUM(n) AS n FROM ("
        " SELECT type, source, severity, NULLIF(camera_key, '') AS camera_id, n FROM events_facet_days WHERE day > ?"
        " UNION ALL SELECT type, source, severity, camera_id, 1 AS n FROM events WHERE occurred_at >= ? AND occurred_at < ?"
        ") GROUP BY type, source, severity, camera_id",
        (first_day, since, next_day),
    ).fetchall()


def ack_event(conn: sqlite3.Connection, event_id: str, at: str, user_id: str | None, username: str | None) -> None:
    conn.execute("UPDATE events SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE id = ?", (at, user_id, username, event_id))


# ---------------------------------------------------------------- manual window groups (M047)

def manual_group_rows(conn: sqlite3.Connection, chunk: list[str]) -> Rows:
    return conn.execute(f"SELECT event_id, group_id FROM event_window_members WHERE event_id IN ({','.join('?' * len(chunk))})", chunk).fetchall()


def insert_window_group(conn: sqlite3.Connection, group_id: str, note: str, user_id: str | None, username: str | None, at: str) -> None:
    conn.execute("INSERT INTO event_window_groups(id, note, created_by, created_by_username, created_at) VALUES (?,?,?,?,?)", (group_id, note, user_id, username, at))


def member_group(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT group_id FROM event_window_members WHERE event_id = ?", (event_id,)).fetchone()


def put_member(conn: sqlite3.Connection, event_id: str, group_id: str, at: str) -> None:
    conn.execute("INSERT OR REPLACE INTO event_window_members(event_id, group_id, added_at) VALUES (?,?,?)", (event_id, group_id, at))


def group_has_members(conn: sqlite3.Connection, group_id: str) -> bool:
    return conn.execute("SELECT 1 FROM event_window_members WHERE group_id = ? LIMIT 1", (group_id,)).fetchone() is not None


def group_members_with_camera(conn: sqlite3.Connection, group_id: str) -> Rows:
    return conn.execute("SELECT m.event_id, e.camera_id FROM event_window_members m JOIN events e ON e.id = m.event_id WHERE m.group_id = ?", (group_id,)).fetchall()


def window_group_exists(conn: sqlite3.Connection, group_id: str) -> bool:
    return conn.execute("SELECT 1 FROM event_window_groups WHERE id = ?", (group_id,)).fetchone() is not None


def delete_group_members(conn: sqlite3.Connection, group_id: str) -> None:
    conn.execute("DELETE FROM event_window_members WHERE group_id = ?", (group_id,))


def delete_window_group(conn: sqlite3.Connection, group_id: str) -> None:
    conn.execute("DELETE FROM event_window_groups WHERE id = ?", (group_id,))


# ---------------------------------------------------------------- cameras and places

def camera_name_rows(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, alias, name_source FROM cameras").fetchall()


def camera_exists(conn: sqlite3.Connection, camera_id: str) -> bool:
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is not None


def floors_with_building(conn: sqlite3.Connection) -> Rows:
    """(id, name, bname) of every live floor."""
    return conn.execute("SELECT f.id, f.name, b.name AS bname FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL").fetchall()


def floor_labels(conn: sqlite3.Connection) -> Rows:
    """(id, fname, bname) of every live floor."""
    return conn.execute("SELECT f.id, f.name AS fname, b.name AS bname FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL").fetchall()


def live_floor_ids(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()


def floor_exists(conn: sqlite3.Connection, floor_id: str) -> bool:
    return conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (floor_id,)).fetchone() is not None


def building_floor_ids(conn: sqlite3.Connection, building_id: str) -> Rows:
    return conn.execute("SELECT id FROM floors WHERE building_id = ? AND deleted_at IS NULL", (building_id,)).fetchall()


def site_floor_ids(conn: sqlite3.Connection, site_id: str | None) -> Rows:
    return conn.execute("SELECT f.id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE b.site_id = ? AND f.deleted_at IS NULL", (site_id,)).fetchall()


def live_sites(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()


def site_buildings(conn: sqlite3.Connection, site_id: str) -> Rows:
    return conn.execute("SELECT id, name FROM buildings WHERE site_id = ? AND deleted_at IS NULL ORDER BY sort_order, name", (site_id,)).fetchall()


def building_floors(conn: sqlite3.Connection, building_id: str) -> Rows:
    return conn.execute("SELECT id, name FROM floors WHERE building_id = ? AND deleted_at IS NULL ORDER BY sort_order, level", (building_id,)).fetchall()


def zone_polygons(conn: sqlite3.Connection) -> Rows:
    """(floor_id, name, polygon_json) of every live zone."""
    return conn.execute("SELECT floor_id, name, polygon_json FROM spatial_zones WHERE deleted_at IS NULL").fetchall()


def zones_by_name(conn: sqlite3.Connection) -> Rows:
    """(id, floor_id, name, kind, polygon_json) of every live zone, by name."""
    return conn.execute("SELECT id, floor_id, name, kind, polygon_json FROM spatial_zones WHERE deleted_at IS NULL ORDER BY name").fetchall()


def zone_shapes_by_name(conn: sqlite3.Connection) -> Rows:
    """(id, floor_id, name, polygon_json) of every live zone, by name."""
    return conn.execute("SELECT id, floor_id, name, polygon_json FROM spatial_zones WHERE deleted_at IS NULL ORDER BY name").fetchall()


def floor_zone_polygons(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT name, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (floor_id,)).fetchall()


def live_zone(conn: sqlite3.Connection, zone_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM spatial_zones WHERE id = ? AND deleted_at IS NULL", (zone_id,)).fetchone()


def entity_anchors(conn: sqlite3.Connection) -> Rows:
    """(resource_id, floor_id, x, y) of the current HA-entity anchors, oldest update first."""
    return conn.execute("SELECT resource_id, floor_id, x, y FROM map_anchors WHERE resource_type = 'ha_entity' AND effective_to IS NULL ORDER BY updated_at").fetchall()


def camera_anchors(conn: sqlite3.Connection) -> Rows:
    """(floor_id, resource_id, x, y) of the current camera anchors."""
    return conn.execute("SELECT floor_id, resource_id, x, y FROM map_anchors WHERE resource_type = 'camera' AND effective_to IS NULL").fetchall()


def current_anchors(conn: sqlite3.Connection) -> Rows:
    """(floor_id, resource_type, resource_id, x, y) of every current anchor."""
    return conn.execute("SELECT floor_id, resource_type, resource_id, x, y FROM map_anchors WHERE effective_to IS NULL").fetchall()


def floor_anchors(conn: sqlite3.Connection, floor_id: str) -> Rows:
    return conn.execute("SELECT resource_type, resource_id, x, y FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (floor_id,)).fetchall()


def anchored_resources(conn: sqlite3.Connection, floor_ids: list[str]) -> Rows:
    """(resource_type, resource_id) of the current anchors on the given floors."""
    q = ",".join("?" * len(floor_ids))
    return conn.execute(f"SELECT resource_type, resource_id FROM map_anchors WHERE floor_id IN ({q}) AND effective_to IS NULL", floor_ids).fetchall()


def camera_location_anchor(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    """The camera's newest current anchor with its floor and building names."""
    return conn.execute(
        "SELECT a.id AS anchor_id, a.floor_id, a.x, a.y, f.name AS floor_name, f.building_id, b.name AS building_name FROM map_anchors a "
        "JOIN floors f ON f.id = a.floor_id JOIN buildings b ON b.id = f.building_id "
        "WHERE a.resource_type = 'camera' AND a.resource_id = ? AND a.effective_to IS NULL ORDER BY a.updated_at DESC LIMIT 1",
        (camera_id,),
    ).fetchone()


def floor_has_published_plan(conn: sqlite3.Connection, floor_id: str) -> bool:
    return conn.execute("SELECT 1 FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone() is not None
