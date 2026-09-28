# Device-control screens: styles, palettes and knobs (CR-007 slice 6a)

This document covers how the "חשמל והתקנים" screens look, and how a designer adds a new look without touching the
screens. The screens are the building screen, the area screen, and the bulk popover and dialog. The source of truth is
**one file**, `frontend/src/styles/devices-themes.ts`. Its `DEVICE_THEME_KNOBS` map repeats the role of every knob
listed below.

## 1. Settings and attributes

| Setting (הגדרות › חשמל והתקנים) | Values | Attribute on the screen's host | What it selects |
|---|---|---|---|
| `devices.style` | `smplwise` (default), `glass` | `data-devices-style` | The **structure**: which element rules apply. |
| `devices.theme` | `default` (the only one registered) | `data-devices-theme` | The **palette**: the values of the `--dv-*` knobs. There is no picker yet (slice 6b). |
| `devices.density` | `comfortable` (default), `compact` | `data-devices-density` | Tighter tiles, rows and gaps, in either style. |
| `devices.default_view` | `cards` (default), `tiles` | none | The building screen's first view. A viewer's own toggle wins (localStorage `sw.devices.layout`). |
| `devices.show_sensors` | `true` / `false` | none | The sensors card on the area screen and the sensors count on the building screen. |
| `devices.show_climate_strip` | `true` / `false` | none | The "מזגנים" strip on the building screen and on each floor. |

These settings are per installation. Everyone reads them through `GET /settings`. Changing them needs
`system.configure`, and every change is audited as `settings.update`.

- **`smplwise`** matches no rule in the theme file. The screens keep the product's v2 tokens
  (`frontend/src/styles/tokens.css`) and stay pixel for pixel as before 6a. This was checked by a before/after capture
  of the building view (both layouts) and the area screen, on desktop and phone. A smplwise palette is possible if
  wanted: add a block on `:host([data-devices-style='smplwise'][data-devices-theme='<id>'])` that overrides `--sw-*`
  tokens directly.
- **`glass`** is the approved mockup (board 6 of `https://claude.ai/artifact/6NnnMPQR62w3mqyNwGjtwZ`). Its element
  rules live next to each screen's template: `BUILDING_GLASS` in `devices-building.ts` and `AREA_GLASS` in
  `devices-area.ts`. They read **only** `--dv-*` knobs, never a literal colour, radius, shadow or size. The only
  literals left are small structural ones: the segmented control's 3 px inset, a few 2-8 px inner gaps, the bar
  thickness and the glow spread. The compact density
  rules are separate and keep their own fixed sizes.

The side rail, the top bar and every other screen never carry these attributes and are unaffected. The glass style is
our own token set inspired by DomusUI's look (`docs/integrations/domusui/DOMUSUI_EXTRACTION.md` §5). No DomusUI code or
CSS (GPL-3.0) is used.

## 2. The three layers in `devices-themes.ts`

1. **Bridge.** The glass style maps its knobs onto the v2 tokens on the host, for example
   `--sw-surface: var(--dv-surface)` and `--sw-r-md: var(--dv-radius-md)`. Every nested shared component (sw-page,
   sw-card, sw-kpi, sw-button, sw-badge, sw-toggle, sw-chip, and the sw-dialog of the bulk dialog) follows by plain
   CSS inheritance. `--sw-glass-blur` carries the material. The bulk popover (`devices-bulk.ts`) and `sw-dialog` read
   it with a `none` fallback, so it has no effect outside a glass device screen.
2. **Palettes.** Each palette sets every knob, on
   `:host([data-devices-style='glass'][data-devices-theme='<id>'])`, in up to three blocks:
   - a **light** block, which is the default;
   - a **dark** block under `@media (prefers-color-scheme: dark)`, which only needs the knobs that differ;
   - an optional **phone** block under `@media (max-width: 767px)`, for sizes only.
3. **Fallback.** Without `backdrop-filter` support, or when the viewer asks for less transparency
   (`prefers-reduced-transparency: reduce`), the bridge swaps in `--dv-surface-solid` and `--dv-surface-2-solid` and
   turns the blur off. The layout stays the same.

**Light and dark.** The app itself is light only (`tokens.css` sets `color-scheme: light`). The glass style follows the
viewer's operating-system colour scheme through `prefers-color-scheme`: the light block by default, the dark block (the
mockup's own dark board) on a dark-mode device. `--dv-color-scheme` sets native form controls and scrollbars to match.

**Motion.** The only movement is the area tile's hover lift (`--dv-hover-lift`). It applies only under
`prefers-reduced-motion: no-preference`.

**RTL.** Every rule uses logical properties (`padding-inline`, `inset-inline-end`, `border-inline-start`,
`text-align: start`), never `left` or `right`. RTL is the product default. An LTR viewer gets the mirror image, which
the Playwright spec checks.

## 3. The knobs (palette `default`)

The screenshots are in `docs/evidence/T025/`:

- building: `devices-glass-building-desktop.png`, `devices-glass-building-mobile.png`
- area: `devices-glass-area-desktop.png`, `devices-glass-area-mobile.png`
- dark: `devices-glass-area-dark-desktop.png`
- owner previews: `glass-preview-building-desktop.png`, `glass-preview-area-desktop.png`,
  `glass-preview-area-phone.png`

The first five are regenerated by `frontend/tests/evidence-devices.spec.ts`.

### Backdrop and surfaces

| Knob | Light / dark (default) | Affects | Seen in |
|---|---|---|---|
| `--dv-color-scheme` | `light` / `dark` | Native controls and scrollbars inside the screens | all |
| `--dv-backdrop` | soft amber and blue radial gradients over `#eef2f9` / the same over `#0a0a0c` | The page behind the glass. It is carried by the screen's `sw-page` and grows with the content | building, area |
| `--dv-surface` | `rgba(255,255,255,.64)` / `rgba(28,28,30,.72)` | Panels: KPIs, floor cards, tree panel, area tiles, area cards, popover, dialog | all |
| `--dv-surface-2` | `rgba(255,255,255,.5)` / `rgba(44,44,46,.62)` | Inner surfaces: device tiles and rows, area rows in a floor card, empty cards | area, building (cards) |
| `--dv-surface-3` | grey `.14` / white `.14` | Tracks: the segmented-control groove, bars | building toolbar, covers |
| `--dv-surface-solid`, `--dv-surface-2-solid` | `#fbfcfe`, `#f2f5fa` / `#1c1c1e`, `#2c2c2e` | Fallback panels when transparency is off | (fallback) |
| `--dv-surface-blur` | `blur(28px) saturate(1.7)` | The glass material of every panel on the backdrop | all |
| `--dv-border`, `--dv-border-strong` | grey `.12` / `.22`, white `.13` / `.24` | Hairlines and stronger edges | all |
| `--dv-overlay` | slate `.38` / black `.55` | The dimmed layer behind the bulk dialog | bulk dialog |

### Type and colour

| Knob | Default | Affects |
|---|---|---|
| `--dv-font` | system font stack with Noto Sans Hebrew and Heebo | All text in the device screens |
| `--dv-text`, `--dv-text-2`, `--dv-text-3` | `#1c1c1e`, `#4c4c50`, `#6e6e73` / `#f5f5f7` and white at `.72` / `.56` | Primary, secondary and caption text |
| `--dv-accent`, `--dv-accent-hover`, `--dv-accent-soft`, `--dv-accent-text`, `--dv-focus` | iOS blue `#007aff` / `#0a84ff` | Selected chip and tree row, primary button, slider fill, card badge, focus ring |
| `--dv-success`, `--dv-success-soft` | `#34c759` / `#30d158` | Online, confirmed and locked badges |
| `--dv-warning`, `--dv-warning-soft` | `#ff9f0a` | Warm "something is on" counts, climate chips |
| `--dv-danger`, `--dv-danger-soft` | `#d70015` / `#ff453a` | "כבה הכל" outline, errors |
| `--dv-neutral-soft`, `--dv-offline` | grey | Offline and unknown badges |
| `--dv-fs-title`, `--dv-fw-title` | 16px, 700 | Floor-card, floor and card titles |
| `--dv-fs-tile-name` | 14px | Area tile name (building screen) |
| `--dv-fs-item-name` | 12.5px | Device tile name (area screen) |
| `--dv-fs-value-big` | 24px | Big readings (current temperature) |

### Shape and depth

| Knob | Default | Affects |
|---|---|---|
| `--dv-radius-sm` | 14px | Device tiles and rows, inputs, area rows |
| `--dv-radius-md` | 22px | Panels: cards, KPIs, area tiles, popover |
| `--dv-radius-lg` | 28px | Dialog |
| `--dv-radius-control` | 999px | Pill controls: segmented control, tree rows, bars |
| `--dv-shadow-1`, `--dv-shadow-2`, `--dv-shadow-3` | soft resting, raised and floating shadows (with a top highlight) | Panels, hover, popover and dialog |
| `--dv-shadow-control` | small drop | The selected segment's thumb |

### State glows ("on" tiles)

| Knob | Default | Affects |
|---|---|---|
| `--dv-tile-on-warm` | `255 159 10` (RGB triplet) | Building screen: an area tile where something is on (glow, border, icon badge) |
| `--dv-tile-on-cool` | `61 90 254` | Area screen: a lit light tile |
| `--dv-tile-on-switch` | `52 199 89` | Area screen: a running switch tile |
| `--dv-glow-fill-start`, `--dv-glow-fill-end` | `.3`, `.07` | Alpha of the glow gradient's two corners |
| `--dv-glow-border`, `--dv-glow-halo` | `.4`, `.22` | Alpha of the "on" border and the outer halo |
| `--dv-toggle-on` | `#34c759` / `#30d158` | A switched-on toggle (iOS green) |

### Icon badges

| Knob | Default | Affects |
|---|---|---|
| `--dv-icon-ring-size` | 36px | Round icon badge at the start of a device tile (area screen) |
| `--dv-icon-ring-size-lg` | 40px | Round icon badge of an area tile (building screen) |
| `--dv-icon-ring-pad` | 9px | Space between the badge edge and the icon, which fills the rest |
| `--dv-icon-ring-bg`, `--dv-icon-ring-on-bg`, `--dv-icon-ring-fg` | grey `.14`, white `.34`, text colour | Badge fill at rest, badge fill on an "on" tile, icon colour |
| `--dv-card-badge-size` | 34px | The domain icon at a card header's end (accent-soft ring) |

### Spacing and sizes

| Knob | Default (phone) | Affects |
|---|---|---|
| `--dv-gap-lg` | 18px (12px) | Between floor cards; between the tree and the cards |
| `--dv-gap` | 14px (10px) | Between KPIs, area tiles and area-screen cards |
| `--dv-gap-sm` | 10px | Between device tiles and rows inside a card; tree and card inner spacing |
| `--dv-card-pad-block`, `--dv-card-pad-inline` | 18px / 20px (14px / 14px) | Panel padding |
| `--dv-item-pad-block`, `--dv-item-pad-inline` | 12px / 14px | Device tile, row, area row and KPI padding |
| `--dv-tile-pad-block`, `--dv-tile-pad-inline` | 16px / 18px (12px / 14px) | Area tile padding |
| `--dv-tile-min-block` | 116px (100px) | Area tile minimum height |
| `--dv-item-min-block` | 64px | Device tile minimum height |
| `--dv-area-tile-min` | 210px (150px) | Minimum width of an area tile column |
| `--dv-floor-card-min` | 360px | Minimum width of a floor-card column |
| `--dv-area-card-min` | 320px | Minimum width of an area-screen card column |
| `--dv-entity-tile-min` | 220px | Minimum width of a device tile column in a card (one column in a narrow card or on a phone) |
| `--dv-tree-inline` | 270px | Width of the building tree panel |
| `--dv-hover-lift` | -2px | Area tile hover lift (motion allowed only) |

The settings screen's two style previews (`system-diagnostics.ts`, `.sw-prev`) are static swatches with their own
literal colours. They illustrate a style and do not read the knobs.

## 4. How to add a theme (palette)

1. **Copy the blocks.** In `frontend/src/styles/devices-themes.ts`, copy the three `default` blocks (light, the dark
   `@media (prefers-color-scheme: dark)` block, and the phone `@media (max-width: 767px)` block). Change the selector to
   `:host([data-devices-style='glass'][data-devices-theme='<id>'])`. The id must be lower case, for example `ocean`.
2. **Set every knob** in the light block. Leave none out: a missing knob is empty and the rule using it drops.
   The dark block only needs the knobs that differ in the dark scheme, and the phone block only the sizes.
3. **Register the id** in two places, in the same change:
   - `DEVICE_THEMES` in `devices-themes.ts`;
   - `DEVICE_THEMES` in `smplwise_vms/backend/smplwise/routers/settings.py`, whose validation refuses an unregistered id.

   Add the id to the refusal / acceptance cases in `smplwise_vms/backend/tests/test_ui_settings.py`.
4. **Select it.** Until the 6b picker exists: `PATCH /api/v1/settings {"devices.theme": "<id>", "devices.style": "glass"}`
   as a `system.configure` holder. An unknown id in the browser falls back to `default`.
5. **Screenshot it.** Copy the first 6a test in `frontend/tests/evidence-devices.spec.ts`, set the theme with
   `devicesSettings(request, {'devices.style': 'glass', 'devices.theme': '<id>'})`, and save with
   `evidenceShot(page, '<id>-building', project)` and `evidenceShot(page, '<id>-area', project)`. Run it on the desktop
   and mobile projects, in light and in `page.emulateMedia({ colorScheme: 'dark' })`.
6. **Add the Playwright check.** In that test, assert:
   - `data-devices-theme="<id>"` on `devices-building` and `devices-area`;
   - one distinctive knob, for example `getComputedStyle(host).getPropertyValue('--dv-surface')`;
   - `glassOrSolid(material(...))` on a card;
   - the RTL first-tile check.

   Always restore `DEVICES_DEFAULTS` in `finally`.
7. **Document it.** Add a row per changed default to §3, or a short "palette `<id>`" table, and list the new
   screenshot names.

A new **style** (a new structure, not just new values) is a larger change. Add a value to `devices.style` in both
places, write that style's element rules next to each screen's template reading only `--dv-*` knobs, and give it at
least the `default` palette.

## 5. Tests

- **Backend.** `smplwise_vms/backend/tests/test_ui_settings.py::test_devices_settings_defaults_validation_audit_and_gate`
  covers the defaults, the validation of every key (including the registered palettes), the audit, and viewer
  read / 403 on write.
- **Playwright.** `frontend/tests/evidence-devices.spec.ts` has three "6a:" tests, run on the desktop and mobile
  projects:
  - the style switch from the settings section: attribute, theme, knobs, glass material or solid fallback, shell
    untouched, RTL and LTR, reduced motion, bulk dialog, dark scheme, reduced transparency;
  - density, default view, sensors and climate strip;
  - read-only gating for a viewer.
