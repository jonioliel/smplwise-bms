# DD6 - conversion of hand-built menus to the shared dropdown (capsule-capable)

Component: `frontend/src/components/sw-dropdown.ts` (styles, size, ring and panel dials in `dd-style.ts`; the group's values come from
`ddStyleOf / ddSizeOf / ddRingOf / ddPanelOf` in `shell/tabs-mode.ts`). Search method: grep of `frontend/src` for `role="menu"`,
`role="listbox"`, `aria-haspopup`, `<select` and `popover=`, compared with the users of `<sw-dropdown>`.

## Already on the component
`sw-tabs` (dropdown form), the shell's pair chip, `devices-area-nav` (pair chip), `devices-schedules`, `nvr-encoding-batch`,
`media-admin-list` (filters, sort, group).

## Converted
| Place | Verdict |
|---|---|
| `screens/multimedia-players.ts` floor menu ("כל הקומות") | **Converted.** `sw-dropdown` with an icon and a count per floor, a divider after "הכל", the unplaced floors last; style, size, ring and panel width of the `multimedia` group. |
| `screens/multimedia-screens.ts` floor menu | **Converted** (same). |

The old `.floorbtn` / `.flwrap .pop` CSS and the open / outside-click / Escape handling were removed (the component does its own).

## Left as they are, with the reason
| Place | Why |
|---|---|
| About 250 native `<select>` in forms and settings (diagnostics, plan studio, access, investigate, schedules, ...) | Form fields, not menus: the platform picker is right on phones, keeps form semantics and validation. A different job from the navigation / filter dropdown. |
| `components/notify-center.ts` source filter (`data-source-menu`) | A single-choice filter, a conversion candidate, but the notification centre belongs to no tab group, so there is no style / size setting to follow. Needs an owner decision (see the report). |
| `screens/devices-area-nav.ts` breadcrumb menus (floor / area crumbs) | Breadcrumb navigation menus with link targets on the desktop; the areas of a floor are already the dropdown in the dropdown form. Converting would change the breadcrumb's meaning. |
| `components/media-player-card.ts`, `media-screen-card.ts` source menus; `media-player-panel.ts` transfer menu | Action menus with live-loaded content ("loading..." state, shake feedback); not a choice of one value. |
| "more" menus (`sw-automation-card`, `devices-schedules` card menu, `notify-row`, `devices-bulk`) | Action menus (several different commands), not a selection. |
| `scene-capture` / `meter-picker` / `elec-formula-editor` / `automation-entity-picker` / `devices-camera-picker` lists | Multi-select pickers or add-actions with search and rows, a different widget. |
| `shell/sw-app.ts` search results listbox | A combobox result list, not a dropdown. |
| `screens/system-tabs-mode.ts` style / size / ring / panel selects | The settings that choose the dropdown look: they must stay native so the choice is always usable. |
