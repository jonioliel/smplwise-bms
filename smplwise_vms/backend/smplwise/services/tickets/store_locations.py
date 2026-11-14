"""CR-ORG-LOCATIONS: the SQL of the organisation's locations (migration 0101, provisional number). Nothing here decides who may do
what - services/tickets/org_locations.py calls these functions after its own checks. Every statement is parameterised."""
from __future__ import annotations

import sqlite3
from typing import Any, Iterable, Mapping

from ...db import new_id, now_iso

FIELDS = ("name", "street", "city", "details", "lat", "lng", "active", "is_default", "sort_order", "plan_zone_id")


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def location(conn: sqlite3.Connection, location_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_org_locations WHERE id = ?", (location_id,)).fetchone())


def locations(conn: sqlite3.Connection, *, active_only: bool) -> list[dict[str, Any]]:
    where = "WHERE active = 1 " if active_only else ""
    return [dict(r) for r in conn.execute(
        f"SELECT * FROM ticket_org_locations {where}ORDER BY active DESC, sort_order, name COLLATE NOCASE, id")]  # noqa: S608 - fixed text


def name_taken(conn: sqlite3.Connection, name: str, except_id: str | None = None) -> bool:
    row = conn.execute("SELECT id FROM ticket_org_locations WHERE name = ? COLLATE NOCASE AND id IS NOT ?", (name, except_id)).fetchone()
    return row is not None


def clear_default(conn: sqlite3.Connection, except_id: str | None = None) -> None:
    conn.execute("UPDATE ticket_org_locations SET is_default = 0 WHERE is_default = 1 AND id IS NOT ?", (except_id,))


def insert(conn: sqlite3.Connection, fields: Mapping[str, Any], by: str) -> str:
    lid = new_id()
    now = now_iso()
    cols = [k for k in FIELDS if k in fields]
    conn.execute(
        f"INSERT INTO ticket_org_locations (id, {', '.join(cols)}, created_by, created_at, updated_by, updated_at) "  # noqa: S608 - allow-listed columns
        f"VALUES (?, {', '.join('?' * len(cols))}, ?, ?, ?, ?)",
        (lid, *[fields[k] for k in cols], by, now, by, now))
    return lid


def update(conn: sqlite3.Connection, location_id: str, fields: Mapping[str, Any], by: str) -> None:
    cols = [k for k in FIELDS if k in fields]
    if not cols:
        return
    sets = ", ".join(f"{k} = ?" for k in cols)
    conn.execute(f"UPDATE ticket_org_locations SET {sets}, updated_by = ?, updated_at = ?, revision = revision + 1 WHERE id = ?",  # noqa: S608
                 (*[fields[k] for k in cols], by, now_iso(), location_id))


def delete(conn: sqlite3.Connection, location_id: str) -> None:
    conn.execute("DELETE FROM ticket_org_locations WHERE id = ?", (location_id,))


def references(conn: sqlite3.Connection, location_id: str) -> dict[str, int]:
    """How many requests / RFQs / department defaults point at a location (any state, deleted rows included)."""
    t = conn.execute("SELECT COUNT(*) FROM tickets WHERE location_id = ?", (location_id,)).fetchone()[0]
    r = conn.execute("SELECT COUNT(*) FROM ticket_rfqs WHERE location_id = ?", (location_id,)).fetchone()[0]
    d = conn.execute("SELECT COUNT(*) FROM ticket_departments WHERE default_location_id = ?", (location_id,)).fetchone()[0]
    return {"tickets": int(t), "rfqs": int(r), "departments": int(d)}


def reference_counts(conn: sqlite3.Connection) -> dict[str, int]:
    out: dict[str, int] = {}
    for sql in ("SELECT location_id, COUNT(*) FROM tickets WHERE location_id IS NOT NULL GROUP BY location_id",
                "SELECT location_id, COUNT(*) FROM ticket_rfqs WHERE location_id IS NOT NULL GROUP BY location_id"):
        for lid, n in conn.execute(sql):
            out[lid] = out.get(lid, 0) + int(n)
    return out


def department_defaults(conn: sqlite3.Connection) -> dict[str, str]:
    return {r[0]: r[1] for r in conn.execute(
        "SELECT id, default_location_id FROM ticket_departments WHERE default_location_id IS NOT NULL AND deleted_at IS NULL")}


def set_department_default(conn: sqlite3.Connection, department_id: str, location_id: str | None) -> None:
    conn.execute("UPDATE ticket_departments SET default_location_id = ? WHERE id = ?", (location_id, department_id))


def clear_department_defaults_of(conn: sqlite3.Connection, location_id: str) -> int:
    return conn.execute("UPDATE ticket_departments SET default_location_id = NULL WHERE default_location_id = ?", (location_id,)).rowcount


def clear_dead_plan_zones(conn: sqlite3.Connection) -> int:
    """ORGPLAN-291: a location's plan-area link is cleared once its room is deleted (soft or hard). Called after every room delete."""
    return conn.execute(
        "UPDATE ticket_org_locations SET plan_zone_id = NULL WHERE plan_zone_id IS NOT NULL AND NOT EXISTS "
        "(SELECT 1 FROM spatial_zones z WHERE z.id = ticket_org_locations.plan_zone_id AND z.deleted_at IS NULL)").rowcount


def plan_zone_links(conn: sqlite3.Connection, location_ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
    """ORGPLAN2-291 (moved here at integ/292: ticket SQL lives in the store): ONE read for many locations - location id -> its live linked
    room {location_id, id, name, floor_id, floor_name}; a location without a link, or whose room is deleted, is absent."""
    ids = list(dict.fromkeys(i for i in location_ids if isinstance(i, str) and i))
    out: dict[str, dict[str, Any]] = {}
    for k in range(0, len(ids), 500):  # well under SQLite's bound-variable limit
        chunk = ids[k:k + 500]
        for r in conn.execute(
                "SELECT l.id AS location_id, z.id, z.name, z.floor_id, f.name AS floor_name FROM ticket_org_locations l "  # noqa: S608 - placeholders only
                "JOIN spatial_zones z ON z.id = l.plan_zone_id AND z.deleted_at IS NULL JOIN floors f ON f.id = z.floor_id "
                f"WHERE l.id IN ({','.join('?' * len(chunk))})", chunk):
            out[r["location_id"]] = dict(r)
    return out
