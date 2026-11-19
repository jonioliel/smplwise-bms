"""The SQL of the device layouts router (routers/device_layouts.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def layout_row(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str) -> sqlite3.Row | None:
    """One stored layout with its author's names."""
    return conn.execute(
        "SELECT l.layout_json, l.revision, l.updated_by, l.updated_at, u.display_name, u.username FROM device_layouts l LEFT JOIN users u ON u.id = l.updated_by"
        " WHERE l.scope = ? AND l.scope_id = ? AND l.variant = ?",
        (scope, scope_id, variant),
    ).fetchone()


def area_layout_counts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """(scope_id, n) per area that has stored layouts."""
    return conn.execute("SELECT scope_id, COUNT(*) AS n FROM device_layouts WHERE scope = 'area' GROUP BY scope_id").fetchall()


def delete_area_layouts(conn: sqlite3.Connection, scope_id: str) -> None:
    conn.execute("DELETE FROM device_layouts WHERE scope = 'area' AND scope_id = ?", (scope_id,))


def revision_row(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str) -> sqlite3.Row | None:
    return conn.execute("SELECT revision FROM device_layouts WHERE scope = ? AND scope_id = ? AND variant = ?", (scope, scope_id, variant)).fetchone()


def upsert_layout(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str, layout_json: str, revision: int, updated_by: str, updated_at: str) -> None:
    conn.execute(
        "INSERT INTO device_layouts(scope, scope_id, variant, layout_json, revision, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        " ON CONFLICT(scope, scope_id, variant) DO UPDATE SET layout_json = excluded.layout_json, revision = excluded.revision,"
        " updated_by = excluded.updated_by, updated_at = excluded.updated_at",
        (scope, scope_id, variant, layout_json, revision, updated_by, updated_at),
    )


def delete_variants(conn: sqlite3.Connection, scope: str, scope_id: str, variants: tuple[str, ...]) -> None:
    """Remove the given variants of one screen's layout (the `IN (?,..)` list built from their number)."""
    conn.execute(f"DELETE FROM device_layouts WHERE scope = ? AND scope_id = ? AND variant IN ({', '.join('?' * len(variants))})", (scope, scope_id, *variants))


def area_layout_rows(conn: sqlite3.Connection, scope_id: str) -> list[sqlite3.Row]:
    """(variant, layout_json) of one area's stored layouts."""
    return conn.execute("SELECT variant, layout_json FROM device_layouts WHERE scope = 'area' AND scope_id = ?", (scope_id,)).fetchall()


def delete_area_phone_layout(conn: sqlite3.Connection, area_id: str) -> None:
    conn.execute("DELETE FROM device_layouts WHERE scope = 'area' AND scope_id = ? AND variant = 'phone'", (area_id,))
