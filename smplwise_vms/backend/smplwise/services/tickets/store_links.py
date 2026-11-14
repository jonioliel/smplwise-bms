"""CR-038 slice 4: the SQL of the contact directory and of the handler links (migration 0080) - the second file of the module's
storage layer (store.py keeps the core tables of 0079; a later move to another file or engine touches these two modules only).

Nothing here decides who may do what: services/tickets/contacts.py, handler_links.py and public_store.py call these functions after
their own checks. Secrets never reach this module in clear: a link row keeps `token_hash` (sha256 of the derived token), a code
`code_hash` (HMAC under the link's key), a session / redeem id their sha256; a contact keeps its phone in `phone_e164` and the
keyed match index `phone_key` (+ the id of the key that made it).

The public lookup (`link_by_token_hash`) is ONE statement driven by the unique index on `ticket_links.token_hash` - whatever state
the link is in, the same plan runs (code review W1); the caller folds revocation, grace and expiry into a LinkRecord."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Iterable, Mapping

from ...db import new_id, now_iso


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _in(values: Iterable[str]) -> tuple[str, list[str]]:
    vals = list(dict.fromkeys(values))
    return ", ".join("?" * len(vals)), vals


# ---------------------------------------------------------------- contacts

CONTACT_FIELDS = ("kind", "vendor_id", "user_id", "display_name", "company", "phone_e164", "phone_key", "phone_key_id", "email",
                  "preferred_channel", "require_code", "share_history", "lang", "notes", "active",
                  "cost_claim", "vat_exempt", "vat_default", "labor_rate_minor", "rate_currency",  # + S9 (0083)
                  "employee",  # + 0084: an employee without an account (API kind "employee" = kind 'person' with employee = 1)
                  "notify_whatsapp",  # + TKSTAFF1 (0087): a user's own "WhatsApp for my assignments" switch on their directory row
                  "phone_confirmed_at",  # + TKSTAFF1 (0087, review F3): the user confirmed this number; cleared on every change
                  "phone_verify", "phone_confirmed_via",  # + TKNOTIFOTP (0091): the row's "verify with a code" switch; how it was confirmed
                  "created_department_id",  # + CR-DEPT-MANAGER-HANDLERS (0111): the department a manager created the row in
                  "permanent_vendor")  # + VENDMARK-295 (0141): 1 = a permanent vendor / technician, 0 = temporary (display and filter only)


def insert_contact(conn: sqlite3.Connection, fields: Mapping[str, Any], created_by: str) -> str:
    cid = new_id()
    now = now_iso()
    cols = [k for k in CONTACT_FIELDS if k in fields]
    conn.execute(
        f"INSERT INTO ticket_contacts(id, {', '.join(cols)}, created_by, created_at, updated_at, revision) "
        f"VALUES (?, {', '.join('?' * len(cols))}, ?, ?, ?, 1)",
        (cid, *[fields[k] for k in cols], created_by, now, now),
    )
    return cid


def contact(conn: sqlite3.Connection, contact_id: str | None) -> dict[str, Any] | None:
    """A directory row in any state (erased rows are tombstones and stay)."""
    if not contact_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_contacts WHERE id = ?", (contact_id,)).fetchone())


def contacts(conn: sqlite3.Connection, *, query: str = "", kind: str | None = None, include_inactive: bool = True,
             include_erased: bool = False, limit: int = 500) -> list[dict[str, Any]]:
    # EXTERNALBUILD-297 (CR-VISITOR105 D2): a visitor a host invited lives only in the visitor screens, never in the tickets directory
    where: list[str] = ["NOT EXISTS (SELECT 1 FROM access_visitor_invites vi WHERE vi.visitor_contact_id = ticket_contacts.id)"]
    args: list[Any] = []
    if not include_erased:
        where.append("erased_at IS NULL")
    if not include_inactive:
        where.append("active = 1")
    if kind == "employee":  # 0084: the API kind of an employee without an account
        where.append("kind = 'person' AND employee = 1")
    elif kind == "person":
        where.append("kind = 'person' AND employee = 0")
    elif kind:
        where.append("kind = ?")
        args.append(kind)
    q = (query or "").strip()
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append("(display_name LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')")
        args.extend([like, like])
    sql = "SELECT * FROM ticket_contacts" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY kind DESC, display_name LIMIT ?"
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def vendors_by_phone(conn: sqlite3.Connection, digits: str, limit: int = 5) -> list[dict[str, Any]]:
    """CR-DEPT-MANAGER-HANDLERS: the live vendor rows whose number is EXACTLY these E.164 digits (no prefix / LIKE match - no
    enumeration), never a row that names a user."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_contacts WHERE phone_e164 = ? AND kind = 'vendor' AND erased_at IS NULL AND user_id IS NULL "
        "ORDER BY created_at, id LIMIT ?", (digits, int(limit))).fetchall()]


def contact_by_user(conn: sqlite3.Connection, user_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_contacts WHERE user_id = ? AND erased_at IS NULL", (user_id,)).fetchone())


def update_contact(conn: sqlite3.Connection, contact_id: str, fields: Mapping[str, Any], expect_revision: int | None) -> bool:
    cols = [k for k in CONTACT_FIELDS if k in fields]
    sets = ", ".join(f"{k} = ?" for k in cols)
    sql = f"UPDATE ticket_contacts SET {sets + ', ' if sets else ''}revision = revision + 1, updated_at = ? WHERE id = ? AND erased_at IS NULL"
    args: list[Any] = [*[fields[k] for k in cols], now_iso(), contact_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(expect_revision)
    return conn.execute(sql, args).rowcount == 1


def touch_contact_assigned(conn: sqlite3.Connection, contact_id: str, at: str) -> None:
    conn.execute("UPDATE ticket_contacts SET last_assigned_at = ? WHERE id = ?", (at, contact_id))


def erase_contact(conn: sqlite3.Connection, contact_id: str, tombstone: str) -> None:
    """Personal data removed (section 15.2): name -> the tombstone, phone, its keyed index, e-mail and notes cleared, the row
    stays (assignments and links reference it)."""
    now = now_iso()
    conn.execute(
        "UPDATE ticket_contacts SET display_name = ?, company = '', phone_e164 = NULL, phone_key = NULL, phone_key_id = NULL, "
        "email = NULL, notes = '', user_id = NULL, phone_confirmed_at = NULL, phone_confirmed_via = NULL, permanent_vendor = 0, active = 0, erased_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?",
        (tombstone, now, now, contact_id),
    )


def persons_of(conn: sqlite3.Connection, vendor_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_contacts WHERE vendor_id = ? AND erased_at IS NULL ORDER BY display_name", (vendor_id,)).fetchall()]


def contact_departments(conn: sqlite3.Connection, contact_id: str) -> list[str]:
    return [r[0] for r in conn.execute(
        "SELECT department_id FROM ticket_contact_departments WHERE contact_id = ? ORDER BY department_id", (contact_id,)).fetchall()]


def departments_map(conn: sqlite3.Connection, contact_ids: list[str]) -> dict[str, list[str]]:
    if not contact_ids:
        return {}
    marks, vals = _in(contact_ids)
    out: dict[str, list[str]] = {}
    for r in conn.execute(f"SELECT contact_id, department_id FROM ticket_contact_departments WHERE contact_id IN ({marks})", vals).fetchall():
        out.setdefault(r[0], []).append(r[1])
    return out


def set_contact_departments(conn: sqlite3.Connection, contact_id: str, department_ids: Iterable[str]) -> None:
    conn.execute("DELETE FROM ticket_contact_departments WHERE contact_id = ?", (contact_id,))
    for dept_id in dict.fromkeys(department_ids):
        conn.execute("INSERT INTO ticket_contact_departments(contact_id, department_id) VALUES (?, ?)", (contact_id, dept_id))


def open_ticket_counts(conn: sqlite3.Connection, contact_ids: list[str]) -> dict[str, int]:
    """Open tickets each contact currently holds (an active assignment)."""
    if not contact_ids:
        return {}
    marks, vals = _in(contact_ids)
    return {r[0]: int(r[1]) for r in conn.execute(
        f"SELECT a.contact_id, COUNT(*) FROM ticket_assignments a JOIN tickets t ON t.current_assignment_id = a.id "
        f"WHERE a.contact_id IN ({marks}) AND a.ended_at IS NULL AND t.status NOT IN ('closed', 'cancelled') GROUP BY a.contact_id", vals).fetchall()}


def rewrite_contact_names(conn: sqlite3.Connection, contact_id: str, tombstone: str) -> None:
    """"מחק גם מההיסטוריה" (section 15.2): the frozen names of the person on assignments and timeline rows become the tombstone."""
    conn.execute("UPDATE ticket_assignments SET assignee_name = ? WHERE contact_id = ?", (tombstone, contact_id))
    conn.execute("UPDATE ticket_events SET actor_name = ? WHERE actor_contact_id = ?", (tombstone, contact_id))
    # HARDEN271 (vendor-upload review F5): the person's name on the RFQ timeline rows of his vendor rows (every vendor event, the two
    # vendor-file kinds included) and the names he typed for his own files (which may carry his name) - the files' bytes stay, they are
    # the quote's record; the name becomes the neutral `file.<ext>` of what the content is
    rows = "SELECT id FROM ticket_rfq_vendors WHERE contact_id = ?"
    conn.execute(f"UPDATE ticket_rfq_events SET actor_name = ? WHERE actor_kind = 'contact' AND rfq_vendor_id IN ({rows})", (tombstone, contact_id))
    conn.execute(f"UPDATE ticket_rfq_vendor_files SET name = 'file.' || CASE kind WHEN 'image' THEN 'jpg' ELSE kind END WHERE rfq_vendor_id IN ({rows})",
                 (contact_id,))


def phone_keyed_contacts(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every live contact with a phone (a module-key rotation re-derives their `phone_key`)."""
    return [dict(r) for r in conn.execute(
        "SELECT id, phone_e164, phone_key_id FROM ticket_contacts WHERE phone_e164 IS NOT NULL AND erased_at IS NULL").fetchall()]


def set_phone_key(conn: sqlite3.Connection, contact_id: str, phone_key: str | None, key_id: str | None) -> None:
    conn.execute("UPDATE ticket_contacts SET phone_key = ?, phone_key_id = ? WHERE id = ?", (phone_key, key_id, contact_id))


def contact_events(conn: sqlite3.Connection, contact_id: str) -> list[dict[str, Any]]:
    """The timeline rows a person authored through their links (the export of section 15.2)."""
    return [dict(r) for r in conn.execute(
        "SELECT e.*, t.number FROM ticket_events e JOIN tickets t ON t.id = e.ticket_id WHERE e.actor_contact_id = ? ORDER BY e.at, e.id",
        (contact_id,)).fetchall()]


def contact_assignments(conn: sqlite3.Connection, contact_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT a.*, t.number FROM ticket_assignments a JOIN tickets t ON t.id = a.ticket_id WHERE a.contact_id = ? ORDER BY a.assigned_at",
        (contact_id,)).fetchall()]


# ---------------------------------------------------------------- links

LINK_COLUMNS = ("id", "ticket_id", "assignment_id", "contact_id", "generation", "key_id", "token_hash", "require_code", "sent_via",
                "sent_at", "created_at", "generation_at", "expires_at", "cap_at", "grace_until", "revoked_at", "revoked_reason",
                "first_opened_at", "last_opened_at", "open_count", "update_count", "kind")

# ONE statement for the public lookup (W1): the unique index on token_hash drives it; the joins are primary-key lookups that
# fold in the facts the listener needs - is the assignment still current, the ticket's number and status, the contact's phone key.
LOOKUP_SQL = (
    "SELECT l.id, l.ticket_id, l.assignment_id, l.contact_id, l.generation, l.key_id, l.require_code, l.sent_via, l.expires_at, l.kind, "
    "l.cap_at, l.grace_until, l.revoked_at, a.ended_at AS asg_ended_at, a.end_reason AS asg_end_reason, "
    "t.current_assignment_id AS t_current, t.status AS t_status, t.number AS t_number, c.phone_key AS c_phone_key, "
    "c.kind AS c_kind, c.employee AS c_employee, c.user_id AS c_user_id, c.vendor_id AS c_vendor_id "
    "FROM ticket_links l JOIN tickets t ON t.id = l.ticket_id JOIN ticket_assignments a ON a.id = l.assignment_id "
    "LEFT JOIN ticket_contacts c ON c.id = l.contact_id "
)


def link_by_token_hash(conn: sqlite3.Connection, token_hash: str) -> dict[str, Any] | None:
    return _dict(conn.execute(LOOKUP_SQL + "WHERE l.token_hash = ?", (token_hash,)).fetchone())


def link_by_id_joined(conn: sqlite3.Connection, link_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute(LOOKUP_SQL + "WHERE l.id = ?", (link_id,)).fetchone())


def insert_link(conn: sqlite3.Connection, row: Mapping[str, Any]) -> None:
    cols = [k for k in LINK_COLUMNS if k in row]
    conn.execute(f"INSERT INTO ticket_links({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def link(conn: sqlite3.Connection, link_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_links WHERE id = ?", (link_id,)).fetchone())


def link_for_assignment(conn: sqlite3.Connection, assignment_id: str | None) -> dict[str, Any] | None:
    if not assignment_id:
        return None
    return _dict(conn.execute("SELECT * FROM ticket_links WHERE assignment_id = ?", (assignment_id,)).fetchone())


def links_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_links WHERE ticket_id = ? ORDER BY created_at, id", (ticket_id,)).fetchall()]


def latest_link_of_ticket(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_links WHERE ticket_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1", (ticket_id,)).fetchone())


def live_links_of_contact(conn: sqlite3.Connection, contact_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_links WHERE contact_id = ? AND revoked_at IS NULL ORDER BY created_at", (contact_id,)).fetchall()]


def live_staff_links(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """TKSTAFF1 (R7): every live staff link with the user of its assignment and the ticket's department (the recheck)."""
    return [dict(r) for r in conn.execute(
        "SELECT l.*, a.user_id AS asg_user_id, a.ended_at AS asg_ended_at, t.department_id, t.status AS t_status FROM ticket_links l "
        "JOIN ticket_assignments a ON a.id = l.assignment_id JOIN tickets t ON t.id = l.ticket_id "
        "WHERE l.kind = 'staff' AND l.revoked_at IS NULL").fetchall()]


def cancel_open_messages(conn: sqlite3.Connection, link_id: str, at: str, *, keep: Iterable[str] = ()) -> int:
    """TKSTAFF1 (R7, spec 9.2 "a revoked link cancels its queued rows"): the queued / held outbox rows of a link become `cancelled`
    (outcome `link_revoked`) in the caller's transaction - a message queued before a phone change or a new generation never leaves
    with a dead (or another generation's) link. Rows in flight or final are never touched; purposes in `keep` (the notices that
    TELL the holder their link ended) stay. A compare-and-set on the state, like the outbox store's own save."""
    kept = list(keep)
    marks = ", ".join("?" * len(kept))
    sql = ("UPDATE ticket_outbox SET state = 'cancelled', outcome_code = 'link_revoked', held_reason = NULL, updated_at = ? "
           "WHERE link_id = ? AND state IN ('queued', 'held')")
    if kept:
        sql += f" AND purpose NOT IN ({marks})"
    return conn.execute(sql, (at, link_id, *kept)).rowcount


def live_links(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM ticket_links WHERE revoked_at IS NULL").fetchall()]


def live_links_with_department(conn: sqlite3.Connection, department_id: str | None = None, *, kind: str | None = None) -> list[dict[str, Any]]:
    """Live links with their ticket's department (a cap change pulls them in); one department, or every one; one kind (TKSTAFF1:
    'external' | 'staff') or both."""
    sql = ("SELECT l.id, l.created_at, l.generation_at, l.cap_at, l.kind, t.department_id FROM ticket_links l JOIN tickets t ON t.id = l.ticket_id "
           "WHERE l.revoked_at IS NULL")
    args: list[Any] = []
    if kind is not None:
        sql += " AND l.kind = ?"
        args.append(kind)
    if department_id is not None:
        sql += " AND t.department_id = ?"
        args.append(department_id)
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def mark_sent(conn: sqlite3.Connection, link_id: str, via: str, at: str) -> None:
    """The first send time of the current generation stays; 'email' is sticky (handler_links.mark_sent)."""
    conn.execute(
        "UPDATE ticket_links SET sent_via = CASE WHEN sent_via = 'email' THEN 'email' ELSE ? END, sent_at = COALESCE(sent_at, ?) WHERE id = ?",
        (via, at, link_id))


def any_link(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM ticket_links LIMIT 1").fetchone() is not None


def any_keyed_row(conn: sqlite3.Connection) -> bool:
    """A row that depends on the module key exists (a link, or a contact's phone key): a missing key is then a lost file or a
    restore without secrets/, never a reason to mint a new key (code review W12 / V4)."""
    if any_link(conn):
        return True
    if _has_rfq_links(conn) and conn.execute("SELECT 1 FROM ticket_rfq_links LIMIT 1").fetchone() is not None:  # TKRFQ1 (0089)
        return True
    if (conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'intercom_consent_requests'").fetchone() is not None
            and conn.execute("SELECT 1 FROM intercom_consent_requests WHERE state IN ('sending', 'open') LIMIT 1").fetchone() is not None):
        return True  # WA-CONSENT-LINK (0113): a live consent link depends on the key too
    if (conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'outbound_documents'").fetchone() is not None
            and conn.execute("SELECT 1 FROM outbound_documents WHERE purged_at IS NULL AND revoked_at IS NULL LIMIT 1").fetchone() is not None):
        return True  # CR-VENDORQ-294 (0128): a live document link depends on the key too
    return conn.execute("SELECT 1 FROM ticket_contacts WHERE phone_key IS NOT NULL LIMIT 1").fetchone() is not None


def _has_rfq_links(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ticket_rfq_links'").fetchone() is not None


def key_ids_in_use(conn: sqlite3.Connection) -> set[str]:
    """The module keys a row still NEEDS: live links (a revoked link never derives its token again) and contacts' phone keys."""
    ids = {r[0] for r in conn.execute("SELECT DISTINCT key_id FROM ticket_links WHERE revoked_at IS NULL").fetchall() if r[0]}
    if _has_rfq_links(conn):  # TKRFQ1: the live RFQ vendor links need their key too
        ids |= {r[0] for r in conn.execute("SELECT DISTINCT key_id FROM ticket_rfq_links WHERE revoked_at IS NULL").fetchall() if r[0]}
    ids |= {r[0] for r in conn.execute("SELECT DISTINCT phone_key_id FROM ticket_contacts WHERE phone_key_id IS NOT NULL").fetchall() if r[0]}
    # VPORTAL 2.6.4 review F4: a live portal sign-in code and a live portal session still need the key they were issued under (a
    # key retirement right after a rotation must never kill a vendor's sign-in in the middle silently); TKNOTIFOTP's live number
    # verification codes likewise. Ended rows (spent / ended / revoked) need nothing; the janitor prunes them.
    for table, live in (("ticket_portal_codes", "consumed_at IS NULL AND invalidated_at IS NULL"),
                        ("ticket_portal_sessions", "revoked_at IS NULL"),
                        ("ticket_phone_verifications", "consumed_at IS NULL AND invalidated_at IS NULL"),
                        # WA-CONSENT-LINK (0113): a consent link that can still be answered derives its token under its key
                        ("intercom_consent_requests", "state IN ('sending', 'open')"),
                        # CR-VENDORQ-294 (0128): a document link that can still be downloaded derives its token under its key
                        ("outbound_documents", "purged_at IS NULL AND revoked_at IS NULL")):
        if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone() is None:
            continue  # a database before the table's migration
        ids |= {r[0] for r in conn.execute(f"SELECT DISTINCT key_id FROM {table} WHERE {live}").fetchall() if r[0]}  # noqa: S608 - fixed names
    return ids


def update_link(conn: sqlite3.Connection, link_id: str, fields: Mapping[str, Any]) -> None:
    cols = [k for k in fields if k in LINK_COLUMNS and k != "id"]
    if cols:
        conn.execute(f"UPDATE ticket_links SET {', '.join(f'{c} = ?' for c in cols)} WHERE id = ?", (*[fields[c] for c in cols], link_id))


def revoke_link(conn: sqlite3.Connection, link_id: str, reason: str, at: str) -> bool:
    """Revoked at once (no grace); True when this call revoked it (a revoked link stays revoked with its first reason)."""
    return conn.execute("UPDATE ticket_links SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL",
                        (at, reason, link_id)).rowcount == 1


def extend_link(conn: sqlite3.Connection, link_id: str, candidate_expiry: str) -> None:
    """The sliding expiry moves forward only, never past the cap (spec 10.2). ISO text compares in time order (same format)."""
    conn.execute(
        "UPDATE ticket_links SET expires_at = MIN(cap_at, MAX(expires_at, ?)) WHERE id = ? AND revoked_at IS NULL",
        (candidate_expiry, link_id),
    )


def note_update(conn: sqlite3.Connection, link_id: str) -> None:
    conn.execute("UPDATE ticket_links SET update_count = update_count + 1 WHERE id = ?", (link_id,))


def note_open(conn: sqlite3.Connection, link_id: str, at: str, generation: int | None = None) -> bool | None:
    """An open of the page with the token (GET /t/api/ticket); True for the first one (the timeline's "הקישור נפתח" line).
    `generation` (TK251 review R2 A-5): the generation the request authenticated with - an open that commits after a "new link"
    must not stamp the NEW generation; None is returned when the link is no longer at that generation (nothing written)."""
    gen = "" if generation is None else " AND generation = ?"
    args: tuple = () if generation is None else (int(generation),)
    if conn.execute(f"UPDATE ticket_links SET last_opened_at = ?, open_count = open_count + 1 WHERE id = ?{gen}", (at, link_id, *args)).rowcount != 1:
        return None
    return conn.execute(f"UPDATE ticket_links SET first_opened_at = ? WHERE id = ? AND first_opened_at IS NULL{gen}",
                        (at, link_id, *args)).rowcount == 1


def resolve_within_min(conn: sqlite3.Connection, department_id: str, priority_id: str) -> int | None:
    row = conn.execute("SELECT resolve_within_min FROM ticket_sla_rules WHERE department_id = ? AND priority_id = ?",
                       (department_id, priority_id)).fetchone()
    return row["resolve_within_min"] if row else None


def pull_in_caps(conn: sqlite3.Connection, caps_by_link: Mapping[str, str]) -> int:
    """A LOWER cap setting pulls the cap (and the expiry) of live links in at once: {link id: candidate cap ISO}; a candidate
    later than the link's cap changes nothing. Returns the links whose cap moved."""
    n = 0
    for link_id, cap in caps_by_link.items():
        n += conn.execute(
            "UPDATE ticket_links SET cap_at = ?, expires_at = MIN(expires_at, ?) WHERE id = ? AND revoked_at IS NULL AND cap_at > ?",
            (cap, cap, link_id, cap)).rowcount
    return n


# ---------------------------------------------------------------- the access log ("opened", distinct devices)


def insert_access(conn: sqlite3.Connection, link_id: str, at: str, kind: str, client_key: str) -> None:
    conn.execute("INSERT INTO ticket_link_access(link_id, at, kind, client_key) VALUES (?, ?, ?, ?)", (link_id, at, kind, client_key))


def recent_access(conn: sqlite3.Connection, link_id: str, kind: str, client_key: str, since: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM ticket_link_access WHERE link_id = ? AND kind = ? AND client_key = ? AND at >= ? LIMIT 1",
        (link_id, kind, client_key, since)).fetchone() is not None


def access_devices(conn: sqlite3.Connection, link_id: str, *, since: str | None = None) -> int:
    """Distinct devices that used the link (`since`: from that instant on - the current generation's, TK251)."""
    if since:
        return int(conn.execute("SELECT COUNT(DISTINCT client_key) FROM ticket_link_access WHERE link_id = ? AND at >= ?",
                                (link_id, since)).fetchone()[0])
    return int(conn.execute("SELECT COUNT(DISTINCT client_key) FROM ticket_link_access WHERE link_id = ?", (link_id,)).fetchone()[0])


def access_counts(conn: sqlite3.Connection, link_id: str) -> dict[str, int]:
    return {r[0]: int(r[1]) for r in conn.execute(
        "SELECT kind, COUNT(*) FROM ticket_link_access WHERE link_id = ? GROUP BY kind", (link_id,)).fetchall()}


# ---------------------------------------------------------------- verification codes, code sessions, wrong-code windows


def latest_code(conn: sqlite3.Connection, link_id: str, generation: int) -> dict[str, Any] | None:
    return _dict(conn.execute(
        "SELECT * FROM ticket_link_codes WHERE link_id = ? AND generation = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (link_id, generation)).fetchone())


def code_times_since(conn: sqlite3.Connection, link_id: str, generation: int, since: str) -> list[str]:
    return [r[0] for r in conn.execute(
        "SELECT created_at FROM ticket_link_codes WHERE link_id = ? AND generation = ? AND created_at >= ? ORDER BY created_at",
        (link_id, generation, since)).fetchall()]


def replace_code(conn: sqlite3.Connection, row: Mapping[str, Any], now: str) -> None:
    """One transaction (W7): every older unconsumed live code of the LINK (any generation) stops at `now`, then the new row."""
    conn.execute("UPDATE ticket_link_codes SET expires_at = ? WHERE link_id = ? AND consumed_at IS NULL AND expires_at > ?",
                 (now, row["link_id"], now))
    conn.execute(
        "INSERT INTO ticket_link_codes(id, link_id, generation, code_hash, channel, created_at, expires_at, attempts, consumed_at, outbox_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        (row["id"], row["link_id"], row["generation"], row["code_hash"], row["channel"], row["created_at"], row["expires_at"],
         int(row.get("attempts") or 0), row.get("consumed_at")),
    )


def expire_code(conn: sqlite3.Connection, code_id: str, now: str) -> None:
    conn.execute("UPDATE ticket_link_codes SET expires_at = MIN(expires_at, ?) WHERE id = ?", (now, code_id))


def add_attempt(conn: sqlite3.Connection, code_id: str) -> int:
    conn.execute("UPDATE ticket_link_codes SET attempts = attempts + 1 WHERE id = ?", (code_id,))
    row = conn.execute("SELECT attempts FROM ticket_link_codes WHERE id = ?", (code_id,)).fetchone()
    return int(row[0]) if row else 0


def expire_link_codes(conn: sqlite3.Connection, link_id: str, now: str) -> None:
    """Every still-live code of the link ends now (the manager's new link)."""
    conn.execute("UPDATE ticket_link_codes SET expires_at = ? WHERE link_id = ? AND consumed_at IS NULL AND expires_at > ?", (now, link_id, now))


def consume_code(conn: sqlite3.Connection, code_id: str, now: str) -> bool:
    """Compare-and-set (W7): only the first caller gets True."""
    return conn.execute("UPDATE ticket_link_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL", (now, code_id)).rowcount == 1


def set_code_outbox(conn: sqlite3.Connection, code_id: str, outbox_id: str) -> None:
    conn.execute("UPDATE ticket_link_codes SET outbox_id = ? WHERE id = ?", (outbox_id, code_id))


def failures(conn: sqlite3.Connection, link_id: str, generation: int) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_link_failures WHERE link_id = ? AND generation = ?", (link_id, generation)).fetchone())


def put_failures(conn: sqlite3.Connection, link_id: str, generation: int, window_start: str, n: int, locked_until: str | None) -> None:
    conn.execute(
        "INSERT INTO ticket_link_failures(link_id, generation, window_start, failures, locked_until) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(link_id, generation) DO UPDATE SET window_start = excluded.window_start, failures = excluded.failures, "
        "locked_until = excluded.locked_until",
        (link_id, generation, window_start, n, locked_until),
    )


def clear_failures(conn: sqlite3.Connection, link_id: str, generation: int) -> None:
    conn.execute("DELETE FROM ticket_link_failures WHERE link_id = ? AND generation = ?", (link_id, generation))


def locked_links(conn: sqlite3.Connection, link_ids: list[str], now: str) -> set[str]:
    if not link_ids:
        return set()
    marks, vals = _in(link_ids)
    return {r[0] for r in conn.execute(
        f"SELECT f.link_id FROM ticket_link_failures f JOIN ticket_links l ON l.id = f.link_id AND l.generation = f.generation "
        f"WHERE f.link_id IN ({marks}) AND f.locked_until > ?", [*vals, now]).fetchall()}


def put_session(conn: sqlite3.Connection, id_hash: str, link_id: str, generation: int, created_at: str, expires_at: str) -> None:
    conn.execute("INSERT OR REPLACE INTO ticket_link_sessions(id_hash, link_id, generation, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
                 (id_hash, link_id, generation, created_at, expires_at))


def session(conn: sqlite3.Connection, id_hash: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_link_sessions WHERE id_hash = ?", (id_hash,)).fetchone())


def drop_sessions(conn: sqlite3.Connection, link_id: str) -> None:
    conn.execute("DELETE FROM ticket_link_sessions WHERE link_id = ?", (link_id,))


# ---------------------------------------------------------------- e-mail redeem ids


def insert_redeem(conn: sqlite3.Connection, id_hash: str, link_id: str, generation: int, created_at: str, expires_at: str) -> None:
    conn.execute("INSERT INTO ticket_link_redeems(id_hash, link_id, generation, created_at, expires_at, uses) VALUES (?, ?, ?, ?, ?, 0)",
                 (id_hash, link_id, generation, created_at, expires_at))


def release_redeem(conn: sqlite3.Connection, id_hash: str, now: str, max_uses: int) -> tuple[str, int] | None:
    """ONE statement (W4): check and increment together - two concurrent presses can never both pass the last use."""
    row = conn.execute(
        "UPDATE ticket_link_redeems SET uses = uses + 1 WHERE id_hash = ? AND expires_at > ? AND uses < ? RETURNING link_id, generation",
        (id_hash, now, int(max_uses))).fetchone()
    return (row[0], int(row[1])) if row else None


# ---------------------------------------------------------------- idempotency rows of the public writes (`ticket_requests`)


def request_row(conn: sqlite3.Connection, scope: str, client_request_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_requests WHERE scope = ? AND client_request_id = ?", (scope, client_request_id)).fetchone())


def insert_request(conn: sqlite3.Connection, scope: str, client_request_id: str, route: str, status_code: int, response: Any, at: str) -> bool:
    """False when a row already exists (another request won); never a second row."""
    return conn.execute(
        "INSERT OR IGNORE INTO ticket_requests(scope, client_request_id, route, status_code, response_json, at) VALUES (?, ?, ?, ?, ?, ?)",
        (scope, client_request_id, route, int(status_code), json.dumps(response, ensure_ascii=False, separators=(",", ":")), at),
    ).rowcount == 1


def claim_request(conn: sqlite3.Connection, scope: str, client_request_id: str, route: str, at: str) -> bool:
    """Reserve (scope, id) INSIDE the effect's transaction before the effect is written: a second writer of the same id - in
    this process or another - fails here and its transaction rolls back (no second effect). The answer is filled in by
    `finish_request` in the same transaction."""
    return conn.execute(
        "INSERT OR IGNORE INTO ticket_requests(scope, client_request_id, route, status_code, response_json, at) VALUES (?, ?, ?, 0, '{}', ?)",
        (scope, client_request_id, route, at)).rowcount == 1


def finish_request(conn: sqlite3.Connection, scope: str, client_request_id: str, status_code: int, response: Any) -> None:
    conn.execute("UPDATE ticket_requests SET status_code = ?, response_json = ? WHERE scope = ? AND client_request_id = ?",
                 (int(status_code), json.dumps(response, ensure_ascii=False, separators=(",", ":")), scope, client_request_id))


# ---------------------------------------------------------------- what the handler page shows (authorised by the LINK, not a person)


def ticket_of_link(conn: sqlite3.Connection, link_id: str) -> dict[str, Any] | None:
    """The ticket a handler link belongs to - reachable only through a link id (the token is the authorisation on the public
    side; no person's visibility applies). Internal routes read tickets through access.py only."""
    return _dict(conn.execute("SELECT t.* FROM tickets t JOIN ticket_links l ON l.ticket_id = t.id WHERE l.id = ?", (link_id,)).fetchone())


def insert_contact_event(conn: sqlite3.Connection, ticket_id: str, kind: str, *, contact_id: str, actor_name: str, assignment_id: str,
                         at: str, from_status: str | None = None, to_status: str | None = None, body: str | None = None,
                         data: Mapping[str, Any] | None = None, visible_external: bool = True) -> int:
    """A timeline row written by the external handler through the link (`actor_kind = 'contact'`, `via = 'link'`)."""
    cur = conn.execute(
        "INSERT INTO ticket_events(ticket_id, at, kind, actor_kind, actor_user_id, actor_contact_id, actor_name, assignment_id, from_status, "
        "to_status, body, data_json, via, visible_external) VALUES (?, ?, ?, 'contact', NULL, ?, ?, ?, ?, ?, ?, ?, 'link', ?)",
        (ticket_id, at, kind, contact_id, actor_name, assignment_id, from_status, to_status, body,
         json.dumps(dict(data or {}), ensure_ascii=False, separators=(",", ":")), 1 if visible_external else 0),
    )
    return int(cur.lastrowid)


def handler_events(conn: sqlite3.Connection, ticket_id: str, contact_id: str, since: str) -> list[dict[str, Any]]:
    """The timeline rows the handler of `contact_id` may see (spec 10.3): their OWN rows written through a link, and the rows
    of the organisation marked for the handler (`visible_external = 1`) written since this contact was first assigned the
    ticket - never another contact's rows, never an internal row."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_events WHERE ticket_id = ? AND visible_external = 1 AND ("
        "(actor_kind = 'contact' AND actor_contact_id = ?) OR (actor_kind = 'user' AND at >= ? AND kind IN ('note', 'photo')))"
        " ORDER BY id", (ticket_id, contact_id, since)).fetchall()]


def first_assigned_at(conn: sqlite3.Connection, ticket_id: str, contact_id: str) -> str | None:
    row = conn.execute("SELECT MIN(assigned_at) FROM ticket_assignments WHERE ticket_id = ? AND contact_id = ?", (ticket_id, contact_id)).fetchone()
    return row[0] if row and row[0] else None


def handler_attachments(conn: sqlite3.Connection, ticket_id: str, contact_id: str, since: str) -> list[dict[str, Any]]:
    """The photos the handler may see: their own uploads, and the organisation's photos marked for the handler since this
    contact was first assigned (review T15)."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_attachments WHERE ticket_id = ? AND deleted_at IS NULL AND visible_external = 1 AND ("
        "(uploaded_by_kind = 'contact' AND uploaded_by = ?) OR (uploaded_by_kind = 'user' AND created_at >= ?)) ORDER BY created_at, id",
        (ticket_id, contact_id, since)).fetchall()]


def handler_attachment(conn: sqlite3.Connection, ticket_id: str, attachment_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute(
        "SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL AND visible_external = 1",
        (attachment_id, ticket_id)).fetchone())


def photo_counts(conn: sqlite3.Connection, ticket_id: str, assignment_id: str) -> tuple[int, int]:
    """(photos uploaded through this assignment, photos of the ticket from every source) - deleted ones count too: a quota is
    spent by an upload, not given back by a removal."""
    a = conn.execute(
        "SELECT COUNT(*) FROM ticket_attachments a JOIN ticket_events e ON e.id = a.event_id WHERE a.ticket_id = ? AND e.assignment_id = ? "
        "AND a.uploaded_by_kind = 'contact'", (ticket_id, assignment_id)).fetchone()[0]
    t = conn.execute("SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = ? AND deleted_at IS NULL", (ticket_id,)).fetchone()[0]
    return int(a), int(t)


def device_context(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    return _dict(conn.execute("SELECT * FROM ticket_device_context WHERE ticket_id = ?", (ticket_id,)).fetchone())


# ---------------------------------------------------------------- retention (section 15.1)


def prune(conn: sqlite3.Connection, *, codes_before: str, access_before: str) -> int:
    """Codes, code sessions and redeem ids one day after their expiry; access rows after 90 days (the caller passes the cut-offs)."""
    n = conn.execute("DELETE FROM ticket_link_codes WHERE expires_at < ?", (codes_before,)).rowcount
    n += conn.execute("DELETE FROM ticket_link_sessions WHERE expires_at < ?", (codes_before,)).rowcount
    n += conn.execute("DELETE FROM ticket_link_redeems WHERE expires_at < ?", (codes_before,)).rowcount
    n += conn.execute("DELETE FROM ticket_link_failures WHERE (locked_until IS NULL OR locked_until < ?) AND window_start < ?",
                      (codes_before, codes_before)).rowcount
    n += conn.execute("DELETE FROM ticket_link_access WHERE at < ?", (access_before,)).rowcount
    return n


def link_state_counts(conn: sqlite3.Connection, now: str) -> dict[str, int]:
    """Health (spec 17): links live / in grace / expired / revoked / locked."""
    out = {"live": 0, "grace": 0, "expired": 0, "revoked": 0}
    for r in conn.execute("SELECT expires_at, cap_at, grace_until, revoked_at FROM ticket_links").fetchall():
        if r["revoked_at"]:
            out["revoked"] += 1
        elif min(r["expires_at"], r["cap_at"]) <= now:
            out["expired"] += 1
        elif r["grace_until"]:
            out["grace"] += 1 if r["grace_until"] > now else 0
            out["expired"] += 0 if r["grace_until"] > now else 1
        else:
            out["live"] += 1
    # TKSTAFF1 (security design checklist): the two populations counted apart - live staff links next to the live total
    out["live_staff"] = int(conn.execute(
        "SELECT COUNT(*) FROM ticket_links WHERE kind = 'staff' AND revoked_at IS NULL AND grace_until IS NULL AND MIN(expires_at, cap_at) > ?",
        (now,)).fetchone()[0])
    out["locked"] = int(conn.execute(
        "SELECT COUNT(*) FROM ticket_link_failures f JOIN ticket_links l ON l.id = f.link_id AND l.generation = f.generation "
        "WHERE f.locked_until > ?", (now,)).fetchone()[0])
    return out
