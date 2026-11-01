# INSIGHTS-POLISH-2331 - insights and infrastructure reports polish (wave 3)

Branch `pilot/INSIGHTS-POLISH-2331` from `origin/main` @ 52a8d9129. No version bump, no merge.

Scope: `screens/insights-doors.ts`, `insights-waste.ts`, `insights-settings.ts`, `system-fleet-report.ts`, `infra-water.ts`,
`infra-report.ts`, `infra-electricity.ts`, `infra-generator.ts`, and the insight module's own stylesheet and helper
(`insights/styles.ts`, `insights/chrome.ts`). Reference language: `infra-elevators.ts` / `infra-temperature.ts`
(POLISH-CONTROL-297, R5-MEDIA-ENERGY-297), the R5-SYSTEM-297 settings screens. Skills applied: impeccable (polish / harden),
emil-design-eng (press feedback, hover gating, token durations), ui-ux-pro-max (data-dense tables: touch targets, focus, tabular numbers).
Not touched: shared tokens and components (`design/*`, `sw-*`), the shell and system navigation, `screens/water/page-*.ts`,
`screens/electricity/*`, the generator pages (`generator/*`).

## Critique (before - `docs/evidence/INSIGHTS-POLISH-2331/before/`, desktop 1920 / 1440, tablet 1180 / 1024, phone 390 light + dark)

### Doors, energy consumption (waste), building report (shared frame `insights/styles.ts`)
1. Counters were white cards with an outline and a shadow - the same tier as the content cards - with a 20 px number. The polished
   infrastructure screens use a surface-3 well, a hero number (display size, heavy, tabular) and a filled status field when a problem
   counter is not zero. The insight tiles read as a second visual language.
2. Type and radii were literals (15 px headings, 12.5 / 11 / 12 / 13 / 14 px text, 6 / 4 px radii) - outside the type and radius scales
   (the module sits outside the lint's folders, so the drift was never caught).
3. No press feedback anywhere (tiles, buttons, segments, chips, month arrows); hover states fired on touch (row hover, button hover).
4. The expandable door rows had no visible keyboard focus and nothing said a row opens (no chevron).
5. Touch targets: the range segment and month arrows were 34 px, buttons ~34 px, chips 30 px, the pair remove button 36 px with a bare
   "×" glyph, checkbox labels ~20 px - under 44 px on tablet and phone.
6. Phone 390: the range segment and the place picker sat side by side and wrapped unevenly; the download button floated.
7. Night chart (waste): the day labels were spread across the full width (`space-around`) while the bars sat at one edge - the labels
   did not line up with their bars.
8. Empty / error states: a bare grey glyph; success / danger tints were inline styles. Loading was a flat pulse, not the shimmer the
   other screens use.
9. Doors "no doors configured" sat outside any card (floating text on the page background).
10. Settings: inputs had no focus style of their own, native checkboxes in the browser's blue, pair rows clickable by mouse only, the
    error state had no explanation line, save failures were not announced (no role), the loading state was one grey block.

### Fleet (health) report
11. Already on the settings stylesheet and in good shape. Small gaps: the JSON body used a `font: 12px` literal, the readiness link and
    the exact-body summary were below 44 px on touch, hover underline fired on touch, the loading state was three grey lines (not the
    page's shape).

### Infrastructure shells (electricity, water, generator)
12. The shells are thin (tab rows + page mount). Water / electricity: a lone state panel (error, off, forbidden) hugged the start edge
    of the page. Generator: in "no generator found" the two cards touched (no gap); the generators' count beside the picker was a bare
    digit; the loading skeleton used fixed 320 px widths (overflow risk on a phone).

### Control-screen scroll rule
The doors / waste / report screens are reports (documents) and keep the page scroll; the places tree stays sticky beside the list.
Settings › insights already flows in two columns from 1180 px. No new scrolling was introduced.

## Changes (after - `docs/evidence/INSIGHTS-POLISH-2331/after/`)

`insights/styles.ts` (rewritten on tokens only):
- Counters: surface-3 well, no outline / shadow, 20 px mark with a ring, `--sw-fs-4xl` heavy tabular number, two-line label; a filter
  tile that reports a problem and is not zero becomes a filled status field (`data-nz`, set by `insights/chrome.ts` `kpi()`); a chosen
  filter is framed in its colour. The report's figures (with a unit) are one step down (`.kpis.figs`).
- Every pressable thing answers the press (transform only, token durations, zero under reduced motion); hover only for fine pointers.
- Range / language segments are one pill track with the chosen segment raised; month arrows are round 32 px targets in the same track.
- Tables: header band on list cards, door rows show a chevron that turns when the row opens, keyboard focus ring on rows, pressed wash.
- All font sizes / radii from the scales; inputs get a focus ring; checkboxes take the accent colour at 18 px.
- Touch layouts (<= 1100 px): buttons, inputs, checkbox rows 44 px; segments / month arrows / chips 40 px; roomier rows.
- Phone (<= 600 px): counters two per row with a smaller number; the toolbar stacks - the place picker and the range segment full width,
  the month track full width, the download button full width.
- Empty / error marks sit in a soft disc (success / danger variants by class, no inline colours); the skeleton shimmers.
- Night chart day labels sit under their bars.

Screens:
- `insights-doors.ts`: chevron column on the openable rows; "no doors configured" inside a card with a primary "to settings"; classes
  instead of inline colours; the "more items" line separated by a rule.
- `insights-waste.ts`: legend swatches and the chart head as classes (no inline styles); the content stack as a class.
- `infra-report.ts`: figures row marked `figs`; month arrows `chevronBack` / `chevron` (mirrored by the icon in RTL, same as before);
  the PDF failure card is announced (`role="alert"`); skeleton widths clamp on a phone.
- `insights-settings.ts`: the pair remove button is a trash icon with a title; pair rows are keyboard-openable (Enter / Space);
  the recipients and exit-input lists are tinted scroll boxes; the save button carries a check icon and `aria-busy`; the save note is
  announced (`status` / `alert`); the error state explains and offers a retry (`data-retry`); the loading state draws the page's shape.
- `system-fleet-report.ts`: JSON body on the type scale; the readiness link a real target (32 px, 44 px on touch) with hover gated;
  exact-body summary and the silence input 44 px on touch; the loading state draws the answer card and the three folded cards.
- `infra-generator.ts`: shaped skeleton without fixed widths; gap between the "not found" cards; the generators' count as a quiet
  counter.
- `infra-water.ts`, `infra-electricity.ts`: no change. A `margin-inline: auto` on the lone state panel was tried and had no visible
  effect (the panel's tile is aligned inside its own shadow root), so it was dropped - see the proposal below.

Tests: `tests/evidence-insights.spec.ts` `shots` now covers all four insight screens at 1920 / 1440 / 1180 / 1024 / 390 (light) and 390
dark; new `tests/evidence-insights-polish-2331.spec.ts` (env-gated `SW_SHOTS_DIR`) shoots the generator (live, none), electricity,
water and fleet screens at the five widths.

## Proposals (shared code - not changed here)
- A sticky save bar for long settings forms on a phone (the "שמירה" button scrolls away on Settings › insights at 390 px). It needs
  a shared pattern (sw-page / settings stylesheet) so every settings section behaves the same.
- `sw-state-panel`: centre its tile horizontally inside the host (today the error / off / forbidden tile of the water and electricity
  shells sits against the start edge of an otherwise empty page at desktop widths).

## Pixel baselines likely affected
Any baseline that captures: `#/tickets/reports/building`, `#/tickets/reports/doors`, `#/tickets/reports/waste`,
`#/system/infra/insights`, `#/system/fleet-report` (loading state only), `#/infra/generator/*` (loading / not-found / picker count),
The UI branch must refresh these on the runner
before joining a train (owner rule 30.10).

## Tests (local workstation, shared by up to 16 agents)
- `npx tsc --noEmit`: PASS (exit 0), on the final source.
- Unit, `--workers=1`: unit-token-lint, unit-lead-reserve, unit-uxfix-rtl, unit-insights, unit-fleet-report, unit-water-nav -
  51 passed / 0 failed (run on the commit's styles before the no-op shell CSS was dropped); the three gating lint specs re-run on the final
  source (result in the agent report).
- Screenshots: `shots` (evidence-insights) and `evidence-insights-polish-2331` against a `vite preview` of the before build (52a8d9129) and
  of the after build, port 4212 - 2 passed each; images in `docs/evidence/INSIGHTS-POLISH-2331/before` and `/after`.
- Evidence behaviour specs (evidence-insights, evidence-fleet-report, evidence-generator; desktop / tablet / mobile): BLOCKED / NOT_RUN.
  A started run was stopped on the coordinator's out-of-memory order: 9 passed, 12 failed with "Target crashed" / "worker process exited
  unexpectedly" (workstation memory, not assertions), 93 did not run. They run on the runner gate.

## What is left
- The evidence behaviour specs on the runner (all three projects), and the pixel baselines listed above refreshed on the runner.
- The two proposals above (sticky save bar on a phone; centred state-panel tile) for the owners of the shared code.
