"""The SQL of the app secrets router (routers/app_secrets.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def station_credential_ids(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The stations with their own stored credential override."""
    return conn.execute("SELECT station_id FROM wiskey_station_credentials").fetchall()
