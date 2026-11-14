"""Fresh HA human identity evidence for capture, without an Arx RBAC decision.

Only an original authenticated HA principal may bind its own HA user id here.
An external Arx id, a pairing MAC and a Supervisor read principal do not provide
that binding. Arx authorization remains a separate trusted source obligation.
No users, tokens, credentials or keys are provisioned by this module.
"""

from __future__ import annotations

import weakref
from dataclasses import dataclass

from homeassistant.auth import AuthManager
from homeassistant.auth.auth_store import AuthStore
from homeassistant.auth.models import (
    TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN,
    TOKEN_TYPE_NORMAL,
    Credentials,
    RefreshToken,
    User,
)
from homeassistant.auth.providers import AuthProvider
from homeassistant.core import HomeAssistant

from .bridge_transport_origin import bind_origin, check_origin
from .source_bindings import same_ports
from .validation import Refusal

MAX_IDENTITIES = 128
MAX_CREDENTIALS = 32
_SOURCES = weakref.WeakKeyDictionary()
_IDENTITIES = weakref.WeakKeyDictionary()


def _same_current(left, right):
    return all(left[index] is right[index] for index in range(5)) and left[5] == right[5]


@dataclass(frozen=True, eq=False, repr=False)
class HAActorIdentity:
    """Source-owned classification, never an execution or permission grant."""

    actor_id: str
    ha_user_id: str
    principal_kind: str


class CaptureHAActorSource:
    """Classify an authenticated HA actor from the current native auth source."""

    def __init__(self, hass: HomeAssistant):
        auth = getattr(hass, "auth", None)
        store = getattr(auth, "_store", None)
        users = getattr(store, "_users", None)
        providers = getattr(auth, "_providers", None)
        if (
            type(hass) is not HomeAssistant
            or type(auth) is not AuthManager
            or type(store) is not AuthStore
            or type(users) is not dict
            or not isinstance(providers, dict)
        ):
            raise ValueError("loaded original Home Assistant auth source required")
        _SOURCES[self] = (
            hass,
            auth,
            store,
            users,
            providers,
            (
                auth.async_get_user,
                auth.async_get_user_by_credentials,
                auth.get_auth_provider,
            ),
            weakref.WeakSet(),
        )

    def _owner(self):
        owner = _SOURCES.get(self)
        if owner is None:
            raise Refusal("binding_denied")
        hass, auth, store, users, providers, ports, _issued = owner
        if (
            hass.auth is not auth
            or auth._store is not store
            or store._users is not users
            or auth._providers is not providers
            or not same_ports(
                ports,
                (
                    auth.async_get_user,
                    auth.async_get_user_by_credentials,
                    auth.get_auth_provider,
                ),
            )
        ):
            raise Refusal("binding_denied")
        return owner

    def _current(self, origin, actor_id):
        owner = CaptureHAActorSource._owner(self)
        user, user_id, token_id, origin_kind = check_origin(origin)
        if (
            type(actor_id) is not str
            or actor_id != user_id
            or type(user) is not User
            or getattr(user, "is_active", None) is not True
            or getattr(user, "system_generated", None) is not False
            or origin_kind not in {"ha_websocket", "ha_http"}
            or owner[3].get(user_id) is not user
            or type(user.credentials) is not list
            or not 1 <= len(user.credentials) <= MAX_CREDENTIALS
            or type(user.refresh_tokens) is not dict
        ):
            raise Refusal("binding_denied")
        token = user.refresh_tokens.get(token_id)
        if (
            type(token) is not RefreshToken
            or token.id != token_id
            or token.user is not user
            or token.token_type not in {TOKEN_TYPE_NORMAL, TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN}
        ):
            raise Refusal("binding_denied")
        credential = token.credential
        if (
            type(credential) is not Credentials
            or credential.is_new is not False
            or not any(item is credential for item in user.credentials)
            or type(credential.auth_provider_type) is not str
            or not 1 <= len(credential.auth_provider_type) <= 128
            or credential.auth_provider_id is not None
            and (
                type(credential.auth_provider_id) is not str
                or not 1 <= len(credential.auth_provider_id) <= 128
            )
        ):
            raise Refusal("binding_denied")
        key = (credential.auth_provider_type, credential.auth_provider_id)
        provider = owner[5][2](*key)
        if (
            not isinstance(provider, AuthProvider)
            or owner[4].get(key) is not provider
            or provider.hass is not owner[0]
            or provider.store is not owner[2]
            or (provider.type, provider.id) != key
        ):
            raise Refusal("binding_denied")
        # Provider properties and the original provider port may execute code.
        # Recheck the original auth roots and principal after the last callback.
        fresh_user, fresh_id, fresh_token, _fresh_kind = check_origin(origin)
        if (
            CaptureHAActorSource._owner(self) is not owner
            or fresh_user is not user
            or fresh_id != user_id
            or fresh_token != token_id
            or user.is_active is not True
            or getattr(user, "system_generated", None) is not False
            or type(user.credentials) is not list
            or not 1 <= len(user.credentials) <= MAX_CREDENTIALS
            or type(user.refresh_tokens) is not dict
            or user.refresh_tokens.get(token_id) is not token
            or token.id != token_id
            or token.user is not user
            or token.token_type not in {TOKEN_TYPE_NORMAL, TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN}
            or token.credential is not credential
            or credential.is_new is not False
            or not any(item is credential for item in user.credentials)
            or (credential.auth_provider_type, credential.auth_provider_id) != key
            or owner[4].get(key) is not provider
        ):
            raise Refusal("binding_denied")
        return owner, user, token, credential, provider, key

    async def classify(self, connection, actor_id: str) -> HAActorIdentity:
        """Require the actor's own existing authenticated HA principal binding."""
        owner = CaptureHAActorSource._owner(self)
        origin = bind_origin(owner[0], connection)
        current = CaptureHAActorSource._current(self, origin, actor_id)
        actual = await owner[5][0](actor_id)
        if (
            not _same_current(CaptureHAActorSource._current(self, origin, actor_id), current)
            or actual is not current[1]
        ):
            raise Refusal("binding_denied")
        by_credential = await owner[5][1](current[3])
        if (
            not _same_current(CaptureHAActorSource._current(self, origin, actor_id), current)
            or by_credential is not current[1]
            or len(owner[6]) >= MAX_IDENTITIES
        ):
            raise Refusal("binding_denied")
        result = HAActorIdentity(actor_id, actor_id, "ha_human")
        _IDENTITIES[result] = (weakref.ref(self), owner, origin, current, actor_id)
        owner[6].add(result)
        CaptureHAActorSource.check(self, result)
        return result

    def check(self, identity: HAActorIdentity) -> None:
        record = _IDENTITIES.get(identity) if type(identity) is HAActorIdentity else None
        if (
            record is None
            or record[0]() is not self
            or CaptureHAActorSource._owner(self) is not record[1]
            or identity.actor_id != record[4]
            or identity.ha_user_id != record[4]
            or identity.principal_kind != "ha_human"
            or not _same_current(
                CaptureHAActorSource._current(self, record[2], record[4]), record[3]
            )
        ):
            raise Refusal("binding_denied")

    async def refresh(self, identity: HAActorIdentity) -> None:
        CaptureHAActorSource.check(self, identity)
        record = _IDENTITIES[identity]
        user = await record[1][5][0](record[4])
        CaptureHAActorSource.check(self, identity)
        if user is not record[3][1]:
            raise Refusal("binding_denied")
        by_credential = await record[1][5][1](record[3][3])
        CaptureHAActorSource.check(self, identity)
        if by_credential is not user:
            raise Refusal("binding_denied")

    def close(self) -> None:
        """Retire this source and all results without touching HA identities."""
        _SOURCES.pop(self, None)
