"""Separate opt-in durable attempt/cleanup journal for native feature effects.

No active store migration, runtime registration or device execution happens here.
The exact original request survives a lost acknowledgement. Reopening an existing
operation returns its record and never creates another permission to send it.
"""

from __future__ import annotations

import json
import os
import sqlite3
import stat
import weakref
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..trusted_actions.envelope import thaw
from ..trusted_actions.peer_boundary import counter
from ..trusted_actions.validation import Refusal, reference
from .arx_emergency_event_contract import KINDS as EVENT_KINDS
from .arx_execution_authority import FeatureLease
from .sqlite_connection_scope import require_connection_scope

FORMAT = "wiskey-arx-native-effects.v1"
BOUNDS_FORMAT = "wiskey-arx-native-effects-bounds.v1"
MAX_RECORD_BYTES = 262144
_SCHEMA = {
    ("table", "metadata"): "create table metadata(key text primary key,value text not null)",
    ("table", "effects"): (
        "create table effects( peer text not null, operation text not null, request text not null, "
        "original text not null, revision integer not null, body text not null, "
        "primary key(peer,operation), unique(peer,request))"
    ),
    ("index", "sqlite_autoindex_metadata_1"): None,
    ("index", "sqlite_autoindex_effects_1"): None,
    ("index", "sqlite_autoindex_effects_2"): None,
}
_OWNERS: weakref.WeakKeyDictionary[FeatureExecutionJournal, _JournalOwner] = (
    weakref.WeakKeyDictionary()
)


@dataclass(frozen=True)
class EffectJournalProfile:
    """Explicit independent effects budget; never upgrades an old journal."""

    max_records: int = 4096
    disk_budget_bytes: int = 32 * 1024**2

    def metadata(self) -> dict[str, str | int]:
        if (
            type(self.max_records) is not int
            or not 1 <= self.max_records <= 1_000_000
            or type(self.disk_budget_bytes) is not int
            or not 4 * 1024**2 <= self.disk_budget_bytes <= 32 * 1024**2
        ):
            raise Refusal("invalid_fields")
        return {
            "format": BOUNDS_FORMAT,
            "max_records": self.max_records,
            "disk_budget_bytes": self.disk_budget_bytes,
            "max_record_bytes": MAX_RECORD_BYTES,
            "reserve_bytes": 512 * 1024,
            "page_budget_divisor": 4,
        }


def ecc_effects_profile() -> EffectJournalProfile:
    """32MiB DB+WAL+SHM budget, independent of the native person image."""
    return EffectJournalProfile()


type _FileIdentity = tuple[int, int, int, int]
type _EffectKey = tuple[str, str]
type _IssuedEffect = tuple[weakref.ReferenceType[EffectRecord], _EffectKey, str, FeatureLease]
type _IssuedEffects = dict[int, _IssuedEffect]
type _JournalConfiguration = tuple[
    sqlite3.Connection, str, Path, _IssuedEffects, EffectJournalProfile | None, str | None
]


@dataclass(repr=False)
class _JournalOwner:
    configuration: _JournalConfiguration
    parent: _FileIdentity
    files: dict[str, _FileIdentity | None]
    closed: bool = False
    poisoned: bool = False
    geometry: tuple[tuple[str, Any], ...] = ()
    close_error: BaseException | None = None


def _identity(path: Path, *, directory: bool = False) -> _FileIdentity:
    try:
        info = path.lstat()
    except OSError:
        raise Refusal("storage_path_rebound") from None
    if (
        not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
        or info.st_uid != os.getuid()
        or info.st_mode & 0o077
        or not directory
        and info.st_nlink != 1
    ):
        raise Refusal("storage_path_rebound")
    return info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)


def _check_files(owner: _JournalOwner, *, initializing: bool = False) -> None:
    path = owner.configuration[2]
    if _identity(path.parent, directory=True) != owner.parent:
        raise Refusal("storage_path_rebound")
    rollback = Path(str(path) + "-journal")
    if rollback.exists() or rollback.is_symlink():
        raise Refusal("invalid_storage")
    for suffix, previous in tuple(owner.files.items()):
        target = Path(str(path) + suffix)
        try:
            target.lstat()
        except FileNotFoundError:
            if previous is not None:
                raise Refusal("storage_path_rebound") from None
            continue
        current = _identity(target)
        if previous is None and initializing:
            owner.files[suffix] = current
        elif previous != current:
            raise Refusal("storage_path_rebound")


def _encoded(value: Any) -> str:
    result = json.dumps(
        value, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False
    )
    if len(result) > MAX_RECORD_BYTES:
        raise Refusal("invalid_fields")
    return result


@dataclass(frozen=True, repr=False)
class EffectRecord:
    _journal: object
    _key: _EffectKey
    _original: str


class FeatureExecutionJournal:
    def __init__(
        self,
        path: str | Path,
        *,
        repository_id: str,
        expect_existing: bool = False,
        profile: EffectJournalProfile | None = None,
    ) -> None:
        if type(expect_existing) is not bool:
            raise Refusal("invalid_fields")
        if profile is not None and type(profile) is not EffectJournalProfile:
            raise Refusal("invalid_fields")
        self.profile = profile
        profile_text = None if profile is None else _encoded(EffectJournalProfile.metadata(profile))
        self.repository_id = reference(repository_id)
        self.path = Path(path).absolute()
        parent_identity = _identity(self.path.parent, directory=True)
        if self.path.is_symlink():
            raise Refusal("binding_denied")
        fd = os.open(
            self.path, os.O_RDWR | os.O_NOFOLLOW | (0 if expect_existing else os.O_CREAT), 0o600
        )
        try:
            info = os.fstat(fd)
            expected = info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mode & 0o077:
                raise Refusal("storage_path_rebound")
        finally:
            os.close(fd)
        self.db = sqlite3.connect(
            self.path.as_uri() + "?mode=rw" if expect_existing else str(self.path),
            uri=expect_existing,
            isolation_level=None,
            timeout=5,
        )
        self.db.row_factory = sqlite3.Row
        self._issued: _IssuedEffects = {}
        self._configuration: _JournalConfiguration = (
            self.db,
            repository_id,
            self.path,
            self._issued,
            profile,
            profile_text,
        )
        self.closed = False
        owner = _JournalOwner(
            self._configuration,
            parent_identity,
            {"": expected, "-wal": None, "-shm": None},
        )
        _OWNERS[self] = owner
        try:
            _check_files(owner, initializing=True)
            if profile is not None:
                FeatureExecutionJournal._disk_bytes(owner)
            tables = {
                r[0]
                for r in self.db.execute("SELECT name FROM main.sqlite_master WHERE type='table'")
            }
            expected_metadata: dict[str, str | None] = {
                "format": FORMAT,
                "repository_id": repository_id,
            }
            if profile is not None:
                expected_metadata["profile"] = profile_text
            if (expect_existing or tables) and (
                (expect_existing or profile is not None)
                and tables != {"metadata", "effects"}
                or "metadata" not in tables
                or dict(self.db.execute("SELECT key,value FROM main.metadata")) != expected_metadata
            ):
                raise Refusal("binding_denied")
            if tables:
                # Refuse foreign persisted objects before any schema or
                # journal-mode write. Known legacy metadata stays two keys.
                _check_files(owner, initializing=True)
                require_connection_scope(
                    owner.configuration[0],
                    owner.configuration[2],
                    row_factory=sqlite3.Row,
                    geometry=(),
                    verify=lambda: FeatureExecutionJournal._stable_labels(self),
                    schema=_SCHEMA,
                )
                if self.db.execute("PRAGMA journal_mode").fetchone()[0] != "wal":
                    raise Refusal("invalid_storage")
            if self.db.execute("PRAGMA journal_mode=WAL").fetchone()[0] != "wal":
                raise Refusal("storage_write_failed")
            self.db.execute("PRAGMA synchronous=FULL")
            self.db.execute("PRAGMA fullfsync=ON")
            if profile is not None:
                # A truncated pre-write WAL and no cache spilling bound one
                # transaction to at most one frame per dirty database page.
                # A quarter-budget DB leaves room for WAL, SHM and headroom;
                # no unbounded history is deleted to make a transaction fit.
                self.db.execute("PRAGMA cache_spill=OFF")
                self.db.execute("PRAGMA wal_autocheckpoint=1")
                page_size = self.db.execute("PRAGMA page_size").fetchone()[0]
                maximum = (profile.disk_budget_bytes - 512 * 1024) // (4 * page_size)
                if self.db.execute(f"PRAGMA max_page_count={maximum}").fetchone()[0] > maximum:
                    raise Refusal("journal_capacity")
            owner.geometry = tuple(
                (name, self.db.execute("PRAGMA " + name).fetchone()[0])
                for name in (
                    "page_size",
                    "max_page_count",
                    "cache_spill",
                    "synchronous",
                    "fullfsync",
                    "wal_autocheckpoint",
                    "journal_mode",
                )
            )
            self.db.executescript("""
                CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS effects(
                    peer TEXT NOT NULL, operation TEXT NOT NULL, request TEXT NOT NULL,
                    original TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL,
                    PRIMARY KEY(peer,operation), UNIQUE(peer,request));
            """)
            _check_files(owner, initializing=True)
            with FeatureExecutionJournal._transaction(self, initializing=not tables):
                self.db.executemany(
                    "INSERT OR IGNORE INTO main.metadata VALUES(?,?)",
                    list(expected_metadata.items()),
                )
            if profile is not None:
                FeatureExecutionJournal._bounded_limits(self, owner, validate_rows=True)
        except BaseException as error:
            owner.configuration[0].close()
            owner.closed = self.closed = True
            if profile is not None and isinstance(error, sqlite3.Error):
                raise Refusal("invalid_storage") from None
            raise

    @contextmanager
    def _transaction(
        self, *, initializing: bool = False, guard: Callable[[], None] | None = None
    ) -> Iterator[sqlite3.Connection]:
        owner = FeatureExecutionJournal._stable(self)
        db = owner.configuration[0]
        if owner.configuration[4] is not None:
            FeatureExecutionJournal._checkpoint(self, owner)
            FeatureExecutionJournal._bounded_limits(self, owner, metadata=not initializing)
        db.execute("BEGIN IMMEDIATE")
        try:
            FeatureExecutionJournal._stable(self)
            yield db
            FeatureExecutionJournal._stable(self)
            if owner.configuration[4] is not None:
                FeatureExecutionJournal._bounded_limits(self, owner)
                if guard is not None:
                    guard()
                FeatureExecutionJournal._stable(self)
            try:
                db.execute("COMMIT")
                FeatureExecutionJournal._stable(self)
                if owner.configuration[4] is not None:
                    FeatureExecutionJournal._checkpoint(self, owner)
                    if guard is not None:
                        guard()
                    FeatureExecutionJournal._stable(self)
            except BaseException:
                # The original commit may exist while its recoverable path was
                # replaced during COMMIT. Never acknowledge an admitted attempt
                # or reuse this provider until an explicit original reopen.
                owner.poisoned = True
                raise
        except BaseException as error:
            if db.in_transaction:
                db.execute("ROLLBACK")
            if owner.configuration[4] is not None and isinstance(error, sqlite3.Error):
                code = getattr(error, "sqlite_errorcode", None)
                raise Refusal(
                    "journal_capacity" if code == sqlite3.SQLITE_FULL else "storage_write_failed"
                ) from None
            raise

    def _stable_labels(self) -> _JournalOwner:
        owner = _OWNERS.get(self)
        if (
            owner is None
            or owner.closed
            or self.closed
            or self._configuration is not owner.configuration
            or self.db is not owner.configuration[0]
            or self.repository_id != owner.configuration[1]
            or self.path != owner.configuration[2]
            or self._issued is not owner.configuration[3]
            or self.profile is not owner.configuration[4]
            or self.profile is not None
            and (
                type(self.profile) is not EffectJournalProfile
                or _encoded(EffectJournalProfile.metadata(self.profile)) != owner.configuration[5]
            )
        ):
            raise Refusal("binding_denied")
        if owner.poisoned:
            raise Refusal("storage_reopen_required")
        _check_files(owner)
        return owner

    def _stable(self) -> _JournalOwner:
        owner = FeatureExecutionJournal._stable_labels(self)
        require_connection_scope(
            owner.configuration[0],
            owner.configuration[2],
            row_factory=sqlite3.Row,
            geometry=owner.geometry,
            verify=lambda: FeatureExecutionJournal._stable_labels(self),
            schema=_SCHEMA,
        )
        return owner

    @staticmethod
    def _disk_bytes(owner: _JournalOwner) -> int:
        _check_files(owner)
        total = 0
        for suffix in ("", "-wal", "-shm"):
            try:
                total += Path(str(owner.configuration[2]) + suffix).lstat().st_size
            except FileNotFoundError:
                continue
        _check_files(owner)
        profile = owner.configuration[4]
        if profile is not None and total > profile.disk_budget_bytes:
            raise Refusal("journal_capacity")
        return total

    def _checkpoint(self, owner: _JournalOwner) -> None:
        FeatureExecutionJournal._stable(self)
        FeatureExecutionJournal._disk_bytes(owner)
        result = owner.configuration[0].execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        FeatureExecutionJournal._stable(self)
        if result[0] != 0:
            raise Refusal("storage_checkpoint_busy")
        FeatureExecutionJournal._disk_bytes(owner)

    def _bounded_limits(
        self, owner: _JournalOwner, *, metadata: bool = True, validate_rows: bool = False
    ) -> dict[str, Any] | None:
        """Fresh original DB accounting; no authority or history verdict cache."""
        FeatureExecutionJournal._stable(self)
        db, repository_id, _, _, profile, profile_text = owner.configuration
        if profile is None:
            return None
        schema = {
            (r[0], r[1]): None if r[2] is None else " ".join(r[2].casefold().split())
            for r in db.execute("SELECT type,name,sql FROM main.sqlite_master")
        }
        FeatureExecutionJournal._stable(self)
        if schema != _SCHEMA:
            # Triggers/views or rewritten constraints could silently delete
            # history even when row counts and byte accounting appear valid.
            raise Refusal("invalid_storage")
        metadata_bytes = 0
        if metadata:
            actual = dict(db.execute("SELECT key,value FROM main.metadata"))
            FeatureExecutionJournal._stable(self)
            if actual != {
                "format": FORMAT,
                "repository_id": repository_id,
                "profile": profile_text,
            }:
                raise Refusal("binding_denied")
            metadata_bytes = sum(len(k.encode()) + len(v.encode()) for k, v in actual.items())
        page_size = db.execute("PRAGMA page_size").fetchone()[0]
        maximum = (profile.disk_budget_bytes - 512 * 1024) // (4 * page_size)
        for pragma, expected in (
            ("max_page_count", maximum),
            ("cache_spill", 0),
            ("synchronous", 2),
            ("fullfsync", 1),
            ("wal_autocheckpoint", 1),
            ("journal_mode", "wal"),
        ):
            value = db.execute("PRAGMA " + pragma).fetchone()[0]
            FeatureExecutionJournal._stable(self)
            if value != expected:
                raise Refusal("binding_denied")
        row = db.execute("""
            SELECT count(*),coalesce(sum(length(CAST(original AS BLOB))+
                length(CAST(body AS BLOB))),0),
                coalesce(sum(typeof(original)!='text' OR typeof(body)!='text'
                    OR length(CAST(original AS BLOB))>262144
                    OR length(CAST(body AS BLOB))>262144
                    OR typeof(peer)!='text' OR typeof(operation)!='text'
                    OR typeof(request)!='text' OR length(peer) NOT BETWEEN 1 AND 128
                    OR length(operation) NOT BETWEEN 1 AND 128
                    OR length(request) NOT BETWEEN 1 AND 128
                    OR typeof(revision)!='integer' OR revision<1),0)
            FROM main.effects
        """).fetchone()
        FeatureExecutionJournal._stable(self)
        if row[0] > profile.max_records:
            raise Refusal("journal_capacity")
        if row[2]:
            raise Refusal("invalid_storage")
        if validate_rows:
            try:
                for record in db.execute("SELECT * FROM main.effects"):
                    original, body = json.loads(record["original"]), json.loads(record["body"])
                    if (
                        type(original) is not dict
                        or type(body) is not dict
                        or _encoded(original) != record["original"]
                        or _encoded(body) != record["body"]
                        or original["repository_id"] != repository_id
                        or original["verified_peer_ref"] != record["peer"]
                        or original["request"]["operation_id"] != record["operation"]
                        or original["request"]["request_id"] != record["request"]
                    ):
                        raise ValueError
                    counter(record["revision"])
                FeatureExecutionJournal._stable(self)
            except (KeyError, TypeError, ValueError, RecursionError):
                raise Refusal("invalid_storage") from None
        return {
            "records": row[0],
            "serialized_bytes": row[1] + metadata_bytes,
            "effect_serialized_bytes": row[1],
            "metadata_serialized_bytes": metadata_bytes,
            "disk_bytes": FeatureExecutionJournal._disk_bytes(owner),
            "max_records": profile.max_records,
            "disk_budget_bytes": profile.disk_budget_bytes,
            "database_page_limit": maximum,
            "page_size": page_size,
        }

    def storage_status(self) -> dict[str, Any]:
        """Public counts only; caller must explicitly opt into a durable profile."""
        owner = FeatureExecutionJournal._stable(self)
        if owner.configuration[4] is None:
            raise Refusal("bounded_profile_required")
        status = FeatureExecutionJournal._bounded_limits(self, owner)
        if status is None:
            raise Refusal("bounded_profile_required")
        return status

    def begin(self, lease: FeatureLease, body: dict[str, Any]) -> tuple[EffectRecord, bool]:
        if type(lease) is not FeatureLease:
            raise Refusal("Unauthorized")
        lease.check()
        message = lease.message
        peer = message.verification
        if peer.repository_id != self.repository_id:
            raise Refusal("binding_denied")
        original = _encoded(
            {
                "repository_id": peer.repository_id,
                "verified_peer_ref": peer.verified_peer_ref,
                "peer_binding_ref": peer.peer_binding_ref,
                "peer_binding_revision": peer.peer_binding_revision,
                "query_owner_id": message.query_owner_id,
                "descriptor_epoch": peer.descriptor.epoch,
                "request": thaw(message.request.descriptor),
            }
        )
        encoded = _encoded(body)
        if type(body) is dict and body.get("kind") in EVENT_KINDS:
            from .arx_emergency_event_contract import validate

            validate(json.loads(original), body)
        key = peer.verified_peer_ref, message.request.get("operation_id")
        try:
            with FeatureExecutionJournal._transaction(self, guard=lease.check) as db:
                old = db.execute(
                    "SELECT original FROM main.effects WHERE peer=? AND operation=?", key
                ).fetchone()
                FeatureExecutionJournal._stable(self)
                fresh = old is None
                if old is not None and old[0] != original:
                    raise Refusal("operation_conflict")
                if fresh:
                    profile = _OWNERS[self].configuration[4]
                    if profile is not None:
                        count = db.execute("SELECT count(*) FROM main.effects").fetchone()[0]
                        FeatureExecutionJournal._stable(self)
                        if count >= profile.max_records:
                            raise Refusal("journal_capacity")
                    db.execute(
                        "INSERT INTO main.effects VALUES(?,?,?,?,1,?)",
                        (*key, message.request.get("request_id"), original, encoded),
                    )
                lease.check()
        except sqlite3.IntegrityError:
            raise Refusal("operation_conflict") from None
        record = EffectRecord(self, key, original)
        identity = id(record)
        issued = self._issued
        issued[identity] = (
            weakref.ref(record, lambda _dead: issued.pop(identity, None)),
            key,
            original,
            lease,
        )
        FeatureExecutionJournal._event_changed(self, body)
        return record, fresh

    def _owned(self, record: object) -> _IssuedEffect:
        FeatureExecutionJournal._stable(self)
        issued = self._issued.get(id(record))
        if (
            self.closed
            or type(record) is not EffectRecord
            or issued is None
            or issued[0]() is not record
            or record._journal is not self
            or record._key != issued[1]
            or record._original != issued[2]
        ):
            raise Refusal("binding_denied")
        return issued

    def read(self, record: EffectRecord) -> dict[str, Any]:
        FeatureExecutionJournal._owned(self, record)
        row = (
            _OWNERS[self]
            .configuration[0]
            .execute("SELECT * FROM main.effects WHERE peer=? AND operation=?", record._key)
            .fetchone()
        )
        FeatureExecutionJournal._stable(self)
        if row is None or row["original"] != record._original:
            raise Refusal("binding_denied")
        return {
            "revision": row["revision"],
            "original": json.loads(row["original"]),
            "body": json.loads(row["body"]),
        }

    @staticmethod
    def _completion(before: dict[str, Any], after: dict[str, Any]) -> bool:
        """Only finish an already persisted attempt/restore obligation.

        This grants no fresh effect and never authorizes an opening. The native
        coordinator still pins the original runtime/identity for close commands.
        """
        if before.get("kind") in EVENT_KINDS:
            from .arx_emergency_event_contract import completion

            return completion(before, after)
        if before.get("kind") == "media":
            return (
                set(before) == set(after) == {"kind", "direction", "phase"}
                and after["kind"] == "media"
                and before["direction"] in {"video_only", "two_way_audio"}
                and after["direction"] == before["direction"]
                and (
                    (
                        before["phase"] in {"attempted", "streaming"}
                        and after["phase"] in {"closed", "unknown"}
                    )
                    or (before["phase"] == "prepared" and after["phase"] == "denied")
                )
            )
        if before.get("kind") == "pulse":
            return (
                set(before) == set(after) == {"kind", "phase"}
                and after["kind"] == "pulse"
                and before["phase"] == "attempted"
                and after["phase"] in {"acknowledged", "unknown"}
            )
        if before.get("kind") == "emergency":
            if (
                set(before) != {"kind", "mode", "targets"}
                or set(after) != set(before)
                or after["kind"] != "emergency"
                or after["mode"] != before["mode"]
                or set(after["targets"]) != set(before["targets"])
            ):
                return False
            changed = False
            for key, old in before["targets"].items():
                new = after["targets"][key]
                if old == new:
                    continue
                changed = True
                if (
                    set(old) != {"target", "phase"}
                    or set(new) != set(old)
                    or old["target"] != new["target"]
                    or not (
                        (
                            old["phase"] == "attempted"
                            and new["phase"] in {"acknowledged", "unknown"}
                        )
                        or (old["phase"] == "prepared" and new["phase"] == "denied")
                    )
                ):
                    return False
            return changed
        if (
            before.get("kind") != "hold"
            or set(before) != {"kind", "resources"}
            or set(after) != {"kind", "resources"}
        ):
            return False
        if after.get("kind") != "hold" or set(before["resources"]) != set(after["resources"]):
            return False
        changed = False
        for key, old in before["resources"].items():
            new = after["resources"][key]
            if old == new:
                continue
            changed = True
            if (
                set(old) != set(new)
                or old["target"] != new["target"]
                or old["execution"].get("owned") is not True
            ):
                return False
            execution = new["execution"]
            if (
                set(execution) != {"owned", "attempted", "status"}
                or execution["attempted"] != old["execution"]["attempted"]
                or type(execution["owned"]) is not bool
                or execution["status"] not in {"restoring", "unknown", "idle"}
                or (execution["status"] == "idle") != (execution["owned"] is False)
            ):
                return False
        return changed

    def save(
        self, record: EffectRecord, revision: int, body: dict[str, Any], *, completion: bool = False
    ) -> None:
        issued = FeatureExecutionJournal._owned(self, record)
        encoded = _encoded(body)
        with FeatureExecutionJournal._transaction(
            self,
            guard=None if completion else issued[3].check,
        ) as db:
            old = FeatureExecutionJournal.read(self, record)
            if old["body"].get("kind") in EVENT_KINDS or body.get("kind") in EVENT_KINDS:
                from .arx_emergency_event_contract import transition, validate

                validate(old["original"], body)
                if not transition(old["body"], body, completion_only=completion):
                    raise Refusal("binding_denied")
            if type(revision) is not int or revision != old["revision"]:
                raise Refusal("revision_conflict")
            if completion:
                if not FeatureExecutionJournal._completion_for(self, old["body"], body):
                    raise Refusal("binding_denied")
            else:
                issued[3].check()
            db.execute(
                "UPDATE main.effects SET revision=revision+1,body=? WHERE peer=? AND operation=?",
                (encoded, *record._key),
            )
            if not completion:
                issued[3].check()
        FeatureExecutionJournal._event_changed(self, body)

    def _event_changed(self, body: Any) -> None:
        if type(body) is dict and body.get("kind") in EVENT_KINDS | {"emergency"}:
            from .arx_emergency_event_ledger import journal_changed

            try:
                journal_changed(self)
            except BaseException:
                _OWNERS[self].poisoned = True
                raise

    def emergency_event_rows(self) -> list[dict[str, Any]]:
        """Internal original history read; never a source or execution grant.

        Retain every canonical full original and exact target. Legacy explicit
        release ACKs are included for matching native claim reconciliation.
        """
        from .arx_emergency_event_contract import validate

        FeatureExecutionJournal._stable(self)
        rows: list[dict[str, Any]] = []
        try:
            db = _OWNERS[self].configuration[0]
            for value in db.execute("SELECT * FROM main.effects ORDER BY rowid"):
                body = json.loads(value["body"])
                if body.get("kind") not in EVENT_KINDS | {"emergency"}:
                    continue
                original = json.loads(value["original"])
                descriptor = original["request"]
                if (
                    _encoded(body) != value["body"]
                    or _encoded(original) != value["original"]
                    or original["repository_id"] != self.repository_id
                    or original["verified_peer_ref"] != value["peer"]
                    or descriptor["operation_id"] != value["operation"]
                    or descriptor["request_id"] != value["request"]
                ):
                    raise ValueError
                if body["kind"] in EVENT_KINDS:
                    validate(original, body)
                rows.append(
                    {
                        "key": (value["peer"], value["operation"]),
                        "revision": value["revision"],
                        "original": original,
                        "body": body,
                    }
                )
            FeatureExecutionJournal._stable(self)
            return rows
        except (AttributeError, KeyError, TypeError, ValueError, RecursionError):
            raise Refusal("invalid_storage") from None

    def close(self) -> None:
        owner = _OWNERS.get(self)
        if owner is None:
            return
        if owner.close_error is not None:
            raise owner.close_error
        if owner.closed:
            return
        try:
            owner.configuration[0].close()
        except BaseException as error:
            # Refusal is not a joined connection. Retain the original owner and
            # first error, block source use and never retry this close silently.
            owner.poisoned = True
            owner.close_error = error
            raise
        owner.closed = self.closed = True

    @staticmethod
    def _completion_for(
        journal: FeatureExecutionJournal, before: dict[str, Any], after: dict[str, Any]
    ) -> bool:
        """Original known journal grammars; an instance label cannot approve one."""
        if type(journal) is FeatureExecutionJournal:
            return FeatureExecutionJournal._completion(before, after)
        from .arx_validation_execution import ValidationExecutionJournal

        if type(journal) is ValidationExecutionJournal:
            return ValidationExecutionJournal._completion(before, after)
        return False

    def pending_secure_claims(self) -> list[dict[str, Any]]:
        """Owner startup read: reconstruct restrictions, never dispatch commands.

        A durable acknowledged release retires exactly its original claim. An
        unknown release retains it. Corruption refuses; it never means no claims.
        """
        FeatureExecutionJournal._stable(self)
        active: dict[tuple[Any, ...], dict[str, Any]] = {}
        event_history: dict[_EffectKey, tuple[dict[str, Any], dict[str, Any]]] = {}
        try:
            db = _OWNERS[self].configuration[0]
            for row in db.execute("SELECT original,body FROM main.effects ORDER BY rowid"):
                if any(
                    type(row[k]) is not str or len(row[k]) > 262144 for k in ("original", "body")
                ):
                    raise ValueError
                original, body = json.loads(row["original"]), json.loads(row["body"])
                if (
                    type(original) is not dict
                    or type(body) is not dict
                    or _encoded(original) != row["original"]
                    or _encoded(body) != row["body"]
                    or original["repository_id"] != self.repository_id
                ):
                    raise ValueError
                request = original["request"]
                feature = request["feature"]
                allowed = {
                    "door_automations": {"pulse"},
                    "door_windows": {"hold"},
                    "emergency_buttons": {"emergency", "hold"} | EVENT_KINDS,
                    "live_media": {"media"},
                    "live_validation": {"native_validation.v1"},
                }
                if body.get("kind") not in allowed.get(feature, set()):
                    raise ValueError
                if body["kind"] in EVENT_KINDS:
                    from .arx_emergency_event_contract import (
                        CLAIM_PHASES,
                        claim,
                        scope,
                        signature,
                        validate,
                    )

                    validate(original, body)
                    operation_key = (original["verified_peer_ref"], request["operation_id"])
                    for item in body["targets"].values():
                        target_signature = signature(item["target"])
                        own = claim(item["claim"])
                        if item["prior_operation"] is not None:
                            prior_key = (original["verified_peer_ref"], item["prior_operation"])
                            prior = event_history.get(prior_key)
                            if prior is None or prior_key == operation_key:
                                raise ValueError
                            previous_original, previous_body = prior
                            matches = [
                                candidate
                                for candidate in previous_body["targets"].values()
                                if scope(
                                    previous_original,
                                    previous_body["event_ref"],
                                    candidate["target"],
                                )
                                == scope(original, body["event_ref"], item["target"])
                                and signature(candidate["target"]) == target_signature
                            ]
                            if len(matches) != 1:
                                raise ValueError
                            if (
                                body["command"] == "release"
                                and not item["duplicate"]
                                and (
                                    previous_body["command"] != "hold_open"
                                    or matches[0]["duplicate"]
                                    or claim(item["release_claim"]) != claim(matches[0]["claim"])
                                    or item["phase"] == "acknowledged"
                                    and matches[0]["phase"] not in CLAIM_PHASES
                                )
                            ):
                                raise ValueError
                        if (
                            body["command"] == "hold_open"
                            and not item["duplicate"]
                            and body.get("retry_of") is not None
                        ):
                            if (
                                item["prior_operation"] != body["retry_of"]
                                or previous_body["command"] != "hold_open"
                                or matches[0]["duplicate"]
                                or matches[0]["phase"] not in {"unknown", "attempted"}
                                or claim(matches[0]["claim"]) != own
                            ):
                                raise ValueError
                        if body["command"] == "hold_open" and item["phase"] in CLAIM_PHASES:
                            previous = active.get(target_signature)
                            if previous is not None and previous["claim"] != own:
                                raise ValueError
                            active[target_signature] = {
                                "target_signature": target_signature,
                                "claim": own,
                            }
                        elif body["command"] == "release" and item["phase"] == "acknowledged":
                            released = claim(item["release_claim"])
                            if (
                                released is not None
                                and active.get(target_signature, {}).get("claim") == released
                            ):
                                del active[target_signature]
                    event_history[operation_key] = (original, body)
                    continue
                if body["kind"] == "hold":
                    if (
                        set(body) != {"kind", "resources"}
                        or type(body["resources"]) is not dict
                        or not 1 <= len(body["resources"]) <= 200
                    ):
                        raise ValueError
                    for resource in body["resources"].values():
                        if type(resource) is not dict or set(resource) != {"target", "execution"}:
                            raise ValueError
                        target, execution = resource["target"], resource["execution"]
                        if (
                            type(target) is not dict
                            or set(target)
                            != {
                                "station_id",
                                "api_relay",
                                "physical_relay",
                                "mapping_revision",
                                "identity",
                            }
                            or type(execution) is not dict
                            or set(execution) != {"owned", "attempted", "status"}
                            or type(execution["owned"]) is not bool
                            or execution["status"]
                            not in {
                                "idle",
                                "opening",
                                "held_acknowledged",
                                "restoring",
                                "unknown",
                            }
                        ):
                            raise ValueError
                        reference(target["station_id"])
                        counter(target["mapping_revision"])
                        if execution["attempted"] is not None:
                            reference(execution["attempted"])
                        if (
                            any(
                                type(target[k]) is not int or target[k] not in {1, 2}
                                for k in ("api_relay", "physical_relay")
                            )
                            or type(target["identity"]) is not str
                            or not 1 <= len(target["identity"]) <= 256
                        ):
                            raise ValueError
                    continue
                if body["kind"] != "emergency":
                    continue
                if (
                    set(body) != {"kind", "mode", "targets"}
                    or body["mode"] not in {"lock_all", "release_all"}
                    or type(body["targets"]) is not dict
                    or not 1 <= len(body["targets"]) <= 200
                ):
                    raise ValueError
                expected = (
                    original["verified_peer_ref"],
                    request["operation_id"],
                    request["operation_binding_ref"],
                    request["request_id"],
                )
                for record in body["targets"].values():
                    target, phase = record["target"], record["phase"]
                    legacy_signature = (
                        reference(target["station_id"]),
                        target["api_relay"],
                        target["physical_relay"],
                        counter(target["mapping_revision"]),
                        target["identity"],
                    )
                    if (
                        any(type(v) is not int or v not in {1, 2} for v in legacy_signature[1:3])
                        or type(legacy_signature[4]) is not str
                        or not 1 <= len(legacy_signature[4]) <= 256
                        or phase
                        not in {"prepared", "denied", "attempted", "acknowledged", "unknown"}
                    ):
                        raise ValueError
                    if body["mode"] == "lock_all" and phase in {
                        "attempted",
                        "acknowledged",
                        "unknown",
                    }:
                        legacy_claim = tuple(target["claim"])
                        if legacy_claim != expected:
                            raise ValueError
                        active[legacy_signature] = {
                            "target_signature": legacy_signature,
                            "claim": legacy_claim,
                        }
                    elif body["mode"] == "release_all" and phase == "acknowledged":
                        legacy_claim = tuple(target["release_claim"])
                        if active.get(legacy_signature, {}).get("claim") == legacy_claim:
                            del active[legacy_signature]
            FeatureExecutionJournal._stable(self)
            return list(active.values())
        except (KeyError, TypeError, ValueError, RecursionError):
            raise Refusal("invalid_storage") from None
