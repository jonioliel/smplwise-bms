# LOWS-FRONTEND-2550 - the open low findings of the 2.52 deep review in the frontend (SCR-41..57, FC-07..12)

Row LOWS-FRONTEND-2550 (target 2.55). Base `origin/release/2540-train` at `f9217db8a` (2.54.0). Branch `pilot/LOWS-FRONTEND-2550`.
Sources: `docs/review/DEEP-REVIEW-2520-INDEX.md` (rows `| <ID> | low ...`), `docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md`
(`origin/review/DEEP-2520-FRONTEND-SCREENS`) and `docs/review/DEEP-REVIEW-2520-FRONTEND-CORE.md` (`origin/review/DEEP-2520-FRONTEND-CORE`).
Every finding was re-read in the code at the base before it was changed. Frontend only: no backend file is touched
(LOWS-BACKEND-2550 owns those); permissions, audit and the API are unchanged.

## Findings -> outcome

| ID | Finding (short) | Outcome | Where |
|---|---|---|---|
| FC-07 | Personal language read once, before the remote sign-in exists | fixed | `arx/boot.ts` |
| FC-08 | `describeError`: `http_502` / "Bad Gateway" shown; every `TypeError` = "no connection" | fixed | `api/client.ts` |
| FC-09 | `/me/ws`: a throwing listener skips the permissions check; frame handlers swallow errors | fixed | `api/session.ts`, `api/ha.ts` |
| FC-10 | A malformed `%` in a route segment throws inside the shell's render | fixed | `router.ts`, `shell/sw-app.ts` |
| FC-11 | `/me/ws` reconnects for ever after the session ended | fixed | `api/session.ts` |
| FC-12 | Concurrent step-up refusals share the first request's dialog | skipped - already fixed at the base (CLIENT-RESILIENCE-2540, `shell/step-up.ts`) | - |
| SCR-41 | Emergency sheet: a scope of one kind falls back to the other kind's first scope | fixed | `door-windows/emergency.ts`, `logic.ts` |
| SCR-42 | Door screen: any failed emergency read hides the red strip and the control | fixed | `screens/door-windows.ts`, `door-windows/logic.ts` |
| SCR-43 | Confirm dialog accepts an auto-repeated Enter | skipped - already fixed at the base (PHYSICAL-CONFIRM-2540, `components/confirm-dialog.ts`) | - |
| SCR-44 | Passkeys: a removal waiting for step-up still runs after the row's cancel | fixed | `components/sw-passkeys.ts` |
| SCR-45 | Factor reset: no in-flight guard; result painted on whichever user is selected | fixed (the guard was already in, FE-SAFETY-FIX-2520; the target user is new) | `components/sw-second-factor.ts`, `sw-user-factors.ts` |
| SCR-46 | Notice board items: full-list replace built from stale state; no read guard | fixed | `screens/system-notices.ts`, `notices/model.ts` |
| SCR-47 | Backups: an installation with no backups shows "the list did not load" | fixed | `screens/system-diagnostics.ts` |
| SCR-48 | Audit log: overlapping reads; browser-zone times; CSV cells not neutralised | fixed | `screens/system-audit.ts`, `screens/audit-logic.ts` (new) |
| SCR-49 | Users and permissions: revoking a user's role is one click (one's own too) | fixed | `screens/system-access.ts` |
| SCR-50 | People on stations: transport failure reads "not performed"; late check on another person | fixed | `screens/wiskey-station-people.ts` |
| SCR-51 | Call banner keeps a talk session after a 403; station permissions one `busy` slot | fixed (403 part + busy); question 2 for the non-403 read failure | `components/sw-incoming-call.ts`, `screens/wiskey-station-permissions.ts` |
| SCR-52 | Map room card "all off": partial failure not reported; no in-flight guard | fixed (owner answer Q1 a: a line on the room card) | `screens/explore-floor-map.ts`, `screens/map-room-bulk.ts` (new), `components/sw-room-card.ts` |
| SCR-53 | Deletes with no confirmation: water price version, temperature scheduled report | fixed | `screens/water/page-settings.ts`, `temperature/whatsapp.ts` |
| SCR-54 | Schedules bulk enable / disable acts on selections hidden by the filter | fixed (filter); other pages of the same filter = question 3 | `screens/devices-schedules.ts`, `schedules-logic.ts` |
| SCR-55 | Event centre: silent 500-row limit; multi-day ranges on UTC day edges | fixed | `screens/investigate-events.ts`, `investigate-events-logic.ts` |
| SCR-56 | Tickets: an in-flight poll restores an old status; calendar drag not rolled back | fixed | `screens/tickets-table.ts`, `tickets/table-model.ts`, `calendars/view-calendar.ts`, `grid-logic.ts` |
| SCR-57 | Home dimmer and some positions are physical (RTL-only): English home mirrored wrongly | fixed | `home/home-styles.ts` |

23 findings: 20 fixed, 1 fixed in part (SCR-51: the non-403 failure stays as it is, owner answer Q2 a), 2 skipped because the base
already carries the fix (FC-12, SCR-43). Owner answers (coordinator, 26.11): Q1 a built; Q2 a, Q3 a, Q4 a, Q5 a as built.

## What and why

### Frontend core
- **FC-07** `startApp()` (remote channel) calls `syncUiLang()` after the shell is mounted. main.ts's early call ran before the
  sign-in (a swallowed 401). Same language: nothing; another one: the mirror is written and the page reloads once (no loop: the
  reloaded page finds the same language).
- **FC-08** `describeError`: an `ApiError` whose code is the client's own fallback `http_<status>` (no server error model: a proxy's
  502, an empty body, FastAPI's `{detail}`) reads as the translated "השרת דחה את הבקשה ({status})" - never the raw code or the English
  status text. "אין חיבור לשרת." is only for a request that got no answer: `isNoConnection()` = `ApiUnreachable`, or a `TypeError` whose
  message is a browser's fetch failure ("Failed to fetch", "NetworkError ...", "Load failed", "fetch failed"). Any other `TypeError` (a
  bug in a screen's load) shows its message. Two older unit expectations used `new TypeError('x')` / `('failed')` as a network failure;
  they now use the real wording.
- **FC-09** `/me/ws`: the frame is parsed first (only a malformed frame is ignored), the permissions check runs before the listeners,
  each listener runs in its own `try` and a throw is logged (`console.error`). `ha/ws`: the same split - a handler error is logged, not
  swallowed as "malformed".
- **FC-10** `router.ts` `decodeSegment()` (keeps a segment as written when it is not a valid escape) for the three shell route
  segments (incident, area, schedule). `shell/nav.ts` already had its own safe decode.
- **FC-11** a 4401 / 4403 close of `/me/ws` ends the reconnect loop and reads the session once. The channel is opened again only when
  the session is still signed in after that read (the remote channel renews its sign-in on the 401 path), after a wait that doubles on
  each refusal in a row (2 s .. 60 s) - a server that keeps refusing is never asked in a tight loop. A signed-out session keeps it closed.

### Doors
- **SCR-41** each emergency kind acts only on the scope chosen in the sheet (`scopeForKind`). A kind that does not have that scope is
  drawn disabled with "לא זמין לטווח שנבחר" (en / ar / ru added) instead of silently preparing its own first scope. A re-read while the
  sheet is open that drops the chosen scope goes back to the first scope, as on opening.
- **SCR-42** only a 403 / 404 on the 5 s emergency read hides the strip and the control (`emergencyAfterFailure`); a failed read keeps
  what is shown.

### Settings and my account
- **SCR-44** the passkey row's cancel (removal or rename) and every new change drop a change still waiting for its step-up confirmation.
  ("Name the action in the box" from the review is not done: the box sits under the row it belongs to.)
- **SCR-45** both reset surfaces keep the user id the reset was sent for; the answer (done / error) is painted only on that user. Not
  reachable through today's drawer (it is rebuilt per user) - a defensive fix.
- **SCR-46** board item changes are queued, each built from the list the previous one left (`boardItemIds`; the saved list is kept even
  when the read after it fails); the board read is "newest wins" (`Latest`); edits typed while a save is on its way stay (and stay
  unsaved); a save that did not carry the display (a switch) no longer drops display edits waiting for "save"; a save answer for a board
  that is no longer open does not touch the open one.
- **SCR-47** the backup list's error panel follows `loadFailed.backup` (the object itself was always true).
- **SCR-48** filter reads are "newest wins"; the export waits for a read in flight; every CSV cell is neutralised (a leading = + - @, tab,
  carriage return, and their full-width forms get an apostrophe - the tickets / server rule); the time column is in the installation's
  zone (`time.zone`, default Asia/Jerusalem) instead of the browser's.
- **SCR-49** revoking a user's role binding asks first (shared confirm dialog, danger) naming the role, scope and person; one's own
  binding says it may take this screen away and opens with the focus on cancel. Group bindings keep their preview. Texts he + en.

### WisKey and the call banner
- **SCR-50** a station write with no answer / a time-out / a 5xx reads as amber "לחלק מהעמדות אין תוצאה ברורה. רעננו..." (the existing
  text) and the list is read again; only a refusal (4xx) is "not performed" (`physicalOutcome`). A duplicate check answered after
  another person's dialog opened is dropped.
- **SCR-51** a 403 on the banner's read ends every talk session it showed (microphone closed) before the banner goes quiet. Station
  permissions: one busy slot per station (a `Set`); the result line is written only under the person it was sent for.

### Map, water, temperature, schedules, events, tickets, calendars, home
- **SCR-52** the room card's "all off" runs one batch at a time (in-flight guard). Owner answer Q1 a: when devices stay on, the card
  says so under the lights' title - "{failed} מתוך {total} לא כובו" / "{failed} of {total} were not turned off" (the card's own `.empty`
  note in `--sw-warning-text`, role status, `data-room-bulk-result`). A device counts as not turned off when its command was refused or
  failed (an error, a failed / denied record - `bulkItemFailed`); an unknown or still pending answer is not claimed. The line belongs to
  its room (cleared when another room is selected, not written when the room changed during the batch) and to the last batch.
- **SCR-53** deleting a water price version asks first, naming its date; deleting a scheduled temperature report asks first and a
  refused delete shows its error (it was silent). Texts he + en.
- **SCR-54** bulk enable / disable and the bar's count use the selected schedules the current filter shows (`pickedShown`).
- **SCR-55** multi-day ranges use the installation zone's day edges (`eventsRange`, DST-safe; the code comment that accepted UTC is
  replaced). A list that reached the 500-row limit shows a banner (the screen's existing `.banner` style): only the latest 500 are
  shown and "סמן הכול כטופל" covers only those. Text he + en.
- **SCR-56** a tickets list answer keeps a row the screen holds at a newer revision (`keepNewerRows`); a refused calendar drag puts the
  entry back at once (`rollbackMove`), then reloads.
- **SCR-57** in left-to-right the dimmer fill grows from the left (`transform-origin: 0 50%`), its edge mark is mirrored (`scale: -1 1`;
  the inline transforms are untouched) and its value follows the document direction (one local custom property, no new px literal); the user menu, room temperature, camera star and theme tick use logical insets. Hebrew renders
  exactly as before: each logical side is the physical side it replaced in right-to-left (the phone override of the menu too).

## Files
- Core: `frontend/src/arx/boot.ts`, `api/client.ts`, `api/session.ts`, `api/ha.ts`, `router.ts`, `shell/sw-app.ts`
- Doors: `frontend/src/door-windows/emergency.ts`, `door-windows/logic.ts`, `screens/door-windows.ts`, `i18n/door-windows.ts` +
  `i18n/lang/{en,ar,ru}/i18n/door-windows.ts`
- Settings / account: `frontend/src/components/sw-passkeys.ts`, `sw-second-factor.ts`, `sw-user-factors.ts`, `screens/system-notices.ts`,
  `notices/model.ts`, `screens/system-diagnostics.ts`, `screens/system-audit.ts`, `screens/audit-logic.ts` (new), `screens/system-access.ts`,
  `i18n/lang/en/i18n/msg/system-a.ts`
- WisKey: `frontend/src/screens/wiskey-station-people.ts`, `components/sw-incoming-call.ts`, `screens/wiskey-station-permissions.ts`
- Screens: `frontend/src/screens/explore-floor-map.ts`, `screens/water/page-settings.ts`, `water/i18n.ts`, `i18n/lang/en/water/i18n.ts`,
  `temperature/whatsapp.ts`, `i18n/temperature.ts`, `i18n/lang/en/i18n/temperature.ts`, `screens/devices-schedules.ts`,
  `screens/schedules-logic.ts`, `screens/investigate-events.ts`, `screens/investigate-events-logic.ts`, `i18n/lang/en/i18n/msg/investigate.ts`,
  `screens/tickets-table.ts`, `tickets/table-model.ts`, `calendars/view-calendar.ts`, `calendars/grid-logic.ts`, `home/home-styles.ts`
- Tests (new): `frontend/tests/unit-lows-frontend-2550-{core,doors,settings,wiskey,screens}.spec.ts` (node),
  `frontend/tests/unit-lows-frontend-2550-pages.spec.ts` (page spec, mocked backend). Changed: `unit-automations.spec.ts`,
  `unit-i18n-api-2442.spec.ts` (a real fetch-failure text for the network case).

## Tests

Runner jobs `~/work/p2520_lfe_run.sh` (run 1, branch `fb6520ba2`), `p2520_lfe_run2.sh` + `p2520_lfe_run3.sh` (branch `9035eacfd`),
`p2520_lfe_run4.sh` (pixel re-run); logs in `~/work/p2520_lfe_results*/`. PC: the six new spec files one at a time, design ratchet.

### Before / after (the new specs on the base `f9217db8a` with the spec files copied in, then on the branch)
| Spec | Base | Branch |
|---|---|---|
| `unit-lows-frontend-2550-core.spec.ts` (FC-07..FC-11) | RC=1 - does not load (`decodeSegment` missing) | 10 passed |
| `unit-lows-frontend-2550-doors.spec.ts` (SCR-41, SCR-42) | RC=1 - does not load (`emergencyAfterFailure` missing) | 4 passed |
| `unit-lows-frontend-2550-settings.spec.ts` (SCR-45..SCR-49) | RC=1 - does not load (`screens/audit-logic` missing) | 8 passed |
| `unit-lows-frontend-2550-wiskey.spec.ts` (SCR-50, SCR-51) | RC=1: 4 failed | 4 passed |
| `unit-lows-frontend-2550-screens.spec.ts` (SCR-52..SCR-57) | RC=1 - does not load (`EVENTS_LIMIT` missing) | 10 passed |
| `unit-lows-frontend-2550-pages.spec.ts` (SCR-44, SCR-47, SCR-49; built app, mocked API) | RC=1: 3 failed, 1 passed (the error panel on a failed read, unchanged) | 4 passed |

### Branch checks
- Run 1 (`fb6520ba2`): `npm run build` RC=0; `npm run typecheck` RC=0, 0 TS errors; eslint on the changed src files RC=0;
  bundle budget RC=0; unused exports RC=1 (`isNoConnection` exported but file-local - fixed in `6e13669e8`).
- Run 1 node unit specs (5516): 5493 passed, 17 skipped, 6 failed - 3 caused by this row and fixed in `6e13669e8`
  (`unit-editors-memo-2440` holds one `filterSchedules` call in the schedules screen; `unit-palettes` found the core spec's `document`
  stub in the same worker; `unit-studio-controller` mocked a save failure with an `http_503` code and a message - now a server error
  model, see FC-08), 3 = `unit-mfa-passkeys-2490` (a page spec in the node-only run: ERR_CONNECTION_REFUSED, environment).
- Run 2 (`9035eacfd`): typecheck RC=0, `tsc -p tsconfig.json` RC=0, eslint RC=0, unused exports RC=0; node unit specs 5496 passed,
  17 skipped, 3 failed = the same three `unit-mfa-passkeys-2490` page tests (no server in the node-only run). They pass with a server (below).
- Run 1 page specs on the branch preview (`SW_UNIT_PAGES=1`): the new pages spec + `unit-mfa-passkeys-2490`, `unit-second-factor-admin-ui`,
  `unit-session-me-failure-2435`, `unit-step-up-ui`, `unit-local-user-create-2438`, `unit-station-permissions`: 21 passed, 4 skipped, 0 failed.
- Run 1 evidence specs of the touched screens (desktop; diagnostics, backups, notices x3, door windows x2, events x2, schedules list,
  tickets table x2, calendar grid edit, station people, station permissions, incoming call, physical confirm, temperature, water,
  plan / room card, confirm dialog, access polish, audit, review fixes, home account, client resilience, stale answers, time correct):
  271 passed, 23 skipped, 0 failed.
- Pixel (Linux baselines, desktop + mobile): run 1 `pixel-home-*` (5 files), `pixel-events-windows-2443`, `pixel-access-s12`,
  `pixel-access-status`, `pixel-onboarding-2530`: 83 passed, 5 skipped, 0 failed. Run 3 (after the dimmer fill fix) `pixel-home-*`:
  41 passed, 4 skipped, 1 failed (`home-next-wall-board-dark-1440`, 41 pixels, a screen without a dimmer) - run 4 re-ran `pixel-home-next-2500` alone (desktop + mobile): 10 passed - a raster flake, the same screen passed in run 1.
  No baseline was refreshed: the Hebrew screens do not change.
- `scripts/design_ratchet.py` (PC, at `9035eacfd`): RC=0, no count above the baseline (px-literal 25511, one below; the baseline is not
  lowered here).
- NOT_RUN: the full evidence / layout / pixel lanes (the release gate's job), tablet and mobile projects of the evidence specs, the
  i18n missing-keys report on its own (its ratchet spec `unit-i18n-en-ratchet-2490` ran inside the node unit run and passed).

## Look changes and the compare page
Hebrew screens: no pixel change is expected (logical insets equal the replaced physical sides in right-to-left; the new states appear only
in their own conditions). Visible changes: the English home (dimmer, menu, temperature, star, tick), the backups tab of an installation
with no backups (empty state instead of the error panel), new confirmation dialogs (shared component, SCR-49 / SCR-53), the event list's
500-row banner, and the emergency sheet's disabled kind (only when the two kinds' scope lists differ). Compare page:
`private/planning/lows_frontend_2550_compare_2026-11-26.html` (local, not committed).

## Open questions - answered by the owner (coordinator, 26.11): Q1 a (built in this row), Q2 a, Q3 a, Q4 a, Q5 a (as built)
1. SCR-52 - when the room card's "all off" leaves some devices on, how should it say so? (a) one short line on the room card under its
   buttons, e.g. "2 מתוך 5 לא כובו" (recommended) (b) a toast at the bottom of the map (c) leave it silent (today).
2. SCR-51 - the call banner after a read that failed for another reason than 403 keeps the last list (its buttons live) until the next
   good read. (a) keep it - the server refuses an answer / door for a call that ended (recommended) (b) after two failed reads in a row,
   grey the buttons with "אין חיבור".
3. SCR-54 - a selection on other pages of the same filter: (a) keep it in the bulk action; the bar's count says how many (recommended)
   (b) act only on the page on screen.
4. SCR-41 - an emergency kind that does not offer the chosen scope: (a) shown disabled with "לא זמין לטווח שנבחר" (built) (recommended)
   (b) hidden.
5. The new confirmations (revoke a user role, delete a water price version, delete a scheduled temperature report) are not settings:
   (a) keep them always on, as every other destructive delete (recommended) (b) a setting to turn them off.
