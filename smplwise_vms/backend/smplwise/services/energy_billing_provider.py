"""CR-023 P2: what billing reads from the electricity readings store (docs/architecture/ELECTRICITY_BILLING_PROVIDER.md).

Billing never touches energy.db itself. It calls a `BillingReadings` object registered here; the meters/readings branch
(`pilot/elec-server`, `EnergyReadingsProvider`) is wired in through one adapter. Until a provider is registered the
`NullReadings` answers "no meters, no readings": accounts can be configured, nothing can be billed (no invented energy)."""
from __future__ import annotations

import datetime as dt
import threading
from dataclasses import dataclass
from typing import Iterable, Protocol, runtime_checkable


@dataclass(frozen=True)
class MeterInfo:
    meter_id: str
    name: str
    status: str = "active"  # active | paused | retired
    last_report_at: dt.datetime | None = None  # UTC


@dataclass(frozen=True)
class Segment:
    """One pair of consecutive accepted readings of one meter inside one epoch; `wh` is final (resets resolved)."""
    t0: dt.datetime
    t1: dt.datetime
    wh: int
    v0_wh: int = 0
    v1_wh: int = 0
    reset: bool = False


@runtime_checkable
class BillingReadings(Protocol):
    def meters(self, meter_ids: Iterable[str] | None = None) -> dict[str, MeterInfo]: ...

    def segments(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> list[Segment]: ...

    def history_wh(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> tuple[int, bool] | None: ...


class NullReadings:
    """No readings store wired in: no meter is known, nothing is ever measured."""

    def meters(self, meter_ids: Iterable[str] | None = None) -> dict[str, MeterInfo]:
        return {}

    def segments(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> list[Segment]:
        return []

    def history_wh(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> tuple[int, bool] | None:
        return None


_LOCK = threading.Lock()
_PROVIDER: BillingReadings | None = None


def set_provider(provider: BillingReadings | None) -> None:
    """Register the readings provider (the meters branch at start-up; a fake in tests). None restores the null one."""
    global _PROVIDER
    with _LOCK:
        _PROVIDER = provider


def get_provider() -> BillingReadings:
    with _LOCK:
        if _PROVIDER is not None:
            return _PROVIDER
    adapted = _try_server_provider()
    return adapted if adapted is not None else NullReadings()


def _try_server_provider() -> BillingReadings | None:
    """Integration seam: the meters branch exposes its provider; adapt it here when present (aligned at integration with
    docs/architecture/ELECTRICITY_INTERFACES.md). Absent module = None, never an error."""
    try:
        from . import energy_billing_adapter  # type: ignore[attr-defined]
    except ImportError:
        return None
    try:
        return energy_billing_adapter.provider()
    except Exception:  # noqa: BLE001 - an unready store means "no data", never a crash of billing
        return None
