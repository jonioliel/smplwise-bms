"""The SQL of the WhatsApp queue router (routers/access_control_wa_queue.py; CR-ROUTER-SQL-C-2450, review 05:P2-07): the statement the router ran inline, moved
here unchanged (same text, same arguments). It runs on the connection the route hands it."""
from __future__ import annotations

import sqlite3


def message_outcome(conn: sqlite3.Connection, message_id: str) -> sqlite3.Row | None:
    """The outcome of one intercom message record (None when it is gone)."""
    return conn.execute("SELECT outcome FROM intercom_messages WHERE id = ?", (message_id,)).fetchone()
