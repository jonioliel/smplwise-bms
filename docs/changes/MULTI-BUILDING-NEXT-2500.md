# MULTI-BUILDING-NEXT-2500 - the rest of the multi-building next phase (filtering, lobby audience, area-move signal)

Card MULTI-BUILDING-NEXT-2490 (owner answers 22.11, Q62-Q69 = the recommendations; Q69 order: safety, then the home interface, then the
filtering and the lobby). Design: T119 next phase (`docs/design/t119-multi-building/DESIGN.md` on `pilot/FEATURE-DESIGNS-HOME-2490`).

Branch `pilot/MULTI-BUILDING-NEXT-2500`, based on `origin/pilot/MULTI-BUILDING-HOME-2500` (63e7a7c02) with
`origin/pilot/MULTI-BUILDING-SAFETY-2500` (d00aa3ede) merged in (b2107de25, no conflicts - the home row did not contain the safety row;
both branch from 619f94d04 = 2.47.0). No version bump, no new migration (the home row's 0218 stays the only one).

## What the two earlier rows already cover (not repeated)

| Owner answer | Row | Built there |
|---|---|---|
| Q62 floor move with "who loses access" | SAFETY | preview + digest-confirmed move, both buildings' permission, `floor.move` audit, sockets re-scoped |
| Q63 check before switching on, a setting skips it | SAFETY | `GET /home/multi-building/check`, `home.multi_building.review` |
| Q64 "כל הבניינים" hidden, a setting shows it | HOME | `home.building_all` |
| Q65 first building per person, else the device's last | HOME | `home_interface_policy.building_id` (0218) |
| Q66 "כבה הכל" of the chosen building, named | HOME | the bulk route's `building` |
| Q67 a meter / schedule serving two buildings shows in each with a note | HOME (home interface only) | `area_buildings`, "גם ב..." |
| Q68 each lobby board belongs to a building, greeting by name | HOME | `notice_boards.building_id` (0218) |

## What this row builds ("the rest of the card")

1. **The building filter of the full interface's lists** (Q69 "then the filtering"; T119 row MB-SCREENS-FILTER; Q67 applied to the full
   interface).
2. **The lobby remainder** (T119 MB-LOBBY-BOARD step 3): the notice editor's audience shortcut per building and the board's building on
   the board chips.
3. **The area-move signal** (T119 MB-HA-AREA-SIGNAL, design gap G4 - a safety item: building reach that moved silently for up to 60 s).

### 1. The building filter (display only, narrowing only)

`services/building_filter.py` (new). One rule for five lists:

| Route | `building` parameter | Each item gains | The item's buildings come from |
|---|---|---|---|
| `GET /energy/meters` | yes | `buildings` | the meter's area |
| `GET /schedules` | yes (before totals and paging) | `buildings` | the areas of the schedule's target entities |
| `GET /calendar/rooms/day` | yes | `buildings` | the room calendar's floor (our floor -> its building) |
| `GET /ha/entities` (the plan editor's device search) | yes | `buildings` | the entity's area |
| `GET /search` | yes (before the per-kind counts and limit) | `buildings` | the hit's floor; a building hit = itself; an unplaced entity = its area |

- The area -> building resolution is the building cut's (`building_scope.area_buildings`: map placement, the per-area row, the floor's
  row, then the area -> building row).
- Q67: an item of the shared building ("בניין משותף") serves every building; an item in no building shows under every building, without a
  note. The screens write "גם ב<the others>" next to an item that serves the chosen building and others (meters, schedules).
- The answer gains `building_filter` = `{buildings, building}`: the choices are the buildings the caller's own (already
  permission-filtered) items sit in, the full interface's order, shared last. Fewer than two and nothing chosen = no key at all.
- **It only narrows**: it runs after each route's own visibility rule, on what the caller already sees; it never adds an item, never reads
  or writes a binding. A building the caller sees nothing of is never offered.
- **Off = exactly before**: while `home.multi_building.enabled` is off, or the new setting `home.multi_building.filter` is "off", or there
  are fewer than two live buildings, `prepare` answers None: no new key, the `building` parameter is ignored (the screens never send it
  then), the filter's code is not constructed (the test replaces `View` with a raising function). While on, an unknown / deleted building
  is the shared 404 `building_not_found`.
- **The setting** `home.multi_building.filter` = `on` (default, the recommendation) / `off`: `PUT /home/multi-building/filter {mode}`,
  the switch's own permission (site.content.configure on every live site - display only, so not the roles authority), audited
  `home.multi_building.filter` (`mode`, `was`, `multi_building`). `GET /sites/{id}/mapping` gains `filter_mode`, `can_set_filter`. A settings
  row outside `GET /settings`, like `home.multi_building.review`. No migration.

Frontend (each module keeps its look): `components/sw-building-filter.ts` - one compact `sw-segmented` ("כל האתר" + the buildings),
drawn only when the list answered `building_filter`; the pure rules in `components/building-filter-logic.ts`; the choice is remembered on
the device (`sw.building_filter`, one key for every list) and a list opens on it when it offers that building.

- תשתיות › מוני חשמל › מונים: a row under the head; the tiles, the areas tree and the list count the chosen building's meters; "· גם ב..."
  after the area (table, cards, phone rows). The water meters page shares the base and draws nothing (no buildings there).
- בית › תזמונים: the filter in the toolbar; the rows, the floor chips, the state counts and the paging follow the building; "· גם ב..."
  in each row's second line.
- יומנים › חדרים: a row under the day heading; "מצא חדר פנוי" and the paging follow it.
- עורך תוכנית › הוספת התקן / תאורה: the device search opens on the edited floor's own building (sent as `building`; the server ignores it
  while the filter is off) and the row switches it.
- The global search popover: the row above the results; the device's last building is applied once the hits span buildings.
- הגדרות › בניינים ומיפוי › "איך המיפוי מתנהג": a new row "סינון לפי בניין ברשימות" - מוצג / מוסתר.

### 2. The lobby remainder

- The notice editor (ראשי › לוח הודעות and הגדרות › לוח הודעות), audience "לפי מקום": when the floors span two or more buildings, one key
  per building, "כל מגדל א", picks or clears all its floors (`notices/building-audience.ts`). A shortcut only - the audience is still the
  floor list the server checks against the writer's scope.
- The board chips of the editor say " · <building>" for a board that belongs to a building (from `GET /notices/boards` `buildings`).

### 3. The area-move signal (safety)

`building_scope.reach_snapshot` / `registry_moved`, called by the registry refresh (`services/ha_sync`) and its developer twin
(`POST /ha/dev/registry`). While the mapping counts for reach (the switch on and "מפה + מיפוי אזורים"), a refresh that moves an entity to
an area of another building - or none - now re-scopes every open socket at once (`revocation.mark(all users)`, before: up to the 60 s sweep)
and writes one system audit row `home.mapping.area_moved` (`entities`, `buildings` touched, `sample` of up to 20 entity ids, `reach_on`).
Nothing is written to the home system; no binding changes; the signal never costs the refresh (logged and left to the sweep on failure).
Switch off / "מיקום במפה": nothing runs (the rule before).

## Safety review (RBAC)

- No route grants anything new. The filter runs after visibility and only removes items (tests: a building-A operator gets a subset for
  every building choice; the catalogue never gains an entity; the schedules total counts the building's own).
- The filter setting changes display only and takes the switch's permission; refused for a building-scoped site administrator (403).
- The audience shortcut adds floors to a draft only; the server's audience scope check is unchanged.
- The area-move signal narrows the window in which a socket keeps a reach the mapping already removed (or lacks one it gained); it is
  audited.

## Tests

Run 24.11 night. The runner was overloaded for the whole session (slots B/C held by long chains of other rows, load up to 228,
ssh timing out); the three runner jobs of this row were queued for ~3 h and never started. Everything below "workstation" ran on the
workstation, one test file at a time (the agent rules allow one small file at a time there; the backend venv of the main checkout,
`SW_WIRE_STRICT=1`).

| Run | Where | Result |
|---|---|---|
| `tests/test_mb_next_2500.py` (10 tests: off / setting off / one building = before with the filter's code replaced by a raising function; the catalogue's buildings and the narrowing, shared building serves all, unplaced shows everywhere, 404; a building-A operator only ever gets a subset; meters; global search incl. counts and floor hits; the View rules; schedules before totals and paging; the filter setting's permission, 422 and audit; the area-move signal: audit row, nothing while off, nothing under "מיקום במפה", every user marked) | workstation | **10 passed** |
| Mutation check (each guard disabled in turn, the file restored after each): the narrowing (`keep`), the setting rule, the shared building rule, the setting route's permission, the dev-registry signal call, the search's cut, the unknown-building 404 | workstation | **7 of 7 caught** (1-5 tests fail each) |
| `test_mb_home_2500.py` (its `_multi` now confirms with the check digest - the safety row is merged in) | workstation | **11 passed** |
| `test_mb_safety_2500.py` | workstation | **12 passed** |
| `test_building_reach_round14.py` | workstation | first **1 failed** (`test_off_nothing_new_runs_and_reach_is_todays[map_only]`: the catalogue's display filter entered `area_targets`, which that test forbids for the reach path); the test now turns the display filter off by its setting in that case -> **8 passed** |
| `test_building_scope_single_2351.py`, `test_building_scope_control_2351.py`, `test_multibuilding_home_2330.py`, `test_mapping_assist_2330.py` | workstation | 7, 5, 5, 8 **passed** |
| `test_schedules_api.py`, `test_home_interface.py`, `test_energy_api.py`, `test_search.py`, `test_global_search_gate_295.py`, `test_ha.py`, `test_rbac_matrix.py` | workstation | 31, 26, 15, 1, 6, 5, 2 **passed** |
| `test_wire_consumption_2450.py` (gen_wire_types `--check`), `test_wire_calendar_2470.py`, `test_wire_route_coverage_2460.py`, `test_wire_routers_b_2450.py`, `test_wire_routers_c_2470.py` | workstation | 13, 3, 5, 66, 58 **passed** |
| `scripts/gen_wire_types.py`, `scripts/api_inventory.py` (1914 -> 1915 routes) | runner (before it overloaded) | regenerated, committed |
| `scripts/design_ratchet.py` | workstation | no count above the baseline |
| `ruff check` on every changed backend file | workstation | clean |
| `tests/unit-mb-next-2500.spec.ts` (5: entry choice, shows / keep, "גם ב...", keys, the audience shortcut) | workstation (`-c playwright.unit.config.ts`) | **5 passed** |
| `tsc --noEmit` (app, tests, scripts), eslint on the changed files, `unused-exports --enforce`, `lazy-tags-check` | runner | **NOT_RUN** (queued, never started) |
| The other backend shards (rbac x5, catalog, shared spaces, mapping improve, ha structure / labels / authority, devices, energy integration, schedules scope / mirror, calendar engine / grid edit, notices x2, wire routers d / notices, setting callers / parity, release check) | runner | **NOT_RUN** |
| `tests/evidence-mb-next-2500.spec.ts` (meters, rooms, schedules before / after, the settings row; desktop 1440 + phone 390, light + dark; 0 px horizontal overflow asserted) and the multi-building evidence of the earlier rows against a build of this branch | runner | **NOT_RUN** - so the compare page has no captures yet |

To finish on the runner (slot B, `--workers=2`): `cd frontend && npx tsc --noEmit -p tsconfig.json && npm run -s typecheck`, then
`npx vite build` and `SW_BASE_URL=http://127.0.0.1:<port>/ SW_SHOTS=<dir> npx playwright test tests/evidence-mb-next-2500.spec.ts
tests/evidence-mb-safety-2500.spec.ts tests/evidence-mb-home-2500.spec.ts tests/evidence-mapping-assist-2330.spec.ts --project=desktop
--workers=2`, and the backend shards above (one pytest process per shard).

## Open questions for the owner (not blockers; recommendation first)

1. **Where the filter setting lives.** Built: הגדרות › בניינים ומיפוי (next to the other multi-building settings) instead of the
   design's הגדרות › תצוגה. (a) keep (recommended); (b) move it to תצוגה.
2. **The home interface's notices / calendar / presence by building** (T119 MB-HOME-IFACE step 7) - not in Q64-Q68 and not built here.
   (a) a later row, after the owner sees the lists' filter (recommended); (b) build it now.
3. **Rooms of the shared building** in the rooms filter show under every building (the Q67 rule). (a) keep (recommended); (b) only under
   the shared building.
4. **Resident groups per building, the cross-section widget, the user guide** (T119 MB-RESIDENT-GROUPS / MB-XSECTION-WIDGET / MB-DOCS)
   were not part of Q62-Q69. (a) separate cards when the owner asks (recommended); (b) add them to this row.

## Known limits

- The plan editor's device search and the global search filter on the server (their lists are limited); the meters, schedules and rooms
  are filtered in the browser from the full answer (the server also answers `building` for API callers).
- The area-move signal compares the entity -> building map before and after each refresh while the mapping counts (one extra read of the
  registry rows per refresh, only with the switch on).
- The global search's remembered building costs one extra read the first time a person's hits span buildings.
- The display filter also runs under "מיקום במפה" (the switch on, the mapping not counting for reach): it reads the mapping for display,
  like the home site view; it never changes reach.
- The frontend was not type-checked or built in this session (see Tests): the first runner slot should run tsc before this row boards a
  train.

## Rollback

Revert the branch commits after the merge commit. No migration; the `home.multi_building.filter` settings row is ignored by an older
version.
