# LIVECAM-DRAFT-RESET-2435 - live camera: per-camera state reset on an in-place camera change

Branch `pilot/LIVECAM-DRAFT-RESET-2435`, cut from `origin/main` at `665ec8f24` (v2.43.4). No merge, no version bump, no changelog entry,
no UI rebuild in the add-on, no tag. No lab, NVR, go2rtc or Home Assistant contact: mocked API routes and invented cameras only.

Source: frontend code review 2026-11-13 (`private/code-review-2026-11-13/06-frontend-screens.md`), findings **LC-1** (P1, "closest to
P0") and **LC-2** (P1). INFILE-1 / NOOP-1 / CSSLAYER-1 for this file are not part of this branch.

## 1. The defect

The shell re-uses the same `<live-camera>` element when only the camera id in the route changes (`shell/sw-app.ts`, the
`live/cameras/<id>` route is not `keyed`). `load()` replaced only `cam` / `cams`; the per-camera NVR reads (`zones`, `sched`, `smart`,
`osd`, `rec`, `reboot`, `caps`, `source`) and the drafts (`motionEdit`, `smartEdit`, `schedEdit`, `renameTo`) survived the change.

- **LC-1 (wrong NVR write).** `saveMotion` wrote `setMotion(this.cam.id, A's cells)`: a motion grid drawn on camera A and saved after
  switching the route to camera B was written to **B** on the NVR. The schedule and smart-rule drafts had the same shape.
- **LC-1 (late answers).** No load had a token, and the per-camera reload in `updated()` was skipped while `zonesBusy`: when A's zones
  read was still in flight at the switch, B never read its own zones and A's answer was then drawn (and editable) on B.
- **LC-2 (leak).** No `disconnectedCallback`: the 15 s manual-recording poll (`recTimer`, up to 120 min) kept calling
  `GET cameras/<id>/record` after the screen was left; `castNoteTimer` was never cleared.

Reproduced first with the new spec on the unfixed code (desktop): all three tests failed - a `PUT cameras/cam-2/motion` carrying the
grid drawn on cam-1; the motion chip on cam-2 showing cam-1's sensitivity (40 instead of 80); 3 record reads after leaving the screen.

## 2. The fix (`frontend/src/screens/live-camera.ts` only)

- `resetCameraState()`, called from `willUpdate` when `cameraId` changes on an existing element: bumps a generation counter `camGen`,
  clears the record and cast-note timers, and drops every per-camera read, draft, confirm dialog, busy flag and message (zones, motion,
  record, OSD, schedules, smart rules, rename, reboot, video source, capabilities, cast button / picker / note, player status). View
  choices stay (profile, zone layers, schedule tab, recording minutes). In API mode `loading` is set at once, so the switch frame already
  shows the loading panel, as `load()` did a moment later before.
- Every load (`load`, zones, capabilities, schedules + smart, OSD, record, reboot, source, cast targets) captures `camGen` and drops its
  answer, error and busy-flag reset when the camera changed meanwhile. Writes (motion, schedules, smart, OSD, record, reboot, rename) do
  the same for their follow-up state, so a late answer for A never closes or overwrites B's own editor.
- Every draft carries `camId`, the camera it was opened for (the motion draft takes it from the zones answer it was copied from). Save
  writes to `camId`, and refuses - dropping the draft with a message, no request - unless `camId` is both the loaded camera and the
  routed `cameraId` (and, for the motion grid, the camera of the zones on screen). OSD, record, reboot and rename also refuse while the
  loaded camera is not the routed one. With the reset in place this refusal is defensive only; it is never reached through the UI.
- `disconnectedCallback` clears the record poll and the cast-note timer; `loadRecord` re-arms only while connected; a re-attached element
  restarts the poll if a recording is running.

Visuals: unchanged. The same camera renders the same; the refusal message is new text that the UI cannot reach. No pixel spec covers
this screen, so no baseline was touched or refreshed.

## 3. Tests

New `frontend/tests/unit-live-camera-switch.spec.ts` (mocked `/api/v1/**`, two invented cameras):

1. Draw on camera A's motion grid, switch the route to B, press any save still offered: no `PUT .../motion` at all, the editor is closed,
   B's own grid can be edited.
2. A's zones answer delayed past the switch: B reads its own zones and shows them; A's answer is not drawn.
3. A running manual recording is polled every 15 s on the screen (Playwright clock) and not after leaving it.

Runs (local, workstation):

| Run | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| new spec, unfixed code, desktop | 3 failed (the reproduction above) |
| new spec, fixed code, desktop + tablet + mobile | 9 passed |
| existing camera-screen specs, desktop + tablet + mobile (1) | 261 passed, 110 skipped (need `SW_LIVE` / a fixture backend), 2 failed + 14 did not run (2) |

(1) `evidence-cast-ui`, `evidence-frigate-control`, `evidence-video-transport-2400`, `evidence-webrtc-first`, `evidence-webrtc-only`,
`evidence-camera-card`, `evidence-security-polish`, `unit-nvrless-cameras-2411`, `unit-video-2403`, `unit-evidence-cameras-2412`,
`unit-camera-reboot-2407`, `unit-camera-sources-2410`.

(2) Environment, not this change: `evidence-camera-card.spec.ts:235` (desktop, mobile) posts to its fixture backend on `127.0.0.1:8100`
(`ECONNREFUSED`, not running on the workstation); the 14 not run are the serial tests after it in that file. That spec drives the area
screen's camera card, not `<live-camera>`. Left to the runner's entry check.

The evidence images the specs rewrite (`docs/design/evidence/...`) were restored, not committed.
