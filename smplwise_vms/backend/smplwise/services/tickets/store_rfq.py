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
               "created_at", "updated_at", "sent_at", "due_passed_at", "awarded_at", "closed_at", "cancelled_at", "cancel_reason", "revision",
               "location_id", "location_snapshot", "location_nav")  # + CR-ORG-LOCATIONS (0101, provisional)
VENDOR_COLUMNS = ("id", "rfq_id", "contact_id", "channel", "channel_choice", "state", "require_code", "invited_at", "sent_at", "first_opened_at",
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


# TKRFQVP (contract 15.1): the public listener's ONE read of an RFQ token - the link, its vendor, its request and its contact, by the
# unique index on `ticket_rfq_links.token_hash`, the same statement for every state of the row
LOOKUP_SQL = (
    "SELECT l.*, v.state AS v_state, v.require_code AS v_require_code, r.state AS r_state, r.number AS r_number, "
    "c.phone_key AS c_phone_key, c.erased_at AS c_erased_at, c.active AS c_active, c.user_id AS c_user_id, c.employee AS c_employee "
    "FROM ticket_rfq_links l JOIN ticket_rfq_vendors v ON v.id = l.rfq_vendor_id JOIN ticket_rfqs r ON r.id = l.rfq_id "
    "JOIN ticket_contacts c ON c.id = l.contact_id ")


def link_by_token_joined(conn: sqlite3.Connection, token_hash: str) -> dict[str, Any] | None:
    return _dict(conn.execute(LOOKUP_SQL + "WHERE l.token_hash = ?", (token_hash,)).fetchone())


def link_by_id_joined(conn: sqlite3.Connection, link_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute(LOOKUP_SQL + "WHERE l.id = ?", (link_id,)).fetchone())


# TKRFQ5 (contract 16.2): the inbound matcher's read - the not-revoked links of an open request whose contact's phone key is the
# sender's, each with the newest RFQ message that went to that contact by WhatsApp over THIS link after `since` (sent / unknown)
_LAST_RFQ_WHATSAPP = ("(SELECT o.{col} FROM ticket_outbox o WHERE o.link_id = l.id AND o.rfq_id = l.rfq_id AND o.channel = 'whatsapp' "
                      "AND o.purpose IN ('rfq_invite', 'rfq_reminder', 'rfq_update') AND o.state IN ('sent', 'unknown') AND o.sent_at > ? "
                      "ORDER BY o.sent_at DESC LIMIT 1)")
INBOUND_SQL = LOOKUP_SQL.replace(
    "SELECT l.*, ", "SELECT l.*, " + ", ".join(f"{_LAST_RFQ_WHATSAPP.format(col=c)} AS o_{c}" for c in ("id", "sent_at", "account_key")) + ", ", 1)


def inbound_links(conn: sqlite3.Connection, sender_key: str, since: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        INBOUND_SQL + "WHERE c.phone_key = ? AND c.erased_at IS NULL AND l.revoked_at IS NULL AND r.state IN ('sent', 'collecting') "
        "ORDER BY l.created_at, l.id", (since, since, since, sender_key)).fetchall()]


def link_of_vendor_joined(conn: sqlite3.Connection, rfq_vendor_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute(LOOKUP_SQL + "WHERE l.rfq_vendor_id = ?", (rfq_vendor_id,)).fetchone())


def release_redeem(conn: sqlite3.Connection, id_hash: str, now: str, max_uses: int) -> tuple[str, int] | None:
    """ONE statement (W4, as store_links.release_redeem): check and increment together."""
    row = conn.execute(
        "UPDATE ticket_rfq_link_redeems SET uses = uses + 1 WHERE id_hash = ? AND expires_at > ? AND uses < ? RETURNING link_id, generation",
        (id_hash, now, int(max_uses))).fetchone()
    return (row[0], int(row[1])) if row else None


def note_open(conn: sqlite3.Connection, link_id: str, rfq_vendor_id: str, at: str) -> bool:
    """A vendor opened his page: the counters of the link and the vendor row (no revision bump - a system move). True on the first open."""
    conn.execute("UPDATE ticket_rfq_links SET first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ?, open_count = open_count + 1 "
                 "WHERE id = ?", (at, at, link_id))
    first = conn.execute("SELECT first_opened_at IS NULL FROM ticket_rfq_vendors WHERE id = ?", (rfq_vendor_id,)).fetchone()
    conn.execute("UPDATE ticket_rfq_vendors SET first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ?, open_count = open_count + 1, "
                 "state = CASE WHEN state = 'sent' THEN 'opened' ELSE state END WHERE id = ?", (at, at, rfq_vendor_id))
    return bool(first and first[0])


def set_vendor_code(conn: sqlite3.Connection, rfq_vendor_id: str, require_code: bool) -> None:
    """The vendor's code choice reaches his live link at once (contract 15.2)."""
    conn.execute("UPDATE ticket_rfq_links SET require_code = ? WHERE rfq_vendor_id = ? AND revoked_at IS NULL", (1 if require_code else 0, rfq_vendor_id))


def inbound_message_count(conn: sqlite3.Connection, rfq_vendor_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM ticket_rfq_messages WHERE rfq_vendor_id = ? AND direction = 'in'", (rfq_vendor_id,)).fetchone()[0])


# ---------------------------------------------------------------- verification codes of RFQ links (contract 15.2; the 0080 rules)

def code_latest(conn: sqlite3.Connection, link_id: str, generation: int) -> dict[str, Any] | None:
    return _dict(conn.execute(
        "SELECT * FROM ticket_rfq_link_codes WHERE link_id = ? AND generation = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (link_id, generation)).fetchone())


def code_times_since(conn: sqlite3.Connection, link_id: str, generation: int, since: str) -> list[str]:
    return [r[0] for r in conn.execute(
        "SELECT created_at FROM ticket_rfq_link_codes WHERE link_id = ? AND generation = ? AND created_at >= ? ORDER BY created_at",
        (link_id, generation, since)).fetchall()]


def code_replace(conn: sqlite3.Connection, row: Mapping[str, Any], now: str) -> None:
    """One transaction (W7): every older unconsumed live code of the LINK stops at `now`, then the new row."""
    conn.execute("UPDATE ticket_rfq_link_codes SET expires_at = ? WHERE link_id = ? AND consumed_at IS NULL AND expires_at > ?",
                 (now, row["link_id"], now))
    conn.execute(
        "INSERT INTO ticket_rfq_link_codes(id, link_id, generation, code_hash, channel, created_at, expires_at, attempts, consumed_at, outbox_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        (row["id"], row["link_id"], row["generation"], row["code_hash"], row["channel"], row["created_at"], row["expires_at"],
         int(row.get("attempts") or 0), row.get("consumed_at")))


def code_expire(conn: sqlite3.Connection, code_id: str, now: str) -> None:
    conn.execute("UPDATE ticket_rfq_link_codes SET expires_at = MIN(expires_at, ?) WHERE id = ?", (now, code_id))


def code_add_attempt(conn: sqlite3.Connection, code_id: str) -> int:
    conn.execute("UPDATE ticket_rfq_link_codes SET attempts = attempts + 1 WHERE id = ?", (code_id,))
    row = conn.execute("SELECT attempts FROM ticket_rfq_link_codes WHERE id = ?", (code_id,)).fetchone()
    return int(row[0]) if row else 0


def code_consume(conn: sqlite3.Connection, code_id: str, now: str) -> bool:
    return conn.execute("UPDATE ticket_rfq_link_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL", (now, code_id)).rowcount == 1


def code_set_outbox(conn: sqlite3.Connection, code_id: str, outbox_id: str) -> None:
    conn.execute("UPDATE ticket_rfq_link_codes SET outbox_id = ? WHERE id = ?", (outbox_id, code_id))


def code_failures(conn: sqlite3.Connection, link_id: str, generation: int) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_rfq_link_failures WHERE link_id = ? AND generation = ?", (link_id, generation)).fetchone())


def code_put_failures(conn: sqlite3.Connection, link_id: str, generation: int, window_start: str, n: int, locked_until: str | None) -> None:
    conn.execute(
        "INSERT INTO ticket_rfq_link_failures(link_id, generation, window_start, failures, locked_until) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(link_id, generation) DO UPDATE SET window_start = excluded.window_start, failures = excluded.failures, "
        "locked_until = excluded.locked_until", (link_id, generation, window_start, n, locked_until))


def code_clear_failures(conn: sqlite3.Connection, link_id: str, generation: int) -> None:
    conn.execute("DELETE FROM ticket_rfq_link_failures WHERE link_id = ? AND generation = ?", (link_id, generation))


def code_put_session(conn: sqlite3.Connection, id_hash: str, link_id: str, generation: int, created_at: str, expires_at: str) -> None:
    conn.execute("INSERT OR REPLACE INTO ticket_rfq_link_sessions(id_hash, link_id, generation, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                 (id_hash, link_id, generation, created_at, expires_at))


def code_session(conn: sqlite3.Connection, id_hash: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_rfq_link_sessions WHERE id_hash = ?", (id_hash,)).fetchone())


def prune_codes(conn: sqlite3.Connection, before: str) -> int:
    """Codes, sessions and wrong-code windows one day after their end (the hourly retention of the public listener)."""
    n = conn.execute("DELETE FROM ticket_rfq_link_codes WHERE expires_at < ?", (before,)).rowcount
    n += conn.execute("DELETE FROM ticket_rfq_link_sessions WHERE expires_at < ?", (before,)).rowcount
    n += conn.execute("DELETE FROM ticket_rfq_link_failures WHERE (locked_until IS NULL OR locked_until < ?) AND window_start < ?",
                      (before, before)).rowcount
    return n


CODE_TABLES = ("ticket_rfq_link_codes", "ticket_rfq_link_failures", "ticket_rfq_link_sessions")


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


# ---------------------------------------------------------------- RFQ quotes (ticket_quotes rows with rfq_vendor_id, 0088)

def quotes_of_vendor(conn: sqlite3.Connection, rfq_vendor_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_quotes WHERE rfq_vendor_id = ? ORDER BY version, rowid", (rfq_vendor_id,)).fetchall()]


def quotes_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT q.* FROM ticket_quotes q JOIN ticket_rfq_vendors v ON v.id = q.rfq_vendor_id WHERE v.rfq_id = ? ORDER BY q.created_at, q.version, q.rowid",
        (rfq_id,)).fetchall()]


def rfq_quote_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """TKRFQ4: the awarded RFQ quote an order linked to this ticket (its cost baseline), or None for a ticket not opened from an RFQ."""
    return _dict(conn.execute("SELECT * FROM ticket_quotes WHERE ticket_id = ? AND rfq_vendor_id IS NOT NULL ORDER BY created_at, rowid LIMIT 1",
                              (ticket_id,)).fetchone())


def ordered_quotes_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    """TKRFQ4: the quotes of a request that an order linked to a ticket (one per awarded vendor)."""
    return [dict(r) for r in conn.execute(
        "SELECT q.* FROM ticket_quotes q JOIN ticket_rfq_vendors v ON v.id = q.rfq_vendor_id WHERE v.rfq_id = ? AND q.ticket_id IS NOT NULL "
        "ORDER BY q.created_at, q.rowid", (rfq_id,)).fetchall()]


def order_events(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    """TKRFQ4: the order rows of a request's timeline (every one - not the presentation window of events_of)."""
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_events WHERE rfq_id = ? AND kind IN ('order_created', 'order_sent', 'order_resent') ORDER BY id",
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


# ---------------------------------------------------------------- CR-RFQ-PAYMENT-SCHEDULE: the award's terms (schedule + arrival)

TERMS_COLUMNS = ("currency", "total_minor", "schedule_json", "schedule_source", "arrival_state", "planned_from", "planned_to", "proposed_from",
                 "proposed_to", "rejected_at", "requested_at", "reminded_at", "reminders", "confirmed_at", "confirmed_by", "acknowledged_at",
                 "acknowledged_hash", "escalated_at", "decided_by", "decided_at", "updated_at",
                 "arrival_changed_at")  # + RFQPAY2 20.14; overdue_key: set_overdue_key (no bump)


def insert_terms(conn: sqlite3.Connection, row: Mapping[str, Any]) -> None:
    _insert(conn, "ticket_rfq_award_terms", row)


def terms(conn: sqlite3.Connection, award_id: str | None) -> dict[str, Any] | None:
    if not award_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_award_terms WHERE award_id = ?", (award_id,)).fetchone())


def update_terms(conn: sqlite3.Connection, award_id: str, fields: Mapping[str, Any], *, expect_revision: int | None = None) -> bool:
    cols = [c for c in fields if c in TERMS_COLUMNS]
    sql = f"UPDATE ticket_rfq_award_terms SET {', '.join([f'{c} = ?' for c in cols] + ['revision = revision + 1'])} WHERE award_id = ?"
    args: list[Any] = [*[fields[c] for c in cols], award_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(int(expect_revision))
    return conn.execute(sql, args).rowcount == 1


def delete_terms(conn: sqlite3.Connection, award_id: str) -> int:
    return conn.execute("DELETE FROM ticket_rfq_award_terms WHERE award_id = ?", (award_id,)).rowcount


def terms_waiting(conn: sqlite3.Connection, requested_before: str, max_reminders: int = 2) -> list[dict[str, Any]]:
    """The janitor's reminder candidates: arrival not confirmed (nor proposed), the vendor told before `requested_before`, fewer than
    `max_reminders` reminders, the last one (if any) also before `requested_before`, the award final, the request still awarded /
    ordered and the vendor still awarded. Review F5: every row returned is actionable - exhausted, recently reminded, pending or ended
    rows never fill the batch - and the longest-waiting go first, so LIMIT 200 cannot starve a newer vendor."""
    return [dict(r) for r in conn.execute(
        "SELECT t.* FROM ticket_rfq_award_terms t "
        "JOIN ticket_rfq_awards a ON a.id = t.award_id AND a.state = 'approved' "
        "JOIN ticket_rfqs r ON r.id = t.rfq_id AND r.state IN ('awarded', 'ordered') "
        "JOIN ticket_rfq_vendors v ON v.id = t.rfq_vendor_id AND v.state = 'awarded' "
        "WHERE t.arrival_state = 'awaiting' AND t.requested_at IS NOT NULL AND t.requested_at <= ? AND t.reminders < ? "
        "AND (t.reminded_at IS NULL OR t.reminded_at <= ?) "
        "ORDER BY COALESCE(t.reminded_at, t.requested_at), t.award_id LIMIT 200",
        (requested_before, int(max_reminders), requested_before)).fetchall()]


def terms_unconfirmed(conn: sqlite3.Connection, reminded_before: str, max_reminders: int = 2) -> list[dict[str, Any]]:
    """Owner decision (lead, 2026-10-17): still not confirmed one delay after the LAST reminder -> escalate to the RFQ managers once
    (`escalated_at`). The same actionable filters as `terms_waiting`; the work order is never blocked by this."""
    return [dict(r) for r in conn.execute(
        "SELECT t.* FROM ticket_rfq_award_terms t "
        "JOIN ticket_rfq_awards a ON a.id = t.award_id AND a.state = 'approved' "
        "JOIN ticket_rfqs r ON r.id = t.rfq_id AND r.state IN ('awarded', 'ordered') "
        "JOIN ticket_rfq_vendors v ON v.id = t.rfq_vendor_id AND v.state = 'awarded' "
        "WHERE t.arrival_state = 'awaiting' AND t.reminders >= ? AND t.escalated_at IS NULL AND t.reminded_at IS NOT NULL "
        "AND t.reminded_at <= ? ORDER BY t.reminded_at, t.award_id LIMIT 200", (int(max_reminders), reminded_before)).fetchall()]


_KEEP = object()


def set_overdue_key(conn: sqlite3.Connection, award_id: str, key: str | None, notified_at: Any = _KEEP) -> None:
    """RFQPAY2: the janitor's memory of the overdue instalments it signalled (and when it last notified) - NOT a revision bump (a
    manager's open page never goes stale because the janitor looked)."""
    if notified_at is _KEEP:
        conn.execute("UPDATE ticket_rfq_award_terms SET overdue_key = ? WHERE award_id = ?", (key, award_id))
    else:
        conn.execute("UPDATE ticket_rfq_award_terms SET overdue_key = ?, overdue_notified_at = ? WHERE award_id = ?", (key, notified_at, award_id))


def terms_payable(conn: sqlite3.Connection, states: Iterable[str]) -> list[dict[str, Any]]:
    """RFQPAY2: the overdue scan's candidates - every final award with terms on a request in `states`, plus every row that still has an
    open overdue signal (so a cancelled request / declined award gets its signal resolved). Oldest award first."""
    st = tuple(states)
    marks = ", ".join("?" * len(st))
    return [dict(r) for r in conn.execute(
        "SELECT t.*, a.state AS award_state, a.quote_id AS quote_id, r.state AS rfq_state FROM ticket_rfq_award_terms t "
        "JOIN ticket_rfq_awards a ON a.id = t.award_id JOIN ticket_rfqs r ON r.id = t.rfq_id "
        f"WHERE (a.state = 'approved' AND r.state IN ({marks})) OR t.overdue_key IS NOT NULL ORDER BY t.created_at, t.award_id",
        st).fetchall()]


# ---------------------------------------------------------------- RFQPAY2: one payment demand per approved instalment

DEMAND_COLUMNS = ("amount_minor", "currency", "due_date", "status", "created_by", "created_at", "paid_by", "paid_at", "cancelled_by",
                  "cancelled_at", "updated_at")


def insert_demand(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    did = row.get("id") or new_id()
    _insert(conn, "ticket_rfq_instalment_demands", {**row, "id": did})
    return did


def demand(conn: sqlite3.Connection, quote_id: str | None, index: int) -> dict[str, Any] | None:
    if not quote_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_instalment_demands WHERE quote_id = ? AND instalment_index = ?",
                              (quote_id, int(index))).fetchone())


def demands_of_quote(conn: sqlite3.Connection, quote_id: str | None) -> dict[int, dict[str, Any]]:
    if not quote_id:
        return {}
    return {int(r["instalment_index"]): dict(r) for r in conn.execute(
        "SELECT * FROM ticket_rfq_instalment_demands WHERE quote_id = ? ORDER BY instalment_index", (quote_id,)).fetchall()}


def update_demand(conn: sqlite3.Connection, demand_id: str, fields: Mapping[str, Any], *, expect_revision: int | None = None) -> bool:
    return _update(conn, "ticket_rfq_instalment_demands", DEMAND_COLUMNS, demand_id, fields, expect_revision=expect_revision)


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


# ---------------------------------------------------------------- RFQQUESTIONS: a vendor's question (an inbound message) and its state

def message(conn: sqlite3.Connection, message_id: str | None) -> dict[str, Any] | None:
    if not message_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_messages WHERE id = ?", (message_id,)).fetchone())


def pending_questions(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    """The request's unanswered vendor questions, oldest first."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_rfq_messages WHERE rfq_id = ? AND direction = 'in' AND answered_at IS NULL ORDER BY created_at, rowid",
        (rfq_id,)).fetchall()]


def question_counts(conn: sqlite3.Connection, rfq_id: str) -> dict[str, dict[str, int]]:
    """Per vendor row: {pending, unread} of the unanswered questions."""
    return {r[0]: {"pending": int(r[1]), "unread": int(r[2] or 0)} for r in conn.execute(
        "SELECT rfq_vendor_id, COUNT(*), SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) FROM ticket_rfq_messages "
        "WHERE rfq_id = ? AND direction = 'in' AND answered_at IS NULL GROUP BY rfq_vendor_id", (rfq_id,)).fetchall()}


def rfqs_with_pending(conn: sqlite3.Connection, states: Iterable[str], limit: int = 500) -> list[tuple[str, int, int]]:
    """(rfq_id, pending, unread) of the requests in `states` that hold unanswered questions - the caller filters by visibility."""
    st = list(states)
    return [(r[0], int(r[1]), int(r[2] or 0)) for r in conn.execute(
        "SELECT m.rfq_id, COUNT(*), SUM(CASE WHEN m.read_at IS NULL THEN 1 ELSE 0 END) FROM ticket_rfq_messages m "
        "JOIN ticket_rfqs r ON r.id = m.rfq_id "
        f"WHERE m.direction = 'in' AND m.answered_at IS NULL AND r.state IN ({', '.join('?' * len(st))}) "
        "GROUP BY m.rfq_id ORDER BY MAX(m.created_at) DESC LIMIT ?", (*st, int(limit))).fetchall()]


def mark_questions_read(conn: sqlite3.Connection, rfq_vendor_id: str, by: str, at: str) -> int:
    cur = conn.execute("UPDATE ticket_rfq_messages SET read_at = ?, read_by = ? WHERE rfq_vendor_id = ? AND direction = 'in' AND read_at IS NULL",
                       (at, by, rfq_vendor_id))
    return int(cur.rowcount or 0)


def answer_questions(conn: sqlite3.Connection, ids: Iterable[str], *, by: str, at: str, answer_id: str | None) -> int:
    """Mark these pending questions answered (by `answer_id`, or handled without a reply when None); read with it."""
    n = 0
    for qid in ids:
        cur = conn.execute("UPDATE ticket_rfq_messages SET answered_at = ?, answered_by = ?, answer_id = ?, read_at = COALESCE(read_at, ?), "
                           "read_by = COALESCE(read_by, ?) WHERE id = ? AND direction = 'in' AND answered_at IS NULL",
                           (at, by, answer_id, at, by, qid))
        n += int(cur.rowcount or 0)
    return n


def questions_due_for_reminder(conn: sqlite3.Connection, before: str, states: Iterable[str], limit: int = 200) -> list[dict[str, Any]]:
    st = list(states)
    return [dict(r) for r in conn.execute(
        "SELECT m.* FROM ticket_rfq_messages m JOIN ticket_rfqs r ON r.id = m.rfq_id "
        f"WHERE m.direction = 'in' AND m.answered_at IS NULL AND m.reminded_at IS NULL AND m.created_at <= ? AND r.state IN ({', '.join('?' * len(st))}) "
        "ORDER BY m.created_at, m.rowid LIMIT ?", (before, *st, int(limit))).fetchall()]


def set_question_reminded(conn: sqlite3.Connection, message_id: str, at: str) -> None:
    conn.execute("UPDATE ticket_rfq_messages SET reminded_at = ? WHERE id = ?", (at, message_id))


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
    for table in CODE_TABLES:  # TKRFQVP (contract 15.7): codes, sessions, wrong-code windows go with their links
        conn.execute(f"DELETE FROM {table} WHERE link_id IN (SELECT id FROM ticket_rfq_links WHERE rfq_id = ?)", (rfq_id,))
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
    # TKRFQ4: an order message belongs to the ticket it was sent for (its delivery line) - it stays, without the request's id
    conn.execute("UPDATE ticket_outbox SET rfq_id = NULL WHERE rfq_id = ? AND ticket_id IS NOT NULL", (rfq_id,))
    run("ticket_outbox", f"DELETE FROM ticket_outbox WHERE rfq_id = ? OR link_id IN {links}", (rfq_id, rfq_id))
    run("ticket_rfq_link_redeems", f"DELETE FROM ticket_rfq_link_redeems WHERE link_id IN {links}", (rfq_id,))
    for table in CODE_TABLES:  # TKRFQVP (contract 15.7)
        run(table, f"DELETE FROM {table} WHERE link_id IN {links}", (rfq_id,))
    run("ticket_rfq_links", "DELETE FROM ticket_rfq_links WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfq_messages", "DELETE FROM ticket_rfq_messages WHERE rfq_id = ?", (rfq_id,))
    # CR-RFQ-PAYMENT-SCHEDULE: the awards' terms (an ordered quote keeps its approved schedule in ticket_quotes.payment_schedule_json)
    run("ticket_rfq_award_terms", "DELETE FROM ticket_rfq_award_terms WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfq_awards", "DELETE FROM ticket_rfq_awards WHERE rfq_id = ?", (rfq_id,))
    run("ticket_rfq_events", "DELETE FROM ticket_rfq_events WHERE rfq_id = ?", (rfq_id,))
    # RFQPAY2: the instalment demands of the quotes deleted below (an ordered quote keeps its demands - they belong to its baseline)
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ticket_rfq_instalment_demands'").fetchone():
        run("ticket_rfq_instalment_demands", f"DELETE FROM ticket_rfq_instalment_demands WHERE quote_id IN (SELECT id FROM ticket_quotes "
            f"WHERE ticket_id IS NULL AND rfq_vendor_id IN {vendors})", (rfq_id,))
    run("ticket_quote_decisions", f"DELETE FROM ticket_quote_decisions WHERE quote_id IN (SELECT id FROM ticket_quotes WHERE "
        f"ticket_id IS NULL AND rfq_vendor_id IN {vendors})", (rfq_id,))
    run("ticket_quotes", f"DELETE FROM ticket_quotes WHERE ticket_id IS NULL AND rfq_vendor_id IN {vendors}", (rfq_id,))
    conn.execute(f"UPDATE ticket_quotes SET rfq_vendor_id = NULL WHERE ticket_id IS NOT NULL AND rfq_vendor_id IN {vendors}", (rfq_id,))
    if has_attachments(conn):  # RFQATT: a file a work order referenced stays with its service request(s), without the request's id
        conn.execute("UPDATE ticket_rfq_attachments SET rfq_id = NULL WHERE rfq_id = ? AND id IN (SELECT attachment_id FROM "
                     "ticket_rfq_attachment_refs)", (rfq_id,))
        run("ticket_rfq_attachments", "DELETE FROM ticket_rfq_attachments WHERE rfq_id = ?", (rfq_id,))
    if has_vendor_files(conn):  # RFQ-VENDOR-UPLOAD: a vendor file a work order references stays with that service request
        conn.execute("UPDATE ticket_rfq_vendor_files SET rfq_id = NULL, rfq_vendor_id = NULL WHERE rfq_id = ? AND id IN (SELECT file_id FROM "
                     "ticket_rfq_vendor_file_refs)", (rfq_id,))
        run("ticket_rfq_vendor_files", "DELETE FROM ticket_rfq_vendor_files WHERE rfq_id = ?", (rfq_id,))
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
              ("ticket_rfq_award_terms", "SELECT COUNT(*) FROM ticket_rfq_award_terms WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_rfq_messages", "SELECT COUNT(*) FROM ticket_rfq_messages WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_rfq_events", "SELECT COUNT(*) FROM ticket_rfq_events WHERE rfq_id = ?", (rfq_id,)),
              ("ticket_outbox", "SELECT COUNT(*) FROM ticket_outbox WHERE rfq_id = ?", (rfq_id,))]
    if has_attachments(conn):
        checks.append(("ticket_rfq_attachments", "SELECT COUNT(*) FROM ticket_rfq_attachments WHERE rfq_id = ?", (rfq_id,)))
    if has_vendor_files(conn):
        checks.append(("ticket_rfq_vendor_files", "SELECT COUNT(*) FROM ticket_rfq_vendor_files WHERE rfq_id = ?", (rfq_id,)))
    for vid in vendor_ids:
        checks.append(("ticket_quotes", "SELECT COUNT(*) FROM ticket_quotes WHERE rfq_vendor_id = ?", (vid,)))
    for lid in link_ids:
        checks.append(("ticket_rfq_link_redeems", "SELECT COUNT(*) FROM ticket_rfq_link_redeems WHERE link_id = ?", (lid,)))
        for table in CODE_TABLES:
            checks.append((table, f"SELECT COUNT(*) FROM {table} WHERE link_id = ?", (lid,)))
    for table, sql, args in checks:
        n = int(conn.execute(sql, args).fetchone()[0])
        if n:
            left[table] = left.get(table, 0) + n
    return left


# ---------------------------------------------------------------- RFQATT: files on a request (migration 0102)

ATTACHMENT_COLUMNS = ("id", "rfq_id", "folder", "kind", "name", "caption", "mime", "path", "thumb_path", "sha256", "bytes", "width", "height",
                      "visible_vendors", "position", "created_by", "created_at", "updated_at", "removed_at", "removed_by")


def has_attachments(conn: sqlite3.Connection) -> bool:
    """Whether 0102 is applied (a database migrated only part of the way - some tests - has no attachment tables)."""
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ticket_rfq_attachments'").fetchone() is not None


def insert_attachment(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    row = {"id": new_id(), **row}
    _insert(conn, "ticket_rfq_attachments", row)
    return row["id"]


def attachment(conn: sqlite3.Connection, rfq_id: str, attachment_id: str | None) -> dict[str, Any] | None:
    """One file OF THIS REQUEST (another request's id reads as unknown)."""
    if not attachment_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_attachments WHERE id = ? AND rfq_id = ?", (attachment_id, rfq_id)).fetchone())


def attachments_of(conn: sqlite3.Connection, rfq_id: str, *, include_removed: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM ticket_rfq_attachments WHERE rfq_id = ?" + ("" if include_removed else " AND removed_at IS NULL")
    return [dict(r) for r in conn.execute(sql + " ORDER BY position, created_at, id", (rfq_id,)).fetchall()]


def attachment_usage(conn: sqlite3.Connection, rfq_id: str) -> tuple[int, int]:
    """(live files, their stored bytes) of a request - the quota."""
    row = conn.execute("SELECT COUNT(*), COALESCE(SUM(bytes), 0) FROM ticket_rfq_attachments WHERE rfq_id = ? AND removed_at IS NULL",
                       (rfq_id,)).fetchone()
    return int(row[0]), int(row[1])


def next_attachment_position(conn: sqlite3.Connection, rfq_id: str) -> int:
    row = conn.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM ticket_rfq_attachments WHERE rfq_id = ?", (rfq_id,)).fetchone()
    return int(row[0])


def update_attachment(conn: sqlite3.Connection, attachment_id: str, fields: Mapping[str, Any]) -> bool:
    return _update(conn, "ticket_rfq_attachments", ("caption", "visible_vendors", "position", "updated_at", "removed_at", "removed_by"),
                   attachment_id, fields, bump=False)


def delete_attachment(conn: sqlite3.Connection, attachment_id: str) -> bool:
    conn.execute("DELETE FROM ticket_rfq_attachment_refs WHERE attachment_id = ?", (attachment_id,))
    return conn.execute("DELETE FROM ticket_rfq_attachments WHERE id = ?", (attachment_id,)).rowcount == 1


def quotes_arrived(conn: sqlite3.Connection, rfq_id: str) -> bool:
    """Whether any quote (any state, any source) was ever recorded on the request - after that a file is only marked removed."""
    return conn.execute("SELECT 1 FROM ticket_quotes WHERE rfq_vendor_id IN (SELECT id FROM ticket_rfq_vendors WHERE rfq_id = ?) LIMIT 1",
                        (rfq_id,)).fetchone() is not None


def attachment_paths_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[str]:
    """The stored paths a purge of the request removes (the files no service request references)."""
    out: list[str] = []
    for r in conn.execute("SELECT path, thumb_path FROM ticket_rfq_attachments WHERE rfq_id = ? AND id NOT IN (SELECT attachment_id FROM "
                          "ticket_rfq_attachment_refs)", (rfq_id,)).fetchall():
        out.extend(p for p in (r[0], r[1]) if p)
    return out


def add_attachment_refs(conn: sqlite3.Connection, rfq_id: str, ticket_id: str, award_id: str | None, at: str) -> int:
    """The reference copy at a work order (TKRFQ4): every live, vendor-visible file of the request is referenced by the ticket."""
    return conn.execute("INSERT OR IGNORE INTO ticket_rfq_attachment_refs(ticket_id, attachment_id, award_id, created_at) "
                        "SELECT ?, id, ?, ? FROM ticket_rfq_attachments WHERE rfq_id = ? AND removed_at IS NULL AND visible_vendors = 1",
                        (ticket_id, award_id, at, rfq_id)).rowcount


def attachments_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    """The request files a ticket references (still live and vendor-visible)."""
    return [dict(r) for r in conn.execute(
        "SELECT a.* FROM ticket_rfq_attachments a JOIN ticket_rfq_attachment_refs r ON r.attachment_id = a.id WHERE r.ticket_id = ? "
        "AND a.removed_at IS NULL AND a.visible_vendors = 1 ORDER BY a.position, a.created_at, a.id", (ticket_id,)).fetchall()]


def attachment_of_ticket(conn: sqlite3.Connection, ticket_id: str, attachment_id: str | None) -> dict[str, Any] | None:
    if not attachment_id:
        return None
    return _dict(conn.execute(
        "SELECT a.* FROM ticket_rfq_attachments a JOIN ticket_rfq_attachment_refs r ON r.attachment_id = a.id WHERE r.ticket_id = ? "
        "AND a.id = ? AND a.removed_at IS NULL AND a.visible_vendors = 1", (ticket_id, attachment_id)).fetchone())


def drop_orphan_attachments(conn: sqlite3.Connection) -> int:
    """The janitor: a file no request and no service request names any more (its request was purged, then its last referencing
    ticket). The file on disk goes with the orphan sweep (deletion.sweep_orphan_files / sweep_orphans)."""
    return conn.execute("DELETE FROM ticket_rfq_attachments WHERE rfq_id IS NULL AND id NOT IN (SELECT attachment_id FROM "
                        "ticket_rfq_attachment_refs)").rowcount


# ---------------------------------------------------------------- RFQ-VENDOR-UPLOAD: a vendor's own files on his quote (migration 0110)

def has_vendor_files(conn: sqlite3.Connection) -> bool:
    """Whether 0110 is applied (a database migrated only part of the way - some tests - has no vendor-file table)."""
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ticket_rfq_vendor_files'").fetchone() is not None


def insert_vendor_file(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    row = {"id": new_id(), **row}
    _insert(conn, "ticket_rfq_vendor_files", row)
    return row["id"]


def vendor_file(conn: sqlite3.Connection, rfq_id: str, file_id: str | None) -> dict[str, Any] | None:
    """One vendor file OF THIS REQUEST (another request's id reads as unknown)."""
    if not file_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_rfq_vendor_files WHERE id = ? AND rfq_id = ?", (file_id, rfq_id)).fetchone())


def vendor_files_of(conn: sqlite3.Connection, rfq_vendor_id: str, *, include_removed: bool = False) -> list[dict[str, Any]]:
    """The files of ONE vendor row (his own request only - the row id is the link's)."""
    sql = "SELECT * FROM ticket_rfq_vendor_files WHERE rfq_vendor_id = ?" + ("" if include_removed else " AND removed_at IS NULL")
    return [dict(r) for r in conn.execute(sql + " ORDER BY created_at, rowid", (rfq_vendor_id,)).fetchall()]  # upload order


def vendor_files_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_vendor_files WHERE rfq_id = ? ORDER BY created_at, rowid", (rfq_id,)).fetchall()]


def vendor_file_usage(conn: sqlite3.Connection, rfq_vendor_id: str) -> tuple[int, int, int]:
    """(live files, every file ever stored, stored bytes of every file incl. removed ones and thumbnails) of one vendor row - the
    quota: a removal hides a file from the managers' lists but keeps it on disk, so it never gives bytes or uploads back."""
    row = conn.execute("SELECT COALESCE(SUM(CASE WHEN removed_at IS NULL THEN 1 ELSE 0 END), 0), COUNT(*), COALESCE(SUM(stored_bytes), 0) "
                       "FROM ticket_rfq_vendor_files WHERE rfq_vendor_id = ?", (rfq_vendor_id,)).fetchone()
    return int(row[0]), int(row[1]), int(row[2])


def mark_vendor_file_removed(conn: sqlite3.Connection, file_id: str, at: str) -> bool:
    return conn.execute("UPDATE ticket_rfq_vendor_files SET removed_at = ? WHERE id = ? AND removed_at IS NULL", (at, file_id)).rowcount == 1


def vendor_file_paths_of_rfq(conn: sqlite3.Connection, rfq_id: str) -> list[str]:
    """The stored paths a purge of the request removes (the files no work order references)."""
    out: list[str] = []
    for r in conn.execute("SELECT path, thumb_path FROM ticket_rfq_vendor_files WHERE rfq_id = ? AND id NOT IN (SELECT file_id FROM "
                          "ticket_rfq_vendor_file_refs)", (rfq_id,)).fetchall():
        out.extend(p for p in (r[0], r[1]) if p)
    return out


def vendor_files_of_message(conn: sqlite3.Connection, rfq_id: str, message_ids: Iterable[str]) -> dict[str, list[dict[str, Any]]]:
    """The files bound to these questions of THIS request (live and removed), per message id."""
    ids = [m for m in message_ids if m]
    out: dict[str, list[dict[str, Any]]] = {}
    if not ids:
        return out
    marks = ",".join("?" * len(ids))
    for r in conn.execute(f"SELECT * FROM ticket_rfq_vendor_files WHERE rfq_id = ? AND message_id IN ({marks}) ORDER BY created_at, rowid",
                          (rfq_id, *ids)).fetchall():
        out.setdefault(r["message_id"], []).append(dict(r))
    return out


def add_vendor_file_refs(conn: sqlite3.Connection, rfq_vendor_id: str, ticket_id: str, award_id: str | None, at: str) -> int:
    """The work order's reference (owner 2026-10-17): every live file of the awarded vendor row is referenced by the new ticket."""
    return conn.execute("INSERT OR IGNORE INTO ticket_rfq_vendor_file_refs(ticket_id, file_id, award_id, created_at) "
                        "SELECT ?, id, ?, ? FROM ticket_rfq_vendor_files WHERE rfq_vendor_id = ? AND removed_at IS NULL",
                        (ticket_id, award_id, at, rfq_vendor_id)).rowcount


def vendor_files_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    """The vendor files a ticket references (still live)."""
    return [dict(r) for r in conn.execute(
        "SELECT f.* FROM ticket_rfq_vendor_files f JOIN ticket_rfq_vendor_file_refs r ON r.file_id = f.id WHERE r.ticket_id = ? "
        "AND f.removed_at IS NULL ORDER BY f.created_at, f.rowid", (ticket_id,)).fetchall()]


def vendor_file_of_ticket(conn: sqlite3.Connection, ticket_id: str, file_id: str | None) -> dict[str, Any] | None:
    if not file_id:
        return None
    return _dict(conn.execute(
        "SELECT f.* FROM ticket_rfq_vendor_files f JOIN ticket_rfq_vendor_file_refs r ON r.file_id = f.id WHERE r.ticket_id = ? "
        "AND f.id = ? AND f.removed_at IS NULL", (ticket_id, file_id)).fetchone())


def drop_orphan_vendor_files(conn: sqlite3.Connection) -> int:
    """The janitor: a vendor file no request and no work order names any more (the file on disk goes with the orphan sweeps)."""
    return conn.execute("DELETE FROM ticket_rfq_vendor_files WHERE rfq_id IS NULL AND id NOT IN (SELECT file_id FROM "
                        "ticket_rfq_vendor_file_refs)").rowcount
