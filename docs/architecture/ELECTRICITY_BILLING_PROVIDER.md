# What billing needs from the readings store (CR-023 P2)

Owner: `pilot/elec-billing`. Counterpart: `pilot/elec-server` (`EnergyReadingsProvider`, `docs/architecture/ELECTRICITY_INTERFACES.md`).
Until that document lands, billing codes against the protocol below (`smplwise/services/energy_billing_provider.py`) and a
fake in the tests; the adapter to the real provider is one small class (`ServerProviderAdapter`), so a shape difference is
fixed in one place.

```python
@dataclass(frozen=True)
class MeterInfo:
    meter_id: str
    name: str                  # display name
    status: str                # "active" | "paused" | "retired"
    last_report_at: datetime | None   # UTC, last accepted reading

@dataclass(frozen=True)
class Segment:                 # one pair of consecutive ACCEPTED readings of one meter (one epoch)
    t0: datetime               # UTC, earlier reading
    t1: datetime               # UTC, later reading (t1 > t0)
    wh: int                    # energy between them, >= 0, resets / noise / spikes already resolved by the store
    v0_wh: int                 # raw cumulative reading at t0 (for display)
    v1_wh: int                 # raw cumulative reading at t1
    reset: bool = False        # a counter reset or replacement happened inside (t0, t1]

class BillingReadings(Protocol):
    def meters(self, meter_ids: Iterable[str] | None = None) -> dict[str, MeterInfo]: ...
    def segments(self, meter_id: str, start: datetime, end: datetime) -> list[Segment]:
        """Every segment that overlaps [start, end), including the ones that straddle start or end, ordered by t0."""
    def history_wh(self, meter_id: str, start: datetime, end: datetime) -> tuple[int, bool] | None:
        """Energy in [start, end) from the long-term totals (daily, kept as long as bills): (wh, complete) or None when
        there is no data at all. `complete` is False when the totals do not cover the whole window."""
```

Rules billing relies on:
- Segments never cross an epoch boundary (a replacement); a gap in reporting is just a long segment (the next reading carries
  the whole delta; billing allocates it by time).
- `wh` of a segment is final: billing never re-derives deltas from raw readings.
- All calls are read-only, take no lock on the main database, and are fast enough to call for 13 historical periods.
