"""Request-owned RAM cleanup during an explicit verified host preparation.

This carries no authority or private payload. An inherited task cannot issue
items on behalf of its parent's verified preparation, including after return.
"""
import asyncio
from contextvars import ContextVar
from dataclasses import dataclass, field

from .validation import Refusal


@dataclass(repr=False)
class PreparationScope:
    host: object
    task: object
    records: list = field(default_factory=list)
    opaque: list = field(default_factory=list)
    request: object = None


scopes = ContextVar('wiskey_preparation_scopes', default=None)


def opaque_owner(request):
    """Return the current exact request's cleanup ledger, without reading data."""
    scope = scopes.get()
    if scope is None:
        return None
    if asyncio.current_task() is not scope.task:
        raise Refusal('binding_denied')
    if scope.request is None:
        return None
    if request is not scope.request:
        raise Refusal('binding_denied')
    return scope.opaque
