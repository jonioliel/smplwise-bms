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
import weakref
from collections import deque
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, TypeVar

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
GUARDED_MIGRATIONS = ("0036", "0037")  # verified by their objects at start-up, whatever schema_migrations says (Database.ensure_migration_objects)
BUSY_TIMEOUT_S = 10.0  # how long a writer waits for the write lock before "database is locked"
SLOW_HOLD_S = float(os.environ.get("SW_DB_SLOW_HOLD_S", "3"))  # a longer write-lock hold is logged with its holder
# the janitor truncates the WAL file once it grew past this (at a quiet moment); also SQLite's journal_size_limit
WAL_TRUNCATE_BYTES = int(float(os.environ.get("SW_DB_WAL_TRUNCATE_MB", "64")) * 1024 * 1024)
CHECKPOINT_BUSY_S = 0.5  # how long a TRUNCATE checkpoint waits for readers before it gives up until the next tick
SCRUB_READER_WAIT_S = 0.5  # Database.scrub_wal: how long the TRUNCATE checkpoint after a wipe waits for open readers (then: pending, retried)
# SW_DB_WRITE_GATE=0 turns the FIFO write gate off (SQLite's own busy handler alone, as before 2026-09-29): an
# operational escape hatch and the A/B switch of the stress tests
WRITE_GATE = os.environ.get("SW_DB_WRITE_GATE", "1") != "0"
# DB-CONN-POOL-2343: connection reuse (see the "Connection reuse" section below and docs/changes/DB-CONN-POOL-2343.md).
# SW_DB_CONN_POOL=0 (or the add-on option db_conn_pool: false) is the kill switch: every connection() / write_aside()
# opens and closes its own SQLite connection again, exactly as before.
CONN_POOL = os.environ.get("SW_DB_CONN_POOL", "1") != "0"
# idle connections kept per database file and durability class; more leases than this at once are opened as before
# and closed when they end
POOL_IDLE_DURABLE = max(0, int(os.environ.get("SW_DB_POOL_IDLE", "6")))
POOL_IDLE_MIRROR = max(0, int(os.environ.get("SW_DB_POOL_IDLE_MIRROR", "2")))
# Reuse is opted into per handle: the app's own long-lived Database (main.create_app). A handle made for one job - the backup
# drill's scratch copy, the demo-file builder, a restore check, the energy store - opens per transaction as before, so
# nothing keeps its files open after the job (a scratch directory is removed right after). SW_DB_POOL_EVERY_HANDLE=1 makes
# every handle pool (the DB test set runs both ways with it).
POOL_EVERY_HANDLE = os.environ.get("SW_DB_POOL_EVERY_HANDLE") == "1"

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
        # Database.scrub_wal: the file whose WAL still holds a wiped value (a TRUNCATE checkpoint was busy), None when clean;
        # scrub_gen counts the scrub requests so a retry only clears the mark it actually covered
        self.scrub_path: Path | None = None
        self.scrub_gen = 0

    def acquire(self, timeout: float, on_slow: Callable[[], None] | None = None, slow_after: float = 1.0, priority: bool = False) -> object | None:
        """A token once it is this caller's turn, None after `timeout` seconds (the caller reports "database is locked").
        on_slow: run once (outside the lock) when the turn has not come after `slow_after` seconds; the caller keeps its
        place in the queue meanwhile - it waits on the same entry, never re-queues at the end.
        priority (SEC246 L3: the record a device command waits for before it is sent): queued ahead of every ordinary
        waiter - behind the current holder and behind earlier priority waiters (FIFO among themselves). Human-rate only."""
        deadline = time.monotonic() + max(0.0, timeout)
        with self._lock:
            if self._holder is None and not self._queue:
                self._holder = object()
                return self._holder
            entry: list[Any] = [threading.Event(), None, priority]
            if priority:
                i = 0
                while i < len(self._queue) and self._queue[i][2]:
                    i += 1
                self._queue.insert(i, entry)
            else:
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


def _scrub_attempt(gate: WriteGate, path: Path, reader_wait_s: float, label: str) -> bool:
    """One TRUNCATE checkpoint for Database.scrub_wal (the caller holds the gate or the gate is off). Clears the pending
    mark when it passed and no newer scrub was requested meanwhile."""
    with gate._lock:
        gen = gate.scrub_gen
    conn = sqlite3.connect(path, timeout=reader_wait_s, isolation_level=None, check_same_thread=False)
    try:
        try:
            busy, frames, done = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        except sqlite3.OperationalError as exc:
            if not is_busy(exc):
                raise
            busy, frames, done = 1, None, None
    finally:
        conn.close()
    if busy:
        log.info("WAL scrub (%s): busy (%s of %s frames); pending, retried when a transaction ends", label, done, frames)
        return False
    with gate._lock:
        if gate.scrub_gen == gen:
            gate.scrub_path = None
    return True


def _retry_scrub(gate: WriteGate | None) -> None:
    """A transaction of this process just ended: finish a pending scrub_wal on its file, never waiting - not for the
    gate (a writer in this process: its own end retries), not for a reader (its end retries). Never raises."""
    if gate is None or gate.scrub_path is None:
        return
    token = gate.try_acquire() if WRITE_GATE else None
    if WRITE_GATE and token is None:
        return
    try:
        path = gate.scrub_path
        if path is not None and (WRITE_GATE or not _holders):
            _scrub_attempt(gate, path, 0.0, "retry")
    except Exception:  # noqa: BLE001 - housekeeping after a transaction never fails the caller
        log.debug("WAL scrub retry failed", exc_info=True)
    finally:
        if token is not None:
            gate.release(token)


_conn_gate: dict[int, WriteGate] = {}  # id(conn) -> its database's gate (connection() / write_aside())
_gate_tokens: dict[int, tuple[WriteGate, object, sqlite3.Connection]] = {}  # id(conn) -> the gate token it holds while it writes
_stray_logged: set[int] = set()
_beginning: set[int] = set()  # id(conn) from before it takes the gate until BEGIN IMMEDIATE returned
# WRITE-GATE-EVENTS-2341: id(conn) from the moment its COMMIT / ROLLBACK starts until the gate is handed on. SQLite
# clears its "in a transaction" flag when COMMIT STARTS - before the WAL write and the fsync of a FULL commit - so a
# holder that is committing reads as outside any transaction; the stray detector must not take it for a manual COMMIT.
_ending: set[int] = set()


@contextmanager
def _finishing(conn: sqlite3.Connection) -> Iterator[None]:
    """Mark the connection as ending its transaction (COMMIT / ROLLBACK, then handing the gate on)."""
    key = id(conn)
    _ending.add(key)
    try:
        yield
    finally:
        _ending.discard(key)


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


SQLITE_FULL = getattr(sqlite3, "SQLITE_FULL", 13)


def is_storage_full(exc: BaseException) -> bool:
    """T035: SQLite could not write because the data disk is full (SQLITE_FULL, "database or disk is full")."""
    if not isinstance(exc, sqlite3.OperationalError):
        return False
    return getattr(exc, "sqlite_errorcode", None) == SQLITE_FULL or "disk is full" in str(exc).lower()


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


def _settled(key: int, entry: tuple[WriteGate, object, sqlite3.Connection]) -> bool:
    """The connection holds this very token and is neither starting nor finishing its transaction. The order matters:
    a finishing holder drops its token before it leaves _ending, so one that left _ending is seen without the token."""
    return key not in _ending and key not in _beginning and _gate_tokens.get(key) is entry


def _report_stray_holders(gate: WriteGate, waiter: str) -> None:
    """A writer has waited a second: is the gate held by a connection outside any transaction? That is a manual
    COMMIT (conn.execute("COMMIT") instead of db.commit_now) - the token stays with a connection that no longer writes,
    and every writer queues behind it until the connection closes. Logged once per connection, as an error."""
    for key, entry in list(_gate_tokens.items()):
        if entry[0] is not gate or key in _stray_logged:
            continue
        # the snapshot may be stale and the holder runs on meanwhile: it is a stray only when it holds the same token,
        # is neither starting (BEGIN IMMEDIATE may wait for another process) nor finishing (COMMIT clears the flag before
        # the commit is written) both before and after the flag is read, and the flag says no transaction
        if not _settled(key, entry):
            continue
        try:
            open_tx = entry[2].in_transaction
        except sqlite3.ProgrammingError:  # closed: its gate is handed on by _drop_hold, never kept
            continue
        if not open_tx and _settled(key, entry):
            _stray_logged.add(key)
            label = _MODES.get(key, ("write", None, "?"))[2]
            log.error("write gate held by %s outside a transaction (a manual COMMIT? use db.commit_now); %s waits", label, waiter)


def _begin_immediate(conn: sqlite3.Connection, label: str, wait_s: float | None = None, priority: bool = False) -> None:
    """Take the write lock: this process's queue first (the gate of the connection's database), then SQLite's lock
    (BEGIN IMMEDIATE, which still waits busy_timeout for a writer in another process). `wait_s` (at most BUSY_TIMEOUT_S)
    shortens the whole wait for a caller that would rather fail fast than act late, and `priority` queues it ahead of the
    ordinary writers (SEC246 L3: a device command's record, see WriteGate.acquire)."""
    started = time.monotonic()
    budget = BUSY_TIMEOUT_S if wait_s is None else max(0.0, min(float(wait_s), BUSY_TIMEOUT_S))
    from .services import wiskey_call_budget as call_budget
    if call_budget.active():
        budget = call_budget.remaining(budget)
    full_ms = int(conn.execute("PRAGMA busy_timeout").fetchone()[0])  # the connection's own (BUSY_TIMEOUT_S unless a caller set less)
    gate = _conn_gate.get(id(conn)) if WRITE_GATE else None
    key = id(conn)
    # "beginning" from before the token is recorded: a stray check between recording it and BEGIN IMMEDIATE (or while
    # BEGIN waits for a writer in another process) sees a connection that is starting to write, not a manual COMMIT
    _beginning.add(key)
    try:
        if gate is not None and key not in _gate_tokens:
            token = gate.acquire(budget, on_slow=lambda: _report_stray_holders(gate, label), priority=priority)
            if token is None:
                with _stats_lock:
                    LOCK_STATS["gate_timeouts"] += 1
                raise _busy(label, sqlite3.OperationalError("database is locked"))
            _gate_tokens[key] = (gate, token, conn)
        # one attempt never waits longer than its budget (BUSY_TIMEOUT_S) in total: SQLite gets what the gate queue left of it
        remaining_ms = max(1, int((budget - (time.monotonic() - started)) * 1000))
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
            if shortened:
                try:
                    conn.execute(f"PRAGMA busy_timeout={full_ms}")
                except sqlite3.Error:
                    pass
    finally:
        _beginning.discard(key)
    now = time.monotonic()
    _holders[id(conn)] = (label, now)
    _note_wait(now - started, label)


# WisKey M12 policy B, slice S3 (docs/changes/WISKEY-RC7-ADOPT-2331.md): a few callers must keep an outside resource - the WisKey
# generation publication fence - until the write transaction that changed the decision has ENDED (committed or rolled back),
# including a caller's own long transaction such as the add-on start-up. on_transaction_end() registers such a release; it runs
# once, right after the COMMIT / ROLLBACK and before the write gate is handed on (or when the lease closes, whatever happened).
_tx_end: dict[int, list[Callable[[], None]]] = {}


def on_transaction_end(conn: sqlite3.Connection, fn: Callable[[], None]) -> bool:
    """Run `fn` once when this connection's open write transaction ends. False (nothing registered) for a connection that is not
    a connection() / write_aside() lease of this module or that is outside a transaction: the caller then releases at once."""
    try:
        open_tx = conn.in_transaction
    except sqlite3.ProgrammingError:  # closed
        return False
    if id(conn) not in _conn_gate or not open_tx:
        return False
    _tx_end.setdefault(id(conn), []).append(fn)
    return True


def _run_tx_end(conn: sqlite3.Connection) -> None:
    for fn in _tx_end.pop(id(conn), ()):
        try:
            fn()
        except Exception:  # noqa: BLE001 - a release never fails the commit that already happened
            log.exception("end-of-transaction release failed")


def _end_hold(conn: sqlite3.Connection) -> None:
    _run_tx_end(conn)
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
    _run_tx_end(conn)
    _holders.pop(id(conn), None)
    _release_gate(conn)
    _stray_logged.discard(id(conn))
    _ending.discard(id(conn))
    _conn_gate.pop(id(conn), None)


def _finish(conn: sqlite3.Connection, sql: str) -> None:
    """COMMIT / ROLLBACK when a transaction is still open (release() may already have committed it)."""
    with _finishing(conn):
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


# ---------------------------------------------------------------- connection reuse (DB-CONN-POOL-2343)
#
# Opening a connection is cheap; its FIRST statement is not: SQLite parses the whole schema (well over a thousand
# tables, indexes and triggers) into the connection, ~40-50 ms on the workstation and more on an SD-card host. Every
# request used to pay it. Now a connection that ends cleanly goes back to an idle list of its Database (per file and
# durability class) and the next connection() / write_aside() reuses it - schema parsed, statements prepared.
#
# What a caller gets is a lease (PooledConnection): a sqlite3.Connection subclass that forwards to the pooled connection
# and is cut off from it when the lease ends. So the per-request semantics stay what they were:
# - every lease is a new object: id(conn) - the key of _MODES, the gate tokens, the holders and every per-request cache -
#   names one lease, never two requests;
# - a reference kept past the end (a background callback, a streaming body that outlives its dependency) fails with
#   "Cannot operate on a closed database", as a closed connection did, instead of running inside another request;
# - every cursor of the lease is closed when it ends: a half-read SELECT would otherwise keep its read snapshot open on
#   the pooled connection (stale reads for the next lease, and no TRUNCATE checkpoint behind it).
# The write gate and the transaction rules are untouched: a lease begins, commits, rolls back and hands the gate on through
# the same functions; it is handed back only after connection() / write_aside() ended its transaction, and only when it
# is back in exactly the state _open() leaves (no transaction, query_only off, busy timeout, foreign keys, synchronous,
# row factory) - otherwise it is closed. Closed, never pooled: a lease that touched connection-wide state (functions,
# authorizer, trace callback, executescript, ATTACH or TEMP objects ...), one that ended in a database error other than
# "busy" or in an interrupt, one opened on a file that is no longer the handle's (demo mode) or was replaced on disk,
# and every idle connection after a migration or a schema change.


def _file_ident(path: Path) -> tuple[int, int] | None:
    """The identity of the database file on disk; a pooled connection is only reused on the file it was opened on."""
    try:
        st = os.stat(path)
    except OSError:
        return None
    return (st.st_dev, st.st_ino)


_LEASE_DIRECT = frozenset({"execute", "executemany", "cursor", "commit", "rollback", "close", "in_transaction", "total_changes",
                           "row_factory", "text_factory", "isolation_level", "autocommit", "interrupt", "getlimit", "getconfig"})


class PooledConnection(sqlite3.Connection):
    """A lease of a pooled connection (see above). Deliberately never runs sqlite3.Connection.__init__: anything not
    forwarded here fails loudly ("Base Connection.__init__ not called") instead of acting on a second, empty connection."""

    def __init__(self, owner: "Database", raw: sqlite3.Connection, key: tuple[str, bool], ident: tuple[int, int] | None, gen: int) -> None:  # noqa: D107
        self._raw: sqlite3.Connection | None = raw
        self._owner = owner
        self._key = key
        self._ident = ident
        self._gen = gen
        self._cursors: list[weakref.ref] = []
        self._tainted = False  # connection-wide state was touched: closed at the end, never pooled
        self._spoiled = False  # ended in an error that may have left the connection unusable

    def _live(self) -> sqlite3.Connection:
        raw = self._raw
        if raw is None:
            raise sqlite3.ProgrammingError("Cannot operate on a closed database.")
        return raw

    def _track(self, cur: sqlite3.Cursor) -> sqlite3.Cursor:
        refs = self._cursors
        refs.append(weakref.ref(cur))
        if len(refs) > 256:
            self._cursors = [r for r in refs if r() is not None]
        return cur

    def execute(self, *args: Any, **kwargs: Any) -> sqlite3.Cursor:  # type: ignore[override]
        return self._track(self._live().execute(*args, **kwargs))

    def executemany(self, *args: Any, **kwargs: Any) -> sqlite3.Cursor:  # type: ignore[override]
        return self._track(self._live().executemany(*args, **kwargs))

    def cursor(self, *args: Any, **kwargs: Any) -> sqlite3.Cursor:  # type: ignore[override]
        return self._track(self._live().cursor(*args, **kwargs))

    def commit(self) -> None:
        self._live().commit()

    def rollback(self) -> None:
        self._live().rollback()

    def interrupt(self) -> None:
        self._live().interrupt()

    def getlimit(self, *args: Any) -> int:  # type: ignore[override]
        return self._live().getlimit(*args)

    def getconfig(self, *args: Any) -> bool:  # type: ignore[override]
        return self._live().getconfig(*args)

    def close(self) -> None:
        """End the lease: whatever is still open is rolled back (as closing did), and the connection goes back to the
        pool or is closed. Idempotent."""
        self._owner._end_lease(self)

    @property
    def in_transaction(self) -> bool:  # type: ignore[override]
        return self._live().in_transaction

    @property
    def total_changes(self) -> int:  # type: ignore[override]
        return self._live().total_changes

    @property
    def row_factory(self) -> Any:  # type: ignore[override]
        return self._live().row_factory

    @row_factory.setter
    def row_factory(self, value: Any) -> None:  # reset when the lease ends
        self._live().row_factory = value

    @property
    def text_factory(self) -> Any:  # type: ignore[override]
        return self._live().text_factory

    @text_factory.setter
    def text_factory(self, value: Any) -> None:  # reset when the lease ends
        self._live().text_factory = value

    @property
    def isolation_level(self) -> Any:  # type: ignore[override]
        return self._live().isolation_level

    @isolation_level.setter
    def isolation_level(self, value: Any) -> None:
        self._tainted = True
        self._live().isolation_level = value

    @property
    def autocommit(self) -> Any:  # type: ignore[override]
        return self._live().autocommit

    @autocommit.setter
    def autocommit(self, value: Any) -> None:
        self._tainted = True
        self._live().autocommit = value

    def __enter__(self) -> "PooledConnection":
        self._live().__enter__()
        return self

    def __exit__(self, *exc: Any) -> Any:
        return self._live().__exit__(*exc)


def _tainting(name: str) -> Callable[..., Any]:
    def call(self: PooledConnection, *args: Any, **kwargs: Any) -> Any:
        self._tainted = True
        return getattr(self._live(), name)(*args, **kwargs)

    call.__name__ = name
    return call


def _forwarded(name: str) -> property:
    return property(lambda self: getattr(self._live(), name))


for _name in dir(sqlite3.Connection):
    if _name.startswith("_") or _name in _LEASE_DIRECT:
        continue
    _attr = sqlite3.Connection.__dict__.get(_name)
    if callable(_attr):  # create_function, set_authorizer, executescript, backup, blobopen ...: forwarded, the lease is closed after
        setattr(PooledConnection, _name, _tainting(_name))
    else:  # the exception classes (conn.Error ...)
        setattr(PooledConnection, _name, _forwarded(_name))
del _name, _attr

POOL_STATS: dict[str, int] = {"opened": 0, "reused": 0, "pooled": 0, "closed": 0, "discarded": 0, "invalidated": 0}
POOL_DISCARDS: dict[str, int] = {}  # discarded leases by reason (tainted, error, open_transaction, state, schema_change, stale, off ...)
_pool_stats_lock = threading.Lock()


def _pool_count(key: str, n: int = 1) -> None:
    with _pool_stats_lock:
        POOL_STATS[key] += n


def pool_stats() -> dict[str, Any]:
    """Counters of connection reuse (/health): opened - new SQLite connections (each parses the schema), reused - leases
    served from the pool, pooled - leases handed back, closed - leases over the idle limit, discarded - leases closed because of
    their state or an error, invalidated - idle connections dropped (migration, schema change, file swap)."""
    with _pool_stats_lock:
        out: dict[str, Any] = dict(POOL_STATS)
        out["discarded_by"] = dict(POOL_DISCARDS)
    out["enabled"] = CONN_POOL
    return out


def _spoil(conn: sqlite3.Connection, exc: BaseException | None = None) -> None:
    """The lease ended in an error: one that may leave the connection itself unusable closes it instead of pooling it
    (exc None: always). A busy database ("database is locked") and ordinary exceptions leave a clean connection after
    the rollback; a database error, an interrupt or a cancellation do not."""
    if isinstance(conn, PooledConnection) and (exc is None or not isinstance(exc, Exception) or (isinstance(exc, sqlite3.Error) and not is_busy(exc))):
        conn._spoiled = True


def _close_quietly(conns: list[sqlite3.Connection]) -> None:
    for c in conns:
        try:
            c.close()
        except sqlite3.Error:
            pass


class Database:
    def __init__(self, path: Path, *, pool: bool | None = None):
        """pool: reuse connections between transactions (DB-CONN-POOL-2343) - True for the app's long-lived handle; the
        default (None) follows SW_DB_POOL_EVERY_HANDLE, off unless a test run asks for it. The kill switch (CONN_POOL)
        turns it off for every handle."""
        self.path = path
        self.pool = POOL_EVERY_HANDLE if pool is None else pool
        self.touched: dict[str, float] = {}  # per-user last touch stamp (auth.touch_user throttle)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.gate = gate_for(self.path)
        # CR-READY96 (demo mode): the database file this handle serves can be swapped for a separate demo file while a demo runs (services/demo_mode.py).
        # Every holder of this handle (requests, workers) follows at once; connections opened before the swap finish on the file they opened.
        self.real_path = self.path
        self.demo = False
        self.demo_state: dict[str, Any] | None = None
        # DB-CONN-POOL-2343: idle connections by (file, durable), the file identity they were opened on, the schema
        # version they last saw, and a generation that every invalidation bumps (a lease of an older one is closed)
        self._pool_lock = threading.Lock()
        self._idle: dict[tuple[str, bool], list[sqlite3.Connection]] = {}
        self._idle_ident: dict[str, tuple[int, int] | None] = {}
        self._schema_seen: dict[str, int] = {}
        self._pool_gen = 0
        self._secure_delete: int | None = None  # what a new connection has (the build's default), restored on reuse

    def switch_path(self, path: Path, *, demo: bool) -> None:
        """Point this handle at another database file (the demo file, or back to the real one). The per-user touch cache restarts: it is keyed by user, not by file."""
        self.touched = {}
        self.path = path
        self.gate = gate_for(path)
        self.demo = demo
        self.invalidate_pool()  # idle connections of the previous file are closed (a lease still out closes when it ends)

    # ------------------------------------------------------------ connection reuse (DB-CONN-POOL-2343)

    def invalidate_pool(self) -> None:
        """Close every idle connection; leases still out are closed when they end (their generation is older)."""
        with self._pool_lock:
            self._pool_gen += 1
            idle = [c for lst in self._idle.values() for c in lst]
            self._idle.clear()
            self._idle_ident.clear()
            self._schema_seen.clear()
        if idle:
            _pool_count("invalidated", len(idle))
        _close_quietly(idle)

    def close_pool(self) -> None:
        """Shutdown (and tests): no idle connection keeps the database files open."""
        self.invalidate_pool()

    def _lease(self, durable: bool = True) -> sqlite3.Connection:
        """A connection for connection() / write_aside(): a lease of a pooled one, or - with the pool switched off - a
        connection of its own, exactly as before."""
        if not (CONN_POOL and self.pool):
            return self._open() if durable else self._open(durable=False)
        path = self.path
        key = (str(path), durable)
        ident = _file_ident(path)
        raw = None
        stale: list[sqlite3.Connection] = []
        with self._pool_lock:
            gen = self._pool_gen
            if self._idle_ident.get(key[0], ident) != ident:  # the file was replaced on disk: nothing idle is reused
                stale = [c for k, lst in self._idle.items() if k[0] == key[0] for c in lst]
                for k in [k for k in self._idle if k[0] == key[0]]:
                    del self._idle[k]
                self._schema_seen.pop(key[0], None)
            self._idle_ident[key[0]] = ident
            idle = self._idle.get(key)
            if idle:
                raw = idle.pop()
        if stale:
            _pool_count("invalidated", len(stale))
            _close_quietly(stale)
        if raw is None:
            raw = self._open() if durable else self._open(durable=False)
            _pool_count("opened")
            if self._secure_delete is None:
                try:
                    self._secure_delete = int(raw.execute("PRAGMA secure_delete").fetchone()[0])
                except sqlite3.Error:
                    pass
        else:
            try:
                raw.execute(f"PRAGMA busy_timeout={int(BUSY_TIMEOUT_S * 1000)}")  # what _open() sets, at today's value
            except sqlite3.Error:
                _close_quietly([raw])
                raw = self._open() if durable else self._open(durable=False)
                _pool_count("opened")
            else:
                _pool_count("reused")
        return PooledConnection(self, raw, key, ident, gen)

    def _end_lease(self, lease: PooledConnection) -> None:
        raw = lease._raw
        if raw is None:
            return
        lease._raw = None  # from here on the lease is closed for everyone who still holds it
        refs, lease._cursors = lease._cursors, []
        why = "off" if not (CONN_POOL and self.pool) else "tainted" if lease._tainted else "error" if lease._spoiled else ""  # why it is not pooled
        keep = not why
        for ref in refs:
            cur = ref()
            if cur is not None:
                try:
                    cur.close()  # a half-read SELECT would keep its read snapshot on the pooled connection
                except sqlite3.Error:
                    keep, why = False, why or "cursor"
        schema: int | None = None
        try:
            if raw.in_transaction:
                # connection() / write_aside() always end their transaction: one still open here took an unusual path
                # (a failed COMMIT, a lease closed by hand) - rolled back, as closing did, and not reused
                keep, why = False, why or "open_transaction"
                raw.execute("ROLLBACK")
            if keep:
                keep = self._reset(raw, lease._key[1])
                if not keep:
                    why = "state"
                else:
                    schema = int(raw.execute("PRAGMA schema_version").fetchone()[0])
        except sqlite3.Error:
            keep, why = False, why or "error"
        if keep:
            path, cap = lease._key[0], (POOL_IDLE_DURABLE if lease._key[1] else POOL_IDLE_MIRROR)
            invalid: list[sqlite3.Connection] = []
            on_disk = _file_ident(Path(path))
            with self._pool_lock:
                seen = self._schema_seen.get(path)
                if seen is not None and schema != seen:
                    # a schema change (a migration, a runtime CREATE): SQLite would re-parse in every idle connection anyway;
                    # they are dropped, this one too, and leases still out are closed when they end (older generation)
                    self._pool_gen += 1
                    invalid = [c for k, lst in self._idle.items() if k[0] == path for c in lst]
                    for k in [k for k in self._idle if k[0] == path]:
                        del self._idle[k]
                    self._schema_seen[path] = schema  # type: ignore[assignment]
                    keep, why = False, "schema_change"
                elif lease._gen != self._pool_gen or path != str(self.path) or self._idle_ident.get(path) != lease._ident or on_disk != lease._ident:
                    keep, why = False, "stale"  # invalidated meanwhile, a file the handle no longer serves, or a file replaced on disk
                else:
                    self._schema_seen[path] = schema  # type: ignore[assignment]
                    idle = self._idle.setdefault(lease._key, [])
                    if len(idle) < cap:
                        idle.append(raw)
                        raw = None
            if invalid:
                _pool_count("invalidated", len(invalid))
                _close_quietly(invalid)
            if raw is None:
                _pool_count("pooled")
                return
        _pool_count("closed" if keep else "discarded")  # over the idle limit / not reusable
        if not keep:
            with _pool_stats_lock:
                POOL_DISCARDS[why] = POOL_DISCARDS.get(why, 0) + 1
        try:
            raw.close()
        except sqlite3.Error:
            pass

    def _reset(self, raw: sqlite3.Connection, durable: bool) -> bool:
        """Back to the state _open() leaves; False when the connection carries anything that cannot be reset (an attached
        database, TEMP objects) - it is closed instead."""
        if raw.in_transaction:
            return False
        raw.row_factory = sqlite3.Row
        raw.text_factory = str
        if raw.isolation_level is not None:
            return False
        names = [r[1] for r in raw.execute("PRAGMA database_list").fetchall()]
        if any(n not in ("main", "temp") for n in names):
            return False
        if "temp" in names and raw.execute("SELECT 1 FROM temp.sqlite_master LIMIT 1").fetchone() is not None:
            return False
        raw.execute("PRAGMA query_only=0")  # read mode and release() switch it on
        raw.execute(f"PRAGMA busy_timeout={int(BUSY_TIMEOUT_S * 1000)}")  # set again when it is leased
        raw.execute("PRAGMA foreign_keys=ON")
        raw.execute(f"PRAGMA synchronous={'FULL' if durable else 'NORMAL'}")
        if self._secure_delete is None:
            return False  # the default is unknown: nothing to compare with, not reused
        raw.execute(f"PRAGMA secure_delete={self._secure_delete}")  # bridge_keys / wiskey_camera switch it on for their deletes
        return not raw.in_transaction

    def _open(self, durable: bool = True) -> sqlite3.Connection:
        from .services import wiskey_call_budget as call_budget
        wait = call_budget.remaining(BUSY_TIMEOUT_S) if call_budget.active() else BUSY_TIMEOUT_S
        conn = sqlite3.connect(self.path, timeout=wait, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        # FULL: every commit is fsynced (a committed audit row survives a power cut); NORMAL for the mirror writes of
        # device data opened with durable=False (see the module docstring)
        conn.execute(f"PRAGMA synchronous={'FULL' if durable else 'NORMAL'}")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute(f"PRAGMA busy_timeout={max(1, int(wait * 1000))}")
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
        if applied:
            self.invalidate_pool()  # nothing parsed before the schema change is reused
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
            recorded = {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()} if "schema_migrations" in tables else set()
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
            # only when 0036 is recorded as applied: on a database below 0036 the migration itself adds the column
            if 36 in recorded and "ha_entities" in tables and "config_entry_id" not in {r[1] for r in conn.execute("PRAGMA table_info(ha_entities)").fetchall()}:
                conn.execute("ALTER TABLE ha_entities ADD COLUMN config_entry_id TEXT")
                added.append("ha_entities.config_entry_id")
        finally:
            conn.close()
        if added:
            self.invalidate_pool()  # nothing parsed before the schema change is reused
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
        conn = self._lease(durable)
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
        except BaseException as exc:
            _spoil(conn, exc)
            try:
                _finish(conn, "ROLLBACK")
            except sqlite3.Error:
                _spoil(conn)
            raise
        finally:
            _MODES.pop(id(conn), None)
            _ending.add(id(conn))  # closing: the gate, if still held, is handed on by _drop_hold right after
            try:
                conn.close()  # rolls back whatever is still open: the lock is free before the gate is handed on
            finally:
                _drop_hold(conn)
            _retry_scrub(self.gate)  # a wipe's TRUNCATE checkpoint this transaction kept busy (scrub_wal)

    @contextmanager
    def write_aside(self, label: str | None = None, wait_s: float | None = None, priority: bool = False) -> Iterator[sqlite3.Connection]:
        """A short write transaction of its own, for the few rows a read-mode request must still record. `wait_s`: the
        longest wait for the write lock (default BUSY_TIMEOUT_S), then "database is locked". `priority`: queued ahead of
        the ordinary writers (WriteGate.acquire) - only for the record a device command waits for before it is sent."""
        label = label or _caller(3)
        conn = self._lease()
        _conn_gate[id(conn)] = self.gate
        try:
            if wait_s is None and not priority:
                _begin_immediate(conn, label)
            else:
                _begin_immediate(conn, label, wait_s, priority)
            yield conn
            _finish(conn, "COMMIT")
        except BaseException as exc:
            _spoil(conn, exc)
            try:
                _finish(conn, "ROLLBACK")
            except sqlite3.Error:
                _spoil(conn)
            raise
        finally:
            _ending.add(id(conn))
            try:
                conn.close()
            finally:
                _drop_hold(conn)
            _retry_scrub(self.gate)

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
        _retry_scrub(self.gate)  # a pending scrub_wal (a wiped value still in the WAL) whatever the WAL size
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

    def scrub_wal(self, label: str = "scrub_wal", reader_wait_s: float = SCRUB_READER_WAIT_S) -> bool:
        """Push every committed page out of the WAL into the database file and cut the WAL to zero (a TRUNCATE checkpoint),
        for a caller that promises a wiped value is gone from the whole file set (H-07 retired bridge keys, TKWISECRYPT
        station passwords). True when the whole WAL was checkpointed now.

        Never inside a transaction: SQLite refuses a checkpoint on a connection with an open transaction ("database table
        is locked"), and connection() always begins one. Before the connection pool (DB-CONN-POOL-2343) that refusal was
        hidden - closing the last connection checkpointed and removed the WAL anyway; with pooled connections the file
        stays open, so the checkpoint must really run. Its own short connection (not a lease), under the write gate like a
        writer (at most BUSY_TIMEOUT_S); it waits at most `reader_wait_s` for open readers. A reader that holds a snapshot
        - often the caller's own read request - keeps the WAL busy: the scrub is then left PENDING on the file and retried,
        without waiting, each time a transaction of this process ends (connection(), write_aside(), release() - so before
        the caller's response is sent) and on the janitor's tick, until it passes."""
        gate = self.gate
        with gate._lock:
            gate.scrub_gen += 1  # a retry that started before this wipe must not clear the mark
            gate.scrub_path = self.path
        token = None
        if WRITE_GATE:
            token = gate.acquire(BUSY_TIMEOUT_S, on_slow=lambda: _report_stray_holders(gate, label))
            if token is None:
                log.info("WAL scrub (%s): the write gate stayed busy; pending, retried when a transaction ends", label)
                return False
        try:
            return _scrub_attempt(gate, self.path, reader_wait_s, label)
        finally:
            if token is not None:
                gate.release(token)

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
    with _finishing(conn):
        if open_tx:
            conn.execute("COMMIT")
        _end_hold(conn)  # hands the gate on
    conn.execute("PRAGMA query_only=1")
    db = database_of(conn)
    if db is not None:
        _retry_scrub(db.gate)  # before the response is sent: a wipe's checkpoint this request's snapshot kept busy (scrub_wal)


def commit_now(conn: sqlite3.Connection, *, keep_reading: bool = True) -> None:
    """Commit the connection's transaction in the middle of a request and hand the write lock on - THE way to commit
    by hand (a bare conn.execute("COMMIT") keeps this process's write gate, and every other writer queues until the
    connection closes; tests/test_db_gate.py forbids it outside db.py). keep_reading: continue in a deferred read
    transaction (nothing more may be written on the connection until it closes); False leaves it in autocommit."""
    with _finishing(conn):
        if conn.in_transaction:
            conn.execute("COMMIT")
        _end_hold(conn)
    if keep_reading:
        conn.execute("BEGIN")


def rollback_now(conn: sqlite3.Connection) -> None:
    """Drop the open transaction (if any) and hand the write lock on, without starting another one - THE way to roll back by
    hand (a bare conn.rollback() keeps this process's write gate; tests/test_db_gate.py forbids it outside db.py)."""
    if conn.in_transaction:
        conn.execute("ROLLBACK")
    _end_hold(conn)


def rollback_and_restart(conn: sqlite3.Connection) -> None:
    """Drop everything this write transaction wrote and start a fresh one (queued like any writer)."""
    with _finishing(conn):
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        _end_hold(conn)
    label = _MODES.get(id(conn), ("write", None, "restart"))[2]
    _begin_immediate(conn, label)


def get_setting(conn: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def get_settings_many(conn: sqlite3.Connection, keys: Iterable[str]) -> dict[str, str | None]:
    """The stored rows of `keys` in a few statements instead of one per key (PERF-HOME-DEVICES-2342: GET /settings read its
    ~520 keys one SELECT each). A key without a row is absent from the result, so `out.get(key, default)` answers exactly as
    get_setting(conn, key, default) does - a row holding NULL included (None either way)."""
    want = list(dict.fromkeys(keys))
    out: dict[str, str | None] = {}
    for i in range(0, len(want), 400):  # well under SQLite's bound-parameter limit of any supported build
        part = want[i : i + 400]
        out.update(conn.execute(f"SELECT key, value FROM settings WHERE key IN ({','.join('?' * len(part))})", part).fetchall())
    return out


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))


def permission_revision(conn: sqlite3.Connection) -> int:
    return int(get_setting(conn, "permission_revision", "1") or 1)


def bump_permission_revision(conn: sqlite3.Connection) -> int:
    rev = permission_revision(conn) + 1
    set_setting(conn, "permission_revision", str(rev))
    # CR-WISKEY-LEASE-REVOCATION-EVENT T1 (owner decision 2026-10-16, strict): ANY revision bump revokes every live capture lease,
    # with no re-check. Called here so no caller can forget it; the hook never touches the database and never raises.
    try:
        from .services import capture_lease

        capture_lease.on_authority_change("permission_revision", all=True)
    except Exception:  # noqa: BLE001 - a permission change never fails because of the lease hook
        log.exception("capture lease hook (permission_revision) failed")
    # CR-ARX-WISKEY-SHARED-IDENTITY 3.5 (owner answer 5): every decided external grant is RE-DECIDED against its approver's current
    # permissions (revoked only when the approver is no longer authorised) - a flag for the grant worker, no database work here.
    try:
        from .services import access_grants

        access_grants.on_permission_change()
    except Exception:  # noqa: BLE001 - a permission change never fails because of the grant hook
        log.exception("access grants hook (permission_revision) failed")
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
