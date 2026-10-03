"""CR-023: the adapter from the readings store to the billing branch's `BillingReadings` protocol
(pilot/elec-billing: services/energy_billing_provider.py, docs/architecture/ELECTRICITY_BILLING_PROVIDER.md).

Billing looks for `services.energy_billing_adapter.provider()` at run time; this module answers it. Read-only: the main
database is only read (read-mode connections), energy.db through the store.

- `meters(ids)`: display name, status, last report (the last valid numeric value seen).
- `segments(meter, start, end)`: consecutive ACCEPTED raw readings of one epoch overlapping [start, end) - resets, noise and
  spikes already resolved (a reset pair carries the energy since the restart, a rebase pair is left out: never invented),
  never across a replacement. Raw readings are kept `energy.raw_retention_days` (90 by default); for the part of a window
  older than the oldest raw reading the quarter-hour buckets are returned as 15-minute segments (v0/v1 = 0), so an old
  period can still be billed while the quarter-hour data is kept (26 months).
- `history_wh(meter, start, end)`: from the daily totals (kept as long as bills); (wh, complete) or None.

Until main.create_app calls `configure(settings)` the provider is absent (billing then uses its null provider)."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any, Iterable

from . import energy_counter as ec
from . import energy_store as st
from .timeutil import parse_utc, zone

UTC = dt.timezone.utc
_SETTINGS: dict[str, Any] = {}


def configure(settings: Any) -> None:
    _SETTINGS["settings"] = settings


try:  # the billing branch's dataclasses when present (after integration); identical local shapes otherwise
    from .energy_billing_provider import MeterInfo as _MeterInfo, Segment as _Segment  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - exercised before integration
    @dataclass(frozen=True)
    class _MeterInfo:  # type: ignore[no-redef]
        meter_id: str
        name: str
        status: str = "active"
        last_report_at: dt.datetime | None = None

    @dataclass(frozen=True)
    class _Segment:  # type: ignore[no-redef]
        t0: dt.datetime
        t1: dt.datetime
        wh: int
        v0_wh: int = 0
        v1_wh: int = 0
        reset: bool = False


def _dt(ts: int) -> dt.datetime:
    return dt.datetime.fromtimestamp(ts, UTC)


class ServerReadings:
    def __init__(self, settings: Any):
        from ..db import Database

        self.settings = settings
        self.db = Database(settings.db_path)
        self.store = st.store_for(settings)

    def _tz(self, conn: Any) -> Any:
        row = conn.execute("SELECT value FROM settings WHERE key = 'time.zone'").fetchone()
        return zone(row[0] if row and row[0] else "Asia/Jerusalem")

    def meters(self, meter_ids: Iterable[str] | None = None) -> dict[str, Any]:
        with self.db.connection(mode="read", label="energy.billing.meters") as conn:
            if meter_ids is None:
                rows = conn.execute("SELECT id, display_name, status FROM energy_meters").fetchall()
            else:
                ids = list(dict.fromkeys(meter_ids))
                rows = [r for r in (conn.execute("SELECT id, display_name, status FROM energy_meters WHERE id = ?", (i,)).fetchone() for i in ids) if r]
        seen = self.store.cursor_info([r["id"] for r in rows])
        return {r["id"]: _MeterInfo(r["id"], r["display_name"], r["status"], _dt(seen[r["id"]].seen_ts) if r["id"] in seen and seen[r["id"]].seen_ts else None)
                for r in rows}

    def segments(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> list[Any]:
        a, b = int(start.timestamp()), int(end.timestamp())
        with self.db.connection(mode="read", label="energy.billing.epochs") as conn:
            boundaries = [int(parse_utc(r[0]).timestamp()) for r in conn.execute(
                "SELECT started_at FROM energy_meter_epochs WHERE meter_id = ? AND reason <> 'first'", (meter_id,)).fetchall()]
        rows = self.store.accepted_window(meter_id, a, b)
        out: list[Any] = []
        for (t0, v0, _f0), (t1, v1, f1) in zip(rows, rows[1:]):
            if t1 <= a or t0 >= b or t1 <= t0:
                continue
            if any(t0 < x <= t1 for x in boundaries):
                continue  # never across a replacement
            if f1 & ec.F_REBASE:
                continue
            if f1 & ec.F_RESET:
                out.append(_Segment(_dt(t0), _dt(t1), max(0, v1), v0, v1, True))
            elif v1 >= v0:
                out.append(_Segment(_dt(t0), _dt(t1), v1 - v0, v0, v1, False))
        oldest = self.store.oldest_raw(meter_id)
        cut = min(b, oldest) if oldest is not None else b
        if cut > a:  # older than the raw retention: quarter-hour buckets as segments
            first = out[0].t0.timestamp() if out else None
            for bucket, wh, cov, _q in self.store.intervals(meter_id, a - a % st.BUCKET_S, cut):
                if cov <= 0 or (first is not None and bucket + st.BUCKET_S > first):
                    continue
                out.append(_Segment(_dt(bucket), _dt(bucket + st.BUCKET_S), wh, 0, 0, False))
        out.sort(key=lambda s: s.t0)
        return out

    def history_wh(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> tuple[int, bool] | None:
        from .energy_provider import window_from_daily

        with self.db.connection(mode="read", label="energy.billing.tz") as conn:
            tz = self._tz(conn)
        d0 = start.astimezone(tz).date()
        d1 = end.astimezone(tz).date()
        if d1 <= d0:
            return None
        w = window_from_daily(self.store.daily(meter_id, d0, d1), d0, d1)
        if w.wh is None:
            return None
        return w.wh, w.coverage == "full"


def provider() -> ServerReadings | None:
    settings = _SETTINGS.get("settings")
    return ServerReadings(settings) if settings is not None else None
