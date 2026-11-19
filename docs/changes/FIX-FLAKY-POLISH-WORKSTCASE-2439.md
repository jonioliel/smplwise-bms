# FIX-FLAKY-POLISH-WORSTCASE-2439 - two specs that were FLAKY in both 2.43.8 release gates

Branch `pilot/FIX-FLAKY-POLISH-WORSTCASE-2439`, cut from `origin/release/2438-train` @ `5afd3af25` (= v2.43.8). No version bump, no
CHANGELOG entry, no migration, no backend change. (The note's file name keeps the spelling the task gave, `WORKSTCASE`.)

Both specs failed in the full gate run (6 workers, desktop + tablet + mobile on the dist preview, runner load 20-45) and passed when
re-run alone:

- `frontend/tests/evidence-polish2-295.spec.ts:205` "dark scheme: the choice buttons are legible" - `Error: choice buttons found`
  (automations and schedules, all three projects);
- `frontend/tests/layout-worstcase-screens-297.spec.ts:40` - `building/huge/domus-light/tablet: clipped span.value content 152px wider
  than box 100px (overflow-x hidden) | clipped span#mv-devices-building-view.txt content 36px wider than box 11px (overflow-x visible)`
  (gate 59ec7cde6) and `building/one/domus-dark/desktop: clipped span#mv-devices-building-view.txt ...` (gate 4679923b4).

## Root causes (measured on the runner with throw-away diagnostic specs, not committed)

### 1. evidence-polish2-295 "choice buttons found" - a test race (no product bug)

The test waited for `<sw-app>` only, then 800 ms, then read the choice buttons once. The screen is a lazy route chunk: on the runner at
load ~47 the buttons were still absent 800 ms after `<sw-app>` in 19 of 24 loads (unthrottled), and appeared 0.2-2.1 s later
(`#/devices/automations`, `#/devices/schedules`, all three projects; the screen element was often not even defined yet). Every load
drew the full set at once (desktop 15 / tablet 10 / mobile 9 on automations), so nothing is partly drawn when the first one appears.

### 2. layout-worstcase-screens-297 - two product bugs, made visible by the runner's lag

a. **The user menu's view row with three options cut its label.** The building screen registers "תצוגה" with three options when the
   live plan is on (`כרטיסים · אריחים · תוכנית`, api mode - the worst-case mocks are api mode). In the 300 px popover the label was
   squeezed to 11 px and the 36 px word ran under the segmented control - a real defect whenever the menu is opened there.
b. **A never-opened user menu was visible for the first `--sw-t-med` of every page load.** `:host` carries
   `transition: visibility 0s linear var(--sw-t-med)` (the delayed hide while the panel slides away on close). The host's first
   style arrived as a change from visible, so that delayed hide ran at creation: the closed menu was computed `visible` (accessibility
   tree, layout checks) until the transition ended - measured in 6 of 6 demo loads (classic and domus, all projects) and in every
   worst-case load. On a loaded runner the frames lag, the 220 ms stretch to the measurement point, and the layout check saw (a).
c. **A counter tile kept a stale fit after a web font arrived.** `sw-kpi` fits its compact value (`fit-text.ts`) after every render
   and every resize of the tile, but not when a font lands. Heebo's bold Latin face (the digits) is fetched only once the first figure
   is drawn and lands last (in every diagnostic load); the fit had measured the fallback face, the tile kept its size, so neither a
   render nor the ResizeObserver ran the fit again. Seen persisting on the runner: `12 / 377` 73 px in a 69 px box at 20.5 px
   (`data-fit="shrunk"`), still cut 3 s later; a forced re-fit gave 67/67 at 20 px. `sw-dropdown` and `sw-field` already re-fit on
   `document.fonts`; `sw-kpi` did not.
d. **The measurement could land before the frame that applies pending fits.** The spec measured 800 ms after the screen was attached;
   on a lagging renderer the value fit scheduled for the next frame after a render (and the shell's transitions) could still be
   pending - the 152 px vs 100 px case is a value that had not been fitted yet. The user never sees that state (the fit runs in the
   frame before paint); only a reading between tasks does.

## What changed

| File | Change |
|---|---|
| `frontend/src/shell/sw-user-menu.ts` | (a) `li.view` wraps: the label keeps its own width (`flex: 1 1 auto`), the control moves to a second line at the row's end when both do not fit (three options in the 300 px popover); two options still share one line (same geometry as before). (b) `:host(:not([data-was-open])) { transition: none }`; `data-was-open` is set the first time the menu opens, so the delayed hide still applies to every close. |
| `frontend/src/components/sw-kpi.ts` | (c) every connected tile fits its value again when `document.fonts` reports `loadingdone` (one document listener for all tiles, one measure per tile per frame through the existing `fitSchedule`). |
| `frontend/tests/evidence-polish2-295.spec.ts` | (1) waits (`expect.poll`, 20 s) until the screen has drawn its choice buttons before switching to dark; the selector is one constant shared with the contrast read. The assertions are unchanged. |
| `frontend/tests/layout-worstcase-screens-297.spec.ts` | (d) `settle(page)` (helpers/settle.ts: two frames, then the finite animations) before each measurement. The checks are unchanged. |
| `frontend/tests/layout-menu-kpi-fit-2439.spec.ts` | New regression spec for (a), (b), (c) - see Tests. |

No assertion was loosened, no retry added, nothing quarantined.

## Tests

RESULTS: filled in below after the runner runs.
