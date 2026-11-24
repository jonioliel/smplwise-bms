"""Response models of the Arx (local) identity API (routers/local_identity.py: `/api/v1/auth/local/...`, `/api/v1/auth/sessions/{id}`,
`/api/v1/identity/local-users...`; USR2). No password, hash, token secret or full phone number is
ever answered: a link's `path` carries the one-time token in its fragment (shown once to the administrator), a WhatsApp number only as
its last two digits. Field order is the order the router builds its dicts in.

The two sign-in routes answer with their own JSONResponse (they set cookies); their models document the answer (FastAPI does not
validate a returned Response) and `tests/test_wire_local_identity_2450.py` fits their real bodies strictly."""
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Discriminator, Tag

from . import WireModel

# routes without a JSON body: the CSV export
NO_JSON = frozenset({"GET /identity/local-users/export"})

LocalUserStatus = Literal["deleted", "disabled", "pending_first_login", "delayed", "active"]


# ---------------------------------------------------------------- the sign-in (public)

class LocalSignInUser(WireModel):
    id: str
    username: str
    display_name: str
    source: Literal["local"]


class LocalSignInSession(WireModel):
    """A signed-in answer (the session cookie is set): the user, whether a second factor must still be enrolled, whether the password
    must be changed now, and the session's lifetime in seconds."""
    user: LocalSignInUser
    second_factor: Literal["none", "required", "enroll_required"]
    must_change_password: bool
    session_expires_in: int


class LocalSignInPending(WireModel):
    """202: the password was right and a second factor is required (the pending cookie is set). `methods` only when a passkey can answer
    the step."""
    second_factor: Literal["required"]
    methods: list[Literal["totp", "passkey"]] = None


class LocalMustEnrol(WireModel):
    """`set-password` (a link used) and `reset/confirm`: the password is set; `must_enrol` = a second factor must be enrolled at the
    next sign-in. No session is created."""
    must_enrol: bool


class LocalResetRequested(WireModel):
    """`reset/request`: always the same 202, whatever the name."""
    accepted: bool
    user_message: str
    expires_in_s: int
    resend_after_s: int


class LocalPasswordChanged(WireModel):
    """`PUT /auth/local/password`: the caller's other sessions ended."""
    other_sessions_ended: int


class LocalSessionLabel(WireModel):
    id: str
    label: str | None


# ---------------------------------------------------------------- administration

class LocalUserWhatsapp(WireModel):
    """Whether the user's WhatsApp number counts as verified; `masked` = its last two digits."""
    verified: bool
    masked: str | None


class LocalUser(WireModel):
    """One Arx user (routers/local_identity._user_dict): the credential summary, the role binding (null without one), the number of live
    sessions and passkeys. `self_service_blocked`: why a self-service reset would be refused now (`admin_target`, `no_verified_number`)."""
    passkeys: int
    passkey_first: bool
    passkey_only: bool
    id: str
    username: str
    display_name: str
    email: str | None
    notes: str | None
    status: LocalUserStatus
    active: bool
    created_at: str
    created_by: str | None
    last_sign_in_at: str | None
    last_sign_in_from: str | None
    role_id: str | None
    role_name: str | None
    scope_type: str | None
    scope_id: str | None
    scope_name: str | None
    binding_id: str | None
    admin: bool
    second_factor: bool
    reset_mode: Literal["manager_only", "self_service"]
    must_change_password: bool
    sessions: int
    ha_user_id: str | None
    whatsapp: LocalUserWhatsapp
    self_service_blocked: Literal["admin_target", "no_verified_number"] | None


class LocalUserSuggest(WireModel):
    """Owner answer Q7: the linked home-system user, only SUGGESTED for the same change."""
    ha_user_id: str
    active: bool


class LocalUserPatched(LocalUser):
    """`PATCH`: the user; `suggest_also` when the active switch changed and a home-system user is linked."""
    suggest_also: LocalUserSuggest = None


class LocalUserPasswordSet(LocalUser):
    """`PUT .../password` (set by the administrator): the user plus what ended."""
    sessions_ended: int
    links_invalidated: int


class LocalUserList(WireModel):
    """`GET /identity/local-users`: the users and what the tab offers."""
    enabled: bool
    can_manage: bool
    channel: Literal["remote", "local"]
    users: list[LocalUser]
    whatsapp_ready: bool
    public_url: str | None
    passkey_first_allowed: bool
    password_min: int
    can_switch: bool


class LocalLink(WireModel):
    """A link shown to the administrator: `path` (the token is in its fragment), `url` only on the remote channel (null when the request
    named no host)."""
    purpose: Literal["first_login", "reset"]
    path: str
    expires_at: str
    url: str | None = None


class LocalLinkQueued(WireModel):
    """A link sent to the user's verified WhatsApp number (never shown, never returned)."""
    purpose: Literal["first_login", "reset"]
    via: Literal["whatsapp"]
    expires_at: str
    queued: bool


class LocalUserCreated(WireModel):
    """`POST /identity/local-users`: the user, whether the administrator set the password, and the first-login link (null when a
    password was set)."""
    user: LocalUser
    password_set: bool
    link: LocalLink | None


def _link_kind(v: Any) -> str:
    """A queued link is the one with `via` (the WhatsApp channel); the shown link has `path`. Telling them apart first keeps the model
    that does not fit from logging a drift for a correct answer (NOTICE-WIRE-DRIFT-2490)."""
    return "queued" if (v.get("via") if isinstance(v, dict) else getattr(v, "via", None)) is not None else "shown"


class LocalUserLink(WireModel):
    user_id: str
    link: Annotated[Annotated[LocalLink, Tag("shown")] | Annotated[LocalLinkQueued, Tag("queued")], Discriminator(_link_kind)]


class LocalUserDeleted(WireModel):
    id: str
    deleted_at: str
    sessions_ended: int
    links_invalidated: int
    device_tokens_revoked: int
    bindings_revoked: int


class LocalUserSessionsRevoked(WireModel):
    user_id: str
    sessions_ended: int
    device_tokens_revoked: int
