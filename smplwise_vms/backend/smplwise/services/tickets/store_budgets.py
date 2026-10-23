"""CR-SVC215 slice 1: the SQL of the budgets (`ticket_budgets`, migration 0155) and of their consumption - a store module of its own
(tests/test_tickets_visibility.test_ticket_sql_lives_in_the_store). services/tickets/budgets.py decides; nothing here checks a person.

Consumption is computed, never stored (section 6.2), per budget = (scope, period, currency):
  approved   = the approved / paid payment demands (`ticket_cost_claims.approved_total_minor`) approved inside the period;
  committed  = approved quotes on requests whose demand is not approved yet (the quote's assignment has no approved / paid claim; RFQ
               quotes are counted through their award instead), plus approved RFQ awards (the award's approval instant inside the period)
               less their paid instalment demands, while the award's work order has no approved / paid claim.
One currency per row; a different currency is never summed (the caller asks per currency)."""
from __future__ import annotations

import sqlite3
from typing import Any

from ...db import new_id, now_iso

MUTABLE = frozenset({"amount_minor", "warn_bp", "note", "alert_state", "updated_by", "deleted_at"})


def _d(row: Any) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def insert_budget(conn: sqlite3.Connection, fields: dict[str, Any]) -> dict[str, Any]:
    now = now_iso()
    row = {"id": new_id(), "alert_state": "ok", "note": "", "revision": 1, "created_at": now, "updated_at": now, **fields}
    cols = list(row)
    conn.execute(f"INSERT INTO ticket_budgets({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", [row[c] for c in cols])
    return budget(conn, row["id"]) or row


def budget(conn: sqlite3.Connection, budget_id: str) -> dict[str, Any] | None:
    return _d(conn.execute("SELECT * FROM ticket_budgets WHERE id = ? AND deleted_at IS NULL", (budget_id,)).fetchone())


def exists(conn: sqlite3.Connection, scope_kind: str, scope_id: str, period_kind: str, period_start: str, currency: str) -> bool:
    return conn.execute("SELECT 1 FROM ticket_budgets WHERE scope_kind = ? AND scope_id = ? AND period_kind = ? AND period_start = ? AND currency = ? "
                        "AND deleted_at IS NULL", (scope_kind, scope_id, period_kind, period_start, currency)).fetchone() is not None


def update_budget(conn: sqlite3.Connection, budget_id: str, fields: dict[str, Any], *, expect_revision: int | None = None, bump: bool = True) -> bool:
    bad = set(fields) - MUTABLE
    if bad:
        raise ValueError(f"not a mutable budget column: {sorted(bad)}")
    cols = list(fields)
    sets = "".join(f"{c} = ?, " for c in cols)
    sql = f"UPDATE ticket_budgets SET {sets}{'revision = revision + 1, ' if bump else ''}updated_at = ? WHERE id = ? AND deleted_at IS NULL"
    args: list[Any] = [*[fields[c] for c in cols], now_iso(), budget_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(int(expect_revision))
    return conn.execute(sql, args).rowcount == 1


def budgets(conn: sqlite3.Connection, *, scope_kind: str | None = None, scope_id: str | None = None, period_kind: str | None = None,
            currency: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM ticket_budgets WHERE deleted_at IS NULL"
    args: list[Any] = []
    for col, val in (("scope_kind", scope_kind), ("scope_id", scope_id), ("period_kind", period_kind), ("currency", currency)):
        if val is not None:
            sql += f" AND {col} = ?"
            args.append(val)
    return [dict(r) for r in conn.execute(sql + " ORDER BY scope_kind, scope_id, period_start DESC, currency", args).fetchall()]


def for_scopes(conn: sqlite3.Connection, scopes: list[tuple[str, str]], currency: str) -> list[dict[str, Any]]:
    """The live budgets of any of the (kind, id) scopes in one currency (the caller keeps those whose period holds the instant)."""
    if not scopes:
        return []
    cond = " OR ".join("(scope_kind = ? AND scope_id = ?)" for _ in scopes)
    args: list[Any] = [x for s in scopes for x in s] + [currency]
    return [dict(r) for r in conn.execute(f"SELECT * FROM ticket_budgets WHERE deleted_at IS NULL AND ({cond}) AND currency = ? ORDER BY scope_kind, period_kind",
                                          args).fetchall()]


def scope_exists(conn: sqlite3.Connection, kind: str, scope_id: str) -> bool:
    if kind == "installation":
        return scope_id == "*"
    table = {"department": "ticket_departments", "site": "sites", "building": "buildings", "category": "ticket_categories"}.get(kind)
    if table is None:
        return False
    extra = " AND deleted_at IS NULL" if kind in ("department", "category") else ""
    try:
        return conn.execute(f"SELECT 1 FROM {table} WHERE id = ?{extra}", (scope_id,)).fetchone() is not None
    except sqlite3.Error:
        return False


def category_department(conn: sqlite3.Connection, category_id: str) -> str | None:
    row = conn.execute("SELECT department_id FROM ticket_categories WHERE id = ?", (category_id,)).fetchone()
    return row[0] if row else None


_CLAIM_SCOPE = {"installation": "1 = 1", "department": "c.department_id = ?", "site": "t.site_id = ?", "building": "t.building_id = ?",
                "category": "t.category_id = ?"}
_QUOTE_SCOPE = {"installation": "1 = 1", "department": "t.department_id = ?", "site": "t.site_id = ?", "building": "t.building_id = ?",
                "category": "t.category_id = ?"}
_RFQ_SCOPE = {"installation": "1 = 1", "department": "r.department_id = ?", "site": "r.site_id = ?", "building": "r.building_id = ?"}


def _scope_args(kind: str, scope_id: str) -> list[Any]:
    return [] if kind == "installation" else [scope_id]


def sum_approved(conn: sqlite3.Connection, kind: str, scope_id: str, currency: str, start: str, end: str) -> int:
    sql = ("SELECT COALESCE(SUM(c.approved_total_minor), 0) FROM ticket_cost_claims c LEFT JOIN tickets t ON t.id = c.ticket_id "
           f"WHERE c.status IN ('approved', 'paid') AND c.currency = ? AND c.approved_at >= ? AND c.approved_at < ? AND {_CLAIM_SCOPE[kind]}")
    return int(conn.execute(sql, [currency, start, end, *_scope_args(kind, scope_id)]).fetchone()[0] or 0)


def sum_committed(conn: sqlite3.Connection, kind: str, scope_id: str, currency: str, start: str, end: str) -> int:
    settled = "c.status IN ('approved', 'paid')"
    quotes = ("SELECT COALESCE(SUM(COALESCE(q.approved_total_minor, q.total_minor)), 0) FROM ticket_quotes q JOIN tickets t ON t.id = q.ticket_id "
              "WHERE q.state IN ('approved', 'partially_approved') AND q.rfq_vendor_id IS NULL AND q.currency = ? AND q.decided_at >= ? AND q.decided_at < ? "
              "AND t.status != 'cancelled' "
              f"AND NOT EXISTS (SELECT 1 FROM ticket_cost_claims c WHERE c.ticket_id = q.ticket_id AND {settled} "
              "AND (q.assignment_id IS NULL OR c.assignment_id = q.assignment_id)) "
              f"AND {_QUOTE_SCOPE[kind]}")
    total = int(conn.execute(quotes, [currency, start, end, *_scope_args(kind, scope_id)]).fetchone()[0] or 0)
    if kind in _RFQ_SCOPE:
        awards = ("SELECT COALESCE(SUM(MAX(0, a.approved_total_minor - COALESCE((SELECT SUM(d.amount_minor) FROM ticket_rfq_instalment_demands d "
                  "WHERE d.award_id = a.id AND d.status = 'paid'), 0))), 0) "
                  "FROM ticket_rfq_awards a JOIN ticket_rfqs r ON r.id = a.rfq_id "
                  "WHERE a.state = 'approved' AND a.currency = ? AND COALESCE(a.second_at, a.first_at) >= ? AND COALESCE(a.second_at, a.first_at) < ? "
                  f"AND NOT EXISTS (SELECT 1 FROM ticket_quotes q2 JOIN ticket_cost_claims c ON c.ticket_id = q2.ticket_id WHERE q2.id = a.quote_id AND {settled}) "
                  f"AND {_RFQ_SCOPE[kind]}")
        total += int(conn.execute(awards, [currency, start, end, *_scope_args(kind, scope_id)]).fetchone()[0] or 0)
    return total
