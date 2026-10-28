"""Join one owned media future; no authority, transport or session state."""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from typing import Any

_closing_owners = ContextVar('wiskey_native_closing_owners', default=())


@contextmanager
def closing_owner(owner: Any):
    """Mark actual cleanup ancestry without trusting task or owner labels."""
    token = _closing_owners.set((*_closing_owners.get(), owner))
    try:
        yield
    finally:
        _closing_owners.reset(token)


def is_closing_owner(owner: Any) -> bool:
    return any(original is owner for original in _closing_owners.get())


def create_close_task(awaitable: Any, *, without_owners: tuple = ()) -> asyncio.Task:
    """Drop only this parent's child markers; preserve other cleanup ancestry."""
    context = copy_context()
    retained = tuple(owner for owner in _closing_owners.get()
        if not any(owner is removed for removed in without_owners))
    context.run(_closing_owners.set, retained)
    return asyncio.create_task(awaitable, context=context)


async def close_owned(owner: Any, awaitable: Any) -> tuple[Any, bool]:
    with closing_owner(owner):
        return await join_owned(awaitable)


async def join_owned(awaitable: Any) -> tuple[Any, bool]:
    """Capture/join this resource even after repeated caller cancellation."""
    future = asyncio.ensure_future(awaitable)
    cancelled = False
    while not future.done():
        try:
            await asyncio.shield(future)
        except asyncio.CancelledError:
            cancelled = True
    return future.result(), cancelled


class JoinedExit:
    """Preserve a context manager's original protocol and join its async exit."""

    def __init__(self, manager: Any, *, owner: Any = None):
        self._manager = manager
        self._owner = owner
        # Like async-with, resolve special methods on the type. Capture them
        # before entering so cleanup cannot switch to a replaced instance port.
        self._enter = type(manager).__aenter__
        self._exit = type(manager).__aexit__

    async def __aenter__(self) -> Any:
        return await self._enter(self._manager)

    async def __aexit__(self, exc_type: Any, exc: Any, traceback: Any) -> Any:
        manager, exit_port = self._manager, self._exit
        if self._owner is None:
            suppressed, cancelled = await join_owned(exit_port(manager, exc_type, exc, traceback))
        else:
            suppressed, cancelled = await close_owned(self._owner, exit_port(manager, exc_type, exc, traceback))
        if cancelled:
            raise asyncio.CancelledError
        return suppressed
