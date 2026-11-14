"""Explicit schema 17 candidate: native people and exact peer receipts together.

This table is private engine storage. It is not a new W1 wire field, a live
transport credential, a physical device receipt, or an automatic migration.
No receipt/create fence is evicted; the bounded candidate refuses admission.
"""

from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from threading import Lock
from typing import Any

from ..trusted_actions.envelope import Request, thaw
from ..trusted_actions.peer_boundary import PeerMessage, counter
from ..trusted_actions.validation import Refusal, aware, reference, strict_json
from .atomic_person_store import PERSON_MAX_BYTES, RECEIPT_MAX_BYTES, canonical
from .models import AccessError, ManagedUser

FORMAT = "wiskey-native-peer-source.v2"
MAX_RECEIPTS = 1024
MAX_RECEIPT_LIMIT = 1_000_000
MAX_BINDINGS = 128
MAX_BINDING_VERSIONS = 1024
JSON_SAFE_REVISION = 2**53 - 1
RECEIPT_FIELDS = frozenset(
    {
        "schema",
        "repository_id",
        "verified_peer_ref",
        "peer_binding_ref",
        "peer_binding_revision",
        "query_owner_id",
        "descriptor_epoch",
        "source_epoch",
        "original",
        "create_origin_ref",
        "capture_original",
        "user_id",
        "person_revision",
        "central_state",
        "device_application",
        "signed_capture_covered",
    }
)
ORIGINAL_FIELDS = frozenset(
    {
        "repository_id",
        "verified_peer_ref",
        "peer_binding_ref",
        "peer_binding_revision",
        "query_owner_id",
        "descriptor_epoch",
        "original",
    }
)


class _ReceiptGrammarCache:
    """Bounded successful historical grammar, keyed by FULL canonical bytes.

    No live transport/context, current clock, policy or authorization verdict is
    stored. Cross-record references/fences are checked afresh by _validate.
    """

    def __init__(self, max_entries=16_384, max_bytes=32 * 1024**2):
        if (
            type(max_entries) is not int
            or not 1 <= max_entries <= 16_384
            or type(max_bytes) is not int
            or not 1 <= max_bytes <= 32 * 1024**2
        ):
            raise ValueError("bounded structural grammar cache required")
        self._entries, self._bytes = OrderedDict(), 0
        self._max_entries, self._max_bytes = max_entries, max_bytes
        self._lock = Lock()

    def contains(self, encoded):
        with self._lock:
            if encoded not in self._entries:
                return False
            self._entries.move_to_end(encoded)
            return True

    def remember(self, encoded):
        if type(encoded) is not bytes or len(encoded) > self._max_bytes:
            return
        with self._lock:
            if encoded in self._entries:
                self._entries.move_to_end(encoded)
                return
            while self._entries and (
                len(self._entries) >= self._max_entries
                or self._bytes + len(encoded) > self._max_bytes
            ):
                old, _ = self._entries.popitem(last=False)
                self._bytes -= len(old)
            self._entries[encoded] = True
            self._bytes += len(encoded)


_RECEIPT_GRAMMAR = _ReceiptGrammarCache()


def defaults(*, receipt_limit: int = MAX_RECEIPTS) -> dict:
    if type(receipt_limit) is not int or not 1 <= receipt_limit <= MAX_RECEIPT_LIMIT:
        raise ValueError("explicit bounded candidate receipt admission required")
    return {
        "schema": FORMAT,
        "repository_id": None,
        "heads": {},
        "versions": {},
        "receipts": {},
        "pin_quarantine": None,
        "receipt_limit": receipt_limit,
    }


def original(message: PeerMessage) -> dict:
    if type(message) is not PeerMessage or type(message.request) is not Request:
        raise Refusal("binding_denied")
    message.check()
    verified = message.verification
    result = {
        "repository_id": verified.repository_id,
        "verified_peer_ref": verified.verified_peer_ref,
        "peer_binding_ref": verified.peer_binding_ref,
        "peer_binding_revision": verified.peer_binding_revision,
        "query_owner_id": message.query_owner_id,
        "descriptor_epoch": verified.descriptor.epoch,
        "original": thaw(message.request.descriptor),
    }
    validate_original(result)
    return result


def validate_original(value: Any) -> None:
    if type(value) is not dict or set(value) != ORIGINAL_FIELDS:
        raise ValueError("invalid original peer reference")
    for key in ORIGINAL_FIELDS - {"peer_binding_revision", "original"}:
        reference(value[key])
    counter(value["peer_binding_revision"])
    descriptor = value["original"]
    # Structural historical validation at the original issue instant cannot
    # recreate a PeerMessage, live authority, registry grant or transport.
    encoded = canonical(descriptor, RECEIPT_MAX_BYTES)
    if type(descriptor) is not dict:
        raise ValueError("invalid original descriptor")
    issued = aware(descriptor.get("issued_at"))
    parsed = Request.parse(encoded, issued)
    if thaw(parsed.descriptor) != descriptor:
        raise ValueError("invalid original descriptor")


def validate(table: Any) -> None:
    try:
        _validate(table)
    except (KeyError, TypeError, ValueError, AttributeError, Refusal):
        raise AccessError("invalid_storage") from None


def validate_ecc_revisions(table: dict) -> None:
    """New ECC profile only; old candidate history stays loadable as its format.

    Do not normalize or discard an old out-of-wire-range record to make it fit.
    """
    def revision(value):
        if type(value) is not int or not 1 <= value <= JSON_SAFE_REVISION:
            raise AccessError("unsafe_peer_revision")

    for head in table["heads"].values():
        revision(head)
    for history in table["versions"].values():
        for key in history:
            revision(int(key))
    for operations in table["receipts"].values():
        for receipt in operations.values():
            revision(receipt["peer_binding_revision"])
            revision(receipt["person_revision"])
            # Preserve the exact signed descriptor; validation never rewrites it.
            descriptors = [receipt["original"]]
            if receipt["capture_original"] is not None:
                revision(receipt["capture_original"]["peer_binding_revision"])
                descriptors.append(receipt["capture_original"]["original"])
            for descriptor in descriptors:
                for part in (descriptor, descriptor["target"], descriptor["grant"],
                             descriptor["decision"], descriptor["operation"]):
                    for key, value in part.items():
                        if key.endswith("_revision") and type(value) is int:
                            revision(value)


def _validate(table: Any) -> None:
    if (
        type(table) is not dict
        or set(table)
        != {
            "schema",
            "repository_id",
            "heads",
            "versions",
            "receipts",
            "pin_quarantine",
            "receipt_limit",
        }
        or table["schema"] != FORMAT
    ):
        raise ValueError
    if (
        type(table["receipt_limit"]) is not int
        or not 1 <= table["receipt_limit"] <= MAX_RECEIPT_LIMIT
    ):
        raise ValueError
    from .pin_quarantine import validate as validate_pin_quarantine

    validate_pin_quarantine(table["pin_quarantine"])
    if table["repository_id"] is not None:
        reference(table["repository_id"])
    heads, versions, receipts = (table[k] for k in ("heads", "versions", "receipts"))
    if (
        any(type(v) is not dict for v in (heads, versions, receipts))
        or len(heads) > MAX_BINDINGS
        or set(heads) != set(versions)
    ):
        raise ValueError
    if table["repository_id"] is None and (heads or versions or receipts):
        raise ValueError
    version_count = 0
    for binding, head in heads.items():
        reference(binding)
        counter(head)
        history = versions[binding]
        if type(history) is not dict or not history or str(head) not in history:
            raise ValueError
        version_count += len(history)
        for revision, row in history.items():
            if (
                type(revision) is not str
                or not revision.isdecimal()
                or str(counter(int(revision))) != revision
                or int(revision) > head
                or type(row) is not dict
                or set(row) not in (
                    {"verified_peer_ref", "query_owner_id", "active", "historical_read"},
                    {"verified_peer_ref", "query_owner_id", "active", "historical_read",
                     "read_scope", "transport_entry_id"},
                )
                or type(row["active"]) is not bool
                or type(row["historical_read"]) is not bool
            ):
                raise ValueError
            reference(row["verified_peer_ref"])
            reference(row["query_owner_id"])
            if "read_scope" in row:
                if row["read_scope"] != "central_capture_person_commit":
                    raise ValueError
                reference(row["transport_entry_id"])
    if version_count > MAX_BINDING_VERSIONS:
        raise ValueError
    count = 0
    requests, origins = set(), set()
    for peer, operations in receipts.items():
        reference(peer)
        if type(operations) is not dict or not operations:
            raise ValueError
        for operation, receipt in operations.items():
            count += 1
            reference(operation)
            validate_receipt(receipt)
            metadata = {key: receipt[key] for key in ORIGINAL_FIELDS}
            descriptor = receipt["original"]
            if (
                receipt["verified_peer_ref"] != peer
                or descriptor["operation_id"] != operation
                or receipt["repository_id"] != table["repository_id"]
                or receipt["peer_binding_ref"] not in versions
                or str(receipt["peer_binding_revision"])
                not in versions[receipt["peer_binding_ref"]]
            ):
                raise ValueError
            version = versions[receipt["peer_binding_ref"]][str(receipt["peer_binding_revision"])]
            if (
                version["verified_peer_ref"] != peer
                or version["query_owner_id"] != metadata["query_owner_id"]
            ):
                raise ValueError
            key = peer, descriptor["request_id"]
            if key in requests:
                raise ValueError
            requests.add(key)
            origin = receipt["create_origin_ref"]
            if origin is not None:
                key = receipt["repository_id"], origin
                if key in origins:
                    raise ValueError
                origins.add(key)
    if count > table["receipt_limit"]:
        raise ValueError


def validate_receipt(receipt: Any) -> None:
    encoded = canonical(receipt, RECEIPT_MAX_BYTES)
    if _RECEIPT_GRAMMAR.contains(encoded):
        return
    # Validate the exact encoded snapshot, rather than a caller's dictionary
    # that another thread could mutate between encoding and cache insertion.
    _validate_receipt(strict_json(encoded, limit=RECEIPT_MAX_BYTES))
    _RECEIPT_GRAMMAR.remember(encoded)


def _validate_receipt(receipt: Any) -> None:
    if type(receipt) is not dict or set(receipt) != RECEIPT_FIELDS or receipt["schema"] != FORMAT:
        raise ValueError
    validate_original({key: receipt[key] for key in ORIGINAL_FIELDS})
    reference(receipt["source_epoch"])
    reference(receipt["user_id"])
    counter(receipt["person_revision"])
    if (
        receipt["central_state"] != "committed"
        or receipt["device_application"] != "unknown"
        or receipt["signed_capture_covered"] is not False
    ):
        raise ValueError
    action = receipt["original"]["action"]
    if action == "users/create":
        reference(receipt["create_origin_ref"])
        if receipt["person_revision"] != 1:
            raise ValueError
    elif receipt["create_origin_ref"] is not None:
        raise ValueError
    capture = receipt["capture_original"]
    if action == "cards/capture_confirm":
        validate_original(capture)
        if (
            capture["original"]["action"] != "cards/capture_start"
            or any(capture[k] != receipt[k] for k in ORIGINAL_FIELDS - {"original"})
            or capture["original"]["actor"] != receipt["original"]["actor"]
            or capture["original"]["target"] != receipt["original"]["target"]
        ):
            raise ValueError
        confirmed = aware(receipt["original"]["issued_at"])
        if not (
            aware(capture["original"]["issued_at"])
            <= confirmed
            < aware(capture["original"]["request_expires_at"])
        ):
            raise ValueError
    elif capture is not None:
        raise ValueError


def attach(
    before: dict,
    candidate: dict,
    result: Any,
    *,
    metadata: dict,
    source_epoch: str,
    create_origin: str | None = None,
    capture_original: dict | None = None,
) -> None:
    if before.get("schema") != 17 or candidate.get("schema") != 17:
        raise Refusal("candidate_migration_required")
    table = candidate["peer_source"]
    if {key: value for key, value in table.items() if key != "pin_quarantine"} != {
        key: value for key, value in before["peer_source"].items() if key != "pin_quarantine"
    }:
        raise Refusal("binding_denied")
    action = metadata["original"]["action"]
    deleting = action == "users/delete"
    if deleting:
        # Native deletion has no returned ManagedUser or successor person row.
        # Preserve its actual last revision; never manufacture revision+1 or a
        # person object. The exact original target must be the only removed row.
        user_id = metadata["original"]["target"]["logical_target_id"]
        previous = before["users"].get(user_id)
        if result is not None or type(previous) is not dict or user_id in candidate["users"]:
            raise Refusal("binding_denied")
        person_revision = counter(previous["revision"])
        saved = None
    else:
        if type(result) is not ManagedUser:
            raise Refusal("binding_denied")
        user_id, person_revision = result.id, result.revision
        previous = before["users"].get(user_id)
        saved = candidate["users"].get(user_id)
    changed = {
        uid
        for uid in set(before["users"]) | set(candidate["users"])
        if before["users"].get(uid) != candidate["users"].get(uid)
    }
    if (
        changed != {user_id}
        or not deleting and (type(saved) is not dict or saved != result.private())
        or action == "users/create"
        and (previous is not None or person_revision != 1)
        or action != "users/create" and not deleting
        and (type(previous) is not dict or person_revision != previous["revision"] + 1)
    ):
        raise Refusal("binding_denied")
    if not deleting:
        canonical(saved, PERSON_MAX_BYTES)
    receipt = {
        "schema": FORMAT,
        **deepcopy(metadata),
        "source_epoch": reference(source_epoch),
        "create_origin_ref": create_origin,
        "capture_original": deepcopy(capture_original),
        "user_id": user_id,
        "person_revision": counter(person_revision),
        "central_state": "committed",
        "device_application": "unknown",
        "signed_capture_covered": False,
    }
    validate_receipt(receipt)
    receipts = table["receipts"]
    peer = metadata["verified_peer_ref"]
    operation = metadata["original"]["operation_id"]
    request = metadata["original"]["request_id"]
    total = sum(len(v) for v in receipts.values())
    if total >= table["receipt_limit"]:
        raise Refusal("peer_receipt_capacity")
    for existing_peer, operations in receipts.items():
        for old_operation, old in operations.items():
            if existing_peer == peer and (
                old_operation == operation or old["original"]["request_id"] == request
            ):
                raise Refusal("original_already_committed")
            if (
                create_origin is not None
                and old["repository_id"] == metadata["repository_id"]
                and old["create_origin_ref"] == create_origin
            ):
                raise Refusal("original_create_already_committed")
    receipts.setdefault(peer, {})[operation] = receipt
    validate(table)


def find(table: dict, metadata: dict) -> dict | None:
    """Only the complete exact original, never a name/card/PIN/person heuristic."""
    validate_original(metadata)
    row = (
        table["receipts"]
        .get(metadata["verified_peer_ref"], {})
        .get(metadata["original"]["operation_id"])
    )
    if row is None:
        return None
    if any(row[key] != value for key, value in metadata.items()):
        raise Refusal("original_reference_mismatch")
    validate_receipt(row)
    return deepcopy(row)
