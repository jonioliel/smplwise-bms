"""`smplwise_bridge.lease_event` and `smplwise_bridge.lease_request` (0.9.6, LEASEBR-295; slice L4 of the capture lease).

One handler for both services. It relays; it decides nothing about a card or a person:

1. a WisKey consumer must be registered (below) - otherwise the call fails with `LeaseUnavailable` BEFORE anything is read, so no nonce is spent and
   Arx gets "no answer" (it retries / revokes), never an invented acknowledgement;
2. `lease_contract.validate` runs the contract's stages 1-7 (transport .. state/replay) with the bridge's key set - `KeySet.verify`, so a rotation
   keeps working and the key id is honoured. A refusal is returned as the closed `rejected` answer (stage + code, `request_id` iff the schema stage
   passed) and the consumer is never called;
3. the consumer (WisKey, stage 8) gets the immutable `LeaseDTO` and answers; `lease_answers` lets the answer through only when it is exactly one
   of the closed shapes for that action and names this request. Anything else is `LeaseUnavailable` (a service error): the bridge never
   passes on a free-form or oversized answer, and never reports success for a host that did not.

Logging: the service name, the stage and the code of a refusal, or the error CLASS of a host failure - never a body, a reference, a label, a name,
a station, a card value or a key.

The hand-off seam (confirmed by WisKey, 2026-10-21): `async_register_consumer(hass, consumer)`; `consumer.handle(dto)` (a coroutine or a plain
function) receives the immutable DTO AFTER the bridge verified it and returns the host's answer object. No signing key ever goes to WisKey. Home
Assistant is only needed by the caller (`hass.data`); nothing here imports it.

LEASELIFE-295 (docs/changes/LEASELIFE-295-LEASE-CONSUMER-LIFECYCLE.md) adds, without changing that seam:

- the native capability: ONE `LeaseCapability` per Home Assistant, kept by the bridge under `LEASE_CAPABILITY_KEY`. Only this module can build one
  (a private origin token), it names its source (`domain`, `protocol`, `services`, a per-run `capability_id`, the bridge config entry it is
  attached to) and its ownership (the active `LeaseRegistration` and its `owner`). A foreign object under the key is never trusted or overwritten;
- the registration lifecycle: `async_register_consumer` returns a `LeaseRegistration` (still callable as the old remover) whose state goes
  `active` -> `removed` exactly once (remove / unload / superseded by the same named owner on a reload). After the removal no call is dispatched
  to it, and an answer it gives to a call that was already in flight is never relayed (`lease_consumer_removed`). `async_unload()` additionally
  waits for its in-flight calls (a grace) and then cancels the rest;
- the bridge side: `async_attach_bridge` / `async_detach_bridge` (the bridge's setup / unload). A registration survives a bridge reload; an
  answer to a call that was in flight while the bridge unloaded is never relayed (`lease_bridge_unloaded`);
- the DTO's seal: the bridge records every DTO it hands out and checks after the consumer returned that the DTO is the very object it issued,
  unaltered (`lease_dto_tampered` otherwise); the consumer can check the same with `LeaseCapability.verify_dto`.

Every entry point must be called from the event loop (Home Assistant's `@callback` rules); nothing here is thread-safe by design."""
from __future__ import annotations

import asyncio
import inspect
import logging
import re
import secrets
import time
import weakref
from typing import Any, Protocol

from . import lease_answers
from .const import DOMAIN, LEASE_CAPABILITY_KEY, SERVICE_LEASE_EVENT, SERVICE_LEASE_REQUEST
from .lease_contract import KIND_EVENT, KIND_REQUEST, PROTOCOL, LeaseDTO, Reject, Verifier, validate

_LOGGER = logging.getLogger(__name__)

HOST_TIMEOUT_S = 10.0  # a message lives 15 s (lease_contract.MAX_LIFETIME_S); the host gets most of it
UNLOAD_GRACE_S = 2.0  # how long async_unload waits for in-flight calls before it cancels them
CANCEL_GRACE_S = 0.5  # how long it then waits for the cancelled calls to wind down

STATE_ACTIVE = "active"
STATE_REMOVED = "removed"
OWNER_RE = re.compile(r"[a-z0-9_]{1,64}")  # a Home Assistant domain-like token, never free text

_ORIGIN = object()  # only this module can build a LeaseCapability


class LeaseUnavailable(Exception):
    """No consumer, a failing / removed consumer, an unloaded bridge, a tampered DTO, or an answer outside the closed shapes. `code` is a fixed
    token, never input text."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class LeaseConsumer(Protocol):
    def handle(self, dto: LeaseDTO) -> Any:
        """WisKey stage 8. Return the answer object (a dict) for this request; may be a coroutine."""


class LeaseRegistration:
    """WisKey's handle on its registration. Calling it (the 0.9.6 seam) or `remove()` removes the consumer; both are idempotent and a stale
    handle never removes a newer registration. `async_unload()` removes and then drains the in-flight calls."""

    __slots__ = ("_capability", "_consumer", "_owner", "_state", "_in_flight", "_tasks")

    def __init__(self, capability: LeaseCapability, consumer: LeaseConsumer, owner: str | None) -> None:
        self._capability, self._consumer, self._owner = capability, consumer, owner
        self._state = STATE_ACTIVE
        self._in_flight = 0
        self._tasks: set[asyncio.Future[Any]] = set()

    @property
    def capability(self) -> LeaseCapability:
        return self._capability

    @property
    def owner(self) -> str | None:
        return self._owner

    @property
    def state(self) -> str:
        return self._state

    @property
    def active(self) -> bool:
        return self._state == STATE_ACTIVE

    @property
    def in_flight(self) -> int:
        return self._in_flight

    def remove(self) -> None:
        """No new call reaches this consumer from now on, and no answer it still gives is relayed. Idempotent."""
        if self._state == STATE_REMOVED:
            return
        self._state = STATE_REMOVED
        self._capability._drop(self)

    __call__ = remove

    async def async_unload(self, grace_s: float | None = None) -> bool:
        """`remove()`, then wait up to `grace_s` (default UNLOAD_GRACE_S) for the calls still inside `handle()`, then cancel the rest. True when
        everything finished on its own. After it returns no answer of this consumer is ever relayed, whatever the consumer does."""
        self.remove()
        pending = {t for t in self._tasks if not t.done()}
        if not pending:
            return True
        _done, pending = await asyncio.wait(pending, timeout=UNLOAD_GRACE_S if grace_s is None else grace_s)
        if not pending:
            return True
        for task in pending:
            task.cancel()
        await asyncio.wait(pending, timeout=CANCEL_GRACE_S)
        return False

    def __repr__(self) -> str:
        return f"LeaseRegistration({self._owner or '-'}, {self._state})"


class LeaseCapability:
    """The bridge's native capture-lease capability (one per Home Assistant). Read-only from outside; see the module text."""

    __slots__ = ("_capability_id", "_registration", "_bridge_entry_id", "_bridge_epoch", "_issued", "__weakref__")

    def __init__(self, origin: object) -> None:
        if origin is not _ORIGIN:
            raise TypeError("a LeaseCapability is created by the bridge only (lease_service.async_get_capability / async_attach_bridge)")
        self._capability_id = secrets.token_hex(16)  # a per-run tag, not a secret: tells two capabilities (two Home Assistants / runs) apart
        self._registration: LeaseRegistration | None = None
        self._bridge_entry_id: str | None = None
        self._bridge_epoch = 0
        self._issued: dict[int, tuple[weakref.ref[LeaseDTO], str, str]] = {}

    domain = property(lambda self: DOMAIN)
    protocol = property(lambda self: PROTOCOL)
    services = property(lambda self: (SERVICE_LEASE_EVENT, SERVICE_LEASE_REQUEST))

    @property
    def capability_id(self) -> str:
        return self._capability_id

    @property
    def bridge_entry_id(self) -> str | None:
        """The bridge config entry that currently serves the two services; None while the bridge is not loaded."""
        return self._bridge_entry_id

    @property
    def registration(self) -> LeaseRegistration | None:
        return self._registration

    @property
    def owner(self) -> str | None:
        return self._registration.owner if self._registration is not None else None

    def owns(self, registration: Any) -> bool:
        """True iff `registration` is the active registration of THIS capability."""
        return registration is not None and registration is self._registration and registration.active

    def verify_dto(self, dto: Any) -> bool:
        """True iff `dto` is a LeaseDTO object this capability handed to a consumer, still alive and unaltered (seal, nonce and fields)."""
        if type(dto) is not LeaseDTO:
            return False
        entry = self._issued.get(id(dto))
        if entry is None or entry[0]() is not dto:
            return False
        return (dto.body_sha256, dto.nonce) == (entry[1], entry[2]) and dto.intact()

    # ---- bridge-internal
    def _issue(self, dto: LeaseDTO) -> None:
        key = id(dto)

        def gone(ref: weakref.ref[LeaseDTO], key: int = key) -> None:
            entry = self._issued.get(key)
            if entry is not None and entry[0] is ref:
                del self._issued[key]

        self._issued[key] = (weakref.ref(dto, gone), dto.body_sha256, dto.nonce)


    def _drop(self, registration: LeaseRegistration) -> None:
        if self._registration is registration:
            self._registration = None


def is_bridge_capability(obj: Any) -> bool:
    """The consumer's check that an object is this bridge's capability (and not a look-alike someone put into hass.data)."""
    return type(obj) is LeaseCapability


def async_get_capability(hass: Any) -> LeaseCapability | None:
    """The bridge's capability, or None (none yet, or a foreign object under the key - never trusted)."""
    cap = hass.data.get(LEASE_CAPABILITY_KEY)
    return cap if is_bridge_capability(cap) else None


def _ensure_capability(hass: Any) -> LeaseCapability:
    cap = hass.data.get(LEASE_CAPABILITY_KEY)
    if cap is None:
        cap = hass.data[LEASE_CAPABILITY_KEY] = LeaseCapability(_ORIGIN)
    elif not is_bridge_capability(cap):
        raise RuntimeError("the lease capability key holds a foreign object; refusing to use or replace it")
    return cap


def async_attach_bridge(hass: Any, entry_id: str) -> LeaseCapability:
    """The bridge's setup: its config entry now serves the two services."""
    cap = _ensure_capability(hass)
    cap._bridge_entry_id = entry_id
    cap._bridge_epoch += 1
    return cap


def async_detach_bridge(hass: Any, entry_id: str) -> None:
    """The bridge's unload. The consumer's registration stays (WisKey does not re-register for a bridge reload); calls still in flight get no
    relayed answer. Another entry id than the attached one is a no-op."""
    cap = async_get_capability(hass)
    if cap is not None and cap._bridge_entry_id == entry_id:
        cap._bridge_entry_id = None
        cap._bridge_epoch += 1


def async_register_consumer(hass: Any, consumer: LeaseConsumer, *, owner: str | None = None) -> LeaseRegistration:
    """WisKey's door. One consumer at a time. A second registration is refused, except by the SAME named `owner` (a reload whose unload did not
    remove the old one): that supersedes the old registration. On failure nothing changes. The returned registration is also the remover."""
    if not callable(getattr(consumer, "handle", None)):
        raise TypeError("a lease consumer needs a callable handle(dto)")
    if owner is not None and not (isinstance(owner, str) and OWNER_RE.fullmatch(owner)):
        raise ValueError("owner must be a short lower-case token ([a-z0-9_], at most 64)")
    cap = _ensure_capability(hass)
    current = cap.registration
    if current is not None:
        if owner is None or current.owner != owner:
            raise RuntimeError("a lease consumer is already registered")
        current.remove()  # superseded by the same owner
    reg = LeaseRegistration(cap, consumer, owner)
    cap._registration = reg
    return reg


async def async_handle(hass: Any, service_name: str, kind: str, data: Any, verifier: Verifier, now: int | None = None) -> dict[str, Any]:
    """The answer object of one service call. `service_name` is only for the log line. Raises LeaseUnavailable (see the module text)."""
    assert kind in (KIND_EVENT, KIND_REQUEST)
    cap = async_get_capability(hass)
    reg = cap.registration if cap is not None else None
    if reg is None:
        _LOGGER.warning("smplwise_bridge.%s not served: no lease consumer is registered", service_name)
        raise LeaseUnavailable("lease_consumer_missing")
    try:
        dto = validate(kind, data, verifier, int(time.time()) if now is None else now)
    except Reject as rej:
        _LOGGER.warning("smplwise_bridge.%s refused: %s/%s", service_name, rej.stage, rej.code)
        return rej.answer()
    if not reg.active:  # cannot happen between the lookup and here (no await), kept as the closed rule: never dispatch to a removed consumer
        raise LeaseUnavailable("lease_consumer_missing")
    epoch, sealed = cap._bridge_epoch, (dto.body_sha256, dto.nonce)
    cap._issue(dto)
    reg._in_flight += 1
    try:
        result = await _dispatch(reg, dto, service_name)
    finally:
        reg._in_flight -= 1
        # WKA-295: the same source checks as before the dispatch, again AFTER the consumer's await: the registration is still the active one
        # of THIS capability AND that capability is still the bridge's object under LEASE_CAPABILITY_KEY (not replaced or dropped meanwhile);
        # the bridge was not reloaded; the DTO is still the very object this capability issued, unaltered (`verify_dto`, which includes
        # the seal / `intact()`).
        removed = not cap.owns(reg) or async_get_capability(hass) is not cap
        unloaded = cap._bridge_epoch != epoch
        tampered = (dto.body_sha256, dto.nonce) != sealed or not cap.verify_dto(dto)
    if removed:
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer was removed while answering; not relayed", service_name)
        raise LeaseUnavailable("lease_consumer_removed")
    if unloaded:
        _LOGGER.warning("smplwise_bridge.%s: the bridge was unloaded while the consumer answered; not relayed", service_name)
        raise LeaseUnavailable("lease_bridge_unloaded")
    if tampered:
        _LOGGER.warning("smplwise_bridge.%s: the lease DTO was altered during the hand-off; not relayed", service_name)
        raise LeaseUnavailable("lease_dto_tampered")
    if result is _FAILED:
        raise LeaseUnavailable("lease_consumer_failed")
    answer = lease_answers.event_answer(dto, result) if kind == KIND_EVENT else lease_answers.request_answer(dto, result)
    if answer is None:
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer's answer is not a closed answer; not relayed", service_name)
        raise LeaseUnavailable("lease_answer_invalid")
    return answer


_FAILED = object()


async def _dispatch(reg: LeaseRegistration, dto: LeaseDTO, service_name: str) -> Any:
    """`consumer.handle(dto)`, awaited (bounded) when it is awaitable. Returns the result or `_FAILED`; never raises except the CALLER's own
    cancellation, which also cancels the consumer's work."""
    try:
        result = reg._consumer.handle(dto)
        if not inspect.isawaitable(result):
            return result
        task = asyncio.ensure_future(result)
    except Exception as exc:  # noqa: BLE001 - the class name only
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer failed (%s)", service_name, type(exc).__name__)
        return _FAILED
    reg._tasks.add(task)
    task.add_done_callback(reg._tasks.discard)
    try:
        await asyncio.wait({task}, timeout=HOST_TIMEOUT_S)
    except asyncio.CancelledError:  # the service call itself was cancelled (Home Assistant stopping, a caller timeout): cancel the host's work too
        task.cancel()
        raise
    if not task.done():
        task.cancel()
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer failed (%s)", service_name, "TimeoutError")
        return _FAILED
    if task.cancelled():
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer failed (%s)", service_name, "CancelledError")
        return _FAILED
    exc = task.exception()
    if exc is not None:
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer failed (%s)", service_name, type(exc).__name__)
        return _FAILED
    return task.result()
