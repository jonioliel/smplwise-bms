# PRE-GATE-2360: runner checks before the 2.36.0 release gate

Branch `fix/PRE-GATE-2360`, cut from `origin/release/2360-train` @ 9fba7b164 (8 merged branches, see `RELEASE-2360-TRAIN.md`).
Goal: the 2.36.0 gate passes on its first run. No version bump, no merge into the train, no tag.

## How it was tested

The train does not contain the 2.34.2 / 2.35.0 gate fixes yet (the lead merges them before the gate). To test what the gate will
see, a throw-away branch `probe/PRE-GATE-2360-with2350` = this branch + `origin/release/2350-train` @ 908c2e142 (only conflict: the
generated `contracts/API_INVENTORY.md`, train side kept; it is not used by any browser spec). Every run below is on the runner
(`private/runner/run_smart.py`, `--workers=1`), all three projects unless named. Dev-server specs (`Needs the Vite dev server` /
`/src/` imports: the gate's `dev` class) ran on the `spec` job with the projects the gate gives them.

| # | Branch @ SHA | Job | Specs | Result |
|---|---|---|---|---|
| A | fix @ 9fba7b164 (= train tip) | preview | 25 specs: mapping assist, home screen (unit page specs), home / devices evidence, bv1 tiles, home polish, layout-a11y-295, presence (design, 2280 layout, settings), offbox backup, calendars settings / connect, no-scroll guards, settings nav, multibuilding home, home widgets wide, xsection synoptic, a11y polished / dialog focus, visual-matrix | 921: **405 passed, 44 failed, 472 skipped** (30.3 min) |
| P | probe @ a149cba12 | preview | the failing non-dev specs of A + the new GDrive spec | 303: **233 passed, 4 failed, 66 skipped** |
| D1 | probe @ a149cba12 | spec (vite dev), desktop | layout-bv1-tiles, evidence-bv1-tiles, evidence-presence-design-2300, layout-noscroll-297, layout-home-widgets-wide-298, layout-widgets-break-297, evidence-switchui-295, layout-header-logo-295 | 61: **54 passed, 0 failed, 7 skipped** (8.5 min) |
| D2 | probe @ d25f652b4 | spec (vite dev), tablet + mobile | evidence-presence-design-2300 | 8: **8 passed** |
| B | probe @ d25f652b4 | preview | 36 specs of the touched screens: the new drawer + GDrive specs, area nav / hscroll / breakui, calendars grid-edit / manage / nav / views, elevators / generator home, home-295 family, shell, switch-light-dimmer, synoptic columns / ha / mobile, tree-unassigned, whoin, area popup edit, devices / worstcase / elevators layout guards, page background, overlay no-shift, perf-home-load, skin foundation smoke, tree collapse, polish 295 x2, uxrest states, entity-id scan | 984: **689 passed, 0 failed, 295 skipped** (37.5 min) |
| U | fix @ 1df74f462 (workstation) | unit | `playwright.unit.config.ts --workers=1 tests/unit-` | 3641: **3640 passed, 0 failed, 1 skipped**; `tsc --noEmit` 0 errors |

## Failures of run A and their causes

| Spec (projects) | Count | Cause | Fix |
|---|---|---|---|
| `visual-matrix` settings-diagnostics x6, devices-schedules dark (tablet, mobile), devices-home dialog (mobile x2), map-floor (mobile x2), security-alarm (mobile x2) | 14 | Exactly the baselines re-taken on 2.34.2 (`fix/GATE2342-PIXEL`), not on the train yet | None here: run P after the 2.35.0 merge, **75/75 passed** |
| `a11y-polished-2342` popover Escape (all) | 3 | Screens are lazy chunks since PERF-HOME-DEVICES-2342; `<sw-popover>` is not defined on the style guide without GATE2342-A | None here: on 2350-train (styleguide import + spec wait); run P 9/9 |
| `evidence-calendars-settings-2310` providers order (desktop, tablet) | 2 | Same lazy-chunk timing (read before the screen draws) | None here: GATE2342 spec wait on 2350-train; run P 85 passed |
| `evidence-xsection-synoptic` many floors (all) | 3 | Same (counted floor cards before the lazy screen landed) | None here: on 2350-train; run P 51 passed |
| `evidence-presence-design-2300` (all) | 12 | Harness: a dev-server spec run against the preview build (my run A) | None: D1 + D2 green on the dev server, as the gate runs it |
| `layout-home-widgets-wide-298`, `layout-bv1-tiles` (desktop) | 9 | Same (dev-server specs) | None: D1 green |
| `layout-a11y-295:112` tickets skeleton height (desktop only) | 1 | 0.136 vs 0.12 on desktop; also on the probe. The gate runs this spec on **mobile only** (`one project`, first header flag), where it passed; tickets are not touched by this train | Not fixed; noted for a separate tickets task |

Conclusion: no train regression in run A; every gate-relevant failure is closed by the 2.34.2 / 2.35.0 merge the lead does before
the gate.

## Found and fixed here

1. **Home edit drawer on a phone (product, HOME-EDIT-DRAWER):** runner screenshot at 390x844: the bottom sheet ended 8 px above the
   viewport edge, under the phone's bottom bar, which covered the drawer footer (save / cancel). The default
   `ui.mobile.hide_layout_editor=off` lets a phone enter edit mode, so this is reachable. Fix b6b4ec22f: below 768 px the sheet ends
   above `--sw-bottomnav-h` (+8 px + safe area), the pattern the toasts already use. Tablet / desktop unchanged.
   Regression test 1df74f462 (hit-test of both footer keys at every width). The runner re-run of the drawer spec after the fix is
   listed under NOT_RUN until the 2.35.0 gate frees the runner.
2. **New browser spec `offbox-gdrive-diagnose-2351.spec.ts`** (cf72b4886, fixed 167ee42b2): the "בדיקת חיבור Google" dialog against a
   mocked `POST .../gdrive/diagnose` (no Google contact): running status, summary, one row per check with the fix only under a row
   that is not ok, "בדיקה חוזרת" redraws, the dialog sends nothing but the diagnose call, the body does not scroll, a server error
   shows in words, Escape closes. Run B: 6/6 (2 tests x 3 projects). First version read `toBeVisible()` on the `sw-dialog` host,
   which has no box of its own (3 fails in run P), now reads its `open` attribute.
3. **New evidence spec `evidence-home-edit-drawer-2351.spec.ts`** (b0385bb1b, hit-test 1df74f462): the six widths of the
   HOME-EDIT-DRAWER doc (1920 / 1440 / 1280 side drawer, 1180 / 1024 / 390 bottom sheet), BV1 mocks, desktop project sweeps all
   widths: placement, footer inside the viewport and fixed while the body (the one scroll container) scrolls, no sideways scroll,
   Shift+Tab / Tab stay inside, Escape closes and focuses "הגדרות המסך". Screenshots go to the test output folder only (reviewed
   from run B; the 390 one showed finding 1). Run B: 1 passed (before the hit-test was added).
4. `frontend/tests/fixtures/fixture_specs.json`: `evidence-home-screen.spec.ts` added to the `devices` group with `"gate": false`, so
   the runner's fixture job can run it (it needs `devices_fake_ha.py`; it was in no list, so neither the gate nor the job ever ran
   it). The gate list is unchanged.

## Pixel baselines

None refreshed. `visual-matrix` is the only pixel spec over the touched screens (devices-home, devices-building, sites); on the probe
all 72 pictures matched the 2.34.2 baselines (75/75 with its guards): the drawer, the presence line and the xs widget are edit-mode
or off by default and do not reach the matrix states. No pixel baseline exists for the mapping settings page ("settings header
baselines" in the MAPPING-IMPROVE doc: none in the repository; `evidence-mapping-assist-2330` takes evidence screenshots only, 27/27
passed in run A). Rejected diffs: none.

Will move again (do not baseline yet): the drawer (closed drawer gives the width back, a coming setting), the area presence line
(anonymous count, quick pop-up), the outgoing-feeds screen (remote toggle). The drawer evidence spec checks only the open-drawer
geometry and keys, which those commits do not change.

## Observations (not fixed)

- At 1920 / 1440 in edit mode the widget card's edit controls (size segment, arrows) cover the lower rows of the "פעולות מהירות"
  card; edit-mode chrome, not the drawer.

## NOT_RUN

Held by the lead's instruction (the 2.35.0 gate has the runner; no new runner runs until it ends):
- Fixture job: `evidence-home-screen`, `evidence-home-polish`, `evidence-devices`, `evidence-presence-2280-layout`,
  `evidence-area-redesign`, `evidence-area-nav` (run A skipped them: they need `devices_fake_ha.py`). The gate runs none of them
  (`gate: false`), so they do not decide the gate.
- Re-run of `evidence-home-edit-drawer-2351` after fix b6b4ec22f.
- Full backend suite on the runner (the train doc's 445-test workstation subset is the latest backend result).
- Live structure refresh against the lab home system (MAPPING-IMPROVE) and a real Google connection (GDRIVE-READY): owner / lab only.
