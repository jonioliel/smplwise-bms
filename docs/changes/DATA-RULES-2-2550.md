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

RESULTS_PLACEHOLDER

## Open questions (recommendation first)

1. What covers a gap: (a) an open draft counts as covering its days - the period is being billed, no warning (built); (b) only issued
   bills count - a gap shows until its draft is issued.
2. The gap warning: (a) always shown on the account page (it is a data-integrity warning; built); (b) a billing setting, default off.
3. Also notify about a gap: (a) no - the account page warning is enough for now (built); (b) one notification per new gap to the bills holders.
4. Arabic / Russian words of the battery choice (they read the Hebrew today, like the rest of that screen outside the field frames):
   (a) in the next translation row; (b) now.
