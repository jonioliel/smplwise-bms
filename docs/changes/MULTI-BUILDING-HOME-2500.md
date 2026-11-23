# MULTI-BUILDING-HOME-2500 - the home interface and the lobby boards on a multi-building site

Owner decisions 22.11 (questions page `private/planning/questions_all_open_2026-11-22.html`, Q64-Q68 = the recommendations). This row
builds the home-interface part of the T119 next-phase design (`docs/design/t119-multi-building/DESIGN.md` on
`pilot/FEATURE-DESIGNS-HOME-2490`, rows MB-HOME-IFACE, MB-LOBBY-BOARD and the Q67 note of MB-SCREENS-FILTER). The safety part (Q62 floor
move, Q63 the check before turning multi-building on) is `pilot/MULTI-BUILDING-SAFETY-2500` and is not repeated here.

- **Q64** - "כל הבניינים" in the home interface is hidden; an installation setting can offer it.
- **Q65** - which building a person sees first: an administrator sets it per person; not set = the last one chosen on that device.
- **Q66** - "כבה הכל" in the home interface acts only on the chosen building, and the building's name is written on the button.
- **Q67** - a meter or a schedule serving two buildings appears in each of them with the note "גם בבניין ב".
- **Q68** - the lobby screen: each board belongs to a building and the greeting uses the building's name.

Branch `pilot/MULTI-BUILDING-HOME-2500` from `main` 619f94d04 (2.47.0). No version bump, no merge. One additive migration.

## The rule that does not change

Everything here is **display**. The person's building, the chosen building in the browser and the board's building never grant, narrow
or check a permission: `services/ha_scope` and `services/building_scope` never read them. The one control this row sends differently -
"כבה הכל" of one building - goes through the existing bulk route with its existing `building` parameter, which
`services/building_scope.Cut` cuts on the server (BUILDING-SCOPE-CONTROL-2351; 403 `outside_building` for anything outside it).

**Switch off = before, exactly.** While `home.multi_building.enabled` is off, or the caller's rooms reach fewer than two of our
buildings, `GET /home/overview` carries no new key and the home interface draws nothing new (the backend test replaces the new code with
functions that raise; the existing home specs pass unchanged against the branch build).

## Backend

`services/home_buildings.py` (new), migration `0218_mb_home_building.sql` (two nullable columns; the number is taken at train
integration - 0217 is used by ONVIF-CLIENT-2500 / ONVIF-UI-2500).

| Where | What |
|---|---|
| `GET /home/overview` | while the switch is on and the caller's rooms reach two or more buildings: `buildings` (id, name, is_shared; the full interface's order, shared last), each room's `building_id` (null = the mapping puts it in no building), `area_buildings` (area -> building for the areas the caller already sees: the rooms, the visible entities' areas and - with energy.view - the live meters' areas; never an area the caller does not see), `building_all` (Q64), `entry_building` (Q65: a wall panel's room building; else the administrator's building for the person when it is one of `buildings`; else null). Otherwise the answer of before. |
| `home_interface_policy.building_id` | Q65: the person's building. `PUT /home/policies/{user_id} {building_id}` (rbac.assign, as every policy field): a live building, `""` clears it; 422 `building_not_found`. The audit row `home_interface.policy.set` gains `building: {before, after}` when the request named it. `GET /home/interface`, `GET /me` and the policies list carry `building_id` only when it is set. `GET /home/policies` gains `buildings` (the picker) only on a multi-building site. |
| `home.building_all` | Q64: the installation setting `building_all` = `hide` (default) / `allow` of `GET` / `PUT /home/settings` (rbac.assign, audited like the other three). |
| `notice_boards.building_id` | Q68: `PATCH /notices/boards/{id} {building_id}` (notices.boards): a live building, `""` = the whole site; 422 `building_not_found`; audited in `keys`. `GET /notices/boards` (full) gains `buildings` only on a multi-building site; a board carries `building_id` only when it has one. The feed (`services/notices/display.build_feed`) greets with the board's building name - read live, so a rename shows at once - while the switch is on; otherwise the chain of before (`notices.building_name` -> project name -> first building -> home title). Which notices a board shows is unchanged (tagged to the board). |

`scripts/gen_wire_types.py` regenerated (wire-home-interface, wire-notices, wire-me). `scripts/api_inventory.py`: 1910 routes, no change
(no new route).

## Frontend (keep each module's look)

- `home/home-buildings.ts` (new): the pure rules - the entry building (`pickBuilding`, `keepBuilding`), the rooms of a building
  (`roomsIn`: its own rooms and the rooms in no building) and the rooms its "כבה הכל" reaches (`offRooms`: its own rooms only - the
  server's cut agrees), the buildings an item serves (`servedBy`: its areas' buildings; an area of the shared building serves every
  building) and its note (`alsoNote`: "גם במגדל ב" / "גם במגדל ב ובחניון משותף"), the floor columns under "כל הבניינים" grouped by
  building (`byBuilding`), the button words (`offLabel`: "כבה הכל ב<בניין>").
- The home interface (`home/sw-home.ts`): a building chip next to the room name (the room chip's look, one size down; no chip on a locked
  wall panel - it always opens on its room's building) opens a bottom sheet with the buildings (shared last, the lights on in each) and
  "כל הבניינים" only when the installation offers it. The choice is remembered on the device (`localStorage` `home.building`). Every
  screen shows the chosen building's rooms; "the house" of a multi-building site is the chosen building: "בכל הבית" becomes "במגדל א",
  the house-wide off buttons (the now bar, the lights screen, "פעיל עכשיו", the lights widget) say "כבה הכל במגדל א" and send
  `scope=building, id=*, building=<id>` (the per-light fallback, for a person without the bulk permission, touches the building's own
  rooms only). Under "כל הבניינים" there is no house-wide off (no whole-site off from the home interface) and the rooms screen groups
  the floor columns by building with the building's name in each header.
- Q67: the energy screen counts the chosen building's meters; a meter serving more than one building counts in each, its place in "איפה
  צורכים הכי הרבה" carrying "· גם ב...". The scene schedules screen shows the schedules whose scene serves the chosen building, the
  others' names in "· גם ב...". A meter / schedule with no placed area shows everywhere, without a note.
- User management › ממשק ביתי: "הבניין שנפתח" per person (the shared `sw-dropdown`; "האחרון שנבחר במכשיר" = not set) and, on the
  installation tab, a "ריבוי בניינים" card with the two choices of Q64. Both only on a multi-building site.
- הגדרות › לוח הודעות › לוח › כללי: "בניין" (`sw-dropdown`, "כל האתר" = none) with its hint, only on a multi-building site.
- One new icon (`building`, the home set's grid and stroke). No px literal, colour, native select or switch added (design ratchet flat).
- English for every new text (`i18n/lang/en/i18n/msg/home.ts`, `i18n/lang/en/i18n/notices.ts`).

Before / after captures: `private/planning/mb_home_2500_compare_2026-11-23.html` (tablet 1280x800, phone 390x844, the lobby screen
1920x1080 and the board editor; 31 images; same invented data both runs).

## Tests

Run on the workstation 23.11. The runner was NOT used (the 2.48.0 release gate is running there).

- Backend `tests/test_mb_home_2500.py` (11): switch off -> no new key, the new code replaced by raising functions never runs, no picker;
  switch on but one building reached -> the answer of before, and the person's building B grants nothing in B (preview refused); the
  overview's buildings (shared last), each room's building, the room buildings equal `building_scope.cut` of each building, the
  house-off preview of B reaches B's light only; `area_buildings` names only the areas the caller sees and a room in no building is null;
  meter areas need energy.view; Q64 setting (422 unknown value, audited before / after, the overview follows); Q65 set by an
  administrator only (403 for a regular person), 422 unknown building, audited, kept when another field changes, cleared by "", a deleted
  building is never the entry, the policies list and picker; a wall panel opens on its room's building whatever the person's building;
  Q68 the board's building (422 unknown, audited, the greeting = the building's name, a rename shows at once, switch off = the greeting of
  before, "" = the whole site) and a board without a building never runs the new code; an unknown `building_all` value reads as hide.
  **11 passed.**
- Targeted backend regression, 25 files (the new file + home interface x6, building scope x2, multibuilding home 2330, mapping assist,
  notices x5, wire notices / route coverage / routers b, c, d, singletons, setting callers / value parity, migrations, schema probes):
  see "Results" below.
- Frontend: `npx tsc --noEmit` clean; `tests/unit-mb-home-2500.spec.ts` (4) + unit-i18n-home + unit-home-simple-logic +
  unit-home-site-2330: **28 passed**; the i18n / notices / lang-pack unit specs (19 files): **195 passed**;
  `scripts/unused-exports.mjs --enforce` OK; `scripts/lazy-tags-check.mjs` OK; `scripts/design_ratchet.py`: no count above the baseline.
- Evidence against a build of the branch (`tests/evidence-mb-home-2500.spec.ts`, desktop project, sizes set per test): **6 passed** -
  the building level on tablet and phone with 0 px overflow on every control screen, the chip / sheet / choice remembered, "כבה הכל"
  of tower B sends `scope=building&id=*&building=<B>` (preview and run), the entry building rule and "כל הבניינים" (no house-wide off,
  the floor columns grouped), the shared meter's note, the board editor and the lobby greeting. The same spec with `SW_MB_BEFORE=1`
  against a build of the base: 3 passed (the before shots), 3 skipped (after-only).
- Existing specs against the branch build (single building = before): see "Results" below.

### Results

| Run (workstation, 23.11) | Result |
|---|---|
| `tests/test_mb_home_2500.py` | **11 passed** |
| Targeted backend regression, 24 existing files (sequential, 21 min) | **495 passed, 1 failed** - `test_home_interface.py::test_new_default_is_full_for_everyone_and_the_setting_changes_it` compared the whole `GET /home/settings` answer, which now carries the new setting `building_all` (Q64); expectation updated |
| `test_home_interface.py` + `test_mb_home_2500.py` after the fix | FIXRUN_PLACEHOLDER |
| Mutation check, backend (each guard disabled in turn, its test must fail, the file restored after each): the two-building rule, the seen-areas-only map, the board greeting's switch rule, the person's building must be live, the board's building must be live, the wall panel's room building first | **6 of 6 caught** |
| Mutation check, frontend: "כבה הכל" of a building without `building` (rebuilt, the Q66 evidence test) | **caught** (the test fails), source restored |
| Unit specs (node): unit-mb-home-2500, unit-i18n-home, unit-home-simple-logic, unit-home-site-2330 | **28 passed** |
| Unit specs (node): 19 i18n / notices / lang-pack files | **195 passed** |
| `tsc --noEmit`, unused-exports, lazy-tags-check, design ratchet | clean / OK / OK / no count above the baseline |
| Evidence `evidence-mb-home-2500` vs the branch build | **6 passed** |
| Same spec, `SW_MB_BEFORE=1`, vs a build of the base | 3 passed (shots), 3 skipped |
| Existing specs vs the branch build: home-simple-2420, home-simple-2421, home-v3-p2, evidence-notices, evidence-multibuilding-home-2330 (all projects, 3 workers) | **148 passed, 92 skipped** (the per-project skips of those specs), 0 failed. The evidence PNGs those specs rewrite under `docs/evidence/` were restored, not committed |
| Runner (pixel baselines, the full gate) | **NOT_RUN** - the runner is busy with the 2.48.0 release gate; the home interface's pixel baselines should be unchanged for one building (the switch-off answer is identical) but were not re-measured |

## Open questions for the owner (not blockers; recommendation first)

1. **The building name on the button in the phone.** On the phone the now bar's and the lights widget's off buttons are icons only
   (as today); the building's name is in their accessible label and in the building chip at the top. (a) keep (recommended: the phone
   bar has no room for "כבה הכל במגדל א" next to the active rooms); (b) show the words on the phone too.
2. **Items of the shared building.** Built: a meter or a scene that touches the shared building ("בניין משותף": the car park, the lobby)
   serves every building, so it shows in each with "גם ב...". (a) keep (recommended); (b) show it only under the shared building.
3. **Rooms in no building** (the mapping places them nowhere) show with every building and are never switched off by a building's
   "כבה הכל" (the server's cut leaves them out too). (a) keep (recommended; the mapping check of MULTI-BUILDING-SAFETY-2500 warns about
   them); (b) hide them.
4. **Floor names.** The home interface keeps the home system's floor names (the design's option of using our floor names was not built).
   Under "כל הבניינים" each floor column says "<בניין> · <קומה>". (a) keep (recommended); (b) use our floor names.

## Known limits

- The person's building is offered only to rbac.assign (the existing user management page); the person cannot choose a default for
  themselves (owner Q65 a). A building chosen on a device is remembered on that device only.
- Notices, the calendar and presence in the home interface are not filtered by building in this row (the design's MB-HOME-IFACE step 7
  was not part of Q64-Q68).
- The note of Q67 is drawn on the energy screen's "where" list and the scene schedules list; the hub tiles' counts are unchanged.
- The overview's building level is worked out on every request (no cache), as the building cut is.

## Rollback

Revert the branch commits. Migration 0218 is additive (two nullable columns); an older version ignores them. The `home.building_all`
settings row is ignored by an older version.
