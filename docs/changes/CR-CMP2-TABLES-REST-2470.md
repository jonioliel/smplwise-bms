# CR-CMP2-TABLES-REST-2470

2.47.0 row, owner answer N10 (19.11: tables move to the shared components, screen by screen) with the 19.11 evening answers N21-N46
(shared status tones and shared 1024 / 768 breakpoints in tables; controls in cells move to shared components first). Continues
`CR-CMP2-TABLES-2450` (read its note first: `sw-table` row / cell hooks, cell kinds, `bare`, `static-rows`, `--sw-table-min: 0`, the empty
slot), `CR-CMP2-TABLES-CONSUMPTION-2450` (foot row, links in cells) and `CR-CMP2-TABLES-GENMAINT-2450`.

Branch `pilot/CR-CMP2-TABLES-REST-2470`, base `origin/release/2450-train` (521165ad4). One commit per screen, so the train can drop a part.

Scope: the remaining hand-built tables OUTSIDE electricity, water, generator, maintenance (done, or owned by `CR-CMP2-GEN-REST-2460`) and
home. Not touched: `components/sw-table.ts` and `components/table-logic.ts` (`CR-CMP2-GEN-REST-2460` extends them now - group heading
rows, `keep-columns`; no second branch edits them), segmented controls / selects / form fields, `shell/sw-app.ts`, `router.ts`,
`management/tasks.json`. Every move uses only what `sw-table` already offers on the base.

## 1. Inventory and order

The settings screens (`screens/system-*`) held the most hand-built tables (19 in 13 files), so they went first; then the shared
components of the intercom module (`wk-ops-charts`, `wk-installer-confirm`). Within the module: read-only tables first, then the ones
with keys in their cells (`sw-button` is already a shared component), never a table whose cells hold a screen's own select / input /
checkbox (rule: those controls become shared components first).

## 2. Screens moved

| Screen | Commit | Notes |
|---|---|---|
| announcements history (`system-announcements.ts`) | 78f6ffa9e | the table gains a header (4 titles in he / en / ru / ar); outcome = shared tone chip (spoken ok, failed bad, held back warn, on its way info); text cut at the old 280 px with its full text as the title; phone row template (< 600 px); row hooks `data-announce-row` / `data-status`; the spec counts the rows by the row hook (the header row is new) |
| schedules "who may do what" (`system-schedules.ts`) | 8d2e90eb3, 288a7ab86 | tick / dash through the `yes` / `no` parts; uses the shared `sw-table.set-matrix` (below) |
| presence registered devices (`system-presence.ts`) | 05dfbc063 | inside = shared tone chip; the sensors line truncated (220 px); never wider than the card (the old wrapper scrolled sideways); `data-presence-device` |
| intercom ops events report (`system-intercom-ops.ts`, 3 tables) | 875b8a714 | per station (figures), anomalies / methods (the two key / value tables gain a header from existing strings: the section title and "total"); `data-ev-stations` / `-anomalies` / `-methods` on the sw-table elements, rows `data-ev-station` / `-anomaly` / `-method` |
| wall users (`system-wall.ts`) | 8a18693bf | state keeps `sw-badge` (the cards use it too); overload warning through the `warn` part; cells wrap as before; the table / cards switch moves to the shared phone edge 768 px (was 721) and only one of them is drawn (matchMedia) - a hidden card's keys came first for a page query because the table's keys now sit in the table's shadow root; two specs follow the 767 px edge |
| notifications delivery log (`system-notifications.ts`) | 73d17a180 | outcome = shared tone chip (sent ok, failed / gone bad, the rest neutral); module frame + header band kept; notification and reason truncated; the channel pictogram is left out (the module svg icon is styled by the screen and does not reach the table); `data-log-row` / `data-log-status`, empty line slotted |
| automations "who may" (`system-automations.ts`) + `styles/settings.ts` | 288a7ab86 | `table.set-matrix` (shared settings look) becomes `sw-table.set-matrix`: base reading size, 10 / 8 px cells, never wider than the card, tick / dash parts; the device-test column marks its cells (`data-col-device-test`; the kavarnit spec checks a row cell instead of the header); `.yes` class kept as the spec hook |
| calendar permissions (`system-calendars.ts`) | e5d036cd2 | sensitive = shared warn chip; the approval table (a select per cell) stays |
| NVR notify matrix (`system-setup.ts`) | 4c920432b | motion mark = the tinted yes / no chip through `yn` / `yn-on` / `yn-off` parts; camera names wrap; `data-nvr-channel` rows, `data-nvr-motion` cell hook |
| intercom chart number twins (`components/wk-ops-charts.ts`, 2 tables) | b44d7a121 | day chart (day, granted, denied) and trend (sampled at, count); still visually hidden until "show as table" (screen readers read it always) |
| installer confirm diff (`components/wk-installer-confirm.ts`) | b508838d6 | changed row: new value in the heading ink; unchanged row quiet; `data-key` / `data-changed` row hooks |
| notice boards + a board's notices (`system-notices.ts`, 2 tables) | 0bcab48cb | boards open through `row-select` (tab stop, Enter / Space, arrows; the hand-made `tabindex` + `activateKeydown` are gone; the keys stop their own click); state chip in the shared tones in the table (the phone cards keep the module badge); severity chip info / warn / bad; `data-board`, `data-board-notice` + `data-look` |

Test support: `tests/unit-tables-rest-2470.spec.ts` (new): the moved screens draw `sw-table` and keep no other hand-built table (or exactly
the ones left on purpose), the shared tones in the moved status cells, the shared `sw-table.set-matrix`, the wall's single list.
`unit-a11y-rows-2443`: the notices boards row check follows sw-table (as the incidents row did in CR-CMP2-TABLES-2450).

`keep-columns` (0dcd29bdb): the role matrices and the intercom report / chart tables are small figure grids. They carry the
`keep-columns` attribute that `CR-CMP2-GEN-REST-2460` adds to `sw-table` (no label / value stack below 768 px). Until that branch lands the
attribute does nothing, so these grids stack on a phone. I looked at the schedules roles card at 390 px and it is a long stack. GEN-REST
targets 2.46.0, so the 2.47.0 train will have it. The 390 px shots of `evidence-intercom-ops` will then change again, and the train agent
refreshes them.

17 hand-built tables moved, in 12 screens / components (one commit each). 65 `<table` occurrences remain in `frontend/src` (inventory below).

## 3. Tests actually run

Workstation (Windows; the PC ran at 100 % CPU from other agents most of the night). Vite dev server of this worktree on its own port (5347)
with its own dependency cache, `--workers=1`:

- `npx tsc --noEmit -p tsconfig.json`: exit 0 after every batch, the last on the final tree. `-p tsconfig.tests.json`: exit 0 (final tree).
- ESLint (repo config, `--pass-on-unpruned-suppressions`) on all 17 touched source files: 0 errors, 0 warnings. A first run caught a
  backtick inside a `css` template comment; it was fixed before the commit.
- `node scripts/unused-exports.mjs --enforce`: OK.
- Unit (`playwright.unit.config.ts`): the 35 unit specs that read a touched file gave 325 passed, 1 failed. The failure was the regex in my
  own new guard (it matched `sw-table.set-matrix`); fixed. Then `unit-tables-rest-2470`, `unit-a11y-rows-2443`, `unit-board-answers-2400`,
  `unit-noticepage-295`, `unit-fe-nits-2442`: 47 passed. Final run of `unit-tables-rest-2470` + `unit-a11y-rows-2443` +
  `unit-settings-rows-2380`: 26 passed.
- Browser, desktop:
  - `evidence-announcements` + `evidence-schedules-list`: 41 passed, 1 failed (load). The failed test passed when run alone.
  - `evidence-wall`, `evidence-look-polish-2331`, `evidence-wall-followups-2390`, `evidence-notifications`, `evidence-presence-settings`,
    `evidence-intercom-ops`: 96 passed, 10 skipped, 2 failed. The logo card failure was load. The wall drawer key was a real defect: a hidden
    phone card came first for the page query. Fixed by drawing only one of table / cards.
  - After that fix, the wall specs + `evidence-kavarnit-ext` + `evidence-calendars-settings-2310` + the automations settings tests + the
    notifications delivery log: 72 passed, 18 skipped, 2 failed (automations, 5 s timeouts under load). Both passed when run alone.
- Browser, desktop + mobile:
  - `evidence-notices`, `evidence-board-mgmt-2381`, `evidence-wiskey-installer`, `evidence-intercom-ops`: 152 passed, 2 failed (the board
    copy key and the notices TV preview, both load). Both passed when run alone.
  - Final run: the `audit30-f-calendars` no-scroll sweep (desktop sizes, every calendar view and settings tab including permissions),
    `evidence-intercom-ops`, the schedules settings test and the automations settings test: 42 passed, 2 skipped.
- Looked at in screenshots:
  - the notifications delivery log: it showed the unsized module icon, which I fixed;
  - the wall list at 1024 px;
  - the automations, schedules and calendar-permission tables at 1440 px;
  - the schedules roles table at 390 px (the stack, see keep-columns).

Runner pass 1: `~/work/tablesrest-run1.sh 0979f9596`, own folder `~/work/tablesrest`, nice -n 19, `--workers=1`, waits while a gate runs.
It started at 01:25, after the 2.45.0 gate had finished, and the build was OK (16 s). The script then:

1. verifies every pixel spec that draws a moved table (all projects);
2. rewrites only the shots that differ (`--update-snapshots=changed`), in the specs that failed step 1;
3. verifies again;
4. runs the tablet project of the moved screens' evidence specs;
5. packs the changed images into `~/work/tablesrest-out1/snaps.tgz` (summary: `~/work/tablesrest-out1/summary.txt`).

Its results were NOT collected in this session (the usage stop); see NOT_RUN.

Baselines expected to change (the only Linux baselines that draw a moved table):

- `evidence-intercom-ops.spec.ts-snapshots/intercom-ops-events-tables-{1440-desktop,390-mobile}-linux.png`
- `evidence-wiskey-installer.spec.ts-snapshots/installer-{clock,technical}-confirm-box-{1440-desktop,390-mobile}-linux.png`
- possibly the wall drawer shots of `pixel-wall-followups-2390` / `pixel-wall-plan` (the list behind the drawer)

None are committed yet.

## NOT_RUN

- Runner pass 1 results. Next: collect `~/work/tablesrest-out1/summary.txt`, look at each image in `snaps.tgz`, commit them into this branch
  and list them here. Until then the pixel refresh is NOT DONE.
- The tablet project on the PC (it is part of the runner pass). The full unit / evidence / pixel suites, the visual matrix and the entry
  check (`branch_check.sh`) were not run.
- `system-setup` NVR matrix: no mocked spec draws it (its only spec is live-only, `SW_LIVE=1`). Typed and linted, not seen in a browser.
- `system-presence` devices table: the spec passed (texts, row hook), but I did not look at it in a screenshot.
- No lab / device test (UI only).

## 4. Remaining inventory (65 `<table` in `frontend/src`, by module)

Out of this row's scope, left to their owners: electricity 4 (`elec-bill-paper` 2 print, `elec-tou-editor` price inputs, `elec-chart`
transposed twin), water 1 (`page-bills` paper), generator 3 (`gen-routing` 2 and `gen-live-page`, owned by `CR-CMP2-GEN-REST-2460`), home 1
(`sw-home-admin`).

They stay hand-built: the print / PDF paths `insights/report-preview` 13, `temperature/report` 3 and `access-control/events-print` 1 (an
HTML string), and `components/sw-table.ts` 1 (the component itself).

Still to move: 38 tables in 27 files. What each needs first:

| Module | Tables | Notes |
|---|---|---|
| tickets | `tickets-overview` 4, `tickets-table` 2, `tickets/settings-sla` 1, `rfq-compare` 1, `rfq-board` 1, `system-tickets` 1 | `tickets-overview` is edited by `CR-CMP2-TABS-2460` (move it after that merges); `settings-sla` has an input + select per cell (controls first); the permission matrix puts a "sensitive" tag in its header (`sw-table` labels are text: needs a header template) |
| settings | `system-notifications` 2, `system-calendars` 1, `system-alarm` 1, `system-security-cameras` 1 | sources matrix: band rows (`groupHeading`, GEN-REST) + switch / segmented / select per row; quiet-hours checks (custom checkbox buttons); calendar approvals and alarm pairing: a select per cell; security cameras: sortable headers + edit column |
| intercom (WisKey) | `wiskey-visits-panel` 3, `wiskey-people` 1, `wiskey-message-dialog` 1 | visits: three header-less tables (new column titles in the misc catalogue); people: selection checkboxes + configurable columns; message results: has a caption |
| devices admin | `devices-type-admin`, `devices-protected-switches-admin`, `devices-climate-kind-admin`, `devices-notices` (1 each) | the admin ones hold selects / switches per row |
| insights | `insights-doors` 2, `insights-settings` 1 | read-only lists: the next easy batch |
| plan | `explore-plan-import` 2, `plan-area-links-admin` 1 | area links: selects per row |
| schedules | `schedule-table-view` 1, `schedule-editor` 1 | the table view is a week grid |
| other | `installer-platform`, `sw-csp-reports`, `scene-capture`, `calendars/view-manage` (1 each) | `installer-platform` has Linux baselines (the installer-platform shots) |

## Open questions (recommendation taken, for the owner's page)

1. Status chips in the moved tables use the shared tones (announcement outcome, delivery outcome, presence inside, notice board state,
   notice severity, calendar sensitive). Keep? Recommendation: yes (N21).
2. The wall list switches between table and cards at the shared 768 px edge (it was 721 px). Keep? Recommendation: yes (N21).
3. Small figure grids (role matrices, intercom report tables) keep their columns on a phone through GEN-REST's `keep-columns` once it lands;
   until then they stack. Recommendation: keep the attribute, no interim CSS.
4. The notifications delivery log drops its channel pictogram (text only). Keep? Recommendation: yes; a shared icon cell can come later.
5. Header-less key / value tables gain a header row in the shared table (announcement history: 4 new titles in 4 languages; intercom
   anomalies / methods: existing strings). Keep? Recommendation: yes.
6. Coordinator note of 20.11 about the home segmented look: it does not apply to this branch, which touches no home file and no segmented
   control.
