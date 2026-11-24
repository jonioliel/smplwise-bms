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
    """`DELETE /auth/second-factor/users/{id}`: `removed` = a factor (active or pending) was there."""
    user_id: str
    removed: bool


class StepUpStatus(WireModel):
    """`GET /auth/step-up` (MFA-STEPUP-TRAIN-2490): the switch, the window in minutes (0 = every action), whether the local channel is
    gated too, whether step-up applies to the caller (`reason` says why not: off | local_channel | bearer_token | no_method), the
    methods the caller can use and until when the current proof counts (null: none)."""
    enabled: bool
    minutes: int
    local_channel: bool
    applies: bool
    reason: Literal["off", "local_channel", "bearer_token", "no_method"] | None
    methods: list[Literal["totp", "device_key"]]  # MFA-DEVICEKEY-2490: an active phone key
    valid_until: str | None


class StepUpProof(WireModel):
    """`POST /auth/step-up/verify`: the proof was accepted; it counts until `valid_until` (one gated request when `minutes` is 0)."""
    method: Literal["totp", "device_key"]  # MFA-DEVICEKEY-2490
    minutes: int
    valid_until: str | None
