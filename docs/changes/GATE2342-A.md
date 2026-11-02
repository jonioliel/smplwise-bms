# GATE2342-A - release gate of 2.34.2: the lazy-screen group

Branch `fix/GATE2342-A` from `origin/release/2342-train` @ `c9e03747c`. Not merged into the train (the lead merges and rebuilds the UI).
No version bump, no API, data or settings change. Gate report: `gate_release-2342-train_c9e03747c` (FAIL, 119 test failures);
this branch owns the group below. The plan-editor / tickets / synoptic group and the pixel baselines belong to other agents.

## 1. Root causes

### A. Lazy screens lost their template properties in connectedCallback (product regression, PERF-HOME-DEVICES-2342)

`shell/lazy-screens.ts` (PERF-HOME-DEVICES-2342) let the shell render a route screen before its chunk arrived and the chunk's
`customElements.define` upgrade the element **in place**. An in-place upgrade runs the constructor and then `connectedCallback`
at once, and Lit's constructor (`__saveInstanceProperties`) moves every property the template had set on the plain element
aside until the **first update**. Every screen that reads a property in `connectedCallback` therefore saw its default:

- `explore-plan-editor` (`#/explore/floors/<id>/edit`) ran `load()` with `floorId = ''` and opened floor `f0` whatever floor
  the address named; with the ST7 mocks f0 is a 404, so no wall was ever drawn: `layout-st7-ui.spec.ts:51` (8 themes) and
  `evidence-st7-ui.spec.ts` (5 tests x desktop / tablet) timed out in `waitEditor`.
- `investigate-rules` (`#/investigate/rules?tab=alerts`) read `initialTab = ''` and opened on the rules tab:
  `evidence-shell.spec.ts:546` (the red dot, all three projects) found "חוקים(0)" pressed instead of "התראות".
- The home screen's plan view (`devices-building`, `void import('./explore-floor-map')` beside the tag) had the same in-place
  upgrade: the embedded floor map loaded with no `floorId` (its `updated()` does not reload on the first value). No gate spec
  caught it; fixed with the same loader.

A second, smaller defect in the same loader: a foreground render of a tag whose chunk was already in flight (the home's idle
warm-up of the area screen) was skipped, so the shell was never told when it landed.

Fix (`frontend/src/shell/lazy-screens.ts`): `loadPendingScreens` takes each undefined element of a lazy tag out of the DOM before
its chunk arrives (a comment keeps its place; a definition upgrades only connected elements). When the chunk lands it upgrades the
element while detached (`customElements.upgrade`), sets the template's own properties again through the now defined accessors and
puts it back in place, so `connectedCallback` runs with them - exactly the order of an element created after its definition. If
the render moved on meanwhile (another route, another floor) the comment is gone and the element is dropped with it. One promise
per tag is shared by every caller (warm-up and route alike). `frontend/src/screens/devices-building.ts` renders the plan view's
`<explore-floor-map>` plainly and calls `loadPendingScreens(this.renderRoot, ..., background = true)` in `updated()`
(`data-shell-ready` does not wait for it; `scripts/lazy-tags-check.mjs` accepts it as a route renderer).

### B. `sw-popover` was no longer defined on the style guide (PERF-HOME-DEVICES-2342 x A11Y-POLISHED-2342)

`a11y-polished-2342.spec.ts:53` (the A11Y branch's own new spec, written before the PERF branch) mounts a throwaway `<sw-popover>`
on `#/styleguide`. Only `explore-floor-map` imports `components/sw-popover`, and that module is now a lazy chunk, so the card never
upgraded and the wait for its slot timed out (all three projects). The popover's Escape fix itself is not involved.

Fix: `frontend/src/screens/styleguide-screen.ts` imports `components/sw-popover` (the style guide is where the shared components'
browser checks mount their elements); the spec waits for the definition before it mounts one.

### C. Three specs relied on every screen being defined on every address (stale tests; intended 2.34.2 behaviour)

PERF-HOME-DEVICES-2342 intends that the shell no longer defines every screen eagerly. Three specs depended on the old eager import:

- `evidence-protected-switches.spec.ts` (dev server, 11 tests): mounts `<devices-protected-switches>` on the home address and
  waited for a definition that now lives in the settings page's chunk. It now loads
  `/src/screens/devices-protected-switches-admin.ts` through the dev server (the same module instance the page imports; the spec
  already loads its mocks this way).
- `evidence-media-player-panel.spec.ts:657` (dev): mounts `<media-area-card>`, now in the area screen's chunk. Worse, the spec's
  `stage()` installs a stub `<media-player-card>` (`tests/fixtures/media-player-card-stub.js`) when none is defined: before PERF
  the real card was always defined and the stub was a no-op; now the stub was defined first, so the area chunk's own `define`
  threw, the chunk failed (and the app's loader reloads the page once on a failed chunk). Importing the card's module from the
  spec failed the same way ("the name media-player-card has already been used"). `stage()` now opens `#/devices/areas/living`
  first so the shell loads the area chunk (the real `<media-player-card>` and `<media-area-card>`), returns to the address it
  had, and only then adds the stub - a no-op again. `:711` only failed because the serial group stopped at `:657`.
- `evidence-calendars-settings-2310.spec.ts:193` (desktop + tablet): read the providers right after the page's load event; the
  screen is now drawn after its chunk lands, so the spec waits for the three providers first (its sibling test already waited).

## 2. Files

| File | Change |
|---|---|
| `frontend/src/shell/lazy-screens.ts` | park / upgrade-detached / restore; one shared promise per tag |
| `frontend/src/screens/devices-building.ts` | the plan view's map through `loadPendingScreens` |
| `frontend/src/screens/styleguide-screen.ts` | imports `sw-popover` |
| `frontend/tests/a11y-polished-2342.spec.ts` | waits for the `sw-popover` definition |
| `frontend/tests/evidence-protected-switches.spec.ts` | loads the screen's module (dev server) |
| `frontend/tests/evidence-media-player-panel.spec.ts` | `stage()` loads the area chunk before the card stub |
| `frontend/tests/evidence-calendars-settings-2310.spec.ts` | waits for the providers |

## 3. Results

Local (workstation, no browser): `npx tsc --noEmit -p frontend` exit 0; `node scripts/lazy-tags-check.mjs` OK;
unit specs `--workers=1` (`unit-perf-home-devices`, `unit-a11y-polished-lint`, `unit-fleet-report`, `unit-messaging-accounts`,
`unit-empty-state-icons`, `unit-token-lint`): 39 passed, 0 failed.

Runner (`run_smart.py ... --workers=1 --machine runner`, desktop / tablet / mobile):

| Run | Specs | Mode | Commit | Result |
|---|---|---|---|---|
| 1 | `layout-st7-ui`, `evidence-st7-ui`, `a11y-polished-2342`, `evidence-shell`, `evidence-calendars-settings-2310` | `preview` (built) | `954a57ef5` | **172 passed, 0 failed, 44 skipped** (the skips are the specs' own: the plan editor and the 1-provider check are not run on the phone) |
| 2 | `evidence-protected-switches`, `evidence-media-player-panel` | `spec` (dev server) | `954a57ef5` | 126 passed, **3 failed** (`:657` x 3, the stub collision above), 3 did not run (`:711`) |
| 3 | `evidence-media-player-panel` | `spec` | `1f19b1b50` | 93 passed, 3 failed, 3 did not run (the stage was gone: the failed chunk reloaded the page) |
| 4 | `evidence-media-player-panel`, `evidence-protected-switches` | `spec` | `9c1cdf60a` | **132 passed, 0 failed** |

Every test of the gate's list in this group passed on the runner: `layout-st7-ui:51` 8/8 desktop (the guard runs on desktop only);
`evidence-st7-ui` 35/63/84/106/132 desktop + tablet; `a11y-polished-2342:53`, `evidence-shell:546` desktop / tablet / mobile;
`evidence-calendars-settings-2310:193` desktop + tablet (skipped on the phone by the spec); `evidence-protected-switches` 33/33
(11 x 3 projects); `evidence-media-player-panel:657` and `:711` desktop / tablet / mobile.

## 4. NOT_RUN

- The rest of the gate's frontend selection (owned by the lead's re-gate).
- Pixel specs (another agent owns the baselines).
- `evidence-media-queue.spec.ts` also installs the `<media-player-card>` stub; it was not in this gate's failure list and was not run
  here. Since 2.34.2 it may run against the stub instead of the real card (the stub is defined first); worth a look in the nightly.
- `perf-home-load.spec.ts` (the PERF branch's timing spec) was not re-run after the loader change; the loader now parks a lazy
  element until its chunk lands instead of leaving it unupgraded in place (same wait, no extra fetch).
