"""Response models of the user directory (routers/access_directory.py: `GET /api/v1/identity/users`, `POST /api/v1/identity/sync`).
Field order is the order the router and services/rbac_admin build their dicts in."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel
from .access_groups import AccessGroupBinding, AccessGroupMember

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

ScopeType = Literal["installation", "site", "building", "floor", "camera", "access_control_station"]


class DirectoryUser(WireModel):
    """One person (services/rbac_admin._users): the HA directory row and the add-on's own user row merged. A delegated administrator
    (`_delegated_directory`) gets the same keys with the directory details blanked (`username` "", `is_admin` false, the times null,
    the remote fields off) and only the groups and bindings inside their reach."""
    id: str
    name: str
    username: str
    is_admin: bool
    active: bool
    source: Literal["local", "both", "ha_directory", "vms"]
    """`local` = an Arx-only identity (USR2); `both` = in the HA directory and seen by the add-on."""
    sync_status: Literal["verified", "stale", "removed", "dev", "unavailable", "unknown"]
    synced_at: str | None
    first_seen_at: str | None
    last_seen_at: str | None
    groups: list[AccessGroupMember]
    bindings: list[AccessGroupBinding]
    """Own bindings, then each group's (`via_group` = the group's name)."""
    is_self: bool
    remote_access: bool
    remote_access_basis: Literal["local", "flag", "admin_default"] | None
    remote_admin_default: bool
    remote_last_sign_in: str | None
    remote_sessions: int


class DirectoryState(WireModel):
    paired: bool
    last_directory_at: str | None
    """Always null for a delegated administrator."""
    users: int


class AssignScope(WireModel):
    """A scope node where the caller holds rbac.assign, with the path name the scope picker shows (services/rbac_admin.assign_scopes)."""
    type: ScopeType
    id: str
    name: str


class Directory(WireModel):
    users: list[DirectoryUser]
    directory: DirectoryState
    revision: int
    can_assign: bool
    delegated: bool
    assign_scopes: list[AssignScope]
    assignable_roles: list[str]
    remote_policy: str = None
    """`flag` | `any_role` (setting remote.policy); absent for a delegated administrator."""


class DirectorySync(WireModel):
    """`POST /identity/sync`: `requested` true with the bridge's `result`, or false with a `note` and the `error` code when the installed
    integration has no sync service yet."""
    requested: bool
    note: str = None
    error: str = None
    result: Any = None
