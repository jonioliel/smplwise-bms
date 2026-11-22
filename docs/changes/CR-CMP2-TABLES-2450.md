# CR-CMP2-TABLES-2450

2.45.0 row, the tables half of owner answer N10 (19.11: selects / drop-downs and tables move to the shared components, screen by
screen). Continues `CR-CMP2-SELECTS-2450`, whose note (section "Tables") found why no table had moved: a `sw-table` column's `render`
draws inside the table's shadow root, where the screens' cell classes (`.t1`, `.mut`, `.num`, chips) do not reach, and the screens'
specs find rows by per-row hooks (`tr[data-board=...]`) that `sw-table` did not set.

Branch `pilot/CR-CMP2-TABLES-2450`, base `origin/pilot/CR-CMP2-SELECTS-2450` (18911c376). One commit per screen, so the train can drop a
part. Not touched: segmented controls, selects and form fields (`CR-CMP2-SEGMENTED-B-2450` works on those today; a moved screen's
own `.seg` / `<select>` stay as they were), `shell/sw-app.ts`, `router.ts`, `management/tasks.json`.

## 1. `sw-table` grows what the hand-built tables need (c9841c054; the truncate fix 34e35acb2)

| Addition | What it does |
|---|---|
| `rowAttrs(row)` | `data-*` / `aria-*` / `title` attributes on each `<tr>` (one element directive; a hook a later render drops is removed - rows are reused by position). The row's own wiring (`class`, `tabindex`, `role`, `style`, events, `data-row-id`) cannot be overridden. Spec selectors such as `[data-board="x"]` keep working: Playwright's CSS reaches into the shadow root. |
| `TableColumn.cellAttrs(row)` | the same per cell (`td[data-reads-place]`) |
| `TableColumn.kind` | the shared cell vocabulary: `num` (tabular figures, the value its own LTR isolate, at the reading end, the header too), `muted`, `status` (holds a `.chip`, no wrap), `actions` (the row's buttons packed at the reading end), `truncate` (one line, ellipsis at `--sw-table-trunc`, default 260 px, cut on an inner block because a table cell ignores `max-inline-size`; the text is the cell's title). Plus `align` and `cellTitle`. |
| classes for a column's `render` | `t1` / `t2` (primary / secondary line), `mut`, `num`, `chip` with `data-tone` = `ok` / `warn` / `bad` / `info` (none = neutral; `data-nodot` drops the dot) - the R5 filled status field, tokens only |
| parts | `table`, `head-row`, `head`, `row`, `cell` + `cell-<kind>`, `empty` (`sw-table::part(cell-num)`) |
| `bare` | no card of its own (border, radius, shadow, background) - for a table that sits in a card |
| `static-rows` | a read-only list: no pointer, no press tint, no tab stops, never `row-select` |
| knobs | `--sw-table-min` (the table's minimum width, default 560 px: `0` for a table that must never be wider than its card - owner rule, no sideways scroll), `--sw-table-head-bg`; the existing `--sw-table-fs` / `--sw-table-cell-pad` |
| `slot="empty"` | a screen slots its own empty / loading line (its hook and copy); the default line otherwise |
| keyboard | focusable rows (a `row-select` listener or `focus-rows`): ArrowDown / ArrowUp / Home / End walk the rows (block keys: the same in Hebrew and English; no wrap; no motion), Enter / Space pick as before |
| RTL | the phone selected-row mark (inset stripe) sits on the row's start edge (right in Hebrew; it was on the left); in the phone card stack every cell starts at the reading start again |

A column with no `kind` / `align` keeps exactly the old classes: every existing table is unchanged on desktop. The DOM-free rules
live in `components/table-logic.ts`.

## 2. Screens moved (one commit each, simplest first)

| Screen | Commit | Notes |
|---|---|---|
| `notices/reads-sheet.ts` (who read a notice) | 9beecf94c | name `t1`, place `muted` (`td[data-reads-place]`), read time; `bare static-rows`, `--sw-table-min: 0` inside the dialog |
| `screens/system-fleet-report.ts` (send log) | 146e561b5 | the result is a status chip in its tone; the empty line is the slotted `[data-log-empty]`; the screen's own table / th / td / `.num` rules are gone |
| `screens/insights-waste.ts` | 3f0d526f5 | the card's header band through `--sw-table-head-bg`; device and time step out below 1024 px (`hideBelow: 'tablet'`; were `.hide-m` at 900 px) |
| `screens/investigate-incidents.ts` (recent incidents) | 35dd2ea8e | rows open the incident through `row-select`, so sw-table gives them the tab stop and Enter / Space (the hand-made `tabindex` + `activateKeydown` are gone); still hidden on a phone (the cards take over); taller rows / md size through the R5 size hooks |
| `temperature/log.ts` (alert log) | 3c0edc19d | severity and open / closed are shared tone chips (were the temperature palette `--tc-*`); value and duration step out below 768 px (were 700 px); loading / empty line slotted; row hooks `data-event` / `data-kind` / `data-sev` kept |
| `maintenance/tags-page.ts` (tags list) | 56787b868 | the revoke key is a shared `sw-button` (danger, sm) in the `actions` column - a screen's `.btn` does not reach the shadow root; `data-maint-revoke` kept; the phone cards unchanged |

Every moved table keeps its spec hooks (`data-*-row`, `data-*-table` - the latter now on the `sw-table` element). Looks move to the
shared table: the header is the quiet grey caption, cells 9 px / 14 px (or the screen's size hook), the shared chips.

Not moved yet (110 hand-built `<table>` elements remain): the electricity / water / generator / maintenance family shares one
`table.t` skin (`electricity/styles.ts`) and many of those pages size their page of rows to the viewport (no scrolling); moving them
changes row heights and wants a per-page layout check. Tables whose cells hold the screen's own buttons, selects or inputs (alarm
pairing, device type admin, plan area links, tou editor ...) need those controls to be shared components first (a native `<select>`
in a cell loses the screen's field look).

## Baselines refreshed (runner, linux, own folder `~/work/cmp2tables`, nice -n 19, `--workers=1`, no gate running)

- NEW `frontend/tests/pixel-sw-table.spec.ts-snapshots/sw-table-{light,dark}-{desktop,tablet,mobile}-linux.png` (6 images): written
  with `--update-snapshots=all` at bce9a359c, looked at (light desktop, dark tablet, dark mobile), verified without `-u`: 9 of 9 passed.
- CHANGED `frontend/tests/pixel-audit30g-video.spec.ts-snapshots/incidents-{classic,domus}-{light,dark}-1440-desktop-linux.png` (4
  images, the recent-incidents table): `--update-snapshots=changed` at 56787b868, looked at, verified without `-u` at 56787b868 and
  again at bce9a359c: 16 passed, 8 skipped (tablet) both times. The four 390 mobile shots did not change (the table is hidden there).
- Unchanged (verified without `-u` at 56787b868): every other pixel spec that draws `sw-table` - `pixel-access-events`,
  `pixel-access-schedules`, `pixel-events-windows-2443`, `pixel-wiskey-people-writes`, `pixel-wiskey-stations`,
  `pixel-wiskey-triage-2400`: 66 passed, 36 skipped (per-project), 0 failed. The RTL move of the phone selected-row mark changed none.

## Tests actually run

Workstation (Windows; Vite dev server of this worktree on its own port and its own dependency cache, `--workers=1`, desktop project):

- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.tests.json`: exit 0 at the code head bce9a359c (and before at 56787b868).
- At bce9a359c, the 12 unit specs that read the touched files (the lists below + `unit-events-table-2443`): 114 passed, 0 failed.
- `node scripts/unused-exports.mjs --enforce`: OK (the first run found 3 new file-local exports in `table-logic.ts` - fixed).
- ESLint on every touched source file: 0 errors, 0 warnings (test files are outside the ESLint config).
- Unit (`playwright.unit.config.ts`): `unit-sw-table` (new, 13), `unit-polish4-shared`, `unit-audit30b-shared`, `unit-uxfix-rtl`,
  `unit-polish-phone-297`, `unit-polish-classic-domus-297`, `unit-a11y-polished-lint`: 63 passed; `unit-a11y-rows-2443`,
  `unit-a11y-polished-lint`, `unit-fe-nits-2442`, `unit-rtl-logical-2440`, `unit-fleet-report`: 53 passed. 0 failed.
- Browser specs on the dev server, desktop: `pixel-sw-table` (behaviour; its shots skip on Windows), `evidence-noticepage-295`,
  `evidence-fleet-report`: 20 passed, 2 skipped, 1 failed - the fleet "four pages" test timed out under PC load (ten scene loads);
  alone: 1 passed. `evidence-insights`, `evidence-incidents`, `layout-incidents`, `evidence-incidents-entry`: 53 passed, 1 skipped.
  `evidence-temperature`, `evidence-maintenance`: 51 passed, 1 failed - `evidence-temperature` "phase 3" (the main temperature grid,
  `infra-temperature`, not the log) counted 2 of 4 groups before they loaded; alone it passed 4 / 4 both with and without this
  branch's log change.

Runner pass 1 (56787b868): build OK; the specimen (above); the incidents shots (above); the other sw-table pixel specs (above);
the browser specs of every moved screen, desktop + mobile (`evidence-noticepage-295`, `evidence-fleet-report`, `evidence-insights`,
`evidence-incidents`, `layout-incidents`, `evidence-incidents-entry`, `evidence-temperature`, `evidence-maintenance`,
`evidence-audit30b-shared`): 268 passed, 5 skipped, 1 failed - `evidence-maintenance` "the elevator card and the generator page carry
the certificates row" (not a moved table): `page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot`, a
run fault; the same test passed on the PC. The specimen behaviour test failed on the mobile project (it expected the reading-end
alignment of a number cell, which the phone stack resets to the start by design) - the test was corrected in bce9a359c and passed in
pass 2 (9 of 9, all three projects).

Runner pass 2 (bce9a359c, the truncate fix): build OK; specimen re-written and verified 9 / 9; incidents verified 16 passed.

## NOT_RUN

- Tablet project for the evidence specs (desktop + mobile ran).
- Full unit / evidence / pixel suites, the visual matrix, the entry check (`branch_check.sh`) - not queued (task rule: gates first).
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. Status chips in the moved tables take the shared tones (the temperature log's own alarm / warning palette is gone from its table).
   Keep the shared tones? Recommendation: yes (one meaning per colour across the product).
2. The insights waste table drops its device / time columns below 1024 px (was 900 px), the temperature log its value / duration below
   768 px (was 700 px): the shared breakpoints. Keep? Recommendation: yes.
3. The `table.t` family (electricity, water, generator, maintenance; ~40 tables): move it as one row with a per-page no-scroll check,
   or leave it on its shared module skin? Recommendation: one row per module, with the layout specs of each page.
