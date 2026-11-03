"""Stage3a local scheduler, private current-source ports and fake Arx adapter.

The optional typed Host composition borrows original workers in DEV/MOCKS.
No installed queue service, sender discovery, live network or switches are enabled.
Queue waiting never extends original authority and no preview is serialized.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import weakref
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from .access.commit_tasks import finish_owned_commit
from .trusted_actions.validation import Refusal, reference
from .whatsapp_pacing_ledger import (
    AttemptOutcome,
    PacingBackoff,
    PacingLedger,
    PacingLimited,
    SenderHandle,
)
from .whatsapp_pacing_queue_outcomes import QueueProviderRejection
from .whatsapp_pacing_queue_store import QueueProfile, QueueStore, encoded, instant, job
from .whatsapp_pacing_reservations import (
    CLASSES,
    ArxReservationClient,
    ReservationIdentity,
    ReservationUnavailable,
    _coroutine,
    _function,
    utc,
)

_QUEUES = weakref.WeakKeyDictionary()
_PREPARED = weakref.WeakKeyDictionary()
_NATIVE_PREPARING = ContextVar("wiskey_native_queue_preparing", default=None)
_NATIVE_PREFIX = "native-single-owner.v1:"
_HOST_NATIVE_PREFIX = "native-host-single-owner.v1:"
CLASS_TTL = {"alert": 3600, "code": 300, "ticket": 21600, "reminder": 43200}


class SendNotStarted(Refusal):
    """Original callback was never invoked; no provider I/O is possible."""


def _copy(value):
    return json.loads(encoded(value))


def _check(port, value):
    result = port(_copy(value))
    if result is not None and result is not True:
        if inspect.iscoroutine(result):
            result.close()
        raise Refusal("binding_denied")


@dataclass(repr=False)
class _PreparedOwner:
    identity: str
    issued: datetime
    expires: datetime
    check: object
    dispatch: object
    consumed: bool = False
    native: object = None


class PreparedQueuedSend:
    """Internal fresh one-use source preparation, never an actor/wire DTO.

    check() must check actual source/person/revision/scope/consent/template.
    async dispatch(before_io) calls that original guard after every wait and
    immediately before actual I/O. It returns provider evidence as AttemptOutcome; generic
    exceptions/timeout remain UNKNOWN. A completed HA call is not ACCEPTED.
    """

    def __init__(self, value, *, issued_at, expires_at, check, dispatch):
        original = encoded(job(value))
        if not callable(check) or inspect.iscoroutinefunction(check):
            raise Refusal("binding_denied")
        if not inspect.iscoroutinefunction(_function(dispatch)):
            raise Refusal("binding_denied")
        self.issued_at, self.expires_at = utc(issued_at), utc(expires_at)
        if not timedelta(0) < self.expires_at - self.issued_at <= timedelta(seconds=15):
            raise Refusal("invalid_fields")
        _PREPARED[self] = _PreparedOwner(original, self.issued_at, self.expires_at, check, dispatch)

    @classmethod
    def from_native(cls, value, *, composition, context, issued_at, expires_at):
        """Original closed native composition; no caller dispatch/payload callback."""
        from .native_whatsapp_accounting import (
            bind_native_queued_preparation,
            check_native_queued_preparation,
            prepare_native_queued_send,
            send_native_queued_preparation,
        )

        if cls is not PreparedQueuedSend:
            raise Refusal("binding_denied")
        native = prepare_native_queued_send(
            value, composition, context, issued_at=issued_at, expires_at=expires_at
        )

        def check():
            check_native_queued_preparation(native)

        async def dispatch(before_io):
            return await send_native_queued_preparation(native, before_io)

        result = cls(
            value, issued_at=issued_at, expires_at=expires_at, check=check, dispatch=dispatch
        )
        _PREPARED[result].native = native
        bind_native_queued_preparation(native, result)
        return result

    def check(self, value, now):
        owner = _PREPARED.get(self)
        if (
            type(self) is not PreparedQueuedSend
            or owner is None
            or owner.consumed
            or self.issued_at is not owner.issued
            or self.expires_at is not owner.expires
            or encoded(job(value)) != owner.identity
            or instant(owner.issued) > now + 2_000000
            or instant(owner.expires) <= now
            or instant(owner.expires) > min(value["expires_us"], value["authorization_expires_us"])
        ):
            raise Refusal("preview_expired")
        result = owner.check()
        if result is not None and result is not True:
            if inspect.iscoroutine(result):
                result.close()
            raise Refusal("binding_denied")

    async def dispatch(self, value, now, *, before_io):
        PreparedQueuedSend.check(self, value, now)
        owner = _PREPARED[self]
        owner.consumed = True
        calls = 0

        def guard():
            nonlocal calls
            current_now = before_io()
            if (
                instant(owner.expires) <= current_now
                or self.expires_at is not owner.expires
                or self.issued_at is not owner.issued
                or encoded(job(value)) != owner.identity
            ):
                raise Refusal("preview_expired")
            result = owner.check()
            if result is not None and result is not True:
                if inspect.iscoroutine(result):
                    result.close()
                raise Refusal("binding_denied")
            before_io()
            calls += 1

        try:
            guard()
        except Refusal as error:
            raise SendNotStarted(error.code) from None
        calls = 0
        result = await _coroutine(owner.dispatch, guard)
        if calls == 0:
            return AttemptOutcome.UNKNOWN
        if type(result) not in {AttemptOutcome, QueueProviderRejection}:
            return AttemptOutcome.UNKNOWN
        return result


@dataclass(repr=False)
class _QueueOwner:
    configuration: tuple
    lock: object
    active: bool = False
    closed: bool = False
    task: object = None
    preparing: object = None
    native_prepared: object = None
    close_task: object = None
    cleanup_failed: bool = False
    template_claim: object = None


def _owner(queue):
    owner = _QUEUES.get(queue)
    if owner is None or owner.closed or owner.cleanup_failed:
        raise Refusal("binding_denied")
    ledger, store, source, ports, reservations, known_local, native_handoff = owner.configuration
    if (
        queue._configuration is not owner.configuration
        or queue.ledger is not ledger
        or queue.store is not store
        or queue.source is not source
        or queue.reservations is not reservations
        or queue.known_local is not known_local
        or queue.native_handoff is not native_handoff
        or queue._lock is not owner.lock
    ):
        raise Refusal("binding_denied")
    for expected, current in zip(ports, (source.sender, source.check, source.prepare), strict=True):
        if _function(expected) is not _function(current) or getattr(
            expected, "__self__", None
        ) is not getattr(current, "__self__", None):
            raise Refusal("binding_denied")
    from .whatsapp_pacing_runtime import HostPacingPort, check_native_pacing_port

    if type(ledger) is HostPacingPort:
        check_native_pacing_port(ledger)
    _now(store)
    return owner


def _is_host(owner):
    from .whatsapp_pacing_runtime import HostPacingPort

    return type(owner.configuration[0]) is HostPacingPort


def _now(store):
    from .whatsapp_host_queue_store import HostQueueStorePort, now

    return now(store) if type(store) is HostQueueStorePort else QueueStore.now(store)


def _rows(store):
    from .whatsapp_host_queue_store import HostQueueStorePort, rows

    return rows(store) if type(store) is HostQueueStorePort else QueueStore.rows(store)


def _backoffs(store, sender, pair):
    from .whatsapp_host_queue_store import HostQueueStorePort, backoffs

    return (
        backoffs(store, sender, pair)
        if type(store) is HostQueueStorePort
        else QueueStore.backoffs(store, sender, pair)
    )


async def _write(queue, operation, *args, **kwargs):
    owner = _owner(queue)
    store = owner.configuration[1]
    if _is_host(owner):
        from .whatsapp_host_queue_store import call

        result = await call(store, operation, *args, **kwargs)
        if _owner(queue) is not owner:
            raise Refusal("binding_denied")
        return result
    methods = {"put": QueueStore.put, "change": QueueStore.change, "backoff": QueueStore.backoff}
    if operation not in methods:
        raise Refusal("binding_denied")
    return methods[operation](store, *args, **kwargs)


def _store_status(store):
    from .whatsapp_host_queue_store import HostQueueStorePort, status

    return status(store) if type(store) is HostQueueStorePort else QueueStore.status(store)


def _system_clock():
    return datetime.now(UTC)


def _source_ports(source):
    ports = source.sender, source.check, source.prepare
    if (
        not all(callable(p) for p in ports)
        or inspect.iscoroutinefunction(_function(ports[0]))
        or inspect.iscoroutinefunction(_function(ports[1]))
        or not inspect.iscoroutinefunction(_function(ports[2]))
    ):
        raise Refusal("binding_denied")
    return ports


def _deadline(value):
    return min(value["expires_us"], value["authorization_expires_us"])


def native_preparation_owner(value):
    """Called only by the original source.prepare on the original queue Task."""
    queue = _NATIVE_PREPARING.get()
    if type(queue) is not PacingQueue:
        raise Refusal("binding_denied")
    owner = _owner(queue)
    if (
        type(queue) is not PacingQueue
        or owner.configuration[6] is not True
        or not owner.active
        or owner.task is not asyncio.current_task()
        or owner.preparing is None
        or owner.preparing[0] != encoded(job(value))
        or owner.native_prepared is not None
    ):
        raise Refusal("binding_denied")
    return queue, owner, owner.preparing[1]


def check_native_queue_owner(queue, owner, native, value, *, cleanup=False, guard_only=False):
    if (
        _QUEUES.get(queue) is not owner
        or owner.closed
        or not owner.active
        or owner.task is None
        or owner.task.done()
        or (not guard_only and owner.task is not asyncio.current_task())
        or owner.native_prepared is not native
        or owner.preparing is None
        or owner.preparing[0] != encoded(job(value))
    ):
        raise Refusal("binding_denied")
    if not cleanup:
        _owner(queue)
        now = _current(queue, value)
        row = _get(queue, value["request_id"])
        if row["lease_expires_us"] is not None and now >= row["lease_expires_us"]:
            raise Refusal("pacing_lease_expired")
        return now


def _sender_key(value):
    return "unknown-global" if value["sender_ref"] is None else value["sender_ref"]


def _current(queue, value, prepared=None):
    owner = _owner(queue)
    now = _now(owner.configuration[1])
    if now >= _deadline(value):
        raise Refusal("pacing_expired")
    _check(owner.configuration[3][1], value)
    if prepared is not None:
        PreparedQueuedSend.check(prepared, value, now)
    return now


def _sender(queue, value):
    owner = _owner(queue)
    sender = owner.configuration[3][0](_copy(value))
    if (
        type(sender) is not SenderHandle
        or sender.sender_ref != value["sender_ref"]
        or sender.verified is not (value["sender_ref"] is not None)
    ):
        raise Refusal("binding_denied")
    # Original ledger method validates issuance/current mapping; no untrusted
    # SenderHandle labels or incomplete/null snapshot is used as a zero count.
    if _is_host(owner):
        from .whatsapp_pacing_runtime import native_queue_sender

        if native_queue_sender(owner.configuration[0]) is not sender:
            raise Refusal("binding_denied")
    else:
        PacingLedger.check_local_admission(owner.configuration[0], sender)
    return sender


def _get(queue, request_id):
    owner = _owner(queue)
    if _is_host(owner):
        from .whatsapp_host_queue_store import row

        return row(owner.configuration[1], request_id)
    rows = [r for r in _rows(owner.configuration[1]) if r["job"]["request_id"] == request_id]
    if len(rows) != 1:
        raise Refusal("binding_denied")
    return rows[0]


async def _terminal(
    queue, value, outcome, code, *, attempt=None, ledger_may_exist=False, backoff=None
):
    owner = _owner(queue)
    ledger, store = owner.configuration[:2]
    pending = attempt is None and ledger_may_exist
    if attempt is not None:
        try:
            PacingLedger.finish(ledger, attempt, outcome)
            pending = False
        except Exception:
            pending = True
    return await _write(
        queue,
        "change",
        value["request_id"],
        expected={"pending", "reserving", "admitting", "dispatching"},
        state="terminal",
        outcome=outcome.value,
        code=code,
        ledger_pending=pending,
        backoff=backoff,
    )


def native_template_queue_port(hass, queue):
    """Original host queue ownership, never a sender label or fake queue port."""
    from .whatsapp_pacing_runtime import check_native_pacing_port

    if type(queue) is not PacingQueue:
        raise Refusal("binding_denied")
    owner = _owner(queue)
    if (
        not _is_host(owner)
        or not queue.native_handoff
        or queue.known_local
        or owner.close_task is not None
        or check_native_pacing_port(owner.configuration[0]) is not hass
    ):
        raise Refusal("binding_denied")
    return owner.configuration[0]


class _NativeTemplateQueueClaim:
    """A borrowed original queue lock, not admission or a new dispatch engine."""

    def __init__(self, owner, task):
        self._creation = owner, owner.lock, task, [False]

    async def async_close(self):
        owner, lock, task, state = self._creation
        if state[0]:
            return
        state[0] = True
        if owner.template_claim is self:
            owner.template_claim = None
            owner.active = False
            if owner.task is task:
                owner.task = None
        # This claim alone acquired this original lock. Public aliases cannot
        # redirect its cleanup to another queue, resource or caller's lock.
        lock.release()


class PacingQueue:
    """Serialized local priority scheduler; durable marker before possible I/O.

    source.sender(job)->original SenderHandle; check(job)->None/True or Refusal;
    async prepare(job)->a NEW PreparedQueuedSend after current checks. A source
    must not regenerate W1 authority or revive a consumed preview for queueing.
    """

    def __init__(
        self,
        path,
        *,
        queue_id,
        ledger,
        source,
        clock,
        reservations=None,
        profile=None,
        expect_existing=False,
        known_local=False,
        native_handoff=False,
    ):
        if (
            type(ledger) is not PacingLedger
            or type(known_local) is not bool
            or type(native_handoff) is not bool
            or native_handoff
            and known_local
            or reservations is not None
            and type(reservations) is not ArxReservationClient
        ):
            raise Refusal("binding_denied")
        if type(queue_id) is not str or queue_id.startswith((_NATIVE_PREFIX, _HOST_NATIVE_PREFIX)):
            raise Refusal("invalid_fields")
        if native_handoff:
            queue_id = _NATIVE_PREFIX + queue_id
        ports = _source_ports(source)
        self.ledger, self.source, self.reservations = ledger, source, reservations
        self.known_local = known_local
        self.native_handoff = native_handoff
        self.store = QueueStore(
            path,
            queue_id=queue_id,
            profile=profile or QueueProfile(),
            clock=clock,
            expect_existing=expect_existing,
        )
        self._lock = asyncio.Lock()
        self._configuration = (
            ledger,
            self.store,
            source,
            ports,
            reservations,
            known_local,
            native_handoff,
        )
        _QUEUES[self] = _QueueOwner(self._configuration, self._lock)

    @classmethod
    async def from_host(
        cls,
        host_port,
        *,
        source,
        clock=_system_clock,
        reservations=None,
        profile=None,
        expect_existing=False,
    ):
        from .whatsapp_host_queue_store import _OpenCleanupFailed, close_store, open_store
        from .whatsapp_pacing_runtime import (
            HostPacingPort,
            _retain_failed_native_queue,
            _retain_failed_native_store,
            begin_native_queue,
            native_send_scope,
            register_native_queue,
            retire_native_queue,
        )

        if (
            cls is not PacingQueue
            or type(host_port) is not HostPacingPort
            or type(expect_existing) is not bool
            or reservations is not None
            and type(reservations) is not ArxReservationClient
        ):
            raise Refusal("binding_denied")
        ports = _source_ports(source)
        store = None
        result = None
        async with native_send_scope(host_port):
            path, queue_id = begin_native_queue(host_port)
            try:
                store = await open_store(
                    path,
                    queue_id=queue_id,
                    profile=profile or QueueProfile(),
                    clock=clock,
                    expect_existing=expect_existing,
                )
                result = object.__new__(cls)
                result.ledger, result.source, result.reservations = host_port, source, reservations
                result.known_local, result.native_handoff = False, True
                result.store, result._lock = store, asyncio.Lock()
                result._configuration = (host_port, store, source, ports, reservations, False, True)
                _QUEUES[result] = _QueueOwner(result._configuration, result._lock)
                register_native_queue(host_port, result)
                _owner(result)
                return result
            except BaseException as error:
                if type(error) is _OpenCleanupFailed:
                    _retain_failed_native_store(host_port, error._port)
                    retire_native_queue(host_port)
                    raise error._error from None
                joined = store is None
                try:
                    if store is not None:
                        closing = asyncio.create_task(close_store(store))
                        if result is not None:
                            _QUEUES[result].close_task = closing
                        try:
                            await finish_owned_commit(closing)
                        finally:
                            joined = (
                                closing.done()
                                and not closing.cancelled()
                                and closing.exception() is None
                            )
                except BaseException:
                    if not joined and result is not None:
                        _retain_failed_native_queue(host_port, result)
                    raise
                finally:
                    if joined:
                        if result is not None:
                            _QUEUES.pop(result, None)
                        retire_native_queue(host_port, result)
                raise

    def _enqueue_value(
        self,
        *,
        request_id,
        action_identity,
        sender_ref,
        message_class,
        authorization_expires_at,
        pair_ref=None,
        ttl_s=None,
    ):
        owner = _owner(self)
        reference(request_id)
        reference(action_identity)
        if message_class not in CLASSES or type(message_class) is not str:
            raise Refusal("invalid_fields")
        if sender_ref is not None:
            reference(sender_ref)
        if pair_ref is not None:
            reference(pair_ref)
        ttl_s = CLASS_TTL[message_class] if ttl_s is None else ttl_s
        if type(ttl_s) is not int or not 1 <= ttl_s <= 172800:
            raise Refusal("invalid_fields")
        original_deadline = instant(authorization_expires_at)
        store = owner.configuration[1]
        old = [r for r in _rows(store) if r["job"]["request_id"] == request_id]
        if old:
            value = old[0]["job"]
            if (
                value["action_identity"],
                value["sender_ref"],
                value["message_class"],
                value["authorization_expires_us"],
                value["pair_ref"],
            ) != (action_identity, sender_ref, message_class, original_deadline, pair_ref) or value[
                "expires_us"
            ] - value["enqueued_us"] != ttl_s * 1_000_000:
                raise Refusal("operation_conflict")
            return None
        now = _now(store)
        value = job(
            {
                "request_id": request_id,
                "action_identity": action_identity,
                "sender_ref": sender_ref,
                "message_class": message_class,
                "pair_ref": pair_ref,
                "authorization_expires_us": original_deadline,
                "enqueued_us": now,
                "expires_us": now + ttl_s * 1_000_000,
            }
        )
        _current(self, value)
        return {
            "job": value,
            "state": "pending",
            "outcome": None,
            "code": None,
            "next_us": now,
            "arx_state": "none",
            "lease_ref": None,
            "lease_expires_us": None,
            "release_pending": False,
            "ledger_pending": False,
        }

    def enqueue(self, **kwargs):
        owner = _owner(self)
        if _is_host(owner):
            raise Refusal("binding_denied")
        record = PacingQueue._enqueue_value(self, **kwargs)
        return False if record is None else QueueStore.put(owner.configuration[1], record)

    async def async_enqueue(self, **kwargs):
        owner = _owner(self)
        if not _is_host(owner):
            return PacingQueue.enqueue(self, **kwargs)
        from .whatsapp_host_queue_store import call
        from .whatsapp_pacing_runtime import native_send_scope

        if owner.task is asyncio.current_task():
            raise Refusal("operation_in_progress")
        async with native_send_scope(owner.configuration[0]), owner.lock:
            await call(owner.configuration[1], "refresh")
            _owner(self)
            record = PacingQueue._enqueue_value(self, **kwargs)
            if record is None:
                return False
            result = await _write(self, "put", record)
            _current(self, record["job"])
            return result

    async def claim_template(self, context):
        """Serialize a native immediate template send on the existing queue.

        The original template host/accounting perform admission, durable reserve,
        mark_dispatch and completion. This borrowed queue slot never enqueues a
        second job, accounts a second message, or invents recipient consent.
        """
        from .trusted_actions.adapters import EngineContext
        from .trusted_actions.owned_resources import OwnedObject

        if (
            type(context) is not EngineContext
            or context.request.get("action") != "whatsapp/template_send_v1"
        ):
            raise Refusal("binding_denied")
        context.check()
        owner = _owner(self)
        if not _is_host(owner) or not self.native_handoff or self.known_local:
            raise Refusal("binding_denied")
        await owner.lock.acquire()
        claim = None
        try:
            if _owner(self) is not owner or owner.close_task is not None or owner.active:
                raise Refusal("binding_denied")
            task = asyncio.current_task()
            if task is None:
                raise Refusal("binding_denied")
            claim = _NativeTemplateQueueClaim(owner, task)
            owner.template_claim, owner.active, owner.task = claim, True, task
            context.check()
            _owner(self)
            return OwnedObject(claim, claim.async_close)
        except BaseException:
            if claim is not None:
                await claim.async_close()
            else:
                owner.lock.release()
            raise

    async def pump_one(self):
        owner = _owner(self)
        async with owner.lock:
            _owner(self)
            owner.active = True
            task = asyncio.create_task(PacingQueue._run_one(self))
            owner.task = task
            try:
                await finish_owned_commit(task)
                return task.result()
            finally:
                owner.active = False
                owner.task = None

    async def _run_one(self):
        owner = _owner(self)
        try:
            if _is_host(owner):
                from .whatsapp_host_queue_store import call
                from .whatsapp_pacing_runtime import native_send_scope

                async with native_send_scope(owner.configuration[0]):
                    await call(owner.configuration[1], "refresh")
                    _owner(self)
                    return await PacingQueue._run_one_original(self)
            return await PacingQueue._run_one_original(self)
        finally:
            if owner.native_prepared is not None:
                from .native_whatsapp_accounting import retire_native_queued_preparation

                retire_native_queued_preparation(owner.native_prepared)
            owner.native_prepared = owner.preparing = None

    async def _run_one_original(self):
        owner = _owner(self)
        if not owner.active or asyncio.current_task() is not owner.task:
            raise Refusal("binding_denied")
        ledger, store, _source, ports, reservations, known_local, native_handoff = (
            owner.configuration
        )
        now = _now(store)
        candidates = []
        for record in _rows(store):
            if record["state"] != "pending":
                continue
            value = record["job"]
            if now >= _deadline(value):
                await _terminal(self, value, AttemptOutcome.DEFINITIVELY_NOT_SENT, "pacing_expired")
                continue
            until, _basis = _backoffs(
                store, _sender_key(value), value["pair_ref"] or "unknown-pair"
            )
            if now >= max(record["next_us"], until):
                candidates.append(value)
        if not candidates:
            return None
        value = min(candidates, key=lambda j: (CLASSES.index(j["message_class"]), j["enqueued_us"]))
        request = value["request_id"]
        try:
            _current(self, value)
            sender = _sender(self, value)
            if _is_host(owner):
                from .whatsapp_pacing_runtime import native_queue_admission

                await native_queue_admission(ledger, sender)
                _current(self, value)
                if _sender(self, value) is not sender:
                    raise Refusal("binding_denied")
        except (PacingLimited, PacingBackoff) as error:
            delay = error.retry_after_s
            # Unknown retry-after stays unknown. Five seconds is only a local
            # admission polling interval, never a claimed provider retry-after.
            due = min(_deadline(value), now + (5 if delay is None else max(1, delay)) * 1_000_000)
            return await _write(
                self, "change", request, expected={"pending"}, next_us=due, code=error.code
            )
        except Refusal as error:
            if error.code == "pacing_sender_reconciliation_required":
                # Keep the original queued job while another original send is
                # unresolved. Polling creates neither authority nor a retry of
                # that send; original job/authorization deadlines still apply.
                return await _write(
                    self,
                    "change",
                    request,
                    expected={"pending"},
                    next_us=min(_deadline(value), now + 5_000_000),
                    code="whatsapp_pacing_unavailable",
                )
            return await _terminal(
                self,
                value,
                AttemptOutcome.DEFINITIVELY_NOT_SENT,
                "pacing_expired" if error.code == "pacing_expired" else "binding_denied",
            )
        prepared = None
        try:
            owner.preparing = encoded(job(value)), sender
            marker = _NATIVE_PREPARING.set(self)
            remaining = (_deadline(value) - _now(store)) / 1_000_000
            try:
                async with asyncio.timeout(min(15, remaining)):
                    prepared = await _coroutine(ports[2], _copy(value))
            finally:
                _NATIVE_PREPARING.reset(marker)
            if type(prepared) is not PreparedQueuedSend:
                raise Refusal("binding_denied")
            if native_handoff is not (_PREPARED[prepared].native is not None):
                raise Refusal("binding_denied")
            if native_handoff and _PREPARED[prepared].native is not owner.native_prepared:
                raise Refusal("binding_denied")
            _current(self, value, prepared)
        except (Exception, asyncio.CancelledError):
            return await _terminal(
                self,
                value,
                AttemptOutcome.DEFINITIVELY_NOT_SENT,
                "pacing_expired" if _now(store) >= _deadline(value) else "binding_denied",
            )
        await _write(self, "change", request, expected={"pending"}, state="reserving")
        _current(self, value, prepared)
        reservation = None
        identity = None
        mode = "unavailable"
        if reservations is not None and value["sender_ref"] is not None:
            identity = ReservationIdentity(
                request, value["sender_ref"], value["message_class"], value["action_identity"]
            )
            await _write(
                self,
                "change",
                request,
                expected={"reserving"},
                arx_state="release_unknown",
                release_pending=True,
            )
            _current(self, value, prepared)
            try:
                remaining = (_deadline(value) - _now(store)) / 1_000_000
                async with asyncio.timeout(min(15, remaining)):
                    reservation = await ArxReservationClient.reserve(reservations, identity)
                _current(self, value, prepared)
                if not reservation.approved:
                    delay = reservation.retry_after_s
                    until = 2**53 - 1 if delay is None else _now(store) + max(1, delay) * 1_000_000
                    await _write(
                        self,
                        "backoff",
                        _sender_key(value),
                        "",
                        until,
                        "local_policy"
                        if reservation.retry_after_s in {None, 0}
                        else "authenticated_arx",
                    )
                    return await _write(
                        self,
                        "change",
                        request,
                        expected={"reserving"},
                        state="pending",
                        arx_state="denied",
                        next_us=until,
                        code="rate_limited",
                        release_pending=False,
                    )
                mode = "reserved"
            except (ReservationUnavailable, TimeoutError):
                # Explicitly permitted fallback, never an approval or shared
                # guarantee. A still-current known backoff remains persisted.
                ArxReservationClient.shared_budget_guaranteed.fget(reservations)
                _current(self, value, prepared)
            except (Exception, asyncio.CancelledError):
                return await _terminal(
                    self, value, AttemptOutcome.DEFINITIVELY_NOT_SENT, "binding_denied"
                )
        await _write(
            self,
            "change",
            request,
            expected={"reserving"},
            state="admitting",
            arx_state=mode,
            release_pending=identity is not None,
            lease_ref=None if reservation is None else reservation.lease_ref,
            lease_expires_us=None if reservation is None else instant(reservation.lease_expires_at),
        )
        if native_handoff:
            return await PacingQueue._send_native_prepared(self, value, prepared, identity)
        attempt = None
        try:
            _current(self, value, prepared)
            attempt, fresh = PacingLedger.reserve(
                ledger,
                sender,
                request_id=request,
                action_identity=value["action_identity"],
                message_class=value["message_class"],
                known_local=known_local,
            )
            _current(self, value, prepared)
            if not fresh:
                state = PacingLedger.attempt_status(ledger, attempt)
                outcome = (
                    AttemptOutcome(state)
                    if state in {o.value for o in AttemptOutcome}
                    else AttemptOutcome.UNKNOWN
                )
                result = await _terminal(
                    self, value, outcome, "duplicate_original", attempt=attempt
                )
                await PacingQueue._release(self, result, identity)
                return _get(self, request)
            if reservation is not None and _now(store) >= instant(reservation.lease_expires_at):
                raise Refusal("pacing_lease_expired")
            PacingLedger.mark_dispatch(ledger, attempt)
            _current(self, value, prepared)
            await _write(
                self,
                "change",
                request,
                expected={"admitting"},
                state="dispatching",
                ledger_pending=True,
            )
            _current(self, value, prepared)
            if reservation is not None and _now(store) >= instant(reservation.lease_expires_at):
                raise Refusal("pacing_lease_expired")
        except (Exception, asyncio.CancelledError) as error:
            result = await _terminal(
                self,
                value,
                AttemptOutcome.DEFINITIVELY_NOT_SENT,
                "rate_limited"
                if type(error) is PacingLimited
                else "pacing_expired"
                if _now(store) >= _deadline(value)
                else "binding_denied",
                attempt=attempt,
                ledger_may_exist=True,
            )
            await PacingQueue._release(self, result, identity)
            return _get(self, request)
        outcome = AttemptOutcome.UNKNOWN
        provider_metadata = None

        def before_io():
            current_now = _current(self, value)
            if reservation is not None and current_now >= instant(reservation.lease_expires_at):
                raise Refusal("pacing_lease_expired")
            return current_now

        try:
            # This original coroutine is created only after both durable
            # attempt markers. Lease expiry after possible send never refunds.
            outcome = await PreparedQueuedSend.dispatch(
                prepared,
                value,
                _now(store),
                before_io=before_io,
            )
            if type(outcome) is QueueProviderRejection:
                provider_metadata = QueueProviderRejection.consume(outcome, value)
                outcome = AttemptOutcome.DEFINITIVELY_NOT_SENT
        except SendNotStarted:
            outcome = AttemptOutcome.DEFINITIVELY_NOT_SENT
        except (Exception, asyncio.CancelledError):
            outcome = AttemptOutcome.UNKNOWN
        backoff = None
        if provider_metadata is not None:
            # Pair evidence cannot become an account-wide throttle. Unknown pair
            # mappings share only their opaque unknown-pair bucket.
            pair = (
                ""
                if provider_metadata["throttle_scope"] == "account"
                else (value["pair_ref"] or "unknown-pair")
            )
            delay = provider_metadata["retry_after_s"]
            now = _now(store)
            # An unknown provider deadline is an internal indefinite barrier,
            # never a fabricated 60-second permission to send. The sentinel is
            # not published as provider Retry-After or throttled_until.
            until = 2**53 - 1 if delay is None else min(2**53 - 1, now + delay * 1_000_000)
            backoff = (
                _sender_key(value),
                pair,
                until,
                "verified_provider",
            )
        result = await _terminal(
            self,
            value,
            outcome,
            provider_metadata["code"]
            if provider_metadata is not None
            else "whatsapp_send_uncertain"
            if outcome is AttemptOutcome.UNKNOWN
            else None,
            attempt=attempt,
            backoff=backoff,
        )
        await PacingQueue._release(self, result, identity)
        return _get(self, request)

    async def _send_native_prepared(self, value, prepared, identity):
        """Queue barrier first; the original native POST owns all ledger effects."""
        from .native_whatsapp_accounting import consume_native_queued_completion

        owner = _owner(self)
        store = owner.configuration[1]
        _current(self, value, prepared)
        await _write(
            self,
            "change",
            value["request_id"],
            expected={"admitting"},
            state="dispatching",
            code="native_owner_dispatch",
            ledger_pending=True,
        )

        def before_io():
            check_native_queue_owner(self, owner, owner.native_prepared, value)
            return _now(store)

        try:
            await PreparedQueuedSend.dispatch(prepared, value, _now(store), before_io=before_io)
        except (Exception, asyncio.CancelledError):
            pass  # Only the module-issued original completion can classify it.
        outcome, metadata, pending = consume_native_queued_completion(owner.native_prepared)
        backoff = None
        if metadata is not None:
            pair = (
                ""
                if metadata["throttle_scope"] == "account"
                else value["pair_ref"] or "unknown-pair"
            )
            delay, now = metadata["retry_after_s"], _now(store)
            until = 2**53 - 1 if delay is None else min(2**53 - 1, now + delay * 1_000_000)
            backoff = _sender_key(value), pair, until, "verified_provider"
        result = await _write(
            self,
            "change",
            value["request_id"],
            expected={"dispatching"},
            state="terminal",
            outcome=outcome.value,
            code=metadata["code"]
            if metadata is not None
            else "whatsapp_send_uncertain"
            if outcome is AttemptOutcome.UNKNOWN
            else None,
            ledger_pending=pending,
            backoff=backoff,
        )
        await PacingQueue._release(self, result, identity)
        return _get(self, value["request_id"])

    async def _release(self, record, identity=None):
        owner = _owner(self)
        client = owner.configuration[4]
        if client is None or not record["release_pending"]:
            return
        value = record["job"]
        if value["sender_ref"] is None:
            return
        identity = identity or ReservationIdentity(
            value["request_id"],
            value["sender_ref"],
            value["message_class"],
            value["action_identity"],
        )
        try:
            async with asyncio.timeout(15):
                acknowledged = await ArxReservationClient.release(
                    client, identity, record["outcome"]
                )
            _owner(self)
            if acknowledged:
                await _write(
                    self,
                    "change",
                    value["request_id"],
                    expected={"terminal"},
                    release_pending=False,
                    arx_state="released",
                )
        except (Exception, asyncio.CancelledError):
            # Reconcile release only by the SAME request id. Never dispatch again.
            return

    async def reconcile(self):
        owner = _owner(self)
        async with owner.lock:
            _owner(self)
            owner.active = True
            task = asyncio.create_task(PacingQueue._reconcile_once(self))
            owner.task = task
            try:
                await finish_owned_commit(task)
                return task.result()
            finally:
                owner.active = False
                owner.task = None

    async def _reconcile_once(self):
        owner = _owner(self)
        if _is_host(owner):
            from .whatsapp_host_queue_store import call
            from .whatsapp_pacing_runtime import native_send_scope

            async with native_send_scope(owner.configuration[0]):
                await call(owner.configuration[1], "refresh")
                _owner(self)
                return await PacingQueue._reconcile_original(self)
        return await PacingQueue._reconcile_original(self)

    async def _reconcile_original(self):
        owner = _owner(self)
        if owner.active and asyncio.current_task() is owner.task:
            for record in _rows(owner.configuration[1]):
                if record["state"] == "terminal":
                    if owner.configuration[6]:
                        # A lost native handle/receipt is not reconstructed from
                        # IDs. Keep UNKNOWN/barrier and reconcile release only.
                        await PacingQueue._release(self, record)
                        continue
                    if record["ledger_pending"] or record["outcome"] == "unknown":
                        value = record["job"]
                        try:
                            sender = owner.configuration[3][0](_copy(value))
                            if (
                                type(sender) is not SenderHandle
                                or sender.sender_ref != value["sender_ref"]
                            ):
                                raise Refusal("binding_denied")
                            ledger = owner.configuration[0]
                            attempt, _fresh = PacingLedger.reserve(
                                ledger,
                                sender,
                                request_id=value["request_id"],
                                action_identity=value["action_identity"],
                                message_class=value["message_class"],
                                known_local=owner.configuration[5],
                            )
                            state = PacingLedger.attempt_status(ledger, attempt)
                            if record["outcome"] == "unknown" and state in {
                                "accepted",
                                "definitively_not_sent",
                            }:
                                QueueStore.reconcile_ledger_outcome(
                                    owner.configuration[1], value["request_id"], ledger, attempt
                                )
                            else:
                                PacingLedger.finish(
                                    ledger, attempt, AttemptOutcome(record["outcome"])
                                )
                                await _write(
                                    self,
                                    "change",
                                    value["request_id"],
                                    expected={"terminal"},
                                    ledger_pending=False,
                                )
                            record = _get(self, value["request_id"])
                        except Exception:
                            # No coherent completion evidence: preserve the
                            # original charge/visible unresolved flag, no resend.
                            pass
                    await PacingQueue._release(self, record)
            return PacingQueue._status_data(self)
        raise Refusal("binding_denied")

    def _status_data(self):
        owner = _owner(self)
        rows = _rows(owner.configuration[1])
        return {
            "queue_schema_version": 1,
            "waiting": sum(r["state"] == "pending" for r in rows),
            "terminal": {
                o.value: sum(r["outcome"] == o.value for r in rows) for o in AttemptOutcome
            },
            "release_unreconciled": sum(r["release_pending"] for r in rows),
            "ledger_unreconciled": sum(r["ledger_pending"] for r in rows),
            "shared_budget_guaranteed": False,
            "storage": _store_status(owner.configuration[1]),
        }

    def status(self):
        owner = _owner(self)
        if _is_host(owner):
            raise Refusal("binding_denied")
        return PacingQueue._status_data(self)

    async def async_status(self):
        owner = _owner(self)
        if not _is_host(owner):
            return PacingQueue.status(self)
        from .whatsapp_host_queue_store import call

        async with owner.lock:
            await call(owner.configuration[1], "refresh")
            _owner(self)
            return PacingQueue._status_data(self)

    async def async_close(self):
        owner = _QUEUES.get(self)
        if owner is None or owner.closed:
            return
        if not _is_host(owner):
            return PacingQueue.close(self)
        if owner.task is asyncio.current_task():
            raise Refusal("operation_in_progress")
        from .whatsapp_host_queue_store import close_store
        from .whatsapp_pacing_runtime import retire_native_queue

        async def finish():
            async with owner.lock:
                try:
                    await close_store(owner.configuration[1])
                except BaseException:
                    # Retain the exact original queue/store/host registration
                    # and first close Task. A failed join cannot permit rebind.
                    owner.cleanup_failed = True
                    raise
                else:
                    owner.closed = True
                    retire_native_queue(owner.configuration[0], self)
                    _QUEUES.pop(self, None)

        if owner.close_task is None:
            owner.close_task = asyncio.create_task(finish())
        await finish_owned_commit(owner.close_task)

    def close(self):
        owner = _QUEUES.get(self)
        if owner is None or owner.closed:
            return
        if owner.active:
            raise Refusal("operation_in_progress")
        if _is_host(owner):
            raise Refusal("binding_denied")
        try:
            QueueStore.close(owner.configuration[1])
        finally:
            owner.closed = True
            if _QUEUES.get(self) is owner:
                _QUEUES.pop(self)
