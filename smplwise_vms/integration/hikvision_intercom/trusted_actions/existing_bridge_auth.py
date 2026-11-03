"""Authenticate the installed SMPLWISE pairing protocol on a genuine HA socket.

This uses the existing integration's pairing material and its existing v1
canonical HMAC framing. It creates no HA user, key or Arx permission decision.
An authenticated transport result alone never grants an action or read scope.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import weakref
from dataclasses import dataclass
from datetime import UTC, datetime

from homeassistant.components.http import HomeAssistantRequest
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from .bridge_transport_origin import bind_origin, check_origin
from .envelope import ClockSample, freeze
from .source_bindings import same_ports
from .validation import Refusal

PAIRING_DOMAIN = "smplwise_bridge"
WIRE_FIELDS = frozenset({"ts", "nonce", "sig"})
MAX_SIGNED_BYTES = 1_048_576
MAX_ENTRIES = 16
MAX_NONCES = 65536
NONCE_WINDOW_SECONDS = 120
MAX_TS_SKEW_SECONDS = 60
_AUTH = weakref.WeakKeyDictionary()
_PROOFS = weakref.WeakKeyDictionary()
_RETAINED = weakref.WeakKeyDictionary()


class RetainedBridgeOrigin:
    """Original source binding for admitted native work; admits no new command."""

    __slots__ = ("__weakref__",)


@dataclass(frozen=True, repr=False)
class _RetainedOrigin:
    auth: object
    origin: object
    connection: object
    user: object
    user_id: str
    refresh: object
    entry: object
    data: object
    options: object
    material: object
    runtime: object


def canonical_body(body: dict) -> bytes:
    """Existing Arx canonical body, with strict JSON types before serialization."""

    def valid(value):
        if value is None or type(value) in {str, bool, int}:
            return
        if type(value) is list:
            for item in value:
                valid(item)
            return
        if type(value) is dict and all(type(key) is str for key in value):
            for item in value.values():
                valid(item)
            return
        raise Refusal("Unauthorized")

    try:
        valid(body)
        encoded = json.dumps(
            body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
        ).encode("utf-8")
    except (ValueError, UnicodeError, RecursionError):
        raise Refusal("Unauthorized") from None
    if len(encoded) > MAX_SIGNED_BYTES:
        raise Refusal("Unauthorized")
    return encoded


@dataclass(frozen=True, eq=False, repr=False)
class VerifiedBridgeTransport:
    body: object
    query_owner_id: str
    entry_id: str


class ExistingBridgeAuthenticator:
    """Actual loaded entry + actual HA auth user + existing pairing MAC."""

    def __init__(self, hass: HomeAssistant):
        if type(hass) is not HomeAssistant:
            raise ValueError("actual Home Assistant required")
        _AUTH[self] = (
            hass,
            hass.auth,
            hass.config_entries,
            hass.auth.async_get_user,
            {},
            [None],
            self.clock,
        )

    def _owner(self):
        owner = _AUTH.get(self)
        if owner is None:
            raise Refusal("Unauthorized")
        hass, auth, entries, get_user, _seen, _last, clock = owner
        if (
            hass.auth is not auth
            or hass.config_entries is not entries
            or not same_ports((get_user, clock), (auth.async_get_user, self.clock))
        ):
            raise Refusal("Unauthorized")
        return owner

    def clock(self) -> ClockSample:
        ExistingBridgeAuthenticator._owner(self)
        now = datetime.now(UTC)
        return ClockSample(now, now, True)

    def _now(self):
        owner = ExistingBridgeAuthenticator._owner(self)
        now = ExistingBridgeAuthenticator.clock(self).now
        if owner[5][0] is not None and now < owner[5][0]:
            raise Refusal("Unauthorized")
        owner[5][0] = now
        return now

    async def verify(
        self, message: dict, connection: ActiveConnection | HomeAssistantRequest
    ) -> VerifiedBridgeTransport:
        owner = ExistingBridgeAuthenticator._owner(self)
        hass, auth, entries, get_user, seen, _last, _clock = owner
        from .direct_bridge_origin import DirectBridgeConnection, bind_pairing_origin

        direct = type(connection) is DirectBridgeConnection
        if not direct:
            origin = bind_origin(hass, connection)
            user, original_id, refresh, _kind = check_origin(origin)
            actual = await get_user(original_id)
            if (
                ExistingBridgeAuthenticator._owner(self) is not owner
                or actual is not user
                or check_origin(origin)[0] is not user
            ):
                raise Refusal("Unauthorized")
        if type(message) is not dict or not WIRE_FIELDS <= set(message):
            raise Refusal("Unauthorized")
        ts, nonce, signature = (message[key] for key in ("ts", "nonce", "sig"))
        if (
            type(ts) is not int
            or not 1 <= ts <= 2**53 - 1
            or type(nonce) is not str
            or re.fullmatch("(?:[0-9a-f]{16}|[0-9a-f]{32})", nonce) is None
            or type(signature) is not str
            or re.fullmatch("[0-9a-f]{64}", signature) is None
        ):
            raise Refusal("Unauthorized")
        body = {key: value for key, value in message.items() if key not in WIRE_FIELDS}
        encoded = canonical_body(body)
        signed = f"{ts}.{nonce}.{hashlib.sha256(encoded).hexdigest()}".encode()
        candidates = entries.async_entries(PAIRING_DOMAIN)
        if not 1 <= len(candidates) <= MAX_ENTRIES:
            raise Refusal("Unauthorized")
        matches = []
        for entry in candidates:
            if entry.state is not ConfigEntryState.LOADED:
                continue
            data, options = entry.data, entry.options
            material = data.get("pairing_code")
            if type(material) is not str or not 1 <= len(material.encode()) <= 1024:
                continue
            expected = hmac.new(material.encode("utf-8"), signed, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, signature):
                matches.append((entry, data, options, material))
        now = ExistingBridgeAuthenticator._now(self)
        if len(matches) != 1 or abs(now.timestamp() - ts) > MAX_TS_SKEW_SECONDS:
            raise Refusal("Unauthorized")
        entry, data, options, material = matches[0]
        if direct:
            # A direct service subject is minted from this matching original
            # pairing and real socket. No HA account lookup or fake User exists.
            origin = bind_pairing_origin(hass, connection, entry)
            user, original_id, refresh, _kind = check_origin(origin)
        # _now refuses clock regression, and no await separates it from this
        # insertion. Dict order therefore follows nondecreasing admission time.
        # Prune only the expired prefix instead of copying/scanning the entire
        # shared replay window for every signed audio batch.
        while seen:
            old = next(iter(seen))
            if (now - seen[old]).total_seconds() <= NONCE_WINDOW_SECONDS:
                break
            del seen[old]
        if nonce in seen or len(seen) >= MAX_NONCES:
            raise Refusal("Unauthorized")
        seen[nonce] = now
        frozen = freeze(body)
        result = VerifiedBridgeTransport(frozen, original_id, entry.entry_id)
        _PROOFS[result] = (
            weakref.ref(self),
            owner,
            connection,
            user,
            original_id,
            refresh,
            entry,
            data,
            options,
            material,
            frozen,
            ts,
            origin,
            connection,
        )
        ExistingBridgeAuthenticator.check(self, result)
        return result

    def check(self, proof: VerifiedBridgeTransport) -> None:
        record = _PROOFS.get(proof) if type(proof) is VerifiedBridgeTransport else None
        if (
            record is None
            or record[0]() is not self
            or ExistingBridgeAuthenticator._owner(self) is not record[1]
        ):
            raise Refusal("Unauthorized")
        (
            _self,
            owner,
            connection,
            user,
            user_id,
            refresh,
            entry,
            data,
            options,
            material,
            body,
            ts,
            origin,
            original_connection,
        ) = record
        hass = owner[0]
        current_user, current_id, current_refresh, _kind = check_origin(origin)
        if (
            connection is not original_connection
            or current_user is not user
            or current_id != user_id
            or current_refresh != refresh
            or hass.config_entries.async_get_entry(entry.entry_id) is not entry
            or entry.domain != PAIRING_DOMAIN
            or entry.state is not ConfigEntryState.LOADED
            or entry.data is not data
            or entry.options is not options
            or data.get("pairing_code") != material
            or proof.body is not body
            or proof.query_owner_id != user_id
            or proof.entry_id != entry.entry_id
            or abs(ExistingBridgeAuthenticator._now(self).timestamp() - ts) > MAX_TS_SKEW_SECONDS
        ):
            raise Refusal("Unauthorized")

    def retain_origin(self, proof):
        """Mint only from a current original proof; keep no new replay authority."""
        ExistingBridgeAuthenticator.check(self, proof)
        original = _PROOFS[proof]
        retained = RetainedBridgeOrigin()
        # Retain ownership only; do not retain the private signed command body.
        _RETAINED[retained] = (
            weakref.ref(self),
            _RetainedOrigin(
                original[1],
                original[12],
                original[2],
                original[3],
                original[4],
                original[5],
                original[6],
                original[7],
                original[8],
                original[9],
                getattr(original[6], "runtime_data", None),
            ),
        )
        ExistingBridgeAuthenticator.check_retained(self, retained)
        return retained

    def check_retained(self, retained):
        record = _RETAINED.get(retained) if type(retained) is RetainedBridgeOrigin else None
        if record is None or record[0]() is not self:
            raise Refusal("Unauthorized")
        original = record[1]
        owner = ExistingBridgeAuthenticator._owner(self)
        current, identity, refresh, _kind = check_origin(original.origin)
        entry = original.entry
        if (
            owner is not original.auth
            or current is not original.user
            or identity != original.user_id
            or refresh != original.refresh
            or original.connection.user is not current
            or owner[0].config_entries.async_get_entry(entry.entry_id) is not entry
            or entry.domain != PAIRING_DOMAIN
            or entry.state is not ConfigEntryState.LOADED
            or entry.data is not original.data
            or entry.options is not original.options
            or entry.data.get("pairing_code") != original.material
            or getattr(entry, "runtime_data", None) is not original.runtime
        ):
            raise Refusal("Unauthorized")
        ExistingBridgeAuthenticator._now(self)

    async def refresh(self, proof: VerifiedBridgeTransport) -> None:
        ExistingBridgeAuthenticator.check(self, proof)
        record = _PROOFS[proof]
        if check_origin(record[12])[3] == "pairing_service":
            # This subject belongs to the original socket/pairing, not HA auth.
            return
        actual = await record[1][3](record[4])
        ExistingBridgeAuthenticator.check(self, proof)
        if actual is not record[3]:
            raise Refusal("Unauthorized")

    def origin_kind(self, proof):
        ExistingBridgeAuthenticator.check(self, proof)
        return check_origin(_PROOFS[proof][12])[3]

    def sign_http_response(self, proof, body):
        """Authenticate a new transport wrapper, never change the inner v2 frame."""
        ExistingBridgeAuthenticator.check(self, proof)
        if check_origin(_PROOFS[proof][12])[3] not in {"ha_http", "supervisor_http"}:
            raise Refusal("Unauthorized")
        encoded = canonical_body(body)
        signature = hmac.new(
            _PROOFS[proof][9].encode(), b"wiskey-peer-http.v1." + encoded, hashlib.sha256
        ).hexdigest()
        ExistingBridgeAuthenticator.check(self, proof)
        return signature

    def close(self):
        _AUTH.pop(self, None)
