# BUILDING-SCOPE-CONTROL-2351 - "הצג ושלוט" per building on a multi-building site

Owner follow-up to MULTIBUILDING-HOME-2330 / MAPPING-ASSIST-2330: with the multi-building view on (`home.multi_building.enabled`, default
OFF), "הצג ושלוט" (the summary counters' panel and every control reached from a building view) must keep to the building shown, so acting
in building A never touches building B. Branch `pilot/BUILDING-SCOPE-CONTROL-2351` from `release/2350-train`. No version bump, no merge.

## The rule
- **Multi-building off, one building, or a user shown fewer than two buildings**: no building is named anywhere; every request is
  byte-for-byte today's (pinned by `tests/unit-building-scope-control-2351.spec.ts` - the exact list / preview query strings and the bulk
  body keys without a building).
- **Inside a building** (`level` = a shown building): the tiles' panel ("הצג ושלוט" behind each summary counter), the floor count chips,
  the floor menu's "כבה תאורה" / "כבה הכל", the area row's "כבה אזור" and the area popover's actions all name that building to the server.
  The list, its counts and every group action are cut by the server to the building's areas.
- **Site level ("כל האתר")**: the panel lists the whole site (unchanged), but its group control is shown disabled, with the reason in the
  tooltip only ("פעולה קבוצתית זמינה בתוך בניין - בחרו בניין, או \"כבה הכל\" של האתר"). This keeps the MULTIBUILDING-HOME-2330 rule that
  the building-wide server scope (= every building) is never used on a multi-building site; the site's off goes through its own dialog.
- **Site "כבה הכל" / building "כבה הכל"** (`home-site-off`): every per-floor / per-area request of a building now carries that building,
  so the server refuses it if the floor or area is no longer the building's.
- **Floor lights popup** (the synoptic board and the floors' cross-section, SWITCH-LIGHT-DIMMER-2331): names the floor's building when
  the switch is on and the site has two or more buildings - the same condition under which the floor matching stops guessing by level /
  name (`xs-data.matchContext`), so the server's resolution agrees with the popup's areas.
- **Shared building ("בניין משותף")**: a building like any other - scoping to it reaches only its own areas, scoping to another building
  never reaches it; the site off dialog keeps its existing default (shared unchecked, `home.screen.site_off_shared`); "הסתר משותף" hides it
  as a level, so no request names it from that user's home.

## Server (never trusts the client)
`services/building_scope.py` resolves a building's platform areas from the stored rows, the same way the home's site level does
(`api/home-site.siteModel` -> `xs-model.matchFloors`, `singleBuilding: false`): map placement (a plan room linked to the area) > per-area
row (`home_area_links`, NULL floor = no floor) > platform-floor row (`home_floor_links`), then our floor -> its building; second pass, the
area -> building rows (`home_area_buildings`). Deleted floors / buildings count for nothing.

| Route | New optional parameter | Effect |
|---|---|---|
| GET `/devices/actions/preview` | `building` (query) | the set is cut to the building's areas; an area / floor of another building, or an `only` id outside the building, is 403 `outside_building` (audited `devices.bulk` denied, `phase: preview`, `building_id`); an unknown or deleted building is 404 `building_not_found`; the reply echoes `building_id` and names the building for a building scope |
| POST `/devices/actions` | `building` (body) | the same resolution (the run re-resolves; it never takes the preview's word); refusals audited as `devices.bulk` denied `phase: refused`, `outcome: not_sent`, with `building_id`; the attempt / outcome rows carry `building_id`; the in-flight key is per building, so two buildings can run at once (the entity-overlap guard is unchanged) |
| GET `/devices/items` | `building` (query) | only the building's areas are listed and counted; a floor / area of another building is a 404 |
| POST `/ha/entities/{id}/actions` | `building` (body, optional in `contracts/schemas/entity-action.schema.json`) | the single-device control (every row control of the tiles' panel, its "נעל את כל המנעולים" loop, a WisKey door's open from a tile, a scene / script tile): the entity's own area must be one of the building's, else 403 `outside_building` (details `building_id`, `entity_id`); unknown / deleted building 404 `building_not_found`; both audited as `ha.action` denied with `building_id`, before any pending record or bridge call. Runs right after the permission check (a caller without control keeps its own audited 403 `forbidden` and learns nothing about buildings); on the WisKey door path right after the door permission and before the door hand-off |

All four routes run ONE check, `services/building_scope.Cut` (`cut()` for a scope, `require_entity()` for one entity): which areas are the
building's, `area_in` / `floor_in` / `strays` / `keep`, and the one refusal shape (`refuse()` -> 403 `outside_building`).

Without the parameter nothing changes. The cut only narrows: the permission rules (`devices.control_bulk`, floor-scoped holders, the
installation-wide requirement of the building scope, switch protection, alarm-managed, never-bulk domains) run as before on what is left.
The parameter is enforced whenever it is sent, also while the switch is off (the client never sends it then). No new routes:
`contracts/API_INVENTORY.md` unchanged (first-line docstrings unchanged).

## Server audit: every path that acts on or reveals a device / entity / area / camera / scene (02.11, review of 70c558700)
Two different limits are in play, and the audit checks each:
- **Who may (per user)** = the role bindings (HA_IDENTITY_RBAC_HE §6, §15): a binding on building A reaches A's floors, and an HA entity
  is reached through where it is placed on those floors' maps (`services/ha_scope`: anchors, published circuits, shared rooms). This is
  the only per-user building limit in the product; nothing in this branch adds a user -> building assignment (`hide_shared` /
  `site_entry_building` are personal display preferences, not authority). **Round 14 (below) widened this rule for building bindings:
  placement OR the home's area mapping.**
- **Where the request acts (per view)** = the `building` parameter: the building whose view the control was pressed in. It only narrows -
  it never grants - and it is what keeps "acting in building A never touches building B" on a multi-building site.

| Path | Acts / reveals | Per-user limit (RBAC) | `building` (view) cut | Verdict |
|---|---|---|---|---|
| POST `/ha/entities/{id}/actions` - single control, scene / script tile, lock-all loop, WisKey tile open | acts | yes - `ha_scope.control_allowed` at the entity's placement, door authority for WisKey | **was missing** | **GAP - closed** (`_building_gate`, shared `Cut`) |
| GET `/devices/actions/preview`, POST `/devices/actions` - bulk, floor menu "כבה תאורה / כבה הכל", area "כבה אזור", site / building "כבה הכל", floor lights popup | acts | yes - `devices.control_bulk` per placement, building scope needs installation | yes (branch) | OK - moved onto the shared `Cut`, behaviour unchanged |
| GET `/devices/items` - "הצג ושלוט" list and counts | reveals | yes - `devices.read` per placement | yes (branch) | OK - moved onto the shared `Cut` |
| GET `/devices/actions/{bulk_id}` | reveals a run | its own requester or `system.configure` | n/a (an existing run; its rows carry `building_id`) | OK |
| GET `/devices/tree`, `/devices/building`, `/devices/home-candidates`, `/devices/entities`, `/devices/entity-pool` | reveal | yes - `devices.read` per placement | n/a - the home's site model is built from the whole tree, the site level must see every building | OK |
| GET `/devices/areas/{id}`, `/devices/{id}/activity` | reveal one area / entity | yes - per placement (+ `alarm.view` for alarm rows) | n/a - a separate screen, not inside a building view | OK |
| PUT `/devices/entities/{id}/area`, `bulk-protected`, `bulk-on`, `climate-kind`, `device-type`, POST `/devices/refresh` | configure | `system.configure` installation-wide | n/a - administration, not control | OK |
| GET `/ha/entities`, `/ha/entities/{id}`, `/ha/actions/{id}` | reveal | yes - `entity.state.read` per placement; an action record to its requester | n/a | OK |
| WS `/ha/ws` (state push), `/me/ws` | reveal | yes - recomputed per placement on every permission change | n/a - one push per user for every open view | OK |
| `/alarm/*` (panel, zones, bypass) | acts | yes - `alarm.*` per placement, code policy | n/a - the alarm screen; the single route refuses alarm-managed controls (409 `use_alarm_screen`) | OK |
| `/multimedia/*` commands, groups | acts | yes - media permissions per screen | n/a - the media screen; the single route refuses managed screens (409 `use_media_screen`) | OK |
| `/automations/{automation,script}/{id}/run`, `/automations/*/dry-run`, `/schedules/{id}/run`, `/scenarios/*` (incl. `test`) | acts | yes - `script.run` / automation / schedule manager permissions, installation objects | n/a - not reached from a building view; an HA automation / script / schedule has no single building | OK (recorded below) |
| `/doors/*`, `/access-control/*` door open, door windows / automations | acts | yes - the one door authority (station level) | n/a - the doors screens; the tile path is the single route above | OK |
| `/floors/{id}/map`, anchors, plan view, circuits from the live map | reveal / act through the single route | yes - floor reach (`access.floor_reach`) | n/a - a floor belongs to one building by construction | OK |
| `/search`, `/search/semantic` | reveal | yes - entity results per placement (`entity.state.read`), cameras via `services/access` | n/a | OK |
| Cameras: live (REST + socket), snapshots, playback, frames, events, cases, exports (estimate / create / download / manifest), compliance export | reveal | yes - `services/access` camera scope (chain camera -> floors -> building -> site) | n/a - cameras are scoped on the RBAC tree itself | OK |
| `/wall/states`, `/occupancy/areas*`, `/presence/building*`, `/temperature*` | reveal | yes - profile allow-list / own permissions | n/a | OK |

**Result: 17 path groups checked, 1 gap found (the single-device control route, with its lock-all loop and the WisKey tile open), 1 closed.**
A user bound to building A cannot control a device of building B on any of these paths (the RBAC placement rule - proven on the single
route and the bulk preview by `test_a_user_bound_to_building_a_never_controls_building_b`); the closed gap is the view cut: a crafted
single request from building A's view naming a device of building B is now refused like the bulk one.

## Round 14 - owner decision 02.11 (answer B): a building binding also follows the home mapping
**The rule.** For permission purposes a device belongs to building X when it is placed on X's floor maps (anchors, published circuits,
shared rooms - the rule before) **or** its area is mapped to X by the home mapping (map placement of a plan room > per-area row > the
platform floor's row, then the area -> building rows: the same resolution as the `building` cut). A union, never a replacement:
- only a binding at the **building** scope or above (building, site; installation is wide anyway) gains the mapped devices - a floor
  binding gains nothing (its reach stays the placement rule);
- an unmapped area (and an entity without an area) adds nothing;
- an explicit deny on the floor the area maps to wins (deny-overrides, as everywhere); a deny on the building / site removes it too;
- a deleted building or floor maps nothing.

**The setting** "הרשאת בניין לפי" (`security.building_reach`): `map_and_mapping` = "מפה + מיפוי אזורים" (default, the owner's answer) or
`map` = "מיקום במפה" (the rule before). It counts only while the multi-building switch is on - **switch off = exactly the rule before**,
whatever the setting says. `PUT /api/v1/home/building-reach {mode}` needs `rbac.roles.manage` across the installation (it changes who reaches
what, like a role edit), audited `security.building_reach` (`mode`, `was`, `multi_building`); read in `GET /sites/{id}/mapping`
(`building_reach`, `can_set_reach`); shown on the mapping screen's settings card (disabled for anyone else). No migration (a settings row).

**One place.** `services/ha_scope` decides it: `visible_floors()` returns a `FloorSet` that now carries `mapped` (the entities reached
through the mapping for that permission) and `entity_visible()` takes the union; `mapping_decision()` gives the allowing decision for the
audit rows (`control_decision`, the media decision, the door targets). Every route of the audit table that asks `ha_scope` follows without
code of its own:

| Path (audit table above) | Follows the mapping reach | How |
|---|---|---|
| single control, lock-all, scene / script tile | yes | `control_allowed` / `control_decision` (audit `scope_type` = `building`) |
| bulk preview / run, the tiles list, the tree, area / activity reads, the catalogue, entity detail | yes | `scoped_rows` / `control_checker` / `bulk_scope` -> `entity_visible` |
| WS `/ha/ws` (state + media push) | yes | `visible_floors` + `entity_visible`; re-scoped at once on a mapping change (below), else within 60 s |
| alarm, multimedia, elevators, temperature, water, automations / schedules / scenarios scope, notifications, tickets device context, camera cards (HA cameras) | yes | each calls `visible_floors` + `entity_visible` (or `entity_allowed` / `scoped_rows`) |
| door unlock of an HA lock (`door_authority`) | yes | the mapped building is an allow target, the mapped floor a deny target |
| `/search` | yes | its own placement query plus `FloorSet.mapped` (the one place) |
| VMS cameras (NVR live, playback, exports, events) | n/a | not HA entities: no area; scoped on the RBAC tree by their own anchors (`services/access`) |
| partner API keys | n/a | a key's own floor restriction, not a role binding (`partner/core.entity_covered`) - unchanged |

**Stale reach.** Nothing is cached across REST requests (reach is worked out on every call). Long-lived sockets re-scope on the user's
access generation: every mapping write (the floor's home links, the assistant's apply / restore, a plan room's area link), the switch and
the setting call `building_scope.mapping_changed` -> `revocation.mark(all users)` while the mapping counts (or just stopped counting), so an
open socket re-scopes at once. Off = no signal (and so no capture-lease side effect), exactly as before.

**Mapping writes became permission-relevant - the RemapGuard.** With the mapping counting, a floor editor of building A could include
building B's area on his floor and pull B's devices into the reach of A's holders. While the mapping counts, every mapping write therefore
also needs the route's own permission where each moved area is NOW (its floor, else its building) - the source-and-target rule of a camera
move (HA_IDENTITY_RBAC_HE §5). Refused = the writes rolled back (savepoint), the audited 403 of `require`, nothing written. Switch off:
the routes are exactly as before.

**Open for the owner.** (1) While the switch is off, mapping edits are not guarded (byte-identical rule); rows prepared then become
authority the moment the switch is turned on - whoever turns it on should look over the mapping versions first (each names who applied
it). (2) Home Assistant moving an entity to another HA area changes its mapped building: REST follows at once, an open socket within 60 s
(the registry sync sends no access signal).

## Frontend
- `api/home-site.ts`: `controlBuilding(site, level)` (the home's building, '' for no site model / the site level / a hidden or gone
  building) and `floorScreenBuilding(multiOn, siteBuildings, id)`.
- `api/devices.ts` `itemsQuery` / `getDeviceItems(..., building)`; `api/device-bulk.ts` `previewQuery` / `bulkBody` /
  `previewBulk(..., building)` / `runBulk(..., building)`; `BulkPreview.building_id`.
- `devices-bulk-dialog` `.building` (applied to every request it is shown unless the request names its own); `devices-tiles-panel`
  `.building` (list + its own bulk dialog; the heading says "ב<building>" instead of "במבנה") and `.bulkHold` (the site level's disabled group control).
- `devices-building.ts`, `home-site-off.ts`, `devices-synoptic.ts`, `explore-floors.ts` wire them.
- Single control (the gap): `api/ha.ts` `actionBody(..., building)` / `runAction(..., building)` (the key only when named);
  `api/device-commands.ts` `CommandOptions.building`; `DeviceControls.building` (every row control: power, sliders, covers, climate, media,
  lock / unlock); `devices-tiles-panel` passes its `.building` to its controls and to its lock-all loop. The 403 needs no new handling: the
  row's command rolls back with the server's own message (the existing `runCommand` error path).

## Tests (run 02.11 on the workstation, one worker)
- Backend `tests/test_building_scope_control_2351.py` (5): resolution from the rows (per-area row beats the floor row, a hand-cleared area
  has no building, a deleted building owns nothing / 404); scoped preview and run reach only the building, the shared building only its own,
  the audit names the building, the other building untouched; cross-building area / floor / `only` refused 403 on preview and run, each
  audited, nothing sent, unknown building 404, empty id 422; the tiles list per building (+ 404s); a floor-scoped holder still cannot act
  on the whole building. Targeted run with test_devices, test_media_bulk, test_mapping_assist_2330, test_multibuilding_home_2330,
  test_home_links: **101 passed, 0 failed**.
- Frontend unit `tests/unit-building-scope-control-2351.spec.ts` (4) with home-site-2330, mapping-assist-2330, bulk-headline, allon-turn-on,
  home-screen-295: **43 passed**. `npx tsc --noEmit` clean. Lints: token / menu / a11y-polished / entity-id-sweep unit specs 31 passed;
  `scripts/lazy-tags-check.mjs` OK.
- Single-route gap (02.11, `tests/test_building_scope_single_2351.py`, 7): in-building / cross-building / no-area / unknown / empty id on the
  single route (403 / 404 / 422, audited, nothing recorded or sent); single and bulk agree on the set; permission first (a viewer gets
  `forbidden` whatever building it names, no building audit rows); a building-A binding never controls building B (single route with no /
  the other / its own building, and the bulk preview); the WisKey tile open checked before the door hand-off; and the identity proof,
  switch OFF and switch ON at the site level: the building code is replaced by a function that raises and never runs, the single reply is
  the action record + `note` / `timing_ms`, the attempt row's details are exactly `action, id, phase, arguments, sensitive`, the bridge
  payload is unchanged, the list / preview / run carry no building. Mutation check: with the gate disabled 3 of the 7 fail.
  Regression, one file per process: 27 files, **482 collected, 481 passed, 1 failed** - `test_lat1_toggle_latency::
  test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock` (a wall-clock bound: dispatch 2.0-2.6 s vs 1.9 s on the
  loaded workstation); it fails the same way with the branch's original `routers/ha.py` (2 runs), so it is load, not this change - to be
  re-run on the runner's timing lane. Frontend: unit-building-scope-control-2351 (5, incl. the single body) + circuit-action, home-site-2330,
  mapping-assist-2330: **28 passed**; token / menu / a11y / entity-id-sweep / allon / bulk-headline / home-screen-295 specs **86 passed**;
  `npx tsc --noEmit` clean; `lazy-tags-check` OK.
- Round 14 (02.11, `tests/test_building_reach_round14.py`, 8): a building-A binding reaches A's mapped devices that are on no map (list,
  single control, entity detail, bulk preview / run, search; the audit row names the building binding) and none of B's or of no area; a
  floor binding gains nothing; "מיקום במפה" removes the mapping reach (only `rbac.roles.manage` may set it: 403 + audit for a building
  site_admin, the change audited with `mode` / `was`, sockets signalled) and back; remapping an area moves its reach at once (and signals);
  a deny on the mapped floor wins; the RemapGuard refuses a floor editor pulling B's area (audited 403 on B's floor, nothing written) and
  allows his own and the same edit with the switch off; and the identity proof, switch off and switch on + "מיקום במפה": the mapping code
  replaced by a function that raises never runs and the reach is the placement rule exactly. Mutation: with the mapping reach disabled
  6 of the 8 fail (the two OFF proofs pass by design). Regression, one file per process: 33 files, **712 passed, 1 failed** - the same
  `test_lat1_toggle_latency` wall-clock test as above (load; fails identically without this work). Frontend: tsc clean; 2351 spec 6 passed
  (incl. the setting's two values / labels); mapping / home-site / lint specs 96 passed; `lazy-tags-check` OK.
- NOT_RUN: browser evidence (the multi-building evidence specs against a build) - the workstation is low on memory and the runner is busy
  with release gates; no pixel change is expected for one-building installations (no new element is drawn without a site model), the
  building view only changes the panel heading's words and the site level's master control state.

## Known limits
- ~~A single-device control from a panel row takes no building.~~ Closed 02.11: the single route takes `building` and runs the shared check.
- The `building` cut is a per-view guard, not a permission: a client that omits it acts with the caller's own RBAC reach (exactly as at the
  site level). The per-user limit is the role binding - since round 14 placement OR (building bindings, switch on, setting default) the
  home mapping; see "Round 14" above.
- Automations, scripts, schedules and scenarios are installation objects: their run-now routes take no building (one HA automation may
  touch several buildings). A scene / script pressed on a tile inside a building goes through the single route and is cut there.
- The synoptic / cross-section popup sends a building only with two or more buildings on the site; with one building the request is as before.
