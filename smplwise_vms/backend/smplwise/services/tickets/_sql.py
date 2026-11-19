"""CR-TK-SQL (code review 2026-11-13, 01:F-14 / 01:F-10): the small SQL helpers the store modules of the tickets module share.

Before this module `_dict` was declared in six store modules and `_insert` in three, the scope prefilter (departments OR the caller's
own tickets) and the free-text clause were written twice in store.py, and the LIKE escape sat inline next to a helper doing the same.
Each helper below is the text those copies had; the store modules import them under their old private names, so no call site moved.

Private to the storage layer (store*.py and the few modules with recorded SQL of their own): nothing here decides who may see what.
The clause builders return SQL text over the aliases of store._TICKET_SELECT (`t` = tickets, `a` = the current assignment) and never
read a row themselves."""
from __future__ import annotations

import sqlite3
from typing import Any, Iterable, Mapping

from ...db import has_table  # noqa: F401 - re-exported: THE "does this table exist" answer of the module (cached per file and schema version)


def row_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    """dict(row), or None for no row."""
    return dict(row) if row is not None else None


def insert(conn: sqlite3.Connection, table: str, row: Mapping[str, Any]) -> None:
    """INSERT one row: `table` and the keys of `row` are names the calling store module wrote (never request text)."""
    cols = list(row)
    conn.execute(f"INSERT INTO {table}({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))  # noqa: S608 - server-side names


def like(q: str) -> str:
    """`q` as a "contains" pattern for LIKE with the backslash as the ESCAPE character: the wildcard characters of the text match
    themselves."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def scope_clause(department_ids: Iterable[str] | None, user_id: str | None) -> tuple[str, list[Any]] | None:
    """The SUPERSET prefilter of a ticket list (section 13.6): department membership (`department_ids`; None = every department) OR
    the caller's own tickets (`user_id`: created by or currently assigned to them). Returns (clause, its arguments), or None when
    nothing can match (no department and no user). Visibility is not decided here."""
    parts: list[str] = []
    args: list[Any] = []
    if department_ids is not None:
        ids = list(dict.fromkeys(department_ids))
        if ids:
            parts.append(f"t.department_id IN ({', '.join('?' * len(ids))})")
            args.extend(ids)
    else:
        parts.append("1 = 1")
    if user_id:
        parts.append("(t.created_by = ? OR (a.assignee_kind = 'user' AND a.user_id = ? AND a.ended_at IS NULL))")
        args.extend([user_id, user_id])
    if not parts:
        return None
    return "(" + " OR ".join(parts) + ")", args


def text_clause(query: str | None) -> tuple[str, list[Any]] | None:
    """The free-text filter of a ticket list: a number (`123` / `#123`, up to nine digits) matches the ticket number, the title or
    the device name; any other text the title, the device name or the place. None for an empty query."""
    q = (query or "").strip()
    if not q:
        return None
    pattern = like(q)
    digits = q.lstrip("#")
    if digits.isdigit() and len(digits) <= 9:
        return ("(t.number = ? OR t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\')", [int(digits), pattern, pattern])
    return ("(t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\' OR t.place_text LIKE ? ESCAPE '\\')", [pattern, pattern, pattern])


__all__ = ["has_table", "row_dict", "insert", "like", "scope_clause", "text_clause"]
