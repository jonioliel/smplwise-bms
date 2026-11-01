# POLISH-LEFTOVERS-2341 - three leftovers of the 2.33.1 polish round

Branch `fix/POLISH-LEFTOVERS-2341`, cut from `origin/release/2340-train` (95ced89bb). No version bump, not merged.
Source: the "Left" sections of `docs/changes/DEVICES-POLISH-2331.md` (items 1 and 3 there) and `docs/changes/TICKETS-POLISH-2331.md`
(item 1 there). Not touched (another agent's scope): `system-setup.ts`, `devices-layout*.ts`, the unassigned tree / tiles.

## 1. Phone automations rows cut the name

`frontend/src/components/sw-automation-row.ts` (CSS only, the DOM is unchanged). Below 768 px the grid was
`44px minmax(0, 1fr) auto 36px`: the run summary ("רצה לפני 4 דק׳ · 38 ריצות", up to 34vw) took its width first and the name kept a few
letters at 320 / 390. Now the phone row is two lines in one grid:

| | before | after |
| --- | --- | --- |
| line 1 | switch, name (squeezed), run, menu | switch, **name across the whole line**, menu |
| line 2 | place (under the name) | place, last run (run capped at 38vw - the schedule rows' next-run rule, R5) |

The `.who` cell steps aside (`display: contents`) so the name and the place line join the row grid; `.who`, `.where`, `a.name` and
`[data-card-run]` keep their elements and text (specs read them). Run text drops to `--sw-fs-sm` on the phone. Ellipsis stays only as
the last resort for a very long name or place. Row height unchanged (min 56 px). No horizontal scroll is added (every track is
`minmax(0, ...)`), but this was NOT measured in a browser here (low-memory session) - see "Runner".

## 2. Climate modes in Hebrew

`frontend/src/api/devices.ts`: new `FAN_HE`, `SWING_HE`, `PRESET_HE` (moved from `devices-controls.ts`, plus a humidifier's usual
modes) and `climateWord(kind, value)` - case- and separator-insensitive lookup, an unknown value is shown as the device reports it.
Used in `devices-controls.ts` (the fan / preset / swing / humidifier menus, their disabled "current" option, the command status line,
`climateChoice`) and `devices-area.ts` (the climate row's detail line "מאוורר: / מצב מוגדר: / נדנוד:" and the humidifier's "מצב:").
**Display only**: every `<option value>` and every command payload still carries the raw value (`{ fan_mode: v }` etc.).

## 3. One "סינון" in the tickets table view

Before: the page toolbar's "סינון" (state, department) and the table toolbar's "סינון" (priority, handler, waiting, stuck, cost
state, opened between) side by side. Now the page's one panel hosts both:

- `frontend/src/tickets/table-filter-panel.ts` (new): `tableFilterSections()` (the table filters as panel sections, the same hooks:
  `data-f-priority`, `data-f-assignee`, `data-f-holders`, `data-f-waiting`, `data-f-stuck`, `data-f-cost-status`, `data-f-from`,
  `data-f-to`), `tableFilterChips()` (one removable chip per active group - the same groups `activeExtraCount` counts, so the badge
  number is unchanged), and the date fields' styles.
- `screens/tickets-list.ts` owns the state (`tableExtra`, `tableHolders`) and renders `<tickets-table hostFilters .extra=...>`; the
  panel's reset (`data-f-reset` / `data-f-clear`) clears the page and the table filters together.
- `screens/tickets-table.ts`: `extra` is a property now; a change the table makes itself (a saved view, the empty state's
  `data-clear-extra`) is reported with `table-extra`, the handler list with `table-holders`; `willUpdate` reloads on `extra`.
- `tickets/table-toolbar.ts`: `hostFilters` hides its own "סינון" (`data-open="filters"`); without it the component behaves as before.
- Saved views still store and apply the table filters (`viewDoc` reads the same `extra`).

## Tests

Run here (Windows, low-memory session, `--workers=1`):

- `npx tsc --noEmit` - clean.
- `npx playwright test -c playwright.unit.config.ts --workers=1`:
  - `unit-climate-words` (new, 3), `unit-automations-list`, `unit-token-lint`, `unit-uxfix-rtl`, `unit-lead-reserve` - 58 passed.
  - `unit-tickets-table` (one new test + the D33 lint now covers `table-filter-panel.ts`), `unit-tickets-list`, `unit-token-lint`,
    `unit-uxfix-rtl`, `unit-lead-reserve`, `unit-tickets-assignees`, `unit-tickets-overlay-menu` - 73 passed.

Specs changed for the runner (selectors / expected words), NOT run here:

- `frontend/tests/evidence-tickets-table.spec.ts` - "the table filters" test drives the page panel (`tickets-list [data-filter-toggle]`,
  `[data-filter-panel] [data-f-*]`), asserts the toolbar has no `data-open="filters"`, the badge says 2, the priority chip shows.
- `frontend/tests/evidence-tickets-ui4.spec.ts` - the toolbar keeps columns / views / density / CSV; no `data-open="filters"`; exactly
  one `data-filter-toggle` on the page.
- `frontend/tests/layout-tickets-table.spec.ts` - the "filters" screen opens the page panel.
- `frontend/tests/evidence-devices.spec.ts` - the fixture preset test expects "חיסכון" (status line and "מצב מוגדר: חיסכון"); the
  option value it selects is still `eco`.

## Runner (evidence and baselines to refresh before a train)

- Pixel / layout baselines that show the table toolbar or the page filter panel in the table view: `layout-tickets-table.spec.ts`
  (all screens - the toolbar lost a button), `evidence-tickets-table.spec.ts` shot `filters`, `evidence-tickets-polish-2331.spec.ts`
  (table view shots), `evidence-tickets-ui4.spec.ts`.
- Automations phone rows: `evidence-automations-list.spec.ts`, `evidence-noscroll-295.spec.ts`, `evidence-polish2-295.spec.ts`,
  `layout-uxfix-nav-295.spec.ts` (390 / 320 - check the name is whole for typical names and the page has no horizontal scroll),
  and `frontend/tests/devpolish-2331-shoot.spec.ts` (DP_OUT) for before / after at 390.
- Climate words: `evidence-devices.spec.ts` (fixture lane `SW_DEVICES_FIXTURE=1`), `r5-devices-shoot.spec.ts` and any area-screen
  baseline with a climate row whose fan / swing / preset is shown.

## Rollback

Revert the three commits; no data, settings or API change.
