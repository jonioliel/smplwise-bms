"""Response models of the TOTP second factor (routers/second_factor.py, `/api/v1/auth/second-factor...`; CR-011 K11, TFA2). The
shapes come from services/second_factor (`status`, `begin_enrolment`, `enrolled_users`, `overrides`); never a secret except the
enrolment answer, which is the one time the secret leaves the server."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

Policy = Literal["optional", "admins"]


class FactorStatus(WireModel):
    """The caller's own factor: whether it is active, when it was enabled and last used (null while it is not active)."""
    enabled: bool
    enabled_at: str | None
    last_used_at: str | None


class FactorEnabled(FactorStatus):
    """`POST /auth/second-factor/confirm`: the factor is on; `recovery_codes` is the first batch of one-time recovery codes
    (`XXXX-XXXX`, MFA-RECOVERY-CODES-2490) - shown in this answer ONCE and never readable again."""
    recovery_codes: list[str]


class OwnFactor(FactorStatus):
    """`GET /auth/second-factor`: the status and the installation's policy."""
    policy: Policy


class Enrolment(WireModel):
    """A fresh secret (base32, no padding), the otpauth URI for the authenticator app and the issuer name; not active until confirmed."""
    secret: str
    otpauth_uri: str
    issuer: str


class EnrolledUser(WireModel):
    user_id: str
    enabled_at: str | None
    last_used_at: str | None


class EnrolledUsers(WireModel):
    policy: Policy
    users: list[EnrolledUser]
    """Every user with an active factor, by user id."""


class Overrides(WireModel):
    """The per-user and per-role policy overrides (subject id -> stored policy); a subject without a row inherits."""
    policy: Policy
    user: dict[str, str]
    role: dict[str, str]


class OverrideSet(WireModel):
    """`PUT /auth/second-factor/overrides/{kind}/{id}`: the change and every override after it."""
    kind: Literal["user", "role"]
    subject_id: str
    policy: Literal["inherit", "optional", "required"]
    user: dict[str, str]
    role: dict[str, str]


class FactorReset(WireModel):
    """`DELETE /auth/second-factor/users/{id}`: `removed` = a factor (active or pending) was there. MFA-SECFIX-2500 SR-2: every factor
    kind goes - `totp` (the authenticator code was removed), how many `passkeys` were deleted, `device_keys` (phone keys) revoked and
    `recovery_codes` deleted."""
    user_id: str
    removed: bool
    totp: bool
    passkeys: int
    device_keys: int
    recovery_codes: int


class StepUpStatus(WireModel):
    """`GET /auth/step-up` (MFA-STEPUP-TRAIN-2490): the switch, the window in minutes (0 = every action), whether the local channel is
    gated too, whether step-up applies to the caller (`reason` says why not: off | local_channel | bearer_token | no_method), the
    methods the caller can use and until when the current proof counts (null: none)."""
    enabled: bool
    minutes: int
    local_channel: bool
    applies: bool
    reason: Literal["off", "local_channel", "bearer_token", "no_method"] | None
    methods: list[Literal["totp", "passkey", "device_key"]]  # MFA-PASSKEYS-2490: a passkey that counts; MFA-DEVICEKEY-2490: an active phone key
    valid_until: str | None


class StepUpProof(WireModel):
    """`POST /auth/step-up/verify`: the proof was accepted; it counts until `valid_until` (one gated request when `minutes` is 0).
    `recovery_code`: a one-time recovery code was spent for it (MFA-RECOVERY-CODES-2490)."""
    method: Literal["totp", "passkey", "recovery_code", "device_key"]  # MFA-PASSKEYS-2490, MFA-RECOVERY-CODES-2490, MFA-DEVICEKEY-2490
    minutes: int
    valid_until: str | None


class RecoveryStatus(WireModel):
    """`GET /auth/recovery-codes` (MFA-RECOVERY-CODES-2490): `available` = the authenticator factor is on (codes exist only with it);
    how many codes remain of the batch's `total`, when the batch was made and a code last used, and `low` = at most `low_at` remain.
    Never a code or a hash."""
    available: bool
    remaining: int
    total: int
    created_at: str | None
    last_used_at: str | None
    low: bool
    low_at: int


class RecoveryBatch(WireModel):
    """`POST /auth/recovery-codes`: the new batch (`XXXX-XXXX`), shown in this answer ONCE; the previous batch no longer works."""
    codes: list[str]
    remaining: int
    total: int
    created_at: str | None
    last_used_at: str | None
    low: bool
    low_at: int
