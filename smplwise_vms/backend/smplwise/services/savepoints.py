"""Named SQLite savepoints for the routers' multi-step writes (CR-ROUTER-SQL-2450): the three statements the routers wrote inline.
A name is always a constant of the calling module, never request input."""
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
