# AUDIT30-C-TICKETS: the service-management screens follow the one design system (audit round 30, branch C)

Branch `pilot/AUDIT30-C-TICKETS`, cut from `origin/pilot/AUDIT30-BASE` (`2a6430586` = main v2.43.2 + SYS-AUDIT-QUICKFIX-2437 +
NOSCROLL-1366-2437). Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 4, 13. Frontend only; only
the files branch C owns (`screens/tickets-*.ts`, `screens/system-tickets.ts`, `tickets/**`) plus the tests that cover them.

## 0. Owner gates (assumed: the recommended option 1 / א, as instructed by the lead)

| Gate | Question | Assumed answer | Items |
|---|---|---|---|
| Q3 | the selected chip | light blue fill, blue text (the design document's Blue Wash) | C1, C2, C6 |
| Q7 | control screens that scroll | fix all: only an inner panel may scroll | C9 |
| Q11 | settings structure | one structure: page and cards, save shown only when there is a change | C7 |
| Q14 | navigation rows above the content | at most two tab rows; phone filters go into one button | C5 |

If the owner picks another option the lead rewrites the item; every change below is local to its file and can be reverted alone.

## 1. What changed

| Item | Finding | File(s) | Change |
|---|---|---|---|
| C1 | #3 dark white-on-white | `screens/system-tickets.ts` | The settings tabs are no longer the glass segment (they are the sw-tabs underline row, C7). The remaining segment keys of the page (the name's gender, the long-press choice) get the Blue Wash knobs: `--sw-seg-on-bg: var(--sw-accent-soft)`, `--sw-seg-on-fg: var(--sw-accent-text)`, no thumb shadow. Selector for branch J's `unit-muted-contrast`: `system-tickets [data-name-gender][aria-checked='true']` and `system-tickets sw-tabs[data-tickets-settings-tabs]` (its `[role=tab][aria-selected=true]`). |
| C2 | #4 black selected chip | new `tickets/chip-selected.ts`; `tickets/list-toolbar.ts`, `tickets/table-styles.ts`, `tickets/styles.ts`, `tickets/settings-styles.ts`; appended last in the styles of `screens/tickets-{board,list,overview,rfqs,handlers,detail}.ts`, `screens/system-tickets.ts` | One fragment `ticketChipSelected`: every pressed / checked `.rc` (floor chips, department chips, the filter sheet's state chips, priority chips, the table pop-up chips) is `--sw-accent-soft` behind `--sw-accent-text`, semibold, no shadow. It overrides the glass frame's black key (`styles/media-page.ts`, branch D's file, not edited). The four in-place rules (black / filled accent) are rewritten to the same pair. After branch B: import `chipSelected` from `components/sw-chip.ts` instead of repeating the declarations. |
| C3 | #6 local `<h1>` | `screens/tickets-{list,board,overview,rfqs,handlers}.ts` | Each screen is framed by `<sw-page wide class="page" heading=...>` (overview / handlers with `crumbs`, quotes with a crumb link in `slot="crumbs"`). The local `<h1>` and its header row are gone; the view switch, the manager's board / handlers switch and "+ חדשה" sit in `slot="actions"`. The toolbar header under the frame no longer sticks or compacts (the title it compacted moved into the frame); the compact-on-scroll state and its listeners were removed. Embedded handlers (inside the board) stay a plain block without a title. |
| C4 | #7 local KPI tiles | - | **After B** (needs `sw-kpi` `unit` / `secondary` / `tone` from B3): the 13 `class="kpi"` uses in `tickets-overview.ts` and `tickets-rfqs.ts` stay as they are. The existing `sw-kpi` has no `tone="warn"` fill nor a "x of y" line, so a swap now would lose the coloured numbers. |
| C5 | #9 rows above the content | `screens/tickets-board.ts` | Phone (< 768 px): the state strip leaves the toolbar and becomes the first section of the existing "סינון" sheet (the departments were already there), laid out three a row. The list already had state and departments in the sheet; its scope segment is the one tab row. Phone rows above the cards now: the frame header (title + actions), the floor chips (only when D19 says chips), the toolbar. |
| C6 | #14 tree row | `tickets/board-tree.ts` (FIXES calls it `ticket-board-tree.ts`) | `.row` radius `var(--sw-r-sm)` (was `--sw-r-lg`, measured 28 px), `min-block-size: 36px` (44 px under a coarse pointer), the chosen row `--sw-accent-soft` / `--sw-accent-text` (its count too), hover only under `(hover: hover) and (pointer: fine)`. |
| C7 | #16, #18 settings chrome | `screens/system-tickets.ts`, `tickets/settings-styles.ts` | `sw-page` (crumb "הגדרות", title, one sub line) + `sw-tabs variant="underline"` (manual activation and roving focus from sw-tabs; the screen's own key handler removed) + the existing `sw-card`s. The shared `.in` field rule takes the sw-field control look: radius `--sw-r-sm`, `--sw-ctl-h-md`, the accent ring on focus, a disabled look, 44 px / 16 px text under a coarse pointer on a phone (was the glass pill: 44 px, radius 999). The eight save keys of the page render only when their card has a change (`hidden` until then; invalid input still shows the key disabled). The `.in` inputs are not wrapped in `<sw-field>` elements: the same look comes from the shared rule; wrapping them is a markup change in 15 files that adds nothing visible (recorded as a follow-up, and B5's search variant is still to come). |
| C8 | #17 heading scale | `screens/tickets-board.ts` | Verified first: the group heading `.fsec .sh h2` was `--sw-fs-3xl` / 800 (26 px) under a 30 px page title. Now `--sw-fs-xl` / `--sw-fw-bold` (17 px). |
| C9 | #5 inner scroller | - (reconciled) | NOSCROLL-1366-2437 already pages the board and "my requests" from 1024 px (`sw-pager`, `.scr.paged`); this branch keeps it unchanged. The `.scr` region keeps `overflow: auto` only as NOSCROLL's fallback for a window shorter than one group header plus one card row, and as the tablet (768-1023 px) region, which Q7 option 1 allows ("only an inner panel scrolls"). No new scrolling was introduced: the frame change keeps `.scr` as the flex child that takes the room left. |

## 2. Before / after (the audit's probe, run from a copy of the audit folder)

Build of the base (`dist-before`) and of this branch (`dist-after`), `vite preview`, `node tools/shoot.mjs --routes
t-board,t-mine,t-overview,t-rfqs,t-handlers,s-tickets --wait 2600`, then `--vps contract --schemes light` (1366x768), then
`node tools/analyze.mjs`.

Columns as `analyze.mjs` prints them: `pg` = sw-page count, `scr D/T/P` = the largest page-sized scroller (px of overflow) at
desktop 1440x900 / tablet / phone, `btn` = button kinds / buttons off the standard, `rad` = elements with an off-scale radius,
`con` = contrast failures light / dark, `touch` = targets under 44 px on the phone. The 1366x768 column is the `contract` viewport.

| Screen | pg | scr D (1440) | 1366x768 page scroller | btn | rad | con L/D | touch | Before -> after |
|---|---|---|---|---|---|---|---|---|
| t-board | 0 -> **1** | 0 -> 0 | none -> none | 4/5 -> 4/5 | 15 -> 15 | 0/0 -> 0/0 | 4 -> 4 | phone overflow (P) 2900 -> 2715 |
| t-mine | 0 -> **1** | 0 -> 0 | none -> none | 3/3 -> 3/3 | 8 -> 8 | 0/0 -> 0/0 | 5 -> 5 | P 1674 -> 1696 |
| t-overview | 0 -> **1** | 0 -> 0 | none -> none | 2/4 -> 2/4 | 2 -> 2 | 0/0 -> 0/0 | 1 -> 1 | T 2561 -> 2536 |
| t-rfqs | 0 -> **1** | 0 -> 0 | 64 -> 38 | 3/5 -> 3/5 | 0 -> 0 | 0/0 -> 0/0 | 3 -> 3 | P 871 -> 795 |
| t-handlers | 0 -> **1** | 84 -> 71 | 216 -> 203 | 3/2 -> 3/2 | 6 -> 6 | 0/0 -> 0/0 | 6 -> 7 | |
| s-tickets | 0 -> **1** | 2150 -> 1954 | 4307 -> 4104 | 4/1 -> **3/1** | 0 -> 10 | 0/0 -> 0/0 | 11 -> **2** | settings page: the one screen DESIGN.md lets scroll |

Reading the numbers:
- **pg 0 -> 1 on all six** (finding #6 / #18). The h1 is the frame's (30/800 in classic, unchanged size).
- **Contrast stays 0/0** in both schemes; on the base SYS-AUDIT-QUICKFIX had already cleared finding #3 for the settings tab (1:1 in
  the audited v2.43.1). The selected keys are now the Blue Wash pair (see the spec's checks below).
- **s-tickets touch 11 -> 2**: the pill fields and the glass tab keys under 44 px on a phone are gone (fields 44 px under a coarse
  pointer, sw-tabs' own targets).
- **s-tickets rad 0 -> 10** is the probe reading the field radius as `--sw-r-sm` resolves inside the glass host: `styles/devices-themes.ts`
  line 193 maps `--sw-r-sm` to `--dv-radius-sm` (14 px, off the classic scale 4/7/10/16...). The pill (999 px) it replaced is not counted
  by the probe. The rule here uses the token; the value is branch A's glass bridge (A2 leaves the shape knobs alone), recorded for A.
  The board tree rows (t-board `rad 15`, unchanged count) read 14 px for the same reason (they were 28 px).
- **btn kinds** on board / list stay 4 / 3 (FIXES accept: <= 2): the glass `.btn` keys (34 / 38 px pills) and the tree row (role=button)
  are counted as kinds; unifying the glass `.btn` with sw-button is the shared-component / glass-bridge work (A / B), not this branch.
- **No -apple-system** in the family column on any of the six (the base already carries Heebo on the glass screens).
- **C9**: 1366x768 board and mine: no page-sized scroller before or after (NOSCROLL-1366-2437 pages them; kept). The tablet numbers (T) are
  the inner `.scr` region, which Q7 option 1 allows.

The audit probe was run against `dist-after` built from `a4dca5ae4` (the two later commits change only the settings card footer when
no save key shows and the phone board's switch row; the spec below covers both).

## 3. Tests

Workstation (the runner was overloaded and reserved for the 2.43.3 release gate and the baseline refresh, per the lead), the branch
built with `vite build` and served with `vite preview` on a free port, `SW_BASE_URL=http://127.0.0.1:<port>/`.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vite build` | built |
| `npx playwright test tests/evidence-audit30c-tickets.spec.ts tests/unit-token-lint.spec.ts --project=desktop --project=mobile --workers=2` | 31 passed, 3 skipped (desktop-only / phone-only cases; the pixel comparisons are skipped on Windows, no win32 baseline) |
| `npx playwright test tests/evidence-tickets-board.spec.ts tests/evidence-tickets.spec.ts tests/evidence-tickets-ui4.spec.ts tests/evidence-tickets-ui6.spec.ts tests/evidence-sys-audit-quickfix-2437.spec.ts tests/evidence-tickets-polish-2331.spec.ts tests/evidence-tickets-s5b.spec.ts tests/evidence-tickets-handlers.spec.ts tests/evidence-tickets-s2.spec.ts --project=desktop --project=mobile --workers=2` | 161 passed, 2 failed, 3 skipped; the two failures (phone: the strip tooltip now in the sheet; the list's first card 380 px under the frame's actions row) were adapted and re-run: 3 passed + 1 passed |
| `npx playwright test tests/layout-noscroll-1366.spec.ts tests/layout-a11y-295.spec.ts tests/layout-tickets-board.spec.ts -g tickets --project=desktop --workers=2` | 5 passed, 2 skipped, 4 failed: `layout-tickets-board` found the count "3" escaping its key in the phone sheet's state strip (320-390 px); fixed (`7f4e9c0b1`), classic re-run 1 passed (180 checks, 0 findings) |
| `layout-tickets-board.spec.ts` all skins after the fix | 4 passed (classic, domus, tesla, crystal; 0 findings) |
| Runner: `run_smart.py preview pilot/AUDIT30-C-TICKETS tests/evidence-audit30c-tickets.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner` | run 1 (`a4dca5ae4`): 13 passed, 4 failed (assertions on glass radius and the phone heading step, fixed in the spec), 8 baselines (discarded: later commits changed the settings footer and the phone board). Run 2 (`2bb7e4d6a`, runner load > 100): 14 passed, 3 skipped, 3 failed - the settings dark screenshot did not settle within 5 s (both projects; timeout raised to 20 s) and the phone #6 test hit `Target crashed` (runner memory; passes on the workstation). 6 baselines committed (`3047ea5e9`): board light/dark 1440 and 390, settings light 1440 and 390. Run 3 (`-g "settings page"`, for the two dark settings baselines): still waiting on the runner when this note was written; until those two exist the dark settings comparison is skipped (annotation), not failed |
| Runner proof run without `-u` | NOT_RUN (the runner was over its load limit; the entry check re-runs the spec without `-u`) |

Regression test per fix: `tests/evidence-audit30c-tickets.spec.ts` (#3/#18 dark tab + gender contrast and Blue Wash, #4 chip colours,
#6 one sw-page and no own h1 on five screens, #9 phone strip in the sheet and the actions on screen, #14 tree row radius / height /
colour, #16 field radius and save-only-when-dirty, #17 heading step, #5 no page scroll at 1366x768; two `pixel-stable` tests: board and
settings, light and dark, 1440 and 390).

## 4. Contradictions recorded

- `tests/evidence-sys-audit-quickfix-2437.spec.ts` (finding 3) asserted for the service-calls settings that the chosen key is >= 3:1
  from its track. FIXES.md (C1 / C7, Q3 / Q11 option 1) makes the tabs the sw-tabs underline row (no key of its own: the state is the
  accent underline and ink) and the chosen segment key the Blue Wash pair (fill and ink carry the state, as on every chip). The spec now
  keeps the label rule (>= 4.5:1) for those two cases and the track rule for the notification severity pill (not this branch's
  screen). If the owner wants a 3:1 key on the tabs, that is a change to the design document's Blue Wash rule, not to this branch.
- FIXES.md names `tickets/ticket-board-tree.ts`; the file is `tickets/board-tree.ts`.

## 5. After branch B (follow-ups)

1. C4: replace the 13 local KPI tiles with `<sw-kpi interactive>` and `tone` once B3 lands.
2. C3 / B6: move "+ חדשה" (list, board, quotes) from `slot="actions"` to sw-page's `primary` slot (the phone floating action).
3. C2 / B2: import `chipSelected` into `tickets/chip-selected.ts`.
4. C7 / B5: the board / list / quotes / handlers search inputs to the `sw-field type="search"` variant; optionally wrap the settings
   `.in` inputs in `<sw-field>`.

## 6. Known limits

- The probe measures demo fixtures; loading / empty / error states were not forced per screen.
- Home screens untouched. No device or lab access.
- Phone: the toolbar now scrolls with the page instead of sticking with a compact title layer.

## 7. Rollback

Revert the merge commit. No data, settings or API change.
