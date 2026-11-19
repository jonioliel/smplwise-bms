"""The SQL of the transit router (routers/transit.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def stop_count(conn: sqlite3.Connection) -> int:
    """The number of stops in the local catalogue."""
    return conn.execute("SELECT COUNT(*) FROM transit_stops").fetchone()[0]
