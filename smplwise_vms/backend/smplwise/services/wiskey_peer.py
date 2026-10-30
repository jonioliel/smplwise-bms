"""WKPEER-295 (WisKey round 10 section 2.4, round 11 R11-I4-02 / R11-I4-03): the Arx half of the peer / receipt seam. OFF.

What this module is
- The TYPED SEAM on the Arx side. A `VerifiedPeerRef` is the only value Arx ever presents as a peer binding. It cannot be built
  from a string, a dict, a `Principal`, `act.principal`, a `request_id`, a local `op_id`, a local signature / body digest or any
  other caller-supplied value: the constructor is sealed, and the only minting path is the registry client
  (`services/wiskey_peer_registry.py`), which mints a peer only after the registry answered for the owner-pinned binding over a
  connection whose `TransportAttestation` says it was authenticated as the dedicated query principal.
- `TransportAttestation` is the transport-boundary half: the HA user id the WebSocket connection was AUTHENTICATED as (the
  transport's own answer, e.g. its `auth/current_user` reply), never an actor field of a request. Only the transport layer may call
  `attest_transport`: the peer_query boundary (services/wiskey_peer_query.py, PEERQUERY-295, default OFF) is the one product module
  that does (test-enforced), with the service subject of the authenticated direct link.
- The REAL receipt read (WKADAPT-295, WisKey round 2 2026-10-23, PEER_QUERY_V1_SPEC section 9 + T05_EXACT_ORIGINAL_AND_WRITER):
  `hikvision_intercom/peer_receipts/resolve`, parameters exactly `{peer_binding_ref, peer_binding_revision, original}` where
  `original` is the closed seven-field dict of `ResolveOriginal` (the inner `original` is the full W1 `Request.descriptor` as WisKey
  verified it at write time). `resolve_parameters` builds them, `verify_resolution` reads the closed result
  `{schema_version: 1, state: found | unknown, receipt}`: only `found` with a committed receipt settles (`committed`); `unknown`, a
  missing receipt, an error envelope (e.g. `original_reference_mismatch`) or anything malformed is UNKNOWN. There is NO
  `never_committed` from this route and an UNKNOWN is NEVER a licence to replay or re-create (owner decision 2026-10-23). The
  signed `bridge` envelope around the parameters belongs to the peer_query client (not built here).
- REMOVED (PERSONWRITES-CLEANUP-295, W-026): the historical draft1 receipt verifier (`verify_receipt`, `ReceiptExpectation`,
  `FenceContext`, the `RECEIPT_*` constants, `OneCommitLedger`) for WisKey's draft1 signed person-completion status read, a contract
  WisKey never shipped (its command name is recorded only in the change document). It had no caller. The one-central-commit rule lives on
  durably in migration 0145's unique indexes and `wiskey_intents._terminal`. See docs/changes/PERSONWRITES-CLEANUP-295.md.
- `ReceiptVerdict` and `_result_of` stay: `verify_resolution` reads every envelope through `_result_of` (its refusal codes
  `malformed_envelope`, `error:<code>`, `error` are unchanged) and `wiskey_intents.settle_update` takes a `ReceiptVerdict`.

What it is not
- Not wired: no route, worker, journal or sync path imports it (test-enforced). `GO_LIVE_PERMITTED` is a build constant that is False,
  the setting `wiskey.peer_receipt` defaults to off and cannot turn it on alone. `signed_capture_covered()` is False and stays False
  until BOTH halves exist and are reviewed (WisKey's seam + receipt: `WISKEY_HALF_REVIEWED`, False) AND the owner's go-live permit.
- A committed receipt attests ONE central person mutation only: never a create / Arx ownership, never a card, station, reader, lease or
  door outcome (`proves_create` / `device_attested` are always False)."""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import get_setting

GO_LIVE_PERMITTED = True  # ECCACT-295: owner decision 2026-10-21 (option A); wiskey.peer_receipt still defaults OFF and signed_capture_covered() stays False
SIGNED_CAPTURE_COVERED = False  # stays False until both halves exist and are reviewed
WISKEY_HALF_REVIEWED = False  # WisKey's verifier/transport seam + shared receipt: not delivered / not reviewed by Arx
FLAG_KEY = "wiskey.peer_receipt"
FLAG_VALUES = ("off", "on")

# the names of values that are NEVER a peer binding (R9-A01 / R11-I4-02); `refuse_as_peer` refuses every one of them by name
FORBIDDEN_PEER_SOURCES = frozenset({
    "act.principal", "actor", "principal", "signed_actor", "request_id", "client_request_id", "op_id", "operation_id", "target",
    "local_signature", "body_sha256", "caller_context", "presence"})

REF_RE = re.compile(r"[^\x00-\x1f]{1,128}")  # 1..128 code points, no C0 control (the WisKey reference syntax)
HA_USER_ID_RE = re.compile(r"[0-9a-f]{32}")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")  # canonical lowercase only


class PeerSeamError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class _Seal:
    __slots__ = ()

    def __copy__(self) -> "_Seal":
        return self

    def __deepcopy__(self, memo: Any) -> "_Seal":
        return self


_SEAL = _Seal()


def is_ref(value: Any) -> bool:
    return isinstance(value, str) and REF_RE.fullmatch(value) is not None


MAX_JSON_INT = 2 ** 53 - 1  # ECCACT-295 (agreed with WisKey 2026-10-21): every revision/epoch on the new interface is a JSON-safe number


def is_pos_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= MAX_JSON_INT


def is_uuid(value: Any) -> bool:
    return isinstance(value, str) and UUID_RE.fullmatch(value) is not None


def is_ha_user_id(value: Any) -> bool:
    return isinstance(value, str) and HA_USER_ID_RE.fullmatch(value) is not None


# PEERQUERY-295: over the direct API (DIRECT_API_V1.md, services/wiskey_media_bridge.py) the query owner of every signed
# `wiskey-peer-query.v1` read is the server-issued service subject `arx-service:<entry>` (never a Home Assistant user), and WisKey's
# registry binds the read binding to exactly that subject (`peer_bridge_api.PeerQueryBridge._binding_ref`). The dedicated HA user form
# stays valid for the HA WebSocket / HTTP peer transport. Printable ASCII without space, 128 code points at most (WisKey `reference`).
# REL2210: the one rule for both PEERQUERY-295 and WK4ADOPT-295 (W-010, whose `direct/connect` subject WisKey's peer server binds the
# peer reads to as `proof.query_owner_id`); WK4ADOPT's narrower duplicate pattern was folded into this one.
SERVICE_OWNER_PREFIX = "arx-service:"
SERVICE_OWNER_RE = re.compile(r"arx-service:[!-~]{1,116}")


def is_service_owner_id(value: Any) -> bool:
    return isinstance(value, str) and SERVICE_OWNER_RE.fullmatch(value) is not None


def is_query_owner_id(value: Any) -> bool:
    """A dedicated query owner: an HA user id (32 lowercase hex) or the direct service subject `arx-service:<entry>`."""
    return is_ha_user_id(value) or is_service_owner_id(value)


class _Sealed:
    """An immutable value object that only this module (and the registry client through `_mint_peer`) can create."""

    __slots__: tuple[str, ...] = ()
    _FIELDS: tuple[str, ...] = ()

    def __init__(self, *, _seal: Any = None, **values: Any) -> None:
        if _seal is not _SEAL:
            raise PeerSeamError("sealed")
        if set(values) != set(self._FIELDS):
            raise PeerSeamError("sealed")
        for name in self._FIELDS:
            object.__setattr__(self, name, values[name])

    def __setattr__(self, name: str, value: Any) -> None:
        raise AttributeError("immutable")

    def __delattr__(self, name: str) -> None:
        raise AttributeError("immutable")

    def _key(self) -> tuple[Any, ...]:
        return tuple(getattr(self, n) for n in self._FIELDS)

    def __eq__(self, other: object) -> bool:
        return type(other) is type(self) and other._key() == self._key()  # type: ignore[attr-defined]

    def __hash__(self) -> int:
        return hash((type(self).__name__,) + self._key())

    def __copy__(self) -> "_Sealed":
        return self

    def __deepcopy__(self, memo: Any) -> "_Sealed":
        return self

    def __reduce__(self) -> Any:  # no pickling round trip can forge one
        raise TypeError(f"{type(self).__name__} is not serialisable")

    def __repr__(self) -> str:
        return f"{type(self).__name__}(" + ", ".join(f"{n}={getattr(self, n)!r}" for n in self._FIELDS) + ")"


class TransportAttestation(_Sealed):
    """The HA user id the WisKey connection was authenticated as (the transport's own answer), plus an opaque connection reference.
    Never built from a request's actor / principal fields."""

    __slots__ = ("query_owner_id", "connection_ref")
    _FIELDS = ("query_owner_id", "connection_ref")
    query_owner_id: str
    connection_ref: str


class VerifiedPeerRef(_Sealed):
    """Arx's peer binding as the WisKey registry answered it for the owner-pinned binding revision: the verified peer reference,
    the binding reference + revision, the repository and the dedicated query owner it is bound to."""

    __slots__ = ("value", "peer_binding_ref", "peer_binding_revision", "repository_id", "query_owner_id")
    _FIELDS = ("value", "peer_binding_ref", "peer_binding_revision", "repository_id", "query_owner_id")
    value: str
    peer_binding_ref: str
    peer_binding_revision: int
    repository_id: str
    query_owner_id: str


def attest_transport(*, authenticated_user_id: Any, connection_ref: Any) -> TransportAttestation:
    """The transport boundary ONLY: called with the query owner the authenticated connection itself reported (an HA user id, or the
    direct service subject `direct/connect` issued). The product callers are the peer_query transport boundary
    (services/wiskey_peer_query.py, PEERQUERY-295, default OFF) and `attest_port` (WK4ADOPT-295 W-010 live reads), both with the
    identity of the authenticated direct link."""
    if not is_query_owner_id(authenticated_user_id) or not is_ref(connection_ref):
        raise PeerSeamError("invalid_attestation")
    return TransportAttestation(_seal=_SEAL, query_owner_id=authenticated_user_id, connection_ref=connection_ref)


def _mint_peer(*, value: str, peer_binding_ref: str, peer_binding_revision: int, repository_id: str, query_owner_id: str) -> VerifiedPeerRef:
    """Registry client only (services/wiskey_peer_registry.py), after a strict registry answer matched the owner pin."""
    if not (is_ref(value) and is_ref(peer_binding_ref) and is_pos_int(peer_binding_revision) and is_uuid(repository_id)
            and is_query_owner_id(query_owner_id)):
        raise PeerSeamError("invalid_peer")
    return VerifiedPeerRef(_seal=_SEAL, value=value, peer_binding_ref=peer_binding_ref, peer_binding_revision=peer_binding_revision,
                           repository_id=repository_id, query_owner_id=query_owner_id)


def as_peer_binding(candidate: Any) -> VerifiedPeerRef:
    """The seam check: only a sealed VerifiedPeerRef passes. A string (even the right one), a dict, a Principal, a request /
    operation id or a signature is refused."""
    if isinstance(candidate, VerifiedPeerRef):
        try:
            candidate._key()
        except AttributeError:  # an instance made with object.__new__ around the sealed constructor
            raise PeerSeamError("not_a_peer_binding") from None
        return candidate
    raise PeerSeamError("not_a_peer_binding")


def refuse_as_peer(source: str) -> None:
    """There is no named source from which a peer binding can be taken: the forbidden ones are refused by name, everything else as
    untrusted. (The registry client is the only minting path.)"""
    if source in FORBIDDEN_PEER_SOURCES:
        raise PeerSeamError("not_a_peer_binding")
    raise PeerSeamError("untrusted_source")


# ---------------------------------------------------------------- switches

def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def mode(conn: sqlite3.Connection) -> str:
    try:
        return "on" if (get_setting(conn, FLAG_KEY) or "off") == "on" else "off"
    except sqlite3.Error:
        return "off"


def enabled(conn: sqlite3.Connection) -> bool:
    """The seam is usable only when the setting says `on` AND the build carries the owner's go-live permit (False)."""
    return mode(conn) == "on" and go_live_permitted()


def signed_capture_covered() -> bool:
    """False in this build: needs SIGNED_CAPTURE_COVERED, the reviewed WisKey half and the go-live permit together."""
    return SIGNED_CAPTURE_COVERED is True and WISKEY_HALF_REVIEWED is True and go_live_permitted()


# ---------------------------------------------------------------- the envelope verdict (shared by verify_resolution)

@dataclass(frozen=True)
class ReceiptVerdict:
    """An envelope / update verdict. Built by `_result_of` for a broken or error envelope (read by `verify_resolution`) and taken by
    `wiskey_intents.settle_update`."""

    state: str  # committed | never_committed | in_flight | unknown
    settles: bool  # True only for a verified terminal fact of THIS intent
    code: str
    commit: dict[str, Any] | None = None

    @property
    def proves_create(self) -> bool:
        return False  # a capture / update receipt never proves that Arx created the person

    @property
    def device_attested(self) -> bool:
        return False  # device_state is always not_attested


def _unknown(code: str) -> ReceiptVerdict:
    return ReceiptVerdict("unknown", False, code)


def _result_of(frame: Any) -> dict[str, Any] | ReceiptVerdict:
    if not isinstance(frame, dict) or frame.get("type") != "result" or not is_pos_int(frame.get("id")):
        return _unknown("malformed_envelope")
    if frame.get("success") is False:
        err = frame.get("error")
        code = err.get("code") if isinstance(err, dict) else None
        return _unknown(f"error:{code}" if is_ref(code) else "error")
    if frame.get("success") is not True or not isinstance(frame.get("result"), dict):
        return _unknown("malformed_envelope")
    return frame["result"]


# ---------------------------------------------------------------- the REAL receipt read: peer_receipts/resolve (WKADAPT-295)

RESOLVE_COMMAND = "hikvision_intercom/peer_receipts/resolve"  # HA WS type; the same read over peer HTTP POST /api/hikvision_intercom/peer_query
RESOLVE_COMMAND_SUFFIX = "peer_receipts/resolve"  # the `command` of the signed wiskey-peer-query.v1 body
RESOLVE_PARAM_KEYS = frozenset({"peer_binding_ref", "peer_binding_revision", "original"})
RESOLVE_ORIGINAL_KEYS = frozenset({"repository_id", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision", "query_owner_id",
                                   "descriptor_epoch", "original"})
RESOLVE_RESULT_KEYS = frozenset({"schema_version", "state", "receipt"})
RESOLVE_REQUEST_MAX = 65536  # WisKey: a peer_query request is at most 65536 bytes (the descriptor travels inside it)
RESOLVE_DEPTH_MAX = 16


def _json_safe(value: Any, depth: int = 0) -> bool:
    """WisKey's canonical rules (atomic_person_store): JSON tree of str keys, str / exact int (JSON-safe) / bool / None, no float."""
    if depth > RESOLVE_DEPTH_MAX:
        return False
    if value is None or isinstance(value, (bool, str)):
        return True
    if isinstance(value, int):
        return -MAX_JSON_INT <= value <= MAX_JSON_INT
    if isinstance(value, list):
        return all(_json_safe(v, depth + 1) for v in value)
    if isinstance(value, dict):
        return all(isinstance(k, str) and _json_safe(v, depth + 1) for k, v in value.items())
    return False


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


@dataclass(frozen=True)
class ResolveOriginal:
    """The closed seven-field `original` WisKey compares in peer_receipts/resolve, recorded at write time. `descriptor_json` is the full
    W1 `Request.descriptor` exactly as WisKey verified it (kept as canonical JSON text, so it cannot be mutated after the fact);
    `descriptor_epoch` is WisKey's opaque `verified.descriptor.epoch` (NOT a numeric writer epoch). Built only from a sealed peer."""

    repository_id: str
    verified_peer_ref: str
    peer_binding_ref: str
    peer_binding_revision: int
    query_owner_id: str
    descriptor_epoch: Any
    descriptor_json: str

    @classmethod
    def of(cls, peer: VerifiedPeerRef, *, descriptor_epoch: Any, descriptor: Any) -> "ResolveOriginal":
        """The original of ONE write, from the peer binding that write was sent under and the descriptor WisKey verified for it."""
        as_peer_binding(peer)
        epoch_ok = is_ref(descriptor_epoch) or is_pos_int(descriptor_epoch)
        if not epoch_ok or not isinstance(descriptor, dict) or not descriptor or not _json_safe(descriptor):
            raise PeerSeamError("invalid_original")
        return cls(peer.repository_id, peer.value, peer.peer_binding_ref, peer.peer_binding_revision, peer.query_owner_id, descriptor_epoch,
                   _canonical(descriptor))

    def as_wire(self) -> dict[str, Any]:
            return {"repository_id": self.repository_id, "verified_peer_ref": self.verified_peer_ref, "peer_binding_ref": self.peer_binding_ref,
                "peer_binding_revision": self.peer_binding_revision, "query_owner_id": self.query_owner_id,
                "descriptor_epoch": self.descriptor_epoch, "original": json.loads(self.descriptor_json)}


def resolve_parameters(current: VerifiedPeerRef, original: ResolveOriginal) -> dict[str, Any]:
    """The exact parameters of peer_receipts/resolve: the CURRENT read binding + the full original. Refused (nothing to send) when the
    current binding is for another repository / peer / query owner than the original - WisKey would refuse it anyway, never repin."""
    as_peer_binding(current)
    if not isinstance(original, ResolveOriginal):
        raise PeerSeamError("invalid_original")
    if (current.repository_id, current.value, current.query_owner_id) != (original.repository_id, original.verified_peer_ref, original.query_owner_id):
        raise PeerSeamError("original_reference_mismatch")
    params = {"peer_binding_ref": current.peer_binding_ref, "peer_binding_revision": current.peer_binding_revision, "original": original.as_wire()}
    if len(_canonical(params).encode("utf-8")) > RESOLVE_REQUEST_MAX:
        raise PeerSeamError("request_too_large")
    return params


@dataclass(frozen=True)
class ResolutionVerdict:
    """The reading of a peer_receipts/resolve result. `state` is committed | unknown ONLY: this route never yields never_committed."""

    state: str
    settles: bool
    code: str
    receipt: dict[str, Any] | None = None

    @property
    def replay_permitted(self) -> bool:
        return False  # owner decision 2026-10-23: UNKNOWN (or anything else here) is never a licence to resend or re-create

    @property
    def proves_create(self) -> bool:
        return False

    @property
    def device_attested(self) -> bool:
        return False  # WisKey: device_application stays unknown


def _resolution_unknown(code: str) -> ResolutionVerdict:
    return ResolutionVerdict("unknown", False, code)


def verify_resolution(frame: Any) -> ResolutionVerdict:
    """Strict reading of `{schema_version: 1, state: "found" | "unknown", receipt}`. `found` settles only with a receipt that states
    central_state=committed, device_application=unknown, signed_capture_covered=false; a missing receipt is UNKNOWN (never
    never_committed). WisKey has already compared all seven original fields; the frame's MAC/nonce/expiry are the transport's check."""
    res = _result_of(frame)
    if isinstance(res, ReceiptVerdict):
        return _resolution_unknown(res.code)  # error envelopes (original_reference_mismatch, Unauthorized, ...) stay UNKNOWN
    if set(res) != RESOLVE_RESULT_KEYS:
        return _resolution_unknown("fields")
    if type(res["schema_version"]) is not int or res["schema_version"] != 1:
        return _resolution_unknown("unsupported_version")
    state, receipt = res["state"], res["receipt"]
    if state == "unknown":
        return _resolution_unknown("remote:unknown" if receipt is None else "contradiction")
    if state != "found":
        return _resolution_unknown("malformed:state")
    if not isinstance(receipt, dict) or not receipt or not _json_safe(receipt):
        return _resolution_unknown("contradiction")
    if (receipt.get("central_state") != "committed" or receipt.get("device_application") != "unknown"
            or receipt.get("signed_capture_covered") is not False):
        return _resolution_unknown("receipt_unverified")
    return ResolutionVerdict("committed", True, "found", json.loads(_canonical(receipt)))


# ---------------------------------------------------------------- WK4ADOPT-295 (W-010): the dedicated live peer reads

PEER_READ_TIMEOUT_S = 10.0
PEER_READ_OUTCOMES = ("result", "refused", "not_sent", "unknown")

# WISKEY-MAC-ADOPT-298 item D (Mac 03_template_peer/PEER_CLOSED_RESULTS_AND_BOOTSTRAP.json, contract unchanged): the CLOSED result lists of
# wiskey-peer-query.v1. resolve answers `found` | `unknown` only (`never_committed` is not a result); the command-level authenticated refusal
# of both reads is exactly `binding_denied`. Any other refusal code is a transport admission / route layer answer: it says nothing about
# the original write. The bootstrap of a read binding is the OWNER's private installer (tools/provision_native_peer_query.py), never Arx.
PEER_RESOLVE_STATES = ("found", "unknown")
PEER_COMMAND_REFUSALS = {"peer_bindings/get": ("binding_denied",), "peer_receipts/resolve": ("binding_denied",)}
PEER_RESULT_CLASSES = {
    "found": "central_commit_proved_only",
    "unknown": "unknown_no_retry",
    "binding_denied": "authenticated_refusal_of_this_read_prior_write_unknown",
    "disconnect": "unknown_no_retry",
    "timeout": "unknown_no_retry",
    "not_sent": "client_transport_proof_only",
}


def peer_result_class(receipt: "PeerReadReceipt", frame: Any = None) -> str:
    """The closed class of ONE peer read. `found` only for a verified resolve `found` frame; a refusal is `binding_denied` only when that is
    the command's closed refusal code; every other case (disconnect, timeout, an unlisted code, a malformed frame) is unknown_no_retry -
    no class here ever licenses a write or a replay."""
    if receipt.outcome == "not_sent":
        return PEER_RESULT_CLASSES["not_sent"]
    if receipt.outcome == "refused" and receipt.code in PEER_COMMAND_REFUSALS.get(receipt.command, ()):
        return PEER_RESULT_CLASSES["binding_denied"]
    if receipt.outcome == "result" and receipt.command == "peer_receipts/resolve" and verify_resolution(frame).state == "committed":
        return PEER_RESULT_CLASSES["found"]
    return PEER_RESULT_CLASSES["unknown"]


@dataclass(frozen=True)
class PeerReadReceipt:
    """What ONE peer read did on the wire (never a value of it): the command, `outcome` result | refused | not_sent | unknown and a code.
    `not_sent` only when the transport proved no byte left; a disconnect / timeout / unverifiable frame is `unknown`."""

    command: str
    outcome: str
    code: str | None = None

    @property
    def replay_permitted(self) -> bool:
        return False


def peer_read(port: Any, command: str, parameters: dict[str, Any], *, timeout_s: float = PEER_READ_TIMEOUT_S) -> tuple[dict[str, Any] | None, PeerReadReceipt]:
    """One signed `wiskey-peer-query.v1` read through the Arx-side owner of the verified connection (`wiskey_direct_join`'s port: the
    reply's MAC, connection_ref and id are verified there before `result` is read). Returns (frame, receipt): the native result frame
    `{type, id, success, result|error}` for the verifiers of this module and the registry client, or None when no verified answer
    exists. Never raises, never retries, never re-sends on another connection."""
    try:
        result = port.call(command, parameters, timeout_s=timeout_s)
    except Exception as exc:  # noqa: BLE001 - PortError carries the outcome; anything else may have left: unknown
        outcome = getattr(exc, "outcome", "unknown")
        code = getattr(exc, "code", None) or type(exc).__name__
        if outcome == "refused":
            return ({"type": "result", "id": 1, "success": False, "error": {"code": code}},
                    PeerReadReceipt(command, "refused", code))
        return None, PeerReadReceipt(command, "not_sent" if outcome == "not_sent" else "unknown", code)
    if not isinstance(result, dict):
        return None, PeerReadReceipt(command, "unknown", "invalid_response")
    return {"type": "result", "id": 1, "success": True, "result": result}, PeerReadReceipt(command, "result")


def attest_port(port: Any) -> TransportAttestation:
    """The attestation of the CURRENT authenticated connection, from the transport's own identity (`direct/connect`), never from a
    request's actor fields."""
    ident = port.identity()
    return attest_transport(authenticated_user_id=getattr(ident, "query_owner_id", None), connection_ref=getattr(ident, "connection_ref", None))

