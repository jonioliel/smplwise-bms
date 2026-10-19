"""MGRDASH phases 4-5 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md sections 3 (cards 9, 10), 9 and 10): ALL SQL of the payments board
(GET /tickets/dashboard/payments) and of the overview's alerts, beside store_dash.py (phase 2). Read-only.

Nothing here decides who may see what: the functions return ids, dates and the few columns a row needs, and
services/tickets/dashboard_pay.py / dashboard_alerts.py keep a row only after its ticket passed access.visible_by_ids() or its request
passed rfq.visible_by_ids() (one batched read per answer, never one permission check per row)."""
from __future__ import annotations

import sqlite3
from typing import Any, Iterable


def _chunks(ids: Iterable[str], n: int = 500) -> Iterable[list[str]]:
    lst = list(dict.fromkeys(i for i in ids if i))
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def payable_terms(conn: sqlite3.Connection, rfq_states: Iterable[str]) -> list[dict[str, Any]]:
    """The approved payment schedules: every FINAL award with terms on a request in `rfq_states` (RFQPAY2's PAYMENT_RFQ), oldest first."""
    st = tuple(rfq_states)
    if not st:
        return []
    return [dict(r) for r in conn.execute(
        "SELECT t.award_id, t.rfq_id, t.rfq_vendor_id, t.currency, t.total_minor, t.schedule_json, a.quote_id, r.state AS rfq_state, "
        "r.department_id FROM ticket_rfq_award_terms t JOIN ticket_rfq_awards a ON a.id = t.award_id JOIN ticket_rfqs r ON r.id = t.rfq_id "
        f"WHERE a.state = 'approved' AND r.state IN ({', '.join('?' * len(st))}) ORDER BY t.created_at, t.award_id", st).fetchall()]


def demands_of_quotes(conn: sqlite3.Connection, quote_ids: Iterable[str]) -> dict[str, dict[int, dict[str, Any]]]:
    """The instalment payment demands of many quotes: {quote id: {instalment index: demand}}."""
    out: dict[str, dict[int, dict[str, Any]]] = {}
    for chunk in _chunks(quote_ids):
        for r in conn.execute(f"SELECT * FROM ticket_rfq_instalment_demands WHERE quote_id IN ({', '.join('?' * len(chunk))})", chunk).fetchall():
            out.setdefault(r["quote_id"], {})[int(r["instalment_index"])] = dict(r)
    return out


def quotes_done_at(conn: sqlite3.Connection, quote_ids: Iterable[str]) -> dict[str, str | None]:
    """The completion time of the work order each quote became (its ticket's `done_at`, rfq_terms._completed's rule); None = not done."""
    out: dict[str, str | None] = {}
    for chunk in _chunks(quote_ids):
        for r in conn.execute(f"SELECT q.id, t.done_at FROM ticket_quotes q LEFT JOIN tickets t ON t.id = q.ticket_id "
                              f"WHERE q.id IN ({', '.join('?' * len(chunk))})", chunk).fetchall():
            out[r["id"]] = r["done_at"]
    return out


def approved_unpaid_claims(conn: sqlite3.Connection, limit: int = 2000) -> list[dict[str, Any]]:
    """Payment demands a manager approved and nobody marked paid yet (status `approved`), oldest approval first."""
    return [dict(r) for r in conn.execute(
        "SELECT id, ticket_id, contact_id, currency, approved_total_minor, approved_at, instalment_index, updated_at FROM ticket_cost_claims "
        "WHERE status = 'approved' AND ticket_id IS NOT NULL ORDER BY approved_at, rowid LIMIT ?", (int(limit),)).fetchall()]


def notification_key_seen(conn: sqlite3.Connection, dedupe_key: str) -> bool:
    """Whether a notification with this key was ever raised (open, acknowledged or resolved) - the "once" memory of the dated alerts."""
    return conn.execute("SELECT 1 FROM notifications WHERE dedupe_key = ? LIMIT 1", (dedupe_key,)).fetchone() is not None


def open_notification_keys(conn: sqlite3.Connection, prefix: str) -> list[str]:
    """Dedupe keys of the notifications not resolved yet whose key starts with `prefix`."""
    like = prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return [r[0] for r in conn.execute("SELECT DISTINCT dedupe_key FROM notifications WHERE state != 'resolved' AND dedupe_key LIKE ? ESCAPE '\\'",
                                       (like,)).fetchall()]
