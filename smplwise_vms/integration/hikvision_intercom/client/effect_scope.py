"""Extra refusal fence at each native HTTP attempt, including Digest exchange.

This never grants authority. An admitted coordinator supplies its current guard
and exact original request rules. Without a scope native behavior is unchanged.
Only its original Task may use a scope; copied ContextVars cannot authorize jobs.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Callable
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

import httpx

from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .emergency_fence import check_emergency_request


@dataclass(frozen=True, repr=False)
class RequestRule:
    method: str
    url: httpx.URL
    body: bytes = b""

    def __post_init__(self) -> None:
        if (
            self.method not in {"GET", "POST", "PUT", "DELETE"}
            or type(self.url) is not httpx.URL
            or self.url.scheme not in {"http", "https"}
            or type(self.body) is not bytes
            or len(self.body) > 1_048_576
        ):
            raise ValueError("exact bounded native request rule required")


@dataclass(frozen=True, repr=False)
class _EffectScope:
    client: Any
    session: Any
    transport: Any
    settings: Any
    expected_identity: Any
    enabled_doors: Any
    physical_map: tuple
    ports: tuple
    rules: tuple[RequestRule, ...]
    guard: Callable[[], None]
    task: asyncio.Task
    active: list[bool]


_scopes = ContextVar("wiskey_native_http_effect_scopes", default=())
_PORTS = ("async_confirm_identity", "_get", "_request")


@contextmanager
def native_effect_scope(client: Any, guard: Callable[[], None], rules: tuple[RequestRule, ...]):
    task = asyncio.current_task()
    if (
        task is None
        or not callable(guard)
        or inspect.iscoroutinefunction(guard)
        or type(rules) is not tuple
        or not 1 <= len(rules) <= 32
        or any(type(rule) is not RequestRule for rule in rules)
    ):
        raise ValueError("original Task, synchronous guard and exact native rules required")
    session = client._session
    scope = _EffectScope(
        client,
        session,
        session._transport,
        client.settings,
        client._expected_identity,
        client.enabled_doors,
        tuple(sorted(client.physical_doors.items())),
        tuple(getattr(client, name) for name in _PORTS),
        rules,
        guard,
        task,
        [True],
    )
    token = _scopes.set((*_scopes.get(), scope))
    try:
        yield
    finally:
        scope.active[0] = False
        _scopes.reset(token)


@contextmanager
def _legacy_owned_cleanup_scope(programs: Any, key: str):
    """Detach copied refusal context only on an issued original legacy close.

    This is context isolation, never a grant: the caller immediately installs
    its fresh original target/request guard on this same Task. Native emergency
    transport fences are independent and remain checked first. Ordinary jobs,
    copied ContextVars, and normal tick closes cannot enter this scope.
    """
    from ..access.hold_programs import HoldPrograms

    if type(programs) is not HoldPrograms or not HoldPrograms.is_cleanup_task(programs, key):
        raise Refusal("binding_denied")
    from ..bridge_command_scope import _SCOPE

    token = _scopes.set(())
    command_token = _SCOPE.set(None)
    try:
        yield
    finally:
        _SCOPE.reset(command_token)
        _scopes.reset(token)


def check_request(request: httpx.Request, transport: Any) -> None:
    check_emergency_request(request, transport)
    from ..bridge_command_scope import _SCOPE

    if _SCOPE.get() is not None:
        from ..bridge_native_effects import check_native_request

        check_native_request(request, transport)
    scopes = _scopes.get()
    if not scopes:
        return
    task = asyncio.current_task()
    for scope in scopes:

        def stable(scope=scope) -> None:
            if (
                type(scope) is not _EffectScope
                or scope.active[0] is not True
                or task is not scope.task
                or scope.client._session is not scope.session
                or scope.session._transport is not scope.transport
                or transport is not scope.transport
                or scope.client.settings is not scope.settings
                or scope.client._expected_identity != scope.expected_identity
                or scope.client.enabled_doors is not scope.enabled_doors
                or tuple(sorted(scope.client.physical_doors.items())) != scope.physical_map
                or not same_ports(
                    scope.ports, tuple(getattr(scope.client, name, None) for name in _PORTS)
                )
                or _scopes.get() is not scopes
            ):
                raise Refusal("binding_denied")

        stable()
        if scope.guard() is not None:
            raise Refusal("binding_denied")
        stable()
        if task.cancelling():
            raise asyncio.CancelledError
        try:
            matches = any(
                request.method == rule.method
                and request.url == rule.url
                and request.content == rule.body
                for rule in scope.rules
            )
        except httpx.RequestNotRead:
            raise Refusal("binding_denied") from None
        if not matches:
            raise Refusal("binding_denied")
