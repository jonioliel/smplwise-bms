# NATIVE-SELECT-B-2480

2.48.0 row (lead brief `private/planning/AGENT_BRIEF_2480_2026-11-22.md`). Owner N10: selects move to the shared components screen by
screen; filter selects inside chips stay native. Standing look rule: module looks stay (calendars, electricity, water, generator,
temperature, notices, maintenance); a refactor that can be pixel-neutral must be. Sister row NATIVE-SELECT-A-2480 owns
`screens/system-*.ts` and the ratchet metric.

Branch `pilot/NATIVE-SELECT-B-2480`, base `origin/release/2470-train` (2c211966d; the 2.47.0 train 092bbc9a1 merged in at 92455d989).

## What changed

1. `components/sw-field.ts`: new `flow` attribute - the field adds no box and no look of its own:
   - the host is `display: contents`, so the slotted select keeps its place in the screen's row / grid and its own width;
   - `:host([flow]:not(#_)) ::slotted(*) { all: revert }` - every `::slotted()` rule of the field and of the skins
     (`design/skins/*`: the classic / domus wells, focus halos, the bubble / crystal / tesla backgrounds) is rolled back for the
     control. `revert` only takes effect where the screen sets nothing (the screen's rules sit in the outer tree and win anyway), so the
     select computes exactly what it computed before. `:not(#_)` lifts the rule above the hover / focus / disabled state rules.
   Taking the shared field look itself is a later, visible step per screen (drop `flow`), with its own comparison.
2. Every `<select>` outside `sw-field` in this row's scope now sits in `<sw-field flow>`. The select itself is unchanged: its
   classes, ids, `data-*` hooks, `aria-*`, labels (`<label for>` and wrapping labels still reach it - it stays in the same tree),
   `.value`, `@change` and every `selectOption` in the specs. Keyboard and RTL behaviour are the browser's, as before.
3. Ratchet: the metric change is NATIVE-SELECT-A's commit ff7ce9f07 (cherry-picked as d3a9d989d): native-select counts only a
   `<select>` outside `<sw-field>`. This row's own first attempt at the same change (7b3526b82) was reverted (09fd08be4) on the lead's
   instruction. Baseline lowered with `--update`: 297 -> 56 (040618a39).

| Group | Commit | Files | Selects |
|---|---|---|---|
| service calls (`tickets/*`, `screens/tickets-handlers.ts`) | f2c46a2b9 | 24 | 56 |
| shared screens (automations, scenarios, schedules, devices, explore / plan studio, investigate, installer, mapping, insights, multimedia, NVR camera editor, door-windows, elevators, plan wizard, 3D view / walk HUD, shell sheets, shared components) | 2a8f52d67 | 69 (+1 CSS) | 125 |
| modules with their own look (calendars, electricity, water, generator, temperature, notices, maintenance, the meters page) | c99053b7a | 33 | 60 |

Layout hooks that needed one rule each (a child combinator stops at the field element):
- `screens/mapping-assistant-css.ts`: `.tk > sw-field > select` keeps the token row's grid area.
- `calendars/event-drawer.ts`: `.ctls > sw-field > .inp` keeps the flex share of the repeat / on-behalf selects.

No new import in the four files unit specs load in Node (`map/walk-hud.ts`, `screens/automation-block-forms.ts`,
`screens/plan-studio-panel.ts`, `screens/plan-studio6-panel.ts`): importing the element there breaks those specs (Lit decorators in
Node); their host screens register `sw-field` (plan-studio-panel already drew 75 `sw-field`s without importing it).

## Left (not moved in this row)

| File | Selects | Why |
|---|---|---|
| `screens/live-wall.ts` | 3 | recorder / quality / count selects laid inside the toolbar's icon keys (`.ikey > select`, absolutely positioned) - owner N10: filter selects inside chips stay native |
| `screens/home-edit-panel.ts`, `screens/home-screen-options.ts`, `screens/home-edit-bv1.ts`, `home/sw-home-admin.ts` | 7 + 2 + 1 + 3 | home v3 / home screens - out of this row (lead) |
| `screens/system-*.ts` | 40 | NATIVE-SELECT-A-2480 |

## Visible differences

None intended, none found. The first version of `flow` (2a8f52d67 / c99053b7a) left the field's and the skins' `::slotted()` look on
properties a screen does not set; the before / after measurement below caught it (classic inset well on the tickets vendor-accounts
filters and the investigate incidents floor select; padding-block 5 px and a 34 px min height on the tickets handled-period select).
Fixed by the revert rule above.

## Tests actually run (workstation)

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (after each group and at the merged head); `-p tsconfig.tests.json`: exit 0.
- ESLint on the 128 touched source files (+ the new spec): exit 0. `node scripts/unused-exports.mjs --enforce`: OK at 4021e1a91 (earlier FAIL on 2 exports in
  `src/arx/webauthn.ts` - not this row; fixed by the train in 4d244a419, merged).
- `py -3.12 scripts/design_ratchet.py`: no count above the baseline; native-select 56.
- Unit (`playwright.unit.config.ts`): tickets group, 31 specs reading the files: 288 passed, 1 skipped. Shared + module groups, 129
  specs reading the files: 1025 passed, 10 skipped, 1 failed - `unit-swlogo-295` reads `docs/brand/` which is outside this worktree's
  sparse checkout (environment, not code). After the merge: `unit-temperature`, `unit-field-unit-2470`, `unit-wall-phone-bar-2401`:
  40 passed.
- After the revert rule: unit `unit-field-unit-2470`, `unit-dark-polish-beds`, `unit-audit30b-shared`, `unit-token-lint`,
  `unit-a11y-polished-lint`, `unit-polish-classic-domus-297`: 44 passed. Browser `pixel-sw-field` + `layout-dropdown-fit` (desktop +
  mobile, dev server): 6 passed, 6 skipped (screenshots without a win32 baseline).
- Browser, desktop, Vite dev server of this worktree (`--workers=1`): 12 evidence specs that `selectOption` on hooks this row wrapped
  (tickets handlers / vendor accounts, calendars manage / connect, maintenance, generator, electricity meters, schedules editor,
  mapping assistant, insights, area row, automations builder): 186 passed, 10 skipped, 10 failed - all 10 page-load timeouts at 60 s
  while the PC was saturated; rerun alone with `--timeout=180000`: 16 passed. Net: 0 failures.
- New `tests/evidence-sw-field-flow-2480.spec.ts` (desktop + mobile): a partially skinned and an unskinned select, inside and outside
  `<sw-field flow>`, compute the same box and look at rest, focused and disabled in all five skins; the select keeps its label, its
  value and its change event; the host is `display: contents`. 12 passed. Against the base dev server (no `flow`) the same spec fails
  (box-shadow / colour / height differ) - it catches the change it guards.
- Before / after measurement (comparison harness outside the repo, two dev servers on the PC: base 092bbc9a1 and this branch):
  43 routes x desktop + mobile in demo data, every select in the page through the shadow roots - box, font, padding, border, radius,
  background, colour, shadow, min height: 44 selects compared, 0 differences (16 of them moved into the field by this row on those
  routes). Viewport screenshots: 53 of 86 identical to the pixel; the other 33 differ only in live clocks, demo timestamps and one base
  shot taken before the list loaded (checked by eye).

## NOT_RUN

- Runner pixel pass (every spec with a Linux baseline, without `-u`) and the runner evidence pass: queued at 09:16, held while the
  2.47.0 release gate ran, then cancelled on the lead's instruction (runner overloaded, start nothing). Ready to run:
  `~/work/nselb-px.sh head <sha> 4491` and `OUTSFX=ev PROJ=--project=desktop ~/work/nselb-run.sh head <sha> 4492 $(cat ~/work/nselb-ev.txt)`.
- Tablet project; dark scheme in the before / after measurement (the new spec covers the skins in light only).
- No baseline was refreshed (none should change).
