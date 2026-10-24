"""WKWRITE-295 (WisKey round 4, items 8-9 / Q02): the DURABLE lineage of Arx's WisKey people writes.

Every native people write (NATIVE_WRITE_V1.md) and every name_ref apply gets ONE intent row here, COMMITTED before any byte of the
mutation leaves Arx. The row keeps the exact original WisKey will be asked about after a lost answer (the full seven-field
`original`, encrypted), and its state moves forward only:

    intent  --begin_send-->  sending  --verified ACK-->  committed | refused
       |                        |
       |                        +--no verified answer / crash-->  unknown  --peer_receipts/resolve found-->  committed
       +--crash before send / proven not sent-->  not_sent

- `intent` -> `sending` is the ONLY door to the socket, and it opens once: no method sends for a row that is not in `intent`, and
  recovery turns every `intent` it finds into `not_sent` (crash window 1: proven nothing left Arx - the send marker was never
  committed). A recovered `sending` row is `unknown` (crash windows 2 and 3: the bytes may have left; WisKey may even have committed
  person + receipt - only the exact-original resolve can tell). UNKNOWN is never re-sent: there is no API that could.
- Writer scope / fencing / exclusive writer: a scope (repository + the service query owner) has ONE writer at a time
  (`writer_scope`: holder, fence, lease). Admitting an intent and opening the send door both check, in the same IMMEDIATE
  transaction, that this process still holds the scope at its fence; a writer that lost the scope (lease taken over, restore, a
  second process) is refused (`writer_fenced`) before any I/O. Verified FACTS (an ACK, a resolve answer) may still be recorded by a
  fenced writer - a fact about the original does not depend on who holds the pen. At most one in-flight intent per person.
- Outside the backup: this file is `<data>/wiskey_lineage/lineage.sqlite3`. An Arx archive never contains it (only main-database
  tables are exported and `.sqlite*` files are never restored) and the add-on's `backup_exclude` keeps it out of a Home Assistant
  backup. The `original` column is AES-256-GCM sealed with the per-install key in `keys/` (also never in a backup),
  associated data bound to the operation id.
- Restore and stale lineage: the main database holds an anchor (setting `wiskey.native_write.lineage_anchor`: the lineage
  generation id + the last intent sequence number; never exported, never restored from an archive). Opening compares the two:
    same generation, same sequence     -> ok
    main BEHIND the lineage            -> the main database was restored: every open intent becomes `unknown` (reason `restored`),
                                          every writer fence is bumped, the anchor is moved forward. Writes continue.
    lineage BEHIND the main database,
    or another generation              -> stale lineage (an old copy): open intents become `unknown`, NEW WRITES ARE REFUSED
                                          (`lineage_stale`) until an administrator re-initialises.
    lineage file missing, anchor set   -> missing lineage: NEW WRITES ARE REFUSED (`lineage_missing`); nothing is recreated
                                          silently. `reinitialise` starts a new generation and records which sequence range was lost.
- Retention: a row whose operation ENDED (committed, refused, not_sent, or an unknown an administrator closed) is deleted with its
  proof rows 30 days after it ended (`purge`). An open unknown is kept until it is resolved or closed.
- Proof rows (`proofs`): an append-only trail per operation (intent committed, send started, ack, recovery, resolve, restore,
  closure) with refs and codes only.

What this file never holds: a name, a PIN, a card number, a phone, a photo, a payload hash or length. The raw value lives only in
the signed command's parameters (services/wiskey_native_write.py), never here. Test-enforced by planted marker values.

Status (honest): implemented and tested against fakes and real SQLite files, including a real OS process exit of a child Python
process between the steps (tests/test_wkwrite_295_crash.py). Not wired to a router or the direct transport; nothing is installed or
live.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import socket
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Protocol

from . import connection_store

LINEAGE_DIRNAME = "wiskey_lineage"
LINEAGE_FILENAME = "lineage.sqlite3"
ANCHOR_SETTING = "wiskey.native_write.lineage_anchor"
FORMAT = "arx-wiskey-write-lineage.v1"
RETENTION = timedelta(days=30)
WRITER_LEASE = timedelta(seconds=30)
MAX_JSON_INT = 2 ** 53 - 1

KINDS = ("peer_write", "name_ref")
STATES = ("intent", "sending", "committed", "refused", "not_sent", "unknown")
TERMINAL = ("committed", "refused", "not_sent")
OPEN = ("intent", "sending", "unknown")
PROOF_KINDS = ("intent_committed", "send_started", "ack_committed", "ack_refused", "ack_lost", "not_sent", "recovered_before_send",
               "recovered_after_send", "resolve_found", "resolve_unknown", "restored_unknown", "stale_unknown", "closed_by_operator",
               "late_fact")

_REF = re.compile(r"[^\x00-\x1f\x7f]{1,128}")


class LineageError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def is_ref(value: Any) -> bool:
    return isinstance(value, str) and _REF.fullmatch(value) is not None


def is_count(value: Any) -> bool:
    return type(value) is int and 1 <= value <= MAX_JSON_INT


def _iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def process_holder() -> str:
    """This process's writer identity: host, pid and a random part (a restarted process is a new holder)."""
    return f"{socket.gethostname()[:40]}:{os.getpid()}:{secrets.token_hex(6)}"


# ---------------------------------------------------------------- the anchor in the main database

class Anchor(Protocol):
    def read(self) -> tuple[str, int] | None: ...

    def write(self, generation: str, seq: int) -> None: ...


class SettingsAnchor:
    """The anchor as one row of the main database's `settings` table, written on its OWN short connection (autocommit), so an
    intent commit never commits - or waits for - a request's open transaction."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)

    def _conn(self) -> sqlite3.Connection:
        c = sqlite3.connect(self.db_path, timeout=10, isolation_level=None)
        c.execute("PRAGMA busy_timeout=10000")
        return c

    def read(self) -> tuple[str, int] | None:
        c = self._conn()
        try:
            row = c.execute("SELECT value FROM settings WHERE key = ?", (ANCHOR_SETTING,)).fetchone()
        finally:
            c.close()
        if row is None:
            return None
        try:
            value = json.loads(row[0])
            gen, seq = value["generation"], value["seq"]
        except (ValueError, TypeError, KeyError):
            return ("invalid", -1)
        if not (isinstance(gen, str) and re.fullmatch(r"[0-9a-f]{32}", gen) and type(seq) is int and seq >= 0):
            return ("invalid", -1)
        return gen, seq

    def write(self, generation: str, seq: int) -> None:
        c = self._conn()
        try:
            c.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                      (ANCHOR_SETTING, json.dumps({"generation": generation, "seq": seq}, sort_keys=True)))
        finally:
            c.close()


# ---------------------------------------------------------------- the lineage file

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS writer_scope (
  scope        TEXT PRIMARY KEY,
  holder       TEXT NOT NULL,
  fence        INTEGER NOT NULL CHECK (fence >= 0),
  lease_until  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS intents (
  operation_id          TEXT PRIMARY KEY CHECK (length(operation_id) BETWEEN 1 AND 128),
  request_id            TEXT NOT NULL UNIQUE CHECK (length(request_id) BETWEEN 1 AND 128),
  scope                 TEXT NOT NULL,
  fence                 INTEGER NOT NULL,
  generation            TEXT NOT NULL,
  seq                   INTEGER NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('peer_write', 'name_ref')),
  command               TEXT NOT NULL,
  target_ref            TEXT,
  create_origin_ref     TEXT UNIQUE,
  revision_sent         INTEGER CHECK (revision_sent IS NULL OR revision_sent BETWEEN 1 AND 9007199254740991),
  sealed                TEXT NOT NULL,
  state                 TEXT NOT NULL CHECK (state IN ('intent', 'sending', 'committed', 'refused', 'not_sent', 'unknown')),
  outcome_code          TEXT,
  user_id_after         TEXT,
  person_revision_after INTEGER CHECK (person_revision_after IS NULL OR person_revision_after BETWEEN 1 AND 9007199254740991),
  created_at            TEXT NOT NULL,
  send_started_at       TEXT,
  settled_at            TEXT,
  ended_at              TEXT,
  closed_by             TEXT,
  CHECK (state <> 'committed' OR (user_id_after IS NOT NULL AND person_revision_after IS NOT NULL)),
  CHECK (kind <> 'peer_write' OR command <> 'users/create' OR (target_ref IS NULL AND create_origin_ref IS NOT NULL)),
  CHECK (create_origin_ref IS NULL OR command = 'users/create')
);
CREATE UNIQUE INDEX IF NOT EXISTS one_inflight_per_person ON intents(scope, target_ref)
  WHERE state IN ('intent', 'sending') AND target_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS intents_open ON intents(state) WHERE state IN ('intent', 'sending', 'unknown');
CREATE INDEX IF NOT EXISTS intents_ended ON intents(ended_at) WHERE ended_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS proofs (
  operation_id  TEXT NOT NULL,
  seq           INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  at            TEXT NOT NULL,
  detail        TEXT NOT NULL,
  PRIMARY KEY (operation_id, seq)
);
"""


@dataclass(frozen=True)
class Intent:
    operation_id: str
    request_id: str
    scope: str
    kind: str
    command: str
    target_ref: str | None
    create_origin_ref: str | None
    revision_sent: int | None
    state: str
    outcome_code: str | None
    user_id_after: str | None
    person_revision_after: int | None
    created_at: str
    send_started_at: str | None
    ended_at: str | None
    closed_by: str | None

    @property
    def open(self) -> bool:
        return self.state in OPEN and self.ended_at is None


_INTENT_COLS = ("operation_id, request_id, scope, kind, command, target_ref, create_origin_ref, revision_sent, state, outcome_code, "
                "user_id_after, person_revision_after, created_at, send_started_at, ended_at, closed_by")


def _intent(row: Any) -> Intent:
    return Intent(*row)


class WriteLineage:
    """One lineage file. Open it with `open_lineage`; `status` says whether new writes are admitted."""

    def __init__(self, path: Path, data_dir: Path, anchor: Anchor, *, holder: str, clock: Callable[[], datetime] = _utcnow) -> None:
        self.path = Path(path)
        self.data_dir = Path(data_dir)
        self.anchor = anchor
        self.holder = holder
        self.clock = clock
        self.status = "closed"
        self.generation = ""
        self._fences: dict[str, int] = {}
        self._lock = threading.RLock()
        self._db: sqlite3.Connection | None = None

    # -------------------------------------------------------------- file handling

    def _connect(self) -> sqlite3.Connection:
        c = sqlite3.connect(self.path, timeout=10, isolation_level=None, check_same_thread=False)
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA synchronous=FULL")  # an intent COMMIT is on disk before the frame is written
        c.execute("PRAGMA busy_timeout=10000")
        return c

    @property
    def db(self) -> sqlite3.Connection:
        if self._db is None:
            raise LineageError("lineage_closed")
        return self._db

    def close(self) -> None:
        """Release this holder's writer leases (a clean stop hands the scope over at once; a crashed process's lease lapses after
        WRITER_LEASE) and close the file."""
        with self._lock:
            if self._db is not None:
                try:
                    with self._tx():
                        self.db.execute("UPDATE writer_scope SET lease_until = ? WHERE holder = ?", (_iso(self.clock()), self.holder))
                except sqlite3.Error:
                    pass
                self._db.close()
                self._db = None
            self.status = "closed"

    def _meta(self, key: str) -> str | None:
        row = self.db.execute("SELECT v FROM meta WHERE k = ?", (key,)).fetchone()
        return row[0] if row else None

    def _seq(self) -> int:
        return int(self._meta("seq") or 0)

    def _tx(self) -> "_Tx":
        return _Tx(self.db)

    def writable(self) -> bool:
        return self.status in ("ok", "restored")

    def require_writable(self) -> None:
        if not self.writable():
            raise LineageError("lineage_" + (self.status if self.status in ("missing", "stale") else "unavailable"))

    # -------------------------------------------------------------- opening / restore detection

    def _open_existing(self) -> None:
        self._db = self._connect()
        self.db.executescript(_SCHEMA)
        if self._meta("format") != FORMAT:
            raise LineageError("lineage_format")
        self.generation = self._meta("generation") or ""
        seq = self._seq()
        anchored = self.anchor.read()
        if anchored is None:
            self._mark_open_unknown("restored_unknown", "restored")
            self._bump_all_fences()
            self.anchor.write(self.generation, seq)
            self.status = "restored"
            return
        gen, main_seq = anchored
        if gen != self.generation or main_seq > seq:
            self._mark_open_unknown("stale_unknown", "lineage_stale")
            self._bump_all_fences()
            self.status = "stale"
            return
        if main_seq < seq:
            self._mark_open_unknown("restored_unknown", "restored")
            self._bump_all_fences()
            self.anchor.write(self.generation, seq)
            self.status = "restored"
            return
        self.status = "ok"

    def _create(self, *, first_seq: int, lost_until: int | None) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._db = self._connect()
        self.db.executescript(_SCHEMA)
        self.generation = secrets.token_hex(16)
        with self._tx():
            self.db.execute("INSERT INTO meta(k, v) VALUES ('format', ?), ('generation', ?), ('seq', ?), ('created_at', ?)",
                            (FORMAT, self.generation, str(first_seq), _iso(self.clock())))
            if lost_until is not None:
                self.db.execute("INSERT INTO meta(k, v) VALUES ('lost_seq_until', ?)", (str(lost_until),))
        self.anchor.write(self.generation, first_seq)
        self.status = "ok"

    def reinitialise(self, *, actor_ref: str) -> None:
        """Administrator action for a missing or stale lineage: start a NEW generation. Nothing old is ever resent; the old rows of a
        stale file stay readable (and unknown). Records which sequence range was lost (missing) or superseded (stale)."""
        if not is_ref(actor_ref):
            raise LineageError("invalid_actor")
        with self._lock:
            anchored = self.anchor.read()
            main_seq = anchored[1] if anchored and anchored[1] >= 0 else 0
            if self.status == "missing":
                self._create(first_seq=main_seq, lost_until=main_seq)
            elif self.status == "stale":
                seq = max(self._seq(), main_seq)
                self.generation = secrets.token_hex(16)
                with self._tx():
                    self.db.execute("UPDATE meta SET v = ? WHERE k = 'generation'", (self.generation,))
                    self.db.execute("UPDATE meta SET v = ? WHERE k = 'seq'", (str(seq),))
                    self.db.execute("INSERT INTO meta(k, v) VALUES ('superseded_by', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
                                    (actor_ref,))
                self.anchor.write(self.generation, seq)
                self.status = "ok"
            else:
                raise LineageError("lineage_not_reinitialisable")

    def _mark_open_unknown(self, proof_kind: str, code: str) -> None:
        now = _iso(self.clock())
        with self._tx():
            rows = self.db.execute("SELECT operation_id FROM intents WHERE state IN ('intent','sending','unknown') AND ended_at IS NULL"
                                   ).fetchall()
            for (op,) in rows:
                self.db.execute("UPDATE intents SET state = 'unknown', outcome_code = ?, settled_at = NULL WHERE operation_id = ?",
                                (code, op))
                self._proof(op, proof_kind, {"code": code}, now)

    def _bump_all_fences(self) -> None:
        with self._tx():
            self.db.execute("UPDATE writer_scope SET fence = fence + 1, holder = '', lease_until = ?", (_iso(self.clock()),))
        self._fences.clear()

    # -------------------------------------------------------------- the writer scope

    def acquire_writer(self, scope: str) -> int:
        """Take (or renew) the exclusive writer role for `scope`. Another live holder -> `writer_busy`. A new holder gets a higher
        fence, which fences every earlier holder out of admitting or sending."""
        if not is_ref(scope):
            raise LineageError("invalid_scope")
        with self._lock:
            self.require_writable()
            now = self.clock()
            with self._tx():
                row = self.db.execute("SELECT holder, fence, lease_until FROM writer_scope WHERE scope = ?", (scope,)).fetchone()
                until = _iso(now + WRITER_LEASE)
                if row is None:
                    fence = 1
                    self.db.execute("INSERT INTO writer_scope(scope, holder, fence, lease_until) VALUES (?,?,?,?)",
                                    (scope, self.holder, fence, until))
                else:
                    holder, fence, lease_until = row
                    live = lease_until > _iso(now)
                    if holder != self.holder and live and holder != "":
                        raise LineageError("writer_busy")
                    if holder != self.holder or not live or self._fences.get(scope) != fence:
                        fence += 1
                    self.db.execute("UPDATE writer_scope SET holder = ?, fence = ?, lease_until = ? WHERE scope = ?",
                                    (self.holder, fence, until, scope))
            self._fences[scope] = fence
            return fence

    def _check_fence(self, scope: str) -> int:
        mine = self._fences.get(scope)
        row = self.db.execute("SELECT holder, fence, lease_until FROM writer_scope WHERE scope = ?", (scope,)).fetchone()
        if mine is None or row is None or row[0] != self.holder or row[1] != mine or row[2] <= _iso(self.clock()):
            raise LineageError("writer_fenced")
        return mine

    # -------------------------------------------------------------- intents

    def _proof(self, operation_id: str, kind: str, detail: dict[str, Any], at: str) -> None:
        if kind not in PROOF_KINDS:
            raise LineageError("invalid_proof")
        nxt = self.db.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM proofs WHERE operation_id = ?", (operation_id,)).fetchone()[0]
        self.db.execute("INSERT INTO proofs(operation_id, seq, kind, at, detail) VALUES (?,?,?,?,?)",
                        (operation_id, nxt, kind, at, json.dumps(detail, sort_keys=True, separators=(",", ":"))))

    def admit(self, *, scope: str, operation_id: str, request_id: str, kind: str, command: str, target_ref: str | None,
              create_origin_ref: str | None, revision_sent: int | None, sealed_field: str, sealed_value: dict[str, Any]) -> Intent:
        """COMMIT the intent (and bump the anchor) BEFORE any I/O of the mutation. `sealed_value` is the exact original (peer write) or
        the name_ref bindings; it is encrypted at rest. Refusals: duplicate operation / request / create origin, a second in-flight
        write for the same person, a fenced writer, a non-writable lineage."""
        if kind not in KINDS or not (is_ref(scope) and is_ref(operation_id) and is_ref(request_id) and is_ref(command)):
            raise LineageError("invalid_intent")
        if (target_ref is not None and not is_ref(target_ref)) or (create_origin_ref is not None and not is_ref(create_origin_ref)):
            raise LineageError("invalid_intent")
        if revision_sent is not None and not is_count(revision_sent):
            raise LineageError("invalid_intent")
        plaintext = json.dumps(sealed_value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        sealed = connection_store.seal_lineage_record(self.data_dir, operation_id, sealed_field, plaintext)
        with self._lock:
            self.require_writable()
            now = _iso(self.clock())
            try:
                with self._tx():
                    fence = self._check_fence(scope)
                    seq = self._seq() + 1
                    self.db.execute("UPDATE meta SET v = ? WHERE k = 'seq'", (str(seq),))
                    self.db.execute(
                        "INSERT INTO intents (operation_id, request_id, scope, fence, generation, seq, kind, command, target_ref, "
                        "create_origin_ref, revision_sent, sealed, state, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'intent',?)",
                        (operation_id, request_id, scope, fence, self.generation, seq, kind, command, target_ref, create_origin_ref,
                         revision_sent, sealed, now))
                    self._proof(operation_id, "intent_committed", {"command": command, "fence": fence, "seq": seq}, now)
            except sqlite3.IntegrityError as exc:
                text = str(exc)
                if "one_inflight_per_person" in text or "intents.scope, intents.target_ref" in text:
                    raise LineageError("person_write_in_flight") from None
                if "create_origin_ref" in text:
                    raise LineageError("create_origin_already_used") from None
                raise LineageError("duplicate_operation") from None
            # the anchor follows the lineage (a crash between the two reads as "main behind" -> open intents unknown: conservative)
            self.anchor.write(self.generation, seq)
        return self.get(operation_id)

    def begin_send(self, operation_id: str) -> None:
        """The one door to the socket: intent -> sending, committed (fsync) BEFORE the frame is written. Only from `intent`, only by
        the writer that still holds the scope at its fence."""
        with self._lock:
            self.require_writable()
            now = _iso(self.clock())
            with self._tx():
                row = self.db.execute("SELECT scope, state FROM intents WHERE operation_id = ?", (operation_id,)).fetchone()
                if row is None or row[1] != "intent":
                    raise LineageError("not_sendable")
                fence = self._check_fence(row[0])
                self.db.execute("UPDATE intents SET state = 'sending', send_started_at = ? WHERE operation_id = ? AND state = 'intent'",
                                (now, operation_id))
                self._proof(operation_id, "send_started", {"fence": fence}, now)

    def _settle(self, operation_id: str, *, new_state: str, allowed_from: tuple[str, ...], code: str | None, proof: str,
                user_id_after: str | None = None, person_revision_after: int | None = None, detail: dict[str, Any] | None = None) -> str:
        with self._lock:
            now = _iso(self.clock())
            with self._tx():
                row = self.db.execute("SELECT state, user_id_after, person_revision_after, ended_at FROM intents WHERE operation_id = ?",
                                      (operation_id,)).fetchone()
                if row is None:
                    raise LineageError("unknown_operation")
                state = row[0]
                if state in TERMINAL:
                    same = state == new_state and (row[1], row[2]) == (user_id_after, person_revision_after)
                    self._proof(operation_id, "late_fact", {"state": new_state, "code": code, "conflict": not same}, now)
                    return "duplicate" if same else "conflict"
                if state not in allowed_from:
                    raise LineageError("invalid_transition")
                ended = now if new_state in TERMINAL else None
                self.db.execute("UPDATE intents SET state = ?, outcome_code = ?, user_id_after = ?, person_revision_after = ?, "
                                "settled_at = ?, ended_at = COALESCE(?, ended_at) WHERE operation_id = ?",
                                (new_state, code, user_id_after, person_revision_after, now, ended, operation_id))
                self._proof(operation_id, proof, {"code": code, **(detail or {})}, now)
        return "settled"

    def mark_not_sent(self, operation_id: str, code: str) -> str:
        """Proven not sent: from `intent` (no send marker), or from `sending` when the port proved no byte was written."""
        return self._settle(operation_id, new_state="not_sent", allowed_from=("intent", "sending"), code=_code(code), proof="not_sent")

    def mark_committed(self, operation_id: str, *, user_id_after: str, person_revision_after: int, via: str) -> str:
        if not (is_ref(user_id_after) and is_count(person_revision_after)) or via not in ("ack", "resolve"):
            raise LineageError("invalid_fact")
        return self._settle(operation_id, new_state="committed", allowed_from=("sending", "unknown"), code=None,
                            proof="ack_committed" if via == "ack" else "resolve_found", user_id_after=user_id_after,
                            person_revision_after=person_revision_after)

    def mark_refused(self, operation_id: str, code: str) -> str:
        return self._settle(operation_id, new_state="refused", allowed_from=("sending",), code=_code(code), proof="ack_refused")

    def mark_unknown(self, operation_id: str, code: str, *, proof: str = "ack_lost") -> str:
        return self._settle(operation_id, new_state="unknown", allowed_from=("sending", "unknown"), code=_code(code), proof=proof)

    def close_unknown(self, operation_id: str, *, actor_ref: str, code: str) -> None:
        """An administrator ends an UNKNOWN that cannot be resolved (it stays unknown - never `not_sent` - and is never resent); the
        30-day retention starts now."""
        if not is_ref(actor_ref):
            raise LineageError("invalid_actor")
        with self._lock:
            now = _iso(self.clock())
            with self._tx():
                cur = self.db.execute("UPDATE intents SET ended_at = ?, closed_by = ? WHERE operation_id = ? AND state = 'unknown' "
                                      "AND ended_at IS NULL", (now, actor_ref, operation_id))
                if cur.rowcount != 1:
                    raise LineageError("not_closable")
                self._proof(operation_id, "closed_by_operator", {"actor": actor_ref, "code": _code(code)}, now)

    # -------------------------------------------------------------- recovery

    def recover(self, scope: str) -> dict[str, int]:
        """Startup recovery of ONE scope by its (new) exclusive writer: `intent` rows (crash window 1, the send marker was never
        committed) become `not_sent`; `sending` rows (windows 2 and 3) become `unknown`. Nothing is sent."""
        self.acquire_writer(scope)
        counts = {"not_sent": 0, "unknown": 0}
        with self._lock:
            now = _iso(self.clock())
            with self._tx():
                self._check_fence(scope)
                for (op,) in self.db.execute("SELECT operation_id FROM intents WHERE scope = ? AND state = 'intent'", (scope,)).fetchall():
                    self.db.execute("UPDATE intents SET state = 'not_sent', outcome_code = 'recovered_before_send', settled_at = ?, "
                                    "ended_at = ? WHERE operation_id = ?", (now, now, op))
                    self._proof(op, "recovered_before_send", {"code": "recovered_before_send"}, now)
                    counts["not_sent"] += 1
                for (op,) in self.db.execute("SELECT operation_id FROM intents WHERE scope = ? AND state = 'sending'", (scope,)).fetchall():
                    self.db.execute("UPDATE intents SET state = 'unknown', outcome_code = 'recovered_after_send' WHERE operation_id = ?",
                                    (op,))
                    self._proof(op, "recovered_after_send", {"code": "recovered_after_send"}, now)
                    counts["unknown"] += 1
        return counts

    # -------------------------------------------------------------- reads

    def get(self, operation_id: str) -> Intent:
        row = self.db.execute(f"SELECT {_INTENT_COLS} FROM intents WHERE operation_id = ?", (operation_id,)).fetchone()
        if row is None:
            raise LineageError("unknown_operation")
        return _intent(row)

    def sealed(self, operation_id: str, field: str) -> dict[str, Any]:
        """The decrypted original / bindings of one operation (for the exact-original resolve only)."""
        row = self.db.execute("SELECT sealed FROM intents WHERE operation_id = ?", (operation_id,)).fetchone()
        if row is None:
            raise LineageError("unknown_operation")
        try:
            return json.loads(connection_store.open_lineage_record(self.data_dir, operation_id, field, row[0]))
        except connection_store.SecretError:
            raise LineageError("original_unreadable") from None

    def open_intents(self, scope: str | None = None) -> list[Intent]:
        sql = f"SELECT {_INTENT_COLS} FROM intents WHERE state IN ('intent','sending','unknown') AND ended_at IS NULL"
        args: tuple[Any, ...] = ()
        if scope is not None:
            sql += " AND scope = ?"
            args = (scope,)
        return [_intent(r) for r in self.db.execute(sql + " ORDER BY seq", args).fetchall()]

    def proofs(self, operation_id: str) -> list[dict[str, Any]]:
        return [{"seq": s, "kind": k, "at": a, "detail": json.loads(d)} for s, k, a, d in
                self.db.execute("SELECT seq, kind, at, detail FROM proofs WHERE operation_id = ? ORDER BY seq", (operation_id,))]

    def handoff_export(self) -> list[dict[str, Any]]:
        """The lineage as the lead's reply evidence: refs, states, codes, times and proof kinds. Never the sealed original."""
        out = []
        for i in [_intent(r) for r in self.db.execute(f"SELECT {_INTENT_COLS} FROM intents ORDER BY seq").fetchall()]:
            out.append({"operation_id": i.operation_id, "command": i.command, "kind": i.kind, "state": i.state, "code": i.outcome_code,
                        "target_ref": i.target_ref, "person_revision_after": i.person_revision_after, "created_at": i.created_at,
                        "ended_at": i.ended_at, "proofs": [p["kind"] for p in self.proofs(i.operation_id)]})
        return out

    # -------------------------------------------------------------- retention

    def purge(self) -> int:
        """Delete operations that ENDED more than 30 days ago (with their proof rows). Open unknowns are never purged."""
        cutoff = _iso(self.clock() - RETENTION)
        with self._lock, self._tx():
            ops = [r[0] for r in self.db.execute("SELECT operation_id FROM intents WHERE ended_at IS NOT NULL AND ended_at <= ?",
                                                 (cutoff,)).fetchall()]
            for op in ops:
                self.db.execute("DELETE FROM proofs WHERE operation_id = ?", (op,))
                self.db.execute("DELETE FROM intents WHERE operation_id = ?", (op,))
        return len(ops)


def _code(code: Any) -> str:
    return code if is_ref(code) else "unknown"


class _Tx:
    """BEGIN IMMEDIATE ... COMMIT (ROLLBACK on any exception, including a simulated kill)."""

    def __init__(self, db: sqlite3.Connection) -> None:
        self.db = db

    def __enter__(self) -> "_Tx":
        self.db.execute("BEGIN IMMEDIATE")
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if exc_type is None:
            self.db.execute("COMMIT")
        else:
            self.db.execute("ROLLBACK")


def lineage_path(data_dir: Path) -> Path:
    return Path(data_dir) / LINEAGE_DIRNAME / LINEAGE_FILENAME


def open_lineage(data_dir: Path, anchor: Anchor, *, holder: str | None = None, clock: Callable[[], datetime] = _utcnow,
                 path: Path | None = None) -> WriteLineage:
    """Open (or, on a fresh installation, create) the lineage and run the restore / stale / missing checks. Never raises for those
    states - `status` reports them and `require_writable` refuses new writes."""
    p = path or lineage_path(data_dir)
    lin = WriteLineage(p, data_dir, anchor, holder=holder or process_holder(), clock=clock)
    if p.exists():
        lin._open_existing()
        return lin
    anchored = anchor.read()
    if anchored is not None:
        lin.status = "missing"  # nothing is recreated silently: an administrator re-initialises
        return lin
    lin._create(first_seq=0, lost_until=None)
    return lin
