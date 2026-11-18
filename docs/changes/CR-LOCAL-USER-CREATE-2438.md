# CR-LOCAL-USER-CREATE-2438 - Arx users: the create form sends, and the administrator sets the password

Owner, 18.11 (urgent for 2.43.8): "When creating Arx (local) users the user is not saved, and I have no way to set a password for him -
that is mandatory."

Stacked on `pilot/CR-LOCAL-ID-SWITCH-2442` (f817bf7ae), which already contains main 2.43.7 (cc69447f1).

## Root cause (with evidence)

**The create button never sent the form.** `frontend/src/screens/system-local-users.ts` renders the create form as
`<form @submit=${this.create}>` with `<sw-button type="submit">` as its only button. `sw-button` renders its native
`<button type="submit">` inside its own shadow root. A button in a shadow root has no form owner (the HTML form-owner algorithm looks
for a `form` ancestor in the button's own tree and stops at the shadow root), so the click submitted nothing: no `submit` event, no
`create()`, no request. The form also had no submit button of its own, so Enter in a field (implicit submission) did nothing either.
The defect is as old as the screen (USR2, 6e4172438, 16.10): creation through the UI never worked; the backend route was only ever
exercised by backend tests and by the mocked spec's other actions (no test clicked "create").

Evidence:

- The owner's site (lead's read-only check): the access log shows `GET /arx/api/v1/identity/local-users 200` and no `POST`; the audit
  has no `identity.local.user.created`, no refusal row of any kind. "Never sent" explains all of it; a server refusal would have left a
  POST line.
- Reproduced on this workstation BEFORE any fix: the real backend with the remote channel at `/arx/`
  (`frontend/tests/fixtures/arx_fake_ha.py`, only Home Assistant core is fake), the built UI, Playwright signed in as the system
  administrator through the remote sign-in page, Settings > Users and permissions > Arx users, the feature switched on from the tab,
  form filled (`dana.k`, `דנה קליין`), "create" clicked: `expect.poll(posts.length).toBe(1)` failed with `Received: 0` - no request
  left the page (`tests/evidence-local-user-create-2438.spec.ts`, first version).
- After the one-line fix in `sw-button` the same click produced `POST ... 201` and the user was listed.

The other suspects were checked and are not the cause: the remote channel does not block the route (`BLOCKED_ON_REMOTE` has no
`identity/local-users` entry; the POST answers 201 through `/arx/`), CSRF is not involved (a session route), the roles the picker
offers are the roles the server accepts (see the matrix below), and the screen did show server errors (`.note.err`) - there simply was
no answer to show.

What the investigation also found (fixed here, not the cause):

- Refusals of the create route were mostly unaudited (only `role_not_allowed_for_local_user` wrote a row). A refused create could be
  invisible in the audit.
- Length errors of the username / display name were pydantic 422s (generic "ערך לא תקין - username: קצר מדי"), not the product's own
  sentence, and never audited.
- The error note was rendered above the form, away from the button.

## Fix

- `frontend/src/components/sw-button.ts`: a `type="submit"` button now submits the form around the host
  (`this.closest('form')?.requestSubmit()` on the inner button's click; not when disabled; `type="button"` unchanged). This is the
  component's contract (`type` was a documented property that did nothing for `submit`).
- `frontend/src/screens/wiskey-profiles.ts`: the people-search button had worked around the same defect with its own `@click` next
  to the form's `@submit`; the `@click` is removed so the search still runs once (the form's submit does it).
- `system-local-users.ts`: the create form (and the new set-password form) carry a hidden native submit button, so Enter in a field
  submits; the create handler ignores a second submit while busy and ignores Enter when the button is disabled (administrative role on
  the remote channel).
- Refusals are shown INSIDE the form, next to the button (`data-local-create-error`, `role="alert"`), with the server's own sentence;
  the form stays open with what was typed. Missing username / display name is said by the page before anything is sent.
- Server: every refusal of `POST /identity/local-users` after the permission check writes
  `identity.local.user.create_refused` (decision `denied`, reason = the refusal's code: `validation`, `role_unknown`,
  `role_not_allowed_for_local_user`, `scope_unknown`, `self_service_not_for_admins`, `username_taken`, `password_policy`,
  `local_identity_off`, `admin_target_remote`, a delegation refusal's code; details: status, channel, the field, the policy reason -
  never what was typed). The permission refusal itself was already audited by `rbac.require` (`identity.local.manage`, denied). The
  older `identity.local.user.role_refused` row is kept. The username / display-name length checks moved from the model to the handler
  (same limits, the product's sentence, audited).

## Feature (owner: mandatory) - the administrator sets the password

- `POST /identity/local-users` takes `password` (optional) and `must_change` (default `true`). With a password: the same policy as the
  set-password page (`security.local_password_min`, common / contextual / repeated; 400 `password_policy` with the reason), hashed by
  `local_passwords.hash_password`, stored with `set_by = 'admin'`, the user is `active` at once and NO first-login link is minted
  (`link: null`, `password_set: true`). Without a password the route behaves as before (the first-login link, shown once).
- `PUT /identity/local-users/{id}/password {password, must_change=true}` (new): the same policy and hash for an existing user (also a
  pending one). Like a used link: the user's sessions, open links, self-service reset codes and phone credentials end, the failure
  counters clear. Refused for a disabled user (409) and while the feature is off (409).
- `must_change` is the existing mechanism of temporary links (`auth_local_credentials.must_change`): the sign-in answers
  `must_change_password: true`, the session reaches only `CHANGE_PATHS` (403 `password_change_required` elsewhere) until the user
  chose their own password on the sign-in page's change step. Default ON; the administrator may turn it off (checkbox).
- `GET /identity/local-users` adds `password_min` (for the form's hint and the page's own length check).
- Audit: `identity.local.password.set_by_admin` - allowed (details: `at` = `create` | `existing`, `must_change`, `channel`,
  `admin_target`, and for an existing user `sessions_ended`, `links_invalidated`) and denied (reason `password_policy`,
  `user_disabled`, `admin_target_remote`). `identity.local.user.created` carries `password_set` (+ `must_change`). The password is never
  logged, audited, answered or stored in clear (test below scans the audit, the log, the answers and a dump of the database).
- Screen: the create form asks "איך המשתמש מקבל סיסמה" - "אני קובע סיסמה עכשיו" (default: password + again + the checkbox "המשתמש חייב
  להחליף סיסמה בכניסה הראשונה", on) or "שליחת קישור במקום" (the previous behaviour). The selected user's panel has "קביעת סיסמה"
  (password + again + the checkbox, a note that the user's sign-ins end). A result line says what happened; the typed password is not
  kept once the form closes. Hebrew and English in `frontend/src/i18n/local-identity.ts`.

## Second finding (security, older than this change): a revoked session could be cached back for 15 seconds

Found by the new browser spec, once, on a busy workstation: the administrator set a password, the answer said `sessions_ended: 1`,
the database row was `revoked` - and the user's open page still got 200 from `/me`.

Cause: `local_identity.resolve()` reads the session row (`_lookup`), and later puts the session into the in-memory cache
(`CACHE.put`, 15 s TTL). A revocation drops the chain from the cache (`CACHE.drop_chains`) INSIDE its transaction, before the commit.
A request of that session that read its row before the commit put the session back after the drop, and every later request was
answered from the cache until the TTL ran out. The window is the tail of the revoking request (milliseconds), so it shows only when
the user's page is busy at that moment; it is the same for every route that ends a user's sessions, not only the new one.

Evidence: (1) `scratchpad` probe with the window widened by a temporary 1 s delay after the drop (instrumentation, removed): the
EXISTING route `POST identity/local-users/{id}/sessions/revoke` left the session answering 200 for 14.4 s (478 of 671 requests after
the answer); (2) the deterministic backend test below interleaves "row read -> revocation commits -> cache put" without any delay and
failed for `PUT .../password` and for `sessions/revoke` before the fix.

Fix (`services/local_identity.py`, `_Cache`): a chain whose entries were dropped is not cached again for `DROP_HOLD_S` (30 s, longer
than any transaction). The request already in flight is answered from what it read (as if it had arrived a moment earlier); the next
one reads the committed row and gets 401. A legitimate chain is never in that list: a password change by the user keeps its own
chain out of the revocation (`keep_chain`), a rotation drops by cookie (`CACHE.drop`), a new sign-in is a new chain. If the revoking
transaction rolls back, the chain is merely read from the database for 30 s. This commit is separate so that it can be reviewed (or
held) on its own.

Not changed, for review: `services/app_session.py` keeps its own cache with the same put-after-read shape (the phone app's web
session); it was not probed here.

## Security rules - what was touched

- **Changed on purpose (owner 18.11):** USR2's "an administrator never sets a password; only links" (the comment on
  `auth_local_credentials.set_by` in migration 0096). An administrator with `identity.local.manage` (system_admin only) can now set one.
  `set_by` gains the value `admin` (free-text column, no migration). The default `must_change = true` keeps the old property - only
  the user knows the password in the end - unless the administrator turns it off.
- **Not weakened:** an administrative target (a role with an administrative permission) is created, linked and now password-set on the
  LOCAL channel only (`_admin_target_local_only`, 404 on the remote channel, audited `admin_target_remote`); the screen hides the action
  there. `identity.local.manage` is required for every route; `system_admin` is never assignable; the second-factor rule for
  administrative permissions, the session gates, the rate limits and the uniform sign-in answers are untouched. A non-administrative
  user's password may be set through the remote channel - the same reach its links already had.
- **Strengthened:** the session cache no longer re-admits a chain right after its revocation (the second finding above).
- The create model accepts a longer username / display name string (200) so that the handler - not the model - refuses and audits; the
  accepted values are unchanged (USERNAME_RE, 60 characters).

## Tests actually run (workstation; no runner, no entry check, no real installation)

- `npx tsc --noEmit`: exit 0 (final sources).
- Backend, `pytest -p no:xdist` (venv Python 3.12):
  - `tests/test_local_user_create_2438.py` (new, 11): create with a password + forced change at the sign-in + audit rows; `must_change`
    off; create without a password still returns the link; the policy refuses (min length from the setting, contextual, repeated) and
    nothing is created; every refusal of the create route audited with its reason (11 cases) and the typed name not in the audit;
    feature off / administrative target on the remote channel audited, a plain user created remotely with a password; set-password on
    an existing user (policy, sessions and links end, old password dead, `must_change` honoured, audit details, a pending user);
    permission / unknown user / disabled / feature off / administrative target local-only; a local identity without the permission;
    `password_min` in the list; the password never in logs, audit, answers or a dump of the database.
  - `tests/test_local_session_cache_race_2438.py` (new, 4): the interleaving for set-password / `sessions/revoke` / disable (the first
    two FAILED before the cache fix: 200 instead of 401), and the hold is per chain and ends.
  - One run of `test_local_user_create_2438.py` (with the race tests still inside it) + `test_local_identity.py` +
    `test_local_auth_inventory.py` + `test_local_reset.py` + `test_local_passkeys.py` + `test_passkey_only.py` +
    `test_xsecfollow_297.py` on the final backend code: 210 passed.
  - `test_local_session_cache_race_2438.py` + `test_fixture_job.py` + `test_gate_tablet_allowlist.py` after the move: 17 passed.
- Frontend unit (after `npx vite build`, private port, `--project=desktop --workers=1`):
  `tests/unit-local-user-create-2438.spec.ts` (new, 17) + `unit-arx-local-login.spec.ts` + `unit-service-identity.spec.ts` +
  `unit-uxrest2-295.spec.ts` + `unit-a11y-polished-lint.spec.ts`: 62 passed. The new 17: `sw-button type="submit"` submits its form
  (not when disabled, not `type="button"`); the create button sends one POST with the exact body; Enter sends; the pair is checked
  before sending (missing / different / shorter than the server's minimum); "must change" default on and switchable; "send a link
  instead" sends no password and shows the link; four server refusals shown inside the form, in view, with the form kept; offline;
  an administrative role on the remote channel sends nothing (also by Enter); set-password on a user (check, PUT body, result line);
  its refusal shown in the panel; no set-password action for an administrative user on the remote channel, present on the local
  one; English texts.
- Browser on the REAL backend (`tests/fixtures/arx_fake_ha.py`, the remote channel at `/arx/` + the local channel; only Home
  Assistant core is fake), `tests/evidence-local-user-create-2438.spec.ts`, desktop: 3 passed, three runs in a row on the final code
  (the last two on the final build):
  1. remote channel, signed in as the system administrator: a Hebrew username and one with a space are refused with the server's
     sentence inside the form; a password the policy refuses likewise; capitals + a Hebrew display name + a password are created
     (201), listed by the server as `active` / must change; the new user signs in on another device, is held on "choose a new
     password", chooses one and enters; the administrator's password no longer works;
  2. remote channel: "send a link instead" shows the one-time link; every role the picker enables x every scope it lists is accepted
     by the server (33 roles x 4 scopes = 132 creates, none refused);
  3. local channel: create by Enter with "must change" off, the user enters without a forced change; set-password on the user ends the
     user's open sign-in at once (401) and the next sign-in is held on the change step; the local picker (34 roles x 4 scopes = 136
     creates, the administrative roles included) is accepted in full.
  The server log of those runs was searched for the three passwords used: 0 hits.

## NOT_RUN

- Tablet / mobile Playwright projects for the new specs; the full frontend and backend suites; pixel runs; the runner entry check (by
  instruction).
- No check against the lab add-on or the owner's site (no access by instruction). `npm run build:addon` was not run: the shipped `www`
  bundle is not rebuilt on this branch (the release train does it).
- Safari / iOS: Enter-to-submit relies on a `hidden` native submit button; verified in Chromium only. The visible button does not
  depend on it.
- `evidence-wiskey-profiles.spec.ts` (needs its own fixture): the people-search click path changed from two handlers to the form's
  submit; covered here only by the `sw-button` unit test.

## Pixels to refresh

None expected: no `pixel-*.spec.ts` renders this tab (searched `tab=local`, `local-users`, `system-local-users`, `data-local`), and
`sw-button` renders the same DOM and styles. Evidence screenshots (not baselines) that change: `evidence-access-polish-2331`
`local-user-detail*` (the new "קביעת סיסמה" button) and `local-user-add*` (the username hint, the password section).

## Owner questions

1. Default of "must change at the first sign-in": ON (recommended; a. keep ON, b. OFF by default).
2. Default of the create form: "I set a password now" (as asked; a. keep, b. default to the link).
