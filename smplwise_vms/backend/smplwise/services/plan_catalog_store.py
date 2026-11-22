"""The SQL of the Plan Studio object library router (routers/plan_catalog.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any


COLUMNS = ("based_on", "names_json", "category", "tags_json", "role", "shape", "size_json", "z_m", "params_json", "icon", "color_token")
INSERT = f"INSERT INTO catalog_items(id, {', '.join(COLUMNS)}, created_by, created_at, updated_at) VALUES (?, {', '.join('?' * len(COLUMNS))}, ?, ?, ?)"
UPDATE = f"UPDATE catalog_items SET {', '.join(f'{c} = ?' for c in COLUMNS)}, updated_at = ? WHERE id = ?"


def item(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM catalog_items WHERE id = ?", (item_id,)).fetchone()


def item_row(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row | None:
    """A row when the custom item exists, else None."""
    return conn.execute("SELECT 1 FROM catalog_items WHERE id = ?", (item_id,)).fetchone()


def insert_item(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """`values` = id, the COLUMNS in order, created_by, created_at, updated_at."""
    conn.execute(INSERT, values)


def update_item(conn: sqlite3.Connection, values: tuple[Any, ...]) -> None:
    """`values` = the COLUMNS in order, updated_at, id."""
    conn.execute(UPDATE, values)


def delete_item(conn: sqlite3.Connection, item_id: str) -> None:
    conn.execute("DELETE FROM catalog_items WHERE id = ?", (item_id,))
