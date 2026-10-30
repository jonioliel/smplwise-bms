"""Atomic request/operation replay ledger; public metadata only, no request bodies."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from .validation import Refusal


class Journal:
    RETENTION_SECONDS = 7 * 24 * 60 * 60

    def __init__(self, path: str | Path, *, max_records=4096):
        if type(max_records)is not int or not 1<=max_records<=1048576:raise ValueError('bounded replay capacity required')
        self.max_records=max_records
        self.db = sqlite3.connect(str(path), isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("CREATE TABLE IF NOT EXISTS actions (request_id TEXT PRIMARY KEY, operation_id TEXT UNIQUE NOT NULL, created REAL NOT NULL, state TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS clock_anchor (id INTEGER PRIMARY KEY CHECK(id=1), observed REAL NOT NULL)")
        self.db.execute("UPDATE actions SET state='unknown' WHERE state='pending'")

    def reserve(self, request_id: str, operation_id: str, now: datetime):
        try:
            self.db.execute("BEGIN IMMEDIATE")
            anchor = self.db.execute("SELECT observed FROM clock_anchor WHERE id=1").fetchone()
            if anchor and now.timestamp() < anchor[0]:
                raise Refusal("binding_denied")
            self.db.execute("INSERT INTO clock_anchor VALUES(1,?) ON CONFLICT(id) DO UPDATE SET observed=excluded.observed", (now.timestamp(),))
            self.db.execute("DELETE FROM actions WHERE created <= ?", (now.timestamp()-self.RETENTION_SECONDS,))
            if self.db.execute("SELECT COUNT(*) FROM actions").fetchone()[0]>=self.max_records:
                duplicate=self.db.execute("SELECT 1 FROM actions WHERE request_id=? OR operation_id=?",(request_id,operation_id)).fetchone()
                self.db.execute("COMMIT")  # Retain trusted clock even when full.
                raise Refusal("unproven_duplicate" if duplicate else "binding_denied")
            self.db.execute("INSERT INTO actions VALUES (?,?,?,'pending')", (request_id, operation_id, now.timestamp()))
            self.db.execute("COMMIT")
        except sqlite3.IntegrityError:
            # ABORT cancels the duplicate INSERT statement, not the transaction.
            # Keep the maximum trusted clock observation across restart even
            # when admission was refused. Never delete replay to permit retry.
            try:self.db.execute("COMMIT")
            except BaseException:
                if self.db.in_transaction:self.db.execute("ROLLBACK")
                raise
            raise Refusal("unproven_duplicate") from None
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise

    def finish(self, request_id: str):
        # Do not cache response bodies or success for replay; even completed lookup is not resend permission.
        self.db.execute("UPDATE actions SET state='unknown' WHERE request_id=?", (request_id,))

    def prior_possible(self, request_id: str, operation_id: str, now: datetime) -> bool:
        row = self.db.execute("SELECT state FROM actions WHERE (request_id=? OR operation_id=?) AND created>?",
                              (request_id, operation_id, now.timestamp()-self.RETENTION_SECONDS)).fetchone()
        return bool(row and row[0] in ('pending','unknown'))

    def has_replay(self, request_id: str, operation_id: str, now: datetime) -> bool:
        row=self.db.execute("SELECT 1 FROM actions WHERE (request_id=? OR operation_id=?) AND created>?",
                            (request_id,operation_id,now.timestamp()-self.RETENTION_SECONDS)).fetchone()
        return row is not None

    def refused(self, request_id: str):
        self.db.execute("UPDATE actions SET state='refused' WHERE request_id=?", (request_id,))

    def lookup_unknown(self, request_id: str, now: datetime):
        row = self.db.execute("SELECT created,state FROM actions WHERE request_id=?", (request_id,)).fetchone()
        return "pending" if row and now.timestamp()-row[0] < self.RETENTION_SECONDS else "not_found_or_expired"

    def close(self):
        self.db.close()
