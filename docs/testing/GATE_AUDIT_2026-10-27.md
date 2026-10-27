# Gate audit 2026-10-27 (GATEAUDIT-297)

Owner request: the release gate keeps failing on old or irrelevant tests. This audit classifies every test that failed
or flaked repeatedly, removes the ones that are obsolete or duplicated, fixes the debt left by the bubble freeze, and
refreshes the gate's own reference data. Every removal is listed below with its evidence so the owner can review it.

Branch `pilot/GATEAUDIT-297` from `origin/main` = v2.23.2 (`1b0ddd85c`).

## 1. Data used

- 30 most recent gate reports on the test machine (`~/smplwise-results/gate_*.json`, 2026-10-19 .. 2026-10-26: integ/290..293,
  release/2100 .. release/2232, both gate-1 and gate-2 runs) plus the last 5 nightly full runs on `main`
  (`~/smplwise-results/nightly/gate_main_*.json`, 21.10 .. 27.10). 35 runs in total.
- The Playwright JSON reports of the 27.10 nightly (full tier L of 2.23.1 @ `011c97d4d`): per-file pass / skip counts and skip reasons.
- The selection file of the 2.23.2 gate (`gate_release-2232_698b517c7.selection.json`): which spec files the first post-freeze gate ran.
- The M074 visual report of the 2.23.2 gate (38 differences) with its expected / actual / diff images.
- `git log` of `frontend/tests` and `smplwise_vms/backend/tests` since 2026-10-13 (commits whose subject names a gate fix, a baseline or a flake).

"FAIL" below = failed and failed again alone (blocks the gate). "FLAKY" = failed in the full run, passed alone (does not block).
Counts are "runs out of 35 in which it happened".

## 2. Headline findings

1. **The nightly full run on `main` failed 5 nights out of 5.** Mostly stale pixel baselines that reached `main` because the
   release gates now run a diff selection (and only the mapped pixel specs): 21.10 baseline step; 23.10 preview 13 / pixel 3;
   25.10 pixel 28; 26.10 pixel 94; 27.10 pixel 25 (all `visual-matrix.spec.ts`) + dev 6 (`layout-bubble-screens`, `layout-schedules-parity`)
   and the budget ran out while re-running the 30-minute schedules sweep alone.
2. **The "38 non-blocking visual differences" were the same 38 in every gate since 2.21.1m (26.10 07:01)**: the visual-matrix
   Linux baselines were never re-taken after intended UI changes. All 38 reviewed (section 5): expected. Re-taken on this branch.
3. **The bubble-freeze debt the lead listed is already fixed on `main`** except cosmetic leftovers: `layout-schedules-parity.spec.ts:138`
   (bubble case: `skipIfFrozen`) and `:164` (product fix: 44 px pager keys) landed in `e3be6d5fe` (FIX2232B); the four
   `layout-access-*` specs take their skins from `access-control-mocks.ts`, which already reads `SKINS_UNDER_TEST`;
   `evidence-design-foundation.spec.ts:74` was a classic-skin pixel baseline, not a bubble problem (now removed, R1).
   The first post-freeze gate (2.23.2 gate 1) ran 108 of the 122 spec files that mention bubble; 14 were not run then
   (they are run on this branch, section 7).
4. **"Preview ran only 11 % of the baseline" is the diff selection, not the freeze**: a selection gate never checks the ratio
   (the report says `selection`). The baseline file itself was a week old (2.9.3: preview 11935 vs 15086 today) and is refreshed (F3).
5. FLAKY tests never block the gate (each failure is re-run alone). The recurring ones are timing tests on a loaded machine;
   several guard physical-command safety or latency requirements and stay (section 4).

## 3. Removed (owner review)

| # | Test | Evidence (>= 2 data points) | Why removal is safe |
|---|---|---|---|
| R1 | `evidence-design-foundation.spec.ts` - the four tests `classic is pixel-stable: home / map / settings / dialog` (desktop + mobile = 8 runs per gate) and their 16 baselines (`evidence-design-foundation.spec.ts-snapshots/`, win32 + linux) | FAIL in 9 of 35 runs (release 2.10.0, 2.15.0, 2.18.0, 2.20.1b, 2.21.1m, 2.23.0, 2.23.1, 2.23.2 gate 1, nightly 26.10), FLAKY in 5 more (2.9.2, 2.10.1, 2.16.0B x2, 2.23.1 gate 2). Every red was an intended change at the fold of the home or the settings shell; the fix each time was to re-take the PNG (e.g. `011c97d4d`, `e3be6d5fe`). | The tests were written on 2026-10-01 to prove the design-foundation refactor left classic pixel-identical "against the build BEFORE the foundation". Those baselines have been re-taken many times since, so they no longer test that. The same four views are covered by `visual-matrix.spec.ts` (M074): `devices-home ready` + `dialog`, `map-floor`, `settings-diagnostics`, classic, **light and dark, three viewports**, with a tolerance, and the gate runs it as its visual step. Zero-pixel tolerance on a full page also made `map` flake on font hinting. Not a security, permission, data-integrity, migration, contract or release_check test; MASTER_SPEC asks for UI screenshots, which the evidence matrix in the same spec still produces. |

Nothing else was removed. Candidates that were examined and **kept** are in section 4 with the reason.

## 4. Classification table

Status: REMOVE (done here) / FIX (done here or already on `main`) / KEEP. "Resolved by freeze" = the test now skips the frozen bubble
skin through `tests/helpers/frozen-skins.ts` (BUBBLE-FREEZE-295, on `main` since 2.23.2).

| Test (file:line) | FAIL | FLAKY | Cause | Class | Action |
|---|---|---|---|---|---|
| `evidence-design-foundation.spec.ts:74 / :96` classic pixel-stable x4 | 9 | 5 | zero-pixel duplicate of the visual matrix, baseline churn | **REMOVE** | R1 |
| `visual-matrix.spec.ts:120` (7 screens, 38 cases) | 3 nightlies | - | baselines not re-taken after intended changes since 2.21.1m; 38 warnings in 12 gates in a row | **FIX** | F1: 38 Linux baselines re-taken after review |
| `layout-schedules-parity.spec.ts:138` (bubble) | 3 | 1 | `?skin=bubble` draws domus, which does not carry the bubble 44 px contract | FIX | already on `main` (`e3be6d5fe`, `skipIfFrozen`) |
| `layout-schedules-parity.spec.ts:164` (4 skins) | 2 | - | real finding: 30 px pager keys at 390 px | KEEP | product fixed on `main` (`e3be6d5fe`) |
| `layout-bubble-screens.spec.ts:107`, `layout-bubble-lists.spec.ts:127`, `layout-material.spec.ts:97` | 4 | - | bubble skin | KEEP | resolved by freeze (whole-file `skipIfFrozen`); comes back on unfreeze |
| `layout-access-{events,schedules,status,s12}.spec.ts:74` bubble light / dark | 3 | - | bubble skin | KEEP | resolved by freeze (`SKINS` from `access-control-mocks.ts` = `SKINS_UNDER_TEST`); run on this branch (section 7) |
| `evidence-bubble-lists.spec.ts:81` | - | 15 | bubble skin | KEEP | resolved by freeze (whole-file skip) |
| `layout-wiskey-messaging.spec.ts:303`, `evidence-nvr-connection.spec.ts:687`, `layout-bv1-tiles.spec.ts:159` bubble cases | 2-3 | - | bubble skin | KEEP | resolved by freeze |
| 7 specs that named bubble in a URL / settings mock / evidence file name with skin-independent assertions: `evidence-tickets-handlers`, `-tickets-rfq2`, `-tickets-vendor-accounts`, `evidence-nn1-p2` (layout guard of the NN1 states), `evidence-home-quickcard-295`, `evidence-homeinfo-295`, `evidence-map-improvements` (live only) | - | - | the page silently drew domus while files and titles said bubble | **FIX** | F2: new helper `drawnSkin('bubble')` (= domus while frozen) |
| `pixel-access-{status,events,s12,schedules}.spec.ts` (5 skins) | 7 | 11 | intended UI changes without re-taken baselines; 5 skins x states multiply every change | KEEP | guard real screens of the access-control area. Proposal P1 |
| `pixel-wiskey-{people,people-writes,messaging,stations,station-media}.spec.ts` | 7 | 1 | same | KEEP | Proposal P1 |
| `pixel-nvr-encoding-batch.spec.ts:44 / :49` | 7 | - | same | KEEP | Proposal P1 |
| `unit-token-lint.spec.ts`, `unit-menu-lint.spec.ts`, `unit-lead-reserve.spec.ts`, `unit-date-format-module.spec.ts`, `unit-empty-state-icons.spec.ts`, `unit-uxfix-rtl.spec.ts:52`, `unit-brand-logo.spec.ts` | 2-5 each | - | each red was new code breaking a design / i18n rule, fixed in the code | KEEP | real rules, cheap, deterministic |
| `test_no_ip_literals.py` | 4 | - | new code or docs carried a private IP literal | KEEP | privacy / security guard (CLAUDE.md: lab addresses are private) |
| `test_db_gate.py::test_no_manual_transaction_control_outside_db_py` | 2 | - | new code opened its own transaction | KEEP | data integrity |
| `test_remote_access.py::test_every_route_needs_a_remote_session` | 2 | - | a new route without the remote-session dependency | KEEP | security |
| `evidence-security-r1.spec.ts:161 / :172`, `evidence-alarm.spec.ts:101`, `evidence-nvr-cameras.spec.ts:316` | 4 each | 0-1 | the security-area navigation changed (2.10 .. 2.16); spec updated each time | KEEP | permissions / RBAC visibility |
| `evidence-kavarnit.spec.ts:34`, `evidence-schedules-list.spec.ts:141 / :487`, `evidence-shell.spec.ts:104`, `evidence-tabs-styles.spec.ts:226` | 2-3 | 0-1 | the home tabs / shell were redesigned; specs followed | KEEP | they describe the current UI; no stale expectation left on `main` |
| `layout-bv1-tiles.spec.ts:86`, `layout-electricity-meters.spec.ts:78`, `layout-recorder-health.spec.ts:85`, `layout-visdiff-246.spec.ts:99` | 2-3 | - | real layout findings, fixed in the product | KEEP | layout guards |
| `evidence-nvr-cameras-batch.spec.ts:550` (300 cameras) | 1 | 10 | timing on a loaded machine | KEEP | non-blocking; candidate for a longer timeout (P3) |
| `test_f3a_doorwin_dw03_295.py::test_the_in_flight_cap_refuses_to_send_rather_than_queue` | - | 9 | timing | KEEP | physical-command safety (AGENTS.md: never queue physical commands) - never removed |
| `test_lat1_toggle_latency.py::test_toggle_reaches_ha_and_pushes_back_without_waiting` | - | 7 | wall-clock bound under load (2.23.2: dispatch median 143 ms against 128 ms allowed at load factor 1.28) | KEEP | latency requirement LAT1; P3 |
| `unit-plan-3d-realistic.spec.ts:117`, `unit-plan-3d-view.spec.ts:161` | 1 | 8 | frame timing on SwiftShader | KEEP | P3 |
| `evidence-uxfix-rtl.spec.ts:32 / :38 / :61` | - | 9 | text wrapping measured during font load | KEEP | P3 |
| `test_installation_capabilities.py::test_route_sweep[B/C/D]` | - | 9 | timing | KEEP | permission sweep (security) |
| `test_tickets_public_server.py::test_one_upload_in_flight_per_link_at_the_socket` | 1 | 4 | socket idle-timeout race | KEEP | public-surface abuse guard (security) |
| `test_messaging_accounts_api.py` / `_runtime.py` (5 tests) | - | 3 | timing | KEEP | P3 |
| 125 spec files that skip every test in the gate (`SW_LIVE=1` live / fixture specs, `guide-screenshots*`, `lookdev-studio6`, `perf-plan-3d`, `live-count-shots`; 3566 skipped results per nightly) | - | - | opt-in by design: they need a live or fixture backend | KEEP | they never make the gate red. Proposal P2 for the oldest ones |

## 5. The 38 non-blocking visual differences (2.23.2 gate, M074)

All 38 are on 7 screens and were identical in every gate since 2.21.1m; none is a defect. Reviewed on the diff images
(`gate_release-2232_1b0ddd85c.logs/visual/images/` on the test machine):

| Screen | Cases | Changed pixels | Cause (intended) |
|---|---|---|---|
| devices-home ready + dialog | 12 (3 viewports x light/dark x 2 states) | 2-4 % | home info cards / quick-actions card re-arranged (HOMEINFO, quick-card, 2.21-2.23) |
| devices-building ready | 6 | 3-5 % | same home widgets on the building screen |
| devices-schedules ready | 6 | 6-10 % | cards paged to the screen height (NOSCROLL-295, 2.21.x) and the pager |
| settings-diagnostics ready | 2 (desktop) | 1 % | new Settings rail entries |
| settings-notifications ready dark | 3 | 1-2 % | the selected severity segment colour in dark |
| multimedia-screens ready | 5 | 1-13 % | floor dropdown moved into the header row |
| live-wall ready | 4 (tablet, phone) | 1-18 % | quality and camera-count controls stacked on narrow widths |

Accepted with `node scripts/visual.mjs accept --screens devices-home,devices-building,devices-schedules,settings-diagnostics,settings-notifications,multimedia-screens,live-wall`
on the test machine (Playwright `--update-snapshots=changed`: exactly these 38 files changed).

## 6. Fixes and changes on this branch

| # | Change | Files |
|---|---|---|
| R1 | removed the four zero-pixel design-foundation tests and their 16 baselines | `frontend/tests/evidence-design-foundation.spec.ts`, `frontend/tests/evidence-design-foundation.spec.ts-snapshots/` (deleted) |
| F1 | re-took 38 visual-matrix Linux baselines | `frontend/tests/visual-matrix.spec.ts-snapshots/*-linux.png` |
| F2 | `drawnSkin(skin)` in the frozen-skin helper; 7 specs use it instead of a literal `bubble` | `frontend/tests/helpers/frozen-skins.ts` + the 7 specs in section 4 |
| F3 | tier-L baselines refreshed: preview 14935, dev 937, pixel 218, fixture 15, backend 17611 (from the 27.10 nightly full run, adjusted for the freeze and R1 / F1; arithmetic in the file's `source`) | `scripts/gate/gate_baselines.json` |
| F4 | the incomplete-run message names the real budget (`GATE_TOTAL_SECS`); the nightly said "90-minute" for a 225-minute budget | `scripts/gate/release_gate.py` |

`management/test_catalog.json` (AT-GATEAUDIT-1) and `management/tasks.json` (GATEAUDIT-297) record the task; the catalog lists
acceptance tests, not individual Playwright tests, so no catalog entry was removed.

## 7. Verification

All on the test machine, `pilot/GATEAUDIT-297`, while other agents' jobs ran there (load average 20-52). Not a release gate.

| Run | Commit | Mode | Result |
|---|---|---|---|
| `tsc --noEmit` | `27834e8ba` | - | ok |
| visual matrix `visual.mjs accept` (7 screens), then `run --all`, then 2 x `run` on the 7 screens | `27834e8ba` + new PNGs | dist preview | accept: 38 files changed; `run --all`: 72 pass / 0 differ / 0 error; repeats: 48 / 0, 48 / 0 |
| changed specs: evidence-design-foundation, evidence-tickets-handlers, -rfq2, -vendor-accounts, evidence-nn1-p2, evidence-home-quickcard-295, evidence-homeinfo-295, evidence-map-improvements, unit-bubble-freeze-295 (3 projects) | `a06719d44` | Vite dev server, 6 workers | 160 passed, 69 skipped, 11 failed - all 11 `page.goto` / settle timeouts in evidence-nn1-p2 and the evidence matrix of evidence-design-foundation at load average ~50 |
| the two specs with failures, again | `a06719d44` | dist preview (their gate mode), 2 workers | 89 passed, 13 skipped, 0 failed |
| the 14 bubble-related spec files the 2.23.2 gate did not run (section 2.3) | `a06719d44` | Vite dev server, 4 workers | 381 passed, 103 skipped, 2 failed (evidence-fleet-report:39 desktop + mobile, `page.goto` timeout at the dev server's cold start) |
| evidence-fleet-report, again | `a06719d44` | dist preview, 2 workers | 20 passed, 10 skipped, 0 failed |
| `python3 scripts/gate/selftest_gate.py` | `a06719d44` | fake suite | SELFTEST PASSED (41 OK, including "the shipped gate_baselines.json parses and has tier L") |

Skips are the specs' own documented rules (one project per sweep, live-only specs without `SW_LIVE`, the frozen bubble skin).
No backend test file was changed; the backend suite was not run.

## 8. Proposals for the owner (not done)

- **P1 - fewer skins in the pixel specs.** The 14 `pixel-*` specs take a baseline per skin (classic, domus, tesla, crystal; bubble
  frozen): one shared-component change breaks 4-5 baselines per state, which is most of the pixel reds above. Keeping classic in
  full and one other skin for the main state would cut the pixel baselines by about 60 % with little loss (layout guards already
  sweep every skin). Needs the owner's decision.
- **P2 - archive the historical live-only owner-round specs** (`evidence-owner-round1..11`, `evidence-form-round9`, about 110
  tests). They need a live backend and have not been run by the gate; they record September review rounds.
- **P3 - timing tests** (LAT1, 3D frame tests, the 300-camera list, RTL wrapping): run them in a low-load lane or widen their
  load factor. They do not block the gate today (FLAKY), so this is about noise, not about reds.
- **P4 - stale baselines on `main`**: a release that changes UI should run `visual.mjs run --touched` and accept the intended
  differences in the same release; the nightly then stays green.

## 9. What the lead should re-run in a targeted gate

- `visual-matrix.spec.ts` (pixel; or the gate's visual step: expect 72 / 0)
- `evidence-design-foundation.spec.ts` (now 0 pixel tests; classified preview), `evidence-nn1-p2.spec.ts`,
  `evidence-tickets-handlers.spec.ts`, `evidence-tickets-rfq2.spec.ts`, `evidence-tickets-vendor-accounts.spec.ts`,
  `evidence-home-quickcard-295.spec.ts`, `evidence-homeinfo-295.spec.ts`, `unit-bubble-freeze-295.spec.ts`
- `scripts/gate/selftest_gate.py`
- After the merge: the next nightly full tier L on `main` should be the first green one since 21.10 (barring FLAKY);
  its `baseline_candidate` replaces the estimated values in `scripts/gate/gate_baselines.json`.
