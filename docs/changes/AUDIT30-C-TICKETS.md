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

BEFORE_AFTER_TABLE

## 3. Tests

TESTS_TABLE

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
