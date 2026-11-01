# SHARED-POLISH-2342 - shared-layer proposals of the design-polish round

Branch `pilot/SHARED-POLISH-2342` from `origin/release/2340-train` (95ced89bb, 2.34.0). No version bump, no backend change, no
data hook or behaviour change. Skills: impeccable (polish / harden), emil-design-eng.

The 15 screen branches of the polish round (docs/changes/*-POLISH-2331.md) were not allowed to touch shared code and left their
proposals in their change docs. This branch collects them, dedupes them, and implements the safe, broadly useful ones in the shared
layer. Each screen is switched to the shared version only where the switch is trivial and does not change behaviour.

## Implemented

| Shared piece | File | Source proposal | Screens switched |
|---|---|---|---|
| `.toast.bad .ic`: a failure toast with the icon in the danger ink, mixed toward the toast text so it keeps its contrast on the dark pill | `styles/media-page.ts` | TKSET | system-notifications (class `bad` on the failure toast; the warning icon was already chosen by the same flag); devices-automations and devices-schedules drop their local copies (the schedules copy was a hard-coded `#ff453a`) |
| `sw-state-panel`: the hero box is centred with `margin-inline: auto`. A page sheet that makes the host a block (`.body > * { display: block }` in the water / electricity shells) used to pin the tile to the start edge | `components/sw-state-panel.ts` | INSIGHTS | all panels (no API change). Compact rows are not affected (`.box` is `display: contents`) |
| `sw-dialog fit`: opt-in, the box takes its content's width, between the default 440 px and the xl 1120 px | `components/sw-dialog.ts` | CAMADMIN | none (the camera batch dialog keeps its local list sizing) |
| `sw-table focus-rows`: opt-in, every row is a tab stop, and Enter / Space on the row fires the same `row-select` a click does. Keys on a control inside a cell are left alone. The focus ring sits inside the row | `components/sw-table.ts` | INVREST | none (see Skipped) |
| `techDetailsStyles`: one "פרטים טכניים" disclosure (28 px summary, focus ring, chevron, hover only on a fine pointer, `.techbody` well) | new `styles/tech-details.ts` | INVREST | investigate-events (the data-sources line and the drawer's event block; only `flex: none` stays local); investigate-event-detail (its summary gains the events list's info icon and chevron instead of the browser's triangle; margin and semibold stay local) |
| `settingsKitStyles` (part of `settingsStyles` and exported alone). All rules are opt-in under a `set-` prefix, so no existing class changes meaning | `styles/settings.ts` | see below | see below |
| - `.set-col`: a named inline-size container (`sw-set-col`); below 440 px its `.row`s stack (label above the control) | | SCHED | system-automations, system-schedules: their two identical local `.col { container-type } @container (...)` blocks are replaced by the class. It is still an inline-size container, so the unnamed container queries of children resolve as before |
| - `.set-choices` / `label.set-choice`: radio / checkbox tiles | | TABSMODE | none (system-tabs-mode keeps its `.opt`; it does not use settingsStyles) |
| - `.set-chips label`: a toggle chip whose checkbox stays in the tab order, visually hidden | | LOOK | none (system-wall's chips share one rule with its day chips) |
| - `select.set-select`: the settings select look for a select without `sw-field` | | SCHED | none (the automations `select.sel` is LTR and capped at 260 px, a different control) |
| - `table.set-matrix`: the role x permission table | | SCHED / ACCESS | system-automations role matrix (`class="mtx set-matrix"`; only its foot margin and the link colour stay local) |
| - `.foot.sticky`: a card footer that stays in view on a phone (< 768 px), on the solid surface with shadow 3 | | INSIGHTS | none (see Skipped) |

## Skipped (risky, behavioural, or owner decision) - for the lead

- **Paging row height** (CALMSG C6, management at 1024): the rows-per-page measure uses the tallest row for every row. A cumulative
  measure changes the paging logic shared by the settings tabs and every spec that pages through them. Behavioural, so not done.
- **sw-table focus-rows switched on in screens**: the cases list already has a link in the title cell (two tab stops per row if
  both). Every other table would change its tab order, so the attribute is opt-in and no screen enables it yet.
- **Insights settings sticky save**: the save is in the page head (a lead-reserve head), not in a card footer. Making it sticky
  touches the lead-reserve contract. `.foot.sticky` is ready for a footer-save page.
- **sw-table `hideBelow` column option** (ACCESS): an API addition that changes every phone card layout that adopts it. Kept for a
  wave with its own phone captures.
- **sw-drawer `footer-end` slot** (ACCESS) and **sw-sheet `footer` slot / solid surface** (WKWATER): slot and material changes of
  overlay components used across the app.
- **sw-state-panel `size="inline"` / `bare` variant** (ACCESS, LOOK): a new visual tier. It needs the design owner.
- **sw-page fit-to-window helper** (CAMADMIN) and **media-page region model** (MEDIA 5.1): layout infrastructure, larger than a polish pass.
- **media-player-card edit chips, media-remote scroll padding, media-admin-list pager** (MEDIA 5.2-5.4): component-specific; the
  pager changes the settings page's behaviour.
- **notices `tr.go:hover` gate at the source** (HOMEEDIT 2): the TV mock shares the sheet. Kept with the notices owner.
- **`--sw-well` as a global token** (HOMEEDIT 3): it is a settings-ladder knob on `:host`. Promoting it changes the token table
  (design-system owner).
- **`.tablewrap`, `.yn`, `.seg.wrap`** (SETUPPLAN): only two consumers each, as the proposal itself says ("if a third screen needs them").
- **One settings key style** (LOOK: `settingsSegStyles` vs the pill thumb): an owner choice between two looks.
- **Tabs-mode group x owner matrix, collapsing capsule-only dials** (TABSMODE): DOM / behaviour changes that need an owner yes.
- **Shell / navigation observations** (CALMSG, EVENTS): outside the shared component layer.

## Tests (workstation, 2026-11-01; low memory: no build, preview or Playwright evidence locally)

`npx tsc --noEmit`: exit 0 (on the final source). Unit specs, `--workers=1` (`playwright.unit.config.ts`), 14 files: **83 passed / 0 failed**.

- Gating lints: unit-token-lint, unit-lead-reserve, unit-uxfix-rtl, unit-menu-lint, unit-empty-state-icons.
- Source guards that read the touched files: unit-devices-tiles, unit-hud-opaque, unit-notify-whatsapp,
  unit-polish-classic-domus-297, unit-polish-phone-297, unit-second-factor-admin-ui, unit-uxfix-nav-295, unit-uxrest-295,
  unit-uxrest2-295.

## Evidence for the runner (NOT_RUN locally)

Behaviour / layout specs (desktop, tablet, mobile):

- Events and event page: `evidence-events`, `evidence-events-polish`, `evidence-events-hover`, `evidence-event-detail`,
  `evidence-event-structure`, `evidence-event-windows`.
- Automations / schedules settings and lists: `evidence-automations-list`, `evidence-schedules-list`, `layout-schedules-parity`,
  `layout-visdiff-246`, `evidence-polish2-295`, `evidence-mobile-options`, `shoot-sched-polish-2331`.
- Toasts: `evidence-notifications`, `evidence-automations-builder`, `evidence-schedules-editor`.
- State panels in block hosts: `evidence-wkwater-2331`, `evidence-electricity-meters`, `layout-electricity`,
  `layout-electricity-meters`, `evidence-insights`, `evidence-insights-polish-2331`.

Pixel baselines to refresh on the runner before this branch joins a train (owner rule 30.10):

- `visual-matrix.spec.ts-snapshots`: any state shown by a whole-screen `sw-state-panel` whose host a page sheet makes a block (the
  tile moves from the start edge to the centre). Screens whose host was already a flex box do not change.
- `pixel-access-events.spec.ts-snapshots`, `pixel-access-status.spec.ts-snapshots`: listed because they include
  `sw-state-panel` / settings sheets. No change expected.
- Any capture of the event page with "פרטים טכניים" shown (now an info icon and a chevron instead of the browser triangle).

## Rollback

Revert the branch commits. Nothing in the data, the settings, or the API changes.
