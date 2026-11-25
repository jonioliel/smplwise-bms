# Deep review 2.52 - DOMAIN-MODULES

Reviewed head: `origin/release/2520-train` at `eadaa25b81c0e65c86d8aa6ff5f108816bcc7c2d`. Read-only review; no product code changed.
Paths below are relative to `smplwise_vms/backend/smplwise/`.

Area: tickets (main app, public page, partner API, vendors / RFQ / costs), calendar and room booking, notices / boards / news feeds,
electricity and water billing, generator monitoring and alert routing, insights, presence, emergency / alarm, maintenance, temperature,
multi-building (filter, scope, shared building), home interface backend.

Method and honesty note: the area is about 80,000 lines. It was read by one reviewer in one pass, so coverage is by risk, not line by
line: the money engines, the lifecycle of a bill, the automatic generation, the generator alert engine, the calendar occurrence cache and
conflict check, the news fetcher, the multi-building modules and the home-interface gate were read in full; the other parts were read at
their entry routes and authorization seams (section "Checked and fine" says exactly which). Findings are CONFIRMED by reading the code
path end to end. Tests run: one pure-function check of `energy_periods.regular_periods` for finding D-01 (output quoted there). No test
suite was run (NOT_RUN); no lab, device or network access.

## Summary

| id | severity | title | file:line |
|---|---|---|---|
| D-01 | medium | Changing an account's billing cycle after bills exist leaves a silent unbilled gap | `services/energy_billing.py:641-663,696`, `services/bill_ledger.py:294,460` |
| D-02 | medium | Generator battery alert: a 24 V bank that sags to 16 V or less is judged as a healthy 12 V bank and the alert clears | `services/generator_alerts.py:194-199` |
| D-03 | medium | Generator alert mute: any `generator.view` holder silences any type (critical included) for up to 7 days, no un-mute, and an alert raised while muted never notifies afterwards | `services/generator_alerts.py:341-362,509-518`, `routers/generator.py:365-370` |
| D-04 | medium | Room double booking beyond the series cache horizon (conflict check reads a cache that holds a series only `series_horizon_days` ahead) | `services/calendar/occ.py:64-74,138`, `services/calendar/events.py:197,226`, `services/calendar/jobs.py:37` |
| D-05 | medium | An automatic draft bill nobody reviewed is deleted by retention after 30 days and its period is never generated again (water drafts are not even announced) | `services/bill_ledger.py:395-417,498-518`, `services/water_billing.py:876-887` |
| D-06 | low | A VAT rate used only by issued WATER bills can be deleted (the "in use" check reads electricity bills only) | `services/energy_billing.py:424-432,585-590` |
| D-07 | low | Customer number lock ignores numbered water bills | `services/energy_billing.py:323-324` |
| D-08 | low | Automatic generation retries a failing (account, period) every 6 hours forever, one audit row each time | `services/bill_ledger.py:395-397,420-429,464-469` |
| D-09 | low | Open generator alerts are orphaned when their role mapping or device is removed | `services/generator_alerts.py:376,394-395` |
| D-10 | low | News feed that never succeeded is re-fetched on every board poll (no back-off without a cached result) | `services/notices/sources.py:446-480` |
| D-11 | low (design) | Billing has no per-person or per-building scope: a home-only person granted `energy.bills` can read every customer's accounts and download any issued bill | `services/home_interface.py:157,170,508-522`, `routers/energy_billing.py:347-352,967-971` |
| D-12 | low (PLAUSIBLE) | Building reach: mapping a so-far unmapped area INTO a building is not checked by `RemapGuard` | `services/building_scope.py:161-196` |

Counts: critical 0, high 0, medium 5, low 7 (one of them PLAUSIBLE).

## Findings

### D-01 (medium, CONFIRMED) - a billing-cycle change after bills exist leaves a silent unbilled gap

Where: `services/energy_billing.py:641-663` (`_account_fields` copies `period_months`, `period_anchor_day`, `period_anchor_month`,
`first_period_start` with no check), `:696` (`update_account`), `routers/energy_billing.py:372-386`; the same code path serves water
accounts through `services/water_billing.py:350-417`. Consumers: `services/bill_ledger.py:400-417` (`due_periods`), `:447-463`
("exists" -> run row `skipped`), `:294-316` (`prev_bill` / `carried_from` match `period_end = start` exactly).

Scenario: an account bills monthly from the 1st and has issued bills through 01.10-31.10. An administrator changes the anchor day to 15.
The regular periods are now laid from `first_period_start` on the new grid. Verified with the pure function:

```
old cycle (day 1):  ... ('2026-09-01','2026-10-01'), ('2026-10-01','2026-11-01')
new cycle (day 15): ... ('2026-10-15','2026-11-15'), ('2026-11-15','2026-12-15')
```

The automatic generation finds 15.10-15.11 overlapping the issued October bill, records the run as `skipped` (permanently settled) and
then creates 15.11-15.12. The energy of 01.11-14.11 is in no bill. Nothing carries it: `prev_bill` looks for a sealed bill whose
`period_end` equals the new period's start (15.11) and finds none, and "carried" only covers late reports of a matched predecessor. No
note, no notification, no status flag says a gap exists; the skipped run row is the only trace. The same happens when `period_months`,
`period_anchor_month` or `first_period_start` moves, and in general whenever a period is skipped (a failed run that is never fixed):
there is no continuity check between consecutive bills of an account.

Impact: consumption that was measured is never charged (lost revenue), silently.

Suggested fix: (a) on a cycle change of an account that has sealed bills, either refuse without an explicit "new cycle starts on"
date, or start the first period of the new cycle at the last sealed `period_end` (a partial period, like the first period of an
account); (b) independently, a continuity check in `compute`: when the latest sealed bill of the account ends before this period's start
(or no bill ends exactly there and one exists earlier), add a snapshot note and surface it in the account status so the gap is visible
before issue.

### D-02 (medium, CONFIRMED) - generator battery alert misjudges a collapsing 24 V bank

Where: `services/generator_alerts.py:194-199`:

```python
low = c.th["battery_min_12v"] if b <= 16 else c.th["battery_min_24v"]
return b < low, ...
```

Defaults (`services/generator_catalog.py:290`): 11.6 V and 23.2 V. The nominal system voltage is guessed from the CURRENT reading on
every pass.

Scenario: a 24 V starter bank reads 22.9 V -> `battery_low` raises (correct). The bank keeps failing and reads 15.8 V. Now `b <= 16`,
the 12 V threshold applies, 15.8 >= 11.6 -> `active = False` -> `evaluate` clears the row (`:414-416`) and the notification centre gets a
"resolved". A dead 24 V battery (any reading between 11.6 V and 16 V) shows as healthy; the generator will not start on the next mains
failure and nobody is told. The reverse error does not exist (a 12 V bank never reads above 16 V for long), so the guess is only wrong
in the dangerous direction.

Suggested fix: make the nominal voltage a property of the device (a setting next to `rated_kw`, or latched from the highest value seen
and stored), never inferred per sample. Until then at least treat `16 < min_24v` readings of a device that has ever read above 16 V as
low.

### D-03 (medium, CONFIRMED) - generator alert mute is too wide and loses the alert

Where: `routers/generator.py:365-370` (the route needs only `generator.view`: `_view_w`), `services/generator_alerts.py:509-518`
(`mute`: per device and alert TYPE, 1 h to `MUTE_MAX_H` = 7 days, upsert), `:341-362` (`_raise`: `if not muted:` is the only place a
notification is emitted), `:411-416` (`evaluate` raises only when no open row exists).

Three problems in one path:
1. Any holder of `generator.view` (the role that only looks) can mute ANY type, including the critical ones (low oil pressure, emergency
   stop, fuel shutdown, controller shutdown), for 7 days. The module's own rule says a CRITICAL alert "always escalates and is never held
   by quiet hours" (module docstring and `escalation_after_min`); the mute bypasses both, because no notification row is created at all.
2. There is no un-mute. `generator_mutes` is only written by `mute` and deleted by `prune_alerts` after expiry; a wrong click can only be
   shortened by muting again for 1 hour.
3. An alert that is raised while its type is muted creates the alert row without a notification (`notification_id` stays NULL). When the
   mute ends and the condition still holds, `evaluate` sees the open row and does nothing: nobody is ever notified for that incident, and
   the later clear emits no "resolved" either. A 24 h mute on `low_fuel` followed by the tank running dry is silent end to end if the
   level stays below the threshold.

Suggested fix: require `generator.manage` (or a dedicated permission) to mute a critical type; add `DELETE .../mute`; in `evaluate`,
when an open row has no `notification_id` and its type is no longer muted, emit the signal then (the mute delays, it does not swallow).

### D-04 (medium, CONFIRMED) - double booking beyond the series cache horizon

Where: `services/calendar/occ.py:64-74` (a series is cached only inside `[now - 30 d, now + series_horizon_days]`; a single entry in
full), `:138-160` (`blockers` reads `cal_occurrences` only), `services/calendar/events.py:197` (the per-calendar `horizon_days`, up to 730,
is skipped for a role of `edit` or above), `:226` (the conflict check), `services/calendar/model.py:59,297` (`series_horizon_days` default
400, minimum 30), `services/calendar/jobs.py:35-41` (the nightly roll re-expands every open series and inserts the rows; it checks
nothing).

Scenario A (defaults): an exclusive room has an open weekly series (Tuesday 18:00). A person with the `edit` role on the room books a
single event on a Tuesday 18:00 that is 14 months ahead. The series has no cached occurrence there yet, `blockers` finds nothing, the
booking is `confirmed`. Two months later the nightly roll writes the series occurrence into the same slot. The room now has two
confirmed bookings for the same time and nothing reports it.

Scenario B (settings): `series_horizon_days` set to 30-179 while a room keeps its default `horizon_days` of 180 - then every ordinary
booker can do the same; nothing validates the two numbers against each other.

The mirror case is the same root: a NEW series is checked only against the window (`evaluate` expands to the horizon), so its later
occurrences can land on an existing far-ahead single booking when the roll reaches them.

Suggested fix: in `evaluate`, when a span lies beyond `now + series_horizon_days`, expand the open series of that holder for the span on
the fly (the expander is pure and cheap) instead of trusting the cache; and in the nightly roll, when a newly cached series occurrence
collides with an existing confirmed occurrence on an exclusive holder, mark it contested and notify the room manager. Also refuse a
`series_horizon_days` below the largest `horizon_days` of any calendar.

### D-05 (medium, CONFIRMED) - an unreviewed automatic draft disappears and its period is never billed

Where: `services/bill_ledger.py:498-518` (retention deletes every draft whose `updated_at` is older than `energy.draft_retention_days`,
default 30, minimum 7), `:395-417` (`_settled` / `due_periods`: a run row with status `created` settles the period for good),
`services/water_billing.py:876-887` (the water pass has no `draft_ready` hook; electricity tells once through
`services/energy_notify.draft_ready`).

Scenario: accounts in automatic mode `draft`. The pass creates the September draft on 1 October and records the run `created`. The one
notification is missed (or, for water, never sent). On 31 October retention deletes the draft with its events. `due_periods` will never
offer September again, because the run row is settled; the docstring says so on purpose ("an old period is never generated again"). The
only audit trace is a count in `bill.retention`. The period stays unbilled unless someone notices the missing month and creates the bill
by hand.

Impact: silently lost revenue; most likely exactly in the unattended installations automatic mode is meant for.

Suggested fix: never let retention delete a draft of origin `auto` without telling: either exclude automatic drafts from the draft
retention, or send a "draft expires in N days" notification and, on deletion, flip the run row to a state the bills screen lists as
"missing". Add the `draft_ready` hook to the water pass.

### D-06 (low, CONFIRMED) - a VAT rate used by issued water bills can be deleted

Where: `services/energy_billing.py:585-590` (`delete_vat`) -> `_version_used` at `:424-432` scans `energy_bills` snapshots only. The VAT
table is shared (`services/water_billing.py:72`, `vat_rates = eb.vat_rates`), and water lines record `vat_rate_id`.

Scenario: an installation bills water only (or the rate period was used only by water bills). The administrator deletes the VAT row.
Issued bills are safe (the snapshot carries the percentage), but a later correction of such a bill recomputes with whichever rate is then
in force for those dates (the earlier rate, or `vat_missing`), so the corrected bill's VAT differs from the original for a reason nobody
chose. Water does it right for its own tariff versions (`_sealed_version_ids`).

Suggested fix: `_version_used` (for `vat_rate_id`) reads both bill tables - best through `bill_ledger` with both kinds.

### D-07 (low, CONFIRMED) - the customer number lock ignores water bills

Where: `services/energy_billing.py:323-324`: the lock that keeps a customer number once numbered bills exist checks `energy_bills` only.
A customer with numbered water bills only can be renumbered. Numbers cannot collide (the shared ledger `energy_bill_numbers` keeps every
number ever used), but the issued water bills then carry a customer number that no longer belongs to that customer, and the freed number
can be given to another customer whose bills share the same `YYYY-MM-CCCC` base with a `/2` suffix.

Suggested fix: the same check over `water_bills` (guarded for a database without the table, like `_has_water_accounts`).

### D-08 (low, CONFIRMED) - endless 6-hourly retries of a failing automatic period

Where: `services/bill_ledger.py:395-397` (`_settled`), `:420-429` (`record_run` counts `attempts` but nothing reads it), `:464-469`
(each failed attempt writes a `bill.auto_failed` audit row).

Scenario: an account whose formula became invalid (a retired meter) or whose tariff has no price for a date fails with a permanent
error. Each of its due periods (up to 24) is recomputed every 6 hours forever, and each attempt writes an audit row: about 4 rows a day
per period, without end, until someone fixes or pauses the account.

Suggested fix: a cap (for example 8 attempts), then status `failed_final` shown on the bills screen with the error code; reset when the
account's `revision` changes.

### D-09 (low, CONFIRMED) - orphaned open generator alerts

Where: `services/generator_alerts.py:376` (removed devices are not evaluated), `:394-395` (a type whose roles are no longer mapped is
skipped before the clear branch). An alert that is open when its sensor role is unmapped, or when the generator is removed, stays open
forever: it keeps counting in `open_count` (`:460`, no join on the device status) and its notification-centre row is never resolved.

Suggested fix: in `evaluate`, clear open rows of unavailable types; on device removal, close its open alerts with a "removed" resolution.

### D-10 (low, CONFIRMED) - no back-off for a feed that never succeeded

Where: `services/notices/sources.py:446-480`. `_refresh` stores a back-off timestamp only when the URL already has cached titles
(`elif url in self._items`). A feed that has never succeeded has no entry, so every `titles()` call (each board poll, each board) starts
a new fetch thread as soon as the previous one ends. The fetch itself is well bounded (15 s, 512 KiB, pinned address), so the cost is one
outbound request per poll to a host that refuses or times out - a slow retry storm against a third party, and a thread held for up to
15 s per poll.

Suggested fix: on failure without a cache, store `(now, [])` so the TTL applies.

### D-11 (low, design limit) - billing is installation-wide, also for a home-only person

Where: `routers/energy_billing.py:270-275` (every gate is `authorize(..., INSTALLATION)`), `:347-352` (`GET /energy/accounts` lists every
account, with money when the caller holds `energy.bills`), `:967-971` and `services/home_interface.py:157,170,508-522` (the home gate
opens `/energy/accounts`, `/energy/accounts/{id}/(status|periods)` and `/energy/bills/{id}/pdf`; `home_bill_file_check` only refuses
drafts and void bills).

There is no link between a person (or a building) and a customer / account. In a single-family installation that is what the owner
approved. In a multi-tenant or multi-building installation, giving a resident `energy.bills` so that he sees "his" bill on the home
screen gives him every customer's name, address, tax id (inside the PDF) and amounts. Nothing in the screens warns about it.

Suggested fix (when tenants are a target): an optional `user -> customer` binding and a filter in the three home routes; until then a
warning in the home-interface policy page when `bills` is enabled for a home-only person on an installation with more than one customer.

### D-12 (low, PLAUSIBLE) - `RemapGuard` checks moves OUT of a building only

Where: `services/building_scope.py:161-196`. The guard compares only areas that resolved to a building BEFORE the write
(`self.before.items()`). An area that resolved to no building (not yet mapped) can be mapped into building A by anyone who holds the
route's permission in A. While `security.building_reach` is `map_and_mapping` (the default) this puts that area's devices within reach of
every holder of a binding scoped to A. Before the write those devices were reachable only through an installation-level binding. On a
site where building B's areas are not mapped yet, a floor editor of A can claim them. The docstring states the rule for "moving OUT"
only, so this may be an accepted limit; it is not written down as one.

Suggested fix: for an area that had no building, require the route's permission at installation scope (or `system.configure`), or record
the acceptance in `docs/changes/BUILDING-SCOPE-CONTROL-2351.md`.

## Improvements (short)

- I-1 Automatic mode `issue` seals a bill even when a meter did not report to the end of the period (the snapshot has the
  `meter_not_reporting` note, the rest is carried to the next bill). Safer: fall back to a draft plus the notification when any meter of
  the account has that note (`services/bill_ledger.py:480-488`).
- I-2 `services/maintenance/reminders.py:128-158`: `notify.emit_full` is called without a guard inside the loop; one task whose signal
  raises aborts (and rolls back) the whole pass on every tick. Wrap per task in a savepoint, as `_open_ticket` already does.
- I-3 Generator hold timers (`_SINCE`) are not reset while a value is unknown (`active is None` -> `continue`,
  `services/generator_alerts.py:408-410`), so a condition seen once before a long sensor outage raises on the first bad sample after it,
  without the hold. Pop the timer when the judge answers None.
- I-4 `services/notices/audience.py:92-97`: `resolve_users` runs the per-user binding query for every active user (N+1); fine today,
  worth one joined statement before installations with hundreds of users.
- I-5 `services/home_interface.py:115-121`: the home gate lets every method through under `/energy/meters/` and `/alarm/panels/`, while
  the comment above the phase-3 list says the writes are refused. Each route's own permission still decides, so nothing is open today;
  listing the reads exactly (as phase 3 does) would make the comment true.
- I-6 `services/energy_billing.py:424-432` and `services/water_billing.py:263-270` parse every sealed snapshot on each tariff / VAT list
  and delete. A `(bill_id, version_id)` index table written at seal time removes a scan that grows with every bill for 7 years.

## Checked and fine

Read in full, no finding:
- Electricity pricing and rounding (`energy_pricing.py`): Decimal throughout, half-up per line then sums, `inc_vat` back-calculation,
  split at tariff / VAT changes, due dates incl. month-end clamping.
- Billing periods (`energy_periods.py`): local dates, IANA zone conversion per date (DST days 23 / 25 h), anchor day 29-31 clamping
  without drift, partial first period, same period last year incl. 29 February.
- Consumption windows (`energy_consumption.py`): carried energy billed once, `stop_at` caps of a correction with a successor, first
  reading inside the window, unknown store -> `NullReadings` -> formula error, never a zero bill from a missing store.
- Time of use (`energy_tou.segments`, `energy_billing.compute_tou`): classification by local wall clock per UTC quarter hour, carried
  energy priced by its own band, per-group negativity check, snapshot keeps the definitions.
- Bill lifecycle (`bill_ledger.py`): overlap check and number assignment inside the write transaction, shared number ledger across
  electricity and water, correction chain numbering, idempotent create / issue by client request id, row-version checks, `draft_stale`
  path, the correction voiding its original in the same transaction, automatic generation idempotence (run row in the draft's
  transaction, re-check under the write lock, account revision re-check).
- Water billing compute (`water_billing.py:465-643`): same rounding, sewage line under the same VAT mode, 3-place quantities.
- Bill PDF route: stored file confined to `energy/bills/`, hash re-check, draft / void watermark, render rate limit.
- Ticket cost arithmetic (`tickets/money.py`) and budgets (`tickets/budgets.py`): integers in minor units, half-up once, floats refused,
  period bounds from local midnights of the installation zone.
- Generator alert engine apart from D-02 / D-03 / D-09: unknown values are never judged (None -> no change), events need a previous value
  (no event on the first pass after a start), flap folding, routing = roles AND `generator.view`, critical escalation.
- Calendar recurrence expander (`calendar/recurrence.py`): wall-clock expansion across DST, COUNT / UNTIL, ordinal weekdays, month-end,
  series size cap; `within_hours` incl. an end at midnight; buffers; held slots of pending changes.
- News fetcher (`notices/sources.py`): https and port 443 only, no credentials, numeric-host tricks refused, every resolved address
  checked, connection pinned to the checked address (no DNS rebinding), each redirect re-validated, total time and body caps, bounded
  inflate, safe XML parser, titles stripped to plain text.
- Notice audience (`notices/audience.py`): the reader rule and the push list use the same function; dead places reach no one.
- Multi-building display modules (`building_filter.py`, `home_buildings.py`): only narrow, run after the route's own permission, unknown
  building -> 404, off -> answers unchanged; `building_scope.cut` / `require_entity` refuse outside the building.
- Home-interface gate (`home_interface.py`): exact routes and whole-segment prefixes, read-only lists for GET / HEAD, kiosk calendar
  writes refused, hidden categories refused, system administrators never gated; `/home/tickets*` shows only tickets the caller created.
- Presence people (`routers/presence.py`, `presence_people.py`): master switch, notice acknowledgement, opt-out respected, per-scope
  `presence.view`, throttled audit without names.
- Alarm codes (`alarm_codes.py`): AES-GCM with the panel id as associated data, scrypt PINs, constant-time compares, lockout persisted.
- Partner API (`partner/core.py`): `GO_LIVE_PERMITTED = False` in this build - no switch can be turned on; token is 256 random bits,
  hash only stored; closed scope list.

Read at the routes / authorization seams only (no finding, not a full review): tickets main app and RFQ / vendor portal, the public
ticket listener (`tickets/public_*.py`; covered by `docs/security/PUBLIC_SURFACES_RECHECK_2310.md`, not repeated here), calendar feeds
and external sync (covered by `docs/changes/CAL-FEED-REVIEW-2351.md`), insights delivery, temperature runtime / report links, water
alerts and sampler, emergency readiness engine (read-only by design), maintenance service and files, energy meters store.

Not reviewed: the frontend of these modules; migrations; PDF rendering engines; WhatsApp / e-mail transports.
