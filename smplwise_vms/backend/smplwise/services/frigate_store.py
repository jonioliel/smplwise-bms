"""The SQL of the Frigate provider router (routers/frigate.py, CR-029 / NN5; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the
router ran inline, moved here unchanged (same text, same arguments, same order of calls). The two review queries keep their builders
(the caller's camera scope, the optional filters) exactly as the router composed them. The router keeps the permission checks (it still
decides the row scope and refuses a caller with none), the adapter calls toward Frigate and the answers; each function runs on the
connection the route hands it."""
from __future__ import annotations

import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- recorders, sync state

def recorder_info(conn: sqlite3.Connection, rid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT id, name, enabled, removed_at, model, firmware FROM recorders WHERE id = ?", (rid,)).fetchone()


def frigate_recorders(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT id, name, enabled, model, firmware FROM recorders WHERE vendor = 'frigate' AND removed_at IS NULL ORDER BY sort_order, id").fetchall()


def sync_state(conn: sqlite3.Connection, recorder_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM frigate_sync_state WHERE recorder_id = ?", (recorder_id,)).fetchone()


# ---------------------------------------------------------------- cameras

def camera_on_recorder(conn: sqlite3.Connection, camera_id: str, rid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cameras WHERE id = ? AND recorder_id = ?", (camera_id, rid)).fetchone()


def camera_links(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT camera_id, linked_camera_id, kind FROM camera_links").fetchall()


def recorder_cameras(conn: sqlite3.Connection, recorder_id: str) -> Rows:
    return conn.execute("SELECT * FROM cameras WHERE recorder_id = ? ORDER BY sort_order, channel", (recorder_id,)).fetchall()


def camera_names(conn: sqlite3.Connection, recorder_id: str) -> Rows:
    return conn.execute("SELECT id, alias, name_source FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchall()


def camera_source_refs(conn: sqlite3.Connection, recorder_id: str) -> Rows:
    return conn.execute("SELECT id, source_ref FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchall()


def camera_names_by_source_ref(conn: sqlite3.Connection, recorder_id: str) -> Rows:
    return conn.execute("SELECT source_ref, alias, name_source FROM cameras WHERE recorder_id = ?", (recorder_id,)).fetchall()


# ---------------------------------------------------------------- review items

def scope_clause(sc: Any) -> tuple[str, list[Any]]:
    """The caller's `events.read` row scope (services.access.row_scope, already checked to grant something) as an `AND (...)` fragment
    over `camera_id` with its arguments: "" for everything, " AND 0" for a scope that matches no row."""
    if sc.everything:
        return "", []
    parts, args = [], []
    if sc.cameras.everything:
        parts.append("camera_id IS NOT NULL")
    elif sc.cameras.ids:
        ids = sorted(sc.cameras.ids)
        parts.append(f"camera_id IN ({','.join('?' * len(ids))})")
        args += ids
    if sc.camera_less:
        parts.append("camera_id IS NULL")
    if not parts:
        return " AND 0", []
    return " AND (" + " OR ".join(parts) + ")", args


def reviews_page(conn: sqlite3.Connection, user_id: str, recorder_id: str, scope: str, sargs: list[Any], *, severity: str | None, camera_id: str | None,
                 reviewed: bool | None, t_from: float | None, t_to: float | None, before: float | None, limit: int) -> Rows:
    """The stored review items with the CALLER's reviewed instant (`_reviewed`), newest first, at most `limit` rows (the router asks one
    more than a page to know whether a next page exists)."""
    sql = ("SELECT r.*, s.reviewed_at AS _reviewed FROM frigate_reviews r LEFT JOIN frigate_review_state s ON s.user_id = ? AND s.recorder_id = r.recorder_id AND s.review_id = r.review_id "
           "WHERE r.recorder_id = ?")
    args: list[Any] = [user_id, recorder_id]
    sc_sql = scope.replace("camera_id", "r.camera_id")
    sql += sc_sql
    args += sargs
    if severity:
        sql += " AND r.severity = ?"
        args.append(severity)
    if camera_id:
        sql += " AND r.camera_id = ?"
        args.append(camera_id)
    if reviewed is True:
        sql += " AND s.reviewed_at IS NOT NULL"
    elif reviewed is False:
        sql += " AND s.reviewed_at IS NULL"
    if t_from is not None:
        sql += " AND COALESCE(r.end_ts, r.start_ts) >= ?"
        args.append(t_from)
    if t_to is not None:
        sql += " AND r.start_ts < ?"
        args.append(t_to)
    if before is not None:
        sql += " AND r.start_ts < ?"
        args.append(before)
    sql += " ORDER BY r.start_ts DESC LIMIT ?"
    args.append(limit)
    return conn.execute(sql, args).fetchall()


def review_counts(conn: sqlite3.Connection, user_id: str, recorder_id: str, since: float, scope: str, sargs: list[Any]) -> Rows:
    """Per (severity, camera): the items since `since` and how many of them the CALLER has not reviewed."""
    sql = ("SELECT r.severity, r.camera_id, COUNT(*) AS n, SUM(CASE WHEN s.reviewed_at IS NULL THEN 1 ELSE 0 END) AS unreviewed FROM frigate_reviews r "
           "LEFT JOIN frigate_review_state s ON s.user_id = ? AND s.recorder_id = r.recorder_id AND s.review_id = r.review_id WHERE r.recorder_id = ? AND r.start_ts >= ?"
           + scope.replace("camera_id", "r.camera_id") + " GROUP BY r.severity, r.camera_id")
    return conn.execute(sql, [user_id, recorder_id, since, *sargs]).fetchall()


def review(conn: sqlite3.Connection, recorder_id: str, review_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM frigate_reviews WHERE recorder_id = ? AND review_id = ?", (recorder_id, review_id)).fetchone()


def review_state(conn: sqlite3.Connection, user_id: str, recorder_id: str, review_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT reviewed_at FROM frigate_review_state WHERE user_id = ? AND recorder_id = ? AND review_id = ?", (user_id, recorder_id, review_id)).fetchone()


def mark_reviewed(conn: sqlite3.Connection, user_id: str, recorder_id: str, review_id: str, reviewed_at: str) -> None:
    conn.execute("INSERT OR IGNORE INTO frigate_review_state(user_id, recorder_id, review_id, reviewed_at) VALUES (?,?,?,?)", (user_id, recorder_id, review_id, reviewed_at))


def unmark_reviewed(conn: sqlite3.Connection, user_id: str, recorder_id: str, review_id: str) -> None:
    conn.execute("DELETE FROM frigate_review_state WHERE user_id = ? AND recorder_id = ? AND review_id = ?", (user_id, recorder_id, review_id))
