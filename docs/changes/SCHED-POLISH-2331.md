# SCHED-POLISH-2331: automations and schedules admin, polish wave 3

Branch `pilot/SCHED-POLISH-2331`, cut from `origin/main` at `52a8d9129`. No version bump, no merge. Scope (only these files):
`frontend/src/screens/system-automations.ts`, `system-schedules.ts`, `schedule-slot-panel.ts`, `schedule-create-dialog.ts`,
`schedule-table-view.ts`. Reference language: the R5-SYSTEM-297 settings ladder (`styles/settings.ts`: card / well / row), the
R5-DEVICES-297 schedule editor (headings in the heading ink, panels as the top step) and POLISH-CONTROL-297. Tokens only. Skills
followed: impeccable (polish, craft floor), emil-design-eng (press feedback, entrance motion, hover only under a hovering pointer).

Nothing was removed: every option, setting, permission rule and data attribute the specs use stays. No shared file
(`frontend/src/design/*`, `styles/settings.ts`, `components/sw-*`, shell, system-nav) was edited.

## 1. Critique (before), per screen

Captured (before) at 1920x1080, 1440x900, 1180x820, 1024x768 and 390x844 on a `vite preview` build (demo data), see
`docs/evidence/SCHED-POLISH-2331/before/`. Scroll: both settings pages are forms (documents with a sticky save bar), not control
screens; they scroll inside the shell's main region and the document itself never overflowed (`scroll-facts.txt`: 0 / 0 at every
size, before; after: NOT_RUN, the change adds no page-level height).

### הגדרות › תזמונים (`system-schedules.ts`)
1. Side column (defaults, list display, roles) at 1440 / 1180: the 240 px control squeezed its row label into three lines
   ("שמירת / הרצות / אחרונות").
2. The 17 device-class toggles were one long single-column list of wells; the sensitive classes (their own permission) were mixed
   in with the ordinary ones, marked only by a small badge. At 1920 the card was ~1,400 px tall in a ~1,100 px wide column.
3. The install-help disclosure was a text link ending in a unicode arrow (▴ / ◂), no `aria-expanded`, no focus ring, a ~18 px target.
4. The roles table: 11-12 px grey headers and 7 px cells next to the 14-15 px settings rows; no `scope` on the headers; a "no" cell
   was a bare dash for a screen reader.
5. Inline `style=` on three paragraphs (dialogs, the scripts empty line); a local `.lbl` rule fighting the settings row label.
6. The connection status tiles (30 px, small radius) were a step smaller than the ladder's other icon tiles.

### הגדרות › אוטומציות (`system-automations.ts`)
1. The "מי במבנה" presence picker had a class (`.sel`) with no rule: it rendered as the browser's default select and wrapped onto
   its own line under its label.
2. Hierarchy: the "מצב" card, which carries the feature's master switch ("האוטומציות במוצר") and the platform health, was the last
   card of the first column, below six other cards.
3. Unicode glyphs as icons: ▲ / ▼ (template order), ✓ / + (code-view roles, notify targets), − / + (steppers).
4. Radius literals `999px` (two places) instead of the pill token.
5. No focus ring on the stepper buttons, the order buttons, the role chips or the links; 32 px order buttons even on touch.
6. The role matrix: same small-header issue as the schedules page; ticks had no accessible name.

### Slot panel (`schedule-slot-panel.ts`, inside the schedule editor)
1. The header put title, summary, markers and four buttons on one wrapping line; on a narrow card the buttons pushed the summary
   around. The title was 15 px / 600 while the editor's side headings are lg / 700 in the heading ink (R5-DEVICES-297).
2. Field labels 11 px / 500 (below the editor's own label size); inputs 32 px on a phone.
3. Dead CSS (`.marks`, `.chip`, `.chip.sens` with an `rgba()` literal) and inline styles on the checkboxes.
4. Validation errors were plain red lines with no icon and no live region; the empty state was a grey sentence.

### Table view (`schedule-table-view.ts`)
1. Bug: the actions cell was a `td` with `display: flex`; it left the table model and its bottom rule stepped out of line with the
   rest of the row (visible at 1024 / 1440).
2. No hover feedback on a clickable row; 11 px grey headers; times not in tabular numerals.
3. A narrow editor column (tablet) had no horizontal containment for the table.
4. Phone cards: the delete / duplicate buttons floated without a separator; the error icon in the number cell had only a `title`.

### New schedule dialog (`schedule-create-dialog.ts`)
1. The footer scrolled with the content: on a phone (quick tab, all chips shown) the create / cancel buttons left the screen.
2. No focus management: focus stayed on the page behind, Tab walked out of the modal, focus was not returned on close.
3. Tabs had `role=tab` but no arrow-key movement, no `aria-controls`, no tab panel.
4. A template blocked for lack of the Shabbat sensor said why only in a hover `title`.
5. Chips 32 px (no touch size), no press feedback; section labels 13 px; "טוען…" as plain text.
6. No entrance: the box appeared at once over a scrim that also appeared at once.

## 2. Changes (after)

| File | Change |
|---|---|
| `system-schedules.ts` | Columns are size containers: below 440 px a row stacks (label above control), so the side column no longer squeezes labels. Device classes: two groups with a count ("רגילים · N מתוך 13", "רגישים: דורשים הרשאה לתזמון פעולות רגישות · N מתוך 4"), each a responsive grid of wells (two columns where the column is wide enough). Help disclosure: a real button with `aria-expanded` / `aria-controls`, a drawn chevron that turns, a focus ring, 32 px. Roles table: 13-14 px headers in text-2 / 600 with `scope=col`, 10 px cells, role names in the heading ink, ticks named "כן" / "לא". Inline styles moved to classes. Status tiles 34 px, md radius. |
| `system-automations.ts` | "מצב" (platform health + the master switch) leads the first column. The presence picker gets the settings select look (36 px, 44 on touch, full width on a phone). Glyphs replaced with sw-icon (arrowUp / arrowDown, check / plus, minus / plus). Pill token instead of `999px`. Focus rings on steppers, order buttons, chips, links; press feedback (scale) and hover wash under a fine pointer; 44 px targets on touch. Role matrix aligned with the schedules page. Same container-query stacking for narrow columns. |
| `schedule-slot-panel.ts` | Header: title (lg / 700, heading ink) with the markers, the summary under it, the actions grouped in their own wrapping toolbar. Labels 13 px / 600. Inputs 36 px (44 on touch), tabular numerals for times and numbers. Groups get the lg radius. Errors in a soft danger box with an icon each (`role=status`); the empty state is a dashed well with an icon. Dead CSS and inline styles removed. |
| `schedule-table-view.ts` | The actions cell keeps `display: table-cell` (the buttons sit in a flex div inside it): the row rule is straight again. Hover wash on rows under a fine pointer; headers 13 px / 600; tabular numerals; the table scrolls sideways inside its own wrapper on a narrow column. Phone cards: lg radius, more padding, the actions under a hairline. The error icon has an accessible name. Empty text explains the next step. |
| `schedule-create-dialog.ts` | Header, tabs and footer stay; only the body scrolls - the actions (and the quick path's sentence) are always on screen. Focus moves to the selected tab on open, Tab is trapped in the box, focus returns to the opener on close. Tabs: roving tabindex, arrow keys (RTL), Home / End, `aria-controls` + `role=tabpanel`. A blocked template shows "דורש חיישן שבת וחג בהגדרות" inline. Chips are pills, 36 px (44 on touch), with press feedback. Section labels md / 700 in the heading ink; title 2xl / 700. Skeleton rows while the catalogue loads. Entrance: the scrim fades and the box lands from 97 % (200 ms, the dialog ease; on a phone the sheet rises from the bottom); reduced motion zeroes it through the shared duration tokens. |

## 3. Evidence

Before screenshots: `docs/evidence/SCHED-POLISH-2331/before/` (5 sizes x settings › schedules (+ dirty save bar, full page),
settings › automations, slot panel, table view, create dialog templates / quick; forbidden state and a script slot at 1440;
`scroll-facts.txt`). AFTER screenshots: NOT_RUN. The after build was started and then stopped on the coordinator's order (the
workstation ran out of memory with 16 agents: no local vite build / preview / Playwright evidence runs). Shoot them on the runner
with the harness, `SHOT_PHASE=after`:
`SW_BASE_URL=<preview> npx playwright test tests/shoot-sched-polish-2331.spec.ts --project=desktop --workers=1`
(writes `docs/evidence/SCHED-POLISH-2331/after/`). The harness is a design-review shoot like `r5-*-shoot.spec.ts`, not a gate spec.

## 4. Tests

| Check | Result |
|---|---|
| `npx tsc --noEmit` (final state) | 0 errors (exit 0) |
| `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl` (`-c playwright.unit.config.ts --workers=1`) | 25 / 25 passed (final state) |
| `unit-empty-state-icons`, `unit-menu-lint`, `unit-page-background` (screen-wide source lints) | 16 / 16 passed (run on an intermediate state, before the last CSS-only edits) |
| `impeccable detect` on the five files | 0 findings |
| Evidence specs: `evidence-schedules-list.spec.ts` (the הגדרות › תזמונים describe blocks), `evidence-schedules-editor.spec.ts` (table view, read-only states, create flow), `evidence-automations-list.spec.ts` (הגדרות › אוטומציות), `evidence-ha2610-compat.spec.ts`, `evidence-mobile-options.spec.ts` (`/system/schedules`), desktop / tablet / mobile | NOT_RUN (coordinator: no local Playwright evidence runs; they run on the runner gate) |
| Before shots (the harness against a preview build of `52a8d9129`) | 27 / 27 shots taken (one 390 table test re-run after a harness fix) |

Selectors and texts the evidence specs read were kept: every `data-*` hook, the help text, the save bar, the dialog ids, the
`[data-create-continue]` disabled attribute, `[data-quick-sentence]` text (it moved from the body into the footer - the specs read
it through the dialog host, so the locator still finds it). Changed visible copy: the table's empty line ("אין משבצות עדיין. "משבצת
חדשה" מוסיפה את הראשונה.") - no spec reads it.

## 5. Pixel baselines likely affected

Any baseline that shoots these surfaces: `layout-visdiff-246.spec.ts` (`settings-schedules`, `settings-automations`),
`layout-schedules-parity.spec.ts` (`settings`), `layout-page-background.spec.ts` (`#/system/schedules`, `#/system/automations`),
`evidence-polish2-295.spec.ts` (`settings-automations`, `settings-schedules`), the bubble chrome screens list
(`bubble-chrome-screens.ts`: `automations-settings`), and the schedule editor shots in `evidence-schedules-editor.spec.ts`
(slot panel, table view, create dialog) and `evidence-schedules-list.spec.ts` (`12-settings*`). Refresh on the runner before the
branch joins a train (owner rule 2026-10-30).

## 6. Proposals for shared files (not done here)

- `styles/settings.ts`: the container-query stacking added locally to both pages (a `.col` that is narrower than label + control
  stacks its rows) would serve every two-column settings page; proposed as a shared rule.
- `styles/settings.ts`: a shared settings `select` look (the automations page had an unstyled one; other pages wrap selects in
  `sw-field`). Either a `.sel` rule in the sheet or the convention "always `sw-field`".
- A shared roles-matrix style: both pages (and the access screens) draw the same role x permission table with local CSS.

## 7. Left / not done

- After screenshots and the evidence specs on desktop / tablet / mobile: run on the runner (above), then refresh the baselines.
- A second look at the after shots for: the two-column class grid at 1180 / 1024 (the container query decides), the phone sheet
  footer height on the quick tab (sentence + three buttons), and the automations column order with "מצב" first.
- The slot panel's and table view's look inside the editor still depends on the editor's own tokens (devices style); the editor
  file itself (`schedule-editor.ts`) and `devices-schedules.ts` were out of scope.
- Shared-file proposals in section 6 for the lead.
