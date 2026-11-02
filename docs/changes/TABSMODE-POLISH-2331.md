# TABSMODE-POLISH-2331 - tabs display settings polish (wave 2, part B)

Branch `pilot/TABSMODE-POLISH-2331`, from origin/main 52a8d9129 with origin/fix/SETTINGS-TABS-SCROLL-2331 (86cf59129, the shared
tab strip's arrows / wheel / keys) merged in first (fast-forward). No migration, no API change, no version bump.

Scope: `frontend/src/screens/system-tabs-mode.ts` (the display cards) and `frontend/src/screens/system-tabs.ts` (the tabs editor that
hosts them), page `#/system/diagnostics?tab=tabs` (Settings > General > Tabs). No shared token, component, shell or tab-strip file
was edited.

## Critique (before)

The screen was read from source against the settings ladder of R5-SYSTEM-297 (`styles/settings.ts`: card > well > control), the
HOMEFABLE-297 hierarchy and POLISH-CONTROL-297. No rendered capture was made locally (see Tests: the workstation memory rule forbids
vite build / preview here), so the per-width notes are layout reasoning from the CSS, to be confirmed on the runner.

### All widths
1. **The cards touched.** `system-tabs-mode` renders six `sw-card`s inside one `display: block` host; `sw-card` has no outer
   margin and the parent's `.sections` gap only spaces direct children, so the six display cards sat edge to edge (one tall
   double-bordered slab) while every other card on the page had 16 px between them.
2. **No ladder.** The display cards kept a pre-R5 look: 6 px plain legends, bare radio lists, hand-rolled selects with a soft border
   and no focus ring, a dashed preview box. The sibling cards of the same page (bar style, sections) were already on
   `settingsStyles` - the page mixed two visual languages.
3. **Owners not told apart.** Both columns ("installation default" / "my preference") looked identical; whose value it was, and why
   the installation column was disabled for a non-administrator, was a single grey line at the bottom of ONE card's column (the
   tabs card) and absent from the other four cards with the same split.
4. **Density without hierarchy.** The dropdown style card holds 48 selects (4 dials x 6 rows x 2 owners). The style dial alone was
   split into two fieldsets ("installation default" + "by group") while size / ring / panel were one fieldset each, so the four
   blocks of one column did not read as a series; the "all groups" row had no weight over the group rows.
5. **"Active for me now"** listed the value and its source in the same grey run; the source (own / installation / group) is the
   interesting part and was the least visible.
6. **Feedback jumped.** The saved / error line appeared and vanished below the card (2.5 s), moving everything under it; a second
   save inside 2.5 s was cut short by the first save's timer.
7. **Previews:** the eight style samples and three size samples were unlabelled as a group and the active one was not marked
   (the size row appended "(הפעיל)" to the label, the style row nothing).
8. **Saving models mixed without a word.** The display cards save at once (every radio / select is its action); the bar style and
   section cards below save with the sticky bar. Nothing on the page said which is which.
9. **Error state:** when `GET /settings` failed, the editor drew the registry defaults as if they were the stored value, with the
   error only in the save bar (where it then read "administrator permission required").
10. **a11y:** the settings-navigation radios had no group name (fieldset without legend); the reorder keys were 40 px also under a
    finger; two notes used inline `style=""`.

### Desktop 1440 / 1920
Two owner columns at ~430 px each inside the 880 px settings column: fine width, but the column heads were missing (finding 3) and
the style card is one long run. 1920 changes nothing (the settings column is capped at 880 px).

### Tablet 1180 / 1024
Same two columns; the per-group select at `max-inline-size: 60%` of a ~400 px column truncates the longer follow labels
("לפי ההתקנה (כרגע: כמוסות ופסים)") in the closed select - acceptable (the open list shows it whole), kept.

### Phone 390
One column (767 px rule): every card doubles in height and the owner of each half is only known from a 6 px legend. The tile
pattern and the column heads matter most here.

### Control-screen rule
This is a settings page, not a control screen: vertical page scroll is the settings pattern (sticky save bar), so no scroll
container was added or removed.

## Changes (after)

`system-tabs-mode.ts`
- Host is a flex column with the page's card gap: the six cards no longer touch.
- Owner columns are wells (`--sw-well`) with a **column head**: title + "who" line ("for every user until a user picks otherwise" /
  "only me; wins over the default"), and for the installation the reason it is read-only (lock icon + administrator permission, or
  demo data). The old bottom-of-column note moved into the head and now shows on all five split cards (`data-inst-note`).
- Radio choices are **tiles**: surface on the well, accent border + accent-soft fill when checked, focus ring via
  `:has(input:focus-visible)`, press feedback (`--sw-press-scale`), hover only under `(hover: hover) and (pointer: fine)`, unchecked
  disabled tiles fade, the checked disabled one stays readable. The native radio stays (keyboard, form semantics, specs).
- The style dial is one fieldset like size / ring / panel ("סגנון התפריט הנפתח": all groups + per group); every dial's
  "all groups" row leads in semibold, group rows follow on hairlines; ring and panel say they apply to the capsule style only.
- Selects: strong border, focus ring, disabled fade, 44 px under a coarse pointer.
- "Active for me now" is a fact list; the source is a quiet pill. One-value cards (phone, picker, placement) end on an accent-soft
  summary strip with a check glyph.
- Resets sit in one row with the reset glyph.
- Saved / error line: an icon pill (success / danger soft) in a reserved 28 px slot; `flash()` restarts its timer.
- Previews: a group caption ("all styles, at the active size" / "the three sizes, capsule style") and the active sample carries an
  accent border and a "הפעיל" badge (the `.muted` label text is unchanged, a spec reads it).
- Settings-navigation radios: a visually hidden legend (localised card title), the two choices side by side when there is room.
- Phone card got a subheading. Reduced motion: transitions off. Bubble (frozen) keeps the flat columns.

`system-tabs.ts`
- Two headed groups: **תצוגה** ("every choice here saves at once") before the display cards, **הלשוניות של כל אזור** ("saved with
  the 'שמור' button at the bottom") before the bar style and section cards (`data-tabs-group`).
- Intro paragraph capped at 72ch, secondary ink.
- Setting rows (`.srow`) are wells like `.row` of the settings pages (bubble keeps the hairline); their selects get the focus ring.
- Hidden tab rows are dashed and transparent (besides the strike-through); row hover under a fine pointer; reorder keys get press
  feedback and 44 px under a coarse pointer; inline styles replaced by `.note`.
- Load failure: `sw-state-panel state="error"` with "נסה שוב" (`data-tabs-load-error`) replaces the bar-style and section cards,
  and the save bar is hidden; the display cards above still work (they load on their own).

Kept on purpose: every `data-*` hook, every input / select, the 10-row counts the specs assert (5 groups x 2 owners), all Hebrew
labels the specs read, the save model of each card.

## Proposals (not built - shared or behaviour changes)
- **Group x owner matrix.** The dropdown style card would halve in height as one table per dial (rows = groups, columns =
  installation / mine). It changes the DOM the specs count (`[data-dd-*-group-row]` = 10) - needs an owner yes and a spec update.
- **Collapse the capsule-only dials** (ring, panel) when no group resolves to the capsule style - a behaviour choice; if wanted it
  should be a setting, per the owner rule.
- **Shared tile choice.** The radio-tile pattern now exists locally here; if other settings screens want it, it belongs in
  `styles/settings.ts` next to `.seg` (a shared-file change, not made here).

## Tests
| What | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (exit 0) |
| unit gating lint: `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl` + `unit-tab-strip` (playwright.unit.config.ts, --workers=1) | PASS 37/37 |
| impeccable detector on both files | 0 findings |
| evidence specs on this screen: `tabs-mode-apply`, `evidence-tabs-dropdown-settings`, `dropdown-styles`, `dropdown-capsule`, `dropdown-phone-choice`, `dropdown-picker-choice`, `evidence-tabs-ui`, `evidence-tabs-styles`, `evidence-tabset-293`, `evidence-tabs-live`, `evidence-serviceia3-scopes`, `layout-settings-nav-295`, `layout-visdiff-246` | NOT_RUN (workstation memory rule: no vite build / preview / Playwright evidence locally) - for the runner gate |
| before / after screenshots in `docs/evidence/TABSMODE-POLISH-2331/` | NOT_RUN (same reason) - to capture on the runner at 1440 / 1920 / 1180 / 1024 / 390 |

## Pixel baselines likely affected
- `layout-visdiff-246` - `settings-general-tabs` (`#/system/diagnostics?tab=tabs`).
- `bubble-chrome-screens` users (`evidence-bubble-lists`, `layout-bubble-lists`) - entry `settings-tabs`: bubble keeps its flat
  columns, but the column heads, tiles, group headings and status slot are new content.
- Any evidence capture of the tabs settings page (`evidence-tabs-*`, `dropdown-*` screenshots, `layout-settings-nav-295`).
Per the owner rule the branch refreshes these on the runner before it joins a train.

## Left
- Runner: the evidence specs above, the before / after captures, the baseline refresh.
- Owner decisions on the three proposals.
