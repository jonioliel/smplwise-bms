# CR-RESPONSE-MODELS-B-2450 - response models and generated client types for the sixteen batch-A routers

Branch `pilot/CR-RESPONSE-MODELS-B-2450`. Base `origin/pilot/CR-ROUTER-SQL-2450` (`0a5d0431e`), with
`origin/pilot/CR-RESPONSE-MODELS-CONSUMPTION-2450` (`4e528f019`) merged first for the wire package (`smplwise/wire/`,
`tests/support/wire_oracle.py`, `SW_WIRE_STRICT`, `scripts/gen_wire_types.py`). Target 2.45.0. Code review finding 07:F8 step 2
(`MASTER_PLAN.md` 3.6 "Response models and generated client types"), the routers whose SQL CR-ROUTER-SQL-2450 moved into store modules.
No route, status code, key, value or number type changed; no migration; no version bump.

Out of scope and untouched: `routers/ha.py`, the batch-B routers of `pilot/CR-ROUTER-SQL-B-2450` (`calendar_feeds`, `door_windows`,
`frigate`, ...), the consumption routers, wiskey / intercom.

## What changed

### Backend: one wire module per router, one commit per router

| Router | JSON routes modelled | Routes without a JSON body (`NO_JSON`) | Wire module |
|---|---|---|---|
| `events` | 11 | 2 (ungroup 204, thumbnail JPEG / 202) | `wire/events.py` |
| `catalog` | 14 | 4 (three 204 deletes, the catalogue picture) | `wire/catalog.py` |
| `home_mapping` | 7 | 0 | `wire/home_mapping.py` |
| `ha_users` | 6 | 0 | `wire/ha_users.py` |
| `cases` | 15 | 4 (two 204 deletes, item file, bundle download) | `wire/cases.py` |
| `local_identity` | 19 (the two sign-in routes answer their own JSONResponse: declared with `responses=`, checked by a test) | 1 (CSV export) | `wire/local_identity.py` |
| `temperature` | 32 | 6 (report PDF, events CSV, four 204 deletes) | `wire/temperature.py` |
| `calendar_sync` | 14 | 2 (204 deletes) | `wire/calendar_sync.py` |
| `wall` | 20 | 3 (two pictures, a 204 delete) | `wire/wall.py` |
| `plans` | 14 | 5 (four PNGs, a 204 delete) | `wire/plans.py` |
| `alarm` | 15 | 0 | `wire/alarm.py` |
| `anchors` | 7 (incl. the floor map bundle and the time-scrub snapshot / range) | 1 (204 delete) | `wire/anchors.py` |
| `access_groups` | 9 | 0 | `wire/access_groups.py` |
| `elevators` | 9 | 1 (204 delete) | `wire/elevators.py` |
| `zones` | 10 (incl. the shared-space plan) | 3 (204 deletes) | `wire/zones.py` |
| `cameras` | 6 | 1 (snapshot JPEG) | `wire/cameras.py` |
| **Total** | **208** | **33** | 362 models |

Rules (the consumption family's, kept): keys a route sometimes leaves out have a default and stay ABSENT (`exclude_unset`); `int` only
for values that are always int, `float` for REAL columns and computed floats, `Num` (new in `smplwise/wire/__init__.py`: `int | float`,
pydantic's smart union keeps `1` as `1` and `1.0` as `1.0`) where the value's own type varies (HA states, temperatures, positions of
mirrored anchors); `bool` only where the route sends a real bool; `Literal` only where the code fixes the set. Stored documents and
computed documents other modules own pass through as `Any` / `dict[str, Any]` (event `details`, case `provenance`, the wall `config`,
the calendar sync `report`, the alarm `sync`, the plan `crop` / `calibration`, the DXF records, the floor map's geometry reference,
levels, circuits, entity rows, floor pictures, bakes, the time-scrub layers, the camera `stream` / `encoding`, the media settings).
Models are shared where routers share builders: `wire/anchors.py` reuses `CameraRow` (cameras), `CatalogFloor` / `CatalogBuilding` /
`CatalogSite` (catalog), `PlanVersion` (plans) and `ZoneOnMap` (zones); `wire/home_mapping.py` the catalogue link models; `wire/cases.py`
`EventRouteVia` (events).

### Generator and route-table test

- `scripts/gen_wire_types.py`: sixteen new families, one generated file per router
  (`frontend/src/api/generated/wire-<router>.ts`); a family without a modelled route writes no file (`--check` reports a stale one).
- `tests/test_wire_routers_b_2450.py`: per router, every JSON route declares a wire model with `exclude_unset` and every route in
  `NO_JSON` exists and is not modelled; every model is a `WireModel`; the generated files are current and name every modelled route; the
  family table matches the generator; no `.execute(` came back into the router (CR-ROUTER-SQL-2450's boundary).
- `tests/test_wire_local_identity_2450.py`, `tests/test_wire_temperature_2450.py`: the sign-in JSONResponse bodies fit their models
  strictly; routes no other test reached go through the oracle (`PUT /infra/temperature/order`, `GET /identity/local-users/{id}`, the
  home-system link PUT / DELETE).

### The characterisation

Before any model, the router suites were run with a scratch recorder (a pytest plugin wrapping `fastapi.routing.serialize_response`,
not committed) that kept, per route, every key's JSON types, presence count and sample values of the legacy serialisation
(`TypeAdapter(dict[str, Any])`). The models were written from the router code and checked against those shapes; then every suite ran
again under `SW_WIRE_STRICT=1` with the wire oracle, which compares each modelled answer with the route's own pre-model serialisation
in the same request (keys, values, `1` vs `1.0`, `true` vs `1`, absent vs `null`).

### Frontend

Each router's API module now reads the generated types (alias, or `Pick` / `Omit` with the narrowing documented next to it, as in the
consumption modules): `api/types.ts` (`Camera`, `Site` / `Building` / `Floor`, `PlanAsset`, `PlanVersion`, `Anchor`, `SpatialZone`,
`FloorMap`), `api/maps.ts`, `api/media.ts`, `api/events.ts`, `api/cases.ts`, `api/catalog.ts`, `api/mapping.ts`, `api/ha-users.ts`,
`api/access.ts`, `arx/local-auth.ts`, `screens/system-local-users.ts`, `api/temperature.ts`, `api/calendars.ts`, `api/wall.ts`,
`api/plans.ts`, `api/alarm.ts`, `api/elevators.ts`, `api/zones.ts`, `api/history-scrub.ts`, `api/geometry.ts`. Fields the demo data /
older servers lack stay optional on the client; stored documents keep their hand-written shapes.

Drift the generated types found:

1. **Alarm (a real crash, fixed):** a zone redacted for the caller answers `aux: null` and null `available` / `open` / `fault` /
   `bypassed`; `screens/security-alarm.ts` spread `...z.aux` (TypeError for that caller). Now `...(z.aux ?? [])`, the bypass switch
   gets `!!z.bypassed`.
2. **Cameras (fixed):** `POST /cameras/sync` answers `recorder: null` when a sync of several recorders had no successful one;
   `screens/system-devices.ts` read `r.recorder.model`. Now `r.recorder?.model`.
3. Alarm configuration panels carry `panel_code` but not `can` / `panel_code_set` / `code`; the client typed them as full panels (new
   `ConfigPanel`, no screen read the three). `device_id` is sent and was undeclared.
4. Wall: `POST /wall/photo-sets` answers without `used_by` (listing only); the client typed it with it (the screen reads only `id`).
5. Temperature: `Maintenance.reason` can be null (typed `string`); report link `sent` / `recipient` always sent (typed optional);
   the defrost `days` value is sometimes a float.
6. Local identity: `whatsapp`, `passkeys`, `self_service_blocked`, `created_by`, `binding_id` always sent (optional / missing in the
   hand type); the create answer's `password_set` was missing.
7. Access groups: the impact's users carry their per-scope breakdown (`scopes`), untyped before.
8. Cases: an imported item's `event.thumbnail` is null (typed `string | undefined`); the verify report's `signature`, `origin`,
   `counts`, `summary`, `bundle`, `importable` are always sent.
9. Calendar: `connections()` also answers `providers`, `setup_steps`, `google_redirect`; the demo store's `syncNow` answers `{ok: true}`
   where the server answers `{report, connection}` (noted, typed `unknown`, no screen reads it).
10. Plans / anchors / zones: the shared-space plan answers `home_version_id` and `removed_ids` and the time-scrub range `native_rows`
    (undeclared on the client, now typed); the DXF catalog choice id is never null (typed `string | null`).

## Tests

All on the workstation (Python 3.12 venv, `pytest -p no:xdist`, conftest sets `SW_WIRE_STRICT=1` and installs the oracle), with the
PC at 100 % CPU from other agents throughout (times not meaningful). The work ran in four lanes (three parallel worktrees merged into
this branch); each lane ran its routers' suites.

| What | Command / files | Result |
|---|---|---|
| Baseline before any model, with the shape recorder | run 1 (events / catalog / home_mapping files), run 2 (ha_users / local_identity / cases), run 3 (temperature / calendar_sync / wall / plans / alarm / anchors), run 4 (access_groups / elevators / zones / cameras) of CR-ROUTER-SQL-2450's lists | 106 / 213 + 1 failed / 336 / 451 passed. The failure: `test_bundle_import.py::test_round_trip_verify_and_import_into_another_installation` (a snapshot reads `missing`), pre-existing - it fails without any model too |
| events | 11 event test files + `test_wire_routers_b_2450.py -k events` | 87 passed, 1 failed (the generated-types check while another router's file was being regenerated); the wire file re-run: 18 passed |
| cases | `test_cases`, `test_bundle`, `test_bundle_import`, `test_route` + wire `-k cases` | 32 passed, 1 failed (the pre-existing bundle round trip above) |
| catalog + home_mapping | run 1a's 10 files + wire test | 93 passed |
| ha_users | `test_ha_users`, `test_templink_2320` + wire `-k ha_users` | 87 passed |
| access_groups | `test_rbac_groups` + wire `-k access_groups` | 18 passed |
| local_identity | 12 files (`test_local_identity`, `test_local_reset`, `test_local_passkeys`, `test_rbac_camera_scope`, ...) + `test_wire_local_identity_2450.py` + wire `-k local_identity` | 441 passed, 1 failed (an assertion of the new test itself, `suggest_also.active`; fixed, then passed in the next run) |
| temperature | 13 temperature / report / link / explain files + `test_wire_temperature_2450.py` + the re-run local identity wire test + wire `-k temperature` | 234 passed |
| elevators | 4 elevator files + wire test | 134 passed, 1 failed (generated-types check during a regeneration; passed in the final route-table run) |
| calendar_sync | `test_calendar_connect_2330`, `test_calendar_sync_2300`, `test_calendar_engine_2300` | 110 passed |
| alarm | `test_alarm`, `test_alarm_managed_cache`, `test_raw_body_order`, `test_shared_spaces` | 93 passed |
| wall | `test_wall`, `test_wall_alerts`, `test_wall_curves`, `test_wall_phone_bar`, `test_wall_curve_points`, `test_announce_screens_b295` | 79 passed |
| cameras | `test_cameras`, `test_camera_sources_2410`, `test_nvrless_cameras_2411`, `test_multi_nvr` | 101 passed |
| plans / anchors / zones (first model version) | `test_plan_versions`, `test_plans`, `test_plan_anchor_scope_plns`, `test_anchor_3d`, `test_anchor_coverage`, `test_zones`, `test_zonecount107_295`, `test_timescrub_295`, `test_dxf`, `test_plan_dxf_map`, `test_stylize`, `test_p2_batch`, `test_plan_wizard_api_2434` | 84 passed |
| Final models, merged branch | `test_shared_spaces`, `test_permcam63_shared_spaces`, `test_zones`, `test_zones_nvr`, `test_nvr_write`, `test_capabilities`, `test_plan_versions`, `test_dxf`, `test_plan_dxf_map`, `test_stylize`, `test_timescrub_295`, **`test_wire_routers_b_2450.py` (all 16 routers, no `-k`)**, `test_wire_consumption_2450.py` | 195 passed |
| Characterisation of rarely reached routes | `test_wire_plans_anchors_2450.py` (new), `test_stream_codecs` (a successful camera sync), `test_cameras`, `test_plans`, `test_anchor_coverage` | 23 passed; the oracle compared `GET /floors/{id}/plan-assets`, `GET /plan-versions/{id}`, `GET /floors/{id}/anchors`, `POST .../anchors/realign`, `PATCH /cameras/{id}` and `POST /cameras/sync` (8 answers) |
| ruff (F rules) | `smplwise/wire/`, the 16 routers, the new tests, `scripts/gen_wire_types.py` | All checks passed |
| `scripts/gen_wire_types.py --check` | | rc 0 (also asserted by the route-table test) |
| Frontend type check | `npx tsc --noEmit -p tsconfig.tests.json` (src + tests), merged tree | 0 errors |
| ESLint | the 23 changed frontend files (generated files excluded) | clean |
| `scripts/unused-exports.mjs --enforce`, `scripts/api-client-check.mjs` | | OK (no export outside the baseline) / runs |
| Frontend unit specs | lanes: 6 + 7 + 4 spec files (events / cases / catalog / mapping, access / ha-users / local-user / arx-local-login / temperature, calendars / elevators); mine: `unit-door-tool`, `-history-replay`, `-plan-detect`, `-plan-ifc`, `-studio-controller`, `-wall-plan-scene`, `-video-policy-webrtc-first`, `-video-sub-fallback-2402`, `-go2rtc-stream-sync-2436` | 50 passed + 1 skipped / 223 passed / 55 passed / 62 passed |
| Browser specs (Vite dev server on the PC, desktop project, `--workers=1`) | `evidence-alarm`, `evidence-calendars-connect-2330`, `evidence-camera-card`, `evidence-cases`, `evidence-elevators`, `evidence-local-user-create-2438`, `evidence-shared-space`, `evidence-temperature`, `evidence-wall`, `evidence-zones`, `evidence-zones-nvr`, `layout-timescrub-noscroll` | 71 passed, 12 skipped, 1 failed: `evidence-camera-card` "the camera card in an area screen (real backend, fake media stack)" needs a live backend on 127.0.0.1:8100 (ECONNREFUSED) - environment, NOT_RUN in effect. The evidence PNGs the specs rewrote were restored (not part of the branch) |
| After merging `origin/release/2440-train` (`51da93753`) | the five `test_wire_*` files, `test_routers_table_2440`, `test_singletons_registered`; `gen_wire_types.py --check`; `tsc -p tsconfig.tests.json` | 95 passed; rc 0; 0 errors |
| NOT_RUN | the full backend suite (about 1,000 files; the gate covers it), `test_get_routes_read_conn.py` with the models (started in the recorder batch, stopped as the models moved under it), tablet / mobile browser projects, pixel specs, anything on the runner | |

## Not done / open

- Browser Playwright specs: NOT_RUN on this branch (see the table). No pixel change is expected (types only, plus the two null-guards
  above, whose screens render the same for every caller who did not crash); no baseline refreshed.
- Routes whose model comes from reading the code only (no test reached them in the runs above): `POST /cases/{id}/items/{item_id}/preserve`,
  `POST /evidence/signing/rotate`, `GET /floors/{floor_id}`, `DELETE /buildings/{id}/image`, the calendar consent routes
  (`authorize`, `authorize/complete`, `authorize/poll`, `connections/{cid}/calendars`), `POST /wall/photo-sets/{id}/upload`,
  `POST /wall/announcement`, `POST /alarm/controls/{entity_id}/not-alarm`. In production a drift there is logged once and answered
  unchanged; under the tests it fails. (Every plans / anchors / zones / cameras JSON route was compared by the oracle at least once.)
- The merge commits of the three parallel lanes (`Merge branch 'pilot/CR-RESPONSE-MODELS-B-2450-a|b|c'`) are git's default messages.
