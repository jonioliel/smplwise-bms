# BV1 - more Bubble variants: weather / clock / agenda tiles, the quick launcher grid, vertical sliders, the surfaceless look

Design note + implementation record (branch `pilot/BV1-bubble-tiles`, 2026-10-05). Owner decision: build ALL the items of the
BV1 description (weather, clock and calendar tiles, a quick-launcher grid, vertical sliders, a look without surfaces).
No new external service: everything reads the mirrored catalogue (`ha_entities`) through the existing home-screen layer
(`services/home_screen.py`) and the existing look dials (`services/look.py`, `design/look.ts`).

## 1. Tile list and where each one lives

| Tile | What it is | Data source | Grid place (home widgets) | Skins |
|---|---|---|---|---|
| **Weather tile** | the weather widget in a second presentation: `style: "tile"` - a square-ish tile on the condition's hue, big glyph, big temperature, the condition and up to two facts, the forecast row in the large size | the chosen `weather.*` entity (unchanged) | the widget's own place; sizes s / m / l as today | Bubble draws the tile; the other three skins keep the card (the style is ignored there) |
| **Clock tile** | the clock in `style: "tile"`: a tile with the time as the hero, the weekday + date under it, the Hebrew date as a chip | the browser clock in the site's zone, the Hebrew-date sensor (unchanged) | same | same |
| **Agenda tile** (יומן) | NEW widget `agenda`: the next event of each chosen calendar, sorted by start - name, time ("היום 14:30", "מחר", weekday), all-day events say "כל היום", a location when the calendar reports one | the mirrored `calendar.*` entities' own state attributes (`message`, `start_time`, `end_time`, `all_day`, `location`) - what Home Assistant already reported; no request is made | a widget with sizes s (1 event) / m (3) / l (6) | tile in Bubble, card elsewhere |
| **Quick launcher grid** (משגר מהיר) | NEW widget `launcher`: a grid of round launch buttons (icon above a short label): screens of the product (live wall, events, map, alarm, screens, players, schedules, automations, entry, electricity, settings), scenes, scripts and the two quick actions | routes = a fixed table in `api/launcher.ts` with the permission each needs; scenes / scripts = the mirrored `scene.*` / `script.*` entities (candidates endpoint) | a widget; sizes decide the button size and how many fit in a row | grid in every skin (round buttons); Bubble gives them the pill surface |
| **Vertical sliders** (מחוונים אנכיים) | a look dial `slider: horizontal / vertical`. `vertical`: in the device sheet, the brightness / fan speed / cover position and tilt sliders become tall vertical sliders side by side (`<sw-vslider>`, fill grows from the bottom), with the same commands | no data change | the device sheet of the area screen | Bubble (the sheet is Bubble's) |
| **Surfaceless look** (מראה בלי משטח) | a surface dial value `none`: pills, widgets and tiles have no fill - only the ring, the text and a thin rule under a list row; a lit pill shows its fill as a 4 px bar under the text; hover is a faint layer | no data change | everywhere the surface dial is drawn | Bubble |

Why these shapes: the Bubble Card catalogue (docs/design/research/BUBBLE_CARD_ANALYSIS.md section 3) and the owner's
reference frames (docs/design/mockups/bubble-taste/README.md "big rounded glass tiles ... calendar, weather"). The tiles
follow the surface dial like every pill (fill / glass / gradient / flat / none), so the glass tile of the reference is
`surface: glass` + `style: tile`.

## 2. Sizes in the Bubble grid

The home widgets keep their three layouts (hero band / side column / compact row; phone: stack / two / snap). A tile is the
widget at the same flex basis as the card it replaces, with `aspect-ratio` 1 / 1 in the hero band at s and m (the band
wraps), 4 / 3 in the side column; the large tile is wider (forecast row / six events) and never square. The launcher grid is
`repeat(auto-fill, minmax(72px, 1fr))` at s, `88px` at m / l; a button is a 44 px minimum target at every size, 56 px at
m / l on touch layouts. Row density (list view) draws the agenda as plain rows and the launcher as one row of buttons.

## 3. Light / dark, the four skins, the material dials

- All colours are tokens: the tile's hue is `--sw-hue-N` of the widget (weather: hue 4 on a clear sky, hue 7 rain, hue 1 night
  - decoration, never meaning), text on the hue is `--sw-ring-on-hue`; agenda and launcher sit on `--sw-surface` / the layer.
- Classic, Domus and Tesla draw the agenda and the launcher as cards of their own skin (the shared `.wg` card) and ignore the
  tile style and the `none` surface (the dials are Bubble's).
- The material dials (depth / tint / material) apply to the tiles as to any `.wg` (the bubble skin's rule 6).
- Contrast: the surfaceless look puts text on `--sw-bg`: bubble light `#20263b` on `#eceef5` = 13.9:1, dark `#ffffff` on
  `#2b2a37` = 14.2:1; the secondary text `--sw-text-3` light `#4f566c` on `#eceef5` = 6.5:1, dark `#d0c9dc` = 9.9:1
  (computed with the WCAG formula; the palettes keep their own tested text / bg pairs).

## 4. Phone (44 px), RTL, states

- Every launcher button and every vertical slider is >= 44 x 44 px in touch layouts (<= 1100 px) and follows the desktop touch
  dial (44 / 32) above it; the agenda rows are 44 px tall when they are tappable (they are not: read-only), the tiles' chips
  are static text.
- RTL: logical properties only; the time inside a row is an isolated LTR run (`ltrNum`); the vertical slider's fill grows from
  the BOTTOM in both directions (a vertical axis has no mirror); ArrowUp / PageUp raise the value, ArrowDown / PageDown lower it.
- Empty: agenda with calendars but no coming event - "אין אירועים קרובים" inside the tile; no calendar chosen - the widget is
  absent (a ghost in edit mode: "לא נבחרו ישויות"); launcher with no item this user may run - absent (ghost: "אין פריט שמותר לך").
- Error / unavailable: a calendar entity that is unavailable is skipped; when every chosen calendar is unavailable the ghost
  says "הישות לא זמינה כרגע" (edit mode) and the tile is absent. A launch that fails shows the short error under the button
  for 4 s (no paragraph).
- Loading: the home screen's own loading state (nothing new).

## 5. Personal settings and permissions

- The installation configures the widgets (`home.widgets`, `system.configure`, audited); `agenda.calendars`, `agenda.days`,
  `launcher.items`, `clock.style`, `weather.style` are validated whole by `services/home_config.py` (unknown key / value = 422).
- A holder of `screen.personalize` turns the two new widgets on / off and sizes them for themselves (`home.personal`,
  unchanged mechanism: the ids are in `WIDGET_IDS`). The entities, items and styles are never personal.
- The two dials (`surface: none`, `slider`) are look dials: installation default in הגדרות › כללי › מראה (`system.configure`)
  and a personal override of any user ("ההעדפה שלי", `/me/prefs` `ui.look`).
- Launcher authority is the server's: a route button is drawn only when the user holds the route's permission (UX guard;
  the screen checks again); a scene needs `scene.manage` or `devices.control` / `ha.entity.control` (the apply route's gate);
  a script needs `script.run`; the quick actions need `devices.control_bulk` on the building (as the quick widget). The
  button sends the SAME request the automations screen sends (`POST /automations/scene/<id>/apply`, `.../script/<id>/run`).
- Calendars are read like the weather entity: the site's, not a place - so a floor-scoped caller sees the agenda too (the
  owner picks which calendars are on the home screen). Only `message`, `start_time`, `end_time`, `all_day`, `location` of the
  next event are mirrored (`ha_sync.ATTR_ALLOW`); never `description`.

## 6. Built / cut

Built: everything in section 1. Cut (with the reason): the vertical sliders in the AREA GRID (a tall pill would break the
pill-row grid of every density and the list view; they live in the device sheet, where there is room - an owner decision is
needed for a tall-tile grid mode); a full calendar (month / week) view - the mirrored entity carries only its next event, a
full list would need a new request to the platform per calendar (`/api/calendars/<id>`), which the brief excludes.

## 7. Evidence and tests

- `frontend/tests/unit-bv1-tiles.spec.ts` (node): config parsing, availability, launcher permissions, agenda sorting, the dials.
- `frontend/tests/layout-bv1-tiles.spec.ts`: the layout guard over the home with every new widget in the FOUR skins x light /
  dark x 10 widths (320 .. 1440); in Bubble also the surfaces fill / glass / none, both tile styles, and the device sheet
  with vertical sliders. `LAYOUT_QUICK=1` = 4 widths.
- `frontend/tests/evidence-bv1-tiles.spec.ts`: screenshots at 1440 / 820 / 390, light and dark -> `docs/design/evidence/bv1-tiles/`;
  behaviour: a scene button sends one apply, a route button navigates, the agenda is sorted with the empty state, the vertical
  slider's keyboard sends a brightness, the surfaceless pill has no background.
- `smplwise_vms/backend/tests/test_bv1_tiles.py`: the config validation, the agenda data from mirrored calendars, the
  candidates, the look dials.
