"""Private bounded WhatsApp usage, identity and conservative local admission.

No sender, network adapter, Arx lease or sending authority is created here.
Only trusted owner composition obtains mapping/origin ports; wire JSON cannot
select an origin. Unknown senders share one installation-wide fallback bucket.
Provider acceptance is an observation, never recipient delivery or HA-service
completion. Unknown attempts remain charged and are never a retry permission.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import stat
import weakref
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path

from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal

FORMAT = "wiskey-whatsapp-pacing-ledger.v4"
_LEGACY_FORMATS = frozenset(
    {
        "wiskey-whatsapp-pacing-ledger.v1",
        "wiskey-whatsapp-pacing-ledger.v2",
        "wiskey-whatsapp-pacing-ledger.v3",
    }
)
STATUS_CAPABILITY = "whatsapp_pacing_status_v1"
LOCAL_PER_MINUTE = 3
LOCAL_PER_HOUR = 30
LOCAL_PER_DAY = 150
_LOCAL_LIMITS = ((60, LOCAL_PER_MINUTE), (3600, LOCAL_PER_HOUR), (86400, LOCAL_PER_DAY))
_LOCAL_POLICY = json.dumps(
    {"per_1m": LOCAL_PER_MINUTE, "per_1h": LOCAL_PER_HOUR, "per_24h": LOCAL_PER_DAY},
    sort_keys=True,
    separators=(",", ":"),
)
_WINDOWS = (("1m", 60), ("1h", 3600), ("24h", 86400))
_OWNERS = weakref.WeakKeyDictionary()
_SENDERS = weakref.WeakKeyDictionary()
_MAPPERS = weakref.WeakKeyDictionary()
_ORIGINS = weakref.WeakKeyDictionary()
_ATTEMPTS = weakref.WeakKeyDictionary()
_CLOUD_BINDINGS = weakref.WeakKeyDictionary()
_UNRESOLVED = frozenset({"reserved", "dispatched", "unknown"})
_CLASSES = frozenset({"alert", "code", "ticket", "reminder"})
_SCHEMA = {
    "metadata": "CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
    "senders": "CREATE TABLE senders(bucket TEXT PRIMARY KEY,physical TEXT UNIQUE,"
    " coverage_start INTEGER,coverage_lost INTEGER NOT NULL DEFAULT 0)",
    "aliases": "CREATE TABLE aliases(alias TEXT PRIMARY KEY,bucket TEXT NOT NULL)",
    "attempts": "CREATE TABLE attempts(request_id TEXT PRIMARY KEY,bucket TEXT NOT NULL,"
    " identity TEXT NOT NULL,class TEXT NOT NULL,origin TEXT NOT NULL,"
    " state TEXT NOT NULL,reserved_at INTEGER NOT NULL,accepted_at INTEGER)",
    "attempts_bucket": "CREATE INDEX attempts_bucket ON attempts(bucket)",
    "backoffs": "CREATE TABLE backoffs(bucket TEXT NOT NULL,scope TEXT NOT NULL,pair TEXT NOT NULL,"
    "request_id TEXT NOT NULL,observed_at INTEGER NOT NULL,retry_after INTEGER,"
    "PRIMARY KEY(bucket,scope,pair))",
}
_V3_SCHEMA = {name: sql for name, sql in _SCHEMA.items() if name != "backoffs"}


class AttemptOutcome(StrEnum):
    ACCEPTED = "accepted"
    DEFINITIVELY_NOT_SENT = "definitively_not_sent"
    UNKNOWN = "unknown"


class PacingLimited(Refusal):
    def __init__(self, retry_after_s, *, observed_at=None):
        self.retry_after_s = retry_after_s
        self.observed_at = observed_at
        super().__init__("rate_limited")


class PacingBackoff(Refusal):
    """A durable original provider instruction, not a new send rejection."""

    def __init__(self, scope, retry_after_s, *, observed_at=None):
        self.throttle_scope, self.retry_after_s = scope, retry_after_s
        self.observed_at = observed_at
        super().__init__("pair_rate_limited" if scope == "pair" else "rate_limited")


@dataclass(frozen=True)
class PacingLedgerProfile:
    """Independent DB+WAL+SHM budget; no native-person image budget claim."""

    max_attempts: int = 65536
    max_senders: int = 128
    max_aliases: int = 1024
    disk_budget_bytes: int = 32 * 1024**2
    max_backoffs: int = 1024

    def values(self):
        values = (
            self.max_attempts,
            self.max_senders,
            self.max_aliases,
            self.disk_budget_bytes,
            self.max_backoffs,
        )
        if (
            any(type(v) is not int for v in values)
            or not 1 <= values[0] <= 65536
            or not 1 <= values[1] <= 128
            or not 1 <= values[2] <= 1024
            or not 4 * 1024**2 <= values[3] <= 32 * 1024**2
            or not 1 <= values[4] <= 1024
        ):
            raise Refusal("invalid_fields")
        return values


@dataclass(frozen=True, eq=False, repr=False)
class SenderHandle:
    sender_ref: str | None
    verified: bool


@dataclass(frozen=True, eq=False, repr=False)
class AttemptHandle:
    request_id: str


@dataclass(frozen=True, eq=False, repr=False)
class ArxPacingOrigin:
    """Module-issued original signed send request, never an origin DTO."""

    request_id: str


@dataclass(frozen=True, eq=False, repr=False)
class CloudDispatchBinding:
    """Module issuance for one actual provider Task/ticket/recipient scope."""


def _cloud_binding(ledger, binding, sender):
    from . import whatsapp_cloud_templates as cloud

    record = _CLOUD_BINDINGS.get(binding) if type(binding) is CloudDispatchBinding else None
    if record is None or record[0]() is not ledger or record[1] is not sender:
        raise Refusal("binding_denied")
    provider, attempt, original = record[2:5]
    if (
        type(provider) is not cloud.CloudTemplateProvider
        or type(attempt) is not cloud.CloudSendAttempt
        or attempt.provider is not provider
        or cloud._ATTEMPTS.get(attempt) is not original
        or original[0] is not provider
    ):
        raise Refusal("binding_denied")
    return record


@dataclass(repr=False)
class _Owner:
    db: object
    path: Path
    parent: tuple
    files: dict
    configuration: tuple
    profile_values: tuple
    clock: object
    salt: bytes
    geometry: tuple | None = None
    closed: bool = False
    poisoned: bool = False


def _ref(value):
    if (
        type(value) is not str
        or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", value) is None
        or value.isdecimal()
    ):
        raise Refusal("invalid_fields")
    return value


def _key(value):
    if type(value) is not bytes or len(value) != 32:
        raise Refusal("invalid_fields")
    return value


def _instant(value):
    if type(value) is not datetime or value.tzinfo is None or value.utcoffset() is None:
        raise Refusal("clock_unavailable")
    value = value.astimezone(UTC)
    if not 2000 <= value.year <= 2099:
        raise Refusal("clock_unavailable")
    return (
        (value.toordinal() - datetime(1970, 1, 1).toordinal()) * 86400_000000
        + (value.hour * 3600 + value.minute * 60 + value.second) * 1_000000
        + value.microsecond
    )


def _iso(value):
    return datetime.fromtimestamp(value / 1_000000, UTC).isoformat().replace("+00:00", "Z")


def _now():
    return datetime.now(UTC)


def _identity(path, *, directory=False):
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


def _files(owner, *, initializing=False):
    if _identity(owner.path.parent, directory=True) != owner.parent:
        raise Refusal("storage_path_rebound")
    if Path(str(owner.path) + "-journal").exists():
        raise Refusal("invalid_storage")
    total = 0
    for suffix, original in tuple(owner.files.items()):
        path = Path(str(owner.path) + suffix)
        if not path.exists() and not path.is_symlink():
            if original is not None:
                raise Refusal("storage_path_rebound")
            continue
        current = _identity(path)
        if original is None and initializing:
            owner.files[suffix] = current
        elif original != current:
            raise Refusal("storage_path_rebound")
        total += path.stat().st_size
    if total > owner.profile_values[3]:
        raise Refusal("storage_full")


def _storage(owner):
    """Actual native DB geometry, namespaces and durability, not labels."""
    db = owner.db
    databases = tuple(db.execute("PRAGMA database_list"))
    if (
        any(row[1] not in {"main", "temp"} for row in databases)
        or sum(row[1] == "main" and row[2] == str(owner.path) for row in databases) != 1
        or db.execute("SELECT 1 FROM sqlite_temp_master LIMIT 1").fetchone() is not None
    ):
        raise Refusal("binding_denied")
    actual = tuple(
        db.execute("PRAGMA " + name).fetchone()[0]
        for name in (
            "journal_mode",
            "synchronous",
            "fullfsync",
            "cache_spill",
            "wal_autocheckpoint",
            "page_size",
            "max_page_count",
        )
    )
    if owner.geometry is None or actual != owner.geometry:
        raise Refusal("binding_denied")
    if db.execute("PRAGMA page_count").fetchone()[0] > owner.geometry[-1]:
        raise Refusal("storage_full")


def _owner(ledger, *, cleanup=False):
    owner = _OWNERS.get(ledger)
    if owner is None or owner.closed or owner.poisoned and not cleanup:
        raise Refusal("binding_denied")
    if not cleanup:
        if (
            ledger.db is not owner.db
            or ledger.path is not owner.path
            or ledger.profile is not owner.configuration[1]
            or ledger.ledger_id != owner.configuration[0]
            or PacingLedgerProfile.values(ledger.profile) != owner.profile_values
            or not same_ports((owner.clock,), (ledger.clock,))
        ):
            raise Refusal("binding_denied")
        _files(owner)
    return owner


def _sender(ledger, sender, *, current=True):
    record = _SENDERS.get(sender) if type(sender) is SenderHandle else None
    if (
        record is None
        or record[0]() is not ledger
        or sender.sender_ref != record[2]
        or sender.verified is not record[3]
    ):
        raise Refusal("binding_denied")
    _owner(ledger)
    if current and record[4] is not None:
        SenderMappingPort._check(record[4])
    return record


def _origin(origin, request_id, action_identity):
    if origin is None:
        return "unknown"
    record = _ORIGINS.get(origin) if type(origin) is ArxPacingOrigin else None
    if (
        record is None
        or origin.request_id != record[2]
        or request_id != record[2]
        or action_identity != record[3]
    ):
        raise Refusal("Unauthorized")
    registry, message = record[:2]
    from .trusted_actions.native_peer_source import NativePeerRegistry

    if (
        registry.repository is not record[4]
        or registry._roots is not record[5]
        or registry.repository._save is not record[6]
        or registry.repository._lock is not record[7]
    ):
        raise Refusal("Unauthorized")
    NativePeerRegistry.check(registry, message)
    if _peer_identity(message) != record[8]:
        raise Refusal("Unauthorized")
    return "arx_forwarded"


def _peer_identity(message):
    from .trusted_actions.envelope import thaw

    # Only the validated public descriptor is bound; no message/recipient/PIN
    # content is read or copied. The private ledger stores this opaque digest.
    return (
        "arx_"
        + hashlib.sha256(
            json.dumps(
                thaw(message.request.descriptor), sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
    )


def authenticated_arx_origin(registry, message):
    """Only a genuine current mutation peer, bound to its exact send request.

    Bootstrap/read-only PeerQueryBridge proofs do not have this type and cannot
    be promoted. A container token, signed read or caller JSON is insufficient.
    This is accounting provenance only; all sending admission remains required.
    """
    from .trusted_actions.native_peer_source import NativePeerRegistry
    from .trusted_actions.peer_boundary import PeerMessage

    if type(registry) is not NativePeerRegistry or type(message) is not PeerMessage:
        raise Refusal("Unauthorized")
    NativePeerRegistry.check(registry, message)
    request = message.request
    if request.get("action") != "whatsapp/send":
        raise Refusal("Unauthorized")
    request_id = _ref(request.get("request_id"))
    action_identity = _ref(request.get("operation_id"))
    value = ArxPacingOrigin(request_id)
    _ORIGINS[value] = (
        registry,
        message,
        request_id,
        action_identity,
        registry.repository,
        registry._roots,
        registry.repository._save,
        registry.repository._lock,
        _peer_identity(message),
    )
    return value


class SenderMappingPort:
    """Explicit trusted owner hook for already verified physical sender IDs.

    The host supplies original provider/source and its current-check port ONLY
    after physical mapping verification. Keys are opaque32-byte references, not
    account names, last-four labels or phone numbers. This port is never built
    from public JSON. Unverified HA backends use ledger.unknown_sender().
    coverage_observed alone means relevant WisKey paths are hooked. Full sender
    completeness additionally requires provider_wide_coverage, bound by the
    original current-check to a verified complete provider acceptance feed,
    including direct Arx/external paths. No such live feed is invented here.
    """

    def __init__(
        self,
        ledger,
        *,
        source,
        check,
        provider_kind,
        provider_backend,
        coverage_observed=False,
        provider_wide_coverage=False,
    ):
        if (
            type(ledger) is not PacingLedger
            or source is None
            or not callable(check)
            or type(provider_kind) is not str
            or type(provider_backend) is not str
            or provider_kind not in {"ha_service", "cloud_api", "unknown"}
            or provider_backend not in {"baileys", "cloud_api", "unknown"}
            or type(coverage_observed) is not bool
            or type(provider_wide_coverage) is not bool
        ):
            raise ValueError("explicit trusted original sender mapping hook required")
        _owner(ledger)
        self.ledger, self.source, self.check = ledger, source, check
        self.provider_kind, self.provider_backend = provider_kind, provider_backend
        self.coverage_observed = coverage_observed
        self.provider_wide_coverage = provider_wide_coverage
        _MAPPERS[self] = (
            weakref.ref(ledger),
            source,
            check,
            provider_kind,
            provider_backend,
            coverage_observed,
            provider_wide_coverage,
        )
        SenderMappingPort._check(self)

    def _check(self):
        record = _MAPPERS.get(self)
        if (
            record is None
            or self.ledger is not record[0]()
            or self.source is not record[1]
            or not same_ports((self.check,), (record[2],))
            or type(self.provider_kind) is not str
            or type(self.provider_backend) is not str
            or self.coverage_observed is not record[5]
            or self.provider_wide_coverage is not record[6]
            or (self.provider_kind, self.provider_backend) != record[3:5]
        ):
            raise Refusal("binding_denied")
        _owner(self.ledger)
        result = record[2]()
        if result is not None and result is not True:
            raise Refusal("binding_denied")
        # A callback cannot replace both a source and its publicly visible check.
        if (
            self.source is not record[1]
            or not same_ports((self.check,), (record[2],))
            or self.ledger is not record[0]()
            or type(self.provider_kind) is not str
            or type(self.provider_backend) is not str
            or self.coverage_observed is not record[5]
            or self.provider_wide_coverage is not record[6]
            or (self.provider_kind, self.provider_backend) != record[3:5]
        ):
            raise Refusal("binding_denied")
        return record

    def bind(self, *, alias_key: bytes, physical_key: bytes) -> SenderHandle:
        record = SenderMappingPort._check(self)
        return PacingLedger._bind(self.ledger, self, _key(alias_key), _key(physical_key), record)

    def close(self):
        """Retire this original mapping hook; do not close its external source."""
        _MAPPERS.pop(self, None)


class PacingLedger:
    def __init__(
        self,
        path,
        *,
        ledger_id,
        profile=None,
        clock=_now,
        expect_existing=False,
        restore_uncertain=False,
        migrate_legacy=False,
    ):
        if (
            type(expect_existing) is not bool
            or type(restore_uncertain) is not bool
            or type(migrate_legacy) is not bool
            or not callable(clock)
            or profile is not None
            and type(profile) is not PacingLedgerProfile
        ):
            raise ValueError("explicit pacing ledger configuration required")
        self.ledger_id = _ref(ledger_id)
        self.profile = PacingLedgerProfile() if profile is None else profile
        values = PacingLedgerProfile.values(self.profile)
        self.clock = clock
        self.path = Path(path).absolute()
        parent = _identity(self.path.parent, directory=True)
        descriptor = os.open(
            self.path, os.O_RDWR | os.O_NOFOLLOW | (0 if expect_existing else os.O_CREAT), 0o600
        )
        os.close(descriptor)
        identity = _identity(self.path)
        self.db = sqlite3.connect(
            self.path.as_uri() + "?mode=rw", uri=True, isolation_level=None, timeout=2
        )
        self.db.row_factory = sqlite3.Row
        owner = _Owner(
            self.db,
            self.path,
            parent,
            {"": identity, "-wal": None, "-shm": None},
            (ledger_id, self.profile),
            values,
            clock,
            b"",
        )
        _OWNERS[self] = owner
        try:
            _files(owner, initializing=True)
            tables = {
                r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            expected = {"metadata", "senders", "aliases", "attempts"}
            if (expect_existing and tables not in (expected, expected | {"backoffs"})) or (
                tables and tables not in (expected, expected | {"backoffs"})
            ):
                raise Refusal("binding_denied")
            if self.db.execute("PRAGMA journal_mode=WAL").fetchone()[0] != "wal":
                raise Refusal("storage_write_failed")
            self.db.execute("PRAGMA synchronous=FULL")
            self.db.execute("PRAGMA fullfsync=ON")
            self.db.execute("PRAGMA cache_spill=OFF")
            self.db.execute("PRAGMA wal_autocheckpoint=1")
            page = self.db.execute("PRAGMA page_size").fetchone()[0]
            if page != 4096:
                raise Refusal("binding_denied")
            pages = values[3] // (4 * page)
            if self.db.execute(f"PRAGMA max_page_count={pages}").fetchone()[0] > pages:
                raise Refusal("storage_full")
            owner.geometry = ("wal", 2, 1, 0, 1, page, pages)
            _storage(owner)
            if not tables:
                self.db.executescript("BEGIN IMMEDIATE;" + ";".join(_SCHEMA.values()) + ";COMMIT;")
                salt = secrets.token_bytes(32)
                data = {
                    "format": FORMAT,
                    "ledger_id": ledger_id,
                    "profile": json.dumps(values),
                    "salt": salt.hex(),
                    "last_at": "0",
                    "local_policy": _LOCAL_POLICY,
                    "geometry": json.dumps(owner.geometry),
                }
                self.db.execute("BEGIN IMMEDIATE")
                self.db.executemany("INSERT INTO metadata VALUES(?,?)", data.items())
                self.db.execute("INSERT INTO senders(bucket,physical) VALUES('fallback',NULL)")
                self.db.execute("COMMIT")
            metadata = dict(self.db.execute("SELECT key,value FROM metadata"))
            legacy = metadata.get("format") in _LEGACY_FORMATS
            keys = {"format", "ledger_id", "profile", "salt", "last_at"}
            if not legacy or metadata.get("format") == "wiskey-whatsapp-pacing-ledger.v3":
                keys.add("local_policy")
            if not legacy:
                keys.add("geometry")
            if (
                set(metadata) != keys
                or metadata["format"] not in {FORMAT, *_LEGACY_FORMATS}
                or metadata["ledger_id"] != ledger_id
                or metadata["profile"] != json.dumps(values[:4] if legacy else values)
                or "local_policy" in metadata
                and metadata["local_policy"] != _LOCAL_POLICY
                or not legacy
                and metadata["geometry"] != json.dumps(owner.geometry)
                or re.fullmatch("[0-9a-f]{64}", metadata["salt"]) is None
                or not metadata["last_at"].isdigit()
            ):
                raise Refusal("binding_denied")
            owner.salt = bytes.fromhex(metadata["salt"])
            _files(owner, initializing=True)
            if legacy and not migrate_legacy:
                raise Refusal("pacing_ledger_migration_required")
            PacingLedger._validate(self, legacy=metadata["format"] if legacy else False)
            if legacy:
                # Version1 measured WisKey-hook coverage. Never promote that
                # historical observation into complete physical-sender proof.
                # Accounting/identity/once-only state is preserved in place.
                with PacingLedger._transaction(self, legacy=metadata["format"]):
                    self.db.execute(
                        "UPDATE senders SET coverage_start=NULL,coverage_lost=1 "
                        "WHERE bucket!='fallback'"
                    )
                    self.db.execute(_SCHEMA["backoffs"])
                    self.db.execute("UPDATE metadata SET value=? WHERE key='format'", (FORMAT,))
                    self.db.execute(
                        "UPDATE metadata SET value=? WHERE key='profile'", (json.dumps(values),)
                    )
                    self.db.execute(
                        "INSERT OR REPLACE INTO metadata VALUES('local_policy',?)", (_LOCAL_POLICY,)
                    )
                    self.db.execute(
                        "INSERT INTO metadata VALUES('geometry',?)", (json.dumps(owner.geometry),)
                    )
            if restore_uncertain:
                with PacingLedger._transaction(self):
                    self.db.execute("UPDATE senders SET coverage_lost=1")
        except BaseException:
            owner.db.close()
            owner.closed = True
            raise

    def _validate(self, *, legacy=False):
        if legacy is not False and legacy not in _LEGACY_FORMATS:
            raise Refusal("binding_denied")
        owner = _owner(self)
        _storage(owner)
        actual = {
            row["name"]: (row["type"], row["tbl_name"], row["sql"])
            for row in owner.db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master")
        }
        expected = {
            name: (
                "index" if name == "attempts_bucket" else "table",
                "attempts" if name == "attempts_bucket" else name,
                sql,
            )
            for name, sql in (_V3_SCHEMA if legacy else _SCHEMA).items()
        }
        for table, count in (
            ("metadata", 1),
            ("senders", 2),
            ("aliases", 1),
            ("attempts", 1),
            *(() if legacy else (("backoffs", 1),)),
        ):
            for ordinal in range(1, count + 1):
                expected[f"sqlite_autoindex_{table}_{ordinal}"] = "index", table, None
        if actual != expected:
            raise Refusal("binding_denied")
        _owner(self)
        if owner.db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise Refusal("storage_write_failed")
        counts = tuple(
            owner.db.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in ("attempts", "senders", "aliases")
        )
        if any(
            count > limit
            for count, limit in zip(
                counts,
                (owner.profile_values[0], owner.profile_values[1] + 1, owner.profile_values[2]),
                strict=True,
            )
        ):
            raise Refusal("storage_full")
        metadata = dict(owner.db.execute("SELECT key,value FROM metadata"))
        expected_metadata = {
            "format": legacy if legacy else FORMAT,
            "ledger_id": owner.configuration[0],
            "profile": json.dumps(owner.profile_values[:4] if legacy else owner.profile_values),
            "salt": owner.salt.hex(),
            "last_at": metadata.get("last_at"),
        }
        if not legacy or legacy == "wiskey-whatsapp-pacing-ledger.v3":
            expected_metadata["local_policy"] = _LOCAL_POLICY
        if not legacy:
            expected_metadata["geometry"] = json.dumps(owner.geometry)
        if (
            metadata != expected_metadata
            or re.fullmatch(r"0|[1-9][0-9]{0,15}", metadata["last_at"]) is None
        ):
            raise Refusal("binding_denied")
        last = int(metadata["last_at"])
        senders = {}
        for row in owner.db.execute("SELECT * FROM senders"):
            if (
                row["coverage_lost"] not in (0, 1)
                or type(row["coverage_lost"]) is not int
                or row["coverage_start"] is not None
                and (
                    type(row["coverage_start"]) is not int or not 0 < row["coverage_start"] <= last
                )
            ):
                raise Refusal("binding_denied")
            if row["bucket"] == "fallback":
                if row["physical"] is not None or row["coverage_start"] is not None:
                    raise Refusal("binding_denied")
            elif (
                type(row["bucket"]) is not str
                or re.fullmatch(r"sender_[0-9a-f]{32}", row["bucket"]) is None
                or type(row["physical"]) is not str
                or re.fullmatch(r"[0-9a-f]{64}", row["physical"]) is None
            ):
                raise Refusal("binding_denied")
            senders[row["bucket"]] = row
        if "fallback" not in senders:
            raise Refusal("binding_denied")
        for row in owner.db.execute("SELECT * FROM aliases"):
            if (
                type(row["alias"]) is not str
                or re.fullmatch(r"[0-9a-f]{64}", row["alias"]) is None
                or row["bucket"] not in senders
                or row["bucket"] == "fallback"
            ):
                raise Refusal("binding_denied")
        for row in owner.db.execute("SELECT * FROM attempts"):
            _ref(row["request_id"])
            _ref(row["identity"])
            if (
                row["class"] not in _CLASSES
                or row["origin"] not in {"local", "unknown", "arx_forwarded"}
                or row["state"] not in {*_UNRESOLVED, "accepted", "definitively_not_sent"}
                or type(row["reserved_at"]) is not int
                or not 0 < row["reserved_at"] <= last
                or (
                    type(row["accepted_at"]) is not int
                    or not row["reserved_at"] <= row["accepted_at"] <= last
                    if row["state"] == "accepted"
                    else row["accepted_at"] is not None
                )
                or row["bucket"] not in senders
            ):
                raise Refusal("binding_denied")
        if not legacy:
            if (
                owner.db.execute("SELECT count(*) FROM backoffs").fetchone()[0]
                > owner.profile_values[4]
            ):
                raise Refusal("storage_full")
            for row in owner.db.execute("SELECT * FROM backoffs"):
                attempt = owner.db.execute(
                    "SELECT bucket,state FROM attempts WHERE request_id=?", (row["request_id"],)
                ).fetchone()
                if (
                    row["bucket"] not in senders
                    or row["scope"] not in {"account", "pair"}
                    or type(row["pair"]) is not str
                    or (
                        row["pair"] != ""
                        if row["scope"] == "account"
                        else (
                            row["pair"] != "unknown"
                            and re.fullmatch(r"[0-9a-f]{64}", row["pair"]) is None
                        )
                    )
                    or attempt is None
                    or tuple(attempt) != (row["bucket"], "definitively_not_sent")
                    or type(row["observed_at"]) is not int
                    or not 0 < row["observed_at"] <= last
                    or row["retry_after"] is not None
                    and (
                        type(row["retry_after"]) is not int
                        or not 0 <= row["retry_after"] <= 9007199254740991
                    )
                ):
                    raise Refusal("binding_denied")
        _storage(owner)
        _owner(self)

    @contextmanager
    def _transaction(self, guard=None, *, legacy=False):
        owner = _owner(self)
        _storage(owner)
        PacingLedger._checkpoint(self, owner)
        PacingLedger._validate(self, legacy=legacy)
        try:
            owner.db.execute("BEGIN IMMEDIATE")
            _owner(self)
            PacingLedger._validate(self, legacy=legacy)
            yield owner
            if guard is not None:
                guard()
            PacingLedger._validate(self)
            _owner(self)
            owner.db.execute("COMMIT")
            # COMMIT callbacks can replace aliases/path after the precheck.
            # An already committed write is never described as rolled back.
            try:
                _owner(self)
                _storage(owner)
                PacingLedger._checkpoint(self, owner)
                if guard is not None:
                    guard()
                PacingLedger._validate(self)
                _owner(self)
            except BaseException:
                owner.poisoned = True
                raise
        except BaseException as error:
            if owner.db.in_transaction:
                owner.db.execute("ROLLBACK")
            if isinstance(error, sqlite3.Error):
                raise Refusal(
                    "storage_full"
                    if getattr(error, "sqlite_errorcode", None) == sqlite3.SQLITE_FULL
                    else "storage_write_failed"
                ) from None
            raise

    def _checkpoint(self, owner):
        _owner(self)
        result = owner.db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        _owner(self)
        if result is None or result[0] != 0:
            raise Refusal("storage_checkpoint_busy")

    def _time(self):
        owner = _owner(self)
        now = _instant(owner.clock())
        _owner(self)
        last = int(owner.db.execute("SELECT value FROM metadata WHERE key='last_at'").fetchone()[0])
        if now < last:
            raise Refusal("clock_unavailable")
        owner.db.execute("UPDATE metadata SET value=? WHERE key='last_at'", (str(now),))
        return now

    def _handle(self, bucket, public, mapper=None):
        value = SenderHandle(public, public is not None)
        _SENDERS[value] = weakref.ref(self), bucket, public, public is not None, mapper
        return value

    def unknown_sender(self):
        _owner(self)
        return PacingLedger._handle(self, "fallback", None)

    def bind_cloud_dispatch(self, sender, provider, provider_attempt):
        """Issue on original native POST Task; performs no SQLite operation.

        Missing physical/pair mapping stays conservative. The optional actual
        provider getter returns only its original validated recipient; no body
        is parsed/hashed and no caller bytes select a pair exemption.
        """
        from . import whatsapp_cloud_templates as cloud
        from .access.models import SecretValue

        owner = _owner(self)
        source = _sender(self, sender)
        original = (
            cloud._ATTEMPTS.get(provider_attempt)
            if type(provider_attempt) is cloud.CloudSendAttempt
            else None
        )
        scope = cloud._SCOPE.get()
        if (
            type(provider) is not cloud.CloudTemplateProvider
            or original is None
            or provider_attempt.provider is not provider
            or original[0] is not provider
            or original[1] is not asyncio.current_task()
            or type(scope) is not cloud._RequestScope
            or scope.task is not original[1]
            or scope.attempted is not original[2]
            or scope.request.method != "POST"
            or original[2][0] is not False
        ):
            raise Refusal("binding_denied")
        cloud.CloudTemplateProvider.check(provider)
        cloud._check_scope(scope.request, scope.transport)
        pair = None
        getter = getattr(cloud.CloudTemplateProvider, "pacing_recipient", None)
        if source[3] and getter is not None:
            recipient = getter(provider, provider_attempt)
            if type(recipient) is not SecretValue or type(recipient.value) is not str:
                raise Refusal("binding_denied")
            pair = hmac.new(
                owner.salt, b"pair." + recipient.value.encode("utf-8"), hashlib.sha256
            ).hexdigest()
        value = CloudDispatchBinding()
        _CLOUD_BINDINGS[value] = (
            weakref.ref(self),
            sender,
            provider,
            provider_attempt,
            original,
            pair,
            original[3],
            scope.request,
        )
        _cloud_binding(self, value, sender)
        return value

    def _bind(self, mapper, alias, physical, record):
        def guard():
            SenderMappingPort._check(mapper)

        with PacingLedger._transaction(self, guard) as owner:
            now = PacingLedger._time(self)
            alias = hmac.new(owner.salt, b"alias." + alias, hashlib.sha256).hexdigest()
            physical = hmac.new(owner.salt, b"physical." + physical, hashlib.sha256).hexdigest()
            existing = owner.db.execute(
                "SELECT bucket FROM aliases WHERE alias=?", (alias,)
            ).fetchone()
            found = owner.db.execute(
                "SELECT bucket FROM senders WHERE physical=?", (physical,)
            ).fetchone()
            if existing is not None and (found is None or existing[0] != found[0]):
                raise Refusal("binding_denied")
            if found is None:
                if (
                    owner.db.execute(
                        "SELECT count(*) FROM senders WHERE physical IS NOT NULL"
                    ).fetchone()[0]
                    >= owner.profile_values[1]
                ):
                    raise Refusal("storage_full")
                bucket = "sender_" + secrets.token_hex(16)
                owner.db.execute(
                    "INSERT INTO senders(bucket,physical,coverage_start) VALUES(?,?,?)",
                    (bucket, physical, now if record[5] and record[6] else None),
                )
            else:
                bucket = found[0]
                if record[5] and record[6]:
                    owner.db.execute(
                        "UPDATE senders SET coverage_start=COALESCE(coverage_start,?) "
                        "WHERE bucket=?",
                        (now, bucket),
                    )
                else:
                    # A discovered unobserved path breaks previously declared
                    # coverage. Reopening or rebinding cannot erase this gap.
                    owner.db.execute(
                        "UPDATE senders SET coverage_lost=1 "
                        "WHERE bucket=? AND coverage_start IS NOT NULL",
                        (bucket,),
                    )
            if existing is None:
                if (
                    owner.db.execute("SELECT count(*) FROM aliases").fetchone()[0]
                    >= owner.profile_values[2]
                ):
                    raise Refusal("storage_full")
                owner.db.execute("INSERT INTO aliases VALUES(?,?)", (alias, bucket))
        return PacingLedger._handle(self, bucket, bucket, mapper)

    def reserve(
        self,
        sender,
        *,
        request_id,
        action_identity,
        message_class,
        origin=None,
        known_local=False,
        dispatch_binding=None,
    ):
        """Commit one reservation before I/O; duplicate is never fresh permission.

        known_local is an internal host observation, not an incoming origin flag.
        None defaults to conservatively charged unknown attribution. JSON and
        direct ArxPacingOrigin construction never create a forwarding exemption.
        """
        record = _sender(self, sender)
        request_id, action_identity = _ref(request_id), _ref(action_identity)
        if message_class not in _CLASSES or type(known_local) is not bool:
            raise Refusal("invalid_fields")

        def guard():
            _sender(self, sender)
            _origin(origin, request_id, action_identity)
            if dispatch_binding is not None:
                _cloud_binding(self, dispatch_binding, sender)

        attribution = _origin(origin, request_id, action_identity)
        if origin is None and known_local:
            attribution = "local"
        with PacingLedger._transaction(self, guard) as owner:
            now = PacingLedger._time(self)
            row = owner.db.execute(
                "SELECT * FROM attempts WHERE request_id=?", (request_id,)
            ).fetchone()
            bound_identity = (
                _ORIGINS[origin][8] if attribution == "arx_forwarded" else action_identity
            )
            identity = record[1], bound_identity, message_class, attribution
            if row is not None:
                if (row["bucket"], row["identity"], row["class"], row["origin"]) != identity:
                    raise Refusal("operation_conflict")
                fresh = False
            else:
                pair = (
                    None
                    if dispatch_binding is None
                    else _cloud_binding(self, dispatch_binding, sender)[5]
                )
                PacingLedger._sender_admission(owner, record[1], now, pair)
                if attribution != "arx_forwarded":
                    PacingLedger._local_admission(owner, record[1], now)
                if (
                    owner.db.execute("SELECT count(*) FROM attempts").fetchone()[0]
                    >= owner.profile_values[0]
                ):
                    raise Refusal("storage_full")
                owner.db.execute(
                    "INSERT INTO attempts VALUES(?,?,?,?,?,'reserved',?,NULL)",
                    (request_id, *identity, now),
                )
                fresh = True
        attempt = AttemptHandle(request_id)
        _ATTEMPTS[attempt] = (
            weakref.ref(self),
            request_id,
            fresh,
            sender,
            origin,
            action_identity,
            dispatch_binding if fresh else None,
        )
        return attempt, fresh

    @staticmethod
    def _usage(owner, bucket, now, seconds, *, own):
        rows = owner.db.execute(
            "SELECT state,accepted_at,origin FROM attempts WHERE bucket=?", (bucket,)
        )
        active, accepted = 0, []
        for row in rows:
            if own and row["origin"] == "arx_forwarded":
                continue
            if row["state"] in _UNRESOLVED:
                active += 1
            elif (
                row["state"] == "accepted" and now - seconds * 1_000000 < row["accepted_at"] <= now
            ):
                accepted.append(row["accepted_at"])
        return active, sorted(accepted)

    @staticmethod
    def _local_admission(owner, bucket, now):
        waits = []
        for seconds, limit in _LOCAL_LIMITS:
            active, accepted = PacingLedger._usage(owner, bucket, now, seconds, own=True)
            if active + len(accepted) >= limit:
                if active >= limit:
                    raise PacingLimited(None, observed_at=_iso(now))
                waits.append(
                    max(
                        0,
                        math.ceil(
                            (accepted[len(accepted) + active - limit] + seconds * 1_000000 - now)
                            / 1_000000
                        ),
                    )
                )
        if waits:
            raise PacingLimited(max(waits), observed_at=_iso(now))

    @staticmethod
    def _active_backoffs(owner, bucket, now, pair=None):
        result = []
        for row in owner.db.execute("SELECT * FROM backoffs WHERE bucket=?", (bucket,)):
            if row["scope"] == "pair" and pair is not None and row["pair"] not in {"unknown", pair}:
                continue
            remaining = (
                None
                if row["retry_after"] is None
                else math.ceil(
                    (row["observed_at"] + row["retry_after"] * 1_000000 - now) / 1_000000
                )
            )
            if remaining is None or remaining > 0:
                result.append((row, remaining))
        return result

    @staticmethod
    def _sender_admission(owner, bucket, now, pair=None):
        # Unknown identity is not proof of a different physical sender. A
        # verified bucket must respect fallback uncertainty, and fallback must
        # respect every known bucket's uncertainty. Verified A and verified B
        # remain independent in the absence of a fallback restriction.
        buckets = (
            tuple(row[0] for row in owner.db.execute("SELECT bucket FROM senders"))
            if bucket == "fallback"
            else (bucket, "fallback")
        )
        active = []
        for current in buckets:
            if (
                owner.db.execute(
                    "SELECT 1 FROM attempts WHERE bucket=? "
                    "AND state IN ('dispatched','unknown') LIMIT 1",
                    (current,),
                ).fetchone()
                is not None
            ):
                raise Refusal("pacing_sender_reconciliation_required")
            active.extend(PacingLedger._active_backoffs(owner, current, now, pair))
        if active:
            scope = "account" if any(row["scope"] == "account" for row, _ in active) else "pair"
            retry = (
                None
                if any(delay is None for _, delay in active)
                else max(delay for _, delay in active)
            )
            raise PacingBackoff(scope, retry, observed_at=_iso(now))

    def check_local_admission(self, sender, *, dispatch_binding=None):
        """Read-only queue hint; only reserve() provides atomic admission.

        No reservation, state transition or clock metadata is written. Another
        sender can consume capacity immediately after this hint returns.
        """
        record = _sender(self, sender)
        owner = _owner(self)
        PacingLedger._validate(self)
        now = _instant(owner.clock())
        last = int(owner.db.execute("SELECT value FROM metadata WHERE key='last_at'").fetchone()[0])
        if now < last:
            raise Refusal("clock_unavailable")
        pair = (
            None if dispatch_binding is None else _cloud_binding(self, dispatch_binding, sender)[5]
        )
        PacingLedger._sender_admission(owner, record[1], now, pair)
        PacingLedger._local_admission(owner, record[1], now)
        _sender(self, sender)
        _owner(self)

    def _attempt(self, attempt):
        record = _ATTEMPTS.get(attempt) if type(attempt) is AttemptHandle else None
        if record is None or record[0]() is not self or attempt.request_id != record[1]:
            raise Refusal("binding_denied")
        _owner(self)
        return record

    def mark_dispatch(self, attempt):
        """One original fresh reservation may enter possible-send exactly once."""
        record = PacingLedger._attempt(self, attempt)
        if not record[2]:
            raise Refusal("operation_conflict")

        def guard():
            PacingLedger._attempt(self, attempt)
            _sender(self, record[3])
            _origin(record[4], record[1], record[5])
            if record[6] is not None:
                _cloud_binding(self, record[6], record[3])

        with PacingLedger._transaction(self, guard) as owner:
            now = PacingLedger._time(self)
            source = _sender(self, record[3])
            pair = None if record[6] is None else _cloud_binding(self, record[6], record[3])[5]
            PacingLedger._sender_admission(owner, source[1], now, pair)
            changed = owner.db.execute(
                "UPDATE attempts SET state='dispatched' WHERE request_id=? AND state='reserved'",
                (record[1],),
            ).rowcount
            if changed != 1:
                raise Refusal("operation_conflict")

    def finish(self, attempt, outcome):
        """Durably publish actual provider evidence or conservative UNKNOWN.

        Completion may outlive revoked authority; it cannot dispatch or retry.
        The trusted provider hook must only use ACCEPTED for provider acceptance,
        never a completed HA service call. Definitive rejection can resolve a
        previous UNKNOWN; contradictory terminal evidence refuses.
        """
        record = PacingLedger._attempt(self, attempt)
        if type(outcome) is not AttemptOutcome:
            raise Refusal("invalid_fields")
        with PacingLedger._transaction(
            self,
        ) as owner:
            now = PacingLedger._time(self)
            row = owner.db.execute(
                "SELECT state FROM attempts WHERE request_id=?", (record[1],)
            ).fetchone()
            if row is None:
                raise Refusal("operation_conflict")
            state = row[0]
            if state == outcome.value:
                return
            if (
                state in {"accepted", "definitively_not_sent"}
                or state == "reserved"
                and outcome is AttemptOutcome.ACCEPTED
            ):
                raise Refusal("operation_conflict")
            if state in {"dispatched", "unknown"} and not record[2]:
                raise Refusal("binding_denied")
            if (
                outcome is AttemptOutcome.DEFINITIVELY_NOT_SENT
                and record[6] is not None
                and state in {"dispatched", "unknown"}
            ):
                from .whatsapp_cloud_templates import CloudTemplateProvider

                bound = _cloud_binding(self, record[6], record[3])
                if CloudTemplateProvider.was_dispatched(bound[2], bound[3]):
                    raise Refusal("binding_denied")
            owner.db.execute(
                "UPDATE attempts SET state=?,accepted_at=? WHERE request_id=?",
                (outcome.value, now if outcome is AttemptOutcome.ACCEPTED else None, record[1]),
            )

    def finish_provider_rejection(self, attempt, error, *, dispatch_binding):
        """Atomic original rejection + backoff; failure leaves dispatch barrier."""
        from .whatsapp_pacing_outcomes import pacing_refusal_metadata

        issued = PacingLedger._attempt(self, attempt)
        if not issued[2] or issued[6] is not dispatch_binding:
            raise Refusal("binding_denied")
        bound = _cloud_binding(self, dispatch_binding, issued[3])
        evidence = pacing_refusal_metadata(
            error, provider=bound[2], attempt=bound[3], request=bound[6]
        )
        if evidence is None:
            raise Refusal("binding_denied")
        scope, delay = evidence["throttle_scope"], evidence["retry_after_s"]
        pair = "" if scope == "account" else bound[5] or "unknown"
        source = _sender(self, issued[3], current=False)
        with PacingLedger._transaction(self) as owner:
            now = PacingLedger._time(self)
            state = owner.db.execute(
                "SELECT state FROM attempts WHERE request_id=?", (issued[1],)
            ).fetchone()
            if state is None:
                raise Refusal("operation_conflict")
            if state[0] == "definitively_not_sent":
                # Never slide an original deadline on duplicate/late receipt.
                return
            if state[0] not in {"dispatched", "unknown"}:
                raise Refusal("operation_conflict")
            old = owner.db.execute(
                "SELECT 1 FROM backoffs WHERE bucket=? AND scope=? AND pair=?",
                (source[1], scope, pair),
            ).fetchone()
            if (
                old is None
                and owner.db.execute("SELECT count(*) FROM backoffs").fetchone()[0]
                >= owner.profile_values[4]
            ):
                raise Refusal("storage_full")
            owner.db.execute(
                "INSERT INTO backoffs VALUES(?,?,?,?,?,?) ON CONFLICT(bucket,scope,pair) "
                "DO UPDATE SET request_id=excluded.request_id,observed_at=excluded.observed_at,"
                "retry_after=excluded.retry_after",
                (source[1], scope, pair, issued[1], now, delay),
            )
            owner.db.execute(
                "UPDATE attempts SET state='definitively_not_sent',accepted_at=NULL "
                "WHERE request_id=?",
                (issued[1],),
            )

    def attempt_status(self, attempt):
        record = PacingLedger._attempt(self, attempt)
        owner = _owner(self)
        PacingLedger._validate(self)
        row = owner.db.execute(
            "SELECT state FROM attempts WHERE request_id=?", (record[1],)
        ).fetchone()
        _owner(self)
        if row is None:
            raise Refusal("operation_conflict")
        return row[0]

    def snapshot(self, sender):
        record = _sender(self, sender)
        mapper = record[4]
        mapping = None if mapper is None else SenderMappingPort._check(mapper)
        with PacingLedger._transaction(self, lambda: _sender(self, sender)) as owner:
            now = PacingLedger._time(self)
            row = owner.db.execute(
                "SELECT coverage_start,coverage_lost FROM senders WHERE bucket=?", (record[1],)
            ).fetchone()
            ambiguous = (
                owner.db.execute(
                    "SELECT 1 FROM attempts WHERE bucket=? AND origin='unknown' AND "
                    "(state IN ('reserved','dispatched','unknown') OR reserved_at>? "
                    "OR accepted_at>?) LIMIT 1",
                    (record[1], now - 86400_000000, now - 86400_000000),
                ).fetchone()
                is not None
            )
            complete = bool(
                record[3]
                and mapping[5]
                and mapping[6]
                and row[0] is not None
                and not row[1]
                and now - row[0] >= 86400_000000
                and not ambiguous
            )
            result = {
                "sender_ref": record[2],
                "sender_match_verified": record[3],
                "provider_kind": "ha_service" if mapping is None else mapping[3],
                "provider_backend": "unknown" if mapping is None else mapping[4],
                "counter_basis": "provider_accepted",
                "counters_complete": complete,
                "observed_at": _iso(now),
                "coverage_started_at": None if row[0] is None else _iso(row[0]),
                "wiskey_own": {},
                "observed_local": {
                    "schema_version": 1,
                    "basis": "original_native_ledger_observation",
                    "provider_total_complete": False,
                },
                "throttled_until": None,
                "throttle_scope": None,
                "retry_after_s": None,
            }
            account_backoff = [
                (entry, delay)
                for entry, delay in PacingLedger._active_backoffs(owner, record[1], now)
                if entry["scope"] == "account"
            ]
            if account_backoff:
                delay = (
                    None
                    if any(d is None for _, d in account_backoff)
                    else max(d for _, d in account_backoff)
                )
                result["throttle_scope"] = "account"
                result["retry_after_s"] = delay
                if delay is not None:
                    try:
                        result["throttled_until"] = _iso(
                            max(
                                entry["observed_at"] + entry["retry_after"] * 1_000000
                                for entry, _ in account_backoff
                            )
                        )
                    except (OverflowError, ValueError, OSError):
                        pass
            for suffix, seconds in _WINDOWS:
                _, all_sent = PacingLedger._usage(owner, record[1], now, seconds, own=False)
                pending, own_sent = PacingLedger._usage(owner, record[1], now, seconds, own=True)
                result["observed_local"]["sent_" + suffix] = len(own_sent)
                result["observed_local"]["charged_" + suffix] = pending + len(own_sent)
                result["sent_" + suffix] = len(all_sent) if complete else None
                result["wiskey_own"]["sent_" + suffix] = len(own_sent) if complete else None
                result["wiskey_own"]["charged_" + suffix] = (
                    pending + len(own_sent) if complete else None
                )
        return result

    def close(self):
        """Close only the module-issued original connection, even after grafts."""
        owner = _OWNERS.get(self)
        if owner is not None and not owner.closed:
            owner.db.close()
            owner.closed = True
            # Registered sources can themselves own the ledger/handles. Drop
            # this ledger's module-held values so explicit teardown cannot
            # leave a module -> source -> HA namespace -> weak-key cycle alive.
            for mapping, record in tuple(_MAPPERS.items()):
                if record[0]() is self:
                    _MAPPERS.pop(mapping, None)
            for sender, record in tuple(_SENDERS.items()):
                if record[0]() is self:
                    _SENDERS.pop(sender, None)
            for attempt, record in tuple(_ATTEMPTS.items()):
                if record[0]() is self:
                    _ATTEMPTS.pop(attempt, None)
            for binding, record in tuple(_CLOUD_BINDINGS.items()):
                if record[0]() is self:
                    _CLOUD_BINDINGS.pop(binding, None)
