# A11Y-POLISHED-2342 - accessibility pass over the screens polished on 31.10 / 01.11

Branch `fix/A11Y-POLISHED-2342`, cut from `origin/release/2340-train` (24e128583, 2.34.0). No version bump, no backend change, not
merged. Owner-approved task (01.11). Scope: keyboard and screen-reader use, focus, names, roles and live regions, headings, touch
targets, reduced motion, light-mode text contrast and RTL order on the screens of the `*-POLISH-2331` round, SHARED-POLISH-2342,
OWNER-R12-2341, POLISH-LEFTOVERS-2341, SETTINGS-TABS-SCROLL-2331 (sw-tabs), SWITCH-LIGHT-DIMMER-2331 (floor lights popup),
TREE-HIDE-UNASSIGNED-2331 (tree menu) and NVR-H264-BULK-2341 (H.264 / bulk dialogs). Dark-mode colours belong to the parallel
branch `fix/DARK-REVIEW-2342`; this branch changes the light side only where both share a line (see "Coordination").

Method: a source scan of the ~100 files those changes touched (icon-only buttons, clickable non-controls, unnamed fields, dialogs and
menus without Escape, tablists without arrow keys, hard-coded animations, feedback without a live region, bare state colours on text),
a read of each hit, then the token model (`design/contrast.ts`) for the light contrast of every skin.

## Shared fixes

| Piece | Finding | Fix |
|---|---|---|
| `components/sw-popover.ts` (the floor-map card) | No key handling of its own: Escape worked only where the host screen listened, and focus inside the card was lost when it closed | Escape inside the card (not inside a text field) closes it; the key stops there so a host does not act twice; focus returns to where it came from (`focusin` relatedTarget). Escape with focus on the map is still the map's (it refocuses the pin) |
| `components/sw-dialog.ts` | Every open dialog listens on the window, so one Escape closed a confirmation AND the dialog under it | A stack of open dialogs: only the top one answers Escape |
| `components/sw-field.ts` | The `<label>` is in the shadow root and the control is slotted, so they were never associated: every field-wrapped input / select / textarea had no accessible name (product-wide) | The field sets `aria-label` from its label on its slotted controls, unless the screen named them itself; its own name follows label changes |
| `components/a11y-keys.ts` (new) | Hand-written tablists and sheets re-implemented keys, or had none | `tablistKeydown` (arrows / Home / End, RTL-aware; manual activation, a roving strip selects) and `modalKeydown` (Escape + Tab trap through shadow roots) |
| `design/skins/bubble.ts` | `--sw-warning-text` (light) 4.45:1 on the warning wash over the card | `#9a4a06` -> `#944705` (4.72:1); dark unchanged |

## Per-screen findings

| Screen / part | Finding | Fix |
|---|---|---|
| Automations segments (`devices-automations.ts`), schedules segments (`devices-schedules.ts`), calendar provider tabs (`system-calendar-sync.ts`), calendar settings tabs (`system-calendars.ts`) | `role="tablist"` rows without arrow keys | `@keydown=${tablistKeydown}` |
| New schedule dialog (`schedule-create-dialog.ts`) | Roving tabindex (the unselected tab is `tabindex=-1`) and no arrow keys: the "quick create" tab could not be reached by keyboard | `tablistKeydown` (selects on arrow in a roving strip) |
| Home, phone tree sheet (`devices-building.ts`) | `role="dialog" aria-modal` sheet with no Escape, no focus move, no trap, no focus return | Focus moves to the sheet's close button on open; Escape closes; Tab wraps; focus returns to the tree button after a keyboard close (left alone after a tap, as the quick-control sheet does) |
| Tree "unassigned" menu (`tree-unassigned.ts`) | Escape closed the menu but focus fell to the page (the focused item disappeared); a keyboard open left focus on the button | Escape returns focus to the "⋯" button; a keyboard open (click with `detail 0`) focuses the menu item |
| Quick-control sheet / floor lights popup (`area-quick-sheet.ts`) | Focus returned only after Escape; Enter on the close button counted as a pointer close, so focus was lost. The load error had no live role | A keyboard press on the close button is a keyboard close (focus returns to the opener); the error line is `role="alert"`. Verified by reading: dialog role, focus in, trap, Escape, reduced motion (owner's design in SWITCH-LIGHT-DIMMER-2331) |
| Floors (`explore-floors.ts`), bulk actions (`devices-bulk.ts`), floor map (`explore-floor-map.ts`), insights settings (`insights-settings.ts`), cases (`investigate-cases.ts`), event detail (`investigate-event-detail.ts`), events (`investigate-events.ts`) | Save results and errors appeared silently for a screen reader | `role="alert"` on errors, `role="status"` on saved / done lines (the delivery note picks by tone) |
| Weather source selects (`home-edit-panel.ts`), door / lock pair selects (`insights-settings.ts`), cast settings (`system-cast.ts`), area assignment (`devices-area.ts`) | Controls with a visible caption that was not their label | `aria-label` with the caption text |
| Elevators settings, emergency contacts (outside the polished set; found by the app-wide lint) | Icon-only remove / edit buttons without a name | `aria-label` + `title` (new i18n key `cEdit`) |
| 45 text rules on 21 polished files (NVR connection form, area chips, bulk, controls, layout editor, floor map, floors, home widgets, cases, event detail, schedule table, access, cast, local users, players, presence places, cameras, privacy masks, cross-section options) | Text coloured with a bare state colour. Light-scheme contrast on the surface: success 2.2-3.4, warning 1.7-3.7, danger 2.9-4.6, accent 3.9-5.7 (bubble / soft below 4.5) | `var(--sw-<state>)` -> `var(--sw-<state>-text)` on text (icons, glyphs, rings keep the bare colour, listed with the reason in the lint) |
| From the dark review's light list: unchecked NVR checkbox edge (`nvr-camera-batch.ts`, `nvr-encoding-batch.ts`) | 1.3-2.0:1 in light (a checkbox boundary needs 3:1) | `.sel:not([aria-checked='true']) .box { border-color: light-dark(var(--sw-text-3), <the dark branch's value>) }` (>= 4.9:1) |
| Insights KPI dot (`insights/styles.ts`) | 1.75-2.97:1 in light | Light draws the dot in the state's text ink (`--c-ink`, >= 5:1); dark keeps the state colour |
| Plan studio default-position star (`plan-studio6-panel.ts`) | `--sw-warning` on white 2.0-2.15:1 | `light-dark(var(--sw-warning-text), var(--sw-warning))` |
| NVR batch "unknown" row text (`nvr-camera-batch.ts`) | 4.29:1 classic, 4.27 bubble (warning ink on the 12 % warning row) | Light mixes 25 % body ink in (>= 5.4:1); dark unchanged |
| Tickets settings / RFQ failure toast icon (`system-tickets.ts`, `tickets-rfqs.ts`) | Bare `--sw-danger` on the toast pill 2.8-3.0:1 (domus, tesla) | The shared recipe of `styles/media-page.ts` (`color-mix(danger 70 %, toast text)`, >= 4.3 light / >= 3.3 dark) |

## Checked, no change

- **Icon-only buttons:** every icon-only `sw-button` in the app has a label (now linted). Native icon-only buttons: two outside the set (fixed above); `system-look.ts` swatch buttons are `aria-hidden` + `tabindex=-1` on purpose.
- **Clickable rows:** sw-table rows are keyboard rows where `focusRows` is set; the water tables carry a real link in the first cell; the alerts, meters and notices rows have `tabindex` + key handlers; the schedule table's inputs and buttons are all reachable (row selection by click is an extra). sw-tabs' scroll arrows are `aria-hidden` mouse aids (the tabs scroll into view on focus and walk with the arrows).
- **Dialogs:** sw-dialog / sw-drawer / sw-sheet / the quick-control sheet already trap Tab, close on Escape and return focus; the H.264 and bulk-encoding dialogs use sw-dialog and give status / alert roles to counts and results.
- **Reduced motion:** every hard-coded animation in the set (spinners, shimmer, pulse, blink, the cross-section fades) is guarded by a local `prefers-reduced-motion` block or runs on the motion tokens that `design/css.ts` zeroes.
- **Headings:** screens get their `h1` from `sw-page` / `sr-heading`; sub-panels use h2 / h3 in order. No change.
- **RTL order:** the arrow keys of the new tablist helper follow the direction (ArrowLeft is "next" in RTL); DOM order matches the visual order in the screens read.
- **Light tokens:** every state's `*-text` ink >= 4.5:1 on its own soft fill and on the surface in every skin (after the bubble fix) - now a unit test.

## Not fixed - for the owner

1. **Touch targets of the shared button:** on a phone `sw-button size="sm"` is 36 px and the default 40 px (44 px is WCAG 2.5.5). An invisible 44 px hit layer was tried and reverted: an absolutely positioned layer paints above non-positioned neighbours and would steal their edges (the 44 px cross probe of `layout-a11y-295` counts that as a miss). Growing the buttons is a visual change across every phone screen and its baselines - a product decision. The polished screens' own controls (tree menu, tiles, view switch, H.264 dialog rows) already reach 44 px.
2. **sw-tabs** is a row of `aria-pressed` buttons, not a `tablist`; it is keyboard-complete (arrows, Home / End). Turning it into tabs would change its contract for every screen; left as is.

## Coordination with fix/DARK-REVIEW-2342

The NVR checkbox-edge rule is the SAME rule that branch adds (same selector, same dark side, a different light side). When both
reach a train the two additions conflict at the same place in `nvr-camera-batch.ts` and `nvr-encoding-batch.ts`: keep this
branch's version (its dark side is identical). No other line is shared; the three opacity lines that branch changed were not touched.

## Tests

- `tests/unit-a11y-polished-lint.spec.ts` (new, node-only): icon-only `sw-button` / `<button>` names app-wide; tablist keys and no
  bare state colour on text in the polished files; the shared contracts above; light state inks >= 4.5:1 in every skin.
- `tests/a11y-polished-2342.spec.ts` (new, browser, style guide mount): stacked-dialog Escape, sw-popover Escape + focus return,
  sw-field naming.
- `tests/a11y-dialog-focus-2310.spec.ts`, `tests/layout-a11y-295.spec.ts`: existing browser a11y specs, re-run on the runner.

Baselines likely affected (light only): `pixel-nvr-encoding-batch` / the H.264 dialog (unchecked box edge), insights KPI tiles (dot),
screens whose error / ok lines changed ink (small text colour shifts, mostly classic / bubble / soft), the bubble skin anywhere it
shows warning text.

## Results (2026-11-01)

- `tsc --noEmit`: clean.
- Unit (node-only, `--workers=1`): the new lint 6/6; every unit spec that names a touched file (57 files) **445 passed, 0 failed**
  (includes `unit-token-lint`, `unit-menu-lint`, `unit-muted-contrast`, `unit-dark-muted-contrast`, `unit-design-tokens`).
- `scripts/gate/lint_spec_waits.py` on the two new specs: 0 findings.
- Runner (`run_smart.py preview`, desktop / tablet / mobile, workers 1):
  - `a11y-polished-2342.spec.ts`: **9 passed** (3 tests x 3 projects; the first run failed the popover test on a test-timing bug -
    the button was focused before the card had rendered its slot - fixed in the spec);
  - `a11y-dialog-focus-2310.spec.ts` + `layout-a11y-295.spec.ts`: 22 passed, 10 skipped (project-scoped), 1 failed - `layout-a11y-295`
    "tickets list: skeleton height vs the median card" on desktop (0.136 > 0.12). **Pre-existing:** the same test fails the same way
    on `release/2340-train` without this branch (skeleton 209 px, median card 241 px in both runs) - the demo tickets' mix decides
    the median. Not caused by this change; for the train owner.
- NOT_RUN: pixel baselines (the light ink changes above will move some; to refresh on the runner before a train, per the baseline
  rule); a full axe sweep (no axe dependency in the repo).
