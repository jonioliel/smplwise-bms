"""The SQL of the local passkeys router (routers/local_passkeys.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls).
Each function runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def rename_passkey(conn: sqlite3.Connection, label: str | None, passkey_id: str, user_id: str) -> int:
    """The number of rows changed (1 when the user's passkey exists)."""
    return conn.execute("UPDATE auth_webauthn_credentials SET label = ? WHERE id = ? AND user_id = ?", (label, passkey_id, user_id)).rowcount


def passkey_row(conn: sqlite3.Connection, passkey_id: str, user_id: str) -> sqlite3.Row | None:
    """A row when the passkey belongs to the user, else None."""
    return conn.execute("SELECT 1 FROM auth_webauthn_credentials WHERE id = ? AND user_id = ?", (passkey_id, user_id)).fetchone()
