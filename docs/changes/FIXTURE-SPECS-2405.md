# FIXTURE-SPECS-2405: the runner's fixture job green again (26 + 1 pre-existing failures triaged and fixed)

Branch `fix/FIXTURE-SPECS-2405` (worktree `C:\cloude\smplwise-fixt`), cut from `origin/main` = v2.40.4 (`eab715e53`). Not merged,
not bumped, not tagged. No runner gate file was edited (section 5 proposes the coverage change instead). No lab, Home Assistant or
device contact: every run below is the runner's fixture backend (`devices_fake_ha.py`, `arx_fake_ha.py`: the real backend, a fake
Home Assistant, `.test` hosts only).

## 1. The baseline run on main

`run_smart.py fixture main` (every group of `frontend/tests/fixtures/fixture_specs.json`), runner @ `eab715e53`, 2026-11-06:

| Group | Result |
|---|---|
| `devices` (camera-card, home-polish, area-redesign; desktop / tablet / mobile) | 39 passed, **1 failed** |
| `devices` (plan-package, curved-walls, curve-points, plan-glass, plan-glass-entity, floorstrip, hud-opaque-live, home-screen, area-nav; desktop / mobile) | 64 passed, **24 failed**, 2 did not run |
| `devices` (lat1-instant-toggle, devices, camsuggest-live; desktop) | 46 passed, **1 failed** |
| `hud_layout`, `hud_layout_b`, `devices_floor` (custom-roles, presence-2280-layout) | all passed (18, 6, 1, 30) |
| `arx` (second-factor, sessions) | 1 passed, **1 failed** |

The 26 failures of the `devices` group are the same 26 the 2.40.4 train reported (RELEASE-2404-TRAIN.md section 3); the train ran the
`devices` group only, so the `arx` failure is new to the list. `evidence-area-redesign.spec.ts:304` (the 27th on v2.40.3) passed here
and in every later run.

## 2. Per-spec cause and fix

Kind: **product** = the product is wrong, fixed with a regression test; **stale** = the spec (or its fixture) assumed something the
product deliberately changed, fixed in the spec with the reason. Line numbers are main's.

| # | Test | Projects | Failure on main | Kind | Cause | Fix |
|---|---|---|---|---|---|---|
| 1-16 | `evidence-hud-opaque-live.spec.ts:75` (2D plan, every skin x scheme) | desktop 8, mobile 8 | `circuit button classic/light/desktop: background rgba(255, 200, 87, 0.32) must have alpha 1` | **product** | `.circuits .circuit.on` painted `var(--sw-lit-soft)` alone (alpha 0.32 / 0.24 dark): a circuit switched on showed the plan through it, against the owner's opaque-HUD rule (2026-10-13). The static lint only scanned the registered rule `.circuits .circuit`, not its states. | `explore-floor-map.ts`: `background: linear-gradient(var(--sw-lit-soft), var(--sw-lit-soft)), var(--sw-menu-surface)` (the banner's existing pattern). Tests: `unit-menu-lint.spec.ts` new check "a state of a registered HUD panel keeps the opaque surface" (failed before the fix, passes after); `unit-hud-opaque.spec.ts` adds the heading / body ink on the lit tone over the surface (4.5:1, every skin x scheme). |
| 17 | `evidence-area-redesign.spec.ts:286` (a 30-device room fits 1440x900 / 1920x1080) | desktop | `tiles 1440x900: main 955/900` (sections: 937/900) | **product** | Owner decisions 2026-09-30 (the area redesign) and the owner's rule of 2026-10-24 (a control screen does not scroll). Since then the shell's sub-navigation row (מבט על / מפה סינופטית / קברניט) and the bolder cards (HOMEFABLE-297) made the owner's room 55 px (tiles) / 37 px (sections) taller than a 1440x900 page. The home screen has fit steps for exactly this; the area screen had none. | `devices-area.ts` gets the home screen's mechanism (`measureFit`, `FIT_MIN_WIDTH`, `scrollParentOf` from `devices-building.ts`): while the automatic layout makes the page area scroll on a desktop-width screen it packs one step tighter (`data-fit` 1, then 2: the air between and inside the cards, the security strip, the tiles and rows - same look, same content). Never on a phone, in the layout editor or on an owner-arranged grid. The spec itself is unchanged and is the regression test; runner shots at 1440 and 1920, both directions, checked by eye. |
| (17b) | found while triaging 17: the sections direction | desktop | (not asserted before) | **product** | Since "הדלק הכל" joined "כבה הכל" (ALLON, 2026-10-10) the two keys (about 176 px) ran out of the section's 110-140 px title column into its first tiles (visible in the 1440 shot). | `devices-area.ts`: the keys wrap inside the column in the sections direction. `evidence-area-redesign.spec.ts:286` now also asserts that no section's bulk keys overlap its tiles. |
| 18 | `evidence-home-screen.spec.ts:235` (cards view: the three directions fit) | desktop | `a cards 1440x900: nav 450/392` | stale | The page does not scroll; the floor tree does, inside itself. That is the product's own rule since HOME-295 (2026-10-26, `devices-building.ts`: on a wide screen the tree takes exactly the height left under the summary and scrolls inside its own panel), written after this spec (2026-09-30). | `scrolls(page, '.split > nav.tree')`: every other element must still have nothing to scroll; and the tree must carry the screen's cap and end inside the viewport. |
| 19 | `evidence-home-screen.spec.ts:850` (the personal screen) | desktop | `[data-home-personal-widget]`: expected 6, received 8 | stale | The agenda and the quick launcher joined the always-offered widgets (BV1, 2026-10-05). | Expects the 8 ids in order: clock, weather, shabbat, alarm, quick, media, agenda, launcher. |
| 20-21 | `evidence-home-screen.spec.ts:934` (the view choice in the user menu) | desktop, mobile | options `כרטיסים, אריחים, תוכנית` instead of two | stale | K88 (2026-10-05, owner Q2): the installation's default `plan.surfaces` includes `devices`, so the live plan is the third view of this screen. | Asserts `plan.surfaces` contains `devices` and the three options. |
| 22 | `evidence-home-screen.spec.ts:416` (phone edit mode) | mobile | test timeout; the click on the card's `[data-home-size="clock:l"]` was intercepted by `home-edit-panel` / the sheet header | stale | HOME-EDIT-DRAWER-2351 (2026-11-02): the edit panel is a non-modal bottom sheet over the lower half of a phone; the cards' own controls sit under it. | The spec does what a user does: closes the sheet (`[data-home-drawer-close]`), edits the card, reopens it from the edit bar's "הגדרות המסך" key, then switches the row and saves. |
| 23 | `evidence-home-screen.spec.ts:983` (phone: the first floor right under the summary) | mobile | `gap 95 > 40` | stale | HOME295 (2026-10-26): the phone's floor switch (tree key + floor segments) is the row between the summary tiles and the floors, and the home's header is the title alone (no subtitle). | Measures the switch (starts one gap under the tiles, one row high) and the first floor's block one gap under it; the refresh icon against the title's line. |
| 24 | `evidence-plan-glass-entity.spec.ts:173` (3D: the open-panel marker in the glTF) | desktop | `sw-plan-3d[data-floor-3d]` not found | stale | `toBeEnabled()` does not read the `disabled` attribute of the `<sw-button>` 3D toggle, so it passed at once and the click landed while the 3D view was still loading (the toggle is disabled then). | Waits for the attribute itself, as `evidence-plan-glass.spec.ts` already does. |
| 25 | `evidence-plan-glass.spec.ts:138` (convert a wall to glass and back) | desktop | `[data-glazing-inspector="sw-inner"]` not found after the click | stale | The element screenshot of the studio panel (now taller than the viewport: version and structure history, floor picture) scrolls the page; the next `clickPlan` computed its point from the canvas box and clicked above the viewport. Runner shots before / after the click confirmed it. | `clickPlan` brings the canvas back to the top of the view when the point is outside the viewport. |
| 26 | `evidence-devices.spec.ts:2359` (empty domains are not shown) | desktop | `tree.building.media`: expected 0, received 1 | stale | The `devices` group shares one fixture backend: the media players of `evidence-area-redesign` (`media_player.ar2_tv`) and `evidence-home-screen` (`media_player.home1_tv`) were still enabled and counted. The spec passes alone. | Before asserting "no media players", the spec disables every media player the backend knows (its own and the leftovers). |
| 27 | `evidence-arx-sessions.spec.ts:59` (arx group) | desktop | `sw-app` not visible; the sign-in page said "יותר מדי ניסיונות כניסה" | stale (fixture) | PUB-01 (2026-10-20): `CF-Connecting-IP` is believed only from a trusted proxy peer. The fake's browser contexts connect from loopback, so every spec's sign-ins shared ONE per-address bucket (10 a minute) and this spec, right after `evidence-arx-second-factor`, was refused. It passed when run alone (2.38.0). | `arx_fake_ha.py` plays the tunnel: loopback is added to the trusted proxies of this fake only (in production cloudflared connects from the hassio network). The product rule is unchanged. |

Found in the branch's own full run (not on main's list):

| Test | Failure | Kind | Cause | Fix |
|---|---|---|---|---|
| `evidence-lat1-instant-toggle.spec.ts:108` | `route.fulfill: Route is already handled!` (run 1; passed on main) | stale (race) | The mocked action answer comes 600 ms late on purpose; the push now confirms well inside that, so the test unrouted while the handler slept and its late fulfill failed. | `page.unrouteAll({ behavior: 'wait' })` instead of the two `unroute` calls. |
| `evidence-home-screen.spec.ts:544` (edit mode: order by keys, drag, buttons) | after the drag the order read was the old one (run 2; passed on main, in run 1 and in every diagnostic run) | stale (race) | The band's order was read once, right after the key / the drop / the button; the reorder re-renders the band. Run 2 shared the runner with another job (load about 5). | The order is polled for up to 5 s after each reorder; a reorder that never happens still fails. |

Observed, not fixed (cause not established): `evidence-home-screen.spec.ts:632` (the weather widget follows a pushed state) failed twice
in the diagnostic runs that mixed it with other specs and projects (once at the 18 °C push, once at the "unavailable" push, both
20 s timeouts) and passed in the main run, in both full branch runs and in four timed diagnostic runs, where the push reached the
card in 0.2-0.8 s. Lead for a ticket: the `/ha/ws` handler blocks a default-executor thread per socket in `q.get(timeout=30)`, so a
burst of closed-but-not-yet-noticed sockets could delay a push by up to 30 s. Not proven; no code changed for it.

## 3. Commits

| Commit | What |
|---|---|
| af21ef6f8 | fix(maps): the lit circuit button keeps the opaque HUD surface + the two unit regressions |
| d14cd9c32 | fix(devices-area): the fit steps + the sections bulk keys + the overlap check in `evidence-area-redesign` |
| 179e8e455 | test(fixture): the stale specs (home-screen x6, devices, plan-glass, plan-glass-entity) and `arx_fake_ha.py` |
| c017ef3be | test(fixture): LAT1 waits for its delayed action mock |
| 15a6da5b2 | test(fixture): home edit mode polls the widget order after a reorder |
| (this doc) | docs(changes): FIXTURE-SPECS-2405 |

## 4. Verification

| Check | Where / SHA | Result |
|---|---|---|
| `run_smart.py fixture main` (every group) | runner @ eab715e53 | 26 + 1 failed (section 1) |
| Diagnostic runs (a scratch worktree on the runner, fixture_job.py under the shared lock; box dumps, shots and failure screenshots, never committed) | runner, branch tree | causes in section 2 confirmed |
| `run_smart.py fixture fix/FIXTURE-SPECS-2405`, run 1 | runner @ 179e8e455 | every group passed except `evidence-lat1-instant-toggle:108` (fixed in c017ef3be) |
| `run_smart.py fixture fix/FIXTURE-SPECS-2405`, run 2 | runner @ c017ef3be | every group passed except `evidence-home-screen:544` (one read right after a drag; fixed in 15a6da5b2) |
| `run_smart.py fixture fix/FIXTURE-SPECS-2405`, run 3 | runner @ 15a6da5b2 | **FIXTURE_PASS**: every group passed - devices 40 + 89 + 47 passed, 0 failed; hud_layout 18, hud_layout_b 6, devices_floor 1 + 30, arx 2 passed (skips are project-scoped) |
| Unit (explicit files): `unit-menu-lint`, `unit-hud-opaque`, `unit-a11y-polished-lint`, `unit-allon-turn-on`, `unit-area-presence-line-2351`, `unit-dark-polish-beds`, `unit-token-lint`, `unit-uxfix-rtl`, `unit-skincomp-297`, `unit-page-background`, `unit-empty-state-icons`, `unit-entity-id-sweep` | workstation | **87 passed** (`unit-menu-lint`'s new check failed before the HUD fix) |
| `tests/test_fixture_job.py` (the gate / job spec list) | workstation | 9 passed |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ 15a6da5b2 | exit 0 |
| `scripts/release_check.py` | workstation @ 15a6da5b2 | every item `[ok]`, RESULT: ready (2.40.4, tag v2.40.4 exists) |
| `impeccable detect` on the two touched screens | workstation | no findings |

NOT_RUN: the release gate, the full unit and backend suites, `build:addon`, pixel baselines. No pixel baseline covers the area screen
(`visual/matrix.json` has devices-home / devices-building / devices-schedules); the HUD fix changes the colour of a lit circuit button
on the floor map only (`evidence-hud-opaque-live` reads it; no pixel spec shoots a lit circuit). The fit steps change nothing on a
screen whose page area does not scroll.

## 5. Coverage proposal (not applied: runner gate files are the lead's)

Why these rotted: 13 of the 15 `devices` specs and both `arx` specs are `"gate": false`, and the nightly runs the gate engine
(`release_gate.py` tier L), which runs only the `"gate": true` fixture specs. So nothing ran them except a train that asked for the
job by hand. Timings from the branch's full run (runner, workers 1, build included): about 27 minutes for the whole job - devices
group 212 + 458 + about 260 s, `hud_layout` 283 s, `hud_layout_b` 99 s, `devices_floor` 33 s, `arx` 17 s.

1. **Nightly (recommended, first).** After the engine, `scripts/gate/nightly_tests.sh` runs the whole fixture job on the night's
   main checkout: `python3 scripts/fixture_job.py` (directly - the nightly already holds `~/.smplwise-tests.lock` exclusively, so
   not through `run_remote.sh fixture`, which would wait on its own lock), with what is left of `SW_NIGHTLY_MAX_MIN` (240) as the
   ceiling (`FIXTURE_GROUP_SECS` stays 1200 per group). The `FIXTURE_RESULT` lines and the failed test titles go into the night's
   `<date>_<branch>.md` under "## Fixture job (all specs)" and into `nightly_status.json`, so the dashboard shows a red fixture
   group the next morning. About 27 minutes on top of the ~160-minute nightly, inside the 240-minute limit. To install: edit
   `scripts/gate/nightly_tests.sh` and `scripts/gate/INSTALL_ON_RUNNER.md`, then copy to `~/nightly_tests.sh` in a quiet window
   (`gate_status.json` finished), as the install guide says.
2. **Gate promotion of the cheap, deterministic ones** (one flag each in `fixture_specs.json` + a line in
   `docs/operations/RUNNER_FIXTURE_JOB.md`, as the JSON's own comment requires): `evidence-arx-second-factor` and
   `evidence-arx-sessions` (17 s together, the remote-access sign-in path), `evidence-devices` (desktop, about 4 minutes; the area
   and building screens against the real backend), `evidence-hud-opaque-live` (desktop + mobile; the owner's opaque-HUD rule on the
   real floor map). The long ones (`evidence-home-screen`, the `hud_layout` pair, the 3D / glass plan specs) stay nightly-only.
3. **Diff selection in the gate** (`select_tests.py` / the gate's `--select-base`): when a branch touches `screens/devices-area.ts`,
   `screens/devices-building.ts`, `screens/home-*.ts`, `screens/explore-floor-map.ts`, `map/scene-builder.ts` or
   `screens/explore-plan-editor.ts`, select the matching fixture specs (area-redesign / area-nav / devices; home-screen /
   home-polish; hud-opaque-live / floorstrip / plan-glass*; plan-glass* / curved-walls) for that gate even when they are not
   `"gate": true`. This needs the engine to start the fixture backend for a selected `"gate": false` spec too.
4. **Train entry check:** a branch that touches those files runs `run_smart.py fixture <branch> <the matching specs>` before it
   boards a train (the owner's entry-check rule of 2026-10-30), and the train doc records the result (the 2.40.4 train did this for
   the `devices` group, which is how these 26 were seen).

Rollback: revert the branch's commits; nothing in the database, the settings or the gate files changes.
