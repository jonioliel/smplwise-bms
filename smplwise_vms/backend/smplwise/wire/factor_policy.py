"""Response models of the sign-in factor policy (routers/factor_policy.py, `/api/v1/security/factor-policy...`; MFA-POLICY-2490, design
docs/design/full-2fa-t095/DESIGN.md 7). The shapes come from services/factor_policy (`status`, `overrides`, `compliance`); names and
ids only - never a secret, a code or a token."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

Policy = Literal["optional", "admins", "sensitive", "all"]
SignIn = Literal["required", "optional", "exempt"]


class LegacyRules(WireModel):
    """The rules that act in every mode, unchanged (`security.second_factor_policy`, `remote.require_mfa_admin`)."""
    second_factor_policy: Literal["optional", "admins"]
    require_mfa_admin: bool


class Person(WireModel):
    """One person of the compliance view: who, Arx-only (`local`) or Home Assistant (`ha`), why the policy covers / exempts them
    (`user` / `role` / `global` / `wall` / `service`) and the factor they have (`totp` / `passkey` / `ha_mfa`, null = none)."""
    user_id: str
    name: str
    kind: Literal["ha", "local"]
    reason: str
    factor: str | None


class Compliance(WireModel):
    """Counts for the stored global policy or the previewed one (`?policy=`): everyone, covered (required), with a factor, missing
    one (would have to enrol at the next remote sign-in once enforced) and exempt; the lists are capped at 500 entries."""
    policy: Policy
    users_total: int
    covered: int
    enrolled: int
    missing_count: int
    missing: list[Person]
    exempt_count: int
    exempt: list[Person]
    ha_mfa_seen: int
    legacy_required: int


class FactorPolicy(WireModel):
    """`GET /security/factor-policy`: the settings, the legacy rules, the overrides and the compliance view."""
    policy: Policy
    mode: Literal["report", "enforce"]
    enforced: bool
    wall_exempt: bool
    long_lived_tokens: Literal["allow", "refuse_under_policy", "refuse"]
    legacy: LegacyRules
    overrides: dict[str, dict[str, str]]
    compliance: Compliance


class OverrideSet(WireModel):
    """`PUT /security/factor-policy/overrides/{kind}/{id}`: the change and every override after it."""
    kind: Literal["user", "role"]
    subject_id: str
    sign_in: Literal["inherit", "required", "optional", "exempt"]
    overrides: dict[str, dict[str, str]]
