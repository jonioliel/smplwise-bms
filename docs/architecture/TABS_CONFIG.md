# Tabs configuration and the map's default floor

Owner request 2026-09-30. Backend contract for the frontend (agent E2). Backend code: `smplwise_vms/backend/smplwise/routers/settings.py`
(`ui.tabs`, `map.default_floor`) and `routers/catalog.py` (`delete_floor`). Tests: `tests/test_ui_tabs_config.py`.

Both keys use the existing product-settings path: `GET /api/v1/settings` (any signed-in user; the answer also carries
`can_edit`), `PATCH /api/v1/settings` (permission `system.configure` at installation scope, the same as `ui.tile_layout`),
every change written to the audit log as `settings.update` with the changed keys and values.

## `ui.tabs`

An installation-wide choice of which tabs each navigation section shows and in which order.

```json
{
  "security":      { "order": ["alarm", "live", "events"], "hidden": ["events"] },
  "security.live": { "order": ["wall", "views"],           "hidden": [] },
  "explore":       { "order": [],                          "hidden": ["entities"] }
}
```

- **Read:** `settings["ui.tabs"]` is a JSON **object** (not a string, unlike `ui.design_names`). Default `{}` = nothing
  configured = today's built-in tabs and order. A stored value that is corrupt reads as `{}`.
- **Write:** `PATCH /settings` with `{"ui.tabs": {...}}`. The whole value is **replaced**, never merged: send the complete
  object. `{}` clears it. A PATCH that does not carry the key leaves it unchanged. The response is the same as GET.
- **Keys:** the top level maps `section_id` to an object with the optional keys `order` and `hidden` (lists of `tab_id`).
  Nothing else is accepted inside a section. The answer always has both lists (a missing one reads `[]`).
- **Nesting:** a nested level is just another section id, by convention `parent.child` (`security`, `security.live`).
  The backend attaches no meaning to the dot.
- **Ids:** short slugs matching `^[a-z0-9][a-z0-9_.-]{0,47}$` (lower case, digits, `_`, `.`, `-`; at most 48 characters).
  Section and tab ids are the frontend's own ids (`frontend/src/shell/nav.ts`); the backend does not know the registry, so it
  stores unknown ids as given and the UI ignores ids it does not know (and ids that vanish from the registry later).
- **Caps:** at most 64 sections; at most 64 ids in each of `order` and `hidden` (counted before de-duplication).
  Duplicates inside a list are removed (first occurrence wins).
- **Errors:** `422 {"code": "validation"}` for a non-object, a non-object section, unknown keys, non-list or non-string
  entries, a non-slug id or a size over the caps. 403 without `system.configure`. Nothing is stored on a refusal.

### Semantics (what the UI must do)

- `order` = the preferred order. Tab ids that are in the registry but missing from `order` are appended after it in their
  default (built-in) order. Ids in `order` that the registry does not have are skipped.
- `hidden` = not shown as a tab. Hiding wins over `order`.
- **Presentation only.** Hiding a tab does not remove anyone's permission and does not close the route or the API behind it;
  permission-based hiding (`TAB_PERMISSIONS`) still applies on top and is unchanged. A hidden tab is simply not offered.
- **At least one tab per section stays visible.** This is enforced by the UI (the settings editor must not allow hiding the
  last visible tab; the shell should fall back to showing the first permitted tab if a stored value hides them all), not by
  the backend, which cannot know which tabs a section has.
- Settings screens must remain reachable: the UI should never let this key hide the way back to the tabs editor itself.

## `map.default_floor`

The floor the map's floor tab opens first when the installation has several buildings / floors.

- **Read:** `settings["map.default_floor"]` is a string: a floor id, or `""` (default) = the built-in order (the UI's
  current "first floor" rule).
- **Write:** `PATCH /settings` with `{"map.default_floor": "<floor id>"}`, or `""` to clear. It must be an existing, not
  deleted floor: otherwise `422 validation` (details `map.default_floor`). Ids that are not id-shaped are refused the same way.
- **Deleting that floor** (`DELETE /floors/{id}`, with or without `force`) clears the setting to `""` in the same request.
  The audit log gets a `settings.update` row (`{"map.default_floor": "", "reason": "floor_deleted", "floor_id": ...}`) and the
  `floor.delete` row carries `map_default_floor_cleared: true|false`. A refused delete (409, anchors without `force`)
  changes nothing. Buildings and sites cannot be deleted while they have floors, so no other delete path exists.
- **Scope:** the setting is installation-wide, so it can name a floor a given user may not read. The UI must fall back to
  the user's first readable floor (from `GET /sites`) when the default is not in the tree it received; the setting never
  grants access to a floor. No new endpoint was added: the frontend already has the tree (`GET /sites`) and the settings.

## Frontend (agent E2, 2026-09-30)

- **Registry:** `frontend/src/shell/nav.ts` `TAB_SECTIONS` lists the configurable sections and their ids: `areas` (the rail and
  phone bottom bar: devices / security / explore / wiskey), `security` (the sections לייב / חקירה), `security.live`,
  `security.investigate`, `explore` (sites, floors), `wiskey`, `system` (settings tabs), `system.security`. Every tab row goes
  through `visibleTabs` -> `configureTabs`; the security sections through `visibleSections`; the rail through `visibleAreas`.
  Design B's flat entries share the explore / wiskey / settings arrays, so they follow too (its cameras / events / playback groups
  are not configurable). Demo mode (no backend) always shows the defaults.
- **Editor:** הגדרות › כללי › לשוניות (`screens/system-tabs.ts`, tab `tabs` of `system-diagnostics`): show / hide switch, drag handle,
  up / down buttons and arrow keys per tab, "אפס לברירת המחדל" per section, one Save (`PATCH /settings {"ui.tabs": ...}`).
  The last visible tab of a section cannot be hidden and `system.general` (the way back to the editor) is locked. Ids the browser
  does not know right now (WisKey's catalogue before the panel loaded) keep their stored place.
- **Shell rules:** permissions gate first; hidden = not offered, the route keeps working by deep link for holders of the permission
  (no tab is the only way in: every configurable tab is also reachable by address). If hiding would leave a user with no tab in a
  section, their permitted tabs are shown after all. A configured section lands on its first visible tab (the section entry, the
  rail entry, a bare `#/security` still opens the section this browser used last). The admin's `areas` order is the rail's default;
  a user's own `nav.order` (`/me/prefs`, `stored`) wins for that user, and a user without one follows the admin's.
- **Map default floor:** `api/catalog.ts entryFloor(tree, id)`: the setting when it is in the user's own tree (`GET /sites`), else the
  user's first floor; used where the map resolves its `f0` alias. Set in הגדרות › כללי › מפה (grouped by site and building).
- **Device catalogue:** now הגדרות › קטלוג התקנים (`#/system/entities`, `system.configure` at installation scope, checked by the shell
  and by the screen). `#/explore/entities[?q=]` redirects (`legacyRedirect`) to it for holders and to the map for the rest.
  The backend endpoints are unchanged (see the audit below); they are still readable by any `entity.state.read` holder.

## Entities screen exposure (audit for the coordinator, 2026-09-30)

The map's "התקנים" tab (`frontend/src/screens/explore-entities.ts`, `#/explore/entities`) must become settings-only. This is a
read-only audit; **no backend change was made**, because the endpoints it uses are shared with screens that ordinary
users and editors need.

### What the screen calls

1. `GET /ha/entities` (`listEntities`, `frontend/src/api/ha.ts`) - the catalogue table, up to 800 rows, filters domain / q / area / placed.
2. `GET /ha/ws` (`subscribeHa`) - live state push, to refresh rows.
3. `GET /sites` (`loadTree`) - only to link to the first floor.

The detail drawer is filled from the list row; `GET /ha/entities/{id}` (`getEntity`) has **no caller** in `frontend/src`
(exported but unused). It is used by backend tests only.

### Permission each endpoint requires today (`routers/ha.py`, `services/ha_scope.py`, `roles.json`)

| Endpoint | Requires | Who has it |
|---|---|---|
| `GET /ha/entities` | `entity.state.read`, installation-wide OR on at least one floor | viewer, operator, editor, site_admin, system_admin (not kiosk) |
| `GET /ha/entities/{id}` | `entity.state.read` for that entity (floor scope: only when the entity is placed on the caller's floors) | same roles |
| `GET /ha/ws` | `entity.state.read` anywhere (else close 4403); each pushed entity filtered by scope | same roles |
| `POST /ha/entities/{id}/actions` | `ha.entity.control` or `devices.control` (+ per-action grants) | operator and above; unchanged, out of scope here |

So a **plain viewer and an operator can call all three reads today**; the screen's own gating is only the frontend tab
permission (`TAB_PERMISSIONS['#/explore/entities'] = ['entity.state.read']`, `frontend/src/shell/nav.ts`), which is
menu visibility, not authorization: typing `#/explore/entities` or calling the API directly works for any of these roles.

### What is exposed

Per entity: `entity_id`, registry id, platform, device id, HA area / floor names, name, domain, device class, unit, icon,
category, disabled / hidden flags, supported features, **current state**, attributes (a fixed allow-list in
`services/ha_sync.ATTR_ALLOW`, each value capped; never a token or credential, no raw HA payload), timestamps,
availability, `placements` (floor id and name), `alarm_managed`, and the list of allowed actions (from the bridge's
allow-list). The detail endpoint adds `recent_actions` (last 5: action id, status, error code, **principal username**,
times) and `can_control` / per-action `granted`.

The difference from what the viewer already sees elsewhere (map bundle, devices tree, `/ha/ws`, alarm section):
those show entities **placed on the floors the user reads** or wired to a published circuit; the catalogue also lists
**unplaced** entities (locks, scripts, scenes, sensors nobody put on a map) with their live state to any
installation-wide `entity.state.read` holder, and `include_disabled=true` reveals disabled / hidden ones. Floor-scoped holders
only get placed entities on their floors (tested, `tests/test_ha.py`).

Two smaller findings by reading the code (not exercised by a test):

- **F1 (low): `domains` and `areas` in the `GET /ha/entities` answer are not scope-filtered.** They come from all
  `ha_entities` rows (areas even include removed rows), so a floor-scoped viewer learns every HA area name and per-domain
  entity counts. The `entities` array itself is correctly filtered.
- **F2 (low): `GET /ha/entities/{id}` `recent_actions` shows who acted and the error code** to any `entity.state.read` holder
  of that entity, including a plain viewer.

### Other consumers (why tightening `GET /ha/entities` is NOT safe as a blanket change)

- `screens/explore-plan-editor.ts` (Plan Studio) calls `listEntities` at two places (the entity picker when placing
  an entity, and the switch / light picker for a circuit). Its users are `editor` / `site_admin` (map.edit, placement.edit),
  who do **not** hold `system.configure`; floor-scoped editors need the floor-scoped answer. A `system.configure` gate would
  break Plan Studio for exactly them.
- `/ha/ws`: devices screens, the floor map, the alarm screen and the tiles panel subscribe, for viewers and operators.
  Not tightenable.
- The map bundle (`GET /floors/{id}/map`), devices tree (`/devices/*`), search and event correlation read the same table
  through their own checks and do not call these endpoints.
- No caller exists in `custom_components/`, `mobile/` or the add-on `integration/` (grep of `ha/entities`); `scripts/load_probe.py`
  and Playwright evidence specs use it for measurement only.
- Existing tests that pin today's behaviour (would need to change with any gate): `tests/test_ha.py` (floor-scoped `ron` lists
  his placed entities, `vi` gets none, detail 403 for an unplaced one), `tests/test_alarm.py` (lists `switch` entities).

### Recommendation

1. **Frontend (E2, enough to satisfy "settings-only" for the UI):** the entities screen moves under הגדרות; its route and
   tab require `system.configure` (`can_edit` from `GET /settings`, or the permission list in `/me`), and a direct URL
   `#/explore/entities` for anyone else redirects to the map. This does not touch the backend.
2. **If the owner wants the API closed as well (defence in depth), a backend change with three parts**, not done here
   because it needs an owner decision and test changes:
   a. `GET /ha/entities`: keep the current behaviour for callers who hold `placement.edit` or `map.edit` (Plan Studio) or
      `system.configure`; for every other caller (viewer / operator) return only entities they can see on their floors
      (as the map does), i.e. treat the *unplaced* catalogue as management data. Same for `include_disabled=true`.
   b. Filter `domains` and `areas` with the same visibility rule (F1).
   c. `GET /ha/entities/{id}`: return `recent_actions` only when the caller holds `system.configure` or `ha.entity.control`
      for the entity (F2); nothing else consumes it.
   Each part needs the existing `test_ha.py` cases extended (viewer, operator, floor editor, system admin), and a Plan
   Studio smoke run for an `editor` role before release.
3. Do **not** simply put `system.configure` on `GET /ha/entities` or `/ha/ws`: it breaks Plan Studio for editors and the
   live push for every viewer.

## The home area: "מבט על" and "קברניט" (release 0.1.154)

The `devices` section has two tabs: `building` ("מבט על") and `automations`, whose visible label is now **"קברניט"** (owner
2026-10-02, "for now"; only the label changed, the tab id and every route id are untouched). The old `schedules` tab is gone: the
schedules list is the **first segment** of קברניט, followed by אוטומציות · סצנות · סקריפטים. Frontend only, no backend change.

- **Routes:** `#/devices/schedules[/...]` keeps working unchanged (notifications, the guide, the phone bottom bar and old bookmarks);
  the shell draws it under the קברניט tab (`activeAreaTab` answers `automations`) and the screen shows the segment strip, so there is
  no redirect to a new address. The automations screen's strip starts with "תזמונים", which opens that address.
- **Gates** (`kavarnitSegments(api, can)` in `shell/nav.ts`): the schedules segment needs `schedules.enabled` (not in `HIDDEN_HREFS`) and
  `schedule.view` or `schedule.manage`; the automations segment needs `automations.enabled` and one of the automation rights. The
  קברניט tab is offered while either is, and **opens on the schedules when they are offered, else on the automations**. With neither the
  tab is gone (and with it the tab row, when "מבט על" is all that is left). The strip shows only when there is a second segment to go to.
- **Stored `ui.tabs`:** `normalizeTabsConfig` drops a stored `schedules` entry (order and hidden) from the `devices` section, so no dead
  tab and no hidden segment remain (the settings page `system.schedules` is another section and keeps its own tab). A stored hidden
  `automations` (the old tab of that name) hides קברניט only while the schedules segment is not offered; when it is, the tab stays so
  the schedules are never taken away by a stale entry. The editor (הגדרות › כללי › לשוניות) lists `building` and `automations`.
- **`ui.tabs_mode` groups:** the group is the area (`area` for the home area), not a tab, so nothing changes there: the dropdown and
  hybrid modes see two tabs instead of three.
- **Counts and search** are per segment: each screen keeps its own search and filters; the strip shows the schedules count
  (`/schedules/status`) and the automations, scenes and scripts counts (`/automations/status`) as best-effort numbers.

## Presentation mode: tabs, hybrid or dropdown (release 0.1.153)

How a group of tabs is drawn on the phone (<= 767 px; wider screens are always `tabs`) is a separate setting from the order, the
visibility and the look (`ui.tabs`). Three values: `tabs` (today, the default everywhere), `hybrid` (a bar of up to three items,
a dropdown for four or more) and `dropdown`.

- **Groups** (closed list, `services/tabs_mode.py` and `shell/tabs-mode.ts`): `home` (the areas chip row of an area's page),
  `area` (the sub-tabs of the home / map / WisKey areas), `multimedia` (the area row and the room filter), `security` (the
  sections and their pages) and `settings` (the settings tabs and the security sub-tabs). The main bottom navigation is not a group.
- **Keys**, installation default in `/settings` and the user's own in `/me/prefs` (null = follow the installation):
  `ui.tabs_mode` (`tabs|hybrid|dropdown`) and `ui.tabs_mode_groups` (an object `{group: mode}`). Unknown modes and unknown groups are
  refused with a 422; nothing is silently dropped. Presentation only, no permission is involved.
- **Effective mode** of a group, first match wins: the user's group override, the user's global value, the installation's group
  override, the installation's global value, `tabs`. `tabModeOf(group)` (next to `tabStyleOf`) answers it.
- **In `tabs` mode nothing changes**: the DOM of the `pill` / `underline` / `underline-compact` variants is untouched. In `hybrid`
  a short list keeps the look `ui.tabs` chose; `dropdown` is `sw-tabs variant="dropdown"` (`sw-dropdown`: a real listbox, 44 px
  targets, the selected item's count in the chip, a dot on the chip when a hidden option has an alert). The security sections keep
  the alarm one tap away as its own button in `dropdown` mode while it is not the section shown.
- **UI**: הגדרות › כללי › לשוניות › "תצוגת לשוניות" (installation default, "ההעדפה שלי", per-group selects, a live preview).

## The dropdown look, size, ring and panel: `ui.dd_style`, `ui.dd_size`, `ui.dd_ring`, `ui.dd_panel` (release 0.1.157, extended in the Unreleased capsule change)

The LOOK of a dropdown is its own setting: `ui.dd_style` (+ `ui.dd_style_groups`), installation default and the user's own
(`/me/prefs`, null = follow), resolved user group > user global > installation group > installation global > `auto`
(`resolveDdStyle`). Closed list (`services/dd_style.py` STYLES, `components/dd-style.ts`, `shell/tabs-mode.ts` DD_STYLES):
`auto` (today's look, the default), `pill`, `field`, `underline`, `text`, `prefix`, `tonal`, `capsule`. Unknown values are refused with a 422.
Hebrew labels (`DD_STYLE_LABEL`): the id `pill` is labelled **"כדור מלא"** (renamed from "כמוסה" in the Unreleased polish, label only: id, stored values
and behaviour unchanged) so that it is not confused with `capsule` ("קפסולה").

- **`capsule`** (owner reference 2026-10-04, floor chip "כל הקומות" of another product). Closed: a capsule with a 2 px accent ring (a fractional
  border is snapped to 1 px on a 1x screen, so the ring is 2 px; the open state adds a soft halo), a white-to-accent-tinted fill, a soft bottom
  shadow, the icon at the start (the chip's `icon`, else the selected item's `icon`, else `layers`), a confident label (16 px / 600 at `md`) and a
  small chevron at the end that turns up while open (RTL: icon right, chevron left). Open: a floating, rounded (about 18 px at `md`, scaled by the
  radius dial), translucent panel at least as wide as the chip (240 px at `md`), the selected row a tinted row in the accent colour, every row with
  its `icon` at the start and its `count` as a plain number at the other end, a thin divider for a `divider` item, 52 px rows at `md`. The visible
  capsule is the chip's `::before`: the chip box itself is never under the touch target (44 px on a phone and on the 44 px desktop dial), so a
  small capsule keeps its hit area. Tokens only (four skins, ten palettes, light and dark, the radius / touch / performance dials); on a phone it
  opens as the small list by default, or as the bottom sheet when `ui.dd_phone` is `sheet` (default changed to `list` on 2026-10-05), with 48 px rows in the sheet. Keyboard and listbox / option roles are those of every style.
- **Items API** (`DropdownItem` in `components/sw-dropdown.ts`, `TabItem` in `components/sw-tabs.ts`): `count` (existing: "(6)" in the other styles,
  a plain number in the capsule), `icon` (an `IconName`; only the capsule draws it), `divider: true` (a separator line instead of an option: not
  selectable, skipped by the arrows, type-ahead and search, not drawn while the search narrows the list; the other styles and the tab bars skip it).
  Backward compatible: nothing changes for a list without them. First users: the area chip of the devices screens (a door icon + the entity count) and
  the multimedia rooms chips (a house icon on "הכל", a divider after it, a door icon + the device count on each room).
- **Size** (`dd-size` on `sw-dropdown` / `sw-tabs`): `sm` | `md` | `lg`, `md` being the reference size and, for every other style, today's size.
  Settings `ui.dd_size` (default `md`) + `ui.dd_size_groups` (`{group: size}`), the same two owners, the same groups and the same resolution
  (`resolveDdSize`, `ddSizeOf`), backend twin `services/dd_style.py` (SIZES, `normalize_size`, `normalize_size_groups`) and the same refusals. No
  migration: settings JSON (an absent value reads `md`). Capsule: trigger 38 / 46 / 58 px, label 14 / 16 / 18 px, icon 17 / 20 / 24 px, rows 44 / 52 /
  62 px, panel padding 6 / 8 / 10 px, panel width 200 / 240 / 280 px. Other styles: the chip is 26 / 32 / 40 px (the 44 px hit area is kept), the
  label and the rows follow; rows never go under the touch dial.
- **Ring thickness** (`dd-ring` on `sw-dropdown` / `sw-tabs`, **capsule only**): `"1"` | `"1.5"` | `"2"` | `"3"` px, default `"2"`. Settings `ui.dd_ring` +
  `ui.dd_ring_groups`; the same two owners, groups and resolution as the size (`resolveDdRing`, `ddRingOf`, one generic `Dial` store in
  `shell/tabs-mode.ts` shared with the panel), backend twin `services/dd_style.py` (RINGS, `normalize_ring`, `normalize_ring_groups`, `stored_*`) and
  the same refusals (ids are strings: a number or `"2.0"` is refused). CSS: `--_cring` on the host, the capsule `::before` border. A fractional
  border is snapped to a whole device pixel, so 1 and 1.5 px are only distinguishable (and very thin) on a retina screen; the Settings card says so.
- **Open-panel width** (`dd-panel`, **capsule only**): `"button"` (as wide as the chip) | `"240"` | `"300"` px at `md`, default `"240"`; the size dial
  scales the px values (`ddPanelFloor` in `components/dd-style.ts`: 240 -> 200 / 240 / 280, 300 -> 250 / 300 / 350 for sm / md / lg; the panel is
  never narrower than the chip and never wider than the viewport). Settings `ui.dd_panel` + `ui.dd_panel_groups`, backend PANELS /
  `normalize_panel*`, same owners and resolution (`resolveDdPanel`, `ddPanelOf`). The other styles ignore both attributes.
  No migration: settings JSON (an absent value reads `"2"` / `"240"`; `/me/prefs` null = follow the installation).
- **UI**: הגדרות › לשוניות › "סגנון תפריט נפתח": the style selects, the size selects, the ring-thickness selects ("עובי הטבעת (סגנון קפסולה)") and the
  panel-width selects ("רוחב התפריט הפתוח (סגנון קפסולה)") (installation, personal, per group), the effective style, size, ring and panel of every
  group, a reset button for the personal size / ring / panel, a live preview of every style at the effective size / ring / panel, and a preview of the
  three capsule sizes.
- **Checks**: `tests/dropdown-capsule.spec.ts` (items API, look, keyboard, sizes, resolver, the card), `tests/layout-dropdown-capsule.spec.ts` (the layout
  guard: four skins x light / dark x three sizes x 320 / 390 / 1280 px x touch dial 44 / 32, closed and open), `tests/evidence-dropdown-capsule.spec.ts`
  (screenshots in `docs/evidence/dropdown-capsule/`), `backend/tests/test_dd_style.py` (ring / panel validators, route parity, installation + personal
  round trips, permission, no-migration read); the ring / panel specs are in `tests/dropdown-capsule.spec.ts` ("capsule polish").
