# CR-A11Y-ROWS-2443 - keyboard access to clickable rows and cards (screen half of D14)

Branch `pilot/CR-A11Y-ROWS-2443`, cut from `origin/release/2438-train` at 5bcea468d. Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) row `pilot/CR-A11Y-ROWS-2436` (renumbered 2443), group G4 of
`private/planning/REMAINING_WORK_2026-11-18.md`. No version bump, no backend change, no text change. Pixels: none expected (the
focus ring shows only on keyboard focus - the global `styles/focus-policy.ts` ring, nothing new drawn).

## Finding

06:A11Y-1 / D14: rows and cards that open something on `@click` (`<tr>`, `<div>`, `sw-card`) had no `tabindex`, role or key
handler, so neither a keyboard nor the wall panel's focus navigation could reach them.

## The helper

`frontend/src/components/activate-keys.ts` (new, pure) - `activateKeydown(run)`: Enter or Space pressed **on the element itself**
runs the same action as its click (and Space does not scroll). A key pressed on a control inside the row (a link, a button, a
field) is left to that control; modifiers and auto-repeat are ignored. Re-exported from `components/a11y-keys.ts` (the review's
"existing helper"), which the screens import. Kept in its own file because `a11y-keys.ts` imports `sw-drawer` (a custom element)
and Node units cannot load that.

## Screens (row file list) - what each needed

| Screen | Before | Now |
|---|---|---|
| `system-notices.ts` boards table row | `tabindex="0"` + Enter only, and Enter on the row's own edit / delete buttons **also navigated** to the board | `activateKeydown` (Enter / Space, only on the row itself) - a behaviour fix |
| `system-notices.ts` phone board card | `div` with `@click` only | `tabindex="0" role="link"` + `activateKeydown` |
| `explore-sites.ts` site cards | `sw-card interactive` with `@click` only | `tabindex="0"`, `role="link"` (or `button` when the site has no building: the click opens "new building"), `aria-label` = the site name, `activateKeydown` |
| `explore-sites.ts` building rows | `sw-card` with `@click` only | `tabindex="0" role="link"`, `aria-label`, `activateKeydown` |
| `investigate-incidents.ts` recent table row | `tr` with `@click` only | `tabindex="0"` + `activateKeydown` (table rows keep their row role; the phone cards were already `<button>`s) |
| `schedule-table-view.ts` slot row | `tr` with `@click` (select) only | `tabindex="0"` + `activateKeydown`; the row's inputs / select keep their own keys |
| `water/page-accounts.ts` (accounts, bills), `water/page-customers.ts` | `tr` with `@click` - **but every row already holds `<a class="rowlink" href>` to the same page** | unchanged: the link is the tab stop; a second one on the row would double every Tab (pinned by the unit) |
| `infra-report.ts` | a delegating `div @click` that only reacts to `[data-go]` | unchanged: every `[data-go]` is an `<a href>` (pinned by the unit) |
| `devices-synoptic.ts` lights cell | `span @click` | unchanged: the cell sits **inside** the row's `<button class="srow">`; a tab stop inside a button is nested interactive content. The keyboard path is the row button (selects the floor) and then the floor-lights button of the detail strip (pinned by the unit). This also keeps the file clear of the train's own synoptic changes |

## Tests

Run locally (workstation, PC under load, `--workers=1`):

- `npx tsc --noEmit`: clean (exit 0).
- `npx playwright test -c playwright.unit.config.ts tests/unit-a11y-rows-2443.spec.ts tests/unit-a11y-polished-lint.spec.ts
  tests/unit-home-edit-drawer.spec.ts --workers=1`: **24 passed** (10 new; the other two read `a11y-keys.ts` / these screens).

New:

- `frontend/tests/unit-a11y-rows-2443.spec.ts` (Node): the helper's behaviour (Enter / Space on the element, nothing from an
  inner control, nothing with a modifier or auto-repeat) and a source keyboard pass over the eight screens (every non-native
  element with `@click` carries `tabindex="0"` + `activateKeydown`, or is a stopPropagation wrapper, or is reachable another
  way that the spec pins).
- `frontend/tests/evidence-a11y-rows-2443.spec.ts` (browser, demo data, desktop project): a site card is a tab stop and opens
  its first building on Enter and on Space. **NOT_RUN** - needs a build + preview; the runner is reserved for the 2.43.8 gate.

NOT_RUN: the existing evidence / layout / pixel specs of these screens (`evidence-notices.spec.ts`,
`evidence-mobile-structure.spec.ts`, `evidence-incidents*.spec.ts`, `evidence-schedules-editor.spec.ts`, the water and synoptic
specs). No keyboard pass was added to them: their fixtures could not be run here, and an unrun edit to a live spec would only add
risk to the next gate.
