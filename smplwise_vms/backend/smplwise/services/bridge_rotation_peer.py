"""The rotation peer (CR-WISKEY-HMAC-ROTATION-295 section 6): the other holder of the bridge HMAC key - the `smplwise_bridge`
integration's `rotate` service once a bridge release offers it (CR-034 slice H1, not built).

`capabilities()` answers `{"rotation": "rotation_v1" | None}`; `call(op, message)` sends one signed control message (`op` in OPS)
and returns the peer's signed answer, or raises PeerUnreachable when no answer came (the outcome is unknown).

In this build the only production peer is UnavailablePeer: no bridge offers rotation, so the engine refuses at preflight
(`peer_unavailable`) whatever the switch says. Tests install tests/fake_bridge_rotation_peer.FakePeer with `set_peer_for_tests`."""
from __future__ import annotations

from typing import Any, Protocol

OPS = ("begin", "probe", "commit", "retire", "abort", "status")
CAPABILITY = "rotation_v1"


class PeerUnreachable(Exception):
    """No answer (timeout, transport error, crash): the outcome of the call is unknown. Carries no message text."""


class Peer(Protocol):
    def capabilities(self) -> dict[str, Any]: ...

    def call(self, op: str, message: dict[str, Any]) -> dict[str, Any]: ...


class UnavailablePeer:
    """No bridge offers the `rotate` service in this build."""

    def capabilities(self) -> dict[str, Any]:
        return {"rotation": None}

    def call(self, op: str, message: dict[str, Any]) -> dict[str, Any]:
        raise PeerUnreachable()


_PEER: Peer = UnavailablePeer()


def get_peer() -> Peer:
    return _PEER


def set_peer_for_tests(peer: Peer | None) -> None:
    global _PEER
    _PEER = peer if peer is not None else UnavailablePeer()
