# Playback stall detection and automatic resume (release 2.0.0)

Branch `pilot/playback-stall-detection` (base `origin/main` 1cd6aa72 = 0.1.163). Every recorder vendor: the logic works on the
browser player's media clock and on the existing session / generation API, never on vendor specifics.

## 1. Finding

Live playback measurements (CR-025 section 6.4, Provision-ISR on the HA2 go2rtc): when the recording source stops (network drop,
recorder stall) the playback screen keeps showing "playing" with a frozen picture and tells the operator nothing. go2rtc reconnects to the
source by itself, but in one of four tests the video did not come back within 60 s, while the screen's own "resume from the current
position" (a new start = a new generation at the same position) played again in about 9 s (8.6 s measured in the accepted third run).
The test-run detail that one of four drops did not recover within 60 s is the owner's measurement brief; this repository's CR-025 records
the 8.6 s resume and states that a faithful network drop was not yet measured (section 6.4, third run).

## 2. Behaviour

| Phase | What the picture says | When |
|---|---|---|
| ok | nothing | media advances, or the screen does not expect it to (paused, scrubbing, no session) |
| stalled | **מתחבר מחדש** (spinner) | an armed tile has not advanced for `playback.stall_s` (default 5 s), or a tile lost its connection / ended away from the end of its range |
| reconnecting | **מתחבר מחדש** | the grace period (2 s) or the back-off has passed and no request is in flight: the screen sent "resume from here" |
| gave_up | **הניגון נעצר** + **נסה שוב** | `playback.auto_resume_attempts` (default 3) attempts failed; the session is released |

- **Resume = the existing seek.** `startAt(position)` → `POST /playback/sessions/{id}/seek` (single) or `POST /playback/groups/{id}/seek`
  (group): a new generation of the same session at the position the picture froze on (`requested_at` + the media time). The server deletes
  the old generation's go2rtc stream (`smplwise_pb_<session>_g<n>`) and closes its socket with 4410, exactly as for an operator's seek.
  An expired session (404 / `session_over`) is recreated by the same path. Near the end of the range (< 3 s) the target is the next
  instant, as the existing end-of-range continuation does.
- **Back-off and cap.** First attempt after a 2 s grace (go2rtc may recover by itself - then the state clears with no request); a failed
  attempt (the request failed, the new generation lost its connection, or no progress within 20 s of the request returning) waits 3 s,
  then 6 s; after the cap: gave_up. The attempt counter only returns to 0 after 30 s of continuous progress, so a flapping source ends in
  gave_up instead of looping. A resume is only asked for while no start / seek is in flight.
- **Gave up releases the session** (`DELETE /playback/sessions/{id}` or the group close), so nothing keeps pulling from the recorder;
  "נסה שוב" starts a new session at the stop position. Any operator move (seek, ±10 s, camera, day, comparison tiles) clears the state.
- **Groups: all or none.** The watch tracks every tile; one frozen tile is a stall of the group and the resume is one group seek (every
  member a new generation, the barrier and the master clock start again). A member re-seeked alone for drift (T042) is disarmed until it
  advances again, so a deliberate restart is never a stall.
- **Never a stall:** pause, scrubbing, slow motion (0.25x advances 0.125 s per tick), a slow first start (a tile is armed only after its
  media advanced once; a cold go2rtc producer took 18.6 s to the first frame), the end of the range.
- **Never resumed:** close codes / relay errors 4401, 4403 (denial), 4410 (another seek owns the session), 4429 (quota), `access_lost`,
  `remote_live_cap`. The live player now puts the close code / relay error value in its `player-status` event (`code`) for this.
- **Live and live-like playback.** The live view keeps its own retry ladder (`sw-live-player` with `retry`); this change covers the
  recordings screen for any day, including today's recording close to the present (the end-of-range continuation is unchanged).
- **Skins and widths.** The state sits on the picture (single video or the comparison grid) in white on the video's own dark shade, the
  same in all four skins and both schemes; it never covers the controls bar under the picture. One short line, no paragraph, no platform
  name; the diagnostics line (when shown) adds "חיבור מחדש: n/max · הצליחו m".

## 3. Settings

| Key | Type | Default | Meaning |
|---|---|---|---|
| `playback.stall_s` | int 2-30 | 5 | seconds without media progress before "מתחבר מחדש" |
| `playback.auto_resume_attempts` | int 0-5 | 3 | automatic attempts before "הניגון נעצר"; 0 = detect and stop |

הגדרות › כללי › וידאו ומדיה → "זיהוי תקיעה בניגון (שניות)", "ניסיונות חיבור מחדש אוטומטיים". Read by the browser only.

## 4. Files

- `frontend/src/api/playback-stall.ts` - the pure state machine (`StallWatch`), no timers, sampled with the screen's clock.
- `frontend/src/screens/investigate-playback.ts` - sampling every 500 ms tick, auto-resume through `startAt(..., { auto: true })`,
  give-up / retry, the overlay, the diagnostics line.
- `frontend/src/components/sw-live-player.ts` - `code` in the `error` / `ended` events.
- `frontend/src/screens/system-diagnostics.ts`, `frontend/src/api/media.ts` - the two settings rows.
- `smplwise_vms/backend/smplwise/routers/settings.py` - the two settings (defaults, integer keys, validation).

## 5. Tests

| Test | Kind | Result (2026-10-05, PC, Node 24 / Python 3.12) |
|---|---|---|
| `frontend/tests/unit-playback-stall.spec.ts` (16) | unit, fake clock | passed |
| `frontend/tests/evidence-playback-stall.spec.ts` (5) | Playwright, mocked backend + `routeWebSocket`, stubbed media clock | passed |
| `frontend/tests/layout-playback-stall.spec.ts` (4 skins x light/dark x 320/390/1440, reconnecting and gave up) | layout guard | passed, 0 findings |
| `frontend/tests/evidence-playback-controls-below.spec.ts`, `evidence-playback-display.spec.ts` | regression | passed |
| `smplwise_vms/backend/tests/test_playback_stall_settings.py` + `test_playback_cap.py` + `test_ui_settings.py` | backend | passed |

All fixture / mock tests: no real recorder, no go2rtc write, no lab access.

## 6. Not measured / open

- The recovery time after a **real** network drop on a real recorder (needs an owner-approved session that cuts the path to the NVR for a
  moment, or a fake RTSP source that can freeze in a test rig). The defaults (5 s, 2 s grace, 20 s per attempt) come from the measured
  first-frame times (7.7 s warm, 18.6 s cold) and the measured 8.6 s resume.
- Whether the backend should also watch the go2rtc producer of a session (bytes stopped) and close the socket itself - not needed for the
  browser path, left as an option.

Rollback: revert the branch's commits; the two settings stay in the database as unused keys (harmless).
