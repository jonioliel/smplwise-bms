"""Alternative per-record store: person and original receipt share one commit.

Development component only. No runtime registration, migration or admission
budget is changed. Call from a dedicated storage worker, never the HA event loop.
Private person payloads stay in the database and never enter public receipts.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from ..trusted_actions.envelope import thaw
from ..trusted_actions.peer_boundary import MAX_COUNTER, PeerMessage, counter
from ..trusted_actions.validation import Refusal, reference

PERSON_MAX_BYTES = 65_536
RECEIPT_MAX_BYTES = 32_768
FORMAT = "wiskey-atomic-person-sqlite-v1"


def canonical(value: Any, limit: int) -> bytes:
    """Bound both traversal and final UTF-8 bytes; never stringify unknown types."""
    remaining = 4096
    byte_budget = limit

    def text_size(item: str) -> None:
        nonlocal byte_budget
        try:
            byte_budget -= len(item.encode("utf-8"))
        except UnicodeError:
            raise Refusal("invalid_fields") from None
        if byte_budget < 0:
            raise Refusal("record_too_large")

    def visit(item: Any, depth: int = 0) -> None:
        nonlocal remaining
        remaining -= 1
        if remaining < 0 or depth > 12:
            raise Refusal("record_too_large")
        kind = type(item)
        if item is None or kind is bool:
            return
        if kind is int:
            if not -MAX_COUNTER <= item <= MAX_COUNTER:
                raise Refusal("invalid_fields")
        elif kind is str:
            if len(item) > limit:
                raise Refusal("record_too_large")
            text_size(item)
        elif kind in (dict, list):
            if len(item) > 1024:
                raise Refusal("record_too_large")
            if kind is dict:
                for key, child in item.items():
                    if type(key) is not str or len(key) > 128:
                        raise Refusal("invalid_fields")
                    text_size(key)
                    visit(child, depth + 1)
            else:
                for child in item:
                    visit(child, depth + 1)
        else:
            raise Refusal("invalid_fields")

    visit(value)
    try:
        encoded = json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")
    except (ValueError, UnicodeError):
        raise Refusal("invalid_fields") from None
    if len(encoded) > limit:
        raise Refusal("record_too_large")
    return encoded


class AtomicPersonStore:
    """Single-owner SQLite connection; all peer checks are inside its transaction."""

    def __init__(self, path: str | Path, *, repository_id: str) -> None:
        reference(repository_id)
        self.repository_id = repository_id
        self.path = Path(path)
        # Refuse symlinks and create a new file privately before SQLite opens it.
        if self.path.is_symlink():
            raise Refusal("binding_denied")
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(fd)
        self.db = sqlite3.connect(str(self.path), isolation_level=None, timeout=5)
        self.db.row_factory = sqlite3.Row
        try:
            tables = {
                row[0]
                for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            if tables:
                if "metadata" not in tables or dict(
                    self.db.execute("SELECT key,value FROM metadata")
                ) != {"format": FORMAT, "repository_id": repository_id}:
                    raise Refusal("binding_denied")
            if self.db.execute("PRAGMA journal_mode=WAL").fetchone()[0] != "wal":
                raise Refusal("storage_write_failed")
            self.db.execute("PRAGMA synchronous=FULL")
            self.db.execute("PRAGMA fullfsync=ON")
            self.db.execute("PRAGMA foreign_keys=ON")
            self.db.executescript(f"""
                CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS binding_heads (
                    ref TEXT PRIMARY KEY, revision INTEGER NOT NULL
                    CHECK(revision BETWEEN 1 AND {MAX_COUNTER}));
                CREATE TABLE IF NOT EXISTS binding_versions (
                    ref TEXT NOT NULL, revision INTEGER NOT NULL, peer TEXT NOT NULL,
                    owner TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)),
                    PRIMARY KEY(ref, revision));
                CREATE TABLE IF NOT EXISTS history_grants (
                    ref TEXT NOT NULL, revision INTEGER NOT NULL,
                    allowed INTEGER NOT NULL CHECK(allowed IN (0,1)),
                    PRIMARY KEY(ref, revision),
                    FOREIGN KEY(ref, revision) REFERENCES binding_versions(ref, revision));
                CREATE TABLE IF NOT EXISTS people (
                    id TEXT PRIMARY KEY, epoch INTEGER NOT NULL
                    CHECK(epoch BETWEEN 1 AND {MAX_COUNTER}),
                    revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND {MAX_COUNTER}),
                    payload BLOB NOT NULL CHECK(length(payload)<={PERSON_MAX_BYTES}));
                CREATE TABLE IF NOT EXISTS receipts (
                    operation_id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL,
                    original BLOB NOT NULL CHECK(length(original)<={RECEIPT_MAX_BYTES}),
                    person_digest TEXT NOT NULL, binding_ref TEXT NOT NULL,
                    binding_revision INTEGER NOT NULL,
                    body BLOB CHECK(length(body)<={RECEIPT_MAX_BYTES}), archive_digest TEXT,
                    CHECK((body IS NULL) != (archive_digest IS NULL)),
                    FOREIGN KEY(binding_ref, binding_revision)
                    REFERENCES binding_versions(ref, revision));
                CREATE TABLE IF NOT EXISTS unresolved (
                    operation_id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL,
                    original BLOB NOT NULL CHECK(length(original)<={RECEIPT_MAX_BYTES}),
                    binding_ref TEXT NOT NULL, binding_revision INTEGER NOT NULL,
                    FOREIGN KEY(binding_ref, binding_revision)
                    REFERENCES binding_versions(ref, revision));
            """)
            with self._transaction():
                identity = dict(self.db.execute("SELECT key,value FROM metadata"))
                if not identity:
                    self.db.executemany(
                        "INSERT INTO metadata VALUES(?,?)",
                        [("format", FORMAT), ("repository_id", repository_id)],
                    )
                elif identity != {"format": FORMAT, "repository_id": repository_id}:
                    raise Refusal("binding_denied")
        except BaseException:
            self.db.close()
            raise

    @contextmanager
    def _transaction(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.execute("COMMIT")
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise

    def bind(
        self,
        *,
        binding_ref: str,
        expected_revision: int,
        peer: str,
        owner: str,
        active: bool = True,
        historical_read: bool = False,
    ) -> int:
        """Owner-provisioning primitive; never exposed to a peer/request callback."""
        for value in (binding_ref, peer, owner):
            reference(value)
        counter(expected_revision, zero=True)
        if type(active) is not bool or type(historical_read) is not bool:
            raise Refusal("invalid_fields")
        revision = counter(expected_revision + 1)
        with self._transaction():
            row = self.db.execute(
                "SELECT revision FROM binding_heads WHERE ref=?", (binding_ref,)
            ).fetchone()
            if (row[0] if row else 0) != expected_revision:
                raise Refusal("binding_denied")
            self.db.execute(
                "INSERT INTO binding_versions VALUES(?,?,?,?,?)",
                (binding_ref, revision, peer, owner, int(active)),
            )
            self.db.execute(
                "INSERT INTO history_grants VALUES(?,?,?)",
                (binding_ref, revision, int(historical_read)),
            )
            self.db.execute(
                "INSERT INTO binding_heads VALUES(?,?) ON CONFLICT(ref) "
                "DO UPDATE SET revision=excluded.revision",
                (binding_ref, revision),
            )
        return revision

    def historical_permission(self, binding_ref: str, revision: int, *, allowed: bool) -> None:
        reference(binding_ref)
        counter(revision)
        if type(allowed) is not bool:
            raise Refusal("invalid_fields")
        with self._transaction():
            if (
                self.db.execute(
                    "UPDATE history_grants SET allowed=? WHERE ref=? AND revision=?",
                    (int(allowed), binding_ref, revision),
                ).rowcount
                != 1
            ):
                raise Refusal("binding_denied")

    def _admit(self, message: PeerMessage, *, historical: bool = False) -> None:
        if type(message) is not PeerMessage:
            raise Refusal("Unauthorized")
        message.check()
        peer = message.verification
        if peer.repository_id != self.repository_id:
            raise Refusal("binding_denied")
        row = self.db.execute(
            """SELECT v.peer,v.owner,v.active,h.revision,g.allowed
            FROM binding_versions v JOIN binding_heads h ON h.ref=v.ref
            JOIN history_grants g ON g.ref=v.ref AND g.revision=v.revision
            WHERE v.ref=? AND v.revision=?""",
            (peer.peer_binding_ref, peer.peer_binding_revision),
        ).fetchone()
        if (
            row is None
            or row["peer"] != peer.verified_peer_ref
            or row["owner"] != message.query_owner_id
            or (
                not historical
                and (row["active"] != 1 or row["revision"] != peer.peer_binding_revision)
            )
            or (historical and row["allowed"] != 1)
        ):
            raise Refusal("binding_denied")
        message.check()

    @staticmethod
    def _original(message: PeerMessage) -> bytes:
        if type(message) is not PeerMessage:
            raise Refusal("Unauthorized")
        message.check()
        return canonical(
            {
                "descriptor": thaw(message.request.descriptor),
                "descriptor_epoch": message.verification.descriptor.epoch,
                "query_owner_id": message.query_owner_id,
                "repository_id": message.verification.repository_id,
                "verified_peer_ref": message.verification.verified_peer_ref,
                "peer_binding_ref": message.verification.peer_binding_ref,
                "peer_binding_revision": message.verification.peer_binding_revision,
            },
            RECEIPT_MAX_BYTES,
        )

    def _prior(self, operation: str, request: str) -> sqlite3.Row | None:
        rows = self.db.execute(
            "SELECT * FROM receipts WHERE operation_id=? OR request_id=?", (operation, request)
        ).fetchall()
        if len(rows) > 1:
            raise Refusal("binding_denied")
        return rows[0] if rows else None

    def preserve_intent(self, message: PeerMessage) -> None:
        """Durable unresolved-create fence; never evicted on restart or archive."""
        original = self._original(message)
        operation, request = message.request.get("operation_id"), message.request.get("request_id")
        peer = message.verification
        if message.request.get("action") != "users/create":
            raise Refusal("binding_denied")
        with self._transaction():
            self._admit(message)
            if self._prior(operation, request):
                raise Refusal("binding_denied")
            rows = self.db.execute(
                "SELECT original FROM unresolved WHERE operation_id=? OR request_id=?",
                (operation, request),
            ).fetchall()
            if rows:
                if len(rows) != 1 or rows[0][0] != original:
                    raise Refusal("binding_denied")
            else:
                self.db.execute(
                    "INSERT INTO unresolved VALUES(?,?,?,?,?)",
                    (
                        operation,
                        request,
                        original,
                        peer.peer_binding_ref,
                        peer.peer_binding_revision,
                    ),
                )
            self._admit(message)

    def commit_person(
        self,
        message: PeerMessage,
        *,
        person_id: str,
        epoch: int,
        expected_revision: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Internal source-preparer primitive; not a public arbitrary-write API.

        The eventual engine adapter must bind the private payload to the exact
        original opaque parameter reference. This store does not claim that
        source-preparer integration, station application or signed capture.
        """
        reference(person_id)
        counter(epoch)
        counter(expected_revision, zero=True)
        revision = counter(expected_revision + 1)
        if type(payload) is not dict:
            raise Refusal("invalid_fields")
        person = canonical(
            {"id": person_id, "epoch": epoch, "revision": revision, "payload": payload},
            PERSON_MAX_BYTES,
        )
        digest = hashlib.sha256(person).hexdigest()
        original = self._original(message)
        operation, request = message.request.get("operation_id"), message.request.get("request_id")
        peer = message.verification
        if message.request.get("action") != (
            "users/create" if expected_revision == 0 else "users/update"
        ):
            raise Refusal("binding_denied")
        body = canonical(
            {
                "schema_version": FORMAT,
                "state": "central_committed",
                "user_id": person_id,
                "epoch": epoch,
                "person_revision": revision,
                "original": json.loads(original),
                "physical_applied": None,
                "signed_capture_covered": False,
            },
            RECEIPT_MAX_BYTES,
        )
        with self._transaction():
            self._admit(message)
            previous = self._prior(operation, request)
            if previous:
                if previous["original"] != original or previous["person_digest"] != digest:
                    raise Refusal("binding_denied")
                result = self._receipt_body(previous)
                self._admit(message)
                return result
            intent = self.db.execute(
                "SELECT original FROM unresolved WHERE operation_id=? OR request_id=?",
                (operation, request),
            ).fetchall()
            if intent and (len(intent) != 1 or intent[0][0] != original):
                raise Refusal("binding_denied")
            old = self.db.execute(
                "SELECT epoch,revision FROM people WHERE id=?", (person_id,)
            ).fetchone()
            if (
                old is None
                and expected_revision != 0
                or old is not None
                and (old["revision"] != expected_revision or old["epoch"] != epoch)
            ):
                raise Refusal("binding_denied")
            self.db.execute(
                "INSERT INTO people VALUES(?,?,?,?) ON CONFLICT(id) "
                "DO UPDATE SET revision=excluded.revision,payload=excluded.payload",
                (person_id, epoch, revision, person),
            )
            self.db.execute(
                "INSERT INTO receipts VALUES(?,?,?,?,?,?,?,NULL)",
                (
                    operation,
                    request,
                    original,
                    digest,
                    peer.peer_binding_ref,
                    peer.peer_binding_revision,
                    body,
                ),
            )
            self.db.execute("DELETE FROM unresolved WHERE operation_id=?", (operation,))
            self._admit(message)
        self._admit(message)
        return json.loads(body)

    def _receipt_body(self, row: sqlite3.Row) -> dict[str, Any]:
        encoded = row["body"]
        if encoded is None:
            archive = (
                self.path.parent / (self.path.name + ".archive") / (row["archive_digest"] + ".json")
            )
            try:
                fd = os.open(archive, os.O_RDONLY | os.O_NOFOLLOW)
                with os.fdopen(fd, "rb") as source:
                    encoded = source.read(RECEIPT_MAX_BYTES + 1)
            except OSError:
                raise Refusal("status_unknown") from None
            if (
                hashlib.sha256(encoded).hexdigest() != row["archive_digest"]
                or len(encoded) > RECEIPT_MAX_BYTES
            ):
                raise Refusal("status_unknown")
        return json.loads(encoded)

    def receipt(
        self,
        message: PeerMessage,
        *,
        historical: bool = False,
        original_reference: bytes | None = None,
    ) -> dict[str, Any]:
        # A historical query is freshly authenticated; it never reuses an
        # expired original mutation as query authority. Original bytes are an
        # exact lookup key, not a principal, permission or re-dispatch request.
        original = self._original(message) if original_reference is None else original_reference
        if type(original) is not bytes or len(original) > RECEIPT_MAX_BYTES:
            raise Refusal("invalid_fields")
        try:
            values = json.loads(original)
            if canonical(values, RECEIPT_MAX_BYTES) != original:
                raise Refusal("invalid_fields")
            operation = values["descriptor"]["operation_id"]
            request = values["descriptor"]["request_id"]
            reference(operation)
            reference(request)
        except (ValueError, KeyError, TypeError):
            raise Refusal("invalid_fields") from None
        with self._transaction():
            self._admit(message, historical=historical)
            row = self._prior(operation, request)
            peer = message.verification
            if (
                row is None
                or row["original"] != original
                or row["binding_ref"] != peer.peer_binding_ref
                or row["binding_revision"] != peer.peer_binding_revision
            ):
                raise Refusal("status_unknown")
            result = self._receipt_body(row)
            self._admit(message, historical=historical)
            return result

    def archive_receipt(self, operation_id: str) -> str:
        """Owner maintenance: durable verified archive first, then retain the fence.

        A crash before the database commit leaves a harmless orphan archive. A
        missing/damaged archive after it refuses lookup and never admits replay.
        Unresolved rows have no completed receipt and cannot be retired here.
        """
        reference(operation_id)
        folder = self.path.parent / (self.path.name + ".archive")
        folder.mkdir(mode=0o700, exist_ok=True)
        if folder.is_symlink():
            raise Refusal("binding_denied")
        with self._transaction():
            row = self.db.execute(
                "SELECT * FROM receipts WHERE operation_id=?", (operation_id,)
            ).fetchone()
            if row is None:
                raise Refusal("status_unknown")
            if row["body"] is None:
                self._receipt_body(row)
                return row["archive_digest"]
            body = row["body"]
            digest = hashlib.sha256(body).hexdigest()
            target = folder / (digest + ".json")
            try:
                fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            except FileExistsError:
                fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW)
                with os.fdopen(fd, "rb") as source:
                    if source.read(RECEIPT_MAX_BYTES + 1) != body:
                        raise Refusal("status_unknown") from None
            else:
                with os.fdopen(fd, "wb") as destination:
                    destination.write(body)
                    destination.flush()
                    os.fsync(destination.fileno())
            directory = os.open(folder, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
            self.db.execute(
                "UPDATE receipts SET body=NULL,archive_digest=? WHERE operation_id=?",
                (digest, operation_id),
            )
        return digest

    def close(self) -> None:
        self.db.close()
