"""The adapter registry: provider name -> factory. Production registers NOTHING in this slice (no real provider is built), so a connection
whose provider has no adapter reports `adapter_unavailable` and never reaches a network. Tests register the FakeAdapter."""
from __future__ import annotations

from typing import Callable

from .adapter import SyncAdapter

_FACTORIES: dict[str, Callable[[], SyncAdapter]] = {}


def register(provider: str, factory: Callable[[], SyncAdapter]) -> None:
    _FACTORIES[provider] = factory


def unregister(provider: str) -> None:
    _FACTORIES.pop(provider, None)


def clear() -> None:
    _FACTORIES.clear()


def get(provider: str) -> SyncAdapter | None:
    f = _FACTORIES.get(provider)
    return f() if f else None


def available() -> list[str]:
    return sorted(_FACTORIES)
