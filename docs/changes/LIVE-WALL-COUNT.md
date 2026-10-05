# Live wall: choose how many cameras, columns as a compact dropdown (LV1)

Owner request 2026-10-05.

## What changed

- The camera count of the live wall is a ladder cut off at the cameras the user may see on the wall: 1, 2, 4, 6, 8, 9, 12, 16, 20, 25,
  32, 40, 48, 64, 80, 100 (only the steps below the total), then a final "הכול" (all). The total is the wall's own pool: every
  recorder the user may see (camera scope RBAC is applied by the API), minus disabled cameras, cameras of a disabled recorder and
  cameras hidden from the wall; the recorder filter re-cuts it to that recorder. Desktop and tablet: the segmented button row
  (`[data-wall-count] button[data-count]`); phone: the existing native select. A saved choice above the total reads as "all".
- Persistence is unchanged: this browser's `localStorage` key `sw.wall.count` (now also holds `all`), falling back to the
  installation default `ui.wall_count`. Older saved numbers (up to 32) stay valid.
- The columns control (automatic, 1 to 6) moved from a row of buttons below the wall (desktop) and a native select (phone) to one
  compact shared `sw-dropdown` at the top, in the wall's header / the phone's toolbar. It is drawn in the video group's style and size
  from Settings and, on a phone, opens as the user's `ui.dd_phone` choice. Persistence unchanged (`sw.wall.cols`).
- Beyond what fits: unchanged wall logic. The automatic fit packs the tiles into the screen; when the tiles would fall under the
  minimum size, or on a phone, the grid keeps readable tiles and the page scrolls vertically.
- Streams: untouched. The live set still comes from `allocateLive` / `effectiveLiveCap` over the shown cameras; a bigger count only adds
  snapshot tiles beyond the stream budget.

## Files

`frontend/src/screens/live-wall.ts`, `frontend/src/screens/wall-count.ts` (pure ladder logic).

## Tests

`unit-wall-count.spec.ts`, `wall-live-count.spec.ts` (mock layer: ladder, persistence, recorder filter, columns dropdown, phone list,
layout guard 320 / 390 / 1440), updated specs that clicked the old column chips / the 32 button. Evidence: `docs/evidence/live-count/`.
