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

### 1. evidence-polish2-295 "choice buttons found" - a test race, plus one product bug it shares with spec 2

The test waited for `<sw-app>` only, then 800 ms, then read the choice buttons once. The screen is a lazy route chunk: on the runner at
load ~47 the buttons were still absent 800 ms after `<sw-app>` in 19 of 24 loads (unthrottled), and appeared 0.2-2.1 s later
(`#/devices/automations`, `#/devices/schedules`, all three projects; the screen element was often not even defined yet). Every load
drew the full set at once (desktop 15 / tablet 10 / mobile 9 on automations), so nothing is partly drawn when the first one appears.

The first repeat run of the fix showed two more causes in the same test: (i) `notify-center` has the same close-only delayed hide as
the user menu (2b below) - a never-opened centre was computed visible after each load, so its segment buttons were counted before the
screen had drawn its own, then vanished; (ii) the test booted the app light and only flipped `data-theme` to dark afterwards. A
diagnostic copy under CPU throttle (6x) showed both ways that races the app: the light-to-dark colour transitions were still at
`currentTime 0` two seconds after the flip (no frame had run; labels read at the transitions' start, 1.44:1 / 4.48:1 / 1.56:1), and
in another load no transition was running but a chosen key read 1.23:1 from its track - the light theme's white key on its grey track:
a later `apply()` of the design (the look / brand / palette callbacks) had put the installation's light scheme back over the test's
flip. Neither happens when the test runs alone.

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
| `frontend/src/components/notify-center.ts` | the same (b) fix as the user menu: no visibility transition until the centre has opened once (`data-was-open`). |
| `frontend/src/components/sw-kpi.ts` | (c) every connected tile fits its value again when `document.fonts` reports `loadingdone` (one document listener for all tiles, one measure per tile per frame through the existing `fitSchedule`). |
| `frontend/tests/evidence-polish2-295.spec.ts` | (1) the dark test boots the app dark (`&scheme=dark`, the design override every `apply()` honours) instead of flipping `data-theme` after a light boot; waits (`expect.poll`, 20 s) until the screen has drawn its choice buttons; waits for the resting colours (`settle(page, 10_000)`: two frames, then every finite transition); checks the page is still dark when measured. The selector is one constant shared with the count and the contrast read. The contrast assertions are unchanged. |
| `frontend/tests/layout-worstcase-screens-297.spec.ts` | (d) before each measurement: waits (`expect.poll`, 30 s) until no loading panel is left (`sw-state-panel[state=loading]`; its spinner ring is painted 3 px outside its 64 px tile - a paired run caught the users screen still loading: `div.icon content 67px wider than box 64px`), then `settle` (helpers/settle.ts, imported as `restingLayout`: the test has a local `settle` timing) for the resting layout. The checks are unchanged. |
| `frontend/tests/layout-menu-kpi-fit-2439.spec.ts` | New regression spec for (a), (b) (user menu and notification centre), (c) - see Tests. |

No assertion was loosened, no retry added, nothing quarantined.

## Tests

All on the Ubuntu runner, own folder `~/work/flaky2439` (worktrees `base` = 5afd3af25 and `fix`), `nice -n 10`, the built dist on
`vite preview` (as the gate's preview group), all three projects, `--workers=6` (the gate's setting), `--repeat-each 10`. The worst-case
runs use `--grep-invert @timing-lane` (the gate keeps the timing lane apart). "Paired" = base and fix of the same spec started together,
so both see the same load; the load figures are the runner's 1-minute load average (16 CPUs) at start / end - other agents' jobs ran
too. A test counted once per execution.

### New regression spec `layout-menu-kpi-fit-2439.spec.ts` (3 tests x 3 projects)

| Head | base 5afd3af25 | fix |
|---|---|---|
| a8fd0c850 (menu + kpi) | 8 failed, 1 passed (the phone sheet is wide enough for three options, so (a) passes there) | 9 passed |
| 0f0a4850e (+ notify-center) | 8 failed, 1 passed: `frames with a closed overlay visible` x3, `the label is never cut` x2, `the figures after the font arrived (63px over, fit shrunk)` x3 | 9 passed |

### evidence-polish2-295, the flaky test (`dark scheme: the choice buttons are legible`, 4 screens x 3 projects x 10 = 120 per run)

| Run | Load | base | fix |
|---|---|---|---|
| 1, sequential, fix = a8fd0c850 | 45-60 | 22 failed (choice buttons found 17, notify-center / settings contrast) | 24 failed - the new causes (i)/(ii) of section 1: settings contrast 1.44 / 4.48, 4x choice buttons found via the notify-center |
| 2, paired, fix = 0f0a4850e | 7 -> 48 | 10 failed (9x choice buttons found) | 1 failed (`settings-schedules` chosen key 1.23:1 - the light theme put back over the flip, fixed in b9d2a8045) |
| dark test only, fix = b9d2a8045 | 63 -> 83 | - | **0 failed / 120** |
| 3, paired, final head dc8679b5a | 23 -> 100 | 77 failed (62x choice buttons found, 12x notify-center contrast) | 4 failed, all time-outs at load ~100: the screen not drawn within the 20 s poll (1), the 60 s test time-out reached at the screenshot (3); no contrast and no "choice buttons found" |

The whole spec file (240 per run) in run 3: base 93 failed, fix 15 failed; the other tests that failed on both are 60 s time-outs at
load 75-100 (`rows by default ...` :51, `the installation default ...` :123, `the media card ...` :226) - not this branch's flake, NOT
changed here.

### layout-worstcase-screens-297 (20 cases x 3 projects x 10 = 600 per run)

| Run | Load | base | fix |
|---|---|---|---|
| 1, base alone | 45-55 | 25 failed of 595 - the run then died of ENOSPC (the runner disk was filled by another agent's pytest temp dirs, `/tmp/t49-pytest-*`, 15 GB; freed by its owner ~20 min later) | - |
| 2, paired, fix = 0f0a4850e | 41 -> 82 | 11 failed: 8 layout findings (`span.value` 70/68, 73/69, 125/102 px and `#mv-devices-building-view.txt` 36/11 px), 3 ready time-outs (30 s) | 2 failed: 1 ready time-out (30 s, `domus light huge`), 1 finding `access/one/classic-light/tablet: clipped div.icon 67/64` (the loading panel - fixed in dc8679b5a) |
| 3, paired, final head dc8679b5a, **stopped by me at ~58 %** (a release gate had started; load 95-112) | 57 -> 112 | 9 failed of 356 run: **7 layout findings** (`span.value` 70/68, 73/69, 107/102 px; `#mv-devices-building-view.txt` 36/11 px), 2+ time-outs / aborted navigations | 4 failed of 344 run: **0 layout findings**; all ready time-outs (`toBeAttached` 30 s / `element(s) not found`) at load ~100-112 |

Summed over the paired worst-case runs (2 + 3, 944 / 956 executions): layout findings base 13, fix 1 (the loading panel, fixed in the
final head; 0 in run 3). The remaining fix failures are the 30 s "screen attached" wait at load 80-112 (2-3x the gate's load); base
has them too. That wait is unchanged (raising it would be a time budget change, left to the lead).

### Neighbouring specs (menu, counters, notifications), once, fix 0f0a4850e then base, 6 workers

`evidence-devices`, `evidence-menu-opaque`, `evidence-audit30b-shared`, `evidence-devices-tiles`, `evidence-home-screen`,
`evidence-nav-size`, `layout-bv1-tiles`, `evidence-notifications`: fix 252 passed / 2 failed / 325 skipped, base 252 / 2 / 325 - the
same two on both (`evidence-nav-size.spec.ts:86` "the user menu / banner offset follows the rail", `layout-bv1-tiles.spec.ts:86`
dynamic import of `/src/design/look.ts` - a dev-server spec on the preview). No difference.

### Static checks

`npx tsc --noEmit` (whole frontend project) on the runner: 0 errors at a8fd0c850 and at 0f0a4850e; the later test-only commits were
type-checked file by file on the workstation (`tsc --strict --noUnusedLocals ...` on the three spec files: 0 errors).
`~/gate2/lint_spec_waits.py` on the three touched / new spec files: 0 findings. No Hebrew string added to product code (comments in
English; the i18n source scan reads template text, comments inside `css` included).

### NOT_RUN

- The full Playwright suite, the backend, pixel baselines, `release_check`: not run (two specs and their neighbours only). No pixel
  change is expected: the view row changes only with three options (api mode with the live plan; the demo has two), the overlay
  rule only removes a transition before the first open, the counter re-fit only acts after a font load.
- No entry check queued (task instruction). No lab install.
- Workstation Playwright: not run (RAM); all browser runs on the runner.

## Rollback

Revert the branch's commits. No data, settings or migrations involved.
