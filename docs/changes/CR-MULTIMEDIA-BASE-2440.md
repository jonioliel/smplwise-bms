# CR-MULTIMEDIA-BASE-2440 - one base for the three multimedia screens

Branch `pilot/CR-MULTIMEDIA-BASE-2440`, based on `origin/release/2437-train` (6c5541485). Independent of
`pilot/CR-DUP-ADMIN-CARDS-2440` (no shared file).
Plan row: `private/code-review-2026-11-13/MASTER_PLAN.md`, `pilot/CR-MULTIMEDIA-BASE-2436` (06:DUP-1, 06:DUP-5, D2 for the
multimedia trio). Behaviour change: no. Pixels: no.

## What and why

### DUP-1 - the three screens (`multimedia-screens.ts`, `multimedia-players.ts`, `multimedia-groups.ts`)

New `frontend/src/screens/multimedia-base.ts`:

- `MediaScreenBase<Status, Device>` (all three): the phases and the frame of a read (status first, the tab counts, "off" /
  "forbidden", then the screen's own lists; a failed refresh keeps the last state and marks it stale), the push subscription and
  its catch-up after a reconnect, the 30 s safety-net poll, the delayed refresh, the toast, the phone breakpoint, the editor's
  entry in the user menu, the `?edit=1` hand-off and the `data-fit` attribute.
- `MediaCardsScreenBase<Status, Device, Filters>` (screens and players): the filters in the address with the debounced search,
  the compacting header, the panel opened by an address parameter (`remote` / `player`), the push frames of a device, the layout
  editor's draft (enter / begin / leave / dirty / cancel / reload after a conflict), the home screen's floor order, the room
  chips as a dropdown, their mouse drag and the state box.

Each screen keeps its render, its CSS, its filter rules, its pair-chip publishing (the items differ) and its save. A screen
tells the base what differs through small hooks (`readStatus`, `listDevices` / `readContent`, `filtersFromParams`,
`filtersToParams`, `roomsInFloor`, `startDraft`, `beforeEdit`, `atConnect`, `routeLeftEdit`, `ownsRoute`, `pushed`, `loaded`).

### D2 - the poll

The three bare `setInterval(() => load(), 30_000)` became one `PollController` registration in the base
(`components/poll-controller.ts`, the shared controller of T2). Same period and same read. What the controller adds, as on every
screen migrated in 2436: no read while the page is hidden or the browser offline, never two reads at once, and one catch-up read
on resume when the last one is older than 5 s.

### DUP-5 - the multimedia settings lists (`system-multimedia.ts`, `system-multimedia-players.ts`, `system-cast.ts`)

New `frontend/src/screens/media-admin-form-css.ts`: `mediaAdminRowCss` (the settings row and its muted line: the players card
and the casting card) and `mediaAdminFormCss` (the device form inside a list row, the endpoint rows, the link button: the screens
and the players settings). Only declarations that were identical were moved; each screen lists the fragment before its own block.

Scope decision (recorded): the list shell of these screens is already shared (`adminTable` / `mediaAdminListCss` in
`media-admin-list.ts`). What was left of DUP-5 is CSS and a few 6-17 line handlers (`toggle`, `copy`, the save-and-say pattern)
that differ in their error handling; the handlers were left where they are. The fragments went into a new file and not into
`media-admin-list-logic.ts` as the row says: that file is the PURE part (no Lit, no DOM; `unit-media-admin-list.spec.ts` runs it
in Node) and stays so. `media-admin-list-logic.ts` is therefore untouched.

### SCROLL-1

Not changed here (owner decision O12 is carried out by `CR-NOSCROLL-LISTS`). The host scroll listener of the two card screens
moved into the base unchanged.

## Equivalences worth naming (reviewed line by line against the old code)

- `multimedia-groups` used to run the `?edit=1` hand-off without the `if (!this.editing)` guard the other two have. The guard is
  equivalent there: `editing` is only set together with `editHandled`, and the hand-off only runs while `editHandled` is false.
- `reloadAfterConflict` of the players page also cleared `conflict` after `beginDraft()`; `beginDraft()` already does.
- In `load()` of the groups page the "follow a running preset" loop now runs in the `loaded()` hook: same place in the sequence
  (after `phase = 'ready'` and `staleError = ''`, inside the same `try`).
- The groups page sets `stopped = false` before `super.connectedCallback()` instead of right after the glass styles; nothing
  reads it in between.
- Controllers: the base adds `PollController` first; `TabsModeController`, the skin controller and `PageFit` keep their relative
  order (the page fit stays a field of each screen for that reason).
- CSS order: a moved fragment precedes the screen's own block; where a moved rule and a kept rule meet on one element they either
  set different properties, set the same value (`select { max-inline-size: 100% }` in the screens settings), or the kept rule is
  more specific or later (`.ok[role='status']`, the `pointer: coarse` sizes, the phone `.ep` grid).

## Files

- new `frontend/src/screens/multimedia-base.ts` (449 lines with comments)
- new `frontend/src/screens/media-admin-form-css.ts` (112 lines)
- `frontend/src/screens/multimedia-screens.ts`, `multimedia-players.ts`, `multimedia-groups.ts`
- `frontend/src/screens/system-multimedia.ts`, `system-multimedia-players.ts`, `system-cast.ts`

Net over the six edited files: 129 lines added, 962 removed.

### Outside my rows

Nothing. No test file was changed.

## Tests actually run (workstation, Vite dev server of this worktree, `--project=desktop --workers=1`)

- `npx tsc --noEmit` (whole frontend): clean.
- Node / source specs: `unit-media-screens`, `unit-media-players`, `unit-media-players-layout`, `unit-dialog-toplayer-2381`,
  `unit-uxfix-nav-295`, `unit-a11y-polished-lint`, `unit-dark-polish-beds`, `unit-uxfix-rtl`, `unit-media-admin-list`,
  `unit-poll-controller`: 176 passed, 0 failed.
- Browser specs: `audit30-d-multimedia` (sources + the three screens in the browser, including no page scroll at 1366x768),
  `evidence-media-screens`, `evidence-media-players` (filters, panel, editor, groups), `evidence-system-multimedia`: 78 passed,
  0 failed.

The evidence specs rewrote PNGs under `docs/design/evidence/`; they were restored and are not part of the commit.

## NOT_RUN

- Pixel lanes of the three screens and of the multimedia settings: runner only.
- `evidence-media-players-live.spec.ts` (needs its throwaway backend, `tests/fixtures/media_fake_ha.py`; not started here),
  `evidence-media-player-panel.spec.ts`,
  `evidence-cast-ui.spec.ts`, `evidence-media-cast-chips.spec.ts`, `layout-noscroll-1366.spec.ts`, `layout-noscroll-297.spec.ts`,
  `evidence-noscroll-295.spec.ts`: not run locally (CPU / memory budget); they belong to the combined entry check.
- The tablet and mobile projects.
- No new unit was added for "no request while hidden / one on resume" per screen (06:POLL-1 suggests one per family): the
  behaviour is the controller's and `unit-poll-controller.spec.ts` covers it; a browser-level spec for the trio is left to the
  closing chain if wanted.
- `npm run build`, the full frontend suite, the runner entry check.

## Pixels to refresh

None expected.
