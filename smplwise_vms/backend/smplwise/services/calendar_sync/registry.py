"""The adapter registry: provider name -> factory.

CALCONNECT-2330: `install_builtin()` (called by create_app) registers the real adapters - iCal IN, Google Calendar, Microsoft Graph. They
only ever run for a connection a `calendar.connect` holder created and authorised, while the calendars module (`enabled`, off by default)
and `sync_enabled` are on; each reads its credentials through credentials.RUNTIME and talks to the network only from
engine.run_connection / the routes with no transaction open. Tests replace them with the FakeAdapter (`register`) or clear them."""
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


def install_builtin() -> None:
    from .google import GoogleAdapter  # noqa: PLC0415
    from .ics import IcsInAdapter  # noqa: PLC0415
    from .microsoft import MicrosoftAdapter  # noqa: PLC0415

    register("ics_in", IcsInAdapter)
    register("google", GoogleAdapter)
    register("microsoft", MicrosoftAdapter)
