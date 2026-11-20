# CR-CMP2-POLISH-2470

2.47.0 row: the follow-ups the 2.46.0 component rows left open (CR-CMP2-TABS-2460 Q2, CR-CMP2-GEN-REST-2460 Q3 / Q4,
CR-CMP2-TABLES-CONSUMPTION-2450 Q4) and the polish2 contrast coverage the kind strips lost when they moved to `sw-tabs`.

Branch `pilot/CR-CMP2-POLISH-2470`. Base `origin/pilot/CR-CMP2-TABS-2460` (e46a04ceb), then `origin/pilot/CR-CMP2-GEN-REST-2460`
(e82b2798c) merged in at b1869dcef - one conflict, `generator/gen-log-page.ts` styles (TABS dropped the `.seg button` rule, GEN-REST moved
the runs to `sw-table`): both sides kept. Not touched: `management/tasks.json`, `shell/sw-app.ts`, `router.ts`, home v3, release branches.

## 1. `sw-table`: per-row reach (`rowFocusable`)

- `rowFocusable?: (row) => boolean` (opt-in). A row for which it returns false is a STILL row: no tab stop, no Enter / Space, left out of
  the arrow walk (it has no `tabindex="0"`), no pointer and no press tint, and a click fires no `row-select` (part `row still`, class
  `still`). Its `rowAttrs` hooks and its cells are unchanged (a control inside a cell stays a control). A row that answers the pointer
  but not the keyboard would be a pointer-only control, so "no tab stop" and "no click" go together.
- The rule is DOM-free in `table-logic.ts` `rowReach(row, tableTabs, staticRows, rowFocusable)` -> `{ live, tab }` (unit-tested);
  `static-rows` still wins over everything, the table's own no-tab-stop modes (no listener, `no-focus-rows`) still win for a live row.
- Applied: water alerts (`screens/water/page-alerts.ts`: a closed alert, `!r.closed_at`) and the generator alert-type matrix
  (`generator/gen-routing.ts`: a type without its sensor, `item.available`). Both hosts already ignored those rows in their handlers.

## 2. `sw-chip-choice` follows `ui.chip_selected` (`selected-look="setting"`)

- New attribute `selected-look`: `accent` (default - the accent-filled chosen chip and its `--sw-chipc-on-*` knobs, unchanged for every
  existing row) or `setting`: the chosen chip draws the shared fragments of `styles/chip-selected.ts` exactly as `sw-chip` does - in
  the default "strong" look the light accent field, the deeper accent ink, the accent ring and the check mark (`::before`,
  `chipSelectedCheck`); "soft" / "filled" / "dark" come through the `--sw-chip-on-*` knobs `design/css.ts` sets on `<html data-chip-on>`.
  Hover / press of the chosen chip take `chipSelectedHover` (hover gated to fine pointers, as before).
- The events centre's two rows (`screens/investigate-events.ts`, handling state and view) use it, so they follow the setting again as the
  `sw-chip` rows did before CR-CMP2-TABS-2460. Hooks unchanged.
- The other chip-choice rows (door windows, external access, WisKey diagnostics, the personal home tiles) keep the accent look: they were
  never `sw-chip` rows and never followed the setting (open question 1).

## 3. Generator routing choosers on `sw-chip-choice`

- The recipient (roles, users) and channel choosers of both routing drawers (severity default, alert type) were `<label>`-wrapped
  checkboxes in `.chooser` boxes. They are `sw-chip-choice multi` now (controlled: the press asks, the drawer's draft answers through the
  existing `toggle`), inside the same `.chooser` wrappers, which keep `data-roles` / `data-users` / `data-channels` and the users list's
  own scroll box (`.chooser.users`, the picker inside the drawer). Each row is a named group (`label` = the field's title).
- The module look through the chip knobs (`gen-styles.ts .chooser sw-chip-choice`): two columns of bordered boxes (one on a phone, via
  `::part(row)`), the module touch height (`--elec-touch`), `--sw-r-sm` corners, the module surface; the chosen box on the accent wash with
  an accent rim and the semibold label (the cue that is not a colour - the old checkbox mark is gone with the checkbox).
- The inbox is a disabled chip that is always on; a reserved channel is a disabled chip "<name> (בקרוב)" (was a grey "בקרוב" after it).
- The read-only recipient / channel chips in the two routing TABLES (`.rec` / `.ch`, parts) are not choices and stay status chips.
- Spec change: `evidence-genalert` clicks `[data-roles] button` / `[data-channels] button` (was `label`) - the hooks are the same, the
  element under them is the chip button now.

## 4. polish2 contrast coverage for the kind strips

`evidence-polish2-295` "dark scheme: the choice buttons are legible" found the devices kind strips through `.seg button`; since
CR-CMP2-TABS-2460 they are `sw-tabs.kinds` and were silently out of the measurement. The spec now walks into `sw-tabs.kinds` shadow roots
and measures each tab's key (`[role="tab"] > .lbl`): the label ink on the key 4.5:1, a chosen key 3:1 from the track, the track being the
strip row's `::before` (read with `getComputedStyle(row, '::before')`) composited over what the row sits on; chosen = `aria-selected`.
On the two devices screens a chosen kind tab must be among the measured choices (the coverage cannot silently drop again).

## 5. Also

- `styles/fragments.ts`: `segTrackStyles` removed - its last three users moved to `sw-segmented` in CR-CMP2-SEGMENTED-C-2450 and the
  orphan export failed `node scripts/unused-exports.mjs --enforce` on this tree.
- `evidence-genalert` (desktop) and `evidence-wkwater-2331` (desktop) assert the still rows in the real DOM: no `tabindex` on a sensorless
  type / a closed alert, `tabindex="0"` on the others.

## Tests actually run (workstation, Windows; Vite dev server of this worktree on its own port and dependency cache, `--workers=1`)

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (twice: after the code, after the fragments fix); `-p tsconfig.tests.json`: exit 0.
- ESLint on the 8 touched source files: 0 errors, 0 warnings.
- `node scripts/unused-exports.mjs --enforce`: first run FAIL (`segTrackStyles`, inherited from the base) - fixed (section 5); rerun: OK (no export outside the baseline).
- Unit (`playwright.unit.config.ts`): run 1 - `unit-sw-table`, `unit-sw-segmented`, `unit-sw-tabs-2460`, `unit-chip-selected-2439`,
  `unit-noscroll-lists-2443`, `unit-a11y-rows-2443`, `unit-a11y-polished-lint`, `unit-dark-polish-beds`, `unit-inv-events-2440`,
  `unit-events-table-2443`: 108 passed, 1 failed (`unit-sw-table` parts check still looked for the literal `part="row"`; updated to the
  new row template). Run 2 - `unit-sw-table`, `unit-audit30b-shared`, `unit-empty-state-icons`, `unit-no-ha-branding-2443`,
  `unit-polish4-shared`, `unit-poll-screens-b-2440`, `unit-uxfix-rtl`, `unit-designtokens-297`: 86 passed, 0 failed.
- Browser (dev server):
  - `evidence-polish2-295` + `evidence-genalert`, desktop + mobile: 16 passed, 2 failed - the first desktop test of each file on a cold
    dev server (`[data-auto-views]` / `[data-gen-routing]` not drawn within the timeout while Vite compiled the route); rerun desktop:
    9 passed, 0 failed. The kind strips are measured (automations, schedules; dark, desktop and mobile).
  - `evidence-genalert` (with the still-row check) + `evidence-wkwater-2331` (with the still-row check) + `evidence-kavarnit`, desktop +
    mobile: 47 passed, 2 skipped, 1 failed - `evidence-kavarnit` "old deep links" (the schedule editor chunk not loaded within 5 s on the
    dev server; schedules are not touched here); rerun alone: 1 passed.
  - `pixel-events-windows-2443`, desktop + mobile, `--update-snapshots=all` into throwaway win32 images to look at the API-mode events
    centre: 2 passed; the chosen chips show the strong selected look (field, ring, check) like the old sw-chip rows. Images deleted.
- Looked at by eye: the severity-default drawer (two columns of boxes, the chosen ones on the accent wash with the rim, the inbox on and
  disabled), the events centre's chip rows (API mode, 1440).

## Runner (linux, own worktree `~/work/polish2470`, `nice -n 19`, `--workers=1`, own TMPDIR)

The 2.45.0 gate held the runner while the code was written. Script `~/work/polish2470-run.sh f221cb60b` (log `~/work/polish2470-run.log`,
results `~/work/polish2470-out/summary.txt`) waits while a gate runs or is pending (`gate_status.json`, `~/.gate-pending`) and while the
TABS-2460 / GEN-REST-2460 waiting scripts run. It started at 22:55 UTC, after that gate had ended and those scripts were done (no gate ran
during it), and finished at 23:17:

- Build (`vite build`): OK.
- Pixel verify without `-u`, `--retries=1`, all projects, every spec this branch or its TABS-2460 base can move (`pixel-events-windows-2443`,
  `pixel-sw-tabs`, `pixel-sw-segmented`, `pixel-sw-table`, `pixel-plan-wizard-2433` / `-2434`, `evidence-audit30c-tickets`,
  `pixel-audit30a-glass-bridge`, `evidence-audit30b-shared`, `pixel-home-gaps-2436`, `layout-audit30-e-infra`, `pixel-access-events`,
  `pixel-wiskey-access-diag`, `pixel-audit30g-video`, `visual-matrix`): 289 passed, 110 skipped (no baseline for that project),
  **12 failed** - exactly the TABS-2460 set (its own runner check at e46a04ceb failed the same four files): events windows, plan wizard
  2433 / 2434, visual-matrix devices-schedules.
- Rewrite only those (`--last-failed --update-snapshots=changed`): 12 passed, 13 images.
- Verify again without `-u`: **301 passed, 110 skipped, 0 failed**.
- Behaviour on all projects (`evidence-polish2-295`, `evidence-genalert`, `evidence-kavarnit`): **69 passed, 0 failed** (the kind-strip
  contrast and the still-row DOM checks included).
- `pixel-sw-tabs` has no baseline yet (its tests skip without one). A follow-up to create them waited behind the next gate and was
  stopped by me; the four images come from the TABS-2460 runner pass (`~/work/tabs2460-out/take.tgz`: created at e46a04ceb, then
  verified twice, 8 passed) - the specimen draws only `sw-tabs` and the default `sw-chip-choice`, which this branch does not change.
- Clean-up: the worktree, `dist`, `test-results` and the temp folder are removed; outputs stay in `~/work/polish2470-out/`.

Baselines refreshed in this branch (all looked at, old vs new):

- CHANGED `frontend/tests/pixel-events-windows-2443.spec.ts-snapshots/events-windows-classic-{table-1440-desktop,drawer-1440-desktop,table-390-mobile}-linux.png`
  - the handling-state / view rows are `sw-chip-choice` (TABS-2460: pill chips, the count as a small pill; 44 px tall on the phone's coarse
  pointer, so the phone page is 32 px longer above the table) and the chosen chips take the installation's selected look again (field,
  ring, check - this row).
- CHANGED `frontend/tests/pixel-plan-wizard-2433.spec.ts-snapshots/wizard-step6-{1440-desktop,1024-tablet}-linux.png` and
  `frontend/tests/pixel-plan-wizard-2434.spec.ts-snapshots/wizard2-cameras-{1440-desktop,1024-tablet}-linux.png` - the devices / cameras
  strip is the `sw-tabs` pill with count pills (TABS-2460); the strip is 4 px shorter, the list below moves up.
- CHANGED `frontend/tests/visual-matrix.spec.ts-snapshots/devices-schedules-ready-{light,dark}-{desktop,tablet,mobile}-linux.png` (6) - the
  kind strip is `sw-tabs` (TABS-2460; on the phone it shares the toolbar row equally).
- NEW `frontend/tests/pixel-sw-tabs.spec.ts-snapshots/sw-tabs-{light,dark}-{desktop,mobile}-linux.png` (4) - the specimen of CR-CMP2-TABS-2460.

Not moved: the generator drawers and the water alerts are in no pixel spec; a still row looks the same at rest; every other spec above
matched its baseline.

## NOT_RUN

- Full unit / evidence / pixel suites; the entry check (`branch_check.sh`) - not queued (gates first); tablet on the PC.
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. Only the events centre's chip rows follow the selected-chip setting; the other `sw-chip-choice` rows (door windows, external access,
   WisKey diagnostics, personal home tiles) keep the accent-filled chip. Make the setting the default for every chip row?
   Recommendation: yes, but in the chip-unification row after the side-by-side comparison (CR-CMP2-SEGMENTED-C-2450 Q1) - it changes
   the look of four screens.
2. The generator routing choosers lost the checkbox square; the chosen state is the accent wash + rim + bold label. Keep, or use
   `selected-look="setting"` there too (adds the check mark, follows the setting)? Recommendation: keep the module look now, decide with
   question 1.
3. A still row (closed water alert, sensorless generator type) also ignores a mouse click now (it did nothing before either, but showed
   a pointer). Keep? Recommendation: keep - one rule for pointer and keyboard.
4. On a phone the events centre's chip rows are 44 px tall (sw-chip-choice's coarse-pointer target; the old sw-chip rows were 28 px), so
   the page is 32 px longer above the table (it scrolls on a phone as before). Keep? Recommendation: keep - 44 px touch targets.
