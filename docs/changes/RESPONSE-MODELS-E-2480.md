# RESPONSE-MODELS-E-2480 - the response-model ratchet, ExactModel, and response models for the next routers

Branch `pilot/RESPONSE-MODELS-E-2480`, base `origin/release/2470-train` (`2c211966d`). Target 2.48.0. Code review 07:F8 step 2
(MASTER_PLAN 3.6), the row after CR-RESPONSE-MODELS-C-2470 / -D-2470. No route, status code, key, value or number type changed; no
migration; no version bump; no frontend behaviour change (generated type files only); no pixel change expected.

## What changed

### 1. The ratchet: "every JSON route has a model" (`scripts/wire_ratchet.py`, `tests/test_wire_ratchet_2480.py`)

- Walks the application's own route table (`create_app` with the settings of `scripts/api_inventory.py`, so Step-mounted, root and
  developer-only routes count), and counts per router module (the module that defines the handler) the routes that declare no wire
  model. Modelled = `**wire(Model)` with `exclude_unset`, or a model documented with `responses=` (what `gen_wire_types.py` reads).
  Not counted: routes in the wire module's `NO_JSON` (no JSON body: file, picture, stream, 204, download).
- Baseline `scripts/wire_ratchet_baseline.json` (sorted per router, so parallel rows merge line by line). The check fails when a count is
  ABOVE its baseline (a new route without a model, a removed model, a new router) and also when it is BELOW (lower it with `--update`
  in the same change), so the count can only go down. `--list [ROUTER]` prints what is left.
- The test also checks that the baseline is sorted and consistent, that `NO_JSON` entries name real routes, and that a fake new
  unmodelled route (new router, or a router already at zero) fails the check.
- Base count: 1215 unmodelled JSON routes in 146 router modules (of 1902 HTTP routes).

### 2. `wire.ExactModel` (strict mode)

The models of this row derive from `ExactModel` (pydantic strict mode, otherwise WireModel): a value of another type than declared is
drift (strict tests: refused; installation: the object goes out exactly as the route built it, logged once), never a silent
conversion (`2.0` -> `2`, `1` -> `true`, `"5"` -> `5`). Numbers are declared `Num` (int | float): TypeScript sees `number` either way and
an int / float difference can never drift. This is what makes models drafted from recorded answers safe for the wire.

### 3. Method

1. A shape recorder (scratch pytest plugin, not committed) wrapped FastAPI's `serialize_response` and merged, per route, the JSON shape of
   every answer the tests received (keys present always / sometimes, value kinds, nesting), and the drift the wire models logged.
2. A drafter turned the shapes into `ExactModel` classes per route (keys always present = required; sometimes = default `None`, absent
   under `exclude_unset`; id-like / HA-domain keyed objects, stored documents and deep nesting = `dict[str, Any]`), read against the
   router code; the routes were decorated with `**wire(W.Model)`.
3. The routers' suites ran again with the models in a "loose" pass (`SW_WIRE_STRICT=0`, the oracle on, drift captured), the models were
   redrafted from all the answers seen, and the final pass ran strict (`SW_WIRE_STRICT=1`, the default of the suite).
4. A JSON route no test answers successfully (or that answers something other than one object) is NOT modelled from the code alone: it
   is listed in the wire module's `UNMODELLED` and stays counted by the ratchet. `tests/test_wire_routers_d_2470.py` and the new
   `tests/test_wire_routers_e_2480.py` accept that list (and fail on a stale entry).

### 4. Routers modelled

51 router modules, 299 routes modelled, 15 routes listed as `NO_JSON`, 98 JSON routes listed as `UNMODELLED` (no test reaches a
successful answer). Ratchet: 1215 -> 901 unmodelled JSON routes (146 -> 119 router modules). `settings` is hand-written; `ha` and
`access_control_reads` carry hand corrections on top of the draft (`paired_at` may be null; `groups.fields` is null without
`access.people.sensitive`). Routers of the D block list (`FAMILIES_D`) keep their D entry; the others are in `FAMILIES_E`.

| Router | Modelled routes | `NO_JSON` | `UNMODELLED` |
|---|---|---|---|
| `settings` | 2 | 0 | 0 |
| `app_refresh` | 12 | 3 | 1 |
| `announcements` | 11 | 0 | 0 |
| `ha` | 11 | 0 | 0 |
| `backup` | 8 | 2 | 0 |
| `storage` | 3 | 0 | 0 |
| `brand` | 5 | 1 | 1 |
| `health` | 4 | 1 | 0 |
| `access_control_reads` | 23 | 3 | 0 |
| `access_grants` | 27 | 1 | 5 |
| `bulk_people` | 12 | 2 | 1 |
| `cast` | 10 | 0 | 3 |
| `calendar_attendees` | 10 | 0 | 0 |
| `building_presence` | 8 | 0 | 0 |
| `transit` | 7 | 0 | 0 |
| `camera_sources` | 5 | 0 | 0 |
| `camera_image_health` | 5 | 0 | 0 |
| `access_control_people` | 6 | 0 | 0 |
| `access_control_writes` | 7 | 0 | 0 |
| `automation_blueprints` | 4 | 0 | 1 |
| `bridge_key` | 8 | 0 | 0 |
| `automations` | 16 | 0 | 13 |
| `quiet` | 5 | 0 | 0 |
| `device_layouts` | 4 | 0 | 0 |
| `intercom_media` | 4 | 1 | 0 |
| `intercom_listen` | 2 | 0 | 1 |
| `capture_lease` | 2 | 0 | 0 |
| `app_secrets` | 3 | 0 | 1 |
| `wiskey_pairing` | 2 | 0 | 1 |
| `wiskey_installer_platform` | 1 | 0 | 14 |
| `wiskey_installer_lifecycle` | 0 | 0 | 10 |
| `wiskey_installer_clock` | 1 | 0 | 4 |
| `wiskey_installer_technical` | 0 | 0 | 2 |
| `wiskey_validation` | 5 | 1 | 1 |
| `wiskey_managed` | 6 | 0 | 1 |
| `wiskey_lineage` | 1 | 0 | 3 |
| `wiskey_relay_map` | 4 | 0 | 0 |
| `wiskey_switches` | 2 | 0 | 0 |
| `intercom_calls` | 4 | 0 | 0 |
| `access_control_diag` | 12 | 0 | 0 |
| `access_control_ops` | 1 | 0 | 9 |
| `access_control_profiles` | 9 | 0 | 0 |
| `access_control_station_people` | 8 | 0 | 0 |
| `access_control_station_ops` | 1 | 0 | 1 |
| `access_control_triage` | 1 | 0 | 4 |
| `access_control_wa_queue` | 1 | 0 | 5 |
| `access_control_capture` | 5 | 0 | 0 |
| `access_control_door_tech` | 1 | 0 | 5 |
| `access_control_messaging` | 2 | 0 | 5 |
| `access_wiskey_visits` | 7 | 0 | 0 |
| `access_station_permissions` | 1 | 0 | 6 |

Batches: 1 = app_refresh, announcements, ha, backup, storage, settings, brand, health; 2 = the routers the runner pass reached
(access_control_reads / people / writes, access_grants, bulk_people, cast, calendar_attendees, building_presence, transit,
camera_sources, camera_image_health, automation_blueprints, bridge_key, automations, quiet, device_layouts, intercom_media,
intercom_listen, capture_lease, app_secrets, wiskey_pairing); 3 = WisKey / intercom (wiskey_installer_*, wiskey_validation /
managed / lineage / relay_map / switches, intercom_calls, access_control_diag / ops / profiles / station_people / station_ops /
triage / wa_queue / capture / door_tech / messaging, access_wiskey_visits, access_station_permissions). Not reached in this row: the
rest of the routers D left and the big ones (tickets_*, multimedia, maintenance, schedules, presence, nvr_write, plan_*, ...) -
`python scripts/wire_ratchet.py --list` prints them.

### 5. Other fixes found on the way

- `WireModel` fallback dropped aliased keys (pre-existing; it concerns every row's models with `Field(alias=...)`): outside strict mode
  a value of another type sends the route's own object, but `_fields_set` held the ALIAS, so `exclude_unset` dropped the key. The
  oracle caught `GET /api/v1/access-control/groups` losing `fields`. The set keys are field names now
  (`test_the_fallback_keeps_aliased_keys`).
- `scripts/gen_wire_types.py`: enum unions are sorted. `typing` caches `Literal[...]` by its unordered value set, so
  `Literal["auto", "manual"]` came back as another module's `Literal["manual", "auto"]` depending on import order, and `--check`
  failed inside a pytest run that collected other files first (`wire-generator.ts`). 39 generated files changed in union ORDER only.
- `tests/support/wire_oracle.py`: `UNANNOTATED_E` block (empty: every route modelled here had a `-> dict[str, Any]` annotation); the
  unannotated lookup also matches the Arx mount (`/arx/api/v1/...`).

### Frontend

Generated files only (`frontend/src/api/generated/wire-*.ts`: 39 regenerated, the new ones added); no hand-written client type was
switched (left to FE-API-GENERATED-2480). No UI change, no pixel change expected, no baseline refreshed, no comparison page.

## Tests actually run

Workstation only (main checkout `.venv`, Python 3.12, `pytest -p no:xdist`), with the scratch shape recorder plugin loaded.

| What | Result |
|---|---|
| Runner: backend suite with the recorder only (no models yet), 8 niced shards, at `e9ceb25f2` | stopped by me after ~85 min (runner overloaded in the 2.47.0 gate window); recordings kept (272 unmodelled routes reached). Not a test verdict |
| g1, loose (`SW_WIRE_STRICT=0`, oracle on, drift captured): 25 files (announce*, app_refresh*, backup*, brand*, health_*, storage*, ha, bridge_install, settings_patch_audit_order) + D/E block tests | rc 0 (all passed); 10 drift messages, used for the redraft |
| g2, loose: 61 files picked by path (3 per batch-2 router, 2 per batch-3 router) + D/E/ratchet tests | 4 failed: 2 x `--check` (enum order quirk, fixed), 2 x `test_intercom_adapter` (alias fallback bug, fixed); 51 drift messages, used for the redraft |
| g3, strict, the 82 files of g1 + g2 + D/E/ratchet/route-coverage | killed from outside at 52 % (rc 127, no summary): not counted |
| g4, strict, the same set (2999 tests) at `9515ec254` + the train merge | 2992 passed, 3 xfailed, 4 failed: the 2 `--check` tests (fixed by the enum sort) and 2 `test_intercom_adapter` tests (`groups.fields` null; model fixed) |
| g5, strict, after both fixes: test_wire_routers_e_2480, _d_2470, _c_2470, _b_2450, test_wire_ratchet_2480, test_wire_route_coverage_2460, test_intercom_adapter, test_access_control_wire | 434 passed, 0 failed |
| `scripts/gen_wire_types.py --check` | rc 0 |
| `scripts/wire_ratchet.py` | every count equals its baseline (901) |
| `scripts/api_inventory.py` | 1910 routes, `contracts/API_INVENTORY.md` unchanged |
| ruff `--select F,E402` on `smplwise/wire`, `smplwise/routers`, both scripts, the changed tests, the oracle | all checks passed |
| frontend `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | rc 0 / rc 0 |

NOT_RUN: the full backend suite (only the 82 files above + the block tests), the runner entry check, ESLint (the generated files
carry `eslint-disable`), frontend unit / browser / pixel specs (no UI change), `unused-exports.mjs` / `api-client-check.mjs`, a strict
re-run of all 82 files after the last two fixes (only g5's 8 files).

## Risks

1. Models drafted from recorded answers are only as complete as the tests: a key or value kind no test produced is drift on an
   installation. The answer still goes out as built (strict models never convert; the alias bug is fixed), but the drift is logged at
   ERROR once per (model, field) - expect some such lines on the lab. Routes no test reached stay `UNMODELLED`.
2. Some models are wide (`dict[str, Any]` for stored documents, HA-keyed and deep objects; `Num` for every number): exact for the wire,
   weaker for the client types.
3. The ratchet is strict both ways: a 2.48.0 row that adds a route without a model (or merges with an older baseline) fails
   `test_wire_ratchet_2480` until it models the route or runs `--update` (`--allow-raise` with a reason). Merge this row early.
4. My recorder pass on the runner (8 niced shards, started 08:28 UTC while the gate state read `pass`) ran into the 2.47.0 gate window
   and added to the overload that stopped SSH; I stopped it as soon as SSH answered. Leftovers to delete once the runner is free:
   `~/work/respe` (detached worktree: `git -C ~/smplwisebms worktree remove --force ~/work/respe`), `~/work/respe-out`,
   `~/work/respe-tools`, `~/work/respe-shapes.tgz`, `~/work/respe-run_rec.sh` / `.log`, `/tmp/respe-shard_*`.

## Open questions (recommendation first)

1. The remaining 901 routes: continue with the same method in follow-up rows, a few router families per row. Recommendation: commit
   the recorder / drafter as `scripts/wire_draft/` in the next row so the method is reproducible (kept out of this row's scope).
2. Ratchet strictness on a decrease (fails until `--update`): recommendation keep (it locks progress in); alternative: fail only on an
   increase, like `design_ratchet.py`.
3. Drift log level on installations (ERROR): recommendation keep for 2.48.0 so the lab shows the gaps; WARNING later.
