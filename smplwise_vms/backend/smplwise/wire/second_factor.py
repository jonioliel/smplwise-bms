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
    """`GET /auth/second-factor`: the status and the installation's policy. MFA-RESET-HARDENING-2510: `must_enroll` = an administrator
    reset this account's factors and none was enrolled since; `must_enroll_enforced` = and the factor policy requires one, so the next
    remote sign-in goes to enrolment (the account screen asks the user to enrol again)."""
    policy: Policy
    must_enroll: bool
    must_enroll_enforced: bool


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
    must_enroll: list[str]
    """MFA-RESET-HARDENING-2510: the users whose factors an administrator reset and who have not enrolled one since."""


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
    # MFA-RESET-HARDENING-2510: the target's sign-ins ended (HA, Arx-only, phone app), the phone credentials ended (device token + push),
    # `must_enroll` (always true: the next sign-in enrols again when the policy requires a factor), the caller's resets left this hour
    sign_ins_ended: int
    device_credentials_ended: int
    must_enroll: bool
    resets_left: int


class ResetFactors(WireModel):
    """What a reset would remove now: the authenticator code (active or pending), passkeys, active phone keys, unused recovery codes."""
    totp: bool
    passkeys: int
    device_keys: int
    recovery_codes: int


class OnceStepUp(WireModel):
    """The once-action's step-up details (services/step_up.once_details): verify with this action, then send the request once."""
    action: str
    methods: list[Literal["totp", "passkey", "device_key"]]
    minutes: int
    once: bool
    verify_path: str


class FactorResetCheck(WireModel):
    """`GET /auth/second-factor/users/{id}/reset-check` (MFA-RESET-HARDENING-2510): the preflight of the reset for the dialog. `allowed`
    false names the first refusal the reset would meet (`reason`): `self` (the caller's own account - use `disable`), `user_unknown`,
    `local_only` (`security.factor_reset_channel` = local and this request is remote), `reauth` (MFA-FACTOR-HARDEN-2520: a remote
    request whose session signed in more than 5 minutes ago - sign in again), `last_admin` (the last system administrator who
    can sign in remotely), `rate_limited` (3 resets per administrator per hour). `confirm_text` = what to type into `confirm` (the
    username, else the user id). `remote` = this request came from outside. `must_enroll_after` = the user's factor policy requires a
    factor, so their next remote sign-in goes to enrolment. `step_up` = the once-action details (the administrator's own proof)."""
    user_id: str
    allowed: bool
    reason: Literal["self", "user_unknown", "local_only", "reauth", "last_admin", "rate_limited"] | None
    confirm_text: str
    channel: Literal["any", "local"]
    remote: bool
    resets_left: int
    rate_max: int
    factors: ResetFactors
    must_enroll_after: bool
    step_up: OnceStepUp


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
    # MFA-PASSKEYS-2490, MFA-RECOVERY-CODES-2490, MFA-DEVICEKEY-2490; MFA-T095-REST-2530: `push` (an approval on the phone) and `alarm_pin`
    # (the personal alarm code) - both prove ONE request of exactly the given action (`minutes` 0)
    method: Literal["totp", "passkey", "recovery_code", "device_key", "push", "alarm_pin"]
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
