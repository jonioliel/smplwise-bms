# CR-FE-NITS-2442

Code-review batch 16.11, wave 3B, frontend chain step FE-4. Contract: the `FE-4` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.5 (named there `pilot/CR-FE-NITS-2436`), findings 06:NOOP-1, 06:STORE-1,
06:RTL-1, 06:TIMER-1 (the rest), 06:RESIZE-1 (the rest), 06:DIAG-4 (the dead branch).
Base: `origin/pilot/CR-STRUCT-CSS-SPLIT-2442` (`72e537412`, step FE-3).

Rules of the row: **no pixel change; timers and observers are cleaned on disconnect; one commit per finding.**

## What was already done before this branch (checked in the base's change notes and in the code)

| Finding | Already done | By |
|---|---|---|
| 06:TIMER-1 | Only the floor map's jump timer (`explore-floor-map.ts`, `focusZoomTimer`). | `CR-FLOORMAP-STATE-2440` |
| 06:RESIZE-1 | Nothing. The plan's `CR-HOME-MEMO` branch (home files) does not exist; `FE-WAVE2-COMBINED-2440`, `CR-W3-FE-COMBINED-2441`, `CR-POLL-SCREENS-A/B` and `CR-UI-CONTROLLERS-2440` moved polls and reloads, not these resize listeners or the timers below. | - |
| 06:DIAG-4, dead branch | **All of it.** `renderHealth()` no longer has the `isApi()` arms after its early return, and the `health` state type no longer has the `events` part. | `CR-DIAG-DEFECTS-2436` (`4ceaaf883`) |

So DIAG-4 needed no commit here; TIMER-1 and RESIZE-1 were done for every site of the finding except the floor map.

## Per finding

### 06:NOOP-1 - done (`36f2a0b88`)

| Site (review line -> today) | Change |
|---|---|
| `automation-editor-base.ts:1042` | `f.maybe_saved ? \`${f.message}\` : f.message` -> `f.message` (both arms gave the same text) |
| `schedule-editor.ts:1235` | `overlapIdx(a, b, _k)`: the unused index parameter and its argument are gone |
| `schedule-editor.ts:1941` | The review line is the first line of `renderDialogs()`; no no-op was found on it. The only candidate there, the one-use local `allDays`, was inlined into `activeSet`. Said plainly: this site may not be what the reviewer meant. |
| `devices-building.ts:4069` | `onAreaLink(e, id, _name)`: unused parameter and its three arguments |
| `devices-layout.ts:1721` | `setPickAll(on, _list)`: unused parameter and the two closures passed for it |
| `plan-studio-panel.ts:389-393` | The corner radius field wrote a closure variable on every `change` that nothing read (apply reads the input): `const typed`, no `@change` |
| `live-camera.ts:10/31` | `sw-chip` and `api/nvr` were imported twice (one line each now); `<sw-field>`, which the screen renders, is imported by the screen |
| `system-diagnostics.ts:1001-1002, 1823-1824` | Two doc comments stood stacked on the wrong method; each is on its own method (`renderNvrLessNotice`, `toggleLocalSafety`) |
| `home-widgets.ts:173/167, 179/160` | `WIND` and `HAVDALAH` repeated the path of `GLYPHS.wind` / `GLYPHS.moon`; they name those glyphs now (same drawing) |

The identical-arms ternary of `mapping-assistant.ts` (`seps`) belongs to 06:MAPA-1, not to this row; it is still in the code and was
left alone.

### 06:STORE-1 - done (`2fca1e308`)

New `frontend/src/api/safe-storage.ts`: `browserStorage()` / `browserSession()` (null when the storage throws or is missing) and
`storedText`, `storeText`, `dropStored`, `readStoredJson`, `writeStoredJson` - none ever throws; each takes the storage as its last
argument (default: local storage), so the rules are tested in node.

| File | Change |
|---|---|
| `screens/schedule-editor.ts` | `readView`, `setView` and the `safeSession('get' / 'set' / 'del')` helper use the shared functions. The stash and the "new schedule" hand-off stay in the **session** storage (7 call sites pass `browserSession()`). |
| `screens/devices-schedules.ts` | Its `store` / `readStored` / `writeStored` are gone. The raw read of the old view value (`store()?.getItem`) was outside any `try`; it is `storedText` now. |
| `access-control/settings-cards-logic.ts` | `browserStorage` is re-exported from the shared module, so `system-diagnostics.ts` and the tests that name it are unchanged. |
| `screens/system-access-parity.ts` | A fourth copy of `browserStorage` (not in the finding's list); it imports the shared one. |
| `screens/live-wall.ts` | `WALL_QUALITY_KEY` -> `WALL_STREAM_KEY`: `map/wall-plan-mode.ts` gives that name to another key (`sw.plan3d.wall_quality`). **The stored key `sw.wall.quality` is unchanged**, so a device keeps its choice. |

Stored keys and formats are unchanged everywhere. Not done: `live-wall.ts` has four more inline `try { localStorage... }` sites
(recorder filter, columns, camera count); the finding names only the constant for that file, so they were left.

### 06:TIMER-1, the rest - done (`edf4c1b55`)

| File | Leak | Fix |
|---|---|---|
| `devices-area.ts` | `flashTimer` (the "מבנה עודכן" badge, 4 s) was not cleared on disconnect; a screen attached again could keep the badge. | Cleared in `disconnectedCallback`, and the badge flag is reset with it. |
| `area-quick-sheet.ts` | The timer that removes `data-flick` after a release was not kept: an older release's timer ended a newer spring early, and it fired after disconnect. | One `flickTimer`: restarted by the next release, cleared (and the attribute removed) on disconnect. |
| `devices-layout.ts` | The card's long press and the device tile's long press shared `pressTimer`; ending a tile gesture cleared the card's timer. | The tile has `tilePressTimer`. `endTileDrag` clears only it; `hostDisconnected` clears both. The two gestures never run on the same screen state (the tile arrangement draws its card without the card handlers), so nothing a user sees changes. |
| `explore-plan-editor.ts` | `entTimer` and `circuitTimer` (250 ms search debounces) were not cleared: a search could start after the editor closed. | Cleared in `disconnectedCallback`. |
| `live-wall.ts` | The `ResizeObserver` and the window `resize` listener were added in `firstUpdated` (once in an element's life) and removed in `disconnectedCallback`: a wall attached again was no longer measured on a size change. | Both are armed in `connectedCallback`; `firstUpdated` is gone; `ro` is dropped on disconnect. `measure()` returns when the grid is not rendered yet, so the earlier arming is safe. |
| `explore-floor-map.ts` | - | Already done (`CR-FLOORMAP-STATE-2440`). |

Unit tests: source guards, one per file (the screens are Lit elements and the unit run is node-only; this is the form
`unit-floor-map-state` uses for the same finding). No behavioural test of the elements themselves was added.

### 06:RESIZE-1, the rest - done (`893f2c5a6`)

New `frontend/src/components/frame-coalescer.ts` (`FrameCoalescer`): many `schedule()` calls, one run per animation frame; `cancel()`
drops the booked frame. The frame source is injected, so it is tested in node with fake frames.

| File | Before | After |
|---|---|---|
| `devices-building.ts` | `requestUpdate()` per raw resize event | once per frame |
| `devices-area.ts` | the same (`onFitResize`) | once per frame |
| `devices-schedules.ts` | `fitRows = null` + `requestUpdate()` per event | once per frame |
| `area-quick-sheet.ts` | `applyRest()` + `requestUpdate()` per event, also while closed | once per frame, and nothing while the sheet is closed - in the event and again in the frame. `updated()` still calls `applyRest()` on every update, so the update that opens the sheet places it for the current viewport. |

Each screen calls `resizeFrame.cancel()` in `disconnectedCallback`. Pixels: the settled layout is computed by the same code from the
same inputs; only the moment moves, from inside the event to the animation frame of that event. One edge was accepted: a resize
during the ~300 ms in which a just-closed sheet slides out no longer re-places it.

### 06:RTL-1 - done, one site converted, none skipped for pixels (`184c464b5`)

Every site of the finding was read in its rule and in its markup:

| Site | Verdict |
|---|---|
| `investigate-history-map.ts` `.track .tlwrap { margin-left }` | **Converted** to `margin-inline-start`. `.track` is `direction: ltr` in every language (time runs left to right) and the wrapper is its direct child with no direction of its own, so the used margin is the same left margin. Pixel-neutral in Hebrew and English. |
| `automation-block-forms.ts` `.lockcode { text-align: left }` | Stays: the block is rendered with `dir="ltr"` (locked YAML). |
| `automation-code.ts` `.nums { text-align: right }`, `textarea { text-align: left }` | Stay: the editor's `.wrap` is `direction: ltr`; the gutter numbers are right-aligned against the code. |
| `explore-entities.ts` `.attrs`, `system-fleet-report.ts` `pre.json`, `system-notices.ts` `.link code`, `system-video-conn-test.ts` output block | Stay: each rule sets `direction: ltr` itself (raw attributes, JSON, a link, command output). |
| `system-audit.ts:109` | Stays (the review already called it correct: an LTR JSON cell). |

**Hebrew layout changes found: none**, so nothing had to be listed and skipped. No "real UI chrome" with a physical property was found
among the nine.

### 06:DIAG-4, dead branch - nothing to do

Done by `CR-DIAG-DEFECTS-2436` (see the first table). Verified in `system-diagnostics.ts`: `renderHealth()` is the early return plus
the demo markup with no `isApi()` inside; the `health` state has `discovery`, `video_codecs`, `remote` only.

## Pixels

No pixel change is intended and none was found. One CSS declaration changed (the RTL-1 site) and it is equivalent by rule; all other
changes are TypeScript. No baseline was regenerated, no PNG committed.

## Tests actually run

All on the workstation (no runner, no entry check - by the batch rule).

1. **`tsc --noEmit`** (frontend): exit 0 after the NOOP-1 commit, and exit 0 on the final source tree (all five commits).
2. **The new unit spec** `frontend/tests/unit-fe-nits-2442.spec.ts` (node-only): **18 of 18 passed** - NOOP-1 1 (source guards),
   STORE-1 5 (the storage helpers on a fake storage, a throwing one, none; the screens' use), TIMER-1 5 (source guards), RESIZE-1 5
   (`FrameCoalescer` on fake frames; the four screens' use), RTL-1 2 (source guards). Run after each commit with that commit's tests.
3. **Full node-only unit run** (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=2`) on the final tree:
   **4662 passed, 6 failed, 9 skipped** (4677; 16.7 min). The 6 are the known base failures, the same ones FE-1 .. FE-3 recorded:
   5 x `unit-session-me-failure-2435` (a page spec the node-only config starts without a server) and
   `unit-presence-compact-2310:36` (fails only inside the full run). The base had 8 skipped; the ninth is a test that needs
   `frontend/dist` and ran while `vite build` (check 5) was emptying it. Re-run afterwards with the build in place:
   `unit-mocks-lazy`, `unit-three-chunk`, `unit-entry-chunk`, `unit-presence-compact-2310` and the new spec - **52 of 52 passed, 0 skipped**.
4. **CSS text of every component, base (`72e537412`) against the final tree** - the FE-1 scripts (`dump.mjs`, `cmp.mjs`, not
   committed), one Vite dev server on this worktree, dumped before the first edit and after the last: 552 elements and 145
   exported sheets on both sides, 0 module import errors; **696 same, 1 different**: `investigate-history-map`, exactly the one
   declaration `margin-left` -> `margin-inline-start` in `.track .tlwrap` (the RTL-1 commit).
5. **RTL-1 equivalence in Chromium** (a throw-away script, not committed): the screen's two rules in an RTL page, once with
   `margin-left` and once with `margin-inline-start` - the same computed direction (ltr), margins (left 100 px, right 0, top 4 px)
   and the same box (x, y, width, height).
6. **`vite build`**: exit 0.
7. **Evidence specs of the touched screens** on that build, `vite preview` on a private port (4394), `--project=desktop --workers=1`:
   `evidence-home-295` (quick sheet), `evidence-home-screen` (home, widgets), `evidence-area-redesign` (area screen),
   `evidence-devices-tiles` (layout editor, tiles), `evidence-schedules-list`, `evidence-schedules-editor`, `evidence-history-map`,
   `evidence-wall-live-cap` (the wall's size watch), `evidence-curved-walls` (the corner radius field), `evidence-audit30g-video`
   (camera screen), `evidence-diagnostics-defects` - 11 files: **147 passed, 0 failed, 54 skipped** (15.7 min). The PNGs these runs
   rewrite under `docs/` were restored before the commit.

## NOT_RUN

- The pixel gate and the entry check - runner only; this batch pushes without queueing.
- Evidence specs on the tablet and mobile projects (the quick sheet's bottom-sheet mode with its flick timer and detents is a phone
  layout: its specs did not run in that project); the layout / page / pixel specs; every evidence spec not listed above.
- A behavioural test of the fixed timers inside a real element (attach, detach, attach again): the guards are source guards.
- ESLint (`typescript-eslint` is not installed in the shared `node_modules`), `npm run build:addon`, the bundle budget, the
  unused-exports report, `scripts/lazy-tags-check.mjs`, the backend suite (no backend file is touched).
- The rendered computed-style comparison of FE-1 (`render.mjs`) over the whole app: one declaration changed, checked on its own (check 5).

## For the next steps of the chain

- New shared modules: `api/safe-storage.ts` (use it instead of a new `try { localStorage ... }`) and `components/frame-coalescer.ts`.
- Left for another row: the four inline `localStorage` sites of `live-wall.ts`; the `seps` ternary of `mapping-assistant.ts` (06:MAPA-1).
- Open question for the lead: `schedule-editor.ts:1941` of 06:NOOP-1 could not be matched to a no-op (see the NOOP-1 table).
