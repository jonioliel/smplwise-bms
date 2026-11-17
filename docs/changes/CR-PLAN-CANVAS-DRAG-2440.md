# CR-PLAN-CANVAS-DRAG-2440 - one pointer-drag session for the plan canvas; a cancelled drag no longer commits

Branch `pilot/CR-PLAN-CANVAS-DRAG-2440`, cut from `origin/release/2437-train` @ `32c4a2275` (the 2.43.7 train; it contains
`FE-LEAK-TEXTKEY-2435`, the row's named dependency). Plan row: `pilot/CR-PLAN-CANVAS-DRAG-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.3, finding 08:F14, lead decision L10. No version bump, no
CHANGELOG entry, no backend file, no device or lab access. Pixels: none.

## What and why

`frontend/src/map/sw-plan-canvas.ts` wrote the same drag wiring nine times: add `pointermove` / `pointerup` /
`pointercancel` to the viewport, remove the three when the gesture ends, set `dragMoved` and reset it with
`setTimeout(0)`. In six of the nine copies `pointercancel` was bound to the release handler, so a gesture the browser took
over (a system swipe, a palm on a tablet, a lost capture) ended as a **committed** edit - computed from the cancel
event's coordinates, which are not the pointer's (often 0, 0).

- New `frontend/src/map/drag-session.ts`: `dragSession(target, { move, commit, cancel })`. It owns the three listeners,
  removes them before it calls a handler, and calls exactly one of `commit` (release) or `cancel` (`pointercancel`), once.
- The canvas's nine drags go through it, and the `dragMoved` pair is one method, `swallowClick()`.

## Behaviour change (the row's one case; lead decision L10, recommended "yes")

A cancelled drag no longer changes anything. Per tool, what `pointercancel` did before and does now:

| Drag | Before | Now |
|---|---|---|
| a pin (`marker-move`) | committed at the cancel event's point | the pin stays; no event |
| a zone corner, also an inserted corner (`zone-edit`) | committed | the zone keeps its polygon; no event |
| a camera's direction / field-of-view handle (`marker-orient`) | committed | unchanged; no event |
| the cone's range handle (`marker-coverage` radius) | committed | unchanged; no event |
| a corner of the coverage polygon (`marker-coverage` polygon) | committed | unchanged; no event |
| the door ghost's width handle (`ghost-handle` phase `end`) | sent `end` at the cancel event's point | no `end` is sent |
| a zone body, a geometry item, a detection candidate | already cancelled without a commit | the same (unchanged) |

Everything else is identical: the same events with the same details on a release, the same order of statements inside
each release handler (the pin still selects before the click guard is set, because `select()` reads it), the same
"swallow the click that follows" on both endings.

One limit, stated plainly: the door ghost's width handle previews through `ghost-handle` phase `move` events that the
editor applies to the proposal as they arrive. After a cancelled drag the proposal keeps the last previewed width (it is a
proposal: nothing is saved until the user accepts it, and Esc drops it). Putting the width back needs a `cancel` phase in
the event and a line in `explore-plan-editor.ts`, which is outside this row.

**L10 asks for a check on a touch device before the decision is final - NOT done here** (no device access in this batch).
Recorded for the lead / owner: on a tablet, start dragging a pin in the plan editor and let the system take the gesture
(a three-finger swipe, or the notification shade); the pin must spring back.

## Not done here

- 08:F03 (d), the label fix the review suggested to take along: it is not in the master-plan row (the row lists 08:F14
  only, and `map/shared-space.ts` is not in its file list).
- 08:F22 (moving the drag tools out of the 2,900-line file): a later branch, after this one, as the review says.

## Resolved file list

- new `frontend/src/map/drag-session.ts`
- `frontend/src/map/sw-plan-canvas.ts`
- new `frontend/tests/unit-plan-drag-session.spec.ts` (node only: the helper, and source guards on the canvas)
- new `frontend/tests/unit-plan-canvas-drag-cancel.spec.ts` (a browser page spec: a real mouse drag of a pin on a
  stand-alone editable canvas, a `pointercancel` dispatched mid-drag, and the released-drag control)

Outside my rows: nothing.

## Overlap with other branches in flight

None. `pilot/PLAN3D-R32-ANSWERS-2438` does not touch `sw-plan-canvas.ts`, and this branch touches no plan3d file.

## Tests

Actually run on the workstation (16.11.2026; node 24, `--workers=1`):

- `tsc --noEmit -p` on a focused project (the base `tsconfig.json` with `include` narrowed to `src/vite-env.d.ts`,
  `src/map/drag-session.ts`, `src/map/sw-plan-canvas.ts` and the two new specs, plus everything they import): **exit 0**.
- `playwright test -c playwright.unit.config.ts tests/unit-plan-drag-session.spec.ts`: **6 passed, 0 failed**.

NOT_RUN (the PC had 0.1-1.2 GB of free memory the whole session; the batch brief forbids heavier runs then):

- the full-project `tsc --noEmit` (no exported name or signature of `sw-plan-canvas.ts` changed, so its nine importers
  are unaffected; the runner's build checks it);
- `tests/unit-plan-canvas-drag-cancel.spec.ts` - written, **never run**: it is a browser page spec (needs the preview
  server and Chromium). It is the row's "pointercancel mid-drag" test on the real canvas, so treat a failure of it in the
  combined entry check as a finding about the spec first;
- the other `unit-plan-*` specs, `evidence-plan-*`, the pixel gate (the row: no pixel change expected);
- the touch-device check of lead decision L10.
