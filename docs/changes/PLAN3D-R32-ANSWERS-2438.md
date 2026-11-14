# PLAN3D-R32-ANSWERS-2438 - the 3D map: the owner's round 32 answers (Q-MAP-1 .. Q-MAP-20)

Branch `pilot/PLAN3D-R32-ANSWERS-2438`, cut from `origin/pilot/PLAN3D-R28-UI-2433` @ `b6024ea8b` (round 28 UI, in the entry queue):
that branch holds the files these answers change (room pills, room card, spread levels, `map.*` settings). It also touches
`frontend/src/screens/explore-floor-map.ts`, which `pilot/AUDIT30-COMBINED-2435` changes too (MASTER_PLAN appendix A): the two hunks
here are one attribute and one fallback in the 3D / room-card render lines, away from AUDIT30's header (`sw-page`) hunks - expect no
textual conflict. No version bump, no migration (`plan.view` is one JSON value; an older stored value without the new dials reads
their defaults).

Source: `private/planning/OWNER_ANSWERS_ROUND32_2026-11-14_HE.md` section "3D map"; question text in the `#qdata` block of
`private/design-system-2026-10-27/round32/all-questions/index.html` (Q-MAP-1..10 = round 28 `questions.html`, Q-MAP-11..20 = the
round 30 look-dev `round30/map3d-lookdev/`).

## Per answer

| # | Answer | State | Where |
|---|---|---|---|
| MAP-1 | one label per room | already in R28 (`map.room_pills` = room) | - |
| MAP-2 | tap -> small popover -> room card | already in R28 (`map.room_pill_tap` = popover) | - |
| MAP-3 | quiet room = name only | already in R28 (`map.room_pill_quiet` = name) | - |
| MAP-4 | side panel, room recentres | already in R28 (`map.room_card_place` = side, room-focus.ts) | - |
| MAP-5 | confirm doors / gates / alarm only | already in R28 (`map.room_card_confirm` = system; "none" is never a choice) | - |
| MAP-6 | b: live video at once | **done**: default `map.room_card_camera` = live (server + client fallback + `sw-room-card` default); the live player (sub stream) starts when the card opens and stops when it closes (the element unmounts); switching rooms in live mode plays the new room's camera at once (was: back to the still) | settings.py, sw-room-card.ts, explore-floor-map.ts |
| MAP-7 | by scheme + hour, plus a fixed light / dark lock | **done**: `map.stack_backdrop` = theme / **light** / dark; a lock sets the host backdrop and locks the realistic level's sun to day / night while spread | settings.py, stack-layout.ts, sw-plan-3d.ts, room-pill-view.ts |
| MAP-8 | two taps, settable | already in R28 (`map.stack_pick`) | - |
| MAP-9 | >80 in, 50-80 flagged, <50 approval; thresholds in settings; editor removes auto items | thresholds already in the wizard (R28 WIZARD); **done**: the same thresholds, the unreviewed rule and the first kit in the settings section; the editor's detection card gains "הסר את כל מה שזוהה אוטומטית (N)" with a confirmation - one undoable edit removing unlocked `source: auto` walls / openings / objects (openings on a removed wall go too) | system-plan-view.ts, candidates.ts, plan-studio-panel.ts, explore-plan-editor.ts |
| MAP-10 | six kits | **done**: lobby, technical + parking, commercial added (apartment, office, empty existed); the library has no stone floor, so lobby / shop lay the large grey tiles; the style step lays the six in two columns; server accepts the new ids | wizard-model.ts, wizard-prefs.ts (new), plan-wizard.ts, wizard-styles.ts, user_prefs.py |
| MAP-11 | polished Calacatta default, settable, + Travertine | **done**: the marble is re-tuned to Calacatta (brighter ground, fewer bolder grey-gold veins, more polish); new finish `travertine` (warm beige, vein-cut layers, pores, honed, reflectivity 0.3) | floor-finish.ts, floor-reflect.ts, plan_view.py |
| MAP-12 | gloss as mockup, auto-off on weak devices, settable | reflections already existed (`floor_reflections`); **done**: new flag `reflections_auto` (default on) - off on a weak GPU | sw-plan-3d.ts, plan_view.py |
| MAP-13 | low cut walls | **done**: `wall_cut` = low (1.25 m, never above 0.6 of a low ceiling) / mid (0.6 of the ceiling, before); the section caps move to the cut | scene-real.ts (sectionCutY), scene-three.ts applyCut |
| MAP-14 | day / evening / night by the hour + lock | **done**: `light_mood` = auto / day / evening / night; a lock draws today's sun at a computed moment (day = highest sun, evening = sun at 6 deg, night = sun at -12 deg); the slider still wins | sun.ts moodInstant, sw-plan-3d.ts |
| MAP-15 | c: sky as today, settable | already existed (`backdrop` = sky / studio) | - |
| MAP-16 | wall-top bar + floor perimeter | **done**: `room_marks` = bar_edge (default) / floor (the floor tint of before) / bar | room-glow.ts, room-glow-mesh.ts |
| MAP-17 | thin amber wall-top bar for a light on | **done**: `light_mark` = bar (default) / none / bar_floor | same |
| MAP-18 | slow pulse, settable, reduced motion | **done**: `alarm_motion` = pulse / steady; a room's triggered alarm panel is now drawn at all (red plate at levels 1-2, red bar + line + band at level 3); the pulse stops with the motion dial off or `prefers-reduced-motion`. A fast flash is deliberately not offered (photosensitivity) | scene-builder.ts, scene-three.ts, room-glow*.ts |
| MAP-19 | furniture detail as is, settable | already existed (`furniture` = models / procedural) | - |
| MAP-20 | weak device: drop floor reflection first | **done**: the frame probe turns the reflections off for the session first and measures again; only then a rung drops (auto) or is offered (chosen rung); state marks never drop | sw-plan-3d.ts onLowFps |

## One "מפה תלת־ממדית" settings section

Settings > Map: the card "תצוגה ריאליסטית" is now "מפה תלת־ממדית" and holds every 3D map setting: the round 28 rows (moved out of the
"מפה" card; installation values, saved with the card's button in the same PATCH as `plan.view`), the look dials (old and new), the
state marks, time and light, the plan wizard's thresholds (a person's own `/me/prefs plan.wizard`, saved at once, "ההעדפה שלי"), walk,
quality. Groups: תוויות וכרטיס החדר, כל הקומות, מראה, סימוני מצב החדר, שעה ואור, תוכנית חדשה מתמונה, סיור בגובה עין, איכות ומסכים.

New `plan.view` dials (frontend `api/plan-view.ts` = backend `services/plan_view.py`): `wall_cut` (low | mid), `light_mood` (auto | day |
evening | night), `room_marks` (bar_edge | floor | bar), `light_mark` (bar | none | bar_floor), `alarm_motion` (pulse | steady),
`reflections_auto` (bool); `floor_finish` gains `travertine`. All personal except `floor_finish` (content, installation only, as before).

## Tests

Run locally (workstation, `--workers=1`):

- `npx tsc --noEmit`: clean.
- node unit (`playwright.unit.config.ts`, one file per run): new `tests/unit-plan3d-r32-answers.spec.ts` 11 passed; `unit-plan3d-floor-finish`
  5, `unit-plan3d-level3` 7, `unit-plan3d-r28-ui` 14, `unit-studio6-ui` 5, `unit-plan3d-room-glow` 8, `unit-plan-wizard-2433` 6 (six kits,
  every starter item sized), `unit-plan3d-sun` 9, `unit-token-lint` 7 - all passed. (Running the nine files in ONE playwright invocation
  fails at load with lit-html `createTreeWalker` in node - a cross-file module-load effect of the unit config, seen before any test ran;
  each file alone passes.)
- backend (`pytest -p no:xdist`): `test_plan_view_settings.py`, `test_map3d_r28_settings_2433.py`, `test_user_prefs.py` - 74 passed.

Runner: see the commits after this note (pixel baselines refreshed with `-u`, entry check queued).

NOT_RUN locally: pixel / WebGL specs (runner only), the full suites, a real GPU look at the Calacatta / travertine floors and the bars at
the real lab floors, a real weak device (the reflection drop is driven by the existing frame probe; the GPU class by `detectGpuClass`).

## Known limits

- The lobby and commercial kits use `tiles_grey` for "stone" (no stone floor in the material library); technical + parking places floor
  markings (`parking.space`) and the server rack only ("בלי ריהוט").
- The light lock of the spread view uses the realistic level's sun; the schematic / full levels show the host backdrop only (as R28's
  dark lock did).
- The wall-top bar sits on the section cut of the top shown level; lower levels (all floors as a building) carry it at their wall tops.
- A locked mood computes today's moment once per date / site (cached), the zone offset taken at noon (DST switches at night).

Rollback: revert the branch's commits. The new `plan.view` dials are ignored by an older build; `map.room_card_camera` / `map.stack_backdrop`
values stay valid choices of the older server except `light` (an older server refuses that value: set it back to `theme` first).
