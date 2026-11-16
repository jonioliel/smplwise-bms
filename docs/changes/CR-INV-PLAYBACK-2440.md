# CR-INV-PLAYBACK-2440 - playback and history map: stale answers, per-tick work, the retry bound

Plan row: `pilot/CR-INV-PLAYBACK-2436` in the code-review master plan (review report 06: RACE-2, RACE-5, PERF-1, PERF-2 and the
retry bound of PLAY-2). Branch `pilot/CR-INV-PLAYBACK-2440`, based on `pilot/CR-POLL-SCREENS-B-2440` (`4eddadb04`) because it uses
that branch's `api/latest.ts` ("the newest read wins"). No behaviour change beyond the defects below; no pixels.

Resumed work: the first agent stopped mid-branch with the four source files and the unit spec uncommitted. The half-done work was
checked against the row and kept as it was; the resume added the per-bundle memo of the canvas's anchor positions (named in PERF-2,
still built inline in both renders), its assertion in the unit spec, and this note.

## What changed

| Finding | Before | Now |
|---|---|---|
| 06:RACE-2 | History map `init()` (another floor / instant from the address) and `loadDay()` (another date) had no token: a slower, older answer overwrote the newer one. | `initReads` / `dayReads` (`Latest`): only the newest read is drawn; a stale `init` no longer clears `loading` of the newer one. |
| 06:RACE-5 | Playback: `selectCamera` set `cameraId`, `updated()` took that as a route change and selected the camera again - a second `endSession()` and the day read twice. `loadRecordings` had no token. | `appliedCamera` remembers what `init` / `selectCamera` applied; `updated()` selects only when the address names another camera. `recReads` drops the answer of the camera or day that was left. |
| 06:PERF-1 | Every tick (twice a second) rebuilt `segmentsMin`, `markers`, `bookmarkMarkers` as fresh arrays (the timeline saw changed properties), built an `Intl.DateTimeFormat` per element, and ran `masterPlayer()` (`querySelectorAll`) once per speed button. | The three lists are identity-memoised on what they are built from (`RefMemo` in `map/memo.ts`); one formatter per zone in `api/recordings.ts` (an unknown zone still throws, nothing cached); `masterPlayer()` queries once; the transport is read once per render. |
| 06:PERF-2 | History map: every animation frame of a playback rebuilt the segments of every camera, the timeline events, the 3D camera list, `zonesWithChips` and the anchor positions. | Memoised: segments per camera per `(recordings, tz)`, the timeline lists per `(data, tz, selected camera, layer switch)`, cameras / zones / anchor positions per bundle list. Both renders (plain and time scrub) use the same helpers. |
| 06:PLAY-2 (retry bound only) | `session_over` / `not_found` on a seek recursed into `startAt` with no bound; a create that itself answers `not_found` looped. | `retryLostSession(code, hadSession, retried)`: once, and only when there was a session to lose. The second answer is shown as the error. |

Not in this branch: PLAY-2's grid height (a no-scroll item of `CR-NOSCROLL-LISTS`); `entityStates` of the plain history render stays
per frame (it depends on the minute).

## Files

- `frontend/src/api/recordings.ts` - zone formatter cache, `retryLostSession`.
- `frontend/src/screens/investigate-playback.ts` - `appliedCamera`, `recReads`, memoised lists, the bounded retry, `masterPlayer()`.
- `frontend/src/screens/investigate-history-map.ts` - `initReads`, `dayReads`, the frame memos.
- `frontend/tests/unit-inv-playback-2440.spec.ts` - new (Node only).

Outside my rows: `frontend/src/map/memo.ts` - `RefMemo` added beside `sameRefs` (additive, nothing existing changed).

## Tests

- `npx tsc --noEmit`: clean.
- `npx playwright test -c playwright.unit.config.ts tests/unit-inv-playback-2440.spec.ts tests/unit-history-replay.spec.ts tests/unit-playback-scrub.spec.ts tests/unit-playback-stall.spec.ts --workers=1`: 50 passed.
- NOT_RUN: the browser evidence specs of the two screens (`evidence-playback-*`, `evidence-history-map`, `evidence-bookmarks`, `evidence-sync`, `evidence-speeds`, `evidence-replay-3d`) - free memory was 0.24 GB at the time, under the 1.5 GB rule; left for the combined branch's entry check on the runner.

Pixels to refresh: none (no markup or style change).
