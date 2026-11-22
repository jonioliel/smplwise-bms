"""Response models of routers/app_refresh.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'DELETE /auth/app/devices/{device_id}/key-reset', 'DELETE /auth/app/families/{family_id}', 'POST /auth/app/sign-out'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /auth/app/session/redeem'})


class AppRefreshIssueDeviceKey(ExactModel):
    bound: bool
    alg: str = None


class AppRefreshIssueAttestation(ExactModel):
    mode: str
    status: str
    level: str | None
    enforced: bool


class AppRefreshIssue(ExactModel):
    family_id: str
    token_type: str
    refresh_token: str
    refresh_expires_at: str
    absolute_expires_at: str
    access_token: str
    access_expires_at: str
    expires_in: Num
    device_key: AppRefreshIssueDeviceKey
    proof_required: bool
    attestation: AppRefreshIssueAttestation = None


class AppRefreshRefresh(ExactModel):
    family_id: str
    token_type: str
    refresh_token: str
    refresh_expires_at: str
    absolute_expires_at: str
    access_token: str
    access_expires_at: str
    expires_in: Num
    device_key: AppRefreshIssueDeviceKey
    proof_required: bool


class AppRefreshRefreshChallenge(ExactModel):
    """APPREFRESH2: a single-use nonce (NONCE_TTL_S) for the next device-key proof of this device's family."""
    nonce: str
    expires_in: Num
    expires_at: str
    server_time: Num


class AppRefreshWhoami(ExactModel):
    user_id: str
    device_id: str
    family_id: str
    expires_at: str


class AppRefreshSessionExchange(ExactModel):
    """The exchange (spec section 5): authenticated by the bearer access token ONLY - the route never reads, touches, rotates or ends a cookie (review S-06; a POST carrying the session cookie without its origin never gets here: the channel answers"""
    code: str
    expires_in: Num
    expires_at: str
    redeem_path: str


class AppRefreshFamiliesFamily(ExactModel):
    family_id: str
    device_id: str
    device_name: str
    platform: str
    channel: str
    created_at: str
    last_used_at: str
    idle_expires_at: str
    absolute_expires_at: str
    admin_capped: bool
    device_key_bound: bool


class AppRefreshFamilies(ExactModel):
    families: list[AppRefreshFamiliesFamily]
    enabled: bool


class AppRefreshEndFamilies(ExactModel):
    families_ended: Num


class AppRefreshDeviceKey(ExactModel):
    """The device's pinned key status (never the key; a 16-hex fingerprint prefix): its user, or system.configure."""
    device_id: str
    pinned: bool
    alg: str
    key_fp: str
    bound_at: str
    sign_in_live: bool
    reset_pending: bool
    reset_expires_at: str | None
    reset_approved_at: str | None


class AppRefreshDeviceAttestation(ExactModel):
    """ATTEST232: the last hardware-attestation verdict of the device (never the chain): its user, or system.configure."""
    device_id: str
    checked: bool
    status: str = None
    level: str = None
    format: str = None
    key_fp: str = None
    mode: str = None
    reason: Any = None
    checked_at: str = None


class AppRefreshApproveKeyReset(ExactModel):
    """A system administrator approves a device-key reset (the lost-key path): audited, the user notified, the old sign-in ended."""
    device_id: str
    reset_expires_at: str
    families_ended: Num
    user_notified: bool


class AppRefreshSettings(ExactModel):
    settings: dict[str, Any]


class AppRefreshPutSettings(ExactModel):
    settings: dict[str, Any]
    families_ended: Num
