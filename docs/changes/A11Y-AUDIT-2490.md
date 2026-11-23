# A11Y-AUDIT-2490 - accessibility sweep of every main route (report step) and the first fixes

Branch `pilot/A11Y-AUDIT-2490`, based on `origin/release/2450-train` (521165ad4). Target 2.49.0. Stopped early (usage limit, lead's
instruction 20.11 ~03:30): the sweep and the report are complete; the fixes cover the first batch only. What remains is listed below.

## The sweep (a report, not a gate)

- `frontend/tests/a11y-sweep-2490.spec.ts`: every main route of the navigation tables (`src/shell/nav.ts`: the rail areas, every tab
  row and second-level page row, the calendars views, `#/home`) - 108 routes - opened on demo data (no backend; the tickets routes on
  `tests/tickets-mocks.ts`), desktop 1440 and phone 390, each scheme loaded by `?scheme=` (flipping `data-theme` on a loaded page leaves
  skin rules of the other scheme in force - it produced 1.1:1 false contrast findings in the first run, see below). axe-core runs over
  the whole document including open shadow roots (tags wcag2a/aa, wcag21a/aa, wcag22aa, best-practice); only critical / serious
  findings are kept. On the phone a 44 px touch-target probe runs too (the hit-cross method of `layout-a11y-295`: an invisible ring
  counts; controls of the first screen only; one-side misses are usually a neighbour 1-2 px too close).
  Skipped unless `SW_A11Y_SWEEP=1`, so the release gate's full runs do not pay for it (~50 min at `--workers=1` on the PC).
- `frontend/scripts/a11y-report.mjs`: groups `test-results/a11y-sweep/*.jsonl` by rule and by module (the source folder of the
  innermost custom element that draws the node, from its `@customElement` tag); always exits 0. `npm run report:a11y` runs the sweep
  and the report; `SW_A11Y_ROUTES=<substr,...>` re-checks some routes, `SW_A11Y_SCHEMES=light|dark` one scheme.
  `npm run a11y:test` = `node --test scripts/a11y-report.test.mjs` (the grouping, fake rows).
- New devDependency `axe-core` **4.14.0** (pinned exact, published 2026-10-05, MPL-2.0, no dependencies). The lockfile change is the
  package entry only (+11 lines, `npm install --package-lock-only`). The PC's shared `node_modules` was not touched: locally the spec
  read the same pinned version from a packed copy (`SW_AXE_PATH`); the runner gets it from `npm ci`.

## Baseline (before any fix) - 432 rows, 108 routes x desktop/phone x light/dark, 0 load errors

Full JSON: `docs/changes/A11Y-AUDIT-2490-baseline.json` (light rows from the first run, dark rows from the `?scheme=dark` re-run).
Counts are nodes (summed over page views) / page views.

| Rule | Impact | Nodes | Page views | Where (module) | Verdict |
|---|---|---|---|---|---|
| aria-allowed-attr | critical | 552 | 47 | sw-segmented (radio keys carry `aria-pressed`), system-notifications, system-brand-colors | real |
| button-name | critical | 16 | 4 | investigate-rules (demo toggle `label=""`) | real - FIXED |
| select-name | critical | 12 | 3 | system-diagnostics selects in an `sw-field` with no label (phone) | real - later |
| aria-roles | critical | 4 | 4 | `<sw-home role="מנהל מערכת">` (a user-role property reflected as `role`) | real - home/* (later) |
| label-content-name-mismatch | serious | 655 | 428 | shell user-menu key (avatar initials + name), camera tiles, media cards, sw-card, calendars | mostly heuristic; review |
| touch-target-44 (phone) | serious | 230 | 68 | sw-tabs (112, bottom probe), sw-page-slotted search inputs (31 px), presence, playback, handlers | mixed |
| aria-prohibited-attr | serious | 112 | 4 | system-notifications icon-only "Companion" chip (`aria-label` on a span) | real - FIXED |
| color-contrast | serious | 28 | 11 | playback speed keys + review "new" badge (dark, white on #6ea2ff 2.5:1), readiness badges (light, 3.5 / 3.6:1), cal-view-rooms, off rows of notifications (inactive, exempt) | real except off rows |
| target-size (24 px) | serious | 24 | 10 | devices-building fold-all 22 px; most others "partially obscured" by the phone's fixed bars (artefact) | 1 real - FIXED |
| nested-interactive | serious | 23 | 13 | explore-sites `sw-card role=button` with action buttons, cal-view-approvals `div role=button`, plan svg `role=img` | real |
| scrollable-region-focusable | serious | 6 | 6 | tickets my-numbers phone row; wiskey-people filters (shadow chips - likely false) | 1 FIXED |

## Fixes in this branch (pixel-neutral in the light scheme; see "Pixels")

| Module | Change | Finding |
|---|---|---|
| screens/system-notifications | severity keys: radio semantics only (`aria-checked`, `aria-pressed` dropped; CSS keys on `aria-checked`); the icon-only Companion chip is `role="img"` with its name (`aria-disabled` dropped) | aria-allowed-attr (critical), aria-prohibited-attr |
| screens/investigate-playback | the chosen speed / quality key's text is `--sw-text-inverse` (the ink of an accent fill) | color-contrast (dark) |
| components/frigate-review-card | the "new" badge text is `--sw-text-inverse`, its dot `currentColor` | color-contrast (dark) |
| screens/investigate-rules | the demo rules' switch is named "פעיל · <rule>" (labelHidden), as in the API list | button-name (critical) |
| map/sw-plan-canvas | the plan svg is `role="group"` (it holds focusable rooms / markers; `img` hid them) | nested-interactive |
| tickets/my-numbers | the phone KPI row (scrolls sideways) is focusable, with a focus ring | scrollable-region-focusable |
| screens/devices-building | the fold-all key is 24 px wide with -1 px inline margins (same layout) | target-size |
| screens/explore-presence | refresh / places keys and floor chips: an invisible 44 px hit area on a coarse pointer | touch-target-44 |
| tickets/handlers-members | the 40 px member key: an invisible 44 px hit area on a coarse pointer | touch-target-44 |

Two specs read the old attribute and now read `aria-checked`: `evidence-a11yfix-297.spec.ts`, `evidence-sys-audit-quickfix-2437.spec.ts`.

## Pixels

No baseline refreshed (no runner time: the lead stopped the agents). Expected diffs, to refresh inside the branch before a train:
dark-scheme shots of `#/investigate/playback` (chosen speed key ink) and `#/investigate/reviews` (new badge ink). Light shots should be
unchanged (`--sw-text-inverse` is white in every light skin; the hit areas are invisible; the fold key keeps its 22 px column).

## Left for later (owned by other agents tonight, or larger)

- components/sw-segmented: radio keys carry `aria-pressed` beside `aria-checked` (critical, ~100 nodes on 22 views; the component
  comment says the specs read either - drop `aria-pressed` and move the look to `aria-checked`); phone keys < 44 px wide.
- components/sw-tabs: phone tab links are 44 px tall but the bottom probe lands on the strip below (112 nodes).
- components/sw-field: the system-diagnostics selects have no label (fix in the consumer: `label=` on the sw-field).
- home/*: `sw-home` reflects the user's role into the `role` attribute (invalid ARIA role) - rename the property.
- electricity/*: elec-customers-page phone targets.
- system-readiness badges (light): white on the success / warning fill (3.5 / 3.6:1) -> `--sw-on-success` / `--sw-on-warning`
  (visible change in light shots; needs a baseline refresh).
- system-brand-colors: `aria-pressed` on `<input type="color">`.
- explore-sites (`sw-card role=button` with inner buttons) and cal-view-approvals (`div role=button` with inner buttons): needs a
  card pattern (stretched link / separate actions) - design decision.
- phone search inputs drawn 30-31 px tall in several screens (multimedia-screens, wiskey-overview, tickets-list, devices-schedules,
  tickets-handlers) - height change = visible change.
- label-content-name-mismatch (WCAG 2.5.3): review per component; the shell user-menu key (every page) reads the avatar initials as
  visible text - hide the avatar from the name computation or put the first name first in the label.
- Coverage: modules switched off in the static demo (notices, announce, incidents...) render their "not available" panel; a later run
  should enable them with mocks.

## Tests actually run (PC)

- Baseline sweep: run 1 (both schemes by `data-theme` flip) 216 passed in 50.5 min; its light rows are kept. Run 2 (`?scheme=dark`)
  216 passed. The sweep records, it never fails on a finding.
- Report unit: `node --test scripts/a11y-report.test.mjs` 3 passed, 0 failed.
- ESLint on the nine touched source files: exit 0.
- tsc after the fixes: app (`tsconfig.json`) exit 0, tests (`tsconfig.tests.json`) exit 0, scripts (`tsconfig.scripts.json`) exit 0.
- Targeted re-sweep after the fixes (Vite dev server, `--workers=1`), 10 routes x desktop/phone x light/dark: 20 passed (records).
  Gone: button-name (investigate-rules), color-contrast dark (playback, reviews), aria-allowed-attr + aria-prohibited-attr
  (system-notifications), target-size (devices-building), nested-interactive (explore floor map), scrollable-region-focusable
  (tickets mine, phone), touch-target-44 on the presence keys and the handlers member key. Still there by design of this batch:
  sw-segmented aria-pressed (tickets), sw-tabs phone probe, notifications off-row contrast (inactive, exempt), "partially obscured"
  target-size under the phone's fixed bars (artefact), label-content-name-mismatch.
- Note for re-runs from Git Bash: a `SW_A11Y_ROUTES` value that starts with `/` is rewritten as a Windows path by MSYS; write the
  substrings without the leading slash (`system/notifications`) or run from PowerShell.

NOT_RUN: pixel specs and baseline refresh, the touched modules' evidence specs (evidence-notifications, evidence-a11yfix-297,
evidence-sys-audit-quickfix-2437, layout-a11y-295), the runner entry check, the tablet project.
