"""WisKey round 5 (R5-A6, with R5-A1): the DURABLE journal of WisKey person writes.

The per-person write gate of `intercom_sync.IntercomSync` (R3-06 / R4-07) lives in process memory: a restart, or a standby process taking
over, forgot a write whose outcome was unknown - or one still out on the wire when the process ended - and could send the next write to
that person before anything had read it back. This journal records every targeted person write BEFORE it is dispatched and its outcome
after, in the database (table `intercom_write_ops`, migration 0121), and holds a new write to a person while an
earlier one is unresolved:

- `dispatched` (recorded before the frame is sent) -> `ok` / `refused` / `not_sent` (settled, nothing to hold) or `unknown`;
- a `dispatched` row of ANOTHER process (it ended - or still runs - while its call was out) and an `unknown` row are UNRESOLVED: a new
  write to the target is refused (`readback_required`, nothing sent) until a fresh readback of the target has answered;
- the readback settles a row only when it STARTED after the row's call was over (`finished_ts`); for a row whose end is not known (the
  process that sent it is gone) only after `HOLD_S` past its start - the transport's own call limit, so a remote handler still running
  for the old process can no longer commit after the read. A fresh snapshot is still not a distributed exactly-once proof (stated).

Nothing here stores a PIN, a PIN hash, a card number, a name or a phone: ids, the command key, codes and times only. The grant worker's
`users/create` (no person id exists before WisKey answers) uses the create-intent helpers below (R5-A1), keyed by the grant.

Writes to the journal fail closed: when the intent cannot be recorded the write is not sent (`JournalUnavailable`)."""
from __future__ import annotations

import logging
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("smplwise.intercom_write_journal")

HOLD_S = 75.0  # ha_client's own call limit (60 s) plus a margin: after it, a call of a process that is gone can no longer commit
BOOT_ID = uuid.uuid4().hex  # this process
OPEN = ("dispatched", "unknown")
FINAL = ("ok", "refused", "not_sent")
KEEP_DAYS = 30  # settled rows are pruned after this (ids only; the audit log keeps the history)


class JournalUnavailable(Exception):
    """The intent could not be recorded: the write is not sent (fail closed)."""


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class WriteJournal:
    """The journal over one database. `clock` (epoch seconds) is injectable for tests."""

    def __init__(self, db: Any, *, boot_id: str | None = None, clock: Any = None) -> None:
        self.db = db
        self.boot_id = boot_id or BOOT_ID
        self.clock = clock or time.time

    # -- the write side (intercom_sync._execute)
    def admit(self, target: str, op: str, lane: str, *, _between: Any = None) -> tuple[str | None, str | None]:
        """R6-A2 / ACR6-01: the ATOMIC durable admission - (blocked, op id). ONE write transaction (`BEGIN IMMEDIATE`: SQLite's single write
        lock, held across processes) reads every unresolved row of `target` and, only when none blocks, inserts exactly one `dispatched`
        intent; the check and the claim can no longer be split across two connections, so two instances (two processes, a standby, an
        editor write next to a worker write) sharing the database can never both admit a write to the same person. Refused:
        (`outcome_pending` | `readback_required`, None) with nothing inserted and nothing sent; a journal that cannot be read or written:
        (`journal_unavailable`, None) - fail closed, no side effect. `_between` is a test hook only (runs between the check and the insert,
        inside the transaction)."""
        op_id = uuid.uuid4().hex
        try:
            with self.db.connection(label="intercom_write_journal.admit") as conn:
                rows = [dict(r) for r in conn.execute(
                    "SELECT * FROM intercom_write_ops WHERE target = ? AND state IN ('dispatched', 'unknown') ORDER BY started_ts", (target,)).fetchall()]
                blocked = self._verdict(rows)
                if blocked is not None:
                    return blocked, None
                if _between is not None:
                    _between()
                at = self.clock()
                conn.execute("""INSERT INTO intercom_write_ops(id, target, op, lane, boot_id, state, started_ts, created_at)
                                VALUES (?, ?, ?, ?, ?, 'dispatched', ?, ?)""", (op_id, target, str(op)[:32], str(lane)[:16], self.boot_id, at, _iso(at)))
        except (sqlite3.Error, OSError) as exc:
            log.error("intercom write journal: the admission could not be recorded (%s) - the write is not sent", type(exc).__name__)
            return "journal_unavailable", None
        return None, op_id

    def begin(self, target: str, op: str, lane: str) -> str:
        """An UNCHECKED intent record (tests and recovery tooling only). Every product write path goes through `admit` (R6-A2)."""
        op_id = uuid.uuid4().hex
        at = self.clock()
        try:
            with self.db.connection(label="intercom_write_journal.begin") as conn:
                conn.execute("""INSERT INTO intercom_write_ops(id, target, op, lane, boot_id, state, started_ts, created_at)
                                VALUES (?, ?, ?, ?, ?, 'dispatched', ?, ?)""", (op_id, target, str(op)[:32], str(lane)[:16], self.boot_id, at, _iso(at)))
        except (sqlite3.Error, OSError) as exc:
            log.error("intercom write journal: the intent could not be recorded (%s) - the write is not sent", type(exc).__name__)
            raise JournalUnavailable() from None
        return op_id

    def finish(self, op_id: str, outcome: str, code: str | None = None, *, over: bool = True) -> None:
        """The outcome as this side knows it. `unknown` with `over=False`: the call is still out (`call_over` records its end)."""
        state = outcome if outcome in FINAL else "unknown"
        try:
            with self.db.connection(label="intercom_write_journal.finish") as conn:
                conn.execute("UPDATE intercom_write_ops SET state = ?, code = ?, finished_ts = ? WHERE id = ? AND state = 'dispatched'",
                             (state, (str(code)[:64] if code else None), self.clock() if (over or state in FINAL) else None, op_id))
        except (sqlite3.Error, OSError):
            # the row stays `dispatched`: unresolved, held until a readback - the conservative reading of a lost record
            log.warning("intercom write journal: an outcome could not be recorded; the write stays unresolved")

    def call_over(self, op_id: str) -> None:
        try:
            with self.db.connection(label="intercom_write_journal.over") as conn:
                conn.execute("UPDATE intercom_write_ops SET finished_ts = ? WHERE id = ? AND finished_ts IS NULL", (self.clock(), op_id))
        except (sqlite3.Error, OSError):
            log.warning("intercom write journal: the end of a call could not be recorded")

    # -- the gate side
    def open_rows(self, target: str) -> list[dict[str, Any]]:
        with self.db.connection(mode="read", label="intercom_write_journal.open") as conn:
            rows = conn.execute("SELECT * FROM intercom_write_ops WHERE target = ? AND state IN ('dispatched', 'unknown') ORDER BY started_ts",
                                (target,)).fetchall()
        return [dict(r) for r in rows]

    def _settles_after(self, row: dict[str, Any]) -> float | None:
        """The time after which a readback that STARTS then can settle the row; None = not yet knowable (this process's call still out)."""
        if row["finished_ts"] is not None:
            return float(row["finished_ts"])
        if row["boot_id"] == self.boot_id:
            return None  # this process's call is still out (the in-memory gate holds it too)
        return float(row["started_ts"]) + HOLD_S

    def blocking(self, target: str) -> str | None:
        """None when no unresolved write blocks `target`; `outcome_pending` while one may still commit (a readback now would prove
        nothing); `readback_required` when a fresh readback would settle it. A journal that cannot be read blocks (fail closed)."""
        try:
            rows = self.open_rows(target)
        except (sqlite3.Error, OSError):
            return "readback_required"
        return self._verdict(rows)

    def _verdict(self, rows: list[dict[str, Any]]) -> str | None:
        if not rows:
            return None
        now = self.clock()
        for row in rows:
            after = self._settles_after(row)
            if after is None or after >= now:
                return "outcome_pending"
        return "readback_required"

    def readback(self, target: str, started_ts: float, memory: str = "absent") -> int:
        """A readback of `target` that STARTED at `started_ts` has answered. `memory`: what the in-memory gate concluded for this process's
        own rows - `settled` (its sequence numbers prove the read started after the call was over), `pending` (it did not), `absent`
        (no in-memory entry: the wall clock decides). Returns how many rows were reconciled."""
        try:
            rows = self.open_rows(target)
        except (sqlite3.Error, OSError):
            return 0
        done = []
        for row in rows:
            mine = row["boot_id"] == self.boot_id
            if mine and memory == "pending":
                continue
            if mine and memory == "settled" and row["finished_ts"] is not None:
                done.append(row["id"])
                continue
            after = self._settles_after(row)
            if after is not None and started_ts > after:
                done.append(row["id"])
        if not done:
            return 0
        try:
            with self.db.connection(label="intercom_write_journal.reconcile") as conn:
                at = self.clock()
                marks = ",".join("?" * len(done))
                n = conn.execute(f"UPDATE intercom_write_ops SET state = 'reconciled', reconciled_ts = ? WHERE id IN ({marks}) AND state IN ('dispatched', 'unknown')",
                                 (at, *done)).rowcount
                conn.execute("DELETE FROM intercom_write_ops WHERE state IN ('ok', 'refused', 'not_sent', 'reconciled') AND started_ts < ?", (at - KEEP_DAYS * 86400,))
                return n
        except (sqlite3.Error, OSError):
            return 0


# ---------------------------------------------------------------- R5-A1: the grant worker's users/create (keyed by the grant)

def create_target(grant_id: str) -> str:
    return f"create:grant:{grant_id}"


def create_intent(conn: sqlite3.Connection, grant_id: str, subject_kind: str, subject_id: str, purpose_ref: str, *, clock: Any = None) -> str:
    """Recorded in the SAME transaction that marks the grant `pushed`: an `intent` row proves nothing was sent yet."""
    op_id = uuid.uuid4().hex
    at = (clock or time.time)()
    conn.execute("""INSERT INTO intercom_write_ops(id, target, op, lane, boot_id, state, grant_id, subject_kind, subject_id, purpose_ref, started_ts, created_at)
                    VALUES (?, ?, 'create', 'config', ?, 'intent', ?, ?, ?, ?, ?, ?)""",
                 (op_id, create_target(grant_id), BOOT_ID, grant_id, subject_kind, subject_id, str(purpose_ref)[:128], at, _iso(at)))
    return op_id


def create_dispatched(conn: sqlite3.Connection, op_id: str, *, clock: Any = None) -> None:
    conn.execute("UPDATE intercom_write_ops SET state = 'dispatched', started_ts = ? WHERE id = ? AND state = 'intent'", ((clock or time.time)(), op_id))


def create_finished(conn: sqlite3.Connection, op_id: str, outcome: str, *, person_id: str | None = None, code: str | None = None, clock: Any = None) -> None:
    state = outcome if outcome in FINAL else "unknown"
    conn.execute("UPDATE intercom_write_ops SET state = ?, code = ?, result_ref = COALESCE(?, result_ref), finished_ts = ? WHERE id = ?",
                 (state, (str(code)[:64] if code else None), person_id, (clock or time.time)(), op_id))


def create_ops(conn: sqlite3.Connection, *, grant_id: str | None = None, subject: tuple[str, str] | None = None) -> list[dict[str, Any]]:
    if grant_id is not None:
        rows = conn.execute("SELECT * FROM intercom_write_ops WHERE op = 'create' AND grant_id = ? ORDER BY started_ts", (grant_id,)).fetchall()
    else:
        assert subject is not None
        rows = conn.execute("SELECT * FROM intercom_write_ops WHERE op = 'create' AND subject_kind = ? AND subject_id = ? ORDER BY started_ts", subject).fetchall()
    return [dict(r) for r in rows]


def create_verdict(ops: list[dict[str, Any]]) -> tuple[str, str | None]:
    """What the create records of one grant (or subject) prove: (`created`, person id) - a create answered (or a recovered target was
    attached) and no link carries it yet; (`unresolved`, None) - a create may have landed and nobody knows where; (`none`, None) - every
    create was refused / not sent / never dispatched (nothing was created); (`no_record`, None) - no create record at all."""
    if not ops:
        return "no_record", None
    for op in ops:
        if op["state"] in ("ok", "reconciled") and op.get("result_ref"):
            return "created", op["result_ref"]
    if any(op["state"] in ("dispatched", "unknown") for op in ops):
        return "unresolved", None
    return "none", None
