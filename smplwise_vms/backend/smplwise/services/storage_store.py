"""The SQL of the storage router (routers/storage.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def export_job_counts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """(state, count) per export job state."""
    return conn.execute("SELECT state, COUNT(*) FROM export_jobs GROUP BY state").fetchall()
