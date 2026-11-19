"""Response models of the groups and bulk-bindings API (routers/access_groups.py, `/api/v1/access/groups...`, `/api/v1/access/bindings/bulk`;
T082 groups, delegated administration). Field order is the order the router builds its dicts in."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class AccessGroupMember(WireModel):
    id: str
    name: str


class AccessGroupBinding(WireModel):
    """An active binding of the group (services/rbac_admin._binding_dict); `via_group` is null here (the group's own binding)."""
    id: str
    subject_kind: Literal["user", "group"]
    subject_id: str
    subject_name: str
    role_id: str
    role_name: str
    scope_type: str
    scope_id: str
    scope_name: str
    effect: Literal["allow", "deny"]
    permission_revision: int
    assigned_by: str | None
    created_at: str
    expires_at: str | None
    via_group: str | None


class AccessGroup(WireModel):
    """One group with its members (sorted by name) and its active bindings; `is_member` = the caller is a member."""
    id: str
    name: str
    created_at: str
    revision: int
    updated_at: str | None
    members: list[AccessGroupMember]
    bindings: list[AccessGroupBinding]
    is_member: bool = None


class AccessGroupList(WireModel):
    groups: list[AccessGroup]
    can_manage: bool
    delegated: bool


class AccessGroupDeleted(WireModel):
    deleted: str
    revision: int
    """The permission revision after the change."""


class AccessGroupBound(WireModel):
    """`POST /access/groups/{id}/bindings`: the new binding, the permission revision and the group after the change."""
    binding_id: str
    revision: int
    group: AccessGroup


class AccessGroupUnbound(WireModel):
    revoked: str
    revision: int
    group: AccessGroup


class AccessImpactScope(WireModel):
    scope_type: str
    scope_id: str
    scope_name: str


class AccessImpactUserScope(WireModel):
    scope_type: str
    scope_id: str
    scope_name: str
    added: list[str]
    removed: list[str]


class AccessImpactUser(WireModel):
    """An affected user: the permissions gained / lost (all scopes together and per scope)."""
    id: str
    name: str
    change: Literal["member", "added", "removed"]
    added: list[str]
    removed: list[str]
    scopes: list[AccessImpactUserScope]


class AccessGroupImpact(WireModel):
    """`POST /access/groups/{id}/impact`: the preview of a group change (computed in a savepoint that is rolled back)."""
    group_id: str
    op: Literal["bind", "unbind", "members"]
    revision: int
    """The group's revision."""
    scopes: list[AccessImpactScope]
    users: list[AccessImpactUser]
    labels: dict[str, str]
    """Permission id -> its label as a screen shows it."""


class AccessBulkCreatedItem(WireModel):
    index: int
    binding_id: str
    revision: int


class AccessBulkCreated(WireModel):
    """`POST /access/bindings/bulk`: every created binding (all or nothing) and the last permission revision."""
    created: list[AccessBulkCreatedItem]
    revision: int
