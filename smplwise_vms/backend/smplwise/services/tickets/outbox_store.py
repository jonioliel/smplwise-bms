"""CR-038 slice 5b: the SQLite side of the ticket message channel - `ticket_outbox` and `ticket_inbound` (migration 0081), the
outbox port `OutboxStore` of the message core (services/tickets/outbox.py), the inbound ports (`MatchDirectory`, `DedupeStore`),
the shared send ledger bound to the same transaction, and the queries the routes, the health page and the janitor need.

THE CONNECTION RULE (the reason this module exists in this shape): the product's write gate (db.WriteGate) is one FIFO writer per
database file and it is NOT re-entrant - a thread that holds a write transaction and opens a second write connection waits for
itself. Every outbox write therefore runs on ONE connection that the caller BINDS to the thread (`bound(conn)`):
- a request (an assignment, "send now", "send again") binds its own request connection, so the outbox row, the timeline row and
  the audit row are one transaction (spec 9.2: "if the row cannot be written, nothing is sent");
- the worker binds one write connection per tick and releases it around the provider call (`messaging.DbOutbox`);
- a write without a bound connection raises `Unbound` (a test proves it) - never a silent second connection.
Lock order everywhere: the database write gate FIRST, then the outbox's in-process lock (requests already hold the gate when
they call the outbox; the worker takes the gate before `Outbox.tick` takes its lock). Reads without a binding use a short read
connection (WAL readers never take the gate).

Nothing here stores a phone number, an e-mail address, a link token, a code or a message text: see migration 0081."""
from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import secrets
import sqlite3
import threading
from typing import Any, Iterable, Iterator, Mapping

from .. import messaging_accounts as ma
from .outbox import OutboxError, OutboxRow, can_transition

UTC = dt.timezone.utc
_local = threading.local()


class Unbound(RuntimeError):
    """An outbox / ledger write was attempted without a connection bound to this thread (see the module note)."""


@contextlib.contextmanager
def bound(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Bind `conn` (an open write transaction) to this thread for the outbox ports; nests (the previous binding comes back)."""
    prev = getattr(_local, "conn", None)
    _local.conn = conn
    try:
        yield conn
    finally:
        _local.conn = prev


def current() -> sqlite3.Connection | None:
    return getattr(_local, "conn", None)


def iso(at: dt.datetime) -> str:
    """Outbox times: UTC ISO-8601 with milliseconds and Z (they sort as text)."""
    return at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def iso_s(at: dt.datetime) -> str:
    """Timeline / ticket times: seconds and Z, like db.now_iso()."""
    return at.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse(value: Any) -> dt.datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


class Access:
    """The bound connection, or a short connection of `db` (reads only, unless `write` and a binding exists)."""

    def __init__(self, db: Any | None) -> None:
        self.db = db

    @contextlib.contextmanager
    def read(self, label: str = "tickets.messaging.read") -> Iterator[sqlite3.Connection]:
        conn = current()
        if conn is not None:
            yield conn
            return
        if self.db is None:
            raise Unbound("no connection bound and no database to read from")
        with self.db.connection(mode="read", label=label) as c:
            yield c

    def write(self) -> sqlite3.Connection:
        conn = current()
        if conn is None:
            raise Unbound("an outbox write needs the caller's connection bound to the thread (outbox_store.bound)")
        return conn


# ---------------------------------------------------------------- ticket_outbox <-> OutboxRow

COLUMNS = ("id", "ticket_id", "assignment_id", "link_id", "recipient_kind", "contact_id", "channel", "purpose", "use_key", "department_id",
           "account_key", "template_id", "template_revision", "params_json", "state", "held_reason", "held_since", "attempts",
           "first_attempt_at", "not_before", "priority", "outcome_code", "provider_message_id", "reply_nonce", "fallback_of", "resend_of",
           "code_id", "idempotency_key", "send_now", "requested_by", "created_at", "sent_at", "updated_at")
_TIMES = ("held_since", "first_attempt_at", "not_before", "created_at", "sent_at", "updated_at")


def to_db(row: OutboxRow) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for col in COLUMNS:
        if col == "params_json":
            out[col] = json.dumps(dict(row.params), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        elif col == "send_now":
            out[col] = 1 if row.send_now else 0
        elif col in _TIMES:
            value = getattr(row, col)
            out[col] = iso(value) if value is not None else None
        else:
            out[col] = getattr(row, col)
    return out


def from_db(r: Mapping[str, Any]) -> OutboxRow:
    try:
        params = json.loads(r["params_json"] or "{}")
    except ValueError:
        params = {}
    created = parse(r["created_at"]) or dt.datetime.now(UTC)
    return OutboxRow(
        id=r["id"], purpose=r["purpose"], channel=r["channel"], use_key=r["use_key"], created_at=created,
        not_before=parse(r["not_before"]) or created, recipient_kind=r["recipient_kind"], contact_id=r["contact_id"], ticket_id=r["ticket_id"],
        assignment_id=r["assignment_id"], link_id=r["link_id"], department_id=r["department_id"],
        params=params if isinstance(params, dict) else {}, template_id=r["template_id"], template_revision=r["template_revision"],
        state=r["state"], held_reason=r["held_reason"], held_since=parse(r["held_since"]), attempts=int(r["attempts"] or 0),
        first_attempt_at=parse(r["first_attempt_at"]), priority=int(r["priority"]), outcome_code=r["outcome_code"],
        provider_message_id=r["provider_message_id"], reply_nonce=r["reply_nonce"], fallback_of=r["fallback_of"], resend_of=r["resend_of"],
        requested_by=r["requested_by"], idempotency_key=r["idempotency_key"], send_now=bool(r["send_now"]), code_id=r["code_id"],
        account_key=r["account_key"], sent_at=parse(r["sent_at"]), updated_at=parse(r["updated_at"]))


def _stamp_generation(conn: sqlite3.Connection, row: OutboxRow) -> None:
    """Deep review B3 (migration 0086): `link_generation` = the link's generation now - at enqueue, and
    again at the claim (the worker derives the URL from the link when it sends, in the same transaction). Kept outside
    OutboxRow on purpose: the message core never reads it; only the inbound matcher (`nonce_row`) does."""
    if row.link_id:
        conn.execute("UPDATE ticket_outbox SET link_generation = (SELECT generation FROM ticket_links WHERE id = ?) WHERE id = ?",
                     (row.link_id, row.id))


class SqliteOutboxStore:
    """`outbox.OutboxStore` on `ticket_outbox`. Writes go to the BOUND connection only (module note); `save` is a compare-and-set
    on the state (`UPDATE ... WHERE id = ? AND state = ?`), so a cancel and a claim can never both win."""

    def __init__(self, db: Any | None = None) -> None:
        self._io = Access(db)

    def insert(self, row: OutboxRow) -> None:
        conn = self._io.write()
        data = to_db(row)
        try:
            conn.execute(f"INSERT INTO ticket_outbox({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))})",
                         tuple(data[c] for c in COLUMNS))
        except sqlite3.IntegrityError:
            raise OutboxError("duplicate") from None
        _stamp_generation(conn, row)

    def save(self, row: OutboxRow, *, expect_state: str) -> bool:
        if expect_state != row.state and not can_transition(expect_state, row.state):
            raise OutboxError(f"illegal_transition:{expect_state}->{row.state}")
        conn = self._io.write()
        data = to_db(row)
        cols = [c for c in COLUMNS if c not in ("id", "created_at")]
        cur = conn.execute(f"UPDATE ticket_outbox SET {', '.join(f'{c} = ?' for c in cols)} WHERE id = ? AND state = ?",
                           (*[data[c] for c in cols], row.id, expect_state))
        if cur.rowcount != 1:
            return False
        if row.state == "sending" and expect_state != "sending":
            _stamp_generation(conn, row)  # the claim: the worker just derived the URL from the link's current generation
        return True

    def get(self, row_id: str) -> OutboxRow | None:
        with self._io.read() as conn:
            r = conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (row_id,)).fetchone()
        return from_db(r) if r else None

    def open_rows(self) -> list[OutboxRow]:
        with self._io.read() as conn:
            rows = conn.execute("SELECT * FROM ticket_outbox WHERE state IN ('queued', 'held') "
                                "ORDER BY priority, not_before, created_at, id").fetchall()
        return [from_db(r) for r in rows]

    def in_state(self, state: str) -> list[OutboxRow]:
        with self._io.read() as conn:
            rows = conn.execute("SELECT * FROM ticket_outbox WHERE state = ? ORDER BY created_at, id", (state,)).fetchall()
        return [from_db(r) for r in rows]

    def by_idempotency_key(self, key: str) -> OutboxRow | None:
        with self._io.read() as conn:
            r = conn.execute("SELECT * FROM ticket_outbox WHERE idempotency_key = ?", (key,)).fetchone()
        return from_db(r) if r else None

    def by_nonce(self, nonce: str) -> OutboxRow | None:
        with self._io.read() as conn:
            r = conn.execute("SELECT * FROM ticket_outbox WHERE reply_nonce = ?", (nonce,)).fetchone()
        return from_db(r) if r else None

    def sent_times(self, channel: str, since: dt.datetime) -> list[dt.datetime]:
        with self._io.read() as conn:
            rows = conn.execute(
                "SELECT COALESCE(sent_at, updated_at) AS t FROM ticket_outbox WHERE channel = ? AND state IN ('sent', 'unknown') "
                "AND COALESCE(sent_at, updated_at) > ? ORDER BY t", (channel, iso(since))).fetchall()
        return [t for t in (parse(r[0]) for r in rows) if t is not None]


# ---------------------------------------------------------------- the shared ledger on the bound connection

class BoundSendLedger:
    """`messaging_accounts.SendLedger` (migration 0082) that writes on the BOUND connection: the worker records a send inside its
    own transaction (a second write connection would wait for the gate this very thread holds). Reads use the binding when there is
    one, else a short read connection."""

    def __init__(self, db: Any | None = None) -> None:
        self._io = Access(db)

    def record(self, *, account_key: str, use_key: str, recipient_key: str, kind: str, at: dt.datetime) -> None:
        ma.SqliteSendLedger(self._io.write()).record(account_key=account_key, use_key=use_key, recipient_key=recipient_key, kind=kind, at=at)

    def times(self, *, since: dt.datetime, account_key: str | None = None, recipient_key: str | None = None,
              kinds: Iterable[str] | None = None) -> list[dt.datetime]:
        with self._io.read("messaging.ledger") as conn:
            return ma.SqliteSendLedger(conn).times(since=since, account_key=account_key, recipient_key=recipient_key, kinds=kinds)

    def last_at(self, account_key: str) -> dt.datetime | None:
        with self._io.read("messaging.ledger") as conn:
            return ma.SqliteSendLedger(conn).last_at(account_key)

    def prune(self, before: dt.datetime) -> int:
        return ma.SqliteSendLedger(self._io.write()).prune(before)


# ---------------------------------------------------------------- queries of the wiring (routes, health, janitor, filters)

def rows_of_ticket(conn: sqlite3.Connection, ticket_id: str, limit: int = 50) -> list[OutboxRow]:
    rows = conn.execute("SELECT * FROM ticket_outbox WHERE ticket_id = ? ORDER BY created_at DESC, id DESC LIMIT ?", (ticket_id, int(limit))).fetchall()
    return [from_db(r) for r in rows]


def row(conn: sqlite3.Connection, row_id: str) -> OutboxRow | None:
    r = conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (row_id,)).fetchone()
    return from_db(r) if r else None


def open_count(conn: sqlite3.Connection, use_key: str, department_id: str | None) -> int:
    """Queued + held rows of a use (and department): what moves with a changed mapping (9.9.3, slice 5a's confirm)."""
    sql, args = "SELECT COUNT(*) FROM ticket_outbox WHERE state IN ('queued', 'held') AND use_key = ?", [use_key]
    if department_id is not None:
        sql += " AND department_id = ?"
        args.append(department_id)
    return int(conn.execute(sql, args).fetchone()[0])


def recent_account_keys(conn: sqlite3.Connection, since: dt.datetime) -> set[str]:
    """Accounts that sent a ticket message after `since` (the inbound account filter's "sent within reply_window_h")."""
    return {r[0] for r in conn.execute(
        "SELECT DISTINCT account_key FROM ticket_outbox WHERE account_key IS NOT NULL AND state IN ('sent', 'unknown') AND sent_at > ?",
        (iso(since),)).fetchall() if r[0]}


def last_ok_by_account(conn: sqlite3.Connection) -> dict[str, str]:
    """The last successful send per account (Settings: "last successful send")."""
    return {r[0]: r[1] for r in conn.execute(
        "SELECT account_key, MAX(sent_at) FROM ticket_outbox WHERE state = 'sent' AND account_key IS NOT NULL GROUP BY account_key").fetchall()}


def health_counts(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, Any]:
    """Spec 17: depth by state (held by reason), the oldest queued age, sends of the last 24 h by outcome per account / channel."""
    depth: dict[str, int] = {}
    for r in conn.execute("SELECT state, held_reason, COUNT(*) FROM ticket_outbox WHERE state IN ('queued', 'held', 'sending') "
                          "GROUP BY state, held_reason").fetchall():
        key = r[0] if r[0] != "held" else f"held:{r[1] or 'unknown'}"
        depth[key] = depth.get(key, 0) + int(r[2])
    oldest = conn.execute("SELECT MIN(created_at) FROM ticket_outbox WHERE state IN ('queued', 'held')").fetchone()[0]
    since = iso(now - dt.timedelta(days=1))
    outcomes: dict[str, dict[str, int]] = {}
    for r in conn.execute("SELECT COALESCE(account_key, channel), state, COUNT(*) FROM ticket_outbox WHERE updated_at > ? "
                          "AND state IN ('sent', 'unknown', 'not_sent', 'refused') GROUP BY COALESCE(account_key, channel), state",
                          (since,)).fetchall():
        outcomes.setdefault(r[0], {})[r[1]] = int(r[2])
    started = parse(oldest)
    return {"depth": depth, "oldest_open_s": int((now - started).total_seconds()) if started else None, "last_24h": outcomes}


def prune(conn: sqlite3.Connection, *, outbox_before: dt.datetime, inbound_before: dt.datetime) -> int:
    """Spec 15.1: final outbox rows after 90 days (the timeline keeps "message sent"); inbound rows after 30 days - an ambiguous /
    late reply's text after 30 days or when handled, whichever first (`content` is cleared at handling)."""
    n = conn.execute("DELETE FROM ticket_outbox WHERE state NOT IN ('queued', 'held', 'sending') AND updated_at < ?",
                     (iso(outbox_before),)).rowcount
    n += conn.execute("DELETE FROM ticket_inbound WHERE received_at < ?", (iso(inbound_before),)).rowcount
    return n


# ---------------------------------------------------------------- ticket_inbound

def new_inbound_id() -> str:
    return secrets.token_hex(8)


def seen_recently(conn: sqlite3.Connection, key: str, now: dt.datetime, window: dt.timedelta) -> bool:
    return conn.execute("SELECT 1 FROM ticket_inbound WHERE dedupe_key = ? AND received_at >= ? LIMIT 1",
                        (key, iso(now - window))).fetchone() is not None


def insert_inbound(conn: sqlite3.Connection, row: Mapping[str, Any]) -> str:
    """One envelope row. A dedupe key that is still in the table from an OLDER window (or a recorded duplicate) gets a unique
    suffix: the UNIQUE index keeps the 24-hour dedupe exact without ever failing the write."""
    rid = row.get("id") or new_inbound_id()
    cols = ("id", "received_at", "provider_at", "event_type", "msg_type", "sender_key", "account_key", "dedupe_key", "contact_id", "ticket_id",
            "assignment_id", "outbox_id", "result", "reason", "action", "content", "candidates_json")
    data = {**{c: row.get(c) for c in cols}, "id": rid}
    data["candidates_json"] = row.get("candidates_json") or "{}"
    for attempt in range(2):
        try:
            conn.execute(f"INSERT INTO ticket_inbound({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(data[c] for c in cols))
            return rid
        except sqlite3.IntegrityError:
            if attempt:
                raise
            data["dedupe_key"] = hashlib.sha256(f"{data['dedupe_key']}|{rid}".encode("ascii")).hexdigest()
    return rid


def inbound(conn: sqlite3.Connection, inbound_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM ticket_inbound WHERE id = ?", (inbound_id,)).fetchone()
    return dict(r) if r else None


def open_ambiguous(conn: sqlite3.Connection, limit: int = 200) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM ticket_inbound WHERE result = 'ambiguous' AND handled_at IS NULL ORDER BY received_at DESC LIMIT ?", (int(limit),)).fetchall()]


CLAIM_STALE_AFTER = dt.timedelta(minutes=15)  # deep review B4: a claim older than this can be taken over


def claim_inbound(conn: sqlite3.Connection, inbound_id: str, user_id: str, at: str, *, stale_before: str | None = None) -> bool:
    """Compare-and-set: the first manager to press "זה שלי" holds it (a second one gets 409) - until the claim is older than
    `stale_before` (deep review B4: a manager who claimed and left no longer blocks the reply for everyone; the route passes
    now - CLAIM_STALE_AFTER). Times are `db.now_iso` text (seconds, Z), so they compare as text."""
    if stale_before is None:
        return conn.execute("UPDATE ticket_inbound SET claimed_by = ?, claimed_at = ? WHERE id = ? AND result = 'ambiguous' AND handled_at IS NULL "
                            "AND (claimed_by IS NULL OR claimed_by = ?)", (user_id, at, inbound_id, user_id)).rowcount == 1
    return conn.execute("UPDATE ticket_inbound SET claimed_by = ?, claimed_at = ? WHERE id = ? AND result = 'ambiguous' AND handled_at IS NULL "
                        "AND (claimed_by IS NULL OR claimed_by = ? OR claimed_at IS NULL OR claimed_at < ?)",
                        (user_id, at, inbound_id, user_id, stale_before)).rowcount == 1


def handle_inbound(conn: sqlite3.Connection, inbound_id: str, user_id: str, at: str, kind: str, ticket_id: str | None) -> bool:
    """attach / dismiss: the text leaves the table (it now lives in the ticket's note, or nowhere)."""
    return conn.execute(
        "UPDATE ticket_inbound SET handled_by = ?, handled_at = ?, handled_kind = ?, ticket_id = COALESCE(?, ticket_id), content = NULL "
        "WHERE id = ? AND result = 'ambiguous' AND handled_at IS NULL AND claimed_by = ?",
        (user_id, at, kind, ticket_id, inbound_id, user_id)).rowcount == 1


def inbound_counts(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, int]:
    return {r[0]: int(r[1]) for r in conn.execute(
        "SELECT result, COUNT(*) FROM ticket_inbound WHERE received_at > ? GROUP BY result", (iso(now - dt.timedelta(days=1)),)).fetchall()}


# ---------------------------------------------------------------- what the matcher reads (inbound.MatchDirectory)

def nonce_row(conn: sqlite3.Connection, nonce: str) -> dict[str, Any] | None:
    """The outbox row a button nonce names, joined with its ticket, assignment, link and contact. `link_generation` is the
    generation the message carried (NULL for a row from before migration 0086 that the backfill could not prove current);
    `link_current_generation` the link's generation now (deep review B3)."""
    r = conn.execute(
        "SELECT o.id AS outbox_id, o.ticket_id, o.assignment_id, o.contact_id, o.account_key, o.provider_message_id, o.link_id, "
        "o.link_generation, t.number, t.department_id, t.status, t.current_assignment_id, a.ended_at AS asg_ended_at, c.phone_key, "
        "l.revoked_at, l.expires_at, l.cap_at, l.grace_until, l.require_code, l.generation AS link_current_generation "
        "FROM ticket_outbox o JOIN tickets t ON t.id = o.ticket_id JOIN ticket_assignments a ON a.id = o.assignment_id "
        "LEFT JOIN ticket_contacts c ON c.id = o.contact_id LEFT JOIN ticket_links l ON l.id = o.link_id "
        "WHERE o.reply_nonce = ?", (nonce,)).fetchone()
    return dict(r) if r else None


def inbound_candidates(conn: sqlite3.Connection, sender_key: str, since: dt.datetime) -> list[dict[str, Any]]:
    """Live assignments of contacts whose phone key is the sender's, with the last message that went to them (sent / unknown)
    after `since`. A contact with several live tickets yields several rows (the matcher then needs a reference)."""
    return [dict(r) for r in conn.execute(
        "SELECT a.id AS assignment_id, a.ticket_id, a.contact_id, t.number, t.department_id, t.status, l.require_code, "
        "l.revoked_at, l.expires_at, l.cap_at, l.grace_until, "
        "(SELECT o.id FROM ticket_outbox o WHERE o.assignment_id = a.id AND o.state IN ('sent', 'unknown') AND o.sent_at > ? "
        "  ORDER BY o.sent_at DESC LIMIT 1) AS outbox_id, "
        "(SELECT o.sent_at FROM ticket_outbox o WHERE o.assignment_id = a.id AND o.state IN ('sent', 'unknown') AND o.sent_at > ? "
        "  ORDER BY o.sent_at DESC LIMIT 1) AS sent_at, "
        "(SELECT o.account_key FROM ticket_outbox o WHERE o.assignment_id = a.id AND o.state IN ('sent', 'unknown') AND o.sent_at > ? "
        "  ORDER BY o.sent_at DESC LIMIT 1) AS account_key "
        "FROM ticket_contacts c JOIN ticket_assignments a ON a.contact_id = c.id AND a.ended_at IS NULL "
        "JOIN tickets t ON t.id = a.ticket_id AND t.current_assignment_id = a.id AND t.status NOT IN ('closed', 'cancelled') "
        "LEFT JOIN ticket_links l ON l.assignment_id = a.id "
        "WHERE c.phone_key = ? AND c.erased_at IS NULL",
        (iso(since), iso(since), iso(since), sender_key)).fetchall()]


def due(conn: sqlite3.Connection, now: dt.datetime, module_on: bool) -> bool:
    """Is there anything for the worker's next tick (so an idle installation never takes the write lock every 2 s)?"""
    if not module_on:
        return conn.execute("SELECT 1 FROM ticket_outbox WHERE state IN ('queued', 'held') AND "
                            "(held_reason IS NULL OR held_reason != 'module_off') LIMIT 1").fetchone() is not None
    return conn.execute("SELECT 1 FROM ticket_outbox WHERE state IN ('queued', 'held') AND (not_before <= ? OR held_reason IN "
                        "('channel_down', 'account_unmapped', 'module_off')) LIMIT 1", (iso(now),)).fetchone() is not None


def any_open(conn: sqlite3.Connection) -> bool:
    """Is there any row the worker may still move? None: the periodic full tick is skipped too (no write lock at all)."""
    return conn.execute("SELECT 1 FROM ticket_outbox WHERE state IN ('queued', 'held', 'sending') LIMIT 1").fetchone() is not None


def department_send_hours(conn: sqlite3.Connection, department_id: str) -> Any:
    """A department's D4 override (slice 2's `send_hours_json`; NULL = the installation's window)."""
    try:
        row = conn.execute("SELECT send_hours_json FROM ticket_departments WHERE id = ?", (department_id,)).fetchone()
    except sqlite3.Error:
        return None
    return row[0] if row else None


# ---------------------------------------------------------------- message templates (ticket_templates kind 'message', D26)

def message_templates(conn: sqlite3.Connection, *, purpose: str | None = None, department_id: str | None = None,
                      include_all_departments: bool = False, include_inactive: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM ticket_templates WHERE kind = 'message' AND deleted_at IS NULL"
    args: list[Any] = []
    if purpose is not None:
        sql += " AND purpose = ?"
        args.append(purpose)
    if not include_inactive:
        sql += " AND active = 1"
    if not include_all_departments:
        sql += " AND (department_id IS NULL OR department_id = ?)"
        args.append(department_id)
    return [dict(r) for r in conn.execute(sql + " ORDER BY department_id, purpose, lang, updated_at", args).fetchall()]


def message_template(conn: sqlite3.Connection, template_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM ticket_templates WHERE id = ? AND kind = 'message' AND deleted_at IS NULL", (template_id,)).fetchone()
    return dict(r) if r else None


def message_template_clash(conn: sqlite3.Connection, purpose: str, lang: str, department_id: str | None) -> str | None:
    r = conn.execute("SELECT id FROM ticket_templates WHERE kind = 'message' AND deleted_at IS NULL AND purpose = ? AND lang = ? AND "
                     "department_id IS ?", (purpose, lang, department_id)).fetchone()
    return r[0] if r else None


def insert_message_template(conn: sqlite3.Connection, template_id: str, *, department_id: str | None, purpose: str, lang: str, body: str,
                            active: bool, by: str, at: str) -> None:
    conn.execute("INSERT INTO ticket_templates(id, department_id, kind, purpose, name, title, body, lang, active, revision, updated_by, updated_at) "
                 "VALUES (?, ?, 'message', ?, ?, '', ?, ?, ?, 1, ?, ?)",
                 (template_id, department_id, purpose, f"{purpose}/{lang}", body, lang, 1 if active else 0, by, at))


def update_message_template(conn: sqlite3.Connection, template_id: str, fields: Mapping[str, Any], *, revision: int, by: str, at: str) -> bool:
    cols = [c for c in fields if c in ("body", "active")]
    if not cols:
        return True
    sets = ", ".join(f"{c} = ?" for c in cols)
    return conn.execute(f"UPDATE ticket_templates SET {sets}, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ? AND revision = ?",
                        (*[fields[c] for c in cols], by, at, template_id, revision)).rowcount == 1


def delete_message_template(conn: sqlite3.Connection, template_id: str, *, by: str, at: str) -> None:
    conn.execute("UPDATE ticket_templates SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE id = ?", (at, by, at, template_id))


def ticket_for_worker(conn: sqlite3.Connection, ticket_id: str) -> dict[str, Any] | None:
    """The worker's read of one ticket (system side: no person's visibility applies - the worker acts for the module, like the
    public listener does through its link). Never used by a route that answers a person."""
    r = conn.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    return dict(r) if r else None
