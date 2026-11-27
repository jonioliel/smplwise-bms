# DEEP-REVIEW-2560 - COMMS-UTILITIES (id prefix `CU`)

Final deep review 2.55 / 2.56, area 6 of `docs/review/FINAL-REVIEW-PLAN-2560.md` (branch `origin/chore/FINAL-REVIEW-PREP-2560`).

- Reviewed head: `origin/release/2560-train` at `3739e3ded` (read-only detached worktree).
- New-code range: `v2.52.0..3739e3ded`, restricted to the area's paths (52 files, +1,603 / -241 in backend services/routers and
  the module frontends), plus the UnifiedPush path (`services/unifiedpush.py`, `services/mobile_push.py`) the coordinator added.
- Method: every changed hunk in the area read end to end, with the callers it relies on. No test was run (a 2.56 release gate was
  running; PC read-only). Every finding below is CONFIRMED by reading unless marked PLAUSIBLE. Line numbers are at `3739e3ded`;
  `B` = `smplwise_vms/backend/smplwise`.

## 1. Summary

| Id | Severity | Title | file:line |
|---|---|---|---|
| CU-01 | low | A mute still swallows event-type generator alerts (D-03's "a mute delays, never swallows" holds only for state alerts) | `B/services/generator_alerts.py:351-376` |
| CU-02 | low | The late notification after a mute fires also for an alert an operator already acknowledged | `B/services/generator_alerts.py:379-393`, `:481-482` |
| CU-03 | low | The 24 V battery latch cannot be cleared by "automatic" and is set from stale history of an earlier (wrong) sensor mapping: a 12 V bank gets a permanent false "battery low" | `B/services/generator_core.py:109-124`, `B/services/generator_alerts.py:489-502` |
| CU-04 | low | D-04 conflict check past the cache fails open when the on-the-fly expansion of a daily series exceeds 2,000 occurrences | `B/services/calendar/occ.py:180`, `:201` |

Counts: critical 0, high 0, medium 0, low 4.

Old findings of this area (plan section 1): 19 re-verified - FIXED 17, PARTIAL 2 (SCR-22, D-11), STILL OPEN 0 (table in section 3).

## 2. Findings

### CU-01 (low) - a mute still swallows event-type generator alerts

`_raise` (`generator_alerts.py:351`) for an event type (`t.event`: `mains_restored`, `ats_to_gen`, `generator_started`, `test_done`,
`test_failed`) inserts the row already closed (`cleared_at = now`) and emits only `if not muted` (`:372`). The D-03 fix
(`_tell_late`, `:379`) tells late only OPEN rows without a notification (`evaluate`, `:481`), so an event raised during a mute is never
told. The module docstring of `mute()` (`:601`) and the DATA-RULES-2540 note promise "a mute only delays".

Scenario: an operator mutes `test_failed` on a generator for 24 h (it is `alert` severity, so `generator.view` suffices, up to 7 days);
the weekly test run fails during that time; the row exists in the history, but nobody is notified, ever. If a site's policy raised
`test_failed` to critical, a `generator.manage` holder's 4 h mute swallows it the same way.

Fix: for event types either (a) ignore the mute when the event's effective severity is `alert` or higher, or (b) store events raised
while muted with `notification_id = NULL` and let a variant of `_tell_late` pick up closed event rows raised in the last mute window
(once). Add a test: mute `test_failed`, raise it, end the mute, expect one notification.

### CU-02 (low) - the late notification ignores the acknowledgement

`_tell_late` (`:379-393`) checks only the in-process `_TOLD_LATE` set and `_muted`; it does not look at `acked_at`. Scenario: a
critical alert is raised during a 4 h mute; the operator on duty opens it on the generator screen and acknowledges it with a note; when
the mute ends, every recipient gets the push / WhatsApp / e-mail for an alert already handled. After a restart, an open alert that
the notification centre refused earlier (policy off) is also tried once more (the set is per process) - by design, but worth a line in
the docstring.

Fix: skip (or send at `info` with a "handled by" line) when `row["acked_at"]` is set; `SELECT *` already carries the column.

### CU-03 (low) - the 24 V latch is one-way and learns from stale history

`set_battery_nominal(None)` (`generator_core.py:117-124`) keeps `seen_24`, so choosing "automatic" again never clears the latch.
`_battery_seen_24` (`generator_alerts.py:489-502`) latches also from `battery_history_max`, which reads `generator_samples` /
`generator_samples_5m` by `device_id` and role only - including samples of an entity that was mapped to `battery_v` earlier and
replaced (a mis-mapped alternator / DC bus / scaled sensor reading above 16 V).

Scenario: during installation `battery_v` was mapped to a 27 V DC bus, then corrected to the real 12 V battery sensor. On the first pass
after this release the history max (27) latches the bank as 24 V; `_j_battery` then judges 13.2 V against `battery_min_24v` (23.2) and
`battery_low` stays raised permanently. The settings screen shows "automatic (detected 24 V)" and the administrator can pick 12 V
explicitly, so it is fail-loud and recoverable, but "automatic" never recovers.

Fix: clear `seen_24` when the administrator saves "automatic" (or offer "detect again"), and clear it (and skip history before the
change) when the `battery_v` role mapping changes; optionally require the above-split reading to hold for a few minutes before
latching.

### CU-04 (low) - D-04's on-the-fly expansion fails open on `series_too_large`

`_series_beyond_cache` (`occ.py:158-185`) expands every open series of the holder over `[lo, hi]` of the far spans and `continue`s on
`RuleError` (`:180`); `spans_past_window` (`:188-203`) returns `[]` on `RuleError` (`:201`). `expand` raises `series_too_large` when
more than `MAX_OCCURRENCES` (2,000) occurrences fall inside the window (`recurrence.py:161-195`). The cache never meets that limit
(its window is the 400-day horizon), but these two new windows can be wider: `spans_past_window` expands the new series up to the
farthest cached single entry on the holder, and `_series_beyond_cache` then expands existing series over that span. The comment at
`:180` ("cached by nobody either") does not hold for this error.

Scenario: a room holds one confirmed single booking about six years ahead (cached in full). Someone books a new open daily series in
that room: `spans_past_window` needs about 2,190 dates past the window, raises, returns `[]`, and the series' dates near that far
booking are never checked - the double booking is created. The nightly `report_collisions` would report it only when the roll reaches
that date (years later). Rare in practice; the check should still fail closed.

Fix: pass a larger `max_occ` for these conflict expansions (they only need the spans' window), or clip the expansion to the far spans
themselves (expand per span, not over `[min, max]`), and on `RuleError` refuse the booking (`422 series_check_failed`) instead of
skipping the check.

## 3. Re-verification of old findings (area 6)

| Old id | Status at `3739e3ded` | Evidence |
|---|---|---|
| D-01 | FIXED | `bill_ledger.guard_cycle_change` (`B/services/bill_ledger.py:347`), called in `energy_billing.update_account` and `water_billing.update_account` inside the write transaction; `billing_gaps` (`:501`) shown on both account screens (`frontend/src/electricity/elec-account-page.ts:164`, `frontend/src/screens/water/page-accounts.ts:401`). `as_api` gives the inclusive last day, so the warning's dates are right. |
| D-02 | FIXED | `generator_core.battery_system` / `battery_known` (`B/services/generator_core.py:77-107`), `_j_battery` uses it; latch persisted under `BATTERY_KEY` in the same write transaction. See CU-03 for the one-way latch. |
| D-03 | FIXED (with CU-01, CU-02) | `mute` requires `generator.manage` for a critical type (`is_critical`, `:593`; `require`), caps at `MUTE_CRITICAL_MAX_H` = 4 h, audits requested / applied hours; `unmute` route; `_tell_late` tells open alerts after the mute. |
| D-04 | FIXED (with CU-04) | `occ.blockers` + `_series_beyond_cache` + `spans_past_window`; `events.evaluate` passes `now`; nightly `jobs.report_collisions`. |
| D-05 | FIXED | `bill_ledger.retention` keeps `origin = 'auto'` drafts until the retention years; manual drafts' `skipped` runs are reopened (`reopen_runs`, `:490`) in the same transaction; water drafts announced (`energy_notify.water_draft_ready`, subject kind `water_bills`, visibility in `notify_visibility`). |
| D-06 | FIXED | `energy_billing._water_vat_used` in `delete_vat`. |
| D-07 | FIXED | `energy_billing._has_numbered_water_bills` in `update_customer`. |
| D-08 | FIXED | `bill_ledger.failure_retry` (`:441`), audit only on a new / changed error. |
| D-09 | FIXED | `generator_alerts.evaluate` closes open alerts of removed generators (`_clear_any`) and of types whose role was unmapped. Roles come from `generator_roles` (LEFT JOIN), so a mirror drop-out never closes them. |
| D-10 | FIXED | `notices/sources.py` backs off one TTL also for a feed that never succeeded. |
| D-11 | PARTIAL (unchanged) | Site-wide warning + home bill gate (HOME-PERMS-WARN-2550); still no per-person / per-building billing scope. |
| SCR-03 | FIXED | (2.52) resident cancel of one date; not regressed in `frontend/src/calendars/resident.ts`. |
| SCR-04 | FIXED | (2.52) home "my bookings" one-date delete. |
| SCR-20 | FIXED | `elec-format.fmtDate/fmtDateTime(iso, zone)`; bill log and end-of-period reading pass `s.period.timezone` (`elec-bill-page.ts:171,175`, `elec-bill-paper.ts:273`). |
| SCR-21 | FIXED | `gen-logic.batterySystem` mirrors the server rule; `gaugeList(..., d.battery_system_v)` (`gen-live-page.ts:193`). |
| SCR-22 | PARTIAL | "ack all" now behind a confirmation naming the count (`gen-alerts-page.ts` `ackAllNow`). "Mute 24 h" is still one click (`gen-alerts-page.ts:263`); its risk is lower now (critical needs manage, 4 h cap, alert told late, un-mute behind a confirmation), and refusals / shortened mutes are shown. Recommendation: accept as is, or add the same `confirmDialog` to mute. |
| SCR-34 | FIXED | `home-p2-api.ts:66`, `home-calendar.ts:245`. |
| SCR-35 | FIXED | `resident.ts:263` (newest day read wins). |
| SCR-36 | FIXED | `resident.ts:175` (failed read is its own error). |
| SCR-37 | FIXED | `calendars/model.ts` `atMinute`, `wallMinute`, `wallRange`, `minuteExists`, `wallInstant`; slot builders skip the missing spring hour. |
| SCR-38 | FIXED | `booking-logic.drawerDetail` + `event-drawer.ts` "only this date". |
| SCR-46 | FIXED | `notices/model.ts:220`, `system-notices.ts:155,212`. |
| SCR-53 | FIXED | `screens/water/page-settings.ts:150`, `temperature/whatsapp.ts:178`. |

## 4. Improvements (short)

- `generator_alerts._tell_late` / `_TOLD_LATE`: the "once per process" rule means every restart re-tries every open alert without a
  notification (also the ones a disabled policy refused). Store a `late_told_at` on the row instead of a process set.
- `bill_ledger.guard_cycle_change` hard-codes `('issued','sent','paid')`; use `kind.issued_states` like `billing_gaps` does.
- `mobile_push.register_unifiedpush` moves an endpoint from any other device row (any user) to the caller. Endpoints are secret
  capability URLs, so this is not exploitable without one, but limiting the steal to the same user's rows (or refusing with 409) is
  cheaper than reasoning about it.
- `temperature_report_link.revoke` handles only `recipient_kind = 'user'`; vendor (`contact`) links can only be revoked all at once.

## 5. Checked and fine / not covered

Checked and fine (read end to end at the head):
- Billing: `guard_cycle_change` (draft refusal, explicit-start mismatch, implicit start), `billing_gaps` (void excluded, drafts cover,
  inclusive `to` in the API), `reopen_runs` scope (skipped rows of live automatic accounts only), retention SQL for auto vs manual
  drafts, `failure_retry` precedence and attempt counting, D-06 / D-07 water checks.
- Generator: critical mute authority and cap, un-mute (view only, audited when a mute was running), `_clear_any` for removed devices /
  unknown keys, battery latch write in the same `BEGIN IMMEDIATE` as the read (no lost update with `set_battery_nominal`), router
  `battery_nominal_v` audit before / after; frontend mute refusal (403) and shortened-mute messages; ack-all confirmation.
- Calendars: `cache_edge` (no roll on record -> everything past now is expanded), dedupe of cached vs on-the-fly rows (`local_start`
  = `o.key`), `report_collisions` window and root grouping (ids and instants only in the audit row); frontend DST helpers.
- Notices / TV: `SeenRecorder` (lock, merge-back on failure, never-backwards UPDATE, shutdown flush after both feeds), LAN listener
  request deadline; D-10 back-off.
- Notifications: `(last_at, id)` cursor in `notify.list_for` and the router's 120-char `before`; `water.bill_draft` source and
  `water_bills` visibility; `push_approval_requested` source (content-free).
- UnifiedPush: host allow-list parsing (no IP literals, port rules), `allowed_endpoint` (https, no userinfo / fragment / brackets,
  re-checked at send time against the current list), no redirects followed, timeouts, 404 / 410 drop, config errors kept without a
  device failure, endpoint cleared on unregister / credential end; device test send runs in a sync route (threadpool).
- Never-read ground sampled: iCal feed fetch (`calendar_sync/ics.py`: pinned-IP https, every hop re-checked, size and time caps),
  e-mail header handling (`notify_email.header_safe`, masked addresses in logs), temperature report links (token hashed, per-user and
  daily mint limits, audit without content).

Not covered (honest list): Google / Microsoft calendar sync engine and OAuth (`calendar_sync/engine.py`, `oauth.py`, `google.py`,
`microsoft.py`), insights delivery, temperature runtime and PDF engines, water alerts / sampler / accounts / usage, the emergency
readiness engine, the maintenance service and files, the energy meters store, WhatsApp transport internals (`notify_whatsapp.py`,
`wa_*`), `system-calendars.ts`, `system-quiet-windows.ts`, `system-presence*.ts`, electricity price / VAT settings screens, the
`notice-tv/` frontend (1 MB), elevators, alarm (only the new step-up PIN hunk was read; it is area 1's), transit. No test was run;
the area's tests were only sampled by name (`test_data_rules_*_2540/2550`, `test_notice_tv_lastseen_2530`, `test_android_push_2550`).
