"""CR-ACCEPT102: the storage layer of the smart acceptance (migration 0151 `ticket_acceptance` / `ticket_acceptance_settings`, and its reads of
`tickets` / `ticket_events`) - a store module of its own, like store_rules.py. services/tickets/acceptance.py holds the rules and calls these;
every function runs on the caller's connection and transaction."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

ACTIVE = ("pending", "holding", "flagged")


def settings_row(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ticket_acceptance_settings WHERE id = 1").fetchone()


def state_of(conn: sqlite3.Connection, ticket_id: str) -> str | None:
    r = conn.execute("SELECT state FROM ticket_acceptance WHERE ticket_id = ?", (ticket_id,)).fetchone()
    return r["state"] if r is not None else None


def active_ids(conn: sqlite3.Connection, limit: int) -> list[str]:
    return [r["ticket_id"] for r in conn.execute(
        "SELECT ticket_id FROM ticket_acceptance WHERE state IN ('pending', 'holding', 'flagged') ORDER BY created_at LIMIT ?", (limit,)).fetchall()]


def adoptable_ids(conn: sqlite3.Connection, categories: tuple[str, ...], limit: int) -> list[str]:
    """`done` tickets with an enabled temperature-unit link, in one of `categories`, with no current verification row."""
    return [r["id"] for r in conn.execute(
        """SELECT t.id FROM tickets t
             JOIN infra_temp_tickets l ON l.ticket_id = t.id
             JOIN infra_temp_units u ON u.id = l.unit_id AND u.enabled = 1
             LEFT JOIN ticket_acceptance a ON a.ticket_id = t.id
            WHERE t.status = 'done' AND t.done_at IS NOT NULL AND t.category_id IN (SELECT value FROM json_each(?))
              AND (a.ticket_id IS NULL OR (a.state NOT IN ('pending', 'holding', 'flagged') AND a.done_seq < (SELECT COUNT(*) FROM ticket_events e WHERE e.ticket_id = t.id AND e.to_status = 'done')))
            ORDER BY t.done_at LIMIT ?""", (json.dumps(list(categories)), limit)).fetchall()]


def done_seq(conn: sqlite3.Connection, ticket_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_events WHERE ticket_id = ? AND to_status = 'done'", (ticket_id,)).fetchone()[0])


def adopt_source(conn: sqlite3.Connection, ticket_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT t.id, t.done_at, l.unit_id FROM tickets t JOIN infra_temp_tickets l ON l.ticket_id = t.id "
        "JOIN infra_temp_units u ON u.id = l.unit_id AND u.enabled = 1 WHERE t.id = ? AND t.status = 'done' AND t.done_at IS NOT NULL", (ticket_id,)).fetchone()


def replace_row(conn: sqlite3.Connection, values: dict[str, Any]) -> None:
    """A fresh verification row (any earlier one of the ticket is replaced)."""
    cols = ("ticket_id", "kind", "subject_id", "state", "on_breach", "hold_minutes", "start_grace_minutes", "max_restarts", "done_at", "done_seq",
            "pending_since", "created_at")
    conn.execute("DELETE FROM ticket_acceptance WHERE ticket_id = ?", (values["ticket_id"],))
    conn.execute(f"INSERT INTO ticket_acceptance({', '.join(cols)}) VALUES ({','.join('?' * len(cols))})", tuple(values[c] for c in cols))


def row(conn: sqlite3.Connection, ticket_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM ticket_acceptance WHERE ticket_id = ?", (ticket_id,)).fetchone()


def start_hold(conn: sqlite3.Connection, ticket_id: str, hold_start: str | None, hold_until: str | None) -> None:
    conn.execute("UPDATE ticket_acceptance SET state = 'holding', hold_start = ?, hold_until = ? WHERE ticket_id = ?", (hold_start, hold_until, ticket_id))


def restart(conn: sqlite3.Connection, ticket_id: str, stamp: str, breach_event_id: str | None) -> None:
    conn.execute("UPDATE ticket_acceptance SET state = 'pending', restarts = restarts + 1, pending_since = ?, hold_start = NULL, hold_until = NULL, breach_event_id = ? "
                 "WHERE ticket_id = ?", (stamp, breach_event_id, ticket_id))


def flag(conn: sqlite3.Connection, ticket_id: str, stamp: str, why: str, breach_event_id: str | None) -> None:
    conn.execute("UPDATE ticket_acceptance SET state = 'flagged', finished_at = ?, outcome = ?, breach_event_id = ? WHERE ticket_id = ?", (stamp, why, breach_event_id, ticket_id))


def finish(conn: sqlite3.Connection, ticket_id: str, state: str, outcome: str, stamp: str, breach_event_id: str | None = None) -> None:
    conn.execute("UPDATE ticket_acceptance SET state = ?, outcome = ?, finished_at = ?, breach_event_id = COALESCE(?, breach_event_id) WHERE ticket_id = ?",
                 (state, outcome, stamp, breach_event_id, ticket_id))
