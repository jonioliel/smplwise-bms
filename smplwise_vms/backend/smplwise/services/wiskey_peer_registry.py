"""WKPEER-295 (WisKey round 10 section 2.4): the Arx registry client for the peer binding. OFF, fake-backed.

The WisKey half (not delivered) is a server-approved registry that binds ONE dedicated querying HA service principal (the owner
creates it; Arx never creates HA users - CR-ACR7-FENCE-02) to Arx's authenticated peer identity at a binding revision, with metadata
`verified_peer_ref, peer_binding_ref, peer_binding_revision, query_owner_id, repository_id, allowed_read_scope, active`
(ARX_REPLY8_SIGNED_CAPTURE_COMPLETION_HOOK section 2). WisKey has not specified a wire read for it; Arx PROPOSES one here
(`PROPOSED_COMMAND`, a read under the dedicated principal) so its client can be written and reviewed. Nothing is on the wire.

Rules this client enforces (every refusal is a verdict with `ok=False`; nothing is ever inferred):
- OWNER PIN. Arx follows only the binding the owner pinned (`OwnerPin`: query owner, repository, verified_peer_ref,
  peer_binding_ref, peer_binding_revision), stored as the setting `wiskey.peer_pin` (JSON). Only the owner writes it (no route, no
  writer in this branch). Missing / malformed pin -> no client.
- DEDICATED OWNER. The connection must be authenticated as the pinned query owner (`TransportAttestation`), checked BEFORE any
  lookup (`owner_mismatch`, nothing asked). A binding to another principal, repository or peer is `binding_mismatch`; there is no
  automatic rebind.
- REVOCATION. A revoked binding answers `revoked`: no new query runs under it.
- ROTATION. A rotated binding answers `rotation_pending` even when a successor is named: Arx never follows the successor by itself;
  the owner re-pins to the new revision.
- HISTORICAL READ. A receipt recorded under an older (rotated / revoked) revision of the SAME pinned binding may be verified only when
  that revision carries `historical_read: true`, with the same query owner, repository and verified_peer_ref; never a revision newer
  than the pin, never another binding (`not_pinned`).
- STRICT PARSE. Every key exactly once, strict types (bool is not an int), the read scope constant, state/active/successor consistent;
  any error envelope, transport exception or malformed answer is UNKNOWN (`unknown` / `malformed`).

`client_for` answers None in this build (`wiskey_peer.enabled` is False: the go-live constant). `LiveRegistryTransport` refuses.

PEERQUERY-295: the proposed read is now the catalogued WisKey command (round-4 COMMAND_CATALOG `peer_bindings/get`, transport mode
`original_peer_read_transport`, envelope `wiskey-peer-query.v1`, lookup parameters exactly {peer_binding_ref, peer_binding_revision},
result = this draft1 row). Its wired transport is `wiskey_peer_query.DirectRegistryTransport` (over the direct link, default OFF
behind `wiskey.peer_query`); it hands over a `VerifiedResult` or raises a classified `TransportFailure`. The query owner may be the
direct service subject (`wiskey_peer.is_query_owner_id`)."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any, Protocol

from ..db import get_setting
from . import wiskey_peer as wp

GO_LIVE_PERMITTED = True  # ECCACT-295: owner decision 2026-10-21 (option A); the live registry read is still not built (not_built)
PIN_KEY = "wiskey.peer_pin"
PROPOSED_COMMAND = "hikvision_intercom/peer_bindings/get"  # Arx PROPOSAL, not on the wire, not advertised by WisKey
PROPOSED_CAPABILITY = "peer_binding_read_v1"
PROTOCOL = "wiskey-peer-binding-draft1"
READ_SCOPE = "central_capture_person_commit"
ROW_KEYS = frozenset({
    "schema_version", "protocol", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision", "query_owner_id", "repository_id",
    "allowed_read_scope", "state", "active", "historical_read", "successor"})
BINDING_STATES = ("active", "rotated", "revoked")
PIN_FIELDS = ("query_owner_id", "repository_id", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision")


class RegistryRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class RegistryTransport(Protocol):
    def peer_binding_get(self, peer_binding_ref: str, peer_binding_revision: int) -> Any:
        """One read over the connection authenticated as the dedicated principal; returns the native frame, or a `VerifiedResult`
        when the transport has already verified the reply (MAC + correlation) and kept only its `result`."""
        ...


@dataclass(frozen=True)
class VerifiedResult:
    """PEERQUERY-295: the `result` object of a reply whose MAC, connection_ref and id the transport verified BEFORE handing it on
    (the direct link, services/wiskey_media_bridge.DirectLink.call_command). Read exactly like the `result` of a success frame."""
    result: Any


TRANSPORT_FAILURES = ("not_sent", "refused", "timeout", "transport_error")


class TransportFailure(Exception):
    """PEERQUERY-295: a transport that classifies its own failure. `code` is one of TRANSPORT_FAILURES; `detail` is a short machine
    code (WisKey's own error code for `refused`). Every one is a verdict with ok=False: no binding is ever inferred from a failure."""

    def __init__(self, code: str, detail: str | None = None) -> None:
        if code not in TRANSPORT_FAILURES:
            code = "transport_error"
        super().__init__(code)
        self.code = code
        self.detail = detail if isinstance(detail, str) and 0 < len(detail) <= 64 else None


class LiveRegistryTransport:
    """The live transport is not built: it refuses (no frame is sent)."""

    def peer_binding_get(self, peer_binding_ref: str, peer_binding_revision: int) -> Any:
        if GO_LIVE_PERMITTED is not True or not wp.go_live_permitted():
            raise RegistryRefused("not_permitted")
        raise RegistryRefused("not_built")


@dataclass(frozen=True)
class OwnerPin:
    query_owner_id: str
    repository_id: str
    verified_peer_ref: str
    peer_binding_ref: str
    peer_binding_revision: int

    def __post_init__(self) -> None:
        if not (wp.is_query_owner_id(self.query_owner_id) and wp.is_uuid(self.repository_id) and wp.is_ref(self.verified_peer_ref)
                and wp.is_ref(self.peer_binding_ref) and wp.is_pos_int(self.peer_binding_revision)):
            raise ValueError("invalid owner pin")


def encode_pin(pin: OwnerPin) -> str:
    return json.dumps({f: getattr(pin, f) for f in PIN_FIELDS}, sort_keys=True, separators=(",", ":"))


def parse_pin(text: Any) -> OwnerPin | None:
    if not isinstance(text, str) or not text:
        return None
    try:
        raw = json.loads(text)
    except ValueError:
        return None
    if not isinstance(raw, dict) or set(raw) != set(PIN_FIELDS):
        return None
    try:
        return OwnerPin(**raw)
    except (ValueError, TypeError):
        return None


def read_pin(conn: sqlite3.Connection) -> OwnerPin | None:
    try:
        return parse_pin(get_setting(conn, PIN_KEY))
    except sqlite3.Error:
        return None


@dataclass(frozen=True)
class BindingVerdict:
    ok: bool
    code: str
    peer: wp.VerifiedPeerRef | None = None
    historical: bool = False
    detail: str | None = None  # PEERQUERY-295: WisKey's refusal code for `refused`, the transport's short code otherwise


def _no(code: str) -> BindingVerdict:
    return BindingVerdict(False, code)


def parse_binding(row: Any, peer_binding_ref: str, peer_binding_revision: int) -> dict[str, Any] | None:
    """Strict: None for anything malformed (the caller answers `malformed`)."""
    if not isinstance(row, dict) or set(row) != ROW_KEYS:
        return None
    if not (wp.is_pos_int(row["schema_version"]) and row["schema_version"] == 1 and row["protocol"] == PROTOCOL):
        return None
    if not (wp.is_pos_int(row["peer_binding_revision"]) and row["peer_binding_ref"] == peer_binding_ref
            and row["peer_binding_revision"] == peer_binding_revision):
        return None
    if not (wp.is_ref(row["verified_peer_ref"]) and wp.is_query_owner_id(row["query_owner_id"]) and wp.is_uuid(row["repository_id"])):
        return None
    if row["allowed_read_scope"] != READ_SCOPE or row["state"] not in BINDING_STATES:
        return None
    if not isinstance(row["active"], bool) or not isinstance(row["historical_read"], bool):
        return None
    if row["active"] is not (row["state"] == "active"):
        return None
    successor = row["successor"]
    if row["state"] == "rotated":
        if not (isinstance(successor, dict) and set(successor) == {"peer_binding_ref", "peer_binding_revision"}
                and wp.is_ref(successor["peer_binding_ref"]) and wp.is_pos_int(successor["peer_binding_revision"])
                and successor["peer_binding_revision"] > peer_binding_revision):
            return None
    elif successor is not None:
        return None
    return row


class RegistryClient:
    def __init__(self, transport: RegistryTransport, pin: OwnerPin, attestation: wp.TransportAttestation) -> None:
        if not isinstance(pin, OwnerPin) or not isinstance(attestation, wp.TransportAttestation):
            raise wp.PeerSeamError("invalid_client")
        self.transport = transport
        self.pin = pin
        self.attestation = attestation

    def _owner_ok(self) -> bool:
        return self.attestation.query_owner_id == self.pin.query_owner_id

    def _fetch(self, ref: str, revision: int) -> dict[str, Any] | BindingVerdict:
        try:
            frame = self.transport.peer_binding_get(ref, revision)
        except TransportFailure as exc:  # a classified failure (PEERQUERY-295): still never a binding
            return BindingVerdict(False, exc.code, detail=exc.detail)
        except Exception:  # noqa: BLE001 - a transport loss / timeout is UNKNOWN, never a binding
            return _no("unknown")
        if isinstance(frame, VerifiedResult):
            if not isinstance(frame.result, dict):
                return _no("malformed")
            row = parse_binding(frame.result, ref, revision)
            return row if row is not None else _no("malformed")
        if (not isinstance(frame, dict) or frame.get("type") != "result" or not wp.is_pos_int(frame.get("id"))
                or frame.get("success") is not True or not isinstance(frame.get("result"), dict)):
            return _no("unknown")
        row = parse_binding(frame["result"], ref, revision)
        return row if row is not None else _no("malformed")

    def _matches_pin(self, row: dict[str, Any]) -> bool:
        return (row["query_owner_id"] == self.pin.query_owner_id and row["repository_id"] == self.pin.repository_id
                and row["verified_peer_ref"] == self.pin.verified_peer_ref)

    def _mint(self, row: dict[str, Any]) -> wp.VerifiedPeerRef:
        return wp._mint_peer(value=row["verified_peer_ref"], peer_binding_ref=row["peer_binding_ref"],
                             peer_binding_revision=row["peer_binding_revision"], repository_id=row["repository_id"],
                             query_owner_id=row["query_owner_id"])

    def current(self) -> BindingVerdict:
        """The pinned binding, for NEW queries: active only."""
        if not self._owner_ok():
            return _no("owner_mismatch")
        got = self._fetch(self.pin.peer_binding_ref, self.pin.peer_binding_revision)
        if isinstance(got, BindingVerdict):
            return got
        if not self._matches_pin(got):
            return _no("binding_mismatch")
        if got["state"] == "revoked":
            return _no("revoked")
        if got["state"] == "rotated":
            return _no("rotation_pending")
        return BindingVerdict(True, "ok", self._mint(got))

    def for_receipt(self, peer_binding_ref: str, peer_binding_revision: int) -> BindingVerdict:
        """The binding a receipt names, for verifying THAT receipt: the pinned revision itself, or an older revision of the same
        binding that grants historical read."""
        if not self._owner_ok():
            return _no("owner_mismatch")
        if (peer_binding_ref != self.pin.peer_binding_ref or not wp.is_pos_int(peer_binding_revision)
                or peer_binding_revision > self.pin.peer_binding_revision):
            return _no("not_pinned")
        got = self._fetch(peer_binding_ref, peer_binding_revision)
        if isinstance(got, BindingVerdict):
            return got
        if not self._matches_pin(got):
            return _no("binding_mismatch")
        if got["state"] == "active":
            if peer_binding_revision != self.pin.peer_binding_revision:
                return _no("malformed")  # an older revision still active next to a newer pin: inconsistent registry
            return BindingVerdict(True, "ok", self._mint(got))
        if got["historical_read"] is not True:
            return _no("historical_read_denied")
        return BindingVerdict(True, "ok", self._mint(got), historical=True)


def client_for(conn: sqlite3.Connection, transport: RegistryTransport, attestation: wp.TransportAttestation) -> RegistryClient | None:
    """None unless the seam is enabled (never in this build) and the owner pinned a binding."""
    if not wp.enabled(conn) or GO_LIVE_PERMITTED is not True:
        return None
    pin = read_pin(conn)
    if pin is None:
        return None
    return RegistryClient(transport, pin, attestation)
