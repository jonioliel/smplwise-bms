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
- `api/live-refresh.ts`: a watchdog. A read still running after max(90 s, 3 periods) no longer holds its source: it counts as a
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

RESULTS_PLACEHOLDER

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
