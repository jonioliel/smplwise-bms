from __future__ import annotations

import json
import sqlite3
from typing import Any

import datetime as dt

from .db import Database, database_of, now_iso, permission_revision, read_mode

RETENTION_DAYS = 365  # audit rows older than this are pruned by the janitor (T055); the setting can follow later


def _write_audit(
    conn: sqlite3.Connection,
    *,
    actor: Any | None,
    action: str,
    decision: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    reason: str | None = None,
    request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Append one audit row. Never include secrets or source URLs in `details`."""
    conn.execute(
        """INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, reason,
                                 request_id, permission_revision, details_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            now_iso(),
            getattr(actor, "user_id", None),
            getattr(actor, "username", None),
            action,
            resource_type,
            resource_id,
            decision,
            reason,
            request_id,
            permission_revision(conn),
            json.dumps(details, ensure_ascii=False) if details else None,
        ),
    )


def prune(conn: sqlite3.Connection, days: int = RETENTION_DAYS) -> int:
    """Delete audit rows older than `days`. Returns the number removed."""
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return conn.execute("DELETE FROM audit_log WHERE at < ?", (cutoff,)).rowcount


def prune_db(db: Database, days: int = RETENTION_DAYS) -> int:
    with db.connection() as conn:
        return prune(conn, days)


def audit(
    conn: sqlite3.Connection,
    *,
    actor: Any | None,
    action: str,
    decision: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    reason: str | None = None,
    request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Append one audit row. A read-mode request (deferred, query-only) records it through a short side
    transaction so a refusal is still kept without the request taking the write lock."""
    if read_mode(conn):
        db = database_of(conn)
        if db is not None:
            with db.write_aside() as w:
                _write_audit(w, actor=actor, action=action, decision=decision, resource_type=resource_type, resource_id=resource_id, reason=reason, request_id=request_id, details=details)
            return
    _write_audit(conn, actor=actor, action=action, decision=decision, resource_type=resource_type, resource_id=resource_id, reason=reason, request_id=request_id, details=details)

