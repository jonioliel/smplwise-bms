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
  supplied by the caller - established independently before the first write), the request id and `request_sha256` of the canonical
  `{command, service_write, parameters}`. No PIN and no person value is stored (the PIN is hashed as a presence marker only, see
  `request_sha256`).
- The same operation again: an identical request is NEVER dispatched again (no replay after a lost receipt) - it returns the recorded
  state; a different request under the same operation id is `service_operation_conflict`; a request id already used by another
  operation is `service_origin_or_request_already_recorded`; a full journal (4096 operations, no eviction) is `service_write_capacity`.
- An UNKNOWN stays unknown until a verified `completed` result or status read (`settle_from_status`); a refusal is recorded `refused`
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
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Mapping

CONTRACT = "wiskey-native-service-write.v1"
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
JOURNAL_CAPACITY = 4096
MAX_REF = 128
MAX_REVISION = 9007199254740991
SERVICE_ACTOR_PREFIX = "arx-service:"
_REF_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")


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

    def wire(self) -> dict[str, Any]:
        """The closed 13-key `service_write` object, or ServiceWriteError(invalid_fields, not_sent)."""
        g = self.grant
        out = {"contract": CONTRACT, "role": ROLE, "actor_id": self.actor_id, "authority_ref": g.authority_ref,
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
    if meta["contract"] != CONTRACT or meta["role"] != ROLE:
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
    if not meta.actor_id.startswith(SERVICE_ACTOR_PREFIX):
        raise ServiceWriteError("service_actor_mismatch", "not_sent")  # the authenticated arx-service:<entry> subject only
    return {**dict(business), METADATA_PARAMETER: meta.wire()}


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def request_sha256(command: str, parameters: Mapping[str, Any]) -> str:
    """SHA-256 of the canonical `{command, service_write, parameters}` (the outer proof timestamp / nonce are not part of it). Arx's journal
    never holds a PIN, not even as a short hash a 6-digit space can be searched against: a `data.pin` VALUE is replaced by a presence
    marker before hashing. (A changed PIN under the same operation therefore reads as the same request on Arx's side - which only means
    Arx does not send it again; WisKey's own exact-request check still refuses it as `service_operation_conflict`.)"""
    params = {k: v for k, v in parameters.items() if k != METADATA_PARAMETER}
    data = params.get("data")
    if isinstance(data, Mapping) and "pin" in data:
        params = {**params, "data": {**data, "pin": "<pin:none>" if data["pin"] is None else "<pin:present>"}}
    body = {"command": command, "service_write": parameters.get(METADATA_PARAMETER), "parameters": params}
    return hashlib.sha256(_canonical(body).encode("utf-8")).hexdigest()


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


def read_result(raw: Any, *, command: str, operation_id: str) -> ServiceWriteOutcome | None:
    """The closed reading of a successful frame's `result`, or None (malformed -> UNKNOWN). A duplicate carries no `result`."""
    if not isinstance(raw, Mapping):
        return None
    keys = set(raw)
    if not keys <= RESULT_KEYS or not RESULT_KEYS - {"result"} <= keys:
        return None
    if (raw["contract"] != CONTRACT or type(raw["schema_version"]) is not int or raw["schema_version"] != SCHEMA_VERSION
            or raw["operation_id"] != operation_id or raw["replay_available"] is not False or raw["state"] not in STATES):
        return None
    code = raw["code"]
    if code not in SUCCESS_CODES:
        return None
    if raw["state"] == "unknown":
        return ServiceWriteOutcome("unknown", "operation_pending_or_unknown", operation_id) if raw.get("receipt") is None else None
    receipt = read_receipt(raw["receipt"])
    if receipt is None:
        return None
    if code == "operation_already_recorded":
        if "result" in raw:
            return None  # no private result is ever replayed
        return ServiceWriteOutcome("completed", code, operation_id, receipt)
    result = raw.get("result")
    if code == "pin_generated_not_saved":
        if (command != "users/pin_generate" or receipt.central_state != "unchanged_pin_generated_not_saved" or not isinstance(result, Mapping)
                or set(result) != {"pin"} or not isinstance(result["pin"], str) or not result["pin"].isdigit()):
            return None
        return ServiceWriteOutcome("completed", code, operation_id, receipt, pin=result["pin"])
    if command == "users/pin_generate" or receipt.central_state != "saved" or not isinstance(result, Mapping):
        return None
    return ServiceWriteOutcome("completed", code, operation_id, receipt, person=dict(result))


def read_status(raw: Any, *, operation_id: str) -> ServiceWriteOutcome:
    """`users/service_write_status_v1`: completed with its safe receipt, else UNKNOWN (a missing record is never never_committed)."""
    if (not isinstance(raw, Mapping) or set(raw) != STATUS_KEYS or raw["contract"] != CONTRACT or raw["schema_version"] != SCHEMA_VERSION
            or type(raw["schema_version"]) is not int or raw["operation_id"] != operation_id or raw["replay_available"] is not False):
        return ServiceWriteOutcome("unknown", "invalid_response", operation_id, dispatched=True)
    if raw["state"] == "completed":
        receipt = read_receipt(raw["receipt"])
        if receipt is not None:
            return ServiceWriteOutcome("completed", "status_completed", operation_id, receipt)
    return ServiceWriteOutcome("unknown", "status_unknown", operation_id)


# ---------------------------------------------------------------- the durable journal (schema 3)

def ensure_schema(conn: sqlite3.Connection) -> None:
    """The journal table. Created here (idempotent) rather than by a numbered migration: migration 0182 is already taken on other
    open branches (0182_doc_extractions); the lead decides the number when this branch is merged. Rows are never deleted or evicted."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS wiskey_service_write_journal ("
        " schema_version INTEGER NOT NULL CHECK (schema_version = 3),"
        " repository_id TEXT NOT NULL, operation_id TEXT NOT NULL, request_id TEXT NOT NULL, command TEXT NOT NULL,"
        " target_ref TEXT NOT NULL, request_sha256 TEXT NOT NULL CHECK (length(request_sha256) = 64),"
        " state TEXT NOT NULL CHECK (state IN ('unknown','completed','refused')), code TEXT,"
        " receipt_user_id TEXT, receipt_person_revision INTEGER, receipt_central_state TEXT,"
        " created_at TEXT NOT NULL, settled_at TEXT,"
        " PRIMARY KEY (repository_id, operation_id), UNIQUE (repository_id, request_id))")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


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
    `.outcome` (not_sent | refused | unknown) and `.code` (WisKey's code for refused) - the direct join's capture port contract."""

    def __init__(self, call: Call, journal: Journal, *, repository_id: Callable[[], str | None]) -> None:
        self._call = call
        self.journal = journal
        self._repository_id = repository_id

    def _repo(self) -> str:
        repo = self._repository_id()
        if not _ref(repo):
            raise ServiceWriteError("service_write_source_unavailable", "not_sent")  # no independently established repository identity
        return repo  # type: ignore[return-value]

    def write(self, command: str, business: Mapping[str, Any], meta: Metadata) -> ServiceWriteOutcome:
        params = build_parameters(command, business, meta)
        repo = self._repo()
        digest = request_sha256(command, params)
        seen = self.journal.get(repo, meta.operation_id)
        if seen is not None:
            if seen.request_sha256 != digest or seen.request_id != meta.request_id or seen.command != command:
                raise ServiceWriteError("service_operation_conflict", "not_sent")
            # the identical request again: observed, NEVER dispatched again (no replay after a lost receipt)
            if seen.state == "refused":
                raise ServiceWriteError(seen.code or "refused", "refused")
            return ServiceWriteOutcome(seen.state, "operation_already_recorded" if seen.state == "completed" else (seen.code or "unknown"),
                                       meta.operation_id, seen.receipt, dispatched=False)
        if self.journal.by_request(repo, meta.request_id) is not None:
            raise ServiceWriteError("service_origin_or_request_already_recorded", "not_sent")
        if self.journal.count(repo) >= JOURNAL_CAPACITY:
            raise ServiceWriteError("service_write_capacity", "not_sent")
        self.journal.admit_unknown(repository_id=repo, operation_id=meta.operation_id, request_id=meta.request_id, command=command,
                                   target_ref=meta.target_ref, digest=digest)  # durable UNKNOWN before the frame leaves
        try:
            raw = self._call(command, params)
        except Exception as exc:  # noqa: BLE001 - classified below; its text is never kept
            outcome, code = getattr(exc, "outcome", "unknown"), str(getattr(exc, "code", None) or type(exc).__name__)[:64]
            if outcome == "refused" and code in REFUSAL_CODES and code not in UNKNOWN_CODES:
                self.journal.refuse(repo, meta.operation_id, code)
                raise ServiceWriteError(code, "refused") from None
            self.journal.note_unknown(repo, meta.operation_id, "not_sent" if outcome == "not_sent" else code)
            raise ServiceWriteError(code, "not_sent" if outcome == "not_sent" else "unknown") from None
        finally:
            params.clear()  # the frame (and any PIN in it) lives only for the call
        out = read_result(raw, command=command, operation_id=meta.operation_id)
        if out is None:
            self.journal.note_unknown(repo, meta.operation_id, "invalid_response")
            return ServiceWriteOutcome("unknown", "invalid_response", meta.operation_id)
        if out.state == "completed" and out.receipt is not None:
            self.journal.complete(repo, meta.operation_id, out.code, out.receipt)  # the safe receipt only - never the PIN or the person
        else:
            self.journal.note_unknown(repo, meta.operation_id, out.code)
        return out

    def status(self, operation_id: str) -> ServiceWriteOutcome:
        """One `users/service_write_status_v1` READ. Settles an UNKNOWN row only with a verified completed receipt. Never writes."""
        repo = self._repo()
        if not _ref(operation_id):
            raise ServiceWriteError("invalid_fields", "not_sent")
        try:
            raw = self._call(STATUS_COMMAND, {"operation_id": operation_id})
        except Exception as exc:  # noqa: BLE001
            return ServiceWriteOutcome("unknown", str(getattr(exc, "code", None) or "transport")[:64], operation_id)
        out = read_status(raw, operation_id=operation_id)
        row = self.journal.get(repo, operation_id)
        if out.state == "completed" and out.receipt is not None and row is not None and row.state == "unknown":
            self.journal.complete(repo, operation_id, "status_completed", out.receipt)
        return out


# ---------------------------------------------------------------- the grant engine's port (access_service_writer.ServiceWriter)

ENGINE_COMMANDS = {"users/create": "users/create", "users/update": "users/update"}  # delete / cards are not in the contract


class FinalServiceWriter:
    """The `access_service_writer.ServiceWriter` of the grant engine over this contract. `available()` only when the join selects the
    service commands on its current connection, the OWNER grant reference is configured, the repository identity is known and a journal
    exists. Production (`from_join`) has no grant source yet (OWNER-CONFIG): it is never available and nothing is sent."""

    def __init__(self, *, selected: Callable[[str], bool], client: ServiceWriteClient | None, grant: Callable[[], GrantRef | None],
                 actor_id: str, new_id: Callable[[], str]) -> None:
        self._selected, self.client, self._grant, self.actor_id, self._new_id = selected, client, grant, actor_id, new_id

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
                    and all(self._selected(c) for c in ENGINE_COMMANDS.values()))
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
        meta = Metadata(self.actor_id, grant, target, None if create else op.revision, f"req-{oid}", f"op-{oid}")
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
