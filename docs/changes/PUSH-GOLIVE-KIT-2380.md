# PUSH-GOLIVE-KIT-2380: push go-live kit and supervised field-test script (documents + a fake-only rehearsal)

Status: prepared 2026-11-02 on `pilot/PUSH-GOLIVE-KIT-2380` (from `origin/release/2360-train` @ `eb9525d9b`). Not merged, no version bump,
no tag. Row M4 (A5 + A6) of `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md`. **No real account, key, device, server or
runner was used. Nothing was sent anywhere.** Everything below that touches Firebase, Apple, Play, Cloudflare or a phone is NOT_RUN.

## What this adds

| File | What |
|---|---|
| `docs/operations/PUSH_GOLIVE_OWNER_SESSION_HE.md` (new) | Owner session checklist (Hebrew): pre-session account steps, the three decisions Q12-Q14 with a recommendation, 90 minutes in 7 timed steps (Firebase, Cloudflare relay, Play Console, Apple, lab server, hand-over), hand-over table, failure table, a no-secrets report form |
| `docs/operations/MOBILE_FIELD_TEST_HE.md` (new) | Supervised field-test script (Hebrew): owner consent text, preparation, part A (install, ~1 min navigation, background / resume, lock), part B (saved sign-in and session exchange, conditional), part C (test push), revert and result table |
| `docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md` (edited) | Pointer to the kit; the missing `FIREBASE_SETUP_HE.txt` reference replaced; dry-run and health commands; section 5 rewritten into a decode table for the relay answers (adds 502 `upstream_refused`, 429, the 404/410 side effect); test count corrected 27 to 34 |
| `scripts/push_golive_check.py` (new) | stdlib only: `dry-run` (relay contract against `fake_relay.py` on loopback, `wrangler.toml` and tracked-secret checks, optional Worker typecheck / unit tests / `wrangler deploy --dry-run`), `secrets-preflight` (shape of the Firebase JSON, `AuthKey_*.p8`, server keys; git-ignored check; never prints a value), `health` (compare `/v1/health` with expectations; https only, loopback http allowed) |
| `smplwise_vms/backend/tests/test_push_golive_check.py` (new) | 14 tests of the script |
| `services/push-relay/README.md` | test count 27 to 34, one line pointing to the rehearsal |

## Findings the owner should know

1. **App 2.1.5 has no client for the saved sign-in or the session exchange.** Its own closure note (`mobile_r8_r5_2026-10-24/.../IMPLEMENTATION_HE.md`)
   says no one-time-code sign-in was added and APPREFRESH stays off; the exchange contract reached the teams on 25.10, after that package closed.
   The plan's "session-exchange 303 proof with 2.1.5" cannot happen from that build. The field-test script therefore branches by build:
   no client = skip and record NOT_RUN; client without `X-Correlation-Id` (anything before 2.1.6) = expected controlled failure
   (`303 ?app_session=failed`, audit `marker_missing`, which proves the X4 F-1 fix); client with the header (2.1.6+) = the full proof.
   Open owner question: a server-side test client (about 4-6 h, proves only the server half) versus waiting for the team build.
2. **No screen exists for the two exchange switches** (`security.app_refresh`, `security.app_session_exchange`); they are set with
   `PUT api/v1/auth/app/settings` from a local-channel administrator session. The script offers a browser-console call that was **not tried**.
   Open owner question: a small admin card (about 2 h) or keep the console call for supervised runs.
3. **The test push is sent by the app, not by Arx.** `POST notifications/app/test` takes the device token, which only the app holds; the web
   `notifications/test` covers web push only. Nothing in the delivered app documents a "send test" button. Fallback in the script: a real
   notification on the `app` channel. Ask the app teams for a button (open question 3 in the field-test document).
4. **A relay answer of 404 or 410 makes the Arx server drop the device's push registration at once** (`mobile_push.record`); a wrongly typed
   relay URL (extra path) answers 404 and therefore silently un-registers phones until the app is next opened. The deploy document now says so.
5. The relay test count in the documents was 27; the suite has **34** tests.
6. X4 findings F-1 (marker header, no session swap), F-2 (no device registration from an `a.` session) and F-3 (audit rows) are fixed in the
   current code (`routers/app_refresh.py`, `routers/presence.py`, `services/app_session.py`); the X4 "NO-SHIP for leaving it on" text predates them but
   the switch stays off by default and the field test keeps the three X4 supervised-run conditions.

## Checks run (this workstation, 2026-11-02)

| Check | Result |
|---|---|
| `scripts/push_golive_check.py dry-run --worker` | 19 passed, 0 failed, 0 not run (16 without `--worker`, which reports the Worker step NOT_RUN) |
| `pytest tests/test_push_golive_check.py` (venv, single process) | 14 passed |
| Worker `npm run typecheck`, `npm test` (vitest), `wrangler deploy --dry-run` (after `npm ci` in the worktree) | typecheck OK, 34 passed (34), bundle built |
| `pytest tests/test_mobile_push.py` (server half against the in-process fake relay) | 14 passed |

NOT_RUN: everything against real Firebase, Apple, Play, App Store Connect, Cloudflare, a phone, the lab server, the runner. No frontend change,
so no browser or Playwright run. Documents were checked against the code for names, routes and codes (`routers/mobile_notifications.py`,
`services/mobile_push.py`, `routers/app_refresh.py`, `services/app_session.py`, `services/push-relay/src/*.ts`); console menu names, prices and
account rules of Google and Apple were written from general knowledge and each document says to trust the console when it differs.

## Not changed

No backend or relay source, no `management/` files, no settings, no dependency. `node_modules` in `services/push-relay` is git-ignored.
