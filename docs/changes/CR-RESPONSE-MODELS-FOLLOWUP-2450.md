# CR-RESPONSE-MODELS-FOLLOWUP-2450 - the frontend follows the consumption family's real optional / null types

Branch `pilot/CR-RESPONSE-MODELS-FOLLOWUP-2450`, cut from `origin/pilot/CR-RESPONSE-MODELS-CONSUMPTION-2450` (`4e528f019`). Target 2.45.0.
Follow-up of CR-RESPONSE-MODELS-CONSUMPTION-2450 (code review 07:F8 step 2): that row generated
`frontend/src/api/generated/wire-consumption.ts` from the backend's response models and listed three places where the hand-kept frontend
types still claimed a value the server may leave null or absent. This row moves the remaining direct callers onto the generated types and
makes every screen draw a dash / "no data yet" for those values instead of crashing or showing NaN / a made-up 0.

## 1. Direct callers moved onto the generated types

The only callers of the four consumption routers outside `src/api/` were in `src/home/` (`water/access.ts` already used the generated
`WaterStatus`; `home-p3-bills.ts` fetches the bill PDF, a binary answer with no model):

| File | Read | Before | Now |
|---|---|---|---|
| `home/home-p3.ts` | `GET energy/accounts`, `.../{id}/status`, `.../{id}/periods` | hand-written `BillAccount`, `BillPeriod`, `BillView['status']` | `EnergyAccountList`, `EnergyAccountStatus`, `EnergyAccountPeriods` |
| `home/home-p3.ts` | `GET infra/water/status`, `meters`, `events/summary`, `consumption` | inline object types | `WaterStatus`, `WaterMeterList`, `WaterEventsSummary`, `WaterConsumption` (the fallbacks of the two optional reads are typed `Pick`s) |
| `home/sw-home.ts` | `GET energy/tariffs` | inline object type | `EnergyTariffList` |

The logic around those reads moved into pure, unit-tested helpers of `home/home-p3-logic.ts`: `billAccounts` (accounts not paused),
`billsWithTotal` (the previous bills worth a line: a real bill with an amount - `total` is absent without the money permission, so such a
bill is left out instead of drawn as 0 ₪), `fixedTariffPrice` (the house price per kWh; null without a fixed tariff, a current version or
a price) and `waterView` (`today` / `month` null when no meter has a reading = "no data yet", retired meters left out). Screen output
is unchanged for every answer the old code handled.

## 2. Optional / null types followed

`api/electricity-billing.ts` (the hand-kept `Pick`s of the generated types):

| Field | Before | Now (= the server) | Screens |
|---|---|---|---|
| `Account.customer` | `CustomerRef` | `CustomerRef \| null` (null when the customer row is gone) | name drawn through `customerName()` -> `-`; no customer link; the status read skips the customer card read; the wizard opens such an account for edit (edit never sends the customer) |
| `Account.next_period` | `{from,to}` | `EnergyPeriod \| null` | `AccountStatus.next` null -> the "next bill" card says "אין עדיין תקופה הבאה" / "No next period yet" |
| `AccountStatusWire.period` / `kwh_so_far` | period always present | `EnergyPeriod \| null`, `string \| null`, plus `error_code` | `AccountStatus.period` / `kwh` / `forecast_kwh` / `avg_per_day` nullable: the day tile says "אין עדיין תקופה פעילה" / "No active period yet", the numbers are `-`; `error_code` shows its `ERROR_TEXT` (fallback "לא ניתן לחשב את הצריכה בתקופה." / "The consumption of the period cannot be calculated."); the accounts list shows `-` instead of `0.00` kWh |
| status meters' `start_reading_kwh` / `end_reading_kwh` | optional (already) | unchanged: this server never sends them, the demo store does | the phone list drew `f2(r.end ?? 0)` (0.00 when absent); it now uses `readingText` ("לא נקלט" / "Not recorded"), like the table |
| `BillSummary.total` | `string` | `total?: string` (absent without `energy.bills`) | bills table / list and the issue dialog draw it through `ilsOr()` -> `-` |

New formatting helpers in `electricity/elec-format.ts`: `NO_VALUE` (`-`, the dash the electricity screens already use for an empty cell),
`f2or`, `f0or`, `ilsOr`, `customerName`. Water: its types were already the generated ones and its screens already guard every nullable
field (`fmtM3` / `fmtIls` / `range` take null); the one gap was the accounts page tiles, which summed `?? 0` and showed `0.000 m³` /
`0.00 ₪` when no account had a value - now `sumOrNull` (`water/billing-format.ts`) gives `-`.

Other generated types checked with the compiler after the change (no further screen assumed a value the server may omit): the water
account status / account / bill summary, the electricity history period, the tariff list.

## Merge notes (the sw-table move of the electricity / water tables runs in parallel today)

One commit per screen. Edits inside table markup are single-expression swaps, nothing structural:
`elec-account-list.ts` (customer cell `customerName(r.account)`, kWh cell `f2or(r.kwh)`), `elec-bills-table.ts` (total cell `ilsOr(b.total)`),
`elec-account-page.ts` (the meters table footer `f2or(s.kwh)`). The water accounts change is in the tiles, outside the table.

## Tests

All on the workstation (PC). The runner gate for `release/2440-train` was running (load ~48); no runner use.

| What | Command | Result |
|---|---|---|
| Type check, app + tests | `npx tsc --noEmit -p tsconfig.tests.json` | 0 errors |
| Type check, app | `npx tsc --noEmit -p tsconfig.json` | 0 errors |
| Type check, scripts | `npx tsc --noEmit -p tsconfig.scripts.json` | 0 errors |
| ESLint, the 14 changed src files | `eslint --pass-on-unpruned-suppressions <files>` | 0 reports |
| New unit spec | `playwright test -c playwright.unit.config.ts tests/unit-response-models-followup-2450.spec.ts` | 16 passed |
| Related unit specs (with the new one) | unit-electricity-billing, -home-v3-p3-logic, -water-billing, -i18n-api-2442, -textkey-2435, -electricity-customer-form, -electricity-readings, -water-nav | 108 passed (total) |
| Browser specs, Vite dev server, desktop project, 1 worker | electricity-accounts, -bills, -wizard, -tou, -readings, -meters, layout-electricity, evidence-electricity-ui-bills, evidence-wkwater-2331, home-v3-p3, home-v3-followup-a, home-v3-auditfix-2437 | 166 passed, 2 skipped, 5 failed (1.2 h, the PC at 100 % CPU) |
| The 5 failures re-run alone (same server) | electricity-meters:25, home-v3-p3:294 | 2 passed |
| | home-v3-followup-a:79 (bill file), :118 (categories), home-v3-p3:109 (themes) | 3 failed again (page loads / `p3.loaded` waits timing out) |
| The same 3 against the BASE commit `4e528f019` (its own Vite dev server, same test files) | same 3 | 3 failed the same way (`page.goto` 60 s timeouts): load on the PC, not this change. In the first run the bill-file test had already reached and requested `energy/bills/b1/pdf` (the bill screen rendered and the button worked); it timed out on the new tab's blob address |
| After merging `origin/release/2440-train` (12 commits, no conflict) | `npx tsc --noEmit -p tsconfig.tests.json` | 0 errors |
| Tablet / mobile projects, pixel specs, runner | | NOT_RUN (the 2.44.0 gate held the runner the whole time) |

The new unit spec covers each null path: status with period null, with `error_code`, `next_period` null, `customer` null, meters without
readings; `f2or` / `f0or` / `ilsOr` / `customerName`; a history bill without a total; the home helpers (paused accounts, bills without a
total, a period-less forecast, the price per kWh without a tariff / version / price, water with no reading / retired meters / a failed
series); a source check that every electricity / water read in `src/home` names a generated type; `sumOrNull`.

No pixel change is expected: the demo store sends every field (period, customer, next period, totals with the money persona), so the
screens draw what they drew; only answers the demo store never produces now render differently. No baseline refreshed.

## Open questions (recommendation taken)

1. A period that could not be computed (`error_code`, e.g. `tariff_missing`): the account page now shows the reason as a warning
   above the tiles. Recommended (taken): keep it - the operator sees why the numbers are missing.
2. The water issue-bill dialog draws an absent total as an empty cell (`fmtIls` gives `''`); the dialog needs the bills permission, so
   the total is always present there. Recommended (taken): unchanged.
