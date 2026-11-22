"""Response models of who the caller is (routers/me.py: `GET /api/v1/me`, `GET|PUT /api/v1/me/prefs`). Field order is the order the
router builds its dicts in: the keys only some callers get (`**extra`) come first. Blocks other modules build and own pass through
as documents (`Any` / `dict[str, Any]`): the brand view (services/brand_assets.full_view), the presence gate (services/presence.gate_for), the capabilities (capabilities.as_dict), the
remote.* settings, and each preference value (services/user_prefs validators)."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel
from .home_interface import HomePolicy

# every route answers JSON (the /me/ws socket is not an HTTP route of the table)
NO_JSON: frozenset[str] = frozenset()


class MeReadiness(WireModel):
    """CR-READY96: the last recorded readiness score (services/readiness.chip)."""
    score: int
    level: str
    at: str


class MeLocalIdentity(WireModel):
    """USR2: what the shell needs for an Arx-only identity."""
    admin_permissions: bool
    admin_permissions_blocked: bool
    second_factor_enrolled: bool
    gate: str | None
    must_change_password: bool
    reset_mode: str
    passkeys: int
    factor_enrolled: bool


class MeDemo(WireModel):
    """CR-READY96: the demo-mode banner (services/demo_mode.me_block); the details only while a demo runs."""
    active: bool
    dataset: str = None
    scenario: str = None
    started_at: str = None
    expires_at: str = None
    started_by_name: str = None


class MeModules(WireModel):
    """CR-038 section 6: the optional modules' switches and the tickets module's display name per language (tickets/naming)."""
    notices: bool
    tickets: bool
    tickets_name: dict[str, Any]
    tickets_long_press: Literal["sheet", "menu"]
    incidents: bool
    announce: bool


class MeWall(WireModel):
    """CR-030: an enabled wall profile (services/wall.me_block); null without one."""
    enabled: bool
    profile_version: int
    desktop: bool
    foldable_open: str


class MeUser(WireModel):
    id: str
    username: str
    display_name: str
    source: str
    """`ingress` | `dev` | `bearer` | `local` (an Arx-only identity) ... - the principal's source."""


class MeBinding(WireModel):
    """An active binding of the caller (rbac.bindings_of)."""
    id: str
    subject_kind: Literal["user", "group"]
    role_id: str
    role_name: str
    scope_type: str
    scope_id: str
    scope_name: str
    effect: Literal["allow", "deny"]
    permission_revision: int


class Me(WireModel):
    connection_pending_restart: bool = None
    """CR-022 / CR-024: system.configure holders only."""
    readiness: MeReadiness | None = None
    """CR-READY96: system.configure holders only; null until the first check."""
    presence_gate: Any = None
    """CR-027: present once a required-sensors policy was ever written (null when it applies to nobody)."""
    local_identity: MeLocalIdentity = None
    """USR2: an Arx-only identity only."""
    demo: MeDemo
    modules: MeModules
    interface: HomePolicy | None
    """HOME-SIMPLE-2420: the home interface policy, or null (an add-on whose migration has not run)."""
    wall: MeWall | None
    channel: Literal["local", "remote"]
    remote: dict[str, Any] | None
    """CR-008: the remote.* settings the Arx client needs; null outside the remote channel."""
    brand: dict[str, Any]
    user: MeUser
    active: bool
    bindings: list[MeBinding]
    permissions_installation: list[str]
    permissions_any: list[str]
    has_access: bool
    permission_revision: int
    permissions_fingerprint: str
    permissions_changed: bool
    bootstrap_state: str
    mode: Literal["full", "ha_only"]
    capabilities: dict[str, Any]


class MyPrefs(WireModel):
    """CR-013: every known preference key with its value (stored or default), the keys the user set, and when they last changed one."""
    prefs: dict[str, Any]
    stored: list[str]
    updated_at: str | None
