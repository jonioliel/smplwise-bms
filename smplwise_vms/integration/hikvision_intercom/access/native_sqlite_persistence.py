"""Opt-in native image persistence as bounded SQLite records in one transaction.

AccessRepository remains the engine and invokes this actual save port. People,
exact peer receipts/create fences, registry and all other native metadata commit
together. The backend neither admits a request nor creates a second receipt.
No production loader, migration, budget or active format is changed implicitly.
"""

from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import stat
import sys
import time
import weakref
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, NoReturn

from ..trusted_actions.peer_boundary import counter
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal, reference
from . import native_peer_storage
from .atomic_person_store import PERSON_MAX_BYTES, RECEIPT_MAX_BYTES, canonical
from .commit_tasks import finish_owned_commit
from .models import AccessError, ManagedUser
from .native_image_copy import copy_image
from .sqlite_connection_scope import require_connection_scope
from .storage_envelope import ACTIVE_IMAGE_MAX_BYTES, ENVELOPE_FORMAT, measure_envelope

FORMAT = "wiskey-native-sqlite.v1"
NODE_MAX_BYTES = 65_536
PATH_MAX_BYTES = 4096
MAX_DEPTH = 16
LITERAL_CACHE_MAX_BYTES = 256 * 1024**2
LITERAL_CACHE_MAX_ENTRIES = 131_072
_OWNERS: weakref.WeakKeyDictionary[NativeSqlitePersistence, _PersistenceOwner] = (
    weakref.WeakKeyDictionary()
)

type _FileIdentity = tuple[int, int, int, int]
type _NativeRoots = tuple[
    sqlite3.Connection, Path, str, NativeSqliteProfile, str, Callable[[str], None] | None
]
# SQLite values stay opaque until the original record validators inspect them.
type _RecordForest = dict[str, tuple[Any, ...]]
_MAIN_SCHEMA = {
    ("table", "metadata"): "create table metadata(key text primary key,value text not null)",
    ("table", "nodes"): " ".join('''CREATE TABLE nodes(
                        path TEXT PRIMARY KEY,parent TEXT,slot TEXT,ordinal INTEGER NOT NULL,
                        kind TEXT NOT NULL CHECK(kind IN ('dict','list','value')),payload BLOB,
                        CHECK((kind='value')=(payload IS NOT NULL)),
                        CHECK(payload IS NULL OR length(payload)<=65536),
                        FOREIGN KEY(parent) REFERENCES nodes(path) DEFERRABLE INITIALLY DEFERRED)
                        '''.casefold().split()),
    ("index", "sqlite_autoindex_metadata_1"): None,
    ("index", "sqlite_autoindex_nodes_1"): None,
}


@dataclass(repr=False)
class _PersistenceOwner:
    roots: _NativeRoots
    lock: asyncio.Lock
    generation: list[int | None]
    files: dict[str, _FileIdentity | None]
    parent: _FileIdentity
    ports: tuple[Callable[..., Any], ...]
    life: list[bool]
    closing: list[asyncio.Task[None] | None]
    forest: list[_RecordForest | None]
    literals: list[_LiteralCache | None]
    pending_literals: list[_LiteralCache | None]
    geometry: tuple[tuple[str, Any], ...] = ()
    schema_ready: bool = False


def _clear_owned_data(owner: _PersistenceOwner) -> None:
    owner.forest[0] = owner.literals[0] = owner.pending_literals[0] = None


def _file_identity(path: Path, *, directory: bool = False) -> _FileIdentity:
    try:
        info = path.lstat()
    except OSError:
        raise Refusal("storage_path_rebound") from None
    expected = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if (
        not expected
        or info.st_uid != os.getuid()
        or info.st_mode & 0o077
        or not directory
        and info.st_nlink != 1
    ):
        raise Refusal("storage_path_rebound")
    return info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)


def _check_owned_files(owner: _PersistenceOwner, *, allow_create: bool = False) -> None:
    path = owner.roots[1]
    if _file_identity(path.parent, directory=True) != owner.parent:
        raise Refusal("storage_path_rebound")
    rollback = Path(str(path) + "-journal")
    if rollback.exists() or rollback.is_symlink():
        raise Refusal("invalid_storage")
    for label, target in (
        ("db", path),
        ("wal", Path(str(path) + "-wal")),
        ("shm", Path(str(path) + "-shm")),
    ):
        previous = owner.files[label]
        try:
            target.lstat()
        except FileNotFoundError:
            if previous is not None:
                raise Refusal("storage_path_rebound") from None
            continue
        current = _file_identity(target)
        if previous is None:
            if not allow_create:
                raise Refusal("storage_path_rebound")
            owner.files[label] = current
        elif previous != current:
            raise Refusal("storage_path_rebound")


def _owned_disk_bytes(owner: _PersistenceOwner) -> int:
    _check_owned_files(owner)
    path = owner.roots[1]
    total = 0
    for target in (path, Path(str(path) + "-wal"), Path(str(path) + "-shm")):
        try:
            total += target.lstat().st_size
        except FileNotFoundError:
            continue
    _check_owned_files(owner)
    return total


def _close_owned(owner: _PersistenceOwner) -> None:
    """Original native DB cleanup only, independent of mutable instance labels."""
    db = owner.roots[0]
    try:
        _check_owned_files(owner)
        result = db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        if result[0] != 0:
            raise Refusal("storage_checkpoint_busy")
        _check_owned_files(owner, allow_create=True)
        if _owned_disk_bytes(owner) > owner.roots[3].disk_budget_bytes:
            raise Refusal("native_storage_capacity")
    finally:
        try:
            db.close()
        finally:
            owner.life[0] = True
            _clear_owned_data(owner)


async def _finish_close(owner: _PersistenceOwner) -> None:
    async with owner.lock:
        task = asyncio.create_task(asyncio.to_thread(_close_owned, owner))
        await finish_owned_commit(task)


def _rollback_owned(owner: _PersistenceOwner) -> None:
    """A failed callback can change labels, never the original DB cleanup."""
    db = owner.roots[0]
    try:
        if db.in_transaction:
            db.execute("ROLLBACK")
    finally:
        if db.in_transaction:
            try:
                db.close()
            finally:
                owner.life[0] = owner.life[1] = True
                _clear_owned_data(owner)


def _decode(encoded: object, *, limit: int = NODE_MAX_BYTES) -> Any:
    """Private canonical records include scalars/arrays; W1 strict_json is DTO-only."""
    try:
        raw = encoded.encode("utf-8") if type(encoded) is str else encoded
        if type(raw) is not bytes or len(raw) > limit:
            raise ValueError

        def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
            result: dict[str, Any] = {}
            for key, value in items:
                if key in result:
                    raise ValueError
                result[key] = value
            return result

        def nonfinite(_: str) -> NoReturn:
            raise ValueError

        return json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=nonfinite)
    except (TypeError, ValueError, UnicodeError, RecursionError):
        raise AccessError("invalid_storage") from None


def _literal_weight(value: Any) -> int:
    """Conservative private heap estimate of exact built-in decoded JSON only."""
    kind = type(value)
    size = sys.getsizeof(value) + 32
    if kind is dict:
        return size + sum(_literal_weight(k) + _literal_weight(v) for k, v in value.items())
    if kind is list:
        return size + sum(_literal_weight(child) for child in value)
    if value is None or kind is str or kind is int or kind is bool:
        return size
    raise AccessError("invalid_storage")


class _LiteralCache:
    """Isolated canonical-byte preparation; never a caller graph or authority.

    Published and pending maps each have explicit byte/entry caps. Uncached
    unchanged rows are not re-admitted every save; cache capacity never evicts
    a durable record or refuses a native mutation.
    """

    entries: dict[str, tuple[bytes, Any, int]]

    def __init__(self, max_bytes: int, max_entries: int) -> None:
        if (
            type(max_bytes) is not int or not 1 <= max_bytes <= LITERAL_CACHE_MAX_BYTES
            or type(max_entries) is not int or not 1 <= max_entries <= LITERAL_CACHE_MAX_ENTRIES
        ):
            raise ValueError("bounded private literal cache required")
        self.max_bytes, self.max_entries = max_bytes, max_entries
        self.entries, self.bytes_used = {}, 0

    def candidate(self, records: _RecordForest, previous: _RecordForest | None) -> _LiteralCache:
        result = _LiteralCache(self.max_bytes, self.max_entries)
        for path, entry in self.entries.items():
            row = records.get(path)
            if row is not None and row[3] == "value" and row[4] == entry[0]:
                result.entries[path] = entry
                result.bytes_used += entry[2]
        additions = (
            (path, row[4])
            for path, row in records.items()
            if row[3] == "value" and path not in result.entries
            and (
                previous is None or path not in previous
                or previous[path][3:] != row[3:]
            )
        )
        for path, payload in sorted(additions, key=lambda item: (len(item[1]), item[0])):
            if len(result.entries) >= result.max_entries:
                break
            remaining = result.max_bytes - result.bytes_used
            if remaining < 320:
                break
            if len(payload) + 256 > remaining:
                continue
            literal = _decode(payload)
            weight = _literal_weight(literal) + 256 + len(path.encode())
            if weight > remaining:
                continue
            result.entries[path] = payload, literal, weight
            result.bytes_used += weight
        return result


def _prepare_literals(owner: _PersistenceOwner, records: _RecordForest) -> _LiteralCache:
    current = owner.literals[0]
    if current is None:
        profile = owner.roots[3]
        current = _LiteralCache(
            min(LITERAL_CACHE_MAX_BYTES, profile.logical_budget_bytes * 4),
            min(LITERAL_CACHE_MAX_ENTRIES, profile.node_limit),
        )
        previous = None
    else:
        previous = owner.forest[0]
    return current.candidate(records, previous)


@dataclass(frozen=True, repr=False)
class NativeSqliteProfile:
    """Explicit development/owner admission; no operational default is selected."""

    profile_ref: str
    revision: int
    receipt_limit: int
    node_limit: int
    logical_budget_bytes: int
    disk_budget_bytes: int
    layout_revision: int = 1
    image_limit_bytes: int | None = None
    image_format: str | None = None

    def __post_init__(self) -> None:
        reference(self.profile_ref)
        counter(self.revision)
        if type(self.layout_revision) is not int or self.layout_revision not in (1, 2):
            raise ValueError("explicit supported native physical layout required")
        for value, low, high in (
            (self.receipt_limit, 1, native_peer_storage.MAX_RECEIPT_LIMIT),
            (self.node_limit, 32, 2_000_000),
            (self.logical_budget_bytes, 65_536, 4 * 1024**3),
            (self.disk_budget_bytes, 4 * 1024**2, 16 * 1024**3),
        ):
            if type(value) is not int or not low <= value <= high:
                raise ValueError("explicit bounded native storage profile required")
        if self.logical_budget_bytes > self.disk_budget_bytes // 2:
            raise ValueError("candidate logical budget must reserve physical SQLite overhead")
        if self.image_limit_bytes is not None:
            if (
                type(self.image_limit_bytes) is not int
                or not 65_536 <= self.image_limit_bytes <= ACTIVE_IMAGE_MAX_BYTES
                or type(self.image_format) is not str
                or self.image_format != ENVELOPE_FORMAT
                or self.disk_budget_bytes > self.image_limit_bytes
            ):
                raise ValueError("ECC whole image and physical storage must stay within32MiB")
        elif self.image_format is not None:
            raise ValueError("explicit whole image budget required")

    def metadata(self) -> dict[str, Any]:
        result = {
            key: getattr(self, key)
            for key in (
                "profile_ref",
                "revision",
                "receipt_limit",
                "node_limit",
                "logical_budget_bytes",
                "disk_budget_bytes",
            )
        }
        # Preserve the original layout1 metadata exactly. A new explicit
        # layout2 profile can only open/create its matching private candidate.
        if self.layout_revision != 1:
            result["layout_revision"] = self.layout_revision
        if self.image_limit_bytes is not None:
            result["image_limit_bytes"] = self.image_limit_bytes
            result["image_format"] = self.image_format
        return result


def _encoded_path(path: Sequence[str | int]) -> str:
    encoded = json.dumps(path, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode()) > PATH_MAX_BYTES:
        raise Refusal("record_too_large")
    return encoded


def _same_json(value: Any, saved: Any) -> bool:
    """Exact built-in JSON equality against an already validated literal.

    Python's ordinary equality conflates bool/int and permits user objects to
    implement equality. Neither can certify unchanged canonical private data.
    This function returns only structural equality, never source authority.
    """
    kind = type(value)
    if kind is not type(saved):
        return False
    if kind is dict:
        if len(value) != len(saved):
            return False
        for key, child in value.items():
            if type(key) is not str or key not in saved:
                return False
            previous = saved[key]
            child_kind = type(child)
            if child is None or child_kind is str or child_kind is int or child_kind is bool:
                if type(previous) is not child_kind or child != previous:
                    return False
            elif not _same_json(child, previous):
                return False
        return True
    if kind is list:
        if len(value) != len(saved):
            return False
        for child, previous in zip(value, saved, strict=True):
            child_kind = type(child)
            if child is None or child_kind is str or child_kind is int or child_kind is bool:
                if type(previous) is not child_kind or child != previous:
                    return False
            elif not _same_json(child, previous):
                return False
        return True
    return (value is None or kind is str or kind is int or kind is bool) and value == saved


def _nodes(
    image: dict[str, Any], profile: NativeSqliteProfile, *,
    validated_forest: _RecordForest | None = None,
    validated_literals: _LiteralCache | None = None,
) -> tuple[_RecordForest, int]:
    if type(image) is not dict or image.get("schema") != 17:
        raise AccessError("candidate_migration_required")
    if type(image.get("users")) is not dict:
        raise AccessError("invalid_storage")
    table: Any = image.get("peer_source")
    native_peer_storage.validate(table)
    if profile.image_limit_bytes is not None:
        native_peer_storage.validate_ecc_revisions(table)
    if table["receipt_limit"] != profile.receipt_limit:
        raise AccessError("candidate_admission_profile_required")
    result: _RecordForest = {}
    logical_bytes = 0

    def visit(
        value: Any, path: tuple[str | int, ...] = (), parent: str | None = None,
        slot: str | None = None, ordinal: int = 0,
    ) -> None:
        nonlocal logical_bytes
        if len(path) > MAX_DEPTH or len(result) >= profile.node_limit:
            raise Refusal("native_storage_capacity")
        name = _encoded_path(path)
        receipt = len(path) == 4 and path[:2] == ("peer_source", "receipts")
        person = len(path) == 2 and path[0] == "users"
        audit_record = (
            profile.layout_revision == 2
            and len(path) == 3
            and path[:2] == ("admin_audit", "records")
        )
        forced = (
            not path
            or path == ("users",)
            or path == ("peer_source",)
            or path
            in {("peer_source", "receipts"), ("peer_source", "versions"), ("peer_source", "heads")}
            or len(path) == 3
            and path[:2] in {("peer_source", "receipts"), ("peer_source", "versions")}
            or profile.layout_revision == 2
            and path in {("admin_audit",), ("admin_audit", "records")}
        )
        payload = None
        if not forced:
            previous = validated_forest.get(name) if validated_forest is not None else None
            cached = (
                validated_literals.entries.get(name) if validated_literals is not None else None
            )
            if (
                previous is not None
                and previous[3] == "value"
                and _same_json(
                    value,
                    cached[1] if cached is not None and cached[0] == previous[4]
                    else _decode(previous[4]),
                )
            ):
                payload = previous[4]
            if person and payload is None:
                user = ManagedUser.from_private(value)
                if user.id != path[1] or user.private() != value:
                    raise AccessError("invalid_storage")
            if person and profile.image_limit_bytes is not None:
                revision = value.get("revision")
                if (
                    type(revision) is not int
                    or not 1 <= revision <= native_peer_storage.JSON_SAFE_REVISION
                ):
                    raise AccessError("unsafe_peer_revision")
            try:
                if payload is None:
                    payload = canonical(value, RECEIPT_MAX_BYTES if receipt else NODE_MAX_BYTES)
            except Refusal as error:
                if (
                    error.code != "record_too_large"
                    or type(value) not in (dict, list)
                    or receipt
                    or person
                    or audit_record
                ):
                    raise
        if payload is not None:
            kind = "value"
        elif type(value) in (dict, list):
            kind = "dict" if type(value) is dict else "list"
        else:
            raise Refusal("invalid_fields")
        result[name] = (parent, slot, ordinal, kind, payload)
        logical_bytes += len(name.encode()) + (len(payload) if payload is not None else 0) + 128
        if logical_bytes > profile.logical_budget_bytes:
            raise Refusal("native_storage_capacity")
        if payload is None:
            stable_audit = profile.layout_revision == 2 and path == ("admin_audit", "records")
            children: Iterable[tuple[Any, Any]]
            if stable_audit:
                if type(value) is not list:
                    raise AccessError("invalid_storage")
                children = ((row.get("sequence"), row) for row in value if type(row) is dict)
                if any(type(row) is not dict for row in value):
                    raise AccessError("invalid_storage")
            else:
                children = value.items() if type(value) is dict else enumerate(value)
            previous_sequence = 0
            for index, (key, child) in enumerate(children):
                if (
                    type(key) not in (int, str)
                    or type(key) is str
                    and (len(key) > 128 or len(key.encode()) > 512)
                ):
                    raise Refusal("invalid_fields")
                if stable_audit:
                    counter(key)
                    if key <= previous_sequence:
                        raise AccessError("invalid_storage")
                    previous_sequence = key
                visit(
                    child, (*path, key), name, _encoded_path((key,)),
                    key if stable_audit else index,
                )

    visit(image)
    if profile.image_limit_bytes is not None:
        measure_envelope(image, limit=profile.image_limit_bytes)
    return result, logical_bytes


def accounting(image: dict[str, Any], profile: NativeSqliteProfile) -> dict[str, Any]:
    nodes, size = _nodes(image, profile)
    result = {
        "nodes": len(nodes),
        "logical_bytes": size,
        "people": len(image["users"]),
        "receipts": sum(len(rows) for rows in image["peer_source"]["receipts"].values()),
        "person_max_bytes": PERSON_MAX_BYTES,
        "receipt_max_bytes": RECEIPT_MAX_BYTES,
        "profile": profile.metadata(),
    }
    if profile.image_limit_bytes is not None:
        result.update(
            image_envelope_bytes=measure_envelope(image, limit=profile.image_limit_bytes)[0],
            image_limit_bytes=profile.image_limit_bytes,
            all_metadata_assets_and_history_counted=True,
            binding_versions=sum(len(rows) for rows in image["peer_source"]["versions"].values()),
            inline_photo_count=sum(
                user.get("photo") is not None for user in image["users"].values()
            ),
            inline_photo_utf8_bytes=sum(
                len(user["photo"].encode("utf-8"))
                for user in image["users"].values() if user.get("photo") is not None
            ),
        )
    return result


def _reconstruct(nodes: _RecordForest, profile: NativeSqliteProfile) -> dict[str, Any] | None:
    if not nodes:
        return None
    if len(nodes) > profile.node_limit or "[]" not in nodes:
        raise AccessError("invalid_storage")
    values: dict[str, Any]
    paths: dict[str, list[str | int]]
    values, paths = {}, {}
    for name, row in nodes.items():
        path = _decode(name, limit=PATH_MAX_BYTES)
        if (
            type(path) is not list
            or len(path) > MAX_DEPTH
            or _encoded_path(path) != name
            or any(type(p) not in (int, str) for p in path)
        ):
            raise AccessError("invalid_storage")
        paths[name] = path
        parent, slot, ordinal, kind, payload = row
        if type(ordinal) is not int or ordinal < 0:
            raise AccessError("invalid_storage")
        if kind == "value":
            if type(payload) is not bytes:
                raise AccessError("invalid_storage")
            value = _decode(payload)
            if canonical(value, NODE_MAX_BYTES) != payload:
                raise AccessError("invalid_storage")
        elif kind in {"dict", "list"} and payload is None:
            value = {} if kind == "dict" else []
        else:
            raise AccessError("invalid_storage")
        values[name] = value
    used_slots: dict[str, set[str | None]]
    used_ordinals: dict[str, set[int]]
    used_slots, used_ordinals = {}, {}
    for name in sorted(
        nodes, key=lambda key: (len(paths[key]), nodes[key][0] or "", nodes[key][2])
    ):
        path = paths[name]
        parent, slot, ordinal, kind, payload = nodes[name]
        if not path:
            if parent is not None or slot is not None or ordinal != 0 or kind != "dict":
                raise AccessError("invalid_storage")
            continue
        expected = _encoded_path(path[:-1])
        if (
            parent != expected
            or parent not in nodes
            or slot != _encoded_path((path[-1],))
            or nodes[parent][3] not in {"dict", "list"}
        ):
            raise AccessError("invalid_storage")
        if slot in used_slots.setdefault(parent, set()) or ordinal in used_ordinals.setdefault(
            parent, set()
        ):
            raise AccessError("invalid_storage")
        used_slots[parent].add(slot)
        used_ordinals[parent].add(ordinal)
        container, key = values[parent], path[-1]
        stable_audit = (
            profile.layout_revision == 2 and paths[parent] == ["admin_audit", "records"]
        )
        if type(container) is dict and type(key) is str:
            container[key] = values[name]
        elif (
            type(container) is list
            and type(key) is int
            and ordinal == key
            and (
                not stable_audit
                and key == len(container)
                or stable_audit
                and key > 0
                and kind == "value"
                and type(values[name]) is dict
                and values[name].get("sequence") == key
            )
        ):
            container.append(values[name])
        else:
            raise AccessError("invalid_storage")
    for parent, ordinals in used_ordinals.items():
        if profile.layout_revision == 2 and paths[parent] == ["admin_audit", "records"]:
            continue
        if ordinals != set(range(len(ordinals))):
            raise AccessError("invalid_storage")
    image: dict[str, Any] = values["[]"]
    # Rebuilding the canonical forest checks all per-record and whole-profile
    # limits as well as its exact shape, rather than trusting SQLite labels.
    rebuilt, _ = _nodes(image, profile)
    if rebuilt != nodes:
        raise AccessError("invalid_storage")
    return image


class NativeSqlitePersistence:
    last_save: dict[str, Any] | None

    def __init__(
        self,
        path: str | Path,
        *,
        repository_id: str,
        profile: NativeSqliteProfile,
        fault: Callable[[str], None] | None = None,
        expect_new: bool = False,
        initial_generation: int = 0,
    ) -> None:
        if type(profile) is not NativeSqliteProfile or fault is not None and not callable(fault):
            raise ValueError("explicit native persistence profile required")
        if type(expect_new) is not bool:
            raise ValueError("explicit exclusive candidate selection required")
        counter(initial_generation, zero=True)
        if initial_generation and not expect_new:
            raise ValueError("generation inheritance requires exclusive NEW storage")
        path = Path(path).absolute()
        reference(repository_id)
        if path.is_symlink() or any(
            Path(str(path) + suffix).is_symlink() for suffix in ("-wal", "-shm")
        ):
            raise Refusal("binding_denied")
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        parent_info = path.parent.stat()
        if parent_info.st_uid != os.getuid() or parent_info.st_mode & 0o077:
            raise Refusal("private_storage_directory_required")
        existed = path.exists()
        fd = os.open(
            path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | (os.O_EXCL if expect_new else 0), 0o600
        )
        try:
            info = os.fstat(fd)
            if info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
                raise Refusal("binding_denied")
            database_identity = (info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode))
        finally:
            os.close(fd)
        self.path, self.repository_id, self.profile, self.fault = (
            path,
            repository_id,
            profile,
            fault,
        )
        self.db = sqlite3.connect(
            str(path), isolation_level=None, timeout=5, check_same_thread=False
        )
        db = self.db
        self._lock, self.closed = asyncio.Lock(), False
        self._profile_text = canonical(
            NativeSqliteProfile.metadata(profile), NODE_MAX_BYTES
        ).decode()
        self._roots = self.db, path, repository_id, profile, self._profile_text, fault
        owner = _PersistenceOwner(
            self._roots,
            self._lock,
            [None],
            {"db": database_identity, "wal": None, "shm": None},
            _file_identity(path.parent, directory=True),
            tuple(
                getattr(self, name).__func__
                for name in (
                    "_save_sync",
                    "_load_sync",
                    "_snapshot_sync",
                    "_run",
                    "_stable",
                    "_checkpoint",
                    "disk_bytes",
                    "_read_nodes",
                    "_check_metadata",
                )
            ),
            [False, False, False],
            [None],
            [None],
            [None],
            [None],
        )
        _OWNERS[self] = owner
        try:
            _check_owned_files(owner, allow_create=True)
            tables = {
                row[0]
                for row in db.execute("SELECT name FROM main.sqlite_master WHERE type='table'")
            }
            if existed and tables != {"metadata", "nodes"}:
                raise Refusal("unmanaged_storage_refused")
            owner.schema_ready = bool(tables)
            if tables:
                NativeSqlitePersistence._stable(self)
                if db.execute("PRAGMA journal_mode").fetchone()[0] != "wal":
                    raise Refusal("invalid_storage")
            if db.execute("PRAGMA journal_mode=WAL").fetchone()[0] != "wal":
                raise Refusal("storage_write_failed")
            db.execute("PRAGMA synchronous=FULL")
            db.execute("PRAGMA fullfsync=ON")
            db.execute("PRAGMA foreign_keys=ON")
            # One bounded transaction keeps dirty pages until COMMIT. With a
            # pre-write truncated WAL and the quarter-disk max_page_count this
            # reserves room for main DB + one transaction WAL + index overhead.
            db.execute("PRAGMA cache_spill=OFF")
            db.execute("PRAGMA wal_autocheckpoint=1")
            page_size = db.execute("PRAGMA page_size").fetchone()[0]
            max_pages = (profile.disk_budget_bytes - 512 * 1024) // (4 * page_size)
            if db.execute(f"PRAGMA max_page_count={max_pages}").fetchone()[0] > max_pages:
                raise Refusal("native_storage_capacity")
            owner.geometry = tuple(
                (name, db.execute("PRAGMA " + name).fetchone()[0])
                for name in ("page_size", "max_page_count", "cache_spill", "synchronous",
                             "fullfsync", "wal_autocheckpoint", "journal_mode", "foreign_keys")
            )
            if tables:
                metadata = dict(db.execute("SELECT key,value FROM main.metadata"))
                self._check_metadata(metadata)
            else:
                db.executescript("""
                    BEGIN IMMEDIATE;
                    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                    CREATE TABLE nodes(
                        path TEXT PRIMARY KEY,parent TEXT,slot TEXT,ordinal INTEGER NOT NULL,
                        kind TEXT NOT NULL CHECK(kind IN ('dict','list','value')),payload BLOB,
                        CHECK((kind='value')=(payload IS NOT NULL)),
                        CHECK(payload IS NULL OR length(payload)<=65536),
                        FOREIGN KEY(parent) REFERENCES nodes(path) DEFERRABLE INITIALLY DEFERRED);
                    COMMIT;
                """)
                db.executemany(
                    "INSERT INTO main.metadata VALUES(?,?)",
                    [
                        ("format", FORMAT),
                        ("repository_id", repository_id),
                        ("profile", owner.roots[4]),
                        ("generation", str(initial_generation)),
                    ],
                )
            owner.schema_ready = True
            self._generation = counter(
                int(dict(db.execute("SELECT key,value FROM main.metadata"))["generation"]),
                zero=True,
            )
            owner.generation[0] = self._generation
            owner.life[2] = (
                not existed or db.execute("SELECT count(*) FROM main.nodes").fetchone()[0] == 0
            )
            self.last_save = None
            _check_owned_files(owner, allow_create=True)
            self._checkpoint()
            fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
        except BaseException:
            owner.roots[0].close()
            owner.life[0] = True
            self.closed = True
            raise

    def _stable_labels(self) -> _PersistenceOwner:
        owner = _OWNERS.get(self)
        if owner is None or owner.life[0]:
            raise Refusal("binding_denied")
        if owner.life[1]:
            raise Refusal("storage_reopen_required")
        db, path, identity, profile, encoded, fault = owner.roots
        if (
            self.closed
            or self.db is not db
            or self.path != path
            or self.repository_id != identity
            or self.profile is not profile
            or self.fault is not fault
            or self._roots is not owner.roots
            or self._lock is not owner.lock
            or not same_ports(
                owner.ports,
                tuple(
                    getattr(self, name).__func__
                    if getattr(getattr(self, name), "__self__", None) is self
                    else None
                    for name in (
                        "_save_sync",
                        "_load_sync",
                        "_snapshot_sync",
                        "_run",
                        "_stable",
                        "_checkpoint",
                        "disk_bytes",
                        "_read_nodes",
                        "_check_metadata",
                    )
                ),
            )
            or owner.generation[0] is not None
            and (type(self._generation) is not int or self._generation != owner.generation[0])
            or canonical(NativeSqliteProfile.metadata(profile), NODE_MAX_BYTES).decode() != encoded
        ):
            raise Refusal("binding_denied")
        return owner

    def _stable(self) -> _PersistenceOwner:
        owner = NativeSqlitePersistence._stable_labels(self)
        require_connection_scope(
            owner.roots[0], owner.roots[1], row_factory=None, geometry=owner.geometry,
            verify=lambda: NativeSqlitePersistence._stable_labels(self),
            schema=_MAIN_SCHEMA if owner.schema_ready else None,
        )
        return owner

    def _check_metadata(self, metadata: dict[str, str]) -> None:
        owner = NativeSqlitePersistence._stable(self)
        if (
            set(metadata) != {"format", "repository_id", "profile", "generation"}
            or metadata["format"] != FORMAT
            or metadata["repository_id"] != owner.roots[2]
            or metadata["profile"] != owner.roots[4]
            or str(counter(int(metadata["generation"]), zero=True)) != metadata["generation"]
        ):
            raise Refusal("binding_denied")

    def _checkpoint(self) -> None:
        owner = NativeSqlitePersistence._stable(self)
        db, _, _, profile, _, _ = owner.roots
        _check_owned_files(owner)
        result = db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        NativeSqlitePersistence._stable(self)
        if result[0] != 0:
            raise Refusal("storage_checkpoint_busy")
        _check_owned_files(owner, allow_create=True)
        if _owned_disk_bytes(owner) > profile.disk_budget_bytes:
            raise Refusal("native_storage_capacity")

    def disk_bytes(self) -> int:
        return _owned_disk_bytes(NativeSqlitePersistence._stable(self))

    def _read_nodes(self) -> _RecordForest:
        owner = NativeSqlitePersistence._stable(self)
        db = owner.roots[0]
        result = {
            row[0]: tuple(row[1:])
            for row in db.execute("SELECT path,parent,slot,ordinal,kind,payload FROM main.nodes")
        }
        NativeSqlitePersistence._stable(self)
        return result

    @staticmethod
    def _fences(previous: _RecordForest, candidate: _RecordForest) -> None:
        for path, row in previous.items():
            # The actual previous forest was validated and compared to its
            # module-owned baseline before this call. Non-peer paths cannot
            # carry these permanent peer/create/registry fences.
            if not path.startswith('["peer_source",'):
                continue
            parts = _decode(path, limit=PATH_MAX_BYTES)
            # These are actual immutable receipt leaves, not a second journal.
            if len(parts) == 4 and parts[:2] == ["peer_source", "receipts"]:
                saved = candidate.get(path)
                if saved is None or saved[:2] != row[:2] or saved[3:] != row[3:]:
                    raise Refusal("permanent_receipt_fence")
            if len(parts) == 4 and parts[:2] == ["peer_source", "versions"]:
                saved = candidate.get(path)
                if saved is None:
                    raise Refusal("permanent_registry_fence")
                old, new = _decode(row[4]), _decode(saved[4])
                if {k: v for k, v in old.items() if k != "historical_read"} != {
                    k: v for k, v in new.items() if k != "historical_read"
                }:
                    raise Refusal("permanent_registry_fence")
            if len(parts) == 3 and parts[:2] == ["peer_source", "heads"]:
                saved = candidate.get(path)
                if saved is None or _decode(saved[4]) < _decode(row[4]):
                    raise Refusal("permanent_registry_fence")

    def _save_sync(self, image: dict[str, Any]) -> None:
        owner = NativeSqlitePersistence._stable(self)
        db, _, identity, profile, _, fault = owner.roots
        if owner.life[2] is not True:
            raise Refusal("storage_load_required")
        _check_owned_files(owner)
        began = time.perf_counter()
        # Only module-owned records from a successful original load/save may
        # certify unchanged literal payloads. No caller supplies this baseline.
        baseline = owner.forest[0]
        records, logical = _nodes(
            image, profile, validated_forest=baseline, validated_literals=owner.literals[0]
        )
        canonicalized = time.perf_counter()
        pending_literals = _prepare_literals(owner, records)
        prepared = time.perf_counter()
        if image["peer_source"]["repository_id"] not in (None, identity):
            raise Refusal("binding_denied")
        self._checkpoint()
        _check_owned_files(owner)
        committed = False
        commit_attempted = False
        try:
            db.execute("BEGIN IMMEDIATE")
            NativeSqlitePersistence._stable(self)
            _check_owned_files(owner, allow_create=True)
            metadata = dict(db.execute("SELECT key,value FROM main.metadata"))
            self._check_metadata(metadata)
            if int(metadata["generation"]) != self._generation:
                raise Refusal("storage_generation_changed")
            previous = self._read_nodes()
            if previous != (baseline if baseline is not None else {}):
                raise Refusal("storage_contents_changed")
            self._fences(previous, records)
            removed = previous.keys() - records.keys()
            changed = {key: row for key, row in records.items() if previous.get(key) != row}
            compared = time.perf_counter()
            for key in removed:
                db.execute("DELETE FROM main.nodes WHERE path=?", (key,))
                NativeSqlitePersistence._stable(self)
            db.executemany(
                """INSERT INTO main.nodes VALUES(?,?,?,?,?,?)
                ON CONFLICT(path) DO UPDATE SET parent=excluded.parent,slot=excluded.slot,
                ordinal=excluded.ordinal,kind=excluded.kind,payload=excluded.payload""",
                [(key, *row) for key, row in changed.items()],
            )
            NativeSqlitePersistence._stable(self)
            generation = counter(self._generation + 1)
            db.execute(
                "UPDATE main.metadata SET value=? WHERE key='generation'", (str(generation),)
            )
            NativeSqlitePersistence._stable(self)
            if fault is not None:
                fault("after_nodes_before_commit")
            NativeSqlitePersistence._stable(self)
            _check_owned_files(owner)
            commit_attempted = True
            db.execute("COMMIT")
            committed = True
            durable = time.perf_counter()
            NativeSqlitePersistence._stable(self)
            self._generation = owner.generation[0] = generation
            if fault is not None:
                fault("after_commit_before_checkpoint")
            NativeSqlitePersistence._stable(self)
            self._checkpoint()
            owner.forest[0] = records
            owner.pending_literals[0] = pending_literals
            self.last_save = {
                "generation": generation,
                "changed_records": len(changed),
                "removed_records": len(removed),
                "total_records": len(records),
                "logical_bytes": logical,
                "transaction_count": 1,
                "prepared_literal_entries": len(pending_literals.entries),
                "prepared_literal_estimated_bytes": pending_literals.bytes_used,
                "literal_max_entries": pending_literals.max_entries,
                "literal_max_estimated_bytes": pending_literals.max_bytes,
                "timings_seconds": {
                    "canonical_records": canonicalized - began,
                    "literal_preparation": prepared - canonicalized,
                    "checkpoint_read_fences_delta": compared - prepared,
                    "sqlite_write_commit": durable - compared,
                    "post_commit_checkpoint": time.perf_counter() - durable,
                },
            }
        except BaseException:
            if committed or commit_attempted:
                owner.life[1] = True
            if not committed:
                _rollback_owned(owner)
            raise

    async def _run[T](self, operation: Callable[..., T], *args: Any) -> T:
        owner = NativeSqlitePersistence._stable(self)
        async with owner.lock:
            NativeSqlitePersistence._stable(self)
            owner.pending_literals[0] = None
            task = asyncio.create_task(asyncio.to_thread(operation, *args))
            try:
                await finish_owned_commit(task)
            except BaseException as error:
                owner.pending_literals[0] = owner.literals[0] = None
                if isinstance(error, asyncio.CancelledError):
                    owner.life[2] = False
                raise
            # Publish preparation only after the original joined operation
            # returns normally, while still holding its original mutex.
            if owner.pending_literals[0] is not None:
                owner.literals[0] = owner.pending_literals[0]
                owner.pending_literals[0] = None
            return task.result()

    async def save(self, image: dict[str, Any]) -> None:
        owned = copy_image(image)
        await NativeSqlitePersistence._run(self, self._save_sync, owned)

    def _load_sync(self) -> dict[str, Any] | None:
        owner = NativeSqlitePersistence._stable(self)
        db, _, _, profile, _, _ = owner.roots
        _check_owned_files(owner)
        try:
            db.execute("BEGIN")
            NativeSqlitePersistence._stable(self)
            metadata = dict(db.execute("SELECT key,value FROM main.metadata"))
            self._check_metadata(metadata)
            if int(metadata["generation"]) != self._generation:
                raise Refusal("storage_generation_changed")
            nodes = self._read_nodes()
            result = _reconstruct(nodes, profile)
            pending_literals = _prepare_literals(owner, nodes)
            NativeSqlitePersistence._stable(self)
            _check_owned_files(owner, allow_create=True)
            db.execute("COMMIT")
            NativeSqlitePersistence._stable(self)
            owner.forest[0] = nodes
            owner.pending_literals[0] = pending_literals
            return result
        except BaseException:
            _rollback_owned(owner)
            raise

    async def load(self) -> dict[str, Any] | None:
        result = await NativeSqlitePersistence._run(self, self._load_sync)
        # Set only after the original load returns normally to its caller. A
        # cancelled/joined worker alone does not authorize stale-RAM writes.
        NativeSqlitePersistence._stable(self).life[2] = True
        return result

    def _snapshot_sync(self) -> tuple[dict[str, Any] | None, int]:
        # Same original read transaction/mutex as load. Capture its generation
        # before releasing the mutex, never by a second unrelated DB read.
        image = NativeSqlitePersistence._load_sync(self)
        generation = NativeSqlitePersistence._stable(self).generation[0]
        if type(generation) is not int:
            raise Refusal("binding_denied")
        return image, generation

    async def snapshot(self) -> tuple[dict[str, Any] | None, int]:
        result = await NativeSqlitePersistence._run(self, self._snapshot_sync)
        NativeSqlitePersistence._stable(self).life[2] = True
        return result

    async def close(self) -> None:
        owner = _OWNERS.get(self)
        if owner is None:
            return
        closing = owner.closing[0]
        if closing is None:
            if owner.life[0]:
                return
            closing = owner.closing[0] = asyncio.create_task(_finish_close(owner))
        # A failed checkpoint/ownership guard can still join the original DB.
        # Its cached close task, including the first error, remains authoritative
        # for every caller after that join; never retry or report silent success.
        try:
            await finish_owned_commit(closing)
        finally:
            if owner.life[0]:
                self.closed = True
