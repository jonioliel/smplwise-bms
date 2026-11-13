# CR-HOME-RELOAD-2436 - home media poll, area quick sheet reloads, plan view catalogue loader

Branch `pilot/CR-HOME-RELOAD-2436`, cut from `origin/pilot/CR-POLL-SCREENS-A-2436` at be4486204 (it imports
`frontend/src/components/poll-controller.ts` from that branch, unchanged). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1 frontend. No version bump, no backend change, no migration.
Merge `pilot/CR-POLL-SCREENS-A-2436` first.

## Findings covered

- **06:HOME-1 (a)** - `screens/home-widgets.ts`: the media read (`status` + `list` + `players.list`) ran every 10 s for every
  viewer with `media.read`, also when the home screen has no media widget, with no in-flight guard. Now:
  - the poll runs only while a media widget is placed (`items` holds `media`, any availability - the remote and the edit ghost
    read it); placing the widget reads at once and starts the poll, removing it cancels the poll;
  - the poll goes through `PollController` (the home part of D2): same 10 s period, nothing while hidden, one catch-up read on resume,
    never two reads at once;
  - `loadScreens` has an in-flight guard: a `media-changed` event or the retry button during a read asks for exactly one more read
    after it (no read is lost, none is doubled).
- **06:HOME-1 (b)** - `screens/area-quick-sheet.ts`:
  - a fresh `area` object with the same `area_id` (the home screen passes one after every tree refetch,
    `devices-building.ts` `renderQuickSheet`) no longer reloads area + presence + scenes + schedules + events + home options; another
    area still does. The sheet draws the live counts straight from `area`, so nothing shown goes stale;
  - `scheduleReload` is a throttle, not a resetting debounce (`SHEET_RELOAD_WINDOW_MS = 400`, as `devices-building.ts`
    `REFRESH_WINDOW_MS`): the first push opens the window, later pushes ride it, a push during the reload queues exactly one more;
  - an `entity_state_changed` push reloads only when it is about one of the area's own entities (every row the sheet draws comes from
    `detail.cards`; until the body is loaded every push counts), as `devices-area.ts`; `structure_changed` always reloads.
- **06:HOME-1 (c)** - `screens/area-quick-sheet.ts`: `hideTimer` was cleared but never set. On close it is now set to `CLOSE_MS`; when
  it fires on a still-closed sheet it drops `detail` / `scenes` / `schedules` / `events` (and the error line) and invalidates a read in
  flight, so the closed sheet no longer keeps the last area's camera cards mounted. A reopen inside `CLOSE_MS` clears the timer
  (`onOpen`, unchanged) and keeps the body.
- **06:DB-1** - `screens/devices-building.ts`: the plan view's catalogue read started inside `renderPlan` with `.catch(() => {})`; on a
  failure the panel spun forever. Now one loader, `loadPlanFloors()`, with `planState` idle / loading / ready / error, started from
  `willUpdate` the first time the plan view shows with a tree; a failure shows `sw-state-panel state="error"` ("לא ניתן לטעון את
  תוכניות הקומות", `data-plan-state="error"`) with "נסה שוב", which calls the same loader. The import block is untouched. The two other
  catalogue reads (`loadSite`, `loadXsCatalog`) already handle failure and are left as they are.

## Behaviour

- No visible change on success paths (the row: "no", failure state only for DB-1). Request-level differences, which are the point of
  the finding: no media requests without a media widget; no media requests while hidden plus one on resume; fewer sheet reloads.
- Small visible differences to note for review:
  - reopening the SAME area more than `CLOSE_MS` (180 ms) after a close shows the sheet's loading spinner until the area read
    answers (before: the previous body, then refreshed). This is the direct consequence of HOME-1 (c) as the finding asks for it;
  - an `entity_state_changed` about an entity outside the area no longer refreshes the open sheet (nothing in the sheet showed it).
- Unchanged on purpose (out of the row's scope): a catalogue answer with no floors at all still shows the loading panel (the original
  condition `planFloors.length`), now only after a successful read; the presence 30 s timer of the sheet stays a plain interval
  (it already checks `document.hidden`).

## Files

- `frontend/src/screens/home-widgets.ts`
- `frontend/src/screens/area-quick-sheet.ts`
- `frontend/src/screens/devices-building.ts` (plan catalogue loader, `willUpdate`, `renderPlan` only)
- new `frontend/tests/unit-home-reload-2436.spec.ts`
- this note

## Tests (run locally, Windows, Node 24.21.0, `playwright.unit.config.ts`, `--workers=1`)

- New `frontend/tests/unit-home-reload-2436.spec.ts`, written before the code (first run against the unchanged files failed on the
  source checks, as expected): 11 tests - source checks for every fix (poll wiring and placement gate, in-flight guard, area_id
  compare, push filter, throttle + its reset in `stopLive`, `hideTimer` + `dropBody`, the plan loader and its error panel / retry) and
  two behaviour checks on a fake clock: request counts with / without a media widget through the real `PollController` (none
  without the widget, one per 10 s while visible, none while hidden, one on resume, none after removal), and N pushes -> bounded
  reloads (50 pushes over 2 s -> 4-6 reloads, the last push still read). **11 passed.**
- Touched-area node unit specs (`unit-uxrest2-295`, `unit-tree-unassigned-2331`, `unit-polish4-wp4-home`,
  `unit-perf-home-devices`, `unit-owner-r12-2341`, `unit-live-refresh-295`, `unit-home-edit-drawer`, `unit-dark-polish-beds`,
  `unit-area-presence-line-2351`, `unit-area-popup-edit-2290`, `unit-a11y-polished-lint`, `unit-poll-controller`, `unit-area-quick`):
  **124 passed**.
- Type check: `tsc --noEmit` over the three touched files + the new spec (and everything they import), with the project's options:
  **0 errors in them**. The run's only errors are 2 x `src/components/update-run.ts(263): Cannot find name '__ARX_BUILD__'`, an
  untouched file whose global is declared outside that subset (not an error in the normal project config).

## Not run

- Browser specs named by the row (`tests/home-*`, the home evidence specs, the home pixel specs `pixel-home-fb-2431`,
  `pixel-home-gaps-2436`) and the pixel gate: NOT_RUN locally (they need a build + preview; the workstation is shared and loaded).
  The lead's combined wave-1 runner entry check covers them. Pixels should not move: no markup or CSS of a success state changed.
- No evidence spec with a failing catalogue was added (the node unit checks the loader and the error panel in the source); a
  browser check of the error panel is NOT_RUN.
- Full `tsc --noEmit`: NOT_RUN (more than 10 minutes on this workstation); the subset above only.
- No runner entry check queued (the lead combines wave-1 branches). No device or lab action.
