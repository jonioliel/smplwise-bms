# CR-CMP2-TABLES-GENMAINT-2450

2.45.0 row, owner answer N10 (19.11: tables move to the shared components, screen by screen) for the GENERATOR and MAINTENANCE modules.
Continues `CR-CMP2-TABLES-2450` (read its note first: `sw-table` row / cell hooks, cell kinds, `bare`, `static-rows`, `--sw-table-min: 0`,
the empty slot).

Branch `pilot/CR-CMP2-TABLES-GENMAINT-2450`, base `origin/pilot/CR-CMP2-TABLES-2450` (86cae1832); `origin/release/2440-train` (a4302d1d3)
merged in at the end (the train moved; clean merge). One commit per screen, so the train can drop a part. Not touched: electricity / water
(`CR-CMP2-TABLES-CONSUMPTION-2450`), segmented controls, selects, search and other form fields (`CR-CMP2-SEGMENTED-*`: a moved screen's own
`.seg` / `<select>` stay as they were), `components/sw-table.ts` (the consumption branch extends it today - no second branch edits it),
`management/tasks.json`.

## 1. The measured pages find the rows of a sw-table (`components/page-fit.ts`, 4d84b107f)

The maintenance lists are sized to the screen (owner rule: no scrolling in control screens): `PageFit` measures the drawn rows
(`[data-fit-item]`) and splits them into pages. A `sw-table` draws its rows in its shadow root, where the region's `querySelectorAll` does
not reach. `PageFit` now walks the region's own items and, at a `sw-table`, that table's rows (the hook comes through `rowAttrs`), in
reading order; a row's section is the `<section>` around the table, so the head height a later page draws again is the table head. A region
without a `sw-table` (the multimedia screens, the emergency checklist) is unchanged.

## 2. Screens moved

| Screen | Commit | Notes |
|---|---|---|
| `maintenance/log-page.ts` (reminder log) | 5a03f76cf | event = shared tone chip (due soon warn, overdue / request failed bad, request info); the task link and the request chip link styled through `::part(task)` / `::part(request)`; `bare static-rows`; row hooks `data-fit-item`, `data-maint-log-row`, `data-event`; measured pages + pager unchanged |
| `maintenance/list-page.ts` (ledger / plans / rounds) | 3be277905 | state = shared tone chip (`data-maint-badge` kept); the row key is a shared `sw-button` (sm, primary for "continue") in the `actions` column; rows open the task through `row-select` (tab stop, Enter / Space, arrow walk - the hand-made `tabindex` / keydown are gone); row hooks `data-fit-item`, `data-maint-row`, `data-look`; cells wrap, figures / chips / keys do not |
| `generator/gen-alerts-page.ts` (alert history) | 8a2b1cfba | severity / open / pending = shared tone chips; rows open the drawer through `row-select` (they had a click only, no keyboard); row hook `data-alert`. `gen-styles.ts`: `sw-table[data-gen-table]` keeps the module header band (transparent in bubble), reading size, 12 px cells, `--sw-table-min: 0` |
| `generator/gen-log-page.ts` (run log) | a4252fb81 | kind = tone chip (`data-kind` kept), the signal line as `t2`; the page's 5 px block padding kept so `pageSizeFor` still fits 1024 x 768 with its pager; below 768 px hours / load / end step out (`hideBelow`, were `nth-child` rules); below 600 px one line per run (start + kind) over duration and fuel (the shared card template); row hook `data-run` |

The phone cards of the maintenance lists, the generator's active-alert cards and phone lists are unchanged (the tables are hidden there).

Breakpoints: the generator moves take the shared ones (768 / 1024). The maintenance list keeps the module's 1100 px edge for its supplier,
request and last-run columns (a `matchMedia` state that leaves those columns out of the table): with the shared 1024 px they stayed at
1024-1100 px, the names wrapped to three lines and 1024 x 768 held 4 rows instead of 5 (3 pages instead of 2; the ledger evidence expects 2).
`evidence-maintenance` "preventive plans" now asserts the request chip where the column is drawn (desktop): at 1024 px the old cell was hidden
by CSS and still counted.

## 3. Not moved (and why)

- `generator/gen-live-page.ts` phase table: a totals row (`tfoot`) and a load bar per phase (`.pbar`, the module's own classes and an inline
  width). `sw-table` gets a foot row in `CR-CMP2-TABLES-CONSUMPTION-2450` (`TableColumn.foot`); the bar needs a shared meter. Move it after
  that branch merges, so two branches never edit `sw-table.ts`.
- `generator/gen-routing.ts` (severity defaults + the alert-type matrix): the matrix has group band rows (`colspan`), a checkbox per row
  (the "on" switch) and the module's recipient / channel chips (`.rec`, `.ch`); `sw-table` has no band rows. Moving only the 3-row severity
  table would put two chip looks on one page, so the screen stays whole for now. Needs: band rows in `sw-table` (after the consumption
  branch), the row switch as `sw-toggle` (owner N12/N13), recipient / channel chips in the shared vocabulary.

## Tests actually run (workstation, Windows, Vite dev server of this worktree on its own port and cache, `--workers=1`)

The PC ran at 100 % CPU (other agents) for most of the afternoon; several timeouts below are load, each re-run alone.

- `npx tsc --noEmit -p tsconfig.json`: exit 0 after every screen (code head a4252fb81) and after the train merge (9422f8cee, see the end).
- ESLint on every touched source file (`page-fit`, `list-page`, `log-page`, `gen-alerts-page`, `gen-log-page`, `gen-styles`): 0 errors.
- `node scripts/unused-exports.mjs --enforce`: OK.
- Unit (`playwright.unit.config.ts`): `unit-noscroll-lists-2443` (updated: the row hooks and the PageFit shadow walk), `unit-poll-features`,
  `unit-dialog-toplayer-2381`, `unit-maintenance`, `unit-a11y-polished-lint`, `unit-a11y-rows-2443`, `unit-sw-table`,
  `unit-generator-home-widget`, `unit-infra-pages`, `unit-uxfix-rtl`, `unit-rtl-logical-2440`: 119 passed, 0 failed (at a4252fb81).
- `layout-maint-log-2443` (paged at 1366x768 and 1440x900: the panel clips, the page never scrolls, the pager moves; long lists set to
  scroll) + `evidence-maintenance`, desktop + tablet + mobile: 87 passed, 8 skipped, 1 failed - the plans request-chip assertion at 1024
  (corrected as above); that test alone, desktop + tablet: 2 passed. An earlier desktop + tablet pass (before the 1100 px edge) found the
  tablet ledger at 3 pages - fixed by the edge; re-measured at 1024 x 768: 5 rows on page 1, 2 pages.
- Generator pass 1 (`evidence-genalert`, `evidence-generator`, `evidence-genlog-092`, desktop + tablet + mobile; stopped by its own
  25 min limit at test 30 of 36): 21 passed, 9 failed. Passed: `evidence-genalert` (routing severity rows, not moved) on all three
  projects; `evidence-generator` "alerts: list, empty, detail with acknowledge, history filters" (the history table, its row opens the
  drawer) on desktop and tablet; `evidence-genlog-092` 3 of 3 on desktop and tablet (the page of runs and its pager fit the viewport).
  Failed: the multi-navigation tests (live, skins, charts, settings) by `page.goto` / `waitForSelector` timeouts under the PC load (none
  reached an assertion), and the killed one.
- Generator pass 2 (`-g "run log|alerts: list"`, all projects): 9 passed (`evidence-genlog-092` desktop + tablet + mobile), 3 failed - the
  alerts test timed out on `page.goto` / the first `waitForSelector` on each project (load; it had passed on desktop and tablet in pass 1).
- A probe on the same server: the history on desktop and mobile (the visible rows found, a row click opens the alert drawer) and the run
  log on desktop and mobile; screenshots looked at - desktop tables in the module band, the mobile run log one line per run.

## NOT_RUN

- Runner pass (targeted browser specs on Linux, desktop + mobile): the runner ran the 2.43.9 / 2.44.0 gates all afternoon and a new 2.44.0
  gate run was in progress at the end; the rule is gates first. To run there: `evidence-maintenance`, `layout-maint-log-2443`,
  `evidence-genlog-092`, `evidence-generator` (alerts + history), `evidence-genalert`, all projects.
- Pixel baselines: no pixel spec draws the moved screens (`visual-matrix`, `layout-audit30-e-infra` cover the generator live / charts pages
  only, unchanged here), so none were refreshed. NONE CHANGED as far as the specs go.
- `evidence-generator` live / skins / charts / settings tests and the alerts test on mobile: no clean pass on the PC (load timeouts).
- Full suites, the visual matrix, the entry check (`branch_check.sh`).

## Open questions (recommendation taken, for the owner's page)

1. Status chips in the moved tables take the shared tones (the maintenance solid badges and the generator `.sev` chips become the shared
   soft tone chips inside the tables; cards and drawers keep the module look). Recommendation: yes, one meaning per colour.
2. Breakpoints: the generator tables use the shared 768 / 1024; the maintenance list keeps its module edge 1100 px for its secondary columns,
   because the shared 1024 costs a row per page at 1024 x 768 (no-scroll rule). Keep the exception? Recommendation: yes, until the shared
   `hideBelow` gains a "narrow desktop" step.
3. Generator phase table and alert routing: move after `CR-CMP2-TABLES-CONSUMPTION-2450` merges (foot row; band rows added to `sw-table`
   there or in a follow-up), with the routing "on" checkbox as a small `sw-toggle`. Recommendation: one follow-up row.
