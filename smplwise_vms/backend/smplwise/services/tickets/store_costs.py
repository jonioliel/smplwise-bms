"""CR-038 slice 9: ALL SQL of the cost claims (migration 0083) - the storage layer of section 5 for section 11A, beside store.py
and store_links.py. No ticket row is read here around the visibility rule: every function takes a ticket id the caller already
resolved through access.py (internal routes) or through a handler link (the public routes); the report's claim scan returns
claim rows only, and the report passes every ticket through access.visible()."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Iterable, Mapping

from ...db import new_id


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _insert(conn: sqlite3.Connection, table: str, row: Mapping[str, Any]) -> None:
    cols = list(row)
    conn.execute(f"INSERT INTO {table}({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


# ---------------------------------------------------------------- claims

def claim(conn: sqlite3.Connection, claim_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_cost_claims WHERE id = ?", (claim_id,)).fetchone())


def claim_for_assignment(conn: sqlite3.Connection, assignment_id: str | None) -> dict[str, Any] | None:
    if not assignment_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_cost_claims WHERE assignment_id = ?", (assignment_id,)).fetchone())


def claims_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_claims WHERE ticket_id = ? ORDER BY created_at, id", (ticket_id,)).fetchall()]


def insert_claim(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    cid = row.get("id") or new_id()
    _insert(conn, "ticket_cost_claims", {**row, "id": cid})
    return cid


def update_claim(conn: sqlite3.Connection, claim_id: str, fields: Mapping[str, Any], *, now: str, expect_revision: int | None = None) -> bool:
    """Write fields, bump the claim's optimistic revision; False when `expect_revision` no longer matches."""
    cols = list(fields)
    sets = ", ".join(f"{c} = ?" for c in cols)
    sql = f"UPDATE ticket_cost_claims SET {sets + ', ' if sets else ''}revision = revision + 1, updated_at = ? WHERE id = ?"
    args: list[Any] = [*[fields[c] for c in cols], now, claim_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(expect_revision)
    return conn.execute(sql, args).rowcount == 1


# ---------------------------------------------------------------- revisions (immutable) and decisions (append-only)

def revisions(conn: sqlite3.Connection, claim_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_revisions WHERE claim_id = ? ORDER BY seq", (claim_id,)).fetchall()]


def revision(conn: sqlite3.Connection, revision_id: str | None) -> dict[str, Any] | None:
    if not revision_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_cost_revisions WHERE id = ?", (revision_id,)).fetchone())


def next_seq(conn: sqlite3.Connection, claim_id: str) -> int:
    return int(conn.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM ticket_cost_revisions WHERE claim_id = ?", (claim_id,)).fetchone()[0])


def insert_revision(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    rid = row.get("id") or new_id()
    full = dict(row)
    full["id"] = rid
    if not isinstance(full.get("lines_json"), str):
        full["lines_json"] = json.dumps(full.get("lines_json") or [], ensure_ascii=False, separators=(",", ":"))
    _insert(conn, "ticket_cost_revisions", full)
    return rid


def decisions(conn: sqlite3.Connection, claim_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_decisions WHERE claim_id = ? ORDER BY at, rowid", (claim_id,)).fetchall()]


def insert_decision(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    did = new_id()
    _insert(conn, "ticket_cost_decisions", {**row, "id": did})
    return did


def decision_count(conn: sqlite3.Connection, claim_id: str, action: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_cost_decisions WHERE claim_id = ? AND action = ?", (claim_id, action)).fetchone()[0])


# ---------------------------------------------------------------- files

def insert_file(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    fid = row.get("id") or new_id()
    _insert(conn, "ticket_cost_files", {**row, "id": fid})
    return fid


def file(conn: sqlite3.Connection, file_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_cost_files WHERE id = ?", (file_id,)).fetchone())


def pending_for_link(conn: sqlite3.Connection, link_id: str, since: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_cost_files WHERE claim_id IS NULL AND link_id = ? AND created_at >= ? ORDER BY created_at, id", (link_id, since)).fetchall()]


def pending_for_user(conn: sqlite3.Connection, ticket_id: str, user_id: str, since: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_cost_files WHERE claim_id IS NULL AND link_id IS NULL AND ticket_id = ? AND uploaded_by_kind = 'user' "
        "AND uploaded_by = ? AND created_at >= ? ORDER BY created_at, id", (ticket_id, user_id, since)).fetchall()]


def pending_count_for_link(conn: sqlite3.Connection, link_id: str, since: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_cost_files WHERE claim_id IS NULL AND link_id = ? AND created_at >= ?",
                            (link_id, since)).fetchone()[0])


def files_of_claim(conn: sqlite3.Connection, claim_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_files WHERE claim_id = ? ORDER BY created_at, id", (claim_id,)).fetchall()]


def hash_in_claim_or_pending(conn: sqlite3.Connection, sha256: str, *, claim_id: str | None, link_id: str | None, ticket_id: str,
                             user_id: str | None, since: str) -> bool:
    """11A.6: the same file twice in one claim is refused - against the claim's own files and the uploader's pending ones."""
    if claim_id and conn.execute("SELECT 1 FROM ticket_cost_files WHERE claim_id = ? AND sha256 = ?", (claim_id, sha256)).fetchone():
        return True
    if link_id:
        row = conn.execute("SELECT 1 FROM ticket_cost_files WHERE claim_id IS NULL AND link_id = ? AND sha256 = ? AND created_at >= ?",
                           (link_id, sha256, since)).fetchone()
    else:
        row = conn.execute("SELECT 1 FROM ticket_cost_files WHERE claim_id IS NULL AND link_id IS NULL AND ticket_id = ? AND uploaded_by = ? "
                           "AND sha256 = ? AND created_at >= ?", (ticket_id, user_id, sha256, since)).fetchone()
    return row is not None


def attach_files(conn: sqlite3.Connection, claim_id: str, revision_id: str, placed: Iterable[tuple[str, int, int]]) -> None:
    """Bind (file id, document no, page no) to a revision; a pending file becomes the claim's (claim_id, first revision)."""
    for fid, doc_no, page_no in placed:
        conn.execute("UPDATE ticket_cost_files SET claim_id = ?, revision_id = COALESCE(revision_id, ?) WHERE id = ? AND "
                     "(claim_id IS NULL OR claim_id = ?)", (claim_id, revision_id, fid, claim_id))
        conn.execute("INSERT INTO ticket_cost_revision_files(revision_id, file_id, doc_no, page_no) VALUES (?, ?, ?, ?)",
                     (revision_id, fid, doc_no, page_no))


def revision_files(conn: sqlite3.Connection, revision_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT f.*, rf.doc_no, rf.page_no AS rf_page_no FROM ticket_cost_revision_files rf JOIN ticket_cost_files f ON f.id = rf.file_id "
        "WHERE rf.revision_id = ? ORDER BY rf.doc_no, rf.page_no", (revision_id,)).fetchall()]


def expired_pending(conn: sqlite3.Connection, before: str, limit: int = 500) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_cost_files WHERE claim_id IS NULL AND created_at < ? ORDER BY created_at LIMIT ?", (before, limit)).fetchall()]


def delete_file_row(conn: sqlite3.Connection, file_id: str) -> None:
    conn.execute("DELETE FROM ticket_cost_files WHERE id = ? AND claim_id IS NULL", (file_id,))


# ---------------------------------------------------------------- the claim window and retention

def windows_passed(conn: sqlite3.Connection, now: str, limit: int = 200) -> list[dict[str, Any]]:
    """Required claims whose window ended without a submission and whose "missing" signal was not raised yet."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_cost_claims WHERE status IN ('awaiting', 'rejected') AND missing_at IS NULL AND claim_until IS NOT NULL "
        "AND claim_until <= ? AND required = 1 ORDER BY claim_until LIMIT ?", (now, limit)).fetchall()]


def purgeable(conn: sqlite3.Connection, now: str, limit: int = 100) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_cost_claims WHERE purge_after IS NOT NULL AND purge_after <= ? ORDER BY purge_after LIMIT ?", (now, limit)).fetchall()]


def orphan_unapproved(conn: sqlite3.Connection, limit: int = 100) -> list[dict[str, Any]]:
    """11A.11: claims whose ticket was purged and that were never approved follow the ticket."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_cost_claims WHERE ticket_id IS NULL AND status NOT IN ('approved', 'paid') LIMIT ?", (limit,)).fetchall()]


def delete_claim(conn: sqlite3.Connection, claim_id: str) -> None:
    """Retention only: the claim and (ON DELETE CASCADE) its revisions, decisions and file rows."""
    conn.execute("DELETE FROM ticket_cost_claims WHERE id = ?", (claim_id,))


# ---------------------------------------------------------------- the report's scan (claims only; visibility is the caller's)

def report_rows(conn: sqlite3.Connection, *, date_from: str | None, date_to: str | None, statuses: tuple[str, ...], currency: str | None,
                limit: int = 20_000) -> list[dict[str, Any]]:
    """Claims with their counted revision (approved -> the approved revision, else the current one) whose period date (the approval
    for approved / paid, the current revision's submission otherwise) falls in [from, to)."""
    where = [f"c.status IN ({', '.join('?' * len(statuses))})"]
    args: list[Any] = list(statuses)
    period = "CASE WHEN c.status IN ('approved', 'paid') THEN c.approved_at ELSE r.created_at END"
    if date_from:
        where.append(f"{period} >= ?")
        args.append(date_from)
    if date_to:
        where.append(f"{period} < ?")
        args.append(date_to)
    if currency:
        where.append("r.currency = ?")
        args.append(currency)
    sql = ("SELECT c.id AS claim_id, c.ticket_id, c.department_id, c.contact_id, c.status, c.required, c.no_charge, c.snapshot_json, "
           "c.approved_at, c.paid_at, c.payment_ref, c.payment_date, c.approved_total_minor, " + period + " AS period_at, "
           "r.id AS revision_id, r.seq, r.source, r.kind, r.lines_json, r.labor_minor, r.parts_minor, r.travel_minor, r.other_minor, "
           "r.subtotal_minor, r.vat_mode, r.vat_rate_bp, r.vat_minor, r.total_minor, r.currency, r.vendor_ref, r.created_at AS submitted_at "
           "FROM ticket_cost_claims c JOIN ticket_cost_revisions r ON r.id = COALESCE(c.approved_revision_id, c.current_revision_id) "
           "WHERE " + " AND ".join(where) + " ORDER BY period_at, c.id LIMIT ?")
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


# ---------------------------------------------------------------- department defaults (11A.1 / 11A.5)

def department_cost_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT id, key, name, active, cost_claim, claim_window_days FROM ticket_departments WHERE deleted_at IS NULL ORDER BY sort_order, name").fetchall()]


def set_department_costs(conn: sqlite3.Connection, dept_id: str, cost_claim: str | None, claim_window_days: int | None, now: str) -> bool:
    return conn.execute("UPDATE ticket_departments SET cost_claim = ?, claim_window_days = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
                        (cost_claim, claim_window_days, now, dept_id)).rowcount == 1


# ---------------------------------------------------------------- the ticket row of a claim (the caller already resolved the ticket)

def ticket_row(conn: sqlite3.Connection, ticket_id: str | None) -> dict[str, Any] | None:
    """A ticket by id for the claim machinery - called only for the ticket of a claim, a link or a route that already passed the
    visibility rule (never to list or find tickets)."""
    if not ticket_id:
        return None
    return _dict(conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone())


def set_ticket_cost(conn: sqlite3.Connection, ticket_id: str, status: str, total: int | None, currency: str | None) -> None:
    conn.execute("UPDATE tickets SET cost_status = ?, cost_total_minor = ?, cost_currency = ? WHERE id = ?", (status, total, currency, ticket_id))


def claims_of_contact(conn: sqlite3.Connection, contact_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_cost_claims WHERE contact_id = ? ORDER BY created_at", (contact_id,)).fetchall()]


def set_snapshot(conn: sqlite3.Connection, claim_id: str, snapshot_json: str) -> None:
    conn.execute("UPDATE ticket_cost_claims SET snapshot_json = ? WHERE id = ?", (snapshot_json, claim_id))
