"""SQLite access with versioned migrations (files in ./migrations, applied in order, recorded in
schema_migrations). One connection per request; WAL journal; foreign keys enforced.

Write-lock discipline (round-10 "database is locked" storm, see docs/operations/TEST_ROUND_RESULTS_2026-09-26_ROUND10_HE.md):
SQLite has ONE write lock. A request connection takes it at BEGIN IMMEDIATE and every other writer waits up to
BUSY_TIMEOUT_S for it, then fails with "database is locked". So nothing slow may run while it is held: device calls
(NVR, go2rtc, Home Assistant) go through unlocked(), notifications are sent after the commit, and the request's
transaction is committed before the response body is sent (release_request, wired in main.py). Every hold is
measured; a hold longer than SLOW_HOLD_S and every busy failure is logged with who held the lock (lock_stats()).

One writer at a time, in arrival order (2026-09-29): every write transaction of this process first takes the database
file's WriteGate - a FIFO queue in front of SQLite's lock - and only then BEGIN IMMEDIATE. SQLite's own busy handler
does not queue: a waiter sleeps and re-tries (1, 2, 5 … 100 ms steps), and under a steady stream of short commits it
loses re-try after re-try to writers that arrived later (tests/test_db_lock_storm.py: writes waited up to 4 s behind
holds of at most 1.1 s); on slower storage the same unfairness can reach the busy timeout - "database is locked" with
no long holder at all. The gate
hands the lock to the oldest waiter the moment it is released. It waits at most
BUSY_TIMEOUT_S and then fails exactly like SQLite ("database is locked"), so every caller and retry keeps working;
SQLite's busy timeout still covers another process (a backup tool, the soak harness).

Durability classes: a connection is synchronous=FULL (every commit is fsynced: a committed audit row survives a power
cut) unless it is opened with durable=False - the high-rate mirror writes of data a device sends again: the Home
Assistant state and registry mirror (the next push / snapshot rewrites it) and events derived from recordings (the next
derive pass re-creates them). Those commit with synchronous=NORMAL: no fsync per commit (WAL: an add-on crash loses
nothing; a power cut can lose the last commits since the previous fsync). The HA state mirror's transaction also
appends ha_state_history rows (T041), which HA does not send again: on a power cut the last ~30 s of that history can
be lost - accepted for a ~40/s stream, noted at ha_sync.upsert_state. A transaction that may also write something
nobody sends again - an HA correlation event and its rule alerts - opens a FULL connection instead (the class is chosen
before BEGIN: SQLite refuses to change synchronous inside a transaction). NVR alerts are never re-sent, so the alert
stream writes FULL. On the SD card / eMMC
of a typical Home Assistant host an fsync takes milliseconds to tens of milliseconds, and ~40 HA state pushes a second
each paying one under the write lock is enough to saturate it."""
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
from collections import deque
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator, TypeVar

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
GUARDED_MIGRATIONS = ("0036", "0037")  # verified by their objects at start-up, whatever schema_migrations says (Database.ensure_migration_objects)
BUSY_TIMEOUT_S = 10.0  # how long a writer waits for the write lock before "database is locked"
SLOW_HOLD_S = float(os.environ.get("SW_DB_SLOW_HOLD_S", "3"))  # a longer write-lock hold is logged with its holder
# the janitor truncates the WAL file once it grew past this (at a quiet moment); also SQLite's journal_size_limit
WAL_TRUNCATE_BYTES = int(float(os.environ.get("SW_DB_WAL_TRUNCATE_MB", "64")) * 1024 * 1024)
CHECKPOINT_BUSY_S = 0.5  # how long a TRUNCATE checkpoint waits for readers before it gives up until the next tick
# SW_DB_WRITE_GATE=0 turns the FIFO write gate off (SQLite's own busy handler alone, as before 2026-09-29): an
# operational escape hatch and the A/B switch of the stress tests
WRITE_GATE = os.environ.get("SW_DB_WRITE_GATE", "1") != "0"

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


# ---------------------------------------------------------------- one writer at a time, in arrival order


class WriteGate:
    """A FIFO queue in front of SQLite's write lock, one per database file (see the module docstring). Not bound to a
    thread: a request's transaction is begun in one worker thread and committed in another (CommitBeforeSend).
    release() hands the gate straight to the oldest waiter and wakes only that one: no newcomer can overtake it, and
    the other waiters stay asleep (waking them all would make them fight the holder for the GIL on every release)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._holder: object | None = None
        self._queue: deque[list[Any]] = deque()  # [event, token handed over or None]

    def acquire(self, timeout: float, on_slow: Callable[[], None] | None = None, slow_after: float = 1.0) -> object | None:
        """A token once it is this caller's turn, None after `timeout` seconds (the caller reports "database is locked").
        on_slow: run once (outside the lock) when the turn has not come after `slow_after` seconds; the caller keeps its
        place in the queue meanwhile - it waits on the same entry, never re-queues at the end."""
        deadline = time.monotonic() + max(0.0, timeout)
        with self._lock:
            if self._holder is None and not self._queue:
                self._holder = object()
                return self._holder
            entry: list[Any] = [threading.Event(), None]
            self._queue.append(entry)
        try:
            if on_slow is not None and slow_after < timeout:
                if not entry[0].wait(slow_after):
                    try:
                        on_slow()
                    except Exception:  # noqa: BLE001 - a diagnostic must never cost the waiter its turn
                        log.exception("write gate: slow-wait callback failed")
            entry[0].wait(max(0.0, deadline - time.monotonic()))
        except BaseException:
            # interrupted while waiting: leave the queue, or hand on a turn that arrived meanwhile - never keep either
            with self._lock:
                if entry[1] is None:
                    self._queue.remove(entry)
                    handed = None
                else:
                    handed = entry[1]
            if handed is not None:
                self.release(handed)
            raise
        with self._lock:
            if entry[1] is None:  # timed out before its turn came
                self._queue.remove(entry)
            return entry[1]

    def try_acquire(self) -> object | None:
        """A token only when nobody holds the gate and nobody waits for it (the janitor's "quiet moment")."""
        with self._lock:
            if self._holder is None and not self._queue:
                self._holder = object()
                return self._holder
            return None

    def release(self, token: object) -> None:
        with self._lock:
            if self._holder is not token:
                return
            if self._queue:
                entry = self._queue.popleft()
                self._holder = entry[1] = object()
                entry[0].set()
            else:
                self._holder = None

    def state(self) -> dict[str, Any]:
        with self._lock:
            return {"held": self._holder is not None, "waiting": len(self._queue)}


_gates: dict[str, WriteGate] = {}
_gates_lock = threading.Lock()


def gate_for(path: Path) -> WriteGate:
    """The one gate of a database file, shared by every Database object that opens it (tests open several)."""
    key = os.path.normcase(str(Path(path).resolve()))
    with _gates_lock:
        gate = _gates.get(key)
        if gate is None:
            gate = _gates[key] = WriteGate()
        return gate


_conn_gate: dict[int, WriteGate] = {}  # id(conn) -> its database's gate (connection() / write_aside())
_gate_tokens: dict[int, tuple[WriteGate, object, sqlite3.Connection]] = {}  # id(conn) -> the gate token it holds while it writes
_stray_logged: set[int] = set()
_beginning: set[int] = set()  # id(conn) between taking the gate and BEGIN IMMEDIATE returning


def _release_gate(conn: sqlite3.Connection) -> None:
    held = _gate_tokens.pop(id(conn), None)
    if held is not None:
        held[0].release(held[1])


# ---------------------------------------------------------------- write-lock accounting

_holders: dict[int, tuple[str, float]] = {}  # id(conn) -> (label, monotonic time the write lock was taken)
_stats_lock = threading.Lock()
LOCK_STATS: dict[str, Any] = {"holds": 0, "slow_holds": 0, "max_hold_s": 0.0, "max_hold_by": None, "busy_errors": 0, "last_busy": None,
                              "gate_timeouts": 0, "waits_over_1s": 0, "max_wait_s": 0.0, "max_wait_by": None}
WAIT_WINDOW_S = 600  # max_wait_recent_s: the longest wait of the last ten minutes
_recent_waits: deque[tuple[int, float]] = deque()  # (minute, longest wait in that minute), oldest first


def _note_wait(waited: float, label: str) -> None:
    minute = int(time.monotonic() // 60)
    with _stats_lock:
        if waited > 1.0:
            LOCK_STATS["waits_over_1s"] += 1
        if waited > LOCK_STATS["max_wait_s"]:
            LOCK_STATS["max_wait_s"] = round(waited, 3)
            LOCK_STATS["max_wait_by"] = label
        if _recent_waits and _recent_waits[-1][0] == minute:
            if waited > _recent_waits[-1][1]:
                _recent_waits[-1] = (minute, waited)
        else:
            _recent_waits.append((minute, waited))
        while _recent_waits and _recent_waits[0][0] <= minute - WAIT_WINDOW_S // 60:
            _recent_waits.popleft()


def lock_stats() -> dict[str, Any]:
    """A copy of the write-lock counters (/health and the load tests). busy_errors: every "database is locked" (SQLite's
    busy timeout or the gate's); gate_timeouts: those of them that timed out in the gate queue; waits_over_1s: write
    transactions that waited more than a second to start; max_wait_recent_s: the longest wait of the last ten minutes."""
    minute = int(time.monotonic() // 60)
    with _stats_lock:
        out = dict(LOCK_STATS)
        out["max_wait_recent_s"] = round(max((w for m, w in _recent_waits if m > minute - WAIT_WINDOW_S // 60), default=0.0), 3)
        out["write_gate"] = WRITE_GATE
        return out


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


def _busy(label: str, exc: sqlite3.OperationalError) -> sqlite3.OperationalError:
    try:
        _note_busy(label)
    except Exception:  # noqa: BLE001 - accounting must never replace the busy error the callers retry on
        log.exception("write-lock accounting failed")
    return exc


def _report_stray_holders(gate: WriteGate, waiter: str) -> None:
    """A writer has waited a second: is the gate held by a connection outside any transaction? That is a manual
    COMMIT (conn.execute("COMMIT") instead of db.commit_now) - the token stays with a connection that no longer writes,
    and every writer queues behind it until the connection closes. Logged once per connection, as an error."""
    for key, (g, _tok, holder) in list(_gate_tokens.items()):
        if g is not gate or key in _stray_logged or key in _beginning:
            continue  # a holder still inside BEGIN IMMEDIATE (waiting for another process) is not a stray
        try:
            open_tx = holder.in_transaction
        except sqlite3.ProgrammingError:  # closed
            open_tx = False
        if not open_tx:
            _stray_logged.add(key)
            label = _MODES.get(key, ("write", None, "?"))[2]
            log.error("write gate held by %s outside a transaction (a manual COMMIT? use db.commit_now); %s waits", label, waiter)


def _begin_immediate(conn: sqlite3.Connection, label: str) -> None:
    """Take the write lock: this process's queue first (the gate of the connection's database), then SQLite's lock
    (BEGIN IMMEDIATE, which still waits busy_timeout for a writer in another process)."""
    started = time.monotonic()
    full_ms = int(conn.execute("PRAGMA busy_timeout").fetchone()[0])  # the connection's own (BUSY_TIMEOUT_S unless a caller set less)
    gate = _conn_gate.get(id(conn)) if WRITE_GATE else None
    if gate is not None and id(conn) not in _gate_tokens:
        token = gate.acquire(BUSY_TIMEOUT_S, on_slow=lambda: _report_stray_holders(gate, label))
        if token is None:
            with _stats_lock:
                LOCK_STATS["gate_timeouts"] += 1
            raise _busy(label, sqlite3.OperationalError("database is locked"))
        _gate_tokens[id(conn)] = (gate, token, conn)
    _beginning.add(id(conn))
    # one attempt never waits longer than BUSY_TIMEOUT_S in total: SQLite gets what the gate queue left of it
    remaining_ms = max(1, int((BUSY_TIMEOUT_S - (time.monotonic() - started)) * 1000))
    shortened = remaining_ms < full_ms
    try:
        if shortened:
            conn.execute(f"PRAGMA busy_timeout={remaining_ms}")
        conn.execute("BEGIN IMMEDIATE")
    except sqlite3.OperationalError as exc:
        _release_gate(conn)
        if is_busy(exc):
            _busy(label, exc)
        raise
    except BaseException:
        _release_gate(conn)
        raise
    finally:
        _beginning.discard(id(conn))
        if shortened:
            try:
                conn.execute(f"PRAGMA busy_timeout={full_ms}")
            except sqlite3.Error:
                pass
    now = time.monotonic()
    _holders[id(conn)] = (label, now)
    _note_wait(now - started, label)


def _end_hold(conn: sqlite3.Connection) -> None:
    _release_gate(conn)
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


def _drop_hold(conn: sqlite3.Connection) -> None:
    """The connection is closing: forget its hold and hand the gate on, whatever state the transaction ended in."""
    _holders.pop(id(conn), None)
    _release_gate(conn)
    _stray_logged.discard(id(conn))
    _conn_gate.pop(id(conn), None)


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
        self.gate = gate_for(self.path)

    def _open(self, durable: bool = True) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=BUSY_TIMEOUT_S, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        # FULL: every commit is fsynced (a committed audit row survives a power cut); NORMAL for the mirror writes of
        # device data opened with durable=False (see the module docstring)
        conn.execute(f"PRAGMA synchronous={'FULL' if durable else 'NORMAL'}")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute(f"PRAGMA busy_timeout={int(BUSY_TIMEOUT_S * 1000)}")
        conn.execute(f"PRAGMA journal_size_limit={WAL_TRUNCATE_BYTES}")  # a reset WAL is cut back to this size
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

    def ensure_migration_objects(self) -> list[str]:
        """Review M2: the start-up schema guard for migrations whose numbers other branches also used. A database that
        recorded 0036 / 0037 in schema_migrations from another numbering never runs ours, yet the alarm tables,
        `ha_entities.config_entry_id` and `user_prefs` must exist whatever the table of applied versions says. Checks the
        objects themselves and creates what is missing (idempotent: CREATE TABLE IF NOT EXISTS, the column only when
        absent); returns what it created, which the caller logs as a warning. Run after `migrate()`."""
        added: list[str] = []
        conn = self._open()
        try:
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
            for prefix in GUARDED_MIGRATIONS:
                for file in sorted(MIGRATIONS_DIR.glob(f"{prefix}_*.sql")):
                    sql = file.read_text(encoding="utf-8")
                    missing = [t for t in re.findall(r"^CREATE TABLE (?:IF NOT EXISTS )?(\w+)", sql, flags=re.M) if t not in tables]
                    if not missing:
                        continue
                    body = re.sub(r"^ALTER TABLE .*?;", "", sql, flags=re.M | re.S)  # the column is checked below
                    body = re.sub(r"^CREATE (TABLE|INDEX) (?!IF NOT EXISTS)", r"CREATE \1 IF NOT EXISTS ", body, flags=re.M)
                    conn.executescript(body)
                    added.extend(missing)
            if "ha_entities" in tables and "config_entry_id" not in {r[1] for r in conn.execute("PRAGMA table_info(ha_entities)").fetchall()}:
                conn.execute("ALTER TABLE ha_entities ADD COLUMN config_entry_id TEXT")
                added.append("ha_entities.config_entry_id")
        finally:
            conn.close()
        return added

    @contextmanager
    def connection(self, mode: str = "write", label: str | None = None, durable: bool = True) -> Iterator[sqlite3.Connection]:
        """One transaction per request. Expected API errors (403, 409 …) still commit so that the
        audit row describing the refusal is kept; anything unexpected rolls back.

        mode="write" (default): BEGIN IMMEDIATE takes the single write lock up front (honouring busy_timeout).
        A deferred BEGIN that reads first and writes later fails at once with "database is locked"
        (SQLITE_BUSY_SNAPSHOT) whenever another request committed in between, so writers never start deferred.
        mode="read": a deferred, query-only transaction — WAL readers run concurrently with the writer and with
        each other. Anything such a request must still write (an audit row for a refusal, the throttled user
        touch, the one-time bootstrap) goes through write_aside(), a short IMMEDIATE transaction of its own.
        `label` names the holder in the slow-hold / busy logs (default: the calling function).
        durable=False: a high-rate mirror write of device data the device sends again, committed with
        synchronous=NORMAL (see the module docstring); never for user actions or audit rows."""
        from .errors import ApiError

        label = label or _caller(3)
        conn = self._open() if durable else self._open(durable=False)
        _MODES[id(conn)] = (mode, self, label)
        _conn_gate[id(conn)] = self.gate
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
            try:
                conn.close()  # rolls back whatever is still open: the lock is free before the gate is handed on
            finally:
                _drop_hold(conn)

    @contextmanager
    def write_aside(self, label: str | None = None) -> Iterator[sqlite3.Connection]:
        """A short write transaction of its own, for the few rows a read-mode request must still record."""
        label = label or _caller(3)
        conn = self._open()
        _conn_gate[id(conn)] = self.gate
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
            try:
                conn.close()
            finally:
                _drop_hold(conn)

    def _wal_bytes(self) -> int:
        wal = self.path.with_name(self.path.name + "-wal")
        try:
            return wal.stat().st_size
        except OSError:
            return 0

    def checkpoint(self) -> dict[str, Any]:
        """Idle housekeeping (janitor, every 30 s). Always a PASSIVE checkpoint first: it never takes the write lock and
        never waits for a reader, so it cannot queue writers. Only when that PASSIVE pass reached the end of the WAL
        (checkpointed == frames: no reader holds an older snapshot), the WAL file is larger than WAL_TRUNCATE_BYTES and
        the moment is quiet - nobody in this process holds or waits for the write lock (the gate, and the holders when
        the gate is switched off) - a TRUNCATE checkpoint cuts the file to zero, under the gate, waiting at most
        CHECKPOINT_BUSY_S. Anything else is left to the next tick."""
        size = self._wal_bytes()
        conn = sqlite3.connect(self.path, timeout=0.2, isolation_level=None, check_same_thread=False)
        try:
            try:
                busy, frames, done = conn.execute("PRAGMA wal_checkpoint(PASSIVE)").fetchone()
            except sqlite3.OperationalError as exc:
                if not is_busy(exc):
                    raise
                return {"mode": "PASSIVE", "wal_bytes": size, "busy": True}
        finally:
            conn.close()
        passive = {"mode": "PASSIVE", "wal_bytes": size, "busy": bool(busy), "frames": frames, "checkpointed": done}
        if busy or size < WAL_TRUNCATE_BYTES or frames != done or _holders:
            return passive
        token = self.gate.try_acquire()
        if token is None:
            return passive
        try:
            if _holders:  # a writer with the gate switched off (SW_DB_WRITE_GATE=0) started meanwhile
                return passive
            return self._truncate(size)
        finally:
            self.gate.release(token)

    def _truncate(self, size: int) -> dict[str, Any]:
        started = time.monotonic()
        conn = sqlite3.connect(self.path, timeout=CHECKPOINT_BUSY_S, isolation_level=None, check_same_thread=False)
        try:
            try:
                busy, frames, done = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
            except sqlite3.OperationalError as exc:
                if not is_busy(exc):
                    raise
                busy, frames, done = 1, None, None
        finally:
            conn.close()
        out = {"mode": "TRUNCATE", "wal_bytes": size, "busy": bool(busy), "frames": frames, "checkpointed": done,
               "wal_bytes_after": self._wal_bytes(), "took_s": round(time.monotonic() - started, 3)}
        log.info("WAL checkpoint (TRUNCATE) at %.1f MB: %s", size / 1048576, "busy, next tick" if busy else f"{out['wal_bytes_after']} bytes left")
        return out


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
    _end_hold(conn)  # hands the gate on
    conn.execute("PRAGMA query_only=1")


def commit_now(conn: sqlite3.Connection, *, keep_reading: bool = True) -> None:
    """Commit the connection's transaction in the middle of a request and hand the write lock on - THE way to commit
    by hand (a bare conn.execute("COMMIT") keeps this process's write gate, and every other writer queues until the
    connection closes; tests/test_db_gate.py forbids it outside db.py). keep_reading: continue in a deferred read
    transaction (nothing more may be written on the connection until it closes); False leaves it in autocommit."""
    if conn.in_transaction:
        conn.execute("COMMIT")
    _end_hold(conn)
    if keep_reading:
        conn.execute("BEGIN")


def rollback_and_restart(conn: sqlite3.Connection) -> None:
    """Drop everything this write transaction wrote and start a fresh one (queued like any writer)."""
    if conn.in_transaction:
        conn.execute("ROLLBACK")
    _end_hold(conn)
    label = _MODES.get(id(conn), ("write", None, "restart"))[2]
    _begin_immediate(conn, label)


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
    holds SQLite's single write lock for seconds and every other worker hits "database is locked".
    Taking the lock back blocks (queue, busy timeout, retries): never use this on the event loop - an async handler
    with a write connection puts its slow phase in a sync helper run in the threadpool, or is a sync handler.
    When the block raised, that error stands: a busy database while taking the lock back is logged, not raised over it
    (the connection is then left without a transaction; the error path writes nothing more)."""
    if not conn.in_transaction:
        yield
        return
    commit_now(conn, keep_reading=False)
    try:
        yield
    except BaseException:
        try:
            _relock(conn)
        except sqlite3.OperationalError as relock_exc:
            if not is_busy(relock_exc):
                raise
            log.warning("%s: database busy while taking the lock back after a failed block; the block's error stands", _MODES.get(id(conn), ("write", None, "unlocked"))[2])
        raise
    _relock(conn)


def _relock(conn: sqlite3.Connection) -> None:
    if read_mode(conn):
        conn.execute("BEGIN")
    else:
        # the device has acted by now: a busy database is waited out a few times rather than failing the request at
        # once; callers whose device call must never go unrecorded commit a row before the call (two-phase)
        label = _MODES.get(id(conn), ("write", None, "unlocked"))[2]
        retry_locked(lambda: _begin_immediate(conn, label), what=f"{label}: re-lock after the device call")
