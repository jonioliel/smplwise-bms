# CR-ROUTE-CHAR-2460 - real API tests for the modelled routes no test reached

Branch `pilot/CR-ROUTE-CHAR-2460`, base `origin/pilot/CR-RESPONSE-MODELS-B-2450` (`06ac1f108`). Target 2.46.0.
Follow-up of CR-RESPONSE-MODELS-B-2450 ("Not done / open": routes whose response model was written from the code only) and
CR-RESPONSE-MODELS-CONSUMPTION-2450 (113 JSON routes, 90 answered in its baseline). Tests and a script only: no route, model, status
code, answer, migration or frontend file changed; `scripts/gen_wire_types.py --check` stays clean.

## Result

Every one of the 321 modelled routes (16 batch-A routers + the 4 consumption routers) is now either compared by the wire oracle in
at least one test (314) or answers its own `JSONResponse` and has its body checked strictly by its own test (7, below). **No model was
wrong and no route bug was found**: every new test passed under `SW_WIRE_STRICT=1` on the first run that reached the route (the two
fixes during the work were mistakes in the new tests themselves: a replacement time before the meter's counter life, an AST shape, and
a replacement sent in the same second the meter was created - the service refuses `at <= started_at` at one-second resolution, by
design; the test now sends `at` one second after the counter life began and passed 3 of 3 with `--sw-repeat 3`).

## Finding the routes no test reaches (`scripts/wire_route_coverage.py`)

- `tests/support/wire_oracle.py`: with `SW_WIRE_COVERAGE_DIR=<dir>` each test process writes `oracle-<pid>.json` (route -> answers
  compared), at exit and whenever a route is compared for the first time (a stopped run keeps what it saw). Off by default.
- `scripts/wire_route_coverage.py <dir>... [--static] [--json]`: the modelled routes (generator `FAMILIES`), minus what the runs
  compared. Answers under the Arx mount (`/arx/api/v1/...`) count for their `/api/v1` route. Routes that build a `JSONResponse` themselves
  (or are declared `-> Response`) are listed apart: FastAPI skips the model there, so the oracle can never see that answer.
  `--static` names the test files that mention each route's path (module path constants, also imported ones, are expanded), which
  separates "never called" from "called, never successfully" - and was used to pick the files to run (a set cover).
- `tests/test_wire_route_coverage_2460.py`: the script lists every modelled route once, adds runs up (incl. the Arx mount), tells
  own-response routes apart, expands imported constants; the oracle writes its file when asked.

How the list was produced: a full-suite run was started on the runner and stopped (23,662 tests, disk-bound at ~27 tests/min: about
14 h). Instead: round 1 = a set cover of 52 test files naming every modelled route (runner, 4 shards, 1,057 passed, 0 failed); then the
routes still missing were looked up in the other files naming them (PC, and a runner round 2 stopped early - see Risks); last, a test
of this row where none existed.

### The change note's list (CR-RESPONSE-MODELS-B-2450), checked

| Route | Before this row | This row |
|---|---|---|
| `POST /cases/{id}/items/{item_id}/preserve` | only the refusals (`already_preserving`, `not_a_clip`, 503, NVR-less 409); the 201 never reached | `test_route_char_2460`: 201 through the oracle (export job queued, NVR search faked), 403 viewer (no job), 409 second press, audit `case.item.preserve` |
| `POST /evidence/signing/rotate` | reached by `test_signing.py` (200, 403, audit) | own test as well: 403 changes nothing, the answer has no `installation_id` (GET only), audit details |
| `GET /floors/{floor_id}` | not reached in the B lanes | 200 admin / scoped viewer, the audited 403 on another floor, 404 |
| `DELETE /buildings/{id}/image` | reached by `test_backend_safety_2435.py` (200 only) | 403 keeps the picture, 200 through the oracle, idempotent second delete, 404, audit `building.update` `{image: false}` |
| calendar consent `authorize`, `authorize/complete`, `authorize/poll`, `connections/{cid}/calendars` | reached by `test_calendar_connect_2330.py` / `test_calendar_sync_2300.py` (happy paths, 403, state mismatch, single use) - compared by the oracle in the runs above | no new test needed |
| `POST /wall/photo-sets/{id}/upload` | reached by `test_wall_alerts.py` | own test: 403 operator, 201 through the oracle, 415 not an image, 404 unknown set, audit details |
| `GET /wall/announcement` (listed as POST in the note; the route is a GET poll) | reached by `test_announce_screens_b295.py` (200, 403) | no new test needed |
| `PUT /alarm/controls/{entity_id}/not-alarm` | reached by `test_alarm.py` (200 both ways, 409 paired, 403, audit count) | no new test needed |

### Consumption routes without a test path

The consumption baseline answered 90 of 113 JSON routes; with all the consumption files plus `test_wire_consumption_2450.py` every
JSON route is compared except the five that answer their own `JSONResponse` (below). New tests in `test_route_char_consumption_2460.py`
for the water routes whose only path was the route-table loop of `test_wire_consumption_2450.py` (200 only, no refusal, no audit):
`POST /infra/water/meters/{id}/replace` (403 operator, 422 future / before the counter life, 200 oracle, audit
`infra.water.meter.replace`, 409 stale revision), `GET /infra/water/customers/next-number` (oracle, the shared ledger moves on, 403),
`POST /infra/water/tariffs/{tid}/versions` (403, 404, 201 oracle with `drafts = {recomputed: 1, failed: []}`, audit, 422 price),
`GET /infra/water/accounts/{aid}/history` (admin and operator through the oracle, 403 viewer, 404), `GET /infra/water/bills/{bid}/events`
(oracle, 403 operator without `water.bills`, 404).

### Other modelled routes no test called successfully

- `PATCH /sites/{site_id}`: answered only inside the off-box restore test. New test: 403, 200 through the oracle, 422, 404, audit
  `site.update` details.
- The remaining routes the first rounds missed were reached by existing files once those ran (`test_event_windows`, `test_correlation`,
  `test_catalog_images`, `test_walink_295`, `test_infra_temperature_report`, `test_dxf`, `test_cameras`, `test_capabilities`, ...).

### Routes answering their own JSONResponse (the oracle can never compare them)

`GET /energy/bills/state`, `POST /energy/accounts/{aid}/bills`, `POST /energy/bills/{bid}/correct`, `POST /infra/water/accounts/{aid}/bills`,
`POST /infra/water/bills/{bid}/correct` (strict model fit in `test_wire_consumption_2450.py`), `POST /auth/local/sign-in`,
`POST /auth/local/sign-in/second-factor` (strict fit in `test_wire_local_identity_2450.py`). (`POST /energy/tariffs/{tid}/versions`
returns its own response for the price-correction plan only; its normal answer is compared by the oracle.)

## Tests

| What | Where / command | Result |
|---|---|---|
| New B-list tests | PC, `test_route_char_2460.py` (5 tests, then `-k patch_a_site`) | 5 passed; 1 passed |
| New consumption tests | PC, `test_route_char_consumption_2460.py` | first run 3 passed, 1 failed (test mistake: replacement time before the counter life); fixed, `-k replacement` 1 passed; later failed once in the final run (same-second replacement, see Result), fixed, `-k replacement --sw-repeat 3` 3 passed |
| Script / oracle tests | PC, `test_wire_route_coverage_2460.py` | 4 passed, then 5 passed after the Arx / own-response additions |
| Coverage round 1 | runner, 52 files (set cover), 4 shards, nice 19, own folder, basetemp inside, `SW_WIRE_COVERAGE_DIR` | 1,057 passed, 0 failed |
| Coverage on the PC | `test_alarm`, `test_calendar_connect_2330`, `test_cases`, `test_wall`, `test_announce_screens_b295`, `test_catalog`, `test_bundle` | passed (exit 0, `-x`) |
| | `test_energy_elecbill77`, `test_home_v3_followup_a`, `test_xsecfix_297`, `test_energy_bill_opening_reading`, `test_tariff_names_en_2440`, `test_home_v3_p3` | 101 passed, 2 skipped |
| | `test_shared_spaces`, `test_body_limit`, `test_mapping_assist_2330`, `test_wall`, `test_calendar_sync_2300`, `test_tempvendor_295`, `test_timescrub_295`, `test_building_reach_round14`, `test_stylize`, `test_bundle_import`, `test_local_user_create_2438` | 1 failed: `test_bundle_import.py::test_round_trip_verify_and_import_into_another_installation` (the pre-existing PC failure CR-RESPONSE-MODELS-B-2450 recorded; it PASSED on the runner in round 1); the rest passed (count not captured) |
| | `test_event_windows`, `test_correlation`, `test_catalog_images`, `test_walink_295`, `test_infra_temperature_report`, `test_dxf` | passed (exit 0, no failure line) |
| Final focused run, first | PC, same files as below | 109 passed, 1 failed (`test_water_meter_replacement`, the same-second case) |
| Final focused run | PC: the three new files, `test_wire_routers_b_2450`, `test_wire_consumption_2450`, `test_wire_local_identity_2450`, `test_wire_temperature_2450`, `test_wire_plans_anchors_2450`, `test_routers_table_2440`, `test_singletons_registered` | 110 passed, 0 failed (incl. `gen_wire_types.py --check` via the route-table test) |
| ruff (F) | new files, `scripts/wire_route_coverage.py`, `tests/support/wire_oracle.py` | All checks passed |
| NOT_RUN | the full backend suite (23,662 tests; the gate covers it), frontend (nothing changed) | |

## Risks / notes

- Runner etiquette: round 1 (started 18:52 UTC) overlapped the 2.45.0 train gate that started at 19:02 UTC for about 28 minutes, and
  round 2 was started at ~19:31 while that gate ran; I noticed at 19:40 and stopped my processes (SIGINT, then SIGTERM). All at nice 19
  in `~/work/routechar`; the source copy and basetemps were deleted afterwards (`~/work/routechar` keeps 232 KB of logs).
- The static scan is a hint only (tests that build paths in loops or local variables are invisible to it); the oracle files are the
  evidence.
- Seen while reading, not changed (out of scope): `PATCH /sites/{id}` stores `name` untrimmed (create trims) and accepts any
  `timezone` string up to 64 characters.
