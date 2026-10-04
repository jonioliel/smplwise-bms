# What billing reads from the readings store (CR-023 P2)

Owner: `pilot/elec-billing`. Counterpart: `pilot/elec-server`, `docs/architecture/ELECTRICITY_INTERFACES.md` (the
`EnergyReadingsProvider` protocol, section 2). **Aligned with that contract (version of 2026-10-04).**

Billing obtains the provider through one seam, `smplwise/services/energy_billing_provider.get_provider(conn, settings)`,
which calls `services/energy_provider.provider_for(conn, settings)` when the meters branch is present and otherwise answers
"no meters" (`NullReadings`: nothing billable, no energy invented). Tests register a fake with `set_provider(...)`.

## Subset used

| Call | Used for |
|---|---|
| `list_meters(include_retired=...)` → `.id`, `.display_name` | resolving meter names in the formula (text mode), names on the bill; retired meters are refused in a new formula but still named on old bills |
| `last_report_at(meter_id)` | "billed up to": a meter that has not reported up to the period end is billed up to its last report and the note "לא מדווח מאז ..." is printed (owner round 2, answer 6) |
| `consumption(meter_id, start, end)` → `.wh`, `.coverage`, `.events` | energy per price piece (allocation by time, additive), the carried part, the history bars (`None` / `coverage == "none"` = no bar; `"partial"` = flagged bar); `events` of kind `reset` / `replaced` become notes |
| `reading_at(meter_id, at)` → `.value_wh`, `.exact`, `.before_at`, `.after_at` | the start / end readings printed on the bill; a boundary inside a reporting gap of 24 h or more gets the note "חולקה לפי זמן" |

Not used (yet): `consumption_many`, `epochs` (the replaced-meter segments are not printed separately in v1; the energy is
correct because the store resolves replacements), `daily`, `monthly`, `history_windows` (billing computes its comparison windows
from the account's own cycle and asks `consumption` for each, so a 2-month cycle or a start day of the 15th compares like with
like; beyond the quarter-hour retention a non-midnight edge raises `ValueError`, which billing treats as "no data").

## Hooks billing provides (section 2.3 there)

- `energy_account_meters (account_id, meter_id)` and `energy_accounts (id, name, deleted_at, status)` exist with these names;
  account `status` is `'active' | 'paused'` (there is no `'closed'`; a deleted account has `deleted_at` set).
- `energy_bills (account_id, period_start, period_end, state)` exists; `state = 'draft'` marks an open draft (period dates are
  local dates, `period_end` exclusive).
- Bill and PDF retention is executed by billing (`energy_billing.retention`, hourly) using the keys
  `energy.bill_retention_years` (7) and `energy.draft_retention_days` (30) owned by the meters branch's settings registry.

## Known differences to settle at integration

1. Billing settings (price mode default, payment terms, business details, numbering digits, automatic delay, logo) live in
   one key `energy.billing` behind `GET/PUT /energy/billing-settings`, not in the `energy_settings` registry (the registry is not
   on this branch). Moving them is mechanical; the REST shape stays.
2. Backup: billing appends its tables directly to `backup.PROJECT_TABLES` / `KEEP_WHEN_ABSENT` / `FILE_COLUMNS` instead of
   `energy_backup.MAIN_TABLES` (not on this branch). One list must win at the merge.
3. Both branches add `energy.view`, `energy.manage`, `energy.bills` to `roles.json`, the contract role catalogue and the
   permission labels: identical meaning; keep one copy.
4. Both migrations used the placeholder number 0054; resolved at integration: `0054_electricity_meters.sql`,
   `0055_electricity_billing.sql`. No foreign key crosses them (meters are referenced by text id).
