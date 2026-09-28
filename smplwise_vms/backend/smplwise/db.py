"""SQLite access with versioned migrations (files in ./migrations, applied in order, recorded in
schema_migrations). One connection per request; WAL journal; foreign keys enforced.

Write-lock discipline (round-10 "database is locked" storm, see docs/operations/TEST_ROUND_RESULTS_2026-09-26_ROUND10_HE.md):
SQLite has ONE write lock. A request connection takes it at BEGIN IMMEDIATE and every other writer waits up to
BUSY_TIMEOUT_S for it, then fails with "database is locked". So nothing slow may run while it is held: device calls
(NVR, go2rtc, Home Assistant) go through unlocked(), notifications are sent after the commit, and the request's
transaction is committed before the response body is sent (release_request, wired in main.py). Every hold is
measured; a hold longer than SLOW_HOLD_S and every busy failure is logged with who held the lock (lock_stats())."""
from __future__ import annotations

import datetime as dt
import logging
import os
import random
import re
import secrets
import sqlite3
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator, TypeVar

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
BUSY_TIMEOUT_S = 10.0  # how long a writer waits for the write lock before "database is locked"
SLOW_HOLD_S = float(os.environ.get("SW_DB_SLOW_HOLD_S", "3"))  # a longer write-lock hold is logged with its holder

log = logging.getLogger("smplwise.db")
T = TypeVar("T")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def new_id() -> str:
    return secrets.token_hex(8)


# The token charset of the product's own row ids (new_id: 16 lowercase hex) widened to a path-safe superset - letters,
# digits, '_' and '-', no dots, no separators - so an id that reaches a file path (skins/<floor id>/) can never walk out
# of its folder. Checked where an id from outside (a restored archive) or from the DB builds a path.
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


_MODES: dict[int, tuple[str, "Database", str]] = {}


def read_mode(conn: sqlite3.Connection) -> bool:
    """True for a request connection opened with mode="read" (deferred, query-only)."""
    return _MODES.get(id(conn), ("write", None, ""))[0] == "read"


def database_of(conn: sqlite3.Connection) -> "Database | None":
    return _MODES.get(id(conn), ("write", None, ""))[1]


# ---------------------------------------------------------------- write-lock accounting

_holders: dict[int, tuple[str, float]] = {}  # id(conn) -> (label, monotonic time the write lock was taken)
_stats_lock = threading.Lock()
LOCK_STATS: dict[str, Any] = {"holds": 0, "slow_holds": 0, "max_hold_s": 0.0, "max_hold_by": None, "busy_errors": 0, "last_busy": None}


def lock_stats() -> dict[str, Any]:
    """A copy of the write-lock counters (/health and the contention load test)."""
    with _stats_lock:
        return dict(LOCK_STATS)


def is_busy(exc: BaseException) -> bool:
    text = str(exc).lower()
    return isinstance(exc, sqlite3.OperationalError) and ("locked" in text or "busy" in text)


def _caller(depth: int) -> str:
    try:
        f = sys._getframe(depth)
    except ValueError:
        return "?"
    return f"{Path(f.f_code.co_filename).stem}.{f.f_code.co_name}"


def _note_busy(label: str) -> None:
    now = time.monotonic()
    # dict.copy() is atomic; iterating the live dict while other threads take / release the lock would raise
    holder = min(_holders.copy().values(), key=lambda h: h[1], default=None)
    with _stats_lock:
        LOCK_STATS["busy_errors"] += 1
        LOCK_STATS["last_busy"] = {"at": now_iso(), "waiter": label, "holder": holder[0] if holder else None,
                                   "held_s": round(now - holder[1], 1) if holder else None}
    if holder:
        log.warning("database is locked for %s after %.0f s: the write lock is held by %s for %.1f s", label, BUSY_TIMEOUT_S, holder[0], now - holder[1])
    else:
        log.warning("database is locked for %s after %.0f s (no in-process holder: another process or a checkpoint)", label, BUSY_TIMEOUT_S)


def _begin_immediate(conn: sqlite3.Connection, label: str) -> None:
    try:
        conn.execute("BEGIN IMMEDIATE")
    except sqlite3.OperationalError as exc:
        if is_busy(exc):
            try:
                _note_busy(label)
            except Exception:  # noqa: BLE001 - accounting must never replace the busy error the callers retry on
                log.exception("write-lock accounting failed")
        raise
    _holders[id(conn)] = (label, time.monotonic())


def _end_hold(conn: sqlite3.Connection) -> None:
    held = _holders.pop(id(conn), None)
    if held is None:
        return
    label, since = held
    secs = time.monotonic() - since
    with _stats_lock:
        LOCK_STATS["holds"] += 1
        if secs > LOCK_STATS["max_hold_s"]:
            LOCK_STATS["max_hold_s"] = round(secs, 3)
            LOCK_STATS["max_hold_by"] = label
        if secs > SLOW_HOLD_S:
            LOCK_STATS["slow_holds"] += 1
    if secs > SLOW_HOLD_S:
        log.warning("write lock held %.1f s by %s (other writers wait; device calls belong in unlocked())", secs, label)


def _finish(conn: sqlite3.Connection, sql: str) -> None:
    """COMMIT / ROLLBACK when a transaction is still open (release() may already have committed it)."""
    try:
        if conn.in_transaction:
            conn.execute(sql)
    except sqlite3.OperationalError as exc:
        if "no transaction is active" not in str(exc):  # committed by release() a moment earlier: nothing left to do
            raise
    finally:
        if not conn.in_transaction:
            _end_hold(conn)


def retry_locked(fn: Callable[[], T], *, what: str = "write", attempts: int = 3, base_s: float = 0.5) -> T:
    """Run a whole write transaction; a busy database (the lock held past BUSY_TIMEOUT_S) is retried with jittered
    backoff, not dropped. `fn` must open and close its own transaction, so a retry starts from a clean rollback."""
    for i in range(attempts):
        try:
            return fn()
        except sqlite3.OperationalError as exc:
            if not is_busy(exc) or i == attempts - 1:
                raise
            delay = min(4.0, base_s * (2 ** i)) * (0.5 + random.random())
            log.warning("%s: database busy, retry %d/%d in %.1f s", what, i + 1, attempts - 1, delay)
            time.sleep(delay)
    raise AssertionError("unreachable")


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.touched: dict[str, float] = {}  # per-user last touch stamp (auth.touch_user throttle)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _open(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=BUSY_TIMEOUT_S, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        # synchronous stays FULL (the default): a committed audit row survives a power cut. The 2026-09-29 contention
        # measurements showed no gain from NORMAL here - per-commit fsync was never what held the lock.
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute(f"PRAGMA busy_timeout={int(BUSY_TIMEOUT_S * 1000)}")
        return conn

    def migrate(self) -> list[int]:
        applied: list[int] = []
        conn = self._open()
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
            done = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
            for file in sorted(MIGRATIONS_DIR.glob("*.sql")):
                version = int(file.name.split("_", 1)[0])
                if version in done:
                    continue
                # executescript() commits any open transaction first, so the migration carries its own
                # BEGIN/COMMIT and records itself inside the same transaction.
                sql = file.read_text(encoding="utf-8")
                conn.executescript(f"BEGIN;\n{sql}\nINSERT INTO schema_migrations(version, applied_at) VALUES({version}, '{now_iso()}');\nCOMMIT;")
                applied.append(version)
        finally:
            conn.close()
        return applied

    @contextmanager
    def connection(self, mode: str = "write", label: str | None = None) -> Iterator[sqlite3.Connection]:
        """One transaction per request. Expected API errors (403, 409 …) still commit so that the
        audit row describing the refusal is kept; anything unexpected rolls back.

        mode="write" (default): BEGIN IMMEDIATE takes the single write lock up front (honouring busy_timeout).
        A deferred BEGIN that reads first and writes later fails at once with "database is locked"
        (SQLITE_BUSY_SNAPSHOT) whenever another request committed in between, so writers never start deferred.
        mode="read": a deferred, query-only transaction — WAL readers run concurrently with the writer and with
        each other. Anything such a request must still write (an audit row for a refusal, the throttled user
        touch, the one-time bootstrap) goes through write_aside(), a short IMMEDIATE transaction of its own.
        `label` names the holder in the slow-hold / busy logs (default: the calling function)."""
        from .errors import ApiError

        label = label or _caller(3)
        conn = self._open()
        _MODES[id(conn)] = (mode, self, label)
        try:
            if mode == "read":
                conn.execute("PRAGMA query_only=1")
                conn.execute("BEGIN")
            else:
                _begin_immediate(conn, label)
            yield conn
            _finish(conn, "COMMIT")
        except ApiError:
            _finish(conn, "COMMIT")
            raise
        except BaseException:
            try:
                _finish(conn, "ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            _MODES.pop(id(conn), None)
            _holders.pop(id(conn), None)
            conn.close()

    @contextmanager
    def write_aside(self, label: str | None = None) -> Iterator[sqlite3.Connection]:
        """A short write transaction of its own, for the few rows a read-mode request must still record."""
        label = label or _caller(3)
        conn = self._open()
        try:
            _begin_immediate(conn, label)
            yield conn
            _finish(conn, "COMMIT")
        except BaseException:
            try:
                _finish(conn, "ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            _holders.pop(id(conn), None)
            conn.close()

    def checkpoint(self) -> dict[str, Any]:
        """Idle housekeeping (janitor): a PASSIVE checkpoint only - it never takes the write lock and never waits for a
        reader, so it cannot queue writers (a TRUNCATE would block new writers while it waits)."""
        wal = self.path.with_name(self.path.name + "-wal")
        size = wal.stat().st_size if wal.exists() else 0
        conn = sqlite3.connect(self.path, timeout=0.2, isolation_level=None, check_same_thread=False)
        try:
            try:
                busy, frames, done = conn.execute("PRAGMA wal_checkpoint(PASSIVE)").fetchone()
            except sqlite3.OperationalError as exc:
                if not is_busy(exc):
                    raise
                return {"mode": "PASSIVE", "wal_bytes": size, "busy": True}
            return {"mode": "PASSIVE", "wal_bytes": size, "busy": bool(busy), "frames": frames, "checkpointed": done}
        finally:
            conn.close()


def release(conn: sqlite3.Connection) -> None:
    """Commit the request's transaction now (before its response is sent); the rest of the request runs without a
    transaction, and the closing connection() finds nothing left to commit. A failed commit raises here, so the client
    gets an error instead of a success for a change that was not stored. A connection already closed (its request
    raised, and the dependency committed or rolled back before the error response) is left alone. The connection is
    query-only afterwards: a later write on it (a streaming body, a background callback) fails loudly instead of
    silently running in autocommit."""
    try:
        open_tx = conn.in_transaction
    except sqlite3.ProgrammingError:  # closed
        return
    if open_tx:
        conn.execute("COMMIT")
    _end_hold(conn)
    conn.execute("PRAGMA query_only=1")


def get_setting(conn: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))


def permission_revision(conn: sqlite3.Connection) -> int:
    return int(get_setting(conn, "permission_revision", "1") or 1)


def bump_permission_revision(conn: sqlite3.Connection) -> int:
    rev = permission_revision(conn) + 1
    set_setting(conn, "permission_revision", str(rev))
    return rev

@contextmanager
def unlocked(conn: sqlite3.Connection) -> Iterator[None]:
    """Release the request's write lock around a network-bound phase (NVR search/snapshot, go2rtc, the HA
    bridge): commits what was written so far, runs the block in autocommit mode (reads only, please) and
    starts a fresh IMMEDIATE transaction for the rest of the request. Without this a slow device call
    holds SQLite's single write lock for seconds and every other worker hits "database is locked"."""
    if not conn.in_transaction:
        yield
        return
    conn.execute("COMMIT")
    _end_hold(conn)
    try:
        yield
    finally:
        if read_mode(conn):
            conn.execute("BEGIN")
        else:
            # the device has acted by now: a busy database is waited out a few times rather than failing the request at
            # once; callers whose device call must never go unrecorded commit a row before the call (two-phase)
            label = _MODES.get(id(conn), ("write", None, "unlocked"))[2]
            retry_locked(lambda: _begin_immediate(conn, label), what=f"{label}: re-lock after the device call")
