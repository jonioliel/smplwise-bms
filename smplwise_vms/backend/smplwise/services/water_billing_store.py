"""SQL of the water billing API (routers/water_billing.py held it inline: the list and filter queries of tariffs, accounts, bills and bill
events and the tariff rename; moved here by CR-RESPONSE-MODELS-CONSUMPTION-2450, review 05 SQL boundary / MASTER_PLAN 3.6). The statements
are unchanged. The customer card's queries are the electricity ones (services/energy_billing_store.py)."""
from __future__ import annotations

import sqlite3
from decimal import Decimal

BILL_STATES = ("draft", "issued", "sent", "paid", "void")


def customer_bills(conn: sqlite3.Connection, cid: str, limit: int = 24) -> list[sqlite3.Row]:
    """The customer's latest water bills (newest period first)."""
    return conn.execute("SELECT * FROM water_bills WHERE customer_id = ? ORDER BY period_end DESC, revision DESC LIMIT ?", (cid, limit)).fetchall()


def tariffs(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM water_tariffs WHERE deleted_at IS NULL ORDER BY name").fetchall()


def rename_tariff(conn: sqlite3.Connection, tid: str, name: str, now: str) -> None:
    conn.execute("UPDATE water_tariffs SET name = ?, updated_at = ? WHERE id = ?", (name, now, tid))


def accounts(conn: sqlite3.Connection, customer_id: str | None, q: str | None, status: str | None) -> list[sqlite3.Row]:
    """Live water accounts, filtered by customer, a fragment of the account's or the customer's name and the status, by name."""
    sql, args = "SELECT * FROM water_accounts WHERE deleted_at IS NULL", []
    if customer_id:
        sql += " AND customer_id = ?"
        args.append(customer_id)
    if q:
        sql += " AND (name LIKE ? OR customer_id IN (SELECT id FROM energy_customers WHERE name LIKE ?))"
        args += [f"%{q}%", f"%{q}%"]
    if status:
        sql += " AND status = ?"
        args.append(status)
    return conn.execute(sql + " ORDER BY name", args).fetchall()


def draft_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM water_bills WHERE state = 'draft'").fetchone()[0]


def account_bills(conn: sqlite3.Connection, aid: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM water_bills WHERE account_id = ? ORDER BY period_end DESC, revision DESC", (aid,)).fetchall()


def bills_page(conn: sqlite3.Connection, *, account_id: str | None, customer_id: str | None, state: str | None, q: str | None, limit: int,
               offset: int) -> tuple[list[sqlite3.Row], int, dict[str, int], dict[str, Decimal]]:
    """(one page of bills newest period first, the number matching every filter, the counts by state and the open / paid sums - both
    before the state filter)."""
    where, args = ["1=1"], []
    if account_id:
        where.append("b.account_id = ?")
        args.append(account_id)
    if customer_id:
        where.append("b.customer_id = ?")
        args.append(customer_id)
    if q:
        where.append("(b.number LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR c.customer_number LIKE ?)")
        args += [f"%{q}%"] * 4
    base = f"FROM water_bills b LEFT JOIN water_accounts a ON a.id = b.account_id LEFT JOIN energy_customers c ON c.id = b.customer_id WHERE {' AND '.join(where)}"
    counts = {s: 0 for s in BILL_STATES}
    sums = {"open": Decimal("0.00"), "paid": Decimal("0.00")}
    for r in conn.execute(f"SELECT b.state, COUNT(*) {base} GROUP BY b.state", args).fetchall():
        counts[r[0]] = r[1]
    for r in conn.execute(f"SELECT b.state, b.total {base} AND b.state IN ('issued','sent','paid')", args).fetchall():
        sums["paid" if r[0] == "paid" else "open"] += Decimal(r[1] or "0")
    if state:
        base += " AND b.state = ?"
        args.append(state)
    total = conn.execute(f"SELECT COUNT(*) {base}", args).fetchone()[0]
    rows = conn.execute(f"SELECT b.* {base} ORDER BY b.period_end DESC, b.created_at DESC LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return rows, total, counts, sums


def bill_events(conn: sqlite3.Connection, bid: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM water_bill_events WHERE bill_id = ? ORDER BY at, rowid", (bid,)).fetchall()
