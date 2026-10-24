"""WKCAP-295: the tiny port this branch needs from the WisKey direct transport (DIRECT_API_V1.md). NOTHING here talks to a network.

Agent A builds the real transport (`pilot/WKDIRECT-295`); another branch defines the generic command port. This module only fixes the exact surface the capture,
feature, emergency and template wiring of THIS branch calls, so that they are tested against fakes and joined later by one adapter:

    port.identity()                                   -> PortIdentity   (the connect result: entry id of the pairing, query_owner_id, repository_id, connection_ref)
    port.call(command, parameters, timeout_s=...)     -> Mapping        (the `result` of the reply frame whose MAC the transport already verified)
    port.media_ingress_header(ticket, preparation_ref)-> str            (the pairing-signed `features/media_ingress_v1` body for the `X-WisKey-Bridge` header)
    port.open_media(path, headers, timeout_s=...)     -> Any            (opens the anonymous WebSocket of the original media plane; the original MSE codec protocol)

Blocking and synchronous on purpose: the capture lease worker, the emergency dispatcher and the template sender run on threads (never on an event loop).
`call` signs the command (kind wiskey-bridge-command.v1, the exact service query_owner_id, a fresh nonce) and verifies the wiskey-direct-reply.v1 MAC; the
callers here never see a signature, a nonce or a key. A reply that is an `error` frame becomes a `PortError` whose `outcome` is `refused` (the host answered
with an error code - the command was understood and refused); a command that provably never left is `not_sent`; anything else (timeout, closed socket, a
reply whose MAC or correlation failed) is `unknown`. `unknown` is never a resend instruction."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

OUTCOMES = ("not_sent", "refused", "unknown")


class PortError(Exception):
    """`outcome`: not_sent | refused | unknown. `code` is the host's error code or the transport's own short code; never a message body."""

    def __init__(self, code: str, outcome: str = "unknown") -> None:
        super().__init__(code)
        self.code = str(code)[:64]
        self.outcome = outcome if outcome in OUTCOMES else "unknown"


@dataclass(frozen=True)
class PortIdentity:
    """What the direct connect returned (the service identity, never an HA user)."""

    entry_id: str  # the loaded pairing entry id (`arx-service:<entry_id>` is the subject)
    query_owner_id: str
    repository_id: str
    connection_ref: str


class WiskeyDirectPort(Protocol):
    def identity(self) -> PortIdentity: ...

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]: ...

    def media_ingress_header(self, *, ticket: str, preparation_ref: str) -> str: ...

    def open_media(self, *, path: str, headers: Mapping[str, str], timeout_s: float) -> Any: ...
