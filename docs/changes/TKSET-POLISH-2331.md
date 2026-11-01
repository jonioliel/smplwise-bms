# TKSET-POLISH-2331 - tickets settings and side screens polish (wave 3)

Branch `pilot/TKSET-POLISH-2331` from `origin/main` @ `52a8d9129`. Scope: `frontend/src/screens/system-tickets.ts`,
`frontend/src/screens/tickets-rfqs.ts`, `frontend/src/screens/tickets-maintenance.ts` (each screen's own CSS block only; no shared
design token, component, shell or module stylesheet edited). Refinement, not redesign: the TKUI6 / TKRFQ2 / CR-MAINT215 look stays.

## Critique (before shots: `docs/evidence/TKSET-POLISH-2331/before/`, 1440 / 1920 / 1180 / 1024 / 390)

### Settings › service management (`#/system/tickets`)
1. **Save feedback out of sight (P1, misleading state).** "נשמר" and every save error were an inline line under the page title.
   Most cards sit far below it (the second column of כללי is ~2.5 screens long), so a save from the RFQ or vendor-upload card
   showed nothing where the user was looking, and a failed save looked like a success.
2. **Cramped two-column grid at 1024 (P1, responsive).** The two-column switch read the shell's container (still > 900 px at a
   1024 viewport), so each column was ~420 px: in the תצוגה tab a row's label broke one word per line ("פתיחת / בקשת / שירות")
   beside its segmented control; in כללי the unit "שעות" dropped under its field.
3. **Inconsistent save placement (P2).** The link card saves from its footer; the send-hours card had its save squeezed in the row
   next to the two time fields (it wrapped under them at 1440); the vendor-uploads card saved from a row with an empty label.
4. **An empty-label row as a toolbar (P2).** The holders card hosted its "by person / by permission" switch in a full settings well
   whose label was empty - a grey slab 70 px tall above the list.
5. **Text glyphs as icons (P3).** The permissions matrix drew "✓" / "–", the personal-grant chips "✓ " / "+ " (font-dependent,
   uneven weight against the drawn icon set).
6. Noted, not changed: the phone tab strip wraps into three rows (deliberate, integ/291: nothing hidden behind a sideways scroll);
   the "שם המודול" row label repeats as the first field's label; the crumb "הגדרות" is a literal (no i18n key exists in this file's
   catalogues); the notification-matrix card is empty under the evidence mock (its own component).

### Requests for quotation (`#/tickets/rfqs`)
1. **Primary action orphaned (P1, hierarchy).** At 1440 the toolbar (departments, state strip, search, "+ בקשה חדשה") did not fit
   one line and the primary button fell alone onto a second row; at 1024 it shared a third row with the search.
2. **KPI tile widow (P2).** `auto-fit minmax(140px)` left one tile alone on the second row at 1024 (5 + 1).
3. **Phone: the list starts below the fold (P1).** At 390 the six tiles took three rows (~260 px) under the four-row state strip:
   the first request started at y≈760 of 844.
4. **Empty state noise (P2).** "No request yet" sat under five tiles that all read 0.
5. **Error state hides the reason (P2).** The failure text was visually hidden; only "try again" was shown.
6. **Failed toast drew a green mark (P3).** The module's toast colours its icon `--sw-success` whatever the tone.

### Maintenance section shell (`#/tickets/maintenance/...`)
The pages themselves (`maintenance/*-page.ts`) are another agent's; the shell owns the tab row and the whole-section states.
1. **Wrong icon for "module off" (P2).** The off panel used `offline` (a crossed wifi) - it reads as a connectivity fault.
2. **"להגדרות" link (P2).** 7 px padding (~34 px tall, below the 44 px target), no focus ring, no hover or press state.
3. **Loading (P3).** One 160 px block instead of the section's shape (page row + page).

## Changes

| Screen | Before | After | Why |
| --- | --- | --- | --- |
| settings | `.msg ok/err` inline under the title | `.toast` (the module's own toast style) at the bottom of the viewport; the error stays with a close button until dismissed or the next save starts | feedback where the user is, in every card |
| settings | `@container (max-width: 900px)` on the shell's container | the tab body is a named container (`tkset`), one column below 1000 px of the body | no 420 px columns at 1024; 1440/1920 unchanged |
| settings | `.unit` wraps | `.unit { flex-wrap: nowrap }` | "24 שעות" stays one unit |
| settings | hours save inside the row; vendor-uploads save in an empty-label row | both in the card `.foot` (with their field error), like the link card | one save pattern per card |
| settings | holders switch in an empty-label row | `slot="actions"` in the card header (wraps under the title when narrow) | a 70 px slab removed |
| settings | `✓` / `–`, `✓ ` / `+ ` | `sw-icon` check / minus / plus | drawn icon family |
| rfqs | "+ בקשה חדשה" at the end of the filter toolbar | in the title row (phone: grid area beside the title) | primary action always on the first line |
| rfqs | tiles `auto-fit` | 3 per row 768-1279 px; on a phone 3 compact tiles per row (xs label, lg number) | no widow; list starts ~120 px higher on a phone |
| rfqs | empty: 5 zero tiles + state | the state alone | no zero noise |
| rfqs | error reason `.vh` | visible muted line `[data-rfq-error-why]` | the user sees why |
| rfqs | `.toast.bad` green icon | danger tone | the mark matches the message |
| rfqs | "load more" at the start edge | centred | under the list's axis |
| maintenance | off icon `offline` | `power` | module switched off, not a network fault |
| maintenance | `.btn` 7 px padding, no states | 44 px min height, focus ring, hover (fine pointers only), press scale token, reduced motion | target size and states |
| maintenance | one loading block | tab-row and page skeletons | the shape of what loads |

Data attributes kept (`data-tickets-settings-ok`, `data-tickets-settings-error`, `data-holders-by`, `data-grant`, `data-rfq-new-btn`,
`data-kpi`, `data-rfq-state`, `data-state`, ...); one added: `data-tickets-settings-error-close`, `data-rfq-error-why`.
No behaviour, setting, text or data removed. Save calls now clear the previous error first (`saveDoc`, `saveName`).

## Proposals for shared files (not edited here)
- `styles/media-page.ts`: `.toast` has no tone variant; a `.toast.bad` rule (danger icon) belongs there for every page using it.
- `tickets/rfq-styles.ts`: the KPI widow rule could move there if the board / comparison tiles want the same balance.

## Tests
- `npx tsc --noEmit`: 0 errors.
- Gating lint: `unit-token-lint` 7/7 passed (after replacing a `var(--sw-press-scale, 0.97)` fallback the service-module rule
  forbids); with `unit-lead-reserve`, `unit-uxfix-rtl` and the touched source-guard specs (`unit-rfq-vendor-upload`,
  `unit-rfq-question-settings`, `unit-tickets-naming`, `unit-tickets-overlay-menu`, `unit-tickets-rfq`, `unit-tickets-ui6`):
  81 passed / 1 failed on the first run (the fallback above), token lint re-run 7 passed.
- Evidence / layout specs (`evidence-tickets-ui6`, `-s2`, `-s5b`, `-rfq2`, `-rfq4`, `-rfq-code`, `evidence-maintenance`,
  `evidence-tickets`, `layout-tickets*`, `layout-tickets-rfq*`): **NOT_RUN** - the coordinator stopped local builds and Playwright
  evidence runs (workstation out of memory); they run on the runner gate.
- After shots: **NOT_RUN** for the same reason (`after/` is empty; the before set was captured from the origin/main build).

## Pixel baselines likely affected
- tickets settings: every `system-tickets` shot at 1024 (one column now) and every shot that showed the save line, the hours card,
  the vendor-uploads card, the holders card or the permissions matrix (`evidence-tickets-ui6`, `evidence-tickets-s2`,
  `layout-tickets`, `layout-tickets-s4`, skin baselines of `#/system/tickets`).
- RFQ list: `evidence-tickets-rfq2` list / states shots (all widths: the button moved), `layout-tickets-rfq2`,
  `layout-tickets-rfq-bar`, `layout-tickets-rfq-questions` (phone tiles).
- Maintenance: `evidence-maintenance` module-off and loading shots.

## Left
- After screenshots and the evidence specs on the runner; pixel baseline refresh there before the branch joins a train.
