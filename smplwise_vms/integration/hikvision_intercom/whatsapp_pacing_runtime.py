"""Own the private local pacing ledger without claiming provider visibility."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import secrets
import stat
import weakref
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from contextvars import ContextVar, copy_context
from dataclasses import dataclass, field
from functools import partial
from pathlib import Path
from types import MethodType

from .access.commit_tasks import finish_owned_commit
from .access.models import AccessError
from .const import DOMAIN
from .trusted_actions.validation import Refusal

_HOSTS = weakref.WeakKeyDictionary()
_NATIVE_PORTS = weakref.WeakKeyDictionary()
_HOST_ROOTS = weakref.WeakKeyDictionary()
_SEND_SCOPES = ContextVar("wiskey_host_send_scopes", default=())
_FORMAT = "wiskey-whatsapp-pacing-host.v1"
_DIRECTORY = f"{DOMAIN}.whatsapp_pacing"


def _runtime_path(hass):
    path = Path(hass.config.path(".storage", _DIRECTORY))
    if not path.is_absolute():
        raise AccessError("whatsapp_pacing_unavailable")
    return path


def _identity(path, directory=False):
    info = path.lstat()
    if (
        not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
        or info.st_uid != os.getuid()
        or info.st_mode & 0o077
        or not directory
        and info.st_nlink != 1
    ):
        raise Refusal("storage_path_rebound")
    return info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)


def _json_pairs(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise Refusal("binding_denied")
        value[key] = item
    return value


@dataclass(repr=False)
class _Storage:
    ledger: object
    sender: object
    path: Path
    directory_identity: tuple
    marker_identity: tuple
    marker_sha256: str
    database_identity: tuple


def _storage_fields(storage):
    return (
        storage.path,
        storage.directory_identity,
        storage.marker_identity,
        storage.marker_sha256,
        storage.database_identity,
    )


def _storage_check(storage):
    if (
        _identity(storage.path, True) != storage.directory_identity
        or _identity(storage.path / "identity.json") != storage.marker_identity
        or _identity(storage.path / "usage.sqlite") != storage.database_identity
        or (storage.path / "identity.json").stat().st_size > 2048
        or hashlib.sha256((storage.path / "identity.json").read_bytes()).hexdigest()
        != storage.marker_sha256
    ):
        raise Refusal("storage_path_rebound")


def _open(path):
    from .whatsapp_pacing_ledger import PacingLedger, PacingLedgerProfile

    # A DB without its original marker is an interrupted/foreign installation,
    # never an invitation to reset counters or adopt another database.
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        pass
    directory_identity = _identity(path, True)
    marker, database = path / "identity.json", path / "usage.sqlite"
    existing = marker.exists() or marker.is_symlink()
    if existing:
        marker_identity = _identity(marker)
        if marker.stat().st_size > 2048:
            raise Refusal("binding_denied")
        raw = marker.read_bytes()
        value = json.loads(raw, object_pairs_hook=_json_pairs)
        if (
            type(value) is not dict
            or set(value) != {"format", "ledger_id", "database_identity"}
            or value["format"] != _FORMAT
            or type(value["ledger_id"]) is not str
            or len(value["ledger_id"]) != 64
            or any(c not in "0123456789abcdef" for c in value["ledger_id"])
            or type(value["database_identity"]) is not list
            or len(value["database_identity"]) != 4
            or any(type(v) is not int for v in value["database_identity"])
            or tuple(value["database_identity"]) != _identity(database)
        ):
            raise Refusal("binding_denied")
        ledger_id = value["ledger_id"]
    else:
        if any(path.iterdir()):
            raise Refusal("binding_denied")
        ledger_id = secrets.token_hex(32)
    ledger = PacingLedger(
        database,
        ledger_id=ledger_id,
        profile=PacingLedgerProfile(),
        expect_existing=existing,
    )
    try:
        database_identity = _identity(database)
        if not existing:
            raw = json.dumps(
                {
                    "format": _FORMAT,
                    "ledger_id": ledger_id,
                    "database_identity": list(database_identity),
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
            descriptor = os.open(
                marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
            )
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            parent = os.open(path, os.O_RDONLY)
            try:
                os.fsync(parent)
            finally:
                os.close(parent)
            marker_identity = _identity(marker)
        storage = _Storage(
            ledger,
            PacingLedger.unknown_sender(ledger),
            path,
            directory_identity,
            marker_identity,
            hashlib.sha256(raw).hexdigest(),
            database_identity,
        )
        _storage_check(storage)
        return storage
    except BaseException:
        PacingLedger.close(ledger)
        raise


@dataclass(repr=False)
class _Host:
    hass: object
    config: object
    path: Path
    worker: object
    lock: object
    slot: object
    storage: object = None
    closed: bool = False
    stopping: bool = False
    active_sends: set = field(default_factory=set)
    close_task: object = None
    send_depths: dict = field(default_factory=dict)
    send_finished: dict = field(default_factory=dict)
    queues: set = field(default_factory=set)
    queue_opening: object = None
    cleanup_failed: bool = False
    failed_queue_stores: set = field(default_factory=set)


def _same_path_method(current, original):
    return current is original or (
        type(current) is MethodType
        and type(original) is MethodType
        and current.__func__ is original.__func__
        and current.__self__ is original.__self__
    )


def _host(hass):
    host = _HOSTS.get(hass)
    roots = _HOST_ROOTS.get(hass)
    if (
        host is None
        or host.closed
        or host.cleanup_failed
        or host.storage is None
        or roots is None
        or host.worker is not roots[0]
        or host.storage is not roots[1]
        or type(host.storage) is not _Storage
        or host.storage.sender is not roots[7]
        or any(a is not b for a, b in zip(_storage_fields(host.storage), roots[8], strict=True))
        or host.storage.ledger is not roots[2]
        or host.lock is not roots[3]
        or host.path is not roots[4]
        or host.hass() is not hass
        or host.config is not roots[6]
        or hass.config is not roots[6]
        or not _same_path_method(hass.config.path, roots[5])
        or _runtime_path(hass) != host.path
        or hass.data.get(DOMAIN, {}).get("whatsapp_pacing") is not host.slot
    ):
        raise AccessError("whatsapp_pacing_unavailable")
    return host


async def _run(hass, operation):
    host = _host(hass)
    worker, storage, _ledger, lock = _HOST_ROOTS[hass][:4]
    async with lock:
        if _host(hass) is not host:
            raise AccessError("whatsapp_pacing_unavailable")

        def owned():
            if _host(hass) is not host:
                raise AccessError("whatsapp_pacing_unavailable")
            _storage_check(storage)
            result = operation(storage)
            if _host(hass) is not host:
                raise AccessError("whatsapp_pacing_unavailable")
            _storage_check(storage)
            return result

        future = asyncio.get_running_loop().run_in_executor(worker, owned)
        # Join an original durable write even if its viewer disconnects.
        await finish_owned_commit(future)
        if _host(hass) is not host:
            raise AccessError("whatsapp_pacing_unavailable")
        return future.result()


async def async_setup_whatsapp_pacing(hass):
    """Start local accounting only; no sender discovery, service call or Arx I/O."""
    if hass in _HOSTS:
        if _HOSTS[hass].stopping or _HOSTS[hass].cleanup_failed:
            raise AccessError("whatsapp_pacing_unavailable")
        return
    config = hass.config
    path_method = config.path
    path = _runtime_path(hass)
    if hass.config is not config or not _same_path_method(config.path, path_method):
        raise AccessError("whatsapp_pacing_unavailable")
    worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="wiskey-wa-pacing")
    host = _Host(weakref.ref(hass), hass.config, path, worker, asyncio.Lock(), object())
    _HOSTS[hass] = host
    hass.data.setdefault(DOMAIN, {})["whatsapp_pacing"] = host.slot
    future = None
    try:
        future = asyncio.get_running_loop().run_in_executor(worker, partial(_open, path))
        await finish_owned_commit(future)
        host.storage = future.result()
        _HOST_ROOTS[hass] = (
            worker,
            host.storage,
            host.storage.ledger,
            host.lock,
            path,
            path_method,
            config,
            host.storage.sender,
            _storage_fields(host.storage),
        )
        _host(hass)
    except BaseException:
        host.stopping = True
        cleanup_cancelled = False
        try:
            if (
                future is not None
                and future.done()
                and not future.cancelled()
                and future.exception() is None
            ):
                storage = host.storage = future.result()
                if hass not in _HOST_ROOTS:
                    # Cancellation can arrive after original construction but
                    # before publication. These are cleanup roots only, never
                    # authority to use an unvalidated host.
                    _HOST_ROOTS[hass] = (
                        worker,
                        storage,
                        storage.ledger,
                        host.lock,
                        path,
                        path_method,
                        config,
                        storage.sender,
                        _storage_fields(storage),
                    )
                from .whatsapp_pacing_ledger import PacingLedger

                host.close_task = asyncio.get_running_loop().run_in_executor(
                    worker, partial(PacingLedger.close, storage.ledger)
                )
                try:
                    await finish_owned_commit(host.close_task)
                except asyncio.CancelledError:
                    if (
                        not host.close_task.done()
                        or host.close_task.cancelled()
                        or host.close_task.exception() is not None
                    ):
                        raise
                    # Caller cancellation after an acknowledged original close
                    # cannot turn joined resources into failed cleanup.
                    cleanup_cancelled = True
            worker.shutdown(wait=True)
        except BaseException:
            host.cleanup_failed = True
            raise
        host.closed = True
        _HOST_ROOTS.pop(hass, None)
        if _HOSTS.get(hass) is host:
            _HOSTS.pop(hass, None)
        if cleanup_cancelled:
            raise asyncio.CancelledError from None
        raise


def owns_current_pacing_send(hass: object) -> bool:
    """Original send ancestry for cleanup deferral only, never authority."""
    host = _HOSTS.get(hass)
    if host is None:
        return False
    caller = asyncio.current_task()
    return caller in host.active_sends or any(
        original is host and active[0] and task in host.active_sends and not task.done()
        for original, task, active in _SEND_SCOPES.get()
    )


async def close_whatsapp_pacing(hass):
    """Join and close the original worker even if its public slot was replaced."""
    host = _HOSTS.get(hass)
    if host is None or host.closed:
        return
    roots = _HOST_ROOTS.get(hass)
    if roots is None:
        raise AccessError("whatsapp_pacing_unavailable")
    worker, storage, ledger, lock = roots[:4]
    caller = asyncio.current_task()
    owned = owns_current_pacing_send(hass)
    # Admission closes before the cleanup Task takes its first turn.
    host.stopping = True

    async def finish():
        # Join the exact original outer scopes, not their callers' whole Task
        # lifetimes. A caller can continue unrelated work after a send finishes.
        pending = tuple(host.send_finished[task] for task in tuple(host.active_sends))
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        # Queue owns a separate SQL worker; join/close it before the borrowed
        # ledger worker, even when its public queue labels were replaced.
        from .whatsapp_pacing_queue import PacingQueue

        queue_error = None
        for queue in tuple(host.queues):
            try:
                await PacingQueue.async_close(queue)
            except BaseException as error:
                queue_error = queue_error or error
        from .whatsapp_host_queue_store import close_store

        for port in tuple(host.failed_queue_stores):
            try:
                await close_store(port)
            except BaseException as error:
                queue_error = queue_error or error
        try:
            if queue_error is not None:
                raise queue_error
            async with lock:
                if storage is not None:
                    from .whatsapp_pacing_ledger import PacingLedger

                    future = asyncio.get_running_loop().run_in_executor(
                        worker, partial(PacingLedger.close, ledger)
                    )
                    await finish_owned_commit(future)
                worker.shutdown(wait=True)
                host.closed = True
                _HOST_ROOTS.pop(hass, None)
                for port, record in tuple(_NATIVE_PORTS.items()):
                    if record[1] is host:
                        _NATIVE_PORTS.pop(port, None)
                # Config owns hass. Retire the original module root rather
                # than retaining its weak key through host.config -> hass.
                if _HOSTS.get(hass) is host:
                    _HOSTS.pop(hass, None)
        except BaseException:
            # A refused close is not evidence that the original resources
            # joined. Keep the exact roots and cached first error; no rebind.
            host.cleanup_failed = True
            raise

    if host.close_task is None:
        context = copy_context()
        context.run(
            _SEND_SCOPES.set, tuple(item for item in _SEND_SCOPES.get() if item[0] is not host)
        )
        host.close_task = asyncio.create_task(finish(), context=context)
    if owned or caller is host.close_task:
        return
    await finish_owned_commit(host.close_task)


@asynccontextmanager
async def local_send_scope(hass):
    host = _host(hass)
    task = asyncio.current_task()
    if host.stopping and task not in host.active_sends:
        raise AccessError("whatsapp_pacing_unavailable")
    if task not in host.active_sends:
        host.send_finished[task] = asyncio.get_running_loop().create_future()
    host.send_depths[task] = host.send_depths.get(task, 0) + 1
    host.active_sends.add(task)
    active = [True]
    marker = _SEND_SCOPES.set((*_SEND_SCOPES.get(), (host, task, active)))
    try:
        yield
    finally:
        active[0] = False
        _SEND_SCOPES.reset(marker)
        depth = host.send_depths[task] - 1
        if depth:
            host.send_depths[task] = depth
        else:
            host.send_depths.pop(task)
            host.active_sends.discard(task)
            finished = host.send_finished.pop(task)
            if not finished.done():
                finished.set_result(None)


async def pacing_snapshot(hass):
    from .whatsapp_pacing_ledger import PacingLedger

    return await _run(hass, lambda storage: PacingLedger.snapshot(storage.ledger, storage.sender))


async def reserve_local_send(hass, request_id, action_identity):
    from .whatsapp_pacing_ledger import PacingLedger

    return await _run(
        hass,
        lambda storage: PacingLedger.reserve(
            storage.ledger,
            storage.sender,
            request_id=request_id,
            action_identity=action_identity,
            message_class="code",
            known_local=True,
        ),
    )


async def mark_local_dispatch(hass, attempt):
    from .whatsapp_pacing_ledger import PacingLedger

    await _run(hass, lambda storage: PacingLedger.mark_dispatch(storage.ledger, attempt))


async def finish_local_send(hass, attempt, outcome):
    from .whatsapp_pacing_ledger import PacingLedger

    await _run(hass, lambda storage: PacingLedger.finish(storage.ledger, attempt, outcome))


class HostPacingPort:
    """Opaque borrowing of the original HA-owned ledger worker; no authority."""

    __slots__ = ("__weakref__",)


def issue_native_pacing_port(hass, *, mapping=None, provider=None, sender=None):
    """Only trusted native host composition calls this; never a JSON endpoint."""
    host = _host(hass)
    if host.stopping:
        raise AccessError("whatsapp_pacing_unavailable")
    from .whatsapp_cloud_templates import CloudTemplateProvider
    from .whatsapp_pacing_ledger import SenderMappingPort, _sender

    storage = host.storage
    if any(value is not None for value in (mapping, provider, sender)):
        if (
            type(mapping) is not SenderMappingPort
            or type(provider) is not CloudTemplateProvider
            or SenderMappingPort._check(mapping)[0]() is not storage.ledger
            or mapping.source is not provider
            or mapping.provider_kind != "cloud_api"
            or mapping.provider_backend != "cloud_api"
            or _sender(storage.ledger, sender)[4] is not mapping
        ):
            raise Refusal("binding_denied")
        CloudTemplateProvider.check(provider)
    else:
        sender = storage.sender
    port = HostPacingPort()
    _NATIVE_PORTS[port] = (
        weakref.ref(hass),
        host,
        storage,
        sender,
        mapping,
        provider,
        storage.ledger,
        host.worker,
        storage.sender,
        (
            storage.path,
            storage.directory_identity,
            storage.marker_identity,
            storage.marker_sha256,
            storage.database_identity,
        ),
    )
    check_native_pacing_port(port)
    return port


def check_native_pacing_port(port):
    record = _NATIVE_PORTS.get(port) if type(port) is HostPacingPort else None
    if record is None:
        raise AccessError("whatsapp_pacing_unavailable")
    hass = record[0]()
    if (
        hass is None
        or _host(hass) is not record[1]
        or record[1].storage is not record[2]
        or record[2].ledger is not record[6]
        or record[1].worker is not record[7]
        or record[2].sender is not record[8]
    ):
        raise AccessError("whatsapp_pacing_unavailable")
    if any(
        a is not b
        for a, b in zip(
            (
                record[2].path,
                record[2].directory_identity,
                record[2].marker_identity,
                record[2].marker_sha256,
                record[2].database_identity,
            ),
            record[9],
            strict=True,
        )
    ):
        raise Refusal("storage_path_rebound")
    _storage_check(record[2])
    from .whatsapp_pacing_ledger import SenderMappingPort, _sender

    _sender(record[6], record[3])  # Ownership/files/current mapping only; no SQL.
    if record[4] is not None:
        from .whatsapp_cloud_templates import CloudTemplateProvider

        SenderMappingPort._check(record[4])
        if record[4].source is not record[5]:
            raise Refusal("binding_denied")
        CloudTemplateProvider.check(record[5])
    return hass


@asynccontextmanager
async def native_send_scope(port):
    """Join the original native send task before the original worker closes."""
    hass = check_native_pacing_port(port)
    async with local_send_scope(hass):
        check_native_pacing_port(port)
        yield


def _native_sending(port):
    hass = check_native_pacing_port(port)
    if asyncio.current_task() not in _host(hass).active_sends:
        raise AccessError("whatsapp_pacing_unavailable")
    return hass


async def reserve_native_send(
    port,
    *,
    request_id,
    action_identity,
    message_class,
    origin=None,
    known_local=False,
    dispatch_binding=None,
):
    from .whatsapp_pacing_ledger import PacingLedger

    hass = _native_sending(port)
    binding_arguments = {} if dispatch_binding is None else {"dispatch_binding": dispatch_binding}
    result = await _run(
        hass,
        lambda storage: PacingLedger.reserve(
            storage.ledger,
            native_queue_sender(port),
            request_id=request_id,
            action_identity=action_identity,
            message_class=message_class,
            origin=origin,
            known_local=known_local,
            **binding_arguments,
        ),
    )
    _native_sending(port)
    return result


async def mark_native_dispatch(port, attempt):
    from .whatsapp_pacing_ledger import PacingLedger

    hass = _native_sending(port)
    await _run(hass, lambda storage: PacingLedger.mark_dispatch(storage.ledger, attempt))
    _native_sending(port)


async def finish_native_send(port, attempt, outcome):
    from .whatsapp_pacing_ledger import PacingLedger

    hass = _native_sending(port)
    await _run(hass, lambda storage: PacingLedger.finish(storage.ledger, attempt, outcome))


def bind_native_cloud_dispatch(port, provider, provider_attempt):
    """Issue on the original POST task; the ledger issuer must not use SQL here."""
    from .whatsapp_pacing_ledger import PacingLedger

    hass = _native_sending(port)
    storage = _host(hass).storage
    return PacingLedger.bind_cloud_dispatch(
        storage.ledger, native_queue_sender(port), provider, provider_attempt
    )


async def finish_native_provider_rejection(port, attempt, error, *, dispatch_binding):
    from .whatsapp_pacing_ledger import PacingLedger

    hass = _native_sending(port)
    await _run(
        hass,
        lambda storage: PacingLedger.finish_provider_rejection(
            storage.ledger, attempt, error, dispatch_binding=dispatch_binding
        ),
    )


def native_queue_sender(port):
    """Original issued identity only; never access SQLite on the HA loop."""
    check_native_pacing_port(port)
    return _NATIVE_PORTS[port][3]


def native_queue_provider(port):
    check_native_pacing_port(port)
    return _NATIVE_PORTS[port][5]


async def native_queue_admission(port, sender):
    from .whatsapp_pacing_ledger import PacingLedger

    hass = _native_sending(port)
    if native_queue_sender(port) is not sender:
        raise Refusal("binding_denied")
    await _run(
        hass,
        lambda storage: PacingLedger.check_local_admission(
            storage.ledger, native_queue_sender(port)
        ),
    )
    if native_queue_sender(port) is not sender:
        raise Refusal("binding_denied")
    _native_sending(port)


def begin_native_queue(port):
    """Reserve the single owned native-code queue while its worker opens."""
    hass = _native_sending(port)
    host = _host(hass)
    if host.stopping or host.queues or host.queue_opening is not None:
        raise Refusal("operation_in_progress")
    from .whatsapp_pacing_ledger import _owner

    identifier = _owner(host.storage.ledger).configuration[0]
    host.queue_opening = asyncio.current_task()
    from .whatsapp_pacing_queue import _HOST_NATIVE_PREFIX

    identity = _HOST_NATIVE_PREFIX + hashlib.sha256(identifier.encode()).hexdigest()
    return _HOST_ROOTS[hass][4] / "queue-native-code.sqlite", identity


def register_native_queue(port, queue):
    from .whatsapp_pacing_queue import PacingQueue, _owner

    hass = _native_sending(port)
    host = _host(hass)
    if (
        type(queue) is not PacingQueue
        or host.stopping
        or host.queues
        or host.queue_opening is not asyncio.current_task()
        or _owner(queue).configuration[0] is not port
    ):
        raise Refusal("binding_denied")
    host.queues.add(queue)
    host.queue_opening = None


def retire_native_queue(port, queue=None):
    """Original cleanup survives a replaced public host/queue slot."""
    record = _NATIVE_PORTS.get(port) if type(port) is HostPacingPort else None
    if record is None:
        return
    host = record[1]
    if host.queue_opening is asyncio.current_task():
        host.queue_opening = None
    if queue is not None:
        host.queues.discard(queue)


def _retain_failed_native_queue(port, queue):
    """Cleanup ownership only; a failed child never grants source authority."""
    from .whatsapp_pacing_queue import _QUEUES, PacingQueue

    record = _NATIVE_PORTS.get(port) if type(port) is HostPacingPort else None
    owner = _QUEUES.get(queue) if type(queue) is PacingQueue else None
    if (
        record is None
        or owner is None
        or owner.configuration[0] is not port
        or owner.close_task is None
        or record[1].closed
    ):
        raise Refusal("binding_denied")
    host = record[1]
    owner.cleanup_failed = True
    host.queues.add(queue)
    host.stopping = host.cleanup_failed = True


def _retain_failed_native_store(port, store):
    """Retain an original store whose opening cleanup never acknowledged join."""
    from .whatsapp_host_queue_store import _OWNERS as store_owners
    from .whatsapp_host_queue_store import HostQueueStorePort

    record = _NATIVE_PORTS.get(port) if type(port) is HostPacingPort else None
    owner = store_owners.get(store) if type(store) is HostQueueStorePort else None
    if (
        record is None
        or owner is None
        or owner.store is None
        or owner.close_task is None
        or record[1].closed
    ):
        raise Refusal("binding_denied")
    host = record[1]
    host.failed_queue_stores.add(store)
    host.stopping = host.cleanup_failed = True
