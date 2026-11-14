"""Extra native transport refusal while a persisted emergency secure claim exists.

An empty registry changes no native behavior. Installation/restoration is an
internal owner-coordinator operation, never a wire credential or public route.
The transport fence blocks ordinary pulses, holds and restores against that
exact output. A separate, deny-only identity record survives transport GC so an
unconfirmed config mapping cannot infer that another API output is independent.
"""

from __future__ import annotations

import asyncio
import inspect
import weakref
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

import httpx

from ..trusted_actions.validation import Refusal

_OutputKey = tuple[str, str | None, int | None, str]
_fences: weakref.WeakKeyDictionary[Any, dict[_OutputKey, EmergencyDoorFence]] = (
    weakref.WeakKeyDictionary()
)
_owners = weakref.WeakKeyDictionary()
# Only primitive claim/target values and weak fence references are retained.
# A missing close cannot be inferred from transport lifetime. Actual durable
# startup recovery recreates an exact mirror; only its authenticated release
# retires this record. This is neither a grant nor a substitute for the journal.
_claims = {}
_failed_configurations = weakref.WeakSet()
_permits = ContextVar("wiskey_native_emergency_permits", default=())


def _output(url: httpx.URL) -> _OutputKey:
    return url.scheme, url.host, url.port, url.path.casefold().rstrip("/")


@dataclass(frozen=True, repr=False)
class _Permit:
    fence: object
    guard: object
    body: bytes
    task: asyncio.Task
    active: list


@dataclass(frozen=True, repr=False, eq=False)
class _DenyClaim:
    key: tuple
    mirrors: weakref.WeakSet


@dataclass(frozen=True, repr=False)
class _FenceOwner:
    transport: weakref.ReferenceType
    url: httpx.URL
    claim: tuple
    signature: tuple
    record: _DenyClaim


def _retain_mapping_claim(claim: tuple, target_signature: tuple) -> _DenyClaim:
    """Internal deny-only seed after original durable startup validation.

    Exact transport mirrors later coalesce with this primitive record. It
    creates neither a transport permit nor an authenticated release path.
    """
    if (
        type(claim) is not tuple
        or len(claim) != 4
        or any(type(v) is not str or not 1 <= len(v) <= 128 for v in claim)
        or type(target_signature) is not tuple
        or len(target_signature) != 5
        or type(target_signature[0]) is not str
        or not 1 <= len(target_signature[0]) <= 128
        or any(type(v) is not int or v <= 0 for v in target_signature[1:4])
        or type(target_signature[4]) is not str
        or not 1 <= len(target_signature[4]) <= 256
    ):
        raise ValueError("exact primitive emergency claim and target required")
    key = target_signature[4], claim, target_signature
    record = _claims.get(key)
    if record is None:
        record = _DenyClaim(key, weakref.WeakSet())
        _claims[key] = record
    return record


def _retain_mapping_failure(hass) -> None:
    """Deny mapping after an original validated HA configuration fails startup.

    The recovery owner calls this only after exact HA/entry/station ownership
    validation. Weak retention neither roots HA nor publishes partial claims.
    There is no allow, retry or marker-clearing port.
    """
    _failed_configurations.add(hass)


def check_mapping_identity(identity: str, *, hass=None) -> None:
    """Deny unconfirmed physical mapping for a confirmed secured station.

    No output/relay independence is known at this point. Records from dead
    transports remain refusals until the exact original claim is released.
    """
    if type(identity) is not str or not 1 <= len(identity) <= 256:
        raise Refusal("binding_denied")
    if hass is not None and hass in _failed_configurations:
        raise Refusal("emergency_recovery_unavailable")
    if any(record.key[0] == identity for record in _claims.values()):
        raise Refusal("emergency_secure_active")


class EmergencyDoorFence:
    def __init__(
        self,
        transport: Any,
        url: httpx.URL,
        claim: tuple[str, str, str, str],
        target_signature: tuple[Any, ...],
    ) -> None:
        if type(url) is not httpx.URL or url.query:
            raise ValueError("exact original emergency claim and native output required")
        self._transport = weakref.ref(transport)
        self.url, self.claim = url, claim
        self.target_signature = target_signature
        self._original = url, claim, target_signature
        self.active = True
        registry = _fences.setdefault(transport, {})
        if _output(url) in registry:
            raise Refusal("emergency_claim_conflict")
        record = _retain_mapping_claim(claim, target_signature)
        _owners[self] = _FenceOwner(self._transport, url, claim, target_signature, record)
        record.mirrors.add(self)
        registry[_output(url)] = self

    @classmethod
    def existing(cls, transport: Any, url: httpx.URL) -> EmergencyDoorFence | None:
        return _fences.get(transport, {}).get(_output(url))

    def check(self) -> None:
        if type(self) is not EmergencyDoorFence:
            raise Refusal("binding_denied")
        owner = _owners.get(self)
        if owner is None:
            raise Refusal("binding_denied")
        transport = owner.transport()
        if (
            self.active is not True
            or transport is None
            or self._transport is not owner.transport
            or (self.url, self.claim, self.target_signature)
            != (owner.url, owner.claim, owner.signature)
            or self._original != (owner.url, owner.claim, owner.signature)
            or _claims.get(owner.record.key) is not owner.record
            or self not in owner.record.mirrors
            or _fences.get(transport, {}).get(_output(owner.url)) is not self
        ):
            raise Refusal("binding_denied")

    @contextmanager
    def permit(self, guard, body: bytes):
        EmergencyDoorFence.check(self)
        task = asyncio.current_task()
        if (
            task is None
            or not callable(guard)
            or inspect.iscoroutinefunction(guard)
            or type(body) is not bytes
            or len(body) > 1024
        ):
            raise Refusal("binding_denied")
        if guard() is not None:
            raise Refusal("binding_denied")
        EmergencyDoorFence.check(self)
        permit = _Permit(self, guard, body, task, [True])
        token = _permits.set((*_permits.get(), permit))
        try:
            yield
        finally:
            permit.active[0] = False
            _permits.reset(token)

    def release(self, guard):
        """Internal ACK publication step; caller must first execute native close.

        The same current authenticated release guard is checked again here. No
        unverified query value or remembered allow result can remove the fence.
        """
        EmergencyDoorFence.check(self)
        if not callable(guard) or inspect.iscoroutinefunction(guard) or guard() is not None:
            raise Refusal("binding_denied")
        EmergencyDoorFence.check(self)
        owner = _owners[self]
        # A newly issued different claim remains an independent refusal. Never
        # retire a replacement registry entry or touch a foreign fence/resource.
        del _claims[owner.record.key]
        for mirror in tuple(owner.record.mirrors):
            original = _owners.get(mirror)
            if original is None or original.record is not owner.record:
                continue
            transport = original.transport()
            registry = _fences.get(transport, {}) if transport is not None else {}
            if registry.get(_output(original.url)) is mirror:
                del registry[_output(original.url)]
            mirror.active = False


def check_emergency_request(request, transport):
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    fence = EmergencyDoorFence.existing(transport, request.url)
    if fence is None:
        return
    EmergencyDoorFence.check(fence)
    task = asyncio.current_task()
    for permit in reversed(_permits.get()):
        if (
            type(permit) is _Permit
            and permit.fence is fence
            and permit.active[0] is True
            and permit.task is task
            and request.content == permit.body
            and request.method == "PUT"
            and request.url == fence.url
        ):
            if permit.guard() is not None:
                raise Refusal("binding_denied")
            EmergencyDoorFence.check(fence)
            return
    raise Refusal("emergency_secure_active")
