/**
 * MENU SURFACES (owner 2026-10-13): "no transparency in any menu". The one place that names every menu-like surface of the product - the
 * rule, the registry the tests read, and how to add a new menu. Nothing in the bundle imports it (tests/unit-menu-lint.spec.ts and
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
 * WHAT IS NOT A MENU (stays glass; listed, never silently changed): a card or panel that sits ON the page (cards, KPI tiles, floor cards,
 * the building tree, the rail, the phone dock, the corner pill, the tab pair), a HUD bar or chip over a canvas (the 3D time pill, the walk
 * bar, the map's level bar, the video HUD), and the MODAL layers - dialogs (`sw-dialog`), drawers (`sw-drawer`), the Bubble pop-up sheet
 * (`sw-sheet`), the notification center's panel, the automation editor sheet - whose translucency is bounded by a computed contrast floor
 * (design/contrast.ts) over a dimmed, blurred scrim. The scrim behind a modal (`::backdrop`, `.backdrop`, `--sw-overlay`) may stay translucent.
 *
 * ADDING A MENU: use the two tokens, add the surface to MENU_SURFACES below, and run `tests/unit-menu-lint.spec.ts` (it also finds a new
 * `.pop` / `.menu` / `.tray` ... by its name and fails until it is registered or exempted with a reason) and
 * `tests/evidence-menu-opaque.spec.ts` (opens real menus in every skin x scheme and reads the computed background alpha and blur).
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
