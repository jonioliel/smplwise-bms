# CR-GLASS-HELPER-2442

Code-review batch 16.11, wave 3B, frontend chain step FE-2. Contract: the `FE-2` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.5 (named there `pilot/CR-GLASS-HELPER-2436`), finding 08:F13.
Base: `origin/pilot/CR-CSS-FRAGMENTS-TAIL-2442` (`94b98a75f`, step FE-1).

Rule of the row: **zero pixel change, zero behaviour change.**

## The finding

`applyAutomationsGlass` - the call every glass screen makes on its host - stood in `api/automations-demo.ts`. So the tickets
elements, the tickets screens and the schedule screens imported the automations demo layer (and through it the automations
adapter) for one styling call, and the API layer imported a screen (`screens/devices-style`).

## What was done

1. **New `frontend/src/styles/glass.ts`** holds `applyAutomationsGlass` - same name, same signature, same body. The one thing
   the body needs from the demo layer is the demo's scheme (`demoControl().scheme`); `glass.ts` reads it itself (`demoScheme()`:
   the same guard `isApi()`, the same `localStorage` key, the same `try / catch`), so that `styles/glass.ts` does not import
   `api/automations-demo.ts` back - that would be an import cycle, because the old path re-exports the helper.
2. **`frontend/src/api/automations-demo.ts`** keeps the name for compatibility: `export { applyAutomationsGlass } from '../styles/glass';`.
   Its imports of `screens/devices-style` and `styles/media-glass` are gone: the API layer no longer imports a screen.
3. **The importers switched by codemod** (a script, not committed: one regular expression over the single-line named import):
   **41 files**. 37 imported only the helper - the line's path changed; 4 imported other names too
   (`automation-drawer`, `devices-automations`, `devices-schedules`, `scenes-panel`) - the helper left that line and got a line of its own.
   No call site changed.

   | Family | Files |
   |---|---|
   | `tickets/` | 23 |
   | `screens/` (tickets 6, automations / schedules / scenes / scripts 7) | 13 |
   | `components/` | 5 |

   The finding counted "44 files overall": that is every file that names the function - the 41 importers, the definition, and
   comments. After this branch no module imports the helper through the old path.
4. **`frontend/tests/unit-glass-helper-2442.spec.ts`** (node-only, 3 tests): the demo key in `glass.ts` equals `DEMO_KEY` of the demo
   layer (the one literal that now stands twice); `glass.ts` does not import the demo layer and the demo layer imports no screen;
   nobody imports the helper through the old path.

Not done, on purpose:

- The name stays `applyAutomationsGlass` although the tickets use it too. A rename touches the 41 call sites as well; the row is the
  move.
- `styles/glass.ts` imports `screens/devices-style` (`applyDevicesScheme`), as `styles/media-glass.ts` already does. Moving the scheme
  machinery out of `screens/` is a different change.
- The re-export stays until open branches that still import the old path have merged; removing it is a one-line follow-up.

## What can differ at run time

Nothing a user can see. One thing in the module graph: a module that imported ONLY the helper no longer pulls `api/automations-demo.ts`
(and `api/automations.ts`) into its chunk. Both have no load-time side effects (constants and functions only), so loading them
later or not at all changes no state; the build's chunk boundaries may move by that much.

## Pixels

No (plan row). No baseline was regenerated, no PNG committed (the evidence run rewrites its PNGs under `docs/design/evidence/`; they
were restored before the commit).

## Tests actually run

All on the workstation (no runner, by the batch rule).

1. **`tsc --noEmit`** (frontend) on the final source tree: exit 0 (run twice).
2. **CSS text of every component, base (`94b98a75f`) against branch** - the FE-1 scripts (`dump.mjs`, `cmp.mjs`, not committed): a Vite
   dev server per tree, a page imports every module of `frontend/src` (1517 on the base, 1518 here - the new file) and dumps the
   `static styles` of every registered element (552) and every exported sheet (141): **693 same, 0 different; raw text changed in
   0 sheets** (before any normalising). 0 module import errors on either side - which also shows that the new import order loads.
3. **Evidence specs of the glass screens** on a `vite build` of the branch, `vite preview` on a private port (4382),
   `--project=desktop --workers=1`: `evidence-automations-list`, `evidence-automations-builder`, `evidence-audit30a-glass-bridge`,
   `evidence-tickets-overview`, `-table`, `-board`, `-drawer`, `-rfq2`, `-costs`, `-calendar`, `-map`, `-handlers`, `-delete`,
   `-create-assign` (14 files): **194 passed, 0 failed, 3 skipped** (32 min). They cover the demo's light / dark scheme switch
   (`sw.demo.automations` -> `scheme`), the path the moved helper reads.
4. **Unit specs** (`playwright.unit.config.ts`, node-only): the new `unit-glass-helper-2442` plus `unit-glass-scheme`,
   `unit-glass-bridge-audit30a`, `unit-glass-wall`, `unit-automations-list`: **45 passed, 0 failed**.

## NOT_RUN

- The pixel gate and the entry check - runner only; this batch pushes without queueing.
- Evidence specs on the tablet and mobile projects; the other evidence / layout / page specs.
- `evidence-audit30c-tickets.spec.ts` (it compares against committed snapshots made on the runner's platform).
- The full unit suite (FE-1 ran it on the base: 4640 passed, 6 failed for reasons recorded in its note); here only the specs listed above.
- `npm run build:addon`, ESLint, the bundle budget, the unused-exports report, the backend suite (no backend file is touched).
- The rendered computed-style comparison of FE-1 (`render.mjs`): not repeated - no CSS text changed in any sheet (check 2).
