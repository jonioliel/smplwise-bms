"""The SQL of the home interface router (routers/home_interface.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def first_weather(conn: sqlite3.Connection) -> sqlite3.Row | None:
    """The first available weather entity (by entity id), else None."""
    return conn.execute("SELECT state, attributes_json FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL AND disabled = 0 AND available = 1 ORDER BY entity_id LIMIT 1").fetchone()


def favourites_seed_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT room_key, items_json FROM home_favourites_seed").fetchall()


def bulk_protected_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM device_bulk_protected").fetchall()


def upsert_room_image(conn: sqlite3.Connection, user_id: str, room_key: str, mime: str, data_b64: str, size: int, updated_at: str) -> None:
    conn.execute(
        """INSERT INTO home_room_image (user_id, room_key, mime, data_b64, bytes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, room_key) DO UPDATE SET mime = excluded.mime, data_b64 = excluded.data_b64, bytes = excluded.bytes, updated_at = excluded.updated_at""",
        (user_id, room_key, mime, data_b64, size, updated_at),
    )


def room_image(conn: sqlite3.Connection, user_id: str, room_key: str) -> sqlite3.Row | None:
    return conn.execute("SELECT mime, data_b64 FROM home_room_image WHERE user_id = ? AND room_key = ?", (user_id, room_key)).fetchone()


def delete_room_image(conn: sqlite3.Connection, user_id: str, room_key: str) -> None:
    conn.execute("DELETE FROM home_room_image WHERE user_id = ? AND room_key = ?", (user_id, room_key))
