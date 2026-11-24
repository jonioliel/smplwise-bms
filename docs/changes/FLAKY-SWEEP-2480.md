# FLAKY-SWEEP-2480 - the repeat offenders of the 19.11 gates (target 2.48.0)

Branch `pilot/FLAKY-SWEEP-2480`, first base `origin/release/2450-train` (521165ad4); session 2 (22.11) merged
`origin/release/2470-train` twice (e07db2469, 104bd90b2 = 2.47.0 + HOME-V3-SEGMENTS, no conflicts) and continued the sweep with the
2.46.0 gate's flaky list. Session 1 is described first, session 2 at the end. Test code only, except the session-1 `lang-packs.ts`
attribute (nothing reads it, no CSS selects it: no pixel effect). Nothing a user can see changed, so no comparison page and no baseline.

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
| frigate layout guard, final shape (per skin x scheme, 8 tests) | 8 passed |
| tickets evidence (whole file) | NOT_RUN (stopped unfinished when the session had to end) |

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

## Session 2 (22.11): the 2.46.0 gate list (`gate_release-2460-train_8a8d6d63c`, 62 flaky) and the 2.45.0 gate reports

Read on the runner (read-only): the gate2 report and every Playwright JSON of `gate_release-2460-train_8a8d6d63c` and
`gate_release-2450-train_521165ad4`, with the first error line and the duration of each failing attempt, and the per-file / per-project
durations (mobile against desktop).

### Causes and fixes

9. **Desktop-sized pages on the phone project** (most of the 2.46.0 mobile rows). The phone project is Pixel 7 at device scale 2.625;
   a spec that pins 1440 x 900 (automations-builder `mount`, automations-list `open` / `openApi` default size) or 1440 x 2400
   (system-multimedia via `media-players-harness` `openSize`) drew the desktop page there at ~7x the pixels (3780 x 6300 per frame for
   multimedia) and wrote the desktop project's picture names. Gate durations: builder mobile 25.3 s a test vs 12.5 s desktop (12
   timeouts), multimedia mobile 46.1 s vs 33.3 s (8 timeouts), mostly "taking page screenshot" at the end of the budget. New
   `tests/helpers/phone-project.ts` `skipDesktopSizeOnPhone(width)`: such a test is skipped on the phone project only; desktop and
   tablet run it as before, and every phone-sized test still runs on the phone project.
10. **builder mount: an 8 s "network idle" wait that never ends** (the shell warms the common screens' chunks after the first load), so
    each of ~150 mounts paid the full 8 s under load. It now waits for the shell (`gotoApp`) and until no `automations/*` request of the
    test is still being answered (an in-flight counter in the route), which is what the clearing of the call record needs.
11. **Reading the request record before the request**: tickets-costs (partial approval, payment demand) read `m.calls` right after the
    click; the bodies are now read once the send dialog that the server's answer opens is shown (costs-tab `afterDecision`).
    wiskey-door-tech: the delete went out with the old revision because the result line comes from the write's answer and the new
    revision only from the read after it (`execute -> load`); the test waits for that read (the new name in the list).
12. **A Node stub leaking across spec files**: unit-plan3d-furnmerge / -level3 put `document = { createElement }` on `globalThis` at
    module level and never removed it. Later files of the same worker (and the collection phase) then failed: lit-html
    `createTreeWalker is not a function` (unit-plan3d-real, 0 ms), `Invalid URL` (unit-video-sub-fallback-2402, its `??=` kept the
    stub). New `tests/helpers/node-canvas-stub.ts`: installed in `beforeAll`, restored in `afterAll`.
13. **Node-side polls of a busy 3D page**: `description.real` was polled with 20 / 30 s budgets while the page's main thread rebuilt the
    level-3 graph (every poll is a page evaluation queued behind that work). `tests/helpers/plan-3d-wait.ts` `realisticDescription`
    waits inside the page, one host update / element update / frame at a time (look-r3, odd, realistic). The realistic door test slept
    400 / 900 / 300 ms; it now applies each description through the element's update and waits in the page until scene-three's door
    animations list is empty before reading the graph.
14. **Overgrown tests split** (the session-1 pattern): layout-tickets-s4 (one test per skin x theme x screen, 180 s each, after
    `appReady`), layout-tickets-drawer five skins x light / dark (one per skin and scheme), wiskey-station-media busy / blocked
    microphone / refused start (three tests), public-ui5 four languages (one per language). Same checks, same picture names.
15. **`appReady` after the page load** in nav-size, multi-nvr, device-types-admin-ui, xsection-synoptic, syn-columns-2321,
    offbox-backup-ui, offbox-gdrive-diagnose-2351, invrest-polish, tickets-drawer, maintenance; a11y-dialog-focus also replaced its
    800 / 400 ms sleeps with the shell flag and "the focus is inside the dialog".

Kept: the home-v3-followup-a bill-file listener hunk (session 1) survives both merges (the 2.46.0 note names it as the fix of the
HOME-V3-SEGMENTS "show bill" failure).

### Proof (runner, own worktree `~/work/flaky`, `nice -n 19`, `--workers=2` unless noted, retries 0, no gate running; other agents'
jobs kept the load at 7-29 during these runs)

| run | head | result |
|---|---|---|
| tsc `tsconfig.json` / `tsconfig.tests.json` / `tsconfig.scripts.json` after the first merge | e07db2469 | rc 0 / 0 / 0 |
| tsc tests | 4d2528461, 2129754f3 | rc 0, rc 0 |
| builder, mobile, BEFORE (load ~7) | e07db2469 | 50 passed (234 s) - not reproduced at this load |
| builder, desktop + mobile, after | 4d2528461 | 59 passed, 41 skipped (desktop sizes on the phone), 149 s |
| Node stubs BEFORE: furnmerge, level3, real, video-sub-fallback, one worker | e07db2469 | rc 1 at collection: `l.createTreeWalker is not a function` (reproduced) |
| Node stubs after (+ unit-i18n-core), one worker | 4d2528461 | 30 passed |
| tickets-costs, desktop + mobile, `--repeat-each=3` | 4d2528461 | 42 passed |
| system-multimedia, desktop + mobile | 4d2528461 | 15 passed, 15 skipped (mobile) |
| automations-list, mobile | 4d2528461 | 12 passed, 37 skipped |
| realistic door test, desktop + tablet, `--repeat-each=3` | 4d2528461 | 6 passed |
| unit-plan-3d-realistic + look-r3, desktop | 4d2528461 | 7 passed, 1 skipped |
| wiskey-station-media + door-tech, desktop + mobile, `--repeat-each=2` | 2129754f3 | 124 passed |
| the ten `appReady` specs, all projects | 2129754f3 | 255 passed, 48 skipped |
| tickets-drawer / s4 layout guards, desktop + mobile | 2129754f3 | 76 passed, 56 skipped |
| public-ui5, desktop + mobile | d2c43dabf | 25 passed, 1 skipped, **2 failed** - both in tests this row did not touch (L273, L323, phone): `page.screenshot` "Protocol error (Page.captureScreenshot): Unable to capture screenshot" on a full-page capture; the four per-language tests passed |
| tickets, calmsg-polish-2331, schedules-list, calendars-settings-2310 (session-1 NOT_RUN items), desktop + mobile | d2c43dabf | 215 passed, 12 skipped, **1 failed**: schedules-list L679 (mobile) "schedule.manage without devices.read", `[data-sched-grid]` not found 5 s after the shell flag - not in any gate list; not analysed further (runner lost, see below) |

### NOT_RUN / open (session 2)

- The runner stopped answering SSH while the 2.47.0 release gate ran (coordinator: start nothing there). Already queued on the runner,
  each behind the gate-wait loop of `~/work/flaky-run.sh` (results land in `~/work/flaky-out/summary.txt`): bridge-key /
  session-me-failure / home-v3-followup-a / plan-editor-hot (desktop + mobile), automations-list + frigate-ui (desktop),
  design-foundation + frigate-ui (mobile), layout-tickets-map (desktop), then at the final head the three tsc projects,
  a11y-dialog-focus (all projects, x3) and home-v3-followup-a. Their results are NOT known to this note.
- Head 1ef374de8 on the PC (after the runner was lost): `tsc -p tsconfig.tests.json` (src + tests) rc 0 (1,573 s on the loaded PC), `tsc -p tsconfig.scripts.json` rc 0. The last train merge on top of it (092bbc9a1, the 2.47.0 rebuilt UI) changes nothing under `frontend/src` or `frontend/tests`, so the result stands for the pushed head. Spec lint `lint_spec_waits.py --new-since origin/release/2470-train`: 0 findings (no spec file added; the four new files are helpers).
- "Unable to capture screenshot" (Chromium refusing a capture: public-ui5 phone, and in the gate lists notice-tv-bustimes-295,
  evidence-audit30a-glass-bridge, design-foundation tesla dark, automations-list tablet) is a separate cause, not addressed here.
- Analysed, not changed: unit-plan3d-zoom L62 (the zoom never moved within the poll; cause not proven), unit-plan-3d-odd L164 (300 s
  test budget), wiskey-schedule-writes mobile L112 and wiskey-station-media every-skin (phone, load only; no race found),
  evidence-multibuilding-home-2330 (a fit finding, not a wait), audit30g-video / events-polish (failed in the 2.45.0 retry too, i.e.
  not flaky there, and absent from the 2.46.0 list).
- Product race found (not changed, test-only row): wk-door-tech shows a write's result before the read that follows it, so the hold
  delete button offers the old revision for that moment; a fast user would get a conflict. Recommendation: disable the hold actions
  while `load()` after a write is in flight (a visible change: needs the look rule's comparison first).
- Test count effect: about 110 phone-project duplicates of desktop-sized tests are now skipped (builder 41, automations-list 37,
  multimedia 15, plus the mixed size loops); the gate's preview count is far above its 0.7 drop threshold (23,070 against 14,971).

## Session 3 (23.11): main 619f94d04 merged; DOOR-TECH-REREAD (owner Q11) - a product change, the look rule applies

Owner Q11 ("the door technician screen's hold buttons and the read after a write") = fix it, after a comparison page. The comparison
page (private, not in git): `private/planning/door_tech_2480_compare_2026-11-23.html` (frames from `vite preview` builds of this branch
before / after the change, mocked backend with WisKey's compare-and-swap and the read after the write held; desktop 1440 and phone 390).

### Cause (`frontend/src/components/wk-door-tech.ts`, `execute`)

A write runs `running = key` (every write button locked, the dialog locked: one write at a time), then on the answer clears it and
runs `load()` - the READ of the view and of every door's hold draft - and, for a code, `loadCodes()`. Between the answer and the end
of that read the screen showed the state from BEFORE the write (the old schedule name; a code slot still "not set") with every button
open, and a button pressed then built its confirmation from that old state: a hold delete / edit carried the revision the write had just
replaced (WisKey: `revision_conflict`), a code form asked the wrong "current code" question. The session-2 recommendation (lock the hold
buttons while that read is out) would have fixed the revision but added a visible lock after every write.

### Fix (no lock, no stale write)

1. **The write's own answer is drawn at once** (`applyAnswer`, pure readers `holdAfter` / `codeAfter` in `src/api/door-tech.ts`): an
   acknowledged hold save gives the door's new draft (its new revision and policy - WisKey's answer is the same projection as the hold
   read), an acknowledged delete gives "no draft", an acknowledged code write gives the slot's presence (WisKey's read-back; never a
   value). Anything else (refused / not sent / unknown / partial / an odd shape) changes nothing until the read.
2. **A press while the read is out is kept, not locked** (`afterRead`): the button stays enabled (no `disabled` flip), shows `busy`
   (progress cursor, `aria-busy`), and its action runs once the read is in, against the fresh state - so the confirmation carries the
   fresh revision. Every write button goes through it (hold edit / delete / editor save, program apply / resume / pause / remove, code
   set / clear); a later press replaces an earlier kept one; switching tab or closing the dialog drops it. Nothing is sent without its
   confirmation, and `send()` still refuses while a write is out (two presses of "send" = one POST).
3. The editor closes on an acknowledged save in the same update as the new draft is drawn (no frame with the editor gone and the old
   list shown).

The idle look (no write in flight) is unchanged: the door-tech pixel baselines are not touched.

### Tests

- `tests/unit-wiskey-door-tech.spec.ts`: `holdAfter` / `codeAfter` - only an acknowledged answer is drawn; every other status and odd
  shape gives `undefined`.
- `tests/evidence-wiskey-door-tech.spec.ts`, two new tests (mock: `holdReads` holds every read of the dialog until released;
  `strictRevision` refuses a hold write with a stale revision like WisKey):
  - after an acknowledged save with the following read held: the new name is drawn, edit / delete are not disabled; a delete pressed
    then opens nothing and sends nothing (busy) until the read is released, then its confirmation; two clicks of "send" -> exactly one
    POST, revision 3 (the save's), never 2. A MutationObserver in the dialog's shadow root records every state of the hold buttons:
    between the save's "acknowledged" and the delete's own "sending" no hold button was ever `disabled` (a one-frame lock would be
    recorded).
  - a code write with the read held: the slot shows "set" at once; "clear" pressed then opens the clear form (with the current-code
    field) only after the read, one POST in all.
- The session-2 wait in the "hold-open schedule" test (the new name before the delete) stays; it is now satisfied from the answer.

### Proof (PC, `vite build` + `vite preview` of this branch before / after the change, `--workers=2`, retries 0, PC at ~100 % CPU)

| run | build | result |
|---|---|---|
| unit-wiskey-door-tech (Node) | 5efb30eb1 sources | 9 passed |
| evidence-wiskey-door-tech, desktop + mobile | after | 18 passed (4.6 min) |
| the two new DOOR-TECH-REREAD tests, desktop + mobile | before (a62523974) | 4 failed - they catch the race (old name drawn after the answer; the code slot still "not set") |
| comparison script, desktop + mobile | before / after | before: the delete pressed mid-read sent revision 2 -> `refused revision_conflict`; after: it waited for the read, sent revision 3 -> `acknowledged` |
| ESLint `wk-door-tech.ts`, `door-tech.ts` | - | 0 problems |

Runner: `~/work/chain5.sh 5efb30eb1` (each run under `flock ~/.smplwise-tests.lock`): door-tech evidence + pixel x3 (desktop +
mobile), the unit spec, then the chain3 / chain4 items that never ran (after-prev-b / -c / -d, layout-tickets-map, the three tsc
projects, a11y-dialog-focus x3). Results land in `~/work/flaky-out/summary.txt`; see the report of this session for what was in when
it ended.

### "Unable to capture screenshot" (owner Q29: its own row, not fixed here) - where it was seen

Chromium's `Page.captureScreenshot` refusing a capture ("Protocol error (Page.captureScreenshot): Unable to capture screenshot"), not a
wait or a race in the spec:

| where | spec / test | project | run |
|---|---|---|---|
| runner after-run `after-ui5` (d2c43dabf, 22.11) | evidence-public-ui5 L273 and L323 (full-page captures; tests this row did not touch) | mobile | `~/work/flaky-out/after-ui5.log` |
| 2.46.0 gate flaky list (`gate_release-2460-train_8a8d6d63c`) | notice-tv-bustimes-295 | see the gate JSON | gate report |
| same | evidence-audit30a-glass-bridge | see the gate JSON | gate report |
| same | evidence-design-foundation (tesla dark) | see the gate JSON | gate report |
| same | evidence-automations-list | tablet | gate report |

Common thread seen so far: full-page or tall captures under machine load. Suggested own row: count it per gate from the Playwright JSON
(error text match), try `scale: 'css'` / a capped clip on the full-page captures, and quarantine-with-expiry the specs that only fail so.
