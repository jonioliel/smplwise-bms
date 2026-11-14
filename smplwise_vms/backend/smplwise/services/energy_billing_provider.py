"""CR-023 P2: how billing reads the electricity readings store.

Billing never opens energy.db. It uses the meters branch's `EnergyReadingsProvider` (docs/architecture/
ELECTRICITY_INTERFACES.md section 2, `services/energy_provider.provider_for(conn, settings)`), and only this subset of it:

    get_meter(meter_id) -> MeterInfo | None            # .id, .display_name, .status
    list_meters(include_retired=False) -> list[MeterInfo]
    last_report_at(meter_id) -> datetime | None
    consumption(meter_id, start, end) -> Consumption   # .wh (int | None), .coverage ('full'|'partial'|'none'), .events
    reading_at(meter_id, at) -> BoundaryReading         # .value_wh, .exact, .before_at, .after_at

Semantics relied on (section 2.1 there): energy between readings is allocated by time and `consumption` is additive;
`wh` counts only the covered time (a meter that stopped reporting is measured up to its last report); `None` = no data.

The dataclasses below mirror the field names of that contract so the test fake and the real provider are interchangeable.
`get_provider` obtains the real provider through services/energy_billing_adapter.provider(conn, settings) (the one seam);
when the store is not configured it answers with `NullReadings` ("no meters"): nothing can be billed and no energy is ever
invented."""
from __future__ import annotations

import datetime as dt
import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, runtime_checkable

log = logging.getLogger("smplwise.energy_billing")

Coverage = Literal["full", "partial", "none"]


@dataclass(frozen=True)
class MeterInfo:
    id: str
    display_name: str
    status: str = "active"


@dataclass(frozen=True)
class MeterEvent:
    at: dt.datetime
    kind: str  # reset | rebase | spike_dropped | jump_accepted | noise_ignored | replaced | unit_changed
    detail_wh: int | None = None


@dataclass(frozen=True)
class Consumption:
    meter_id: str
    start: dt.datetime
    end: dt.datetime
    wh: int | None
    coverage: Coverage
    events: tuple[MeterEvent, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class BoundaryReading:
    meter_id: str
    at: dt.datetime
    before_at: dt.datetime | None
    before_wh: int | None
    after_at: dt.datetime | None
    after_wh: int | None
    value_wh: int | None
    exact: bool
    epoch_id: str | None = None


@runtime_checkable
class BillingReadings(Protocol):
    def get_meter(self, meter_id: str) -> Any: ...

    def list_meters(self, *, include_retired: bool = False) -> list[Any]: ...

    def last_report_at(self, meter_id: str) -> dt.datetime | None: ...

    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Any: ...

    def reading_at(self, meter_id: str, at: dt.datetime) -> Any: ...


class NullReadings:
    """No readings store: no meter is known, nothing is ever measured."""

    def get_meter(self, meter_id: str) -> None:
        return None

    def list_meters(self, *, include_retired: bool = False) -> list[Any]:
        return []

    def last_report_at(self, meter_id: str) -> None:
        return None

    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption:
        return Consumption(meter_id, start, end, None, "none")

    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading:
        return BoundaryReading(meter_id, at, None, None, None, None, None, False)


_LOCK = threading.Lock()
_OVERRIDE: BillingReadings | None = None


def set_provider(provider: BillingReadings | None) -> None:
    """Tests (and tools) register a provider; None returns to the real one."""
    global _OVERRIDE
    with _LOCK:
        _OVERRIDE = provider


def get_provider(conn: Any = None, settings: Any = None) -> BillingReadings:
    """The provider for one request / job (the real one is bound to the caller's main-DB connection)."""
    with _LOCK:
        if _OVERRIDE is not None:
            return _OVERRIDE
    from . import energy_billing_adapter  # the one seam to the readings store (EnergyReadingsProvider)

    try:
        real = energy_billing_adapter.provider(conn, settings)
    except Exception:  # noqa: BLE001 - an unready store means "no data", never a crash of billing
        log.warning("readings store not available to billing", exc_info=True)
        return NullReadings()
    return real if real is not None else NullReadings()
