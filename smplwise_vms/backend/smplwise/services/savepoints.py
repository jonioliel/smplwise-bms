"""Named SQLite savepoints for the routers' multi-step writes (CR-ROUTER-SQL-2450): the three statements the routers wrote inline.
A name is always a constant of the calling module, never request input. Also the deferred BEGIN the access-control routes ran
inline (CR-ROUTER-SQL-C-2450)."""
from __future__ import annotations

import sqlite3


def savepoint(conn: sqlite3.Connection, name: str) -> None:
    conn.execute(f"SAVEPOINT {name}")


def rollback_savepoint(conn: sqlite3.Connection, name: str) -> None:
    """ROLLBACK TO the savepoint, then RELEASE it."""
    conn.execute(f"ROLLBACK TO {name}")
    conn.execute(f"RELEASE {name}")


def release_savepoint(conn: sqlite3.Connection, name: str) -> None:
    conn.execute(f"RELEASE {name}")


def begin_deferred(conn: sqlite3.Connection) -> None:
    """A deferred BEGIN: takes no lock and cannot wait on a busy database (the access-control routes re-open the request
    connection's transaction with it after a WisKey call, when nothing more is written on that connection)."""
    conn.execute("BEGIN")
