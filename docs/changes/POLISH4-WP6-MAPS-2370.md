# POLISH4-WP6-MAPS-2370: maps and plan polish (round 4, package WP6)

Branch `pilot/POLISH4-WP6-MAPS-2370`, cut from `origin/release/2360-train` @ 44b8383c2. Scope: survey
`private/planning/POLISH_ROUND4_SURVEY_2026-11-02.md` §2 D12, D13, D28 (the plan star). Refinement only. Menus, tabs, widgets, titles
and control order are unchanged. Map geometry is not mirrored, and nothing under `frontend/src/map/` was touched, so the 3D
renderer's determinism (`unit-plan-3d-*`) is unaffected. No version bump, no merge.

Files (package-exclusive): `screens/explore-floor-map.ts`, `explore-sites.ts`, `explore-floors.ts`, `explore-presence.ts`,
`explore-plan-import.ts`, `explore-entities.ts`, `explore-plan-editor.ts`, `plan-studio-panel.ts`. Tests: the new
`tests/unit-polish4-wp6-maps.spec.ts`; `tests/unit-token-lint.spec.ts` loses three ALLOW_HEX entries (sites, import, editor), which went
stale because those screens no longer hold a hex literal. `plan-studio6-panel.ts` and `plan-view-dials.ts` were checked and needed no
change: studio6's hover was already gated and its walk-start star already had the A11Y-POLISHED-2342 fix.

## Defects fixed

| # | Before | After |
|---|---|---|
| D12 floor map | 9 `:hover` rules: crumbs, side-list rows (and their caption), room-card link, floor strip. None was gated; a `(hover: none)` block undid two of them. On a touch tablet that reports `hover: hover`, a tapped row stayed washed | One `@media (hover: hover) and (pointer: fine)` block. The selected row or floor never takes the hover wash (`:not(.on)`), a disabled floor never does either, and the undo block is gone |
| D12 sites | The `.add` tile hover was ungated, with a `(hover: none)` undo | Gated; undo removed |
| D12 floors | A dead ungated `.floor:hover` plus a `(hover: none)` undo that left a tapped row with a transparent edge and shadow 1 | Both removed; the R5 fine-pointer hover is the only one |
| D12 presence, import | `.btn:hover` and `.drop:hover` ungated, each with an undo | Gated; undos removed |
| D12/D13 editor, studio | Tool rail, bar icon keys, zone / anchor lists and library rows hovered ungated, with undo blocks | Gated with `:not(.on)` (and `:not(:disabled)` on the rail and bar); undos removed |
| D13 map literals | Status dots `#22c55e` / `#ef4444` (wrong in dark), device legend swatch `#fff`, mask stops `#000`, radii `999px` / `2px` | `--sw-success` / `--sw-danger`, `--sw-menu-surface`, `black` (alpha-only mask stop), `--sw-r-pill` / `--sw-r-2xs` |
| D13 sites | Demo badge on the scene picture: `rgba(17,24,39,.5)` with `#fff` | `--sw-video-scrim` / `--sw-on-video` |
| D13 import | `#f3f5f9` wells (dead: an R5 rule already overrode them); crop dim `rgba(17,24,39,.28)` | `--sw-surface-2`; `color-mix(--sw-overlay 60%)` |
| D13 floors `:166` | Floor names in the floor-links stack: `font-size: 6px` in viewBox units, drawn at 9 px in text-3 | `calc(var(--sw-fs-2xs) * 2 / 3)`, which renders at the 2xs step (10-11 px) after the 1.5x draw scale, in `--sw-text-2` |
| D13 editor | 10 hex: the detected-room preview palette (8 fixed colours, including a green) and `#9AA3B5`; bind-bar key `#fff` on `rgba(255,255,255,.6)`; swatch edge `rgba(15,23,42,.15)`; radii `999px` x2, `3px`, `2px` | Palette = skin hues 7/6/1/4/5/2 (green hues 3/8 excluded). It is preview only: `acceptZones` sends no colour. Excluded room `--sw-offline`; key on `--sw-toast-text`; edge `color-mix(--sw-text 15%)`; radii on tokens |
| D13 editor phone / touch | Only `max-width: 1023px`. On a phone the canvas kept a fixed 520 / 560 px minimum height; bar icon keys were 26 px | `max-width: 767px`: canvas `min(520px, 70dvh)`, 12 px gap, `--sw-r-md`. `pointer: coarse`: bar icon keys `--sw-ctl-h-lg` (36 px) |
| D13 studio panel | One `@media` (the undo); calibration pair `999px` | `pointer: coarse`: mode pills, glazing chips and the favourite star reach 44 px (`--sw-touch-desktop`). `max-width: 479px`: the `.three` row wraps at 88 px. Pair radius `--sw-r-pill` |
| D13 entities | Inline `border-radius:7px` on the domain tile | `--sw-r-xs` |
| D28 plan star | Library favourite star `.fav.on` drawn in the bare `--sw-warning`: 2.0-2.15:1 in light on the card and on its warning wash | `--sw-warning-text`: ≥ 4.5:1 in light, and the same hue in dark in every skin |
| D28 (same pattern) | Active editor bar icon key in the bare `--sw-warning` on `--sw-warning-soft` (~2:1 in light) | `--sw-warning-text` |

Press feedback (`scale(var(--sw-press-scale))` on pointer-down) was already present on every changed control. No new scroll: the
phone rule makes the editor page shorter, and the coarse-pointer rules only touch the editor and studio, which are editing screens.

## Tests (real totals)

| Where | Command | Result |
|---|---|---|
| Workstation | `npx tsc --noEmit -p .` (frontend) | 0 errors |
| Workstation | `npx playwright test -c playwright.unit.config.ts --workers=1 "tests[\\/]unit-"` @ 32fe757a6 | **3657 passed, 0 failed, 1 skipped** (21.0 min) |
| Workstation | the new `tests/unit-polish4-wp6-maps.spec.ts` (6 tests) + `unit-token-lint` (7) | 13 passed |
| Runner | `run_smart.py visual … --screens map-floor,sites --workers=1` @ 32fe757a6 | 12 cases: **10 pass, 2 differ** (map-floor ready light / dark, mobile) |
| Runner | `run_smart.py linux-pixel … tests/pixel-walk-touch.spec.ts tests/pixel-wall-plan.spec.ts --workers=1` @ 32fe757a6 | **14 passed, 0 failed, 28 skipped** (skips are by project / skin design) |

The two map-floor mobile differences were reviewed with PIL and visually (`private-evidence/visual-out/pilot-POLISH4-WP6-MAPS-2370-32fe757a6/`).
The changed pixels are the phone tool row and the zoom stack: taller keys, which push the plan down a few pixels. That is the phone
touch-target change already on the train, whose baselines were re-taken on 2.34.2 (`fix/GATE2342-PIXEL`).
PRE-GATE-2360 run A recorded the same two cases failing on the bare train tip. None of this package's edits changes a size on the
phone floor map. The legend, where the swatch changed, is hidden below 768 px, and in the base skin the light status-dot colours are the same hex as before.

## Baselines

- Refreshed: none. The map-floor mobile differences are not this package's; they clear once the train carries the 2.34.2 baselines.
- Expected to move on the train (dark only, small): `map-floor` dark desktop / tablet when the side list or pick chips show camera
  dots (`--sw-success` / `--sw-danger` dark values), and the device legend swatch in dark (`--sw-menu-surface` instead of white).
  Neither showed in today's matrix states: 10 / 10 pass.
- Editor / studio phone or touch captures (evidence specs, not baselines) will show the 70dvh canvas and the larger touch keys.

## NOT_RUN

- Browser look at 1920 / 1440 / 1180 / 1024 / 390 for the plan editor, studio, import, presence and entities: there are no pixel
  baselines for these screens, and the workstation is low on memory (no local vite or Playwright browser runs). Covered by source
  guards and tsc only.
- The impeccable detector on sources returned `[]`: it reads pages, not TS. No page-level design-skill loop was run.
- The rebase or merge onto a train that contains v2.34.2: the train did not contain it at push time (see the final report).
