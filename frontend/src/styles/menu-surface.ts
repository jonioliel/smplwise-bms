/**
 * MENU SURFACES (owner 2026-10-13): "no transparency in any menu" - and, the same day, "make the panels over the plan opaque too". The one
 * place that names every menu-like surface and every HUD panel over a canvas of the product - the rule, the registries the tests read, and
 * how to add a new one. Nothing in the bundle imports it (tests/unit-menu-lint.spec.ts, tests/unit-hud-opaque.spec.ts and
 * tests/evidence-menu-opaque.spec.ts do); it is documentation that is checked.
 *
 * WHAT IS A MENU: anything that FLOATS over other content - the user menu popover and its phone bottom sheet, a dropdown / select /
 * combobox list, a "..." (overflow / context) menu, a popover card or a hover preview, an autocomplete / search-result list, a picker's
 * popup (time of day, entities, columns, camera, cast), a bottom sheet of controls. Over a page whose rows and cards scroll behind it, a
 * see-through surface overlaps its own text with what lies behind it - that is the bug of the owner's screenshot (the user menu over the
 * building tree in the Domus / Crystal skins: `--sw-surface` is a 52 % / 58 % glass there, which is right for a card that sits on its own
 * backdrop blur and wrong for a menu, which has none).
 *
 * THE RULE: a menu paints `background: var(--sw-menu-surface)` (a skin may lay a gradient SHEEN on top of it, never replace it), its hairline
 * is `var(--sw-menu-border)`, and it has no `backdrop-filter` (none / absent). The two tokens are declared once (design/tokens.ts), set by
 * every skin for both schemes, mapped by the bubble palettes to `surfaceElevated`, bridged by the glass screens to their palette's solid
 * twin (styles/devices-themes.ts: `--sw-menu-surface: var(--dv-surface-solid)`, so a menu inside a glass screen follows THAT screen's scheme,
 * not the product's), and fully opaque everywhere. No look dial, performance tier, palette or knob can thin a menu out: the Bubble
 * `transparency` dial, the lite tier's translucent fill and the media sheet knob (`--mm-sheet-surface`) never reach one.
 *
 * WHAT IS A HUD PANEL (owner 2026-10-13, second report - the same symptom as the floor strip of 2026-10-11): anything that floats over the
 * PLAN canvas or the 3D canvas and carries text or controls - the floor chip, the level bar, the legend, the floor strip, the quick floor
 * buttons, the circuit buttons, the selection bar, the side list, the zoom controls and the scale, the 3D time pill, the view / quality bar,
 * the level thumbnails, the entity and room-name pills, the hover tip, the notes and toasts, the walk bar, the editor's tool rail. Over a
 * drawing that is all lines and labels a see-through panel overlaps its own text with what lies behind it - the same bug as a menu's, so a
 * HUD panel is painted like one: `background: var(--sw-menu-surface)`, no `backdrop-filter`. Its hairline is the skin's STRONG border,
 * `var(--sw-border-strong)`, not the menu hairline: a menu floats over a page, a HUD panel over a drawing on a light ground, and Bubble's
 * menu hairline is its own surface colour (the skin is borderless, so a menu gets its edge from the pop-up ring and the shadow in the skin's
 * own rules) - an opaque panel in that colour on the plan's ground (#f6f7fc on #f4f6fa) has no edge at all, its chip shape disappears.
 * The strong border is the edge every skin already tunes for an opaque floating surface (Tesla's popover and dialog, Bubble's pop-up ring),
 * it is bridged by the glass screens, and it is a colour token: no skin rule is needed (Bubble stays at 50).
 * No second token family: the skins, the bubble palettes, the glass bridge and every dial already keep the surface opaque.
 *   - A HUD panel that is ONE box paints the token itself (`via: 'background'`).
 *   - A row of shared controls (sw-chip, sw-button, a select) floating on the canvas with no box of its own re-points `--sw-surface` at the
 *     menu surface and `--sw-surface-2` (their hover fill) at that surface washed 8 % towards the ink on the container (`via: 'surface-token'`),
 *     so every control in it is opaque, hover included - the shared components themselves stay glass everywhere else. Tesla draws its chips and
 *     secondary buttons flat and transparent on the page (skins/tesla.ts); they read the fill from `--hud-fill`, which the same container sets
 *     to the menu surface (a local hook, not a token: unset, a Tesla control stays transparent).
 *   - Text on it uses the readable ink only (`--sw-text`, `--sw-text-2`, `--sw-accent-text`, the `-text` twins of the state colours): never
 *     `--sw-text-3` and never a bare state colour as a text colour (unit-hud-opaque.spec.ts proves every pair for every skin x scheme).
 *   - A disabled floating control is dimmed by its ink, not by `opacity` on the box (a faded box is see-through again).
 *
 * WHAT IS NOT A MENU OR A HUD PANEL (stays glass; listed, never silently changed): a card or panel that sits ON the page (cards, KPI tiles,
 * floor cards, the building tree, the rail, the phone dock, the corner pill, the tab pair), the app's toasts, the on-video / on-image HUD
 * (`--sw-video-scrim*` and `--sw-on-video*`: a dark scrim with white text whose contrast does not depend on what lies behind it), the
 * touch affordances of the walk (the joystick ring, the target mark: no text, they must show the scene), and the MODAL layers - dialogs
 * (`sw-dialog`), drawers (`sw-drawer`), the Bubble pop-up sheet (`sw-sheet`), the notification center's panel, the automation editor sheet -
 * whose translucency is bounded by a computed contrast floor (design/contrast.ts) over a dimmed, blurred scrim. The scrim behind a modal
 * (`::backdrop`, `.backdrop`, `--sw-overlay`) may stay translucent.
 *
 * ADDING A MENU: use the two tokens, add the surface to MENU_SURFACES below, and run `tests/unit-menu-lint.spec.ts` (it also finds a new
 * `.pop` / `.menu` / `.tray` ... by its name and fails until it is registered or exempted with a reason) and
 * `tests/evidence-menu-opaque.spec.ts` (opens real menus in every skin x scheme and reads the computed background alpha and blur).
 *
 * ADDING A HUD PANEL: paint it as above and add it to HUD_SURFACES below. `tests/unit-menu-lint.spec.ts` also scans every screen that mounts
 * the plan canvas or the 3D element (and the map's own elements) for a floating rule with a translucent fill, and fails until it is
 * registered here or exempted there with the reason it is not a panel; `tests/evidence-menu-opaque.spec.ts` (the screens without a
 * backend) and `tests/evidence-hud-opaque-live.spec.ts` (the screens that need the fixture backend) read the computed alpha, blur and the
 * text contrast of the real panels in every skin x scheme.
 */

/** A rule that paints a menu: the file (under src/), the rule's selector exactly as written in its CSS, and what it is. */
export interface MenuSurface {
  file: string;
  selector: string;
  what: string;
}

export const MENU_SURFACES: readonly MenuSurface[] = [
  { file: 'shell/sw-user-menu.ts', selector: '.panel', what: 'the user menu: a popover beside the rail (desktop), a bottom sheet (phone)' },
  { file: 'shell/sw-app.ts', selector: '.searchpanel', what: 'the corner search: the field and its result list hang over the page' },
  { file: 'shell/sw-app.ts', selector: '.results', what: 'the search result list' },
  { file: 'components/sw-dropdown.ts', selector: '.pop', what: 'a dropdown / select list (the listbox popover, the phone sheet and the centred box)' },
  { file: 'components/sw-dropdown.ts', selector: ":host(:where(:not([dd-style='auto']))) .pop", what: 'the same list in the six styles' },
  { file: 'components/sw-dropdown.ts', selector: ":host([dd-style='capsule']) .pop", what: 'the same list in the capsule style' },
  { file: 'components/sw-popover.ts', selector: ':host', what: 'a popover card (the map marker card)' },
  { file: 'components/sw-cast-picker.ts', selector: '.panel.pop', what: 'the cast picker anchored to its button' },
  { file: 'components/sw-cast-pill.ts', selector: '.tray', what: 'the cast tray under the pill' },
  { file: 'components/device-activity.ts', selector: '.menu', what: 'the activity row context menu' },
  { file: 'screens/devices-area-nav.ts', selector: '.menu', what: 'the floor / area picker list (a popover, a bottom sheet on a phone)' },
  { file: 'screens/devices-bulk.ts', selector: '.panel', what: 'the bulk menu / the area summary popover of a tree row or tile' },
  { file: 'screens/home-screen-css.ts', selector: '.cmenu', what: 'the home quick actions: the blinds open / stop / close popover beside the count button (HOME-295)' },
  { file: 'screens/home-screen-css.ts', selector: '.hsheet', what: 'the home phone sheets: the floor tree and the area sheet (HOME-295)' },
  { file: 'screens/scenario-recipients.ts', selector: '.pop', what: 'the recipient picker list that opens under the chip box (scenario settings and the scenario editor)' },
  { file: 'water/ui.ts', selector: '.menu', what: 'the water pages row menu (the snooze / actions menu, fixed to its button)' },
  { file: 'screens/media-admin-list.ts', selector: '.colspanel', what: 'the column chooser' },
  { file: 'components/scene-capture.ts', selector: '.pop', what: 'the scene editor device picker' },
  { file: 'components/sw-automation-card.ts', selector: '.pop', what: 'the automation card "..." menu' },
  { file: 'screens/devices-schedules.ts', selector: '.acard .pop', what: 'the schedule card "..." menu' },
  { file: 'styles/media-glass.ts', selector: '.pop', what: 'the media pages popover menu (floor menu, source menu)' },
  { file: 'components/media-player-card.ts', selector: ":host([data-skin='bubble']) .pop", what: 'the player card menu in the Bubble skin' },
  { file: 'components/notify-center.ts', selector: '.srcbtn .pop', what: 'the notification center source filter menu' },
  { file: 'components/notify-row.ts', selector: '.pop', what: 'the notification row "..." menu' },
  { file: 'screens/automation-editor-base.ts', selector: '.typepop', what: 'the step-type chooser of the automation editor' },
  { file: 'screens/automation-entity-picker.ts', selector: ':host', what: 'the entity picker (a popover on a desktop, a bottom sheet on a phone)' },
  { file: 'map/sw-plan-3d.ts', selector: '.timepop', what: 'the time-of-day picker (date, slider, presets) over the 3D plan' },
  { file: 'map/walk-hud.ts', selector: '.sheet', what: 'the walk HUD bottom sheet (places, fields) over the live 3D scene' },
  { file: 'screens/investigate-events.ts', selector: '.rowpreview', what: 'the hover preview over an event row' },
  { file: 'screens/investigate-playback.ts', selector: '.tlpreview', what: 'the hover preview over the playback timeline' },
  { file: 'screens/explore-floor-map.ts', selector: '.roomcard', what: 'the selected room card over the plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.shared-members', what: 'the shared room members card over the plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.panel', what: 'the layers list that opens over the plan' },
  { file: 'screens/system-nav.ts', selector: ':host([compact]) .results', what: 'the settings search result list (in the flow, a card with a shadow)' },
  { file: 'screens/system-nav.ts', selector: '.results', what: 'the same list on a tablet' },
  { file: 'electricity/styles.ts', selector: '.menu', what: 'the meter menu of the formula editor' },
  { file: 'tickets/styles.ts', selector: '.pop', what: 'the ticket card "..." menu (CR-038)' },
];

/** A HUD panel over the plan canvas or the 3D canvas: how it is made opaque (see "WHAT IS A HUD PANEL" above). */
export interface HudSurface extends MenuSurface {
  /** `background` (default): the rule paints `var(--sw-menu-surface)`. `surface-token`: the rule re-points `--sw-surface` at it (and `--sw-surface-2`,
   * the hover fill, at that surface washed towards the ink: `color-mix(in srgb, var(--sw-menu-surface) 92%, var(--sw-text))`) for the shared controls it
   * contains. `fill`: an SVG label pill drawn inside the canvas fills with it. */
  via?: 'background' | 'surface-token' | 'fill';
}

export const HUD_SURFACES: readonly HudSurface[] = [
  // the floor map screen (screens/explore-floor-map.ts), 2D and 3D
  { file: 'screens/explore-floor-map.ts', selector: '.floorchip', what: 'the floor name chip in the corner of the plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.levelbar', what: 'the level chips bar at the top of the plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.floorbtns button', what: 'the quick floor buttons beside the 2D plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.floorstrip', what: 'the floor strip beside the 3D view (short name, name, state dots)' },
  { file: 'screens/explore-floor-map.ts', selector: '.circuits .circuit', what: 'a lighting circuit button over the plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.circuits .cstatus', what: 'the status line under the circuit buttons' },
  { file: 'screens/explore-floor-map.ts', selector: '.pickbar', what: 'the multi-camera selection bar' },
  { file: 'screens/explore-floor-map.ts', selector: '.sidelist', what: 'the side list of what is on the plan (a bottom sheet on a phone)' },
  { file: 'screens/explore-floor-map.ts', selector: '.legend', what: 'the legend pill at the bottom of the 2D plan' },
  { file: 'screens/explore-floor-map.ts', selector: '.banner', what: 'the stale / partial / needs-alignment banner over the plan (the soft state tone laid over the opaque surface)' },
  { file: 'screens/explore-floor-map.ts', selector: '.cover', what: 'the loading / empty / error cover of the stage' },
  // the 2D canvas (map/sw-plan-canvas.ts)
  { file: 'map/sw-plan-canvas.ts', selector: '.controls', what: 'the zoom buttons' },
  { file: 'map/sw-plan-canvas.ts', selector: '.scale', what: 'the zoom readout' },
  { file: 'map/sw-plan-canvas.ts', selector: '.marker .lbl-bg', via: 'fill', what: 'the name label of a device pin' },
  { file: 'map/sw-plan-canvas.ts', selector: '.zone .zl-bg', via: 'fill', what: 'the name label of a room' },
  { file: 'map/sw-plan-canvas.ts', selector: '.zone .tchip rect', via: 'fill', what: 'the temperature chip of a room' },
  { file: 'map/sw-plan-canvas.ts', selector: '.zone .zchip rect', via: 'fill', what: 'the shared-room chip of a room (its zone tone laid over the opaque surface)' },
  { file: 'map/sw-plan-canvas.ts', selector: '.shared-other rect', via: 'fill', what: 'the chip of a shared room that another floor owns' },
  { file: 'map/sw-plan-canvas.ts', selector: '.tribune-entry rect', via: 'fill', what: 'the label of a tribune entry' },
  { file: 'map/sw-plan-canvas.ts', selector: '.cand-score rect', via: 'fill', what: 'the score label of a detected candidate (editor)' },
  { file: 'map/sw-plan-canvas.ts', selector: '.ghost-note rect', via: 'fill', what: 'the note of the door tool ghost (editor)' },
  { file: 'map/sw-plan-canvas.ts', selector: '.ruler rect', via: 'fill', what: 'the length label of the ruler (editor)' },
  // the 3D element (map/sw-plan-3d.ts)
  { file: 'map/sw-plan-3d.ts', selector: '.timepill', what: 'the time-of-day pill (its picker is the registered menu .timepop)' },
  { file: 'map/sw-plan-3d.ts', selector: '.bar', via: 'surface-token', what: 'the view / quality / walk / export row at the bottom of the 3D view (chips, select, button)' },
  { file: 'map/sw-plan-3d.ts', selector: '.strip button', what: 'a level thumbnail of the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.chip', what: 'the temperature chip over a room in the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.lbl', what: 'the room-name and entity pills over the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.more', what: 'the "+N" hint of the pill cap' },
  { file: 'map/sw-plan-3d.ts', selector: '.tip', what: 'the hover tip over a part of the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.note', what: 'the estimated-sizes / fallback notes over the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.spinner', what: 'the loading / error cover of the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.toast', what: 'the export-failed message over the 3D view' },
  { file: 'map/sw-plan-3d.ts', selector: '.pill', what: 'the hint pills of the 3D view (slow device, walk note, aim, stairs prompt)' },
  // the walk (map/walk-hud.ts); its phone sheet is the registered menu .sheet
  { file: 'map/walk-hud.ts', selector: '.walkbar', what: 'the floating walk bar (exit, stand at, route, position fields)' },
  // the alignment stage of a floor picture (map/sw-floor-image-align.ts)
  { file: 'map/sw-floor-image-align.ts', selector: '.res', what: 'the resolution readout on the alignment stage' },
  // the plan editor (screens/explore-plan-editor.ts)
  { file: 'screens/explore-plan-editor.ts', selector: '.rail', what: 'the editor tool rail over the plan' },
  { file: 'screens/explore-plan-editor.ts', selector: '.floorchip', what: 'the floor name chip over the editor plan' },
  { file: 'screens/explore-plan-editor.ts', selector: '.levelbar', what: 'the level / grid / tag bar over the editor plan' },
  { file: 'screens/explore-plan-editor.ts', selector: '.legend', what: 'the legend over the editor plan' },
  // the history map and the event page (screens/investigate-*.ts)
  { file: 'screens/investigate-history-map.ts', selector: '.legend', what: 'the legend over the history plan' },
  { file: 'screens/investigate-history-map.ts', selector: '.chip', what: 'the floor name chip over the history plan' },
  { file: 'screens/investigate-history-map.ts', selector: '.hist', what: 'the "historical state" tag over the history plan' },
  { file: 'screens/investigate-history-map.ts', selector: '.gapbar', what: 'the "gap in the recording" bar of the time scrub over the history plan' },
  { file: 'screens/investigate-event-detail.ts', selector: '.floorchip', what: 'the floor name chip over the event page map' },
  { file: 'screens/investigate-event-detail.ts', selector: '.load3d', what: 'the 3D loading cover of the event page map' },
  { file: 'screens/investigate-event-detail.ts', selector: '.tools3d', via: 'surface-token', what: 'the picture / 2D-3D buttons over the event page map' },
  // the who-is-in-the-building map (screens/explore-presence.ts)
  { file: 'screens/explore-presence.ts', selector: '.stage .note', what: 'the note pill in the corner of the presence plan' },
];

/** The menu selectors the SKIN sheets (design/skins/*.ts) paint: any skin rule that names one must keep it opaque and un-blurred. */
export const SKIN_MENU_SELECTORS: readonly string[] = [':host(sw-popover)', ':host(sw-dropdown) .pop', ':host(sw-app) .searchpanel'];

/** The only places a stylesheet may SET the menu tokens, and the values allowed there (all opaque by construction): the glass bridge, the
 * media Bubble hosts that undo it, and the media remote's host. A new value anywhere else is a second source of truth. */
export const MENU_TOKEN_SETTERS: Readonly<Record<string, readonly string[]>> = {
  'styles/devices-themes.ts': ['var(--dv-surface-solid)', 'var(--dv-border)'],
  'styles/media-glass.ts': ['inherit'],
  'components/media-remote-css.ts': ['var(--mr-surface-solid)', 'var(--mr-border-strong)'],
};
