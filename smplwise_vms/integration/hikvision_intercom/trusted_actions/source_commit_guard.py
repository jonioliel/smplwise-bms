"""An extra refusal fence for a scoped native desired-state commit.

This never grants authority. The original repository and current source guard
are supplied by the admitted receiver, for its actual calling Task only.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Callable
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from .validation import Refusal

_commit_scopes = ContextVar("wiskey_source_commit_scopes", default=())


@dataclass(frozen=True, repr=False)
class _CommitScope:
    repository: object
    guard: Callable[[], None]
    task: asyncio.Task
    active: list
    attachment: Callable | None = None


@contextmanager
def source_commit(
    repository: object, guard: Callable[[], None], *, attachment: Callable | None = None
):
    task = asyncio.current_task()
    if (
        repository is None
        or task is None
        or not callable(guard)
        or inspect.iscoroutinefunction(guard)
    ):
        raise ValueError("original repository and synchronous current source guard required")
    if attachment is not None and (
        not callable(attachment) or inspect.iscoroutinefunction(attachment)
    ):
        raise ValueError("synchronous original candidate attachment required")
    scope = _CommitScope(repository, guard, task, [True], attachment)
    marker = _commit_scopes.set((*_commit_scopes.get(), scope))
    try:
        yield
    finally:
        scope.active[0] = False
        _commit_scopes.reset(marker)


def check_source_commit(repository: object) -> None:
    scopes = _commit_scopes.get()
    if not scopes:
        return
    task = asyncio.current_task()
    if task is None:
        raise Refusal("binding_denied")
    for scope in scopes:
        if (
            type(scope) is not _CommitScope
            or scope.repository is not repository
            or scope.task is not task
            or scope.active[0] is not True
        ):
            raise Refusal("binding_denied")
        guard = scope.guard
        # No remembered verdict. A non-None/awaitable result is not accepted,
        # awaited, cancelled or treated as ownership of a foreign resource.
        if guard() is not None:
            raise Refusal("binding_denied")
        if (
            _commit_scopes.get() is not scopes
            or scope.active[0] is not True
            or scope.repository is not repository
            or scope.task is not task
            or scope.guard is not guard
        ):
            raise Refusal("binding_denied")
        if task.cancelling():
            raise asyncio.CancelledError


def attach_source_commit(repository: object, before: dict, candidate: dict, result: object) -> None:
    """Attach bounded source evidence to the actual native candidate, before save.

    Runs on the original calling Task after any CPU preparation thread joins.
    This never performs a second persistence operation. Empty scopes preserve
    ordinary native commits. Copied contexts cannot authorize child Tasks.
    """
    scopes = _commit_scopes.get()
    check_source_commit(repository)
    for scope in scopes:
        attachment = scope.attachment
        if attachment is not None:
            if attachment(before, candidate, result) is not None:
                raise Refusal("binding_denied")
            check_source_commit(repository)
            if _commit_scopes.get() is not scopes or scope.attachment is not attachment:
                raise Refusal("binding_denied")
