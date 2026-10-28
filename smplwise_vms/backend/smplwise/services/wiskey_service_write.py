"""WISKEY-MAC-ADOPT-298 item C: Arx's client of WisKey's FINAL `wiskey-native-service-write.v1` (Mac delivery 27.10,
04_vectors_catalog/SERVICE_WRITE_FINAL_V1.json, product CODE d5a3ab862fab45537cde2f30358e0e9d1f3f9c8b).

What the contract is (and what it is not)
- An ADDITIVE companion of `wiskey-native-bridge-write.v1`: the human / W1 people-write path (services/wiskey_native_write.py) is unchanged.
  Its receipts are NOT W1 peer receipts: nothing here calls, and nothing may hand them to, `peer_receipts/resolve`.
- Transport: the existing direct connection and the original pairing-signed `wiskey-bridge-command.v1` body. The business parameters of
  four existing commands (`users/create`, `users/update`, `users/pin_generate`, `users/temporary_cancel`) gain exactly ONE key,
  `service_write` - the closed 13-key metadata below. No fake human / automation actor, no HA user, no admin.
- Authority is the OWNER's: WisKey checks the metadata against the owner-configured `native_service_grants_v1` of the paired entry
  (owner private installer only). Arx never writes a grant, never invents one and has no fallback role: without an owner grant
  reference (`GrantRef`, read from an injected source) a write is refused HERE (`service_grant_required`, nothing sent) - no self-grant.
- `users/service_write_status_v1 {operation_id}` is the read of this owner's own record: a missing record stays UNKNOWN, never
  never_committed.

Arx's own durable journal (`wiskey_service_write_journal`, private format schema 3; created by `ensure_schema`, see the note there)
- BEFORE the frame leaves, the operation is recorded `unknown`, bound to the repository identity (the original NativePeerRegistry identity,
  supplied by the caller - established independently before the first write), the request id and the HMAC-SHA256 of the canonical
  `{command, service_write, parameters}` under an install-local key kept OUTSIDE the database (`request_mac`, `load_or_create_key`;
  stored in the `request_sha256` column). No PIN and no person value is stored (the PIN enters the digest as a presence marker only).
- The same operation again: an identical request is NEVER dispatched again (no replay after a lost receipt) - it returns the recorded
  state, except that a PIN-bearing duplicate is never `completed` (`pin_duplicate_unverified`); a different request under the same
  operation id is `service_operation_conflict`; a request id already used by another operation is
  `service_origin_or_request_already_recorded`. Capacity: 4096 rows per repository; settled rows are pruned (`Journal.prune`), UNKNOWN
  rows and rows settled less than 24 h ago never; within 64 rows of the cap a write is `service_write_capacity` and `FinalServiceWriter.available()` is False.
- A write to an existing person (`users/update`, `users/temporary_cancel`) takes the shared people write gate (`intercom_sync.SYNC`,
  `begin_external` / `end_external`, as the capture-lease confirm does): an UNKNOWN outcome holds the person until a fresh read, and
  Arx's own UNKNOWN row holds it on the service path (`service_write_unsettled`) until a status read settles it (`status`,
  `unsettled`, `settle_unknown`). `users/pin_generate` respects the gate but does not take it (it saves nothing).
- A database failure is `journal_unavailable` (not_sent) before the dispatch; after it the row simply stays UNKNOWN. Input that is not
  strict JSON is `invalid_fields` (not_sent). A generated PIN is exactly six ASCII digits; a receipt of a write to an existing person
  must name that person, else the answer is UNKNOWN.
- An UNKNOWN stays unknown until a verified `completed` result or status read (`status`); a refusal is recorded `refused`
  only for a VERIFIED error frame with one of the contract's closed refusal codes. `service_write_outcome_unknown` and every other
  code are UNKNOWN. A proven not-sent (transport) leaves the row `unknown` with code `not_sent` and the operation spent: a new attempt is
  a NEW operation id (never the same one re-sent).
- The PIN of `users/pin_generate` exists ONLY in that call's original reply (returned in memory as `ServiceWriteOutcome.pin`): it is
  never journalled, logged, put into a receipt or returned again; a duplicate never carries it.

Status: implemented and tested on fakes only (tests/test_wiskey_mac_adopt_298.py). Installed=NOT_PERFORMED, live=NOT_MEASURED. The
production writer is wired (`FinalServiceWriter.from_join`) but `available()` stays False until the owner configures a grant reference
(OWNER-CONFIG) - nothing is sent before that."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

log = logging.getLogger("smplwise.wiskey_service_write")

CONTRACT = "wiskey-native-service-write.v1"
# WISKEY-ADOPT-2272 (WisKey owner28): v2 is the permanent full installation authority - the SAME 13 metadata keys with `contract` = v2 and
# the GrantRef WisKey's installer published in its private manifest (wiskey_auto_install.ManifestGrantSource). WisKey echoes the
# request's contract in a write result; `users/service_write_status_v1` keeps answering v1. v1 stays readable for old callers.
CONTRACT_V2 = "wiskey-native-service-write.v2"
CONTRACTS = (CONTRACT, CONTRACT_V2)
SCHEMA_VERSION = 1
METADATA_PARAMETER = "service_write"
ROLE = "access_manager"
COMMANDS = ("users/create", "users/pin_generate", "users/temporary_cancel", "users/update")
STATUS_COMMAND = "users/service_write_status_v1"
META_KEYS = frozenset({"actor_id", "authority_ref", "authority_revision", "contract", "grant_id", "grant_revision", "operation_id",
                       "permission_revision", "request_id", "role", "scope_ref", "target_ref", "target_revision"})
DATA_FIELDS = frozenset({"access_category", "access_purpose", "access_timing_draft", "access_timing_policy", "active", "assignments",
                         "display_name", "employee_no", "phone", "pin", "responsible_person", "valid_from", "valid_until"})
CANCEL_REASONS = ("visit_cancelled", "visit_completed", "access_no_longer_needed")
PARAM_KEYS = {
    "users/create": (frozenset({"data"}), frozenset({"sync_now"})),
    "users/update": (frozenset({"user_id", "revision", "data"}), frozenset({"sync_now"})),
    "users/pin_generate": (frozenset({"user_id"}), frozenset()),
    "users/temporary_cancel": (frozenset({"user_id", "revision", "reason_code"}), frozenset()),
}
RESULT_KEYS = frozenset({"contract", "schema_version", "state", "code", "operation_id", "result", "receipt", "replay_available"})
STATUS_KEYS = RESULT_KEYS - {"code", "result"}  # "status has no code or result field"
STATES = ("unknown", "completed")
RECEIPT_KEYS = frozenset({"user_id", "person_revision", "central_state", "device_application"})
CENTRAL_STATES = ("saved", "unchanged_pin_generated_not_saved")
SUCCESS_CODES = ("central_saved", "pin_generated_not_saved", "operation_already_recorded")
REFUSAL_CODES = ("Unauthorized", "invalid_fields", "service_write_source_unavailable", "service_actor_mismatch", "service_grant_required",
                 "service_grant_denied", "service_grant_expired", "service_target_denied", "service_field_denied", "revision_conflict",
                 "service_operation_conflict", "service_origin_or_request_already_recorded", "service_write_capacity",
                 "service_write_outcome_unknown", "service_write_commit_mismatch", "service_write_repository_changed")
# closed refusal codes that are NOT a proof that nothing was committed: kept UNKNOWN (unknown_no_retry)
UNKNOWN_CODES = frozenset({"service_write_outcome_unknown", "service_write_commit_mismatch", "service_write_repository_changed"})
JOURNAL_SCHEMA_VERSION = 3
JOURNAL_CAPACITY = 4096  # rows per repository; UNKNOWN rows are never evicted, settled rows are pruned (review F1)
JOURNAL_HEADROOM = 64    # `available()` is False once fewer than this many rows are left
PRUNE_HIGH = 3072        # at this many rows the oldest SETTLED rows are pruned ...
PRUNE_LOW = 2048         # ... down to this many (unknown rows count, but are never removed)
SETTLED_RETENTION = timedelta(days=30)  # a settled row older than this is pruned whatever the count
PRUNE_MIN_AGE = timedelta(hours=24)     # a row settled more recently than this is never pruned (a prompt retry stays observed)
MAX_REF = 128
MAX_REVISION = 9007199254740991
SERVICE_ACTOR_PREFIX = "arx-service:"
KEY_NAME = "wiskey-service-write.key"  # the install-local HMAC key of the journal's request digest (review F4), never in the database
KEY_BYTES = 32
PIN_COMMAND = "users/pin_generate"
PERSON_WRITES = ("users/update", "users/temporary_cancel")  # change a stored person: they take the shared people write gate (review F2)
_REF_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")
_PIN_RE = re.compile(r"[0-9]{6}", re.ASCII)  # WisKey's generated PIN: exactly six ASCII digits (review F5)
_key_lock = threading.Lock()


class ServiceWriteError(Exception):
    """A write that did not complete. `outcome`: not_sent (proven nothing left Arx), refused (a VERIFIED closed refusal) or unknown."""

    def __init__(self, code: str, outcome: str) -> None:
        super().__init__(f"{outcome}:{code}")
        self.code = code
        self.outcome = outcome if outcome in ("not_sent", "refused", "unknown") else "unknown"


def _ref(v: Any) -> bool:
    return isinstance(v, str) and _REF_RE.fullmatch(v) is not None


def _rev(v: Any) -> bool:
    return type(v) is int and 1 <= v <= MAX_REVISION


# ---------------------------------------------------------------- the owner's grant reference (read, never written)

@dataclass(frozen=True)
class GrantRef:
    """The references of ONE owner-configured native grant, exactly as the owner's private configuration names them. Arx only repeats
    them; it never creates or edits a grant (no self-grant)."""

    authority_ref: str
    authority_revision: int
    scope_ref: str
    grant_id: str
    grant_revision: int
    permission_revision: int

    def valid(self) -> bool:
        return (all(_ref(v) for v in (self.authority_ref, self.scope_ref, self.grant_id))
                and all(_rev(v) for v in (self.authority_revision, self.grant_revision, self.permission_revision)))


@dataclass(frozen=True)
class Metadata:
    actor_id: str
    grant: GrantRef
    target_ref: str
    target_revision: int | None
    request_id: str
    operation_id: str
    contract: str = CONTRACT  # CONTRACT_V2 for a GrantRef of WisKey's permanent installation manifest

    def wire(self) -> dict[str, Any]:
        """The closed 13-key `service_write` object, or ServiceWriteError(invalid_fields, not_sent)."""
        g = self.grant
        out = {"contract": self.contract, "role": ROLE, "actor_id": self.actor_id, "authority_ref": g.authority_ref,
               "authority_revision": g.authority_revision, "scope_ref": g.scope_ref, "grant_id": g.grant_id, "grant_revision": g.grant_revision,
               "permission_revision": g.permission_revision, "target_ref": self.target_ref, "target_revision": self.target_revision,
               "request_id": self.request_id, "operation_id": self.operation_id}
        if not check_metadata(out):
            raise ServiceWriteError("invalid_fields", "not_sent")
        return out


def check_metadata(meta: Any) -> bool:
    """The contract's JSON schema of `service_write`, closed (additionalProperties false)."""
    if not isinstance(meta, Mapping) or set(meta) != META_KEYS:
        return False
    if meta["contract"] not in CONTRACTS or meta["role"] != ROLE:
        return False
    if not all(_ref(meta[k]) for k in ("actor_id", "authority_ref", "scope_ref", "grant_id", "target_ref", "request_id", "operation_id")):
        return False
    if not all(_rev(meta[k]) for k in ("authority_revision", "grant_revision", "permission_revision")):
        return False
    return meta["target_revision"] is None or _rev(meta["target_revision"])


def build_parameters(command: str, business: Mapping[str, Any], meta: Metadata) -> dict[str, Any]:
    """The exact `bridge.parameters` of one service write: the original business parameters of `command` plus `service_write`. Every
    local refusal is `not_sent` (nothing recorded, nothing sent)."""
    if command not in PARAM_KEYS:
        raise ServiceWriteError("service_command_unsupported", "not_sent")
    required, optional = PARAM_KEYS[command]
    if not isinstance(business, Mapping) or not required <= set(business) <= required | optional or METADATA_PARAMETER in business:
        raise ServiceWriteError("invalid_fields", "not_sent")
    if "sync_now" in business and type(business["sync_now"]) is not bool:
        raise ServiceWriteError("invalid_fields", "not_sent")
    if "data" in business:
        data = business["data"]
        if not isinstance(data, Mapping) or not data or not set(data) <= DATA_FIELDS:
            raise ServiceWriteError("service_field_denied", "not_sent")
    if command == "users/create":
        if meta.target_revision is not None:
            raise ServiceWriteError("invalid_fields", "not_sent")  # null for create
    else:
        if business["user_id"] != meta.target_ref or not _ref(business["user_id"]) or not _rev(meta.target_revision):
            raise ServiceWriteError("invalid_fields", "not_sent")  # exact target_ref, current native revision
        if "revision" in business and business["revision"] != meta.target_revision:
            raise ServiceWriteError("invalid_fields", "not_sent")  # same positive target_revision
    if command == "users/temporary_cancel" and business["reason_code"] not in CANCEL_REASONS:
        raise ServiceWriteError("invalid_fields", "not_sent")
    if not _ref(meta.actor_id) or not meta.actor_id.startswith(SERVICE_ACTOR_PREFIX):
        raise ServiceWriteError("service_actor_mismatch", "not_sent")  # the authenticated arx-service:<entry> subject only
    return {**dict(business), METADATA_PARAMETER: meta.wire()}


def _canonical(value: Any) -> str:
    """Strict canonical JSON (no NaN / Infinity). A value JSON cannot carry raises TypeError / ValueError - the callers map it."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def bears_pin(command: str, parameters: Mapping[str, Any]) -> bool:
    """True for a request whose answer or effect is a PIN: `users/pin_generate`, or a create / update carrying a non-null `data.pin`."""
    data = parameters.get("data")
    return command == PIN_COMMAND or (isinstance(data, Mapping) and data.get("pin") is not None)


def request_mac(key: bytes, command: str, parameters: Mapping[str, Any]) -> str:
    """HMAC-SHA256 (hex), under the install-local key (`load_or_create_key`, a file outside the database - review F4), of the canonical
    `{command, service_write, parameters}` (the outer proof timestamp / nonce are not part of it). Kept in the journal's `request_sha256`
    column (the column keeps its name: 64 hex characters). Arx's journal never holds a PIN, not even under the key: a `data.pin` VALUE is
    replaced by a presence marker first. (A changed PIN under the same operation therefore reads as the same request on Arx's side - such
    a duplicate is never answered `completed`, see `ServiceWriteClient.write`; WisKey's own exact-request check still refuses it.)
    Anything that is not strict JSON is ServiceWriteError(invalid_fields, not_sent)."""
    if not isinstance(key, bytes) or len(key) != KEY_BYTES:
        raise ServiceWriteError("service_write_source_unavailable", "not_sent")
    try:
        params = {k: v for k, v in parameters.items() if k != METADATA_PARAMETER}
        data = params.get("data")
        if isinstance(data, Mapping) and "pin" in data:
            params = {**params, "data": {**data, "pin": "<pin:none>" if data["pin"] is None else "<pin:present>"}}
        body = {"command": command, "service_write": parameters.get(METADATA_PARAMETER), "parameters": params}
        return hmac.new(key, _canonical(body).encode("utf-8"), hashlib.sha256).hexdigest()
    except (TypeError, ValueError, AttributeError):
        raise ServiceWriteError("invalid_fields", "not_sent") from None


def key_path(data_dir: Path | str) -> Path:
    return Path(data_dir) / "keys" / KEY_NAME


def load_or_create_key(data_dir: Path | str) -> bytes:
    """The install-local HMAC key (32 random bytes) under `<data_dir>/keys/`, created once (0600, written to a temporary file and linked
    into place, so a crash never leaves half a key and two processes never keep two keys). A damaged file is
    ServiceWriteError(service_write_source_unavailable, not_sent): the writer then sends nothing (a new key would orphan every row)."""
    p = key_path(data_dir)
    with _key_lock:
        try:
            if not p.exists():
                p.parent.mkdir(parents=True, exist_ok=True)
                try:
                    os.chmod(p.parent, 0o700)
                except OSError:
                    pass
                tmp = p.with_name(f".{KEY_NAME}.{secrets.token_hex(4)}.tmp")
                fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
                try:
                    os.write(fd, secrets.token_bytes(KEY_BYTES))
                    os.fsync(fd)
                finally:
                    os.close(fd)
                try:
                    os.link(tmp, p)  # fails if another process created the key first: its key wins
                except FileExistsError:
                    pass
                finally:
                    os.unlink(tmp)
            raw = p.read_bytes()
        except OSError as exc:  # e.g. a filesystem without hard links: say so (the errno only, never a path or a key)
            log.warning("service write key unavailable (errno %s): nothing is sent", getattr(exc, "errno", None))
            raise ServiceWriteError("service_write_source_unavailable", "not_sent") from None
    if len(raw) != KEY_BYTES:
        raise ServiceWriteError("service_write_source_unavailable", "not_sent")
    return raw


# ---------------------------------------------------------------- reading WisKey's answers

@dataclass(frozen=True)
class Receipt:
    user_id: str
    person_revision: int
    central_state: str
    device_application: str = "not_proven"

    def as_dict(self) -> dict[str, Any]:
        return {"user_id": self.user_id, "person_revision": self.person_revision, "central_state": self.central_state,
                "device_application": self.device_application}


def read_receipt(raw: Any) -> Receipt | None:
    if (not isinstance(raw, Mapping) or set(raw) != RECEIPT_KEYS or not _ref(raw["user_id"]) or not _rev(raw["person_revision"])
            or raw["central_state"] not in CENTRAL_STATES or raw["device_application"] != "not_proven"):
        return None
    return Receipt(raw["user_id"], raw["person_revision"], raw["central_state"])


@dataclass(frozen=True)
class ServiceWriteOutcome:
    """What one call returns. `state` completed | unknown; `code` WisKey's success code or Arx's reason; `person` the person record of a
    `central_saved` reply (only on that original reply); `pin` ONLY on the original `pin_generated_not_saved` reply, in memory - never
    stored, never returned again. `dispatched` is False when this call sent nothing (a recorded operation observed again)."""

    state: str
    code: str
    operation_id: str
    receipt: Receipt | None = None
    person: dict[str, Any] | None = None
    pin: str | None = None
    dispatched: bool = True
    replay_available: bool = False

    def __repr__(self) -> str:  # the PIN never reaches a log line or a test failure message
        return (f"ServiceWriteOutcome(state={self.state!r}, code={self.code!r}, operation_id={self.operation_id!r}, "
                f"receipt={self.receipt!r}, dispatched={self.dispatched}, pin={'<set>' if self.pin else None})")


def _receipt_names(receipt: Receipt, command: str, target_ref: str | None) -> bool:
    """A receipt of a write to an EXISTING person must name that person (`target_ref`, review F5); a create's target is Arx's origin
    reference, so its receipt names the new person instead."""
    return command == "users/create" or target_ref is None or receipt.user_id == target_ref


def read_result(raw: Any, *, command: str, operation_id: str, target_ref: str | None = None,
                contract: str = CONTRACT) -> ServiceWriteOutcome | None:
    """The closed reading of a successful frame's `result`, or None (malformed -> UNKNOWN). A duplicate carries no `result`. `contract`
    is the one the request carried (WisKey echoes it; a result of the other contract is malformed)."""
    if contract not in CONTRACTS:
        return None
    try:
        return _read_result(raw, command=command, operation_id=operation_id, target_ref=target_ref, contract=contract)
    except (TypeError, KeyError, AttributeError):  # an unhashable / odd value inside a frame: malformed, never a crash
        return None


def _read_result(raw: Any, *, command: str, operation_id: str, target_ref: str | None, contract: str) -> ServiceWriteOutcome | None:
    if not isinstance(raw, Mapping):
        return None
    keys = set(raw)
    if not keys <= RESULT_KEYS or not RESULT_KEYS - {"result"} <= keys:
        return None
    if (raw["contract"] != contract or type(raw["schema_version"]) is not int or raw["schema_version"] != SCHEMA_VERSION
            or raw["operation_id"] != operation_id or raw["replay_available"] is not False or raw["state"] not in STATES):
        return None
    code = raw["code"]
    if code not in SUCCESS_CODES:
        return None
    if raw["state"] == "unknown":
        return ServiceWriteOutcome("unknown", "operation_pending_or_unknown", operation_id) if raw.get("receipt") is None else None
    receipt = read_receipt(raw["receipt"])
    if receipt is None or not _receipt_names(receipt, command, target_ref):
        return None
    if code == "operation_already_recorded":
        if "result" in raw:
            return None  # no private result is ever replayed
        return ServiceWriteOutcome("completed", code, operation_id, receipt)
    result = raw.get("result")
    if code == "pin_generated_not_saved":
        if (command != "users/pin_generate" or receipt.central_state != "unchanged_pin_generated_not_saved" or not isinstance(result, Mapping)
                or set(result) != {"pin"} or not isinstance(result["pin"], str) or _PIN_RE.fullmatch(result["pin"]) is None):
            return None
        return ServiceWriteOutcome("completed", code, operation_id, receipt, pin=result["pin"])
    if command == "users/pin_generate" or receipt.central_state != "saved" or not isinstance(result, Mapping):
        return None
    return ServiceWriteOutcome("completed", code, operation_id, receipt, person=dict(result))


def read_status(raw: Any, *, operation_id: str, command: str | None = None, target_ref: str | None = None) -> ServiceWriteOutcome:
    """`users/service_write_status_v1`: completed with its safe receipt, else UNKNOWN (a missing record is never never_committed). With
    the journal row's `command` / `target_ref`, a receipt for another person is UNKNOWN (`invalid_response`)."""
    try:
        if (not isinstance(raw, Mapping) or set(raw) != STATUS_KEYS or raw["contract"] != CONTRACT or raw["schema_version"] != SCHEMA_VERSION
                or type(raw["schema_version"]) is not int or raw["operation_id"] != operation_id or raw["replay_available"] is not False):
            return ServiceWriteOutcome("unknown", "invalid_response", operation_id, dispatched=True)
        if raw["state"] == "completed":
            receipt = read_receipt(raw["receipt"])
            if receipt is not None:
                if command is not None and not _receipt_names(receipt, command, target_ref):
                    return ServiceWriteOutcome("unknown", "invalid_response", operation_id, dispatched=True)
                return ServiceWriteOutcome("completed", "status_completed", operation_id, receipt)
    except (TypeError, KeyError, AttributeError):
        return ServiceWriteOutcome("unknown", "invalid_response", operation_id)
    return ServiceWriteOutcome("unknown", "status_unknown", operation_id)


# ---------------------------------------------------------------- the durable journal (schema 3)

def ensure_schema(conn: sqlite3.Connection) -> None:
    """The journal table. Created here (idempotent) rather than by a numbered migration: migration 0182 is already taken on other
    open branches (0182_doc_extractions); the lead decides the number when this branch is merged. An UNKNOWN row is never deleted or
    evicted; settled rows (completed / refused) are pruned (`Journal.prune`, review F1)."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS wiskey_service_write_journal ("
        " schema_version INTEGER NOT NULL CHECK (schema_version = 3),"
        " repository_id TEXT NOT NULL, operation_id TEXT NOT NULL, request_id TEXT NOT NULL, command TEXT NOT NULL,"
        " target_ref TEXT NOT NULL, request_sha256 TEXT NOT NULL CHECK (length(request_sha256) = 64),"
        " state TEXT NOT NULL CHECK (state IN ('unknown','completed','refused')), code TEXT,"
        " receipt_user_id TEXT, receipt_person_revision INTEGER, receipt_central_state TEXT,"
        " created_at TEXT NOT NULL, settled_at TEXT,"
        " PRIMARY KEY (repository_id, operation_id), UNIQUE (repository_id, request_id))")


def _stamp(at: datetime) -> str:
    return at.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _now() -> str:
    return _stamp(datetime.now(timezone.utc))


@dataclass(frozen=True)
class JournalRow:
    repository_id: str
    operation_id: str
    request_id: str
    command: str
    target_ref: str
    request_sha256: str
    state: str
    code: str | None
    receipt: Receipt | None


_COLS = ("repository_id, operation_id, request_id, command, target_ref, request_sha256, state, code, receipt_user_id, "
         "receipt_person_revision, receipt_central_state")


def _row(r: Any) -> JournalRow:
    receipt = Receipt(r[8], r[9], r[10]) if r[8] is not None else None
    return JournalRow(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], receipt)


class Journal:
    """Arx's durable record of its service writes. Each call commits itself (the intent is durable BEFORE any dispatch)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn
        ensure_schema(conn)
        conn.commit()

    def get(self, repository_id: str, operation_id: str) -> JournalRow | None:
        r = self.conn.execute(f"SELECT {_COLS} FROM wiskey_service_write_journal WHERE repository_id=? AND operation_id=?",
                              (repository_id, operation_id)).fetchone()
        return _row(r) if r else None

    def by_request(self, repository_id: str, request_id: str) -> JournalRow | None:
        r = self.conn.execute(f"SELECT {_COLS} FROM wiskey_service_write_journal WHERE repository_id=? AND request_id=?",
                              (repository_id, request_id)).fetchone()
        return _row(r) if r else None

    def count(self, repository_id: str) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM wiskey_service_write_journal WHERE repository_id=?", (repository_id,)).fetchone()[0]

    def prune(self, repository_id: str, *, now: datetime | None = None) -> int:
        """Review F1: removes SETTLED rows only (completed / refused) - every row settled longer than SETTLED_RETENTION ago, and, while the
        repository holds PRUNE_HIGH rows or more, the oldest settled rows OLDER THAN PRUNE_MIN_AGE until PRUNE_LOW remain. An UNKNOWN
        row is never removed (it is what keeps a lost receipt from being replayed), nor a row settled less than PRUNE_MIN_AGE ago (a
        prompt retry of it is still observed, never dispatched again; when only such rows fill the journal the answer is
        `service_write_capacity`). Returns the number of rows removed. A pruned operation id observed again is a new admission on Arx's
        side; WisKey's own record still answers it (`operation_already_recorded` / its conflict codes)."""
        at = now or datetime.now(timezone.utc)
        cutoff, young = _stamp(at - SETTLED_RETENTION), _stamp(at - PRUNE_MIN_AGE)
        with self.conn:
            removed = self.conn.execute(
                "DELETE FROM wiskey_service_write_journal WHERE repository_id=? AND state IN ('completed','refused') "
                "AND (settled_at IS NULL OR settled_at < ?)", (repository_id, cutoff)).rowcount
            total = self.count(repository_id)
            if total >= PRUNE_HIGH:
                removed += self.conn.execute(
                    "DELETE FROM wiskey_service_write_journal WHERE rowid IN (SELECT rowid FROM wiskey_service_write_journal WHERE "
                    "repository_id=? AND state IN ('completed','refused') AND settled_at < ? ORDER BY settled_at, rowid LIMIT ?)",
                    (repository_id, young, total - PRUNE_LOW)).rowcount
        return removed

    def occupancy(self, repository_id: str, *, now: datetime | None = None) -> int:
        """READ ONLY: the rows a prune would keep at most (every row but the settled ones older than PRUNE_MIN_AGE / with no stamp)."""
        young = _stamp((now or datetime.now(timezone.utc)) - PRUNE_MIN_AGE)
        return self.conn.execute(
            "SELECT COUNT(*) FROM wiskey_service_write_journal WHERE repository_id=? AND NOT (state IN ('completed','refused') "
            "AND (settled_at IS NULL OR settled_at < ?))", (repository_id, young)).fetchone()[0]

    def unsettled(self, repository_id: str, limit: int = 64) -> list[JournalRow]:
        """The UNKNOWN rows a status read may still settle (oldest first). A proven not-sent row (`not_sent`) is spent, not listed."""
        rows = self.conn.execute(
            f"SELECT {_COLS} FROM wiskey_service_write_journal WHERE repository_id=? AND state='unknown' AND (code IS NULL OR code != "
            "'not_sent') ORDER BY created_at, rowid LIMIT ?", (repository_id, max(1, min(int(limit), 512)))).fetchall()
        return [_row(r) for r in rows]

    def holds_person(self, repository_id: str, target_ref: str) -> bool:
        """Review F2: an UNKNOWN write to this existing person (recorded by this or an earlier process) holds the next one."""
        marks = ",".join("?" * len(PERSON_WRITES))
        return self.conn.execute(
            f"SELECT 1 FROM wiskey_service_write_journal WHERE repository_id=? AND target_ref=? AND state='unknown' AND command IN ({marks}) "
            "AND (code IS NULL OR code != 'not_sent') LIMIT 1", (repository_id, target_ref, *PERSON_WRITES)).fetchone() is not None

    def admit_unknown(self, *, repository_id: str, operation_id: str, request_id: str, command: str, target_ref: str, digest: str) -> None:
        with self.conn:
            self.conn.execute(
                "INSERT INTO wiskey_service_write_journal (schema_version, repository_id, operation_id, request_id, command, target_ref, "
                "request_sha256, state, created_at) VALUES (?,?,?,?,?,?,?,'unknown',?)",
                (JOURNAL_SCHEMA_VERSION, repository_id, operation_id, request_id, command, target_ref, digest, _now()))

    def note_unknown(self, repository_id: str, operation_id: str, code: str) -> None:
        with self.conn:
            self.conn.execute("UPDATE wiskey_service_write_journal SET code=? WHERE repository_id=? AND operation_id=? AND state='unknown'",
                              (code[:64], repository_id, operation_id))

    def complete(self, repository_id: str, operation_id: str, code: str, receipt: Receipt) -> None:
        with self.conn:
            self.conn.execute(
                "UPDATE wiskey_service_write_journal SET state='completed', code=?, receipt_user_id=?, receipt_person_revision=?, "
                "receipt_central_state=?, settled_at=? WHERE repository_id=? AND operation_id=? AND state='unknown'",
                (code, receipt.user_id, receipt.person_revision, receipt.central_state, _now(), repository_id, operation_id))

    def refuse(self, repository_id: str, operation_id: str, code: str) -> None:
        with self.conn:
            self.conn.execute("UPDATE wiskey_service_write_journal SET state='refused', code=?, settled_at=? WHERE repository_id=? AND "
                              "operation_id=? AND state='unknown'", (code, _now(), repository_id, operation_id))


# ---------------------------------------------------------------- the writer

Call = Callable[[str, Mapping[str, Any]], Mapping[str, Any]]


class ServiceWriteClient:
    """One service write at a time over a synchronous `call(command, parameters)` that returns a VERIFIED `result` or raises an error with
    `.outcome` (not_sent | refused | unknown) and `.code` (WisKey's code for refused) - the direct join's capture port contract.

    `key`: the install-local HMAC key (`load_or_create_key`); without it nothing is sent. `gate`: the shared per-person people write gate
    (`intercom_sync.IntercomSync`, default the process's `SYNC`): a write to an existing person is admitted through it the way
    `SYNC.action` admits the human path, and an UNKNOWN outcome keeps that person held until a fresh read (review F2)."""

    def __init__(self, call: Call, journal: Journal, *, repository_id: Callable[[], str | None], key: bytes | None = None,
                 gate: Any = None) -> None:
        self._call = call
        self.journal = journal
        self._repository_id = repository_id
        self._key = key
        self._gate = gate

    def _repo(self) -> str:
        repo = self._repository_id()
        if not _ref(repo):
            raise ServiceWriteError("service_write_source_unavailable", "not_sent")  # no independently established repository identity
        return repo  # type: ignore[return-value]

    def gate(self) -> Any:
        if self._gate is None:
            from . import intercom_sync

            return intercom_sync.SYNC
        return self._gate

    def has_room(self) -> bool:
        """Review F1: True while the rows a prune would keep leave more than JOURNAL_HEADROOM free. A READ: it never deletes or commits
        (the prune runs in `write`). Any failure reads as no room."""
        try:
            return self.journal.occupancy(self._repo()) < JOURNAL_CAPACITY - JOURNAL_HEADROOM
        except (ServiceWriteError, sqlite3.Error):
            return False

    def write(self, command: str, business: Mapping[str, Any], meta: Metadata) -> ServiceWriteOutcome:
        try:
            params = build_parameters(command, business, meta)
        except (TypeError, AttributeError, KeyError):  # an odd value in the caller's input: a clean local refusal (review F5)
            raise ServiceWriteError("invalid_fields", "not_sent") from None
        try:
            return self._write(command, params, meta)
        finally:
            params.clear()  # the frame (and any PIN in it) lives only for this call, whichever way it ends

    def _write(self, command: str, params: dict[str, Any], meta: Metadata) -> ServiceWriteOutcome:
        from .intercom_sync import person_target as _person_target

        repo = self._repo()
        if self._key is None:
            raise ServiceWriteError("service_write_source_unavailable", "not_sent")
        digest = request_mac(self._key, command, params)
        pin = bears_pin(command, params)
        try:
            seen = self.journal.get(repo, meta.operation_id)
            if seen is not None:
                return self._observed(seen, command, meta, digest, pin)
            if self.journal.by_request(repo, meta.request_id) is not None:
                raise ServiceWriteError("service_origin_or_request_already_recorded", "not_sent")
            self.journal.prune(repo)
            if self.journal.count(repo) >= JOURNAL_CAPACITY - JOURNAL_HEADROOM:
                raise ServiceWriteError("service_write_capacity", "not_sent")
            if command in PERSON_WRITES and self.journal.holds_person(repo, meta.target_ref):
                raise ServiceWriteError("service_write_unsettled", "not_sent")  # settle it first: `status()` / `settle_unknown()`
        except sqlite3.Error:
            raise ServiceWriteError("journal_unavailable", "not_sent") from None
        person_target = _person_target(meta.target_ref)
        gate, gate_op = self.gate(), None
        if command in PERSON_WRITES:
            blocked, gate_op = gate.begin_external(person_target, f"service:{command}")
            if blocked is not None:
                raise ServiceWriteError(blocked, "not_sent")
        elif command == PIN_COMMAND:
            blocked = gate.write_gate(person_target)
            if blocked is not None:
                raise ServiceWriteError(blocked, "not_sent")
        settled = {"outcome": "not_sent", "code": None}
        try:
            return self._dispatch(repo, command, params, meta, digest, settled)
        finally:
            if command in PERSON_WRITES:
                gate.end_external(person_target, gate_op, settled["outcome"], settled["code"])

    def _observed(self, seen: JournalRow, command: str, meta: Metadata, digest: str, pin: bool) -> ServiceWriteOutcome:
        if seen.request_sha256 != digest or seen.request_id != meta.request_id or seen.command != command:
            raise ServiceWriteError("service_operation_conflict", "not_sent")
        # the identical request again: observed, NEVER dispatched again (no replay after a lost receipt)
        if seen.state == "refused":
            raise ServiceWriteError(seen.code or "refused", "refused")
        if seen.state == "completed" and pin:
            # review F3: the PIN is not part of Arx's digest, so a completed row cannot prove THIS request's PIN (and a generated PIN is
            # never returned again): never `completed`, no receipt
            return ServiceWriteOutcome("unknown", "pin_duplicate_unverified", meta.operation_id, dispatched=False)
        return ServiceWriteOutcome(seen.state, "operation_already_recorded" if seen.state == "completed" else (seen.code or "unknown"),
                                   meta.operation_id, seen.receipt, dispatched=False)

    def _dispatch(self, repo: str, command: str, params: dict[str, Any], meta: Metadata, digest: str,
                  settled: dict[str, Any]) -> ServiceWriteOutcome:
        try:
            self.journal.admit_unknown(repository_id=repo, operation_id=meta.operation_id, request_id=meta.request_id, command=command,
                                       target_ref=meta.target_ref, digest=digest)  # durable UNKNOWN before the frame leaves
        except sqlite3.IntegrityError:  # another writer recorded this operation / request first
            params.clear()
            raise ServiceWriteError("service_origin_or_request_already_recorded", "not_sent") from None
        except sqlite3.Error:
            params.clear()
            raise ServiceWriteError("journal_unavailable", "not_sent") from None
        settled["outcome"] = "unknown"  # from here on the frame may have left
        try:
            raw = self._call(command, params)
        except Exception as exc:  # noqa: BLE001 - classified below; its text is never kept
            outcome, code = getattr(exc, "outcome", "unknown"), str(getattr(exc, "code", None) or type(exc).__name__)[:64]
            if outcome == "refused" and code in REFUSAL_CODES and code not in UNKNOWN_CODES:
                settled.update(outcome="refused", code=code)
                self._record(self.journal.refuse, repo, meta.operation_id, code)
                raise ServiceWriteError(code, "refused") from None
            if outcome == "not_sent":
                settled.update(outcome="not_sent", code=code)
            else:
                settled["code"] = code
            self._record(self.journal.note_unknown, repo, meta.operation_id, "not_sent" if outcome == "not_sent" else code)
            raise ServiceWriteError(code, "not_sent" if outcome == "not_sent" else "unknown") from None
        finally:
            params.clear()  # the frame (and any PIN in it) lives only for the call
        out = read_result(raw, command=command, operation_id=meta.operation_id, target_ref=meta.target_ref, contract=meta.contract)
        if out is None:
            settled["code"] = "invalid_response"
            self._record(self.journal.note_unknown, repo, meta.operation_id, "invalid_response")
            return ServiceWriteOutcome("unknown", "invalid_response", meta.operation_id)
        if out.state == "completed" and out.receipt is not None:
            settled.update(outcome="ok", code=out.code)
            # the safe receipt only - never the PIN or the person. If this record fails the row stays UNKNOWN (conservative).
            self._record(self.journal.complete, repo, meta.operation_id, out.code, out.receipt)
        else:
            settled["code"] = out.code
            self._record(self.journal.note_unknown, repo, meta.operation_id, out.code)
        return out

    @staticmethod
    def _record(fn: Callable[..., None], *args: Any) -> None:
        """A journal update AFTER the dispatch: a database failure never hides the call's outcome (the row then stays UNKNOWN)."""
        try:
            fn(*args)
        except sqlite3.Error as exc:
            log.warning("service write journal update failed (%s): the row stays unknown", type(exc).__name__)

    def status(self, operation_id: str) -> ServiceWriteOutcome:
        """One `users/service_write_status_v1` READ. Settles an UNKNOWN row only with a verified completed receipt that names the row's
        person. Never writes to WisKey. It settles Arx's journal only: the shared people gate still wants its fresh read of the person."""
        repo = self._repo()
        if not _ref(operation_id):
            raise ServiceWriteError("invalid_fields", "not_sent")
        try:
            row = self.journal.get(repo, operation_id)
        except sqlite3.Error:
            raise ServiceWriteError("journal_unavailable", "not_sent") from None
        try:
            raw = self._call(STATUS_COMMAND, {"operation_id": operation_id})
        except Exception as exc:  # noqa: BLE001
            return ServiceWriteOutcome("unknown", str(getattr(exc, "code", None) or "transport")[:64], operation_id)
        out = read_status(raw, operation_id=operation_id, command=row.command if row else None, target_ref=row.target_ref if row else None)
        if out.state == "completed" and out.receipt is not None and row is not None and row.state == "unknown":
            self._record(self.journal.complete, repo, operation_id, "status_completed", out.receipt)
        return out

    def unsettled(self, limit: int = 64) -> list[str]:
        """The operation ids of this repository's UNKNOWN rows a status read may settle (oldest first)."""
        try:
            return [r.operation_id for r in self.journal.unsettled(self._repo(), limit)]
        except sqlite3.Error:
            raise ServiceWriteError("journal_unavailable", "not_sent") from None

    def settle_unknown(self, limit: int = 16) -> list[ServiceWriteOutcome]:
        """One status read per UNKNOWN row (oldest first, at most `limit`): the caller's way to settle what a lost receipt left open."""
        return [self.status(oid) for oid in self.unsettled(limit)]


# ---------------------------------------------------------------- the grant engine's port (access_service_writer.ServiceWriter)

ENGINE_COMMANDS = {"users/create": "users/create", "users/update": "users/update"}  # delete / cards are not in the contract


class FinalServiceWriter:
    """The `access_service_writer.ServiceWriter` of the grant engine over this contract. `available()` only when the join selects the
    service commands on its current connection, the OWNER grant reference is configured, the repository identity is known and the
    journal exists and has room (review F1). Production (`from_join`) has no grant source yet (OWNER-CONFIG): it is never available and nothing is sent."""

    def __init__(self, *, selected: Callable[[str], bool], client: ServiceWriteClient | None, grant: Callable[[], GrantRef | None],
                 actor_id: str, new_id: Callable[[], str], contract: str = CONTRACT) -> None:
        if contract not in CONTRACTS:
            raise ValueError("contract")
        self._selected, self.client, self._grant, self.actor_id, self._new_id = selected, client, grant, actor_id, new_id
        self.contract = contract

    @classmethod
    def from_installation(cls, join: Any, *, grant: Callable[[], GrantRef | None], actor_id: str,
                          client: ServiceWriteClient | None = None) -> "FinalServiceWriter":
        """WISKEY-ADOPT-2272: the v2 writer of WisKey's permanent installation. `grant` reads the GrantRef WisKey published in its private
        manifest (`wiskey_auto_install.ManifestGrantSource`: None while the `wiskey.auto_install` switch is off or the manifest is not
        ready) and `actor_id` is the manifest's `arx-service:<entry>` subject. Arx never creates a grant. Production passes no `client`
        yet (the journal connection of a service write is not wired - docs/changes/WISKEY-ADOPT-2272.md), so it stays unavailable."""
        import uuid

        return cls(selected=lambda c: bool(join.selected(c)), client=client, grant=grant, actor_id=actor_id,
                   new_id=lambda: uuid.uuid4().hex, contract=CONTRACT_V2)

    @classmethod
    def from_join(cls, join: Any) -> "FinalServiceWriter":
        import uuid

        entry = getattr(getattr(join, "session", None), "entry_id", None) or "access_grants"
        return cls(selected=lambda c: bool(join.selected(c)), client=None, grant=lambda: None, actor_id=SERVICE_ACTOR_PREFIX + str(entry)[:64],
                   new_id=lambda: uuid.uuid4().hex)

    def supports(self, action: str) -> bool:
        return action in ENGINE_COMMANDS

    def available(self) -> bool:
        try:
            g = self._grant()
            return (self.client is not None and g is not None and g.valid() and _ref(self.client._repository_id())
                    and all(self._selected(c) for c in ENGINE_COMMANDS.values()) and self.client.has_room())
        except Exception:  # noqa: BLE001 - cannot tell = not available
            return False

    def write(self, op: Any) -> dict[str, Any]:
        from .access_grant_engine import EngineError

        if op.action not in ENGINE_COMMANDS:
            raise EngineError("not_sent", "service_action_unsupported")
        grant = self._grant()
        if grant is None or not grant.valid() or self.client is None:
            raise EngineError("not_sent", "service_grant_required")  # no self-grant, no fallback role
        create = op.action == "users/create"
        oid = self._new_id()
        target = f"arx-origin-{oid}" if create else op.person_id
        meta = Metadata(self.actor_id, grant, target, None if create else op.revision, f"req-{oid}", f"op-{oid}", self.contract)
        business: dict[str, Any] = {"data": dict(op.data)}
        if not create:
            business.update(user_id=op.person_id, revision=op.revision)
        try:
            out = self.client.write(ENGINE_COMMANDS[op.action], business, meta)
        except ServiceWriteError as exc:
            kind = {"not_sent": "not_sent", "refused": "refused"}.get(exc.outcome, "unknown")
            if exc.code == "revision_conflict":
                kind = "revision_conflict"
            raise EngineError(kind, exc.code) from None
        if out.state != "completed" or out.person is None:
            raise EngineError("unknown", out.code)  # a completed duplicate has no person: read it fresh (users/get), never re-send
        return out.person
