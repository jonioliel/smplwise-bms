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
