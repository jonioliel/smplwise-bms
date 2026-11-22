"""Response models of the custom roles and delegation API (routers/access_custom_roles.py, `/api/v1/access/roles...`,
`/api/v1/access/delegation`; T082). The role list itself (`GET /access/roles`) belongs to routers/access.py. Field order is the order the
router and services/rbac_admin build their dicts in."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()


class CustomRole(WireModel):
    """A custom role as services/rbac_admin._custom_role_dict shapes it (`permissions` = the regular and the sensitive grants together)."""
    id: str
    name: str
    description: str
    permissions: list[str]
    custom: Literal[True]
    revision: int
    delegable: bool
    sensitive_included: list[str]
    sensitive_missing: list[str]
    system_role: Literal[False]
    created_by_username: str | None
    updated_by_username: str | None
    updated_at: str
    delegation_block: Literal["sensitive_custom_role", "assign_role"] | None
    """Why the role can never be delegated (None = it may be)."""


class CustomRoleImpactRef(WireModel):
    id: str
    name: str


class CustomRoleImpact(WireModel):
    """Who a role change touches (services/rbac_admin._role_impact): the permission diff, the active bindings, the users (direct and
    through groups), the groups and the scope names."""
    role_id: str | None
    added: list[str]
    removed: list[str]
    bindings: int
    users: list[CustomRoleImpactRef]
    groups: list[CustomRoleImpactRef]
    scopes: list[str]


class CustomRolePreview(CustomRoleImpact):
    """`POST /access/roles/preview`: the impact plus every permission's label as a screen shows it."""
    labels: dict[str, str]


class CustomRoleUpdated(CustomRole):
    """`PATCH /access/roles/{id}`: the role after the change and the impact the change had."""
    impact: CustomRoleImpact


class CustomRoleDeleted(WireModel):
    deleted: str
    revision: int
    """The permission revision after the change."""


class DelegationState(WireModel):
    """The delegation allow-list: the roles a delegated administrator may assign, the factory list, the rules shown next to it and why a
    role can never be on it."""
    delegable_roles: list[str]
    default: list[str]
    rules: list[str]
    blocked: dict[str, str]
    """role id -> the reason it can never be delegated (`system_role`, `assign_role`, `sensitive_custom_role`)."""
    revision: int


class DelegationSaved(WireModel):
    delegable_roles: list[str]
    revision: int
