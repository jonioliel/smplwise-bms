# DEVICES-POLISH-2331 - polish of the layout editor, the device controls and the automations screen

Branch `pilot/DEVICES-POLISH-2331` from `origin/main` 52a8d9129. No version bump, no migration, no backend change. Frontend only.
Design language: the HOMEFABLE-297 / R5-DEVICES-297 screens; tokens only (unit-token-lint).

Overlap kept clean: no edit to `devices-synoptic*`, `devices-building.ts` or any slider rendering line in `devices-controls.ts`
(the brightness / position / tilt / fan `<input type="range">` lines are byte-identical).

## Critique (before, light; 1920 / 1440 / 1180 / 1024 / 390)

Automations (`devices-automations.ts`)
- No page scroll at any size with the fit on (the default); the rows / cards / empty / offline / loading states all fit.
- Loading drew six CARDS even when the rows view (the default) was about to land: the list jumped from a card grid to a rows list.
- The skeleton carried inline px styles (padding 18px, radius 24px) and the note (toast) white / `#ff453a` literals - the only
  reason the screen sat in the token lint's ALLOW_HEX list ("the automation card glyphs", a stale reason).
- At 1024 the header takes three rows (kinds + state filter, then search + new); the cards view then fits one row of two cards
  per page. Left as is (owner-approved POLISH-295 header) - see "Left".
- On a phone the rows cut the name to a few letters (the run summary keeps its width) - that is `sw-automation-row.ts`, outside
  this scope; see "Left".

Device controls (`devices-controls.ts`, drawn by the area screen's rows, the area pop-up and the tiles panel)
- Mode menus (hvac / fan / preset / swing / humidifier) were smaller, flatter boxes (3 px 6 px, plain border, no lift) beside the
  sm buttons; minus / value / plus and the menus did not read as one row of controls.
- A cover with a tilt showed two wrapped rows of buttons and sliders with nothing separating the two movements.
- An armed open / close ("לאשר פתיחה?") changed only its word; the confirming tap had no visual state.

Layout editor (`devices-layout.ts` + its CSS `devices-layout-css.ts`)
- The card panel was one flat column of ~15 fields with equal gaps; the colour note sat at the very bottom, far from the colours.
- Width / height fields sat 17 px apart at 1440 when the height label wrapped to two lines.
- The move pad used Unicode arrows (▲ ▼ → ←) instead of the product's icon set; the tile breadcrumb likewise (→ ‹).
- Three dialog action rows used inline styles.
- At 1024 the 300 px side panel leaves the 12-column preview about 560 px wide (tile names clipped) - see "Left".

## Changes

| Before | After | Why |
| --- | --- | --- |
| `.ctl-select` 3px 6px, `--sw-border`, `--sw-r-sm`, no lift | `--sw-ctl-h-sm` height, `--sw-r-xs`, `--sw-border-strong`, `--sw-shadow-1`, hover wash (fine pointer), disabled 0.55 | one control family with sw-button size sm |
| tilt row flush under the position row | dashed hairline + `--sw-s-2` above `[data-control=cover-tilt]` | two movements, two groups |
| armed open / close: word only | `variant=primary` while armed (cover and tilt) | the confirming tap is a visible state |
| gaps 6px, value 34px | `--sw-s-1h`, `4ch` | token scale |
| panel: one flat list | four `.lay-grp` groups (look / size and place / content / actions), hairline between | hierarchy; fields, attributes and texts unchanged |
| colour note + height note as one closing paragraph | each half under the fields it explains | grouping (same words) |
| `▲ ▼ → ←` | `arrowUp` / `arrowDown` / `chevronBack` / `chevron` (sw-icon, chevrons mirror in RTL) | drawn icons, not glyphs |
| `.lay-row2` top-aligned | `align-items: end` | the two inputs share a baseline |
| inline `style="display:flex;gap:8px..."` x3 | `.lay-dlg-acts` | no inline styles |
| loading = 6 cards always | rows skeleton for the rows view, cards otherwise; `טוען…` for screen readers | no jump when the list lands |
| toast `rgba(255,255,255,.1)`, `#fff`, `#ff453a` | `--sw-toast-text` / `--sw-toast-action` mixes, danger mixed toward the toast ink | inverted-surface tokens |
| ALLOW_HEX entry for devices-automations.ts | removed (no literal left; the lint's stale rule needs it) | the drift guard reads the file again |

Every feature, data attribute and text is kept. No behaviour change in what is sent to a device.

## Evidence
`docs/evidence/DEVICES-POLISH-2331/before/` and `after/` (light; 1440 / 1024 / 390, plus 1920 / 1180 for the editor panel), with
`metrics.txt` (page scroll, horizontal scroll, inner scrollers > 200 px per shot). Harness (not a test, skips without `DP_OUT`):
`frontend/tests/devpolish-2331-shoot.spec.ts` - mocked API (tests/bubble-mocks.ts) for the area screen and the editor, the demo
mode for the automations screen.

Scroll facts (after): automations - no page and no inner scroll in any state at any size. The area screen scrolls inside `main`
before and after (it is not a no-scroll control screen in this pass; +9 px after, the menus are 26 px tall); the editor panel
scrolls inside itself as before (+51 px from the group separators).

## Pixel baselines likely affected
- None of the committed Linux baselines show these surfaces as far as found: `visual-matrix` (devices-home / building / schedules,
  a synthetic dialog) does not draw the area rows, the editor or the automations list. If the runner's visual matrix shows the
  area pop-up with a climate or cover row, those shots move (menu height, tilt hairline).
- The R5 shoot images (`r5-devices-shoot`: auto-rows, auto-cards, area-cards, tiles-panel) and the evidence screenshots of
  evidence-automations-list (loading state) and evidence-devices (layout panel, live) will differ - evidence, not baselines.

## Left
- Phone automations rows: the name is cut to a few letters (`sw-automation-row.ts` phone grid gives the run summary its width) -
  the R5 fix for the schedule rows (30vw next-run column) should be applied there; out of this scope.
- Layout editor at 768-1199 px: the 300 px side panel squeezes the 12-column preview; options for the owner: a narrower panel, or
  the phone's bottom sheet below 1200 px (a setting).
- Climate menus show the entity's raw fan / swing values (`auto`, `off`, `low`...) and the area row's detail line shows them raw too;
  a Hebrew map for both (like PRESET_HE) needs devices-area.ts as well.
- Automations at 1024: a three-row header; the cards view fits two cards per page.
