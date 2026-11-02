# SETUPPLAN-POLISH-2331 - setup and plan admin polish (wave 3)

Branch `pilot/SETUPPLAN-POLISH-2331` from `origin/main` @ 52a8d9129. No version bump, no merge.

Scope (only these files were edited): `frontend/src/screens/system-setup.ts` (הגדרות › חיבורים),
`frontend/src/screens/system-plan-view.ts` (הגדרות › מפה › תצוגה ריאליסטית),
`frontend/src/screens/plan-area-links-admin.ts` (הגדרות › מפה › קישור חדרים לאזורים) and
`frontend/src/screens/plan-studio6-panel.ts` (the plan editor's material field, north card and walk positions card).
No shared design token, shared `sw-*` component, shell or system-nav file was touched; `styles/settings.ts` is only imported.

Reference language: the R5-SYSTEM-297 settings ladder (`styles/settings.ts`: card / well / fact-row, the filled-accent
segment, the `.msg` result pill, the `.foot` action row) and the R5-MAPS-297 plan-studio panel controls (44 px touch dial,
press feedback, hover only under a hovering pointer). Skills applied: impeccable (Operate mode, refinement - the incumbent
identity, copy and behaviour are kept), emil-design-eng (press feedback, transition properties, reduced motion), ui-ux-pro-max
(the two data tables).

## Critique

Method note: the brief's memory rule forbids `vite build` / `vite preview` / Playwright evidence specs on this workstation, so
the critique at 1440 / 1920 / 1180 / 1024 / 390 was done from the source (the templates, the stylesheets, the media queries and
the settings vocabulary each screen sits next to), not from rendered screenshots. Findings that only a render can confirm are
marked (render check).

### הגדרות › חיבורים (system-setup.ts)

1. Result and error lines were all `.hint` grey body text: "בוצע ונרשם באודיט", a failed NVR write and a load error looked the
   same, with no `role`. The settings vocabulary has `.msg ok / err` (a tinted pill with its icon) for exactly this.
2. The NVR notify matrix said yes / no with the text glyphs ✓ / ✗ (a font's guess, not the icon set; craft floor: no Unicode
   glyphs standing in for icons). The legend repeated the glyphs.
3. The matrix had no scroll box: a 16-channel recorder with long camera names widens the card past a 390 px phone (page-level
   horizontal scroll). Header weight was a literal `500`, header cells had no `scope`, the action column header was empty for a
   screen reader, numerals were proportional.
4. Three dialogs set their body text with inline `style="font-size…;line-height…"` (three slightly different line heights).
5. "שינויים אחרונים ב־NVR" was a `<b>` in a hint with an inline `margin-block-start:8px`, while the same card's other sections
   use the `.syshead` section head (icon, label, rule). The change list was an indented bullet list at 11 px.
6. On a phone the fact rows (`.check`) keep the label and a 60 %-wide value on one line; long values (a discovery error, a
   S.M.A.R.T. line) squeeze the label to a sliver (render check).
7. Copy contradiction (NOT changed - factual copy, owner decision needed): the "איפה מגדירים" card ends with
   "משתמש ה־NVR צריך הרשאות צפייה והקלטות בלבד; Arx לא כותב ל־NVR", but the same page has offered approved NVR writes
   (Notify Surveillance Center, clock / NTP, S.M.A.R.T. test, alarm-output pulse, reboot) since 0.1.64 / 0.1.71. See question 1.
8. Kept as is (by rule): the page is a settings page, not a control screen, so it scrolls; every card, field, hook and action
   stays.

### הגדרות › מפה › תצוגה ריאליסטית (system-plan-view.ts)

1. The card sits on the map settings tab directly under a card in the settings vocabulary, but carried its own older copy:
   hairline rows instead of wells, base / medium labels instead of the settings `--sw-fs-lg` / semibold, a grey 11 px `h4` caption for its sub-sections, a
   thumb-style segment (surface thumb on a grey track) instead of the settings' filled-accent segment, and the saved / error line
   as a bare coloured word. Two visual languages on one tab.
2. The scope switch "למי" (my preference vs the installation default) changes the meaning of every row below it but looked like
   just another row.
3. On the installation target nothing said there was an unsaved draft except the enabled "שמור" button.
4. The range rows' "לפי ההתקנה" chip had no press feedback and its pressed state was a faint wash.

### הגדרות › מפה › קישור חדרים לאזורים (plan-area-links-admin.ts)

1. The counts were plain grey text runs ("מקושרים 3 הצעות 2 ...") - status without a field.
2. The toolbar put the primary "אשר הצעות" between two secondary buttons.
3. The row select was 3 px / 6 px padded (about 26 px tall): below the touch floor and smaller than every other settings control;
   no accessible name per row (only the visible column header).
4. On a phone the table hid the floor column (data lost on that width) and still laid out four columns with a 220 px select
   (horizontal overflow at 390 px - render check).
5. "No rows match the filter" had no way back except finding the filter again.
6. Result / error lines: plain coloured words, the error without `role="alert"`; literal `font-weight: 600`; `--sw-success`
   fallback to the accent for text (contrast not guaranteed).

### Plan editor cards (plan-studio6-panel.ts)

1. No press feedback on any of the cards' buttons, swatches or segments (the R5 panels give on pointer-down).
2. Hover washes were not gated to a hovering pointer: on a tablet a tap left the grey wash on the walk row's icon buttons.
3. A focused walk row (`.on`) added inline padding, shifting its contents sideways by 6 px on every focus change.
4. The armed row (placing a position on the plan) was only marked through its move button; the default ("start") position's
   star was a pressed wash, not a filled mark.
5. Literals: `border-radius: 3px`, `font-weight: 700`; text inputs in the walk row had no visible focus ring of their own.
6. Phone: the editor is desktop-only (existing rule, layout-st7-ui starts at 768 px); not changed.

## Changes

- `system-setup.ts`: result / error lines are `.msg ok|err` with an icon and `role=status|alert`; the tone comes from state set
  with the text (`sysOk`, `notifyOk`, `wiskeyOk`), never parsed from it. The notify matrix sits in its own scroll box (a well),
  with `scope` headers, a screen-reader name for the action column, tabular numerals, a hover row under a fine pointer and drawn
  check / cross chips (`role=img` with a label) instead of ✓ / ✗, in the legend too. The dialogs' body text is one `.dlgtext`
  class. "שינויים אחרונים ב־NVR" is a `.syshead` section head; the change list is a flat hairline list with tabular timestamps.
  On a phone the fact rows wrap (label above a full-width value). Every `data-*` hook and every text is unchanged.
- `system-plan-view.ts`: takes `settingsStyles` (wells, labels, filled-accent segment, `.msg`, `.foot`) and keeps only its own
  44 px touch dial, a wrapping segment, the range row and the site fields. The scope switch heads the card (no well, a rule under
  it); sub-section heads are real headings (`h4.sub`, `--sw-fs-md` bold in the heading ink); "יש שינויים שלא נשמרו" (`data-view-dirty`) shows
  next to "שמור" on a draft; the saved / error lines are `.msg` pills (`data-view-message` kept, `data-view-error` added); the
  range chip has press feedback and a filled pressed state.
- `plan-area-links-admin.ts`: takes `settingsStyles`; counts are tinted pills (linked = success, suggestions = accent, dangling =
  danger) with bold tabular figures; the toolbar is a `role=toolbar` with the primary action last at the end; the table sits in a
  well with a quiet header, `scope` headers and screen-reader names for the pick / action columns, suggested rows lightly tinted,
  36 px selects (44 px on a phone) with a per-row `aria-label` and a focus ring; the suggestion line carries a link icon and the
  dangling note a warning icon; on a phone each room is a stacked block (pick, room, unlink on top; the full-width select under
  it) and the floor moves under the room name instead of disappearing; the filtered-empty state offers "נקה סינון"; result lines
  are `.msg` pills, the footer renders only when there is something to say.
- `plan-studio6-panel.ts`: press feedback (`--sw-press-scale`, `--sw-t-press`, transform only, 0 ms under reduced motion) on
  the text buttons, swatches, the reset button, the style segment and the walk row buttons; hover only under
  `(hover: hover) and (pointer: fine)`; the walk row keeps a constant inline padding (no shift on focus), the armed row gets an
  accent ring, the default star is filled in the warning hue, the last row drops its hairline; focus rings on the walk row's
  name / level / heading inputs; `3px` -> `--sw-r-2xs`, `700` -> `--sw-fw-bold`.

## Proposals for shared files (not done here)

- `styles/settings.ts`: a `.tablewrap` (well-backed scroll box) and a `.yn` yes / no chip are now defined locally in two
  screens; they belong in the settings sheet if a third screen needs them.
- `styles/settings.ts` `.seg`: a `wrap` modifier (flex-wrap instead of `flex: none` + overflow hidden) for long option lists
  would let system-plan-view drop its local override.

## Owner questions

1. "איפה מגדירים" says "Arx לא כותב ל־NVR" while the page offers approved NVR writes. (a) change it to "Arx כותב ל־NVR רק
   בפעולות המאושרות בכרטיסים שלמעלה, ורק עם הרשאה רגישה"; (b) remove the sentence; (c) keep it.

## Tests

| Test | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (exit 0) |
| `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl` (gating lints) + touched unit specs `unit-studio6-ui`, `unit-wxunblk`, `unit-door-emergency-roles-emrole-295` - `playwright.unit.config.ts`, `--workers=1` | PASS 48 / 48 |
| impeccable `detect` over the four files | 0 findings |
| Evidence / layout specs: `evidence-st7-ui`, `layout-st7-ui`, `evidence-k88-plan-advanced`, `evidence-wiskey-credentials`, `evidence-nvr-connection`, `evidence-multi-nvr`, `layout-multi-nvr`, `evidence-nvr-less`, `evidence-secrets-card`, `layout-secrets-card`, `evidence-bridge-key`, `evidence-frigate-settings`, `evidence-provision-connection`, `evidence-review-fixes`, `evidence-remote-blocked-calls`, `evidence-nn1-p2` | NOT_RUN (memory rule: no vite build / preview / evidence specs on this workstation) - for the runner gate |
| Before / after screenshots (`docs/evidence/SETUPPLAN-POLISH-2331/`) | NOT_RUN (needs a preview build; same rule) - capture on the runner |

Runner checks worth watching: `layout-st7-ui` (the plan-view card now uses the settings `.seg` with borders and the settings
`.row` wells - the 44 px targets are kept, the segment wraps instead of clipping at 320 px); `evidence-k88-plan-advanced` (the
counts now read "הצעות ‎1" across a `<b>`, which the spec's `\s*` regex accepts; the accept buttons changed order, the spec
clicks them by hook).

## Pixel baselines likely affected

No committed pixel baseline covers these screens (`visual-matrix` `settings-diagnostics-ready` is the General tab; the
`pixel-*` specs do not open הגדרות › חיבורים, הגדרות › מפה or the editor's Studio 6 cards). Screens whose look changed and that
a future baseline would pick up: הגדרות › חיבורים (status pills, matrix), הגדרות › מפה (the realistic-view card and the
link table), the plan editor's material / north / walk cards.

## Left

- Rendered verification at the five widths and the before / after screenshots (runner).
- The evidence and layout specs above (runner gate).
- Owner question 1.
