"""Response model of the role catalogue (routers/access_roles.py: `GET /api/v1/access/roles`). Field order is the order the router and
services/rbac_admin._custom_role_dict build their dicts in."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class CatalogueRole(WireModel):
    """A built-in role (`custom` false: `description` "", `revision` null, no author fields) or a custom role
    (services/rbac_admin._custom_role_dict: `custom` true, the author fields and `updated_at`)."""
    id: str
    name: str
    permissions: list[str]
    custom: bool
    description: str
    revision: int | None
    delegable: bool
    sensitive_included: list[str]
    sensitive_missing: list[str]
    system_role: bool
    delegation_block: Literal["role_unknown", "system_role", "assign_role", "sensitive_custom_role"] | None
    """Why the role can never be on the delegation allow-list; null = it may be."""
    created_by_username: str | None = None
    updated_by_username: str | None = None
    updated_at: str = None


class RoleCatalogue(WireModel):
    roles: list[CatalogueRole]
    """Built-in roles first, then the live custom roles; a delegated administrator gets only the roles they may hand out."""
    labels: dict[str, str]
    sensitive: list[str]
    system_permissions: list[str]
    delegable_roles: list[str]
    legacy_permissions: dict[str, str]
    """WXPERM: old permission name -> the permission it stands for."""
    can_manage_roles: bool
    delegated: bool
