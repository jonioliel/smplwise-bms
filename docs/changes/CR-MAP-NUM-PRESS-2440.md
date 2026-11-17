# CR-MAP-NUM-PRESS-2440 - one set of map number helpers, one long-press controller

Branch `pilot/CR-MAP-NUM-PRESS-2440`, cut from `origin/release/2437-train` @ `32c4a2275` (the 2.43.7 train). Plan row:
`pilot/CR-MAP-NUM-PRESS-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md` section 3.3, findings 08:F20 and 08:F15.
No version bump, no CHANGELOG entry, no backend file, no device or lab access. Behaviour and pixels: unchanged.

## 08:F20 - `frontend/src/map/num.ts`

`rad`, `deg`, `isNum`, `clamp`, `round5` and `r4` were re-typed in eight map files. They are one definition each now.

**The review counted "`r4` x7" as one helper. It is three different rules**, and they are kept apart on purpose, because
the scene description is hashed (AO volume cache, still sets, determinism specs) and "must not change by one ulp":

| Export | Rule | Was the private `r4` of |
|---|---|---|
| `r4` | `Math.floor(v * 1e4 + 0.5) / 1e4` | `scene-builder.ts` (exported), `scene-real-builder.ts` |
| `r4z` | the same `+ 0` (a negative zero becomes a plain zero) | `walk-world.ts` (exported) |
| `r4round` | `Math.round(v * 1e4) / 1e4 + 0` | `walk-controller.ts` |

`Math.round(x)` and `Math.floor(x + 0.5)` differ at the largest double below a half (0.49999999999999994: floor gives 1,
round gives 0) and in the sign of a zero. So no file changed its rule: `scene-builder.ts` still exports `r4`
(`export { r4 }`), `walk-world.ts` still exports `r4` (`export const r4 = r4z`), `walk-controller.ts` imports
`r4round as r4`. The new `unit-map-num.spec.ts` keeps every replaced copy as a reference and compares bit for bit
(`Object.is`, so -0 and NaN count) over the edge values and 20,000 deterministic samples.

Resolved file list (the row's eight files, each: private copies removed, one import from `./num` added):
`scene-builder.ts` (`r4`, `deg`, `rad`, `isNum`), `scene-real-builder.ts` (`r4`, `rad`, `deg`), `scene-three.ts` (`rad`),
`still-bake.ts` (`rad`, `deg`), `walk-world.ts` (`r4`, `isNum`), `walk-controller.ts` (`clamp`, `r4`), `studio-ops.ts`
(`round5`), `curve-ops.ts` (`round5`).

Not in the row and left alone (the same helpers exist there too; a later branch can adopt `num.ts`): `ao-volume.ts` and
`room-glow.ts` (`r4` by `Math.round` without `+ 0` - a FOURTH rule), `walk-path.ts`, `walk-look.ts`, `door-tool.ts`,
`floor-image.ts` (`clamp`), `lightmap-bake.ts`, `scene-frame.ts`, `scene-real.ts` (`rad`), `candidates.ts`,
`coverage.ts` (`round5`), `glass-wall.ts`, `material-resolve.ts`, `wall-path.ts` (`isNum`), `sw-plan-canvas.ts`
(excluded by the review).

## 08:F15 - `frontend/src/components/press-controller.ts`

`elevators/history-press.ts` repeated the listener set and the state machine of `components/device-activity-press.ts`.
The generic part is now the abstract `PressController<Hit>`: the seven listeners (pointerdown / pointermove / pointerup /
pointercancel / click / contextmenu in the capture phase, keydown), the 500 ms timer, the 8 px slop, the haptic tick, the
"swallow the click that ends a completed press" guard and the touch / pen context-menu suppression. A subclass says which
item an event belongs to (`findPress`, `findMenu`) and what a completed press, a menu gesture and a key do (`longPress`,
`contextMenu`, `keyDown`), with two hooks for the progress ring (`pressStarted`, `pressEnded`).

- `ActivityPress` (devices): keeps its ring, its `pressPlan` / menu logic, Alt+Enter, and the permissive lookup for click /
  menu / key (`find(e, true)`).
- `ElevatorHistoryPress`: keeps its card lookup and its keys (Alt+Enter, the menu key, Shift+F10).
- `LONG_PRESS_MS`, `MOVE_SLOP_PX` and `exceedsSlop` moved to the shared file and are re-exported by
  `device-activity-press.ts` (and `LONG_PRESS_MS` by `history-press.ts`), so every importer is unchanged.

Equivalences checked while merging the two state machines (the order of statements differed in two places, with no
observable effect): the elevator copy cleared `start` before its null check in `fire` and the device copy after ending the
ring - nothing reads `start` in between; the device copy computed the menu position before setting `lastType = 'mouse'`,
which the position does not read. Both copies call `preventDefault()` on a context menu over an item for every pointer
type and stop there for touch / pen.

Resolved file list: new `components/press-controller.ts`; `components/device-activity-press.ts`;
`elevators/history-press.ts`.

## Tests changed / added

- new `frontend/tests/unit-map-num.spec.ts` (3 tests), new `frontend/tests/unit-press-controller.spec.ts` (7 tests).
- `frontend/tests/unit-elevator-history-press.spec.ts`: its source guard looked for `'contextmenu'`, `'pointercancel'`
  and `swallowUntil` inside `history-press.ts`; those now live in `press-controller.ts`, so the guard reads both files
  (and requires `extends PressController`). No assertion was weakened.

Outside my rows: nothing (only the spec above, which guards a file of the row).

## Overlap with other branches in flight

`pilot/PLAN3D-R32-ANSWERS-2438` edits two files of this row:

- `map/scene-builder.ts`: two constants near line 208 and one statement near line 655. This branch: one import line at the
  top and lines 273-289 (the removed helpers). Different hunks.
- `map/scene-three.ts`: the import from `./scene-real` (line 23 of the base) and the section-cut code near lines
  918-1200. This branch: one new import line above the file's first import (line 20, three unchanged lines above the one
  that branch edits) and the removed `rad` at line 194. Different hunks; should git still report a conflict in the import
  block, keep both lines.

No other plan3d file (`sw-plan-3d.ts`, `room-glow*.ts`, `scene-real.ts`, `floor-finish.ts`) is touched.

## Tests

TESTS_PLACEHOLDER
