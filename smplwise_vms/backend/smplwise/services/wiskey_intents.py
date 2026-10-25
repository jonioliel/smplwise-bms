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
- WKADAPT-295 (WisKey round 2, 2026-10-23): the REAL read is `hikvision_intercom/peer_receipts/resolve` (wiskey_peer.RESOLVE_COMMAND,
  `resolve_parameters` / `verify_resolution`), settled here by `settle_resolution`: `found` -> committed, everything else stays UNKNOWN
  and open. It never writes never_committed and an UNKNOWN never makes an intent sendable again (no replay, no re-create).
- HISTORICAL: `PROPOSED_CREATE_COMMAND` / `verify_create_resolution` / `ExactOriginal.as_request` were Arx's PROPOSAL
  (`wiskey-create-resolution-draft1`); WisKey says it is not an alias of peer_receipts/resolve and never shipped it. No caller.
- The live read is NOT built (`LiveResolveTransport` refuses `not_built`): the signed peer_query client, the pairing-key source and the
  W1 descriptor + descriptor_epoch Arx would have to store per write are not available yet. `query_owner_ref` is an opaque ref: an HA user id, or the agreed bridge service type once
  the joint pin names it - this module never fabricates either."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from . import wiskey_peer as wp

RESOLVE_COMMAND = wp.RESOLVE_COMMAND  # the real receipt read (peer_receipts/resolve)
# HISTORICAL (WKADAPT-295): never shipped by WisKey and not an alias of RESOLVE_COMMAND; kept only for the old fake tests, never wired
PROPOSED_CREATE_COMMAND = "hikvision_intercom/person_writes/resolve_create"
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


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


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
        """HISTORICAL refs-only request of the never-shipped proposal; NOT the peer_receipts/resolve wire (that needs the full
        seven-field original: wiskey_peer.ResolveOriginal + resolve_parameters). No name / PIN / card / policy field exists."""
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


def settle_resolution(conn: sqlite3.Connection, o: ExactOriginal, verdict: wp.ResolutionVerdict, now: str | None = None) -> str:
    """Record a peer_receipts/resolve verdict (wiskey_peer.verify_resolution) for an update OR a create intent. `found` settles the
    intent as committed (once; a different later fact is a conflict). Anything else marks it UNKNOWN and leaves it open: this route
    NEVER writes never_committed, and an unknown intent can never be sent again (mark_sent only moves `intent`) - no replay."""
    if not isinstance(verdict, wp.ResolutionVerdict):
        raise IntentError("not_a_resolution")
    if not verdict.settles or verdict.state != "committed":
        mark_unknown(conn, o, verdict.code, now)
        return "open"
    # A committed row needs revision_after (and, for a create, the created person id) - migration 0145's CHECK. WisKey names
    # `person_revision` in the receipt; the created person's key is not pinned yet (`user_id` assumed). A found receipt without them
    # cannot be recorded: the intent stays UNKNOWN and open (still never replayed) until the receipt schema is pinned with WisKey.
    rec = verdict.receipt or {}
    revision_after, created = rec.get("person_revision"), rec.get("user_id") if o.is_create else None
    if not wp.is_pos_int(revision_after) or (o.is_create and (not wp.is_ref(created) or revision_after != 1)):
        mark_unknown(conn, o, "receipt_incomplete", now)
        return "open"
    if not o.is_create and o.revision_before is not None and revision_after <= o.revision_before:
        mark_unknown(conn, o, "receipt_incomplete", now)
        return "open"
    return _terminal(conn, o, "committed", "resolved_found", created, revision_after, now)


class LiveResolveTransport:
    """WK4ADOPT-295 (W-010): the DEDICATED live `peer_receipts/resolve` read over the Arx-side owner of the verified connection (the
    direct join's port: `wiskey-peer-query.v1`, reply MAC + connection_ref + id verified before the result is read). Without a port it
    refuses `not_built` without sending a frame (as before). The parameters are exactly `wiskey_peer.resolve_parameters` (the CURRENT
    read binding + the full original, unchanged); every read leaves a `PeerReadReceipt`. `found` settles a central commit only;
    `unknown`, a refusal, a disconnect or a malformed answer stay UNKNOWN - never never_committed, never a licence to resend."""

    COMMAND = "peer_receipts/resolve"

    def __init__(self, port: Any = None, *, timeout_s: float = wp.PEER_READ_TIMEOUT_S) -> None:
        self.port = port
        self.timeout_s = timeout_s
        self.receipts: list[wp.PeerReadReceipt] = []

    def __repr__(self) -> str:
        return f"LiveResolveTransport(wired={self.port is not None})"

    def _once(self, current: wp.VerifiedPeerRef, original: wp.ResolveOriginal) -> tuple[Any, wp.PeerReadReceipt | None, str | None]:
        """ONE call: (frame | None, the receipt of THIS call | None, refusal code | None). The receipt is returned by the call itself,
        never read back from `self.receipts` (WR6-01): a local refusal before any frame (no port, `resolve_parameters` refusing) has
        no receipt at all."""
        if self.port is None:
            return None, None, "not_built"
        try:
            params = wp.resolve_parameters(current, original)  # refuses (nothing sent) a mismatched current binding
        except wp.PeerSeamError as exc:
            return None, None, exc.code
        frame, receipt = wp.peer_read(self.port, self.COMMAND, params, timeout_s=self.timeout_s)
        self.receipts.append(receipt)  # the history; never the source of a call's own receipt
        if frame is None:
            return None, receipt, receipt.code or receipt.outcome
        return frame, receipt, None

    def resolve(self, current: wp.VerifiedPeerRef, original: wp.ResolveOriginal) -> Any:
        """The native frame of one read (for `wiskey_peer.verify_resolution`); raises PeerSeamError when no verified answer exists."""
        frame, _receipt, code = self._once(current, original)
        if frame is None:
            raise wp.PeerSeamError(code or "unknown")
        return frame

    def read(self, current: wp.VerifiedPeerRef, original: wp.ResolveOriginal) -> tuple[wp.ResolutionVerdict, wp.PeerReadReceipt | None]:
        """(verdict, the receipt of THIS read or None when nothing was sent): never raises; anything but a verified `found` is an
        UNKNOWN verdict."""
        frame, receipt, code = self._once(current, original)
        if frame is None:
            return wp.ResolutionVerdict("unknown", False, code or "unknown"), receipt
        return wp.verify_resolution(frame), receipt


def resolve_intent(conn: sqlite3.Connection, o: ExactOriginal, original: wp.ResolveOriginal, current: wp.VerifiedPeerRef,
                   transport: LiveResolveTransport, now: str | None = None) -> tuple[str, wp.ResolutionVerdict, wp.PeerReadReceipt | None]:
    """One READ of one open intent's exact original, settled by `settle_resolution`: (settle result, verdict, receipt). Nothing is
    ever sent for the intent itself here; an UNKNOWN stays open and is never sendable again."""
    verdict, receipt = transport.read(current, original)
    return settle_resolution(conn, o, verdict, now), verdict, receipt
