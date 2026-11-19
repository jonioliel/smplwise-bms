"""The SQL of the notice-board router (routers/notices.py, CR-NOTICE106; CR-ROUTER-SQL-B-2450, review 05:P2-07): the statements the router
ran inline, moved here unchanged (same text, same arguments, same order of calls). It sits next to services/notices/store.py (the module's
own tables, which the router already imports as `store`) and covers what the router read beside it: the boards' change stamp, the
compose dialog's places and groups, the read list's names, the weather picker. Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


def touch_boards(conn: sqlite3.Connection, at: str) -> None:
    """Every live board shows the change on its next poll (logo, settings, info sources)."""
    conn.execute("UPDATE notice_boards SET updated_at = ? WHERE deleted_at IS NULL", (at,))


def board_has_notice(conn: sqlite3.Connection, board_id: str, notice_id: str) -> bool:
    return conn.execute("SELECT 1 FROM notice_board_items WHERE board_id = ? AND notice_id = ?", (board_id, notice_id)).fetchone() is not None


def notice_reads(conn: sqlite3.Connection, notice_id: str) -> Rows:
    return conn.execute("SELECT user_id, read_at FROM notice_reads WHERE notice_id = ?", (notice_id,)).fetchall()


def user_names(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, display_name, username FROM users").fetchall()


def weather_entities(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT entity_id, name FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL ORDER BY name, entity_id").fetchall()


# ---------------------------------------------------------------- the compose dialog's audience options

def live_floors(conn: sqlite3.Connection) -> Rows:
    return conn.execute(
        """SELECT f.id, f.name, b.name AS bname FROM floors f JOIN buildings b ON b.id = f.building_id
           WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY b.sort_order, b.name, f.level, f.sort_order""").fetchall()


def groups(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name FROM groups ORDER BY name").fetchall()


def named_areas(conn: sqlite3.Connection) -> Rows:
    """The named areas (rooms / zones) of live floors, at most 500 (NOTICEPAGE-295: the page's places tree)."""
    return conn.execute(
        """SELECT z.id, z.name, z.floor_id FROM spatial_zones z JOIN floors f ON f.id = z.floor_id
           WHERE z.deleted_at IS NULL AND f.deleted_at IS NULL AND TRIM(z.name) <> '' ORDER BY f.level, f.sort_order, z.name LIMIT 500""").fetchall()
