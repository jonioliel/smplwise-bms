# OPEN-FINDINGS-2560

Base: origin/release/2550-train (15ba75f92). Branch pilot/OPEN-FINDINGS-2560.

## What
- SCR-08: saving the favourites (`saveFavs` in `frontend/src/home/sw-home.ts`) now goes through `keepHiddenFavs` (`home-logic.ts`): the grid
  shows only what is visible (favOk), and every save used to write that list back, dropping the hidden ones. Hidden ones are appended after the visible list.
- SCR-25: "remove from the case" (`investigate-cases.ts`, `removeItem`) asks first with the shared confirm dialog (danger, focus on cancel,
  names the item: kind, camera, time). English text added in `i18n/lang/en/i18n/msg/investigate.ts`.
- SCR-22: the per-alert "mute 24 h" acts only on the alert open in the drawer (never off-screen) and was already behind the server rules of
  DATA-RULES-2540 - unchanged. "Ack all" still acted in one click on every open alert of the device, including off-screen ones: now behind a
  confirmation (focus on cancel) that states the count on screen and that off-screen alerts are included. Texts: `G.alerts.ackAllTitle/ackAllBody` he + en.

## Tests
- `npx playwright test -c playwright.unit.config.ts tests/unit-open-findings-2560.spec.ts` - 4 passed after; before (src reverted) the file fails to load
  (no `keepHiddenFavs` export), so all 4 fail.
- The three UI guards are source guards (the repo's pattern in unit-physical-confirm-2540); no Playwright run with mocks was done.

## Not run
- Pixel baselines / compare page: the look does not change (existing dialog component, no new tokens); only a dialog appears on the actions.
- Runner jobs, full gate: NOT_RUN.

## Open questions
- a) (recommended) accept as is. b) "ack all" body shows the exact server count: needs a count endpoint (additive API).
