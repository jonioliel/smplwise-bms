# BUBBLE-FREEZE-295 - the bubble skin is frozen

Decision (owner, 2026-10-26): the **bubble** skin is not published and not selectable in upcoming versions. All of its code, CSS,
tokens and work stay in the tree; nothing is deleted. A safety copy of the full skin exists on `origin/archive/bubble-skin-v2.23.0`.
The fresh-install default skin stays `classic`.

## What froze

| Area | Change |
| --- | --- |
| Registry `frontend/src/design/skins/index.ts` | New `FROZEN_SKINS = ['bubble']`, `FROZEN_FALLBACK_SKIN = 'domus'`, `SELECTABLE_SKIN_IDS`, `isFrozenSkin`, `isSelectableSkin`, `resolveSkin`. `SKIN_IDS`, `SKINS`, `DEFAULT_SKIN`, `isSkinId` are unchanged (bubble stays a registry member so its tokens, rules, `data-skin='bubble'` CSS and the 50-rule budget tests keep working). |
| Runtime `design/apply.ts` | Every input is passed through `resolveSkin`: the cached `sw.ui.design`, the `?skin=` override, the installation's `ui.skin` from settings, the demo store. `data-skin` on `<html>` is therefore never `bubble`. |
| Picker `screens/system-design.ts` | Lists `SELECTABLE_SKIN_IDS` (four skins; the wide-card grid is `repeat(4, ...)`). |
| Backend `routers/settings.py` | `PATCH /settings` with `ui.skin = bubble` -> 422 ("the 'bubble' skin is frozen ..."); `FROZEN_SKINS` / `FROZEN_FALLBACK_SKIN` mirror the frontend (a backend test compares them). `GET /settings` returns a stored `bubble` as `domus` (`stored_skin`). The stored row is left as it is: no migration. |
| Bubble CSS / tokens / components | Untouched (`skins/bubble.ts`, `data-skin='bubble'` rules, `styles/bubble-*.ts`, look dials). They are dead on screen while frozen. |

Personal preferences: there is no personal skin override (`ui.look` carries dials only, the personal choice is the scheme), so
nothing to map there. The public / handler pages, the TV notice board and the wall display all read the skin through
`design/apply.ts`, so they follow the same fallback.

## Falls back where

- Installation had `ui.skin = bubble` -> **domus** (read-time mapping on both sides; saving the Settings > Look card writes `domus`).
- A browser with `bubble` in its cached design -> **domus** on the next load.
- `?skin=bubble` in the URL (designers, old evidence links) -> **domus**.
- Anything unknown still falls back to `classic` (DEFAULT_SKIN), as before.

## Test gate

- One shared helper: `frontend/tests/helpers/frozen-skins.ts` (`SKINS_UNDER_TEST`, `skinsUnderTest([...])`, `isFrozen`, `skipIfFrozen`).
  Specs that imported `SKIN_IDS` from the registry now import `SKINS_UNDER_TEST as SKIN_IDS` from the helper; hard-coded skin lists
  are wrapped in `skinsUnderTest([...])`.
- Whole-file skips (`skipIfFrozen('bubble')`): evidence-bubble-foundation, evidence-bubble-lists, evidence-bubble-screens,
  layout-bubble, layout-bubble-lists, layout-bubble-screens, dropdown-bubble-specificity, evidence-bv1-tiles,
  evidence-material-dials, evidence-palettes, layout-material.
- Single-test skips: see `grep -rn "BUBBLE-FREEZE-295" frontend/tests`.
- `tests/unit-bubble-freeze-295.spec.ts` does not skip: it asserts the freeze (and that the bubble code is still there).
- Baseline PNGs are kept; they are simply not read while the skin is frozen.

## How to unfreeze

1. `frontend/src/design/skins/index.ts`: `FROZEN_SKINS = []`.
2. `smplwise_vms/backend/smplwise/routers/settings.py`: `FROZEN_SKINS = ()`.
3. `system-design.ts`: set the wide-card grid back to `repeat(5, ...)` and update the two assertions in
   `unit-bubble-freeze-295.spec.ts` / `test_ui_settings.py` (the `FROZEN_SKINS` regexp and the 422 case).
4. The specs come back by themselves (the helper reads the registry). Re-run the pixel baselines of the settings design card.
