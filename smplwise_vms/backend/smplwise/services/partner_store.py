"""The SQL of the partner API router (routers/partner.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def live_client_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM partner_clients WHERE deleted_at IS NULL").fetchone()[0]


def live_token_count(conn: sqlite3.Connection, now: str) -> int:
    """Tokens not revoked and not expired at `now`."""
    return conn.execute("SELECT COUNT(*) FROM partner_tokens WHERE revoked_at IS NULL AND expires_at > ?", (now,)).fetchone()[0]


def enabled_endpoint_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM partner_endpoints WHERE state != 'disabled'").fetchone()[0]


def site_options(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, name FROM sites WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()


def building_options(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, name, site_id FROM buildings WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()


def floor_options(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, name, building_id FROM floors WHERE deleted_at IS NULL ORDER BY sort_order, level, name").fetchall()


def department_options(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Raises sqlite3.OperationalError on a database without the tickets tables."""
    return conn.execute("SELECT id, name FROM ticket_departments WHERE deleted_at IS NULL AND active = 1 ORDER BY sort_order, name").fetchall()


def template_options(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Raises sqlite3.OperationalError on a database without the tickets tables."""
    return conn.execute("""SELECT id, name, department_id FROM ticket_templates WHERE kind = 'ticket' AND active = 1
                           AND deleted_at IS NULL ORDER BY name""").fetchall()
