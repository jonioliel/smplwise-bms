# CONTROLLED-TOGGLES-2540 - the switches that save at once are controlled

Branch `pilot/CONTROLLED-TOGGLES-2540` from `origin/pilot/HONEST-STATES-2540` (df8285ae8). Target 2.54. Frontend only: no backend,
wire, migration or setting change; nothing was run against the lab, a device or Home Assistant.

## What and why

HONEST-STATES-2540 (deep review FC-01 / SCR-29) gave `sw-toggle` an opt-in `controlled` mode: a press only asks (`change` with
`detail.checked` = the asked value) and the switch moves when the screen sets `checked` from the saved answer. Its open question 2 was
answered by the owner's standing rule (unanswered = the recommendation): convert the remaining save-at-once switches, one row per screen
family with its own tests. This row does that.

The bug it closes: a plain `sw-toggle` flips itself on the press. Most save-at-once screens bind `.checked=${model}` and update the model
only on success. On a refusal the model does not change, lit sees the same value as last time and never writes it back, so the switch
stays on the state the server refused. The common "a refusal re-reads the screen" path (409 / error -> `load()`) has the same hole: the
re-read brings the same value back. With `controlled`, the switch never moves on its own.

Only the attribute is added (and `toggled(e)` where a handler read the switch's own `checked`). `sw-toggle.ts` / `toggle-value.ts` are
not touched. At rest every switch draws exactly as before; no pixel baseline moves (see Tests).

## The families (one commit each)

| Commit | Family | Switches made controlled |
|---|---|---|
| 33961f092 | schedules | `wk-schedule-exec` "status in WisKey"; `device-activity` a schedule's enable switch in the device sheet |
| 10e453529 | tickets settings | `settings-channel` (5), `settings-costs`, `settings-dept` (9), `settings-message-templates`, `settings-rules` master, `settings-visits`, `reports-settings`, `intake-settings` (2), `notify-matrix` (2), `handlers-members` (3), `staff-mine`, `system-tickets` (5) |
| 1f7691225 | module settings | `maintenance/settings` (4), `temp-settings` alert kind, `insights-settings` (2), `elevator-alerts` master, `frigate-auto-profile` consent (handler now `toggled(e)`), `investigate-rules` a rule's on / off, `devices-type-admin` bulk-on |
| 9e3a89b10 | system settings | `system-announcements` (9), `system-building-presence` (3), `system-calendars` a calendar's approval, `calendars/connect-dialogs` a feed's remote address, `system-cast` (5), `system-diagnostics` (3: local restore scope, safety backup, first-run guide), `system-fleet-report`, `system-local-users` passkey first, `system-multimedia` (2), `system-multimedia-players` (4), `media-admin-list` approved, `system-notices` (5), `notices/info-sources`, `system-transit` (3), `presence-opt-out` |
| 83d228f95 | security and integration cards | `sw-offbox-backup` (2), `sw-bridge-key-card`, `sw-partner-api-card`, `messaging-pacing-card`, `messaging-policy-card`, `wa-installed-card`, `media-ma-connection` |
| f82757f22 | (test only) | optional pictures of the refused state for the compare page |

### Left as they are, on purpose

- Already safe - they put the switch back themselves: `live()` bindings (`system-schedules`, `gen-routing`, `system-access`, `system-doors`,
  `system-door-blocks`, `wiskey-person-editor`), `switchPress` (`schedule-drawer`, `devices-schedules`, `sw-automation-card/row`,
  `security-alarm`, `system-notifications`, `system-mapping`, `privacy-masks`, `notify-whatsapp-section`, `incidents/settings-form`, ...),
  by hand (`sw-passkeys`, `nvr-writes-switch`, `frigate-control-settings`, `frigate-event-control`, `frigate-camera-control`,
  `system-security-cameras`), optimistic with a revert (`system-calendars` settings and attendees, the meter backup, the off-box restore
  scope, the personal home).
- Draft switches (edited, then saved with a button, or part of an editor / dialog): unchanged; the source guard counts only the save-at-once
  ones per file.
- Device controls (`sw-room-card`, `devices-controls`): they follow the device's live state, not a save; see the open question.
- Owned by other rows: `home/*`, `live-camera.ts`, `system-setup.ts`, `devices-bulk.ts`, `investigate-playback.ts`, `sw-toggle.ts`.

## Tests

- `frontend/tests/unit-controlled-toggles-2540.spec.ts` (new, Node only): a source guard - per family, the number of controlled switches per
  file. A later edit that drops the attribute fails here.
- `frontend/tests/evidence-controlled-toggles-2540.spec.ts` (new, mocked backends, desktop): per family, a refused save leaves the switch
  where it was; an accepted save moves it. WisKey "status in WisKey" (409); tickets "urgent is critical" (500, then accepted) and a
  department's "share the history" (409 with a re-read); maintenance reminders (500, then accepted); cast on (500 with a re-read, then
  accepted); the installed messaging client's paced send (500, then accepted).
- `frontend/tests/schedule-exec-mocks.ts`: a `refuseSwitch` knob (default off: the existing specs are unchanged).

### Results

All on the Linux runner (slot B), mocked backends only. Run 1 = `~/work/p2520_ctltog_run.sh` at f82757f22; run 2 =
`~/work/p2520_ctltog_run2.sh` at 8210b9616 (adds the notice boards case, repeats the two unclear regression cases at the base and the
branch, and runs the dev-server-only specs against the Vite dev server). The "before" runs build the base (df8285ae8) with the branch's
new spec files copied in.

| Check | Command | Exit | Result |
|---|---|---|---|
| source guard, base (before) | `playwright -c playwright.unit.config.ts tests/unit-controlled-toggles-2540.spec.ts` | 1 | 5 failed - every family (expected) |
| behaviour, base (before), run 1 | `evidence-controlled-toggles-2540.spec.ts --project=desktop` | 1 | 5 failed, 1 passed - each failure: the switch stayed on the refused value (`aria-checked` "true" where "false" was expected, or the reverse). The passing one is the cast case (see below) |
| build (tsc + vite) | `npm run build` | 0 | - |
| typecheck tests + scripts | `npm run typecheck` | 0 | - |
| lint | `npx eslint src --pass-on-unpruned-suppressions` | 0 | - |
| design ratchet | `python scripts/design_ratchet.py` | 0 | no count above the baseline |
| unit | unit-controlled-toggles-2540, unit-calendars-feed-remote-2351, unit-board-answers-2400, unit-onboarding-2530, unit-honest-states-2540 | 0 | 36 passed |
| unit (PC) | unit-controlled-toggles-2540 alone, after each family commit | 0 | 1 / 2 passed (schedules; + tickets) |
| unit pages | `SW_UNIT_PAGES=1 ... unit-device-types-admin-ui.spec.ts` | 0 | 2 passed |
| behaviour, branch, run 1 | `evidence-controlled-toggles-2540.spec.ts --project=desktop` | 0 | 6 passed |
| regression, desktop | 28 existing specs that press a converted switch (wiskey-schedule-exec-2530, tickets-s2, -s5b, -handlers, -s4, tickets, maintenance, insights, frigate-ui, rules, announcements, announceb-295, announce-297, presence-design-2300, presence-2280-layout, cast-ui, calendars-connect-2330, fleet-report, board-answers-2400, media-queue, media-admin-list, system-multimedia, media-screens, whoin034-295, bridge-key, offbox-backup-ui, wa-installed-2400, automations-list) | 1 | 317 passed, 7 failed, 13 skipped, 19 did not run. 6 of the 7 cannot run against `vite preview` (they import `/src/...` mock modules or read the clipboard: media-queue, media-admin-list "copy-id", presence-design-2300 x4) - re-run in run 2 against the dev server. 1 (announceb-295 "the screens card") - re-run at the base and the branch in run 2 |
| existing pixel specs | pixel-onboarding-2530, pixel-wiskey-schedule-exec-2530, pixel-wiskey-messaging, desktop + mobile | 1 | 46 passed, 1 skipped, 1 failed: onboarding "a fresh installation lands ..." (desktop) - a `/me/prefs` dismissal assertion, not a switch and not a picture; re-run at the base and the branch in run 2. No picture comparison failed: no baseline moved |

The cast case passes at the base too: `system-cast` re-reads through a loading phase that redraws the whole card, so its switch already came
back. It stays as a regression check; the notice boards module switch (no redraw) is the system family's before / after proof (run 2).

Run 2 (8210b9616):

| Check | Exit | Result |
|---|---|---|
| behaviour, base (before) | 1 | 6 failed, 1 passed (cast) - the notice boards case fails at the base for the right reason (`aria-checked` "false" after a refused "off", while the label still says "on") |
| behaviour, branch | 0 | 7 passed |
| announceb-295 "the screens card", base x3 / branch x3 | 0 / 0 | 3 passed / 3 passed - run 1's failure was a race (the device select before the area's save came back), not this row |
| onboarding "a fresh installation lands ...", base x3 / branch x3 | 0 / 1 | 3 passed / 1 passed, 2 failed - the test read the recorded `/me/prefs` PUT once, right after the row (hidden before the PUT leaves) disappeared. Nothing on that path changed here (`sw-app.ts`, `api/onboarding.ts`, `system-readiness.ts` untouched). Fixed in the test: it waits for the stored value (cc21493a1); run 3 below |
| dev-server-only specs against `vite` (media-queue, presence-design-2300, media-admin-list) | 1 | 32 passed, 1 failed: media-admin-list "copy-id" - `navigator.clipboard` is undefined on a plain-http runner address (environment; the same on the base) |
| compare pictures | - | 14 pictures (7 cases, before / after) |

Run 3 (`~/work/p2520_ctltog_run3.sh` at cc21493a1):

| Check | Exit | Result |
|---|---|---|
| onboarding "a fresh installation lands ..." x5, desktop | 0 | 5 passed |
| `pixel-onboarding-2530.spec.ts`, desktop + mobile | 0 | 15 passed, 1 skipped - the pictures match the committed baselines |

## Compare page

`private/planning/controlled_toggles_2540_compare_2026-11-26.html` (local, Hebrew; pictures in `private/planning/controlled_toggles_2540_shots/`):
each case right after a refused save, the base on one side and the branch on the other. At rest nothing looks different, so there is no
light / dark / phone set and no pixel baseline was refreshed.

## NOT_RUN

- The full release gate; the mobile / tablet projects of the new behaviour spec (the switch is the same component on every width; the
  existing specs of the converted screens ran on desktop, the existing pixel specs on desktop + mobile).
- Existing specs that press a converted switch but match no data attribute (they press it by label) were not hunted down one by one;
  the release gate covers them.
- The lab (forbidden for this row).

## Open questions

1. The device controls (`sw-room-card`, `devices-controls`: a light or a socket switched from a room card / device sheet) still move on the
   press and follow the device's live state afterwards. Make them controlled too? (a) no - they answer the device's own state within a
   moment, and a switch that waits would feel slow on a light (recommended); (b) yes, in a separate row with its own look check.
2. `system-cast` (5 switches) already recovered by reloading the whole card; it is converted anyway for one rule everywhere. Keep it? (a) yes
   (recommended); (b) revert those 5 lines.
