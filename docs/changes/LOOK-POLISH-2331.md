# LOOK-POLISH-2331 - look and branding settings, wave 2 part A

Branch `pilot/LOOK-POLISH-2331` from `origin/main` @ `52a8d9129`. No version bump, not merged.

Scope: `frontend/src/screens/system-brand-logos.ts`, `system-wall.ts`, `system-look.ts`, `system-palette-editor.ts`
(plus one i18n key, `brandLogos.unsaved`, in `src/i18n/he.ts`, and a new evidence spec). No shared design tokens, shared
`sw-*` components, shell or system-nav files were edited.

Design language: the R5-SYSTEM-297 settings ladder (page > card > well, `settingsLadderStyles`), the skin card key of
`system-design.ts` (36 px pill-thumb segmented key), POLISH-CONTROL-297 press / hover rules (press on pointer-down, hover only
under `(hover: hover) and (pointer: fine)`, no motion under reduced motion). Tokens only.

## Critique (before)

Shots: `docs/evidence/LOOK-POLISH-2331/before/` (local vite preview of `52a8d9129`, widths 1920x1080, 1440x900, 1180x820,
1024x768, 390x844).

### Logo and name card (`system-brand-logos`, הגדרות › כללי › מראה המערכת)

| # | Finding | Width |
|---|---|---|
| B1 | The segmented keys are 28 px / 12.5 px with a plain-text selected key, while the skin card right above it on the same page uses 36 px / 14 px keys with the accent ink: two key styles on one page. | all |
| B2 | The tab strip is `role="tablist"` but has no arrow / Home / End keys, every tab is a tab stop, and the panels are not `tabpanel`s tied to their tabs. Tabs are 28 px high. | all |
| B3 | The browser-tab demo is drawn twice on a wide screen (in the names panel and in the preview column). | >= 900 |
| B4 | Nothing says a change is unsaved; the only cue is the save button turning enabled. | all |
| B5 | Phone: the five company sizes wrap into a ragged track ("גדול מאוד" alone on a second line); the three dark-background option cards stack as three tall cards (the panel is three screens long). | 390 |
| B6 | Heading and control rows carry inline styles (`style="font-size..."`, `style="display:flex..."`) instead of classes. | - |
| B7 | Good as is: the permanent preview column, the drop zones (keyboard reachable), the dark-mode option cards on desktop, the footer note. | - |

### Wall display users (`system-wall`, הגדרות › מסכי קיר)

| # | Finding | Width |
|---|---|---|
| W1 | The list table sits bare on the page background (no card), with a 12.5 px body and a grey header; the actions column has no header name. | >= 721 |
| W2 | The empty state is a card inside a card (`sw-state-panel` is its own hero card since R5-SYSTEM-297, and the screen wrapped it in `sw-card`), and it does not offer the first step. | all |
| W3 | Drawer: the status-strip items and the alert categories are 30 px circles showing the first two letters of each name ("שע", "תא", "מצ"; "בט", "הת", "דל", "תק", "אב") - unreadable without hovering. | all |
| W4 | Drawer: the day, strip and category checkboxes are `display: none` - they cannot be reached or toggled from the keyboard. | all |
| W5 | Drawer: the camera reorder buttons are text glyphs (▲ ▼) with a generic name; the chosen order is not visible. | all |
| W6 | Drawer: sections are only separated by margin; selects have random widths (each sized to its content); long labels squeeze the control on a narrow drawer. | all |
| W7 | Toolbar: the count is loose text ("3 מסכים"), the limit is unknown until the add button silently disables; an error is shown in the stale (amber) tone. | all |
| W8 | Remove dialog paragraph uses an inline style. | - |
| W9 | Good as is: drawer footer (save / cancel) is outside the scrolling body, so the actions are always visible; phone shows cards, never a shrunken table; loading and error states use the shared panel. | - |

### Look dials and palette editor (`system-look`, `system-palette-editor`)

The card is not reachable in the product while the bubble skin is frozen (`BUBBLE_SCREENS_ENABLED` is false,
BUBBLECLEAN-297); the evidence spec mounts the registered element by hand to review it.

| # | Finding |
|---|---|
| L1 | Thirteen dial rows in one unbroken list; no grouping. |
| L2 | Keys have no press feedback and no hover wash. |
| L3 | The skin note is 11 px tertiary text; the preview's decoration uses a 30 px radius literal. |
| L4 | Palette editor: the open editor is an unmarked run of controls under the palette row (separated by an inline-styled border); the swatch chips are 26 px; the delete button of a custom palette is icon-only without an accessible name. |

## Changes

### `system-brand-logos.ts`
- Keys (B1): 36 px, 14 px, accent ink on the lifted thumb (same as the skin card on the page), hover wash under a fine pointer,
  disabled-unselected at 0.6 opacity.
- Tablist (B2): roving tab stop, ArrowLeft / ArrowRight (RTL aware), Home / End, `aria-controls`, panels are `role="tabpanel"`
  with `aria-labelledby`; tabs 36 px with press feedback.
- The names panel's browser-tab demo shows only below 900 px where the preview column is a tab (B3).
- Footer: a "שינויים שעוד לא נשמרו" status pill while the draft differs from the saved values (B4; i18n key `brandLogos.unsaved`).
- Phone (B5): a wrapped key row fills its lines evenly; each dark-background option becomes a compact row (swatch 112 px beside
  its text).
- Inline styles replaced by classes (`.bhead`, `.ctlrow`, `.main`, `.grow`); the heading steps up to the settings card title
  (20/700) (B6).

### `system-wall.ts`
- Adopts `settingsLadderStyles` (the R5 card step).
- List (W1): the table sits in a flush `sw-card`; header 12.5/600 in text-2 with a hairline; body 13 px; name 14/600 in the
  heading ink; row hover wash under a fine pointer; tabular numbers; `scope="col"` and a screen-reader "פעולות" header; edit /
  remove buttons carry icons. Phone cards: the cameras line is labelled and the overload warning shows there too.
- Empty state (W2): no card around the hero panel; the panel offers "הוספת משתמש מסך".
- Drawer (W3, W4): the status strip and alert categories are full-name chips; days are 36 px chips; every chip's checkbox stays
  in the tab order (visually hidden over the chip) with the focus ring on the chip; selected = accent soft + accent ring.
- Cameras (W5): each camera is a well row (accent soft when chosen) with its order number, a clickable label, and icon-only
  up / down buttons named per camera ("הקדמה: מצלמה 1"); a line says how many are chosen (up to 12).
- Drawer layout (W6): sections are headed groups (15/700) divided by a hairline; a setting line wraps its control under the
  label when narrow; selects share one width (flex 0 1 220 px, min 160 px); the wake windows are wells with an icon-only remove.
- Toolbar (W7): "n / max מסכים" pill (warning tone at the limit, with a title); errors in the danger `.msg` pill.
- Remove dialog paragraph: a class (W8).
- Selectors used by the existing specs are unchanged (`data-wall-*`); new hooks: `data-wall-strip`, `data-wall-no-cat`.

### `system-look.ts`
- Group headings: פריסה / שקיפות, גודל ומגע / חומר ועומק / צבעים / תצוגה מקדימה (L1).
- Press feedback and fine-pointer hover on every key; reduced motion turns the transition off (L2).
- The skin note is a 12.5 px pill with an info icon; the 30 px literal radius is `--sw-r-xl` (L3).

### `system-palette-editor.ts`
- The open editor is a well (surface-2, 1 px inner border, `--sw-r-lg`) with a heading ("ערכה חדשה" / "עריכת ערכה: name");
  colour cards sit on the surface inside it; the inline style is gone (L4).
- Swatch chips 28 px with press feedback; segmented keys press.
- The delete button is icon-only with the name "מחיקת <palette>" until the confirm step, which turns it into a danger button
  labelled "לאשר מחיקה".

## Not changed (owner rules / scope)
- No feature, setting or data removed; every behaviour choice stays where it was.
- No page scroll added: these are settings pages (they scroll vertically by design; the drawer scrolls inside with fixed actions).
- `system-tabs-mode.ts` / `system-tabs.ts` / tab strips untouched.

## Proposals for shared code (not done here)
- `sw-state-panel`: an empty state placed inside an `sw-card` draws a card in a card; a `bare` / `inset` variant (or the
  panel detecting a card parent) would fix every screen that still wraps it.
- `styles/settings.ts`: export the visually-hidden-checkbox chip (`.chips label:has(input:checked)`) used here, so the
  settings screens share one keyboard-safe toggle chip.
- `settingsSegStyles` (accent-filled, divided keys) and the pill-thumb key of `system-design.ts` / `system-nav-size.ts` /
  this card are two settings key styles on one page; the lead should pick one and move it into `styles/settings.ts`.

## Tests

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl` (`-c playwright.unit.config.ts --workers=1`) | 25 passed, 0 failed |
| `tests/evidence-look-polish-2331.spec.ts` (new) | before run on the `52a8d9129` build (screenshots only): 14 passed; the tablist keyboard test failed as expected (the behaviour did not exist yet). After run: NOT_RUN (workstation out of memory, coordinator order: no local build / preview / Playwright evidence; it runs on the runner gate). |
| `evidence-brand-logos`, `evidence-wall`, `evidence-wall-alerts`, `evidence-wall-plan`, `layout-wall-plan`, `pixel-wall-plan` | NOT_RUN (same reason) |
| `evidence-bubble-foundation`, `evidence-material-dials`, `evidence-palettes` | skip themselves while bubble is frozen |

After screenshots: NOT taken (no local build allowed); `docs/evidence/LOOK-POLISH-2331/after/` is to be filled by the runner
run of the new spec (`SW_SHOTS=../docs/evidence/LOOK-POLISH-2331/after`).

## Pixel baselines likely affected
- `pixel-wall-plan.spec.ts` (`wall-settings-map-classic.png`, `wall-settings-map-crystal.png`): the drawer's map section
  (section divider, heading size, select width).
- Any whole-page pixel shot of הגדרות › כללי that includes the logo card (keys, heading size, tab height). None found by grep
  in `tests/pixel-*.spec.ts`, but the R5 settings shoot harness / design-review shots of the general tab will differ.
- `evidence-wall` / `evidence-brand-logos` screenshots (not baselines, evidence only).
