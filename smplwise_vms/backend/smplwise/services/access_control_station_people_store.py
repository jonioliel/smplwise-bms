"""The SQL of the station-people router (routers/access_control_station_people.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the one
statement the router ran inline, moved here unchanged (same text, same arguments). It runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def attempt_seen(conn: sqlite3.Connection, action: str, actor_user_id: str, since: str, request_pattern: str, phase_pattern: str) -> sqlite3.Row | None:
    """An `attempt` audit row of the same command (action, actor, client request id) at or after `since`, if any."""
    return conn.execute(
        "SELECT 1 FROM audit_log WHERE action = ? AND actor_user_id = ? AND at >= ? AND details_json LIKE ? AND details_json LIKE ? LIMIT 1",
        (action, actor_user_id, since, request_pattern, phase_pattern),
    ).fetchone()
