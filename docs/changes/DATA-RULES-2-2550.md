# DATA-RULES-2-2550 - battery system choice, billing gap warning, reopen a period after a person's draft expires

Target 2.55. Branch `pilot/DATA-RULES-2-2550`, base `origin/release/2540-train` at `f9217db8a` (DATA-RULES-2540 is merged there).
Follows the open questions 2-4 of `docs/changes/DATA-RULES-2540.md`; owner rule "unanswered = recommendation (a)", so each is built
to its recommendation (a).

**No migration.** All API changes are additive (ADR-015): one optional response field on each account status (electricity, water), one
more key in an existing audit row's details. Permissions unchanged (the battery choice stays `generator.manage`).

## (1) Generator settings - the starter battery's system (DATA-RULES-2540 question 2a)

Settings › Infrastructure › Generator › Alert thresholds now starts with a three-way choice **Automatic / 12 V / 24 V**
(`sw-segmented radio`, the module's key look). Default **Automatic** = today's behaviour (the server's one rule:
`services/generator_core.battery_system` - 24 V once the bank was ever seen above 16 V, else by the reading). The line under it says
what the server detected ("Detected: 24 V" when known) or, for 12 / 24, which system the battery threshold and dial use.
The choice is saved with the section's existing Save button as `battery_nominal_v` (24 / 12 / null) on `PUT /generator/devices/{id}`
(the route DATA-RULES-2540 added; `generator.manage`, the audited 403 of `rbac.require` otherwise). Untouched thresholds are no
longer sent with a battery-only save. The audit row `generator.device.update` now carries `battery_nominal_v` AND
`battery_nominal_v_before` (before: only the new value).

Files: `frontend/src/generator/gen-settings.ts`, `frontend/src/api/generator.ts` (the body type), `frontend/src/i18n/he.ts`,
`frontend/src/i18n/lang/en/i18n/en.ts` (Hebrew + English), `smplwise_vms/backend/smplwise/routers/generator.py` (audit details).

## (2) Billing - a gap between issued bills is a warning on the account (DATA-RULES-2540 question 3a)

`bill_ledger.billing_gaps(kind, conn, aid)`: between the account's first and last sealed bill (issued / sent / paid) every day that no
bill covers - a void bill covers nothing; an open draft or correction covers its days (that period is being billed). The account
status answers carry it as `billing_gaps: [{from, to}]` (`to` inclusive, oldest first): `GET /energy/accounts/{aid}/status` and
`GET /infra/water/accounts/{aid}/status` (also when the open period cannot be computed). The account page draws one warning per gap
above the tiles, with the dates: "Billing gap: the days 11.09.2026 - 20.09.2026 lie between issued bills and are in no bill." It is read
for the status only - nothing is written into any bill or snapshot (a sealed bill stays byte-identical).

Files: `services/bill_ledger.py`, `services/energy_billing.py` (`billing_gaps` wrapper), `services/water_billing.py`,
`routers/energy_billing.py`, `wire/energy_billing.py`, `wire/water_billing.py`, `frontend/src/api/generated/wire-consumption.ts`
(regenerated), `frontend/src/api/electricity-billing.ts` (`AccountStatus.gaps`), `frontend/src/electricity/elec-account-page.ts`,
`frontend/src/screens/water/page-accounts.ts`, `frontend/src/water/i18n.ts` + English twins.

## (3) Billing - a person's expired draft on an automatic account reopens its period (DATA-RULES-2540 question 4a)

Before: the automatic pass found a period taken by a draft a person made and recorded it `skipped` (settled for good); when the 30-day
draft retention deleted that draft, the period stayed unbilled forever, silently. Now `bill_ledger.retention` removes, in the same
transaction, the `skipped` run rows that overlap each deleted person-made draft (`reopen_runs`) - only for a live account whose
automatic mode is not `off`, never for a correction draft (its issued original covers the period), never a created / issued / failed
run row. The next pass looks at the period again: it makes the automatic draft, or - when an issued bill still overlaps - records it
`skipped` again (the pass's own overlap check), so there is never a second bill. The retention audit row adds `reopened: N` when it
reopened anything; the function's return value is unchanged. Electricity and water alike (one ledger).

Golden SQL traces `tests/fixtures/bill_ledger_b_sql_golden.json` regenerated on purpose (`SW_BILL_LEDGER_GOLDEN_WRITE=1`): the retention
draft select now reads the draft's account / period / origin / correction link, and the reopen DELETE.

## Tests

Linux runner (slot D, job `~/work/p2520_dr2_run.sh`, branch head `4f46561e7`; run 2 `p2520_dr2_run2.sh` on `4aab7ca6b`, the
left-to-right isolate of "24 V") and the PC (one pytest file per process).

Fails before / passes after (the new test files copied onto the base `f9217db8a`):

| test | base (before) | branch (after) |
|---|---|---|
| `tests/test_data_rules_2_billing_2550.py` | exit 1: 4 failed, 1 passed (runner and PC) | exit 0: 5 passed |
| `tests/test_data_rules_2_water_2550.py` | exit 1: 2 failed (runner and PC) | exit 0: 2 passed |
| `tests/test_data_rules_2_generator_2550.py` | exit 1: 1 failed, 1 passed (runner and PC) | exit 0: 2 passed |
| `frontend/tests/unit-data-rules-2-2550.spec.ts` | exit 1: 2 failed (`gaps` undefined) | exit 0 (in the unit group below) |
| `frontend/tests/pixel-data-rules-2-2550.spec.ts` (base build, branch baselines) | exit 1: 12 failed (no battery field, no gap warning) | exit 0: 12 passed (compare) |

The cases that pass on the base too are guards of unchanged behaviour: an operator cannot choose the battery system (403, audited);
an account whose automatic mode is `off` is not reopened.

Branch checks (runner unless marked PC):
- backend shards (`SW_WIRE_STRICT=1`): [the 3 new files + `test_bill_ledger_lifecycle_b.py` + `test_bill_ledger_cross_kind.py`] 45 passed;
  [`test_data_rules_{billing,water,generator}_2540.py` + `test_generator.py`] 67 passed; [`test_energy_billing_api.py` +
  `test_water_billing_s3.py`] 57 passed - all exit 0. PC, one file per process, all exit 0: the 3 new files 5 / 2 / 2,
  `test_bill_ledger_cross_kind` 11, `test_bill_ledger_lifecycle_b` 25 (after the golden regeneration), `test_data_rules_billing_2540` 5,
  `test_data_rules_water_2540` 4, `test_data_rules_generator_2540` 9, `test_energy_billing_api` 37, `test_water_billing_s3` 20, `test_generator` 49.
- `gen_wire_types.py --check` 0; `wire_ratchet.py` 0; `request_strict_ratchet.py --check` 0; `error_contract_inventory.py --check` 0;
  `i18n_backend_errors.py` 0 (without English: 0); `scripts/gate/lint_backend.py --strict` 0 (0 findings); `design_ratchet.py` 0 (PC too);
  `api_inventory.py` 0 (no change); `ruff check smplwise` 0. `ruff check` on the three new test files reports F811 for the fixture
  imported from the neighbour test module (`w` / `app`) - the same pattern and report as `test_data_rules_billing_2540.py` and
  `test_energy_elecbill77.py`; the blocking backend lint passes.
- Frontend: `tsc --noEmit -p .` 0 errors; `tsc -p tsconfig.tests.json` 0 errors; eslint on the changed sources 0 errors (the test files
  are on the lint ignore list); `lazy-tags-check` 0; `unused-exports --enforce` 0; `api-client-check` 0; `i18n-split-langs --dry` 0.
- Unit group (`playwright.unit.config.ts`: this row, `unit-response-models-followup-2450`, `unit-data-rules-2540`, the i18n
  completeness / lint / ratchet / packs / core specs, `unit-sw-segmented`): 82 passed.
- Build 0; pixel spec `--update-snapshots` 12 passed, then compare 12 passed (16 Linux baselines, desktop 1440 + phone 390, light + dark:
  `gen-battery-auto`, `gen-battery-24`, `water-gap`, `elec-gap`); regression evidence `evidence-gen-units-en-2490`, `evidence-generator`,
  `evidence-wkwater-2331`, `evidence-gen-units-arru-2530` (desktop): 24 passed, 1 skipped.
- Run 2 (`4aab7ca6b`, the "24 V" isolate): tsc 0 / 0 errors, eslint 0, unused-exports 0, unit 6 passed, build 0, pixel spec
  `--update-snapshots` 12 passed then compare 12 passed (the committed baselines are this run's), `evidence-gen-units-en-2490` 3 passed.

Compare page (local, Hebrew): `private/planning/data-rules-2-2550_compare_2026-11-26.html` (before = the 2.54 train build, after = the
branch; generator thresholds, water account, electricity account; desktop + phone, light + dark).

NOT_RUN: the full backend suite and the full Playwright suites (the train's gate runs them); the tablet project (the spec covers
desktop and phone); lab (not allowed).

## Open questions (recommendation first)

1. What covers a gap: (a) an open draft counts as covering its days - the period is being billed, no warning (built); (b) only issued
   bills count - a gap shows until its draft is issued.
2. The gap warning: (a) always shown on the account page (it is a data-integrity warning; built); (b) a billing setting, default off.
3. Also notify about a gap: (a) no - the account page warning is enough for now (built); (b) one notification per new gap to the bills holders.
4. Arabic / Russian words of the battery choice (they read the Hebrew today, like the rest of that screen outside the field frames):
   (a) in the next translation row; (b) now.
