# Device-control screens: styles, palettes, knobs and layouts (CR-007 slices 6a, 6b and 6c)

This document covers how the "חשמל והתקנים" screens look, and how a designer adds a new look without touching the
screens. The screens are the building screen, the area screen, and the bulk popover and dialog. The source of truth is
**one file**, `frontend/src/styles/devices-themes.ts`. Its `DEVICE_THEME_KNOBS` map repeats the role of every knob
listed below. Slice 6b adds the colour themes (`frontend/src/styles/devices-palettes.ts`, §6) and the layout editor
(`frontend/src/screens/devices-layout.ts` and `devices-layout-css.ts`, §7).

## 1. Settings and attributes

| Setting (הגדרות › חשמל והתקנים) | Values | Attribute on the screen's host | What it selects |
|---|---|---|---|
| `devices.style` | `smplwise` (default), `glass` | `data-devices-style` | The **structure**: which element rules apply. |
| `devices.theme` | `default` (blue), `sand`, `forest`, `graphite` | `data-devices-theme` | The **palette**: the colour values of the `--dv-*` knobs and the card-colour roles (§6). Picked with swatches. |
| `devices.scheme` | `light` (default), `dark`, `auto` | `data-devices-scheme` (resolved: `light` / `dark`) | Light or dark values of the palette, glass style only (§6). |
| `devices.density` | `comfortable` (default), `compact` | `data-devices-density` | Tighter tiles, rows and gaps, in either style. |
| `devices.default_view` | `cards` (default), `tiles` | none | The building screen's first view. A viewer's own toggle wins (localStorage `sw.devices.layout`). |
| `devices.show_sensors` | `true` / `false` | none | The sensors card on the area screen and the sensors count on the building screen. |
| `devices.show_climate_strip` | `true` / `false` | none | **Deprecated since 0.1.149**: the per-A/C strips are gone; accepted and stored, nothing reads it. |
| `devices.area_row` | object `{items, climate, show_empty, climate_mode, climate_lead, only_active}` | none | What sits after an area's name on the home screen, one line, in order (`services/area_row.py`, `frontend/src/api/area-row.ts`). A user with `screen.personalize` may override it in `/me/prefs` `devices.area_row`. |
| `devices.floor_row` | object `{items}` | none | The count chips of a floor card's header, in order. |

These settings are per installation. Everyone reads them through `GET /settings`. Changing them needs
`system.configure`, and every change is audited as `settings.update`.

- **`smplwise`** matches no rule in the theme file. The screens keep the product's v2 tokens
  (`frontend/src/design/tokens.ts`, the classic skin; before 2026-10-01 `styles/tokens.css`) and stay pixel for pixel as before 6a. This was checked by a before/after capture
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
   - a **dark** block on the extra host attribute `[data-devices-scheme='dark']` (no media query), which only needs
     the knobs that differ;
   - an optional **phone** block under `@media (max-width: 767px)`, for sizes only.
3. **Fallback.** Without `backdrop-filter` support, or when the viewer asks for less transparency
   (`prefers-reduced-transparency: reduce`), the bridge swaps in `--dv-surface-solid` and `--dv-surface-2-solid` and
   turns the blur off. The layout stays the same.

**Light and dark.** The dark palette is switched only by the host attribute `data-devices-scheme="dark"`, never by
the OS colour scheme (`prefers-color-scheme` is deliberately not used yet). The app shell is light only (`tokens.css`
sets `color-scheme: light`), and a black device area inside a white shell on a dark-mode computer was rejected in the
6a review. Slice 6b's `devices.scheme` setting sets it (§6): `light` by default, `dark` on request, and `auto` resolved
in JavaScript from `matchMedia('(prefers-color-scheme: dark)')` - so dark still never applies by itself, only when an
administrator chose `dark` or `auto`. `--dv-color-scheme` sets native form controls and scrollbars to match.

**Motion.** The only movement is the area tile's hover lift (`--dv-hover-lift`). It applies only under
`prefers-reduced-motion: no-preference`.

**RTL.** Every rule uses logical properties (`padding-inline`, `inset-inline-end`, `border-inline-start`,
`text-align: start`), never `left` or `right`. RTL is the product default. An LTR viewer gets the mirror image, which
the Playwright spec checks.

## 3. The knobs (palette `default`)

The screenshots are in `docs/evidence/T025/`:

- building: `devices-glass-building-desktop.png`, `devices-glass-building-mobile.png`
- area: `devices-glass-area-desktop.png`, `devices-glass-area-mobile.png`
- dark (the attribute set by hand in the spec): `devices-glass-area-dark-desktop.png`
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

1. **Add an entry** to `DEVICE_PALETTES` in `frontend/src/styles/devices-palettes.ts` (6b): an id (lower case, for
   example `ocean`), a Hebrew name and hint for the swatch, and for `light` and `dark` each: `knobs` (every colour
   knob of `COLOUR_KNOBS`, both schemes in full) and `roles` (the seven card-colour roles, §6). The shape knobs (radii,
   sizes, gaps, fonts, and the phone sizes) come from the `default` blocks of `devices-themes.ts`, which since 6b are
   the base of every palette; a palette that needs other shapes adds its own block there.
2. **Set every colour knob**, light and dark. Leave none out: the default's value would show through.
3. **Register the id** in two places, in the same change:
   - `DEVICE_THEMES` in `devices-themes.ts`;
   - `DEVICE_THEMES` in `smplwise_vms/backend/smplwise/routers/settings.py`, whose validation refuses an unregistered id.

   Add the id to the refusal / acceptance cases in `smplwise_vms/backend/tests/test_ui_settings.py`.
4. **Select it.** Its swatch appears in הגדרות › חשמל והתקנים by itself (the picker lists `DEVICE_PALETTES`). An unknown
   id in the browser falls back to `default`.
5. **Screenshot it.** Copy the first 6a test in `frontend/tests/evidence-devices.spec.ts`, set the theme with
   `devicesSettings(request, {'devices.style': 'glass', 'devices.theme': '<id>'})`, and save with
   `evidenceShot(page, '<id>-building', project)` and `evidenceShot(page, '<id>-area', project)`. Run it on the desktop
   and mobile projects, in light and with `data-devices-scheme="dark"` set on the host.
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
  read / 403 on write; `test_devices_theme_and_scheme_6b` the four palettes (the frontend list must match) and the
  scheme values. `smplwise_vms/backend/tests/test_device_layouts.py` covers the layout API: read for every
  `devices.read` holder, write only with `system.configure` checked before the body, the 409 on a stale revision,
  validation (grid bounds, roles, text sizes, icons, keys per screen, JSON only, size cap), reset, copy to all areas,
  audit rows without the layout, the table in a project backup, and the icon / role lists matching the frontend.
- **Playwright.** `frontend/tests/evidence-devices.spec.ts` has three "6a:" tests, run on the desktop and mobile
  projects:
  - the style switch from the settings section: attribute, theme, knobs, glass material or solid fallback, shell
    untouched, RTL and LTR, reduced motion, bulk dialog, dark only by the attribute (a dark OS alone changes nothing), reduced transparency;
  - density, default view, sensors and climate strip;
  - read-only gating for a viewer.

  and five "6b:" tests: the edit button only for `system.configure` and a viewer's writes refused; the desktop area
  editor (drag and resize on the grid, keyboard, side panel, save, persisted for another user, LTR mirror, 409 on a
  stale save, reset); copy to all areas and the building screen's own layout; the phone layout derived, then edited
  (a long press on the phone) and "חזור לאוטומטי"; the theme swatches and the scheme.

## 6. Colour themes and the colour scheme (6b)

`devices.theme` picks one of four palettes, each with a light and a dark variant: `default` (blue, the 6a values),
`sand` (warm beige and terracotta), `forest` (green) and `graphite` (neutral grey, indigo accent). They are defined in
`frontend/src/styles/devices-palettes.ts` as data (`DEVICE_PALETTES`) and turned into CSS there, so the settings
screen's swatches paint the very same values:

- **Colour knobs** (glass style): every knob of `COLOUR_KNOBS` - backdrop, surfaces, borders, overlay, text, accent,
  focus, success / warning / danger, neutral, offline, shadows, the "on" glows, icon badges, toggle - on
  `:host([data-devices-style='glass'][data-devices-theme='<id>'])` and, dark, the same plus
  `[data-devices-scheme='dark']`. `default` keeps its blocks in `devices-themes.ts`.
- **Role knobs** (both styles): `--dv-role-<role>-bg`, `--dv-role-<role>-border` and `--dv-role-<role>-fg` for the seven
  roles `accent`, `warm`, `cool`, `success`, `warning`, `danger`, `neutral` - the only colours the layout editor offers
  a card (§7). A role is an RGB triplet per palette and scheme; the fill is that colour at 14 % (dark 26 %) and the
  border at 50 % (dark 60 %). The SMPLWISE style resolves them from the palette's light values.

`devices.scheme` (`light`, `dark`, `auto`; default `light`) puts the RESOLVED scheme on the host as
`data-devices-scheme="light" | "dark"` (`applyDevicesScheme` in `devices-style.ts`). `auto` is resolved in JavaScript
from `prefers-color-scheme` and re-resolved when the device's scheme changes. There is still no colour-scheme media
query in the CSS, on purpose: the app shell is light only, so the device area turns dark only when an administrator
chose `dark`, or chose `auto` for devices set to dark. The scheme applies to the glass style; the SMPLWISE style keeps
the shell's light tokens (its role colours use the light values).

The picker is `devices-theme-picker` (`frontend/src/screens/devices-theme-picker.ts`) in הגדרות › חשמל והתקנים: a swatch
per palette (its light and dark preview and its seven roles) and the scheme select, saved with the section's "שמור".
Screenshot: `docs/evidence/T025/devices-layout-theme-picker.png`.

## 7. The layout editor (6b)

Owner decisions CR-007 §7.11. One layout per installation and screen, stored on the server
(`routers/device_layouts.py`, table `device_layouts`, migration `0028`), shown to everyone, edited only with
`system.configure`:

| Screen | Record | Items (keys) |
|---|---|---|
| Building | `building / main` | `floor:<id>` - the floor cards ("כרטיסים" view); `area:<id>` - the area tiles, one grid per floor ("אריחים" view) |
| Area | `area / <HA area id>` (and `unassigned`) | `card:<id>` - the domain cards (lighting, switches, climate, covers, security, media, sensors) |

Each record has a `desktop` variant and, once edited on its own, a `phone` variant. Per item: `x`, `y`, `w`, `h` in
grid units, `text` (`sm` / `md` / `lg`), `bg` and `border` (a role of §6 or none - never a colour value), `title`,
`icon` (from `LAYOUT_ICONS`, a subset of the product's `sw-icon` set), `hidden`.

**The grid** (`devices-layout-css.ts`). A grid with a stored layout becomes `.lay-grid`: 12 columns on a desktop, 4 on a
phone, rows of 8 px (`grid-auto-rows: minmax(8px, auto)`), a column gap of `--dv-gap`. Items are placed with
`grid-column` / `grid-row` in grid units - never pixels - so a layout scales with the screen. The height is a minimum:
a row grows with its content, so a card never clips its devices. RTL needs nothing: column 1 is the start edge (the
right in Hebrew), and an LTR viewer sees the mirror image of the same record. A grid with nothing stored keeps the
screen's automatic layout pixel for pixel, and `devices.density` still applies inside the cards. Text size scales the
tokens a card reads (`--sw-fs-*`, `--dv-fs-*`) by 0.88 / 1 / 1.16. Colours set `background-image` / `border-color`
from the role knobs, so the glass material and the card's own surface stay underneath.

**The editor** (`DevicesLayoutController` in `devices-layout.ts`, shared by both screens).
- "ערוך פריסה" is rendered only when the session holds `system.configure` at installation scope
  (`can('system.configure')`); the server checks it again on every write (403, audited).
- Entering measures the automatic layout as it is drawn and converts it to grid units, so the editor starts from what
  it sees. The bar: the variant (מחשב / טלפון - switchable while nothing is unsaved), "בטל", "חזור לאוטומטי" (phone),
  "אפס לברירת מחדל" (confirmation; both variants), "העתק לכל האזורים" (area screen; confirmation; the stored layout
  replaces every other area's, audited), "שמור" (one PUT with the revision the editor started from; a 409 says someone
  else saved and offers "טען מחדש").
- Pointer: drag a card (or its handle) to move it, the corner handle to resize it - by whole columns and 8 px rows. A
  card that the moved one now covers moves down below it (16 px gap). The card's own controls rest in edit mode.
- Keyboard: Tab to a card, arrows move it (ArrowRight moves toward the start in RTL), Shift + arrows resize it; the new
  position is announced.
- Phone: a finger on a card scrolls; a long press picks it; the bottom sheet's arrows move and resize it; the handles
  drag directly.
- The side panel (a bottom sheet on a phone): title, icon, text size, background and border role, width / height,
  move and resize buttons, "מוסתר לכולם".

**Review round 1.** While editing, a card's own content is `inert` and `aria-hidden` (Tab goes from the toolbar to
the next card, keys never reach a device). A viewer's layout packs away the rows of items not drawn (hidden, a floor /
area a floor-scoped reader cannot see - the server sends only their items and `narrowed: true` - or gone from Home
Assistant); the compact density packs gaps to one row and an 8 px column gap. The server refuses overlapping items of
one grid (`layout_overlap`), requires the source revision on copy to all areas, and drops the layout rows of HA areas
that no longer exist on the next read. Area cards carry `hidden_entities` (the panel's "visible entities" checklist).

**The phone layout** is derived automatically from the desktop one (each grid one column, in the desktop's reading
order) until it is saved on its own; "חזור לאוטומטי" deletes the stored phone layout. Editing the phone layout on a
desktop shows a phone-wide preview.

**Backups.** `device_layouts` is one of the project tables of a backup and a restore.

Screenshots (`docs/evidence/T025/`, from the 6b tests): `devices-layout-edit-desktop.png` (edit mode),
`devices-layout-panel-desktop.png` (a selected card and its panel), `devices-layout-phone-edit.png` (the phone
editor), `devices-layout-theme-picker.png` (the theme swatches).

**Owner feedback 2026-09-29 (empty domains).** A domain card the area has nothing of is not drawn. Its stored item
stays in the record; the viewer's layout packs its rows away (the same rule as an item gone from Home Assistant), and
the card comes back in its saved place when the domain appears. On the area screen the editor keeps such an item as a
collision peer (a drawn card moved onto its slot pushes it down, so a save never overlaps), and the derived phone
layout stacks undrawn items under the drawn ones.

## 8. Per-device tiles (6c)

Owner decision 2026-09-29 ("1.א"): inside the area screen's domain cards, each device tile can be arranged too.

**Schema.** An area card item (`card:<id>`) may carry `tiles` = `{entity id: {order, span, size, hidden, title}}`:
`order` 0..999, unique within the card; `span` 1..`TILE_COLS[card]` (every card has two tile columns today:
`TILE_COLS` in `devices-layout.ts` and `routers/device_layouts.py`, compared by a backend test); `size` `s` / `m` / `l`;
`hidden`; `title` (plain text, 60 characters, no control or bidi-override characters). At most 200 tiles per card.
The layout JSON carries a schema version: `v: 1` (6b, no tiles - still accepted and returned exactly as stored) or
`v: 2` (tiles allowed; the editor writes 2 on every save). A tile's `hidden` and the card's `hidden_entities` are one
set: the server merges them both ways on every write, so a screen that reads only `hidden_entities` hides the same
devices. An empty `tiles` map is not stored. No migration: the column holds JSON.

**Viewer.** A card without `tiles` keeps its automatic tiles, pixel for pixel. An arranged card draws one grid
(`.lay-tgrid`, the card's tile columns) with its devices in the saved order (the DOM order - screen readers and Tab
follow it), each wrapped in `.lay-tile` with `grid-column: span N` and `data-tile-size` (s / l scale the card's text
tokens by 0.88 / 1.2 on top of its own text size, and its padding / minimum height). Devices the arrangement does not
know (added since) follow in the automatic order with the card's default span (1 for the two-up lighting, switches
and sensors cards; the full width for the row cards). An arranged sensors card is one list, not grouped by class.
Hidden devices are not drawn but still count in the card's numbers and the floor chips; the bulk previews and safety
lists never read layouts.

**Editor.** In edit mode each area card with devices shows "סידור התקנים" (and its panel has the same entry). It opens
the card alone (`.lay-stage`, phone-wide when the phone layout is edited on a desktop) with a breadcrumb "כל הכרטיסים ›
<card> · סידור התקנים" in the edit bar; on a phone the bar then keeps only cancel / save / back. Tiles: drag a tile (or
its place chip) onto another to take its place; keyboard - Tab to a tile, arrows move it earlier / later (logical: in
RTL ArrowRight is earlier), Shift + arrows change its span, H (the key's place, any layout) hides / shows it, Escape
deselects, then goes back. A touch scrolls; a long press picks a tile. The panel: title, span, size, place (first /
earlier / later / last), hidden, and "אפס סידור" (the card's automatic order again; hidden devices stay hidden - the
card's checklist brings them back). Tile content is `inert` and `aria-hidden` while arranged, as the cards' in 6b. The
arrangement is part of the draft: "שמור" saves it with the rest of the layout (optimistic revision, audited without
the layout), "בטל" drops it.

**Phone.** The derived phone layout copies each card's tiles in the desktop order with every tile the card's full
width (the cards' own phone rule: one column); once the phone layout is saved its tiles are arranged on their own.
"העתק לכל האזורים" copies the arrangement with the layout.

Screenshots (`docs/evidence/T025/`, from the 6c tests): `devices-layout-tiles-desktop.png` (tile arrangement on a
desktop, a tile selected), `devices-layout-tiles-phone.png` (tile arrangement on a phone).

## 9. Summary tiles: the compact layout (`ui.tile_layout`) and the tree columns

Owner request 2026-09-29: the summary tiles (the building's counters, the area tiles of the "אריחים" view, the Live
overview's "תמונת מצב" tiles) were too tall on a phone. `ui.tile_layout` (הגדרות › כללי › עיצוב הממשק, per installation,
with a per-browser override) picks their shape:

| Value | Shape |
|---|---|
| `auto` (default) | compact under 600 px wide (a phone), cards from 600 px up |
| `cards` | today's tall tile: the icon above the value |
| `compact` | a rectangle: the icon at the inline-start side, the value and the label beside it on one line (a long label wraps once, then ellipsis; the full text is the tile's title), one line of secondary text |

The resolved shape is on the screen's host as `data-tile-layout="cards" | "compact"` (`TileLayoutController`,
`frontend/src/api/tile-layout.ts`) and on each `sw-kpi` as `layout`. `sw-kpi` reads only `--sw-kpi-compact-*`; two knob
families set them:

- the device screens: `--dv-kpi-*`, in `devices-themes.ts` block 0 - every style and palette (a palette may override
  them in its own block);
- the Live overview: `--lv-tile-*`, in `frontend/src/styles/tile-knobs.ts` (`liveTileKnobs`).

| Knob (`--dv-kpi-…` / `--lv-tile-…`) | Default | Affects |
|---|---|---|
| `compact-min-block` | 60px | Minimum height of a compact tile. The whole tile is the tap target: keep it at 44px or more |
| `compact-pad-block`, `compact-pad-inline` | 8px / 12px | Compact tile padding |
| `compact-gap` | 10px | Space between the icon and the text |
| `compact-icon` | 32px | The icon square at the inline start |
| `compact-value-fs` | 17px | The value ("0/33"); numbers are tabular figures in both shapes |
| `compact-col-min` | 168px | Minimum column width of the compact grid on a tablet or desktop (auto-fill: 3-4 on a tablet) |
| `compact-cols-phone` | 2 | Columns of the compact grid under 600 px |
| `compact-grid-gap` | 8px | Gap between compact tiles |

The Live overview keeps its four tiles in one row from 1024 px up in either shape. The rules that place compact tiles
come after the glass and density rules (`TILE_LAYOUT` in `devices-building.ts`), so a compact tile has the same size in
both styles and densities. In the RTL product the icon is on the right; an LTR viewer gets the mirror image.

**Tiles are controls.** A building counter is a `<button>` (`sw-kpi action`, `aria-expanded`) that opens the tiles'
panel (CR-007 §7.12); a Live tile is a link (`sw-kpi href`). The native control covers the whole tile.

**The tree columns** (building screen, owner 2026-09-29):

| Knob | Default | Affects |
|---|---|---|
| `--dv-tree-count-w` | 44px | The lit-count column at a tree row's inline end (drawn empty without lights, so rows line up) |
| `--dv-tree-menu-w` | 30px | The "⋯" column; a row without a menu keeps this width free |
| `--dv-tree-inline-max` | 340px | The glass tree's widest (it grows from `--dv-tree-inline` with the screen, 16vw); the SMPLWISE style grows 250-320px |

The tree scrolls inside itself only when it is taller than the viewport (then it sticks under the top bar).

**The panel** (`devices-tiles-panel.ts`) is a modal `sw-drawer` whose surface is `--dv-surface-solid` when a glass palette
sets it (so it stays readable over the page), with the palette's text colour; the dark scheme applies to it as to the
screen.

Screenshots: `docs/evidence/T007/screens/sc32-devices-building-*.png` (compact on the phone) and
`sc33-devices-tiles-panel-*.png` (the panel open), regenerated by `frontend/tests/screens.spec.ts`. Tests:
`frontend/tests/unit-devices-tiles.spec.ts` (demo data: heights 56-80px and two columns at 390px, the override, the tree
columns, no needless scrolling) and `evidence-devices-tiles.spec.ts` (fixture backend: the setting from the settings
screen).

**The master control** (owner answers 2026-09-29): an icon-only 44px round button next to the panel's filter
(`button.master` in `devices-tiles-panel.ts`): outline in `--sw-accent` when every shown device is off, filled when any
is on, a count badge (`--sw-warning`) when only some are; covers get two such buttons (the `coverOpen` / `coverClose`
icons), locks one lock icon. The words live only in its `aria-label` and `title`. It takes the palette's accent through
the glass bridge like every other control; it has no knob of its own.

**Review G diagnostic:** opening the app with `?debug=overflow` installs `window.__arxOverflow()`
(`frontend/src/debug/overflow.ts`), which lists the scroll containers that scroll and the elements whose bottom edge lies
furthest down in the app's scroll area - read-only, for naming the element behind a needless scrollbar.