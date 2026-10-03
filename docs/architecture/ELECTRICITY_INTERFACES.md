# Electricity module (CR-023) - internal interfaces between the parallel branches

Status: LIVING CONTRACT, owned by the meters-and-readings branch `pilot/elec-server`. The billing branch
(`pilot/elec-billing`), the PDF branch and the two UI branches code against this file. `git fetch origin pilot/elec-server`
and read `docs/architecture/ELECTRICITY_INTERFACES.md` there for the latest version. A change is recorded in the change log
at the end, never silently.

Precedence: approved CR-023 and the owner decisions (`private/nn3-electricity/OWNER_DECISIONS_2026-10-04.md`, rounds 1-3)
win over this file; this file wins over the plan where it is more specific.

Binding owner decisions that shape this interface:
- First release: a fixed price per kWh only (no time-of-use). The readings store keeps 15-minute data so TOU can come later.
- Consumption that crosses a period boundary is **allocated by time** (round 2, answer 5 = b). A cumulative counter never
  loses consumption in a gap: the delta between two readings is spread linearly over the time between them.
- A meter that does not report at issue time is allowed; the bill states the date of its last report (round 2, answer 6 = a).
- No history import (backfill) step (round 2, answer 9). Not built.
- Permissions: exactly three - `energy.view`, `energy.bills`, `energy.manage`.
- Round 3: the bill shows consumption of previous periods and of the same period last year, only where data exists
  (never invented; partial coverage flagged). Daily totals are kept as long as bills (7 years by default).

## 1. Ownership of storage

| Store | Owner branch | Objects |
|---|---|---|
| main DB `smplwise.db`, migration `0054_electricity_meters.sql` (placeholder number; the lead renumbers at integration) | elec-server | `energy_meters`, `energy_meter_epochs` |
| main DB, the billing migration (its own placeholder `0054_electricity_billing*.sql` or similar) | elec-billing | customers, accounts, `energy_account_meters`, tariffs, VAT, bills, bill lines |
| main DB `settings` table, keys `energy.*` | elec-server owns the registry (`services/energy_settings.py`); billing registers its own keys there (section 5) | |
| `energy.db` (own file next to `smplwise.db`, own migration series `migrations_energy/E001_*.sql`, own write gate) | elec-server | `meter_map`, `readings`, `intervals`, `daily`, `cursor`, `energy_schema_migrations` |

Rule: **nothing outside `services/energy_store.py` opens `energy.db`.** Billing reads energy only through the provider
below. The provider never writes.

### 1.1 `energy_meters` (main DB)

| Column | Type | Meaning |
|---|---|---|
| `id` | TEXT PK | `new_id()` (16 hex). Formulas and bills reference this id, never the entity id or the name |
| `source_kind` | TEXT | `'ha_entity'` (only kind now; `'satec'` reserved) |
| `source_ref` | TEXT | the entity id. Never printed on a bill or a PDF (security: no sensor ids on documents) |
| `display_name` | TEXT | what bills and screens show |
| `unit` | TEXT | the unit at registration: `kWh`, `Wh` or `MWh` |
| `unit_factor` | INTEGER | Wh per source unit: 1000 / 1 / 1000000 |
| `area_id` | TEXT NULL | override of the entity's area |
| `status` | TEXT | `'active'`, `'paused'`, `'retired'` |
| `status_reason` | TEXT NULL | `'manual'`, `'unit_changed'`, `'source_missing'`, null |
| `max_kw` | REAL | plausibility cap for the jump rule (default 100) |
| `revision` | INTEGER | optimistic concurrency, starts at 1 |
| `created_at`, `created_by`, `updated_at`, `retired_at` | TEXT | UTC ISO |

### 1.2 `energy_meter_epochs` (main DB)

One row per counter life: `id`, `meter_id`, `started_at`, `ended_at` (NULL = current), `start_reading_wh`,
`end_reading_wh`, `reason` (`'first'`, `'replaced'`, `'source_changed'`), `source_ref` (the entity of that epoch), `note`,
`created_by`. Bills show both segments of a replaced meter from this table (via `EnergyReadingsProvider.epochs`).

## 2. Python protocol for billing: `EnergyReadingsProvider`

Module: `smplwise/services/energy_provider.py`. Obtain one per request / job:

```python
from smplwise.services.energy_provider import provider_for
p = provider_for(conn, settings)      # conn: an open main-DB connection (read or write mode); settings: config.Settings
```

All instants are aware UTC `datetime`s; local dates are `datetime.date` with an explicit IANA zone. Energy is **integer
Wh** everywhere (convert to kWh with `Decimal(wh) / 1000` in billing). `None` always means "no data", never zero.

```python
from dataclasses import dataclass
import datetime as dt
from typing import Literal, Protocol, Sequence

Coverage = Literal["full", "partial", "none"]
MeterState = Literal["reporting", "not_reporting", "paused", "retired"]

@dataclass(frozen=True)
class MeterInfo:
    id: str
    display_name: str
    source_kind: str            # 'ha_entity'
    source_ref: str             # entity id - internal only, never on a document
    unit: str                   # 'kWh' | 'Wh' | 'MWh'
    unit_factor: int
    area_id: str | None
    area_name: str | None
    status: str                 # 'active' | 'paused' | 'retired'
    status_reason: str | None
    max_kw: float
    revision: int
    created_at: str             # UTC ISO
    retired_at: str | None

@dataclass(frozen=True)
class MeterStatus:
    meter_id: str
    state: MeterState
    last_report_at: dt.datetime | None   # last time a valid numeric value was seen (None = never)
    last_value_wh: int | None            # the counter value at last_report_at
    stale_after_minutes: int             # the setting that decides reporting / not_reporting

@dataclass(frozen=True)
class MeterEvent:
    at: dt.datetime
    kind: Literal["reset", "rebase", "spike_dropped", "jump_accepted", "noise_ignored", "replaced", "unit_changed"]
    detail_wh: int | None       # e.g. the energy counted at a reset (the value after it), the dropped spike size

@dataclass(frozen=True)
class Consumption:
    meter_id: str
    start: dt.datetime
    end: dt.datetime            # exclusive
    wh: int | None              # None when nothing at all is known in [start, end)
    coverage: Coverage          # 'full' = every second of the range lies between two accepted readings
    covered_seconds: int
    total_seconds: int
    source: Literal["intervals", "daily"]   # intervals while within quarter-hour retention, daily (local-midnight edges only) after it
    events: tuple[MeterEvent, ...]          # resets / replacements etc. inside the range (from raw readings while retained)

@dataclass(frozen=True)
class BoundaryReading:
    meter_id: str
    at: dt.datetime             # the requested instant (e.g. a period edge)
    before_at: dt.datetime | None
    before_wh: int | None       # last accepted reading at or before `at`
    after_at: dt.datetime | None
    after_wh: int | None        # first accepted reading after `at`
    value_wh: int | None        # counter value interpolated at `at` (by time, same rule as the allocation); None if unknown
    exact: bool                 # True when a reading lies within 15 minutes of `at`
    epoch_id: str | None

@dataclass(frozen=True)
class EpochInfo:
    id: str
    started_at: dt.datetime
    ended_at: dt.datetime | None
    start_reading_wh: int | None
    end_reading_wh: int | None
    reason: str                 # 'first' | 'replaced' | 'source_changed'
    note: str | None

@dataclass(frozen=True)
class HistoryWindow:
    start: dt.date              # local date, inclusive
    end: dt.date                # local date, exclusive
    wh: int | None              # None = no data at all in the window (omit the bar; never invent)
    coverage: Coverage          # 'partial' must be flagged on the chart/bill
    days_with_data: int
    days_total: int

@dataclass(frozen=True)
class MeterHistory:
    meter_id: str
    previous: tuple[HistoryWindow, ...]     # newest first: window 1 = the period just before, ... up to `count`
    same_period_last_year: HistoryWindow    # the same window shifted 12 months back (Feb 29 -> Feb 28)

class EnergyReadingsProvider(Protocol):
    def get_meter(self, meter_id: str) -> MeterInfo | None: ...
    def list_meters(self, *, include_retired: bool = False) -> list[MeterInfo]: ...
    def find_meters(self, query: str, *, include_retired: bool = False) -> list[MeterInfo]: ...  # by display name (formula text mode)
    def meter_status(self, meter_id: str) -> MeterStatus: ...
    def last_report_at(self, meter_id: str) -> dt.datetime | None: ...
    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption: ...
    def consumption_many(self, meter_ids: Sequence[str], start: dt.datetime, end: dt.datetime) -> dict[str, Consumption]: ...
    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading: ...
    def epochs(self, meter_id: str, start: dt.datetime | None = None, end: dt.datetime | None = None) -> list[EpochInfo]: ...
    def daily(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None]]: ...   # installation zone
    def monthly(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None, Coverage]]: ...  # first day of each month
    def history_windows(self, meter_ids: Sequence[str], period_start: dt.date, period_end: dt.date, tz: str, count: int = 12) -> dict[str, MeterHistory]: ...
```

### 2.1 Semantics billing relies on

1. **Allocation by time.** Each accepted delta between readings at t0 and t1 is spread linearly over [t0, t1] into
   15-minute buckets with an exact-sum integer split on the cumulative line (any run of whole buckets is within 1 Wh of
   its exact linear share), so `consumption(a, b) + consumption(b, c) == consumption(a, c)` exactly for
   quarter-hour-aligned instants, and local midnights in `Asia/Jerusalem` are always quarter-hour aligned. Non-aligned
   edges are prorated inside the edge bucket.
2. **Linear formula support.** Because `consumption` is additive and per meter, the billing formula is applied to the
   per-meter results (CR-023 section 6). The provider has no notion of accounts.
3. **Coverage.** `coverage == 'full'` means no unknown time in the range. A meter that started reporting inside the range,
   or has not reported since some instant inside the range, gives `'partial'` and `wh` counts only the covered part (bill
   only what was measured, D7). A long gap between two readings is covered (the counter closes it), so it is `'full'`.
4. **Not reporting.** `meter_status(...).state == 'not_reporting'` when `now - last_report_at > energy.stale_after_minutes`
   (default 60) or never reported. Billing allows issuing and prints `last_report_at` (owner round 2, answer 6). Energy after
   the last report lands in a later period when the meter reports again (allocated by time across the gap).
5. **Resets / spikes / replacement** are already resolved in the store (section 4). Billing just reads `events` for notes
   ("כולל איפוס מונה ב-...") and `epochs` for the replaced-meter segments.
6. **Retention.** Raw readings 90 days (so `reading_at` and `events` are exact for recent periods only), 15-minute data
   26 months, daily totals as long as bills (default 7 years). After interval retention `consumption` uses `daily` and
   requires local-midnight edges in the installation zone; any other edge raises `ValueError("edge_not_day_aligned")`.
7. **History windows (round 3).** For a period [ps, pe): if both edges fall on the same day of month and differ by whole
   months (N), window k is [ps - kN months, pe - kN months) (day clamped to the month end); otherwise windows step back
   by the period length in days. `same_period_last_year` = [ps - 12 months, pe - 12 months). A window before the meter
   existed or with no daily data is `wh=None, coverage='none'`; a window partly before the meter's first report is
   `'partial'`. Computed from `daily` (kept 7 years), so it survives raw/quarter-hour retention.
8. **Thread safety.** A provider is bound to the caller's connection; create one per request/job. It never writes and
   never takes the main write gate; its `energy.db` reads are WAL readers.

### 2.2 Test double for the billing branch

`smplwise_vms/backend/tests/energy_fake.py` provides `FakeEnergyProvider` (in-memory, implements the protocol; add meters
with a list of `(utc_instant, counter_wh)` readings and it answers with the same allocation rule). Billing tests can also
use the real store: `tests/test_energy_store.py::make_store` shows how to feed readings directly.

### 2.3 Hooks billing provides to this branch

- **Meter in use.** Retiring a meter is refused (409 `meter_in_use`, with the account names) when it appears in
  `energy_account_meters` of an account whose `deleted_at` is null and `status != 'closed'` (if that table exists; the query is
  in `services/energy_meters.accounts_using(conn, meter_id)` - keep the table and column names `energy_account_meters
  (account_id, meter_id)`, `energy_accounts (id, name, deleted_at, status)` or tell me).
- **Retention guard.** Quarter-hour pruning never deletes buckets inside an open draft's period: `energy_retention`
  calls `energy_bills` with `state = 'draft'` (`period_start`, `period_end`, `account_id`) if that table exists.
  Bill and PDF retention (7 years) is executed by the billing branch; the setting key is owned here (section 5).

## 3. REST API of this branch (`/api/v1/energy/...`, router `routers/energy_meters.py`)

Conventions: JSON only (415 otherwise); errors in the shared `ApiError` envelope with Hebrew `user_message`; every write
route checks the permission on a read connection **before** the body is read (`read_gate`, audited 403), then opens the
write connection; energy in responses as `kwh` numbers with 3 decimals plus `wh` integers; instants UTC ISO with `Z`. No
money anywhere in these routes. All routes work on the remote channel with the same RBAC (no machine-to-machine route).

| Method | Path | Permission | Request | Response |
|---|---|---|---|---|
| GET | `/energy/candidates?q=&area_id=&include_rejected=true&limit=50` | energy.manage | - | `{items: [Candidate]}` |
| GET | `/energy/meters?include_retired=false` | energy.view | - | `{items: [Meter], stale_after_minutes}` |
| GET | `/energy/meters/{id}` | energy.view | - | `Meter` + `epochs: [Epoch]`, `used_in: [{account_id, name}]` |
| POST | `/energy/meters` | energy.manage | `{source_ref, display_name?, area_id?, max_kw?}` | 201 `Meter` |
| PATCH | `/energy/meters/{id}` | energy.manage | `{revision, display_name?, area_id?, max_kw?, status?: 'active'\|'paused'}` | `Meter` |
| DELETE | `/energy/meters/{id}?revision=N` | energy.manage | - | `Meter` (status `retired`; data kept) |
| POST | `/energy/meters/{id}/replace` | energy.manage | `{revision, at?, old_final_reading_kwh?, new_start_reading_kwh?, new_source_ref?, note?}` | `Meter` + `epochs` |
| GET | `/energy/meters/{id}/series?from=&to=&step=15m\|1h\|1d` | energy.view | - | `{meter_id, step, unit: 'kWh', items: [{start, end, kwh, wh, coverage}]}` (max 3000 points) |
| GET | `/energy/meters/{id}/readings?from=&to=&limit=500` | energy.view | - | `{items: [{at, kwh, wh, flags: [..]}], truncated}` |
| GET | `/energy/consumption?meter_ids=a,b&from=&to=` | energy.view | - | `{from, to, items: [{meter_id, wh, kwh, coverage, covered_seconds, total_seconds, last_report_at}]}` |
| GET | `/energy/settings` | energy.view (values) | - | `{values: {...}, editable: {key: bool}, ranges: {...}, storage: Storage}` |
| PATCH | `/energy/settings` | energy.manage; retention keys need system.configure | `{key: value, ...}` (only known keys) | same as GET |

`Candidate`: `{ref, name, area_id, area_name, unit, device_class, state_class, state, verdict: 'ok'|'warning'|'rejected',
code, message, already_meter_id}`. Codes: `ok`, `domain_rejected`, `power_unit`, `unit_rejected`, `unit_missing`,
`device_class_rejected`, `measurement`, `state_not_numeric`, `state_negative`, `returned_energy`, `warn_total`,
`warn_no_device_class`, `warn_unavailable`, `warn_same_device`. Rejected items carry the CR-023 section 5 Hebrew message.

`Meter`: `{id, display_name, source_kind, source_ref, unit, area_id, area_name, status, status_reason, max_kw, revision,
created_at, retired_at, state: 'reporting'|'not_reporting'|'paused'|'retired', last_report_at, value_kwh, today_kwh}`.

`Storage`: `{energy_db_bytes, classes: {raw: {rows, bytes_estimate}, intervals: {...}, daily: {...}}, estimate:
{meters, raw_bytes, intervals_bytes, daily_bytes, total_bytes}}` - the estimate is for the current meter count at the
current retention values (formula in section 6).

Errors: `meter_unit_rejected` 422 (with `details.code` from the candidate codes), `meter_duplicate` 409 (that entity is
already an active or paused meter), `meter_in_use` 409 (`details.accounts`), `meter_retired` 409, `revision_conflict` 409,
`not_found` 404, `validation` 422, `range_too_large` 422.

## 4. Counter rules implemented in the store (for reference)

Per meter, per epoch; P = last accepted reading (t0), R = new reading (t1); cap = `max_kw` x hours(t1 - t0) x 1.5 x 1000 + 50 Wh.
- `0 <= R - P <= cap`: accept, spread over [t0, t1].
- `R - P > cap`: hold R (flag glitch). Next reading N: continues from R (0 <= N - R <= cap over [tR, tN]) → the jump is real
  (`jump_accepted`, spread over [t0, tR]); back at the P level (0 <= N - P <= cap over [t0, tN]) → R dropped as a spike
  (`spike_dropped`); otherwise N becomes the held reading.
- `R < P`: R <= 10% of P or R <= 1000 Wh → **reset**: the energy since the restart (R) counts, spread over [t0, t1];
  a drop under 10% of P and under 1000 Wh → **noise**, ignored (P stays the reference); any other drop is held; if the next
  reading continues from it, the counter is **rebased** with zero energy for that step (never invented).
- `state_class: total` with a `last_reset` change: treated as a reset.
- Replacement (`/replace`): closes the epoch; the typed final reading adds `final - P` (if >= 0) over [t0, at]; the new
  epoch starts at the typed start reading (or the first reading seen, contributing nothing).
- Readings are stored at most once a minute per meter, when the value changes, and as a 15-minute heartbeat when it does
  not (so boundary readings are never more than 15 minutes apart while the meter reports).
- A unit change of the entity (e.g. to W) pauses the meter (`status_reason = 'unit_changed'`), nothing converted.

## 5. Settings keys (`services/energy_settings.py`)

| Key | Default | Range | Who edits |
|---|---|---|---|
| `energy.raw_retention_days` | 90 | 7-366 | system.configure |
| `energy.interval_retention_months` | 26 | 3-120 | system.configure |
| `energy.bill_retention_years` | 7 | 1-15 | system.configure (also the retention of `daily` totals) |
| `energy.draft_retention_days` | 30 | 7-365 | energy.manage |
| `energy.stale_after_minutes` | 60 | 15-1440 | energy.manage |
| `energy.include_history_in_backup` | false | bool | backup.manage |

Billing adds its keys (price mode, business details, payment days, fixed note...) by calling
`energy_settings.register(SettingSpec(key=..., default=..., kind='int'|'bool'|'enum'|'text'|'json', ..., permission=...))`
at import time of its own module; they then appear in GET/PATCH `/energy/settings` with the same validation and audit.
Money-sensitive keys can set `read_permission='energy.bills'` and are omitted for callers without it.

## 6. Storage estimate formula (shown in Settings)

Per meter: raw ≤ 1440 rows/day (once a minute when changing; ~96/day when idle), ~32 bytes/row; intervals 96 rows/day,
~24 bytes/row; daily 1 row/day, ~40 bytes/row. Estimate = meters x (raw rows/day x raw days x 32 + 96 x 30.44 x months x 24
+ 365 x years x 40). For 200 meters at the defaults: raw ≈ 0.83 GB worst case (every minute changes), intervals ≈ 0.37 GB,
daily ≈ 20 MB. Typical sites (10-30 meters) need tens of MB.

## 7. Backup and restore

- `energy_meters`, `energy_meter_epochs` join the project backup (`services/energy_backup.MAIN_TABLES`, added to
  `backup.PROJECT_TABLES`). Billing appends its tables to `energy_backup.MAIN_TABLES` (one list, one place).
- Every backup carries `energy/daily.json` (daily totals keyed by meter id, small). With `energy.include_history_in_backup`
  the archive also carries `energy/energy.db` (a consistent copy made with the SQLite backup API).
- Restore follows the allow-list pattern of `services/backup.py`: only the allow-listed tables and columns
  (`readings`, `intervals`, `daily`, `cursor`, `meter_map`) are copied from the archived file into the live `energy.db`, only
  for meter ids that exist in the restored main DB, inside one `energy.db` transaction; the archived file is opened
  read-only from a temp copy and must carry the expected schema version; anything else in it is ignored.

## Change log
- 2026-10-04: first version (elec-server).
