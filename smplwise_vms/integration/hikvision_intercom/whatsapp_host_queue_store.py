"""Closed asynchronous ownership of the existing bounded QueueStore.

Only metadata crosses to the HA loop. SQLite construction, reads, writes and
close stay on this store's original single worker. No source/permission verdict
is retained in the snapshots; every native guard still resolves current source.
"""

from __future__ import annotations

import asyncio
import json
import threading
import weakref
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from .access.commit_tasks import finish_owned_commit
from .trusted_actions.validation import Refusal
from .whatsapp_pacing_queue_store import QueueStore, encoded, instant

_OWNERS = weakref.WeakKeyDictionary()


@dataclass(repr=False)
class _Owner:
    loop: object
    thread: int
    worker: object
    clock: object
    store: object = None
    rows: object = None
    backoffs: object = None
    status: object = None
    last_now: int = 0
    closed: bool = False
    poisoned: bool = False
    lock: object = None
    close_task: object = None


class HostQueueStorePort:
    __slots__ = ("__weakref__",)


class _OpenCleanupFailed(Refusal):
    """Private original resource receipt; never a wire/source authority DTO."""

    def __init__(self, port, error):
        super().__init__("cleanup_failed")
        self._port, self._error = port, error


def _owner(port, *, cleanup=False):
    owner = _OWNERS.get(port) if type(port) is HostQueueStorePort else None
    if (
        owner is None
        or owner.closed
        or owner.poisoned
        and not cleanup
        or owner.loop is not asyncio.get_running_loop()
        or owner.thread != threading.get_ident()
    ):
        raise Refusal("binding_denied")
    if not cleanup and owner.store is not None:
        # QueueStore's original ownership/files checker does not issue SQL.
        # Database/table/geometry validation remains on the original worker.
        from .whatsapp_pacing_queue_store import _owner as original_store_owner

        original_store_owner(owner.store)
    return owner


def _snapshot(store):
    records = QueueStore.rows(store)
    rows = {row["job"]["request_id"]: encoded(row) for row in records}
    # Derived only by the ORIGINAL store method, including its sender union.
    pairs = {
        (row["job"]["sender_ref"] or "unknown-global", row["job"]["pair_ref"] or "unknown-pair")
        for row in records
        if row["state"] == "pending"
    }
    backoffs = {pair: QueueStore.backoffs(store, *pair) for pair in pairs}
    status = encoded(QueueStore.status(store))
    now = QueueStore.now(store)
    return rows, backoffs, status, now


def _publish(owner, snapshot):
    rows, backoffs, status, now = snapshot
    if (
        type(rows) is not dict
        or type(backoffs) is not dict
        or type(status) is not str
        or type(now) is not int
    ):
        raise Refusal("invalid_storage")
    owner.rows, owner.backoffs, owner.status = rows, backoffs, status
    owner.last_now = max(owner.last_now, now)


async def open_store(path, *, queue_id, profile, clock, expect_existing):
    port = HostQueueStorePort()
    owner = _Owner(
        asyncio.get_running_loop(),
        threading.get_ident(),
        ThreadPoolExecutor(max_workers=1, thread_name_prefix="wiskey-wa-queue"),
        clock,
        lock=asyncio.Lock(),
    )
    _OWNERS[port] = owner

    def construct():
        store = QueueStore(
            path, queue_id=queue_id, profile=profile, clock=clock, expect_existing=expect_existing
        )
        # Publish only the actual cleanup root before metadata construction.
        # No SQL runs on the HA loop and the port is not returned until joined.
        owner.store = store
        return store, _snapshot(store)

    future = owner.loop.run_in_executor(owner.worker, construct)
    try:
        await finish_owned_commit(future)
        owner.store, snapshot = future.result()
        _publish(owner, snapshot)
        _owner(port)
        return port
    except BaseException:
        if owner.store is not None:
            try:
                await close_store(port)
            except BaseException as error:
                if isinstance(error, asyncio.CancelledError) and owner.closed:
                    # close_store publishes closed only after actual native
                    # close and worker join; this is cancelled viewing, not a
                    # failed resource cleanup receipt.
                    raise
                # Keep the exact original port/worker and its first failed Task
                # available to the owning host even before a port was returned.
                raise _OpenCleanupFailed(port, error) from error
        else:
            owner.closed = True
            owner.worker.shutdown(wait=True)
            _OWNERS.pop(port, None)
        raise


async def call(port, operation, *args, **kwargs):
    owner = _owner(port)
    if operation not in {"refresh", "put", "change", "backoff"}:
        raise Refusal("binding_denied")
    # Closed data-only arguments, no callback/Future/thread adoption.
    kwargs = dict(kwargs)
    if operation == "change" and type(kwargs.get("expected")) in {set, frozenset}:
        kwargs["expected"] = sorted(kwargs["expected"])
    captured = json.loads(encoded([args, kwargs]))
    async with owner.lock:
        if _owner(port) is not owner:
            raise Refusal("binding_denied")
        store = owner.store

        def original():
            QueueStore.now(store)
            if operation == "refresh":
                result = None
            elif operation == "put":
                result = QueueStore.put(store, *captured[0], **captured[1])
            elif operation == "change":
                options = captured[1]
                options["expected"] = set(options["expected"])
                result = QueueStore.change(store, *captured[0], **options)
            else:
                result = QueueStore.backoff(store, *captured[0], **captured[1])
            snapshot = _snapshot(store)
            return json.loads(encoded(result)), snapshot

        future = owner.loop.run_in_executor(owner.worker, original)
        cancelled = False
        try:
            try:
                await finish_owned_commit(future)
            except asyncio.CancelledError:
                cancelled = True
            result, snapshot = future.result()
            if _owner(port) is not owner:
                raise Refusal("binding_denied")
            _publish(owner, snapshot)
        except BaseException:
            # An admitted SQL operation may have committed. Old cached rows
            # cannot authorize another operation until original reopen.
            owner.poisoned = True
            raise
        if cancelled:
            raise asyncio.CancelledError
        return result


def now(port):
    owner = _owner(port)
    value = instant(owner.clock())  # Fresh time, never a source-allow cache.
    if _owner(port) is not owner or value < owner.last_now:
        raise Refusal("clock_unavailable")
    owner.last_now = value
    return value


def rows(port):
    return [json.loads(raw) for raw in _owner(port).rows.values()]


def row(port, request_id):
    raw = _owner(port).rows.get(request_id)
    if raw is None:
        raise Refusal("binding_denied")
    return json.loads(raw)


def backoffs(port, sender, pair):
    owner = _owner(port)
    if (sender, pair) not in owner.backoffs:
        raise Refusal("binding_denied")
    return owner.backoffs[sender, pair]


def status(port):
    return json.loads(_owner(port).status)


async def close_store(port):
    owner = _OWNERS.get(port) if type(port) is HostQueueStorePort else None
    if owner is None or owner.closed:
        return
    _owner(port, cleanup=True)
    async def finish():
        async with owner.lock:
            # Earlier admitted writes have published before this lock. Fresh
            # calls cannot use cached data while close is pending or failed.
            owner.poisoned = True
            future = owner.loop.run_in_executor(
                owner.worker, lambda: QueueStore.close(owner.store)
            )
            await finish_owned_commit(future)
            owner.worker.shutdown(wait=True)
            owner.closed = True
            _OWNERS.pop(port, None)

    if owner.close_task is None:
        owner.close_task = asyncio.create_task(finish())
    await finish_owned_commit(owner.close_task)
