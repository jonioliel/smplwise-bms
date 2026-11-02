# GATE2342-PIXEL - the pixel side of the failed 2.34.2 release gate

Branch `fix/GATE2342-PIXEL` from `origin/release/2342-train` @ c9e03747c. Snapshot files and this document only; no source change.
Gate report: `gate_release-2342-train_c9e03747c` (runner `~/smplwise-results/`, logs `.logs/pw_pixel_*.json`).

## 1. Why pixel passed 82 of 175 (the count-drop hard failure)

Not a crash, not missing files, not a phase time limit. The 13 pixel spec files of the gate's pixel group all ran to the end
(`pw_pixel_0..12.json`: 158 test results, no worker or suite error):

| Result | Count | What it is |
|---|---|---|
| passed | 81 (+1 flaky = 82) | |
| failed | 51 (+1 quarantined, `pixel-wiskey-stations.spec.ts:87` desktop) | every one `toHaveScreenshot` "N pixels differ" against an existing baseline - no "snapshot doesn't exist", no size-only failure |
| skipped | 25 | 19 by design (`pixel-bustimes-295` mobile 10, `pixel-wall-plan` mobile 5, `pixel-walk-touch` 4); 6 stopped behind a failing test of a serial group (`pixel-wiskey-station-media` 4, `pixel-wiskey-stations` 1, `pixel-access-events` 1) - they passed in the gate's retries |

The 175 baseline counts the visual-matrix pixel cases, which a release gate runs in its separate visual step; the baseline note
(`scripts/gate/gate_baselines.json`) expects about 135 there. With the 52 real diffs fixed and the 6 serial skips running, the same
selection gives about 139 passes = 79 % of 175, above the 70 % line. The drop is entirely the baselines the 2.34.2 branches moved:
`--allow-count-drop` is NOT justified; the fix is the refreshed baselines below.

## 2. Refresh

Taken on the runner (Linux fonts) at c9e03747c: `run_smart.py preview fix/GATE2342-PIXEL <13 pixel specs> --project=desktop
--project=mobile --update-snapshots=changed --workers=1` (180 passed, 34 skipped, 89 files rewritten) and
`run_smart.py preview fix/GATE2342-PIXEL visual-matrix.spec.ts --project=desktop --project=tablet --project=mobile
--update-snapshots=changed --workers=1` (75 passed, 14 files rewritten - exactly the 14 "differs" of the gate's visual step).
Every changed file was reviewed old / new / diff (PIL, channel delta > 24 highlighted, bounding box of the change).

## 3. Review table

Reasons: **P44** = PHONE-BUTTONS-44-2342 (shared button drawn 44 px on a phone: dialog / sheet close buttons, icon buttons, retry and
footer buttons; content below them moves down 4-8 px). **NAV** = SMALL-UI-BUGS-2343 section 2 (the settings column no longer unfolds
the tabs of a screen with its own tab strip; the screen itself is marked). **DARK** = DARK-REVIEW-2342 (dark segment thumb
`--sw-seg-thumb`, the sw-tabs pill). **SYN** = SYNOPTIC-MOBILE-2342 (the "מפה סינופטית" view in the phone / tablet devices switch).
**OLD** = intended changes already shipped in 2.33.1 (bridge label "גשר Arx", tab-strip arrow buttons) that these baselines (last
taken in 2.27.0) never received.

| Spec | Shots (count) | Why it changed | Accepted |
|---|---|---|---|
| pixel-access-events | events-classic-error mobile (1) | P44: the retry button 40 -> 44 px | yes |
| pixel-access-s12 | s12-classic-audit-person desktop (1) | NAV: access-control sub-list gone from the settings column | yes |
| pixel-access-schedules | classic door, draft, empty, error, error-program, paused, sheet; domus door - mobile (8) | P44: the door picker and retry buttons 44 px, everything below moves down | yes |
| pixel-access-status | classic audit, busy, empty, groups, list, lower, muted, not-connected, policy, stale; domus list - desktop (11) | NAV only (change box inside the settings column) | yes |
| pixel-nvr-encoding-batch | classic / domus dialog-settings, dialog-preview - mobile (4) | P44: close and footer buttons; the preview dialog is 12 px taller (612 -> 624), nothing cut | yes |
| pixel-wiskey-messaging | msg-bulk-confirm, -form, -results, -running, msg-credential, -declined, -form, -quota, -sent, -uncertain, settings-classic-errors, tab-classic-dark, -light, tab-empty, -error, -optout - mobile (16) | P44 (close, footer, toolbar and row icon buttons); dark tab pill on the dark shot (DARK) | yes |
| pixel-wiskey-messaging | settings-classic, settings-classic-service-down, settings-domus, settings-classic-dark - desktop (4) | NAV; the dark one also DARK (the top sw-tabs pill) | yes |
| pixel-wiskey-people | cards, drawer-access, drawer-classic-dark, -light, list-classic-dark, -light, msg-bulk, msg-quota, msg-sent, msg-single, operator-drawer, operator-list, selection, state-empty, -error, -stale - mobile (16) | P44 ("הוספת אדם", the select / mail icon buttons, sheet close); DARK on the dark list. In `selection` the first (selected) row's sub-line is cut one word earlier because the mail button is wider - it was already ellipsised | yes |
| pixel-wiskey-people-writes | ask-reason, cards-classic-dark, -light, cards-remove-ask, delete-pending, drawer-result, editor-timing, menu-classic-dark, -light, not-sent, photo-ready, saved, unknown - mobile (13) | P44; OLD tab-strip arrows in the strip behind the sheet. `editor-timing`: the header subtitle now wraps to two lines next to the 44 px close button and the weekday checkboxes wrap 4 + 3 - nothing cut or overlapping | yes |
| pixel-wiskey-station-media | classic busy, drawer, drawer-dark, no-talk, talking, talking-dark; domus drawer, drawer-dark - mobile (8) | P44 (sheet close, talk / answer / reject buttons); DARK quality segment thumb on the dark shots | yes |
| pixel-wiskey-stations | classic announce, announce-sent, drawer, places, release, settings; domus drawer - mobile (7) | P44 (sheet header 8 px taller, footer and door buttons). `settings`: the sheet is identical apart from the 8 px; the page BEHIND the scrim sits at a different scroll (station toolbar instead of a camera picture) - see section 4 | yes (watch) |
| visual-matrix | settings-diagnostics ready light / dark - desktop, tablet, mobile (6) | OLD bridge label "גשר Arx" and tab-strip arrows; NAV (desktop column); phone: the stacked settings search row at its current width / 44 px (the same as the 2.33.1 pixel-access-status phone baselines); DARK top tabs pill | yes |
| visual-matrix | devices-home dialog light / dark - mobile (2) | P44 dialog close / footer buttons; SYN third view in the switch | yes |
| visual-matrix | devices-schedules ready dark - tablet, mobile (2) | DARK segment thumb + SYN "מפה סינופטית" segment | yes |
| visual-matrix | map-floor ready light / dark - mobile (2) | P44 (3D / layers / floor buttons, zoom column); the plan re-fits to the area left | yes |
| visual-matrix | security-alarm ready light / dark - mobile (2) | P44 (arm buttons, filter chips row, view switch) | yes |

Totals: 103 changed baselines reviewed, 103 accepted, 0 rejected. Not rewritten: `pixel-wiskey-stations` desktop `:87`
(it failed in the gate with 20,872 px under load and passes alone at workers 1 - a load drift, not a baseline change).

## 4. Possible regressions / things to watch

None of the diffs shows missing content, clipped text or overlap. Two notes:
- `frontend/tests/pixel-wiskey-stations.spec.ts-snapshots/stations-classic-settings-390-mobile-linux.png`: the page behind the
  sheet's scrim is at a different scroll than in the old baseline. The sheet is right; if this shot drifts again under load, the
  test should pin the page scroll before the sheet opens (owner of WKWATER-POLISH-2331-pixel).
- `pixel-wiskey-people-writes` `editor-timing` (two-line subtitle) and `pixel-wiskey-people` `selection` (one more word cut in the
  selected row) are consequences of the wider 44 px buttons, acceptable but visible.

May move again when the functional fixes of this round land (the lead re-runs the spec): settings-diagnostics (shell / settings
column), shots with the settings column (pixel-access-status, pixel-access-s12, pixel-wiskey-messaging desktop), devices-home /
devices-schedules (synoptic), map-floor (plan editor area), anything showing the shell avatar.

## 5. Quarantine (runner `~/gate2/gate2_quarantine.json`; the repo copy `scripts/gate/gate2_quarantine.json` has no entries)

| Entry | Ticket | Verdict |
|---|---|---|
| `vm settings-diagnostics ready` | NIGHTLY-VM-DIAG-2342 (expires 2026-11-05) | **Can be removed** once this branch is in the train (and, for the nightly, on main): all six settings-diagnostics cases (desktop / tablet / mobile x light / dark) pass with the refreshed baselines. |
| `pixel-wiskey-stations.spec.ts:87` | WKWATER-POLISH-2331-pixel (expires 2026-11-09) | **Keep.** Passes 1 / 1 at workers 1, but with `--repeat-each=4 --workers=4` the mobile case failed 1 of 4 (19,033 px, `stations-classic-settings-390`): the sheet is identical, the page BEHIND the scrim is at a different scroll (station toolbar vs a station's camera picture). A baseline cannot fix that; the spec needs to pin the page scroll before opening the sheet or mask the area above the sheet. The gate's desktop failure of the same test (20,872 px under load, passes alone) is most likely the same mechanism. |

## 6. Verification (runner, fc95f24b6, no `-u`)

- The 13 pixel specs + `visual-matrix.spec.ts`, projects desktop / tablet / mobile, workers 1: **264 passed, 0 failed, 132 skipped**
  (the pixel specs skip the tablet project; by-design skips as in the gate). No "snapshot doesn't exist".
- `pixel-wiskey-stations.spec.ts -g "list, table"` desktop + mobile, `--repeat-each=4 --workers=4`: 7 passed, 1 failed (mobile,
  the background drift above).
- NOT_RUN: a full gate; the functional fixes of the other agents are not in this branch.
