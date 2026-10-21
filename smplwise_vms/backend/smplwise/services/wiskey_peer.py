"""WKPEER-295 (WisKey round 10 section 2.4, round 11 R11-I4-02 / R11-I4-03): the Arx half of the peer / receipt seam. OFF.

What this module is
- The TYPED SEAM on the Arx side. A `VerifiedPeerRef` is the only value Arx ever presents as a peer binding. It cannot be built
  from a string, a dict, a `Principal`, `act.principal`, a `request_id`, a local `op_id`, a local signature / body digest or any
  other caller-supplied value: the constructor is sealed, and the only minting path is the registry client
  (`services/wiskey_peer_registry.py`), which mints a peer only after the registry answered for the owner-pinned binding over a
  connection whose `TransportAttestation` says it was authenticated as the dedicated query principal.
- `TransportAttestation` is the transport-boundary half: the HA user id the WebSocket connection was AUTHENTICATED as (the
  transport's own answer, e.g. its `auth/current_user` reply), never an actor field of a request. Only the transport layer may call
  `attest_transport`; no product module does today (test-enforced) because nothing is wired.
- The SHARED RECEIPT verifier (`verify_receipt`): the WisKey `signed_person_writes/status` result (draft1,
  ARX_REPLY8_SIGNED_HOOK_FIELDS_AND_EXAMPLES) checked against the exact original references of ONE durable Arx intent
  (`ReceiptExpectation`): repository, writer epoch, the verified peer binding (ref + revision + dedicated query owner), request_id,
  operation_id, operation_binding_ref, the person and the revision the write was admitted against. Byte-exact comparison (no strip,
  no case folding, no normalisation). Every required key including nulls; anything missing, extra, mistyped, contradictory, an error
  envelope, a timeout or an unsupported version is UNKNOWN and never settles.
- `OneCommitLedger`: the Arx side of "one central commit": one original operation settles once; a second different terminal fact for
  the same original reference, a later non-terminal answer for a settled one, or two operations claiming the same central person
  transition (repository, person, revision_before) is a CONFLICT (never settled, counted). In memory here; the durable form belongs to
  the intent table of CR-ACR7-FENCE-02 (docs/changes/CR-ACR7-FENCE-02.md) and needs a migration that is NOT part of this branch.

What it is not
- Not wired: no route, worker, journal or sync path imports it (test-enforced). `GO_LIVE_PERMITTED` is a build constant that is False,
  the setting `wiskey.peer_receipt` defaults to off and cannot turn it on alone. `signed_capture_covered()` is False and stays False
  until BOTH halves exist and are reviewed (WisKey's seam + receipt: `WISKEY_HALF_REVIEWED`, False) AND the owner's go-live permit.
- A committed receipt attests ONE central person mutation only: never a create / Arx ownership, never a card, station, reader, lease or
  door outcome (`proves_create` / `device_attested` are always False)."""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import get_setting

GO_LIVE_PERMITTED = False  # the owner's separate go-live permit; a build constant, never a setting
SIGNED_CAPTURE_COVERED = False  # stays False until both halves exist and are reviewed
WISKEY_HALF_REVIEWED = False  # WisKey's verifier/transport seam + shared receipt: not delivered / not reviewed by Arx
FLAG_KEY = "wiskey.peer_receipt"
FLAG_VALUES = ("off", "on")

RECEIPT_PROTOCOL = "wiskey-signed-person-completion-draft1"
RECEIPT_COMMAND = "hikvision_intercom/signed_person_writes/status"
RECEIPT_CAPABILITY = "signed_person_completion_read_v1"
RECEIPT_SCOPE = "central_capture_person_commit"
RECEIPT_KEYS = frozenset({
    "schema_version", "protocol", "repository_id", "observed_epoch", "query_owner_id", "peer_binding_ref", "peer_binding_revision",
    "request_id", "operation_id", "operation_binding_ref", "exclusive_writer_established", "state", "terminal", "commit", "reason_code",
    "error_code", "scope", "device_state"})
STATES = ("in_flight", "committed", "never_committed", "unknown")
NEVER_REASONS = ("pre_effect_refused", "recovered_uncommitted")
UNKNOWN_REASONS = ("not_tracked", "history_untrusted", "storage_ambiguous", "writer_unproven")

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
    """The transport boundary ONLY: called with the user id the authenticated connection itself reported. Not called anywhere in
    the product today (nothing is wired)."""
    if not is_ha_user_id(authenticated_user_id) or not is_ref(connection_ref):
        raise PeerSeamError("invalid_attestation")
    return TransportAttestation(_seal=_SEAL, query_owner_id=authenticated_user_id, connection_ref=connection_ref)


def _mint_peer(*, value: str, peer_binding_ref: str, peer_binding_revision: int, repository_id: str, query_owner_id: str) -> VerifiedPeerRef:
    """Registry client only (services/wiskey_peer_registry.py), after a strict registry answer matched the owner pin."""
    if not (is_ref(value) and is_ref(peer_binding_ref) and is_pos_int(peer_binding_revision) and is_uuid(repository_id)
            and is_ha_user_id(query_owner_id)):
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


# ---------------------------------------------------------------- the shared receipt

@dataclass(frozen=True)
class ReceiptExpectation:
    """The exact original references of ONE durable Arx intent, recorded before the operation was sent."""

    repository_id: str
    writer_epoch: int
    peer: VerifiedPeerRef
    request_id: str
    operation_id: str
    operation_binding_ref: str
    person_id: str
    revision_before: int

    def __post_init__(self) -> None:
        as_peer_binding(self.peer)
        if not (is_uuid(self.repository_id) and is_pos_int(self.writer_epoch) and is_ref(self.request_id) and is_ref(self.operation_id)
                and is_ref(self.operation_binding_ref) and is_ref(self.person_id) and is_pos_int(self.revision_before)):
            raise PeerSeamError("invalid_expectation")
        if self.peer.repository_id != self.repository_id:
            raise PeerSeamError("invalid_expectation")


@dataclass(frozen=True)
class FenceContext:
    """A FRESH WisKey context observation (repository, writer epoch, the authenticated owner, exclusive writer). Needed before a
    `recovered_uncommitted` receipt is trusted."""

    repository_id: str
    writer_epoch: int
    owner_id: str
    exclusive_writer_established: bool


@dataclass(frozen=True)
class ReceiptVerdict:
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


def verify_receipt(frame: Any, expect: ReceiptExpectation, *, context: FenceContext | None = None) -> ReceiptVerdict:
    """Strict: every required key (nulls included), no extra key, exact references; everything else is UNKNOWN."""
    as_peer_binding(expect.peer)
    res = _result_of(frame)
    if isinstance(res, ReceiptVerdict):
        return res
    if set(res) != RECEIPT_KEYS:
        return _unknown("fields")
    if not (is_pos_int(res["schema_version"]) and res["schema_version"] == 1 and res["protocol"] == RECEIPT_PROTOCOL):
        return _unknown("unsupported_version")
    if res["scope"] != RECEIPT_SCOPE or res["device_state"] != "not_attested":
        return _unknown("scope")
    peer = expect.peer
    exact = (("repository_id", expect.repository_id), ("query_owner_id", peer.query_owner_id), ("peer_binding_ref", peer.peer_binding_ref),
             ("request_id", expect.request_id), ("operation_id", expect.operation_id), ("operation_binding_ref", expect.operation_binding_ref))
    for key, want in exact:
        got = res[key]
        if not isinstance(got, str) or got != want:  # byte-exact: no strip, no case folding
            return _unknown(f"mismatch:{key}")
    if not is_pos_int(res["peer_binding_revision"]) or res["peer_binding_revision"] != peer.peer_binding_revision:
        return _unknown("mismatch:peer_binding_revision")
    if not is_pos_int(res["observed_epoch"]):
        return _unknown("malformed:observed_epoch")
    if res["observed_epoch"] < expect.writer_epoch:
        return _unknown("epoch_regressed")
    state, terminal, commit, reason, error = res["state"], res["terminal"], res["commit"], res["reason_code"], res["error_code"]
    exclusive = res["exclusive_writer_established"]
    if state not in STATES or not isinstance(terminal, bool) or not isinstance(exclusive, bool):
        return _unknown("malformed:state")
    if error is not None and not is_ref(error):
        return _unknown("malformed:error_code")
    if state == "in_flight":
        ok = terminal is False and commit is None and reason == "handler_active" and error is None
        return ReceiptVerdict("in_flight", False, "in_flight") if ok else _unknown("contradiction")
    if state == "unknown":
        ok = terminal is False and commit is None and reason in UNKNOWN_REASONS and error is None
        return _unknown(f"remote:{reason}" if ok else "contradiction")
    # terminal states: an authoritative terminal fact needs an established exclusive writer
    if terminal is not True or exclusive is not True:
        return _unknown("contradiction")
    if state == "committed":
        if reason is not None or error is not None or not isinstance(commit, dict) or set(commit) != {"user_id", "revision_before", "revision_after"}:
            return _unknown("contradiction")
        if commit["user_id"] != expect.person_id or not isinstance(commit["user_id"], str):
            return _unknown("mismatch:commit.user_id")
        before, after = commit["revision_before"], commit["revision_after"]
        if not (is_pos_int(before) and is_pos_int(after)) or before != expect.revision_before or after <= before:
            return _unknown("mismatch:commit.revision")
        return ReceiptVerdict("committed", True, "committed", {"user_id": commit["user_id"], "revision_before": before, "revision_after": after})
    # never_committed
    if commit is not None or reason not in NEVER_REASONS:
        return _unknown("contradiction")
    if reason == "pre_effect_refused":
        if error is None:
            return _unknown("contradiction")  # a proved pre-effect refusal keeps its stable code
        return ReceiptVerdict("never_committed", True, "pre_effect_refused")
    if error is not None:
        return _unknown("contradiction")
    if (context is None or context.exclusive_writer_established is not True or context.repository_id != expect.repository_id
            or context.writer_epoch != res["observed_epoch"] or context.owner_id != peer.query_owner_id):
        return _unknown("ownership_unproven")
    return ReceiptVerdict("never_committed", True, "recovered_uncommitted")


class OneCommitLedger:
    """One central commit per original operation (in memory; the durable form is the CR-ACR7-FENCE-02 intent table)."""

    def __init__(self) -> None:
        self._terminal: dict[tuple[str, ...], tuple[Any, ...]] = {}
        self._transitions: dict[tuple[Any, ...], tuple[str, ...]] = {}
        self.conflicts = 0

    @staticmethod
    def key(expect: ReceiptExpectation) -> tuple[str, ...]:
        return (expect.repository_id, expect.peer.value, expect.request_id, expect.operation_id, expect.operation_binding_ref)

    def _conflict(self) -> str:
        self.conflicts += 1
        return "conflict"

    def record(self, expect: ReceiptExpectation, verdict: ReceiptVerdict) -> str:
        """`settled` (first terminal fact), `duplicate` (the same fact again), `open` (not terminal yet) or `conflict`."""
        key = self.key(expect)
        if not verdict.settles:
            return self._conflict() if key in self._terminal else "open"
        fact = (verdict.state, verdict.code, tuple(sorted((verdict.commit or {}).items())))
        if key in self._terminal:
            return "duplicate" if self._terminal[key] == fact else self._conflict()
        if verdict.state == "committed" and verdict.commit is not None:
            transition = (expect.repository_id, verdict.commit["user_id"], verdict.commit["revision_before"])
            owner = self._transitions.get(transition)
            if owner is not None and owner != key:
                return self._conflict()
            self._transitions[transition] = key
        self._terminal[key] = fact
        return "settled"
