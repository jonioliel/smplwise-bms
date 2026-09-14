from __future__ import annotations

import json
import sqlite3
from typing import Any

from .db import now_iso, permission_revision


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
