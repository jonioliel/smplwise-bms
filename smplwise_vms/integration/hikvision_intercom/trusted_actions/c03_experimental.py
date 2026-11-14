"""Fake-only C03 candidate, deliberately absent from compose and HA entry points.

No original dispatch, bodies, parameters, results, keys or role mapping. The
verifier/current ports are trusted test dependencies, not signature verification.
The SQLite store accepts only an explicit TemporaryDirectory capability.
"""
from __future__ import annotations

import asyncio
import sqlite3
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from .c03_schema import PREDICATES, RESPONSE, request_schema
from .envelope import ClockSample, freeze
from .validation import Refusal, Schema, aware, reference, strict_json

RETENTION = 7 * 24 * 60 * 60


@dataclass(frozen=True, repr=False)
class LookupRequest:
    descriptor: object

    @classmethod
    def parse(cls, encoded, now):
        value = strict_json(encoded, limit=16384)
        Schema(request_schema())(value)
        def strings(box):
            for item in box.values():
                if type(item) is dict:
                    strings(item)
                elif type(item) is str:
                    reference(item)
        strings(value)
        grant, target, operation, decision, predicates = (
            value[k] for k in ['grant', 'target', 'operation', 'decision', 'predicates'])
        equalities = [(grant['decision_id'], decision['decision_id']),
                      (grant['grant_revision'], decision['grant_revision']),
                      (grant['permission_revision'], decision['permission_revision']),
                      (grant['permission_revision'], operation['permission_revision']),
                      (target['binding_revision'], decision['binding_revision']),
                      (target['binding_revision'], predicates['binding_revision']),
                      (target['logical_target_id'], predicates['logical_target_id']),
                      (value['selection_revision'], decision['selection_revision']),
                      (value['selection_revision'], operation['selection_revision'])]
        equalities.extend((value[k], decision[k]) for k in ['request_id', 'operation_id', 'operation_binding_ref'])
        equalities.extend((operation[k], decision[k]) for k in ['request_schema_id', 'request_schema_revision'])
        if any(type(a) is not type(b) or a != b for a, b in equalities):
            raise Refusal('binding_denied')
        for current, original in [('request_id', 'original_request_id'), ('operation_id', 'original_operation_id'),
                                  ('operation_binding_ref', 'original_operation_binding_ref')]:
            if value[current] == predicates[original]:
                raise Refusal('unproven_duplicate')
        request = cls(freeze(value))
        request.check_time(now)
        return request

    def check_time(self, now):
        issued, expires = (aware(self.descriptor[k]) for k in ['issued_at', 'request_expires_at'])
        decided = aware(self.descriptor['decision']['decided_at'])
        if (now.tzinfo is None or not 0 < (expires - issued).total_seconds() <= 15
                or now >= expires or issued > now + timedelta(seconds=2)
                or not issued <= decided <= now + timedelta(seconds=2)):
            raise Refusal('binding_denied')

    @property
    def predicates(self):
        return tuple(self.descriptor['predicates'][k] for k in PREDICATES)


@dataclass(frozen=True, repr=False)
class Authority:
    """Trusted fake-verifier output. Caller wire fields cannot attest a principal."""
    request: LookupRequest
    principal_id: str
    principal_kind: str
    allowed: bool
    permission_revision: int
    grant_revision: int
    logical_target_id: str
    binding_revision: str | None
    epoch: str
    receiver: object


class TemporaryStatusStore:
    """Separate experimental schema; never opens/migrates the runtime Journal."""
    def __init__(self, directory, *, fault=None, capacity=4096, in_memory=False):
        if (type(directory) is not tempfile.TemporaryDirectory or type(capacity) is not int
                or not 1 <= capacity <= 4096 or type(in_memory) is not bool):
            raise ValueError('explicit bounded temporary store required')
        root = Path(directory.name)
        if root.is_symlink() or not root.is_dir():
            raise ValueError('temporary directory required')
        path = root / 'c03-experimental.sqlite'
        if path.is_symlink():
            raise ValueError('temporary store symlink refused')
        self.fault, self.capacity, self.closed = fault, capacity, False
        self.generation = object()
        self.db = sqlite3.connect(':memory:' if in_memory else path, isolation_level=None)
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS clock(id INTEGER PRIMARY KEY CHECK(id=1), observed REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS metadata(
            reference TEXT PRIMARY KEY, operation_id TEXT NOT NULL, request_id TEXT NOT NULL,
            binding_ref TEXT NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL,
            target TEXT NOT NULL, revision TEXT, created REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS replay(
            reference TEXT PRIMARY KEY REFERENCES metadata(reference) ON DELETE CASCADE,
            operation_id TEXT UNIQUE NOT NULL, request_id TEXT UNIQUE NOT NULL, binding_ref TEXT UNIQUE NOT NULL);
          CREATE TABLE IF NOT EXISTS lookups(
            request_id TEXT PRIMARY KEY, operation_id TEXT UNIQUE NOT NULL,
            binding_ref TEXT UNIQUE NOT NULL, decision_id TEXT UNIQUE NOT NULL, created REAL NOT NULL);
        ''')

    def _fail(self, stage):
        if self.fault is not None:
            self.fault(stage)

    def _observe(self, now):
        if self.closed or type(now) is not datetime or now.tzinfo is None:
            raise Refusal('binding_denied')
        # Separate committed monotonic wall anchor survives failed mutations and reopen.
        self.db.execute('BEGIN IMMEDIATE')
        try:
            anchor = self.db.execute('SELECT observed FROM clock WHERE id=1').fetchone()
            if anchor and now.timestamp() < anchor[0]:
                raise Refusal('binding_denied')
            self.db.execute('INSERT INTO clock VALUES(1,?) ON CONFLICT(id) DO UPDATE SET observed=excluded.observed', (now.timestamp(),))
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def _transaction(self, now, operation, *, exposure=False):
        try:
            self._observe(now)
            self.db.execute('BEGIN IMMEDIATE')
            self.db.execute('DELETE FROM metadata WHERE created<=?', (now.timestamp() - RETENTION,))
            self.db.execute('DELETE FROM lookups WHERE created<=?', (now.timestamp() - RETENTION,))
            if not exposure:
                self._fail('after_prune')
            result = operation()
            if not exposure:
                self._fail('before_commit')
            self.db.execute('COMMIT')
            return result
        except Refusal:
            if self.db.in_transaction:
                self.db.execute('ROLLBACK')
            raise
        except Exception:
            if self.db.in_transaction:
                self.db.execute('ROLLBACK')
            raise Refusal('storage_write_failed') from None

    def record(self, predicates, now):
        # Only public origin metadata from an explicitly injected producer; no result/state/body.
        if type(predicates) is not tuple or len(predicates) != 8:
            raise Refusal()
        for item in predicates[:-1]:
            reference(item)
        if predicates[-1] is not None:
            reference(predicates[-1])
        def insert():
            if self.db.execute('SELECT COUNT(*) FROM metadata').fetchone()[0] >= self.capacity:
                raise Refusal('binding_denied')
            self.db.execute('INSERT INTO metadata VALUES(?,?,?,?,?,?,?,?,?)', (*predicates, now.timestamp()))
            self.db.execute('INSERT INTO replay VALUES(?,?,?,?)', (predicates[0], predicates[1], predicates[2], predicates[3]))
        return self._transaction(now, insert)

    def capture_original(self, context, now):
        """Metadata-only fixture seam from an admitted immutable original context.

        Not wired to the runtime journal. No original parameters/result are read.
        Uses the existing host's operation_id as its public operation reference.
        Numeric legacy binding revision is explicitly represented as decimal
        text inside this new experimental metadata, never coerced on C03 wire.
        """
        from .adapters import EngineContext
        from .envelope import Request
        if type(context) is not EngineContext or type(context.request) is not Request or context.epoch is None:
            raise Refusal('binding_denied')
        context.check()
        request = context.request
        actor, target = request.get('actor'), request.get('target')
        kind = actor['kind']
        if kind == 'human':
            original_actor = actor['user_id']
        elif kind == 'automation':
            original_actor = actor['automation_id']
        else:
            raise Refusal('binding_denied')
        revision = target['binding_revision']
        if type(revision) is not int or revision < 0:
            raise Refusal('binding_denied')
        predicates = (request.get('operation_id'), request.get('operation_id'), request.get('request_id'),
                      request.get('operation_binding_ref'), request.get('action'), original_actor,
                      target['logical_target_id'], str(revision))
        context.check()
        self.record(predicates, now)
        context.check()
        return predicates

    def reserve(self, request, now):
        d = request.descriptor
        def insert():
            # New lookup identities cannot inherit any original operation's replay.
            if self.db.execute('SELECT 1 FROM replay WHERE request_id=? OR operation_id=? OR binding_ref=?',
                               (d['request_id'], d['operation_id'], d['operation_binding_ref'])).fetchone():
                raise Refusal('unproven_duplicate')
            if self.db.execute('SELECT COUNT(*) FROM lookups').fetchone()[0] >= self.capacity:
                raise Refusal('binding_denied')
            try:
                self.db.execute('INSERT INTO lookups VALUES(?,?,?,?,?)',
                                (d['request_id'], d['operation_id'], d['operation_binding_ref'], d['decision']['decision_id'], now.timestamp()))
            except sqlite3.IntegrityError:
                raise Refusal('unproven_duplicate') from None
        return self._transaction(now, insert)

    def matches(self, predicates, now, *, exposure=False):
        def read():
            row = self.db.execute('SELECT reference,operation_id,request_id,binding_ref,action,actor,target,revision FROM metadata WHERE reference=?', (predicates[0],)).fetchone()
            return row is not None and all(type(a) is type(b) and a == b for a, b in zip(row, predicates))
        # The last snapshot has no injectable callbacks after the row is read.
        # Earlier reads/reservation still exercise all storage fault hooks.
        return self._transaction(now, read, exposure=exposure)

    def prune(self, now):
        self._transaction(now, lambda: None)

    def close(self):
        if not self.closed:
            self.closed = True
            self.generation = object()
            self.db.close()


class ExperimentalStatusLookup:
    """Explicit local seam only, not accepted by the public 45/47 factory."""
    def __init__(self, store, verify, current, clock, pause):
        if type(store) is not TemporaryStatusStore:
            raise ValueError('temporary experimental store required')
        self.store, self.verify, self.current, self.clock, self.pause = store, verify, current, clock, pause
        self._last_clock = None

    async def lookup(self, encoded):
        try:
            return await self._lookup(encoded)
        except Refusal as error:
            from .producer import PUBLIC_ERRORS
            raise Refusal(error.code if error.code in PUBLIC_ERRORS else 'action_failed') from None
        except Exception:
            raise Refusal('action_failed') from None

    async def _lookup(self, encoded):
        # Capture dependency identity before verifier's first await.
        store, verify, current, clock, pause = self.store, self.verify, self.current, self.clock, self.pause
        generation = store.generation
        connection = store.db
        sample = clock()
        if type(sample) is not ClockSample:
            raise Refusal('binding_denied')
        sample.check()
        if self._last_clock is not None and sample.now < self._last_clock:
            raise Refusal('binding_denied')
        self._last_clock = sample.now
        store._observe(sample.now)
        request = LookupRequest.parse(encoded, sample.now)
        verified = await verify(request)
        if type(verified) is not Authority:
            raise Refusal('Unauthorized')
        epoch, receiver = verified.epoch, verified.receiver
        reference(epoch)
        if receiver is None:
            raise Refusal('binding_denied')

        def owners_current():
            if (self.store is not store or store.closed or store.generation is not generation
                    or store.db is not connection
                    or self.verify is not verify or self.current is not current
                    or self.clock is not clock or self.pause is not pause):
                raise Refusal('binding_denied')

        def check():
            owners_current()
            sample = clock()
            if type(sample) is not ClockSample:
                raise Refusal('binding_denied')
            sample.check()
            if sample.now < self._last_clock:
                raise Refusal('binding_denied')
            self._last_clock = sample.now
            request.check_time(sample.now)
            authority = current(request)
            # Trusted ports can still be replaced reentrantly while called.
            # Check ownership after their return, including the final exposure.
            owners_current()
            if (type(authority) is not Authority or authority.request != request or verified.request != request
                    or authority.allowed is not True or verified.allowed is not True
                    or authority.principal_kind not in ('arx_human', 'ha_human')
                    or verified.principal_kind != authority.principal_kind
                    or authority.principal_id != request.descriptor['actor']['user_id']
                    or verified.principal_id != authority.principal_id
                    or authority.epoch != epoch or authority.receiver is not receiver):
                raise Refusal('Unauthorized')
            d = request.descriptor
            for attestation in (verified, authority):
                for actual, expected in [(attestation.permission_revision, d['grant']['permission_revision']),
                                         (attestation.grant_revision, d['grant']['grant_revision']),
                                         (attestation.logical_target_id, d['target']['logical_target_id']),
                                         (attestation.binding_revision, d['target']['binding_revision'])]:
                    if type(actual) is not type(expected) or actual != expected:
                        raise Refusal('binding_denied')
            # current() is an external port and can change clock health/time.
            # Validate its post-call sample, not the sample preceding the call.
            sample = clock()
            owners_current()
            if type(sample) is not ClockSample:
                raise Refusal('binding_denied')
            sample.check()
            if sample.now < self._last_clock:
                raise Refusal('binding_denied')
            self._last_clock = sample.now
            request.check_time(sample.now)
            if asyncio.current_task().cancelling():
                raise asyncio.CancelledError()
            return sample.now

        now = check()
        store.reserve(request, now)
        await pause('before_read')
        now = check()
        store.matches(request.predicates, now)  # Same path for found/missing; not a result cache.
        await pause('before_projection')
        now = check()
        # Re-read after the final await: prune/metadata change/reopen cannot leave a stale response.
        store.matches(request.predicates, now)
        now = check()
        # This is the exposure snapshot, after the last authority/clock port.
        # No external callback or await can invalidate this row before return.
        found = store.matches(request.predicates, now, exposure=True)
        return {'schema_revision': RESPONSE, 'request_id': request.descriptor['request_id'],
                'operation_id': request.descriptor['operation_id'],
                'state': 'pending' if found else 'not_found_or_expired'}
