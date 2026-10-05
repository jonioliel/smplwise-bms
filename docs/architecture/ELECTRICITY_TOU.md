# Electricity time-of-use billing (EL5) — תעו״ז

Status: built on `pilot/EL5-tou-billing` for 2.0.1. Extends CR-023 (fixed price per kWh, owner decision D0: "time-of-use
later, the tariff structure stays versioned"). Contracts touched: ELECTRICITY_BILLING_API.md (tariffs, `/tou/*`,
`/calendar*`), ELECTRICITY_BILL_SNAPSHOT.md section 6 (additive snapshot keys). Research and open facts: NN3 plan section 7
(private/nn3-electricity/PLAN.md).

## 1. What it does

A tariff is either **fixed** (one price per kWh, unchanged) or **time-of-use** (`kind: "tou"`). A TOU tariff version holds a
*definition*: seasons, day types, bands and their local hours, and a price per season and band. A bill of a TOU account gets
one charge line per (price piece, season, band) - e.g. "צריכת חשמל - פסגה (קיץ)" - priced with that band's price under the
version's VAT mode and the normal rounding rules, plus a daily table per band. Nothing about Israel is a constant in code:
the Israeli structure is a template with EMPTY prices that the manager fills and confirms.

## 2. The definition (`energy_tariff_versions.definition_json`)

```jsonc
{
  "seasons":   [{"id": "summer", "name_he": "קיץ", "ranges": [["06-01", "09-30"]]},
                {"id": "winter", "name_he": "חורף", "ranges": [["12-01", "02-29"]]},
                {"id": "transition", "name_he": "מעבר", "ranges": [["03-01", "05-31"], ["10-01", "11-30"]]}],
  "day_types": [{"id": "weekday", "name_he": "ימי חול"}, {"id": "friday", "name_he": "שישי וערבי חג"},
                {"id": "saturday", "name_he": "שבת וחג"}],          // ascending "rest" order
  "week":      {"sun": "weekday", "mon": "weekday", "tue": "weekday", "wed": "weekday", "thu": "weekday",
                "fri": "friday", "sat": "saturday"},
  "holiday": "saturday", "holiday_eve": "friday",                  // null = holidays do not change the day type
  "bands":     [{"id": "offpeak", "name_he": "שפל"}, {"id": "peak", "name_he": "פסגה"}],
  "default_band": "offpeak",                                       // every time not listed below
  "schedule":  {"summer": {"weekday": [["17:00", "23:00", "peak"]]},
                "winter": {"weekday": [["17:00", "22:00", "peak"]], "friday": [["17:00", "22:00", "peak"]],
                           "saturday": [["17:00", "22:00", "peak"]]},
                "transition": {"weekday": [["17:00", "22:00", "peak"]]}},
  "prices":    {"summer": {"offpeak": "0.5000", "peak": "1.6895"}, "winter": {...}, "transition": {...}}
}
```

Validation (`energy_tou.parse_definition`, first error wins, `{code, path, message_he}`):
- ids `^[a-z][a-z0-9_]{0,23}$`, unique; Hebrew names 1-40 characters; up to 12 seasons, 8 day types, 8 bands, 24 ranges.
- Seasons: inclusive `MM-DD` ranges that may wrap the year end; together they cover every day of a leap year exactly once
  (`season_gap`, `season_overlap`). 29 February belongs to the season of 28 February unless a range names it explicitly.
- Every weekday is mapped to a defined day type; `holiday` / `holiday_eve` are a defined day type or null.
- Ranges are local `HH:MM` on quarter hours (the readings store's resolution; `time_quarter`), end may be `24:00`, a range may
  cross midnight (`["22:00", "06:00", "night"]` = 22:00-24:00 and 00:00-06:00 of the SAME date's day type); no overlaps.
- A price (0-1000, up to 4 decimals) is required for every band that can occur in a season (the default band and the bands of
  that season's ranges); prices for other bands are allowed. Prices are entered before or including VAT per the version's
  `price_mode`, exactly like the fixed price.
- The normalised definition is what is stored, sealed into snapshots and hashed (`definition_sha256`, canonical JSON).

## 3. Special days (holidays and eves)

`services/energy_calendar.py`. A date is `holiday`, `holiday_eve` or regular:
1. a manual entry (Settings key `energy.calendar`, own route `/energy/calendar*`) wins - it can add a day, retype it, or cancel
   a generated one (`regular`);
2. otherwise the generated Israeli list (`generator: "israel"`, default; `"none"` turns it off): Rosh Hashanah (2 days), Yom
   Kippur, Sukkot (first day), Shemini Atzeret, Pesach first and seventh day, Shavuot, Independence Day (5 Iyar, moved to
   Thursday from Friday/Saturday and to Tuesday from Monday), each with its eve. Computed locally from the Hebrew calendar
   arithmetic (Reingold & Dershowitz); no library, no network. Tested against the published dates 2022-2027.

The day type of a date is the most restful (last in `day_types`) of: the weekday's type, and the holiday or eve type when the
date is one. So a Saturday that is a holiday eve stays Saturday; a Friday holiday becomes Saturday.

**Not verified** (shown to the manager as "לאישור"): which days the Electricity Authority counts, the Friday rule, whether
winter peak applies on Saturdays and holidays. The template follows the secondary sources of the NN3 plan section 7.

## 4. Classification of time (DST-safe)

`energy_tou.segments(start, end, tz, ...)`: the bill window [local midnight of the first day, local midnight after the last
day) is cut at every UTC quarter hour; each part takes the season, day type and band of the **local wall-clock time of its
start** in the account's IANA zone (`zoneinfo`; no fixed +2/+3). Consecutive equal parts (same price piece, local date,
season, day type, band) merge into one segment. Consequences:
- the spring DST day has 23 hours (02:00-03:00 never exists, so a band defined there gets nothing that day);
- the autumn DST day has 25 hours; both copies of the repeated hour take the band of that wall-clock hour;
- a holiday changes only its own local date; a season or price-piece boundary is a local midnight, so a segment never
  crosses one.

## 5. The bill computation

`energy_billing.compute_tou` (called from `compute` when every price piece of the period is a TOU version; a period mixing
the two kinds is refused with `tariff_kind_mixed`, which the API prevents by allowing one kind per tariff):
1. Price pieces are cut, as before, at every tariff-version or VAT-rate change date (owner round 2, Q4 = b).
2. The window is classified into segments (section 4).
3. Per meter, `meter_window` reads the energy of every segment from the readings store (allocation by time, additive -
   ELECTRICITY_INTERFACES.md section 2.1). The real provider answers all segments of a meter with ONE read of the
   quarter-hour buckets (`EnergyProvider.consumption_windows`, identical results to one read per window, tested).
4. Energy carried from the previous bill (a meter that reported late, CR-023 decision Q6 = a) is split by its own time with
   the first piece's definition and priced by its band with the first piece's prices; it is not counted in `hours` or in the
   daily table.
5. Groups (piece, season, band): the linear account formula is applied to the meters' group energy; kWh rounded half-up to 2
   places, then `energy_pricing.line` with the band price (ex/inc VAT rules unchanged). A negative group is
   `formula_negative` with `details.season`/`details.band`.
6. Totals are the sums of the rounded lines (unchanged rule). `tou.by_band` and `tou.daily` are added to the snapshot.
7. Notes: `tou_special_days`; `tou_spread_gap` when a meter did not report for 2 hours or more across more than one band
   (the store spread that energy evenly over the gap, so the band split there is by time, not measured; raw readings only,
   kept 90 days by default; at most 6 notes + a count).

A meter that stopped reporting is billed up to its last report, as before (the rest goes to the next bill, priced by its own
hours there). A period beyond the quarter-hour retention (`energy.interval_retention_months`, default 26) has only daily
totals left: a TOU bill is refused with `tou_needs_interval_data` (a fixed bill still works).

## 6. Corrections and immutability

Versions are corrected like fixed prices (`plan_version_change`): `in_place` when no sealed bill used the version, else
`later_only` from the end of the last sealed period; a TOU correction compares definitions by hash, its `base` carries
`definition_sha256`. An issued bill never changes: its snapshot holds the full definitions and the special days it used.
Changing a special day returns `drafts_to_recalculate` (open TOU drafts that contain the date).

## 7. Tests

`tests/test_energy_tou_engine.py` (calendar, validation, classification incl. both DST days and the repeated hour, holidays,
season and piece boundaries, batched store read equals per-window reads, reporting gaps) and
`tests/test_energy_tou_billing.py` (API end to end with hand-counted hours: summer golden numbers ex/inc VAT, load-shaped
energy, October 745 h, March 743 h, April holidays + manual override, winter, a season change inside an ad-hoc period, a
tariff version and a VAT change inside a period, a meter that stopped, carried energy by band, sub-meter formula and a
negative band, the quarter-hour requirement with a fake and with the REAL store, validation, corrections against a sealed
bill, special-days API and permissions, the PDF model/HTML and both PDF engines where installed).

## 8. Not built / limits

- Supplier discount plans as a separate "% off the regulated price" layer: not built; a discount plan is expressed as its own
  TOU tariff (its windows as bands with their discounted prices).
- Fixed monthly charges: none (owner round 2, Q7).
- Real Israeli prices and the Authority's exact hours, Friday rule and holiday list: not verified; the template ships with empty
  prices and says so.
- The monthly bill chart stays in kWh totals (no per-band history).
