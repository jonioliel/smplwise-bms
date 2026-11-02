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

Without the parameter nothing changes. The cut only narrows: the permission rules (`devices.control_bulk`, floor-scoped holders, the
installation-wide requirement of the building scope, switch protection, alarm-managed, never-bulk domains) run as before on what is left.
The parameter is enforced whenever it is sent, also while the switch is off (the client never sends it then). No new routes:
`contracts/API_INVENTORY.md` unchanged (first-line docstrings unchanged).

## Frontend
- `api/home-site.ts`: `controlBuilding(site, level)` (the home's building, '' for no site model / the site level / a hidden or gone
  building) and `floorScreenBuilding(multiOn, siteBuildings, id)`.
- `api/devices.ts` `itemsQuery` / `getDeviceItems(..., building)`; `api/device-bulk.ts` `previewQuery` / `bulkBody` /
  `previewBulk(..., building)` / `runBulk(..., building)`; `BulkPreview.building_id`.
- `devices-bulk-dialog` `.building` (applied to every request it is shown unless the request names its own); `devices-tiles-panel`
  `.building` (list + its own bulk dialog; the heading says "ב<building>" instead of "במבנה") and `.bulkHold` (the site level's disabled group control).
- `devices-building.ts`, `home-site-off.ts`, `devices-synoptic.ts`, `explore-floors.ts` wire them.

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
- NOT_RUN: browser evidence (the multi-building evidence specs against a build) - the workstation is low on memory and the runner is busy
  with release gates; no pixel change is expected for one-building installations (no new element is drawn without a site model), the
  building view only changes the panel heading's words and the site level's master control state.

## Known limits
- A single-device control from a panel row is per entity (`POST /ha/entities/{id}/actions`); the rows a building panel shows are already the
  building's, and the single route takes no building - it is not a group action.
- The synoptic / cross-section popup sends a building only with two or more buildings on the site; with one building the request is as before.
