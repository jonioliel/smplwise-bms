# AUDIT30-F-CALENDARS - round-30 consistency audit, branch F (calendars)

Branch `pilot/AUDIT30-F-CALENDARS`, cut from `origin/main` @ `9186b67ff` (v2.43.2). Plan:
`private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 7, 13. Frontend only; no device, lab or backend change.

## Owner gates (assumed option A, the audit page's recommendation; the lead rewrites an item if the owner answers otherwise)

| Gate | Question | Assumed |
|---|---|---|
| Q3 | how a selected chip looks | A: light blue fill, blue text (the design document's Blue Wash pair) |
| Q5 | where "חדש" sits | A: always at the end of the title row; one floating button in the bottom corner on the phone |
| Q9 | windows and drawers | A: one shared, opaque dialog and drawer |
| Q11 | settings structure | A: page and cards (the module's settings save at once, as before: there is no save button to hide) |

## Changes (owned files only)

| Item | Finding | Files | Change |
|---|---|---|---|
| F1 | #4 | `calendars/styles.ts`, `calendars/attendee-picker.ts` | `.chipb[aria-pressed=true]` (the floor chips and every module chip) and the attendee picker's selected filter were a black pill (`--sw-heading` fill); now `--sw-accent-soft` / `--sw-accent-text`, no border, no shadow. |
| F2 | #6, #8 | `calendars/cal-page.ts` | The page is framed by `<sw-page heading="יומנים" wide>` (also the module-off and no-access states); the local `<h1>` and `.top` header are gone. "חדש" / "חלון תחזוקה" is `<sw-button variant="primary" icon="plus" slot="actions">`; under 768 px it is fixed in the bottom corner above the bottom navigation (size `lg`, 44 px on a phone). The floor chips moved from beside the title into the view bar, after the view tabs. |
| F3 | #11 | `calendars/event-drawer.ts`, `calendars/maint-drawer.ts` | The local `<aside>` + scrim + own Escape listener became `<sw-drawer modal open>`: top-layer dialog, inert page, focus trap, Escape and the backdrop close it, focus returns to the opener, the shared header (title, subtitle, close) and footer. Footer actions are `sw-button`s (primary save, secondary dismiss; the destructive cancel/withdraw in `footer-end`, ghost then `danger` on the confirm step). The drawer's composed `close` is stopped inside and re-raised as the module's own event. The title field still takes focus after the drawer's first frame. |
| F4 | #18 | `screens/system-calendars.ts` | `<sw-page crumbs="הגדרות" heading="יומנים" wide>` with the module switch in `slot="actions"`; the local pill tablist became `<sw-tabs variant="underline">` (links, short labels on the phone); the tab's content sits in one `<sw-card fill clip>` that fills the page and still pages its rows. Loading and error states use the same frame. |
| F5 | touch | `calendars/view-calendar.ts`, `calendars/styles.ts` | Phone month: six 44 px rows (the month grows to fit, the day cell stays the button that picks the day and lists it under the grid). On `(pointer: coarse)` the module's `.btn`, `.btn.sm`, `.chipb` and `.seg button` are 44 px high and icon buttons 44 px wide (the classic `--sw-touch` is 36 px, so the rule carries the 44 px of COMPONENT_RULES §1). |

No new colour, radius, font-size or duration literal; no new `<select>`, `<table>` or `<dialog>`. The existing native selects in the
drawers and the settings table are untouched (counted by the ratchet of branch J, not grown).

Test edits outside `src`: `tests/evidence-calendars-settings-2310.spec.ts` clicked `[data-calset-tabbtn=...]` (the removed local tab
buttons); it now clicks the `sw-tabs` tab by its link.

### Not done here (recorded, not silently resolved)

- FIXES F2 names a `primary` slot of `sw-page`; `sw-page` (branch B's file) has only `actions`. The button uses `slot="actions"`.
- F2 says 180 raw buttons in the module: this branch converted the page header and the two drawers' action rows. The view toolbars,
  the connect dialogs (`connect-dialogs.ts`), the resident flow and the manage view keep the module's `.btn` (same tokens); converting
  them is a follow-up within this module.
- F5 "open the day sheet": the phone month already lists the picked day under the grid (the agenda); no separate sheet was added.
- The view tabs of the calendar page stay the module's pill bar (level 1 navigation, the audit's rule for the first level).

## Measurements (the audit's probe, run from a copy of the audit folder)

Before = `data/measure.json` of the audited build (v2.43.1, `ab7894837`). After = this branch's build served on 127.0.0.1:4391,
`node tools/shoot.mjs --routes calendars,s-calendars` (all viewports, both schemes) plus `--vps contract --schemes light`, then
`node tools/analyze.mjs`, from a scratch copy of `tools/` and `data/`.

| Screen | Metric | Before | After |
|---|---|---|---|
| יומנים (`calendars`) | uses `sw-page` (`pg`) | 0 | 1 |
| | `<h1>` host | `calendars-page` (local) | `calendars-page>sw-page` |
| | page scroll desktop / tablet / phone / 1366x768 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| | touch targets under 44 px, phone 375 | 60 | 2 (the shell's search pill 44x28, the day/week/month segment 40x44) |
| | touch targets under 44 px, tablet 768 | 18 | 4 |
| | "חדש" dialog: element / host | `aside` in `cal-event-drawer`, no backdrop | `dialog` in `sw-drawer` (modal, backdrop) |
| | dialog touch targets under 44 px, phone | 65 | 3 |
| | dialog native controls | select 3, date 1, time 2 | the same (+ the shared drawer's own `<dialog>`) |
| | contrast failures light / dark | 0 / 0 | 0 / 0 |
| | off-scale text | 0 % | 0 % |
| הגדרות › יומנים (`s-calendars`) | uses `sw-page` | 0 | 1 (plus `sw-tabs`, `sw-card`) |
| | `<h1>` host | `system-calendars` (local) | `system-calendars>sw-page` |
| | page scroll desktop / tablet / phone / 1366x768 | 0 / 0 / 0 / not measured | 0 / 0 / 0 / 0 |
| | touch targets under 44 px, phone / tablet | 16 / 23 | 7 / 19 (the shared `sw-toggle` 42x24 and the shell's settings strip remain: not this branch's files) |
| | contrast failures | 0 / 0 | 0 / 0 |

Selected floor chip: black pill (`--sw-heading` fill) -> `--sw-accent-soft` fill with `--sw-accent-text` (checked in light and dark by the
regression spec). Phone settings rows per page (behaviour tab, 390x844): 3 -> 2 (the 44 px touch controls are taller; 13 pages instead of 9).


## Tests

All on the Windows workstation against this branch's `npm run build` served by `vite preview` on 127.0.0.1:4391 (demo data), Playwright
projects desktop + mobile, `SW_BASE_URL=http://127.0.0.1:4391/`:

| Command | Outcome |
|---|---|
| `npx tsc --noEmit -p .` | PASS (no output) |
| `npm run build` | PASS |
| `npx playwright test <the 20 specs that read calendar code: evidence-calendars-*, evidence-calmsg-polish-2331, evidence-dark-seg-all-2380, pixel-round4-leftovers-2390, unit-a11y-polished-lint, unit-calendars-*, unit-dark-polish-beds, unit-dialog-toplayer-2381, unit-round4-leftovers-2390, unit-schedules-nav, unit-token-lint> --workers=4` | 438 passed, 5 failed, 29 skipped (first run) |
| the 5 failures | 4 x `evidence-calendars-manage-2310` maintenance drawer: `toBeDisabled` / `toContainText` on the save button (now a `sw-button` host: the test reads its native button for the state and the host for the text); 1 x mobile `evidence-calendars-settings-2310` behaviour: 13 pages on the phone with 44 px controls, the test walked 12 (bound raised to 20). Test fixes, no product change. |
| `npx playwright test tests/audit30-f-calendars.spec.ts tests/evidence-calendars-{views,nav,settings,manage}-2310.spec.ts --workers=4` (final build) | 166 passed, 0 failed, 20 skipped (project / phone skips by design) |
| `tests/audit30-f-calendars.spec.ts` alone (final) | 28 passed, 4 skipped (phone-only / desktop-only cases) |

The pixel cases (`pixel-stable`) compare only where a Linux baseline exists; on Windows they are annotated `skipped-pixel` and pass without
a compare. Linux baselines: see "Pixel baselines" below.

Not run here: the whole frontend suite, the backend suite (no backend change), the gate (queued as the runner entry check).

### Pixel baselines

PIXEL_SECTION


## Design skills (SKILLS_BRIEF.md)

| Skill | Invoked | Command / tool | Finding | Change |
|---|---|---|---|---|
| ui-ux-pro-max | yes | `search.py "touch target size grid cell" --domain ux`, `"modal focus trap escape" --domain ux`, `"selected chip state contrast" --domain ux` | touch targets 44 pt on touch platforms; visible focus inside modals; 4.5:1 for chip text | 44 px day cells and coarse-pointer controls; the shared drawer keeps the focus ring and trap; accent-text on accent-soft (the design document's proved pair) |
| emil-design-eng | yes | Skill tool, review of drawer / chip / FAB | no local keyframes for a drawer (one motion source), press feedback on the primary action, hover only on fine pointers | the local `slide`/`fade`/`in` keyframes were removed (sw-drawer's own transition); sw-button carries the press scale; no new hover rules |
| impeccable | yes | `impeccable.cmd context --target frontend/src/calendars/cal-page.ts` (refinement of an incumbent system; no PRODUCT.md), `impeccable.cmd detect --json` on the changed files | Operate mode: consistency and known patterns over expression | the screens adopt the shared frame, drawer, tabs and card instead of local look-alikes |

## Known limits

- Pixel baselines exist for Linux only (taken on the runner); on Windows the compare is skipped and annotated.
- The phone floating button covers the bottom-end corner of the content under it (by design of Q5 A).

## Rollback

Revert the merge commit. No data, settings or API change is involved.
