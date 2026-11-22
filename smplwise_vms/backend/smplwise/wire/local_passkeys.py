"""Response models of the local passkeys (routers/local_passkeys.py; USR2 phase 4): the caller's own passkeys under
`/api/v1/auth/passkeys...`, an administrator's view under `/api/v1/identity/local-users/{id}/passkey...`, and the public WebAuthn steps
under `/api/v1/auth/local/...`. The shapes come from services/local_passkeys (`summary`, `view`, `registration_options`, `register`,
`remove`, the assertion options). The four public routes answer their own JSONResponse (cookies, rate limits): their models document
the answer and `tests/test_wire_local_passkeys_2470.py` checks the bodies; the two sign-in answers are wire/local_identity's
`LocalSignInSession`."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

UserVerification = Literal["required", "preferred"]


class Passkey(WireModel):
    """One passkey as the lists show it (services/local_passkeys.view): never the credential id or the public key. `usable` = it counts
    as a factor (made for the current RP id; for an administrative user, registered with user verification)."""
    id: str
    label: str | None
    created_at: str
    last_used_at: str | None
    synced: bool
    backed_up: bool
    transports: list[str]
    usable: bool
    user_verifying: bool


class PasskeySummary(WireModel):
    """A user's passkeys and modes (services/local_passkeys.summary). `available` = an RP id / public address is configured; `first_allowed`
    = the owner switch for passkey-first sign-in; `only_effective` = passkeys-only is on AND can be used now."""
    available: bool
    rp_id: str | None
    origin: str | None
    first_allowed: bool
    first_on: bool
    only_on: bool
    only_effective: bool
    credentials: list[Passkey]


class OwnPasskeys(PasskeySummary):
    """`GET /auth/passkeys`: the summary, whether the session counts as a fresh sign-in (and for how many more seconds) and whether a
    TOTP factor is enrolled."""
    recent_auth: bool
    recent_auth_left_s: int
    totp: bool


class RelyingParty(WireModel):
    id: str
    name: str


class PasskeyUserEntity(WireModel):
    id: str
    name: str
    displayName: str


class CredentialParam(WireModel):
    type: Literal["public-key"]
    alg: int


class AuthenticatorSelection(WireModel):
    residentKey: Literal["required"]
    requireResidentKey: bool
    userVerification: UserVerification


class CredentialDescriptor(WireModel):
    """`transports` only when the credential recorded some."""
    type: Literal["public-key"]
    id: str
    transports: list[str] = None


class CreationOptions(WireModel):
    """PublicKeyCredentialCreationOptions (JSON form) for `navigator.credentials.create`."""
    rp: RelyingParty
    user: PasskeyUserEntity
    challenge: str
    pubKeyCredParams: list[CredentialParam]
    timeout: int
    attestation: Literal["none"]
    authenticatorSelection: AuthenticatorSelection
    excludeCredentials: list[CredentialDescriptor]


class RegistrationOptions(WireModel):
    publicKey: CreationOptions
    user_verification_required: bool


class RequestOptions(WireModel):
    """PublicKeyCredentialRequestOptions (JSON form) for `navigator.credentials.get`; passwordless: `allowCredentials` is empty and user
    verification is required."""
    challenge: str
    rpId: str
    timeout: int
    userVerification: UserVerification
    allowCredentials: list[CredentialDescriptor]


class AssertionOptions(WireModel):
    """The public options routes (the second sign-in step, passwordless sign-in)."""
    publicKey: RequestOptions


class PasskeyRegistered(WireModel):
    """`POST /auth/passkeys/register` (201): the new passkey; `first_factor` = it is the user's first factor (other sessions ended)."""
    passkey: Passkey
    first_factor: bool
    other_sessions_ended: int


# The three answers below spread a dict in front of the summary (`{**out, **summary}`): the fields are written out so the model keeps the
# route's key order (a subclass would put the summary first).
class PasskeyRemoved(WireModel):
    """`DELETE /auth/passkeys/{id}`: what the removal did (services/local_passkeys.remove), then the summary after it."""
    removed: str
    sessions_ended: int
    passkey_first: bool
    factor_cleared: bool
    available: bool
    rp_id: str | None
    origin: str | None
    first_allowed: bool
    first_on: bool
    only_on: bool
    only_effective: bool
    credentials: list[Passkey]


class UserPasskeys(WireModel):
    """An administrator's view of a local user's passkeys (and the answer of the passkeys-only switch): the user id, then the summary."""
    user_id: str
    available: bool
    rp_id: str | None
    origin: str | None
    first_allowed: bool
    first_on: bool
    only_on: bool
    only_effective: bool
    credentials: list[Passkey]


class UserPasskeyRemoved(WireModel):
    """`DELETE /identity/local-users/{id}/passkeys/{pk_id}`: the user id, what the removal did, then the summary."""
    user_id: str
    removed: str
    sessions_ended: int
    passkey_first: bool
    factor_cleared: bool
    available: bool
    rp_id: str | None
    origin: str | None
    first_allowed: bool
    first_on: bool
    only_on: bool
    only_effective: bool
    credentials: list[Passkey]
