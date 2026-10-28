"""Finish an owned persistence task before releasing its caller's write lock."""

from __future__ import annotations

import asyncio


async def finish_owned_commit[T](task: asyncio.Future[T]) -> None:
    """Defer caller cancellation until save and publication have both finished."""
    cancelled = False
    while not task.done():
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            cancelled = True
    task.result()
    if cancelled:
        raise asyncio.CancelledError
