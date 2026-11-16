# CR-W3-FE-COMBINED-2441 - the frontend side of the code-review batch -2440 on one branch

Branch `pilot/CR-W3-FE-COMBINED-2441`, worktree `C:\cloude\smplwise-w3-fe`. Base `origin/pilot/FE-WAVE2-COMBINED-2440` @
`0dac672e6`; first merge `origin/release/2437-train` @ `d849af79c` (the 2.43.7 gate fixes: schedules back key, 3D chip,
dialog focus, home detached read, r28 baselines); then the 21 pushed `pilot/CR-<NAME>-2440` branches of the frontend side,
one `git merge --no-ff` each. No version bump, no CHANGELOG entry, no backend file, no device or lab access. One runner
entry check covers the lot.

## Merged (in this order)

| # | Branch | Head | Merge commit | Conflict |
|---|---|---|---|---|
| 0 | `release/2437-train` | `d849af79c` | `ef851c2ae` | no (`devices-schedules.ts` merged by git) |
| 1 | `pilot/CR-UI-CONTROLLERS-2440` | `f7c5996ca` | `8779a45a2` | no |
| 2 | `pilot/CR-FORMAT-2440` | `80e982093` | `0f8d9058e` | no |
| 3 | `pilot/CR-ICONS-PALETTE-2440` | `fcfc4705f` | `b80ea3b67` | no |
| 4 | `pilot/CR-CSS-FRAGMENTS-2440` | `7ca6ed392` | `14ae20e0e` | yes (1 file) |
| 5 | `pilot/CR-MAP-SHARED-2440` | `62f06b2dd` | `f2890d4d1` | no |
| 6 | `pilot/CR-FLOORMAP-STATE-2440` (after MAP-SHARED) | `8088448d2` | `a0ccbb71e` | no |
| 7 | `pilot/CR-MAP-NUM-PRESS-2440` | `ecc9efcd8` | `5ce01b7a4` | no |
| 8 | `pilot/CR-PLAN-CANVAS-DRAG-2440` | `edb73a6e4` | `d0e69588f` | no |
| 9 | `pilot/CR-DUP-TICKETS-VIEWS-2440` | `7d32b0f4e` | `c2b7b5f76` | yes (2 files + 1 line in the new base) |
| 10 | `pilot/CR-DUP-METERS-2440` | `932f968ac` | `4e6cbc6dd` | no |
| 11 | `pilot/CR-DUP-NVR-BATCH-2440` | `7cc3b2f68` | `a8339247d` | no |
| 12 | `pilot/CR-DUP-ADMIN-CARDS-2440` | `da0bb0420` | `7ae423222` | no |
| 13 | `pilot/CR-MULTIMEDIA-BASE-2440` | `49ccca888` | `8bc429d14` | yes (3 files + the new base) |
| 14 | `pilot/CR-TK-CATALOGUE-2440` | `993f19b15` | `14b1d9049` | no |
| 15 | `pilot/CR-PUBLIC-FRAME-2440` | `4c4b77cb1` | `f5af8ed75` | no |
| 16 | `pilot/CR-DIAG-TABS-2440` | `d151181d2` | `dc8ab28fc` | no |
| 17 | `pilot/CR-HOME-LAZY-2440` | `07a050074` | `3030042b1` | no |
| 18 | `pilot/CR-POLL-SCREENS-B-2440` | `4eddadb04` | `f3d6992c5` | yes (2 files; hunk re-applied in the DUP-METERS base, 1 spec) |
| 19 | `pilot/CR-INV-EVENTS-2440` (after POLL-SCREENS-B) | `0efca8e02` | `5bb73a6ca` | no |
| 20 | `pilot/CR-INV-PLAYBACK-2440` (after POLL-SCREENS-B) | `b9b2dc6b3` | `d090ca094` | no |
| 21 | `pilot/CR-EDITORS-MEMO-2440` (after INV-PLAYBACK: it imports `sameRefs` from `map/memo.ts`) | `5487eae5e` | `c5049edd0` | yes (1 file) |

## Dropped

None.

## Conflicts and how each was resolved

Every conflict was between a -2440 branch (cut from the 2.43.7 train) and `PAGING-SETTING-2439` of the wave-2 base (the
"long lists page or scroll" setting), except number 4 below, which is between two -2440 branches. Both sides' intent is kept
in each.

1. **CSS-FRAGMENTS x wave 2 - `screens/system-building-presence.ts`** (import block). Wave 2 added
   `import { LongListsController, perPageFor } from '../api/long-lists'`, the branch added
   `import { settingsPillSegKeyStyles } from '../styles/settings'` at the same place. Both lines kept.
2. **DUP-TICKETS-VIEWS x wave 2 - `screens/tickets-board.ts`, `screens/tickets-list.ts`.** The branch moved the paged media
   query, `paged`, `cardPage` and `onPaged` into the new `tickets/list-view-base.ts` and turned each screen's reset into the
   `resetFit()` method; wave 2 had added to each screen a `LongListsController` whose callback sets `cardPage = 1` and calls
   `onPaged()`, and `&& this.lists.paged` in `pagedBoard()` / `pagedCards()` (that second hunk merged by git). Resolution: the
   branch's layout wins; each screen keeps its `lists = new LongListsController(...)` field and its import (the `PAGED_MQ`
   import goes with the branch - the base owns the query); **`onPaged` in `tickets/list-view-base.ts` became `protected`**
   (it was `private`) so the two screens' controllers can still call it. Behaviour of both sides unchanged.
3. **MULTIMEDIA-BASE x wave 2 - `screens/multimedia-groups.ts`, `multimedia-players.ts`, `multimedia-screens.ts`.** Wave 2
   moved `screens/multimedia-page-fit.ts` to `components/page-fit.ts` and changed the `data-fit` host mark of the groups and
   the screens page from `fit.on` to `fit.fits` (the region also "fits" while the long lists scroll; the players page was left
   on `fit.on`). The branch moved the shared fields and `willUpdate()` (`fit.on`) into the new `screens/multimedia-base.ts`.
   Resolution: the branch's layout wins; the `PageFit` import of the three screens **and of `multimedia-base.ts`** points at
   `../components/page-fit` (the old module no longer exists); `fit` is `protected` as the base requires; the groups and the
   screens page keep wave 2's `willUpdate()` as an override of the base's (`fit.fits`), the players page uses the base's
   (`fit.on`) - exactly the three values wave 2 had. Wave 2's CSS for `data-long-lists='scroll'` merged by git.
4. **POLL-SCREENS-B x DUP-METERS - `screens/electricity/page-meters.ts`, `screens/water/page-meters.ts`.** DUP-METERS moved
   the 60 s poll of both pages into `screens/meters-page-base.ts`; POLL-SCREENS-B replaced that `setInterval` by the shared
   `PollController` in the two page files. Resolution (the "split wins the layout, the hunk goes where the lines now live"
   rule): the two page files are DUP-METERS's; in `meters-page-base.ts` the `poll = 0` field became
   `private poller = new PollController(this)`, `connectedCallback` registers
   `this.poller.every('rows', POLL_MS, () => this.load(false))`, and the `clearInterval` of `disconnectedCallback` is gone
   (the controller stops with the host). `tests/unit-poll-screens-b-2440.spec.ts`: the two entries of "D2: each screen polls
   through PollController" that read the two page files read `screens/meters-page-base.ts` instead, plus one line asserting
   that the two page files hold no `setInterval`.
5. **EDITORS-MEMO x wave 2 - `screens/devices-schedules.ts`.** Wave 2 added a `willUpdate()` (the `data-list-panel` mark)
   right above `updated()`; the branch rewrote the head of `updated()` (measure only when a layout-relevant state changed).
   Resolution: wave 2's `willUpdate()` kept, the branch's `updated()` taken. A flip of the long-lists setting reaches the
   screen as a `requestUpdate()` with no changed property, which the branch's guard still measures (`!changed.size`).

The lists several branches could extend (`frontend/scripts/lazy-tags-check.mjs` NOT_IN_ENTRY, the count in
`unit-shell-lazy-2436`, POLISHED in `unit-a11y-polished-lint`, `tests/gate_always_run.json`) were each touched by one branch
only on this side (HOME-LAZY, HOME-LAZY, DUP-NVR-BATCH, none), so no union was needed.

## Also in this branch

- `docs/changes/CR-POLL-SCREENS-B-2440.md` - that branch was pushed without a change note; written here from its commit.
- `aa7f1e137` `fix(lazy-tags)`: `frontend/scripts/lazy-tags-check.mjs` - CR-MAP-SHARED-2440 moved the floor screens'
  `import('./sw-plan-3d')` into `map/floor-view-shared.ts` (`loadPlan3d()`); the check accepted a dynamic import only in the
  very module that renders the tag and reported `explore-floor-map.ts` (two groups) and `investigate-history-map.ts`. Not
  merge-caused (the finding is on the source branch alone), found by the combined unit run. The lazy-group rule now also
  accepts a module the renderer imports directly (one hop) that starts the chunk. The eager rule is unchanged.

## Tests actually run (workstation, 16.11)

- `npx tsc --noEmit` (the whole project, after the last merge): **clean, exit 0**.
- `npx playwright test -c playwright.unit.config.ts tests/unit- --workers=1` (every node-only `unit-*` spec, not only the
  ones the conflicts touched - the source-reading lints are where a cross-branch move shows): 4656 tests,
  **4634 passed, 10 skipped, 12 failed**. The twelve:
  - 4 - the specs that run `scripts/lazy-tags-check.mjs` (`unit-shell-lazy-2436`, `unit-perf-home-devices`,
    `unit-home-lazy-2440`, `unit-diag-tabs-2440`): three findings from CR-MAP-SHARED-2440 alone (see "Also in this branch").
    **Fixed** in `aa7f1e137`; the four specs plus `unit-poll-screens-b-2440` run again after the fix: **38 passed**.
  - 5 - `unit-session-me-failure-2435`: it opens a page (`page.goto('./#/devices')`) and the unit config's page-spec filter
    does not recognise that form; no server here. Harness, as recorded in the FE-WAVE2 note. NOT_RUN in effect.
  - 1 - `unit-presence-compact-2310` ("no card, the map only"): `document.documentElement` undefined in `i18n/presence.ts`.
    Only in the one-worker full run (another spec's `document` stub stays in the shared worker); run alone the spec gives
    **16 passed**. No file of it is touched by any -2440 branch.
  - 1 - `unit-recorded-month` ("the playback screen wires the month view"): it pins the address text
    ``cameras/${cameraId}/recordings/days?month=${month}``, which CR-API-PATHS-2439 rewrote with the `path` / `query`
    helpers. **Already failing on the wave-2 base** `0dac672e6` (same source line, same spec); not touched here.
  - 1 - `unit-uxfix-rtl` ("no source line pairs a Hebrew string with U+203A"): `i18n/he.ts:1083`, the hint of the long-lists
    setting from PAGING-SETTING-2439 ("... ‹ 2 / 5 › ..."). **Already failing on the wave-2 base**; not touched here
    (it is user-facing copy: either the text or the lint's rule changes - for the wave-2 owner / the lead).
- The first attempt of the unit run was started without the `tests/unit-` filter, which also selects the browser specs
  (no server: they fail at `page.goto`); it was stopped after about 150 tests and is not counted. The evidence PNGs the
  runs rewrote under `docs/evidence/USR2/` were restored, none is committed.

## NOT_RUN

- Every browser spec (evidence / layout / page specs, the `unit-*` specs that open a page), the tablet and mobile projects,
  the pixel gate, `npm run build` / `build:public`, the bundle budget, ESLint: runner only - the entry check of this branch.
  Most source branches ran no browser spec at all (see their notes); this entry check is their first real run.
- The touch-device check that lead decision L10 asks for (CR-PLAN-CANVAS-DRAG: a cancelled drag no longer commits) - open.
- The browser checks the notes ask the entry run to watch: floor switch with picked cameras and Back from the wall with
  `picks=` (FLOORMAP-STATE); a spec that reads a settings card right after the tab click without waiting (DIAG-TABS); Tab
  counts across a listened-to `sw-table` (UI-CONTROLLERS).

## Pixels expected to change

None. No source branch reports a pixel change and no resolution above touches markup or style. No PNG was regenerated or
committed (the r28 baselines came with the `release/2437-train` merge).
