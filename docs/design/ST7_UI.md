# ST7 UI - Plan Studio 6 editor UI and the realistic-3D settings (design ADR)

**Status:** shipped on `pilot/ST7-ui` (from `pilot/ST7-port-s1-s2` b0961cba), 2026-10-11. **Binds to:** CR-029 sections 4.4
and 5.2, LOOK_SPEC section 10 (branch `pilot/ST7-lookdev`), the S0 port notes (`docs/changes/CR-029-ST7-PORT-NOTES.md`,
contradictions P1-P9) and the owner's rule of 2026-10-09: every look choice stays changeable in settings. Evidence:
`docs/design/evidence/st7-ui/` (`*-before-*` on the base build, `*-after-*` on this branch; desktop 1440, tablet 1024,
phone 390 for the settings card - the plan editor is desktop-only by `shell/phone.ts`).

## 1. What a person can now do

| Where | Control | Writes (document 2.2, `map/studio6-fields.ts`) |
|---|---|---|
| Plan editor › a selected wall (structure tool, select tool) | **חומר הקיר**: swatches from the material library, a light / dark preview toggle, the whole library in a select, "ברירת מחדל" | `walls[].material_id` via `setItemMaterial` (null removes the field) |
| Plan editor › a selected object (library tool, select tool) | **חומר** - the same field | `objects[].material_id` |
| Plan editor › a room (zones tool, the zone inspector) | **חומר הרצפה** - the same field with the floor swatches first | `rooms[].floor_material_id` via `setSurface`; the room row (`{id, level_id}`) is created on the first pick - the zone's id is the room's id, as the plan package and the 3D builder already join them |
| Plan editor › כיול קנה מידה | **צפון** card: a compass dial (drag, arrow keys ±1°, Shift ±15°, Home = 0), a number, "למעלה = צפון"; the sun's bearing and elevation right now as a marker on the dial and one line of text | `north_deg` via `setNorth` (null removes it) |
| Plan editor › the new rail tool **עמדות סיור** | the saved positions in route order: name, level, metres from the plan corner, heading, default start (star), move up / down, delete, "הצג בתוכנית", "הזז בלחיצה"; "עמדה חדשה" arms the next click on the plan; the positions draw on the canvas as named arrows in their heading | `walk_positions` via `upsertWalkPosition` / `moveWalkPosition` / `removeWalkPosition` |
| הגדרות › מפה › **תצוגה ריאליסטית** | "למי": ההעדפה שלי / ברירת המחדל של ההתקנה. Own: style, default view, section cut, temperatures, motion, time source, eye height, mouse mode, walk guard, quality, sharpness - each with "לפי ההתקנה". Installation: the same without the default view, plus furniture, textures, wall display, kiosk idle, and the site location | own: `PUT /plan-view/prefs` at once per change; installation: `PATCH /settings` `plan.view` (partial) + `site.latitude` / `site.longitude` with the save button |

Every editor edit goes through `ExplorePlanEditor.edit()` - the studio controller's commit, undo / redo, the 2 s autosave
and the server's validation - and stamps the document version with `withDocVersion` (2.2 while a Studio 6 field is present,
back to 2.0 / 2.1 when the last one is removed; the server stamps the same). No schema change: schema 2.2 of S0 holds every
field, and `plan_geometry.v2.schema.json` already allows a room row of `{id}` alone.

## 2. Decisions

1. **Pure renderers, the editor owns the state.** `screens/plan-studio6-panel.ts` follows `plan-studio-panel.ts`: render
   functions with a view and an actions object, no Lit element of their own; the editor passes callbacks and adds
   `studio6Styles` to its shadow root. The unit spec runs them in node.
2. **The material field is one component for three hosts** (wall / floor / object). The swatch row shows the groups that
   fit the host first (`SWATCH_GROUPS`); the select below carries the whole library grouped in Hebrew, so a keyboard or a
   screen reader reaches every material without the swatches. The swatch tint is the library's per-style hex
   (`materials.json`), so the preview is the real colour of level 3 for that style; the toggle starts on the UI theme.
   "ברירת מחדל" names the material the resolver (`map/material-resolve.ts`) gives without an own value, so the person sees
   what "reset" means before pressing it.
3. **The compass is an SVG slider.** `role="slider"` with `aria-valuetext` ("135° - דרום-מזרח"), pointer capture for the
   drag, the keyboard on the same element; the number field beside it is the exact path. The needle points to true north on
   the plan (bearing `360 - north_deg`), the grey arrow at the top is "up in the plan". The sun marker uses `map/sun.ts`
   with the installation's `site.latitude` / `site.longitude` (the S2 fallback and its note when unset), computed at render
   time - no timer; the card re-renders on every edit anyway.
4. **Saved positions are a rail tool, not a sub-section.** Placing needs the plan (a click), so the tool takes the plan's
   clicks like calibrate and measure do (`studioPlacing`, Esc cancels the armed placement). The list is the route order
   (CR-029 4.4), hence up / down instead of drag-sorting: exact, keyboard-reachable, and the same operation the walk uses.
   "הצג בתוכנית" centres the canvas and lifts a level filter that would hide the position (the `focusGeom` rule).
   The arrows on the canvas reuse the canvas's ruler overlay (`RulerOverlay`), so no canvas change was needed.
5. **The settings card is the ui.look pattern, on the map tab.** Two targets (own / installation), the own choices saved
   at once with "לפי ההעדפה" per dial, the installation draft saved with one button - exactly `system-look.ts`, which the
   owner approved. The card sits under הגדרות › מפה with the other map settings (`data-section="plan-view"`). The default
   view is the one dial with no installation value (owner Q11: schematic for everyone, realistic per person): the
   installation target shows it disabled on "סכמטי" with the reason in its hint.
6. **Hebrew labels are the API's `DIAL_HE` / `CHOICE_HE`** (one place for the settings screen and the 3D view's own pills),
   with one plain-language hint per dial in `screens/plan-view-dials.ts`. No internal codes, no platform names (the location
   note says "המערכת", not the platform).
7. **Every new control takes the desktop touch dial** (`--sw-touch-desktop`, 44 px by default, 32 when the installation
   chose it) in every skin, instead of the 30-36 px desktop controls of the older settings rows. The layout guard reads the
   same variable, so `layout-st7-ui.spec.ts` filters nothing (the update-screens spec filters `target` findings above 1100 px
   outside the bubble skin). The swatch grid wraps by that size; the walk row is a 3-line grid (name + star / where / actions).
8. **A clean slot for the S3 stills rows.** `renderStillsSlot()` in `system-plan-view.ts` is empty on this branch and sits
   under the wall display row; the S3 branch's rows carry `data-set-bake-trigger` / `data-set-bake-views` on the media tab
   today. The integration merge fills the slot with the same hooks (or keeps the media-tab rows and removes the slot; one
   place only).

## 3. Contradictions recorded

| # | What disagrees | Decision here | Why |
|---|---|---|---|
| U1 | The brief: the site location fields "default from the system's configured location when empty"; S2 (P10) reads no platform location - an empty value falls back to 32.0 / 34.8 with a note | the card's hint says what happens today: "ריק: המערכת משתמשת במיקום ברירת המחדל שלה (מרכז הארץ) עד שהמיקום מוגדר כאן" | a hint must not promise a read path that does not exist; reading the platform's location stays an S5 / integration item |
| U2 | LOOK_SPEC 10 scopes the wall display, kiosk idle, quality rung and DPR cap "per display / per device"; S0 (P7) stores them on the installation, with a per-browser override left to S5 | the card edits the installation value of all four; quality and DPR cap are also personal dials (S0 USER_DIALS); no per-browser override UI here | S5 owns the kiosk / display overrides; the card says "מסך קיר" so the scope is clear |
| U3 | The brief lists the material of "wall / room floor / object"; S0 also has opening `material_id` and `tint`, level floor / ceiling, room ceiling | not drawn (openings, levels, room ceiling / ceiling flag) | kept to the brief; the operations exist (`setItemMaterial('openings', …)`, `setSurface(…, 'levels', …)`) and the field takes a `ceiling` host already |
| U4 | The brief asks for the walk positions "position" to be editable; the positions bar in the walk shows metres | the row shows metres (read-only) and the position is moved by a click on the plan ("הזז בלחיצה"); heading is a number | typing plan-normalised coordinates is not a person's task; a click on the plan is exact and visible |

## 4. Not in this slice

- The 3D view reads the person's dials when it opens (`planViewPrefs()` cache, replaced by every save); a view already open
  on another tab applies them on its next open. A live `plan-view-change` event is a small follow-up.
- Opening / level / ceiling material fields (U3); a per-browser override of the display dials (S5); dragging positions on
  the canvas (the click placement covers it); the stills rows (S3's slot).
- The crystal skin named in the brief does not exist on this base (`SKIN_IDS` = classic, domus, tesla, bubble); the layout
  guard covers the four.

## 5. Evidence and tests

- `frontend/tests/unit-studio6-ui.spec.ts` (node): compass maths, winds, the sun on the plan vs the north, position names /
  metres / arrows, the swatch lists, the settings card's dial lists against the API.
- `frontend/tests/evidence-st7-ui.spec.ts` (mocked backend `tests/st7-ui-mocks.ts`): the before / after shots and the saved
  documents (material set and reset, the room row, north 135 and the arrow key, two positions placed / renamed / reordered /
  deleted, the own pref PUT and the installation PATCH with the site location).
- `frontend/tests/layout-st7-ui.spec.ts`: the layout guard over the settings card (both targets) at 320…1440 and the editor's
  five cards at 768…1440, in classic / domus / tesla / bubble x light / dark.
