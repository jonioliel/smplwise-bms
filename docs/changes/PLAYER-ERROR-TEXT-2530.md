# PLAYER-ERROR-TEXT-2530 - the relay's fixed error codes as sentences in the live / recording player

Branch `pilot/PLAYER-ERROR-TEXT-2530`, base `origin/release/2530-train` (`8ae83adfa`). Spec: VIDEO-SECFIX-2520 open question 1, the
recommended option (a: "a later UI row maps `upstream_error` to a readable sentence"), widened by the row card to every fixed code the
relay can send. No backend change, no version bump, no changelog entry, no lab / Home Assistant / NVR / go2rtc contact.

## 1. What and why

Since 2.52 (VIDEO-SECFIX-2520, deep review V-01) the relay never forwards go2rtc's own error text: a viewer's socket receives fixed
codes only. The player (`sw-live-player.ts`, which is also the recording player: `wsUrl` = a playback session's socket) still printed
the value - "שגיאת זרם: upstream_error" / "Stream error: upstream_error", and on an `auto` WebRTC LAN chain the bare value as the
whole message.

- **One table**: `frontend/src/api/stream-errors.ts` - `streamErrorText(code, kind)` (the sentence) and
  `streamErrorHint(code, kind, autoRetry)` (the retry hint). `kind` is `live` (a camera) or `recording` (a playback socket).
  An unknown, empty or raw value gets the generic sentence "שגיאה בזרם הווידאו" / "Video stream error" - never the value. The code
  still reaches the console line and the `player-status` event's `code`, as before.
- **The codes** a viewer's socket can carry (read from the backend source by the unit spec, so a new code without a sentence fails it):

| Code | Sent by | What the player says now |
|---|---|---|
| `upstream_error` | `services/relay.sanitize_upstream_frame` (recorder / manual-source live, playback, intercom) | live: "שרת הווידאו לא הצליח לקבל את השידור מהמצלמה" (The video server could not get the stream from the camera); recording: "...את ההקלטה מהמקליט" (...the recording from the recorder) + hint |
| `upstream_unavailable` | HA camera route (`ha_camera_streams.LIVE_ERROR_VALUE`); relay could not reach go2rtc (`_json_dumps_error`) | unchanged: "שירות הווידאו לא זמין" with its "נסה שוב" button (the same constant, so the button logic is untouched) |
| `access_lost` | lease re-check (`routers/media`) | unchanged: "ההרשאה לצפייה במצלמה הזו הוסרה", no retry |
| `presence_required`, `service_account` | `routers/media._refuse_socket` (then close 4403) | new: "כדי לצפות בווידאו מהאפליקציה יש להפעיל את שיתוף הנתונים הנדרש" / "חשבון שירות אינו יכול לצפות בווידאו"; **a denial: no retry** (it used to show "שגיאת זרם: presence_required" and retry with backoff, since the 4403 close is not seen after the frame tore the socket down) |
| `media_unavailable`, `media_not_configured` | `routers/media.refuse_media` | unchanged - the video-service-down state answers first (`frameSaysDown`); the table maps them to the same sentence for completeness |
| `remote_live_cap`, `h265_unsupported`, `transcode_cap` | `routers/media` | unchanged - their own states (cap view, H.265 notices) answer first |
| anything else | - | "שגיאה בזרם הווידאו" (Video stream error) + the generic hint |

- **Retry hint** (a `.hint` line under the sentence, the existing style of the video-service-down hint; hidden on compact tiles):
  when the player reconnects by itself (`retry` on): "ננסה שוב אוטומטית; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת" (recording: "שהמקליט
  מחובר ופועל"); when it does not (recording players, `retry=false`): "נסו שוב בעוד רגע; אם זה נמשך, ...". Unknown code: "... פנו
  למנהל המערכת". No hint for a denial or for "the video service is down" (that state has its own hint and button). The hint is shown
  only when the failure ends on the frame's own sentence (`streamErr` + `fail()`), so a composed message (plan exhausted) has none.
- **Remote plans (laddered)**: the last failure used to say the generic "שגיאה בזרם הווידאו"; it now says the code's sentence
  (`upstream_error` -> the camera sentence). The WebRTC-step reason "WebRTC נכשל" is unchanged.
- **Playback screen** (`investigate-playback.ts`): `presence_required` / `service_account` join `FINAL_CODES`, so a tile refused for
  its caller is not resumed automatically (as 4403).
- English: every new text is in `src/i18n/lang/en/i18n/msg/api-video.ts`; the two components-table entries no longer used
  ("שגיאת זרם: {v}", "שגיאה בזרם הווידאו") are removed from `components.ts`.
- Not changed: the connection-test tool (`api/video-conn-test.ts`) still names the relay code in its diagnostic verdict ("שרת הווידאו
  סירב להצעה (upstream_error)") - a diagnostics report, where the fixed code is useful and safe.

## 2. Files

- `frontend/src/api/stream-errors.ts` (new) - the table.
- `frontend/src/components/sw-live-player.ts` - every error-frame text goes through the table; `errorHint` / `streamErr`; the denial
  branch; the hint line in the error view.
- `frontend/src/screens/investigate-playback.ts` - `FINAL_CODES`.
- `frontend/src/i18n/lang/en/i18n/msg/api-video.ts`, `components.ts` - English.
- Tests: `tests/unit-player-error-text-2530.spec.ts`, `tests/evidence-player-error-text-2530.spec.ts`,
  `tests/pixel-player-error-text-2530.spec.ts` (+ Linux baselines), `tests/player-error-text-2530-shots.spec.ts` (captures only,
  `SW_SHOTS=1`), `tests/player-error-text-2530-harness.ts` (the fake relay).

None of these files is owned by the WisKey / bridge rows or DESIGN-LITERALS-2510. No new colours or sizes (design ratchet unchanged).

## 3. Tests

Frontend checks and Playwright ran on the Linux runner (`~/work/slotb.sh`, job `p2520_playererr_run.sh`) at `886885308` (the
product code of this head; the commit after it adds only the baselines and this note). The PC ran one unit file.

| Run | Command | Exit | Result |
|---|---|---|---|
| PC, the new unit file | `npx playwright test -c playwright.unit.config.ts tests/unit-player-error-text-2530.spec.ts` | 0 | 9 passed |
| Runner, type check (app / tests) | `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | 0 / 0 | clean |
| Runner, eslint on the changed files | `npx eslint <10 files>` | 0 | 0 errors (5 "file ignored" warnings: test files are outside the lint config) |
| Runner, language packs / i18n report / design ratchet / unused exports | `i18n-split-langs.mjs --dry`, `i18n_missing_keys.mjs`, `design_ratchet.py`, `unused-exports.mjs` | 0 each | nothing moved; hard-coded Hebrew 0; no count above the baseline; no new unused export |
| Runner, unit (targeted, 10 files: this row's, `unit-i18n-en-ratchet-2490`, `unit-i18n-lang-packs-2443`, `unit-i18n-core`, `unit-health-go2rtc-2430`, `unit-video-2403`, `unit-warmup-polish-2421`, `unit-fe-promises-2442`, `unit-skin-qa-followup-2404`, `unit-camera-card-definition`) | `playwright test -c playwright.unit.config.ts ... --workers=2` | 0 | 72 passed |
| Runner, build | `npm run build` | 0 | - |
| Runner, new pixel baselines (desktop + phone, light + dark) | `pixel-player-error-text-2530.spec.ts --project=desktop --project=mobile -u` | 0 | 4 passed (4 baselines written) |
| Runner, the same pixel spec without `-u` | same, no `-u` | 0 | 4 passed, 0 skipped-pixel |
| Runner, evidence + pixel regression of every player screen (desktop): this row's evidence (7) and 14 player evidence files + `pixel-skin-qa-followup-2404`, `pixel-wiskey-station-media` | `playwright test <17 files> --project=desktop --workers=2` | 1 | **89 passed, 33 skipped, 1 failed** - all 7 of this row passed |
| Runner, before / after captures | `SW_SHOTS=1 ... player-error-text-2530-shots.spec.ts` on the branch and on the base `8ae83adfa` | 0 / 0 | 24 + 24 pictures |

The one failure is **not this row's**: `evidence-camera-card.spec.ts:247` ("real backend, fake media stack") needs a running backend on
port 8100 (`apiRequestContext.post: connect ECONNREFUSED ...:8100`); none was started for this job. BLOCKED here (environment), not
re-run with a backend.

Compare page (local, not in git): `private/planning/player-error-text-2530_compare_2026-11-25.html` - six cases, desktop + phone,
light + dark, before / after.

NOT_RUN: the full frontend suite (only the player files above), the tablet project, the backend (no backend change), any lab check
(a real go2rtc error on a real camera / recorder).

## 4. Open questions (recommendation first)

1. A "נסה שוב" button next to the hint when the player does not retry by itself (recording players)?
   a. (recommended) No - the recording screens own their resume (investigate-playback resumes by itself; the event players re-open the
      session); the hint is enough.
   b. Yes, on non-compact tiles.
2. The connection-test tool still shows the fixed code in its verdict.
   a. (recommended) Keep - it is a diagnostics report and the code is fixed and safe.
   b. Map it through the same table.
