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
Assistant is only needed by the caller (`hass.data`); nothing here imports it."""
from __future__ import annotations

import asyncio
import inspect
import logging
import time
from typing import Any, Callable, Protocol

from . import lease_answers
from .const import LEASE_CONSUMER_KEY
from .lease_contract import KIND_EVENT, KIND_REQUEST, LeaseDTO, Reject, Verifier, validate

_LOGGER = logging.getLogger(__name__)

HOST_TIMEOUT_S = 10.0  # a message lives 15 s (lease_contract.MAX_LIFETIME_S); the host gets most of it


class LeaseUnavailable(Exception):
    """No consumer, a failing consumer, or an answer outside the closed shapes. `code` is a fixed token, never input text."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class LeaseConsumer(Protocol):
    def handle(self, dto: LeaseDTO) -> Any:
        """WisKey stage 8. Return the answer object (a dict) for this request; may be a coroutine."""


def async_register_consumer(hass: Any, consumer: LeaseConsumer) -> Callable[[], None]:
    """WisKey's door. One consumer at a time; returns the function that removes it again."""
    if getattr(consumer, "handle", None) is None:
        raise TypeError("a lease consumer needs a handle(dto) method")
    if hass.data.get(LEASE_CONSUMER_KEY) is not None:
        raise RuntimeError("a lease consumer is already registered")
    hass.data[LEASE_CONSUMER_KEY] = consumer

    def remove() -> None:
        if hass.data.get(LEASE_CONSUMER_KEY) is consumer:
            hass.data.pop(LEASE_CONSUMER_KEY, None)

    return remove


async def async_handle(hass: Any, service_name: str, kind: str, data: Any, verifier: Verifier, now: int | None = None) -> dict[str, Any]:
    """The answer object of one service call. `service_name` is only for the log line. Raises LeaseUnavailable (see the module text)."""
    assert kind in (KIND_EVENT, KIND_REQUEST)
    consumer = hass.data.get(LEASE_CONSUMER_KEY)
    if consumer is None:
        _LOGGER.warning("smplwise_bridge.%s not served: no lease consumer is registered", service_name)
        raise LeaseUnavailable("lease_consumer_missing")
    try:
        dto = validate(kind, data, verifier, int(time.time()) if now is None else now)
    except Reject as rej:
        _LOGGER.warning("smplwise_bridge.%s refused: %s/%s", service_name, rej.stage, rej.code)
        return rej.answer()
    try:
        result = consumer.handle(dto)
        if inspect.isawaitable(result):
            result = await asyncio.wait_for(result, HOST_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 - the class name only
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer failed (%s)", service_name, type(exc).__name__)
        raise LeaseUnavailable("lease_consumer_failed") from None
    answer = lease_answers.event_answer(dto, result) if kind == KIND_EVENT else lease_answers.request_answer(dto, result)
    if answer is None:
        _LOGGER.warning("smplwise_bridge.%s: the lease consumer's answer is not a closed answer; not relayed", service_name)
        raise LeaseUnavailable("lease_answer_invalid")
    return answer
