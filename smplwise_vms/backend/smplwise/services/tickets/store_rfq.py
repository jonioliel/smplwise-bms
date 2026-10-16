"""TKRFQ1 (docs/tickets/RFQ_BACKEND_CONTRACT.md, migration 0089): ALL SQL of the requests for quotation - the requests, the invited
vendors, their links and redeem ids, the awards, the private messages, the RFQ timeline, the RFQ quotes (rows of `ticket_quotes` with
`rfq_vendor_id`), retention and full deletion - beside store.py / store_links.py / store_quotes.py.

`rfq_row_unchecked` / `rfq_candidates_unchecked` read requests around the visibility rule: services/tickets/rfq.py (THE rule for
requests, like access.py for tickets) is their only caller (tests/test_tickets_rfq.py fails otherwise). Every other function takes an
id the caller already resolved through that rule (manager routes) or through the system (janitor, outbox worker)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Iterable, Mapping

from ...db import new_id

RFQ_COLUMNS = ("id", "number", "department_id", "title", "description", "site_id", "building_id", "floor_id", "place_text",
               "source_ticket_id", "allowed_line_kinds", "due_at", "work_from", "work_to", "internal_owner_user_id", "state", "created_by",
               "created_at", "updated_at", "sent_at", "due_passed_at", "awarded_at", "closed_at", "cancelled_at", "cancel_reason", "revision")
VENDOR_COLUMNS = ("id", "rfq_id", "contact_id", "channel", "state", "require_code", "invited_at", "sent_at", "first_opened_at",
                  "last_opened_at", "open_count", "quoted_at", "declined_at", "decline_reason", "removed_at", "created_by", "created_at",
                  "updated_at", "revision")
LINK_COLUMNS = ("id", "rfq_vendor_id", "rfq_id", "contact_id", "generation", "key_id", "token_hash", "require_code", "sent_via", "sent_at",
                "created_at", "generation_at", "expires_at", "cap_at", "grace_until", "revoked_at", "revoked_reason", "first_opened_at",
                "last_opened_at", "open_count")
AWARD_COLUMNS = ("id", "rfq_id", "rfq_vendor_id", "quote_id", "state", "line_indexes_json", "finalize", "currency", "approved_subtotal_minor",
                 "approved_vat_minor", "approved_total_minor", "second_required", "threshold_minor", "first_by", "first_at", "second_by",
                 "second_at", "decline_reason", "created_at", "updated_at", "revision")


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _insert(conn: sqlite3.Connection, table: str, row: Mapping[str, Any]) -> None:
    cols = list(row)
    conn.execute(f"INSERT INTO {table}({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def _update(conn: sqlite3.Connection, table: str, allowed: Iterable[str], row_id: str, fields: Mapping[str, Any], *,
            expect_revision: int | None = None, bump: bool = True) -> bool:
    cols = [c for c in fields if c in allowed and c not in ("id", "revision")]
    sets = [f"{c} = ?" for c in cols]
    if bump:
        sets.append("revision = revision + 1")
    if not sets:
        return True
    sql = f"UPDATE {table} SET {', '.join(sets)} WHERE id = ?"
    args: list[Any] = [*[fields[c] for c in cols], row_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(int(expect_revision))
    return conn.execute(sql, args).rowcount == 1


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------- requests

def next_number(conn: sqlite3.Connection) -> int:
    """The next RFQ number (its own sequence, from 1). Inside the caller's write transaction."""
    conn.execute("INSERT OR IGNORE INTO ticket_sequence(name, value) VALUES ('rfq', 0)")
    conn.execute("UPDATE ticket_sequence SET value = value + 1 WHERE name = 'rfq'")
    return int(conn.execute("SELECT value FROM ticket_sequence WHERE name = 'rfq'").fetchone()[0])


def insert_rfq(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    rid = row.get("id") or new_id()
    _insert(conn, "ticket_rfqs", {**row, "id": rid})
    return rid


def rfq_row_unchecked(conn: sqlite3.Connection, rfq_id: str | None) -> dict[str, Any] | None:
    """A request WITHOUT the visibility rule: services/tickets/rfq.py only."""
    if not rfq_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfqs WHERE id = ?", (rfq_id,)).fetchone())


def rfq_candidates_unchecked(conn: sqlite3.Connection, *, department_ids: list[str] | None, user_id: str | None, states: tuple[str, ...] | None,
                             department_id: str | None, query: str, after: tuple[str, str] | None, limit: int,
                             number: int | None = None) -> list[dict[str, Any]]:
    """The indexed superset of a list page (services/tickets/rfq.py decides every row): newest activity first, keyset (updated_at, id).
    `department_ids` None = every department; else those departments OR rows the user created / owns."""
    where: list[str] = []
    args: list[Any] = []
    if department_ids is not None:
        parts = []
        if department_ids:
            parts.append(f"department_id IN ({', '.join('?' * len(department_ids))})")
            args.extend(department_ids)
        if user_id:
            parts.append("created_by = ? OR internal_owner_user_id = ?")
            args.extend([user_id, user_id])
        if not parts:
            return []
        where.append("(" + " OR ".join(parts) + ")")
    if states:
        where.append(f"state IN ({', '.join('?' * len(states))})")
        args.extend(states)
    if department_id:
        where.append("department_id = ?")
        args.append(department_id)
    if query:
        like = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append("(title LIKE ? ESCAPE '\\' OR number = ?)")
        args.extend([like, number if number is not None else -1])
    if after is not None:
        where.append("(updated_at < ? OR (updated_at = ? AND id < ?))")
        args.extend([after[0], after[0], after[1]])
    sql = "SELECT * FROM ticket_rfqs" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY updated_at DESC, id DESC LIMIT ?"
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def update_rfq(conn: sqlite3.Connection, rfq_id: str, fields: Mapping[str, Any], *, expect_revision: int | None = None, bump: bool = True) -> bool:
    return _update(conn, "ticket_rfqs", RFQ_COLUMNS, rfq_id, fields, expect_revision=expect_revision, bump=bump)


def due_rows(conn: sqlite3.Connection, now: str) -> list[dict[str, Any]]:
    """Requests whose deadline passed while they were still collecting (the janitor applies `due_passed`)."""
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfqs WHERE state IN ('sent', 'collecting') AND due_at <= ?", (now,)).fetchall()]


# ---------------------------------------------------------------- invited vendors

def vendors_of(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_vendors WHERE rfq_id = ? ORDER BY created_at, rowid", (rfq_id,)).fetchall()]


def vendor(conn: sqlite3.Connection, rfq_vendor_id: str | None) -> dict[str, Any] | None:
    if not rfq_vendor_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_vendors WHERE id = ?", (rfq_vendor_id,)).fetchone())


def vendor_by_contact(conn: sqlite3.Connection, rfq_id: str, contact_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_rfq_vendors WHERE rfq_id = ? AND contact_id = ?", (rfq_id, contact_id)).fetchone())


def insert_vendor(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    vid = row.get("id") or new_id()
    _insert(conn, "ticket_rfq_vendors", {**row, "id": vid})
    return vid


def update_vendor(conn: sqlite3.Connection, rfq_vendor_id: str, fields: Mapping[str, Any], *, expect_revision: int | None = None) -> bool:
    return _update(conn, "ticket_rfq_vendors", VENDOR_COLUMNS, rfq_vendor_id, fields, expect_revision=expect_revision)


def vendors_of_contact(conn: sqlite3.Connection, contact_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_vendors WHERE contact_id = ?", (contact_id,)).fetchall()]


# ---------------------------------------------------------------- vendor links (the handler-link token model, 0089)

def insert_link(conn: sqlite3.Connection, row: Mapping[str, Any]) -> None:
    _insert(conn, "ticket_rfq_links", row)


def link(conn: sqlite3.Connection, link_id: str | None) -> dict[str, Any] | None:
    if not link_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_links WHERE id = ?", (link_id,)).fetchone())


def link_of_vendor(conn: sqlite3.Connection, rfq_vendor_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_rfq_links WHERE rfq_vendor_id = ?", (rfq_vendor_id,)).fetchone())


def link_by_token_hash(conn: sqlite3.Connection, token_hash: str) -> dict[str, Any] | None:
    """Stage C2's single indexed lookup (the public listener)."""
    return _dict(conn.execute("SELECT * FROM ticket_rfq_links WHERE token_hash = ?", (token_hash,)).fetchone())


def links_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_links WHERE rfq_id = ? ORDER BY created_at", (rfq_id,)).fetchall()]


def live_links_of_contact(conn: sqlite3.Connection, contact_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_links WHERE contact_id = ? AND revoked_at IS NULL", (contact_id,)).fetchall()]


def live_links(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_links WHERE revoked_at IS NULL").fetchall()]


def update_link(conn: sqlite3.Connection, link_id: str, fields: Mapping[str, Any]) -> None:
    _update(conn, "ticket_rfq_links", LINK_COLUMNS, link_id, fields, bump=False)


def revoke_link(conn: sqlite3.Connection, link_id: str, reason: str, at: str) -> bool:
    return conn.execute("UPDATE ticket_rfq_links SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL",
                        (at, reason, link_id)).rowcount == 1


def mark_link_sent(conn: sqlite3.Connection, link_id: str, via: str, at: str) -> None:
    """How the current generation left: the FIRST time stays, and 'email' is sticky (the D6 rule of the handler links)."""
    conn.execute("UPDATE ticket_rfq_links SET sent_at = COALESCE(sent_at, ?), "
                 "sent_via = CASE WHEN sent_via = 'email' THEN 'email' ELSE ? END WHERE id = ?", (at, via, link_id))


def insert_redeem(conn: sqlite3.Connection, id_hash: str, link_id: str, generation: int, created_at: str, expires_at: str) -> None:
    conn.execute("INSERT INTO ticket_rfq_link_redeems(id_hash, link_id, generation, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                 (id_hash, link_id, generation, created_at, expires_at))


def set_live_link_expiry(conn: sqlite3.Connection, rfq_id: str, expires_at: str) -> int:
    """A later deadline moves the live links' expiry with it (never past their cap)."""
    return conn.execute("UPDATE ticket_rfq_links SET expires_at = MIN(?, cap_at) WHERE rfq_id = ? AND revoked_at IS NULL",
                        (expires_at, rfq_id)).rowcount


def set_grace(conn: sqlite3.Connection, rfq_id: str, grace_until: str) -> int:
    return conn.execute("UPDATE ticket_rfq_links SET grace_until = ? WHERE rfq_id = ? AND revoked_at IS NULL", (grace_until, rfq_id)).rowcount


def raise_code(conn: sqlite3.Connection, contact_ids: list[str]) -> int:
    if not contact_ids:
        return 0
    marks = ", ".join("?" * len(contact_ids))
    return conn.execute(f"UPDATE ticket_rfq_links SET require_code = 1 WHERE revoked_at IS NULL AND contact_id IN ({marks})",
                        tuple(contact_ids)).rowcount


# ---------------------------------------------------------------- RFQ quotes (ticket_quotes rows with rfq_vendor_id, 0087)

def quotes_of_vendor(conn: sqlite3.Connection, rfq_vendor_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_quotes WHERE rfq_vendor_id = ? ORDER BY version, rowid", (rfq_vendor_id,)).fetchall()]


def quotes_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT q.* FROM ticket_quotes q JOIN ticket_rfq_vendors v ON v.id = q.rfq_vendor_id WHERE v.rfq_id = ? ORDER BY q.created_at, q.version, q.rowid",
        (rfq_id,)).fetchall()]


def next_version_of_vendor(conn: sqlite3.Connection, rfq_vendor_id: str) -> int:
    return int(conn.execute("SELECT COALESCE(MAX(version), 0) + 1 FROM ticket_quotes WHERE rfq_vendor_id = ?", (rfq_vendor_id,)).fetchone()[0])


# ---------------------------------------------------------------- awards

def insert_award(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    aid = row.get("id") or new_id()
    _insert(conn, "ticket_rfq_awards", {**row, "id": aid})
    return aid


def award(conn: sqlite3.Connection, award_id: str | None) -> dict[str, Any] | None:
    if not award_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_awards WHERE id = ?", (award_id,)).fetchone())


def awards_of(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_awards WHERE rfq_id = ? ORDER BY created_at, rowid", (rfq_id,)).fetchall()]


def update_award(conn: sqlite3.Connection, award_id: str, fields: Mapping[str, Any], *, expect_revision: int | None = None) -> bool:
    return _update(conn, "ticket_rfq_awards", AWARD_COLUMNS, award_id, fields, expect_revision=expect_revision)


# ---------------------------------------------------------------- the private thread with each vendor

def insert_message(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    mid = row.get("id") or new_id()
    _insert(conn, "ticket_rfq_messages", {**row, "id": mid})
    return mid


def messages_of_vendor(conn: sqlite3.Connection, rfq_vendor_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_messages WHERE rfq_vendor_id = ? ORDER BY created_at, rowid",
                                          (rfq_vendor_id,)).fetchall()]


def message_counts(conn: sqlite3.Connection, rfq_id: str) -> dict[str, int]:
    return {r[0]: int(r[1]) for r in conn.execute("SELECT rfq_vendor_id, COUNT(*) FROM ticket_rfq_messages WHERE rfq_id = ? GROUP BY rfq_vendor_id",
                                                  (rfq_id,)).fetchall()}


def set_message_notified(conn: sqlite3.Connection, message_id: str, outbox_id: str | None) -> None:
    conn.execute("UPDATE ticket_rfq_messages SET notified = 1, outbox_id = ? WHERE id = ?", (outbox_id, message_id))


# ---------------------------------------------------------------- the RFQ timeline

def insert_event(conn: sqlite3.Connection, rfq_id: str, kind: str, *, actor_kind: str = "system", actor_user_id: str | None = None,
                 actor_name: str = "", rfq_vendor_id: str | None = None, data: Mapping[str, Any] | None = None, at: str) -> int:
    cur = conn.execute("INSERT INTO ticket_rfq_events(rfq_id, rfq_vendor_id, kind, actor_kind, actor_user_id, actor_name, data_json, at) "
                       "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                       (rfq_id, rfq_vendor_id, kind, actor_kind, actor_user_id, actor_name or "", dumps(dict(data or {})), at))
    return int(cur.lastrowid)


def events_of(conn: sqlite3.Connection, rfq_id: str, limit: int = 200) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM ticket_rfq_events WHERE rfq_id = ? ORDER BY id DESC LIMIT ?", (rfq_id, int(limit))).fetchall()
    return [dict(r) for r in reversed(rows)]


# ---------------------------------------------------------------- the department threshold, users

def department_threshold(conn: sqlite3.Connection, department_id: str | None) -> int | None:
    if not department_id:
        return None
    row = conn.execute("SELECT rfq_second_approval_minor FROM ticket_departments WHERE id = ?", (department_id,)).fetchone()
    return int(row[0]) if row and row[0] is not None else None


def set_department_threshold(conn: sqlite3.Connection, department_id: str, value: int | None) -> bool:
    return conn.execute("UPDATE ticket_departments SET rfq_second_approval_minor = ? WHERE id = ? AND deleted_at IS NULL",
                        (value, department_id)).rowcount == 1


def place_of_floor(conn: sqlite3.Connection, floor_id: str) -> dict[str, Any] | None:
    """{site_id, building_id, floor_id} of a floor (the request's place, authorised like a placed ticket), or None."""
    row = conn.execute("SELECT f.id AS floor_id, f.building_id, b.site_id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.id = ?",
                       (floor_id,)).fetchone()
    return {"site_id": row["site_id"], "building_id": row["building_id"], "floor_id": row["floor_id"]} if row else None


def active_user_ids(conn: sqlite3.Connection) -> list[str]:
    """Every active user (the second-approver search walks them; an installation has tens, not thousands)."""
    return [r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall()]


# ---------------------------------------------------------------- the outbox rows of a request

def cancel_open_outbox(conn: sqlite3.Connection, rfq_id: str, at: str, *, keep_purposes: tuple[str, ...] = ()) -> int:
    """Queued / held invitations, reminders and notices of a request that ended (or of a removed vendor's link) never go out."""
    sql = "UPDATE ticket_outbox SET state = 'cancelled', outcome_code = 'rfq_ended', updated_at = ? WHERE rfq_id = ? AND state IN ('queued', 'held')"
    args: list[Any] = [at, rfq_id]
    if keep_purposes:
        sql += f" AND purpose NOT IN ({', '.join('?' * len(keep_purposes))})"
        args.extend(keep_purposes)
    return conn.execute(sql, args).rowcount


def cancel_open_outbox_of_link(conn: sqlite3.Connection, link_id: str, at: str) -> int:
    return conn.execute("UPDATE ticket_outbox SET state = 'cancelled', outcome_code = 'link_revoked', updated_at = ? "
                        "WHERE link_id = ? AND state IN ('queued', 'held')", (at, link_id)).rowcount


def outbox_states(conn: sqlite3.Connection, rfq_id: str) -> dict[str, dict[str, Any]]:
    """The newest message per vendor link (the board's delivery column): {link_id: {purpose, state, channel, at}}."""
    out: dict[str, dict[str, Any]] = {}
    for r in conn.execute("SELECT link_id, purpose, state, channel, COALESCE(sent_at, updated_at) AS at FROM ticket_outbox "
                          "WHERE rfq_id = ? AND link_id IS NOT NULL ORDER BY created_at, id", (rfq_id,)).fetchall():
        out[r["link_id"]] = {"purpose": r["purpose"], "state": r["state"], "channel": r["channel"], "at": r["at"]}
    return out


def outbox_count_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_outbox WHERE rfq_id = ?", (rfq_id,)).fetchone()[0])


# ---------------------------------------------------------------- retention and full deletion

def ended_before(conn: sqlite3.Connection, before: str) -> list[dict[str, Any]]:
    """Closed / cancelled requests that ended before `before`."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_rfqs WHERE state IN ('closed', 'cancelled') AND COALESCE(closed_at, cancelled_at) < ?", (before,)).fetchall()]


def drop_links_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> int:
    """Spec 6: link ids go 30 days after the request closed (the vendor rows keep their states)."""
    conn.execute("DELETE FROM ticket_rfq_link_redeems WHERE link_id IN (SELECT id FROM ticket_rfq_links WHERE rfq_id = ?)", (rfq_id,))
    return conn.execute("DELETE FROM ticket_rfq_links WHERE rfq_id = ?", (rfq_id,)).rowcount


def prune_redeems(conn: sqlite3.Connection, before: str) -> int:
    return conn.execute("DELETE FROM ticket_rfq_link_redeems WHERE expires_at < ?", (before,)).rowcount


def purge_rfq(conn: sqlite3.Connection, rfq_id: str) -> dict[str, int]:
    """Every row of the request, explicitly (not relying on ON DELETE CASCADE): outbox rows, redeem ids, links, messages, awards,
    events, the quotes WITHOUT a ticket and their decisions, the vendors, then the request. A quote that an order linked to a ticket
    (stage C4: `ticket_id` set) stays with that ticket - it is the ticket's cost baseline; its `rfq_vendor_id` is cleared. Returns the
    rows removed per table. The caller runs it inside one transaction."""
    out: dict[str, int] = {}

    def run(table: str, sql: str, args: tuple[Any, ...]) -> None:
        out[table] = out.get(table, 0) + conn.execute(sql, args).rowcount

    vendors = "(SELECT id FROM ticket_rfq_vendors WHERE rfq_id = ?)"
    links = "(SELECT id FROM ticket_rfq_links WHERE rfq_id = ?)"
    run("ticket_outbox", f"DELETE FROM ticket_outbox WHERE rfq_id = ? OR link_id IN {links}", (rfq_id, rfq_id))
    run("ticket_rfq_link_redeems", f"DELETE FROM ticket_rfq_link_redeems WHERE link_id IN {links}", (rfq_id,))
    run("ticket_rfq_links", "DELETE FROM ticket_rfq_links WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfq_messages", "DELETE FROM ticket_rfq_messages WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfq_awards", "DELETE FROM ticket_rfq_awards WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfq_events", "DELETE FROM ticket_rfq_events WHERE rfq_id = ?", (rfq_id,))
    run("ticket_quote_decisions", f"DELETE FROM ticket_quote_decisions WHERE quote_id IN (SELECT id FROM ticket_quotes WHERE "
        f"ticket_id IS NULL AND rfq_vendor_id IN {vendors})", (rfq_id,))
    run("ticket_quotes", f"DELETE FROM ticket_quotes WHERE ticket_id IS NULL AND rfq_vendor_id IN {vendors}", (rfq_id,))
    conn.execute(f"UPDATE ticket_quotes SET rfq_vendor_id = NULL WHERE ticket_id IS NOT NULL AND rfq_vendor_id IN {vendors}", (rfq_id,))
    run("ticket_rfq_vendors", "DELETE FROM ticket_rfq_vendors WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfqs", "DELETE FROM ticket_rfqs WHERE id = ?", (rfq_id,))
    return {k: v for k, v in out.items() if v}


def rfq_rows_left(conn: sqlite3.Connection, rfq_id: str, vendor_ids: list[str], link_ids: list[str]) -> dict[str, int]:
    """Tests and the purge check: rows still naming the request, per table (empty = nothing left)."""
    left: dict[str, int] = {}
    checks = [("ticket_rfqs", "SELECT COUNT(*) FROM ticket_rfqs WHERE id = ?", (rfq_id,)),
              ("ticket_rfq_vendors", "SELECT COUNT(*) FROM ticket_rfq_vendors WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_rfq_links", "SELECT COUNT(*) FROM ticket_rfq_links WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_rfq_awards", "SELECT COUNT(*) FROM ticket_rfq_awards WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_rfq_messages", "SELECT COUNT(*) FROM ticket_rfq_messages WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_rfq_events", "SELECT COUNT(*) FROM ticket_rfq_events WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_outbox", "SELECT COUNT(*) FROM ticket_outbox WHERE rfq_id = ?", (rfq_id,))]
    for vid in vendor_ids:
        checks.append(("ticket_quotes", "SELECT COUNT(*) FROM ticket_quotes WHERE rfq_vendor_id = ?", (vid,)))
    for lid in link_ids:
        checks.append(("ticket_rfq_link_redeems", "SELECT COUNT(*) FROM ticket_rfq_link_redeems WHERE link_id = ?", (lid,)))
    for table, sql, args in checks:
        n = int(conn.execute(sql, args).fetchone()[0])
        if n:
            left[table] = left.get(table, 0) + n
    return left
