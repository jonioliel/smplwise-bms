# PLAN3D-R28-WIZARD2-2434 - the plan wizard, round 2 (cameras, backend-backed tests, back-to-upload, resume)

Branch `pilot/PLAN3D-R28-WIZARD2-2434`, cut from `origin/pilot/PLAN3D-R28-WIZARD-2433` @ `63c008eab` (that branch stays as it is in
the entry-check queue). For the 2.43.x train. No version bump, no CHANGELOG entry, no migration, no server change. No device, NVR,
media server or Home Assistant was contacted.

Closes the four known gaps of `docs/changes/PLAN3D-R28-WIZARD-2433.md`.

## 1. Cameras in the devices step

- The devices step has two tabs, "התקנים" and "מצלמות" (shown only when there is a camera to place). The cameras are the ones the
  map bundle (`GET floors/{id}/map?draft=true`) lists for this editor - exactly the cameras it may place (placement.edit on their
  chain, T055) - minus the ones already on this floor.
- A camera has no area, so none is placed by itself: select, click on the plan, and it is placed there ("הוצבה במקום שסימנת");
  "הסר מהמפה" takes it off again. A camera without a place is simply not placed (no warning colour). On the plan a camera is a
  rounded square, a device a dot (legend "מצלמה").
- Same semantics as the devices: placed only after the publish, one `POST floors/{id}/anchors` (`resource_type: camera`, default
  layer `cameras`) per item, never retried. The summary counts "מצלמות שיוצבו"; a refused item is named in the done step with its
  reason (אין הרשאה / כבר הוצב / לא קיים / נדחה), the first three and "ועוד N".
- New guard: the server places a new anchor on the floor's newest DRAFT when one exists (`routers/anchors.py _editor_version`). If
  another draft is still open after the wizard's publish, the wizard places nothing and says why (publish or delete that draft in
  the studio, then place from the map) - the items would otherwise stand on that draft, not on the published plan. Shown by the
  characterization test below.

## 2. Backend-backed tests

`smplwise_vms/backend/tests/test_plan_wizard_api_2434.py` drives the exact sequence of `wizard-backend.ts` ApiBackend against the
test app, on a floor that already has a published plan: upload -> version with the wizard's note -> draft + detect -> door-width
estimate -> accept -> room detection -> room accept -> tags / area link -> the styled draft (level and room materials, a
`plan-wizard` object) -> publish -> devices and cameras one by one (a duplicate camera 409 `already_placed` and an unknown one 422
counted). Checks: room detection runs on the new draft (`plan_version_id`), the accepted rooms belong to it, nothing reaches the
map before the publish, the old version is archived, the structure and rooms are published with the version, the anchors stand on
the published wizard version, `placed=false` no longer offers a placed device. Plus: a floor editor's camera it does not reach is
refused 403 and counted; the back-to-upload discard; the characterization of the abandoned draft taking the anchors; the resume
lookup.

## 3. "Back" from the review to the upload - reuse (chosen), discard only on an explicit yes

The safer option is reuse: "back" keeps the version. Step 1 says "התוכנית שהעלית נשמרה"; "המשך" runs the detection again on the
same version (accept with `replace_auto` replaces the earlier automatic items), so no second draft is made. A different file (or
another page of the PDF) asks first ("להחליף את התוכנית?"): yes discards the earlier wizard draft - its rooms, then the version
(`DELETE plan-versions/{id}`, which the server refuses for anything but a draft without anchors) - and then starts the new pass;
"ביטול" changes nothing. A wizard draft is never left behind, because a draft left open would receive the devices the wizard
places after the publish (see 1). If the discard fails, the new file is not loaded and the error says so.

## 4. Resume

When the floor's newest draft carries the wizard's note (`notes = "אשף תוכנית חדשה"`, `WIZARD_NOTE`), step 1 shows "יש כאן טיוטה
של האשף שלא הסתיימה" with the time it was started and "המשך באשף" / "פתח בסטודיו". Continue: a draft without accepted structure
runs the detection again (review); a draft with structure goes to the rooms step with its own rooms (the floor's automatic zones of
that version, their type read back from the tags) or, without any, a fresh room detection. "Back" from those rooms re-runs the
detection. A newer studio draft hides the offer (the wizard does not take over the studio's draft). Uploading another file while
the offer stands asks to discard that wizard draft, as in 3. The kit and the review choices of the earlier visit are not restored
(the kit comes from the settings; the review answers are in the draft already).

## Files

- `frontend/src/plan-wizard/`: `plan-wizard.ts` (tabs, camera placement, keep / replace / resume, refusal text, replace dialog),
  `wizard-backend.ts` (`cameras`, `resumable`, `resumeRooms`, `discard`, publish with `resource_type`, the other-draft guard,
  `PublishResult`, `WIZARD_NOTE`), `wizard-model.ts` (`cameraPlacements`, `isCamera`, `roomTypeOfTags`, `Placement.resource`),
  `wizard-draw.ts` (camera marker), `wizard-styles.ts`, `wizard-demo.ts` (`DEMO_CAMERAS`).
- `frontend/src/shell/sw-app.ts`: the route passes `?resume=1` (demo screenshots only).
- Tests: `smplwise_vms/backend/tests/test_plan_wizard_api_2434.py`, `frontend/tests/unit-plan-wizard-2434.spec.ts`,
  `frontend/tests/pixel-plan-wizard-2434.spec.ts` (new baselines: cameras tab, kept plan, replace dialog, resume card), and the
  2433 step 6 / 7 baselines refreshed (the tabs and the cameras row).

## Design

Product tokens only; the switch is a two-segment control (selected = surface + shadow-1), the resume and kept-plan cards use the
accent-soft surface, the dialog's destructive action is the `danger` button. Press feedback 0.97, ease-out transitions, no layout
animation. No scroll: the side panel drops the tips card while a resume / kept card shows; lists still page. RTL; plan geometry is
not mirrored. Design skills: impeccable (context + craft floor, `impeccable detect` on the changed files), emil-design-eng.

## Known limits

- A camera already placed on another floor is still offered (the bundle does not say where else a camera stands; a camera may
  stand on two floors).
- The other-draft guard checks once, after the publish; a draft opened in another window during the placement is not seen.
- Not checked on a real phone (the phone shows the desktop-only state, as in 2433).

## Rollback

Revert the branch's commits. Nothing is stored that an older build does not read.
