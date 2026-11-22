"""The SQL of the outgoing iCal feeds router (routers/calendar_feeds.py, CALCONNECT-2330 / CAL-FEED-REVIEW-2351; CR-ROUTER-SQL-B-2450,
review 05:P2-07): every statement the router ran inline, moved here unchanged (same text, same arguments, same order of calls). The router
keeps the checks, the token handling, the rate limits, the document rendering and the audit; each function runs on the connection the
route hands it, including the document's own token-free read connection and its write-aside."""
from __future__ import annotations

import sqlite3

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- cal_feeds

def feed(conn: sqlite3.Connection, fid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_feeds WHERE id = ?", (fid,)).fetchone()


def feeds(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM cal_feeds ORDER BY created_at, id").fetchall()


def live_feed_ids(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM cal_feeds WHERE revoked_at IS NULL")}


def live_feed_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM cal_feeds WHERE revoked_at IS NULL").fetchone()[0]


def live_feed_by_token_hash(conn: sqlite3.Connection, token_hash: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_feeds WHERE token_hash = ? AND revoked_at IS NULL", (token_hash,)).fetchone()


def insert_feed(conn: sqlite3.Connection, fid: str, calendar_ids_json: str, detail: str, token_hash: str, created_by: str, created_at: str, token_set_at: str) -> None:
    conn.execute("INSERT INTO cal_feeds(id, calendar_ids_json, detail, token_hash, created_by, created_at, token_set_at) VALUES (?,?,?,?,?,?,?)",
                 (fid, calendar_ids_json, detail, token_hash, created_by, created_at, token_set_at))


def set_token(conn: sqlite3.Connection, fid: str, token_hash: str, token_set_at: str) -> None:
    """A renewed address: the new hash, never used yet."""
    conn.execute("UPDATE cal_feeds SET token_hash = ?, last_used_at = NULL, token_set_at = ? WHERE id = ?", (token_hash, token_set_at, fid))


def revoke_feed(conn: sqlite3.Connection, fid: str, revoked_at: str) -> None:
    conn.execute("UPDATE cal_feeds SET revoked_at = ?, remote_enabled = 0 WHERE id = ?", (revoked_at, fid))


def set_remote(conn: sqlite3.Connection, fid: str, remote_enabled: int) -> None:
    conn.execute("UPDATE cal_feeds SET remote_enabled = ? WHERE id = ?", (remote_enabled, fid))


def set_last_used(conn: sqlite3.Connection, fid: str, last_used_at: str) -> None:
    conn.execute("UPDATE cal_feeds SET last_used_at = ? WHERE id = ?", (last_used_at, fid))


# ---------------------------------------------------------------- calendars, occurrences, users

def live_calendar(conn: sqlite3.Connection, cid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM cal_calendars WHERE id = ? AND archived_at IS NULL", (cid,)).fetchone()


def confirmed_occurrences(conn: sqlite3.Connection, calendar_ids: list[str], w0: str, w1: str, limit: int) -> Rows:
    """The confirmed occurrences of live events in the (not archived) calendars overlapping [w0, w1), by start, at most `limit`. Start,
    end and title only (plus the ids for the UID) - never attendees, notes or organisers. `calendar_ids` is not empty."""
    marks = ",".join("?" * len(calendar_ids))
    return conn.execute(
        f"SELECT o.event_id, o.holder_calendar_id, o.occ_start, o.occ_end, e.title FROM cal_occurrences o JOIN cal_events e ON e.id = o.event_id "
        f"JOIN cal_calendars c ON c.id = o.holder_calendar_id WHERE o.holder_calendar_id IN ({marks}) AND o.state = 'confirmed' AND e.state NOT IN "
        f"('cancelled','rejected','withdrawn','expired') AND c.archived_at IS NULL AND o.occ_end > ? AND o.occ_start < ? ORDER BY o.occ_start LIMIT {limit}",
        (*calendar_ids, w0, w1)).fetchall()


def user_state(conn: sqlite3.Connection, uid: str) -> sqlite3.Row | None:
    """Raises sqlite3.OperationalError on an old database without users.disabled_at (the router falls back to user_state_old)."""
    return conn.execute("SELECT active, disabled_at FROM users WHERE id = ?", (uid,)).fetchone()


def user_state_old(conn: sqlite3.Connection, uid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT active, NULL AS disabled_at FROM users WHERE id = ?", (uid,)).fetchone()
