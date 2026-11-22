"""SQL of the electricity billing API (routers/energy_billing.py held it inline: list and filter queries of customers, accounts, bills,
tariffs, VAT, bill events and automatic runs, the tariff row writes and the stored-PDF mark; moved here by
CR-RESPONSE-MODELS-CONSUMPTION-2450, review 05 SQL boundary / MASTER_PLAN 3.6). The statements are unchanged. The customer queries
also serve the water billing API (one customer card for both)."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

BILL_STATES = ("draft", "issued", "sent", "paid", "void")


# ---------------------------------------------------------------- customers (shared with water)

def customers_page(conn: sqlite3.Connection, q: str | None, limit: int, offset: int) -> tuple[int, list[sqlite3.Row]]:
    """(the number of live customers matching `q` by name or number, one page of them by customer number)."""
    sql = "SELECT * FROM energy_customers WHERE deleted_at IS NULL"
    args: list[Any] = []
    if q:
        sql += " AND (name LIKE ? OR customer_number LIKE ?)"
        args += [f"%{q}%", f"%{q}%"]
    total = conn.execute(f"SELECT COUNT(*) FROM ({sql})", args).fetchone()[0]
    rows = conn.execute(sql + " ORDER BY customer_number LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return total, rows


def customer_accounts(conn: sqlite3.Connection, cid: str) -> list[sqlite3.Row]:
    """The customer's live electricity accounts (id, name, status) by name."""
    return conn.execute("SELECT id, name, status FROM energy_accounts WHERE customer_id = ? AND deleted_at IS NULL ORDER BY name", (cid,)).fetchall()


def customer_bills(conn: sqlite3.Connection, cid: str, limit: int = 24) -> list[sqlite3.Row]:
    """The customer's latest electricity bills (newest period first)."""
    return conn.execute("SELECT * FROM energy_bills WHERE customer_id = ? ORDER BY period_end DESC, revision DESC LIMIT ?", (cid, limit)).fetchall()


# ---------------------------------------------------------------- accounts

def accounts(conn: sqlite3.Connection, customer_id: str | None, q: str | None, status: str | None) -> list[sqlite3.Row]:
    """Live accounts, filtered by customer, a name fragment and the status, by name."""
    sql = "SELECT * FROM energy_accounts WHERE deleted_at IS NULL"
    args: list[Any] = []
    if customer_id:
        sql += " AND customer_id = ?"
        args.append(customer_id)
    if q:
        sql += " AND name LIKE ?"
        args.append(f"%{q}%")
    if status:
        sql += " AND status = ?"
        args.append(status)
    return conn.execute(sql + " ORDER BY name", args).fetchall()


def period_bill(conn: sqlite3.Connection, aid: str, start: dt.date, end: dt.date) -> sqlite3.Row | None:
    """The latest non-void bill of exactly this period (end exclusive)."""
    return conn.execute("SELECT * FROM energy_bills WHERE account_id = ? AND period_start = ? AND period_end = ? AND state != 'void' ORDER BY revision DESC LIMIT 1",
                        (aid, start.isoformat(), end.isoformat())).fetchone()


def account_bills(conn: sqlite3.Connection, aid: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM energy_bills WHERE account_id = ? ORDER BY period_end DESC, revision DESC", (aid,)).fetchall()


# ---------------------------------------------------------------- tariffs and VAT

def tariffs(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM energy_tariffs WHERE deleted_at IS NULL ORDER BY name").fetchall()


def insert_tariff(conn: sqlite3.Connection, tid: str, name: str, kind: str, actor_id: str | None, now: str) -> None:
    conn.execute("INSERT INTO energy_tariffs(id, name, kind, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (tid, name, kind, actor_id, now, now))


def rename_tariff(conn: sqlite3.Connection, tid: str, name: str, now: str) -> None:
    conn.execute("UPDATE energy_tariffs SET name = ?, updated_at = ? WHERE id = ?", (name, now, tid))


def tariff_version(conn: sqlite3.Connection, tid: str, vid: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM energy_tariff_versions WHERE id = ? AND tariff_id = ?", (vid, tid)).fetchone()


def tariff_version_from(conn: sqlite3.Connection, tid: str, effective_from: dt.date) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM energy_tariff_versions WHERE tariff_id = ? AND effective_from = ?", (tid, effective_from.isoformat())).fetchone()


def tou_drafts_on(conn: sqlite3.Connection, day: dt.date) -> int:
    """Draft bills of time-of-use accounts whose period contains `day` (they show the old day type until recalculated)."""
    return conn.execute("""SELECT COUNT(*) FROM energy_bills b JOIN energy_accounts a ON a.id = b.account_id JOIN energy_tariffs t ON t.id = a.tariff_id
                           WHERE b.state = 'draft' AND t.kind = 'tou' AND b.period_start <= ? AND b.period_end > ?""", (day.isoformat(), day.isoformat())).fetchone()[0]


def vat_rate_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM energy_vat_rates ORDER BY effective_from").fetchall()


# ---------------------------------------------------------------- bills

def bills_page(conn: sqlite3.Connection, *, account_id: str | None, customer_id: str | None, state: str | None, from_: dt.date | None, to: dt.date | None,
               q: str | None, limit: int, offset: int) -> tuple[list[sqlite3.Row], int, dict[str, int]]:
    """(one page of bills newest period first, the number matching every filter, the counts by state before the state filter)."""
    where = ["1=1"]
    args: list[Any] = []
    if account_id:
        where.append("b.account_id = ?")
        args.append(account_id)
    if customer_id:
        where.append("b.customer_id = ?")
        args.append(customer_id)
    if from_:
        where.append("b.period_end > ?")
        args.append(from_.isoformat())
    if to:
        where.append("b.period_start <= ?")
        args.append(to.isoformat())
    if q:
        where.append("(b.number LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR c.customer_number LIKE ?)")
        args += [f"%{q}%"] * 4
    base = f"FROM energy_bills b LEFT JOIN energy_accounts a ON a.id = b.account_id LEFT JOIN energy_customers c ON c.id = b.customer_id WHERE {' AND '.join(where)}"
    counts = {s: 0 for s in BILL_STATES}
    for r in conn.execute(f"SELECT b.state, COUNT(*) {base} GROUP BY b.state", args).fetchall():
        counts[r[0]] = r[1]
    if state:
        base += " AND b.state = ?"
        args.append(state)
    total = conn.execute(f"SELECT COUNT(*) {base}", args).fetchone()[0]
    rows = conn.execute(f"SELECT b.* {base} ORDER BY b.period_end DESC, b.created_at DESC LIMIT ? OFFSET ?", (*args, limit, offset)).fetchall()
    return rows, total, counts


def bill_events(conn: sqlite3.Connection, bid: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM energy_bill_events WHERE bill_id = ? ORDER BY at, rowid", (bid,)).fetchall()


def mark_pdf_stored(conn: sqlite3.Connection, bid: str, rel_path: str, sha256: str) -> bool:
    """Record the first stored PDF of an issued bill; False when another request stored one first."""
    return bool(conn.execute("UPDATE energy_bills SET pdf_path = ?, pdf_sha256 = ? WHERE id = ? AND pdf_path IS NULL", (rel_path, sha256, bid)).rowcount)


def auto_runs(conn: sqlite3.Connection, account_id: str | None, limit: int) -> list[sqlite3.Row]:
    """The automatic generation's runs, most recently updated first."""
    sql = "SELECT * FROM energy_auto_runs"
    args: list[Any] = []
    if account_id:
        sql += " WHERE account_id = ?"
        args.append(account_id)
    return conn.execute(sql + " ORDER BY updated_at DESC LIMIT ?", (*args, limit)).fetchall()
