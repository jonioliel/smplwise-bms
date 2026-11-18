# CR-STRUCT-CSS-SPLIT-2442

Code-review batch 16.11, wave 3B, frontend chain step FE-3. Contract: the `FE-3` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.5 (named there `pilot/CR-STRUCT-CSS-SPLIT-2436`), finding 06:STRUCT-1 step 1.
Base: `origin/pilot/CR-GLASS-HELPER-2442` (`8d387f7d8`, step FE-2).

Rule of the row: **pure move - same CSS text, same order, same composition of every `static styles` array. Zero pixel change.**

## What was done

For seven screens the expression of `static styles` moved, as it stood, to a new module `frontend/src/screens/<screen>-css.ts`
that exports it under one name; the screen keeps `static styles = <name>;`. Nothing inside the moved CSS was edited - not a
character, not the indentation (the text is the class-level text, so a sheet in the new file is still indented as it was inside
the class).

| Screen | Lines before | Screen after | New `-css.ts` | Export |
|---|---|---|---|---|
| `explore-plan-editor.ts` | 5915 | 5225 | 702 | `explorePlanEditorStyles` |
| `devices-building.ts` | 4330 | 2530 | 1812 | `devicesBuildingStyles` |
| `mapping-assistant.ts` | 1682 | 571 | 1120 | `mappingAssistantStyles` |
| `devices-schedules.ts` | 2090 | 1077 | 1023 | `devicesSchedulesStyles` |
| `home-widgets.ts` | 2094 | 587 | 1524 | `homeWidgetsStyles` |
| `area-quick-sheet.ts` | 2091 | 963 | 1138 | `areaQuickSheetStyles` |
| `live-camera.ts` | 1785 | 1163 | 631 | `liveCameraStyles` |

Details that are part of "pure move":

- **Module-level css constants the arrays name moved with them** (a `-css.ts` that imported them back from its screen would be an
  import cycle): `BUILDING_BUBBLE`, `BUILDING_GLASS`, `TILE_LAYOUT`, `HOME_LAYOUT` (devices-building) and `HOME_EDIT_BAR_STYLES`,
  `HOME_WIDGETS_BUBBLE` (home-widgets), each with its doc comment, in their old order, still not exported. The code that stood
  between them in `devices-building.ts` (the layout / tree-collapse helpers) stays in the screen.
- **Imports.** Each `-css.ts` imports `css` and the sheets its array names from the same modules the screen imported them from
  (`plan-studio-panel`, `home-edit-drawer`, `styles/fragments`, ...). A name the screen no longer uses left the screen's import line;
  a line left with no name was removed (`styles/fragments` in two screens, `styles/bubble-chrome` in two, `styles/automations-glass`,
  `home-screen-css`).
- **Import order.** The screen imports its `-css.ts` as its LAST import, so every module the css module needs was already evaluated
  by the screen's earlier imports, in the old order. The modules whose line left the screen are pure style modules (constants only).
- `mapping-assistant` had a single sheet (`static styles = css...`), not an array: the export is that single sheet.

## Line-range table (old file -> new file)

Old lines are of the base `8d387f7d8`. A branch that edited CSS inside one of these ranges conflicts with this branch on the screen
file: keep this branch's side of the screen (`static styles = <name>;`) and apply the other side's CSS change at
`new line = old line - old start + new start` in the `-css.ts`.

| Screen | What moved | Old file, lines (base `8d387f7d8`) | New file | New lines |
|---|---|---|---|---|
| `explore-plan-editor.ts` | `static styles` expression | 380-1070 | `explore-plan-editor-css.ts` | 12-702 |
| `devices-building.ts` | `BUILDING_BUBBLE` (with its comment) | 296-524 | `devices-building-css.ts` | 12-240 |
| `devices-building.ts` | `BUILDING_GLASS` (with its comment) | 567-763 | `devices-building-css.ts` | 242-438 |
| `devices-building.ts` | `TILE_LAYOUT` (with its comment) | 765-806 | `devices-building-css.ts` | 440-481 |
| `devices-building.ts` | `HOME_LAYOUT` (with its comment) | 808-1183 | `devices-building-css.ts` | 483-858 |
| `devices-building.ts` | `static styles` expression | 2354-3306 | `devices-building-css.ts` | 860-1812 |
| `mapping-assistant.ts` | `static styles` expression | 81-1193 | `mapping-assistant-css.ts` | 8-1120 |
| `devices-schedules.ts` | `static styles` expression | 222-1234 | `devices-schedules-css.ts` | 11-1023 |
| `home-widgets.ts` | `HOME_EDIT_BAR_STYLES` (with its comment) | 40-50 | `home-widgets-css.ts` | 17-27 |
| `home-widgets.ts` | `HOME_WIDGETS_BUBBLE` (with its comment) | 52-158 | `home-widgets-css.ts` | 29-135 |
| `home-widgets.ts` | `static styles` expression | 290-1677 | `home-widgets-css.ts` | 137-1524 |
| `area-quick-sheet.ts` | `static styles` expression | 138-1267 | `area-quick-sheet-css.ts` | 9-1138 |
| `live-camera.ts` | `static styles` expression | 665-1287 | `live-camera-css.ts` | 9-631 |

## Tests and registries that read the source text

Thirteen unit tests read a screen's `.ts` as text and look for a CSS rule in it. The rules are now in the `-css.ts`; the behaviour
is intended and the tests were stale, so they were pointed at the new file - no assertion was weakened or removed:

| File | Change |
|---|---|
| `frontend/src/styles/menu-surface.ts` (a registry only the tests import, not in the bundle) | 5 entries: `devices-schedules.ts` `.acard .pop` and the four `explore-plan-editor.ts` HUD panels now name the `-css.ts` |
| `tests/unit-menu-lint.spec.ts` | `CANVAS_HOST_CSS`: the editor's `-css.ts` counts as a canvas host, so its rules over the canvas are still scanned |
| `tests/unit-token-lint.spec.ts` | `ALLOW_HEX` key `devices-schedules.ts` -> `devices-schedules-css.ts` |
| `tests/unit-a11y-polished-lint.spec.ts` | `POLISHED` also lists the three `-css.ts` (area-quick-sheet, devices-building, devices-schedules); `BARE_OK` key renamed |
| `tests/unit-dark-polish-beds.spec.ts` | 3 `SEG_INVENTORY` rows name the `-css.ts` |
| `tests/unit-polish4-wp6-maps.spec.ts` | `FILES` also lists the editor's `-css.ts`; 2 CSS assertions read it |
| `tests/unit-polish4-wp4-home.spec.ts` | reads `home-widgets.ts` + `home-widgets-css.ts` (it asserts both code and CSS) |
| `tests/unit-a11y-r4-leftovers-2380.spec.ts`, `unit-area-presence-line-2351.spec.ts`, `unit-evidence-cameras-2412.spec.ts` | the CSS assertion reads the `-css.ts` |
| `tests/evidence-audit30i-devices.spec.ts` | the `.rc` rule list names `devices-schedules-css.ts` |

The visual matrix sources (`frontend/tests/visual/`) match by path prefix, so a change in a `-css.ts` still selects its screen.

## Merge conflict hints (open branches, checked with `git merge-tree` on 17.11)

Conflicts on the seven screens that this branch ADDS (the branch edited CSS inside a moved range, or added an import on the last
import line). Resolution: the recipe above the line-range table.

| Open branch | New conflict | Cause |
|---|---|---|
| `DIALOG-DRAWER-ONE-2439`, `CR-MODAL-STACK-2441`, `CR-MODAL-STACK-B-2442`, `CR-CONFIRM-ADOPT-2441` | `mapping-assistant.ts` | the `.sheet` rule changed inside the moved sheet (seen on DIALOG-DRAWER; the other three carry the same file change) |
| `DOMUS-DEFAULT-2439` | `devices-schedules.ts` | CSS inside the moved sheet, and a new import on the last import line (keep both lines) |
| `I18N-EN-SWITCH-2438`, `CR-I18N-CORE-2441` | `devices-schedules.ts` | CSS inside the moved sheet |

Conflicts that exist already against the base `8d387f7d8` (not caused by this branch; the files are among the seven):
`explore-plan-editor.ts` with `DIALOG-DRAWER-ONE-2439`, `CR-WAVE2-COMBINED-2439`, `CR-W2-FOLLOWUPS-2441`, `CR-W3-BE-COMBINED-2441`,
`CR-MODAL-STACK-2441`, `CR-MODAL-STACK-B-2442`, `CR-CONFIRM-ADOPT-2441`; `mapping-assistant.ts` with `DOMUS-DEFAULT-2439` and the
i18n family (`I18N-EN-SWITCH-2438`, `CR-I18N-CORE / CAL-ELEC / MAP-WIZARD / HOME / COMBINED / COMBINED-C`); `devices-building.ts`
with `CR-MODAL-STACK-B-2442`. If such a conflict lies inside a moved range, the same recipe applies.

No conflict on the seven screens, old or new, with `PLAN3D-R32-ANSWERS-2438`, `FE-WAVE2-COMBINED-2440`, `CR-W3-FE-COMBINED-2441`,
`LIVECAM-DRAFT-RESET-2435`.

A branch that ADDS a rule to one of these screens after this merges must add it in the `-css.ts`; a source-reading lint that names
the screen file for a CSS rule must name the `-css.ts`.

## Pixels

No (plan row: same CSS text). No baseline was regenerated, no PNG committed (the evidence and unit runs rewrite PNGs under `docs/`;
they were restored before the commit).

## Tests actually run

All on the workstation (no runner, by the batch rule).

1. **`tsc --noEmit`** (frontend) on the final source tree: exit 0. (An earlier run caught one unused `css` import left in
   `devices-building.ts`; removed.)
2. **CSS text of every component, base (`8d387f7d8`) against branch** - the FE-1 scripts (`dump.mjs`, `cmp.mjs`, not committed): a
   Vite dev server per tree, a page imports every module of `frontend/src` (1518 on the base, 1525 here - the seven new files) and
   dumps the `static styles` of every registered element (552) and every exported sheet: **693 same, 0 with different text; raw
   text changed in 0 sheets** (before any normalising), 0 module import errors on either side. The script also prints 4 "only in
   new" lines: the new exports `areaQuickSheetStyles`, `explorePlanEditorStyles`, `liveCameraStyles`, `mappingAssistantStyles`,
   which have no base twin (their text is compared through their elements). Run after the move and again on the final tree, same
   result.
3. **`vite build`**: exit 0.
4. **Evidence specs of the seven screens** on that build, `vite preview` on a private port (4383), `--project=desktop --workers=1`:
   `evidence-editor`, `evidence-zones`, `evidence-plan-studio-stairs`, `evidence-plan-versions` (plan editor), `evidence-home-295`
   (area quick sheet), `evidence-mapping-assist-2330`, `evidence-schedules-list`, `evidence-audit30i-devices`,
   `evidence-home-screen`, `evidence-bv1-tiles`, `evidence-homeinfo-295` (building, home widgets), `evidence-audit30g-video`,
   `evidence-nvr-record`, `evidence-zones-nvr` (live camera) - 14 files: **112 passed, 0 failed, 34 skipped** (11.7 min).
5. **Unit specs** (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=2`, node-only), full run on the final
   tree: **4645 passed, 6 failed, 8 skipped**. The 6 are the ones FE-1 recorded on the base: 5 x `unit-session-me-failure-2435`
   (a page spec the node-only config starts without a server) and `unit-presence-compact-2310:36` (fails only inside the full
   run; it passed in a run of the changed specs plus that file: 104 of 104, then 6 of 6 for the last fix). The same full run
   before the test updates: 18 failed - those 5 and the 13 source-reading tests of the table above.

## NOT_RUN

- The pixel gate (the row's test) and the entry check - runner only; this batch pushes without queueing.
- Evidence specs on the tablet and mobile projects; the other evidence / layout / page specs (among them the larger
  `evidence-plan-studio*` files and `evidence-schedules-editor`).
- ESLint (`typescript-eslint` is not installed in the shared `node_modules`), `npm run build:addon`, the bundle budget, the
  unused-exports report, `scripts/lazy-tags-check.mjs`, the backend suite (no backend file is touched).
- The rendered computed-style comparison of FE-1 (`render.mjs`): not repeated - no CSS text changed in any sheet (check 2).

## For the next steps of the chain

- STRUCT-1 steps 2-3 (logic modules, one component per tab / section) are not part of this row.
- `system-diagnostics.ts` and the other large files of the finding are not in the row's list and were not touched.
