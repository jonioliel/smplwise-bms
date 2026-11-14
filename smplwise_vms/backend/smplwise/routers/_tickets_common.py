"""Helpers the tickets routers used to copy (code review 2026-11-13, 01:F-13).

    invalid(conn, field, code)        the 422 `validation` envelope for one field ("ערך לא תקין."), as an ApiError to raise
    invalid_fields(conn, fields)      the same envelope for a list of {"field", "code"} problems
    need_any(conn, viewer, *perms)    at least one permission at any scope, else the audited 403 (action = the first permission,
                                      reason `no_binding`, details {"permission": ...}); `request_id=` is recorded when given

`rid` (the correlation id) is shared by every router: routers/_common.py. Helpers whose audit rows differ per router (`_money`,
`_configurer`, the cost `_need`, the RFQ `_need_view`) stay local: they name their own resource type, reason and details."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..audit import audit
from ..errors import ApiError
from ..services.tickets.access import text
from ._common import rid

__all__ = ["invalid", "invalid_fields", "need_any", "rid"]


def invalid_fields(conn: sqlite3.Connection, fields: list[dict[str, Any]]) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": fields})


def invalid(conn: sqlite3.Connection, field: Any, code: Any) -> ApiError:
    return invalid_fields(conn, [{"field": field, "code": code}])


def need_any(conn: sqlite3.Connection, viewer: Any, *permissions: str, request_id: str | None = None) -> None:
    """At least one of the permissions at any scope (the tickets' own scope rules apply per ticket); an audited 403 otherwise."""
    if any(p in viewer.anywhere for p in permissions):
        return
    audit(conn, actor=viewer.principal, action=permissions[0], decision="denied", resource_type="installation", resource_id="*", reason="no_binding",
          request_id=request_id)
    raise ApiError(403, "forbidden", text(conn, "אין הרשאה ל{tickets}."), details={"permission": permissions[0]})
