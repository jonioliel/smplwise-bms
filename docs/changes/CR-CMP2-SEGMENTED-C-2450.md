# CR-CMP2-SEGMENTED-C-2450

2.45.0 row, continuation of `CR-CMP2-SEGMENTED-B-2450` (base of this branch: `origin/pilot/CR-CMP2-SEGMENTED-B-2450` at 3be9719d1,
not the train). Owner answers of 19.11: N10, N11 (`sw-segmented`), N12 (row switches and the home `.hsw` stay), N13. Not touched:
electricity / water screens (another row moves their tables), anything inside a table cell, `shell/sw-app.ts`, `router.ts`,
`management/tasks.json`. One commit per area, so the train can drop a part.

## 1. The component: rich keys (`components/sw-segmented.ts`)

- An option may carry `icon` (the screen's own template; the app's inline `svg.ic` glyph is styled inside the shadow root, an
  `sw-icon` sizes itself), `sub` (a second line), `badge` (+ `badgeAttrs`, its own data-* hooks) and `dimmed` (still choosable;
  the label dims, the second line takes the warning ink - the line says why).
- `labels="all" | "chosen" | "none"`: which icon keys show their label. An icon-only key is named by its label (`aria-label`) and
  takes it as its tooltip.
- `roving`: one Tab stop (the chosen key) and the arrow keys CHOOSE as they move (the radio rule); the host still confirms.
- `focus()` focuses the chosen key (else the first enabled one).
- Parts `key` / `key-on`, `icon` / `icon-on`, `label`, `sub`, `badge`; knobs `--sw-seg-axis` (stack the keys), `--sw-seg-key-axis`,
  `--sw-seg-key-justify`, `--sw-seg-key-align`, `--sw-seg-text-align`, `--sw-seg-sub-fg`, `--sw-seg-dim-fg`, `--sw-seg-dim-sub-fg`,
  `--sw-seg-badge-bg` / `-fg`, `--sw-seg-icon-size`, `--sw-seg-ico-pad`, `--sw-seg-wrap` (nowrap for a host that scrolls a strip
  sideways itself).
- `segmented-logic.ts` `segmentedTabStop` (pure, unit-tested). The pixel specimen gains icon / chosen-label / icon-only / badge /
  two-line rows and a behaviour test (icon-only names, the roving keyboard).

## 2. New: `components/sw-chip-choice.ts` (owner Q4 of the previous row, recommended option)

ONE choice drawn as separate chips (bordered pills with gaps, the chosen chip accent-filled) for the rows that only reused the `.seg`
class name. Same contract as sw-segmented (controlled `change { value }`, named group of `aria-pressed` buttons, arrows, data-*
hooks on the chips, 44 px on a coarse pointer, a wrapping row, `--sw-chipc-*` knobs). Adopted by door windows (rule source, kind,
holiday generator, open-for hours), the external access settings (activation + four settings) and the WisKey access diagnostics
filters (seven rows; the page keeps its square 44 px soft-accent chip through the knobs).

## 3. `sw-tabs` (owner Q5 of the previous row, recommended option)

An item's `attrs` (data-* hooks) go on its tab; `dot: 'warn'` + `dotLabel` draw a named warning dot. The phone provider strip of
`system-calendar-sync` (a tab strip that switches the card below) is `sw-tabs variant="pill"` now.

## 4. Groups moved (98 of the 118 hand-built groups the previous row left; 20 remain, listed in 5)

84 went to sw-segmented, 13 to sw-chip-choice, 1 to sw-tabs (counted as `class="seg"` occurrences, as the previous note did).

- Rich keys (the previous row's leftovers): tickets list view switch (`labels="chosen"`; the label hides by `::part(label)` on a
  phone / below 1280 px), RFQ compare sort (icon keys), RFQ vendor channels (icon-only), assignee kinds (two-line keys, a blocked
  group `dimmed`, rows on a 560 px phone through the axis knobs), tickets handlers' segments (`roving`), the access request dialog
  (who / days mode / credential with icons / code mode), the nav size presets (`badge` "current" with `data-nav-current`) and target.
- Glass state strips: tickets board pane + state strip (three a line in the phone sheet), list scope (invisible placeholder count
  while loading, as before), RFQ state strip (two a line on a phone), overview period; devices automations / schedules state
  filters (`data-open` fold kept, one sideways line on a phone) and their icon-only view switches.
- system-notifications (7), multimedia screens / players / edit panel / remote editor, media remote (audio output, pad type),
  notify-center filter, the WhatsApp section (2), investigate history map (3) and reviews, the schedule editor family (3), the
  scenario panel's and / or.
- Single groups: plan studio material style, infra report, insights range, presence map / list, devices tiles filter, devices
  notices boards, area quick sheet, incidents settings, elevator settings, station live quality, list display settings, cast
  picker, frigate config / auto profile, camera source dialog, the user menu's view choice (its Tab trap counts the group),
  WisKey people / events view switches.
- Home settings (only real one-of-N choices, N12): home-edit-panel (10), home-edit-bv1 (2), home-screen-options, the personal
  home panel (7; "default" is the empty value). The home `.hsw` and every row switch are untouched.

Every data-* hook stays (on the key through `attrs`, on the group on the element). Behaviour kept: a press reports, the screen
confirms by re-rendering `value`; "only when it differs" guards stay in the handlers. Groups named by `aria-labelledby` carry the
same words as `label`. Modules imported by the node unit tests (`tickets/list-view-switch.ts`, `screens/plan-studio6-panel.ts`,
`screens/home-edit-bv1.ts`) take only the type; their hosts register the element.

A scan of every host of a converted control for an ancestor `@change` listener (the composed `change` would reach it) found none.

## 5. Left (recorded, with the reason)

- Tab strips (`role="tablist"` + `aria-selected`, they switch panels): media-player-panel (library, zones), media-remote (remote /
  sources / apps), scenarios-panel (edit / runs), automation-editor-base, automation-ext-dialogs, plan-wizard, and the devices
  automations / schedules KIND strips. The kind strips are the recommended `sw-tabs` move, but their specs read the count as a
  `<small>` inside the tab and the phone row stretches the kinds to equal width - sw-tabs needs a count-pill and a fill option
  first (recommended as its own row).
- Home v3 operator screen (`home/sw-home.ts`, `home/home-p3.ts`): their segments are handled by a delegated `data-act` click handler
  on the parent; moving them means changing that handler - left for a home row. `screens/home-widgets.ts` (edit-mode size key):
  a unit spec pins its 44 px CSS - left with it.
- The personal summary-tiles row (a multi-choice), the overview department chips (a sideways-scrolling strip the page measures),
  the investigate events chip rows (sw-chip rows with icons and counts), the RFQ compare scope cell (a table cell),
  temperature WhatsApp vendor channels (inside a label with per-key reasons), `screens/meters-page-base.ts` and
  `electricity/elec-account-page.ts` (electricity / water - skipped today).
- `screens/devices-notices-css.ts` still holds dead `.seg button` rules (the screen's group moved) - a cleanup for a later row.

## Tests actually run (workstation, Windows)

- `npx tsc --noEmit -p tsconfig.json`: exit 0 after each batch and after the train merge; `-p tsconfig.tests.json`: exit 0 (batches 1, 2).
- ESLint on every touched file of batch 1 (component, chip-choice, tickets, access, nav size, notifications, devices, door windows,
  WisKey diagnostics, tests): 0 errors, 0 warnings. Batch 2 (helpers' files, home settings, sw-tabs): NOT_RUN - the eslint packages
  were only in a worktree another agent removed mid-session; the runner pass that would have run it was stopped (see below).
- Unit (`playwright.unit.config.ts`), every unit spec that reads a touched file + token lint, dark-polish beds, a11y lint, home lazy:
  batch 1, 62 files: 704 passed, 9 skipped, 0 failed (after moving the side-effect import out of `tickets/list-view-switch.ts`, which
  node specs import). Batch 2, 102 files: 1001 passed, 9 skipped, 0 failed (after the same fix for `screens/plan-studio6-panel.ts`).
- Browser specs on a Vite dev server on the PC (`--workers=1`, desktop project, no source edits during a pass):
  - pass A (25 files: tickets ui4 / table / calendar / handlers / create-assign / rfq2, grants3, maintenance picker, access request,
    shared identity, nav size, notifications, automations list, kavarnit, door windows x2, WisKey access diagnostics, home screen,
    tree-unassigned, calendars connect, menu kpi fit, a11y-295, pixel-sw-segmented behaviour, polish2 contrast, DARK-SEG-ALL):
    250 passed, 33 skipped, 3 failed. Two were `evidence-breakui-doorwin` waiting for `[data-dw-openfor] .seg` (spec updated to
    sw-chip-choice); one `evidence-doorwin-295` "English" heading (i18n timing, not this row). Re-run of both door-windows files:
    17 passed, 0 failed.
  - pass B (25 files: media screens / remote / players / admin list, history map, frigate ui / config, schedules editor, insights,
    incidents, elevators, cast, NVR-less cameras, station people, WisKey events / station media / people layout, presence, area
    popup, devices tiles x2, notify live, devices, home-295, automations builder): 343 passed, 89 skipped, 3 failed - elevators
    settings (the page had not rendered within 5 s) and media players (page.goto timeout): both passed on re-run; frigate review
    layout guard (16 page loads in a 60 s test): passed with `--timeout=300000` (1.6 min) - dev-server speed, not a defect.
- After the train merge: tsc exit 0; unit-sw-segmented + unit-dark-polish-beds 23 passed.
- Screens looked at: none beyond what the specs assert (no screenshots reviewed by eye this session).

## NOT_RUN

- Runner: the 2.44.0 gate ran all day; in the one gap (its first run had ended) I started `~/work/cmp2segc-run1.sh` (ESLint, build,
  the pixel files of the converted screens without `-u`), then saw the re-gate had started a minute earlier and stopped my job and
  removed its worktree. So NO pixel baselines were refreshed. Known stale: `pixel-sw-segmented` (the specimen gained five rows - its
  Linux baselines MUST be refreshed with `-u` and looked at before this row boards a train). Likely to move: `pixel-wiskey-access-diag`,
  `pixel-wiskey-people`, `pixel-access-events`, `pixel-audit30a-glass-bridge`, `pixel-home-fb-2431`, `pixel-home-gaps-2436`,
  `pixel-home-auditfix-2437`, `pixel-audit30g-video`, `pixel-events-windows-2443`, `pixel-frigate-f2b-2405`, `pixel-round4-leftovers-2390`,
  `visual-matrix`. The script (`~/work/cmp2segc-run1.sh` shape: check without `-u`, then `--update-snapshots=changed` for the files
  that failed) is the next step when `gate_status.json` shows no gate.
- ESLint of batch 2 (above); mobile / tablet projects of the evidence specs; the bubble-skin layout specs that list `.seg` in their
  selectors (tickets layout x9, camera / recorder health, ST7, bubble) - they walk shadow roots, so the component's track still
  matches, not verified; the entry check (`branch_check.sh`) - not queued.
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. The chip rows (door windows, external access settings, WisKey diagnostics) are now one shared `sw-chip-choice`; each page keeps
   its own chip (pill + accent fill, or the diagnostics' square soft-accent chip) through knobs. Unify them to one chip later?
   Recommendation: yes, the pill + accent fill, in one small row after the owner sees them side by side.
2. Tab strips drawn as segments: only the calendar sync providers moved to `sw-tabs` pill. The devices KIND strips (automations /
   schedules) need sw-tabs to show a count pill and to fill the phone row first. Do that as its own row? Recommendation: yes.
3. Home v3 operator screen segments (`home/sw-home.ts`, `home/home-p3.ts`) use a delegated `data-act` handler; moving them changes
   that handler and the home pixel set. Leave them for a home row? Recommendation: yes, a home row, with its baselines.
4. The new `labels="chosen"` icon switch (tickets list) shows the chosen view's name beside the icons on wide screens, as before.
   Keep? Recommendation: keep (unchanged behaviour).
5. The open-for hours chips now read in the page direction ("3 ש׳" right to left) instead of the forced left-to-right of the old
   `.num` class. Keep? Recommendation: keep (reads naturally in Hebrew).

## Release train 2.45.0, phase 1 - runner pass, one fix, baselines (RELEASE-2450-TRAIN agent, 19.11 evening)

Runner, own worktree `~/work/t2450-segc`, `nice -n 19`, preview build, `--workers=2`, no `-u`:

1. Check at e2dbca4f4, every spec file with a Linux baseline (51 files, all projects, `--retries=1`): 744 passed, 518 skipped (no
   baseline for that project), **52 failed**, all screenshot comparisons. Each diff looked at (expected / actual crops). All but one
   are the intended look of this row (and SEGMENTED-B / SELECTS under it): the specimen's five new rows, the shared key size, the
   chip rows on `sw-chip-choice` (the accent-bordered chosen chip with its tick), the selects in `sw-field` (intercom operations), the
   calendar month's view keys, 1-2 px shifts under a taller / shorter key.
2. **Unintended: `visual-matrix` devices-schedules at 1440 (light + dark)** - the state strip (all / active / paused / ...) was ~50 px
   wider than the glass `.seg` it replaced, because its counts became pills (18 px minimum, 5 px padding); the toolbar wrapped, the
   "new" key took a row of its own and the list showed one row less per page. Fixed in 3ccdd80c5: `sw-segmented` gains
   `--sw-seg-count-fs` / `--sw-seg-count-pad` / `--sw-seg-count-min-w` (defaults unchanged), `styles/media-glass.ts` sets the glass
   count back to a plain small figure, `styles/settings.ts` hands the three knobs back (`unset`). Workstation: `unit-sw-segmented` +
   `unit-dark-polish-beds` 23 passed, ESLint on the three files clean. After the fix the schedules desktop / tablet shots match their
   old baselines again (not refreshed).
3. Refresh at 3ccdd80c5: `--update-snapshots=changed` on the 9 failing files (206 passed, 70 skipped), only tracked baselines taken
   (no new file), every changed image looked at old vs new; then the same 9 files **without `-u`: 204 passed, 70 skipped, 2 flaky
   (visual-matrix security-alarm tablet, state-panels desktop: passed on retry), 0 failed**.

Baselines refreshed (56, all under `frontend/tests/`):

- `audit30-f-calendars.spec.ts-snapshots/`: `a30f-month-{classic,domus}-{1440-desktop,390-mobile}-linux.png`,
  `a30f-settings-{classic,domus}-{1440-desktop,390-mobile}-linux.png` (8)
- `evidence-audit30c-tickets.spec.ts-snapshots/audit30c-board-{light,dark}-{1440-desktop,390-mobile}-linux.png` (4)
- `evidence-intercom-ops.spec.ts-snapshots/intercom-ops-{operations,trend,error}-{1440-desktop,390-mobile}-linux.png` (6)
- `pixel-access-events.spec.ts-snapshots/`: `events-classic-{list,table,empty,error,stale,drawer,export,period}-1440-desktop-linux.png`,
  `events-domus-{list,drawer}-1440-desktop-linux.png` (10)
- `pixel-audit30a-glass-bridge.spec.ts-snapshots/tickets-board-dark-{desktop,tablet,mobile}-linux.png` (3)
- `pixel-frigate-f2b-2405.spec.ts-snapshots/frigate-f2b-{classic,domus}-profiles-{1440-desktop,390-mobile}-linux.png` (4)
- `pixel-sw-segmented.spec.ts-snapshots/sw-segmented-{light,dark}-{desktop,tablet,mobile}-linux.png` (6)
- `pixel-wiskey-access-diag.spec.ts-snapshots/`: `diag-scenario-answer-{1440-desktop,390-mobile}`, `diag-compare-people-1440-desktop`,
  `diag-reviews-list-1440-desktop`, `diag-review-dialog-{1440-desktop,390-mobile}`, `diag-lifecycle-1440-desktop` (`-linux.png`, 7)
- `visual-matrix.spec.ts-snapshots/`: `devices-schedules-ready-{light,dark}-mobile`, `multimedia-screens-ready-{light,dark}-{tablet,mobile}`,
  `settings-notifications-ready-{light,dark}-mobile` (`-linux.png`, 8)

Not changed although listed as likely: `pixel-wiskey-people`, `pixel-home-fb-2431`, `pixel-home-gaps-2436`, `pixel-home-auditfix-2437`,
`pixel-audit30g-video`, `pixel-events-windows-2443`, `pixel-round4-leftovers-2390` (all passed without `-u`).
