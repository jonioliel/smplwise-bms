# CR-CMP2-GEN-REST-2460

2.46.0 row, owner answer N10 (19.11: tables move to the shared components, screen by screen): the two GENERATOR screens that
`CR-CMP2-TABLES-GENMAINT-2450` left out (its note, section 3) - the live phase table and the alert routing.

Branch `pilot/CR-CMP2-GEN-REST-2460`. Base `origin/pilot/CR-CMP2-TABLES-CONSUMPTION-2450` (69f589cd9, it has the `sw-table` foot row), then
`origin/pilot/CR-CMP2-TABLES-GENMAINT-2450` (eb580f6f2) merged in (clean, c66dbb1bb), then `origin/release/2440-train` (51da93753, clean,
25a4a1da9: it carries the 2x2 budget fix the unit run needed). Not touched: `sw-chip-choice` (`CR-CMP2-SEGMENTED-C-2450`; the routing keeps
its own chips), the module's segmented controls / selects / search fields, `shell/sw-app.ts`, `router.ts`, `management/tasks.json`.

## 1. Shared components (399759323)

| Addition | What it does |
|---|---|
| `sw-table` `groupHeading(row)` (opt-in) | a row for which it returns a heading is one band across every column: `<th scope="rowgroup" colspan=N>` opening its own `<tbody>` (the rows up to the next heading are its group). Its `rowAttrs` hooks apply (`tr[data-group]`); no pointer, no tab stop, never `row-select`; the arrow walk passes over it. The band: `--sw-table-group-bg` (surface-2), the heading ink, bold, `--sw-table-group-pad`; it never sticks. Parts `group-row`, `group`. Unset: one `<tbody>` exactly as before. |
| `sw-table` `keep-columns` (opt-in) | a small grid of figures keeps its columns on a phone (no card stack below 768 px); `hideBelow` columns stay out there, their foot cells too |
| `table-logic` `groupSegments` | the DOM-free split of the rows at their headings (node unit spec) |
| `sw-load-bar` (new) | a thin meter for a capacity in use (`role="meter"`, `label`, `value-text`, the percentage by default): the accent, the warning ink above `warn-above`, the danger ink above `bad-above` (strictly above, as the old `.pbar`). The fill grows from the reading start (right in Hebrew) on the compositor (`scaleX`, 200 ms ease-out on change), stands still under reduced motion. Knobs `--sw-load-bar-h` (6 px), `--sw-load-bar-min` (70 px). Tokens only; the host reflects `data-tone`. Logic in `load-bar-logic.ts`. No shared meter existed (the water share bar is a module part). |

Specimen (`pixel-sw-table`): the focusable table has a group heading row between its first row and the next two; the behaviour test checks
the hook, `colspan`, `scope`, two `<tbody>`, no tab stop, a click on it picks nothing, ArrowDown walks over it.

## 2. Screens moved (2d50b88bd)

| Screen | Notes |
|---|---|
| `generator/gen-live-page.ts` phase table | `sw-table bare static-rows keep-columns data-gen-table data-gen-phase` in the phases card: phase (`t1`), voltage / current / power (`num`), load = `sw-load-bar` (warn > 80 %, bad > 90 %; steps out on a phone as before: `hideBelow: 'phone'`); a three-phase set's totals are the foot row. Row hook `data-phase` (`L1`... / `gen`). The average voltage in the foot is a `<bdi>` (inside the number isolate it read "231 ממוצע V"). Frequency and power factor beside the title now have " · " between them (they ran together). Stopped engine: dashes and empty bars, as before. |
| `generator/gen-routing.ts` severity defaults | `sw-table` with a header row (severity / recipients / channels; the old table had none); severity is the shared tone chip (critical bad, alert warn, info info - as the alert history); the critical note is a `t2` line; rows open the default through `row-select` (tab stop, Enter / Space, arrow walk). Row hook `data-severity-row`. |
| `generator/gen-routing.ts` alert-type matrix | `sw-table` with group heading rows (the old `tr.grp colspan`); the per-row "on" checkbox is a `sw-toggle` (`labelHidden`, named "פעיל: <type>", saves at once as before, its click never opens the row, `live()` binding so a failed save that reloads puts it back); severity = shared tone chip; the recipient / channel chips keep the module look (`.rec` / `.ch`: classes for the phone list and drawers, parts `rec`, `rec-item`, `rec-item usr`, `chs`, `ch`, `ch on` for the table); an off type is dimmed (part `off`, not the switch); a type without its sensor is muted with "needs <sensor>" under its name (was a `colspan` chip) and a disabled switch. Row hooks `data-type`, `data-na`, `data-off`, `data-group`. The phone list is unchanged. |

`gen-styles.ts`: the `.pbar`, `table.phase` and `table.routing` rules are gone; the phase table's padding (8 px rows from 1101 px, 8 px
sides on a phone) through `--sw-table-cell-pad`. Spec change: `evidence-generator` `gen-routing tr.na` -> `tr[data-na]` (a class does not
pass `rowAttrs`; the selector already had the phone-list alternative). Every other spec selector is unchanged and found through row hooks.

Owner rule (no scrolling in control screens): the live page passed `layout-noscroll-1366 -g generator` (1366x768, 1440x900, lists paged
and set to scroll) after the move, on the PC and on the runner (below).

## Tests actually run

Workstation (Windows), Vite dev server of this worktree on its own port and its own dependency cache, `--workers=1`:

- `npx tsc --noEmit -p tsconfig.json`: exit 0; `-p tsconfig.tests.json`: exit 0 (at the code head 2d50b88bd's content).
- ESLint on the 7 touched source files: 0 errors, 0 warnings. `node scripts/unused-exports.mjs --enforce`: first run FAIL (two new
  file-local types `LoadTone`, `RowSegment`) - export dropped; rerun OK.
- Unit (`playwright.unit.config.ts`), the 23 specs that read the touched files (`unit-sw-table`, `unit-a11y-*`, `unit-noscroll-lists-2443`,
  `unit-generator*`, `unit-infra-pages`, `unit-poll-features`, `unit-uxfix-rtl`, `unit-rtl-logical-2440`, `unit-polish*`, ...): 223 passed,
  2 failed - my own new keep-columns regex (fixed; `unit-sw-table` then 23 / 23) and `unit-noscroll-lists-2443` "06:PLAY-2 2x2" (not this
  row: fixed on the train by 6261bc7c4; after the train merge 3 / 3 passed).
- Browser, dev server: `evidence-genalert` + `layout-noscroll-1366 -g generator` (desktop): 5 passed. `evidence-generator -g "live:|settings:"`
  (desktop + mobile): 10 passed. After the last fixes (foot bdi, title separator, keep-columns foot cell): `evidence-generator -g "live:
  capability"` + `pixel-sw-table` (desktop + mobile): 6 passed, 4 skipped (the specimen shots have no Windows baseline).
- Looked at (probe screenshots, desktop / tablet / mobile, light / dark): the phase card (the load bar fills from the right in Hebrew; the
  phone keeps the table without the load column - a first look found an empty fifth column from the bar's foot cell: fixed), the severity
  defaults, the matrix with its group bands and switches (all on: the knob on the "on" side in RTL, checked by computed transform).

## Runner (linux, own folder `~/work/genrest`, nice -n 19, `--workers=1`, no gate running)

Script `~/work/genrest-run1.sh 25a4a1da9` (log `~/work/genrest-run1.log`, results `~/work/genrest-out1/`), started 18:56 UTC with no gate
running; every step waits while `gate_status.json` says a gate runs.

- Build (`vite build`): OK (45 s).
- Pixel refresh, `--update-snapshots=changed`, `pixel-sw-table` + `layout-audit30-e-infra`, all projects: 43 passed, 44 skipped (no
  baseline for that project). Exactly the 7 expected images were rewritten (list below); looked at, old vs new.
- Pixel verify without `-u`, `--retries=1`: `pixel-sw-table`, `layout-audit30-e-infra`, and every other pixel spec that draws `sw-table`
  (`pixel-audit30g-video`, `pixel-access-events`, `pixel-access-schedules`, `pixel-events-windows-2443`, `pixel-wiskey-people-writes`,
  `pixel-wiskey-stations`, `pixel-wiskey-triage-2400`), all projects: **125 passed, 88 skipped, 0 failed, 0 flaky** - no other baseline moved
  (the `tbody` refactor and the opt-in additions change no existing table). Note: the `release/2450-train` gate started at 19:02 UTC while
  this step (started before it, `nice -n 19`, one worker) was running; it finished about 5 minutes into the gate.
- The generator browser specs (`evidence-generator`, `evidence-genalert`, `evidence-genlog-092`, all projects) and `layout-noscroll-1366
  -g generator` on the build: held until the 2.45.0 gate ended (gates first), then run: generator specs **36 passed, 0 failed, 0 flaky**
  (desktop + tablet + mobile); no-scroll guard (desktop, 1366x768 / 1440x900, paged and scrolling lists) **4 passed**. The script cleaned
  up (`dist`, `test-results`, the worktree checkout); done 22:07, disk 58 %.

Baselines refreshed (in the branch, from the runner, looked at):

- CHANGED `frontend/tests/layout-audit30-e-infra.spec.ts-snapshots/audit30e-generator-1440-desktop-linux.png` - the phase table is the
  shared table (header band, number cells at the reading end, the shared load bar, the foot row); the card's height is unchanged (the masks
  now sit on the figures instead of on the whole old number columns).
- CHANGED `frontend/tests/pixel-sw-table.spec.ts-snapshots/sw-table-{light,dark}-{desktop,tablet,mobile}-linux.png` (6) - the specimen's
  new group heading row (desktop: one band across the table above the selected row; mobile: a full-width band in the card stack).

## NOT_RUN

- Full unit / evidence / pixel suites, the visual matrix, the entry check (`branch_check.sh`) - not queued (gates first).
- Tablet project on the PC (the runner ran it).
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. Severity in the routing tables takes the shared tone chips (the module `.sev` chip stays on the phone list and drawers) - as the alert
   history did. Recommendation: yes, one meaning per colour.
2. The severity defaults table gains a header row (severity / recipients / channels; ~30 px). Recommendation: keep (the columns are named).
3. A type without its sensor is still a row that answers a click / Enter with nothing (sw-table makes every row of a `row-select` table a
   tab stop). Recommendation: the small `rowFocusable(row)` option already proposed by the consumption row (its question 4).
4. The routing chips stay module chips (parts). When `sw-chip-choice` (`CR-CMP2-SEGMENTED-C-2450`) merges, move the recipient / channel
   chips onto it in a follow-up row. Recommendation: yes, after that branch merges.
5. The switch keeps the shared 42 x 24 size (owner N13 allows smaller); the matrix rows are ~8 px taller than with the checkbox. A `size="sm"`
   for `sw-toggle` would be a shared change of its own. Recommendation: leave as is (settings screen, not a no-scroll control screen).
