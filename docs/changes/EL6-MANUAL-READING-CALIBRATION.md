# EL6 - Electricity meters: manual reading and calibration

Status: built on `pilot/EL6-manual-reading` (from `origin/main` 0b50f9b0, 2.0.1), not merged. Follow-up of CR-023 (electricity meters
and bills), after EL5 (time-of-use billing) and EL8 (bill PDF), both already in main. Contract changes are recorded in
`docs/architecture/ELECTRICITY_INTERFACES.md` (sections 2.6, 3 and the change log).

## 1. What was asked

Until now the only way to type a meter value was the meter replacement (`/replace`). EL6 adds:

1. A **manual reading**: the value the physical meter showed at an instant - validated (monotonic, units, no future
   instants), with an audit trail (who, when) and an undo within a window.
2. **Calibration**: a factor and an offset between the system counter (the sensor) and the physical meter, effective from a date,
   never rewriting history, used the same way by the billing engine and the bill PDF.
3. Clear screens in the electricity area (classic and bubble skins, light and dark, phone), Hebrew copy per
   `docs/design/UI_COPY_RULES.md`, the existing RBAC of the meters module, a contiguous migration number, tests.

## 2. Decisions (made by the implementer, with the reasons)

| # | Decision | Why |
|---|---|---|
| D1 | **Calibration = `physical = factor x counter + offset`, from local midnight of a date** (installation zone) until the next calibration of the same counter life. Consumption is `factor x` the counter's consumption; the offset only moves printed readings. | A meter that counts a few percent off is a factor; a counter that started from a different number is an offset. Both are needed to print the physical meter's numbers on a bill. Midnight edges keep the daily totals (kept 7 years) exact per day and are quarter-hour aligned. |
| D2 | Calibration is applied **in one place: the readings provider** (`services/energy_provider.py`) - consumption, the batched time-of-use windows, boundary readings, daily / monthly / history, the meter's current value. The stored series (`energy.db`) is never changed by a calibration. | Billing (fixed and time-of-use), the account history, the bill chart, the meters screen and the bill PDF (which prints the sealed snapshot) all read through the provider, so they cannot disagree. "Never rewriting history" holds literally: nothing stored is recomputed. |
| D3 | A calibration may not start **before the end of the last issued / sent / paid bill that contains the meter** (from the sealed snapshots), and each calibration starts **after the previous one** of the same counter life. Undo of a calibration is refused once an issued bill covers its date. | An issued bill is a financial record: a later recomputation of its period must give the same numbers. Strictly increasing dates keep the calibration line simple and auditable (no inserted past segments). |
| D4 | A **meter replacement ends the calibration** (the new counter life starts uncalibrated). The final reading typed at a replacement is taken on the physical scale and converted through the calibration in force just before it; the epoch keeps the typed value. | A new physical meter has its own error; carrying the old factor over would be wrong silently. |
| D5 | A manual reading is **always kept** (with the system's own value at that instant and the deviation). It **changes the series only inside a reporting gap**: (a) an *open* gap - the meter has not reported since t0 (>= 30 min): the energy `reading - v0` is spread over [t0, reading] and the counter continues from the typed value; (b) a *closed* gap - two accepted readings >= 30 min apart, the typed value between them, no counter event at the second: the gap's energy is re-split at the reading (the total is unchanged). Everything else is "for comparison" with a reason (`reported`, `outside_counter`, `no_counter_data`, `counter_events`, `implausible`, `billed`). | The owner's rule D7 (bill only what was measured) and round 2 (allocation by time) stay intact: a manual reading never invents energy in a closed gap, it only places it in time more precisely. An open gap is the one case where a bill otherwise stops at the last report; a typed reading lets it reach the period end. Readings that disagree with the counter are exactly what calibration is for, so they are kept, not rejected. |
| D6 | The typed value is converted to the counter's scale through the calibration in force at its instant (`counter = (physical - offset) / factor`). | Readings are typed from the physical meter; the series is on the counter's scale. |
| D7 | Validation: no instant in the future (5 minutes slack) or before the meter was added; units kWh / Wh / MWh (stored as integer Wh, half-up); a value never lower than an earlier manual reading, nor higher than a later one, of the same counter life; one reading per instant; a closed-gap re-split never before the last billed instant; an open-gap value must be >= the last counter value and within the meter's plausibility cap (`max_kw`). | Monotonic per physical meter (not against the sensor, which may legitimately differ - that is the deviation). The plausibility cap is the same rule the counter uses for spikes. |
| D8 | **Undo window: 24 hours** after saving, by a holder of `energy.manage`, and only while no issued bill depends on the item; a reading that anchors a live calibration cannot be undone before that calibration. An undone item stays listed (who, when, optional reason). Undo of a gap reading puts the buckets back exactly (verified bucket by bucket against a twin meter). | Typos are found the same day; after a bill is issued the correction path is a new reading / calibration, never a silent change. |
| D9 | **Permissions**: reading the log needs `energy.view`; saving / undoing readings and calibrations needs `energy.manage` (the existing meters-module rule: the registry and replacement are `energy.manage`). The 403 is checked before the body is read and audited. | No new permission (owner: exactly three electricity permissions). |
| D10 | Billing: `meter_window` bills up to `data_until` = max(last report, last counter reading) - a manual reading after the last report counts; `last_report_at` itself is unchanged. New snapshot fields per meter: `calibrations` and `manual_readings` (informational); new notes `meter_calibrated` and `manual_reading` (printed on the PDF as general notes). | The PDF model already prints the server's notes; the readings on the bill are on the physical scale, so `end - start == consumption` when the calibration is continuous (anchor). |
| D11 | Calibration from the UI defaults to **"by a manual reading"** (the offset computed so the physical reading matches at that instant); a typed offset is the alternative. A **suggested factor** comes from the two latest compared readings at least a day apart (`physical change / counter change`, 4 places) - a hint only. | Keeps the printed readings continuous and avoids asking the operator to compute an offset. |
| D12 | Time-of-use exactness: with a factor, consecutive windows are rounded on the cumulative line, so their sum equals the rounded calibrated energy of the whole run (no drift over hundreds of band segments). Without a calibration nothing changes (identity fast path). | The EL5 additivity guarantee stays exact for the bill total. |

## 3. Storage

Migration `0058_energy_manual_readings.sql` (main DB). Number: after `git fetch --all` on 2026-10-05, `origin/main` ends at 0056 and
`origin/pilot/mobile-presence-push-server` (also in `integ/202`) takes `0057_mobile_presence_push.sql`; no other origin branch
has a 0057+ file. At integration the list is 0056, 0057, 0058; the migration-list tests on this branch say `[..., 56, 58]` and
become `[..., 56, 57, 58]` after the merge with 0057.

- `energy_meter_manual_readings`: meter, counter life, instant, physical Wh, typed value and unit, counter-scale Wh, the system's
  value at that instant (and whether a reading lay within 15 minutes), effect + reason, the counter readings around it, note,
  created / voided (by, at, reason).
- `energy_meter_calibrations`: meter, counter life, effective date + UTC instant, factor (decimal text), offset Wh, anchor reading,
  note, created / voided.
- `energy.db`: no schema change; a new reading flag 512 `manual_reading` (the counter flag list in `energy_counter.py`).
- Backup: both tables join `energy_backup.MAIN_TABLES` (and so `KEEP_WHEN_ABSENT`).

## 4. API (`/api/v1/energy/...`)

| Method | Path | Permission | Body / answer |
|---|---|---|---|
| GET | `/meters/{id}/manual-readings` | energy.view | `{items, calibrations, calibration, suggestion, billed_until, first_calibration_date, undo_window_hours, units}` |
| POST | `/meters/{id}/manual-readings` | energy.manage | `{read_at, value, unit: kWh\|Wh\|MWh, note?, dry_run?}` -> `{dry_run, reading, log?}` |
| POST | `/meters/{id}/manual-readings/{rid}/undo` | energy.manage | `{reason?}` -> the log |
| POST | `/meters/{id}/calibrations` | energy.manage | `{effective_date, factor, offset_kwh? \| anchor_reading_id?, note?, dry_run?}` -> `{dry_run, calibration, log?}` |
| POST | `/meters/{id}/calibrations/{cid}/undo` | energy.manage | `{reason?}` -> the log |

`Meter` gains `calibration: {factor, offset_kwh, effective_date} | null`; `value_kwh`, `today_kwh`, `month_kwh`, the series and
`/consumption` are calibrated. Errors: `validation` 422, `reading_not_monotonic` 422, `reading_exists` 409, `calibration_before_counter`
422, `calibration_not_after_last` 409, `calibration_billed` 409, `anchor_without_counter` 422, `undo_window_passed` 409,
`already_undone` 409, `reading_billed` 409, `reading_anchors_calibration` 409, `undo_refused` 409, `meter_retired` 409. Audit
actions: `energy.meter.manual_reading`, `energy.meter.manual_reading.undo`, `energy.meter.calibrate`, `energy.meter.calibration.undo`
(allowed and refused; dry runs are not audited).

## 5. Screens

In the meter card (תשתיות › מוני חשמל › מונים › a meter), a section "קריאות ידניות וכיול": the calibration in force (or "ללא כיול"), the
suggested factor with "כיול לפי ההצעה", the readings (value, instant, deviation from the system, who, a short effect chip "השלימה פער" /
"חילקה פער" / "להשוואה", undone ones struck through) and the calibrations ("בתוקף"). With `energy.manage`: "קריאה ידנית", "כיול", and
"ביטול" on a fresh item. Dialogs: the manual reading (date and time, value, unit, note) with a live preview from a dry run (the
system's value then, the difference, what will happen); the calibration (effective date with the billed minimum, factor, "לפי
קריאה ידנית" / "הזנה ידנית" offset) with a preview; the undo confirmation with an optional reason. Built from the electricity
styles (`elecCss`) and the skin controller, so classic / bubble and light / dark follow the module; the forms fall to one column
under 520 px. Copy: no platform names, Western digits, signed differences in an LTR-isolated span.

## 6. Tests

- Backend `tests/test_energy_manual_readings.py`: store (open gap + exact undo before and after the meter reports again, closed
  gap re-split + exact undo, every record-only reason), provider (factor from the date, history untouched, additive windows,
  physical readings, daily / history, replacement ends the calibration, the bill window reaches the period end through a manual
  reading), API (validation, dry run, audit, monotonic, duplicate, undo window, billed guard, anchor offset, suggestion, RBAC 403
  before the body, 415, replacement on the physical scale), billing + PDF model with a calibration. Migration-list tests include 58.
- Frontend: `tests/unit-electricity-readings.spec.ts` (parsing, formats, labels, fixtures), `tests/electricity-readings.spec.ts`
  (the section, preview, save, undo, validation, calibration from the suggestion, billed refusal, read-only view; all projects),
  `tests/layout-electricity-meters.spec.ts` gains the section and both dialogs.

## 7. Not built / limits (said up front)

- No reading import (CSV) and no photo of the meter: not asked.
- A manual reading does not start a counter that never reported in its counter life (`no_counter_data`); the replacement's typed
  start reading covers that case.
- On the day of a meter replacement, the history chart (daily totals) uses the factor in force at that day's start; bills use the
  exact quarter-hour split.
- A manual reading older than the raw-reading retention (90 days by default) can only be recorded for comparison.
