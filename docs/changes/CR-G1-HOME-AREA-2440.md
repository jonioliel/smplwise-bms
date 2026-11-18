# CR-G1-HOME-AREA-2440 - home and area screens: memoisation, render side effects, shared pieces

Branch `pilot/CR-G1-HOME-AREA-2440`, 2.44.0 group G1 (private/planning/REMAINING_WORK_2026-11-18.md section B). Two code-review rows,
done serially on one branch: **CR-HOME-MEMO** then **CR-AREA-LAYOUT** (private/code-review-2026-11-13/MASTER_PLAN.md, frontend wave 3;
findings in report 06). No owner question was open for these rows.

Base: `origin/pilot/CR-W3B-FE-COMBINED-2443` (41bf2a6d6), then `origin/release/2438-train` (d40eaf5d7) merged (2299f2774, no conflicts).
The base already holds DOMUS-DEFAULT, STRUCT-CSS-SPLIT, I18N-COMBINED-C and MODAL-STACK-B (all four checked with `merge-base --is-ancestor`).

## What changed

New `frontend/src/screens/devices-shared.ts` (no DOM access at import time; node specs load it):

| Piece | Replaces |
|---|---|
| `FIT_MIN_WIDTH`, `REFRESH_WINDOW_MS`, `STRUCTURE_FLASH_MS`, `scrollParentOf`, `alarmTone` (moved as they were) | the five helpers `devices-area.ts` imported from the 220 KB home module; `devices-building.ts` re-exports them |
| `fitStep()` | the two copies of the fit packing step (home, area) |
| `ReloadThrottle` | the three push-refetch throttles (home, area, quick sheet) - same rule: the first push opens the window, later ones ride it |
| `routeDevicePush()`, `withConnected()` | the three push switches |
| `areaIndex()` / `findArea()` (per tree object) | four area lookups in the home screen that walked every floor |
| `Memo2`, `rowIndexOf()`, `areaEntityIds()` | the area screen's row index (rebuilt up to six times per render) and the push filter's id set (rebuilt per push), the quick sheet's id set |
| `sensorValueText(value, unit, 'spaced' / 'tight')` | three copies of the sensor value text; the unit spacing is a parameter, so each place draws exactly what it drew |
| `presenceWho()` | the presence line's names part, written twice |
| `SKELETON_CSS` | the identical skeleton block / shimmer CSS of the home and the area screens (same rules, same place in each sheet) |
| `jsonClone()`, `gridsKey()` | six `JSON.parse(JSON.stringify())`; the layout memo key |

### CR-HOME-MEMO (06:PERF-6 home, 06:RENDER-1 home, 06:TIMER-1, 06:RESIZE-1 home files, 06:DUP-10 shared pieces)

- `devices-building.ts`
  - PERF-6: the 15 s `tick` interval is gone. It re-rendered the whole home screen (and re-ran the fit / tree measurements in `updated()`)
    only so the refresh button's tooltip ("המבנה עודכן לפני …") kept up, also while the page was hidden. The tooltip / accessible name is
    now written on the button alone on `pointerenter` / `focusin` (`refreshHover`); a render writes it too. The stale dot, which can turn
    on by age alone, is kept correct by a quiet 15 s `checkStale` that changes one `@state` only when the dot must change and never while
    the page is hidden.
  - RENDER-1: `render()` no longer writes state. The site level (`ensureLevel`, which set the `level` state inside the render) and the
    derived fields (`kpiTag`, `ctlBuilding`, `atSiteLevel`, `scopeAreas`) are settled in `willUpdate` (`syncScope`); the mini cross-section
    catalogue read starts in `willUpdate` (was started from `xsOffered()` during the render); the lazy panels' "used" flags are set there.
  - DUP-10: shared throttle, fit step, push routing, area index and `jsonClone`.
- `home-widgets.ts`: RENDER-1 - the empty band's `hidden` host attribute is set in `willUpdate` (was in `render()`); PERF-6 - the launcher's
  names map is built once per names object (was a new `Map` per render).
- `area-quick-sheet.ts`: shared throttle, push routing, memoised id set, `sensorValueText(..., 'spaced')`, `presenceWho`.
- TIMER-1 / RESIZE-1 for these files were already fixed by CR-FE-NITS-2442 (`FrameCoalescer`, `flickTimer`); nothing left to do there.

### CR-AREA-LAYOUT (06:PERF-6 area + layout, 06:DA-1 area, 06:RACE-7 area + layout, 06:DUP-10 adoption)

- `devices-area.ts`
  - DUP-10: imports `devices-shared.ts`, not `devices-building.ts`; shared throttle, fit step, push routing, sensor text (`tight` for the main
    strip, `spaced` for the sensor tiles, as before), `presenceWho`, `SKELETON_CSS`.
  - PERF-6: `rowIndex()` and `entityIds` are memoised on `(detail, extra)` (both are replaced, never mutated).
  - DA-1: an area change in the same element calls `resetAreaState()`: besides detail / presence / not-found / error it now also drops the
    quick pop-up, the device sheet, the assign dialog state, the media counts, the unfolded sensor groups, the extra rows (+ key), the cover
    group draft, the band page and the fit key. The phone's folded sections (`foldState`) are kept on purpose (a per-section preference).
  - RACE-7: `load()` checks the area id after the await in the catch too (a 404 of the previous area no longer marks the new one "not
    found"); `loadExtra()` checks it on both paths.
- `devices-layout.ts`
  - PERF-6: `prepare()` (called at the top of every host render) rebuilds the key map only when the grids' ids/keys change and the view
    (`complete` + `pack`) only when one of its inputs changes - grids key, editing, draft, record, variant, density. The draft and the record
    are replaced on every change (checked: every write is `this.draft = { ... }` / `this.record = ...`). The tile-card check still runs on
    every call, before the memo. `layoutDirty` serialises a draft once (memo on the draft object and the base string), not per render and
    per pointer move.
  - RACE-7: `load()` checks the screen id in the catch too (a failed read of the previous area's layout no longer blanks the current one).
  - TIMER-1 (shared `pressTimer`) was already split by CR-FE-NITS-2442 (`tilePressTimer`, cleared in `endTileDrag` from `hostDisconnected`).

No behaviour or pixel change is intended. No baseline was refreshed (none needed: the rendered output is the same).

## Tests changed because their source text moved (behaviour unchanged, the old text guards were stale)

- `unit-home-reload-2436.spec.ts` (quick sheet guards): the push switch is `routeDevicePush`, the throttle `ReloadThrottle` (`this.reloads.schedule()`
  / `cancel()`), the id set the memoised `areaEntityIds` (every `CARD_IDS` card, same set as `Object.values(cards)`). The fake-clock replay of the
  throttle stays; the shared class is driven on a fake clock in the new unit.
- `unit-home-lazy-2440.spec.ts`: the "used" flags are asserted in `willUpdate`, the render checks unchanged.
- `unit-area-presence-line-2351.spec.ts`: the `<bdi>` names are asserted in `devices-shared.ts` and the sheet's use of `presenceWho`.

New: `frontend/tests/unit-g1-home-area-2440.spec.ts` (20 tests): fit step table, throttle on a fake clock (bounded runs, cancel), push routing,
area index (first wins, one build per tree), row index / id set / `Memo2`, `sensorValueText` against the three old expressions, `gridsKey`,
`jsonClone`; source guards for each finding above.

## Tests actually run

Workstation (RAM limited; local = tsc + targeted node unit specs, `--workers=1`):

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | 0 errors |
| `npx tsc --noEmit -p tsconfig.tests.json` (filtered to the touched specs) | no error in the touched files |
| `node scripts/unused-exports.mjs --enforce` | OK (two new types made file-local first) |
| Unit specs touching these files, before the change (baseline) | 183 passed |
| Same 23 specs + the new unit, after | 203 passed |
| Re-run of the 6 directly affected unit specs after the stale-dot change | 82 passed |

Runner: see the section below.

## NOT_RUN

- `npm run lint` (eslint): NOT_RUN locally - the shared `node_modules` of the main checkout (2.43.7) has no `typescript-eslint`, which this
  branch's eslint config needs. Runs in the train's gate.
- Fixture-backed evidence specs of the home / area screens (`evidence-home-screen`, `evidence-devices`, `evidence-area-*`): NOT_RUN (need
  the fixture backend; they run in the entry check / release gate).
- Entry check (`branch_check.sh`): not queued, by instruction (the branch boards the 2.44.0 train later).
