# Electricity UI shell: routes, components, shared modules (agreement between pilot/elec-ui-meters and pilot/elec-ui-bills)

Owner of this document and of the shell: `pilot/elec-ui-meters`. The other UI branch (`pilot/elec-ui-bills`) plugs its screens in
without touching `nav.ts` / `sw-app.ts`. Hebrew names are the owner's (2026-10-04): area "תשתיות", sub-tab "מוני חשמל",
account = "חשבון", produced bill = "חיוב".

## Navigation
- Area id `infra`, router mode `infra`, label "תשתיות", icon `bolt`, in the rail and the phone bottom bar after WisKey.
- Area tab row (level 1): one tab, id `electricity`, label **"מוני חשמל"**, href `#/infra/electricity/meters` (water / generators join later as siblings).
- Page row (level 2, drawn by the shell element, not by nav.ts): `meters` מונים, `accounts` חשבונות, `bills` חיובים, `customers` לקוחות.
  `bills` and `customers` are shown only to holders of `energy.bills`; the area itself to `energy.view`.
- Settings tab `infra` "תשתיות" in the settings row (`#/system/infra`), with a segmented strip: `prices` "מחירים ומע״מ",
  `business` "פרטי העסק", `retention` "שמירת נתונים" (the strip is drawn by `<system-infra>`).

## Routes (hash, after `#`)
| Route | Element | Owner |
|---|---|---|
| `/infra` , `/infra/electricity` | redirect to `/infra/electricity/meters` | meters |
| `/infra/electricity/meters` (`?view=table\|cards&area=<id>&meter=<id>&add=1`) | `<elec-meters-page>` | meters |
| `/infra/electricity/accounts` , `/accounts/new` (wizard), `/accounts/<id>` , `/accounts/<id>/history` , `/accounts/<id>/bills` | `<elec-accounts-page>` | bills |
| `/infra/electricity/bills` , `/bills/<id>` | `<elec-bills-page>` | bills |
| `/infra/electricity/customers` , `/customers/<id>` | `<elec-customers-page>` | bills |
| `/system/infra` -> `/system/infra/prices` | `<system-infra>` | meters (shell) |
| `/system/infra/prices` | `<elec-settings-prices>` | bills |
| `/system/infra/business` | `<elec-settings-business>` | bills |
| `/system/infra/retention` | `<elec-settings-retention>` | meters |

## Plugging a screen in (no shared-file edits)
- Put the element in `frontend/src/screens/electricity/page-<name>.ts` (a page) or `settings-<name>.ts` (a settings section).
  `infra-electricity.ts` / `system-infra.ts` load every such file with `import.meta.glob('./electricity/{page,settings}-*.ts', { eager: true })`,
  so adding a file needs no edit of mine, and there is no merge conflict. Element names are exactly the ones in the table.
- Every page element has two properties set by the shell: `.segments: string[]` (the route segments AFTER `/infra/electricity/<page>`, e.g. `['a1','history']`)
  and `.params: URLSearchParams`. Navigate with `navigate()` from `src/router.ts`. The shell re-renders on route change.
- Until your file exists the shell shows a plain "אין מסך" state for that route (never a blank page).

## Shared modules (mine, import freely)
- `src/api/electricity-meters.ts`: the ONLY module that talks to the meters endpoints (types `Meter`, `MeterCandidate`, `MeterStatus`, `ElectricityRetention`...;
  functions `listMeters`, `meterCandidates`, `addMeters`, `pauseMeter`, `resumeMeter`, `removeMeter`, `meterSeries`, `getRetention`, `putRetention`).
  Wiring the real backend changes this file only.
- `src/electricity/access.ts`: `energyAccess()` returns `{ view, bills, manage, system }` from the session (`permissions_any`), `onEnergyAccess(fn)`;
  money is never drawn when `!bills`.
- `src/electricity/format.ts`: `fmtKwh`, `fmtNum`, `fmtIls`, `fmtDate`, `fmtDateTime` (LTR numerals inside RTL text).
- `src/electricity/styles.ts`: `electricityCss` (tables, chips, tiles, list rows) to reuse in your screens so both halves look the same.
- `src/electricity/meter-picker.ts`: `<elec-meter-picker>` (search by name, area filter, verdict per sensor, the kW rejection messages).
  Properties: `.multi: boolean`, `.selected: string[]`, `.mode: 'register' | 'choose'` (register = candidates from the infrastructure, add as meters;
  choose = already registered meters only, for wizard step 1). Event `change` with `detail: { selected: string[] }`.
- Components of the shared design system are used as everywhere else (`sw-page`, `sw-table`, `sw-state-panel`, `sw-dialog`, `sw-drawer`, `sw-steps`...).

## Rules both sides keep
- Operator wording only; no platform name; clean screens (no hint paragraphs). Money fields are not rendered at all without `energy.bills`.
- All four skins, light and dark, RTL, phone at 390: use design tokens (`--sw-*`) and the layout-guard conventions (targets >= 44 px in touch layouts).
- Test hooks: `data-elec="<page>"` on a page root, `data-state="loading|empty|error|ready"` on the list root.
