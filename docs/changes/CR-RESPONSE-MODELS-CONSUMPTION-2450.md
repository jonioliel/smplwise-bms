# CR-RESPONSE-MODELS-CONSUMPTION-2450 - response models and generated client types for the consumption family

Branch `pilot/CR-RESPONSE-MODELS-CONSUMPTION-2450`, cut from `origin/release/2440-train` (`e9d17b5ab`). Target 2.45.0.
Finding 07:F8 step 2 (code review 2026-11-13, `MASTER_PLAN.md` 3.6 "Response models and generated client types"). Step 1 (the
client-to-inventory PATH check, `frontend/scripts/api-client-check.mjs`) shipped in CR-FE-GATES-2436; this row adds the SHAPE check for
one family, and the raw SQL of the same routers moves into store modules (review 05 SQL boundary). Another agent does the other routers.

Scope: `routers/energy_meters.py`, `routers/energy_billing.py`, `routers/water.py`, `routers/water_billing.py` (129 routes, 113 of them
JSON) and the frontend modules that call them: `api/electricity-meters.ts`, `api/electricity-readings.ts`, `api/electricity-billing.ts`
(+ its mock), `api/water.ts`, `api/water-billing.ts`.

## What changed

### Backend: explicit response models, answers unchanged

- New package `smplwise/wire/`: `WireModel` (base) and `wire(Model)` (the decorator arguments), and one module per router
  (`energy_meters.py`, `energy_billing.py`, `water.py`, `water_billing.py`) with 169 models. Every JSON route of the four routers now
  declares `**wire(Model)`; the 16 routes without a JSON body (PDF, CSV, logo image, 204 deletes) are listed in the test.
- The models describe the JSON the routes already sent, key for key and in the routes' own order:
  - `response_model_exclude_unset`: keys a route sometimes leaves out (money without `energy.bills` / `water.bills`, contact fields,
    detail-only lists, `warning` on create, `log` unless dry run) have a default and stay ABSENT - never `null`.
  - Number and boolean types follow the values (`int` never receives a float, `float` never an int, booleans are `bool`), so `1` never
    becomes `1.0`. Literals only where the database or the service fixes the set (CHECK constraints, request `Literal`s, constants).
  - Stored documents are passed through as stored: the bill `snapshot` (versioned by its own `schema`), the formula `ast`, bill event
    `details`, the alert `value`.
- Drift never breaks a running installation: `WireModel` keeps undeclared keys (they pass through) and, when a value does not fit its
  type, logs `response contract drift in <Model>: ...` ONCE per model and field and answers the route's own dict for that object (the
  pre-model serialisation). Under `SW_WIRE_STRICT=1` both cases raise; `tests/conftest.py` sets it, so every backend test that reaches
  a modelled route is also a contract test.
- Routes that return their own `JSONResponse` (bill create and correct, `GET /energy/bills/state`, the price-correction plan) are not
  validated by FastAPI; their model is declared for the contract (`responses=` for the plan and the applied correction) and a test
  validates their real bodies strictly.

### The characterisation (the wire oracle)

`tests/support/wire_oracle.py`, installed by `conftest.py` for every test process: each answer serialised through a model is compared,
in the same request, with what the same returned dict gave before (`TypeAdapter(dict[str, Any])`, the routes' old return annotation;
`jsonable_encoder` for the one route that had none). Strict on keys, values and types (`1` vs `1.0`, `true` vs `1`, absent vs `null`);
key ORDER is reported (`ORDER_DIFFS`), not failed - JSON objects are unordered, and one object already came out in two orders before
(the billing settings' `logo` read back from its sorted stored JSON next to the same object built in code). Before the change the same
suites were run with a recorder: 90 routes answered, and every first answer validates and round-trips identically against its model.

### Generated client types

- `scripts/gen_wire_types.py` imports the four routers (no app start, no database), collects the response models (and the `responses=`
  models), and writes `frontend/src/api/generated/wire-consumption.ts`: one `export interface` per model (a key with a default is `?:`;
  a field that is never null when present has no `| null`) and `ConsumptionRoutes`, the map `'METHOD /api/v1/path'` -> answer type.
  `--check` exits 1 when the committed file is stale; `tests/test_wire_consumption_2450.py` runs it, so a model change without the
  regenerated file fails the backend gate. Run it with the backend's Python environment (it needs FastAPI / pydantic).
- `frontend/scripts/unused-exports.mjs`: `src/api/generated/` is skipped as a declaration source (the file declares every modelled
  answer, used or not - complete by design, not dead code); its names still count as uses elsewhere.

### Frontend: hand-written wire types replaced or derived

| Module | Before | Now |
|---|---|---|
| `api/electricity-meters.ts` | private `WireMeter`, `WireEpoch`, `WireCandidate`, `WireSettings`; `get<unknown>` reads | the generated types; every read typed with its generated answer |
| `api/electricity-readings.ts` | `ManualReading`, `Calibration`, `ReadingLog` by hand | `Pick<>` of the generated types (a renamed or dropped field is a compile error); narrowed on purpose: `value_kwh` (NOT NULL column), `effect_reason` (the known reasons), the offsets |
| `api/water.ts` | every wire type by hand | the generated types (`Meter` = `Omit<WaterMeter, 'epochs' \| 'warning'>`, `Consumption` and `LeakRules` / `AlertsConfig` as `Pick`s the empty / default answers fit); reads typed with the generated envelopes |
| `api/water-billing.ts` | every wire type by hand | the generated types; kept by hand: the formula AST and the bill snapshot (documents) |
| `api/backup.ts`, `water/access.ts` | `EnergySettingsWire`, `WaterStatus` by hand | the generated types |
| `api/electricity-billing.ts` | every wire type by hand | `Pick<>` of the generated types with documented narrowings (the mock store builds these types too); `FormulaCheckWire`, `BillEventWire`, `PaymentTerms`, `CalendarDay` / `CalendarYear`, `VatRates` generated; kept by hand: the snapshot document, the TOU definition, the formula AST |

Drift the generated types found (all fixed without a behaviour change):

1. `api/water.ts` `Candidate.verdict` said `'accepted'`; the server sends `'ok'`. `screens/water/page-meters.ts` compared with
   `'accepted'`; it now compares with `'ok'`. Same screen output: the server's message for an `ok` verdict is `""`.
2. `api/electricity-billing.ts` `PdfEngine.checked` said `string | null`; the server sends a boolean (`detail` a string, never null).
   The demo store (`electricity-billing-mock.ts`) now sends `true` / `''`; no screen reads either field.
3. Noted, not changed (documented in the types): the electricity account status meters' `start_reading_kwh` / `end_reading_kwh` are
   read when present but this server never sends them (the demo store does); `BillSummary.total` is typed present although the
   money-free reads leave it out (the bills screens need `energy.bills`); an account's `customer` / `next_period` are typed non-null.

### Raw SQL moved into store modules (review 05 SQL boundary)

New `services/energy_meters_store.py`, `services/energy_billing_store.py`, `services/water_meters_store.py`,
`services/water_billing_store.py`: every `execute()` and SQL literal of the four routers (customers / accounts / bills / tariffs / VAT /
auto-run queries, the tariff row writes and the stored-PDF mark, the manual readings and the alert log, mute / snooze / acknowledge).
The statements are unchanged; the customer queries are shared by electricity and water (one customer card). `scripts/sql_boundary_report.py`
now finds 0 statements and 0 `execute` calls in the four routers (asserted by the test).

## Tests

All on the workstation unless marked runner. The PC was at 100 % CPU from other agents throughout (times are not meaningful).

| What | Command | Result |
|---|---|---|
| Baseline before the change (with a shape recorder) | pytest of the 27 consumption test files (`test_energy_*`, `test_water_*`, `test_bill_*`, tariff names, home v3 followup / p3, xsecfix, path confine, backend safety) | 453 passed, 41 skipped, 2 errors |
| The same suites after the change, `SW_WIRE_STRICT=1` + the oracle on every answer, plus `test_wire_consumption_2450.py` (first version) | same command + the new file | 466 passed, 41 skipped, 0 failed, 2 errors |
| The 2 errors (both runs) | `test_bill_pdf.py::test_logo_refusals[<large PNG>]` setup | pre-existing on Windows: `ValueError: the environment variable is longer than 32767 characters` (pytest puts the parameter id into `PYTEST_CURRENT_TEST`); not related |
| Contract tests (final version) + route table + singletons + OpenAPI | `test_wire_consumption_2450.py test_routers_table_2440.py test_singletons_registered.py test_security.py::test_no_route_fetches_... test_be_twins_2440.py` | 61 passed |
| `scripts/api_inventory.py` (OpenAPI with the models) | | runs; no consumption route line changes (the one difference is an unrelated route already missing on the train, left alone) |
| ruff (F rules) | changed backend files, the new script, tests | all checks passed |
| Frontend type check | `npm run typecheck` (`tsconfig.tests.json` = src + tests) | 0 errors in src and tests; `tsconfig.scripts.json` fails on the PC only because the shared `node_modules` has no ESLint packages - clean on the runner (below) |
| Frontend unit specs | `npx playwright test -c playwright.unit.config.ts` electricity-billing, -customer-form, -readings, i18n-api-2442, logexport-tariff-en-2440, textkey-2435, water-billing, water-nav | 90 passed |
| Runner (nice 19): `tsc -p tsconfig.scripts.json`, ESLint of the 10 changed frontend files, `unused-exports.mjs --enforce`, `api-client-check.mjs`, `vite build` | `~/work/respmodels` | all rc=0 (unused exports: no export outside the baseline) |
| Runner Playwright | the targeted run was started against `vite preview`; the harness specs need the vite DEV server, so every one timed out on `[data-harness]` | stopped by me after 20 of 360 (an infrastructure mistake, not a result); not re-run: the 2.43.9 release gate is running and the lead asked for no new runner runs |
| Electricity / water specs on the PC instead (vite dev server, desktop, 1 worker) | electricity-accounts, -bills, -meter-device-name, -meter-rename, -meters, -readings, -tou, -wizard, layout-electricity(-meters), evidence-electricity-meters, -electricity-ui-bills, -tariff-names-en-2440, -backup-meters, -wkwater-2331 | 138 passed, 1 skipped, 1 failed: `electricity-accounts` "loading state ..." (expects `data-state=loading` during a 600 ms demo latency; under 100 % CPU the page was already `ready`) - re-run alone: 1 passed. Tablet / mobile projects and the gate's preview-vs-dev split: NOT_RUN (runner blocked by the release gate) |

No pixel change is expected (types only, plus a comparison literal whose screen output is the same and two demo-store values no screen
reads); no baseline was refreshed.

## Not done / open

- Other router families: not in this row (another agent and later rows).
- The bill snapshot, the TOU definition and the formula AST stay hand-typed on the frontend (documents with their own versioning).
