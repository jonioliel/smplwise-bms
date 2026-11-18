# CR-FE-TYPES-2443 - ticket files read declared API fields instead of casts

Branch `pilot/CR-FE-TYPES-2443`, cut from `origin/release/2438-train` at 5bcea468d. Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) row `pilot/CR-FE-TYPES-2436` (renumbered 2443), group G9 of
`private/planning/REMAINING_WORK_2026-11-18.md`. Types only: the emitted JavaScript is the same (no runtime or pixel change).

## Finding 08:F19 (tickets items)

Casts (two of them through `unknown`) read fields the API types did not declare, so `tsc` could not see a renamed or missing field:

| Site | Was | Now |
|---|---|---|
| `tickets/external-assign.ts` `costChoice()` | `(this.preview as unknown as { cost_claim?: ... })?.cost_claim` with a local `CostModeChoice` copy of `CostMode` | `this.preview?.cost_claim`: `api/tickets-s4.ts` `AssignPreview` declares `cost_claim?: CostClaimOption` (the type `api/tickets-costs.ts` already had for the same route) |
| `tickets/external-assign.ts` `channelLines()` / `sendNowChoice()` | `as AssignPreview & AssignPreviewExtra` | no cast: `AssignPreview extends AssignPreviewExtra` (slice 5b's send-hours / account / fallback lines ride in the same preview answer) |
| `tickets/costs-tab.ts` `vendorTarget()` | `canWriteVendor(t as unknown as ConvTicket)` | `canWriteVendor(t)`: `CostsTicket` is already assignable to `ConvTicket` (the extra fields are optional) |
| `tickets/vendor-accounts.ts` two `sw-table`s | `.columns=${cols as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}` | `.columns=${cols} .rows=${rows}` (a Lit property binding takes any value; the casts only erased the typed `TableColumn<Line>` / `TableColumn<AccountClaim>` the columns are declared with) |

Not done here (outside this row): making `sw-table` itself generic over the row type, and the home / plan-wizard items of F19
(they belong to the i18n home and plan-wizard branches per the master plan).

## Files

`frontend/src/api/tickets-s4.ts` (the API type file the dialog reads), `frontend/src/tickets/external-assign.ts`, `costs-tab.ts`,
`vendor-accounts.ts`; new `frontend/tests/unit-fe-types-2443.spec.ts` (source pin: the casts stay gone).

## Tests

Run locally (workstation, PC under load, `--workers=1`):

- `npx tsc --noEmit`: clean (exit 0) - the row's test column.
- `npx playwright test -c playwright.unit.config.ts tests/unit-fe-types-2443.spec.ts tests/unit-costs-demands.spec.ts
  tests/unit-tickets-messages.spec.ts tests/unit-tickets-create-assign.spec.ts --workers=1`: **23 passed** (3 new).

NOT_RUN: the tickets evidence / layout / pixel specs (no runtime change; the runner is reserved for the 2.43.8 gate).
