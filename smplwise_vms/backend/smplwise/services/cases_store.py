"""The SQL of the cases router (routers/cases.py, T049 / T050 / T064; CR-ROUTER-SQL-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router keeps the scope checks, the
NVR and file work, the bundle import and the audit; each function runs on the connection the route (or the bundle import's own
read / write connection) hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]

# ---------------------------------------------------------------- cases

def case(conn: sqlite3.Connection, case_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()


def list_cases(conn: sqlite3.Connection, status: str | None, q: str | None, limit: int) -> Rows:
    """Newest first, filtered by status and a free text over title, description and tags."""
    where: list[str] = []
    args: list[Any] = []
    if status:
        where.append("status = ?")
        args.append(status)
    if q:
        like = f"%{q.strip()}%"
        where.append("(title LIKE ? OR description LIKE ? OR tags_json LIKE ?)")
        args += [like, like, like]
    sql = "SELECT * FROM cases" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY updated_at DESC LIMIT ?"
    return conn.execute(sql, (*args, limit)).fetchall()


def item_count_rows(conn: sqlite3.Connection, case_ids: list[str]) -> Rows:
    """(case_id, kind, file_path, job_state, payload_json) of every item of the given cases."""
    q = ",".join("?" * len(case_ids))
    return conn.execute(f"SELECT ci.case_id, ci.kind, ci.file_path, ej.state AS job_state, ej.payload_json FROM case_items ci LEFT JOIN export_jobs ej ON ej.id = ci.export_job_id WHERE ci.case_id IN ({q})", case_ids).fetchall()


def insert_case(conn: sqlite3.Connection, case_id: str, title: str, description: str, status: str, tags_json: str, owner_user_id: str | None, owner_username: str | None,
                at: str, closed_at: str | None) -> None:
    conn.execute(
        "INSERT INTO cases(id, title, description, status, tags_json, owner_user_id, owner_username, revision, created_at, updated_at, closed_at) VALUES (?,?,?,?,?,?,?,1,?,?,?)",
        (case_id, title, description, status, tags_json, owner_user_id, owner_username, at, at, closed_at),
    )


def insert_open_case(conn: sqlite3.Connection, case_id: str, title: str, description: str, status: str, tags_json: str, owner_user_id: str | None, owner_username: str | None,
                     at: str) -> None:
    """A case created by a route confirmation (closed_at is NULL)."""
    conn.execute(
        "INSERT INTO cases(id, title, description, status, tags_json, owner_user_id, owner_username, revision, created_at, updated_at, closed_at) VALUES (?,?,?,?,?,?,?,1,?,?,NULL)",
        (case_id, title, description, status, tags_json, owner_user_id, owner_username, at, at),
    )


def insert_imported_case(conn: sqlite3.Connection, case_id: str, title: str, description: str, tags_json: str, owner_user_id: str | None, owner_username: str | None,
                         at: str, provenance_json: str, import_sha256: str) -> None:
    conn.execute(
        "INSERT INTO cases(id, title, description, status, tags_json, owner_user_id, owner_username, revision, created_at, updated_at, closed_at, origin, provenance_json, import_sha256) "
        "VALUES (?,?,?,'open',?,?,?,1,?,?,NULL,'imported',?,?)",
        (case_id, title, description, tags_json, owner_user_id, owner_username, at, at, provenance_json, import_sha256),
    )


def patch_case(conn: sqlite3.Connection, case_id: str, fields: dict[str, Any], at: str) -> None:
    """UPDATE the given columns (names from the route's request model, never input text), bump the revision."""
    sets = "".join(f"{k} = ?, " for k in fields)
    conn.execute(f"UPDATE cases SET {sets}revision = revision + 1, updated_at = ? WHERE id = ?", (*fields.values(), at, case_id))


def touch_case(conn: sqlite3.Connection, case_id: str, at: str) -> None:
    conn.execute("UPDATE cases SET updated_at = ? WHERE id = ?", (at, case_id))


def delete_case(conn: sqlite3.Connection, case_id: str) -> int:
    """Delete the case and its items; returns how many items it had."""
    n = conn.execute("SELECT COUNT(*) FROM case_items WHERE case_id = ?", (case_id,)).fetchone()[0]
    conn.execute("DELETE FROM case_items WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
    return n


def import_hash_in_use(conn: sqlite3.Connection, sha256: str) -> bool:
    return conn.execute("SELECT 1 FROM cases WHERE import_sha256 = ?", (sha256,)).fetchone() is not None


def case_by_import_hash(conn: sqlite3.Connection, sha256: str) -> sqlite3.Row | None:
    """(id, title) of the case an imported bundle with this hash became."""
    return conn.execute("SELECT id, title FROM cases WHERE import_sha256 = ?", (sha256,)).fetchone()


# ---------------------------------------------------------------- items

def case_items(conn: sqlite3.Connection, case_id: str) -> Rows:
    return conn.execute("SELECT * FROM case_items WHERE case_id = ? ORDER BY created_at, sort_order", (case_id,)).fetchall()


def case_item(conn: sqlite3.Connection, case_id: str, item_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM case_items WHERE id = ? AND case_id = ?", (item_id, case_id)).fetchone()


def item_export_job(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT export_job_id FROM case_items WHERE id = ?", (item_id,)).fetchone()


def event_in_case(conn: sqlite3.Connection, case_id: str, event_id: str) -> bool:
    return conn.execute("SELECT 1 FROM case_items WHERE case_id = ? AND event_id = ?", (case_id, event_id)).fetchone() is not None


def camera_bookmarks(conn: sqlite3.Connection, camera_id: str, start: str, end: str) -> Rows:
    """The event / clip items of every case for one camera whose window meets [start, end), with the case's title and status."""
    return conn.execute(
        "SELECT ci.*, c.title AS case_title, c.status AS case_status FROM case_items ci JOIN cases c ON c.id = ci.case_id "
        "WHERE ci.camera_id = ? AND ci.kind IN ('event', 'clip') AND ci.from_at IS NOT NULL AND ci.to_at IS NOT NULL "
        "AND ci.from_at < ? AND ci.to_at > ? ORDER BY ci.from_at, ci.created_at",
        (camera_id, end, start),
    ).fetchall()


def insert_item(conn: sqlite3.Connection, item_id: str, case_id: str, kind: str, camera_id: str | None, event_id: str | None, from_at: str | None, to_at: str | None,
                note: str, added_by: str | None, added_by_username: str | None, at: str, file_path: str | None, file_sha256: str | None) -> None:
    conn.execute(
        "INSERT INTO case_items(id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order, file_path, file_sha256) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,0,?,?)",
        (item_id, case_id, kind, camera_id, event_id, from_at, to_at, note, added_by, added_by_username, at, file_path, file_sha256),
    )


def insert_event_item(conn: sqlite3.Connection, item_id: str, case_id: str, camera_id: str | None, event_id: str, from_at: str, to_at: str, note: str,
                      added_by: str | None, added_by_username: str | None, at: str) -> None:
    conn.execute(
        "INSERT INTO case_items(id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order, file_path, file_sha256) VALUES (?,?,'event',?,?,NULL,?,?,?,?,?,?,0,NULL,NULL)",
        (item_id, case_id, camera_id, event_id, from_at, to_at, note, added_by, added_by_username, at),
    )


def insert_clip_item(conn: sqlite3.Connection, item_id: str, case_id: str, camera_id: str, from_at: str, to_at: str, note: str,
                     added_by: str | None, added_by_username: str | None, at: str) -> None:
    conn.execute(
        "INSERT INTO case_items(id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order, file_path, file_sha256) VALUES (?,?,'clip',?,NULL,NULL,?,?,?,?,?,?,0,NULL,NULL)",
        (item_id, case_id, camera_id, from_at, to_at, note, added_by, added_by_username, at),
    )


def insert_imported_item(conn: sqlite3.Connection, item_id: str, case_id: str, kind: str, from_at: str | None, to_at: str | None, note: str,
                         added_by: str | None, added_by_username: str | None, at: str, sort_order: int, file_path: str | None, file_sha256: str | None, origin_json: str) -> None:
    conn.execute(
        "INSERT INTO case_items(id, case_id, kind, camera_id, event_id, export_job_id, from_at, to_at, note, added_by, added_by_username, created_at, sort_order, file_path, file_sha256, origin_json) "
        "VALUES (?,?,?,NULL,NULL,NULL,?,?,?,?,?,?,?,?,?,?)",
        (item_id, case_id, kind, from_at, to_at, note, added_by, added_by_username, at, sort_order, file_path, file_sha256, origin_json),
    )


def delete_item(conn: sqlite3.Connection, item_id: str) -> None:
    conn.execute("DELETE FROM case_items WHERE id = ?", (item_id,))


def link_export_job(conn: sqlite3.Connection, item_id: str, job_id: str) -> None:
    conn.execute("UPDATE case_items SET export_job_id = ? WHERE id = ?", (job_id, item_id))


def own_item_cameras(conn: sqlite3.Connection, case_id: str) -> set[str]:
    """The cameras of the case's own (not imported) items."""
    return {r[0] for r in conn.execute("SELECT DISTINCT camera_id FROM case_items WHERE case_id = ? AND camera_id IS NOT NULL AND origin_json IS NULL", (case_id,)).fetchall()}


def has_imported_items(conn: sqlite3.Connection, case_id: str) -> bool:
    return conn.execute("SELECT 1 FROM case_items WHERE case_id = ? AND origin_json IS NOT NULL LIMIT 1", (case_id,)).fetchone() is not None


# ---------------------------------------------------------------- cameras and events

def cameras(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM cameras").fetchall()


def camera(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()


def camera_exists(conn: sqlite3.Connection, camera_id: str) -> bool:
    return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (camera_id,)).fetchone() is not None


def event(conn: sqlite3.Connection, event_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()


def events_by_id(conn: sqlite3.Connection, event_ids: list[str]) -> Rows:
    q = ",".join("?" * len(event_ids))
    return conn.execute(f"SELECT * FROM events WHERE id IN ({q})", event_ids).fetchall()
