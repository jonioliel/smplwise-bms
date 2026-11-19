"""The SQL of the home gaps router (routers/home_gaps.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def confirmed_alarm_actions(conn: sqlite3.Connection, since: str) -> list[sqlite3.Row]:
    """The confirmed alarm-panel actions requested at or after `since`, newest first (at most 400), with the actor's names."""
    return conn.execute(
        "SELECT a.entity_id, a.action_id, a.requested_at, a.confirmed_at, a.principal_user_id, u.display_name, u.username "
        "FROM ha_actions a LEFT JOIN users u ON u.id = a.principal_user_id "
        "WHERE a.action_id LIKE 'alarm_control_panel.alarm_%' AND a.status = 'confirmed' AND a.requested_at >= ? "
        "ORDER BY a.requested_at DESC LIMIT 400",
        (since,),
    ).fetchall()
