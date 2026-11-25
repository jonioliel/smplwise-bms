"""Response model of one user's second factors as an administrator sees them (routers/user_factors.py,
`/api/v1/security/user-factors/{user_id}`; MFA-SCREENS-2510, the user drawer of Users & permissions). Counts, dates and verdicts only -
never a secret, a credential id, a key, a code or a token."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class UserTotp(WireModel):
    """The authenticator code (TOTP): on or off, since when, last used."""
    enabled: bool
    enabled_at: str | None
    last_used_at: str | None


class UserRecovery(WireModel):
    """The one-time recovery codes: how many remain of the current batch (0 / 0 = no batch)."""
    remaining: int
    total: int
    low: bool


class UserPolicy(WireModel):
    """What the sign-in factor policy says for this user (`required` / `optional` / `exempt`), why (`user` / `role` / `global` /
    `wall` / `service`), and whether the policy is enforced or only reported."""
    sign_in: Literal["required", "optional", "exempt"]
    source: str
    enforced: bool


class UserFactors(WireModel):
    """`GET /security/user-factors/{user_id}`: the factors the user has - the authenticator code, passkeys (all / usable), phone keys
    (active / counting under the attestation mode), recovery codes, whether Home Assistant MFA was seen - and the policy's verdict."""
    user_id: str
    totp: UserTotp
    passkeys: int
    passkeys_usable: int
    device_keys: int
    device_keys_counting: int
    recovery: UserRecovery
    ha_mfa_seen: bool
    policy: UserPolicy
