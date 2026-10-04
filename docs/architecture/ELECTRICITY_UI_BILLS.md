# Electricity UI, accounts / bills / customers / billing settings (CR-023 P4 part 2)

Owner of this half: `pilot/elec-ui-bills`. The shell (area "תשתיות", sub-tab "מוני חשמל", the page row, the settings strip) is
`pilot/elec-ui-meters` (`ELECTRICITY_UI_SHELL.md`); this half plugs in with the element names agreed there and edits no shared file.

## Elements (all in `frontend/src/electricity/`)
| Element | What | Mounted as |
|---|---|---|
| `<elec-accounts-page>` | accounts list (table / cards / phone list), the account page (`status`, `history`, `bills` tabs), the wizard (`/accounts/new`), the edit mode (`/accounts/<id>/edit`) | shell route `/infra/electricity/accounts...` |
| `<elec-bills-page>` | bills list with filters, one bill (A4 preview, actions, dialogs) | `/infra/electricity/bills...` |
| `<elec-customers-page>` | customers list, customer card (system sheet), new customer (`/customers/new`) | `/infra/electricity/customers...` |
| `<elec-settings-prices>` | tariffs with before / including VAT and versions, VAT rate and history, default entry mode | `/system/infra/prices` |
| `<elec-settings-business>` | business details, logo, brand colour picker, numbering, payment terms (days or a fixed day), automatic-draft delay, live bill preview | `/system/infra/business` |

`src/screens/electricity/{page,settings}-*.ts` are one-line imports so the shell's `import.meta.glob` finds them. Routes live in ONE file
(`elec-routes.ts`: `ELEC_ROOT`, `SETTINGS_ROOT`). Shared pieces: `styles.ts` (`elecCss`, one sheet for both halves, tokens only, one `--elec-touch` hit-area variable),
`elec-ui.ts` (`ElecBase`, `<elec-dialog>` on the system `sw-sheet`, state boxes), `elec-bill-paper.ts` (A4 HTML of the bill snapshot),
`elec-chart.ts` (+ `elec-chart-data.ts`: the consumption chart), `elec-formula.ts` (grammar, AST, presets, text mode, pure),
`elec-formula-editor.ts`, `elec-wizard.ts`.

## One API module and a mock layer
`frontend/src/api/electricity-billing.ts` is the ONLY module that talks to the billing API (wire types of `ELECTRICITY_BILLING_API.md` and
`ELECTRICITY_BILL_SNAPSHOT.md`, the REST adapter, error texts; permissions come from `src/electricity/access.ts`). Without a backend it answers from
`electricity-billing-mock.ts` (the mockup's fixture in the wire shapes; the arithmetic of CR section 7). Specs steer it through
`localStorage['sw.demo.electricity']` = `{persona: full|view|bills_only, empty, fail: accounts|bills|customers|settings|meters, pdf_failed, create_error, latency}`.

## Tests
`frontend/tests/electricity-harness/` mounts the page elements from the same hash routes without the shell (Vite DEV server,
`/tests/electricity-harness/index.html?skin=bubble&scheme=dark#/infra/electricity/accounts`). Specs: `electricity-wizard`, `electricity-bills`,
`electricity-accounts` (accounts, customers, settings, RTL), `unit-electricity-billing`, `evidence-electricity-ui-bills` (screenshots under
`docs/design/evidence/electricity-ui-bills/`), `layout-electricity` (the layout guard, 4 skins x light/dark x 10 widths; `LAYOUT_QUICK=1` = 4 widths).
Test hooks: `data-elec="<screen>"` + `data-state` on every screen root; `data-*` attributes on controls (see the specs).

## Contract notes for the server side (what the UI cannot get today)
See the report of the branch; the open items are listed there and are all additive.

## Integration (2026-10-04, `integ/electricity`)
- ONE stylesheet: `src/electricity/styles.ts` exports `elecCss` (the bills sheet from the approved mockup plus the meters-only
  classes); `elec-css.ts` and `electricityCss` are gone. One hit-area variable `--elec-touch` (32 px desktop, 44 px at <= 1100 px,
  the bubble skin's touch dial). Meters chip classes are `c-*`, the skeleton class is `.skl`.
- ONE permissions source: `src/electricity/access.ts` (`ENERGY_PERMISSIONS`, `ENERGY_PERMISSION_LABELS`, `energyAccess()`);
  `elecPerms` was removed; `permission-rows.ts` and `system-access.ts` take their labels from it.
- Wizard step 1 uses `<elec-meter-picker mode="choose" multi sensors>`; the meter list of the bills half comes from
  `src/api/electricity-meters.ts` (`elecMeters()`); the lenient mapping and the wrong candidates path were removed.
- The account history tab reads `GET /energy/accounts/{id}/history` (periods without a bill included, same period last year).
- The bill page shows the PDF state (`Bill.pdf`) with a retry action; sent/paid send and show a date (`YYYY-MM-DD`) with `row_version`.
