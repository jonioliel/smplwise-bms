"""ECCACT-295 (directive item 2): the DURABLE immutable intents of the WisKey people-write fence, and the exact-original contract for
a create whose reply was never valid.

Why
- A people write that left Arx without a verified reply is UNKNOWN. Arx must be able to ask WisKey about THAT write and nothing else:
  by the exact original references it recorded before the frame left (repository, dedicated query owner ref, operation id, request id,
  origin ref, operation-binding ref, peer binding ref + revision, writer epoch) - never by name, employee number, PIN, card, policy
  similarity or "the newest person". `wiskey_fence_intents` (migration 0145, built as provisional 0137) holds those references immutably; only the
  state columns move, only forward, and exactly one terminal fact is ever accepted for an intent.
- `verify_receipt` (wiskey_peer.py) judges updates; it never proves a create (`proves_create` False). The create has its own verifier
  here: `verify_create_resolution` accepts a `committed` answer only when it names the SAME origin ref and operation and carries the
  created person's id and revision, and Arx then records that id from the verified answer alone.
- No replay: nothing in this module sends anything. A mutation is sent once; a resolution is a READ of the original; the intent table
  refuses a second admission of the same operation / request / origin (unique keys) and a second terminal fact.

Status
- The wire shape of the create resolution (`PROPOSED_CREATE_COMMAND`, protocol `wiskey-create-resolution-draft1`) is Arx's PROPOSAL for
  the joint pin with the Mac; WisKey f66bf67b has no such command. The module is fake-tested; the live read is NOT built
  (`LiveResolveTransport` refuses `not_built`). `query_owner_ref` is an opaque ref: an HA user id, or the agreed bridge service type once
  the joint pin names it - this module never fabricates either."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from . import connection_store as cs
from . import wiskey_peer as wp

PROPOSED_CREATE_COMMAND = "hikvision_intercom/person_writes/resolve_create"  # Arx PROPOSAL; not on the wire (WisKey f66bf67b has no such command)
PROPOSED_CREATE_CAPABILITY = "person_create_resolution_v1"
CREATE_PROTOCOL = "wiskey-create-resolution-draft1"
CREATE_SCOPE = "central_person_create"
CREATE_KEYS = frozenset({
    "schema_version", "protocol", "repository_id", "observed_epoch", "query_owner_id", "peer_binding_ref", "peer_binding_revision",
    "request_id", "operation_id", "operation_binding_ref", "origin_ref", "exclusive_writer_established", "state", "terminal", "created",
    "reason_code", "error_code", "scope", "device_state"})
STATES = ("intent", "sent", "committed", "never_committed", "unknown")
TERMINAL = ("committed", "never_committed")


class IntentError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _now() -> str:
    return _iso(datetime.now(timezone.utc))


@dataclass(frozen=True)
class ExactOriginal:
    """The immutable references of one intent: exactly what a resolution may be asked about."""

    repository_id: str
    query_owner_ref: str
    operation_id: str
    request_id: str
    origin_ref: str
    operation_binding_ref: str
    peer_binding_ref: str
    peer_binding_revision: int
    issued_epoch: int
    is_create: bool
    user_id: str | None
    revision_before: int | None

    def as_request(self) -> dict[str, Any]:
        """The PROPOSED resolve request: the exact original references and nothing else (no name / PIN / card / policy field exists).
        WKB-295: refs-only, so NOT the durable full original WisKey's T05 asks for - that is `resolve_request` (recorded original +
        hashes + verified context, only for an intent admitted through `admit_with_original`)."""
        return {"repository_id": self.repository_id, "operation_id": self.operation_id, "request_id": self.request_id,
                "origin_ref": self.origin_ref, "operation_binding_ref": self.operation_binding_ref,
                "peer_binding_ref": self.peer_binding_ref, "peer_binding_revision": self.peer_binding_revision}


def _row_original(r: sqlite3.Row | tuple[Any, ...]) -> ExactOriginal:
    return ExactOriginal(repository_id=r[0], query_owner_ref=r[1], operation_id=r[2], request_id=r[3], origin_ref=r[4],
                         operation_binding_ref=r[5], peer_binding_ref=r[6], peer_binding_revision=r[7], issued_epoch=r[8], is_create=bool(r[9]),
                         user_id=r[10], revision_before=r[11])


_COLS = ("repository_id, query_owner_ref, operation_id, request_id, origin_ref, operation_binding_ref, peer_binding_ref, peer_binding_revision, "
         "issued_epoch, is_create, user_id, revision_before")


def admit(conn: sqlite3.Connection, *, peer: wp.VerifiedPeerRef, operation_id: str, request_id: str, origin_ref: str, operation_binding_ref: str,
          issued_epoch: int, command: str, user_id: str | None = None, revision_before: int | None = None, journal_op_id: str | None = None,
          now: str | None = None) -> ExactOriginal:
    """Record the intent BEFORE the frame leaves Arx (the caller sends only after this returns). A create has no user / revision.
    The same operation, request or origin admitted twice is refused (`duplicate`): one intent per original operation, never a replay."""
    wp.as_peer_binding(peer)
    is_create = user_id is None and revision_before is None
    if not (wp.is_ref(operation_id) and wp.is_ref(request_id) and wp.is_ref(origin_ref) and wp.is_ref(operation_binding_ref)
            and wp.is_pos_int(issued_epoch) and isinstance(command, str) and 1 <= len(command) <= 64):
        raise IntentError("invalid_intent")
    if not is_create and not (wp.is_ref(user_id) and wp.is_pos_int(revision_before)):
        raise IntentError("invalid_intent")
    try:
        conn.execute(
            "INSERT INTO wiskey_fence_intents (repository_id, query_owner_ref, operation_id, request_id, origin_ref, operation_binding_ref, "
            "peer_binding_ref, peer_binding_revision, issued_epoch, command, is_create, user_id, revision_before, journal_op_id, state, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'intent',?)",
            (peer.repository_id, peer.query_owner_id, operation_id, request_id, origin_ref, operation_binding_ref, peer.peer_binding_ref,
             peer.peer_binding_revision, issued_epoch, command, 1 if is_create else 0, user_id, revision_before, journal_op_id, now or _now()))
    except sqlite3.IntegrityError:
        raise IntentError("duplicate") from None
    return ExactOriginal(peer.repository_id, peer.query_owner_id, operation_id, request_id, origin_ref, operation_binding_ref,
                         peer.peer_binding_ref, peer.peer_binding_revision, issued_epoch, is_create, user_id, revision_before)


def original(conn: sqlite3.Connection, repository_id: str, query_owner_ref: str, operation_id: str) -> ExactOriginal | None:
    r = conn.execute(f"SELECT {_COLS} FROM wiskey_fence_intents WHERE repository_id=? AND query_owner_ref=? AND operation_id=?",
                     (repository_id, query_owner_ref, operation_id)).fetchone()
    return _row_original(r) if r else None


def state(conn: sqlite3.Connection, o: ExactOriginal) -> str | None:
    r = conn.execute("SELECT state FROM wiskey_fence_intents WHERE repository_id=? AND query_owner_ref=? AND operation_id=?",
                     (o.repository_id, o.query_owner_ref, o.operation_id)).fetchone()
    return r[0] if r else None


def _move(conn: sqlite3.Connection, o: ExactOriginal, sets: str, args: tuple[Any, ...], allowed_from: tuple[str, ...]) -> bool:
    marks = ",".join("?" for _ in allowed_from)
    cur = conn.execute(f"UPDATE wiskey_fence_intents SET {sets} WHERE repository_id=? AND query_owner_ref=? AND operation_id=? AND state IN ({marks})",
                       (*args, o.repository_id, o.query_owner_ref, o.operation_id, *allowed_from))
    return cur.rowcount == 1


def mark_sent(conn: sqlite3.Connection, o: ExactOriginal, now: str | None = None) -> None:
    """intent -> sent, once. A frame is never sent for an intent that is not in `intent`."""
    if not _move(conn, o, "state='sent', sent_at=?", (now or _now(),), ("intent",)):
        raise IntentError("not_sendable")


def mark_unknown(conn: sqlite3.Connection, o: ExactOriginal, code: str, now: str | None = None) -> None:
    """The reply was missing / invalid / late: UNKNOWN, kept open. Never moves a terminal intent."""
    if not wp.is_ref(code):
        code = "unknown"
    _move(conn, o, "state='unknown', reason_code=?, settled_at=NULL", (code,), ("sent", "unknown"))


def _terminal(conn: sqlite3.Connection, o: ExactOriginal, new_state: str, reason: str | None, created_user_id: str | None, revision_after: int | None,
              now: str | None) -> str:
    """Accept ONE terminal fact. Returns `settled`, `duplicate` (the identical fact again) or `conflict` (a different one - never applied)."""
    row = conn.execute("SELECT state, reason_code, created_user_id, revision_after FROM wiskey_fence_intents WHERE repository_id=? AND query_owner_ref=? "
                       "AND operation_id=?", (o.repository_id, o.query_owner_ref, o.operation_id)).fetchone()
    if row is None:
        raise IntentError("unknown_intent")
    if row[0] in TERMINAL:
        return "duplicate" if (row[0], row[1], row[2], row[3]) == (new_state, reason, created_user_id, revision_after) else "conflict"
    try:
        ok = _move(conn, o, "state=?, reason_code=?, created_user_id=?, revision_after=?, settled_at=?",
                   (new_state, reason, created_user_id, revision_after, now or _now()), ("intent", "sent", "unknown"))
    except sqlite3.IntegrityError:
        return "conflict"  # the one-central-transition / one-created-person unique index
    return "settled" if ok else "conflict"


def settle_update(conn: sqlite3.Connection, o: ExactOriginal, verdict: wp.ReceiptVerdict, now: str | None = None) -> str:
    """Settle an UPDATE intent from a verified receipt verdict (`wiskey_peer.verify_receipt`). Only a settling verdict moves it."""
    if o.is_create:
        raise IntentError("create_needs_create_resolution")
    if not verdict.settles:
        if verdict.state == "unknown":
            mark_unknown(conn, o, verdict.code, now)
        return "open"
    if verdict.state == "committed" and verdict.commit is not None:
        return _terminal(conn, o, "committed", None, None, verdict.commit["revision_after"], now)
    return _terminal(conn, o, "never_committed", verdict.code, None, None, now)


# ---------------------------------------------------------------- the exact-original create resolution

@dataclass(frozen=True)
class CreateExpectation:
    """Built from a stored create intent and the verified peer: the only references an answer may carry."""

    original: ExactOriginal
    peer: wp.VerifiedPeerRef

    def __post_init__(self) -> None:
        wp.as_peer_binding(self.peer)
        o = self.original
        if not o.is_create or (o.repository_id, o.query_owner_ref, o.peer_binding_ref, o.peer_binding_revision) != (
                self.peer.repository_id, self.peer.query_owner_id, self.peer.peer_binding_ref, self.peer.peer_binding_revision):
            raise IntentError("invalid_expectation")


@dataclass(frozen=True)
class CreateVerdict:
    state: str  # committed | never_committed | in_flight | unknown
    settles: bool
    code: str
    created: dict[str, Any] | None = None


def _unknown(code: str) -> CreateVerdict:
    return CreateVerdict("unknown", False, code)


def verify_create_resolution(frame: Any, expect: CreateExpectation, *, context: wp.FenceContext | None = None) -> CreateVerdict:
    """Strict, byte-exact. A `committed` answer must carry the SAME origin ref / operation / request / binding and the created person's
    id + revision; anything missing, extra, mistyped, contradictory, an error envelope, a timeout or another version is UNKNOWN.
    `never_committed` by `recovered_uncommitted` additionally needs a fresh fence context proving the exclusive writer."""
    res = wp._result_of(frame)  # noqa: SLF001 - the same envelope rule as the receipt verifier
    if isinstance(res, wp.ReceiptVerdict):
        return _unknown(res.code)
    o, peer = expect.original, expect.peer
    if set(res) != CREATE_KEYS:
        return _unknown("fields")
    if not (wp.is_pos_int(res["schema_version"]) and res["schema_version"] == 1 and res["protocol"] == CREATE_PROTOCOL):
        return _unknown("unsupported_version")
    if res["scope"] != CREATE_SCOPE or res["device_state"] != "not_attested":
        return _unknown("scope")
    for key, want in (("repository_id", o.repository_id), ("query_owner_id", o.query_owner_ref), ("peer_binding_ref", o.peer_binding_ref),
                      ("request_id", o.request_id), ("operation_id", o.operation_id), ("operation_binding_ref", o.operation_binding_ref),
                      ("origin_ref", o.origin_ref)):
        got = res[key]
        if not isinstance(got, str) or got != want:
            return _unknown(f"mismatch:{key}")
    if not wp.is_pos_int(res["peer_binding_revision"]) or res["peer_binding_revision"] != o.peer_binding_revision:
        return _unknown("mismatch:peer_binding_revision")
    if not wp.is_pos_int(res["observed_epoch"]):
        return _unknown("malformed:observed_epoch")
    if res["observed_epoch"] < o.issued_epoch:
        return _unknown("epoch_regressed")
    st, terminal, created, reason, error = res["state"], res["terminal"], res["created"], res["reason_code"], res["error_code"]
    exclusive = res["exclusive_writer_established"]
    if st not in wp.STATES or not isinstance(terminal, bool) or not isinstance(exclusive, bool):
        return _unknown("malformed:state")
    if error is not None and not wp.is_ref(error):
        return _unknown("malformed:error_code")
    if st == "in_flight":
        ok = terminal is False and created is None and reason == "handler_active" and error is None
        return CreateVerdict("in_flight", False, "in_flight") if ok else _unknown("contradiction")
    if st == "unknown":
        ok = terminal is False and created is None and reason in wp.UNKNOWN_REASONS and error is None
        return _unknown(f"remote:{reason}" if ok else "contradiction")
    if terminal is not True or exclusive is not True:
        return _unknown("contradiction")
    if st == "committed":
        if reason is not None or error is not None or not isinstance(created, dict) or set(created) != {"user_id", "revision_after"}:
            return _unknown("contradiction")
        if not wp.is_ref(created["user_id"]) or not wp.is_pos_int(created["revision_after"]):
            return _unknown("malformed:created")
        return CreateVerdict("committed", True, "committed", {"user_id": created["user_id"], "revision_after": created["revision_after"]})
    if created is not None or reason not in wp.NEVER_REASONS:
        return _unknown("contradiction")
    if reason == "pre_effect_refused":
        return CreateVerdict("never_committed", True, "pre_effect_refused") if error is not None else _unknown("contradiction")
    if error is not None:
        return _unknown("contradiction")
    if (context is None or context.exclusive_writer_established is not True or context.repository_id != o.repository_id
            or context.writer_epoch != res["observed_epoch"] or context.owner_id != peer.query_owner_id):
        return _unknown("ownership_unproven")
    return CreateVerdict("never_committed", True, "recovered_uncommitted")


def settle_create(conn: sqlite3.Connection, expect: CreateExpectation, verdict: CreateVerdict, now: str | None = None) -> str:
    """Record the verified exact-original resolution of a create: the created person's id is stored from this verdict ALONE."""
    o = expect.original
    if not verdict.settles:
        if verdict.state == "unknown":
            mark_unknown(conn, o, verdict.code, now)
        return "open"
    if verdict.state == "committed" and verdict.created is not None:
        return _terminal(conn, o, "committed", None, verdict.created["user_id"], verdict.created["revision_after"], now)
    return _terminal(conn, o, "never_committed", verdict.code, None, None, now)


def open_intents(conn: sqlite3.Connection) -> list[ExactOriginal]:
    """Every intent without a terminal fact (the startup / recovery worklist): intent, sent and unknown."""
    rows = conn.execute(f"SELECT {_COLS} FROM wiskey_fence_intents WHERE state IN ('intent','sent','unknown') ORDER BY created_at").fetchall()
    return [_row_original(r) for r in rows]


# ---------------------------------------------------------------- WKB-295 (WisKey T05): the durable FULL original

ORIGINAL_CANON = "arx-json-c14n-v1"  # json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False), UTF-8
MAX_ORIGINAL_BYTES = 65536
MAX_DEPTH = 16
# keys whose value is a secret or a credential: an original carrying one is refused (no PIN / card / password / token is ever stored,
# and no hash over one either - a PIN hash is a guessing oracle). How a PIN- or card-bearing original is recorded: definition needed.
SECRET_KEYS = frozenset({"pin", "pin_code", "pincode", "password", "passcode", "card", "cards", "card_no", "card_number", "card_value",
                         "token", "access_token", "secret", "credential", "credentials"})
# WKB2-295 (owner decision 2026-10-23): the original names a person by REFERENCE only (WisKey's person id, the expected revision).
# A display name or a contact field is refused - never stripped, because the recorded bytes are exactly the bytes that are sent.
# How a write that changes a name is expressed by reference: definition needed (WisKey).
PERSONAL_KEYS = frozenset({"name", "names", "display_name", "displayname", "full_name", "fullname", "first_name", "firstname", "last_name",
                           "lastname", "given_name", "family_name", "surname", "nickname", "person_name", "employee_name", "user_name",
                           "username", "email", "e_mail", "mail", "phone", "phone_number", "phonenumber", "mobile", "telephone", "tel",
                           "address", "national_id", "id_number", "passport", "birth_date", "birthdate", "date_of_birth", "photo",
                           "face", "face_data", "picture"})
RECOVERY =("held_not_sent", "resolve_with_original", "unknown_no_original")


def _canon_value(value: Any, depth: int) -> None:
    if depth > MAX_DEPTH:
        raise IntentError("original_too_deep")
    if value is None or isinstance(value, (bool, str)):
        return
    if isinstance(value, int):
        if abs(value) > wp.MAX_JSON_INT:
            raise IntentError("original_unsafe_int")
        return
    if isinstance(value, list):
        for v in value:
            _canon_value(v, depth + 1)
        return
    if isinstance(value, dict):
        for k, v in value.items():
            if not isinstance(k, str):
                raise IntentError("original_key")
            if k.casefold() in SECRET_KEYS:
                raise IntentError("secret_in_original")
            if k.casefold() in PERSONAL_KEYS:
                raise IntentError("personal_in_original")
            _canon_value(v, depth + 1)
        return
    raise IntentError("original_type")  # float, bytes, tuple, objects: no ambiguous encoding is ever hashed


def canonical(value: Any) -> bytes:
    """The one byte form an original (or a context) is hashed and stored in. A dict at the top; refused when it cannot be encoded
    unambiguously or carries a secret key."""
    if not isinstance(value, dict) or not value:
        raise IntentError("original_shape")
    _canon_value(value, 0)
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(data) > MAX_ORIGINAL_BYTES:
        raise IntentError("original_too_large")
    return data


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _context_record(peer: wp.VerifiedPeerRef, ctx: wp.VerifiedWriteContext) -> dict[str, Any]:
    return {"repository_id": ctx.repository_id, "owner_id": ctx.owner_id, "writer_epoch": ctx.writer_epoch,
            "exclusive_writer_established": ctx.exclusive_writer_established, "source": ctx.source,
            "verified_peer_ref": peer.value, "peer_binding_ref": peer.peer_binding_ref, "peer_binding_revision": peer.peer_binding_revision}


def _check_context(peer: wp.VerifiedPeerRef, context: Any) -> wp.VerifiedWriteContext:
    """The context must be sealed (the agreed source), name the peer's repository and owner, and establish the exclusive writer."""
    wp.as_peer_binding(peer)
    try:
        ctx = wp.as_write_context(context)
    except wp.PeerSeamError:
        raise IntentError("context_unverified") from None
    if (ctx.repository_id, ctx.owner_id) != (peer.repository_id, peer.query_owner_id):
        raise IntentError("context_mismatch")
    if ctx.exclusive_writer_established is not True:
        raise IntentError("writer_unproven")
    return ctx


@dataclass(frozen=True)
class FullOriginal:
    """What was recorded before any I/O: the canonical original bytes, the verified context, and both hashes (checked on every read)."""

    exact: ExactOriginal
    original_json: str
    original_sha256: str
    context_json: str
    context_sha256: str

    def original(self) -> dict[str, Any]:
        return json.loads(self.original_json)

    def context(self) -> dict[str, Any]:
        return json.loads(self.context_json)


def _seal(data_dir: Path, exact_key: tuple[str, str, str], field: str, plaintext: str) -> str:
    try:
        return cs.seal_wiskey_intent(data_dir, *exact_key, field, plaintext)
    except cs.SecretError:
        raise IntentError("seal_failed") from None


def admit_with_original(conn: sqlite3.Connection, *, peer: wp.VerifiedPeerRef, context: Any, operation_id: str, request_id: str,
                        origin_ref: str, operation_binding_ref: str, command: str, original: dict[str, Any], data_dir: Path,
                        user_id: str | None = None, revision_before: int | None = None, journal_op_id: str | None = None,
                        now: str | None = None) -> FullOriginal:
    """Record the intent AND its full original, the original's hash and the verified context in ONE transaction that is COMMITTED
    before this returns - so before any I/O can happen. The writer epoch is taken from the sealed context, never from the caller.
    WKB2-295: both hashes are over the canonical PLAINTEXT; the original and the context are then SEALED (connection_store, the
    bridge-key mechanism, key file under `data_dir`) and only the sealed blobs are stored - the plaintext never reaches the database.
    Refused (nothing written) with an open transaction on `conn` (its commit point would not be ours), an unverified / mismatched
    context, a context without the exclusive writer, a secret key or a personal field (name, contact) in the original, or a duplicate
    operation / request / origin."""
    ctx = _check_context(peer, context)
    if isinstance(original, dict) and "id" in original:
        raise IntentError("original_has_message_id")  # the HA WebSocket message id belongs to one connection, not to the original
    data = canonical(original)
    ctx_data = canonical(_context_record(peer, ctx))
    if conn.in_transaction:
        raise IntentError("open_transaction")
    key = (peer.repository_id, peer.query_owner_id, operation_id)
    if not wp.is_ref(operation_id):
        raise IntentError("invalid_intent")
    original_enc = _seal(data_dir, key, "original", data.decode("utf-8"))  # sealed before the transaction: no key I/O under the lock
    context_enc = _seal(data_dir, key, "context", ctx_data.decode("utf-8"))
    at = now or _now()
    conn.execute("BEGIN IMMEDIATE")
    try:
        exact = admit(conn, peer=peer, operation_id=operation_id, request_id=request_id, origin_ref=origin_ref,
                      operation_binding_ref=operation_binding_ref, issued_epoch=ctx.writer_epoch, command=command, user_id=user_id,
                      revision_before=revision_before, journal_op_id=journal_op_id, now=at)
        full = FullOriginal(exact, data.decode("utf-8"), sha256_hex(data), ctx_data.decode("utf-8"), sha256_hex(ctx_data))
        conn.execute("INSERT INTO wiskey_intent_originals (repository_id, query_owner_ref, operation_id, canonicalization, original_enc, "
                     "original_sha256, context_enc, context_sha256, recorded_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     (exact.repository_id, exact.query_owner_ref, exact.operation_id, ORIGINAL_CANON, original_enc,
                      full.original_sha256, context_enc, full.context_sha256, at))
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    return full


def stored_original(conn: sqlite3.Connection, o: ExactOriginal, *, data_dir: Path) -> FullOriginal | None:
    """The recorded full original of `o`, opened and re-hashed on read. None = no original (an old intent, or one whose sealed original
    was purged after its retention): UNKNOWN for good, never rebuilt. A sealed blob that does not open (another key - a database
    restored without its key file -, a blob moved from another intent or field, damage) is `original_unreadable`; bytes that no longer
    match their hashes or their canonical form are `original_corrupt`. Neither is ever used or repaired. Reading never creates a key."""
    r = conn.execute("SELECT canonicalization, original_enc, original_sha256, context_enc, context_sha256, purged_at FROM wiskey_intent_originals "
                     "WHERE repository_id=? AND query_owner_ref=? AND operation_id=?",
                     (o.repository_id, o.query_owner_ref, o.operation_id)).fetchone()
    if r is None:
        return None
    canon, oenc, osha, cenc, csha, purged = r
    if purged is not None or oenc is None or cenc is None:
        return None
    key = (o.repository_id, o.query_owner_ref, o.operation_id)
    try:
        oj = cs.open_wiskey_intent(data_dir, *key, "original", oenc)
        cj = cs.open_wiskey_intent(data_dir, *key, "context", cenc)
    except cs.SecretError:
        raise IntentError("original_unreadable") from None
    try:
        ok = (canon == ORIGINAL_CANON and sha256_hex(oj.encode("utf-8")) == osha and sha256_hex(cj.encode("utf-8")) == csha
              and canonical(json.loads(oj)) == oj.encode("utf-8") and json.loads(cj).get("writer_epoch") == o.issued_epoch)
    except (ValueError, IntentError, AttributeError):
        ok = False
    if not ok:
        raise IntentError("original_corrupt")
    return FullOriginal(o, oj, osha, cj, csha)


def send_once(conn: sqlite3.Connection, o: ExactOriginal, transport: Any, *, context: Any, peer: wp.VerifiedPeerRef, data_dir: Path,
              now: str | None = None) -> Any:
    """Send the RECORDED original exactly once. Order: (1) the stored original is opened and re-hashed (none -> `no_original`,
    unreadable / corrupt -> refused, nothing sent); (2) a FRESH sealed context must show the same repository, owner and writer epoch the
    original was admitted under, with the exclusive writer (else nothing is sent); (3) intent -> sent is COMMITTED; (4) only then the
    transport gets the stored bytes. A transport failure is UNKNOWN (committed); nothing is ever resent - an intent not in `intent` is
    `not_sendable`."""
    full = stored_original(conn, o, data_dir=data_dir)
    if full is None:
        raise IntentError("no_original")
    ctx = _check_context(peer, context)
    if (peer.peer_binding_ref, peer.peer_binding_revision) != (o.peer_binding_ref, o.peer_binding_revision):
        raise IntentError("context_mismatch")
    if ctx.writer_epoch != o.issued_epoch:
        raise IntentError("epoch_changed")
    if conn.in_transaction:
        raise IntentError("open_transaction")
    conn.execute("BEGIN IMMEDIATE")
    try:
        mark_sent(conn, o, now)
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    try:
        return transport(full.original())
    except Exception:  # noqa: BLE001 - the frame may have left: UNKNOWN, resolved only through the original, never resent
        mark_unknown(conn, o, "transport_error", now)
        conn.commit()
        return None


def resolve_request(conn: sqlite3.Connection, o: ExactOriginal, *, data_dir: Path) -> dict[str, Any]:
    """Arx's PROPOSED exact-original resolve body (WisKey's wire shape for peer_receipts / resolve: definition needed): the exact
    references, the full original (opened from its sealed form) and both hashes. `no_original` for an intent without a recorded
    original or whose original was purged - it is never rebuilt; `original_unreadable` / `original_corrupt` when it cannot be trusted."""
    full = stored_original(conn, o, data_dir=data_dir)
    if full is None:
        raise IntentError("no_original")
    return {**o.as_request(), "query_owner_ref": o.query_owner_ref, "issued_epoch": o.issued_epoch, "canonicalization": ORIGINAL_CANON,
            "original": full.original(), "original_sha256": full.original_sha256, "context": full.context(),
            "context_sha256": full.context_sha256}


def recovery_plan(conn: sqlite3.Connection, *, data_dir: Path) -> list[tuple[ExactOriginal, str]]:
    """The restart worklist, classified; it changes nothing and sends nothing.
    held_not_sent         a recorded original still in `intent`: by construction (`send_once` commits `sent` before any I/O) it never
                          left Arx. It is NOT sent automatically; a send needs `send_once` under a fresh context with the same epoch.
    resolve_with_original `sent` / `unknown` with a readable recorded original: only the exact-original resolve may settle it.
    unknown_no_original   no readable recorded original (an old intent, one from the older `admit`, a corrupt one, or a database restored
                          without its key file): UNKNOWN for good - no reconstruction, no replay, no extra create."""
    out: list[tuple[ExactOriginal, str]] = []
    for o in open_intents(conn):
        try:
            full = stored_original(conn, o, data_dir=data_dir)
        except IntentError:
            full = None
        st = state(conn, o)
        out.append((o, "unknown_no_original" if full is None else "held_not_sent" if st == "intent" else "resolve_with_original"))
    return out


# ---------------------------------------------------------------- WKB2-295: retention of the sealed originals (owner 2026-10-23)

RETENTION_DEFAULT_DAYS = 30
RETENTION_MIN_DAYS = 1  # the safe floor: an original is kept at least one day after its terminal fact (the 0146 trigger re-checks it)
RETENTION_MAX_DAYS = 365


def clamp_retention(days: Any) -> int:
    try:
        n = int(days)
    except (TypeError, ValueError):
        return RETENTION_DEFAULT_DAYS
    return max(RETENTION_MIN_DAYS, min(RETENTION_MAX_DAYS, n))


def purge_originals(conn: sqlite3.Connection, *, days: Any, now: datetime | None = None) -> int:
    """NULL the sealed original and context of every intent that is TERMINAL (committed / never_committed) and whose terminal fact is
    older than `days` (clamped 1..365); stamp `purged_at`. The row, both hashes and the intent's state stay as proof. An open intent
    (intent / sent / unknown) is never purged, however old. Idempotent (an already purged row is not touched again). Runs inside the
    caller's transaction and returns the number of rows purged. Never reads or opens a sealed value."""
    at = now or datetime.now(timezone.utc)
    cutoff = _iso(at - timedelta(days=clamp_retention(days)))
    cur = conn.execute(
        "UPDATE wiskey_intent_originals SET original_enc = NULL, context_enc = NULL, purged_at = ? "
        "WHERE purged_at IS NULL AND EXISTS (SELECT 1 FROM wiskey_fence_intents f WHERE f.repository_id = wiskey_intent_originals.repository_id "
        "AND f.query_owner_ref = wiskey_intent_originals.query_owner_ref AND f.operation_id = wiskey_intent_originals.operation_id "
        "AND f.state IN ('committed', 'never_committed') AND f.settled_at IS NOT NULL AND julianday(f.settled_at) <= julianday(?))",
        (_iso(at), cutoff))
    return cur.rowcount


class LiveResolveTransport:
    """The live READ of an exact-original resolution is not built: the command name, envelope and identity are a joint pin with the
    Mac (2026-10-21). It refuses without sending a frame."""

    def resolve(self, original: ExactOriginal) -> Any:  # noqa: ARG002
        raise wp.PeerSeamError("not_built")
