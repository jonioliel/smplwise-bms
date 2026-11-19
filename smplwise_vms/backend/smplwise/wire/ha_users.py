"""Response models of the home-system users API (routers/ha_users.py, `/api/v1/ha-users...`; USR1, docs/design/USR1_HA_USERS_FROM_ARX.md).
Only the users Arx itself created are listed (table ha_managed_users). No password is ever answered. Field order is the order the router
builds its dicts in."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

HaUserState = Literal["creating", "active", "inactive", "needs_repair", "deleted"]


class HaUserRow(WireModel):
    """One managed user (routers/ha_users._row). `repair` names what needs fixing (compensation_failed, binding_failed, cleanup_failed,
    person_missing, missing_in_ha); `person` = a person record was created with the user."""
    ha_user_id: str | None
    username: str
    display_name: str
    role_id: str
    role_name: str
    scope_type: str
    scope_id: str
    scope_name: str
    state: HaUserState
    repair: str | None
    person: bool
    created_at: str
    created_by_name: str | None
    is_self: bool


class HaUserAccess(WireModel):
    """The last result of the administrator-token probe (`unknown` before the first one)."""
    state: str
    checked_at: str | None


class HaUserRoleRef(WireModel):
    id: str
    name: str


class HaUserScope(WireModel):
    type: Literal["installation", "site", "building", "floor"]
    id: str
    name: str


class HaUserPasswordRules(WireModel):
    min_length: int
    max_length: int


class HaUserList(WireModel):
    """`GET /ha-users`: the managed users and what the create form offers."""
    users: list[HaUserRow]
    can_manage: bool
    actor_ha_admin: bool
    transport: Literal["token", "supervisor", "none"]
    access: HaUserAccess
    roles: list[HaUserRoleRef]
    scopes: list[HaUserScope]
    password: HaUserPasswordRules
    limit: int


class HaUserCheck(WireModel):
    """`POST /ha-users/check`: the read-only token probe."""
    access: HaUserAccess
    transport: Literal["token", "supervisor", "none"]


class HaUserCreated(WireModel):
    """`POST /ha-users`: the created user; `replayed` when the same request key already created it."""
    user: HaUserRow
    replayed: bool


class HaUserOne(WireModel):
    """Activate / deactivate: the user after the change."""
    user: HaUserRow


class HaUserDeleted(WireModel):
    deleted: str
    already_gone: bool
