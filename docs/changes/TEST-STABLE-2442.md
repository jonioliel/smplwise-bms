# TEST-STABLE-2442 - two test-stability fixes (the home calendar near midnight, the intercom cards' pixel wait)

Branch `pilot/TEST-STABLE-2442`, base `origin/main` (v2.43.7, cc69447f1). Tests and one test marker only; nothing drawn changes.

## 1. Home specs that failed near midnight

### What failed

`home-v3-p2.spec.ts` "calendar: the day, a new event from the sheet" and "a wall panel locked to its room shows the notice board and
the calendar, adds an event, books nothing" (seen 16.11 at 23:45-23:57 on `pilot/CR-I18N-HOME-2441`). Both wait for today's event
`.cev`.

### Cause

`tests/home-v3-p2-mocks.ts` stamped everything relative to the real clock: `at(m) = Date.now() + m minutes`. "Today's" event `e1`
started 30 minutes from now, so on every run after 23:30 it was tomorrow's and the day list of today was empty. The same shape in
`home-v3-auditfix-2437.spec.ts`: item 4 (the wall panel's calendar chip, an event 40 minutes from now - not today's after 23:20) and
items 16 / 25 (presence stamps 1-3 minutes ago for "מאז HH:MM" - yesterday's in the first minutes after midnight).

The product is right (an event that starts tomorrow is not in today's list); the mocks were wrong. No product code changed for this.

### Fix

- `frontend/tests/helpers/today-clock.ts` (new): `pinToday(page)` fixes the page's clock at 12:00 of the current day
  (`page.clock.setFixedTime`: Date is fixed, timers keep running) and returns that instant; `pinnedNow(page)` reads it back;
  `todayNoon()` / `systemNow()` are the parts. Offsets between -12 h and +12 h are inside "today" at any hour of the run.
  `SW_FAKE_SYSTEM_TIME=<ISO time>` stands in for the real clock, for proving that a run does not depend on its hour.
- `tests/home-v3-p2-mocks.ts`: `mockP2` pins the page (unless the caller passes `now` and owns the clock) and builds every stamp on
  that instant - the calendar events, presence, notices, tickets, the weather days. No `Date.now()` is left in the file.
- `tests/home-simple-mocks.ts`: `mockHome` takes an optional `now` (default: the real clock, as before) for its notifications, calls
  and `server_time_ms`, so the base layer under `mockP2` follows the same pinned clock. Callers that do not pass it are unchanged.
- `tests/home-v3-auditfix-2437.spec.ts`: items 4 and 16 / 25 build their own rows on `pinnedNow(page)`.

Specs that now run on the pinned clock (every user of `mockP2`): `home-v3-p2`, `home-v3-p2-shots`, `home-v3-fb-2431`,
`home-r32-answers-2438` (its calendar cases), `home-v3-auditfix-2437` (items 4, 16 / 25). `pixel-home-fb-2431` also calls `mockP2`
(with empty data) and then fixes its own clock at 2026-11-03 10:00 as before - its pictures do not depend on this change.

### Looked at and left

- `home-simple-mocks.ts` without `now`, `home-v3-gaps-mocks.ts`: already hour-safe (HOME-V3-FOLLOWUP-A-2431: the missed call is
  clamped to the installation's midnight; the gap mock states that its "ago" stamps draw the same rows at any hour - read, not re-proved).
- `home-v3-p1.spec.ts`, `home-leave-2435.spec.ts`: "today" is built with `setHours(h)` on the current day - inside today at any hour.
- `home-v3p3-mocks.ts`, `home-v3-auditfix-2437` item 17 (water week): day buckets keyed by the same local day the page computes.
  `home-v3-p3.spec.ts:219` depends on the day of the MONTH (no estimate on the 1st / 2nd) and guards it itself - another class, untouched.
- Calendars module specs (`calendars-mocks.ts`, `evidence-calendars-*`, `audit30-f-calendars`): demo data on fixed hours of the day or an
  installed clock; no "minutes from now" stamps. Not changed.
- Not swept: non-calendar specs with "minutes ago" stamps (events, tickets, access). None expects "today".

## 2. `pixel-settings-intercom-cards-2401` waits for the settled display card

The spec waited only for the engine ROW of `system-access-display`, which exists while the engine list is still loading (the race
FLAKY-S12-FIX-2441 found for S12). It now waits for `[data-access-display-settled="true"]`:

- `frontend/src/screens/system-access-display.ts`: the `data-access-display-settled` attribute and its `settled()` method, taken
  byte for byte from `origin/pilot/FLAKY-S12-FIX-2441` (that branch is not on main yet; the file is identical to that branch's, so
  the two merge without a conflict). An attribute only - nothing drawn changes. The built add-on (`smplwise_vms/www*`) was not rebuilt.
- `frontend/tests/pixel-settings-intercom-cards-2401.spec.ts`: `displaySettled(page, count)` - `count` ready cards carry
  `settled="true"` and none carries `"false"`. Layout a mounts two such cards (display, announcements; both alive while folded, and
  their fold headers show their summaries), so `ready()` and `openCard()` wait for 2 before every picture; layout b's second tab
  waits for 1. No baseline image was touched; no PNG is committed.

## Tests actually run (workstation, Windows, `npx vite build` + preview on port 4342, `--workers=1`)

- `npx tsc --noEmit`: exit 0.
- Home set = `home-v3-p2`, `home-v3-auditfix-2437`, `home-v3-fb-2431`, `home-r32-answers-2438`, `home-v3-p2-shots`,
  `--project=desktop --project=mobile` (132 listed; the specs skip the mobile project themselves and some one-size cases):
  - real time (about 10:00): **57 passed, 75 skipped, 0 failed**;
  - `SW_FAKE_SYSTEM_TIME=2026-11-16T23:50:00+02:00`: **57 passed, 75 skipped, 0 failed**;
  - `SW_FAKE_SYSTEM_TIME=2026-11-17T00:05:00+02:00`: **57 passed, 75 skipped, 0 failed**.
- The failure reproduced and the fix checked with Node's `Date` itself shifted (a throw-away `--import` preload, not committed, that
  makes the test process believe it is the given time; the browser's clock stayed real unless the mock pinned it), `home-v3-p2` +
  `home-v3-auditfix-2437`, desktop:
  - OLD mocks at 23:50: **2 failed** - exactly the two tests above - 35 passed, 1 skipped;
  - this branch at 23:50: **37 passed, 1 skipped, 0 failed**; at 00:05: **37 passed, 1 skipped, 0 failed**.
- `pixel-settings-intercom-cards-2401`, desktop + mobile. Windows has no committed baselines, so the first run wrote local Windows
  baselines with `--update-snapshots` (3 passed, 3 skipped; deleted afterwards, never committed) and the second was a real compare
  against them with `--repeat-each=3`: **9 passed, 9 skipped (the other project's cases), 0 failed**, no `skipped-pixel` annotation.

## NOT_RUN

- Linux pixel compare of `pixel-settings-intercom-cards-2401` against the committed baselines, and every other pixel / layout /
  evidence suite: the runner's. No runner job and no entry check were started (instruction: the queue is full; the lead queues).
- `pixel-home-fb-2431` (a `mockP2` user) was not run: no Windows baselines; by reading it is unaffected (empty data, its own clock).
- A real wall-clock run at 23:50 / 00:05: not done; the two faked-clock methods above stand in for it.
- Unit specs, backend tests: none touched, none run.

## For the lead

- When `pilot/FLAKY-S12-FIX-2441` merges, `system-access-display.ts` is already identical here - no conflict expected.
- A home spec that needs the real clock together with `mockP2` must pass `now` and fix the clock itself.
