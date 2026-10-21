"""The rotation peer (CR-WISKEY-HMAC-ROTATION-295 section 6): the other holder of the bridge HMAC key - the `smplwise_bridge`
integration's `rotate` service (bridge 0.9.5, custom_components/smplwise_bridge/keyset.py).

`capabilities()` answers `{"rotation": "rotation_v1" | None}`; `call(op, message)` sends one signed control message (`op` in OPS)
and returns the peer's signed answer, or raises PeerUnreachable when no answer came (the outcome is unknown).

Production peer (HMACACT-295): `HaServicePeer` - the signed message is the data of the Home Assistant service call
`smplwise_bridge.rotate` (return_response), exactly as every other bridge service is called. The peer's CAPABILITY is not guessed:
the bridge announces `rotation: "rotation_v1"` in its signed directory push (every 60 s), the directory route records it
(`note_capability`) and the capability is only believed while that record is fresh (`CAPABILITY_TTL_S`). A bridge that predates
0.9.5 never announces it, so the engine refuses at preflight (`peer_unavailable`) and everything keeps working on the kid-less recipe.
`UnavailablePeer` stays the default for a build without a configured peer (and for tests that do not install a fake)."""
from __future__ import annotations

import logging
import sqlite3
import time
from datetime import datetime, timezone
from typing import Any, Protocol

from ..db import get_setting, set_setting

log = logging.getLogger("smplwise.bridge_rotation_peer")

OPS = ("begin", "probe", "commit", "retire", "abort", "status")
CAPABILITY = "rotation_v1"
SETTING_CAP = "bridge.peer_rotation"
SETTING_CAP_AT = "bridge.peer_rotation_at"
CAPABILITY_TTL_S = 600  # ten directory pushes: a bridge that went quiet is not "available"
SERVICE = "rotate"
CALL_TIMEOUT_S = 20.0


class PeerUnreachable(Exception):
    """No answer (timeout, transport error, crash): the outcome of the call is unknown. Carries no message text."""


class Peer(Protocol):
    def capabilities(self) -> dict[str, Any]: ...

    def call(self, op: str, message: dict[str, Any]) -> dict[str, Any]: ...


class UnavailablePeer:
    """No bridge offers the `rotate` service (or none is configured)."""

    def capabilities(self) -> dict[str, Any]:
        return {"rotation": None}

    def call(self, op: str, message: dict[str, Any]) -> dict[str, Any]:
        raise PeerUnreachable()


def note_capability(conn: sqlite3.Connection, announced: Any) -> None:
    """The directory route calls this with the `rotation` field of a push that has been VERIFIED (a bridge older than 0.9.5 sends none)."""
    if announced == CAPABILITY:
        set_setting(conn, SETTING_CAP, CAPABILITY)
        set_setting(conn, SETTING_CAP_AT, datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    elif get_setting(conn, SETTING_CAP):
        set_setting(conn, SETTING_CAP, "")  # the bridge went back to a version without it (a re-install of an older release)


def clear_capability(conn: sqlite3.Connection) -> None:
    set_setting(conn, SETTING_CAP, "")
    set_setting(conn, SETTING_CAP_AT, "")


def announced_capability(conn: sqlite3.Connection, now: float | None = None) -> str | None:
    """The capability the bridge announced, while the announcement is fresh."""
    if get_setting(conn, SETTING_CAP) != CAPABILITY:
        return None
    at = get_setting(conn, SETTING_CAP_AT) or ""
    try:
        seen = datetime.strptime(at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None
    return CAPABILITY if ((time.time() if now is None else now) - seen) <= CAPABILITY_TTL_S else None


class HaServicePeer:
    """The production peer: the bridge integration's `rotate` service, reached through Home Assistant's REST API."""

    def __init__(self, db: Any, settings: Any, call_service: Any = None) -> None:
        self.db = db
        self.settings = settings
        self._call_service = call_service

    def capabilities(self) -> dict[str, Any]:
        try:
            with self.db.connection(mode="read") as conn:
                return {"rotation": announced_capability(conn)}
        except Exception:  # noqa: BLE001 - a database that cannot answer is "not available"
            return {"rotation": None}

    def call(self, op: str, message: dict[str, Any]) -> dict[str, Any]:
        if op not in OPS:
            raise ValueError("op")
        call = self._call_service
        if call is None:
            from . import ha_client

            call = ha_client.call_service
        try:
            answer = call(self.settings, "smplwise_bridge", SERVICE, message, return_response=True, timeout=CALL_TIMEOUT_S)
        except Exception as exc:  # noqa: BLE001 - whatever failed, the outcome is unknown (the engine recovers with `status`)
            log.debug("bridge rotate %s: no answer (%s)", op, type(exc).__name__)
            raise PeerUnreachable() from None
        if not isinstance(answer, dict):
            raise PeerUnreachable()
        return answer


_PEER: Peer | None = None  # an injected peer (tests); None = the production peer of the caller's own database and settings


def get_peer(db: Any = None, settings: Any = None) -> Peer:
    """The injected peer if there is one, else the production peer for this app (`db` + `settings`), else the unavailable peer."""
    if _PEER is not None:
        return _PEER
    if db is not None and settings is not None:
        return HaServicePeer(db, settings)
    return UnavailablePeer()


def set_peer(peer: Peer | None) -> None:
    global _PEER
    _PEER = peer


def set_peer_for_tests(peer: Peer | None) -> None:
    set_peer(peer)
