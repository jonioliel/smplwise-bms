"""The SQL of the identity settings patch router (routers/settings_patch/identity.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved here unchanged (same text, same arguments).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def delete_local_reset_codes(conn: sqlite3.Connection) -> None:
    """Every live self-service reset code ends (the local-identity switch went off)."""
    conn.execute("DELETE FROM auth_local_reset_codes")
