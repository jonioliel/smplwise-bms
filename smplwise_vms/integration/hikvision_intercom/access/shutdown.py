"""Join the original central cleanup sequence, including after a stage fails.

This coordinates the checkpoint and schedule workers registered at construction.
It does not establish ownership of every AccessManager/device worker.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from contextvars import ContextVar, copy_context
from dataclasses import dataclass
from functools import partial
from typing import Any

from .checkpoint_jobs import CheckpointJobs, _worker_owners
from .commit_tasks import finish_owned_commit
from .schedule_work_queue import ScheduleWorkQueue, _queue_scopes

_shutdown_scopes = ContextVar("wiskey_access_shutdown_scopes", default=())


@dataclass(frozen=True, repr=False)
class _ShutdownOwner:
    checkpoint: Any
    queue: Any
    steps: tuple
    life: list


class AccessShutdown:
    def __init__(
        self,
        checkpoint: CheckpointJobs,
        queue: ScheduleWorkQueue,
        *,
        stop_timer: Callable[[], None],
        manager_close: Callable[[], Awaitable[None]],
        fleet_flush: Callable[[], Awaitable[None]] | None,
        hold_close: Callable[[], Awaitable[None]] | None = None,
    ) -> None:
        if type(checkpoint) is not CheckpointJobs or type(queue) is not ScheduleWorkQueue:
            raise TypeError("original access workers required")

        async def timer() -> None:
            stop_timer()

        steps = [timer]
        if hold_close is not None:
            steps.append(hold_close)
        steps.append(partial(CheckpointJobs.close, checkpoint))
        if fleet_flush is not None:
            steps.append(fleet_flush)
        steps.extend((partial(ScheduleWorkQueue.close, queue), manager_close))
        self._creation = _ShutdownOwner(checkpoint._creation, queue._creation, tuple(steps), [None])

    def _owns_current(self) -> bool:
        o = self._creation
        task = asyncio.current_task()
        return (
            task in o.checkpoint.active
            or task in o.queue.active
            or any(
                owner is o.checkpoint and not worker.done()
                for owner, worker in _worker_owners.get()
            )
            or any(owner is o.queue and active[0] for owner, active in _queue_scopes.get())
            or any(owner is o and active[0] for owner, active in _shutdown_scopes.get())
        )

    async def close(self) -> None:
        o = self._creation
        owned = AccessShutdown._owns_current(self)
        # Close admission before the parent task's first turn. Already admitted
        # atomic saves keep their original child-specific completion behavior.
        o.checkpoint.life[0] = o.queue.life[0] = True
        if o.life[0] is None:

            async def finish() -> None:
                active = [True]
                marker = _shutdown_scopes.set((*_shutdown_scopes.get(), (o, active)))
                first: BaseException | None = None
                try:
                    for step in o.steps:
                        try:
                            await step()
                        except (Exception, asyncio.CancelledError) as err:
                            # Failure is still reported after every later original
                            # stage has had its cleanup attempt. No success fiction.
                            if first is None:
                                first = err
                    if first is not None:
                        raise first
                finally:
                    active[0] = False
                    _shutdown_scopes.reset(marker)

            # The parent must join these children, not inherit one child's
            # self-wait deferral. Other cleanup ancestry remains intact.
            scope = copy_context()
            scope.run(
                _worker_owners.set,
                tuple(item for item in _worker_owners.get() if item[0] is not o.checkpoint),
            )
            scope.run(
                _queue_scopes.set,
                tuple(item for item in _queue_scopes.get() if item[0] is not o.queue),
            )
            o.life[0] = asyncio.create_task(finish(), context=scope)
        if owned:
            return
        await finish_owned_commit(o.life[0])
