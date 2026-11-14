"""WKWRITE-295 (WisKey round 4: items 8-9 / Q02 and item 16 / Q08): Arx's native people writes to WisKey over the pairing.

Contract: WisKey `reference/NATIVE_WRITE_V1.md` (`wiskey-native-bridge-write.v1`), producer source read at WisKey product CODE
d2579588b0b8 (`native_peer_write_api.py`, `access/native_peer_storage.py`, `trusted_actions/envelope.py`, `name_reference_api.py`,
`admin_operations_api.py`). Arx owns the durable intent, the operator RBAC decision, COMMIT-before-I/O, the exclusive writer and the
crash lineage; those live in services/wiskey_write_lineage.py. The transport is a port (services/wiskey_command_port.py).

One people write (`NativePeopleWriter.write`), in this order:
 1. `peer_writes/source_v1` (empty parameters) is read FIRST and parsed strictly (`parse_source`): the original write binding
    (peer_binding_ref + revision), the opaque `descriptor_epoch`, repository, verified peer and the exact service `query_owner_id`.
    Nothing is invented: no epoch, no HA user, no binding.
 2. Arx builds its GENERALIZED_W1 Request descriptor (`build_descriptor`) from its own fresh RBAC decision: human actor, interactive
    channel, target = the person (or the create origin), binding_revision = the observed write-binding revision, request schema
    `urn:wiskey:native-bridge:<action>` revision "1", parameter transport `agreed_sensitive_opaque_reference` with an opaque random
    parameter reference (never a hash, never a value), TTL <= 15 s.
 3. The FULL original7 - the six observed source fields + the complete descriptor object - is COMMITTED to the lineage (encrypted),
    exactly as it will be sent, before any byte of the mutation leaves Arx.
 4. The send marker is committed (`begin_send`), then the ORIGINAL command (users/create, users/update, ..., cards/add) goes out with
    its original business parameters + the actor attribution `{id, display_name}` + the optional `peer_write` object. Raw private
    values (PIN, card number) exist only in that parameter object for that one call.
 5. The ACK `{schema_version, contract, result, receipt, replay_available:false}` is verified against the stored original7
    (`verify_ack` / `verify_receipt`, the 16-field `wiskey-native-peer-source.v2` receipt): committed. users/delete must carry the
    LAST ACTUAL native revision (the revision sent), never a fabricated successor.
 6. No verified answer -> UNKNOWN. `resolve` asks the existing `peer_receipts/resolve` with a CURRENT read binding
    (`peer_bindings/get` initialize) and the stored exact original7: `found` -> committed; anything else stays UNKNOWN. A missing or
    unreadable original stays UNKNOWN. Nothing is ever re-sent or reconstructed (owner decision; there is no API that could).

name_ref (`rename`, item 16): the original 60-second carrier. The intent (bindings only, never the name) is committed first; the raw
display name is in the `users/name_ref_prepare_v1` parameters only; `users/name_ref_apply_v1` follows on the same port (same
connection and actor - WisKey binds the carrier to both); a lost apply answer is resolved with `users/bulk_receipt` WITHOUT an
`actor` parameter, i.e. by the same pairing-service actor that applied it (`resolve_name_ref`).

Refusal reading (conservative, from the WisKey source at d2579588): a VERIFIED error settles as `refused` only for codes WisKey raises
strictly before its person commit (PRE_EFFECT_CODES). Every other code - including binding_denied, source_changed, Unauthorized,
name_ref_expired, name_ref_consumed, original_already_committed, bridge_outcome_unknown - may follow a commit and is UNKNOWN.

Status (honest): implemented and tested against a fake WisKey that follows the published contracts (tests/test_wkwrite_295.py) and
against real process exits (tests/test_wkwrite_295_crash.py). NOT wired to a router, NOT connected to the direct transport (Agent A,
pilot/WKDIRECT-295, implements the port), NOT installed, NOT live.
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Mapping

from . import wiskey_command_port as port_api
from .wiskey_command_port import WiskeyCommandError, WiskeyCommandPort
from .wiskey_write_lineage import LineageError, WriteLineage, is_count, is_ref

log = logging.getLogger(__name__)

CONTRACT = "wiskey-native-bridge-write.v1"
SOURCE_COMMAND = "peer_writes/source_v1"
READ_BINDING_COMMAND = "peer_bindings/get"
RESOLVE_COMMAND = "peer_receipts/resolve"
NAME_REF_PREPARE = "users/name_ref_prepare_v1"
NAME_REF_APPLY = "users/name_ref_apply_v1"
BULK_RECEIPT = "users/bulk_receipt"
ACTIONS = frozenset({"users/create", "users/update", "users/set_active", "users/archive", "users/unarchive", "users/temporary_cancel",
                     "users/delete", "cards/add", "cards/remove"})
SCHEMA_PREFIX = "urn:wiskey:native-bridge:"
SCHEMA_REVISION = "1"
PARAMETER_TRANSPORT = "agreed_sensitive_opaque_reference"
W1_CONTRACT = "wiskey-arx-generalized-w1-draft.3"
REQUEST_TTL = timedelta(seconds=15)
SEND_TTL = timedelta(seconds=10)  # Arx's own descriptor lifetime: inside WisKey's 15 s, with room for the round trip
DECISION_MAX_AGE = timedelta(seconds=10)  # an RBAC decision older than this is not "current" for a new write
READ_SCOPE = "central_capture_person_commit"
RESOLVE_REQUEST_MAX = 65536
RECEIPT_FORMAT = "wiskey-native-peer-source.v2"
ORIGINAL_FIELDS = ("repository_id", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision", "query_owner_id",
                   "descriptor_epoch", "original")
RECEIPT_FIELDS = frozenset(ORIGINAL_FIELDS) | {"schema", "source_epoch", "create_origin_ref", "capture_original", "user_id",
                                               "person_revision", "central_state", "device_application", "signed_capture_covered"}
SOURCE_FIELDS = frozenset({"schema_version", "contract", "repository_id", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision",
                           "query_owner_id", "descriptor_epoch", "commands", "request_schema_prefix", "request_schema_revision",
                           "delete_person_revision", "replay_available"})
ACK_FIELDS = frozenset({"schema_version", "contract", "result", "receipt", "replay_available"})
NAME_REF_RECEIPT_SCHEMA = "wiskey-name-ref-receipt.v1"
NAME_REF_RECEIPT_FIELDS = frozenset({"schema", "operation_id", "request_id", "name_ref", "person_ref", "actor", "source_epoch",
                                     "expected_person_revision", "person_revision", "saved_at", "action", "user_ids", "changed", "stations"})
NAME_REF_RE = re.compile(r"[A-Za-z0-9_-]{16,128}")
NAME_MAX = 32  # WisKey users/name_ref_prepare_v1 display_name maxLength

# the original business parameters of each action (COMMAND_CATALOG.jsonl, closed schemas); `actor` and `peer_write` are added here,
# `api_contract` is never sent by this path
BUSINESS_KEYS: dict[str, tuple[frozenset[str], frozenset[str]]] = {  # command -> (allowed, required)
    "users/create": (frozenset({"data", "sync_now"}), frozenset({"data"})),
    "users/update": (frozenset({"user_id", "revision", "data", "sync_now"}), frozenset({"user_id", "revision", "data"})),
    "users/set_active": (frozenset({"user_id", "revision", "active"}), frozenset({"user_id", "revision", "active"})),
    "users/archive": (frozenset({"user_id", "revision", "confirmed"}), frozenset({"user_id", "revision", "confirmed"})),
    "users/unarchive": (frozenset({"user_id", "revision", "confirmed"}), frozenset({"user_id", "revision", "confirmed"})),
    "users/temporary_cancel": (frozenset({"user_id", "revision", "reason_code"}), frozenset({"user_id", "revision", "reason_code"})),
    "users/delete": (frozenset({"user_id", "revision"}), frozenset({"user_id", "revision"})),
    "cards/add": (frozenset({"user_id", "revision", "data"}), frozenset({"user_id", "revision", "data"})),
    "cards/remove": (frozenset({"user_id", "revision", "card_id"}), frozenset({"user_id", "revision", "card_id"})),
}
# codes WisKey raises strictly BEFORE its person transaction commits (source reading at d2579588); everything else is UNKNOWN
PRE_EFFECT_CODES = frozenset({"invalid_fields", "revision_conflict", "user_not_found", "native_write_source_not_observed",
                              "native_write_action_unsupported", "name_ref_unknown", "request_too_large", "unknown_command"})


class NativeWriteError(Exception):
    """A refusal BEFORE the intent was committed (nothing was sent for the mutation)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _instant(at: datetime) -> str:
    return at.astimezone(timezone.utc).isoformat(timespec="milliseconds")


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _json_tree(value: Any, depth: int = 0) -> bool:
    if depth > 32:
        return False
    if value is None or isinstance(value, (bool, str)):
        return True
    if isinstance(value, int):
        return -(2 ** 53 - 1) <= value <= 2 ** 53 - 1
    if isinstance(value, list):
        return all(_json_tree(v, depth + 1) for v in value)
    if isinstance(value, dict):
        return all(isinstance(k, str) and _json_tree(v, depth + 1) for k, v in value.items())
    return False


# ---------------------------------------------------------------- the observed source

@dataclass(frozen=True)
class WriteSource:
    """`peer_writes/source_v1` exactly as WisKey returned it (closed, validated). `descriptor_epoch` is opaque."""

    repository_id: str
    verified_peer_ref: str
    peer_binding_ref: str
    peer_binding_revision: int
    query_owner_id: str
    descriptor_epoch: str
    commands: tuple[str, ...]

    @property
    def scope(self) -> str:
        """The writer scope: one exclusive Arx writer per WisKey repository and service principal."""
        return f"{self.repository_id}|{self.query_owner_id}"[:128]

    def original_base(self) -> dict[str, Any]:
        return {"repository_id": self.repository_id, "verified_peer_ref": self.verified_peer_ref, "peer_binding_ref": self.peer_binding_ref,
                "peer_binding_revision": self.peer_binding_revision, "query_owner_id": self.query_owner_id,
                "descriptor_epoch": self.descriptor_epoch}


def parse_source(result: Any) -> WriteSource:
    if not isinstance(result, Mapping) or set(result) != SOURCE_FIELDS:
        raise NativeWriteError("source_invalid:fields")
    r = dict(result)
    if type(r["schema_version"]) is not int or r["schema_version"] != 1 or r["contract"] != CONTRACT:
        raise NativeWriteError("source_invalid:version")
    for key in ("repository_id", "verified_peer_ref", "peer_binding_ref", "query_owner_id", "descriptor_epoch"):
        if not is_ref(r[key]):
            raise NativeWriteError(f"source_invalid:{key}")
    if not is_count(r["peer_binding_revision"]):
        raise NativeWriteError("source_invalid:peer_binding_revision")
    cmds = r["commands"]
    if not isinstance(cmds, list) or not cmds or not all(isinstance(c, str) for c in cmds) or len(set(cmds)) != len(cmds):
        raise NativeWriteError("source_invalid:commands")
    if (r["request_schema_prefix"] != SCHEMA_PREFIX or r["request_schema_revision"] != SCHEMA_REVISION
            or r["delete_person_revision"] != "last_native_revision" or r["replay_available"] is not False):
        raise NativeWriteError("source_invalid:contract_terms")
    return WriteSource(r["repository_id"], r["verified_peer_ref"], r["peer_binding_ref"], r["peer_binding_revision"], r["query_owner_id"],
                       r["descriptor_epoch"], tuple(cmds))


# ---------------------------------------------------------------- the Arx actor and decision

@dataclass(frozen=True)
class WriteActor:
    """The Arx operator the write is attributed to: the authenticated actor attribution inside the signed command and the descriptor's
    human actor. `session_active` is Arx's own fact about that operator's interactive session."""

    user_id: str
    display_name: str
    session_active: bool

    def check(self) -> None:
        if not is_ref(self.user_id) or not isinstance(self.display_name, str) or len(self.display_name) > 256:
            raise NativeWriteError("invalid_actor")
        if self.session_active is not True:
            raise NativeWriteError("actor_session_inactive")  # WisKey refuses a human whose session is not active


@dataclass(frozen=True)
class ArxDecision:
    """Arx's fresh RBAC decision for this one write (Arx RBAC is the only authority for Arx-started actions)."""

    decision_id: str
    grant_id: str
    grant_revision: int
    permission_revision: int
    decided_at: datetime

    def check(self) -> None:
        if not (is_ref(self.decision_id) and is_ref(self.grant_id) and type(self.grant_revision) is int and self.grant_revision >= 0
                and type(self.permission_revision) is int and self.permission_revision >= 0 and isinstance(self.decided_at, datetime)
                and self.decided_at.tzinfo is not None):
            raise NativeWriteError("invalid_decision")


def arx_decision(conn: sqlite3.Connection, principal: Any, permission: str, targets: list[tuple[str, str]],
                 *, clock: Callable[[], datetime] = _utcnow) -> ArxDecision:
    """A fresh Arx RBAC decision: `permission` must be allowed on EVERY target (e.g. each station of the person, before and after the
    change - the caller's existing gate computes that list). Refused -> NativeWriteError('rbac_denied'); nothing is sent."""
    from .. import rbac
    from ..db import permission_revision

    if not targets:
        raise NativeWriteError("rbac_denied")
    grant = None
    for target in targets:
        d = rbac.authorize(conn, principal, permission, target)
        if not d.allowed:
            raise NativeWriteError("rbac_denied")
        grant = grant or d.binding_id
    rev = permission_revision(conn)
    return ArxDecision(decision_id=str(uuid.uuid4()), grant_id=grant or f"arx-rbac:{permission}"[:128], grant_revision=rev,
                       permission_revision=rev, decided_at=clock())


# ---------------------------------------------------------------- the W1 descriptor

def schema_id(action: str) -> str:
    return SCHEMA_PREFIX + action.replace("/", ":")


def build_descriptor(*, action: str, actor: WriteActor, decision: ArxDecision, logical_target_id: str, binding_revision: int,
                     request_id: str, operation_id: str, operation_binding_ref: str, parameter_reference: str, issued_at: datetime,
                     ttl: timedelta = SEND_TTL) -> dict[str, Any]:
    """Arx's original GENERALIZED_W1 Request object for one native write. It is stored and sent as THIS object (never rebuilt)."""
    if action not in ACTIONS:
        raise NativeWriteError("action_unsupported")
    if not timedelta(0) < ttl <= REQUEST_TTL:
        raise NativeWriteError("invalid_ttl")
    if not timedelta(0) <= issued_at - decision.decided_at <= DECISION_MAX_AGE:
        raise NativeWriteError("decision_stale")  # the RBAC decision must be fresh for THIS write (and never from the future)
    issued = _instant(issued_at)
    decided = issued  # WisKey requires issued_at <= decided_at <= now + 2 s; the fresh decision is bound at the issue instant
    sid = schema_id(action)
    descriptor = {
        "contract_version": W1_CONTRACT,
        "request_id": request_id,
        "actor": {"kind": "human", "user_id": actor.user_id},
        "action": action,
        "channel": "interactive",
        "target": {"logical_target_id": logical_target_id, "binding_revision": binding_revision},
        "grant": {"grant_id": decision.grant_id, "grant_revision": decision.grant_revision,
                  "permission_revision": decision.permission_revision, "decision_id": decision.decision_id},
        "operation_id": operation_id,
        "operation_binding_ref": operation_binding_ref,
        "issued_at": issued,
        "request_expires_at": _instant(issued_at + ttl),
        "selection_revision": "rev1",
        "operation": {"request_schema_id": sid, "request_schema_revision": SCHEMA_REVISION, "parameter_reference": parameter_reference,
                      "public_descriptor_revision": 1, "permission_revision": decision.permission_revision, "selection_revision": "rev1",
                      "parameter_transport": PARAMETER_TRANSPORT},
        "decision": {"decision_id": decision.decision_id, "grant_revision": decision.grant_revision,
                     "permission_revision": decision.permission_revision, "binding_revision": binding_revision, "selection_revision": "rev1",
                     "decided_at": decided, "request_id": request_id, "operation_id": operation_id,
                     "operation_binding_ref": operation_binding_ref, "request_schema_id": sid, "request_schema_revision": SCHEMA_REVISION},
    }
    check_descriptor(descriptor)
    return descriptor


_TOP = frozenset({"contract_version", "request_id", "actor", "action", "channel", "target", "grant", "operation_id", "operation_binding_ref",
                  "issued_at", "request_expires_at", "selection_revision", "operation", "decision"})
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def check_descriptor(d: Any) -> None:
    """Arx-side mirror of WisKey's `Request.parse` closed shape and cross-field equalities for the native-write subset (so a malformed
    descriptor is an Arx refusal before COMMIT, not a round trip)."""
    def fail(why: str) -> None:
        raise NativeWriteError(f"descriptor_invalid:{why}")

    if not isinstance(d, dict) or set(d) != _TOP:
        fail("fields")
    if d["contract_version"] != W1_CONTRACT or d["action"] not in ACTIONS or d["channel"] != "interactive" or d["selection_revision"] != "rev1":
        fail("terms")
    if not isinstance(d["request_id"], str) or not _UUID.fullmatch(d["request_id"]):
        fail("request_id")
    if not isinstance(d["actor"], dict) or set(d["actor"]) != {"kind", "user_id"} or d["actor"]["kind"] != "human" \
            or not is_ref(d["actor"]["user_id"]):
        fail("actor")
    t, g, o, c = d["target"], d["grant"], d["operation"], d["decision"]
    if not all(isinstance(x, dict) for x in (t, g, o, c)):
        fail("fields")
    if set(t) != {"logical_target_id", "binding_revision"} or set(g) != {"grant_id", "grant_revision", "permission_revision", "decision_id"}:
        fail("target_or_grant")
    if set(o) != {"request_schema_id", "request_schema_revision", "parameter_reference", "public_descriptor_revision", "permission_revision",
                  "selection_revision", "parameter_transport"}:
        fail("operation")
    if set(c) != {"decision_id", "grant_revision", "permission_revision", "binding_revision", "selection_revision", "decided_at", "request_id",
                  "operation_id", "operation_binding_ref", "request_schema_id", "request_schema_revision"}:
        fail("decision")
    pairs = [(g["decision_id"], c["decision_id"]), (g["grant_revision"], c["grant_revision"]), (g["permission_revision"], c["permission_revision"]),
             (g["permission_revision"], o["permission_revision"]), (t["binding_revision"], c["binding_revision"]),
             (d["selection_revision"], c["selection_revision"]), (d["selection_revision"], o["selection_revision"]),
             (d["request_id"], c["request_id"]), (d["operation_id"], c["operation_id"]), (d["operation_binding_ref"], c["operation_binding_ref"]),
             (o["request_schema_id"], c["request_schema_id"]), (o["request_schema_revision"], c["request_schema_revision"])]
    if any(a != b or type(a) is not type(b) for a, b in pairs):
        fail("binding")
    if o["request_schema_id"] != schema_id(d["action"]) or o["request_schema_revision"] != SCHEMA_REVISION or o["parameter_transport"] != PARAMETER_TRANSPORT:
        fail("schema")
    for box in (d, t, g, o, c, d["actor"]):
        for value in box.values():
            if isinstance(value, str) and not is_ref(value):
                fail("reference")
            if isinstance(value, bool) or (isinstance(value, int) and value < 0):
                fail("integer")
    try:
        issued, expires, decided = (datetime.fromisoformat(x) for x in (d["issued_at"], d["request_expires_at"], c["decided_at"]))
    except (TypeError, ValueError):
        fail("instant")
    if issued.tzinfo is None or not timedelta(0) < expires - issued <= REQUEST_TTL or not issued <= decided:
        fail("ttl")


# ---------------------------------------------------------------- receipts and acknowledgements

class ReceiptMismatch(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def verify_receipt(receipt: Any, *, original7: Mapping[str, Any], command: str, target_ref: str | None, revision_sent: int | None,
                   create_origin_ref: str | None) -> tuple[str, int]:
    """The 16-field `wiskey-native-peer-source.v2` receipt of THIS original: every original field byte-equal (canonical JSON, so
    True is never 1), committed / unknown device / not capture covered, the right person and revision. Returns (user_id, revision)."""
    if not isinstance(receipt, Mapping) or set(receipt) != RECEIPT_FIELDS or not _json_tree(dict(receipt)):
        raise ReceiptMismatch("receipt:fields")
    if receipt["schema"] != RECEIPT_FORMAT:
        raise ReceiptMismatch("receipt:schema")
    for key in ORIGINAL_FIELDS:
        if _canonical(receipt[key]) != _canonical(original7[key]):
            raise ReceiptMismatch(f"receipt:original.{key}")
    if not is_ref(receipt["source_epoch"]) or receipt["capture_original"] is not None:
        raise ReceiptMismatch("receipt:source")
    if (receipt["central_state"] != "committed" or receipt["device_application"] != "unknown"
            or receipt["signed_capture_covered"] is not False):
        raise ReceiptMismatch("receipt:state")
    if receipt["create_origin_ref"] != create_origin_ref:
        raise ReceiptMismatch("receipt:create_origin_ref")
    user_id, revision = receipt["user_id"], receipt["person_revision"]
    if not is_ref(user_id) or not is_count(revision):
        raise ReceiptMismatch("receipt:person")
    if command == "users/create":
        if revision != 1:
            raise ReceiptMismatch("receipt:revision")
    else:
        if user_id != target_ref:
            raise ReceiptMismatch("receipt:user_id")
        want = revision_sent if command == "users/delete" else (revision_sent or 0) + 1
        if revision != want:
            raise ReceiptMismatch("receipt:revision")  # delete: the LAST ACTUAL native revision, never a successor
    return user_id, revision


def verify_ack(result: Any, **expect: Any) -> tuple[str, int]:
    if not isinstance(result, Mapping) or set(result) != ACK_FIELDS:
        raise ReceiptMismatch("ack:fields")
    if type(result["schema_version"]) is not int or result["schema_version"] != 1 or result["contract"] != CONTRACT:
        raise ReceiptMismatch("ack:version")
    if result["replay_available"] is not False:
        raise ReceiptMismatch("ack:replay_available")
    return verify_receipt(result["receipt"], **expect)


# ---------------------------------------------------------------- outcomes

@dataclass(frozen=True)
class WriteOutcome:
    operation_id: str
    state: str  # committed | refused | not_sent | unknown
    code: str | None = None
    user_id: str | None = None
    person_revision: int | None = None

    @property
    def replay_permitted(self) -> bool:
        return False  # owner decision: an UNKNOWN people write is never re-sent or reconstructed automatically


AuditSink = Callable[[str, dict[str, Any]], None]


def audit_to(conn: sqlite3.Connection, principal: Any) -> AuditSink:
    """An AuditSink writing Arx audit rows (ids, command, state, codes and field NAMES only)."""
    from ..audit import audit

    def sink(action: str, details: dict[str, Any]) -> None:
        audit(conn, actor=principal, action=action, decision="allowed", resource_type="intercom_person",
              resource_id=details.get("target_ref") or "*", request_id=details.get("operation_id"), details=details)

    return sink


# ---------------------------------------------------------------- the writer

class NativePeopleWriter:
    def __init__(self, port: WiskeyCommandPort, lineage: WriteLineage, *, audit_sink: AuditSink | None = None,
                 clock: Callable[[], datetime] = _utcnow) -> None:
        if not isinstance(port, WiskeyCommandPort):
            raise TypeError("a WiskeyCommandPort is required")
        self.port = port
        self.lineage = lineage
        self.audit_sink = audit_sink
        self.clock = clock

    def _audit(self, action: str, details: dict[str, Any]) -> None:
        log.info("wiskey people write %s %s %s %s", action, details.get("command"), details.get("operation_id"), details.get("state"))
        if self.audit_sink is not None:
            try:
                self.audit_sink(action, details)
            except Exception:  # noqa: BLE001 - the write's lineage is the record; a failed audit row is logged, never fatal
                log.warning("wiskey people write: audit row not written for %s", details.get("operation_id"))

    def _require_writable(self) -> None:
        """A missing or stale lineage (or one being restored) admits no new write: refused before ANY I/O."""
        try:
            self.lineage.require_writable()
        except LineageError as exc:
            raise NativeWriteError(exc.code) from None

    async def observe_source(self) -> WriteSource:
        """Read the original write binding + descriptor_epoch (a read: no intent needed). Refusals are pre-intent."""
        try:
            result = await self.port.send_signed(SOURCE_COMMAND, {}, operation_id=None)
        except WiskeyCommandError as exc:
            raise NativeWriteError(f"source_unavailable:{exc.code}") from None
        return parse_source(result)

    # -------------------------------------------------------------- one native write

    async def write(self, command: str, parameters: Mapping[str, Any], *, actor: WriteActor, decision: ArxDecision,
                    create_origin_ref: str | None = None) -> WriteOutcome:
        if command not in ACTIONS:
            raise NativeWriteError("action_unsupported")
        allowed, required = BUSINESS_KEYS[command]
        business = dict(parameters)
        if set(business) - allowed or required - set(business) or not _json_tree(business):
            raise NativeWriteError("invalid_parameters")
        actor.check()
        decision.check()
        if command == "users/create":
            if not is_ref(create_origin_ref):
                raise NativeWriteError("create_origin_required")  # the stable Arx origin of the person (one create per origin, ever)
            target, revision = None, None
        else:
            if create_origin_ref is not None:
                raise NativeWriteError("create_origin_not_allowed")
            target, revision = business["user_id"], business["revision"]
            if not is_ref(target) or not is_count(revision):
                raise NativeWriteError("invalid_parameters")
        self._require_writable()
        source = await self.observe_source()
        if command not in source.commands:
            raise NativeWriteError("action_not_offered")
        try:
            self.lineage.acquire_writer(source.scope)
        except LineageError as exc:
            raise NativeWriteError(exc.code) from None
        operation_id, request_id = str(uuid.uuid4()), str(uuid.uuid4())
        descriptor = build_descriptor(
            action=command, actor=actor, decision=decision, logical_target_id=create_origin_ref if target is None else target,
            binding_revision=source.peer_binding_revision, request_id=request_id, operation_id=operation_id,
            operation_binding_ref=f"arx-op:{operation_id}", parameter_reference=f"arx-param:{secrets.token_hex(16)}",
            issued_at=self.clock())
        original7 = {**source.original_base(), "original": descriptor}
        try:
            self.lineage.admit(scope=source.scope, operation_id=operation_id, request_id=request_id, kind="peer_write", command=command,
                               target_ref=target, create_origin_ref=create_origin_ref, revision_sent=revision, sealed_field="original",
                               sealed_value=original7)
        except LineageError as exc:
            raise NativeWriteError(exc.code) from None
        fields = sorted(business.get("data", {})) if isinstance(business.get("data"), dict) else []
        self._audit("wiskey.people_write.intent", {"operation_id": operation_id, "command": command, "target_ref": target,
                                                   "create_origin_ref": create_origin_ref, "state": "intent", "fields": fields})
        signed = {**business, "actor": {"id": actor.user_id, "display_name": actor.display_name},
                  "peer_write": {"schema_version": 1, "descriptor_epoch": source.descriptor_epoch, "peer_binding_ref": source.peer_binding_ref,
                                 "peer_binding_revision": source.peer_binding_revision, "descriptor": descriptor,
                                 "actor_session_active": actor.session_active, "create_origin_ref": create_origin_ref}}
        # ---- crash window 1 ends here: the send marker is committed BEFORE the frame is written
        try:
            self.lineage.begin_send(operation_id)
        except LineageError as exc:  # fenced out between admit and send: nothing was sent
            signed.clear()
            self.lineage.mark_not_sent(operation_id, exc.code)
            return WriteOutcome(operation_id, "not_sent", exc.code)
        try:
            result = await self.port.send_signed(command, signed, operation_id=operation_id)
        except WiskeyCommandError as exc:
            outcome = self._failed(operation_id, exc)
        except Exception:  # noqa: BLE001 - anything else after the send began: the bytes may have left
            self.lineage.mark_unknown(operation_id, "transport_error")
            outcome = WriteOutcome(operation_id, "unknown", "transport_error")
        else:
            # ---- crash windows 2 (WisKey never committed) and 3 (WisKey committed person + receipt) are this gap: the ACK is not yet
            # recorded. A crash here leaves `sending`, which recovery turns into `unknown`; only resolve can tell 2 from 3.
            try:
                user_id, rev = verify_ack(result, original7=original7, command=command, target_ref=target, revision_sent=revision,
                                          create_origin_ref=create_origin_ref)
            except ReceiptMismatch as exc:
                self.lineage.mark_unknown(operation_id, exc.code)
                outcome = WriteOutcome(operation_id, "unknown", exc.code)
            else:
                self.lineage.mark_committed(operation_id, user_id_after=user_id, person_revision_after=rev, via="ack")
                outcome = WriteOutcome(operation_id, "committed", None, user_id, rev)
        finally:
            signed.clear()  # the raw values of this call are not kept by the writer
        self._audit("wiskey.people_write.outcome", {"operation_id": operation_id, "command": command, "target_ref": target,
                                                    "state": outcome.state, "code": outcome.code, "user_id": outcome.user_id,
                                                    "person_revision": outcome.person_revision})
        return outcome

    def _failed(self, operation_id: str, exc: WiskeyCommandError) -> WriteOutcome:
        if exc.outcome == port_api.NOT_SENT:
            self.lineage.mark_not_sent(operation_id, exc.code)
            return WriteOutcome(operation_id, "not_sent", exc.code)
        if exc.outcome == port_api.REFUSED and exc.code in PRE_EFFECT_CODES:
            self.lineage.mark_refused(operation_id, exc.code)
            return WriteOutcome(operation_id, "refused", exc.code)
        self.lineage.mark_unknown(operation_id, exc.code)
        return WriteOutcome(operation_id, "unknown", exc.code)

    # -------------------------------------------------------------- the exact-original resolve

    async def resolve(self, operation_id: str) -> WriteOutcome:
        """Read WisKey's receipt of ONE unknown write by its stored exact original. Never sends the mutation again."""
        try:
            intent = self.lineage.get(operation_id)
        except LineageError:
            return WriteOutcome(operation_id, "unknown", "original_missing")  # missing intent/original stays UNKNOWN
        if intent.kind != "peer_write":
            raise NativeWriteError("not_a_peer_write")
        if intent.state != "unknown":
            return WriteOutcome(operation_id, intent.state, intent.outcome_code, intent.user_id_after, intent.person_revision_after)
        try:
            original7 = self.lineage.sealed(operation_id, "original")
        except LineageError as exc:
            return WriteOutcome(operation_id, "unknown", exc.code)  # never rebuilt from refs
        code = await self._resolve_once(intent, original7)
        if code is None:
            fresh = self.lineage.get(operation_id)
            return WriteOutcome(operation_id, fresh.state, fresh.outcome_code, fresh.user_id_after, fresh.person_revision_after)
        self.lineage.mark_unknown(operation_id, code, proof="resolve_unknown")
        return WriteOutcome(operation_id, "unknown", code)

    async def _resolve_once(self, intent: Any, original7: dict[str, Any]) -> str | None:
        try:
            row = await self.port.send_signed(READ_BINDING_COMMAND, {"initialize": True, "expected_revision": 0}, operation_id=None)
        except WiskeyCommandError as exc:
            return f"read_binding:{exc.code}"
        if not (isinstance(row, Mapping) and row.get("state") == "active" and row.get("active") is True
                and row.get("allowed_read_scope") == READ_SCOPE and is_ref(row.get("peer_binding_ref"))
                and is_count(row.get("peer_binding_revision")) and row.get("repository_id") == original7["repository_id"]
                and row.get("verified_peer_ref") == original7["verified_peer_ref"] and row.get("query_owner_id") == original7["query_owner_id"]):
            return "read_binding:invalid"
        params = {"peer_binding_ref": row["peer_binding_ref"], "peer_binding_revision": row["peer_binding_revision"], "original": original7}
        if len(_canonical(params).encode("utf-8")) > RESOLVE_REQUEST_MAX:
            return "resolve:request_too_large"
        try:
            res = await self.port.send_signed(RESOLVE_COMMAND, params, operation_id=intent.operation_id)
        except WiskeyCommandError as exc:
            return f"resolve:{exc.code}"
        if not isinstance(res, Mapping) or set(res) != {"schema_version", "state", "receipt"} or type(res["schema_version"]) is not int \
                or res["schema_version"] != 1:
            return "resolve:fields"
        if res["state"] == "unknown" and res["receipt"] is None:
            return "remote:unknown"
        if res["state"] != "found":
            return "resolve:contradiction"
        try:
            user_id, rev = verify_receipt(res["receipt"], original7=original7, command=intent.command, target_ref=intent.target_ref,
                                          revision_sent=intent.revision_sent, create_origin_ref=intent.create_origin_ref)
        except ReceiptMismatch as exc:
            return exc.code
        self.lineage.mark_committed(intent.operation_id, user_id_after=user_id, person_revision_after=rev, via="resolve")
        self._audit("wiskey.people_write.resolved", {"operation_id": intent.operation_id, "command": intent.command,
                                                     "target_ref": intent.target_ref, "state": "committed", "user_id": user_id,
                                                     "person_revision": rev})
        return None

    # -------------------------------------------------------------- name_ref (item 16)

    async def rename(self, *, person_ref: str, expected_person_revision: int, display_name: str, actor: WriteActor,
                     decision: ArxDecision) -> WriteOutcome:
        """Change a person's display name through the original 60 s name_ref carrier. The name is in the prepare parameters ONLY.
        W031-295: admitted like every other native people write - the operator's fresh Arx RBAC decision (`arx_decision`, at most
        DECISION_MAX_AGE old, never from the future) is required; it is checked here and adds nothing to the wire."""
        actor.check()
        decision.check()
        if not timedelta(0) <= self.clock() - decision.decided_at <= DECISION_MAX_AGE:
            raise NativeWriteError("decision_stale")
        if not (is_ref(person_ref) and is_count(expected_person_revision) and expected_person_revision < 2 ** 53 - 1):
            raise NativeWriteError("invalid_parameters")
        if not isinstance(display_name, str) or not 1 <= len(display_name) <= NAME_MAX:
            raise NativeWriteError("invalid_parameters")
        self._require_writable()
        source = await self.observe_source()
        try:
            self.lineage.acquire_writer(source.scope)
        except LineageError as exc:
            raise NativeWriteError(exc.code) from None
        operation_id, request_id = str(uuid.uuid4()), str(uuid.uuid4())
        bindings = {"person_ref": person_ref, "expected_person_revision": expected_person_revision, "request_id": request_id,
                    "operation_id": operation_id}
        try:
            self.lineage.admit(scope=source.scope, operation_id=operation_id, request_id=request_id, kind="name_ref", command=NAME_REF_APPLY,
                               target_ref=person_ref, create_origin_ref=None, revision_sent=expected_person_revision, sealed_field="bindings",
                               sealed_value=bindings)
        except LineageError as exc:
            raise NativeWriteError(exc.code) from None
        self._audit("wiskey.people_write.intent", {"operation_id": operation_id, "command": NAME_REF_APPLY, "target_ref": person_ref,
                                                   "state": "intent", "fields": ["display_name"]})
        prepare = {**bindings, "display_name": display_name}
        try:
            carrier = await self.port.send_signed(NAME_REF_PREPARE, prepare, operation_id=operation_id)
        except WiskeyCommandError as exc:
            # the carrier is volatile, bound to this connection + actor and usable only by its unreturned ref: no effect can follow
            carrier, code = None, f"prepare:{exc.code}"
        except Exception:  # noqa: BLE001
            carrier, code = None, "prepare:transport_error"
        finally:
            prepare.clear()
        if carrier is not None:
            ok = (isinstance(carrier, Mapping) and set(carrier) == {"name_ref", "expires_at"} and isinstance(carrier["name_ref"], str)
                  and NAME_REF_RE.fullmatch(carrier["name_ref"]) is not None and isinstance(carrier["expires_at"], str))
            code = None if ok else "prepare:unverified"
        if code is not None:
            self.lineage.mark_not_sent(operation_id, code)
            return self._name_outcome(WriteOutcome(operation_id, "not_sent", code), person_ref)
        try:
            self.lineage.begin_send(operation_id)
        except LineageError as exc:
            self.lineage.mark_not_sent(operation_id, exc.code)
            return self._name_outcome(WriteOutcome(operation_id, "not_sent", exc.code), person_ref)
        try:
            ack = await self.port.send_signed(NAME_REF_APPLY, {**bindings, "name_ref": carrier["name_ref"]}, operation_id=operation_id)
        except WiskeyCommandError as exc:
            return self._name_outcome(self._failed(operation_id, exc), person_ref)
        except Exception:  # noqa: BLE001
            self.lineage.mark_unknown(operation_id, "transport_error")
            return self._name_outcome(WriteOutcome(operation_id, "unknown", "transport_error"), person_ref)
        want = {"person_ref": person_ref, "person_revision": expected_person_revision + 1, "operation_id": operation_id, "state": "committed"}
        if not isinstance(ack, Mapping) or _canonical(dict(ack)) != _canonical(want):
            self.lineage.mark_unknown(operation_id, "ack:unverified")
            return self._name_outcome(WriteOutcome(operation_id, "unknown", "ack:unverified"), person_ref)
        self.lineage.mark_committed(operation_id, user_id_after=person_ref, person_revision_after=expected_person_revision + 1, via="ack")
        return self._name_outcome(WriteOutcome(operation_id, "committed", None, person_ref, expected_person_revision + 1), person_ref)

    def _name_outcome(self, outcome: WriteOutcome, person_ref: str) -> WriteOutcome:
        self._audit("wiskey.people_write.outcome", {"operation_id": outcome.operation_id, "command": NAME_REF_APPLY, "target_ref": person_ref,
                                                    "state": outcome.state, "code": outcome.code, "person_revision": outcome.person_revision})
        return outcome

    async def resolve_name_ref(self, operation_id: str) -> WriteOutcome:
        """`users/bulk_receipt` for ONE unknown name_ref apply, by the same pairing-service actor (no `actor` parameter is sent, so
        WisKey attributes the read to the same principal that applied it). Never re-applies."""
        try:
            intent = self.lineage.get(operation_id)
        except LineageError:
            return WriteOutcome(operation_id, "unknown", "original_missing")
        if intent.kind != "name_ref":
            raise NativeWriteError("not_a_name_ref")
        if intent.state != "unknown":
            return WriteOutcome(operation_id, intent.state, intent.outcome_code, intent.user_id_after, intent.person_revision_after)
        try:
            b = self.lineage.sealed(operation_id, "bindings")
        except LineageError as exc:
            return WriteOutcome(operation_id, "unknown", exc.code)
        try:
            r = await self.port.send_signed(BULK_RECEIPT, {"operation_id": operation_id}, operation_id=operation_id)
        except WiskeyCommandError as exc:
            code = f"bulk_receipt:{exc.code}"  # operation_not_found is NOT a never-committed proof (an apply may still be committing)
        else:
            code = _name_receipt_mismatch(r, b)
        if code is not None:
            self.lineage.mark_unknown(operation_id, code, proof="resolve_unknown")
            return WriteOutcome(operation_id, "unknown", code)
        rev = b["expected_person_revision"] + 1
        self.lineage.mark_committed(operation_id, user_id_after=b["person_ref"], person_revision_after=rev, via="resolve")
        self._audit("wiskey.people_write.resolved", {"operation_id": operation_id, "command": NAME_REF_APPLY, "target_ref": b["person_ref"],
                                                     "state": "committed", "person_revision": rev})
        return WriteOutcome(operation_id, "committed", None, b["person_ref"], rev)

    # -------------------------------------------------------------- recovery

    def recover(self, scope: str) -> dict[str, int]:
        return self.lineage.recover(scope)


def _name_receipt_mismatch(r: Any, b: Mapping[str, Any]) -> str | None:
    if not isinstance(r, Mapping) or set(r) != NAME_REF_RECEIPT_FIELDS:
        return "name_receipt:fields"
    if r["schema"] != NAME_REF_RECEIPT_SCHEMA or r["action"] != NAME_REF_APPLY:
        return "name_receipt:schema"
    for key in ("operation_id", "request_id", "person_ref", "expected_person_revision"):
        if _canonical(r[key]) != _canonical(b[key]):
            return f"name_receipt:{key}"
    if (r["person_revision"] != b["expected_person_revision"] + 1 or type(r["person_revision"]) is not int or r["changed"] != 1
            or type(r["changed"]) is not int or r["user_ids"] != [b["person_ref"]]):
        return "name_receipt:commit"
    if not (isinstance(r["name_ref"], str) and NAME_REF_RE.fullmatch(r["name_ref"]) and is_ref(r["actor"]) and is_ref(r["source_epoch"])):
        return "name_receipt:refs"
    return None
