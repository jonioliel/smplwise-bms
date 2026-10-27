# Bringing the bubble skin back

The bubble skin has been frozen since 2026-10-26 (owner decision, `docs/changes/BUBBLE-FREEZE-295.md`). Its code, CSS and tokens are
still in the tree. BUBBLECLEAN-297 additionally hid the two bubble-only screens that could not work without it. A safety copy of the
full skin as released in 2.23.0 exists on `origin/archive/bubble-skin-v2.23.0`.

## What is hidden and by which switch

| Thing | Where | Switch |
| --- | --- | --- |
| Skin picker entry | `frontend/src/screens/system-design.ts` lists `SELECTABLE_SKIN_IDS` | `FROZEN_SKINS` |
| Skin writes (`PATCH /settings` with `ui.skin = bubble` -> 422) and read fallback to `domus` | `smplwise_vms/backend/smplwise/routers/settings.py` | `FROZEN_SKINS` (backend tuple) |
| Runtime fallback of a cached / `?skin=` / stored bubble to `domus` | `frontend/src/design/apply.ts` via `resolveSkin` | `FROZEN_SKINS` |
| Settings > General > Look card (`<system-look>`, with the palette editor inside it) | `frontend/src/screens/system-diagnostics.ts` `renderGeneral()` | `BUBBLE_SCREENS_ENABLED` |
| Demo page `#/styleguide/bubble` (`<bubble-demo>`) | `frontend/src/shell/sw-app.ts` route switch | `BUBBLE_SCREENS_ENABLED` |

`BUBBLE_SCREENS_ENABLED` is exported from `frontend/src/design/skins/index.ts` and is simply `!FROZEN_SKINS.includes('bubble')`, so
there is one real switch: the frozen list.

The dial values already stored (`ui.look`, `ui.palettes`, personal `/me/prefs` look) are untouched and still applied by
`design/look.ts` `applyLook()`; only the editing screen is gone.

## Restore steps

1. `frontend/src/design/skins/index.ts`: `FROZEN_SKINS = []` (this also turns `BUBBLE_SCREENS_ENABLED` and `SELECTABLE_SKIN_IDS` back).
2. `smplwise_vms/backend/smplwise/routers/settings.py`: `FROZEN_SKINS = ()`.
3. `frontend/src/screens/system-design.ts`: wide-card skin grid back to `repeat(5, ...)`.
4. Update the freeze assertions: `frontend/tests/unit-bubble-freeze-295.spec.ts` (frozen list, selectable list, the
   `resolveSkin('bubble')` case) and `smplwise_vms/backend/tests/test_ui_settings.py` (the `FROZEN_SKINS` regexp, the 422 case).
5. Remove or invert `frontend/tests/evidence-bubble-clean-297.spec.ts` (it skips itself once `BUBBLE_SCREENS_ENABLED` is true).
6. Rebuild the add-on UI (`npm run build:addon` on the runner).

## Tests that come back on their own (they use `skipIfFrozen('bubble')` / `SKINS_UNDER_TEST`)

evidence-bubble-foundation, evidence-bubble-lists, evidence-bubble-screens, layout-bubble, layout-bubble-lists,
layout-bubble-screens, dropdown-bubble-specificity, evidence-bv1-tiles, evidence-material-dials, evidence-palettes, layout-material,
plus every "for each skin" spec through `tests/helpers/frozen-skins.ts`. Pixel baselines were never deleted. Run the
bubble set and the settings design card baselines after restoring.

## Final removal (later version)

Only then delete `skins/bubble.ts`, `styles/bubble-*.ts`, `screens/bubble-demo.ts`, `screens/bubble-sliders.ts`,
`screens/devices-area-bubble.ts`, `screens/system-look.ts`, `screens/system-palette-editor.ts`, the `data-skin='bubble'` rules in
components, the specs above, and the `bubble` entry in the `ui.skin` pattern.
