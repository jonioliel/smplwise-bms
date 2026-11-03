"""Bounded per-station background preflight; there is no production write queue."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Coroutine
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from ..trusted_actions.source_bindings import same_ports
from .commit_tasks import finish_owned_commit
from .models import AccessError
from .schedule_operations import WORK_ERRORS, ScheduleOperations

_queue_scopes = ContextVar("wiskey_schedule_queue_scopes", default=())


@dataclass(frozen=True, repr=False)
class _QueueOwner:
    store: Any
    check: Any
    changed: Any
    task_factory: Any
    tasks: dict
    slots: Any
    lock: Any
    ports: tuple
    active: dict
    life: list


class ScheduleWorkQueue:
    def __init__(
        self,
        store: ScheduleOperations,
        check: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]],
        changed: Callable[[], None],
        task_factory: Callable[[Coroutine[Any, Any, None]], asyncio.Task[None]],
    ) -> None:
        self.store, self._check, self._changed, self._task_factory = (
            store,
            check,
            changed,
            task_factory,
        )
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._slots = asyncio.Semaphore(3)
        self._closed = False
        self._lock = asyncio.Lock()
        self._creation = _QueueOwner(
            store, check, changed, task_factory, self._tasks, self._slots, self._lock,
            (store.job, store.async_update), {}, [False, None],
        )

    def _check_owner(self, *, closing_ok: bool = False) -> None:
        o = self._creation
        if (
            self.store is not o.store or self._check is not o.check or self._changed is not o.changed
            or self._task_factory is not o.task_factory or self._tasks is not o.tasks
            or self._slots is not o.slots or self._lock is not o.lock
            or not same_ports(o.ports, (o.store.job, o.store.async_update))
            or any(not task.done() and o.tasks.get(station) is not task
                   for task, station in tuple(o.active.items()))
            or not closing_ok and (o.life[0] or self._closed)
        ):
            raise AccessError("station_unloaded")

    @contextmanager
    def _scope(self):
        cell = [True]
        marker = _queue_scopes.set((*_queue_scopes.get(), (self._creation, cell)))
        try:
            yield
        finally:
            cell[0] = False
            _queue_scopes.reset(marker)

    async def request(self, identifier: str, revision: int) -> dict[str, Any]:
        self._check_owner()
        with self._scope():
            return await ScheduleWorkQueue._request(self, identifier, revision)

    async def _request(self, identifier: str, revision: int) -> dict[str, Any]:
        o = self._creation
        async with o.lock:
            self._check_owner()
            job = o.ports[0](identifier, revision)
            if job["station_id"] in o.tasks or job["status"] in ("queued", "checking"):
                raise AccessError("schedule_read_busy")
            try:
                queued = await o.ports[1](
                    identifier, revision, status="queued", error=None
                )
            except asyncio.CancelledError:
                # The atomic save may already have committed, but no worker was created.
                current = o.ports[0](identifier)
                if current["status"] == "queued" and current["revision"] == revision + 1:
                    await o.ports[1](
                        identifier,
                        current["revision"],
                        status="interrupted",
                        error="schedule_operation_interrupted",
                    )
                o.changed()
                raise
            # An already admitted enqueue still returns its durable queued result.
            # A concurrent close owns and stops its worker before new preflight I/O.
            self._check_owner(closing_ok=True)
            coroutine = ScheduleWorkQueue._run(self, identifier, job["station_id"])
            failed = False
            try:
                task = o.task_factory(coroutine)
                if not isinstance(task, asyncio.Task) or task.get_coro() is not coroutine:
                    raise AccessError("schedule_operation_failed")
                o.active[task] = job["station_id"]
                task.add_done_callback(lambda done: o.active.pop(done, None))
                o.tasks[job["station_id"]] = task
            except Exception:
                coroutine.close()
                failed = True
            if failed:
                await o.ports[1](
                    identifier,
                    queued["revision"],
                    status="failed",
                    error="schedule_operation_failed",
                )
                o.changed()
                raise AccessError("schedule_operation_failed")
            o.changed()
            return queued

    async def _run(self, identifier: str, station: str) -> None:
        with self._scope():
            await ScheduleWorkQueue._run_owned(self, identifier, station)

    async def _run_owned(self, identifier: str, station: str) -> None:
        o = self._creation
        try:
            failure = None
            try:
                async with o.slots:
                    self._check_owner()
                    job = o.ports[0](identifier)
                    job = await o.ports[1](
                        identifier, job["revision"], status="checking", error=None
                    )
                    o.changed()
                    self._check_owner()
                    result = await o.check(job)
                    self._check_owner()
                    if not o.life[0]:
                        await o.ports[1](identifier, job["revision"], **result)
            except asyncio.CancelledError:
                raise
            except Exception as err:
                failure = (
                    err.code
                    if isinstance(err, AccessError) and err.code in WORK_ERRORS
                    else "schedule_operation_failed"
                )
            # Persist outside the handler so private exception text cannot become its context.
            if failure is not None and not o.life[0]:
                job = o.ports[0](identifier)
                try:
                    await o.ports[1](
                        identifier, job["revision"], status="failed", error=failure
                    )
                except AccessError:
                    pass  # AccessStore raises a Repair; persisted checking remains recoverable.
        finally:
            o.tasks.pop(station, None)
            o.changed()

    async def cancel(
        self, identifier: str, revision: int, cleanup: Callable[[dict[str, Any]], Awaitable[None]]
    ) -> dict[str, Any]:
        self._check_owner()
        with self._scope():
            return await ScheduleWorkQueue._cancel(self, identifier, revision, cleanup)

    async def _cancel(
        self, identifier: str, revision: int, cleanup: Callable[[dict[str, Any]], Awaitable[None]]
    ) -> dict[str, Any]:
        o = self._creation
        async with o.lock:
            self._check_owner()
            job = o.ports[0](identifier, revision)
            if job["station_id"] in o.tasks:
                raise AccessError("schedule_operation_retained")
            await cleanup(job)
            self._check_owner(closing_ok=True)
            result = await o.ports[1](
                identifier, revision, status="cancelled", error=None, journal_id=None
            )
            o.changed()
            return result

    async def close(self) -> None:
        o = self._creation
        o.life[0] = True
        if o.life[1] is None:
            async def finish() -> None:
                async with o.lock:
                    self._closed = True
                    tasks = tuple(o.active)
                    for task in tasks:
                        task.cancel()
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                # Joining an already-completed task need not give its deferred
                # done callback a turn. Retire these exact original entries
                # synchronously before publishing completion of close().
                for task in tasks:
                    if task.done():
                        o.active.pop(task, None)
                # A task stopped before its first turn has no worker finally.
                o.tasks.clear()

            o.life[1] = asyncio.create_task(finish())
        # Request/save and worker/check descendants cannot join their own parent.
        # The marker only defers joining; it never authorizes a preflight request.
        if any(owner is o and cell[0] for owner, cell in _queue_scopes.get()):
            return
        await finish_owned_commit(o.life[1])
