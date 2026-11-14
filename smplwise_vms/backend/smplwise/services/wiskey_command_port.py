"""WKWRITE-295: the command PORT between Arx's WisKey people-write layer and the direct transport.

This module owns no transport. It is the narrow seam the native people writer (services/wiskey_native_write.py) calls; the direct
WebSocket transport of DIRECT_API_V1.md (`DirectApiTransport`, built on pilot/WKDIRECT-295) implements it. Tests drive the writer with
a fake that implements the same Protocol.

The contract an implementation keeps (so the writer's crash and UNKNOWN rules hold):

- `command` is the public WisKey command name WITHOUT the `hikvision_intercom/` prefix (`users/create`, `peer_writes/source_v1`,
  `peer_receipts/resolve`, ...). The transport sends `{id, type: "hikvision_intercom/" + command, bridge}` on the paired direct
  connection. `bridge` is the signed envelope: `wiskey-peer-query.v1` for the commands in PEER_QUERY_COMMANDS, otherwise
  `wiskey-bridge-command.v1`; its `query_owner_id` is the exact service id `direct/connect` returned (never an HA user).
- `parameters` go into `bridge.parameters` unchanged (the writer has already shaped them to the closed catalog schema). They may hold
  a raw private value (a PIN, a card number, a display name) - the transport must never log, persist or echo them.
- The return value is the `result` object of a reply whose `wiskey-direct-reply.v1` MAC, `connection_ref` and `id`/`type` correlation
  were verified BEFORE it was interpreted, with JSON number types preserved.
- A failure raises `WiskeyCommandError` with exactly one outcome:
    NOT_SENT  - proven: no byte of this request frame was written to the socket (refused locally, not connected, queue full before
                the write). Only this outcome lets the writer record `not_sent`.
    REFUSED   - a VERIFIED (MAC + correlation) error frame for this request; `code` is WisKey's error code as sent.
    UNKNOWN   - anything else once the write may have started: timeout, socket closed, MAC / correlation failure, an unverifiable or
                malformed frame, cancellation. Transport closure is never a not-sent proof (DIRECT_API_V1.md).
- The transport never retries or replays a command on its own, and never reconnects in the middle of one.
- `operation_id` is Arx's correlation id of the write (None for plain reads); it is for correlation only, never authority.
"""
from __future__ import annotations

from typing import Any, Mapping, Protocol, runtime_checkable

DOMAIN_PREFIX = "hikvision_intercom/"
# the commands that ride the original `wiskey-peer-query.v1` signed read envelope (COMMAND_CATALOG.jsonl `wire_schema`); every other
# command uses `wiskey-bridge-command.v1`
PEER_QUERY_COMMANDS = frozenset({"peer_bindings/get", "peer_bindings/history", "peer_protocol/get", "peer_receipts/resolve"})

NOT_SENT = "not_sent"
REFUSED = "refused"
UNKNOWN = "unknown"
OUTCOMES = (NOT_SENT, REFUSED, UNKNOWN)


class WiskeyCommandError(Exception):
    """A command that did not return a verified result. `outcome` is NOT_SENT, REFUSED or UNKNOWN (see the module docstring); `code`
    is a short machine code (WisKey's own error code for REFUSED). The message never carries a parameter value."""

    def __init__(self, code: str, *, outcome: str) -> None:
        if outcome not in OUTCOMES:
            outcome = UNKNOWN  # an implementation mistake can never become a not-sent proof
        if not isinstance(code, str) or not 1 <= len(code) <= 128 or any(ord(ch) < 32 or ord(ch) == 127 for ch in code):
            code = "error"
        super().__init__(f"{outcome}:{code}")
        self.code = code
        self.outcome = outcome

    @property
    def may_have_been_sent(self) -> bool:
        return self.outcome != NOT_SENT


@runtime_checkable
class WiskeyCommandPort(Protocol):
    """What the writer needs from the direct transport: one signed request, one verified result."""

    async def send_signed(self, command: str, parameters: Mapping[str, Any], *, operation_id: str | None) -> Mapping[str, Any]:
        ...
