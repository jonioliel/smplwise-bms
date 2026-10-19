"""CR-038 phase 2 (TKRULES-291): the SQL of the rule engine - its own table `ticket_rule_fires` (migration 0123) and the read-only
look at the notification core's open conditions (`notifications`, CR-018). A store module of its own (the tests' SQL-in-the-store rule).
Nothing here decides visibility: the engine is a system caller and never hands these rows to a person; the dry-run filters every
notification row through notify_visibility.Reach before showing it."""
from __future__ import annotations

import sqlite3
from typing import Any

from ...db import new_id

FIRE_SCAN = 50  # new fires per rule per tick (the rest the next minute)
CLEAR_SCAN = 200  # pending clears looked at per tick


def _source_match(source: str) -> tuple[str, list[Any]]:
    """A catalogue key matches its per-generator rows too (`generator.<type>@<generator id>`, notify_policy._ByKey)."""
    like = source.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "@%"
    return "(n.source = ? OR n.source LIKE ? ESCAPE '\\')", [source, like]


def open_alerts(conn: sqlite3.Connection, source: str, subject_id: str, held_before: str | None, *, unfired_for: str | None = None,
                limit: int = FIRE_SCAN) -> list[dict[str, Any]]:
    """Open (not resolved) notification rows of a source, optionally one subject, that started at or before `held_before` (None = any
    start), oldest first. `unfired_for` = a rule id: only rows that rule has not acted on yet."""
    cond, args = _source_match(source)
    sql = f"SELECT n.* FROM notifications n WHERE {cond} AND n.state != 'resolved'"
    if subject_id:
        sql += " AND n.subject_id = ?"
        args.append(subject_id)
    if held_before is not None:
        sql += " AND n.first_at <= ?"
        args.append(held_before)
    if unfired_for is not None:
        sql += " AND NOT EXISTS (SELECT 1 FROM ticket_rule_fires f WHERE f.rule_id = ? AND f.notification_id = n.id)"
        args.append(unfired_for)
    sql += " ORDER BY n.first_at, n.id LIMIT ?"
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def insert_fire(conn: sqlite3.Connection, *, rule_id: str, notification_id: str, dedupe_key: str, outcome: str, ticket_id: str | None,
                day: str, at: str, cleared: bool = False) -> bool:
    """One fire row; False when the (rule, notification) pair was already acted on (the idempotency lock)."""
    cur = conn.execute(
        "INSERT OR IGNORE INTO ticket_rule_fires(id, rule_id, notification_id, dedupe_key, outcome, ticket_id, day, at, cleared_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (new_id(), rule_id, notification_id, dedupe_key, outcome, ticket_id, day, at, at if cleared else None))
    return cur.rowcount == 1


def created_on(conn: sqlite3.Connection, rule_id: str, day: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_rule_fires WHERE rule_id = ? AND day = ? AND outcome = 'created'", (rule_id, day)).fetchone()[0])


def day_stats(conn: sqlite3.Connection, day: str) -> dict[str, dict[str, Any]]:
    """Per rule: tickets created on `day`, whether something was suppressed on `day`, and the last fire instant (any day)."""
    out: dict[str, dict[str, Any]] = {}
    for r in conn.execute(
        "SELECT rule_id, SUM(CASE WHEN day = ? AND outcome = 'created' THEN 1 ELSE 0 END) AS created, "
        "SUM(CASE WHEN day = ? AND outcome = 'suppressed' THEN 1 ELSE 0 END) AS suppressed, MAX(at) AS last_at "
        "FROM ticket_rule_fires GROUP BY rule_id", (day, day)).fetchall():
        out[r["rule_id"]] = {"created": int(r["created"] or 0), "suppressed": int(r["suppressed"] or 0), "last_at": r["last_at"]}
    return out


def pending_clears(conn: sqlite3.Connection, limit: int = CLEAR_SCAN) -> list[dict[str, Any]]:
    """Fires that opened or fed a ticket and whose alert has ended (its notification row is resolved or already pruned)."""
    return [dict(r) for r in conn.execute(
        "SELECT f.* FROM ticket_rule_fires f LEFT JOIN notifications n ON n.id = f.notification_id "
        "WHERE f.cleared_at IS NULL AND f.outcome IN ('created', 'absorbed') AND (n.id IS NULL OR n.state = 'resolved') "
        "ORDER BY f.at LIMIT ?", (int(limit),)).fetchall()]


def notification(conn: sqlite3.Connection, notification_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM notifications WHERE id = ?", (notification_id,)).fetchone()
    return dict(r) if r else None


def fired(conn: sqlite3.Connection, rule_id: str, notification_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ticket_rule_fires WHERE rule_id = ? AND notification_id = ?", (rule_id, notification_id)).fetchone() is not None


def still_active_for_ticket(conn: sqlite3.Connection, ticket_id: str, except_fire: str) -> int:
    """Other fires of the same ticket whose alert is still open (an absorbed repeat that has not ended keeps the ticket open)."""
    return int(conn.execute(
        "SELECT COUNT(*) FROM ticket_rule_fires f JOIN notifications n ON n.id = f.notification_id "
        "WHERE f.ticket_id = ? AND f.id != ? AND f.cleared_at IS NULL AND f.outcome IN ('created', 'absorbed') AND n.state != 'resolved'",
        (ticket_id, except_fire)).fetchone()[0])


def mark_cleared(conn: sqlite3.Connection, fire_id: str, at: str) -> bool:
    return conn.execute("UPDATE ticket_rule_fires SET cleared_at = ? WHERE id = ? AND cleared_at IS NULL", (at, fire_id)).rowcount == 1
