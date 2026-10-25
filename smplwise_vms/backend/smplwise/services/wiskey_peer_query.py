"""PEERQUERY-295 (WisKey board item "peer_query", unified board W-008 / W-010): the peer_query read `peer_bindings/get` wired behind the
EXISTING `wiskey_peer_registry.RegistryTransport`. Default OFF. Read-only. Fakes only in tests.

What is wired
- `DirectRegistryTransport` implements `RegistryTransport.peer_binding_get(ref, revision)` over the existing direct link
  (`wiskey_direct_join.DirectCapturePort.call`, the same authenticated `direct/connect` socket the people writes and the capture lease
  use). The link signs the closed `wiskey-peer-query.v1` body (`wiskey_command_port.PEER_QUERY_COMMANDS`), sends
  `{id, type: "hikvision_intercom/peer_bindings/get", bridge}` and verifies the reply's MAC, connection_ref and id before the result is
  read. Parameters are exactly the catalogued lookup form `{peer_binding_ref, peer_binding_revision}` (round-4 COMMAND_CATALOG,
  tests/fixtures/wiskey_round4/people_command_catalog.json); the result is the strict draft1 row `wiskey_peer_registry.parse_binding`
  already reads. No new wire field exists anywhere in this module.
- `peer_query(conn, principal, ...)` is the one entry point. In order, every refusal returns a result with ok=False and writes ONE
  audit row (`wiskey.peer_query`):
    1. the installation switch `wiskey.peer_query` (`off` | `on`, a key never written reads `off`)  -> `peer_query_disabled`
    2. `system.configure` at the installation (system administrators only; a local identity also needs its second factor)
                                                                                                   -> `forbidden`
    3. the command: only `peer_bindings/get`; the other peer_query commands are NOT_IMPLEMENTED   -> `not_implemented`
                                                                                    anything else -> `unknown_command`
    4. the parameters: None (the owner-pinned binding) or the exact lookup form; the `initialize` form is refused because it
       PROVISIONS a binding on the WisKey side (not read-only)                    -> `not_implemented` / `invalid_parameters`
    5. the owner pin (`wiskey.peer_pin`, owner-written, no writer here)                            -> `not_pinned`
    6. the direct link selected and authenticated now                                              -> `not_connected`
    7. `RegistryClient` (owner check before any byte, strict row, revocation / rotation / historical read): `owner_mismatch`,
       `binding_mismatch`, `revoked`, `rotation_pending`, `historical_read_denied`, `not_pinned`, `malformed`, and the classified
       transport failures `refused` (detail = WisKey's code), `timeout`, `transport_error`, `not_sent`.
  A request for a binding other than the pinned one is `not_pinned` with nothing sent. WisKey answers an unknown binding with the same
  verified error as a denied one (`binding_denied`, peer_bridge_api.py): Arx reports `refused` + `binding_denied` and never claims to
  know which. Nothing is retried, re-sent, cached or followed (a rotation successor is never followed).

NOT_IMPLEMENTED here (refusal `not_implemented`, detail = the command)
- `peer_bindings/history`, `peer_protocol/get`: readable in WisKey's source but not in the catalogue Arx adopted, and no Mac contract
  for their result was published (W-010 open).
- `peer_receipts/resolve`: owned by the receipt read (services/wiskey_peer.py / wiskey_native_write.py); not routed through here.
- `peer_bindings/get` with `{initialize: true, expected_revision: 0}`: a provisioning call, not a read.

Not added: no HTTP route, no UI, no writer for `wiskey.peer_query` or `wiskey.peer_pin`, no migration."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Mapping

from .. import rbac
from ..audit import audit
from ..db import get_setting
from . import wiskey_peer as wp
from . import wiskey_peer_registry as wr
from .wiskey_capture_port import PortError

FLAG_KEY = "wiskey.peer_query"
FLAG_VALUES = ("off", "on")
PERMISSION = "system.configure"
AUDIT_ACTION = "wiskey.peer_query"
COMMAND = "peer_bindings/get"
DEFAULT_TIMEOUT_S = 10.0
# the peer_query commands (wiskey_command_port.PEER_QUERY_COMMANDS) this module refuses on purpose
NOT_IMPLEMENTED_COMMANDS = frozenset({"peer_bindings/history", "peer_protocol/get", "peer_receipts/resolve"})
INITIALIZE_PARAMETERS = {"initialize": True, "expected_revision": 0}
LOOKUP_KEYS = frozenset({"peer_binding_ref", "peer_binding_revision"})
# the codes the direct link / its sync bridge give a request whose answer did not arrive in time (wiskey_media_bridge.call_command
# raises `outcome_unknown` on its own timeout; the sync wait above it surfaces as a TimeoutError)
TIMEOUT_CODES = frozenset({"outcome_unknown", "TimeoutError", "timeout"})


def mode(conn: sqlite3.Connection) -> str:
    try:
        return "on" if (get_setting(conn, FLAG_KEY) or "off") == "on" else "off"
    except sqlite3.Error:
        return "off"


def enabled(conn: sqlite3.Connection) -> bool:
    return mode(conn) == "on"


# ---------------------------------------------------------------- the transport behind RegistryTransport

class DirectRegistryTransport:
    """`RegistryTransport` over a `WiskeyDirectPort` (sync `call`). One request per call; never retried. `calls` counts the requests
    handed to the port (so a caller can tell `nothing was sent`)."""

    def __init__(self, port: Any, *, timeout_s: float = DEFAULT_TIMEOUT_S) -> None:
        self.port = port
        self.timeout_s = timeout_s
        self.calls = 0

    def __repr__(self) -> str:
        return f"DirectRegistryTransport(calls={self.calls})"

    def peer_binding_get(self, peer_binding_ref: str, peer_binding_revision: int) -> wr.VerifiedResult:
        if not (wp.is_ref(peer_binding_ref) and wp.is_pos_int(peer_binding_revision)):
            raise wr.TransportFailure("not_sent", "invalid_parameters")
        parameters = {"peer_binding_ref": peer_binding_ref, "peer_binding_revision": peer_binding_revision}
        self.calls += 1
        try:
            result = self.port.call(COMMAND, parameters, timeout_s=self.timeout_s)
        except PortError as exc:
            raise wr.TransportFailure(_classify(exc), exc.code) from None
        except TimeoutError:
            raise wr.TransportFailure("timeout", "TimeoutError") from None
        except Exception as exc:  # noqa: BLE001 - the request may have left: a transport error, never a binding
            raise wr.TransportFailure("transport_error", type(exc).__name__) from None
        return wr.VerifiedResult(result)


def _classify(exc: PortError) -> str:
    if exc.outcome == "refused":
        return "refused"
    if exc.outcome == "not_sent":
        return "not_sent"
    return "timeout" if exc.code in TIMEOUT_CODES else "transport_error"


# ---------------------------------------------------------------- the entry point

@dataclass(frozen=True)
class PeerQueryResult:
    ok: bool
    code: str
    detail: str | None = None
    peer: wp.VerifiedPeerRef | None = None  # sealed; never serialised (see `public`)
    historical: bool = False
    sent: bool = False  # a request was handed to the direct link

    def public(self) -> dict[str, Any]:
        """What a caller may show: codes and flags only (no reference, no subject, no repository id)."""
        return {"ok": self.ok, "code": self.code, "detail": self.detail, "historical": self.historical, "sent": self.sent,
                "peer_binding_revision": self.peer.peer_binding_revision if self.peer is not None else None}


def _refuse(code: str, detail: str | None = None) -> PeerQueryResult:
    return PeerQueryResult(False, code, detail)


def _installed_port() -> Any:
    """The capture port of the installed direct join while the join selects the direct path now; else None."""
    from . import wiskey_direct_join as dj

    join = dj.installed()
    if join is None:
        return None
    try:
        return join.capture_port if join.selected() else None
    except Exception:  # noqa: BLE001
        return None


def _target(parameters: Any) -> tuple[str, ...] | PeerQueryResult:
    if parameters is None:
        return ("current",)
    if not isinstance(parameters, Mapping):
        return _refuse("invalid_parameters")
    if dict(parameters) == INITIALIZE_PARAMETERS:
        return _refuse("not_implemented", "peer_bindings/get:initialize")
    if set(parameters) != LOOKUP_KEYS:
        return _refuse("invalid_parameters")
    ref, rev = parameters["peer_binding_ref"], parameters["peer_binding_revision"]
    if not (wp.is_ref(ref) and wp.is_pos_int(rev)):
        return _refuse("invalid_parameters")
    return ("receipt", ref, rev)  # type: ignore[return-value]


def _run(conn: sqlite3.Connection, principal: Any, command: Any, parameters: Any, port: Any, timeout_s: float,
         grant: list[rbac.Decision]) -> PeerQueryResult:
    if not enabled(conn):
        return _refuse("peer_query_disabled")
    if not isinstance(principal, rbac.Principal):
        return _refuse("forbidden", "no_principal")
    decision = rbac.authorize(conn, principal, PERMISSION, rbac.INSTALLATION)
    if not decision.allowed:
        return _refuse("forbidden", decision.reason)
    grant.append(decision)
    if command in NOT_IMPLEMENTED_COMMANDS:
        return _refuse("not_implemented", command)
    if command != COMMAND:
        return _refuse("unknown_command")
    target = _target(parameters)
    if isinstance(target, PeerQueryResult):
        return target
    pin = wr.read_pin(conn)
    if pin is None:
        return _refuse("not_pinned")
    if target[0] == "receipt" and (target[1] != pin.peer_binding_ref or target[2] > pin.peer_binding_revision):
        return _refuse("not_pinned")  # an unknown / unpinned binding: nothing is asked
    port = port if port is not None else _installed_port()
    if port is None:
        return _refuse("not_connected")
    try:
        identity = port.identity()
    except PortError as exc:
        return _refuse("not_connected", exc.code)
    except Exception:  # noqa: BLE001
        return _refuse("not_connected")
    try:
        attestation = wp.attest_transport(authenticated_user_id=getattr(identity, "query_owner_id", None),
                                          connection_ref=getattr(identity, "connection_ref", None))
    except wp.PeerSeamError as exc:
        return _refuse("owner_mismatch", exc.code)
    transport = DirectRegistryTransport(port, timeout_s=timeout_s)
    client = wr.RegistryClient(transport, pin, attestation)
    verdict = client.current() if target[0] == "current" else client.for_receipt(target[1], target[2])  # type: ignore[arg-type]
    return PeerQueryResult(verdict.ok, verdict.code, verdict.detail, verdict.peer, verdict.historical, transport.calls > 0)


def peer_query(conn: sqlite3.Connection, principal: Any, command: str = COMMAND, parameters: Mapping[str, Any] | None = None, *,
               port: Any = None, timeout_s: float = DEFAULT_TIMEOUT_S, request_id: str | None = None) -> PeerQueryResult:
    """One read-only peer_query. Never raises for a refusal; always writes exactly one audit row."""
    grant: list[rbac.Decision] = []
    try:
        result = _run(conn, principal, command, parameters, port, timeout_s, grant)
    except wp.PeerSeamError as exc:  # a sealed-type refusal inside the seam: never a binding
        result = _refuse("malformed", exc.code)
    authorized = bool(grant)
    details: dict[str, Any] = {"command": command if isinstance(command, str) and len(command) <= 64 else None,
                               "outcome": result.code, "sent": result.sent}
    if result.detail is not None:
        details["detail"] = result.detail
    if result.ok:
        details["historical"] = result.historical
        details["peer_binding_revision"] = result.peer.peer_binding_revision if result.peer is not None else None
    audit(conn, actor=principal if isinstance(principal, rbac.Principal) else None, action=AUDIT_ACTION,
          decision="allowed" if authorized else "denied", resource_type="wiskey_peer_binding", resource_id=None,
          reason=None if authorized else result.code, request_id=request_id, details=details, under=grant[0] if grant else None)
    return result
