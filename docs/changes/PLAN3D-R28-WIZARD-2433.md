# PLAN3D-R28-WIZARD-2433 - the plan wizard ("תוכנית חדשה מתמונה")

Branch `pilot/PLAN3D-R28-WIZARD-2433`, cut from `origin/main` @ `a5618fad6` (2.42.1). For the 2.43.x train. No version bump, no
CHANGELOG entry, no migration. No device, NVR, media server or Home Assistant was contacted.

Source: the approved round 28 mockup, `private/design-system-2026-10-27/round28/map3d/app/wizard.html` (seven steps) and
`index.html` section 4. The owner has not answered `questions.html` yet: the RECOMMENDED answer of each question is built, and each
choice that concerns the wizard is a setting (below).

## What it is

A guided path from a picture of a floor plan to a 3D floor with its devices, in seven steps - upload, detection, review, rooms,
style, devices, done - at `#/explore/floors/<id>/wizard`. It is a front for the Plan Studio that already exists, not a second
editor: every step uses the studio's data model and endpoints, so whatever the wizard makes stays editable in the studio.

| Step | What it does | Existing API reused |
|---|---|---|
| 1 Upload | PNG / JPG / PDF (camera capture on a phone), the floor, the ceiling height; a multi-page PDF asks for the page; DXF / IFC links to the exact import | `POST floors/{id}/plan-assets`, `POST floors/{id}/plan-versions` |
| 2 Detection | walls, openings, columns / stairs, closed rooms, scale; local, nothing leaves the installation | `POST plan-versions/{id}/detect`, `POST floors/{id}/zones/detect` |
| 3 Review | items by confidence band (sure / to check / in doubt), a pager over the ones to look at, 1-4 keys, a crop of the item, "measure a wall" | `PATCH plan-versions/{id}/calibration` (door-width estimate or two points), `POST plan-versions/{id}/detect/accept` |
| 4 Rooms | a name per room (typing an existing area's name links the room to it), a type; unnamed rooms get "חדר N" | `POST floors/{id}/zones/accept`, `PATCH zones/{id}` (tags, area) |
| 5 Style | a kit (floors per room type, starter furniture that fits), a 3D preview | `PUT plan-versions/{id}/geometry` (document 2.2 room / level materials, catalog objects) |
| 6 Devices | devices of the linked areas placed by area and type (door / lock at the room's door, window / shutter at its window, the rest at the centre); the rest are selected and clicked onto the plan; "do not place" | `GET ha/entities?placed=false` (the authorized catalogue only) |
| 7 Done | summary; "publish and open on the map" or "continue in the studio" | `POST plan-versions/{id}/publish` (publishes the structure too), `POST floors/{id}/anchors` |

Nothing reaches the viewers before "publish": the version stays a draft, and the devices are placed (anchors created) only after the
publish, one by one, never retried; a refused one is counted and shown, not hidden.

## Assumed defaults (round 28 questions, recommended answers - owner to confirm)

| Question | Built | Setting |
|---|---|---|
| 10 (ד1) What goes in without review | >= 80% in; 50-80% marked for review and in as detected when skipped; < 50% only with an approval | `auto_accept` 80, `review_min` 50, `unreviewed` as_detected / reject |
| 11 (ד2) Style kits | first phase: apartment, office, empty (lobby, technical / parking, commercial later) | `kit` (the kit chosen first), `furniture` (starter furniture on / off) |
| (mockup) devices placed by themselves | on | `auto_place` |

Questions 1-9 (room labels, room card, stacked floors) are the 3D map's overlay and belong to the parallel branches
(`pilot/PLAN3D-R28-UI-2433`); this branch does not touch them.

The settings are the user's own: `/me/prefs` key `plan.wizard` (new, `services/user_prefs.py` `_plan_wizard`: a partial object,
closed keys, whole percents 5..99, `review_min` below `auto_accept`; null = the defaults above). Edited in the wizard's own dialog
(the gear in its step bar). Presentation of the wizard only: every write it leads to is authorized by its own endpoint.

## Files

- `frontend/src/plan-wizard/` (new): `plan-wizard.ts` (the screen), `wizard-model.ts` (pure: bands, review queue, accept selection,
  room types, kits, furniture, placement by area), `wizard-backend.ts` (API / demo adapters), `wizard-draw.ts` (plan drawings via
  `map/geometry` buildPrimitives), `wizard-styles.ts`, `wizard-demo.ts` (the mockup's sample house, demo mode only).
- Entry hook (minimal): `shell/sw-app.ts` (route), `shell/lazy-screens.ts` (lazy chunk), `shell/phone.ts` (the structure guard
  covers `/wizard` like `/edit` and `/import`), `screens/explore-floors.ts` (a "תוכנית מתמונה" button next to "תוכנית חדשה").
  Nothing in `frontend/src/map/` was changed (the 3D overlay and materials branches own it); the 3D preview uses `sw-plan-3d` as is
  (`kiosk`, `qualityForce: 'full'`).
- Backend: `services/user_prefs.py`, `routers/me.py` (the `plan.wizard` key), `tests/test_user_prefs.py`.
- Tests: `frontend/tests/unit-plan-wizard-2433.spec.ts` (node), `frontend/tests/pixel-plan-wizard-2433.spec.ts` (pixel + behaviour,
  demo mode, desktop 1440 / tablet 1024; phone = the desktop-only state).

## Design

Layout, words and states from the mockup, in product tokens (`--sw-*`); the band colours are the accent / warning / danger tokens. One
fixed frame that never scrolls (the room and device lists page instead; 4 rows on a phone or a short screen). Plan geometry is
never mirrored (the canvas is `direction: ltr`). RTL, no platform names. Design skills used: impeccable (context + craft floor;
`impeccable detect` on the changed UI files: no findings), emil-design-eng (press feedback 0.97-0.98, ease-out curves, transitions not
keyframes for UI, hover gated on fine pointers, reduced motion). The mockup's "21 sure" does not add up with its own plan (8 walls + 19
openings = 27 = 19 + 5 + 3); the product counts what is there (19).

## Known limits

- The wizard keeps its state in the page: leaving it mid-way leaves the draft version (continue in the studio). "Back" from the
  review to the upload starts a new version; the earlier draft stays in the floor's version list.
- The 3D preview shows the kit's furniture; the kit's room floors show in the realistic view (level 3) and in the 2D fallback.
- Cameras are not placed by the wizard (place them in the studio / on the map); a device is "dragged" by select + click.
- The phone layout exists (mockup), but with the default mobile options the phone shows the desktop-only state; not checked on a
  real phone.
- The map header's "תוכנית חדשה" entry of the mockup lives in the 3D overlay (parallel branch); here the entry is on the floors list.

## Tests

See the closing report of the segment (commands and outcomes); nothing is claimed here that was not run.

## Rollback

Revert the branch's commits. The `plan.wizard` pref rows, if any, are ignored by an older server (unknown keys are skipped on read).
