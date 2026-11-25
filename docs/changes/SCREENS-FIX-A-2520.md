# SCREENS-FIX-A-2520 - the high findings of the deep screens review (SCR-01, SCR-06, SCR-07)

Row for Arx 2.52. Source: `docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (branch `review/DEEP-2520-FRONTEND-SCREENS`, aa0a3b4aa).
Base: `release/2520-train`. Branch: `pilot/SCREENS-FIX-A-2520`. One commit per finding, each with tests that fail before and pass after.

## SCR-01 (high) - the emergency door sheet went dead after one failed prepare / start

**Why.** `nextStep('error', 'held')` stayed `error`. The `error` step draws the choose view with live hold buttons, so after one failed
`prepare` (network, `rate_limited`, `incident_active`) or a failed `start` (expired single-use token) every further hold got a fresh
token from the server but the confirm step was never drawn again - in an emergency, with nothing on screen saying "close and reopen".

**What.** `door-windows/logic.ts`: a completed hold from `error` is `confirm` (after the server's fresh prepare). There is still no path
from `choose` / `error` to `sending` except through `confirm`. `door-windows/emergency.ts`: a new hold first drops any older token and
its count-down, and a failed prepare clears the token, so only that hold's fresh token can reach the confirm button.

Files: `frontend/src/door-windows/logic.ts`, `frontend/src/door-windows/emergency.ts`; tests `frontend/tests/unit-door-windows.spec.ts`,
`frontend/tests/evidence-doorwin-295.spec.ts`, `frontend/tests/door-windows-mocks.ts` (new mock option `emergencyFail`; a fresh sample
token per prepare - the first keeps the historic sample token). Mocks only; no door, station or WisKey.

## SCR-06 (high) - home alarm: stale state, a toast that claimed success, a failed read shown as "no alarm system"

**Why.** Panels were re-read on push only by the wall-panel machine, so a phone on the alarm screen stayed on "arming" and the home chip
kept the load-time state; arm / disarm toasted "armed" / "disarmed" for any accepted request (the route returns the action record also
when it is not confirmed); a failed read set `panels = []`, which drew "no alarm system connected".

**What.**
- `home/sw-home.ts`: an `alarm_control_panel.*` push re-reads the panels (debounced 400 ms) on every home device - phone, tablet, wall
  panel; the wall panel's own push hook (`home-wall-rest.ts haChanged`) is folded into it, so a sounding alarm still takes a wall panel at
  once. `loadPanels` keeps the last panels on a failed read and sets `panelsRead` = `'none' | 'ok' | 'error'`; only the newest of
  overlapping reads is drawn.
- `home/home-alarm.ts`: the alarm screen also re-reads every 15 s while it is open (`leave` stops it; a hidden tab skips). Read state:
  `none` -> "reading the alarm state", `error` with nothing read -> "the alarm state is not available right now", `error` with an
  earlier read -> the last state with "no connection right now, showing the last state read". "No alarm system connected" only when a
  read succeeded with no panels (or the module / permission is off). The "more" hub tile stays visible on a failed read ("unavailable").
- `home/home-alarm-follow.ts` (new): arm / disarm follow the returned record with `api/ha awaitAction` (the full alarm screen's
  follow-up): toast "request sent, waiting for the panel" until `confirmed` ("the alarm is being armed" / "the alarm is disarmed"),
  `failed` / `denied` ("the panel did not arm / disarm the alarm"), `unknown` or still pending at the end of the window ("no
  confirmation from the panel, check the alarm state"). Only the newest request is followed. Used by the alarm screen, the home
  security tile's `a_alarm` and the after-scene arm suggestion (`home-scene-2500.ts`, the same claim).
- Pure words in `home/home-v3-words.ts` (`alarmFollow`, `alarmFollowText`); English in `i18n/lang/en/i18n/msg/home.ts` (the now unused
  "{name}: {v1} sent" removed; "The alarm is being disarmed" -> "The alarm is disarmed", shown only once confirmed).

Not in this row: SCR-09 (the security chip calls `unavailable` / `pending` "armed") - its own finding.

## SCR-07 (medium, security) - Arx-only users: no self / last-administrator guard on delete and disable

**Why.** `DELETE /identity/local-users/{id}` and `PATCH {active:false}` did only `_manage` + `_user_row`; the HA-users equivalents refuse
`self_target` and `last_admin`, and role / link / password here refuse an administrative target on the remote channel.

**What (server, `routers/local_identity.py`).** `_guard_removal` runs before any write of the request (a refusal commits only its audit
row):
1. the actor's own identity -> 409 `self_target` ("אי אפשר למחוק / להשבית את המשתמש שלך.");
2. an administrative identity on the remote channel -> 404 `not_found` (owner answer Q3, the shape of the other local-channel-only routes;
   audited `local_admin_target_remote`);
3. the last administrator -> 409 `last_admin` (the HA-users routes' own texts): no active system administrator counted by
   `rbac.admin_count` (Arx-only identities are never counted there) and no other active administrative Arx-only identity;
4. fail closed: an administrator check that raises -> 409 `last_admin`, audited `admin_check_failed`.
Every refusal is audited (`identity.local.user.disabled` / `.deleted`, decision `denied`, the reason). Both writes also run inside
`rbac_admin.keep_an_admin`. English: the one new text in `smplwise/error_text_en.json` ("You cannot disable your own user.").
Additive: no wire change, two new refusal codes on existing routes.

**What (screen, `screens/system-local-users.ts`).** "Disable" asks first (it ends every sign-in and link at once); the signed-in
person's own row is marked ("your user") and offers neither disable nor delete (a note says why); a server refusal shows in the tab's
error note as worded. Hebrew + English (`i18n/local-identity.ts`).

Note: today no role an Arx-only identity may hold carries `identity.local.manage`, so the self case is defence in depth (reachable only
through a binding written behind the routes' back); the test stands for that with a dependency override.

## Tests

All on the Linux test server through `~/work/slotb.sh` (jobs `p2520_scrfixa_run.sh`, `p2520_scrfixa_run2.sh`); "before" = the new
tests on `release/2520-train` (af0021b2c at the time), "after" = this branch. The PC ran only `test_local_identity_guards_2520.py`
(5 passed; with the router change stashed 5 failed).

| check | before | after |
|---|---|---|
| backend `test_local_identity_guards_2520` | rc=1, 5 failed | rc=0, 5 passed |
| backend `test_local_identity` / `_units` / `test_local_user_create_2438` / `test_wire_local_identity_2450` | - | rc=0 each (41 / 55 / 11 / 2 passed) |
| backend `test_ha_users` / `test_i18n_errors_en_2520` / `test_remote_access` | - | rc=0 each (67 / 9 / 66 passed) |
| ruff (changed backend files) | - | rc=0 |
| tsc app, tsc tests (0 errors in the changed files), eslint (changed sources), design ratchet | - | rc=0 |
| `unit-door-windows` (desktop) | 1 failed, 8 passed (the SCR-01 case) | passed |
| `evidence-doorwin-295 -g SCR-01` (desktop) | 1 failed | passed |
| `home-alarm-follow-2520` (desktop) | 4 failed (run 1 and run 2) | run 2: 4 tests x3 = 12 passed |
| `evidence-local-users-guards-2520` (desktop) | 3 failed | 3 passed |
| new / changed specs, desktop + mobile (run 1) | - | 68 passed, 7 skipped, 1 failed (the toast-observer test - a test bug, fixed in a15c71dd2) |
| new SCR tests x3 (run 1) | - | 21 passed, 3 failed (the same test bug) |
| related specs desktop + mobile (home v3 / wall panel / favourites / auditfix incl. the phone alarm pixel baseline, confirm dialog, local users, a11y lints, home simple, home screen) | - | 152 passed, 130 skipped, 3 failed: `unit-a11y-polished-lint` (desktop + mobile: `system-local-users.ts:285 .pk-reset .err`, CSS this row did not touch) and `home-v3-auditfix-2437` #7 (home paint hint); both checked at the base in run 2 |

Run 2 (branch a15c71dd2, base 2b9810f38): `home-alarm-follow-2520` x3 desktop 12 passed (before: 4 failed). `home-v3-auditfix-2437`
\+ `unit-a11y-polished-lint`: on the branch 27 passed, 1 skipped, 1 failed (`unit-a11y-polished-lint`, the `.pk-reset .err` CSS); at the
newer base 28 passed - the train fixed that line in e328f3ca2 after this branch's base (bd20831e6), so it is not this row's and goes
away on merge. `home-v3-auditfix-2437` #7 passed in run 2 (run 1 failure: flaky, not reproduced). The branch merges cleanly into
`release/2520-train` at 2b9810f38 (`git merge-tree`); files both touched: the English home table, `system-local-users.ts`,
`error_text_en.json`.

NOT_RUN: the full frontend suite and the full backend suite (the release gate's job); tablet project; no lab (not allowed).

Pixel baselines: the phone alarm screen baseline (`pixel-home-auditfix-2437`, normal state) passes unchanged - the visible states that
changed (loading / unavailable, toasts, the confirm step after a retry, the disable dialog, the own-row note) have no pixel baselines,
so none were refreshed. Before / after pictures: `private/planning/screens-fix-a-2520_compare_2026-11-25.html` (desktop + phone, light
+ dark; the home interface draws its own theme).

## Open questions

1. Should the self guard also cover the person's linked HA identity (an HA administrator removing the Arx-only identity linked to
   them)? a) no - it is another identity and does not end the current session (recommended, built); b) yes, refuse it too.
2. "Last administrator" for Arx-only identities counts any administrative permission (`holds_admin`), only when no system administrator
   is counted. a) keep (recommended, built); b) count only identities holding `rbac.assign`.
