# AUDIT30-E-INFRA: infrastructure screens on the shared components (round-30 audit, branch E)

Branch `pilot/AUDIT30-E-INFRA`, cut from `origin/pilot/AUDIT30-BASE` (`2a6430586` = main v2.43.2 + SYS-AUDIT-QUICKFIX-2437 +
NOSCROLL-1366-2437). Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 6 (branch E) and 13.
Frontend only; every edited source file is in branch E's "Owns" list (`electricity/**`, `water/**`, `generator/**`, `temperature/**`,
`elevators/**`, `screens/infra-*.ts`, `screens/electricity/**`, `screens/water/**`). No shared component, shell, skin or i18n file of
another branch was touched. No device or lab access.

Owner gates: none of the E items is gated; where a shared-component API from branch B would be needed (#7 KPI variants = GATE Q4,
#10 table phone template = GATE Q8, #16 search field) the item is deferred (section 4), so no gate answer is assumed here. If the
owner later answers Q4 / Q8 with another option than א, only the "after B" follow-ups change.

## 1. What changed

| Item | Finding | Files | Change |
|---|---|---|---|
| E1 | #8 local keys off the scale | 24 module files (electricity, water, generator) + `electricity/styles.ts`, `generator/gen-styles.ts` | 128 local `<button class="btn ...">` became `<sw-button variant size icon>` (116 by a codemod, 12 by hand: dynamic variants, icon-only keys with a `label`). Kept local on purpose: links styled as keys (`<a class="btn">`, navigation), keys that carry `aria-expanded` / `aria-haspopup` / `aria-describedby` or an `aria-label` that differs from the text (the formula operators "+ − × % ( )", "תיקון", the snooze split key) - `sw-button` does not forward those to its inner button. Those local keys now sit on the shared scale: `.btn` `max(--sw-ctl-h-md, --elec-touch)`, `.btn.sm` / `.btn.ic` a new `--elec-key-sm` (= `--sw-ctl-h-sm`, the touch size from 1100 px down and in bubble). The segmented control (`.seg`, view / range / metric switches) is a pill track with pill thumbs, 28 px thumbs in a 34 px track (was 32 px, radius r-sm - 2 = 8 px). |
| E2 | #6 #9 no `sw-page`; lone area chip | `screens/infra-{electricity,water,generator,temperature}.ts`, `screens/infra-elevators.ts` | The four screens render `<sw-page heading=...>`: the one h1, the logos' / corner reserves, padding and width come from the shared component; the copies of `:host` padding, `srHeading(…, true)` and `leadReserveStyles` are gone. Temperature: heading + subtitle are sw-page's `heading` / `subheading`, the header actions sit in its `actions` slot (new / done are `sw-button`), loading and error states keep the same page frame; its h1 was 700 (own rule), now the shared 800. The area row of one tab (`data-infra-l1`, the lone "מוני חשמל" chip in demo mode and the API-mode single-tab rows of water, generator, temperature, elevators) is no longer drawn; the navigation draws the area row itself from two tabs up. |
| E5 | #14 local area list, solid accent selection | `screens/electricity/page-meters.ts`, `screens/water/page-meters.ts`, `water/i18n.ts` | The areas list is `<sw-place-tree>` ("all", floors with fold + pick, areas). Selected row = the tree's Blue Wash (`--sw-accent-soft` + `--sw-accent-text`), not the filled accent key with the primary shadow. A floor can now be picked as a filter too (`area=floor:<id>`); the fold state is kept as before (`sw.elec.meters.collapsed` / water's key). The local `.tree` rules were removed. |
| E6 | #5 page scroll | - | Re-measured: generator and temperature no longer scroll at 1366x768 since NOSCROLL-1366-2437 and still do not inside the sw-page frame (section 2). No layout change needed. |

## 2. Before / after (the audit's probe, run from a copy of the audit folder)

`tools/shoot.mjs --routes elec-meters,elec-accounts,elec-bills,water,generator,gen-charts,temperature,s-infra --wait 2600` (desktop,
tablet, phone x light, dark) plus `--vps contract --schemes light` (1366x768), then `tools/analyze.mjs`. Before = the base build
(`2a6430586`), after = this branch, both `vite build` served by `vite preview`. Raw lines: `docs/changes/audit30e-inspect/before-analyze.txt`,
`after-analyze.txt`.

| Screen | sw-page | h1 | buttons kinds / off-scale | off radii | page scroll 1366 / 1440 (D) | contrast L / D |
|---|---|---|---|---|---|---|
| elec-meters | 0 -> **1** | 30/800 -> 30/800 (sw-page) | 2/2 -> 2/**0** | 2 -> **0** | 0 / 0 -> 0 / 0 | 0/0 -> 0/0 |
| elec-accounts | 0 -> **1** | 30/800 | 1/1 -> 1/**0** | 2 -> **0** | 0 -> 0 | 0/0 |
| elec-bills | 0 -> **1** | 30/800 | 1/1 -> 1/**0** | 6 -> **0** | document page: 209 -> 167 (D 77 -> 35) | 0/0 |
| water | 0 -> **1** | 30/800 | 2/2 -> 2/**0** | 2 -> **0** | 0 -> 0 | 0/0 |
| generator | 0 -> **1** | 30/800 | 1/1 -> 1/**0** | 2 -> **0** | 0 -> 0 | 0/0 |
| gen-charts | 0 -> **1** | 30/800 | 2/3 -> 1/**0** | 10 -> **0** | 0 -> 0 | 0/0 |
| temperature | 0 -> **1** | **30/700 -> 30/800** | 0/0 -> 0/0 | 0 -> 0 | 0 -> 0 | 2/0 -> 2/0 (not E's, section 4) |
| s-infra | 0 -> 0 | - | 2/3 -> 1/1 (the shell rail key only) | 0 | 0 | 0/0 |

Source counts (`tools/source-counts.mjs`, raw `<button` / `<sw-button`): electricity 109/26 -> 48/84, water 72/12 -> 27/54,
generator 39/0 -> 11/28. The raw buttons left are the native buttons inside composite controls (segmented thumbs, menus, list
pickers, the tou grid) and the kept keys listed in E1.

Design skills (SKILLS_BRIEF.md): `ui-ux-pro-max search.py ... --domain ux` (kept `aria-pressed` / `aria-current` native buttons in the
segmented control and the tree), `impeccable detect` on the changed sources (no findings), `emil-design-eng` checklist (press feedback,
hover gate, selection as a wash). Outputs: `docs/changes/audit30e-inspect/`.

## 3. Tests

New: `frontend/tests/layout-audit30-e-infra.spec.ts` - per screen one h1 drawn by sw-page at 800 and no `data-infra-l1` (E2), every
visible key on the 28/34/40/44 px + r10/pill scale (E1), the places tree with the Blue Wash selection and a working fold (E5), no page
or page-sized panel scroll at 1366x768 (E6), source guards, and four `pixel-stable` baselines (electricity meters, water meters,
generator live, temperatures; desktop 1440 classic light; Linux baselines generated on the runner).
Updated for the new structure: `electricity-meters.spec.ts` (no area row; tree selectors), `evidence-electricity-meters.spec.ts`
(tree selectors), `electricity-bills.spec.ts`, `electricity-wizard.spec.ts` (`sw-button` disabled = the `disabled` attribute;
`toBeDisabled` does not see a custom element), `layout-header-logo-295.spec.ts`, `unit-uxfix-nav-295.spec.ts` (the h1 source check
now looks for `<sw-page heading=`).

Results: see section 5 (filled from the actual runs).

## 4. Not done here / after B

- **E3 (#7, after B3)**: the KPI rows of electricity, water (`.tiles`), generator (`.kpi-row`) and temperature (`.kpi` filter buttons)
  stay local: the base `sw-kpi` has no `unit`, `secondary` or `tone="warn|alarm"` / `dot` (branch B adds them, GATE Q4).
- **E4 (#10, after B4)**: the raw `<table>` of these modules stay; the `card` column roles of `sw-table` come with branch B (GATE Q8).
- **E7 (#16, after B5)**: the search inputs stay local (`label.inp` + input); the shared `type="search"` field comes with branch B.
- Temperature contrast L2 (warning ink on the warn-tinted card, 4.12:1 at 12-13 px) is finding #12's family (state inks, B / J); not
  changed here.
- `screens/system-infra.ts` (settings) still has no `sw-page`: the settings chrome is branch K's (#9 / #18).
- `components/sw-place-tree.ts` (shared, not E's) has an ungated `button:hover`.
- Screenshots at 768 / 375 and dark were shot by the probe (`shots/` of the copy) and looked at for the meters, generator and
  temperature screens; no new truncation seen. Elevators: only the one-tab row was removed (not measured with data, as in the audit).

## 5. Test runs

(see below)

## 6. Rollback

Revert the merge commit. No data, API or settings migration; the floor filter value `area=floor:<id>` in a URL simply falls back to
"no match" on an older build.
