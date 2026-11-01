# SMALL-UI-BUGS-2343 - tickets table width, settings column duplication

Branch `fix/SMALL-UI-BUGS-2343` from `origin/release/2340-train`. No version bump, no API, data or settings change.
Sources: `docs/changes/TICKETS-POLISH-2331.md` "Left" (the table's horizontal overflow at 1440), `docs/changes/POLISH-LEFTOVERS-2341.md`
section 4 and `docs/changes/CALMSG-POLISH-2331.md` "Left" (the calendars tabs repeated as a sub-list in the settings column).

## 1. Tickets table: the default columns fit 1440 and 1280

Root cause: `table.tt` used the automatic table layout; every cell grew to its content up to fixed caps (`.cv` 240 px, the title 320 px,
the handler 180 px, the sentence 240-360 px), so the eight default columns plus the selection box came to about 1,600 px against
about 1,294 px of card at 1440 (viewport less the rail and the page padding). The card scrolled sideways and the place column was cut.

Change:

- `frontend/src/tickets/table-model.ts`: `COLUMN_WIDTH_PX` (a fixed width per column; the title takes the rest, at least `TITLE_MIN_PX`),
  `SELECT_COL_PX`, `tableMinWidth()`, `isDefaultColumns()`, `fitColumns()` and `AUTO_HIDE_ORDER` (department, then place, then priority).
  The default set measures 1,144 px with the selection box: whole at 1440; at 1280 the department column steps aside.
- `frontend/src/screens/tickets-table.ts`: a `ResizeObserver` measures the card; the shown columns are `fitColumns(...)` of the user's
  columns. Only the untouched default set is trimmed - a set the user changed (added, removed, reordered) is shown as chosen, and the
  table may then scroll sideways. The table draws a `<colgroup>` with the widths and `min-inline-size` = their sum. Tooltips (`title`)
  on every cut text: department, place, device, stuck, the handler, the category line, the priority and status chips (the title had one).
- `frontend/src/tickets/table-toolbar.ts`: new `fitted` property - the column chooser lists and edits the columns actually shown, so a
  hidden default column is unticked and ticking it shows it (it becomes the user's explicit choice and is never trimmed). A note
  (`data-cols-fitted`, text `columnsFitted` in `table-text.ts`, Hebrew + English) says some columns were hidden for the width.
  "איפוס" returns to the default set, which is fitted again.
- `frontend/src/tickets/table-styles.ts`: `table-layout: fixed`; cells `overflow: hidden`; `.cv`, `.sub`, the sentence and the handler
  name are cut by the column (no fixed px caps); chips never widen their cell (the sub-state is cut first). Logical properties only (RTL).
- Kept: every data hook (`data-col`, `data-sort`, `data-row`, `data-menu-for`, `data-select`, ...), the phone's compact list, the saved
  views and the preference (`viewDoc` and `saveBoardPrefs` still read `this.layout`, not the fitted columns), the sentence column.

## 2. Settings column: a screen's own tabs are not repeated under it

Root cause: `system-nav` unfolds the sub-entries of the screen the user is on (`tree()`), and the index lists the tabs of every screen
with its own tab strip as sub-entries. On `#/system/calendars` the column showed התנהגות / אישור לכל יומן / הרשאות / פרטי אורחים next to
the page's own tab strip (and, since `routeHref` had no calendars case, never marked the one open).

The same pattern was checked on every settings screen with sub-entries:

| Screen | Own tab strip | Column sub-list before | Now |
|---|---|---|---|
| יומנים `#/system/calendars` | yes (`seg tabs`) | 4 tabs | search only |
| מראה ותצוגה `#/system/diagnostics` | yes (`sw-tabs data-settings-tabs`) | 7 tabs | search only |
| משתמשים והרשאות `#/system/access` | yes (`sw-tabs data-access-tabs`) | 5 tabs | search only |
| אבטחה `#/system/security` | yes (`data-security-settings-tabs`) | 6 tabs | search only |
| מולטימדיה `#/system/multimedia` | yes (`sw-tabs data-mm-tabs`) | 2 tabs | search only |
| בקרת כניסה `#/system/access-control` | yes (`sw-tabs data-access-segments`) | 4 segments | search only |
| tickets settings `#/system/tickets` | yes (`data-tickets-settings-tabs`) | 2 tabs | search only |
| התראות `#/system/notifications` | no (sections of one page) | 4 sections | kept (a jump list, not a duplicate) |

Change:

- `frontend/src/screens/system-index.ts`: `ownTabs` on the top-level entries of those seven screens; `navTree()` (moved out of the
  element so it is testable) never unfolds sub-entries under an `ownTabs` screen; `navActive()` marks the screen while the user is on
  one of its tabs; `parentEntry()`; `routeHref` learned `#/system/calendars?tab=`.
- `frontend/src/screens/system-nav.ts`: draws `navTree(...)` and marks `navActive(...)`.
- The sub-entries stay in the index, so the settings search still finds every tab ("פרטי אורחים", "ערב חג", "תפקידים", ...) and its
  result still reads "<group> ‹ <screen>". Reverting one screen = removing its `ownTabs` flag.

For the owner: the column is now shorter on every screen with its own tabs (the page's tab strip is the one place to switch tabs).
If the sub-list should stay on some screens, it is one flag per screen.

## Tests

Run here (workstation, `--workers=1`, `playwright.unit.config.ts`):

- `npx tsc --noEmit -p .` (src + tests) - PASS.
- `unit-small-ui-bugs-2343` (new, 6), `unit-tickets-table`, `unit-tickets-list`, `unit-settings-index` - 46 passed.
- Gating lints `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, `unit-menu-lint`, `unit-empty-state-icons` and the source guards
  that read the touched files (`unit-calendars-switch-reach`, `unit-fleet-report`, `unit-messaging-accounts`, `unit-readiness-96`,
  `unit-security-public`, `unit-tickets-assignees`, `unit-tickets-delete`, `unit-tickets-naming`, `unit-tickets-overlay-menu`,
  `unit-uxfix-nav-295`, `unit-wiskey-switches`, `unit-wxunblk`) - 133 passed.

For the runner (NOT run here - workstation memory rule: no vite build / preview / browser evidence locally):

- `frontend/tests/evidence-small-ui-bugs-2343.spec.ts` (new): at 1440 and 1280 the default table has no sideways scroll in the card or
  the page, the key columns show, a cut cell keeps a tooltip; at 1280 a hidden default column comes back from the chooser. Screenshots
  in the test output (`tickets-table-1440.png`, `tickets-table-1280.png`).
- `frontend/tests/evidence-calendars-nav-2310.spec.ts` (one assertion added): no `#/system/calendars?tab=` link in the column, and the
  calendars entry is `aria-current="page"`.
- Layout sweeps that cover the table and the settings column: `layout-tickets-table.spec.ts` (all screens, 320-1440),
  `layout-settings-nav-fit-402.spec.ts`, `layout-settings-nav-295.spec.ts`, `evidence-tickets-table.spec.ts`,
  `evidence-tickets-ui4.spec.ts`, `evidence-tickets-polish-2331.spec.ts`.

## Pixel / layout baselines likely affected (refresh on the runner before the branch boards a train)

- Every baseline that shows the tickets table view at tablet / desktop widths: the columns now have fixed widths (the title is wider,
  department / place narrower; at <= ~1290 px of card the department column is hidden): `layout-tickets-table.spec.ts`,
  `evidence-tickets-table.spec.ts`, `evidence-tickets-polish-2331.spec.ts`, `evidence-tickets-ui4.spec.ts` shots, and any
  `frontend/tests/visual*/` baseline of `#/tickets/*` in the table view.
- Every baseline of a settings screen at >= 1100 px that shows the settings column on a screen with its own tabs (diagnostics,
  access, security, multimedia, access-control, calendars, tickets settings): the column lost the sub-list under the open screen
  (`layout-visdiff-246.spec.ts` and the settings shots of `frontend/tests/visual*/`).

Rollback: revert the branch commits; nothing stored changes (the column preference keeps the user's columns as they were).
