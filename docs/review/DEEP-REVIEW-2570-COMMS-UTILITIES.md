# DEEP-REVIEW-2570 - COMMS-UTILITIES, second pass (id prefix `CU2`)

Second deep review pass for 2.57, area COMMS-UTILITIES. The scope is the "Not covered" list of
`docs/review/DEEP-REVIEW-2560-COMMS-UTILITIES.md` (branch `origin/review/DEEP-2560-COMMS-UTILITIES`). Findings CU-01..CU-04 and
the "checked and fine" ground of that review are not repeated here.

- Reviewed source: `v2.56.0` = `6ea807b2e` (read-only detached worktree). `B` = `smplwise_vms/backend/smplwise`, `F` = `frontend/src`.
- Method: the lead reviewer read the calendar sync engine, OAuth, credentials, the Google / Microsoft adapters, the WhatsApp channel,
  the alarm action routes and the elevator runtime end to end. Three read-only sub-reviewers covered the rest in parallel:
  - water, energy meters and the electricity price / VAT screens;
  - temperature, insights, emergency readiness and maintenance;
  - the settings screens, the notice TV and transit.
- The lead re-read the code path of every medium finding before listing it. Where that check was only partial, the entry says so.
- No product code was changed. The area's tests ran on the runner; section 3 has the real results.

## 1. Summary

| Id | Severity | Title | file:line |
|---|---|---|---|
| CU2-01 | medium | A full re-sync (410 / lost sync token) cancels every mapped calendar entry outside the provider's listing window, Arx bookings and their rooms included | `B/services/calendar_sync/engine.py:318-321`, `:415-423`; `google.py:126`; `microsoft.py:160-161` |
| CU2-02 | medium (PLAUSIBLE) | A recurring Arx series on a two-way Google / Microsoft binding: the returning instances overwrite the series' map row, so later edits and deletes hit one instance only | `B/services/calendar_sync/engine.py:343-349`; `migrations/0183_calendars.sql:177-187`; `google.py:122,149` |
| CU2-03 | medium | Any `calendar.connect` holder can list, read and write another person's external account by binding his own calendar to that person's connection | `B/routers/calendar_sync.py:295-309`, `:382-425` |
| CU2-04 | medium | Emergency readiness decides view / manage / rows with "permission held anywhere" instead of installation scope | `B/services/emergency/access.py:84-97` |
| CU2-05 | medium | Emergency item E02b shows green "the building is on mains" while mains is down and the generator is not carrying | `B/services/emergency/engine.py:162-173` |
| CU2-06 | medium | A temperature excursion escalates to ALARM while the reading is already back inside the band (within the hysteresis) | `B/services/temperature_runtime.py:378-385` |
| CU2-07 | medium | Water manual readings and their undo have no "already billed" guard and no undo window (electricity has both) | `B/routers/water.py:566`, `:579-599` |
| CU2-08 | medium | Editing an electricity tariff drops a rename and silently creates a new price version dated today | `F/electricity/elec-settings.ts:112,175`; `F/api/electricity-billing.ts:651-652`; `B/routers/energy_billing.py:579-606` |
| CU2-09 | medium | A required presence sensor that is not in the allowed list locks every in-scope app user out; neither the UI nor the server stops the save | `F/screens/system-presence.ts:226-231`; `B/services/presence.py:363-410`, `:1221-1222` |
| CU2-10 | medium | A presence settings PUT can commit part of the change (sharing turned on) without an audit row and then answer with an error | `B/services/presence.py:562-650`; `B/db.py:1096-1098` |
| CU2-11 | medium | One 404 stops a notice TV for good: it never polls again until someone reloads the screen by hand | `F/notice-tv/tv-logic.ts:506-509`; `F/notice-tv/main.ts:1441` |
| CU2-12 | low | A sync in flight overwrites a pause (state back to `ok` / `error`); the 10-minute lease has no overall time bound | `B/services/calendar_sync/engine.py:97-113`, `:232-240`, `:41` |
| CU2-13 | low | A rotated calendar refresh token can be written back after a disconnect or a client change | `B/services/calendar_sync/credentials.py:148-152`; `oauth.py:366-368` |
| CU2-14 | low | The HACCP daily verdict prints "OK" regardless of data coverage | `B/services/temperature_report.py:106-109` |
| CU2-15 | low | Emergency items fail open: E19 is green for an unread recorder clock; E18 ignores disabled emergency cameras | `B/services/health_report.py:545-546`; `B/services/emergency/engine.py:504-510`, `:522-528` |
| CU2-16 | low | E01 measures the generator ledger age from the time of recording, not the date performed | `B/services/emergency/engine.py:97` |
| CU2-17 | low | The emergency janitor takes the write lock every 30 s (module off too) and reads backup zips under it | `B/services/emergency/service.py:378-381` |
| CU2-18 | low (PLAUSIBLE) | No per-unit isolation in the temperature evaluator or the maintenance reminders: one bad row stops every unit | `B/services/temperature_runtime.py:295-469`, `:552-558`; `B/services/maintenance/reminders.py:130-157` |
| CU2-19 | low | Insights delivery can send a monthly report twice (no "sending" claim) and retries after a send that may have left | `B/services/insights_delivery.py:476-492`, `:380` |
| CU2-20 | low | Insights delivery burns its four attempts on `rate_limited` / `channel_down` (about 30 minutes) | `B/services/insights_delivery.py:359-365`, `:383-390` |
| CU2-21 | low | Maintenance files outlive their task; a file's bytes are removed before the delete commits | `B/services/maintenance/service.py:461-477`; `B/routers/maintenance.py:191-192` |
| CU2-22 | low (PLAUSIBLE) | HACCP report computation is unbounded (units x days) for a `devices.read` holder | `B/routers/temperature.py` report routes; `B/services/temperature_report.py:94-111` |
| CU2-23 | low | Water customer create / patch replies return contact fields to `water.manage` holders without `water.bills` | `B/routers/water_billing.py:188`, `:206` |
| CU2-24 | low | Water tariff version correction lacks the sealed-span and revision guards electricity has | `B/services/water_billing.py:298-310`; `B/routers/water_billing.py:266-276` |
| CU2-25 | low | The water "abnormal consumption" baseline counts partially covered days (false alerts) | `B/services/water_runtime.py:274` |
| CU2-26 | low | The water sampler stays dead after a quick module OFF then ON | `B/services/water_sampler.py:100-112`, `:127-128` |
| CU2-27 | low | Water storage hygiene: retention ignores open drafts / bill retention (PLAUSIBLE); the alert log is never pruned and is filtered in Python; the tariff list re-parses every bill per tariff | `B/services/water_sampler.py:157`; `B/routers/water.py:746`; `B/services/water_meters_store.py:48-61`; `B/services/water_billing.py:248-270` |
| CU2-28 | low | Small water / electricity UI money issues: "1,500" typed as 1.5 L; the VAT card hides a scheduled rate; a logo upload discards unsaved business fields | `B/services/water_meters.py:156`; `F/electricity/elec-settings.ts:231,250,378,386` |
| CU2-29 | low | Transit: an unknown stop (Stride's day snapshot not loaded yet) is stored as a fresh "no buses" | `B/services/transit/provider.py:54-59`; `B/services/transit/poller.py:197-199` |
| CU2-30 | low | Calendar settings are saved whole with no revision (lost update); stepper saves keep unsaved values, share one timer, and can write to the newly picked calendar | `B/routers/calendar.py:116-134`; `F/screens/system-calendars.ts:354-359`, `:464-486` |
| CU2-31 | low | The transit "refresh catalogue" progress ends after 3 s (the check compares a value with itself) | `F/screens/system-transit.ts:171-176` |
| CU2-32 | low (PLAUSIBLE) | Notice TV fetches have no timeout (one hung request freezes the poll chain); the transit provider is shared across threads without a lock | `F/notice-tv/main.ts:1437-1523`; `B/services/transit/poller.py:161-169`, `:242-246` |
| CU2-33 | low | Tests that cannot fail for the reason they state | `tests/test_insight215_slice3.py:297`; `tests/test_emergency_readiness_295.py:191`; `tests/test_water_alerts_s2.py` |

Counts: critical 0, high 0, medium 11, low 22.

## 2. Findings

### CU2-01 (medium) - a full re-sync cancels entries outside the provider's window

**Where.** `_apply_pull` (`engine.py:307-324`) treats a pull without a sync token as a complete listing.
- Every `cal_sync_map` row of the binding whose `ext_uid` the provider did not list goes through `_external_delete` (`:318-321`).
- With the default `sync_external_delete = cancel`, `_external_delete` cancels the Arx entry, its room rows and its overrides, and drops the map row (`:415-423`). This applies to an Arx-origin entry on a two-way binding, and to every imported entry.

**Why some entries are missing from the listing.** The adapters' full listings are windowed:
- Google lists from `timeMin = now - 30 days`, with no upper bound (`google.py:126`).
- Microsoft lists from 30 days back to 400 days ahead (`microsoft.py:160-161`).

So a full listing never contains an entry that ended more than 30 days ago, or (Microsoft) one that starts more than 400 days ahead.

**When a full listing happens.** Whenever the token is lost:
- Google answers 410 for an expired or invalidated sync token;
- Graph answers `SyncStateNotFound`;
- a delta link points to another host;
- a pull returns no `next_token`.

The in-memory fake lists every event, so the contract tests never see this.

**Scenario.**
1. A room calendar is bound two-way to a dedicated Google calendar.
2. Two months later Google returns 410.
3. The engine re-reads "the window". Every past Arx booking older than 30 days, and every imported past entry, becomes `cancelled`. This rewrites the booking history and the room usage reports, and writes one `calendar.sync.cancel` audit row per entry.
4. The same happens to Microsoft bookings more than 400 days ahead. Those are future bookings, and their rooms are released.

**Confirmed** by reading, and reproduced on the runner by `test_p2570r_cu_confirm.py` (section 3). That test uses a fake whose full listing applies the 30-day horizon.

**Fix.** A full listing deletes only map rows whose entry overlaps the window actually listed: pass the window (`lo`, `hi`) back in `PullResult`, and leave rows outside it alone. Google: also send `timeMax`, or skip the deletion sweep for entries that end before `timeMin`. Add a fake with a window to the contract tests.

### CU2-02 (medium, PLAUSIBLE) - a recurring series on a two-way binding breaks after the first pull

**The mechanism.**
- An Arx series is pushed as one event with RRULE / EXDATE (`google.py:85-93`, the Graph recurrence in `microsoft.py`). Its map row holds the master's id.
- Both adapters pull with recurrences expanded into instances: Google uses `singleEvents=true` (`google.py:122`), Graph uses `calendarView/delta` (`microsoft.py:4`).
- Every instance comes back with the series' `arx_id` marker and its own id. `_external_upsert` sees no map row for that id plus a known `arx_id`, and runs `INSERT OR REPLACE INTO cal_sync_map` (`engine.py:343-349`).
- `cal_sync_map` is `UNIQUE (event_id, binding_id)` (`0183_calendars.sql:177-187`), so each instance REPLACES the master's row. After one pull the series is mapped to the last instance seen.

**Effects.**
- The next edit of the Arx series is sent as `PUT .../events/<instance id>` with a recurrence body (`google.py:149`). The provider refuses it, or changes one instance only.
- Deleting the series in Arx deletes one instance at the provider; the other instances stay in the external calendar for good.
- On a full re-sync (CU2-01) the master id is never listed.

**Status.** PLAUSIBLE: the engine path is confirmed by reading. That instances carry the master's private extended property is provider behaviour, not modelled by the fake (`fake.py` has no recurrence expansion).

**Fix.**
- Map instances to the series by the provider's master id (`recurringEventId` / `seriesMasterId`), not by `arx_id` alone.
- Never `INSERT OR REPLACE` over an `origin = 'arx'` row whose `ext_uid` differs.
- Add a fake that expands series.

### CU2-03 (medium) - binding to someone else's connection uses his account

**The code.**
- `connection_calendars` (`routers/calendar_sync.py:295-309`) needs only `calendar.connect`. It lists the external calendars of any connection, using the owner's OAuth token.
- `put_binding` (`:382-425`) checks `calendar.connect` and an `edit` role in the Arx calendar, then accepts any `connection_id` (`_connection`, no `_own`) and any `external_calendar_ref`.
- `tests/test_calendar_sync_2300.py:236-249` pins this: `cora` binds to the administrator's connection and gets 200.

**Scenario.** Two people hold `calendar.connect`, for example a building manager and the owner. The manager binds a calendar he edits to the owner's Microsoft connection:
- with `direction = import` and the owner's personal calendar id from the listing, he reads the owner's private appointments into Arx (`detail = details` brings the notes too);
- with `export`, he writes entries into the owner's personal calendar.

Nothing tells the owner, and the audit row names only the binding.

**Spec.** The contract (`docs/changes/CALENDARS-CONTRACT-298.md` section 12, line 623) limits connection changes to the "owner or admin" but is silent on bindings. Because the test pins the behaviour, this is a decision for the owner rather than a slip.

**Recommendation.** Let a binding use only the caller's own connections, unless the caller is a system administrator or the owner marked the connection as shared. Apply the same rule to `GET .../calendars`.

### CU2-04 (medium) - emergency readiness uses "held anywhere"

**The code.** `Viewer.held` is `permissions_anywhere(...)` (`emergency/access.py:84`). `can_view`, `can_manage` and `can_row` test that set (`:90-97`), and the routes (`routers/emergency_readiness.py:45-120`) and `service.py` call sites rely on it.

**The spec.** `docs/changes/CR-EMERG104.md:110-121` says "`maintenance.view` at the installation" and "`maintenance.manage` (installation scope)". `rbac.permissions_anywhere` is documented as being for shell navigation.

**Scenario.** A site administrator bound to one floor only can:
- PUT `not_applicable` for E03, which takes an expired fire certificate out of the building verdict;
- raise thresholds (for example `generator_test_amber_days` to 730);
- read the full emergency contact list (phones, e-mails).

**Fix.** Use `authorize(conn, principal, perm, INSTALLATION)` for view, manage and each row. Keep "anywhere" only for the module's menu entry.

**Test.** A floor-scoped manager gets 403 on PUT config, and either an empty contact list or 403.

### CU2-05 (medium) - E02b says "on mains" during a blackout

**The code.** `e02b` (`engine.py:162-173`) is green unless a generator is carrying the load or every `mains_available` value is unknown. A `mains_available = False` with the generator NOT on load (failed to start, or the ATS stuck) falls through to green, `on_mains`, with the text "הבניין על הרשת". Stale values and the `available` flag are ignored.

**Why it matters.** The worst emergency case gets the opposite statement. The verdict is unchanged because E02b is information only, but the row is read by people deciding what to do.

**Fix.** Any `mains is False` while not carrying is red, "no mains and the generator is not carrying", with a banner. Stale or unavailable values count as unknown.

### CU2-06 (medium) - alarm while back inside the band

**The code.** Once a `high` / `low` event is open, the alarm timer fires when `not back` (`temperature_runtime.py:382`). `back` requires the hysteresis (`v <= high - hysteresis`, `:360`; default 0.3), so a reading of 4.8-4.9 against `high = 5.0` is neither outside nor back.

**Scenario.** The unit touches 5.1 for one minute and then sits at 4.8-4.9. After `high_alarm_min` a critical alarm fires with the text "4.8° above 5.0° for Z min", followed by the escalation chain. This is common for units that hover at the band edge.

**Fix.** Escalate only while the current reading is outside the band (track "outside since", and pause or reset the timer inside it).

**Test.** `[5.2] + [4.9] * Z` gives no alarm and no `temperature.alarm` notification.

### CU2-07 (medium) - water manual readings ignore billed periods

**The code.** `routers/water.py:566` calls `store.manual_reading(..., billed_until=None, ...)`. The undo route (`:579-599`) has no billed check and no 24-hour window.

Electricity passes `energy_calibration.billed_until`, so a reading falls back to `record/billed`, and `undo_reading` refuses `reading_billed` and enforces `UNDO_WINDOW_S`. Water bills are interval sums (`store.consumption` → `meter_window`), so a closed-gap allocation moves volume between quarter-hours of an already issued bill.

**Scenario.**
1. Readings A at 30.11 22:00 and A+100 L at 01.12 02:00. The November bill is issued with about 50 L of the gap.
2. A typed reading A+90 L at 30.11 23:59 is accepted as `closed_gap`. November's buckets now hold 90 L.
3. December starts at the boundary and bills only 10 L, so 40 L are never billed. The reverse case bills twice.
4. Undoing the reading moves the volume back, unchecked.

**Fix.** Derive `billed_until` for water from issued / sent / paid `water_bills` snapshots per meter, pass it in, and apply the same check plus the undo window in `undo_manual`.

**Test.** A reading inside a billed span gives `record/billed`. The issued bill's m³ plus the next draft's m³ equals the counter delta.

### CU2-08 (medium) - tariff edit: rename lost, version added

**The client.** `openTariff(t)` sets `from = elecToday()` and `tVer = null` (`elec-settings.ts:112`). `saveTariff` then calls `correctTariffVersion` with no version id and `confirm = false` (`:175`). The client sends `PATCH {name}` only when `confirm` is true (`api/electricity-billing.ts:651-652`).

**The server.** It finds no version dated today, adds one and answers 201 (`routers/energy_billing.py:579-606`).

**Scenario.** A manager renames "Tariff A" and saves:
- the name is unchanged;
- a new version with the same price starts today, so every later bill period crossing today is split with a "price change" note.

The mock (`electricity-billing-mock.ts:795`) behaves the same, so the UI specs cannot see it.

**Fix.**
- Send the rename on its own whenever the name changed.
- Do not post a version when price, mode and date equal the version in force. The server can also answer `nothing_changed`.
- Make the rename and the version change one request (today the PATCH happens before a version POST that can still fail with 409).

### CU2-09 (medium) - presence policy can lock everyone out

**The UI.** `save()` blocks only "no sensors chosen" (`system-presence.ts:226-231`). For "required sensor not allowed" (`api/presence.ts:193-200`) it shows a warning and saves anyway.

**The server.** `_normalize_required` (`presence.py:363-410`) never checks that `required.sensors` is a subset of `sensors_allowed`. `gate_for` (`:1221-1222`) then skips the disallowed key, so the sensor is always "missing" and the user is `blocked`.

**Scenario.** The policy requires location + bluetooth. The admin unticks bluetooth under "חיישנים מאושרים" and saves. From then on every in-scope non-admin gets 403 `presence_required` on every app request, and on the web too with `apply_to_web`. Only an admin fix or break-glass restores access.

**Fix.** The server refuses with 422 (or adds the sensor to the allowed list) while the policy is enabled. The UI disables Save for this problem.

### CU2-10 (medium) - presence settings commit half a change

**The mechanism.**
- `update_settings` (`presence.py:562-650`) validates the fields one at a time, between `set_setting` writes. Only places and value checks are validated before the first write.
- An `ApiError` still COMMITs (`db.py:1096-1098`, confirmed).
- The audit row is written only on success (`routers/presence.py:411-413`).

**Scenario.** The notice textarea has no `maxlength` (`system-presence.ts:337`). An admin pastes a notice longer than 8,000 characters and turns sharing on:
- `presence.enabled = true` and `retention_days` are committed;
- `notice_text` then fails with 422, so the notice version is not bumped;
- no audit row is written.

The UI shows an error, but sharing is ON under the old notice. A bad `mode`, `sensors_allowed`, `wifi_match_mode` or `required_sensors` after `enabled` does the same.

**Fix.** Validate everything, then write (or roll back explicitly). Add `maxlength=8000`.

**Test.** A bad later field leaves `enabled` unchanged.

### CU2-11 (medium) - one 404 kills a notice TV

**The code.** `onPoll` sets `gone: true` on any 404 (`tv-logic.ts:506-509`), and `poll()` returns at once while `net.gone` (`main.ts:1441`). `pollLoop` keeps spinning without a request. The server answers 404 for a board that is switched off or a notices module that is off.

**Scenario.** An administrator turns a board or the module off for two minutes. Every TV in the building shows the "gone" screen until someone reloads each one by hand. These are screens meant to run for weeks.

`unit-notice-tv-logic.spec.ts:78-85` pins "gone on 404" on the pure function and cannot see the dead loop.

**Fix.** While gone, keep probing slowly (for example every 10 minutes, under the 20-misses-per-10-minutes limiter), and recover on a 200.

### CU2-12 (low) - a sync in flight overwrites a pause

**The code.** `run_connection` reads the connection row at the start, releases the lock for the provider calls, and in the finish transaction calls `_ok`, which sets `state = 'ok'` unconditionally (`engine.py:97-100`, `:232-240`), or `_failed`, which sets `error` / `needs_reauth` (`:103-113`).

**Scenarios.**
- The owner presses "pause" (`routers/calendar_sync.py:312-322`) while a scheduled sync is waiting on the provider. The pause is overwritten with `ok` and syncing continues.
- An owner who has just re-authorised can get `needs_reauth` back from a run that started with the old token.

**Plausible extra.** The lease is 10 minutes (`:41`, `:77-81`), but a run can be longer: up to 40-60 pages per binding and one push per changed entry, each with a 15 s timeout. When the lease expires, a second runner (the scheduler or a manual sync) takes it over, and both can push the same new entry (two copies at the provider).

**Fix.**
- Make the finish UPDATEs conditional (`WHERE state IN ('ok','error')`, or `WHERE revision = ?`).
- Renew the lease between steps, or give the run an overall deadline below the lease.

### CU2-13 (low) - credentials outlive a disconnect

**The path.** `access_token` stores a rotated refresh token (Microsoft rotates on every refresh) through `RUNTIME.store_refresh`, an unconditional upsert in its own `write_aside` (`credentials.py:148-152`, `oauth.py:366-368`).

**Scenario.** A sync refreshes the token while the owner removes the connection (`clear_all`) or changes its client id (`clear_secret`). The rotated token is written back after the clear.
- On removal, a live sealed Microsoft refresh token stays in `settings` (and in backups) for a connection that no longer exists.
- On a client change, the connection reads "authorized" with a token of the old client.

(`_connected`, `routers/calendar_sync.py:240-247`, is safe here: `write_aside` rolls back on an `ApiError`, so a 404 after a removal leaves nothing behind.)

**Fix.** Store a rotated or new token only if the connection row still exists and its client / authorisation generation is unchanged (one write with a guard). Purge `calendar.conn.<id>.*` keys that have no connection row.

### CU2-14 (low) - HACCP "OK" without coverage

**The code.** The daily verdict is `none` only for zero samples. Otherwise it is `ok` when there are no out-of-band minutes and no alarms (`temperature_report.py:106-109`). Offline periods are warnings and are not counted.

**Scenario.** A sensor offline for 23 h with one in-band sample prints "תקין" on the compliance PDF. Only the coverage column (about 1%) tells.

**Fix.** Below a coverage threshold (a setting, for example 90%), print `none` or a new "partial" verdict.

### CU2-15 (low) - E19 and E18 fail open

**E19.** For an unread recorder clock, `health_report.py:545-546` returns status `ok` with the note "unread". `engine.py:522-528` maps `ok` to green, "the recorder clock is fine".

**E18.** It counts only `cameras WHERE enabled = 1` (`engine.py:504-510`). A camera marked as an emergency camera and then disabled or deleted disappears, so E18 can be green.

**Fix.**
- Treat unread as unknown in E19.
- Count a marked camera that is disabled or missing as offline.

### CU2-16 (low) - E01 ledger age from the time of recording

**The code.** `engine.py:97` reads `MAX(maint_tasks.last_done_at)`. `maintenance/service.py:534` sets that to now, even for a backdated `performed_on`.

**Scenario.** A generator test from three months ago, recorded today, reads 0 days old (amber, not red).

**Fix.** Use `MAX(performed_on)` of the done records of the generator tasks.

### CU2-17 (low) - emergency janitor and the write lock

**The code.** The janitor tick (`emergency/service.py:378-381`) opens `db.connection()` (BEGIN IMMEDIATE) every 30 s, even when the module is off. When the module is on, it runs `compute()` under the lock. That includes `e16` → `backup.list_backups`, which opens every backup zip's manifest (`backup.py:618-621`) while holding the installation-wide write lock.

**Fix.** Do the module check and `compute()` on a read connection, throttle the tick (for example every 5 minutes), and write only when a row changes.

### CU2-18 (low, PLAUSIBLE) - no per-unit isolation

**The code.** The temperature `evaluate` loop (`temperature_runtime.py:295-469`) runs inside one transaction (`tick`, `:552-558`). An exception for one unit rolls back the samples, events and notifications of all units, every minute. It is logged only as a warning. `maintenance/reminders.py:130-157` has the same shape.

**Status.** No concrete raising input was found (the inputs are validated defensively), hence PLAUSIBLE.

**Fix.** A SAVEPOINT plus `try` per unit / per reminder, with a failure count in the result.

### CU2-19 (low) - insights delivery: duplicate send, retried "may have left"

**The code.** Rows are selected, sent outside any transaction, and `_finish`ed afterwards (`insights_delivery.py:476-492`).

**Two failure paths.**
- A restart between `smtp_send` / the WhatsApp send and `_finish` leaves the row queued, so it is sent again.
- An exception after the WhatsApp message left (inside `_send_whatsapp`, for example from `svc.note_result` or `gate.record`) lands in `_retry_or_fail` (`:492`) and is retried. That contradicts the module's own rule at `:380` ("may have left: never retried").

**Fix.**
- Mark the row `sending` in its own transaction before the send. At start-up, a `sending` row becomes failed / unknown and is never resent.
- Catch post-send errors as `unknown`.

### CU2-20 (low) - insights attempts burned on transient states

**The code.** `channel_down` and `rate_limited` count as attempts (`insights_delivery.py:359-365`, `:383-390`). Four attempts are spaced 5, 10 and 15 minutes apart.

**Scenario.** About 30 minutes of WhatsApp downtime, or account pacing during an alert storm, fails the monthly report for good.

**Fix.** Hold, with a `not_before`, without counting an attempt; or back off longer.

### CU2-21 (low) - maintenance files

**The code.**
- `delete_task` (`maintenance/service.py:461-477`) never marks or removes the task's `maint_files`. The certificates and policies stay on disk, unreachable (`file_get` needs a visible task).
- `routers/maintenance.py:191-192` removes a file's bytes before the request transaction commits. If the commit fails, the row stays and the file is a 404.

**Fix.** On a task delete, mark its files deleted. Remove bytes only after the commit.

### CU2-22 (low, PLAUSIBLE) - unbounded HACCP report

**Scenario.** `devices.read` is enough to ask `report_preview` / `report.pdf` for 30 units over a 400-day custom range with `layout = haccp`. That is about 12,000 `stats` calls (several queries each) plus the sample rows, in one GET (`temperature_report.daily`, `:94-111`).

**Fix.** Cap units × days for `haccp` (for example 3,000 unit-days), or precompute daily rollups.

### CU2-23 (low) - water customer contact fields leak to `water.manage`

**The code.** `create_customer` and `patch_customer` call `wb.customer_dict(conn, ..., True, ...)` (`routers/water_billing.py:188`, `:206`). `True` means contact fields included. The module rule (and `get_customer`, `:193-194`) is "contact fields: `water.bills` only".

**Scenario.** A custom role with `water.manage` but not `water.bills` sends `PATCH` with only `base_revision`. Nothing changes, but the reply carries address, phone, e-mail, tax id and notes. Built-in roles are not affected.

**Fix.** `contact = _has(conn, principal, BILLS)` in both routes.

### CU2-24 (low) - water tariff version correction guards

**The code.** `update_version` (`water_billing.py:298-310`, route `:266-276`) refuses only a version that appears in a sealed snapshot. Two guards electricity has are missing:
- No sealed-span check: electricity's `plan_version_change` falls back to `later_only`. In water, an unsealed V2 starting 01.06 can be moved to 01.02, inside periods already sealed under V1. Sealed bills do not change, but their later corrections are silently repriced.
- No `base` / revision check: of two admins editing the same version, the last write wins.

**Fix.** Mirror `plan_version_change`, and accept a revision in `VersionIn`.

### CU2-25 (low) - abnormal-consumption baseline uses partial days

**The code.** `water_runtime.py:274` accepts a baseline day with any covered second (`r[1] > 0`).

**Scenario.** Two of the last four Tuesdays had the sampler or the meter down for 20 h. The median drops, and a normal Tuesday raises a false "abnormal" warning. The meter's first, partial day does the same.

**Fix.** Require `covered_s >= 0.9 * day_s` for baseline days.

### CU2-26 (low) - water sampler dead after OFF then ON

**The code.** `shutdown()` sets `stop_evt` (`water_sampler.py:100-112`). If ON arrives while the thread is still inside a tick, `start()` sees it running and returns True without clearing the event (`:127-128`). The thread then exits after the tick.

**Effect.** No sampling until the next restart, while the reply said `sampler_running: true`.

**Fix.** Join the old thread, or clear the event / use a generation token in `start()`.

### CU2-27 (low) - water storage hygiene (three items)

**(a) Retention vs bills (PLAUSIBLE).** `water_sampler.py:157` prunes without `keep_intervals` (electricity passes `_draft_keeps`). Daily totals follow `water.daily_retention_years` (1-15), while bills follow `energy.bill_retention_years`. With 1 year vs 7, correcting a two-year-old water bill recomputes from pruned data and gives about 0 m³.

**(b) Alert log.** `water_alert_events` has no retention. `list_events?state=all` (`routers/water.py:746`, `water_meters_store.py:48-61`) loads every row with joins, filters in Python and then slices.

**(c) Tariff list.** `tariff_dict` → `_sealed_version_ids` (`water_billing.py:248-270`) parses every numbered bill's snapshot once per tariff: 20 tariffs × 2,000 bills is 40,000 JSON parses per GET.

**Fixes.**
- (a) Keep the intervals of open drafts, and refuse a correction whose period is older than the kept data.
- (b) Add retention, plus a SQL LIMIT with a keyset.
- (c) Compute the sealed set once per request, or use `json_each` in SQL.

### CU2-28 (low) - small money / unit UI issues

**(a) Comma as a decimal point.** `typed_ml("1,500", "L")` gives 1.5 L (`water_meters.py:156`), but in Israeli usage the comma separates thousands. Fix: reject `\d{1,3},\d{3}`, or show the parsed value in the dry run.

**(b) A scheduled VAT rate is hidden.** The VAT card (`elec-settings.ts:231`, `:250`) shows the server's current rate and lists `vh.slice(1)`. A scheduled future rate (newest first) therefore appears nowhere, and the current rate is listed as "until X". The client also has no way to delete a wrong VAT rate.

**(c) Logo upload discards edits.** Uploading or removing the business logo calls `apply(getSettings())` (`:378`, `:386`), which discards unsaved business fields and payment terms.

**(d) Rounded estimate.** `account_status.amount_so_far` (`water_billing.py:687`) multiplies by an already rounded unit price at today's VAT, so it differs from the bill. Fix: label it an estimate, or use the bill's line rounding.

### CU2-29 (low) - transit: unknown stop becomes "no buses"

**The code.** Stop ids come from Stride's snapshot for the local day. An empty answer raises `UnknownStop` (`provider.py:54-59`). The poller then stores an empty cache with `fetched_at = now` (`poller.py:197-199`), and the digest shows a fresh "no buses in the next N min" with `HEALTH.ok`.

**When.** Typically just after local midnight, before Stride loads the day's GTFS snapshot. Related: a window that crosses midnight queries with yesterday's ids.

**Fix.** When every code is unknown, keep the last rows or mark `source_down`. Optionally fall back to the previous day's ids.

### CU2-30 (low) - calendar settings lost update and stepper issues

**Lost update.** The calendar settings PUT replaces the whole document, and missing keys become defaults (`routers/calendar.py:116-134`, `services/calendar/model.py:279`). `routers/calendar_attendees.py:294-303` works the same way. The screen sends everything it loaded (`system-calendars.ts:464-477`). Admin A's save therefore reverts admin B's earlier change; the same happens across two tabs.

**Stepper issues.**
- The stepper writes the new value into local state before saving (`:354-359`, `:481-486`), so `before` already holds it. A failed save keeps showing the unsaved number.
- One `attTimer` serves both steppers: changing one and then the other within 500 ms cancels the first save.
- PLAUSIBLE: `pickPolicyCal` does not clear the timer, so a pending `max_attendees` change can be written to the newly picked calendar.

**Fix.**
- Add `base_revision`, as the notify and billing settings already do (or send only the changed keys).
- Capture the calendar id and `before` at change time.
- Use one timer per key, and clear it on calendar switch.

### CU2-31 (low) - catalogue refresh progress

**The code.** `system-transit.ts:171-176` sets `this.s = r.catalogue` before comparing `r.catalogue.ok_at !== this.s?.catalogue.ok_at`. The comparison is always false.

**Effect.** With an existing catalogue, or an old error, the spinner stops on the first tick while the roughly 6 MB download is still running.

**Fix.** Capture `ok_at` before polling starts.

### CU2-32 (low, PLAUSIBLE) - TV fetch timeouts; transit provider thread-safety

**TV fetches.** `poll()` (`main.ts:1437-1499`) awaits the feed, the logo, the media and the transit fetches, all without a timeout. `pollLoop` (`:1520-1523`) re-arms only after `poll()` settles, so one half-open connection freezes all updates until the socket gives up.

**Transit provider.** `check_once` (request threadpool) and the poller thread share one `RealtimeProvider` (`poller.py:161-169`, `:242-246`). Its `_ids`, `PlanStore` and `_budget` are mutated without a lock. A race shows up as `HEALTH.fail` and a backoff. It is rare: one manual check per 30 s at most.

**Fix.** Use `AbortSignal.timeout(15000)` on every TV fetch, and load media outside the critical path. Add a lock per pass, or give `check_once` its own provider.

### CU2-33 (low) - tests that cannot fail for their stated reason

- `tests/test_insight215_slice3.py:297`: `dl.due(conn, ts(2026,10,1,4,0)) is None` holds because `enabled_at` is the wall clock (later than the asked time), never because 04:00 is before the send hour, which is what the comment claims. Fix: set `enabled_at` earlier with the existing `_fake_enabled_at`, then assert None at 07:00 and a month at 09:00.
- `tests/test_emergency_readiness_295.py:191`: `admin["verdict"] in (...)` lists every verdict, so it cannot fail. The parity assertion next to it is real.
- `tests/test_water_alerts_s2.py::test_catalogue_rule_and_subject_registered_and_no_device_action` greps the source for the words "valve" / "call_service" instead of testing behaviour.
- Missing tests for the medium findings above:
  - CU2-01 needs a provider fake with a listing window;
  - CU2-02 needs a fake that expands series;
  - CU2-04, CU2-05, CU2-06, CU2-07, CU2-09 and CU2-10 have none.

## 3. Tests run (runner, slot B, v2.56.0 worktree, one pytest process per file)

**Backend: 59 files, 1,632 tests passed, 0 failed.** Every file exited 0. Job: `p2570r_cu_be.sh`, with `SW_WIRE_STRICT=1`. Files by group:

| Group | Files |
|---|---|
| Alarm | `test_alarm`, `test_alarm_managed_cache` |
| Transit | `test_busstatus_297`, `_persist`, `test_bustimes_295`, `test_bustimes_rt_295`, `test_transit_check_wp8`, `test_transit_realtime` |
| Calendars | `test_calendar_attendees_2343`, `test_calendar_connect_2330`, `test_calendar_sync_2300` |
| Water | `test_data_rules_water_2540`, `test_data_rules_2_water_2550`, `test_water_alerts_s2`, `test_water_billing_s3`, `test_water_meters_s1` |
| Elevators | `test_elevator_alert_recipients_295`, `test_infra_elevators`, `_280`, `_travel` |
| Emergency / readiness | `test_emergency_readiness_295`, `test_readiness_96` |
| Energy | `test_energy_api`, `_billing_api`, `_billing_engine`, `_counter`, `_manual_readings`, `_store`, `test_tariff_names_en_2440` |
| Temperature | `test_infra_temperature`, `_phase3`, `_report`, `test_temperature_explain_char_2450`, `test_temperature_registry_295`, `test_tempexplain_093`, `test_templink_2320`, `test_templink_295`, `test_temprep_295`, `test_tempreport_2310_security`, `test_tempreport_297`, `test_tempvendor_295`, `test_wire_temperature_2450`, `test_pdf_child_2440` |
| Insights | `test_insight215_doors`, `_report`, `_slice3`, `_waste` |
| Maintenance | `test_maintenance_215`, `_215b` |
| Notices | `test_notice_boardv2_297` |
| WhatsApp | `test_notify_whatsapp`, `test_wa_pacing`, `test_wa_pacing_coverage_295`, `test_wa_policy_295` |
| Presence | `test_presence`, `test_presence_contract_v22`, `test_whoin034_295` |
| Other | `test_quiet103`, `test_secrets_transitional_263` |

**Frontend: 37 node-only unit specs, 352 tests passed, 0 failed.** Run with `playwright.unit.config.ts --workers=2`. Specs by group:

| Group | Specs |
|---|---|
| Transit | `unit-busstatus-297`, `unit-bustimes-295` |
| Calendars | `unit-calendars-attendees-2343` |
| Electricity | `unit-electricity-billing`, `-customer-form`, `-readings`, `unit-i18n-cal-elec-*`, `unit-logexport-tariff-en-2440` |
| Elevators | `unit-elevator-*`, `unit-elevators` |
| Emergency | `unit-emergency`, `unit-door-emergency-roles-emrole-295` |
| Insights | `unit-insights` |
| Maintenance | `unit-maintenance` |
| Notice TV | `unit-notice*`, `unit-skin*`, `unit-tv*` |
| Presence | `unit-presence-*`, `unit-whoin034-295` |
| Settings / controls | `unit-settings-rows-2380`, `unit-chip-selected-2439`, `unit-multi-select`, `unit-part-select` |
| Temperature | `unit-temperature`, `unit-temperature-phase3` |
| Water | `unit-water-*` |

**Confirmation test** (not committed): `test_p2570r_cu_confirm.py`, 1 test, PASS. A PASS means the bug is reproduced (CU2-01). The test uses a FakeAdapter whose full listing applies the 30-day horizon:
- a two-way room binding with one Arx booking and one imported entry;
- the clock moves seven weeks on, and the token is invalidated;
- the next sync reports `resync = 1`, `cancelled = 2`;
- both entries are `cancelled` in Arx, with two `calendar.sync.cancel` audit rows.

**NOT_RUN:**
- the browser-level specs (`evidence-*`, `notice-tv-*`), which need the preview server and a gate slot;
- `test_presence_compact_2310`, `test_presence_count_2400`, `test_presence_history_2280` (not matched by the job's pattern);
- `test_door_emergency*` (owned by another area);
- every confirmation test except CU2-01. Each of the other findings has a suggested test in section 2.

**Assertion strength:**
- Sampled, strong: `test_calendar_sync_2300`, `test_infra_temperature`, `test_maintenance_215b`, `test_water_billing_s3` (exact money values), `test_transit_check_wp8`.
- Weak ones: listed in CU2-33.
- The green run does not cover CU2-01 / CU2-02. The calendar contract tests cannot see them, because the fake provider has no listing window and no series expansion.

## 4. Checked and fine

**Calendar OAuth** (`oauth.py`, read in full):
- Fixed endpoints only.
- Google: code + PKCE S256 with a loopback redirect. The paste is accepted only for the exact `http://127.0.0.1:8749/` prefix. The single-use `state` is bound to the connection and the user who started it, compared in constant time, and never consumed by a stranger's paste.
- Microsoft device grant: the verification URL is allow-listed; `slow_down` / 429 back off; the interval and expiry are clamped.
- Granted scopes are checked against the requested set (a partial consent is refused). Least scopes; no mail / contacts.
- The refresh token is sealed at once with per-connection / per-field associated data. Access tokens are kept in memory only, with expiry.
- `invalid_grant` → `needs_reauth`. No redirects followed. 15 s timeouts. Bodies capped at 64 KB / 4 MB. No token, body or code in an error or the audit.

**Calendar routes:**
- Owner-or-admin on client / feed / authorize / complete / poll / cancel / pause / resume / sync / remove.
- The lock is released before every provider call.
- Password-like keys are refused in the add body.
- A changed client id drops the authorisation.
- Manual sync is rate-limited.
- Every write is audited with ids only.

**Calendar engine** (read in full; findings above):
- Echo suppression by etag.
- The 410 path is bounded (a second 410 → `resync_failed`).
- The pull is applied only for bindings that still exist.
- Push results are recorded only for live events.
- Outbound detail levels never include guests.
- `rest.call`: one forced refresh on 401, then `auth_expired`; rate-limit / quota / 5xx mapping; `same_host` for Graph links.

**WhatsApp notification channel** (`notify_whatsapp.py` 600-900, `tickets/channel_whatsapp.py` outcome classification):
- `still_wanted` re-reads the switch, policy, state, visibility, number, consent, snooze, quiet hours and quiet windows before every attempt.
- `may_have_left` is recorded in the ledger and never retried. `UNKNOWN` is never retried.
- The orphan sweep is conditional; dedupe and the per-user cap count possibly-sent rows.
- The budget share is kept apart from tickets.
- Connect errors count as `not_sent`, transfer errors as `unknown`.
- No number or text in logs.

**Alarm** (`routers/alarm.py` 225-690):
- The permission check comes before the body.
- Panel / zone scope with the audited 403. A zone on several panels needs bypass on all of them.
- Remote blocks. Explicit confirmation for disarm and bypass. Step-up before any code is judged.
- The lockout counts against the user (PIN) or user + panel (panel / typed code). Only one unsettled typed attempt, with forgiveness only before the panel is reached.
- Idempotency by `client_request_id`. The code is never stored or audited.
- An unpaired bridge fails honestly. The bridge error text is scrubbed.

**Elevators** (`elevators.py` derive / `live_of`, `elevators_runtime.evaluate`):
- Read-only (no device action).
- One sensor per fixed role (the primary key, position 0).
- Dead / unavailable values are unknown. Holds are cleared on disconnect. A dead sensor's notification is closed with a stated reason.
- Notifications are never retroactive, and a refused emit leaves no memory row.

**Sub-reviewers' lists, kept as reported:**
- **Temperature PDF:** `html.escape` everywhere; the child process has a minimal env, its own process group, a timeout with group kill and rlimits, and uses no temp files; the routes are sync (threadpool).
- **Temperature runtime:** unknown readings hold events; defrost suppression only below the hard max; escalation deduped per level; DST-safe HACCP day edges.
- **Insights:** switch- and permission-gated, section gating per recipient, idempotent planning in local time.
- **Emergency engine:** read-only, `_safe` → unknown.
- **Maintenance files:** size cap, PDF check / re-encode, random confined names, attachment + CSP sandbox + nosniff.
- **Water:** Decimal money with per-line rounding; unit conversions exact; night window across midnight / DST; floor-scoped `Reach` on every read; CSV formula guard.
- **Energy meters:** create / update / retire / replace guards.
- **Electricity VAT and settings:** revisions passed, honest 422s.
- **Quiet windows:** changed keys only, confirmation, per-key audit.
- **Presence places:** all-or-nothing writes for places, hashed SSIDs.
- **Transit:** fixed host (no SSRF), 10 s timeout, 8 MB cap, Retry-After, breaker backoff, bounded LRU caches, server-side local times.
- **Notice TV:** token in the URL fragment and sent as a header; escaping in the sampled builders; blob URLs revoked; timers cleared.

## 5. Still not covered (honest)

**Calendar sync:**
- `ics.py` (sampled in 2.56).
- `microsoft.py` to_body / recurrence mapping beyond the pull / push entry points.
- `calendar_sync_store.py` (only `remove_connection`'s call shape).

**WhatsApp:**
- `notify_whatsapp.py` 1-600 (config, resolver, consent / opt-in hashing, number-change sweep, render) was read only by its function list.
- `wa_pacing.py`, `wa_policy.py`, `wa_template_*`, `messaging_accounts` internals, `ma_direct.py`: not read.

**Alarm:**
- `services/alarm.py`, `alarm_codes.py` (lockout internals, PIN hashing), the user policy / PIN admin routes (`routers/alarm.py` 690-984): not read.
- The alarm frontend screens: not read.

**Elevators:** the router's write paths and the elevator frontend screens; sampled only.

**Temperature:** `temperature_whatsapp`, `temperature_tickets`, `temperature_insights` (beyond health), `temperature.stats` / series internals.

**Insights:** `insights_doors`, `insights_waste`, `building_report*`.

**Maintenance:** `service.py` 1-230 skimmed; `model.py` (due dates, advance, occurrences) not read.

**Other backend:**
- `services/readiness.py` (the READY96 score) not read.
- `bill_pdf_engine` parent side only.

**Electricity UI:** the TOU editor and elec-ui not read. The water frontend screens were not read.

**Notice TV** (about 4.9k lines + CSS):
- `main.ts` was read at 1-140, 200-260, 660-690, 900-935, 1005-1030 and 1140-1528;
- `skin-board.ts`, `hx-engine.ts` and `v2-transit.ts` were grep-sampled;
- `heb-date.ts`, `tv-fit.ts` and `skin-logic.ts` were not read.

**Transit:** `catalogue.py`, `health.py`, `transit_realtime/delay.py`, `mot_siri.py` and `model.py` beyond grep hits.

**Not done at all:**
- Backdated meter replacement into billed periods: not guarded in either module; not analysed further.
- The provider-side behaviour that CU2-02 relies on was not tested against a real provider. No network calls were allowed.
