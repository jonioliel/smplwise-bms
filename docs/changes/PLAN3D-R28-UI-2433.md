# PLAN3D-R28-UI-2433 - the 3D map: room pills, room card, spread levels (round 28 mockup)

Branch `pilot/PLAN3D-R28-UI-2433` from `origin/main` (a5618fad6). Mockup: `private/design-system-2026-10-27/round28/map3d/`
(`app/pills.html`, `app/room.html`, `app/stack.html`; the plan wizard `app/wizard.html` is NOT in this branch).

## Owner answers

The owner has not answered `questions.html` yet. Every question of groups A-C was implemented with the **recommended** option, and
every choice the page asks about is a product setting (Settings > Map > "המפה בתלת־ממד"), so an answer is a default change in
`smplwise_vms/backend/smplwise/routers/settings.py` (and the matching defaults in `map/room-pills.ts`, `map/stack-layout.ts`).

| # | Question (questions.html) | Assumed default (recommended) | Setting | Other values |
|---|---|---|---|---|
| 1 | One label per room | a: one pill per room, devices one by one when close to a room | `map.room_pills` = `room` | `room_always`, `device` (before) |
| 2 | Tap on a room pill | a: small detail popover, from it to the room card | `map.room_pill_tap` = `popover` | `card` |
| 3 | A room with nothing to report | a: the room name only | `map.room_pill_quiet` = `name` | `hide`, `bubble` ("הכול סגור") |
| 4 | Where the room card opens (desktop / tablet) | a: side panel, the room moves to the centre of the rest | `map.room_card_place` = `side` | `float`, `sheet_tablet` |
| 5 | What asks before it runs | a: doors, gates and the alarm only (the system's sensitive actions) | `map.room_card_confirm` = `system` | `bulk` (also "כבה הכול" and closing shutters) |
| 6 | The camera in the card | a: a still refreshed every 5 s, live video on a tap | `map.room_card_camera` = `snapshot` | `live`, `none` |
| 7 | Backdrop of the all-levels view | a: by light / dark mode and the hour, as one level | `map.stack_backdrop` = `theme` | `dark` |
| 8 | Picking a level | a: first tap enlarges, second tap enters | `map.stack_pick` = `two_tap` | `one_tap` |

Q5 option c ("nothing asks") is deliberately **not** a setting: doors, gates and the alarm are sensitive actions everywhere in the
product (the server requires the confirmation; AGENTS.md "no unlock / disarm without explicit authorization"). The backend test
`test_map3d_r28_settings_2433.py` proves `none` is refused. Questions 9-10 (group D, the plan wizard) are out of scope.

## What changed

- `frontend/src/map/room-pills.ts` (new, pure): room summaries (open, presence, lights on, temperature, devices by weight), the
  grouped description (the room's name and temperature parts are taken over by its pill), distance (far / mid) and the near room.
- `frontend/src/map/room-pill-view.ts` (new): a Lit reactive controller of `sw-plan-3d` - the room pills, the popover (hover with a
  mouse, tap), the spread levels' tags and the focused level's column with "פתח את הקומה". Per-frame placement, one render only when
  the distance / near room / popover changes. HUD panels on `--sw-menu-surface` with the strong border.
- `frontend/src/map/stack-layout.ts` (new, pure): "פרוס" lifts every level by one gap (35 % of the plan's larger side, at least 4 m)
  - base parts, realistic parts and level elevations alike, so the renderer frames / cuts / lights it as any description; connectors
  are dropped while spread; focus keeps one level. Level tags with a per-level summary.
- `frontend/src/map/room-focus.ts` (new, pure + a short eased move): the room card centres its room in the stage less the card and
  comes closer; closing it returns to the previous pose (a preset or a reframe in between resets that).
- `frontend/src/components/sw-room-card.ts` (new): the room card - camera (still / live on tap, never mirrored), lights (switches,
  "כבה הכול"), climate (reading, set point stepper when the climate entity allows it), doors / windows / shutters (the entity's own
  action; a bare sensor is read-only; no grant = "אין הרשאה", no control). Side panel / corner card / bottom sheet (low: quick row +
  what is open; full: tabs). No scrolling: a long list pages.
- `frontend/src/map/sw-plan-3d.ts`: new inputs `roomPills`, `pillPrefs`, `pillsHidden`, `levelTags`, `focusRoom`, `stackDark`; the
  entity pills of a pilled room are summarised (selected / hovered stay); the layer is laid out per drawn frame. No change to the
  renderer, materials, lights or the realistic level.
- `frontend/src/screens/explore-floor-map.ts`: builds the summaries from the anchors, zones and the room state layer; applies the
  spread and the grouping to the built description; the "בניין / פרוס" switch beside the level chips (per browser,
  `sw.plan3d.stack`, default spread as in the mockup); the room card replaces the K88 room card (same `data-room-card`,
  `data-zone-id`, `data-room-open-area` hooks); its controls run through the existing `trigger()` path.
- Settings: 8 keys in `routers/settings.py` (defaults + validation), `api/media.ts` types, Settings > Map rows.
- The floors / areas tree (side list), the level chips and the floor strip are unchanged.

## Merge notes (pilot/PLAN3D-REALISM2-2433)

The realism branch (with PLAN3D-POLISH-2430) touches `sw-plan-3d.ts` (willUpdate, layoutOverlays, render: DOM room-name plates
`kind: 'label'`) and `scene-builder.ts`. Expected textual conflicts are small and local:
- `willUpdate`: keep both - its `rooms` plates and this branch's entity-pill filter. The host already removes the `room:<id>#label`
  parts of pilled rooms from the description, so the POLISH plates disappear for those rooms by themselves (no double name).
- `render()`: the `${this.pillLayer.render()}` line sits after the overlay block; keep it after the merged overlay block.
- `spreadDescription` offsets the realistic parts known on main (`parts, floors, ceilings, caps, models, lamps, shutters`); a field the
  realism branch adds to `RealWorld` with a level-bound position (AO volume, room glow) must be offset there too.

## Tests

- `frontend/tests/unit-plan3d-r28-ui.spec.ts` (node unit): settings defaults, summaries, grouping, distance / near room, spread,
  level tags, tap rule, focus pose.
- `frontend/tests/pixel-plan3d-r28-ui.spec.ts` (pixel, classic light): pills, popover, spread tags, focus column (desktop); room card
  side panel (desktop), low and full sheet (mobile). Baselines generated on the runner.
- `smplwise_vms/backend/tests/test_map3d_r28_settings_2433.py`: defaults, choices, refusal of other values, system.configure.
- Local: `tsc --noEmit` clean. The unit / pixel / backend runs are on the runner (see the commit report); not run locally (load rule).

## Known limits

- The near-room switch uses the projected room size (half the stage's shorter side, point in the middle 70 %): orbit / zoom in to a
  room to see its devices one by one; there are no +/- zoom buttons as in the mockup (wheel / pinch zoom as before).
- In spread view the realistic level's sky is the renderer's own; `stack_backdrop = dark` darkens the host backdrop (visible in the
  schematic / full levels and around a transparent canvas).
- The room card centres the room only in the 3D view (the 2D canvas keeps its pan).
- Demo floors (no API) have no room summaries: no room pills there.

Rollback: revert the branch's commits; the settings keys are ignored by an older build.
