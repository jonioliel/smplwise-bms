"""Original SQLite connection scope and geometry; never source authority."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

from ..trusted_actions.validation import Refusal

_PRAGMAS = frozenset(
    {
        "page_size",
        "max_page_count",
        "cache_spill",
        "synchronous",
        "fullfsync",
        "wal_autocheckpoint",
        "journal_mode",
        "foreign_keys",
    }
)


def require_connection_scope(
    db: sqlite3.Connection, path: Path, *,
    row_factory: Callable[[sqlite3.Cursor, tuple[Any, ...]], Any] | None,
    geometry: Iterable[tuple[str, Any]], verify: Callable[[], Any],
    schema: dict[tuple[str, str], str | None] | None = None,
) -> None:
    """Inspect only the original DB and recheck original roots after callbacks.

    TEMP objects can shadow unqualified main SQL. ATTACH widens the connection's
    durable scope. Neither is part of either private storage format. Never clear
    or repair them: refusal preserves the evidence and original history.
    """

    def check() -> None:
        verify()
        if (
            db.row_factory is not row_factory
            or db.text_factory is not str
            or db.isolation_level is not None
        ):
            raise Refusal("binding_denied")

    check()
    databases = db.execute("PRAGMA database_list").fetchall()
    check()
    names = [r[1] for r in databases]
    if (
        names.count("main") != 1
        or len(names) != len(set(names))
        or any(
            name not in {"main", "temp"}
            or name == "main"
            and filename != str(path)
            or name == "temp"
            and filename != ""
            for _number, name, filename in databases
        )
    ):
        raise Refusal("invalid_storage")
    temporary = db.execute("SELECT count(*) FROM sqlite_temp_master").fetchone()[0]
    check()
    if temporary:
        raise Refusal("invalid_storage")
    for name, expected in geometry:
        if name not in _PRAGMAS:
            raise Refusal("binding_denied")
        actual = db.execute("PRAGMA " + name).fetchone()[0]
        check()
        if type(actual) is not type(expected) or actual != expected:
            raise Refusal("binding_denied")
    if schema is not None:
        actual = {
            (r[0], r[1]): None if r[2] is None else " ".join(r[2].casefold().split())
            for r in db.execute("SELECT type,name,sql FROM main.sqlite_master")
        }
        check()
        if actual != schema:
            raise Refusal("invalid_storage")
