# POLISH4-WP4 HOME-DEVICES (pilot/POLISH4-WP4-HOME-2370)

Polish round 4 (release 2.37.0), package WP4. Base: `origin/release/2360-train` @ `eb9525d9b` (contains v2.34.2 and 2.35.0).
Scope per the survey (`private/planning/POLISH_ROUND4_SURVEY_2026-11-02.md`, D2 / D24 / D25 / D26) and the owner answers Q5a / Q6a.
Refinement only: no menu, tab, widget, title or control order changed. The home edit drawer (`home-edit-drawer.ts`), the area presence
line and the XS mini widget are not touched.

## Defects

| # | Screen | Before | After | File |
|---|---|---|---|---|
| D2 | Home, edit mode | The absolute `.wg-e` bar covered the last rows of "פעולות מהירות" at 1920 / 1440. Root cause: the 52 px room under the content (`:host([editing]) .wg:not(.ghost)`) lost to the band's fit steps (`:host([layout][data-fit]) .wg { padding-block: 10px }`, the same weight, later in the sheet), and 52 px was too short for a bar that wraps to two rows in a narrow card. 26 px buttons; `border-radius: 999px` literals; ungated hover. | Each card keeps its bar's **measured** height free (`--wg-e-h`, set from a ResizeObserver on the bars, re-observed after each render) + 16 px, in a separate last sheet `HOME_EDIT_BAR_STYLES` at the weight of the heaviest per-direction rule, so no direction, fit step, skin (bubble quick `padding: 0`) or tile padding wins. The bar stays where it was (bottom of the card); content above it keeps its centring. 44 px grip / arrows / size segment / settings / hide on `pointer: coarse` (26 px on a mouse). Hover only under `(hover: hover) and (pointer: fine)` (edit controls, ghost "הוסף" button, media chips), a pressed wash on pointer-down. Radii: `--sw-r-lg` for the bar (a pill reads badly once it wraps), `--sw-r-pill` for the size segment and the other former `999px` literals (same pixels). | `home-widgets.ts` |
| D24 | Announcements (home tab) | Never reviewed: literal `999px` radii (chip, machine mark), `var(--sw-r-lg, 12px)`, a literal `120ms cubic-bezier` press, no hover / focus styles, 34-36 px chips and pickers on touch, error text in `--sw-danger` (low contrast in dark). | Radii and motion from the tokens (`--sw-r-pill`, `--sw-r-lg`, `--sw-t-press` / `--sw-ease`); a pressed wash on pointer-down; hover under a hovering fine pointer; a visible `:focus-visible` ring on chips / selects / text fields; 44 px chips and selects on touch; the error line in `--sw-danger-text`; the panels take the card shadow. Loading / error-with-retry / empty / forbidden / off already use `sw-state-panel` (unchanged). | `devices-announce.ts` |
| D25 | Automations | At 1024 (and 1180) the header took three rows (title + floors, kinds + state filter, then search + "+ חדש"); the cards view fitted one row of two cards. | From 768 to 1399 px the state filter folds behind the existing "סינון" button, by the **same setting** as on a phone (`automations.phone_filter`: `fold` = default; `rows` keeps the filter's own row and the old three-row header). The open filter takes its own line under the toolbar. Header = two rows at 1024 / 1180. From 768 to 1199 px the cards grid takes rows of three (`minmax(264px)`; two at 768 / 820 instead of one) with a tighter gap, so a page shows three or more cards where the height allows; the NOSCROLL fit still counts the rows (no new scroll). | `devices-automations.ts` |
| D26 | Layout editor 768-1199 | Q6a proposed a 260 px side panel. | **Not applied (resolved by 8B).** Owner answer 8B (01.11, `docs/changes/OWNER-R12-2341.md`) already made the editor a bottom sheet below 1200 px: `devices-layout-css.ts` has `@media (max-width: 1199px) { .lay-panel { inset-block-start: auto; ...` and `sw-page { padding-block-end: 52vh }`, so the 12-column preview is full width on tablets; the 300 px side panel exists only from 1200 px. Verified in source and guarded (unit spec). Small fixes in the same file: the library-item and tile-button hover gated to a hovering fine pointer (focus-visible kept), `999px` -> `--sw-r-pill`, `var(--sw-on-accent, #fff)` -> `var(--sw-on-accent, var(--sw-text-inverse))` (same white; the token-lint ALLOW_HEX entry for the file is dropped, no hex left). | `devices-layout-css.ts`, `tests/unit-token-lint.spec.ts` |
| - | Notices page | Local cancel of the shared row hover (`@media not ((hover: hover) and (pointer: fine)) { table.t tr.go:hover td { background: transparent } }`). | Removed: POLISH4-WP1 (`pilot/POLISH4-WP1-SHARED-2370`, `notices/styles.ts`) gates the wash at the source. **Merge WP1 before WP4**, else the phone shows the grey row after a tap again. | `devices-notices-css.ts` |

Verify-only (no change needed): `home-ambient-bar.ts` (no hex / rgba / px radius / ungated hover), `devices-notices.ts` (same), the rest of
`devices-notices-css.ts` (hover already gated). `devices-synoptic*.ts` not touched (the synoptic phone settings just landed; its
remaining `999px` / `2px` radii and the alarm-panel `rgba` washes are left for a later pass, not part of a D-item).

Phone buttons 44 px (D29) are WP1 / 2.34.2 - not redone here.

## Files

- `frontend/src/screens/home-widgets.ts` (D2)
- `frontend/src/screens/devices-announce.ts` (D24)
- `frontend/src/screens/devices-automations.ts` (D25)
- `frontend/src/screens/devices-layout-css.ts` (hover gate, tokens; D26 verified)
- `frontend/src/screens/devices-notices-css.ts` (local hover cancel removed)
- `frontend/tests/unit-token-lint.spec.ts` (stale ALLOW_HEX entry removed)
- `frontend/tests/unit-polish4-wp4-home.spec.ts` (new: source guards)
- `frontend/tests/layout-home-edit-bar-wp4.spec.ts` (new: edit-bar geometry through the widget-break harness; needs the Vite dev server)

## Tests (workstation, real totals)

- `npx tsc --noEmit` (frontend): exit 0.
- Node-only unit suite, `npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-`: **3675 passed, 1 skipped, 0 failed**
  (10.2 min), including the new `unit-polish4-wp4-home.spec.ts` (6 tests) and the updated `unit-token-lint.spec.ts`.

## NOT_RUN

The release gate on `release/2360-train` held the runner (`gate_status.json` "running", `~/.gate-pending` present) for the whole
30-minute wait and after it (elapsed > 6,100 s at the last check), so nothing ran on the runner:
- `layout-home-edit-bar-wp4.spec.ts` (new; Vite dev server: `run_smart.py spec pilot/POLISH4-WP4-HOME-2370
  tests/layout-home-edit-bar-wp4.spec.ts --project=desktop --workers=1 --machine runner`) - the D2 geometry proof at 1920 / 1440 / 1024 /
  390, every direction and fit step, classic + bubble.
- `evidence-automations-list.spec.ts` (two-row header at 820, the fold at tablet widths, cards count with `fit=off`) and
  `layout-home-widgets-wide-298.spec.ts` (the row band, not edit mode) as regressions.
- Visual matrix `devices-home` / `devices-building` / `devices-schedules` (no change expected, see Baselines).
- Light / dark / RTL visual review at 1920 / 1440 / 1180 / 1024 / 390: not done in a browser (workstation rule: no local Vite /
  Playwright browser runs). The D25 three-column choice at 1024 (cards ~280 px, the run footer may wrap to two lines) and the D2 bar
  look on touch (44 px controls wrap to two or three rows in a narrow card) are the two points to eyeball on the train.

## Baselines

- Visual matrix: `devices-home` captures `ready` / `dialog` (not edit mode) - no change expected. `devices-building`, `devices-schedules`:
  no WP4 file changes their pixels. The automations / announcements screens have no matrix entry and no pixel spec.
- Expected changes only in evidence shots (not baselines): home edit mode (cards keep the bar's height free; 44 px controls on touch
  projects), automations at 820 / 1024 / 1180 (two-row header, three-column cards), announcements (focus ring, shadow).
- No `*-linux.png` baseline is expected to move. If the lead's central refresh shows a diff on `devices-home`, it would be the media-chip
  hover gate only under a hovering pointer - review before accepting.
