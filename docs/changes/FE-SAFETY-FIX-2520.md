# FE-SAFETY-FIX-2520 - push subscriptions end with the sign-in; Enter confirms only on the confirm button

Base `origin/release/2520-train` (`f343f829b`), branch `pilot/FE-SAFETY-FIX-2520`. Source: `docs/review/DEEP-REVIEW-2520-FRONTEND-CORE.md`
(on `review/DEEP-2520-FRONTEND-CORE`, `c097fa887`), findings **FC-02** and **FC-04** only.

## FC-02 (privacy) - a browser's Web Push subscription survived the sign-out

**Before.** `arx/auth.ts` `logout()` revoked the refresh token and deleted the Arx session, but never touched this browser's push
subscription; the backend's sign-out ended only the phone app's registration (XSECFIX-297, by user agent). `push_subscriptions` rows
written by `POST push/subscriptions` stayed, so a signed-out shared / borrowed computer kept receiving that user's notifications (titles,
bodies, door events) and could acknowledge / snooze them. "Sign out everywhere" had the same gap for every other browser.

**Fix - both halves.**

Backend (the half that also covers a browser that is closed or offline when the sign-in ends):

- Migration `0226_push_subscription_sign_in.sql`: `push_subscriptions.sign_in` (nullable) = the sessions list's public id of the remote
  sign-in that registered the row (`ha_user_auth.public_id(session.sign_in())` - a hash; a cookie chain's raw key is the cookie value and
  is never stored). NULL inside Home Assistant (Ingress) and for rows written before 0226. Additive; the API never returns it.
- `POST push/subscriptions` records it (`routers/push._sign_in_of`); a row that moves to another sign-in (same browser signed in again)
  takes the new one.
- `services/push.end_for_sign_ins` (rows of the ended sign-ins) and `end_for_user` (every row of the user). Never raise; one audit row
  per user, `push.subscriptions.ended` (reason, scope, count, row ids, endpoint hosts - never an endpoint).
- Where they run:

  | Event | Rows removed | Hook |
  |---|---|---|
  | sign-out (HA remote sign-in) | that sign-in's | `ha_user_auth.logout` -> `presence.end_on_sign_out(sign_ins=...)` |
  | sign-out (Arx-only / local sign-in) | that chain's | `local_identity.revoke_chain` |
  | sign-out (app web session) | that session's | `app_session.logout` |
  | one sign-in ended from the sessions list (own or administrator; HA, local, app) | that sign-in's | `revoke_sessions` persist, `revoke_chain`, `routers/remote._app_revoke` |
  | other sign-ins ended, the caller's kept (a first second factor or passkey: HA and local) | those sign-ins' | `revoke_user_sign_ins`, `local_identity.revoke_user_sessions(keep_chain=...)` |
  | sign out everywhere / administrator ends all (HA, local) | all of the user's | `presence.end_on_sign_out(everywhere=True)` |
  | remote access removed, second factor required / reset, local user disabled / deleted, local password changed / reset | all of the user's | `presence.end_on_sign_out(everywhere=True)` (existing call sites) |
  | local identity switched off | every local chain's | `local_identity.revoke_all` |
  | HA user deactivated / deleted from Arx's user screen | all of the user's | `routers/ha_users` |

  `presence.end_on_sign_out` gained the `sign_ins` keyword; its return value still counts devices only.
- "Everywhere" also removes Ingress / pre-0226 rows (they name no sign-in). A browser the user is still signed in on re-registers on its
  next start (`push.ts syncSubscription`) - e.g. the browser from which the user changed the password.

Frontend:

- `pwa/push-signout.ts` `dropOnSignOut()` (a small module: only `api/client.apiUrl`): when this browser holds a subscription, it
  deletes its own server row (list + `DELETE push/subscriptions/<id>`, plain `fetch` so a 401 never starts the refresh-and-reload path)
  and then calls `sub.unsubscribe()`. Bounded: the server part waits at most 3 s, then the browser unsubscribes anyway; a 5 s guard
  around everything; it never fails the sign-out.
- `arx/auth.ts logout()` runs it first (loaded on demand), before the refresh token is revoked and the session deleted - so the delete
  is made as the still-signed-in user. Applies to every remote sign-out: the button, the idle lock, a refused resume (403).
- `endpointHash` moved to `push-signout.ts`; `push.ts` re-exports it (no caller changes).

## FC-04 - Enter on the close button (X) confirmed a destructive action

**Before.** `components/confirm-dialog.ts` treated Enter as "confirm unless the focus is on Cancel". One Tab from the confirm button
wraps to the dialog's X; Enter there deleted.

**Fix.** `components/confirm-dialog-keys.ts` `enterAnswer()` (a pure rule, Node-tested) and `SwConfirmDialog.enterTarget()` (walks up
from the deep focus through the shadow roots):

| Focus | Enter |
|---|---|
| confirm button | confirms |
| cancel button, the X | answers no (what a click there does) |
| another element inside the box (a link / field a TemplateResult body brings) | that element's own key, never a confirmation |
| outside the box / nowhere | swallowed: nothing confirmed, nothing reaches the page behind |

Every `confirmDialog()` caller (door / physical action confirms included - they all go through it) gets the rule.

**Other confirm paths checked** (the same "anything but cancel confirms" pattern): none found. Typed-confirmation dialogs either have no
Enter handler (Frigate case / export delete, HA user removal, WisKey installer and door-tech confirms - a `<form>` submit validates the
typed phrase in `sendCode`), or confirm on Enter only while the typed text matches (`system-security-wiskey-managed`). The three
typed-username resets (`sw-user-factors`, `sw-second-factor` authenticator row, `system-local-users` passkey removal) submit through a
`<form>` on Enter; their handlers already required a valid text, and now also refuse while a reset is running (Enter twice = one
request).

## Files

- Backend: `smplwise/migrations/0226_push_subscription_sign_in.sql`, `services/push.py`, `services/presence.py`,
  `services/ha_user_auth.py`, `services/local_identity.py`, `services/app_session.py`, `routers/push.py`, `routers/remote.py`,
  `routers/ha_users.py`; `tests/test_fe_safety_fix_2520.py`.
- Frontend: `src/arx/auth.ts`, `src/pwa/push-signout.ts` (new), `src/pwa/push.ts`, `src/components/confirm-dialog.ts`,
  `src/components/confirm-dialog-keys.ts` (new), `src/components/sw-user-factors.ts`, `src/components/sw-second-factor.ts`,
  `src/screens/system-local-users.ts`; tests `unit-fe-safety-fix-2520.spec.ts`, `unit-fe-safety-fix-2520-signout.spec.ts`,
  `evidence-fe-safety-fix-2520.spec.ts`, `evidence-confirm-dialog-2438.spec.ts` (new test).
- No visible change (no layout, colour or text): no pixel baselines, no compare page.

## Tests

Runner (`~/work/slotb.sh ~/work/p2520_fesafety_be.sh`, head `0a4dc6f19`, one pytest process per file):

| Command | Exit | Result |
|---|---|---|
| `pytest tests/test_fe_safety_fix_2520.py -q -x` | 0 | **15 passed** |
| `pytest tests/test_push.py -q -x` | 1 | BLOCKED - first test failed with `sqlite3.OperationalError: database or disk is full` (the runner's `/` had 11 MB free) |
| `pytest tests/test_xsecfix_297.py -q -x` | 1 | 47 passed, then 1 failed with HTTP 507 "the data disk is full" - BLOCKED, not a product failure |
| `test_xsecfollow_297`, `test_local_identity`, `test_remote_access`, `test_ha_users`, `test_migrations`, and the rest of the list | - | NOT_RUN - job stopped by this row once the disk-full cause was clear |

PC: `py -3.12 -m ruff check` on every changed backend file and the new test file - exit 0, all checks passed.

Frontend: NOT_RUN. The job `~/work/p2520_fesafety_fe.sh` (tsc app + tests, eslint on the changed files, the unit specs
`unit-fe-safety-fix-2520`, `unit-fe-safety-fix-2520-signout`, `unit-no-native-dialogs`, `unit-arx-pending-tokens`,
`unit-second-factor-admin-ui`, build + preview, `evidence-confirm-dialog-2438` + `evidence-fe-safety-fix-2520` desktop, regression
`evidence-mfa-screens-2510`, `evidence-second-factor`, `evidence-mfa-passkey-admin-remove-2520`, `evidence-mfa-factor-harden-2520`,
`evidence-calendars-settings-2310`, `evidence-log-export-2440` desktop + phone, `scripts/design_ratchet.py`) was queued, never
started (all slots busy), and was withdrawn because of the full disk. PC rules forbid tsc / Playwright locally.

To rerun once the runner has disk space: `~/work/slotb.sh ~/work/p2520_fesafety_be.sh` and `~/work/slotb.sh ~/work/p2520_fesafety_fe.sh`
(both scripts are on the runner; they recreate their worktrees).

## Open questions

1. Idle lock and a refused resume also end this browser's push subscription (it is part of `logout()`); after signing in again the
   person turns notifications on again in the settings. a) keep it so (recommended: the device is signed out, privacy first);
   b) keep the subscription on the idle lock only.
2. "Sign out everywhere" and a local password change remove ALL of the user's push rows, including the browser the user is on; it
   re-registers on its next start (until then no browser push there). a) accept (recommended: simple, nothing leaks);
   b) keep the caller's own sign-in row (needs the kept sign-in passed through `presence.end_on_sign_out`).
3. Migration number 0226: free on `release/2520-train` at `f343f829b`; renumber at the train if another 2.52 row takes it.
   a) renumber at merge if needed (recommended); b) reserve 0226 now.
4. Rows whose sign-in ends silently (an HA remote session that expires or is refused on re-validation) are not removed - only the
   explicit ends listed above, as the finding asks. a) leave it (recommended: a lazy check would stop push for every closed PWA,
   whose in-memory session lives only ~30 min); b) a later row.
