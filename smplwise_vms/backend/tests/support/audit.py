"""Reading the audit log of a test installation (on a read connection of its own: no write lock taken)."""
from __future__ import annotations

import json
from typing import Any


def audit_rows(settings: Any, action: str) -> list[dict[str, Any]]:
    """Every audit row of `action`, oldest first, as dictionaries. `settings`: the installation's Settings (its `db_path`)."""
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def audit_details(settings: Any, action: str) -> list[dict[str, Any]]:
    """The decoded `details_json` of every audit row of `action`, oldest first ({} for a row without details)."""
    return [json.loads(r["details_json"] or "{}") for r in audit_rows(settings, action)]
