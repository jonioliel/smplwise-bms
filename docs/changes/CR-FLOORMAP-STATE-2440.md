# CR-FLOORMAP-STATE-2440 - the live floor map: stale answers, another floor in the same element, small state defects

Branch `pilot/CR-FLOORMAP-STATE-2440`. **Based on `pilot/CR-MAP-SHARED-2440`** (which is cut from
`origin/release/2437-train` @ `32c4a2275`): both branches edit `frontend/src/screens/explore-floor-map.ts`, and this
batch did MAP-SHARED first, so this one builds on it and must be merged after it (or with it). The plan lists the
opposite order ("MAP-SHARED after FLOORMAP-STATE"); the batch order given to the agent was followed and the dependency
is recorded here, as the batch brief asks. `AUDIT30-COMBINED-2435` is in the base, as the row requires.

Plan row: `pilot/CR-FLOORMAP-STATE-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md` section 3.2 (wave 1), findings
06:RACE-1, 06:MAP-1, 06:DA-1 (floor map), 06:TIMER-1 (floor map), 06:PERF-6 (floor map getters). No version bump, no
CHANGELOG entry, no backend file, no device or lab access. Pixels: none.

## What and why

The shell re-uses the `explore-floor-map` element when only the floor in the address changes (the floor buttons, the 3D
floor strip, the side list). Several pieces of the screen assumed one floor per element.

**06:RACE-1 - `load()` had no generation token.** A slow answer for floor A landed under floor B, and A's failure could
blank B. `load()` now starts a `LoadGeneration` and asks `stale()` after each of its five awaits and in its `catch`. The
two per-load defaults (the default level, "open in 3D") were guarded by `this.bundle === b`; every state push replaces
the bundle object, so a push that arrived before the settings silently dropped both. They are guarded by the same
generation now. (The other lines of that `then` - quality, round-28 settings, presence fade, transport - are
installation-wide values and stay unguarded, as before.)

**06:MAP-1 a - the notice.** A failed "open incident here" set `notice`, which only the entity card rendered and nothing
cleared: invisible on a camera card, and shown later on an unrelated entity card. The camera card renders the same line
(`data-notice`, only when there is a notice), and `willUpdate` clears the notice when the selection changes (which
covers `close()`).

**06:MAP-1 b - the layer set.** `restoreLayers()` returned early when the floor had nothing stored, so floor B kept floor
A's layer set and the next toggle saved it under B's key. A floor with nothing usable stored (never visited, damaged
value, blocked storage) now gets every layer. The rule for a stored list is unchanged (`restoredLayers`).

**06:MAP-1 c - the state facts.** The memo of the openings and lamps was keyed on the document and the plan size, but the
result reads the object library (a lamp is a lamp by its library item's colour). When the library resolved after the
structure the lamps were missing until the next structure change. `stateFactsMemo` and the room-state memo are keyed on
the library too, as the history map already is.

**06:DA-1 - another floor in the same element.** `resetFloorState()` (called where the floor change is handled) also
clears `focusedObjectId`, `action`, `renaming`, `notice`, and the picked cameras - anchor ids of the floor before, which
were then mirrored into the new floor's address as `picks=`.

- Decision recorded (the row leaves it open; the reviewer marked this part "suspicion"): the **picking mode stays on**
  across floors, only the picks are dropped; and an address that carries its own `picks=` (Back from the wall or
  playback, M043) is left alone - `applyPicksParam` restores those picks after the load, exactly as before.

**06:TIMER-1.** The 900 ms timer that puts the jump's zoom choice back was never cleared: a second jump inside the window
was cut short by the first one's timer, and the timer outlived the element. One timer id, restarted per jump, cleared in
`disconnectedCallback`.

**06:PERF-6 - getters.** `buildingFloors`, `floors`, `markers`, `anchorPositions`, `circuitStateMap`, `entityStateMap`,
`entityStates3d` and `circuitStates3d` were rebuilt on every read (several reads per render, and the three maps and the
marker list are handed to the canvas as new objects on every host render). They are kept by reference (`RefMemo`) while
what they are computed from is the same object: the tree, the floor id, the bundle (replaced by every push, never
mutated - the room-state memo already relied on that), the layer set, the level filter, the screen state, the sync flag.
Same values; the canvas now receives the same objects while nothing changed. `restoreLayers` keeps the layer set's
object when the restored set is equal, so those memos are not thrown away on every load.

Not memoised here: the room chips of the picking bar and the floor strip's state dots (the other two places the review
names). Both are cheap loops read once per render, and a memo there needs the pick list / every other floor's bundle as
keys - left as they are.

## New pure module

`frontend/src/screens/floor-map-state.ts`: `LoadGeneration`, `FLOOR_LAYER_IDS` / `LATE_FLOOR_LAYERS` / `restoredLayers`,
`stateFactsMemo`, `RefMemo`. The screen cannot be constructed in node (no DOM), so the rules live here and the unit tests
them directly; a second group of tests reads the screen's source to guard how it uses them (every `await` of `load()` is
followed by the stale check, the reset list, the memo keys).

## Behaviour changes (all are the defects the row names; none on the normal path)

- A late answer or a late failure of an abandoned floor load is ignored.
- The default level and "open in 3D" apply even when a state push arrived before the settings.
- A floor never visited shows every layer instead of the previous floor's set.
- Lamps of a structure appear when the library arrives after it.
- Changing floor drops the focused object, an action's result line, an open rename, the notice and the stale picks.
- A notice is shown on the camera card too and goes away with the selection.

## Resolved file list

- `frontend/src/screens/explore-floor-map.ts`
- new `frontend/src/screens/floor-map-state.ts`
- new `frontend/tests/unit-floor-map-state.spec.ts`

Outside my rows: nothing.

## Overlap with other branches in flight

- `pilot/CR-MAP-SHARED-2440`: the base of this branch (see the top).
- `pilot/PLAN3D-R32-ANSWERS-2438` edits two template lines of `explore-floor-map.ts` (the `sw-plan-3d` properties line
  near `.roomPills`, and the `sw-room-card` `camera` attribute). This branch does not touch those lines; its nearest
  hunks are the `entityStates3d` / `circuitStates3d` getters and `restoreLayers`, tens of lines away. No plan3d file is
  edited.

## Tests

Run on the workstation, 16.11 (the resuming agent; the code of this branch was written by the agent before it, whose
account ran out before the checks - on resume the diff was read against the row and found complete, nothing was
changed in the code):

- `npx tsc --noEmit` (whole frontend): exit 0, no errors.
- `npx playwright test -c playwright.unit.config.ts tests/unit-floor-map-state.spec.ts tests/unit-floor-view-shared.spec.ts --workers=1`:
  **16 passed, 0 failed** (10 new in `unit-floor-map-state`, 6 of the base branch's `unit-floor-view-shared`).
  The row's three new cases are there: two deferred answers resolved in reverse, two floors for the layer set, the
  library resolving after the structure.

NOT_RUN:

- The browser specs of the floor map (`evidence-multiselect`, `evidence-map-improvements`, `evidence-floorstrip`,
  `evidence-live`, the map pixel specs): they need a build and the preview server, which the batch brief keeps off the
  workstation (no `npm run build`; port 4173 may be another agent's build). For the combined branch's entry check.
- `tests/unit-floor-map-3d.spec.ts` is a page spec (left out of the node-only unit run): NOT_RUN.
- `npm run build`, eslint: NOT_RUN.

## Pixels to refresh

None expected: no template, style or default changes on the normal path (the only new markup is the notice line of the
camera card, rendered only after a failed "open incident here" or a rename).

## For the closing chain

- Merge after (or with) `pilot/CR-MAP-SHARED-2440`.
- Worth one browser check in the entry run: switch floor with the floor buttons while cameras are picked (the picks are
  dropped, the picking mode stays on) and Back from the wall with `picks=` in the address (the picks come back).
