# CR-WATER-CUSTOMER-FORM-2440 - one customer form for the water and the electricity customer cards

Branch `pilot/CR-WATER-CUSTOMER-FORM-2440`, cut from `origin/pilot/CR-W3B-FE-COMBINED-2443` @ `41bf2a6d6` and merged with
`origin/release/2438-train` @ `4679923b4` (merge `3a3474876`, no conflict). Frontend only: no version bump, no CHANGELOG entry, no
backend change, no setting, no text change, no baseline change.

## What and why

Code review 2026-11-13, `private/code-review-2026-11-13/08-frontend-features.md` F25 (2.44.0 queue: "water customer form ->
shared customer-form.ts"): the water customers page (`frontend/src/screens/water/page-customers.ts`) copied the electricity
customer form (`frontend/src/electricity/elec-customers.ts`) - the form model, the blank form, filling it from a stored customer,
the client checks, the update body and the field renderer. One customer record serves both modules, so the two cards must not drift.

New `frontend/src/components/customer-form.ts` (pure helpers plus one lit field renderer, no element, no state):
`CustomerForm`, `blankCustomerForm`, `customerFormOf`, `validateCustomerForm` (option `numberOptional`), `customerUpdateBody`,
`customerField`. Both pages use it; each keeps its own words, permissions, API calls, error mapping, list and card layout.

Behaviour and markup kept exactly:
- control ids stay `f-<field>` (electricity) and `wc-<field>` (water);
- the electricity card still sets `placeholder` (empty or "לא חובה") on every control, the water card sets none (`ifDefined`);
- the customer number stays required on electricity and optional on water (the server assigns it);
- the error order stays name, e-mail, number; an input clears its own error on typing; on electricity the notes textarea keeps a
  server field error until the next save (as before), on water it clears it (as before);
- an update sends the customer number only when it changed.

Only the three source files plus a new node-only spec are touched (another branch swaps components across many screens tonight).

## Tests actually run

Workstation (Windows):
- `npx tsc --noEmit` (frontend): PASS.
- `npx playwright test -c playwright.unit.config.ts tests/unit-customer-form-2440.spec.ts tests/unit-water-billing.spec.ts --workers=1`:
  9 passed (3 new + 6).

Runner (a fresh clone in `~/work/waterform2440` at `0f6f048a5`; the base is the merge parent `3a3474876`, built and served
side by side; nice -n 10, load 40-75 from other jobs; results in `~/work/run2440-results/`):
- Node-only unit: the new spec, `unit-water-billing`, `unit-water-nav` and every unit spec that reads the source tree (38
  repository-rule specs) -> **374 passed**, 0 failed.
- `evidence-wkwater-2331` + `layout-audit30-e-infra` (preview of the branch build, 3 projects, incl. the AUDIT30-E pixel baselines)
  -> 60 passed, 47 skipped (desktop-only cases), 1 failed: `E1 water` (desktop) timed out waiting for `sw-app` at load ~60; re-run
  alone -> passed. No snapshot written or changed.
- `electricity-accounts` + `evidence-electricity-ui-bills` + `layout-electricity` (Vite dev server - the electricity harness needs it;
  3 projects) -> 145 passed, 8 skipped, 3 failed, all load timing on screens this branch does not touch:
  `accounts list › loading state ...` (tablet, mobile: the 600 ms mocked latency was over before the first check) - re-run alone:
  2 passed on the branch, 2 passed on the base; `layout guard [tesla]` used its 40 min budget at load ~65 - see the re-run below.
  The layout guard found 0 findings in 840 checks each for classic, domus and crystal. The customers tests (list, new, edit, delete,
  errors, forbidden) passed in all projects.
- DOM parity, branch vs base (a scratch probe, not committed): the water and electricity customers list, a customer card and the
  new-customer card through save-empty -> bad e-mail + bad number -> typing (field errors 1 / 3 / 2), serialising the page's shadow
  DOM (lit markers stripped) plus every control's id, value, readonly, placeholder, aria-invalid and class: **30/30 states
  identical** (desktop, tablet; electricity also mobile - the probe's water phone step looked for a desktop-only table row, a probe
  fault, on both sides alike).
- Screenshot parity of the evidence customer shots (branch run vs base run): not usable as proof - the two runs were taken at load
  ~60 and differ in font rasterisation and unpainted tiles even on the list page, whose code this branch does not change; the DOM
  probe above replaces it.
- `layout-electricity [tesla]` re-run alone on the branch -> passed (840 checks, 0 findings, 0 page errors).

NOT_RUN: the release gate / entry check (not queued, per the task); a pixel spec of the customer screens does not exist (no
baseline covers them).

## Rollback

Revert the commit; no data, API or setting is involved.
