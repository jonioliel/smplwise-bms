# CR-HOME-LAZY-2440 - the home screen's on-demand parts out of the entry chunk (review 06:BUNDLE-1 home side, 07:F4 d)

Branch `pilot/CR-HOME-LAZY-2440`, cut from `origin/release/2437-train` at 32c4a2275. Row: code-review master plan,
`pilot/CR-HOME-LAZY-2436` (batch -2440 name). Frontend only: no version bump, no migration, no backend file, no device access.
Visuals unchanged. The only behaviour difference is timing: the first opening of each part below may wait for one chunk fetch.

Resumed work: the first agent stopped mid-branch (usage ran out) with seven uncommitted files. They were read against the row,
found right and kept; this session added the deny-list entries, the edit-row wait, the spec adjustments, the measurements, the
page runs and this note.

## Entry chunk (`npx vite build`, `dist/assets/index-*.js`, measured by `scripts/bundle-budget.mjs --dir dist`)

| | raw bytes | gzip -9 bytes |
|---|---|---|
| after (this branch) | 2,948,069 | 854,903 |
| budget of the script (v2.43.4) | 4,074,343 | 1,156,938 |

The base (32c4a2275) was NOT built on the workstation (one build only, memory), so there is no measured "before" for this branch
alone. What left the entry are the new chunks below, about 270 KB raw together: `area-quick-sheet` 68.9 KB,
`mapping-assistant` 55.1 KB, `home-edit-panel` 37.0 KB, `devices-tiles-panel` 35.7 KB, `mapping-health` (with the settings page
`system-mapping`) 24.4 KB, `home-site-view` 20.5 KB, `home-site-off` 9.8 KB, `home-screen-options` 9.5 KB, `mapping-decide` 5.3 KB,
`mapping-rules` 4.2 KB. Deny-list of the entry in this build: 0 mock modules, 36 dictionary modules (not this row).

## What changed

- **`shell/lazy-screens.ts`.** Six tags of the home screen are in `LAZY_SCREENS` (`HOME_PANELS`): `devices-tiles-panel`,
  `area-quick-sheet`, `home-edit-panel`, `home-screen-options`, `home-site-view`, `home-site-off`. New exports: `screenDefined(tag)`,
  `whenScreen(tag)` (settles when the tag's chunk settled; background - not counted by `pendingScreens`), and
  `warmHomePanels(landedOne)` - once per page, while the browser is idle and under the same conditions as the common screens'
  warm-up (`server.startup_warmup`, data-saver, a visible tab), it fetches the two first-press chunks (`HOME_WARM_PANELS`: the
  tiles' panel and the area quick sheet), one at a time. A failed fetch never reloads the page.
- **`screens/devices-building.ts` (import block and first-use sites only).** The static imports of the six modules and of
  `screens/mapping-all` are gone (types are imported with `import type`). Each tag is rendered when it is first needed, and the
  screen's existing `loadPendingScreens(this.renderRoot, ..., true)` call in `updated()` parks the element, fetches the chunk and
  puts it back upgraded with its properties - the GATE2342-A path, never an in-place upgrade:
  - the tiles' panel (`renderTilesPanel`) and the area quick sheet (`renderQuickSheet`) are rendered from the first time one is
    asked for, or as soon as the idle warm-up brought the chunk; from then on the closed element stays in the page as it always
    did (`panelUsed` / `quickUsed`). The floor lights' mini panel (`renderXsLights`) uses the same tag and the same loader;
  - `<home-edit-panel>` and `<home-screen-options>` arrive with edit mode's drawer; `onWidgetEdit` waits for the panel's chunk
    before it scrolls the widget's row into view (when that press is what opens the drawer for the first time);
  - `<home-site-view>` and `<home-site-off>` are fetched only on a multi-building site. `openSiteOff` keeps a press that came
    before the dialog's chunk landed and opens the dialog once it is there;
  - `panelFromParams` no longer reads `ITEMS_FILTERS` from the panel's module: the screen has its own `PANEL_FILTERS` (the same
    four values; the new spec compares the two lists in the sources).
- **07:F4 d - the mapping family.** The home screen imported `screens/mapping-all` (the settings page, the assistant, both
  slices, the health card) for one chip in its site bar.
  - New `screens/mapping-health-chip.ts`: `<mapping-health-chip>` and `healthOf`, moved unchanged from `mapping-health.ts`
    (which imports and re-exports `healthOf`, so its importers are unchanged). It imports only the mapping engine, the mapping
    API, the session, the catalog, the router and `sw-icon` - all in the entry chunk already. "The health chip's small logic
    stays static" (the row).
  - `screens/mapping-all.ts` imports the settings page and the health card only.
  - `screens/system-mapping.ts`: "the assistant loads on click" (the row). `loadAssistant()` imports `mapping-assistant`,
    `mapping-decide` and `mapping-rules` together (once; a failed fetch may be tried again and shows the error on the page), and
    `<mapping-assistant>` is rendered only once they landed (`assistantReady`). The "החלט עכשיו" button asked
    `MappingAssistant.hasDecisions` to choose its first step; the decisions slice always loads with the assistant, so it is
    `'decide'` as it always was in practice.
- **`frontend/scripts/lazy-tags-check.mjs`.** Twelve more modules on `NOT_IN_ENTRY`: the six home modules, `mapping-all`,
  `system-mapping`, `mapping-health`, `mapping-assistant`, `mapping-decide`, `mapping-rules`. `--stats`: `notInEntry: 20`.

## Resolved file list

Row files: `frontend/src/screens/devices-building.ts`, `frontend/src/screens/mapping-all.ts`,
`frontend/src/screens/system-mapping.ts`, `frontend/src/shell/lazy-screens.ts`, `frontend/scripts/lazy-tags-check.mjs` (named
by the row as its test). New: `frontend/src/screens/mapping-health-chip.ts`, `frontend/tests/unit-home-lazy-2440.spec.ts`,
this note.

## Outside my rows

- `frontend/src/screens/mapping-health.ts`: the chip class and `healthOf` moved out to the new chip module (the move the row
  asks for); the card is untouched.
- `frontend/tests/unit-shell-lazy-2436.spec.ts` line 39: `notInEntry` was pinned to exactly 8; it is now "at least 8", so this
  branch and any other that adds to the deny-list do not collide on one number.
- `frontend/tests/screens.spec.ts` (the design-review shots): the `sc33-devices-tiles-panel` shot waits for the panel's rows
  (new optional `ready` selector) - the panel is a chunk now and the harness waited a fixed 300 ms.
- The row names `tests/unit/lazy-screens.spec.ts`, which does not exist in this repository (as CR-SHELL-LAZY-2436 recorded);
  the guards are `unit-perf-home-devices.spec.ts`, `unit-shell-lazy-2436.spec.ts` and the new spec.

## Pixels to refresh

None expected. The `pixel-home-*` specs are of the simple home (`<sw-home>`), which this branch does not touch; no pixel spec
opens the tiles' panel, the area quick sheet, edit mode, the site view or the mapping assistant. The closed panel elements are
not drawn. No PNG is committed; evidence PNGs rewritten by the runs below were restored.

## Tests

New `frontend/tests/unit-home-lazy-2440.spec.ts` (Node only, 6 tests): none of the twelve modules is reachable from `main.ts`
by static imports and each is on the check's deny-list; the six tags are in `LAZY_SCREENS` and the check passes; the home
screen renders its lazy tags through the loader and keeps a used panel in place; the two filter lists are the same; the chip
module imports nothing of the settings page or the assistant; the settings page imports the assistant and both slices with
`import()` and renders the tag only then; `whenScreen` settles at once for a tag that is not lazy.

Results on the workstation (`--workers=1`; page specs on the desktop project only, against `vite preview` of this branch's
build on its own port):

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean (run twice, the second on the final sources) |
| `node scripts/lazy-tags-check.mjs --stats` | OK, `notInEntry: 20` |
| `node scripts/bundle-budget.mjs --dir dist` | within budget (table above) |
| Node unit specs, first run: `unit-home-lazy-2440`, `unit-shell-lazy-2436`, `unit-perf-home-devices`, `unit-home-edit-drawer`, `unit-home-reload-2436`, `unit-mocks-lazy`, `unit-entry-chunk`, `unit-a11y-polished-lint`, `unit-lead-reserve`, `unit-tree-unassigned-2331`, `unit-area-popup-edit-2290`, `unit-area-presence-line-2351`, `unit-entity-id-sweep`, `unit-dark-polish-beds` | 106 passed, 1 skipped, 1 failed: `unit-shell-lazy-2436` pinned `notInEntry` to 8 (now 20) - adjusted, see "Outside my rows" |
| Node unit specs on the final sources: `unit-home-lazy-2440`, `unit-shell-lazy-2436`, `unit-perf-home-devices`, `unit-home-edit-drawer` | 30 passed |
| `evidence-multibuilding-home-2330` (site view, off dialog) | 7 passed |
| `evidence-mapping-assist-2330` (settings page, assistant, the home's chip) | 9 passed |
| `unit-devices-tiles` (page spec: the tiles' panel, deep link, focus) | 11 passed, 2 skipped |
| `layout-area-popup-edit-2290` (area quick sheet) | 8 passed |
| `layout-overlay-no-shift` | 2 passed |
| `perf-home-load` | 5 passed |
| `evidence-home-295` | 30 passed |
| `evidence-tree-unassigned-2331` (edit mode's screen options) | 6 passed |
| `evidence-home-edit-drawer-2351` (edit mode's drawer) | 1 passed |
| `screens.spec.ts -g "sc3[23]-devices"` (the two home shots, with the new wait) | 2 passed |

The first seven page rows ran against the build made before the `onWidgetEdit` wait was added; the last four rows and the
second unit run are on the final build.

NOT_RUN:
- `evidence-home-screen` (22 skipped) and `evidence-devices-tiles` (15 skipped): both need the devices fixture backend
  (`SW_LIVE=1 SW_DEVICES_FIXTURE=1`), which was not started (memory, no backend in this batch).
- `layout-bv1-tiles`: its sweep imports `/src/design/look.ts`, which only the `vite` dev server serves (1 failed on that import
  under preview, 2 skipped) - not a result about this branch.
- A measured "before" entry size of the base commit (no second build).
- The tablet and mobile projects, the pixel gate, the full frontend suite, the runner entry check (lead's instruction).
- No device, lab or backend access of any kind.

