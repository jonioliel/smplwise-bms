# CLIENT-RESILIENCE-2540 - frontend client plumbing (review FC-05, FC-03, FC-06, SCR-23 with FC-12)

Target 2.54. Base `origin/release/2530-train` at `aeb05ad3d`. Branch `pilot/CLIENT-RESILIENCE-2540`.
Findings: `docs/review/DEEP-REVIEW-2520-FRONTEND-CORE.md` (FC-03, FC-05, FC-06, FC-12) and
`docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (SCR-23). All four were still present at the base (checked in the code before
the fix; the new tests fail there - see "Before / after").

## What and why

### FC-05 - no request waits for ever
- `api/client.ts`: a plain JSON read through `api()` (`GET` / `HEAD`, no body, no caller signal) gets a default deadline of
  `GET_DEADLINE_MS` = 60 s, per attempt and covering the body. It is an `AbortController` (the connection is let go, not left
  half-open) and rejects with the new `ApiUnreachable('timeout')`, a `TypeError`, so every screen's existing "no connection" state and
  `describeError` treat it as a network failure. A shared in-flight GET therefore always settles; the next caller asks the server again.
- The wait for a token refresh (401) or a step-up confirmation (403) between two attempts does not count against the deadline, and the
  refusal's body stays readable.
- Writes, uploads, `apiBlob` and `apiResponse` keep no default deadline (a write the server finishes after the page gave up would be
  reported as failed; a large export may take long). A read with its own abort signal keeps it (the caller owns its lifetime).
  `get(path, { timeoutMs })` sets or (0) removes the deadline per call.
- `api/live-refresh.ts`: a watchdog. A read still running after max(3 min, 5 periods) no longer holds its source (long enough that the
  existing "no overlap however long a read takes" checks of `unit-poll-controller.spec.ts`, 4 periods, still hold; the client's own 60 s
  deadline ends a client read first): it counts as a
  failure, the source is armed again, its late answer is ignored - polls, resume and the retry button work again.

### FC-03 - "unreachable" is not "signed out" (remote channel)
- `arx/auth.ts`: `refreshOutcome()` = `'ok' | 'retry' | 'ended'` (`refreshNow()` stays, = `ok`). `retry` = no connection or a 5xx at the
  sign-in service or the session exchange - the tokens are kept and the 30 s retry is armed as before. `resume()` returns the same
  outcome; a fresh token whose exchange fails with no connection / 5xx is `retry` (it threw before, which showed the sign-in form).
- `arx/boot.ts`: the 401 handler reloads only on `ended`; on `retry` it answers `'unreachable'` and the client fails the request with
  `ApiUnreachable('signin_unreachable')` - like an offline request, the session (`session.ts`) keeps what it knows and retries.
- Start-up on `retry`: the new `arx/arx-reconnect.ts` shows the shell's own offline state (`sw-state-panel state="stale"`: "אין חיבור
  לשרת" / "הכניסה שלך נשמרה. מנסה להתחבר שוב…" / "נסה עכשיו") instead of the sign-in form, and tries again after 5, 10, 20, then every
  30 s, on `online` and on the button; `ok` mounts the shell, `ended` shows the sign-in form. It is in the start-up chunk itself (it is
  shown exactly when nothing more can be fetched).
- A new sign-in (`completeSignIn`, and the second step's success) revokes the refresh token stored before when it differs (best effort),
  instead of leaving it valid at the sign-in service with no device holding it. The same token (a refresh that met the second factor)
  is kept.
- Side fix found on the way: `refreshNow()` that settled at once (no tokens) kept its settled promise shared for every later call
  (its `finally` ran before the assignment); it is now cleared once settled.

### FC-06 - an open page learns that the add-on was updated
- `routers/me.py` (additive, ADR-015): the `hello` frame of `/me/ws` carries `build` = the add-on version (`__version__`, the same value
  `/health` gives every signed-in caller and `vite.config.ts` bakes into the bundle as `__ARX_BUILD__`; `test_version.py` keeps the three
  equal). The socket reconnects on every add-on restart, an update included. Later frames are unchanged.
- `pwa/register.ts` `noteServerBuild()` + `pwa/arx-pwa-prompts.ts`: another version than this bundle's raises the SAME existing card as a
  waiting service worker ("גרסה חדשה של Arx זמינה" + "רענון"), also without a worker (plain-http local address, the HA frame). Nothing
  reloads by itself (owner rule: default = today's behaviour plus a quiet notice). The worker, when there is one, is asked to look for the
  new release, so "רענון" takes the usual hand-over. No version, `dev`, or the same version: nothing.
- `shell/lazy-screens.ts` needed no change (its reload-once for a missing chunk stays the fallback).

### SCR-23 (+ FC-12) - the step-up dialog (only while step-up is on; it ships OFF)
- `components/sw-step-up-dialog.ts`: names the refused action ("הפעולה: פתיחת דלת" / "נטרול האזעקה" / "עקיפת חיישן באזעקה" / "שינוי
  הגדרות" / "שינוי משתמשים" / "שינוי הרשאות" / "מינוי מנהל מערכת" / "שחזור מגיבוי"; the push sheet's wording); with a named action the
  method sentence has no purpose ("כדי להמשיך, ..."), an unknown action keeps today's texts. A hint says it will close; it answers
  "not confirmed" by itself after `STEP_UP_DIALOG_MS` = 90 s (as long as a phone approval lives) and at once on a route change
  (`hashchange`). Expired, the request is not re-sent; a phone request still open is cancelled.
- `api/client.ts`: the client's own backstop - a refused physical action (`alarm.disarm`, `alarm.bypass`, `door.open`, the server's
  `PHYSICAL_ACTIONS`) is re-sent only when the confirmation came within `STEP_UP_REPLAY_MS` = 120 s of the refusal. Settings changes keep
  the single replay as before.
- `shell/step-up.ts` (FC-12): refusals at the same moment share one dialog only for the same action; another action (or any once-action)
  waits for the open dialog and then gets its own.

## Files
- `frontend/src/api/client.ts`, `frontend/src/api/live-refresh.ts`
- `frontend/src/arx/auth.ts`, `frontend/src/arx/boot.ts`, `frontend/src/arx/arx-reconnect.ts` (new)
- `frontend/src/pwa/register.ts`, `frontend/src/pwa/arx-pwa-prompts.ts`
- `frontend/src/components/sw-step-up-dialog.ts`, `frontend/src/shell/step-up.ts`
- `frontend/src/i18n/lang/en/i18n/msg/misc.ts`, `frontend/src/i18n/lang/en/i18n/msg/mfa.ts` (English of the new texts)
- `smplwise_vms/backend/smplwise/routers/me.py`
- Tests: `frontend/tests/unit-client-resilience-2540.spec.ts`, `unit-arx-resilience-2540.spec.ts`, `unit-step-up-queue-2540.spec.ts`,
  `evidence-client-resilience-2540.spec.ts`; `smplwise_vms/backend/tests/test_client_resilience_2540.py`.
- Not touched: the files owned by STALE-ANSWERS-2540, TIME-CORRECT-2540 (`api/intercom.ts`), HONEST-STATES-2540, PHYSICAL-CONFIRM-2540,
  CAST-RELAY-HARDEN-2540 (checked against their branches: no overlap).

## Tests

Runner job `~/work/p2520_cr2540_run.sh` (run 1, branch at `0973f73cc`, base `aeb05ad3d`), logs in `~/work/p2520_cr/`.

### Before / after (the new tests on the base with the new test files copied in, then on the branch)
| Test | Base `aeb05ad3d` | Branch |
|---|---|---|
| `unit-client-resilience-2540.spec.ts` (FC-05, FC-03 client, SCR-23 replay, watchdog) | RC=1 - the file does not load (`ApiUnreachable` and the deadline exports do not exist) | 14 passed |
| `unit-arx-resilience-2540.spec.ts` (FC-03) | RC=1: 6 failed, 1 passed (the refusal regression guard), 4 skipped (shots) | 7 passed, 4 skipped |
| `unit-step-up-queue-2540.spec.ts` (FC-12) | RC=1: 1 failed (different actions), 1 passed (same action shares, as before) | 2 passed |
| `evidence-client-resilience-2540.spec.ts` (FC-06, SCR-23; built app, mocks) | RC=1: 5 failed (update card, action name, expiry, route change), 2 passed (no card for the same / no version), 4 skipped (shots) | desktop + mobile: 14 passed, 8 skipped (shots) |
| `test_client_resilience_2540.py` (hello `build`) | RC=1: 1 failed | 1 passed (+ `test_version.py`) |

### Branch checks (run 1)
- `npm run build` (tsc + vite): RC=0. `npm run typecheck` (tests + scripts): RC=0, 0 TS errors.
- `eslint src` + the new specs: RC=0, 0 errors (4 warnings = the spec files are on eslint's ignore list).
- `node scripts/unused-exports.mjs --enforce`: RC=0. `node scripts/bundle-budget.mjs --dir dist --enforce`: RC=0.
- `scripts/design_ratchet.py`: run 1 RC=1 (px-literal +3: `0px` fallbacks in `arx-reconnect.ts`) - fixed in `1a5f1b1f7`; re-run on the PC
  at the fixed head: RC=0, no count above the baseline (px-literal 25512).
- Backend pytest shards (runner): new + `test_version.py` passed; `test_notify_channels` + `test_authrevoke_2435` + `test_xsecfollow_297`
  RC=0; `test_security_review_220` + `test_session_cache_2438` + `test_local_identity` RC=0; `test_remote_access` + `test_remote_hardening`
  + `test_rbac_camera_scope` RC=0. Ruff: run 1 F811 in the new test (fixed); on the PC at the fixed head: "All checks passed".
- All node-only unit specs (`playwright.unit.config.ts`, 5377 tests): 5353 passed, 17 skipped, 7 failed:
  - 4 x `unit-poll-controller.spec.ts` "no overlap however long a read takes" (4 periods of 30 s = 120 s > the first watchdog's 90 s):
    the watchdog now waits max(3 min, 5 periods); on the PC at the fixed head `unit-poll-controller.spec.ts` 29 passed,
    `unit-live-refresh-295.spec.ts` 14 passed, `unit-client-resilience-2540.spec.ts` 14 passed.
  - 3 x `unit-mfa-passkeys-2490.spec.ts`: `ERR_CONNECTION_REFUSED` on localhost:4173 - a page spec with no server in the node-only run
    (environment, not this change).
- Mocked page specs on the built branch (served at the runner's address, NOT a secure context):
  `unit-step-up-ui` + `unit-session-me-failure-2435` + MFA page specs: 19 passed, 5 failed - all passkey cases of `unit-mfa-train-2500` /
  `unit-mfa-t095-rest-2530` ("WebAuthn on localhost": no passkey button outside a secure context); MFA evidence (desktop + mobile)
  63 passed, 1 failed (`evidence-mfa-screens-2510` phone key list); `evidence-pwa-push` 8 failed (`navigator.serviceWorker` undefined
  outside a secure context), `evidence-kiosk-polish` + `evidence-dialog-toplayer-2381` passed. Run 2 repeats these on 127.0.0.1 on the
  base and the branch (below).

### Run 2 - NOT_RUN at report time
`~/work/p2520_cr2540_run2.sh` is queued on slot B (a release gate started 11:17 UTC holds the memory). It repeats, at the branch head:
build, eslint, unused exports, the new + poll + client unit specs, all node-only unit specs, the secure-context page specs
(`unit-mfa-train-2500`, `unit-mfa-t095-rest-2530`, `unit-mfa-passkeys-2490`, `evidence-mfa-screens-2510`, `evidence-pwa-push`) served on
127.0.0.1 on the base AND the branch, the evidence spec desktop + mobile, and the phone step-up pictures. Logs: `~/work/p2520_cr2/`.
Until it runs, these are NOT_RUN at the head; the failures listed above are attributed to the environment by their error text only.
The backend test's fixture at the head is the run-1 one (passed) with a `noqa: F811` for ruff (ruff on the PC: all checks passed).

### Observation
On a phone the update card (bottom of the screen, above the navigation bar) covers a screen's bottom save button while it is shown
(found by the picture run). It is the card that already shows for a waiting service worker; with FC-06 it can show more often (question 4).

## Not done / NOT_RUN
- No lab, no live install, no device: everything is mocked.
- No pixel baseline covers the changed UI (the step-up dialog, the update card, the remote start-up) - none refreshed; the compare page
  `private/planning/client-resilience-2540_compare_2026-11-26.html` has the before / after pictures.
- The wall entry (`wall/sw-wall.ts`, its own socket) does not compare builds yet (question 2).
- The full Playwright suite and the full backend suite were not run (the release gate does).

## Open questions (recommendation first)
1. Default request deadline for plain reads: a) 60 s (built); b) 30 s as the review suggested; c) a setting.
2. Wall / kiosk pages after an update: a) the quiet card only, as built (owner rule: no forced reload); b) a setting "reload by itself on a
   new version" for wall / kiosk routes, default off; c) also teach the separate wall entry (`sw-wall.ts`) to compare builds.
3. Step-up dialog life: a) 90 s for every action (built; the phone approval lives 90 s); b) 60 s for physical actions, 120 s for the rest.
4. The update card on a phone covers the bottom save button while shown: a) add a "later" button that hides it until the next version
   (recommended, small); b) move it to the top of the screen; c) leave it as it is.
