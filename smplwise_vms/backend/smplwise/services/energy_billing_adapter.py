"""CR-023: the one seam between billing and the readings store.

Billing (services/energy_billing_provider.get_provider) asks this module for a provider; it answers with the readings store's
`EnergyReadingsProvider` (services/energy_provider.provider_for, docs/architecture/ELECTRICITY_INTERFACES.md section 2) bound to
the caller's main-DB connection. The provider is read-only: the main database through the caller's connection, energy.db
through the store (WAL readers, its own gate).

Billing uses only this subset of the protocol (docs/architecture/ELECTRICITY_BILLING_PROVIDER.md): `get_meter`, `list_meters`,
`last_report_at`, `consumption`, `reading_at` - additive allocation by time, coverage, `None` = no data.

History: before integration the two branches had drafted a different billing-side protocol (`meters()`, `segments()`,
`history_wh()`); billing moved to the shared protocol before the merge, so that older adapter was removed at integration.
Until main.create_app calls `configure(settings)` (or when no connection is given) there is no provider, and billing answers
"no meters" (its NullReadings): nothing is billed and no energy is invented."""
from __future__ import annotations

from typing import Any

_SETTINGS: dict[str, Any] = {}


def configure(settings: Any) -> None:
    _SETTINGS["settings"] = settings


def provider(conn: Any = None, settings: Any = None) -> Any | None:
    """The readings provider for one request / job, or None when the store is not configured or no connection is given."""
    settings = settings if settings is not None else _SETTINGS.get("settings")
    if settings is None or conn is None:
        return None
    from .energy_provider import provider_for

    return provider_for(conn, settings)
