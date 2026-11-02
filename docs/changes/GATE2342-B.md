# GATE2342-B - release gate 2.34.2, group B (plan editor, camera card, tickets table, cross-section / synoptic)

Branch `fix/GATE2342-B` from `origin/release/2342-train` @ `c9e03747c` (2.34.2). Not merged into the train; no version bump.
Gate report: `~/smplwise-results/gate_release-2342-train_c9e03747c.{md,json,gate2.md}` and its `.logs/` on the runner.

## 1. Plan editor: evidence-curve-points :113 (+ the serial group), evidence-curved-walls :108, evidence-architect-request :196

Failure: `explore-plan-editor sw-plan-canvas` / `[data-wall]` count 0 (fixture), `explore-plan-editor sw-state-panel` not found
(demo, floor f-2 has no plan). The plan import screen on the same addresses passed.

Root cause (PERF-HOME-DEVICES-2342): the shell rendered each route screen's tag before its lazy chunk landed; the element was then
upgraded in place when the chunk arrived. Lit keeps the properties set on an unupgraded element (`.floorId=${...}`) and gives them back
only at the element's first update - after `connectedCallback`. `explore-plan-editor` starts `load()` in `connectedCallback` and reads
`this.floorId || 'f0'`, so every editor address opened floor `f0`: in the demo the floor with a plan (no empty panel for f-2), on the
fixture backend a floor that does not exist (an error panel, no canvas). The same root cause explains the ST7 editor specs
(`evidence-st7-ui`, `layout-st7-ui`, owned by another group) - they wait for the editor of a fixture floor.

Fix (product, `frontend/src/shell/lazy-screens.ts`, `frontend/src/shell/sw-app.ts`): `renderScreen()` asks
`waitingScreenTags(renderRoute())` for the lazy screen tags of the route template whose chunk has not landed (it reads the Lit
template's strings and nested values, `keyed()` included), starts them and draws nothing in their place until they land - the
unupgraded element drew nothing either. The element is then created after its definition, with its properties set before it is
connected, exactly as when every screen was in the entry chunk; this covers every lazy screen, not only the editor.
`loadScreen()` now attaches a caller to a fetch already in flight (the home screen's background warm-up of `devices-area`), counts
it for `data-shell-ready`, never waits again for a chunk that landed, and retries a failed fetch after 3 s (not in a tight render
loop). `loadPendingScreens()` stays as the safety net. Unit: `tests/unit-perf-home-devices.spec.ts` (2 new tests).

## 2. Tickets table: layout-tickets-table :54 (4 skins) and evidence-tickets-table :83

- layout guard: `[clipped] span "פתוחה 20 ימים 2 ש׳" - text cut by td.c-created` on the `dense` screen (12 columns incl. created).
  Root cause (SMALL-UI-BUGS-2343): fixed column widths; `created` got 104 px and the running clock (`<ticket-elapsed>`, its own
  shadow root) was cut mid-word without an ellipsis. Fix (product): `created` 148 px (`tickets/table-model.ts COLUMN_WIDTH_PX`), and
  `td.c-created { --sw-elapsed-wrap: normal }` (`tickets/table-styles.ts`) so a still longer clock wraps instead of being cut.
  `created` is not a default column: the default set and its 1280 / 1440 budget are unchanged.
- column chooser: after "איפוס" `th[data-col="department"]` was expected back. Root cause: SMALL-UI-BUGS-2343 intends the default set to
  step the department column aside at 1440 while the sentence column (on by default) is shown - its unit spec asserts "the sentence
  column counts in the budget" (`fitColumns(DEFAULT, cardWidth(1440), true, ['sentence'])` drops a column) - and "איפוס" returns to
  that fitted set. The spec was stale: the hide / reset round trip now uses the handler column (never fitted away) and also checks
  that the added `sla` column is gone after the reset. Test change only.
- For the owner: the SMALL-UI-BUGS-2343 change doc says the default set is "whole at 1440"; that holds only with the sentence column
  off. With it on (the default) the department column is hidden at 1440 and the chooser says so. If department should stay at 1440,
  the widths (sentence 260 px, place 156 px, ...) need trimming by about 110 px - a design decision, not made here.

## 3. Cross-section and synoptic: evidence-xsection-synoptic :96 (3 projects), evidence-syn-columns-2321 :102 (desktop, tablet)

Root cause: both read the DOM (`[data-floor-card]` count, `[data-syn-col]` heads) right after `goto` + `reload` with no wait.
PERF-HOME-DEVICES-2342 makes the floors and synoptic screens lazy chunks that land after the load event (intended), so the read saw
an empty page (0 cards, `[]`). Test change only: wait for the first floor card / the board before reading.

## 4. Camera card: evidence-camera-card :279 (mobile) and the serial group after it

Failure: three cards (c1 main, c2 sub, c3 auto) - 2 streams instead of 3 on the phone; the serial group stopped behind it.

Root cause, measured on the runner with a temporary diagnostic run on both 2.34.1 (`v2.34.1` + the diagnostic) and this branch, phone
390 x 844: the three cards stack; each card asks for a stream when it is within its own height of the scroller
(`devices-camera-card observe()`: root = `<main>`, 0-781 px, rootMargin = the card height, 120 px - reach to 901 px). On 2.34.1 the
third card's top was at 900 px (in reach by 1 px); on 2.34.2 at 908 px (out of reach): PHONE-BUTTONS-44-2342 draws the area
header's buttons 44 px instead of 36 / 40 (owner answer 2A), 8 px more above the cards. The card follows its rule correctly; the
spec depended on a 1 px edge. Test change only: on the phone the spec scrolls the third card into view before it counts (after the
open and the reload). No product change. (The first runner run of the unchanged spec on this branch saw 0 streams once; the
diagnostic runs and the final run did not repeat it - see Tests.)

## Tests

Workstation (`--workers=1`): `npx tsc --noEmit -p .` PASS; unit `unit-perf-home-devices`, `unit-small-ui-bugs-2343`,
`unit-tickets-table` - 28 passed; `unit-token-lint`, `unit-uxfix-rtl`, `unit-fleet-report`, `unit-messaging-accounts`,
`unit-lead-reserve` - 42 passed.

Runner (`private/runner/run_smart.py ... --workers=1`, desktop / tablet / mobile projects), at `05fe94f71` / `164a6c1a7`:

| Run | Specs | Result |
|---|---|---|
| fixture | `evidence-camera-card` | 15 passed, 9 skipped (tablet / desktop-only by design), 0 failed |
| fixture | `evidence-curve-points`, `evidence-curved-walls` | 13 passed, 13 skipped (phone: editor is desktop only), 0 failed |
| preview | `evidence-tickets-table`, `evidence-xsection-synoptic`, `evidence-syn-columns-2321`, `evidence-architect-request` | 114 passed, 72 skipped, 0 failed |
| preview | `layout-tickets-table` (4 skins x light / dark x 10 widths) | 4 passed (findings 0, page errors 0), 8 skipped (desktop runs the sweep) |
| preview (cross-check) | `evidence-st7-ui` (another group's spec, same editor root cause), `evidence-small-ui-bugs-2343`, `perf-home-load` | 34 passed, 11 skipped, 0 failed |

Earlier runs on this branch, for the record: the first fixture run (before the camera spec change) had `evidence-camera-card :279`
[mobile] red with 0 streams (the gate saw 2); the two diagnostic runs that followed saw 2 (the third card out of reach, section 4).

NOT_RUN: the full gate; `layout-st7-ui`, `evidence-shell`, `a11y-polished-2342`, `evidence-calendars-settings-2310`,
`evidence-protected-switches`, `evidence-media-player-panel` (other groups); every pixel spec (the baseline group). The shell change
(section 1) touches every lazy route screen, so the train's next gate is its real coverage.

## Files

- `frontend/src/shell/lazy-screens.ts`, `frontend/src/shell/sw-app.ts`, `frontend/tests/unit-perf-home-devices.spec.ts`
- `frontend/src/tickets/table-model.ts`, `frontend/src/tickets/table-styles.ts`
- `frontend/tests/evidence-xsection-synoptic.spec.ts`, `frontend/tests/evidence-syn-columns-2321.spec.ts`,
  `frontend/tests/evidence-tickets-table.spec.ts`, `frontend/tests/evidence-camera-card.spec.ts`

Pixel / layout baselines possibly affected: tickets table shots that show the `created` column (now 148 px).
