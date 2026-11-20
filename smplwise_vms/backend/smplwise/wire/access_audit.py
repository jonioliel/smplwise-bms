"""Response models of the effective-permission preview and the audit screen (routers/access_audit.py: `POST /api/v1/access/preview`,
`GET /api/v1/audit`). Field order is the order the router builds its dicts in (an audit row: the `audit_log` columns)."""
from __future__ import annotations

from typing import Any

from . import WireModel
from .access_groups import AccessGroupBinding

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class AccessPreview(WireModel):
    """Effective permissions of a user at a scope. `limited_to_own`: a delegated administrator previewing someone else sees at most
    what they hold there themselves (and only the bindings inside their reach)."""
    user_id: str
    scope_type: str
    scope_id: str
    scope_name: str
    active: bool
    allowed: list[str]
    denied: list[str]
    limited_to_own: bool
    labels: dict[str, str]
    bindings: list[AccessGroupBinding]
    revision: int


class AuditRow(WireModel):
    """One `audit_log` row (`SELECT *`, migrations 0001 + 0032) with `details_json` parsed into `details` (the stored object; audit() writes
    one or nothing, `{}` when empty or unreadable)."""
    id: int
    at: str
    actor_user_id: str | None
    actor_username: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    decision: str
    reason: str | None
    request_id: str | None
    permission_revision: int | None
    scope_type: str | None
    scope_id: str | None
    role_id: str | None
    binding_id: str | None
    details: dict[str, Any]


class AuditPage(WireModel):
    rows: list[AuditRow]
