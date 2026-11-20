# FLAKY-SWEEP-2480 - the repeat offenders of the 19.11 gates (target 2.48.0)

Branch `pilot/FLAKY-SWEEP-2480`, base `origin/release/2450-train` (521165ad4). Partial: stopped early (weekly usage limit);
what is done, what was measured and what remains are listed below.

## Input and ranking

Read on the runner (read-only): the gate2 reports of release/2439-train (66527605c, 670716c08, 88bd6bc54), release/2440-train
(6261bc7c4, 9d9ccb585, a4302d1d3) and the checkpoint of the running release/2450-train gate (521165ad4), plus the Playwright JSON of
each run for the error text. Flaky rows and timeout failures, counted per spec and per report (88bd6bc54's "time limit" rows left out):

| spec | rows | reports | main error |
|---|---|---|---|
| evidence-design-foundation (evidence matrix, mobile) | 25 | 4 | test timeout 60 s |
| evidence-calmsg-polish-2331 | 9 | 4 | 5 s toBeVisible right after goto |
| evidence-bridge-key | 8 | 4 | toContainText('Bridge key') 5 s after an in-place lang switch; p2 toHaveAttribute 5 s after goto |
| evidence-frigate-ui (layout guard) | 6 | 4 | test timeout (16 page loads in one test) |
| evidence-automations-list | 35 | 3 | timeouts on mobile; 5 s visible after goto |
| evidence-automations-builder | 20 | 3 | timeouts (L676 mobile also alone) |
| layout-dd-first-paint | 10 | 3 | chip moves / not drawn (dev server) |
| evidence-schedules-list | 8 | 3 | 5 s visible after goto |
| evidence-calendars-settings-2310 | 5 | 3 | `menu_position` never seen; 5 s visible |
| evidence-tickets | 7 | 2 | timeouts (4 loads per test) |
| unit-session-me-failure-2435 | 3 | 2 | wall-clock back-off race |
| unit-plan-editor-hot-2436 (MSG-1) | 3 | 2 | wall-clock timers |
| home-v3-followup-a (bill file) | 2 | 2 | download event missed |
| layout-tickets-map | 2 | 2 | 20 s chip wait inside a 14-load test |

## Causes and fixes (done)

1. **Waiting on the wrong signal after `page.goto`** (most rows). A 5 s assertion measured the cold start of the whole app (entry
   chunk, session, settings, lazy route chunk). New `tests/helpers/app-ready.ts` (`appReady` / `gotoApp`) waits for the shell's own
   readiness flag `sw-app[data-shell-ready]` (session known, settings applied, no route chunk in flight). Used in: calmsg-polish-2331,
   bridge-key, automations-list (`open`, `openApi`: also replaces a fixed 600 ms), schedules-list (`open`, `openApi`), calendars-settings-2310,
   tickets (`go`), design-foundation (`open`), layout-tickets-map, and `frigate-mocks.ts openApp` (all frigate specs).
2. **Overgrown multi-page tests split into parametrised tests**: design-foundation evidence matrix (5 loads -> one test per skin x scheme x
   screen + dialog); frigate-ui layout guard (16 loads -> one test per skin x scheme, both views in the one load); tickets evidence
   (list / drawer / full / create each did 4 loads -> `pictures <skin> <scheme>: <screen>` tests + one behaviour test each);
   layout-tickets-map (one 60-minute test per skin with 14 loads -> one test per skin x theme x screen, 180 s each).
3. **Race with demo data load**: calendars-settings-2310 "every answered setting" read page 1 before the rows loaded and paged past
   `menu_position`; it now waits for the rows, and `fits()` waits two settles (the measure-then-re-render) instead of 250 ms.
4. **Lazy language pack** (product, `src/i18n/lang-packs.ts`): `<html data-lang-words>` names the language whose words are rendered
   (set at start and after an in-place `lang` change once its pack is in and the components were refreshed). Nothing in the UI reads it;
   bridge-key waits for it instead of giving the 1.4 MB English pack a 5 s budget. No pixel effect (no CSS reads it).
5. **Wall-clock bound browser tests -> Playwright clock / held answers**: plan-editor MSG-1 (timers driven by `page.clock.runFor`);
   session-me-failure 502-then-200 (the retry's answer is held until the connecting state is checked) and the back-off test (clock
   paused before the "try now" press so the next back-off timer cannot add an ask).
6. **Missed event**: home-v3-followup-a bill file registers the download listener at tab creation (context `page` event).
7. **Heavy page loaded at the wrong size**: automations-list size loops run only the phone size on the mobile project (`sizesHere`);
   the 1440 / 820 passes there drew desktop pages at 2.6x pixels and overwrote the desktop pictures (mobile avg 15.8 s vs desktop 5.2 s
   per test in the 2.45.0 gate).
8. Fixed sleeps replaced by `settle` (finite animations ended) in tickets `shot`, calmsg `measure`, automations-list / schedules-list
   `shot`, frigate guard, design-foundation phone floors shot.

## Proof (PC, `vite preview` of this branch, `--workers=1`, PC at 100 % CPU from other agents = the "load" condition)

Before = the unchanged specs (copied to an untracked `tests-before/`), after = this branch; `--repeat-each=5`.

| case | before | after |
|---|---|---|
| design-foundation evidence matrix, mobile, domus light + crystal dark | 1 failed / 10 (636 s, ~60 s a test) | 50 passed / 50 (5 screens x 2 x 5; ~15 s a test) |
| frigate-ui layout guard, desktop | 2 failed / 5 (timeouts) | 80 passed / 80 (first split, per view x skin x scheme) |
| bridge-key, desktop + mobile | 70 passed / 70 (did not reproduce on the PC) | see the after-run table below |
| automations-builder L676 conflict, mobile | 5 passed / 5 (~21 s a test) | not changed |
| tickets drawer + create, desktop | 10 passed / 10 | see below |
| calmsg set-behavior / set-ro, desktop | 10 passed / 10 | see below |

### After-run R=1 (this branch, rebuilt dist with the lang-packs change, desktop, `--workers=1`)

| case | result |
|---|---|
| bridge-key, all 7 tests | 7 passed |
| session-me-failure, both 502 tests | first run: 1 failed (`clock.pauseAt` "cannot fast-forward to the past", +50 ms was too short on the loaded PC) -> fixed (+500 ms and wait until no ask arrives for 300 ms) -> 2 passed |
| plan-editor MSG-1, both tests | 2 passed |
| home-v3-followup-a bill file | 1 passed |
| calendars-settings-2310 "every answered setting" | 1 passed |
| frigate guard (per skin x scheme), tickets evidence (whole file) | NOT_RUN at the time of writing (the run was still going when the session had to stop) |

Not run after the change: calmsg-polish-2331, schedules-list, automations-list (`sizesHere`), layout-tickets-map, the mobile project of
bridge-key / session-me-failure. 5x after-runs exist only for design-foundation and the frigate guard (its first split).

## NOT_RUN / remaining

- tsc over src + tests: NOT_RUN to the end (`tsc -p tsconfig.tests.json` hit a 600 s limit on the overloaded PC). `vite build` of
  this branch: PASS (esbuild, no type check). ESLint `src/i18n/lang-packs.ts`: PASS. Specs typecheck only through Playwright's own
  transpile (the runs above).
- Runner: nothing run (the 2.45.0 gate held it the whole session). Entry check not queued.
- Not fixed yet (analysed): evidence-automations-builder (the mount waits up to 8 s for network idle while the style guide warms up
  ~80 chunks; plan: count the automations requests in flight in the route instead), layout-dd-first-paint (chip moves under load - a
  possible product jump; needs the Vite dev server), layout-elevators-widget-297, unit-arx-local-login screens-for-review on mobile,
  evidence-synoptic-mobile-2342, evidence-nvr-cameras-batch/write, electricity-meters, generator, temperature.
- The frigate guard was regrouped after its 5x run (per skin x scheme, both views in one load); only its R=1 after-run covers that shape.
- Backend timing tests: none in the flaky lists of these reports, so nothing moved to `timing_lane`.
- design-foundation / tickets / frigate test titles changed (split): quarantine or selection lists keyed by the old titles need none
  (none found); `gate_durations.json` keeps per-file numbers.
