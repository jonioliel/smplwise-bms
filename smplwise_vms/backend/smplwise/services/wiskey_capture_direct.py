"""WKCAP-295 item 10 (Q04): the production caller of the capture lease on WisKey's direct transport (CAPTURE_COMPOSITION_V1.md).

`DirectLeaseTransport` is a `lease_events.LeaseTransport`: the ONE seam that the lease worker (revoke / heartbeat / stream reset), the capture routes
(start / status / confirm / cancel) and the poller already call through (`lease_events.TRANSPORT`). Installing it replaces the legacy HA `call_service`
transport by two ordinary pairing-signed direct commands that WisKey publishes:

    capture/lease_event    parameters exactly {signed_message_json: <the ORIGINAL signed capture JSON string>}   (lease_revoke | lease_heartbeat | lease_stream_reset)
    capture/lease_request  parameters exactly {signed_message_json: <the ORIGINAL signed capture JSON string>}   (capture_start | _status | _confirm | _cancel)

What it adds to the capture wire: NOTHING. The inner message is `lease_events.sign`'s text byte for byte (DTO v3, no kid, no digest, no extra field); the
outer pairing signature belongs to the transport port. At most 8192 UTF-8 bytes. The answer is the host's closed answer object, returned as it came (the
existing classifiers `lease_answers` / `capture_lease_route.classify_request` judge it - this module never interprets a lease answer).

What it refuses to be
- not async: WisKey's registrar is SYNCHRONOUS and so is this caller (it blocks the lease worker's own thread for at most `timeout_s`); nothing is awaited on a
  capture thread and nothing is retried here (the worker's own bounded retry rules are the only retry);
- not an actor source: the actor is whoever signed the ORIGINAL inner message (`lease_events.sign(... actor_id ...)` from the Arx operator's Principal); the pairing
  entry id is never used as an actor (WisKey pins the installation actor from the first `lease_stream_reset` of the original stream);
- not a policy source: operator RBAC / scope / the lease ledger stay in routers/access_control.py `_lease_redecide`, services/capture_lease.py and
  services/intercom_authority.Authority. This transport grants nothing.

Errors become `ApiError`s the existing capture routes already understand (routers/access_control.py `_NOT_SENT_CODES`): a command that never left, or that WisKey's outer
adapter answered `capture_source_unavailable` (no consumer registered on the loaded station: nothing was called), is a clean `not_sent`; `capture_outcome_unknown`,
a timeout, a closed socket or a reply that failed its MAC is UNKNOWN (HTTP 504, `details.outcome = unknown`) and is never a licence to resend."""
from __future__ import annotations

from typing import Any

from ..errors import ApiError
from . import capture_lease as cl
from . import lease_events
from .wiskey_capture_port import PortError, WiskeyDirectPort

EVENT_COMMAND = "capture/lease_event"
REQUEST_COMMAND = "capture/lease_request"
DATA_KEY = lease_events.SERVICE_DATA_KEY  # "signed_message_json"
MAX_BYTES = lease_events.MAX_MESSAGE_BYTES  # 8192 UTF-8 bytes
TIMEOUT_S = 10.0  # every lease message lives <= 15 s; the worker's own deadline rules bound the rest
NOT_SENT_CODES = ("wiskey_direct_not_connected", "capture_source_unavailable")  # added to access_control._NOT_SENT_CODES
UNKNOWN_CODE = "capture_outcome_unknown"


class DirectLeaseTransport:
    """`lease_events.LeaseTransport` over `capture/lease_event` and `capture/lease_request`."""

    def __init__(self, port: WiskeyDirectPort, *, timeout_s: float = TIMEOUT_S) -> None:
        self.port = port
        self.timeout_s = timeout_s

    # -- the two Protocol methods ------------------------------------------------------------------------------------------------------
    def event(self, settings: Any, text: str) -> Any:  # noqa: ARG002 - settings belong to the legacy HA transport
        return self._send(EVENT_COMMAND, text)

    def request(self, settings: Any, action: str, text: str) -> Any:  # noqa: ARG002
        if action not in cl.LEASE_ACTIONS:  # the four request actions only; an event never goes through the request command
            raise ValueError("lease_request action")
        return self._send(REQUEST_COMMAND, text)

    # -- one blocking exchange -----------------------------------------------------------------------------------------------------------
    def _send(self, command: str, text: str) -> Any:
        if type(text) is not str or not text or len(text.encode("utf-8")) > MAX_BYTES:
            raise ApiError(400, "message_invalid", "הודעת הקריאה אינה תקינה.", details={"outcome": "not_sent"})
        try:
            result = self.port.call(command, {DATA_KEY: text}, timeout_s=self.timeout_s)
        except PortError as exc:
            raise _api_error(exc) from None
        except Exception as exc:  # noqa: BLE001 - anything else after a possible hand-over is unknown
            raise ApiError(504, UNKNOWN_CODE, "לא ידוע אם הבקשה הגיעה.", retryable=False, details={"outcome": "unknown", "error": type(exc).__name__}) from None
        return result


def _api_error(exc: PortError) -> ApiError:
    if exc.outcome == "not_sent" or exc.code in NOT_SENT_CODES:
        code = exc.code if exc.code in NOT_SENT_CODES else "wiskey_direct_not_connected"
        return ApiError(503, code, "קריאת כרטיס אינה זמינה כעת", retryable=True, details={"outcome": "not_sent", "error": exc.code})
    if exc.outcome == "refused" and exc.code != UNKNOWN_CODE:
        return ApiError(502, exc.code, "הבקשה נדחתה.", details={"outcome": "refused", "error": exc.code})
    return ApiError(504, UNKNOWN_CODE, "לא ידוע אם הבקשה הגיעה.", details={"outcome": "unknown", "error": exc.code})


def install(port: WiskeyDirectPort, *, timeout_s: float = TIMEOUT_S) -> DirectLeaseTransport:
    """Make the direct transport the lease transport of this process (the worker, the routes and the poller all read `lease_events.TRANSPORT`).
    It changes no setting and no permit: `access.capture_lease` stays `off`, `capture_lease.GO_LIVE_PERMITTED` and `MIN_BRIDGE_FOR_CAPTURE_LEASE` are not touched."""
    transport = DirectLeaseTransport(port, timeout_s=timeout_s)
    lease_events.set_transport(transport)
    return transport


def uninstall() -> None:
    lease_events.set_transport(None)
