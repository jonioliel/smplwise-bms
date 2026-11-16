"""Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
trail (chapters 8 and 40; docs/security/HA_IDENTITY_RBAC_HE.md §5-§12; contracts/access-api.design.json).

Identity comes only from Home Assistant (the bridge's directory push and the Ingress headers); nothing here
writes to HA. Every change bumps permission_revision, is audited with a before/after diff of the subject's
bindings, and closes the affected users' media sessions (services/revocation).

CR-SPLIT-ACCESS-2440 (review 05:P2-08, P2-09, P2-07): the 1,500 lines that lived here are split, moved unchanged - the label
catalogue, the shaping, the delegation rules and the binding writes into services/rbac_admin.py (services and other routers
imported them from this router), and the routes along their section comments into access_directory, access_roles,
access_bindings, access_audit and access_custom_roles. This module is what it was for every importer: `router` carries the same
routes in the same order and every name is re-exported below. New code imports from the part itself; a test that replaces a
module-level value patches the part that reads it."""
from __future__ import annotations

from fastapi import APIRouter

from ..services import playback as pb
from ..services.rbac_admin import (
    BindingBody, DEFAULT_DELEGABLE, LOCAL_DENY_HE, LOCAL_ONE_BINDING_HE, LOCAL_ROLE_HE, NEVER_DELEGABLE, PERMISSION_LABELS, SCOPE_TABLES, SENSITIVE,
    STALE_S, SYSTEM_PERMISSIONS, _active_bindings_sql, _binding_dict, _binding_summary, _check_delegable_flag, _custom_role_dict,
    _delegated_directory, _ensure_user_row, _group_members, _invalidate_links_on_admin_role, _principal_of, _refuse, _rid, _role_impact,
    _scope_exists, _subject_name, _sync_status, _terminate, _user_bindings, _users, _validate_role_body, active_user_ids, admin_count, affected_users,
    assign_scopes, assigns_anywhere, check_delegation, delegable_roles, delegated_group_problem, delegated_sees, delegation_block, full_authority,
    group_reach_problem, in_reach, insert_binding, is_member, keep_an_admin, local_binding_check, rendered_labels, revoke_one, scope_in_reach,
    touch_group, user_known, validate_binding,
)
from . import access_audit, access_bindings, access_custom_roles, access_directory, access_roles
from .access_audit import (
    PreviewBody, list_audit, preview,
)
from .access_bindings import (
    create_binding, list_bindings, revoke_binding,
)
from .access_custom_roles import (
    CustomRoleBody, CustomRolePatch, DELEGATION_RULES, DelegationBody, ROLE_PERMISSIONS_MAX, ROLE_SENSITIVE_MAX, RolePreviewBody, create_custom_role,
    delete_custom_role, get_delegation, preview_role_change, set_delegation, update_custom_role,
)
from .access_directory import (
    list_users, sync_directory,
)
from .access_roles import (
    list_roles,
)

# the parts that declare routes, in the old route order (a test that walks this router's routes walks these)
PARTS = (access_directory.router, access_roles.router, access_bindings.router, access_audit.router, access_custom_roles.router)
router = APIRouter()
for _part in PARTS:
    router.include_router(_part)

__all__ = [
    "BindingBody", "CustomRoleBody", "CustomRolePatch", "DEFAULT_DELEGABLE", "DELEGATION_RULES", "DelegationBody", "LOCAL_DENY_HE",
    "LOCAL_ONE_BINDING_HE", "LOCAL_ROLE_HE", "NEVER_DELEGABLE", "PARTS", "PERMISSION_LABELS", "PreviewBody", "ROLE_PERMISSIONS_MAX",
    "ROLE_SENSITIVE_MAX", "RolePreviewBody", "SCOPE_TABLES", "SENSITIVE", "STALE_S", "SYSTEM_PERMISSIONS", "_active_bindings_sql", "_binding_dict",
    "_binding_summary", "_check_delegable_flag", "_custom_role_dict", "_delegated_directory", "_ensure_user_row", "_group_members",
    "_invalidate_links_on_admin_role", "_principal_of", "_refuse", "_rid", "_role_impact", "_scope_exists", "_subject_name", "_sync_status",
    "_terminate", "_user_bindings", "_users", "_validate_role_body", "active_user_ids", "admin_count", "affected_users", "assign_scopes",
    "assigns_anywhere", "check_delegation", "create_binding", "create_custom_role", "delegable_roles", "delegated_group_problem", "delegated_sees",
    "delegation_block", "delete_custom_role", "full_authority", "get_delegation", "group_reach_problem", "in_reach", "insert_binding", "is_member",
    "keep_an_admin", "list_audit", "list_bindings", "list_roles", "list_users", "local_binding_check", "pb", "preview", "preview_role_change",
    "rendered_labels", "revoke_binding", "revoke_one", "router", "scope_in_reach", "set_delegation", "sync_directory", "touch_group",
    "update_custom_role", "user_known", "validate_binding",
]
