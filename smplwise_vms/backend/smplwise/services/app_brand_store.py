"""The SQL of the app brand router (routers/app_brand.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def logo_rows(conn: sqlite3.Connection, kind: str) -> list[sqlite3.Row]:
    """Raises sqlite3.Error on a database without the table (the router answers no logos then)."""
    return conn.execute("SELECT variant, stamp, mime, width, height FROM brand_assets WHERE kind = ?", (kind,)).fetchall()
