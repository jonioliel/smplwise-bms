"""ECCACT-295 (directive item 2): the DURABLE immutable intents of the WisKey people-write fence, and the exact-original contract for
a create whose reply was never valid.

Why
- A people write that left Arx without a verified reply is UNKNOWN. Arx must be able to ask WisKey about THAT write and nothing else:
  by the exact original references it recorded before the frame left (repository, dedicated query owner ref, operation id, request id,
  origin ref, operation-binding ref, peer binding ref + revision, writer epoch) - never by name, employee number, PIN, card, policy
  similarity or "the newest person". `wiskey_fence_intents` (migration 0145, built as provisional 0137) holds those references immutably; only the
  state columns move, only forward, and exactly one terminal fact is ever accepted for an intent.
- A receipt never proves a create (`proves_create` False). A create intent settles only through `settle_resolution` (below), which
  records the created person's id from the verified peer_receipts/resolve answer alone.
- No replay: nothing in this module sends anything. A mutation is sent once; a resolution is a READ of the original; the intent table
  refuses a second admission of the same operation / request / origin (unique keys) and a second terminal fact.

Status
- WKADAPT-295 (WisKey round 2, 2026-10-23): the REAL read is `hikvision_intercom/peer_receipts/resolve` (wiskey_peer.RESOLVE_COMMAND,
  `resolve_parameters` / `verify_resolution`), settled here by `settle_resolution`: `found` -> committed, everything else stays UNKNOWN
  and open. It never writes never_committed and an UNKNOWN never makes an intent sendable again (no replay, no re-create).
- REMOVED (PERSONWRITES-CLEANUP-295, W-026): Arx's never-shipped draft1 create-resolution proposal (`PROPOSED_CREATE_*`,
  `CREATE_*`, `CreateExpectation`, `CreateVerdict`,
  `verify_create_resolution`, `settle_create`, `ExactOriginal.as_request`). It had no caller. The table `wiskey_fence_intents`
  (migration 0145) is unchanged; see docs/changes/PERSONWRITES-CLEANUP-295.md.
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
    """Settle an UPDATE intent from a receipt verdict (`wiskey_peer.ReceiptVerdict`). Only a settling verdict moves it. A create
    intent is refused (it settles only through `settle_resolution`); the refusal code is unchanged."""
    if o.is_create:
        raise IntentError("create_needs_create_resolution")
    if not verdict.settles:
        if verdict.state == "unknown":
            mark_unknown(conn, o, verdict.code, now)
        return "open"
    if verdict.state == "committed" and verdict.commit is not None:
        return _terminal(conn, o, "committed", None, None, verdict.commit["revision_after"], now)
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
    """The live peer_receipts/resolve READ is not built: it needs the signed peer_query client (wiskey-peer-query.v1 bridge proof,
    signed wiskey-peer-http.v1 response) and the pairing-key source. It refuses without sending a frame."""

    def resolve(self, current: wp.VerifiedPeerRef, original: wp.ResolveOriginal) -> Any:  # noqa: ARG002
        raise wp.PeerSeamError("not_built")
