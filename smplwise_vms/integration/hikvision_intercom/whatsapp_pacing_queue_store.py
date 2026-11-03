"""Bounded opaque queue state; no message body, recipient, preview or credential.

Uses the reviewed native SQLite quarter-page/WAL accounting algorithm. This is
an independent queue budget, not the person image or pacing usage ledger budget.
No terminal history is evicted and no ambiguous dispatch is requeued on reopen.
"""

from __future__ import annotations

import json
import os
import sqlite3
import weakref
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from .access.arx_execution_journal import _identity
from .trusted_actions.validation import Refusal, reference
from .whatsapp_pacing_reservations import CLASSES, OUTCOMES, utc

FORMAT = "wiskey-whatsapp-pacing-queue.v2"
_OWNERS = weakref.WeakKeyDictionary()
_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
_SCHEMA_SQL = (
    "CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
    "CREATE TABLE jobs(request TEXT PRIMARY KEY,payload TEXT NOT NULL)",
    "CREATE TABLE backoffs(sender TEXT NOT NULL,pair TEXT NOT NULL,until_us INTEGER NOT NULL,"
    "basis TEXT NOT NULL,PRIMARY KEY(sender,pair))",
    "CREATE TABLE barriers(request TEXT PRIMARY KEY,sender TEXT NOT NULL)",
)
_SCHEMA = {
    ("table", name): " ".join(sql.casefold().split())
    for name, sql in zip(("metadata", "jobs", "backoffs", "barriers"), _SCHEMA_SQL, strict=True)
}
_SCHEMA.update(
    {
        ("index", "sqlite_autoindex_" + name + "_1"): None
        for name in ("metadata", "jobs", "backoffs", "barriers")
    }
)
JOB_KEYS = {
    "request_id",
    "action_identity",
    "sender_ref",
    "message_class",
    "pair_ref",
    "enqueued_us",
    "expires_us",
    "authorization_expires_us",
}
ROW_KEYS = {
    "job",
    "state",
    "outcome",
    "code",
    "next_us",
    "arx_state",
    "lease_ref",
    "lease_expires_us",
    "release_pending",
    "ledger_pending",
}
STATES = {"pending", "reserving", "admitting", "dispatching", "terminal"}
ARX_STATES = {"none", "unavailable", "denied", "reserved", "release_unknown", "released"}


def instant(value):
    delta = utc(value) - _EPOCH
    if not 2000 <= value.year <= 2099:
        raise Refusal("clock_unavailable")
    return (delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds


def timestamp(value):
    return _EPOCH + timedelta(microseconds=value)


def encoded(value):
    return json.dumps(
        value, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False
    )


def job(value):
    if type(value) is not dict or set(value) != JOB_KEYS:
        raise Refusal("invalid_fields")
    for name in ("request_id", "action_identity"):
        reference(value[name])
    for name in ("sender_ref", "pair_ref"):
        if value[name] is not None:
            reference(value[name])
    if type(value["message_class"]) is not str or value["message_class"] not in CLASSES:
        raise Refusal("invalid_fields")
    for name in ("enqueued_us", "expires_us", "authorization_expires_us"):
        if type(value[name]) is not int or not 0 <= value[name] <= 2**53 - 1:
            raise Refusal("invalid_fields")
    if not value["enqueued_us"] < value["expires_us"] <= value["enqueued_us"] + 172800_000000:
        raise Refusal("invalid_fields")
    return value


def row(value):
    if type(value) is not dict or set(value) != ROW_KEYS:
        raise Refusal("invalid_fields")
    job(value["job"])
    if (
        type(value["state"]) is not str
        or value["state"] not in STATES
        or type(value["arx_state"]) is not str
        or value["arx_state"] not in ARX_STATES
        or type(value["next_us"]) is not int
        or not 0 <= value["next_us"] <= 2**53 - 1
        or type(value["release_pending"]) is not bool
        or type(value["ledger_pending"]) is not bool
        or value["outcome"] is not None
        and (type(value["outcome"]) is not str or value["outcome"] not in OUTCOMES)
        or (value["state"] == "terminal") != (value["outcome"] is not None)
    ):
        raise Refusal("invalid_fields")
    for name in ("code", "lease_ref"):
        if value[name] is not None:
            reference(value[name])
    if value["lease_expires_us"] is not None and (
        type(value["lease_expires_us"]) is not int
        or not 0 <= value["lease_expires_us"] <= 2**53 - 1
    ):
        raise Refusal("invalid_fields")
    if len(encoded(value)) > 4096:
        raise Refusal("pacing_capacity")
    return value


@dataclass(frozen=True)
class QueueProfile:
    max_jobs: int = 4096
    max_backoffs: int = 4096
    disk_budget_bytes: int = 8 * 1024**2

    def metadata(self):
        if (
            type(self.max_jobs) is not int
            or not 1 <= self.max_jobs <= 65536
            or type(self.max_backoffs) is not int
            or not 1 <= self.max_backoffs <= 65536
            or type(self.disk_budget_bytes) is not int
            or not 4 * 1024**2 <= self.disk_budget_bytes <= 32 * 1024**2
        ):
            raise Refusal("invalid_fields")
        return {
            "max_jobs": self.max_jobs,
            "max_backoffs": self.max_backoffs,
            "disk_budget_bytes": self.disk_budget_bytes,
            "max_row_bytes": 4096,
            "reserve_bytes": 524288,
            "page_budget_divisor": 4,
        }


@dataclass(repr=False)
class _Owner:
    configuration: tuple
    parent: tuple
    files: dict
    poisoned: bool = False
    closed: bool = False


def _files(owner, *, initializing=False):
    _, path, _, _, profile_text, _ = owner.configuration
    if _identity(path.parent, directory=True) != owner.parent:
        raise Refusal("storage_path_rebound")
    if Path(str(path) + "-journal").exists() or Path(str(path) + "-journal").is_symlink():
        raise Refusal("invalid_storage")
    size = 0
    for suffix, old in tuple(owner.files.items()):
        target = Path(str(path) + suffix)
        try:
            info = target.lstat()
        except FileNotFoundError:
            if old is not None:
                raise Refusal("storage_path_rebound") from None
            continue
        current = _identity(target)
        if old is None and initializing:
            owner.files[suffix] = current
        elif current != old:
            raise Refusal("storage_path_rebound")
        size += info.st_size
    if size > json.loads(profile_text)["disk_budget_bytes"]:
        raise Refusal("pacing_capacity")
    return size


def _owner(store):
    owner = _OWNERS.get(store)
    if (
        owner is None
        or owner.closed
        or owner.poisoned
        or store._configuration is not owner.configuration
        or store.db is not owner.configuration[0]
        or store.path is not owner.configuration[1]
        or store.queue_id != owner.configuration[2]
        or store.profile is not owner.configuration[3]
        or type(store.profile) is not QueueProfile
        or encoded(QueueProfile.metadata(store.profile)) != owner.configuration[4]
        or store.clock is not owner.configuration[5]
    ):
        raise Refusal("binding_denied")
    _files(owner)
    return owner


def _checkpoint(store, owner):
    _owner(store)
    result = owner.configuration[0].execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
    _owner(store)
    if result[0] != 0:
        raise Refusal("storage_checkpoint_busy")


def _limits(store, owner):
    db, _, queue_id, _, profile_text, _ = owner.configuration
    databases = db.execute("PRAGMA database_list").fetchall()
    _owner(store)
    if any(
        name not in {"main", "temp"}
        or name == "main"
        and filename != str(owner.configuration[1])
        or name == "temp"
        and filename != ""
        for _number, name, filename in databases
    ) or not any(name == "main" for _number, name, _filename in databases):
        raise Refusal("invalid_storage")
    temporary = db.execute("SELECT count(*) FROM sqlite_temp_master").fetchone()[0]
    _owner(store)
    if temporary:
        raise Refusal("invalid_storage")
    meta = dict(db.execute("SELECT key,value FROM metadata"))
    _owner(store)
    if (
        set(meta) != {"format", "queue_id", "profile", "last_clock"}
        or meta["format"] != FORMAT
        or meta["queue_id"] != queue_id
        or meta["profile"] != profile_text
        or str(int(meta["last_clock"])) != meta["last_clock"]
        or not 0 <= int(meta["last_clock"]) <= 2**53 - 1
    ):
        raise Refusal("invalid_storage")
    schema = {
        (r[0], r[1]): None if r[2] is None else " ".join(r[2].casefold().split())
        for r in db.execute("SELECT type,name,sql FROM sqlite_master")
    }
    _owner(store)
    if schema != _SCHEMA:
        raise Refusal("invalid_storage")
    profile = json.loads(profile_text)
    page_size = db.execute("PRAGMA page_size").fetchone()[0]
    maximum = (profile["disk_budget_bytes"] - 524288) // (4 * page_size)
    for name, expected in (
        ("max_page_count", maximum),
        ("cache_spill", 0),
        ("synchronous", 2),
        ("fullfsync", 1),
        ("wal_autocheckpoint", 1),
        ("journal_mode", "wal"),
    ):
        actual = db.execute("PRAGMA " + name).fetchone()[0]
        _owner(store)
        if actual != expected:
            raise Refusal("binding_denied")
    counts = []
    for table, cap in (
        ("jobs", profile["max_jobs"]),
        ("backoffs", profile["max_backoffs"]),
        ("barriers", profile["max_jobs"]),
    ):
        count = db.execute("SELECT count(*) FROM " + table).fetchone()[0]
        _owner(store)
        if count > cap:
            raise Refusal("pacing_capacity")
        counts.append(count)
    invalid = db.execute(
        "SELECT count(*) FROM jobs WHERE typeof(request)!='text' "
        "OR length(request) NOT BETWEEN 1 AND 128 OR typeof(payload)!='text' "
        "OR length(CAST(payload AS BLOB))>4096"
    ).fetchone()[0]
    _owner(store)
    if invalid:
        raise Refusal("invalid_storage")
    for sender, pair, until_us, basis in db.execute("SELECT * FROM backoffs"):
        reference(sender)
        if pair:
            reference(pair)
        if (
            type(pair) is not str
            or type(until_us) is not int
            or not 0 <= until_us <= 2**53 - 1
            or basis not in {"authenticated_arx", "verified_provider", "local_policy"}
        ):
            raise Refusal("invalid_storage")
    _owner(store)
    for request, sender in db.execute("SELECT request,sender FROM barriers").fetchall():
        reference(request)
        reference(sender)
        found = db.execute("SELECT payload FROM jobs WHERE request=?", (request,)).fetchone()
        _owner(store)
        if found is None:
            raise Refusal("invalid_storage")
        value = row(json.loads(found[0]))
        if sender != (value["job"]["sender_ref"] or "unknown-global") or not (
            value["state"] == "dispatching" or value["outcome"] == "unknown"
        ):
            raise Refusal("invalid_storage")
    return meta, counts


def _backoff(db, sender, pair, until_us, basis):
    for value in (sender, basis):
        reference(value)
    if basis not in {"authenticated_arx", "verified_provider", "local_policy"}:
        raise Refusal("invalid_fields")
    if type(pair) is not str:
        raise Refusal("invalid_fields")
    if pair:
        reference(pair)
    if type(until_us) is not int or not 0 <= until_us <= 2**53 - 1:
        raise Refusal("invalid_fields")
    old = db.execute(
        "SELECT until_us,basis FROM backoffs WHERE sender=? AND pair=?", (sender, pair)
    ).fetchone()
    if old and old[0] >= until_us:
        until_us, basis = old
    db.execute(
        "INSERT INTO backoffs VALUES(?,?,?,?) ON CONFLICT(sender,pair) DO UPDATE "
        "SET until_us=excluded.until_us,basis=excluded.basis",
        (sender, pair, until_us, basis),
    )


@contextmanager
def _transaction(store):
    owner = _owner(store)
    db = owner.configuration[0]
    _checkpoint(store, owner)
    _limits(store, owner)
    committed = False
    try:
        db.execute("BEGIN IMMEDIATE")
        _owner(store)
        now = instant(owner.configuration[5]())
        meta, _ = _limits(store, owner)
        if now < int(meta["last_clock"]):
            raise Refusal("clock_unavailable")
        yield db, now
        _owner(store)
        db.execute("UPDATE metadata SET value=? WHERE key='last_clock'", (str(now),))
        _owner(store)
        _limits(store, owner)
        committed = True  # An attempted COMMIT is an uncertain durability boundary.
        db.execute("COMMIT")
        _owner(store)
        _checkpoint(store, owner)
    except BaseException as error:
        if committed:
            owner.poisoned = True
        if db.in_transaction:
            db.execute("ROLLBACK")
        if isinstance(error, sqlite3.Error):
            raise Refusal(
                "pacing_capacity"
                if getattr(error, "sqlite_errorcode", None) == sqlite3.SQLITE_FULL
                else "storage_write_failed"
            ) from None
        raise


class QueueStore:
    def __init__(self, path, *, queue_id, profile, clock, expect_existing=False):
        if (
            type(profile) is not QueueProfile
            or type(expect_existing) is not bool
            or not callable(clock)
        ):
            raise Refusal("invalid_fields")
        profile_text = encoded(QueueProfile.metadata(profile))
        reference(queue_id)
        path = Path(path).absolute()
        parent = _identity(path.parent, directory=True)
        fd = os.open(
            path, os.O_RDWR | os.O_NOFOLLOW | (0 if expect_existing else os.O_CREAT), 0o600
        )
        try:
            expected = _identity(path)
            info = os.fstat(fd)
            if (info.st_dev, info.st_ino) != expected[:2]:
                raise Refusal("storage_path_rebound")
        finally:
            os.close(fd)
        db = sqlite3.connect(path.as_uri() + "?mode=rw", uri=True, isolation_level=None, timeout=5)
        self.db, self.path, self.queue_id, self.profile, self.clock = (
            db,
            path,
            queue_id,
            profile,
            clock,
        )
        self._configuration = db, path, queue_id, profile, profile_text, clock
        owner = _Owner(self._configuration, parent, {"": expected, "-wal": None, "-shm": None})
        _OWNERS[self] = owner
        try:
            _files(owner, initializing=True)
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            _files(owner, initializing=True)
            _owner(self)
            if (
                expect_existing
                and not tables
                or tables
                and tables != {"metadata", "jobs", "backoffs", "barriers"}
            ):
                raise Refusal("invalid_storage")
            if tables and db.execute("PRAGMA journal_mode").fetchone()[0] != "wal":
                raise Refusal("invalid_storage")
            if db.execute("PRAGMA journal_mode=WAL").fetchone()[0] != "wal":
                raise Refusal("storage_write_failed")
            for pragma in (
                "synchronous=FULL",
                "fullfsync=ON",
                "cache_spill=OFF",
                "wal_autocheckpoint=1",
            ):
                db.execute("PRAGMA " + pragma)
            page_size = db.execute("PRAGMA page_size").fetchone()[0]
            maximum = (profile.disk_budget_bytes - 524288) // (4 * page_size)
            if db.execute(f"PRAGMA max_page_count={maximum}").fetchone()[0] > maximum:
                raise Refusal("pacing_capacity")
            if not tables:
                db.execute("BEGIN IMMEDIATE")
                for sql in _SCHEMA_SQL:
                    db.execute(sql)
                db.executemany(
                    "INSERT INTO metadata VALUES(?,?)",
                    (
                        ("format", FORMAT),
                        ("queue_id", queue_id),
                        ("profile", profile_text),
                        ("last_clock", str(instant(clock()))),
                    ),
                )
                db.execute("COMMIT")
            _files(owner, initializing=True)
            _limits(self, owner)
            QueueStore.rows(self)
            with _transaction(self) as (original, _now):
                for value in QueueStore.rows(self):
                    if value["state"] not in {"pending", "terminal"}:
                        dispatched = value["state"] == "dispatching"
                        value.update(
                            state="terminal",
                            outcome="unknown" if dispatched else "definitively_not_sent",
                            code="pacing_interrupted",
                            release_pending=value["arx_state"] != "none",
                            ledger_pending=value["state"] in {"admitting", "dispatching"},
                        )
                        original.execute(
                            "UPDATE jobs SET payload=? WHERE request=?",
                            (encoded(row(value)), value["job"]["request_id"]),
                        )
        except BaseException:
            db.close()
            owner.closed = True
            raise

    def now(self):
        owner = _owner(self)
        meta, _ = _limits(self, owner)
        now = instant(owner.configuration[5]())
        if now < int(meta["last_clock"]):
            raise Refusal("clock_unavailable")
        return now

    def rows(self):
        owner = _owner(self)
        records = (
            owner.configuration[0]
            .execute("SELECT request,payload FROM jobs ORDER BY rowid")
            .fetchall()
        )
        _owner(self)
        barriers = {
            v[0] for v in owner.configuration[0].execute("SELECT request FROM barriers").fetchall()
        }
        _owner(self)
        result = []
        for request, payload in records:
            if type(payload) is not str or len(payload.encode()) > 4096:
                raise Refusal("invalid_storage")
            value = row(json.loads(payload))
            if encoded(value) != payload or value["job"]["request_id"] != request:
                raise Refusal("invalid_storage")
            if (value["state"] == "dispatching" or value["outcome"] == "unknown") != (
                request in barriers
            ):
                raise Refusal("invalid_storage")
            result.append(value)
        return result

    def put(self, value):
        value = json.loads(encoded(row(value)))
        with _transaction(self) as (db, _now):
            old = db.execute(
                "SELECT payload FROM jobs WHERE request=?", (value["job"]["request_id"],)
            ).fetchone()
            _owner(self)
            if old is not None:
                if encoded(row(json.loads(old[0]))["job"]) != encoded(value["job"]):
                    raise Refusal("operation_conflict")
                return False
            db.execute("INSERT INTO jobs VALUES(?,?)", (value["job"]["request_id"], encoded(value)))
            if value["state"] == "dispatching" or value["outcome"] == "unknown":
                db.execute(
                    "INSERT INTO barriers VALUES(?,?)",
                    (value["job"]["request_id"], value["job"]["sender_ref"] or "unknown-global"),
                )
        return True

    def change(self, request_id, *, expected, backoff=None, **changes):
        with _transaction(self) as (db, _now):
            records = [v for v in QueueStore.rows(self) if v["job"]["request_id"] == request_id]
            if len(records) != 1 or records[0]["state"] not in expected:
                raise Refusal("operation_conflict")
            value = records[0]
            if "job" in changes:
                raise Refusal("binding_denied")
            if value["state"] == "terminal" and any(
                key not in {"release_pending", "ledger_pending", "arx_state"} for key in changes
            ):
                raise Refusal("binding_denied")
            value.update(changes)
            if value["state"] == "dispatching" or value["outcome"] == "unknown":
                db.execute(
                    "INSERT OR IGNORE INTO barriers VALUES(?,?)",
                    (request_id, value["job"]["sender_ref"] or "unknown-global"),
                )
            elif value["state"] == "terminal":
                db.execute("DELETE FROM barriers WHERE request=?", (request_id,))
            if backoff is not None:
                _backoff(db, *backoff)
            db.execute(
                "UPDATE jobs SET payload=? WHERE request=?", (encoded(row(value)), request_id)
            )
        return value

    def backoff(self, sender, pair, until_us, basis):
        with _transaction(self) as (db, _now):
            _backoff(db, sender, pair, until_us, basis)

    def reconcile_ledger_outcome(self, request_id, ledger, attempt):
        """Resolve UNKNOWN only from the original sealed local attempt record."""
        from .whatsapp_pacing_ledger import AttemptHandle, PacingLedger

        if type(ledger) is not PacingLedger or type(attempt) is not AttemptHandle:
            raise Refusal("binding_denied")
        original = PacingLedger._attempt(ledger, attempt)
        if attempt.request_id != request_id:
            raise Refusal("binding_denied")
        state = PacingLedger.attempt_status(ledger, attempt)
        if state not in {"accepted", "definitively_not_sent"}:
            return
        with _transaction(self) as (db, _now):
            records = [v for v in QueueStore.rows(self) if v["job"]["request_id"] == request_id]
            if (
                len(records) != 1
                or records[0]["state"] != "terminal"
                or records[0]["outcome"] != "unknown"
                or records[0]["job"]["action_identity"] != original[5]
            ):
                raise Refusal("binding_denied")
            value = records[0]
            value.update(
                outcome=state,
                code=None,
                ledger_pending=False,
                release_pending=value["arx_state"] != "none",
            )
            db.execute(
                "UPDATE jobs SET payload=? WHERE request=?", (encoded(row(value)), request_id)
            )
            db.execute("DELETE FROM barriers WHERE request=?", (request_id,))

    def backoffs(self, sender, pair):
        owner = _owner(self)
        # An unidentified physical sender is not a distinct account. Match
        # fallback uncertainty in both directions, as the shared ledger does:
        # unknown callers respect every sender, verified callers their own plus
        # unknown. Two independently verified senders remain separate.
        sender_match = "(?='unknown-global' OR sender IN (?,'unknown-global'))"
        blocked = (
            owner.configuration[0]
            .execute("SELECT 1 FROM barriers WHERE " + sender_match + " LIMIT 1", (sender, sender))
            .fetchone()
        )
        _owner(self)
        if blocked:
            return 2**53 - 1, "dispatch_unknown"
        records = (
            owner.configuration[0]
            .execute(
                "SELECT until_us,basis FROM backoffs WHERE " + sender_match + " AND pair IN ('',?)",
                (sender, sender, pair),
            )
            .fetchall()
        )
        _owner(self)
        if any(type(r[0]) is not int or type(r[1]) is not str for r in records):
            raise Refusal("invalid_storage")
        return max(records, default=(0, None), key=lambda r: r[0])

    def status(self):
        owner = _owner(self)
        _, counts = _limits(self, owner)
        return {
            "jobs": counts[0],
            "backoffs": counts[1],
            "dispatch_barriers": counts[2],
            "disk_bytes": _files(owner),
            "profile": json.loads(owner.configuration[4]),
        }

    def close(self):
        owner = _OWNERS.get(self)
        if owner is not None and not owner.closed:
            owner.configuration[0].close()
            owner.closed = True
